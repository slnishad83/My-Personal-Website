'use strict';
/**
 * JUMP TO DATE â€” Open a date picker and scroll to messages from that date
 * Queries Firestore for messages near the selected date in the current chat.
 */
(function () {
  const JumpToDate = {
    _modal: null,

    open() {
      const chatId = window.App?.currentChat?.id;
      if (!chatId) {
        if (typeof showToast === 'function') showToast('Open a chat first', 'error');
        return;
      }
      this._showPicker(chatId);
    },

    _showPicker(chatId) {
      this._close();
      this._modal = document.createElement('div');
      this._modal.id = 'jump-to-date-modal';
      this._modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

      const today = new Date().toISOString().split('T')[0];

      this._modal.innerHTML =
        '<div style="background:var(--surface-container,#fff);border-radius:20px;width:min(360px,92vw);padding:24px;">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
            '<span class="material-symbols-outlined" style="font-size:20px;color:var(--primary,#00a884);">calendar_month</span>' +
            '<h3 style="margin:0;flex:1;font-size:16px;font-weight:700;">Jump to Date</h3>' +
            '<button id="jtd-close" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant,#666);font-size:18px;">&#x2715;</button>' +
          '</div>' +
          '<input type="date" id="jtd-date-input" max="' + today + '" style="width:100%;padding:12px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;background:var(--surface,#fff);color:var(--on-surface,#000);margin-bottom:16px;cursor:pointer;">' +
          '<div style="display:flex;gap:8px;">' +
            '<button id="jtd-cancel" style="flex:1;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;background:transparent;cursor:pointer;font-size:14px;">Cancel</button>' +
            '<button id="jtd-go" style="flex:1;padding:10px;border:none;border-radius:10px;background:var(--primary,#00a884);color:var(--on-primary,#fff);cursor:pointer;font-size:14px;font-weight:600;">Go</button>' +
          '</div>' +
          '<div id="jtd-loading" style="display:none;text-align:center;padding:12px 0;color:var(--on-surface-variant,#666);font-size:13px;">Searching messages...</div>' +
          '<div id="jtd-result" style="margin-top:12px;display:none;"></div>' +
        '</div>';

      document.body.appendChild(this._modal);

      const dateInput = this._modal.querySelector('#jtd-date-input');
      const closeBtn = this._modal.querySelector('#jtd-close');
      const cancelBtn = this._modal.querySelector('#jtd-cancel');
      const goBtn = this._modal.querySelector('#jtd-go');

      closeBtn.addEventListener('click', () => this._close());
      cancelBtn.addEventListener('click', () => this._close());
      this._modal.addEventListener('click', (e) => { if (e.target === this._modal) this._close(); });
      goBtn.addEventListener('click', () => this._findAndJump(chatId, dateInput.value));

      dateInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._findAndJump(chatId, dateInput.value);
      });
    },

    async _findAndJump(chatId, dateStr) {
      if (!dateStr) {
        if (typeof showToast === 'function') showToast('Pick a date first', 'error');
        return;
      }
      const loading = this._modal.querySelector('#jtd-loading');
      const resultEl = this._modal.querySelector('#jtd-result');
      if (loading) loading.style.display = 'block';
      if (resultEl) resultEl.style.display = 'none';

      try {
        const db = window.App?.db;
        if (!db) throw new Error('No database');

        const start = new Date(dateStr + 'T00:00:00');
        const end = new Date(dateStr + 'T23:59:59.999');

        const startTs = firebase.firestore.Timestamp.fromDate(start);
        const endTs = firebase.firestore.Timestamp.fromDate(end);

        const isGroup = !!(window.App?.currentChat && (window.App.currentChat.type === 'group' || window.App.currentChat.isGroup));
        const coll = isGroup ? 'groups' : 'chats';

        const snap = await db.collection(coll).doc(chatId).collection('messages')
          .where('timestamp', '>=', startTs)
          .where('timestamp', '<=', endTs)
          .orderBy('timestamp', 'asc')
          .limit(1)
          .get();

        if (snap.empty) {
          if (loading) loading.style.display = 'none';
          if (resultEl) {
            resultEl.style.display = 'block';
            resultEl.innerHTML = '<div style="text-align:center;color:var(--on-surface-variant,#666);font-size:13px;padding:12px 0;">No messages found on this date</div>';
          }
          return;
        }

        const firstDoc = snap.docs[0];
        const msgId = firstDoc.id;

        this._close();

        if (typeof window.scrollToMessage === 'function') {
          window.scrollToMessage(msgId);
        } else if (typeof window.VirtualScroll !== 'undefined' && window.VirtualScroll.scrollToMessage) {
          window.VirtualScroll.scrollToMessage(msgId);
        }

        const dateLabel = start.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (typeof showToast === 'function') showToast('Jumped to ' + dateLabel, 'success');
      } catch (err) {
        if (window.__DEBUG__) console.error('[JumpToDate] Error:', err);
        if (loading) loading.style.display = 'none';
        if (resultEl) {
          resultEl.style.display = 'block';
          resultEl.innerHTML = '<div style="text-align:center;color:var(--error,#f44336);font-size:13px;padding:12px 0;">Error: ' + (err.message || 'Unknown') + '</div>';
        }
      }
    },

    _close() {
      if (this._modal) {
        this._modal.remove();
        this._modal = null;
      }
    }
  };

  window.JumpToDate = JumpToDate;
})();
