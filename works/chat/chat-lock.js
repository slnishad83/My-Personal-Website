// Chat Lock — fingerprint/PIN lock for specific chats
// PIN verification is server-side (PBKDF2 via Cloud Functions)
(function() {
  'use strict';

  const STORAGE_KEY = 'nsl_chat_locks';
  const PIN_ATTEMPTS_KEY = 'nsl_lock_pin_attempts';
  const PIN_LOCKOUT_KEY = 'nsl_lock_pin_lockout';
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 30000;

  function _getLockedChats() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(_) { return {}; }
  }

  function _saveLockedChats(locks) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(locks)); } catch (_) {}
    try {
      if (App.db && App.auth?.currentUser) {
        App.db.collection('users').doc(App.auth.currentUser.uid).update({ lockedChats: locks }).catch(() => {});
      }
    } catch(_) {}
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

  async function _callSetPin(pin, oldPin) {
    const fn = firebase.functions().httpsCallable('setChatPin');
    const result = await fn({ pin, oldPin });
    return result.data;
  }

  async function _callVerifyPin(pin) {
    const fn = firebase.functions().httpsCallable('verifyChatPin');
    const result = await fn({ pin });
    return result.data;
  }

  async function _callResetPin() {
    const fn = firebase.functions().httpsCallable('resetChatPin');
    const result = await fn({});
    return result.data;
  }

  async function _hasServerPin() {
    if (!App.db || !App.auth?.currentUser) return false;
    try {
      const doc = await App.db.collection('users').doc(App.auth.currentUser.uid).get();
      const d = doc.data() || {};
      return !!(d.pinHash && d.pinSalt);
    } catch(_) { return false; }
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

  window.setLockPin = async function(pin, oldPin) {
    if (!pin || pin.length < 4) { showToast('PIN must be at least 4 digits', 'error'); return false; }
    try {
      await _callSetPin(pin, oldPin);
      showToast('Lock PIN set (server-secured)', 'success');
      return true;
    } catch(e) {
      showToast(e.message || 'Failed to set PIN', 'error');
      return false;
    }
  };

  async function _authenticateBiometric() {
    try {
      if (!window.PublicKeyCredential) return false;
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) return false;

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

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
    try {
      const result = await _callVerifyPin(inputPin);
      _clearAttempts();
      return true;
    } catch(e) {
      _recordFailedAttempt();
      if (e.code === 'permission-denied') {
        showToast('Incorrect PIN', 'error');
      } else {
        showToast(e.message || 'Verification failed', 'error');
      }
      return false;
    }
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
        <input type="password" inputmode="numeric" id="lock-pin-input" placeholder="Enter PIN" maxlength="8" style="width:100%;padding:14px;border-radius:12px;border:2px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:24px;text-align:center;letter-spacing:8px;margin-bottom:12px;outline:none;box-sizing:border-box">
        <p id="pin-error" style="color:var(--error);font-size:12px;margin:0 0 8px;display:none">Incorrect PIN</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button id="lock-bio-btn" style="padding:14px;border-radius:14px;border:none;background:var(--primary);color:var(--on-primary);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
          <span class="material-symbols-outlined" style="font-size:20px">fingerprint</span> Unlock with Biometric
        </button>
        <button id="lock-pin-btn" style="padding:14px;border-radius:14px;border:none;background:var(--surface-container,rgba(0,0,0,0.08));color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer">
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
        try {
          await _callResetPin();
          _clearAttempts();
          showToast('PIN reset. Set a new PIN below.', 'info');
          pinBtn.textContent = 'Set PIN & Unlock';
          pinBtn.style.display = 'block';
          forgotBtn.style.display = 'none';
        } catch(e) {
          showToast(e.message || 'Reset failed', 'error');
        }
      }
    });

    async function _handlePinEnter(e) {
      if (e.key !== 'Enter') return;
      const input = document.getElementById('lock-pin-input');
      if (!input) return;
      const val = input.value;
      if (!val) return;

      input.disabled = true;
      try {
        const hasPin = await _hasServerPin();
        if (hasPin) {
          const ok = await _verifyPin(val);
          if (ok) {
            overlay.remove();
            callback();
          } else {
            const errEl = document.getElementById('pin-error');
            if (errEl) errEl.style.display = 'block';
            input.value = '';
            input.style.borderColor = 'var(--error)';
            setTimeout(() => { input.style.borderColor = 'var(--outline-variant,rgba(0,0,0,0.1))'; }, 1000);
          }
        } else {
          if (val.length >= 4) {
            try {
              await _callSetPin(val);
              overlay.remove();
              callback();
              showToast('PIN set (server-secured)', 'success');
            } catch(e) {
              showToast(e.message || 'Failed to set PIN', 'error');
            }
          }
        }
      } finally {
        input.disabled = false;
        input.focus();
      }
    }

    pinInput?.addEventListener('keydown', _handlePinEnter);

    (async () => {
      const hasPin = await _hasServerPin();
      if (!hasPin) {
        biometricBtn.style.display = 'none';
        forgotBtn.style.display = 'none';
        pinBtn.textContent = 'Set PIN & Unlock';
        pinSection.style.display = 'block';
        pinInput?.focus();
      }
    })();

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
    let _unlockTarget = null;
    window.openChat = function(chatId) {
      if (isChatLocked(chatId) && _unlockTarget !== chatId) {
        _unlockTarget = null;
        promptChatUnlock(chatId, () => {
          _unlockTarget = chatId;
          origOpenChat(chatId);
        });
        return;
      }
      _unlockTarget = null;
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
        html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;background:var(--surface-container-low,rgba(0,0,0,0.04));margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:50%;background:rgba(124,77,255,0.15);display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">lock</span></div>
            <span style="font-size:14px;font-weight:600">${escHtml(chat.name)}</span>
          </div>
          <button data-chat-id="${escHtml(chat.id)}" class="chat-lock-unlock-btn" style="padding:6px 12px;border-radius:8px;border:none;background:var(--error);color:white;font-size:12px;font-weight:600;cursor:pointer">Unlock</button>
        </div>`;
      });
    } else {
      html += '<p style="text-align:center;color:var(--on-surface-variant);font-size:13px;padding:16px 0">No locked chats. Long-press a chat and select "Lock Chat" to secure it.</p>';
    }

    html += `
      <div style="margin-top:16px;padding:16px;border-radius:12px;background:var(--surface-container-low,rgba(0,0,0,0.04))">
        <h4 style="margin:0 0 4px;font-size:14px;font-weight:600">Security</h4>
        <p style="font-size:11px;color:var(--on-surface-variant);margin:0 0 10px">PINs are encrypted server-side (PBKDF2, 100k iterations)</p>
        <button id="settings-change-pin-btn" style="width:100%;padding:10px;border-radius:10px;border:none;background:var(--surface-container,rgba(0,0,0,0.08));color:var(--on-surface);font-size:13px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px">
          <span class="material-symbols-outlined" style="font-size:18px">pin</span> Change Lock PIN
        </button>
        <button id="settings-reset-pin-btn" style="width:100%;padding:10px;border-radius:10px;border:none;background:var(--surface-container,rgba(0,0,0,0.08));color:var(--error);font-size:13px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px;margin-top:8px">
          <span class="material-symbols-outlined" style="font-size:18px">lock_reset</span> Forgot PIN? Reset
        </button>
      </div>`;

    panel.innerHTML = html;
    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    panel.addEventListener('click', (e) => {
      const unlockBtn = e.target.closest('.chat-lock-unlock-btn[data-chat-id]');
      if (!unlockBtn) return;
      unlockChat(unlockBtn.dataset.chatId);
      document.getElementById('chat-lock-settings-overlay')?.remove();
      openChatLockSettings();
    });

    document.getElementById('settings-change-pin-btn')?.addEventListener('click', () => {
      const oldPin = prompt('Enter current PIN:');
      if (!oldPin) return;
      const newPin = prompt('Enter new 4-8 digit PIN:');
      if (!newPin || newPin.length < 4) return;
      setLockPin(newPin, oldPin).then(ok => {
        if (ok) document.getElementById('chat-lock-settings-overlay')?.remove();
      });
    });

    document.getElementById('settings-reset-pin-btn')?.addEventListener('click', () => {
      if (confirm('Reset PIN? All locked chats will need to be re-locked.')) {
        _callResetPin().then(() => {
          _clearAttempts();
          showToast('PIN reset. You will be prompted to set a new PIN on next unlock.', 'success');
          document.getElementById('chat-lock-settings-overlay')?.remove();
        }).catch(e => showToast(e.message || 'Reset failed', 'error'));
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
