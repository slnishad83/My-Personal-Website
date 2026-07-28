'use strict';
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/works/chat/dist/sw.js', { scope: '/works/chat/', updateViaCache: 'none' })
      .then(function (reg) {
        if (window.__DEBUG__) console.log('[SW] Registered:', reg.scope);
        reg.update().catch(function() {});
        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', function () {
              if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                if (typeof showToast === 'function') showToast('App updated! Refresh for the latest version.', 'info');
              }
            });
          }
        });
      })
      .catch(function (err) { if (window.__DEBUG__) console.warn('[SW] Registration failed:', err); });
  });
}

window.addEventListener('load', async function() {
  if (window.ErrorBoundary) ErrorBoundary.init();
  if (window.A11y) A11y.init();
  if (window.KeyboardShortcuts) KeyboardShortcuts.init();
  if (window.SwipeDelete) SwipeDelete.init();
  if (window.BackButton) BackButton.init();
  if (window.VirtualKeyboardFix) VirtualKeyboardFix.init();
  var chatList = document.getElementById('chat-list');
  if (chatList && window.PullToRefresh) PullToRefresh.init(chatList);
  if (window.PinchZoom) PinchZoom.init(document.getElementById('messages-wrap'));
  if (window.InitA11yEnhancements) InitA11yEnhancements();
  if (window.InitLazyImages) InitLazyImages();

  if (window.OfflineQueue) await OfflineQueue.init();
  if (window.Monitoring) Monitoring.init();
});

var _authRetryCount = 0;
var _authMaxRetries = 3;
function _authStateChanged(user) {
  _authRetryCount = 0;
  window.currentUser = user || null;
  if (window.Monitoring) {
    if (user) { Monitoring.setUser(user); } else { Monitoring.clearUser(); }
  }
  if (user) {
    async function initAuthSubsystems() {
      try {
        if (window.Presence) await Presence.init();
        if (window.MultiDevice) await MultiDevice.init();
        if (window.Security) await Security.init();
        if (window.ShouldShowOnboarding && ShouldShowOnboarding()) {
          setTimeout(function() { if (window.ShowOnboarding) ShowOnboarding(); }, 1500);
        }
      } catch (e) { if (window.__DEBUG__) console.warn('[Bootstrap] Auth subsystem init error:', e); }
    }
    initAuthSubsystems();
  } else {
    if (typeof window.endCall === 'function') { try { window.endCall(); } catch(_) {} }
    if (typeof window.CleanupGroupCall === 'function') { try { window.CleanupGroupCall(); } catch(_) {} }
    if (window.Presence) Presence.destroy();
    if (window.MultiDevice) MultiDevice.destroy();
    if (window.Security) Security.destroy();
    var currentPath = location.pathname.toLowerCase();
    if (!currentPath.includes('login')) {
      setTimeout(function() {
        if (!firebase.auth().currentUser && !location.pathname.toLowerCase().includes('login')) {
          var loginUrl = new URL('login.html', window.location.href).href;
          window.location.replace(loginUrl);
        }
      }, 1500);
    }
  }
}

function _authStateChangedWithRetry(user) {
  _authRetryCount = 0;
  _authStateChanged(user);
}

try {
  firebase.auth().onAuthStateChanged(_authStateChangedWithRetry, function (err) {
    _authRetryCount++;
    if (window.__DEBUG__) console.error('[Bootstrap] Auth state listener error:', err?.message || err);
    if (_authRetryCount < _authMaxRetries) {
      setTimeout(function () {
        try {
          firebase.auth().onAuthStateChanged(_authStateChanged, function (_retryErr) {
            _authRetryCount++;
            if (_authRetryCount >= _authMaxRetries) {
              if (typeof window.showToast === 'function') {
                window.showToast('Connection issue. Please refresh the page.', 'error');
              }
            }
          });
        } catch (_) {}
      }, 2000 * Math.pow(2, _authRetryCount - 1));
    } else {
      if (typeof window.showToast === 'function') {
        window.showToast('Connection issue. Please refresh the page.', 'error');
      }
    }
  });
} catch (e) {
  if (window.__DEBUG__) console.error('[Bootstrap] Failed to register auth listener:', e);
}

if (window.App) {
  window.App._firebaseUnsubscribers = [];
  window.App.registerUnsubscriber = function (fn) {
    if (typeof fn === 'function') window.App._firebaseUnsubscribers.push(fn);
  };
  window.App.destroyAllSubscriptions = function () {
    window.App._firebaseUnsubscribers.forEach(function (fn) {
      try { fn(); } catch (_) {}
    });
    window.App._firebaseUnsubscribers = [];
  };
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   IDLE TIMEOUT â€” Lock after 30 minutes of inactivity
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

var _idleTimer;
function resetIdleTimer() {
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(function() {
    if (window.App && window.App.lockEnabled) {
      if (typeof showAppLock === 'function') showAppLock();
    }
  }, 30 * 60 * 1000);
}
['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(function(evt) {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});
resetIdleTimer();
