/* ============================================================
   MESSAGE MULTI-SELECT — WhatsApp-style bulk message operations
   Long-press/checkbox to enter selection mode, then bulk
   delete, forward, star, copy, or report selected messages.
   ============================================================ */
(function () {
  'use strict';

  var _active = false;
  var _selected = new Set();
  var _chatId = null;

  function _db() { return window.App && window.App.db ? window.App.db : null; }
  function _uid() { return window.App && window.App.auth && window.App.auth.currentUser ? window.App.auth.currentUser.uid : null; }
  function _esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') : ''; }
  function _toast(msg, t) { if (typeof window.showToast === 'function') window.showToast(msg, t); }

  function _chatColl(chatId) {
    var chat = window.App && window.App.chats ? (window.App.chats[chatId] || null) : null;
    if (chat) return (chat.type === 'group' || chat.isGroup) ? 'groups' : 'chats';
    return 'chats';
  }

  function _messages() {
    if (!window.App || !window.App.messages || !_chatId) return [];
    var msgs = window.App.messages[_chatId];
    return Array.isArray(msgs) ? msgs : [];
  }

  /* ── Enter / Exit selection mode ────────────────────────────── */
  function enterSelection(msgId) {
    if (_active && msgId) { toggleSelect(msgId); return; }
    _active = true;
    _selected.clear();
    _chatId = window.App && window.App.currentChat ? window.App.currentChat.id : null;
    if (msgId) _selected.add(msgId);
    _applyCheckboxes();
    _showToolbar();
    _highlightSelected();
  }

  function exitSelection() {
    _active = false;
    _selected.clear();
    _removeCheckboxes();
    _hideToolbar();
    _highlightSelected();
  }

  function toggleSelect(msgId) {
    if (!_active) { enterSelection(msgId); return; }
    if (_selected.has(msgId)) {
      _selected.delete(msgId);
    } else {
      _selected.add(msgId);
    }
    if (_selected.size === 0) { exitSelection(); return; }
    _updateCheckboxes();
    _updateToolbarCount();
    _highlightSelected();
  }

  function selectAll() {
    if (!_chatId) return;
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) return;
    container.querySelectorAll('[data-message-id]').forEach(function(el) {
      var id = el.getAttribute('data-message-id');
      if (id) _selected.add(id);
    });
    _updateCheckboxes();
    _updateToolbarCount();
    _highlightSelected();
  }

  function isSelected(msgId) { return _selected.has(msgId); }
  function isActive() { return _active; }
  function getSelected() { return Array.from(_selected); }

  /* ── Checkboxes on messages ─────────────────────────────────── */
  function _applyCheckboxes() {
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) return;
    container.querySelectorAll('[data-message-id]').forEach(function(el) {
      if (el.querySelector('.msl-checkbox')) return;
      var id = el.getAttribute('data-message-id');
      var isOwn = el.classList.contains('sent') || el.classList.contains('message-sent') || el.classList.contains('msg-outgoing');
      var cb = document.createElement('div');
      cb.className = 'msl-checkbox';
      cb.setAttribute('role', 'checkbox');
      cb.setAttribute('aria-checked', _selected.has(id) ? 'true' : 'false');
      cb.setAttribute('tabindex', '0');
      cb.style.cssText = 'position:absolute;top:12px;' + (isOwn ? 'right:8px;' : 'left:8px;') +
        'width:22px;height:22px;border-radius:50%;border:2px solid var(--on-surface-variant,#8696a0);' +
        'background:' + (_selected.has(id) ? 'var(--primary,#00a884)' : 'transparent') + ';' +
        'cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;z-index:5;' +
        'box-shadow:0 1px 3px rgba(0,0,0,0.2)';
      if (_selected.has(id)) {
        cb.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;color:#fff">check</span>';
      }
      cb.addEventListener('click', function(e) { e.stopPropagation(); toggleSelect(id); });
      el.style.position = 'relative';
      el.appendChild(cb);
    });
  }

  function _updateCheckboxes() {
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) return;
    container.querySelectorAll('[data-message-id]').forEach(function(el) {
      var id = el.getAttribute('data-message-id');
      var cb = el.querySelector('.msl-checkbox');
      if (!cb) return;
      var sel = _selected.has(id);
      cb.setAttribute('aria-checked', sel ? 'true' : 'false');
      cb.style.background = sel ? 'var(--primary,#00a884)' : 'transparent';
      cb.innerHTML = sel ? '<span class="material-symbols-outlined" style="font-size:14px;color:#fff">check</span>' : '';
    });
  }

  function _removeCheckboxes() {
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) return;
    container.querySelectorAll('.msl-checkbox').forEach(function(cb) { cb.remove(); });
  }

  function _highlightSelected() {
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) return;
    container.querySelectorAll('[data-message-id]').forEach(function(el) {
      var id = el.getAttribute('data-message-id');
      if (_selected.has(id)) {
        el.style.background = 'var(--primary-container,rgba(0,168,132,0.12))';
        el.style.borderRadius = '8px';
      } else {
        el.style.background = '';
        el.style.borderRadius = '';
      }
    });
  }

  /* ── Action toolbar ─────────────────────────────────────────── */
  function _showToolbar() {
    _hideToolbar();
    var bar = document.createElement('div');
    bar.id = 'msl-toolbar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;display:flex;align-items:center;' +
      'background:var(--surface,#fff);border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08));' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.1);animation:slideFromTop 0.2s ease;padding:8px 12px;gap:8px';
    bar.innerHTML =
      '<button id="msl-close" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--on-surface,#000);display:flex;align-items:center">' +
        '<span class="material-symbols-outlined">close</span>' +
      '</button>' +
      '<span id="msl-count" style="flex:1;font-size:15px;font-weight:600;color:var(--on-surface,#000)">0 selected</span>' +
      '<button id="msl-select-all" title="Select all" style="background:none;border:none;cursor:pointer;padding:6px;color:var(--on-surface-variant,#667781);display:flex;align-items:center">' +
        '<span class="material-symbols-outlined">select_all</span>' +
      '</button>' +
      '<button id="msl-star" title="Star" style="background:none;border:none;cursor:pointer;padding:6px;color:var(--on-surface-variant,#667781);display:flex;align-items:center">' +
        '<span class="material-symbols-outlined">star</span>' +
      '</button>' +
      '<button id="msl-copy" title="Copy" style="background:none;border:none;cursor:pointer;padding:6px;color:var(--on-surface-variant,#667781);display:flex;align-items:center">' +
        '<span class="material-symbols-outlined">content_copy</span>' +
      '</button>' +
      '<button id="msl-forward" title="Forward" style="background:none;border:none;cursor:pointer;padding:6px;color:var(--on-surface-variant,#667781);display:flex;align-items:center">' +
        '<span class="material-symbols-outlined">forward</span>' +
      '</button>' +
      '<button id="msl-delete" title="Delete" style="background:none;border:none;cursor:pointer;padding:6px;color:var(--error,#ea0038);display:flex;align-items:center">' +
        '<span class="material-symbols-outlined">delete</span>' +
      '</button>';

    document.body.appendChild(bar);

    document.getElementById('msl-close').addEventListener('click', exitSelection);
    document.getElementById('msl-select-all').addEventListener('click', selectAll);
    document.getElementById('msl-star').addEventListener('click', _bulkStar);
    document.getElementById('msl-copy').addEventListener('click', _bulkCopy);
    document.getElementById('msl-forward').addEventListener('click', _bulkForward);
    document.getElementById('msl-delete').addEventListener('click', _bulkDelete);

    _updateToolbarCount();
  }

  function _hideToolbar() {
    var bar = document.getElementById('msl-toolbar');
    if (bar) bar.remove();
  }

  function _updateToolbarCount() {
    var countEl = document.getElementById('msl-count');
    if (countEl) countEl.textContent = _selected.size + ' selected';
  }

  /* ── Bulk actions ───────────────────────────────────────────── */
  function _bulkStar() {
    var ids = getSelected();
    if (!ids.length || !_chatId) return;
    var coll = _chatColl(_chatId);
    var db = _db();
    if (!db) return;
    var batch = db.batch();
    ids.forEach(function(msgId) {
      var ref = db.collection(coll).doc(_chatId).collection('messages').doc(msgId);
      batch.update(ref, {
        starred: true,
        starredAt: firebase.firestore.FieldValue.serverTimestamp(),
        starredBy: _uid()
      });
    });
    batch.commit().then(function() {
      _toast(ids.length + ' message' + (ids.length > 1 ? 's' : '') + ' starred', 'success');
      exitSelection();
    }).catch(function() {
      _toast('Failed to star messages', 'error');
    });
  }

  function _bulkCopy() {
    var msgs = _messages();
    var ids = getSelected();
    var texts = ids.map(function(id) {
      var m = msgs.find(function(x) { return x.id === id; });
      return m ? (m.text || '') : '';
    }).filter(Boolean);
    if (!texts.length) { _toast('No text to copy', 'error'); return; }
    var full = texts.join('\n\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(full).then(function() {
        _toast(ids.length + ' message' + (ids.length > 1 ? 's' : '') + ' copied', 'success');
        exitSelection();
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = full;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      _toast(ids.length + ' message' + (ids.length > 1 ? 's' : '') + ' copied', 'success');
      exitSelection();
    }
  }

  function _bulkForward() {
    if (typeof window.openForwardModal === 'function') {
      var ids = getSelected();
      var msgs = _messages();
      var selectedMsgs = ids.map(function(id) {
        return msgs.find(function(x) { return x.id === id; });
      }).filter(Boolean);
      window._forwardMessages = selectedMsgs;
      window.openForwardModal();
      exitSelection();
    } else {
      _toast('Forward not available', 'error');
    }
  }

  function _bulkDelete() {
    var ids = getSelected();
    if (!ids.length || !_chatId) return;
    var confirmed = confirm('Delete ' + ids.length + ' message' + (ids.length > 1 ? 's' : '') + '?');
    if (!confirmed) return;
    var coll = _chatColl(_chatId);
    var db = _db();
    if (!db) return;
    var myUid = _uid();
    var msgs = _messages();
    var BATCH_LIMIT = 500;
    var batches = [];
    var currentBatch = db.batch();
    var opCount = 0;
    ids.forEach(function(msgId) {
      var ref = db.collection(coll).doc(_chatId).collection('messages').doc(msgId);
      var msg = msgs.find(function(m) { return m.id === msgId; });
      var isOwn = msg && (msg.from === myUid || msg.senderId === myUid);
      if (isOwn) {
        currentBatch.delete(ref);
      } else {
        currentBatch.update(ref, {
          type: 'deleted',
          text: '',
          deleted: true,
          deletedBy: 'everyone',
          deletedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      opCount++;
      if (opCount >= BATCH_LIMIT) {
        batches.push(currentBatch.commit());
        currentBatch = db.batch();
        opCount = 0;
      }
    });
    if (opCount > 0) batches.push(currentBatch.commit());
    Promise.all(batches).then(function() {
      ids.forEach(function(msgId) {
        var el = document.querySelector('[data-message-id="' + msgId + '"]');
        if (el) el.remove();
      });
      _toast(ids.length + ' message' + (ids.length > 1 ? 's' : '') + ' deleted', 'success');
      exitSelection();
    }).catch(function() {
      _toast('Failed to delete messages', 'error');
    });
  }

  /* ── Click handler: tap on message in select mode ───────────── */
  function _initListeners() {
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) { setTimeout(_initListeners, 1000); return; }
    container.addEventListener('click', function(e) {
      if (!_active) return;
      var el = e.target.closest('[data-message-id]');
      if (!el) return;
      var id = el.getAttribute('data-message-id');
      if (id) { e.preventDefault(); e.stopPropagation(); toggleSelect(id); }
    }, true);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && _active) { exitSelection(); }
    });
  }

  function _injectStyles() {
    if (document.getElementById('msl-styles')) return;
    var s = document.createElement('style');
    s.id = 'msl-styles';
    s.textContent = '@keyframes slideFromTop{from{transform:translateY(-100%)}to{transform:translateY(0)}}' +
      '.msl-checkbox:hover{transform:scale(1.15)!important;}' +
      '[data-message-id]:has(.msl-checkbox){cursor:pointer!important}';
    document.head.appendChild(s);
  }

  function _init() {
    _injectStyles();
    _initListeners();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(_init, 0);
  } else {
    window.addEventListener('load', function() { setTimeout(_init, 0); });
  }

  window.MessageMultiSelect = {
    enter: enterSelection,
    exit: exitSelection,
    toggle: toggleSelect,
    selectAll: selectAll,
    isActive: isActive,
    getSelected: getSelected,
    isSelected: isSelected
  };
})();
