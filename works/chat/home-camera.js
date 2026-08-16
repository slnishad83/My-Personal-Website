(function () {
  'use strict';

  var _fabEl = null;
  var _overlayEl = null;
  var _videoEl = null;
  var _stream = null;
  var _facingMode = 'environment';
  var _flashMode = 'off';
  var _isRecording = false;
  var _recordTimer = null;
  var _recordStart = 0;
  var _maxDuration = 15;
  var _recordInterval = null;
  var _mediaRecorder = null;
  var _recordedChunks = [];
  var _holdTimeout = null;
  var _holdTriggered = false;
  var _visible = true;
  var _scrollY = 0;
  var _scrollDir = 'up';
  var _lastScrollY = 0;

  var _db = function() { return App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };
  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };
  function _toast(msg, t) { if (App && App.toast) App.toast(msg, t); else if (typeof window.showToast === 'function') window.showToast(msg, t); }

  function _ensureFab() {
    if (_fabEl) return;
    _fabEl = document.createElement('button');
    _fabEl.id = 'home-camera-fab';
    _fabEl.setAttribute('aria-label', 'Open camera');
    _fabEl.style.cssText = 'position:fixed;right:20px;bottom:calc(env(safe-area-inset-bottom,0px) + 80px);width:56px;height:56px;border-radius:50%;background:var(--primary,#128C7E);color:#fff;border:none;cursor:pointer;z-index:60;display:none;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:transform .2s,opacity .2s;';
    _fabEl.innerHTML = '<span class="material-symbols-outlined" style="font-size:26px">photo_camera</span>';
    _fabEl.addEventListener('click', openCameraFromHome);
    document.body.appendChild(_fabEl);
    if (window.innerWidth <= 768) {
      _fabEl.style.width = '48px';
      _fabEl.style.height = '48px';
      _fabEl.querySelector('.material-symbols-outlined').style.fontSize = '22px';
    }
    window.addEventListener('scroll', _onScroll, { passive: true });
  }

  function _onScroll() {
    var sy = window.pageYOffset || document.documentElement.scrollTop;
    _scrollDir = sy > _lastScrollY ? 'down' : 'up';
    _lastScrollY = sy;
    if (_scrollDir === 'down' && sy > 100 && _visible && _fabEl) {
      _fabEl.style.transform = 'scale(0)';
      _fabEl.style.opacity = '0';
      _fabEl.style.pointerEvents = 'none';
    } else if (_scrollDir === 'up' && _fabEl) {
      _fabEl.style.transform = 'scale(1)';
      _fabEl.style.opacity = '1';
      _fabEl.style.pointerEvents = '';
    }
  }

  function showHomeCamera() {
    _ensureFab();
    _visible = true;
    _fabEl.style.display = 'flex';
    _fabEl.style.transform = 'scale(1)';
    _fabEl.style.opacity = '1';
    _fabEl.style.pointerEvents = '';
  }

  function hideHomeCamera() {
    _ensureFab();
    _visible = false;
    _fabEl.style.display = 'none';
  }

  function _buildOverlay() {
    if (_overlayEl) return;
    _overlayEl = document.createElement('div');
    _overlayEl.id = 'home-camera-overlay';
    _overlayEl.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;display:none;flex-direction:column;';

    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'position:absolute;top:16px;left:16px;width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;';
    closeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:24px">close</span>';
    closeBtn.addEventListener('click', _closeOverlay);
    _overlayEl.appendChild(closeBtn);

    var flashBtn = document.createElement('button');
    flashBtn.id = 'hc-flash-btn';
    flashBtn.style.cssText = 'position:absolute;top:16px;right:80px;width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;';
    flashBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">flash_off</span>';
    flashBtn.addEventListener('click', _cycleFlash);
    _overlayEl.appendChild(flashBtn);

    var flipBtn = document.createElement('button');
    flipBtn.style.cssText = 'position:absolute;top:16px;right:16px;width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;';
    flipBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">flip_camera_ios</span>';
    flipBtn.addEventListener('click', flipHomeCamera);
    _overlayEl.appendChild(flipBtn);

    var previewArea = document.createElement('div');
    previewArea.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;';
    _videoEl = document.createElement('video');
    _videoEl.autoplay = true;
    _videoEl.muted = true;
    _videoEl.playsInline = true;
    _videoEl.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    previewArea.appendChild(_videoEl);
    _overlayEl.appendChild(previewArea);

    var controlsBar = document.createElement('div');
    controlsBar.style.cssText = 'position:absolute;bottom:0;left:0;right:0;padding:env(safe-area-inset-bottom,16px) 16px 24px;display:flex;align-items:center;justify-content:center;gap:24px;background:linear-gradient(transparent,rgba(0,0,0,0.6));';

    var galleryBtn = document.createElement('button');
    galleryBtn.style.cssText = 'width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.4);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    galleryBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:24px">photo_library</span>';
    galleryBtn.addEventListener('click', _pickFromGallery);
    controlsBar.appendChild(galleryBtn);

    var captureWrap = document.createElement('div');
    captureWrap.style.cssText = 'position:relative;width:72px;height:72px;display:flex;align-items:center;justify-content:center;';

    var captureRing = document.createElement('div');
    captureRing.id = 'hc-capture-ring';
    captureRing.style.cssText = 'position:absolute;inset:0;border-radius:50%;border:4px solid #fff;pointer-events:none;transition:border-color .2s;';

    var captureProgress = document.createElement('div');
    captureProgress.id = 'hc-capture-progress';
    captureProgress.style.cssText = 'position:absolute;inset:-4px;border-radius:50%;border:4px solid transparent;border-top-color:#ff3b30;pointer-events:none;display:none;';

    var captureBtn = document.createElement('button');
    captureBtn.id = 'hc-capture-btn';
    captureBtn.style.cssText = 'width:64px;height:64px;border-radius:50%;background:#fff;border:none;cursor:pointer;transition:transform .15s;background-image:radial-gradient(circle,var(--primary,#128C7E) 100%,#fff 100%);background-size:100% 100%;';

    captureBtn.addEventListener('pointerdown', _onCaptureDown);
    captureBtn.addEventListener('pointerup', _onCaptureUp);
    captureBtn.addEventListener('pointerleave', _onCaptureUp);

    captureWrap.appendChild(captureRing);
    captureWrap.appendChild(captureProgress);
    captureWrap.appendChild(captureBtn);
    controlsBar.appendChild(captureWrap);

    var switchBtn = document.createElement('button');
    switchBtn.style.cssText = 'width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.4);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    switchBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:24px">flip_camera_ios</span>';
    switchBtn.addEventListener('click', flipHomeCamera);
    controlsBar.appendChild(switchBtn);

    _overlayEl.appendChild(controlsBar);
    document.body.appendChild(_overlayEl);
  }

  async function _startStream() {
    try {
      if (_stream) {
        _stream.getTracks().forEach(function (t) { t.stop(); });
      }
      var constraints = { video: { facingMode: _facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false };
      _stream = await navigator.mediaDevices.getUserMedia(constraints);
      _videoEl.srcObject = _stream;
      _applyFlash();
    } catch (e) {
      _toast('Camera access denied', 'error');
      _closeOverlay();
    }
  }

  function _applyFlash() {
    if (!_stream) return;
    var track = _stream.getVideoTracks()[0];
    if (!track || !track.getCapabilities || !track.getCapabilities().torch) return;
    var torchOn = _flashMode === 'on';
    track.applyConstraints({ advanced: [{ torch: torchOn }] }).catch(function () {});
  }

  function _cycleFlash() {
    var modes = ['off', 'on', 'auto'];
    var idx = modes.indexOf(_flashMode);
    _flashMode = modes[(idx + 1) % modes.length];
    var btn = document.getElementById('hc-flash-btn');
    if (btn) {
      var icons = { off: 'flash_off', on: 'flash_on', auto: 'flash_auto' };
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">' + icons[_flashMode] + '</span>';
    }
    _applyFlash();
    _toast('Flash: ' + _flashMode, 'info');
  }

  async function openCameraFromHome() {
    _buildOverlay();
    _overlayEl.style.display = 'flex';
    await _startStream();
  }

  function _closeOverlay() {
    if (_overlayEl) _overlayEl.style.display = 'none';
    if (_stream) {
      _stream.getTracks().forEach(function (t) { t.stop(); });
      _stream = null;
    }
    if (_videoEl) _videoEl.srcObject = null;
    _stopRecording();
    _clearTimers();
  }

  function flipHomeCamera() {
    _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
    _startStream();
  }

  function _onCaptureDown(e) {
    e.preventDefault();
    _holdTriggered = false;
    _holdTimeout = setTimeout(function () {
      _holdTriggered = true;
      _startVideoRecord();
    }, 300);
  }

  function _onCaptureUp(e) {
    e.preventDefault();
    clearTimeout(_holdTimeout);
    if (_holdTriggered) {
      _stopRecording();
    } else {
      captureQuickPhoto();
    }
  }

  function _startVideoRecord() {
    if (!_stream) return;
    _isRecording = true;
    _recordedChunks = [];
    _recordStart = Date.now();
    var ring = document.getElementById('hc-capture-ring');
    if (ring) ring.style.borderColor = '#ff3b30';
    var prog = document.getElementById('hc-capture-progress');
    if (prog) prog.style.display = 'block';
    try {
      _mediaRecorder = new MediaRecorder(_stream, { mimeType: 'video/webm;codecs=vp9' });
    } catch (_) {
      try { _mediaRecorder = new MediaRecorder(_stream, { mimeType: 'video/webm' }); } catch (_) { _mediaRecorder = new MediaRecorder(_stream); }
    }
    _mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size > 0) _recordedChunks.push(e.data); };
    _mediaRecorder.onstop = _onRecordStop;
    _mediaRecorder.start(100);
    _recordInterval = setInterval(function () {
      var elapsed = (Date.now() - _recordStart) / 1000;
      var deg = Math.min(elapsed / _maxDuration, 1) * 360;
      if (prog) prog.style.transform = 'rotate(' + (deg - 90) + 'deg)';
      prog.style.borderTopColor = elapsed >= _maxDuration * 0.8 ? '#ff9500' : '#ff3b30';
      if (elapsed >= _maxDuration) {
        _stopRecording();
      }
    }, 100);
  }

  function _stopRecording() {
    if (!_isRecording || !_mediaRecorder) return;
    _isRecording = false;
    try { _mediaRecorder.stop(); } catch (_) {}
    clearInterval(_recordInterval);
    var ring = document.getElementById('hc-capture-ring');
    if (ring) ring.style.borderColor = '#fff';
    var prog = document.getElementById('hc-capture-progress');
    if (prog) { prog.style.display = 'none'; prog.style.transform = ''; }
  }

  function _onRecordStop() {
    if (!_recordedChunks.length) return;
    var blob = new Blob(_recordedChunks, { type: _mediaRecorder.mimeType || 'video/webm' });
    _recordedChunks = [];
    _showActionSheet(blob, 'video');
  }

  function captureQuickPhoto() {
    if (!_stream || !_videoEl) return;
    var canvas = document.createElement('canvas');
    canvas.width = _videoEl.videoWidth || 1280;
    canvas.height = _videoEl.videoHeight || 720;
    var ctx = canvas.getContext('2d');
    if (_facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(_videoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(function (blob) {
      if (blob) _showActionSheet(blob, 'photo');
    }, 'image/jpeg', 0.92);
  }

  function captureQuickVideo() {
    if (_isRecording) {
      _stopRecording();
    } else {
      _startVideoRecord();
    }
  }

  function _clearTimers() {
    clearTimeout(_holdTimeout);
    clearInterval(_recordInterval);
    _isRecording = false;
    _recordedChunks = [];
  }

  function _showActionSheet(blob, type) {
    _closeOverlay();
    var sheet = document.createElement('div');
    sheet.id = 'hc-action-sheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;';

    var backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);';
    backdrop.addEventListener('click', function () { sheet.remove(); });
    sheet.appendChild(backdrop);

    var panel = document.createElement('div');
    panel.style.cssText = 'position:relative;width:100%;max-width:480px;background:var(--surface,#fff);border-radius:16px 16px 0 0;padding:env(safe-area-inset-bottom,0px) 0 0;overflow:hidden;';

    var preview = document.createElement('div');
    preview.style.cssText = 'width:100%;height:200px;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;';
    if (type === 'photo') {
      var img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
      preview.appendChild(img);
    } else {
      var vid = document.createElement('video');
      vid.src = URL.createObjectURL(blob);
      vid.autoplay = true;
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.style.cssText = 'width:100%;height:100%;object-fit:contain;';
      preview.appendChild(vid);
    }
    panel.appendChild(preview);

    var title = document.createElement('div');
    title.style.cssText = 'padding:16px 20px 8px;font-weight:600;font-size:16px;color:var(--on-surface,#1a1a1a);';
    title.textContent = type === 'photo' ? 'Photo captured' : 'Video recorded';
    panel.appendChild(title);

    var actions = [
      { icon: 'chat', label: 'Send to chat', action: function () { _sendAsMessage(blob, type); } },
      { icon: 'add_photo_alternate', label: 'Add to status', action: function () { _addAsStatus(blob, type); } },
      { icon: 'download', label: 'Save to gallery', action: function () { _saveToGallery(blob, type); } },
    ];

    actions.forEach(function (a) {
      var btn = document.createElement('button');
      btn.style.cssText = 'width:100%;display:flex;align-items:center;gap:14px;padding:14px 20px;border:none;background:none;cursor:pointer;font-size:15px;color:var(--on-surface,#1a1a1a);text-align:left;';
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px;color:var(--primary,#128C7E)">' + a.icon + '</span>' + (window.escHtml ? window.escHtml(a.label) : a.label);
      btn.addEventListener('click', function () { sheet.remove(); a.action(); });
      btn.addEventListener('mouseenter', function () { btn.style.background = 'var(--surface-variant,rgba(0,0,0,0.04))'; });
      btn.addEventListener('mouseleave', function () { btn.style.background = 'none'; });
      panel.appendChild(btn);
    });

    var cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'width:100%;padding:14px;border:none;background:none;cursor:pointer;font-size:15px;font-weight:600;color:var(--primary,#128C7E);border-top:1px solid var(--outline-variant,rgba(0,0,0,0.08));margin-top:4px;';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () { sheet.remove(); });
    panel.appendChild(cancelBtn);

    sheet.appendChild(panel);
    document.body.appendChild(sheet);
    panel.style.transform = 'translateY(100%)';
    requestAnimationFrame(function () { panel.style.transition = 'transform .3s ease'; panel.style.transform = 'translateY(0)'; });
  }

  function _sendAsMessage(blob, type) {
    if (!window.currentUser) { _toast('Sign in first', 'error'); return; }
    if (typeof window.openForwardModal === 'function') {
      var fakeMsg = { type: type, blob: blob, _cameraCapture: true };
      window.openForwardModal(fakeMsg);
      return;
    }
    _toast('Select a chat to send', 'info');
  }

  async function _addAsStatus(blob, type) {
    if (!window.currentUser) { _toast('Sign in first', 'error'); return; }
    try {
      _toast('Uploading to status...', 'info');
      var url;
      var ext = type === 'photo' ? 'jpg' : 'webm';
      var file = new File([blob], 'status_' + Date.now() + '.' + ext, { type: blob.type });
      if (typeof window.uploadToFirebaseStorage === 'function') {
        url = await window.uploadToFirebaseStorage(file, 'status_media');
      } else if (typeof window.uploadToCloudinary === 'function') {
        url = await window.uploadToCloudinary(file, 'status_media');
      } else {
        _toast('Storage not available', 'error');
        return;
      }
      var visibility = (typeof window.computeStatusVisibleTo === 'function')
        ? window.computeStatusVisibleTo()
        : { visibleTo: ['*'], privacyMode: 'everyone' };
      var statusData = {
        userId: window.currentUser.uid,
        userName: window.currentUser.displayName || 'Me',
        userPhoto: window.currentUser.photoURL || '',
        type: type,
        content: url,
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000,
        visibleTo: visibility.visibleTo || ['*'],
        privacyMode: visibility.privacyMode || 'everyone'
      };
      var firestore = (window.App && window.App.db) ? window.App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null);
      if (firestore) {
        if (window.Status && typeof window.Status.syncContacts === 'function') {
          try { await window.Status.syncContacts(); } catch (_) {}
        }
        await firestore.collection('statuses').add(statusData);
      }
      _toast('Added to status!', 'success');
    } catch (e) {
      _toast('Failed: ' + (e.message || 'Unknown error'), 'error');
    }
  }

  function _saveToGallery(blob, type) {
    var ext = type === 'photo' ? 'jpg' : 'webm';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'capture_' + Date.now() + '.' + ext;
    a.click();
    URL.revokeObjectURL(a.href);
    _toast('Saved!', 'success');
  }

  function _pickFromGallery() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.capture = false;
    input.style.display = 'none';
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var isVid = file.type.startsWith('video');
      _showActionSheet(file, isVid ? 'video' : 'photo');
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  }

  window.showHomeCamera = showHomeCamera;
  window.hideHomeCamera = hideHomeCamera;
  window.openCameraFromHome = openCameraFromHome;
  window.captureQuickPhoto = captureQuickPhoto;
  window.captureQuickVideo = captureQuickVideo;
  window.flipHomeCamera = flipHomeCamera;
})();
