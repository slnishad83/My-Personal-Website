/**
 * Two-Step Verification (2FA PIN)
 * Adds a PIN verification step after password login for account security.
 * PIN is hashed server-side via Cloud Functions (PBKDF2, 100k iterations).
 */
(function () {
  'use strict';

  const ATTEMPTS_KEY = 'nsl_2fa_attempts';
  const LOCKOUT_KEY = 'nsl_2fa_lockout';
  const VERIFIED_KEY = 'nsl_2fa_verified_session';
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 60000;

  const TwoFactorAuth = {
    _enabled: false,
    _verifiedThisSession: false,

    async init() {
      this._verifiedThisSession = sessionStorage.getItem(VERIFIED_KEY) === '1';
    },

    isEnabled() {
      return this._enabled;
    },

    setEnabled(val) {
      this._enabled = !!val;
    },

    isVerifiedThisSession() {
      return this._verifiedThisSession;
    },

    markVerified() {
      this._verifiedThisSession = true;
      sessionStorage.setItem(VERIFIED_KEY, '1');
    },

    clearSession() {
      this._verifiedThisSession = false;
      sessionStorage.removeItem(VERIFIED_KEY);
    },

    _showPinEntryModal(title, subtitle, callback, showOldPin, singlePinOnly) {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';
      const panel = document.createElement('div');
      panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:24px;padding:32px;max-width:340px;width:90vw;text-align:center;color:var(--on-surface)';
      const inputStyle = 'width:100%;padding:14px;border-radius:12px;border:2px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:24px;text-align:center;letter-spacing:8px;margin-bottom:8px;outline:none;box-sizing:border-box';
      panel.innerHTML = `
        <h3 style="margin:0 0 4px;font-size:18px;font-weight:700">${title}</h3>
        <p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 16px">${subtitle}</p>
        ${showOldPin ? '<input type="password" inputmode="numeric" id="pin-modal-old" placeholder="Current PIN" maxlength="8" style="' + inputStyle + '">' : ''}
        <input type="password" inputmode="numeric" id="pin-modal-new" placeholder="${singlePinOnly ? 'Enter PIN' : 'New PIN'}" maxlength="8" style="${inputStyle}">
        ${!singlePinOnly ? '<input type="password" inputmode="numeric" id="pin-modal-confirm" placeholder="Confirm PIN" maxlength="8" style="' + inputStyle + '">' : ''}
        <p id="pin-modal-error" style="color:var(--error);font-size:12px;margin:0 0 12px;display:none"></p>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button id="pin-modal-ok" style="padding:14px;border-radius:14px;border:none;background:var(--primary);color:var(--on-primary);font-size:14px;font-weight:700;cursor:pointer">Verify</button>
          <button id="pin-modal-cancel" style="padding:10px;border-radius:10px;border:none;background:transparent;color:var(--on-surface-variant);font-size:13px;cursor:pointer">Cancel</button>
        </div>`;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      const firstInput = panel.querySelector(showOldPin ? '#pin-modal-old' : '#pin-modal-new');
      if (firstInput) firstInput.focus();
      panel.querySelector('#pin-modal-cancel').addEventListener('click', () => overlay.remove());
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      panel.querySelector('#pin-modal-ok').addEventListener('click', () => {
        const oldPin = showOldPin ? panel.querySelector('#pin-modal-old').value.trim() : undefined;
        const newPin = panel.querySelector('#pin-modal-new').value.trim();
        const confirmPin = singlePinOnly ? newPin : (panel.querySelector('#pin-modal-confirm')?.value?.trim() || '');
        const errorEl = panel.querySelector('#pin-modal-error');
        if (showOldPin && !oldPin) { errorEl.textContent = 'Enter current PIN'; errorEl.style.display = 'block'; return; }
        if (!newPin || !/^\d{4,8}$/.test(newPin)) { errorEl.textContent = 'PIN must be 4-8 digits'; errorEl.style.display = 'block'; return; }
        if (!singlePinOnly && newPin !== confirmPin) { errorEl.textContent = 'PINs do not match'; errorEl.style.display = 'block'; return; }
        overlay.remove();
        if (singlePinOnly) callback(newPin);
        else callback(newPin, confirmPin, oldPin);
      });
    },

    _checkRateLimit() {
      const lockoutUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0');
      if (Date.now() < lockoutUntil) {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        return { allowed: false, remaining };
      }
      return { allowed: true, remaining: 0 };
    },

    _recordFailedAttempt() {
      const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0') + 1;
      localStorage.setItem(ATTEMPTS_KEY, attempts.toString());
      if (attempts >= MAX_ATTEMPTS) {
        localStorage.setItem(LOCKOUT_KEY, (Date.now() + LOCKOUT_MS).toString());
        localStorage.setItem(ATTEMPTS_KEY, '0');
      }
    },

    _clearAttempts() {
      localStorage.setItem(ATTEMPTS_KEY, '0');
      localStorage.removeItem(LOCKOUT_KEY);
    },

    async checkHasPin() {
      try {
        if (!App.db || !App.auth?.currentUser) return false;
        const doc = await App.db.collection('users').doc(App.auth.currentUser.uid).get();
        const d = doc.data() || {};
        return !!(d.twofaPinHash && d.twofaPinSalt);
      } catch (_) {
        return false;
      }
    },

    async setPin(pin, oldPin) {
      if (!pin || typeof pin !== 'string' || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
        showToast('PIN must be 4-8 digits', 'error');
        return false;
      }
      try {
        const fn = firebase.functions().httpsCallable('setTwoFactorPin');
        await fn({ pin, oldPin });
        this._enabled = true;
        showToast('Two-step verification enabled', 'success');
        return true;
      } catch (e) {
        showToast(e.message || 'Failed to set PIN', 'error');
        return false;
      }
    },

    async verifyPin(pin) {
      const rateCheck = this._checkRateLimit();
      if (!rateCheck.allowed) {
        showToast(`Too many attempts. Try again in ${rateCheck.remaining}s`, 'error');
        return false;
      }
      try {
        const fn = firebase.functions().httpsCallable('verifyTwoFactorPin');
        const result = await fn({ pin });
        this._clearAttempts();
        if (result.data?.isNew) {
          this._enabled = true;
          showToast('Two-step verification PIN set', 'success');
        }
        return true;
      } catch (e) {
        this._recordFailedAttempt();
        if (e.code === 'permission-denied') {
          showToast('Incorrect PIN', 'error');
        } else {
          showToast(e.message || 'Verification failed', 'error');
        }
        return false;
      }
    },

    async resetPin() {
      try {
        const fn = firebase.functions().httpsCallable('resetTwoFactorPin');
        await fn({});
        this._enabled = false;
        this.clearSession();
        this._clearAttempts();
        showToast('Two-step verification disabled', 'success');
        return true;
      } catch (e) {
        showToast(e.message || 'Reset failed', 'error');
        return false;
      }
    },

    promptVerification(callback) {
      const overlay = document.createElement('div');
      overlay.id = 'twofa-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

      const panel = document.createElement('div');
      panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:24px;padding:32px;max-width:340px;width:90vw;text-align:center;color:var(--on-surface)';

      panel.innerHTML = `
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(0,191,165,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <span class="material-symbols-outlined" style="font-size:32px;color:var(--primary)">security</span>
        </div>
        <h3 style="margin:0 0 4px;font-size:18px;font-weight:700">Two-Step Verification</h3>
        <p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 20px">Enter your 2FA PIN to continue</p>
        <input type="password" inputmode="numeric" id="twofa-pin-input" placeholder="Enter PIN" maxlength="8"
          style="width:100%;padding:14px;border-radius:12px;border:2px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:24px;text-align:center;letter-spacing:8px;margin-bottom:8px;outline:none;box-sizing:border-box">
        <p id="twofa-error" style="color:var(--error);font-size:12px;margin:0 0 16px;display:none">Incorrect PIN</p>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button id="twofa-verify-btn" style="padding:14px;border-radius:14px;border:none;background:var(--primary);color:var(--on-primary);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
            <span class="material-symbols-outlined" style="font-size:20px">verified_user</span> Verify
          </button>
          <button onclick="document.getElementById('twofa-overlay')?.remove()" style="padding:10px;border-radius:10px;border:none;background:transparent;color:var(--on-surface-variant);font-size:13px;cursor:pointer">Cancel</button>
        </div>`;

      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      const pinInput = document.getElementById('twofa-pin-input');
      const verifyBtn = document.getElementById('twofa-verify-btn');
      const errorEl = document.getElementById('twofa-error');
      pinInput?.focus();

      const handleVerify = async () => {
        const val = pinInput?.value?.trim();
        if (!val) return;
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:20px">progress_activity</span> Verifying...';
        const ok = await this.verifyPin(val);
        if (ok) {
          this.markVerified();
          overlay.remove();
          if (callback) callback();
        } else {
          errorEl.style.display = 'block';
          pinInput.value = '';
          pinInput.style.borderColor = 'var(--error)';
          setTimeout(() => { pinInput.style.borderColor = 'var(--outline-variant,rgba(0,0,0,0.1))'; }, 1000);
          verifyBtn.disabled = false;
          verifyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">verified_user</span> Verify';
        }
      };

      verifyBtn?.addEventListener('click', handleVerify);
      pinInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleVerify();
      });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); if (typeof firebase !== 'undefined') firebase.auth().signOut(); } });
    },

    openSettings() {
      const overlay = document.createElement('div');
      overlay.id = 'twofa-settings-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

      const panel = document.createElement('div');
      panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:400px;width:92vw;max-height:80vh;overflow-y:auto;color:var(--on-surface)';

      const statusColor = this._enabled ? 'var(--primary)' : 'var(--on-surface-variant)';
      const statusText = this._enabled ? 'Enabled' : 'Disabled';
      const statusIcon = this._enabled ? 'check_circle' : 'cancel';

      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;font-size:18px;font-weight:700">Two-Step Verification</h3>
          <button onclick="document.getElementById('twofa-settings-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
        </div>
        <div style="display:flex;align-items:center;gap:12px;padding:16px;border-radius:12px;background:${this._enabled ? 'rgba(0,191,165,0.1)' : 'rgba(0,0,0,0.04)'};margin-bottom:16px">
          <span class="material-symbols-outlined" style="font-size:24px;color:${statusColor}">${statusIcon}</span>
          <div>
            <p style="margin:0;font-size:14px;font-weight:600">Status: ${statusText}</p>
            <p style="margin:2px 0 0;font-size:11px;color:var(--on-surface-variant)">Extra security layer for your account</p>
          </div>
        </div>
        <p style="font-size:12px;color:var(--on-surface-variant);margin:0 0 16px;line-height:1.5">When enabled, you'll need to enter a PIN after your password to access your account. PINs are encrypted server-side with PBKDF2 (100k iterations).</p>
        <div id="twofa-settings-actions"></div>`;

      const actionsDiv = panel.querySelector('#twofa-settings-actions');

      if (this._enabled) {
        actionsDiv.innerHTML = `
          <button id="twofa-change-pin-btn" style="width:100%;padding:12px;border-radius:10px;border:none;background:var(--surface-container,rgba(0,0,0,0.08));color:var(--on-surface);font-size:13px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span class="material-symbols-outlined" style="font-size:18px">pin</span> Change PIN
          </button>
          <button id="twofa-disable-btn" style="width:100%;padding:12px;border-radius:10px;border:none;background:var(--error-container,rgba(255,0,0,0.08));color:var(--error);font-size:13px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px">
            <span class="material-symbols-outlined" style="font-size:18px">lock_open</span> Disable Two-Step Verification
          </button>`;
      } else {
        actionsDiv.innerHTML = `
          <button id="twofa-enable-btn" style="width:100%;padding:12px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
            <span class="material-symbols-outlined" style="font-size:18px">lock</span> Enable Two-Step Verification
          </button>`;
      }

      overlay.appendChild(panel);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);

      document.getElementById('twofa-enable-btn')?.addEventListener('click', () => {
        this._showPinEntryModal('Set 2FA PIN', 'Enter a 4-8 digit PIN', (pin, confirmPin) => {
          if (pin !== confirmPin) { showToast('PINs do not match', 'error'); return; }
          this.setPin(pin).then(ok => {
            if (ok) { overlay.remove(); this.openSettings(); }
          });
        });
      });

      document.getElementById('twofa-change-pin-btn')?.addEventListener('click', () => {
        this._showPinEntryModal('Change 2FA PIN', 'Enter new 4-8 digit PIN', (newPin, confirmPin, oldPin) => {
          if (newPin !== confirmPin) { showToast('PINs do not match', 'error'); return; }
          this.setPin(newPin, oldPin).then(ok => {
            if (ok) { overlay.remove(); this.openSettings(); }
          });
        }, true);
      });

      document.getElementById('twofa-disable-btn')?.addEventListener('click', async () => {
        if (!confirm('Disable two-step verification? Your account will be less secure.')) return;
        this._showPinEntryModal('Verify PIN', 'Enter your current PIN to disable', async (pin) => {
          const ok = await this.verifyPin(pin);
          if (ok) {
            await this.resetPin();
            overlay.remove();
            this.openSettings();
          }
        }, false, true);
      });
    }
  };

  window.TwoFactorAuth = TwoFactorAuth;

  document.addEventListener('nsl:app-ready', () => {
    TwoFactorAuth.init();
  });
})();
