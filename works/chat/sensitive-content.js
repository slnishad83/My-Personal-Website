// Sensitive Content Blur — auto-blur images flagged as sensitive
(function() {
  'use strict';

  const SENSITIVE_KEY = 'nsl_sensitive_seen';
  const BLUR_CLASS = 'sensitive-blur-active';

  function _getSeenImages() {
    try { return JSON.parse(localStorage.getItem(SENSITIVE_KEY) || '[]'); } catch(_) { return []; }
  }

  function _markSeen(msgId) {
    const seen = _getSeenImages();
    if (!seen.includes(msgId)) {
      seen.push(msgId);
      if (seen.length > 200) seen.splice(0, seen.length - 200);
      localStorage.setItem(SENSITIVE_KEY, JSON.stringify(seen));
    }
  }

  window.isImageSensitive = function(msg) {
    if (!msg) return false;
    if (msg.sensitiveContent || msg.flagged || msg.nsfw) return true;
    if (msg.attachment?.sensitive || msg.attachment?.flagged) return true;
    return false;
  };

  window.markContentSensitive = function(msgId) {
    if (!App.db || !App.currentChat) return;
    if (typeof firebase !== 'undefined' && firebase.functions) {
      try {
        const fn = firebase.functions().httpsCallable('flagSensitiveContent');
        fn({ messageId: msgId, chatId: App.currentChat.id }).then(() => {
          showToast('Content marked as sensitive', 'info');
        }).catch(() => showToast('Failed to flag content', 'error'));
      } catch(_) {
        showToast('Failed to flag content', 'error');
      }
    }
  };

  window.unmarkContentSensitive = function(msgId) {
    if (!App.db) return;
    if (typeof firebase !== 'undefined' && firebase.functions) {
      try {
        const fn = firebase.functions().httpsCallable('unflagSensitiveContent');
        fn({ messageId: msgId }).then(() => {
          showToast('Content unmarked', 'info');
        }).catch(() => showToast('Failed to unmark content', 'error'));
      } catch(_) {
        showToast('Failed to unmark content', 'error');
      }
    }
  };

  window.revealSensitiveImage = function(msgId, el) {
    _markSeen(msgId);
    if (el) {
      el.classList.remove(BLUR_CLASS);
      el.style.filter = 'none';
      el.style.transition = 'filter 0.3s ease';
    }
  };

  window.hideSensitiveImage = function(msgId, el) {
    if (el) {
      el.classList.add(BLUR_CLASS);
      el.style.filter = 'blur(25px)';
    }
  };

  const _sensitiveStyle = document.createElement('style');
  _sensitiveStyle.textContent = `
    .${BLUR_CLASS} {
      filter: blur(25px) !important;
      transition: filter 0.3s ease !important;
    }
    .sensitive-overlay {
      position: absolute !important;
      inset: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(0,0,0,0.6) !important;
      border-radius: inherit !important;
      cursor: pointer !important;
      z-index: 5 !important;
    }
    .sensitive-overlay:hover {
      background: rgba(0,0,0,0.5) !important;
    }
    .sensitive-badge {
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      padding: 4px 10px !important;
      border-radius: 8px !important;
      background: rgba(239,68,68,0.2) !important;
      color: #ef4444 !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      margin-top: 6px !important;
    }
  `;
  document.head.appendChild(_sensitiveStyle);

  document.addEventListener('click', function(e) {
    var overlay = e.target.closest('.sensitive-overlay[data-sensitive-msg-id]');
    if (!overlay) return;
    e.stopPropagation();
    var msgId = overlay.getAttribute('data-sensitive-msg-id');
    var bubbleMedia = overlay.parentElement;
    var img = bubbleMedia ? bubbleMedia.querySelector('img') : null;
    revealSensitiveImage(msgId, img || overlay.previousElementSibling);
    overlay.remove();
  }, true);

  const origRenderSingleMessageHTML = window.renderSingleMessageHTML;
  if (typeof origRenderSingleMessageHTML === 'function') {
    window.renderSingleMessageHTML = function(msg, msgs, i, lastDate) {
      const html = origRenderSingleMessageHTML(msg, msgs, i, lastDate);

      if (msg.type !== 'image' || !isImageSensitive(msg)) return html;
      if (_getSeenImages().includes(msg.id)) return html;

      const safeId = String(msg.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const blurOverlay = `
        <div class="sensitive-overlay" data-sensitive-msg-id="${safeId}">
          <span class="material-symbols-outlined" style="font-size:32px;color:white;opacity:0.8">visibility_off</span>
          <div class="sensitive-badge">
            <span class="material-symbols-outlined" style="font-size:12px">warning</span>
            Sensitive Content
          </div>
          <span style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px">Tap to reveal</span>
        </div>`;

      return html.replace(
        /(<div class="bubble-media[^"]*"[^>]*>)/,
        `$1${blurOverlay}`
      ).replace(
        /(<img[^>]*alt="Image"[^>]*>)/,
        `$1<style>.bubble-media:has(> img[alt="Image"]) { filter: blur(25px); transition: filter 0.3s ease; }</style>`
      );
    };
  }

  window._addSensitiveContentOptions = function(menu, msgId) {
    if (!App.auth?.currentUser) return;
    const chatId = App.currentChat?.id;
    if (!chatId) return;

    const msgs = App.messages[chatId] || [];
    const msg = msgs.find(m => m.id === msgId);
    if (!msg || (msg.type !== 'image' && msg.type !== 'video')) return;

    const isSender = msg.from === App.auth.currentUser.uid;
    if (!isSender) return;

    const marked = isImageSensitive(msg);
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;border:none;background:transparent;color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;width:100%;text-align:left;border-radius:0';
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${marked ? 'visibility' : 'visibility_off'}</span>${marked ? 'Unmark as Sensitive' : 'Mark as Sensitive'}`;
    btn.onclick = () => {
      if (marked) unmarkContentSensitive(msgId);
      else markContentSensitive(msgId);
      if (typeof _removeCtxMenu === 'function') _removeCtxMenu();
      else if (typeof window._removeCtxMenu === 'function') window._removeCtxMenu();
    };
    const cancelBtn = menu.querySelector('[onclick*="_removeCtxMenu"]');
    if (cancelBtn) menu.insertBefore(btn, cancelBtn);
    else menu.appendChild(btn);
  };
})();
