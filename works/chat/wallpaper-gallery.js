/**
 * Wallpaper Gallery
 * Built-in wallpaper browser with categories, per-chat and global wallpapers.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'nsl_chat_wallpapers';

  const WALLPAPERS = [
    { id: 'solid-dark', name: 'Dark', category: 'solid', css: '#1a1a2e' },
    { id: 'solid-light', name: 'Light', category: 'solid', css: '#f0f0f0' },
    { id: 'solid-green', name: 'Forest', category: 'solid', css: '#0d3b2e' },
    { id: 'solid-blue', name: 'Ocean', category: 'solid', css: '#0a1628' },
    { id: 'solid-purple', name: 'Night', category: 'solid', css: '#1a0a2e' },
    { id: 'solid-rose', name: 'Rose', category: 'solid', css: '#2e0a1a' },
    { id: 'gradient-1', name: 'Midnight', category: 'gradient', css: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 100%)' },
    { id: 'gradient-2', name: 'Forest Mist', category: 'gradient', css: 'linear-gradient(135deg, #0d3b2e 0%, #1a4a3e 100%)' },
    { id: 'gradient-3', name: 'Ocean Deep', category: 'gradient', css: 'linear-gradient(135deg, #0a1628 0%, #1a2a4e 100%)' },
    { id: 'gradient-4', name: 'Purple Haze', category: 'gradient', css: 'linear-gradient(135deg, #1a0a2e 0%, #2e1a4e 100%)' },
    { id: 'gradient-5', name: 'Sunset', category: 'gradient', css: 'linear-gradient(135deg, #2e0a1a 0%, #4e1a2e 100%)' },
    { id: 'gradient-6', name: 'Aurora', category: 'gradient', css: 'linear-gradient(135deg, #0a2e1a 0%, #1a4e2e 50%, #0a1a2e 100%)' },
    { id: 'pattern-dots', name: 'Dots', category: 'pattern', css: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', cssBg: '#1a1a2e' },
    { id: 'pattern-lines', name: 'Lines', category: 'pattern', css: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 20px)', cssBg: '#1a1a2e' },
    { id: 'pattern-grid', name: 'Grid', category: 'pattern', css: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', cssBg: '#1a1a2e', cssBgSize: '20px 20px' },
  ];

  const WallpaperGallery = {
    _chatWallpapers: {},
    _globalWallpaper: null,

    init() {
      this._load();
    },

    _load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          this._chatWallpapers = data.chatWallpapers || {};
          this._globalWallpaper = data.globalWallpaper || null;
        }
      } catch (_) {}
    },

    _save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          chatWallpapers: this._chatWallpapers,
          globalWallpaper: this._globalWallpaper,
        }));
      } catch (_) {}
    },

    getWallpaperForChat(chatId) {
      return this._chatWallpapers[chatId] || this._globalWallpaper || null;
    },

    setWallpaperForChat(chatId, wallpaperId) {
      const wp = wallpaperId ? WALLPAPERS.find(w => w.id === wallpaperId) : null;
      if (wp) {
        this._chatWallpapers[chatId] = wp;
      } else {
        delete this._chatWallpapers[chatId];
      }
      this._save();
    },

    setGlobalWallpaper(wallpaperId) {
      const wp = wallpaperId ? WALLPAPERS.find(w => w.id === wallpaperId) : null;
      this._globalWallpaper = wp;
      this._save();
    },

    clearChatWallpaper(chatId) {
      delete this._chatWallpapers[chatId];
      this._save();
    },

    clearGlobalWallpaper() {
      this._globalWallpaper = null;
      this._save();
    },

    applyWallpaper(chatId) {
      const wp = this.getWallpaperForChat(chatId);
      const container = document.getElementById('messages-wrap') || document.querySelector('.messages-container');
      if (!container) return;

      if (wp) {
        const size = wp.cssBgSize || 'auto';
        container.style.background = wp.css;
        if (wp.cssBg) container.style.backgroundColor = wp.cssBg;
        container.style.backgroundSize = size;
        container.style.backgroundRepeat = 'repeat';
      } else {
        container.style.background = '';
        container.style.backgroundColor = '';
        container.style.backgroundSize = '';
      }
    },

    openGallery(chatId) {
      const overlay = document.createElement('div');
      overlay.id = 'wallpaper-gallery-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

      const panel = document.createElement('div');
      panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:480px;width:92vw;max-height:85vh;overflow-y:auto;color:var(--on-surface)';

      const categories = ['solid', 'gradient', 'pattern'];
      let wpHtml = '';

      for (const cat of categories) {
        const wps = WALLPAPERS.filter(w => w.category === cat);
        wpHtml += `<h4 style="font-size:12px;font-weight:600;color:var(--on-surface-variant);text-transform:uppercase;margin:16px 0 8px;letter-spacing:0.05em">${cat}</h4>`;
        wpHtml += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px">';
        for (const wp of wps) {
          const bg = wp.cssBg ? wp.cssBg : wp.css;
          const size = wp.cssBgSize || 'cover';
          const isActive = chatId
            ? (this._chatWallpapers[chatId]?.id === wp.id)
            : (this._globalWallpaper?.id === wp.id);
          wpHtml += `
            <button class="wp-item" data-wp-id="${wp.id}"
              style="width:100%;aspect-ratio:1;border-radius:12px;border:2px solid ${isActive ? 'var(--primary)' : 'transparent'};cursor:pointer;background:${bg};background-size:${size};position:relative;overflow:hidden;transition:border-color 0.2s">
              ${isActive ? '<span class="material-symbols-outlined" style="position:absolute;top:4px;right:4px;font-size:14px;color:var(--primary);text-shadow:0 1px 2px rgba(0,0,0,0.5)">check_circle</span>' : ''}
              <span style="position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:9px;color:white;text-shadow:0 1px 2px rgba(0,0,0,0.8)">${wp.name}</span>
            </button>`;
        }
        wpHtml += '</div>';
      }

      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <h3 style="margin:0;font-size:18px;font-weight:700">${chatId ? 'Chat Wallpaper' : 'Global Wallpaper'}</h3>
          <button onclick="document.getElementById('wallpaper-gallery-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
        </div>
        <p style="font-size:11px;color:var(--on-surface-variant);margin:0 0 12px">${chatId ? 'Set wallpaper for this chat only' : 'Set as default wallpaper for all chats'}</p>
        ${wpHtml}
        <div style="display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid var(--outline-variant,rgba(0,0,0,0.1))">
          ${chatId ? '<button id="wp-clear-chat" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--outline-variant);background:transparent;color:var(--on-surface-variant);font-size:12px;font-weight:600;cursor:pointer">Clear Chat Wallpaper</button>' : ''}
          <button id="wp-clear-global" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--outline-variant);background:transparent;color:var(--on-surface-variant);font-size:12px;font-weight:600;cursor:pointer">Clear Global</button>
          <button id="wp-set-global" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:600;cursor:pointer">Set Global</button>
        </div>`;

      overlay.appendChild(panel);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);

      panel.querySelectorAll('.wp-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const wpId = btn.dataset.wpId;
          if (chatId) {
            this.setWallpaperForChat(chatId, wpId);
          } else {
            this.setGlobalWallpaper(wpId);
          }
          this.applyWallpaper(chatId);
          overlay.remove();
          if (chatId) this.openGallery(chatId);
          else this.openGallery(null);
        });
      });

      document.getElementById('wp-clear-chat')?.addEventListener('click', () => {
        if (chatId) this.clearChatWallpaper(chatId);
        this.applyWallpaper(chatId);
        overlay.remove();
        if (chatId) this.openGallery(chatId);
      });

      document.getElementById('wp-clear-global')?.addEventListener('click', () => {
        this.clearGlobalWallpaper();
        overlay.remove();
        this.openGallery(chatId);
      });

      document.getElementById('wp-set-global')?.addEventListener('click', () => {
        overlay.remove();
        this.openGallery(null);
      });
    }
  };

  window.WallpaperGallery = WallpaperGallery;

  document.addEventListener('nsl:app-ready', () => {
    WallpaperGallery.init();
  });
})();
