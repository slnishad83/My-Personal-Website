'use strict';
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/works/chat/dist/sw.js', { scope: '/works/chat/', updateViaCache: 'none' })
      .then(function (reg) {
        console.log('[SW] Registered:', reg.scope);
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
      .catch(function (err) { console.warn('[SW] Registration failed:', err); });
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
});

firebase.auth().onAuthStateChanged(function(user) {
  window.currentUser = user || null;
  if (user) {
    async function initAuthSubsystems() {
      try {
        if (window.Presence) await Presence.init();
        if (window.MultiDevice) await MultiDevice.init();
        if (window.Security) await Security.init();
        if (window.ShouldShowOnboarding && ShouldShowOnboarding()) {
          setTimeout(function() { if (window.ShowOnboarding) ShowOnboarding(); }, 1500);
        }
      } catch (e) { console.warn('[Bootstrap] Auth subsystem init error:', e); }
    }
    initAuthSubsystems();
  } else {
    if (typeof window.endCall === 'function') { try { window.endCall(); } catch(_) {} }
    if (typeof window.CleanupGroupCall === 'function') { try { window.CleanupGroupCall(); } catch(_) {} }
    if (window.Presence) Presence.destroy();
    if (window.MultiDevice) MultiDevice.destroy();
    if (window.Security) Security.destroy();
    if (!location.pathname.endsWith('login.html')) {
      window.location.replace('login.html');
    }
  }
});
