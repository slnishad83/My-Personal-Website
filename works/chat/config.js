/**
 * NSL Chat — Configuration Module
 * 
 * Separation of concerns:
 * - firebase.config.js: Firebase configuration constants only
 * - This file: App-wide constants and runtime configuration
 * 
 * Firebase initialization is handled by the entry point (main.js or index.html).
 */
'use strict';

/* ══════════════════════════════════════════════════════════════
   FIREBASE CONFIGURATION
   ══════════════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyCdbut_FdscAjl-OVSlAUhb7TOTiRNkh34",
  authDomain: "my-team-chat-2255.firebaseapp.com",
  projectId: "my-team-chat-2255",
  storageBucket: "my-team-chat-2255.firebasestorage.app",
  messagingSenderId: "805016891521",
  appId: "1:805016891521:web:ac9bc7a252bcf33686dd80",
});

/* ══════════════════════════════════════════════════════════════
   APP CONSTANTS
   ══════════════════════════════════════════════════════════════ */

const APP_CONSTANTS = Object.freeze({
  FCM_VAPID_KEY: "BDVoTx6AbM3T_AdVKV6IYFt3bbXiWRF5I7c5s-4w5AuUvYIzYPQYiODmJxnjH0DOLj-NhL83jiKMQ6RjkCvUALQ",
  TURN_CREDENTIALS_ENDPOINT: "https://us-central1-my-team-chat-2255.cloudfunctions.net/getTurnCredentials",
  VERIFIED_USER_LOOKUP_ENDPOINT: "https://asia-south1-my-team-chat-2255.cloudfunctions.net/lookupVerifiedUserByEmailV2",
  GROUP_ACCESS_REPAIR_ENDPOINT: "https://us-central1-my-team-chat-2255.cloudfunctions.net/repairGroupAccessMetadata",
  CLOUDINARY_CLOUD_NAME: "du2dsimyz",
  CLOUDINARY_UPLOAD_PRESET: "chat_app_uploads",
  AVATAR_MAX_BYTES: 5 * 1024 * 1024,
  AVATAR_ALLOWED_EXTENSIONS: ["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif"],
  AVATAR_ALLOWED_MIME_TYPES: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/heic", "image/heif"],
  AVATAR_FORMAT_HELP_TEXT: "Supported image formats: JPG, JPEG, PNG, WebP, GIF, BMP, HEIC, HEIF. Maximum size: 5 MB.",
  MESSAGE_PAGE_SIZE: 120,
  GROUP_CALL_MAX_PARTICIPANTS: 4,
  DEFAULT_RTC_CONFIG: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  },
});

/* ══════════════════════════════════════════════════════════════
   PRIVACY SETTINGS (user-configurable)
   ══════════════════════════════════════════════════════════════ */

let privacySettings = {
  hideReadReceipts: false,
  hideTypingIndicator: false,
  hideLastSeen: false,
};

let chatWallpapers = {};

/* ══════════════════════════════════════════════════════════════
   FIREBASE INITIALIZATION (lazy — called once)
   ══════════════════════════════════════════════════════════════ */

let _firebaseInitialized = false;

function initFirebase() {
  if (_firebaseInitialized) return;
  if (typeof firebase === 'undefined') {
    console.error('[Config] Firebase SDK not loaded');
    return;
  }
  firebase.initializeApp(FirebaseConfig);
  _firebaseInitialized = true;
  document.dispatchEvent(new CustomEvent('nsl:firebase-ready'));
}

/* ══════════════════════════════════════════════════════════════
   TURN SERVER CONFIGURATION
   ══════════════════════════════════════════════════════════════ */

async function getBackendTurnServers() {
  if (!window.currentUser) return [];
  try {
    const token = await window.currentUser.getIdToken();
    const response = await fetch(APP_CONSTANTS.TURN_CREDENTIALS_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!response.ok) throw new Error('TURN backend returned ' + response.status);
    const iceServers = await response.json();
    if (!Array.isArray(iceServers) || !iceServers.length) throw new Error('TURN backend returned no servers');
    return iceServers;
  } catch (error) {
    console.warn('[Config] Could not load TURN servers:', error);
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
    console.warn('[Config] Invalid TURN server config:', error);
  }
  return APP_CONSTANTS.DEFAULT_RTC_CONFIG;
}

/* ══════════════════════════════════════════════════════════════
   PLATFORM DETECTION
   ══════════════════════════════════════════════════════════════ */

const isNativeAndroidApp =
  window.Capacitor?.isNativePlatform?.() === true &&
  window.Capacitor?.getPlatform?.() === 'android';

const isNativeIOSApp =
  window.Capacitor?.isNativePlatform?.() === true &&
  window.Capacitor?.getPlatform?.() === 'ios';

/* ══════════════════════════════════════════════════════════════
   GLOBAL STATE (backward compatibility)
   ══════════════════════════════════════════════════════════════ */

window.__DEBUG__ = window.__DEBUG__ || false;
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.FIREBASE_CONFIG_KEYS = FIREBASE_CONFIG;
window.FcmVapidKey = APP_CONSTANTS.FCM_VAPID_KEY;
window.TURN_CREDENTIALS_ENDPOINT = APP_CONSTANTS.TURN_CREDENTIALS_ENDPOINT;
window.VERIFIED_USER_LOOKUP_ENDPOINT = APP_CONSTANTS.VERIFIED_USER_LOOKUP_ENDPOINT;
window.GROUP_ACCESS_REPAIR_ENDPOINT = APP_CONSTANTS.GROUP_ACCESS_REPAIR_ENDPOINT;
window.CLOUDINARY_CLOUD_NAME = APP_CONSTANTS.CLOUDINARY_CLOUD_NAME;
window.CLOUDINARY_UPLOAD_PRESET = APP_CONSTANTS.CLOUDINARY_UPLOAD_PRESET;
window.TURN_CREDENTIALS_ENDPOINT = APP_CONSTANTS.TURN_CREDENTIALS_ENDPOINT;
window.AVATAR_MAX_BYTES = APP_CONSTANTS.AVATAR_MAX_BYTES;
window.AVATAR_ALLOWED_EXTENSIONS = APP_CONSTANTS.AVATAR_ALLOWED_EXTENSIONS;
window.AVATAR_ALLOWED_MIME_TYPES = APP_CONSTANTS.AVATAR_ALLOWED_MIME_TYPES;
window.AVATAR_FORMAT_HELP_TEXT = APP_CONSTANTS.AVATAR_FORMAT_HELP_TEXT;
window.MEETING_SCHEDULER_ENDPOINT = APP_CONSTANTS.MEETING_SCHEDULER_ENDPOINT;
window.GROUP_CALL_MAX_PARTICIPANTS = APP_CONSTANTS.GROUP_CALL_MAX_PARTICIPANTS;
window.MESSAGE_PAGE_SIZE = APP_CONSTANTS.MESSAGE_PAGE_SIZE;
window.privacySettings = privacySettings;
window.chatWallpapers = chatWallpapers;
window.getRtcConfig = getRtcConfig;
window.getBackendTurnServers = getBackendTurnServers;
window.initFirebase = initFirebase;

if (isNativeAndroidApp) document.body.classList.add('native-android');
if (isNativeIOSApp) document.body.classList.add('native-ios');

window.isNativeAndroidApp = isNativeAndroidApp;
window.isNativeIOSApp = isNativeIOSApp;
