/* ============================================================
   VIDEO THUMBNAIL — Generate video thumbnails with play icon
   Creates canvas-based thumbnail for video messages
   ============================================================ */
'use strict';

(function() {
  function generateThumbnail(videoUrl, maxWidth, maxHeight) {
    maxWidth = maxWidth || 300;
    maxHeight = maxHeight || 200;
    return new Promise(function(resolve) {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const timeout = setTimeout(function() {
        video.src = '';
        resolve(_playIconFallback(maxWidth, maxHeight));
      }, 5000);

      video.onloadeddata = function() {
        video.currentTime = Math.min(1, video.duration * 0.25);
      };

      video.onseeked = function() {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          let w = video.videoWidth;
          let h = video.videoHeight;
          if (w > maxWidth || h > maxHeight) {
            const ratio = Math.min(maxWidth / w, maxHeight / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, w, h);

          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(0, 0, w, h);

          const playSize = Math.min(w, h) * 0.3;
          const cx = w / 2;
          const cy = h / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, playSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(cx - playSize * 0.15, cy - playSize * 0.25);
          ctx.lineTo(cx + playSize * 0.2, cy);
          ctx.lineTo(cx - playSize * 0.15, cy + playSize * 0.25);
          ctx.closePath();
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          ctx.fill();

          canvas.toBlob(function(blob) {
            if (blob) {
              resolve(URL.createObjectURL(blob));
            } else {
              resolve(_playIconFallback(w, h));
            }
          }, 'image/jpeg', 0.7);
        } catch (e) {
          resolve(_playIconFallback(maxWidth, maxHeight));
        }
        video.src = '';
      };

      video.onerror = function() {
        clearTimeout(timeout);
        resolve(_playIconFallback(maxWidth, maxHeight));
      };

      video.src = videoUrl;
    });
  }

  function _playIconFallback(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w || 300;
    canvas.height = h || 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, w, h * 0.6);

    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.15;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.2, cy - r * 0.3);
    ctx.lineTo(cx + r * 0.3, cy);
    ctx.lineTo(cx - r * 0.2, cy + r * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    return canvas.toDataURL('image/jpeg', 0.6);
  }

  window.VideoThumbnail = { generate: generateThumbnail, generateThumbnail: generateThumbnail };
})();
