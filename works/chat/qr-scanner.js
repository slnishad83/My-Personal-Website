/**
 * QR Scanner — camera-based QR code reader with NSL Chat pairing protocol
 * Overrides the default openScanner/closeScanner to handle device pairing
 */
'use strict';
const QRScanner = (() => {
  let _stream = null;
  let _frameId = 0;
  let _overlay = null;

  function _closeScanner() {
    if (_frameId) { cancelAnimationFrame(_frameId); _frameId = 0; }
    if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
    if (_overlay) { _overlay.remove(); _overlay = null; }
  }

  async function _openScanner() {
    if (typeof PermissionsManager !== 'undefined') {
      try {
        const ok = await PermissionsManager.ensureForFeature('Take Photo');
        if (!ok) return;
      } catch (_) {}
    }

    const overlay = document.getElementById('scanner-overlay');
    const video = document.getElementById('scanner-video');
    const statusEl = document.getElementById('scanner-status');
    const resultEl = document.getElementById('scanner-result');
    if (!overlay || !video) return;

    _overlay = overlay;
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    if (statusEl) statusEl.textContent = 'Initializing camera...';
    if (resultEl) { resultEl.classList.add('hidden'); resultEl.textContent = ''; }

    try {
      _stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      video.srcObject = _stream;
      await video.play();
      if (statusEl) statusEl.textContent = 'Point camera at a QR code';
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Camera access denied. Please allow camera permission.';
      console.warn('[QRScanner] Camera error:', e);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let scanning = true;

    function scanFrame() {
      if (!scanning || !_stream) return;
      if (video.readyState < 2) { _frameId = requestAnimationFrame(scanFrame); return; }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      let _decoded = null;
      if (typeof BarcodeDetector !== 'undefined') {
        BarcodeDetector.detect(imageData).then(detections => {
          if (detections.length > 0) _handleScan(detections[0].rawValue);
        }).catch(() => {});
      } else if (typeof jsQR !== 'undefined') {
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) _handleScan(code.data);
      }

      if (scanning) _frameId = requestAnimationFrame(scanFrame);
    }

    function _handleScan(rawData) {
      scanning = false;
      if (resultEl) { resultEl.textContent = rawData; resultEl.classList.remove('hidden'); }

      let parsed = null;
      try { parsed = JSON.parse(rawData); } catch (_) {}

      if (parsed && parsed.type === 'nsl-chat-pair') {
        if (statusEl) statusEl.textContent = 'Pairing device...';
        if (typeof MultiDevice !== 'undefined') {
          MultiDevice._completePairing(parsed).then(ok => {
            if (ok) {
              if (statusEl) statusEl.innerHTML = '<span style="color:var(--primary)">✓ Device linked!</span>';
              setTimeout(_closeScanner, 2000);
            } else {
              if (statusEl) statusEl.textContent = 'Pairing failed. Try again.';
              scanning = true;
              _frameId = requestAnimationFrame(scanFrame);
            }
          });
        }
      } else if (/^https?:\/\//.test(rawData)) {
        window.open(rawData, '_blank');
        _closeScanner();
      } else {
        if (statusEl) statusEl.textContent = 'Scanned: ' + rawData;
        if (typeof showToast === 'function') showToast('Scanned: ' + rawData, 'info');
        scanning = true;
        _frameId = requestAnimationFrame(scanFrame);
      }
    }

    _frameId = requestAnimationFrame(scanFrame);
  }

  function init() {
    window.openScanner = _openScanner;
    window.closeScanner = _closeScanner;
  }

  return { init, open: _openScanner, close: _closeScanner };
})();

document.addEventListener('nsl:app-ready', () => QRScanner.init());
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => QRScanner.init(), 100);
} else {
  window.addEventListener('DOMContentLoaded', () => setTimeout(() => QRScanner.init(), 100));
}
window.QRScanner = QRScanner;
