/* ============================================================
   BACK BUTTON — Android/Capacitor system back button handling
   Handles back navigation: close overlays, go back in chat,
   exit app gracefully
   ============================================================ */
'use strict';

const BackButton = {
  _enabled: false,
  _history: [],
  _overlayStack: [],

  init() {
    if (this._enabled) return;
    if (typeof window.Capacitor === 'undefined') return;

    window.addEventListener('backbutton', this._onBack.bind(this), false);

    if (window.Capacitor?.Plugins?.App) {
      window.Capacitor.Plugins.App.addListener('backButton', this._onBack.bind(this));
    }
    this._enabled = true;
    if (window.__DEBUG__) console.log('[BackButton] Initialized');
  },

  _onBack(e) {
    e?.preventDefault?.();

    // 1. Close any open overlay/modal
    const openOverlay = document.querySelector('.overlay:not(.hidden):not([style*="display: none"])');
    if (openOverlay) {
      openOverlay.classList.add('hidden');
      openOverlay.style.display = 'none';
      return;
    }

    // 2. Close emoji picker, attach menu, context menu
    const emojiPicker = document.getElementById('emoji-picker');
    if (emojiPicker && emojiPicker.style.display !== 'none' && !emojiPicker.classList.contains('hidden')) {
      emojiPicker.style.display = 'none';
      return;
    }

    const attachMenu = document.getElementById('attach-menu');
    if (attachMenu && attachMenu.style.display !== 'none' && !attachMenu.classList.contains('hidden')) {
      attachMenu.style.display = 'none';
      return;
    }

    // 3. If in a chat, go back to chat list
    const chatArea = document.getElementById('chat-area');
    if (chatArea && chatArea.style.display !== 'none') {
      if (typeof window.backToList === 'function') {
        window.backToList();
        return;
      }
    }

    // 4. If on a non-chats tab, switch to chats
    const activeTab = document.querySelector('.bottom-nav-item.text-primary-fixed, .tab-item.bg-primary-fixed\\/10');
    if (activeTab && activeTab.dataset.tab !== 'chats') {
      if (typeof window.switchTab === 'function') {
        window.switchTab('chats');
        return;
      }
    }

    // 5. Default: let the system handle (exit app)
  },

  destroy() {
    this._enabled = false;
  }
};

window.BackButton = BackButton;
