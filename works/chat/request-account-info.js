/* ============================================================
   REQUEST ACCOUNT INFO — Data export (like WhatsApp's
   "Request Account Info" feature)
   Exports all user data as downloadable JSON
   ============================================================ */
'use strict';

(function() {
  async function requestAccountInfo() {
    const uid = (window.currentUser && window.currentUser.uid) ||
      (window.App && window.App.auth && window.App.auth.currentUser && window.App.auth.currentUser.uid);
    const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
    if (!uid || !db) {
      if (typeof showToast === 'function') showToast('Not authenticated', 'error');
      return;
    }

    if (typeof showToast === 'function') showToast('Preparing your data...', 'info');

    const exportData = {
      _meta: {
        exportDate: new Date().toISOString(),
        userId: uid,
        appName: 'NSL Chat',
        version: '5.1.0'
      },
      profile: {},
      chats: [],
      groups: [],
      messages: {},
      contacts: [],
      settings: {},
      media: [],
      blockedUsers: []
    };

    try {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        exportData.profile = { id: uid, ...userDoc.data() };
      }
    } catch (e) {}

    try {
      const chatsSnap = await db.collection('chats')
        .where('participants', 'array-contains', uid).limit(200).get();
      for (const chatDoc of chatsSnap.docs) {
        const chatData = chatDoc.data();
        exportData.chats.push({ id: chatDoc.id, ...chatData, participants: undefined });

        const msgsSnap = await db.collection('chats').doc(chatDoc.id)
          .collection('messages').orderBy('timestamp', 'desc').limit(1000).get();
        exportData.messages[chatDoc.id] = msgsSnap.docs.map(function(d) {
          return { id: d.id, ...d.data() };
        });
      }
    } catch (e) {}

    try {
      const groupsSnap = await db.collection('groups')
        .where('participants', 'array-contains', uid).limit(50).get();
      for (const groupDoc of groupsSnap.docs) {
        exportData.groups.push({ id: groupDoc.id, ...groupDoc.data(), participants: undefined });
      }
    } catch (e) {}

    try {
      const contactsSnap = await db.collection('userContacts').doc(uid).collection('contacts').get();
      contactsSnap.forEach(function(doc) {
        exportData.contacts.push({ id: doc.id, ...doc.data() });
      });
    } catch (e) {}

    try {
      const settingsDoc = await db.collection('userSettings').doc(uid).get();
      if (settingsDoc.exists) exportData.settings = settingsDoc.data();
    } catch (e) {}

    try {
      const blockedDoc = await db.collection('blockedUsers').doc(uid).get();
      if (blockedDoc.exists) exportData.blockedUsers = blockedDoc.data().blocked || [];
    } catch (e) {}

    try {
      const snaps = await db.collectionGroup('messages').where('senderId', '==', uid).limit(500).get();
      snaps.forEach(function(doc) {
        const d = doc.data();
        if (d.attachment && d.attachment.url) {
          exportData.media.push({ messageId: doc.id, url: d.attachment.url, type: d.attachment.type, timestamp: d.timestamp });
        }
      });
    } catch (e) {}

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nsl-chat-account-info-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { a.remove(); URL.revokeObjectURL(url); }, 1000);

    if (typeof showToast === 'function') showToast('Account info exported successfully', 'success');
  }

  function showRequestInfoPanel() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(380px,92vw);padding:24px;text-align:center;">
        <div style="width:48px;height:48px;border-radius:50%;background:var(--primary-container,#d9fdd3);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <span class="material-symbols-outlined" style="font-size:24px;color:var(--primary,#00a884);">download</span>
        </div>
        <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:var(--text,#111b21);">Request Account Info</h3>
        <p style="font-size:13px;color:var(--on-surface-variant,#667781);margin:0 0 20px;line-height:1.5;">
          Export all your data including profile, chats, groups, messages, and media references as a JSON file.
        </p>
        <div style="display:flex;gap:10px;">
          <button id="req-info-cancel" style="flex:1;padding:10px;border:1px solid var(--outline,#d1d7db);border-radius:10px;background:transparent;cursor:pointer;font-size:14px;color:var(--text,#111b21);">Cancel</button>
          <button id="req-info-export" style="flex:1;padding:10px;border:none;border-radius:10px;background:var(--primary,#00a884);color:white;font-size:14px;font-weight:600;cursor:pointer;">Export</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#req-info-cancel').addEventListener('click', function() { modal.remove(); });
    modal.querySelector('#req-info-export').addEventListener('click', function() { modal.remove(); requestAccountInfo(); });
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
  }

  window.RequestAccountInfo = { requestAccountInfo: requestAccountInfo, showPanel: showRequestInfoPanel };
})();
