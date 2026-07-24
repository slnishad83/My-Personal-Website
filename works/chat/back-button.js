/* ============================================================
   BACK BUTTON — Android/Capacitor system back button handling
   Handles back navigation: close overlays, go back in chat,
   prevent exit from chat system on web browsers
   ============================================================ */
'use strict';

const BackButton = {
  _enabled: false,
  _history: [],
  _overlayStack: [],
  _boundOnBack: null,
  _boundOnWebBack: null,

  init() {
    if (this._enabled) return;

    this._boundOnBack = this._onBack.bind(this);
    this._boundOnWebBack = this._onWebBack.bind(this);

    // Capacitor / Android system back button
    if (typeof window.Capacitor !== 'undefined') {
      window.addEventListener('backbutton', this._boundOnBack, false);
      if (window.Capacitor?.Plugins?.App) {
        window.Capacitor.Plugins.App.addListener('backButton', this._boundOnBack);
      }
    }

    // Web browser back button — intercept via popstate
    window.addEventListener('popstate', this._boundOnWebBack);

    // Push initial state so first back doesn't exit
    if (!history.state || !history.state.view) {
      history.replaceState({ view: 'home' }, '', window.location.pathname);
    }

    this._enabled = true;
    if (window.__DEBUG__) console.log('[BackButton] Initialized');
  },

  _onBack(e) {
    e?.preventDefault?.();
    this._handleBack();
  },

  _onWebBack(e) {
    const state = e.state;

    // If in a chat, go back to chat list
    if (App.currentChat) {
      if (typeof window.backToList === 'function') {
        window.backToList(false);
        return;
      }
    }

    // If on a non-chats tab, switch to chats
    const activeTab = document.querySelector('.tab-item.active, .tab-item[aria-current="page"]');
    if (activeTab && activeTab.dataset.tab !== 'chats') {
      if (typeof window.switchTab === 'function') {
        window.switchTab('chats');
        return;
      }
    }

    if (state && state.view === 'home') {
      return;
    }
    history.back();
  },

  _handleBack() {
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
    const activeTab = document.querySelector('.bottom-nav-item.active, .bottom-nav-item[aria-current="page"], .tab-item.active, .tab-item[aria-current="page"]');
    if (activeTab && activeTab.dataset.tab !== 'chats') {
      if (typeof window.switchTab === 'function') {
        window.switchTab('chats');
        return;
      }
    }

    // 5. Default: prevent exit — push state back
    if (!history.state || history.state.view === 'home') {
      return;
    }
    history.back();
  },

  destroy() {
    this._enabled = false;
    if (typeof window.Capacitor !== 'undefined' && this._boundOnBack) {
      window.removeEventListener('backbutton', this._boundOnBack);
    }
    if (this._boundOnWebBack) window.removeEventListener('popstate', this._boundOnWebBack);
    this._boundOnBack = this._boundOnWebBack = null;
  }
};

window.BackButton = BackButton;
