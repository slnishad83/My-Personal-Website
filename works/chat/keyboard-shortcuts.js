/* ============================================================
   KEYBOARD SHORTCUTS — Desktop-Grade Keyboard Navigation (D-C4)
   30+ shortcuts covering every desktop interaction pattern.
   ============================================================ */
'use strict';

const KeyboardShortcuts = {
  _handlers: [],
  _enabled: true,
  _selectedMsgId: null,

  _keydownBound: null,

  init() {
    this._keydownBound = (e) => this._handleKeydown(e);
    document.addEventListener('keydown', this._keydownBound);
    this._buildHelpPanel();
    if (window.__DEBUG__) console.log('[KeyboardShortcuts] Initialized — 30+ shortcuts active');
  },

  _handleKeydown(e) {
    if (!this._enabled) return;
    const target = e.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    const isMeta = e.ctrlKey || e.metaKey;
    const isAlt = e.altKey;
    const isShift = e.shiftKey;
    const isOverlayOpen = document.querySelector('.overlay:not(.hidden)');
    const isChatInput = target.id === 'msg-input';

    /* ── Escape: Close overlays/modals/popovers ──────────── */
    if (e.key === 'Escape') {
      if (window._CC && window._CC.state === window._CC.STATES.ACTIVE) {
        e.preventDefault();
        if (window._CC.callType === 'video') window._CC.minimizeCall();
        else window.endCall();
        return;
      }
      if (window._CC && window._CC.state === window._CC.STATES.RINGING) {
        e.preventDefault();
        if (typeof window.declineCall === 'function') window.declineCall();
        return;
      }
      // Priority order: fullscreen > picture-in-picture > overlays > emoji > attach > format > search > detail panel
      if (typeof document.fullscreenElement !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        e.preventDefault();
        return;
      }
      if (document.pictureInPictureElement) {
        document.pictureInPictureElement.exitPictureInPicture().catch(() => {});
        e.preventDefault();
        return;
      }
      if (window.App?.emojiPickerOpen) { if (typeof toggleEmojiPicker === 'function') toggleEmojiPicker(); e.preventDefault(); return; }
      if (window.App?.attachMenuOpen) { if (typeof toggleAttachMenu === 'function') toggleAttachMenu(); e.preventDefault(); return; }
      if (window.App?.formatBarOpen) { if (typeof hideFormatBar === 'function') hideFormatBar(); e.preventDefault(); return; }
      // Close detail panel
      const detailPanel = document.getElementById('detail-panel');
      if (detailPanel && !detailPanel.classList.contains('hidden') && window.innerWidth >= 1024) {
        detailPanel.classList.add('hidden');
        e.preventDefault();
        return;
      }
      if (!isInput && typeof clearSidebarSearch === 'function') {
        const searchInput = document.getElementById('sidebar-search');
        if (searchInput && searchInput.value) { clearSidebarSearch(); e.preventDefault(); return; }
      }
      // Close keyboard help panel
      const kbPanel = document.getElementById('keyboard-help-panel');
      if (kbPanel && kbPanel.style.display !== 'none') {
        kbPanel.classList.add('hidden');
        kbPanel.style.display = 'none';
        e.preventDefault();
        return;
      }
      // Close context menu
      const ctxMenu = document.getElementById('desktop-context-menu');
      if (ctxMenu && ctxMenu.classList.contains('visible')) {
        ctxMenu.classList.remove('visible');
        e.preventDefault();
        return;
      }
      return;
    }

    /* ── F1: Show keyboard shortcuts help ────────────────── */
    if (e.key === 'F1') {
      e.preventDefault();
      this._showHelp();
      return;
    }

    /* ── F5: Refresh chat ────────────────────────────────── */
    if (e.key === 'F5' && !isMeta && !isShift) {
      // Let default browser refresh happen, but also reload chats
      if (typeof loadChats === 'function') setTimeout(() => loadChats(), 100);
      return;
    }

    /* ── F11: Toggle fullscreen ──────────────────────────── */
    if (e.key === 'F11') {
      e.preventDefault();
      if (window.NSLDesktop?.toggleFullscreen) {
        window.NSLDesktop.toggleFullscreen();
      }
      return;
    }

    /* ── F2: Rename / edit selected message ──────────────── */
    if (e.key === 'F2' && !isInput && this._selectedMsgId) {
      e.preventDefault();
      const editBtn = document.querySelector(`[data-msg-id="${this._selectedMsgId}"] .edit-msg-btn`);
      if (editBtn) editBtn.click();
      return;
    }

    /* ── Delete / Backspace: Delete or back ──────────────── */
    if (e.key === 'Delete' && !isInput && !isMeta && !isOverlayOpen) {
      if (this._selectedMsgId) {
        e.preventDefault();
        const deleteBtn = document.querySelector(`[data-msg-id="${this._selectedMsgId}"] .delete-msg-btn`);
        if (deleteBtn) deleteBtn.click();
      }
      return;
    }

    /* ── Space: Play/pause media ─────────────────────────── */
    if (e.key === ' ' && !isInput && !isMeta && !isOverlayOpen) {
      const video = document.querySelector('#media-viewer video, #video-player-wrap video');
      if (video) {
        e.preventDefault();
        video.paused ? video.play() : video.pause();
        return;
      }
      const audio = document.querySelector('.voice-msg-playing, audio:not([paused])');
      if (audio) {
        e.preventDefault();
        audio.pause();
        return;
      }
    }

    /* ── Home / End: Jump to top/bottom of chat ──────────── */
    if (e.key === 'Home' && !isInput && !isMeta && !isOverlayOpen) {
      const msgContainer = document.getElementById('messages-wrap');
      if (msgContainer) {
        e.preventDefault();
        msgContainer.scrollTop = 0;
        return;
      }
    }
    if (e.key === 'End' && !isInput && !isMeta && !isOverlayOpen) {
      const msgContainer = document.getElementById('messages-wrap');
      if (msgContainer) {
        e.preventDefault();
        msgContainer.scrollTop = msgContainer.scrollHeight;
        return;
      }
    }

    /* ── PageUp / PageDown: Scroll chat in larger increments ─ */
    if (e.key === 'PageUp' && !isInput && !isMeta && !isOverlayOpen) {
      const msgContainer = document.getElementById('messages-wrap');
      if (msgContainer) {
        e.preventDefault();
        msgContainer.scrollTop -= msgContainer.clientHeight * 0.8;
        return;
      }
    }
    if (e.key === 'PageDown' && !isInput && !isMeta && !isOverlayOpen) {
      const msgContainer = document.getElementById('messages-wrap');
      if (msgContainer) {
        e.preventDefault();
        msgContainer.scrollTop += msgContainer.clientHeight * 0.8;
        return;
      }
    }

    /* ── Ctrl+Z: Undo (in message input) ─────────────────── */
    if (isMeta && !isShift && e.key === 'z' && isChatInput) {
      // Let browser handle native undo in contenteditable
      return;
    }

    /* ── Ctrl+Y / Ctrl+Shift+Z: Redo ─────────────────────── */
    if ((isMeta && e.key === 'y') || (isMeta && isShift && e.key === 'z')) {
      return; // Let browser handle native redo
    }

    /* ── Ctrl+B: Bold ────────────────────────────────────── */
    if (isMeta && e.key === 'b' && isChatInput) {
      e.preventDefault();
      if (typeof toggleBold === 'function') toggleBold();
      else document.execCommand('bold');
      return;
    }

    /* ── Ctrl+I: Italic ──────────────────────────────────── */
    if (isMeta && e.key === 'i' && isChatInput) {
      e.preventDefault();
      if (typeof toggleItalic === 'function') toggleItalic();
      else document.execCommand('italic');
      return;
    }

    /* ── Ctrl+U: Underline ────────────────────────────────── */
    if (isMeta && e.key === 'u' && isChatInput) {
      e.preventDefault();
      if (typeof toggleUnderline === 'function') toggleUnderline();
      else document.execCommand('underline');
      return;
    }

    /* ── Ctrl+K: Insert link ──────────────────────────────── */
    if (isMeta && e.key === 'k' && isChatInput) {
      e.preventDefault();
      if (typeof insertLink === 'function') insertLink();
      return;
    }

    /* ── Ctrl+E: Toggle emoji picker ──────────────────────── */
    if (isMeta && e.key === 'e' && !isShift) {
      e.preventDefault();
      if (typeof toggleEmojiPicker === 'function') toggleEmojiPicker();
      return;
    }

    /* ── Ctrl+Shift+E: Toggle attachment menu ─────────────── */
    if (isMeta && isShift && e.key === 'E') {
      e.preventDefault();
      if (typeof toggleAttachMenu === 'function') toggleAttachMenu();
      return;
    }

    /* ── Ctrl+Enter: Send message ─────────────────────────── */
    if (isMeta && e.key === 'Enter' && isChatInput) {
      e.preventDefault();
      const sendBtn = document.getElementById('send-btn');
      if (sendBtn) sendBtn.click();
      return;
    }

    /* ── Enter in chat input: Send (Shift+Enter for newline) ── */
    if (e.key === 'Enter' && !isShift && isChatInput) {
      // Default behavior — let the app's own handler process it
      return;
    }

    /* ── Ctrl+Shift+F / Cmd+Shift+F: Search messages ─────── */
    if (isMeta && isShift && e.key === 'F') {
      e.preventDefault();
      if (typeof openChatSearch === 'function') openChatSearch();
      return;
    }

    /* ── Ctrl+F: Search within current chat ────────────────── */
    if (isMeta && e.key === 'f' && !isShift) {
      e.preventDefault();
      if (typeof openChatSearch === 'function') openChatSearch();
      else if (typeof toggleSidebarSearch === 'function') toggleSidebarSearch();
      return;
    }

    /* ── Ctrl+Shift+N: New chat ────────────────────────────── */
    if (isMeta && isShift && e.key === 'N') {
      e.preventDefault();
      if (typeof openNewChat === 'function') openNewChat();
      return;
    }

    /* ── Ctrl+N: New group ─────────────────────────────────── */
    if (isMeta && e.key === 'n' && !isShift) {
      e.preventDefault();
      if (typeof openNewGroup === 'function') openNewGroup();
      return;
    }

    /* ── Ctrl+,: Open settings ─────────────────────────────── */
    if (isMeta && e.key === ',') {
      e.preventDefault();
      if (typeof openSettings === 'function') openSettings();
      else if (typeof openNotificationSettings === 'function') openNotificationSettings();
      return;
    }

    /* ── Ctrl+.: Toggle theme ──────────────────────────────── */
    if (isMeta && e.key === '.') {
      e.preventDefault();
      if (typeof toggleTheme === 'function') toggleTheme();
      else if (document.body.classList.contains('dark')) {
        document.body.classList.remove('dark');
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('themeMode', 'light');
      } else {
        document.body.classList.add('dark');
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        localStorage.setItem('themeMode', 'dark');
      }
      return;
    }

    /* ── Ctrl+/: Show shortcuts (same as ?) ────────────────── */
    if (isMeta && e.key === '/') {
      e.preventDefault();
      this._showHelp();
      return;
    }

    /* ── Ctrl+L: Clear input ───────────────────────────────── */
    if (isMeta && e.key === 'l' && isChatInput) {
      e.preventDefault();
      target.textContent = '';
      target.innerHTML = '';
      return;
    }

    /* ── Ctrl+P: Print chat ─────────────────────────────────── */
    if (isMeta && e.key === 'p' && !isInput) {
      e.preventDefault();
      window.print();
      return;
    }

    /* ── Ctrl+A: Select all messages ────────────────────────── */
    if (isMeta && e.key === 'a' && !isInput && !isOverlayOpen) {
      const msgs = document.querySelectorAll('.message.selected');
      if (msgs.length === 0) {
        // Select all visible messages
        const allMsgs = document.querySelectorAll('.message[data-msg-id]');
        allMsgs.forEach(m => m.classList.add('selected'));
        return;
      }
    }

    /* ── Ctrl+C: Copy selected messages ─────────────────────── */
    if (isMeta && e.key === 'c' && !isInput && !window.getSelection()?.toString()) {
      const selected = document.querySelectorAll('.message.selected .msg-text, .message.selected .msg-bubble');
      if (selected.length > 0) {
        const text = Array.from(selected).map(el => el.textContent).join('\n');
        navigator.clipboard?.writeText(text).then(() => {
          if (typeof showToast === 'function') showToast('Messages copied', 'success');
        });
        e.preventDefault();
        return;
      }
    }

    /* ── Ctrl+Shift+C: Copy chat link ──────────────────────── */
    if (isMeta && isShift && e.key === 'C') {
      e.preventDefault();
      if (typeof copyChatLink === 'function') copyChatLink();
      return;
    }

    /* ── Ctrl+Shift+M: Mute/unmute chat ────────────────────── */
    if (isMeta && isShift && e.key === 'M') {
      e.preventDefault();
      if (typeof App !== 'undefined' && App.currentChat?.id) {
        if (App._mutedChats?.has(App.currentChat.id)) { if (typeof toggleMuteChat === 'function') toggleMuteChat(App.currentChat.id); }
        else { if (typeof showMuteChatOptions === 'function') showMuteChatOptions(App.currentChat.id); }
      }
      return;
    }

    /* ── Ctrl+Shift+P: Pin/unpin chat ──────────────────────── */
    if (isMeta && isShift && e.key === 'P') {
      e.preventDefault();
      if (typeof togglePinChat === 'function') togglePinChat();
      return;
    }

    /* ── Ctrl+Shift+A: Archive chat ────────────────────────── */
    if (isMeta && isShift && e.key === 'A') {
      e.preventDefault();
      if (typeof archiveChat === 'function') archiveChat();
      return;
    }

    /* ── Ctrl+Shift+D: Delete chat ─────────────────────────── */
    if (isMeta && isShift && e.key === 'D') {
      e.preventDefault();
      if (typeof deleteChat === 'function') deleteChat();
      return;
    }

    /* ── Ctrl+Shift+S: Star/unstar chat ────────────────────── */
    if (isMeta && isShift && e.key === 'S') {
      e.preventDefault();
      if (typeof toggleStarChat === 'function') toggleStarChat();
      return;
    }

    /* ── Ctrl+Shift+L: Toggle dark/light mode ──────────────── */
    if (isMeta && isShift && e.key === 'L') {
      e.preventDefault();
      if (typeof toggleTheme === 'function') toggleTheme();
      return;
    }

    /* ── Ctrl+Shift+R: Record voice message ────────────────── */
    if (isMeta && isShift && e.key === 'R') {
      e.preventDefault();
      if (typeof startVoiceRecording === 'function') startVoiceRecording();
      return;
    }

    /* ── Ctrl+Backspace: Clear selected messages ────────────── */
    if (isMeta && e.key === 'Backspace' && !isInput) {
      e.preventDefault();
      const selected = document.querySelectorAll('.message.selected');
      selected.forEach(m => m.classList.remove('selected'));
      return;
    }

    /* ── Ctrl+Shift+Backspace: Clear chat ──────────────────── */
    if (isMeta && isShift && e.key === 'Backspace') {
      e.preventDefault();
      if (typeof clearChatHistory === 'function') clearChatHistory();
      return;
    }

    /* ── Ctrl+Shift+Delete: Delete account (confirm) ────────── */
    if (isMeta && isShift && e.key === 'Delete') {
      e.preventDefault();
      if (typeof deleteAccount === 'function') deleteAccount();
      return;
    }

    /* ── Ctrl+Shift+I: Dev tools ───────────────────────────── */
    if (isMeta && isShift && e.key === 'I') {
      // Don't prevent — let browser open dev tools
      return;
    }

    /* ── Ctrl+R / F5: Refresh ──────────────────────────────── */
    if ((isMeta && e.key === 'r') || e.key === 'F5') {
      if (typeof loadChats === 'function') setTimeout(() => loadChats(), 100);
      return;
    }

    /* ── Number keys: switch tabs (no modifiers, not input) ─── */
    if (!isInput && !isMeta && !isAlt && !isShift && !isOverlayOpen) {
      const tabMap = { '1': 'chats', '2': 'groups', '3': 'calls', '4': 'saved' };
      if (tabMap[e.key] && typeof switchTab === 'function') {
        e.preventDefault();
        switchTab(tabMap[e.key]);
        return;
      }
    }

    /* ── Alt+1-9: Switch to nth chat ───────────────────────── */
    if (isAlt && !isMeta && !isOverlayOpen) {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        const chatItems = document.querySelectorAll('#chat-list .chat-list-item, #chat-list [role="listitem"]');
        if (chatItems[num - 1]) {
          chatItems[num - 1].click();
          chatItems[num - 1].focus();
        }
        return;
      }
    }

    /* ── Ctrl+Shift+1-9: Move chat to folder N ─────────────── */
    if (isMeta && isShift && !isInput) {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        if (typeof moveToFolder === 'function') moveToFolder(num);
        return;
      }
    }

    /* ── Arrow keys in chat list ────────────────────────────── */
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
      chatItems[idx]?.scrollIntoView({ block: 'nearest' });
      e.preventDefault();
      return;
    }

    /* ── Arrow keys in message list: select messages ────────── */
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !isInput && !isOverlayOpen) {
      const msgEls = document.querySelectorAll('.message[data-msg-id]');
      if (msgEls.length === 0) return;
      if (e.key === 'ArrowRight' && this._selectedMsgId) {
        const current = document.querySelector(`[data-msg-id="${this._selectedMsgId}"]`);
        if (current) {
          const next = current.nextElementSibling;
          if (next && next.dataset.msgId) {
            this._selectMessage(next.dataset.msgId);
            e.preventDefault();
          }
        }
        return;
      }
      if (e.key === 'ArrowLeft' && this._selectedMsgId) {
        const current = document.querySelector(`[data-msg-id="${this._selectedMsgId}"]`);
        if (current) {
          const prev = current.previousElementSibling;
          if (prev && prev.dataset.msgId) {
            this._selectMessage(prev.dataset.msgId);
            e.preventDefault();
          }
        }
        return;
      }
    }

    /* ── Enter in search input: trigger search ──────────────── */
    if (e.key === 'Enter' && !e.shiftKey && target.id === 'sidebar-search') {
      if (typeof triggerSidebarSearch === 'function') {
        e.preventDefault();
        triggerSidebarSearch();
      }
    }

    /* ── Backspace in empty input: Go back (mobile) ─────────── */
    if (e.key === 'Backspace' && isInput && target.id === 'msg-input' && !target.value.trim()) {
      if (window.innerWidth < 768 && typeof backToList === 'function') {
        backToList();
      }
    }

    /* ── Call shortcuts (only when a call is active) ─────────── */
    if (window._CC && (window._CC.state === window._CC.STATES.ACTIVE || window._CC.state === window._CC.STATES.CONNECTING) && !isInput && !isMeta) {
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); if (typeof window.toggleMute === 'function') window.toggleMute(); return; }
      if (e.key === 'v' || e.key === 'V') { e.preventDefault(); if (typeof window.toggleCamera === 'function') window.toggleCamera(); return; }
    }
    if (window._CC && window._CC.state === window._CC.STATES.RINGING && !isInput) {
      if (e.key === 'Enter') { e.preventDefault(); if (typeof window.acceptCall === 'function') window.acceptCall(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); if (typeof window.declineCall === 'function') window.declineCall(); return; }
    }

    /* ── ? key: Show keyboard shortcuts help ────────────────── */
    if (e.key === '?' && !isInput && !isMeta && !isOverlayOpen) {
      e.preventDefault();
      this._showHelp();
    }

    /* ── / key: Focus search (like Slack) ───────────────────── */
    if (e.key === '/' && !isInput && !isMeta && !isOverlayOpen) {
      e.preventDefault();
      const searchInput = document.getElementById('sidebar-search');
      if (searchInput) searchInput.focus();
      return;
    }

    /* ── J/K: Navigate messages (like Vim/Slack) ────────────── */
    if (e.key === 'j' && !isInput && !isMeta && !isOverlayOpen) {
      const msgEls = document.querySelectorAll('.message[data-msg-id]');
      if (msgEls.length === 0) return;
      if (!this._selectedMsgId) {
        this._selectMessage(msgEls[msgEls.length - 1].dataset.msgId);
      } else {
        const current = document.querySelector(`[data-msg-id="${this._selectedMsgId}"]`);
        if (current?.nextElementSibling?.dataset.msgId) {
          this._selectMessage(current.nextElementSibling.dataset.msgId);
        }
      }
      e.preventDefault();
      return;
    }
    if (e.key === 'k' && !isInput && !isMeta && !isOverlayOpen) {
      const msgEls = document.querySelectorAll('.message[data-msg-id]');
      if (msgEls.length === 0) return;
      if (!this._selectedMsgId) {
        this._selectMessage(msgEls[0].dataset.msgId);
      } else {
        const current = document.querySelector(`[data-msg-id="${this._selectedMsgId}"]`);
        if (current?.previousElementSibling?.dataset.msgId) {
          this._selectMessage(current.previousElementSibling.dataset.msgId);
        }
      }
      e.preventDefault();
      return;
    }
  },

  _selectMessage(msgId) {
    // Deselect previous
    document.querySelectorAll('.message.selected').forEach(m => m.classList.remove('selected'));
    this._selectedMsgId = msgId;
    const el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (el) {
      el.classList.add('selected');
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  },

  _showHelp() {
    const panel = document.getElementById('keyboard-help-panel');
    if (panel) {
      const isHidden = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', !isHidden);
      panel.style.display = isHidden ? 'flex' : 'none';
      return;
    }
    // Build panel if it doesn't exist
    this._buildHelpPanel();
    const newPanel = document.getElementById('keyboard-help-panel');
    if (newPanel) {
      newPanel.classList.remove('hidden');
      newPanel.style.display = 'flex';
    }
  },

  _buildHelpPanel() {
    if (document.getElementById('keyboard-help-panel')) return;

    const shortcuts = [
      { group: 'Navigation', items: [
        ['↑/↓', 'Navigate chat list'],
        ['←/→', 'Navigate messages'],
        ['J/K', 'Next/prev message (Vim)'],
        ['Alt+1-9', 'Switch to chat #N'],
        ['1/2/3/4', 'Switch tabs (Chats/Groups/Calls/Saved)'],
        ['Home/End', 'Top/bottom of chat'],
        ['PageUp/PageDown', 'Scroll chat'],
        ['/', 'Focus search'],
      ]},
      { group: 'Messaging', items: [
        ['Ctrl+Enter', 'Send message'],
        ['Ctrl+E', 'Toggle emoji picker'],
        ['Ctrl+Shift+E', 'Toggle attachments'],
        ['Ctrl+B', 'Bold text'],
        ['Ctrl+I', 'Italic text'],
        ['Ctrl+U', 'Underline text'],
        ['Ctrl+K', 'Insert link'],
        ['Ctrl+L', 'Clear input'],
        ['Ctrl+Shift+R', 'Record voice message'],
      ]},
      { group: 'Chat Management', items: [
        ['Ctrl+Shift+N', 'New chat'],
        ['Ctrl+N', 'New group'],
        ['Ctrl+Shift+F', 'Search messages'],
        ['Ctrl+Shift+M', 'Mute/unmute'],
        ['Ctrl+Shift+P', 'Pin/unpin'],
        ['Ctrl+Shift+A', 'Archive'],
        ['Ctrl+Shift+D', 'Delete chat'],
        ['Ctrl+Shift+S', 'Star/unstar'],
      ]},
      { group: 'Actions', items: [
        ['F11', 'Toggle fullscreen'],
        ['F2', 'Edit selected message'],
        ['Delete', 'Delete selected message'],
        ['Space', 'Play/pause media'],
        ['Ctrl+A', 'Select all messages'],
        ['Ctrl+C', 'Copy selected messages'],
        ['Ctrl+P', 'Print chat'],
        ['Ctrl+.', 'Toggle dark/light mode'],
      ]},
      { group: 'General', items: [
        ['Escape', 'Close overlay/panel'],
        ['?', 'Show this help'],
        ['Ctrl+Shift+L', 'Toggle dark mode'],
        ['Ctrl+,', 'Settings'],
        ['F5', 'Refresh'],
      ]},
    ];

    let html = `<style>
      #keyboard-help-panel-content {
        background: var(--surface-container, #1f2c34);
        border-radius: 12px;
        max-width: 720px;
        width: 95%;
        max-height: 85vh;
        overflow-y: auto;
        padding: 24px;
        color: var(--on-surface, #e9edef);
      }
      @media (max-width: 768px) {
        #keyboard-help-panel-content {
          width: 100% !important;
          height: 100% !important;
          max-height: 100vh !important;
          border-radius: 0px !important;
          padding: 20px !important;
        }
      }
    </style>
    <div class="overlay hidden" id="keyboard-help-panel" role="dialog" aria-label="Keyboard Shortcuts" style="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:none;align-items:center;justify-content:center;">
      <div id="keyboard-help-panel-content">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="margin:0;font-size:20px;font-weight:600;">Keyboard Shortcuts</h2>
          <button id="kb-help-close" style="background:none;border:none;color:var(--on-surface, #e9edef);font-size:24px;cursor:pointer;padding:4px 8px;" aria-label="Close">&#10005;</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;">`;

    for (var g = 0; g < shortcuts.length; g++) {
      html += '<div><h3 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;color:var(--on-surface-variant, #8696a0);">' + shortcuts[g].group + '</h3>';
      for (var k = 0; k < shortcuts[g].items.length; k++) {
        var item = shortcuts[g].items[k];
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">' +
          '<span style="font-size:13px;color:var(--on-surface, #e9edef);margin-right:8px;word-break:break-word;">' + item[1].replace(/</g, '&lt;') + '</span>' +
          '<kbd style="background:var(--surface-container-high, #2a3942);padding:2px 8px;border-radius:4px;font-size:11px;font-family:monospace;color:var(--on-surface-variant, #8696a0);border:1px solid var(--outline-variant, #313d45);flex-shrink:0;white-space:nowrap;">' + item[0].replace(/</g, '&lt;') + '</kbd>' +
          '</div>';
      }
      html += '</div>';
    }

    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    var closeBtn = document.getElementById('kb-help-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        var panel = document.getElementById('keyboard-help-panel');
        if (panel) {
          panel.classList.add('hidden');
          panel.style.display = 'none';
        }
      });
    }
    // Close on backdrop click
    var panelEl = document.getElementById('keyboard-help-panel');
    if (panelEl) {
      panelEl.addEventListener('click', function (ev) {
        if (ev.target === panelEl) {
          panelEl.classList.add('hidden');
          panelEl.style.display = 'none';
        }
      });
    }
  },

  showHelp() {
    this._showHelp();
  },

  enable() { this._enabled = true; },
  disable() { this._enabled = false; },
  destroy() {
    this._enabled = false;
    if (this._keydownBound) {
      document.removeEventListener('keydown', this._keydownBound);
      this._keydownBound = null;
    }
    var panel = document.getElementById('keyboard-help-panel');
    if (panel) panel.remove();
  }
};

window.KeyboardShortcuts = KeyboardShortcuts;
