'use strict';
/**
 * MEDIA AUTO-PLAY TOGGLE — Control GIF/video auto-play in chats
 * User can disable auto-play for GIFs and videos to save data.
 */
(function () {
  const MediaAutoplay = {
    _defaults: {
      gifAutoplay: true,
      videoAutoplay: false,
      videoMuted: true
    },

    get(key) {
      try {
        const stored = JSON.parse(localStorage.getItem('nsl_media_autoplay') || '{}');
        return stored[key] ?? this._defaults[key];
      } catch (_) { return this._defaults[key]; }
    },

    set(key, value) {
      const stored = JSON.parse(localStorage.getItem('nsl_media_autoplay') || '{}');
      stored[key] = value;
      try { localStorage.setItem('nsl_media_autoplay', JSON.stringify(stored)); } catch (_) {}
      this._applyGlobal();
    },

    _applyGlobal() {
      document.querySelectorAll('img[src*="gif"]').forEach(img => {
        if (!this.get('gifAutoplay')) {
          img.loading = 'lazy';
          img.setAttribute('data-defer-src', img.src);
          img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          img.style.cursor = 'pointer';
          img.onclick = function() {
            this.src = this.getAttribute('data-defer-src');
            this.onclick = null;
          };
        }
      });

      document.querySelectorAll('video').forEach(video => {
        video.muted = this.get('videoMuted');
        if (!this.get('videoAutoplay')) {
          video.pause();
          video.removeAttribute('autoplay');
          video.controls = true;
        }
      });
    },

    observeNewMedia() {
      const container = document.getElementById('messages-container') || document.querySelector('.messages-wrapper');
      if (!container) return;

      const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
          m.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            const gifs = node.querySelectorAll ? node.querySelectorAll('img[src*="gif"]') : [];
            gifs.forEach(img => {
              if (!this.get('gifAutoplay')) {
                img.setAttribute('data-defer-src', img.src);
                img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                img.style.cursor = 'pointer';
                img.onclick = function() { this.src = this.getAttribute('data-defer-src'); this.onclick = null; };
              }
            });
            const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
            videos.forEach(video => {
              video.muted = this.get('videoMuted');
              if (!this.get('videoAutoplay')) {
                video.pause();
                video.removeAttribute('autoplay');
                video.controls = true;
              }
            });
          });
        });
      });

      observer.observe(container, { childList: true, subtree: true });
    },

    openSettings() {
      const modal = document.createElement('div');
      modal.id = 'media-autoplay-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

      modal.innerHTML = `
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(380px,92vw);padding:24px;">
          <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;">Media Auto-play</h3>

          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--outline-variant,#eee);">
            <div>
              <div style="font-size:14px;font-weight:600;">GIF Auto-play</div>
              <div style="font-size:12px;color:var(--on-surface-variant,#666);">Automatically play GIF animations</div>
            </div>
            <input type="checkbox" id="autoplay-gif" ${this.get('gifAutoplay') ? 'checked' : ''} style="width:18px;height:18px;">
          </label>

          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--outline-variant,#eee);">
            <div>
              <div style="font-size:14px;font-weight:600;">Video Auto-play</div>
              <div style="font-size:12px;color:var(--on-surface-variant,#666);">Automatically play videos</div>
            </div>
            <input type="checkbox" id="autoplay-video" ${this.get('videoAutoplay') ? 'checked' : ''} style="width:18px;height:18px;">
          </label>

          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;">
            <div>
              <div style="font-size:14px;font-weight:600;">Videos Muted</div>
              <div style="font-size:12px;color:var(--on-surface-variant,#666);">Start videos muted by default</div>
            </div>
            <input type="checkbox" id="autoplay-muted" ${this.get('videoMuted') ? 'checked' : ''} style="width:18px;height:18px;">
          </label>
        </div>
      `;

      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

      modal.querySelector('#autoplay-gif').addEventListener('change', (e) => {
        this.set('gifAutoplay', e.target.checked);
        if (typeof showToast === 'function') showToast('GIF auto-play ' + (e.target.checked ? 'on' : 'off'), 'success');
      });
      modal.querySelector('#autoplay-video').addEventListener('change', (e) => {
        this.set('videoAutoplay', e.target.checked);
        if (typeof showToast === 'function') showToast('Video auto-play ' + (e.target.checked ? 'on' : 'off'), 'success');
      });
      modal.querySelector('#autoplay-muted').addEventListener('change', (e) => {
        this.set('videoMuted', e.target.checked);
        this._applyGlobal();
      });
    }
  };

  window.MediaAutoplay = MediaAutoplay;
})();
