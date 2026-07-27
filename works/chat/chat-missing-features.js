/**
 * chat-missing-features.js
 * Implements features missing from the audit (items 33-40):
 *  1. Drag-and-Drop file upload
 *  2. Image compression before upload
 *  3. Video thumbnail generation
 *  4. Network quality indicator (calls)
 *  5. Rate limiting / spam prevention
 *  6. Call Hold / Resume
 */
(function () {
  'use strict';
  var CC = window._CC;

  /* ================================================================
     1. DRAG-AND-DROP FILE UPLOAD
     Drop files onto the chat panel to attach them
  ================================================================ */
  function initDragAndDrop() {
    const chatPanel = document.getElementById('chat-area') ||
                      document.getElementById('messages-wrap') ||
                      document.querySelector('.chat-panel') ||
                      document.querySelector('.messages-wrapper, #chat-area');
    const messagesArea = document.getElementById('messages-wrap');
    const target = chatPanel || messagesArea || document.body;

    let dragCounter = 0;

    // Create drop overlay
    const overlay = document.createElement('div');
    overlay.id = 'dropZoneOverlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', 'File drop zone');
    overlay.innerHTML = `
      <div class="drop-zone-inner">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>Drop files here to send</p>
        <span class="drop-zone-sub">Images, videos, documents supported</span>
      </div>`;
    document.body.appendChild(overlay);

    // M9: Long-press on messages — show context menu (paste, copy, reply, etc.)
    let longPressTimer = null;
    let longPressTarget = null;
    target.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      longPressTarget = e.target;
      longPressTarget._startX = e.clientX;
      longPressTarget._startY = e.clientY;
      longPressTimer = setTimeout(() => {
        _showMessageContextMenu(e, longPressTarget);
        longPressTimer = null;
      }, 500);
    });
    target.addEventListener('pointermove', (e) => {
      if (longPressTimer && longPressTarget) {
        const dx = Math.abs(e.clientX - (longPressTarget._startX || 0));
        const dy = Math.abs(e.clientY - (longPressTarget._startY || 0));
        if (dx > 10 || dy > 10) { clearTimeout(longPressTimer); longPressTimer = null; }
      }
    });
    target.addEventListener('pointerup', () => { clearTimeout(longPressTimer); longPressTimer = null; });
    target.addEventListener('pointercancel', () => { clearTimeout(longPressTimer); longPressTimer = null; });

    async function _showMessageContextMenu(e, _targetEl) {
      const existing = document.getElementById('msg-context-menu');
      if (existing) existing.remove();

      const _clipboardHasText = navigator.clipboard && navigator.clipboard.readText;
      let _clipText = '';
      navigator.clipboard?.readText?.().then(t => { _clipText = t; }).catch(() => {});

      const menu = document.createElement('div');
      menu.id = 'msg-context-menu';
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', 'Message actions');
      menu.style.cssText = 'position:fixed;z-index:99999;background:var(--surface-container-high,#1e2a34);border:1px solid var(--outline-variant,rgba(0,0,0,0.12));border-radius:14px;padding:6px;box-shadow:0 8px 32px rgba(0,0,0,0.4);min-width:180px;animation:fadeIn 0.15s ease;';

      const x = Math.min(e.clientX, window.innerWidth - 200);
      const y = Math.min(e.clientY, window.innerHeight - 250);
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';

      let items = [];

      // Determine if we're in a group chat and find the message data
      const chat = window.App && window.App.currentChat ? window.App.currentChat : null;
      const isGroup = chat && (chat.type === 'group' || chat.isGroup);
      let msgData = null;
      let msgSenderId = null;
      let msgSenderName = null;
      if (isGroup && _targetEl) {
        const msgRow = _targetEl.closest('.message, [data-msg-id], .message-row');
        if (msgRow) {
          msgSenderId = msgRow.dataset.sender || msgRow.dataset.senderId || null;
          msgSenderName = msgRow.dataset.senderName || null;
          const senderEl = msgRow.querySelector('.sender-name, .msg-sender, .message-sender');
          if (!msgSenderName && senderEl) msgSenderName = senderEl.textContent.trim();
          const msgId = msgRow.getAttribute('data-msg-id') || msgRow.dataset.msgId;
          if (msgId && window.App && window.App.db && chat) {
            try {
              const doc = await window.App.db.collection('messages').doc(chat.id).collection('items').doc(msgId).get();
              if (doc.exists) {
                msgData = doc.data();
                msgData.id = doc.id;
                if (!msgSenderId) msgSenderId = msgData.from || msgData.senderId;
                if (!msgSenderName) msgSenderName = msgData.fromName || msgData.senderName || 'Someone';
              }
            } catch (_) {}
          }
          if (!msgSenderName) msgSenderName = 'Someone';
        }
      }

      // Always show paste if input is focused
      const input = document.getElementById('msg-input');
      if (input && App.currentChat) {
        navigator.clipboard?.readText?.().then(text => {
          if (text && text.trim()) {
            items.push({ icon: 'content_paste', label: 'Paste', action: () => { input.value = text; input.focus(); if (typeof window.onInputChange === 'function') window.onInputChange(); } });
          }
          _renderContextMenuItems(menu, items);
        }).catch(() => {});
      }

      // Reply (always available on messages)
      if (App.currentChat && _targetEl) {
        const msgRow = _targetEl.closest('.message, [data-msg-id], .message-row');
        if (msgRow) {
          const msgId = msgRow.getAttribute('data-msg-id') || msgRow.dataset.msgId;
          if (msgId) {
            items.push({ icon: 'reply', label: 'Reply', action: () => {
              if (typeof window.triggerReply === 'function') window.triggerReply(msgRow);
              else if (typeof window.replyToMsg === 'function') window.replyToMsg(msgId);
              else if (typeof window.startReply === 'function') {
                const bubble = msgRow.querySelector('.message-bubble');
                window.startReply(msgId, msgSenderId || '', (bubble?.textContent || '').substring(0, 80));
              }
            }});
          }
        }
      }

      // Reply Privately + Message [Name] — group chats only
      if (isGroup && msgData && msgSenderId && msgSenderId !== (window.App?.auth?.currentUser?.uid)) {
        items.push({ icon: 'forward', label: 'Reply Privately', action: () => {
          if (typeof window.ReplyPrivate !== 'undefined') {
            window.ReplyPrivate.replyPrivately(msgData, chat.id);
          }
        }});
        items.push({ icon: 'chat', label: 'Message ' + (msgSenderName || 'user'), action: () => {
          if (typeof window.ReplyPrivate !== 'undefined') {
            window.ReplyPrivate.messagePerson(msgData, chat.id);
          }
        }});
      }

      // Also add a file drop option for drag
      if (App.currentChat) {
        items.push({ icon: 'attach_file', label: 'Attach file', action: () => { document.getElementById('attach-btn')?.click(); } });
      }

      _renderContextMenuItems(menu, items);
      document.body.appendChild(menu);

      const closeMenu = (ev) => {
        if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('pointerdown', closeMenu); }
      };
      setTimeout(() => document.addEventListener('pointerdown', closeMenu), 50);
    }

    function _renderContextMenuItems(menu, items) {
      if (!items.length) {
        menu.innerHTML = '<div style="padding:12px 16px;color:var(--on-surface-variant);font-size:12px;text-align:center">No actions available</div>';
        return;
      }
      menu.innerHTML = items.map(item => `
        <button class="ctx-menu-item" role="menuitem" style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border:none;background:none;color:var(--on-surface);font-size:13px;font-weight:500;cursor:pointer;border-radius:10px;transition:background 0.15s;text-align:left" onpointerenter="this.style.background='var(--surface-container,rgba(0,0,0,0.06))'" onpointerleave="this.style.background='none'">
          <span class="material-symbols-outlined" aria-hidden="true" style="font-size:18px;color:var(--on-surface-variant)">${item.icon}</span>
          ${item.label}
        </button>
      `).join('');
      menu.querySelectorAll('.ctx-menu-item').forEach((btn, i) => {
        btn.addEventListener('click', () => { items[i].action(); menu.remove(); });
      });
    }

    document.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      // Only show overlay if a chat is open
      if (!window.currentChat && !window.App?.currentChat) return;
      dragCounter++;
      overlay.classList.add('active');
    });

    document.addEventListener('dragleave', (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        overlay.classList.remove('active');
      }
    });

    document.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.classList.remove('active');
      if (!window.currentChat && !window.App?.currentChat) return;

      const files = Array.from(e.dataTransfer.files || []);
      if (!files.length) return;

      // D-M16: Process ALL dropped files (batch upload), not just the first
      let sentCount = 0;
      let failedCount = 0;
      for (const file of files) {
        try {
          if (typeof window.handleFileUpload === 'function') {
            await window.handleFileUpload(file);
            sentCount++;
          } else {
            // Fallback: trigger the hidden file input for each file
            const fileInput = document.getElementById('fileInput') ||
                              document.querySelector('input[type="file"]') ||
                              document.getElementById('media-file-input');
            if (fileInput) {
              const dt = new DataTransfer();
              dt.items.add(file);
              fileInput.files = dt.files;
              fileInput.dispatchEvent(new Event('change', { bubbles: true }));
              sentCount++;
            }
          }
        } catch (err) {
          failedCount++;
        }
      }
      if (files.length > 1) {
        const msg = failedCount > 0
          ? `${sentCount} file(s) attached, ${failedCount} failed`
          : `${sentCount} file(s) attached`;
        if (typeof window.showToast === 'function') {
          window.showToast(msg, failedCount > 0 ? 'error' : 'success');
        }
      }
    });
  }

  /* ================================================================
     2. IMAGE COMPRESSION BEFORE UPLOAD
     Patches uploadRecordedMedia / uploadDocument to compress images
  ================================================================ */
  async function compressImage(file, { maxWidth = 1600, maxHeight = 1600, quality = 0.75 } = {}) {
    return new Promise((resolve) => {
      // Skip non-images or small images
      if (!file.type.startsWith('image/') || file.type === 'image/gif') {
        resolve(file);
        return;
      }
      if (file.size < 200 * 1024) { // under 200KB — no compression needed
        resolve(file);
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob((blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: outType, lastModified: Date.now() }));
        }, outType, outType === 'image/png' ? undefined : quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  // Expose for use in showPhotoEditor / handleFileUpload patches
  window._compressImage = compressImage;

  /* ================================================================
     3. VIDEO THUMBNAIL GENERATION
     Captures first frame of video and stores as thumbnail data URL
  ================================================================ */
  function generateVideoThumbnail(file) {
    return new Promise((resolve) => {
      if (!file.type.startsWith('video/')) { resolve(null); return; }
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.src = url;
      video.addEventListener('loadeddata', () => {
        video.currentTime = 0.5;
      }, { once: true });
      video.addEventListener('seeked', () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(video.videoWidth, 640);
          canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        } catch (_) {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      }, { once: true });
      video.addEventListener('error', () => { URL.revokeObjectURL(url); resolve(null); }, { once: true });
      setTimeout(() => { URL.revokeObjectURL(url); resolve(null); }, 8000);
    });
  }
  window._generateVideoThumbnail = generateVideoThumbnail;

  /* ================================================================
     2b. IMAGE COMPRESSION PATCH
     Wraps handleFileUpload to compress images before sending
  ================================================================ */
  function patchImageCompression() {
    const _orig = window.handleFileUpload;
    if (typeof _orig !== 'function') return;
    window.handleFileUpload = async function (file) {
      if (file && file.type && file.type.startsWith('image/') && file.type !== 'image/gif') {
        try {
          file = await compressImage(file);
        } catch (_) {}
      }
      return _orig.call(this, file);
    };
  }

  // Patch handleFileUpload to auto-generate and store thumbnail for videos
  function patchVideoThumbnail() {
    const _orig = window.handleFileUpload;
    if (typeof _orig !== 'function') return;
    window.handleFileUpload = async function (file) {
      if (file && file.type.startsWith('video/')) {
        generateVideoThumbnail(file).then((thumb) => {
          if (thumb) window._lastVideoThumbnail = thumb;
        });
      }
      return _orig.call(this, file);
    };
  }

  /* ================================================================
     4. NETWORK QUALITY INDICATOR (during calls)
     Shows a signal-bar icon in the call modal based on ICE state + RTT
  ================================================================ */
  let _netQualityInterval = null;
  let _netQualityBar = null;
  let _callWatchFallbackObs = null;
  let _callEndFallbackObs = null;

  function createNetworkQualityBar() {
    if (document.getElementById('callNetworkQuality')) return;
    const bar = document.createElement('div');
    bar.id = 'callNetworkQuality';
    bar.setAttribute('aria-label', 'Network quality');
    bar.title = 'Network quality';
    bar.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="1"  y="16" width="4" height="6" rx="1" class="nq-bar nq-bar-1"/>
        <rect x="7"  y="11" width="4" height="11" rx="1" class="nq-bar nq-bar-2"/>
        <rect x="13" y="6"  width="4" height="16" rx="1" class="nq-bar nq-bar-3"/>
        <rect x="19" y="1"  width="4" height="21" rx="1" class="nq-bar nq-bar-4"/>
      </svg>
      <span class="nq-label">Good</span>`;
    _netQualityBar = bar;

    // Inject into call screen header area
    const callTimer = document.getElementById('call-timer') ||
                      document.getElementById('call-status');
    if (callTimer && callTimer.parentElement) {
      callTimer.parentElement.insertBefore(bar, callTimer.nextSibling);
    } else {
      const callScreen = document.getElementById('call-screen');
      if (callScreen) callScreen.querySelector('#call-info-section, #call-controls')?.appendChild(bar);
    }
  }

  function updateNetworkQuality(level) {
    // level: 'excellent'|'good'|'fair'|'poor'|'bad'
    if (!_netQualityBar) return;
    _netQualityBar.dataset.level = level;
    const labels = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor', bad: 'Lost' };
    const lbl = _netQualityBar.querySelector('.nq-label');
    if (lbl) lbl.textContent = labels[level] || '';
  }

  function startNetworkQualityMonitor() {
    stopNetworkQualityMonitor();
    createNetworkQualityBar();
    if (_netQualityBar) _netQualityBar.style.display = 'flex';
    _netQualityInterval = setInterval(async () => {
      const pc = CC.getPeerConnection();
      if (!pc) { updateNetworkQuality('bad'); return; }
      const iceState = pc.iceConnectionState;
      if (iceState === 'failed' || iceState === 'disconnected') { updateNetworkQuality('bad'); return; }
      if (iceState === 'checking' || iceState === 'new') { updateNetworkQuality('fair'); return; }
      try {
        const stats = await pc.getStats();
        let rtt = null;
        let packetsLost = 0;
        let packetsSent = 0;
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime != null) rtt = report.currentRoundTripTime * 1000;
          }
          if (report.type === 'outbound-rtp') {
            packetsLost += report.packetsLost || 0;
            packetsSent += report.packetsSent || 1;
          }
        });
        const lossRate = packetsLost / packetsSent;
        let level = 'excellent';
        if (rtt !== null) {
          if (rtt > 400 || lossRate > 0.1) level = 'bad';
          else if (rtt > 200 || lossRate > 0.05) level = 'poor';
          else if (rtt > 100 || lossRate > 0.02) level = 'fair';
          else if (rtt > 50) level = 'good';
        }
        updateNetworkQuality(level);
      } catch (_) { updateNetworkQuality('fair'); }
    }, 3000);
  }

  function stopNetworkQualityMonitor() {
    if (_netQualityInterval) { clearInterval(_netQualityInterval); _netQualityInterval = null; }
    if (_netQualityBar) _netQualityBar.style.display = 'none';
  }

  // Hook into call start/end events via MutationObserver on callModal display
  function watchCallModal() {
    const callScreen = document.getElementById('call-screen');
    if (!callScreen) return;
    if (window.MutationBus) {
      MutationBus.observe('cmf:call-watch', callScreen, { attributes: true, attributeFilter: ['class'] }, function () {
        const hidden = callScreen.classList.contains('hidden');
        if (!hidden) startNetworkQualityMonitor();
        else stopNetworkQualityMonitor();
      });
    } else {
      _callWatchFallbackObs = new MutationObserver(function () {
        const hidden = callScreen.classList.contains('hidden');
        if (!hidden) startNetworkQualityMonitor();
        else stopNetworkQualityMonitor();
      });
      _callWatchFallbackObs.observe(callScreen, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ================================================================
     5. RATE LIMITING / SPAM PREVENTION (client-side, dual-window)
     Burst: max 5 messages per 1 second
     Sustained: max 30 messages per 60 seconds
  ================================================================ */
  const RATE_BURST_MAX = 5;
  const RATE_BURST_WINDOW = 1000;
  const RATE_SUSTAINED_MAX = 30;
  const RATE_SUSTAINED_WINDOW = 60000;
  let _rateBurstTimestamps = [];
  let _rateSustainedTimestamps = [];

  function checkClientRateLimit() {
    const now = Date.now();
    _rateBurstTimestamps = _rateBurstTimestamps.filter(t => now - t < RATE_BURST_WINDOW);
    _rateSustainedTimestamps = _rateSustainedTimestamps.filter(t => now - t < RATE_SUSTAINED_WINDOW);
    if (_rateBurstTimestamps.length >= RATE_BURST_MAX) {
      const wait = Math.ceil((RATE_BURST_WINDOW - (now - _rateBurstTimestamps[0])) / 1000);
      if (typeof window.showToast === 'function') {
        window.showToast(`Slow down — wait ${wait}s before sending more messages`, 'error');
      }
      return false;
    }
    if (_rateSustainedTimestamps.length >= RATE_SUSTAINED_MAX) {
      const wait = Math.ceil((RATE_SUSTAINED_WINDOW - (now - _rateSustainedTimestamps[0])) / 1000);
      if (typeof window.showToast === 'function') {
        window.showToast(`Rate limit reached — wait ${wait}s`, 'error');
      }
      return false;
    }
    _rateBurstTimestamps.push(now);
    _rateSustainedTimestamps.push(now);
    return true;
  }

  function patchSendMessageRateLimit() {
    const _orig = window.sendMessage;
    if (typeof _orig !== 'function') return;
    window.sendMessage = async function () {
      if (!checkClientRateLimit()) return;
      return _orig.apply(this, arguments);
    };
  }

  /* ================================================================
     6. CALL HOLD / RESUME — canonical implementation in call-controller-actions.js
     The duplicate here has been removed to prevent conflicts.
  ================================================================ */

  function watchCallEnd() {
    /* No-op: hold state is managed by CC.toggleCallHold / CC.resetCallHoldState */
  }

  /* ================================================================
     7. SWIPE-TO-REPLY GESTURE
     Swipe left on a message bubble to trigger reply mode.
     CSS for indicators is in message-actions.css.
  ================================================================ */
  function initSwipeToReply() {
    const messagesWrap = document.getElementById('messages-wrap');
    if (!messagesWrap) return;

    const THRESHOLD = 70;
    const MAX_DRAG = 120;
    let activeMsg = null;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let locked = false;

    function findMessageEl(target) {
      let node = target;
      while (node && node !== messagesWrap) {
        if (node.classList && node.classList.contains('message') && node.dataset.msgId) return node;
        node = node.parentElement;
      }
      return null;
    }

    function onStart(cx, cy, target) {
      const msg = findMessageEl(target);
      if (!msg) return;
      const bubble = msg.querySelector('.message-bubble');
      if (!bubble) return;
      activeMsg = msg;
      startX = cx;
      startY = cy;
      dx = 0;
      locked = false;
    }

    function onMove(cx, cy) {
      if (!activeMsg) return;
      const bubble = activeMsg.querySelector('.message-bubble');
      if (!bubble) { reset(); return; }
      const diffX = cx - startX;
      const diffY = cy - startY;
      if (!locked) {
        if (Math.abs(diffY) > 8 && Math.abs(diffY) > Math.abs(diffX)) { reset(); return; }
        if (Math.abs(diffX) > 6) locked = true;
        else return;
      }
      if (diffX > 0) { reset(); return; }
      dx = Math.max(-MAX_DRAG, diffX);
      bubble.style.setProperty('--reply-swipe-x', dx + 'px');
      bubble.style.transition = 'none';
      activeMsg.classList.toggle('reply-swipe-active', Math.abs(dx) >= 20);
      activeMsg.classList.toggle('delete-swipe-active', dx < -50);
    }

    function onEnd() {
      if (!activeMsg) return;
      const msg = activeMsg;
      const bubble = msg.querySelector('.message-bubble');
      const shouldReply = Math.abs(dx) >= THRESHOLD;
      const shouldDelete = dx < -90;
      if (shouldReply && !shouldDelete) {
        const msgId = msg.dataset.msgId;
        const sender = msg.dataset.sender || '';
        const text = (bubble?.textContent || '').substring(0, 80);
        if (typeof window.startReply === 'function') {
          window.startReply(msgId, sender, text);
        } else if (typeof window.replyToMessage === 'function') {
          window.replyToMessage(msgId);
        } else {
          const input = document.getElementById('msg-input');
          if (input) {
            input.dataset.replyTo = msgId;
            input.dataset.replyToSender = sender;
            input.placeholder = 'Reply to ' + (sender || 'message') + '...';
            input.focus();
          }
        }
      }
      reset();
    }

    function reset() {
      if (activeMsg) {
        const bubble = activeMsg.querySelector('.message-bubble');
        if (bubble) {
          bubble.style.transition = 'transform 200ms ease';
          bubble.style.removeProperty('--reply-swipe-x');
        }
        activeMsg.classList.remove('reply-swipe-active', 'delete-swipe-active');
      }
      activeMsg = null;
      dx = 0;
      locked = false;
    }

    messagesWrap.addEventListener('touchstart', function(e) {
      const t = e.touches[0];
      onStart(t.clientX, t.clientY, e.target);
    }, { passive: true });

    messagesWrap.addEventListener('touchmove', function(e) {
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
      if (locked && dx < 0 && e.cancelable) e.preventDefault();
    }, { passive: false });

    messagesWrap.addEventListener('touchend', onEnd, { passive: true });
    messagesWrap.addEventListener('touchcancel', reset, { passive: true });
  }

  /* ================================================================
     INIT — run after DOM + app is ready
  ================================================================ */
  function init() {
    initDragAndDrop();
    patchImageCompression();
    patchVideoThumbnail();
    patchSendMessageRateLimit();
    watchCallModal();
    watchCallEnd();
    initSwipeToReply();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 800);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(init, 800));
  }

  /* ─── destroy (logout cleanup) ──────────────────────────────── */
  function destroy() {
    if (window.MutationBus) {
      MutationBus.off('cmf:call-watch');
      MutationBus.off('cmf:call-end');
    }
    if (_callWatchFallbackObs) { _callWatchFallbackObs.disconnect(); _callWatchFallbackObs = null; }
    if (_callEndFallbackObs) { _callEndFallbackObs.disconnect(); _callEndFallbackObs = null; }
    stopNetworkQualityMonitor();
  }

  window.ChatMissingFeatures = { destroy: destroy };

})();
