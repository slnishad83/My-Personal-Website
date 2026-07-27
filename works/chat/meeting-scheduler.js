/**
 * Meeting Scheduler â€” Create meetings from chat with availability slots.
 * Attachment menu â†’ "Meeting" â†’ modal to pick date/time/title/duration.
 * Slots shared in chat; participants accept/decline; meetings tracked in Firestore.
 */
(function () {
  'use strict';

  function init() {
    window._openMeetingCreator = function () {
      if (!window.App || !window.App.currentChat) return;
      openMeetingModal();
    };

    injectMeetingAttachmentBtn();
    _initMeetingReminders();
  }

  function injectMeetingAttachmentBtn() {
    const run = () => {
      const attMenu = document.getElementById('attachment-menu') || document.getElementById('_att-menu');
      if (!attMenu || attMenu.querySelector('.meeting-attach-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'meeting-attach-btn flex flex-col items-center gap-2 p-4 bg-surface-container-highest rounded-2xl hover:bg-surface-variant transition-all';
      btn.onclick = () => {
        if (window._removeAttMenu) window._removeAttMenu();
        window._openMeetingCreator();
      };
      btn.innerHTML = `
        <div class="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <span class="material-symbols-outlined text-[22px] text-emerald-500">event</span>
        </div>
        <span class="text-[11px] font-bold text-on-surface-variant">Meeting</span>
      `;

      attMenu.appendChild(btn);
    };

    if (window.MutationBus) {
      window.MutationBus.onBodyChildList('meeting-attach-scan', run);
    }
    setTimeout(run, 1500);
  }

  function openMeetingModal() {
    const chatName = window.App.currentChat?.name || 'Chat';
    const membersHtml = buildMeetingMemberOptions();

    const now = new Date();
    const minDate = now.toISOString().slice(0, 10);
    const defaultTime = new Date(now.getTime() + 3600000).toTimeString().slice(0, 5);

    const modalHtml = `
      <div id="meeting-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;">
        <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 m-4 relative animate-scale-up max-h-[85vh] overflow-y-auto">
          <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('meeting-modal').remove()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div class="flex flex-col items-center mb-5">
            <div class="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[24px]">event</span>
            </div>
            <h3 class="font-bold text-lg text-on-surface">Schedule Meeting</h3>
            <p class="text-xs text-on-surface-variant text-center mt-1">For ${window.escHtml ? window.escHtml(chatName) : chatName}</p>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Meeting Title</label>
              <input type="text" id="meeting-title-input" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="e.g. Sprint Planning">
            </div>
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="block text-xs font-bold text-on-surface-variant mb-1">Date</label>
                <input type="date" id="meeting-date-input" min="${minDate}" value="${minDate}" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer">
              </div>
              <div class="flex-1">
                <label class="block text-xs font-bold text-on-surface-variant mb-1">Time</label>
                <input type="time" id="meeting-time-input" value="${defaultTime}" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer">
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Duration (minutes)</label>
              <div class="flex gap-2">
                ${[15, 30, 45, 60, 90].map(d => `
                  <button class="meeting-dur-btn flex-1 py-2 rounded-xl text-xs font-bold border border-outline-variant/30 transition-all ${d === 30 ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'}" data-dur="${d}" onclick="window._selectMeetingDur(${d})">${d}m</button>
                `).join('')}
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Invite Participants</label>
              <div class="bg-surface-container-high border border-outline-variant/30 rounded-xl p-3 max-h-32 overflow-y-auto space-y-1">
                <label class="flex items-center gap-2 text-sm text-on-surface cursor-pointer hover:bg-surface-variant/50 p-1 rounded-lg">
                  <input type="checkbox" class="meeting-member-cb accent-primary" checked> All members
                </label>
                ${membersHtml}
              </div>
            </div>
          </div>

          <button class="w-full mt-5 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition-all" onclick="window._submitMeeting()">
            Schedule Meeting
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    window._selectedMeetingDur = 30;
  }

  window._selectMeetingDur = function (d) {
    window._selectedMeetingDur = d;
    document.querySelectorAll('.meeting-dur-btn').forEach(btn => {
      const isActive = parseInt(btn.dataset.dur) === d;
      btn.className = `meeting-dur-btn flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${isActive ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant border-outline-variant/30'}`;
    });
  };

  function buildMeetingMemberOptions() {
    if (!window.App || !window.App.currentChat) return '';
    const chat = window.App.currentChat;
    const members = chat.memberIds || chat.members || [];
    const contacts = window.App.contacts || [];
    const uid = window.App.auth?.currentUser?.uid;

    return members.filter(m => m !== uid).map(mid => {
      const contact = contacts.find(c => c.uid === mid);
      const name = contact ? (contact.name || contact.displayName || mid.slice(0, 8)) : mid.slice(0, 8);
      return `<label class="flex items-center gap-2 text-sm text-on-surface cursor-pointer hover:bg-surface-variant/50 p-1 rounded-lg">
        <input type="checkbox" class="meeting-member-cb accent-primary" value="${mid}"> ${window.escHtml ? window.escHtml(name) : name}
      </label>`;
    }).join('');
  }

  window._submitMeeting = async function () {
    if (!window.App || !window.App.db || !window.App.auth.currentUser) return;
    const uid = window.App.auth.currentUser.uid;

    const titleEl = document.getElementById('meeting-title-input');
    const dateEl = document.getElementById('meeting-date-input');
    const timeEl = document.getElementById('meeting-time-input');

    const title = titleEl?.value.trim() || 'Meeting';
    const dateStr = dateEl?.value;
    const timeStr = timeEl?.value;
    if (!dateStr || !timeStr) {
      if (window.showToast) window.showToast('Please select date and time', 'error');
      return;
    }

    const dateTime = new Date(`${dateStr}T${timeStr}:00`);
    const duration = window._selectedMeetingDur || 30;

    const checkboxes = document.querySelectorAll('.meeting-member-cb');
    let participants = [];
    if (checkboxes[0]?.checked) {
      const chat = window.App.currentChat;
      participants = chat.memberIds || chat.members || [];
    } else {
      checkboxes.forEach(cb => {
        if (cb.checked && cb.value) participants.push(cb.value);
      });
    }

    try {
      const docRef = await window.App.db.collection('meetings').add({
        title: title,
        date: firebase.firestore.Timestamp.fromDate(dateTime),
        duration: duration,
        chatId: window.App.currentChat.id,
        chatName: window.App.currentChat.name || '',
        participants: participants,
        accepted: [uid],
        declined: [],
        createdBy: uid,
        createdByName: window.App.currentUser?.name || 'User',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      document.getElementById('meeting-modal')?.remove();

      const dateFormatted = dateTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeFormatted = dateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

      const meetingMsg = `ðŸ“… Meeting: ${title}\nðŸ“† ${dateFormatted} at ${timeFormatted} (${duration}m)\n\nâœ… Accept | âŒ Decline`;
      if (window.App.sendMessage) {
        await window.App.sendMessage({
          text: meetingMsg,
          type: 'meeting',
          meetingId: docRef.id
        });
      }

      if (window.showToast) window.showToast('Meeting scheduled!', 'success');

      // Set up reminder notifications
      _scheduleMeetingReminder(dateTime, title, duration);
    } catch (e) {
      if (window.__DEBUG__) console.error('Error scheduling meeting:', e);
      if (window.showToast) window.showToast('Failed to schedule meeting', 'error');
    }
  };

  function _scheduleMeetingReminder(dateTime, title, duration) {
    const now = Date.now();
    const meetingTime = dateTime.getTime();
    const reminder15m = meetingTime - 15 * 60 * 1000; // 15 min before
    const reminderStart = meetingTime; // at start time

    // 15-minute reminder
    if (reminder15m > now) {
      setTimeout(() => {
        if (typeof showToast === 'function') showToast(`â° Reminder: "${title}" starts in 15 minutes!`, 'success');
        _sendMeetingReminderNotification(title, 'starts in 15 minutes');
      }, reminder15m - now);
    }

    // Meeting start reminder
    if (reminderStart > now) {
      setTimeout(() => {
        if (typeof showToast === 'function') showToast(`ðŸ“… Meeting "${title}" is starting now!`, 'success');
        _sendMeetingReminderNotification(title, 'is starting now');
      }, reminderStart - now);
    }

    // End-of-meeting reminder
    const endTime = meetingTime + duration * 60 * 1000;
    if (endTime > now) {
      setTimeout(() => {
        if (typeof showToast === 'function') showToast(`ðŸ• Meeting "${title}" should be ending now`, 'info');
      }, endTime - now);
    }
  }

  function _sendMeetingReminderNotification(title, message) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('NSL Chat â€” Meeting', {
          body: `"${title}" ${message}`,
          icon: '/icon-192.png',
          tag: 'meeting-reminder',
        });
      }
    } catch (_) {}
  }

  // Check for upcoming meetings on page load and set reminders
  function _initMeetingReminders() {
    if (!window.App || !window.App.db || !window.App.auth?.currentUser) return;
    const uid = window.App.auth.currentUser.uid;

    window.App.db.collection('meetings')
      .where('participants', 'array-contains', uid)
      .where('date', '>=', firebase.firestore.Timestamp.fromDate(new Date()))
      .limit(10)
      .get()
      .then(snap => {
        snap.forEach(doc => {
          const m = doc.data();
          if (m.date && m.title) {
            const meetingDate = m.date.toDate ? m.date.toDate() : new Date(m.date);
            _scheduleMeetingReminder(meetingDate, m.title, m.duration || 30);
          }
        });
      })
      .catch(() => {});
  }

  window._acceptMeeting = async function (meetingId) {
    if (!window.App || !window.App.db) return;
    const uid = window.App.auth?.currentUser?.uid;
    if (!uid) return;
    try {
      await window.App.db.collection('meetings').doc(meetingId).update({
        accepted: firebase.firestore.FieldValue.arrayUnion(uid),
        declined: firebase.firestore.FieldValue.arrayRemove(uid)
      });
      if (window.showToast) window.showToast('Meeting accepted', 'success');
    } catch (e) {
      if (window.__DEBUG__) console.error('Accept meeting error:', e);
    }
  };

  window._declineMeeting = async function (meetingId) {
    if (!window.App || !window.App.db) return;
    const uid = window.App.auth?.currentUser?.uid;
    if (!uid) return;
    try {
      await window.App.db.collection('meetings').doc(meetingId).update({
        declined: firebase.firestore.FieldValue.arrayUnion(uid),
        accepted: firebase.firestore.FieldValue.arrayRemove(uid)
      });
      if (window.showToast) window.showToast('Meeting declined', 'success');
    } catch (e) {
      if (window.__DEBUG__) console.error('Decline meeting error:', e);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
