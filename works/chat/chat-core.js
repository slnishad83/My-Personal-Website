/**
 * chat-core.js ΓÇö NSL Chat Core Engine v1.0
 *
 * This module is the MISSING CORE of the chat application.
 * It provides all fundamental chat operations:
 *  - Firestore subscription for chats & groups
 *  - Chat list rendering (sidebar)
 *  - Opening a chat and loading messages
 *  - Sending messages
 *  - Global function stubs expected by feature modules
 *
 * Must be imported SYNCHRONOUSLY in app-index.js (before deferred modules).
 */
'use strict';

(function () {
  /* ΓöÇΓöÇ Utilities ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  function esc(str) {
    if (typeof window.escapeHtml === 'function' && window.escapeHtml !== esc) return window.escapeHtml(str);
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function initials(name) {
    if (typeof window.getInitials === 'function' && window.getInitials !== initials) return window.getInitials(name, '');
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function timeAgo(ts) {
    if (!ts) return '';
    let ms;
    if (ts && typeof ts.toMillis === 'function') ms = ts.toMillis();
    else if (ts && typeof ts.seconds === 'number') ms = ts.seconds * 1000;
    else if (ts instanceof Date) ms = ts.getTime();
    else if (typeof ts === 'number') ms = ts;
    else return '';
    const diff = Date.now() - ms;
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (secs < 60) return 'now';
    if (mins < 60) return mins + 'm';
    if (hours < 24) return hours + 'h';
    if (days < 7) return days + 'd';
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatTime(ts) {
    if (!ts) return '';
    let ms;
    if (ts && typeof ts.toMillis === 'function') ms = ts.toMillis();
    else if (ts && typeof ts.seconds === 'number') ms = ts.seconds * 1000;
    else if (ts instanceof Date) ms = ts.getTime();
    else if (typeof ts === 'number') ms = ts;
    else return '';
    const d = new Date(ms);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getDB() { return window.db || (window.App && window.App.db) || (typeof firebase !== 'undefined' ? firebase.firestore() : null); }
  function getUID() {
    const u = window.currentUser || (window.App && window.App.currentUser);
    return u && u.uid;
  }
  function getCurrentUser() { return window.currentUser || (window.App && window.App.currentUser); }

  /* ΓöÇΓöÇ State ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
  const State = {
    chats: [],           // combined direct + group chats
    activeId: null,      // currently open chat/group id
    activeChatData: null,
    activeType: null,    // 'direct' | 'group'
    messages: [],
    messagesUnsub: null,
    chatsUnsub: null,
    groupsUnsub: null,
  };

  /* ΓöÇΓöÇ Chat List Rendering ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  function hideSkeleton() {
    const skel = document.getElementById('chat-list-skeleton');
    if (skel) skel.style.display = 'none';
  }

  function showEmpty(show) {
    const el = document.getElementById('chats-empty');
    if (el) el.classList.toggle('hidden', !show);
  }

  function avatarEl(name, photoURL, size) {
    size = size || '44px';
    if (photoURL) {
      return `<img src="${esc(photoURL)}" alt="${esc(name)}" 
              style="width:${size};height:${size};border-radius:50%;object-fit:cover;flex-shrink:0;" 
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
              <div style="width:${size};height:${size};border-radius:50%;display:none;align-items:center;justify-content:center;
              background:var(--primary,#00a884);color:#fff;font-weight:700;font-size:16px;flex-shrink:0;">
                ${esc(initials(name))}
              </div>`;
    }
    const colors = ['#00a884','#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444','#6366f1'];
    const color = colors[(name || '').charCodeAt(0) % colors.length] || '#00a884';
    return `<div style="width:${size};height:${size};border-radius:50%;display:flex;align-items:center;justify-content:center;
            background:${color};color:#fff;font-weight:700;font-size:16px;flex-shrink:0;">
              ${esc(initials(name))}
            </div>`;
  }

  function buildChatItem(chat) {
    const isActive = chat.id === State.activeId;
    const name = esc(chat.name || chat.displayName || 'Chat');
    const preview = esc(chat.lastMessage || chat.preview || '');
    const time = timeAgo(chat.lastMessageAt || chat.updatedAt);
    const unread = chat.unreadCount || 0;
    const photo = chat.photoURL || chat.avatar || '';

    const li = document.createElement('div');
    li.setAttribute('role', 'listitem');
    li.setAttribute('data-chat-id', chat.id);
    li.setAttribute('data-chat-type', chat.type || 'direct');
    li.style.cssText = `
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px; border-radius: 12px; cursor: pointer;
      transition: background 0.15s;
      background: ${isActive ? 'var(--surface-container-high,#eef2f3)' : 'transparent'};
      user-select: none; position: relative;
    `;
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-label', `Chat with ${chat.name || 'user'}`);

    li.innerHTML = `
      <div style="position:relative;flex-shrink:0;">
        ${chat.isSaved
          ? `<div style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
              background:var(--primary,#00a884);color:#fff;font-size:22px;flex-shrink:0;">≡ƒæñ</div>`
          : avatarEl(chat.name || '?', photo, '44px')}
        ${chat.isOnline ? `<div style="position:absolute;bottom:1px;right:1px;width:11px;height:11px;border-radius:50%;
          background:#22c55e;border:2px solid var(--background,#fff);"></div>` : ''}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px;">
          <span style="font-weight:600;font-size:14px;color:var(--on-surface,#1c1c1e);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${name}</span>
          <span style="font-size:11px;color:var(--on-surface-variant,#8696a0);flex-shrink:0;">${time}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;margin-top:2px;">
          <span style="font-size:12px;color:var(--on-surface-variant,#8696a0);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${preview}</span>
          ${unread > 0 ? `<span style="background:var(--primary,#00a884);color:#fff;border-radius:50%;
            min-width:18px;height:18px;padding:0 4px;font-size:11px;font-weight:700;
            display:flex;align-items:center;justify-content:center;flex-shrink:0;">${unread > 99 ? '99+' : unread}</span>` : ''}
        </div>
      </div>
    `;

    li.addEventListener('click', () => {
      if (chat.isSaved && typeof window.startSavedMessages === 'function') window.startSavedMessages();
      else openChat(chat.id, chat.type || 'direct');
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (chat.isSaved && typeof window.startSavedMessages === 'function') window.startSavedMessages();
        else openChat(chat.id, chat.type || 'direct');
      }
    });

    // hover
    li.addEventListener('mouseenter', () => {
      if (chat.id !== State.activeId) li.style.background = 'var(--surface-container,#f0f2f5)';
    });
    li.addEventListener('mouseleave', () => {
      if (chat.id !== State.activeId) li.style.background = 'transparent';
    });

    return li;
  }

  function renderChatList() {
    const container = document.getElementById('chat-list');
    if (!container) return;

    const skeleton = document.getElementById('chat-list-skeleton');
    if (skeleton) skeleton.style.display = 'none';

    // Remove existing chat items (keep status-row if present)
    const existing = container.querySelectorAll('[data-chat-id]');
    existing.forEach(el => el.remove());

    if (!State.chats.length) {
      showEmpty(true);
      return;
    }
    showEmpty(false);

    // Sort by lastMessageAt desc
    const sorted = [...State.chats].sort((a, b) => {
      const ta = (a.lastMessageAt && a.lastMessageAt.toMillis) ? a.lastMessageAt.toMillis() : (a.lastMessageAt || 0);
      const tb = (b.lastMessageAt && b.lastMessageAt.toMillis) ? b.lastMessageAt.toMillis() : (b.lastMessageAt || 0);
      return tb - ta;
    });

    const frag = document.createDocumentFragment();

    // Myself (Saved Messages) chat pinned at the top of the list
    const myself = getUID() ? window.getSavedMessagesItem() : null;
    if (myself) frag.appendChild(buildChatItem(myself));

    sorted.forEach(chat => {
      if (myself && chat.id === myself.id) return;
      frag.appendChild(buildChatItem(chat));
    });
    container.appendChild(frag);
  }

  /* ΓöÇΓöÇ Firestore subscriptions ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  let _chatsData = [];
  let _groupsData = [];
  let _broadcastsData = [];

  function mergeAndRender() {
    // Merge direct chats, groups and broadcast lists into one unified list
    State.chats = [..._chatsData, ..._groupsData, ..._broadcastsData];
    renderChatList();
    // Dispatch for other modules
    document.dispatchEvent(new CustomEvent('nsl:chats-loaded', { detail: { chats: State.chats } }));
    _refreshOnlineUsers();
  }

  let _onlineTimer = null;
  const _PRESENCE_WINDOW = 60000;

  function _refreshOnlineUsers() {
    const db = getDB();
    const uid = getUID();
    if (!db || !uid) return;
    const others = [];
    _chatsData.forEach(c => { if (c.otherUserId && c.otherUserId !== uid) others.push(c.otherUserId); });
    if (!others.length) return;
    window._onlineUsers = window._onlineUsers || {};
    const unique = Array.from(new Set(others)).slice(0, 50);
    unique.forEach(id => {
      db.collection('users').doc(id).get().then(snap => {
        if (!snap.exists) return;
        const d = snap.data();
        const now = Date.now();
        const hb = d.lastHeartbeat || 0;
        const online = d.onlineStatus === 'online' && (now - hb) < _PRESENCE_WINDOW;
        if (window._onlineUsers[id] !== online) {
          window._onlineUsers[id] = online;
          renderChatList();
        }
      }).catch(() => {});
    });
  }

  function subscribeToChats() {
    const db = getDB();
    const uid = getUID();
    if (!db || !uid) return;

    if (State.chatsUnsub) { State.chatsUnsub(); State.chatsUnsub = null; }

    try {
      State.chatsUnsub = db.collection('chats')
        .where('participants', 'array-contains', uid)
        .orderBy('lastMessageAt', 'desc')
        .limit(200)
        .onSnapshot(snap => {
          _chatsData = snap.docs.map(doc => {
            const d = doc.data();
            // For direct chats, use the OTHER user's name
            let name = d.name || d.displayName;
            let photo = d.photoURL;
            if (!name && d.participantNames) {
              const otherNames = Object.entries(d.participantNames || {})
                .filter(([k]) => k !== uid)
                .map(([, v]) => v);
              name = otherNames[0] || 'Chat';
            }
            if (!photo && d.participantPhotos) {
              const otherPhotos = Object.entries(d.participantPhotos || {})
                .filter(([k]) => k !== uid)
                .map(([, v]) => v);
              photo = otherPhotos[0] || '';
            }
            // Determine online status from participants if available
            const others = (d.participants || []).filter(p => p !== uid);
            const otherId = others[0];
            return {
              id: doc.id,
              type: 'direct',
              name: name || 'Chat',
              photoURL: photo || '',
              lastMessage: d.lastMessage || d.lastMessageText || '',
              lastMessageAt: d.lastMessageAt,
              updatedAt: d.updatedAt,
              unreadCount: (d.unreadCounts && d.unreadCounts[uid]) || 0,
              participants: d.participants || [],
              otherUserId: otherId,
              isOnline: !!(window._onlineUsers && window._onlineUsers[otherId]),
            };
          });
          mergeAndRender();
        }, err => {
          if (window.__DEBUG__) console.warn('[chat-core] chats subscription error:', err);
          // Try without orderBy (index might not exist)
          try {
            State.chatsUnsub = db.collection('chats')
              .where('participants', 'array-contains', uid)
              .limit(200)
              .onSnapshot(snap => {
                _chatsData = snap.docs.map(doc => {
                  const d = doc.data();
                  let name = d.name || d.displayName;
                  let photo = d.photoURL;
                  if (!name && d.participantNames) {
                    const otherNames = Object.entries(d.participantNames || {})
                      .filter(([k]) => k !== uid)
                      .map(([, v]) => v);
                    name = otherNames[0] || 'Chat';
                  }
                  if (!photo && d.participantPhotos) {
                    const otherPhotos = Object.entries(d.participantPhotos || {})
                      .filter(([k]) => k !== uid)
                      .map(([, v]) => v);
                    photo = otherPhotos[0] || '';
                  }
                  const others = (d.participants || []).filter(p => p !== uid);
                  const otherId = others[0];
                  return {
                    id: doc.id,
                    type: 'direct',
                    name: name || 'Chat',
                    photoURL: photo || '',
                    lastMessage: d.lastMessage || d.lastMessageText || '',
                    lastMessageAt: d.lastMessageAt,
                    updatedAt: d.updatedAt,
                    unreadCount: (d.unreadCounts && d.unreadCounts[uid]) || 0,
                    participants: d.participants || [],
                    otherUserId: otherId,
                    isOnline: !!(window._onlineUsers && window._onlineUsers[otherId]),
                  };
                });
                mergeAndRender();
              }, () => {
                hideSkeleton();
                if (!State.chats.length && !_groupsData.length) showEmpty(true);
              });
          } catch (e2) {
            hideSkeleton();
          }
        });
    } catch (e) {
      hideSkeleton();
      if (window.__DEBUG__) console.warn('[chat-core] subscribeToChats failed:', e);
    }
  }

  function subscribeToGroups() {
    const db = getDB();
    const uid = getUID();
    if (!db || !uid) return;

    if (State.groupsUnsub) { State.groupsUnsub(); State.groupsUnsub = null; }

    try {
      State.groupsUnsub = db.collection('groups')
        .where('memberIds', 'array-contains', uid)
        .limit(200)
        .onSnapshot(snap => {
          _groupsData = snap.docs.map(doc => {
            const d = doc.data();
            return {
              id: doc.id,
              type: 'group',
              name: d.name || 'Group',
              photoURL: d.photoURL || d.avatar || '',
              lastMessage: d.lastMessage || d.lastMessageText || '',
              lastMessageAt: d.lastMessageAt,
              updatedAt: d.updatedAt,
              unreadCount: (d.unreadCounts && d.unreadCounts[uid]) || 0,
              members: d.memberIds || d.members || [],
              memberCount: (d.memberIds || d.members || []).length,
              description: d.description || '',
            };
          });
          mergeAndRender();
        }, err => {
          if (window.__DEBUG__) console.warn('[chat-core] groups subscription error:', err);
          hideSkeleton();
          if (!_chatsData.length) showEmpty(true);
        });
    } catch (e) {
      hideSkeleton();
      if (window.__DEBUG__) console.warn('[chat-core] subscribeToGroups failed:', e);
    }
  }

  function subscribeToBroadcasts() {
    const db = getDB();
    const uid = getUID();
    if (!db || !uid) return;

    if (State.broadcastsUnsub) { State.broadcastsUnsub(); State.broadcastsUnsub = null; }

    try {
      State.broadcastsUnsub = db.collection('broadcasts')
        .where('ownerId', '==', uid)
        .limit(100)
        .onSnapshot(snap => {
          _broadcastsData = snap.docs.map(doc => {
            const d = doc.data();
            return {
              id: doc.id,
              type: 'broadcast',
              name: d.name || 'Broadcast list',
              photoURL: d.photoURL || d.avatar || '',
              lastMessage: d.lastMessage || d.lastMessageText || '',
              lastMessageAt: d.lastMessageAt,
              updatedAt: d.updatedAt,
              unreadCount: (d.unreadCounts && d.unreadCounts[uid]) || 0,
              recipients: d.recipients || [],
              recipientCount: (d.recipients || []).length,
              ownerId: d.ownerId,
              members: d.members || [],
            };
          });
          mergeAndRender();
        }, err => {
          if (window.__DEBUG__) console.warn('[chat-core] broadcasts subscription error:', err);
        });
    } catch (e) {
      if (window.__DEBUG__) console.warn('[chat-core] subscribeToBroadcasts failed:', e);
    }
  }

  /* ΓöÇΓöÇ Opening a chat / loading messages ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  function openChat(chatId, chatType) {
    if (!chatId) return Promise.resolve();
    chatType = chatType || 'direct';
    State.activeId = chatId;
    State.activeType = chatType;

    const chatData = State.chats.find(c => c.id === chatId)
      || (savedChatId() === chatId ? window.getSavedMessagesItem() : null)
      || { id: chatId, type: chatType };
    State.activeChatData = chatData;

    // Expose globally
    window.currentChat = chatData;
    window.currentChatType = chatType;
    if (window.App) { window.App.currentChat = chatData; window.App.currentChatType = chatType; }

    // Update header UI
    _updateChatHeader(chatData);

    // Show chat area, hide welcome screen
    const chatArea = document.getElementById('chat-area');
    const welcome = document.getElementById('welcome-screen') || document.getElementById('empty-chat-placeholder');
    const chatHeader = document.getElementById('chat-header');
    const inputBar = document.getElementById('message-input-bar') || document.getElementById('chat-input-area') || document.querySelector('.message-input-wrap') || document.getElementById('input-bar');
    const msgWrap = document.getElementById('messages-wrap');
    if (chatHeader) chatHeader.classList.remove('hidden');
    if (inputBar) inputBar.classList.remove('hidden');
    if (welcome) welcome.classList.add('hidden');
    if (chatArea) chatArea.classList.remove('hidden');
    if (msgWrap) {
      msgWrap.classList.remove('hidden');
      msgWrap.style.display = 'flex';
    }

    // On mobile ΓÇö hide sidebar, show chat area
    const sidebar = document.getElementById('chat-list-sidebar');
    if (sidebar && window.innerWidth < 768) {
      sidebar.style.display = 'none';
      if (chatArea) chatArea.style.display = 'flex';
    }

    // Update active item in list
    document.querySelectorAll('[data-chat-id]').forEach(el => {
      const active = el.dataset.chatId === chatId;
      el.style.background = active ? 'var(--surface-container-high,#eef2f3)' : 'transparent';
    });

    // Load messages
    renderMessages(chatId, chatType);

    return Promise.resolve();
  }

  function _updateChatHeader(chat) {
    const nameEl = document.getElementById('header-name');
    const statusEl = document.getElementById('header-status');
    const avatarEl2 = document.getElementById('header-avatar');

    if (nameEl) nameEl.textContent = chat.name || 'Chat';
    if (statusEl) {
      if (chat.type === 'broadcast') statusEl.textContent = `${chat.recipientCount || 0} recipients`;
      else if (chat.type === 'group')
        statusEl.textContent = `${chat.memberCount || ''} members`;
      else
        statusEl.textContent = (chat.isOnline ? 'Online' : 'Tap for info');
    }
    if (avatarEl2) {
      if (chat.photoURL) {
        avatarEl2.style.backgroundImage = `url(${chat.photoURL})`;
        avatarEl2.style.backgroundSize = 'cover';
        avatarEl2.style.backgroundPosition = 'center';
        avatarEl2.textContent = '';
      } else {
        avatarEl2.style.backgroundImage = '';
        avatarEl2.textContent = initials(chat.name || '?');
      }
    }
  }

  /* ── Network status / Connecting... banner ── */
  const _netState = { online: navigator.onLine, reconnecting: false, _timer: null };

  function _showConnectingBanner(show) {
    const statusEl = document.getElementById('header-status');
    if (!statusEl) return;
    if (show) {
      statusEl.dataset._origText = statusEl.textContent;
      statusEl.textContent = 'Connecting...';
      statusEl.style.color = '#f59e0b';
    } else {
      statusEl.style.color = '';
      if (statusEl.dataset._origText) {
        statusEl.textContent = statusEl.dataset._origText;
        delete statusEl.dataset._origText;
      }
    }
  }

  function _onOffline() {
    _netState.online = false;
    _showConnectingBanner(true);
    document.dispatchEvent(new CustomEvent('tc:network:status', { detail: { online: false } }));
  }

  function _onOnline() {
    _netState.online = true;
    _netState.reconnecting = true;
    _showConnectingBanner(true);
    document.dispatchEvent(new CustomEvent('tc:network:status', { detail: { online: true } }));
    clearTimeout(_netState._timer);
    _netState._timer = setTimeout(() => { _netState.reconnecting = false; _showConnectingBanner(false); }, 3000);
  }

  window.addEventListener('online', _onOnline);
  window.addEventListener('offline', _onOffline);

  document.addEventListener('tc:snapshot:metadata', (e) => {
    const { fromCache, hasPendingWrites } = e.detail || {};
    if (!navigator.onLine) {
      _showConnectingBanner(true);
    } else if (hasPendingWrites) {
      const statusEl = document.getElementById('header-status');
      if (statusEl && !statusEl.dataset._origText) {
        statusEl.textContent = 'Sending...';
        statusEl.style.color = '#f59e0b';
      }
    } else if (_netState.online && !_netState.reconnecting) {
      _showConnectingBanner(false);
    }
  });

  function _messagesCollection(chatType) {
    if (chatType === 'group') return 'groups';
    if (chatType === 'broadcast') return 'broadcasts';
    return 'chats';
  }

  /* ΓöÇΓöÇ Myself (Saved Messages) chat ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
  function savedChatId() {
    const uid = getUID();
    return uid ? 'saved_' + uid : null;
  }
  window.savedChatId = savedChatId;

  window.getSavedMessagesItem = function () {
    const id = savedChatId();
    if (!id) return null;
    return {
      id: id,
      type: 'direct',
      name: 'Myself',
      displayName: 'Myself',
      photoURL: '',
      avatar: '≡ƒæñ',
      preview: 'Your personal notes, files & reminders',
      lastMessage: '',
      isSaved: true,
      isPinned: true,
      pinned: true,
      isOnline: false,
    };
  };

  window.startSavedMessages = async function () {
    const db = getDB();
    const uid = getUID();
    const id = savedChatId();
    if (!db || !uid || !id) return;

    // Ensure the chat document exists so sendMessage can update it
    try {
      await db.collection('chats').doc(id).set({
        participants: [uid],
        name: 'Myself',
        displayName: 'Myself',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      if (window.__DEBUG__) console.warn('[chat-core] ensure saved chat failed:', err);
    }

    // Make sure the chat is in state so openChat finds proper data
    const existing = State.chats.find(c => c.id === id);
    if (existing) {
      existing.name = 'Myself';
      existing.displayName = 'Myself';
      existing.isSaved = true;
      existing.pinned = true;
      existing.otherUserId = uid;
    } else {
      State.chats.unshift(window.getSavedMessagesItem() || { id: id, type: 'direct', name: 'Myself', isSaved: true });
    }

    openChat(id, 'direct');

    // Set header to Myself
    const nameEl = document.getElementById('header-name');
    const statusEl = document.getElementById('header-status');
    const avatarEl = document.getElementById('header-avatar');
    if (nameEl) nameEl.textContent = 'Myself';
    if (statusEl) statusEl.textContent = 'Your personal notes, files & reminders';
    if (avatarEl) {
      avatarEl.style.backgroundImage = '';
      avatarEl.style.backgroundSize = '';
      avatarEl.style.backgroundPosition = '';
      avatarEl.textContent = '≡ƒæñ';
    }
    if (window.currentChat) {
      window.currentChat.name = 'Myself';
      window.currentChat.otherUserName = 'Myself';
      window.currentChat.isSaved = true;
      window.currentChat.pinned = true;
    }
  };

  /* ΓöÇΓöÇ Message Rendering ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  function renderMessages(chatId, chatType) {
    const db = getDB();
    const uid = getUID();
    if (!db || !uid || !chatId) return;

    chatType = chatType || State.activeType || 'direct';

    // Unsubscribe previous listener
    if (State.messagesUnsub) { State.messagesUnsub(); State.messagesUnsub = null; }

    const msgWrap = document.getElementById('messages-wrap');
    if (!msgWrap) return;

    // Show loading state
    msgWrap.innerHTML = `
      <div style="display:flex;justify-content:center;align-items:center;height:100%;color:var(--on-surface-variant,#8696a0);">
        <div style="text-align:center;">
          <div style="width:32px;height:32px;border:3px solid var(--primary,#00a884);border-top-color:transparent;
            border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div>
          <p style="font-size:13px;">Loading messagesΓÇª</p>
        </div>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;

    const collection = _messagesCollection(chatType);

    try {
      State.messagesUnsub = db.collection(collection)
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .limitToLast(100)
        .onSnapshot(async snap => {
          const docs = snap.docs;
          const fromCache = snap.metadata.fromCache;
          const hasPendingWrites = snap.metadata.hasPendingWrites;

          if (fromCache || hasPendingWrites) {
            document.dispatchEvent(new CustomEvent('tc:snapshot:metadata', { detail: { fromCache, hasPendingWrites } }));
          }

          if (window.E2E) {
            const decrypted = await Promise.all(docs.map(doc =>
              E2E.decryptMessageData(chatId, chatType, doc.id, doc.data())
            ));
            State.messages = decrypted;
          } else {
            State.messages = docs.map(doc => ({ id: doc.id, ...doc.data() }));
          }
          _renderMessagesList(msgWrap, uid);

          // Mark as read
          _markRead(chatId, chatType, uid);

          document.dispatchEvent(new CustomEvent('tc:messages:loaded', { detail: { chatId } }));
        }, err => {
          if (window.__DEBUG__) console.warn('[chat-core] messages error:', err);
          msgWrap.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100%;color:var(--on-surface-variant,#8696a0);">
            <p style="font-size:13px;">Could not load messages. Check your connection.</p>
          </div>`;
        });
    } catch (e) {
      if (window.__DEBUG__) console.warn('[chat-core] renderMessages failed:', e);
    }
  }

  /* ΓöÇΓöÇ WhatsApp-style text formatting ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  function _renderLocationCard(lat, lng, label) {
    const q = encodeURIComponent(String(lat) + ',' + String(lng));
    const embedSrc = 'https://maps.google.com/maps?q=' + q + '&z=15&output=embed';
    const viewHref = 'https://www.google.com/maps?q=' + q;
    const safeLabel = esc((label || 'Location').toString().replace(/\n/g, ' ').substring(0, 40));
    return '<div class="nsl-location-card" style="width:240px;max-width:100%;border-radius:12px;overflow:hidden;border:1px solid rgba(0,0,0,0.1);background:#fff;display:flex;flex-direction:column;">' +
      '<iframe src="' + esc(embedSrc) + '" style="width:100%;height:150px;border:0;display:block;pointer-events:none;" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" title="Map preview"></iframe>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:#fff;">' +
        '<div style="font-size:12px;font-weight:600;color:#1c1c1e;display:flex;align-items:center;gap:6px;min-width:0;">' +
          '<span class="material-symbols-outlined" style="font-size:16px;color:#00a884;flex-shrink:0;">location_on</span>' +
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeLabel + '</span>' +
        '</div>' +
        '<a href="' + esc(viewHref) + '" target="_blank" rel="noopener" style="font-size:11px;color:#00a884;text-decoration:none;white-space:nowrap;flex-shrink:0;" onclick="event.stopPropagation()">Open map</a>' +
      '</div>' +
    '</div>';
  }

  function _formatMsgText(text) {
    if (!text) return '';
    const s = esc(text);
    const codeSpans = [];
    let out = s.replace(/```([\s\S]+?)```/g, (m, inner) => {
      codeSpans.push(inner);
      return '\u0001CODE' + (codeSpans.length - 1) + '\u0001';
    });
    out = out.replace(/~([^~\n]+)~/g, '<del>$1</del>');
    out = out.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
    out = out.replace(/_([^_\n]+)_/g, '<em>$1</em>');
    out = out.replace(/\u0001CODE(\d+)\u0001/g, (m, i) => {
      return '<code style="font-family:Consolas,Menlo,monospace;background:rgba(0,0,0,0.06);padding:1px 5px;border-radius:4px;font-size:12px;white-space:pre-wrap;">' + codeSpans[Number(i)] + '</code>';
    });
    return out;
  }
  window._formatMsgText = _formatMsgText;

  function _renderMessagesList(msgWrap, uid) {
    msgWrap.innerHTML = '';

    if (!State.messages.length) {
      msgWrap.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;
          gap:12px;color:var(--on-surface-variant,#8696a0);padding:20px;">
          <span class="material-symbols-outlined" style="font-size:48px;opacity:0.3;">chat_bubble_outline</span>
          <p style="font-size:14px;text-align:center;">No messages yet. Say hello! ≡ƒæï</p>
        </div>
      `;
      return;
    }

    let lastDateStr = '';

    const _albumGapMs = 2 * 60 * 1000;
    const _isImageType = t => t === 'image' || t === 'gif' || t === 'sticker';
    const _getMsgTs = msg => {
      const ts = msg.timestamp || msg.time;
      if (!ts) return 0;
      if (ts.toMillis) return ts.toMillis();
      if (ts.seconds) return ts.seconds * 1000;
      if (ts instanceof Date) return ts.getTime();
      return ts;
    };
    const _renderableMsgs = [];
    let i = 0;
    while (i < State.messages.length) {
      const m = State.messages[i];
      const mType = m.type || 'text';
      const mSender = m.senderId || m.userId || '';
      if (_isImageType(mType) && m.attachment) {
        const group = [m];
        let j = i + 1;
        while (j < State.messages.length) {
          const next = State.messages[j];
          const nType = next.type || 'text';
          if (!_isImageType(nType) || !next.attachment) break;
          if ((next.senderId || next.userId || '') !== mSender) break;
          if (Math.abs(_getMsgTs(next) - _getMsgTs(group[group.length - 1])) > _albumGapMs) break;
          group.push(next);
          j++;
        }
        if (group.length >= 2) {
          _renderableMsgs.push({ _album: true, items: group });
          i = j;
          continue;
        }
      }
      _renderableMsgs.push(m);
      i++;
    }

    _renderableMsgs.forEach(renderItem => {
      if (renderItem._album) {
        const albumItems = renderItem.items;
        const firstMsg = albumItems[0];
        const isMe = firstMsg.senderId === uid || firstMsg.userId === uid;
        const ts = firstMsg.timestamp || firstMsg.time;
        const timeStr = formatTime(ts);
        const senderName = firstMsg.senderName || firstMsg.displayName || 'User';

        if (ts) {
          let ms;
          if (ts.toMillis) ms = ts.toMillis();
          else if (ts.seconds) ms = ts.seconds * 1000;
          else if (ts instanceof Date) ms = ts.getTime();
          else ms = ts;
          const dateStr = new Date(ms).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
          if (dateStr !== lastDateStr) {
            lastDateStr = dateStr;
            const sep = document.createElement('div');
            sep.style.cssText = 'display:flex;align-items:center;justify-content:center;margin:8px 0;padding:8px 0;';
            sep.innerHTML = `<span style="background:var(--surface-container,#f0f2f5);color:var(--on-surface-variant,#8696a0);font-size:11px;padding:4px 12px;border-radius:12px;">${esc(dateStr)}</span>`;
            msgWrap.appendChild(sep);
          }
        }

        const count = Math.min(albumItems.length, 9);
        const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
        const gridHTML = albumItems.slice(0, 9).map((item, idx) => {
          const url = item.attachment ? (item.attachment.url || item.attachment) : '';
          const cellSize = cols === 1 ? 'width:260px;height:260px' : cols === 2 ? 'width:130px;height:130px' : 'width:88px;height:88px';
          return `<div style="${cellSize};overflow:hidden;border-radius:${idx === 0 ? '8px 0 0 0' : idx === 1 && cols === 2 ? '0 8px 0 0' : idx === cols - 1 ? '0 8px 0 0' : '0'};cursor:pointer;position:relative" onclick="window.openMediaViewer && window.openMediaViewer('${esc(url)}','image')"><img src="${esc(url)}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`;
        }).join('');

        const row = document.createElement('div');
        row.className = `message-row ${isMe ? 'msg-out' : 'msg-in'}`;
        row.style.cssText = `display:flex;justify-content:${isMe ? 'flex-end' : 'flex-start'};padding:2px 12px;margin:1px 0;`;

        const bubbleColor = isMe ? 'var(--primary-container,#d9fdd3)' : 'var(--surface-container,#fff)';
        const textColor = isMe ? 'var(--on-primary-container,#0a1628)' : 'var(--on-surface,#1c1c1e)';

        row.innerHTML = `
          <div class="message-bubble msg-bubble album-bubble ${isMe ? 'my-message' : ''}"
            style="max-width:70%;background:${bubbleColor};color:${textColor};padding:4px;border-radius:${isMe ? '18px 4px 18px 18px' : '4px 18px 18px 18px'};box-shadow:0 1px 2px rgba(0,0,0,0.08);position:relative;">
            ${State.activeType === 'group' && !isMe ? `<div style="font-size:12px;font-weight:600;color:var(--primary,#00a884);margin-bottom:2px;padding:4px 8px 0">${esc(senderName)}</div>` : ''}
            <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:2px;padding:2px">
              ${gridHTML}
            </div>
            ${count > 9 ? `<div style="text-align:center;font-size:11px;padding:4px;opacity:0.7">+${count - 9} more</div>` : ''}
            <div style="display:flex;justify-content:flex-end;align-items:center;gap:3px;padding:2px 8px 4px;">
              <span style="font-size:10px;opacity:0.6;" class="msg-time message-time">${timeStr}</span>
              ${isMe ? `<span class="material-symbols-outlined" style="font-size:12px;opacity:0.7;color:${firstMsg.readBy && Object.keys(firstMsg.readBy).length > 1 ? '#00a884' : 'inherit'};">
                ${firstMsg.readBy && Object.keys(firstMsg.readBy).length > 1 ? 'done_all' : (firstMsg.delivered ? 'done_all' : 'done')}
              </span>` : ''}
            </div>
          </div>`;
        msgWrap.appendChild(row);
        return;
      }

      const msg = renderItem;
      const isMe = msg.senderId === uid || msg.userId === uid;
      const ts = msg.timestamp || msg.time;
      const timeStr = formatTime(ts);

      // Date separator
      if (ts) {
        let ms;
        if (ts.toMillis) ms = ts.toMillis();
        else if (ts.seconds) ms = ts.seconds * 1000;
        else if (ts instanceof Date) ms = ts.getTime();
        else ms = ts;
        const dateStr = new Date(ms).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        if (dateStr !== lastDateStr) {
          lastDateStr = dateStr;
          const sep = document.createElement('div');
          sep.style.cssText = 'display:flex;align-items:center;justify-content:center;margin:8px 0;padding:8px 0;';
          sep.innerHTML = `<span style="background:var(--surface-container,#f0f2f5);color:var(--on-surface-variant,#8696a0);
            font-size:11px;padding:4px 12px;border-radius:12px;">${esc(dateStr)}</span>`;
          msgWrap.appendChild(sep);
        }
      }

      const text = msg.text || msg.message || msg.content || '';
      const senderName = msg.senderName || msg.displayName || 'User';
      const msgType = msg.type || 'text';

      // Build message bubble
      const row = document.createElement('div');
      row.className = `message-row ${isMe ? 'msg-out' : 'msg-in'}`;
      row.setAttribute('data-msg-id', msg.id);
      row.setAttribute('data-message-id', msg.id);
      row.style.cssText = `
        display: flex;
        justify-content: ${isMe ? 'flex-end' : 'flex-start'};
        padding: 2px 12px;
        margin: 1px 0;
      `;

      let content = '';
      if (msgType === 'image' && msg.attachment) {
        content = `<img src="${esc(msg.attachment.url || msg.attachment)}" alt="Image" 
          style="max-width:260px;max-height:260px;border-radius:8px;display:block;cursor:pointer;"
          onclick="window.openMediaViewer && window.openMediaViewer('${esc(msg.attachment.url || msg.attachment)}','image')">`;
      } else if (msgType === 'video' && msg.attachment) {
        content = `<video src="${esc(msg.attachment.url || msg.attachment)}" controls 
          style="max-width:260px;max-height:200px;border-radius:8px;display:block;"></video>`;
      } else if (msgType === 'videoNote' && (msg.attachment || msg.videoURL || msg.url)) {
        const _vnUrl = msg.attachment ? (msg.attachment.url || msg.attachment) : (msg.videoURL || msg.url);
        content = `<video src="${esc(_vnUrl)}" controls playsinline 
          style="width:220px;height:240px;border-radius:12px;display:block;object-fit:cover;background:#000;"
          preload="metadata"></video>`;
      } else if (msgType === 'audio' || msgType === 'voice') {
        content = `<audio src="${esc(msg.attachment && (msg.attachment.url || msg.attachment))}" controls 
          style="max-width:220px;"></audio>`;
      } else if (msgType === 'sticker') {
        const _sUrl = msg.attachment && (msg.attachment.url || msg.attachment);
        content = `<img src="${esc(_sUrl)}" alt="Sticker" draggable="false"
          style="max-width:150px;max-height:150px;display:block;cursor:pointer;"
          onclick="window.openMediaViewer && window.openMediaViewer('${esc(_sUrl)}','image')">`;
      } else if (msgType === 'gif') {
        const _gUrl = msg.attachment && (msg.attachment.url || msg.attachment);
        content = `<img src="${esc(_gUrl)}" alt="GIF" 
          style="max-width:260px;max-height:220px;border-radius:8px;display:block;cursor:pointer;"
          onclick="window.openMediaViewer && window.openMediaViewer('${esc(_gUrl)}','image')">`;
      } else if (msgType === 'location' || (msgType === 'text' && /maps\.google(?:usercontent)?\.com\/(?:maps\/)?\?q=/.test(text))) {
        const _locMatch = text.match(/q=(-?[\d.]+),(-?[\d.]+)/);
        const _lat = msg.latitude || (_locMatch && _locMatch[1]);
        const _lng = msg.longitude || (_locMatch && _locMatch[2]);
        if (_lat && _lng) {
          content = _renderLocationCard(_lat, _lng, msg.text || text);
        }
      } else if (msgType === 'poll' && msg.poll) {
        content = _renderPollContent(msg, uid);
      } else if (msg.attachment) {
        content = `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
          <span class="material-symbols-outlined" style="font-size:20px;">attach_file</span>
          <a href="${esc(msg.attachment.url || msg.attachment)}" target="_blank" rel="noopener"
            style="color:inherit;text-decoration:underline;font-size:13px;">
            ${esc(msg.attachment.name || 'Attachment')}
          </a>
        </div>`;
      }

      if (text) content += `<div class="msg-text message-text" style="font-size:14px;line-height:1.5;">${_formatMsgText(text)}</div>`;

      // Reply preview
      let replyHTML = '';
      if (msg.replyTo && (msg.replyTo.text || msg.replyTo.senderName)) {
        replyHTML = `<div style="border-left:3px solid var(--primary,#00a884);padding:4px 8px;margin-bottom:4px;
          background:rgba(0,0,0,0.05);border-radius:4px;font-size:12px;opacity:0.8;">
          <span style="font-weight:600;">${esc(msg.replyTo.senderName || 'User')}</span><br>
          ${esc((msg.replyTo.text || '').substring(0, 60))}
        </div>`;
      }

      const bubbleColor = isMe
        ? 'var(--primary-container,#d9fdd3)'
        : 'var(--surface-container,#fff)';
      const textColor = isMe
        ? 'var(--on-primary-container,#0a1628)'
        : 'var(--on-surface,#1c1c1e)';

      const reactHTML = (window.renderReactions && msg.reactions)
        ? window.renderReactions(msg.id, msg.reactions)
        : '';
      const starHTML = msg.starred || msg.isStarred
        ? '<span class="nsl-star-icon" style="color:#f5a623;margin-left:4px;vertical-align:middle;display:inline-flex;align-items:center;"><span class="material-symbols-outlined" style="font-size:14px">star</span></span>'
        : '';
      const keptHTML = (msg.kept === true || msg.keepInChat === true)
        ? '<span class="nsl-kept-icon" title="Kept in chat" style="margin-left:2px;vertical-align:middle;display:inline-flex;align-items:center;"><span class="material-symbols-outlined" style="font-size:12px">bookmark</span></span>'
        : '';
      const editedHTML = msg.edited
        ? '<span class="nsl-edited-label" style="font-size:11px;font-weight:400;opacity:0.7;font-style:italic;margin-left:2px;"> (edited)</span>'
        : '';

      row.innerHTML = `
        <div class="message-bubble msg-bubble ${isMe ? 'my-message' : ''}" 
          style="max-width:70%;background:${bubbleColor};color:${textColor};
          padding:8px 12px;border-radius:${isMe ? '18px 4px 18px 18px' : '4px 18px 18px 18px'};
          box-shadow:0 1px 2px rgba(0,0,0,0.08);position:relative;">
          ${State.activeType === 'group' && !isMe ? `<div style="font-size:12px;font-weight:600;color:var(--primary,#00a884);margin-bottom:2px;">${esc(senderName)}</div>` : ''}
          ${replyHTML}
          ${content}
          ${reactHTML}
          ${window.MessageEffects && msg.effect ? window.MessageEffects.chipHTML(msg.effect) : ''}
          <div style="display:flex;justify-content:flex-end;align-items:center;gap:3px;margin-top:3px;">
            <span style="font-size:10px;opacity:0.6;" class="msg-time message-time">${timeStr}</span>
            ${editedHTML}
            ${starHTML}
            ${keptHTML}
            ${isMe ? `<span class="material-symbols-outlined" style="font-size:12px;opacity:0.7;color:${msg.readBy && Object.keys(msg.readBy).length > 1 ? '#00a884' : 'inherit'};">
              ${msg.readBy && Object.keys(msg.readBy).length > 1 ? 'done_all' : (msg.delivered ? 'done_all' : 'done')}
            </span>` : ''}
          </div>
        </div>
      `;

      msgWrap.appendChild(row);
      if (window.MessageEffects && msg.effect) window.MessageEffects.playOnRow(row, msg);
    });

    // Scroll to bottom
    requestAnimationFrame(() => {
      msgWrap.scrollTop = msgWrap.scrollHeight;
    });
  }

  function _markRead(chatId, chatType, uid) {
    const db = getDB();
    if (!db || !uid || !chatId) return;
    try {
      const collection = _messagesCollection(chatType);
      db.collection(collection).doc(chatId).update({
        [`unreadCounts.${uid}`]: 0
      }).catch(() => {});
    } catch (_) {}
  }

  /* ΓöÇΓöÇ Send Message ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  async function sendMessage() {
    const db = getDB();
    const uid = getUID();
    const user = getCurrentUser();
    if (!db || !uid || !State.activeId) return;

    const inputEl = document.getElementById('msg-input') || document.getElementById('messageInput');
    if (!inputEl) return;

    const text = (inputEl.value || inputEl.textContent || inputEl.innerText || '').trim();
    if (!text) return;

    // Clear input
    if (inputEl.value !== undefined) inputEl.value = '';
    else inputEl.textContent = '';
    inputEl.focus();

    // Broadcast lists route through the broadcast sender (delivers per-recipient copies)
    if (State.activeType === 'broadcast') {
      if (typeof window.sendBroadcastMessage === 'function') {
        window.sendBroadcastMessage(text, null, 'text');
      } else {
        _toast('Broadcast is not available', 'error');
      }
      return;
    }

    // Encrypt text messages end-to-end (direct / group)
    let e2e = null;
    if (window.E2E && E2E.supports(State.activeType)) {
      e2e = await E2E.encryptForChat(State.activeId, State.activeType, text).catch(() => null);
    }
    const encrypted = !!(e2e && e2e.enc);
    const preview = encrypted ? E2E.securePreview() : text;

    const fx = (window.MessageEffects && window.MessageEffects.takePending()) || null;

    const collection = State.activeType === 'group' ? 'groups' : 'chats';
    const msgData = encrypted
      ? {
          enc: e2e.enc,
          e2e: true,
          senderId: uid,
          senderName: user.displayName || user.email || 'Me',
          senderPhotoURL: user.photoURL || '',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          type: 'text',
          readBy: { [uid]: true },
          effect: fx,
        }
      : {
          text,
          senderId: uid,
          senderName: user.displayName || user.email || 'Me',
          senderPhotoURL: user.photoURL || '',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          type: 'text',
          readBy: { [uid]: true },
          effect: fx,
        };

    // Optimistic render
    const optimistic = {
      id: `_opt_${Date.now()}`,
      ...msgData,
      text: encrypted ? preview : text,
      timestamp: { toMillis: () => Date.now(), seconds: Date.now() / 1000 },
    };
    State.messages.push(optimistic);
    const msgWrap = document.getElementById('messages-wrap');
    if (msgWrap) _renderMessagesList(msgWrap, uid);

    // Write to Firestore
    const batch = db.batch();
    const msgRef = db.collection(collection).doc(State.activeId).collection('messages').doc();
    batch.set(msgRef, { ...msgData, id: msgRef.id });
    batch.update(db.collection(collection).doc(State.activeId), {
      lastMessage: preview,
      lastMessageText: preview,
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastSenderId: uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    batch.commit().then(() => {
      const optIdx = State.messages.findIndex(m => m.id === optimistic.id);
      if (optIdx !== -1) State.messages.splice(optIdx, 1);
      const msgWrap = document.getElementById('messages-wrap');
      if (msgWrap) _renderMessagesList(msgWrap, uid);
    }).catch(err => {
      if (window.__DEBUG__) console.warn('[chat-core] sendMessage error:', err);
      const optIdx = State.messages.findIndex(m => m.id === optimistic.id);
      if (optIdx !== -1) {
        State.messages[optIdx]._failed = true;
        State.messages[optIdx]._queued = false;
      }
      if (typeof window.OfflineQueue !== 'undefined' && typeof window.OfflineQueue.enqueue === 'function') {
        window.OfflineQueue.enqueue({
          chatId: State.activeId,
          chatType: State.activeType,
          text: encrypted ? undefined : text,
          enc: encrypted ? e2e : undefined,
          e2e: encrypted,
          attachments: [],
          replyTo: null,
          tempId: optimistic.id,
        }).then(() => {
          const qi = State.messages.findIndex(m => m.id === optimistic.id);
          if (qi !== -1) { State.messages[qi]._queued = true; State.messages[qi]._failed = false; }
          const mw = document.getElementById('messages-wrap');
          if (mw) _renderMessagesList(mw, uid);
          if (typeof window.showToast === 'function') window.showToast('Message queued for retry', 'info');
        }).catch(() => {
          if (typeof window.showToast === 'function') window.showToast('Failed to send message', 'error');
        });
      } else {
        if (typeof window.showToast === 'function') window.showToast('Failed to send message', 'error');
      }
    });
  }

  /* ΓöÇΓöÇ Polls ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  function _pollTotalVotes(poll) {
    const votes = (poll && poll.votes) || {};
    let total = 0;
    Object.keys(votes).forEach(k => {
      if (Array.isArray(votes[k])) total += votes[k].length;
    });
    return total;
  }

  function _pollHasVoted(poll, uid) {
    const votes = (poll && poll.votes) || {};
    return Object.keys(votes).some(k => Array.isArray(votes[k]) && votes[k].indexOf(uid) !== -1);
  }

  function _renderPollContent(msg, uid) {
    const poll = msg.poll || {};
    const options = Array.isArray(poll.options) ? poll.options : [];
    const totalVotes = _pollTotalVotes(poll);
    const hasVoted = _pollHasVoted(poll, uid);
    const closed = !!poll.closed;
    const showResults = closed || hasVoted || totalVotes > 0;

    const rows = options.map(o => {
      const optId = o.id || '';
      const optText = o.text || '';
      const count = (poll.votes && Array.isArray(poll.votes[optId])) ? poll.votes[optId].length : 0;
      const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
      const mine = Array.isArray(poll.votes && poll.votes[optId]) && poll.votes[optId].indexOf(uid) !== -1;
      const barColor = mine ? '#00a884' : '#d7dbdc';
      return `
        <button class="poll-opt ${mine ? 'poll-opt-checked' : ''}"
          style="display:block;position:relative;width:100%;text-align:left;border:1px solid #e0e0e0;
            border-radius:8px;padding:8px 10px;margin-bottom:6px;background:#fff;cursor:pointer;overflow:hidden;
            ${closed ? 'cursor:default;' : ''}"
          ${closed ? 'disabled' : `onclick="window.votePoll('${msg.id}','${optId}')"`}>
          <span class="poll-bar" style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:${barColor};opacity:0.18;border-radius:8px;"></span>
          <span style="position:relative;display:flex;align-items:center;gap:6px;">
            <span class="material-symbols-outlined" style="font-size:14px;color:${mine ? '#00a884' : '#8696a0'};">${mine ? 'check_circle' : 'circle'}</span>
            <span class="poll-opt-text" style="font-size:13px;font-weight:500;">${esc(optText)}</span>
            ${showResults ? `<span class="poll-opt-count" style="margin-left:auto;font-size:12px;opacity:0.75;">${count} (${pct}%)</span>` : ''}
          </span>
        </button>`;
    }).join('');

    const footer = closed
      ? '<div style="font-size:11px;opacity:0.7;text-align:center;">Poll closed</div>'
      : (hasVoted ? '' : '<div style="font-size:11px;opacity:0.7;text-align:center;">Tap an option to vote</div>');

    return `
      <div class="poll-card" style="min-width:230px;max-width:280px;">
        <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:8px;">
          <span class="material-symbols-outlined" style="font-size:18px;color:#53BDEB;">poll</span>
          <div style="font-size:14px;font-weight:600;line-height:1.4;">${esc(poll.question || 'Poll')}</div>
        </div>
        <div style="display:flex;flex-direction:column;">
          ${rows}
          <div style="font-size:11px;opacity:0.7;margin-top:2px;">${totalVotes} vote${totalVotes === 1 ? '' : 's'}</div>
          ${footer}
        </div>
      </div>`;
  }

  window.votePoll = function (msgId, optionId) {
    const db = getDB();
    const uid = getUID();
    if (!db || !uid || !State.activeId || !msgId || !optionId) return;
    const collection = _messagesCollection(State.activeType);
    const ref = db.collection(collection).doc(State.activeId).collection('messages').doc(msgId);

    db.runTransaction(tx => {
      return tx.get(ref).then(snap => {
        if (!snap.exists) return;
        const data = snap.data() || {};
        const poll = data.poll || {};
        const votes = Object.assign({}, poll.votes || {});
        const multi = !!poll.allowMultiple;
        if (poll.closed) return;

        if (multi) {
          const arr = Array.isArray(votes[optionId]) ? votes[optionId].slice() : [];
          const idx = arr.indexOf(uid);
          if (idx !== -1) arr.splice(idx, 1);
          else arr.push(uid);
          votes[optionId] = arr;
        } else {
          Object.keys(votes).forEach(k => {
            votes[k] = (Array.isArray(votes[k]) ? votes[k].slice() : []).filter(id => id !== uid);
          });
          votes[optionId] = votes[optionId] || [];
          if (votes[optionId].indexOf(uid) === -1) votes[optionId].push(uid);
        }
        tx.update(ref, { 'poll.votes': votes });
      });
    }).then(() => {
      const msgWrap = document.getElementById('messages-wrap');
      if (msgWrap) renderMessages(State.activeId);
    }).catch(err => {
      if (window.__DEBUG__) console.warn('[chat-core] votePoll error:', err);
      if (typeof window.showToast === 'function') window.showToast('Vote failed', 'error');
    });
  };

  window.sendPollMessage = function (question, options, allowMultiple) {
    const db = getDB();
    const uid = getUID();
    const user = getCurrentUser();
    if (!db || !uid || !State.activeId || !question || !options || !options.length) {
      if (typeof window.showToast === 'function') window.showToast('Cannot create poll', 'error');
      return;
    }
    const collection = _messagesCollection(State.activeType);
    const batch = db.batch();
    const msgRef = db.collection(collection).doc(State.activeId).collection('messages').doc();
    const pollMsg = {
      type: 'poll',
      text: question,
      poll: {
        question,
        options: options.map((text, i) => ({ id: 'opt_' + i, text })),
        allowMultiple: !!allowMultiple,
        votes: {},
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      senderId: uid,
      senderName: user.displayName || user.email || 'Me',
      senderPhotoURL: user.photoURL || '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      readBy: { [uid]: true },
      id: msgRef.id,
    };
    var _writePoll = function(m) {
      batch.set(msgRef, m);
      batch.update(db.collection(collection).doc(State.activeId), {
        lastMessage: m.e2e ? '🔒 Poll' : ('📊 ' + question),
        lastMessageText: m.e2e ? '🔒 Poll' : ('📊 ' + question),
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSenderId: uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return batch.commit();
    };
    if (window.E2E && window.E2E.encryptPayload) {
      window.E2E.encryptPayload(pollMsg, State.activeId, State.activeType).then(_writePoll).then(() => {
        if (typeof window.renderMessages === 'function') renderMessages(State.activeId);
      }).catch(err => {
        if (window.__DEBUG__) console.warn('[chat-core] sendPollMessage error:', err);
        if (typeof window.showToast === 'function') window.showToast('Failed to send poll', 'error');
      });
    } else {
      _writePoll(pollMsg).then(() => {
        if (typeof window.renderMessages === 'function') renderMessages(State.activeId);
      }).catch(err => {
        if (window.__DEBUG__) console.warn('[chat-core] sendPollMessage error:', err);
        if (typeof window.showToast === 'function') window.showToast('Failed to send poll', 'error');
      });
    }
  };

  /* ΓöÇΓöÇ Send button & Enter key wiring ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  function _wireInputArea() {
    const sendBtn = document.getElementById('send-btn') || document.querySelector('[data-action="sendMessage"], .send-btn');
    const msgInput = document.getElementById('msg-input') || document.getElementById('messageInput');

    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        if (typeof window.sendMessage === 'function') window.sendMessage();
      });
    }

    if (msgInput) {
      msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (typeof window.sendMessage === 'function') window.sendMessage();
        }
      });
    }
  }

  /* ΓöÇΓöÇ Start a direct chat ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  function startDirectChat(user) {
    if (!user || (!user.id && !user.uid)) return Promise.resolve();
    const otherId = user.id || user.uid;
    const myId = getUID();
    if (!myId) return Promise.resolve();

    // Determine canonical chat ID (sorted UIDs joined)
    const chatId = [myId, otherId].sort().join('_');

    const db = getDB();
    if (!db) return Promise.resolve();

    // Create or update chat doc
    const ref = db.collection('chats').doc(chatId);
    return ref.get().then(snap => {
      if (!snap.exists) {
        return ref.set({
          participants: [myId, otherId],
          participantNames: { [myId]: window.currentUser?.displayName || 'Me', [otherId]: user.name || user.displayName || user.email || 'User' },
          participantPhotos: { [myId]: window.currentUser?.photoURL || '', [otherId]: user.photoURL || '' },
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
          type: 'direct',
        });
      }
    }).then(() => openChat(chatId, 'direct'))
      .catch(e => { if (window.__DEBUG__) console.warn('[chat-core] startDirectChat:', e); });
  }

  /* ── Select/open a chat by id or user uid ─────────────────────────────
     Central entry used by New Chat, contact pickers, notifications,
     reminders and saved-messages. Accepts a chat doc id (direct/group/
     broadcast) or a raw user uid, and opens the matching conversation. */
  function selectChat(chatId, chatType) {
    if (!chatId) return Promise.resolve();
    if (chatType === 'group') return openChat(chatId, 'group');
    if (chatType === 'broadcast') return openChat(chatId, 'broadcast');

    const known = State.chats.find(c => c.id === chatId);
    if (known) return openChat(known.id, known.type || 'direct');

    const myUid = getUID();
    if (typeof chatId === 'string' && myUid) {
      const canonical = [myUid, chatId].sort().join('_');
      const existing = State.chats.find(c => c.id === canonical);
      if (existing) return openChat(canonical, existing.type || 'direct');
    }

    if (typeof chatId === 'string' && chatId.indexOf('_') === -1) {
      return startDirectChat({ uid: chatId });
    }

    return openChat(chatId, 'direct');
  }

  /* ΓöÇΓöÇ Back to list (mobile) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  function backToList() {
    State.activeId = null;
    State.activeChatData = null;
    window.currentChat = null;
    const sidebar = document.getElementById('chat-list-sidebar');
    const chatArea = document.getElementById('chat-area');
    if (sidebar) sidebar.style.display = '';
    if (chatArea) chatArea.style.display = 'none';
    // Re-hide skeleton only if chats already loaded
    hideSkeleton();
  }

  /* ΓöÇΓöÇ Global function exports ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  // Core functions
  window.subscribeToChats = subscribeToChats;
  window.subscribeToGroups = subscribeToGroups;
  window.subscribeToBroadcasts = subscribeToBroadcasts;
  window.openChat = openChat;
  window.renderMessages = renderMessages;
  window.sendMessage = sendMessage;
  window.startDirectChat = startDirectChat;
  window.selectChat = selectChat;
  window.backToList = backToList;

  // Reload helpers expected by other modules
  window.loadCurrentChatList = function () {
    if (State.activeType === 'group') subscribeToGroups();
    else if (State.activeType === 'broadcast') subscribeToBroadcasts();
    else { subscribeToChats(); subscribeToGroups(); }
  };
  window.loadChatsList = subscribeToChats;
  window.loadGroupsList = subscribeToGroups;

  // Stubs for feature modules to wrap/enhance
  if (!window.escapeHtml) window.escapeHtml = esc;
  if (!window.getInitials) window.getInitials = initials;

  window.highlightMessage = function (msgId) {
    const el = document.querySelector(`[data-msg-id="${msgId}"],[data-message-id="${msgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('cf-highlight');
      setTimeout(() => el.classList.remove('cf-highlight'), 2000);
    }
  };

  window.getChatById = function (id) {
    return State.chats.find(c => c.id === id) || null;
  };

  window.getCurrentMessages = function () { return State.messages; };
  window.getCurrentChatState = function () { return State; };

  /* ΓöÇΓöÇ Action delegation (data-action) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'sendMessage') { sendMessage(); return; }
    if (action === 'backToList') { backToList(); return; }
    if (action === 'openNewChat') {
      // Try to open new chat modal / search
      if (typeof window.SearchContacts === 'object' && window.SearchContacts.open) window.SearchContacts.open();
      else if (typeof window.openNewChatModal === 'function') window.openNewChatModal();
      return;
    }
  });

  /* ΓöÇΓöÇ Bootstrap ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

  function _bootstrap() {
    const uid = getUID();
    if (uid) {
      subscribeToChats();
      subscribeToGroups();
      subscribeToBroadcasts();
      if (_onlineTimer) clearInterval(_onlineTimer);
      _onlineTimer = setInterval(_refreshOnlineUsers, 20000);
    }
    _wireInputArea();
  }

  // Listen for auth ready
  document.addEventListener('nsl:auth-ready', function (e) {
    if (e.detail && e.detail.user) {
      // Wait a tick for window.currentUser to be set
      setTimeout(_bootstrap, 100);
    } else {
      // Not logged in ΓÇö hide skeleton, show nothing
      hideSkeleton();
    }
  });

  // Also trigger immediately if already authed
  const uid = getUID();
  if (uid) {
    setTimeout(_bootstrap, 200);
  } else {
    // Hide skeleton after timeout if no auth
    setTimeout(() => {
      if (!getUID()) hideSkeleton();
    }, 8000);
  }

  if (window.__DEBUG__) console.log('[chat-core] v1.0 loaded Γ£ô');
})();
