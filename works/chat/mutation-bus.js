/* ============================================================
   MutationBus v1.0 — Centralized MutationObserver service
   Replaces 19+ individual document.body observers with a
   managed bus.  Modules register by ID; bus handles lifecycle.

   API:
     MutationBus.onBodyChildList(id, cb)  — body childList+subtree
     MutationBus.onBodyAttribute(id, cb)  — body class/style changes
     MutationBus.observe(id, el, cfg, cb) — element-specific
     MutationBus.off(id)                  — unregister one
     MutationBus.destroyAll()             — disconnect everything
     MutationBus.count()                  — active subscriber count
   ============================================================ */
(function () {
  'use strict';

  var _subs  = Object.create(null);  // id → { cb, active, type, obs? }
  var _bodyChildObs   = null;
  var _bodyAttrObs    = null;
  var _pendingBody    = [];          // queued until body is ready
  var _pendingAttr    = [];

  /* ── body childList+subtree observer (single) ──────────────── */
  function _ensureBodyChild() {
    if (_bodyChildObs) return;
    _bodyChildObs = new MutationObserver(function (muts) {
      var added = [];
      for (var i = 0; i < muts.length; i++) {
        var nodes = muts[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          if (nodes[j].nodeType === 1) added.push(nodes[j]);
        }
      }
      if (!added.length) return;
      var keys = Object.keys(_subs);
      for (var k = 0; k < keys.length; k++) {
        var s = _subs[keys[k]];
        if (s && s.active && s.type === 'body-child') {
          try { s.cb(added, muts); } catch (e) { if (window.__DEBUG__) console.error('[MutationBus] ' + keys[k], e); }
        }
      }
    });
    _bodyChildObs.observe(document.body, { childList: true, subtree: true });
  }

  /* ── body attribute observer (single) ──────────────────────── */
  function _ensureBodyAttr() {
    if (_bodyAttrObs) return;
    _bodyAttrObs = new MutationObserver(function (muts) {
      var keys = Object.keys(_subs);
      for (var k = 0; k < keys.length; k++) {
        var s = _subs[keys[k]];
        if (s && s.active && s.type === 'body-attr') {
          try { s.cb(muts); } catch (e) { if (window.__DEBUG__) console.error('[MutationBus] attr ' + keys[k], e); }
        }
      }
    });
    _bodyAttrObs.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  /* ── public API ────────────────────────────────────────────── */

  /**
   * Subscribe to body childList+subtree mutations.
   * callback(addedNodes[], mutations[])
   * Returns unsubscribe function.
   */
  function onBodyChildList(id, callback) {
    if (!id || typeof callback !== 'function') return function () {};
    if (_subs[id]) { _subs[id].active = true; _subs[id].cb = callback; }
    else { _subs[id] = { cb: callback, active: true, type: 'body-child' }; }
    if (document.body) _ensureBodyChild();
    return function () { off(id); };
  }

  /**
   * Subscribe to body attribute mutations (class, style).
   * callback(mutations[])
   * Returns unsubscribe function.
   */
  function onBodyAttribute(id, callback) {
    if (!id || typeof callback !== 'function') return function () {};
    if (_subs[id]) { _subs[id].active = true; _subs[id].cb = callback; }
    else { _subs[id] = { cb: callback, active: true, type: 'body-attr' }; }
    if (document.body) _ensureBodyAttr();
    return function () { off(id); };
  }

  /**
   * Observe a specific element with its own MutationObserver.
   * Returns unsubscribe function.
   */
  function observe(id, element, config, callback) {
    if (!id || !element || !config || typeof callback !== 'function') return function () {};
    if (_subs[id]) off(id);
    var obs = new MutationObserver(callback);
    obs.observe(element, config);
    _subs[id] = { cb: callback, active: true, type: 'element', obs: obs };
    return function () { off(id); };
  }

  /**
   * Unregister a subscriber and disconnect its observer.
   */
  function off(id) {
    var s = _subs[id];
    if (!s) return;
    if (s.obs) { try { s.obs.disconnect(); } catch (e) {} }
    s.active = false;
    delete _subs[id];
  }

  /**
   * Disconnect everything.  Call on logout / page unload.
   */
  function destroyAll() {
    if (_bodyChildObs) { _bodyChildObs.disconnect(); _bodyChildObs = null; }
    if (_bodyAttrObs)  { _bodyAttrObs.disconnect();  _bodyAttrObs  = null; }
    var keys = Object.keys(_subs);
    for (var i = 0; i < keys.length; i++) {
      var s = _subs[keys[i]];
      if (s && s.obs) { try { s.obs.disconnect(); } catch (e) {} }
    }
    _subs = Object.create(null);
  }

  /**
   * Active subscriber count (debugging).
   */
  function count() {
    return Object.keys(_subs).length;
  }

  /* ── expose ─────────────────────────────────────────────────── */
  window.MutationBus = {
    onBodyChildList: onBodyChildList,
    onBodyAttribute: onBodyAttribute,
    observe:         observe,
    off:             off,
    destroyAll:      destroyAll,
    count:           count
  };

})();
