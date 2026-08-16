/**
 * NSL Chat â€” Configuration Module
 * 
 * Separation of concerns:
 * - firebase.config.js: Firebase configuration constants only
 * - This file: App-wide constants and runtime configuration
 * 
 * Firebase initialization is handled by the entry point (main.js or index.html).
 */
'use strict';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   FIREBASE CONFIGURATION (single source of truth in firebase-config.js)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// FIREBASE_CONFIG is defined in firebase-config.js (loaded before this file)
if (typeof FIREBASE_CONFIG === 'undefined') {
  if (window.__DEBUG__) console.error('[Config] firebase-config.js must be loaded before config.js');
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   APP CONSTANTS
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const APP_CONSTANTS = Object.freeze({
  FCM_VAPID_KEY: "BDVoTx6AbM3T_AdVKV6IYFt3bbXiWRF5I7c5s-4w5AuUvYIzYPQYiODmJxnjH0DOLj-NhL83jiKMQ6RjkCvUALQ",
  TURN_CREDENTIALS_ENDPOINT: "https://us-central1-my-team-chat-2255.cloudfunctions.net/getTurnCredentials",
  VERIFIED_USER_LOOKUP_ENDPOINT: "https://asia-south1-my-team-chat-2255.cloudfunctions.net/lookupVerifiedUserByEmailV2",
  GROUP_ACCESS_REPAIR_ENDPOINT: "https://us-central1-my-team-chat-2255.cloudfunctions.net/repairGroupAccessMetadata",
  /* Cloudinary removed â€” all uploads use Firebase Storage (100% free) */
  MEETING_SCHEDULER_ENDPOINT: "https://us-central1-my-team-chat-2255.cloudfunctions.net/scheduleMeeting",
  YOUTUBE_SEARCH_ENDPOINT: "https://us-central1-my-team-chat-2255.cloudfunctions.net/youtubeSearch",
  AVATAR_MAX_BYTES: 5 * 1024 * 1024,
  AVATAR_ALLOWED_EXTENSIONS: ["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif"],
  AVATAR_ALLOWED_MIME_TYPES: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/heic", "image/heif"],
  AVATAR_FORMAT_HELP_TEXT: "Supported image formats: JPG, JPEG, PNG, WebP, GIF, BMP, HEIC, HEIF. Maximum size: 5 MB.",
  MESSAGE_PAGE_SIZE: 120,
  GROUP_CALL_MAX_PARTICIPANTS: 32,
  GROUP_CALL_VIDEO_RENDER_BUDGET: 9,
  GROUP_CALL_VIDEO_RENDER_BUDGET_MOBILE: 6,
  DEFAULT_RTC_CONFIG: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  },
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PRIVACY SETTINGS (user-configurable)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

let privacySettings = {
  hideReadReceipts: false,
  hideTypingIndicator: false,
  hideLastSeen: false,
};

let chatWallpapers = {};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   FIREBASE INITIALIZATION (lazy â€” called once)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

let _firebaseInitialized = false;

function initFirebase() {
  if (_firebaseInitialized) return;
  if (typeof firebase === 'undefined') {
    if (window.__DEBUG__) console.error('[Config] Firebase SDK not loaded');
    return;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  window.App = window.App || {};
  window.db = window.App.db = firebase.firestore();
  window.firestore = window.db;
  _firebaseInitialized = true;
  document.dispatchEvent(new CustomEvent('nsl:firebase-ready'));
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TURN SERVER CONFIGURATION
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

var _turnCache = { servers: null, timestamp: 0, TTL: 5 * 60 * 1000 };

async function getBackendTurnServers() {
  if (!window.currentUser) return [];
  var now = Date.now();
  if (_turnCache.servers && (now - _turnCache.timestamp) < _turnCache.TTL) {
    return _turnCache.servers;
  }
  try {
    const token = await window.currentUser.getIdToken();
    const response = await fetch(APP_CONSTANTS.TURN_CREDENTIALS_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!response.ok) throw new Error('TURN backend returned ' + response.status);
    const iceServers = await response.json();
    if (!Array.isArray(iceServers) || !iceServers.length) throw new Error('TURN backend returned no servers');
    _turnCache.servers = iceServers;
    _turnCache.timestamp = now;
    return iceServers;
  } catch (error) {
    if (window.__DEBUG__) console.warn('[Config] Could not load TURN servers:', error);
    if (_turnCache.servers) return _turnCache.servers;
    return [];
  }
}

async function getRtcConfig() {
  const backendTurnServers = await getBackendTurnServers();
  if (backendTurnServers.length) return { iceServers: backendTurnServers };

  try {
    const configuredServers = JSON.parse(localStorage.getItem('teamChatTurnServers') || '[]');
    if (Array.isArray(configuredServers) && configuredServers.length) {
      return { iceServers: [...APP_CONSTANTS.DEFAULT_RTC_CONFIG.iceServers, ...configuredServers] };
    }
  } catch (error) {
    if (window.__DEBUG__) console.warn('[Config] Invalid TURN server config:', error);
  }
  return APP_CONSTANTS.DEFAULT_RTC_CONFIG;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PLATFORM DETECTION
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const isNativeAndroidApp =
  window.Capacitor?.isNativePlatform?.() === true &&
  window.Capacitor?.getPlatform?.() === 'android';

const isNativeIOSApp =
  window.Capacitor?.isNativePlatform?.() === true &&
  window.Capacitor?.getPlatform?.() === 'ios';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   GLOBAL STATE (backward compatibility)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

window.__DEBUG__ = window.__DEBUG__ || false;
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.FcmVapidKey = APP_CONSTANTS.FCM_VAPID_KEY;
window.TURN_CREDENTIALS_ENDPOINT = APP_CONSTANTS.TURN_CREDENTIALS_ENDPOINT;
window.VERIFIED_USER_LOOKUP_ENDPOINT = APP_CONSTANTS.VERIFIED_USER_LOOKUP_ENDPOINT;
window.GROUP_ACCESS_REPAIR_ENDPOINT = APP_CONSTANTS.GROUP_ACCESS_REPAIR_ENDPOINT;
window.AVATAR_MAX_BYTES = APP_CONSTANTS.AVATAR_MAX_BYTES;
window.AVATAR_ALLOWED_EXTENSIONS = APP_CONSTANTS.AVATAR_ALLOWED_EXTENSIONS;
window.AVATAR_ALLOWED_MIME_TYPES = APP_CONSTANTS.AVATAR_ALLOWED_MIME_TYPES;
window.AVATAR_FORMAT_HELP_TEXT = APP_CONSTANTS.AVATAR_FORMAT_HELP_TEXT;
window.MEETING_SCHEDULER_ENDPOINT = APP_CONSTANTS.MEETING_SCHEDULER_ENDPOINT;
window.YOUTUBE_SEARCH_ENDPOINT = APP_CONSTANTS.YOUTUBE_SEARCH_ENDPOINT;
window.GROUP_CALL_MAX_PARTICIPANTS = APP_CONSTANTS.GROUP_CALL_MAX_PARTICIPANTS;
window.MESSAGE_PAGE_SIZE = APP_CONSTANTS.MESSAGE_PAGE_SIZE;
window.privacySettings = privacySettings;
window.chatWallpapers = chatWallpapers;
window.getRtcConfig = getRtcConfig;
window.getBackendTurnServers = getBackendTurnServers;
window.initFirebase = initFirebase;
initFirebase();

if (isNativeAndroidApp) document.body.classList.add('native-android');
if (isNativeIOSApp) document.body.classList.add('native-ios');

window.isNativeAndroidApp = isNativeAndroidApp;
window.isNativeIOSApp = isNativeIOSApp;
