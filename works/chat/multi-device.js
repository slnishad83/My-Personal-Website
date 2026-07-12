/* ============================================================
   MULTI-DEVICE — Session tracking, device management
   Tracks active sessions, allows device revocation
   ============================================================ */
'use strict';

const MultiDevice = {
  _currentSessionId: null,
  _cleanupTimer: null,
  _staleThreshold: 120000,

  async init() {
    if (!window.db || !window.currentUser) return;
    this._currentSessionId = this._getOrCreateSessionId();
    await this._registerSession();
    this._startCleanup();
    console.debug('[MultiDevice] Session:', this._currentSessionId);
  },

  _getOrCreateSessionId() {
    try {
      let sid = sessionStorage.getItem('tcSessionId');
      if (!sid) {
        sid = this._generateSessionId();
        sessionStorage.setItem('tcSessionId', sid);
      }
      return sid;
    } catch (_) {
      return this._generateSessionId();
    }
  },

  _generateSessionId() {
    const ts = Date.now().toString(36);
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    const rand = Array.from(arr, b => b.toString(36).padStart(2, '0')).join('');
    const plat = (window.Platform?.os || 'web').slice(0, 3);
    return `${plat}-${ts}-${rand}`;
  },

  async _registerSession() {
    if (!window.db || !window.currentUser) return;
    try {
      const sessionData = {
        sessionId: this._currentSessionId,
        platform: window.Platform?.os || 'unknown',
        browser: window.Platform?.browser || 'unknown',
        deviceType: window.Platform?.isMobile ? 'mobile' : window.Platform?.isTablet ? 'tablet' : 'desktop',
        userAgent: navigator.userAgent.slice(0, 150),
        screenResolution: `${screen.width}x${screen.height}`,
        pixelRatio: window.devicePixelRatio,
        isStandalone: window.Platform?.isStandalone || false,
        isNativeApp: window.Platform?.isNativeApp || false,
        registeredAt: Date.now(),
        lastActive: Date.now(),
        isCurrent: true
      };
      await window.db.collection('users').doc(window.currentUser.uid)
        .collection('sessions').doc(this._currentSessionId).set(sessionData, { merge: true });
    } catch (e) {
      console.warn('[MultiDevice] Register session failed:', e);
    }
  },

  async _updateHeartbeat() {
    if (!window.db || !window.currentUser || !this._currentSessionId) return;
    try {
      await window.db.collection('users').doc(window.currentUser.uid)
        .collection('sessions').doc(this._currentSessionId).update({
          lastActive: Date.now()
        });
    } catch (e) { console.warn('[MultiDevice] Heartbeat failed:', e?.message || e); }
  },

  _startCleanup() {
    this._cleanupTimer = setInterval(() => this._updateHeartbeat(), 30000);
  },

  async getActiveSessions() {
    if (!window.db || !window.currentUser) return [];
    try {
      const snap = await window.db.collection('users').doc(window.currentUser.uid)
        .collection('sessions').orderBy('lastActive', 'desc').get();
      const now = Date.now();
      return snap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          isCurrent: data.sessionId === this._currentSessionId,
          isOnline: (now - (data.lastActive || 0)) < this._staleThreshold
        };
      });
    } catch (e) { console.warn('[MultiDevice] getActiveSessions failed:', e?.message || e); return []; }
  },

  async revokeSession(sessionId) {
    if (!window.db || !window.currentUser) return false;
    try {
      await window.db.collection('users').doc(window.currentUser.uid)
        .collection('sessions').doc(sessionId).delete();
      return true;
    } catch (e) { console.warn('[MultiDevice] revokeSession failed:', e?.message || e); return false; }
  },

  async revokeAllSessions() {
    if (!window.db || !window.currentUser) return;
    try {
      const snap = await window.db.collection('users').doc(window.currentUser.uid)
        .collection('sessions').get();
      const batch = window.db.batch();
      snap.docs.forEach(doc => {
        if (doc.id !== this._currentSessionId) batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (e) { console.warn('[MultiDevice] revokeAllSessions failed:', e?.message || e); }
  },

  async removeCurrentSession() {
    if (!window.db || !window.currentUser || !this._currentSessionId) return;
    try {
      await window.db.collection('users').doc(window.currentUser.uid)
        .collection('sessions').doc(this._currentSessionId).delete();
    } catch (e) { console.warn('[MultiDevice] removeCurrentSession failed:', e?.message || e); }
  },

  getCurrentSessionId() { return this._currentSessionId; },

  destroy() {
    if (this._cleanupTimer) { clearInterval(this._cleanupTimer); this._cleanupTimer = null; }
    this.removeCurrentSession();
  }
};

window.MultiDevice = MultiDevice;
