/* ============================================================
   PRESENCE SYSTEM — Online status, heartbeat, lastSeen
   Detects zombie sessions, multi-device awareness
   ============================================================ */
'use strict';

const Presence = {
  _heartbeatInterval: 30000,
  _heartbeatTimer: null,
  _heartbeatTimeout: 60000,
  _onlineStatus: 'offline',
  _lastSeen: null,
  _listeners: [],

  /** Initialize presence tracking, set user online, and start heartbeat. */
  async init() {
    if (!window.db || !window.currentUser) return;
    this._setupListeners();
    this.setOnline();
    this._startHeartbeat();
    if (window.__DEBUG__) console.log('[Presence] Initialized');
  },

  _setupListeners() {
    this._boundBeforeUnload = () => this.setOffline();
    this._boundVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this.setOnline();
      } else {
        this.setAway();
      }
    };
    this._boundOnline = () => this.setOnline();
    this._boundOffline = () => this.setOffline();
    window.addEventListener('beforeunload', this._boundBeforeUnload);
    document.addEventListener('visibilitychange', this._boundVisibilityChange);
    window.addEventListener('online', this._boundOnline);
    window.addEventListener('offline', this._boundOffline);
  },

  async setAway() {
    if (!window.db || !window.currentUser) return;
    this._onlineStatus = 'away';
    try {
      await window.db.collection('users').doc(window.currentUser.uid).update({
        onlineStatus: 'away',
        lastSeen: Date.now(),
        lastHeartbeat: Date.now(),
        sessionId: this._getSessionId(),
        userAgent: navigator.userAgent.slice(0, 100),
        platform: window.Platform?.os || 'unknown'
      });
    } catch (err) { console.warn('[Presence] Failed to set away status:', err.message); }
    this._emit('status', { status: 'away' });
  },

  async setOnline() {
    if (!window.db || !window.currentUser) return;
    this._onlineStatus = 'online';
    try {
      await window.db.collection('users').doc(window.currentUser.uid).set({
        onlineStatus: 'online',
        lastSeen: Date.now(),
        lastHeartbeat: Date.now(),
        sessionId: this._getSessionId(),
        userAgent: navigator.userAgent.slice(0, 100),
        platform: window.Platform?.os || 'unknown'
      }, { merge: true });
    } catch (err) { console.warn('[Presence] Failed to set online status:', err.message); }
    this._emit('status', { status: 'online' });
  },

  async setOffline() {
    if (!window.db || !window.currentUser) return;
    this._onlineStatus = 'offline';
    this._lastSeen = Date.now();
    this._stopHeartbeat();
    try {
      await window.db.collection('users').doc(window.currentUser.uid).set({
        onlineStatus: 'offline',
        lastSeen: Date.now()
      }, { merge: true });
    } catch (err) { console.warn('[Presence] Failed to set offline status:', err.message); }
    this._emit('status', { status: 'offline' });
  },

  async setCustomStatus(status) {
    if (!window.db || !window.currentUser) return;
    try {
      await window.db.collection('users').doc(window.currentUser.uid).set({
        customStatus: status,
        lastSeen: Date.now()
      }, { merge: true });
    } catch (err) { console.warn('[Presence] Failed to set custom status:', err.message); }
  },

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        await window.db.collection('users').doc(window.currentUser.uid).update({
          lastHeartbeat: Date.now(),
          onlineStatus: document.visibilityState === 'visible' ? 'online' : this._onlineStatus
        });
      } catch (err) { console.warn('[Presence] Heartbeat failed:', err.message); }
    }, this._heartbeatInterval);
  },

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  },

  _getSessionId() {
    try {
      let sid = sessionStorage.getItem('tcSessionId');
      if (!sid) {
        if (window.MultiDevice?.getCurrentSessionId) {
          sid = window.MultiDevice.getCurrentSessionId();
        } else {
          const ts = Date.now().toString(36);
          const arr = new Uint8Array(6);
          crypto.getRandomValues(arr);
          const rand = Array.from(arr, b => b.toString(36).padStart(2, '0')).join('');
          sid = (window.Platform?.os || 'web').slice(0, 3) + '-' + ts + '-' + rand;
        }
        sessionStorage.setItem('tcSessionId', sid);
      }
      return sid;
    } catch (_) {
      return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    }
  },

  async getUserStatus(uid) {
    if (!window.db) return { status: 'unknown', lastSeen: null };
    try {
      const doc = await window.db.collection('users').doc(uid).get();
      if (!doc.exists) return { status: 'unknown', lastSeen: null };
      const data = doc.data();
      const now = Date.now();
      const heartbeat = data.lastHeartbeat || 0;
      const isRecent = (now - heartbeat) < this._heartbeatTimeout;
      return {
        status: data.onlineStatus === 'online' && isRecent ? 'online' : 'offline',
        lastSeen: data.lastSeen || null,
        lastHeartbeat: heartbeat,
        customStatus: data.customStatus || '',
        sessionId: data.sessionId || '',
        platform: data.platform || 'unknown'
      };
    } catch (_) {
      return { status: 'unknown', lastSeen: null };
    }
  },

  formatLastSeen(ts) {
    if (!ts) return '';
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return 'last seen just now';
    if (diff < 3600000) return `last seen ${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `last seen ${Math.floor(diff / 3600000)} hr ago`;
    const d = new Date(ts);
    return `last seen ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  },

  on(event, fn) { this._listeners.push({ event, fn }); },
  off(event, fn) { this._listeners = this._listeners.filter(l => !(l.event === event && l.fn === fn)); },
  _emit(event, data) { this._listeners.filter(l => l.event === event).forEach(l => { try { l.fn(data); } catch (_) {} }); },

  getStatus() { return this._onlineStatus; },

  /** Stop heartbeat, set user offline, and clean up listeners. */
  destroy() {
    this._stopHeartbeat();
    this.setOffline();
    if (this._boundBeforeUnload) window.removeEventListener('beforeunload', this._boundBeforeUnload);
    if (this._boundVisibilityChange) document.removeEventListener('visibilitychange', this._boundVisibilityChange);
    if (this._boundOnline) window.removeEventListener('online', this._boundOnline);
    if (this._boundOffline) window.removeEventListener('offline', this._boundOffline);
    this._listeners = [];
  }
};

window.Presence = Presence;
window.formatLastSeen = Presence.formatLastSeen.bind(Presence);
