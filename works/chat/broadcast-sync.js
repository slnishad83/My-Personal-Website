'use strict';
(function() {
  if (!('BroadcastChannel' in window)) return;
  var channel = new BroadcastChannel('nsl-chat-sync');
  var _lastResync = 0;
  function _validOrigin() {
    try {
      return window.location.origin === 'https://nishadsl.com' ||
             window.location.origin === 'https://web.nishadsl.com' ||
             window.location.origin === 'http://localhost:5173' ||
             window.location.origin === 'http://localhost:3000';
    } catch(_) { return true; }
  }

  channel.onmessage = function(e) {
    if (!e.data || !e.data.type) return;
    if (!_validOrigin()) return;
    switch (e.data.type) {
      case 'new-message':
      case 'chat-update':
        if (Date.now() - _lastResync > 30000) {
          _lastResync = Date.now();
          if (typeof subscribeToChats === 'function') subscribeToChats();
          if (typeof subscribeToGroups === 'function') subscribeToGroups();
        }
        break;
      case 'message-deleted':
      case 'chat-deleted':
        if (typeof subscribeToChats === 'function') subscribeToChats();
        if (App && App.currentChat && App.currentChat.id && typeof renderMessages === 'function') {
          renderMessages(App.currentChat.id);
        }
        break;
      case 'message-read':
        if (App && App.currentChat && App.currentChat.id && typeof renderMessages === 'function') {
          renderMessages(App.currentChat.id);
        }
        break;
      case 'typing':
        if (e.data.chatId && e.data.userId && e.data.userId !== (App && App.currentUser && App.currentUser.uid)) {
          if (typeof showTypingIndicator === 'function') showTypingIndicator(e.data.userId, e.data.chatId);
        }
        break;
      case 'theme-change':
        if (typeof e.data.dark === 'boolean') {
          document.documentElement.classList.toggle('dark', e.data.dark);
          localStorage.setItem('themeMode', e.data.dark ? 'dark' : 'light');
        }
        break;
      case 'logout':
        window.location.reload();
        break;
      case 'focus-chat':
        if (e.data.chatId && typeof openChat === 'function') {
          openChat(e.data.chatId, e.data.chatType || 'direct');
        }
        break;
    }
  };
  window.NSLBroadcastChannel = channel;
  window.broadcastToTabs = function(type, data) {
    try { channel.postMessage(Object.assign({ type: type }, data || {})); } catch (_) {}
  };
  var origToggle = window.toggleTheme;
  window.toggleTheme = function() {
    if (origToggle) origToggle();
    var isDark = document.documentElement.classList.contains('dark');
    channel.postMessage({ type: 'theme-change', dark: isDark });
  };
})();
