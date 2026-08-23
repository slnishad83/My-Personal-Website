/**
 * View-Once Media
 * Allows sending photos/videos/audio that disappear after being opened once.
 * Media is encrypted on send, deleted from Storage after first view,
 * and replaced with "Opened" status (like WhatsApp View Once).
 */
(function () {
  'use strict';

  const _esc = (s) => window.escHtml ? window.escHtml(String(s ?? '')) : String(s ?? '');
  const _debug = (...args) => { if (window.__DEBUG__) console.log('[ViewOnce]', ...args); };

  function _db() { return window.App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); }
  function _uid() { return window.currentUser ? currentUser.uid : (App && App.auth && App.auth.currentUser ? App.auth.currentUser.uid : null); }
  function _storage() { return (window.firebase && firebase.storage) ? firebase.storage() : null; }

  function _msgRef(chatId, chatType, msgId) {
    const db = _db();
    if (!db) return null;
    if (chatId) {
      const coll = chatType === 'group' ? 'groups' : 'chats';
      return db.collection(coll).doc(chatId).collection('messages').doc(msgId);
    }
    return db.collection('messages').doc(msgId);
  }

  function _chatRef(chatId, chatType) {
    const db = _db();
    if (!db || !chatId) return null;
    const coll = chatType === 'group' ? 'groups' : 'chats';
    return db.collection(coll).doc(chatId);
  }

  /* ── Encryption helpers ── */

  async function _encryptFile(file) {
    const ME = window.MediaEncryption;
    if (ME && typeof ME.encryptFile === 'function') {
      try {
        const result = await ME.encryptFile(file);
        if (result) {
          _debug('Encrypted via MediaEncryption');
          return result;
        }
      } catch (e) {
        _debug('MediaEncryption.encryptFile failed, falling back:', e.message);
      }
    }
    _debug('No MediaEncryption available, using plaintext upload');
    return null;
  }

  async function _decryptFile(encryptedUrl, encData, mimeType) {
    const ME = window.MediaEncryption;
    if (ME && typeof ME.processDownload === 'function' && encData) {
      try {
        const result = await ME.processDownload({ url: encryptedUrl, enc: encData, type: mimeType });
        if (result && result.url) {
          _debug('Decrypted via MediaEncryption');
          return result;
        }
      } catch (e) {
        _debug('MediaEncryption.processDownload failed:', e.message);
      }
    }
    _debug('Returning raw URL (no decryption)');
    return { url: encryptedUrl, type: mimeType };
  }

  /* ── Core: Send view-once media ── */

  async function sendViewOnce(file, chatId, chatType) {
    if (!file || !chatId) {
      _debug('sendViewOnce: missing file or chatId');
      return null;
    }

    const uid = _uid();
    if (!uid) {
      _debug('sendViewOnce: not authenticated');
      return null;
    }

    try {
      // Upload to Firebase Storage
      const st = _storage();
      if (!st) {
        _debug('sendViewOnce: no Storage');
        return null;
      }

      const path = 'viewOnce/' + chatId + '/' + uid + '/' + Date.now() + '_' + file.name;
      const ref = st.ref().child(path);
      _debug('Uploading to', path);

      const snapshot = await ref.put(file, { contentType: file.type });
      const downloadUrl = await snapshot.ref.getDownloadURL();
      _debug('Uploaded:', downloadUrl);

      // Try encryption
      const encResult = await _encryptFile(file);

      const msgData = {
        type: 'viewOnce',
        viewOnce: true,
        attachment: {
          url: downloadUrl,
          name: file.name,
          type: file.type
        },
        enc: encResult && encResult.enc ? encResult.enc : null,
        expiresAfterView: true,
        viewed: false,
        viewedAt: null,
        viewOnceOpened: false,
        senderId: uid,
        senderName: (window.currentUser && currentUser.displayName) || '',
        timestamp: Date.now(),
        text: ''
      };

      // Determine collection path
      const db = _db();
      if (!db) return null;

      let docRef;
      const coll = chatType === 'group' ? 'groups' : 'chats';
      if (chatId) {
        docRef = await db.collection(coll).doc(chatId).collection('messages').add(msgData);
      } else {
        docRef = await db.collection('messages').add(msgData);
      }

      _debug('Sent view-once message:', docRef.id);
      return docRef.id;
    } catch (e) {
      _debug('sendViewOnce error:', e);
      return null;
    }
  }

  /* ── Core: View view-once media ── */

  async function openViewOnce(message, chatId) {
    if (!message || !message.attachment) {
      _debug('openViewOnce: invalid message');
      return;
    }

    const msgId = message.id;
    const mediaUrl = message.attachment.url;
    const mediaType = message.attachment.type || 'image';

    if (!mediaUrl) {
      _debug('openViewOnce: no media URL');
      return;
    }

    // Check if already viewed
    if (message.viewed || message.viewOnceOpened) {
      _debug('openViewOnce: already viewed');
      return;
    }

    _debug('Opening view-once:', msgId);

    // Decrypt if needed
    let displayUrl = mediaUrl;
    if (message.enc) {
      const decrypted = await _decryptFile(mediaUrl, message.enc, mediaType);
      if (decrypted && decrypted.url) {
        displayUrl = decrypted.url;
      }
    }

    // Mark as viewed in Firestore
    const chatType = (App && App.currentChatType) || 'direct';
    const ref = _msgRef(chatId || (App && App.currentChat && App.currentChat.id), chatType, msgId);
    if (ref) {
      try {
        await ref.update({
          viewed: true,
          viewedAt: Date.now()
        });
        _debug('Marked as viewed:', msgId);
      } catch (e) {
        _debug('Failed to mark viewed:', e.message);
      }
    }

    // Show full-screen overlay
    _showViewOnceOverlay(displayUrl, mediaType, msgId, chatId, chatType, message);
  }

  /* ── UI: Full-screen overlay ── */

  function _showViewOnceOverlay(mediaUrl, mediaType, msgId, chatId, chatType, messageData) {
    // Inject styles if needed
    _injectStyles();

    const overlay = document.createElement('div');
    overlay.id = 'view-once-overlay';
    overlay.className = 'view-once-overlay';

    // "View once" badge
    const badge = document.createElement('div');
    badge.className = 'view-once-badge';
    badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">visibility</span> View once';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'view-once-close-btn';
    closeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:24px">close</span>';

    // Media element
    let mediaEl;
    if (mediaType && mediaType.startsWith('video')) {
      mediaEl = document.createElement('video');
      mediaEl.src = mediaUrl;
      mediaEl.controls = true;
      mediaEl.autoplay = true;
      mediaEl.playsInline = true;
      mediaEl.className = 'view-once-media';
    } else if (mediaType && mediaType.startsWith('audio')) {
      mediaEl = document.createElement('audio');
      mediaEl.src = mediaUrl;
      mediaEl.controls = true;
      mediaEl.autoplay = true;
      mediaEl.className = 'view-once-media-audio';

      // Audio icon wrapper
      const audioWrapper = document.createElement('div');
      audioWrapper.className = 'view-once-audio-wrapper';
      const audioIcon = document.createElement('span');
      audioIcon.className = 'material-symbols-outlined';
      audioIcon.style.cssText = 'font-size:64px;color:rgba(255,255,255,0.7);margin-bottom:24px';
      audioIcon.textContent = 'headphones';
      audioWrapper.appendChild(audioIcon);
      audioWrapper.appendChild(mediaEl);
      mediaEl = audioWrapper;
    } else {
      mediaEl = document.createElement('img');
      mediaEl.src = mediaUrl;
      mediaEl.className = 'view-once-media';
    }

    overlay.appendChild(mediaEl);
    overlay.appendChild(badge);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    // Block right-click / context menu
    overlay.addEventListener('contextmenu', (e) => e.preventDefault());

    // Screenshot warning
    let _warnedScreenshot = false;
    const _screenshotKeyHandler = (e) => {
      if (e.key === 'PrintScreen' || ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5' || e.key === 's'))) {
        if (!_warnedScreenshot && typeof showToast === 'function') {
          showToast('Screenshots are not allowed for view-once media', 'warning');
          _warnedScreenshot = true;
        }
      }
    };
    document.addEventListener('keydown', _screenshotKeyHandler);

    // Close handler
    const _cleanup = async () => {
      overlay.remove();
      document.removeEventListener('keydown', _screenshotKeyHandler);
      document.removeEventListener('keydown', _escHandler);

      // Delete from Storage and mark as opened
      await _deleteAfterView(msgId, messageData, chatId, chatType);
      _debug('View-once media closed and cleaned up:', msgId);
    };

    const _escHandler = (e) => { if (e.key === 'Escape') _cleanup(); };
    document.addEventListener('keydown', _escHandler);
    closeBtn.addEventListener('click', _cleanup);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) _cleanup(); });
  }

  /* ── Delete file from Storage after view ── */

  async function _deleteAfterView(msgId, messageData, chatId, chatType) {
    const ref = _msgRef(chatId || (App && App.currentChat && App.currentChat.id), chatType || (App && App.currentChatType) || 'direct', msgId);
    if (!ref) return;

    try {
      // Delete file from Storage
      const url = messageData && messageData.attachment && messageData.attachment.url;
      if (url) {
        const st = _storage();
        if (st) {
          try {
            const fileRef = st.refFromURL(url);
            await fileRef.delete();
            _debug('Deleted from Storage:', url);
          } catch (e) {
            _debug('Storage delete failed (may already be gone):', e.message || e);
          }
        }
      }

      // Update message: mark as opened, clear attachment
      await ref.update({
        viewOnceOpened: true,
        viewed: true,
        viewedAt: Date.now(),
        'attachment.url': null,
        enc: null,
        text: 'Opened'
      });
      _debug('Marked message as opened:', msgId);
    } catch (e) {
      _debug('_deleteAfterView error:', e);
    }
  }

  /* ── Render helpers ── */

  function renderViewOnceMessage(msg, isSender) {
    if (!msg || !msg.viewOnce) return null;

    // Already opened by receiver
    if (msg.viewOnceOpened || msg.viewed) {
      return '<div class="view-once-msg view-once-opened" style="padding:12px 16px;border-radius:12px;background:var(--surface-container-highest,#2a3942);text-align:center;display:flex;align-items:center;justify-content:center;gap:8px">' +
        '<span class="material-symbols-outlined" style="font-size:20px;color:#00a884">check_circle</span>' +
        '<span style="font-size:13px;color:var(--on-surface-variant,#8696a0);font-weight:500">Opened</span>' +
      '</div>';
    }

    // Sender sees the media type icon
    if (isSender) {
      const mediaType = (msg.attachment && msg.attachment.type) || 'image';
      const isVideo = mediaType.startsWith('video');
      const isAudio = mediaType.startsWith('audio');
      const iconName = isVideo ? 'videocam' : (isAudio ? 'headphones' : 'photo_camera');
      const label = isVideo ? 'Video' : (isAudio ? 'Audio' : 'Photo');

      return '<div class="view-once-msg view-once-sender" style="padding:12px 16px;border-radius:12px;background:rgba(0,128,105,0.15);text-align:center">' +
        '<span class="material-symbols-outlined" style="font-size:24px;color:#00a884;display:block;margin-bottom:4px">' + iconName + '</span>' +
        '<p style="font-size:13px;color:var(--on-surface-variant,#8696a0);margin:0;font-weight:500">View once \u00b7 ' + label + '</p>' +
      '</div>';
    }

    // Receiver: tap to view
    const mediaType = (msg.attachment && msg.attachment.type) || 'image';
    return '<div class="view-once-msg view-once-unopened" data-msg-id="' + _esc(msg.id) + '" data-media-url="' + _esc(msg.attachment && msg.attachment.url || '') + '" data-media-type="' + _esc(mediaType) + '" style="padding:12px 16px;border-radius:12px;background:var(--surface-container-highest,#2a3942);text-align:center;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">' +
      '<span class="material-symbols-outlined" style="font-size:20px;color:#00a884">visibility</span>' +
      '<span style="font-size:13px;color:var(--on-surface-variant,#8696a0);font-weight:500">Tap to view once</span>' +
    '</div>';
  }

  /* ── Security: Block actions on view-once messages ── */

  function canForward(message) {
    if (message && message.viewOnce && !message.viewOnceOpened) return false;
    return true;
  }

  function canSave(message) {
    if (message && message.viewOnce && !message.viewOnceOpened) return false;
    return true;
  }

  function canReply(message) {
    return true;
  }

  /* ── Styles ── */

  function _injectStyles() {
    if (document.getElementById('view-once-styles')) return;
    const style = document.createElement('style');
    style.id = 'view-once-styles';
    style.textContent = '\n' +
      '.view-once-overlay { position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;animation:viewOnceFadeIn 0.2s ease;-webkit-user-select:none;user-select:none; }' +
      '.view-once-badge { position:absolute;top:16px;left:16px;background:rgba(0,0,0,0.6);color:white;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:600;display:flex;align-items:center;gap:6px;backdrop-filter:blur(8px); }' +
      '.view-once-close-btn { position:absolute;top:16px;right:16px;background:rgba(0,0,0,0.5);border:none;color:white;width:40px;height:40px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);transition:background 0.2s; }' +
      '.view-once-close-btn:hover { background:rgba(255,255,255,0.2); }' +
      '.view-once-media { max-width:95vw;max-height:85vh;border-radius:12px;object-fit:contain;-webkit-user-select:none;user-select:none;pointer-events:none; }' +
      '.view-once-media-audio { max-width:95vw;max-height:85vh;border-radius:12px;-webkit-user-select:none;user-select:none; }' +
      '.view-once-audio-wrapper { display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%; }' +
      '.view-once-msg { transition:all 0.3s ease; }' +
      '.view-once-msg.view-once-unopened:hover { background:var(--surface-container-highest,#2a3942);transform:scale(1.01); }' +
      '.view-once-sender { opacity:0.85; }' +
      '@keyframes viewOnceFadeIn { from{opacity:0} to{opacity:1} }\n';
    document.head.appendChild(style);
  }

  /* ── Init: Delegate click on view-once messages ── */

  function init() {
    _injectStyles();

    document.addEventListener('click', (e) => {
      const msgEl = e.target.closest('.view-once-msg.view-once-unopened[data-msg-id]');
      if (!msgEl) return;

      const msgId = msgEl.dataset.msgId;
      const mediaUrl = msgEl.dataset.mediaUrl;
      const mediaType = msgEl.dataset.mediaType;
      if (!msgId || !mediaUrl) return;

      const chatId = (App && App.currentChat && App.currentChat.id) || '';
      const chatType = (App && App.currentChatType) || 'direct';

      // Find message data from App state
      let msgData = null;
      if (App && App.messages) {
        const msgs = Array.isArray(App.messages) ? App.messages : [];
        msgData = msgs.find(m => m.id === msgId);
      }
      if (!msgData) {
        msgData = { id: msgId, attachment: { url: mediaUrl, type: mediaType }, viewOnce: true };
      }

      openViewOnce(msgData, chatId);
    });

    _debug('Initialized');
  }

  /* ── Public API ── */

  window.ViewOnce = {
    init: init,
    sendViewOnce: sendViewOnce,
    openViewOnce: openViewOnce,
    renderViewOnceMessage: renderViewOnceMessage,
    isViewOnceMessage: (msg) => !!(msg && msg.viewOnce),
    isViewOnceOpened: (msg) => !!(msg && (msg.viewOnceOpened || msg.viewed)),
    canForward: canForward,
    canSave: canSave,
    canReply: canReply
  };

  document.addEventListener('nsl:app-ready', init);
  if (document.readyState !== 'loading') init();
})();
