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

  function resolve(fnName) {
    if (_registry[fnName]) return _registry[fnName];
    var fn = typeof window[fnName] === 'function' ? window[fnName] : null;
    if (fn) _registry[fnName] = fn;
    return fn;
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
    e.preventDefault();
    e.stopPropagation();
    var action = el.getAttribute('data-action');
    var url = el.getAttribute('data-action-url');
    if (action === 'navigate' && url) {
      window.location.href = url;
      return;
    }
    if (action) invokeAction(el, action);
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
    var fn = resolve(fnName);
    if (!fn) return;
    try { fn(e); } catch (err) { console.error('[bindEvents] keydown error:', fnName, err); }
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
