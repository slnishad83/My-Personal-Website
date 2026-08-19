'use strict';
(function () {
    var QUICK_EMOJIS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDE4F'];
    var ALL_REACTION_EMOJIS = [
    '\uD83D\uDC4D', '\uD83D\uDC4E', '\u2764\uFE0F', '\uD83E\uDDE1', '\uD83D\uDC9B', '\uD83D\uDC9A', '\uD83D\uDC99', '\uD83D\uDC9C', '\uD83D\uDC94', '\uD83D\uDE0D',
    '\uD83D\uDE02', '\uD83D\uDE23', '\uD83D\uDE2D', '\uD83D\uDE21', '\uD83D\uDE2F', '\uD83D\uDE3A', '\uD83D\uDE34', '\uD83D\uDE14', '\uD83D\uDE10', '\uD83D\uDE0C',
    '\uD83D\uDE2E', '\uD83D\uDE31', '\uD83D\uDE25', '\uD83D\uDE24', '\uD83D\uDE07', '\uD83D\uDE08', '\uD83D\uDE11', '\uD83D\uDC80', '\uD83D\uDC7B', '\uD83D\uDC7D',
    '\uD83D\uDE4F', '\uD83D\uDC4F', '\uD83D\uDD1D', '\uD83D\uDCAA', '\uD83E\uDD1A', '\u270B', '\uD83D\uDC4B', '\uD83D\uDE4C', '\uD83D\uDC49', '\uD83D\uDC47',
    '\u2764\uFE0F\u200D\uD83D\uDD25', '\uD83D\uDC94', '\uD83D\uDCAB', '\uD83D\uDD25', '\u2B50', '\uD83C\uDF89', '\uD83C\uDF8A', '\u2705', '\u274C', '\u26A0\uFE0F'
  ];

  var _usageCounts = {};
  var _activePicker = null;
  var _reactionUnsubscribes = {};

  var _esc = function(s) { return window.App && window.App.escHtml ? window.App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  var _db = function() { return window.App && window.App.db ? window.App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };

  var _uid = function() { return window.App && window.App.uid ? window.App.uid() : (window.currentUser ? window.currentUser.uid : null); };

  function _currentChatId() {
    return (App && App.currentChat && App.currentChat.id) || (window.App && window.App.currentChat && window.App.currentChat.id) || '';
  }

  function _chatIsGroup() {
    return !!(App && (App.currentChatType === 'group' || (App.currentChat && App.currentChat.type === 'group')));
  }

  function _messageRef(db, msgId) {
    var cid = _currentChatId();
    if (!cid || !db || !msgId) return null;
    return db.collection(_chatIsGroup() ? 'groups' : 'chats').doc(cid).collection('messages').doc(msgId);
  }

  function _loadUsageCounts() {
    try {
      _usageCounts = JSON.parse(localStorage.getItem('nsl_reaction_usage') || '{}');
    } catch (_) {
      _usageCounts = {};
    }
  }

  function _saveUsageCounts() {
    try {
      localStorage.setItem('nsl_reaction_usage', JSON.stringify(_usageCounts));
    } catch (_) {}
  }

  function _recordUsage(emoji) {
    _usageCounts[emoji] = (_usageCounts[emoji] || 0) + 1;
    _saveUsageCounts();
  }

  function getQuickReactions() {
    var sorted = Object.keys(_usageCounts).sort(function (a, b) {
      return (_usageCounts[b] || 0) - (_usageCounts[a] || 0);
    });
    var result = [];
    for (var i = 0; i < sorted.length && result.length < 6; i++) {
      result.push(sorted[i]);
    }
    QUICK_EMOJIS.forEach(function (e) {
      if (result.length < 6 && result.indexOf(e) === -1) result.push(e);
    });
    return result.slice(0, 6);
  }

  function _ensureAnimationStyle() {
    if (document.getElementById('nsl-reaction-anim-style')) return;
    var style = document.createElement('style');
    style.id = 'nsl-reaction-anim-style';
    style.textContent =
      '@keyframes nslReactionBounce{0%{transform:scale(0);opacity:0}50%{transform:scale(1.3)}100%{transform:scale(1);opacity:1}}' +
      '@keyframes nslReactionPop{0%{transform:scale(1)}30%{transform:scale(1.4)}100%{transform:scale(1)}}' +
      '@keyframes nslShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}';
    document.head.appendChild(style);
  }

  function _removeActivePickers() {
    if (_activePicker) {
      _activePicker.remove();
      _activePicker = null;
    }
    document.querySelectorAll('.nsl-full-picker, .nsl-reaction-bar, .nsl-reaction-viewer').forEach(function (el) { el.remove(); });
  }

  function showReactionPicker(msgId) {
    _removeActivePickers();
    _ensureAnimationStyle();

    var quick = getQuickReactions();
    var bar = document.createElement('div');
    bar.className = 'nsl-reaction-bar';

    quick.forEach(function (emoji) {
      var btn = document.createElement('button');
      btn.textContent = emoji;
      btn.onclick = function (e) {
        e.stopPropagation();
        _removeActivePickers();
        toggleReaction(msgId, emoji);
      };
      bar.appendChild(btn);
    });

    var moreBtn = document.createElement('button');
    moreBtn.textContent = '➕';
    moreBtn.style.fontSize = '16px';
    moreBtn.onclick = function (e) {
      e.stopPropagation();
      bar.remove();
      _showFullPicker(msgId);
    };
    bar.appendChild(moreBtn);

    document.body.appendChild(bar);
    _activePicker = bar;

    var msgEl = document.querySelector('[data-message-id="' + msgId + '"]');
    if (msgEl) {
      var rect = msgEl.getBoundingClientRect();
      bar.style.position = 'fixed';
      bar.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - 300)) + 'px';
      bar.style.top = Math.max(10, rect.top - 50) + 'px';
    } else {
      bar.style.position = 'fixed';
      bar.style.left = '50%';
      bar.style.top = '50%';
      bar.style.transform = 'translate(-50%, -50%)';
    }

    setTimeout(function () {
      document.addEventListener('click', function closeBar() {
        _removeActivePickers();
        document.removeEventListener('click', closeBar);
      }, { once: true });
    }, 20);
  }

  function _showFullPicker(msgId) {
    _ensureAnimationStyle();
    var picker = document.createElement('div');
    picker.className = 'nsl-full-picker';

    var search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search emoji...';
    search.style.cssText = 'width:100%;padding:6px 10px;border:1px solid var(--outline-variant,#ccc);border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box;background:var(--surface,#fff);color:var(--on-surface,#000)';
    picker.appendChild(search);

    var grid = document.createElement('div');
    grid.className = 'nsl-full-picker-grid';

    var EMOJI_NAMES = {
      '\uD83D\uDE1C':'thumbsup','\uD83D\uDC4E':'thumbsdown','\u2764\uFE0F':'red_heart','\uD83D\uDCAB':'fire','\uD83D\uDE01':'laughing','\uD83D\uDE00':'open_mouth',
      '\uD83D\uDE22':'cry','\uD83D\uDE4F':'pray','\uD83D\uDE1D':'muscle','\uD83D\uDC4F':'clap','\uD83C\uDF89':'party','\uD83D\uDE36':'100',
      '\uD83D\uDE0A':'smiling_face_hearts','\uD83D\uDE0D':'heart_eyes','\uD83D\uDE0E':'sunglasses',
      '\uD83D\uDE14':'hmm','\uD83D\uDE02':'rofl','\uD83D\uDE2D':'crying','\uD83D\uDF83':'partying','\uD83D\uDE34':'sleeping',
      '\uD83D\uDC40':'eyes','\uD83D\uDC80':'dead','\uD83D\uDCAC':'handshake',
      '\u2728':'sparkles','\uD83D\uDE4C':'raised_hands','\uD83D\uDC95':'two_hearts','\u26A1':'zap','\u2705':'check',
      '\uD83D\uDE03':'scream','\uD83E\uDD21':'clown_face','\uD83D\uDE11':'purple_heart','\uD83D\uDC94':'black_heart','\uD83D\uDDE1':'orange_heart',
      '\uD83D\uDE10':'green_heart','\uD83D\uDC99':'blue_heart','\uD83D\uDC9A':'white_heart','\uD83D\uDC93':'heartpulse',
      '\uD83D\uDDA4':'salute','\uD83D\uDCCC':'heart_hands','\uD83D\uDE2F':'pleading'
    };
    function renderGrid(filter) {
      grid.innerHTML = '';
      var lf = filter ? filter.toLowerCase() : '';
      var list = lf
        ? ALL_REACTION_EMOJIS.filter(function (e) {
            return e.indexOf(lf) !== -1 || (EMOJI_NAMES[e] || '').indexOf(lf) !== -1;
          })
        : ALL_REACTION_EMOJIS;
      list.forEach(function (emoji) {
        var btn = document.createElement('button');
        btn.textContent = emoji;
        btn.onclick = function (e) {
          e.stopPropagation();
          _removeActivePickers();
          toggleReaction(msgId, emoji);
        };
        grid.appendChild(btn);
      });
    }

    renderGrid('');
    search.addEventListener('input', function () { renderGrid(search.value); });
    picker.appendChild(grid);

    document.body.appendChild(picker);
    _activePicker = picker;
    picker.style.left = '50%';
    picker.style.top = '50%';
    picker.style.transform = 'translate(-50%, -50%)';
    search.focus();

    setTimeout(function () {
      document.addEventListener('click', function closePicker(ev) {
        if (!picker.contains(ev.target)) {
          _removeActivePickers();
          document.removeEventListener('click', closePicker);
        }
      }, { once: true });
    }, 20);
  }

  function _showReactionViewer(msgId, reactions) {
    _removeActivePickers();
    _ensureAnimationStyle();

    var viewer = document.createElement('div');
    viewer.className = 'nsl-reaction-viewer';

    var allUsers = window.allUsers || [];
    var userMap = {};
    allUsers.forEach(function (u) { userMap[u.uid] = u.displayName || u.email || 'User'; });

    Object.keys(reactions).sort(function (a, b) {
      return (reactions[b] || []).length - (reactions[a] || []).length;
    }).forEach(function (emoji) {
      var users = reactions[emoji] || [];
      users.forEach(function (uid) {
        var row = document.createElement('div');
        row.className = 'nsl-rv-row';
        row.innerHTML = '<span>' + _esc(emoji) + '</span><span>' + _esc(userMap[uid] || uid.substring(0, 8)) + '</span>';
        viewer.appendChild(row);
      });
    });

    document.body.appendChild(viewer);

    var msgEl = document.querySelector('[data-message-id="' + msgId + '"]');
    if (msgEl) {
      var badgeEl = msgEl.querySelector('.nsl-reaction-badge');
      if (badgeEl) {
        var rect = badgeEl.getBoundingClientRect();
        viewer.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - 260)) + 'px';
        viewer.style.top = Math.max(10, rect.top - viewer.offsetHeight - 8) + 'px';
        if (parseInt(viewer.style.top) < 10) {
          viewer.style.top = (rect.bottom + 8) + 'px';
        }
      }
    }

    setTimeout(function () {
      document.addEventListener('click', function closeViewer() {
        viewer.remove();
        document.removeEventListener('click', closeViewer);
      }, { once: true });
    }, 20);
  }

  async function toggleReaction(msgId, emoji) {
    var d = _db();
    var uid = _uid();
    if (!d || !uid || !msgId) return;

    _recordUsage(emoji);

    try {
      var msgRef = _messageRef(d, msgId) || d.collection('messages').doc(msgId);
      var snap = await msgRef.get();
      if (!snap.exists) return;

      var data = snap.data();
      var reactions = data.reactions || {};
      var users = reactions[emoji] || [];

      var idx = users.indexOf(uid);
      if (idx !== -1) {
        users.splice(idx, 1);
        if (users.length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = users;
        }
      } else {
        reactions[emoji] = users.concat([uid]);
      }

      await msgRef.update({ reactions: reactions });

      if (idx === -1) {
        _sendReactionNotification(msgId, emoji, data);
      }
    } catch (err) {
      if (window.__DEBUG__) console.error('Reaction error:', err);
      if (typeof showToast === 'function') showToast('Failed to react', 'error');
    }
  }

  function _sendReactionNotification(msgId, emoji, msgData) {
    var uid = _uid();
    if (!uid) return;
    if (msgData.senderId === uid) return;

    var senderName = 'Someone';
    if (window.currentUser) senderName = window.currentUser.displayName || window.currentUser.email || 'Someone';

    var chatId = msgData.directId || msgData.chatId || msgData.groupId || '';
    var chatType = msgData.groupId ? 'group' : 'direct';

    var reactionPayload = {
      msgId: msgId,
      emoji: emoji,
      senderName: senderName,
      senderUid: uid,
      chatId: chatId,
      chatType: chatType,
      msgText: msgData.text ? msgData.text.substring(0, 100) : '',
      timestamp: Date.now()
    };

    try {
      var history = JSON.parse(localStorage.getItem('tc_reaction_notifications') || '[]');
      history.unshift(reactionPayload);
      if (history.length > 50) history = history.slice(0, 50);
      localStorage.setItem('tc_reaction_notifications', JSON.stringify(history));
    } catch (_) {}

    try {
      var d = _db();
      if (d && msgData.senderId) {
        d.collection('inAppNotifications').add({
          toUserId: msgData.senderId,
          fromUserId: uid,
          fromUserName: senderName,
          type: 'reaction',
          kind: 'reaction',
          emoji: emoji,
          messageId: msgId,
          chatId: chatId,
          chatType: chatType,
          message: senderName + ' reacted ' + emoji + ' to your message',
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function (_) {});
      }
    } catch (_) {}

    try {
      if (typeof window.sendPushNotification === 'function') {
        window.sendPushNotification(msgData.senderId, {
          title: senderName + ' reacted ' + emoji,
          body: msgData.text ? msgData.text.substring(0, 100) : 'to your message',
          tag: 'reaction-' + msgId,
          messageId: msgId,
          chatId: chatId,
          chatType: chatType,
          kind: 'reaction',
          url: window.location.origin + window.location.pathname + '#reaction:' + msgId
        });
      }
    } catch (_) {}

    try {
      var badgeCount = parseInt(localStorage.getItem('tc_reaction_badge_count') || '0', 10);
      badgeCount++;
      localStorage.setItem('tc_reaction_badge_count', String(badgeCount));
      document.dispatchEvent(new CustomEvent('tc:reaction-badge-update', { detail: { count: badgeCount, chatId: chatId, emoji: emoji, messageId: msgId } }));
    } catch (_) {}

    try {
      if (typeof window.markChatReactionUnread === 'function') {
        window.markChatReactionUnread(chatId, msgId, emoji);
      }
    } catch (_) {}
  }

  function getUnreadReactionCount() {
    try {
      return parseInt(localStorage.getItem('tc_reaction_badge_count') || '0', 10);
    } catch (_) { return 0; }
  }

  function clearUnreadReactions() {
    try {
      localStorage.setItem('tc_reaction_badge_count', '0');
      document.dispatchEvent(new CustomEvent('tc:reaction-badge-update', { detail: { count: 0 } }));
    } catch (_) {}
  }

  function scrollToReaction(msgId) {
    if (!msgId) return;
    clearUnreadReactions();
    var msgEl = document.querySelector('[data-message-id="' + msgId + '"]');
    if (msgEl) {
      msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      msgEl.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
      msgEl.style.boxShadow = '0 0 0 3px var(--primary, #00a884)';
      msgEl.style.borderRadius = '12px';
      msgEl.style.transform = 'scale(1.02)';
      setTimeout(function () {
        msgEl.style.boxShadow = '';
        msgEl.style.transform = '';
      }, 2000);
      return true;
    }
    return false;
  }

  function renderReactions(msgId, reactions) {
    _ensureAnimationStyle();
    var uid = _uid();
    if (!reactions || typeof reactions !== 'object') return '';

    var keys = Object.keys(reactions);
    if (keys.length === 0) return '';

    var sorted = keys.filter(function (k) {
      return reactions[k] && reactions[k].length > 0;
    }).sort(function (a, b) {
      return (reactions[b] || []).length - (reactions[a] || []).length;
    });

    if (sorted.length === 0) return '';

    var html = '<div class="nsl-reactions-container" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">';
    sorted.forEach(function (emoji) {
      var users = reactions[emoji] || [];
      var isActive = uid && users.indexOf(uid) !== -1;
      html += '<button class="nsl-reaction-badge' + (isActive ? ' active' : '') + '" data-msg-id="' + _esc(msgId) + '" data-emoji="' + _esc(emoji) + '">';
      html += '<span>' + _esc(emoji) + '</span>';
      html += '<span class="nsl-r-count">' + users.length + '</span>';
      html += '</button>';
    });
    html += '</div>';
    return html;
  }

  function _attachReactionListeners(container) {
    if (!container) return;
    container.addEventListener('click', function (e) {
      var badge = e.target.closest('.nsl-reaction-badge');
      if (badge) {
        e.stopPropagation();
        var msgId = badge.dataset.msgId;
        var emoji = badge.dataset.emoji;
        if (msgId && emoji) toggleReaction(msgId, emoji);
        return;
      }
      var reactionsContainer = e.target.closest('.nsl-reactions-container');
      if (reactionsContainer) {
        e.stopPropagation();
        var msgEl = reactionsContainer.closest('[data-message-id]');
        if (msgEl) {
          var mid = msgEl.dataset.messageId;
          var d = _db();
          if (d && mid) {
            var msgRef = _messageRef(d, mid) || d.collection('messages').doc(mid);
            msgRef.get().then(function(snap) {
              if (snap.exists) {
                var reactions = snap.data().reactions || {};
                if (Object.keys(reactions).length > 0) {
                  _showReactionViewer(mid, reactions);
                }
              }
            }).catch(function() {});
          }
        }
        return;
      }
    });

    container.addEventListener('dblclick', function (e) {
      var msgEl = e.target.closest('[data-message-id]');
      if (msgEl) {
        e.preventDefault();
        var msgId = msgEl.dataset.messageId;
        if (msgId) showReactionPicker(msgId);
      }
    });

    container.addEventListener('contextmenu', function (_e) {
      return;
    });

    container.addEventListener('touchstart', function (e) {
      var badge = e.target.closest('.nsl-reaction-badge');
      if (badge) {
        var timer = setTimeout(function() {
          e.preventDefault();
          var msgId = badge.dataset.msgId;
          var d = _db();
          if (d && msgId) {
            var msgRef2 = _messageRef(d, msgId) || d.collection('messages').doc(msgId);
            msgRef2.get().then(function(snap) {
              if (snap.exists) {
                var reactions = snap.data().reactions || {};
                if (Object.keys(reactions).length > 0) {
                  _showReactionViewer(msgId, reactions);
                }
              }
            }).catch(function() {});
          }
        }, 500);
        var cancel = function() { clearTimeout(timer); };
        badge.addEventListener('touchend', cancel, { once: true });
        badge.addEventListener('touchmove', cancel, { once: true });
      }
    }, { passive: false });
  }

  function subscribeToReactions(msgId) {
    var d = _db();
    if (!d || !msgId) return;

    if (_reactionUnsubscribes[msgId]) return;

    var _MAX_REACTION_LISTENERS = 30;
    var keys = Object.keys(_reactionUnsubscribes);
    if (keys.length >= _MAX_REACTION_LISTENERS) {
      var oldest = keys[0];
      try { _reactionUnsubscribes[oldest](); } catch (_) {}
      delete _reactionUnsubscribes[oldest];
    }

    var reactionRef = _messageRef(d, msgId) || d.collection('messages').doc(msgId);
    _reactionUnsubscribes[msgId] = reactionRef
      .onSnapshot(function (snap) {
        if (!snap.exists) return;
        var data = snap.data();
        var reactions = data.reactions || {};
        var badges = renderReactions(msgId, reactions);
        var msgEl = document.querySelector('[data-message-id="' + msgId + '"]');
        if (!msgEl) return;

        var existing = msgEl.querySelector('.nsl-reactions-container');
        if (Object.keys(reactions).length === 0) {
          if (existing) existing.remove();
          return;
        }

        if (existing) {
          existing.outerHTML = badges;
        } else {
          var bubble = msgEl.querySelector('.message-bubble, .msg-bubble, [class*="bubble"]');
          if (bubble) {
            bubble.insertAdjacentHTML('afterend', badges);
          } else {
            msgEl.insertAdjacentHTML('beforeend', badges);
          }
        }
      });
  }

  function unsubscribeAllReactions() {
    Object.keys(_reactionUnsubscribes).forEach(function (msgId) {
      try { _reactionUnsubscribes[msgId](); } catch (_) {}
    });
    _reactionUnsubscribes = {};
  }

  function initReactionListeners(container) {
    if (!container) container = document.getElementById('messagesContainer') || document.getElementById('messagesList') || document.getElementById('messages-wrap');
    if (!container) return;
    if (container.dataset.reactionsBound) return;
    container.dataset.reactionsBound = '1';
    _attachReactionListeners(container);
  }

  var _reactionObserver = null;

  function wireReactionPostRender() {
    if (typeof MutationObserver === 'undefined') return;
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList') || document.getElementById('messages-wrap');
    if (!container) {
      setTimeout(wireReactionPostRender, 1000);
      return;
    }

    if (_reactionObserver) { _reactionObserver.disconnect(); _reactionObserver = null; }

    _reactionObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          var msgEl = node.dataset && node.dataset.messageId ? node : node.querySelector('[data-message-id]');
          if (!msgEl) return;
          var msgId = msgEl.dataset.messageId;
          if (!msgId) return;
          subscribeToReactions(msgId);
        });
      });
    });

    _reactionObserver.observe(container, { childList: true, subtree: true });

    container.querySelectorAll('[data-message-id]').forEach(function (el) {
      subscribeToReactions(el.dataset.messageId);
    });
  }

  _loadUsageCounts();
  _ensureAnimationStyle();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initReactionListeners();
      wireReactionPostRender();
    });
  } else {
    initReactionListeners();
    wireReactionPostRender();
  }

  window.toggleReaction = toggleReaction;
  window.showReactionPicker = showReactionPicker;
  window.showReactionViewer = _showReactionViewer;
  window.renderReactions = renderReactions;
  window.getQuickReactions = getQuickReactions;
  window.initReactionListeners = initReactionListeners;
  window.wireReactionPostRender = wireReactionPostRender;
  function cleanupReactionSubscriptions() {
    Object.keys(_reactionUnsubscribes).forEach(function (msgId) {
      try { _reactionUnsubscribes[msgId](); } catch (_) {}
      delete _reactionUnsubscribes[msgId];
    });
  }

  window.unsubscribeAllReactions = unsubscribeAllReactions;
  window.cleanupReactionSubscriptions = cleanupReactionSubscriptions;
  window.getUnreadReactionCount = getUnreadReactionCount;
  window.clearUnreadReactions = clearUnreadReactions;
  window.scrollToReaction = scrollToReaction;

  window.addEventListener('hashchange', function () {
    var hash = window.location.hash;
    if (hash && hash.indexOf('#reaction:') === 0) {
      var msgId = hash.replace('#reaction:', '');
      setTimeout(function () { scrollToReaction(msgId); }, 500);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  });

  if (window.location.hash && window.location.hash.indexOf('#reaction:') === 0) {
    var _initMsgId = window.location.hash.replace('#reaction:', '');
    setTimeout(function () { scrollToReaction(_initMsgId); }, 1500);
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  window.addEventListener('beforeunload', function () {
    cleanupReactionSubscriptions();
  });
})();
