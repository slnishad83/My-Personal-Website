(function () {
  'use strict';

  var _navChannel = null;
  var _lastHighlight = 0;

  function _db() {
    return (window.App && window.App.db) ? window.App.db : (window.firebase ? window.firebase.firestore() : null);
  }

  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  function _getChatId() {
    if (window.currentChat && window.currentChat.id) return window.currentChat.id;
    if (window.App && window.App.currentChat && window.App.currentChat.id) return window.App.currentChat.id;
    return null;
  }

  function _ensureCss() {
    if (document.getElementById('tc-nav-highlight-css')) return;
    var style = document.createElement('style');
    style.id = 'tc-nav-highlight-css';
    style.textContent = '@keyframes pulse-glow{0%{box-shadow:0 0 0 2px transparent,0 0 0 transparent}25%{box-shadow:0 0 0 2px var(--primary,#f59e0b),0 0 16px 2px var(--primary,#f59e0b)}50%{box-shadow:0 0 0 2px var(--primary,#f59e0b),0 0 12px 2px var(--primary,#f59e0b)}100%{box-shadow:0 0 0 2px transparent,0 0 0 transparent}}.tc-msg-highlight{animation:pulse-glow 3s ease-out forwards;border-radius:8px}';
    document.head.appendChild(style);
  }

  function highlightMessage(messageId) {
    if (!messageId) return;
    _ensureCss();
    var el = document.querySelector('[data-message-id="' + messageId + '"]')
      || document.getElementById('msg-' + messageId)
      || document.getElementById('message-' + messageId);
    if (!el) return;
    el.classList.remove('tc-msg-highlight');
    void el.offsetWidth;
    el.classList.add('tc-msg-highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    _lastHighlight = Date.now();
    setTimeout(function () {
      el.classList.remove('tc-msg-highlight');
    }, 3200);
  }

  function getFirstUnreadId(chatId) {
    var divider = document.querySelector('.unread-divider[data-chat-id="' + chatId + '"]')
      || document.querySelector('.unread-divider');
    if (divider) {
      var next = divider.nextElementSibling;
      if (next && (next.dataset.messageId || next.id)) {
        return next.dataset.messageId || next.id.replace(/^msg-|^message-/, '');
      }
    }
    var marker = document.querySelector('[data-first-unread="true"][data-chat-id="' + chatId + '"]')
      || document.querySelector('[data-first-unread="true"]');
    if (marker) return marker.dataset.messageId || marker.id.replace(/^msg-|^message-/, '');
    return null;
  }

  function scrollToUnread(chatId) {
    var id = getFirstUnreadId(chatId || _getChatId());
    if (id) {
      setTimeout(function () { highlightMessage(id); }, 200);
      return true;
    }
    return false;
  }

  function markAsReadUpTo(chatId, messageId) {
    var db = _db();
    var uid = (window.currentUser && window.currentUser.uid) || (window.App && window.App.auth && window.App.auth.currentUser && window.App.auth.currentUser.uid);
    if (!db || !chatId || !uid) return;
    var ref = db.collection('chats').doc(chatId).collection('readStatus').doc(uid);
    var update = { lastReadAt: new Date() };
    if (messageId) update.lastReadMessageId = messageId;
    ref.set(update, { merge: true }).catch(function () {});
    document.dispatchEvent(new CustomEvent('tc:chat:read', { detail: { chatId: chatId, messageId: messageId } }));
  }

  function navigateToReaction(chatId, messageId) {
    if (!chatId) return;
    var currentId = _getChatId();
    if (currentId !== chatId) {
      if (currentId && window.App && typeof window.App.backToChatList === 'function') {
        window.App.backToChatList();
      }
      if (typeof window.openChat === 'function') {
        window.openChat(chatId).then(function () {
          setTimeout(function () { highlightMessage(messageId); }, 300);
        }).catch(function () {});
      } else if (typeof window.selectChat === 'function') {
        window.selectChat(chatId);
        setTimeout(function () { highlightMessage(messageId); }, 300);
      }
    } else {
      highlightMessage(messageId);
    }
  }

  function navigateToMention(chatId, messageId) {
    navigateToReaction(chatId, messageId);
  }

  function _handleThreadReply(data) {
    var chatId = data.chatId || _getChatId();
    var parentId = data.parentMessageId || data.parentId;
    if (!chatId) return;
    var currentId = _getChatId();
    if (currentId !== chatId) {
      if (currentId && window.App && typeof window.App.backToChatList === 'function') {
        window.App.backToChatList();
      }
      if (typeof window.openChat === 'function') {
        window.openChat(chatId).then(function () { _openThreadPanel(data); }).catch(function () {});
      } else if (typeof window.selectChat === 'function') {
        window.selectChat(chatId);
        setTimeout(function () { _openThreadPanel(data); }, 200);
      }
    } else {
      _openThreadPanel(data);
    }
  }

  function _openThreadPanel(data) {
    var parentId = data.parentMessageId || data.parentId;
    var messageId = data.messageId;
    if (typeof window.openThreadPanel === 'function' && parentId) {
      window.openThreadPanel(parentId, data.parentMessageData || {});
    }
    setTimeout(function () {
      highlightMessage(messageId || parentId);
    }, 400);
  }

  function handleNotificationClick(data) {
    if (!data) return;
    var chatId = data.chatId || data.groupId || data.chatUserId;
    var messageId = data.messageId || data.id;
    var kind = data.kind || data.type || 'message';
    if (kind === 'reaction' || data.kind === 'reaction') {
      navigateToReaction(chatId, messageId);
    } else if (kind === 'mention' || data.mentioned) {
      navigateToMention(chatId, messageId);
    } else if (kind === 'thread_reply' || kind === 'threadReply') {
      _handleThreadReply(data);
    } else if (kind === 'call' || kind === 'missed_call') {
      document.dispatchEvent(new CustomEvent('tc:notification:call-click', { detail: data }));
    } else {
      if (chatId && chatId !== _getChatId()) {
        var currentId = _getChatId();
        if (currentId && window.App && typeof window.App.backToChatList === 'function') {
          window.App.backToChatList();
        }
        if (typeof window.openChat === 'function') {
          window.openChat(chatId).then(function () {
            if (messageId) setTimeout(function () { highlightMessage(messageId); }, 300);
            else scrollToUnread(chatId);
          }).catch(function () {});
        } else if (typeof window.selectChat === 'function') {
          window.selectChat(chatId);
          setTimeout(function () {
            if (messageId) highlightMessage(messageId);
            else scrollToUnread(chatId);
          }, 200);
        }
      } else if (messageId) {
        highlightMessage(messageId);
      } else {
        scrollToUnread(chatId || _getChatId());
      }
    }
    markAsReadUpTo(chatId, messageId);
  }

  function _setupBroadcast() {
    if (!('BroadcastChannel' in window)) return;
    try {
      _navChannel = new BroadcastChannel('tc-notification-nav');
      _navChannel.onmessage = function (event) {
        var msg = event.data || {};
        if (msg.type === 'navigate-chat' && msg.chatId) {
          if (typeof window.openChat === 'function') {
            window.openChat(msg.chatId).catch(function () {});
          } else if (typeof window.selectChat === 'function') {
            window.selectChat(msg.chatId);
          }
        }
        if (msg.type === 'navigate-message' && msg.chatId && msg.messageId) {
          handleNotificationClick(msg);
        }
      };
    } catch (_) {}
  }

  function _broadcastNav(chatId, messageId) {
    if (!_navChannel) return;
    try {
      _navChannel.postMessage({ type: 'navigate-chat', chatId: chatId, messageId: messageId });
    } catch (_) {}
  }

  function _handleServiceWorkerNotification(event) {
    var data = event.data;
    if (!data) return;
    var msg = data.data || data;
    if (msg && (msg.chatId || msg.groupId)) {
      handleNotificationClick(msg);
    }
  }

  function _setupServiceWorkerNav() {
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.addEventListener('message', function (event) {
      var msg = event.data || {};
      if (msg.type === 'TC_NAVIGATE') {
        handleNotificationClick(msg.payload || msg);
      }
    });
    if ('Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(function (reg) {
        if (reg && reg.showNotification) {
          var original = reg.showNotification;
        }
      }).catch(function () {});
    }
  }

  function _setupNotificationInterception() {
    if ('Notification' in window && typeof Proxy !== 'undefined') {
      var origClose = window.Notification.prototype.close;
      window.Notification.prototype.close = function () {
        if (this.data && this.data.chatId) {
          _broadcastNav(this.data.chatId, this.data.messageId);
        }
        return origClose.apply(this, arguments);
      };
    }
  }

  function _setupBroadcastFocus() {
    if (!('BroadcastChannel' in window)) return;
    try {
      var focusChannel = new BroadcastChannel('tc-tab-focus');
      focusChannel.onmessage = function (event) {
        var msg = event.data || {};
        if (msg.type === 'focus-chat' && msg.chatId) {
          if (typeof window.openChat === 'function') {
            window.openChat(msg.chatId).catch(function () {});
          } else if (typeof window.selectChat === 'function') {
            window.selectChat(msg.chatId);
          }
        }
      };
    } catch (_) {}
  }

  function init() {
    _ensureCss();
    _setupBroadcast();
    _setupServiceWorkerNav();
    _setupNotificationInterception();
    _setupBroadcastFocus();
    document.addEventListener('tc:notification:message', function (e) {
      var detail = e.detail || {};
      if (detail.chatId && detail.messageId) {
        if (document.visibilityState === 'visible') {
          var currentId = _getChatId();
          if (currentId === detail.chatId) {
            highlightMessage(detail.messageId);
          }
        }
      }
    });
    document.addEventListener('click', function (e) {
      var notifEl = e.target.closest('[data-notification-click]');
      if (!notifEl) return;
      try {
        var payload = JSON.parse(notifEl.dataset.notificationClick || '{}');
        e.preventDefault();
        handleNotificationClick(payload);
      } catch (_) {}
    }, true);
  }

  window.navigateToReaction = navigateToReaction;
  window.navigateToMention = navigateToMention;
  window.handleNotificationClick = handleNotificationClick;
  window.highlightMessage = highlightMessage;
  window.scrollToUnread = scrollToUnread;
  window.getFirstUnreadId = getFirstUnreadId;
  window.markAsReadUpTo = markAsReadUpTo;

  if (document.readyState === 'complete') setTimeout(init, 0);
  else window.addEventListener('load', function () { setTimeout(init, 0); });
})();
