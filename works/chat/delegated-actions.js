'use strict';
/* Delegated event handlers — replaces all inline onclick attributes in index.html */
(function() {
  var ACTIONS = {
    'toggleChatMute': function(el) {
      var chatId = el.dataset.chatId || (App && App.currentChat && App.currentChat.id);
      if (!chatId) return;
      if (App._mutedChats && App._mutedChats.has(chatId)) {
        if (typeof toggleMuteChat === 'function') toggleMuteChat(chatId);
      } else {
        if (typeof showMuteChatOptions === 'function') showMuteChatOptions(chatId);
      }
    },
    'showPermissions': function() {
      if (typeof closeModal === 'function') closeModal('profile-overlay');
      if (window.PermissionsManager) PermissionsManager.showScreen();
    },
    'showKeyboardShortcuts': function() {
      if (typeof closeModal === 'function') closeModal('profile-overlay');
      if (window.KeyboardShortcuts) KeyboardShortcuts.showHelp();
    },
    'showTwoFactorAuth': function() {
      if (typeof closeModal === 'function') closeModal('profile-overlay');
      if (window.TwoFactorAuth) TwoFactorAuth.openSettings();
    },
    'showDataSaver': function() {
      if (typeof closeModal === 'function') closeModal('profile-overlay');
      if (window.DataSaver) DataSaver.openSettings();
    },
    'showDisappearingMessages': function() {
      if (typeof closeModal === 'function') closeModal('profile-overlay');
      if (window.SelfDestruct) SelfDestruct.openGlobalDefaultSettings();
    },
    'showLinkedDevices': function() {
      if (typeof closeModal === 'function') closeModal('profile-overlay');
      if (window.MultiDevice) MultiDevice.openLinkedDevices();
    },
    'showWallpaperGallery': function() {
      if (typeof closeModal === 'function') closeModal('profile-overlay');
      if (window.WallpaperGallery) WallpaperGallery.openGallery(null);
    },
    'showFindFriends': function() {
      if (typeof closeModal === 'function') closeModal('profile-overlay');
      if (window.ContactSync) ContactSync.openFindFriends();
    },
    'toggleAppLock': function() {
      if (typeof closeModal === 'function') closeModal('profile-overlay');
      if (typeof toggleAppLock === 'function') {
        if (typeof isAppLockEnabled === 'function' && isAppLockEnabled()) {
          if (typeof resetAppLockPin === 'function') resetAppLockPin();
          if (typeof showToast === 'function') showToast('App Lock disabled', 'success');
        } else {
          if (typeof showAppLock === 'function') showAppLock();
        }
      }
    },
    'showChatLockSettings': function() {
      if (typeof closeModal === 'function') closeModal('profile-overlay');
      if (typeof openChatLockSettings === 'function') openChatLockSettings();
    },
    'showFontSizeSettings': function() {
      if (typeof closeModal === 'function') closeModal('profile-overlay');
      if (typeof openFontSizeSettings === 'function') openFontSizeSettings();
    },
    'showChangeNumber': function() {
      if (typeof closeModal === 'function') closeModal('profile-overlay');
      if (typeof openChangeNumber === 'function') openChangeNumber();
    },
    'closeSearchModal': function() {
      var el = document.getElementById('globalSearchModal');
      if (el) el.style.display = 'none';
    },
    'endCallFromBubble': function(e) {
      e.stopPropagation();
      if (typeof endCall === 'function') endCall();
    },
    'maximizeCall': function() {
      var bubble = document.getElementById('call-bubble');
      if (bubble) bubble.style.display = 'none';
      var overlay = document.getElementById('call-overlay');
      if (overlay) overlay.classList.remove('hidden');
    }
  };

  document.addEventListener('click', function(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;
    if (action && ACTIONS[action]) {
      ACTIONS[action].call(target, e, target);
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.target.id === 'skip-nav' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      var t = document.getElementById('chat-list') || document.getElementById('msg-input');
      if (t) { t.focus(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
  });
})();
