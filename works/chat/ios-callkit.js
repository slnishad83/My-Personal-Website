/* ============================================================
   iOS CALLKIT BRIDGE â€” Capacitor plugin bridge for native
   iOS CallKit incoming call UI. Falls back gracefully on
   Android and Web platforms.
   ============================================================ */
'use strict';

const IOSCallKit = (() => {
  let _isIOS = false;
  let _isNative = false;
  let _plugin = null;

  function init() {
    _isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
      (navigator.userAgentData && navigator.userAgentData.platform === 'iOS');
    _isNative = !!(window.Capacitor?.Plugins?.IncomingCallPlugin);

    if (_isNative && window.Capacitor?.Plugins?.IncomingCallPlugin) {
      _plugin = window.Capacitor.Plugins.IncomingCallPlugin;
      _setupListeners();
    }
  }

  function _setupListeners() {
    if (!_plugin) return;
    _plugin.addListener('callAnswered', (data) => {
      document.dispatchEvent(new CustomEvent('ios:call:answered', { detail: data }));
      if (typeof window.acceptCall === 'function') window.acceptCall();
    });
    _plugin.addListener('callEnded', (data) => {
      document.dispatchEvent(new CustomEvent('ios:call:ended', { detail: data }));
      if (typeof window.endCall === 'function') window.endCall();
    });
    _plugin.addListener('callMuted', (data) => {
      document.dispatchEvent(new CustomEvent('ios:call:muted', { detail: data }));
      if (typeof window.toggleMute === 'function') window.toggleMute();
    });
    _plugin.addListener('audioActivated', () => {
      document.dispatchEvent(new CustomEvent('ios:call:audio:activated'));
    });
    _plugin.addListener('audioDeactivated', () => {
      document.dispatchEvent(new CustomEvent('ios:call:audio:deactivated'));
    });
  }

  async function reportIncomingCall(callId, callerName, callType) {
    if (!_plugin) return false;
    try {
      return await _plugin.reportIncomingCall({
        callId,
        callerName,
        callType: callType || 'voice'
      });
    } catch (e) {
      if (window.__DEBUG__) console.warn('[IOSCallKit] reportIncomingCall failed:', e);
      return false;
    }
  }

  async function endCall() {
    if (!_plugin) return false;
    try {
      return await _plugin.endCall();
    } catch (e) {
      if (window.__DEBUG__) console.warn('[IOSCallKit] endCall failed:', e);
      return false;
    }
  }

  async function answerCall() {
    if (!_plugin) return false;
    try {
      return await _plugin.answerCall();
    } catch (e) {
      if (window.__DEBUG__) console.warn('[IOSCallKit] answerCall failed:', e);
      return false;
    }
  }

  async function setAudioOutput(output) {
    if (!_plugin) return false;
    try {
      return await _plugin.setAudioOutput({ output });
    } catch (e) {
      if (window.__DEBUG__) console.warn('[IOSCallKit] setAudioOutput failed:', e);
      return false;
    }
  }

  return {
    init,
    reportIncomingCall,
    endCall,
    answerCall,
    setAudioOutput,
    get isAvailable() { return _isNative; },
    get isIOS() { return _isIOS; }
  };
})();

window.IOSCallKit = IOSCallKit;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => IOSCallKit.init());
} else {
  IOSCallKit.init();
}
