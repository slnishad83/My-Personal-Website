(function() {
  'use strict';

  var _retryTimers = {};
  var _retryCounts = {};
  var MAX_AUTO_RETRIES = 3;

  var STATUS_ICONS = {
    sending: '<span class="msg-status-icon material-symbols-outlined text-[14px] text-on-surface-variant" style="animation:syncRotate 2s infinite linear;display:inline-block;font-variation-settings:\'FILL\' 1;">schedule</span>',
    sent: '<span class="msg-status-icon material-symbols-outlined text-[14px] text-on-surface-variant" style="font-variation-settings:\'FILL\' 1;">done</span>',
    delivered: '<span class="msg-status-icon material-symbols-outlined text-[14px] text-on-surface-variant" style="font-variation-settings:\'FILL\' 1;">done_all</span>',
    read: '<span class="msg-status-icon material-symbols-outlined text-[14px] text-primary" style="font-variation-settings:\'FILL\' 1;">done_all</span>',
    failed: '<span class="msg-status-icon material-symbols-outlined text-[14px] text-error" role="img" aria-label="Failed to send" style="cursor:pointer;" title="Tap to retry sending">error</span>'
  };

  function _findMsgEl(messageId) {
    return document.querySelector(
      '.message[data-message-id="' + messageId + '"], ' +
      '.message[data-msg-id="' + messageId + '"]'
    );
  }

  function _findStatusEl(msgEl) {
    if (!msgEl) return null;
    return msgEl.querySelector('.msg-status, .message-status, [class*="status-icon"]');
  }

  function _getIsMyMessage(msgEl) {
    if (!msgEl) return false;
    return msgEl.classList.contains('my-message') || msgEl.classList.contains('msg-out');
  }

  function _addStyles() {
    if (document.getElementById('msg-error-styles')) return;
    var style = document.createElement('style');
    style.id = 'msg-error-styles';
    style.textContent =
      '@keyframes msgErrorFadeIn{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}' +
      '@keyframes msgProgressSlide{from{width:0}to{width:var(--progress)}}' +
      '@keyframes msgSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
      '.msg-error-indicator{position:absolute;right:-28px;top:50%;transform:translateY(-50%);' +
        'animation:msgErrorFadeIn 0.2s ease-out;cursor:pointer;z-index:2;}' +
      '.msg-error-indicator .material-symbols-outlined{font-size:20px;color:var(--error,#ba1a1a);}' +
      '.msg-upload-bar{position:relative;width:100%;height:3px;background:var(--surface-variant);' +
        'border-radius:2px;overflow:hidden;margin-top:4px;transition:opacity 0.2s;}' +
      '.msg-upload-bar-fill{height:100%;background:var(--primary,#00a884);border-radius:2px;' +
        'transition:width 0.3s ease-out;width:var(--progress,0%);}' +
      '.msg-upload-cancel{position:absolute;right:-4px;top:50%;transform:translateY(-50%);' +
        'width:18px;height:18px;border-radius:50%;background:var(--surface-variant);' +
        'display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;' +
        'color:var(--on-surface-variant);font-size:12px;line-height:1;padding:0;}' +
      '.msg-media-error{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'min-height:120px;background:var(--surface-variant);border-radius:8px;color:var(--on-surface-variant);' +
        'gap:8px;padding:16px;text-align:center;}' +
      '.msg-media-error .material-symbols-outlined{font-size:32px;opacity:0.5;}' +
      '.msg-media-error-text{font-size:12px;opacity:0.7;}' +
      '.msg-media-error-retry{font-size:12px;color:var(--primary);cursor:pointer;background:none;' +
        'border:none;padding:4px 8px;border-radius:4px;font-weight:600;}' +
      '.msg-media-error-retry:hover{background:var(--primary-container);}' +
      '.msg-network-banner{background:var(--error,#ba1a1a);color:white;padding:6px 12px;' +
        'border-radius:8px 8px 0 0;font-size:12px;text-align:center;width:100%;font-weight:500;}' +
      '.msg-file-upload{display:flex;align-items:center;gap:8px;padding:8px;' +
        'background:var(--surface-container);border-radius:8px;margin-top:4px;}' +
      '.msg-file-upload-icon{width:32px;height:32px;border-radius:8px;background:var(--surface-variant);' +
        'display:flex;align-items:center;justify-content:center;flex-shrink:0;}' +
      '.msg-file-upload-icon .material-symbols-outlined{font-size:18px;color:var(--on-surface-variant);}' +
      '.msg-file-upload-info{flex:1;min-width:0;}' +
      '.msg-file-upload-name{font-size:13px;font-weight:500;color:var(--on-surface);white-space:nowrap;' +
        'overflow:hidden;text-overflow:ellipsis;}' +
      '.msg-file-upload-detail{font-size:11px;color:var(--on-surface-variant);margin-top:2px;}' +
      '.msg-file-upload-actions{display:flex;gap:4px;flex-shrink:0;}' +
      '.msg-file-spin{animation:msgSpin 1s linear infinite;display:inline-block;}' +
      '.msg-retry-tooltip{position:absolute;bottom:calc(100% + 4px);right:0;background:var(--surface-container-highest);' +
        'color:var(--on-surface);padding:4px 8px;border-radius:6px;font-size:11px;white-space:nowrap;' +
        'pointer-events:none;opacity:0;transition:opacity 0.15s;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,0.2);}' +
      '.msg-error-indicator:hover .msg-retry-tooltip{opacity:1;}' +
      '[data-reduced-motion="true"] .msg-error-indicator,[data-reduced-motion="true"] .msg-upload-bar-fill,' +
        '[data-reduced-motion="true"] .msg-status-icon{animation:none !important;transition:none !important;}';
    document.head.appendChild(style);
  }

  function showMessageError(messageId, errorType) {
    _addStyles();
    var msgEl = _findMsgEl(messageId);
    if (!msgEl) return;

    msgEl.classList.add('msg-has-error');
    msgEl.setAttribute('data-error-type', errorType || 'send-failure');

    var existing = msgEl.querySelector('.msg-error-indicator');
    if (existing) existing.remove();

    var indicator = document.createElement('div');
    indicator.className = 'msg-error-indicator';
    indicator.setAttribute('role', 'alert');
    indicator.setAttribute('aria-label', 'Message failed to send. Tap to retry.');
    indicator.setAttribute('tabindex', '0');

    indicator.innerHTML =
      '<span class="material-symbols-outlined">error</span>' +
      '<span class="msg-retry-tooltip">Tap to retry sending</span>';

    indicator.addEventListener('click', function() {
      if (typeof window.retrySendMessage === 'function') {
        window.retrySendMessage(messageId);
      }
    });
    indicator.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        indicator.click();
      }
    });

    if (_getIsMyMessage(msgEl)) {
      var bubble = msgEl.querySelector('.message-bubble');
      if (bubble) {
        bubble.style.position = 'relative';
        bubble.appendChild(indicator);
      } else {
        msgEl.appendChild(indicator);
      }
    } else {
      msgEl.appendChild(indicator);
    }

    var statusEl = _findStatusEl(msgEl);
    if (statusEl) {
      statusEl.innerHTML = STATUS_ICONS.failed;
    }
  }

  function clearMessageError(messageId) {
    var msgEl = _findMsgEl(messageId);
    if (!msgEl) return;

    msgEl.classList.remove('msg-has-error');
    msgEl.removeAttribute('data-error-type');

    var indicator = msgEl.querySelector('.msg-error-indicator');
    if (indicator) indicator.remove();

    var networkBanner = msgEl.querySelector('.msg-network-banner');
    if (networkBanner) networkBanner.remove();
  }

  function showRetryButton(messageId, retryFn) {
    _addStyles();
    var msgEl = _findMsgEl(messageId);
    if (!msgEl) return;

    showMessageError(messageId, 'send-failure');

    var indicator = msgEl.querySelector('.msg-error-indicator');
    if (indicator && retryFn) {
      indicator.onclick = function() {
        clearMessageError(messageId);
        showSendingStatus(messageId);
        retryFn();
      };
    }
  }

  function showSendingStatus(messageId) {
    var msgEl = _findMsgEl(messageId);
    if (!msgEl) return;

    clearMessageError(messageId);

    var statusEl = _findStatusEl(msgEl);
    if (statusEl) {
      statusEl.innerHTML = STATUS_ICONS.sending;
    }
  }

  function updateMessageStatus(messageId, status) {
    var msgEl = _findMsgEl(messageId);
    if (!msgEl) return;

    var statusEl = _findStatusEl(msgEl);
    if (statusEl && STATUS_ICONS[status]) {
      statusEl.innerHTML = STATUS_ICONS[status];
    }

    if (status === 'sent' || status === 'delivered' || status === 'read') {
      clearAutoRetry(messageId);
      clearMessageError(messageId);
    }
  }

  function showUploadProgress(messageId, progress) {
    _addStyles();
    var msgEl = _findMsgEl(messageId);
    if (!msgEl) return;

    var existing = msgEl.querySelector('.msg-upload-bar');
    if (!existing) {
      var bar = document.createElement('div');
      bar.className = 'msg-upload-bar';
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuenow', String(Math.round(progress)));
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-label', 'Upload progress');

      var fill = document.createElement('div');
      fill.className = 'msg-upload-bar-fill';
      fill.style.setProperty('--progress', progress + '%');
      bar.appendChild(fill);

      var cancel = document.createElement('button');
      cancel.className = 'msg-upload-cancel';
      cancel.setAttribute('aria-label', 'Cancel upload');
      cancel.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px;">close</span>';
      cancel.addEventListener('click', function(e) {
        e.stopPropagation();
        hideUploadProgress(messageId);
        if (typeof window.cancelUpload === 'function') {
          window.cancelUpload(messageId);
        }
      });
      bar.appendChild(cancel);

      var bubble = msgEl.querySelector('.message-bubble');
      if (bubble) {
        bubble.appendChild(bar);
      } else {
        msgEl.appendChild(bar);
      }
    } else {
      var fillEl = existing.querySelector('.msg-upload-bar-fill');
      if (fillEl) {
        fillEl.style.setProperty('--progress', progress + '%');
      }
      existing.setAttribute('aria-valuenow', String(Math.round(progress)));
    }
  }

  function hideUploadProgress(messageId) {
    var msgEl = _findMsgEl(messageId);
    if (!msgEl) return;

    var bar = msgEl.querySelector('.msg-upload-bar');
    if (bar) bar.remove();
  }

  function showMediaLoadError(container) {
    _addStyles();
    if (!container) return;

    container.classList.add('msg-media-error-container');

    var existing = container.querySelector('.msg-media-error');
    if (existing) return;

    var url = container.getAttribute('data-src') || container.getAttribute('src') || '';
    var errorEl = document.createElement('div');
    errorEl.className = 'msg-media-error';
    errorEl.setAttribute('role', 'img');
    errorEl.setAttribute('aria-label', 'Failed to load media');

    errorEl.innerHTML =
      '<span class="material-symbols-outlined">broken_image</span>' +
      '<span class="msg-media-error-text">Failed to load</span>' +
      '<button class="msg-media-error-retry" aria-label="Tap to retry loading media">Tap to retry</button>';

    var retryBtn = errorEl.querySelector('.msg-media-error-retry');
    retryBtn.addEventListener('click', function() {
      retryMediaLoad(container, url);
    });

    var origDisplay = container.style.display;
    container.setAttribute('data-orig-display', origDisplay || '');
    container.style.display = 'none';
    container.parentNode.insertBefore(errorEl, container.nextSibling);
  }

  function retryMediaLoad(container, url) {
    if (!container || !url) return;

    var errorEl = container.nextElementSibling;
    if (errorEl && errorEl.classList.contains('msg-media-error')) {
      errorEl.remove();
    }

    container.style.display = container.getAttribute('data-orig-display') || '';
    container.removeAttribute('data-orig-display');

    var loadingClass = 'msg-media-loading';
    container.classList.add(loadingClass);

    var newImg = new Image();
    newImg.onload = function() {
      container.classList.remove(loadingClass);
      if (container.tagName === 'IMG') {
        container.src = url;
      } else {
        container.style.backgroundImage = 'url(' + url + ')';
      }
    };
    newImg.onerror = function() {
      container.classList.remove(loadingClass);
      showMediaLoadError(container);
    };
    newImg.src = url;
  }

  function showFileUploadStatus(fileId, status, progress) {
    _addStyles();
    var fileEl = document.querySelector('[data-file-id="' + fileId + '"]');
    if (!fileEl) return;

    var iconEl = fileEl.querySelector('.msg-file-upload-icon .material-symbols-outlined, .file-upload-icon');
    var detailEl = fileEl.querySelector('.msg-file-upload-detail, .file-upload-detail');
    var actionsEl = fileEl.querySelector('.msg-file-upload-actions, .file-upload-actions');

    if (!fileEl.classList.contains('msg-file-upload')) {
      fileEl.classList.add('msg-file-upload');
    }

    switch (status) {
      case 'uploading':
        if (iconEl) {
          iconEl.textContent = 'cloud_upload';
          iconEl.classList.add('msg-file-spin');
        }
        if (detailEl) {
          detailEl.textContent = (progress || 0) + '%';
        }
        var uploadBar = fileEl.querySelector('.msg-upload-bar');
        if (!uploadBar) {
          uploadBar = document.createElement('div');
          uploadBar.className = 'msg-upload-bar';
          uploadBar.style.marginTop = '0';
          uploadBar.innerHTML = '<div class="msg-upload-bar-fill" style="--progress:' + (progress || 0) + '%"></div>';
          fileEl.appendChild(uploadBar);
        } else {
          var fill = uploadBar.querySelector('.msg-upload-bar-fill');
          if (fill) fill.style.setProperty('--progress', (progress || 0) + '%');
        }
        break;

      case 'complete':
        if (iconEl) {
          iconEl.textContent = 'check_circle';
          iconEl.classList.remove('msg-file-spin');
          iconEl.style.color = 'var(--primary)';
        }
        if (detailEl) detailEl.textContent = 'Uploaded';
        var completedBar = fileEl.querySelector('.msg-upload-bar');
        if (completedBar) completedBar.remove();
        if (actionsEl) actionsEl.innerHTML = '';
        break;

      case 'failed':
        if (iconEl) {
          iconEl.textContent = 'error';
          iconEl.classList.remove('msg-file-spin');
          iconEl.style.color = 'var(--error)';
        }
        if (detailEl) detailEl.textContent = 'Upload failed';
        var failedBar = fileEl.querySelector('.msg-upload-bar');
        if (failedBar) failedBar.remove();
        if (actionsEl) {
          actionsEl.innerHTML = '<button class="msg-media-error-retry" aria-label="Retry upload" style="font-size:12px;">Retry</button>';
          var retryBtn = actionsEl.querySelector('.msg-media-error-retry');
          retryBtn.addEventListener('click', function() {
            if (typeof window.retryFileUpload === 'function') {
              window.retryFileUpload(fileId);
            }
          });
        }
        break;
    }
  }

  function showNetworkErrorBanner(messageId) {
    _addStyles();
    var msgEl = _findMsgEl(messageId);
    if (!msgEl) return;

    var existing = msgEl.querySelector('.msg-network-banner');
    if (existing) return;

    var banner = document.createElement('div');
    banner.className = 'msg-network-banner';
    banner.setAttribute('role', 'alert');
    banner.textContent = 'No connection. Messages will be sent when you\u2019re back online.';

    var bubble = msgEl.querySelector('.message-bubble');
    if (bubble) {
      bubble.insertBefore(banner, bubble.firstChild);
    } else {
      msgEl.insertBefore(banner, msgEl.firstChild);
    }
  }

  function hideNetworkErrorBanner(messageId) {
    var msgEl = _findMsgEl(messageId);
    if (!msgEl) return;

    var banner = msgEl.querySelector('.msg-network-banner');
    if (banner) banner.remove();
  }

  function _setupAutoRetry(messageId, retryFn) {
    if (_retryCounts[messageId] === undefined) _retryCounts[messageId] = 0;
    if (_retryCounts[messageId] >= MAX_AUTO_RETRIES) {
      showMessageError(messageId, 'send-failure');
      return;
    }

    var delay = Math.pow(2, _retryCounts[messageId]) * 1000;
    _retryCounts[messageId]++;

    _retryTimers[messageId] = setTimeout(function() {
      showSendingStatus(messageId);
      retryFn();
    }, delay);
  }

  function clearAutoRetry(messageId) {
    if (_retryTimers[messageId]) {
      clearTimeout(_retryTimers[messageId]);
      delete _retryTimers[messageId];
    }
    delete _retryCounts[messageId];
  }

  function _setupReducedMotion() {
    if (!window.matchMedia) return;
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    function apply(reduced) {
      document.documentElement.setAttribute('data-reduced-motion', String(reduced.matches));
    }
    apply(mq);
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  }

  _setupReducedMotion();

  window.showMessageError = showMessageError;
  window.clearMessageError = clearMessageError;
  window.showRetryButton = showRetryButton;
  window.showUploadProgress = showUploadProgress;
  window.hideUploadProgress = hideUploadProgress;
  window.showMediaLoadError = showMediaLoadError;
  window.retryMediaLoad = retryMediaLoad;
  window.showFileUploadStatus = showFileUploadStatus;
  window.showSendingStatus = showSendingStatus;
  window.updateMessageStatus = updateMessageStatus;
  window.showNetworkErrorBanner = showNetworkErrorBanner;
  window.hideNetworkErrorBanner = hideNetworkErrorBanner;
  window.clearAutoRetry = clearAutoRetry;
})();
