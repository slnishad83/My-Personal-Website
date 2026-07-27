/**
 * Live Location Sharing â€” Leaflet + OpenStreetMap
 * Real-time GPS location broadcast with full interactive map UI.
 * Uses navigator.geolocation, Firestore for real-time sync,
 * and Leaflet (free, no API key) for mapping.
 */
(function () {
  'use strict';

  var _mapInstance = null;
  var _mapMarker = null;
  var _mapCircle = null;
  var _watchId = null;
  var _activeShares = new Map();
  var _timers = new Map();
  var _leafletLoaded = false;
  var _activeOverlay = null;

  function _toast(msg, t) {
    if (typeof showToast === 'function') showToast(msg, t);
  }

  function _esc(s) {
    return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
  }

  function _loadLeaflet() {
    if (_leafletLoaded || (window.L && window.L.map)) {
      _leafletLoaded = true;
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      var existingCSS = document.querySelector('link[href*="leaflet"]');
      if (!existingCSS) {
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        css.crossOrigin = 'anonymous';
        document.head.appendChild(css);
      }
      var existingJS = document.querySelector('script[src*="leaflet"]');
      if (existingJS) {
        _leafletLoaded = true;
        resolve();
        return;
      }
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = 'anonymous';
      script.onload = function () {
        _leafletLoaded = true;
        resolve();
      };
      script.onerror = function () {
        reject(new Error('Failed to load Leaflet'));
      };
      document.head.appendChild(script);
    });
  }

  /* â”€â”€ Leaflet tile URLs (free, no key) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var TILE_ATTR = '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

  var DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  var DARK_TILE_ATTR = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

  /* â”€â”€ CSS injection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function _injectStyles() {
    if (document.getElementById('ll-styles')) return;
    var s = document.createElement('style');
    s.id = 'll-styles';
    s.textContent =
      '#ll-map-overlay{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:llFadeIn .2s ease}' +
      '#ll-map-panel{background:var(--surface-container,#1e1e2e);border-radius:20px;overflow:hidden;max-width:500px;width:92vw;height:75vh;display:flex;flex-direction:column;color:var(--on-surface);box-shadow:0 8px 40px rgba(0,0,0,0.4)}' +
      '#ll-map-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.1))}' +
      '#ll-map-header h3{margin:0;font-size:15px;font-weight:700}' +
      '#ll-map-header-actions{display:flex;gap:8px}' +
      '#ll-map-header-actions button{padding:6px 12px;border-radius:8px;border:none;font-size:12px;font-weight:600;cursor:pointer}' +
      '#ll-stop-btn{background:var(--error,#ef4444);color:white}' +
      '#ll-close-btn{background:none;border:none;color:var(--on-surface-variant,#999);font-size:20px;padding:4px}' +
      '#ll-map-container{flex:1;position:relative;overflow:hidden}' +
      '#ll-map-leaflet{width:100%;height:100%;min-height:300px}' +
      '#ll-map-footer{padding:10px 16px;border-top:1px solid var(--outline-variant,rgba(0,0,0,0.1));font-size:11px;display:flex;justify-content:space-between;align-items:center}' +
      '#ll-map-coords{color:var(--on-surface-variant,#999);font-family:monospace}' +
      '#ll-map-status{color:var(--on-surface-variant,#999);font-size:10px}' +
      '.ll-picker-overlay{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);animation:llFadeIn .2s ease}' +
      '.ll-picker-sheet{background:var(--surface-container,#1e1e2e);border-radius:20px;padding:20px;max-width:340px;width:90vw;color:var(--on-surface);box-shadow:0 8px 40px rgba(0,0,0,0.4);animation:llSlideUp .25s ease}' +
      '.ll-picker-title{text-align:center;margin-bottom:20px}' +
      '.ll-picker-title h3{margin:0 0 4px;font-size:16px;font-weight:700}' +
      '.ll-picker-title p{font-size:12px;color:var(--on-surface-variant,#999);margin:0}' +
      '.ll-duration-btn{padding:14px;border-radius:12px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,#252535);color:var(--on-surface,#e9edef);font-size:14px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between;width:100%}' +
      '.ll-duration-btn:hover{border-color:var(--primary,#6750A4);background:var(--surface-container,#1e1e2e)}' +
      '.ll-cancel-btn{padding:10px;border-radius:10px;border:none;background:transparent;color:var(--on-surface-variant,#999);font-size:13px;cursor:pointer;margin-top:8px;width:100%}' +
      '@keyframes llFadeIn{from{opacity:0}to{opacity:1}}' +
      '@keyframes llSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';
    document.head.appendChild(s);
  }

  /* â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var LiveLocation = {

    init: function () {
      _injectStyles();
    },

    startSharing: async function (chatId, chatType, durationMinutes) {
      if (!navigator.geolocation) {
        _toast('Geolocation not supported', 'error');
        return;
      }

      var user = window.App && window.App.auth && window.App.auth.currentUser;
      if (!user) return;

      var durationMs = durationMinutes * 60 * 1000;
      var expiresAt = Date.now() + durationMs;

      try {
        var pos = await new Promise(function (resolve, reject) {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });

        var shareDoc = await window.App.db.collection('liveLocations').add({
          chatId: chatId,
          chatType: chatType,
          userId: user.uid,
          userName: user.displayName || 'User',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          startedAt: new Date(),
          expiresAt: new Date(expiresAt),
          active: true
        });

        this._activeShares.set(shareDoc.id, { chatId: chatId, expiresAt: expiresAt });

        var self = this;
        _watchId = navigator.geolocation.watchPosition(
          async function (position) {
            try {
              await window.App.db.collection('liveLocations').doc(shareDoc.id).update({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                updatedAt: new Date()
              });
            } catch (_) {}
          },
          function (err) {
            if (window.__DEBUG__) console.warn('[LiveLocation] Watch error:', err);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 5000
          }
        );

        var timer = setTimeout(function () {
          self.stopSharing(shareDoc.id);
        }, durationMs);
        this._timers.set(shareDoc.id, timer);

        _toast('Live location sharing started (' + durationMinutes + 'min)', 'success');
        this.showLiveOnMap(chatId, shareDoc.id, pos.coords.latitude, pos.coords.longitude);
      } catch (e) {
        if (window.__DEBUG__) console.error('[LiveLocation] Start error:', e);
        if (e.code === 1) {
          _toast('Location permission denied', 'error');
        } else {
          _toast('Failed to start live location', 'error');
        }
      }
    },

    stopSharing: async function (shareId) {
      if (_watchId !== null) {
        navigator.geolocation.clearWatch(_watchId);
        _watchId = null;
      }

      if (shareId && window.App && window.App.db) {
        try {
          await window.App.db.collection('liveLocations').doc(shareId).update({
            active: false,
            endedAt: new Date()
          });
        } catch (_) {}
      }

      this._activeShares.delete(shareId);
      clearTimeout(this._timers.get(shareId));
      this._timers.delete(shareId);

      _toast('Live location sharing stopped', 'info');
    },

    stopAll: async function () {
      var self = this;
      for (var entry of this._activeShares) {
        await self.stopSharing(entry[0]);
      }
      if (_watchId !== null) {
        navigator.geolocation.clearWatch(_watchId);
        _watchId = null;
      }
    },

    showLiveOnMap: function (chatId, shareId, lat, lng) {
      var self = this;
      _removeOverlay();

      var isDark = document.documentElement.classList.contains('dark');

      var overlay = document.createElement('div');
      overlay.id = 'll-map-overlay';
      overlay.onclick = function (e) {
        if (e.target === overlay) _removeOverlay();
      };

      var panel = document.createElement('div');
      panel.id = 'll-map-panel';

      panel.innerHTML =
        '<div id="ll-map-header">' +
          '<h3>ðŸ“ Live Location</h3>' +
          '<div id="ll-map-header-actions">' +
            '<button id="ll-stop-btn">Stop Sharing</button>' +
            '<button id="ll-close-btn">&times;</button>' +
          '</div>' +
        '</div>' +
        '<div id="ll-map-container"><div id="ll-map-leaflet"></div></div>' +
        '<div id="ll-map-footer">' +
          '<span id="ll-map-coords">' + _esc(lat.toFixed(6)) + ', ' + _esc(lng.toFixed(6)) + '</span>' +
          '<span id="ll-map-status">Updating...</span>' +
        '</div>';

      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      _activeOverlay = overlay;

      document.getElementById('ll-close-btn').onclick = function () { _removeOverlay(); };
      document.getElementById('ll-stop-btn').onclick = async function () {
        await self.stopSharing(shareId);
        _removeOverlay();
      };

      setTimeout(function () {
        self._initMap(shareId, lat, lng, isDark);
      }, 100);
    },

    _initMap: async function (shareId, lat, lng, isDark) {
      try {
        await _loadLeaflet();
      } catch (e) {
        _toast('Failed to load map', 'error');
        return;
      }

      var container = document.getElementById('ll-map-leaflet');
      if (!container || !window.L) return;

      _mapInstance = L.map(container, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
        attributionControl: true
      });

      var tileUrl = isDark ? DARK_TILE_URL : TILE_URL;
      var tileAttr = isDark ? DARK_TILE_ATTR : TILE_ATTR;

      L.tileLayer(tileUrl, { attribution: tileAttr, maxZoom: 19 }).addTo(_mapInstance);

      var pinIcon = L.divIcon({
        className: '',
        html: '<div style="width:36px;height:36px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><span style="color:white;font-size:16px">ðŸ“</span></div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      _mapMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(_mapInstance);

      _mapCircle = L.circle([lat, lng], {
        radius: 50,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.1,
        weight: 1
      }).addTo(_mapInstance);

      setTimeout(function () { _mapInstance.invalidateSize(); }, 200);

      var coordsEl = document.getElementById('ll-map-coords');
      var statusEl = document.getElementById('ll-map-status');

      var unsub = window.App.db.collection('liveLocations').doc(shareId).onSnapshot(function (doc) {
        var data = doc.data();
        if (data && coordsEl) {
          coordsEl.textContent = data.latitude.toFixed(6) + ', ' + data.longitude.toFixed(6);
          if (statusEl) statusEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
          if (_mapMarker) _mapMarker.setLatLng([data.latitude, data.longitude]);
          if (_mapCircle) {
            _mapCircle.setLatLng([data.latitude, data.longitude]);
            _mapCircle.setRadius(Math.min(data.accuracy || 50, 200));
          }
        }
        if (data && !data.active) {
          if (statusEl) statusEl.textContent = 'Sharing ended';
          if (_mapMarker) {
            var endedIcon = L.divIcon({
              className: '',
              html: '<div style="width:36px;height:36px;border-radius:50%;background:#6b7280;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><span style="color:white;font-size:16px">â¹ï¸</span></div>',
              iconSize: [36, 36],
              iconAnchor: [18, 18]
            });
            _mapMarker.setIcon(endedIcon);
          }
          unsub();
        }
      }, function (err) {
        if (window.__DEBUG__) console.error('[LiveLocation] Snapshot error:', err?.message || err);
      });
    },

    openSharePicker: function (chatId, chatType) {
      _injectStyles();
      _removeOverlay();

      var self = this;
      var overlay = document.createElement('div');
      overlay.className = 'll-picker-overlay';
      overlay.onclick = function (e) { if (e.target === overlay) _removeOverlay(); };

      var sheet = document.createElement('div');
      sheet.className = 'll-picker-sheet';

      sheet.innerHTML =
        '<div class="ll-picker-title">' +
          '<div style="width:48px;height:48px;border-radius:50%;background:rgba(0,191,165,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">' +
            '<span class="material-symbols-outlined" style="font-size:24px;color:var(--primary)">share_location</span>' +
          '</div>' +
          '<h3>Share Live Location</h3>' +
          '<p>Others will see your real-time location</p>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<button class="ll-duration-btn" data-mins="15"><span>15 minutes</span><span class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">timer</span></button>' +
          '<button class="ll-duration-btn" data-mins="60"><span>1 hour</span><span class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">timer</span></button>' +
          '<button class="ll-duration-btn" data-mins="480"><span>8 hours</span><span class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">timer</span></button>' +
          '<button class="ll-cancel-btn" data-action="ll-cancel">Cancel</button>' +
        '</div>';

      overlay.appendChild(sheet);
      document.body.appendChild(overlay);
      _activeOverlay = overlay;

      sheet.querySelectorAll('.ll-duration-btn').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var mins = parseInt(btn.dataset.mins, 10);
          _removeOverlay();
          await self.startSharing(chatId, chatType, mins);
        });
      });

      sheet.querySelector('.ll-cancel-btn').onclick = function () { _removeOverlay(); };
    }
  };

  function _removeOverlay() {
    if (_activeOverlay) {
      _activeOverlay.remove();
      _activeOverlay = null;
    }
    if (_mapInstance) {
      try { _mapInstance.remove(); } catch (_) {}
      _mapInstance = null;
    }
    _mapMarker = null;
    _mapCircle = null;
  }

  window.LiveLocation = LiveLocation;

  document.addEventListener('nsl:app-ready', function () {
    LiveLocation.init();
  });

})();
