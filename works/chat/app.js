/**
 * NSL Chat — Core Application Module
 * Provides the shared App namespace, safe HTML escaping, and
 * a centralised online/offline reconnect coordinator so that
 * multiple feature modules do not each register redundant
 * online/offline handlers.
 */
(function () {
  'use strict';

  /* ── Safe HTML Escaping (XSS prevention) ──────────────────────── */
  var _escDiv = document.createElement('div');
  function escHtml(str) {
    if (str == null) return '';
    _escDiv.textContent = String(str);
    return _escDiv.innerHTML;
  }
  window.escHtml = escHtml;

  /* ── App Namespace ────────────────────────────────────────────── */
  window.App = window.App || {};

  /* ── Unified Online/Offline Coordinator ───────────────────────── */
  var _reconnectCallbacks = [];
  var _reconnectTimer = null;
  var _wasOffline = false;

  /**
   * Register a callback to run once on reconnect after being offline.
   * Coalesces multiple modules' reconnect logic into a single
   * coordinated run to prevent redundant Firestore re-subscriptions.
   */
  function onReconnect(callback) {
    if (typeof callback === 'function') {
      _reconnectCallbacks.push(callback);
    }
  }

  function _handleOffline() {
    _wasOffline = true;
  }

  function _handleOnline() {
    if (!_wasOffline) return;
    _wasOffline = false;
    clearTimeout(_reconnectTimer);
    _reconnectTimer = setTimeout(function () {
      for (var i = 0; i < _reconnectCallbacks.length; i++) {
        try { _reconnectCallbacks[i](); } catch (e) { console.warn('[App] Reconnect callback error:', e); }
      }
    }, 1500);
  }

  window.addEventListener('online', _handleOnline);
  window.addEventListener('offline', _handleOffline);

  window.App.onReconnect = onReconnect;
  window.App.reconnect = {
    destroy: function () {
      window.removeEventListener('online', _handleOnline);
      window.removeEventListener('offline', _handleOffline);
      clearTimeout(_reconnectTimer);
      _reconnectCallbacks = [];
    }
  };

  /* ── Utility: Throttle ────────────────────────────────────────── */
  function throttle(fn, delay) {
    var last = 0;
    var timer = null;
    return function () {
      var now = Date.now();
      var remaining = delay - (now - last);
      var context = this;
      var args = arguments;
      if (remaining <= 0) {
        clearTimeout(timer);
        timer = null;
        last = now;
        fn.apply(context, args);
      } else if (!timer) {
        timer = setTimeout(function () {
          last = Date.now();
          timer = null;
          fn.apply(context, args);
        }, remaining);
      }
    };
  }
  window.App.throttle = throttle;

  /* ── Utility: Debounce ────────────────────────────────────────── */
  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(context, args); }, delay);
    };
  }
  window.App.debounce = debounce;

  /* ── Safe HTML Escape (also available via App namespace) ──────── */
  window.App.escHtml = escHtml;

  /* ── Canonical esc alias — all modules should use this ──────── */
  window.esc = escHtml;

  /* ── renderMessages bridge — ensures the function is on window ─ */
  if (!window.renderMessages) {
    window.renderMessages = function (chatId) {
      if (typeof window.loadMessages === 'function') window.loadMessages(chatId);
      else if (window.App && typeof window.App.renderMessages === 'function') window.App.renderMessages(chatId);
    };
  }

})();
