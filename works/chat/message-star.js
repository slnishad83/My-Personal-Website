// message-star.js — WhatsApp-style message starring with starred messages panel
(function() {
  'use strict';

  var _db = function() { return window.App && window.App.db ? window.App.db : null; };
  var _uid = function() { return window.App && window.App.auth && window.App.auth.currentUser ? window.App.auth.currentUser.uid : null; };
  var _esc = function(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') : ''; };
  var _toast = function(msg, t) { if (typeof window.showToast === 'function') window.showToast(msg, t); };

  function _msgTime(msg) {
    if (!msg) return 0;
    if (msg.timestamp && typeof msg.timestamp === 'object' && msg.timestamp.toMillis) return msg.timestamp.toMillis();
    if (msg.time) return typeof msg.time === 'number' ? msg.time : 0;
    if (msg.createdAt) return typeof msg.createdAt === 'number' ? msg.createdAt : 0;
    return 0;
  }

  function _chatName(chatId) {
    if (window.App && window.App.chats && window.App.chats[chatId]) {
      var c = window.App.chats[chatId];
      return c.name || c.groupName || c.displayName || 'Chat';
    }
    return 'Chat';
  }

  function isStarred(msg) {
    return !!(msg && msg.starred);
  }

  function starMessage(msgId, chatId) {
    var db = _db();
    var cid = chatId || (window.App && window.App.currentChat ? window.App.currentChat.id : null);
    if (!db || !cid || !msgId) return;
    var msgRef = db.collection('messages').doc(cid).collection('items').doc(msgId);
    msgRef.get().then(function(doc) {
      if (!doc.exists) return;
      var data = doc.data();
      var nowStarred = !data.starred;
      return msgRef.update({
        starred: nowStarred,
        starredAt: nowStarred ? firebase.firestore.FieldValue.serverTimestamp() : firebase.firestore.FieldValue.delete(),
        starredBy: nowStarred ? _uid() : firebase.firestore.FieldValue.delete()
      }).then(function() {
        _toast(nowStarred ? 'Message starred' : 'Message unstarred', 'success');
        addStarIcon();
      });
    }).catch(function() {
      _toast('Failed to update star', 'error');
    });
  }

  function unstarMessage(msgId, chatId) {
    var db = _db();
    var cid = chatId || (window.App && window.App.currentChat ? window.App.currentChat.id : null);
    if (!db || !cid || !msgId) return;
    var msgRef = db.collection('messages').doc(cid).collection('items').doc(msgId);
    msgRef.update({
      starred: false,
      starredAt: firebase.firestore.FieldValue.delete(),
      starredBy: firebase.firestore.FieldValue.delete()
    }).then(function() {
      _toast('Message unstarred', 'success');
      addStarIcon();
    }).catch(function() {
      _toast('Failed to unstar', 'error');
    });
  }

  function toggleStar(msgId, chatId) {
    starMessage(msgId, chatId);
  }

  function getStarredMessages() {
    var db = _db();
    var uid = _uid();
    if (!db || !uid) return Promise.resolve([]);
    var allChats = window.App && window.App.chats ? Object.keys(window.App.chats) : [];
    var promises = allChats.map(function(chatId) {
      return db.collection('messages').doc(chatId).collection('items')
        .where('starred', '==', true)
        .orderBy('starredAt', 'desc')
        .limit(50)
        .get()
        .then(function(snap) {
          var results = [];
          snap.forEach(function(doc) {
            var data = doc.data();
            data.id = doc.id;
            data._chatId = chatId;
            data._chatName = _chatName(chatId);
            results.push(data);
          });
          return results;
        })
        .catch(function() { return []; });
    });
    return Promise.all(promises).then(function(arrays) {
      var all = [];
      arrays.forEach(function(arr) { all = all.concat(arr); });
      all.sort(function(a, b) {
        var ta = _msgTime(a), tb = _msgTime(b);
        return tb - ta;
      });
      return all;
    });
  }

  function renderStarredPanel() {
    var existing = document.getElementById('starred-messages-panel');
    if (existing) existing.remove();

    var panel = document.createElement('div');
    panel.id = 'starred-messages-panel';
    panel.style.cssText = 'position:fixed;inset:0;z-index:9998;background:var(--surface,#fff);display:flex;flex-direction:column;animation:fadeIn 0.15s ease';

    panel.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08));background:var(--surface,#fff)">' +
        '<button id="starred-close-btn" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--on-surface,#000);display:flex;align-items:center">' +
          '<span class="material-symbols-outlined">arrow_back</span>' +
        '</button>' +
        '<div style="flex:1">' +
          '<div style="font-size:18px;font-weight:700;color:var(--on-surface,#000)">Starred Messages</div>' +
        '</div>' +
        '<button id="starred-search-toggle" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--on-surface-variant,#667781);display:flex;align-items:center">' +
          '<span class="material-symbols-outlined">search</span>' +
        '</button>' +
      '</div>' +
      '<div id="starred-search-bar" style="display:none;padding:8px 16px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08))">' +
        '<input id="starred-search-input" type="text" placeholder="Search starred messages..." style="width:100%;padding:10px 12px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;box-sizing:border-box;background:var(--surface-container-low,#f5f5f5);color:var(--on-surface,#000)">' +
      '</div>' +
      '<div id="starred-list" style="flex:1;overflow-y:auto;padding:8px 0"></div>';

    document.body.appendChild(panel);

    document.getElementById('starred-close-btn').addEventListener('click', function() { panel.remove(); });

    var searchBar = document.getElementById('starred-search-bar');
    var searchInput = document.getElementById('starred-search-input');
    document.getElementById('starred-search-toggle').addEventListener('click', function() {
      var visible = searchBar.style.display !== 'none';
      searchBar.style.display = visible ? 'none' : 'block';
      if (!visible) searchInput.focus();
    });

    var listEl = document.getElementById('starred-list');
    listEl.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--on-surface-variant,#667781)"><span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:12px;opacity:0.4">star</span>Loading starred messages...</div>';

    getStarredMessages().then(function(messages) {
      _renderStarredList(listEl, messages);
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          var q = searchInput.value.toLowerCase().trim();
          if (!q) { _renderStarredList(listEl, messages); return; }
          var filtered = messages.filter(function(m) {
            return (m.text || '').toLowerCase().indexOf(q) !== -1 || (m.fromName || m.senderName || '').toLowerCase().indexOf(q) !== -1 || (m._chatName || '').toLowerCase().indexOf(q) !== -1;
          });
          _renderStarredList(listEl, filtered);
        });
      }
    });
  }

  function _renderStarredList(container, messages) {
    if (!messages || messages.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--on-surface-variant,#667781)"><span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:12px;opacity:0.4">star</span>No starred messages</div>';
      return;
    }

    var html = '';
    messages.forEach(function(msg) {
      var t = _msgTime(msg);
      var timeStr = t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      var sender = msg.fromName || msg.senderName || msg.senderEmail || 'Unknown';
      var text = msg.text || '';
      if (text.length > 120) text = text.substring(0, 117) + '...';
      var chatLabel = msg._chatName || '';
      var typeIcon = '';
      var mtype = msg.type || 'text';
      if (mtype === 'image') typeIcon = '<span class="material-symbols-outlined" style="font-size:14px;opacity:0.6">image</span> ';
      else if (mtype === 'video') typeIcon = '<span class="material-symbols-outlined" style="font-size:14px;opacity:0.6">videocam</span> ';
      else if (mtype === 'audio' || mtype === 'voice') typeIcon = '<span class="material-symbols-outlined" style="font-size:14px;opacity:0.6">mic</span> ';
      else if (mtype === 'doc') typeIcon = '<span class="material-symbols-outlined" style="font-size:14px;opacity:0.6">description</span> ';
      else if (mtype === 'location') typeIcon = '<span class="material-symbols-outlined" style="font-size:14px;opacity:0.6">location_on</span> ';

      html += '<div class="starred-msg-item" data-msg-id="' + _esc(msg.id) + '" data-chat-id="' + _esc(msg._chatId) + '" style="padding:12px 16px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.06));cursor:pointer;transition:background 0.15s">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
          '<span class="material-symbols-outlined" style="font-size:14px;color:#f5a623">star</span>' +
          '<span style="font-size:12px;font-weight:600;color:var(--on-surface,#000)">' + _esc(sender) + '</span>' +
          '<span style="font-size:11px;color:var(--on-surface-variant,#667781);margin-left:auto">' + _esc(timeStr) + '</span>' +
        '</div>' +
        '<div style="font-size:13px;color:var(--on-surface-variant,#3b4a54);line-height:1.4;margin-bottom:4px">' + typeIcon + _esc(text) + '</div>' +
        '<div style="font-size:11px;color:var(--on-surface-variant,#667781);display:flex;align-items:center;gap:4px">' +
          '<span class="material-symbols-outlined" style="font-size:12px">chat</span>' +
          '<span>' + _esc(chatLabel) + '</span>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.starred-msg-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var chatId = item.getAttribute('data-chat-id');
        var msgId = item.getAttribute('data-msg-id');
        if (!chatId || !msgId) return;
        var panel = document.getElementById('starred-messages-panel');
        if (panel) panel.remove();
        if (window.App && typeof window.App.openChat === 'function') {
          window.App.openChat(chatId);
        } else if (window.location) {
          window.location.hash = '#chat:' + chatId;
        }
        setTimeout(function() {
          var el = document.querySelector('[data-message-id="' + msgId + '"]');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
            el.style.boxShadow = '0 0 0 3px var(--primary, #f5a623)';
            el.style.borderRadius = '12px';
            el.style.transform = 'scale(1.02)';
            setTimeout(function() { el.style.boxShadow = ''; el.style.transform = ''; }, 2000);
          }
        }, 600);
      });
      item.addEventListener('mouseenter', function() { item.style.background = 'var(--surface-container-low,#f5f5f5)'; });
      item.addEventListener('mouseleave', function() { item.style.background = 'transparent'; });
    });
  }

  function addStarIcon() {
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) return;
    container.querySelectorAll('[data-message-id]').forEach(function(el) {
      var msgId = el.getAttribute('data-message-id');
      if (!msgId || el.dataset.starIconAdded === '1') return;
      var db = _db();
      var chatId = window.App && window.App.currentChat ? window.App.currentChat.id : null;
      if (!db || !chatId) return;
      db.collection('messages').doc(chatId).collection('items').doc(msgId).get().then(function(doc) {
        if (!doc.exists) return;
        var data = doc.data();
        el.dataset.starIconAdded = '1';
        var existingStar = el.querySelector('.nsl-star-icon');
        if (data.starred && !existingStar) {
          var timeEl = el.querySelector('.msg-time, .message-time, [class*="time"], [class*="timestamp"]');
          if (timeEl) {
            var star = document.createElement('span');
            star.className = 'nsl-star-icon';
            star.style.cssText = 'color:#f5a623;margin-left:4px;vertical-align:middle;display:inline-flex;align-items:center';
            star.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">star</span>';
            timeEl.appendChild(star);
          }
        } else if (!data.starred && existingStar) {
          existingStar.remove();
        }
      }).catch(function() {});
    });
  }

  function _patchContextMenu() {
    if (window._starCtxPatched) return;
    document.addEventListener('click', function(e) {
      var starBtn = e.target.closest('[data-action="star-msg"], [data-ctx-star]');
      if (!starBtn) return;
      e.preventDefault();
      e.stopPropagation();
      var msgId = starBtn.dataset.msgId || starBtn.getAttribute('data-msg-id') || '';
      if (!msgId) {
        var msgEl = starBtn.closest('[data-message-id]');
        if (msgEl) msgId = msgEl.getAttribute('data-message-id');
      }
      if (msgId) {
        var existing = document.getElementById('msg-ctx-menu');
        if (existing) existing.remove();
        var chatId = window.App && window.App.currentChat ? window.App.currentChat.id : null;
        toggleStar(msgId, chatId);
      }
    }, true);
    window._starCtxPatched = true;
  }

  function _patchDesktopContextMenu() {
    if (window._starDesktopCtxPatched) return;
    document.addEventListener('contextmenu', function(e) {
      var msgEl = e.target.closest('[data-message-id]');
      if (!msgEl) return;
      var msgId = msgEl.getAttribute('data-message-id');
      if (!msgId) return;
      setTimeout(function() {
        var menu = document.getElementById('msg-ctx-menu');
        if (!menu) return;
        var chatId = window.App && window.App.currentChat ? window.App.currentChat.id : null;
        if (!chatId) return;
        var db = _db();
        if (!db) return;
        db.collection('messages').doc(chatId).collection('items').doc(msgId).get().then(function(doc) {
          if (!doc.exists) return;
          var data = doc.data();
          var starred = data.starred;
          var existingStarBtn = menu.querySelector('[data-action="star-msg"]');
          if (existingStarBtn) {
            var icon = existingStarBtn.querySelector('.material-symbols-outlined');
            var label = existingStarBtn.querySelector('.text-sm, span:last-child');
            if (icon) icon.textContent = starred ? 'star' : 'star_border';
          }
        });
      }, 50);
    }, true);
    window._starDesktopCtxPatched = true;
  }

  function _patchTouchContextMenu() {
    if (window._starTouchCtxPatched) return;
    var touchTimer = null;
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) {
      setTimeout(_patchTouchContextMenu, 1000);
      return;
    }
    container.addEventListener('touchstart', function(e) {
      var msgEl = e.target.closest('[data-message-id]');
      if (!msgEl) return;
      var msgId = msgEl.getAttribute('data-message-id');
      touchTimer = setTimeout(function() {
        var chatId = window.App && window.App.currentChat ? window.App.currentChat.id : null;
        if (!chatId) return;
        var db = _db();
        if (!db) return;
        db.collection('messages').doc(chatId).collection('items').doc(msgId).get().then(function(doc) {
          if (!doc.exists) return;
          var data = doc.data();
          var starred = data.starred;
          setTimeout(function() {
            var menu = document.getElementById('msg-ctx-menu');
            if (!menu) return;
            var existingStarBtn = menu.querySelector('[data-action="star-msg"]');
            if (existingStarBtn) {
              var icon = existingStarBtn.querySelector('.material-symbols-outlined');
              var label = existingStarBtn.querySelector('.text-sm, span:last-child');
              if (icon) icon.textContent = starred ? 'star' : 'star_border';
              if (label) label.textContent = starred ? 'Unstar' : 'Star';
              return;
            }
            var starHtml = '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" data-action="star-msg" data-msg-id="' + _esc(msgId) + '">' +
              '<span class="material-symbols-outlined text-lg" style="' + (starred ? 'color:#f5a623' : '') + '">' + (starred ? 'star' : 'star_border') + '</span>' +
              '<span class="text-sm">' + (starred ? 'Unstar' : 'Star') + '</span></button>';
            var deleteBtn = menu.querySelector('[data-action="delete"], button[onclick*="delete"]');
            if (deleteBtn) deleteBtn.insertAdjacentHTML('beforebegin', starHtml);
          }, 100);
        });
      }, 500);
    }, { passive: true });
    container.addEventListener('touchend', function() { clearTimeout(touchTimer); }, { passive: true });
    container.addEventListener('touchmove', function() { clearTimeout(touchTimer); }, { passive: true });
    window._starTouchCtxPatched = true;
  }

  function _patchMessageActions() {
    if (window._starMsgActionsPatched) return;
    var orig = window._MsgActions;
    if (orig && typeof orig === 'object' && typeof orig.star !== 'function') {
      orig.star = function(msgId) {
        var chatId = window.App && window.App.currentChat ? window.App.currentChat.id : null;
        if (!chatId) return;
        toggleStar(msgId, chatId);
      };
    }
    window._starMsgActionsPatched = true;
  }

  function _patchRenderMessages() {
    if (window._starRenderPatched) return;
    var origRender = window.renderSingleMessageHTML;
    if (typeof origRender === 'function') {
      window._origStarRender = origRender;
      window.renderSingleMessageHTML = function(msg) {
        var html = origRender(msg);
        if (!html || !msg) return html;
        if (!msg.starred) return html;
        var timePattern = /(<span[^>]*class="[^"]*(?:msg-time|message-time|time|timestamp)[^"]*"[^>]*>)([\s\S]*?)(<\/span>)/i;
        var match = html.match(timePattern);
        if (match) {
          var starTag = '<span class="nsl-star-icon" style="color:#f5a623;margin-left:4px;vertical-align:middle;display:inline-flex;align-items:center"><span class="material-symbols-outlined" style="font-size:14px">star</span></span>';
          html = html.replace(match[0], match[1] + match[2] + starTag + match[3]);
        }
        return html;
      };
    }
    window._starRenderPatched = true;
  }

  var _starObserver = null;

  function _wireObserver() {
    if (typeof MutationObserver === 'undefined') return;
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) { setTimeout(_wireObserver, 1000); return; }
    if (_starObserver) { _starObserver.disconnect(); _starObserver = null; }
    _starObserver = new MutationObserver(function() { addStarIcon(); });
    _starObserver.observe(container, { childList: true, subtree: true });
  }

  function _init() {
    _patchContextMenu();
    _patchDesktopContextMenu();
    _patchTouchContextMenu();
    _patchMessageActions();
    _patchRenderMessages();
    _wireObserver();
    setTimeout(addStarIcon, 500);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(_init, 0);
  } else {
    window.addEventListener('load', function() { setTimeout(_init, 0); });
  }

  window.MessageStar = {
    starMessage: starMessage,
    unstarMessage: unstarMessage,
    toggleStar: toggleStar,
    isStarred: isStarred,
    getStarredMessages: getStarredMessages,
    renderStarredPanel: renderStarredPanel,
    addStarIcon: addStarIcon
  };
})();
