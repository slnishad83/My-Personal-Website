/* ============================================================
   ENCRYPTED BACKUPS — Encrypt chat backup data before storage
   Uses AES-GCM with user-derived key
   ============================================================ */
'use strict';

(function() {
  const BACKUP_KEY_NAME = 'chatBackupKey';

  async function _deriveBackupKey(passphrase, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: 310000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptBackup(data, passphrase) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await _deriveBackupKey(passphrase, salt);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv }, key, enc.encode(JSON.stringify(data))
    );
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);
    return btoa(String.fromCharCode.apply(null, result));
  }

  async function decryptBackup(encryptedBase64, passphrase) {
    const data = Uint8Array.from(atob(encryptedBase64), function(c) { return c.charCodeAt(0); });
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const encrypted = data.slice(28);
    const key = await _deriveBackupKey(passphrase, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv }, key, encrypted
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  async function backupChats(passphrase) {
    const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
    const uid = (window.currentUser && window.currentUser.uid) ||
      (window.App && window.App.auth && window.App.auth.currentUser && window.App.auth.currentUser.uid);
    if (!db || !uid) return null;

    const backup = { version: 1, timestamp: Date.now(), userId: uid, chats: [], messages: {} };
    try {
      const chatsSnap = await db.collection('chats').where('participants', 'array-contains', uid).limit(200).get();
      for (const chatDoc of chatsSnap.docs) {
        const chatData = chatDoc.data();
        backup.chats.push({ id: chatDoc.id, ...chatData, participants: undefined });
        const msgsSnap = await db.collection('chats').doc(chatDoc.id).collection('messages')
          .orderBy('timestamp', 'desc').limit(500).get();
        backup.messages[chatDoc.id] = msgsSnap.docs.map(function(d) { return { id: d.id, ...d.data() }; });
      }
      const groupsSnap = await db.collection('groups').where('participants', 'array-contains', uid).limit(50).get();
      for (const groupDoc of groupsSnap.docs) {
        const groupData = groupDoc.data();
        backup.chats.push({ id: groupDoc.id, type: 'group', ...groupData, participants: undefined });
        const msgsSnap = await db.collection('groups').doc(groupDoc.id).collection('messages')
          .orderBy('timestamp', 'desc').limit(500).get();
        backup.messages[groupDoc.id] = msgsSnap.docs.map(function(d) { return { id: d.id, ...d.data() }; });
      }
    } catch (e) {
      if (window.__DEBUG__) console.warn('[EncryptedBackup] Error fetching data:', e);
    }

    const encrypted = await encryptBackup(backup, passphrase);
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat-backup-' + new Date().toISOString().slice(0, 10) + '.enc';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { a.remove(); URL.revokeObjectURL(url); }, 1000);
    if (typeof showToast === 'function') showToast('Backup exported', 'success');
    return encrypted;
  }

  async function restoreBackup(file, passphrase) {
    return new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = async function() {
        try {
          const decrypted = await decryptBackup(reader.result, passphrase);
          if (typeof showToast === 'function') showToast('Backup restored (' + (decrypted.chats?.length || 0) + ' chats)', 'success');
          resolve(decrypted);
        } catch (e) {
          if (typeof showToast === 'function') showToast('Wrong passphrase or corrupted backup', 'error');
          reject(e);
        }
      };
      reader.readAsText(file);
    });
  }

  window.EncryptedBackup = { encryptBackup: encryptBackup, decryptBackup: decryptBackup, backupChats: backupChats, restoreBackup: restoreBackup };
})();
