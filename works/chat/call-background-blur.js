/* call-background-blur.js — Virtual background blur for video calls
 * Uses MediaPipe Selfie Segmentation (loaded on demand from CDN).
 * Graceful fallback: if the CDN/model cannot be loaded, we disable blur
 * and notify the user instead of breaking the call.
 */
(function () {
  'use strict';

  var CC = window._CC;

  var _active = false;
  var _loading = false;
  var _loadError = false;
  var _segmenter = null;
  var _videoEl = null;
  var _canvas = null;
  var _ctx = null;
  var _canvasStream = null;
  var _processedTrack = null;
  var _origTrack = null;
  var _origSender = null;
  var _rafId = null;
  var _blurCanvas = null;
  var _personCanvas = null;

  var CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation';

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (typeof document === 'undefined') { reject(new Error('no dom')); return; }
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === '1') { resolve(); return; }
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function () { reject(new Error('script failed')); });
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.addEventListener('load', function () { s.dataset.loaded = '1'; resolve(); });
      s.addEventListener('error', function () { reject(new Error('script error')); });
      document.head.appendChild(s);
    });
  }

  async function loadSegmenter() {
    if (_segmenter) return _segmenter;
    if (_loadError) throw new Error('load failed before');
    if (_loading) {
      while (_loading) { await new Promise(function (r) { setTimeout(r, 100); }); }
      if (_segmenter) return _segmenter;
      throw new Error('load failed while waiting');
    }
    _loading = true;
    try {
      await loadScript(CDN_BASE + '/selfie_segmentation.js');
      if (typeof SelfieSegmentation === 'undefined') throw new Error('SelfieSegmentation global missing');
      var seg = new SelfieSegmentation({ locateFile: function (file) { return CDN_BASE + '/' + file; } });
      seg.setOptions({ modelSelection: 1 });
      _segmenter = seg;
      return seg;
    } catch (err) {
      _loadError = true;
      if (window.__DEBUG__) console.warn('[blur] MediaPipe load failed:', err);
      throw err;
    } finally {
      _loading = false;
    }
  }

  function drawFrame(results) {
    if (!_ctx || !_videoEl) return;
    var vw = _videoEl.videoWidth || 1280;
    var vh = _videoEl.videoHeight || 720;
    if (_canvas.width !== vw) _canvas.width = vw;
    if (_canvas.height !== vh) _canvas.height = vh;
    if (_blurCanvas.width !== vw) { _blurCanvas.width = vw; _blurCanvas.height = vh; }
    if (_personCanvas.width !== vw) { _personCanvas.width = vw; _personCanvas.height = vh; }

    var bctx = _blurCanvas.getContext('2d');
    var pctx = _personCanvas.getContext('2d');

    // 1) Blurred full frame
    bctx.save();
    bctx.filter = 'blur(18px)';
    bctx.drawImage(results.image, 0, 0, vw, vh);
    bctx.restore();

    // 2) Person cutout using the segmentation mask
    pctx.clearRect(0, 0, vw, vh);
    pctx.drawImage(results.segmentationMask, 0, 0, vw, vh);
    pctx.globalCompositeOperation = 'source-in';
    pctx.drawImage(results.image, 0, 0, vw, vh);
    pctx.globalCompositeOperation = 'source-over';

    // 3) Composite
    _ctx.clearRect(0, 0, vw, vh);
    _ctx.drawImage(_blurCanvas, 0, 0, vw, vh);
    _ctx.drawImage(_personCanvas, 0, 0, vw, vh);
  }

  function startLoop() {
    stopLoop();
    var loop = function () {
      if (!_active || !_segmenter || !_videoEl) return;
      _rafId = requestAnimationFrame(loop);
      try {
        _segmenter.send({ image: _videoEl }).then(function (results) {
          if (_active) drawFrame(results);
        }).catch(function () {});
      } catch (_) {}
    };
    _rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  }

  function isVideoCall() {
    if (CC && CC.callType === 'video') return true;
    if (window._GC && window._GC._currentCallType === 'video') return true;
    return false;
  }

  function localVideoEl() {
    return (CC && CC.$) ? CC.$('local-video') : document.getElementById('local-video');
  }

  async function toggleBackgroundBlur() {
    if (!CC || !CC.getLocalStream) { return; }
    if (_active) { stopBackgroundBlur(); return; }
    if (!CC.getLocalStream() || !isVideoCall()) {
      if (typeof showToast === 'function') showToast('Background blur works in video calls', 'info');
      return;
    }
    if (CC.isScreenSharing()) {
      if (typeof showToast === 'function') showToast('Stop screen sharing to use background blur', 'info');
      return;
    }
    var videoTrack = CC.getLocalStream().getVideoTracks()[0];
    if (!videoTrack) {
      if (typeof showToast === 'function') showToast('No camera available', 'info');
      return;
    }
    try {
      await loadSegmenter();
    } catch (_) {
      if (typeof showToast === 'function') showToast('Background blur is not available on this device/network', 'error');
      return;
    }

    try {
      var sender = CC.getPeerConnection() && CC.getPeerConnection().getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
      if (!sender) { if (typeof showToast === 'function') showToast('Video is not active yet', 'info'); return; }

      _origTrack = videoTrack;
      _origSender = sender;

      _videoEl = localVideoEl();
      if (!_videoEl) { if (typeof showToast === 'function') showToast('Could not initialize blur', 'error'); return; }

      _canvas = document.createElement('canvas');
      _ctx = _canvas.getContext('2d');
      _blurCanvas = document.createElement('canvas');
      _personCanvas = document.createElement('canvas');

      _canvasStream = _canvas.captureStream(24);
      _processedTrack = _canvasStream.getVideoTracks()[0];
      _processedTrack.enabled = true;

      _active = true;
      await sender.replaceTrack(_processedTrack).catch(function () {});

      var lv = CC.$('local-video');
      if (lv) lv.srcObject = _canvasStream;

      startLoop();
      var btn = CC.$('btn-blur');
      if (btn) { btn.classList.add('bg-primary/40'); btn.setAttribute('aria-pressed', 'true'); }
      if (typeof showToast === 'function') showToast('Background blur enabled', 'success');    } catch (err) {
      if (window.__DEBUG__) console.warn('[blur] enable error:', err);
      stopBackgroundBlur();
      if (typeof showToast === 'function') showToast('Could not enable background blur', 'error');
    }
  }

  function stopBackgroundBlur() {
    var wasActive = _active;
    _active = false;
    stopLoop();
    if (_segmenter) {
      try { _segmenter.close(); } catch (_) {}
      _segmenter = null;
    }
    if (_processedTrack) {
      _processedTrack.stop();
      _processedTrack = null;
    }
    if (_canvasStream) { _canvasStream = null; }
    if (_origSender && _origTrack) {
      try { _origSender.replaceTrack(_origTrack).catch(function () {}); } catch (_) {}
    }
    if (_videoEl && wasActive && CC.getLocalStream()) {
      var lv = CC.$('local-video');
      if (lv) lv.srcObject = CC.getLocalStream();
    }
    _origSender = null;
    _origTrack = null;
    _videoEl = null;
    _canvas = null;
    _ctx = null;
    _blurCanvas = null;
    _personCanvas = null;
    var btn = CC.$('btn-blur');
    if (btn) { btn.classList.remove('bg-primary/40'); btn.setAttribute('aria-pressed', 'false'); }
  }

  window.toggleBackgroundBlur = toggleBackgroundBlur;
  window.stopBackgroundBlur = stopBackgroundBlur;

})();
