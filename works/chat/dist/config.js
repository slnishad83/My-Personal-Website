/**
 * @typedef {Object} AppUser
 * @property {string} uid
 * @property {string} [displayName]
 * @property {string} [email]
 * @property {string} [photoURL]
 * @property {string} [phoneNumber]
 */

// ========================================
// COMPLETE CHAT APP - FINAL BEST WEB/PWA VERSION
// All WhatsApp features + extras
// Works on all devices, all browsers
// ========================================
'use strict';
window.__DEBUG__ = window.__DEBUG__ || false;

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCdbut_FdscAjl-OVSlAUhb7TOTiRNkh34",
  authDomain: "my-team-chat-2255.firebaseapp.com",
  projectId: "my-team-chat-2255",
  storageBucket: "my-team-chat-2255.firebasestorage.app",
  messagingSenderId: "805016891521",
  appId: "1:805016891521:web:ac9bc7a252bcf33686dd80",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

function isLikelyPrivateSession() {
  try {
    const testKey = "teamChatStorageProbe";
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return false;
  } catch (error) {
    return true;
  }
}

function getAuthPersistence() {
  return isLikelyPrivateSession()
    ? firebase.auth.Auth.Persistence.SESSION
    : firebase.auth.Auth.Persistence.LOCAL;
}

const authPersistenceReady = Promise.race([
  auth.setPersistence(getAuthPersistence()),
  new Promise((resolve) => setTimeout(resolve, 1000)),
]).then(() => {
  if (typeof window.showToast === 'function' && !isLikelyPrivateSession()) return;
}).catch((error) => {
  console.error("Persistence error:", error);
  if (typeof window.showToast === 'function') {
    window.showToast('Login session storage unavailable. You may need to sign in again after closing the app.', 'error');
  }
});

window.addEventListener("beforeunload", () => {
  if (typeof stopSessionHeartbeat === 'function') stopSessionHeartbeat();
  if (typeof saveCallState === 'function') saveCallState();
});

const db = firebase.firestore();
    // Firestore offline persistence — shows cached messages when offline.
    // Must be called before any other Firestore operations.
    db.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
    if (err.code === 'failed-precondition') {
      console.warn('[Firestore] Offline persistence unavailable (multiple tabs open).');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firestore] Offline persistence not supported in this browser.');
    }
    });

// Signal to addons that core Firebase services are ready
document.dispatchEvent(new CustomEvent('nsl:app-ready'));
const storage = firebase.storage();
const isNativeAndroidApp =
  window.Capacitor?.isNativePlatform?.() === true &&
  window.Capacitor?.getPlatform?.() === "android";

if (isNativeAndroidApp) {
  document.body.classList.add("native-android");
}

const isNativeIOSApp =
  window.Capacitor?.isNativePlatform?.() === true &&
  window.Capacitor?.getPlatform?.() === "ios";

if (isNativeIOSApp) {
  document.body.classList.add("native-ios");
}

const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;
// Firebase Cloud Messaging (FCM)
// IMPORTANT: replace this with your Firebase Console > Project settings > Cloud Messaging > Web Push certificate public key.
const FCM_VAPID_KEY =
  "BDVoTx6AbM3T_AdVKV6IYFt3bbXiWRF5I7c5s-4w5AuUvYIzYPQYiODmJxnjH0DOLj-NhL83jiKMQ6RjkCvUALQ";
let messaging = null;
let pushSetupStarted = false;
let pushSetupDone = false;
const recentCallNotificationKeys = new Map();

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = "du2dsimyz";
const CLOUDINARY_UPLOAD_PRESET = "chat_app_uploads";
const TURN_CREDENTIALS_ENDPOINT =
  "https://us-central1-my-team-chat-2255.cloudfunctions.net/getTurnCredentials";
const VERIFIED_USER_LOOKUP_ENDPOINT =
  "https://asia-south1-my-team-chat-2255.cloudfunctions.net/lookupVerifiedUserByEmailV2";
const GROUP_ACCESS_REPAIR_ENDPOINT =
  "https://us-central1-my-team-chat-2255.cloudfunctions.net/repairGroupAccessMetadata";
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "heic",
  "heif",
];
const AVATAR_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/heic",
  "image/heif",
];
const AVATAR_FORMAT_HELP_TEXT =
  "Supported image formats: JPG, JPEG, PNG, WebP, GIF, BMP, HEIC, HEIF. Maximum size: 5 MB.";
// Global Variables
let currentUser = null;
let currentChat = null;
let currentChatType = null;
let allUsers = [];
let messagesUnsubscribe = null;
let typingUnsubscribe = null;
let directChatsUnsubscribe = null;
let groupChatsUnsubscribe = null;
let usersUnsubscribe = null;
let allUsersReadyPromise = null;
let chatRequestsUnsubscribe = null;
let sentChatRequestsUnsubscribe = null;
let groupInvitesUnsubscribe = null;
let statusesUnsubscribe = null;
let outgoingCallsListUnsubscribe = null;
let incomingCallsListUnsubscribe = null;
let groupCallsListUnsubscribe = null;
let currentGroup = null;
let currentGroupMembers = [];
let currentReplyTo = null;
let currentAttachment = null;
let typingTimeout = null;
let blockedUsers = [];
let mutedChats = [];
let quickReplies = [];
let pinnedMessages = [];
let currentSearchResults = [];
let currentSearchIndex = 0;
let currentInChatSearchTerm = "";
let favoriteChatIds = [];
let pinnedChatIds = [];
let currentForwardTargets = [];
let currentForwardSelectionKeys = new Set();
let currentForwardSelectionMap = new Map();
let activeStatusSet = [];
let activeStatusIndex = 0;
let statusAutoAdvanceTimer = null;
let mentionSuggestionItems = [];
let mentionSuggestionRange = null;
let mentionSuggestionIndex = -1;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let recordingTimer = null;
let wallpaperModalMode = "global";
let chatListRefreshTimer = null;
let scheduledMessagesTimer = null;
let statusImageAttachment = null;
let activeCall = null;
let peerConnection = null;
let localCallStream = null;
let remoteCallStream = null;
let incomingCallsUnsubscribe = null;
let callDocUnsubscribe = null;
let callAnswerUnsubscribe = null;
let callCandidatesUnsubscribe = null;
let currentCallType = "voice";
let micMuted = false;
let cameraOff = false;
let speakerOn = false;
let preferredCameraFacingMode = "user";
let pendingRemoteIceCandidates = [];
let activeCallMode = null;
let callTimeoutTimer = null;
let callStartedAt = null;
let callDurationTimer = null;
let callHeartbeatTimer = null;
let ringtoneAudioContext = null;
let ringtoneTimer = null;
let vibrationTimer = null;
let wakeLock = null;
let cameraSender = null;
let callLogWritten = false;
let lastHandledRenegotiationSdp = "";
let seenPendingChatRequestIds = new Set();
let seenSentChatRequestIds = new Set();
let seenPendingGroupInviteIds = new Set();
let chatRequestListenerReady = false;
let sentChatRequestListenerReady = false;
let groupInviteListenerReady = false;
let mobileBackGuardReady = false;
let mobileChatHistoryOpen = false;
let lastSearchValue = "";
let currentViewTab = "all";
let isScreenSharing = false;
let isPipActive = false;
let chatTags = {};
let videoRecorder = null;
let videoChunks = [];
let isVideoRecording = false;
let videoRecordingStartTime = null;
let videoRecordingTimer = null;
let pendingRecordedMedia = null;
let activeVoicePlayback = null;
let callMiniBar = null;
let callNetworkFailTimer = null;
let callIceRestartTimer = null;
let isIceRestarting = false;
let callRenegotiationTimer = null;
let isSpeakerView = false;
let callHistoryLoadToken = 0;
let callHistoryRefreshTimer = null;
let statusRefreshTimer = null;
let callHistorySelectionMode = false;
let callHistoryFilter = "all";
let selectedCallHistoryIds = new Set();
let currentSessionId = "";
let groupCallsUnsubscribe = null;
let groupCallPeerConnections = new Map();
let groupCallCandidateUnsubscribes = [];
let groupCallDocUnsubscribe = null;
let activeGroupCallParticipants = [];
const GROUP_CALL_MAX_PARTICIPANTS = 4;
let sessionHeartbeatTimer = null;
let sessionWatchUnsubscribe = null;
let presenceHeartbeatTimer = null;
let appUnlockedForSession = false;
let systemBackHandlerReady = false;
const MESSAGE_PAGE_SIZE = 120;
const messageRenderLimits = new Map();
let failedQueueRetryTimer = null;
let currentBroadcasts = [];
let currentBroadcastUnsubscribe = null;
let currentBroadcastMessagesUnsubscribe = null;
let broadcastSelectedMemberIds = new Set();
let chatFolders = [];
let currentFolderIndex = -1;
let activeFolderChatIds = null;
let lastReadTimestamps = new Map();
let lastMessageTimestamps = new Map();

let blockedWordsCache = [];
let currentJoinQuestions = [];
let pendingJoinGroupId = null;
let lockedChats = new Map();
let lockPinVerifiedForSearch = false;
let temporarilyUnlockedChatId = null;
let lockedChatFolderVisible = false;

const defaultRtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

async function getBackendTurnServers() {
  if (!currentUser) return [];

  const token = await currentUser.getIdToken();
  const response = await fetch(TURN_CREDENTIALS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`TURN backend returned ${response.status}`);
  }

  const iceServers = await response.json();
  if (!Array.isArray(iceServers) || !iceServers.length) {
    throw new Error("TURN backend returned no servers");
  }

  return iceServers;
}

async function getRtcConfig() {
  try {
    const backendTurnServers = await getBackendTurnServers();
    if (backendTurnServers.length) return { iceServers: backendTurnServers };
  } catch (error) {
    console.warn("Could not load secure TURN config:", error);
  }

  try {
    const configuredServers = JSON.parse(
      localStorage.getItem("teamChatTurnServers") || "[]",
    );
    if (Array.isArray(configuredServers) && configuredServers.length) {
      return {
        iceServers: [...defaultRtcConfig.iceServers, ...configuredServers],
      };
    }
  } catch (error) {
    console.warn("Invalid TURN server config:", error);
  }
  return defaultRtcConfig;
}

function updateTurnServerSettings() {
  window.location.replace("turn.html");
}

let callWaitingUnsub = null;
// Privacy Settings
let privacySettings = {
  hideReadReceipts: false,
  hideTypingIndicator: false,
  hideLastSeen: false,
};

// Wallpaper Settings (per chat)
let chatWallpapers = {};

/* ── NP2: Firestore listener dedup guard ───────────────────── */
const _activeListeners = new Map();
function dedupFirestoreListener(key, subscribeFn) {
  if (_activeListeners.has(key)) {
    console.warn(`[Firestore] Duplicate listener suppressed: ${key}`);
    return _activeListeners.get(key);
  }
  const unsub = subscribeFn();
  _activeListeners.set(key, unsub);
  return unsub;
}
function removeDedupListener(key) {
  const unsub = _activeListeners.get(key);
  if (unsub) { try { unsub(); } catch (_) {} _activeListeners.delete(key); }
}

/* ── H5: Rate limiter for message sends ─────────────────────────── */
const _msgRateLimiter = {
  _timestamps: [],
  _maxPerMinute: 30,
  _cooldownMs: 2000,
  canSend() {
    const now = Date.now();
    this._timestamps = this._timestamps.filter(t => now - t < 60000);
    if (this._timestamps.length >= this._maxPerMinute) return false;
    if (this._timestamps.length > 0 && now - this._timestamps[this._timestamps.length - 1] < this._cooldownMs) return false;
    return true;
  },
  record() {
    this._timestamps.push(Date.now());
    if (this._timestamps.length > this._maxPerMinute + 10) {
      this._timestamps = this._timestamps.slice(-this._maxPerMinute);
    }
  },
  reset() { this._timestamps = []; }
};
window._msgRateLimiter = _msgRateLimiter;

/* ── BR1: Pause/resume Firestore listeners in background ───── */
let _bgPaused = false;
let _bgPauseTimer = null;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    _bgPauseTimer = setTimeout(() => {
      _bgPaused = true;
      if (window.__DEBUG__) console.log('[App] Background — pausing non-critical listeners');
      if (typeof window.pauseBackgroundListeners === 'function') window.pauseBackgroundListeners();
    }, 30000);
  } else {
    clearTimeout(_bgPauseTimer);
    if (_bgPaused) {
      _bgPaused = false;
      if (window.__DEBUG__) console.log('[App] Foreground — resuming listeners');
      if (typeof window.resumeBackgroundListeners === 'function') window.resumeBackgroundListeners();
    }
  }
});

/* ── C3: Release wake lock when call ends or page hidden ───── */
function releaseWakeLock() {
  if (window.wakeLock) {
    try { window.wakeLock.release(); } catch (_) {}
    window.wakeLock = null;
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') releaseWakeLock();
});
