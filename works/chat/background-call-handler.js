/* background-call-handler.js — Keep calls alive when tab loses focus or goes to background */
(function () {
  'use strict';

  var _bgTimer = null;
  var _bgCheckInterval = null;
  var _lastHeartbeat = 0;
  var _visibilityHandler = null;
  var _focusHandler = null;

  function init() {
    _visibilityHandler = _onVisibilityChange;
    document.addEventListener('visibilitychange', _visibilityHandler);
    window.addEventListener('blur', _onBlur);
    window.addEventListener('focus', _onFocus);
    window.addEventListener('pagehide', _onPageHide);
    window.addEventListener('pageshow', _onPageShow);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', _onSWMessage);
    }
    _startBackgroundWatch();
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

  function _startBackgroundWatch() {
    _bgCheckInterval = null;
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
    _exitBackground();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 0); });
  }

  window._BackgroundCallHandler = { init: init, destroy: destroy, sendHeartbeat: _sendHeartbeat };

})();
