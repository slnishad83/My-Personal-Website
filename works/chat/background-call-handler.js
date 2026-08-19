/* background-call-handler.js � Keep calls alive when tab loses focus or goes to background */
(function () {
  'use strict';

  var _bgTimer = null;
  var _bgCheckInterval = null;
  var _lastHeartbeat = 0;
  var _visibilityHandler = null;
  var _focusHandler = null;
  var _bgNotification = null;
  var _beforeUnloadHandler = null;

  function init() {
    _visibilityHandler = _onVisibilityChange;
    document.addEventListener('visibilitychange', _visibilityHandler);
    window.addEventListener('blur', _onBlur);
    window.addEventListener('focus', _onFocus);
    window.addEventListener('pagehide', _onPageHide);
    window.addEventListener('pageshow', _onPageShow);
    _beforeUnloadHandler = function(e) {
      if (window.App && window.App.callActive) {
        e.preventDefault();
        e.returnValue = 'You have an active call. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', _beforeUnloadHandler);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', _onSWMessage);
    }
  }

  function _onVisibilityChange() {
    if (document.hidden) {
      _enterBackground();
    } else {
      _exitBackground();
    }
  }

  function _onBlur() {
    if (window.App && window.App.callActive) {
      _enterBackground();
    }
  }

  function _onFocus() {
    _exitBackground();
  }

  function _onPageHide() {
    if (window.App && window.App.callActive) {
      _enterBackground();
    }
  }

  function _onPageShow() {
    _exitBackground();
  }

  function _onSWMessage(e) {
    if (e.data && e.data.type === 'call-heartbeat-request') {
      _sendHeartbeat();
    }
  }

  function _enterBackground() {
    if (!window.App || !window.App.callActive) return;
    _sendHeartbeat();
    _bgCheckInterval = setInterval(function () {
      _sendHeartbeat();
    }, 10000);
    _keepAlive();
    _showPersistentNotification();
    if (window.electronAPI?.call?.keepAlive) {
      try {
        var callInfo = {};
        if (window._CC && window._CC.callId) {
          callInfo.callId = window._CC.callId;
          callInfo.uid = window._CC.uid ? window._CC.uid() : '';
        }
        if (window._GC && window._GC._currentCallId) {
          callInfo.callId = window._GC._currentCallId;
          callInfo.uid = window._GC._uid ? window._GC._uid() : '';
          callInfo.isGroupCall = true;
        }
        window.electronAPI.call.keepAlive(callInfo);
      } catch (_) {}
    }
  }

  function _exitBackground() {
    if (_bgCheckInterval) {
      clearInterval(_bgCheckInterval);
      _bgCheckInterval = null;
    }
    if (_bgTimer) {
      clearTimeout(_bgTimer);
      _bgTimer = null;
    }
    _dismissPersistentNotification();
    if (window.electronAPI?.call?.release) {
      try { window.electronAPI.call.release(); } catch (_) {}
    }
    if (window.App && window.App.callActive && window._CC && typeof window._CC.maximizeCall === 'function') {
      window._CC.maximizeCall();
    }
  }

  function _showPersistentNotification() {
    if (_bgNotification) return;
    try {
      if (Notification.permission !== 'granted') return;
      var callName = '';
      if (window._CC && window._CC.$) callName = window._CC.$('call-name')?.textContent || '';
      _bgNotification = new Notification('Call active' + (callName ? ' with ' + callName : ''), {
        body: 'Tap to return to the call',
        tag: 'nsl-call-bg',
        requireInteraction: true,
        silent: true
      });
      _bgNotification.onclick = function () { window.focus(); _bgNotification = null; };
    } catch (_) {}
  }

  function _dismissPersistentNotification() {
    if (_bgNotification) { try { _bgNotification.close(); } catch (_) {} _bgNotification = null; }
  }

  function _keepAlive() {
    if (!window.App || !window.App.callActive) return;
    if (!document.hidden) return;
    if (window._CC && window._CC.db() && window._CC.callId) {
      window._CC.db().collection('calls').doc(window._CC.callId).update({
        heartbeat: firebase.firestore.FieldValue.serverTimestamp(),
        heartbeatUid: window._CC.uid ? window._CC.uid() : ''
      }).catch(function () {});
    }
    _bgTimer = setTimeout(_keepAlive, 12000);
  }

  function _sendHeartbeat() {
    _lastHeartbeat = Date.now();
    if (window._CC && window._CC.db() && window._CC.callId && window._CC.uid) {
      if (window._CC.heartbeatHandle) return;
      window._CC.db().collection('calls').doc(window._CC.callId).update({
        heartbeat: firebase.firestore.FieldValue.serverTimestamp(),
        heartbeatUid: window._CC.uid()
      }).catch(function () {});
    }
    if (window._GC && window._GC._firestore() && window._GC._currentCallId && window._GC._uid) {
      window._GC._firestore().collection('groupCalls').doc(window._GC._currentCallId).update({
        heartbeat: firebase.firestore.FieldValue.serverTimestamp(),
        heartbeatUid: window._GC._uid()
      }).catch(function () {});
    }
    if (window._CC && window._CC.bcChannel) {
      try { window._CC.bcChannel.postMessage({ type: 'call-heartbeat' }); } catch (_) {}
    }
  }

  function destroy() {
    if (_visibilityHandler) {
      document.removeEventListener('visibilitychange', _visibilityHandler);
      _visibilityHandler = null;
    }
    window.removeEventListener('blur', _onBlur);
    window.removeEventListener('focus', _onFocus);
    window.removeEventListener('pagehide', _onPageHide);
    window.removeEventListener('pageshow', _onPageShow);
    if (_beforeUnloadHandler) {
      window.removeEventListener('beforeunload', _beforeUnloadHandler);
      _beforeUnloadHandler = null;
    }
    _exitBackground();
    _dismissPersistentNotification();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 0); });
  }

  window._BackgroundCallHandler = { init: init, destroy: destroy, sendHeartbeat: _sendHeartbeat };

})();
