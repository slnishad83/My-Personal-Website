/* ============================================================
   Desktop Context Menu (D-H14 / D-L11)
   Right-click context menu for messages, chat list, and media.
   ============================================================ */
(function () {
  'use strict';

  let _menu = null;
  let _visible = false;

  function createMenu() {
    if (_menu) return _menu;
    _menu = document.createElement('div');
    _menu.id = 'desktop-context-menu';
    _menu.setAttribute('role', 'menu');
    _menu.setAttribute('aria-label', 'Context menu');
    _menu.setAttribute('aria-roledescription', 'context menu');
    _menu.style.display = 'none';
    document.body.appendChild(_menu);
    // Close on click outside
    document.addEventListener('click', () => hide());
    document.addEventListener('contextmenu', (e) => {
      // Only hide if clicking outside the menu
      if (_menu && !_menu.contains(e.target)) hide();
    });
    return _menu;
  }

  function show(x, y, items) {
    const menu = createMenu();
    menu.innerHTML = '';
    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'ctx-separator';
        menu.appendChild(sep);
        continue;
      }
      const btn = document.createElement('button');
      btn.setAttribute('role', 'menuitem');
      const iconSpan = document.createElement('span');
      iconSpan.textContent = item.icon || '';
      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;
      btn.appendChild(iconSpan);
      btn.appendChild(labelSpan);
      if (item.shortcut) {
        btn.innerHTML += `<span class="ctx-shortcut">${item.shortcut}</span>`;
      }
      if (item.danger) btn.classList.add('danger');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        hide();
        if (item.action) item.action();
      });
      menu.appendChild(btn);
    }
    // Position menu
    menu.style.display = 'block';
    _visible = true;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let posX = x;
    let posY = y;
    if (x + rect.width > vw) posX = vw - rect.width - 8;
    if (y + rect.height > vh) posY = vh - rect.height - 8;
    if (posX < 0) posX = 8;
    if (posY < 0) posY = 8;
    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';
    menu.classList.add('visible');
    // Focus first item
    const firstBtn = menu.querySelector('button');
    if (firstBtn) firstBtn.focus();
  }

  function hide() {
    if (_menu) {
      _menu.classList.remove('visible');
      _menu.style.display = 'none';
      _visible = false;
    }
  }

  function isVisible() { return _visible; }

  /* --- Message context menu --- */
  function showMsgContextMenu(e, msgEl) {
    e.preventDefault();
    e.stopPropagation();
    const msgId = msgEl?.dataset?.msgId;
    const isMyMsg = msgEl?.classList?.contains('my-message');
    const chatId = App?.currentChat?.id || '';
    const isGroup = App?.currentChat?.isGroup || false;
    const items = [
      { icon: '↩', label: 'Reply', shortcut: '', action: () => { if (typeof replyToMessage === 'function') replyToMessage(msgId); } },
      { icon: '💬', label: 'Reply Privately', action: () => {
        if (isGroup && typeof window.ReplyPrivate !== 'undefined') {
          const msgs = (typeof App !== 'undefined' && App.messages && App.currentChat) ? (App.messages[App.currentChat.id] || []) : [];
          const targetMsg = msgs.find(m => m.id === msgId);
          if (targetMsg) window.ReplyPrivate.replyPrivately(targetMsg, App.currentChat.id);
        } else if (typeof replyToMessage === 'function') {
          replyToMessage(msgId);
        }
      }},
      { icon: '🌐', label: 'Translate', action: () => { if (typeof showTranslationPopup === 'function') showTranslationPopup(msgId); } },
      { icon: '⟳', label: 'Forward', action: () => { if (typeof openForwardModal === 'function') openForwardModal(msgId); } },
      { icon: '📋', label: 'Copy', shortcut: 'Ctrl+C', action: () => {
        const text = msgEl?.querySelector('.msg-text, .message-bubble')?.textContent;
        if (text) navigator.clipboard?.writeText(text);
      }},
      { icon: '📌', label: 'Star', action: () => { if (typeof starMessage === 'function') starMessage(msgId); } },
      { icon: '📍', label: 'Pin', action: () => { if (typeof pinMessage === 'function') pinMessage(msgId); else if (typeof starMessage === 'function') starMessage(msgId); } },
      { separator: true },
      { icon: '☑', label: 'Select', action: () => {
        if (typeof toggleChatSelectionMode === 'function') toggleChatSelectionMode();
        else if (typeof showToast === 'function') showToast('Selection mode', 'info');
      } },
      { icon: 'ℹ', label: 'Info', action: () => { if (typeof showMessageInfo === 'function') showMessageInfo(msgId); } },
      ...(isMyMsg ? [
        { separator: true },
        { icon: '✏', label: 'Edit', shortcut: 'F2', action: () => { if (typeof editMessage === 'function') editMessage(msgId); } },
        { icon: '🗑', label: 'Delete', shortcut: 'Del', danger: true, action: () => { if (typeof deleteMessage === 'function') deleteMessage(msgId); } },
      ] : [
        { separator: true },
        { icon: '🗑', label: 'Delete', shortcut: 'Del', danger: true, action: () => { if (typeof deleteMessage === 'function') deleteMessage(msgId); } },
      ]),
    ];
    show(e.clientX, e.clientY, items);
  }

  /* --- Chat list context menu --- */
  function showChatContextMenu(e, chatEl) {
    e.preventDefault();
    e.stopPropagation();
    const chatId = chatEl?.dataset?.chatId || chatEl?.id;
    const isPinned = chatEl?.classList?.contains('pinned');
    const isMuted = chatEl?.classList?.contains('muted');
    const items = [
      { icon: '📌', label: isPinned ? 'Unpin' : 'Pin', action: () => { if (typeof togglePinChat === 'function') togglePinChat(chatId); } },
      { icon: '🔇', label: isMuted ? 'Unmute' : 'Mute', action: () => { if (isMuted) { if (typeof toggleMuteChat === 'function') toggleMuteChat(chatId); } else { if (typeof showMuteChatOptions === 'function') showMuteChatOptions(chatId); } } },
      { icon: '📁', label: 'Archive', shortcut: 'Ctrl+Shift+A', action: () => { if (typeof archiveChat === 'function') archiveChat(chatId); } },
      { icon: '🔒', label: (typeof isChatLocked === 'function' && isChatLocked(chatId)) ? 'Unlock Chat' : 'Lock Chat', action: () => { if (typeof toggleChatLock === 'function') toggleChatLock(chatId); } },
      { separator: true },
      { icon: '👤', label: 'View contact', action: () => { if (typeof viewContact === 'function') viewContact(chatId); } },
      { icon: '🔍', label: 'Search', shortcut: 'Ctrl+Shift+F', action: () => { if (typeof openChatSearch === 'function') openChatSearch('current'); else if (typeof window.messageSearch !== 'undefined') window.messageSearch.open(); } },
      { separator: true },
      { icon: '🗑', label: 'Delete chat', shortcut: 'Ctrl+Shift+D', danger: true, action: () => { if (typeof deleteChat === 'function') deleteChat(chatId); } },
    ];
    show(e.clientX, e.clientY, items);
  }

  /* --- Media context menu --- */
  function showMediaContextMenu(e, mediaEl) {
    e.preventDefault();
    e.stopPropagation();
    const src = mediaEl?.src || mediaEl?.querySelector('img, video')?.src;
    const items = [
      { icon: '🔍', label: 'Open in new tab', action: () => { if (src) window.open(src, '_blank'); } },
      { icon: '📋', label: 'Copy image URL', action: () => { if (src) navigator.clipboard?.writeText(src); } },
      { icon: '💾', label: 'Save as…', action: () => { if (src) { const a = document.createElement('a'); a.href = src; a.download = ''; a.click(); } } },
      { separator: true },
      { icon: '⛶', label: 'Fullscreen', shortcut: 'F11', action: () => { if (window.NSLDesktop?.toggleFullscreen) window.NSLDesktop.toggleFullscreen(); } },
    ];
    show(e.clientX, e.clientY, items);
  }

  /* --- Init: attach event listeners --- */
  function init() {
    // Message right-click
    document.addEventListener('contextmenu', (e) => {
      const msgEl = e.target.closest('.message[data-msg-id]');
      if (msgEl) { showMsgContextMenu(e, msgEl); return; }
      const chatEl = e.target.closest('.chat-list-item');
      if (chatEl) { showChatContextMenu(e, chatEl); return; }
      const mediaEl = e.target.closest('#media-viewer img, #media-viewer video, .bubble-media img, .bubble-media video');
      if (mediaEl) { showMediaContextMenu(e, mediaEl); return; }
    });
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!_visible) return;
      if (e.key === 'Escape') { hide(); return; }
      const buttons = [..._menu.querySelectorAll('button[role="menuitem"]')];
      const idx = buttons.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = idx < buttons.length - 1 ? idx + 1 : 0;
        buttons[next].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = idx > 0 ? idx - 1 : buttons.length - 1;
        buttons[prev].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        buttons[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        buttons[buttons.length - 1]?.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        document.activeElement?.click();
      }
    });
  }

  window.NSLContextMenu = { show, hide, isVisible, showMsgContextMenu, showChatContextMenu, showMediaContextMenu };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
