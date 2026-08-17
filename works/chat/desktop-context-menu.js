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
      iconSpan.className = 'ctx-icon';
      if (item.icon && item.icon.includes('<')) {
        iconSpan.innerHTML = item.icon;
      } else {
        iconSpan.textContent = item.icon || '';
      }
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
    const isMyMsg = msgEl?.classList?.contains('msg-out') || msgEl?.classList?.contains('my-message');
    const _chatId = App?.currentChat?.id || '';
    const isGroup = App?.currentChat?.isGroup || false;
    const items = [
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">reply</span>', label: 'Reply', shortcut: '', action: () => { if (window._MsgActions && typeof window._MsgActions.reply === 'function') window._MsgActions.reply(msgId); else if (typeof replyToMessage === 'function') replyToMessage(msgId); } },
      ...(isGroup && !isMyMsg ? [
        { icon: '<span class="material-symbols-outlined" style="font-size:18px">forward</span>', label: 'Reply Privately', action: () => {
          const msgs = (typeof App !== 'undefined' && App.messages && App.currentChat) ? (App.messages[App.currentChat.id] || []) : [];
          const targetMsg = msgs.find(m => m.id === msgId);
          if (targetMsg && typeof window.ReplyPrivate !== 'undefined') {
            window.ReplyPrivate.replyPrivately(targetMsg, App.currentChat.id);
          } else if (typeof window._MsgActions === 'object' && window._MsgActions.replyPrivately) {
            window._MsgActions.replyPrivately(msgId);
          }
        }},
        { icon: '<span class="material-symbols-outlined" style="font-size:18px">chat</span>', label: 'Message ' + (msgEl?.dataset?.senderName || msgEl?.querySelector('.sender-name, .msg-sender')?.textContent?.trim() || 'user'), action: () => {
          const msgs = (typeof App !== 'undefined' && App.messages && App.currentChat) ? (App.messages[App.currentChat.id] || []) : [];
          const targetMsg = msgs.find(m => m.id === msgId);
          if (targetMsg && typeof window.ReplyPrivate !== 'undefined') {
            window.ReplyPrivate.messagePerson(targetMsg, App.currentChat.id);
          } else if (typeof window._MsgActions === 'object' && window._MsgActions.messagePerson) {
            window._MsgActions.messagePerson(msgId);
          }
        }},
      ] : []),
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">translate</span>', label: 'Translate', action: () => { if (typeof showTranslationPopup === 'function') showTranslationPopup(msgId); } },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">forward</span>', label: 'Forward', action: () => { if (typeof openForwardModal === 'function') openForwardModal(msgId); } },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">content_copy</span>', label: 'Copy', shortcut: 'Ctrl+C', action: () => {
        const text = msgEl?.querySelector('.msg-text, .message-bubble')?.textContent;
        if (text) navigator.clipboard?.writeText(text);
      }},
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">star</span>', label: 'Star', action: () => { if (typeof starMessage === 'function') starMessage(msgId); } },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">push_pin</span>', label: 'Pin', action: () => { if (typeof window._MsgActions === 'object' && window._MsgActions.pin) window._MsgActions.pin(msgId); else if (typeof pinMessage === 'function') pinMessage(msgId); } },
      { separator: true },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">check_box</span>', label: 'Select', action: () => {
        if (typeof toggleChatSelectionMode === 'function') toggleChatSelectionMode();
        else if (typeof showToast === 'function') showToast('Selection mode', 'info');
      } },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">info</span>', label: 'Info', action: () => {
        if (typeof window._MsgActions === 'object' && window._MsgActions.info) window._MsgActions.info(msgId);
        else if (typeof showMessageInfo === 'function') showMessageInfo(msgId);
        else if (typeof openMsgInfo === 'function') openMsgInfo(msgId);
      } },
      ...(isMyMsg ? [
        { separator: true },
        { icon: '<span class="material-symbols-outlined" style="font-size:18px">edit</span>', label: 'Edit', shortcut: 'F2', action: () => { if (typeof editMessage === 'function') editMessage(msgId); } },
        { icon: '<span class="material-symbols-outlined" style="font-size:18px">delete</span>', label: 'Delete', shortcut: 'Del', danger: true, action: () => { if (typeof deleteMessage === 'function') deleteMessage(msgId); } },
      ] : [
        { separator: true },
        { icon: '<span class="material-symbols-outlined" style="font-size:18px">delete</span>', label: 'Delete', shortcut: 'Del', danger: true, action: () => { if (typeof deleteMessage === 'function') deleteMessage(msgId); } },
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
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">push_pin</span>', label: isPinned ? 'Unpin' : 'Pin', action: () => { if (typeof togglePinChat === 'function') togglePinChat(chatId); } },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">' + (isMuted ? 'volume_up' : 'volume_off') + '</span>', label: isMuted ? 'Unmute' : 'Mute', action: () => { if (isMuted) { if (typeof toggleMuteChat === 'function') toggleMuteChat(chatId); } else { if (typeof showMuteChatOptions === 'function') showMuteChatOptions(chatId); } } },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">archive</span>', label: 'Archive', shortcut: 'Ctrl+Shift+A', action: () => { if (typeof archiveChat === 'function') archiveChat(chatId); } },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">lock</span>', label: (typeof isChatLocked === 'function' && isChatLocked(chatId)) ? 'Unlock Chat' : 'Lock Chat', action: () => { if (typeof toggleChatLock === 'function') toggleChatLock(chatId); } },
      { separator: true },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">person</span>', label: 'View contact', action: () => { if (typeof window.openChatInfo === 'function') window.openChatInfo(); else if (typeof viewContact === 'function') viewContact(chatId); } },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">search</span>', label: 'Search', shortcut: 'Ctrl+Shift+F', action: () => { if (typeof openChatSearch === 'function') openChatSearch('current'); else if (typeof window.messageSearch !== 'undefined') window.messageSearch.open(); } },
      { separator: true },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">delete</span>', label: 'Delete chat', shortcut: 'Ctrl+Shift+D', danger: true, action: () => { if (typeof deleteChat === 'function') deleteChat(chatId); } },
    ];
    show(e.clientX, e.clientY, items);
  }

  /* --- Media context menu --- */
  function showMediaContextMenu(e, mediaEl) {
    e.preventDefault();
    e.stopPropagation();
    const src = mediaEl?.src || mediaEl?.querySelector('img, video')?.src;
    const items = [
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">open_in_new</span>', label: 'Open in new tab', action: () => { if (src) window.open(src, '_blank'); } },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">content_copy</span>', label: 'Copy image URL', action: () => { if (src) navigator.clipboard?.writeText(src); } },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">download</span>', label: 'Save as�', action: () => { if (src) { const a = document.createElement('a'); a.href = src; a.download = ''; a.click(); } } },
      { separator: true },
      { icon: '<span class="material-symbols-outlined" style="font-size:18px">fullscreen</span>', label: 'Fullscreen', shortcut: 'F11', action: () => { if (window.NSLDesktop?.toggleFullscreen) window.NSLDesktop.toggleFullscreen(); } },
    ];
    show(e.clientX, e.clientY, items);
  }

  /* --- Init: attach event listeners --- */
  function init() {
    // Message right-click
    document.addEventListener('contextmenu', (e) => {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const msgEl = e.target.closest('.message-row[data-msg-id], .message[data-msg-id]');
      if (msgEl && !coarse) { showMsgContextMenu(e, msgEl); return; }
      if (msgEl) return; // touch: message-actions owns the message context menu
      if (coarse) return; // touch: keep native/overlay menus for chats & media
      const chatEl = e.target.closest('.chat-list-item, [data-chat-id]');
      if (chatEl) { showChatContextMenu(e, chatEl); return; }
      const mediaEl = e.target.closest('#media-viewer img, #media-viewer video, .bubble-media img, .bubble-media video');
      if (mediaEl) { showMediaContextMenu(e, mediaEl); return; }
      if (_visible) hide();
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
