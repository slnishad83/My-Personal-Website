/* ============================================================
   Desktop Fullscreen & PiP (D-C2 / D-C3) v1.1
   Adds actual fullscreen toggle and picture-in-picture support
   for media viewer, video calls, and image viewer.
   ── v1.1: MutationBus + named handlers + destroy()
   ============================================================ */
(function () {
  'use strict';

  var _cleanupFns = [];
  var _observers = [];
  function _trackCleanup(fn) { _cleanupFns.push(fn); }

  /* --- Fullscreen (D-C2) --- */

  function isFullscreenSupported() {
    return !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled
    );
  }

  function requestFullscreen(el) {
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
    if (el.msRequestFullscreen) return el.msRequestFullscreen();
    return Promise.reject(new Error('Fullscreen not supported'));
  }

  function exitFullscreen() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
    return Promise.resolve();
  }

  function isCurrentlyFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function toggleFullscreen(el) {
    if (!isFullscreenSupported()) {
      if (typeof showToast === 'function') showToast('Fullscreen not supported in this browser', 'error');
      return;
    }
    if (isCurrentlyFullscreen()) {
      exitFullscreen();
    } else {
      const target = el || document.querySelector('#media-viewer') ||
                     document.querySelector('#video-player-wrap') ||
                     document.querySelector('#call-screen') ||
                     document.querySelector('#chat-area') ||
                     document.documentElement;
      requestFullscreen(target).catch(() => {
        if (typeof showToast === 'function') showToast('Could not enter fullscreen', 'error');
      });
    }
  }

  /* --- Picture-in-Picture (D-C3) --- */

  function isPiPSupported() {
    return typeof document.pictureInPictureEnabled !== 'undefined' && document.pictureInPictureEnabled;
  }

  function requestPiP(videoEl) {
    if (!isPiPSupported()) {
      if (typeof showToast === 'function') showToast('Picture-in-Picture not supported', 'error');
      return Promise.reject(new Error('PiP not supported'));
    }
    if (!videoEl || videoEl.tagName !== 'VIDEO') {
      if (typeof showToast === 'function') showToast('No video element found', 'error');
      return Promise.reject(new Error('No video element'));
    }
    return videoEl.requestPictureInPicture().catch(err => {
      if (typeof showToast === 'function') showToast('Could not enter PiP mode', 'error');
      return Promise.reject(err);
    });
  }

  function exitPiP() {
    if (document.pictureInPictureElement) {
      return document.pictureInPictureElement.exitPictureInPicture();
    }
    return Promise.resolve();
  }

  /* --- Hook into UI elements --- */

  function addFullscreenButtons() {
    const mediaViewer = document.querySelector('#media-viewer');
    if (mediaViewer && !mediaViewer.querySelector('.fs-toggle-btn')) {
      const btn = document.createElement('button');
      btn.className = 'fs-toggle-btn';
      btn.setAttribute('aria-label', 'Toggle fullscreen');
      btn.setAttribute('title', 'Fullscreen (F11)');
      btn.innerHTML = '⛶';
      btn.style.cssText = 'position:absolute;top:12px;right:48px;z-index:10010;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
      function _onFSClick() { toggleFullscreen(mediaViewer); }
      btn.addEventListener('click', _onFSClick);
      _trackCleanup(function () { btn.removeEventListener('click', _onFSClick); });
      mediaViewer.appendChild(btn);
    }

    const videoPlayer = document.querySelector('#video-player-wrap, #media-viewer video');
    if (videoPlayer && isPiPSupported()) {
      const videoEl = videoPlayer.tagName === 'VIDEO' ? videoPlayer : videoPlayer.querySelector('video');
      if (videoEl && !videoPlayer.querySelector('.pip-toggle-btn')) {
        const btn = document.createElement('button');
        btn.className = 'pip-toggle-btn';
        btn.setAttribute('aria-label', 'Picture in Picture');
        btn.setAttribute('title', 'Picture in Picture');
        btn.innerHTML = '⧉';
        btn.style.cssText = 'position:absolute;bottom:48px;right:12px;z-index:10010;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
        function _onPiPClick() {
          if (document.pictureInPictureElement) exitPiP();
          else requestPiP(videoEl);
        }
        btn.addEventListener('click', _onPiPClick);
        _trackCleanup(function () { btn.removeEventListener('click', _onPiPClick); });
        videoPlayer.appendChild(btn);
      }
    }
  }

  /* --- Fullscreen change indicator for body class --- */

  function watchFullscreenChange() {
    function onFSChange() {
      document.body.classList.toggle('is-fullscreen', isCurrentlyFullscreen());
    }
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    document.addEventListener('mozfullscreenchange', onFSChange);
    document.addEventListener('MSFullscreenChange', onFSChange);
    _trackCleanup(function () {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
      document.removeEventListener('mozfullscreenchange', onFSChange);
      document.removeEventListener('MSFullscreenChange', onFSChange);
    });
  }

  /* --- Init --- */

  function init() {
    addFullscreenButtons();
    watchFullscreenChange();

    window.NSLDesktop = window.NSLDesktop || {};
    window.NSLDesktop.toggleFullscreen = toggleFullscreen;
    window.NSLDesktop.requestPiP = requestPiP;
    window.NSLDesktop.exitPiP = exitPiP;
    window.NSLDesktop.isFullscreenSupported = isFullscreenSupported;
    window.NSLDesktop.isPiPSupported = isPiPSupported;

    if (window.MutationBus) {
      MutationBus.onBodyChildList('df:media-btns', function () {
        requestAnimationFrame(addFullscreenButtons);
      });
    } else if (typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(function () {
        requestAnimationFrame(addFullscreenButtons);
      });
      obs.observe(document.body, { childList: true, subtree: true });
      _observers.push(obs);
    }
  }

  /* --- destroy --- */
  function destroy() {
    if (window.MutationBus) MutationBus.off('df:media-btns');
    _observers.forEach(function (o) { try { o.disconnect(); } catch (e) {} });
    _observers = [];
    _cleanupFns.forEach(function (fn) { try { fn(); } catch (e) {} });
    _cleanupFns = [];
    document.body.classList.remove('is-fullscreen');
  }

  window.NSLDesktop = window.NSLDesktop || {};
  window.NSLDesktop.destroy = destroy;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
