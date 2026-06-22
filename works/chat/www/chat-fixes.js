// chat-fixes.js — Chat system enhancements v2
// Patches: Myself chat, Chat Requests, Chat Pinning, Message Pinning
// Fully responsive for web + Capacitor Android

(function () {
  'use strict';

  /* ── tiny helpers ──────────────────────────────────────────── */
  function waitForFn(name, cb, tries) {
    tries = tries || 0;
    if (typeof window[name] === 'function') { cb(); return; }
    if (tries > 180) { console.warn('[chat-fixes] timeout:', name); return; }
    setTimeout(function () { waitForFn(name, cb, tries + 1); }, 80);
  }

  function esc(s) {
    return typeof window.escapeHtml === 'function'
      ? window.escapeHtml(s)
      : String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function initials(name) {
    return typeof window.getInitials === 'function'
      ? window.getInitials(name, '')
      : (String(name || '?').charAt(0).toUpperCase());
  }

  /* ════════════════════════════════════════════════════════════
     1. "MYSELF" CHAT — rename + force-pinned + 👤 avatar
     ════════════════════════════════════════════════════════════ */
  waitForFn('getSavedMessagesItem', function () {
    var _o = window.getSavedMessagesItem;
    window.getSavedMessagesItem = function () {
      var item = _o ? _o() : {};
      return Object.assign({}, item, {
        name: 'Myself',
        avatar: '&#128100;',
        preview: 'Your personal notes, files & reminders',
        isPinned: true,
      });
    };
  });

  waitForFn('startSavedMessages', function () {
    var _o = window.startSavedMessages;
    window.startSavedMessages = async function () {
      await _o();
      var nameEl   = document.getElementById('currentChatName');
      var statusEl = document.getElementById('chatStatus');
      if (nameEl)   nameEl.textContent   = 'Myself';
      if (statusEl) statusEl.textContent = 'Your personal notes, files & reminders';
      if (typeof window.setChatHeaderAvatar === 'function') window.setChatHeaderAvatar('&#128100;');
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
      var requestList    = document.getElementById('requestList');
      if (!requestList) return;
      var requestSection = document.querySelector('.request-section');
      var requestToggle  = document.getElementById('requestToggle');
      var badge          = document.getElementById('requestBadge');
      var db  = window.db;
      var uid = window.currentUser.uid;

      try {
        var results = await Promise.all([
          db.collection('chatRequests').where('toUserId',   '==', uid).where('status','==','pending').get(),
          db.collection('chatRequests').where('fromUserId', '==', uid).where('status','==','pending').get(),
          db.collection('groupInvites').where('toUserId',   '==', uid).where('status','==','pending').get(),
          db.collection('chatRequests').where('fromUserId', '==', uid).where('status','==','accepted').get(),
        ]);
        var receivedSnap = results[0], sentSnap = results[1],
            groupSnap   = results[2], acceptedSnap = results[3];

        var all = [].concat(
          receivedSnap.docs.map(function(d){ return Object.assign({id:d.id,direction:'incoming',requestType:'chat',_kind:'received'},d.data()); }),
          sentSnap.docs.map(function(d){     return Object.assign({id:d.id,direction:'outgoing',requestType:'chat',_kind:'sent'},d.data()); }),
          groupSnap.docs.map(function(d){    return Object.assign({id:d.id,direction:'incoming',requestType:'group',_kind:'received'},d.data()); }),
          acceptedSnap.docs.map(function(d){ return Object.assign({id:d.id,direction:'outgoing',requestType:'chat',_kind:'accepted'},d.data()); })
        ).sort(function(a,b){
          return ((b.createdAt&&b.createdAt.toMillis)?b.createdAt.toMillis():0)
               - ((a.createdAt&&a.createdAt.toMillis)?a.createdAt.toMillis():0);
        });

        /* badge = total across all 3 types */
        var total = receivedSnap.size + sentSnap.size + groupSnap.size + acceptedSnap.size;
        if (badge) {
          if (total > 0) {
            badge.textContent = total > 99 ? '99+' : String(total);
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

        if (!all.length) {
          requestList.innerHTML = '<div class="empty-state">No requests</div>';
          if (requestSection) requestSection.classList.remove('expanded');
          if (requestToggle)  requestToggle.textContent = '▼';
          if (requestSection) requestSection.style.display = 'none';
          return;
        }
        if (requestSection) requestSection.style.display = '';

        var meta = {
          received: { emoji:'🔵', label:'Received', cls:'cf-pill-received' },
          sent:     { emoji:'🟡', label:'Sent',     cls:'cf-pill-sent'     },
          accepted: { emoji:'✅', label:'Accepted', cls:'cf-pill-accepted' },
        };

        all.forEach(function (req) {
          var isGroup    = req.requestType === 'group';
          var isAccepted = req._kind === 'accepted';
          var isOutgoing = req.direction === 'outgoing';
          var displayName = (isAccepted || isOutgoing)
            ? (req.toUserName   || req.toUserEmail   || 'User')
            : isGroup ? (req.groupName || 'Group invite')
            : (req.fromUserName || 'User');

          var k = meta[req._kind] || meta.received;
          var previewText = isGroup    ? 'Group invite'
            : isAccepted              ? 'Chat accepted'
            : isOutgoing              ? 'Pending request'
            : 'Wants to chat' + (req.fromUserEmail ? ' · ' + esc(req.fromUserEmail) : '');

          var actionsHtml = isAccepted
            ? '<button class="btn btn-success cf-open-btn"    data-to="'+esc(req.toUserId||'')+'">Open Chat</button>'
            : isOutgoing
              ? '<button class="btn btn-outline cf-cancel-btn"  data-id="'+esc(req.id)+'">Cancel</button>'
              : '<button class="btn btn-success cf-accept-btn"  data-type="'+esc(req.requestType)+'" data-id="'+esc(req.id)+'" data-from="'+esc(req.fromUserId||'')+'">Accept</button>'
              + '<button class="btn btn-outline cf-decline-btn" data-type="'+esc(req.requestType)+'" data-id="'+esc(req.id)+'">Decline</button>'
              + '<button class="btn btn-outline cf-block-btn"   data-type="'+esc(req.requestType)+'" data-id="'+esc(req.id)+'" data-from="'+esc(req.fromUserId||'')+'" data-name="'+esc(req.fromUserName||'User')+'">Block</button>';

          var div = document.createElement('div');
          div.className = 'list-item request-card';
          div.innerHTML =
            '<div class="list-avatar">'+esc(initials(displayName))+'</div>'
          + '<div class="list-info">'
          +   '<div class="list-name">'+esc(displayName)+'</div>'
          +   '<div class="list-preview cf-req-preview">'
          +     '<span class="cf-pill '+k.cls+'">'+k.emoji+' '+k.label+'</span>'
          +     '<span class="cf-req-text">'+esc(previewText)+'</span>'
          +   '</div>'
          + '</div>'
          + '<div class="request-actions cf-req-actions">'+actionsHtml+'</div>';
          requestList.appendChild(div);
        });

        /* event wiring */
        requestList.querySelectorAll('.cf-open-btn').forEach(function(b){
          b.addEventListener('click', async function(e){
            e.stopPropagation();
            if (b.dataset.to && typeof window.startDirectChat==='function')
              await window.startDirectChat({id:b.dataset.to});
          });
        });
        requestList.querySelectorAll('.cf-accept-btn').forEach(function(b){
          b.addEventListener('click', async function(e){
            e.stopPropagation(); b.disabled=true;
            try {
              if (b.dataset.type==='group') await window.acceptGroupInvite(b.dataset.id);
              else                          await window.acceptChatRequest(b.dataset.id, b.dataset.from);
            } finally { b.disabled=false; }
          });
        });
        requestList.querySelectorAll('.cf-decline-btn').forEach(function(b){
          b.addEventListener('click', async function(e){
            e.stopPropagation();
            if (b.dataset.type==='group') await window.declineGroupInvite(b.dataset.id);
            else                          await window.declineChatRequest(b.dataset.id);
          });
        });
        requestList.querySelectorAll('.cf-cancel-btn').forEach(function(b){
          b.addEventListener('click', async function(e){
            e.stopPropagation(); b.disabled=true;
            try { await window.cancelChatRequest(b.dataset.id); } finally { b.disabled=false; }
          });
        });
        requestList.querySelectorAll('.cf-block-btn').forEach(function(b){
          b.addEventListener('click', async function(e){
            e.stopPropagation();
            await window.blockRequestSender(b.dataset.type, b.dataset.id, b.dataset.from, b.dataset.name);
          });
        });

      } catch (err) {
        console.warn('[chat-fixes] loadReceivedRequests:', err);
        if (badge) { badge.textContent=''; badge.classList.remove('show'); badge.style.display='none'; }
      }
    };
  });

  /* ════════════════════════════════════════════════════════════
     3. CHAT PINNING — single consolidated implementation
     ════════════════════════════════════════════════════════════ */
  waitForFn('togglePinChat', function () {
    window.togglePinChat = async function (chatId) {
      if (!window.currentUser || !chatId) return;
      var db      = window.db;
      var userRef = db.collection('users').doc(window.currentUser.uid);
      var ids     = window.pinnedChatIds || [];
      var pinned  = ids.includes(chatId);
      if (pinned) {
        await userRef.update({ pinnedChatIds: firebase.firestore.FieldValue.arrayRemove(chatId) });
        window.pinnedChatIds = ids.filter(function(id){ return id!==chatId; });
        window.showToast('Chat unpinned');
      } else {
        await userRef.update({ pinnedChatIds: firebase.firestore.FieldValue.arrayUnion(chatId) });
        window.pinnedChatIds = ids.concat([chatId]);
        window.showToast('Chat pinned to top');
      }
      if (typeof window.loadCurrentChatList==='function') window.loadCurrentChatList();
      else {
        if (typeof window.loadChatsList   ==='function') window.loadChatsList();
        if (typeof window.loadGroupsList  ==='function') window.loadGroupsList();
      }
    };
  });

  /* ════════════════════════════════════════════════════════════
     4. MESSAGE PINNING — groups shared, direct personal, limit 20
     ════════════════════════════════════════════════════════════ */
  waitForFn('pinMessage', function () {
    window.pinMessage = async function (messageId, messageData) {
      if (!window.currentChat || !window.currentUser) return;
      var db      = window.db;
      var isGroup = window.currentChatType === 'group';

      var q = db.collection('pinnedMessages').where('chatId','==',window.currentChat.id);
      if (!isGroup) q = q.where('userId','==',window.currentUser.uid);
      var existing = await q.get();
      if (existing.size >= 20) { window.showToast('Max 20 pinned messages','error'); return; }

      var pin = {
        chatId:      window.currentChat.id,
        messageId:   messageId,
        text:        messageData.text        || '',
        senderName:  messageData.senderName  || '',
        timestamp:   messageData.timestamp   || null,
        pinnedAt:    firebase.firestore.FieldValue.serverTimestamp(),
        pinnedBy:    window.currentUser.uid,
        pinnedByName:window.currentUser.displayName || window.currentUser.email || '',
        isGroupPin:  isGroup,
      };
      if (!isGroup) pin.userId = window.currentUser.uid;

      await db.collection('pinnedMessages').add(pin);
      window.showToast('Message pinned');
      window.loadPinnedMessages();
    };
  });

  waitForFn('loadPinnedMessages', function () {
    window.loadPinnedMessages = async function () {
      if (!window.currentChat || !window.currentUser) return;
      var db      = window.db;
      var isGroup = window.currentChatType === 'group';

      var q = db.collection('pinnedMessages').where('chatId','==',window.currentChat.id);
      if (!isGroup) q = q.where('userId','==',window.currentUser.uid);

      var snap;
      try { snap = await q.orderBy('pinnedAt','desc').get(); }
      catch (_) {
        snap = await q.get();
        var sorted = snap.docs.slice().sort(function(a,b){
          var tA = a.data().pinnedAt&&a.data().pinnedAt.toDate ? a.data().pinnedAt.toDate() : new Date(0);
          var tB = b.data().pinnedAt&&b.data().pinnedAt.toDate ? b.data().pinnedAt.toDate() : new Date(0);
          return tB - tA;
        });
        snap = { docs: sorted };
      }

      window.pinnedMessages = snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); });

      var pinnedSection = document.getElementById('pinnedSection');
      var pinnedList    = document.getElementById('pinnedMessagesList');
      var pinnedCount   = document.getElementById('pinnedCount');
      if (!pinnedSection) return;

      if (!window.pinnedMessages.length) { pinnedSection.style.display='none'; return; }
      pinnedSection.style.display = 'block';
      if (pinnedCount) pinnedCount.textContent = '📌 ' + window.pinnedMessages.length;

      if (pinnedList) {
        pinnedList.innerHTML = '';
        window.pinnedMessages.forEach(function (p) {
          var byLine = isGroup && p.pinnedByName ? ' · by '+esc(p.pinnedByName) : '';
          var div = document.createElement('div');
          div.className = 'pinned-message-item cf-pin-item';
          div.innerHTML =
            '<span class="cf-pin-icon">📌</span>'
          + '<div class="cf-pin-body">'
          +   '<div class="cf-pin-sender">'+esc(p.senderName||'')+byLine+'</div>'
          +   '<div class="cf-pin-text">'+esc((p.text||'').substring(0,60)||'📎 Media')+'</div>'
          + '</div>'
          + '<button class="unpin-btn cf-unpin-btn" data-id="'+esc(p.id)+'" title="Unpin">✖</button>';

          div.addEventListener('click', function(e){
            if (e.target.classList.contains('cf-unpin-btn')) return;
            var el = document.querySelector('[data-message-id="'+p.messageId+'"]');
            if (el) {
              el.scrollIntoView({behavior:'smooth',block:'center'});
              el.classList.add('cf-highlight');
              setTimeout(function(){ el.classList.remove('cf-highlight'); }, 1800);
            } else {
              window.showToast('Scroll up to find the pinned message');
            }
          });
          div.querySelector('.cf-unpin-btn').addEventListener('click', async function(e){
            e.stopPropagation();
            await window.unpinMessage(p.id);
          });
          pinnedList.appendChild(div);
        });
      }
    };
  });

  /* ════════════════════════════════════════════════════════════
     5. RESPONSIVE CSS — web + Capacitor safe-area aware
     ════════════════════════════════════════════════════════════ */
  var style = document.createElement('style');
  style.id = 'chat-fixes-css';
  style.textContent = '\
/* ── scroll-to highlight ─────────────────────────────── */\
.cf-highlight { animation: cfHL 1.8s ease; }\
@keyframes cfHL { 0%,100%{background:transparent} 25%,75%{background:rgba(0,150,136,.22)} }\
\
/* ── Myself avatar ring ──────────────────────────────── */\
.cf-myself-avatar { border:2px solid #25d366 !important; border-radius:50% !important; }\
\
/* ── Kind pill labels ───────────────────────────────── */\
.cf-pill {\
  display:inline-flex; align-items:center;\
  font-size:10px; font-weight:700; line-height:1;\
  padding:2px 7px; border-radius:10px;\
  flex-shrink:0; white-space:nowrap;\
}\
.cf-pill-received { color:#1565c0; background:#e3f0ff; }\
.cf-pill-sent     { color:#e65100; background:#fff3e0; }\
.cf-pill-accepted { color:#2e7d32; background:#e8f5e9; }\
\
/* ── Request preview row ─────────────────────────────── */\
.cf-req-preview {\
  display:flex; align-items:center; gap:5px;\
  flex-wrap:wrap; max-width:100%;\
}\
.cf-req-text { font-size:11px; color:var(--muted-strong,#888); }\
\
/* ── Request actions ─────────────────────────────────── */\
.cf-req-actions {\
  display:flex; flex-wrap:wrap; gap:5px;\
  justify-content:flex-end;\
  margin-top:4px;\
}\
\
/* ── Pinned bar ──────────────────────────────────────── */\
#pinnedSection { max-height:140px; overflow-y:auto; }\
.cf-pin-item {\
  display:flex; align-items:center; gap:8px;\
  padding:7px 10px; cursor:pointer;\
  border-bottom:1px solid var(--border,#f0f0f0);\
  min-height:44px;\
}\
.cf-pin-item:hover, .cf-pin-item:active { background:var(--panel-hover,#f5f5f5); }\
.cf-pin-icon { font-size:14px; flex-shrink:0; }\
.cf-pin-body { flex:1; min-width:0; }\
.cf-pin-sender {\
  font-weight:600; font-size:11px;\
  color:var(--primary,#075e54);\
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;\
}\
.cf-pin-text {\
  font-size:12px; color:#555;\
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;\
}\
.cf-unpin-btn {\
  background:none; border:none; cursor:pointer;\
  color:#aaa; font-size:16px; padding:4px 6px;\
  flex-shrink:0; line-height:1;\
  min-width:32px; min-height:32px;\
  display:flex; align-items:center; justify-content:center;\
}\
.cf-unpin-btn:hover { color:#e53935; }\
\
/* ════ RESPONSIVE BREAKPOINTS ════════════════════════════ */\
\
/* Tablet / small desktop: ≤ 720px */\
@media (max-width:720px) {\
  .cf-req-actions { justify-content:flex-start; }\
  .cf-req-actions .btn { font-size:11px; padding:0 8px; min-height:28px; }\
}\
\
/* Mobile: ≤ 520px */\
@media (max-width:520px) {\
  .request-card { flex-wrap:wrap; padding:8px; }\
  .cf-req-actions { width:100%; justify-content:flex-start; margin-top:6px; }\
  .cf-req-actions .btn { flex:1 1 auto; min-height:32px; font-size:11px; text-align:center; }\
  .cf-pin-item { padding:6px 8px; }\
  .cf-pill { font-size:9px; padding:2px 5px; }\
  #pinnedSection { max-height:110px; }\
}\
\
/* Small mobile: ≤ 380px */\
@media (max-width:380px) {\
  .cf-req-actions .btn { font-size:10px; padding:0 6px; min-height:30px; }\
  .cf-pill { font-size:9px; }\
  .cf-pin-sender, .cf-pin-text { font-size:10px; }\
}\
\
/* Capacitor / Standalone PWA: add bottom safe-area to lists */\
@media (display-mode:standalone) {\
  #pinnedSection { padding-bottom:env(safe-area-inset-bottom,0px); }\
  .request-section { padding-bottom:env(safe-area-inset-bottom,0px); }\
}\
\
/* Dark mode */\
@media (prefers-color-scheme:dark) {\
  .cf-pill-received { color:#90caf9; background:#1a2a3a; }\
  .cf-pill-sent     { color:#ffcc80; background:#2a1a0a; }\
  .cf-pill-accepted { color:#a5d6a7; background:#0a2a0a; }\
  .cf-pin-item { border-bottom-color:var(--border,#333); }\
  .cf-pin-text { color:#aaa; }\
}\
';
  document.head.appendChild(style);

  console.log('[chat-fixes] v2 applied ✓');
})();
