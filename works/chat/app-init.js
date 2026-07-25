// ========================================
// APPLICATION INITIALIZATION
// ========================================

// Parse deep-link params from URL (notification clicks, shared links)
(function() {
  var params = new URLSearchParams(window.location.search);
  var deepLink = {};
  var keys = ['messageId', 'chatId', 'kind', 'chatType', 'groupId', 'callId', 'callAction'];
  for (var i = 0; i < keys.length; i++) {
    var val = params.get(keys[i]);
    if (val) deepLink[keys[i]] = val;
  }
  if (Object.keys(deepLink).length) window.__deepLink = deepLink;
})();

// M2: Sidebar expand/collapse toggle (tablet view)
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

// Run framework initializers
if (typeof init === 'function') {
  init().then(function() {
    handleDeepLink();
  }).catch((error) => {
    console.error("Application startup failed:", error);
    handleDeepLink();
  });
} else {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(handleDeepLink, 1500);
  });
}

function handleDeepLink() {
  if (window.__deepLink) {
    var dl = window.__deepLink;
    window.__deepLink = null;
    window.history.replaceState({}, '', window.location.pathname);

    if (dl.callId && typeof window.handleCallAction === 'function') {
      window.handleCallAction(dl.callId, dl.callAction || 'accept');
    } else if (dl.messageId || dl.chatId) {
      if (typeof window.handleNotificationClick === 'function') {
        window.handleNotificationClick(dl);
      } else if (dl.chatId && typeof window.openChat === 'function') {
        window.openChat(dl.chatId).then(function() {
          if (dl.messageId && typeof window.highlightMessage === 'function') {
            setTimeout(function() { window.highlightMessage(dl.messageId); }, 500);
          }
        });
      }
    }
  }
}
