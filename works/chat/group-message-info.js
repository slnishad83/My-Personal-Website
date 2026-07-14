/* =============================================
   GROUP MESSAGE INFO v1.0 — #28
   Per-member delivered + read status with avatars,
   timestamps, real-time updates via Firestore.
   ============================================= */
(function () {
  'use strict';

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
  }
  function getInitials(name) {
    return (name || '?').trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0,2) || '?';
  }
  function fmtTime(val) {
    if (!val) return null;
    let d;
    try { d = typeof val.toDate === 'function' ? val.toDate() : new Date(val); } catch(_) { return null; }
    if (isNaN(d.getTime())) return null;
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let h = d.getHours(); const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const mm = String(d.getMinutes()).padStart(2,'0');
    return d.getDate() + ' ' + mo[d.getMonth()] + ' ' + d.getFullYear() + ' - ' + h + ':' + mm + ' ' + ampm;
  }

  function buildRows(msgData, members) {
    const readBy      = msgData.readBy      || {};
    const deliveredTo = msgData.deliveredTo || {};
    const senderId    = msgData.senderId    || '';

    return members
      .filter(m => (m.userId || m.uid || '') !== senderId)
      .map(m => {
        const uid      = m.userId || m.uid || '';
        const name     = esc(m.displayName || m.name || 'Member');
        const avatar   = m.photoURL || m.avatar || '';
        const readTime = readBy[uid]      ? fmtTime(readBy[uid])      : null;
        const delTime  = deliveredTo[uid] ? fmtTime(deliveredTo[uid]) : null;
        const avatarHtml = avatar
          ? `<img src="${esc(avatar)}" alt="${name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : '';
        return `<div class="gmi-row" role="listitem">
  <div class="gmi-avatar" aria-hidden="true">${avatarHtml}<span class="gmi-initials"${avatarHtml ? ' style="display:none"' : ''}>${esc(getInitials(m.displayName||m.name))}</span></div>
  <div class="gmi-info">
    <div class="gmi-name">${window.sanitizeHTML(name)}</div>
    <div class="gmi-statuses">
      <span class="gmi-status gmi-delivered${delTime?'':' gmi-pending'}"><span class="gmi-check" aria-hidden="true">✓✓</span>${delTime?'Delivered: '+delTime:'Not yet delivered'}</span>
      <span class="gmi-status gmi-read${readTime?' gmi-seen':' gmi-pending'}"><span class="gmi-check" aria-hidden="true">✓✓</span>${readTime?'Read: '+readTime:'Not yet read'}</span>
    </div>
  </div>
</div>`;
      }).join('');
  }

  async function showGroupMessageInfo(messageId) {
    const db   = window.db;
    const chat = window.currentChat;
    if (!db || !chat) return;

    document.getElementById('groupMsgInfoModal')?.remove();
    if (window._gmiUnsub) { window._gmiUnsub(); window._gmiUnsub = null; }

    let msgSnap, membersSnap;
    try {
      [msgSnap, membersSnap] = await Promise.all([
        db.collection('messages').doc(messageId).get(),
        db.collection('groupMembers').where('groupId','==',chat.id).get()
          .catch(() => db.collection('groups').doc(chat.id).collection('members').get())
          .catch(() => ({ docs: [] }))
      ]);
    } catch(e) { console.warn('[GMI] fetch error', e); return; }

    if (!msgSnap.exists) return;
    const msgData = msgSnap.data();
    const members = membersSnap.docs.map(d => ({ userId: d.id, ...d.data() }));
    const rows    = buildRows(msgData, members);

    const modal = document.createElement('div');
    modal.id = 'groupMsgInfoModal';
    modal.className = 'modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-label','Message Info');
    modal.setAttribute('aria-modal','true');
    modal.style.display = 'flex';
    modal.innerHTML = `<div class="modal-content gmi-modal-content">
  <div class="gmi-header">
    <button class="gmi-close-btn" aria-label="Close" id="gmiCloseBtn">✕</button>
    <span class="gmi-title">Message Info</span>
  </div>
  <div class="gmi-body">
    <div class="gmi-section-label">RECIPIENTS (${members.filter(m=>(m.userId||m.uid||'')!==msgData.senderId).length})</div>
    <div class="gmi-list" role="list">${rows || '<div class="gmi-empty">No other members</div>'}</div>
  </div>
</div>`;
    document.body.appendChild(modal);

    modal.querySelector('#gmiCloseBtn').addEventListener('click', () => {
      modal.remove();
      if (window._gmiUnsub) { window._gmiUnsub(); window._gmiUnsub = null; }
    });

    // Real-time updates
    window._gmiUnsub = db.collection('messages').doc(messageId).onSnapshot(snap => {
      if (!snap.exists) return;
      const list = modal.querySelector('.gmi-list');
      if (list) list.innerHTML = buildRows(snap.data(), members) || '<div class="gmi-empty">No other members</div>';
    });
  }

  function patchForGroups() {
    const orig = window.showMessageInfo;
    if (typeof orig !== 'function') { setTimeout(patchForGroups, 500); return; }

    window.showMessageInfo = async function(messageId) {
      if ((window.currentChatType || '') === 'group') {
        await showGroupMessageInfo(messageId);
      } else {
        await orig.apply(this, arguments);
      }
    };
    window.showGroupMessageInfo = showGroupMessageInfo;
  }

  if (document.readyState === 'complete') setTimeout(patchForGroups, 0);
  else window.addEventListener('load', () => setTimeout(patchForGroups, 0));
})();
