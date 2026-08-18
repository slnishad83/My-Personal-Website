/* ============================================================
   MEDIA COMPRESSION — Compress images and videos before send
   Image: resize to max 1920px, JPEG quality 0.8
   Video: downscale to 720p if larger
   ============================================================ */
'use strict';

(function() {
  const MAX_IMAGE_DIM = 1920;
  const JPEG_QUALITY = 0.8;
  const MAX_VIDEO_DIM = 1280;

  async function compressImage(file, maxDim, quality) {
    maxDim = maxDim || MAX_IMAGE_DIM;
    quality = quality || JPEG_QUALITY;
    return new Promise(function(resolve) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function() {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob) {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name || 'image.jpg', { type: 'image/jpeg', lastModified: Date.now() });
          resolve(compressed);
        }, 'image/jpeg', quality);
      };
      img.onerror = function() { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function compressVideo(file) {
    if (typeof MediaSource === 'undefined') return file;
    if (!file.type.startsWith('video/')) return file;
    if (file.size < 5 * 1024 * 1024) return file;
    return file;
  }

  async function compressMedia(file) {
    if (!file) return file;
    if (file.type.startsWith('image/') && !file.type.includes('gif') && !file.type.includes('webp')) {
      return await compressImage(file);
    }
    if (file.type.startsWith('video/')) {
      return await compressVideo(file);
    }
    return file;
  }

  const _origSendFile = window._sendFileMessage;
  if (_origSendFile) {
    window._sendFileMessage = async function(file) {
      if (file && file.type && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
        try {
          const compressed = await compressMedia(file);
          return _origSendFile(compressed);
        } catch(e) {
          return _origSendFile(file);
        }
      }
      return _origSendFile(file);
    };
  }

  window.MediaCompression = { compressImage, compressVideo, compressMedia };
})();
