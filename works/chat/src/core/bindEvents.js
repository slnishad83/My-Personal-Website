/**
 * NSL Chat — Delegated Event Binding
 * Replaces inline onclick/onfocus/onblur/onkeydown handlers with data-action attributes.
 *
 * Usage in HTML:
 *   <button data-action="openProfile">Open</button>
 *   <button data-action="navigate" data-action-url="expenses.html">Expenses</button>
 *   <button data-action="closeOverlay" data-action-arg="nsl-utilities-overlay">Close</button>
 *   <input data-action-keydown="onInputKeyDown" ... />
 *   <input data-action-input="filterChats" ... />
 *
 * The action name is resolved against window.* (backward-compat IIFE globals).
 */
;(function () {
  'use strict';

  var _registry = {};
  var _initialized = false;

  /* ── Pending action queue ──
     Some feature modules (music player, calculator, ...) are lazy-loaded a
     tick after first paint. A user click that lands before the module registers
     its window.* handler used to be dropped with "Unknown action". We now queue
     such clicks and retry for a short window so they fire once the module loads.
  */
  var _pendingActions = [];
  var _pendingTimer = null;

  function resolve(fnName) {
    if (_registry[fnName]) return _registry[fnName];
    var fn = typeof window[fnName] === 'function' ? window[fnName] : null;
    if (fn) _registry[fnName] = fn;
    return fn;
  }

  function flushPending(force) {
    if (!_pendingActions.length) return true;
    var remaining = [];
    var now = Date.now();
    for (var i = 0; i < _pendingActions.length; i++) {
      var pending = _pendingActions[i];
      var fn = resolve(pending.fnName);
      if (fn) {
        try { pending.arg ? fn(pending.arg, pending.el) : fn(pending.el); } catch (e) { console.error('[bindEvents] Error flushing pending action', pending.fnName, e); }
      } else if (!force && pending.el && pending.el.isConnected && now - pending.ts < pending.ttl) {
        remaining.push(pending);
      }
    }
    _pendingActions = remaining;
    if (_pendingActions.length) {
      _pendingTimer = setTimeout(flushPending, 350);
      return false;
    }
    _pendingTimer = null;
    return true;
  }

  function queueAction(el, fnName, arg) {
    _pendingActions.push({
      el: el,
      fnName: fnName,
      arg: arg || el.getAttribute('data-action-arg') || null,
      ts: Date.now(),
      ttl: 6000 // give lazy modules up to ~6s to register
    });
    if (!_pendingTimer) _pendingTimer = setTimeout(flushPending, 350);
  }

  function invokeAction(el, fnName, extraArg) {
    var fn = resolve(fnName);
    if (!fn) {
      console.warn('[bindEvents] Unknown action:', fnName);
      return;
    }
    var arg = extraArg || el.getAttribute('data-action-arg') || null;
    try {
      arg ? fn(arg, el) : fn(el);
    } catch (e) {
      console.error('[bindEvents] Error invoking', fnName, e);
    }
  }

  /* ── Click delegation (data-action) ── */
  function handleClick(e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    var url = el.getAttribute('data-action-url');
    if (action === 'navigate' && url) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = url;
      return;
    }
    if (action && resolve(action)) {
      e.preventDefault();
      e.stopPropagation();
      invokeAction(el, action);
    } else if (action) {
      // Action not registered yet (lazy module still loading). Queue it so a
      // fast click right after load is not silently dropped.
      queueAction(el, action);
    }
  }

  /* ── Keyboard delegation (data-action-keydown) ── */
  function handleKeydown(e) {
    var el = e.target.closest('[data-action-keydown]');
    if (!el) return;
    var fnName = el.getAttribute('data-action-keydown');
    if (!fnName) return;
    if (fnName === 'always') {
      var actionName = el.getAttribute('data-action');
      if (!actionName) return;
      var fn = resolve(actionName);
      if (!fn) return;
      try { fn(e); } catch (err) { console.error('[bindEvents] keydown error:', actionName, err); }
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    var fn2 = resolve(fnName);
    if (!fn2) return;
    try { fn2(e); } catch (err) { console.error('[bindEvents] keydown error:', fnName, err); }
  }

  /* ── Input delegation (data-action-input) ── */
  function handleInput(e) {
    var el = e.target.closest('[data-action-input]');
    if (!el) return;
    var fnName = el.getAttribute('data-action-input');
    if (!fnName) return;
    var fn = resolve(fnName);
    if (!fn) return;
    try { fn(el.value, e); } catch (err) { console.error('[bindEvents] input error:', fnName, err); }
  }

  /* ── Change delegation (data-action-change) ── */
  function handleChange(e) {
    var el = e.target.closest('[data-action-change]');
    if (!el) return;
    var fnName = el.getAttribute('data-action-change');
    if (!fnName) return;
    var fn = resolve(fnName);
    if (!fn) return;
    try { fn(el.value, el); } catch (err) { console.error('[bindEvents] change error:', fnName, err); }
  }

  /* ── Focus delegation (data-action-focus) ── */
  function handleFocus(e) {
    var el = e.target.closest('[data-action-focus]');
    if (!el) return;
    var fnName = el.getAttribute('data-action-focus');
    if (!fnName) return;
    invokeAction(el, fnName);
  }

  /* ── Blur delegation (data-action-blur) ── */
  function handleBlur(e) {
    var el = e.target.closest('[data-action-blur]');
    if (!el) return;
    var fnName = el.getAttribute('data-action-blur');
    if (!fnName) return;
    invokeAction(el, fnName);
  }

  /* ── Expose manual registration for JS-generated HTML ── */
  window.BindEvents = {
    register: function (name, fn) { _registry[name] = fn; },
    invoke: invokeAction,
    flush: function () { flushPending(true); },
    hasPending: function () { return _pendingActions.length > 0; },
    init: init
  };

  function init() {
    if (_initialized) return;
    _initialized = true;
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
