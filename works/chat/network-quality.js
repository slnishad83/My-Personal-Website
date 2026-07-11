/* ============================================================
   NETWORK QUALITY — Adaptive behavior based on connection
   Detects 2G/3G/4G, bandwidth estimation, save-data mode
   ============================================================ */
'use strict';

const NetworkQuality = {
  _listeners: [],
  _currentLevel: 'unknown',
  _lastCheck: 0,
  _checkInterval: 15000,
  _timer: null,
  _stats: [],

  init() {
    if (navigator.connection) {
      navigator.connection.addEventListener('change', () => this.check());
    }
    this.check();
    this._timer = setInterval(() => this.check(), this._checkInterval);
    console.log('[NetworkQuality] Initialized');
  },

  check() {
    const conn = navigator.connection;
    if (!conn) return this._currentLevel;
    const et = conn.effectiveType || '';
    const dl = conn.downlink || 0;
    const rtt = conn.rtt || 0;
    const saveData = conn.saveData || false;
    let level = 'unknown';
    if (saveData) level = 'save-data';
    else if (et === '4g' && dl > 5 && rtt < 100) level = 'excellent';
    else if (et === '4g' || (et === '3g' && dl > 1.5)) level = 'good';
    else if (et === '3g' || (et === '2g' && dl > 0.3)) level = 'fair';
    else if (et === '2g' || et === 'slow-2g') level = 'poor';
    else level = 'unknown';
    if (level !== this._currentLevel) {
      const prev = this._currentLevel;
      this._currentLevel = level;
      this._emit('change', { level, previous: prev, effectiveType: et, downlink: dl, rtt, saveData });
    }
    return this._currentLevel;
  },

  getLevel() { return this._currentLevel; },
  isSlow() { return ['poor', 'save-data'].includes(this._currentLevel); },
  isFast() { return ['excellent', 'good'].includes(this._currentLevel); },
  getEffectiveType() { return navigator.connection?.effectiveType || 'unknown'; },
  getDownlink() { return navigator.connection?.downlink || 0; },
  getRtt() { return navigator.connection?.rtt || 0; },
  isSaveData() { return navigator.connection?.saveData || false; },

  getOptimalVideoConstraints() {
    const level = this._currentLevel;
    if (level === 'excellent') return { width: 1280, height: 720, frameRate: 30 };
    if (level === 'good') return { width: 640, height: 480, frameRate: 24 };
    if (level === 'fair') return { width: 480, height: 360, frameRate: 15 };
    if (level === 'poor' || level === 'save-data') return { width: 320, height: 240, frameRate: 10 };
    return { width: 640, height: 480, frameRate: 24 };
  },

  on(event, fn) { this._listeners.push({ event, fn }); },
  off(event, fn) { this._listeners = this._listeners.filter(l => !(l.event === event && l.fn === fn)); },
  _emit(event, data) { this._listeners.filter(l => l.event === event).forEach(l => { try { l.fn(data); } catch (_) {} }); },

  destroy() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._listeners = [];
  }
};

window.NetworkQuality = NetworkQuality;
