/**
 * View-Once Media
 * Allows sending photos/videos that disappear after being opened once.
 */
(function () {
  'use strict';

  const ViewOnce = {
    _enabledChats: new Set(),

    init() {},

    isViewOnceMessage(msg) {
      return msg && msg.viewOnce === true;
    },

    async markAsViewed(msgId) {
      if (!App.db) return;
      try {
        await App.db.collection('messages').doc(msgId).update({
          viewedOnce: true,
          viewedAt: Date.now(),
        });
      } catch (e) {
        console.warn('[ViewOnce] markAsViewed error:', e);
      }
    },

    async deleteAfterView(msgId, msgData) {
      if (!App.db) return;
      try {
        if (msgData?.mediaUrl) {
          try {
            const ref = storage.refFromURL(msgData.mediaUrl);
            await ref.delete();
          } catch (_) {}
        }
        await App.db.collection('messages').doc(msgId).delete();
      } catch (e) {
        console.warn('[ViewOnce] deleteAfterView error:', e);
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
            <p style="font-size:12px;color:var(--on-primary-container);margin:0">View once · ${mediaType}</p>
          </div>`;
      }

      return `
        <div class="view-once-msg" data-msg-id="${msg.id}" style="padding:12px 16px;border-radius:12px;background:var(--surface-container-highest);text-align:center;cursor:pointer" onclick="window.ViewOnce.openViewOnce('${msg.id}', '${msg.mediaUrl || ''}', '${msg.type || 'image'}')">
          <span class="material-symbols-outlined" style="font-size:24px;color:var(--primary);display:block;margin-bottom:4px">visibility</span>
          <p style="font-size:12px;color:var(--on-surface-variant);margin:0">Tap to view once</p>
        </div>`;
    },

    async openViewOnce(msgId, mediaUrl, mediaType) {
      if (!mediaUrl) return;

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

      if (mediaType === 'video') {
        overlay.innerHTML = `
          <video id="view-once-video" src="${mediaUrl}" controls autoplay style="max-width:95vw;max-height:85vh;border-radius:12px"></video>
          <button onclick="this.parentElement.remove()" style="position:absolute;top:16px;right:16px;background:rgba(0,0,0,0.5);border:none;color:white;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center">&times;</button>`;
      } else {
        overlay.innerHTML = `
          <img src="${mediaUrl}" style="max-width:95vw;max-height:85vh;border-radius:12px;object-fit:contain" />
          <button onclick="this.parentElement.remove()" style="position:absolute;top:16px;right:16px;background:rgba(0,0,0,0.5);border:none;color:white;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center">&times;</button>`;
      }

      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

      await this.markAsViewed(msgId);

      const msgEl = document.querySelector(`.view-once-msg[data-msg-id="${msgId}"]`);
      if (msgEl) {
        msgEl.outerHTML = `
          <div class="view-once-msg viewed" style="padding:12px 16px;border-radius:12px;background:var(--surface-container-highest);text-align:center">
            <span class="material-symbols-outlined" style="font-size:24px;color:var(--primary);display:block;margin-bottom:4px">visibility_off</span>
            <p style="font-size:12px;color:var(--on-surface-variant);margin:0">Opened</p>
          </div>`;
      }

      setTimeout(() => {
        overlay.remove();
        this.deleteAfterView(msgId, { mediaUrl });
      }, 15000);
    }
  };

  window.ViewOnce = ViewOnce;

  document.addEventListener('nsl:app-ready', () => {
    ViewOnce.init();
  });
})();
