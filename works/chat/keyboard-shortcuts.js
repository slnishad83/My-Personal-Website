/* ============================================================
   KEYBOARD SHORTCUTS — WhatsApp-style keyboard navigation
   Escape to close, Ctrl+F to search, Arrow keys, etc.
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

    /* ── Escape: Close overlays/modals ──────────────────── */
    if (e.key === 'Escape') {
      const overlays = document.querySelectorAll('.overlay:not(.hidden)');
      for (const overlay of overlays) {
        const closeBtn = overlay.querySelector('[onclick*="close"], [onclick*="hide"], [onclick*="Overlay"]');
        if (closeBtn) { closeBtn.click(); e.preventDefault(); return; }
      }
      if (window.App?.emojiPickerOpen) { if (typeof toggleEmojiPicker === 'function') toggleEmojiPicker(); e.preventDefault(); return; }
      if (window.App?.attachMenuOpen) { if (typeof toggleAttachMenu === 'function') toggleAttachMenu(); e.preventDefault(); return; }
      if (window.App?.formatBarOpen) { if (typeof hideFormatBar === 'function') hideFormatBar(); e.preventDefault(); return; }
    }

    /* ── Ctrl+F / Cmd+F: Open search (when not in input) ── */
    if (isMeta && e.key === 'f' && !isInput) {
      e.preventDefault();
      if (typeof openChatSearch === 'function') openChatSearch();
      return;
    }

    /* ── Ctrl+N / Cmd+N: New chat ──────────────────────── */
    if (isMeta && e.key === 'n' && !isInput) {
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

    /* ── Tab navigation: trap in modal ─────────────────── */
    if (e.key === 'Tab') {
      const openOverlay = document.querySelector('.overlay:not(.hidden)');
      if (openOverlay) {
        const focusable = openOverlay.querySelectorAll(
          'button:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), ' +
          'input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), ' +
          'textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    }

    /* ── Arrow keys in chat list ───────────────────────── */
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isInput) {
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

    /* ── Number keys: switch tabs ──────────────────────── */
    if (!isInput && !isMeta && !e.altKey) {
      const tabMap = { '1': 'chats', '2': 'groups', '3': 'calls' };
      if (tabMap[e.key] && typeof switchTab === 'function') {
        switchTab(tabMap[e.key]);
      }
    }
  },

  enable() { this._enabled = true; },
  disable() { this._enabled = false; },
  destroy() { this._enabled = false; }
};

window.KeyboardShortcuts = KeyboardShortcuts;
