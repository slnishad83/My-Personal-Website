/**
 * NSL Chat — Lazy Image Loading
 * IntersectionObserver-based lazy loading with blur-up, compression, memory mgmt
 */
(function () {
  'use strict';

  var ROOT_MARGIN = '200px';
  var FAR_THRESHOLD = 2000;
  var MAX_RETRIES = 3;
  var CROSSFADE_MS = 300;

  var observer = null;
  var retryMap = new WeakMap();
  var loadedSet = new WeakSet();
  var memoryObserver = null;

  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  /* ── Tiny base64 placeholder (8x8 grey) ── */
  var TINY_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">' +
    '<rect width="8" height="8" fill="' + (isDark() ? '#2a2a3d' : '#e0e0e0') + '"/>' +
    '</svg>'
  );

  /* ── IntersectionObserver setup ── */
  function getObserver() {
    if (observer) return observer;
    observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.isIntersecting) {
          loadSingleImage(entry.target);
        }
      }
    }, { rootMargin: ROOT_MARGIN, threshold: 0.01 });
    return observer;
  }

  /* ── Load a single image ── */
  function loadSingleImage(img) {
    if (!img || !img.dataset || !img.dataset.src) return;
    if (loadedSet.has(img)) return;

    var src = img.dataset.src;
    if (!src) return;

    img.classList.add('lazy-loading');
    img.style.transition = 'opacity ' + CROSSFADE_MS + 'ms ease';
    img.style.opacity = '0';

    var tempImg = new Image();
    tempImg.onload = function () {
      img.src = src;
      img.style.opacity = '1';
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-loaded');
      delete img.dataset.src;
      loadedSet.add(img);
      removeRetryOverlay(img);
    };
    tempImg.onerror = function () {
      handleImageError(img, src);
    };
    tempImg.src = src;
  }

  /* ── Error handling with retry ── */
  function handleImageError(img, src) {
    var attempts = retryMap.get(img) || 0;
    attempts++;
    retryMap.set(img, attempts);

    if (attempts >= MAX_RETRIES) {
      img.style.opacity = '1';
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-failed');
      showRetryOverlay(img, true);
      return;
    }

    showRetryOverlay(img, false);

    img.onclick = function () {
      retryMap.set(img, 0);
      removeRetryOverlay(img);
      var tempImg = new Image();
      tempImg.onload = function () {
        img.src = src;
        img.style.opacity = '1';
        img.classList.remove('lazy-loading');
        img.classList.add('lazy-loaded');
        delete img.dataset.src;
        loadedSet.add(img);
        removeRetryOverlay(img);
      };
      tempImg.onerror = function () {
        handleImageError(img, src);
      };
      tempImg.src = src;
    };
  }

  function showRetryOverlay(img, isFinal) {
    removeRetryOverlay(img);
    var overlay = document.createElement('div');
    overlay.className = 'lazy-retry-overlay';
    overlay.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'background:' + (isDark() ? 'rgba(30,30,45,0.9)' : 'rgba(240,240,240,0.9)') + ';border-radius:8px;cursor:pointer;z-index:10;';

    var icon = document.createElement('span');
    icon.style.cssText = 'font-size:28px;color:' + (isDark() ? '#e1e1ef' : '#333') + ';user-select:none;';
    icon.textContent = isFinal ? '\u26A0' : '\u21BB';

    var label = document.createElement('span');
    label.style.cssText = 'font-size:11px;margin-top:4px;color:' + (isDark() ? '#918fa0' : '#666') + ';';
    label.textContent = isFinal ? 'Failed to load' : 'Tap to retry';

    overlay.appendChild(icon);
    overlay.appendChild(label);

    var parent = img.parentElement;
    if (parent) {
      parent.style.position = parent.style.position || 'relative';
      parent.appendChild(overlay);
    }
  }

  function removeRetryOverlay(img) {
    var parent = img.parentElement;
    if (!parent) return;
    var overlay = parent.querySelector('.lazy-retry-overlay');
    if (overlay) overlay.remove();
  }

  /* ── Observe a specific image ── */
  function observeImage(img) {
    if (!img || loadedSet.has(img)) return;
    if (!img.dataset.src && img.src) {
      img.dataset.src = img.src;
    }
    img.src = TINY_PLACEHOLDER;
    img.style.filter = 'blur(20px)';
    img.style.transform = 'scale(1.05)';
    img.setAttribute('loading', 'lazy');
    getObserver().observe(img);
  }

  /* ── Preload images near a container ── */
  function preloadNearbyImages(container) {
    if (!container) return;
    var imgs = container.querySelectorAll('img[data-src]');
    for (var i = 0; i < imgs.length; i++) {
      var rect = imgs[i].getBoundingClientRect();
      if (rect.top < window.innerHeight + FAR_THRESHOLD && rect.bottom > -FAR_THRESHOLD) {
        loadSingleImage(imgs[i]);
      }
    }
  }

  /* ── Image compression before upload ── */
  function compressImage(file, maxWidth, quality) {
    maxWidth = maxWidth || 1920;
    quality = quality || 0.8;

    return new Promise(function (resolve, _reject) {
      if (!file || !file.type || !file.type.startsWith('image/')) {
        resolve(file);
        return;
      }

      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var w = img.width;
          var h = img.height;
          if (w > maxWidth) {
            h = Math.round((h / w) * maxWidth);
            w = maxWidth;
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(function (blob) {
            var origSize = file.size;
            var newSize = blob.size;
            var ratio = ((1 - newSize / origSize) * 100).toFixed(0);
            if (ratio > 0) {
              var origMB = (origSize / 1048576).toFixed(1);
              var newKB = (newSize / 1024).toFixed(0);
              showCompressionToast('Compressed from ' + origMB + 'MB to ' + newKB + 'KB (' + ratio + '% smaller)');
            }
            var result = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
            resolve(result);
          }, 'image/jpeg', quality);
        };
        img.onerror = function () { resolve(file); };
        img.src = e.target.result;
      };
      reader.onerror = function () { resolve(file); };
      reader.readAsDataURL(file);
    });
  }

  function showCompressionToast(msg) {
    if (typeof showToast === 'function') {
      showToast(msg, 'info');
    }
  }

  /* ── Memory management: remove far-away images ── */
  function startMemoryManagement() {
    if (memoryObserver) return;
    memoryObserver = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var img = entry.target;
        if (entry.isIntersecting) return;
        var rect = img.getBoundingClientRect();
        var dist = Math.min(
          Math.abs(rect.top - window.innerHeight),
          Math.abs(rect.bottom)
        );
        if (dist > FAR_THRESHOLD && img.src && !img.dataset.src) {
          img.dataset.src = img.src;
          img.src = TINY_PLACEHOLDER;
          img.classList.remove('lazy-loaded');
          loadedSet.delete(img);
        }
      }
    }, { rootMargin: (FAR_THRESHOLD + 200) + 'px', threshold: 0 });
  }

  /* ── Apply blur-up placeholder styling ── */
  function applyPlaceholder(img) {
    if (!img.style) return;
    img.style.transition = 'opacity ' + CROSSFADE_MS + 'ms ease, filter ' + CROSSFADE_MS + 'ms ease';

    var origOnload = img.onload;
    img.onload = function () {
      img.style.filter = 'none';
      img.style.transform = 'none';
      if (origOnload) origOnload.call(img);
    };
  }

  /* ── MutationObserver for #messages-wrap ── */
  var mutObs = null;
  function startMutationObserver() {
    if (mutObs) return;
    var target = document.getElementById('messages-wrap');
    if (!target) return;

    mutObs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var nodes = mutations[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          if (node.nodeType !== 1) continue;
          if (node.tagName === 'IMG' && node.dataset && !loadedSet.has(node)) {
            observeImage(node);
            applyPlaceholder(node);
            if (memoryObserver) memoryObserver.observe(node);
          }
          var imgs = node.querySelectorAll ? node.querySelectorAll('img') : [];
          for (var k = 0; k < imgs.length; k++) {
            if (!loadedSet.has(imgs[k])) {
              observeImage(imgs[k]);
              applyPlaceholder(imgs[k]);
              if (memoryObserver) memoryObserver.observe(imgs[k]);
            }
          }
        }
      }
    });
    mutObs.observe(target, { childList: true, subtree: true });
  }

  /* ── Main init ── */
  function initLazyImages() {
    var allImgs = document.querySelectorAll('img');
    for (var i = 0; i < allImgs.length; i++) {
      var img = allImgs[i];
      if (img.dataset.src || (img.src && !img.complete)) {
        observeImage(img);
        applyPlaceholder(img);
      }
    }
    startMemoryManagement();
    startMutationObserver();

    if (!_scrollBound) {
      window.addEventListener('scroll', _onScrollLazy, { passive: true, capture: false });
      _scrollBound = true;
    }
  }

  var _scrollBound = false;
  function _onScrollLazy() {
    preloadNearbyImages(document.getElementById('messages-wrap'));
  }

  /* ── Expose on window ── */
  window.initLazyImages = initLazyImages;
  window.observeImage = observeImage;
  window.preloadNearbyImages = preloadNearbyImages;
  window.compressImage = compressImage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLazyImages);
  } else {
    initLazyImages();
  }
})();
