(function () {
  'use strict';

  var UNREAD_KEY = 'tc_unread_state';
  var SOUND_THROTTLE_MS = 2000;
  var _lastSoundTime = 0;
  var _observer = null;
  var _unreadState = {};
  var _badgeBatchTimer = null;
  var _audioCtx = null;

  var _db = function() { return App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };

  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };

  function _loadState() {
    try {
      var raw = localStorage.getItem(UNREAD_KEY);
      _unreadState = raw ? JSON.parse(raw) : {};
    } catch (_) {
      _unreadState = {};
    }
    return _unreadState;
  }

  function _saveState() {
    try {
      localStorage.setItem(UNREAD_KEY, JSON.stringify(_unreadState));
    } catch (_) {}
  }

  function _ensureCss() {
    if (document.getElementById('tc-unread-polish-css')) return;
    var style = document.createElement('style');
    style.id = 'tc-unread-polish-css';
    style.textContent = '.tc-unread-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;font-size:11px;font-weight:600;color:#fff;line-height:1;box-sizing:border-box}.tc-unread-badge-sm{min-width:8px;height:8px;padding:0;font-size:0;border-radius:50%}.tc-unread-dot{position:absolute;top:0;right:0;width:10px;height:10px;border-radius:50%;background:#ef4444;border:2px solid var(--bg-primary,#1a1a2e);box-sizing:border-box}.tc-unread-divider{display:flex;align-items:center;gap:12px;padding:8px 16px;color:var(--text-secondary,#9ca3af);font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;user-select:none}.tc-unread-divider::before,.tc-unread-divider::after{content:"";flex:1;height:1px;background:var(--border-color,#374151)}.tc-unread-divider-count{background:var(--primary,#f59e0b);color:#000;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}';
    document.head.appendChild(style);
  }

  function formatUnreadCount(count) {
    var n = Number(count) || 0;
    if (n <= 0) return '';
    if (n < 1000) return String(n);
    if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    if (n < 1000000) return Math.floor(n / 1000) + 'K';
    return Math.floor(n / 1000000) + 'M';
  }

  function getUnreadBadgeColor(count) {
    var n = Number(count) || 0;
    if (n >= 100) return '#ef4444';
    if (n >= 10) return '#f59e0b';
    return '#22c55e';
  }

  function renderBadge(element, count) {
    if (!element) return;
    var n = Number(count) || 0;
    var existing = element.querySelector('.tc-unread-badge');
    if (n <= 0) {
      if (existing) existing.remove();
      element.removeAttribute('data-unread-count');
      return;
    }
    var badge = existing || document.createElement('span');
    badge.className = 'tc-unread-badge';
    badge.textContent = formatUnreadCount(n);
    badge.style.background = getUnreadBadgeColor(n);
    if (!existing) element.appendChild(badge);
    element.setAttribute('data-unread-count', String(n));
  }

  function getUnreadCount(chatId) {
    if (!chatId) return 0;
    if (_unreadState[chatId] && typeof _unreadState[chatId].count === 'number') {
      return _unreadState[chatId].count;
    }
    return 0;
  }

  function getTotalUnread() {
    var total = 0;
    var keys = Object.keys(_unreadState);
    for (var i = 0; i < keys.length; i++) {
      var entry = _unreadState[keys[i]];
      if (entry && typeof entry.count === 'number') total += entry.count;
    }
    return total;
  }

  function clearUnread(chatId) {
    if (!chatId) return;
    _unreadState[chatId] = { count: 0, lastRead: Date.now() };
    _saveState();
    updateUnreadBadges();
    document.dispatchEvent(new CustomEvent('tc:unread:cleared', { detail: { chatId: chatId } }));
  }

  function markAllAsRead() {
    var keys = Object.keys(_unreadState);
    for (var i = 0; i < keys.length; i++) {
      _unreadState[keys[i]].count = 0;
      _unreadState[keys[i]].lastRead = Date.now();
    }
    _saveState();
    updateUnreadBadges();
    if (window.NotificationOrchestrator && typeof window.NotificationOrchestrator.syncBadge === 'function') {
      window.NotificationOrchestrator.syncBadge();
    }
    var db = _db();
    var uid = _uid();
    if (db && uid) {
      db.collection('users').doc(uid).get().then(function (doc) {
        if (doc.exists) {
          var data = doc.data() || {};
          var chats = data.chats || data.chatList || {};
          var updates = {};
          var chatKeys = Object.keys(chats);
          for (var i = 0; i < chatKeys.length; i++) {
            var cid = chatKeys[i];
            updates['chats.' + cid + '.lastReadAt'] = new Date();
          }
          if (Object.keys(updates).length > 0) {
            db.collection('users').doc(uid).set(updates, { merge: true }).catch(function () {});
          }
        }
      }).catch(function () {});
    }
  }

  function renderUnreadDivider(timestamp) {
    var ts = timestamp || new Date();
    var timeStr;
    try {
      timeStr = new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (_) {
      timeStr = '';
    }
    var divider = document.createElement('div');
    divider.className = 'tc-unread-divider';
    divider.innerHTML = '<span>New Messages</span>' + (timeStr ? '<span>' + _esc(timeStr) + '</span>' : '');
    return divider;
  }

  function setupUnreadObserver() {
    if (_observer) { _observer.disconnect(); _observer = null; }
    if (!('IntersectionObserver' in window)) return;
    _observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.isIntersecting) {
          var divider = entry.target;
          var chatId = divider.dataset.chatId || (window.currentChat && window.currentChat.id)
            || (window.App && window.App.currentChat && window.App.currentChat.id);
          if (chatId) {
            clearUnread(chatId);
            markAsReadOnServer(chatId);
          }
          _observer.unobserve(divider);
        }
      }
    }, { threshold: 0.5 });
    var dividers = document.querySelectorAll('.tc-unread-divider, .unread-divider');
    for (var i = 0; i < dividers.length; i++) {
      _observer.observe(dividers[i]);
    }
  }

  function markAsReadOnServer(chatId) {
    var db = _db();
    var uid = _uid();
    if (!db || !chatId || !uid) return;
    var ref = db.collection('chats').doc(chatId).collection('readStatus').doc(uid);
    ref.set({ lastReadAt: new Date() }, { merge: true }).catch(function () {});
    document.dispatchEvent(new CustomEvent('tc:chat:read', { detail: { chatId: chatId } }));
  }

  function updateTabBadge() {
    var total = getTotalUnread();
    var base = 'NSL Chat';
    if (total > 0) {
      document.title = '(' + formatUnreadCount(total) + ') - ' + base;
    } else {
      document.title = base;
    }
    if (navigator.setAppBadge) {
      if (total > 0) {
        navigator.setAppBadge(total).catch(function () {});
      } else {
        try { navigator.clearAppBadge(); } catch (_) {}
      }
    }
    document.dispatchEvent(new CustomEvent('tc:tab:badge', { detail: { total: total } }));
  }

  function playUnreadSound(count) {
    var now = Date.now();
    if (now - _lastSoundTime < SOUND_THROTTLE_MS) return;
    _lastSoundTime = now;
    if (window.NotificationSounds) {
      window.NotificationSounds.play('message');
      return;
    }
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!_audioCtx) _audioCtx = new Ctx();
      var osc = _audioCtx.createOscillator();
      var gain = _audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(_audioCtx.destination);
      osc.start();
      osc.stop(_audioCtx.currentTime + 0.05);
      setTimeout(function () {
        try {
          var osc2 = _audioCtx.createOscillator();
          var gain2 = _audioCtx.createGain();
          osc2.type = 'sine';
          osc2.frequency.value = 1174;
          gain2.gain.value = 0.035;
          osc2.connect(gain2);
          gain2.connect(_audioCtx.destination);
          osc2.start();
          osc2.stop(_audioCtx.currentTime + 0.04);
        } catch (_) {}
      }, 75);
    } catch (_) {}
  }

  function _batchUpdateBadges(chatCounts) {
    if (!chatCounts || typeof chatCounts !== 'object') return;
    var keys = Object.keys(chatCounts);
    for (var i = 0; i < keys.length; i++) {
      var cid = keys[i];
      var count = Number(chatCounts[cid]) || 0;
      _unreadState[cid] = { count: count, lastRead: _unreadState[cid] ? _unreadState[cid].lastRead : 0 };
    }
    _saveState();
    updateUnreadBadges();
  }

  function updateUnreadBadges() {
    updateTabBadge();
    var chatElements = document.querySelectorAll('[data-chat-unread]');
    for (var i = 0; i < chatElements.length; i++) {
      var el = chatElements[i];
      var cid = el.dataset.chatId || el.dataset.chatUnread;
      var count = getUnreadCount(cid);
      renderBadge(el, count);
      if (el.classList) {
        if (count > 0) el.classList.add('tc-has-unread');
        else el.classList.remove('tc-has-unread');
      }
    }
    var sidebarTabs = document.querySelectorAll('[data-tab-badge]');
    for (var j = 0; j < sidebarTabs.length; j++) {
      var tab = sidebarTabs[j];
      var tabType = tab.dataset.tabBadge;
      if (tabType === 'chats') {
        renderBadge(tab, getTotalUnread());
      }
    }
    var avatars = document.querySelectorAll('.chat-avatar[data-chat-id]');
    for (var k = 0; k < avatars.length; k++) {
      var av = avatars[k];
      var avCid = av.dataset.chatId;
      var avCount = getUnreadCount(avCid);
      var dot = av.querySelector('.tc-unread-dot');
      if (avCount > 0) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'tc-unread-dot';
          av.style.position = 'relative';
          av.appendChild(dot);
        }
      } else if (dot) {
        dot.remove();
      }
    }
    document.dispatchEvent(new CustomEvent('tc:unread:updated', { detail: { total: getTotalUnread() } }));
  }

  function _syncUnreadFromFirestore() {
    var db = _db();
    var uid = _uid();
    if (!db || !uid) return;
    db.collection('users').doc(uid).collection('unreadCounts').get().then(function (snap) {
      var counts = {};
      var changed = false;
      snap.forEach(function (doc) {
        var cid = doc.id;
        var data = doc.data() || {};
        var count = Number(data.count || data.unreadCount || 0);
        counts[cid] = count;
        var prev = _unreadState[cid] ? _unreadState[cid].count : 0;
        if (count > prev) changed = true;
      });
      _batchUpdateBadges(counts);
      if (changed) playUnreadSound(getTotalUnread());
    }).catch(function () {});
  }

  function _setupBadgeListener() {
    document.addEventListener('tc:badge:update', function (e) {
      var detail = e.detail || {};
      var total = Number(detail.unread || 0);
      updateTabBadge();
      if (total > 0) playUnreadSound(total);
    });
    document.addEventListener('tc:notification:message', function (e) {
      var detail = e.detail || {};
      if (detail.chatId) {
        var current = getUnreadCount(detail.chatId);
        _unreadState[detail.chatId] = {
          count: (detail.unreadCount && detail.unreadCount > current) ? detail.unreadCount : current + 1,
          lastRead: _unreadState[detail.chatId] ? _unreadState[detail.chatId].lastRead : 0
        };
        _saveState();
        updateUnreadBadges();
        playUnreadSound(getTotalUnread());
      }
    });
    document.addEventListener('tc:unread:clear-chat', function (e) {
      var detail = e.detail || {};
      if (detail.chatId) clearUnread(detail.chatId);
    });
    document.addEventListener('tc:chat:read', function (e) {
      var detail = e.detail || {};
      if (detail.chatId) clearUnread(detail.chatId);
    });
  }

  function _setupChatListFilter() {
    document.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-filter="unread"], [data-unread-filter]');
      if (!chip) return;
      var chatItems = document.querySelectorAll('.chat-item, [data-chat-id]');
      for (var i = 0; i < chatItems.length; i++) {
        var item = chatItems[i];
        var cid = item.dataset.chatId;
        var count = getUnreadCount(cid);
        if (count <= 0) {
          item.style.display = 'none';
          item.dataset._filteredByUnread = 'true';
        }
      }
    });
    document.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-filter="all"], [data-chat-filter]');
      if (!chip) return;
      var hidden = document.querySelectorAll('[data-_filtered-by-unread="true"]');
      for (var i = 0; i < hidden.length; i++) {
        hidden[i].style.display = '';
        delete hidden[i].dataset._filteredByUnread;
      }
    });
  }

  function _autoScrollToUnread() {
    var chatId = (window.currentChat && window.currentChat.id)
      || (window.App && window.App.currentChat && window.App.currentChat.id);
    if (!chatId) return;
    var count = getUnreadCount(chatId);
    if (count > 0 && typeof window.scrollToUnread === 'function') {
      window.scrollToUnread(chatId);
    }
  }

  function _markVisibleMessagesRead() {
    var chatId = (window.currentChat && window.currentChat.id)
      || (window.App && window.App.currentChat && window.App.currentChat.id);
    if (!chatId) return;
    var messages = document.querySelectorAll('[data-message-id]');
    var lastVisibleId = null;
    for (var i = messages.length - 1; i >= 0; i--) {
      var rect = messages[i].getBoundingClientRect();
      if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
        lastVisibleId = messages[i].dataset.messageId;
        break;
      }
    }
    if (lastVisibleId && typeof window.markAsReadUpTo === 'function') {
      window.markAsReadUpTo(chatId, lastVisibleId);
    }
    clearUnread(chatId);
  }

  function _setupVisibilityAutoRead() {
    var readTimer = null;
    document.addEventListener('tc:chat:opened', function () {
      clearTimeout(readTimer);
      readTimer = setTimeout(_markVisibleMessagesRead, 1000);
    });
    window.addEventListener('scroll', App.throttle(function () {
      var chatId = (window.currentChat && window.currentChat.id)
        || (window.App && window.App.currentChat && window.App.currentChat.id);
      if (!chatId) return;
      var count = getUnreadCount(chatId);
      if (count <= 0) return;
      clearTimeout(readTimer);
      readTimer = setTimeout(_markVisibleMessagesRead, 1000);
    }, 500));
  }

  function _setupMutationObserver() {
    if (!('MutationObserver' in window)) return;
    var msgContainer = document.getElementById('messages') || document.getElementById('messageList')
      || document.querySelector('.messages-container') || document.querySelector('[data-messages]');
    if (!msgContainer) return;
    var mo = new MutationObserver(function () {
      var dividers = msgContainer.querySelectorAll('.tc-unread-divider:not([data-observed])');
      for (var i = 0; i < dividers.length; i++) {
        dividers[i].setAttribute('data-observed', 'true');
        if (_observer) _observer.observe(dividers[i]);
      }
    });
    mo.observe(msgContainer, { childList: true, subtree: true });
  }

  function init() {
    _ensureCss();
    _loadState();
    updateUnreadBadges();
    _setupBadgeListener();
    _setupChatListFilter();
    _setupVisibilityAutoRead();
    _syncUnreadFromFirestore();
    setTimeout(function () {
      setupUnreadObserver();
      _setupMutationObserver();
      _autoScrollToUnread();
    }, 500);
    if (window.App && typeof window.App.onReconnect === 'function') {
      window.App.onReconnect(function () {
        _syncUnreadFromFirestore();
        updateUnreadBadges();
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        _syncUnreadFromFirestore();
        updateUnreadBadges();
      }
    });
  }

  window.updateUnreadBadges = updateUnreadBadges;
  window.getUnreadCount = getUnreadCount;
  window.getTotalUnread = getTotalUnread;
  window.renderBadge = renderBadge;
  window.clearUnread = clearUnread;
  window.markAllAsRead = markAllAsRead;
  window.renderUnreadDivider = renderUnreadDivider;
  window.setupUnreadObserver = setupUnreadObserver;
  window.getUnreadBadgeColor = getUnreadBadgeColor;
  window.formatUnreadCount = formatUnreadCount;
  window.updateTabBadge = updateTabBadge;
  window.playUnreadSound = playUnreadSound;

  if (document.readyState === 'complete') setTimeout(init, 0);
  else window.addEventListener('load', function () { setTimeout(init, 0); });
})();
