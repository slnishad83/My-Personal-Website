/* D-C5: Multi-window support via BroadcastChannel */
(function() {
  if (!('BroadcastChannel' in window)) return;
  const channel = new BroadcastChannel('nsl-chat-sync');
  channel.onmessage = function(e) {
    if (!e.data || !e.data.type) return;
    switch (e.data.type) {
      case 'new-message':
        if (e.data.chatId && typeof window.currentChat !== 'undefined' && e.data.chatId !== window.currentChat) {
          if (typeof showToast === 'function') showToast('New message in ' + (e.data.chatName || 'another chat'), 'info');
        }
        break;
      case 'call-incoming':
        if (typeof e.data.callId !== 'undefined') {
          if (typeof showIncomingCall === 'function') showIncomingCall(e.data.callId, e.data.callerName, e.data.callType);
        }
        break;
      case 'logout':
        window.location.reload();
        break;
      case 'theme-change':
        if (e.data.dark) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
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
    try { channel.postMessage({ type, ...data }); } catch (_) {}
  };
  const origToggle = window.toggleTheme;
  window.toggleTheme = function() {
    if (origToggle) origToggle();
    const isDark = document.documentElement.classList.contains('dark');
    channel.postMessage({ type: 'theme-change', dark: isDark });
  };
})();