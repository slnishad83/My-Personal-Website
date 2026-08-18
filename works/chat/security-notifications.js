/* ============================================================
   SECURITY NOTIFICATIONS — Alerts when E2E security code
   changes for a contact (like WhatsApp security code changes)
   ============================================================ */
'use strict';

(function() {
  const _storageKey = 'securityCodes';
  let _checking = false;

  function _uid() {
    return (window.currentUser && window.currentUser.uid) ||
      (window.App && window.App.auth && window.App.auth.currentUser && window.App.auth.currentUser.uid) || null;
  }

  function _db() {
    return (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
  }

  function _getStoredCodes() {
    try {
      const raw = localStorage.getItem(_storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function _storeCode(userId, code) {
    const codes = _getStoredCodes();
    codes[userId] = { code: code, updatedAt: Date.now() };
    localStorage.setItem(_storageKey, JSON.stringify(codes));
  }

  function _checkCodeChange(userId, newCode) {
    const codes = _getStoredCodes();
    const stored = codes[userId];
    if (stored && stored.code && newCode && stored.code !== newCode) {
      _showSecurityChangeNotification(userId);
      return true;
    }
    return false;
  }

  function _showSecurityChangeNotification(userId) {
    const chat = (window.State && window.State.chats || []).find(function(c) {
      return c.otherUserId === userId;
    });
    const name = chat ? chat.name : 'A contact';

    if (typeof showToast === 'function') {
      showToast('Security code changed with ' + name + '. If you didn\'t re-register, verify their identity.', 'warning', 8000);
    }

    const db = _db();
    const me = _uid();
    if (db && me) {
      db.collection('securityNotifications').add({
        userId: me,
        contactId: userId,
        contactName: name,
        type: 'code-change',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      }).catch(function() {});
    }
  }

  function updateSecurityCode(userId, code) {
    const changed = _checkCodeChange(userId, code);
    _storeCode(userId, code);
    return changed;
  }

  async function checkAllContacts() {
    if (_checking) return;
    _checking = true;
    const db = _db();
    const me = _uid();
    if (!db || !me) { _checking = false; return; }

    const codes = _getStoredCodes();
    const userIds = Object.keys(codes);
    if (!userIds.length) { _checking = false; return; }

    for (const userId of userIds.slice(0, 20)) {
      try {
        const sortedIds = [me, userId].sort().join('_');
        const doc = await db.collection('securityKeys').doc(sortedIds).get();
        if (doc.exists) {
          const data = doc.data();
          const currentCode = data.fingerprint || data.securityCode || '';
          if (currentCode) _checkCodeChange(userId, currentCode);
        }
      } catch (e) {}
    }
    _checking = false;
  }

  function getSecurityNotifications(callback) {
    const db = _db();
    const me = _uid();
    if (!db || !me) return function() {};

    return db.collection('securityNotifications')
      .where('userId', '==', me)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .onSnapshot(function(snap) {
        const notifications = [];
        snap.forEach(function(doc) {
          notifications.push({ id: doc.id, ...doc.data() });
        });
        callback(notifications);
      });
  }

  function markAsRead(notificationId) {
    const db = _db();
    if (db && notificationId) {
      db.collection('securityNotifications').doc(notificationId).update({ read: true }).catch(function() {});
    }
  }

  setInterval(checkAllContacts, 5 * 60 * 1000);

  window.SecurityNotifications = {
    updateSecurityCode: updateSecurityCode,
    checkAllContacts: checkAllContacts,
    getNotifications: getSecurityNotifications,
    markAsRead: markAsRead
  };
})();
