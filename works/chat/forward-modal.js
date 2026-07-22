(function() {
  'use strict';

  let _modalEl = null;
  let _searchInput = null;
  let _chatListEl = null;
  let _selectedChats = new Map();
  let _forwardingMsgId = null;
  let _forwardingMsgIds = null;
  let _allChats = [];
  let _filteredChats = [];
  let _debounceTimer = null;
  let _isOpen = false;

  const NOTES_CHAT_NAME = 'My Notes';

  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };

  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  function _injectStyles() {
    if (document.getElementById('forward-modal-styles')) return;
    var style = document.createElement('style');
    style.id = 'forward-modal-styles';
    style.textContent = '\n' +
      '.forward-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99998;display:flex;align-items:flex-end;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.25s ease;}\n' +
      '.forward-modal-overlay.open{opacity:1;pointer-events:auto;}\n' +
      '.forward-modal-sheet{background:var(--surface-container,#1f2c34);width:100%;max-width:520px;max-height:85vh;border-radius:16px 16px 0 0;display:flex;flex-direction:column;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);overflow:hidden;}\n' +
      '@media(min-width:768px){.forward-modal-sheet{border-radius:16px;margin-bottom:20px;max-height:80vh;}}\n' +
      '.forward-modal-overlay.open .forward-modal-sheet{transform:translateY(0);}\n' +
      '.forward-modal-header{display:flex;align-items:center;padding:16px;border-bottom:1px solid var(--outline-variant,#313d45);gap:12px;}\n' +
      '.forward-modal-close{background:none;border:none;color:var(--on-surface-variant,#8696a0);font-size:22px;cursor:pointer;padding:4px 8px;border-radius:50%;min-width:48px;min-height:48px;display:flex;align-items:center;justify-content:center;}\n' +
      '.forward-modal-title{font-size:18px;font-weight:600;color:var(--on-surface,#e9edef);flex:1;}\n' +
      '.forward-modal-search{padding:8px 16px;border-bottom:1px solid var(--outline-variant,#313d45);}\n' +
      '.forward-modal-search input{width:100%;padding:10px 14px;border-radius:8px;border:none;background:var(--surface-container-high,#2a3942);color:var(--on-surface,#e9edef);font-size:15px;outline:none;}\n' +
      '.forward-modal-search input::placeholder{color:var(--on-surface-variant,#8696a0);}\n' +
      '.forward-modal-body{flex:1;overflow-y:auto;padding:4px 0;-webkit-overflow-scrolling:touch;}\n' +
      '.forward-chat-item{display:flex;align-items:center;padding:10px 16px;cursor:pointer;transition:background 0.15s;min-height:56px;gap:12px;}\n' +
      '.forward-chat-item:hover,.forward-chat-item:active{background:var(--surface-container-high,#2a3942);}\n' +
      '.forward-chat-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;background:var(--surface-container-highest,#2a3942);flex-shrink:0;}\n' +
      '.forward-chat-info{flex:1;min-width:0;}\n' +
      '.forward-chat-name{font-size:15px;font-weight:500;color:var(--on-surface,#e9edef);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n' +
      '.forward-chat-sub{font-size:12px;color:var(--on-surface-variant,#8696a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n' +
      '.forward-chat-check{width:22px;height:22px;border-radius:50%;border:2px solid var(--outline-variant,#313d45);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;}\n' +
      '.forward-chat-item.selected .forward-chat-check{background:var(--primary,#00a884);border-color:var(--primary,#00a884);}\n' +
      '.forward-chat-item.selected .forward-chat-check::after{content:"✓";color:white;font-size:13px;font-weight:700;}\n' +
      '.forward-status-btn{display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;transition:background 0.15s;border-top:1px solid var(--outline-variant,#313d45);min-height:56px;}\n' +
      '.forward-status-btn:hover,.forward-status-btn:active{background:var(--surface-container-high,#2a3942);}\n' +
      '.forward-status-icon{width:44px;height:44px;border-radius:50%;background:var(--primary,#00a884);display:flex;align-items:center;justify-content:center;color:white;font-size:20px;flex-shrink:0;}\n' +
      '.forward-fab{position:fixed;bottom:80px;right:24px;width:56px;height:56px;border-radius:50%;background:var(--primary,#00a884);color:white;border:none;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:pointer;z-index:99999;display:none;align-items:center;justify-content:center;transition:transform 0.2s;}\n' +
      '.forward-fab:active{transform:scale(0.92);}\n' +
      '.forward-fab.visible{display:flex;}\n' +
      '.forward-fab-count{position:absolute;top:-4px;right:-4px;background:#e74c3c;color:white;font-size:11px;font-weight:700;min-width:20px;height:20px;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:0 4px;}\n';
    document.head.appendChild(style);
  }

  function _buildModal() {
    if (_modalEl) return _modalEl;
    _modalEl = document.createElement('div');
    _modalEl.className = 'forward-modal-overlay';
    _modalEl.id = 'forward-modal-overlay';
    _modalEl.innerHTML = '\n' +
      '<div class="forward-modal-sheet" role="dialog" aria-label="Forward message">\n' +
      '  <div class="forward-modal-header">\n' +
      '    <button class="forward-modal-close" aria-label="Close">&times;</button>\n' +
      '    <span class="forward-modal-title">Forward to</span>\n' +
      '  </div>\n' +
      '  <div class="forward-modal-search">\n' +
      '    <input type="text" placeholder="Search chats..." aria-label="Search chats">\n' +
      '  </div>\n' +
      '  <div class="forward-modal-body"></div>\n' +
      '</div>';
    document.body.appendChild(_modalEl);

    _searchInput = _modalEl.querySelector('.forward-modal-search input');
    _chatListEl = _modalEl.querySelector('.forward-modal-body');

    _modalEl.querySelector('.forward-modal-close').addEventListener('click', function() {
      window.closeForwardModal();
    });
    _modalEl.addEventListener('click', function(e) {
      if (e.target === _modalEl) window.closeForwardModal();
    });
    _searchInput.addEventListener('input', function() {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(function() {
        _filterChats(_searchInput.value.trim().toLowerCase());
      }, 200);
    });

    return _modalEl;
  }

  function _buildNotesChatItem() {
    var el = document.createElement('div');
    el.className = 'forward-chat-item';
    el.setAttribute('role', 'option');
    el.dataset.chatId = '__notes__';
    el.innerHTML = '\n' +
      '<div class="forward-chat-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--primary,#00a884);color:white;font-size:20px;">📝</div>\n' +
      '<div class="forward-chat-info">\n' +
      '  <div class="forward-chat-name">' + _esc(NOTES_CHAT_NAME) + '</div>\n' +
      '  <div class="forward-chat-sub">Save for yourself</div>\n' +
      '</div>\n' +
      '<div class="forward-chat-check"></div>';
    el.addEventListener('click', function() {
      _toggleSelection(el, '__notes__');
    });
    return el;
  }

  function _buildStatusButton() {
    var el = document.createElement('div');
    el.className = 'forward-status-btn';
    el.innerHTML = '\n' +
      '<div class="forward-status-icon">⊙</div>\n' +
      '<div class="forward-chat-info">\n' +
      '  <div class="forward-chat-name">Share as Status</div>\n' +
      '  <div class="forward-chat-sub">Set as your status update</div>\n' +
      '</div>';
    el.addEventListener('click', function() {
      _shareAsStatus();
    });
    return el;
  }

  function _buildChatItem(chat) {
    var el = document.createElement('div');
    el.className = 'forward-chat-item';
    el.setAttribute('role', 'option');
    el.dataset.chatId = chat.id;
    el.dataset.chatName = (chat.name || '').toLowerCase();
    var avatarSrc = chat.avatar || chat.photoURL || '';
    var avatarHtml = avatarSrc
      ? '<img class="forward-chat-avatar" src="' + _esc(avatarSrc) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
      : '';
    var fallbackHtml = '<div class="forward-chat-avatar" style="display:flex;align-items:center;justify-content:center;font-size:18px;">' + _esc((chat.name || '?')[0].toUpperCase()) + '</div>';
    el.innerHTML = '\n' +
      (avatarSrc ? '<div style="position:relative">' + avatarHtml + fallbackHtml + '</div>' : fallbackHtml) +
      '<div class="forward-chat-info">\n' +
      '  <div class="forward-chat-name">' + _esc(chat.name || 'Unknown') + '</div>\n' +
      '  <div class="forward-chat-sub">' + _esc(chat.lastMessage || '') + '</div>\n' +
      '</div>\n' +
      '<div class="forward-chat-check"></div>';
    el.addEventListener('click', function() {
      _toggleSelection(el, chat.id);
    });
    return el;
  }

  function _toggleSelection(el, chatId) {
    if (_selectedChats.has(chatId)) {
      _selectedChats.delete(chatId);
      el.classList.remove('selected');
    } else {
      _selectedChats.set(chatId, true);
      el.classList.add('selected');
    }
    _updateFab();
  }

  function _updateFab() {
    var fab = document.getElementById('forward-fab');
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'forward-fab';
      fab.className = 'forward-fab';
      fab.innerHTML = '➤<span class="forward-fab-count"></span>';
      fab.addEventListener('click', function() {
        _executeForward();
      });
      document.body.appendChild(fab);
    }
    var count = _selectedChats.size;
    var countEl = fab.querySelector('.forward-fab-count');
    if (count > 0) {
      fab.classList.add('visible');
      countEl.textContent = count;
      countEl.style.display = 'flex';
    } else {
      fab.classList.remove('visible');
      countEl.style.display = 'none';
    }
  }

  function _filterChats(term) {
    if (!_chatListEl) return;
    var items = _chatListEl.querySelectorAll('.forward-chat-item');
    for (var i = 0; i < items.length; i++) {
      var name = items[i].dataset.chatName || '';
      if (!term || name.indexOf(term) !== -1) {
        items[i].style.display = '';
      } else {
        items[i].style.display = 'none';
      }
    }
  }

  function _loadChats() {
    _allChats = [];
    var chatListContainer = document.getElementById('chat-list');
    if (chatListContainer) {
      var items = chatListContainer.querySelectorAll('.chat-list-item, [data-chat-id]');
      for (var i = 0; i < items.length; i++) {
        var cid = items[i].dataset.chatId;
        if (!cid) continue;
        var nameEl = items[i].querySelector('.chat-name, .chat-list-name, [class*="name"]');
        var name = nameEl ? nameEl.textContent.trim() : cid;
        var avatarEl = items[i].querySelector('img');
        var avatar = avatarEl ? avatarEl.src : '';
        _allChats.push({ id: cid, name: name, avatar: avatar, lastMessage: '' });
      }
    }
    if (_allChats.length === 0 && typeof allUsers !== 'undefined' && Array.isArray(allUsers)) {
      var curUid = _uid();
      for (var j = 0; j < allUsers.length; j++) {
        var u = allUsers[j];
        if (u.uid === curUid) continue;
        _allChats.push({
          id: u.uid,
          name: u.displayName || u.email || 'Unknown',
          avatar: u.photoURL || '',
          lastMessage: ''
        });
      }
    }
    _allChats = _allChats.slice(0, 100);
  }

  async function _executeForward() {
    if (_selectedChats.size === 0 || (!_forwardingMsgId && !_forwardingMsgIds)) return;
    var uid = _uid();
    if (!uid) return;
    var targetIds = Array.from(_selectedChats.keys());
    var msgIds = _forwardingMsgIds && _forwardingMsgIds.length ? _forwardingMsgIds : [_forwardingMsgId];
    var sourceMsgs = [];
    if (typeof currentChat !== 'undefined' && currentChat && typeof window.App !== 'undefined' && window.App.messages) {
      var msgs = window.App.messages[currentChat.id] || [];
      for (var m = 0; m < msgIds.length; m++) {
        var found = false;
        for (var i = 0; i < msgs.length; i++) {
          if (msgs[i].id === msgIds[m]) {
            sourceMsgs.push(msgs[i]);
            found = true;
            break;
          }
        }
        if (!found) {
          sourceMsgs.push({ id: msgIds[m], text: '', type: 'forwarded', timestamp: Date.now(), senderId: uid, forwardedFrom: msgIds[m] });
        }
      }
    } else {
      for (var m2 = 0; m2 < msgIds.length; m2++) {
        sourceMsgs.push({ id: msgIds[m2], text: '', type: 'forwarded', timestamp: Date.now(), senderId: uid, forwardedFrom: msgIds[m2] });
      }
    }
    var chatNames = targetIds.map(function(id) {
      if (id === '__notes__') return 'My Notes';
      var chat = _allChats.find(function(c) { return c.id === id; });
      return chat ? chat.name : id;
    });
    var confirmMsg = 'Forward to ' + chatNames.join(', ') + '?';
    if (targetIds.length > 3) confirmMsg = 'Forward to ' + targetIds.length + ' chats?';
    var confirmed = true;
    if (typeof window.confirm === 'function' && targetIds.length > 1) {
      confirmed = window.confirm(confirmMsg);
    }
    if (!confirmed) return;
    var promises = [];
    for (var j = 0; j < targetIds.length; j++) {
      var targetId = targetIds[j];
      for (var k = 0; k < sourceMsgs.length; k++) {
        if (targetId === '__notes__') {
          promises.push(_forwardToNotes(sourceMsgs[k]));
        } else {
          promises.push(_forwardToChat(targetId, sourceMsgs[k]));
        }
      }
    }
    try {
      await Promise.all(promises);
      if (typeof showToast === 'function') showToast('Message' + (msgIds.length > 1 ? 's' : '') + ' forwarded to ' + targetIds.length + ' chat' + (targetIds.length > 1 ? 's' : ''), 'success');
    } catch (e) {
      console.error('[Forward] Error:', e);
      if (typeof showToast === 'function') showToast('Failed to forward message', 'error');
    }
    window.closeForwardModal();
  }

  async function _forwardToChat(chatId, msg) {
    var uid = _uid();
    if (!uid) return;
    var chatRef = db.collection('chats').doc(chatId).collection('messages').doc();
    await chatRef.set({
      text: msg.text || '',
      type: msg.type || 'text',
      attachment: msg.attachment || null,
      senderId: uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      clientId: 'fwd-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      forwardedFrom: msg.forwardedFrom || msg.id || null,
      isForwarded: true
    });
    var chatDocRef = db.collection('chats').doc(chatId);
    await chatDocRef.set({
      lastMessage: msg.text || '[Forwarded message]',
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessageSenderId: uid
    }, { merge: true });
  }

  async function _forwardToNotes(msg) {
    var uid = _uid();
    if (!uid) return;
    var savedRef = db.collection('users').doc(uid).collection('savedMessages').doc();
    await savedRef.set({
      text: msg.text || '',
      type: msg.type || 'text',
      attachment: msg.attachment || null,
      senderId: uid,
      timestamp: Date.now(),
      savedAt: Date.now(),
      isForwarded: true,
      originalChatId: (typeof currentChat !== 'undefined' && currentChat) ? currentChat.id : null,
      originalChatName: NOTES_CHAT_NAME
    });
    if (typeof showToast === 'function') showToast('Saved to My Notes', 'success');
  }

  async function _shareAsStatus() {
    var msgText = '';
    if (_forwardingMsgId && typeof window.App !== 'undefined' && window.App.messages && typeof currentChat !== 'undefined' && currentChat) {
      var msgs = window.App.messages[currentChat.id] || [];
      for (var i = 0; i < msgs.length; i++) {
        if (msgs[i].id === _forwardingMsgId) {
          msgText = msgs[i].text || '';
          break;
        }
      }
    }
    window.closeForwardModal();
    if (typeof openStatusComposer === 'function') {
      openStatusComposer(msgText);
    } else if (typeof switchTab === 'function') {
      switchTab('status');
    }
  }

  window.openForwardModal = function(msgId) {
    if (!msgId) return;
    _forwardingMsgId = msgId;
    _forwardingMsgIds = null;
    _selectedChats.clear();
    _isOpen = true;
    _buildModal();
    _loadChats();
    _renderChatList();
    var titleEl = _modalEl && _modalEl.querySelector('.forward-modal-title');
    if (titleEl) titleEl.textContent = 'Forward to';
    requestAnimationFrame(function() {
      _modalEl.classList.add('open');
      _searchInput.focus();
    });
  };

  window.openForwardModalMultiple = function(msgIds) {
    if (!msgIds || !msgIds.length) return;
    _forwardingMsgId = msgIds[0];
    _forwardingMsgIds = msgIds.slice();
    _selectedChats.clear();
    _isOpen = true;
    _buildModal();
    _loadChats();
    _renderChatList();
    var titleEl = _modalEl && _modalEl.querySelector('.forward-modal-title');
    if (titleEl) titleEl.textContent = 'Forward ' + msgIds.length + ' messages to';
    requestAnimationFrame(function() {
      _modalEl.classList.add('open');
      _searchInput.focus();
    });
  };

  window.openForwardModalForMedia = function(msgId) {
    window.openForwardModal(msgId);
  };

  window.closeForwardModal = function() {
    _isOpen = false;
    if (_modalEl) _modalEl.classList.remove('open');
    _selectedChats.clear();
    _forwardingMsgId = null;
    _forwardingMsgIds = null;
    if (_searchInput) _searchInput.value = '';
    var fab = document.getElementById('forward-fab');
    if (fab) fab.classList.remove('visible');
  };

  function _renderChatList() {
    if (!_chatListEl) return;
    _chatListEl.innerHTML = '';
    _chatListEl.appendChild(_buildNotesChatItem());
    for (var i = 0; i < _allChats.length; i++) {
      _chatListEl.appendChild(_buildChatItem(_allChats[i]));
    }
    _chatListEl.appendChild(_buildStatusButton());
    _filterChats((_searchInput && _searchInput.value || '').trim().toLowerCase());
  }

  function _init() {
    _injectStyles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
