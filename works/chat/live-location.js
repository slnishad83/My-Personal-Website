/**
 * Live Location Sharing
 * Real-time GPS location broadcast to chat participants.
 * Uses navigator.geolocation and Firestore for real-time sync.
 */
(function () {
  'use strict';

  const LiveLocation = {
    _watchId: null,
    _activeShares: new Map(),
    _intervals: new Map(),

    init() {},

    async startSharing(chatId, chatType, durationMinutes) {
      if (!navigator.geolocation) {
        showToast('Geolocation not supported', 'error');
        return;
      }

      const user = App.auth?.currentUser;
      if (!user) return;

      const durationMs = durationMinutes * 60 * 1000;
      const expiresAt = Date.now() + durationMs;

      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });

        const shareDoc = await App.db.collection('liveLocations').add({
          chatId,
          chatType,
          userId: user.uid,
          userName: user.displayName || 'User',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          startedAt: new Date(),
          expiresAt: new Date(expiresAt),
          active: true,
        });

        this._activeShares.set(shareDoc.id, { chatId, expiresAt });

        this._watchId = navigator.geolocation.watchPosition(
          async (position) => {
            try {
              await App.db.collection('liveLocations').doc(shareDoc.id).update({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                updatedAt: new Date(),
              });
            } catch (_) {}
          },
          (err) => {
            console.warn('[LiveLocation] Watch error:', err);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 5000,
          }
        );

        const expireTimer = setTimeout(() => {
          this.stopSharing(shareDoc.id);
        }, durationMs);
        this._intervals.set(shareDoc.id, expireTimer);

        showToast(`Live location sharing started (${durationMinutes}min)`, 'success');
        this.showLiveOnMap(chatId, shareDoc.id, pos.coords.latitude, pos.coords.longitude);
      } catch (e) {
        console.error('[LiveLocation] Start error:', e);
        if (e.code === 1) {
          showToast('Location permission denied', 'error');
        } else {
          showToast('Failed to start live location', 'error');
        }
      }
    },

    async stopSharing(shareId) {
      if (this._watchId !== null) {
        navigator.geolocation.clearWatch(this._watchId);
        this._watchId = null;
      }

      if (shareId && App.db) {
        try {
          await App.db.collection('liveLocations').doc(shareId).update({
            active: false,
            endedAt: new Date(),
          });
        } catch (_) {}
      }

      this._activeShares.delete(shareId);
      clearTimeout(this._intervals.get(shareId));
      this._intervals.delete(shareId);

      showToast('Live location sharing stopped', 'info');
    },

    async stopAll() {
      for (const [shareId] of this._activeShares) {
        await this.stopSharing(shareId);
      }
      if (this._watchId !== null) {
        navigator.geolocation.clearWatch(this._watchId);
        this._watchId = null;
      }
    },

    showLiveOnMap(chatId, shareId, lat, lng) {
      const overlay = document.createElement('div');
      overlay.id = 'live-location-map';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

      const panel = document.createElement('div');
      panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;overflow:hidden;max-width:500px;width:92vw;height:70vh;display:flex;flex-direction:column;color:var(--on-surface)';

      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.1))">
          <h3 style="margin:0;font-size:16px;font-weight:700">Live Location</h3>
          <div style="display:flex;gap:8px">
            <button id="live-loc-stop-btn" style="padding:6px 12px;border-radius:8px;border:none;background:var(--error);color:white;font-size:12px;font-weight:600;cursor:pointer">Stop Sharing</button>
            <button onclick="document.getElementById('live-location-map')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
          </div>
        </div>
        <div id="live-loc-map-container" style="flex:1;background:var(--surface-container-low);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
          <div style="text-align:center;padding:20px">
            <span class="material-symbols-outlined" style="font-size:48px;color:var(--primary);display:block;margin-bottom:8px">map</span>
            <p style="font-size:13px;color:var(--on-surface-variant);margin:0" id="live-loc-coords">${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
            <p style="font-size:11px;color:var(--on-surface-variant);margin:4px 0 0;opacity:0.7" id="live-loc-status">Updating...</p>
          </div>
        </div>`;

      overlay.appendChild(panel);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);

      document.getElementById('live-loc-stop-btn')?.addEventListener('click', async () => {
        await this.stopSharing(shareId);
        overlay.remove();
      });

      const coordsEl = document.getElementById('live-loc-coords');
      const statusEl = document.getElementById('live-loc-status');
      if (coordsEl) {
        coordsEl.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }

      const unsub = App.db.collection('liveLocations').doc(shareId).onSnapshot((doc) => {
        const data = doc.data();
        if (data && coordsEl) {
          coordsEl.textContent = `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`;
          if (statusEl) statusEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;
        }
        if (data && !data.active) {
          if (statusEl) statusEl.textContent = 'Sharing ended';
          unsub();
        }
      });
    },

    openSharePicker(chatId, chatType) {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

      const panel = document.createElement('div');
      panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:340px;width:90vw;color:var(--on-surface)';

      panel.innerHTML = `
        <div style="text-align:center;margin-bottom:20px">
          <div style="width:48px;height:48px;border-radius:50%;background:rgba(0,191,165,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
            <span class="material-symbols-outlined" style="font-size:24px;color:var(--primary)">share_location</span>
          </div>
          <h3 style="margin:0 0 4px;font-size:16px;font-weight:700">Share Live Location</h3>
          <p style="font-size:12px;color:var(--on-surface-variant);margin:0">Others will see your real-time location</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="live-loc-duration-btn" data-mins="15" style="padding:14px;border-radius:12px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low);color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between">
            <span>15 minutes</span><span class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">timer</span>
          </button>
          <button class="live-loc-duration-btn" data-mins="60" style="padding:14px;border-radius:12px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low);color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between">
            <span>1 hour</span><span class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">timer</span>
          </button>
          <button class="live-loc-duration-btn" data-mins="480" style="padding:14px;border-radius:12px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low);color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between">
            <span>8 hours</span><span class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">timer</span>
          </button>
          <button onclick="document.getElementById('live-location-picker')?.parentElement?.remove()" style="padding:10px;border-radius:10px;border:none;background:transparent;color:var(--on-surface-variant);font-size:13px;cursor:pointer;margin-top:4px">Cancel</button>
        </div>`;

      overlay.appendChild(panel);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);

      panel.querySelectorAll('.live-loc-duration-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const mins = parseInt(btn.dataset.mins, 10);
          overlay.remove();
          await this.startSharing(chatId, chatType, mins);
        });
      });
    }
  };

  window.LiveLocation = LiveLocation;

  document.addEventListener('nsl:app-ready', () => {
    LiveLocation.init();
  });
})();
