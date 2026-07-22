/* ============================================================
   DESKTOP NOTIFICATIONS — Native notification support for
   Electron-based desktop apps on Windows/macOS/Linux.
   Uses Electron's Notification API when available, falls
   back to Web Notifications API.
   ============================================================ */
'use strict';

const DesktopNotifications = (() => {
  let _isElectron = false;
  let _electronNotif = null;

  function init() {
    _isElectron = !!(window.process?.versions?.electron || window.electronAPI);

    if (_isElectron && window.require) {
      try {
        const { Notification } = window.require('electron');
        _electronNotif = Notification;
      } catch (_) {}
    }
  }

  function isSupported() {
    if (_electronNotif) return true;
    return 'Notification' in window;
  }

  function permission() {
    if (_electronNotif) return 'granted';
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  function show(options) {
    if (!options || !options.title) return null;

    if (_electronNotif) {
      return _showElectron(options);
    }
    return _showWeb(options);
  }

  function _showElectron(options) {
    try {
      const notif = new _electronNotif({
        title: options.title,
        body: options.body || '',
        icon: options.icon || 'app-icon-192.png',
        silent: Boolean(options.silent),
        timeoutType: options.requireInteraction ? 'never' : 'default',
        urgency: options.priority === 'high' ? 'critical' : 'normal'
      });

      if (options.onClick) notif.on('click', options.onClick);
      if (options.onClose) notif.on('close', options.onClose);

      notif.show();
      return notif;
    } catch (e) {
      console.warn('[DesktopNotif] Electron notification failed:', e);
      return _showWeb(options);
    }
  }

  function _showWeb(options) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return null;

    try {
      const notif = new Notification(options.title, {
        body: options.body || '',
        icon: options.icon || 'app-icon-192.png',
        badge: options.badge || 'app-icon-192.png',
        tag: options.tag || undefined,
        renotify: options.renotify || false,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        vibrate: options.vibrate || undefined,
        data: options.data || {}
      });

      if (options.onClick) notif.onclick = options.onClick;
      if (options.onClose) notif.onclose = options.onClose;

      return notif;
    } catch (e) {
      console.warn('[DesktopNotif] Web notification failed:', e);
      return null;
    }
  }

  function requestPermission() {
    if (_electronNotif) return Promise.resolve('granted');
    if (!('Notification' in window)) return Promise.resolve('denied');
    return Notification.requestPermission();
  }

  function closeAll(tag) {
    if (!('Notification' in window)) return;
    if (tag) {
      navigator.serviceWorker?.ready.then(reg => {
        reg.getNotifications({ tag }).then(notifs => {
          notifs.forEach(n => n.close());
        });
      });
    }
  }

  function showCallNotification(options) {
    return show({
      title: options.title || '📞 Incoming Call',
      body: options.body || `${options.callerName || 'Someone'} is calling`,
      icon: options.avatar || 'app-icon-192.png',
      tag: `call-${options.callId || ''}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [700, 250, 700, 250, 700],
      priority: 'high',
      data: {
        kind: 'call',
        callId: options.callId || '',
        url: options.url || './index.html'
      },
      onClick: () => {
        window.focus();
        if (options.callId) {
          window.location.href = `./index.html?callId=${encodeURIComponent(options.callId)}&callAction=accept`;
        }
      }
    });
  }

  function showMessageNotification(options) {
    return show({
      title: options.title || 'New Message',
      body: options.body || 'You have a new message',
      icon: options.avatar || 'app-icon-192.png',
      tag: `chat-${options.chatType || 'direct'}-${options.chatId || ''}`,
      renotify: false,
      requireInteraction: false,
      silent: false,
      data: {
        kind: options.kind || 'message',
        chatId: options.chatId || '',
        chatType: options.chatType || 'direct',
        messageId: options.messageId || '',
        groupId: options.groupId || '',
        url: options.url || './index.html'
      },
      onClick: () => {
        window.focus();
        var payload = {
          chatId: options.chatId,
          messageId: options.messageId || '',
          kind: options.kind || 'message',
          chatType: options.chatType || 'direct',
          groupId: options.groupId || ''
        };
        if (typeof window.handleNotificationClick === 'function') {
          window.handleNotificationClick(payload);
        } else if (options.chatId && typeof window.openChat === 'function') {
          window.openChat(options.chatId).then(function() {
            if (options.messageId && typeof window.highlightMessage === 'function') {
              setTimeout(function() { window.highlightMessage(options.messageId); }, 300);
            }
          });
        }
      }
    });
  }

  return {
    init,
    isSupported,
    permission,
    show,
    requestPermission,
    closeAll,
    showCallNotification,
    showMessageNotification,
    get isElectron() { return _isElectron; }
  };
})();

window.DesktopNotifications = DesktopNotifications;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DesktopNotifications.init());
} else {
  DesktopNotifications.init();
}
