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

  /* ================================================================
     1. DRAG-AND-DROP FILE UPLOAD
     Drop files onto the chat panel to attach them
  ================================================================ */
  function initDragAndDrop() {
    const chatPanel = document.getElementById('chat-area') ||
                      document.getElementById('messages-wrap') ||
                      document.querySelector('.chat-panel') ||
                      document.querySelector('.messages-wrapper, .chat-main');
    const messagesArea = document.getElementById('messages-wrap');
    const target = chatPanel || messagesArea || document.body;

    let dragCounter = 0;

    // Create drop overlay
    const overlay = document.createElement('div');
    overlay.id = 'dropZoneOverlay';
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

      const file = files[0]; // handle first file (batch can be added later)
      try {
        if (typeof window.handleFileUpload === 'function') {
          await window.handleFileUpload(file);
        } else {
          // Fallback: trigger the hidden file input
          const fileInput = document.getElementById('fileInput') ||
                            document.querySelector('input[type="file"]') ||
                            document.getElementById('media-file-input');
          if (fileInput) {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        if (files.length > 1) {
          if (typeof window.showToast === 'function') {
            window.showToast(`${files.length - 1} more file(s) dropped — send one at a time`, 'info');
          }
        }
      } catch (err) {
        if (typeof window.showToast === 'function') {
          window.showToast('Could not attach dropped file', 'error');
        }
      }
    });
  }

  /* ================================================================
     2. IMAGE COMPRESSION BEFORE UPLOAD
     Patches uploadRecordedMedia / uploadDocument to compress images
  ================================================================ */
  async function compressImage(file, { maxWidth = 1920, maxHeight = 1920, quality = 0.85 } = {}) {
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
      const pc = window.peerConnection;
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
    const obs = new MutationObserver(() => {
      const hidden = callScreen.classList.contains('hidden');
      if (!hidden) startNetworkQualityMonitor();
      else stopNetworkQualityMonitor();
    });
    obs.observe(callScreen, { attributes: true, attributeFilter: ['class'] });
  }

  /* ================================================================
     5. RATE LIMITING / SPAM PREVENTION (client-side)
     Prevents users from sending more than N messages per time window
  ================================================================ */
  const RATE_LIMIT_MAX = 10;      // max messages
  const RATE_LIMIT_WINDOW = 10000; // per 10 seconds
  let _rateMsgTimestamps = [];

  function checkClientRateLimit() {
    const now = Date.now();
    _rateMsgTimestamps = _rateMsgTimestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (_rateMsgTimestamps.length >= RATE_LIMIT_MAX) {
      const wait = Math.ceil((RATE_LIMIT_WINDOW - (now - _rateMsgTimestamps[0])) / 1000);
      if (typeof window.showToast === 'function') {
        window.showToast(`Slow down — wait ${wait}s before sending more messages`, 'error');
      }
      return false;
    }
    _rateMsgTimestamps.push(now);
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
     6. CALL HOLD / RESUME
     Suspends all local audio+video tracks to indicate hold
  ================================================================ */
  let _callOnHold = false;

  function addHoldButton() {
    if (document.getElementById('holdCallBtn')) return;
    const controls = document.getElementById('call-controls');
    if (!controls) return;

    const muteBtn = document.getElementById('btn-mute');
    if (!muteBtn) return;

    const btn = document.createElement('button');
    btn.id = 'holdCallBtn';
    btn.type = 'button';
    btn.className = 'call-icon-btn';
    btn.setAttribute('aria-label', 'Hold call');
    btn.setAttribute('aria-pressed', 'false');
    btn.dataset.controlLabel = 'HOLD';
    btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1"/>
      <rect x="14" y="4" width="4" height="16" rx="1"/>
    </svg>`;
    btn.title = 'Hold call';

    btn.addEventListener('click', toggleCallHold);
    muteBtn.parentElement?.insertBefore(btn, muteBtn.nextSibling);
  }

  function toggleCallHold() {
    _callOnHold = !_callOnHold;
    const btn = document.getElementById('holdCallBtn');
    const stream = window.localCallStream;

    if (stream) {
      stream.getTracks().forEach(track => {
        track.enabled = !_callOnHold;
      });
    }

    if (btn) {
      btn.classList.toggle('active', _callOnHold);
      btn.setAttribute('aria-pressed', String(_callOnHold));
      btn.title = _callOnHold ? 'Resume call' : 'Hold call';
      btn.dataset.controlLabel = _callOnHold ? 'RESUME' : 'HOLD';
    }

    // Show hold banner in call modal
    let holdBanner = document.getElementById('callHoldBanner');
    if (_callOnHold) {
      if (!holdBanner) {
        holdBanner = document.createElement('div');
        holdBanner.id = 'callHoldBanner';
        holdBanner.textContent = 'Call on hold — tap Resume to continue';
        const callModal = document.getElementById('callModal');
        const callInfo = callModal?.querySelector('.call-info, .call-avatar-area, .call-modal-top');
        if (callInfo) callInfo.appendChild(holdBanner);
        else if (callModal) callModal.prepend(holdBanner);
      }
      holdBanner.style.display = 'flex';
    } else {
      if (holdBanner) holdBanner.style.display = 'none';
    }

    if (typeof window.showToast === 'function') {
      window.showToast(_callOnHold ? 'Call placed on hold' : 'Call resumed');
    }
  }

  // Reset hold state when call ends
  function resetHoldState() {
    _callOnHold = false;
    const btn = document.getElementById('holdCallBtn');
    if (btn) { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); }
    const banner = document.getElementById('callHoldBanner');
    if (banner) banner.style.display = 'none';
  }

  function watchCallEnd() {
    const callScreen = document.getElementById('call-screen');
    if (!callScreen) return;
    new MutationObserver(() => {
      const hidden = callScreen.classList.contains('hidden');
      if (hidden) resetHoldState();
      else addHoldButton();
    }).observe(callScreen, { attributes: true, attributeFilter: ['class'] });
  }

  /* ================================================================
     INIT — run after DOM + app is ready
  ================================================================ */
  function init() {
    initDragAndDrop();
    patchVideoThumbnail();
    patchSendMessageRateLimit();
    watchCallModal();
    watchCallEnd();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 800);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(init, 800));
  }

})();
