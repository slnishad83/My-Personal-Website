/**
 * scheduled-calendar.js
 * Calendar view for all upcoming scheduled messages across all chats.
 * - Month grid calendar with dot indicators on days that have messages
 * - Click any day to see all messages scheduled for that day
 * - Per-message actions: Send Now, Edit time, Cancel
 * - Opens from the existing "Scheduled Messages" button as a new tab within the modal
 */
(function () {
  'use strict';

  /* ── helpers ────────────────────────────────────────────── */
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function toDate(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtTime(d) {
    if (!d) return '';
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
  }

  function fmtDate(d) {
    if (!d) return '';
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    return `${mo} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function dayKey(d) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function sameDay(a, b) { return dayKey(a) === dayKey(b); }

  function isOverdue(d) { return d && d < new Date(); }

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  /* ── state ──────────────────────────────────────────────── */
  let _messages   = [];      // all fetched scheduled message objects
  let _chatNames  = {};      // { chatId: name }
  let _viewYear   = new Date().getFullYear();
  let _viewMonth  = new Date().getMonth();
  let _selectedDay = null;   // Date | null
  let _loading    = false;

  /* ── fetch all scheduled messages for current user ──────── */
  async function fetchMessages() {
    const db = window.db || (window.firebase && window.firebase.firestore && window.firebase.firestore());
    const user = window.currentUser || window.auth?.currentUser;
    if (!db || !user) return [];

    let snap;
    try {
      snap = await db.collection('scheduledMessages')
        .where('userId', '==', user.uid)
        .where('status', '==', 'pending')
        .orderBy('dueAt', 'asc')
        .limit(500)
        .get();
    } catch (e) {
      // Fallback without orderBy (index may not exist)
      try {
        snap = await db.collection('scheduledMessages')
          .where('userId', '==', user.uid)
          .where('status', '==', 'pending')
          .get();
      } catch (e2) { return []; }
    }

    if (!snap || snap.empty) return [];

    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Resolve chat names in parallel
    await Promise.all(msgs.map(async m => {
      if (_chatNames[m.chatId]) return;
      try {
        if (m.chatType === 'group') {
          const gDoc = await db.collection('groups').doc(m.chatId).get().catch(() => null);
          _chatNames[m.chatId] = gDoc?.exists ? (gDoc.data()?.name || 'Group') : 'Group';
        } else if (m.otherUserId) {
          const uDoc = await db.collection('users').doc(m.otherUserId).get().catch(() => null);
          _chatNames[m.chatId] = uDoc?.exists
            ? (uDoc.data()?.displayName || uDoc.data()?.email || 'Direct message')
            : 'Direct message';
        } else {
          _chatNames[m.chatId] = 'Direct message';
        }
      } catch (_) { _chatNames[m.chatId] = 'Chat'; }
    }));

    return msgs;
  }

  /* ── build calendar grid HTML ───────────────────────────── */
  function buildCalendar(messages) {
    const year  = _viewYear;
    const month = _viewMonth;
    const today = new Date();

    // Map dayKey → messages[]
    const byDay = {};
    messages.forEach(m => {
      const d = toDate(m.dueAt);
      if (!d) return;
      const k = dayKey(d);
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push(m);
    });

    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = `
      <div class="sc-cal-nav">
        <button class="sc-nav-btn" id="scPrevMonth" aria-label="Previous month">&#8249;</button>
        <span class="sc-cal-title">${MONTHS[month]} ${year}</span>
        <button class="sc-nav-btn" id="scNextMonth" aria-label="Next month">&#8250;</button>
      </div>
      <div class="sc-cal-grid">
        ${DAYS.map(d => `<div class="sc-cal-dow">${d}</div>`).join('')}
    `;

    // Leading blanks
    for (let i = 0; i < firstDay; i++) html += `<div class="sc-cal-cell sc-empty"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const k = dayKey(date);
      const dayMsgs = byDay[k] || [];
      const isToday = sameDay(date, today);
      const isSelected = _selectedDay && sameDay(date, _selectedDay);
      const hasMsgs = dayMsgs.length > 0;
      const hasOverdue = dayMsgs.some(m => isOverdue(toDate(m.dueAt)));

      const classes = [
        'sc-cal-cell',
        isToday    ? 'sc-today'    : '',
        isSelected ? 'sc-selected' : '',
        hasMsgs    ? 'sc-has-msgs' : '',
        hasOverdue ? 'sc-overdue'  : '',
      ].filter(Boolean).join(' ');

      html += `<div class="${classes}" data-date="${date.toISOString()}" role="button" tabindex="0" aria-label="${fmtDate(date)}${hasMsgs ? `, ${dayMsgs.length} message${dayMsgs.length>1?'s':''}`:''}" aria-pressed="${isSelected}">
        <span class="sc-day-num">${day}</span>
        ${hasMsgs ? `<span class="sc-dot-row">${dayMsgs.slice(0,4).map(()=>'<span class="sc-dot"></span>').join('')}${dayMsgs.length>4?`<span class="sc-dot sc-dot-more">+</span>`:''}</span>` : ''}
      </div>`;
    }

    html += `</div>`;
    return html;
  }

  /* ── build day detail panel HTML ────────────────────────── */
  function buildDayDetail(date, messages) {
    if (!date) {
      return `<div class="sc-day-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <p>Select a day to see scheduled messages</p>
      </div>`;
    }

    const dayMsgs = messages.filter(m => {
      const d = toDate(m.dueAt);
      return d && sameDay(d, date);
    });

    if (!dayMsgs.length) {
      return `<div class="sc-day-date-header">${fmtDate(date)}</div>
        <div class="sc-day-empty"><p>No messages scheduled for this day</p></div>`;
    }

    dayMsgs.sort((a,b) => {
      const da = toDate(a.dueAt), db2 = toDate(b.dueAt);
      return (da||0) - (db2||0);
    });

    let html = `<div class="sc-day-date-header">${fmtDate(date)} <span class="sc-day-count">${dayMsgs.length} message${dayMsgs.length>1?'s':''}</span></div>`;
    html += `<div class="sc-msg-list">`;

    dayMsgs.forEach(m => {
      const d = toDate(m.dueAt);
      const overdue = isOverdue(d);
      html += `<div class="sc-msg-card ${overdue?'sc-msg-overdue':''}" data-msg-id="${esc(m.id)}">
        <div class="sc-msg-header">
          <span class="sc-msg-chat">${esc(_chatNames[m.chatId] || 'Chat')}</span>
          <span class="sc-msg-time ${overdue?'sc-overdue-label':''}">${esc(fmtTime(d))}${overdue?' · Overdue':''}</span>
        </div>
        <div class="sc-msg-text">${esc((m.text||'').slice(0,200) || (m.attachment ? '📎 Attachment' : ''))}</div>
        <div class="sc-msg-actions">
          <button class="sc-action-btn sc-send-now" data-id="${esc(m.id)}" title="Send this message now">Send Now</button>
          <button class="sc-action-btn sc-edit-time" data-id="${esc(m.id)}" data-due="${d ? d.toISOString() : ''}" title="Change scheduled time">Edit Time</button>
          <button class="sc-action-btn sc-cancel-msg" data-id="${esc(m.id)}" title="Cancel this scheduled message">Cancel</button>
        </div>
      </div>`;
    });

    html += `</div>`;
    return html;
  }

  /* ── edit time inline ───────────────────────────────────── */
  function buildEditTimeForm(msgId, currentDue) {
    const d = currentDue ? new Date(currentDue) : new Date(Date.now() + 3600000);
    const pad = n => String(n).padStart(2,'0');
    const dtVal = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `<div class="sc-edit-form" data-for="${esc(msgId)}">
      <input type="datetime-local" class="sc-dt-input" value="${dtVal}" min="${new Date().toISOString().slice(0,16)}" />
      <button class="sc-action-btn sc-save-time" data-id="${esc(msgId)}">Save</button>
      <button class="sc-action-btn sc-cancel-edit" data-id="${esc(msgId)}">Cancel</button>
    </div>`;
  }

  /* ── render the full modal content ─────────────────────── */
  function render(container) {
    const calHtml = buildCalendar(_messages);
    const detailHtml = buildDayDetail(_selectedDay, _messages);

    container.innerHTML = `
      <div class="sc-layout">
        <div class="sc-left">
          <div class="sc-cal-wrap">${calHtml}</div>
          <div class="sc-legend">
            <span class="sc-legend-item"><span class="sc-dot"></span> Scheduled</span>
            <span class="sc-legend-item sc-overdue"><span class="sc-dot"></span> Overdue</span>
            <span class="sc-legend-item"><span class="sc-today-dot"></span> Today</span>
          </div>
          <div class="sc-total-count">${_messages.length} pending message${_messages.length!==1?'s':''}</div>
        </div>
        <div class="sc-right" id="scDayDetail">${detailHtml}</div>
      </div>`;

    bindEvents(container);
  }

  /* ── event binding ──────────────────────────────────────── */
  function bindEvents(container) {
    // Month navigation
    container.querySelector('#scPrevMonth')?.addEventListener('click', () => {
      _viewMonth--;
      if (_viewMonth < 0) { _viewMonth = 11; _viewYear--; }
      render(container);
    });
    container.querySelector('#scNextMonth')?.addEventListener('click', () => {
      _viewMonth++;
      if (_viewMonth > 11) { _viewMonth = 0; _viewYear++; }
      render(container);
    });

    // Day cell click
    container.querySelectorAll('.sc-cal-cell:not(.sc-empty)').forEach(cell => {
      const activate = () => {
        const iso = cell.dataset.date;
        if (!iso) return;
        _selectedDay = new Date(iso);
        render(container);
      };
      cell.addEventListener('click', activate);
      cell.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
    });

    // Send Now
    container.querySelectorAll('.sc-send-now').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const msg = _messages.find(m => m.id === id);
        if (!msg) return;
        btn.disabled = true; btn.textContent = 'Sending…';
        try {
          if (typeof window.sendScheduledMessage === 'function') {
            await window.sendScheduledMessage({ id, data: msg });
          } else {
            // Direct Firestore send fallback
            const db = window.db || window.firebase?.firestore?.();
            if (db) await db.collection('scheduledMessages').doc(id).update({ status: 'sent', sentAt: window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date() });
          }
          showCalToast('Message sent!');
          await refresh(container);
        } catch (e) {
          btn.disabled = false; btn.textContent = 'Send Now';
          showCalToast('Failed to send', true);
        }
      });
    });

    // Edit Time — show inline form
    container.querySelectorAll('.sc-edit-time').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const card = btn.closest('.sc-msg-card');
        if (!card) return;
        const existing = card.querySelector('.sc-edit-form');
        if (existing) { existing.remove(); return; }
        const actions = card.querySelector('.sc-msg-actions');
        const form = document.createElement('div');
        form.innerHTML = buildEditTimeForm(id, btn.dataset.due);
        actions.after(form.firstElementChild);
        // bind save/cancel on the new form
        card.querySelector('.sc-save-time')?.addEventListener('click', async () => {
          const input = card.querySelector('.sc-dt-input');
          const newDate = input ? new Date(input.value) : null;
          if (!newDate || isNaN(newDate.getTime()) || newDate <= new Date()) {
            showCalToast('Pick a future date and time', true); return;
          }
          try {
            const db = window.db || window.firebase?.firestore?.();
            if (db) await db.collection('scheduledMessages').doc(id).update({ dueAt: newDate });
            showCalToast('Time updated');
            await refresh(container);
          } catch (e) { showCalToast('Update failed', true); }
        });
        card.querySelector('.sc-cancel-edit')?.addEventListener('click', () => {
          card.querySelector('.sc-edit-form')?.remove();
        });
      });
    });

    // Cancel message
    container.querySelectorAll('.sc-cancel-msg').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Cancel this scheduled message?')) return;
        btn.disabled = true;
        try {
          const db = window.db || window.firebase?.firestore?.();
          if (db) await db.collection('scheduledMessages').doc(btn.dataset.id).update({
            status: 'cancelled',
            cancelledAt: window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date(),
          });
          showCalToast('Message cancelled');
          await refresh(container);
        } catch (e) { btn.disabled = false; showCalToast('Failed to cancel', true); }
      });
    });
  }

  /* ── toast ──────────────────────────────────────────────── */
  function showCalToast(msg, isError = false) {
    if (typeof window.showToast === 'function') { window.showToast(msg, isError ? 'error' : undefined); return; }
    const t = document.createElement('div');
    t.className = 'sc-toast' + (isError ? ' sc-toast-error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  /* ── refresh data + re-render ───────────────────────────── */
  async function refresh(container) {
    _messages = await fetchMessages();
    render(container);
  }

  /* ── inject Calendar tab into the Scheduled Messages modal ─ */
  function injectCalendarTab() {
    const modal = document.getElementById('scheduledMessagesModal');
    if (!modal || modal.dataset.calendarInjected) return;
    modal.dataset.calendarInjected = '1';

    const header = modal.querySelector('.modal-header');
    const body   = modal.querySelector('.modal-body');
    if (!header || !body) return;

    // Build tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'sc-tab-bar';
    tabBar.innerHTML = `
      <button class="sc-tab sc-tab-active" data-tab="list" type="button">List View</button>
      <button class="sc-tab" data-tab="calendar" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="margin-right:4px;vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        Calendar View
      </button>`;
    header.after(tabBar);

    // Build calendar container (hidden initially)
    const calContainer = document.createElement('div');
    calContainer.id = 'scheduledCalendarView';
    calContainer.style.display = 'none';
    calContainer.innerHTML = `<div class="sc-loading">Loading calendar…</div>`;
    body.appendChild(calContainer);

    // Tab switching
    tabBar.querySelectorAll('.sc-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        tabBar.querySelectorAll('.sc-tab').forEach(t => t.classList.remove('sc-tab-active'));
        tab.classList.add('sc-tab-active');

        const listEl = document.getElementById('scheduledMessagesList');
        if (tab.dataset.tab === 'calendar') {
          if (listEl) listEl.style.display = 'none';
          calContainer.style.display = 'block';
          if (!_loading && !calContainer.dataset.loaded) {
            _loading = true;
            calContainer.innerHTML = `<div class="sc-loading">
              <div class="sc-spinner"></div> Loading messages…
            </div>`;
            _messages = await fetchMessages();
            _loading = false;
            calContainer.dataset.loaded = '1';
            render(calContainer);
          }
        } else {
          calContainer.style.display = 'none';
          if (listEl) listEl.style.display = '';
        }
      });
    });
  }

  /* ── watch for the modal to open ────────────────────────── */
  function watchModal() {
    const modal = document.getElementById('scheduledMessagesModal');
    if (!modal) { setTimeout(watchModal, 800); return; }

    injectCalendarTab();

    new MutationObserver(() => {
      if (modal.style.display !== 'none') {
        injectCalendarTab();
        // Reset calendar loaded state so it refreshes on next open
        const calView = document.getElementById('scheduledCalendarView');
        if (calView) {
          delete calView.dataset.loaded;
          _selectedDay = null;
          _messages = [];
        }
      }
    }).observe(modal, { attributes: true, attributeFilter: ['style'] });
  }

  /* ── init ───────────────────────────────────────────────── */
  function init() {
    watchModal();
    // Expose for external refresh
    window.scheduledCalendar = {
      refresh: () => {
        const c = document.getElementById('scheduledCalendarView');
        if (c && c.style.display !== 'none') refresh(c);
      }
    };
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 900);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(init, 900));
  }
})();
