/* C5: Auto-logout script removed to enforce permanent sessions */
(function() {
  window.resetAppState = function() {
    if (typeof window.currentChat !== 'undefined') window.currentChat = null;
    if (typeof window.currentChatType !== 'undefined') window.currentChatType = null;
    if (typeof window.MutationBus !== 'undefined') MutationBus.destroyAll();
    if (typeof window.ChatEnhancements !== 'undefined') ChatEnhancements.destroy();
    if (typeof window.UICompliance !== 'undefined') UICompliance.destroy();
    if (typeof window.AuditInteractions !== 'undefined') AuditInteractions.destroy();
    if (typeof window.WAEnhance !== 'undefined') WAEnhance.destroy();
    if (typeof window.Security !== 'undefined') Security.destroy();
    if (typeof window.OfflineQueue !== 'undefined') OfflineQueue.destroy && OfflineQueue.destroy();
    if (window.NSLBroadcastChannel) {
      try { window.NSLBroadcastChannel.postMessage({ type: 'logout' }); } catch(_) {}
    }
  };
})();