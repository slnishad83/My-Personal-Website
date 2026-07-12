/* ============================================================
   PLATFORM DETECTION — Device, OS, Browser, Capabilities
   Detects everything needed for platform-appropriate behavior
   ============================================================ */
'use strict';

const Platform = (() => {
  const ua = navigator.userAgent || '';
  const pf = navigator.platform || '';
  const maxTouch = navigator.maxTouchPoints || 0;

  /* ── Device Type ────────────────────────────────────────── */
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (maxTouch > 0 && /MacIntel/i.test(pf));
  const isTablet = /iPad/i.test(ua) || (/MacIntel/i.test(pf) && maxTouch > 1) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isDesktop = !isMobile && !isTablet;
  const isPhone = isMobile && !isTablet;
  const isFoldable = typeof window.matchMedia === 'function' && (
    window.matchMedia('(spanning: single-fold-vertical)').matches ||
    window.matchMedia('(spanning: single-fold-horizontal)').matches ||
    window.matchMedia('(spanning: none)').matches && maxTouch > 0 && /Samsung/i.test(ua)
  ) || (isMobile && screen.width >= 600 && screen.width <= 900 && maxTouch > 0);

  /* ── Operating System ───────────────────────────────────── */
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (pf === 'MacIntel' && maxTouch > 1);
  const isIPad = /iPad/i.test(ua) || (pf === 'MacIntel' && maxTouch > 1);
  const isIPhone = /iPhone/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isWindows = /Win/i.test(pf) || /Windows/i.test(ua);
  const isMacOS = /Mac/i.test(pf) && !isIOS;
  const isLinux = /Linux/i.test(pf) && !isAndroid;
  const isChromeOS = /CrOS/i.test(ua);
  const os = isIOS ? 'ios' : isAndroid ? 'android' : isWindows ? 'windows' : isMacOS ? 'macos' : isLinux ? 'linux' : isChromeOS ? 'chromeos' : 'unknown';

  /* ── Browser ────────────────────────────────────────────── */
  const isChrome = /Chrome/i.test(ua) && !/Edg|OPR|Samsung/i.test(ua);
  const isEdge = /Edg/i.test(ua);
  const isFirefox = /Firefox|FxiOS/i.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios|edg|opr|samsung).)*safari/i.test(ua) || (isIOS && !isChrome && !isFirefox && !isEdge);
  const isOpera = /OPR|Opera/i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);
  const isCrios = /CriOS/i.test(ua);
  const isFxiOS = /FxiOS/i.test(ua);
  const browser = isEdge ? 'edge' : isSamsung ? 'samsung' : isCrios ? 'chrome-ios' : isFxiOS ? 'firefox-ios' : isChrome ? 'chrome' : isFirefox ? 'firefox' : isOpera ? 'opera' : isSafari ? 'safari' : 'unknown';

  /* ── App Type ───────────────────────────────────────────── */
  const isNativeApp = window.Capacitor?.isNativePlatform?.() === true || Boolean(window.Capacitor?.Plugins?.App);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isPWA = isStandalone || document.referrer.includes('android-app://');
  const isWeb = !isNativeApp && !isPWA;

  /* ── Capability Detection ───────────────────────────────── */
  const capabilities = {
    /* Notifications */
    notificationSupported: 'Notification' in window,
    notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unavailable',
    get notificationsEnabled() { return this.notificationSupported && Notification.permission === 'granted'; },
    get notificationsBlocked() { return this.notificationSupported && Notification.permission === 'denied'; },

    /* Service Worker */
    serviceWorkerSupported: 'serviceWorker' in navigator,
    backgroundSyncSupported: 'serviceWorker' in navigator && 'SyncManager' in window,
    periodicSyncSupported: 'serviceWorker' in navigator && 'PeriodicSyncManager' in window,
    pushManagerSupported: 'serviceWorker' in navigator && 'PushManager' in window,

    /* Media */
    getUserMediaSupported: !!(navigator.mediaDevices?.getUserMedia),
    getDisplayMediaSupported: !!(navigator.mediaDevices?.getDisplayMedia),
    mediaRecorderSupported: typeof MediaRecorder !== 'undefined',
    webAudioSupported: !!(window.AudioContext || window.webkitAudioContext),

    /* Camera */
    get cameraSupported() { return this.getUserMediaSupported; },
    get facingModeSupported() {
      try {
        const caps = navigator.mediaDevices?.getSupportedConstraints?.();
        return caps?.facingMode === true;
      } catch (_) { return false; }
    },

    /* Display */
    highDPI: window.devicePixelRatio > 1,
    devicePixelRatio: window.devicePixelRatio || 1,
    colorGamut: window.matchMedia?.('(color-gamut: p3)').matches ? 'p3' : 'srgb',
    hdr: window.matchMedia?.('(dynamic-range: high)').matches,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    prefersContrast: window.matchMedia?.('(prefers-contrast: more)').matches,
    prefersColorScheme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',

    /* Network */
    get connectionEffectiveType() { return navigator.connection?.effectiveType || 'unknown'; },
    get connectionDownlink() { return navigator.connection?.downlink || 0; },
    get connectionRtt() { return navigator.connection?.rtt || 0; },
    get saveData() { return navigator.connection?.saveData || false; },
    get online() { return navigator.onLine; },

    /* Wake Lock */
    wakeLockSupported: 'wakeLock' in navigator,

    /* Storage */
    localStorageSupported: (() => { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch (_) { return false; } })(),
    indexedDBSupported: 'indexedDB' in window,
    cacheAPISupported: 'caches' in window,

    /* Clipboard */
    clipboardSupported: navigator.clipboard && typeof navigator.clipboard.writeText === 'function',

    /* Sharing */
    shareSupported: typeof navigator.share === 'function',
    shareFileSupported: typeof navigator.canShare === 'function',

    /* Haptics */
    vibrateSupported: typeof navigator.vibrate === 'function',

    /* Bluetooth */
    webBluetoothSupported: 'bluetooth' in navigator,

    /* Sensors */
    deviceMotionSupported: 'DeviceMotionEvent' in window,
    deviceOrientationSupported: 'DeviceOrientationEvent' in window,
    gyroscopeSupported: 'Gyroscope' in window,

    /* Performance */
    memoryInfo: navigator.deviceMemory || 'unknown',
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',

    /* WebRTC */
    rtcSupported: !!(window.RTCPeerConnection || window.webkitRTCPeerConnection),

    /* Fullscreen */
    fullscreenSupported: document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen,

    /* PiP */
    pipSupported: document.pictureInPictureEnabled || document.webkitPictureInPictureEnabled,

    /* Screen Lock (capacitor) */
    get screenLockSupported() { return isNativeApp || ('getScreenDetails' in window); }
  };

  /* ── Background State ───────────────────────────────────── */
  function isVisible() { return document.visibilityState === 'visible'; }
  function isForeground() { return !document.hidden; }

  /* ── Battery API ────────────────────────────────────────── */
  let batteryCache = null;
  async function getBattery() {
    try {
      if (!navigator.getBattery) return null;
      if (!batteryCache) batteryCache = await navigator.getBattery();
      return {
        charging: batteryCache.charging,
        level: batteryCache.level,
        chargingTime: batteryCache.chargingTime,
        dischargingTime: batteryCache.dischargingTime,
        isLow: batteryCache.level < 0.2,
        isCritical: batteryCache.level < 0.1,
        isPowerSaving: batteryCache.dischargingTime < 1800 && batteryCache.level < 0.3
      };
    } catch (_) { return null; }
  }

  /* ── Do Not Disturb ─────────────────────────────────────── */
  function isDND() {
    if ('connection' in navigator && navigator.connection?.saveData) return true;
    if ('scheduler' in navigator && 'postTask' in navigator.scheduler) {
      try { navigator.scheduler.postTask(() => {}, { priority: 'user-visible' }); } catch (_) { return true; }
    }
    if (Platform?.capabilities?.reducedMotion) return true;
    return false;
  }

  /* ── Build Device Fingerprint ───────────────────────────── */
  function getFingerprint() {
    const parts = [
      os, browser, screen.width + 'x' + screen.height,
      window.devicePixelRatio, navigator.language,
      new Date().getTimezoneOffset(), navigator.hardwareConcurrency
    ];
    return parts.join('|');
  }

  /* ── Screen Info ────────────────────────────────────────── */
  function getScreenInfo() {
    return {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      orientation: screen.orientation?.type || 'unknown',
      angle: screen.orientation?.angle || 0,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      isLandscape: (screen.orientation?.angle === 90 || screen.orientation?.angle === 270) || screen.width > screen.height,
      isPortrait: screen.width <= screen.height,
      isMultiMonitor: window.screenX !== 0 || window.screenY !== 0
    };
  }

  /* ── Internet Quality Assessment ────────────────────────── */
  let _qualityCache = { level: 'unknown', lastCheck: 0 };
  function getInternetQuality() {
    const now = Date.now();
    if (now - _qualityCache.lastCheck < 10000) return _qualityCache.level;
    _qualityCache.lastCheck = now;
    const conn = navigator.connection;
    if (!conn) { _qualityCache.level = 'unknown'; return _qualityCache.level; }
    const et = conn.effectiveType || '';
    const dl = conn.downlink || 0;
    const rtt = conn.rtt || 0;
    if (et === '4g' && dl > 5 && rtt < 100) _qualityCache.level = 'excellent';
    else if (et === '4g' || (et === '3g' && dl > 1.5)) _qualityCache.level = 'good';
    else if (et === '3g' || et === '2g') _qualityCache.level = 'fair';
    else if (et === 'slow-2g' || et === '2g') _qualityCache.level = 'poor';
    else _qualityCache.level = 'unknown';
    return _qualityCache.level;
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    if (navigator.connection?.addEventListener) {
      navigator.connection.addEventListener('change', () => {
        getInternetQuality();
        if (typeof window._onNetworkChange === 'function') window._onNetworkChange(getInternetQuality());
      });
    }
  }

  /* ── Platform Notification Strategy ─────────────────────── */
  function getNotificationStrategy() {
    if (isNativeApp && isAndroid) return 'fcm-native';
    if (isNativeApp && isIOS) return 'apns-native';
    if (isPWA && isAndroid) return 'fcm-web';
    if (isPWA && isIOS) return 'apns-web';
    if (isSafari && isIOS) return 'safari-local';
    if (isSafari && isMacOS) return 'safari-local';
    if (capabilities.pushManagerSupported) return 'web-push';
    if (capabilities.notificationSupported) return 'basic-notif';
    return 'in-app-only';
  }

  return {
    ua, os, browser, isMobile, isTablet, isDesktop, isPhone, isFoldable,
    isIOS, isIPad, isIPhone, isAndroid, isWindows, isMacOS, isLinux, isChromeOS,
    isChrome, isEdge, isFirefox, isSafari, isOpera, isSamsung, isCrios, isFxiOS,
    isNativeApp, isStandalone, isPWA, isWeb,
    capabilities, getBattery, isDND, getFingerprint, getScreenInfo,
    getInternetQuality, getNotificationStrategy,
    isVisible, isForeground, init
  };
})();

Platform.init();
window.Platform = Platform;
