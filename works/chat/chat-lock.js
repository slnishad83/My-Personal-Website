// Chat Lock — fingerprint/PIN lock for specific chats
(function() {
  'use strict';

  const STORAGE_KEY = 'nsl_chat_locks';
  const PIN_HASH_KEY = 'nsl_lock_pin_hash';

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

  function _hashPin(pin) {
    let h = 0;
    for (let i = 0; i < pin.length; i++) {
      h = ((h << 5) - h + pin.charCodeAt(i)) | 0;
    }
    return 'h_' + Math.abs(h).toString(36);
  }

  function _getStoredPinHash() {
    return localStorage.getItem(PIN_HASH_KEY) || null;
  }

  function _setStoredPinHash(pin) {
    localStorage.setItem(PIN_HASH_KEY, _hashPin(pin));
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

  window.setLockPin = function(pin) {
    if (!pin || pin.length < 4) { showToast('PIN must be at least 4 digits', 'error'); return false; }
    _setStoredPinHash(pin);
    showToast('Lock PIN set', 'success');
    return true;
  };

  async function _authenticateBiometric() {
    try {
      if (!window.PublicKeyCredential) return false;

      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) return false;

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: 'NSL Chat', id: window.location.hostname },
          user: {
            id: new Uint8Array(16),
            name: 'chat-lock',
            displayName: 'Chat Lock'
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000
        }
      });
      return !!credential;
    } catch(e) {
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
        <button onclick="document.getElementById('chat-lock-overlay')?.remove()" style="padding:10px;border-radius:10px;border:none;background:transparent;color:var(--on-surface-variant);font-size:13px;cursor:pointer">Cancel</button>
      </div>`;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const biometricBtn = document.getElementById('lock-bio-btn');
    const pinBtn = document.getElementById('lock-pin-btn');
    const pinSection = document.getElementById('lock-pin-section');

    biometricBtn?.addEventListener('click', async () => {
      biometricBtn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:20px">progress_activity</span> Authenticating...';
      const ok = await _authenticateBiometric();
      if (ok) {
        overlay.remove();
        callback();
      } else {
        biometricBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">fingerprint</span> Unlock with Biometric';
        pinSection.style.display = 'block';
        document.getElementById('lock-pin-input')?.focus();
      }
    });

    pinBtn?.addEventListener('click', () => {
      biometricBtn.style.display = 'none';
      pinBtn.style.display = 'none';
      pinSection.style.display = 'block';
      document.getElementById('lock-pin-input')?.focus();
    });

    document.getElementById('lock-pin-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const input = document.getElementById('lock-pin-input');
        const storedHash = _getStoredPinHash();
        if (!storedHash || _hashPin(input.value) === storedHash) {
          overlay.remove();
          callback();
        } else {
          document.getElementById('pin-error').style.display = 'block';
          input.value = '';
          input.style.borderColor = 'var(--error)';
          setTimeout(() => { input.style.borderColor = 'rgba(255,255,255,0.1)'; }, 1000);
        }
      }
    });

    const hasPin = !!_getStoredPinHash();
    if (!hasPin) {
      biometricBtn.style.display = 'none';
      pinBtn.textContent = 'Set PIN & Unlock';
      pinSection.style.display = 'block';
      document.getElementById('lock-pin-input')?.focus();

      document.getElementById('lock-pin-input')?.removeEventListener('keydown', arguments.callee);
      document.getElementById('lock-pin-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const input = document.getElementById('lock-pin-input');
          if (input.value.length >= 4) {
            _setStoredPinHash(input.value);
            overlay.remove();
            callback();
            showToast('PIN set for future unlocks', 'success');
          }
        }
      });
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
        <h3 style="margin:0;font-size:18px;font-weight:700">🔒 Locked Chats</h3>
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
        <button onclick="const p=prompt('Enter new 4+ digit PIN:');if(p)setLockPin(p)" style="width:100%;padding:10px;border-radius:10px;border:none;background:rgba(255,255,255,0.08);color:var(--on-surface);font-size:13px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px">
          <span class="material-symbols-outlined" style="font-size:18px">pin</span> ${_getStoredPinHash() ? 'Change Lock PIN' : 'Set Lock PIN'}
        </button>
      </div>`;

    panel.innerHTML = html;
    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
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
