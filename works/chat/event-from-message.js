'use strict';
/**
 * EVENT CREATION FROM MESSAGE — Create calendar/meeting event from a message
 * Detects date/time in messages and adds a "Create event" button.
 */
(function () {
  const EventFromMessage = {
    _datePatterns: [
      /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?/gi,
      /\b(today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi,
      /\bat\s+(\d{1,2}:\d{2}\s*(?:am|pm)?)\b/gi
    ],

    detectDatesInMessage(text) {
      if (!text) return [];
      const dates = [];
      this._datePatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(match => {
            const parsed = this._parseDate(match);
            if (parsed && parsed.getTime() > Date.now()) {
              dates.push({ raw: match, date: parsed });
            }
          });
        }
      });
      return dates;
    },

    _parseDate(text) {
      const lower = text.toLowerCase().trim();
      const now = new Date();

      if (lower === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0);
      if (lower === 'tomorrow') {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(18, 0, 0, 0);
        return d;
      }

      const dayMatch = lower.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
      if (dayMatch) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const target = days.indexOf(dayMatch[1]);
        const d = new Date(now);
        const diff = (target - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        d.setHours(18, 0, 0, 0);
        return d;
      }

      try {
        const parsed = new Date(text);
        if (!isNaN(parsed.getTime()) && parsed > now) return parsed;
      } catch (_) {}

      return null;
    },

    async createEvent(chatId, chatName, eventData) {
      const uid = window.App?.uid?.() || window.currentUser?.uid;
      const db = window.App?.db;
      if (!uid || !db) return;

      const event = {
        title: eventData.title || 'Event from ' + (chatName || 'Chat'),
        description: eventData.description || '',
        startTime: eventData.date.getTime(),
        endTime: (eventData.date.getTime() + 60 * 60 * 1000),
        createdBy: uid,
        addedBy: uid,
        participants: eventData.participants || [uid],
        chatId,
        createdAt: Date.now()
      };

      try {
        await db.collection('calendarEvents').add(event);
        if (typeof showToast === 'function') showToast('Event created', 'success');
      } catch (e) {
        console.error('[EventFromMessage] Error:', e);
        if (typeof showToast === 'function') showToast('Failed to create event', 'error');
      }
    },

    showCreateEventDialog(chatId, chatName, msgText, detectedDate) {
      const modal = document.createElement('div');
      modal.id = 'create-event-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

      const dateStr = detectedDate ? detectedDate.toLocaleString() : '';
      modal.innerHTML = `
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(400px,92vw);padding:24px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <span class="material-symbols-outlined" style="font-size:24px;color:var(--primary,#00a884);">event</span>
            <h3 style="margin:0;font-size:16px;font-weight:700;">Create Event</h3>
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;font-weight:600;color:var(--on-surface-variant,#666);display:block;margin-bottom:4px;">Title</label>
            <input type="text" id="event-title" value="${this._esc(msgText?.slice(0, 50) || '')}" style="width:100%;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;background:var(--surface,#fff);color:var(--on-surface,#000);">
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;font-weight:600;color:var(--on-surface-variant,#666);display:block;margin-bottom:4px;">Date & Time</label>
            <input type="datetime-local" id="event-time" value="${detectedDate ? this._toLocalISOString(detectedDate) : ''}" style="width:100%;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;background:var(--surface,#fff);color:var(--on-surface,#000);">
          </div>
          <div style="display:flex;gap:8px;margin-top:16px;">
            <button id="event-cancel" style="flex:1;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;background:transparent;cursor:pointer;font-size:14px;">Cancel</button>
            <button id="event-create" style="flex:1;padding:10px;border:none;border-radius:10px;background:var(--primary,#00a884);color:var(--on-primary,#fff);cursor:pointer;font-size:14px;font-weight:600;">Create</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.querySelector('#event-cancel').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
      modal.querySelector('#event-create').addEventListener('click', () => {
        const title = modal.querySelector('#event-title').value.trim();
        const time = new Date(modal.querySelector('#event-time').value);
        if (!title) { if (typeof showToast === 'function') showToast('Enter event title', 'error'); return; }
        if (isNaN(time.getTime())) { if (typeof showToast === 'function') showToast('Pick a date/time', 'error'); return; }
        this.createEvent(chatId, chatName, { title, date: time, description: msgText || '' });
        modal.remove();
      });
    },

    _toLocalISOString(date) {
      const pad = n => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    },

    _esc(s) {
      return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
    },

    addOptionToContextMenu() {
      if (window.MutationBus) {
        window.MutationBus.onBodyChildList('event-msg-inject', () => {
          const menu = document.getElementById('_msg-ctx-menu');
          if (menu && !menu.querySelector('.event-msg-option')) {
            const btn = document.createElement('button');
            btn.className = 'event-msg-option';
            btn.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left;color:inherit;';
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">event</span> Create Event';
            btn.onmouseenter = () => btn.style.background = 'var(--surface-container-highest)';
            btn.onmouseleave = () => btn.style.background = 'transparent';
            btn.addEventListener('click', () => {
              const msgId = menu.dataset.msgId;
              const text = menu.dataset.msgText;
              const chat = window.App?.currentChat;
              if (text && chat) {
                const dates = this.detectDatesInMessage(text);
                this.showCreateEventDialog(chat.id, chat.name, text, dates[0]?.date || null);
              }
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

  window.EventFromMessage = EventFromMessage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => EventFromMessage.addOptionToContextMenu());
  } else {
    EventFromMessage.addOptionToContextMenu();
  }
})();
