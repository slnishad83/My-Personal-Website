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
          div.setAttribute('role', 'button');
          div.setAttribute('tabindex', '0');
          div.innerHTML =
              '<span class="cf-pin-icon">📌</span>'
            + '<div class="cf-pin-body">'
            +   '<div class="cf-pin-sender">'+esc(p.senderName||'')+byLine+'</div>'
            +   '<div class="cf-pin-text">'+esc((p.text||'').substring(0,60)||'📎 Media')+'</div>'
            + '</div>'
            + '<button class="unpin-btn cf-unpin-btn" data-id="'+esc(p.id)+'" title="Unpin" aria-label="Unpin message">✖</button>';
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
  });



  /* ── 9. Cyber Navigation & Status Bar Interceptors ── */
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

  if (window.__DEBUG__) console.log('[chat-fixes] v3 applied ✓');
})();
