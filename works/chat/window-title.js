/* ============================================================
   Window Title Manager (D-H13 / D-L4)
   Updates document.title with unread count and current chat.
   ============================================================ */
(function () {
  'use strict';

  const BASE_TITLE = 'NSL Chat';
  let _unreadCount = 0;
  let _currentChat = null;
  let _typingUsers = [];

  function formatTitle() {
    let title = BASE_TITLE;

    if (_currentChat) {
      const chatName = _currentChat.name || _currentChat.groupName || 'Chat';
      title = chatName + ' — ' + BASE_TITLE;
    }

    if (_unreadCount > 0) {
      const badge = _unreadCount > 99 ? '99+' : String(_unreadCount);
      title = `(${badge}) ${title}`;
    }

    return title;
  }

  function updateTitle() {
    document.title = formatTitle();
    updateFaviconBadge();
  }

  function setUnreadCount(count) {
    _unreadCount = typeof count === 'number' ? count : 0;
    updateTitle();
  }

  function incrementUnread() {
    _unreadCount++;
    updateTitle();
  }

  function clearUnread() {
    _unreadCount = 0;
    updateTitle();
  }

  function setCurrentChat(chatInfo) {
    _currentChat = chatInfo;
    updateTitle();
  }

  function setTyping(userName) {
    if (userName && !_typingUsers.includes(userName)) {
      _typingUsers.push(userName);
      document.title = `${userName} is typing… — ${BASE_TITLE}`;
    }
  }

  function clearTyping(userName) {
    _typingUsers = _typingUsers.filter(u => u !== userName);
    if (_typingUsers.length === 0) {
      updateTitle();
    } else {
      document.title = `${_typingUsers[0]} is typing… — ${BASE_TITLE}`;
    }
  }

  /* --- Favicon badge (D-L4) --- */
  let _originalFaviconHref = null;
  let _cachedCanvas = null;
  let _cachedCtx = null;
  let _cachedImg = null;
  let _pendingFavicon = false;

  function updateFaviconBadge() {
    const link = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    if (!link) return;

    if (!_originalFaviconHref) {
      _originalFaviconHref = link.href;
    }

    if (_unreadCount === 0) {
      link.href = _originalFaviconHref;
      return;
    }

    if (_pendingFavicon) return;
    _pendingFavicon = true;

    if (!_cachedCanvas) {
      _cachedCanvas = document.createElement('canvas');
      _cachedCanvas.width = 64;
      _cachedCanvas.height = 64;
      _cachedCtx = _cachedCanvas.getContext('2d');
      _cachedImg = new Image();
      _cachedImg.crossOrigin = 'anonymous';
    }

    _cachedImg.onload = function () {
      _pendingFavicon = false;
      _cachedCtx.clearRect(0, 0, 64, 64);
      _cachedCtx.drawImage(_cachedImg, 0, 0, 64, 64);

      _cachedCtx.beginPath();
      _cachedCtx.arc(48, 16, 14, 0, Math.PI * 2);
      _cachedCtx.fillStyle = '#FF3B30';
      _cachedCtx.fill();

      const badge = _unreadCount > 99 ? '99+' : String(_unreadCount);
      _cachedCtx.fillStyle = '#FFFFFF';
      _cachedCtx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
      _cachedCtx.textAlign = 'center';
      _cachedCtx.textBaseline = 'middle';
      _cachedCtx.fillText(badge, 48, 16);

      link.href = _cachedCanvas.toDataURL('image/png');
    };
    _cachedImg.onerror = function () { _pendingFavicon = false; };
    _cachedImg.src = _originalFaviconHref;
  }

  /* --- Visibility change: flash title on message --- */
  let _flashInterval = null;
  const FLASH_MESSAGES = ['💬 New message', '📩 New message', '💬 New', '📩 New'];

  function flashTitle(enable) {
    if (_flashInterval) {
      clearInterval(_flashInterval);
      _flashInterval = null;
    }
    if (!enable) {
      updateTitle();
      return;
    }
    let idx = 0;
    _flashInterval = setInterval(() => {
      document.title = FLASH_MESSAGES[idx % FLASH_MESSAGES.length];
      idx++;
    }, 1500);
  }

  /* --- Expose API --- */
  window.NSLWindowTitle = {
    setUnreadCount,
    incrementUnread,
    clearUnread,
    setCurrentChat,
    setTyping,
    clearTyping,
    flashTitle,
    updateTitle
  };

  // Auto-hook into incoming messages if config.js dispatches events
  document.addEventListener('nsl:new-message', () => {
    if (document.hidden) {
      incrementUnread();
      flashTitle(true);
    }
  });

  document.addEventListener('nsl:chat-opened', (e) => {
    const chat = e.detail || {};
    setCurrentChat(chat);
    if (document.hasFocus()) {
      clearUnread();
      flashTitle(false);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      flashTitle(false);
    }
  });

})();
