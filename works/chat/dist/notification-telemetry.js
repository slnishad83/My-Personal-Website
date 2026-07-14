/* ============================================================
   NOTIFICATION TELEMETRY — Observability for missed
   notifications, delayed pushes, and call failures.
   Logs events to Firestore for analytics.
   ============================================================ */
'use strict';

const NotifTelemetry = (() => {
  const FLUSH_INTERVAL = 30000;
  const MAX_QUEUE = 100;
  let _queue = [];
  let _flushTimer = null;
  let _enabled = true;

  function _log(event, data) {
    if (!_enabled) return;
    _queue.push({
      event,
      data: data || {},
      ts: Date.now(),
      platform: window.Platform?.os || 'unknown',
      browser: window.Platform?.browser || 'unknown',
      sessionId: sessionStorage.getItem('tcSessionId') || ''
    });
    if (_queue.length >= MAX_QUEUE) _flush();
  }

  async function _flush() {
    if (!_queue.length) return;
    const batch = _queue.splice(0, MAX_QUEUE);
    try {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        const db = firebase.firestore();
        const batchOps = db.batch();
        batch.forEach(entry => {
          const ref = db.collection('notificationTelemetry').doc();
          batchOps.set(ref, entry);
        });
        await batchOps.commit();
      }
    } catch (_) {}
  }

  function start() {
    _flushTimer = setInterval(_flush, FLUSH_INTERVAL);
    window.addEventListener('beforeunload', () => _flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') _flush();
    });
  }

  function stop() {
    clearInterval(_flushTimer);
    _flush();
  }

  return {
    start,
    stop,

    pushReceived(data) {
      _log('push_received', {
        kind: data.kind || 'message',
        chatId: data.chatId || '',
        latencyMs: data._receivedAt ? Date.now() - data._receivedAt : null
      });
    },

    pushDelayed(expectedMs, actualMs) {
      _log('push_delayed', {
        expectedMs,
        actualMs,
        deltaMs: actualMs - expectedMs
      });
    },

    notificationShown(data) {
      _log('notif_shown', {
        kind: data.kind || 'message',
        chatId: data.chatId || '',
        via: data.via || 'sw'
      });
    },

    notificationMissed(reason, data) {
      _log('notif_missed', {
        reason,
        kind: data?.kind || 'unknown',
        chatId: data?.chatId || ''
      });
    },

    callEvent(event, data) {
      _log('call_' + event, {
        callId: data?.callId || '',
        callType: data?.callType || '',
        durationMs: data?.durationMs || 0,
        reason: data?.reason || '',
        status: data?.status || ''
      });
    },

    callFailed(reason, data) {
      _log('call_failed', {
        callId: data?.callId || '',
        reason,
        callType: data?.callType || '',
        iceState: data?.iceState || '',
        signalingState: data?.signalingState || ''
      });
    },

    pushTokenUpdate(token, status) {
      _log('push_token_update', {
        token: token ? token.slice(0, 8) + '...' : '',
        status
      });
    },

    dndActive(period) {
      _log('dnd_active', {
        from: period.from || '',
        to: period.to || ''
      });
    },

    muteAction(action, chatId) {
      _log('mute_' + action, { chatId: chatId || '' });
    },

    badgeUpdate(count) {
      _log('badge_update', { count });
    },

    audioRouteChange(route) {
      _log('audio_route_change', { route });
    },

    get queueLength() { return _queue.length; },
    get enabled() { return _enabled; },
    set enabled(val) { _enabled = Boolean(val); }
  };
})();

window.NotifTelemetry = NotifTelemetry;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => NotifTelemetry.start());
} else {
  NotifTelemetry.start();
}
