'use strict';
/**
 * MESSAGE REMINDERS — Set a reminder from any message context menu
 * Stores reminder in Firestore and shows notification at the scheduled time.
 */
(function () {
  const MessageReminders = {
    _timers: {},

    async setReminder(msgId, msgText, timeMs) {
      const uid = window.App?.uid?.() || window.currentUser?.uid;
      const db = window.App?.db;
      if (!uid || !db) return;

      const reminder = {
        userId: uid,
        msgId,
        text: msgText ? msgText.slice(0, 200) : '',
        reminderTime: timeMs,
        createdAt: Date.now(),
        chatId: window.App?.currentChat?.id || '',
        chatName: window.App?.currentChat?.name || '',
        status: 'pending'
      };

      try {
        await db.collection('reminders').add(reminder);
        this._scheduleLocal(reminder);
        if (typeof showToast === 'function') showToast('Reminder set', 'success');
      } catch (e) {
        if (window.__DEBUG__) console.error('[MessageReminders] Error:', e);
        if (typeof showToast === 'function') showToast('Failed to set reminder', 'error');
      }
    },

    _scheduleLocal(reminder) {
      const delay = reminder.reminderTime - Date.now();
      if (delay <= 0) return;

      this._timers[reminder.msgId] = setTimeout(() => {
        this._showNotification(reminder);
        delete this._timers[reminder.msgId];
      }, Math.min(delay, 2147483647));
    },

    _showNotification(reminder) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('NSL Chat Reminder', {
          body: reminder.text || 'You have a reminder',
          icon: 'app-icon-192.png',
          tag: 'reminder_' + reminder.msgId
        });
      }

      if (typeof showToast === 'function') {
        showToast('⏰ Reminder: ' + (reminder.text || 'Check your reminder'), 'info');
      }

      if (reminder.chatId && typeof window.selectChat === 'function') {
        const banner = document.createElement('div');
        banner.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999;padding:12px 24px;border-radius:12px;background:var(--primary,#00a884);color:var(--on-primary,#fff);font-size:14px;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.3);max-width:90vw;text-align:center;';
        banner.textContent = '⏰ Reminder: ' + (reminder.text || 'Tap to view');
        banner.addEventListener('click', () => {
          window.selectChat(reminder.chatId);
          banner.remove();
        });
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 10000);
      }
    },

    openSetReminder(msgId, msgText) {
      const options = [
        { label: 'In 30 minutes', value: 30 * 60 * 1000 },
        { label: 'In 1 hour', value: 60 * 60 * 1000 },
        { label: 'In 3 hours', value: 3 * 60 * 60 * 1000 },
        { label: 'Tomorrow 8:00 AM', value: this._nextMorning() },
        { label: 'In 3 days', value: 3 * 24 * 60 * 60 * 1000 },
        { label: 'Custom...', value: -1 }
      ];

      const modal = document.createElement('div');
      modal.id = 'set-reminder-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

      modal.innerHTML = `
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(350px,92vw);padding:24px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <span class="material-symbols-outlined" style="font-size:24px;color:var(--primary,#00a884);">alarm</span>
            <h3 style="margin:0;font-size:16px;font-weight:700;">Set Reminder</h3>
          </div>
          <p style="font-size:13px;color:var(--on-surface-variant,#666);margin:0 0 16px;">${msgText ? this._esc(msgText.slice(0, 80)) + (msgText.length > 80 ? '...' : '') : ''}</p>
          <div style="space-y-8px;">
            ${options.map(o => `
              <button class="reminder-option" data-value="${o.value}" style="width:100%;text-align:left;padding:12px;border:1px solid var(--outline-variant,#eee);border-radius:10px;background:transparent;cursor:pointer;font-size:14px;color:var(--on-surface,#000);margin-bottom:8px;transition:background 0.15s;">
                ${o.label}
              </button>
            `).join('')}
          </div>
          <div id="custom-time-picker" style="display:none;margin-top:12px;">
            <input type="datetime-local" id="custom-reminder-time" style="width:100%;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;">
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const customPicker = modal.querySelector('#custom-time-picker');
      const customInput = modal.querySelector('#custom-reminder-time');

      modal.querySelectorAll('.reminder-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = parseInt(btn.dataset.value);
          if (val === -1) {
            customPicker.style.display = 'block';
            customInput.focus();
            return;
          }
          const reminderTime = Date.now() + val;
          this.setReminder(msgId, msgText, reminderTime);
          modal.remove();
        });
        btn.addEventListener('mouseenter', () => btn.style.background = 'var(--surface-variant,#f0f2f5)');
        btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
      });

      if (customInput) {
        customInput.addEventListener('change', () => {
          const time = new Date(customInput.value).getTime();
          if (time > Date.now()) {
            this.setReminder(msgId, msgText, time);
            modal.remove();
          } else {
            if (typeof showToast === 'function') showToast('Pick a future time', 'error');
          }
        });
      }

      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },

    _nextMorning() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);
      return tomorrow.getTime() - now.getTime();
    },

    async _rescheduleFromFirestore() {
      const uid = window.App?.uid?.() || window.currentUser?.uid;
      const db = window.App?.db;
      if (!uid || !db) return;
      try {
        const snap = await db.collection('reminders')
          .where('userId', '==', uid)
          .where('status', '==', 'pending')
          .where('reminderTime', '>', Date.now())
          .limit(50)
          .get();
        snap.forEach(doc => {
          const reminder = { ...doc.data(), _docId: doc.id };
          this._scheduleLocal(reminder);
        });
      } catch (e) {
        if (window.__DEBUG__) console.warn('[MessageReminders] reschedule error:', e);
      }
    },

    _esc(s) {
      return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    },

    addToContextMenu() {
      if (window.MutationBus) {
        window.MutationBus.onBodyChildList('reminder-msg-inject', () => {
          const menu = document.getElementById('_msg-ctx-menu');
          if (menu && !menu.querySelector('.reminder-msg-option')) {
            const btn = document.createElement('button');
            btn.className = 'reminder-msg-option';
            btn.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left;color:inherit;';
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">alarm</span> Set Reminder';
            btn.onmouseenter = () => btn.style.background = 'var(--surface-container-highest)';
            btn.onmouseleave = () => btn.style.background = 'transparent';
            btn.addEventListener('click', () => {
              const msgId = menu.dataset.msgId;
              const text = menu.dataset.msgText;
              if (msgId) this.openSetReminder(msgId, text);
              if (window._removeCtxMenu) window._removeCtxMenu();
            });
            const lastBtn = menu.querySelector('button:last-child');
            if (lastBtn) menu.insertBefore(btn, lastBtn);
            else menu.appendChild(btn);
          }
        });
      }
    }
  };

  window.MessageReminders = MessageReminders;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      MessageReminders.addToContextMenu();
      MessageReminders._rescheduleFromFirestore();
    });
  } else {
    MessageReminders.addToContextMenu();
    MessageReminders._rescheduleFromFirestore();
  }
})();
