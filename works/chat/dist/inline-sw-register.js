/* PWA Service Worker Registration */
if ('serviceWorker' in navigator) {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.update().catch(function() {});
  } else {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/works/chat/sw.js', { scope: '/works/chat/' })
        .then(function (reg) {
          console.log('[SW] Registered:', reg.scope);
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
}

/* M2: Sidebar expand/collapse toggle */
window.toggleSidebarExpand = function() {
  var sidebar = document.getElementById('sidebar');
  var icon = document.getElementById('sidebar-toggle-icon');
  if (!sidebar) return;
  if (sidebar.classList.contains('w-20')) {
    sidebar.classList.remove('w-20');
    sidebar.classList.add('w-64');
    if (icon) icon.textContent = 'menu';
  } else {
    sidebar.classList.remove('w-64');
    sidebar.classList.add('w-20');
    if (icon) icon.textContent = 'menu_open';
  }
};

window.addEventListener('load', () => {
  if (window.ErrorBoundary) ErrorBoundary.init();
  if (window.A11y) A11y.init();
  if (window.KeyboardShortcuts) KeyboardShortcuts.init();
  if (window.SwipeDelete) SwipeDelete.init();
  if (window.BackButton) BackButton.init();
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && window.IOSKeyboardFix) IOSKeyboardFix.init();
  const chatList = document.getElementById('chat-list');
  if (chatList && window.PullToRefresh) PullToRefresh.init(chatList);
  if (window.PinchZoom) PinchZoom.init(document.getElementById('messages-wrap'));

  setTimeout(async () => {
    if (window.OfflineQueue) await OfflineQueue.init();
  }, 3000);
});

firebase.auth().onAuthStateChanged((user) => {
  window.currentUser = user || null;
  if (user) {
    setTimeout(async () => {
      if (window.Presence) await Presence.init();
      if (window.MultiDevice) await MultiDevice.init();
      if (window.Security) await Security.init();
    }, 2000);
  } else {
    if (window.Presence) Presence.destroy();
    if (window.MultiDevice) MultiDevice.destroy();
    if (window.Security) Security.destroy();
    window.location.replace('login.html');
  }
});