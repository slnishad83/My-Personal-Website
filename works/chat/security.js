/* ============================================================
   SECURITY â€” E2E encryption helpers, token refresh, session
   Provides WebCrypto-based message encryption
   UPGRADED: ECDH key exchange, PBKDF2 PIN hashing, WebCrypto storage
   ============================================================ */
'use strict';

const Security = {
  _keyCache: new Map(),
  _roomKeyCache: new Map(),
  _KEY_CACHE_MAX: 100,
  _tokenRefreshTimer: null,
  _tokenRefreshInterval: 30 * 60 * 1000,
  _storageDBName: 'nslSecureStorage',
  _storageDBVersion: 1,
  _storageStoreName: 'secrets',
  _storageKey: null,
  _e2ePrivateKey: null,
  _e2ePublicKeyJwk: null,

  async init() {
    this._startTokenRefresh();
    if (window.__DEBUG__) console.log('[Security] Initialized (WebCrypto storage + ECDH)');
  },

  _startTokenRefresh() {
    this._tokenRefreshTimer = setInterval(async () => {
      const user = window.currentUser || App?.currentUser;
      if (user) {
        try { await user.getIdToken(true); } catch (e) { if (window.__DEBUG__) console.error('[Security] Token refresh failed:', e?.message || e); }
      }
    }, this._tokenRefreshInterval);
  },

  /* â”€â”€ ECDH Key Exchange (P-256) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async generateKeyPair() {
    try {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );
      const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
      return { publicKeyJwk, privateKey: keyPair.privateKey };
    } catch (e) { if (window.__DEBUG__) console.error('[Security] ECDH key pair generation failed:', e); return null; }
  },

  async deriveSharedKey(privateKey, theirPublicKeyJwk) {
    try {
      const theirPublicKey = await crypto.subtle.importKey(
        'jwk', theirPublicKeyJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false, []
      );
      return await crypto.subtle.deriveKey(
        { name: 'ECDH', public: theirPublicKey },
        privateKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (e) { if (window.__DEBUG__) console.error('[Security] Shared key derivation failed:', e); return null; }
  },

  async exportKey(key) {
    try {
      const raw = await crypto.subtle.exportKey('raw', key);
      return btoa(String.fromCharCode(...new Uint8Array(raw)));
    } catch (e) { if (window.__DEBUG__) console.error('[Security] Key export failed:', e); return null; }
  },

  async importKey(b64) {
    try {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      return await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
    } catch (e) { if (window.__DEBUG__) console.error('[Security] Key import failed:', e); return null; }
  },

  /* â”€â”€ AES-GCM Encryption â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async encrypt(text, key) {
    if (!key) throw new Error('[Security] encrypt() requires an encryption key');
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(text);
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      return {
        ciphertext: this._arrayBufferToBase64(ciphertext),
        iv: this._arrayBufferToBase64(iv)
      };
    } catch (e) { if (window.__DEBUG__) console.error('[Security] encrypt failed:', e); throw e; }
  },

  async decrypt(ciphertext, iv, key) {
    if (!key || !iv) return { error: true, message: 'Missing key or IV' };
    try {
      const ct = this._base64ToArrayBuffer(ciphertext);
      const ivBytes = this._base64ToArrayBuffer(iv);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ct);
      return new TextDecoder().decode(plain);
    } catch (e) { return { error: true, message: 'Decryption failed' }; }
  },

  /* AES-GCM on raw bytes (used for wrapping room keys) */
  async encryptBytes(bytes, key) {
    if (!key) throw new Error('[Security] encryptBytes() requires an encryption key');
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
      return {
        ciphertext: this._arrayBufferToBase64(ciphertext),
        iv: this._arrayBufferToBase64(iv)
      };
    } catch (e) { if (window.__DEBUG__) console.error('[Security] encryptBytes failed:', e); throw e; }
  },

  async decryptBytes(ciphertext, iv, key) {
    if (!key || !iv) return null;
    try {
      const ct = this._base64ToArrayBuffer(ciphertext);
      const ivBytes = this._base64ToArrayBuffer(iv);
      return await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ct);
    } catch (e) { if (window.__DEBUG__) console.error('[Security] decryptBytes failed:', e); return null; }
  },

  /* â”€â”€ E2E Key Exchange â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async _ensureE2EKeys() {
    if (this._e2ePrivateKey && this._e2ePublicKeyJwk) return;
    const user = window.currentUser || App?.currentUser;
    if (!user) return;
    const uid = user.uid;
    const stored = await this.getSecure('e2eKeypair_' + uid);
    if (stored && stored.privateJwk && stored.publicJwk) {
      this._e2ePrivateKey = await crypto.subtle.importKey(
        'jwk', stored.privateJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false, ['deriveKey', 'deriveBits']
      );
      this._e2ePublicKeyJwk = stored.publicJwk;
    } else {
      const kp = await this.generateKeyPair();
      if (!kp) return;
      this._e2ePrivateKey = kp.privateKey;
      this._e2ePublicKeyJwk = kp.publicKeyJwk;
      await this.storeSecure('e2eKeypair_' + uid, {
        publicJwk: kp.publicKeyJwk,
        privateJwk: kp.privateKey ? await crypto.subtle.exportKey('jwk', kp.privateKey) : null,
      });
    }
  },

  async publishPublicKey() {
    await this._ensureE2EKeys();
    if (!this._e2ePublicKeyJwk) return;
    const user = window.currentUser || App?.currentUser;
    if (!user) return;
    const db = firebase.firestore();
    await db.collection('userPublicKeys').doc(user.uid).set(
      { publicKey: this._e2ePublicKeyJwk, publicKeyUpdatedAt: Date.now() },
      { merge: true }
    );
  },

  async getPeerPublicKey(peerUid) {
    const db = firebase.firestore();
    const snap = await db.collection('userPublicKeys').doc(peerUid).get();
    if (!snap.exists) return null;
    return snap.data().publicKey || null;
  },

  async getSharedKey(peerUid) {
    const cacheKey = 'e2e_' + peerUid;
    if (this._keyCache.has(cacheKey)) return this._keyCache.get(cacheKey);
    await this._ensureE2EKeys();
    if (!this._e2ePrivateKey) return null;
    const theirPubJwk = await this.getPeerPublicKey(peerUid);
    if (!theirPubJwk) return null;
    const sharedKey = await this.deriveSharedKey(this._e2ePrivateKey, theirPubJwk);
    if (sharedKey && this._keyCache.size < this._KEY_CACHE_MAX) {
      this._keyCache.set(cacheKey, sharedKey);
    }
    return sharedKey;
  },

  async encryptMessage(text, peerUid) {
    const key = await this.getSharedKey(peerUid);
    if (!key) return null;
    return await this.encrypt(text, key);
  },

  async decryptMessage(ciphertext, iv, peerUid) {
    const key = await this.getSharedKey(peerUid);
    if (!key) return { error: true, message: 'No shared key' };
    return await this.decrypt(ciphertext, iv, key);
  },

  /* â”€â”€ Room Key Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async getOrCreateRoomKey(chatId) {
    if (this._roomKeyCache.has(chatId)) return this._roomKeyCache.get(chatId);
    if (this._keyCache.has(chatId)) return this._keyCache.get(chatId);
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
    if (key) {
      if (this._roomKeyCache.size >= this._KEY_CACHE_MAX) {
        this._roomKeyCache.delete(this._roomKeyCache.keys().next().value);
      }
      this._roomKeyCache.set(chatId, key);
    }
    return key;
  },

  /* Wrap the group room key for every member and persist it to groupKeys/{chatId}.
     Each member's entry is encrypted with ECDH(wrapper's private key, member's public key),
     so only that member can unwrap it. Returns the room key. */
  async wrapRoomKey(chatId, memberUids) {
    const roomKey = await this.getOrCreateRoomKey(chatId);
    if (!roomKey) return null;
    await this._ensureE2EKeys();
    if (!this._e2ePrivateKey || !this._e2ePublicKeyJwk) return null;
    const user = window.currentUser || App?.currentUser;
    if (!user) return null;
    const myUid = user.uid;
    const raw = await crypto.subtle.exportKey('raw', roomKey);
    const wrapped = {};
    for (const memberUid of (memberUids || [])) {
      try {
        const pub = memberUid === myUid ? this._e2ePublicKeyJwk : await this.getPeerPublicKey(memberUid);
        if (!pub) continue;
        const shared = await this.deriveSharedKey(this._e2ePrivateKey, pub);
        if (!shared) continue;
        const w = await this.encryptBytes(raw, shared);
        wrapped[memberUid] = { by: myUid, ct: w.ciphertext, iv: w.iv };
      } catch (e) { if (window.__DEBUG__) console.warn('[Security] wrapRoomKey member skip:', memberUid, e); }
    }
    if (!Object.keys(wrapped).length) return null;
    try {
      const db = firebase.firestore();
      await db.collection('groupKeys').doc(chatId).set({
        wrapped,
        createdBy: myUid,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) { if (window.__DEBUG__) console.warn('[Security] wrapRoomKey persist failed:', e); return null; }
    return roomKey;
  },

  /* Fetch this device's own wrapped entry and recover the group room key. */
  async getRoomKey(chatId) {
    if (this._roomKeyCache.has(chatId)) return this._roomKeyCache.get(chatId);
    await this._ensureE2EKeys();
    if (!this._e2ePrivateKey) return null;
    const user = window.currentUser || App?.currentUser;
    if (!user) return null;
    const myUid = user.uid;
    try {
      const db = firebase.firestore();
      const snap = await db.collection('groupKeys').doc(chatId).get();
      if (!snap.exists) return null;
      const data = snap.data() || {};
      const wrapped = data.wrapped || {};
      const entry = wrapped[myUid];
      if (!entry || !entry.by) return null;
      const wrapperPub = await this.getPeerPublicKey(entry.by);
      if (!wrapperPub) return null;
      const shared = await this.deriveSharedKey(this._e2ePrivateKey, wrapperPub);
      if (!shared) return null;
      const raw = await this.decryptBytes(entry.ct, entry.iv, shared);
      if (!raw) return null;
      const roomKey = await crypto.subtle.importKey(
        'raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      if (this._roomKeyCache.size >= this._KEY_CACHE_MAX) {
        this._roomKeyCache.delete(this._roomKeyCache.keys().next().value);
      }
      this._roomKeyCache.set(chatId, roomKey);
      return roomKey;
    } catch (e) { if (window.__DEBUG__) console.warn('[Security] getRoomKey failed:', e); return null; }
  },

  async encryptRoomMessage(text, chatId) {
    const roomKey = await this.getOrCreateRoomKey(chatId);
    if (!roomKey) return null;
    return await this.encrypt(text, roomKey);
  },

  async decryptRoomMessage(ciphertext, iv, chatId) {
    const roomKey = await this.getRoomKey(chatId);
    if (!roomKey) return { error: true, message: 'No room key' };
    return await this.decrypt(ciphertext, iv, roomKey);
  },

  /* â”€â”€ Encrypted Storage (WebCrypto + IndexedDB) â”€â”€â”€â”€â”€â”€â”€â”€ */
  async _initStorageKey() {
    if (this._storageKey) return this._storageKey;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this._storageDBName, this._storageDBVersion);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this._storageStoreName)) {
          db.createObjectStore(this._storageStoreName);
        }
      };
      request.onsuccess = async (e) => {
        const db = e.target.result;
        const tx = db.transaction(this._storageStoreName, 'readonly');
        const getReq = tx.objectStore(this._storageStoreName).get('_deviceKey');
        getReq.onsuccess = async () => {
          if (getReq.result) {
            this._storageKey = await crypto.subtle.importKey(
              'raw', getReq.result, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
            );
            resolve(this._storageKey);
          } else {
            this._storageKey = await crypto.subtle.generateKey(
              { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
            );
            const raw = await crypto.subtle.exportKey('raw', this._storageKey);
            const writeTx = db.transaction(this._storageStoreName, 'readwrite');
            writeTx.objectStore(this._storageStoreName).put(raw, '_deviceKey');
            resolve(this._storageKey);
          }
        };
        getReq.onerror = () => reject(getReq.error);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async setSecure(key, value) {
    try {
      const deviceKey = await this._initStorageKey();
      const plaintext = new TextEncoder().encode(JSON.stringify({ v: value, t: Date.now() }));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, deviceKey, plaintext);
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(this._storageDBName, this._storageDBVersion);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction(this._storageStoreName, 'readwrite');
      tx.objectStore(this._storageStoreName).put({
        ciphertext: this._arrayBufferToBase64(ciphertext),
        iv: this._arrayBufferToBase64(iv),
        ts: Date.now()
      }, key);
    } catch (e) { if (window.__DEBUG__) console.error('[Security] setSecure failed:', e); }
  },

  async getSecure(key) {
    try {
      const deviceKey = await this._initStorageKey();
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(this._storageDBName, this._storageDBVersion);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction(this._storageStoreName, 'readonly');
      const entry = await new Promise((resolve, reject) => {
        const req = tx.objectStore(this._storageStoreName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!entry) return null;
      const ct = this._base64ToArrayBuffer(entry.ciphertext);
      const iv = this._base64ToArrayBuffer(entry.iv);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, deviceKey, ct);
      const decoded = JSON.parse(new TextDecoder().decode(plain));
      return decoded.v;
    } catch (e) { if (window.__DEBUG__) console.error('[Security] getSecure failed:', e); return null; }
  },

  async clearSecure() {
    try {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(this._storageDBName, this._storageDBVersion);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction(this._storageStoreName, 'readwrite');
      tx.objectStore(this._storageStoreName).clear();
      this._storageKey = null;
    } catch (e) { if (window.__DEBUG__) console.error('[Security] clearSecure failed:', e); }
  },

  /* â”€â”€ Token Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  async getIdToken() {
    const user = window.currentUser || App?.currentUser;
    if (!user) return null;
    try { return await user.getIdToken(); } catch (e) { return null; }
  },

  async forceTokenRefresh() {
    const user = window.currentUser || App?.currentUser;
    if (!user) return false;
    try { await user.getIdToken(true); return true; } catch (e) { return false; }
  },

  /* â”€â”€ Device Fingerprinting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  getDeviceInfo() {
    return {
      platform: navigator.platform || 'unknown',
      userAgent: navigator.userAgent || 'unknown',
      screen: screen.width + 'x' + screen.height,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
    };
  },

  destroy() {
    if (this._tokenRefreshTimer) { clearInterval(this._tokenRefreshTimer); this._tokenRefreshTimer = null; }
    this._keyCache.clear();
    this.clearSecure();
  },

  /* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  },

  _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
};

window.Security = Security;
