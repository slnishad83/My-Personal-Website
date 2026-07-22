(function () {
  'use strict';

  var MAX_DURATION = 30;
  var VID_NOTE_SIZE = 200;

  var vnStream = null;
  var vnRecorder = null;
  var vnChunks = [];
  var vnTimer = null;
  var vnStartTime = 0;
  var vnPaused = false;
  var vnPausedDuration = 0;
  var vnPauseStart = 0;
  var vnFacingMode = 'user';
  var vnPreviewVideo = null;
  var vnOverlay = null;
  var vnCircle = null;
  var vnRecordBtn = null;
  var vnSendBtn = null;
  var vnCancelBtn = null;
  var vnFlipBtn = null;
  var vnTimerDisplay = null;
  var vnProgressRing = null;
  var vnRecording = false;
  var vnRecordComplete = false;
  var vnBlob = null;
  var vnActiveVideo = null;
  var vnIntersectionObserver = null;
  var vnPlaybackObserver = null;

  function getDb() { return window.db || (window.App && window.App.db) || null; }
  function getUser() { return window.currentUser || (window.App && window.App.currentUser) || null; }
  function getChat() { return window.currentChat || (window.App && window.App.currentChat) || null; }
  function esc(s) { return window.escHtml ? window.escHtml(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function toast(msg, type) { if (typeof window.showToast === 'function') window.showToast(msg, type); }

  function injectStyles() {
    if (document.getElementById('vn-styles')) return;
    var s = document.createElement('style');
    s.id = 'vn-styles';
    s.textContent = '\
      .vn-overlay{position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px)}\
      .vn-preview-wrap{position:relative;width:200px;height:200px;border-radius:50%;overflow:hidden;border:4px solid rgba(255,255,255,0.3);box-shadow:0 0 40px rgba(0,0,0,0.5)}\
      .vn-preview-wrap.recording{animation:vnWobble 0.8s ease-in-out infinite alternate;border-color:rgba(239,68,68,0.8)}\
      @keyframes vnWobble{0%{transform:scale(1) rotate(-1deg)}100%{transform:scale(1.03) rotate(1deg)}}\
      .vn-preview-video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}\
      .vn-preview-wrap.rear .vn-preview-video{transform:none}\
      .vn-controls{display:flex;align-items:center;gap:16px;margin-top:24px}\
      .vn-record-btn{width:72px;height:72px;border-radius:50%;border:4px solid #fff;background:#ef4444;cursor:pointer;position:relative;transition:all 0.2s;box-shadow:0 4px 20px rgba(239,68,68,0.4)}\
      .vn-record-btn:active{transform:scale(0.92)}\
      .vn-record-btn .vn-inner{width:28px;height:28px;border-radius:50%;background:#fff;transition:all 0.2s}\
      .vn-record-btn.recording .vn-inner{width:20px;height:20px;border-radius:4px;background:#fff}\
      .vn-send-btn,.vn-cancel-btn,.vn-flip-btn{width:48px;height:48px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;font-size:24px}\
      .vn-send-btn{background:#25D366;color:#fff}\
      .vn-send-btn:active{transform:scale(0.9)}\
      .vn-cancel-btn{background:rgba(255,255,255,0.15);color:#fff}\
      .vn-cancel-btn:active{transform:scale(0.9)}\
      .vn-flip-btn{background:rgba(255,255,255,0.15);color:#fff;font-size:20px}\
      .vn-flip-btn:active{transform:scale(0.9)}\
      .vn-timer{color:#fff;font-size:14px;font-weight:600;margin-top:12px;font-variant-numeric:tabular-nums;min-height:20px}\
      .vn-timer.limit{color:#ef4444}\
      .vn-hint{color:rgba(255,255,255,0.5);font-size:12px;margin-top:8px}\
      .vn-msg-bubble{display:inline-flex;align-items:center;gap:0;position:relative}\
      .vn-circle-wrap{width:160px;height:160px;border-radius:50%;overflow:hidden;cursor:pointer;position:relative;background:#000;box-shadow:0 2px 12px rgba(0,0,0,0.25);flex-shrink:0}\
      .vn-circle-wrap video{width:100%;height:100%;object-fit:cover;display:block}\
      .vn-play-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);border-radius:50%;transition:opacity 0.2s}\
      .vn-play-overlay.hidden{opacity:0;pointer-events:none}\
      .vn-play-overlay span{font-size:48px;color:#fff;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))}\
      .vn-progress-ring{position:absolute;inset:-4px;width:calc(100% + 8px);height:calc(100% + 8px);pointer-events:none}\
      .vn-progress-ring circle{fill:none;stroke:#25D366;stroke-width:3;stroke-linecap:round;stroke-dasharray:534;stroke-dashoffset:534;transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 0.15s linear}\
      .vn-duration-badge{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);color:#fff;font-size:10px;font-weight:600;padding:2px 6px;border-radius:8px;pointer-events:none;z-index:2}\
      .vn-msg-wrap{margin:4px 0}\
      .vn-msg-wrap.outgoing .vn-circle-wrap{box-shadow:0 2px 12px rgba(37,211,102,0.2)}\
      .vn-msg-wrap.outgoing .vn-progress-ring circle{stroke:#25D366}\
      .vn-msg-wrap.incoming .vn-progress-ring circle{stroke:#60a5fa}\
    ';
    document.head.appendChild(s);
  }

  function createOverlay() {
    vnOverlay = document.createElement('div');
    vnOverlay.className = 'vn-overlay';
    vnOverlay.innerHTML = '\
      <div class="vn-preview-wrap" id="vn-preview-wrap">\
        <video class="vn-preview-video" id="vn-preview-video" autoplay playsinline muted></video>\
      </div>\
      <div class="vn-timer" id="vn-timer">0:00 / 0:30</div>\
      <div class="vn-hint" id="vn-hint">Tap to record</div>\
      <div class="vn-controls">\
        <button class="vn-cancel-btn" id="vn-cancel-btn" aria-label="Cancel">✕</button>\
        <button class="vn-flip-btn" id="vn-flip-btn" aria-label="Flip camera">↻</button>\
        <button class="vn-record-btn" id="vn-record-btn" aria-label="Record"><div class="vn-inner"></div></button>\
        <button class="vn-pause-btn" id="vn-pause-btn" aria-label="Pause" style="display:none"><span class="material-symbols-outlined">pause</span></button>\
        <button class="vn-send-btn" id="vn-send-btn" aria-label="Send" style="display:none">➤</button>\
      </div>';
    document.body.appendChild(vnOverlay);

    vnPreviewVideo = document.getElementById('vn-preview-video');
    vnCircle = document.getElementById('vn-preview-wrap');
    vnRecordBtn = document.getElementById('vn-record-btn');
    vnSendBtn = document.getElementById('vn-send-btn');
    vnCancelBtn = document.getElementById('vn-cancel-btn');
    vnFlipBtn = document.getElementById('vn-flip-btn');
    vnTimerDisplay = document.getElementById('vn-timer');
    var vnPauseBtn = document.getElementById('vn-pause-btn');

    vnRecordBtn.addEventListener('click', onRecordTap);
    vnSendBtn.addEventListener('click', function () { if (vnBlob) sendVideoNote(vnBlob); });
    vnCancelBtn.addEventListener('click', cancelVideoNoteRecording);
    vnFlipBtn.addEventListener('click', flipCamera);
    if (vnPauseBtn) vnPauseBtn.addEventListener('click', togglePauseRecording);
  }

  function togglePauseRecording() {
    if (!vnRecorder || vnRecorder.state === 'inactive') return;
    var pauseBtn = document.getElementById('vn-pause-btn');
    var pauseIcon = pauseBtn ? pauseBtn.querySelector('.material-symbols-outlined, span') : null;
    if (vnPaused) {
      vnRecorder.resume();
      vnPaused = false;
      vnPausedDuration += Date.now() - vnPauseStart;
      if (pauseIcon) pauseIcon.textContent = 'pause';
      vnRecordBtn.classList.add('recording');
    } else {
      vnRecorder.pause();
      vnPaused = true;
      vnPauseStart = Date.now();
      if (pauseIcon) pauseIcon.textContent = 'play_arrow';
      vnRecordBtn.classList.remove('recording');
    }
  }

  function onRecordTap() {
    if (!vnRecording && !vnRecordComplete) {
      startRecording();
    } else if (vnRecording) {
      stopRecording();
    }
  }

  async function startCamera() {
    try {
      vnStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: vnFacingMode, width: { ideal: 640 }, height: { ideal: 640 } },
        audio: true
      });
      if (vnPreviewVideo) {
        vnPreviewVideo.srcObject = vnStream;
      }
      return true;
    } catch (e) {
      toast('Camera access denied', 'error');
      return false;
    }
  }

  async function startRecording() {
    if (!vnStream) {
      var ok = await startCamera();
      if (!ok) return;
    }

    vnChunks = [];
    vnPaused = false;
    vnPausedDuration = 0;
    vnRecordComplete = false;
    vnBlob = null;

    var mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/mp4';
    }

    try {
      vnRecorder = new MediaRecorder(vnStream, { mimeType: mimeType });
    } catch (e) {
      vnRecorder = new MediaRecorder(vnStream);
    }

    vnRecorder.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) vnChunks.push(e.data);
    };

    vnRecorder.onstop = function () {
      if (vnChunks.length > 0) {
        vnBlob = new Blob(vnChunks, { type: vnRecorder.mimeType || 'video/webm' });
        vnRecordComplete = true;
        showSendState();
      }
    };

    vnRecorder.start(100);
    vnRecording = true;
    vnStartTime = Date.now();

    vnRecordBtn.classList.add('recording');
    vnCircle.classList.add('recording');
    if (vnFlipBtn) vnFlipBtn.style.display = 'none';
    var vnPauseBtn = document.getElementById('vn-pause-btn');
    if (vnPauseBtn) vnPauseBtn.style.display = '';

    vnTimer = setInterval(updateTimer, 100);
  }

  function stopRecording() {
    if (!vnRecorder || vnRecorder.state === 'inactive') return;
    vnRecorder.stop();
    vnRecording = false;
    vnPaused = false;
    clearInterval(vnTimer);
    vnRecordBtn.classList.remove('recording');
    vnCircle.classList.remove('recording');
    if (vnFlipBtn) vnFlipBtn.style.display = '';
    var vnPauseBtn = document.getElementById('vn-pause-btn');
    if (vnPauseBtn) vnPauseBtn.style.display = 'none';
  }

  function updateTimer() {
    if (vnPaused) return;
    var elapsed = (Date.now() - vnStartTime - vnPausedDuration) / 1000;
    var secs = Math.floor(elapsed);
    var ms = Math.floor((elapsed - secs) * 10);
    if (secs >= MAX_DURATION) {
      secs = MAX_DURATION;
      stopRecording();
      toast('Max recording time reached', 'info');
    }
    vnTimerDisplay.textContent = '0:' + (secs < 10 ? '0' : '') + secs + ' / 0:' + MAX_DURATION;
    if (secs >= MAX_DURATION - 5) {
      vnTimerDisplay.classList.add('limit');
    } else {
      vnTimerDisplay.classList.remove('limit');
    }
  }

  function showSendState() {
    vnRecordBtn.style.display = 'none';
    vnSendBtn.style.display = '';
    vnFlipBtn.style.display = 'none';
    document.getElementById('vn-hint').textContent = 'Tap send to share';
    if (vnPreviewVideo && vnBlob) {
      vnPreviewVideo.srcObject = null;
      var url = URL.createObjectURL(vnBlob);
      vnPreviewVideo.src = url;
      vnPreviewVideo.loop = true;
      vnPreviewVideo.play().catch(function () {});
    }
  }

  async function flipCamera() {
    vnFacingMode = vnFacingMode === 'user' ? 'environment' : 'user';
    if (vnCircle) vnCircle.classList.toggle('rear', vnFacingMode === 'environment');
    if (vnStream) {
      vnStream.getTracks().forEach(function (t) { t.stop(); });
    }
    await startCamera();
  }

  function resetOverlay() {
    vnRecording = false;
    vnRecordComplete = false;
    vnBlob = null;
    vnChunks = [];
    vnPaused = false;
    vnPausedDuration = 0;
    clearInterval(vnTimer);
    if (vnRecorder && vnRecorder.state !== 'inactive') {
      try { vnRecorder.stop(); } catch (_) {}
    }
    vnRecorder = null;
    if (vnRecordBtn) {
      vnRecordBtn.style.display = '';
      vnRecordBtn.classList.remove('recording');
    }
    if (vnSendBtn) vnSendBtn.style.display = 'none';
    if (vnFlipBtn) vnFlipBtn.style.display = '';
    var vnPauseBtn2 = document.getElementById('vn-pause-btn');
    if (vnPauseBtn2) vnPauseBtn2.style.display = 'none';
    if (vnCircle) vnCircle.classList.remove('recording');
    if (vnTimerDisplay) {
      vnTimerDisplay.textContent = '0:00 / 0:30';
      vnTimerDisplay.classList.remove('limit');
    }
    var hint = document.getElementById('vn-hint');
    if (hint) hint.textContent = 'Tap to record';
    if (vnPreviewVideo) {
      vnPreviewVideo.srcObject = null;
      vnPreviewVideo.src = '';
      vnPreviewVideo.loop = false;
    }
  }

  async function startVideoNoteRecording() {
    installPlaybackObserver();
    injectStyles();
    createOverlay();
    resetOverlay();
    vnOverlay.style.display = '';
    var ok = await startCamera();
    if (!ok) {
      cancelVideoNoteRecording();
    }
  }

  function cancelVideoNoteRecording() {
    if (vnStream) {
      vnStream.getTracks().forEach(function (t) { t.stop(); });
      vnStream = null;
    }
    if (vnPreviewVideo) {
      vnPreviewVideo.srcObject = null;
      vnPreviewVideo.src = '';
    }
    resetOverlay();
    if (vnOverlay) {
      vnOverlay.remove();
      vnOverlay = null;
    }
  }

  async function sendVideoNote(blob) {
    if (!blob) return;
    var user = getUser();
    var chat = getChat();
    var db = getDb();
    if (!user || !chat || !db) {
      toast('Unable to send', 'error');
      return;
    }

    toast('Uploading video note...', 'info');

    try {
      var uploadFn = window.uploadToCloudinary || window.uploadDocument || window.uploadRecordedMedia;
      var url;
      if (uploadFn) {
        var file = new File([blob], 'video-note-' + Date.now() + '.webm', { type: blob.type || 'video/webm' });
        url = await uploadFn(file);
      } else {
        var safe = 'video-note-' + Date.now() + '.webm';
        var path = 'chat_uploads/' + user.uid + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + safe;
        var ref = window.storage.ref(path);
        var task = ref.put(blob);
        await task;
        url = await ref.getDownloadURL();
      }

      var msgData = {
        chatId: chat.id,
        chatType: chat.type || 'direct',
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Me',
        senderEmail: user.email || '',
        text: '',
        type: 'videoNote',
        attachment: {
          type: 'videoNote',
          url: url,
          duration: Math.min(Math.floor((Date.now() - vnStartTime - vnPausedDuration) / 1000), MAX_DURATION)
        },
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        time: Date.now(),
        status: 'sent',
        read: false
      };

      await db.collection('messages').add(msgData);

      if (chat.lastMessageTime !== undefined) {
        var updateData = {
          lastMessage: '🎥 Video Note',
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          lastMessageSenderId: user.uid,
          lastMessageSenderName: user.displayName || 'Me'
        };
        db.collection('chats').doc(chat.id).update(updateData).catch(function () {});
      }

      toast('Video note sent', 'success');
      cancelVideoNoteRecording();
    } catch (e) {
      console.error('[VideoNote] Send error:', e);
      toast('Failed to send video note', 'error');
    }
  }

  function _showVideoNoteFullscreen(url) {
    var existing = document.getElementById('vn-fullscreen-overlay');
    if (existing) existing.remove();
    var html = '<div id="vn-fullscreen-overlay" class="fixed inset-0 z-50 bg-black flex items-center justify-center" style="cursor:pointer">' +
      '<video id="vn-fullscreen-video" src="' + esc(url) + '" class="w-full h-full object-contain" playsinline controls></video>' +
      '<button id="vn-fullscreen-close" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center z-10"><span class="material-symbols-outlined">close</span></button>' +
      '</div>';
    document.body.insertAdjacentHTML('beforeend', html);
    var overlay = document.getElementById('vn-fullscreen-overlay');
    var video = document.getElementById('vn-fullscreen-video');
    var closeBtn = document.getElementById('vn-fullscreen-close');
    if (video) video.play().catch(function () {});
    function closeFS() {
      if (video) { video.pause(); video.src = ''; }
      if (overlay) overlay.remove();
    }
    if (closeBtn) closeBtn.onclick = function (e) { e.stopPropagation(); closeFS(); };
    if (overlay) overlay.onclick = function (e) { if (e.target === overlay) closeFS(); };
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { closeFS(); document.removeEventListener('keydown', handler); }
    });
  }

  function renderVideoNote(msgId, url, container) {
    if (!url || !container) return;

    installPlaybackObserver();
    injectStyles();

    var wrap = document.createElement('div');
    wrap.className = 'vn-msg-wrap';
    wrap.setAttribute('data-vn-msg-id', msgId);

    var circle = document.createElement('div');
    circle.className = 'vn-circle-wrap';
    circle.setAttribute('data-vn-msg-id', msgId);

    var video = document.createElement('video');
    video.src = url;
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = true;
    video.loop = false;
    video.setAttribute('data-vn-msg-id', msgId);

    var playOverlay = document.createElement('div');
    playOverlay.className = 'vn-play-overlay';
    playOverlay.innerHTML = '<span class="material-symbols-outlined" style="font-size:48px">play_arrow</span>';

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.classList.add('vn-progress-ring');
    svg.setAttribute('viewBox', '0 0 180 180');
    var circleEl = document.createElementNS(svgNS, 'circle');
    circleEl.setAttribute('cx', '90');
    circleEl.setAttribute('cy', '90');
    circleEl.setAttribute('r', '85');
    svg.appendChild(circleEl);

    circle.appendChild(video);
    circle.appendChild(playOverlay);
    circle.appendChild(svg);
    wrap.appendChild(circle);
    container.appendChild(wrap);

    video.addEventListener('loadedmetadata', function () {
      var dur = video.duration || 0;
      var badge = document.createElement('div');
      badge.className = 'vn-duration-badge';
      var mins = Math.floor(dur / 60);
      var secs = Math.floor(dur % 60);
      badge.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
      circle.appendChild(badge);
    });

    video.addEventListener('ended', function () {
      playOverlay.classList.remove('hidden');
      circleEl.style.strokeDashoffset = '534';
    });

    circle.addEventListener('click', function () {
      toggleVideoNotePlayback(msgId);
    });

    var longPressTimer = null;
    circle.addEventListener('touchstart', function (e) {
      longPressTimer = setTimeout(function () {
        longPressTimer = null;
        _showVideoNoteFullscreen(url);
      }, 600);
    }, { passive: true });
    circle.addEventListener('touchend', function () {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    });
    circle.addEventListener('touchmove', function () {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    });
    circle.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      longPressTimer = setTimeout(function () {
        longPressTimer = null;
        _showVideoNoteFullscreen(url);
      }, 600);
    });
    circle.addEventListener('mouseup', function () {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    });
    circle.addEventListener('mouseleave', function () {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    });
  }

  function toggleVideoNotePlayback(msgId) {
    var circle = document.querySelector('.vn-circle-wrap[data-vn-msg-id="' + msgId + '"]');
    if (!circle) return;
    var video = circle.querySelector('video');
    var overlay = circle.querySelector('.vn-play-overlay');
    var svgCircle = circle.querySelector('.vn-progress-ring circle');
    if (!video) return;

    if (vnActiveVideo && vnActiveVideo !== video) {
      vnActiveVideo.pause();
      var prevOverlay = vnActiveVideo.closest('.vn-circle-wrap');
      if (prevOverlay) {
        var po = prevOverlay.querySelector('.vn-play-overlay');
        if (po) po.classList.remove('hidden');
        var pc = prevOverlay.querySelector('.vn-progress-ring circle');
        if (pc) pc.style.strokeDashoffset = '534';
      }
      vnActiveVideo.muted = true;
    }

    if (video.paused) {
      video.muted = false;
      video.play().catch(function () {});
      if (overlay) overlay.classList.add('hidden');
      vnActiveVideo = video;

      video._vnProgressInterval = setInterval(function () {
        if (video.duration && svgCircle) {
          var pct = video.currentTime / video.duration;
          var offset = 534 - (534 * pct);
          svgCircle.style.strokeDashoffset = String(offset);
        }
      }, 150);
    } else {
      video.pause();
      if (overlay) overlay.classList.remove('hidden');
      clearInterval(video._vnProgressInterval);
      vnActiveVideo = null;
    }
  }

  function installPlaybackObserver() {
    if (vnPlaybackObserver) return;

    if ('IntersectionObserver' in window) {
      vnPlaybackObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var video = entry.target.querySelector('video');
          if (!video || video.paused) return;
          if (!entry.isIntersecting) {
            video.muted = true;
          } else if (video.muted && !video.paused) {
            video.muted = false;
          }
        });
      }, { threshold: 0.5 });

      document.querySelectorAll('.vn-circle-wrap').forEach(function (el) {
        vnPlaybackObserver.observe(el);
      });

      var mutObs = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              if (node.classList && node.classList.contains('vn-circle-wrap')) {
                vnPlaybackObserver.observe(node);
              }
              node.querySelectorAll && node.querySelectorAll('.vn-circle-wrap').forEach(function (el) {
                vnPlaybackObserver.observe(el);
              });
            }
          });
        });
      });
      mutObs.observe(document.getElementById('messages-wrap') || document.body, { childList: true, subtree: true });
    }
  }

  window.startVideoNoteRecording = startVideoNoteRecording;
  window.stopVideoNoteRecording = stopRecording;
  window.cancelVideoNoteRecording = cancelVideoNoteRecording;
  window.sendVideoNote = sendVideoNote;
  window.renderVideoNote = renderVideoNote;
  window.toggleVideoNotePlayback = toggleVideoNotePlayback;
})();
