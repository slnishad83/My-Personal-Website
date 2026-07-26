'use strict';
/**
 * MARK AS UNREAD — Mark any chat as unread from context menu or long-press
 * Stores unread counts in Firestore user doc, shows badge on chat list.
 */
(function () {
  const MarkUnread = {
    _key: 'nsl_unread_chats',

    getUnreadMap() {
      try { return JSON.parse(localStorage.getItem(this._key) || '{}'); } catch (_) { return {}; }
    },

    _save(map) {
      try { localStorage.setItem(this._key, JSON.stringify(map)); } catch (_) {}
    },

    async markChatUnread(chatId) {
      const map = this.getUnreadMap();
      map[chatId] = {
        count: (map[chatId]?.count || 0) + 1,
        timestamp: Date.now()
      };
      this._save(map);
      this._updateBadge(chatId, map[chatId].count);

      const uid = window.App?.uid?.() || window.currentUser?.uid;
      const db = window.App?.db;
      if (uid && db) {
        try {
          await db.collection('users').doc(uid).set({
            unreadChats: map
          }, { merge: true });
        } catch (_) {}
      }

      document.dispatchEvent(new CustomEvent('chat-unread-change', { detail: { chatId, unread: true } }));
    },

    async markChatRead(chatId) {
      const map = this.getUnreadMap();
      delete map[chatId];
      this._save(map);
      this._updateBadge(chatId, 0);

      const uid = window.App?.uid?.() || window.currentUser?.uid;
      const db = window.App?.db;
      if (uid && db) {
        try {
          await db.collection('users').doc(uid).set({
            unreadChats: map
          }, { merge: true });
        } catch (_) {}
      }

      document.dispatchEvent(new CustomEvent('chat-unread-change', { detail: { chatId, unread: false } }));
    },

    async markAllRead() {
      const map = this.getUnreadMap();
      const chatIds = Object.keys(map);
      for (const id of chatIds) {
        this._updateBadge(id, 0);
      }
      this._save({});
      const uid = window.App?.uid?.() || window.currentUser?.uid;
      const db = window.App?.db;
      if (uid && db) {
        try {
          await db.collection('users').doc(uid).set({ unreadChats: {} }, { merge: true });
        } catch (_) {}
      }
    },

    _updateBadge(chatId, count) {
      var safeChatId = window.CSS && CSS.escape ? CSS.escape(chatId) : chatId;
      const chatItem = document.querySelector('[data-chat-id="' + safeChatId + '"]');
      if (!chatItem) return;
      let badge = chatItem.querySelector('.unread-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'unread-badge';
          badge.style.cssText = 'min-width:20px;height:20px;border-radius:10px;background:var(--primary,#00a884);color:var(--on-primary,#fff);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 6px;flex-shrink:0;';
          const nameEl = chatItem.querySelector('.chat-name, .font-semibold');
          if (nameEl && nameEl.parentElement) {
            nameEl.parentElement.appendChild(badge);
          }
        }
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
      } else if (badge) {
        badge.style.display = 'none';
      }
    },

    restoreAllBadges() {
      const map = this.getUnreadMap();
      for (const [chatId, data] of Object.entries(map)) {
        this._updateBadge(chatId, data.count);
      }
    }
  };

  window.MarkUnread = MarkUnread;

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action="mark-unread"]');
    if (btn) {
      const chatId = btn.dataset.chatId || window.App?.currentChat?.id;
      if (chatId) {
        MarkUnread.markChatUnread(chatId);
        if (typeof showToast === 'function') showToast('Chat marked as unread', 'success');
        if (window._removeCtxMenu) window._removeCtxMenu();
      }
    }
  });

  let _markReadProcessing = false;
  document.addEventListener('chat-unread-change', function (e) {
    if (_markReadProcessing) return;
    if (e.detail && !e.detail.unread && e.detail.chatId === window.App?.currentChat?.id) {
      _markReadProcessing = true;
      MarkUnread.markChatRead(e.detail.chatId);
      setTimeout(function () { _markReadProcessing = false; }, 100);
    }
  });
})();
