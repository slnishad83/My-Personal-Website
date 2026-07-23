/**
 * ListenerManager - Centralized Firestore onSnapshot listener cleanup utility
 * IIFE pattern, zero dependencies
 */
(function () {
  "use strict";

  var _listeners = {};
  var _paused = {};
  var _debug = false;
  var _maxListeners = 50;
  var _initialized = false;

  function _warn(msg) {
    if (_debug) {
      console.warn("[ListenerManager] " + msg);
    }
  }

  function _log(msg) {
    if (_debug) {
      console.log("[ListenerManager] " + msg);
    }
  }

  function register(key, unsubscribeFn) {
    if (typeof key !== "string" || !key) {
      _warn("register: invalid key");
      return false;
    }
    if (typeof unsubscribeFn !== "function") {
      _warn("register: unsubscribe must be a function for key '" + key + "'");
      return false;
    }
    if (_listeners[key]) {
      _warn("register: key '" + key + "' already registered, unsubscribing old one");
      try { _listeners[key].unsub(); } catch (e) { /* ignore */ }
    }
    if (Object.keys(_listeners).length >= _maxListeners) {
      console.warn(
        "[ListenerManager] Max listener limit (" + _maxListeners + ") reached! " +
        "Consider calling cleanupStale() or cleanupByPrefix(). " +
        "Active keys: " + Object.keys(_listeners).join(", ")
      );
    }
    _listeners[key] = {
      unsub: unsubscribeFn,
      registeredAt: Date.now()
    };
    _log("Registered: " + key);
    return true;
  }

  function unregister(key) {
    if (!_listeners[key]) return false;
    try { _listeners[key].unsub(); } catch (e) { /* ignore */ }
    delete _listeners[key];
    _log("Unregistered: " + key);
    return true;
  }

  function cleanupAll() {
    var count = 0;
    var keys = Object.keys(_listeners);
    for (var i = 0; i < keys.length; i++) {
      try { _listeners[keys[i]].unsub(); } catch (e) { /* ignore */ }
      count++;
    }
    _listeners = {};
    _paused = {};
    _log("Cleaned up " + count + " listeners");
    return count;
  }

  function cleanupByPrefix(prefix) {
    if (!prefix) return 0;
    var count = 0;
    var keys = Object.keys(_listeners);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(prefix) === 0) {
        try { _listeners[keys[i]].unsub(); } catch (e) { /* ignore */ }
        delete _listeners[keys[i]];
        count++;
      }
    }
    _log("Cleaned up " + count + " listeners with prefix '" + prefix + "'");
    return count;
  }

  function cleanupStale(maxAgeMs) {
    if (typeof maxAgeMs !== "number" || maxAgeMs <= 0) {
      maxAgeMs = 30 * 60 * 1000;
    }
    var now = Date.now();
    var count = 0;
    var keys = Object.keys(_listeners);
    for (var i = 0; i < keys.length; i++) {
      if (now - _listeners[keys[i]].registeredAt > maxAgeMs) {
        try { _listeners[keys[i]].unsub(); } catch (e) { /* ignore */ }
        delete _listeners[keys[i]];
        count++;
      }
    }
    _log("Cleaned up " + count + " stale listeners (older than " + maxAgeMs + "ms)");
    return count;
  }

  function getActiveCount() {
    return Object.keys(_listeners).length;
  }

  function _pauseNonCritical() {
    var keys = Object.keys(_listeners);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf("critical:") !== 0) {
        if (!_paused[keys[i]]) {
          try { _listeners[keys[i]].unsub(); } catch (e) { /* ignore */ }
          _paused[keys[i]] = _listeners[keys[i]];
          delete _listeners[keys[i]];
          _log("Paused: " + keys[i]);
        }
      }
    }
  }

  function _resumePaused() {
    var keys = Object.keys(_paused);
    for (var i = 0; i < keys.length; i++) {
      if (_listeners[keys[i]]) {
        try { _paused[keys[i]].unsub(); } catch (e) { /* ignore */ }
      }
      _listeners[keys[i]] = _paused[keys[i]];
      delete _paused[keys[i]];
      _log("Resumed: " + keys[i]);
    }
  }

  function _checkMemoryPressure() {
    if (performance && performance.memory) {
      var used = performance.memory.usedJSHeapSize;
      var limit = performance.memory.jsHeapSizeLimit;
      if (used && limit && used / limit > 0.85) {
        console.warn(
          "[ListenerManager] Memory pressure detected (" +
          Math.round((used / limit) * 100) + "% of limit). Cleaning stale listeners."
        );
        cleanupStale(10 * 60 * 1000);
      }
    }
  }

  function init() {
    if (_initialized) {
      _warn("init() already called");
      return;
    }
    _initialized = true;

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        _log("Page hidden, pausing non-critical listeners");
        _pauseNonCritical();
      } else {
        _log("Page visible, resuming paused listeners");
        _resumePaused();
      }
    });

    window.addEventListener("beforeunload", function () {
      _log("beforeunload, cleaning up all listeners");
      cleanupAll();
    });

    if (performance && performance.memory) {
      setInterval(_checkMemoryPressure, 30000);
    }

    _log("Initialized");
  }

  var ListenerManager = {
    register: register,
    unregister: unregister,
    cleanupAll: cleanupAll,
    cleanupByPrefix: cleanupByPrefix,
    cleanupStale: cleanupStale,
    getActiveCount: getActiveCount,
    init: init,
    get debug() { return _debug; },
    set debug(val) { _debug = !!val; },
    get maxListeners() { return _maxListeners; },
    set maxListeners(val) { _maxListeners = typeof val === "number" && val > 0 ? val : 50; }
  };

  window.ListenerManager = ListenerManager;
})();
