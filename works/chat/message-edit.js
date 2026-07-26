// message-edit.js — WhatsApp-style message editing (15-minute window)
(function() {
  'use strict';

  var EDIT_WINDOW_MS = 15 * 60 * 1000;
  var _editingMsgId = null;
  var _editingChatId = null;

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

  function _isOwn(msg) {
    var myUid = _uid();
    if (!myUid) return false;
    return msg.from === myUid || msg.senderId === myUid;
  }

  function canEdit(msg) {
    if (!msg) return false;
    if (!_isOwn(msg)) return false;
    if (msg.type === 'deleted' || msg.type === 'sticker' || msg.type === 'image' || msg.type === 'video' || msg.type === 'audio' || msg.type === 'voice' || msg.type === 'videoNote' || msg.type === 'doc' || msg.type === 'location' || msg.type === 'contact' || msg.type === 'poll') return false;
    var t = _msgTime(msg);
    if (!t) return false;
    return (Date.now() - t) < EDIT_WINDOW_MS;
  }

  function startEdit(msgId, chatId) {
    if (!msgId) return;
    var cid = chatId || (window.App && window.App.currentChat ? window.App.currentChat.id : null);
    if (!cid) return;
    var db = _db();
    if (!db) return;

    db.collection('messages').doc(cid).collection('items').doc(msgId).get().then(function(doc) {
      if (!doc.exists) return;
      var msg = doc.data();
      msg.id = doc.id;
      if (!canEdit(msg)) { _toast('Cannot edit this message', 'error'); return; }

      _editingMsgId = msgId;
      _editingChatId = cid;

      var input = document.getElementById('messageInput') || document.querySelector('textarea[placeholder*="Message"], input[placeholder*="Message"], #chatInput');
      if (input) {
        input.value = msg.text || '';
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }

      _showEditBanner();
      _attachInputListeners();
    }).catch(function() {
      _toast('Failed to load message', 'error');
    });
  }

  function cancelEdit() {
    _editingMsgId = null;
    _editingChatId = null;
    _hideEditBanner();
    _removeInputListeners();
    var input = document.getElementById('messageInput') || document.querySelector('textarea[placeholder*="Message"], input[placeholder*="Message"], #chatInput');
    if (input) input.value = '';
  }

  function submitEdit() {
    if (!_editingMsgId || !_editingChatId) return;
    var db = _db();
    if (!db) return;

    var input = document.getElementById('messageInput') || document.querySelector('textarea[placeholder*="Message"], input[placeholder*="Message"], #chatInput');
    var newText = input ? input.value.trim() : '';
    if (!newText) { _toast('Message cannot be empty', 'error'); cancelEdit(); return; }

    var msgRef = db.collection('messages').doc(_editingChatId).collection('items').doc(_editingMsgId);
    msgRef.get().then(function(doc) {
      if (!doc.exists) { _toast('Message no longer exists', 'error'); cancelEdit(); return; }
      var oldText = doc.data().text || '';
      if (oldText === newText) { cancelEdit(); return; }

      return msgRef.update({
        text: newText,
        edited: true,
        editedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function() {
        _toast('Message edited', 'success');
        cancelEdit();
      });
    }).catch(function(err) {
      console.error('Edit error:', err);
      _toast('Failed to edit message', 'error');
    });
  }

  function _showEditBanner() {
    _hideEditBanner();
    var inputArea = document.getElementById('chatFooter') || document.getElementById('inputArea') || document.querySelector('.chat-input-area, .input-container, [class*="input-bar"], [class*="composer"]');
    if (!inputArea) return;

    var banner = document.createElement('div');
    banner.id = 'edit-banner';
    banner.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--primary-container,rgba(0,168,132,0.12));border-top:2px solid var(--primary,#00a884);font-size:13px;color:var(--on-surface,#000);animation:fadeIn 0.15s ease';
    banner.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;color:var(--primary,#00a884)">edit</span>' +
      '<span style="flex:1;font-weight:500">Editing message</span>' +
      '<button id="edit-cancel-btn" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--on-surface-variant,#667781);display:flex;align-items:center">' +
      '<span class="material-symbols-outlined" style="font-size:18px">close</span></button>';

    inputArea.insertBefore(banner, inputArea.firstChild);
    document.getElementById('edit-cancel-btn').addEventListener('click', cancelEdit);
  }

  function _hideEditBanner() {
    var banner = document.getElementById('edit-banner');
    if (banner) banner.remove();
  }

  var _inputKeyHandler = null;
  var _inputInputHandler = null;
  var _listenersAttached = false;

  function _attachInputListeners() {
    if (_listenersAttached) return;
    var input = document.getElementById('messageInput') || document.querySelector('textarea[placeholder*="Message"], input[placeholder*="Message"], #chatInput');
    if (!input) return;
    _listenersAttached = true;

    _inputKeyHandler = function(e) {
      if (!_editingMsgId) return;
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitEdit();
      }
    };
    input.addEventListener('keydown', _inputKeyHandler);

    _inputInputHandler = function() {
      if (!_editingMsgId) return;
      var banner = document.getElementById('edit-banner');
      if (!banner) _showEditBanner();
    };
    input.addEventListener('input', _inputInputHandler);
  }

  function _removeInputListeners() {
    if (!_listenersAttached) return;
    var input = document.getElementById('messageInput') || document.querySelector('textarea[placeholder*="Message"], input[placeholder*="Message"], #chatInput');
    if (input) {
      if (_inputKeyHandler) input.removeEventListener('keydown', _inputKeyHandler);
      if (_inputInputHandler) input.removeEventListener('input', _inputInputHandler);
    }
    _inputKeyHandler = null;
    _inputInputHandler = null;
    _listenersAttached = false;
  }

  function injectEditLabel() {
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) return;
    container.querySelectorAll('[data-message-id]').forEach(function(el) {
      var msgId = el.getAttribute('data-message-id');
      if (!msgId || el.dataset.editLabeled === '1') return;
      var db = _db();
      var chatId = window.App && window.App.currentChat ? window.App.currentChat.id : null;
      if (!db || !chatId) return;
      db.collection('messages').doc(chatId).collection('items').doc(msgId).get().then(function(doc) {
        if (!doc.exists) return;
        var data = doc.data();
        if (!data.edited) return;
        el.dataset.editLabeled = '1';
        var timeEl = el.querySelector('.msg-time, .message-time, [class*="time"], [class*="timestamp"]');
        if (!timeEl) return;
        if (timeEl.querySelector('.nsl-edited-label')) return;
        var label = document.createElement('span');
        label.className = 'nsl-edited-label';
        label.style.cssText = 'font-size:11px;font-weight:400;opacity:0.7;font-style:italic;margin-left:2px';
        label.textContent = ' (edited)';
        timeEl.appendChild(label);
      }).catch(function() {});
    });
  }

  function _patchContextMenu() {
    if (window._editCtxPatched) return;
    var orig = window._MsgActions;
    if (orig && typeof orig === 'object' && typeof orig.edit !== 'function') {
      orig.edit = function(msgId) {
        var chatId = window.App && window.App.currentChat ? window.App.currentChat.id : null;
        if (!chatId) return;
        startEdit(msgId, chatId);
      };
    }
    document.addEventListener('click', function(e) {
      var editBtn = e.target.closest('[data-action="edit-msg"], [data-ctx-edit]');
      if (!editBtn) return;
      e.preventDefault();
      e.stopPropagation();
      var msgId = editBtn.dataset.msgId || editBtn.getAttribute('data-msg-id') || '';
      if (!msgId) {
        var msgEl = editBtn.closest('[data-message-id]');
        if (msgEl) msgId = msgEl.getAttribute('data-message-id');
      }
      if (msgId) {
        var existing = document.getElementById('msg-ctx-menu');
        if (existing) existing.remove();
        startEdit(msgId);
      }
    }, true);
    window._editCtxPatched = true;
  }

  function _patchDesktopContextMenu() {
    if (window._editDesktopCtxPatched) return;
    var origCtxHandler = null;
    if (window._MsgActions && typeof window._MsgActions === 'object') {
      origCtxHandler = window._MsgActions;
    }

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
          var msg = doc.data();
          msg.id = doc.id;
          if (!canEdit(msg)) return;
          var existingEditBtn = menu.querySelector('[data-action="edit-msg"]');
          if (existingEditBtn) return;
          var deleteBtn = menu.querySelector('[data-action="delete"], button[onclick*="delete"]');
          var editHtml = '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" data-action="edit-msg" data-msg-id="' + _esc(msgId) + '"><span class="material-symbols-outlined text-lg">edit</span><span class="text-sm">Edit</span></button>';
          if (deleteBtn) {
            deleteBtn.insertAdjacentHTML('beforebegin', editHtml);
          } else {
            menu.querySelector('div').insertAdjacentHTML('beforeend', editHtml);
          }
        });
      }, 50);
    }, true);
    window._editDesktopCtxPatched = true;
  }

  function _patchRenderMessages() {
    if (window._editRenderPatched) return;
    var origRender = window.renderSingleMessageHTML;
    if (typeof origRender === 'function') {
      window._origEditRender = origRender;
      window.renderSingleMessageHTML = function(msg) {
        var html = origRender(msg);
        if (!html || !msg || !msg.edited) return html;
        var timePattern = /(<span[^>]*class="[^"]*(?:msg-time|message-time|time|timestamp)[^"]*"[^>]*>)([^<]*<\/span>)/i;
        var match = html.match(timePattern);
        if (match) {
          html = html.replace(match[0], match[1] + match[2].replace(/<\/span>$/, '') + '<span class="nsl-edited-label" style="font-size:11px;font-weight:400;opacity:0.7;font-style:italic;margin-left:2px"> (edited)</span></span>');
        } else {
          var altPattern = /(<\/div>\s*<\/div>\s*<\/div>)/i;
          var altMatch = html.match(altPattern);
          if (altMatch) {
            var editedTag = '<span class="nsl-edited-label" style="font-size:11px;font-weight:400;opacity:0.7;font-style:italic">(edited)</span>';
            html = html.replace(altPattern, editedTag + altMatch[0]);
          }
        }
        return html;
      };
    }
    window._editRenderPatched = true;
  }

  function _patchSend() {
    if (window._editSendPatched) return;
    var origSend = window.sendMessage || window.sendMsg;
    if (typeof origSend !== 'function') return;
    var wrapped = false;
    var patchedFn = function() {
      if (_editingMsgId) {
        submitEdit();
        return;
      }
      return origSend.apply(this, arguments);
    };
    if (window.sendMessage) window.sendMessage = patchedFn;
    if (window.sendMsg) window.sendMsg = patchedFn;
    window._editSendPatched = true;
  }

  function _patchTouchContextMenu() {
    if (window._editTouchCtxPatched) return;
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
          var msg = doc.data();
          msg.id = doc.id;
          if (!canEdit(msg)) return;
          setTimeout(function() {
            var menu = document.getElementById('msg-ctx-menu');
            if (!menu) return;
            var existingEditBtn = menu.querySelector('[data-action="edit-msg"]');
            if (existingEditBtn) return;
            var deleteBtn = menu.querySelector('[data-action="delete"], button[onclick*="delete"]');
            var editHtml = '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" data-action="edit-msg" data-msg-id="' + _esc(msgId) + '"><span class="material-symbols-outlined text-lg">edit</span><span class="text-sm">Edit</span></button>';
            if (deleteBtn) {
              deleteBtn.insertAdjacentHTML('beforebegin', editHtml);
            }
          }, 100);
        });
      }, 500);
    }, { passive: true });
    container.addEventListener('touchend', function() { clearTimeout(touchTimer); }, { passive: true });
    container.addEventListener('touchmove', function() { clearTimeout(touchTimer); }, { passive: true });
    window._editTouchCtxPatched = true;
  }

  var _editObserver = null;

  function _wireObserver() {
    if (typeof MutationObserver === 'undefined') return;
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) { setTimeout(_wireObserver, 1000); return; }
    if (_editObserver) { _editObserver.disconnect(); _editObserver = null; }
    _editObserver = new MutationObserver(function() { injectEditLabel(); });
    _editObserver.observe(container, { childList: true, subtree: true });
  }

  function _init() {
    _patchContextMenu();
    _patchDesktopContextMenu();
    _patchRenderMessages();
    _patchSend();
    _patchTouchContextMenu();
    _wireObserver();
    setTimeout(injectEditLabel, 500);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(_init, 0);
  } else {
    window.addEventListener('load', function() { setTimeout(_init, 0); });
  }

  window.MessageEdit = {
    canEdit: canEdit,
    startEdit: startEdit,
    cancelEdit: cancelEdit,
    submitEdit: submitEdit,
    injectEditLabel: injectEditLabel,
    isEditing: function() { return _editingMsgId !== null; }
  };
})();
