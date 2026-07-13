/* =============================================
   NOTIFICATION REPLY v1.0
   - Stores Firebase ID token in IndexedDB so
     the service worker can send replies when
     the app tab is closed
   - Listens for SW relay messages and auto-sends
     when the app IS open
   ============================================= */
(function () {
  'use strict';

  const IDB_NAME    = 'tcAuthStore';
  const IDB_VERSION = 1;
  const STORE_NAME  = 'tokens';

  /* ── IndexedDB helpers ────────────────────────────────────────────── */
  let _idbConn = null;

  function openIdb() {
    if (_idbConn) return Promise.resolve(_idbConn);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = e => { _idbConn = e.target.result; resolve(_idbConn); };
      req.onerror   = () => reject(req.error);
    });
  }

  async function idbPut(key, value) {
    try {
      const db = await openIdb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ key, token: value, savedAt: Date.now() });
    } catch (e) { /* non-critical */ }
  }

  /* ── Store ID token whenever it changes ──────────────────────────── */
  function startTokenRefresh() {
    if (!window.firebase?.auth) { setTimeout(startTokenRefresh, 600); return; }

    firebase.auth().onAuthStateChanged(async user => {
      if (!user) { await idbPut('idToken', null).catch(() => {}); return; }

      // Store immediately
      try {
        const token = await user.getIdToken();
        await idbPut('idToken', token);
      } catch (_) {}

      // Refresh every 50 minutes (tokens expire after 60 min)
      const refreshTimer = setInterval(async () => {
        if (!firebase.auth().currentUser) { clearInterval(refreshTimer); return; }
        try {
          const token = await firebase.auth().currentUser.getIdToken(true);
          await idbPut('idToken', token);
        } catch (_) {}
      }, 50 * 60 * 1000);
    });
  }

  /* ── Listen for relay message from service worker ────────────────── */
  function listenForSwRelay() {
    if (!navigator.serviceWorker) return;

    navigator.serviceWorker.addEventListener('message', async event => {
      const msg = event.data || {};
      if (msg.type !== 'TC_NOTIF_REPLY') return;

      const { chatId, chatType, chatUserId, groupId, replyText } = msg;
      if (!replyText?.trim()) return;

      await autoSendReply({ chatId, chatType, chatUserId, groupId, replyText });
    });
  }

  /* ── Auto-send the reply through the existing app send path ─────── */
  async function autoSendReply({ chatId, chatType, chatUserId, groupId, replyText }) {
    const user = window.currentUser;
    const db   = window.db;
    if (!user || !db) return;

    const text = replyText.trim();
    if (!text) return;

    try {
      // Build message identical to how app-core.js sends direct messages
      const msgData = {
        text,
        senderId: user.uid,
        senderName: user.displayName || '',
        senderAvatar: user.photoURL || '',
        senderEmail: user.email || '',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
        readBy:      { [user.uid]: firebase.firestore.FieldValue.serverTimestamp() },
        deliveredTo: {},
        sentViaNotification: true
      };

      if (chatType === 'group' && groupId) {
        msgData.groupId = groupId;
      } else {
        msgData.directId   = chatId;
        msgData.receiverId = chatUserId;
        msgData.participants = [user.uid, chatUserId].filter(Boolean);
        msgData.participantEmails = [user.email || '', ''];
      }

      await db.collection('messages').add(msgData);

      if (chatType === 'group' && groupId) {
        db.collection('groups').doc(groupId).update({
          lastMessage: text,
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          lastMessageSenderId: user.uid,
          lastMessageSenderName: user.displayName || user.email || 'Me'
        }).catch(() => {});
      } else {
        db.collection('chats').doc(chatId).update({
          lastMessage: text,
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          lastMessageSenderId: user.uid,
          lastMessageSenderName: user.displayName || user.email || 'Me'
        }).catch(() => {});
      }

      // Show brief toast if the app is visible
      if (typeof window.showToast === 'function' && document.visibilityState === 'visible') {
        window.showToast('Reply sent ✓');
      }
    } catch (e) {
      console.warn('[TC Reply] Auto-send failed:', e);
      if (typeof window.showToast === 'function') {
        window.showToast('Could not send reply — open the chat to retry', 'error');
      }
    }
  }

  /* ── Init ─────────────────────────────────────────────────────────── */
  function init() {
    startTokenRefresh();
    listenForSwRelay();
  }

  if (document.readyState === 'complete') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', () => setTimeout(init, 0));
  }
})();
