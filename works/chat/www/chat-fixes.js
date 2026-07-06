// chat-fixes.js — Chat system enhancements v3
// Patches: Myself chat, Chat Requests + Search, Chat Pinning, Message Pinning
// Fully responsive for web + Capacitor Android

(function () {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────── */
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
      : String(name || '?').charAt(0).toUpperCase();
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
     2. CHAT REQUESTS — Sent + Received + Accepted
        + real-time search/filter bar
     ════════════════════════════════════════════════════════════ */

  /* store fetched requests so search can re-filter without re-fetching */
  var _cfAllRequests = [];

  var _cfKindMeta = {
    received: { emoji: '🔵', label: 'Received', cls: 'cf-pill-received' },
    sent:     { emoji: '🟡', label: 'Sent',     cls: 'cf-pill-sent'     },
    accepted: { emoji: '✅', label: 'Accepted', cls: 'cf-pill-accepted' },
  };

  function _cfRenderRequests(list, requestList) {
    /* preserve the search bar, clear only request cards */
    var searchWrap = requestList.querySelector('.cf-search-wrap');
    requestList.querySelectorAll('.request-card').forEach(function(el){ el.remove(); });

    if (!list.length) {
      var empty = requestList.querySelector('.cf-empty-filtered');
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'empty-state cf-empty-filtered';
        requestList.appendChild(empty);
      }
      empty.textContent = 'No matching requests';
      return;
    }
    var old = requestList.querySelector('.cf-empty-filtered');
    if (old) old.remove();

    list.forEach(function (req) {
      var isGroup    = req.requestType === 'group';
      var isAccepted = req._kind === 'accepted';
      var isOutgoing = req.direction === 'outgoing';
      var displayName = (isAccepted || isOutgoing)
        ? (req.toUserName   || req.toUserEmail   || 'User')
        : isGroup ? (req.groupName || 'Group invite')
        : (req.fromUserName || 'User');

      var k = _cfKindMeta[req._kind] || _cfKindMeta.received;
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

    /* wire action buttons */
    requestList.querySelectorAll('.cf-open-btn').forEach(function(b){
      b.addEventListener('click', async function(e){
        e.stopPropagation();
        if (b.dataset.to && typeof window.startDirectChat==='function')
          await window.startDirectChat({id: b.dataset.to});
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
  }

  function _cfFilterRequests(term) {
    if (!term) return _cfAllRequests;
    var t = term.toLowerCase();
    return _cfAllRequests.filter(function(r){
      var name = (r.toUserName || r.fromUserName || r.groupName || r.toUserEmail || r.fromUserEmail || '').toLowerCase();
      var email = (r.toUserEmail || r.fromUserEmail || '').toLowerCase();
      var kind = (_cfKindMeta[r._kind] || {}).label || '';
      return name.includes(t) || email.includes(t) || kind.toLowerCase().includes(t);
    });
  }

  function _cfInsertSearchBar(requestList, totalCount) {
    var existing = requestList.querySelector('.cf-search-wrap');
    if (existing) {
      /* just update the count badge, keep existing input value + focus */
      var cb = existing.querySelector('.cf-search-count');
      if (cb) cb.textContent = totalCount;
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'cf-search-wrap';
    wrap.innerHTML =
        '<div class="cf-search-inner">'
      +   '<span class="cf-search-icon">🔍</span>'
      +   '<input class="cf-search-input" type="search" placeholder="Search by name, email or type…" autocomplete="off" />'
      +   '<span class="cf-search-count cf-pill cf-pill-count">'+totalCount+'</span>'
      + '</div>'
      + '<div class="cf-filter-chips">'
      +   '<button class="cf-chip cf-chip-active" data-kind="">All</button>'
      +   '<button class="cf-chip" data-kind="received">🔵 Received</button>'
      +   '<button class="cf-chip" data-kind="sent">🟡 Sent</button>'
      +   '<button class="cf-chip" data-kind="accepted">✅ Accepted</button>'
      + '</div>';

    /* insert before anything else */
    requestList.insertBefore(wrap, requestList.firstChild);

    var input       = wrap.querySelector('.cf-search-input');
    var chips       = wrap.querySelectorAll('.cf-chip');
    var activeKind  = '';

    function applyFilter() {
      var term     = input.value.trim();
      var filtered = _cfFilterRequests(term);
      if (activeKind) filtered = filtered.filter(function(r){ return r._kind === activeKind; });
      _cfRenderRequests(filtered, requestList);
    }

    input.addEventListener('input', applyFilter);
    input.addEventListener('search', applyFilter); /* clear button on mobile */

    chips.forEach(function(chip){
      chip.addEventListener('click', function(){
        chips.forEach(function(c){ c.classList.remove('cf-chip-active'); });
        chip.classList.add('cf-chip-active');
        activeKind = chip.dataset.kind;
        applyFilter();
      });
    });
  }

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
        var receivedSnap=results[0], sentSnap=results[1], groupSnap=results[2], acceptedSnap=results[3];

        _cfAllRequests = [].concat(
          receivedSnap.docs.map(function(d){ return Object.assign({id:d.id,direction:'incoming',requestType:'chat',_kind:'received'},d.data()); }),
          sentSnap.docs.map(function(d){     return Object.assign({id:d.id,direction:'outgoing',requestType:'chat',_kind:'sent'},d.data()); }),
          groupSnap.docs.map(function(d){    return Object.assign({id:d.id,direction:'incoming',requestType:'group',_kind:'received'},d.data()); }),
          acceptedSnap.docs.map(function(d){ return Object.assign({id:d.id,direction:'outgoing',requestType:'chat',_kind:'accepted'},d.data()); })
        ).sort(function(a,b){
          return ((b.createdAt&&b.createdAt.toMillis)?b.createdAt.toMillis():0)
               - ((a.createdAt&&a.createdAt.toMillis)?a.createdAt.toMillis():0);
        });

        /* badge = total */
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

        if (!_cfAllRequests.length) {
          requestList.innerHTML = '<div class="empty-state">No requests</div>';
          if (requestSection) requestSection.classList.remove('expanded');
          if (requestToggle)  requestToggle.textContent = '▼';
          if (requestSection) requestSection.style.display = 'none';
          return;
        }
        if (requestSection) requestSection.style.display = '';

        /* add/update search bar + render all requests */
        _cfInsertSearchBar(requestList, _cfAllRequests.length);
        _cfRenderRequests(_cfAllRequests, requestList);

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
        chatId:       window.currentChat.id,
        messageId:    messageId,
        text:         messageData.text        || '',
        senderName:   messageData.senderName  || '',
        timestamp:    messageData.timestamp   || null,
        pinnedAt:     firebase.firestore.FieldValue.serverTimestamp(),
        pinnedBy:     window.currentUser.uid,
        pinnedByName: window.currentUser.displayName || window.currentUser.email || '',
        isGroupPin:   isGroup,
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
     5. CSS — fully responsive + dark mode + Capacitor safe-area
     ════════════════════════════════════════════════════════════ */
  var style = document.createElement('style');
  style.id = 'chat-fixes-css';
  style.textContent = '\
/* highlight on scroll-to */\
.cf-highlight{animation:cfHL 1.8s ease}\
@keyframes cfHL{0%,100%{background:transparent}25%,75%{background:rgba(0,150,136,.22)}}\
\
/* ── Kind pills ──────────────────────────────────── */\
.cf-pill{display:inline-flex;align-items:center;font-size:10px;font-weight:700;\
  line-height:1;padding:2px 7px;border-radius:10px;flex-shrink:0;white-space:nowrap}\
.cf-pill-received{color:#1565c0;background:#e3f0ff}\
.cf-pill-sent{color:#e65100;background:#fff3e0}\
.cf-pill-accepted{color:#2e7d32;background:#e8f5e9}\
.cf-pill-count{color:#555;background:#f0f0f0;font-size:11px;min-width:22px;\
  justify-content:center;border-radius:12px;padding:2px 8px}\
\
/* ── Request preview row ─────────────────────────── */\
.cf-req-preview{display:flex;align-items:center;gap:5px;flex-wrap:wrap;max-width:100%}\
.cf-req-text{font-size:11px;color:var(--muted-strong,#888)}\
.cf-req-actions{display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end;margin-top:4px}\
\
/* ── Search bar wrapper ──────────────────────────── */\
.cf-search-wrap{\
  padding:8px 10px 6px;\
  border-bottom:1px solid var(--border,#eee);\
  background:var(--panel,#fff);\
  position:sticky;top:0;z-index:10;\
}\
.cf-search-inner{\
  display:flex;align-items:center;gap:6px;\
  background:var(--input-bg,#f0f2f5);\
  border-radius:20px;padding:5px 12px;\
  border:1px solid var(--border,#e0e0e0);\
}\
.cf-search-icon{font-size:13px;flex-shrink:0;opacity:.6}\
.cf-search-input{\
  flex:1;border:none;background:transparent;outline:none;\
  font-size:13px;color:var(--text,#111);\
  min-width:0;padding:0;\
}\
.cf-search-input::placeholder{color:var(--muted,#aaa)}\
\
/* ── Filter chips ────────────────────────────────── */\
.cf-filter-chips{\
  display:flex;gap:6px;flex-wrap:nowrap;\
  overflow-x:auto;padding:6px 2px 2px;\
  scrollbar-width:none;\
}\
.cf-filter-chips::-webkit-scrollbar{display:none}\
.cf-chip{\
  flex-shrink:0;border:1px solid var(--border,#e0e0e0);\
  border-radius:16px;padding:4px 12px;\
  font-size:11px;font-weight:600;\
  background:var(--panel,#fff);color:var(--text,#333);\
  cursor:pointer;white-space:nowrap;\
  transition:background .15s,color .15s;\
}\
.cf-chip:hover{background:var(--panel-hover,#f5f5f5)}\
.cf-chip-active{\
  background:var(--brand,#075e54) !important;\
  color:#fff !important;border-color:var(--brand,#075e54) !important;\
}\
\
/* ── Pinned bar ──────────────────────────────────── */\
#pinnedSection{max-height:140px;overflow-y:auto}\
.cf-pin-item{\
  display:flex;align-items:center;gap:8px;\
  padding:7px 10px;cursor:pointer;\
  border-bottom:1px solid var(--border,#f0f0f0);min-height:44px;\
}\
.cf-pin-item:hover,.cf-pin-item:active{background:var(--panel-hover,#f5f5f5)}\
.cf-pin-icon{font-size:14px;flex-shrink:0}\
.cf-pin-body{flex:1;min-width:0}\
.cf-pin-sender{font-weight:600;font-size:11px;color:var(--primary,#075e54);\
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.cf-pin-text{font-size:12px;color:#555;\
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.cf-unpin-btn{\
  background:none;border:none;cursor:pointer;color:#aaa;\
  font-size:16px;padding:4px 6px;flex-shrink:0;line-height:1;\
  min-width:32px;min-height:32px;\
  display:flex;align-items:center;justify-content:center;\
}\
.cf-unpin-btn:hover{color:#e53935}\
\
/* ══ RESPONSIVE ═══════════════════════════════════════════ */\
@media(max-width:720px){\
  .cf-req-actions{justify-content:flex-start}\
  .cf-req-actions .btn{font-size:11px;padding:0 8px;min-height:28px}\
}\
@media(max-width:520px){\
  .request-card{flex-wrap:wrap;padding:8px}\
  .cf-req-actions{width:100%;justify-content:flex-start;margin-top:6px}\
  .cf-req-actions .btn{flex:1 1 auto;min-height:32px;font-size:11px;text-align:center}\
  .cf-pin-item{padding:6px 8px}\
  .cf-pill{font-size:9px;padding:2px 5px}\
  #pinnedSection{max-height:110px}\
  .cf-search-inner{padding:4px 10px}\
  .cf-search-input{font-size:12px}\
  .cf-chip{font-size:10px;padding:3px 9px}\
}\
@media(max-width:380px){\
  .cf-req-actions .btn{font-size:10px;padding:0 6px;min-height:30px}\
  .cf-chip{font-size:9px;padding:3px 7px}\
  .cf-pin-sender,.cf-pin-text{font-size:10px}\
}\
\
/* Capacitor / standalone PWA — safe-area */\
@media(display-mode:standalone){\
  #pinnedSection{padding-bottom:env(safe-area-inset-bottom,0px)}\
  .request-section{padding-bottom:env(safe-area-inset-bottom,0px)}\
  .cf-search-wrap{padding-top:max(8px,env(safe-area-inset-top,8px))}\
}\
\
/* Dark mode */\
@media(prefers-color-scheme:dark){\
  .cf-pill-received{color:#90caf9;background:#1a2a3a}\
  .cf-pill-sent{color:#ffcc80;background:#2a1a0a}\
  .cf-pill-accepted{color:#a5d6a7;background:#0a2a0a}\
  .cf-pill-count{color:#ccc;background:#333}\
  .cf-search-inner{background:var(--input-bg,#2a2a2a);border-color:#444}\
  .cf-search-input{color:var(--text,#eee)}\
  .cf-chip{background:var(--panel,#1e1e1e);color:var(--text,#ddd);border-color:#444}\
  .cf-chip:hover{background:var(--panel-hover,#2a2a2a)}\
  .cf-pin-item{border-bottom-color:var(--border,#333)}\
  .cf-pin-text{color:#aaa}\
}\
';
  document.head.appendChild(style);

  /* ── 9. Cyber Navigation & Status Bar Interceptors ── */
  waitForFn('switchTab', function () {
    var originalSwitchTab = window.switchTab;
    window.switchTab = function (tab) {
      originalSwitchTab(tab);
      document.querySelectorAll('.nav-dock-item').forEach(function (btn) {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
          btn.classList.add('active');
        }
      });
    };
  });

  function initCyberDock() {
    var leftNavDock = document.getElementById('leftNavDock');
    if (leftNavDock) {
      leftNavDock.addEventListener('click', function (e) {
        var btn = e.target.closest('.nav-dock-item');
        if (!btn) return;
        
        var tab = btn.dataset.tab;
        if (tab) {
          if (typeof window.switchTab === 'function') {
            window.switchTab(tab);
          }
        } else if (btn.id === 'dockSavedBtn') {
          if (typeof window.startSavedMessages === 'function') {
            window.startSavedMessages();
          }
        } else if (btn.id === 'dockArchiveBtn') {
          var header = document.getElementById('archiveHeader');
          if (header) header.click();
        } else if (btn.id === 'dockSettingsBtn' || btn.id === 'dockProfileBtn') {
          if (typeof window.showProfileModal === 'function') {
            window.showProfileModal();
          }
        } else if (btn.id === 'dockSupportBtn') {
          alert('System status: Nominal. Protocol V2.0.26 secure.');
        }
      });
    }
    
    var latencyVal = document.getElementById('statusLatency');
    if (latencyVal) {
      setInterval(function () {
        var ms = Math.floor(Math.random() * 6) + 6;
        latencyVal.textContent = ms + 'ms';
      }, 6000);
    }
  }
  
  if (document.readyState !== 'loading') {
    initCyberDock();
  } else {
    document.addEventListener('DOMContentLoaded', initCyberDock);
  }

  console.log('[chat-fixes] v3 applied ✓');
})();
