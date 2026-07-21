// ============================================================
// NOTIFICATION DIGEST — groups in-app notifications by sender
// and deduplicates browser push notifications.
//
// Drop into works/chat/ and add to index.html:
//   <script src="notification-digest.js" defer></script>
// ============================================================

(function () {
  'use strict';

  const WINDOW_MS   = 5 * 60 * 1000;  // 5-minute grouping window
  const MAX_NOTIFS  = 200;

  let _unsubNotifs  = null;
  let _rawNotifs    = [];              // all fetched notifications

  // ── Helpers ───────────────────────────────────────────────────────────────

  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };
  var _db = function() { return App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };

  function _relTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const day = Math.floor(h / 24);
    if (day > 0) return `${day}d ago`;
    if (h > 0)   return `${h}h ago`;
    if (m > 0)   return `${m}m ago`;
    return 'just now';
  }

  // ── Group notifications ───────────────────────────────────────────────────
  // Returns an array of display items — some are individual, some are groups

  function _groupNotifs(notifs) {
    // Sort newest-first
    const sorted = [...notifs].sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

    const result = [];
    const used   = new Set();

    sorted.forEach(n => {
      if (used.has(n.id)) return;
      const kind = n.kind || n.type || 'info';

      // Only group chat message notifications (kind === 'message')
      if (kind !== 'message' || !n.fromUserId) {
        result.push({ type: 'single', notif: n });
        used.add(n.id);
        return;
      }

      const groupKey = `${n.fromUserId}_${n.chatId || ''}`;
      const first    = sorted.find(x => !used.has(x.id) && x.fromUserId === n.fromUserId && (x.chatId || '') === (n.chatId || '') && Math.abs((x.createdAt?.toMillis?.() || 0) - (n.createdAt?.toMillis?.() || 0)) < WINDOW_MS);

      if (!first || first.id !== n.id) return; // will be part of another group

      // Find all siblings in the window
      const siblings = sorted.filter(x =>
        !used.has(x.id) &&
        x.fromUserId === n.fromUserId &&
        (x.chatId || '') === (n.chatId || '') &&
        Math.abs((x.createdAt?.toMillis?.() || 0) - (n.createdAt?.toMillis?.() || 0)) < WINDOW_MS
      );

      siblings.forEach(s => used.add(s.id));

      if (siblings.length === 1) {
        result.push({ type: 'single', notif: siblings[0] });
      } else {
        result.push({ type: 'group', notifs: siblings, latest: siblings[0] });
      }
    });

    return result;
  }

  // ── Render the notifications panel ───────────────────────────────────────

  function _renderPanel(items) {
    const panel = document.getElementById('notificationsPanel');
    if (!panel) return;

    if (!items.length) {
      panel.innerHTML = `<div class="nd-empty">No notifications</div>`;
      return;
    }

    let html = `<div class="nd-actions" style="display:flex;gap:8px;padding:8px 12px;border-bottom:1px solid var(--outline-variant,rgba(255,255,255,0.1));">
      <button class="nd-mark-all-read" style="flex:1;padding:6px 12px;border-radius:8px;border:1px solid var(--outline-variant,rgba(255,255,255,0.15));background:transparent;color:var(--on-surface-variant,#aaa);font-size:12px;font-weight:600;cursor:pointer;" onclick="window._notifDigest?.markAllRead()">Mark all read</button>
      <button class="nd-clear-all" style="flex:1;padding:6px 12px;border-radius:8px;border:1px solid var(--error,#f44336);background:transparent;color:var(--error,#f44336);font-size:12px;font-weight:600;cursor:pointer;" onclick="window._notifDigest?.clearAll()">Clear all</button>
    </div>`;
    items.forEach(item => {
      if (item.type === 'single') {
        const n = item.notif;
        html += _renderSingle(n);
      } else {
        html += _renderGroup(item);
      }
    });
    panel.innerHTML = html;

    // Click to navigate
    panel.querySelectorAll('[data-notif-chat-id]').forEach(el => {
      el.addEventListener('click', () => {
        const { notifChatId, notifChatType, notifUserId, notifMsgId } = el.dataset;
        const chatId = notifChatId;
        if (notifChatType === 'group' && typeof openGroupChat === 'function') {
          openGroupChat(chatId);
        } else if (notifUserId && typeof openDirectChatWithUser === 'function') {
          openDirectChatWithUser(notifUserId);
        } else if (typeof openChat === 'function') {
          openChat(chatId, notifChatType || 'direct');
        }
        if (notifMsgId && typeof scrollToMessage === 'function') {
          setTimeout(() => scrollToMessage(notifMsgId), 600);
        }
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        }
      });
    });

    // Update badge
    _updateBadge(items.length);
  }

  function _renderSingle(n) {
    const icon   = _notifIcon(n);
    const name   = window.sanitizeHTML(n.fromUserName || n.title || 'Notification');
    const msg    = window.sanitizeHTML((n.message || n.body || '').substring(0, 100));
    const time   = _relTime(n.createdAt);
    const attrs  = n.chatId
      ? `data-notif-chat-id="${window.sanitizeHTML(n.chatId)}" data-notif-chat-type="${window.sanitizeHTML(n.chatType || 'direct')}" data-notif-user-id="${window.sanitizeHTML(n.chatUserId || n.fromUserId || '')}"${n.messageId ? ` data-notif-msg-id="${window.sanitizeHTML(n.messageId)}"` : ''}`
      : '';
    return `<div class="nd-item nd-single" role="button" tabindex="0" ${attrs}>
      <div class="nd-icon">${icon}</div>
      <div class="nd-body">
        <div class="nd-name">${name}</div>
        ${msg ? `<div class="nd-msg">${msg}</div>` : ''}
        <div class="nd-time">${time}</div>
      </div>
    </div>`;
  }

  function _renderGroup(item) {
    const n     = item.latest;
    const count = item.notifs.length;
    const icon  = _notifIcon(n);
    const name  = window.sanitizeHTML(n.fromUserName || n.title || 'Messages');
    const preview = window.sanitizeHTML((n.message || '').substring(0, 80));
    const time  = _relTime(n.createdAt);
    const attrs = n.chatId
      ? `data-notif-chat-id="${window.sanitizeHTML(n.chatId)}" data-notif-chat-type="${window.sanitizeHTML(n.chatType || 'direct')}" data-notif-user-id="${window.sanitizeHTML(n.chatUserId || n.fromUserId || '')}"`
      : '';
    return `<div class="nd-item nd-group" role="button" tabindex="0" ${attrs}>
      <div class="nd-icon">${icon}</div>
      <div class="nd-body">
        <div class="nd-name">${name} <span class="nd-count">${count} messages</span></div>
        ${preview ? `<div class="nd-msg">${preview}</div>` : ''}
        <div class="nd-time">${time}</div>
      </div>
    </div>`;
  }

  function _notifIcon(n) {
    const kind = n.kind || n.type || '';
    if (kind === 'call')         return '📞';
    if (kind === 'chat_request') return '🤝';
    if (kind === 'group_invite') return '👥';
    if (kind === 'message')      return '💬';
    return '🔔';
  }

  function _updateBadge(count) {
    const badge = document.getElementById('notifAlertBadge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.style.display = 'inline-flex';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }

  // ── Subscribe to Firestore inAppNotifications ─────────────────────────────

  function _subscribe() {
    const uid = _uid(); const database = _db();
    if (!uid || !database) { setTimeout(_subscribe, 1000); return; }
    if (_unsubNotifs) _unsubNotifs();

    _unsubNotifs = database.collection('inAppNotifications')
      .where('toUserId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(MAX_NOTIFS)
      .onSnapshot(snap => {
        _rawNotifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const grouped = _groupNotifs(_rawNotifs);
        _renderPanel(grouped);
      }, err => { console.warn('[NotifDigest] Snapshot error:', err?.message); });
  }

  // ── Deduplicate browser push notifications ────────────────────────────────
  // Uses Notification.tag so that a new notification from the same sender
  // replaces the old one rather than stacking.

  function _patchServiceWorkerNotifs() {
    if (!('serviceWorker' in navigator)) return;
    // Listen for push messages and re-tag them
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.type !== 'PUSH_RECEIVED') return;
      const senderKey = data.fromUserId || data.chatId || 'default';
      // Notify the SW to use this tag (if SW supports it)
      event.source?.postMessage({ type: 'SET_NOTIF_TAG', tag: `msg_${senderKey}` });
    });
  }

  // ── Boot ─────────────────────────────────────────────────────────────────

  function _boot() {
    _patchServiceWorkerNotifs();
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().onAuthStateChanged(user => {
        if (user) setTimeout(_subscribe, 300);
      });
    } else {
      setTimeout(_subscribe, 1200);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  const digest = {
    markAllRead() {
      const uid = _uid();
      const database = _db();
      if (!uid || !database) return;
      const batch = database.batch();
      _rawNotifs.forEach(n => {
        if (!n.read) {
          batch.update(database.collection('inAppNotifications').doc(n.id), { read: true });
        }
      });
      batch.commit().catch(() => {});
      _updateBadge(0);
    },
    clearAll() {
      const uid = _uid();
      const database = _db();
      if (!uid || !database) return;
      const batch = database.batch();
      _rawNotifs.forEach(n => {
        batch.delete(database.collection('inAppNotifications').doc(n.id));
      });
      batch.commit().catch(() => {});
      _updateBadge(0);
    }
  };
  window._notifDigest = digest;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

})();
