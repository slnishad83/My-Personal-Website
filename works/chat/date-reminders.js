// Anniversary / Birthday Reminders — special date reminders for contacts
(function() {
  'use strict';

  const DATES_KEY = 'nsl_contact_dates';
  const REMINDER_CHECK_KEY = 'nsl_reminder_last_check';

  function _getContactDates() {
    try { return JSON.parse(localStorage.getItem(DATES_KEY) || '{}'); } catch(_) { return {}; }
  }

  function _saveContactDates(dates) {
    localStorage.setItem(DATES_KEY, JSON.stringify(dates));
    try {
      if (App.db && App.auth?.currentUser) {
        App.db.collection('users').doc(App.auth.currentUser.uid).update({ contactDates: dates }).catch(() => {});
      }
    } catch(_) {}
  }

  window.setContactDate = function(uid, type, dateStr) {
    const dates = _getContactDates();
    if (!dates[uid]) dates[uid] = {};
    dates[uid][type] = dateStr;
    _saveContactDates(dates);
    showToast(`${type === 'birthday' ? '🎂 Birthday' : '💕 Anniversary'} saved`, 'success');
  };

  window.removeContactDate = function(uid, type) {
    const dates = _getContactDates();
    if (dates[uid]) { delete dates[uid][type]; if (!Object.keys(dates[uid]).length) delete dates[uid]; }
    _saveContactDates(dates);
    showToast('Date removed', 'info');
  };

  function _getUpcomingReminders() {
    const dates = _getContactDates();
    const now = new Date();
    const _currentMonth = now.getMonth();
    const _currentDate = now.getDate();
    const upcoming = [];

    Object.entries(dates).forEach(([uid, d]) => {
      const contact = (App.contacts || []).find(c => c.uid === uid);
      if (!contact) return;

      if (d.birthday) {
        const bd = _parseDate(d.birthday);
        if (bd) {
          const bdMonth = bd.getMonth();
          const bdDate = bd.getDate();
          const daysUntil = _daysUntilBirthday(bdMonth, bdDate);
          if (daysUntil <= 30) {
            upcoming.push({
              uid, name: contact.name, type: 'birthday',
              date: d.birthday, daysUntil, emoji: '🎂',
              message: daysUntil === 0 ? `${contact.name}'s birthday is TODAY!` :
                       daysUntil === 1 ? `Tomorrow is ${contact.name}'s birthday!` :
                       `${contact.name}'s birthday is in ${daysUntil} days`
            });
          }
        }
      }

      if (d.anniversary) {
        const ad = _parseDate(d.anniversary);
        if (ad) {
          const adMonth = ad.getMonth();
          const adDate = ad.getDate();
          const daysUntil = _daysUntilAnniversary(adMonth, adDate);
          if (daysUntil <= 30) {
            upcoming.push({
              uid, name: contact.name, type: 'anniversary',
              date: d.anniversary, daysUntil, emoji: '💕',
              message: daysUntil === 0 ? `${contact.name}'s anniversary is TODAY!` :
                       daysUntil === 1 ? `Tomorrow is ${contact.name}'s anniversary!` :
                       `${contact.name}'s anniversary is in ${daysUntil} days`
            });
          }
        }
      }
    });

    return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  }

  function _daysUntilBirthday(month, day) {
    const now = new Date();
    const thisYear = new Date(now.getFullYear(), month, day);
    if (thisYear < now) thisYear.setFullYear(now.getFullYear() + 1);
    return Math.ceil((thisYear - now) / (1000 * 60 * 60 * 24));
  }

  function _daysUntilAnniversary(month, day) {
    return _daysUntilBirthday(month, day);
  }

  function _parseDate(str) {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const parts2 = str.split('/');
    if (parts2.length === 3) return new Date(parseInt(parts2[2]), parseInt(parts2[0]) - 1, parseInt(parts2[1]));
    return null;
  }

  function _checkReminders() {
    const lastCheck = localStorage.getItem(REMINDER_CHECK_KEY);
    const today = new Date().toDateString();
    if (lastCheck === today) return;
    localStorage.setItem(REMINDER_CHECK_KEY, today);

    const upcoming = _getUpcomingReminders();
    const todayReminders = upcoming.filter(r => r.daysUntil === 0);
    const tomorrowReminders = upcoming.filter(r => r.daysUntil === 1);

    todayReminders.forEach(r => {
      showToast(`${r.emoji} ${r.message}`, 'success');
      if (App.db && App.auth?.currentUser) {
        App.db.collection('reminders').add({
          userId: App.auth.currentUser.uid,
          targetUserId: r.uid,
          type: r.type,
          date: r.date,
          message: r.message,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          read: false,
        }).catch(() => {});
      }
    });

    tomorrowReminders.forEach(r => {
      showToast(`${r.emoji} ${r.message}`, 'info');
    });
  }

  window.openDateReminders = function() {
    const dates = _getContactDates();
    const upcoming = _getUpcomingReminders();

    const overlay = document.createElement('div');
    overlay.id = 'date-reminders-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:420px;width:92vw;max-height:80vh;overflow-y:auto;color:var(--on-surface)';

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:18px;font-weight:700">🎂 Date Reminders</h3>
        <button onclick="document.getElementById('date-reminders-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>`;

    if (upcoming.length) {
      html += `<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:700;color:var(--on-surface-variant);margin-bottom:8px">UPCOMING</div>`;
      upcoming.forEach(r => {
        const _urgencyColor = r.daysUntil === 0 ? '#00E676' : r.daysUntil <= 3 ? '#FF9800' : 'var(--primary)';
        html += `<div style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;background:var(--surface-container-low,rgba(0,0,0,0.04));margin-bottom:6px">
          <span style="font-size:24px">${r.emoji}</span>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600">${escHtml(r.name)}</div>
            <div style="font-size:11px;color:var(--on-surface-variant)">${r.type === 'birthday' ? '🎂 Birthday' : '💕 Anniversary'} — ${r.daysUntil === 0 ? 'TODAY!' : r.daysUntil === 1 ? 'Tomorrow' : r.daysUntil + ' days'}</div>
          </div>
          ${r.daysUntil === 0 ? `<button onclick="document.getElementById('date-reminders-overlay')?.remove();openChat('${r.uid}')" style="padding:6px 12px;border-radius:8px;border:none;background:var(--primary);color:var(--on-primary);font-size:11px;font-weight:600;cursor:pointer">Message</button>` : ''}
        </div>`;
      });
      html += '</div>';
    } else {
      html += '<p style="text-align:center;color:var(--on-surface-variant);font-size:13px;padding:8px 0">No upcoming reminders. Add dates to your contacts!</p>';
    }

    html += `<div style="font-size:12px;font-weight:700;color:var(--on-surface-variant);margin-bottom:8px">ALL CONTACTS</div>`;

    (App.contacts || []).slice(0, 30).forEach(c => {
      const d = dates[c.uid] || {};
      const hasDate = d.birthday || d.anniversary;
      html += `<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:var(--surface-container-low,rgba(0,0,0,0.03));margin-bottom:4px">
        <div style="width:32px;height:32px;border-radius:50%;overflow:hidden;flex-shrink:0">
          ${c.photoURL ? `<img src="${(c.photoURL || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" style="width:100%;height:100%;object-fit:cover">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--outline-variant,rgba(0,0,0,0.1));font-size:12px;font-weight:700">${c.initials || '?'}</div>`}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.name)}</div>
          <div style="font-size:11px;color:var(--on-surface-variant)">${d.birthday ? '🎂 ' + d.birthday : ''}${d.birthday && d.anniversary ? ' · ' : ''}${d.anniversary ? '💕 ' + d.anniversary : ''}${!hasDate ? 'No dates set' : ''}</div>
        </div>
        <button onclick="_editContactDate('${c.uid}','${escHtml(c.name)}')" style="padding:4px 10px;border-radius:6px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant);font-size:11px;font-weight:600;cursor:pointer">${hasDate ? 'Edit' : 'Add'}</button>
      </div>`;
    });

    panel.innerHTML = html;
    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  window._editContactDate = function(uid, name) {
    const dates = _getContactDates();
    const d = dates[uid] || {};

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:360px;width:90vw;color:var(--on-surface)';

    panel.innerHTML = `
      <h3 style="margin:0 0 16px;font-size:16px;font-weight:700">📅 ${escHtml(name)}</h3>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">🎂 Birthday</label>
        <input type="date" id="edit-birthday" value="${d.birthday || ''}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:13px">
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">💕 Anniversary</label>
        <input type="date" id="edit-anniversary" value="${d.anniversary || ''}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:13px">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="this.closest('[style*="fixed"]')?.remove()" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface);font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
        <button onclick="_saveContactDateEdit('${uid}')" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:600;cursor:pointer">Save</button>
      </div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  window._saveContactDateEdit = function(uid) {
    const bd = document.getElementById('edit-birthday')?.value;
    const ad = document.getElementById('edit-anniversary')?.value;
    if (bd) setContactDate(uid, 'birthday', bd);
    else removeContactDate(uid, 'birthday');
    if (ad) setContactDate(uid, 'anniversary', ad);
    else removeContactDate(uid, 'anniversary');
    document.querySelectorAll('[style*="fixed"]').forEach(el => {
      if (el.querySelector('#edit-birthday')) el.remove();
    });
    document.getElementById('date-reminders-overlay')?.remove();
    openDateReminders();
  };

  const _reminderTimer = setInterval(_checkReminders, 3600000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _checkReminders);
  } else {
    setTimeout(_checkReminders, 5000);
  }

  window._dateRemindersCleanup = function() {
    clearInterval(_reminderTimer);
  };
})();
