/* ============================================================
   MULTI-DEVICE — Session tracking, device management
   Tracks active sessions, allows device revocation
   ============================================================ */
'use strict';

const MultiDevice = {
  _currentSessionId: null,
  _cleanupTimer: null,
  _staleThreshold: 120000,

  /** Register this browser/tab as an active session in Firestore. */
  async init() {
    if (!window.db || !window.currentUser) return;
    this._currentSessionId = this._getOrCreateSessionId();
    await this._registerSession();
    this._startCleanup();
    console.debug('[MultiDevice] Session:', this._currentSessionId);
  },

  _getOrCreateSessionId() {
    try {
      let sid = sessionStorage.getItem('tcSessionId');
      if (!sid) {
        sid = this._generateSessionId();
        sessionStorage.setItem('tcSessionId', sid);
      }
      return sid;
    } catch (_) {
      return this._generateSessionId();
    }
  },

  _generateSessionId() {
    const ts = Date.now().toString(36);
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    const rand = Array.from(arr, b => b.toString(36).padStart(2, '0')).join('');
    const plat = (window.Platform?.os || 'web').slice(0, 3);
    return `${plat}-${ts}-${rand}`;
  },

  async _registerSession() {
    if (!window.db || !window.currentUser) return;
    try {
      const sessionData = {
        sessionId: this._currentSessionId,
        platform: window.Platform?.os || 'unknown',
        browser: window.Platform?.browser || 'unknown',
        deviceType: window.Platform?.isMobile ? 'mobile' : window.Platform?.isTablet ? 'tablet' : 'desktop',
        userAgent: navigator.userAgent.slice(0, 150),
        screenResolution: `${screen.width}x${screen.height}`,
        pixelRatio: window.devicePixelRatio,
        isStandalone: window.Platform?.isStandalone || false,
        isNativeApp: window.Platform?.isNativeApp || false,
        registeredAt: Date.now(),
        lastActive: Date.now(),
        isCurrent: true
      };
      await window.db.collection('users').doc(window.currentUser.uid)
        .collection('sessions').doc(this._currentSessionId).set(sessionData, { merge: true });
    } catch (e) {
      console.warn('[MultiDevice] Register session failed:', e);
    }
  },

  async _updateHeartbeat() {
    if (!window.db || !window.currentUser || !this._currentSessionId) return;
    try {
      await window.db.collection('users').doc(window.currentUser.uid)
        .collection('sessions').doc(this._currentSessionId).update({
          lastActive: Date.now()
        });
    } catch (e) { console.warn('[MultiDevice] Heartbeat failed:', e?.message || e); }
  },

  _startCleanup() {
    this._cleanupTimer = setInterval(() => this._updateHeartbeat(), 30000);
  },

  /**
   * Fetch all sessions for the current user, annotated with isCurrent and isOnline flags.
   * @returns {Promise<Array<Object>>} List of session records
   */
  async getActiveSessions() {
    if (!window.db || !window.currentUser) return [];
    try {
      const snap = await window.db.collection('users').doc(window.currentUser.uid)
        .collection('sessions').orderBy('lastActive', 'desc').get();
      const now = Date.now();
      return snap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          isCurrent: data.sessionId === this._currentSessionId,
          isOnline: (now - (data.lastActive || 0)) < this._staleThreshold
        };
      });
    } catch (e) { console.warn('[MultiDevice] getActiveSessions failed:', e?.message || e); return []; }
  },

  async revokeSession(sessionId) {
    if (!window.db || !window.currentUser) return false;
    try {
      await window.db.collection('users').doc(window.currentUser.uid)
        .collection('sessions').doc(sessionId).delete();
      return true;
    } catch (e) { console.warn('[MultiDevice] revokeSession failed:', e?.message || e); return false; }
  },

  async revokeAllSessions() {
    if (!window.db || !window.currentUser) return;
    try {
      const snap = await window.db.collection('users').doc(window.currentUser.uid)
        .collection('sessions').get();
      const batch = window.db.batch();
      snap.docs.forEach(doc => {
        if (doc.id !== this._currentSessionId) batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (e) { console.warn('[MultiDevice] revokeAllSessions failed:', e?.message || e); }
  },

  async removeCurrentSession() {
    if (!window.db || !window.currentUser || !this._currentSessionId) return;
    try {
      await window.db.collection('users').doc(window.currentUser.uid)
        .collection('sessions').doc(this._currentSessionId).delete();
    } catch (e) { console.warn('[MultiDevice] removeCurrentSession failed:', e?.message || e); }
  },

  getCurrentSessionId() { return this._currentSessionId; },

  /** Show linked devices management panel */
  async openLinkedDevices() {
    const sessions = await this.getActiveSessions();

    const overlay = document.createElement('div');
    overlay.id = 'linked-devices-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:420px;width:92vw;max-height:80vh;overflow-y:auto;color:var(--on-surface)';

    let devicesHtml = '';
    for (const s of sessions) {
      const statusColor = s.isCurrent ? 'var(--primary)' : (s.isOnline ? '#4caf50' : 'var(--on-surface-variant)');
      const statusText = s.isCurrent ? 'This device' : (s.isOnline ? 'Online' : 'Offline');
      const deviceIcon = s.deviceType === 'mobile' ? 'smartphone' : s.deviceType === 'tablet' ? 'tablet' : 'computer';
      const lastActiveText = s.isOnline ? 'Active now' : `Last active ${this._timeAgo(s.lastActive)}`;

      devicesHtml += `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;background:var(--surface-container-low);margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="material-symbols-outlined" style="font-size:22px;color:var(--primary)">${deviceIcon}</span>
            <div>
              <p style="margin:0;font-size:13px;font-weight:600">${escHtml(s.platform || 'Unknown')} / ${escHtml(s.browser || 'Unknown')}</p>
              <p style="margin:2px 0 0;font-size:10px;color:var(--on-surface-variant)">${statusText} · ${lastActiveText}</p>
            </div>
          </div>
          ${!s.isCurrent ? `<button class="revoke-device-btn" data-sid="${s.sessionId}" style="padding:4px 10px;border-radius:6px;border:1px solid var(--error);background:transparent;color:var(--error);font-size:11px;font-weight:600;cursor:pointer">Log out</button>` : ''}
        </div>`;
    }

    if (!sessions.length) {
      devicesHtml = '<p style="text-align:center;color:var(--on-surface-variant);font-size:13px;padding:20px 0">No devices found</p>';
    }

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:18px;font-weight:700">Linked Devices</h3>
        <button onclick="document.getElementById('linked-devices-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>
      <p style="font-size:11px;color:var(--on-surface-variant);margin:0 0 16px">Manage devices logged into your account.</p>
      <div id="devices-list">${devicesHtml}</div>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--outline-variant,rgba(0,0,0,0.1))">
        <button id="link-new-device-btn" style="width:100%;padding:12px;border-radius:10px;border:1px dashed var(--primary);background:transparent;color:var(--primary);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
          <span class="material-symbols-outlined" style="font-size:18px">add_link</span> Link New Device
        </button>
      </div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    panel.querySelectorAll('.revoke-device-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sid = btn.dataset.sid;
        if (confirm('Log out this device?')) {
          await this.revokeSession(sid);
          overlay.remove();
          this.openLinkedDevices();
        }
      });
    });

    document.getElementById('link-new-device-btn')?.addEventListener('click', () => {
      overlay.remove();
      this.openLinkNewDevice();
    });
  },

  /** QR Code device linking flow */
  async openLinkNewDevice() {
    const user = App.auth?.currentUser;
    if (!user) return;

    const pairingToken = this._generateSessionId();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    try {
      await App.db.collection('users').doc(user.uid).collection('pairingTokens').doc(pairingToken).set({
        token: pairingToken,
        createdAt: new Date(),
        expiresAt: new Date(expiresAt),
        used: false,
        deviceInfo: {
          platform: 'pending',
          browser: 'pending',
        },
      });
    } catch (e) {
      console.warn('[MultiDevice] Pairing token creation error:', e);
    }

    const pairingData = JSON.stringify({
      type: 'nsl-chat-pair',
      uid: user.uid,
      token: pairingToken,
      server: window.location.origin,
    });

    const overlay = document.createElement('div');
    overlay.id = 'link-device-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:360px;width:90vw;text-align:center;color:var(--on-surface)';

    panel.innerHTML = `
      <h3 style="margin:0 0 4px;font-size:18px;font-weight:700">Link New Device</h3>
      <p style="font-size:12px;color:var(--on-surface-variant);margin:0 0 20px">Scan this QR code with the other device</p>
      <div id="qr-code-container" style="background:white;padding:16px;border-radius:12px;display:inline-block;margin-bottom:16px">
        <canvas id="qr-canvas"></canvas>
      </div>
      <p style="font-size:11px;color:var(--on-surface-variant);margin:0 0 8px">Or enter this code manually:</p>
      <p style="font-size:16px;font-weight:700;color:var(--primary);font-family:monospace;letter-spacing:2px;margin:0 0 16px" id="pairing-code">${pairingToken.substring(0, 8).toUpperCase()}</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <p id="pairing-status" style="font-size:12px;color:var(--on-surface-variant);margin:0">Waiting for scan... <span class="animate-pulse">●</span></p>
        <button onclick="document.getElementById('link-device-overlay')?.remove()" style="padding:10px;border-radius:10px;border:none;background:transparent;color:var(--on-surface-variant);font-size:13px;cursor:pointer">Cancel</button>
      </div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    this._renderQRCode('qr-canvas', pairingData);

    const unsub = App.db.collection('users').doc(user.uid)
      .collection('pairingTokens').doc(pairingToken)
      .onSnapshot((doc) => {
        const data = doc.data();
        if (data?.used) {
          const statusEl = document.getElementById('pairing-status');
          if (statusEl) statusEl.innerHTML = '<span style="color:var(--primary)">✓ Device linked successfully!</span>';
          setTimeout(() => {
            overlay.remove();
            unsub();
          }, 2000);
        }
      });

    setTimeout(() => {
      unsub();
      const statusEl = document.getElementById('pairing-status');
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">QR code expired. Please try again.</span>';
    }, 5 * 60 * 1000);
  },

  _renderQRCode(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const size = 200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const matrix = this._generateQRMatrix(data, 4);
    const cellSize = size / matrix.length;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'black';

    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col]) {
          ctx.fillRect(col * cellSize, row * cellSize, cellSize + 0.5, cellSize + 0.5);
        }
      }
    }
  },

  _generateQRMatrix(text, errorLevel) {
    const len = text.length;
    const size = Math.max(21, Math.ceil(Math.sqrt(len * 8)) + 13);
    const matrix = [];
    for (let i = 0; i < size; i++) {
      matrix.push(new Array(size).fill(0));
    }

    const drawFinderPattern = (startRow, startCol) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix[startRow + r][startCol + c] = 1;
          }
        }
      }
    };

    drawFinderPattern(0, 0);
    drawFinderPattern(0, size - 7);
    drawFinderPattern(size - 7, 0);

    for (let i = 8; i < size - 8; i++) {
      matrix[Math.floor(size / 2)][i] = i % 2 === 0 ? 1 : 0;
      matrix[i][Math.floor(size / 2)] = i % 2 === 0 ? 1 : 0;
    }

    let bitIndex = 0;
    const bits = [];
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      for (let b = 7; b >= 0; b--) {
        bits.push((charCode >> b) & 1);
      }
    }
    while (bits.length < size * size) {
      bits.push(bits.length % 2);
    }

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (matrix[row][col] === 0 && row > 7 && row < size - 8 && col > 7 && col < size - 8) {
          if (bitIndex < bits.length) {
            matrix[row][col] = bits[bitIndex++];
          }
        }
      }
    }

    return matrix;
  },

  _timeAgo(timestamp) {
    if (!timestamp) return 'unknown';
    const now = Date.now();
    const ts = timestamp?.toDate ? timestamp.toDate().getTime() : (typeof timestamp === 'number' ? timestamp : 0);
    const diff = now - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  },

  /** Stop the cleanup timer and remove the current session from Firestore. */
  destroy() {
    if (this._cleanupTimer) { clearInterval(this._cleanupTimer); this._cleanupTimer = null; }
    this.removeCurrentSession();
  }
};

window.MultiDevice = MultiDevice;
