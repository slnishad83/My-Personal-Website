/**
 * Chat Lock
 * Move specific chats to a "Locked chats" folder behind biometric/PIN authentication.
 * Hides locked chats from the main list, notifications, and search.
 * (Like WhatsApp Chat Lock)
 */
(function () {
  'use strict';

  const _esc = (s) => window.escHtml ? window.escHtml(String(s ?? '')) : String(s ?? '');
  const _debug = (...args) => { if (window.__DEBUG__) console.log('[LockChat]', ...args); };

  const STORAGE_KEY = 'nsl_locked_chats_v2';
  const PIN_ATTEMPTS_KEY = 'nsl_lock_pin_attempts';
  const PIN_LOCKOUT_KEY = 'nsl_lock_pin_lockout';
  const SESSION_UNLOCKED_KEY = 'nsl_locked_session_active';
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 30000;
  const SESSION_TIMEOUT_MS = 300000; // 5 minutes

  let _unlockedSession = false;
  let _sessionTimer = null;

  /* ── Helpers ── */

  function _db() { return window.App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); }
  function _uid() { return window.currentUser ? currentUser.uid : (App && App.auth && App.auth.currentUser ? App.auth.currentUser.uid : null); }

  function _getLockedChats() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { return {}; }
  }

  function _saveLockedChats(locks) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(locks)); } catch (_) {}
  }

  async function _persistToFirestore(locks) {
    const uid = _uid();
    const db = _db();
    if (!uid || !db) return;
    try {
      await db.collection('users').doc(uid).update({ lockedChats: locks });
      _debug('Persisted to Firestore');
    } catch (e) {
      _debug('Firestore persist failed:', e.message);
    }
  }

  async function _loadFromFirestore() {
    const uid = _uid();
    const db = _db();
    if (!uid || !db) return null;
    try {
      const snap = await db.collection('users').doc(uid).get();
      if (snap.exists) {
        const data = snap.data();
        if (data && data.lockedChats && typeof data.lockedChats === 'object') {
          return data.lockedChats;
        }
      }
    } catch (e) {
      _debug('Firestore load failed:', e.message);
    }
    return null;
  }

  function _getLockedCount() {
    const locks = _getLockedChats();
    return Object.keys(locks).filter(k => locks[k] && locks[k].locked).length;
  }

  function _isSessionValid() {
    try {
      const ts = parseInt(localStorage.getItem(SESSION_UNLOCKED_KEY) || '0');
      if (ts && Date.now() - ts < SESSION_TIMEOUT_MS) return true;
    } catch (_) {}
    return false;
  }

  function _setSessionActive() {
    try { localStorage.setItem(SESSION_UNLOCKED_KEY, String(Date.now())); } catch (_) {}
    _unlockedSession = true;
  }

  function _clearSession() {
    try { localStorage.removeItem(SESSION_UNLOCKED_KEY); } catch (_) {}
    _unlockedSession = false;
    if (_sessionTimer) { clearTimeout(_sessionTimer); _sessionTimer = null; }
  }

  /* ── Rate limiting ── */

  function _checkRateLimit() {
    try {
      const lockoutUntil = parseInt(localStorage.getItem(PIN_LOCKOUT_KEY) || '0');
      if (Date.now() < lockoutUntil) {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        _debug('Rate limited, retry in', remaining, 's');
        return { allowed: false, remaining: remaining };
      }
    } catch (_) {}
    return { allowed: true, remaining: 0 };
  }

  function _recordFailedAttempt() {
    try {
      const attempts = parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY) || '0') + 1;
      localStorage.setItem(PIN_ATTEMPTS_KEY, String(attempts));
      if (attempts >= MAX_ATTEMPTS) {
        localStorage.setItem(PIN_LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
        localStorage.setItem(PIN_ATTEMPTS_KEY, '0');
      }
      return attempts;
    } catch (_) { return 0; }
  }

  function _clearAttempts() {
    try {
      localStorage.setItem(PIN_ATTEMPTS_KEY, '0');
      localStorage.removeItem(PIN_LOCKOUT_KEY);
    } catch (_) {}
  }

  /* ── Server PIN calls ── */

  async function _callSetPin(pin, oldPin) {
    if (!window.firebase || !firebase.functions) throw new Error('Cloud Functions not available');
    const fn = firebase.functions().httpsCallable('setChatPin');
    const result = await fn({ pin: pin, oldPin: oldPin || null });
    return result.data;
  }

  async function _callVerifyPin(pin) {
    if (!window.firebase || !firebase.functions) throw new Error('Cloud Functions not available');
    const fn = firebase.functions().httpsCallable('verifyChatPin');
    const result = await fn({ pin: pin });
    return result.data;
  }

  async function _callResetPin() {
    if (!window.firebase || !firebase.functions) throw new Error('Cloud Functions not available');
    const fn = firebase.functions().httpsCallable('resetChatPin');
    const result = await fn({});
    return result.data;
  }

  async function _hasServerPin() {
    const uid = _uid();
    const db = _db();
    if (!uid || !db) return false;
    try {
      const doc = await db.collection('userSecrets').doc(uid).get();
      const d = doc.data() || {};
      return !!(d.pinHash && d.pinSalt);
    } catch (_) { return false; }
  }

  /* ── Biometric authentication ── */

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
    } catch (e) {
      _debug('Biometric auth failed:', e.message);
      return false;
    }
  }

  /* ═══════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════ */

  /**
   * Lock a chat — moves it to the "Locked chats" folder.
   * @param {string} chatId
   * @param {string} chatType - 'direct' | 'group'
   * @returns {Promise<boolean>}
   */
  async function lockChat(chatId, chatType) {
    if (!chatId) {
      _debug('lockChat: missing chatId');
      return false;
    }

    const uid = _uid();
    if (!uid) {
      _debug('lockChat: not authenticated');
      return false;
    }

    try {
      const locks = _getLockedChats();
      locks[chatId] = {
        locked: true,
        lockedBy: uid,
        lockedAt: Date.now(),
        chatType: chatType || 'direct'
      };
      _saveLockedChats(locks);
      await _persistToFirestore(locks);

      // Hide from main chat list
      _hideChatElement(chatId);

      // Notify UI
      if (typeof showToast === 'function') showToast('Chat locked', 'success');
      if (typeof renderChatList === 'function') renderChatList();
      _renderLockedFolder();

      _debug('Locked chat:', chatId);
      return true;
    } catch (e) {
      _debug('lockChat error:', e);
      return false;
    }
  }

  /**
   * Unlock a chat — moves it back to the main list.
   * @param {string} chatId
   * @param {string} chatType
   * @returns {Promise<boolean>}
   */
  async function unlockChat(chatId, chatType) {
    if (!chatId) return false;

    const uid = _uid();
    if (!uid) return false;

    try {
      const locks = _getLockedChats();
      delete locks[chatId];
      _saveLockedChats(locks);
      await _persistToFirestore(locks);

      // Show in main chat list
      _showChatElement(chatId);

      if (typeof showToast === 'function') showToast('Chat unlocked', 'info');
      if (typeof renderChatList === 'function') renderChatList();
      _renderLockedFolder();

      _debug('Unlocked chat:', chatId);
      return true;
    } catch (e) {
      _debug('unlockChat error:', e);
      return false;
    }
  }

  /**
   * Get all locked chats for the current user.
   * @param {string} uid
   * @returns {Promise<Array>}
   */
  async function getLockedChats(uid) {
    const currentUid = uid || _uid();
    if (!currentUid) return [];

    // Load from Firestore if local is empty
    const locks = _getLockedChats();
    if (Object.keys(locks).length === 0) {
      const remote = await _loadFromFirestore();
      if (remote) {
        _saveLockedChats(remote);
        Object.assign(locks, remote);
      }
    }

    const lockedIds = Object.keys(locks).filter(k => locks[k] && locks[k].locked);
    const allChats = (App && App.chats) ? App.chats : [];

    return lockedIds.map(id => {
      const chat = allChats.find(c => c.id === id);
      return chat || { id: id, name: 'Locked Chat', locked: true };
    }).filter(Boolean);
  }

  /**
   * Authenticate to access locked chats.
   * Shows biometric or PIN screen.
   * @param {string} reason
   * @returns {Promise<boolean>}
   */
  async function authenticate(reason) {
    if (_unlockedSession && _isSessionValid()) {
      _debug('Session still valid, skipping auth');
      return true;
    }

    return new Promise((resolve) => {
      _showAuthOverlay(reason || 'Authenticate to access locked chats', resolve);
    });
  }

  /* ── UI: Auth overlay ── */

  function _showAuthOverlay(reason, callback) {
    _injectStyles();

    const overlay = document.createElement('div');
    overlay.id = 'lock-chat-auth-overlay';
    overlay.className = 'lock-chat-overlay';

    const panel = document.createElement('div');
    panel.className = 'lock-chat-auth-panel';

    panel.innerHTML =
      '<div class="lock-chat-auth-icon">' +
        '<span class="material-symbols-outlined" style="font-size:36px;color:#008069">lock</span>' +
      '</div>' +
      '<h3 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--on-surface,#e9edef)">Locked Chats</h3>' +
      '<p style="font-size:13px;color:var(--on-surface-variant,#8696a0);margin:0 0 24px">' + _esc(reason) + '</p>' +
      '<div id="lock-chat-pin-section" style="display:none">' +
        '<input type="password" inputmode="numeric" id="lock-chat-pin-input" placeholder="Enter PIN" maxlength="8" class="lock-chat-pin-input">' +
        '<p id="lock-chat-pin-error" class="lock-chat-pin-error">Incorrect PIN</p>' +
      '</div>' +
      '<div class="lock-chat-auth-actions">' +
        '<button id="lock-chat-bio-btn" class="lock-chat-btn lock-chat-btn-primary">' +
          '<span class="material-symbols-outlined" style="font-size:20px">fingerprint</span> Unlock with Biometric' +
        '</button>' +
        '<button id="lock-chat-pin-toggle" class="lock-chat-btn lock-chat-btn-secondary">Use PIN Instead</button>' +
        '<button id="lock-chat-forgot-btn" class="lock-chat-btn lock-chat-btn-text" style="display:none">Forgot PIN?</button>' +
        '<button id="lock-chat-cancel-btn" class="lock-chat-btn lock-chat-btn-text">Cancel</button>' +
      '</div>';

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const bioBtn = document.getElementById('lock-chat-bio-btn');
    const pinToggle = document.getElementById('lock-chat-pin-toggle');
    const pinSection = document.getElementById('lock-chat-pin-section');
    const pinInput = document.getElementById('lock-chat-pin-input');
    const forgotBtn = document.getElementById('lock-chat-forgot-btn');
    const cancelBtn = document.getElementById('lock-chat-cancel-btn');

    function _close(result) {
      overlay.remove();
      callback(result);
    }

    // Biometric button
    bioBtn.addEventListener('click', async () => {
      bioBtn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:20px">progress_activity</span> Authenticating...';
      bioBtn.disabled = true;

      const ok = await _authenticateBiometric();
      if (ok) {
        _setSessionActive();
        _close(true);
      } else {
        bioBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">fingerprint</span> Unlock with Biometric';
        bioBtn.disabled = false;
        pinSection.style.display = 'block';
        forgotBtn.style.display = 'block';
        pinInput.focus();
      }
    });

    // PIN toggle
    pinToggle.addEventListener('click', () => {
      bioBtn.style.display = 'none';
      pinToggle.style.display = 'none';
      pinSection.style.display = 'block';
      forgotBtn.style.display = 'block';
      pinInput.focus();
    });

    // PIN enter
    pinInput.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      const val = pinInput.value;
      if (!val) return;

      const rateLimit = _checkRateLimit();
      if (!rateLimit.allowed) {
        pinInput.value = '';
        if (typeof showToast === 'function') {
          showToast('Too many attempts. Try again in ' + rateLimit.remaining + 's', 'error');
        }
        return;
      }

      pinInput.disabled = true;
      try {
        const hasPin = await _hasServerPin();
        if (hasPin) {
          await _callVerifyPin(val);
          _clearAttempts();
          _setSessionActive();
          _close(true);
        } else {
          if (val.length >= 4) {
            await _callSetPin(val);
            _setSessionActive();
            _close(true);
            if (typeof showToast === 'function') showToast('PIN set successfully', 'success');
          }
        }
      } catch (err) {
        _recordFailedAttempt();
        const errEl = document.getElementById('lock-chat-pin-error');
        if (errEl) errEl.style.display = 'block';
        pinInput.value = '';
        pinInput.style.borderColor = 'var(--error,#ea4335)';
        setTimeout(() => { pinInput.style.borderColor = ''; }, 1000);
      } finally {
        pinInput.disabled = false;
        pinInput.focus();
      }
    });

    // Forgot PIN
    forgotBtn.addEventListener('click', async () => {
      if (confirm('This will reset your PIN. Continue?')) {
        try {
          await _callResetPin();
          _clearAttempts();
          if (typeof showToast === 'function') showToast('PIN reset. Set a new PIN.', 'info');
          bioBtn.style.display = 'none';
          pinToggle.style.display = 'none';
          pinSection.style.display = 'block';
          forgotBtn.style.display = 'none';
          pinInput.focus();
        } catch (err) {
          if (typeof showToast === 'function') showToast(err.message || 'Reset failed', 'error');
        }
      }
    });

    // Cancel
    cancelBtn.addEventListener('click', () => _close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) _close(false); });

    // Check if PIN exists
    (async () => {
      const hasPin = await _hasServerPin();
      if (!hasPin) {
        bioBtn.style.display = 'none';
        forgotBtn.style.display = 'none';
        pinToggle.textContent = 'Set PIN & Unlock';
        pinSection.style.display = 'block';
        pinInput.focus();
      }
    })();
  }

  /* ── UI: Locked chats folder ── */

  function _renderLockedFolder() {
    const chatList = document.getElementById('chat-list');
    if (!chatList) return;

    const existing = document.getElementById('locked-chats-folder-wrapper');
    if (existing) existing.remove();

    const count = _getLockedCount();
    if (count === 0) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'locked-chats-folder-wrapper';
    wrapper.style.cssText = 'border-top:1px solid var(--outline-variant,#313d45);background:var(--surface,#111b21);';

    const row = document.createElement('div');
    row.className = 'locked-chats-folder-row';
    row.style.cssText = 'display:flex;align-items:center;padding:12px 16px;cursor:pointer;transition:background 0.15s;';
    row.innerHTML =
      '<div style="width:48px;height:48px;border-radius:50%;background:rgba(0,128,105,0.12);display:flex;align-items:center;justify-content:center;margin-right:14px;flex-shrink:0">' +
        '<span class="material-symbols-outlined" style="font-size:22px;color:#008069">lock</span>' +
      '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:16px;font-weight:500;color:var(--on-surface,#e9edef)">Locked chats</div>' +
        '<div style="font-size:13px;color:var(--on-surface-variant,#8696a0)">' + count + ' chat' + (count !== 1 ? 's' : '') + '</div>' +
      '</div>' +
      '<span class="material-symbols-outlined" style="font-size:20px;color:var(--on-surface-variant,#8696a0)">chevron_right</span>';

    row.addEventListener('click', async () => {
      const ok = await authenticate('Unlock to view locked chats');
      if (ok) _showLockedChatsList();
    });

    row.addEventListener('mouseenter', () => { row.style.background = 'var(--surface-container-high,#202c33)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

    wrapper.appendChild(row);

    // Insert after archived section or at end of chat list
    const archivedSection = document.getElementById('archive-section-wrapper');
    if (archivedSection && archivedSection.nextSibling) {
      chatList.insertBefore(wrapper, archivedSection.nextSibling);
    } else {
      chatList.appendChild(wrapper);
    }
  }

  function _showLockedChatsList() {
    const locks = _getLockedChats();
    const lockedIds = Object.keys(locks).filter(k => locks[k] && locks[k].locked);
    const allChats = (App && App.chats) ? App.chats : [];
    const chats = lockedIds.map(id => allChats.find(c => c.id === id)).filter(Boolean);

    _injectStyles();

    const overlay = document.createElement('div');
    overlay.id = 'locked-chats-list-overlay';
    overlay.className = 'lock-chat-overlay';

    const panel = document.createElement('div');
    panel.className = 'lock-chat-list-panel';

    let html =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<h3 style="margin:0;font-size:18px;font-weight:700;color:var(--on-surface,#e9edef)">Locked Chats</h3>' +
        '<button id="locked-chats-close-btn" class="lock-chat-close-x">&times;</button>' +
      '</div>';

    if (chats.length) {
      chats.forEach(chat => {
        html +=
          '<div class="locked-chat-item" data-chat-id="' + _esc(chat.id) + '">' +
            '<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">' +
              '<div style="width:40px;height:40px;border-radius:50%;background:rgba(0,128,105,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
                '<span class="material-symbols-outlined" style="font-size:18px;color:#008069">lock</span>' +
              '</div>' +
              '<div style="min-width:0">' +
                '<div style="font-size:14px;font-weight:600;color:var(--on-surface,#e9edef);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _esc(chat.name) + '</div>' +
                '<div style="font-size:12px;color:var(--on-surface-variant,#8696a0)">Locked</div>' +
              '</div>' +
            '</div>' +
            '<button class="locked-chat-unlock-btn" data-chat-id="' + _esc(chat.id) + '" style="padding:6px 14px;border-radius:8px;border:none;background:rgba(0,128,105,0.15);color:#00a884;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0">Unlock</button>' +
          '</div>';
      });
    } else {
      html += '<p style="text-align:center;color:var(--on-surface-variant,#8696a0);font-size:13px;padding:24px 0">No locked chats</p>';
    }

    panel.innerHTML = html;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Event listeners
    document.getElementById('locked-chats-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    panel.querySelectorAll('.locked-chat-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.locked-chat-unlock-btn')) return;
        const chatId = item.dataset.chatId;
        overlay.remove();
        if (typeof openChat === 'function') openChat(chatId);
      });
    });

    panel.querySelectorAll('.locked-chat-unlock-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const chatId = btn.dataset.chatId;
        await unlockChat(chatId);
        overlay.remove();
        if (_getLockedCount() > 0) _showLockedChatsList();
      });
    });
  }

  /* ── UI: Chat element visibility ── */

  function _hideChatElement(chatId) {
    const el = document.querySelector('[data-chat-id="' + chatId + '"]');
    if (el) el.style.display = 'none';
  }

  function _showChatElement(chatId) {
    const el = document.querySelector('[data-chat-id="' + chatId + '"]');
    if (el) el.style.display = '';
  }

  /* ── Context menu integration ── */

  function addLockOption(menu, chatId) {
    if (!menu || !chatId) return;

    const locks = _getLockedChats();
    const isLocked = !!(locks[chatId] && locks[chatId].locked);

    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;border:none;background:transparent;color:var(--on-surface,#e9edef);font-size:14px;font-weight:600;cursor:pointer;width:100%;text-align:left;border-radius:0;transition:background 0.15s;';
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">' + (isLocked ? 'lock_open' : 'lock') + '</span>' + (isLocked ? 'Unlock chat' : 'Lock chat');

    btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--surface-container-high,#202c33)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });

    btn.addEventListener('click', async () => {
      if (isLocked) {
        await unlockChat(chatId);
      } else {
        await lockChat(chatId);
      }
      if (typeof _removeCtxMenu === 'function') _removeCtxMenu();
    });

    const cancelBtn = menu.querySelector('[onclick*="_removeCtxMenu"]');
    if (cancelBtn) {
      menu.insertBefore(btn, cancelBtn);
    } else {
      menu.appendChild(btn);
    }
  }

  /* ── Security: Notification content hiding ── */

  /**
   * Returns false for locked chats — notifications should only show "New message".
   * @param {object} message
   * @param {string} chatId
   * @returns {boolean}
   */
  function shouldShowContent(message, chatId) {
    if (!chatId) return true;
    const locks = _getLockedChats();
    if (locks[chatId] && locks[chatId].locked) return false;
    return true;
  }

  /**
   * Get safe notification body for locked chats.
   * @param {string} chatId
   * @returns {string}
   */
  function getNotificationBody(chatId) {
    if (!chatId) return '';
    const locks = _getLockedChats();
    if (locks[chatId] && locks[chatId].locked) return 'New message';
    return '';
  }

  /* ── Security: Search filtering ── */

  function isLockedChat(chatId) {
    const locks = _getLockedChats();
    return !!(locks[chatId] && locks[chatId].locked);
  }

  function filterSearchResults(results, authenticated) {
    if (authenticated) return results;
    return results.filter(r => {
      if (r.chatId && isLockedChat(r.chatId)) return false;
      if (r.id && isLockedChat(r.id)) return false;
      return true;
    });
  }

  /* ── Security: Gallery filtering ── */

  function shouldShowInGallery(chatId) {
    if (!chatId) return true;
    return !isLockedChat(chatId);
  }

  /* ── Styles ── */

  function _injectStyles() {
    if (document.getElementById('lock-chat-styles')) return;
    const style = document.createElement('style');
    style.id = 'lock-chat-styles';
    style.textContent = '\n' +
      '.lock-chat-overlay { position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:lockChatFadeIn 0.2s ease; }\n' +
      '.lock-chat-auth-panel { background:var(--surface-container,#1e1e2e);border-radius:24px;padding:32px;max-width:340px;width:90vw;text-align:center;color:var(--on-surface,#e9edef);animation:lockChatScaleIn 0.2s ease; }\n' +
      '.lock-chat-list-panel { background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:400px;width:92vw;max-height:80vh;overflow-y:auto;color:var(--on-surface,#e9edef);animation:lockChatScaleIn 0.2s ease; }\n' +
      '.lock-chat-auth-icon { width:64px;height:64px;border-radius:50%;background:rgba(0,128,105,0.12);display:flex;align-items:center;justify-content:center;margin:0 auto 16px; }\n' +
      '.lock-chat-pin-input { width:100%;padding:14px;border-radius:12px;border:2px solid var(--outline-variant,#313d45);background:var(--surface-container-low,#111b21);color:var(--on-surface,#e9edef);font-size:24px;text-align:center;letter-spacing:8px;margin-bottom:12px;outline:none;box-sizing:border-box;transition:border-color 0.2s; }\n' +
      '.lock-chat-pin-input:focus { border-color:#008069; }\n' +
      '.lock-chat-pin-error { color:var(--error,#ea4335);font-size:12px;margin:0 0 8px;display:none; }\n' +
      '.lock-chat-auth-actions { display:flex;flex-direction:column;gap:8px; }\n' +
      '.lock-chat-btn { padding:14px;border-radius:14px;border:none;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity 0.15s; }\n' +
      '.lock-chat-btn:disabled { opacity:0.6;cursor:not-allowed; }\n' +
      '.lock-chat-btn-primary { background:#008069;color:white; }\n' +
      '.lock-chat-btn-primary:hover { opacity:0.9; }\n' +
      '.lock-chat-btn-secondary { background:var(--surface-container,#2a3942);color:var(--on-surface,#e9edef);font-weight:600; }\n' +
      '.lock-chat-btn-secondary:hover { opacity:0.85; }\n' +
      '.lock-chat-btn-text { padding:10px;border-radius:10px;border:none;background:transparent;color:#00a884;font-size:13px;font-weight:600;cursor:pointer; }\n' +
      '.lock-chat-btn-text:hover { opacity:0.8; }\n' +
      '.lock-chat-close-x { background:none;border:none;color:var(--on-surface-variant,#8696a0);cursor:pointer;font-size:22px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background 0.15s; }\n' +
      '.lock-chat-close-x:hover { background:var(--surface-container-high,#2a3942); }\n' +
      '.locked-chat-item { display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;background:var(--surface-container-low,#111b21);margin-bottom:8px;cursor:pointer;transition:background 0.15s; }\n' +
      '.locked-chat-item:hover { background:var(--surface-container-high,#202c33); }\n' +
      '@keyframes lockChatFadeIn { from{opacity:0} to{opacity:1} }\n' +
      '@keyframes lockChatScaleIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }\n';
    document.head.appendChild(style);
  }

  /* ── Chat list rendering integration ── */

  function _patchChatListRendering() {
    // Hide locked chats from main chat list
    const origRenderChatList = window.renderChatList;
    if (typeof origRenderChatList === 'function') {
      window.renderChatList = function () {
        origRenderChatList.apply(this, arguments);
        const locks = _getLockedChats();
        Object.keys(locks).forEach(chatId => {
          if (locks[chatId] && locks[chatId].locked) {
            _hideChatElement(chatId);
          }
        });
        _renderLockedFolder();
      };
    }
  }

  /* ── Open chat interception ── */

  function _patchOpenChat() {
    const origOpenChat = window.openChat;
    if (typeof origOpenChat === 'function') {
      let _unlockTarget = null;
      window.openChat = function (chatId) {
        if (isLockedChat(chatId) && _unlockTarget !== chatId) {
          _unlockTarget = null;
          authenticate('Authenticate to open this chat').then(ok => {
            if (ok) {
              _unlockTarget = chatId;
              origOpenChat(chatId);
            }
          });
          return;
        }
        _unlockTarget = null;
        return origOpenChat(chatId);
      };
    }
  }

  /* ── Chat item rendering patch ── */

  function _patchChatItemHTML() {
    const origChatItemHTML = window.chatItemHTML;
    if (typeof origChatItemHTML === 'function') {
      window.chatItemHTML = function (chat) {
        const html = origChatItemHTML(chat);
        if (isLockedChat(chat.id)) {
          return html.replace(
            /(<span class="font-bold text-on-surface truncate[^"]*">)/,
            '$1<span class="material-symbols-outlined text-[14px] align-middle mr-1 opacity-60 mat-icon--filled" style="color:#008069">lock</span>'
          );
        }
        return html;
      };
    }
  }

  /* ── Visibility change: re-lock on tab hide ── */

  function _setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        _clearSession();
        const overlay = document.getElementById('locked-chats-list-overlay');
        if (overlay) overlay.remove();
      }
    });
  }

  /* ── Init ── */

  async function init() {
    _injectStyles();

    // Load from Firestore if needed
    const locks = _getLockedChats();
    if (Object.keys(locks).length === 0) {
      const remote = await _loadFromFirestore();
      if (remote) _saveLockedChats(remote);
    }

    // Patch rendering
    _patchChatListRendering();
    _patchOpenChat();
    _patchChatItemHTML();
    _setupVisibilityHandler();

    _debug('Initialized, locked chats:', _getLockedCount());
  }

  /* ── Expose on window ── */

  window.LockChat = {
    init: init,
    lockChat: lockChat,
    unlockChat: unlockChat,
    getLockedChats: getLockedChats,
    authenticate: authenticate,
    isLockedChat: isLockedChat,
    shouldShowContent: shouldShowContent,
    getNotificationBody: getNotificationBody,
    filterSearchResults: filterSearchResults,
    shouldShowInGallery: shouldShowInGallery,
    addLockOption: addLockOption,
    getLockedCount: _getLockedCount
  };

  // Legacy compatibility: expose on window directly
  window.lockChat = lockChat;
  window.unlockChat = unlockChat;
  window.isChatLocked = isLockedChat;
  window.toggleChatLock = function (chatId) {
    if (isLockedChat(chatId)) unlockChat(chatId);
    else lockChat(chatId);
  };

  document.addEventListener('nsl:app-ready', init);
  if (document.readyState !== 'loading') init();
})();
