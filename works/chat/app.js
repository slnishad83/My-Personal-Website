/**
 * NSL Chat â€” Core Application Module
 * Provides the shared App namespace, safe HTML escaping, and
 * a centralised online/offline reconnect coordinator so that
 * multiple feature modules do not each register redundant
 * online/offline handlers.
 */
(function () {
  'use strict';

  /* â”€â”€ Safe HTML Escaping (XSS prevention) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var _escDiv = document.createElement('div');
  function escHtml(str) {
    if (str == null) return '';
    _escDiv.textContent = String(str);
    return _escDiv.innerHTML;
  }
  window.escHtml = escHtml;

  /* â”€â”€ App Namespace â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  window.App = window.App || {};

  /* â”€â”€ Unified Online/Offline Coordinator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
        try { _reconnectCallbacks[i](); } catch (e) { if (window.__DEBUG__) console.warn('[App] Reconnect callback error:', e); }
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

  /* â”€â”€ Utility: Throttle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  /* â”€â”€ Utility: Debounce â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  /* â”€â”€ Safe HTML Escape (also available via App namespace) â”€â”€â”€â”€â”€â”€â”€â”€ */
  window.App.escHtml = escHtml;

  /* â”€â”€ Canonical esc alias â€” all modules should use this â”€â”€â”€â”€â”€â”€â”€â”€ */
  window.esc = escHtml;

  /* â”€â”€ Firebase Error Recovery Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var _isNetworkError = function (err) {
    if (!err) return false;
    var code = err.code || '';
    return code === 'unavailable' || code === 'deadline-exceeded' ||
           code === 'resource-exhausted' || code === 'internal' ||
           (err.message && (err.message.indexOf('network') !== -1 || err.message.indexOf('offline') !== -1));
  };

  window.App.firebaseReadWithRetry = function (ref, context, opts) {
    var maxRetries = (opts && opts.maxRetries) || 3;
    var baseDelay = (opts && opts.baseDelay) || 1000;

    function attempt(retryCount) {
      return ref.get().then(function (snap) {
        return snap;
      })['catch'](function (err) {
        if (err && (err.code === 'unavailable') && !navigator.onLine) {
          return { docs: [], exists: false, empty: true, size: 0, data: function () { return null; } };
        }
        if (retryCount >= maxRetries || !_isNetworkError(err)) throw err;
        if (typeof window.showToast === 'function') {
          window.showToast('Connection issue. Retrying...', 'info');
        }
        return new Promise(function (resolve) {
          setTimeout(resolve, baseDelay * Math.pow(2, retryCount));
        }).then(function () { return attempt(retryCount + 1); });
      });
    }
    return attempt(0);
  };

  var _safeSnapCounter = 0;
  window.App.safeOnSnapshot = function (ref, onNext, onError, context) {
    var _retryTimers = {};
    var _maxRetries = 5;
    var _baseDelay = 2000;
    var _id = _safeSnapCounter++;

    function subscribe(attempt) {
      var unsub = ref.onSnapshot(
        function (snap) { onNext(snap); },
        function (err) {
          if (err && (err.code === 'unavailable') && !navigator.onLine) {
            if (typeof window.showToast === 'function') {
              window.showToast('You are offline. Waiting to reconnect...', 'info');
            }
            var onReconnect = function () {
              window.removeEventListener('online', onReconnect);
              setTimeout(function () { subscribe(0); }, 1500);
            };
            window.addEventListener('online', onReconnect);
            return;
          }
          if (typeof onError === 'function') onError(err);
          if (attempt < _maxRetries) {
            var delay = _baseDelay * Math.pow(2, attempt);
            var timerKey = (context || 'default') + '_' + _id;
            _retryTimers[timerKey] = setTimeout(function () {
              subscribe(attempt + 1);
            }, delay);
          } else {
            if (typeof window.showToast === 'function') {
              window.showToast('Lost connection to updates. Please refresh.', 'error');
            }
          }
        }
      );
      return unsub;
    }

    var unsub = subscribe(0);
    var orig = unsub;
    return function () {
      Object.keys(_retryTimers).forEach(function (k) { clearTimeout(_retryTimers[k]); });
      try { orig(); } catch (_) {}
    };
  };
  /* ── Offline Write Queue (lightweight in-memory + localStorage) ─ */
  App._offlineQueue = [];
  App.queueOfflineWrite = function (writeFn, context) {
    App._offlineQueue.push({ writeFn: writeFn, context: context, timestamp: Date.now() });
    try { localStorage.setItem('nsl_offline_queue', JSON.stringify(App._offlineQueue.length)); } catch (_) {}
  };
  window.addEventListener('online', function () {
    var queue = App._offlineQueue.splice(0);
    queue.forEach(function (item) {
      try {
        item.writeFn().catch(function (err) {
          console.error('[Offline] Queued write failed:', item.context, err);
        });
      } catch (_) {}
    });
    try { localStorage.removeItem('nsl_offline_queue'); } catch (_) {}
  });

  /* ── Offline Banner (uses existing #offline-banner from HTML) ─ */
  function updateOfflineBanner() {
    var banner = document.getElementById('offline-banner');
    if (!banner) return;
    if (!navigator.onLine) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
  window.addEventListener('online', updateOfflineBanner);
  window.addEventListener('offline', updateOfflineBanner);

  if (!window.renderMessages) {
    window.renderMessages = function (chatId) {
      if (typeof window.loadMessages === 'function') window.loadMessages(chatId);
      else if (window.App && typeof window.App.renderMessages === 'function') window.App.renderMessages(chatId);
    };
  }

})();
