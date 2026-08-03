/**
 * tab-engine.js — NSL Chat Tab & Navigation Engine v1.0
 *
 * Provides:
 *  1. window.switchTab(tab)        — switch between chats/groups/calls/saved/more
 *  2. Left nav + bottom nav active states
 *  3. Sidebar search (filterChats, clearSidebarSearch, handleSidebarSearch)
 *  4. Panels: Groups list, Call History list, Saved Messages panel
 *  5. Delegates data-action="switchTab" clicks to window.switchTab
 *  6. Delegates data-action="filterChats" / "clearSidebarSearch"
 */
'use strict';

(function () {

  /* ── Helpers ─────────────────────────────────────────────────── */
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function getDB()   { return window.db || (window.App && window.App.db); }
  function getUID()  { var u = window.currentUser || (window.App && window.App.currentUser); return u && u.uid; }
  function timeAgo(ts) {
    if (!ts) return '';
    var ms;
    if (ts && typeof ts.toMillis === 'function') ms = ts.toMillis();
    else if (ts && typeof ts.seconds === 'number') ms = ts.seconds * 1000;
    else if (ts instanceof Date) ms = ts.getTime();
    else if (typeof ts === 'number') ms = ts;
    else return '';
    var diff = Date.now() - ms, secs = Math.floor(diff / 1000), mins = Math.floor(secs / 60), hrs = Math.floor(mins / 60), days = Math.floor(hrs / 24);
    if (secs < 60) return 'now';
    if (mins < 60) return mins + 'm';
    if (hrs < 24) return hrs + 'h';
    if (days < 7) return days + 'd';
    var d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function initials(name) {
    if (!name) return '?';
    var p = String(name).trim().split(/\s+/);
    return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }
  function avatarEl(name, photo, sz) {
    sz = sz || '44px';
    var colors = ['#00a884','#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444','#6366f1'];
    var col = colors[(name||'').charCodeAt(0) % colors.length] || '#00a884';
    if (photo) {
      return '<div style="position:relative;flex-shrink:0;width:'+sz+';height:'+sz+';">' +
        '<img src="'+esc(photo)+'" alt="'+esc(name)+'" style="width:'+sz+';height:'+sz+';border-radius:50%;object-fit:cover;" ' +
        'onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\';">' +
        '<div style="display:none;width:'+sz+';height:'+sz+';border-radius:50%;align-items:center;justify-content:center;background:'+col+';color:#fff;font-weight:700;font-size:16px;">'+esc(initials(name))+'</div>' +
        '</div>';
    }
    return '<div style="width:'+sz+';height:'+sz+';border-radius:50%;display:flex;align-items:center;justify-content:center;background:'+col+';color:#fff;font-weight:700;font-size:16px;flex-shrink:0;">'+esc(initials(name))+'</div>';
  }

  /* ── State ───────────────────────────────────────────────────── */
  var _currentTab = 'chats';
  var _groupsUnsub = null;
  var _callsUnsub  = null;

  /* ── Panel containers ────────────────────────────────────────── */
  function getChatListEl() { return document.getElementById('chat-list'); }
  function getSidebarEl()  { return document.getElementById('chat-list-sidebar'); }

  /* ── Panel: Groups ──────────────────────────────────────────── */
  function _ensureGroupsPanel() {
    var el = document.getElementById('_te_groups_panel');
    if (!el) {
      el = document.createElement('div');
      el.id = '_te_groups_panel';
      el.style.cssText = 'display:none;flex:1;overflow-y:auto;padding:8px;';
      var sidebar = getSidebarEl();
      if (sidebar) sidebar.appendChild(el);
    }
    return el;
  }

  function _loadGroups() {
    var panel = _ensureGroupsPanel();
    var db = getDB(), uid = getUID();
    if (!db || !uid) {
      panel.innerHTML = '<div style="padding:24px;text-align:center;color:var(--on-surface-variant,#8696a0);font-size:13px;">Sign in to see groups</div>';
      return;
    }
    panel.innerHTML = '<div style="padding:24px;text-align:center;color:var(--on-surface-variant,#8696a0);font-size:13px;">Loading groups...</div>';

    if (_groupsUnsub) { _groupsUnsub(); _groupsUnsub = null; }

    try {
      _groupsUnsub = db.collection('groups')
        .where('members', 'array-contains', uid)
        .limit(100)
        .onSnapshot(function(snap) {
          if (!snap.docs.length) {
            panel.innerHTML = _emptyState('group', 'No Groups Yet', 'Create a group to message multiple people at once.');
            return;
          }
          var frag = document.createDocumentFragment();
          snap.docs
            .sort(function(a, b) {
              var tms = function(t) { return t && t.toMillis ? t.toMillis() : (t && t.seconds ? t.seconds*1000 : 0); };
              return tms(b.data().lastMessageAt) - tms(a.data().lastMessageAt);
            })
            .forEach(function(doc) {
              var d = doc.data();
              frag.appendChild(_buildListItem({
                id: doc.id, type: 'group',
                name: d.name || 'Group',
                photo: d.photoURL || d.avatar || '',
                preview: d.lastMessage || d.lastMessageText || (d.description ? d.description.substring(0,40) : ''),
                time: d.lastMessageAt || d.updatedAt,
                unread: (d.unreadCounts && d.unreadCounts[uid]) || 0,
                memberCount: (d.members || []).length,
              }));
            });
          panel.innerHTML = '';
          panel.appendChild(frag);
        }, function() {
          panel.innerHTML = _emptyState('group', 'Could not load groups', 'Check your connection and try again.');
        });
    } catch(e) {
      panel.innerHTML = _emptyState('group', 'Could not load groups', 'Check your connection and try again.');
    }
  }

  /* ── Panel: Calls ───────────────────────────────────────────── */
  function _ensureCallsPanel() {
    var el = document.getElementById('_te_calls_panel');
    if (!el) {
      el = document.createElement('div');
      el.id = '_te_calls_panel';
      el.style.cssText = 'display:none;flex:1;overflow-y:auto;padding:8px;';
      var sidebar = getSidebarEl();
      if (sidebar) sidebar.appendChild(el);
    }
    return el;
  }

  function _loadCalls() {
    var panel = _ensureCallsPanel();
    var db = getDB(), uid = getUID();
    if (!db || !uid) {
      panel.innerHTML = '<div style="padding:24px;text-align:center;color:var(--on-surface-variant,#8696a0);font-size:13px;">Sign in to see call history</div>';
      return;
    }
    panel.innerHTML = '<div style="padding:24px;text-align:center;color:var(--on-surface-variant,#8696a0);font-size:13px;">Loading calls...</div>';

    if (_callsUnsub) { _callsUnsub(); _callsUnsub = null; }

    var newCallBtn = document.getElementById('btn-new-call');
    if (newCallBtn) newCallBtn.classList.remove('hidden');

    try {
      _callsUnsub = db.collection('calls')
        .where('participants', 'array-contains', uid)
        .orderBy('startedAt', 'desc')
        .limit(50)
        .onSnapshot(function(snap) {
          _renderCalls(panel, snap, uid);
        }, function() {
          // fallback without orderBy
          try {
            db.collection('calls').where('participants', 'array-contains', uid).limit(50).get()
              .then(function(snap) { _renderCalls(panel, snap, uid); })
              .catch(function() {
                panel.innerHTML = _emptyState('call', 'No Calls Yet', 'Make your first call by opening a chat.');
              });
          } catch(e2) {
            panel.innerHTML = _emptyState('call', 'No Calls Yet', 'Make your first call by opening a chat.');
          }
        });
    } catch(e) {
      panel.innerHTML = _emptyState('call', 'No Calls Yet', 'Make your first call by opening a chat.');
    }
  }

  function _renderCalls(panel, snap, uid) {
    if (!snap.docs || !snap.docs.length) {
      panel.innerHTML = _emptyState('call', 'No Calls Yet', 'Make your first call by opening a chat.');
      return;
    }
    var frag = document.createDocumentFragment();
    snap.docs.forEach(function(doc) {
      var d = doc.data();
      var isIncoming = d.callerId !== uid;
      var missed = d.status === 'missed' || d.status === 'declined';
      var otherName  = isIncoming ? (d.callerName || 'Unknown') : (d.receiverName || 'Unknown');
      var otherPhoto = isIncoming ? (d.callerPhoto || '') : (d.receiverPhoto || '');
      var callType   = d.type === 'video' ? 'video' : 'voice';
      var callIcon   = callType === 'video' ? 'videocam' : 'call';
      var dirIcon    = isIncoming ? 'call_received' : 'call_made';
      var color      = missed ? '#ef4444' : (isIncoming ? '#22c55e' : 'var(--primary,#00a884)');
      var ts         = d.startedAt || d.createdAt;

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;cursor:pointer;transition:background 0.15s;';
      row.innerHTML =
        avatarEl(otherName, otherPhoto, '44px') +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
            '<span style="font-weight:600;font-size:14px;color:var(--on-surface,#1c1c1e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">' + esc(otherName) + '</span>' +
            '<span style="font-size:11px;color:var(--on-surface-variant,#8696a0);">' + timeAgo(ts) + '</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:4px;margin-top:2px;">' +
            '<span class="material-symbols-outlined" style="font-size:14px;color:'+color+';">'+esc(dirIcon)+'</span>' +
            '<span class="material-symbols-outlined" style="font-size:13px;color:var(--on-surface-variant,#8696a0);">'+esc(callIcon)+'</span>' +
            '<span style="font-size:12px;color:'+(missed?'#ef4444':'var(--on-surface-variant,#8696a0)')+';">' +
              (missed ? 'Missed' : (isIncoming ? 'Incoming' : 'Outgoing')) + ' ' + callType +
            '</span>' +
          '</div>' +
        '</div>' +
        '<button class="call-back-btn" data-other-id="'+esc(isIncoming ? (d.callerId||'') : (d.receiverId||''))+'" data-call-type="'+esc(callType)+'" ' +
          'style="background:none;border:none;cursor:pointer;padding:8px;color:var(--primary,#00a884);display:flex;align-items:center;justify-content:center;" title="Call back" aria-label="Call back">' +
          '<span class="material-symbols-outlined" style="font-size:20px;">'+esc(callIcon)+'</span>' +
        '</button>';

      row.querySelector('.call-back-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        var otherId = this.dataset.otherId;
        var cType   = this.dataset.callType;
        if (typeof window.startCall === 'function') window.startCall(otherId, cType);
        else if (typeof window.initiateCall === 'function') window.initiateCall(otherId, cType);
      });
      row.addEventListener('mouseenter', function() { row.style.background = 'var(--surface-container,#f0f2f5)'; });
      row.addEventListener('mouseleave', function() { row.style.background = ''; });
      frag.appendChild(row);
    });
    panel.innerHTML = '';
    panel.appendChild(frag);
  }

  /* ── Panel: Saved Messages ───────────────────────────────────── */
  function _ensureSavedPanel() {
    var el = document.getElementById('_te_saved_panel');
    if (!el) {
      el = document.createElement('div');
      el.id = '_te_saved_panel';
      el.style.cssText = 'display:none;flex:1;overflow-y:auto;padding:8px;';
      var sidebar = getSidebarEl();
      if (sidebar) sidebar.appendChild(el);
    }
    return el;
  }

  function _loadSaved() {
    var panel = _ensureSavedPanel();
    var db = getDB(), uid = getUID();
    panel.innerHTML = '';

    // Myself card
    var mc = document.createElement('div');
    mc.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;cursor:pointer;transition:background 0.15s;margin-bottom:8px;background:var(--surface-container-low,#f8f9fa);border:1px solid var(--outline-variant,rgba(0,0,0,0.08));';
    mc.innerHTML =
      '<div style="width:44px;height:44px;border-radius:50%;background:var(--primary,#00a884);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<span class="material-symbols-outlined" style="color:#fff;font-size:22px;" aria-hidden="true">bookmark</span>' +
      '</div>' +
      '<div style="flex:1;">' +
        '<div style="font-weight:600;font-size:14px;color:var(--on-surface,#1c1c1e);">Saved Messages</div>' +
        '<div style="font-size:12px;color:var(--on-surface-variant,#8696a0);">Your personal notes, files &amp; reminders</div>' +
      '</div>' +
      '<span class="material-symbols-outlined" style="color:var(--on-surface-variant,#8696a0);font-size:18px;" aria-hidden="true">chevron_right</span>';
    mc.addEventListener('click', function() {
      if (typeof window.startSavedMessages === 'function') window.startSavedMessages();
    });
    mc.addEventListener('mouseenter', function() { mc.style.background = 'var(--surface-container,#f0f2f5)'; });
    mc.addEventListener('mouseleave', function() { mc.style.background = 'var(--surface-container-low,#f8f9fa)'; });
    panel.appendChild(mc);

    if (!db || !uid) return;

    var hdr = document.createElement('div');
    hdr.style.cssText = 'padding:8px 14px 4px;font-size:11px;font-weight:700;color:var(--on-surface-variant,#8696a0);text-transform:uppercase;letter-spacing:0.08em;';
    hdr.textContent = 'Starred Messages';
    panel.appendChild(hdr);

    var list = document.createElement('div');
    panel.appendChild(list);

    db.collection('starredMessages')
      .where('userId', '==', uid)
      .orderBy('starredAt', 'desc')
      .limit(50)
      .get()
      .then(function(snap) {
        if (!snap.docs.length) {
          list.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:var(--on-surface-variant,#8696a0);">No starred messages yet.</div>';
          return;
        }
        snap.docs.forEach(function(doc) {
          var d = doc.data();
          var item = document.createElement('div');
          item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;cursor:pointer;transition:background 0.15s;';
          item.innerHTML =
            '<span class="material-symbols-outlined" style="color:#f59e0b;font-size:20px;flex-shrink:0;" aria-hidden="true">star</span>' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:13px;font-weight:600;color:var(--on-surface,#1c1c1e);">' + esc(d.senderName || 'User') + '</div>' +
              '<div style="font-size:12px;color:var(--on-surface-variant,#8696a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc((d.text || '[Media]').substring(0, 60)) + '</div>' +
            '</div>';
          item.addEventListener('mouseenter', function() { item.style.background = 'var(--surface-container,#f0f2f5)'; });
          item.addEventListener('mouseleave', function() { item.style.background = ''; });
          item.addEventListener('click', function() {
            if (d.chatId && typeof window.openChat === 'function') {
              window.openChat(d.chatId, d.chatType || 'direct');
              if (d.messageId) setTimeout(function() {
                if (typeof window.highlightMessage === 'function') window.highlightMessage(d.messageId);
              }, 800);
            }
          });
          list.appendChild(item);
        });
      })
      .catch(function() {
        list.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:var(--on-surface-variant,#8696a0);">Could not load starred messages.</div>';
      });
  }

  /* ── Generic list item ───────────────────────────────────────── */
  function _buildListItem(chat) {
    var el = document.createElement('div');
    el.setAttribute('data-chat-id', chat.id);
    el.setAttribute('data-chat-type', chat.type);
    el.setAttribute('role', 'listitem');
    el.setAttribute('tabindex', '0');
    el.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;cursor:pointer;transition:background 0.15s;';
    var members = chat.type === 'group' && chat.memberCount ? chat.memberCount + ' members' : '';
    var preview = chat.preview ? (members ? members + ' \u00b7 ' + esc(chat.preview) : esc(chat.preview)) : members;
    el.innerHTML =
      avatarEl(chat.name || '?', chat.photo || '', '44px') +
      '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px;">' +
          '<span style="font-weight:600;font-size:14px;color:var(--on-surface,#1c1c1e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">' + esc(chat.name || 'Chat') + '</span>' +
          '<span style="font-size:11px;color:var(--on-surface-variant,#8696a0);flex-shrink:0;">' + timeAgo(chat.time) + '</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;margin-top:2px;">' +
          '<span style="font-size:12px;color:var(--on-surface-variant,#8696a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">' + preview + '</span>' +
          (chat.unread > 0 ? '<span style="background:var(--primary,#00a884);color:#fff;border-radius:50%;min-width:18px;height:18px;padding:0 4px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (chat.unread > 99 ? '99+' : chat.unread) + '</span>' : '') +
        '</div>' +
      '</div>';
    el.addEventListener('click', function() { if (typeof window.openChat === 'function') window.openChat(chat.id, chat.type); });
    el.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (typeof window.openChat === 'function') window.openChat(chat.id, chat.type); } });
    el.addEventListener('mouseenter', function() { el.style.background = 'var(--surface-container,#f0f2f5)'; });
    el.addEventListener('mouseleave', function() { el.style.background = ''; });
    return el;
  }

  /* ── Empty state ─────────────────────────────────────────────── */
  function _emptyState(icon, title, sub) {
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center;gap:12px;">' +
      '<span class="material-symbols-outlined" style="font-size:48px;color:var(--on-surface-variant,#8696a0);opacity:0.4;" aria-hidden="true">' + esc(icon) + '</span>' +
      '<p style="font-size:15px;font-weight:700;color:var(--on-surface,#1c1c1e);">' + esc(title) + '</p>' +
      '<p style="font-size:13px;color:var(--on-surface-variant,#8696a0);max-width:220px;">' + esc(sub) + '</p>' +
    '</div>';
  }

  /* ── Panel visibility ────────────────────────────────────────── */
  function _showPanelsForTab(tab) {
    var chatList  = getChatListEl();
    var filterRow = document.getElementById('wa-filter-chips');
    var gpanel    = document.getElementById('_te_groups_panel');
    var cpanel    = document.getElementById('_te_calls_panel');
    var spanel    = document.getElementById('_te_saved_panel');
    var callBtns  = ['btn-call-select-all','btn-call-multi-select','btn-call-delete-selected','btn-new-call'];
    var chatBtns  = ['btn-multi-select'];

    // Reset all
    [gpanel, cpanel, spanel].forEach(function(p) { if (p) p.style.display = 'none'; });

    if (tab === 'chats') {
      if (chatList)  chatList.style.display  = '';
      if (filterRow) filterRow.style.display = '';
      callBtns.forEach(function(id) { var el = document.getElementById(id); if (el) el.classList.add('hidden'); });
      chatBtns.forEach(function(id) { var el = document.getElementById(id); if (el) el.classList.remove('hidden'); });
    } else if (tab === 'groups') {
      if (chatList)  chatList.style.display  = 'none';
      if (filterRow) filterRow.style.display = 'none';
      _ensureGroupsPanel().style.display = 'flex';
      _ensureGroupsPanel().style.flexDirection = 'column';
      callBtns.forEach(function(id) { var el = document.getElementById(id); if (el) el.classList.add('hidden'); });
      chatBtns.forEach(function(id) { var el = document.getElementById(id); if (el) el.classList.add('hidden'); });
      _loadGroups();
    } else if (tab === 'calls') {
      if (chatList)  chatList.style.display  = 'none';
      if (filterRow) filterRow.style.display = 'none';
      _ensureCallsPanel().style.display = 'flex';
      _ensureCallsPanel().style.flexDirection = 'column';
      callBtns.forEach(function(id) { var el = document.getElementById(id); if (el) el.classList.remove('hidden'); });
      chatBtns.forEach(function(id) { var el = document.getElementById(id); if (el) el.classList.add('hidden'); });
      _loadCalls();
    } else if (tab === 'more' || tab === 'saved') {
      if (chatList)  chatList.style.display  = 'none';
      if (filterRow) filterRow.style.display = 'none';
      _ensureSavedPanel().style.display = 'flex';
      _ensureSavedPanel().style.flexDirection = 'column';
      callBtns.forEach(function(id) { var el = document.getElementById(id); if (el) el.classList.add('hidden'); });
      chatBtns.forEach(function(id) { var el = document.getElementById(id); if (el) el.classList.add('hidden'); });
      _loadSaved();
    } else {
      // requests, status etc — show chats as fallback
      if (chatList)  chatList.style.display  = '';
      if (filterRow) filterRow.style.display = '';
    }
  }

  /* ── Nav active states ───────────────────────────────────────── */
  function _updateNavActive(tab) {
    // Left sidebar nav
    document.querySelectorAll('.tab-item[data-tab]').forEach(function(el) {
      var active = el.dataset.tab === tab;
      el.classList.toggle('active', active);
      if (active) {
        el.style.background = 'var(--primary-container,rgba(0,168,132,0.1))';
        el.style.color = 'var(--primary,#00a884)';
        el.style.borderLeft = '4px solid var(--primary,#00a884)';
        el.style.fontWeight = '700';
        el.setAttribute('aria-current', 'page');
      } else {
        el.style.background = '';
        el.style.color = '';
        el.style.borderLeft = '';
        el.style.fontWeight = '';
        el.removeAttribute('aria-current');
      }
    });
    // Bottom mobile nav
    document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(function(el) {
      var active = el.dataset.tab === tab;
      el.classList.toggle('active', active);
      if (active) {
        el.style.color = 'var(--primary,#00a884)';
        el.setAttribute('aria-current', 'page');
      } else {
        el.style.color = '';
        el.removeAttribute('aria-current');
      }
    });
    // Old nav dock
    document.querySelectorAll('.nav-dock-item[data-tab]').forEach(function(el) {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
  }

  /* ── Sidebar title ───────────────────────────────────────────── */
  var _TAB_TITLES = { chats:'Messages', groups:'Groups', calls:'Calls', more:'Saved Items', saved:'Saved Items', requests:'Requests', status:'Status' };
  function _setSidebarTitle(tab) {
    var el = document.getElementById('chats-sidebar-title');
    if (el) el.textContent = _TAB_TITLES[tab] || 'Messages';
  }

  /* ── switchTab ───────────────────────────────────────────────── */
  window.switchTab = function(tab) {
    if (!tab) return;
    tab = String(tab).toLowerCase();
    _currentTab = tab;
    _setSidebarTitle(tab);
    _updateNavActive(tab);
    _showPanelsForTab(tab);
    document.dispatchEvent(new CustomEvent('nsl:tab-change', { detail: { tab: tab } }));
    if (window.__DEBUG__) console.log('[tab-engine] switchTab =>', tab);
  };

  /* ── Search ──────────────────────────────────────────────────── */
  var _debounce = null;

  function _filterChats(query) {
    query = (query || '').toLowerCase().trim();
    var clearBtn = document.getElementById('sidebar-search-clear');
    if (clearBtn) clearBtn.classList.toggle('hidden', !query);

    var targets = [];
    var chatList = getChatListEl();
    if (chatList) targets = targets.concat(Array.from(chatList.querySelectorAll('[data-chat-id]')));
    var gpanel = document.getElementById('_te_groups_panel');
    if (gpanel && gpanel.style.display !== 'none') targets = targets.concat(Array.from(gpanel.querySelectorAll('[data-chat-id]')));

    targets.forEach(function(el) {
      var text = el.textContent.toLowerCase();
      el.style.display = (!query || text.indexOf(query) >= 0) ? '' : 'none';
    });
  }

  window.filterChats = _filterChats;

  window.handleSidebarSearch = function(e) {
    if (e.key === 'Escape') {
      var inp = document.getElementById('sidebar-search');
      if (inp) inp.value = '';
      _filterChats('');
      if (inp) inp.blur();
    }
    if (e.key === 'Enter') {
      var enterInp = document.getElementById('sidebar-search');
      _filterChats(enterInp ? enterInp.value : '');
    }
  };

  window.clearSidebarSearch = function() {
    var inp = document.getElementById('sidebar-search');
    if (inp) inp.value = '';
    _filterChats('');
    if (inp) inp.focus();
  };

  window.triggerSidebarSearch = function() {
    var inp = document.getElementById('sidebar-search');
    if (inp) _filterChats(inp.value);
  };

  /* ── Wire delegated actions ──────────────────────────────────── */
  document.addEventListener('click', function(e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.dataset.action;
    var arg    = el.dataset.actionArg || el.dataset.tab;
    if (action === 'switchTab' && arg) { e.preventDefault(); window.switchTab(arg); return; }
    if (action === 'clearSidebarSearch') { e.preventDefault(); window.clearSidebarSearch(); return; }
    if (action === 'triggerSidebarSearch') { e.preventDefault(); window.triggerSidebarSearch(); return; }
    if (action === 'filterChats') { e.preventDefault(); window.filterChats(arg || ''); return; }
  });

  /* ── Wire search input ───────────────────────────────────────── */
  function _wireSearch() {
    var inp = document.getElementById('sidebar-search');
    if (!inp || inp._teWired) return;
    inp._teWired = true;
    inp.addEventListener('input', function() {
      clearTimeout(_debounce);
      _debounce = setTimeout(function() { _filterChats(inp.value); }, 180);
    });
    inp.addEventListener('keydown', window.handleSidebarSearch);
  }

  /* ── Wire WA filter chips ─────────────────────────────────────── */
  function _wireFilterChips() {
    document.querySelectorAll('.wa-chip[data-action="setWaFilter"], .wa-chip[data-filter]').forEach(function(chip) {
      if (chip._teWired) return;
      chip._teWired = true;
      chip.addEventListener('click', function() {
        document.querySelectorAll('.wa-chip').forEach(function(c) {
          c.classList.remove('active');
          c.setAttribute('aria-pressed', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');
        var filter = chip.dataset.actionArg || chip.dataset.filter || 'all';
        _applyWaFilter(filter);
      });
    });
  }

  function _applyWaFilter(filter) {
    var chatList = getChatListEl();
    if (!chatList) return;
    chatList.querySelectorAll('[data-chat-id]').forEach(function(el) {
      var chatType = el.dataset.chatType || 'direct';
      var show = true;
      if (filter === 'groups') show = chatType === 'group';
      else if (filter === 'unread') {
        var badge = el.querySelector('[style*="border-radius:50%"], [style*="border-radius: 50%"]');
        show = !!(badge && badge.textContent.trim() && badge.textContent.trim() !== '0');
      } else if (filter === 'favourites') {
        show = !!(window.pinnedChatIds && Array.isArray(window.pinnedChatIds) && window.pinnedChatIds.includes(el.dataset.chatId));
      }
      el.style.display = show ? '' : 'none';
    });
  }

  /* ── Init ────────────────────────────────────────────────────── */
  function _init() {
    _wireSearch();
    _wireFilterChips();
    // Trigger initial tab render (chats is default)
    window.switchTab('chats');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    setTimeout(_init, 50);
  }

  document.addEventListener('nsl:auth-ready', function(e) {
    if (e.detail && e.detail.user) {
      setTimeout(function() { _wireSearch(); _wireFilterChips(); }, 300);
    }
  });

  if (window.__DEBUG__) console.log('[tab-engine] v1.0 loaded');
})();
