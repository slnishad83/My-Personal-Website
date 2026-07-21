(function () {
  'use strict';

  var _toasts = [];
  var _queue = [];
  var _maxVisible = 3;
  var _idCounter = 0;
  var _container = null;
  var _soundEnabled = false;

  function _getContainer() {
    if (_container && _container.parentNode) return _container;
    _container = document.getElementById('toast-container');
    if (_container) {
      _container.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:90;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:420px;width:calc(100% - 32px);';
      return _container;
    }
    _container = document.createElement('div');
    _container.id = 'toast-container';
    _container.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:90;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:420px;width:calc(100% - 32px);';
    _container.setAttribute('aria-live', 'polite');
    _container.setAttribute('role', 'status');
    document.body.appendChild(_container);
    return _container;
  }

  function _isDark() {
    return document.documentElement.classList.contains('dark') ||
           document.body.classList.contains('dark') ||
           document.body.classList.contains('dark-mode');
  }

  function _getColors(type) {
    var dark = _isDark();
    switch (type) {
      case 'success':
        return dark ? { bg: '#1a3a2a', color: '#4ade80', border: '#22c55e' } : { bg: '#dcfce7', color: '#166534', border: '#22c55e' };
      case 'error':
        return dark ? { bg: '#3a1a1a', color: '#ff6b6b', border: '#ef4444' } : { bg: '#fee2e2', color: '#991b1b', border: '#ef4444' };
      case 'warning':
        return dark ? { bg: '#3a2a1a', color: '#fbbf24', border: '#f59e0b' } : { bg: '#fef3c7', color: '#92400e', border: '#f59e0b' };
      case 'info':
      default:
        return dark ? { bg: '#1a2a3a', color: '#60a5fa', border: '#3b82f6' } : { bg: '#dbeafe', color: '#1e40af', border: '#3b82f6' };
    }
  }

  function _getIcon(type) {
    switch (type) {
      case 'success': return '\u2705';
      case 'error': return '\u274C';
      case 'warning': return '\u26A0\uFE0F';
      case 'info': return '\u2139\uFE0F';
      default: return '\u2139\uFE0F';
    }
  }

  function _playSound() {
    if (!_soundEnabled) return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.value = 0.05;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  }

  function _removeToast(id) {
    var idx = -1;
    for (var i = 0; i < _toasts.length; i++) {
      if (_toasts[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return;
    var toast = _toasts[idx];
    if (toast.el && toast.el.parentNode) {
      toast.el.style.animation = 'toastOut .3s ease forwards';
      setTimeout(function () {
        if (toast.el && toast.el.parentNode) toast.el.parentNode.removeChild(toast.el);
        var j = _toasts.indexOf(toast);
        if (j !== -1) _toasts.splice(j, 1);
        _processQueue();
      }, 300);
    } else {
      _toasts.splice(idx, 1);
      _processQueue();
    }
    if (toast.timer) clearTimeout(toast.timer);
  }

  function _processQueue() {
    while (_queue.length > 0 && _toasts.length < _maxVisible) {
      var next = _queue.shift();
      _showToastInternal(next.message, next.type, next.options, next.id);
    }
  }

  function _isDuplicate(message, type) {
    for (var i = 0; i < _toasts.length; i++) {
      if (_toasts[i].message === message && _toasts[i].type === type) {
        if (_toasts[i].timer) clearTimeout(_toasts[i].timer);
        var duration = _toasts[i].options.duration || _getDefaultDuration(type);
        _toasts[i].timer = setTimeout(function () { _removeToast(_toasts[i].id); }.bind(null, { id: _toasts[i].id }), duration);
        return true;
      }
    }
    for (var j = 0; j < _queue.length; j++) {
      if (_queue[j].message === message && _queue[j].type === type) return true;
    }
    return false;
  }

  function _getDefaultDuration(type) {
    switch (type) {
      case 'error': return 5000;
      case 'warning': return 4000;
      case 'success': return 3000;
      case 'info': return 3000;
      default: return 3000;
    }
  }

  function _showToastInternal(message, type, options, id) {
    options = options || {};
    type = type || 'info';
    var duration = options.duration || _getDefaultDuration(type);
    var dismissible = options.dismissible !== false;
    var showProgress = options.progress !== false;
    var position = options.position || 'bottom-center';
    var icon = options.icon || _getIcon(type);
    var colors = _getColors(type);

    var el = document.createElement('div');
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('tabindex', '0');
    el.style.cssText = 'pointer-events:auto;display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:12px;font-size:14px;font-weight:500;font-family:inherit;box-shadow:0 4px 16px rgba(0,0,0,0.2);animation:toastIn .3s ease;cursor:default;position:relative;overflow:hidden;background:' + colors.bg + ';color:' + colors.color + ';border:1px solid ' + colors.border + ';user-select:none;-webkit-user-select:none;';

    var iconSpan = document.createElement('span');
    iconSpan.style.cssText = 'font-size:16px;flex-shrink:0;';
    iconSpan.textContent = icon;
    el.appendChild(iconSpan);

    var textSpan = document.createElement('span');
    textSpan.style.cssText = 'flex:1;line-height:1.4;word-break:break-word;';
    textSpan.textContent = message;
    el.appendChild(textSpan);

    if (options.action && options.action.label) {
      var actionBtn = document.createElement('button');
      actionBtn.textContent = options.action.label;
      actionBtn.style.cssText = 'background:none;border:1px solid ' + colors.border + ';color:' + colors.color + ';padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;transition:opacity .15s;white-space:nowrap;font-family:inherit;';
      actionBtn.addEventListener('click', function () {
        if (typeof options.action.onClick === 'function') options.action.onClick();
        _removeToast(id);
      });
      actionBtn.addEventListener('mouseenter', function () { actionBtn.style.opacity = '0.8'; });
      actionBtn.addEventListener('mouseleave', function () { actionBtn.style.opacity = '1'; });
      el.appendChild(actionBtn);
    }

    if (dismissible) {
      var closeBtn = document.createElement('button');
      closeBtn.setAttribute('aria-label', 'Dismiss');
      closeBtn.innerHTML = '\u2715';
      closeBtn.style.cssText = 'background:none;border:none;color:' + colors.color + ';font-size:16px;cursor:pointer;padding:2px 6px;border-radius:6px;flex-shrink:0;opacity:.6;transition:opacity .15s;font-family:inherit;line-height:1;';
      closeBtn.addEventListener('click', function () { _removeToast(id); });
      closeBtn.addEventListener('mouseenter', function () { closeBtn.style.opacity = '1'; });
      closeBtn.addEventListener('mouseleave', function () { closeBtn.style.opacity = '0.6'; });
      el.appendChild(closeBtn);
    }

    if (showProgress && duration > 0) {
      var progressWrap = document.createElement('div');
      progressWrap.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(0,0,0,0.1);';
      var progressBar = document.createElement('div');
      progressBar.style.cssText = 'height:100%;background:' + colors.border + ';width:100%;transition:width ' + duration + 'ms linear;border-radius:0 3px 3px 0;';
      progressWrap.appendChild(progressBar);
      el.appendChild(progressWrap);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          progressBar.style.width = '0%';
        });
      });
    }

    var touchStartX = 0;
    var touchCurrentX = 0;
    var swiping = false;

    el.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
      swiping = true;
      el.style.transition = 'none';
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
      if (!swiping) return;
      touchCurrentX = e.touches[0].clientX;
      var diff = touchCurrentX - touchStartX;
      if (diff > 0) {
        el.style.transform = 'translateX(' + diff + 'px)';
        el.style.opacity = String(1 - diff / 300);
      }
    }, { passive: true });

    el.addEventListener('touchend', function () {
      if (!swiping) return;
      swiping = false;
      el.style.transition = '';
      var diff = touchCurrentX - touchStartX;
      if (diff > 100) {
        _removeToast(id);
      } else {
        el.style.transform = '';
        el.style.opacity = '';
      }
    }, { passive: true });

    var pauseTimer = function () {
      if (el._fvTimer) clearTimeout(el._fvTimer);
    };
    var resumeTimer = function () {
      if (duration <= 0) return;
      el._fvTimer = setTimeout(function () { _removeToast(id); }, duration);
    };

    el.addEventListener('mouseenter', pauseTimer);
    el.addEventListener('mouseleave', resumeTimer);
    el.addEventListener('focus', pauseTimer);
    el.addEventListener('blur', resumeTimer);

    var container = _getContainer();
    container.appendChild(el);

    _toasts.push({
      id: id,
      message: message,
      type: type,
      options: options,
      el: el,
      timer: duration > 0 ? setTimeout(function () { _removeToast(id); }, duration) : null
    });

    _playSound();
  }

  function showEnhancedToast(message, type, options) {
    type = type || 'info';
    options = options || {};
    var id = 'toast_' + (++_idCounter);
    if (_isDuplicate(message, type)) return null;
    if (_toasts.length >= _maxVisible) {
      _queue.push({ message: message, type: type, options: options, id: id });
      return id;
    }
    _showToastInternal(message, type, options, id);
    return id;
  }

  function toastSuccess(message, options) {
    return showEnhancedToast(message, 'success', options);
  }

  function toastError(message, options) {
    return showEnhancedToast(message, 'error', options);
  }

  function toastWarning(message, options) {
    return showEnhancedToast(message, 'warning', options);
  }

  function toastInfo(message, options) {
    return showEnhancedToast(message, 'info', options);
  }

  function toastWithAction(message, actionLabel, actionFn, type) {
    return showEnhancedToast(message, type || 'info', {
      action: { label: actionLabel, onClick: actionFn }
    });
  }

  function dismissToast(toastId) {
    _removeToast(toastId);
  }

  function dismissAllToasts() {
    var ids = [];
    for (var i = 0; i < _toasts.length; i++) {
      ids.push(_toasts[i].id);
    }
    for (var j = 0; j < ids.length; j++) {
      _removeToast(ids[j]);
    }
    _queue = [];
  }

  function _ensureKeyframes() {
    if (document.getElementById('toast-ux-kf')) return;
    var style = document.createElement('style');
    style.id = 'toast-ux-kf';
    style.textContent =
      '@keyframes toastIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}' +
      '@keyframes toastOut{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(16px)}}';
    document.head.appendChild(style);
  }

  function _initKeyHandler() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _toasts.length > 0) {
        var last = _toasts[_toasts.length - 1];
        if (last) _removeToast(last.id);
      }
    });
  }

  function _upgradeShowToast() {
    if (typeof window.showToast === 'function' && window.showToast !== _originalShowToast) return;
    window.showToast = function (message, type) {
      return showEnhancedToast(message, type);
    };
  }

  var _originalShowToast = window.showToast;

  _ensureKeyframes();
  _initKeyHandler();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      _upgradeShowToast();
    });
  } else {
    _upgradeShowToast();
  }

  window.showEnhancedToast = showEnhancedToast;
  window.toastSuccess = toastSuccess;
  window.toastError = toastError;
  window.toastWarning = toastWarning;
  window.toastInfo = toastInfo;
  window.toastWithAction = toastWithAction;
  window.dismissToast = dismissToast;
  window.dismissAllToasts = dismissAllToasts;

})();
