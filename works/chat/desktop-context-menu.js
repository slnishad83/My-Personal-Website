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
      btn.innerHTML = `<span>${item.icon || ''}</span><span>${item.label}</span>`;
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
    const items = [
      { icon: '↩', label: 'Reply', shortcut: '', action: () => { if (typeof replyToMessage === 'function') replyToMessage(msgId); } },
      { icon: '⟳', label: 'Forward', action: () => { if (typeof forwardMessage === 'function') forwardMessage(msgId); } },
      { icon: '📋', label: 'Copy', shortcut: 'Ctrl+C', action: () => {
        const text = msgEl?.querySelector('.msg-text, .message-bubble')?.textContent;
        if (text) navigator.clipboard?.writeText(text);
      }},
      { icon: '📌', label: 'Star', action: () => { if (typeof starMessage === 'function') starMessage(msgId); } },
      { separator: true },
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
      { icon: '🔇', label: isMuted ? 'Unmute' : 'Mute', action: () => { if (typeof toggleMuteChat === 'function') toggleMuteChat(chatId); } },
      { icon: '📁', label: 'Archive', shortcut: 'Ctrl+Shift+A', action: () => { if (typeof archiveChat === 'function') archiveChat(chatId); } },
      { separator: true },
      { icon: '👤', label: 'View contact', action: () => { if (typeof viewContact === 'function') viewContact(chatId); } },
      { icon: '🔍', label: 'Search', shortcut: 'Ctrl+Shift+F', action: () => { if (typeof openChatSearch === 'function') openChatSearch(); } },
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
    // Keyboard: Escape hides context menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _visible) hide();
    });
  }

  window.NSLContextMenu = { show, hide, isVisible, showMsgContextMenu, showChatContextMenu, showMediaContextMenu };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
