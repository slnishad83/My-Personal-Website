// Chat Lock — fingerprint/PIN lock for specific chats
(function() {
  'use strict';

  const STORAGE_KEY = 'nsl_chat_locks';
  const PIN_HASH_KEY = 'nsl_lock_pin_hash';
  const PIN_ATTEMPTS_KEY = 'nsl_lock_pin_attempts';
  const PIN_LOCKOUT_KEY = 'nsl_lock_pin_lockout';
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 30000;

  function _getLockedChats() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(_) { return {}; }
  }

  function _saveLockedChats(locks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(locks));
    try {
      if (App.db && App.auth?.currentUser) {
        App.db.collection('users').doc(App.auth.currentUser.uid).update({ lockedChats: locks }).catch(() => {});
      }
    } catch(_) {}
  }

  async function _hashPin(pin) {
    const enc = new TextEncoder();
    const data = enc.encode('nsl_chat_lock_salt_v2:' + pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function _getStoredPinHash() {
    return localStorage.getItem(PIN_HASH_KEY) || null;
  }

  async function _setStoredPinHash(pin) {
    const hash = await _hashPin(pin);
    localStorage.setItem(PIN_HASH_KEY, hash);
  }

  function _checkRateLimit() {
    const lockoutUntil = parseInt(localStorage.getItem(PIN_LOCKOUT_KEY) || '0');
    if (Date.now() < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      showToast('Too many attempts. Try again in ' + remaining + 's', 'error');
      return false;
    }
    return true;
  }

  function _recordFailedAttempt() {
    const attempts = parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY) || '0') + 1;
    localStorage.setItem(PIN_ATTEMPTS_KEY, attempts.toString());
    if (attempts >= MAX_ATTEMPTS) {
      localStorage.setItem(PIN_LOCKOUT_KEY, (Date.now() + LOCKOUT_MS).toString());
      localStorage.setItem(PIN_ATTEMPTS_KEY, '0');
    }
  }

  function _clearAttempts() {
    localStorage.setItem(PIN_ATTEMPTS_KEY, '0');
    localStorage.removeItem(PIN_LOCKOUT_KEY);
  }

  window.isChatLocked = function(chatId) {
    const locks = _getLockedChats();
    return !!(locks[chatId] && locks[chatId].locked);
  };

  window.lockChat = function(chatId) {
    const locks = _getLockedChats();
    locks[chatId] = { locked: true, method: 'biometric_or_pin', lockedAt: Date.now() };
    _saveLockedChats(locks);
    showToast('Chat locked', 'success');
    if (typeof renderChatList === 'function') renderChatList();
  };

  window.unlockChat = function(chatId) {
    const locks = _getLockedChats();
    delete locks[chatId];
    _saveLockedChats(locks);
    showToast('Chat unlocked', 'info');
    if (typeof renderChatList === 'function') renderChatList();
  };

  window.toggleChatLock = function(chatId) {
    if (isChatLocked(chatId)) unlockChat(chatId);
    else lockChat(chatId);
  };

  window.setLockPin = async function(pin) {
    if (!pin || pin.length < 4) { showToast('PIN must be at least 4 digits', 'error'); return false; }
    await _setStoredPinHash(pin);
    showToast('Lock PIN set', 'success');
    return true;
  };

  // WebAuthn — use credentials.get() for authentication, not create() for registration
  async function _authenticateBiometric() {
    try {
      if (!window.PublicKeyCredential) return false;
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) return false;

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Use credentials.get() to VERIFY an existing biometric, not create a new one
      await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: 'required',
          allowCredentials: []
        }
      });
      return true;
    } catch(e) {
      return false;
    }
  }

  async function _verifyPin(inputPin) {
    if (!_checkRateLimit()) return false;
    const storedHash = _getStoredPinHash();
    if (!storedHash) return true;
    const inputHash = await _hashPin(inputPin);
    if (inputHash === storedHash) {
      _clearAttempts();
      return true;
    }
    _recordFailedAttempt();
    return false;
  }

  window.promptChatUnlock = function(chatId, callback) {
    const overlay = document.createElement('div');
    overlay.id = 'chat-lock-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:24px;padding:32px;max-width:340px;width:90vw;text-align:center;color:var(--on-surface)';

    panel.innerHTML = `
      <div style="width:64px;height:64px;border-radius:50%;background:rgba(124,77,255,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
        <span class="material-symbols-outlined" style="font-size:32px;color:var(--primary)">lock</span>
      </div>
      <h3 style="margin:0 0 4px;font-size:18px;font-weight:700">Chat Locked</h3>
      <p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 20px">Authenticate to open this chat</p>
      <div id="lock-pin-section" style="display:none">
        <input type="password" inputmode="numeric" id="lock-pin-input" placeholder="Enter PIN" maxlength="8" style="width:100%;padding:14px;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--on-surface);font-size:24px;text-align:center;letter-spacing:8px;margin-bottom:12px;outline:none;box-sizing:border-box">
        <p id="pin-error" style="color:var(--error);font-size:12px;margin:0 0 8px;display:none">Incorrect PIN</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button id="lock-bio-btn" style="padding:14px;border-radius:14px;border:none;background:var(--primary);color:var(--on-primary);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
          <span class="material-symbols-outlined" style="font-size:20px">fingerprint</span> Unlock with Biometric
        </button>
        <button id="lock-pin-btn" style="padding:14px;border-radius:14px;border:none;background:rgba(255,255,255,0.08);color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer">
          Use PIN Instead
        </button>
        <button id="lock-forgot-btn" style="padding:10px;border-radius:10px;border:none;background:transparent;color:var(--primary);font-size:13px;cursor:pointer;display:none">
          Forgot PIN?
        </button>
        <button onclick="document.getElementById('chat-lock-overlay')?.remove()" style="padding:10px;border-radius:10px;border:none;background:transparent;color:var(--on-surface-variant);font-size:13px;cursor:pointer">Cancel</button>
      </div>`;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const biometricBtn = document.getElementById('lock-bio-btn');
    const pinBtn = document.getElementById('lock-pin-btn');
    const pinSection = document.getElementById('lock-pin-section');
    const forgotBtn = document.getElementById('lock-forgot-btn');
    const pinInput = document.getElementById('lock-pin-input');

    biometricBtn?.addEventListener('click', async () => {
      biometricBtn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:20px">progress_activity</span> Authenticating...';
      const ok = await _authenticateBiometric();
      if (ok) {
        overlay.remove();
        callback();
      } else {
        biometricBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">fingerprint</span> Unlock with Biometric';
        pinSection.style.display = 'block';
        forgotBtn.style.display = 'block';
        pinInput?.focus();
      }
    });

    pinBtn?.addEventListener('click', () => {
      biometricBtn.style.display = 'none';
      pinBtn.style.display = 'none';
      pinSection.style.display = 'block';
      forgotBtn.style.display = 'block';
      pinInput?.focus();
    });

    forgotBtn?.addEventListener('click', async () => {
      if (confirm('This will reset your PIN. All locked chats will need to be re-locked. Continue?')) {
        localStorage.removeItem(PIN_HASH_KEY);
        _clearAttempts();
        showToast('PIN reset. Set a new PIN below.', 'info');
        pinBtn.textContent = 'Set PIN & Unlock';
        pinBtn.style.display = 'block';
        forgotBtn.style.display = 'none';
      }
    });

    // Handle PIN Enter key — use named function, no arguments.callee
    function _handlePinEnter(e) {
      if (e.key !== 'Enter') return;
      const input = document.getElementById('lock-pin-input');
      if (!input) return;
      const val = input.value;

      const hasPin = !!_getStoredPinHash();
      if (hasPin) {
        // Verify existing PIN
        _verifyPin(val).then(ok => {
          if (ok) {
            overlay.remove();
            callback();
          } else {
            const errEl = document.getElementById('pin-error');
            if (errEl) errEl.style.display = 'block';
            input.value = '';
            input.style.borderColor = 'var(--error)';
            setTimeout(() => { input.style.borderColor = 'rgba(255,255,255,0.1)'; }, 1000);
          }
        });
      } else {
        // Set new PIN
        if (val.length >= 4) {
          _setStoredPinHash(val).then(() => {
            overlay.remove();
            callback();
            showToast('PIN set for future unlocks', 'success');
          });
        }
      }
    }

    pinInput?.addEventListener('keydown', _handlePinEnter);

    // Show/hide forgot PIN button
    const hasPin = !!_getStoredPinHash();
    if (!hasPin) {
      biometricBtn.style.display = 'none';
      forgotBtn.style.display = 'none';
      pinBtn.textContent = 'Set PIN & Unlock';
      pinSection.style.display = 'block';
      pinInput?.focus();
    }

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  };

  const origChatItemHTML = window.chatItemHTML;
  if (typeof origChatItemHTML === 'function') {
    window.chatItemHTML = function(chat) {
      const html = origChatItemHTML(chat);
      if (isChatLocked(chat.id)) {
        return html.replace(
          /(<span class="font-bold text-on-surface truncate[^"]*">)/,
          '$1<span class="material-symbols-outlined text-[14px] align-middle mr-1 opacity-60" style="font-variation-settings:\'FILL\' 1;">lock</span>'
        );
      }
      return html;
    };
  }

  const origOpenChat = window.openChat;
  if (typeof origOpenChat === 'function') {
    window.openChat = function(chatId) {
      if (isChatLocked(chatId) && !App._justUnlockedChat) {
        promptChatUnlock(chatId, () => {
          App._justUnlockedChat = chatId;
          origOpenChat(chatId);
          setTimeout(() => { App._justUnlockedChat = null; }, 500);
        });
        return;
      }
      return origOpenChat(chatId);
    };
  }

  window.openChatLockSettings = function() {
    const overlay = document.createElement('div');
    overlay.id = 'chat-lock-settings-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:400px;width:92vw;max-height:80vh;overflow-y:auto;color:var(--on-surface)';

    const locks = _getLockedChats();
    const lockedIds = Object.keys(locks).filter(k => locks[k].locked);
    const chats = (App.chats || []).filter(c => lockedIds.includes(c.id));

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:18px;font-weight:700">Locked Chats</h3>
        <button onclick="document.getElementById('chat-lock-settings-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>`;

    if (chats.length) {
      chats.forEach(chat => {
        html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;background:rgba(255,255,255,0.04);margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:50%;background:rgba(124,77,255,0.15);display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">lock</span></div>
            <span style="font-size:14px;font-weight:600">${escHtml(chat.name)}</span>
          </div>
          <button onclick="unlockChat('${chat.id}');document.getElementById('chat-lock-settings-overlay')?.remove();openChatLockSettings()" style="padding:6px 12px;border-radius:8px;border:none;background:var(--error);color:white;font-size:12px;font-weight:600;cursor:pointer">Unlock</button>
        </div>`;
      });
    } else {
      html += '<p style="text-align:center;color:var(--on-surface-variant);font-size:13px;padding:16px 0">No locked chats. Long-press a chat and select "Lock Chat" to secure it.</p>';
    }

    html += `
      <div style="margin-top:16px;padding:16px;border-radius:12px;background:rgba(255,255,255,0.04)">
        <h4 style="margin:0 0 10px;font-size:14px;font-weight:600">Security</h4>
        <button id="settings-change-pin-btn" style="width:100%;padding:10px;border-radius:10px;border:none;background:rgba(255,255,255,0.08);color:var(--on-surface);font-size:13px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px">
          <span class="material-symbols-outlined" style="font-size:18px">pin</span> ${_getStoredPinHash() ? 'Change Lock PIN' : 'Set Lock PIN'}
        </button>
        <button id="settings-reset-pin-btn" style="width:100%;padding:10px;border-radius:10px;border:none;background:rgba(255,255,255,0.08);color:var(--error);font-size:13px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px;margin-top:8px">
          <span class="material-symbols-outlined" style="font-size:18px">lock_reset</span> Forgot PIN? Reset
        </button>
      </div>`;

    panel.innerHTML = html;
    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    // Wire up Change PIN button — requires old PIN verification
    document.getElementById('settings-change-pin-btn')?.addEventListener('click', () => {
      const storedHash = _getStoredPinHash();
      const promptAndSet = (requireOld) => {
        if (requireOld) {
          const oldPin = prompt('Enter current PIN:');
          if (!oldPin) return;
          _verifyPin(oldPin).then(ok => {
            if (!ok) { showToast('Incorrect current PIN', 'error'); return; }
            const newPin = prompt('Enter new 4+ digit PIN:');
            if (newPin && newPin.length >= 4) {
              _setStoredPinHash(newPin).then(() => showToast('PIN changed', 'success'));
            }
          });
        } else {
          const newPin = prompt('Enter new 4+ digit PIN:');
          if (newPin && newPin.length >= 4) {
            _setStoredPinHash(newPin).then(() => showToast('PIN set', 'success'));
          }
        }
      };
      promptAndSet(!!storedHash);
    });

    // Wire up Reset PIN button
    document.getElementById('settings-reset-pin-btn')?.addEventListener('click', () => {
      if (confirm('Reset PIN? This will remove the PIN and all locked chats will need to be re-locked.')) {
        localStorage.removeItem(PIN_HASH_KEY);
        _clearAttempts();
        showToast('PIN reset. You will be prompted to set a new PIN on next unlock.', 'success');
        document.getElementById('chat-lock-settings-overlay')?.remove();
      }
    });
  };

  window._addChatLockOption = function(menu, chatId) {
    const locked = isChatLocked(chatId);
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;border:none;background:transparent;color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;width:100%;text-align:left;border-radius:0';
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${locked ? 'lock_open' : 'lock'}</span>${locked ? 'Unlock Chat' : 'Lock Chat'}`;
    btn.onclick = () => { toggleChatLock(chatId); _removeCtxMenu(); };
    const cancelBtn = menu.querySelector('[onclick*="_removeCtxMenu"]');
    if (cancelBtn) menu.insertBefore(btn, cancelBtn);
    else menu.appendChild(btn);
  };
})();
