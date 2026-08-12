/* ============================================================
   E2E — Shared end-to-end encryption helpers for chat-core.
   Wraps Security (security.js) so chat-core can encrypt text
   messages on send and decrypt them on render without knowing
   the key-exchange details.
   - direct  : ECDH shared key (per peer)
   - group   : AES-GCM room key wrapped per member in groupKeys/{chatId}
   - others  : not encrypted (channels / broadcast / notes)
   Message payload shape: { enc: { ct, iv } } (no plaintext field)
   ============================================================ */
'use strict';

window.E2E = {
  securePreview() {
    return '🔒 Encrypted message';
  },

  isEncrypted(msg) {
    return !!(msg && msg.enc && msg.enc.ct && msg.enc.iv);
  },

  supports(chatType) {
    return chatType === 'direct' || chatType === 'group';
  },

  _currentUid() {
    return (window.currentUser && window.currentUser.uid) ||
      (window.App && window.App.currentUser && window.App.currentUser.uid) ||
      null;
  },

  /* Derive the peer uid from a direct chatId built as [uidA, uidB].sort().join('_') */
  _peerUid(chatId) {
    const uid = this._currentUid();
    if (!uid || !chatId) return null;
    const parts = String(chatId).split('_');
    if (parts.length < 2) return null;
    return parts[0] === uid ? parts[1] : parts[0];
  },

  async _groupMembers(chatId) {
    try {
      const db = firebase.firestore();
      const snap = await db.collection('groups').doc(chatId).get();
      if (!snap.exists) return null;
      const d = snap.data() || {};
      if (Array.isArray(d.memberIds) && d.memberIds.length) return d.memberIds;
      if (Array.isArray(d.memberUids) && d.memberUids.length) return d.memberUids;
      if (Array.isArray(d.participants) && d.participants.length) {
        return d.participants.map(p => (typeof p === 'string') ? p : (p.uid || p.id));
      }
      return null;
    } catch (e) { if (window.__DEBUG__) console.warn('[E2E] _groupMembers failed:', e); return null; }
  },

  async _getOrEnsureRoomKey(chatId) {
    const Security = window.Security;
    if (!Security) return null;
    let key = await Security.getRoomKey(chatId);
    if (key) return key;
    const members = await this._groupMembers(chatId);
    if (!members || !members.length) return null;
    key = await Security.wrapRoomKey(chatId, members);
    return key || null;
  },

  /* Encrypt text for the active chat. Returns { enc } or null (plaintext). */
  async encryptForChat(chatId, chatType, text) {
    const Security = window.Security;
    if (!Security || !this.supports(chatType)) return null;
    try {
      if (chatType === 'direct') {
        const peer = this._peerUid(chatId);
        if (!peer) return null;
        const enc = await Security.encryptMessage(text, peer);
        return enc ? { enc } : null;
      }
      if (chatType === 'group') {
        const roomKey = await this._getOrEnsureRoomKey(chatId);
        if (!roomKey) return null;
        const enc = await Security.encrypt(text, roomKey);
        return enc ? { enc } : null;
      }
      return null;
    } catch (e) {
      if (window.__DEBUG__) console.warn('[E2E] encryptForChat failed:', e);
      return null;
    }
  },

  /* Decrypt a message doc into { id, ...data, text }. Falls back to a
     locked placeholder when the key is unavailable. Never throws. */
  async decryptMessageData(chatId, chatType, id, data) {
    const out = Object.assign({}, data, { id });
    if (!this.isEncrypted(data)) return out;
    const Security = window.Security;
    if (!Security) return this._placeholder(out);
    try {
      let plain = null;
      if (chatType === 'direct') {
        const sender = data.senderId || this._peerUid(chatId);
        plain = await Security.decryptMessage(data.enc.ct, data.enc.iv, sender);
      } else if (chatType === 'group') {
        const roomKey = await this._getOrEnsureRoomKey(chatId);
        plain = roomKey ? await Security.decrypt(data.enc.ct, data.enc.iv, roomKey) : null;
      } else {
        return this._placeholder(out);
      }
      if (plain && !plain.error) {
        out.text = plain;
        out.decrypted = true;
        return out;
      }
      return this._placeholder(out);
    } catch (e) {
      if (window.__DEBUG__) console.warn('[E2E] decryptMessageData failed:', e);
      return this._placeholder(out);
    }
  },

  /* Decrypt a message for a chat by passing chatId + the message data.
     Used by enhancement renderers that read raw docs. */
  async decryptMessageFor(chatId, chatType, msg) {
    if (!this.isEncrypted(msg)) return msg && msg.text ? msg.text : '';
    const dec = await this.decryptMessageData(chatId, chatType, msg.id || '', msg);
    return dec && dec.text ? dec.text : this.securePreview();
  },

  _placeholder(out) {
    out.text = this.securePreview();
    out.decryptFailed = true;
    return out;
  }
};
