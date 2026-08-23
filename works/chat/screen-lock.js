/**
 * Screen Lock — WhatsApp-style app lock with biometric & PIN.
 * Provides lock screen, auto-lock, and content hiding.
 */
window.ScreenLock = (function () {
  'use strict';

  /* ─── IndexedDB ────────────────────────────────────────────────── */
  const DB_NAME = 'nsl_screen_lock';
  const DB_VERSION = 1;
  const STORE_NAME = 'lock_data';
  let _db = null;

  function _openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  async function _dbGet(key) {
    var db = await _openDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readonly');
      var req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function _dbPut(key, value) {
    var db = await _openDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      var req = tx.objectStore(STORE_NAME).put(value, key);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function _dbDelete(key) {
    var db = await _openDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      var req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /* ─── Crypto helpers ───────────────────────────────────────────── */
  async function _sha256(str) {
    var enc = new TextEncoder();
    var buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  async function _getDeviceKey() {
    try {
      if (window.Security && typeof Security.getDeviceKey === 'function') {
        return await Security.getDeviceKey();
      }
    } catch (_) {}
    return 'nsl_default_device_key';
  }

  async function _encryptPin(pin) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var saltHex = Array.from(salt).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    var deviceKey = await _getDeviceKey();
    var hash = await _sha256(saltHex + pin + deviceKey);
    return { hash: hash, salt: saltHex };
  }

  async function _verifyPinHash(pin, stored) {
    var deviceKey = await _getDeviceKey();
    var hash = await _sha256(stored.salt + pin + deviceKey);
    return hash === stored.hash;
  }

  /* ─── State ─────────────────────────────────────────────────────── */
  var _locked = false;
  var _unlockCallbacks = [];
  var _autoLockTimer = null;
  var _lockOverlay = null;
  var _settings = null;
  var _currentPinEntry = '';
  var _failedAttempts = 0;
  var _cooldownTimer = null;
  var _cooldownEnd = 0;
  var _activityHandlers = null;
  var _visibilityHandler = null;

  var DEFAULT_SETTINGS = {
    enabled: false,
    method: 'pin',
    autoLockTime: null,
    showContent: true,
    showPreview: true
  };

  var AUTO_LOCK_OPTIONS = [
    { label: 'Immediately', value: 0 },
    { label: 'After 1 minute', value: 60 * 1000 },
    { label: 'After 5 minutes', value: 5 * 60 * 1000 },
    { label: 'After 15 minutes', value: 15 * 60 * 1000 },
    { label: 'After 30 minutes', value: 30 * 60 * 1000 },
    { label: 'After 1 hour', value: 60 * 60 * 1000 }
  ];

  /* ─── Settings ──────────────────────────────────────────────────── */
  async function getSettings() {
    try {
      var stored = await _dbGet('settings');
      _settings = Object.assign({}, DEFAULT_SETTINGS, stored || {});
    } catch (e) {
      if (window.__DEBUG__) console.warn('[ScreenLock] getSettings error:', e);
      _settings = Object.assign({}, DEFAULT_SETTINGS);
    }
    return Object.assign({}, _settings);
  }

  async function updateSettings(settings) {
    try {
      _settings = Object.assign({}, _settings || DEFAULT_SETTINGS, settings);
      await _dbPut('settings', _settings);
      if (window.__DEBUG__) console.log('[ScreenLock] Settings updated:', _settings);
      if (_settings.enabled) { startAutoLock(); } else { stopAutoLock(); }
    } catch (e) {
      if (window.__DEBUG__) console.error('[ScreenLock] updateSettings error:', e);
      throw e;
    }
  }

  /* ─── Biometric Authentication ─────────────────────────────────── */
  async function checkBiometricSupport() {
    try {
      if (!window.PublicKeyCredential) return false;
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) {
      if (window.__DEBUG__) console.warn('[ScreenLock] Biometric check failed:', e);
      return false;
    }
  }

  async function authenticateWithBiometric(reason) {
    try {
      if (!await checkBiometricSupport()) throw new Error('Biometric not available');

      var challenge = crypto.getRandomValues(new Uint8Array(32));
      var userId = crypto.getRandomValues(new Uint8Array(16));

      var credential = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: 'required',
          allowCredentials: []
        }
      });

      if (window.__DEBUG__) console.log('[ScreenLock] Biometric auth success');
      return !!credential;
    } catch (e) {
      if (window.__DEBUG__) console.warn('[ScreenLock] Biometric auth failed:', e);
      return false;
    }
  }

  /* ─── PIN Lock ──────────────────────────────────────────────────── */
  async function setPin(pin) {
    if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
      throw new Error('PIN must be 4-8 digits');
    }
    var encrypted = await _encryptPin(pin);
    await _dbPut('pin', encrypted);
    if (window.__DEBUG__) console.log('[ScreenLock] PIN set');
  }

  async function verifyPin(pin) {
    if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) return false;
    var stored = await _dbGet('pin');
    if (!stored) return false;
    return await _verifyPinHash(pin, stored);
  }

  async function clearPin() {
    await _dbDelete('pin');
    if (window.__DEBUG__) console.log('[ScreenLock] PIN cleared');
  }

  async function hasPin() {
    var stored = await _dbGet('pin');
    return !!stored;
  }

  /* ─── Lock State ────────────────────────────────────────────────── */
  function isLocked() { return _locked; }

  function lock() {
    if (_locked) return;
    _locked = true;
    stopAutoLock();
    if (window.__DEBUG__) console.log('[ScreenLock] App locked');
    _showLockScreen();
  }

  function unlock() {
    if (!_locked) return;
    _locked = false;
    _hideLockScreen();
    resetAutoLock();
    if (window.__DEBUG__) console.log('[ScreenLock] App unlocked');
    _unlockCallbacks.forEach(function (cb) {
      try { cb(); } catch (e) { if (window.__DEBUG__) console.warn('[ScreenLock] Unlock callback error:', e); }
    });
  }

  function onUnlock(callback) {
    if (typeof callback === 'function') _unlockCallbacks.push(callback);
  }

  /* ─── Content Hiding ────────────────────────────────────────────── */
  function shouldHideContent() {
    if (!_settings || !_settings.enabled) return false;
    return !_settings.showContent;
  }

  function shouldHidePreview() {
    if (!_settings || !_settings.enabled) return false;
    return !_settings.showPreview;
  }

  /* ─── Auto-lock ─────────────────────────────────────────────────── */
  function startAutoLock() {
    stopAutoLock();
    if (!_settings || !_settings.enabled || !_settings.autoLockTime) return;

    var timeout = _settings.autoLockTime;
    if (timeout === 0) { lock(); return; }

    _autoLockTimer = setTimeout(function () { lock(); }, timeout);

    if (!_activityHandlers) {
      _activityHandlers = function () { resetAutoLock(); };
      ['touchstart', 'keydown', 'mousedown', 'scroll'].forEach(function (evt) {
        document.addEventListener(evt, _activityHandlers, { passive: true });
      });
    }
  }

  function resetAutoLock() {
    if (!_settings || !_settings.enabled || !_settings.autoLockTime) return;
    if (_autoLockTimer) clearTimeout(_autoLockTimer);
    var timeout = _settings.autoLockTime;
    if (timeout === 0) return;
    _autoLockTimer = setTimeout(function () { lock(); }, timeout);
  }

  function stopAutoLock() {
    if (_autoLockTimer) { clearTimeout(_autoLockTimer); _autoLockTimer = null; }
    if (_activityHandlers) {
      ['touchstart', 'keydown', 'mousedown', 'scroll'].forEach(function (evt) {
        document.removeEventListener(evt, _activityHandlers);
      });
      _activityHandlers = null;
    }
  }

  /* ─── Visibility change (lock on background) ───────────────────── */
  function _onVisibilityChange() {
    if (document.hidden && _settings && _settings.enabled && _settings.autoLockTime === 0) {
      lock();
    }
  }

  /* ─── Lock Screen UI ────────────────────────────────────────────── */
  function _injectStyles() {
    if (document.getElementById('screen-lock-css')) return;
    var s = document.createElement('style');
    s.id = 'screen-lock-css';
    s.textContent = `
      @keyframes sl-shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-12px); }
        40% { transform: translateX(10px); }
        60% { transform: translateX(-8px); }
        80% { transform: translateX(6px); }
      }
      .sl-shake { animation: sl-shake 0.4s ease; }
      @keyframes sl-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes sl-fade-out { from { opacity: 1; } to { opacity: 0; } }
    `;
    document.head.appendChild(s);
  }

  function _showLockScreen() {
    _hideLockScreen();
    _injectStyles();
    _currentPinEntry = '';
    _failedAttempts = 0;

    var settings = _settings || DEFAULT_SETTINGS;
    var showBiometric = (settings.method === 'biometric' || settings.method === 'both');

    var overlay = document.createElement('div');
    overlay.id = 'screen-lock-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#111b21;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:sl-fade-in 0.25s ease;user-select:none;';

    overlay.innerHTML = _buildLockScreenHTML(showBiometric);
    document.body.appendChild(overlay);
    _lockOverlay = overlay;

    _attachLockScreenEvents(overlay, showBiometric);

    if (showBiometric) {
      setTimeout(function () { _tryBiometric(overlay, showBiometric); }, 500);
    }
  }

  function _buildLockScreenHTML(showBiometric) {
    var biometricSection = '';
    if (showBiometric) {
      biometricSection = `
        <div class="sl-biometric-area" style="margin-bottom:24px;">
          <div style="width:64px;height:64px;border-radius:50%;background:rgba(0,128,105,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#008069" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>
              <path d="M5 19.5C5.5 18 6 15 6 12c0-3.5 2.5-6 6-6 1.7 0 3.2.7 4.3 1.8"/>
              <path d="M10 12c0-1.1.9-2 2-2 .6 0 1.1.3 1.5.7"/>
              <path d="M10 18c-3.3 0-6-2.7-6-6 0-1 .3-2 .8-2.8"/>
              <path d="M18 12c0 4.4-3.6 8-8 8-1.5 0-3-.4-4.2-1.2"/>
              <circle cx="12" cy="12" r="1"/>
            </svg>
          </div>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;text-align:center;">Touch the fingerprint sensor</p>
          <button class="sl-use-pin-btn" style="background:none;border:none;color:#00a884;font-size:13px;margin-top:16px;cursor:pointer;padding:8px 16px;">Use PIN instead</button>
        </div>`;
    }

    return `
      <div style="text-align:center;margin-bottom:32px;">
        <div style="width:56px;height:56px;border-radius:50%;background:#008069;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/></svg>
        </div>
        <h2 style="color:white;font-size:20px;font-weight:600;margin:0 0 4px;">NSL Chat</h2>
        <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0;">App is locked</p>
      </div>
      ${biometricSection}
      <div class="sl-pin-section" style="display:${showBiometric ? 'none' : 'block'};width:100%;max-width:320px;padding:0 24px;">
        <div class="sl-pin-display" style="display:flex;justify-content:center;gap:12px;margin-bottom:24px;"></div>
        <p class="sl-pin-error" style="color:#ff4444;font-size:13px;text-align:center;margin-bottom:16px;min-height:18px;"></p>
        <div class="sl-keypad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;"></div>
        <button class="sl-cancel-btn" style="background:none;border:none;color:#00a884;font-size:14px;margin-top:20px;cursor:pointer;padding:8px;width:100%;display:none;">Cancel</button>
      </div>
    `;
  }

  function _attachLockScreenEvents(overlay, showBiometric) {
    var pinSection = overlay.querySelector('.sl-pin-section');
    var pinDisplay = overlay.querySelector('.sl-pin-display');
    var keypad = overlay.querySelector('.sl-keypad');
    var errorEl = overlay.querySelector('.sl-pin-error');
    var cancelBtn = overlay.querySelector('.sl-cancel-btn');
    var usePinBtn = overlay.querySelector('.sl-use-pin-btn');

    var pinLength = 4;
    if (_settings && _settings.method === 'both') pinLength = 6;

    _renderPinDots(pinDisplay, pinLength);
    _renderKeypad(keypad);

    if (usePinBtn) {
      usePinBtn.addEventListener('click', function () {
        var bioArea = overlay.querySelector('.sl-biometric-area');
        if (bioArea) bioArea.style.display = 'none';
        pinSection.style.display = 'block';
        cancelBtn.style.display = 'block';
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        pinSection.style.display = 'none';
        cancelBtn.style.display = 'none';
        var bioArea = overlay.querySelector('.sl-biometric-area');
        if (bioArea) bioArea.style.display = 'block';
        _currentPinEntry = '';
        _renderPinDots(pinDisplay, pinLength);
      });
    }

    keypad.addEventListener('click', function (e) {
      var btn = e.target.closest('.sl-key-btn');
      if (!btn) return;
      var val = btn.dataset.val;

      if (val === 'del') {
        _currentPinEntry = _currentPinEntry.slice(0, -1);
      } else if (val === 'biometric') {
        _tryBiometric(overlay, true);
        return;
      } else {
        if (_currentPinEntry.length >= pinLength) return;
        _currentPinEntry += val;
      }

      _renderPinDots(pinDisplay, pinLength);

      if (_currentPinEntry.length === pinLength) {
        _attemptPin(overlay, _currentPinEntry, pinDisplay, errorEl, pinLength);
      }
    });
  }

  function _renderPinDots(container, length) {
    var html = '';
    for (var i = 0; i < length; i++) {
      var filled = i < _currentPinEntry.length;
      html += '<div class="sl-pin-dot" style="width:14px;height:14px;border-radius:50%;border:2px solid ' + (filled ? '#008069' : 'rgba(255,255,255,0.3)') + ';background:' + (filled ? '#008069' : 'transparent') + ';transition:all 0.15s ease;"></div>';
    }
    container.innerHTML = html;
  }

  function _renderKeypad(container) {
    var keys = [
      { val: '1' }, { val: '2' }, { val: '3' },
      { val: '4' }, { val: '5' }, { val: '6' },
      { val: '7' }, { val: '8' }, { val: '9' },
      { val: '' }, { val: '0' }, { val: 'del' }
    ];
    var html = '';
    keys.forEach(function (k) {
      if (k.val === '') {
        html += '<div></div>';
      } else if (k.val === 'del') {
        html += '<button class="sl-key-btn" data-val="del" style="background:none;border:none;color:rgba(255,255,255,0.6);font-size:18px;height:52px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg></button>';
      } else {
        html += '<button class="sl-key-btn" data-val="' + k.val + '" style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.08);border:none;color:white;font-size:22px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;margin:0 auto;transition:background 0.15s;">' + k.val + '</button>';
      }
    });
    container.innerHTML = html;

    container.querySelectorAll('.sl-key-btn').forEach(function (btn) {
      btn.addEventListener('mouseenter', function () { btn.style.background = 'rgba(255,255,255,0.15)'; });
      btn.addEventListener('mouseleave', function () { btn.style.background = 'rgba(255,255,255,0.08)'; });
    });
  }

  async function _attemptPin(overlay, pin, pinDisplay, errorEl, pinLength) {
    if (_cooldownEnd > Date.now()) {
      var remaining = Math.ceil((_cooldownEnd - Date.now()) / 1000);
      errorEl.textContent = 'Try again in ' + remaining + 's';
      _currentPinEntry = '';
      _renderPinDots(pinDisplay, pinLength);
      return;
    }

    var ok = await verifyPin(pin);
    if (ok) {
      _failedAttempts = 0;
      _currentPinEntry = '';
      unlock();
    } else {
      _failedAttempts++;
      errorEl.textContent = 'Wrong PIN';
      pinDisplay.classList.add('sl-shake');
      setTimeout(function () { pinDisplay.classList.remove('sl-shake'); }, 400);

      _currentPinEntry = '';
      _renderPinDots(pinDisplay, pinLength);

      if (_failedAttempts >= 5) {
        _startCooldown(300, errorEl, pinDisplay, pinLength);
      } else if (_failedAttempts >= 3) {
        _startCooldown(30, errorEl, pinDisplay, pinLength);
      }
    }
  }

  function _startCooldown(seconds, errorEl, pinDisplay, pinLength) {
    _cooldownEnd = Date.now() + seconds * 1000;
    var remaining = seconds;
    errorEl.textContent = 'Try again in ' + remaining + 's';
    _cooldownTimer = setInterval(function () {
      remaining--;
      if (remaining <= 0) {
        clearInterval(_cooldownTimer);
        _cooldownTimer = null;
        errorEl.textContent = '';
      } else {
        errorEl.textContent = 'Try again in ' + remaining + 's';
      }
    }, 1000);
  }

  async function _tryBiometric(overlay, showBiometric) {
    if (!showBiometric) return;
    var result = await authenticateWithBiometric('Unlock NSL Chat');
    if (result) unlock();
  }

  function _hideLockScreen() {
    if (_lockOverlay) {
      _lockOverlay.style.animation = 'sl-fade-out 0.2s ease';
      var el = _lockOverlay;
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
      _lockOverlay = null;
    }
    if (_cooldownTimer) { clearInterval(_cooldownTimer); _cooldownTimer = null; }
    _cooldownEnd = 0;
  }

  /* ─── Settings UI (WhatsApp-style) ──────────────────────────────── */
  async function openLockSettings() {
    var settings = await getSettings();
    var biometricAvail = await checkBiometricSupport();
    var hasPinSet = await hasPin();

    var modal = document.createElement('div');
    modal.id = 'screen-lock-settings-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;animation:sl-fade-in 0.2s ease;';

    var autoLockOptionsHtml = AUTO_LOCK_OPTIONS.map(function (opt) {
      var selected = settings.autoLockTime === opt.value;
      return '<div class="sl-opt" data-val="' + opt.value + '" style="padding:12px 16px;cursor:pointer;border-radius:8px;background:' + (selected ? 'rgba(0,128,105,0.15)' : 'transparent') + ';color:' + (selected ? '#00a884' : 'rgba(255,255,255,0.8)') + ';font-size:14px;display:flex;align-items:center;gap:12px;">' +
        '<div style="width:18px;height:18px;border-radius:50%;border:2px solid ' + (selected ? '#00a884' : 'rgba(255,255,255,0.3)') + ';display:flex;align-items:center;justify-content:center;">' +
        (selected ? '<div style="width:10px;height:10px;border-radius:50%;background:#00a884;"></div>' : '') +
        '</div>' + opt.label + '</div>';
    }).join('');

    var methodOptionsHtml = [
      { val: 'biometric', label: 'Biometric', avail: biometricAvail },
      { val: 'pin', label: 'PIN', avail: true },
      { val: 'both', label: 'Both', avail: biometricAvail }
    ].filter(function (m) { return m.avail; }).map(function (m) {
      var selected = settings.method === m.val;
      return '<div class="sl-method-opt" data-val="' + m.val + '" style="padding:12px 16px;cursor:pointer;border-radius:8px;background:' + (selected ? 'rgba(0,128,105,0.15)' : 'transparent') + ';color:' + (selected ? '#00a884' : 'rgba(255,255,255,0.8)') + ';font-size:14px;display:flex;align-items:center;gap:12px;">' +
        '<div style="width:18px;height:18px;border-radius:50%;border:2px solid ' + (selected ? '#00a884' : 'rgba(255,255,255,0.3)') + ';display:flex;align-items:center;justify-content:center;">' +
        (selected ? '<div style="width:10px;height:10px;border-radius:50%;background:#00a884;"></div>' : '') +
        '</div>' + m.label + '</div>';
    }).join('');

    modal.innerHTML = `
      <div style="background:#1f2c34;border-radius:16px;width:100%;max-width:360px;max-height:85vh;overflow-y:auto;padding:0;">
        <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:12px;">
          <button id="sl-settings-back" style="background:none;border:none;color:rgba(255,255,255,0.7);cursor:pointer;padding:4px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5m7-7l-7 7 7 7"/></svg>
          </button>
          <h3 style="color:white;font-size:16px;font-weight:600;margin:0;">Screen lock</h3>
        </div>

        <div style="padding:16px 20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div>
              <p style="color:white;font-size:14px;margin:0;">Require authentication</p>
              <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:4px 0 0;">Lock app when closed or in background</p>
            </div>
            <button id="sl-toggle-enabled" style="width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:background 0.2s;background:${settings.enabled ? '#00a884' : 'rgba(255,255,255,0.15)'};">
              <div style="width:20px;height:20px;border-radius:50%;background:white;position:absolute;top:2px;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3);left:${settings.enabled ? '22px' : '2px'};"></div>
            </button>
          </div>

          <div id="sl-method-section" style="display:${settings.enabled ? 'block' : 'none'};">
            <p style="color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:16px 0 8px;">Lock method</p>
            <div id="sl-method-options">${methodOptionsHtml}</div>

            <p style="color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:16px 0 8px;">Auto-lock</p>
            <div id="sl-autolock-options">${autoLockOptionsHtml}</div>

            ${hasPinSet ? '<button id="sl-change-pin" style="background:none;border:none;color:#00a884;font-size:14px;padding:12px 0;cursor:pointer;width:100%;text-align:left;">Change PIN</button>' : '<button id="sl-set-pin" style="background:none;border:none;color:#00a884;font-size:14px;padding:12px 0;cursor:pointer;width:100%;text-align:left;">Set PIN</button>'}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    var enabled = settings.enabled;
    var method = settings.method;
    var autoLockTime = settings.autoLockTime;

    modal.querySelector('#sl-settings-back').addEventListener('click', function () {
      modal.remove();
    });

    modal.querySelector('#sl-toggle-enabled').addEventListener('click', async function () {
      enabled = !enabled;
      this.style.background = enabled ? '#00a884' : 'rgba(255,255,255,0.15)';
      this.querySelector('div').style.left = enabled ? '22px' : '2px';
      modal.querySelector('#sl-method-section').style.display = enabled ? 'block' : 'none';
      await updateSettings({ enabled: enabled });
    });

    modal.querySelectorAll('.sl-method-opt').forEach(function (el) {
      el.addEventListener('click', async function () {
        method = this.dataset.val;
        modal.querySelectorAll('.sl-method-opt').forEach(function (m) {
          var sel = m.dataset.val === method;
          m.style.background = sel ? 'rgba(0,128,105,0.15)' : 'transparent';
          m.style.color = sel ? '#00a884' : 'rgba(255,255,255,0.8)';
          m.querySelector('div').style.borderColor = sel ? '#00a884' : 'rgba(255,255,255,0.3)';
          m.querySelector('div').innerHTML = sel ? '<div style="width:10px;height:10px;border-radius:50%;background:#00a884;"></div>' : '';
        });
        await updateSettings({ method: method });
      });
    });

    modal.querySelectorAll('.sl-opt').forEach(function (el) {
      el.addEventListener('click', async function () {
        autoLockTime = parseInt(this.dataset.val, 10);
        modal.querySelectorAll('.sl-opt').forEach(function (o) {
          var sel = parseInt(o.dataset.val, 10) === autoLockTime;
          o.style.background = sel ? 'rgba(0,128,105,0.15)' : 'transparent';
          o.style.color = sel ? '#00a884' : 'rgba(255,255,255,0.8)';
          o.querySelector('div').style.borderColor = sel ? '#00a884' : 'rgba(255,255,255,0.3)';
          o.querySelector('div').innerHTML = sel ? '<div style="width:10px;height:10px;border-radius:50%;background:#00a884;"></div>' : '';
        });
        await updateSettings({ autoLockTime: autoLockTime });
      });
    });

    var changePinBtn = modal.querySelector('#sl-change-pin') || modal.querySelector('#sl-set-pin');
    if (changePinBtn) {
      changePinBtn.addEventListener('click', function () { _showPinSetupModal(modal); });
    }
  }

  function _showPinSetupModal(parentModal) {
    var pinModal = document.createElement('div');
    pinModal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;animation:sl-fade-in 0.2s ease;';

    var enteredPin = '';
    var step = 'enter';
    var firstPin = '';

    function render() {
      var title = step === 'enter' ? 'Enter new PIN' : 'Confirm PIN';
      var dots = '';
      for (var i = 0; i < 4; i++) {
        var filled = i < enteredPin.length;
        dots += '<div style="width:14px;height:14px;border-radius:50%;border:2px solid ' + (filled ? '#008069' : 'rgba(255,255,255,0.3)') + ';background:' + (filled ? '#008069' : 'transparent') + ';transition:all 0.15s;"></div>';
      }

      pinModal.innerHTML = `
        <div style="background:#1f2c34;border-radius:16px;width:100%;max-width:320px;padding:24px;text-align:center;">
          <h3 style="color:white;font-size:16px;font-weight:600;margin:0 0 20px;">${title}</h3>
          <div style="display:flex;justify-content:center;gap:12px;margin-bottom:8px;" class="sl-setup-dots">${dots}</div>
          <p class="sl-setup-error" style="color:#ff4444;font-size:13px;min-height:18px;margin-bottom:16px;"></p>
          <div class="sl-setup-keypad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;"></div>
          <button class="sl-setup-cancel" style="background:none;border:none;color:#00a884;font-size:14px;margin-top:16px;cursor:pointer;width:100%;">Cancel</button>
        </div>
      `;

      var kpad = pinModal.querySelector('.sl-setup-keypad');
      ['1','2','3','4','5','6','7','8','9','','0','del'].forEach(function (k) {
        if (k === '') { kpad.appendChild(document.createElement('div')); return; }
        var btn = document.createElement('button');
        btn.textContent = k === 'del' ? '⌫' : k;
        btn.dataset.val = k;
        btn.style.cssText = 'width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.08);border:none;color:white;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;margin:0 auto;';
        btn.addEventListener('click', function () {
          if (k === 'del') { enteredPin = enteredPin.slice(0, -1); }
          else { if (enteredPin.length < 4) enteredPin += k; }
          render();
          if (enteredPin.length === 4) _handlePinStep();
        });
        kpad.appendChild(btn);
      });

      pinModal.querySelector('.sl-setup-cancel').addEventListener('click', function () {
        pinModal.remove();
      });
    }

    async function _handlePinStep() {
      if (step === 'enter') {
        firstPin = enteredPin;
        enteredPin = '';
        step = 'confirm';
        render();
      } else {
        if (enteredPin === firstPin) {
          await setPin(enteredPin);
          if (typeof showToast === 'function') showToast('PIN set successfully', 'success');
          pinModal.remove();
        } else {
          enteredPin = '';
          step = 'enter';
          firstPin = '';
          var err = pinModal.querySelector('.sl-setup-error');
          if (err) err.textContent = 'PINs do not match';
          render();
        }
      }
    }

    render();
    document.body.appendChild(pinModal);
  }

  /* ─── Init ──────────────────────────────────────────────────────── */
  async function init() {
    await getSettings();
    _visibilityHandler = _onVisibilityChange;
    document.addEventListener('visibilitychange', _visibilityHandler);

    if (_settings.enabled) {
      if (_settings.autoLockTime === 0) {
        lock();
      } else {
        startAutoLock();
      }
    }

    if (window.__DEBUG__) console.log('[ScreenLock] Initialized:', _settings);
  }

  function destroy() {
    stopAutoLock();
    _hideLockScreen();
    if (_visibilityHandler) {
      document.removeEventListener('visibilitychange', _visibilityHandler);
      _visibilityHandler = null;
    }
    _unlockCallbacks = [];
    if (window.__DEBUG__) console.log('[ScreenLock] Destroyed');
  }

  /* ─── Public API ────────────────────────────────────────────────── */
  return {
    init: init,
    destroy: destroy,
    checkBiometricSupport: checkBiometricSupport,
    authenticateWithBiometric: authenticateWithBiometric,
    setPin: setPin,
    verifyPin: verifyPin,
    clearPin: clearPin,
    getSettings: getSettings,
    updateSettings: updateSettings,
    isLocked: isLocked,
    lock: lock,
    unlock: unlock,
    onUnlock: onUnlock,
    shouldHideContent: shouldHideContent,
    shouldHidePreview: shouldHidePreview,
    startAutoLock: startAutoLock,
    resetAutoLock: resetAutoLock,
    stopAutoLock: stopAutoLock,
    openLockSettings: openLockSettings,
    AUTO_LOCK_OPTIONS: AUTO_LOCK_OPTIONS
  };
})();
