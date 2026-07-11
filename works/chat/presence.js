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

  async init() {
    if (!window.db || !window.currentUser) return;
    this._setupListeners();
    this.setOnline();
    this._startHeartbeat();
    console.log('[Presence] Initialized');
  },

  _setupListeners() {
    window.addEventListener('beforeunload', () => this.setOffline());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.setOnline();
      }
    });
    window.addEventListener('online', () => this.setOnline());
    window.addEventListener('offline', () => this.setOffline());
  },

  async setOnline() {
    if (!window.db || !window.currentUser) return;
    this._onlineStatus = 'online';
    try {
      await window.db.collection('users').doc(window.currentUser.uid).update({
        onlineStatus: 'online',
        lastSeen: Date.now(),
        lastHeartbeat: Date.now(),
        sessionId: this._getSessionId(),
        userAgent: navigator.userAgent.slice(0, 100),
        platform: window.Platform?.os || 'unknown'
      });
    } catch (_) {}
    this._emit('status', { status: 'online' });
  },

  async setOffline() {
    if (!window.db || !window.currentUser) return;
    this._onlineStatus = 'offline';
    this._lastSeen = Date.now();
    this._stopHeartbeat();
    try {
      await window.db.collection('users').doc(window.currentUser.uid).update({
        onlineStatus: 'offline',
        lastSeen: Date.now()
      });
    } catch (_) {}
    this._emit('status', { status: 'offline' });
  },

  async setCustomStatus(status) {
    if (!window.db || !window.currentUser) return;
    try {
      await window.db.collection('users').doc(window.currentUser.uid).update({
        customStatus: status,
        lastSeen: Date.now()
      });
    } catch (_) {}
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
      } catch (_) {}
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
        sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
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

  destroy() {
    this._stopHeartbeat();
    this.setOffline();
    this._listeners = [];
  }
};

window.Presence = Presence;
window.formatLastSeen = Presence.formatLastSeen.bind(Presence);
