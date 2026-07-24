'use strict';
(function () {
  var STORAGE_KEY = 'nsl_app_lock';
  var ATTEMPTS_KEY = 'nsl_app_lock_attempts';
  var LOCKOUT_KEY = 'nsl_app_lock_lockout';
  var SKIP_KEY = 'nsl_app_lock_skip_until';
  var SESSION_KEY = 'nsl_app_lock_session';
  var MAX_ATTEMPTS = 5;
  var LOCKOUT_MS = 30000;
  var SESSION_TIMEOUT_MS = 300000;
  var SKIP_DURATION_MS = 900000;

  var _activeOverlay = null;
  var _sessionTimer = null;
  var _inactivityTimer = null;
  var _inactivityHandlers = [];

  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  var _db = function() { return App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };

  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };

  function _getSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function _saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  function isAppLockEnabled() {
    var settings = _getSettings();
    return !!(settings.enabled && settings.pinHash);
  }

  function _checkRateLimit() {
    var lockoutUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0');
    if (Date.now() < lockoutUntil) {
      var remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      return { blocked: true, remaining: remaining };
    }
    return { blocked: false, remaining: 0 };
  }

  function _recordFailedAttempt() {
    var attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0') + 1;
    localStorage.setItem(ATTEMPTS_KEY, attempts.toString());
    if (attempts >= MAX_ATTEMPTS) {
      localStorage.setItem(LOCKOUT_KEY, (Date.now() + LOCKOUT_MS).toString());
      localStorage.setItem(ATTEMPTS_KEY, '0');
    }
    return attempts;
  }

  function _clearAttempts() {
    localStorage.setItem(ATTEMPTS_KEY, '0');
    localStorage.removeItem(LOCKOUT_KEY);
  }

  function _getAttemptCount() {
    return parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0');
  }

  async function _hashPin(pin) {
    var enc = new TextEncoder();
    var settings = _getSettings();
    var salt = settings.pinSalt || '';
    if (!salt) {
      var saltArr = crypto.getRandomValues(new Uint8Array(16));
      salt = Array.from(saltArr).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      settings.pinSalt = salt;
      _saveSettings(settings);
    }
    var saltBytes = Uint8Array.from(salt.match(/.{2}/g).map(function(b) { return parseInt(b, 16); }));
    var keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    return Array.from(new Uint8Array(bits)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function _ensureStyles() {
    if (document.getElementById('nsl-app-lock-style')) return;
    var s = document.createElement('style');
    s.id = 'nsl-app-lock-style';
    s.textContent =
      '.nsl-al-overlay{position:fixed;inset:0;z-index:99999;background:var(--background,#1a1a2e);display:flex;flex-direction:column;align-items:center;justify-content:center;animation:nslAlFadeIn .3s ease}' +
      '@keyframes nslAlFadeIn{from{opacity:0}to{opacity:1}}' +
      '@keyframes nslAlShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-12px)}40%{transform:translateX(12px)}60%{transform:translateX(-8px)}80%{transform:translateX(8px)}}' +
      '.nsl-al-shake{animation:nslAlShake .4s ease}' +
      '.nsl-al-icon{font-size:48px;margin-bottom:16px}' +
      '.nsl-al-title{font-size:20px;font-weight:600;color:var(--on-surface,#fff);margin-bottom:6px}' +
      '.nsl-al-subtitle{font-size:13px;color:var(--on-surface-variant,#aaa);margin-bottom:32px}' +
      '.nsl-al-dots{display:flex;gap:12px;margin-bottom:24px}' +
      '.nsl-al-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--on-surface-variant,#aaa);transition:all .2s}' +
      '.nsl-al-dot.filled{background:var(--primary,#6750A4);border-color:var(--primary,#6750A4)}' +
      '.nsl-al-dot.error{background:var(--error,#B3261E);border-color:var(--error,#B3261E)}' +
      '.nsl-al-keypad{display:grid;grid-template-columns:repeat(3,72px);gap:12px}' +
      '.nsl-al-key{width:72px;height:72px;border-radius:50%;border:1px solid var(--outline-variant,#444);background:transparent;color:var(--on-surface,#fff);font-size:24px;font-weight:500;cursor:pointer;transition:all .12s;display:flex;align-items:center;justify-content:center}' +
      '.nsl-al-key:hover{background:var(--surface-variant,#333)}' +
      '.nsl-al-key:active{transform:scale(0.95)}' +
      '.nsl-al-key.special{border:none;background:transparent;font-size:14px}' +
      '.nsl-al-key.special:hover{background:transparent}' +
      '.nsl-al-bio{margin-top:20px;padding:10px 24px;border:1px solid var(--outline-variant,#444);border-radius:12px;background:transparent;color:var(--on-surface,#fff);font-size:13px;cursor:pointer;transition:all .12s}' +
      '.nsl-al-bio:hover{background:var(--surface-variant,#333)}' +
      '.nsl-al-error{font-size:12px;color:var(--error,#B3261E);margin-top:12px;min-height:16px}' +
      '.nsl-al-cooldown{font-size:13px;color:var(--error,#B3261E);margin-top:12px}' +
      '.nsl-al-setup-dots{display:flex;gap:12px;margin-bottom:8px}' +
      '.nsl-al-setup-label{font-size:12px;color:var(--on-surface-variant,#aaa);margin-bottom:24px;min-height:16px}';
    document.head.appendChild(s);
  }

  function _removeOverlay() {
    if (_activeOverlay) {
      _activeOverlay.remove();
      _activeOverlay = null;
    }
  }

  function _renderDots(container, count, max, error) {
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < max; i++) {
      var dot = document.createElement('div');
      dot.className = 'nsl-al-dot';
      if (i < count) dot.classList.add(error ? 'error' : 'filled');
      container.appendChild(dot);
    }
  }

  function _shakeElement(el) {
    if (!el) return;
    el.classList.remove('nsl-al-shake');
    void el.offsetWidth;
    el.classList.add('nsl-al-shake');
  }

  async function _verifyAndUnlock(pin) {
    var settings = _getSettings();

    // Server-side verification via Cloud Function (secure, rate-limited)
    try {
      if (typeof firebase !== 'undefined' && firebase.functions) {
        var functions = firebase.functions('us-central1');
        var verifyAppLockPin = functions.httpsCallable('verifyAppLockPin');
        var result = await verifyAppLockPin({ pin: pin });
        if (result && result.data && result.data.ok) {
          // Sync hash to localStorage for fast path
          var hash = await _hashPin(pin);
          settings.pinHash = hash;
          settings.enabled = true;
          _saveSettings(settings);
          return true;
        }
      }
    } catch (err) {
      // If Cloud Function not deployed or fails, fall back to client-side check
      console.warn('App lock server verification failed, falling back to local:', err.message);
    }

    // Fallback: client-side hash comparison (for offline or if Cloud Function not deployed)
    var hash = await _hashPin(pin);

    // 1. Check local hash first (fast path)
    if (settings.pinHash && hash === settings.pinHash) return true;

    // 2. Check Firestore hash (handles localStorage cleared / cross-device)
    var d = _db();
    var uid = _uid();
    if (d && uid) {
      try {
        var userDoc = await d.collection('users').doc(uid).get();
        if (userDoc.exists) {
          var data = userDoc.data();
          if (data.appLockEnabled && data.appLockPinHash) {
            if (hash === data.appLockPinHash) {
              // Sync back to localStorage
              settings.pinHash = data.appLockPinHash;
              settings.pinSalt = settings.pinSalt || '';
              settings.enabled = true;
              _saveSettings(settings);
              return true;
            }
          }
        }
      } catch (_) {}
    }

    return false;
  }

  function _startInactivityTimer() {
    _clearInactivityTimer();
    _inactivityTimer = setTimeout(function () {
      if (isAppLockEnabled() && !_activeOverlay) {
        showAppLock();
      }
    }, SESSION_TIMEOUT_MS);

    // Remove old listeners first to prevent accumulation
    _inactivityHandlers.forEach(function (h) {
      try { document.removeEventListener(h.evt, h.fn, { passive: true }); } catch (_) {}
    });
    _inactivityHandlers = [];

    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(function (evt) {
      var handler = function resetInactivity() {
        clearTimeout(_inactivityTimer);
        _inactivityTimer = setTimeout(function () {
          if (isAppLockEnabled() && !_activeOverlay) {
            showAppLock();
          }
        }, SESSION_TIMEOUT_MS);
      };
      document.addEventListener(evt, handler, { passive: true });
      _inactivityHandlers.push({ evt: evt, fn: handler });
    });
  }

  function _clearInactivityTimer() {
    if (_inactivityTimer) {
      clearTimeout(_inactivityTimer);
      _inactivityTimer = null;
    }
    _inactivityHandlers.forEach(function (h) {
      try { document.removeEventListener(h.evt, h.fn, { passive: true }); } catch (_) {}
    });
    _inactivityHandlers = [];
  }

  function _skipLockForSession() {
    try {
      localStorage.setItem(SKIP_KEY, (Date.now() + SKIP_DURATION_MS).toString());
    } catch (_) {}
  }

  function _isInSkipWindow() {
    try {
      var until = parseInt(localStorage.getItem(SKIP_KEY) || '0');
      return Date.now() < until;
    } catch (_) {
      return false;
    }
  }

  function _isWithinSession() {
    try {
      var lastActive = parseInt(localStorage.getItem(SESSION_KEY) || '0');
      return Date.now() - lastActive < SESSION_TIMEOUT_MS;
    } catch (_) {
      return false;
    }
  }

  function _updateSession() {
    try {
      localStorage.setItem(SESSION_KEY, Date.now().toString());
    } catch (_) {}
  }

  async function showAppLock() {
    if (!isAppLockEnabled()) return;
    if (_activeOverlay) return;
    if (_isInSkipWindow()) return;
    if (_isWithinSession()) {
      _updateSession();
      _startInactivityTimer();
      return;
    }

    _ensureStyles();
    _updateSession();

    var overlay = document.createElement('div');
    overlay.className = 'nsl-al-overlay';

    var entered = '';
    var maxLen = 6;
    var hasBio = false;

    try {
      if (window.PublicKeyCredential) {
        var available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        hasBio = available;
      }
    } catch (_) {}

    overlay.innerHTML =
      '<div class="nsl-al-icon">🔒</div>' +
      '<div class="nsl-al-title">App Locked</div>' +
      '<div class="nsl-al-subtitle">Enter your PIN to unlock</div>' +
      '<div class="nsl-al-dots" id="nsl-al-dots"></div>' +
      '<div class="nsl-al-keypad" id="nsl-al-keypad"></div>' +
      '<div class="nsl-al-error" id="nsl-al-error"></div>' +
      (hasBio ? '<button class="nsl-al-bio" id="nsl-al-bio">Use Fingerprint</button>' : '');

    document.body.appendChild(overlay);
    _activeOverlay = overlay;

    var dotsContainer = overlay.querySelector('#nsl-al-dots');
    var keypad = overlay.querySelector('#nsl-al-keypad');
    var errorEl = overlay.querySelector('#nsl-al-error');

    _renderDots(dotsContainer, 0, 4, false);

    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    keys.forEach(function (key) {
      var btn = document.createElement('button');
      btn.className = 'nsl-al-key';
      if (key === '') {
        btn.classList.add('special');
        btn.style.visibility = 'hidden';
      } else if (key === '⌫') {
        btn.classList.add('special');
        btn.textContent = '⌫';
        btn.onclick = function () {
          entered = entered.slice(0, -1);
          _renderDots(dotsContainer, entered.length, 4, false);
          errorEl.textContent = '';
        };
      } else {
        btn.textContent = key;
        btn.onclick = function () {
          if (entered.length >= maxLen) return;
          entered += key;
          _renderDots(dotsContainer, entered.length, 4, false);

          if (entered.length >= 4) {
            _attemptVerify(entered);
          }
        };
      }
      keypad.appendChild(btn);
    });

    async function _attemptVerify(pin) {
      var rateLimit = _checkRateLimit();
      if (rateLimit.blocked) {
        errorEl.textContent = 'Too many attempts. Wait ' + rateLimit.remaining + 's';
        _shakeElement(dotsContainer);
        entered = '';
        _renderDots(dotsContainer, 0, 4, false);
        return;
      }

      var valid = await _verifyAndUnlock(pin);
      if (valid) {
        _clearAttempts();
        _skipLockForSession();
        _updateSession();
        _removeOverlay();
        _startInactivityTimer();
        window.appUnlockedForSession = true;
        if (typeof showToast === 'function') showToast('App unlocked', 'success');
      } else {
        var attempts = _recordFailedAttempt();
        errorEl.textContent = 'Incorrect PIN';
        _shakeElement(dotsContainer);
        _renderDots(dotsContainer, 0, 4, true);
        entered = '';

        setTimeout(function () {
          _renderDots(dotsContainer, 0, 4, false);
          errorEl.textContent = '';
        }, 800);
      }
    }

    var bioBtn = overlay.querySelector('#nsl-al-bio');
    if (bioBtn) {
      bioBtn.onclick = async function () {
        try {
          var challenge = new Uint8Array(32);
          crypto.getRandomValues(challenge);

          var cred = await navigator.credentials.get({
            publicKey: {
              challenge: challenge,
              timeout: 60000,
              userVerification: 'required'
            }
          });

          if (cred) {
            _clearAttempts();
            _skipLockForSession();
            _updateSession();
            _removeOverlay();
            _startInactivityTimer();
            window.appUnlockedForSession = true;
            if (typeof showToast === 'function') showToast('App unlocked', 'success');
          }
        } catch (err) {
          errorEl.textContent = 'Biometric verification failed';
        }
      };
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) e.stopPropagation();
    });
  }

  async function verifyAppLockPin(pin) {
    if (!pin || pin.length < 4) {
      if (typeof showToast === 'function') showToast('PIN must be at least 4 digits', 'error');
      return false;
    }

    var rateLimit = _checkRateLimit();
    if (rateLimit.blocked) {
      if (typeof showToast === 'function') showToast('Too many attempts. Wait ' + rateLimit.remaining + 's', 'error');
      return false;
    }

    var valid = await _verifyAndUnlock(pin);
    if (valid) {
      _clearAttempts();
      _updateSession();
      return true;
    } else {
      _recordFailedAttempt();
      return false;
    }
  }

  async function setAppLockPin(pin) {
    if (!pin || pin.length < 4 || pin.length > 6) {
      if (typeof showToast === 'function') showToast('PIN must be 4-6 digits', 'error');
      return false;
    }

    try {
      // Server-side PIN storage via Cloud Function (secure hashing)
      try {
        if (typeof firebase !== 'undefined' && firebase.functions) {
          var functions = firebase.functions('us-central1');
          var setAppLockPinFn = functions.httpsCallable('setAppLockPin');
          var result = await setAppLockPinFn({ pin: pin });
          if (result && result.data && result.data.ok) {
            // Store local hash for fast path
            var hash = await _hashPin(pin);
            var settings = _getSettings();
            settings.pinHash = hash;
            settings.enabled = true;
            _saveSettings(settings);
            if (typeof showToast === 'function') showToast('App lock PIN set', 'success');
            return true;
          }
        }
      } catch (fnErr) {
        console.warn('App lock server set failed, using local only:', fnErr.message);
      }

      // Fallback: client-side only (if Cloud Function not deployed)
      var hash = await _hashPin(pin);
      var settings = _getSettings();
      settings.pinHash = hash;
      settings.pinSalt = settings.pinSalt || '';
      _saveSettings(settings);

      var d = _db();
      var uid = _uid();
      if (d && uid) {
        await d.collection('users').doc(uid).update({
          appLockEnabled: true,
          appLockPinHash: hash
        }).catch(function () {});
      }

      if (typeof showToast === 'function') showToast('App lock PIN set', 'success');
      return true;
    } catch (err) {
      console.error('Set app lock PIN error:', err);
      if (typeof showToast === 'function') showToast('Failed to set PIN', 'error');
      return false;
    }
  }

  async function resetAppLockPin() {
    var settings = _getSettings();
    delete settings.pinHash;
    delete settings.pinSalt;
    settings.enabled = false;
    _saveSettings(settings);

    _clearAttempts();
    localStorage.removeItem(SKIP_KEY);

    var d = _db();
    var uid = _uid();
    if (d && uid) {
      await d.collection('users').doc(uid).update({
        appLockEnabled: false,
        appLockPinHash: firebase.firestore.FieldValue.delete()
      }).catch(function () {});
    }

    _removeOverlay();
    _clearInactivityTimer();
    window.appUnlockedForSession = false;
    if (typeof showToast === 'function') showToast('App lock disabled', 'info');
  }

  async function toggleAppLock(enable) {
    if (enable) {
      var settings = _getSettings();
      if (!settings.pinHash) {
        if (typeof showToast === 'function') showToast('Set a PIN first to enable app lock', 'info');
        return;
      }
      settings.enabled = true;
      _saveSettings(settings);

      var d = _db();
      var uid = _uid();
      if (d && uid) {
        await d.collection('users').doc(uid).update({ appLockEnabled: true }).catch(function () {});
      }

      _startInactivityTimer();
      if (typeof showToast === 'function') showToast('App lock enabled', 'success');
    } else {
      var s2 = _getSettings();
      s2.enabled = false;
      _saveSettings(s2);

      var d2 = _db();
      var uid2 = _uid();
      if (d2 && uid2) {
        await d2.collection('users').doc(uid2).update({ appLockEnabled: false }).catch(function () {});
      }

      _removeOverlay();
      _clearInactivityTimer();
      window.appUnlockedForSession = false;
      if (typeof showToast === 'function') showToast('App lock disabled', 'info');
    }
  }

  function _initOnLoad() {
    if (isAppLockEnabled()) {
      if (!_isInSkipWindow() && !_isWithinSession()) {
        showAppLock();
      } else {
        _startInactivityTimer();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(_initOnLoad, 500);
    });
  } else {
    setTimeout(_initOnLoad, 500);
  }

  window.showAppLock = showAppLock;
  window.verifyAppLockPin = verifyAppLockPin;
  window.setAppLockPin = setAppLockPin;
  window.resetAppLockPin = resetAppLockPin;
  window.isAppLockEnabled = isAppLockEnabled;
  window.toggleAppLock = toggleAppLock;
})();
