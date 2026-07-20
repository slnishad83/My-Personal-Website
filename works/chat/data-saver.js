/**
 * Data Saver Mode & Media Auto-Download Settings
 * Controls media auto-download behavior based on network type.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'nsl_data_saver_settings';

  const defaultSettings = {
    enabled: false,
    wifi: { photos: true, videos: true, audio: true, documents: true },
    mobile: { photos: true, videos: false, audio: false, documents: false },
    roaming: { photos: false, videos: false, audio: false, documents: false },
  };

  const DataSaver = {
    _settings: null,

    init() {
      this._settings = this._load();
      this._applyTheme();
    },

    _load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
      } catch (_) {
        return { ...defaultSettings };
      }
    },

    _save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._settings));
      } catch (_) {}
    },

    _applyTheme() {
      if (this._settings.enabled) {
        document.body.classList.add('data-saver');
      } else {
        document.body.classList.remove('data-saver');
      }
    },

    isEnabled() {
      return this._settings.enabled;
    },

    getNetworkType() {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!conn) return 'wifi';
      const type = conn.effectiveType || conn.type || '4g';
      if (type === 'slow-2g' || type === '2g' || type === '3g') return 'mobile';
      if (conn.saveData) return 'mobile';
      return 'wifi';
    },

    shouldAutoDownload(mediaType) {
      if (!this._settings.enabled) return true;
      const network = this.getNetworkType();
      const rules = this._settings[network] || this._settings.wifi;
      return rules[mediaType] !== false;
    },

    getSettings() {
      return { ...this._settings };
    },

    updateSetting(network, mediaType, value) {
      if (this._settings[network]) {
        this._settings[network][mediaType] = !!value;
        this._save();
      }
    },

    toggle(enabled) {
      this._settings.enabled = !!enabled;
      this._save();
      this._applyTheme();
    },

    openSettings() {
      const overlay = document.createElement('div');
      overlay.id = 'data-saver-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

      const panel = document.createElement('div');
      panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:420px;width:92vw;max-height:80vh;overflow-y:auto;color:var(--on-surface)';

      const currentNetwork = this.getNetworkType();
      const networkLabel = { wifi: 'WiFi', mobile: 'Mobile Data', roaming: 'Roaming' };
      const mediaTypes = ['photos', 'videos', 'audio', 'documents'];
      const mediaIcons = { photos: 'image', videos: 'videocam', audio: 'audiotrack', documents: 'description' };

      let networkRows = '';
      for (const network of ['wifi', 'mobile', 'roaming']) {
        let mediaToggles = '';
        for (const mt of mediaTypes) {
          const checked = this._settings[network][mt] ? 'checked' : '';
          mediaToggles += `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="material-symbols-outlined" style="font-size:16px;color:var(--on-surface-variant)">${mediaIcons[mt]}</span>
                <span style="font-size:13px;text-transform:capitalize">${mt}</span>
              </div>
              <button class="ds-toggle-btn" data-network="${network}" data-media="${mt}" data-checked="${checked}"
                style="width:40px;height:22px;border-radius:11px;border:none;cursor:pointer;position:relative;transition:background 0.2s;${checked ? 'background:var(--primary)' : 'background:var(--outline-variant)'}">
                <span style="position:absolute;top:2px;left:${checked ? '20px' : '2px'};width:18px;height:18px;border-radius:50%;background:white;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>
              </button>
            </div>`;
        }
        networkRows += `
          <div style="margin-bottom:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary)">${network === 'wifi' ? 'wifi' : network === 'mobile' ? 'signal_cellular_alt' : 'roaming'}</span>
              <span style="font-size:13px;font-weight:600">${networkLabel[network]}</span>
              ${network === currentNetwork ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--primary);color:var(--on-primary);font-weight:600">CURRENT</span>' : ''}
            </div>
            ${mediaToggles}
          </div>`;
      }

      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;font-size:18px;font-weight:700">Data Saver</h3>
          <button onclick="document.getElementById('data-saver-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px;border-radius:12px;background:var(--surface-container-low);margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="material-symbols-outlined" style="font-size:22px;color:var(--primary)">data_saver_on</span>
            <div>
              <p style="margin:0;font-size:14px;font-weight:600">Data Saver Mode</p>
              <p style="margin:2px 0 0;font-size:11px;color:var(--on-surface-variant)">Control media auto-download per network</p>
            </div>
          </div>
          <button id="ds-master-toggle" style="width:48px;height:26px;border-radius:13px;border:none;cursor:pointer;position:relative;transition:background 0.2s;${this._settings.enabled ? 'background:var(--primary)' : 'background:var(--outline-variant)'}">
            <span style="position:absolute;top:3px;left:${this._settings.enabled ? '25px' : '3px'};width:20px;height:20px;border-radius:50%;background:white;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>
          </button>
        </div>
        <div id="ds-network-settings" style="${this._settings.enabled ? '' : 'opacity:0.5;pointer-events:none'}">
          ${networkRows}
        </div>`;

      overlay.appendChild(panel);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);

      document.getElementById('ds-master-toggle')?.addEventListener('click', () => {
        this._settings.enabled = !this._settings.enabled;
        this._save();
        this._applyTheme();
        overlay.remove();
        this.openSettings();
      });

      panel.querySelectorAll('.ds-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const network = btn.dataset.network;
          const media = btn.dataset.media;
          const current = btn.dataset.checked === 'checked';
          this.updateSetting(network, media, !current);
          overlay.remove();
          this.openSettings();
        });
      });
    }
  };

  window.DataSaver = DataSaver;

  document.addEventListener('nsl:app-ready', () => {
    DataSaver.init();
  });
})();
