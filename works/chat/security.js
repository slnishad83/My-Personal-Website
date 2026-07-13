/* ============================================================
   SECURITY — E2E encryption helpers, token refresh, session
   Provides WebCrypto-based message encryption
   ============================================================ */
'use strict';

const Security = {
  _keyCache: new Map(),
  _KEY_CACHE_MAX: 100,
  _tokenRefreshTimer: null,
  _tokenRefreshInterval: 30 * 60 * 1000,

  async init() {
    this._startTokenRefresh();
    console.log('[Security] Initialized');
  },

  _startTokenRefresh() {
    this._tokenRefreshTimer = setInterval(async () => {
      const user = window.currentUser || App?.currentUser;
      if (user) {
        try { await user.getIdToken(true); } catch (e) { console.error('[Security] Token refresh failed:', e?.message || e); }
      }
    }, this._tokenRefreshInterval);
  },

  /* ── E2E Encryption (AES-GCM) ───────────────────────── */
  async generateKeyPair() {
    try {
      return await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (e) { console.error('[Security] generateKeyPair failed:', e?.message || e); return null; }
  },

  async exportKey(key) {
    try {
      const raw = await crypto.subtle.exportKey('raw', key);
      return btoa(String.fromCharCode(...new Uint8Array(raw)));
    } catch (e) { console.error('[Security] exportKey failed:', e?.message || e); return null; }
  },

  async importKey(b64) {
    try {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      return await crypto.subtle.importKey('raw', bytes, 'AES-GCM', true, ['encrypt', 'decrypt']);
    } catch (e) { console.error('[Security] importKey failed:', e?.message || e); return null; }
  },

  async encrypt(text, key) {
    if (!key) throw new Error('[Security] encrypt() called without encryption key');
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(text);
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      return {
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
        iv: btoa(String.fromCharCode(...iv))
      };
    } catch (e) { console.error('[Security] encrypt failed:', e?.message || e); throw e; }
  },

  async decrypt(ciphertext, iv, key) {
    if (!key || !iv) return { error: true, message: 'Missing key or IV' };
    try {
      const ct = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
      const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ct);
      return new TextDecoder().decode(plain);
    } catch (e) { console.error('[Security] decrypt failed:', e?.message || e); return { error: true, message: 'Decryption failed' }; }
  },

  /* ── Key Exchange Helpers ────────────────────────────── */
  async getOrCreateRoomKey(chatId) {
    if (this._keyCache.has(chatId)) return this._keyCache.get(chatId);
    const key = await this.generateKeyPair();
    if (key) {
      if (this._keyCache.size >= this._KEY_CACHE_MAX) {
        var firstKey = this._keyCache.keys().next().value;
        this._keyCache.delete(firstKey);
      }
      this._keyCache.set(chatId, key);
    }
    return key;
  },

  /* ── Token Management ────────────────────────────────── */
  async getIdToken() {
    const user = window.currentUser || App?.currentUser;
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (e) { console.error('[Security] getIdToken failed:', e?.message || e); return null; }
  },

  async forceTokenRefresh() {
    const user = window.currentUser || App?.currentUser;
    if (!user) return false;
    try {
      await user.getIdToken(true);
      return true;
    } catch (e) { console.error('[Security] forceTokenRefresh failed:', e?.message || e); return false; }
  },

  /* ── Secure Storage ──────────────────────────────────── */
  setSecure(key, value) {
    try {
      const encoded = btoa(JSON.stringify({ v: value, t: Date.now() }));
      sessionStorage.setItem('_tc_' + key, encoded);
    } catch (e) { console.error('[Security] setSecure failed:', e?.message || e); }
  },

  getSecure(key) {
    try {
      const raw = sessionStorage.getItem('_tc_' + key);
      if (!raw) return null;
      const { v } = JSON.parse(atob(raw));
      return v;
    } catch (e) { console.error('[Security] getSecure failed:', e?.message || e); return null; }
  },

  clearSecure() {
    try {
      const keys = Object.keys(sessionStorage).filter(k => k.startsWith('_tc_'));
      keys.forEach(k => sessionStorage.removeItem(k));
    } catch (e) { console.error('[Security] clearSecure failed:', e?.message || e); }
  },

  /* ── Device Verification ─────────────────────────────── */
  getDeviceInfo() {
    return {
      platform: window.Platform?.os || 'unknown',
      browser: window.Platform?.browser || 'unknown',
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      fingerprint: window.Platform?.getFingerprint?.() || ''
    };
  },

  destroy() {
    if (this._tokenRefreshTimer) { clearInterval(this._tokenRefreshTimer); this._tokenRefreshTimer = null; }
    this._keyCache.clear();
    this.clearSecure();
  }
};

window.Security = Security;
