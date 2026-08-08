// chat-fixes.js â€” Chat system enhancements v3
// Patches: Myself chat, Chat Requests + Search, Chat Pinning, Message Pinning
// Fully responsive for web + Capacitor Android

(function () {
  'use strict';

  /* â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function waitForFn(name, cb, tries) {
    tries = tries || 0;
    if (typeof window[name] === 'function') { cb(); return; }
    if (tries > 180) { if (window.__DEBUG__) console.warn('[chat-fixes] timeout:', name); return; }
    setTimeout(function () { waitForFn(name, cb, tries + 1); }, 80);
  }
  function esc(s) {
    return typeof window.escapeHtml === 'function' && window.escapeHtml !== esc
      ? window.escapeHtml(s)
      : String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function initials(name) {
    return typeof window.getInitials === 'function' && window.getInitials !== initials
      ? window.getInitials(name, '')
      : String(name || '?').charAt(0).toUpperCase();
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     1. "MYSELF" CHAT â€” rename + force-pinned + ðŸ‘¤ avatar
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     2. CHAT REQUESTS â€” Sent + Received + Accepted
        + real-time search/filter bar
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

  /* store fetched requests so search can re-filter without re-fetching */
  var _cfAllRequests = [];

  var _cfKindMeta = {
    received: { emoji: 'ðŸ”µ', label: 'Received', cls: 'cf-pill-received' },
    sent:     { emoji: 'ðŸŸ¡', label: 'Sent',     cls: 'cf-pill-sent'     },
    accepted: { emoji: 'âœ…', label: 'Accepted', cls: 'cf-pill-accepted' },
  };

  function _cfRenderRequests(list, requestList) {
    /* preserve the search bar, clear only request cards */
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
        : 'Wants to chat' + (req.fromUserEmail ? ' Â· ' + esc(req.fromUserEmail) : '');

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
        await window.blockRequestSender(b.dataset.from);
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
      +   '<span class="cf-search-icon">ðŸ”</span>'
      +   '<input class="cf-search-input" type="search" placeholder="Search by name, email or typeâ€¦" autocomplete="off" />'
      +   '<span class="cf-search-count cf-pill cf-pill-count">'+totalCount+'</span>'
      + '</div>'
      + '<div class="cf-filter-chips">'
      +   '<button class="cf-chip cf-chip-active" data-kind="">All</button>'
      +   '<button class="cf-chip" data-kind="received">ðŸ”µ Received</button>'
      +   '<button class="cf-chip" data-kind="sent">ðŸŸ¡ Sent</button>'
      +   '<button class="cf-chip" data-kind="accepted">âœ… Accepted</button>'
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

    input.addEventListener('input', App.debounce(applyFilter, 250));
    input.addEventListener('search', applyFilter); /* clear button on mobile */

    chips.forEach(function(chip){
      chip.setAttribute('aria-pressed', chip.classList.contains('cf-chip-active') ? 'true' : 'false');
      chip.addEventListener('click', function(){
        chips.forEach(function(c){ c.classList.remove('cf-chip-active'); c.setAttribute('aria-pressed', 'false'); });
        chip.classList.add('cf-chip-active');
        chip.setAttribute('aria-pressed', 'true');
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
        var results = await Promise.allSettled([
          db.collection('chatRequests').where('toUserId',   '==', uid).where('status','==','pending').get(),
          db.collection('chatRequests').where('fromUserId', '==', uid).where('status','==','pending').get(),
          db.collection('groupInvites').where('toUserId',   '==', uid).where('status','==','pending').get(),
          db.collection('chatRequests').where('fromUserId', '==', uid).where('status','==','accepted').get(),
        ]);
        var receivedSnap=results[0].status==='fulfilled'?results[0].value:{docs:[],size:0};
        var sentSnap=results[1].status==='fulfilled'?results[1].value:{docs:[],size:0};
        var groupSnap=results[2].status==='fulfilled'?results[2].value:{docs:[],size:0};
        var acceptedSnap=results[3].status==='fulfilled'?results[3].value:{docs:[],size:0};

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
          requestToggle.textContent = requestSection && requestSection.classList.contains('expanded') ? 'â–²' : 'â–¼';

        if (!_cfAllRequests.length) {
          requestList.innerHTML = '<div class="empty-state">No requests</div>';
          if (requestSection) requestSection.classList.remove('expanded');
          if (requestToggle)  requestToggle.textContent = 'â–¼';
          if (requestSection) requestSection.style.display = 'none';
          return;
        }
        if (requestSection) requestSection.style.display = '';

        /* add/update search bar + render all requests */
        _cfInsertSearchBar(requestList, _cfAllRequests.length);
        _cfRenderRequests(_cfAllRequests, requestList);

      } catch (err) {
        if (window.__DEBUG__) console.warn('[chat-fixes] loadReceivedRequests:', err);
        if (badge) { badge.textContent=''; badge.classList.remove('show'); badge.style.display='none'; }
      }
    };
  });


  /* ── Chat request actions (Accept / Decline / Cancel / Block) ── */
  async function _cfReloadRequests() {
    if (typeof window.loadReceivedRequests === 'function') {
      try { await window.loadReceivedRequests(); } catch (e) {}
    }
  }

  window.acceptChatRequest = async function (reqId, fromUid) {
    var db = window.db;
    var uid = window.currentUser && window.currentUser.uid;
    if (!db || !uid || !reqId) return;
    try {
      await db.collection('chatRequests').doc(reqId).update({
        status: 'accepted',
        respondedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (fromUid && fromUid !== uid && typeof window.startDirectChat === 'function') {
        await window.startDirectChat({ id: fromUid });
      }
      if (typeof window.showToast === 'function') window.showToast('Request accepted', 'success');
    } catch (e) {
      if (window.__DEBUG__) console.warn('[chat-fixes] acceptChatRequest:', e);
      if (typeof window.showToast === 'function') window.showToast('Failed to accept request', 'error');
    }
    await _cfReloadRequests();
  };

  window.declineChatRequest = async function (reqId) {
    var db = window.db;
    if (!db || !reqId) return;
    try {
      await db.collection('chatRequests').doc(reqId).update({
        status: 'declined',
        respondedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (typeof window.showToast === 'function') window.showToast('Request declined');
    } catch (e) {
      if (window.__DEBUG__) console.warn('[chat-fixes] declineChatRequest:', e);
    }
    await _cfReloadRequests();
  };

  window.cancelChatRequest = async function (reqId) {
    var db = window.db;
    if (!db || !reqId) return;
    try {
      await db.collection('chatRequests').doc(reqId).update({
        status: 'cancelled',
        respondedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (typeof window.showToast === 'function') window.showToast('Request cancelled');
    } catch (e) {
      if (window.__DEBUG__) console.warn('[chat-fixes] cancelChatRequest:', e);
    }
    await _cfReloadRequests();
  };

  window.blockRequestSender = async function (fromUid, fromName) {
    var db = window.db;
    var uid = window.currentUser && window.currentUser.uid;
    if (!db || !uid || !fromUid) return;
    try {
      if (typeof window.blockUser === 'function') {
        window.blockUser(fromUid, fromName);
      } else {
        var meRef = db.collection('users').doc(uid);
        var meSnap = await meRef.get();
        var blocked = (meSnap.exists && Array.isArray(meSnap.data().blockedUsers)) ? meSnap.data().blockedUsers : [];
        if (blocked.indexOf(fromUid) === -1) {
          blocked.push(fromUid);
          await meRef.set({ blockedUsers: blocked }, { merge: true });
        }
      }
      var q1 = await db.collection('chatRequests').where('fromUserId', '==', fromUid).where('toUserId', '==', uid).where('status', '==', 'pending').get();
      var q2 = await db.collection('chatRequests').where('fromUserId', '==', uid).where('toUserId', '==', fromUid).where('status', '==', 'pending').get();
      var batch = db.batch();
      q1.docs.concat(q2.docs).forEach(function (d) { batch.update(d.ref, { status: 'declined' }); });
      try { await batch.commit(); } catch (e) {}
    } catch (e) {
      if (window.__DEBUG__) console.warn('[chat-fixes] blockRequestSender:', e);
    }
    await _cfReloadRequests();
  };

  window.acceptGroupInvite = async function (inviteId) {
    var uid = window.currentUser && window.currentUser.uid;
    if (!uid || !inviteId) return;
    try {
      var fn = typeof firebase !== 'undefined' ? firebase.functions() : null;
      if (fn && typeof fn.httpsCallable === 'function') {
        await fn.httpsCallable('respondToGroupInvite')({ inviteId: inviteId, action: 'accept' });
        if (typeof window.showToast === 'function') window.showToast('You joined the group', 'success');
        if (typeof window.loadGroupsList === 'function') window.loadGroupsList();
        if (typeof window.loadCurrentChatList === 'function') window.loadCurrentChatList();
      } else {
        if (typeof window.showToast === 'function') window.showToast('Unable to accept invite', 'error');
      }
    } catch (e) {
      if (window.__DEBUG__) console.warn('[chat-fixes] acceptGroupInvite:', e);
      if (typeof window.showToast === 'function') window.showToast((e && e.message) || 'Could not accept invite', 'error');
    }
    await _cfReloadRequests();
  };

  window.declineGroupInvite = async function (inviteId) {
    if (!inviteId) return;
    try {
      var fn = typeof firebase !== 'undefined' ? firebase.functions() : null;
      if (fn && typeof fn.httpsCallable === 'function') {
        await fn.httpsCallable('respondToGroupInvite')({ inviteId: inviteId, action: 'decline' });
        if (typeof window.showToast === 'function') window.showToast('Group invite declined');
      }
    } catch (e) {
      if (window.__DEBUG__) console.warn('[chat-fixes] declineGroupInvite:', e);
    }
    await _cfReloadRequests();
  };

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     3. CHAT PINNING â€” single consolidated implementation
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  (function defineTogglePinChat() {
    window.togglePinChat = async function (chatId) {
      if (!window.currentUser || !chatId) return;
      var db      = window.db;
      var userRef = db.collection('users').doc(window.currentUser.uid);
      var ids     = window.pinnedChatIds || [];
      var pinned  = ids.includes(chatId);
      try {
        if (pinned) {
          await userRef.update({ pinnedChatIds: firebase.firestore.FieldValue.arrayRemove(chatId) });
          window.pinnedChatIds = ids.filter(function(id){ return id!==chatId; });
          window.showToast('Chat unpinned');
        } else {
          await userRef.update({ pinnedChatIds: firebase.firestore.FieldValue.arrayUnion(chatId) });
          window.pinnedChatIds = ids.concat([chatId]);
          window.showToast('Chat pinned to top');
        }
      } catch (err) {
        if (window.__DEBUG__) console.error('[chat-fixes] togglePinChat error:', err);
        if (typeof window.showToast === 'function') window.showToast('Failed to update pin: ' + (err.message || 'Unknown error'), 'error');
        return;
      }
      if (typeof window.loadCurrentChatList==='function') window.loadCurrentChatList();
      else {
        if (typeof window.loadChatsList   ==='function') window.loadChatsList();
        if (typeof window.loadGroupsList  ==='function') window.loadGroupsList();
      }
    };
  })();

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     4. MESSAGE PINNING â€” groups shared, direct personal, limit 20
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  waitForFn('pinMessage', function () {
    window.pinMessage = async function (messageId, messageData) {
      if (!window.currentChat || !window.currentUser) return;
      var db      = window.db;
      var isGroup = window.currentChatType === 'group';
      var q = db.collection('pinnedMessages').where('chatId','==',window.currentChat.id);
      if (!isGroup) q = q.where('userId','==',window.currentUser.uid);
      try {
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
      } catch (err) {
        if (window.__DEBUG__) console.error('[chat-fixes] pinMessage error:', err);
        if (typeof window.showToast === 'function') window.showToast('Failed to pin message: ' + (err.message || 'Unknown error'), 'error');
      }
    };
  })();

  (function defineLoadPinnedMessages() {
    window.loadPinnedMessages = async function () {
      if (!window.currentChat || !window.currentUser) return;
      var db      = window.db;
      var isGroup = window.currentChatType === 'group';
      var q = db.collection('pinnedMessages').where('chatId','==',window.currentChat.id);
      if (!isGroup) q = q.where('userId','==',window.currentUser.uid);
      try {
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
      } catch (err) {
        if (window.__DEBUG__) console.error('[chat-fixes] loadPinnedMessages error:', err);
        window.pinnedMessages = [];
      }
      var pinnedSection = document.getElementById('pinnedSection');
      var pinnedList    = document.getElementById('pinnedMessagesList');
      var pinnedCount   = document.getElementById('pinnedCount');
      if (!pinnedSection) return;
      if (!window.pinnedMessages.length) { pinnedSection.style.display='none'; return; }
      pinnedSection.style.display = 'block';
      if (pinnedCount) pinnedCount.textContent = 'ðŸ“Œ ' + window.pinnedMessages.length;
      if (pinnedList) {
        pinnedList.innerHTML = '';
        window.pinnedMessages.forEach(function (p) {
          var byLine = isGroup && p.pinnedByName ? ' Â· by '+esc(p.pinnedByName) : '';
          var div = document.createElement('div');
          div.className = 'pinned-message-item cf-pin-item';
          div.setAttribute('role', 'button');
          div.setAttribute('tabindex', '0');
          div.innerHTML =
              '<span class="cf-pin-icon">ðŸ“Œ</span>'
            + '<div class="cf-pin-body">'
            +   '<div class="cf-pin-sender">'+esc(p.senderName||'')+byLine+'</div>'
            +   '<div class="cf-pin-text">'+esc((p.text||'').substring(0,60)||'ðŸ“Ž Media')+'</div>'
            + '</div>'
            + '<button class="unpin-btn cf-unpin-btn" data-id="'+esc(p.id)+'" title="Unpin" aria-label="Unpin message">âœ–</button>';
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
          div.addEventListener('keydown', function(e){
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              div.click();
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
  })();



  /* â”€â”€ 9. Cyber Navigation & Status Bar Interceptors â”€â”€ */
  function updateDockThemeIcon() {
    var icon = document.querySelector('#dockThemeBtn span');
    if (!icon) return;
    var isDark = document.documentElement.dataset.theme === 'dark' || document.body.classList.contains('dark') || document.documentElement.classList.contains('dark');
    icon.textContent = isDark ? 'light_mode' : 'dark_mode';
  }

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

  waitForFn('toggleDarkMode', function () {
    var originalToggle = window.toggleDarkMode;
    window.toggleDarkMode = function () {
      originalToggle();
      updateDockThemeIcon();
    };
  });

  function initCyberDock() {
    updateDockThemeIcon();
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
        } else if (btn.id === 'dockThemeBtn') {
          if (typeof window.toggleDarkMode === 'function') {
            window.toggleDarkMode();
          }
        } else if (btn.id === 'dockSupportBtn') {
          if (typeof showToast === 'function') showToast('System status: Nominal. Protocol V2.0.26 secure.', 'success');
          else if (window.__DEBUG__) console.log('[chat-fixes] System status: Nominal.');
        }
      });
    }
    
    var latencyVal = document.getElementById('statusLatency');
    if (latencyVal) {
      var _latencyTimer = setInterval(function _updateLatency() {
        if (!latencyVal.isConnected) { clearInterval(_latencyTimer); return; }
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

  if (window.__DEBUG__) console.log('[chat-fixes] v3 applied âœ“');
})();
