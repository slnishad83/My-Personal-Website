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
})();
