// chat-fixes.js — Chat system enhancements v1
// Patches: Myself chat, Chat Requests, Chat Pinning, Message Pinning

(function () {
  'use strict';

  /* ── helpers ──────────────────────────────────────────────── */
  function waitForFn(name, cb, tries) {
    tries = tries || 0;
    if (typeof window[name] === 'function') { cb(); return; }
    if (tries > 150) { console.warn('[chat-fixes] timeout waiting for', name); return; }
    setTimeout(function () { waitForFn(name, cb, tries + 1); }, 80);
  }

  function _esc(s) {
    return typeof window.escapeHtml === 'function' ? window.escapeHtml(s) : String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _initials(name) {
    return typeof window.getInitials === 'function' ? window.getInitials(name, '') : (name || '?').charAt(0).toUpperCase();
  }

  /* ════════════════════════════════════════════════════════════
     1. "MYSELF" CHAT — rename + always-pinned + avatar
     ════════════════════════════════════════════════════════════ */
  waitForFn('getSavedMessagesItem', function () {
    var _orig = window.getSavedMessagesItem;
    window.getSavedMessagesItem = function () {
      var item = _orig ? _orig() : {};
      return Object.assign({}, item, {
        name: 'Myself',
        avatar: '&#128100;',
        preview: 'Your personal notes, files & reminders',
        isPinned: true,
      });
    };
  });

  waitForFn('startSavedMessages', function () {
    var _orig = window.startSavedMessages;
    window.startSavedMessages = async function () {
      await _orig();
      var nameEl = document.getElementById('currentChatName');
      var statusEl = document.getElementById('chatStatus');
      if (nameEl) nameEl.textContent = 'Myself';
      if (statusEl) statusEl.textContent = 'Your personal notes, files & reminders';
      if (typeof window.setChatHeaderAvatar === 'function') {
        window.setChatHeaderAvatar('&#128100;');
      }
      if (window.currentChat) {
        window.currentChat.isSaved = true;
        window.currentChat.otherUserName = 'Myself';
      }
    };
  });

  /* ════════════════════════════════════════════════════════════
     2. CHAT REQUESTS — Sent + Received + Accepted, total badge
     ════════════════════════════════════════════════════════════ */
  waitForFn('loadReceivedRequests', function () {
    window.loadReceivedRequests = async function () {
      if (!window.currentUser) return;
      var requestList = document.getElementById('requestList');
      if (!requestList) return;
      var requestSection = document.querySelector('.request-section');
      var requestToggle = document.getElementById('requestToggle');
      var badge = document.getElementById('requestBadge');
      var db = window.db;
      var uid = window.currentUser.uid;

      try {
        var results = await Promise.all([
          db.collection('chatRequests').where('toUserId','==',uid).where('status','==','pending').get(),
          db.collection('chatRequests').where('fromUserId','==',uid).where('status','==','pending').get(),
          db.collection('groupInvites').where('toUserId','==',uid).where('status','==','pending').get(),
          db.collection('chatRequests').where('fromUserId','==',uid).where('status','==','accepted').get(),
        ]);
        var receivedSnap = results[0], sentSnap = results[1], groupSnap = results[2], acceptedSnap = results[3];

        var requests = [].concat(
          receivedSnap.docs.map(function(d){ return Object.assign({id:d.id,direction:'incoming',requestType:'chat',_kind:'received'},d.data()); }),
          sentSnap.docs.map(function(d){ return Object.assign({id:d.id,direction:'outgoing',requestType:'chat',_kind:'sent'},d.data()); }),
          groupSnap.docs.map(function(d){ return Object.assign({id:d.id,direction:'incoming',requestType:'group',_kind:'received'},d.data()); }),
          acceptedSnap.docs.map(function(d){ return Object.assign({id:d.id,direction:'outgoing',requestType:'chat',_kind:'accepted'},d.data()); })
        ).sort(function(a,b){ return (b.createdAt&&b.createdAt.toMillis?b.createdAt.toMillis():0)-(a.createdAt&&a.createdAt.toMillis?a.createdAt.toMillis():0); });

        /* — badge shows total of all 3 types — */
        var totalCount = receivedSnap.size + sentSnap.size + groupSnap.size + acceptedSnap.size;
        if (badge) {
          if (totalCount > 0) {
            badge.textContent = totalCount > 99 ? '99+' : String(totalCount);
            badge.classList.add('show');
            badge.style.display = 'inline-flex';
          } else {
            badge.textContent = '';
            badge.classList.remove('show');
            badge.style.display = 'none';
          }
        }

        if (requestToggle)
          requestToggle.textContent = requestSection && requestSection.classList.contains('expanded') ? '▲' : '▼';

        requestList.innerHTML = '';

        if (!requests.length) {
          requestList.innerHTML = '<div class="empty-state">No requests</div>';
          if (requestSection) requestSection.classList.remove('expanded');
          if (requestToggle) requestToggle.textContent = '▼';
          if (requestSection) requestSection.style.display = 'none';
          return;
        }
        if (requestSection) requestSection.style.display = '';

        var kindMeta = {
          received: { emoji:'🔵', label:'Received', color:'#2196f3' },
          sent:     { emoji:'🟡', label:'Sent',     color:'#ff9800' },
          accepted: { emoji:'✅', label:'Accepted', color:'#4caf50' },
        };

        requests.forEach(function (req) {
          var isGroup    = req.requestType === 'group';
          var isAccepted = req._kind === 'accepted';
          var isOutgoing = req.direction === 'outgoing';
          var displayName = (isAccepted || isOutgoing)
            ? (req.toUserName || req.toUserEmail || 'User')
            : isGroup
              ? (req.groupName || 'Group invite')
              : (req.fromUserName || 'User');
          var kind = kindMeta[req._kind] || kindMeta['received'];
          var previewText = isGroup ? 'Group invite'
            : isAccepted ? 'Chat accepted — tap to open'
            : isOutgoing ? 'Pending chat request'
            : 'Wants to chat' + (req.fromUserEmail ? ' · ' + _esc(req.fromUserEmail) : '');

          var actionsHtml = isAccepted
            ? '<button class="btn btn-success open-chat-btn" data-to="' + _esc(req.toUserId||'') + '">Open Chat</button>'
            : isOutgoing
              ? '<button class="btn btn-outline cancel-request-btn" data-id="' + _esc(req.id) + '">Cancel</button>'
              : '<button class="btn btn-success accept-request-btn" data-type="' + _esc(req.requestType) + '" data-id="' + _esc(req.id) + '" data-from="' + _esc(req.fromUserId||'') + '">Accept</button>'
                + '<button class="btn btn-outline decline-request-btn" data-type="' + _esc(req.requestType) + '" data-id="' + _esc(req.id) + '">Decline</button>'
                + '<button class="btn btn-outline block-request-btn" data-type="' + _esc(req.requestType) + '" data-id="' + _esc(req.id) + '" data-from="' + _esc(req.fromUserId||'') + '" data-name="' + _esc(req.fromUserName||'User') + '">Block</button>';

          var reqDiv = document.createElement('div');
          reqDiv.className = 'list-item request-card';
          reqDiv.innerHTML = '<div class="list-avatar">' + _esc(_initials(displayName)) + '</div>'
            + '<div class="list-info">'
            +   '<div class="list-name">' + _esc(displayName) + '</div>'
            +   '<div class="list-preview" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">'
            +     '<span style="font-size:10px;font-weight:700;color:' + kind.color + ';background:' + kind.color + '22;padding:1px 6px;border-radius:8px;">' + kind.emoji + ' ' + kind.label + '</span>'
            +     '<span style="font-size:11px;">' + _esc(previewText) + '</span>'
            +   '</div>'
            + '</div>'
            + '<div class="request-actions">' + actionsHtml + '</div>';
          requestList.appendChild(reqDiv);
        });

        /* — event wiring — */
        requestList.querySelectorAll('.open-chat-btn').forEach(function(btn){
          btn.addEventListener('click', async function(e){
            e.stopPropagation();
            if (btn.dataset.to && typeof window.startDirectChat === 'function')
              await window.startDirectChat({ id: btn.dataset.to });
          });
        });
        requestList.querySelectorAll('.accept-request-btn').forEach(function(btn){
          btn.addEventListener('click', async function(e){
            e.stopPropagation(); btn.disabled = true;
            try { if (btn.dataset.type==='group') await window.acceptGroupInvite(btn.dataset.id); else await window.acceptChatRequest(btn.dataset.id, btn.dataset.from); }
            finally { btn.disabled = false; }
          });
        });
        requestList.querySelectorAll('.decline-request-btn').forEach(function(btn){
          btn.addEventListener('click', async function(e){
            e.stopPropagation();
            if (btn.dataset.type==='group') await window.declineGroupInvite(btn.dataset.id); else await window.declineChatRequest(btn.dataset.id);
          });
        });
        requestList.querySelectorAll('.cancel-request-btn').forEach(function(btn){
          btn.addEventListener('click', async function(e){
            e.stopPropagation(); btn.disabled = true;
            try { await window.cancelChatRequest(btn.dataset.id); } finally { btn.disabled = false; }
          });
        });
        requestList.querySelectorAll('.block-request-btn').forEach(function(btn){
          btn.addEventListener('click', async function(e){
            e.stopPropagation();
            await window.blockRequestSender(btn.dataset.type, btn.dataset.id, btn.dataset.from, btn.dataset.name);
          });
        });

      } catch (err) {
        console.warn('[chat-fixes] loadReceivedRequests error:', err);
        if (badge) { badge.textContent = ''; badge.classList.remove('show'); badge.style.display = 'none'; }
      }
    };
  });

  /* ════════════════════════════════════════════════════════════
     3. CHAT PINNING — single consolidated implementation
     ════════════════════════════════════════════════════════════ */
  waitForFn('togglePinChat', function () {
    window.togglePinChat = async function (chatId) {
      if (!window.currentUser || !chatId) return;
      var db = window.db;
      var userRef = db.collection('users').doc(window.currentUser.uid);
      var ids = window.pinnedChatIds || [];
      var isPinned = ids.includes(chatId);
      if (isPinned) {
        await userRef.update({ pinnedChatIds: firebase.firestore.FieldValue.arrayRemove(chatId) });
        window.pinnedChatIds = ids.filter(function(id){ return id !== chatId; });
        window.showToast('Chat unpinned');
      } else {
        await userRef.update({ pinnedChatIds: firebase.firestore.FieldValue.arrayUnion(chatId) });
        window.pinnedChatIds = ids.concat([chatId]);
        window.showToast('Chat pinned to top');
      }
      if (typeof window.loadCurrentChatList === 'function') window.loadCurrentChatList();
      else {
        if (typeof window.loadChatsList === 'function') window.loadChatsList();
        if (typeof window.loadGroupsList === 'function') window.loadGroupsList();
      }
    };
  });

  /* ════════════════════════════════════════════════════════════
     4. MESSAGE PINNING — shared for groups, personal for direct
        Limit raised to 20. Scroll-to on click. Count badge.
     ════════════════════════════════════════════════════════════ */
  waitForFn('pinMessage', function () {
    window.pinMessage = async function (messageId, messageData) {
      if (!window.currentChat || !window.currentUser) return;
      var db = window.db;
      var isGroup = window.currentChatType === 'group';

      var q = db.collection('pinnedMessages').where('chatId','==',window.currentChat.id);
      if (!isGroup) q = q.where('userId','==',window.currentUser.uid);
      var existing = await q.get();
      if (existing.size >= 20) { window.showToast('You can only pin up to 20 messages','error'); return; }

      var pinData = {
        chatId: window.currentChat.id,
        messageId: messageId,
        text: messageData.text || '',
        senderName: messageData.senderName || '',
        timestamp: messageData.timestamp || null,
        pinnedAt: firebase.firestore.FieldValue.serverTimestamp(),
        pinnedBy: window.currentUser.uid,
        pinnedByName: window.currentUser.displayName || window.currentUser.email || '',
        isGroupPin: isGroup,
      };
      if (!isGroup) pinData.userId = window.currentUser.uid;

      await db.collection('pinnedMessages').add(pinData);
      window.showToast('Message pinned');
      window.loadPinnedMessages();
    };
  });

  waitForFn('loadPinnedMessages', function () {
    window.loadPinnedMessages = async function () {
      if (!window.currentChat || !window.currentUser) return;
      var db = window.db;
      var isGroup = window.currentChatType === 'group';

      var q = db.collection('pinnedMessages').where('chatId','==',window.currentChat.id);
      if (!isGroup) q = q.where('userId','==',window.currentUser.uid);

      var snap;
      try { snap = await q.orderBy('pinnedAt','desc').get(); }
      catch (_) {
        snap = await q.get();
        var sorted = snap.docs.slice().sort(function(a,b){
          return (b.data().pinnedAt&&b.data().pinnedAt.toDate?b.data().pinnedAt.toDate():new Date(0))
               - (a.data().pinnedAt&&a.data().pinnedAt.toDate?a.data().pinnedAt.toDate():new Date(0));
        });
        snap = { docs: sorted };
      }

      window.pinnedMessages = snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); });
      var pinnedSection = document.getElementById('pinnedSection');
      var pinnedList    = document.getElementById('pinnedMessagesList');
      var pinnedCount   = document.getElementById('pinnedCount');
      if (!pinnedSection) return;

      if (!window.pinnedMessages.length) { pinnedSection.style.display = 'none'; return; }
      pinnedSection.style.display = 'block';
      if (pinnedCount) pinnedCount.textContent = '📌 ' + window.pinnedMessages.length;

      if (pinnedList) {
        pinnedList.innerHTML = '';
        window.pinnedMessages.forEach(function (pin) {
          var div = document.createElement('div');
          div.className = 'pinned-message-item cf-pin-item';
          var byLine = isGroup && pin.pinnedByName ? ' · Pinned by ' + _esc(pin.pinnedByName) : '';
          div.innerHTML =
            '<span style="font-size:13px;flex-shrink:0;">📌</span>'
            + '<div style="flex:1;min-width:0;">'
            +   '<div style="font-weight:600;font-size:11px;color:var(--primary,#075e54);">' + _esc(pin.senderName||'') + byLine + '</div>'
            +   '<div style="font-size:12px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc((pin.text||'').substring(0,60)||'📎 Media') + '</div>'
            + '</div>'
            + '<button class="unpin-btn" data-id="' + _esc(pin.id) + '" title="Unpin" style="background:none;border:none;cursor:pointer;color:#aaa;font-size:15px;padding:2px 4px;flex-shrink:0;">✖</button>';

          /* scroll-to on click */
          div.addEventListener('click', function (e) {
            if (e.target.classList.contains('unpin-btn')) return;
            var msgEl = document.querySelector('[data-message-id="' + pin.messageId + '"]');
            if (msgEl) {
              msgEl.scrollIntoView({ behavior:'smooth', block:'center' });
              msgEl.classList.add('cf-highlight');
              setTimeout(function(){ msgEl.classList.remove('cf-highlight'); }, 1800);
            } else {
              window.showToast('Message not visible — scroll up to find it');
            }
          });
          div.querySelector('.unpin-btn').addEventListener('click', async function (e) {
            e.stopPropagation();
            await window.unpinMessage(pin.id);
          });
          pinnedList.appendChild(div);
        });
      }
    };
  });

  /* ════════════════════════════════════════════════════════════
     5. CSS injections
     ════════════════════════════════════════════════════════════ */
  var css = document.createElement('style');
  css.id = 'chat-fixes-css';
  css.textContent = [
    /* highlight animation on scroll-to */
    '.cf-highlight { animation: cfHighlight 1.8s ease; }',
    '@keyframes cfHighlight { 0%,100%{background:transparent} 20%,80%{background:rgba(0,150,136,.22)} }',
    /* pinned bar items */
    '.cf-pin-item { display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer; }',
    '.cf-pin-item:hover { background:var(--panel-hover,#f5f5f5); }',
    /* request kind pill */
    '.request-card .list-preview { flex-wrap:wrap; }',
    /* pin section scroll */
    '#pinnedSection { max-height:130px;overflow-y:auto; }',
    /* "Myself" avatar ring */
    '.saved-messages-avatar,.cf-myself-avatar { border:2px solid #25d366;border-radius:50%; }',
  ].join('\n');
  document.head.appendChild(css);

  console.log('[chat-fixes] v1 patches applied ✓');
})();
