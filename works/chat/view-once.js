/**
 * View-Once Media
 * Allows sending photos/videos that disappear after being opened once.
 * Media is deleted when the viewer closes the overlay (not on a timer).
 */
(function () {
  'use strict';

  const _esc = (s) => window.escHtml ? window.escHtml(String(s ?? '')) : String(s ?? '');

  const ViewOnce = {
    _enabledChats: new Set(),

    init() {
      document.addEventListener('click', (e) => {
        const msgEl = e.target.closest('.view-once-msg[data-media-url]');
        if (!msgEl) return;
        const msgId = msgEl.dataset.msgId;
        const mediaUrl = msgEl.dataset.mediaUrl;
        const mediaType = msgEl.dataset.mediaType;
        if (msgId && mediaUrl) this.openViewOnce(msgId, mediaUrl, mediaType);
      });
    },

    isViewOnceMessage(msg) {
      return msg && msg.viewOnce === true;
    },

    async markAsViewed(msgId) {
      if (!App.db) return;
      try {
        var chatId = (App && App.currentChat && App.currentChat.id) || '';
        var docRef = chatId
          ? App.db.collection('messages').doc(chatId).collection('items').doc(msgId)
          : App.db.collection('messages').doc(msgId);
        await docRef.update({
          viewedOnce: true,
          viewedAt: Date.now(),
        });
      } catch (e) {
        if (window.__DEBUG__) console.warn('[ViewOnce] markAsViewed error:', e);
      }
    },

    async deleteAfterView(msgId, msgData) {
      if (!App.db) return;
      try {
        if (msgData?.mediaUrl) {
          try {
            const _st = (window.firebase && window.firebase.storage) ? window.firebase.storage() : null;
            if (_st) {
              const ref = _st.refFromURL(msgData.mediaUrl);
              await ref.delete();
            }
          } catch (e) {
            if (window.__DEBUG__) console.warn('[ViewOnce] Storage delete failed (may already be gone):', e.message || e);
          }
        }
        const chatId = window.App?.currentChat?.id;
        if (chatId) {
          await App.db.collection('messages').doc(chatId).collection('items').doc(msgId).delete();
        } else {
          await App.db.collection('messages').doc(msgId).delete();
        }
      } catch (e) {
        if (window.__DEBUG__) console.warn('[ViewOnce] deleteAfterView error:', e);
      }
    },

    renderViewOnceMessage(msg, isSender) {
      if (!this.isViewOnceMessage(msg)) return null;

      if (msg.viewedOnce && !isSender) {
        return `
          <div class="view-once-msg viewed" style="padding:12px 16px;border-radius:12px;background:var(--surface-container-highest);text-align:center">
            <span class="material-symbols-outlined" style="font-size:24px;color:var(--primary);display:block;margin-bottom:4px">visibility_off</span>
            <p style="font-size:12px;color:var(--on-surface-variant);margin:0">Opened</p>
          </div>`;
      }

      if (isSender) {
        const mediaType = msg.type === 'video' ? 'video' : 'photo';
        return `
          <div class="view-once-msg sender" style="padding:12px 16px;border-radius:12px;background:var(--primary-container);text-align:center">
            <span class="material-symbols-outlined" style="font-size:24px;color:var(--primary);display:block;margin-bottom:4px">${mediaType === 'video' ? 'videocam' : 'photo_camera'}</span>
            <p style="font-size:12px;color:var(--on-primary-container);margin:0">View once \u00b7 ${mediaType}</p>
          </div>`;
      }

      return `
        <div class="view-once-msg" data-msg-id="${_esc(msg.id)}" data-media-url="${_esc(msg.mediaUrl || '')}" data-media-type="${_esc(msg.type || 'image')}" style="padding:12px 16px;border-radius:12px;background:var(--surface-container-highest);text-align:center;cursor:pointer">
          <span class="material-symbols-outlined" style="font-size:24px;color:var(--primary);display:block;margin-bottom:4px">visibility</span>
          <p style="font-size:12px;color:var(--on-surface-variant);margin:0">Tap to view once</p>
        </div>`;
    },

    async openViewOnce(msgId, mediaUrl, mediaType) {
      if (!mediaUrl) return;

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;-webkit-user-select:none;user-select:none;';

      const badge = document.createElement('div');
      badge.style.cssText = 'position:absolute;top:16px;left:16px;background:rgba(0,0,0,0.6);color:white;padding:6px 12px;border-radius:20px;font-size:11px;font-weight:600;display:flex;align-items:center;gap:6px;backdrop-filter:blur(8px)';
      badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">visibility</span> 1 of 1 view';

      const closeBtn = document.createElement('button');
      closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;background:rgba(0,0,0,0.5);border:none;color:white;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center';
      closeBtn.innerHTML = '&times;';

      if (mediaType === 'video') {
        const video = document.createElement('video');
        video.src = mediaUrl;
        video.controls = true;
        video.autoplay = true;
        video.style.cssText = 'max-width:95vw;max-height:85vh;border-radius:12px;-webkit-user-select:none;user-select:none;';
        overlay.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = mediaUrl;
        img.style.cssText = 'max-width:95vw;max-height:85vh;border-radius:12px;object-fit:contain;-webkit-user-select:none;user-select:none;';
        overlay.appendChild(img);
      }

      overlay.appendChild(badge);
      overlay.appendChild(closeBtn);
      document.body.appendChild(overlay);

      await this.markAsViewed(msgId);

      const msgEl = document.querySelector(`.view-once-msg[data-msg-id="${msgId}"]`);
      if (msgEl) {
        msgEl.outerHTML = `
          <div class="view-once-msg viewed" style="padding:12px 16px;border-radius:12px;background:var(--surface-container-highest);text-align:center">
            <span class="material-symbols-outlined" style="font-size:24px;color:var(--primary);display:block;margin-bottom:4px">visibility_off</span>
            <p style="font-size:12px;color:var(--on-surface-variant);margin:0">Opened</p>
          </div>`;
      }

      const doClose = async () => {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
        await this.deleteAfterView(msgId, { mediaUrl });
      };

      const escHandler = (e) => { if (e.key === 'Escape') doClose(); };
      document.addEventListener('keydown', escHandler);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) doClose(); });
      closeBtn.addEventListener('click', doClose);
    }
  };

  window.ViewOnce = ViewOnce;

  document.addEventListener('nsl:app-ready', () => {
    ViewOnce.init();
  });
})();
