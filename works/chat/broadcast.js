(function () {
  'use strict';

  var _users = [];
  var _loading = false;

  function _db() {
    return window.db || (window.App && window.App.db) || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  }
  function _uid() {
    if (window.App && typeof window.App.uid === 'function') return window.App.uid();
    if (window.currentUser && window.currentUser.uid) return window.currentUser.uid;
    if (window.firebase && window.firebase.auth && window.firebase.auth().currentUser) return window.firebase.auth().currentUser.uid;
    return null;
  }
  function _me() {
    return (window.App && window.App.user) || window.currentUser || (window.firebase && window.firebase.auth ? window.firebase.auth().currentUser : null) || null;
  }
  function _toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
    else if (typeof window.toastMessage === 'function') window.toastMessage(msg, type);
    else if (typeof window._toast === 'function') window._toast(msg, type);
  }
  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _sts() {
    return (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue.serverTimestamp()) || new Date();
  }

  function _loadUsers() {
    if (_users.length) return Promise.resolve(_users);
    if (_loading) return _loading;
    var db = _db();
    if (!db) return Promise.resolve([]);
    var uid = _uid();
    _loading = db.collection('users').get().then(function (snap) {
      _users = snap.docs
        .map(function (d) { var data = d.data() || {}; data.uid = data.uid || d.id; return data; })
        .filter(function (u) { return u.uid !== uid; })
        .sort(function (a, b) { return String(a.displayName || a.name || a.email || '').localeCompare(String(b.displayName || b.name || b.email || '')); });
      return _users;
    }).catch(function () { return []; }).then(function (list) { _loading = null; return list; });
    return _loading;
  }

  /* ═══════════════ BROADCAST COMPOSER ═══════════════ */

  function openBroadcastComposer() {
    _loadUsers().then(function () {
      _buildComposer();
    });
  }
  window.openBroadcastComposer = openBroadcastComposer;
  window.closeBroadcastComposer = closeBroadcastComposer;

  function _composerOverlay() {
    return document.getElementById('nsl-broadcast-composer');
  }

  function closeBroadcastComposer() {
    var el = _composerOverlay();
    if (el) el.remove();
  }

  function _buildComposer() {
    var existing = _composerOverlay();
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'nsl-broadcast-composer';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'New broadcast list');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100050;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px;';

    overlay.innerHTML =
      '<div style="background:var(--surface-container,#fff);color:var(--on-surface,#1c1c1e);border-radius:16px;width:100%;max-width:460px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.35);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08));">' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span aria-hidden="true" style="font-size:20px;">📢</span>' +
            '<span style="font-weight:700;font-size:15px;">New broadcast list</span>' +
          '</div>' +
          '<button type="button" data-nsl-bc-close aria-label="Close" style="background:none;border:none;cursor:pointer;min-width:44px;min-height:44px;color:inherit;font-size:22px;">&times;</button>' +
        '</div>' +
        '<div style="padding:14px 18px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08));">' +
          '<input id="nsl-bc-name" type="text" maxlength="50" placeholder="Broadcast list name" aria-label="Broadcast list name" style="width:100%;padding:10px 12px;border:1px solid var(--outline-variant,rgba(0,0,0,0.12));border-radius:10px;background:var(--surface-container-low,rgba(0,0,0,0.04));color:inherit;font-size:14px;outline:none;box-sizing:border-box;"/>' +
          '<input id="nsl-bc-search" type="text" placeholder="Search contacts…" aria-label="Search contacts" style="width:100%;margin-top:10px;padding:9px 12px;border:1px solid var(--outline-variant,rgba(0,0,0,0.12));border-radius:10px;background:var(--surface-container-low,rgba(0,0,0,0.04));color:inherit;font-size:13px;outline:none;box-sizing:border-box;"/>' +
        '</div>' +
        '<div id="nsl-bc-list" style="flex:1;overflow-y:auto;padding:8px;"></div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 18px;border-top:1px solid var(--outline-variant,rgba(0,0,0,0.08));">' +
          '<span id="nsl-bc-count" style="font-size:12px;color:var(--on-surface-variant,#8696a0);">0 recipients selected</span>' +
          '<button id="nsl-bc-create" type="button" disabled style="padding:10px 18px;border:none;border-radius:10px;background:#00a884;color:#fff;font-size:13px;font-weight:700;cursor:pointer;opacity:0.45;">Create broadcast</button>' +
        '</div>' +
      '</div>';

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeBroadcastComposer();
    });
    overlay.querySelector('[data-nsl-bc-close]').addEventListener('click', closeBroadcastComposer);

    document.body.appendChild(overlay);

    var nameEl = overlay.querySelector('#nsl-bc-name');
    var searchEl = overlay.querySelector('#nsl-bc-search');
    var listEl = overlay.querySelector('#nsl-bc-list');
    var countEl = overlay.querySelector('#nsl-bc-count');
    var createBtn = overlay.querySelector('#nsl-bc-create');

    var selected = {};

    function renderList(q) {
      var ql = String(q || '').trim().toLowerCase();
      var items = _users.filter(function (u) {
        if (!ql) return true;
        var hay = ((u.displayName || '') + ' ' + (u.name || '') + ' ' + (u.email || '') + ' ' + (u.phoneNumber || '')).toLowerCase();
        return hay.indexOf(ql) !== -1;
      });
      listEl.innerHTML = items.length
        ? items.map(function (u) {
            var label = u.displayName || u.name || u.email || u.uid;
            var sub = [u.email, u.phoneNumber].filter(Boolean).join(' · ');
            var checked = !!selected[u.uid];
            return '<button type="button" data-nsl-bc-uid="' + _esc(u.uid) + '" style="display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:none;border-radius:10px;background:none;cursor:pointer;text-align:left;">' +
              '<span style="width:20px;height:20px;flex-shrink:0;border-radius:5px;border:2px solid ' + (checked ? '#00a884' : 'var(--outline-variant,#d0d5db)') + ';background:' + (checked ? '#00a884' : 'transparent') + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;line-height:1;">' + (checked ? '✓' : '') + '</span>' +
              '<span style="width:38px;height:38px;flex-shrink:0;border-radius:50%;background:var(--primary,#00a884);color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;">' + _esc((label || '?').charAt(0).toUpperCase()) + '</span>' +
              '<span style="flex:1;min-width:0;">' +
                '<span style="display:block;font-size:13px;font-weight:600;color:var(--on-surface,#1c1c1e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(label) + '</span>' +
                '<span style="display:block;font-size:11px;color:var(--on-surface-variant,#8696a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(sub) + '</span>' +
              '</span>' +
            '</button>';
          }).join('')
        : '<div style="padding:20px;text-align:center;font-size:13px;color:var(--on-surface-variant,#8696a0);">No contacts found</div>';
    }

    function updateCount() {
      var n = Object.keys(selected).length;
      if (countEl) countEl.textContent = n + ' recipient' + (n === 1 ? '' : 's') + ' selected';
      var canCreate = !!(nameEl && nameEl.value.trim()) && n > 0;
      if (createBtn) {
        createBtn.disabled = !canCreate;
        createBtn.style.opacity = canCreate ? '1' : '0.45';
      }
    }

    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-nsl-bc-uid]');
      if (!btn) return;
      var u = btn.getAttribute('data-nsl-bc-uid');
      if (selected[u]) delete selected[u];
      else selected[u] = true;
      renderList(searchEl ? searchEl.value : '');
      updateCount();
    });

    if (searchEl) searchEl.addEventListener('input', function () { renderList(searchEl.value); });
    if (nameEl) nameEl.addEventListener('input', updateCount);

    function create() {
      var name = (nameEl && nameEl.value || '').trim();
      var uids = Object.keys(selected);
      if (!name || !uids.length) return;
      createBtn.disabled = true;
      createBroadcast(name, uids).then(function () {
        closeBroadcastComposer();
      }).catch(function () {
        createBtn.disabled = false;
        updateCount();
      });
    }
    createBtn.addEventListener('click', create);
    nameEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') create(); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeBroadcastComposer(); });

    renderList('');
    updateCount();
    nameEl.focus();
  }

  /* ═══════════════ CREATE ═══════════════ */

  function createBroadcast(name, recipientUids) {
    var db = _db();
    var me = _me();
    var myUid = _uid();
    if (!db || !myUid) return Promise.reject(new Error('no-db'));
    if (!name || !recipientUids || !recipientUids.length) return Promise.reject(new Error('invalid'));

    var names = {};
    var photos = {};
    var members = [myUid];
    recipientUids.forEach(function (u) {
      var rec = _users.filter(function (x) { return x.uid === u; })[0] || {};
      names[u] = rec.displayName || rec.name || rec.email || 'User';
      photos[u] = rec.photoURL || '';
      members.push(u);
    });
    if (me && (me.displayName || me.email)) names[myUid] = me.displayName || me.email;
    if (me && me.photoURL) photos[myUid] = me.photoURL;

    return db.collection('broadcasts').add({
      name: name,
      ownerId: myUid,
      members: members,
      recipients: recipientUids,
      recipientNames: names,
      recipientPhotos: photos,
      type: 'broadcast',
      createdAt: _sts(),
      updatedAt: _sts(),
      lastMessageAt: _sts()
    }).then(function (ref) {
      if (typeof window.openChat === 'function') window.openChat(ref.id, 'broadcast');
      if (typeof window.subscribeToBroadcasts === 'function') window.subscribeToBroadcasts();
      _toast('Broadcast list created', 'success');
      return ref.id;
    }).catch(function (err) {
      if (window.__DEBUG__) console.warn('[broadcast] create error:', err);
      _toast('Failed to create broadcast', 'error');
      throw err;
    });
  }
  window.createBroadcast = createBroadcast;

  /* ═══════════════ SEND ═══════════════ */

  function _activeBroadcastId() {
    var chat = window.currentChat || (window.App && window.App.currentChat) || null;
    var type = window.currentChatType || (window.App && window.App.currentChatType) || null;
    if (type === 'broadcast' && chat && chat.id) return chat.id;
    if (chat && chat.type === 'broadcast' && chat.id) return chat.id;
    return null;
  }

  function sendBroadcastMessage(text, attachment, type) {
    var db = _db();
    var myUid = _uid();
    var user = _me();
    var bId = _activeBroadcastId();
    if (!db || !myUid || !bId) { _toast('No active broadcast', 'error'); return Promise.resolve(); }

    return db.collection('broadcasts').doc(bId).get().then(function (snap) {
      if (!snap.exists) throw new Error('broadcast-missing');
      var bc = snap.data() || {};
      var recipients = Array.isArray(bc.recipients) ? bc.recipients : [];

      var msg = {
        text: text || '',
        type: type || 'text',
        attachment: attachment || null,
        senderId: myUid,
        senderName: (user && (user.displayName || user.email)) || 'Me',
        senderPhotoURL: (user && user.photoURL) || '',
        timestamp: _sts(),
        readBy: {},
        broadcastId: bId
      };
      msg.readBy[myUid] = true;

      var preview = (text && text.trim()) || (attachment && attachment.name) || (type === 'sticker' ? 'Sticker' : type === 'gif' ? 'GIF' : 'Broadcast');
      var batch = db.batch();
      var msgRef = db.collection('broadcasts').doc(bId).collection('messages').doc();
      msg.id = msgRef.id;
      batch.set(msgRef, msg);
      batch.update(db.collection('broadcasts').doc(bId), {
        lastMessage: preview,
        lastMessageText: preview,
        lastMessageAt: _sts(),
        lastSenderId: myUid,
        updatedAt: _sts()
      });

      // Deliver a copy into each recipient's direct chat with the creator (WhatsApp-style)
      recipients.forEach(function (rid) {
        var pairId = [myUid, rid].sort().join('_');
        var chatRef = db.collection('chats').doc(pairId);
        batch.set(chatRef, {
          participants: [myUid, rid],
          createdBy: myUid,
          createdAt: _sts()
        }, { merge: true });
        batch.update(chatRef, {
          lastMessage: preview,
          lastMessageText: preview,
          lastMessageAt: _sts(),
          lastSenderId: myUid,
          updatedAt: _sts()
        });
        var copy = Object.assign({}, msg, { broadcastId: bId });
        batch.set(chatRef.collection('messages').doc(), copy);
      });

      return batch.commit().then(function () {
        if (typeof window.loadMessages === 'function') window.loadMessages(bId, 'broadcast');
        else if (typeof window.renderMessages === 'function') window.renderMessages(bId, 'broadcast');
      });
    }).catch(function (err) {
      if (window.__DEBUG__) console.warn('[broadcast] send error:', err);
      _toast('Failed to send broadcast', 'error');
    });
  }
  window.sendBroadcastMessage = sendBroadcastMessage;

  if (window.__DEBUG__) console.log('[broadcast] loaded ✓');
})();
