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

  /* Encrypt text for the active chat. Returns { enc } or null (plaintext).
     Accepts a string or a plain object (will be JSON-stringified).
     Uses Signal Protocol (X3DH + Double Ratchet) for direct chats when available. */
  async encryptForChat(chatId, chatType, data) {
    const Security = window.Security;
    if (!Security || !this.supports(chatType)) return null;
    const text = (typeof data === 'object' && data !== null) ? JSON.stringify(data) : String(data || '');
    if (!text) return null;
    try {
      if (chatType === 'direct') {
        const peer = this._peerUid(chatId);
        if (!peer) return null;
        // Prefer Signal Protocol (X3DH + Double Ratchet) for per-message forward secrecy
        if (window.SignalProtocol) {
          try {
            const theirBundle = await SignalProtocol.fetchPeerKeys(peer);
            if (theirBundle) {
              const result = await SignalProtocol.encrypt(chatId, text, theirBundle);
              if (result) return { enc: { ct: result.ct, iv: result.iv, n: result.n, spkId: result.spkId, opkUsed: result.opkUsed, signal: true } };
            }
          } catch (e) { if (window.__DEBUG__) console.warn('[E2E] Signal Protocol encrypt fallback:', e); }
        }
        // Fallback to simple ECDH
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
        // Signal Protocol messages (X3DH + Double Ratchet)
        if (data.enc && data.enc.signal && window.SignalProtocol && data.enc.n != null) {
          try {
            plain = await SignalProtocol.decrypt(chatId, data.enc.ct, data.enc.iv, data.enc.n, sender);
          } catch (e) { if (window.__DEBUG__) console.warn('[E2E] Signal Protocol decrypt failed:', e); }
        }
        // Fallback to simple ECDH with key rotation support
        if (!plain) {
          plain = await (Security.decryptMessageWithFallback || Security.decryptMessage).call(Security, data.enc.ct, data.enc.iv, sender);
        }
      } else if (chatType === 'group') {
        const roomKey = await this._getOrEnsureRoomKey(chatId);
        plain = roomKey ? await Security.decrypt(data.enc.ct, data.enc.iv, roomKey) : null;
      } else {
        return this._placeholder(out);
      }
      if (plain && !plain.error) {
        out.text = plain;
        try { const parsed = JSON.parse(plain); if (parsed && typeof parsed === 'object') { Object.assign(out, parsed); out._e2eJson = true; } } catch(_) {}
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
  },

  /* Encrypt a message payload's text-sensitive fields for the active chat.
     Mutates msg in place: sets enc/e2e fields and clears plaintext.
     Returns the mutated msg for convenience. */
  async encryptPayload(msg, chatId, chatType) {
    if (!chatId || !chatType || !this.supports(chatType)) return msg;
    const textFields = {};
    if (msg.text) textFields.text = msg.text;
    if (msg.type === 'poll' && msg.poll) {
      textFields.pollQ = msg.poll.question;
      textFields.pollOpts = (msg.poll.options || []).map(o => o.text);
    }
    if (msg.type === 'location' && msg.text) {
      textFields.locLabel = msg.text;
    }
    const hasText = Object.keys(textFields).length > 0;
    if (hasText) {
      const enc = await this.encryptForChat(chatId, chatType, textFields);
      if (enc) {
        msg.enc = enc.enc;
        msg.e2e = true;
        if (msg.text) delete msg.text;
        if (msg.poll && textFields.pollQ) {
          msg.poll = Object.assign({}, msg.poll, { question: '🔒', options: (msg.poll.options || []).map((o,i) => ({ id: o.id, text: '🔒' })) });
        }
      }
    }
    return msg;
  },

  removeLockBanner() {
    var el = document.getElementById('e2e-lock-banner');
    if (el) el.remove();
  },

  showLockBanner(chatId, chatType) {
    this.removeLockBanner();
    if (!this.supports(chatType)) return;
    var header = document.getElementById('chat-header');
    if (!header) return;
    var banner = document.createElement('div');
    banner.id = 'e2e-lock-banner';
    banner.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;padding:5px 16px;background:rgba(0,128,105,0.06);border-bottom:1px solid rgba(0,128,105,0.1);font-size:11.5px;color:var(--on-surface-variant,#667781);cursor:pointer;user-select:none;flex-shrink:0;';
    banner.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;color:#008069;">lock</span><span>Messages are end-to-end encrypted. Tap to verify.</span>';
    banner.addEventListener('click', function() { window.E2E.showSafetyNumberDialog(chatId, chatType); });
    header.insertAdjacentElement('afterend', banner);
  },

  async showSafetyNumberDialog(chatId, chatType) {
    var existing = document.getElementById('e2e-safety-dialog');
    if (existing) existing.remove();
    var myUid = this._currentUid();
    if (!myUid) return;
    var peerUid = chatType === 'direct' ? this._peerUid(chatId) : null;
    var myKey = null, peerKey = null;
    try {
      var db = firebase.firestore();
      var mySnap = await db.collection('userPublicKeys').doc(myUid).get();
      if (mySnap.exists) myKey = mySnap.data().publicKey;
      if (peerUid) {
        var peerSnap = await db.collection('userPublicKeys').doc(peerUid).get();
        if (peerSnap.exists) peerKey = peerSnap.data().publicKey;
      }
    } catch (_) {}
    if (!myKey) { if (typeof showToast === 'function') showToast('Could not load encryption keys', 'error'); return; }
    var fingerprint;
    try {
      var raw = JSON.stringify({ a: myUid, b: peerUid || 'group', ka: myKey, kb: peerKey || {} });
      var hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      var hashArray = Array.from(new Uint8Array(hashBuffer));
      fingerprint = hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (_) { fingerprint = 'Unable to generate'; }
    var groups = [];
    for (var i = 0; i < fingerprint.length; i += 5) { groups.push(fingerprint.substr(i, 5)); }
    var formatted = groups.join(' ');
    var keyVersion = (window.Security && Security._keyVersion) || 1;
    var overlay = document.createElement('div');
    overlay.id = 'e2e-safety-dialog';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
    overlay.innerHTML =
      '<div style="background:var(--surface,#fff);border-radius:16px;padding:24px;max-width:360px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);text-align:center;">' +
        '<div style="margin-bottom:16px;"><span class="material-symbols-outlined" style="font-size:48px;color:#008069;">verified_user</span></div>' +
        '<h3 style="margin:0 0 8px;font-size:16px;color:var(--on-surface,#1b1b1f);">Verify Security Code</h3>' +
        '<p style="margin:0 0 4px;font-size:12px;color:var(--on-surface-variant,#667781);">Key version: ' + keyVersion + '</p>' +
        '<p style="margin:0 0 16px;font-size:12px;color:var(--on-surface-variant,#667781);">Compare this code with your contact to verify end-to-end encryption.</p>' +
        '<div style="background:var(--surface-container,#f0f2f5);border-radius:8px;padding:12px;margin-bottom:16px;word-break:break-all;font-family:monospace;font-size:13px;color:var(--on-surface,#1b1b1f);letter-spacing:0.5px;">' + formatted + '</div>' +
        '<button id="e2e-safety-close" style="background:#008069;color:#fff;border:none;border-radius:24px;padding:10px 32px;font-size:14px;font-weight:500;cursor:pointer;">Done</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    var closeBtn = document.getElementById('e2e-safety-close');
    if (closeBtn) closeBtn.addEventListener('click', function() { overlay.remove(); });
  }
};
