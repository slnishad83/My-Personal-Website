/* ============================================================
   KEYBOARD SHORTCUTS — WhatsApp-style keyboard navigation
   Escape to close, Ctrl+Shift+F to search, Arrow keys, etc.
   ============================================================ */
'use strict';

const KeyboardShortcuts = {
  _handlers: [],
  _enabled: true,

  init() {
    document.addEventListener('keydown', (e) => this._handleKeydown(e));
    console.log('[KeyboardShortcuts] Initialized');
  },

  _handleKeydown(e) {
    if (!this._enabled) return;
    const target = e.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    const isMeta = e.ctrlKey || e.metaKey;
    const isOverlayOpen = document.querySelector('.overlay:not(.hidden)');

    /* ── Escape: Close overlays/modals ──────────────────── */
    if (e.key === 'Escape') {
      if (isOverlayOpen) return;
      if (window.App?.emojiPickerOpen) { if (typeof toggleEmojiPicker === 'function') toggleEmojiPicker(); e.preventDefault(); return; }
      if (window.App?.attachMenuOpen) { if (typeof toggleAttachMenu === 'function') toggleAttachMenu(); e.preventDefault(); return; }
      if (window.App?.formatBarOpen) { if (typeof hideFormatBar === 'function') hideFormatBar(); e.preventDefault(); return; }
      if (!isInput && typeof clearSidebarSearch === 'function') {
        const searchInput = document.getElementById('sidebar-search');
        if (searchInput && searchInput.value) { clearSidebarSearch(); e.preventDefault(); return; }
      }
    }

    /* ── Ctrl+Shift+F / Cmd+Shift+F: Open search (when not in input) ── */
    if (isMeta && e.shiftKey && e.key === 'F' && !isInput) {
      e.preventDefault();
      if (typeof openChatSearch === 'function') openChatSearch();
      return;
    }

    /* ── Ctrl+Shift+N / Cmd+Shift+N: New chat ──────────── */
    if (isMeta && e.shiftKey && e.key === 'N' && !isInput) {
      e.preventDefault();
      if (typeof openNewChat === 'function') openNewChat();
      return;
    }

    /* ── Backspace in empty input: Go back (mobile) ────── */
    if (e.key === 'Backspace' && isInput && target.id === 'msg-input' && !target.value.trim()) {
      if (window.innerWidth < 768 && typeof backToList === 'function') {
        backToList();
      }
    }

    /* ── Enter in search input: trigger search ─────────── */
    if (e.key === 'Enter' && !e.shiftKey && target.id === 'sidebar-search') {
      if (typeof triggerSidebarSearch === 'function') {
        e.preventDefault();
        triggerSidebarSearch();
      }
    }

    /* ── Tab navigation: trap in modal (handled by accessibility.js) ── */
    /* Focus trap is managed by A11y._trapFocus to avoid duplicate handlers */

    /* ── Arrow keys in chat list ───────────────────────── */
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isInput && !isOverlayOpen) {
      const chatItems = document.querySelectorAll('#chat-list .chat-list-item, #chat-list [role="listitem"]');
      if (chatItems.length === 0) return;
      const current = document.activeElement;
      let idx = Array.from(chatItems).indexOf(current);
      if (e.key === 'ArrowDown') {
        idx = idx < chatItems.length - 1 ? idx + 1 : 0;
      } else {
        idx = idx > 0 ? idx - 1 : chatItems.length - 1;
      }
      chatItems[idx]?.focus();
      e.preventDefault();
    }

    /* ── Number keys: switch tabs (with modal guard) ───── */
    if (!isInput && !isMeta && !e.altKey && !isOverlayOpen) {
      const tabMap = { '1': 'chats', '2': 'groups', '3': 'calls' };
      if (tabMap[e.key] && typeof switchTab === 'function') {
        switchTab(tabMap[e.key]);
      }
    }

    /* ── ? key: Show keyboard shortcuts help ────────────── */
    if (e.key === '?' && !isInput && !isMeta && !isOverlayOpen) {
      e.preventDefault();
      if (typeof showKeyboardHelp === 'function') showKeyboardHelp();
    }
  },

  enable() { this._enabled = true; },
  disable() { this._enabled = false; },
  destroy() { this._enabled = false; }
};

window.KeyboardShortcuts = KeyboardShortcuts;
