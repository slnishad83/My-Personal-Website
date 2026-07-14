/* C5: Auto-logout on 20min idle + C11: resetAppState on signout */
(function() {
  var IDLE_TIMEOUT = 20 * 60 * 1000;
  var WARNING_TIMEOUT = 19 * 60 * 1000;
  var _idleTimer = null;
  var _warningShown = false;
  var _warningTimer = null;

  function resetIdleTimer() {
    clearTimeout(_idleTimer);
    clearTimeout(_warningTimer);
    _warningShown = false;
    _idleTimer = setTimeout(function() {
      if (typeof showToast === 'function') showToast('Session expired due to inactivity.', 'info');
      setTimeout(function() {
        if (typeof window.signOut === 'function') window.signOut();
        else if (typeof firebase !== 'undefined' && firebase.auth) {
          firebase.auth().signOut().then(function() { window.location.reload(); });
        }
      }, 3000);
    }, IDLE_TIMEOUT);
    _warningTimer = setTimeout(function() {
      if (!_warningShown && document.visibilityState === 'visible') {
        _warningShown = true;
        if (typeof showToast === 'function') showToast('Session will expire in 1 minute due to inactivity.', 'warning');
      }
    }, WARNING_TIMEOUT);
  }

  ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'].forEach(function(evt) {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') resetIdleTimer();
  });

  if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) resetIdleTimer();
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) resetIdleTimer(); else { clearTimeout(_idleTimer); clearTimeout(_warningTimer); }
  });

  window.resetAppState = function() {
    clearTimeout(_idleTimer);
    clearTimeout(_warningTimer);
    if (typeof window.currentChat !== 'undefined') window.currentChat = null;
    if (typeof window.currentChatType !== 'undefined') window.currentChatType = null;
    if (typeof window.MutationBus !== 'undefined') MutationBus.destroyAll();
    if (typeof window.ChatEnhancements !== 'undefined') ChatEnhancements.destroy();
    if (typeof window.UICompliance !== 'undefined') UICompliance.destroy();
    if (typeof window.AuditInteractions !== 'undefined') AuditInteractions.destroy();
    if (typeof window.WAEnhance !== 'undefined') WAEnhance.destroy();
    if (typeof window.Security !== 'undefined') Security.destroy();
    if (typeof window.OfflineQueue !== 'undefined') OfflineQueue.destroy && OfflineQueue.destroy();
    document.removeEventListener('mousemove', resetIdleTimer);
    document.removeEventListener('keydown', resetIdleTimer);
    document.removeEventListener('touchstart', resetIdleTimer);
    document.removeEventListener('scroll', resetIdleTimer);
    document.removeEventListener('click', resetIdleTimer);
    if (window.NSLBroadcastChannel) {
      try { window.NSLBroadcastChannel.postMessage({ type: 'logout' }); } catch(_) {}
    }
  };
})();