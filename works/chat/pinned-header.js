'use strict';
/**
 * PINNED MESSAGES IN GROUP HEADER — Show pinned messages bar at top of group chats
 * Displays latest pinned message with tap to expand.
 */
(function () {
  const PinnedHeader = {
    _container: null,

    async show(chatId) {
      this.hide();
      if (!chatId) return;

      const db = window.App?.db;
      if (!db) return;

      try {
        const snap = await db.collection('pinnedMessages')
          .where('chatId', '==', chatId)
          .orderBy('pinnedAt', 'desc')
          .limit(3)
          .get();

        if (snap.empty) return;

        const pins = [];
        snap.forEach(doc => pins.push({ id: doc.id, ...doc.data() }));

        this._container = document.createElement('div');
        this._container.id = 'pinned-header-bar';
        this._container.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 16px;background:var(--surface-container,#fff);border-bottom:1px solid var(--outline-variant,#eee);cursor:pointer;transition:background 0.15s;flex-shrink:0;';

        const latest = pins[0];
        const senderName = latest.senderName || latest.senderId || 'Unknown';
        const text = latest.text || latest.content || '';
        const pinCount = pins.length;

        this._container.innerHTML = `
          <span class="material-symbols-outlined" style="font-size:18px;color:var(--primary,#00a884);">push_pin</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:600;color:var(--primary,#00a884);">${this._esc(senderName)}</div>
            <div style="font-size:13px;color:var(--on-surface,#000);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._esc(text.slice(0, 100))}</div>
          </div>
          ${pinCount > 1 ? `<span style="font-size:11px;color:var(--on-surface-variant,#666);white-space:nowrap;">${pinCount} pinned</span>` : ''}
          <button aria-label="Close pinned bar" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant,#666);padding:4px;">
            <span class="material-symbols-outlined" style="font-size:16px;">close</span>
          </button>
        `;

        this._container.addEventListener('click', (e) => {
          if (e.target.closest('button')) {
            this.hide();
            return;
          }
          this._openPinnedPanel(chatId, pins);
        });

        this._container.addEventListener('mouseenter', () => {
          this._container.style.background = 'var(--surface-variant,#f0f2f5)';
        });
        this._container.addEventListener('mouseleave', () => {
          this._container.style.background = 'var(--surface-container,#fff)';
        });

        const chatHeader = document.getElementById('chat-header') || document.querySelector('.chat-header');
        if (chatHeader) {
          chatHeader.parentElement.insertBefore(this._container, chatHeader.nextSibling);
        }
      } catch (e) {
        if (window.__DEBUG__) console.warn('[PinnedHeader] Error:', e);
      }
    },

    hide() {
      if (this._container) {
        this._container.remove();
        this._container = null;
      }
    },

    _openPinnedPanel(chatId, pins) {
      const modal = document.createElement('div');
      modal.id = 'pinned-messages-panel';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

      modal.innerHTML = `
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(420px,92vw);max-height:70vh;overflow:hidden;display:flex;flex-direction:column;">
          <div style="padding:16px 20px;border-bottom:1px solid var(--outline-variant,#eee);display:flex;align-items:center;gap:10px;">
            <span class="material-symbols-outlined" style="font-size:20px;color:var(--primary,#00a884);">push_pin</span>
            <h3 style="margin:0;flex:1;font-size:16px;font-weight:700;">Pinned Messages</h3>
            <button id="close-pinned-panel" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant,#666);font-size:18px;">✕</button>
          </div>
          <div style="overflow-y:auto;flex:1;padding:12px;">
            ${pins.map(pin => `
              <div style="padding:12px;border-radius:12px;background:var(--surface-variant,#f8f9fa);margin-bottom:8px;cursor:pointer;" data-pin-msg-id="${pin.messageId || pin.id}">
                <div style="font-size:12px;font-weight:600;color:var(--primary,#00a884);margin-bottom:4px;">${this._esc(pin.senderName || 'Unknown')}</div>
                <div style="font-size:14px;color:var(--on-surface,#000);">${this._esc((pin.text || pin.content || '').slice(0, 200))}</div>
                <div style="font-size:11px;color:var(--on-surface-variant,#666);margin-top:4px;">${pin.pinnedAt ? (pin.pinnedAt.toDate ? pin.pinnedAt.toDate() : new Date(pin.pinnedAt)).toLocaleString() : ''}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.querySelector('#close-pinned-panel').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
        const pinEl = e.target.closest('[data-pin-msg-id]');
        if (pinEl) {
          const msgId = pinEl.dataset.pinMsgId;
          if (msgId && typeof window.scrollToMessage === 'function') {
            window.scrollToMessage(msgId);
          }
          modal.remove();
        }
      });
    },

    _esc(s) {
      return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    }
  };

  window.PinnedHeader = PinnedHeader;
})();
