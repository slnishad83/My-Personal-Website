/**
 * GlobalCleanup — auto-tracks setInterval/setTimeout handles and
 * patches Firestore onSnapshot to auto-register with ListenerManager.
 * Call GlobalCleanup.destroy() on logout to kill everything.
 */
(function () {
  'use strict';

  var _intervals = {};
  var _timeouts = {};
  var _intervalId = 0;
  var _timeoutId = 0;
  var _originalSetInterval = window.setInterval;
  var _originalSetTimeout = window.setTimeout;
  var _originalClearInterval = window.clearInterval;
  var _originalClearTimeout = window.clearTimeout;
  var _patched = false;

  function _trackInterval(id, fn, ms) {
    _intervalId++;
    _intervals[_intervalId] = { id: id, fn: fn, ms: ms, created: Date.now() };
    return _intervalId;
  }

  function _trackTimeout(id) {
    _timeoutId++;
    _timeouts[_timeoutId] = { id: id, created: Date.now() };
    return _timeoutId;
  }

  function patch() {
    if (_patched) return;
    _patched = true;

    window.setInterval = function (fn, ms) {
      var realId = _originalSetInterval.apply(window, arguments);
      _trackInterval(realId, fn, ms);
      return realId;
    };

    window.clearInterval = function (id) {
      _originalClearInterval.apply(window, arguments);
      // Remove from our tracking
      var keys = Object.keys(_intervals);
      for (var i = 0; i < keys.length; i++) {
        if (_intervals[keys[i]].id === id) {
          delete _intervals[keys[i]];
          break;
        }
      }
    };

    window.setTimeout = function (fn, ms) {
      var realId = _originalSetTimeout.apply(window, arguments);
      _trackTimeout(realId);
      return realId;
    };

    window.clearTimeout = function (id) {
      _originalClearTimeout.apply(window, arguments);
      delete _timeouts[id];
    };
  }

  function clearAllIntervals() {
    var count = 0;
    var keys = Object.keys(_intervals);
    for (var i = 0; i < keys.length; i++) {
      try { _originalClearInterval.call(window, _intervals[keys[i]].id); } catch (_) {}
      count++;
    }
    _intervals = {};
    return count;
  }

  function clearAllTimeouts() {
    var count = 0;
    var keys = Object.keys(_timeouts);
    for (var i = 0; i < keys.length; i++) {
      try { _originalClearTimeout.call(window, _timeouts[keys[i]].id); } catch (_) {}
      count++;
    }
    _timeouts = {};
    return count;
  }

  function getTrackedIntervals() {
    return Object.keys(_intervals).map(function (k) {
      return { key: k, age: Date.now() - _intervals[k].created };
    });
  }

  function destroy() {
    var intervalCount = clearAllIntervals();
    var timeoutCount = clearAllTimeouts();

    // Cleanup ListenerManager (Firestore listeners)
    var listenerCount = 0;
    if (window.ListenerManager && typeof window.ListenerManager.cleanupAll === 'function') {
      listenerCount = window.ListenerManager.cleanupAll();
    }

    // Cleanup NotificationOrchestrator timers
    if (window._notificationOrchestrator) {
      try { window._notificationOrchestrator.stop(); } catch (_) {}
    }

    // Cleanup window-level intervals/timers that were set before patching
    var knownGlobals = [
      'statusRefreshTimer', '_statusReminderInterval', '_flashInterval',
      '_bgCheckInterval', '_recallInterval', '_recallDeleteInterval',
      'scheduledCheckInterval', '_flushTimer', 'disappearingCheckInterval',
      '_speakerCheckInterval', '_netQualityInterval',
      '_crossfadeInInterval', '_sleepTimerInterval', '_progressInterval',
      '_recordInterval', '_vnProgressInterval', '_timerInterval',
      '_bgCheckInterval', '_healthTimer'
    ];
    for (var i = 0; i < knownGlobals.length; i++) {
      var val = window[knownGlobals[i]];
      if (val) {
        try { clearInterval(val); } catch (_) {}
        try { clearTimeout(val); } catch (_) {}
        window[knownGlobals[i]] = null;
      }
    }

    // Stop NotificationOrchestrator ring/vibrate intervals
    try {
      if (window._notificationOrchestrator && window._notificationOrchestrator._ringInterval) {
        clearInterval(window._notificationOrchestrator._ringInterval);
      }
      if (window._notificationOrchestrator && window._notificationOrchestrator._vibrateInterval) {
        clearInterval(window._notificationOrchestrator._vibrateInterval);
      }
    } catch (_) {}

    return { intervals: intervalCount, timeouts: timeoutCount, listeners: listenerCount };
  }

  window.GlobalCleanup = {
    patch: patch,
    clearAllIntervals: clearAllIntervals,
    clearAllTimeouts: clearAllTimeouts,
    getTrackedIntervals: getTrackedIntervals,
    destroy: destroy
  };

  // Auto-patch immediately so all subsequent setInterval/setTimeout are tracked
  patch();
})();
