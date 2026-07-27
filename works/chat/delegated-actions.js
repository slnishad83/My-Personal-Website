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
        if (typeof window.isAppLockEnabled === 'function' && window.isAppLockEnabled()) {
          if (typeof window.resetAppLockPin === 'function') window.resetAppLockPin();
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
    'cancelReply': function() {
      if (typeof window.cancelReplyMode === 'function') window.cancelReplyMode();
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
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      var el = e.target;
      if (el.getAttribute('role') === 'button' && !el.matches('button, input, select, textarea, a')) {
        e.preventDefault();
        el.click();
      }
    }
  });

  document.addEventListener('keydown', function(e) {
    var menu = document.getElementById('attach-menu');
    if (!menu || menu.classList.contains('hidden')) return;
    var items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    if (!items.length) return;
    var idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      var next = idx < 0 ? 0 : (idx + 1) % items.length;
      items[next].focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      var prev = idx <= 0 ? items.length - 1 : idx - 1;
      items[prev].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      menu.classList.add('hidden');
      var trigger = document.querySelector('[data-action="toggleAttachMenu"]');
      if (trigger) trigger.focus();
    }
  });
})();
