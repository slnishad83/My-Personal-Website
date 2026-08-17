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

// Firestore offline persistence
(function() {
  var db = window.db || (window.App && window.App.db) || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  if (db && db.enablePersistence) {
    db.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
      if (err.code === 'failed-precondition') {
        console.warn('[Offline] Persistence unavailable: multiple tabs');
      } else if (err.code === 'unimplemented') {
        console.warn('[Offline] Persistence not supported by browser');
      }
    });
  }
})();

// Run framework initializers
if (typeof init === 'function') {
  init().then(function() {
    document.dispatchEvent(new CustomEvent('nsl:app-ready'));
    if (typeof window.hideLoadingScreen === 'function') window.hideLoadingScreen();
    handleDeepLink();
  }).catch((error) => {
    if (window.__DEBUG__) console.error("Application startup failed:", error);
    document.dispatchEvent(new CustomEvent('nsl:app-ready'));
    if (typeof window.hideLoadingScreen === 'function') window.hideLoadingScreen();
    handleDeepLink();
  });
} else {
  document.addEventListener('DOMContentLoaded', function() {
    document.dispatchEvent(new CustomEvent('nsl:app-ready'));
    if (typeof window.hideLoadingScreen === 'function') window.hideLoadingScreen();
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

// ========================================
// PROFILE OVERLAY � THEME LABEL & STATUS BADGE SYNC
// ========================================
(function() {
  function _getThemeLabel() {
    var mode = (typeof window.getThemeMode === 'function' ? window.getThemeMode() : null)
      || localStorage.getItem('themeMode') || 'system';
    var map = { dark: 'Dark', light: 'Light', system: 'System' };
    return map[mode] || 'System';
  }

  function _getThemeIcon() {
    var mode = (typeof window.getThemeMode === 'function' ? window.getThemeMode() : null)
      || localStorage.getItem('themeMode') || 'system';
    var map = { dark: 'dark_mode', light: 'light_mode', system: 'brightness_auto' };
    return map[mode] || 'brightness_auto';
  }

  function syncThemeLabel() {
    var label = document.getElementById('theme-label');
    var icon  = document.getElementById('theme-icon');
    if (label) label.textContent = _getThemeLabel();
    if (icon)  icon.textContent  = _getThemeIcon();
  }

  function syncProfileStatusBadge() {
    var badge = document.getElementById('profile-status-badge');
    if (!badge) return;
    var status = (window.currentUser && window.currentUser.status)
      || (window.currentUserProfile && window.currentUserProfile.status)
      || localStorage.getItem('nsl_user_status')
      || 'Available';
    badge.textContent = status;
  }

  function syncProfileAvatar() {
    var avatar = document.getElementById('profile-avatar');
    if (!avatar) return;
    avatar.classList.remove('animate-pulse');
    var u = window.currentUser;
    if (!u) return;
    if (u.photoURL) {
      avatar.style.backgroundImage = 'url(' + u.photoURL + ')';
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
      avatar.textContent = '';
    } else if (u.displayName) {
      avatar.textContent = (u.displayName || 'U').charAt(0).toUpperCase();
    } else if (u.email) {
      avatar.textContent = u.email.charAt(0).toUpperCase();
    }
  }

  window.addEventListener('themechange', syncThemeLabel);

  var profileOverlay = document.getElementById('profile-overlay');
  if (profileOverlay) {
    new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          if (!profileOverlay.classList.contains('hidden')) {
            syncThemeLabel();
            syncProfileStatusBadge();
            syncProfileAvatar();
          }
        }
      });
    }).observe(profileOverlay, { attributes: true, attributeFilter: ['class'] });
  }

  document.addEventListener('nsl:auth-ready', function() {
    syncProfileAvatar();
    syncProfileStatusBadge();
    syncThemeLabel();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncThemeLabel);
  } else {
    syncThemeLabel();
  }
})();
