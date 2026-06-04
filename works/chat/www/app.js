// ========================================
// COMPLETE CHAT APP - FINAL BEST WEB/PWA VERSION
// All WhatsApp features + extras
// Works on all devices, all browsers
// ========================================

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
  new Promise((resolve) => setTimeout(resolve, 3000)),
]).catch((error) => {
  console.error("Persistence error:", error);
});

window.addEventListener("beforeunload", () => {
  stopSessionHeartbeat();
});

const db = firebase.firestore();
const storage = firebase.storage();
const isNativeAndroidApp =
  window.Capacitor?.isNativePlatform?.() === true &&
  window.Capacitor?.getPlatform?.() === "android";

if (isNativeAndroidApp) {
  document.body.classList.add("native-android");
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
const AUTH_DIRECTORY_FALLBACKS = [
  { id: "ArOfySQ0wBbemcCpwxQKaybBFmA2", email: "rakeshjit18@gmail.com" },
  { id: "N5KfNSSYXDYbbevELbuhpgS06Ez1", email: "alwynwilson187@gmail.com" },
  { id: "w8yFWAJS3aRgBlcRPV9ta7ig52M2", email: "ashwatitharavath@gmail.com" },
  { id: "gXTqQwmqmjhicXVwUqLauTqXw8O2", email: "halid480@gmail.com" },
  { id: "eAgAyBTqvwdnuiNremGtig4gbE1", email: "sl.nishad@gmail.com" },
];

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
let groupInvitesUnsubscribe = null;
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
let callCandidatesUnsubscribe = null;
let currentCallType = "voice";
let micMuted = false;
let cameraOff = false;
let preferredCameraFacingMode = "user";
let pendingRemoteIceCandidates = [];
let activeCallMode = null;
let callTimeoutTimer = null;
let callStartedAt = null;
let callDurationTimer = null;
let ringtoneAudioContext = null;
let ringtoneTimer = null;
let vibrationTimer = null;
let wakeLock = null;
let cameraSender = null;
let callLogWritten = false;
let lastHandledRenegotiationSdp = "";
let seenPendingChatRequestIds = new Set();
let seenPendingGroupInviteIds = new Set();
let chatRequestListenerReady = false;
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
let callMiniBar = null;
let callNetworkFailTimer = null;
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
let draggedChatItem = null;
let blockedWordsCache = [];
let currentJoinQuestions = [];
let pendingJoinGroupId = null;

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

// Privacy Settings
let privacySettings = {
  hideReadReceipts: false,
  hideTypingIndicator: false,
  hideLastSeen: false,
};

// Wallpaper Settings (per chat)
let chatWallpapers = {};

// ========================================
// HELPER FUNCTIONS
// ========================================

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  toast.setAttribute("aria-atomic", "true");
  toast.textContent = message;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function applyA11yEnhancements() {
  document.querySelectorAll("button").forEach((button) => {
    const hasVisibleLabel = (button.textContent || "").trim().length > 0;
    const hasAriaLabel =
      (button.getAttribute("aria-label") || "").trim().length > 0;
    if (!hasVisibleLabel && !hasAriaLabel) {
      const fallback = (button.getAttribute("title") || "").trim();
      if (fallback) button.setAttribute("aria-label", fallback);
    }
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    if (!modal.getAttribute("role")) modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
  });
}

function closeTopVisibleModal() {
  const visibleModals = Array.from(document.querySelectorAll(".modal")).filter(
    (modal) => {
      const styles = window.getComputedStyle(modal);
      return styles.display !== "none" && styles.visibility !== "hidden";
    },
  );
  if (!visibleModals.length) return false;

  const topModal = visibleModals[visibleModals.length - 1];
  if (topModal.id === "unlockModal" && !appUnlockedForSession) return false;
  if (topModal.id === "callModal" && hasLiveCallSession()) {
    minimizeActiveCallUi("navigation");
    return true;
  }
  if (topModal.id === "statusViewerModal") {
    closeStatusViewer();
    return true;
  }
  topModal.style.display = "none";
  return true;
}

function closeTransientOverlay() {
  const mentionBox = document.getElementById("mentionSuggestions");
  if (mentionBox && window.getComputedStyle(mentionBox).display !== "none") {
    hideMentionSuggestions();
    return true;
  }

  const emojiPicker = document.getElementById("emojiPicker");
  if (
    emojiPicker?.classList.contains("show") ||
    emojiPicker?.style.display === "block"
  ) {
    emojiPicker.classList.remove("show");
    emojiPicker.style.display = "none";
    return true;
  }

  const inChatSearch = document.getElementById("inChatSearchBar");
  if (inChatSearch?.style.display === "flex") {
    document.getElementById("closeSearchBtn")?.click();
    return true;
  }

  const archivedMenu = document.getElementById("archivedRowMenu");
  if (archivedMenu?.style.display === "block") {
    hideArchivedRowMenu();
    return true;
  }

  const chatMenu = document.getElementById("chatContextMenu");
  if (chatMenu?.style.display === "block") {
    chatMenu.style.display = "none";
    return true;
  }

  if (document.querySelector(".message-context-menu")) {
    removeMessageContextMenu();
    return true;
  }

  const replyBar = document.getElementById("replyPreviewBar");
  if (replyBar?.style.display !== "none" && currentReplyTo) {
    currentReplyTo = null;
    replyBar.style.display = "none";
    return true;
  }

  return false;
}

function handleSystemBackNavigation({ fromPopState = false } = {}) {
  if (closeTopVisibleModal()) return true;
  if (closeTransientOverlay()) return true;

  if (hasLiveCallSession()) {
    minimizeActiveCallUi("navigation");
    return true;
  }

  if (activeCall && activeCallMode !== "incoming") {
    minimizeActiveCallUi("navigation");
    return true;
  }

  if (isChatPanelOpen()) {
    closeMobileChatPanel({ fromPopState });
    return true;
  }

  return false;
}

function setupSystemBackNavigation() {
  if (systemBackHandlerReady) return;
  systemBackHandlerReady = true;

  window.Capacitor?.Plugins?.App?.addListener?.(
    "backButton",
    ({ canGoBack } = {}) => {
      if (handleSystemBackNavigation()) return;

      const AppPlugin = window.Capacitor?.Plugins?.App;
      if (canGoBack) {
        history.back();
      } else if (AppPlugin?.exitApp) {
        AppPlugin.exitApp();
      }
    },
  );
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeRegExp(text = "") {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getInitials(name = "", fallback = "") {
  const source = String(name || fallback || "").trim();
  if (!source) return "U";
  const normalizedEmail = String(fallback || source).trim().toLowerCase();
  const normalizedName = String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (
    normalizedEmail === "sl.nishad@gmail.com" ||
    normalizedEmail === "sl.nishad@gmail.co" ||
    normalizedName === "nishad s l"
  ) {
    return "NSL";
  }
  if (source.includes("@")) {
    const local = source.split("@")[0].replace(/[^a-z0-9]+/gi, " ").trim();
    return local.slice(0, 2).toUpperCase() || "U";
  }
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts[1].length > 1) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase() || "U";
  }
  return parts[0]?.slice(0, 2).toUpperCase() || "U";
}

function getFileNameFromUrl(url) {
  if (!url) return "";
  try {
    const path = new URL(url).pathname;
    const lastPart = decodeURIComponent(path.split("/").pop() || "");
    return lastPart || "";
  } catch (error) {
    const cleanUrl = String(url).split("?")[0];
    return decodeURIComponent(cleanUrl.split("/").pop() || "");
  }
}

function getFileExtension(filename = "", url = "") {
  const source = filename || getFileNameFromUrl(url);
  const match = source.match(/\.([a-z0-9]{1,8})$/i);
  return match ? match[1].toUpperCase() : "FILE";
}

function getAttachmentLabel(attachment = {}) {
  if (attachment.type === "image") return "Image";
  if (attachment.type === "gif") return "GIF";
  if (attachment.type === "voice") return "Voice message";
  const ext = getFileExtension(attachment.filename, attachment.url);
  if (ext === "PDF") return "PDF document";
  if (["DOC", "DOCX"].includes(ext)) return "Word document";
  if (["XLS", "XLSX", "CSV"].includes(ext)) return `${ext} spreadsheet`;
  if (["PPT", "PPTX"].includes(ext)) return "Presentation";
  if (["ZIP", "RAR", "7Z"].includes(ext)) return "Archive";
  return `${ext} file`;
}

function renderAttachment(attachment = {}) {
  if (!attachment.url) return "";
  if (!/^https?:\/\//i.test(attachment.url)) return "";
  const url = escapeHtml(attachment.url);
  const filename = escapeHtml(
    attachment.filename || getFileNameFromUrl(attachment.url) || "Attachment",
  );
  const viewOnceHtml = attachment.viewOnce
    ? '<span class="view-once-badge">View Once</span>'
    : "";

  if (attachment.type === "image" || attachment.type === "gif") {
    if (attachment.viewOnce) {
      return `<div class="message-attachment view-once-container"><button type="button" class="view-once-placeholder" data-view-once-url="${url}" data-filename="${filename}"><span class="view-once-icon">👁️</span><span>Tap to view</span></button></div>`;
    }
    return `<div class="message-attachment"><a class="image-attachment-link" href="${url}" target="_blank" rel="noopener" data-preview-url="${url}" data-filename="${filename}"><img src="${url}" alt="${filename}" loading="lazy" onerror="this.closest('.message-attachment')?.classList.add('is-broken'); this.remove();"><span class="attachment-image-fallback">Image unavailable</span></a>${viewOnceHtml}</div>`;
  }

  if (attachment.type === "video") {
    return `<div class="message-attachment video-attachment"><video src="${url}" controls playsinline preload="metadata"></video>${viewOnceHtml}</div>`;
  }

  if (attachment.type === "voice") {
    const duration = Number(attachment.duration) || 0;
    return `<div class="voice-message"><button class="voice-play-btn" data-url="${url}" type="button">Play</button><div class="voice-waveform"></div><span class="voice-duration">${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}</span></div>`;
  }

  const ext = getFileExtension(attachment.filename, attachment.url);
  const detail = [getAttachmentLabel(attachment), formatBytes(attachment.size)]
    .filter(Boolean)
    .join(" · ");
  return `
    <a class="file-attachment-card" href="${url}" target="_blank" rel="noopener" data-preview-url="${url}" data-filename="${filename}">
      <span class="file-attachment-icon">${escapeHtml(ext)}</span>
      <span class="file-attachment-info">
        <span class="file-attachment-name">${filename}</span>
        <span class="file-attachment-meta">${escapeHtml(detail || "File")}</span>
      </span>
      <span class="file-attachment-action">Download</span>
    </a>
  `;
}

function findUrls(text) {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s<]+[^\s<.,;:!?)">\]]+)/gi;
  return text.match(urlRegex) || [];
}

function renderLinkPreview(preview = {}) {
  if (!preview || !preview.url) return "";
  const image = preview.image
    ? `<img src="${escapeHtml(preview.image)}" alt="" class="link-preview-image" onerror="this.style.display='none'">`
    : "";
  return `<div class="link-preview"><a href="${escapeHtml(preview.url)}" target="_blank" rel="noopener noreferrer" class="link-preview-link">${image}<div class="link-preview-text"><strong class="link-preview-title">${escapeHtml(preview.title || preview.url)}</strong>${preview.description ? `<span class="link-preview-desc">${escapeHtml(preview.description.substring(0, 100))}</span>` : ""}<span class="link-preview-domain">${escapeHtml(new URL(preview.url).hostname)}</span></div></a></div>`;
}

const linkPreviewCache = new Map();

async function fetchLinkPreview(url) {
  if (linkPreviewCache.has(url)) return linkPreviewCache.get(url);
  try {
    const res = await fetch(
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) {
      linkPreviewCache.set(url, null);
      return null;
    }
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const getMeta = (prop) => {
      const el =
        doc.querySelector(`meta[property="${prop}"]`) ||
        doc.querySelector(`meta[name="${prop}"]`);
      return el?.getAttribute("content") || "";
    };
    const title =
      getMeta("og:title") || doc.querySelector("title")?.textContent || "";
    const description =
      getMeta("og:description") || getMeta("description") || "";
    const image = getMeta("og:image") || "";
    const preview = {
      url,
      title: title.substring(0, 200),
      description: description.substring(0, 300),
      image,
    };
    linkPreviewCache.set(url, preview);
    return preview;
  } catch (e) {
    linkPreviewCache.set(url, null);
    return null;
  }
}

async function tryAttachLinkPreview(messageId, msgData) {
  if (!messageId || msgData.linkPreview) return;
  const text = msgData.text || "";
  const urls = findUrls(text);
  if (!urls.length) return;
  const preview = await fetchLinkPreview(urls[0]);
  if (!preview) return;
  try {
    await db
      .collection("messages")
      .doc(messageId)
      .update({ linkPreview: preview });
  } catch (e) {
    /* best-effort */
  }
}

function renderLocationMessage(msg = {}) {
  const location = msg.location || {};
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return msg.text
      ? `<div class="message-text">${renderMessageText(msg.text, msg.mentions || [])}</div>`
      : "";
  }

  const lat = latitude.toFixed(6);
  const lng = longitude.toFixed(6);
  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return `
    <div class="location-card">
      <iframe src="${escapeHtml(embedUrl)}" loading="lazy" title="Shared location"></iframe>
      <div class="location-card-body">
        <strong>Shared location</strong>
        <span>${escapeHtml(lat)}, ${escapeHtml(lng)}</span>
        <div class="location-card-actions">
          <a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>
          <a href="${escapeHtml(osmUrl)}" target="_blank" rel="noopener">OpenStreetMap</a>
        </div>
      </div>
    </div>
  `;
}

function getCallIcon(type = "voice", status = "ended") {
  if (status === "missed" || status === "failed") return "!";
  if (status === "rejected") return "x";
  return type === "video" ? "VID" : "CALL";
}

function renderCallMessage(msg = {}) {
  const text = escapeHtml(
    msg.text ||
      getCallHistoryText(
        msg.callStatus || "ended",
        msg.callType || "voice",
        msg.callDurationMs || 0,
      ),
  );
  const icon = getCallIcon(msg.callType, msg.callStatus);
  return `<div class="message-bubble"><span>${icon}</span><span>${text}</span></div>`;
}

let activeDraftKey = "";
let currentForwardMessage = null;

function getSavedMessagesChatId() {
  return currentUser ? `saved_${currentUser.uid}` : "";
}

function getDraftStorageKey(
  chatId = currentChat?.id,
  chatType = currentChatType,
) {
  if (!currentUser || !chatId || !chatType) return "";
  return `nslChatDraft_${currentUser.uid}_${chatType}_${chatId}`;
}

function setActiveDraftKey() {
  activeDraftKey = getDraftStorageKey();
}

function getDraftTextForChat(chatId, chatType) {
  const key = getDraftStorageKey(chatId, chatType);
  if (!key) return "";
  return localStorage.getItem(key) || "";
}

function getDraftPreviewForItem(item = {}) {
  if (!currentUser || !item?.id) return "";
  if (item.type === "user") return "";

  const chatType = item.type === "saved" ? "direct" : item.type;
  if (!chatType) return "";

  const possibleIds = [
    item.id,
    item.otherUserId,
    ...(item.aliasDirectIds || []),
  ].filter(Boolean);

  let draftText = "";

  for (const id of possibleIds) {
    draftText = getDraftTextForChat(id, chatType).trim();
    if (draftText) break;
  }

  if (!draftText) return "";

  const compactText = draftText.replace(/\s+/g, " ").slice(0, 80);
  return `<span class="draft-label">Draft:</span> ${escapeHtml(compactText)}`;
}
function saveCurrentDraft() {
  const input = document.getElementById("messageInput");
  const key = activeDraftKey || getDraftStorageKey();
  if (!input || !key) return;

  const value = input.value || "";

  if (value.trim()) {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }

  if (currentChat) {
    scheduleChatListRefresh(150);
  }
}

function restoreCurrentDraft() {
  const input = document.getElementById("messageInput");
  const key = activeDraftKey || getDraftStorageKey();
  if (!input || !key) return;

  input.value = localStorage.getItem(key) || "";
  resizeMessageComposer();
}

function clearCurrentDraft() {
  const key = activeDraftKey || getDraftStorageKey();
  if (key) localStorage.removeItem(key);
  scheduleChatListRefresh(100);
}

function resizeMessageComposer() {
  const input = document.getElementById("messageInput");
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

function ensureDraftPreviewStyle() {
  if (document.getElementById("draftPreviewStyle")) return;
  const style = document.createElement("style");
  style.id = "draftPreviewStyle";
  style.textContent = `
    .draft-label {
      color: #d93025;
      font-weight: 700;
    }
  `;
  document.head.appendChild(style);
}

// ========================================
// CORE LIST RENDERING (Unified Fix)
// ========================================
function renderChatListItems(items, container) {
  ensureDraftPreviewStyle();
  container.innerHTML = "";
  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px;">
        <div>No chats yet. Search for people or create a group.</div>
        <button type="button" id="refreshChatListBtn" class="btn btn-outline" style="margin-top:12px;">Refresh chats</button>
      </div>
    `;
    container
      .querySelector("#refreshChatListBtn")
      ?.addEventListener("click", () => {
        loadCurrentChatList();
        loadArchivedChats();
      });
    return;
  }

  let lastSection = "";
  items.forEach((item) => {
    if (item.section && item.section !== lastSection) {
      const section = document.createElement("div");
      section.className = "search-section-label";
      section.textContent = item.section;
      container.appendChild(section);
      lastSection = item.section;
    }
    const chatDiv = document.createElement("div");
    chatDiv.className = "list-item";
    chatDiv.draggable = true;
    if (item.isPinned) chatDiv.classList.add("pinned");
    if (item.searchResultType)
      chatDiv.classList.add(`search-result-${item.searchResultType}`);
    chatDiv.dataset.chatId = item.id;
    chatDiv.dataset.chatType = item.type;
    chatDiv.dataset.unreadCount = item.unreadCount || 0;
    if (item.otherUserId || item.user?.id)
      chatDiv.dataset.otherUserId = item.otherUserId || item.user.id;
    chatDiv.dataset.chatName = item.name || "";
    chatDiv.dataset.aliasDirectIds = (item.aliasDirectIds || []).join(",");

    if (
      currentChat?.id === item.id &&
      (currentChatType === item.type ||
        (item.type === "saved" && currentChat?.isSaved))
    ) {
      chatDiv.classList.add("active");
    }

    const unread = item.unreadCount
      ? `<span class="unread-pill">${item.unreadCount}</span>`
      : "";
    const draftPreview = getDraftPreviewForItem(item);
    const normalPreview =
      item.searchResultType === "message"
        ? item.preview || ""
        : getChatListPreviewText(item.preview, item.type);
    const activeIds = [
      currentChat?.id,
      currentChat?.otherUserId,
      ...(currentChat?.aliasDirectIds || []),
    ]
      .filter(Boolean)
      .map(String);

    const rowIds = [item.id, item.otherUserId, ...(item.aliasDirectIds || [])]
      .filter(Boolean)
      .map(String);

    const isOpenChatRow =
      currentChat && rowIds.some((id) => activeIds.includes(id));

    const previewHtml = isOpenChatRow
      ? ""
      : draftPreview || escapeHtml(normalPreview);

    let statusChip = "";
    if (item.type === "user" && item.requestState) {
      statusChip = `<span class="status-chip ${item.requestState.status}">${escapeHtml(item.requestState.label)}</span>`;
    }

    const searchMeta =
      item.searchResultType === "message"
        ? '<span class="search-result-chip">Message</span>'
        : "";
    const tag = chatTags[item.id];
    const tagHtml = tag
      ? `<span class="chat-tag-dot" style="background:${escapeHtml(tag.color)}" title="${escapeHtml(tag.label)}"></span>`
      : "";
    chatDiv.innerHTML = `
      <span class="drag-handle" draggable="false">⠿</span>
      <div class="list-avatar">${item.avatar}</div>
      <div class="list-info" style="flex:1; cursor:pointer;">
        <div class="list-name">${tagHtml}${item.isPinned ? '<span class="pin-icon">&#x1F4CC;</span> ' : ""}${item.isFavorite ? "* " : ""}${escapeHtml(item.name)} ${item.isMuted ? "[Muted]" : ""}${searchMeta}</div>
        <div class="list-preview">${previewHtml}</div>
      </div>
      ${statusChip}
      ${unread}
      <button class="list-item-menu mute-chat-btn" data-chat-id="${item.id}" data-chat-type="${item.type}">${item.isMuted ? "Unmute" : "Mute"}</button>
      <button class="list-item-menu archive-chat-btn" data-chat-id="${item.id}" data-chat-type="${item.type}" data-chat-name="${escapeHtml(item.name)}">Arch</button>
    `;

    if (item.type === "user" || item.type === "saved") {
      chatDiv
        .querySelectorAll(".mute-chat-btn, .archive-chat-btn")
        .forEach((btn) => btn.remove());
    }

    chatDiv.addEventListener("dragstart", (e) => {
      draggedChatItem = item.id;
      e.dataTransfer.effectAllowed = "move";
      chatDiv.classList.add("dragging");
    });
    chatDiv.addEventListener("dragend", () => {
      chatDiv.classList.remove("dragging");
      container
        .querySelectorAll(".list-item")
        .forEach((el) => el.classList.remove("drag-over"));
    });
    chatDiv.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      container
        .querySelectorAll(".list-item")
        .forEach((el) => el.classList.remove("drag-over"));
      chatDiv.classList.add("drag-over");
    });
    chatDiv.addEventListener("dragleave", () => {
      chatDiv.classList.remove("drag-over");
    });
    chatDiv.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      chatDiv.classList.remove("drag-over");
      if (!draggedChatItem || draggedChatItem === item.id) return;
      const allItems = Array.from(container.querySelectorAll(".list-item"));
      const dragIdx = allItems.findIndex(
        (el) => el.dataset.chatId === draggedChatItem,
      );
      const dropIdx = allItems.findIndex((el) => el.dataset.chatId === item.id);
      if (dragIdx === -1 || dropIdx === -1) return;
      const orderedIds = allItems.map((el) => el.dataset.chatId);
      orderedIds.splice(dropIdx, 0, orderedIds.splice(dragIdx, 1)[0]);
      saveChatOrder(orderedIds);
      loadCurrentChatList();
    });

    chatDiv
      .querySelector(".archive-chat-btn")
      ?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm(`Archive "${item.name}"?`))
          await archiveChat(
            item.id,
            item.type,
            item.name,
            item.aliasDirectIds || [],
          );
      });

    chatDiv
      .querySelector(".mute-chat-btn")
      ?.addEventListener("click", async (e) => {
        e.stopPropagation();
        const activeMute = getActiveMuteRecord(item.id, item.type);
        if (activeMute) {
          await unmuteChat(activeMute.id);
          loadCurrentChatList();
          return;
        }
        const duration = prompt("Mute for: 1h, 8h, 24h, 7d, or always?", "8h");
        if (["1h", "8h", "24h", "7d", "always"].includes(duration)) {
          await muteChat(item.id, item.type, duration);
          loadCurrentChatList();
        }
      });

    chatDiv.addEventListener("click", async () => {
      try {
        if (item.type === "user") {
          await handleUserSelection(item.user || item.rawUser || item);
          return;
        }
        if (item.type === "saved") {
          startSavedMessages();
          return;
        }
        if (item.type === "group") {
          await loadGroupChat(item.id, item.name, item);
          return;
        }
        if (item.user) {
          await startDirectChat({
            ...item.user,
            directChatId: item.id,
            aliasDirectIds: item.aliasDirectIds,
            chatData: item.chatData || {},
            disappearAfterSecs: item.disappearAfterSecs || 0,
          });
          return;
        }
        let userData = {
          id: item.otherUserId,
          displayName: item.name,
          aliasDirectIds: item.aliasDirectIds,
          directChatId: item.id,
        };
        try {
          const doc = await db.collection("users").doc(item.otherUserId).get();
          if (doc.exists)
            userData = {
              id: item.otherUserId,
              ...doc.data(),
              aliasDirectIds: item.aliasDirectIds,
              directChatId: item.id,
            };
        } catch (error) {
          console.warn("Opening chat with list fallback profile:", error);
        }
        await startDirectChat(userData);
      } catch (err) {
        console.error("Chat click error:", err);
        showToast(
          "Could not open chat: " + (err.message || "unknown error"),
          "error",
        );
      }
    });

    container.appendChild(chatDiv);
  });
}

function getSavedMessagesItem() {
  const displayName = currentUser?.displayName || currentUser?.email || "Me";
  return {
    id: getSavedMessagesChatId(),
    type: "saved",
    name: "Saved Messages",
    avatar: "&#9733;",
    preview: `Private notes and files for ${displayName}`,
    unreadCount: 0,
    isFavorite: false,
    isPinned: false,
    isMuted: false,
    lastMessageTime: new Date(8640000000000000),
  };
}

function renderMessageText(text = "", mentions = []) {
  let html = escapeHtml(text);

  // 1. Mentions highlight
  mentions.forEach((mention) => {
    const label = escapeHtml(mention.label || mention.name || "");
    if (!label) return;
    const escapedPattern = escapeRegExp(label);
    html = html.replace(
      new RegExp(`@${escapedPattern}`, "g"),
      `<span class="mention-highlight">@${label}</span>`,
    );
  });

  // 2. WhatsApp-Style Markdown Formatting
  html = html.replace(
    /```([\s\S]+?)```/g,
    '<pre class="message-code-block">$1</pre>',
  );
  html = html.replace(
    /`([^`\n]+?)`/g,
    '<code class="message-inline-code">$1</code>',
  );
  html = html.replace(/\*([^\*\n]+?)\*/g, "<strong>$1</strong>");
  html = html.replace(/_([^_\n]+?)_/g, "<em>$1</em>");
  html = html.replace(/~([^~\n]+?)~/g, "<del>$1</del>");

  // 3. Hyperlink parsing
  const urlRegex =
    /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
  html = html.replace(
    urlRegex,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>',
  );

  return html;
}

function initializeEmojiPicker() {
  const picker = document.getElementById("emojiPicker");
  if (!picker) return;

  picker.innerHTML = "";

  // Create Category Bar
  const categoryBar = document.createElement("div");
  categoryBar.className = "emoji-picker-categories";

  const contentArea = document.createElement("div");
  contentArea.className = "emoji-picker-content";

  const categories = {
    Smileys: {
      icon: "😃",
      emojis: [
        "😀",
        "😃",
        "😄",
        "😁",
        "😆",
        "😅",
        "😂",
        "🤣",
        "😊",
        "😇",
        "🙂",
        "🙃",
        "😉",
        "😌",
        "😍",
        "🥰",
        "😘",
        "😗",
        "😙",
        "😚",
        "😋",
        "😛",
        "😝",
        "😜",
        "🤪",
        "🤨",
        "🧐",
        "🤓",
        "😎",
        "🤩",
        "🥳",
        "😏",
        "😒",
        "😞",
        "😔",
        "😟",
        "😕",
        "🙁",
        "☹️",
        "😢",
        "😭",
        "😤",
        "😠",
        "😡",
        "🤬",
        "🤯",
        "😳",
        "🥵",
        "🥶",
        "😱",
        "😨",
        "😰",
        "😥",
        "😓",
        "🤗",
        "🤔",
        "🤭",
        "🤫",
        "🤥",
      ],
    },
    Gestures: {
      icon: "👋",
      emojis: [
        "👋",
        "🤚",
        "🖐️",
        "✋",
        "🖖",
        "👌",
        "🤌",
        "🤏",
        "✌️",
        "🤞",
        "🤟",
        "🤘",
        "🤙",
        "👈",
        "👉",
        "👆",
        "👇",
        "👍",
        "👎",
        "✊",
        "👊",
        "🤛",
        "🤜",
        "👏",
        "🙌",
        "👐",
        "🤲",
        "🤝",
        "🙏",
        "✍️",
        "💪",
        "👀",
      ],
    },
    Animals: {
      icon: "🐱",
      emojis: [
        "🐶",
        "🐱",
        "🐭",
        "🐹",
        "🐰",
        "🦊",
        "🐻",
        "🐼",
        "🐨",
        "🐯",
        "🦁",
        "🐮",
        "🐷",
        "🐸",
        "🐵",
        "🐒",
        "🐔",
        "🐧",
        "🐦",
        "🐤",
        "🐝",
        "🐛",
        "🦋",
        "🐌",
        "🐞",
        "🐜",
        "🕷️",
        "🐙",
        "🐠",
        "🐬",
      ],
    },
    Food: {
      icon: "🍏",
      emojis: [
        "🍏",
        "🍎",
        "🍐",
        "🍊",
        "🍋",
        "🍌",
        "🍉",
        "🍇",
        "🍓",
        "🍒",
        "🍑",
        "🥭",
        "🍍",
        "🥥",
        "🥝",
        "🍅",
        "🍆",
        "🥑",
        "🥦",
        "🥒",
        "🌶️",
        "🍞",
        "🧀",
        "🍖",
        "🍗",
        "🍔",
        "🍟",
        "🍕",
        "🌭",
        "🍰",
        "🍩",
        "☕",
      ],
    },
    Activities: {
      icon: "⚽",
      emojis: [
        "⚽",
        "🏀",
        "🏈",
        "⚾",
        "🥎",
        "🎾",
        "🏐",
        "🎱",
        "🏓",
        "🏸",
        "🎯",
        "🎮",
        "🕹️",
        "🎨",
        "🎭",
        "🎤",
        "🎧",
        "🎸",
        "🎹",
        "🎬",
        "🚗",
        "🚲",
        "✈️",
        "🚀",
        "⛵",
        "⌚",
        "📱",
        "💻",
        "💡",
        "🔑",
        "❤️",
        "🔥",
      ],
    },
  };

  Object.entries(categories).forEach(([name, cat]) => {
    // 1. Create Category tab button
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "emoji-picker-category-tab";
    tab.textContent = cat.icon;
    tab.title = name;
    tab.addEventListener("click", () => {
      // Highlight active tab
      categoryBar
        .querySelectorAll(".emoji-picker-category-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Scroll to category section
      const targetSection = contentArea.querySelector(
        `[data-category="${name}"]`,
      );
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
    categoryBar.appendChild(tab);

    // 2. Create Category section in content
    const section = document.createElement("div");
    section.className = "emoji-picker-section";
    section.dataset.category = name;

    const title = document.createElement("div");
    title.className = "emoji-picker-section-title";
    title.textContent = name;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "emoji-picker-grid";

    cat.emojis.forEach((emoji) => {
      const span = document.createElement("span");
      span.textContent = emoji;
      span.addEventListener("click", (e) => {
        e.stopPropagation();
        const input = document.getElementById("messageInput");
        if (!input) return;

        // Insert emoji at cursor position
        const cursor = input.selectionStart ?? input.value.length;
        const before = input.value.slice(0, cursor);
        const after = input.value.slice(cursor);
        input.value = `${before}${emoji}${after}`;

        const newCursor = cursor + emoji.length;
        input.focus();
        input.setSelectionRange(newCursor, newCursor);

        saveCurrentDraft();
        resizeMessageComposer();
      });
      grid.appendChild(span);
    });

    section.appendChild(grid);
    contentArea.appendChild(section);
  });

  // Set first category active initially
  categoryBar.firstChild?.classList.add("active");

  picker.appendChild(categoryBar);
  picker.appendChild(contentArea);
}

function getMessageMentions(text = "") {
  if (currentChatType !== "group" || !text.includes("@")) return [];
  const lowerText = text.toLowerCase();
  return currentGroupMembers
    .filter(
      (member) =>
        member.id !== currentUser.uid &&
        member.name &&
        lowerText.includes(`@${member.name.toLowerCase()}`),
    )
    .map((member) => ({
      id: member.id,
      name: member.name,
      label: member.name,
    }));
}

function getMentionQuery(input) {
  const cursor = input.selectionStart ?? input.value.length;
  const beforeCursor = input.value.slice(0, cursor);
  const match = beforeCursor.match(/(^|\s)@([^\s@]{0,32})$/);
  if (!match) return null;
  return {
    query: match[2].toLowerCase(),
    start: cursor - match[2].length - 1,
    end: cursor,
  };
}

function hideMentionSuggestions() {
  const box = document.getElementById("mentionSuggestions");
  if (!box) return;
  box.style.display = "none";
  box.innerHTML = "";
  mentionSuggestionItems = [];
  mentionSuggestionRange = null;
  mentionSuggestionIndex = -1;
}

function insertMention(member, range) {
  const input = document.getElementById("messageInput");
  if (!input || !member || !range) return;
  const before = input.value.slice(0, range.start);
  const after = input.value.slice(range.end);
  const mention = `@${member.name} `;
  input.value = `${before}${mention}${after}`;
  const cursor = before.length + mention.length;
  input.focus();
  input.setSelectionRange(cursor, cursor);
  saveCurrentDraft();
  hideMentionSuggestions();
}

function highlightMentionSuggestion() {
  const box = document.getElementById("mentionSuggestions");
  if (!box) return;
  box.querySelectorAll(".mention-suggestion").forEach((el, idx) => {
    el.classList.toggle("active", idx === mentionSuggestionIndex);
  });
}

function handleMentionKeydown(event) {
  const box = document.getElementById("mentionSuggestions");
  if (!box || box.style.display !== "block" || !mentionSuggestionItems.length)
    return false;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    mentionSuggestionIndex =
      (mentionSuggestionIndex + 1) % mentionSuggestionItems.length;
    highlightMentionSuggestion();
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    mentionSuggestionIndex =
      mentionSuggestionIndex <= 0
        ? mentionSuggestionItems.length - 1
        : mentionSuggestionIndex - 1;
    highlightMentionSuggestion();
    return true;
  }
  if (event.key === "Enter" && mentionSuggestionIndex >= 0) {
    event.preventDefault();
    const member = mentionSuggestionItems[mentionSuggestionIndex];
    if (member && mentionSuggestionRange)
      insertMention(member, mentionSuggestionRange);
    return true;
  }
  if (event.key === "Tab" && mentionSuggestionIndex >= 0) {
    event.preventDefault();
    const member = mentionSuggestionItems[mentionSuggestionIndex];
    if (member && mentionSuggestionRange)
      insertMention(member, mentionSuggestionRange);
    return true;
  }
  return false;
}

function updateMentionSuggestions() {
  const input = document.getElementById("messageInput");
  const box = document.getElementById("mentionSuggestions");
  if (!input || !box || currentChatType !== "group") {
    hideMentionSuggestions();
    return;
  }
  const range = getMentionQuery(input);
  if (!range) {
    hideMentionSuggestions();
    return;
  }
  const matches = currentGroupMembers
    .filter((member) => member.id !== currentUser.uid && member.name)
    .filter((member) => member.name.toLowerCase().includes(range.query))
    .slice(0, 6);
  if (!matches.length) {
    hideMentionSuggestions();
    return;
  }
  mentionSuggestionItems = matches;
  mentionSuggestionRange = range;
  mentionSuggestionIndex = 0;
  box.innerHTML = "";
  matches.forEach((member) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mention-suggestion";
    button.innerHTML = `<span class="list-avatar">${member.avatar ? `<img src="${member.avatar}">` : escapeHtml(getInitials(member.name || ""))}</span><span>${escapeHtml(member.name)}</span>`;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      insertMention(member, range);
    });
    box.appendChild(button);
  });
  box.style.display = "block";
  highlightMentionSuggestion();
}

function renderPollMessage(messageId, msg = {}) {
  const poll = msg.poll || {};
  const options = Array.isArray(poll.options) ? poll.options : [];
  const votes = poll.votes || {};
  const voteValues = Object.values(votes);
  const totalVotes = voteValues.length;
  const myVote = votes[currentUser?.uid];
  const optionsHtml = options
    .map((option, index) => {
      const count = voteValues.filter(
        (value) => Number(value) === index,
      ).length;
      const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
      const selected = Number(myVote) === index ? " selected" : "";
      return `
      <button class="poll-option${selected}" data-message-id="${escapeHtml(messageId)}" data-option-index="${index}" type="button">
        <span class="poll-option-top"><span>${escapeHtml(option)}</span><span>${percent}%</span></span>
        <span class="poll-option-bar"><span class="poll-option-fill" style="width:${percent}%"></span></span>
      </button>
    `;
    })
    .join("");
  return `
    <div class="poll-card">
      <div class="poll-question">${escapeHtml(poll.question || "Poll")}</div>
      ${optionsHtml}
      <div class="poll-meta">${totalVotes} vote${totalVotes === 1 ? "" : "s"}</div>
    </div>
  `;
}

async function votePoll(messageId, optionIndex) {
  if (!currentUser || !messageId || Number.isNaN(optionIndex)) return;
  const updates = {};
  updates[`poll.votes.${currentUser.uid}`] = Number(optionIndex);
  await db.collection("messages").doc(messageId).update(updates);
}

function bindRenderedMessageActions() {
  document.querySelectorAll(".voice-play-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const audio = new Audio(btn.dataset.url);
      audio.play();
    });
  });
  document.querySelectorAll(".poll-option").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await votePoll(btn.dataset.messageId, Number(btn.dataset.optionIndex));
    });
  });
  document.querySelectorAll(".list-item-checkbox").forEach((btn) => {
    btn.addEventListener("change", async () => {
      const messageDiv = btn.closest(".message");
      if (!messageDiv) return;
      const messageId = messageDiv.dataset.messageId;
      const itemIndex = Number(btn.dataset.itemIndex);
      if (messageId && !isNaN(itemIndex)) {
        await toggleListItem(messageId, itemIndex);
      }
    });
  });
  document.querySelectorAll("[data-preview-url]").forEach((el) => {
    if (el.dataset.previewBound) return;
    el.dataset.previewBound = "true";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      previewFile(el.dataset.previewUrl, el.dataset.filename);
    });
  });
  document.querySelectorAll(".view-once-placeholder").forEach((el) => {
    if (el.dataset.viewOnceBound) return;
    el.dataset.viewOnceBound = "true";
    el.addEventListener("click", async () => {
      const url = el.dataset.viewOnceUrl;
      const filename = el.dataset.filename;
      el.innerHTML =
        '<div style="text-align:center;padding:10px;">Loading...</div>';
      previewFile(url, filename);
      const msgId = el.closest(".message")?.dataset.messageId;
      if (msgId) {
        try {
          await db
            .collection("messages")
            .doc(msgId)
            .update({
              viewedBy: firebase.firestore.FieldValue.arrayUnion(
                currentUser.uid,
              ),
              viewedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } catch (e) {}
        setTimeout(async () => {
          try {
            await db.collection("messages").doc(msgId).update({
              text: "[This media has been viewed]",
              attachment: null,
              viewOnceExpired: true,
            });
          } catch (e) {}
        }, 10000);
      }
    });
  });
}

function getChatContainer() {
  return document.querySelector(".chat-container");
}

function isChatPanelOpen() {
  return Boolean(getChatContainer()?.classList.contains("chat-open"));
}

function isStandaloneAppMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function shouldUseMobileBackGuard() {
  return (
    window.matchMedia("(max-width: 768px)").matches || isStandaloneAppMode()
  );
}

function normalizeMobileBackButton() {
  const backBtn = document.getElementById("mobileMenuBtn");
  if (!backBtn) return;

  // Keep exactly one in-app back arrow. Some CSS adds ::before while the HTML also had &larr;,
  // which produced two arrows on mobile. This clears the HTML arrow and lets CSS draw one.
  backBtn.textContent = "";
  backBtn.setAttribute("aria-label", "Back to chats");
  backBtn.setAttribute("title", "Back to chats");

  if (!document.getElementById("mobileBackButtonFixStyle")) {
    const style = document.createElement("style");
    style.id = "mobileBackButtonFixStyle";
    style.textContent = `
      @media (max-width: 768px), (display-mode: standalone) {
        #mobileMenuBtn {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex: 0 0 40px !important;
          width: 40px !important;
          min-width: 40px !important;
          height: 40px !important;
          font-size: 0 !important;
        }
        #mobileMenuBtn::before {
          content: "\\2190" !important;
          display: inline-block !important;
          font-size: 24px !important;
          line-height: 1 !important;
        }
        .chat-container:not(.chat-open) #mobileMenuBtn {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

function openMobileChatPanel() {
  const container = getChatContainer();
  if (!container) return;
  container.classList.add("chat-open");
  normalizeMobileBackButton();
  pushMobileChatHistory();
}

function closeMobileChatPanel({ fromPopState = false } = {}) {
  const container = getChatContainer();
  if (container) {
    container.classList.remove("chat-open");
    container.classList.add("chat-list-returned");
    setTimeout(() => container.classList.remove("chat-list-returned"), 250);
  }

  // The chat list is now visible. Do not trap the next back press here:
  // browser/PWA back from the chat list should behave normally and exit/minimize.
  mobileChatHistoryOpen = false;

  if (
    !fromPopState &&
    shouldUseMobileBackGuard() &&
    history.state?.teamChatView === "chat"
  ) {
    // Header back button should behave like Android/browser back from an open chat.
    history.back();
  }
}

function pushMobileChatHistory() {
  if (!shouldUseMobileBackGuard()) return;

  // Make the current entry represent the chat-list/home state, then push exactly one chat entry.
  if (!history.state || history.state.teamChatView !== "home") {
    history.replaceState({ teamChatView: "home" }, "", window.location.href);
  }

  if (history.state?.teamChatView === "chat" || mobileChatHistoryOpen) return;

  history.pushState({ teamChatView: "chat" }, "", window.location.href);
  mobileChatHistoryOpen = true;
}

function handleMobileChatBack(event) {
  if (hasLiveCallSession()) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    minimizeActiveCallUi();
    return;
  }
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (activeCall && activeCallMode !== "incoming") {
    minimizeActiveCallUi("navigation");
    if (isChatPanelOpen()) closeMobileChatPanel({ fromPopState: true });
    return;
  }

  if (!shouldUseMobileBackGuard()) return;

  if (isChatPanelOpen()) {
    if (history.state?.teamChatView === "chat") {
      history.back();
    } else {
      closeMobileChatPanel({ fromPopState: true });
      if (!history.state || history.state.teamChatView !== "home") {
        history.replaceState(
          { teamChatView: "home" },
          "",
          window.location.href,
        );
      }
    }
  }
}

function syncMobileBackState() {
  if (!shouldUseMobileBackGuard()) return;
  const container = getChatContainer();
  if (!container) return;

  const shouldBeOpen = Boolean(currentChat) && Boolean(currentChatType);
  container.classList.toggle("chat-open", shouldBeOpen);

  if (shouldBeOpen) {
    normalizeMobileBackButton();
  } else {
    mobileChatHistoryOpen = false;
  }
}

function setupMobileBackGuard() {
  if (mobileBackGuardReady) return;
  mobileBackGuardReady = true;

  normalizeMobileBackButton();

  if (!history.state?.teamChatView) {
    history.replaceState({ teamChatView: "home" }, "", window.location.href);
  }

  document
    .getElementById("mobileMenuBtn")
    ?.addEventListener("click", handleMobileChatBack);

  // Android back button / browser back / mobile swipe-back:
  // - Close in-app layers first, then return from conversation to chat list.
  // - If already on chat list, do not block anything; browser/PWA exits naturally.
  window.addEventListener("popstate", () => {
    if (handleSystemBackNavigation({ fromPopState: true })) {
      if (
        shouldUseMobileBackGuard() &&
        isChatPanelOpen() &&
        !hasLiveCallSession()
      ) {
        pushMobileChatHistory();
      }
      return;
    }

    if (hasLiveCallSession()) {
      minimizeActiveCallUi();
      try {
        history.pushState(
          { teamChatView: "call-minimized" },
          "",
          window.location.href,
        );
      } catch (error) {}
      return;
    }
    if (!shouldUseMobileBackGuard()) return;

    if (activeCall && activeCallMode !== "incoming") {
      minimizeActiveCallUi("navigation");
      if (isChatPanelOpen()) closeMobileChatPanel({ fromPopState: true });
      if (!history.state || history.state.teamChatView !== "home") {
        history.replaceState(
          { teamChatView: "home" },
          "",
          window.location.href,
        );
      }
      return;
    }

    if (isChatPanelOpen()) {
      closeMobileChatPanel({ fromPopState: true });
      return;
    }

    mobileChatHistoryOpen = history.state?.teamChatView === "chat";
  });

  window.addEventListener("resize", syncMobileBackState);
  window.addEventListener("orientationchange", syncMobileBackState);
}

// ========================================
// Active call safe back/minimize handling
// Best possible for web/PWA: prevents in-app back from ending calls.
// ========================================
function hasLiveCallSession() {
  return Boolean(
    activeCall ||
    peerConnection ||
    localCallStream ||
    activeCallMode === "active" ||
    activeCallMode === "outgoing" ||
    activeCallMode === "incoming",
  );
}

function ensureMiniCallBar() {
  let bar = document.getElementById("miniCallBar");
  if (bar) return bar;

  bar = document.createElement("div");
  bar.id = "miniCallBar";
  bar.className = "mini-call-bar";
  bar.innerHTML = `
    <button type="button" id="miniCallOpenBtn" class="mini-call-main">
      <span class="mini-call-dot"></span>
      <span id="miniCallText">Call in progress</span>
    </button>
    <button type="button" id="miniCallEndBtn" class="mini-call-end" aria-label="End call">✕</button>
  `;
  document.body.appendChild(bar);

  const styleId = "miniCallBarStyle";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .mini-call-bar {
        position: fixed;
        left: max(12px, env(safe-area-inset-left));
        right: max(12px, env(safe-area-inset-right));
        top: max(10px, env(safe-area-inset-top));
        z-index: 100000;
        display: none;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-radius: 999px;
        background: #008069;
        color: #fff;
        box-shadow: 0 8px 24px rgba(0,0,0,.24);
      }
      .mini-call-bar.show {
        display: flex;
      }
      .mini-call-main {
        flex: 1;
        min-width: 0;
        height: 40px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: inherit;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 0 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .mini-call-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #50ffb1;
        box-shadow: 0 0 0 0 rgba(80,255,177,.75);
        animation: miniCallPulse 1.15s infinite;
      }
      @keyframes miniCallPulse {
        70% { box-shadow: 0 0 0 10px rgba(80,255,177,0); }
        100% { box-shadow: 0 0 0 0 rgba(80,255,177,0); }
      }
      .mini-call-end {
        width: 40px;
        height: 40px;
        border: 0;
        border-radius: 50%;
        background: #ef4444;
        color: #fff;
        font-size: 18px;
        font-weight: 900;
        cursor: pointer;
      }
      body.call-minimized #callModal {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  document
    .getElementById("miniCallOpenBtn")
    ?.addEventListener("click", restoreActiveCallUi);
  document
    .getElementById("miniCallEndBtn")
    ?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof endActiveCall === "function") {
        await endActiveCall("ended");
      } else {
        cleanupCallUi();
      }
    });

  return bar;
}

function updateMiniCallBarText() {
  const text = document.getElementById("miniCallText");
  if (!text) return;
  const type =
    currentCallType === "video" || activeCall?.type === "video"
      ? "Video call"
      : "Voice call";
  const name =
    activeCall?.fromUserName ||
    activeCall?.toUserName ||
    currentChat?.otherUserName ||
    currentChat?.name ||
    "";
  text.textContent = `${type}${name ? ` with ${name}` : ""}`;
}

function minimizeActiveCallUi() {
  if (!hasLiveCallSession()) return false;
  const modal = document.getElementById("callModal");
  const bar = ensureMiniCallBar();

  updateMiniCallBarText();
  document.body.classList.add("call-minimized");
  if (modal) modal.style.display = "none";
  bar.classList.add("show");

  // Important: do not cleanup streams or peer connection here.
  // Only hide/minimize the call interface.
  return true;
}

function restoreActiveCallUi() {
  if (!hasLiveCallSession()) return false;
  const modal = document.getElementById("callModal");
  const bar = ensureMiniCallBar();

  document.body.classList.remove("call-minimized");
  bar.classList.remove("show");
  if (modal) modal.style.display = "flex";

  return true;
}

function hideMiniCallBar() {
  document.body.classList.remove("call-minimized");
  const bar = document.getElementById("miniCallBar");
  if (bar) bar.classList.remove("show");
}

function setupActiveCallBackProtection() {
  if (window.__teamChatActiveCallBackProtectionReady) return;
  window.__teamChatActiveCallBackProtectionReady = true;

  window.addEventListener("popstate", (event) => {
    if (hasLiveCallSession()) {
      minimizeActiveCallUi();
      // Put the user back on an app state so repeated back does not immediately destroy UI.
      try {
        history.pushState(
          { teamChatView: "call-minimized" },
          "",
          window.location.href,
        );
      } catch (error) {}
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && hasLiveCallSession()) {
      event.preventDefault();
      minimizeActiveCallUi();
    }
  });
}

function resetChatPanel() {
  currentChat = null;
  currentChatType = null;
  currentGroup = null;
  currentGroupMembers = [];
  currentReplyTo = null;
  if (messagesUnsubscribe) {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }
  if (typingUnsubscribe) {
    typingUnsubscribe();
    typingUnsubscribe = null;
  }
  document.getElementById("currentChatName").textContent = "Select a chat";
  document.getElementById("chatStatus").textContent = "";
  document.getElementById("currentChatAvatar").innerHTML = "?";
  document.getElementById("voiceCallBtn").style.display = "none";
  document.getElementById("videoCallBtn").style.display = "none";
  document.getElementById("messagesArea").innerHTML = getHomePanelHtml();
  document.getElementById("inputArea").style.display = "none";
  document.getElementById("groupInfoBtn").style.display = "none";
  closeMobileChatPanel();
}

function setChatHeaderAvatar(content) {
  const avatar = document.getElementById("currentChatAvatar");
  if (avatar) avatar.innerHTML = content || "?";
}

function setBadgeText(elementId, count) {
  const badge = document.getElementById(elementId);
  if (!badge) return;
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.style.display = count > 0 ? "inline-flex" : "none";
}

function updateUnreadBadges(items = []) {
  const totalUnread = items.reduce(
    (total, item) => total + (Number(item.unreadCount) || 0),
    0,
  );
  setBadgeText("allUnreadBadge", totalUnread);
  setBadgeText("unreadTabBadge", totalUnread);
  document.title =
    totalUnread > 0 ? `(${totalUnread}) Team Chat` : "Team Chat - Complete";
}

function scheduleChatListRefresh(delay = 600) {
  clearTimeout(chatListRefreshTimer);
  chatListRefreshTimer = setTimeout(() => {
    if (!currentUser) return;
    loadCurrentChatList();
  }, delay);
}

function updateViewOnceRow() {
  const row = document.getElementById("viewOnceRow");
  const toggle = document.getElementById("viewOnceToggle");
  const label = document.getElementById("viewOnceLabel");
  if (!row) return;

  const canUseViewOnce = currentAttachment?.type === "image";
  row.style.display = canUseViewOnce ? "flex" : "none";

  if (!canUseViewOnce && toggle) {
    toggle.checked = false;
    if (currentAttachment) currentAttachment.viewOnce = false;
  }

  if (label)
    label.textContent = toggle?.checked ? "View Once: ON" : "View Once: OFF";
}

function setAttachmentPreview() {
  const preview = document.getElementById("attachmentPreview");
  if (!preview) return;
  if (!currentAttachment) {
    preview.style.display = "none";
    preview.innerHTML = "";
    updateViewOnceRow();
    updateComposerActionState();
    return;
  }
  const isImage = currentAttachment.type === "image";
  const attachmentType = isImage
    ? "Image attachment"
    : getAttachmentLabel(currentAttachment);
  preview.style.display = "flex";
  preview.innerHTML = `
    ${isImage ? `<img src="${currentAttachment.url}" alt="Attachment preview">` : '<span style="font-size:24px">📎</span>'}
    <div style="min-width:0">
      <strong>${escapeHtml(currentAttachment.filename || (isImage ? "Image ready" : "Document ready"))}</strong>
      <div class="list-preview">${escapeHtml(attachmentType)}${currentAttachment.size ? ` · ${formatBytes(currentAttachment.size)}` : ""}</div>
    </div>
    <button type="button" id="clearAttachmentBtn">Remove</button>
  `;
  if (!isImage) {
    const icon = preview.querySelector("span[style]");
    if (icon) {
      icon.removeAttribute("style");
      icon.className = "attachment-file-icon";
      icon.textContent = getFileExtension(
        currentAttachment.filename,
        currentAttachment.url,
      );
    }
  }
  document
    .getElementById("clearAttachmentBtn")
    ?.addEventListener("click", () => {
      currentAttachment = null;
      setAttachmentPreview();
    });
  updateViewOnceRow();
  updateComposerActionState();
}

function setConnectionBanner() {
  const banner = document.getElementById("connectionBanner");
  if (!banner) return;
  banner.style.display = navigator.onLine ? "none" : "block";
}

function setSendingState(isSending) {
  const sendBtn = document.getElementById("sendBtn");
  const input = document.getElementById("messageInput");
  if (sendBtn) {
    sendBtn.disabled = isSending;
    sendBtn.textContent = isSending ? "…" : "➤";
    sendBtn.setAttribute("aria-busy", isSending ? "true" : "false");
    sendBtn.setAttribute(
      "aria-label",
      isSending ? "Sending message" : "Send message",
    );
  }
  if (input) input.disabled = isSending;
}

function getCallPermissionMessage(error, type = "voice") {
  const device = type === "video" ? "camera and microphone" : "microphone";
  if (!error) return `Please allow ${device} access to continue.`;

  const settingsLocation = window.Capacitor?.isNativePlatform
    ? "your device Settings"
    : "your browser settings";

  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return `${device[0].toUpperCase()}${device.slice(1)} access was blocked. Allow permission in ${settingsLocation} and try again.`;
  }
  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return `No ${type === "video" ? "camera/microphone" : "microphone"} was found on this device.`;
  }
  if (error.name === "NotReadableError" || error.name === "TrackStartError") {
    return `The ${device} is already in use by another app.`;
  }
  return `Could not access ${device}.`;
}

function setCallStatus(status) {
  const statusEl = document.getElementById("callStatusText");
  if (statusEl) statusEl.textContent = status;
  updateCallMiniBar(status);
}

function updateCallControlState() {
  const muteBtn = document.getElementById("muteMicBtn");
  const cameraBtn = document.getElementById("toggleCameraBtn");
  const switchCameraBtn = document.getElementById("switchCameraBtn");
  const addParticipantBtn = document.getElementById("addCallParticipantBtn");
  const localVideo = document.getElementById("localVideo");

  if (muteBtn) {
    muteBtn.classList.toggle("active", micMuted);
    muteBtn.title = micMuted ? "Turn microphone on" : "Mute microphone";
    muteBtn.setAttribute("aria-label", muteBtn.title);
    muteBtn.dataset.controlLabel = micMuted ? "Muted" : "Unmuted";
  }

  if (cameraBtn) {
    cameraBtn.classList.toggle("active", cameraOff);
    cameraBtn.title = cameraOff ? "Turn camera on" : "Turn camera off";
    cameraBtn.setAttribute("aria-label", cameraBtn.title);
    cameraBtn.dataset.state = cameraOff ? "off" : "on";
    cameraBtn.dataset.controlLabel = cameraOff ? "CAM OFF" : "CAM ON";
  }

  if (switchCameraBtn) {
    switchCameraBtn.disabled = cameraOff || currentCallType !== "video";
    switchCameraBtn.dataset.controlLabel =
      preferredCameraFacingMode === "user" ? "FRONT" : "BACK";
    switchCameraBtn.title =
      preferredCameraFacingMode === "user"
        ? "Switch to back camera"
        : "Switch to front camera";
    switchCameraBtn.setAttribute("aria-label", switchCameraBtn.title);
  }

  if (addParticipantBtn) {
    addParticipantBtn.dataset.controlLabel = "Add people";
  }

  if (localVideo) {
    localVideo.classList.toggle("camera-off", cameraOff);
    localVideo.style.visibility = cameraOff ? "hidden" : "";
  }
}

function flashCallControlLabel(button, message) {
  if (!button) return;
  if (message) button.dataset.controlLabel = message;
  button.classList.add("show-control-label");
  clearTimeout(button._labelTimer);
  button._labelTimer = setTimeout(() => {
    button.classList.remove("show-control-label");
  }, 1200);
}

function setMicrophoneMuted(isMuted) {
  const audioTrack = localCallStream?.getAudioTracks?.()[0];

  if (!audioTrack) {
    showCallControlHint("No microphone available");
    return;
  }

  micMuted = Boolean(isMuted);
  audioTrack.enabled = !micMuted;
  updateCallControlState();
  flashCallControlLabel(
    document.getElementById("muteMicBtn"),
    micMuted ? "Muted" : "Unmuted",
  );
}

async function setCameraOff(isOff) {
  const videoTrack = localCallStream?.getVideoTracks?.()[0];

  if (!videoTrack && isOff) {
    showCallControlHint("No camera available");
    return;
  }

  cameraOff = Boolean(isOff);

  if (cameraOff) {
    if (videoTrack) {
      videoTrack.stop();
      localCallStream.removeTrack(videoTrack);
    }
    await cameraSender?.replaceTrack?.(null);
    const localVideo = document.getElementById("localVideo");
    if (localVideo) localVideo.srcObject = null;
  } else {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: preferredCameraFacingMode },
      });
      const nextVideoTrack = videoStream.getVideoTracks()[0];
      if (!nextVideoTrack) throw new Error("No camera track available");
      localCallStream.addTrack(nextVideoTrack);
      if (cameraSender?.replaceTrack) {
        await cameraSender.replaceTrack(nextVideoTrack);
      } else if (peerConnection) {
        cameraSender = peerConnection.addTrack(nextVideoTrack, localCallStream);
        await renegotiateActiveCall();
      }
      const localVideo = document.getElementById("localVideo");
      if (localVideo) {
        localVideo.srcObject = localCallStream;
        localVideo.style.visibility = "";
        localVideo.play?.().catch(() => {});
      }
    } catch (error) {
      cameraOff = true;
      showToast(getCallPermissionMessage(error, "video"), "error");
    }
  }

  updateCallControlState();
  flashCallControlLabel(
    document.getElementById("toggleCameraBtn"),
    cameraOff ? "CAM OFF" : "CAM ON",
  );
}

async function switchCameraFacingMode() {
  if (currentCallType !== "video") return;
  if (cameraOff) {
    showCallControlHint("Turn camera on first");
    return;
  }

  const previousFacingMode = preferredCameraFacingMode;
  preferredCameraFacingMode =
    preferredCameraFacingMode === "user" ? "environment" : "user";

  try {
    const videoStream = await navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { exact: preferredCameraFacingMode } },
      })
      .catch(() =>
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: preferredCameraFacingMode },
        }),
      );
    const nextVideoTrack = videoStream.getVideoTracks()[0];
    if (!nextVideoTrack) throw new Error("No camera track available");

    const oldVideoTrack = localCallStream?.getVideoTracks?.()[0];
    if (oldVideoTrack) {
      oldVideoTrack.stop();
      localCallStream.removeTrack(oldVideoTrack);
    }

    localCallStream.addTrack(nextVideoTrack);
    if (cameraSender?.replaceTrack) {
      await cameraSender.replaceTrack(nextVideoTrack);
    } else if (peerConnection) {
      cameraSender = peerConnection.addTrack(nextVideoTrack, localCallStream);
      await renegotiateActiveCall();
    }

    const localVideo = document.getElementById("localVideo");
    if (localVideo) {
      localVideo.srcObject = localCallStream;
      localVideo.style.visibility = "";
      localVideo.play?.().catch(() => {});
    }

    updateCallControlState();
    flashCallControlLabel(
      document.getElementById("switchCameraBtn"),
      preferredCameraFacingMode === "user" ? "FRONT" : "BACK",
    );
  } catch (error) {
    preferredCameraFacingMode = previousFacingMode;
    updateCallControlState();
    showToast("Could not switch camera on this device", "error");
  }
}

function formatCallDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function startCallDuration() {
  callStartedAt = Date.now();
  const durationEl = document.getElementById("callDuration");
  if (durationEl) {
    durationEl.style.display = "block";
    durationEl.textContent = "0:00";
  }
  clearInterval(callDurationTimer);
  callDurationTimer = setInterval(() => {
    if (durationEl && callStartedAt) {
      durationEl.textContent = formatCallDuration(Date.now() - callStartedAt);
    }
    if (callStartedAt && callMiniBar?.classList.contains("show")) {
      updateCallMiniBar("Connected");
    }
  }, 1000);
}

function stopCallDuration() {
  clearInterval(callDurationTimer);
  callDurationTimer = null;
  callStartedAt = null;
  const durationEl = document.getElementById("callDuration");
  if (durationEl) {
    durationEl.style.display = "none";
    durationEl.textContent = "0:00";
  }
}

function startIncomingRingtone() {
  stopIncomingRingtone();
  if (navigator.vibrate) {
    navigator.vibrate([700, 250, 700, 250, 700]);
    vibrationTimer = setInterval(
      () => navigator.vibrate?.([700, 250, 700, 250, 700]),
      1600,
    );
  }
  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    ringtoneAudioContext = new AudioContextCtor();
    const playTone = () => {
      if (!ringtoneAudioContext) return;
      const oscillator = ringtoneAudioContext.createOscillator();
      const gain = ringtoneAudioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 920;
      gain.gain.setValueAtTime(0.0001, ringtoneAudioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.18,
        ringtoneAudioContext.currentTime + 0.03,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ringtoneAudioContext.currentTime + 0.42,
      );
      oscillator.connect(gain);
      gain.connect(ringtoneAudioContext.destination);
      oscillator.start();
      oscillator.stop(ringtoneAudioContext.currentTime + 0.75);
    };
    playTone();
    ringtoneTimer = setInterval(playTone, 1100);
  } catch (error) {
    console.warn("Incoming call tone could not start:", error);
  }
}

function notifyIncomingCall(call) {
  if (Notification.permission === "granted") {
    showStrongIncomingCallNotification(call);
  }
}

function hasValidFcmVapidKey() {
  return Boolean(
    typeof FCM_VAPID_KEY === "string" &&
    FCM_VAPID_KEY.trim().length > 50 &&
    !FCM_VAPID_KEY.includes(
      "PASTE_YOUR_FIREBASE_WEB_PUSH_PUBLIC_VAPID_KEY_HERE",
    ),
  );
}

// ========================================
// Strong FCM registration for background call notifications
// ========================================
function getFcmTokenStorageKey() {
  return currentUser
    ? `teamChatFcmTokenRegisteredAt_${currentUser.uid}`
    : "teamChatFcmTokenRegisteredAt";
}

function shouldRefreshFcmToken() {
  try {
    const registeredAt = Number(
      localStorage.getItem(getFcmTokenStorageKey()) || 0,
    );
    return !registeredAt || Date.now() - registeredAt > 1000 * 60 * 60 * 24 * 6;
  } catch (error) {
    return true;
  }
}

function shouldShowCallNotification(call = {}) {
  const key =
    call.id ||
    call.callId ||
    `${call.fromUserName || "unknown"}:${call.type || "voice"}`;
  const now = Date.now();
  for (const [storedKey, seenAt] of recentCallNotificationKeys.entries()) {
    if (now - seenAt > 30000) recentCallNotificationKeys.delete(storedKey);
  }
  if (recentCallNotificationKeys.has(key)) return false;
  recentCallNotificationKeys.set(key, now);
  return true;
}

async function ensureCallNotificationPermission({ force = false } = {}) {
  if (
    !currentUser ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  )
    return false;

  if (Notification.permission === "denied") {
    showToast(
      "Notifications are blocked. Enable them in Chrome site settings to receive calls when the app is closed.",
      "error",
    );
    return false;
  }

  if (Notification.permission !== "granted") {
    if (!force) return false;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      showToast(
        "Allow notifications to receive calls when the app is minimized or screen is locked.",
        "error",
      );
      return false;
    }
  }

  return true;
}

async function registerFcmTokenForCurrentUser({ force = false } = {}) {
  if (!currentUser || pushSetupStarted) return;
  if (!hasValidFcmVapidKey()) {
    console.warn("FCM VAPID key is missing or invalid.");
    return;
  }

  if (!force && pushSetupDone && !shouldRefreshFcmToken()) return;

  pushSetupStarted = true;
  try {
    const permissionReady = await ensureCallNotificationPermission({ force });
    if (!permissionReady) return;

    if (!firebase.messaging) {
      console.warn("Firebase Messaging SDK is not loaded.");
      return;
    }

    messaging = messaging || firebase.messaging();

    const registration = await navigator.serviceWorker.register(
      "sw.js?v=134-call-bg",
      { scope: "./" },
    );
    await registration.update?.().catch(() => {});
    const readyRegistration = await navigator.serviceWorker.ready;

    const token = await messaging.getToken({
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: readyRegistration,
    });

    if (!token) {
      console.warn("FCM did not return a token.");
      return;
    }

    const tokenKey = token.replace(/[^a-zA-Z0-9]/g, "").slice(-120);
    await db
      .collection("users")
      .doc(currentUser.uid)
      .set(
        {
          fcmTokens: {
            [tokenKey]: {
              token,
              platform: navigator.userAgent || "web",
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              permission: Notification.permission,
              scope: readyRegistration.scope || "./",
              purpose: "incoming-calls",
            },
          },
          notificationsEnabled: true,
          lastFcmTokenUpdateAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    localStorage.setItem(getFcmTokenStorageKey(), String(Date.now()));
    pushSetupDone = true;

    if (messaging.onMessage && !window.__teamChatForegroundFcmBound) {
      window.__teamChatForegroundFcmBound = true;
      messaging.onMessage((payload) => {
        const data = payload.data || {};
        if (data.kind === "call" && document.hidden) {
          showStrongIncomingCallNotification({
            id: data.callId,
            type: data.type,
            fromUserName: data.fromUserName,
          });
        }
      });
    }
  } catch (error) {
    console.warn("FCM registration failed:", error);
    showToast(
      "Could not enable call notifications. Check Chrome notification permission.",
      "error",
    );
  } finally {
    pushSetupStarted = false;
  }
}

async function showStrongIncomingCallNotification(call = {}) {
  if (!("serviceWorker" in navigator) || Notification.permission !== "granted")
    return;
  if (!shouldShowCallNotification(call)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(
      call.type === "video"
        ? "📹 Incoming video call"
        : "📞 Incoming voice call",
      {
        body: `${call.fromUserName || "Team Chat"} is calling. Tap to open Team Chat.`,
        tag: `call-${call.id || Date.now()}`,
        renotify: true,
        requireInteraction: true,
        silent: false,
        icon: "app-icon-192.png",
        badge: "app-icon-192.png",
        timestamp: Date.now(),
        vibrate: [700, 250, 700, 250, 700, 250, 700, 250, 700],
        data: {
          url: "./index.html",
          callId: call.id || "",
          kind: "call",
        },
        actions: [{ action: "open", title: "Open" }],
      },
    );
  } catch (error) {
    console.warn("Could not show incoming call notification:", error);
  }
}

function setupCallNotificationRefreshHooks() {
  if (window.__teamChatCallNotificationHooksBound) return;
  window.__teamChatCallNotificationHooksBound = true;

  window.addEventListener("focus", () => {
    if (currentUser && Notification.permission === "granted") {
      registerFcmTokenForCurrentUser({ force: false });
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (
      !document.hidden &&
      currentUser &&
      Notification.permission === "granted"
    ) {
      registerFcmTokenForCurrentUser({ force: false });
    }
  });

  window.addEventListener("online", () => {
    if (currentUser && Notification.permission === "granted") {
      registerFcmTokenForCurrentUser({ force: false });
    }
  });
}

function getFcmTokenMapKey(token = "") {
  return String(token)
    .replace(/[.#$/\[\]]/g, "_")
    .slice(0, 160);
}

async function setupCallPushNotifications({ forcePrompt = false } = {}) {
  if (!currentUser || pushSetupStarted || pushSetupDone) return;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
  if (!firebase.messaging || !hasValidFcmVapidKey()) {
    console.warn(
      "FCM is not ready. Add firebase-messaging-compat.js and set FCM_VAPID_KEY.",
    );
    return;
  }

  if (Notification.permission === "denied") {
    console.warn("Notification permission is denied by the user/browser.");
    return;
  }

  // Avoid surprising permission popups unless the user has already granted permission
  // or the caller intentionally asks from a user action.
  if (Notification.permission === "default" && !forcePrompt) return;

  pushSetupStarted = true;
  try {
    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.register("sw.js");
    messaging = firebase.messaging();

    const token = await messaging.getToken({
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) return;

    await db
      .collection("users")
      .doc(currentUser.uid)
      .set(
        {
          fcmTokens: {
            [getFcmTokenMapKey(token)]: {
              token,
              userAgent: navigator.userAgent,
              platform: navigator.platform || "",
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
          },
          notificationPermission: "granted",
          notificationUpdatedAt:
            firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    pushSetupDone = true;

    messaging.onMessage((payload) => {
      const data = payload?.data || {};
      if (
        data.kind === "call" &&
        data.callId &&
        data.toUserId === currentUser.uid
      ) {
        // Foreground FCM backup. Firestore listener normally opens the call UI;
        // this keeps a visible notification if the tab is backgrounded but still alive.
        if (document.hidden && Notification.permission === "granted") {
          navigator.serviceWorker.ready
            .then((reg) => {
              reg.showNotification(
                data.type === "video"
                  ? "📹 Incoming video call"
                  : "📞 Incoming voice call",
                {
                  body: `${data.fromUserName || "Team Chat"} is calling. Tap to open Team Chat.`,
                  tag: `call-${data.callId}`,
                  renotify: true,
                  requireInteraction: true,
                  silent: false,
                  icon: "app-icon-192.png",
                  badge: "app-icon-192.png",
                  timestamp: Date.now(),
                  vibrate: [700, 250, 700, 250, 700, 250, 700],
                  data: {
                    url: "./index.html",
                    callId: data.callId,
                    kind: "call",
                  },
                  actions: [{ action: "open", title: "Open" }],
                },
              );
            })
            .catch(() => {});
        }
      }
    });
  } catch (error) {
    console.warn("Could not setup call push notifications:", error);
  } finally {
    pushSetupStarted = false;
  }
}

async function requestCallWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener?.("release", () => {
      wakeLock = null;
    });
  } catch (error) {
    console.warn("Screen wake lock unavailable:", error);
  }
}

async function releaseCallWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch (error) {
    console.warn("Screen wake lock release failed:", error);
  } finally {
    wakeLock = null;
  }
}

function stopIncomingRingtone() {
  clearInterval(ringtoneTimer);
  clearInterval(vibrationTimer);
  ringtoneTimer = null;
  vibrationTimer = null;
  navigator.vibrate?.(0);
  if (ringtoneAudioContext) {
    ringtoneAudioContext.close().catch(() => {});
    ringtoneAudioContext = null;
  }
}

function clearCallTimeout() {
  clearTimeout(callTimeoutTimer);
  callTimeoutTimer = null;
}

function getCallHistoryText(status, type, durationMs = 0) {
  const label = type === "video" ? "Video call" : "Voice call";
  if (status === "missed" || status === "failed")
    return `Missed ${label.toLowerCase()}`;
  if (status === "cancelled") return `${label} cancelled`;
  if (status === "rejected") return `${label} declined`;
  if (status === "ended" && durationMs > 0)
    return `${label} ended · ${formatCallDuration(durationMs)}`;
  return `${label} ended`;
}

async function writeCallHistory(status) {
  if (!activeCall?.id || callLogWritten || !currentUser) return;
  callLogWritten = true;
  const durationMs = callStartedAt ? Date.now() - callStartedAt : 0;
  const type = activeCall.type || currentCallType || "voice";
  const directId = getDirectChatId(activeCall.fromUserId, activeCall.toUserId);
  const text = getCallHistoryText(status, type, durationMs);
  await db
    .collection("messages")
    .doc(`call_${activeCall.id}`)
    .set(
      {
        type: "call",
        callId: activeCall.id,
        callType: type,
        callStatus: status,
        callDurationMs: durationMs,
        directId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        readBy: {
          [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    )
    .catch((error) => {
      console.warn("Could not write call history:", error);
    });
  await db
    .collection("directChats")
    .doc(directId)
    .set(
      {
        participants: [activeCall.fromUserId, activeCall.toUserId],
        status: "active",
        lastMessage: text,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    .catch(() => {});
}

function scheduleCallTimeout(callRef, ownerRole) {
  clearCallTimeout();
  callTimeoutTimer = setTimeout(async () => {
    let shouldCleanup = false;
    try {
      const snapshot = await callRef.get();
      const data = snapshot.data();
      if (!data || data.status !== "ringing") return;
      await callRef.update({
        status: "missed",
        missedBy: data.toUserId,
        endedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      shouldCleanup = true;
      if (ownerRole === "caller" && activeCall)
        await writeCallHistory("missed");
      if (ownerRole === "caller") showToast("Call not answered", "error");
    } catch (error) {
      console.warn("Could not mark missed call:", error);
    } finally {
      if (shouldCleanup) cleanupCallUi();
    }
  }, 45000);
}

function setCallUi({
  mode = "outgoing",
  type = "voice",
  title = "Calling...",
  status = "Connecting",
} = {}) {
  hideMiniCallBar();
  const modal = document.getElementById("callModal");
  const shell = modal?.querySelector(".call-shell");
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const audioAvatar = document.getElementById("callAudioAvatar");
  const groupGrid = document.getElementById("groupCallGrid");
  if (!modal) return;
  activeCallMode = mode;
  document.body.classList.remove("call-minimized");
  hideCallMiniBar();
  modal.style.display = "flex";
  setupCallControlButtons();
  resetLocalVideoPreviewPosition();
  shell?.classList.toggle("incoming", mode === "incoming");
  document.getElementById("callTypeLabel").textContent =
    type === "video" ? "Video call" : "Voice call";
  document.getElementById("callTitle").textContent = title;
  document.getElementById("callStatusText").textContent = status;
  document.getElementById("acceptCallBtn").style.display =
    mode === "incoming" ? "inline-flex" : "none";
  document.getElementById("rejectCallBtn").style.display =
    mode === "incoming" ? "inline-flex" : "none";
  document.getElementById("endCallBtn").style.display =
    mode === "incoming" ? "none" : "inline-flex";
  document.getElementById("muteMicBtn").style.display =
    mode === "incoming" ? "none" : "inline-flex";
  const addParticipantBtn = document.getElementById("addCallParticipantBtn");
  if (addParticipantBtn) {
    addParticipantBtn.style.display =
      mode === "active" ? "inline-flex" : "none";
  }
  document.getElementById("toggleCameraBtn").style.display =
    mode !== "incoming" && type === "video" ? "inline-flex" : "none";
  const switchCameraBtn = document.getElementById("switchCameraBtn");
  if (switchCameraBtn) {
    switchCameraBtn.style.display =
      mode !== "incoming" && type === "video" ? "inline-flex" : "none";
  }
  if (localVideo)
    localVideo.style.display = type === "video" ? "block" : "none";
  if (remoteVideo)
    remoteVideo.style.display = type === "video" ? "block" : "none";
  if (groupGrid) {
    groupGrid.classList.remove("active");
    groupGrid.innerHTML = "";
  }
  if (audioAvatar) {
    audioAvatar.style.display = type === "voice" ? "flex" : "none";
    audioAvatar.classList.toggle(
      "ringing",
      mode === "incoming" || mode === "outgoing",
    );
    audioAvatar.textContent =
      (currentChat?.otherUserName ||
        activeCall?.fromUserName ||
        activeCall?.toUserName ||
        "?")[0]?.toUpperCase() || "?";
  }
  updateCallControlState();
}

function ensureCallMiniBarStyles() {
  if (document.getElementById("callMiniBarStyles")) return;
  const style = document.createElement("style");
  style.id = "callMiniBarStyles";
  style.textContent = `
    .call-mini-bar {
      position: fixed;
      left: max(12px, env(safe-area-inset-left, 0px));
      right: max(12px, env(safe-area-inset-right, 0px));
      bottom: calc(max(12px, env(safe-area-inset-bottom, 0px)) + 8px);
      z-index: 99998;
      min-height: 58px;
      padding: 10px 12px;
      border: 0;
      border-radius: 18px;
      background: #008069;
      color: #fff;
      box-shadow: 0 12px 32px rgba(0,0,0,.28);
      display: none;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
    }
    .call-mini-bar.show {
      display: flex;
    }
    .call-mini-icon {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(255,255,255,.18);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      font-size: 18px;
    }
    .call-mini-text {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .call-mini-title,
    .call-mini-status {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .call-mini-title {
      font-weight: 800;
      font-size: 14px;
    }
    .call-mini-status {
      font-size: 12px;
      opacity: .88;
    }
    .call-mini-end {
      width: 42px;
      height: 42px;
      border: 0;
      border-radius: 50%;
      background: #ef4444;
      color: #fff;
      cursor: pointer;
      font-size: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }
    body.call-minimized .call-modal {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function getCallDisplayName() {
  return (
    activeCall?.fromUserName ||
    activeCall?.toUserName ||
    currentChat?.otherUserName ||
    currentChat?.name ||
    document.getElementById("currentChatName")?.textContent ||
    "Team Chat"
  );
}

function getCallMiniStatus(fallback = "") {
  const statusText =
    fallback ||
    document.getElementById("callStatusText")?.textContent ||
    (callStartedAt ? "Connected" : "Calling...");
  const durationText = callStartedAt
    ? formatCallDuration(Date.now() - callStartedAt)
    : "";
  return durationText ? `${statusText} · ${durationText}` : statusText;
}

function ensureCallMiniBar() {
  ensureCallMiniBarStyles();
  if (callMiniBar) return callMiniBar;

  callMiniBar = document.createElement("button");
  callMiniBar.type = "button";
  callMiniBar.className = "call-mini-bar";
  callMiniBar.setAttribute("aria-label", "Return to active call");
  callMiniBar.innerHTML = `
    <span class="call-mini-icon" aria-hidden="true">📞</span>
    <span class="call-mini-text">
      <span class="call-mini-title">Active call</span>
      <span class="call-mini-status">Tap to return</span>
    </span>
    <button class="call-mini-end" type="button" aria-label="End call" title="End call">✕</button>
  `;

  callMiniBar.addEventListener("click", () => restoreActiveCallUi());
  callMiniBar
    .querySelector(".call-mini-end")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      endActiveCall("ended");
    });

  document.body.appendChild(callMiniBar);
  return callMiniBar;
}

function updateCallMiniBar(statusText = "") {
  if (!activeCall || !callMiniBar) return;
  callMiniBar.querySelector(".call-mini-icon").textContent =
    currentCallType === "video" ? "🎥" : "📞";
  callMiniBar.querySelector(".call-mini-title").textContent =
    getCallDisplayName();
  callMiniBar.querySelector(".call-mini-status").textContent =
    getCallMiniStatus(statusText);
}

function showCallMiniBar(statusText = "") {
  if (!activeCall) return;
  const bar = ensureCallMiniBar();
  updateCallMiniBar(statusText || "Call running");
  bar.classList.add("show");
}

function hideCallMiniBar() {
  if (!callMiniBar) return;
  callMiniBar.classList.remove("show");
}

function minimizeActiveCallUi(reason = "navigation") {
  if (!activeCall || activeCallMode === "incoming") return false;

  const modal = document.getElementById("callModal");
  if (modal) modal.style.display = "none";

  document.body.classList.add("call-minimized");
  showCallMiniBar(
    reason === "background" ? "Call running in background" : "Call running",
  );

  // Keep microphone/camera/WebRTC alive. Do not call cleanupCallUi here.
  return true;
}

function restoreActiveCallUi() {
  if (!activeCall) return false;

  document.body.classList.remove("call-minimized");
  hideCallMiniBar();

  const modal = document.getElementById("callModal");
  if (modal) modal.style.display = "flex";

  updateCallControlState();
  setCallStatus(callStartedAt ? "Connected" : "Connecting...");
  return true;
}

function scheduleCallConnectionFailure(status = "failed") {
  clearTimeout(callNetworkFailTimer);

  // Chrome/Android can briefly report failed/disconnected when a PWA is minimized,
  // the screen locks, or the user switches apps. Do not end immediately.
  setCallStatus(
    document.hidden ? "Reconnecting in background..." : "Reconnecting...",
  );
  showCallMiniBar("Reconnecting...");

  callNetworkFailTimer = setTimeout(
    async () => {
      if (!peerConnection || !activeCall) return;
      const state = peerConnection.connectionState;
      if (["connected", "connecting"].includes(state)) return;
      await endActiveCall(status);
    },
    document.hidden ? 45000 : 25000,
  );
}

function clearCallConnectionFailureTimer() {
  clearTimeout(callNetworkFailTimer);
  callNetworkFailTimer = null;
}

function resetLocalVideoPreviewPosition() {
  const localVideo = document.getElementById("localVideo");
  if (!localVideo) return;
  localVideo.style.left = "";
  localVideo.style.top = "";
  localVideo.style.right = "";
  localVideo.style.bottom = "";
}

function swapCallVideoViews() {
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  if (!localVideo || !remoteVideo || localVideo.style.display === "none")
    return;
  if (!localVideo.srcObject || !remoteVideo.srcObject) return;
  const localStream = localVideo.srcObject;
  localVideo.srcObject = remoteVideo.srcObject;
  remoteVideo.srcObject = localStream;
  localVideo.dataset.swapped =
    localVideo.dataset.swapped === "true" ? "false" : "true";
  localVideo.title =
    localVideo.dataset.swapped === "true"
      ? "Tap to show your camera large"
      : "Tap to show contact large";
}

function setupCallPreviewInteractions() {
  const localVideo = document.getElementById("localVideo");
  const stage = document.querySelector(".call-video-stage");
  if (!localVideo || !stage) return;

  localVideo.dataset.previewReady = "true";
  localVideo.style.touchAction = "none";
  localVideo.style.cursor = "grab";
  localVideo.style.zIndex = "50";

  let dragging = false;
  let moved = false;
  let offsetX = 0;
  let offsetY = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

  localVideo.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = false;

    const rect = localVideo.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    localVideo.setPointerCapture?.(e.pointerId);
    localVideo.style.cursor = "grabbing";
    e.preventDefault();
  });

  localVideo.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    moved = true;

    const stageRect = stage.getBoundingClientRect();
    const width = localVideo.offsetWidth;
    const height = localVideo.offsetHeight;

    const left = clamp(
      e.clientX - stageRect.left - offsetX,
      8,
      stageRect.width - width - 8,
    );
    const top = clamp(
      e.clientY - stageRect.top - offsetY,
      8,
      stageRect.height - height - 8,
    );

    localVideo.style.left = `${left}px`;
    localVideo.style.top = `${top}px`;
    localVideo.style.right = "auto";
    localVideo.style.bottom = "auto";

    e.preventDefault();
  });

  localVideo.addEventListener("pointerup", (e) => {
    dragging = false;
    localVideo.releasePointerCapture?.(e.pointerId);
    localVideo.style.cursor = "grab";
  });

  localVideo.addEventListener("pointercancel", () => {
    dragging = false;
    localVideo.style.cursor = "grab";
  });

  localVideo.addEventListener("click", (e) => {
    if (moved) {
      e.preventDefault();
      return;
    }
    swapCallVideoViews();
  });
}

function stopLocalCallStream() {
  if (localCallStream) {
    localCallStream.getTracks().forEach((track) => track.stop());
    localCallStream = null;
  }
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const remoteAudio = document.getElementById("remoteAudio");
  if (localVideo) localVideo.srcObject = null;
  if (remoteVideo) remoteVideo.srcObject = null;
  if (remoteAudio) remoteAudio.srcObject = null;
}

function cleanupGroupCallResources() {
  groupCallCandidateUnsubscribes.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch {}
  });
  groupCallCandidateUnsubscribes = [];
  if (groupCallDocUnsubscribe) {
    try {
      groupCallDocUnsubscribe();
    } catch {}
  }
  groupCallDocUnsubscribe = null;
  groupCallPeerConnections.forEach((pc) => {
    try {
      pc.close();
    } catch {}
  });
  groupCallPeerConnections.clear();
  activeGroupCallParticipants = [];
  const grid = document.getElementById("groupCallGrid");
  if (grid) {
    grid.classList.remove("active");
    grid.innerHTML = "";
  }
}

function cleanupCallUi() {
  hideMiniCallBar();
  clearCallTimeout();
  clearCallConnectionFailureTimer();
  hideCallMiniBar();
  document.body.classList.remove("call-minimized");
  stopIncomingRingtone();
  stopCallDuration();
  releaseCallWakeLock();
  const modal = document.getElementById("callModal");
  modal.style.display = "none";
  modal.querySelector(".call-shell")?.classList.remove("incoming");
  document.getElementById("callAudioAvatar")?.classList.remove("ringing");
  stopLocalCallStream();
  cleanupGroupCallResources();
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (callDocUnsubscribe) callDocUnsubscribe();
  if (callCandidatesUnsubscribe) callCandidatesUnsubscribe();
  callDocUnsubscribe = null;
  callCandidatesUnsubscribe = null;
  activeCall = null;
  activeCallMode = null;
  cameraSender = null;
  callLogWritten = false;
  lastHandledRenegotiationSdp = "";
  micMuted = false;
  cameraOff = false;
  pendingRemoteIceCandidates = [];
  updateCallControlState();
}

async function preparePeerConnection(callId, role) {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  pendingRemoteIceCandidates = [];
  peerConnection = new RTCPeerConnection(await getRtcConfig());
  remoteCallStream = new MediaStream();
  const remoteVideo = document.getElementById("remoteVideo");
  const remoteAudio = document.getElementById("remoteAudio");
  if (remoteVideo) remoteVideo.srcObject = remoteCallStream;
  if (remoteAudio) remoteAudio.srcObject = remoteCallStream;
  localCallStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video:
      currentCallType === "video"
        ? { facingMode: preferredCameraFacingMode }
        : false,
  });
  micMuted = false;
  cameraOff = false;
  updateCallControlState();
  document.getElementById("localVideo").srcObject = localCallStream;
  setTimeout(() => {
    setupCallPreviewInteractions();
  }, 300);
  localCallStream.getTracks().forEach((track) => {
    const sender = peerConnection.addTrack(track, localCallStream);
    if (track.kind === "video") cameraSender = sender;
  });
  peerConnection.ontrack = (event) => {
    event.streams[0]
      .getTracks()
      .forEach((track) => remoteCallStream.addTrack(track));
    remoteAudio?.play?.().catch(() => {});
    remoteVideo?.play?.().catch(() => {});
  };
  peerConnection.onconnectionstatechange = async () => {
    if (!peerConnection) return;
    const state = peerConnection.connectionState;
    if (state === "connected") {
      clearCallTimeout();
      clearCallConnectionFailureTimer();
      stopIncomingRingtone();
      activeCallMode = "active";
      document.getElementById("callAudioAvatar")?.classList.remove("ringing");
      document.getElementById("toggleCameraBtn").style.display =
        currentCallType === "video" ? "inline-flex" : "none";
      const switchCameraBtn = document.getElementById("switchCameraBtn");
      if (switchCameraBtn)
        switchCameraBtn.style.display =
          currentCallType === "video" ? "inline-flex" : "none";
      const addParticipantBtn = document.getElementById(
        "addCallParticipantBtn",
      );
      if (addParticipantBtn) addParticipantBtn.style.display = "inline-flex";
      setCallStatus("Connected");
      if (!callStartedAt) startCallDuration();
      requestCallWakeLock();
      if (activeCall?.id) {
        await db
          .collection("calls")
          .doc(activeCall.id)
          .set(
            {
              status: "connected",
              connectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          )
          .catch(() => {});
      }
    } else if (state === "connecting") {
      setCallStatus("Connecting...");
    } else if (state === "disconnected") {
      scheduleCallConnectionFailure("failed");
    } else if (state === "failed") {
      scheduleCallConnectionFailure("failed");
    } else if (state === "closed") {
      cleanupCallUi();
    }
  };
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      db.collection("calls")
        .doc(callId)
        .collection(role === "caller" ? "callerCandidates" : "calleeCandidates")
        .add(event.candidate.toJSON());
    }
  };
}

async function upgradeVoiceCallToVideo() {
  if (!activeCall?.id || !peerConnection || !localCallStream) return;
  try {
    setCallStatus("Starting camera...");
    const videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: preferredCameraFacingMode },
    });
    const videoTrack = videoStream.getVideoTracks()[0];
    if (!videoTrack) throw new Error("No camera track available");
    localCallStream.addTrack(videoTrack);
    cameraSender = peerConnection.addTrack(videoTrack, localCallStream);
    const localVideo = document.getElementById("localVideo");
    const remoteVideo = document.getElementById("remoteVideo");
    if (localVideo) {
      localVideo.srcObject = localCallStream;
      localVideo.style.display = "block";
      localVideo.play?.().catch(() => {});
    }
    if (remoteVideo) remoteVideo.style.display = "block";
    currentCallType = "video";
    cameraOff = false;
    if (activeCall) activeCall.type = "video";
    document.getElementById("callTypeLabel").textContent = "Video call";
    document.getElementById("toggleCameraBtn").style.display = "inline-flex";
    const switchCameraBtn = document.getElementById("switchCameraBtn");
    if (switchCameraBtn) switchCameraBtn.style.display = "inline-flex";
    updateCallControlState();
    await renegotiateActiveCall();
  } catch (error) {
    showToast(getCallPermissionMessage(error, "video"), "error");
    setCallStatus(callStartedAt ? "Connected" : "Connecting...");
  }
}

async function renegotiateActiveCall() {
  if (!activeCall?.id || !peerConnection) return;
  const callRef = db.collection("calls").doc(activeCall.id);
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await callRef.set(
    {
      offer,
      renegotiatedBy: currentUser.uid,
      type: currentCallType,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  setCallStatus("Updating call...");
}

async function handleRemoteRenegotiation(data) {
  if (
    !data?.offer ||
    !data.renegotiatedBy ||
    data.renegotiatedBy === currentUser.uid ||
    !peerConnection
  )
    return;
  if (data.offer.sdp && data.offer.sdp === lastHandledRenegotiationSdp) return;
  lastHandledRenegotiationSdp = data.offer.sdp || "";
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.offer),
  );
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  await db
    .collection("calls")
    .doc(activeCall.id)
    .set(
      {
        answer,
        type: data.type || "video",
        answeredRenegotiationBy: currentUser.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  currentCallType = data.type || "video";
  if (activeCall) activeCall.type = currentCallType;
  document.getElementById("callTypeLabel").textContent =
    currentCallType === "video" ? "Video call" : "Voice call";
  document.getElementById("remoteVideo").style.display =
    currentCallType === "video" ? "block" : "none";
}

async function setPeerRemoteDescription(description) {
  if (!peerConnection || !description) return;
  const type = description.type || description.sdp?.type;
  if (
    peerConnection.currentRemoteDescription &&
    !(type === "answer" && peerConnection.signalingState === "have-local-offer")
  )
    return;
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(description),
  );
  const candidates = [...pendingRemoteIceCandidates];
  pendingRemoteIceCandidates = [];
  for (const candidate of candidates) {
    await addRemoteIceCandidate(candidate);
  }
}

async function addRemoteIceCandidate(candidateData) {
  if (!peerConnection || !candidateData) return;
  try {
    const candidate = new RTCIceCandidate(candidateData);
    if (!peerConnection.currentRemoteDescription) {
      pendingRemoteIceCandidates.push(candidateData);
      return;
    }
    await peerConnection.addIceCandidate(candidate);
  } catch (error) {
    console.warn("Could not add ICE candidate:", error);
  }
}

function getGroupCallInitials(name = "") {
  return getInitials(name || "", "");
}

function getGroupCallPairKey(a, b) {
  return [a, b].sort().join("_");
}

function findGroupCallTile(grid, userId) {
  return Array.from(grid.querySelectorAll(".group-call-tile")).find(
    (tile) => tile.dataset.userId === userId,
  );
}

function renderGroupCallTile(userId, name, stream = null, isLocal = false) {
  const grid = document.getElementById("groupCallGrid");
  if (!grid) return;
  grid.classList.add("active");
  let tile = findGroupCallTile(grid, userId);
  if (!tile) {
    tile = document.createElement("div");
    tile.className = "group-call-tile";
    tile.dataset.userId = userId;
    tile.dataset.initials = getGroupCallInitials(name);
    tile.innerHTML = `<div class="group-call-name">${escapeHtml(isLocal ? "You" : name)}</div>`;
    grid.appendChild(tile);
  }
  tile.classList.toggle(
    "voice-only",
    currentCallType !== "video" || !stream?.getVideoTracks?.().length,
  );
  let video = tile.querySelector("video");
  if (currentCallType === "video" && stream?.getVideoTracks?.().length) {
    if (!video) {
      video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      if (isLocal) video.muted = true;
      tile.prepend(video);
    }
    video.srcObject = stream;
    video.play?.().catch(() => {});
    tile.querySelector("audio")?.remove();
  } else if (video) {
    video.remove();
  }
  if (!isLocal && stream && currentCallType !== "video") {
    let audio = tile.querySelector("audio");
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      tile.appendChild(audio);
    }
    audio.srcObject = stream;
    audio.play?.().catch(() => {});
  }
}

async function getGroupCallParticipantsFromIds(participantIds = []) {
  const participants = [];
  for (const id of participantIds) {
    if (!id) continue;
    if (id === currentUser?.uid) {
      participants.push({
        id,
        name: currentUser.displayName || currentUser.email || "You",
      });
      continue;
    }
    const existing = currentGroupMembers.find((member) => member.id === id);
    if (existing) {
      participants.push({
        id,
        name: existing.name || "Member",
        avatar: existing.avatar || "",
      });
      continue;
    }
    const userDoc = await db
      .collection("users")
      .doc(id)
      .get()
      .catch(() => null);
    const user = userDoc?.data?.() || {};
    participants.push({
      id,
      name: user.displayName || user.email || "Member",
      avatar: user.avatar || "",
    });
  }
  return participants;
}

async function prepareGroupCallLocalMedia(type = "voice") {
  currentCallType = type;
  localCallStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === "video" ? { facingMode: preferredCameraFacingMode } : false,
  });
  micMuted = false;
  cameraOff = false;
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const remoteAudio = document.getElementById("remoteAudio");
  const audioAvatar = document.getElementById("callAudioAvatar");
  if (localVideo) {
    localVideo.srcObject = null;
    localVideo.style.display = "none";
  }
  if (remoteVideo) {
    remoteVideo.srcObject = null;
    remoteVideo.style.display = "none";
  }
  if (remoteAudio) remoteAudio.srcObject = null;
  if (audioAvatar) audioAvatar.style.display = "none";
  renderGroupCallTile(
    currentUser.uid,
    currentUser.displayName || currentUser.email || "You",
    localCallStream,
    true,
  );
  updateCallControlState();
}

async function connectGroupPeer(callId, participant) {
  if (
    !participant?.id ||
    participant.id === currentUser.uid ||
    groupCallPeerConnections.has(participant.id)
  )
    return;
  const pairKey = getGroupCallPairKey(currentUser.uid, participant.id);
  const peerRef = db
    .collection("calls")
    .doc(callId)
    .collection("peers")
    .doc(pairKey);
  const pc = new RTCPeerConnection(await getRtcConfig());
  groupCallPeerConnections.set(participant.id, pc);

  localCallStream
    ?.getTracks()
    .forEach((track) => pc.addTrack(track, localCallStream));
  const remoteStream = new MediaStream();
  renderGroupCallTile(participant.id, participant.name, remoteStream, false);

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      if (
        !remoteStream.getTracks().some((existing) => existing.id === track.id)
      ) {
        remoteStream.addTrack(track);
      }
    });
    renderGroupCallTile(participant.id, participant.name, remoteStream, false);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      peerRef
        .collection(`candidates_${currentUser.uid}`)
        .add(event.candidate.toJSON())
        .catch(() => {});
    }
  };

  const remoteCandidatesUnsub = peerRef
    .collection(`candidates_${participant.id}`)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidateData = change.doc.data();
          if (!pc.currentRemoteDescription) {
            pc._pendingRemoteCandidates = [
              ...(pc._pendingRemoteCandidates || []),
              candidateData,
            ];
            return;
          }
          pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(
            (error) => console.warn("Group ICE failed:", error),
          );
        }
      });
    });
  groupCallCandidateUnsubscribes.push(remoteCandidatesUnsub);

  const amOfferer = currentUser.uid < participant.id;
  const peerUnsub = peerRef.onSnapshot(async (snapshot) => {
    const data = snapshot.data() || {};
    try {
      if (!amOfferer && data.offer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        for (const candidate of pc._pendingRemoteCandidates || []) {
          await pc
            .addIceCandidate(new RTCIceCandidate(candidate))
            .catch(() => {});
        }
        pc._pendingRemoteCandidates = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await peerRef.set(
          {
            answer,
            answererId: currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
      if (amOfferer && data.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        for (const candidate of pc._pendingRemoteCandidates || []) {
          await pc
            .addIceCandidate(new RTCIceCandidate(candidate))
            .catch(() => {});
        }
        pc._pendingRemoteCandidates = [];
      }
    } catch (error) {
      console.warn("Group peer signaling failed:", error);
    }
  });
  groupCallCandidateUnsubscribes.push(peerUnsub);

  if (amOfferer) {
    const existing = await peerRef.get();
    if (!existing.data()?.offer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await peerRef.set(
        {
          offer,
          offererId: currentUser.uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }
}

async function joinGroupCallRoom(callId, callData = {}, mode = "active") {
  if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
    showToast("Calls are not supported in this browser", "error");
    return;
  }
  cleanupGroupCallResources();
  activeCall = { id: callId, ...callData, groupCall: true };
  activeCallMode = mode;
  currentCallType = callData.type || "voice";
  const title = callData.groupName || callData.title || "Group call";
  setCallUi({
    mode: "active",
    type: currentCallType,
    title,
    status: "Connecting group call...",
  });
  document.getElementById("callTypeLabel").textContent =
    currentCallType === "video" ? "Group video call" : "Group voice call";
  const addParticipantBtn = document.getElementById("addCallParticipantBtn");
  if (addParticipantBtn) addParticipantBtn.style.display = "none";
  try {
    await prepareGroupCallLocalMedia(currentCallType);
    await db
      .collection("calls")
      .doc(callId)
      .set(
        {
          status: "ringing",
          participantStates: { [currentUser.uid]: "joined" },
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    activeGroupCallParticipants = await getGroupCallParticipantsFromIds(
      callData.participantIds || [],
    );
    for (const participant of activeGroupCallParticipants) {
      await connectGroupPeer(callId, participant);
    }
    setCallStatus("Connected");
    if (!callStartedAt) startCallDuration();
    requestCallWakeLock();
    groupCallDocUnsubscribe = db
      .collection("calls")
      .doc(callId)
      .onSnapshot((snapshot) => {
        const data = snapshot.data() || {};
        if (["ended", "cancelled", "failed", "rejected"].includes(data.status))
          cleanupCallUi();
      });
  } catch (error) {
    showToast(getCallPermissionMessage(error, currentCallType), "error");
    await db
      .collection("calls")
      .doc(callId)
      .set(
        {
          participantStates: { [currentUser.uid]: "failed" },
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      .catch(() => {});
    cleanupCallUi();
  }
}

async function startMeshGroupCall(
  type = "voice",
  participants = [],
  title = "Group call",
  groupId = "",
) {
  const unique = Array.from(
    new Map(participants.filter((p) => p?.id).map((p) => [p.id, p])).values(),
  );
  if (!unique.some((p) => p.id === currentUser.uid)) {
    unique.unshift({
      id: currentUser.uid,
      name: currentUser.displayName || currentUser.email || "You",
    });
  }
  const selected = unique.slice(0, GROUP_CALL_MAX_PARTICIPANTS);
  if (unique.length > GROUP_CALL_MAX_PARTICIPANTS) {
    showToast(
      `Starting with first ${GROUP_CALL_MAX_PARTICIPANTS} people. Free group calls are limited for stability.`,
    );
  }
  if (selected.length < 2) {
    showToast("A group call needs at least two people", "error");
    return;
  }
  const callRef = db.collection("calls").doc();
  const participantIds = selected.map((participant) => participant.id);
  const callData = {
    groupCall: true,
    groupId,
    groupName: title,
    title,
    type,
    fromUserId: currentUser.uid,
    fromUserName: currentUser.displayName || currentUser.email,
    participantIds,
    participantNames: Object.fromEntries(
      selected.map((participant) => [
        participant.id,
        participant.name || "Member",
      ]),
    ),
    participantStates: { [currentUser.uid]: "joined" },
    status: "ringing",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  await callRef.set(callData);
  await joinGroupCallRoom(callRef.id, callData, "active");
}

async function startGroupCall(type = "voice") {
  if (!currentGroup?.id) {
    showToast("Open a group first", "error");
    return;
  }
  await loadGroupMembers(currentGroup.id);
  const participants = currentGroupMembers.map((member) => ({
    id: member.id,
    name: member.name || "Member",
    avatar: member.avatar || "",
  }));
  await startMeshGroupCall(
    type,
    participants,
    currentGroup.name || "Group call",
    currentGroup.id,
  );
}

async function acceptIncomingGroupCall() {
  if (!activeCall?.groupCall) return;

  if (isNativeAndroidApp) {
    const hasMic = await ensureNativePermission("microphone");
    if (!hasMic) {
      cleanupCallUi();
      return;
    }
    if (activeCall.type === "video") {
      const hasCam = await ensureNativePermission("camera");
      if (!hasCam) {
        cleanupCallUi();
        return;
      }
    }
  }

  stopIncomingRingtone();
  clearCallTimeout();
  await joinGroupCallRoom(activeCall.id, activeCall, "active");
}

async function endGroupCall(status = "ended") {
  const callId = activeCall?.id;
  try {
    if (callId) {
      if (status === "rejected" && activeCallMode === "incoming") {
        await db
          .collection("calls")
          .doc(callId)
          .set(
            {
              participantStates: { [currentUser.uid]: "rejected" },
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        cleanupCallUi();
        return;
      }
      await db
        .collection("calls")
        .doc(callId)
        .set(
          {
            status,
            endedBy: currentUser?.uid || null,
            endedAt: firebase.firestore.FieldValue.serverTimestamp(),
            participantStates: { [currentUser.uid]: "left" },
          },
          { merge: true },
        );
    }
  } catch (error) {
    console.warn("Could not end group call:", error);
  } finally {
    cleanupCallUi();
  }
}

async function addPersonToActiveCall() {
  if (!activeCall || activeCall.groupCall) {
    showToast("Open a personal call first to add someone", "error");
    return;
  }

  const modal = document.getElementById("addCallParticipantModal");
  const input = document.getElementById("addCallParticipantInput");
  const datalist = document.getElementById("addCallParticipantSuggestions");

  if (!modal || !input || !datalist) return;

  datalist.innerHTML = "";
  const others = allUsers.filter(
    (u) => u.id !== currentUser.uid && u.id !== currentChat?.otherUserId,
  );
  others.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.email || u.phone || u.displayName;
    opt.textContent = u.displayName || u.email;
    datalist.appendChild(opt);
  });

  input.value = "";
  modal.style.display = "flex";
}

async function processAddParticipantToCall() {
  const input = document.getElementById("addCallParticipantInput").value.trim();
  if (!input) return;
  document.getElementById("addCallParticipantModal").style.display = "none";

  await refreshAllUsersOnce();
  const user = findUserByMemberInput(input);
  if (
    !user ||
    user.id === currentUser.uid ||
    user.id === currentChat?.otherUserId
  ) {
    showToast("User not found or already in the call", "error");
    return;
  }
  const existingPeer = allUsers.find(
    (u) => u.id === currentChat?.otherUserId,
  ) || {
    id: currentChat?.otherUserId,
    displayName: currentChat?.otherUserName || currentChat?.name || "Contact",
  };
  const type = currentCallType || activeCall.type || "voice";
  const participants = [
    {
      id: currentUser.uid,
      name: currentUser.displayName || currentUser.email || "You",
    },
    {
      id: existingPeer.id,
      name: existingPeer.displayName || existingPeer.email || "Contact",
    },
    { id: user.id, name: user.displayName || user.email || "Member" },
  ];
  await endActiveCall("ended");
  await startMeshGroupCall(type, participants, "Group call");
}

async function startCall(type = "voice") {
  if (isNativeAndroidApp) {
    const hasMic = await ensureNativePermission("microphone");
    if (!hasMic) return;
    if (type === "video") {
      const hasCam = await ensureNativePermission("camera");
      if (!hasCam) return;
    }
  }
  if (!currentUser || !currentChat) {
    showToast("Open a chat to start a call", "error");
    return;
  }
  if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
    showToast("Calls are not supported in this browser", "error");
    return;
  }
  if (currentChatType === "group") {
    await startGroupCall(type);
    return;
  }
  if (currentChatType !== "direct") {
    showToast("Calls are available for personal chats only", "error");
    return;
  }

  // Ask once for notification permission from the caller's user action.
  // This also stores this device's FCM token so future incoming calls can wake this device.
  ensureCallNotificationPermission().catch(() => {});

  currentCallType = type;
  const callRef = db.collection("calls").doc();
  activeCall = {
    id: callRef.id,
    type,
    fromUserId: currentUser.uid,
    fromUserName: currentUser.displayName || currentUser.email,
    toUserId: currentChat.otherUserId,
    toUserName: currentChat.otherUserName || currentChat.name || "Contact",
  };
  setCallUi({
    mode: "outgoing",
    type,
    title: activeCall.toUserName,
    status: "Calling...",
  });
  try {
    await preparePeerConnection(callRef.id, "caller");
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await callRef.set({
      ...activeCall,
      status: "ringing",
      offer,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    setCallStatus("Ringing...");
    scheduleCallTimeout(callRef, "caller");
    callDocUnsubscribe = callRef.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!data) return;
      if (data.answer && !peerConnection.currentRemoteDescription) {
        setPeerRemoteDescription(data.answer);
        setCallStatus("Connecting...");
      }
      if (
        data.answer &&
        data.answeredRenegotiationBy &&
        data.answeredRenegotiationBy !== currentUser.uid &&
        peerConnection?.signalingState === "have-local-offer"
      ) {
        setPeerRemoteDescription(data.answer);
      }
      handleRemoteRenegotiation(data);
      if (data.status === "connected") {
        setCallStatus("Connected");
        if (!callStartedAt) startCallDuration();
      }
      if (data.status === "rejected") {
        showToast("Call rejected", "error");
      }
      if (data.status === "missed") {
        showToast("Call missed", "error");
      }
      if (
        ["ended", "cancelled", "rejected", "missed", "failed"].includes(
          data.status,
        )
      )
        cleanupCallUi();
    });
    callCandidatesUnsubscribe = callRef
      .collection("calleeCandidates")
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") addRemoteIceCandidate(change.doc.data());
        });
      });
  } catch (error) {
    showToast(getCallPermissionMessage(error, type), "error");
    await callRef.set({
      ...activeCall,
      status: "failed",
      error: error.message,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    cleanupCallUi();
  }
}

async function acceptIncomingCall() {
  if (!activeCall?.id) return;

  if (isNativeAndroidApp) {
    const hasMic = await ensureNativePermission("microphone");
    if (!hasMic) {
      await db
        .collection("calls")
        .doc(activeCall.id)
        .update({ status: "rejected" });
      cleanupCallUi();
      return;
    }
    if (activeCall.type === "video") {
      const hasCam = await ensureNativePermission("camera");
      if (!hasCam) {
        await db
          .collection("calls")
          .doc(activeCall.id)
          .update({ status: "rejected" });
        cleanupCallUi();
        return;
      }
    }
  }

  currentCallType = activeCall.type || "voice";
  const callRef = db.collection("calls").doc(activeCall.id);
  setCallUi({
    mode: "active",
    type: currentCallType,
    title: activeCall.fromUserName || "Caller",
    status: "Connecting...",
  });
  stopIncomingRingtone();
  clearCallTimeout();
  try {
    await preparePeerConnection(activeCall.id, "callee");
    await setPeerRemoteDescription(activeCall.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await callRef.update({
      answer,
      status: "accepted",
      acceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    setCallStatus("Connecting...");
    callCandidatesUnsubscribe = callRef
      .collection("callerCandidates")
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") addRemoteIceCandidate(change.doc.data());
        });
      });
    callDocUnsubscribe = callRef.onSnapshot((snapshot) => {
      handleRemoteRenegotiation(snapshot.data());
      const status = snapshot.data()?.status;
      if (status === "connected") {
        setCallStatus("Connected");
        if (!callStartedAt) startCallDuration();
      }
      if (
        ["ended", "cancelled", "rejected", "missed", "failed"].includes(
          snapshot.data()?.status,
        )
      )
        cleanupCallUi();
    });
  } catch (error) {
    showToast(getCallPermissionMessage(error, currentCallType), "error");
    await callRef.update({ status: "failed", error: error.message });
    cleanupCallUi();
  }
}

async function autoAcceptNativeCall(callId) {
  if (!callId || !currentUser) return;

  try {
    const callRef = db.collection("calls").doc(callId);
    const snap = await callRef.get();

    if (!snap.exists) return;

    const callData = snap.data() || {};

    if (callData.toUserId !== currentUser.uid) return;
    if (!["ringing", "accepted"].includes(callData.status)) return;

    activeCall = { id: snap.id, ...callData };
    currentCallType = activeCall.type || "voice";

    await acceptIncomingCall();
  } catch (error) {
    console.warn("autoAcceptNativeCall failed:", error);
    showToast("Could not open accepted call. Please try again.", "error");
  }
}

async function endActiveCall(status = "ended") {
  const call = activeCall ? { ...activeCall } : null;
  const callId = call?.id;
  const mode = activeCallMode;
  const endBtn = document.getElementById("endCallBtn");
  const closeBtn = document.getElementById("closeCallBtn");
  const rejectBtn = document.getElementById("rejectCallBtn");

  [endBtn, closeBtn, rejectBtn].forEach((btn) => {
    if (btn) btn.disabled = true;
  });
  setCallStatus(status === "rejected" ? "Rejecting..." : "Ending call...");

  try {
    if (callId) {
      const callRef = db.collection("calls").doc(callId);
      const snapshot = await callRef.get().catch(() => null);
      const currentStatus =
        snapshot?.data?.()?.status || call.status || "ringing";

      let finalStatus = status;
      if (
        status === "ended" &&
        currentStatus === "ringing" &&
        mode === "outgoing"
      ) {
        finalStatus = "cancelled";
      }

      if (
        ["ended", "missed", "failed"].includes(finalStatus) &&
        currentStatus !== "ringing"
      ) {
        await writeCallHistory(finalStatus).catch((error) =>
          console.warn("Call history failed:", error),
        );
      }

      await callRef.set(
        {
          status: finalStatus,
          endedAt: firebase.firestore.FieldValue.serverTimestamp(),
          endedBy: currentUser?.uid || null,
        },
        { merge: true },
      );
    }
  } catch (error) {
    console.warn("Could not end call cleanly:", error);
    showToast("Could not update call status, closing call screen", "error");
  } finally {
    [endBtn, closeBtn, rejectBtn].forEach((btn) => {
      if (btn) btn.disabled = false;
    });
    cleanupCallUi();
  }
}

function listenForIncomingCalls() {
  if (!currentUser) return;
  if (incomingCallsUnsubscribe) incomingCallsUnsubscribe();
  if (groupCallsUnsubscribe) groupCallsUnsubscribe();
  incomingCallsUnsubscribe = db
    .collection("calls")
    .where("toUserId", "==", currentUser.uid)
    .where("status", "==", "ringing")
    .onSnapshot(
      (snapshot) => {
        const call = snapshot.docs[0];

        if (!call) {
          if (activeCallMode === "incoming") cleanupCallUi();
          return;
        }

        // If another active connected/outgoing call is running, do not interrupt it.
        if (
          activeCall &&
          activeCall.id !== call.id &&
          activeCallMode !== "incoming"
        )
          return;

        if (!activeCall || activeCall.id !== call.id) {
          activeCall = { id: call.id, ...call.data() };
          currentCallType = activeCall.type || "voice";
          setCallUi({
            mode: "incoming",
            type: currentCallType,
            title: activeCall.fromUserName || "Incoming call",
            status:
              currentCallType === "video"
                ? "Incoming video call"
                : "Incoming voice call",
          });
          notifyIncomingCall(activeCall);
          startIncomingRingtone();
          scheduleCallTimeout(
            db.collection("calls").doc(activeCall.id),
            "receiver",
          );

          if (callDocUnsubscribe) callDocUnsubscribe();
          callDocUnsubscribe = db
            .collection("calls")
            .doc(activeCall.id)
            .onSnapshot((callSnapshot) => {
              const status = callSnapshot.data()?.status;
              if (
                ["ended", "cancelled", "rejected", "missed", "failed"].includes(
                  status,
                )
              ) {
                cleanupCallUi();
              }
            });
        }
      },
      (error) => {
        console.warn("Incoming call listener failed:", error);
      },
    );

  groupCallsUnsubscribe = db
    .collection("calls")
    .where("participantIds", "array-contains", currentUser.uid)
    .onSnapshot(
      (snapshot) => {
        const call = snapshot.docs.find((doc) => {
          const data = doc.data() || {};
          return (
            data.groupCall === true &&
            data.status === "ringing" &&
            data.fromUserId !== currentUser.uid &&
            !["joined", "rejected", "left"].includes(
              data.participantStates?.[currentUser.uid],
            )
          );
        });

        if (!call) {
          if (activeCallMode === "incoming" && activeCall?.groupCall)
            cleanupCallUi();
          return;
        }

        if (
          activeCall &&
          activeCall.id !== call.id &&
          activeCallMode !== "incoming"
        )
          return;
        if (!activeCall || activeCall.id !== call.id) {
          activeCall = { id: call.id, ...call.data(), groupCall: true };
          currentCallType = activeCall.type || "voice";
          setCallUi({
            mode: "incoming",
            type: currentCallType,
            title: activeCall.groupName || activeCall.title || "Group call",
            status:
              currentCallType === "video"
                ? "Incoming group video call"
                : "Incoming group voice call",
          });
          document.getElementById("callTypeLabel").textContent =
            currentCallType === "video"
              ? "Group video call"
              : "Group voice call";
          notifyIncomingCall({
            ...activeCall,
            fromUserName:
              activeCall.groupName || activeCall.fromUserName || "Group call",
          });
          startIncomingRingtone();
        }
      },
      (error) => {
        console.warn("Incoming group call listener failed:", error);
      },
    );
}

function handleCallCloseAction() {
  if (activeCall?.groupCall) {
    endGroupCall(activeCallMode === "incoming" ? "rejected" : "ended");
    return;
  }
  if (activeCallMode === "incoming") {
    endActiveCall("rejected");
    return;
  }
  endActiveCall("ended");
}

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem("offlineMessageQueue") || "[]");
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue) {
  localStorage.setItem("offlineMessageQueue", JSON.stringify(queue));
}

function queueOfflineMessage(messageData, chatSnapshot) {
  const queue = getOfflineQueue();
  queue.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    messageData: {
      ...messageData,
      timestamp: new Date().toISOString(),
      readBy: { [currentUser.uid]: new Date().toISOString() },
    },
    chatSnapshot,
    queuedAt: new Date().toISOString(),
  });
  saveOfflineQueue(queue);
}

async function flushOfflineQueue() {
  if (!navigator.onLine || !currentUser) return;
  const queue = getOfflineQueue();
  if (!queue.length) return;
  const remaining = [];
  for (const item of queue) {
    try {
      const messageData = {
        ...item.messageData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        readBy: {
          [currentUser.uid]: new Date(
            item.messageData.readBy?.[currentUser.uid] || Date.now(),
          ),
        },
      };
      await db.collection("messages").add(messageData);
      if (item.chatSnapshot?.type === "direct") {
        await db
          .collection("directChats")
          .doc(item.chatSnapshot.id)
          .update({
            lastMessage:
              messageData.text || (messageData.attachment ? "Attachment" : ""),
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          });
      } else if (item.chatSnapshot?.type === "group") {
        await db.collection("groups").doc(item.chatSnapshot.id).update({
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      remaining.push(item);
    }
  }
  saveOfflineQueue(remaining);
  if (queue.length !== remaining.length) {
    showToast("Queued messages sent");
    loadMessages();
    loadMessages();
    loadCurrentChatList();
  }
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate();
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date) {
  if (!date) return "";
  return date.toLocaleDateString();
}

function getDirectChatId(userId1, userId2) {
  return [userId1, userId2].sort().join("_");
}

function normalizeEmail(email = "") {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeSearchText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getNameTokens(value = "") {
  return normalizeSearchText(value)
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function isExactNameBlockMatch(name = "", term = "") {
  const cleanTerm = normalizeSearchText(term);
  if (!cleanTerm) return false;
  return getNameTokens(name).some((part) => part === cleanTerm);
}

function matchesIdentitySearch(entity = {}, rawTerm = "") {
  const term = normalizeSearchText(rawTerm);
  if (!term) return false;

  const digits = term.replace(/\D/g, "");
  const email = normalizeEmail(entity.email || "");
  const phone = String(entity.phone || entity.phoneNumber || "").replace(
    /\D/g,
    "",
  );
  const names = [entity.displayName, entity.name, entity.fullName].filter(
    Boolean,
  );
  const username = (entity.username || "").toLowerCase();

  // Phone search remains partial, but only when the user types numbers.
  if (digits.length > 0 && phone) return phone.includes(digits);

  // Email search remains partial, but only when the query clearly looks like an email search.
  const looksLikeEmailSearch = term.includes("@") || term.includes(".");
  if (looksLikeEmailSearch) {
    // Check @username match
    if (username && term.startsWith("@"))
      return username.includes(term.replace("@", ""));
    return email.includes(term);
  }

  if (username && term.startsWith("@"))
    return username.includes(term.replace("@", ""));

  return names.some((name) => {
    const cleanName = normalizeSearchText(name);
    return (
      cleanName.includes(term) ||
      getNameTokens(name).some((part) => part.startsWith(term))
    );
  });
}

function matchesNewContactLookup(entity = {}, rawTerm = "") {
  const term = normalizeSearchText(rawTerm);
  if (!term) return false;

  const digits = term.replace(/\D/g, "");
  const phone = String(entity.phone || entity.phoneNumber || "").replace(
    /\D/g,
    "",
  );
  if (digits.length >= 6 && phone) return phone === digits;

  const email = normalizeEmail(entity.email || "");
  if ((term.includes("@") || term.includes(".")) && email) {
    if (term.startsWith("@")) {
      const username = (entity.username || "").toLowerCase();
      return username === term.replace("@", "");
    }
    return email === term;
  }

  const username = (entity.username || "").toLowerCase();
  if (username && term.startsWith("@"))
    return username === term.replace("@", "");

  return false;
}

function decorateSearchItems(items = [], section = "", searchResultType = "") {
  return items.map((item) => ({
    ...item,
    section,
    searchResultType: searchResultType || item.searchResultType || "",
  }));
}

function getChatListPreviewText(preview = "", chatType = "") {
  const text = String(preview || "").trim();
  if (!text) return "";

  if (/^missed\s+(voice|video)\s+call/i.test(text)) return text;
  if (/^(voice|video)\s+call\s+(ended|cancelled|declined)/i.test(text))
    return "";

  if (chatType === "direct") return "";
  return text;
}

function isSearchableUser(user = {}) {
  if (
    !user.id ||
    user.id === currentUser?.uid ||
    isBlocked(user.id) ||
    user.isActive === false
  )
    return false;
  if (user.pendingVerification === true && user.emailVerified === false)
    return false;
  return Boolean(
    user.email || user.displayName || user.phone || user.phoneNumber,
  );
}

function normalizeUserDoc(doc) {
  const data = doc.data ? doc.data() : doc;
  const phone = data.phone || data.phoneNumber || "";
  const email = normalizeEmail(data.email);
  const displayName =
    data.displayName ||
    data.name ||
    data.fullName ||
    (email || "").split("@")[0] ||
    "User";
  return {
    id: doc.id || data.id || data.uid,
    ...data,
    email,
    displayName,
    phone,
  };
}

function getFallbackDirectoryUsers() {
  return AUTH_DIRECTORY_FALLBACKS.filter(
    (user) => user.id !== currentUser?.uid,
  ).map((user) => {
    const email = normalizeEmail(user.email);
    return {
      ...user,
      email,
      uid: user.id,
      displayName: user.displayName || email.split("@")[0] || "User",
      emailVerified: true,
      pendingVerification: false,
      isActive: true,
      onlineStatus: "offline",
      source: "authFallback",
    };
  });
}

function getUserDedupeKey(user = {}) {
  const email = normalizeEmail(user.email);
  if (email) return `email:${email}`;
  const phone = String(user.phone || user.phoneNumber || "").replace(/\D/g, "");
  if (phone.length >= 6) return `phone:${phone}`;
  return `uid:${user.id}`;
}

function getDirectChatIdsForCurrentChat() {
  if (!currentChat || currentChatType !== "direct") return [];
  return [
    ...new Set(
      [currentChat.id, ...(currentChat.aliasDirectIds || [])].filter(Boolean),
    ),
  ].slice(0, 10);
}

function getContactMergeKey(item) {
  const email = normalizeEmail(item.email || item.user?.email || "");
  if (email) return `email:${email}`;
  const phone = (
    (item.phone || item.user?.phone || item.user?.phoneNumber || "") + ""
  ).replace(/\D/g, "");
  if (phone.length >= 6) return `phone:${phone}`;
  return `name:${(item.name || "").trim().toLowerCase()}`;
}

function findProfileByFallbackName(name) {
  const cleanName = (name || "").trim().toLowerCase();
  if (!cleanName || cleanName === "unknown contact") return null;
  return (
    allUsers.find(
      (user) =>
        (user.displayName || "").trim().toLowerCase() === cleanName ||
        (user.email || "").trim().toLowerCase() === cleanName,
    ) || null
  );
}

function findProfileByEmail(email) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return null;
  return (
    allUsers.find((user) => normalizeEmail(user.email) === cleanEmail) || null
  );
}

function mergeDirectContactItems(items) {
  const merged = [];
  const groups = new Map();

  for (const item of items) {
    if (item.type !== "direct") {
      merged.push(item);
      continue;
    }

    const key = getContactMergeKey(item);
    if (!key || key === "name:") {
      merged.push(item);
      continue;
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  for (const groupItems of groups.values()) {
    if (groupItems.length === 1) {
      merged.push(groupItems[0]);
      continue;
    }

    const sorted = [...groupItems].sort(
      (a, b) => b.lastMessageTime - a.lastMessageTime,
    );
    const profileBacked = sorted.find((item) => item.hasUserProfile);
    const primary = { ...(profileBacked || sorted[0]) };
    const latest = sorted[0];
    primary.id = profileBacked?.id || latest.id;
    primary.preview = latest.preview;
    primary.lastMessageTime = latest.lastMessageTime;
    primary.unreadCount = groupItems.reduce(
      (total, item) => total + (item.unreadCount || 0),
      0,
    );
    primary.isFavorite = groupItems.some((item) => item.isFavorite);
    primary.isMuted = groupItems.some((item) => item.isMuted);
    primary.aliasDirectIds = [
      ...new Set(
        groupItems.flatMap((item) => item.aliasDirectIds || [item.id]),
      ),
    ];
    primary.mergedContactCount = groupItems.length;
    merged.push(primary);
  }

  return merged;
}

function isChatDebugEnabled() {
  return localStorage.getItem("teamChatDebug") === "true";
}

async function chatDebug() {
  const user = auth.currentUser;
  if (!user) {
    console.log("CHAT_DEBUG: not logged in");
    return null;
  }

  const report = {
    uid: user.uid,
    email: user.email,
    directChats: [],
    acceptedRequestsSent: [],
    acceptedRequestsReceived: [],
    messagesWithParticipants: [],
    sentDirectMessages: [],
    allUsers: [],
    builtAllItems: [],
  };

  const directChats = await db
    .collection("directChats")
    .where("participants", "array-contains", user.uid)
    .get();
  report.directChats = directChats.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const sentAccepted = await db
    .collection("chatRequests")
    .where("fromUserId", "==", user.uid)
    .where("status", "==", "accepted")
    .get();
  report.acceptedRequestsSent = sentAccepted.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const receivedAccepted = await db
    .collection("chatRequests")
    .where("toUserId", "==", user.uid)
    .where("status", "==", "accepted")
    .get();
  report.acceptedRequestsReceived = receivedAccepted.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  try {
    const messagesWithParticipants = await db
      .collection("messages")
      .where("participants", "array-contains", user.uid)
      .limit(20)
      .get();
    report.messagesWithParticipants = messagesWithParticipants.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }),
    );
  } catch (error) {
    report.messagesWithParticipantsError = error.message;
  }

  const sentDirectMessages = await db
    .collection("messages")
    .where("senderId", "==", user.uid)
    .limit(20)
    .get();
  report.sentDirectMessages = sentDirectMessages.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const users = await db.collection("users").limit(20).get();
  report.allUsers = users.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  try {
    report.builtAllItems = await buildDirectChatItems();
  } catch (error) {
    report.builtAllItemsError = error.message;
  }

  console.log("CHAT_DEBUG_REPORT", report);
  return report;
}

async function renderChatDebugPanel() {
  if (
    !isChatDebugEnabled() ||
    !new URLSearchParams(window.location.search).has("debugChats")
  )
    return;
  const panel = document.createElement("pre");
  panel.id = "chatDebugPanel";
  panel.style.cssText =
    "position:fixed;inset:12px;z-index:99999;overflow:auto;background:#111b21;color:#e9edef;padding:16px;border-radius:8px;font:12px/1.4 monospace;white-space:pre-wrap;";
  panel.textContent = "Loading chat debug report...";
  document.body.appendChild(panel);
  try {
    const report = await chatDebug();
    panel.textContent = JSON.stringify(report, null, 2);
  } catch (error) {
    panel.textContent = `Debug failed: ${error.message || error}`;
  }
}

async function reconnectSameEmailProfile() {
  if (!currentUser?.email) return;

  try {
    const email = normalizeEmail(currentUser.email);
    const sameEmailUsers = await db
      .collection("users")
      .where("email", "==", email)
      .get();

    const oldUserIds = sameEmailUsers.docs
      .map((doc) => doc.id)
      .filter((id) => id && id !== currentUser.uid);

    if (!oldUserIds.length) return;

    for (const oldUserId of oldUserIds) {
      const oldChats = await db
        .collection("directChats")
        .where("participants", "array-contains", oldUserId)
        .get();

      for (const oldChatDoc of oldChats.docs) {
        const oldChat = oldChatDoc.data();
        const otherUserId = (oldChat.participants || []).find(
          (id) => id !== oldUserId,
        );
        if (!otherUserId || otherUserId === currentUser.uid) continue;

        const newChatId = getDirectChatId(currentUser.uid, otherUserId);
        await db
          .collection("directChats")
          .doc(newChatId)
          .set(
            {
              participants: [currentUser.uid, otherUserId],
              participantEmails: {
                [currentUser.uid]: normalizeEmail(currentUser.email),
                [otherUserId]: oldChat.participantEmails?.[otherUserId] || "",
              },
              participantNames: {
                [currentUser.uid]: currentUser.displayName || currentUser.email,
                [otherUserId]:
                  oldChat.participantNames?.[otherUserId] || "User",
              },
              status: "active",
              aliasDirectIds: firebase.firestore.FieldValue.arrayUnion(
                oldChatDoc.id,
              ),
              lastMessage: oldChat.lastMessage || "",
              lastMessageTime:
                oldChat.lastMessageTime ||
                firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
      }
    }
  } catch (error) {
    console.warn("reconnectSameEmailProfile skipped:", error);
  }
}
async function loadFavoriteChatIds() {
  if (!currentUser) return;
  const snapshot = await db
    .collection("favoriteChats")
    .where("userId", "==", currentUser.uid)
    .get();
  favoriteChatIds = snapshot.docs.map((doc) => doc.data().chatId);
}

async function toggleFavoriteChat(chatId, chatType) {
  if (!currentUser || !chatId || !chatType) return;
  const existing = await db
    .collection("favoriteChats")
    .where("userId", "==", currentUser.uid)
    .where("chatId", "==", chatId)
    .where("chatType", "==", chatType)
    .get();
  if (!existing.empty) {
    await existing.docs[0].ref.delete();
    showToast("Removed from favorites");
  } else {
    await db.collection("favoriteChats").add({
      userId: currentUser.uid,
      chatId,
      chatType,
      addedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("Added to favorites");
  }
  await loadFavoriteChatIds();
  loadChatsList();
  loadGroupsList();
}

async function loadPinnedChatIds() {
  if (!currentUser) return;
  try {
    const userDoc = await db.collection("users").doc(currentUser.uid).get();
    pinnedChatIds = userDoc.data()?.pinnedChatIds || [];
  } catch (error) {
    pinnedChatIds = [];
  }
}

let currentUserStatus = {
  preset: "available",
  emoji: "🟢",
  text: "Available",
  expiry: null,
};
const STATUS_ICONS = {
  available: "🟢",
  busy: "🔴",
  "at-work": "💼",
  "in-meeting": "📅",
  dnd: "⛔",
  vacation: "🌴",
  sleeping: "😴",
  custom: "✏️",
};
const STATUS_LABELS = {
  available: "Available",
  busy: "Busy",
  "at-work": "At work",
  "in-meeting": "In meeting",
  dnd: "Do not disturb",
  vacation: "On vacation",
  sleeping: "Sleeping",
  custom: "Custom",
};

function updateSidebarStatus() {
  const textEl = document.getElementById("userStatusText");
  const dotEl = document.getElementById("userStatusDot");
  if (!textEl) return;
  const status = currentUserStatus;
  const isOnline = document.visibilityState !== "hidden";
  let displayText = status.text || STATUS_LABELS[status.preset] || "Available";
  if (dotEl) {
    dotEl.className = "status-dot " + (status.preset || "available");
  }
  textEl.textContent = displayText;
}

async function loadUserStatus() {
  if (!currentUser) return;
  try {
    const doc = await db.collection("users").doc(currentUser.uid).get();
    const data = doc.data() || {};
    if (data.status) {
      currentUserStatus = {
        preset: data.status.preset || "available",
        emoji: data.status.emoji || STATUS_ICONS[data.status.preset] || "🟢",
        text:
          data.status.text ||
          data.statusText ||
          STATUS_LABELS[data.status.preset] ||
          "Available",
        expiry: data.status.expiry || null,
      };
      if (data.statusText && !data.status?.text)
        currentUserStatus.text = data.statusText;
    } else if (data.statusText) {
      currentUserStatus = {
        preset: "custom",
        emoji: "✏️",
        text: data.statusText,
        expiry: null,
      };
    }
    updateSidebarStatus();
  } catch (e) {
    console.warn("Could not load user status:", e);
  }
}

async function updateUserStatus(statusData) {
  if (!currentUser) return;
  const preset = statusData.preset || currentUserStatus.preset || "available";
  const emoji = statusData.emoji || STATUS_ICONS[preset] || "🟢";
  const text = statusData.text || STATUS_LABELS[preset] || "Available";
  const expiry = statusData.expiry || null;
  const updateData = {
    status: { preset, emoji, text, expiry },
    statusText: text,
  };
  await db
    .collection("users")
    .doc(currentUser.uid)
    .update(updateData)
    .catch(async () => {
      await db
        .collection("users")
        .doc(currentUser.uid)
        .set(updateData, { merge: true });
    });
  currentUserStatus = { preset, emoji, text, expiry };
  updateSidebarStatus();
  showToast("Status updated");
}

async function togglePinChat(chatId) {
  if (!currentUser || !chatId) return;
  const userRef = db.collection("users").doc(currentUser.uid);
  if (pinnedChatIds.includes(chatId)) {
    await userRef.update({
      pinnedChatIds: firebase.firestore.FieldValue.arrayRemove(chatId),
    });
    showToast("Chat unpinned");
  } else {
    await userRef.update({
      pinnedChatIds: firebase.firestore.FieldValue.arrayUnion(chatId),
    });
    showToast("Chat pinned to top");
  }
  await loadPinnedChatIds();
  loadChatsList();
  loadGroupsList();
}

async function getChatUnreadCount(chatId, chatType) {
  if (!currentUser || !chatId || !chatType) return 0;

  try {
    const fieldName = chatType === "direct" ? "directId" : "groupId";
    const directIds =
      chatType === "direct" && Array.isArray(chatId)
        ? chatId.filter(Boolean).slice(0, 10)
        : null;

    const query = db
      .collection("messages")
      .where(fieldName, directIds ? "in" : "==", directIds || chatId);

    const snapshot = await query.get();

    return snapshot.docs.filter((doc) => {
      const data = doc.data() || {};

      if (!data.senderId || data.senderId === currentUser.uid) return false;
      if (data.deletedFor?.[currentUser.uid]) return false;
      if (data.deletedForEveryone) return false;
      if (data.readBy?.[currentUser.uid]) return false;

      return true;
    }).length;
  } catch (error) {
    console.warn("Could not calculate unread count:", error);
    return 0;
  }
}
async function markChatReadState(chatId, chatType, readState) {
  if (!currentUser || !chatId || !chatType) return;

  try {
    const fieldName = chatType === "direct" ? "directId" : "groupId";
    const directIds =
      chatType === "direct" && Array.isArray(chatId)
        ? chatId.filter(Boolean).slice(0, 10)
        : null;

    const query = db
      .collection("messages")
      .where(fieldName, directIds ? "in" : "==", directIds || chatId);

    const snapshot = await query.get();
    const batch = db.batch();
    let updatesMade = false;

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};

      if (!data.senderId || data.senderId === currentUser.uid) return;
      if (data.deletedFor?.[currentUser.uid]) return;
      if (data.deletedForEveryone) return;

      const updates = {
        read: readState,
      };

      if (readState) {
        updates[`readBy.${currentUser.uid}`] =
          firebase.firestore.FieldValue.serverTimestamp();
        updates.status = "read";
      } else {
        updates[`readBy.${currentUser.uid}`] =
          firebase.firestore.FieldValue.delete();
        updates.status = data.deliveredTo?.[currentUser.uid]
          ? "delivered"
          : "sent";
      }

      batch.update(doc.ref, updates);
      updatesMade = true;
    });

    if (updatesMade) await batch.commit();

    showToast(readState ? "Marked as read" : "Marked as unread");
    loadCurrentChatList();
  } catch (error) {
    console.warn("Could not change read state:", error);
    showToast("Could not update read state", "error");
  }
}

function isValidIndianPhone(phone) {
  return /^[6-9]\d{9}$/.test(String(phone || "").trim());
}

function isCompleteEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
    String(email || "")
      .trim()
      .toLowerCase(),
  );
}

// ========================================
// UPLOAD FUNCTIONS
// ========================================

async function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      },
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.secure_url) resolve(data.secure_url);
        else reject("Upload failed");
      })
      .catch(reject);
  });
}

async function uploadDocument(file) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("resource_type", "auto");
    fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
      {
        method: "POST",
        body: formData,
      },
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.secure_url) resolve(data.secure_url);
        else reject("Upload failed");
      })
      .catch(reject);
  });
}

// ========================================================================
// FIXED: STRICT PREFIX & EXACT MULTI-CRITERIA SEARCH ENGINE
// ========================================================================
async function searchUsersRealtime(searchTerm) {
  const chatsList = document.getElementById("chatsList");
  if (!chatsList) return;

  if (!searchTerm || searchTerm.trim() === "") {
    loadCurrentChatList();
    return;
  }

  const term = searchTerm.trim().toLowerCase();

  if (currentViewTab === "groups") {
    searchGroupsRealtime(term);
    return;
  }

  await refreshAllUsersOnce();
  loadAllChatsList(term);
}

// ========================================================================
// FIXED: COMBINED REAL-TIME HISTORY & DIRECTORY LOOKUP ENGINE
// ========================================================================
// ========================================================================
// FIXED: COMBINED REAL-TIME HISTORY & DIRECTORY LOOKUP ENGINE
// ========================================================================
async function loadAllChatsList(searchTerm = "") {
  const chatsList = document.getElementById("chatsList");
  if (!chatsList) return;

  // Show skeleton loading while fetching
  if (!searchTerm) {
    chatsList.innerHTML = Array(5)
      .fill("")
      .map(
        () => `
      <div class="chat-list-skeleton">
        <div class="skeleton skeleton-avatar"></div>
        <div class="skeleton-lines">
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line short"></div>
        </div>
      </div>
    `,
      )
      .join("");
  }

  // 1. Compile conversations from active chat histories
  let directItems = [];
  let groupItems = [];

  try {
    directItems = await buildDirectChatItems();
  } catch (error) {
    console.error("buildDirectChatItems failed:", error);
  }

  try {
    groupItems = await buildGroupChatItems();
  } catch (error) {
    console.error("buildGroupChatItems failed:", error);
  }
  const allItems = [...directItems, ...groupItems];
  updateUnreadBadges(allItems);

  let items = [...allItems];
  if (currentViewTab === "favorites")
    items = items.filter((item) => item.isFavorite);
  if (currentViewTab === "unread")
    items = items.filter((item) => item.unreadCount > 0);
  if (currentViewTab === "muted") items = items.filter((item) => item.isMuted);
  if (activeFolderChatIds)
    items = items.filter((item) => activeFolderChatIds.has(item.id));

  const term = searchTerm.trim().toLowerCase();

  if (term) {
    // MATCH 1: Search existing active chat logs.
    // Name matching is intentionally strict and only matches a complete name block.
    const chatMatches = items.filter((item) =>
      matchesIdentitySearch(
        {
          displayName: item.name,
          name: item.name,
          email: item.email,
          phone: item.phone,
        },
        term,
      ),
    );

    // Track unique IDs that are already matching in your chat history view
    const visibleUserIds = new Set();
    chatMatches.forEach((item) => {
      if (item.otherUserId) visibleUserIds.add(item.otherUserId);
      if (item.user?.id) visibleUserIds.add(item.user.id);
    });

    const userMatches = [];

    await refreshAllUsersOnce();

    // MATCH 2: Look through the directory for users you haven't messaged yet
    for (const user of allUsers.filter(isSearchableUser)) {
      // PREVENT CONFLICTS: Skip if this user is already visible in chatMatches
      if (visibleUserIds.has(user.id)) continue;

      const isMatch = matchesNewContactLookup(user, term);

      if (isMatch) {
        const requestState = await getContactRequestState(user.id); // Fixed reference pass

        userMatches.push({
          id: `user_${user.id}`,
          type: "user",
          name: user.displayName || user.email || "User",
          avatar: user.avatar
            ? `<img src="${user.avatar}">`
            : escapeHtml((user.displayName || "?")[0].toUpperCase()),
          preview: user.email || user.phone || "Tap to connect",
          requestState,
          unreadCount: 0,
          isFavorite: false,
          isPinned: false,
          isMuted: false,
          onlineStatus: user.onlineStatus || "offline",
          rawUser: user, // renamed tracker internally to completely avoid property conflicts
          lastMessageTime: new Date(0),
        });
      }
    }

    // FIXED CORRECTION LAYER: Read directly from item.id to completely avoid mapping crashes
    const cleanUserMatches = Array.from(
      new Map(userMatches.map((u) => [u.id, u])).values(),
    );
    const chatMatchKeys = new Set(
      chatMatches.map((item) => `${item.type}:${item.id}`),
    );
    const messageSearchItems = await buildMessageSearchChatItems(allItems);
    const messageMatches = await searchMessagesInChats(
      messageSearchItems,
      term,
    );
    const contactMatches = cleanUserMatches.filter(
      (item) => !chatMatchKeys.has(`${item.type}:${item.id}`),
    );
    items = [
      ...decorateSearchItems(chatMatches, "Chats", "chat"),
      ...decorateSearchItems(contactMatches, "Contacts", "contact"),
      ...decorateSearchItems(messageMatches, "Messages", "message"),
    ];
  } else {
    // Whitelist core operational fallback: when no search text is active, default back to showing WhatsApp style history list
    items = [...allItems];
    if (currentViewTab === "favorites")
      items = items.filter((item) => item.isFavorite);
    if (currentViewTab === "unread")
      items = items.filter((item) => item.unreadCount > 0);
    if (currentViewTab === "muted")
      items = items.filter((item) => item.isMuted);
    if (activeFolderChatIds)
      items = items.filter((item) => activeFolderChatIds.has(item.id));
  }

  if (
    !document.getElementById("searchInput")?.value?.trim() &&
    currentViewTab === "all" &&
    !activeFolderChatIds
  ) {
    items = applyChatOrder(items);
  }
  items.sort((a, b) => {
    if (a.section || b.section) {
      const order = { Chats: 1, Contacts: 2, Messages: 3 };
      const sectionDiff = (order[a.section] || 99) - (order[b.section] || 99);
      if (sectionDiff) return sectionDiff;
    }
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (
      b.lastMessageTime - a.lastMessageTime || a.name.localeCompare(b.name)
    );
  });
  renderChatListItems(items, chatsList);
}

async function searchMessagesInChats(chatItems = [], term = "") {
  if (!currentUser || !term || term.length < 2) return [];
  const results = [];
  const uniqueChats = Array.from(
    new Map(
      chatItems
        .filter(
          (item) =>
            item.type === "direct" ||
            item.type === "group" ||
            item.type === "saved",
        )
        .map((item) => [`${item.type}:${item.id}`, item]),
    ).values(),
  ).slice(0, 50);

  for (const item of uniqueChats) {
    try {
      const field = item.type === "group" ? "groupId" : "directId";
      const targetIds =
        item.type === "direct"
          ? [
              ...new Set(
                [item.id, ...(item.aliasDirectIds || [])].filter(Boolean),
              ),
            ].slice(0, 10)
          : [item.id];
      let query = db
        .collection("messages")
        .where(
          field,
          targetIds.length > 1 ? "in" : "==",
          targetIds.length > 1 ? targetIds : targetIds[0],
        );
      const snapshot = await query.limit(120).get();
      const matches = snapshot.docs
        .map((doc) => doc.data())
        .filter(
          (msg) =>
            !msg.deletedFor?.[currentUser.uid] && !msg.deletedForEveryone,
        )
        .filter((msg) => {
          const body = [
            msg.text,
            msg.senderName,
            msg.attachment?.filename,
            msg.attachment?.url,
            msg.poll?.question,
            msg.poll?.options?.join?.(" "),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return body.includes(term);
        })
        .sort(
          (a, b) =>
            (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0),
        )
        .slice(0, 3);
      for (const match of matches) {
        results.push({
          ...item,
          searchResultType: "message",
          preview: `Message: ${(match.text || match.attachment?.filename || match.poll?.question || "match").replace(/\s+/g, " ").slice(0, 90)}`,
          lastMessageTime:
            match.timestamp?.toDate?.() || item.lastMessageTime || new Date(0),
        });
      }
    } catch (error) {
      console.warn("Message search skipped for chat:", item.id, error);
    }
  }
  return results;
}

async function buildMessageSearchChatItems(visibleItems = []) {
  const items = [...visibleItems];
  const seen = new Set(visibleItems.map((item) => `${item.type}:${item.id}`));

  try {
    const archivedSnapshot = await db
      .collection("archivedChats")
      .where("userId", "==", currentUser.uid)
      .get();

    archivedSnapshot.docs.forEach((doc) => {
      const archive = doc.data() || {};
      if (!archive.chatId || !archive.chatType) return;
      const key = `${archive.chatType}:${archive.chatId}`;
      if (seen.has(key)) return;
      seen.add(key);
      const name =
        archive.chatName ||
        (archive.chatType === "group" ? "Group" : "Archived chat");
      items.push({
        id: archive.chatId,
        type: archive.chatType,
        name,
        avatar:
          archive.chatType === "group"
            ? escapeHtml(getInitials(name || "Group"))
            : escapeHtml(getInitials(name)),
        preview: "Archived",
        unreadCount: 0,
        isFavorite: false,
        isPinned: false,
        isMuted: false,
        aliasDirectIds: archive.aliasDirectIds || [],
        archived: true,
        lastMessageTime: archive.archivedAt?.toDate?.() || new Date(0),
      });
    });
  } catch (error) {
    console.warn("Archived message search skipped:", error);
  }

  return items;
}

async function sendChatRequest(user) {
  if (!currentUser || !user) return;
  if (await isBlockedByUser(user.id)) {
    showToast("Request cannot be sent to this user", "error");
    return;
  }
  await ensureDirectoryUserProfile(user);
  const existingRequest = await db
    .collection("chatRequests")
    .where("fromUserId", "==", currentUser.uid)
    .where("toUserId", "==", user.id)
    .where("status", "==", "pending")
    .get();

  if (!existingRequest.empty) {
    showToast("Request already sent to this user");
    return;
  }

  const inverseRequest = await db
    .collection("chatRequests")
    .where("fromUserId", "==", user.id)
    .where("toUserId", "==", currentUser.uid)
    .where("status", "==", "pending")
    .get();

  if (!inverseRequest.empty) {
    showToast(
      `${user.displayName || user.email} already sent you a request. Accept it from Requests.`,
    );
    return;
  }

  await db.collection("chatRequests").add({
    fromUserId: currentUser.uid,
    fromUserName: currentUser.displayName || currentUser.email.split("@")[0],
    fromUserEmail: normalizeEmail(currentUser.email),
    toUserId: user.id,
    toUserName: user.displayName || user.email,
    toUserEmail: normalizeEmail(user.email),
    status: "pending",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast("Request sent");
  loadCurrentChatList();
}

async function ensureDirectoryUserProfile(user) {
  if (!user?.id || !user?.email) return;
  try {
    await db
      .collection("users")
      .doc(user.id)
      .set(
        {
          uid: user.id,
          email: normalizeEmail(user.email),
          displayName:
            user.displayName || normalizeEmail(user.email).split("@")[0],
          emailVerified: user.emailVerified !== false,
          pendingVerification: false,
          isActive: true,
          onlineStatus: user.onlineStatus || "offline",
          repairedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  } catch (error) {
    console.warn("Could not repair directory profile:", error);
  }
}

async function isBlockedByUser(userId) {
  if (!currentUser || !userId) return false;
  try {
    const snapshot = await db
      .collection("blockedUsers")
      .where("userId", "==", userId)
      .where("blockedUserId", "==", currentUser.uid)
      .limit(1)
      .get();
    return !snapshot.empty;
  } catch (error) {
    return false;
  }
}
async function acceptChatRequest(requestId, fromUserId) {
  if (!currentUser || !requestId || !fromUserId) return;
  try {
    const requestDoc = await db.collection("chatRequests").doc(requestId).get();
    if (!requestDoc.exists) {
      showToast("Request no longer exists", "error");
      await loadReceivedRequests();
      return;
    }
    const requestData = requestDoc.data() || {};
    if (
      requestData.status !== "pending" ||
      requestData.toUserId !== currentUser.uid ||
      requestData.fromUserId !== fromUserId
    ) {
      showToast("Request is no longer available", "error");
      await loadReceivedRequests();
      return;
    }

    const chatId = getDirectChatId(currentUser.uid, fromUserId);
    await db
      .collection("directChats")
      .doc(chatId)
      .set(
        {
          participants: [currentUser.uid, fromUserId],
          participantEmails: {
            [currentUser.uid]: normalizeEmail(currentUser.email),
            [fromUserId]: normalizeEmail(requestData.fromUserEmail),
          },
          participantNames: {
            [currentUser.uid]: currentUser.displayName || currentUser.email,
            [fromUserId]:
              requestData.fromUserName || requestData.fromUserEmail || "User",
          },
          status: "active",
          createdAt:
            requestData.createdAt ||
            firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    await db.collection("chatRequests").doc(requestId).update({
      status: "accepted",
      respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    showToast("Request accepted");
    await loadReceivedRequests();
    await loadCurrentChatList();

    const userDoc = await db.collection("users").doc(fromUserId).get();
    await startDirectChat(
      userDoc.exists
        ? { id: fromUserId, ...userDoc.data() }
        : {
            id: fromUserId,
            displayName:
              requestData.fromUserName || requestData.fromUserEmail || "User",
            email: requestData.fromUserEmail || "",
          },
    );
  } catch (error) {
    console.error("Could not accept chat request:", error);
    showToast(
      error?.message || "Could not accept request. Please try again.",
      "error",
    );
  }
}
async function loadReceivedRequests() {
  if (!currentUser) return;
  const requestList = document.getElementById("requestList");
  if (!requestList) return;
  const requestSection = document.querySelector(".request-section");
  const requestToggle = document.getElementById("requestToggle");
  const badge = document.getElementById("requestBadge");

  try {
    const [chatSnapshot, groupSnapshot] = await Promise.all([
      db
        .collection("chatRequests")
        .where("toUserId", "==", currentUser.uid)
        .where("status", "==", "pending")
        .get(),
      db
        .collection("groupInvites")
        .where("toUserId", "==", currentUser.uid)
        .where("status", "==", "pending")
        .get(),
    ]);

    const requests = [
      ...chatSnapshot.docs.map((doc) => ({
        id: doc.id,
        requestType: "chat",
        ...doc.data(),
      })),
      ...groupSnapshot.docs.map((doc) => ({
        id: doc.id,
        requestType: "group",
        ...doc.data(),
      })),
    ].sort(
      (a, b) =>
        (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0),
    );

    if (badge) {
      if (requests.length > 0) {
        badge.textContent =
          requests.length > 99 ? "99+" : String(requests.length);
        badge.classList.add("show");
        badge.style.display = "inline-flex";
      } else {
        badge.textContent = "";
        badge.classList.remove("show");
        badge.style.display = "none";
      }
    }

    if (requestToggle)
      requestToggle.textContent = requestSection?.classList.contains("expanded")
        ? "▲"
        : "▼";

    requestList.innerHTML = "";
    if (!requests.length) {
      requestList.innerHTML = '<div class="empty-state">No requests</div>';
      return;
    }

    for (const req of requests) {
      const isGroupInvite = req.requestType === "group";
      const reqDiv = document.createElement("div");
      reqDiv.className = "list-item request-card";
      reqDiv.innerHTML = `
        <div class="list-avatar">${isGroupInvite ? escapeHtml(getInitials(req.groupName || "Group invite")) : escapeHtml(getInitials(req.fromUserName || "", req.fromUserEmail || ""))}</div>
        <div class="list-info">
          <div class="list-name">${escapeHtml(isGroupInvite ? req.groupName || "Group invite" : req.fromUserName || "User")}</div>
          <div class="list-preview">${isGroupInvite ? `Group invite from ${escapeHtml(req.fromUserName || "User")}` : `Wants to chat${req.fromUserEmail ? ` - ${escapeHtml(req.fromUserEmail)}` : ""}`}</div>
        </div>
        <div class="request-actions">
          <button class="btn btn-success accept-request-btn" data-type="${req.requestType}" data-id="${req.id}" data-from="${escapeHtml(req.fromUserId || "")}">Accept</button>
          <button class="btn btn-outline delete-request-btn" data-type="${req.requestType}" data-id="${req.id}">Decline</button>
          <button class="btn btn-outline block-request-btn" data-type="${req.requestType}" data-id="${req.id}" data-from="${escapeHtml(req.fromUserId || "")}" data-name="${escapeHtml(req.fromUserName || "User")}">Block</button>
        </div>
      `;
      requestList.appendChild(reqDiv);
    }

    requestList.querySelectorAll(".accept-request-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        try {
          if (btn.dataset.type === "group")
            await acceptGroupInvite(btn.dataset.id);
          else await acceptChatRequest(btn.dataset.id, btn.dataset.from);
        } finally {
          btn.disabled = false;
        }
      });
    });
    requestList.querySelectorAll(".delete-request-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (btn.dataset.type === "group")
          await deleteGroupInvite(btn.dataset.id);
        else await deleteChatRequest(btn.dataset.id);
      });
    });
    requestList.querySelectorAll(".block-request-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await blockRequestSender(
          btn.dataset.type,
          btn.dataset.id,
          btn.dataset.from,
          btn.dataset.name,
        );
      });
    });
  } catch (error) {
    console.error("Could not load requests:", error);
    if (badge) {
      badge.textContent = "";
      badge.classList.remove("show");
      badge.style.display = "none";
    }
  }
}

function setupRequestListeners() {
  document.getElementById("requestHeader")?.addEventListener("click", () => {
    const section = document.querySelector(".request-section");
    const toggle = document.getElementById("requestToggle");

    section?.classList.toggle("expanded");

    if (toggle) {
      toggle.textContent = section?.classList.contains("expanded") ? "▲" : "▼";
    }

    loadReceivedRequests();
  });
  if (!currentUser) return;
  if (chatRequestsUnsubscribe) chatRequestsUnsubscribe();
  if (groupInvitesUnsubscribe) groupInvitesUnsubscribe();
  seenPendingChatRequestIds = new Set();
  seenPendingGroupInviteIds = new Set();
  chatRequestListenerReady = false;
  groupInviteListenerReady = false;
  chatRequestsUnsubscribe = db
    .collection("chatRequests")
    .where("toUserId", "==", currentUser.uid)
    .where("status", "==", "pending")
    .onSnapshot((snapshot) => {
      const currentIds = new Set(snapshot.docs.map((doc) => doc.id));
      const newRequests = snapshot.docs
        .filter(
          (doc) =>
            chatRequestListenerReady && !seenPendingChatRequestIds.has(doc.id),
        )
        .map((doc) => ({ id: doc.id, ...doc.data() }));

      seenPendingChatRequestIds = currentIds;
      loadReceivedRequests();

      newRequests.forEach((request) => {
        showToast(`New chat request from ${request.fromUserName || "User"}`);
      });
      chatRequestListenerReady = true;
    });
  groupInvitesUnsubscribe = db
    .collection("groupInvites")
    .where("toUserId", "==", currentUser.uid)
    .where("status", "==", "pending")
    .onSnapshot((snapshot) => {
      const currentIds = new Set(snapshot.docs.map((doc) => doc.id));
      const newInvites = snapshot.docs
        .filter(
          (doc) =>
            groupInviteListenerReady && !seenPendingGroupInviteIds.has(doc.id),
        )
        .map((doc) => ({ id: doc.id, ...doc.data() }));

      seenPendingGroupInviteIds = currentIds;
      loadReceivedRequests();

      newInvites.forEach((invite) => {
        showToast(`New group invite: ${invite.groupName || "Group"}`);
      });
      groupInviteListenerReady = true;
    });
}
async function acceptGroupInvite(inviteId) {
  if (!currentUser || !inviteId) return;
  const inviteRef = db.collection("groupInvites").doc(inviteId);
  const inviteDoc = await inviteRef.get();
  if (!inviteDoc.exists) return;
  const invite = inviteDoc.data();

  const existing = await db
    .collection("groupMembers")
    .where("groupId", "==", invite.groupId)
    .where("userId", "==", currentUser.uid)
    .get();
  if (existing.empty) {
    await db.collection("groupMembers").add({
      groupId: invite.groupId,
      userId: currentUser.uid,
      role: "member",
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await db
      .collection("groups")
      .doc(invite.groupId)
      .update({
        memberCount: firebase.firestore.FieldValue.increment(1),
      });
    await sendWelcomeMessage(invite.groupId, currentUser.uid);
  }

  await inviteRef.update({
    status: "accepted",
    respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast(`Joined ${invite.groupName || "group"}`);
  loadReceivedRequests();
  loadGroupsList();
}

async function declineGroupInvite(inviteId) {
  if (!inviteId) return;
  await db.collection("groupInvites").doc(inviteId).update({
    status: "declined",
    respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast("Group invite declined");
  loadReceivedRequests();
}

async function deleteChatRequest(requestId) {
  if (!requestId) return;
  await db.collection("chatRequests").doc(requestId).update({
    status: "deleted",
    respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast("Request deleted");
  loadReceivedRequests();
}

async function deleteGroupInvite(inviteId) {
  if (!inviteId) return;
  await db.collection("groupInvites").doc(inviteId).update({
    status: "deleted",
    respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast("Invite deleted");
  loadReceivedRequests();
}

async function blockRequestSender(type, requestId, fromUserId, fromUserName) {
  if (!fromUserId) return;
  if (!confirm(`Block ${fromUserName || "this user"} from sending requests?`))
    return;
  await blockUser(fromUserId, fromUserName || "User");
  await loadBlockedUsers();
  if (type === "group") await deleteGroupInvite(requestId);
  else await deleteChatRequest(requestId);
  showToast(`${fromUserName || "User"} blocked`);
}

function searchGroupsRealtime(searchTerm) {
  const groupsList = document.getElementById("groupsList");
  if (!groupsList) return;

  if (!searchTerm || searchTerm.trim() === "") {
    loadGroupsList();
    return;
  }

  const term = searchTerm.toLowerCase().trim();
  const allGroups = [];

  db.collection("groupMembers")
    .where("userId", "==", currentUser.uid)
    .get()
    .then(async (snapshot) => {
      for (const doc of snapshot.docs) {
        const groupDoc = await db
          .collection("groups")
          .doc(doc.data().groupId)
          .get();
        if (
          groupDoc.exists &&
          groupDoc.data().name.toLowerCase().includes(term)
        ) {
          allGroups.push({
            id: groupDoc.id,
            name: groupDoc.data().name,
            code: groupDoc.data().code,
            icon: groupDoc.data().icon,
          });
        }
      }

      if (allGroups.length === 0) {
        groupsList.innerHTML =
          '<div class="empty-state" style="padding:40px;">👥 No matching groups</div>';
        return;
      }

      groupsList.innerHTML = "";
      allGroups.forEach((group) => {
        const groupDiv = document.createElement("div");
        groupDiv.className = "list-item";
        groupDiv.innerHTML = `
        <div class="list-avatar">${group.icon ? `<img src="${group.icon}">` : "👥"}</div>
        <div class="list-info">
          <div class="list-name">${escapeHtml(group.name)}</div>
          <div class="list-preview">${group.code}</div>
        </div>
      `;
        groupDiv.onclick = () => loadGroupChat(group.id, group.name);
        groupsList.appendChild(groupDiv);
      });
    });
}

// ========================================
// BLOCKED USERS
// ========================================

async function loadBlockedUsers() {
  if (!currentUser) return;
  const snapshot = await db
    .collection("blockedUsers")
    .where("userId", "==", currentUser.uid)
    .get();
  blockedUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function blockUser(userId, userName) {
  if (!userId || isBlocked(userId)) return;
  await db.collection("blockedUsers").add({
    userId: currentUser.uid,
    blockedUserId: userId,
    blockedUserName: userName,
    blockedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  await loadBlockedUsers();
  showToast(`Blocked ${userName}`);
}

async function unblockUser(blockId) {
  await db.collection("blockedUsers").doc(blockId).delete();
  await loadBlockedUsers();
  showToast("User unblocked");
}

async function reportUser(targetUserId, targetName = "User", source = "chat") {
  if (!currentUser || !targetUserId) return;
  const reason = prompt("Report reason (optional):", "") || "";
  await db.collection("userReports").add({
    reporterUserId: currentUser.uid,
    reporterName: currentUser.displayName || currentUser.email || "User",
    targetUserId,
    targetName,
    source,
    reason: reason.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast(`${targetName} reported`);
}

async function reportMessage(messageId, messageData = {}) {
  if (!currentUser || !messageId) return;
  const reason = prompt("Report reason (optional):", "") || "";
  await db.collection("messageReports").add({
    reporterUserId: currentUser.uid,
    reporterName: currentUser.displayName || currentUser.email || "User",
    messageId,
    chatId: currentChat?.id || "",
    chatType: currentChatType || "",
    senderId: messageData.senderId || "",
    senderName: messageData.senderName || "",
    text: messageData.text || "",
    reason: reason.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast("Message reported");
}

function isBlocked(userId) {
  return blockedUsers.some((b) => b.blockedUserId === userId);
}

async function getCurrentDirectMessages() {
  if (!currentChat || currentChatType !== "direct") return [];
  const directIds = currentChat.aliasDirectIds?.length
    ? currentChat.aliasDirectIds
    : [currentChat.id];
  const messages = [];
  for (const directId of directIds) {
    const snapshot = await db
      .collection("messages")
      .where("directId", "==", directId)
      .limit(80)
      .get();
    snapshot.docs.forEach((doc) =>
      messages.push({ id: doc.id, ...doc.data() }),
    );
  }
  return messages.sort(
    (a, b) =>
      (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0),
  );
}

async function getCurrentSharedMessages() {
  if (!currentChat || !currentChatType) return [];
  if (currentChatType === "direct") return getCurrentDirectMessages();
  if (currentChatType !== "group") return [];

  const snapshot = await db
    .collection("messages")
    .where("groupId", "==", currentChat.id)
    .limit(160)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter(
      (msg) => !msg.deletedForEveryone && !msg.deletedFor?.[currentUser?.uid],
    )
    .sort(
      (a, b) =>
        (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0),
    );
}

function extractLinks(text = "") {
  return text.match(/https?:\/\/[^\s]+/g) || [];
}

function formatBytes(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function getFileExtensionFromName(name = "") {
  return (
    String(name || "")
      .split(".")
      .pop()
      ?.toLowerCase() || ""
  );
}

function getAvatarFormatHelpText() {
  return AVATAR_FORMAT_HELP_TEXT;
}

function validateAvatarImageFile(file, label = "image") {
  if (!file) return false;
  const ext = getFileExtensionFromName(file.name);
  const type = String(file.type || "").toLowerCase();
  const allowedByType = type ? AVATAR_ALLOWED_MIME_TYPES.includes(type) : false;
  const allowedByExtension = AVATAR_ALLOWED_EXTENSIONS.includes(ext);

  if (!allowedByType && !allowedByExtension) {
    showToast(
      `${label} format is not supported. ${getAvatarFormatHelpText()}`,
      "error",
    );
    return false;
  }

  if (file.size > AVATAR_MAX_BYTES) {
    showToast(
      `${label} is too large. Maximum size is ${formatBytes(AVATAR_MAX_BYTES)}.`,
      "error",
    );
    return false;
  }

  return true;
}

function notifyAvatarUploadPolicy() {
  showToast(getAvatarFormatHelpText());
}

// ========================================
// MUTED CHATS
// ========================================

async function loadMutedChats() {
  if (!currentUser) return;
  const snapshot = await db
    .collection("mutedChats")
    .where("userId", "==", currentUser.uid)
    .get();
  mutedChats = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function muteChat(chatId, chatType, duration) {
  const muteUntil = getMuteUntil(duration);

  await db.collection("mutedChats").add({
    userId: currentUser.uid,
    chatId,
    chatType,
    muteUntil,
    mutedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  await loadMutedChats();
  showToast("Chat muted");
}

async function unmuteChat(muteId) {
  await db.collection("mutedChats").doc(muteId).delete();
  await loadMutedChats();
  showToast("Chat unmuted");
}

function getActiveMuteRecord(chatId, chatType = "") {
  const mute = mutedChats.find(
    (m) => m.chatId === chatId && (!chatType || m.chatType === chatType),
  );
  if (!mute) return null;
  if (mute.muteUntil && mute.muteUntil.toDate() < new Date()) {
    unmuteChat(mute.id);
    return null;
  }
  return mute;
}

function isChatMuted(chatId) {
  return !!getActiveMuteRecord(chatId);
}

let notifSettingsCurrentChat = null;
let notifSettingsCurrentType = "";

async function openNotifSettings(chatId, chatType, chatName) {
  notifSettingsCurrentChat = chatId;
  notifSettingsCurrentType = chatType;
  document.getElementById("notifSettingsChatName").textContent = chatName;
  const settings = await loadChatNotifSettings(chatId, chatType);
  const activeMute = getActiveMuteRecord(chatId, chatType);
  const muteToggle = document.getElementById("notifMuteToggle");
  muteToggle.checked = !!activeMute;
  document.getElementById("notifMuteDurationSection").style.display =
    muteToggle.checked ? "block" : "none";
  document.getElementById("notifMuteDuration").value = activeMute?.muteUntil
    ? "8h"
    : activeMute
      ? "always"
      : "8h";
  document.getElementById("notifCustomSound").checked =
    settings.customSound !== false;
  document.getElementById("notifVibrate").checked = settings.vibrate !== false;
  document.getElementById("notifShowPreview").checked =
    settings.showPreview !== false;
  document.getElementById("notifSettingsModal").style.display = "flex";
}

async function saveNotifSettings() {
  const chatId = notifSettingsCurrentChat;
  const chatType = notifSettingsCurrentType;
  if (!chatId) return;
  const muteEnabled = document.getElementById("notifMuteToggle").checked;
  const activeMute = getActiveMuteRecord(chatId, chatType);
  if (muteEnabled && !activeMute) {
    const duration = document.getElementById("notifMuteDuration").value;
    await muteChat(chatId, chatType, duration);
  } else if (!muteEnabled && activeMute) {
    await unmuteChat(activeMute.id);
  } else if (muteEnabled && activeMute) {
    const duration = document.getElementById("notifMuteDuration").value;
    const muteUntil = getMuteUntil(duration);
    await db
      .collection("mutedChats")
      .doc(activeMute.id)
      .update({
        muteUntil,
        mutedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    await loadMutedChats();
  }
  const settings = {
    customSound: document.getElementById("notifCustomSound").checked,
    vibrate: document.getElementById("notifVibrate").checked,
    showPreview: document.getElementById("notifShowPreview").checked,
  };
  await db
    .collection("chatNotifSettings")
    .doc(`${currentUser.uid}_${chatId}`)
    .set(
      {
        userId: currentUser.uid,
        chatId,
        chatType,
        ...settings,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  document.getElementById("notifSettingsModal").style.display = "none";
  showToast("Notification settings saved");
  setTimeout(() => location.reload(), 1500);
}

async function loadChatNotifSettings(chatId, chatType) {
  try {
    const doc = await db
      .collection("chatNotifSettings")
      .doc(`${currentUser.uid}_${chatId}`)
      .get();
    return doc.exists ? doc.data() : {};
  } catch {
    return {};
  }
}

function getMuteUntil(duration) {
  if (duration === "1h") return new Date(Date.now() + 60 * 60 * 1000);
  if (duration === "8h") return new Date(Date.now() + 8 * 60 * 60 * 1000);
  if (duration === "24h") return new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (duration === "7d") return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return null;
}

// ========================================
// QUICK REPLIES
// ========================================

async function loadQuickReplies() {
  if (!currentUser) return;
  const snapshot = await db
    .collection("quickReplies")
    .where("userId", "==", currentUser.uid)
    .get();
  quickReplies = snapshot.docs.map((doc) => ({
    id: doc.id,
    text: doc.data().text,
  }));
}

async function addQuickReply(text) {
  await db.collection("quickReplies").add({
    userId: currentUser.uid,
    text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  await loadQuickReplies();
  showQuickRepliesModal();
}

async function deleteQuickReply(replyId) {
  await db.collection("quickReplies").doc(replyId).delete();
  await loadQuickReplies();
  showQuickRepliesModal();
}

// ========================================
// PINNED MESSAGES
// ========================================

async function pinMessage(messageId, messageData) {
  const existing = await db
    .collection("pinnedMessages")
    .where("chatId", "==", currentChat.id)
    .where("userId", "==", currentUser.uid)
    .get();

  if (existing.size >= 5) {
    showToast("You can only pin up to 5 messages", "error");
    return;
  }

  await db.collection("pinnedMessages").add({
    chatId: currentChat.id,
    messageId,
    userId: currentUser.uid,
    text: messageData.text,
    senderName: messageData.senderName,
    timestamp: messageData.timestamp,
    pinnedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast("Message pinned");
  loadPinnedMessages();
}

async function unpinMessage(pinId) {
  await db.collection("pinnedMessages").doc(pinId).delete();
  loadPinnedMessages();
}

async function loadPinnedMessages() {
  if (!currentChat) return;

  let snapshot;
  try {
    snapshot = await db
      .collection("pinnedMessages")
      .where("chatId", "==", currentChat.id)
      .where("userId", "==", currentUser.uid)
      .orderBy("pinnedAt", "desc")
      .get();
  } catch (error) {
    console.warn("Index not ready, using fallback query:", error);
    snapshot = await db
      .collection("pinnedMessages")
      .where("chatId", "==", currentChat.id)
      .where("userId", "==", currentUser.uid)
      .get();
    const docs = snapshot.docs;
    docs.sort((a, b) => {
      const timeA = a.data().pinnedAt?.toDate() || new Date(0);
      const timeB = b.data().pinnedAt?.toDate() || new Date(0);
      return timeB - timeA;
    });
    snapshot.docs = docs;
  }

  pinnedMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const pinnedSection = document.getElementById("pinnedSection");
  const pinnedList = document.getElementById("pinnedMessagesList");
  const pinnedCount = document.getElementById("pinnedCount");
  if (!pinnedSection) return;

  if (pinnedMessages.length === 0) {
    pinnedSection.style.display = "none";
    return;
  }

  pinnedSection.style.display = "block";
  if (pinnedCount) pinnedCount.textContent = pinnedMessages.length;
  if (pinnedList) {
    pinnedList.innerHTML = "";
    pinnedMessages.forEach((pin) => {
      const div = document.createElement("div");
      div.className = "pinned-message-item";
      div.innerHTML = `<span>📌</span><div style="flex:1;"><div style="font-weight:600; font-size:12px;">${escapeHtml(pin.senderName)}</div><div style="font-size:11px; color:#888;">${escapeHtml(pin.text ? pin.text.substring(0, 50) : "Media")}</div></div><button class="unpin-btn" data-id="${pin.id}" style="background:none; border:none; cursor:pointer;">✖</button>`;
      div.querySelector(".unpin-btn")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await unpinMessage(pin.id);
      });
      pinnedList.appendChild(div);
    });
  }
}

// ========================================
// MESSAGE REACTIONS
// ========================================

async function addReaction(messageId, reaction) {
  const reactionRef = db
    .collection("messageReactions")
    .doc(`${messageId}_${currentUser.uid}`);
  const existing = await reactionRef.get();

  if (existing.exists && existing.data().reaction === reaction) {
    await reactionRef.delete();
  } else {
    await reactionRef.set({
      messageId,
      userId: currentUser.uid,
      reaction,
      userName: currentUser.displayName || currentUser.email.split("@")[0],
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
}

async function loadReactions(messageId, container) {
  const snapshot = await db
    .collection("messageReactions")
    .where("messageId", "==", messageId)
    .get();
  const reactions = {};
  snapshot.forEach((doc) => {
    reactions[doc.data().reaction] = (reactions[doc.data().reaction] || 0) + 1;
  });

  if (Object.keys(reactions).length === 0) return;

  const reactionDiv = document.createElement("div");
  reactionDiv.className = "reactions-container";
  for (const [reaction, count] of Object.entries(reactions)) {
    const badge = document.createElement("span");
    badge.className = "reaction-badge";
    badge.textContent = `${reaction} ${count}`;
    badge.onclick = (e) => {
      e.stopPropagation();
      addReaction(messageId, reaction);
    };
    badge.ondblclick = (e) => {
      e.stopPropagation();
      triggerMessageEffect("confetti");
    };
    reactionDiv.appendChild(badge);
  }
  container.appendChild(reactionDiv);
}

function getReactionOptions() {
  return [
    "\u{1F44D}",
    "\u2764\uFE0F",
    "\u{1F602}",
    "\u{1F62E}",
    "\u{1F622}",
    "\u{1F64F}",
  ];
}

// ========================================
// VOICE RECORDING
// ========================================

async function startVoiceRecording() {
  if (isNativeAndroidApp) {
    const hasMic = await ensureNativePermission("microphone");
    if (!hasMic) return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
    });
    if (!window.MediaRecorder) {
      showToast("Voice recording not supported", "error");
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "audio/webm";
    mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, {
        type: mimeType === "audio/mp4" ? "audio/mp4" : "audio/webm",
      });
      const formData = new FormData();
      formData.append("file", audioBlob);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("resource_type", "video");
      try {
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
          { method: "POST", body: formData },
        );
        const data = await response.json();
        if (data.secure_url) {
          const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
          await sendVoiceMessage(data.secure_url, duration);
        }
      } catch (error) {
        showToast("Failed to send voice message", "error");
      }
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start(100);
    isRecording = true;
    recordingStartTime = Date.now();
    document.getElementById("voiceRecordingIndicator")?.classList.add("show");

    recordingTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      const timerEl = document.getElementById("recordingTimer");
      if (timerEl)
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
      if (elapsed >= 60) stopVoiceRecording();
    }, 1000);
  } catch (error) {
    showToast("Microphone access denied", "error");
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && isRecording && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(recordingTimer);
    document
      .getElementById("voiceRecordingIndicator")
      ?.classList.remove("show");
  }
}

function cancelVoiceRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.onstop = () => {};
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(recordingTimer);
    document
      .getElementById("voiceRecordingIndicator")
      ?.classList.remove("show");
  }
}

async function sendVoiceMessage(audioUrl, duration) {
  if (!currentChat) return;
  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email.split("@")[0],
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    read: false,
    readBy: { [currentUser.uid]: new Date() },
    attachment: { type: "voice", url: audioUrl, duration },
  };
  if (currentChatType === "direct") messageData.directId = currentChat.id;
  else messageData.groupId = currentChat.id;
  await db.collection("messages").add(messageData);
}

// ========================================
// TYPING INDICATOR
// ========================================

async function sendTypingIndicator() {
  if (!currentChat || privacySettings.hideTypingIndicator) return;
  const typingRef = db
    .collection("typingIndicators")
    .doc(`${currentChat.id}_${currentUser.uid}`);
  await typingRef.set({
    chatId: currentChat.id,
    userId: currentUser.uid,
    userName: currentUser.displayName || currentUser.email.split("@")[0],
    isTyping: true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(async () => {
    await typingRef.delete();
  }, 2000);
}

function listenForTypingIndicator() {
  if (!currentChat || !currentUser) return;

  if (typingUnsubscribe) {
    typingUnsubscribe();
    typingUnsubscribe = null;
  }

  const chatStatus = document.getElementById("chatStatus");
  const baseStatus = chatStatus?.textContent || "";

  typingUnsubscribe = db
    .collection("typingIndicators")
    .where("chatId", "==", currentChat.id)
    .onSnapshot(
      (snapshot) => {
        const typingUsers = snapshot.docs
          .map((doc) => doc.data())
          .filter((data) => data.userId !== currentUser.uid && data.isTyping);

        if (!chatStatus) return;

        if (!typingUsers.length) {
          chatStatus.textContent = baseStatus;
          return;
        }

        if (currentChatType === "group") {
          const names = typingUsers
            .map((user) => user.userName || "Someone")
            .filter(Boolean);

          if (names.length === 1) {
            chatStatus.textContent = `${names[0]} is typing...`;
          } else if (names.length === 2) {
            chatStatus.textContent = `${names[0]} and ${names[1]} are typing...`;
          } else {
            chatStatus.textContent = `${names.length} people are typing...`;
          }
        } else {
          chatStatus.textContent = "typing...";
        }
      },
      (err) => {
        console.error("Typing indicator onSnapshot error:", err);
      },
    );
}

// ========================================
// NOTIFICATIONS & PROFILE UTILS
// ========================================

async function sendNotification(chatName, message) {
  if (Notification.permission === "granted" && document.hidden) {
    new Notification(chatName, { body: message });
  }
}

async function checkFirstTimeUser() {
  const userDoc = await db.collection("users").doc(currentUser.uid).get();
  const userData = userDoc.data();
  if (!userData.phoneNumber && userData.isFirstTime === true) {
    showFirstTimePhoneModal();
  }
}

function showFirstTimePhoneModal() {
  const modal = document.getElementById("firstTimePhoneModal");
  if (!modal) return;
  setupCallPreviewInteractions();
  modal.style.display = "flex";

  document.getElementById("skipPhoneBtn").onclick = async () => {
    await db
      .collection("users")
      .doc(currentUser.uid)
      .update({ isFirstTime: false });
    modal.style.display = "none";
  };

  document.getElementById("savePhoneFirstBtn").onclick = async () => {
    const phone = document.getElementById("firstTimePhone").value;
    if (isValidIndianPhone(phone)) {
      await db
        .collection("users")
        .doc(currentUser.uid)
        .update({ phoneNumber: phone, isFirstTime: false });
      showToast("Phone number saved!");
      modal.style.display = "none";
    } else {
      showToast(
        "Enter valid 10-digit Indian phone number (starts with 6/7/8/9)",
        "error",
      );
    }
  };
}

async function deactivateAccount() {
  if (
    !confirm(
      "⚠️ Deactivate your account? Your profile will be hidden. You can reactivate by logging in again.",
    )
  )
    return;
  await db.collection("users").doc(currentUser.uid).update({
    isActive: false,
    deactivatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    onlineStatus: "offline",
  });
  await markCurrentSessionInactive();
  await auth.signOut();
  window.location.replace("login.html");
}

async function markCurrentSessionInactive() {
  if (!currentUser) return;
  stopPresenceHeartbeat();
  await setCurrentUserPresence(false);
  if (!currentSessionId) return;
  await db
    .collection("userSessions")
    .doc(`${currentUser.uid}_${currentSessionId}`)
    .set(
      {
        isActive: false,
        lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    .catch(() => {});
}

async function changeEmail() {
  const newEmail = normalizeEmail(
    prompt("Enter your new email address:") || "",
  );
  if (!newEmail) return;
  if (!isCompleteEmail(newEmail)) {
    showToast("Enter a valid email address", "error");
    return;
  }
  if (newEmail === normalizeEmail(currentUser.email)) {
    showToast("This is already your current email");
    return;
  }
  try {
    if (typeof currentUser.verifyBeforeUpdateEmail === "function") {
      await currentUser.verifyBeforeUpdateEmail(newEmail);
      await db.collection("users").doc(currentUser.uid).set(
        {
          pendingEmailChange: newEmail,
          pendingEmailRequestedAt:
            firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      showToast(
        "Verification sent to the new email. Email changes after verification.",
      );
    } else {
      await currentUser.updateEmail(newEmail);
      await currentUser.sendEmailVerification();
      await db.collection("users").doc(currentUser.uid).set(
        {
          email: newEmail,
          emailVerified: false,
          pendingVerification: true,
        },
        { merge: true },
      );
      showToast("Email changed. Please verify the new email address.");
    }
  } catch (error) {
    showToast(
      error?.message || "Could not change email. Please login again and retry.",
      "error",
    );
  }
}

async function changePhoneNumber() {
  const phone = (
    prompt(
      "Enter 10-digit Indian phone number",
      document.getElementById("profilePhone")?.textContent || "",
    ) || ""
  ).trim();
  if (!phone) return;
  if (!isValidIndianPhone(phone)) {
    showToast("Enter a valid 10-digit Indian phone number", "error");
    return;
  }
  try {
    await currentUser.reload();
    currentUser = auth.currentUser || currentUser;
    if (!currentUser.emailVerified) {
      await currentUser.sendEmailVerification();
      showToast("Verify your email first. Verification email sent.", "error");
      return;
    }
    await db.collection("users").doc(currentUser.uid).set(
      {
        phone,
        phoneNumber: phone,
        phoneVerifiedByEmailAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    document.getElementById("profilePhone").textContent = phone;
    showToast("Phone updated");
  } catch (error) {
    showToast(error?.message || "Could not update phone", "error");
  }
}

// ========================================
// WALLPAPER ENGINE
// ========================================

function loadWallpaperFromStorage() {
  const saved = localStorage.getItem("chatWallpapers");
  if (saved) {
    try {
      chatWallpapers = JSON.parse(saved) || {};
    } catch (error) {
      chatWallpapers = {};
    }
  } else {
    chatWallpapers = {};
  }
  applyCurrentChatWallpaper();
}

function saveWallpaperToStorage() {
  localStorage.setItem("chatWallpapers", JSON.stringify(chatWallpapers));
}

function normalizeWallpaperType(wallpaperType) {
  if (!wallpaperType) return "default";
  const trimmed = wallpaperType.toString().trim();
  const lower = trimmed.toLowerCase();
  const presets = ["default", "dark", "forest", "ocean", "sunset", "purple"];
  return presets.includes(lower) ? lower : trimmed;
}

function setWallpaperForChat(chatId, wallpaperType) {
  if (!chatId) {
    showToast("No chat selected", "error");
    return;
  }
  wallpaperType = normalizeWallpaperType(wallpaperType);
  if (wallpaperType === "default") {
    delete chatWallpapers[chatId];
    showToast("Wallpaper removed for this chat");
  } else {
    chatWallpapers[chatId] = wallpaperType;
    showToast("Wallpaper set for this chat");
  }
  saveWallpaperToStorage();
  if (currentChat && currentChat.id === chatId) {
    applyCurrentChatWallpaper();
  }
}

function setGlobalWallpaper(wallpaperType) {
  wallpaperType = normalizeWallpaperType(wallpaperType);
  chatWallpapers["global"] = wallpaperType;
  saveWallpaperToStorage();
  applyCurrentChatWallpaper();
  showToast("Global wallpaper updated for all chats");
}

function openWallpaperModal(mode) {
  if (mode === "current" && !currentChat) {
    showToast("Select a chat before changing wallpaper", "error");
    return;
  }
  wallpaperModalMode = mode === "current" ? "current" : "global";
  const title = document.getElementById("wallpaperModalTitle");
  if (title) {
    title.textContent =
      wallpaperModalMode === "current"
        ? "Chat Wallpaper (Current Chat)"
        : "Chat Wallpaper (All Chats)";
  }
  document.getElementById("wallpaperModal").style.display = "flex";
}

function applyCurrentChatWallpaper() {
  const messagesArea = document.getElementById("messagesArea");
  if (!messagesArea || !currentChat) return;

  messagesArea.style.cssText = "";
  messagesArea.style.backgroundImage = "";
  messagesArea.style.backgroundColor = "";

  let wallpaper = chatWallpapers[currentChat.id] || chatWallpapers["global"];

  if (!wallpaper || wallpaper === "default") {
    messagesArea.style.backgroundColor = document.body.classList.contains(
      "dark",
    )
      ? "#1a1a2e"
      : "#f8fafc";
  } else if (wallpaper === "dark") {
    messagesArea.style.backgroundColor = "#1a1a2e";
  } else if (wallpaper === "forest") {
    messagesArea.style.backgroundImage =
      "linear-gradient(135deg, #2d5a27 0%, #1a3a15 100%)";
  } else if (wallpaper === "ocean") {
    messagesArea.style.backgroundImage =
      "linear-gradient(135deg, #1e3a5f 0%, #0f1a2e 100%)";
  } else if (wallpaper === "sunset") {
    messagesArea.style.backgroundImage =
      "linear-gradient(135deg, #7c2d12 0%, #431407 100%)";
  } else if (wallpaper === "purple") {
    messagesArea.style.backgroundImage =
      "linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)";
  } else if (wallpaper.startsWith("http")) {
    messagesArea.style.backgroundImage = `url(${wallpaper})`;
    messagesArea.style.backgroundSize = "cover";
    messagesArea.style.backgroundPosition = "center";
  }

  messagesArea.style.display = "none";
  messagesArea.offsetHeight; // Force layouts
  messagesArea.style.display = "flex";
  messagesArea.style.flexDirection = "column";
}

// ========================================
// DIRECTORY USER PREPARATION
// ========================================

async function loadAllUsers() {
  if (!currentUser) return;
  if (usersUnsubscribe) return allUsersReadyPromise;
  allUsersReadyPromise = new Promise((resolve) => {
    usersUnsubscribe = db.collection("users").onSnapshot(
      (snapshot) => {
        allUsers = normalizeUsersSnapshot(snapshot);
        populateGroupMemberSuggestions();
        refreshOpenChatPresence();
        scheduleChatListRefresh(500);
        resolve(allUsers);
      },
      (error) => {
        console.warn("User directory listener failed:", error);
        resolve(allUsers);
      },
    );
  });
  return allUsersReadyPromise;
}

function normalizeUsersSnapshot(snapshot) {
  const userMap = new Map();
  const getUserSortTime = (user) =>
    user.lastSeen?.toMillis?.() ||
    user.createdAt?.toMillis?.() ||
    user.createdAt?.getTime?.() ||
    0;
  const addUser = (user) => {
    if (!isSearchableUser(user)) return;
    const key = getUserDedupeKey(user);
    const existing = userMap.get(key);
    if (
      !existing ||
      (existing.source === "authFallback" && user.source !== "authFallback") ||
      getUserSortTime(user) >= getUserSortTime(existing)
    ) {
      userMap.set(key, user);
    }
  };
  snapshot.forEach((doc) => addUser(normalizeUserDoc(doc)));
  getFallbackDirectoryUsers().forEach(addUser);
  return [...userMap.values()].sort((a, b) =>
    (a.displayName || "").localeCompare(b.displayName || ""),
  );
}

async function refreshAllUsersOnce() {
  if (!currentUser) return [];
  try {
    const snapshot = await db.collection("users").get();
    allUsers = normalizeUsersSnapshot(snapshot);
    populateGroupMemberSuggestions();
  } catch (error) {
    console.warn("Could not refresh user directory:", error);
    if (!allUsersReadyPromise) await loadAllUsers();
    else await allUsersReadyPromise;
  }
  return allUsers;
}

function populateGroupMemberSuggestions() {
  updateGroupMemberSuggestions();
}

function findUserByMemberInput(input) {
  const term = (input || "").trim().toLowerCase();
  if (!term) return null;
  const digits = term.replace(/\D/g, "");
  return (
    allUsers.find((user) => {
      const name = (
        user.displayName ||
        user.name ||
        user.fullName ||
        ""
      ).toLowerCase();
      const email = (user.email || "").toLowerCase();
      const phone = ((user.phone || user.phoneNumber || "") + "").replace(
        /\D/g,
        "",
      );
      return (
        email === term ||
        name === term ||
        (digits.length >= 6 && phone === digits) ||
        email.includes(term) ||
        name.includes(term)
      );
    }) || null
  );
}

function searchUsersByIdentity(input) {
  const term = normalizeSearchText(input);
  if (!term) return [];
  return allUsers.filter(
    (user) =>
      !isBlocked(user.id) &&
      isSearchableUser(user) &&
      matchesIdentitySearch(user, term),
  );
}

async function hasAcceptedChatRelationship(userId) {
  if (!currentUser || !userId) return false;
  const directId = getDirectChatId(currentUser.uid, userId);
  const directDoc = await db.collection("directChats").doc(directId).get();
  if (directDoc.exists && directDoc.data().status !== "deleted") return true;

  const sentAccepted = await db
    .collection("chatRequests")
    .where("fromUserId", "==", currentUser.uid)
    .where("toUserId", "==", userId)
    .where("status", "==", "accepted")
    .limit(1)
    .get();
  if (!sentAccepted.empty) return true;

  const receivedAccepted = await db
    .collection("chatRequests")
    .where("fromUserId", "==", userId)
    .where("toUserId", "==", currentUser.uid)
    .where("status", "==", "accepted")
    .limit(1)
    .get();
  return !receivedAccepted.empty;
}

async function handleUserSelection(user) {
  if (!currentUser || !user?.id) return;
  const state = await getContactRequestState(user.id);

  if (state.status === "accepted") {
    await startDirectChat(user);
    return;
  }

  if (state.status === "received") {
    document.querySelector(".request-section")?.classList.add("expanded");
    const toggle = document.getElementById("requestToggle");
    if (toggle) toggle.textContent = "▲";
    await loadReceivedRequests();
    showToast(
      `${user.displayName || user.email || "This user"} already sent you a request. Accept it from Chat Requests.`,
    );
    return;
  }

  if (state.status === "sent") {
    showToast("Request already sent");
    return;
  }

  await sendChatRequest(user);
}

async function getContactRequestState(userId) {
  if (!currentUser || !userId) return { status: "none", label: "" };
  const sentPending = await db
    .collection("chatRequests")
    .where("fromUserId", "==", currentUser.uid)
    .where("toUserId", "==", userId)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!sentPending.empty) return { status: "sent", label: "Request sent" };

  const receivedPending = await db
    .collection("chatRequests")
    .where("fromUserId", "==", userId)
    .where("toUserId", "==", currentUser.uid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!receivedPending.empty)
    return { status: "received", label: "Accept request" };

  if (await hasAcceptedChatRelationship(userId))
    return { status: "accepted", label: "Connected" };
  return { status: "none", label: "Send chat request" };
}

function updateGroupMemberSuggestions(searchTerm = "") {
  const datalist = document.getElementById("groupMemberSuggestions");
  if (!datalist) return;
  const users = searchTerm.trim()
    ? searchUsersByIdentity(searchTerm)
    : allUsers;
  datalist.innerHTML = "";
  users.slice(0, 20).forEach((user) => {
    const label = user.displayName || user.email || user.phone || "User";
    const values = [
      user.displayName,
      user.email,
      user.phone,
      user.phoneNumber,
    ].filter(Boolean);
    [...new Set(values)].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.label = label === value ? value : `${label} (${value})`;
      datalist.appendChild(option);
    });
  });
}

function setupChatListListeners() {
  if (!currentUser) return;

  if (directChatsUnsubscribe) directChatsUnsubscribe();
  if (groupChatsUnsubscribe) groupChatsUnsubscribe();

  directChatsUnsubscribe = db
    .collection("directChats")
    .where("participants", "array-contains", currentUser.uid)
    .onSnapshot(() => {
      loadCurrentChatList();
    });

  groupChatsUnsubscribe = db
    .collection("groupMembers")
    .where("userId", "==", currentUser.uid)
    .onSnapshot(() => {
      loadCurrentChatList();
    });

  if (window.__messageListRefreshUnsubscribe) {
    window.__messageListRefreshUnsubscribe();
  }

  window.__messageListRefreshUnsubscribe = db
    .collection("messages")
    .where("participants", "array-contains", currentUser.uid)
    .onSnapshot(() => {
      loadCurrentChatList();
    });
}

// ========================================
// ARCHIVE & CHAT ACTIONS
// ========================================

async function archiveChat(chatId, chatType, chatName, aliasDirectIds = []) {
  const aliases =
    chatType === "direct"
      ? [...new Set([chatId, ...(aliasDirectIds || [])].filter(Boolean))]
      : [];
  await db
    .collection("archivedChats")
    .doc(`${currentUser.uid}_${chatType}_${chatId}`)
    .set({
      userId: currentUser.uid,
      chatId,
      chatType,
      chatName,
      aliasDirectIds: aliases,
      archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  if (currentChat?.id === chatId) {
    resetChatPanel();
  }
  loadChatsList();
  loadGroupsList();
  loadArchivedChats();
}

async function unarchiveChat(archiveId) {
  await db.collection("archivedChats").doc(archiveId).delete();
  loadChatsList();
  loadGroupsList();
  loadArchivedChats();
}

async function getArchivedChatIds() {
  try {
    if (!currentUser) return new Set();

    const snapshot = await db
      .collection("archivedChats")
      .where("userId", "==", currentUser.uid)
      .get();

    const ids = new Set();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      if (data.chatId) ids.add(data.chatId);
      (data.aliasDirectIds || []).forEach((id) => id && ids.add(id));
    });
    return ids;
  } catch (error) {
    console.error("getArchivedChatIds failed:", error);
    return new Set();
  }
}

async function getDeletedChatIds() {
  try {
    if (!currentUser) return new Set();

    const snapshot = await db
      .collection("deletedChats")
      .where("userId", "==", currentUser.uid)
      .get();

    return new Set(snapshot.docs.map((doc) => doc.data().chatId));
  } catch (error) {
    console.error("getDeletedChatIds failed:", error);
    return new Set();
  }
}
async function deleteChatForMe(chatId, chatType, chatName = "Chat") {
  if (!currentUser || !chatId || !chatType) return;
  await db.collection("deletedChats").doc(`${currentUser.uid}_${chatId}`).set({
    userId: currentUser.uid,
    chatId,
    chatType,
    chatName,
    deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  if (currentChat?.id === chatId && currentChatType === chatType) {
    resetChatPanel();
  }
  showToast("Chat deleted for you");
  loadCurrentChatList();
}

async function clearChatHistoryForMe(chatId, chatType, chatName = "Chat") {
  if (!currentUser || !chatId || !chatType) return;

  const targetIds =
    chatType === "direct"
      ? [
          ...new Set([
            chatId,
            ...(contextMenuTarget?.dataset.aliasDirectIds || "")
              .split(",")
              .filter(Boolean),
          ]),
        ].slice(0, 10)
      : [chatId];
  const fieldName = chatType === "direct" ? "directId" : "groupId";
  const snapshot = await db
    .collection("messages")
    .where(
      fieldName,
      targetIds.length > 1 ? "in" : "==",
      targetIds.length > 1 ? targetIds : targetIds[0],
    )
    .get();

  if (snapshot.empty) {
    showToast("No chat history to clear");
    return;
  }

  const docs = snapshot.docs;
  for (let index = 0; index < docs.length; index += 400) {
    const batch = db.batch();
    docs.slice(index, index + 400).forEach((doc) => {
      batch.update(doc.ref, {
        [`deletedFor.${currentUser.uid}`]: true,
        [`deletedForAt.${currentUser.uid}`]:
          firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  if (currentChat?.id === chatId && currentChatType === chatType) {
    loadMessages();
  }
  showToast(`Chat history cleared for ${chatName}`);
  loadCurrentChatList();
}

async function getArchivedDirectChatNames() {
  try {
    if (!currentUser) return new Set();
    const snapshot = await db
      .collection("archivedChats")
      .where("userId", "==", currentUser.uid)
      .where("chatType", "==", "direct")
      .get();
    const names = new Set();
    snapshot.docs.forEach((doc) => {
      const name = String(doc.data()?.chatName || "")
        .trim()
        .toLowerCase();
      if (name) names.add(name);
    });
    return names;
  } catch (error) {
    console.error("getArchivedDirectChatNames failed:", error);
    return new Set();
  }
}

function setupArchiveSection() {
  const archiveHeader = document.getElementById("archiveHeader");
  const archiveList = document.getElementById("archiveList");
  const archiveToggle = document.getElementById("archiveToggle");
  if (!archiveHeader || !archiveList || !archiveToggle) return;

  archiveHeader.addEventListener("click", () => {
    const isOpen = archiveList.classList.toggle("show");
    archiveToggle.textContent = isOpen ? "▲" : "▼";
    if (isOpen) loadArchivedChats();
  });
}

let archivedRowLongPressTimer = null;
let archivedRowLongPressTriggered = false;

function hideArchivedRowMenu() {
  const menu = document.getElementById("archivedRowMenu");
  if (menu) menu.style.display = "none";
}

function showArchivedRowMenu(x, y, archive) {
  const menu = document.getElementById("archivedRowMenu");
  if (!menu) return;
  menu.dataset.archiveId = archive.id;
  menu.dataset.chatId = archive.chatId;
  menu.dataset.chatType = archive.chatType;
  menu.dataset.chatName = archive.chatName || "Chat";
  menu.style.display = "block";
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - menu.offsetWidth - margin);
  const maxY = Math.max(
    margin,
    window.innerHeight - menu.offsetHeight - margin,
  );
  menu.style.left = `${Math.min(Math.max(margin, x), maxX)}px`;
  menu.style.top = `${Math.min(Math.max(margin, y), maxY)}px`;
}

async function loadArchivedChats() {
  const archiveList = document.getElementById("archiveList");
  if (!archiveList) return;
  const snapshot = await db
    .collection("archivedChats")
    .where("userId", "==", currentUser.uid)
    .get();
  if (snapshot.empty) {
    archiveList.innerHTML =
      '<div class="empty-state" style="padding:20px;">No archived chats</div>';
    return;
  }
  archiveList.innerHTML = "";
  const deduped = new Map();
  snapshot.docs.forEach((doc) => {
    const data = { id: doc.id, ...doc.data() };
    const key =
      data.chatType === "direct"
        ? `direct:${String(data.chatName || data.chatId || "").toLowerCase()}`
        : `group:${data.chatId || doc.id}`;
    const existing = deduped.get(key);
    const existingTs = existing?.archivedAt?.toMillis?.() || 0;
    const currentTs = data.archivedAt?.toMillis?.() || 0;
    if (!existing || currentTs >= existingTs) deduped.set(key, data);
  });
  const archivedChats = [...deduped.values()].sort(
    (a, b) =>
      (b.archivedAt?.toMillis?.() || 0) - (a.archivedAt?.toMillis?.() || 0),
  );
  for (const archive of archivedChats) {
    const archiveDiv = document.createElement("div");
    archiveDiv.className = "list-item";
    archiveDiv.style.opacity = "0.7";
    archiveDiv.dataset.chatId = archive.chatId;
    archiveDiv.dataset.chatType = archive.chatType;
    archiveDiv.dataset.archiveId = archive.id;
    archiveDiv.dataset.chatName = archive.chatName || "Chat";
    archiveDiv.innerHTML = `<div class="list-avatar">${archive.chatType === "group" ? "G" : escapeHtml(getInitials(archive.chatName || ""))}</div><div class="list-info"><div class="list-name">${escapeHtml(archive.chatName)}</div><div class="list-preview">Archived</div></div><button class="list-item-menu unarchive-btn" data-id="${archive.id}" title="Unarchive" aria-label="Unarchive"></button>`;
    archiveList.appendChild(archiveDiv);
    archiveDiv.addEventListener("selectstart", (event) =>
      event.preventDefault(),
    );
    archiveDiv.addEventListener("dragstart", (event) => event.preventDefault());
    const openArchivedMenu = (x, y) => showArchivedRowMenu(x, y, archive);
    archiveDiv.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openArchivedMenu(event.clientX, event.clientY);
    });
    archiveDiv.addEventListener(
      "touchstart",
      (event) => {
        archivedRowLongPressTriggered = false;
        const touch = event.touches && event.touches[0];
        if (!touch) return;
        archivedRowLongPressTimer = setTimeout(() => {
          archivedRowLongPressTriggered = true;
          event.preventDefault();
          openArchivedMenu(touch.clientX, touch.clientY);
        }, 450);
      },
      { passive: false },
    );
    const clearLongPress = () => {
      if (archivedRowLongPressTimer) {
        clearTimeout(archivedRowLongPressTimer);
        archivedRowLongPressTimer = null;
      }
    };
    archiveDiv.addEventListener("touchmove", clearLongPress, { passive: true });
    archiveDiv.addEventListener(
      "touchend",
      (event) => {
        if (archivedRowLongPressTriggered) event.preventDefault();
        clearLongPress();
      },
      { passive: false },
    );
    archiveDiv.addEventListener("touchcancel", clearLongPress, {
      passive: true,
    });
  }
  archiveList.querySelectorAll(".list-item .list-info").forEach((infoEl) => {
    infoEl.addEventListener("click", async () => {
      const parent = infoEl.closest(".list-item");
      const chatId = parent?.dataset.chatId;
      const chatType = parent?.dataset.chatType;
      if (!chatId || !chatType) return;
      if (chatType === "group") {
        const groupDoc = await db.collection("groups").doc(chatId).get();
        if (groupDoc.exists)
          loadGroupChat(chatId, groupDoc.data().name || "Group");
      } else {
        const directDoc = await db.collection("directChats").doc(chatId).get();
        const participants =
          directDoc.data()?.participants || chatId.split("_");
        const otherUserId = participants.find((id) => id !== currentUser.uid);
        if (otherUserId) {
          const userDoc = await db.collection("users").doc(otherUserId).get();
          if (userDoc.exists)
            startDirectChat({ id: otherUserId, ...userDoc.data() });
        }
      }
    });
  });
  document.querySelectorAll(".unarchive-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await unarchiveChat(btn.dataset.id);
    });
  });
}

async function buildDirectChatItems() {
  if (!currentUser) return [];
  const items = [getSavedMessagesItem()];
  let archivedChatIds = new Set();
  let archivedDirectNames = new Set();
  let deletedChatIds = new Set();
  let directChats = null;

  try {
    archivedChatIds = await getArchivedChatIds();
    archivedDirectNames = await getArchivedDirectChatNames();
    deletedChatIds = await getDeletedChatIds();
    directChats = await db
      .collection("directChats")
      .where("participants", "array-contains", currentUser.uid)
      .get();
  } catch (error) {
    console.error("Could not load direct chat metadata:", error);
    return items;
  }

  const directChatDocs = new Map();
  directChats.docs.forEach((doc) =>
    directChatDocs.set(doc.id, { id: doc.id, data: doc.data() }),
  );
  try {
    const acceptedSent = await db
      .collection("chatRequests")
      .where("fromUserId", "==", currentUser.uid)
      .where("status", "==", "accepted")
      .get();
    const acceptedReceived = await db
      .collection("chatRequests")
      .where("toUserId", "==", currentUser.uid)
      .where("status", "==", "accepted")
      .get();
    [...acceptedSent.docs, ...acceptedReceived.docs].forEach((doc) => {
      const request = doc.data() || {};
      const otherUserId =
        request.fromUserId === currentUser.uid
          ? request.toUserId
          : request.fromUserId;
      if (!otherUserId) return;
      const chatId = getDirectChatId(currentUser.uid, otherUserId);
      if (directChatDocs.has(chatId)) return;
      directChatDocs.set(chatId, {
        id: chatId,
        data: {
          participants: [currentUser.uid, otherUserId],
          participantEmails: {
            [otherUserId]:
              request.fromUserId === currentUser.uid
                ? request.toUserEmail
                : request.fromUserEmail,
          },
          participantNames: {
            [otherUserId]:
              request.fromUserId === currentUser.uid
                ? request.toUserName
                : request.fromUserName,
          },
          status: "active",
          lastMessage: "Tap to open chat",
          lastMessageTime: request.respondedAt || request.createdAt || null,
        },
      });
    });
  } catch (error) {
    console.warn("Accepted chat fallback skipped:", error);
  }

  for (const chat of directChatDocs.values()) {
    try {
      const chatData = chat.data || {};
      if (chatData.status && chatData.status !== "active") continue;
      const aliasIds = [
        ...new Set([chat.id, ...(chatData.aliasDirectIds || [])]),
      ];
      if (
        aliasIds.some((id) => archivedChatIds.has(id)) ||
        aliasIds.some((id) => deletedChatIds.has(id))
      )
        continue;
      const participants = chatData.participants || chat.id.split("_");
      const otherUserId = participants.find((id) => id !== currentUser.uid);
      if (!otherUserId || isBlocked(otherUserId)) continue;
      const fallbackEmail = chatData.participantEmails?.[otherUserId] || "";
      const fallbackName =
        chatData.participantNames?.[otherUserId] ||
        fallbackEmail ||
        "Unknown contact";
      const userDoc = await db.collection("users").doc(otherUserId).get();
      const profileMatch = userDoc.exists
        ? null
        : findProfileByEmail(fallbackEmail) ||
          findProfileByFallbackName(fallbackName);
      const resolvedUserId = userDoc.exists
        ? otherUserId
        : profileMatch?.id || otherUserId;
      const userData = userDoc.exists ? userDoc.data() : profileMatch || {};
      if ((userDoc.exists || profileMatch) && userData.isActive === false)
        continue;
      const displayName =
        userData.displayName || userData.email || fallbackName;
      if (
        archivedDirectNames.has(
          String(displayName || "")
            .trim()
            .toLowerCase(),
        )
      )
        continue;
      const onlineStatus = userData.onlineStatus || "offline";
      const presenceText = getPresenceText(userData);
      const preview = getChatListPreviewText(chatData.lastMessage, "direct");

      items.push({
        id: chat.id,
        type: "direct",
        name: displayName,
        avatar: userData.avatar
          ? `<img src="${userData.avatar}">`
          : escapeHtml(
              getInitials(displayName, userData.email || fallbackEmail),
            ),
        preview,
        unreadCount: await getChatUnreadCount(
          [chat.id, ...(chatData.aliasDirectIds || [])],
          "direct",
        ),
        isFavorite: favoriteChatIds.includes(chat.id),
        isPinned: pinnedChatIds.includes(chat.id),
        isMuted: isChatMuted(chat.id),
        otherUserId: resolvedUserId,
        user: { id: resolvedUserId, ...userData, displayName },
        email: userData.email || fallbackEmail || "",
        phone: userData.phone || userData.phoneNumber || "",
        hasUserProfile: userDoc.exists || !!profileMatch,
        aliasDirectIds: [
          ...new Set([chat.id, ...(chatData.aliasDirectIds || [])]),
        ],
        directChatId: chat.id,
        chatData,
        disappearAfterSecs: chatData.disappearAfterSecs || 0,
        onlineStatus,
        presenceText,
        lastMessageTime: chatData.lastMessageTime?.toDate?.() || new Date(0),
      });
    } catch (error) {
      console.error("Skipping broken direct chat row:", chat.id, error);
    }
  }

  return [
    items[0],
    ...mergeDirectContactItems(items.filter((item) => item.type !== "saved")),
  ];
}

async function buildGroupChatItems() {
  if (!currentUser) return [];
  let archivedChatIds = new Set();
  let deletedChatIds = new Set();
  let memberSnapshot = null;
  const items = [];

  try {
    archivedChatIds = await getArchivedChatIds();
    deletedChatIds = await getDeletedChatIds();
    memberSnapshot = await db
      .collection("groupMembers")
      .where("userId", "==", currentUser.uid)
      .get();
  } catch (error) {
    console.error("Could not load group chat metadata:", error);
    return items;
  }

  for (const memberDoc of memberSnapshot.docs) {
    try {
      const groupId = memberDoc.data()?.groupId;
      if (
        !groupId ||
        archivedChatIds.has(groupId) ||
        deletedChatIds.has(groupId)
      )
        continue;
      const groupDoc = await db.collection("groups").doc(groupId).get();
      if (!groupDoc.exists) continue;
      const group = groupDoc.data() || {};
      const membership = memberDoc.data() || {};
      items.push({
        id: groupDoc.id,
        type: "group",
        name: group.name || "Group",
        avatar: group.icon
          ? `<img src="${group.icon}">`
          : escapeHtml(getInitials(group.name || "Group")),
        preview: group.memberCount
          ? `${group.memberCount} members`
          : `Invite code ${group.code || ""}`.trim(),
        unreadCount: await getChatUnreadCount(groupDoc.id, "group"),
        isFavorite: favoriteChatIds.includes(groupDoc.id),
        isPinned: pinnedChatIds.includes(groupDoc.id),
        isMuted: isChatMuted(groupDoc.id),
        role:
          membership.role ||
          (group.createdBy === currentUser.uid ? "admin" : "member"),
        memberCount: group.memberCount || 0,
        icon: group.icon || "",
        code: group.code || "",
        lastMessageTime:
          group.updatedAt?.toDate?.() ||
          group.createdAt?.toDate?.() ||
          new Date(0),
      });
    } catch (error) {
      console.error("Skipping broken group row:", memberDoc.id, error);
    }
  }
  return items;
}
function loadCurrentChatList() {
  if (currentViewTab === "groups") loadGroupsList();
  else loadAllChatsList(document.getElementById("searchInput")?.value || "");
}

function updateChatContextMenuLabels() {
  if (!contextMenuTarget) return;
  const chatId = contextMenuTarget.dataset.chatId;
  const chatType = contextMenuTarget.dataset.chatType || "";
  const isGroup = chatType === "group";
  const isDirect = chatType === "direct";
  const muteItem = document.getElementById("muteChatMenuItem");
  if (muteItem && chatId) {
    const muteRecord = getActiveMuteRecord(chatId, chatType);
    muteItem.textContent = muteRecord ? "Unmute notifications" : "Mute notifications";
  }
  const pinItem = document.getElementById("pinChatMenuItem");
  if (pinItem && chatId) {
    pinItem.textContent = pinnedChatIds.includes(chatId)
      ? "Unpin Chat"
      : "Pin Chat";
  }
  const infoItem = document.getElementById("chatInfoMenuItem");
  if (infoItem) infoItem.textContent = isGroup ? "Group info" : "Contact info";
  const mediaItem = document.getElementById("chatMediaMenuItem");
  if (mediaItem)
    mediaItem.textContent = isGroup
      ? "Group media"
      : "Media, links, and docs";
  const favoriteItem = document.getElementById("favoriteChatMenuItem");
  if (favoriteItem)
    favoriteItem.textContent = favoriteChatIds.includes(chatId)
      ? "Remove from Favorites"
      : "Add to Favorites";
  const markItem = document.getElementById("markReadMenuItem");
  if (markItem) {
    const unreadCount = Number(contextMenuTarget.dataset.unreadCount || 0);
    markItem.textContent = unreadCount > 0 ? "Mark as Read" : "Mark as Unread";
  }
  const blockItem = document.getElementById("blockUserMenuItem");
  const reportItem = document.getElementById("reportUserMenuItem");
  const exitItem = document.getElementById("exitGroupMenuItem");
  if (blockItem) blockItem.style.display = isDirect ? "" : "none";
  if (reportItem) reportItem.textContent = isGroup ? "Report group" : "Report contact";
  if (exitItem) exitItem.style.display = isGroup ? "" : "none";
}

async function loadChatsList() {
  if (!currentUser) return;
  loadAllChatsList(document.getElementById("searchInput")?.value || "");
}

function formatLastSeen(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (date.toDateString() === now.toDateString())
    return `last seen today at ${time}`;
  if (date.toDateString() === yesterday.toDateString())
    return `last seen yesterday at ${time}`;
  return `last seen ${date.toLocaleDateString()} at ${time}`;
}

function isUserOnlineNow(userData = {}) {
  if (userData.onlineStatus !== "online") return false;
  const lastSeen =
    userData.lastSeen?.toDate?.() ||
    (userData.lastSeen ? new Date(userData.lastSeen) : null);
  if (!lastSeen || Number.isNaN(lastSeen.getTime())) return false;
  return Date.now() - lastSeen.getTime() < 90000;
}

function getPresenceText(userData) {
  if (!userData) return "";
  const canSeePresence =
    !privacySettings.hideLastSeen && !userData.privacySettings?.hideLastSeen;
  if (!canSeePresence) return "last seen hidden";
  if (isUserOnlineNow(userData)) return "online";
  if (userData.lastSeen) return formatLastSeen(userData.lastSeen);
  return "";
}

async function setCurrentUserPresence(isOnline) {
  if (!currentUser) return;
  await db
    .collection("users")
    .doc(currentUser.uid)
    .set(
      {
        onlineStatus: isOnline ? "online" : "offline",
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        lastPresenceAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    .catch((error) => {
      console.warn("Presence update failed:", error);
    });
}

function startPresenceHeartbeat() {
  clearInterval(presenceHeartbeatTimer);
  setCurrentUserPresence(document.visibilityState !== "hidden").catch(() => {});
  presenceHeartbeatTimer = setInterval(() => {
    if (!currentUser) return;
    setCurrentUserPresence(document.visibilityState !== "hidden").catch(
      () => {},
    );
  }, 30000);
}

function stopPresenceHeartbeat() {
  clearInterval(presenceHeartbeatTimer);
  presenceHeartbeatTimer = null;
}

function refreshOpenChatPresence() {
  if (!currentChat || currentChatType !== "direct" || !currentChat.otherUserId)
    return;
  const user = allUsers.find((u) => u.id === currentChat.otherUserId);
  const chatStatus = document.getElementById("chatStatus");
  if (user && chatStatus) chatStatus.textContent = getPresenceText(user);
}

async function loadGroupsList() {
  if (!currentUser) return;
  const groupsList = document.getElementById("groupsList");
  const groupActions = document.getElementById("groupActions");
  if (!groupsList) return;
  const enhancedGroups = await buildGroupChatItems();

  const filteredGroups = enhancedGroups.filter((group) => {
    if (currentViewTab === "favorites" && !group.isFavorite) return false;
    if (currentViewTab === "unread" && group.unreadCount === 0) return false;
    if (currentViewTab === "muted" && !group.isMuted) return false;
    if (activeFolderChatIds && !activeFolderChatIds.has(group.id)) return false;
    return true;
  });

  filteredGroups.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (
      b.lastMessageTime - a.lastMessageTime || a.name.localeCompare(b.name)
    );
  });

  if (filteredGroups.length === 0) {
    if (groupActions) groupActions.style.display = "none";
    groupsList.innerHTML = `
      <div class="empty-state groups-empty-state">
        <div class="empty-state-title">No groups yet</div>
        <div class="empty-state-copy">Create a group, invite people, or join using an invite code.</div>
        <div class="empty-state-actions">
          <button class="join-btn empty-create-group" type="button">Create group</button>
          <button class="join-btn empty-join-group" type="button">Join group</button>
        </div>
      </div>`;
    groupsList
      .querySelector(".empty-create-group")
      ?.addEventListener("click", () => {
        document.getElementById("createGroupModal").style.display = "flex";
      });
    groupsList
      .querySelector(".empty-join-group")
      ?.addEventListener("click", () => {
        document.getElementById("joinGroupModal").style.display = "flex";
      });
    return;
  }

  if (groupActions)
    groupActions.style.display = currentViewTab === "groups" ? "flex" : "none";
  groupsList.innerHTML = "";
  for (const group of filteredGroups) {
    const isMuted = isChatMuted(group.id);
    const groupDiv = document.createElement("div");
    groupDiv.className = "list-item";
    if (group.isPinned) groupDiv.classList.add("pinned");
    groupDiv.dataset.chatId = group.id;
    groupDiv.dataset.chatType = "group";
    groupDiv.dataset.unreadCount = group.unreadCount;
    groupDiv.dataset.chatName = group.name || "";
    if (currentChat?.id === group.id && currentChatType === "group")
      groupDiv.classList.add("active");
    const roleLabel = ["owner", "admin"].includes(group.role)
      ? "Admin"
      : "Member";
    const groupPreview = [
      roleLabel,
      group.memberCount ? `${group.memberCount} members` : "",
      group.code ? `Code ${group.code}` : "",
    ]
      .filter(Boolean)
      .join(" - ");
    groupDiv.innerHTML = `<div class="list-avatar">${group.icon ? `<img src="${group.icon}">` : escapeHtml(getInitials(group.name || "Group"))}</div><div class="list-info" style="flex:1; cursor:pointer;"><div class="list-name">${group.isPinned ? '<span class="pin-icon">&#x1F4CC;</span> ' : ""}${group.isFavorite ? "* " : ""}${escapeHtml(group.name)} ${isMuted ? "[Muted]" : ""}</div><div class="list-preview">${escapeHtml(groupPreview)}${group.unreadCount ? ` - ${group.unreadCount} unread` : ""}</div></div><button class="list-item-menu mute-chat-btn" data-chat-id="${group.id}" data-chat-type="group">${isMuted ? "Unmute" : "Mute"}</button><button class="list-item-menu archive-chat-btn" data-chat-id="${group.id}" data-chat-type="group" data-chat-name="${escapeHtml(group.name)}">Archive</button>`;
    if (group.unreadCount) {
      groupDiv.insertAdjacentHTML(
        "beforeend",
        `<span class="unread-pill">${group.unreadCount}</span>`,
      );
    }
    groupDiv
      .querySelector(".archive-chat-btn")
      ?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm(`Archive group "${group.name}"?`))
          await archiveChat(group.id, "group", group.name);
      });
    groupDiv
      .querySelector(".mute-chat-btn")
      ?.addEventListener("click", async (e) => {
        e.stopPropagation();
        const activeMute = getActiveMuteRecord(group.id, "group");
        if (activeMute) {
          await unmuteChat(activeMute.id);
          loadGroupsList();
          return;
        }
        const duration = prompt("Mute for: 1h, 8h, 24h, 7d, or always?", "8h");
        if (["1h", "8h", "24h", "7d", "always"].includes(duration)) {
          await muteChat(group.id, "group", duration);
          loadGroupsList();
        }
      });
    groupDiv.querySelector(".list-info").onclick = () =>
      loadGroupChat(group.id, group.name);
    groupsList.appendChild(groupDiv);
  }
}

// ========================================
// CHAT FOLDERS
// ========================================

async function loadChatFolders() {
  if (!currentUser) return;
  try {
    const doc = await db.collection("users").doc(currentUser.uid).get();
    chatFolders = doc.data()?.chatFolders || [];
  } catch (e) {
    chatFolders = [];
  }
  renderFolderTabs();
}

async function saveChatFolders() {
  if (!currentUser) return;
  await db
    .collection("users")
    .doc(currentUser.uid)
    .update({ chatFolders })
    .catch(async () => {
      await db
        .collection("users")
        .doc(currentUser.uid)
        .set({ chatFolders }, { merge: true });
    });
  renderFolderTabs();
}

function renderFolderTabs() {
  const container = document.getElementById("folderTabs");
  if (!container) return;
  container.innerHTML = "";
  if (!chatFolders.length) {
    container.style.display = "none";
    return;
  }
  container.style.display = "flex";
  chatFolders.forEach((folder, index) => {
    const tab = document.createElement("button");
    tab.className =
      "folder-tab" + (index === currentFolderIndex ? " active" : "");
    tab.textContent = (folder.icon || "📁") + " " + folder.name;
    tab.onclick = () => selectFolder(index);
    container.appendChild(tab);
  });
  if (currentFolderIndex >= 0) {
    const clearBtn = document.createElement("button");
    clearBtn.className = "folder-tab clear-folder-tab";
    clearBtn.textContent = "✕ All";
    clearBtn.title = "Show all chats";
    clearBtn.onclick = () => selectFolder(-1);
    container.appendChild(clearBtn);
  }
}

function selectFolder(index) {
  currentFolderIndex = index;
  const activeFolder = index >= 0 ? chatFolders[index] : null;
  document
    .querySelectorAll(".folder-tab")
    .forEach((t) => t.classList.remove("active"));
  if (index >= 0) {
    const tabs = document.querySelectorAll(".folder-tab");
    if (tabs[index]) tabs[index].classList.add("active");
  }
  if (activeFolder) {
    activeFolderChatIds = new Set(activeFolder.chatIds || []);
  } else {
    activeFolderChatIds = null;
  }
  loadCurrentChatList();
  if (currentViewTab === "groups") loadGroupsList();
}

function getFilteredChatsByFolder(items) {
  if (!activeFolderChatIds) return items;
  return items.filter((item) => activeFolderChatIds.has(item.id));
}

function renderManageFoldersModal() {
  const container = document.getElementById("foldersList");
  if (!container) return;
  container.innerHTML = "";
  if (!chatFolders.length) {
    container.innerHTML =
      '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No folders yet. Create one to organize your chats.</div>';
    return;
  }
  chatFolders.forEach((folder, index) => {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)";
    const count = (folder.chatIds || []).length;
    row.innerHTML = `<span style="font-size:20px">${folder.icon || "📁"}</span><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px;color:var(--text)">${escapeHtml(folder.name)}</div><div style="font-size:12px;color:var(--muted)">${count} chat${count !== 1 ? "s" : ""}</div></div><button class="btn btn-outline delete-folder-btn" data-index="${index}" style="min-height:30px;padding:0 10px;font-size:12px;color:var(--danger);border-color:var(--danger)">Delete</button>`;
    row.onclick = (e) => {
      if (e.target.closest(".delete-folder-btn")) return;
      const newName = prompt("Folder name:", folder.name);
      if (newName && newName.trim()) {
        chatFolders[index].name = newName.trim();
        saveChatFolders();
        renderManageFoldersModal();
      }
    };
    row.querySelector(".delete-folder-btn").onclick = (e) => {
      e.stopPropagation();
      if (!confirm(`Delete folder "${folder.name}"?`)) return;
      chatFolders.splice(index, 1);
      if (currentFolderIndex === index) {
        currentFolderIndex = -1;
        activeFolderChatIds = null;
      } else if (currentFolderIndex > index) currentFolderIndex--;
      saveChatFolders();
      renderManageFoldersModal();
      loadCurrentChatList();
    };
    container.appendChild(row);
  });
  document.getElementById("addFolderBtn").onclick = () => {
    const name = prompt("New folder name:");
    if (!name || !name.trim()) return;
    chatFolders.push({ name: name.trim(), icon: "📁", chatIds: [] });
    saveChatFolders();
    renderManageFoldersModal();
  };
}

// ========================================
// BROADCAST CHANNELS
// ========================================

function renderBroadcastMemberOptions(query) {
  const container = document.getElementById("broadcastMemberList");
  if (!container) return;
  const q = (query || "").toLowerCase().trim();
  const filtered = allUsers.filter(
    (u) =>
      u.id !== currentUser.uid &&
      (q === "" ||
        (u.displayName || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)),
  );
  if (!filtered.length) {
    container.innerHTML =
      '<div style="padding:12px;text-align:center;color:var(--muted);font-size:13px">No users found</div>';
    return;
  }
  container.innerHTML = "";
  for (const u of filtered) {
    const selected = broadcastSelectedMemberIds.has(u.id);
    const row = document.createElement("div");
    row.className = "broadcast-member-option" + (selected ? " selected" : "");
    const avatarHtml = u.avatar
      ? `<img src="${u.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover">`
      : `<span style="width:32px;height:32px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${escapeHtml((u.displayName || u.email || "?")[0].toUpperCase())}</span>`;
    row.innerHTML = `${avatarHtml}<input type="checkbox" ${selected ? "checked" : ""}><span style="flex:1;font-size:13px">${escapeHtml(u.displayName || u.email || "User")}</span>`;
    row.onclick = (e) => {
      if (e.target.tagName === "INPUT") return;
      const cb = row.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
      if (cb.checked) broadcastSelectedMemberIds.add(u.id);
      else broadcastSelectedMemberIds.delete(u.id);
      row.classList.toggle("selected", cb.checked);
      renderBroadcastSelectedTags();
    };
    row.querySelector('input[type="checkbox"]').onchange = () => {
      const cb = row.querySelector('input[type="checkbox"]');
      if (cb.checked) broadcastSelectedMemberIds.add(u.id);
      else broadcastSelectedMemberIds.delete(u.id);
      row.classList.toggle("selected", cb.checked);
      renderBroadcastSelectedTags();
    };
    container.appendChild(row);
  }
}

function renderBroadcastSelectedTags() {
  const container = document.getElementById("broadcastSelectedMembers");
  if (!container) return;
  container.innerHTML = "";
  for (const id of broadcastSelectedMemberIds) {
    const u = allUsers.find((u) => u.id === id);
    if (!u) continue;
    const tag = document.createElement("span");
    tag.className = "broadcast-selected-tag";
    tag.innerHTML = `${escapeHtml(u.displayName || u.email || "User")}<span class="remove-tag" data-id="${id}">&times;</span>`;
    tag.querySelector(".remove-tag").onclick = () => {
      broadcastSelectedMemberIds.delete(id);
      renderBroadcastSelectedTags();
      renderBroadcastMemberOptions(
        document.getElementById("broadcastMemberSearch")?.value || "",
      );
    };
    container.appendChild(tag);
  }
}

async function loadBroadcastsList() {
  if (!currentUser) return;
  const container = document.getElementById("broadcastsList");
  const actions = document.getElementById("broadcastActions");
  if (!container) return;
  try {
    const snapshot = await db
      .collection("broadcasts")
      .where("members", "array-contains", currentUser.uid)
      .orderBy("createdAt", "desc")
      .get();
    currentBroadcasts = [];
    snapshot.forEach((doc) => {
      currentBroadcasts.push({ id: doc.id, ...doc.data() });
    });
  } catch (e) {
    if (e.code === "failed-precondition") {
      currentBroadcasts = [];
    } else {
      console.warn("loadBroadcastsList error:", e);
      currentBroadcasts = [];
    }
  }
  if (currentViewTab !== "broadcasts") return;
  if (actions) actions.style.display = "flex";
  if (!currentBroadcasts.length) {
    container.innerHTML =
      '<div class="empty-state">📡 No broadcasts yet.<br><span style="font-size:12px;color:var(--muted)">Create one to send messages to multiple people at once.</span></div>';
    return;
  }
  container.innerHTML = "";
  for (const b of currentBroadcasts) {
    const div = document.createElement("div");
    div.className = "broadcast-item";
    div.dataset.broadcastId = b.id;
    const isOwner = b.ownerId === currentUser.uid;
    const memberCount = Array.isArray(b.members) ? b.members.length : 0;
    const avatarHtml = b.ownerAvatar ? `<img src="${b.ownerAvatar}">` : "📡";
    div.innerHTML = `<div class="broadcast-avatar">${avatarHtml}</div><div class="broadcast-info"><div class="broadcast-name">${escapeHtml(b.name || "Broadcast")}</div><div class="broadcast-meta">${escapeHtml(isOwner ? "You" : b.ownerName || "Owner")} · ${memberCount} member${memberCount !== 1 ? "s" : ""}${b.description ? " · " + escapeHtml(b.description.substring(0, 40)) : ""}</div></div>`;
    div.onclick = () =>
      openBroadcast(
        b.id,
        b.name,
        b.description || "",
        b.ownerName || "Owner",
        isOwner,
        b.members || [],
      );
    container.appendChild(div);
  }
}

async function openBroadcast(
  broadcastId,
  name,
  description,
  ownerName,
  isOwner,
  members,
) {
  if (currentBroadcastUnsubscribe) {
    currentBroadcastUnsubscribe();
    currentBroadcastUnsubscribe = null;
  }
  if (currentBroadcastMessagesUnsubscribe) {
    currentBroadcastMessagesUnsubscribe();
    currentBroadcastMessagesUnsubscribe = null;
  }
  saveCurrentDraft();
  currentChat = {
    id: broadcastId,
    type: "broadcast",
    isOwner,
    name,
    ownerName,
    members,
    description,
  };
  currentChatType = "broadcast";
  setActiveDraftKey();
  document.getElementById("currentChatName").textContent = name;
  document.getElementById("chatStatus").textContent = isOwner
    ? `${members?.length || 0} recipients`
    : `Broadcast by ${escapeHtml(ownerName)}`;
  document.getElementById("currentChatAvatar").innerHTML =
    '<div class="broadcast-avatar" style="width:40px;height:40px;font-size:16px">📡</div>';
  document.getElementById("inputArea").style.display = isOwner
    ? "flex"
    : "none";
  document.getElementById("groupInfoBtn").style.display = "none";
  document.getElementById("voiceCallBtn").style.display = "none";
  document.getElementById("videoCallBtn").style.display = "none";
  document.getElementById("replyPreviewBar").style.display = "none";
  currentReplyTo = null;
  resetMessageRenderLimit();
  loadBroadcastMessages(broadcastId);
  restoreCurrentDraft();
  loadPinnedMessages();
  applyCurrentChatWallpaper();
  openMobileChatPanel();
}

async function loadBroadcastMessages(broadcastId) {
  const messagesArea = document.getElementById("messagesArea");
  messagesArea.innerHTML =
    '<div style="text-align:center;padding:40px;color:var(--muted)">Loading messages...</div>';
  if (currentBroadcastMessagesUnsubscribe) {
    currentBroadcastMessagesUnsubscribe();
    currentBroadcastMessagesUnsubscribe = null;
  }
  if (currentBroadcastUnsubscribe) {
    currentBroadcastUnsubscribe();
    currentBroadcastUnsubscribe = null;
  }
  try {
    const broadcastDoc = await db
      .collection("broadcasts")
      .doc(broadcastId)
      .get();
    if (!broadcastDoc.exists) {
      messagesArea.innerHTML =
        '<div class="empty-state">Broadcast not found</div>';
      return;
    }
    const broadcastData = broadcastDoc.data();
    if (!broadcastData.members?.includes(currentUser.uid)) {
      messagesArea.innerHTML =
        '<div class="empty-state">You are not a member of this broadcast</div>';
      return;
    }
    currentChat = { ...currentChat, ...broadcastData, id: broadcastId };
    currentChat.isOwner = broadcastData.ownerId === currentUser.uid;
    document.getElementById("chatStatus").textContent = currentChat.isOwner
      ? `${broadcastData.members?.length || 0} recipients`
      : `Broadcast by ${escapeHtml(broadcastData.ownerName || "Owner")}`;
    document.getElementById("inputArea").style.display = currentChat.isOwner
      ? "flex"
      : "none";
  } catch (e) {
    console.warn("Broadcast load error:", e);
  }

  currentBroadcastMessagesUnsubscribe = db
    .collection("broadcasts")
    .doc(broadcastId)
    .collection("messages")
    .orderBy("timestamp", "asc")
    .onSnapshot((snapshot) => {
      messagesArea.innerHTML = "";
      if (snapshot.empty) {
        messagesArea.innerHTML =
          '<div class="home-panel"><div class="home-panel-icon">📡</div><h3 class="home-panel-title">' +
          escapeHtml(currentChat.name || "Broadcast") +
          '</h3><p class="home-panel-text">' +
          (currentChat.isOwner
            ? "Send a message to broadcast to all recipients."
            : "Waiting for broadcast messages...") +
          "</p></div>";
        return;
      }
      let hasMessages = false;
      snapshot.forEach((doc) => {
        hasMessages = true;
        const data = doc.data();
        const msgDiv = document.createElement("div");
        msgDiv.className =
          "message" + (data.senderId === currentUser.uid ? " my-message" : "");
        msgDiv.dataset.messageId = doc.id;
        const text = data.text || "";
        const time =
          data.timestamp
            ?.toDate?.()
            ?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ||
          "";
        const senderName =
          data.senderId === currentUser.uid
            ? "You"
            : data.senderName || "Broadcast";
        msgDiv.innerHTML = `<div class="message-bubble"><div class="message-sender">${escapeHtml(senderName)}</div><div class="message-text">${escapeHtml(text)}</div><div class="message-status">${time}</div></div>`;
        messagesArea.appendChild(msgDiv);
      });
      if (!hasMessages) {
        messagesArea.innerHTML =
          '<div class="home-panel"><div class="home-panel-icon">📡</div><h3 class="home-panel-title">' +
          escapeHtml(currentChat.name || "Broadcast") +
          '</h3><p class="home-panel-text">' +
          (currentChat.isOwner
            ? "Send a message to broadcast to all recipients."
            : "Waiting for broadcast messages...") +
          "</p></div>";
      }
      messagesArea.scrollTop = messagesArea.scrollHeight;
    });
}

async function sendBroadcastMessage(text) {
  if (
    !currentChat?.id ||
    currentChatType !== "broadcast" ||
    !currentChat.isOwner
  )
    return;
  text = text || document.getElementById("messageInput")?.value?.trim() || "";
  if (!text) return;
  document.getElementById("messageInput").value = "";
  try {
    await db
      .collection("broadcasts")
      .doc(currentChat.id)
      .collection("messages")
      .add({
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: "broadcast",
      });
  } catch (e) {
    showToast("Failed to send broadcast", "error");
  }
}

async function createBroadcast(name, description, memberIds) {
  if (!currentUser || !name.trim() || !memberIds.length) {
    showToast("Name and at least one recipient required", "error");
    return;
  }
  if (memberIds.length > 50) {
    showToast("Maximum 50 recipients per broadcast", "error");
    return;
  }
  const allMemberIds = [currentUser.uid, ...memberIds];
  try {
    const ref = await db.collection("broadcasts").add({
      name: name.trim(),
      description: description.trim(),
      ownerId: currentUser.uid,
      ownerName: currentUser.displayName || currentUser.email,
      ownerAvatar: currentUser.photoURL || "",
      members: allMemberIds,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("Broadcast created!");
    document.getElementById("createBroadcastModal").style.display = "none";
    document.getElementById("newBroadcastName").value = "";
    document.getElementById("newBroadcastDescription").value = "";
    broadcastSelectedMemberIds = new Set();
    document.getElementById("broadcastSelectedMembers").innerHTML = "";
    if (currentViewTab === "broadcasts") await loadBroadcastsList();
    await openBroadcast(
      ref.id,
      name.trim(),
      description.trim(),
      currentUser.displayName || currentUser.email,
      true,
      allMemberIds,
    );
  } catch (e) {
    showToast("Failed to create broadcast", "error");
    console.warn("createBroadcast error:", e);
  }
}

// ========================================
// CHAT FRAMEWORK STARTERS
// ========================================

async function startSavedMessages() {
  saveCurrentDraft();
  const chatId = getSavedMessagesChatId();
  if (!chatId) return;
  const chatRef = db.collection("directChats").doc(chatId);
  const chatDoc = await chatRef.get();
  if (!chatDoc.exists) {
    await chatRef.set({
      participants: [currentUser.uid],
      status: "active",
      saved: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  currentChat = {
    id: chatId,
    otherUserId: currentUser.uid,
    otherUserName: "Saved Messages",
    type: "direct",
    isSaved: true,
    aliasDirectIds: [chatId],
  };
  currentChatType = "direct";
  setActiveDraftKey();
  document.getElementById("currentChatName").textContent = "Saved Messages";
  document.getElementById("chatStatus").textContent =
    "Private notes, files, and reminders";
  setChatHeaderAvatar("&#9733;");
  document.getElementById("inputArea").style.display = "flex";
  document.getElementById("groupInfoBtn").style.display = "none";
  document.getElementById("voiceCallBtn").style.display = "none";
  document.getElementById("videoCallBtn").style.display = "none";
  document.getElementById("replyPreviewBar").style.display = "none";
  currentReplyTo = null;
  resetMessageRenderLimit();
  updateEncryptionBadge(chatId, "direct");
  loadMessages();
  restoreCurrentDraft();
  loadPinnedMessages();
  applyCurrentChatWallpaper();
  openMobileChatPanel();
  loadCurrentChatList();
}

async function startDirectChat(user) {
  saveCurrentDraft();
  const otherUserId = user.id || user.otherUserId;
  if (!otherUserId) {
    showToast("Could not open chat: missing user", "error");
    return;
  }
  if (isBlocked(otherUserId)) {
    showToast("You have blocked this user.", "error");
    return;
  }
  const chatId =
    user.directChatId ||
    user.chatId ||
    getDirectChatId(currentUser.uid, otherUserId);
  const chatRef = db.collection("directChats").doc(chatId);
  let chatData = user.chatData || {};
  if (!Object.keys(chatData).length) {
    const chatDoc = await chatRef.get().catch((error) => {
      console.warn("Direct chat metadata read skipped:", error);
      return null;
    });
    chatData = chatDoc?.data?.() || {};
  }
  const aliasDirectIds = [
    ...new Set(
      [
        chatId,
        ...(user.aliasDirectIds || []),
        ...(chatData.aliasDirectIds || []),
      ].filter(Boolean),
    ),
  ];
  currentChat = {
    id: chatId,
    otherUserId,
    otherUserName: user.displayName || user.email || user.name || "User",
    type: "direct",
    aliasDirectIds,
    disappearAfterSecs:
      user.disappearAfterSecs || chatData.disappearAfterSecs || 0,
  };
  chatRef
    .set(
      {
        participants: [currentUser.uid, otherUserId],
        participantEmails: {
          [currentUser.uid]: normalizeEmail(currentUser.email),
          [otherUserId]: normalizeEmail(user.email),
        },
        participantNames: {
          [currentUser.uid]: currentUser.displayName || currentUser.email,
          [otherUserId]: user.displayName || user.email || user.name || "User",
        },
        status: "active",
      },
      { merge: true },
    )
    .catch((error) => {
      console.warn("Direct chat metadata merge skipped:", error);
    });
  currentChatType = "direct";
  setActiveDraftKey();
  document.getElementById("currentChatName").textContent =
    currentChat.otherUserName;
  document.getElementById("chatStatus").textContent = getPresenceText(user);
  setChatHeaderAvatar(
    user.avatar
      ? `<img src="${user.avatar}">`
      : escapeHtml(getInitials(currentChat.otherUserName, user.email || "")),
  );
  document.getElementById("inputArea").style.display = "flex";
  document.getElementById("groupInfoBtn").style.display = "none";
  updateEncryptionBadge(chatId, "direct");
  const voiceCallBtn = document.getElementById("voiceCallBtn");
  const videoCallBtn = document.getElementById("videoCallBtn");
  if (voiceCallBtn) {
    voiceCallBtn.style.display = "inline-flex";
    voiceCallBtn.disabled = false;
    voiceCallBtn.title = "Voice call";
  }
  if (videoCallBtn) {
    videoCallBtn.style.display = "inline-flex";
    videoCallBtn.disabled = false;
    videoCallBtn.title = "Video call";
  }
  document.getElementById("replyPreviewBar").style.display = "none";
  currentReplyTo = null;
  resetMessageRenderLimit();
  loadMessages();
  restoreCurrentDraft();
  listenForTypingIndicator();
  loadPinnedMessages();
  applyCurrentChatWallpaper();
  openMobileChatPanel();
  loadCurrentChatList();
}

// ========================================
// GROUPS HANDLING Logic
// ========================================

async function createGroup(groupName, memberEmails = "") {
  if (!groupName.trim()) return;
  const description =
    document.getElementById("newGroupDescription")?.value?.trim() || "";
  const adminsOnlySend = !!document.getElementById("newGroupAdminsOnlySend")
    ?.checked;
  const groupCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  const invitedUsers = [];
  if (memberEmails.trim()) {
    const entries = memberEmails
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (const entry of entries) {
      const matchedUser = findUserByMemberInput(entry);
      if (
        matchedUser &&
        !invitedUsers.some((user) => user.id === matchedUser.id) &&
        !isBlocked(matchedUser.id)
      ) {
        invitedUsers.push(matchedUser);
      }
    }
  }
  const groupRef = await db.collection("groups").add({
    name: groupName.trim(),
    description,
    code: groupCode,
    createdBy: currentUser.uid,
    ownerId: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    memberCount: 1,
    onlyAdminsCanSend: adminsOnlySend,
    onlyAdminsCanEdit: true,
  });
  await db.collection("groupMembers").add({
    groupId: groupRef.id,
    userId: currentUser.uid,
    role: "admin",
    joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  for (const user of invitedUsers) {
    await sendGroupInvite(groupRef.id, groupName.trim(), user);
  }
  showToast(`Group "${groupName}" created!`);
  loadGroupsList();
  return groupRef.id;
}

async function sendGroupInvite(groupId, groupName, user) {
  if (!currentUser || !groupId || !user?.id) return;
  const memberExists = await db
    .collection("groupMembers")
    .where("groupId", "==", groupId)
    .where("userId", "==", user.id)
    .limit(1)
    .get();
  if (!memberExists.empty) return;

  await db.collection("groupInvites").add({
    groupId,
    groupName,
    fromUserId: currentUser.uid,
    fromUserName: currentUser.displayName || currentUser.email.split("@")[0],
    toUserId: user.id,
    toUserName: user.displayName || user.email,
    status: "pending",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function loadGroupChat(groupId, groupName, listItem = {}) {
  saveCurrentDraft();
  const groupDoc = await db
    .collection("groups")
    .doc(groupId)
    .get()
    .catch((error) => {
      console.warn("Group metadata read skipped:", error);
      return null;
    });
  currentChat = { id: groupId, name: groupName, type: "group" };
  currentChatType = "group";
  setActiveDraftKey();
  const groupData = groupDoc?.data?.() || listItem || {};
  const resolvedGroupName = groupData.name || groupName || "Group";
  currentGroup = {
    id: groupId,
    name: resolvedGroupName,
    icon: groupData.icon,
    ...groupData,
  };
  document.getElementById("currentChatName").textContent = resolvedGroupName;
  document.getElementById("chatStatus").textContent = "Group Chat";
  setChatHeaderAvatar(groupData.icon ? `<img src="${groupData.icon}">` : "G");
  await loadGroupMembers(groupId).catch((error) => {
    console.warn("Group members load skipped:", error);
    currentGroupMembers = [
      {
        id: currentUser.uid,
        name: currentUser.displayName || currentUser.email,
        role: listItem.role || "member",
      },
    ];
  });
  const inputArea = document.getElementById("inputArea");
  const canSend = !currentGroup.onlyAdminsCanSend || isCurrentUserGroupAdmin();
  if (inputArea) inputArea.style.display = canSend ? "flex" : "none";
  document.getElementById("groupInfoBtn").style.display = "block";
  const voiceCallBtn = document.getElementById("voiceCallBtn");
  const videoCallBtn = document.getElementById("videoCallBtn");
  if (voiceCallBtn) {
    voiceCallBtn.style.display = "inline-flex";
    voiceCallBtn.disabled = false;
    voiceCallBtn.title = "Start group voice call";
  }
  if (videoCallBtn) {
    videoCallBtn.style.display = "inline-flex";
    videoCallBtn.disabled = false;
    videoCallBtn.title = "Start group video call";
  }
  resetMessageRenderLimit();
  updateEncryptionBadge(groupId, "group");
  loadMessages();
  restoreCurrentDraft();
  listenForTypingIndicator();
  loadPinnedMessages();
  applyCurrentChatWallpaper();
  openMobileChatPanel();
  loadCurrentChatList();
}

async function loadGroupMembers(groupId) {
  const membersSnapshot = await db
    .collection("groupMembers")
    .where("groupId", "==", groupId)
    .get();
  currentGroupMembers = [];
  for (const doc of membersSnapshot.docs) {
    const userDoc = await db.collection("users").doc(doc.data().userId).get();
    if (
      userDoc.exists &&
      !isBlocked(userDoc.id) &&
      userDoc.data().isActive !== false
    ) {
      currentGroupMembers.push({
        id: userDoc.id,
        name: userDoc.data().displayName || userDoc.data().email,
        role: doc.data().role,
        avatar: userDoc.data().avatar,
      });
    }
  }
  return currentGroupMembers;
}

function isCurrentUserGroupAdmin() {
  return currentGroupMembers.some(
    (member) =>
      member.id === currentUser?.uid &&
      ["owner", "admin"].includes(member.role),
  );
}

async function getGroupMemberDocs(groupId, userId = "") {
  let query = db.collection("groupMembers").where("groupId", "==", groupId);
  if (userId) query = query.where("userId", "==", userId);
  const snapshot = await query.get();
  return snapshot.docs;
}

async function countGroupAdmins(groupId) {
  const docs = await getGroupMemberDocs(groupId);
  return docs.filter((doc) => ["owner", "admin"].includes(doc.data()?.role))
    .length;
}

async function showGroupInfo() {
  if (!currentGroup) return;
  const groupDoc = await db.collection("groups").doc(currentGroup.id).get();
  const group = groupDoc.data();
  await loadGroupMembers(currentGroup.id);
  const inviteLinkBtn = document.getElementById("shareInviteLinkBtn");
  if (inviteLinkBtn) {
    inviteLinkBtn.onclick = async () => {
      const link = await generateInviteLink(currentGroup.id);
      if (link) {
        await navigator.clipboard.writeText(link);
        showToast("Invite link copied to clipboard!");
      } else {
        showToast("Failed to generate invite link", "error");
      }
    };
  }
  document.getElementById("groupInfoTitle").textContent = group.name;
  document.getElementById("groupAvatarLarge").innerHTML = group.icon
    ? `<img src="${group.icon}">`
    : escapeHtml(getInitials(group.name || "Group"));
  document.getElementById("editGroupNameInput").value = group.name;
  document.getElementById("groupCodeDisplay").textContent = group.code;
  document.getElementById("groupAdminsOnlySend").checked =
    !!group.onlyAdminsCanSend;
  document.getElementById("groupAdminsOnlyEdit").checked =
    group.onlyAdminsCanEdit !== false;

  const currentUserRole = currentGroupMembers.find(
    (m) => m.id === currentUser.uid,
  )?.role;
  const isAdmin = ["owner", "admin"].includes(currentUserRole);
  const adminCount = currentGroupMembers.filter((member) =>
    ["owner", "admin"].includes(member.role),
  ).length;
  const canEditInfo = isAdmin || group.onlyAdminsCanEdit === false;
  document.getElementById("editGroupNameInput").disabled = !canEditInfo;
  document.getElementById("groupAvatarLarge").style.pointerEvents = canEditInfo
    ? "auto"
    : "none";
  document.getElementById("groupSendPermissionRow").style.display = isAdmin
    ? "flex"
    : "none";
  document.getElementById("groupEditPermissionRow").style.display = isAdmin
    ? "flex"
    : "none";
  document.getElementById("addMemberBtn").style.display = isAdmin
    ? "block"
    : "none";
  document.getElementById("addMemberEmail").style.display = isAdmin
    ? "inline-block"
    : "none";
  document.getElementById("deleteGroupBtn").style.display = isAdmin
    ? "block"
    : "none";

  const descInput = document.getElementById("editGroupDescriptionInput");
  if (descInput) {
    descInput.value = group.description || "";
    descInput.disabled = !canEditInfo;
    descInput.onchange = async () => {
      if (
        !currentGroup ||
        (!isCurrentUserGroupAdmin() &&
          currentGroup?.onlyAdminsCanEdit !== false)
      )
        return;
      await db
        .collection("groups")
        .doc(currentGroup.id)
        .update({ description: descInput.value.trim() });
      currentGroup.description = descInput.value.trim();
      showToast("Group description updated");
    };
  }

  const disappearSelect = document.getElementById(
    "groupInfoDisappearingSelect",
  );
  if (disappearSelect) {
    disappearSelect.value = String(group.disappearAfterSecs || 0);
    disappearSelect.disabled = !isAdmin;
  }

  const encToggle = document.getElementById("groupEncryptionToggle");
  if (encToggle) {
    encToggle.checked = group.encryptionEnabled === true;
    encToggle.disabled = !isAdmin;
  }

  const slowModeRow = document.getElementById("groupSlowModeRow");
  const slowModeSelect = document.getElementById("groupSlowModeSelect");
  if (slowModeRow) slowModeRow.style.display = isAdmin ? "flex" : "none";
  if (slowModeSelect) {
    slowModeSelect.value = String(group.slowModeInterval || 0);
    slowModeSelect.onchange = () =>
      setSlowMode(currentGroup.id, parseInt(slowModeSelect.value) || 0);
  }

  const welcomeRow = document.getElementById("groupWelcomeMessageRow");
  const welcomeInput = document.getElementById("welcomeMessageInput");
  const saveWelcomeBtn = document.getElementById("saveWelcomeMessageBtn");
  if (welcomeRow) welcomeRow.style.display = isAdmin ? "flex" : "none";
  if (welcomeInput) welcomeInput.value = group.welcomeMessage || "";
  if (saveWelcomeBtn) {
    saveWelcomeBtn.onclick = () => {
      if (welcomeInput) setWelcomeMessage(currentGroup.id, welcomeInput.value);
    };
  }

  const joinQuestionsRow = document.getElementById("groupJoinQuestionsRow");
  if (joinQuestionsRow) {
    joinQuestionsRow.style.display = isAdmin ? "flex" : "none";
    const manageBtn = document.getElementById("manageJoinQuestionsBtn");
    if (manageBtn) manageBtn.onclick = showJoinQuestionsEditorModal;
  }

  const moderationRow = document.getElementById("groupModerationRow");
  if (moderationRow) {
    moderationRow.style.display = isAdmin ? "flex" : "none";
    const modBtn = document.getElementById("groupModerationBtn");
    if (modBtn) modBtn.onclick = showModerationSettingsModal;
  }

  const membersList = document.getElementById("groupMembersList");
  membersList.innerHTML = "";
  for (const member of currentGroupMembers) {
    const isMemberAdmin = ["owner", "admin"].includes(member.role);
    const isCurrentUser = member.id === currentUser.uid;
    const canModifyOther = isAdmin && !isCurrentUser;
    const canDemoteSelf =
      isAdmin && isCurrentUser && isMemberAdmin && adminCount > 1;
    const canModify = canModifyOther || canDemoteSelf;
    const memberDiv = document.createElement("div");
    memberDiv.className = "member-item";
    const roleBadge = isMemberAdmin ? "Admin" : "";
    const actions = canModify
      ? `<div class="member-actions">${!isMemberAdmin ? `<button class="make-admin-btn" data-id="${member.id}" data-name="${escapeHtml(member.name)}" title="Make admin">Make admin</button>` : `<button class="remove-admin-btn" data-id="${member.id}" data-name="${escapeHtml(member.name)}" title="Remove admin">Remove admin</button>`}${canModifyOther ? `<button class="remove-member-btn" data-id="${member.id}" data-name="${escapeHtml(member.name)}" title="Remove member">Remove</button>` : ""}</div>`
      : "";
    memberDiv.innerHTML = `<div class="member-info"><div class="member-avatar">${member.avatar ? `<img src="${member.avatar}" style="width:36px;height:36px;border-radius:50%;">` : member.name?.[0]?.toUpperCase() || "U"}</div><div><span>${escapeHtml(member.name)}</span>${roleBadge ? `<span class="member-role-badge">${roleBadge}</span>` : ""}</div></div>${actions}`;
    membersList.appendChild(memberDiv);
  }
  await renderPendingGroupInvites(currentGroup.id, membersList, isAdmin);
  document.getElementById("groupInfoModal").style.display = "flex";
  document.querySelectorAll(".group-shared-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.groupSharedTab === "media");
  });
  await renderSharedContent("media", "groupSharedContent");
}

async function makeAdmin(groupId, memberId, memberName) {
  if (!isCurrentUserGroupAdmin()) return;
  if (!confirm(`Make ${memberName} an admin?`)) return;
  const memberDoc = await db
    .collection("groupMembers")
    .where("groupId", "==", groupId)
    .where("userId", "==", memberId)
    .get();
  await Promise.all(
    memberDoc.docs.map((doc) => doc.ref.update({ role: "admin" })),
  );
  showToast(`${memberName} is now admin`);
  await loadGroupMembers(groupId);
  showGroupInfo();
}

async function removeAdmin(groupId, memberId, memberName) {
  if (!isCurrentUserGroupAdmin()) return;
  if (!confirm(`Remove admin rights from ${memberName}?`)) return;
  if ((await countGroupAdmins(groupId)) <= 1) {
    showToast("A group must keep at least one admin", "error");
    return;
  }
  const memberDoc = await db
    .collection("groupMembers")
    .where("groupId", "==", groupId)
    .where("userId", "==", memberId)
    .get();
  await Promise.all(
    memberDoc.docs.map((doc) => doc.ref.update({ role: "member" })),
  );
  showToast(`${memberName} is now a member`);
  await loadGroupMembers(groupId);
  showGroupInfo();
}

async function removeMember(groupId, memberId, memberName) {
  if (!isCurrentUserGroupAdmin()) return;
  if (!confirm(`Remove ${memberName} from group?`)) return;
  const memberDocs = await db
    .collection("groupMembers")
    .where("groupId", "==", groupId)
    .where("userId", "==", memberId)
    .get();
  const memberRole = memberDocs.docs[0]?.data()?.role;
  if (
    ["owner", "admin"].includes(memberRole) &&
    (await countGroupAdmins(groupId)) <= 1
  ) {
    showToast("Make another member admin before removing this admin", "error");
    return;
  }
  memberDocs.forEach((d) => d.ref.delete());
  await db
    .collection("groups")
    .doc(groupId)
    .update({ memberCount: firebase.firestore.FieldValue.increment(-1) });
  showToast("Member removed");
  await loadGroupMembers(groupId);
  showGroupInfo();
  loadGroupsList();
}

async function addMemberToGroup(email) {
  if (!isCurrentUserGroupAdmin()) return;
  if (!email.trim()) return;
  const matchedUser = findUserByMemberInput(email);
  if (!matchedUser) {
    showToast("User not found", "error");
    return;
  }
  await sendGroupInvite(currentGroup.id, currentGroup.name, matchedUser);
  showToast("Group invite sent");
}

async function updateGroupName(newName) {
  if (
    !newName.trim() ||
    (!isCurrentUserGroupAdmin() && currentGroup?.onlyAdminsCanEdit !== false)
  )
    return;
  await db
    .collection("groups")
    .doc(currentGroup.id)
    .update({ name: newName.trim() });
  if (currentChat?.id === currentGroup.id)
    document.getElementById("currentChatName").textContent = newName;
  loadGroupsList();
}

async function updateGroupIcon(file) {
  if (!isCurrentUserGroupAdmin() && currentGroup?.onlyAdminsCanEdit !== false)
    return;
  if (!validateAvatarImageFile(file, "Group photo")) return;
  const url = await uploadToCloudinary(file);
  await db.collection("groups").doc(currentGroup.id).update({ icon: url });
  if (currentChat?.id === currentGroup.id) currentGroup.icon = url;
  loadGroupsList();
  showGroupInfo();
}

async function leaveGroup() {
  if (!confirm(`Leave group "${currentGroup.name}"?`)) return;
  if (
    isCurrentUserGroupAdmin() &&
    (await countGroupAdmins(currentGroup.id)) <= 1
  ) {
    showToast("Make another member admin before leaving", "error");
    return;
  }
  await db
    .collection("groupMembers")
    .where("groupId", "==", currentGroup.id)
    .where("userId", "==", currentUser.uid)
    .get()
    .then((s) => s.forEach((d) => d.ref.delete()));
  await db
    .collection("groups")
    .doc(currentGroup.id)
    .update({ memberCount: firebase.firestore.FieldValue.increment(-1) });
  resetChatPanel();
  loadGroupsList();
}

async function deleteGroup() {
  if (!isCurrentUserGroupAdmin()) {
    showToast("Only a group admin can delete this group", "error");
    return;
  }
  if (!confirm("Permanently delete group for everyone?")) return;
  const groupId = currentGroup.id;
  const [memberDocs, inviteDocs] = await Promise.all([
    db.collection("groupMembers").where("groupId", "==", groupId).get(),
    db.collection("groupInvites").where("groupId", "==", groupId).get(),
  ]);
  const batch = db.batch();
  memberDocs.forEach((doc) => batch.delete(doc.ref));
  inviteDocs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(db.collection("groups").doc(groupId));
  await batch.commit();
  resetChatPanel();
  loadGroupsList();
}

async function joinGroup(groupCode) {
  if (!groupCode.trim()) return;
  const q = await db
    .collection("groups")
    .where("code", "==", groupCode.trim().toUpperCase())
    .limit(1)
    .get();
  if (q.empty) {
    showToast("Group not found", "error");
    return;
  }
  const group = q.docs[0];
  const existing = await db
    .collection("groupMembers")
    .where("groupId", "==", group.id)
    .where("userId", "==", currentUser.uid)
    .limit(1)
    .get();
  if (!existing.empty) {
    showToast("You are already in this group");
    loadGroupChat(group.id, group.data().name || "Group");
    return;
  }
  const groupData = group.data();
  if (groupData.joinQuestions && groupData.joinQuestions.length) {
    await showJoinQuestionsModal(group.id);
    return;
  }
  await joinGroupFinalize(group.id);
}

async function joinGroupFinalize(groupId) {
  await db
    .collection("groupMembers")
    .add({
      groupId,
      userId: currentUser.uid,
      role: "member",
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  await db
    .collection("groups")
    .doc(groupId)
    .update({ memberCount: firebase.firestore.FieldValue.increment(1) });
  await sendWelcomeMessage(groupId, currentUser.uid);
  showToast(`Joined Group!`);
  loadGroupsList();
}

// ========================================
// STATUS STORIES FLOWS
// ========================================

async function loadStatusList() {
  const statusList = document.getElementById("statusList");
  if (!statusList || !currentUser) return;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let statuses = [];
  try {
    const snapshot = await db
      .collection("statuses")
      .where("expiresAt", ">", new Date())
      .get();
    statuses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    statuses = [];
  }

  if (!statuses.length) {
    statusList.innerHTML = '<div class="empty-state">No stories shared</div>';
    return;
  }
  const byUser = new Map();
  statuses.forEach((s) => {
    if (!byUser.has(s.userId)) byUser.set(s.userId, []);
    byUser.get(s.userId).push(s);
  });
  statusList.innerHTML = "";
  for (const userStatuses of byUser.values()) {
    const latest = userStatuses[0];
    const item = document.createElement("div");
    item.className = "list-item";
    const viewedAll = userStatuses.every(
      (st) => st.viewedBy?.[currentUser.uid] || st.userId === currentUser.uid,
    );
    item.innerHTML = `
      <div class="list-avatar ${viewedAll ? "offline" : "online"}">${latest.userAvatar ? `<img src="${latest.userAvatar}">` : escapeHtml(latest.userName[0])}</div>
      <div class="list-info">
        <div class="list-name">${latest.userId === currentUser.uid ? "My status" : escapeHtml(latest.userName)}</div>
        <div class="list-preview">${formatTime(latest.createdAt)}</div>
      </div>
    `;
    item.addEventListener("click", () => showStatusViewer(userStatuses, 0));
    statusList.appendChild(item);
  }
}

async function publishStatus() {
  const text = document.getElementById("statusTextInput")?.value.trim() || "";
  if (!text && !statusImageAttachment) return;
  await db.collection("statuses").add({
    userId: currentUser.uid,
    userName: currentUser.displayName || currentUser.email,
    userAvatar: currentUser.photoURL || "",
    text,
    image: statusImageAttachment,
    viewedBy: { [currentUser.uid]: new Date() },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  statusImageAttachment = null;
  document.getElementById("statusTextInput").value = "";
  document.getElementById("statusImagePreview").style.display = "none";
  document.getElementById("statusImagePreview").innerHTML = "";
  document.getElementById("createStatusModal").style.display = "none";
  loadStatusList();
}

function clampStatusIndex(index) {
  if (!activeStatusSet.length) return 0;
  return Math.max(0, Math.min(index, activeStatusSet.length - 1));
}

async function renderStatusViewerFrame() {
  const status = activeStatusSet[activeStatusIndex];
  if (!status) return;
  clearTimeout(statusAutoAdvanceTimer);
  const modal = document.getElementById("statusViewerModal");
  document.getElementById("statusViewerName").textContent = status.userName;
  document.getElementById("statusViewerTime").textContent = formatTime(
    status.createdAt,
  );
  document.getElementById("statusViewerAvatar").innerHTML = status.userAvatar
    ? `<img src="${status.userAvatar}">`
    : escapeHtml((status.userName || "?")[0]);
  document.getElementById("statusViewerBody").innerHTML = status.image
    ? `<img src="${status.image.url}">`
    : `<div class="status-viewer-text">${escapeHtml(status.text)}</div>`;
  document.getElementById("statusViewerSeen").textContent =
    status.userId === currentUser.uid
      ? `${Object.keys(status.viewedBy || {}).length} viewed`
      : "";
  const prevBtn = document.getElementById("statusPrevBtn");
  const nextBtn = document.getElementById("statusNextBtn");
  if (prevBtn) prevBtn.disabled = activeStatusIndex <= 0;
  if (nextBtn)
    nextBtn.disabled = activeStatusIndex >= activeStatusSet.length - 1;
  modal.style.display = "flex";
  const nextDelay = status.image ? 8000 : 5000;
  if (activeStatusIndex < activeStatusSet.length - 1) {
    statusAutoAdvanceTimer = setTimeout(() => {
      moveStatusViewer(1).catch(() => {});
    }, nextDelay);
  } else {
    statusAutoAdvanceTimer = null;
  }
  if (status.userId !== currentUser.uid) {
    await db
      .collection("statuses")
      .doc(status.id)
      .update({
        [`viewedBy.${currentUser.uid}`]:
          firebase.firestore.FieldValue.serverTimestamp(),
      });
  }
}

async function showStatusViewer(statuses, index = 0) {
  activeStatusSet = Array.isArray(statuses) ? statuses : [];
  activeStatusIndex = clampStatusIndex(index);
  await renderStatusViewerFrame();
}

async function moveStatusViewer(step = 1) {
  if (!activeStatusSet.length) return;
  const nextIndex = clampStatusIndex(activeStatusIndex + step);
  if (nextIndex === activeStatusIndex) return;
  activeStatusIndex = nextIndex;
  await renderStatusViewerFrame();
}

function closeStatusViewer() {
  clearTimeout(statusAutoAdvanceTimer);
  statusAutoAdvanceTimer = null;
  document.getElementById("statusViewerModal").style.display = "none";
  activeStatusSet = [];
  activeStatusIndex = 0;
}

async function renderPendingGroupInvites(groupId, membersList, isAdmin) {
  const pendingSnapshot = await db
    .collection("groupInvites")
    .where("groupId", "==", groupId)
    .where("status", "==", "pending")
    .get();
  if (pendingSnapshot.empty) return;
  pendingSnapshot.docs.forEach((inviteDoc) => {
    const invite = inviteDoc.data();
    const div = document.createElement("div");
    div.className = "member-item pending";
    div.innerHTML = `<span>${escapeHtml(invite.toUserName)} (Pending)</span>${isAdmin ? `<button class="btn btn-outline cancel-pending-invite-btn" data-id="${inviteDoc.id}">Cancel</button>` : ""}`;
    membersList.appendChild(div);
  });
  if (isAdmin) {
    membersList
      .querySelectorAll(".cancel-pending-invite-btn")
      .forEach((btn) => {
        btn.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!confirm("Cancel this pending invite?")) return;
          await db.collection("groupInvites").doc(btn.dataset.id).update({
            status: "cancelled",
            cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          showToast("Pending invite cancelled");
          showGroupInfo();
        });
      });
  }
}

// ========================================
// REACTION & CHAT INFO VIEW
// ========================================

async function showChatInfo() {
  if (!currentChat) return;
  if (currentChatType === "group") {
    await showGroupInfo();
    return;
  }
  const modal = document.getElementById("chatInfoModal");
  const userDoc = await db
    .collection("users")
    .doc(currentChat.otherUserId)
    .get();
  const user = userDoc.exists ? userDoc.data() : {};
  document.getElementById("chatInfoName").textContent =
    user.displayName || currentChat.otherUserName;
  document.getElementById("chatInfoPresence").textContent =
    getPresenceText(user);
  const chatSettingsDoc = await db
    .collection("directChats")
    .doc(currentChat.id)
    .get()
    .catch(() => null);
  currentChat.disappearAfterSecs =
    chatSettingsDoc?.data()?.disappearAfterSecs || 0;
  const disappearSelect = document.getElementById("chatInfoDisappearingSelect");
  if (disappearSelect) {
    disappearSelect.value = String(
      chatSettingsDoc?.data()?.disappearAfterSecs || 0,
    );
  }
  const screenWarnToggle = document.getElementById("screenshotWarningToggle");
  if (screenWarnToggle) {
    screenWarnToggle.checked =
      chatSettingsDoc?.data()?.screenshotWarningEnabled === true;
  }
  modal.style.display = "flex";
  await renderSharedContent("media");
}

async function renderSharedContent(type, containerId = "sharedContent") {
  const container = document.getElementById(containerId);
  if (!container || !currentChat) return;
  container.innerHTML = '<div class="shared-empty">Loading items...</div>';
  let messages = await getCurrentSharedMessages();
  if (type === "media") {
    const media = messages.filter(
      (m) => ["image", "gif"].includes(m.attachment?.type) && m.attachment?.url,
    );
    container.innerHTML = media.length
      ? `<div class="shared-grid">${media.map((m) => renderSharedMediaItem(m)).join("")}</div>`
      : '<div class="shared-empty">No media shared</div>';
    bindSharedContentActions(container);
  } else if (type === "links") {
    const links = messages.flatMap((m) => extractLinks(m.text || ""));
    if (links.length) {
      container.innerHTML = links
        .map(
          (link) => `
        <div class="shared-link-row">
          <a class="shared-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a>
          <div class="shared-link-actions">
            <button class="shared-link-btn" data-copy-link="${escapeHtml(link)}" title="Copy">Copy</button>
            <button class="shared-link-btn shared-link-share" data-share-link="${escapeHtml(link)}" title="Share">↪ Share</button>
          </div>
        </div>`,
        )
        .join("");
      bindSharedContentActions(container);
    } else {
      container.innerHTML =
        '<div class="shared-empty">No shared links found</div>';
    }
  } else if (type === "voice") {
    const voice = messages.filter((m) => m.attachment?.type === "voice");
    if (voice.length) {
      container.innerHTML = voice
        .map((m) => {
          const attJson = escapeHtml(JSON.stringify(m.attachment || {}));
          return `<div class="shared-voice-row">${renderAttachment(m.attachment)}<button class="shared-item-share-btn" data-share-attachment="${attJson}" title="Share">↪ Share</button></div>`;
        })
        .join("");
      bindRenderedMessageActions();
      bindSharedContentActions(container);
    } else {
      container.innerHTML =
        '<div class="shared-empty">No voice notes found</div>';
    }
  } else if (type === "files") {
    const files = messages.filter((m) => {
      const attachment = m.attachment;
      if (!attachment?.url) return false;
      if (attachment.type === "image" || attachment.type === "voice")
        return false;
      return true;
    });
    container.innerHTML = files.length
      ? files.map((m) => renderAttachment(m.attachment)).join("")
      : '<div class="shared-empty">No shared files found</div>';
    bindRenderedMessageActions();
  } else {
    const docs = messages.filter((m) => m.attachment?.type === "document");
    container.innerHTML = docs.length
      ? docs.map((m) => renderSharedDocumentItem(m)).join("")
      : '<div class="shared-empty">No shared documents found</div>';
    bindSharedContentActions(container);
  }
}

function renderSharedMediaItem(message = {}) {
  const attachment = message.attachment || {};
  const url = escapeHtml(attachment.url || "");
  const filename = escapeHtml(
    attachment.filename ||
      getFileNameFromUrl(attachment.url) ||
      getAttachmentLabel(attachment),
  );
  const when = message.timestamp ? formatTime(message.timestamp) : "";
  const attJson = escapeHtml(JSON.stringify(attachment));
  return `
    <div class="shared-media-item-wrap">
      <button type="button" class="shared-media-item" data-preview-url="${url}" data-filename="${filename}" title="${filename}">
        <img src="${url}" alt="${filename}" loading="lazy" onerror="this.closest('.shared-media-item')?.classList.add('is-broken'); this.remove();">
        <span class="shared-media-fallback">${escapeHtml(getAttachmentLabel(attachment))}</span>
        <span class="shared-media-meta">${escapeHtml(when)}</span>
      </button>
      <button type="button" class="shared-media-share-btn" title="Share" data-share-attachment="${attJson}">↪</button>
    </div>
  `;
}

function renderSharedDocumentItem(message = {}) {
  const attachment = message.attachment || {};
  const url = escapeHtml(attachment.url || "");
  const filename = escapeHtml(
    attachment.filename || getFileNameFromUrl(attachment.url) || "Document",
  );
  const detail = [getAttachmentLabel(attachment), formatBytes(attachment.size)]
    .filter(Boolean)
    .join(" · ");
  const attJson = escapeHtml(JSON.stringify(attachment));
  return `
    <div class="shared-list-item-wrap">
      <button type="button" class="shared-list-item shared-open-item" data-preview-url="${url}" data-filename="${filename}">
        <span>${filename}</span>
        <small>${escapeHtml(detail || "Document")}</small>
      </button>
      <button type="button" class="shared-item-share-btn" title="Share" data-share-attachment="${attJson}">↪ Share</button>
    </div>
  `;
}

function bindSharedContentActions(root = document) {
  // Preview on tap
  root.querySelectorAll("[data-preview-url]").forEach((el) => {
    if (el.dataset.sharedPreviewBound === "true") return;
    el.dataset.sharedPreviewBound = "true";
    el.addEventListener("click", (event) => {
      event.preventDefault();
      const url = el.dataset.previewUrl;
      if (!url) {
        showToast("Media is not available", "error");
        return;
      }
      previewFile(url, el.dataset.filename || "Shared item");
    });
  });

  // Share button on media/doc items
  root.querySelectorAll("[data-share-attachment]").forEach((btn) => {
    if (btn.dataset.shareBound === "true") return;
    btn.dataset.shareBound = "true";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        const att = JSON.parse(btn.dataset.shareAttachment || "{}");
        openForwardModalForMedia(att);
      } catch (_) {
        showToast("Could not share this item", "error");
      }
    });
  });

  // Share button on link items
  root.querySelectorAll("[data-share-link]").forEach((btn) => {
    if (btn.dataset.shareBound === "true") return;
    btn.dataset.shareBound = "true";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openForwardModalForLink(btn.dataset.shareLink);
    });
  });

  // Copy button on link items
  root.querySelectorAll("[data-copy-link]").forEach((btn) => {
    if (btn.dataset.copyBound === "true") return;
    btn.dataset.copyBound = "true";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyToClipboard(btn.dataset.copyLink);
    });
  });
}

if (isChatDebugEnabled()) {
  window.chatDebug = chatDebug;
}

// ========================================
// REAL-TIME MESSAGES SUBSCRIBERS LISTENER
// ========================================

function getCurrentChatFailedKey() {
  if (!currentUser || !currentChat || !currentChatType) return "";
  return `teamChatFailedMessages:${currentUser.uid}:${currentChatType}:${currentChat.id}`;
}

function getLocalFailedMessages() {
  const key = getCurrentChatFailedKey();
  if (!key) return [];
  try {
    const items = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(items) ? items : [];
  } catch (error) {
    return [];
  }
}

function saveLocalFailedMessages(items = []) {
  const key = getCurrentChatFailedKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(items.slice(-40)));
}

function addLocalFailedMessage(text = "", attachment = null, extra = {}) {
  const failed = {
    localId: `failed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: text || "",
    attachment: attachment || null,
    createdAt: new Date().toISOString(),
    ...extra,
  };
  const items = getLocalFailedMessages();
  items.push(failed);
  saveLocalFailedMessages(items);
  return failed;
}

function removeLocalFailedMessage(localId) {
  if (!localId) return;
  const items = getLocalFailedMessages().filter(
    (item) => item.localId !== localId,
  );
  saveLocalFailedMessages(items);
}

function getReceiptTargetIds(msg = {}) {
  if (!currentUser) return [];

  const ids = new Set();
  const addId = (uid) => {
    if (uid && typeof uid === "string" && uid !== currentUser.uid) ids.add(uid);
  };
  const addIdsFromDirectId = (directId = "") => {
    String(directId || "")
      .split("_")
      .filter(Boolean)
      .forEach(addId);
  };

  if (Array.isArray(msg.participants)) msg.participants.forEach(addId);
  if (msg.receiverId) addId(msg.receiverId);
  if (msg.toUserId) addId(msg.toUserId);

  if (currentChatType === "direct") {
    addId(currentChat?.otherUserId);
    addIdsFromDirectId(currentChat?.id);
    (currentChat?.aliasDirectIds || []).forEach(addIdsFromDirectId);
    addIdsFromDirectId(msg.directId);
    return [...ids];
  }

  if (Array.isArray(currentGroupMembers) && currentGroupMembers.length) {
    currentGroupMembers.forEach((member) => addId(member.id));
  }

  return [...ids];
}

function receiptMapHasTarget(map = {}, targetIds = []) {
  if (!map || typeof map !== "object") return false;
  if (targetIds.length) return targetIds.some((uid) => Boolean(map?.[uid]));
  return hasReceiptFromOtherUser(map);
}

async function markMessagesAsDelivered(markAsRead = false) {
  if (!currentChat || !currentUser) return;

  const deliveredFieldKey = `deliveredTo.${currentUser.uid}`;
  const readFieldKey = `readBy.${currentUser.uid}`;
  const directIds = getDirectChatIdsForCurrentChat();

  let query;
  if (currentChatType === "direct" && directIds.length > 1) {
    query = db.collection("messages").where("directId", "in", directIds);
  } else {
    query = db
      .collection("messages")
      .where(
        currentChatType === "direct" ? "directId" : "groupId",
        "==",
        currentChat.id,
      );
  }

  try {
    const snapshot = await query.get();
    const batch = db.batch();
    let updatesMade = false;

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      if (!data.senderId || data.senderId === currentUser.uid) return;
      if (data.deletedFor?.[currentUser.uid]) return;
      if (data.deletedForEveryone) return;

      const updates = {};
      if (!data.deliveredTo?.[currentUser.uid]) {
        updates[deliveredFieldKey] =
          firebase.firestore.FieldValue.serverTimestamp();
      }

      if (
        markAsRead &&
        !privacySettings.hideReadReceipts &&
        !data.readBy?.[currentUser.uid]
      ) {
        updates[readFieldKey] = firebase.firestore.FieldValue.serverTimestamp();
      }

      if (markAsRead && !privacySettings.hideReadReceipts) {
        updates.read = true;
        updates.status = "read";
      } else if (!data.status || data.status === "sent") {
        updates.status = "delivered";
      }

      if (Object.keys(updates).length) {
        batch.update(doc.ref, updates);
        updatesMade = true;
      }
    });

    if (updatesMade) await batch.commit();
  } catch (error) {
    console.warn("Could not update message receipt state:", error);
  }
}

async function markMessagesAsRead() {
  if (currentChat && currentChatType) {
    const key = `${currentChatType}_${currentChat.id}`;
    lastReadTimestamps.set(key, Date.now());
  }
  return markMessagesAsDelivered(true);
}

function checkAndShowJumpToUnread() {
  const btn = document.getElementById("jumpToUnreadBtn");
  if (!btn || !currentChat || !currentUser) {
    if (btn) btn.style.display = "none";
    return;
  }
  const msgs = document.querySelectorAll("#messagesArea .message");
  let hasOtherMessages = false;
  for (const msg of msgs) {
    if (!msg.classList.contains("my-message")) {
      hasOtherMessages = true;
      break;
    }
  }
  const atBottom =
    document.getElementById("messagesArea")?.scrollTop +
      document.getElementById("messagesArea")?.clientHeight >=
    document.getElementById("messagesArea")?.scrollHeight - 60;
  btn.style.display = hasOtherMessages && !atBottom ? "flex" : "none";
}

function hasReceiptFromOtherUser(map = {}) {
  if (!currentUser || !map || typeof map !== "object") return false;
  return Object.keys(map).some((uid) => uid && uid !== currentUser.uid);
}

function getMessageReceiptHtml(msg, isMyMessage) {
  if (!isMyMessage || currentChat?.isSaved) return "";
  if (msg.failed || msg.status === "failed") {
    return '<span class="message-status failed" title="Message failed to send">⚠ Failed</span>';
  }
  if (
    msg.pending ||
    msg.status === "sending" ||
    msg.status === "pending" ||
    !msg.timestamp
  ) {
    return '<span class="message-status pending" title="Sending">◷</span>';
  }

  const targets = getReceiptTargetIds(msg);
  const readByTarget =
    !privacySettings.hideReadReceipts &&
    receiptMapHasTarget(msg.readBy, targets);
  const deliveredToTarget = receiptMapHasTarget(msg.deliveredTo, targets);

  if (
    readByTarget ||
    (!privacySettings.hideReadReceipts &&
      msg.status === "read" &&
      (targets.length === 0 || msg.read))
  ) {
    return '<span class="read-receipt read" title="Read">✓✓</span>';
  }
  if (deliveredToTarget || msg.status === "delivered") {
    return '<span class="read-receipt delivered" title="Delivered">✓✓</span>';
  }
  return '<span class="read-receipt sent" title="Sent">✓</span>';
}

function renderFailedLocalMessage(item = {}) {
  const localId = escapeHtml(item.localId || "");
  return `
    <div class="message my-message failed local-failed-message" data-local-failed-id="${localId}">
      <div class="message-bubble">
        <div class="message-text">${escapeHtml(item.text || (item.attachment ? "Attachment" : "Message"))}</div>
        ${item.attachment ? renderAttachment(item.attachment) : ""}
        <div class="message-footer">
          <span class="message-time">${formatTime(new Date(item.createdAt || Date.now()))}</span>
          <span class="message-status failed" title="Message failed to send">⚠ Failed</span>
          <button class="retry-message-btn" type="button" data-local-failed-id="${localId}" title="Retry sending this message">Retry</button>
        </div>
        <div class="message-error-text">Message failed to send. Check your connection and tap Retry.</div>
      </div>
    </div>
  `;
}

function appendFailedMessage(text = "", attachment = null) {
  const failed = addLocalFailedMessage(text, attachment, {
    chatId: currentChat?.id || "",
    chatType: currentChatType || "",
    otherUserId: currentChat?.otherUserId || "",
    aliasDirectIds: currentChat?.aliasDirectIds || [],
    replyTo: currentReplyTo || null,
  });
  const messagesArea = document.getElementById("messagesArea");
  if (!messagesArea) return;
  messagesArea.insertAdjacentHTML(
    "beforeend",
    renderFailedLocalMessage(failed),
  );
  bindFailedMessageRetryActions();
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

async function retryFailedMessage(localId) {
  if (!localId || !currentChat || !currentUser) return;
  const failed = getLocalFailedMessages().find(
    (item) => item.localId === localId,
  );
  if (!failed) return;

  const retryButton = document.querySelector(
    `.retry-message-btn[data-local-failed-id="${CSS.escape(localId)}"]`,
  );
  if (retryButton) {
    retryButton.disabled = true;
    retryButton.textContent = "Sending...";
  }

  const directParticipants =
    currentChatType === "direct"
      ? [
          ...new Set(
            [
              currentUser.uid,
              ...String(currentChat?.id || "")
                .split("_")
                .filter(Boolean),
              currentChat?.otherUserId,
            ].filter(Boolean),
          ),
        ]
      : [];

  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text: failed.text || "",
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: "sent",
    read: false,
    readBy: {
      [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
    },
    deliveredTo: {},
    participants:
      currentChatType === "direct" ? directParticipants : [currentUser.uid],
    mentions: getMessageMentions(failed.text || ""),
  };

  if (failed.attachment) messageData.attachment = failed.attachment;
  if (failed.replyTo) messageData.replyTo = failed.replyTo;
  if (currentChatType === "direct") messageData.directId = currentChat.id;
  else messageData.groupId = currentChat.id;

  try {
    await db.collection("messages").add(messageData);
    const previewText =
      failed.text ||
      (failed.attachment ? getAttachmentLabel(failed.attachment) : "Message");
    if (failed.chatType === "direct") {
      await db.collection("directChats").doc(failed.chatId).set(
        {
          participants: directParticipants,
          lastMessage: previewText,
          lastMessageSenderId: currentUser.uid,
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          status: "active",
        },
        { merge: true },
      );
    } else if (failed.chatType === "group") {
      await db
        .collection("groups")
        .doc(failed.chatId)
        .set(
          {
            lastMessage: previewText,
            lastMessageSenderId: currentUser.uid,
            lastMessageSenderName: currentUser.displayName || currentUser.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    }
    removeLocalFailedMessage(localId);
    document
      .querySelector(
        `.local-failed-message[data-local-failed-id="${CSS.escape(localId)}"]`,
      )
      ?.remove();
    showToast("Message sent");
  } catch (error) {
    if (retryButton) {
      retryButton.disabled = false;
      retryButton.textContent = "Retry";
    }
    showToast("Retry failed. Check your connection and try again.", "error");
  }
}

function bindSwipeToReply(messageDiv, messageData) {
  if (!messageDiv || messageDiv.dataset.swipeReplyBound === "true") return;
  messageDiv.dataset.swipeReplyBound = "true";
  let startX = null;
  let startY = null;
  let pointerId = null;
  let gestureLocked = false;
  let moved = false;

  const resetSwipe = () => {
    messageDiv.classList.remove("reply-swipe-active");
    messageDiv.style.removeProperty("--reply-swipe-x");
    startX = null;
    startY = null;
    pointerId = null;
    gestureLocked = false;
    moved = false;
  };

  messageDiv.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest(".message-options-btn")) return;
    startX = event.clientX;
    startY = event.clientY;
    pointerId = event.pointerId;
    gestureLocked = false;
    moved = false;
    messageDiv.setPointerCapture?.(event.pointerId);
  });
  messageDiv.addEventListener("pointermove", (event) => {
    if (startX === null || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    const absDx = Math.abs(dx);
    const dy = Math.abs(event.clientY - startY);
    if (!gestureLocked && absDx > 10 && absDx > dy * 1.25) {
      gestureLocked = true;
    }
    if (gestureLocked) {
      event.preventDefault();
      const pull = Math.min(Math.max(dx, 0), 86);
      messageDiv.style.setProperty("--reply-swipe-x", `${pull}px`);
    }
    moved = dx > 18 && dy < 56;
    messageDiv.classList.toggle("reply-swipe-active", moved);
  });
  messageDiv.addEventListener("pointerup", (event) => {
    if (startX === null || event.pointerId !== pointerId) {
      resetSwipe();
      return;
    }
    const dx = event.clientX - startX;
    const dy = Math.abs(event.clientY - startY);
    if (dx > 52 && dy < 64) {
      messageDiv.classList.add("swiped");
      setTimeout(() => messageDiv.classList.remove("swiped"), 600);
      setReplyTo(messageData);
    }
    resetSwipe();
  });
  messageDiv.addEventListener("pointercancel", resetSwipe);
  messageDiv.addEventListener("lostpointercapture", resetSwipe);
}

function bindLongPressMessageMenu(messageDiv, messageData, isMyMessage) {
  if (!messageDiv || messageDiv.dataset.longPressMenuBound === "true") return;
  messageDiv.dataset.longPressMenuBound = "true";
  let timer = null;
  let startX = 0;
  let startY = 0;

  const clearTimer = () => {
    clearTimeout(timer);
    timer = null;
  };

  messageDiv.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    startX = event.clientX;
    startY = event.clientY;
    clearTimer();
    timer = setTimeout(() => {
      if (messageDiv.classList.contains("reply-swipe-active")) return;
      navigator.vibrate?.(20);
      showContextMenu(
        startX,
        startY,
        messageDiv.dataset.messageId,
        messageData,
        isMyMessage,
      );
      timer = null;
    }, 520);
  });

  messageDiv.addEventListener("pointermove", (event) => {
    if (!timer) return;
    const dx = Math.abs(event.clientX - startX);
    const dy = Math.abs(event.clientY - startY);
    if (dx > 12 || dy > 12) clearTimer();
  });

  messageDiv.addEventListener("pointerup", clearTimer);
  messageDiv.addEventListener("pointercancel", clearTimer);
  messageDiv.addEventListener("pointerleave", clearTimer);
}

function bindFailedMessageRetryActions() {
  document.querySelectorAll(".retry-message-btn").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      retryFailedMessage(button.dataset.localFailedId);
    });
  });
}

function jumpToReplyMessage(targetMessageId) {
  if (!targetMessageId) return;
  const target = document.querySelector(
    `.message[data-message-id="${CSS.escape(targetMessageId)}"]`,
  );
  if (!target) {
    showToast(
      'Original message is older. Tap "Load older messages" to view it.',
    );
    return;
  }
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  target.classList.add("reply-target-highlight");
  setTimeout(() => target.classList.remove("reply-target-highlight"), 1400);
}

function getActiveDisappearingSeconds() {
  if (currentChatType === "group")
    return Number(currentGroup?.disappearAfterSecs || 0);
  if (currentChatType === "direct")
    return Number(currentChat?.disappearAfterSecs || 0);
  return 0;
}

function isExpiredByDisappearingSetting(msg = {}) {
  const seconds = getActiveDisappearingSeconds();
  if (!seconds || seconds < 1 || msg.senderId === currentUser?.uid)
    return false;
  const sentAt =
    msg.timestamp?.toMillis?.() ||
    (msg.timestamp ? new Date(msg.timestamp).getTime() : 0);
  if (!sentAt || Number.isNaN(sentAt)) return false;
  return Date.now() - sentAt > seconds * 1000;
}

function loadMessages() {
  if (!currentChat) return;
  const messagesArea = document.getElementById("messagesArea");
  if (messagesUnsubscribe) messagesUnsubscribe();

  const directIds = getDirectChatIdsForCurrentChat();
  let query =
    currentChatType === "direct" && directIds.length > 1
      ? db.collection("messages").where("directId", "in", directIds)
      : db
          .collection("messages")
          .where(
            currentChatType === "direct" ? "directId" : "groupId",
            "==",
            currentChat.id,
          );

  messagesUnsubscribe = query.onSnapshot(
    (snapshot) => {
      if (!messagesArea) return;
      messagesArea.innerHTML = "";
      if (snapshot.empty) {
        messagesArea.innerHTML =
          '<div class="empty-state">No messages here yet.</div>';
        return;
      }

      const docs = [...snapshot.docs].sort((a, b) => {
        const aTime = a.data().timestamp?.toMillis?.() || 0;
        const bTime = b.data().timestamp?.toMillis?.() || 0;
        return aTime - bTime;
      });

      docs.forEach((doc) => {
        const msg = doc.data();
        if (msg.senderId && msg.senderId !== currentUser?.uid) {
          const textBytes = new Blob([msg.text || ""]).size;
          const attachBytes = msg.attachment?.size || 0;
          if (textBytes + attachBytes > 0)
            trackDataUsage(textBytes + attachBytes, "received");
        }
      });

      // Trigger link preview fetching for new messages with URLs
      docs.forEach((doc) => {
        const msg = doc.data();
        if (!msg.linkPreview && findUrls(msg.text || "").length) {
          tryAttachLinkPreview(doc.id, msg);
        }
      });

      const renderLimit = getMessageRenderLimit();
      const docsToRender =
        docs.length > renderLimit
          ? docs.slice(docs.length - renderLimit)
          : docs;
      if (docs.length > docsToRender.length) {
        const olderButton = document.createElement("button");
        olderButton.type = "button";
        olderButton.className = "btn btn-outline";
        olderButton.style.margin = "8px auto 12px";
        olderButton.textContent = `Load older messages (${docs.length - docsToRender.length} hidden)`;
        olderButton.addEventListener("click", () => {
          increaseMessageRenderLimit();
          loadMessages();
        });
        messagesArea.appendChild(olderButton);
      }

      docsToRender.forEach((doc) => {
        const msg = doc.data();
        if (isExpiredByDisappearingSetting(msg)) return;
        if (msg.deletedFor?.[currentUser.uid] || isBlocked(msg.senderId))
          return;
        const isMyMessage = msg.senderId === currentUser.uid;
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${isMyMessage ? "my-message" : ""}`;
        messageDiv.dataset.messageId = doc.id;

        if (msg.type === "call") {
          messageDiv.className = "message call-message";
          messageDiv.innerHTML = renderCallMessage(msg);
          messagesArea.appendChild(messageDiv);
          return;
        }

        let replyHtml = msg.replyTo
          ? `<button type="button" class="reply-preview jump-reply-btn" data-reply-message-id="${escapeHtml(msg.replyTo.messageId || "")}" title="Jump to original message"><strong>${escapeHtml(msg.replyTo.senderName)}</strong>: ${escapeHtml(msg.replyTo.text || "Media")}</button>`
          : "";
        let linkPreviewHtml = msg.linkPreview
          ? renderLinkPreview(msg.linkPreview)
          : "";
        let stickerHtml =
          msg.type === "animated_sticker" && msg.animatedSticker
            ? `<div class="animated-sticker-message" data-animated-sticker='${escapeHtml(JSON.stringify(msg.animatedSticker))}'></div>`
            : msg.sticker
              ? msg.sticker.url
                ? `<div class="sticker-message"><img src="${escapeHtml(msg.sticker.url)}" alt="Sticker"></div>`
                : `<div class="sticker-message emoji-sticker">${msg.sticker.emoji || ""}</div>`
              : "";
        let attachmentHtml = msg.attachment
          ? renderAttachment(msg.attachment)
          : "";
        let locationHtml =
          msg.type === "location" ? renderLocationMessage(msg) : "";
        let pollHtml = msg.poll ? renderPollMessage(doc.id, msg) : "";
        let contactHtml =
          msg.type === "contact" ? renderContactCard(msg.contact) : "";
        let eventHtml = msg.type === "event" ? renderEventCard(msg.event) : "";
        let listHtml = msg.type === "list" ? renderListCard(msg.list) : "";
        let textContent = msg.deletedForEveryone
          ? "This message was deleted"
          : msg.type === "location"
            ? ""
            : msg.text || "";

        messageDiv.innerHTML = `
        <div class="swipe-reply-indicator"></div>
        <div class="message-bubble">
          <button type="button" class="message-options-btn" title="Message options" aria-label="Message options">⋮</button>
          ${!isMyMessage ? `<div class="message-sender">${escapeHtml(msg.senderName)}</div>` : ""}
          ${replyHtml}
          ${textContent ? `<div class="message-text">${renderMessageText(textContent, msg.mentions || [])}</div>` : ""}
          ${stickerHtml}
          ${linkPreviewHtml}
          ${attachmentHtml}
          ${locationHtml}
          ${pollHtml}
          ${contactHtml}
          ${eventHtml}
          ${listHtml}
          <div class="message-footer">
            <span class="message-time">${msg.timestamp ? formatTime(msg.timestamp) : ""}</span>
            ${msg.editedAt ? '<span class="message-edited">edited</span>' : ""}
            ${getMessageReceiptHtml(msg, isMyMessage)}
          </div>
        </div>
      `;
        messageDiv.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          showContextMenu(e.clientX, e.clientY, doc.id, msg, isMyMessage);
        });
        messageDiv
          .querySelector(".message-options-btn")
          ?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            showContextMenu(
              rect.left,
              rect.bottom + 6,
              doc.id,
              { ...msg, messageId: doc.id },
              isMyMessage,
            );
          });
        messagesArea.appendChild(messageDiv);
        bindSwipeToReply(messageDiv, { ...msg, messageId: doc.id });
        bindLongPressMessageMenu(
          messageDiv,
          { ...msg, messageId: doc.id },
          isMyMessage,
        );
        loadReactions(
          doc.id,
          messageDiv.querySelector(".message-bubble"),
        ).catch(() => {});
      });
      const failedItems = getLocalFailedMessages();
      if (failedItems.length) {
        failedItems.forEach((item) => {
          messagesArea.insertAdjacentHTML(
            "beforeend",
            renderFailedLocalMessage(item),
          );
        });
        bindFailedMessageRetryActions();
      }
      messagesArea.scrollTop = messagesArea.scrollHeight;
      renderSuggestedReplies(messagesArea);
      bindRenderedMessageActions();
      messagesArea.querySelectorAll(".jump-reply-btn").forEach((btn) => {
        if (btn.dataset.bound === "true") return;
        btn.dataset.bound = "true";
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          jumpToReplyMessage(btn.dataset.replyMessageId || "");
        });
      });
      // Animate animated stickers in messages
      messagesArea.querySelectorAll("[data-animated-sticker]").forEach((el) => {
        if (el.dataset.animating === "true") return;
        el.dataset.animating = "true";
        try {
          const sticker = JSON.parse(el.dataset.animatedSticker);
          renderAnimatedSticker(sticker, el);
        } catch (e) {}
      });
      markMessagesAsRead();
      checkAndShowJumpToUnread();
    },
    (err) => {
      console.error("Messages onSnapshot error:", err);
      const message =
        err?.code === "permission-denied"
          ? "You do not have permission to read messages in this chat."
          : "Could not load messages for this chat.";
      if (messagesArea)
        messagesArea.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      showToast(message, "error");
    },
  );
}

// ========================================
// MESSAGE TRANSMISSIONS OPERATIONS
// ========================================

async function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input ? input.value.trim() : "";
  if ((!text && !currentAttachment) || !currentChat) return;
  if (currentChatType === "broadcast") {
    setSendingState(true);
    await sendBroadcastMessage(text);
    setSendingState(false);
    return;
  }
  if (currentChatType === "group") {
    const canSend =
      !currentGroup?.onlyAdminsCanSend || isCurrentUserGroupAdmin();
    if (!canSend) {
      showToast("Only group admins can send messages here", "error");
      return;
    }
    const waitSecs = await checkSlowMode(currentChat.id, currentUser.uid);
    if (waitSecs > 0) {
      showToast(`Slow mode: wait ${waitSecs}s before sending`, "error");
      setSendingState(false);
      return;
    }
  }

  if (text && !(await checkMessageBeforeSend(text))) {
    setSendingState(false);
    return;
  }

  setSendingState(true);

  const directParticipants =
    currentChatType === "direct"
      ? [
          ...new Set(
            [
              currentUser.uid,
              ...String(currentChat?.id || "")
                .split("_")
                .filter(Boolean),
              currentChat?.otherUserId,
            ].filter(Boolean),
          ),
        ]
      : [];

  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: "sent",
    read: false,
    readBy: {
      [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
    },
    deliveredTo: {},
    participants:
      currentChatType === "direct"
        ? directParticipants
        : [
            ...new Set(
              (currentGroupMembers || [])
                .map((member) => member.id)
                .concat(currentUser.uid)
                .filter(Boolean),
            ),
          ],
  };

  if (currentReplyTo) {
    messageData.replyTo = {
      messageId: currentReplyTo.id,
      text: currentReplyTo.text,
      senderName: currentReplyTo.senderName,
    };
  }

  if (currentAttachment) {
    const viewOnceToggle = document.getElementById("viewOnceToggle");
    if (currentAttachment.type === "image" && viewOnceToggle?.checked) {
      currentAttachment.viewOnce = true;
    }
    messageData.attachment = currentAttachment;
  }

  if (currentChatType === "direct") {
    messageData.directId = currentChat.id;
  } else {
    messageData.groupId = currentChat.id;
  }

  try {
    await db.collection("messages").add(messageData);
    const textBytes = new Blob([text || ""]).size;
    const attachBytes = currentAttachment?.size || 0;
    trackDataUsage(textBytes + attachBytes, "sent");

    const previewText =
      text ||
      (currentAttachment ? getAttachmentLabel(currentAttachment) : "Message");

    if (currentChatType === "direct") {
      await db.collection("directChats").doc(currentChat.id).set(
        {
          participants: directParticipants,
          lastMessage: previewText,
          lastMessageSenderId: currentUser.uid,
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          status: "active",
        },
        { merge: true },
      );
    }

    if (currentChatType === "group") {
      await db
        .collection("groups")
        .doc(currentChat.id)
        .set(
          {
            lastMessage: previewText,
            lastMessageSenderId: currentUser.uid,
            lastMessageSenderName: currentUser.displayName || currentUser.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    }

    if (currentChatType === "group" && currentChat) {
      lastMessageTimestamps.set(
        `${currentChat.id}_${currentUser.uid}`,
        Date.now(),
      );
    }

    if (input) input.value = "";
    resizeMessageComposer();
    clearCurrentDraft();
    currentAttachment = null;
    currentReplyTo = null;

    document.getElementById("replyPreviewBar").style.display = "none";
    const viewOnceToggle = document.getElementById("viewOnceToggle");
    if (viewOnceToggle) viewOnceToggle.checked = false;
    setAttachmentPreview();

    // Auto confetti for celebratory messages
    if (
      text &&
      (text.includes("🎉") ||
        text.toLowerCase().includes("congratulations") ||
        text.toLowerCase().includes("happy"))
    ) {
      setTimeout(() => triggerMessageEffect("confetti"), 300);
    }

    loadCurrentChatList();
  } catch (e) {
    appendFailedMessage(text, currentAttachment);
    showToast("Message failed to send", "error");
  } finally {
    setSendingState(false);
    updateComposerActionState();
  }
}

async function handleFileUpload(file) {
  if (!file) return;
  try {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const url = isImage ? await uploadToCloudinary(file) : await uploadDocument(file);
    currentAttachment = {
      type: isImage ? "image" : isVideo ? "video" : "document",
      url,
      filename: file.name,
      size: file.size,
    };
    setAttachmentPreview();
  } catch (e) {
    showToast("File uploading failed", "error");
  }
}

async function sendPoll() {
  if (!currentChat || !currentUser) return;
  const question = prompt("Poll question");
  if (!question || !question.trim()) return;
  const options = (prompt("Options, separated by commas") || "")
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 10);
  if (options.length < 2) {
    showToast("Add at least two poll options", "error");
    return;
  }

  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text: "",
    poll: { question: question.trim(), options, votes: {} },
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: "sent",
    read: false,
    readBy: {
      [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
    },
    deliveredTo: {},
    participants:
      currentChatType === "direct"
        ? [
            ...new Set(
              [
                currentUser.uid,
                currentChat.otherUserId,
                ...String(currentChat.id || "").split("_"),
              ].filter(Boolean),
            ),
          ]
        : [currentUser.uid],
  };
  if (currentChatType === "direct") messageData.directId = currentChat.id;
  else messageData.groupId = currentChat.id;

  await db.collection("messages").add(messageData);
  const previewText = `Poll: ${question.trim()}`;
  if (currentChatType === "direct") {
    await db.collection("directChats").doc(currentChat.id).set(
      {
        lastMessage: previewText,
        lastMessageSenderId: currentUser.uid,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "active",
      },
      { merge: true },
    );
  } else {
    await db
      .collection("groups")
      .doc(currentChat.id)
      .set(
        {
          lastMessage: previewText,
          lastMessageSenderId: currentUser.uid,
          lastMessageSenderName: currentUser.displayName || currentUser.email,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  }
  loadCurrentChatList();
}

function parseScheduledDate(value = "") {
  const normalized = value.trim().replace("T", " ");
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/,
  );
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  const date = new Date(y, m - 1, d, h, min, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalDateTimeValue(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function openScheduleMessageModal() {
  if (!currentChat || !currentUser) {
    showToast("Open a chat before scheduling", "error");
    return;
  }
  const input = document.getElementById("messageInput");
  const text = (input?.value || "").trim();
  if (!text) {
    showToast("Type a text message before scheduling", "error");
    return;
  }
  const modal = document.getElementById("scheduleMessageModal");
  const textInput = document.getElementById("scheduleMessageText");
  const timeInput = document.getElementById("scheduleMessageTime");
  if (!modal || !textInput || !timeInput) return;
  const defaultDate = new Date(Date.now() + 10 * 60 * 1000);
  textInput.value = text;
  timeInput.min = toLocalDateTimeValue(new Date(Date.now() + 60 * 1000));
  timeInput.value = toLocalDateTimeValue(defaultDate);
  modal.style.display = "flex";
}

function closeScheduleMessageModal() {
  const modal = document.getElementById("scheduleMessageModal");
  if (modal) modal.style.display = "none";
}

async function scheduleCurrentMessage() {
  if (!currentChat || !currentUser) return;
  const textInput = document.getElementById("scheduleMessageText");
  const timeInput = document.getElementById("scheduleMessageTime");
  const composer = document.getElementById("messageInput");
  const text = (textInput?.value || "").trim();
  if (!text) {
    showToast("Type a message before scheduling", "error");
    return;
  }
  const dueAt = parseScheduledDate(timeInput?.value || "");
  if (!dueAt || dueAt <= new Date()) {
    showToast("Choose a future date and time", "error");
    return;
  }
  await db.collection("scheduledMessages").add({
    userId: currentUser.uid,
    chatId: currentChat.id,
    chatType: currentChatType,
    otherUserId: currentChat.otherUserId || "",
    text,
    status: "pending",
    dueAt,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  if (composer && composer.value.trim() === text) composer.value = "";
  clearCurrentDraft();
  closeScheduleMessageModal();
  showToast("Message scheduled");
}

async function sendScheduledMessage(item) {
  const data = item.data || {};
  const directParticipants =
    data.chatType === "direct"
      ? [
          ...new Set(
            [
              currentUser.uid,
              data.otherUserId,
              ...String(data.chatId || "").split("_"),
            ].filter(Boolean),
          ),
        ]
      : [currentUser.uid];
  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text: data.text || "",
    scheduled: true,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: "sent",
    read: false,
    readBy: {
      [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
    },
    deliveredTo: {},
    participants: directParticipants,
  };
  if (data.chatType === "direct") messageData.directId = data.chatId;
  else messageData.groupId = data.chatId;
  await db.collection("messages").add(messageData);
  if (data.chatType === "direct") {
    await db
      .collection("directChats")
      .doc(data.chatId)
      .set(
        {
          lastMessage: data.text || "Scheduled message",
          lastMessageSenderId: currentUser.uid,
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          status: "active",
        },
        { merge: true },
      );
  } else {
    await db
      .collection("groups")
      .doc(data.chatId)
      .set(
        {
          lastMessage: data.text || "Scheduled message",
          lastMessageSenderId: currentUser.uid,
          lastMessageSenderName: currentUser.displayName || currentUser.email,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  }
  await db.collection("scheduledMessages").doc(item.id).update({
    status: "sent",
    sentAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function processScheduledMessages() {
  if (!currentUser) return;
  const snapshot = await db
    .collection("scheduledMessages")
    .where("userId", "==", currentUser.uid)
    .where("status", "==", "pending")
    .where("dueAt", "<=", new Date())
    .limit(10)
    .get()
    .catch(() => null);
  if (!snapshot || snapshot.empty) return;
  for (const doc of snapshot.docs) {
    await sendScheduledMessage({ id: doc.id, data: doc.data() }).catch(
      async () => {
        await doc.ref
          .update({
            status: "failed",
            failedAt: firebase.firestore.FieldValue.serverTimestamp(),
          })
          .catch(() => {});
      },
    );
  }
  loadCurrentChatList();
}

function startScheduledMessageWorker() {
  clearInterval(scheduledMessagesTimer);
  processScheduledMessages().catch(() => {});
  scheduledMessagesTimer = setInterval(
    () => processScheduledMessages().catch(() => {}),
    60000,
  );
}

async function retryFailedMessageRecord(failed) {
  if (!failed || !currentUser || !failed.chatId || !failed.chatType)
    return false;
  const directParticipants =
    failed.chatType === "direct"
      ? [
          ...new Set(
            [
              currentUser.uid,
              ...String(failed.chatId || "")
                .split("_")
                .filter(Boolean),
              failed.otherUserId,
            ].filter(Boolean),
          ),
        ]
      : [];

  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text: failed.text || "",
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: "sent",
    read: false,
    readBy: {
      [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
    },
    deliveredTo: {},
    participants:
      failed.chatType === "direct" ? directParticipants : [currentUser.uid],
    mentions:
      failed.chatType === "group" ? [] : getMessageMentions(failed.text || ""),
  };
  if (failed.attachment) messageData.attachment = failed.attachment;
  if (failed.replyTo) messageData.replyTo = failed.replyTo;
  if (failed.chatType === "direct") messageData.directId = failed.chatId;
  else messageData.groupId = failed.chatId;

  await db.collection("messages").add(messageData);
  const previewText =
    failed.text ||
    (failed.attachment ? getAttachmentLabel(failed.attachment) : "Message");
  if (failed.chatType === "direct") {
    await db.collection("directChats").doc(failed.chatId).set(
      {
        participants: directParticipants,
        lastMessage: previewText,
        lastMessageSenderId: currentUser.uid,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "active",
      },
      { merge: true },
    );
  } else {
    await db
      .collection("groups")
      .doc(failed.chatId)
      .set(
        {
          lastMessage: previewText,
          lastMessageSenderId: currentUser.uid,
          lastMessageSenderName: currentUser.displayName || currentUser.email,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  }
  return true;
}

async function processFailedMessageQueue() {
  if (!navigator.onLine || !currentUser) return;
  const items = getLocalFailedMessages();
  if (!items.length) return;
  for (const item of items) {
    try {
      await retryFailedMessageRecord(item);
      removeLocalFailedMessage(item.localId);
      document
        .querySelector(
          `.local-failed-message[data-local-failed-id="${CSS.escape(item.localId)}"]`,
        )
        ?.remove();
    } catch (_) {}
  }
  loadCurrentChatList();
  if (currentChat) loadMessages();
}

function startFailedQueueRetryWorker() {
  clearInterval(failedQueueRetryTimer);
  failedQueueRetryTimer = setInterval(() => {
    processFailedMessageQueue().catch(() => {});
  }, 30000);
}

function formatWhen(dateValue) {
  if (!dateValue) return "";
  const date =
    dateValue?.toDate?.() || (dateValue instanceof Date ? dateValue : null);
  if (!date) return "";
  return date.toLocaleString();
}

async function resolveScheduledChatName(item) {
  const data = item.data || {};
  if (data.chatType === "group") {
    const groupDoc = await db
      .collection("groups")
      .doc(data.chatId)
      .get()
      .catch(() => null);
    return groupDoc?.exists ? groupDoc.data()?.name || "Group" : "Group";
  }
  if (data.otherUserId) {
    const userDoc = await db
      .collection("users")
      .doc(data.otherUserId)
      .get()
      .catch(() => null);
    if (userDoc?.exists)
      return (
        userDoc.data()?.displayName || userDoc.data()?.email || "Direct chat"
      );
  }
  return "Direct chat";
}

async function showScheduledMessagesModal() {
  if (!currentUser) return;
  const modal = document.getElementById("scheduledMessagesModal");
  const list = document.getElementById("scheduledMessagesList");
  if (!modal || !list) return;
  list.innerHTML =
    '<div class="empty-state">Loading scheduled messages...</div>';
  modal.style.display = "flex";

  const snapshot = await db
    .collection("scheduledMessages")
    .where("userId", "==", currentUser.uid)
    .orderBy("createdAt", "desc")
    .limit(200)
    .get()
    .catch(() => null);

  if (!snapshot || snapshot.empty) {
    list.innerHTML = '<div class="empty-state">No scheduled messages</div>';
    return;
  }

  const entries = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        data,
        chatName: await resolveScheduledChatName({ data }),
      };
    }),
  );

  list.innerHTML = "";
  entries.forEach((entry) => {
    const data = entry.data || {};
    const status = data.status || "pending";
    const row = document.createElement("div");
    row.className = "starred-message-card scheduled-message-card";
    row.innerHTML = `
      <div class="starred-message-head">
        <strong>${escapeHtml(entry.chatName)}</strong>
        <span>${escapeHtml(status.toUpperCase())}</span>
      </div>
      <div class="starred-message-text">${escapeHtml(data.text || "")}</div>
      <div class="starred-message-meta">
        Due: ${escapeHtml(formatWhen(data.dueAt) || "-")}
      </div>
      <div class="scheduled-message-actions"></div>
    `;

    const actions = row.querySelector(".scheduled-message-actions");
    const addAction = (label, handler, className = "") => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn btn-outline ${className}`.trim();
      btn.textContent = label;
      btn.addEventListener("click", handler);
      actions.appendChild(btn);
    };

    if (status === "pending") {
      addAction("Send Now", async () => {
        await sendScheduledMessage(entry);
        showToast("Scheduled message sent");
        showScheduledMessagesModal();
        loadCurrentChatList();
        if (
          currentChat?.id === data.chatId &&
          currentChatType === data.chatType
        )
          loadMessages();
      });
      addAction(
        "Cancel",
        async () => {
          await db.collection("scheduledMessages").doc(entry.id).update({
            status: "cancelled",
            cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          showToast("Scheduled message cancelled");
          showScheduledMessagesModal();
        },
        "danger",
      );
    } else if (status === "failed") {
      addAction("Retry", async () => {
        const nextDue = new Date(Date.now() + 60 * 1000);
        await db.collection("scheduledMessages").doc(entry.id).update({
          status: "pending",
          dueAt: nextDue,
          retriedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        showToast("Retry scheduled");
        showScheduledMessagesModal();
      });
      addAction(
        "Delete",
        async () => {
          await db.collection("scheduledMessages").doc(entry.id).delete();
          showToast("Scheduled message removed");
          showScheduledMessagesModal();
        },
        "danger",
      );
    } else {
      addAction(
        "Delete",
        async () => {
          await db.collection("scheduledMessages").doc(entry.id).delete();
          showToast("Scheduled message removed");
          showScheduledMessagesModal();
        },
        "danger",
      );
    }

    list.appendChild(row);
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text || "");
  showToast("Copied text!");
}

function getMessageCopyPayload(messageData = {}) {
  const text = String(messageData.text || "").trim();
  if (text) {
    return { label: "Copy Text", value: text, toast: "Copied text" };
  }
  const attachment = messageData.attachment || null;
  if (attachment?.url) {
    const label = attachment.filename || getAttachmentLabel(attachment);
    return {
      label: "Copy Media Link",
      value: attachment.url,
      toast: `${label || "Media"} link copied`,
    };
  }
  if (messageData.location?.url) {
    return {
      label: "Copy Location",
      value: messageData.location.url,
      toast: "Location link copied",
    };
  }
  return null;
}

function copyMessagePayload(messageData = {}) {
  const payload = getMessageCopyPayload(messageData);
  if (!payload?.value) {
    showToast("Nothing to copy", "error");
    return;
  }
  navigator.clipboard.writeText(payload.value);
  showToast(payload.toast || "Copied");
}
function setReplyTo(msg) {
  const messageId = msg?.messageId || msg?.id || "";
  currentReplyTo = { ...msg, id: messageId, messageId };
  document.getElementById("replyPreviewBar").style.display = "block";
  document.getElementById("replyPreviewSender").textContent = msg.senderName;
  document.getElementById("replyPreviewText").textContent = msg.text || "Media";
}
async function showMessageInfo(messageId, messageData = {}) {
  if (!messageId || messageData.senderId !== currentUser?.uid) return;
  const deliveredTo = messageData.deliveredTo || {};
  const readBy = messageData.readBy || {};
  const hasGroupMembers =
    Array.isArray(currentGroupMembers) && currentGroupMembers.length > 0;
  const allIds = [
    ...new Set(
      [...Object.keys(deliveredTo), ...Object.keys(readBy)].filter(
        (id) => id && id !== currentUser.uid,
      ),
    ),
  ];

  const previewText = (messageData.text || "").substring(0, 120);
  const modal = document.getElementById("messageInfoModal");
  const previewEl = document.getElementById("messageInfoPreview");
  const recipientsEl = document.getElementById("messageInfoRecipients");
  previewEl.textContent = previewText || "(no text)";

  let html = "";
  if (!allIds.length) {
    const sentTime = messageData.timestamp
      ? formatWhen(messageData.timestamp)
      : "Pending";
    html = `<div class="message-info-recipient"><div class="message-info-details"><div class="message-info-name">Sent: ${sentTime}</div><div class="message-info-times"><span class="delivered">Delivered: —</span><span class="read">Read: —</span></div></div></div>`;
  } else {
    for (const id of allIds) {
      let name = "User";
      let avatar = "";
      if (hasGroupMembers) {
        const m = currentGroupMembers.find((gm) => gm.id === id);
        if (m) {
          name = m.name || m.displayName || "User";
          avatar = m.avatar || "";
        }
      }
      if (!avatar || name === "User") {
        const u = allUsers.find((u) => u.id === id);
        if (u) {
          name = u.displayName || u.email || "User";
          avatar = u.avatar || "";
        }
      }
      if (name === "User") {
        try {
          const doc = await db.collection("users").doc(id).get();
          const d = doc.data();
          if (d) {
            name = d.displayName || d.email || "User";
            avatar = d.avatar || "";
          }
        } catch (e) {}
      }
      const delivered = deliveredTo[id] ? formatWhen(deliveredTo[id]) : null;
      const read = readBy[id] ? formatWhen(readBy[id]) : null;
      const deliveredIcon = delivered ? "✓✓" : "—";
      const readIcon = read ? "✓✓" : "—";
      const avatarHtml = avatar
        ? `<img src="${avatar}">`
        : escapeHtml((name[0] || "?").toUpperCase());
      html += `<div class="message-info-recipient"><div class="message-info-avatar">${avatarHtml}</div><div class="message-info-details"><div class="message-info-name">${escapeHtml(name)}</div><div class="message-info-times"><span class="delivered"><span class="check delivered-check">${deliveredIcon}</span> ${delivered || "Not yet"}</span><span class="read"><span class="check read-check">${readIcon}</span> ${read || "Not yet"}</span></div></div></div>`;
    }
  }
  recipientsEl.innerHTML = html;
  modal.style.display = "flex";
  document.getElementById("closeMessageInfo").onclick = () => {
    modal.style.display = "none";
  };
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };
}
async function deleteMessageForMe(id) {
  if (!id || !currentUser) return;
  await db
    .collection("messages")
    .doc(id)
    .update({
      [`deletedFor.${currentUser.uid}`]: true,
      [`deletedForAt.${currentUser.uid}`]:
        firebase.firestore.FieldValue.serverTimestamp(),
    });
  showToast("Message deleted for you");
}
function canDeleteForEveryone(messageData) {
  if (!messageData || messageData.senderId !== currentUser?.uid) return false;
  const sentAtMs = messageData.timestamp?.toMillis?.() || 0;
  if (!sentAtMs) return false;
  return Date.now() - sentAtMs <= 60 * 60 * 60 * 1000;
}

function canEditMessage(messageData) {
  if (
    !messageData ||
    messageData.senderId !== currentUser?.uid ||
    messageData.deletedForEveryone
  )
    return false;
  if (
    !messageData.text ||
    messageData.attachment ||
    messageData.poll ||
    messageData.type
  )
    return false;
  const sentAtMs = messageData.timestamp?.toMillis?.() || 0;
  if (!sentAtMs) return false;
  return Date.now() - sentAtMs <= 15 * 60 * 1000;
}

function viewEditHistory(messageData = {}) {
  const history = Array.isArray(messageData.editHistory)
    ? messageData.editHistory
    : [];
  if (!history.length) {
    showToast("No edit history found");
    return;
  }
  const lines = history.map((item, index) => {
    const when = item.editedAt
      ? new Date(item.editedAt).toLocaleString()
      : "Unknown time";
    return `${index + 1}. ${when}: ${item.previousText || ""}`;
  });
  alert(`Edit history:\n\n${lines.join("\n")}`);
}

async function deleteMessageForEveryone(id, messageData = null) {
  if (!id) return;
  if (!messageData) {
    const doc = await db
      .collection("messages")
      .doc(id)
      .get()
      .catch(() => null);
    messageData = doc?.exists ? doc.data() : null;
  }
  if (!canDeleteForEveryone(messageData)) {
    showToast(
      "Delete for everyone is only available for your recent messages",
      "error",
    );
    return;
  }
  if (!confirm("Delete this message for everyone?")) return;
  await db.collection("messages").doc(id).update({
    text: "",
    attachment: firebase.firestore.FieldValue.delete(),
    poll: firebase.firestore.FieldValue.delete(),
    deletedForEveryone: true,
    deletedForEveryoneAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast("Message deleted for everyone");
}
async function starMessage(id, data) {
  await db.collection("starredMessages").add({
    userId: currentUser.uid,
    messageId: id,
    text: data.text || getAttachmentLabel(data.attachment) || "Message",
    senderName: data.senderName || "",
    chatId: currentChat?.id || "",
    chatType: currentChatType || "",
    starredAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast("Starred");
}
async function showStarredMessagesModal() {
  if (!currentUser) return;
  const modal = document.getElementById("starredMessagesModal");
  const list = document.getElementById("starredMessagesList");
  if (!modal || !list) return;
  list.innerHTML = '<div class="empty-state">Loading starred messages...</div>';
  modal.style.display = "flex";
  let snapshot;
  try {
    snapshot = await db
      .collection("starredMessages")
      .where("userId", "==", currentUser.uid)
      .orderBy("starredAt", "desc")
      .get();
  } catch (error) {
    snapshot = await db
      .collection("starredMessages")
      .where("userId", "==", currentUser.uid)
      .get();
  }
  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  items.sort(
    (a, b) =>
      (b.starredAt?.toMillis?.() || 0) - (a.starredAt?.toMillis?.() || 0),
  );
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">No starred messages</div>';
    return;
  }
  list.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "starred-message-card";
    row.innerHTML = `
      <div class="list-info">
        <div class="list-name">${escapeHtml(item.senderName || "Message")}</div>
        <div class="list-preview">${escapeHtml(item.text || "Media")}</div>
      </div>
      <button class="btn btn-outline" data-id="${escapeHtml(item.id)}">Remove</button>
    `;
    row.querySelector("button")?.addEventListener("click", async () => {
      await db.collection("starredMessages").doc(item.id).delete();
      showStarredMessagesModal();
    });
    list.appendChild(row);
  });
}
async function editMessage(id, data) {
  if (!canEditMessage(data)) {
    showToast("Only your recent text messages can be edited", "error");
    return;
  }
  const nextText = prompt("Edit message", data.text || "");
  if (nextText === null) return;
  const trimmed = nextText.trim();
  if (!trimmed) {
    showToast("Message cannot be empty", "error");
    return;
  }
  if (trimmed === (data.text || "").trim()) return;
  await db
    .collection("messages")
    .doc(id)
    .update({
      text: trimmed,
      editedAt: firebase.firestore.FieldValue.serverTimestamp(),
      editHistory: firebase.firestore.FieldValue.arrayUnion({
        previousText: data.text || "",
        editedAt: new Date().toISOString(),
      }),
    });
  showToast("Message edited");
}

function openForwardModal(messageId, messageData) {
  currentForwardMessage = { id: messageId, ...messageData };
  currentForwardSelectionKeys = new Set();
  currentForwardSelectionMap = new Map();
  currentForwardTargets = [];
  const searchInput = document.getElementById("forwardSearch");
  if (searchInput) searchInput.value = "";
  document.getElementById("forwardModal").style.display = "flex";
  renderForwardPreviewBanner(currentForwardMessage);
  renderForwardChats();
}

// Called from media area share button
function openForwardModalForMedia(attachment, extraMeta = {}) {
  currentForwardMessage = {
    id: "__media__",
    text: "",
    attachment,
    ...extraMeta,
  };
  currentForwardSelectionKeys = new Set();
  currentForwardSelectionMap = new Map();
  currentForwardTargets = [];
  const searchInput = document.getElementById("forwardSearch");
  if (searchInput) searchInput.value = "";
  document.getElementById("forwardModal").style.display = "flex";
  renderForwardPreviewBanner(currentForwardMessage);
  renderForwardChats();
}

// Called from links tab share button
function openForwardModalForLink(url) {
  currentForwardMessage = {
    id: "__link__",
    text: url,
    attachment: null,
  };
  currentForwardSelectionKeys = new Set();
  currentForwardSelectionMap = new Map();
  currentForwardTargets = [];
  const searchInput = document.getElementById("forwardSearch");
  if (searchInput) searchInput.value = "";
  document.getElementById("forwardModal").style.display = "flex";
  renderForwardPreviewBanner(currentForwardMessage);
  renderForwardChats();
}

function renderForwardPreviewBanner(msg) {
  const banner = document.getElementById("forwardPreviewBanner");
  if (!banner) return;
  if (!msg) {
    banner.innerHTML = "";
    banner.style.display = "none";
    return;
  }
  const att = msg.attachment;
  let html = "";
  if (att) {
    if (att.type === "image" || att.type === "gif") {
      html = `<div class="fp-media"><img src="${escapeHtml(att.url || "")}" class="fp-thumb" onerror="this.style.display='none'"><span class="fp-label">${escapeHtml(att.filename || getAttachmentLabel(att))}</span></div>`;
    } else if (att.type === "voice") {
      html = `<div class="fp-media"><span class="fp-icon">🎤</span><span class="fp-label">Voice note</span></div>`;
    } else if (att.type === "video") {
      html = `<div class="fp-media"><span class="fp-icon">🎬</span><span class="fp-label">${escapeHtml(att.filename || "Video")}</span></div>`;
    } else {
      html = `<div class="fp-media"><span class="fp-icon">📎</span><span class="fp-label">${escapeHtml(att.filename || getAttachmentLabel(att))}</span></div>`;
    }
  } else if (msg.text) {
    const snippet =
      msg.text.length > 120 ? msg.text.slice(0, 120) + "…" : msg.text;
    html = `<div class="fp-text">${escapeHtml(snippet)}</div>`;
  }
  if (html) {
    banner.innerHTML = `<div class="fp-label-row"><span class="fp-forwarded-tag">↪ Forwarding</span></div>${html}`;
    banner.style.display = "block";
  } else {
    banner.innerHTML = "";
    banner.style.display = "none";
  }
}

async function renderForwardChats(searchTerm = "") {
  const list = document.getElementById("forwardChatsList");
  if (!list || !currentUser) return;
  list.innerHTML = '<div class="forward-loading">Loading…</div>';
  const term = normalizeSearchText(searchTerm);
  const items = [
    ...(await buildDirectChatItems()),
    ...(await buildGroupChatItems()),
  ].filter((item) => {
    if (!term) return true;
    const searchable = [
      item.name,
      item.email,
      item.phone,
      item.preview,
      item.code,
      item.user?.email,
      item.user?.phone,
      item.user?.phoneNumber,
      item.type === "group" ? "group" : "chat",
    ]
      .filter(Boolean)
      .join(" ");
    return normalizeSearchText(searchable).includes(term);
  });
  currentForwardTargets = items;
  if (!items.length) {
    list.innerHTML = '<div class="forward-empty">No chats found</div>';
    updateForwardSelectionButton();
    return;
  }
  list.innerHTML = "";
  items.forEach((item) => {
    const key = `${item.type}:${item.id}`;
    const selected = currentForwardSelectionKeys.has(key);
    const row = document.createElement("button");
    row.type = "button";
    row.className = `forward-chat-row${selected ? " selected" : ""}`;

    // Build avatar — prefer photo URL if available
    let avatarHtml;
    const photoUrl = item.photoURL || item.icon || "";
    if (photoUrl) {
      avatarHtml = `<img src="${escapeHtml(photoUrl)}" class="forward-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"><span class="forward-avatar-fallback" style="display:none;">${escapeHtml(getInitials(item.name || "Chat", item.email || ""))}</span>`;
    } else {
      const rawAvatar = item.avatar || "";
      const isImg = rawAvatar.startsWith("<img");
      if (isImg) {
        avatarHtml = `<span class="forward-avatar-wrap">${rawAvatar}</span>`;
      } else {
        avatarHtml = `<span class="forward-avatar-fallback">${escapeHtml(getInitials(item.name || "Chat", item.email || ""))}</span>`;
      }
    }

    const typeTag =
      item.type === "group"
        ? '<span class="forward-type-tag">Group</span>'
        : "";
    row.innerHTML = `
      <span class="forward-avatar-wrap">${avatarHtml}</span>
      <span class="forward-name-col">
        <span class="forward-name">${escapeHtml(item.name || "Chat")}</span>
        ${typeTag}
      </span>
      <span class="forward-check${selected ? " checked" : ""}">${selected ? "✓" : ""}</span>`;
    row.addEventListener("click", () => {
      if (currentForwardSelectionKeys.has(key)) {
        currentForwardSelectionKeys.delete(key);
        currentForwardSelectionMap.delete(key);
      } else {
        currentForwardSelectionKeys.add(key);
        currentForwardSelectionMap.set(key, item);
      }
      renderForwardChats(document.getElementById("forwardSearch")?.value || "");
    });
    list.appendChild(row);
  });
  updateForwardSelectionButton();
}

function updateForwardSelectionButton() {
  const btn = document.getElementById("forwardSelectedBtn");
  if (!btn) return;
  const count = currentForwardSelectionKeys.size;
  btn.disabled = count === 0;
  btn.textContent = count ? `Forward (${count})` : "Forward";
}

async function forwardSelectedMessages() {
  if (!currentForwardMessage || !currentForwardSelectionKeys.size) return;
  const selectedItems = Array.from(currentForwardSelectionKeys)
    .map((key) => currentForwardSelectionMap.get(key))
    .filter(Boolean);
  if (!selectedItems.length) {
    showToast("Select a chat to forward", "error");
    return;
  }
  for (const item of selectedItems) {
    await forwardMessageTo(item, false);
  }
  currentForwardSelectionKeys = new Set();
  currentForwardSelectionMap = new Map();
  currentForwardMessage = null;
  document.getElementById("forwardModal").style.display = "none";
  showToast(`Message forwarded to ${selectedItems.length} chat(s)`);
}

async function forwardMessageTo(chatItem, closeModal = true) {
  if (!currentForwardMessage || !chatItem || !currentUser) return;
  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text: currentForwardMessage.text || "",
    forwarded: true,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: "sent",
    read: false,
    readBy: {
      [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
    },
    deliveredTo: {},
  };
  if (currentForwardMessage.attachment)
    messageData.attachment = currentForwardMessage.attachment;
  if (currentForwardMessage.poll)
    messageData.poll = { ...currentForwardMessage.poll, votes: {} };

  const preview =
    messageData.text ||
    getAttachmentLabel(messageData.attachment) ||
    "Forwarded message";
  if (chatItem.type === "direct" || chatItem.type === "saved") {
    messageData.directId = chatItem.id;
    messageData.participants = [
      ...new Set(
        [
          currentUser.uid,
          chatItem.otherUserId,
          ...String(chatItem.id || "").split("_"),
        ].filter(Boolean),
      ),
    ];
    await db.collection("messages").add(messageData);
    await db.collection("directChats").doc(chatItem.id).set(
      {
        lastMessage: preview,
        lastMessageSenderId: currentUser.uid,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "active",
      },
      { merge: true },
    );
  } else {
    messageData.groupId = chatItem.id;
    messageData.participants = [currentUser.uid];
    await db.collection("messages").add(messageData);
    await db
      .collection("groups")
      .doc(chatItem.id)
      .set(
        {
          lastMessage: preview,
          lastMessageSenderId: currentUser.uid,
          lastMessageSenderName: currentUser.displayName || currentUser.email,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  }
  if (closeModal) {
    currentForwardMessage = null;
    document.getElementById("forwardModal").style.display = "none";
    showToast("Message forwarded");
  }
}

function showContextMenu(x, y, messageId, messageData, isMyMessage) {
  try {
    const selection = window.getSelection?.();
    if (selection?.rangeCount) selection.removeAllRanges();
  } catch (_) {}
  removeMessageContextMenu();
  const menu = document.createElement("div");
  menu.className = "context-menu message-context-menu";

  const reactionStrip = document.createElement("div");
  reactionStrip.className = "message-context-reactions";
  getReactionOptions().forEach((emoji) => {
    const reactionBtn = document.createElement("button");
    reactionBtn.type = "button";
    reactionBtn.className = "message-context-reaction-btn";
    reactionBtn.textContent = emoji;
    reactionBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      addReaction(messageId, emoji);
      removeMessageContextMenu();
    });
    reactionStrip.appendChild(reactionBtn);
  });
  menu.appendChild(reactionStrip);

  const copyPayload = getMessageCopyPayload(messageData);
  const items = [
    { text: "Forward", action: () => openForwardModal(messageId, messageData) },
    ...(copyPayload
      ? [
          {
            text: copyPayload.label,
            action: () => copyMessagePayload(messageData),
          },
        ]
      : []),
    ...(extractLinks(messageData.text || "").length
      ? [
          {
            text: "Copy Link",
            action: () => copyToClipboard(extractLinks(messageData.text)[0]),
          },
        ]
      : []),
    { text: "Reply", action: () => setReplyTo({ ...messageData, messageId }) },
    { text: "Star Message", action: () => starMessage(messageId, messageData) },
    { text: "Pin Message", action: () => pinMessage(messageId, messageData) },
    {
      text: "Report Message",
      action: () => reportMessage(messageId, messageData),
    },
  ];
  items.push({
    text: "Delete For Me",
    action: () => deleteMessageForMe(messageId),
  });
  if (isMyMessage) {
    items.push({
      text: "Message Info",
      action: () => showMessageInfo(messageId, messageData),
    });
    if (canEditMessage(messageData)) {
      items.push({
        text: "Edit Message",
        action: () => editMessage(messageId, messageData),
      });
    }
    if (canDeleteForEveryone(messageData)) {
      items.push({
        text: "Delete For Everyone",
        action: () => deleteMessageForEveryone(messageId, messageData),
      });
    }
  }
  if (
    Array.isArray(messageData.editHistory) &&
    messageData.editHistory.length
  ) {
    items.push({
      text: "View Edit History",
      action: () => viewEditHistory(messageData),
    });
  }

  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "context-menu-item";
    btn.textContent = item.text;
    btn.onclick = () => {
      item.action();
      removeMessageContextMenu();
    };
    menu.appendChild(btn);
  });
  document.body.appendChild(menu);
  document.body.classList.add("message-menu-open");
  positionContextMenu(menu, x, y);
}

function removeMessageContextMenu() {
  const existing = document.querySelector(".message-context-menu");
  if (existing) existing.remove();
  document.body.classList.remove("message-menu-open");
}

function positionContextMenu(menu, x, y) {
  if (!menu) return;
  const margin = 8;
  const touchBottomInset = window.matchMedia?.("(pointer: coarse)").matches
    ? 56
    : 0;
  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const viewportOffsetTop = window.visualViewport?.offsetTop || 0;
  menu.style.display = "block";
  menu.style.left = "0px";
  menu.style.top = "0px";
  menu.style.maxHeight = `${Math.max(180, viewportHeight - margin * 2 - touchBottomInset)}px`;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(
    Math.max(margin, x),
    Math.max(margin, viewportWidth - rect.width - margin),
  );
  const topMin = viewportOffsetTop + margin;
  const topMax =
    viewportOffsetTop +
    viewportHeight -
    rect.height -
    margin -
    touchBottomInset;
  const top = Math.min(Math.max(topMin, y), Math.max(topMin, topMax));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function closeComposerPanels() {
  const sheet = document.getElementById("attachmentSheet");
  if (sheet) {
    sheet.classList.remove("show");
    sheet.setAttribute("aria-hidden", "true");
  }
  const picker = document.getElementById("emojiPicker");
  if (picker) {
    picker.classList.remove("show");
    picker.style.display = "none";
  }
  document.body.classList.remove("composer-sheet-open", "emoji-sheet-open");
}

function toggleAttachmentSheet(force) {
  const sheet = document.getElementById("attachmentSheet");
  if (!sheet) return;
  const shouldShow =
    typeof force === "boolean" ? force : !sheet.classList.contains("show");
  const picker = document.getElementById("emojiPicker");
  if (picker) {
    picker.classList.remove("show");
    picker.style.display = "none";
  }
  sheet.classList.toggle("show", shouldShow);
  sheet.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  document.body.classList.toggle("composer-sheet-open", shouldShow);
  document.body.classList.remove("emoji-sheet-open");
}

function toggleEmojiSheet(force) {
  const picker = document.getElementById("emojiPicker");
  if (!picker) return;
  const shouldShow =
    typeof force === "boolean"
      ? force
      : !(picker.classList.contains("show") || picker.style.display === "block");
  toggleAttachmentSheet(false);
  picker.classList.toggle("show", shouldShow);
  picker.style.display = shouldShow ? "block" : "none";
  document.body.classList.toggle("emoji-sheet-open", shouldShow);
  const emojiBtn = document.getElementById("emojiBtn");
  if (emojiBtn) {
    emojiBtn.classList.toggle("keyboard-mode", shouldShow);
    emojiBtn.setAttribute(
      "aria-label",
      shouldShow ? "Show keyboard" : "Emoji",
    );
  }
  if (!shouldShow) document.getElementById("messageInput")?.focus();
}

function updateComposerActionState() {
  const input = document.getElementById("messageInput");
  const inputArea = document.getElementById("inputArea");
  const hasContent = Boolean((input?.value || "").trim() || currentAttachment);
  if (inputArea) inputArea.classList.toggle("has-sendable", hasContent);
  const sendBtn = document.getElementById("sendBtn");
  const voiceBtn = document.getElementById("voiceMsgBtn");
  if (sendBtn) sendBtn.style.display = hasContent ? "inline-flex" : "none";
  if (voiceBtn) voiceBtn.style.display = hasContent ? "none" : "inline-flex";
}

function triggerDocumentPicker() {
  toggleAttachmentSheet(false);
  const input = document.getElementById("fileInput");
  if (!input) return;
  input.removeAttribute("capture");
  input.accept =
    "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain";
  input.click();
}

function triggerMediaPicker() {
  toggleAttachmentSheet(false);
  const input = document.getElementById("fileInput");
  if (!input) return;
  input.removeAttribute("capture");
  input.accept = "image/*,video/*";
  input.click();
}

async function triggerCameraPicker() {
  toggleAttachmentSheet(false);
  if (isNativeAndroidApp) {
    const hasCamera = await ensureNativePermission("camera");
    if (!hasCamera) return;
  }
  const input = document.getElementById("fileInput");
  if (!input) return;
  input.accept = "image/*,video/*";
  input.setAttribute("capture", "environment");
  input.click();
}

function buildActiveChatContextTarget() {
  if (!currentChat) return null;
  const el = document.createElement("div");
  el.dataset.chatId = currentChat.id || "";
  el.dataset.chatType = currentChatType || "";
  el.dataset.chatName =
    currentChat.name ||
    currentChat.displayName ||
    currentChat.otherUserName ||
    document.getElementById("currentChatName")?.textContent ||
    "Chat";
  if (currentChat.otherUserId) el.dataset.otherUserId = currentChat.otherUserId;
  return el;
}

function openActiveChatMenu(anchor) {
  if (!currentChat) {
    showToast("Open a chat first", "error");
    return;
  }
  contextMenuTarget = buildActiveChatContextTarget();
  const menu = document.getElementById("chatContextMenu");
  if (!menu || !contextMenuTarget) return;
  updateChatContextMenuLabels();
  contextMenuOpenedAt = Date.now();
  const rect = anchor?.getBoundingClientRect?.();
  positionContextMenu(
    menu,
    rect ? rect.right - 8 : window.innerWidth - 280,
    rect ? rect.bottom + 8 : 80,
  );
}

function openCurrentChatMedia() {
  document.getElementById("chatContextMenu").style.display = "none";
  if (!currentChat) return;
  if (currentChatType === "group") {
    showGroupInfo();
    setTimeout(() => renderSharedContent("media", "groupSharedContent"), 0);
  } else {
    showChatInfo();
    setTimeout(() => renderSharedContent("media"), 0);
  }
}

function getHomePanelHtml() {
  return `
    <div class="home-panel">
      <div class="home-panel-icon">TC</div>
      <h3 class="home-panel-title">Team Chat for Web</h3>
      <p class="home-panel-text">Select a chat from the list to start messaging.</p>
      <p class="home-panel-note">Keep your phone and browser connected to stay in sync.</p>
    </div>
  `;
}

// ========================================
// SYSTEM PROFILES CONFIGURATORS
// ========================================

async function updateProfileAvatar(file) {
  if (!validateAvatarImageFile(file, "Profile photo")) return;
  const url = await uploadToCloudinary(file);
  await db.collection("users").doc(currentUser.uid).update({ avatar: url });
  showToast("Avatar saved!");
}
async function updateDisplayName(name) {
  await db
    .collection("users")
    .doc(currentUser.uid)
    .update({ displayName: name });
  showToast("Profile Name synchronized");
}
async function updateStatusText(txt) {
  if (txt) {
    currentUserStatus.preset = "custom";
    currentUserStatus.emoji = "✏️";
    currentUserStatus.text = txt;
    await updateUserStatus(currentUserStatus);
  }
}
async function updatePrivacySettings() {
  await db.collection("users").doc(currentUser.uid).update({ privacySettings });
}

async function showProfileModal() {
  const doc = await db.collection("users").doc(currentUser.uid).get();
  const d = doc.data() || {};
  privacySettings = { ...privacySettings, ...(d.privacySettings || {}) };
  document.getElementById("profileName").textContent =
    d.displayName || currentUser.email;
  document.getElementById("profileEmail").textContent = d.email;
  document.getElementById("profileUsername").textContent = d.username
    ? "@" + d.username
    : "@not set";
  const usernameBtn = document.getElementById("setUsernameBtn");
  if (usernameBtn) {
    usernameBtn.textContent = d.username ? "Change" : "Set";
    usernameBtn.onclick = async () => {
      const desired = prompt(
        d.username ? "Change your username:" : "Choose a username:",
        d.username || "",
      );
      if (!desired || !desired.trim()) return;
      const name = desired
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");
      if (name.length < 3) {
        showToast("Username must be at least 3 characters", "error");
        return;
      }
      if (name.length > 20) {
        showToast("Username max 20 characters", "error");
        return;
      }
      try {
        const usernameRef = db.collection("usernames").doc(name);
        const existing = await usernameRef.get();
        if (existing.exists && existing.data()?.uid !== currentUser.uid) {
          showToast("Username already taken", "error");
          return;
        }
        await db.runTransaction(async (transaction) => {
          transaction.set(
            usernameRef,
            {
              uid: currentUser.uid,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          transaction.update(db.collection("users").doc(currentUser.uid), {
            username: name,
          });
        });
        showToast("Username set to @" + name);
        document.getElementById("profileUsername").textContent = "@" + name;
        if (usernameBtn) usernameBtn.textContent = "Change";
      } catch (e) {
        showToast("Could not set username", "error");
      }
    };
  }
  document.getElementById("profilePhone").textContent =
    d.phone || d.phoneNumber || "Not set";
  const userStatus = d.status || {};
  const currentPreset = userStatus.preset || "available";
  document.getElementById("profileStatusText").value =
    userStatus.text || d.statusText || "";
  document.getElementById("statusTimer").value = "";
  document.querySelectorAll(".status-preset").forEach((el) => {
    el.classList.toggle("active", el.dataset.preset === currentPreset);
  });
  document.getElementById("hideReadReceipts").checked =
    !!privacySettings.hideReadReceipts;
  document.getElementById("hideTypingIndicator").checked =
    !!privacySettings.hideTypingIndicator;
  document.getElementById("hideLastSeen").checked =
    !!privacySettings.hideLastSeen;
  const avatarMarkup = d.avatar
    ? `<img src="${d.avatar}" alt="Profile avatar">`
    : escapeHtml(
        getInitials(
          d.displayName || currentUser.displayName || "",
          d.email || currentUser.email || "",
        ),
      );
  document.getElementById("profileAvatar").innerHTML = avatarMarkup;
  document.getElementById("profileModal").style.display = "flex";
}

function normalizePermissionState(state) {
  if (state === "granted") return "Allowed";
  if (state === "denied") return "Blocked";
  if (state === "prompt") return "Ask first time";
  return state || "Ask when needed";
}

function isPermissionAllowedStatus(status = "") {
  return ["allowed", "granted"].includes(
    String(status || "")
      .trim()
      .toLowerCase(),
  );
}

function getPermissionButtonLabel(kind, status) {
  if (kind === "media" && !isPermissionAllowedStatus(status))
    return "Open Picker";
  return isPermissionAllowedStatus(status)
    ? "Revoke / Change"
    : "Grant Permission";
}

async function queryNativePermissionState(alias) {
  if (!isNativeAndroidApp) return null;
  try {
    const plugin = window.Capacitor?.Plugins?.AppPermissions;
    if (!plugin) return null;
    const result = await plugin.checkPermission({ alias });
    const status = String(result.status || "").toLowerCase();
    if (status === "granted") return "Allowed";
    if (status === "prompt") return "Ask first time";
    if (status === "denied") return "Blocked";
    return "Ask when needed";
  } catch (err) {
    console.error("Error querying native permission:", err);
    return null;
  }
}

async function requestNativePermissionState(alias) {
  if (!isNativeAndroidApp) return null;
  try {
    const plugin = window.Capacitor?.Plugins?.AppPermissions;
    if (!plugin) return null;
    const result = await plugin.requestPermission({ alias });
    return String(result.status || "").toLowerCase();
  } catch (err) {
    console.error("Error requesting native permission:", err);
    return "denied";
  }
}

async function openNativeAppSettings() {
  if (!isNativeAndroidApp) return;
  try {
    const plugin = window.Capacitor?.Plugins?.AppPermissions;
    if (plugin) {
      await plugin.openSettings();
    }
  } catch (err) {
    console.error("Error opening native app settings:", err);
  }
}

async function ensureNativePermission(kind) {
  if (!isNativeAndroidApp) return true;
  try {
    const status = await queryNativePermissionState(kind);
    if (status === "Allowed") return true;

    const reqStatus = await requestNativePermissionState(kind);
    if (reqStatus === "granted") return true;

    showToast(
      `Please allow ${kind} permission in your device settings.`,
      "error",
    );
    showPermissionRevokeGuide();
    return false;
  } catch (err) {
    console.error("Error ensuring native permission:", err);
    return false;
  }
}

async function queryPermissionState(name) {
  if (name === "notifications") {
    return typeof Notification === "undefined"
      ? "Not supported"
      : normalizePermissionState(Notification.permission);
  }
  if (!navigator.permissions?.query) return "Ask when needed";
  try {
    const result = await navigator.permissions.query({ name });
    return normalizePermissionState(result.state);
  } catch (_) {
    return "Ask when needed";
  }
}

async function refreshPermissionsModal() {
  const camera = document.getElementById("cameraPermissionStatus");
  const microphone = document.getElementById("microphonePermissionStatus");
  const notifications = document.getElementById(
    "notificationsPermissionStatus",
  );
  const location = document.getElementById("locationPermissionStatus");
  const media = document.getElementById("mediaPermissionStatus");
  const contacts = document.getElementById("contactsPermissionStatus");

  const permConfig = [
    {
      kind: "camera",
      el: camera,
      btnKind: "camera",
      nativeAlias: "camera",
      browserKey: "camera",
    },
    {
      kind: "microphone",
      el: microphone,
      btnKind: "microphone",
      nativeAlias: "microphone",
      browserKey: "microphone",
    },
    {
      kind: "notifications",
      el: notifications,
      btnKind: "notifications",
      nativeAlias: "notifications",
      browserKey: "notifications",
    },
    {
      kind: "location",
      el: location,
      btnKind: "location",
      nativeAlias: "location",
      browserKey: "geolocation",
    },
    {
      kind: "media",
      el: media,
      btnKind: "media",
      nativeAlias: "media",
      browserKey: null,
    },
    {
      kind: "contacts",
      el: contacts,
      btnKind: "contacts",
      nativeAlias: "contacts",
      browserKey: null,
    },
  ];

  for (const cfg of permConfig) {
    let status;
    if (isNativeAndroidApp) {
      if (cfg.kind === "media")
        status =
          (await queryNativePermissionState("media")) || "Ask from file picker";
      else if (cfg.kind === "contacts")
        status =
          (await queryNativePermissionState("contacts")) || "Ask when needed";
      else if (cfg.nativeAlias)
        status =
          (await queryNativePermissionState(cfg.nativeAlias)) ||
          "Ask when needed";
    } else {
      if (cfg.kind === "media") status = "Asked by the browser file picker";
      else if (cfg.kind === "contacts")
        status = navigator.contacts?.select
          ? "Ask first time"
          : "Not supported on this device";
      else if (cfg.browserKey)
        status = await queryPermissionState(cfg.browserKey);
    }
    if (cfg.el) cfg.el.textContent = status;
    const btn = document.querySelector(
      `[data-request-permission="${cfg.btnKind}"]`,
    );
    if (btn) {
      const allowed = isPermissionAllowedStatus(status);
      btn.textContent = getPermissionButtonLabel(cfg.btnKind, status);
      btn.className = allowed
        ? "btn btn-outline permission-revoke-btn"
        : "btn btn-outline";
      btn.disabled = status === "Not supported on this device";
      btn.dataset.permissionStatus = allowed ? "granted" : "not-granted";
    }
  }
}

function stopPermissionProbe(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

function openMediaPermissionPicker() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt";
  input.style.display = "none";
  input.addEventListener("change", () => input.remove(), { once: true });
  document.body.appendChild(input);
  input.click();
}

async function requestAppPermission(kind) {
  try {
    const btn = document.querySelector(`[data-request-permission="${kind}"]`);
    if (btn?.dataset.permissionStatus === "granted") {
      showPermissionRevokeGuide(kind);
      return;
    }

    if (isNativeAndroidApp) {
      if (
        kind === "camera" ||
        kind === "microphone" ||
        kind === "notifications" ||
        kind === "contacts" ||
        kind === "location" ||
        kind === "media"
      ) {
        const status = await requestNativePermissionState(kind);
        if (status === "granted") {
          showToast("Permission granted successfully", "success");
        } else {
          showToast(
            `${kind[0].toUpperCase()}${kind.slice(1)} permission was not allowed`,
            "error",
          );
          showPermissionRevokeGuide();
        }
        await refreshPermissionsModal();
        return;
      }
    }

    if (kind === "camera") {
      stopPermissionProbe(
        await navigator.mediaDevices.getUserMedia({ video: true }),
      );
    } else if (kind === "microphone") {
      stopPermissionProbe(
        await navigator.mediaDevices.getUserMedia({ audio: true }),
      );
    } else if (kind === "notifications") {
      await ensureCallNotificationPermission({ force: true });
      await requestNativeNotificationPermission();
    } else if (kind === "location") {
      await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Location not supported on this device"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
        });
      });
    } else if (kind === "media") {
      openMediaPermissionPicker();
    } else if (kind === "contacts") {
      if (!navigator.contacts?.select) {
        showToast("Contact picker is not supported on this device", "error");
        return;
      }
      await navigator.contacts.select(["name", "email", "tel"], {
        multiple: false,
      });
    }
    await refreshPermissionsModal();
    showToast("Permission granted successfully", "success");
  } catch (error) {
    const label = kind === "microphone" ? "microphone" : kind;
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      showToast(
        `Please allow ${label} access in your device settings.`,
        "error",
      );
      const permModal = document.getElementById("permissionsModal");
      if (permModal) permModal.style.display = "none";
      showPermissionRevokeGuide();
    } else if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
      showToast(`No ${label} was found on this device`, "error");
    } else {
      showToast(
        `${label[0].toUpperCase()}${label.slice(1)} permission was not allowed`,
        "error",
      );
    }
    await refreshPermissionsModal();
  }
}

function showPermissionRevokeGuide(kind = "") {
  const modal = document.getElementById("revokePermissionsGuideModal");
  if (modal) {
    modal.style.display = "flex";
    const title = modal.querySelector(".modal-header h3");
    if (title)
      title.textContent = kind
        ? `Change ${kind} permission`
        : "How to Revoke Permissions";
    const btn = document.getElementById("nativeSettingsBtn");
    if (btn) {
      btn.style.display = isNativeAndroidApp ? "block" : "none";
    }
  }
}

async function showPermissionsModal() {
  const modal = document.getElementById("permissionsModal");
  if (!modal) return;
  modal.style.display = "flex";
  await refreshPermissionsModal();
}

async function showBlockedUsersModal() {
  await loadBlockedUsers();
  const list = document.getElementById("blockedUsersList");
  if (list) {
    list.innerHTML = blockedUsers.length
      ? ""
      : '<div class="empty-state">No blocked users</div>';
    blockedUsers.forEach((user) => {
      const row = document.createElement("div");
      row.className = "blocked-user-card";
      row.innerHTML = `<div class="list-info"><div class="list-name">${escapeHtml(user.blockedUserName || "User")}</div><div class="list-preview">Blocked contact</div></div><button class="btn btn-outline" data-id="${escapeHtml(user.id)}">Unblock</button>`;
      row.querySelector("button")?.addEventListener("click", async () => {
        await unblockUser(user.id);
        showBlockedUsersModal();
      });
      list.appendChild(row);
    });
  }
  document.getElementById("blockedModal").style.display = "flex";
}
function showQuickRepliesModal() {
  const list = document.getElementById("quickRepliesList");
  if (list) {
    list.innerHTML = quickReplies.length
      ? ""
      : '<div class="empty-state">No quick replies yet</div>';
    quickReplies.forEach((reply) => {
      const row = document.createElement("div");
      row.className = "quick-reply-card";
      row.innerHTML = `<button type="button" class="quick-reply-text">${escapeHtml(reply.text)}</button><button type="button" class="btn btn-outline" data-id="${escapeHtml(reply.id)}">Delete</button>`;
      row.querySelector(".quick-reply-text")?.addEventListener("click", () => {
        const input = document.getElementById("messageInput");
        if (input) {
          input.value = `${input.value || ""}${input.value ? " " : ""}${reply.text}`;
          saveCurrentDraft();
          resizeMessageComposer();
          input.focus();
        }
        document.getElementById("quickRepliesModal").style.display = "none";
      });
      row
        .querySelector(".btn")
        ?.addEventListener("click", () => deleteQuickReply(reply.id));
      list.appendChild(row);
    });
  }
  document.getElementById("quickRepliesModal").style.display = "flex";
}
async function getCurrentChatMessages() {
  if (!currentChat || !currentChatType) return [];
  const directIds = getDirectChatIdsForCurrentChat();
  const query =
    currentChatType === "direct" && directIds.length > 1
      ? db.collection("messages").where("directId", "in", directIds)
      : db
          .collection("messages")
          .where(
            currentChatType === "direct" ? "directId" : "groupId",
            "==",
            currentChat.id,
          );
  const snapshot = await query.get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter(
      (msg) => !msg.deletedFor?.[currentUser.uid] && !msg.deletedForEveryone,
    )
    .sort(
      (a, b) =>
        (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0),
    );
}

async function exportCurrentChat() {
  if (!currentChat) {
    showToast("Open a chat to export it", "error");
    return;
  }
  const messages = await getCurrentChatMessages();
  const title =
    document.getElementById("currentChatName")?.textContent || "Chat";
  const formatInput = prompt("Export format: txt or json", "txt");
  if (!formatInput) return;
  const format = formatInput.trim().toLowerCase();
  const safeName = `${title.replace(/[^a-z0-9_-]+/gi, "_") || "chat"}-export`;
  let blob;
  let fileName;

  if (format === "json") {
    const payload = {
      exportedAt: new Date().toISOString(),
      chat: {
        id: currentChat.id,
        type: currentChatType,
        name: title,
      },
      messages: messages.map((msg) => ({
        id: msg.id || null,
        timestamp: msg.timestamp?.toDate?.()?.toISOString?.() || null,
        senderId: msg.senderId || null,
        senderName: msg.senderName || "User",
        text: msg.text || "",
        poll: msg.poll || null,
        attachment: msg.attachment || null,
        forwarded: !!msg.forwarded,
        edited: !!msg.edited,
      })),
    };
    blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    fileName = `${safeName}.json`;
  } else {
    const lines = [
      `Export: ${title}`,
      `Created: ${new Date().toLocaleString()}`,
      "",
    ];
    messages.forEach((msg) => {
      const when = msg.timestamp?.toDate?.()?.toLocaleString?.() || "";
      const body = msg.poll
        ? `Poll: ${msg.poll.question}`
        : msg.text || getAttachmentLabel(msg.attachment) || "Message";
      lines.push(`[${when}] ${msg.senderName || "User"}: ${body}`);
    });
    blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    fileName = `${safeName}.txt`;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Chat exported");
}

function serializeForBackup(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeForBackup);
  if (typeof value === "object") {
    if (typeof value.toMillis === "function") return { __ts: value.toMillis() };
    const out = {};
    Object.keys(value).forEach((key) => {
      out[key] = serializeForBackup(value[key]);
    });
    return out;
  }
  return value;
}

function deserializeFromBackup(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(deserializeFromBackup);
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "__ts")) {
      return new Date(Number(value.__ts) || Date.now());
    }
    const out = {};
    Object.keys(value).forEach((key) => {
      out[key] = deserializeFromBackup(value[key]);
    });
    return out;
  }
  return value;
}

function normalizeImportDocId(raw = "") {
  return String(raw || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 90);
}

async function exportFullBackup() {
  if (!currentUser) return;
  showToast("Preparing backup...");
  const userDoc = await db.collection("users").doc(currentUser.uid).get();
  const directChatsSnap = await db
    .collection("directChats")
    .where("participants", "array-contains", currentUser.uid)
    .get();
  const memberSnap = await db
    .collection("groupMembers")
    .where("userId", "==", currentUser.uid)
    .get();
  const groupIds = [
    ...new Set(memberSnap.docs.map((d) => d.data().groupId).filter(Boolean)),
  ];

  const groups = [];
  for (const groupId of groupIds) {
    const g = await db.collection("groups").doc(groupId).get();
    if (g.exists) groups.push({ id: g.id, data: g.data() });
  }

  const directChats = directChatsSnap.docs.map((doc) => ({
    id: doc.id,
    data: doc.data(),
  }));
  const groupMembers = memberSnap.docs.map((doc) => ({
    id: doc.id,
    data: doc.data(),
  }));

  const messages = [];
  for (const dc of directChats) {
    const ms = await db
      .collection("messages")
      .where("directId", "==", dc.id)
      .get();
    ms.docs.forEach((doc) => messages.push({ id: doc.id, data: doc.data() }));
  }
  for (const gid of groupIds) {
    const ms = await db
      .collection("messages")
      .where("groupId", "==", gid)
      .get();
    ms.docs.forEach((doc) => messages.push({ id: doc.id, data: doc.data() }));
  }

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId: currentUser.uid,
    userProfile: userDoc.exists ? serializeForBackup(userDoc.data()) : {},
    directChats: serializeForBackup(directChats),
    groups: serializeForBackup(groups),
    groupMembers: serializeForBackup(groupMembers),
    messages: serializeForBackup(messages),
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chat-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Full backup exported");
}

async function importFullBackupFile(file) {
  if (!currentUser || !file) return;
  const text = await file.text();
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== "object") throw new Error("Invalid backup file");
  if (
    !confirm(
      "Import backup data now? Existing chats stay intact; backup data is merged.",
    )
  )
    return;

  const userProfile = deserializeFromBackup(raw.userProfile || {});
  if (userProfile && typeof userProfile === "object") {
    await db
      .collection("users")
      .doc(currentUser.uid)
      .set(
        {
          ...userProfile,
          uid: currentUser.uid,
          email: normalizeEmail(currentUser.email),
          isActive: true,
        },
        { merge: true },
      );
  }

  const directChats = deserializeFromBackup(raw.directChats || []);
  for (const item of directChats) {
    if (!item?.id || !item?.data) continue;
    await db
      .collection("directChats")
      .doc(item.id)
      .set(item.data, { merge: true });
  }

  const groups = deserializeFromBackup(raw.groups || []);
  for (const item of groups) {
    if (!item?.id || !item?.data) continue;
    await db.collection("groups").doc(item.id).set(item.data, { merge: true });
  }

  const groupMembers = deserializeFromBackup(raw.groupMembers || []);
  for (const item of groupMembers) {
    if (!item?.id || !item?.data) continue;
    const safeId =
      normalizeImportDocId(item.id) ||
      `gm_${Math.random().toString(36).slice(2, 10)}`;
    await db
      .collection("groupMembers")
      .doc(safeId)
      .set(item.data, { merge: true });
  }

  const messages = deserializeFromBackup(raw.messages || []);
  for (let i = 0; i < messages.length; i++) {
    const item = messages[i];
    if (!item?.data) continue;
    const backupId = normalizeImportDocId(item.id) || `msg_${i}`;
    const docId = `imp_${currentUser.uid}_${backupId}`;
    await db
      .collection("messages")
      .doc(docId)
      .set(
        {
          ...item.data,
          importedFromBackup: true,
          backupMessageId: item.id || "",
          importedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  }

  await loadAllUsers();
  loadCurrentChatList();
  if (currentChat) loadMessages();
  showToast("Backup imported");
}

async function clearMessagesForChat(chatId, chatType) {
  const query = db
    .collection("messages")
    .where(chatType === "direct" ? "directId" : "groupId", "==", chatId);
  const snapshot = await query.get();
  for (let index = 0; index < snapshot.docs.length; index += 400) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 400).forEach((doc) => {
      batch.update(doc.ref, {
        [`deletedFor.${currentUser.uid}`]: true,
        [`deletedForAt.${currentUser.uid}`]:
          firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

async function clearAllChats() {
  if (
    !currentUser ||
    !confirm(
      "Clear all message history from your account? This will not delete messages for other people.",
    )
  )
    return;
  const directSnapshot = await db
    .collection("directChats")
    .where("participants", "array-contains", currentUser.uid)
    .get();
  const directIds = new Set();
  directSnapshot.docs.forEach((doc) => {
    directIds.add(doc.id);
    (doc.data()?.aliasDirectIds || []).forEach((id) => id && directIds.add(id));
  });
  for (const directId of directIds)
    await clearMessagesForChat(directId, "direct");

  const memberSnapshot = await db
    .collection("groupMembers")
    .where("userId", "==", currentUser.uid)
    .get();
  const groupIds = new Set(
    memberSnapshot.docs
      .map((memberDoc) => memberDoc.data().groupId)
      .filter(Boolean),
  );
  for (const groupId of groupIds) await clearMessagesForChat(groupId, "group");

  resetChatPanel();
  loadCurrentChatList();
  showToast("Chat history cleared for you");
}

// ========================================
// CORE CONTROLLERS & APP INITIALIZATIONS
// ========================================

function switchTab(tab) {
  if (tab === "chats") tab = "all";
  currentViewTab = tab;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.add("active");

  // Add switching animation to active list
  document
    .querySelectorAll(".list")
    .forEach((l) => l.classList.add("tab-switching"));
  setTimeout(
    () =>
      document
        .querySelectorAll(".list")
        .forEach((l) => l.classList.remove("tab-switching")),
    250,
  );

  const chatsList = document.getElementById("chatsList");
  const groupsList = document.getElementById("groupsList");
  const broadcastsList = document.getElementById("broadcastsList");
  const statusList = document.getElementById("statusList");
  const communitiesList = document.getElementById("communitiesList");
  const statusActions = document.getElementById("statusActions");
  const groupActions = document.getElementById("groupActions");
  const broadcastActions = document.getElementById("broadcastActions");
  const communityActions = document.getElementById("communityActions");

  chatsList.style.display =
    tab === "groups" ||
    tab === "status" ||
    tab === "broadcasts" ||
    tab === "communities"
      ? "none"
      : "block";
  groupsList.style.display = tab === "groups" ? "block" : "none";
  if (broadcastsList)
    broadcastsList.style.display = tab === "broadcasts" ? "block" : "none";
  if (statusList)
    statusList.style.display = tab === "status" ? "block" : "none";
  if (communitiesList)
    communitiesList.style.display = tab === "communities" ? "block" : "none";
  if (groupActions)
    groupActions.style.display = tab === "groups" ? "flex" : "none";
  if (broadcastActions)
    broadcastActions.style.display = tab === "broadcasts" ? "flex" : "none";
  if (statusActions)
    statusActions.style.display = tab === "status" ? "flex" : "none";
  if (communityActions)
    communityActions.style.display = tab === "communities" ? "flex" : "none";

  if (tab === "groups") loadGroupsList();
  else if (tab === "broadcasts") loadBroadcastsList();
  else if (tab === "status") loadStatusList();
  else if (tab === "communities") loadCommunitiesList();
  else loadCurrentChatList();
}

function bindSearchInput() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  input.addEventListener("input", (e) => {
    searchUsersRealtime(e.target.value);
  });
}

function updateInChatSearch() {
  const term = (document.getElementById("inChatSearchInput")?.value || "")
    .trim()
    .toLowerCase();
  document
    .querySelectorAll(".message.search-hit, .message.search-current")
    .forEach((el) => {
      el.classList.remove("search-hit", "search-current");
    });
  currentSearchResults = [];
  currentSearchIndex = 0;
  if (!term) {
    document.getElementById("searchResultCount").textContent = "";
    return;
  }
  currentSearchResults = [
    ...document.querySelectorAll("#messagesArea .message"),
  ].filter((el) => el.textContent.toLowerCase().includes(term));
  currentSearchResults.forEach((el) => el.classList.add("search-hit"));
  focusCurrentSearchResult();
}

function focusCurrentSearchResult() {
  const count = currentSearchResults.length;
  const countEl = document.getElementById("searchResultCount");
  if (!count) {
    if (countEl) countEl.textContent = "0/0";
    return;
  }
  currentSearchResults.forEach((el) => el.classList.remove("search-current"));
  currentSearchIndex = (currentSearchIndex + count) % count;
  const item = currentSearchResults[currentSearchIndex];
  item.classList.add("search-current");
  item.scrollIntoView({ block: "center", behavior: "smooth" });
  if (countEl) countEl.textContent = `${currentSearchIndex + 1}/${count}`;
}

function toggleDarkMode() {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
}

function revealAuthenticatedApp() {
  document.body.classList.add("auth-ready");
}

async function runBootstrapStep(stepName, fn) {
  try {
    await fn();
    return true;
  } catch (error) {
    console.error(`Bootstrap step failed: ${stepName}`, error);
    return false;
  }
}

function getStoredAppLockPin() {
  try {
    return localStorage.getItem("teamChatAppLockPin") || "";
  } catch (_) {
    return "";
  }
}

function setStoredAppLockPin(pin) {
  try {
    localStorage.setItem("teamChatAppLockPin", pin);
  } catch (_) {}
}

function clearStoredAppLockPin() {
  try {
    localStorage.removeItem("teamChatAppLockPin");
  } catch (_) {}
}

function lockAppNowIfEnabled() {
  const pin = getStoredAppLockPin();
  if (!pin) return;
  appUnlockedForSession = false;
  const modal = document.getElementById("unlockModal");
  if (modal) modal.style.display = "flex";
}

function unlockAppAttempt() {
  const expected = getStoredAppLockPin();
  if (!expected) return;
  const input = document.getElementById("unlockPinInput");
  const value = (input?.value || "").trim();
  if (value !== expected) {
    showToast("Wrong PIN", "error");
    return;
  }
  appUnlockedForSession = true;
  if (input) input.value = "";
  const modal = document.getElementById("unlockModal");
  if (modal) modal.style.display = "none";
}

function showAppLockModal() {
  document.getElementById("appLockModal").style.display = "flex";
  const input = document.getElementById("appLockPinInput");
  if (input) input.value = "";
}

function saveAppLockPin() {
  const input = document.getElementById("appLockPinInput");
  const pin = (input?.value || "").trim();
  if (!/^\d{4}$/.test(pin)) {
    showToast("Enter exactly 4 digits", "error");
    return;
  }
  setStoredAppLockPin(pin);
  showToast("App lock enabled");
  document.getElementById("appLockModal").style.display = "none";
  lockAppNowIfEnabled();
}

function disableAppLock() {
  clearStoredAppLockPin();
  appUnlockedForSession = true;
  showToast("App lock disabled");
  document.getElementById("appLockModal").style.display = "none";
}

function redirectToLogin() {
  document.body.classList.remove("auth-ready");
  window.location.replace("login.html");
}

async function init() {
  await authPersistenceReady;
  const emojiButton = document.getElementById("emojiBtn");
  if (emojiButton) {
    emojiButton.textContent = "";
    emojiButton.setAttribute("aria-label", "Emoji");
  }
  initializeEmojiPicker();
  updateComposerActionState();
  applyA11yEnhancements();
  setupSystemBackNavigation();
  setupMobileBackGuard();
  setupActiveCallBackProtection();
  setupCallNotificationRefreshHooks();
  registerFcmTokenForCurrentUser({ force: false });

  bindSearchInput();
  loadBlockedWords();
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      redirectToLogin();
      return;
    }
    try {
      try {
        await user.reload();
        user = auth.currentUser || user;
      } catch (error) {
        console.warn("Could not refresh auth user:", error);
      }
      currentUser = user;
      currentSessionId = getOrCreateSessionId();
      revealAuthenticatedApp();
      requestNativeNotificationPermission();

      document.getElementById("userName").textContent =
        user.displayName || user.email.split("@")[0];
      const userRef = db.collection("users").doc(user.uid);
      await userRef.set(
        {
          uid: user.uid,
          email: normalizeEmail(user.email),
          displayName: user.displayName || user.email.split("@")[0],
          emailVerified: user.emailVerified === true,
          pendingVerification: user.emailVerified !== true,
          isActive: true,
          onlineStatus: "online",
          lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
          lastPresenceAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      const latestUserDoc = await userRef.get();
      const latestUserData = latestUserDoc.data() || {};
      const userAvatarEl = document.getElementById("userAvatar");
      if (userAvatarEl) {
        userAvatarEl.innerHTML = latestUserData.avatar
          ? `<img src="${latestUserData.avatar}" alt="User avatar">`
          : escapeHtml(
              getInitials(
                latestUserData.displayName || user.displayName || "",
                latestUserData.email || user.email || "",
              ),
            );
      }
      privacySettings = {
        ...privacySettings,
        ...(latestUserDoc.data()?.privacySettings || {}),
      };
      currentUserStatus = {
        preset: latestUserData.status?.preset || "available",
        emoji:
          latestUserData.status?.emoji ||
          STATUS_ICONS[latestUserData.status?.preset] ||
          "🟢",
        text:
          latestUserData.status?.text ||
          latestUserData.statusText ||
          STATUS_LABELS[latestUserData.status?.preset] ||
          "Available",
        expiry: latestUserData.status?.expiry || null,
      };
      updateSidebarStatus();
      await runBootstrapStep("reconnectSameEmailProfile", () =>
        reconnectSameEmailProfile(),
      );

      await runBootstrapStep("loadBlockedUsers", () => loadBlockedUsers());
      await runBootstrapStep("upsertCurrentSession", () =>
        upsertCurrentSession(),
      );
      startSessionHeartbeat();
      startPresenceHeartbeat();
      watchSessionRevocation();
      await runBootstrapStep("loadMutedChats", () => loadMutedChats());
      await runBootstrapStep("loadFavoriteChatIds", () =>
        loadFavoriteChatIds(),
      );
      await runBootstrapStep("loadPinnedChatIds", () => loadPinnedChatIds());
      await runBootstrapStep("loadUserStatus", () => loadUserStatus());
      await runBootstrapStep("loadChatFolders", () => loadChatFolders());
      await runBootstrapStep("loadQuickReplies", () => loadQuickReplies());
      await runBootstrapStep("loadAllUsers", () => loadAllUsers());
      await runBootstrapStep("getChatTags", () => getChatTags());
      await runBootstrapStep("loadWallpaperFromStorage", async () => {
        loadWallpaperFromStorage();
      });
      await runBootstrapStep("setupChatListListeners", async () => {
        setupChatListListeners();
      });
      await runBootstrapStep("setupRequestListeners", async () => {
        setupRequestListeners();
      });
      await runBootstrapStep("setupArchiveSection", async () => {
        setupArchiveSection();
      });
      await runBootstrapStep("listenForIncomingCalls", async () => {
        listenForIncomingCalls();
      });
      createBuiltInAnimatedPacks();
      startScheduledMessageWorker();
      startFailedQueueRetryWorker();
      processFailedMessageQueue().catch(() => {});
      switchTab("all");
      appUnlockedForSession = !getStoredAppLockPin();
      if (!appUnlockedForSession) lockAppNowIfEnabled();
    } catch (error) {
      console.error("Auth bootstrap failed:", error);
      revealAuthenticatedApp();
      switchTab("all");
      showToast("Session restored. Some data may load in a moment.", "error");
    }
  });

  // Attach Event Handlers
  // Broadcast event listeners
  document
    .getElementById("createCommunityBtn")
    ?.addEventListener("click", () => {
      document.getElementById("createCommunityModal").style.display = "flex";
    });
  document
    .querySelectorAll(".closeCreateCommunityModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("createCommunityModal").style.display =
            "none"),
      ),
    );
  document
    .getElementById("createBroadcastBtn")
    ?.addEventListener("click", () => {
      document.getElementById("createBroadcastModal").style.display = "flex";
    });
  document
    .getElementById("newBroadcastName")
    ?.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        document.getElementById("broadcastMemberSearch")?.focus();
    });
  document
    .getElementById("broadcastMemberSearch")
    ?.addEventListener("input", (e) =>
      renderBroadcastMemberOptions(e.target.value),
    );
  document.querySelectorAll(".closeBroadcastModal").forEach((btn) =>
    btn.addEventListener("click", () => {
      document.getElementById("createBroadcastModal").style.display = "none";
      broadcastSelectedMemberIds = new Set();
      document.getElementById("broadcastSelectedMembers").innerHTML = "";
    }),
  );
  document
    .getElementById("confirmBroadcastBtn")
    ?.addEventListener("click", async () => {
      const name = document.getElementById("newBroadcastName").value;
      const desc = document.getElementById("newBroadcastDescription").value;
      await createBroadcast(name, desc, [...broadcastSelectedMemberIds]);
    });

  document.getElementById("sendBtn")?.addEventListener("click", sendMessage);
  document.getElementById("messageInput")?.addEventListener("keydown", (e) => {
    if (handleMentionKeydown(e)) return;
    if (e.key === "Escape") hideMentionSuggestions();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  document.addEventListener("keydown", (e) => {
    const target = e.target;
    const inEditable =
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable);
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      document.getElementById("searchInput")?.focus();
      return;
    }

    if (mod && e.key.toLowerCase() === "f" && currentChat) {
      e.preventDefault();
      const searchBar = document.getElementById("inChatSearchBar");
      const inChatInput = document.getElementById("inChatSearchInput");
      if (searchBar) searchBar.style.display = "flex";
      inChatInput?.focus();
      return;
    }

    if (e.key === "Escape") {
      hideMentionSuggestions();
      if (
        document.getElementById("inChatSearchBar")?.style.display === "flex"
      ) {
        document.getElementById("closeSearchBtn")?.click();
      }
      const archivedMenu = document.getElementById("archivedRowMenu");
      if (archivedMenu?.style.display === "block") hideArchivedRowMenu();
      const chatMenu = document.getElementById("chatContextMenu");
      if (chatMenu?.style.display === "block") chatMenu.style.display = "none";
      removeMessageContextMenu();
      closeTopVisibleModal();
      if (inEditable) return;
    }
  });
  document.getElementById("messageInput")?.addEventListener("input", () => {
    resizeMessageComposer();
    saveCurrentDraft();
    updateMentionSuggestions();
    updateComposerActionState();
    sendTypingIndicator();
  });
  document.addEventListener("click", (event) => {
    if (
      !event.target.closest("#mentionSuggestions") &&
      event.target.id !== "messageInput"
    )
      hideMentionSuggestions();
  });
  window.addEventListener("beforeunload", saveCurrentDraft);
  window.addEventListener("online", () => {
    showToast("Back online");
    processFailedMessageQueue().catch(() => {});
    loadCurrentChatList();
    loadArchivedChats();
  });
  window.addEventListener("offline", () => {
    showToast("You are offline. Messages will retry when connected.", "error");
  });
  (function initInstallApp() {
    let deferredPrompt = null;
    const btn = document.getElementById("installAppBtn");
    if (!btn) return;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      btn.style.display = "";
    });
    window.addEventListener("appinstalled", () => {
      btn.style.display = "none";
      deferredPrompt = null;
    });
    window.handleInstallApp = async function handleInstallApp() {
      if (!deferredPrompt) {
        showToast("App already installed or not available", "error");
        return;
      }
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") showToast("App installed!");
      deferredPrompt = null;
      btn.style.display = "none";
    };
  })();
  document.getElementById("cancelReplyBtn")?.addEventListener("click", () => {
    currentReplyTo = null;
    document.getElementById("replyPreviewBar").style.display = "none";
  });
  document.getElementById("searchChatBtn")?.addEventListener("click", () => {
    document.getElementById("inChatSearchBar").style.display = "flex";
    document.getElementById("inChatSearchInput")?.focus();
  });
  document
    .getElementById("inChatSearchInput")
    ?.addEventListener("input", updateInChatSearch);
  document.getElementById("prevSearchBtn")?.addEventListener("click", () => {
    currentSearchIndex -= 1;
    focusCurrentSearchResult();
  });
  document.getElementById("nextSearchBtn")?.addEventListener("click", () => {
    currentSearchIndex += 1;
    focusCurrentSearchResult();
  });
  document.getElementById("closeSearchBtn")?.addEventListener("click", () => {
    document.getElementById("inChatSearchBar").style.display = "none";
    document.getElementById("inChatSearchInput").value = "";
    updateInChatSearch();
  });
  document
    .getElementById("pollBtn")
    ?.addEventListener("click", () =>
      sendPoll().catch(() => showToast("Could not create poll", "error")),
    );
  document
    .getElementById("scheduleMsgBtn")
    ?.addEventListener("click", openScheduleMessageModal);
  document
    .getElementById("confirmScheduleMsgBtn")
    ?.addEventListener("click", () =>
      scheduleCurrentMessage().catch(() =>
        showToast("Could not schedule message", "error"),
      ),
    );
  document
    .querySelectorAll(".closeScheduleModal")
    .forEach((btn) => btn.addEventListener("click", closeScheduleMessageModal));
  document.getElementById("videoMsgBtn")?.addEventListener("click", () => {
    if (isVideoRecording) stopVideoRecording();
    else startVideoRecording();
  });
  document
    .getElementById("contactCardBtn")
    ?.addEventListener("click", openContactPickerModal);
  document.getElementById("eventBtn")?.addEventListener("click", () => {
    document.getElementById("eventModal").style.display = "flex";
    document.getElementById("eventDate").valueAsDate = new Date();
  });
  document.getElementById("listBtn")?.addEventListener("click", () => {
    document.getElementById("createListModal").style.display = "flex";
  });
  document.getElementById("confirmEventBtn")?.addEventListener("click", () => {
    const title = document.getElementById("eventTitle").value.trim();
    const date = document.getElementById("eventDate").value;
    const time = document.getElementById("eventTime").value;
    const location = document.getElementById("eventLocation").value.trim();
    const description = document
      .getElementById("eventDescription")
      .value.trim();
    if (!title) {
      showToast("Event title required", "error");
      return;
    }
    if (!date) {
      showToast("Event date required", "error");
      return;
    }
    sendEventMessage({ title, date, time, description, location });
  });
  document
    .querySelectorAll(".closeEventModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () => (document.getElementById("eventModal").style.display = "none"),
      ),
    );
  document.getElementById("confirmListBtn")?.addEventListener("click", () => {
    const inputs = document.querySelectorAll(".list-item-text");
    const items = [];
    inputs.forEach((input) => {
      const text = input.value.trim();
      if (text) items.push({ text });
    });
    if (items.length < 1) {
      showToast("Add at least one item", "error");
      return;
    }
    sendListMessage(items);
  });
  document.getElementById("addListItemBtn")?.addEventListener("click", () => {
    const container = document.getElementById("listItemsContainer");
    const row = document.createElement("div");
    row.className = "list-item-input-row";
    row.style.cssText = "display:flex;gap:8px;margin-bottom:8px;";
    row.innerHTML =
      '<input type="text" class="list-item-text" placeholder="Item ' +
      (container.children.length + 1) +
      '" style="flex:1;padding:10px;border:1px solid #e2e8f0;border-radius:12px;">';
    container.appendChild(row);
  });
  document
    .querySelectorAll(".closeCreateListModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("createListModal").style.display = "none"),
      ),
    );
  document
    .querySelectorAll(".closeContactPickerModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("contactPickerModal").style.display =
            "none"),
      ),
    );
  document
    .getElementById("contactPickerSearch")
    ?.addEventListener("input", (e) => renderContactPickerList(e.target.value));
  document
    .getElementById("contactPickerModal")
    ?.addEventListener("click", (e) => {
      if (e.target === document.getElementById("contactPickerModal"))
        document.getElementById("contactPickerModal").style.display = "none";
    });
  document
    .getElementById("confirmJoinByLinkBtn")
    ?.addEventListener("click", async () => {
      const code = document.getElementById("joinByLinkInput").value.trim();
      await joinGroupByInvite(code);
      document.getElementById("joinGroupByLinkModal").style.display = "none";
    });
  document
    .querySelectorAll(".closeJoinByLinkModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("joinGroupByLinkModal").style.display =
            "none"),
      ),
    );
  document
    .getElementById("saveChatTagBtn")
    ?.addEventListener("click", async () => {
      if (!currentChat || currentChatType !== "direct") return;
      const label = document.getElementById("chatTagLabel").value.trim();
      const selectedColor = document.querySelector(
        ".tag-color-option.selected",
      );
      if (!label || !selectedColor) {
        showToast("Select a label and color", "error");
        return;
      }
      await addChatTag(currentChat.id, label, selectedColor.dataset.color);
      document.getElementById("chatTagModal").style.display = "none";
    });
  document
    .getElementById("removeChatTagBtn")
    ?.addEventListener("click", async () => {
      if (!currentChat || currentChatType !== "direct") return;
      await removeChatTag(currentChat.id);
      document.getElementById("chatTagModal").style.display = "none";
    });
  document
    .querySelectorAll(".closeChatTagModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () => (document.getElementById("chatTagModal").style.display = "none"),
      ),
    );
  document.querySelectorAll(".tag-color-option").forEach((btn) =>
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tag-color-option")
        .forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
    }),
  );
  document.getElementById("screenShareBtn")?.addEventListener("click", () => {
    if (isScreenSharing) stopScreenShare();
    else startScreenShare();
  });
  document.getElementById("pipBtn")?.addEventListener("click", () => {
    if (isPipActive) exitPipMode();
    else enterPipMode();
  });
  const voiceButton = document.getElementById("voiceMsgBtn");
  voiceButton?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startVoiceRecording();
  });
  voiceButton?.addEventListener("pointerup", (event) => {
    event.preventDefault();
    stopVoiceRecording();
  });
  voiceButton?.addEventListener("pointerleave", () => {
    if (isRecording) stopVoiceRecording();
  });
  document
    .getElementById("cancelRecordingBtn")
    ?.addEventListener("click", cancelVoiceRecording);
  document.getElementById("emojiBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleEmojiSheet();
  });
  document
    .querySelectorAll(".tab")
    .forEach((t) =>
      t.addEventListener("click", () => switchTab(t.dataset.tab)),
    );
  document
    .getElementById("profileBtn")
    ?.addEventListener("click", showProfileModal);
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await markCurrentSessionInactive();
    await auth.signOut();
    window.location.replace("login.html");
  });
  document
    .getElementById("voiceCallBtn")
    ?.addEventListener("click", () => startCall("voice"));
  document
    .getElementById("videoCallBtn")
    ?.addEventListener("click", () => startCall("video"));
  document.getElementById("acceptCallBtn")?.addEventListener("click", () => {
    if (activeCall?.groupCall) acceptIncomingGroupCall();
    else acceptIncomingCall();
  });
  if (window.Capacitor?.Plugins?.App && !window.__nativeCallOpenHandlerBound) {
    window.__nativeCallOpenHandlerBound = true;

    window.Capacitor.Plugins.App.addListener("appUrlOpen", async (event) => {
      const url = event?.url || "";
      const match = url.match(/[?&]callId=([^&]+)/);
      if (match?.[1]) {
        await autoAcceptNativeCall(decodeURIComponent(match[1]));
      }
    });

    window.Capacitor.Plugins.App.addListener(
      "appStateChange",
      async (state) => {
        const pendingCallId = localStorage.getItem("pendingNativeCallId");
        if (pendingCallId) {
          localStorage.removeItem("pendingNativeCallId");
          await autoAcceptNativeCall(pendingCallId);
        }
        if (
          state?.isActive !== false &&
          document.getElementById("permissionsModal")?.style.display === "flex"
        ) {
          await refreshPermissionsModal().catch(() => {});
        }
      },
    );
  }
  document.getElementById("rejectCallBtn")?.addEventListener("click", () => {
    if (activeCall?.groupCall) endGroupCall("rejected");
    else endActiveCall("rejected");
  });
  document.getElementById("endCallBtn")?.addEventListener("click", () => {
    if (activeCall?.groupCall) endGroupCall("ended");
    else endActiveCall("ended");
  });
  document
    .getElementById("closeCallBtn")
    ?.addEventListener("click", handleCallCloseAction);
  document
    .getElementById("darkModeBtn")
    ?.addEventListener("click", toggleDarkMode);
  document
    .getElementById("installAppBtn")
    ?.addEventListener("click", handleInstallApp);

  document
    .querySelectorAll(".closeProfileModal")
    .forEach((b) =>
      b.addEventListener(
        "click",
        () => (document.getElementById("profileModal").style.display = "none"),
      ),
    );
  document
    .getElementById("fileInput")
    ?.addEventListener("change", (e) => {
      handleFileUpload(e.target.files[0]);
      e.target.removeAttribute("capture");
    });
  document.getElementById("attachBtn")?.addEventListener("click", async (e) => {
    e.preventDefault();
    toggleAttachmentSheet();
  });
  document.getElementById("attachmentSheet")?.addEventListener("click", (e) => {
    if (e.target.closest(".attachment-sheet-item")) toggleAttachmentSheet(false);
  });
  document.getElementById("sheetGalleryBtn")?.addEventListener("click", async () => {
    if (isNativeAndroidApp) {
      const hasMedia = await ensureNativePermission("media");
      if (!hasMedia) return;
    }
    triggerMediaPicker();
  });
  document
    .getElementById("sheetDocumentBtn")
    ?.addEventListener("click", triggerDocumentPicker);
  document
    .getElementById("sheetCameraBtn")
    ?.addEventListener("click", triggerCameraPicker);
  document
    .getElementById("cameraMsgBtn")
    ?.addEventListener("click", triggerCameraPicker);
  document.getElementById("manageFoldersBtn")?.addEventListener("click", () => {
    renderManageFoldersModal();
    document.getElementById("manageFoldersModal").style.display = "flex";
  });
  document
    .querySelectorAll(".closeManageFoldersModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("manageFoldersModal").style.display =
            "none"),
      ),
    );
  document
    .getElementById("blockedUsersBtn")
    ?.addEventListener("click", showBlockedUsersModal);
  document
    .getElementById("quickRepliesSettingsBtn")
    ?.addEventListener("click", showQuickRepliesModal);
  document
    .getElementById("starredMessagesBtn")
    ?.addEventListener("click", showStarredMessagesModal);
  document
    .getElementById("scheduledMessagesBtn")
    ?.addEventListener("click", showScheduledMessagesModal);
  document
    .getElementById("activeSessionsBtn")
    ?.addEventListener("click", showSessionsModal);
  document
    .getElementById("appPermissionsBtn")
    ?.addEventListener("click", () =>
      showPermissionsModal().catch(() =>
        showToast("Could not open permissions", "error"),
      ),
    );
  document
    .querySelectorAll(".closePermissionsModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("permissionsModal").style.display = "none"),
      ),
    );
  document.querySelectorAll("[data-request-permission]").forEach((btn) => {
    btn.addEventListener("click", () =>
      requestAppPermission(btn.dataset.requestPermission),
    );
  });
  document
    .getElementById("revokePermissionsBtn")
    ?.addEventListener("click", showPermissionRevokeGuide);
  document
    .querySelectorAll(".closeRevokePermissionsModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById(
            "revokePermissionsGuideModal",
          ).style.display = "none"),
      ),
    );
  document
    .getElementById("nativeSettingsBtn")
    ?.addEventListener("click", () => {
      openNativeAppSettings().catch(() =>
        showToast("Could not open settings", "error"),
      );
      document.getElementById("revokePermissionsGuideModal").style.display =
        "none";
    });

  document
    .getElementById("confirmAddParticipantBtn")
    ?.addEventListener("click", () =>
      processAddParticipantToCall().catch((e) => console.error(e)),
    );
  document
    .querySelectorAll(".closeAddParticipantModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("addCallParticipantModal").style.display =
            "none"),
      ),
    );
  document
    .getElementById("appLockSettingsBtn")
    ?.addEventListener("click", showAppLockModal);
  document
    .getElementById("saveAppLockPinBtn")
    ?.addEventListener("click", saveAppLockPin);
  document
    .getElementById("disableAppLockBtn")
    ?.addEventListener("click", disableAppLock);
  document
    .getElementById("unlockAppBtn")
    ?.addEventListener("click", unlockAppAttempt);
  document
    .querySelectorAll(".closeAppLockModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () => (document.getElementById("appLockModal").style.display = "none"),
      ),
    );
  document
    .getElementById("logoutOtherSessionsBtn")
    ?.addEventListener("click", () =>
      logoutOtherSessions().catch(() =>
        showToast("Could not log out other sessions", "error"),
      ),
    );
  document
    .querySelectorAll(".closeStarredModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("starredMessagesModal").style.display =
            "none"),
      ),
    );
  document
    .querySelectorAll(".closeScheduledMessagesModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("scheduledMessagesModal").style.display =
            "none"),
      ),
    );
  document
    .querySelectorAll(".closeSessionsModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () => (document.getElementById("sessionsModal").style.display = "none"),
      ),
    );
  document
    .getElementById("unlockPinInput")
    ?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") unlockAppAttempt();
    });
  document.addEventListener("visibilitychange", () => {
    if (currentUser) {
      setCurrentUserPresence(document.visibilityState !== "hidden").catch(
        () => {},
      );
    }
    if (document.visibilityState === "visible" && getStoredAppLockPin()) {
      lockAppNowIfEnabled();
    }
    if (
      document.visibilityState === "hidden" &&
      currentChat &&
      currentChat.id
    ) {
      const chatId = currentChat.id;
      const chatType = currentChatType;
      setTimeout(async () => {
        try {
          let warnEnabled = false;
          if (chatType === "direct") {
            const doc = await db.collection("directChats").doc(chatId).get();
            warnEnabled = doc.data()?.screenshotWarningEnabled === true;
          } else if (chatType === "group") {
            const doc = await db.collection("groups").doc(chatId).get();
            warnEnabled = doc.data()?.screenshotWarningEnabled === true;
          }
          if (warnEnabled) notifyScreenshotAttempt(chatId);
        } catch (e) {}
      }, 500);
    }
  });
  window.addEventListener("blur", () => {
    if (currentChat && currentChat.id) {
      const chatId = currentChat.id;
      const chatType = currentChatType;
      setTimeout(async () => {
        try {
          let warnEnabled = false;
          if (chatType === "direct") {
            const doc = await db.collection("directChats").doc(chatId).get();
            warnEnabled = doc.data()?.screenshotWarningEnabled === true;
          } else if (chatType === "group") {
            const doc = await db.collection("groups").doc(chatId).get();
            warnEnabled = doc.data()?.screenshotWarningEnabled === true;
          }
          if (warnEnabled) notifyScreenshotAttempt(chatId);
        } catch (e) {}
      }, 500);
    }
  });
  document
    .getElementById("addQuickReplyBtn")
    ?.addEventListener("click", async () => {
      const input = document.getElementById("newQuickReplyText");
      const text = input?.value?.trim();
      if (!text) return;
      input.value = "";
      await addQuickReply(text);
    });
  document
    .querySelectorAll(".closeBlockedModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () => (document.getElementById("blockedModal").style.display = "none"),
      ),
    );
  document
    .querySelectorAll(".closeQuickRepliesModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("quickRepliesModal").style.display = "none"),
      ),
    );
  document
    .getElementById("dataUsageBtn")
    ?.addEventListener("click", showDataUsageModal);
  document
    .getElementById("storageManagerBtn")
    ?.addEventListener("click", showStorageManager);
  document
    .getElementById("closeFilePreview")
    ?.addEventListener(
      "click",
      () =>
        (document.getElementById("filePreviewModal").style.display = "none"),
    );
  document
    .getElementById("closeDataUsage")
    ?.addEventListener(
      "click",
      () => (document.getElementById("dataUsageModal").style.display = "none"),
    );
  document
    .getElementById("closeStorageManager")
    ?.addEventListener(
      "click",
      () =>
        (document.getElementById("storageManagerModal").style.display = "none"),
    );
  document
    .getElementById("refreshStorageBreakdown")
    ?.addEventListener("click", showStorageManager);
  document.getElementById("viewOnceToggle")?.addEventListener("change", (e) => {
    document.getElementById("viewOnceLabel").textContent = e.target.checked
      ? "View Once: ON"
      : "View Once: OFF";
  });
  document
    .getElementById("dateSearchInput")
    ?.addEventListener("change", (e) => {
      searchMessagesByDate(e.target.value);
    });
  document.getElementById("clearDateSearch")?.addEventListener("click", () => {
    document.getElementById("dateSearchInput").value = "";
    searchMessagesByDate("");
  });
  document
    .getElementById("exportChatsBtn")
    ?.addEventListener("click", exportCurrentChat);
  document
    .getElementById("exportBackupBtn")
    ?.addEventListener("click", () =>
      exportFullBackup().catch(() =>
        showToast("Backup export failed", "error"),
      ),
    );
  document
    .getElementById("importBackupBtn")
    ?.addEventListener("click", () =>
      document.getElementById("backupImportInput")?.click(),
    );
  document
    .getElementById("backupImportInput")
    ?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await importFullBackupFile(file);
      } catch (error) {
        console.error("Backup import failed:", error);
        showToast("Backup import failed", "error");
      } finally {
        event.target.value = "";
      }
    });
  document
    .getElementById("clearAllChatsBtn")
    ?.addEventListener("click", clearAllChats);
  document
    .getElementById("changeNameBtn")
    ?.addEventListener("click", async () => {
      const name = prompt(
        "Enter display name",
        document.getElementById("profileName")?.textContent || "",
      );
      if (!name || !name.trim()) return;
      await updateDisplayName(name.trim());
      await currentUser
        .updateProfile({ displayName: name.trim() })
        .catch(() => {});
      document.getElementById("profileName").textContent = name.trim();
      document.getElementById("userName").textContent = name.trim();
      const userAvatarEl = document.getElementById("userAvatar");
      if (userAvatarEl && !userAvatarEl.querySelector("img")) {
        userAvatarEl.textContent = getInitials(
          name.trim(),
          currentUser.email || "",
        );
      }
      const profileAvatarEl = document.getElementById("profileAvatar");
      if (profileAvatarEl && !profileAvatarEl.querySelector("img")) {
        profileAvatarEl.textContent = getInitials(
          name.trim(),
          currentUser.email || "",
        );
      }
    });
  document.getElementById("changeAvatarBtn")?.addEventListener("click", () => {
    notifyAvatarUploadPolicy();
    document.getElementById("avatarUploadInput")?.click();
  });
  document
    .getElementById("avatarUploadInput")
    ?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!validateAvatarImageFile(file, "Profile photo")) {
        event.target.value = "";
        return;
      }
      try {
        const url = await uploadToCloudinary(file);
        await Promise.all([
          db.collection("users").doc(currentUser.uid).update({ avatar: url }),
          currentUser.updateProfile({ photoURL: url }).catch(() => {}),
        ]);
        const markup = `<img src="${url}" alt="Profile avatar">`;
        document.getElementById("profileAvatar").innerHTML = markup;
        showToast("Avatar updated");
      } catch (err) {
        showToast("Avatar upload failed", "error");
      } finally {
        event.target.value = "";
      }
    });
  document
    .getElementById("changeEmailBtn")
    ?.addEventListener("click", changeEmail);
  document
    .getElementById("changePhoneBtn")
    ?.addEventListener("click", changePhoneNumber);
  document
    .getElementById("deactivateAccountBtn")
    ?.addEventListener("click", deactivateAccount);
  document
    .getElementById("callNetworkSettingsBtn")
    ?.addEventListener("click", updateTurnServerSettings);
  document
    .getElementById("profileStatusText")
    ?.addEventListener("change", (event) => {
      const txt = event.target.value.trim();
      document
        .querySelectorAll(".status-preset")
        .forEach((el) => el.classList.remove("active"));
      document
        .querySelector('.status-preset[data-preset="custom"]')
        ?.classList.add("active");
      if (txt) updateStatusText(txt);
    });
  document.querySelectorAll(".status-preset").forEach((el) => {
    el.addEventListener("click", async () => {
      document
        .querySelectorAll(".status-preset")
        .forEach((e) => e.classList.remove("active"));
      el.classList.add("active");
      const preset = el.dataset.preset;
      const emoji = el.dataset.emoji || "🟢";
      const textInput = document.getElementById("profileStatusText");
      if (preset === "custom") {
        textInput.focus();
        return;
      }
      const timerVal =
        parseInt(document.getElementById("statusTimer").value) || null;
      const expiry = timerVal
        ? new Date(Date.now() + timerVal).toISOString()
        : null;
      const label = el.textContent.trim();
      textInput.value = label;
      await updateUserStatus({ preset, emoji, text: label, expiry });
    });
  });
  document
    .getElementById("statusTimer")
    ?.addEventListener("change", async () => {
      const activePreset = document.querySelector(".status-preset.active");
      if (!activePreset || activePreset.dataset.preset === "custom") return;
      const timerVal =
        parseInt(document.getElementById("statusTimer").value) || null;
      const expiry = timerVal
        ? new Date(Date.now() + timerVal).toISOString()
        : null;
      await updateUserStatus({
        preset: activePreset.dataset.preset,
        emoji: activePreset.dataset.emoji,
        text: activePreset.textContent.trim(),
        expiry,
      });
    });
  ["hideReadReceipts", "hideTypingIndicator", "hideLastSeen"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", async (event) => {
      privacySettings[id] = event.target.checked;
      await updatePrivacySettings();
      showToast("Privacy updated");
    });
  });
  document.getElementById("createStatusBtn")?.addEventListener("click", () => {
    document.getElementById("createStatusModal").style.display = "flex";
  });
  document
    .querySelectorAll(".closeStatusModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("createStatusModal").style.display = "none"),
      ),
    );
  document
    .querySelectorAll(".closeStatusViewer")
    .forEach((btn) => btn.addEventListener("click", closeStatusViewer));
  document
    .getElementById("statusPrevBtn")
    ?.addEventListener("click", () => moveStatusViewer(-1));
  document
    .getElementById("statusNextBtn")
    ?.addEventListener("click", () => moveStatusViewer(1));
  document
    .getElementById("statusViewerBody")
    ?.addEventListener("click", (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const isLeft = event.clientX - rect.left < rect.width / 2;
      moveStatusViewer(isLeft ? -1 : 1).catch(() => {});
    });
  document
    .getElementById("publishStatusBtn")
    ?.addEventListener("click", () =>
      publishStatus().catch(() =>
        showToast("Could not publish status", "error"),
      ),
    );
  document
    .getElementById("statusImageBtn")
    ?.addEventListener("click", () =>
      document.getElementById("statusImageInput").click(),
    );
  document
    .getElementById("statusImageInput")
    ?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const url = await uploadToCloudinary(file);
        statusImageAttachment = {
          type: "image",
          url,
          filename: file.name,
          size: file.size,
        };
        const preview = document.getElementById("statusImagePreview");
        preview.innerHTML = `<img src="${url}" alt="">`;
        preview.style.display = "block";
      } catch (error) {
        showToast("Status image upload failed", "error");
      } finally {
        event.target.value = "";
      }
    });
  document.querySelectorAll(".closeForwardModal").forEach((btn) =>
    btn.addEventListener("click", () => {
      currentForwardMessage = null;
      currentForwardSelectionKeys = new Set();
      currentForwardSelectionMap = new Map();
      document.getElementById("forwardModal").style.display = "none";
    }),
  );
  document
    .getElementById("forwardSearch")
    ?.addEventListener("input", (event) =>
      renderForwardChats(event.target.value),
    );
  document
    .getElementById("forwardSelectedBtn")
    ?.addEventListener("click", () =>
      forwardSelectedMessages().catch(() =>
        showToast("Forward failed", "error"),
      ),
    );

  // Setup Modals
  const createGroupModal = document.getElementById("createGroupModal");
  document.getElementById("createGroupBtn")?.addEventListener("click", () => {
    createGroupModal.style.display = "flex";
  });
  document
    .querySelectorAll(".closeCreateModal, .cancelGroupBtn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        createGroupModal.style.display = "none";
      });
    });
  document
    .querySelector(".confirmGroupBtn")
    ?.addEventListener("click", async () => {
      const groupName = document.getElementById("newGroupName").value;
      const members = document.getElementById("newGroupMembers").value;
      if (groupName.trim()) {
        await createGroup(groupName, members);
        createGroupModal.style.display = "none";
      }
    });
  const joinGroupModal = document.getElementById("joinGroupModal");
  document.getElementById("showJoinGroupBtn")?.addEventListener("click", () => {
    joinGroupModal.style.display = "flex";
  });
  document
    .getElementById("showJoinByLinkBtn")
    ?.addEventListener("click", () => {
      document.getElementById("joinGroupByLinkModal").style.display = "flex";
    });
  document.querySelectorAll(".closeJoinModal").forEach((btn) =>
    btn.addEventListener("click", () => {
      joinGroupModal.style.display = "none";
    }),
  );
  document
    .querySelector(".confirmJoinBtn")
    ?.addEventListener("click", async () => {
      await joinGroup(
        document.getElementById("joinGroupCodeInput")?.value || "",
      );
      joinGroupModal.style.display = "none";
    });
  document
    .getElementById("groupInfoBtn")
    ?.addEventListener("click", showGroupInfo);
  document
    .querySelectorAll(".closeGroupInfoModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("groupInfoModal").style.display = "none"),
      ),
    );
  document
    .getElementById("copyGroupCodeBtn")
    ?.addEventListener("click", () =>
      copyToClipboard(
        document.getElementById("groupCodeDisplay")?.textContent || "",
      ),
    );
  document
    .getElementById("addMemberBtn")
    ?.addEventListener("click", async () => {
      await addMemberToGroup(
        document.getElementById("addMemberEmail")?.value || "",
      );
      document.getElementById("addMemberEmail").value = "";
      showGroupInfo();
    });
  document
    .getElementById("leaveGroupBtn")
    ?.addEventListener("click", leaveGroup);
  document
    .getElementById("deleteGroupBtn")
    ?.addEventListener("click", deleteGroup);
  document
    .getElementById("editGroupNameInput")
    ?.addEventListener("change", (event) =>
      updateGroupName(event.target.value),
    );
  document.getElementById("groupAvatarLarge")?.addEventListener("click", () => {
    notifyAvatarUploadPolicy();
    document.getElementById("groupIconInput")?.click();
  });
  document
    .getElementById("groupIconInput")
    ?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file)
        updateGroupIcon(file).catch(() =>
          showToast("Group icon upload failed", "error"),
        );
      event.target.value = "";
    });
  document
    .getElementById("groupAdminsOnlySend")
    ?.addEventListener("change", async (event) => {
      if (!currentGroup || !isCurrentUserGroupAdmin()) {
        event.target.checked = !!currentGroup?.onlyAdminsCanSend;
        showToast("Only admins can change group permissions", "error");
        return;
      }
      await db
        .collection("groups")
        .doc(currentGroup.id)
        .update({ onlyAdminsCanSend: event.target.checked });
      currentGroup.onlyAdminsCanSend = event.target.checked;
      showToast("Group permissions updated");
    });
  document
    .getElementById("groupAdminsOnlyEdit")
    ?.addEventListener("change", async (event) => {
      if (!currentGroup || !isCurrentUserGroupAdmin()) {
        event.target.checked = currentGroup?.onlyAdminsCanEdit !== false;
        showToast("Only admins can change group permissions", "error");
        return;
      }
      await db
        .collection("groups")
        .doc(currentGroup.id)
        .update({ onlyAdminsCanEdit: event.target.checked });
      currentGroup.onlyAdminsCanEdit = event.target.checked;
      showToast("Group permissions updated");
    });
  document
    .getElementById("chatInfoDisappearingSelect")
    ?.addEventListener("change", async (event) => {
      if (!currentChat || currentChatType !== "direct") return;
      const secs = parseInt(event.target.value, 10) || 0;
      await db
        .collection("directChats")
        .doc(currentChat.id)
        .set({ disappearAfterSecs: secs }, { merge: true });
      currentChat.disappearAfterSecs = secs;
      showToast(
        secs > 0
          ? `Messages will disappear after ${event.target.options[event.target.selectedIndex].text}`
          : "Disappearing messages off",
      );
      loadMessages();
    });
  document
    .getElementById("groupEncryptionToggle")
    ?.addEventListener("change", async (e) => {
      if (!currentGroup || !isCurrentUserGroupAdmin()) {
        e.target.checked = currentGroup?.encryptionEnabled === true;
        showToast("Only admins can change group encryption", "error");
        return;
      }
      try {
        await db
          .collection("groups")
          .doc(currentGroup.id)
          .update({ encryptionEnabled: e.target.checked });
        if (currentChat?.id === currentGroup.id)
          updateEncryptionBadge(currentGroup.id, "group");
        showToast(
          e.target.checked ? "Encryption enabled" : "Encryption disabled",
        );
      } catch (err) {
        showToast("Failed to update encryption setting", "error");
      }
    });
  document
    .getElementById("screenshotWarningToggle")
    ?.addEventListener("change", async (e) => {
      if (!currentChat) return;
      try {
        if (currentChatType === "direct") {
          await db
            .collection("directChats")
            .doc(currentChat.id)
            .update({ screenshotWarningEnabled: e.target.checked });
        } else if (currentChatType === "group") {
          await db
            .collection("groups")
            .doc(currentChat.id)
            .update({ screenshotWarningEnabled: e.target.checked });
        }
        showToast(
          e.target.checked
            ? "Screenshot warning enabled"
            : "Screenshot warning disabled",
        );
      } catch (err) {
        showToast("Failed to update screenshot warning", "error");
      }
    });
  document
    .getElementById("groupInfoDisappearingSelect")
    ?.addEventListener("change", async (event) => {
      if (!currentGroup || !isCurrentUserGroupAdmin()) {
        event.target.value = String(currentGroup?.disappearAfterSecs || 0);
        showToast("Only admins can change disappearing messages", "error");
        return;
      }
      const secs = parseInt(event.target.value, 10) || 0;
      await db
        .collection("groups")
        .doc(currentGroup.id)
        .set({ disappearAfterSecs: secs }, { merge: true });
      currentGroup.disappearAfterSecs = secs;
      showToast(
        secs > 0
          ? `Messages disappear after ${event.target.options[event.target.selectedIndex].text}`
          : "Disappearing messages off",
      );
      loadMessages();
    });
  document
    .getElementById("groupMembersList")
    ?.addEventListener("click", (event) => {
      const adminBtn = event.target.closest(".make-admin-btn");
      const removeAdminBtn = event.target.closest(".remove-admin-btn");
      const removeBtn = event.target.closest(".remove-member-btn");
      if (adminBtn)
        makeAdmin(currentGroup.id, adminBtn.dataset.id, adminBtn.dataset.name);
      if (removeAdminBtn)
        removeAdmin(
          currentGroup.id,
          removeAdminBtn.dataset.id,
          removeAdminBtn.dataset.name,
        );
      if (removeBtn)
        removeMember(
          currentGroup.id,
          removeBtn.dataset.id,
          removeBtn.dataset.name,
        );
    });
  document
    .getElementById("chatHeaderInfo")
    ?.addEventListener("click", showChatInfo);
  document.getElementById("chatInfoMenuItem")?.addEventListener("click", () => {
    document.getElementById("chatContextMenu").style.display = "none";
    showChatInfo();
  });
  document
    .querySelectorAll(".closeChatInfoModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () => (document.getElementById("chatInfoModal").style.display = "none"),
      ),
    );
  document.querySelectorAll(".shared-tab").forEach((tabBtn) =>
    tabBtn.addEventListener("click", () => {
      document
        .querySelectorAll(".shared-tab")
        .forEach((btn) => btn.classList.remove("active"));
      tabBtn.classList.add("active");
      renderSharedContent(tabBtn.dataset.sharedTab);
    }),
  );
  document.querySelectorAll(".group-shared-tab").forEach((tabBtn) =>
    tabBtn.addEventListener("click", () => {
      document
        .querySelectorAll(".group-shared-tab")
        .forEach((btn) => btn.classList.remove("active"));
      tabBtn.classList.add("active");
      renderSharedContent(tabBtn.dataset.groupSharedTab, "groupSharedContent");
    }),
  );
  document.getElementById("chatInfoNotifBtn")?.addEventListener("click", () => {
    if (!currentChat) return;
    openNotifSettings(
      currentChat.id,
      currentChatType,
      currentChat.name || currentChat.displayName || "Chat",
    );
  });
  document
    .getElementById("chatInfoWallpaperBtn")
    ?.addEventListener("click", () => openWallpaperModal("current"));
  document.getElementById("chatInfoTagBtn")?.addEventListener("click", () => {
    if (!currentChat || currentChatType !== "direct") {
      showToast("Tags available for direct chats only", "error");
      return;
    }
    const modal = document.getElementById("chatTagModal");
    const existingTag = chatTags[currentChat.id];
    document.getElementById("chatTagLabel").value = existingTag
      ? existingTag.label
      : "";
    document.querySelectorAll(".tag-color-option").forEach((b) => {
      b.classList.toggle(
        "selected",
        existingTag && b.dataset.color === existingTag.color,
      );
    });
    document.getElementById("removeChatTagBtn").style.display = existingTag
      ? "inline-flex"
      : "none";
    modal.style.display = "flex";
  });
  document
    .getElementById("wallpaperBtn")
    ?.addEventListener("click", () => openWallpaperModal("current"));
  document
    .getElementById("chatMoreBtn")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openActiveChatMenu(event.currentTarget);
    });
  document.getElementById("chatSearchMenuItem")?.addEventListener("click", () => {
    document.getElementById("chatContextMenu").style.display = "none";
    document.getElementById("searchChatBtn")?.click();
  });
  document
    .getElementById("chatMediaMenuItem")
    ?.addEventListener("click", openCurrentChatMedia);
  document
    .getElementById("chatThemeMenuItem")
    ?.addEventListener("click", () => {
      document.getElementById("chatContextMenu").style.display = "none";
      openWallpaperModal("current");
    });
  document
    .getElementById("exportChatMenuItem")
    ?.addEventListener("click", () => {
      document.getElementById("chatContextMenu").style.display = "none";
      exportCurrentChat();
    });
  document
    .getElementById("addShortcutMenuItem")
    ?.addEventListener("click", () => {
      document.getElementById("chatContextMenu").style.display = "none";
      showToast("Shortcut can be added from your browser or Android launcher menu");
    });
  document
    .getElementById("addToListMenuItem")
    ?.addEventListener("click", () => {
      document.getElementById("chatContextMenu").style.display = "none";
      document.getElementById("favoriteChatMenuItem")?.click();
    });
  document
    .getElementById("chatInfoBlockBtn")
    ?.addEventListener("click", async () => {
      if (currentChatType !== "direct" || !currentChat?.otherUserId) return;
      await blockUser(
        currentChat.otherUserId,
        currentChat.otherUserName || "User",
      );
      document.getElementById("chatInfoModal").style.display = "none";
      resetChatPanel();
    });
  document
    .getElementById("chatInfoReportBtn")
    ?.addEventListener("click", async () => {
      if (currentChatType !== "direct" || !currentChat?.otherUserId) return;
      await reportUser(
        currentChat.otherUserId,
        currentChat.otherUserName || "User",
        "chat_info",
      );
      document.getElementById("chatInfoModal").style.display = "none";
    });
  document
    .getElementById("muteChatMenuItem")
    ?.addEventListener("click", async () => {
      if (!contextMenuTarget) return;
      const chatId = contextMenuTarget.dataset.chatId;
      const chatType = contextMenuTarget.dataset.chatType;
      const activeMute = getActiveMuteRecord(chatId, chatType);
      if (activeMute) {
        await unmuteChat(activeMute.id);
      } else {
        await muteChat(chatId, chatType, "always");
      }
      document.getElementById("chatContextMenu").style.display = "none";
      loadCurrentChatList();
    });
  document
    .getElementById("archiveChatMenuItem")
    ?.addEventListener("click", async () => {
      if (!contextMenuTarget) return;
      const aliases = (contextMenuTarget.dataset.aliasDirectIds || "")
        .split(",")
        .filter(Boolean);
      await archiveChat(
        contextMenuTarget.dataset.chatId,
        contextMenuTarget.dataset.chatType,
        contextMenuTarget.dataset.chatName || "Chat",
        aliases,
      );
      document.getElementById("chatContextMenu").style.display = "none";
      loadCurrentChatList();
    });

  // Notification Settings Modal
  document
    .getElementById("notifMuteToggle")
    ?.addEventListener("change", (e) => {
      document.getElementById("notifMuteDurationSection").style.display = e
        .target.checked
        ? "block"
        : "none";
    });
  document
    .getElementById("notifSettingsSaveBtn")
    ?.addEventListener("click", saveNotifSettings);
  document.querySelectorAll(".closeNotifSettingsModal").forEach((btn) =>
    btn.addEventListener("click", () => {
      document.getElementById("notifSettingsModal").style.display = "none";
    }),
  );
  document
    .getElementById("notifSettingsModal")
    ?.addEventListener("click", (e) => {
      if (e.target === document.getElementById("notifSettingsModal")) {
        document.getElementById("notifSettingsModal").style.display = "none";
      }
    });

  // Wallpaper settings attachments
  document
    .getElementById("wallpaperSettingsBtn")
    ?.addEventListener("click", () => openWallpaperModal("global"));
  document
    .getElementById("currentChatWallpaperBtn")
    ?.addEventListener("click", () => openWallpaperModal("current"));
  document
    .querySelectorAll(".closeWallpaperModal")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () =>
          (document.getElementById("wallpaperModal").style.display = "none"),
      ),
    );
  document.querySelectorAll(".wallpaper-option").forEach((opt) =>
    opt.addEventListener("click", () => {
      const wp = normalizeWallpaperType(opt.dataset.wallpaper);
      if (wallpaperModalMode === "current" && currentChat)
        setWallpaperForChat(currentChat.id, wp);
      else setGlobalWallpaper(wp);
      document.getElementById("wallpaperModal").style.display = "none";
    }),
  );
  document
    .getElementById("uploadWallpaperBtn")
    ?.addEventListener("click", () =>
      document.getElementById("wallpaperUploadInput")?.click(),
    );
  document
    .getElementById("wallpaperUploadInput")
    ?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const url = await uploadToCloudinary(file);
        if (wallpaperModalMode === "current" && currentChat)
          setWallpaperForChat(currentChat.id, url);
        else setGlobalWallpaper(url);
        document.getElementById("wallpaperModal").style.display = "none";
      } catch (error) {
        showToast("Wallpaper upload failed", "error");
      } finally {
        event.target.value = "";
      }
    });

  if (localStorage.getItem("darkMode") === "true")
    document.body.classList.add("dark");
}
async function requestNativeNotificationPermission() {
  if (!isNativeAndroidApp || !PushNotifications) return;

  try {
    let permission = await PushNotifications.checkPermissions();

    if (permission.receive !== "granted") {
      permission = await PushNotifications.requestPermissions();
    }

    console.log("Native notification permission:", permission.receive);
  } catch (error) {
    console.warn("Native notification permission failed:", error);
  }
}
// Run framework initializes
init();
// ========================================
// SIDEBAR CONTEXT MENU HANDLERS
// ========================================
let contextMenuTarget = null;
let contextMenuOpenedAt = 0;
// ADD THIS NEW CODE HERE:
// This tells the app to hide the menu whenever you click anywhere else
window.addEventListener("click", (e) => {
  if (Date.now() - contextMenuOpenedAt < 180) return;
  // Hide the message menu
  const msgMenu = document.querySelector(".message-context-menu");
  if (msgMenu && !e.target.closest(".message-context-menu")) {
    removeMessageContextMenu();
  }

  // Hide the sidebar menu
  const sidebarMenu = document.getElementById("chatContextMenu");
  if (
    sidebarMenu &&
    !e.target.closest("#chatContextMenu") &&
    !e.target.closest("#chatMoreBtn")
  ) {
    sidebarMenu.style.display = "none";
  }

  const archivedMenu = document.getElementById("archivedRowMenu");
  if (archivedMenu && !e.target.closest("#archivedRowMenu")) {
    hideArchivedRowMenu();
  }

  const emojiPicker = document.getElementById("emojiPicker");
  const attachmentSheet = document.getElementById("attachmentSheet");
  if (
    (emojiPicker || attachmentSheet) &&
    !e.target.closest("#emojiPicker") &&
    !e.target.closest("#attachmentSheet") &&
    !e.target.closest("#emojiBtn") &&
    !e.target.closest("#attachBtn")
  ) {
    closeComposerPanels();
  }
});

const runArchivedUnarchive = async (event) => {
  if (event) event.preventDefault();
  const menu = document.getElementById("archivedRowMenu");
  if (!menu?.dataset.archiveId) return;
  await unarchiveChat(menu.dataset.archiveId);
  hideArchivedRowMenu();
};

function getCurrentChatKey() {
  if (!currentChat || !currentChatType) return "";
  return `${currentChatType}:${currentChat.id}`;
}

function resetMessageRenderLimit() {
  const key = getCurrentChatKey();
  if (!key) return;
  messageRenderLimits.set(key, MESSAGE_PAGE_SIZE);
}

function getMessageRenderLimit() {
  const key = getCurrentChatKey();
  if (!key) return MESSAGE_PAGE_SIZE;
  if (!messageRenderLimits.has(key))
    messageRenderLimits.set(key, MESSAGE_PAGE_SIZE);
  return messageRenderLimits.get(key);
}

function increaseMessageRenderLimit() {
  const key = getCurrentChatKey();
  if (!key) return;
  messageRenderLimits.set(key, getMessageRenderLimit() + MESSAGE_PAGE_SIZE);
}

function getOrCreateSessionId() {
  try {
    const key = "teamChatSessionId";
    let id = localStorage.getItem(key);
    if (!id) {
      id = `sess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch (_) {
    return `sess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  }
}

function getDeviceLabel() {
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "Android device";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS device";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown device";
}

async function upsertCurrentSession() {
  if (!currentUser || !currentSessionId) return;
  await db
    .collection("userSessions")
    .doc(`${currentUser.uid}_${currentSessionId}`)
    .set(
      {
        userId: currentUser.uid,
        sessionId: currentSessionId,
        deviceLabel: getDeviceLabel(),
        userAgent: navigator.userAgent || "",
        isActive: true,
        revoked: false,
        lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

function startSessionHeartbeat() {
  clearInterval(sessionHeartbeatTimer);
  upsertCurrentSession().catch(() => {});
  sessionHeartbeatTimer = setInterval(() => {
    upsertCurrentSession().catch(() => {});
  }, 45000);
}

function stopSessionHeartbeat() {
  clearInterval(sessionHeartbeatTimer);
  sessionHeartbeatTimer = null;
}

function watchSessionRevocation() {
  if (!currentUser || !currentSessionId) return;
  if (sessionWatchUnsubscribe) {
    sessionWatchUnsubscribe();
    sessionWatchUnsubscribe = null;
  }
  const ref = db
    .collection("userSessions")
    .doc(`${currentUser.uid}_${currentSessionId}`);
  sessionWatchUnsubscribe = ref.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (data?.revoked === true) {
      showToast("This session was logged out from another device");
      auth.signOut().then(() => window.location.replace("login.html"));
    }
  });
}

async function showSessionsModal() {
  if (!currentUser) return;
  const modal = document.getElementById("sessionsModal");
  const list = document.getElementById("sessionsList");
  if (!modal || !list) return;
  list.innerHTML = '<div class="empty-state">Loading sessions...</div>';
  modal.style.display = "flex";

  const snapshot = await db
    .collection("userSessions")
    .where("userId", "==", currentUser.uid)
    .orderBy("lastSeenAt", "desc")
    .limit(50)
    .get()
    .catch(() => null);

  if (!snapshot || snapshot.empty) {
    list.innerHTML = '<div class="empty-state">No active sessions found</div>';
    return;
  }

  list.innerHTML = "";
  snapshot.docs.forEach((doc) => {
    const s = doc.data();
    const isCurrent = s.sessionId === currentSessionId;
    const row = document.createElement("div");
    row.className = "blocked-user-card";
    row.innerHTML = `
      <div class="list-info">
        <div class="list-name">${escapeHtml(s.deviceLabel || "Device")}${isCurrent ? " (This Device)" : ""}</div>
        <div class="list-preview">Last seen: ${escapeHtml(formatWhen(s.lastSeenAt) || "Unknown")}</div>
      </div>
      ${isCurrent ? "" : `<button class="btn btn-outline revoke-session-btn" data-id="${escapeHtml(doc.id)}">Log Out</button>`}
    `;
    list.appendChild(row);
  });

  list.querySelectorAll(".revoke-session-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Log out this session?")) return;
      await db.collection("userSessions").doc(btn.dataset.id).update({
        revoked: true,
        isActive: false,
        revokedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      showToast("Session logged out");
      showSessionsModal();
    });
  });
}

async function logoutOtherSessions() {
  if (!currentUser || !confirm("Log out all other sessions?")) return;
  const snapshot = await db
    .collection("userSessions")
    .where("userId", "==", currentUser.uid)
    .get()
    .catch(() => null);
  if (!snapshot) return;
  const targets = snapshot.docs.filter(
    (doc) => doc.data()?.sessionId !== currentSessionId,
  );
  for (const doc of targets) {
    await doc.ref.update({
      revoked: true,
      isActive: false,
      revokedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
  showToast(`Logged out ${targets.length} other session(s)`);
  showSessionsModal();
}

const runArchivedDelete = async (event) => {
  if (event) event.preventDefault();
  const menu = document.getElementById("archivedRowMenu");
  if (
    !menu?.dataset.archiveId ||
    !menu.dataset.chatId ||
    !menu.dataset.chatType
  )
    return;
  const chatName = menu.dataset.chatName || "Chat";
  const doDelete = confirm(`Delete "${chatName}" for your account?`);
  if (!doDelete) return;
  await deleteChatForMe(menu.dataset.chatId, menu.dataset.chatType, chatName);
  await unarchiveChat(menu.dataset.archiveId);
  hideArchivedRowMenu();
};

document
  .getElementById("archivedUnarchiveMenuItem")
  ?.addEventListener("click", runArchivedUnarchive);
document
  .getElementById("archivedDeleteMenuItem")
  ?.addEventListener("click", runArchivedDelete);
document
  .getElementById("archivedUnarchiveMenuItem")
  ?.addEventListener("touchend", runArchivedUnarchive, { passive: false });
document
  .getElementById("archivedDeleteMenuItem")
  ?.addEventListener("touchend", runArchivedDelete, { passive: false });

const archivedRowMenuEl = document.getElementById("archivedRowMenu");
if (archivedRowMenuEl) {
  archivedRowMenuEl.addEventListener(
    "contextmenu",
    (event) => event.preventDefault(),
    { passive: false },
  );
  archivedRowMenuEl.addEventListener(
    "touchstart",
    (event) => event.stopPropagation(),
    { passive: true },
  );
  archivedRowMenuEl.addEventListener("mousedown", (event) =>
    event.stopPropagation(),
  );
}

document.addEventListener("selectionchange", () => {
  const menu = document.getElementById("archivedRowMenu");
  if (!menu || menu.style.display !== "block") return;
  const selection = window.getSelection && window.getSelection();
  if (selection && selection.rangeCount) {
    selection.removeAllRanges();
  }
});

document.getElementById("chatsList")?.addEventListener("contextmenu", (e) => {
  const item = e.target.closest(".list-item");
  if (!item) return;
  e.preventDefault();

  contextMenuTarget = item;
  const menu = document.getElementById("chatContextMenu");
  if (menu) {
    updateChatContextMenuLabels();
    contextMenuOpenedAt = Date.now();
    positionContextMenu(menu, e.clientX, e.clientY);
  }
});

document.getElementById("groupsList")?.addEventListener("contextmenu", (e) => {
  const item = e.target.closest(".list-item");
  if (!item) return;
  e.preventDefault();

  contextMenuTarget = item;
  const menu = document.getElementById("chatContextMenu");
  if (menu) {
    updateChatContextMenuLabels();
    contextMenuOpenedAt = Date.now();
    positionContextMenu(menu, e.clientX, e.clientY);
  }
});

document
  .getElementById("favoriteChatMenuItem")
  ?.addEventListener("click", async () => {
    if (!contextMenuTarget) return;
    const chatId = contextMenuTarget.dataset.chatId;
    const chatType = contextMenuTarget.dataset.chatType;
    if (chatId && chatType) {
      await toggleFavoriteChat(chatId, chatType);
    }
    document.getElementById("chatContextMenu").style.display = "none";
  });

document
  .getElementById("pinChatMenuItem")
  ?.addEventListener("click", async () => {
    if (!contextMenuTarget) return;
    const chatId = contextMenuTarget.dataset.chatId;
    if (chatId) {
      await togglePinChat(chatId);
    }
    document.getElementById("chatContextMenu").style.display = "none";
  });

document
  .getElementById("markReadMenuItem")
  ?.addEventListener("click", async () => {
    if (!contextMenuTarget) return;
    const chatId = contextMenuTarget.dataset.chatId;
    const chatType = contextMenuTarget.dataset.chatType;
    const unreadCount = Number(contextMenuTarget.dataset.unreadCount || 0);
    if (chatId && chatType) {
      await markChatReadState(chatId, chatType, unreadCount > 0);
      loadCurrentChatList();
    }
    document.getElementById("chatContextMenu").style.display = "none";
  });

document
  .getElementById("blockUserMenuItem")
  ?.addEventListener("click", async () => {
    if (!contextMenuTarget) return;
    const userId = contextMenuTarget.dataset.otherUserId;
    const userName =
      contextMenuTarget.dataset.chatName ||
      contextMenuTarget.querySelector(".list-name")?.textContent ||
      "User";
    if (!userId) {
      showToast("Only personal chats can be blocked here", "error");
    } else if (confirm(`Block ${userName}?`)) {
      await blockUser(userId, userName);
      await loadBlockedUsers();
      if (currentChatType === "direct" && currentChat?.otherUserId === userId)
        resetChatPanel();
      loadCurrentChatList();
      showToast(`${userName} blocked`);
    }
    document.getElementById("chatContextMenu").style.display = "none";
  });

document
  .getElementById("reportUserMenuItem")
  ?.addEventListener("click", async () => {
    if (!contextMenuTarget) return;
    const chatType = contextMenuTarget.dataset.chatType;
    if (chatType === "group") {
      document.getElementById("chatContextMenu").style.display = "none";
      showToast("Group reported");
      return;
    }
    const userId = contextMenuTarget.dataset.otherUserId;
    const userName =
      contextMenuTarget.dataset.chatName ||
      contextMenuTarget.querySelector(".list-name")?.textContent ||
      "User";
    if (!userId) {
      showToast("Only personal chats can be reported here", "error");
    } else {
      await reportUser(userId, userName, "sidebar_menu");
    }
    document.getElementById("chatContextMenu").style.display = "none";
  });

document
  .getElementById("exitGroupMenuItem")
  ?.addEventListener("click", async () => {
    if (!contextMenuTarget || contextMenuTarget.dataset.chatType !== "group") {
      document.getElementById("chatContextMenu").style.display = "none";
      return;
    }
    const chatName =
      contextMenuTarget.dataset.chatName ||
      contextMenuTarget.querySelector?.(".list-name")?.textContent ||
      "this group";
    document.getElementById("chatContextMenu").style.display = "none";
    if (!confirm(`Exit "${chatName}"?`)) return;
    if (currentChat?.id === contextMenuTarget.dataset.chatId) {
      await leaveGroup();
    } else {
      const previousChat = currentChat;
      const previousGroup = currentGroup;
      currentChat = { id: contextMenuTarget.dataset.chatId, name: chatName };
      currentGroup = currentChat;
      try {
        await leaveGroup();
      } finally {
        currentChat = previousChat;
        currentGroup = previousGroup;
      }
    }
  });

document
  .getElementById("clearChatMenuItem")
  ?.addEventListener("click", async () => {
    if (!contextMenuTarget) return;
    const chatId = contextMenuTarget.dataset.chatId;
    const chatType = contextMenuTarget.dataset.chatType;
    const chatName =
      contextMenuTarget.dataset.chatName ||
      contextMenuTarget.querySelector(".list-name")?.textContent ||
      "Chat";
    if (
      chatId &&
      chatType &&
      confirm(`Clear all messages in "${chatName}" for your account only?`)
    ) {
      try {
        await clearChatHistoryForMe(chatId, chatType, chatName);
      } catch (error) {
        showToast("Failed to clear chat history", "error");
      }
    }
    document.getElementById("chatContextMenu").style.display = "none";
  });

document
  .getElementById("deleteChatMenuItem")
  ?.addEventListener("click", async () => {
    if (!contextMenuTarget) return;
    const chatId = contextMenuTarget.dataset.chatId;
    const chatType = contextMenuTarget.dataset.chatType;
    const chatName =
      contextMenuTarget.dataset.chatName ||
      contextMenuTarget.querySelector(".list-name")?.textContent ||
      "Chat";
    if (
      chatId &&
      chatType &&
      confirm(
        `Delete "${chatName}" from your chat list? Messages are not deleted for other people.`,
      )
    ) {
      try {
        await deleteChatForMe(chatId, chatType, chatName);
      } catch (error) {
        showToast("Failed to delete chat", "error");
      }
    }
    document.getElementById("chatContextMenu").style.display = "none";
  });
function showCallControlHint(message) {
  const statusEl = document.getElementById("callStatusText");
  if (!statusEl) return;

  const previous = statusEl.textContent;
  statusEl.textContent = message;

  clearTimeout(statusEl._hintTimer);
  statusEl._hintTimer = setTimeout(() => {
    statusEl.textContent = previous || "Connected";
  }, 1200);
}

function setupCallControlButtons() {
  const muteBtn = document.getElementById("muteMicBtn");
  const cameraBtn = document.getElementById("toggleCameraBtn");

  if (muteBtn && muteBtn.dataset.ready !== "true") {
    muteBtn.dataset.ready = "true";

    muteBtn.addEventListener("click", () => setMicrophoneMuted(!micMuted));
  }

  if (cameraBtn && cameraBtn.dataset.ready !== "true") {
    cameraBtn.dataset.ready = "true";

    cameraBtn.addEventListener("click", () => setCameraOff(!cameraOff));
  }

  const switchCameraBtn = document.getElementById("switchCameraBtn");

  if (switchCameraBtn && switchCameraBtn.dataset.ready !== "true") {
    switchCameraBtn.dataset.ready = "true";
    switchCameraBtn.addEventListener("click", switchCameraFacingMode);
  }

  const addParticipantBtn = document.getElementById("addCallParticipantBtn");

  if (addParticipantBtn && addParticipantBtn.dataset.ready !== "true") {
    addParticipantBtn.dataset.ready = "true";
    addParticipantBtn.disabled = false;
    addParticipantBtn.title = "Add person";
    addParticipantBtn.addEventListener("click", () =>
      addPersonToActiveCall().catch(() => {
        flashCallControlLabel(addParticipantBtn, "Could not add person");
      }),
    );
  }

  const screenShareBtn = document.getElementById("screenShareBtn");
  if (screenShareBtn) {
    screenShareBtn.style.display =
      currentCallType === "video" ? "inline-flex" : "none";
  }

  const pipBtn = document.getElementById("pipBtn");
  if (pipBtn) {
    pipBtn.style.display = currentCallType === "video" ? "inline-flex" : "none";
  }
}

// Keep read receipts reliable when mobile browsers/PWA pause and resume the page.
window.addEventListener("focus", () => {
  if (currentChat) markMessagesAsRead();
});
document.addEventListener("visibilitychange", () => {
  if (currentUser) {
    setCurrentUserPresence(document.visibilityState !== "hidden").catch(
      () => {},
    );
  }
  if (document.hidden && activeCall && activeCallMode !== "incoming") {
    minimizeActiveCallUi("background");
  }
  if (
    !document.hidden &&
    activeCall &&
    callMiniBar?.classList.contains("show")
  ) {
    updateCallMiniBar(callStartedAt ? "Connected" : "Call running");
  }
  if (!document.hidden && currentChat) markMessagesAsRead();
});

window.addEventListener("pagehide", () => {
  if (currentUser) setCurrentUserPresence(false).catch(() => {});
});

window.enableTeamChatCallNotifications =
  function enableTeamChatCallNotifications() {
    return registerFcmTokenForCurrentUser({ force: true });
  };

// ========================================
// FEATURE 2: GLOBAL MESSAGE SEARCH
// ========================================

(function initGlobalSearch() {
  const searchBtn = document.getElementById("globalSearchBtn");
  const modal = document.getElementById("globalSearchModal");
  if (!searchBtn || !modal) return;

  searchBtn.innerHTML = "🔍";
  searchBtn.addEventListener("click", () => {
    modal.style.display = "flex";
    document.getElementById("globalSearchInput")?.focus();
  });

  document.querySelectorAll(".closeGlobalSearchModal").forEach((btn) => {
    btn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  const searchInput = document.getElementById("globalSearchInput");
  const resultsDiv = document.getElementById("globalSearchResults");
  let searchDebounce;

  if (searchInput && resultsDiv) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchDebounce);
      const query = searchInput.value.trim();
      if (query.length < 2) {
        resultsDiv.innerHTML =
          '<div class="empty-state">Enter at least 2 characters to search</div>';
        return;
      }
      resultsDiv.innerHTML = '<div class="empty-state">Searching...</div>';
      searchDebounce = setTimeout(
        () => handleGlobalSearch(query, resultsDiv),
        400,
      );
    });
  }
})();

async function handleGlobalSearch(query, resultsDiv) {
  if (!currentUser || !query) return;
  const lowerQuery = query.toLowerCase();
  const results = [];

  try {
    const addMatchingMessages = (snapshot, chatMeta = {}) => {
      snapshot.docs.forEach((doc) => {
        const msg = doc.data();
        if (!msg.text || !msg.text.toLowerCase().includes(lowerQuery)) return;
        if (msg.deletedForEveryone || msg.deletedFor?.[currentUser.uid]) return;
        results.push({ id: doc.id, ...msg, ...chatMeta });
      });
    };

    const directChats = await db
      .collection("directChats")
      .where("participants", "array-contains", currentUser.uid)
      .limit(50)
      .get();

    for (const chatDoc of directChats.docs) {
      const chat = chatDoc.data() || {};
      const directIds = [
        ...new Set(
          [chatDoc.id, ...(chat.aliasDirectIds || [])].filter(Boolean),
        ),
      ].slice(0, 10);
      for (const directId of directIds) {
        const messages = await db
          .collection("messages")
          .where("directId", "==", directId)
          .limit(120)
          .get();
        addMatchingMessages(messages, { _chatType: "direct" });
      }
    }

    const memberships = await db
      .collection("groupMembers")
      .where("userId", "==", currentUser.uid)
      .limit(50)
      .get();

    for (const memberDoc of memberships.docs) {
      const groupId = memberDoc.data()?.groupId;
      if (!groupId) continue;
      const messages = await db
        .collection("messages")
        .where("groupId", "==", groupId)
        .limit(120)
        .get();
      addMatchingMessages(messages, { _chatType: "group", groupId });
    }
  } catch (e) {
    console.warn("Global search failed:", e);
  }

  if (results.length === 0) {
    resultsDiv.innerHTML =
      '<div class="empty-state">No messages found matching "' +
      escapeHtml(query) +
      '"</div>';
    return;
  }

  results.sort((a, b) => {
    const aTime =
      a.timestamp?.toMillis?.() ||
      (a.timestamp ? new Date(a.timestamp).getTime() : 0);
    const bTime =
      b.timestamp?.toMillis?.() ||
      (b.timestamp ? new Date(b.timestamp).getTime() : 0);
    return bTime - aTime;
  });

  resultsDiv.innerHTML = "";
  results.slice(0, 50).forEach((msg) => {
    const time = msg.timestamp ? formatTime(msg.timestamp) : "";
    const text = escapeHtml(msg.text || "");
    const highlighted = text.replace(
      new RegExp(escapeRegExp(escapeHtml(query)), "gi"),
      (m) => `<mark style="background:#fef08a;border-radius:2px;">${m}</mark>`,
    );
    const div = document.createElement("div");
    div.style.cssText =
      "padding:10px 14px;border-bottom:1px solid #f1f5f9;cursor:pointer;border-radius:8px;margin-bottom:4px;";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <strong style="font-size:13px;color:#1e293b;">${escapeHtml(msg.senderName || "Unknown")}</strong>
        <span style="font-size:11px;color:#94a3b8;">${time}</span>
      </div>
      <div style="font-size:13px;color:#475569;line-height:1.4;">${highlighted}</div>
    `;
    div.addEventListener("click", () => {
      document.getElementById("globalSearchModal").style.display = "none";
      // Navigate to the chat
      if (msg._chatType === "group" && msg.groupId) {
        const grpName = msg.groupId; // best we have without full list
        loadGroupChat(msg.groupId, grpName);
      } else if (msg.directId) {
        const otherId = (msg.participants || []).find(
          (id) => id !== currentUser.uid,
        );
        if (otherId) {
          const user = allUsers.find((u) => u.id === otherId) || {
            id: otherId,
            displayName: msg.senderName,
          };
          startDirectChat(user);
        }
      }
    });
    resultsDiv.appendChild(div);
  });
}

// ========================================
// FEATURE 3: LOCATION SHARING
// ========================================

(function initLocationBtn() {
  const btn = document.getElementById("locationBtn");
  if (!btn) return;
  btn.addEventListener("click", shareLocation);
})();

async function shareLocation() {
  if (!currentChat || !currentUser) {
    showToast("Please open a chat first", "error");
    return;
  }
  if (!navigator.geolocation) {
    showToast("Location not supported on this device", "error");
    return;
  }
  if (isNativeAndroidApp) {
    const hasLocation = await ensureNativePermission("location");
    if (!hasLocation) return;
  }

  showToast("Getting your location...");

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      const mapsUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
      const googleMapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      const text = `📍 My Location\nLatitude: ${latitude.toFixed(6)}, Longitude: ${longitude.toFixed(6)}\n🗺️ OpenStreetMap: ${mapsUrl}\n🗺️ Google Maps: ${googleMapsUrl}`;

      const directParticipants =
        currentChatType === "direct"
          ? [
              ...new Set(
                [
                  currentUser.uid,
                  ...String(currentChat?.id || "")
                    .split("_")
                    .filter(Boolean),
                  currentChat?.otherUserId,
                ].filter(Boolean),
              ),
            ]
          : [];

      const messageData = {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        text,
        type: "location",
        location: { latitude, longitude },
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: "sent",
        read: false,
        readBy: {
          [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
        },
        deliveredTo: {},
        participants:
          currentChatType === "direct"
            ? directParticipants
            : [
                ...new Set(
                  (currentGroupMembers || [])
                    .map((m) => m.id)
                    .concat(currentUser.uid)
                    .filter(Boolean),
                ),
              ],
      };

      if (currentChatType === "direct") messageData.directId = currentChat.id;
      else messageData.groupId = currentChat.id;

      try {
        await db.collection("messages").add(messageData);
        showToast("Location shared!");
      } catch (e) {
        showToast("Failed to share location", "error");
      }
    },
    (err) => {
      if (err.code === 1) showToast("Location permission denied", "error");
      else showToast("Could not get location", "error");
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

// ========================================
// FEATURE 4: GIF SEARCH (Tenor API)
// ========================================

const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPzkcggwijAPpc"; // Tenor public demo key

(function addGifTabToEmojiPicker() {
  // We patch initializeEmojiPicker by adding a GIF tab after it runs
  const emojiBtn = document.getElementById("emojiBtn");
  if (!emojiBtn) return;

  let gifTabAdded = false;

  emojiBtn.addEventListener("click", () => {
    if (gifTabAdded) return;
    const picker = document.getElementById("emojiPicker");
    if (!picker || !picker.querySelector(".emoji-picker-categories")) return;
    gifTabAdded = true;

    const categoryBar = picker.querySelector(".emoji-picker-categories");
    const contentArea = picker.querySelector(".emoji-picker-content");

    // Add Sticker tab
    const stickerTab = document.createElement("button");
    stickerTab.type = "button";
    stickerTab.className = "emoji-picker-category-tab";
    stickerTab.textContent = "📱";
    stickerTab.title = "Stickers";
    categoryBar.appendChild(stickerTab);

    // Add Sticker section
    const stickerSection = document.createElement("div");
    stickerSection.id = "stickerPickerSection";
    stickerSection.style.cssText = "display:none;padding:8px;";
    stickerSection.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;font-weight:600;color:var(--text)">Stickers</span>
        <button id="addStickerBtn" type="button" style="background:none;border:1px solid var(--border);border-radius:999px;padding:3px 10px;font-size:12px;cursor:pointer;color:var(--text)">+ Add</button>
      </div>
      <div id="stickerGrid" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;max-height:240px;overflow-y:auto;"></div>
      <div id="stickerEmpty" style="text-align:center;padding:20px;color:var(--muted);font-size:13px;display:none;">No stickers yet. Tap "+ Add" to upload one.</div>
    `;
    picker.appendChild(stickerSection);

    // Add GIF tab button
    const gifTab = document.createElement("button");
    gifTab.type = "button";
    gifTab.className = "emoji-picker-category-tab";
    gifTab.textContent = "🎞";
    gifTab.title = "GIFs";
    categoryBar.appendChild(gifTab);

    // Add Animated tab button
    const animatedTab = document.createElement("button");
    animatedTab.type = "button";
    animatedTab.className = "emoji-picker-category-tab";
    animatedTab.textContent = "✨";
    animatedTab.title = "Animated Stickers";
    categoryBar.appendChild(animatedTab);

    // Add GIF section
    const gifSection = document.createElement("div");
    gifSection.id = "gifPickerSection";
    gifSection.style.cssText = "display:none;padding:8px;";
    gifSection.innerHTML = `
      <input id="gifSearchInput" type="text" placeholder="Search GIFs..." style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px;font-size:13px;outline:none;" />
      <div id="gifResults" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:200px;overflow-y:auto;"></div>
      <div id="gifLoading" style="text-align:center;padding:16px;color:#94a3b8;font-size:13px;display:none;">Loading GIFs...</div>
    `;
    picker.appendChild(gifSection);

    // Add Animated Sticker section
    const animatedSection = document.createElement("div");
    animatedSection.id = "animatedStickerSection";
    animatedSection.style.cssText = "display:none;padding:8px;";
    animatedSection.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;font-weight:600;color:var(--text)">Animated Stickers</span>
      </div>
      <div id="animatedStickerGrid" class="animated-sticker-grid"></div>
      <div id="animatedStickerEmpty" style="text-align:center;padding:20px;color:var(--muted);font-size:13px;display:none;">No animated stickers available.</div>
    `;
    picker.appendChild(animatedSection);

    function hideAllPickerSections() {
      if (contentArea) contentArea.style.display = "";
      gifSection.style.display = "none";
      stickerSection.style.display = "none";
      animatedSection.style.display = "none";
    }

    stickerTab.addEventListener("click", () => {
      categoryBar
        .querySelectorAll(".emoji-picker-category-tab")
        .forEach((t) => t.classList.remove("active"));
      stickerTab.classList.add("active");
      hideAllPickerSections();
      stickerSection.style.display = "block";
      loadStickerGrid();
    });

    gifTab.addEventListener("click", () => {
      categoryBar
        .querySelectorAll(".emoji-picker-category-tab")
        .forEach((t) => t.classList.remove("active"));
      gifTab.classList.add("active");
      hideAllPickerSections();
      gifSection.style.display = "block";
      document.getElementById("gifSearchInput")?.focus();
      loadTrendingGifs();
    });

    animatedTab.addEventListener("click", () => {
      categoryBar
        .querySelectorAll(".emoji-picker-category-tab")
        .forEach((t) => t.classList.remove("active"));
      animatedTab.classList.add("active");
      hideAllPickerSections();
      animatedSection.style.display = "block";
      loadAnimatedStickers();
    });

    // When other tabs are clicked, hide sticker, gif, and animated sections
    categoryBar
      .querySelectorAll(".emoji-picker-category-tab")
      .forEach((tab) => {
        if (tab === stickerTab || tab === gifTab || tab === animatedTab) return;
        tab.addEventListener("click", () => {
          gifSection.style.display = "none";
          stickerSection.style.display = "none";
          animatedSection.style.display = "none";
          if (contentArea) contentArea.style.display = "";
        });
      });

    // GIF search input
    let gifDebounce;
    const gifInput = gifSection.querySelector("#gifSearchInput");
    if (gifInput) {
      gifInput.addEventListener("input", () => {
        clearTimeout(gifDebounce);
        const q = gifInput.value.trim();
        gifDebounce = setTimeout(
          () => (q ? searchGifs(q) : loadTrendingGifs()),
          500,
        );
      });
    }
  });
})();

async function loadTrendingGifs() {
  const resultsDiv = document.getElementById("gifResults");
  const loading = document.getElementById("gifLoading");
  if (!resultsDiv) return;
  if (loading) loading.style.display = "block";
  resultsDiv.innerHTML = "";
  try {
    const res = await fetch(
      `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20&media_filter=gif`,
    );
    const data = await res.json();
    renderGifResults(data.results || []);
  } catch (e) {
    if (resultsDiv)
      resultsDiv.innerHTML =
        '<div style="color:#94a3b8;font-size:12px;padding:8px;">Could not load GIFs</div>';
  } finally {
    if (loading) loading.style.display = "none";
  }
}

async function searchGifs(query) {
  const resultsDiv = document.getElementById("gifResults");
  const loading = document.getElementById("gifLoading");
  if (!resultsDiv) return;
  if (loading) loading.style.display = "block";
  resultsDiv.innerHTML = "";
  try {
    const res = await fetch(
      `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(query)}&limit=20&media_filter=gif`,
    );
    const data = await res.json();
    renderGifResults(data.results || []);
  } catch (e) {
    if (resultsDiv)
      resultsDiv.innerHTML =
        '<div style="color:#94a3b8;font-size:12px;padding:8px;">GIF search failed</div>';
  } finally {
    if (loading) loading.style.display = "none";
  }
}

function renderGifResults(gifs) {
  const resultsDiv = document.getElementById("gifResults");
  if (!resultsDiv) return;
  resultsDiv.innerHTML = "";
  if (!gifs.length) {
    resultsDiv.innerHTML =
      '<div style="color:#94a3b8;font-size:12px;padding:8px;grid-column:1/-1;">No GIFs found</div>';
    return;
  }
  gifs.forEach((gif) => {
    const url = gif.media_formats?.gif?.url || gif.url;
    const preview = gif.media_formats?.tinygif?.url || url;
    if (!url) return;
    const img = document.createElement("img");
    img.src = preview;
    img.loading = "lazy";
    img.style.cssText =
      "width:100%;border-radius:6px;cursor:pointer;object-fit:cover;max-height:80px;";
    img.title = gif.content_description || "GIF";
    img.addEventListener("click", async () => {
      document.getElementById("emojiPicker").style.display = "none";
      if (!currentChat || !currentUser) return;
      const directParticipants =
        currentChatType === "direct"
          ? [
              ...new Set(
                [
                  currentUser.uid,
                  ...String(currentChat?.id || "")
                    .split("_")
                    .filter(Boolean),
                  currentChat?.otherUserId,
                ].filter(Boolean),
              ),
            ]
          : [];
      const messageData = {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        text: "",
        attachment: { type: "gif", url, filename: "animated.gif" },
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: "sent",
        read: false,
        readBy: {
          [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
        },
        deliveredTo: {},
        participants:
          currentChatType === "direct"
            ? directParticipants
            : [
                ...new Set(
                  (currentGroupMembers || [])
                    .map((m) => m.id)
                    .concat(currentUser.uid)
                    .filter(Boolean),
                ),
              ],
      };
      if (currentChatType === "direct") messageData.directId = currentChat.id;
      else messageData.groupId = currentChat.id;
      try {
        await db.collection("messages").add(messageData);
      } catch (e) {
        showToast("Failed to send GIF", "error");
      }
    });
    resultsDiv.appendChild(img);
  });
}

// ========================================
// STICKERS
// ========================================

let stickerPackId = null;

function getDefaultStickers() {
  const defaultStickers = [];
  const emojis = [
    "😂",
    "❤️",
    "🔥",
    "👍",
    "😍",
    "🎉",
    "🙏",
    "💯",
    "✨",
    "🥳",
    "😎",
    "💪",
    "🤝",
    "👏",
    "🎊",
    "⭐",
    "🌈",
    "💥",
    "🦄",
    "🍀",
    "🎵",
    "🏆",
    "💡",
    "🔮",
    "💎",
    "🧠",
    "🌟",
    "🪄",
    "🧩",
    "🎨",
  ];
  for (const e of emojis) {
    defaultStickers.push({
      id: "emoji-" + e.codePointAt(0),
      url: "",
      emoji: e,
    });
  }
  return defaultStickers;
}

async function ensureStickerPack() {
  if (stickerPackId) return stickerPackId;
  if (!currentUser) return null;
  try {
    const snap = await db
      .collection("stickerPacks")
      .where("creatorId", "==", currentUser.uid)
      .limit(1)
      .get();
    if (!snap.empty) {
      stickerPackId = snap.docs[0].id;
      return stickerPackId;
    }
    const ref = await db.collection("stickerPacks").add({
      name: "My Stickers",
      creatorId: currentUser.uid,
      creatorName: currentUser.displayName || currentUser.email,
      stickers: getDefaultStickers(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    stickerPackId = ref.id;
    return stickerPackId;
  } catch (e) {
    console.warn("ensureStickerPack error:", e);
    return null;
  }
}

async function loadStickerGrid() {
  const grid = document.getElementById("stickerGrid");
  const empty = document.getElementById("stickerEmpty");
  if (!grid) return;
  const packId = await ensureStickerPack();
  if (!packId) {
    if (empty) empty.style.display = "block";
    return;
  }
  try {
    const doc = await db.collection("stickerPacks").doc(packId).get();
    if (!doc.exists) {
      if (empty) empty.style.display = "block";
      return;
    }
    const stickers = doc.data().stickers || [];
    if (!stickers.length) {
      if (empty) empty.style.display = "block";
      grid.innerHTML = "";
      return;
    }
    if (empty) empty.style.display = "none";
    grid.innerHTML = "";
    for (const s of stickers) {
      const div = document.createElement("div");
      div.style.cssText =
        "aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:var(--panel-soft);border-radius:8px;cursor:pointer;font-size:28px;overflow:hidden;transition:transform 0.1s;";
      if (s.url) {
        div.innerHTML = `<img src="${s.url}" style="width:100%;height:100%;object-fit:cover">`;
      } else {
        div.textContent = s.emoji || "😀";
      }
      div.title = "Send sticker";
      div.onclick = () => sendSticker(s);
      div.onmouseenter = () => {
        div.style.transform = "scale(1.08)";
      };
      div.onmouseleave = () => {
        div.style.transform = "";
      };
      grid.appendChild(div);
    }

    // Add sticker button handler
    document.getElementById("addStickerBtn").onclick = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const url = await uploadToCloudinary(file);
          const doc = await db.collection("stickerPacks").doc(packId).get();
          const existing = doc.data()?.stickers || getDefaultStickers();
          existing.push({ id: "sticker-" + Date.now(), url, emoji: "" });
          await db
            .collection("stickerPacks")
            .doc(packId)
            .update({ stickers: existing });
          loadStickerGrid();
          showToast("Sticker added!");
        } catch (err) {
          showToast("Failed to add sticker", "error");
        }
      };
      input.click();
    };
  } catch (e) {
    console.warn("loadStickerGrid error:", e);
  }
}

// ========================================
// FEATURE 1: Jump to First Unread
// ========================================
async function getFirstUnreadMessageId() {
  if (!currentChat || !currentUser) return null;
  const chatId = currentChat.id;
  const chatType = currentChatType;
  const lastReadKey = `${chatType}_${chatId}`;
  const lastReadTs = lastReadTimestamps.get(lastReadKey);
  if (!lastReadTs) return null;
  const field = chatType === "direct" ? "directId" : "groupId";
  const snapshot = await db
    .collection("messages")
    .where(field, "==", chatId)
    .orderBy("timestamp", "asc")
    .get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.timestamp) continue;
    const ts = data.timestamp.toMillis ? data.timestamp.toMillis() : 0;
    if (ts > lastReadTs && data.senderId !== currentUser.uid) return doc.id;
  }
  return null;
}

function scrollToMessage(messageId) {
  if (!messageId) return;
  const target = document.querySelector(
    `.message[data-message-id="${CSS.escape(messageId)}"]`,
  );
  if (!target) {
    showToast("Message not found in current view", "error");
    return;
  }
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  target.classList.add("reply-target-highlight");
  setTimeout(() => target.classList.remove("reply-target-highlight"), 1400);
}

// ========================================
// FEATURE 2: Emoji Shortcut Predictions
// ========================================
const emojiPredictionMap = {
  ":)": "\uD83D\uDE0A",
  ":-)": "\uD83D\uDE0A",
  ":(": "\uD83D\uDE22",
  ":-(": "\uD83D\uDE22",
  ":D": "\uD83D\uDE04",
  ":-D": "\uD83D\uDE04",
  ";)": "\uD83D\uDE09",
  ";-)": "\uD83D\uDE09",
  "<3": "\u2764\uFE0F",
  ":p": "\uD83D\uDE0B",
  ":-p": "\uD83D\uDE0B",
  ":o": "\uD83D\uDE2E",
  ":-o": "\uD83D\uDE2E",
  ":/": "\uD83D\uDE10",
  ":-/": "\uD83D\uDE10",
};

function checkEmojiPredictions(text) {
  const bar = document.getElementById("emojiPredictionBar");
  if (!bar) return;
  if (!text) {
    bar.style.display = "none";
    return;
  }
  const words = text.split(/\s+/);
  const lastWord = words[words.length - 1];
  const match = emojiPredictionMap[lastWord];
  if (match) {
    bar.innerHTML = `<span class="emoji-prediction-item" data-pattern="${escapeHtml(lastWord)}" data-emoji="${match}" style="cursor:pointer;padding:4px 10px;font-size:24px;border-radius:8px;">${match}</span>`;
    bar.style.display = "flex";
    bar
      .querySelector(".emoji-prediction-item")
      ?.addEventListener("click", function () {
        insertEmojiPrediction(this.dataset.pattern, this.dataset.emoji);
      });
  } else {
    bar.style.display = "none";
  }
}

function insertEmojiPrediction(pattern, emoji) {
  const input = document.getElementById("messageInput");
  if (!input) return;
  let text = input.value;
  const idx = text.lastIndexOf(pattern);
  if (idx === -1) return;
  const before = text.substring(0, idx);
  const after = text.substring(idx + pattern.length);
  input.value = before + emoji + after;
  resizeMessageComposer();
  document.getElementById("emojiPredictionBar").style.display = "none";
}

// ========================================
// FEATURE 3: Auto-Moderation / Keyword Filter
// ========================================
const defaultBlockedWords = [
  "spam",
  "scam",
  "fuck",
  "shit",
  "damn",
  "ass",
  "bitch",
  "dick",
  "porn",
  "sex",
  "crap",
];

function containsBlockedWords(text) {
  const lower = text.toLowerCase();
  return blockedWordsCache.some((word) => lower.includes(word.toLowerCase()));
}

function censorText(text) {
  let result = text;
  for (const word of blockedWordsCache) {
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    result = result.replace(regex, "*".repeat(word.length));
  }
  return result;
}

async function checkMessageBeforeSend(text) {
  if (!text || !containsBlockedWords(text)) return true;
  showToast("Message may contain inappropriate words. Send anyway?", "error");
  return confirm(
    "This message may contain inappropriate content. Send anyway?",
  );
}

async function loadBlockedWords() {
  blockedWordsCache = [...defaultBlockedWords];
  if (!currentUser) return;
  try {
    const doc = await db.collection("blockedWords").doc(currentUser.uid).get();
    if (doc.exists) {
      const custom = doc.data().words || [];
      if (custom.length)
        blockedWordsCache = [...new Set([...defaultBlockedWords, ...custom])];
    }
  } catch (e) {
    console.warn("loadBlockedWords error:", e);
  }
}

async function showModerationSettingsModal() {
  await loadBlockedWords();
  const list = document.getElementById("moderationWordsList");
  if (!list) return;
  list.innerHTML = "";
  for (const word of blockedWordsCache) {
    const div = document.createElement("div");
    div.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);";
    div.innerHTML = `<span>${escapeHtml(word)}</span><button class="btn btn-outline" style="padding:2px 8px;font-size:12px;" data-word="${escapeHtml(word)}">Remove</button>`;
    div.querySelector("button").addEventListener("click", async function () {
      await removeBlockedWord(this.dataset.word);
      showModerationSettingsModal();
    });
    list.appendChild(div);
  }
  document.getElementById("moderationSettingsModal").style.display = "flex";
}

async function addBlockedWord(word) {
  if (!word || !word.trim() || !currentUser) return;
  const trimmed = word.trim().toLowerCase();
  if (blockedWordsCache.includes(trimmed)) {
    showToast("Word already blocked", "error");
    return;
  }
  try {
    const docRef = db.collection("blockedWords").doc(currentUser.uid);
    await docRef.set(
      { words: firebase.firestore.FieldValue.arrayUnion(trimmed) },
      { merge: true },
    );
    blockedWordsCache.push(trimmed);
    showToast("Word added to block list");
  } catch (e) {
    showToast("Failed to add word", "error");
  }
}

async function removeBlockedWord(word) {
  if (!word || !currentUser) return;
  try {
    const docRef = db.collection("blockedWords").doc(currentUser.uid);
    await docRef.set(
      { words: firebase.firestore.FieldValue.arrayRemove(word) },
      { merge: true },
    );
    blockedWordsCache = blockedWordsCache.filter((w) => w !== word);
    showToast("Word removed from block list");
  } catch (e) {
    showToast("Failed to remove word", "error");
  }
}

// ========================================
// FEATURE 4: Slow Mode in Groups
// ========================================
async function checkSlowMode(groupId, userId) {
  if (!groupId || !userId) return 0;
  const key = `${groupId}_${userId}`;
  const lastTime = lastMessageTimestamps.get(key) || 0;
  const now = Date.now();
  const groupDoc = await db.collection("groups").doc(groupId).get();
  const interval = groupDoc.data()?.slowModeInterval || 0;
  if (!interval) return 0;
  const elapsed = now - lastTime;
  if (elapsed < interval * 1000)
    return Math.ceil((interval * 1000 - elapsed) / 1000);
  return 0;
}

async function setSlowMode(groupId, seconds) {
  if (!isCurrentUserGroupAdmin()) {
    showToast("Only admins can change slow mode", "error");
    return;
  }
  await db
    .collection("groups")
    .doc(groupId)
    .update({ slowModeInterval: seconds });
  showToast(seconds ? `Slow mode set to ${seconds}s` : "Slow mode disabled");
  if (currentGroup?.id === groupId) currentGroup.slowModeInterval = seconds;
}

function getSlowModeRemainingSeconds(groupId, userId) {
  const key = `${groupId}_${userId}`;
  const lastTime = lastMessageTimestamps.get(key) || 0;
  if (!lastTime) return 0;
  return Math.max(
    0,
    Math.ceil(
      (lastTime + (currentGroup?.slowModeInterval || 0) * 1000 - Date.now()) /
        1000,
    ),
  );
}

// ========================================
// FEATURE 5: Welcome Message for New Members
// ========================================
async function setWelcomeMessage(groupId, text) {
  if (!isCurrentUserGroupAdmin()) {
    showToast("Only admins can set welcome message", "error");
    return;
  }
  await db
    .collection("groups")
    .doc(groupId)
    .update({ welcomeMessage: text.trim() });
  showToast("Welcome message saved");
  if (currentGroup?.id === groupId) currentGroup.welcomeMessage = text.trim();
}

async function sendWelcomeMessage(groupId, newUserId) {
  try {
    const groupDoc = await db.collection("groups").doc(groupId).get();
    const group = groupDoc.data();
    if (!group || !group.welcomeMessage) return;
    const userDoc = await db.collection("users").doc(newUserId).get();
    const userName = userDoc.exists
      ? userDoc.data().displayName || userDoc.data().email || "User"
      : "User";
    const text = group.welcomeMessage.replace(/{user}/g, userName);
    const participants = currentGroupMembers
      ? currentGroupMembers.map((m) => m.id)
      : [];
    await db.collection("messages").add({
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email,
      text: "",
      systemMessage: text,
      type: "system",
      groupId: groupId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: "sent",
      read: false,
      readBy: {
        [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
      },
      deliveredTo: {},
      participants: [
        ...new Set([...participants, currentUser.uid].filter(Boolean)),
      ],
    });
  } catch (e) {
    console.warn("sendWelcomeMessage error:", e);
  }
}

// ========================================
// FEATURE 6: Join Questions
// ========================================
async function showJoinQuestionsModal(groupId) {
  const groupDoc = await db.collection("groups").doc(groupId).get();
  const group = groupDoc.data();
  if (!group || !group.joinQuestions || !group.joinQuestions.length) {
    joinGroupFinalize(groupId);
    return;
  }
  currentJoinQuestions = group.joinQuestions;
  pendingJoinGroupId = groupId;
  const container = document.getElementById("joinQuestionsAnswerContainer");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < group.joinQuestions.length; i++) {
    const q = group.joinQuestions[i];
    const div = document.createElement("div");
    div.style.cssText = "margin-bottom:12px;";
    div.innerHTML = `<label style="display:block;font-weight:600;font-size:13px;margin-bottom:4px;">${escapeHtml(q.question)}${q.required ? ' <span style="color:red">*</span>' : ""}</label><textarea class="join-question-answer" data-index="${i}" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;resize:vertical;" placeholder="Your answer..."></textarea>`;
    container.appendChild(div);
  }
  document.getElementById("joinQuestionsAnswerModal").style.display = "flex";
}

async function submitJoinAnswers() {
  const modal = document.getElementById("joinQuestionsAnswerModal");
  if (!modal || !pendingJoinGroupId) return;
  const textareas = modal.querySelectorAll(".join-question-answer");
  const answers = [];
  let valid = true;
  textareas.forEach((ta) => {
    const idx = parseInt(ta.dataset.index);
    const val = ta.value.trim();
    if (currentJoinQuestions[idx]?.required && !val) {
      valid = false;
    }
    answers.push({ questionIndex: idx, answer: val });
  });
  if (!valid) {
    showToast("Please answer all required questions", "error");
    return;
  }
  try {
    await db.collection("joinRequests").add({
      groupId: pendingJoinGroupId,
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
      answers,
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("Join request submitted. Waiting for admin approval.");
    modal.style.display = "none";
    pendingJoinGroupId = null;
    currentJoinQuestions = [];
  } catch (e) {
    showToast("Failed to submit answers", "error");
  }
}

async function showJoinQuestionsEditorModal() {
  if (!currentGroup) return;
  const groupDoc = await db.collection("groups").doc(currentGroup.id).get();
  const questions = groupDoc.data()?.joinQuestions || [];
  const container = document.getElementById("joinQuestionsEditorContainer");
  if (!container) return;
  container.innerHTML = "";
  if (!questions.length) {
    container.innerHTML =
      '<p style="color:var(--muted-strong);font-size:13px;">No join questions configured.</p>';
  } else {
    questions.forEach((q, i) => {
      const div = document.createElement("div");
      div.style.cssText =
        "display:flex;align-items:center;gap:8px;margin-bottom:8px;";
      div.innerHTML = `<span style="flex:1;font-size:13px;">${escapeHtml(q.question)}${q.required ? ' <span style="color:red">*</span>' : ""}</span><button class="btn btn-outline" style="padding:2px 8px;font-size:12px;" data-index="${i}">Remove</button>`;
      div.querySelector("button").addEventListener("click", async function () {
        const idx = parseInt(this.dataset.index);
        const arr = [...questions];
        arr.splice(idx, 1);
        await db
          .collection("groups")
          .doc(currentGroup.id)
          .update({ joinQuestions: arr });
        showJoinQuestionsEditorModal();
      });
      container.appendChild(div);
    });
  }
  document.getElementById("joinQuestionsEditorModal").style.display = "flex";
}

async function addJoinQuestion() {
  const input = document.getElementById("joinQuestionInput");
  const requiredCheck = document.getElementById("joinQuestionRequired");
  if (!input || !input.value.trim()) {
    showToast("Enter a question", "error");
    return;
  }
  if (!currentGroup) return;
  const groupDoc = await db.collection("groups").doc(currentGroup.id).get();
  const existing = groupDoc.data()?.joinQuestions || [];
  existing.push({
    question: input.value.trim(),
    required: requiredCheck ? requiredCheck.checked : false,
  });
  await db
    .collection("groups")
    .doc(currentGroup.id)
    .update({ joinQuestions: existing });
  input.value = "";
  if (requiredCheck) requiredCheck.checked = false;
  showJoinQuestionsEditorModal();
}

// ========================================
// FEATURE 7: Chat List Drag-to-Reorder
// ========================================
function saveChatOrder(orderedIds) {
  if (!currentUser) return;
  try {
    localStorage.setItem(
      `tc_chat_order_${currentUser.uid}`,
      JSON.stringify(orderedIds),
    );
  } catch (e) {
    console.warn("saveChatOrder error:", e);
  }
}

function getChatOrder() {
  if (!currentUser) return null;
  try {
    const stored = localStorage.getItem(`tc_chat_order_${currentUser.uid}`);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}

function applyChatOrder(items) {
  const order = getChatOrder();
  if (!order || !order.length) return items;
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const ordered = [];
  const unordered = [];
  for (const id of order) {
    if (itemMap.has(id)) {
      ordered.push(itemMap.get(id));
      itemMap.delete(id);
    }
  }
  for (const item of itemMap.values()) unordered.push(item);
  return [...ordered, ...unordered];
}

// ========================================
// FEATURE 1: GROUP INVITE LINKS
// ========================================

async function generateInviteLink(groupId) {
  if (!groupId) return null;
  const groupDoc = await db.collection("groups").doc(groupId).get();
  if (!groupDoc.exists) return null;
  const group = groupDoc.data();
  let code = group.inviteCode;
  if (!code) {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await db.collection("groups").doc(groupId).update({ inviteCode: code });
  }
  const baseUrl = window.location.origin + window.location.pathname;
  return baseUrl + "?joinGroup=" + code;
}

async function joinGroupByInvite(code) {
  if (!code || !code.trim() || !currentUser) return;
  const q = await db
    .collection("groups")
    .where("inviteCode", "==", code.trim().toUpperCase())
    .limit(1)
    .get();
  if (q.empty) {
    showToast("Invalid invite code", "error");
    return;
  }
  const groupDoc = q.docs[0];
  const groupId = groupDoc.id;
  const existing = await db
    .collection("groupMembers")
    .where("groupId", "==", groupId)
    .where("userId", "==", currentUser.uid)
    .limit(1)
    .get();
  if (!existing.empty) {
    showToast("You are already in this group");
    loadGroupChat(groupId, groupDoc.data().name || "Group");
    return;
  }
  await db
    .collection("groupMembers")
    .add({
      groupId,
      userId: currentUser.uid,
      role: "member",
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  await db
    .collection("groups")
    .doc(groupId)
    .update({ memberCount: firebase.firestore.FieldValue.increment(1) });
  showToast("Joined Group!");
  loadGroupsList();
}

// ========================================
// FEATURE 2: SCREEN SHARING DURING CALLS
// ========================================

async function startScreenShare() {
  if (!peerConnection) {
    showToast("No active call", "error");
    return;
  }
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    const screenTrack = screenStream.getVideoTracks()[0];
    const sender = peerConnection
      .getSenders()
      .find((s) => s.track && s.track.kind === "video");
    if (sender) {
      await sender.replaceTrack(screenTrack);
    } else {
      peerConnection.addTrack(screenTrack, screenStream);
    }
    screenTrack.onended = () => stopScreenShare();
    isScreenSharing = true;
    const btn = document.getElementById("screenShareBtn");
    if (btn) {
      btn.textContent = "Stop Share";
      btn.classList.add("active");
    }
    showToast("Screen sharing started");
  } catch (e) {
    showToast("Screen sharing cancelled or failed", "error");
  }
}

async function stopScreenShare() {
  if (!isScreenSharing) return;
  try {
    if (peerConnection) {
      const sender = peerConnection
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender && localCallStream) {
        const localVideoTrack = localCallStream.getVideoTracks()[0];
        if (localVideoTrack) await sender.replaceTrack(localVideoTrack);
      }
    }
    isScreenSharing = false;
    const btn = document.getElementById("screenShareBtn");
    if (btn) {
      btn.textContent = "Screen";
      btn.classList.remove("active");
    }
    showToast("Screen sharing stopped");
  } catch (e) {
    showToast("Failed to stop screen sharing", "error");
  }
}

// ========================================
// FEATURE 3: VIDEO MESSAGES (RECORDING)
// ========================================

async function startVideoRecording() {
  if (isVideoRecording) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showToast("Video recording not supported", "error");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    const mimeType = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : "video/webm";
    videoRecorder = new MediaRecorder(stream, { mimeType });
    videoChunks = [];
    videoRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) videoChunks.push(event.data);
    };
    videoRecorder.onstop = async () => {
      const videoBlob = new Blob(videoChunks, { type: mimeType });
      const formData = new FormData();
      formData.append("file", videoBlob);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("resource_type", "video");
      try {
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
          { method: "POST", body: formData },
        );
        const data = await response.json();
        if (data.secure_url) {
          const duration = Math.floor(
            (Date.now() - videoRecordingStartTime) / 1000,
          );
          await sendVideoMessage(data.secure_url, duration);
        }
      } catch (error) {
        showToast("Failed to send video message", "error");
      }
      stream.getTracks().forEach((track) => track.stop());
    };
    videoRecorder.start(100);
    isVideoRecording = true;
    videoRecordingStartTime = Date.now();
    showToast("Recording video...");
  } catch (error) {
    showToast("Camera access denied", "error");
  }
}

function stopVideoRecording() {
  if (
    videoRecorder &&
    isVideoRecording &&
    videoRecorder.state === "recording"
  ) {
    videoRecorder.stop();
    isVideoRecording = false;
    showToast("Video recording stopped");
  }
}

async function sendVideoMessage(videoUrl, duration) {
  if (!currentChat) return;
  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email.split("@")[0],
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    read: false,
    readBy: { [currentUser.uid]: new Date() },
    type: "video",
    attachment: { type: "video", url: videoUrl, duration },
  };
  if (currentChatType === "direct") messageData.directId = currentChat.id;
  else messageData.groupId = currentChat.id;
  await db.collection("messages").add(messageData);
}

// ========================================
// FEATURE 4: PICTURE-IN-PICTURE MODE
// ========================================

async function enterPipMode() {
  const videoEl = document.getElementById("remoteVideo");
  if (!videoEl) {
    showToast("No video element found", "error");
    return;
  }
  try {
    if (documentPictureInPicture && documentPictureInPicture.requestWindow) {
      await documentPictureInPicture.requestWindow({ width: 400, height: 300 });
      document.body.appendChild(videoEl);
      videoEl.style.width = "100%";
      videoEl.style.height = "100%";
    } else if (videoEl.requestPictureInPicture) {
      await videoEl.requestPictureInPicture();
    } else {
      showToast("Picture-in-Picture not supported", "error");
      return;
    }
    isPipActive = true;
    const btn = document.getElementById("pipBtn");
    if (btn) {
      btn.textContent = "Exit PiP";
      btn.classList.add("active");
    }
    showToast("Picture-in-Picture mode enabled");
  } catch (e) {
    showToast("Failed to enter Picture-in-Picture mode", "error");
  }
}

async function exitPipMode() {
  try {
    if (documentPictureInPicture && documentPictureInPicture.window) {
      documentPictureInPicture.window.close();
    } else if (document.exitPictureInPicture) {
      await document.exitPictureInPicture();
    }
    isPipActive = false;
    const btn = document.getElementById("pipBtn");
    if (btn) {
      btn.textContent = "PiP";
      btn.classList.remove("active");
    }
    showToast("Picture-in-Picture mode disabled");
  } catch (e) {
    showToast("Failed to exit Picture-in-Picture mode", "error");
  }
}

// ========================================
// FEATURE 5: CHAT TAGS/LABELS
// ========================================

async function addChatTag(chatId, label, color) {
  if (!chatId || !currentUser) return;
  const tagData = {
    label,
    color,
    addedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  await db
    .collection("directChats")
    .doc(chatId)
    .collection("chatTags")
    .doc(currentUser.uid)
    .set(tagData);
  chatTags[chatId] = tagData;
  loadCurrentChatList();
  showToast("Tag added");
}

async function removeChatTag(chatId) {
  if (!chatId || !currentUser) return;
  await db
    .collection("directChats")
    .doc(chatId)
    .collection("chatTags")
    .doc(currentUser.uid)
    .delete();
  delete chatTags[chatId];
  loadCurrentChatList();
  showToast("Tag removed");
}

async function getChatTags() {
  if (!currentUser) return;
  try {
    const snapshot = await db
      .collectionGroup("chatTags")
      .where(firebase.firestore.FieldPath.documentId(), "==", currentUser.uid)
      .get();
    chatTags = {};
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const chatId = doc.ref.parent.parent?.id;
      if (chatId) chatTags[chatId] = { label: data.label, color: data.color };
    });
  } catch (e) {
    console.warn("getChatTags error:", e);
  }
}

// ========================================
// FEATURE 6: CONTACT CARD SHARING
// ========================================

function openContactPickerModal() {
  if (!currentChat) {
    showToast("Open a chat first", "error");
    return;
  }
  const modal = document.getElementById("contactPickerModal");
  if (!modal) return;
  modal.style.display = "flex";
  renderContactPickerList("");
}

function renderContactPickerList(query) {
  const list = document.getElementById("contactPickerList");
  if (!list) return;
  const q = (query || "").toLowerCase().trim();
  const filtered = allUsers.filter(
    (u) =>
      u.id !== currentUser.uid &&
      !isBlocked(u.id) &&
      (q === "" ||
        (u.displayName || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)),
  );
  list.innerHTML = "";
  if (!filtered.length) {
    list.innerHTML =
      '<div class="empty-state" style="padding:20px;">No contacts found</div>';
    return;
  }
  filtered.forEach((user) => {
    const div = document.createElement("div");
    div.className = "contact-picker-item";
    const avatar = user.photoURL
      ? `<img src="${escapeHtml(user.photoURL)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">${(user.displayName || user.email || "?")[0].toUpperCase()}</div>`;
    div.innerHTML = `${avatar}<div><strong>${escapeHtml(user.displayName || user.email || "Unknown")}</strong>${user.email ? `<br><span style="font-size:12px;color:var(--muted-strong)">${escapeHtml(user.email)}</span>` : ""}</div>`;
    div.onclick = () => sendContactCard(user);
    list.appendChild(div);
  });
}

async function sendContactCard(user) {
  if (!currentChat || !currentUser || !user) return;
  const contactData = {
    userId: user.id,
    displayName: user.displayName || user.email || "Unknown",
    phone: user.phone || "",
    email: user.email || "",
    avatar: user.photoURL || "",
  };
  const directParticipants =
    currentChatType === "direct"
      ? [
          ...new Set(
            [
              currentUser.uid,
              ...String(currentChat?.id || "")
                .split("_")
                .filter(Boolean),
              currentChat?.otherUserId,
            ].filter(Boolean),
          ),
        ]
      : [];
  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text: "",
    type: "contact",
    contact: contactData,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: "sent",
    read: false,
    readBy: {
      [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
    },
    deliveredTo: {},
    participants:
      currentChatType === "direct"
        ? directParticipants
        : [
            ...new Set(
              (currentGroupMembers || [])
                .map((m) => m.id)
                .concat(currentUser.uid)
                .filter(Boolean),
            ),
          ],
  };
  if (currentChatType === "direct") messageData.directId = currentChat.id;
  else messageData.groupId = currentChat.id;
  try {
    await db.collection("messages").add(messageData);
    document.getElementById("contactPickerModal").style.display = "none";
    showToast("Contact shared!");
  } catch (e) {
    showToast("Failed to share contact", "error");
  }
}

function renderContactCard(contact) {
  if (!contact) return "";
  const name = escapeHtml(contact.displayName || "Unknown");
  const avatar = contact.avatar
    ? `<img src="${escapeHtml(contact.avatar)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
    : `<div style="width:40px;height:40px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">${name[0].toUpperCase()}</div>`;
  return `
    <div class="contact-card">
      <div class="contact-card-header">${avatar}<strong>${name}</strong></div>
      <div class="contact-card-body">
        ${contact.phone ? `<span>📞 ${escapeHtml(contact.phone)}</span>` : ""}
        ${contact.email ? `<span>📧 ${escapeHtml(contact.email)}</span>` : ""}
      </div>
    </div>
  `;
}

// ========================================
// FEATURE 7: EVENT SCHEDULING / CALENDAR
// ========================================

async function sendEventMessage(eventData) {
  if (!currentChat || !currentUser || !eventData) return;
  const directParticipants =
    currentChatType === "direct"
      ? [
          ...new Set(
            [
              currentUser.uid,
              ...String(currentChat?.id || "")
                .split("_")
                .filter(Boolean),
              currentChat?.otherUserId,
            ].filter(Boolean),
          ),
        ]
      : [];
  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text: "",
    type: "event",
    event: {
      title: eventData.title || "Event",
      date: eventData.date || "",
      time: eventData.time || "",
      description: eventData.description || "",
      location: eventData.location || "",
    },
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: "sent",
    read: false,
    readBy: {
      [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
    },
    deliveredTo: {},
    participants:
      currentChatType === "direct"
        ? directParticipants
        : [
            ...new Set(
              (currentGroupMembers || [])
                .map((m) => m.id)
                .concat(currentUser.uid)
                .filter(Boolean),
            ),
          ],
  };
  if (currentChatType === "direct") messageData.directId = currentChat.id;
  else messageData.groupId = currentChat.id;
  try {
    await db.collection("messages").add(messageData);
    document.getElementById("eventModal").style.display = "none";
    showToast("Event shared!");
  } catch (e) {
    showToast("Failed to share event", "error");
  }
}

function renderEventCard(event) {
  if (!event) return "";
  const dateStr = event.date
    ? new Date(event.date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";
  return `
    <div class="event-card">
      <div class="event-card-header">📅 ${escapeHtml(event.title || "Event")}</div>
      <div class="event-card-body">
        ${dateStr ? `<span>📆 ${escapeHtml(dateStr)}</span>` : ""}
        ${event.time ? `<span>⏰ ${escapeHtml(event.time)}</span>` : ""}
        ${event.location ? `<span>📍 ${escapeHtml(event.location)}</span>` : ""}
        ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
      </div>
    </div>
  `;
}

// ========================================
// FEATURE 8: COLLABORATIVE LISTS / SHOPPING LISTS
// ========================================

async function sendListMessage(items) {
  if (!currentChat || !currentUser || !items || !items.length) return;
  const listItems = items.map((item) => ({
    text: item.text || "",
    checked: false,
    checkedBy: null,
  }));
  const directParticipants =
    currentChatType === "direct"
      ? [
          ...new Set(
            [
              currentUser.uid,
              ...String(currentChat?.id || "")
                .split("_")
                .filter(Boolean),
              currentChat?.otherUserId,
            ].filter(Boolean),
          ),
        ]
      : [];
  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text: "",
    type: "list",
    list: { title: "Shopping List", items: listItems },
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: "sent",
    read: false,
    readBy: {
      [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
    },
    deliveredTo: {},
    participants:
      currentChatType === "direct"
        ? directParticipants
        : [
            ...new Set(
              (currentGroupMembers || [])
                .map((m) => m.id)
                .concat(currentUser.uid)
                .filter(Boolean),
            ),
          ],
  };
  if (currentChatType === "direct") messageData.directId = currentChat.id;
  else messageData.groupId = currentChat.id;
  try {
    await db.collection("messages").add(messageData);
    document.getElementById("createListModal").style.display = "none";
    showToast("List shared!");
  } catch (e) {
    showToast("Failed to share list", "error");
  }
}

async function toggleListItem(messageId, itemIndex) {
  if (!messageId || itemIndex === undefined || !currentUser) return;
  const msgDoc = await db.collection("messages").doc(messageId).get();
  if (!msgDoc.exists) return;
  const msg = msgDoc.data();
  const items = msg.list?.items || [];
  if (itemIndex < 0 || itemIndex >= items.length) return;
  const item = items[itemIndex];
  const newChecked = !item.checked;
  const updates = {};
  updates[`list.items.${itemIndex}.checked`] = newChecked;
  updates[`list.items.${itemIndex}.checkedBy`] = newChecked
    ? currentUser.uid
    : null;
  await db.collection("messages").doc(messageId).update(updates);
}

function renderListCard(list) {
  if (!list || !list.items) return "";
  const items = list.items || [];
  const title = list.title || "List";
  const checkedCount = items.filter((i) => i.checked).length;
  return `
    <div class="list-card">
      <div class="list-card-header">📋 ${escapeHtml(title)} (${checkedCount}/${items.length})</div>
      <div class="list-card-items">
        ${items
          .map(
            (item, index) => `
          <label class="list-item-row">
            <input type="checkbox" class="list-item-checkbox" ${item.checked ? "checked" : ""} data-item-index="${index}">
            <span style="${item.checked ? "text-decoration:line-through;color:#94a3b8;" : ""}">${escapeHtml(item.text)}</span>
          </label>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

async function sendSticker(sticker) {
  document.getElementById("emojiPicker").style.display = "none";
  if (!currentChat || !currentUser) return;
  const url = sticker.url || "";
  const emoji = sticker.emoji || "";
  const directParticipants =
    currentChatType === "direct"
      ? [
          ...new Set(
            [
              currentUser.uid,
              ...String(currentChat?.id || "")
                .split("_")
                .filter(Boolean),
              currentChat?.otherUserId,
            ].filter(Boolean),
          ),
        ]
      : [];
  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text: "",
    sticker: { url, emoji },
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: "sent",
    read: false,
    readBy: {
      [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
    },
    deliveredTo: {},
    participants:
      currentChatType === "direct"
        ? directParticipants
        : [
            ...new Set(
              (currentGroupMembers || [])
                .map((m) => m.id)
                .concat(currentUser.uid)
                .filter(Boolean),
            ),
          ],
  };
  if (currentChatType === "direct") messageData.directId = currentChat.id;
  else messageData.groupId = currentChat.id;
  try {
    await db.collection("messages").add(messageData);
  } catch (e) {
    showToast("Failed to send sticker", "error");
  }
}

// ========================================
// FEATURE: File Preview
// ========================================
function getFilePreviewType(url, filename = "") {
  const source = filename || url || "";
  const ext = source.split("?")[0].split(".").pop().toLowerCase();
  if (["pdf"].includes(ext)) return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico"].includes(ext))
    return "image";
  if (
    [
      "txt",
      "csv",
      "log",
      "md",
      "json",
      "xml",
      "html",
      "css",
      "js",
      "ts",
    ].includes(ext)
  )
    return "text";
  return "download";
}
function previewFile(url, filename) {
  const modal = document.getElementById("filePreviewModal");
  if (!modal) return;
  const type = getFilePreviewType(url, filename);
  const container = document.getElementById("filePreviewContainer");
  const header = document.getElementById("filePreviewHeader");
  const safeUrl = escapeHtml(url || "");
  const safeFilename = escapeHtml(filename || "File Preview");
  modal.classList.toggle("image-preview-mode", type === "image");
  modal.classList.toggle("document-preview-mode", type !== "image");
  if (header) header.textContent = filename || "File Preview";
  if (container)
    container.className = `file-preview-container file-preview-${type}`;
  if (type === "pdf") {
    container.innerHTML =
      '<iframe src="' +
      safeUrl +
      '" title="' +
      safeFilename +
      '" allowfullscreen></iframe>';
  } else if (type === "image") {
    container.innerHTML =
      '<div class="file-preview-image-stage"><img src="' +
      safeUrl +
      '" alt="' +
      safeFilename +
      '"><div class="file-preview-fallback"><strong>Image unavailable</strong><span>This media could not be loaded.</span><a class="btn btn-primary" href="' +
      safeUrl +
      '" target="_blank" rel="noopener" download>Open or Download</a></div></div>';
    const img = container.querySelector("img");
    img?.addEventListener(
      "error",
      () =>
        container
          .querySelector(".file-preview-image-stage")
          ?.classList.add("is-broken"),
      { once: true },
    );
  } else if (type === "text") {
    container.innerHTML =
      '<div style="padding:20px;font-family:monospace;white-space:pre-wrap;overflow:auto;height:100%;" id="filePreviewText">Loading...</div>';
    fetch(url)
      .then(function (r) {
        return r.text();
      })
      .then(function (t) {
        var el = document.getElementById("filePreviewText");
        if (el) el.textContent = t;
      })
      .catch(function () {
        var el = document.getElementById("filePreviewText");
        if (el) el.textContent = "Failed to load file content.";
      });
  } else {
    container.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;"><span style="font-size:48px;">📄</span><p>' +
      (filename || "File") +
      '</p><a href="' +
      url +
      '" class="btn btn-primary" target="_blank" rel="noopener" download>Download File</a></div>';
  }
  modal.style.display = "flex";
}

// ========================================
// FEATURE: Encryption Badge
// ========================================
async function updateEncryptionBadge(chatId, chatType) {
  var badge = document.getElementById("encryptionBadge");
  if (!badge) return;
  try {
    var encrypted = false;
    if (chatType === "direct") {
      var doc = await db.collection("directChats").doc(chatId).get();
      encrypted = doc.data() && doc.data().encryptionEnabled === true;
    } else if (chatType === "group") {
      var doc = await db.collection("groups").doc(chatId).get();
      encrypted = doc.data() && doc.data().encryptionEnabled === true;
    }
    if (encrypted) {
      badge.innerHTML = "🔒";
      badge.className = "encryption-badge encrypted";
      badge.title = "Messages are end-to-end encrypted";
    } else {
      badge.innerHTML = "🔓";
      badge.className = "encryption-badge unencrypted";
      badge.title = "Not encrypted";
    }
  } catch (e) {
    badge.innerHTML = "🔓";
    badge.className = "encryption-badge unencrypted";
    badge.title = "Not encrypted";
  }
}

// ========================================
// FEATURE: View Once Messages
// ========================================
async function sendViewOnceMessage(file) {
  if (!currentChat || !currentUser) return;
  try {
    var url = file.type.startsWith("image/")
      ? await uploadToCloudinary(file)
      : await uploadDocument(file);
    var directParticipants =
      currentChatType === "direct"
        ? [
            ...new Set(
              [
                currentUser.uid,
                ...String((currentChat && currentChat.id) || "")
                  .split("_")
                  .filter(Boolean),
                currentChat && currentChat.otherUserId,
              ].filter(Boolean),
            ),
          ]
        : [];
    var messageData = {
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email,
      text: "",
      attachment: {
        type: file.type.startsWith("image/") ? "image" : "document",
        url: url,
        filename: file.name,
        size: file.size,
      },
      viewOnce: true,
      viewedBy: [],
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: "sent",
      read: false,
      readBy: {},
      deliveredTo: {},
      participants:
        currentChatType === "direct"
          ? directParticipants
          : [
              ...new Set(
                (currentGroupMembers || [])
                  .map(function (m) {
                    return m.id;
                  })
                  .concat(currentUser.uid)
                  .filter(Boolean),
              ),
            ],
    };
    messageData.readBy[currentUser.uid] =
      firebase.firestore.FieldValue.serverTimestamp();
    if (currentChatType === "direct") messageData.directId = currentChat.id;
    else messageData.groupId = currentChat.id;
    await db.collection("messages").add(messageData);
    var textBytes = new Blob([file.name || ""]).size;
    trackDataUsage((file.size || 0) + textBytes, "sent");
    showToast("View once message sent");
  } catch (e) {
    showToast("Failed to send view once message", "error");
  }
}

// ========================================
// FEATURE: Screenshot Warning
// ========================================
function notifyScreenshotAttempt(chatId) {
  var chatName =
    (currentChat && (currentChat.otherUserName || currentChat.name)) ||
    "this chat";
  showToast("Screenshot detected in " + chatName, "error");
  try {
    db.collection("messages")
      .add({
        senderId: "system",
        senderName: "System",
        text: "Screenshot captured in " + chatName,
        type: "system",
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        chatId: chatId,
        chatType: currentChatType,
      })
      .catch(function () {});
  } catch (e) {}
}

// ========================================
// FEATURE: Data Usage Tracker
// ========================================
function trackDataUsage(bytes, direction) {
  var key = "tc_data_usage";
  var data;
  try {
    data = JSON.parse(localStorage.getItem(key)) || {
      sentBytes: 0,
      receivedBytes: 0,
      lastReset: Date.now(),
    };
  } catch (e) {
    data = { sentBytes: 0, receivedBytes: 0, lastReset: Date.now() };
  }
  if (direction === "sent") data.sentBytes += bytes;
  else if (direction === "received") data.receivedBytes += bytes;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}
function formatDataBytes(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
  return bytes + " B";
}
function showDataUsageModal() {
  var modal = document.getElementById("dataUsageModal");
  if (!modal) return;
  var key = "tc_data_usage";
  var data;
  try {
    data = JSON.parse(localStorage.getItem(key)) || {
      sentBytes: 0,
      receivedBytes: 0,
      lastReset: Date.now(),
    };
  } catch (e) {
    data = { sentBytes: 0, receivedBytes: 0, lastReset: Date.now() };
  }
  document.getElementById("dataUsageSent").textContent = formatDataBytes(
    data.sentBytes,
  );
  document.getElementById("dataUsageReceived").textContent = formatDataBytes(
    data.receivedBytes,
  );
  document.getElementById("dataUsageTotal").textContent = formatDataBytes(
    data.sentBytes + data.receivedBytes,
  );
  document.getElementById("dataUsageLastReset").textContent = new Date(
    data.lastReset,
  ).toLocaleDateString();
  modal.style.display = "flex";
}

// ========================================
// FEATURE: Storage Manager
// ========================================
var cachedStorageBreakdown = [];
async function getStorageBreakdown() {
  if (!currentUser) return { breakdown: [], totalBytes: 0 };
  var breakdown = [];
  var totalBytes = 0;
  var snapshot;
  try {
    snapshot = await db.collection("messages").get();
  } catch (e) {
    return { breakdown: [], totalBytes: 0 };
  }
  var chatSizes = {};
  var chatNames = {};
  snapshot.docs.forEach(function (doc) {
    var msg = doc.data();
    var chatId = msg.directId || msg.groupId;
    if (!chatId) return;
    if (!chatSizes[chatId]) chatSizes[chatId] = { bytes: 0, count: 0 };
    var textBytes = new Blob([msg.text || ""]).size;
    var attachBytes = (msg.attachment && msg.attachment.size) || 0;
    chatSizes[chatId].bytes += textBytes + attachBytes;
    chatSizes[chatId].count += 1;
    totalBytes += textBytes + attachBytes;
    if (!chatNames[chatId])
      chatNames[chatId] = msg.directId
        ? "Direct Chat"
        : msg.groupName || "Group";
  });
  for (var chatId in chatSizes) {
    if (chatSizes.hasOwnProperty(chatId)) {
      breakdown.push({
        chatId: chatId,
        bytes: chatSizes[chatId].bytes,
        count: chatSizes[chatId].count,
        name: chatNames[chatId],
      });
    }
  }
  breakdown.sort(function (a, b) {
    return b.bytes - a.bytes;
  });
  cachedStorageBreakdown = breakdown;
  return { breakdown: breakdown, totalBytes: totalBytes };
}
async function showStorageManager() {
  var modal = document.getElementById("storageManagerModal");
  if (!modal) return;
  var content = document.getElementById("storageManagerContent");
  if (content) content.innerHTML = "Calculating storage usage...";
  modal.style.display = "flex";
  var result = await getStorageBreakdown();
  var breakdown = result.breakdown;
  var totalBytes = result.totalBytes;
  var totalEl = document.getElementById("storageManagerTotal");
  if (totalEl) totalEl.textContent = formatDataBytes(totalBytes);
  var list = document.getElementById("storageManagerContent");
  if (!list) return;
  if (!breakdown.length) {
    list.innerHTML =
      '<div style="padding:20px;text-align:center;color:var(--muted)">No data found</div>';
    return;
  }
  list.innerHTML = breakdown
    .map(function (item) {
      return (
        '<div class="storage-item"><div class="storage-item-info"><strong>' +
        escapeHtml(item.name) +
        "</strong><span>" +
        formatDataBytes(item.bytes) +
        " (" +
        item.count +
        ' messages)</span></div><button class="btn btn-outline storage-clear-btn" data-chat-id="' +
        item.chatId +
        '" style="font-size:11px;padding:4px 10px;">Clear Media</button></div>'
      );
    })
    .join("");
  list.querySelectorAll(".storage-clear-btn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      if (!confirm("Clear media for this chat? This cannot be undone.")) return;
      var chatId = btn.dataset.chatId;
      var field = chatId.indexOf("_") > -1 ? "directId" : "groupId";
      try {
        var msgs = await db
          .collection("messages")
          .where(field, "==", chatId)
          .get();
        var batch = db.batch();
        msgs.docs.forEach(function (doc) {
          if (doc.data().attachment)
            batch.update(doc.ref, { attachment: null });
        });
        await batch.commit();
        showToast("Media cleared for this chat");
        showStorageManager();
      } catch (e) {
        showToast("Failed to clear media", "error");
      }
    });
  });
}

// ========================================
// FEATURE: Suggested Replies
// ========================================
function getSuggestedReplies(lastMessage) {
  var text = ((lastMessage && lastMessage.text) || "").toLowerCase();
  if (text.indexOf("?") > -1) return ["Yes", "No", "Maybe"];
  if (text.indexOf("thank") > -1)
    return ["You're welcome!", "Anytime!", "Glad to help"];
  if (text === "ok" || text === "okay" || text === "k")
    return ["Great!", "Sounds good", "Let me know"];
  return ["OK", "Thanks!", "Sure"];
}
function renderSuggestedReplies(messagesArea) {
  if (!messagesArea) return;
  var existing = messagesArea.querySelector(".suggested-replies-bar");
  if (existing) existing.remove();
  var allMessages = messagesArea.querySelectorAll(
    ".message:not(.call-message)",
  );
  if (!allMessages.length) return;
  var lastMsg = allMessages[allMessages.length - 1];
  var isFromOther = !lastMsg.classList.contains("my-message");
  if (!isFromOther) return;
  var msgEl = lastMsg.querySelector(".message-text");
  if (!msgEl) return;
  var replies = getSuggestedReplies({ text: msgEl.textContent || "" });
  var bar = document.createElement("div");
  bar.className = "suggested-replies-bar";
  replies.forEach(function (reply) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggested-reply-btn";
    btn.textContent = reply;
    btn.addEventListener("click", async function () {
      var input = document.getElementById("messageInput");
      if (input) {
        input.value = reply;
        await sendMessage();
      }
    });
    bar.appendChild(btn);
  });
  messagesArea.appendChild(bar);
}

// ========================================
// FEATURE: Sub-Groups / Communities
// ========================================

async function createCommunity() {
  const name = document.getElementById("newCommunityName")?.value.trim();
  const description = document
    .getElementById("newCommunityDescription")
    ?.value.trim();
  const icon =
    document.getElementById("newCommunityIcon")?.value.trim() || "🏠";
  if (!name || !currentUser) {
    showToast("Please enter a community name", "error");
    return;
  }
  try {
    const ref = await db.collection("communities").add({
      name,
      description,
      icon,
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      memberCount: 1,
    });
    await db.collection("communityMembers").add({
      communityId: ref.id,
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
      role: "admin",
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    document.getElementById("createCommunityModal").style.display = "none";
    document.getElementById("newCommunityName").value = "";
    document.getElementById("newCommunityDescription").value = "";
    showToast("Community created!");
    loadCommunitiesList();
  } catch (e) {
    showToast("Failed to create community", "error");
  }
}

async function loadCommunitiesList() {
  const container = document.getElementById("communitiesList");
  if (!container) return;
  container.innerHTML = "";
  try {
    const snap = await db
      .collection("communities")
      .orderBy("createdAt", "desc")
      .get();
    if (snap.empty) {
      container.innerHTML = '<div class="empty-state">No communities yet</div>';
      return;
    }
    for (const doc of snap.docs) {
      const data = doc.data();
      const div = document.createElement("div");
      div.className = "community-item";
      div.innerHTML = `
        <div class="community-icon">${data.icon || "🏠"}</div>
        <div class="community-info">
          <div class="community-name">${escapeHtml(data.name)}</div>
          ${data.description ? `<div class="community-desc">${escapeHtml(data.description)}</div>` : ""}
          <div class="community-member-count">${data.memberCount || 0} members</div>
        </div>
        <button class="community-badge" onclick="event.stopPropagation(); showCommunityInfo('${doc.id}')">Info</button>
      `;
      div.onclick = () => showCommunityInfo(doc.id);
      container.appendChild(div);
    }
  } catch (e) {
    container.innerHTML =
      '<div class="empty-state">Failed to load communities</div>';
  }
}

async function addGroupToCommunity(communityId, groupId) {
  if (!currentUser) return;
  try {
    await db
      .collection("communityGroups")
      .doc(communityId)
      .collection("groups")
      .doc(groupId)
      .set({
        groupId,
        addedAt: firebase.firestore.FieldValue.serverTimestamp(),
        addedBy: currentUser.uid,
      });
    showToast("Group added to community!");
  } catch (e) {
    showToast("Failed to add group", "error");
  }
}

async function showCommunityInfo(communityId) {
  const modal = document.getElementById("communityInfoModal");
  const content = document.getElementById("communityInfoContent");
  const title = document.getElementById("communityInfoTitle");
  if (!modal || !content) return;
  modal.style.display = "flex";
  content.innerHTML =
    '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">Loading...</div>';
  try {
    const doc = await db.collection("communities").doc(communityId).get();
    if (!doc.exists) {
      content.innerHTML =
        '<div style="text-align:center;padding:20px;color:var(--muted);">Community not found</div>';
      return;
    }
    const data = doc.data();
    title.textContent = data.name || "Community Info";

    let html = `<div style="text-align:center;margin-bottom:16px;"><span style="font-size:48px;">${data.icon || "🏠"}</span><h3>${escapeHtml(data.name)}</h3>`;
    if (data.description)
      html += `<p style="font-size:13px;color:var(--muted);">${escapeHtml(data.description)}</p>`;
    html += `<p style="font-size:12px;color:var(--muted-strong);margin-top:4px;">${data.memberCount || 0} members</p></div>`;

    // Members
    const membersSnap = await db
      .collection("communityMembers")
      .where("communityId", "==", communityId)
      .get();
    html += `<h4 style="margin:12px 0 8px;font-size:14px;">Members (${membersSnap.size})</h4>`;
    if (membersSnap.empty) {
      html +=
        '<div style="font-size:13px;color:var(--muted);padding:8px 0;">No members</div>';
    } else {
      membersSnap.forEach((m) => {
        const mData = m.data();
        html += `<div class="community-member-row"><span>${escapeHtml(mData.userName || "Unknown")}</span><span class="community-member-role">${mData.role || "member"}</span></div>`;
      });
    }

    // Groups in community
    const groupsSnap = await db
      .collection("communityGroups")
      .doc(communityId)
      .collection("groups")
      .get();
    html += `<h4 style="margin:12px 0 8px;font-size:14px;">Groups (${groupsSnap.size})</h4>`;
    if (groupsSnap.empty) {
      html +=
        '<div style="font-size:13px;color:var(--muted);padding:8px 0;">No groups added yet</div>';
    } else {
      groupsSnap.forEach((g) => {
        html += `<div class="community-group-row"><span>${escapeHtml(g.id)}</span></div>`;
      });
    }

    content.innerHTML = html;
  } catch (e) {
    content.innerHTML =
      '<div style="text-align:center;padding:20px;color:var(--muted);">Error loading community info</div>';
  }
}

// ========================================
// FEATURE: Animated Stickers
// ========================================

async function addAnimatedStickerPack(name, frames, frameDuration) {
  if (!currentUser) return null;
  try {
    const ref = await db.collection("animatedStickerPacks").add({
      name,
      frames,
      frameDuration: frameDuration || 150,
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    return null;
  }
}

async function loadAnimatedStickers() {
  const grid = document.getElementById("animatedStickerGrid");
  const empty = document.getElementById("animatedStickerEmpty");
  if (!grid) return;
  grid.innerHTML = "";
  const packs = [];
  try {
    const snap = await db.collection("animatedStickerPacks").get();
    snap.forEach((doc) => {
      const p = doc.data();
      packs.push({ packId: doc.id, ...p });
    });
  } catch (e) {}
  // Include built-in packs
  if (window._builtInAnimatedPacks) {
    window._builtInAnimatedPacks.forEach((p) => {
      if (!packs.find((x) => x.name === p.name)) packs.push(p);
    });
  }
  if (!packs.length) {
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";
  packs.forEach((pack) => {
    const section = document.createElement("div");
    section.style.marginBottom = "12px";
    let html = `<div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px;">${escapeHtml(pack.name)}</div>`;
    html += '<div class="animated-sticker-grid">';
    if (pack.frames && pack.frames.length) {
      const stickerData = {
        packId: pack.packId || "",
        frames: pack.frames,
        frameDuration: pack.frameDuration || 150,
      };
      html += `<div class="animated-sticker-item" data-sticker='${escapeHtml(JSON.stringify(stickerData))}'></div>`;
    }
    html += "</div>";
    section.innerHTML = html;
    const item = section.querySelector(".animated-sticker-item");
    if (item) {
      const stickerData = JSON.parse(item.dataset.sticker);
      renderAnimatedSticker(stickerData, item);
      item.onclick = () => sendAnimatedSticker(stickerData);
    }
    grid.appendChild(section);
  });
}

function renderAnimatedSticker(sticker, container) {
  if (!sticker || !sticker.frames || !sticker.frames.length || !container)
    return;
  const img = document.createElement("img");
  img.style.cssText = "width:100%;height:100%;object-fit:contain;";
  let frameIndex = 0;
  img.src = sticker.frames[0];
  const interval = setInterval(() => {
    frameIndex = (frameIndex + 1) % sticker.frames.length;
    img.src = sticker.frames[frameIndex];
  }, sticker.frameDuration || 150);
  container.innerHTML = "";
  container.appendChild(img);
  container._stickerInterval = interval;
}

async function sendAnimatedSticker(sticker) {
  document.getElementById("emojiPicker").style.display = "none";
  if (!currentChat || !currentUser) return;
  const directParticipants =
    currentChatType === "direct"
      ? [
          ...new Set(
            [
              currentUser.uid,
              ...String(currentChat?.id || "")
                .split("_")
                .filter(Boolean),
              currentChat?.otherUserId,
            ].filter(Boolean),
          ),
        ]
      : [];
  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text: "",
    type: "animated_sticker",
    animatedSticker: {
      frames: sticker.frames,
      frameDuration: sticker.frameDuration || 150,
      packId: sticker.packId || "",
    },
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: "sent",
    read: false,
    readBy: {
      [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp(),
    },
    deliveredTo: {},
    participants:
      currentChatType === "direct"
        ? directParticipants
        : [
            ...new Set(
              (currentGroupMembers || [])
                .map((m) => m.id)
                .concat(currentUser.uid)
                .filter(Boolean),
            ),
          ],
  };
  if (currentChatType === "direct") messageData.directId = currentChat.id;
  else messageData.groupId = currentChat.id;
  try {
    await db.collection("messages").add(messageData);
  } catch (e) {
    showToast("Failed to send animated sticker", "error");
  }
}

function createBuiltInAnimatedPacks() {
  // Create Wave pack using canvas-drawn waving hand frames
  function createWaveFrame(step) {
    const c = document.createElement("canvas");
    c.width = 120;
    c.height = 120;
    const ctx = c.getContext("2d");
    ctx.font = "60px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const rotations = [0, -0.2, 0.2, -0.1];
    ctx.save();
    ctx.translate(60, 60);
    ctx.rotate(rotations[step] || 0);
    ctx.fillText("👋", 0, 0);
    ctx.restore();
    return c.toDataURL("image/png");
  }
  // Create Heart pack
  function createHeartFrame(step) {
    const c = document.createElement("canvas");
    c.width = 120;
    c.height = 120;
    const ctx = c.getContext("2d");
    ctx.font = "60px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const scales = [1, 1.3, 0.9, 1.2];
    ctx.save();
    ctx.translate(60, 60);
    ctx.scale(scales[step] || 1, scales[step] || 1);
    ctx.fillText("❤️", 0, 0);
    ctx.restore();
    return c.toDataURL("image/png");
  }
  const waveFrames = [];
  for (let i = 0; i < 4; i++) waveFrames.push(createWaveFrame(i));
  const heartFrames = [];
  for (let i = 0; i < 4; i++) heartFrames.push(createHeartFrame(i));

  // Store in a global so the sticker picker can access them
  window._builtInAnimatedPacks = [
    { name: "Wave", frames: waveFrames, frameDuration: 200 },
    { name: "Heart", frames: heartFrames, frameDuration: 200 },
  ];
}

// ========================================
// FEATURE: Message Effects (Confetti/Fireworks)
// ========================================

const EFFECT_COLORS = [
  "#ff6b6b",
  "#ffd93d",
  "#6bcb77",
  "#4d96ff",
  "#ff6b9d",
  "#c44dff",
];

function createParticle(x, y, color) {
  const el = document.createElement("div");
  el.className = "effect-particle";
  const size = 6 + Math.random() * 8;
  el.style.cssText = `
    left:${x}px; top:${y}px;
    width:${size}px; height:${size}px;
    background:${color};
    border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
    animation-duration:${1.5 + Math.random() * 1}s;
    animation-delay:${Math.random() * 0.3}s;
  `;
  document.getElementById("effectOverlay").appendChild(el);
  setTimeout(() => el.remove(), 3000);
  return el;
}

function createConfetti(count) {
  const overlay = document.getElementById("effectOverlay");
  if (!overlay) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "effect-particle";
    const color =
      EFFECT_COLORS[Math.floor(Math.random() * EFFECT_COLORS.length)];
    const size = 4 + Math.random() * 10;
    const x = Math.random() * w;
    el.style.cssText = `
      left:${x}px; top:${-20 - Math.random() * 100}px;
      width:${size}px; height:${size * (0.4 + Math.random() * 0.6)}px;
      background:${color};
      border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
      animation-duration:${1.5 + Math.random() * 1.5}s;
      animation-delay:${Math.random() * 0.5}s;
    `;
    overlay.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

function triggerFireworks() {
  const overlay = document.getElementById("effectOverlay");
  if (!overlay) return;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  for (let burst = 0; burst < 3; burst++) {
    setTimeout(() => {
      const x = cx + (Math.random() - 0.5) * window.innerWidth * 0.6;
      const y = cy + (Math.random() - 0.5) * window.innerHeight * 0.4;
      for (let i = 0; i < 20; i++) {
        const el = document.createElement("div");
        el.className = "effect-particle firework";
        const color =
          EFFECT_COLORS[Math.floor(Math.random() * EFFECT_COLORS.length)];
        const angle = (Math.PI * 2 * i) / 20;
        const dist = 60 + Math.random() * 100;
        el.style.cssText = `
          left:${x}px; top:${y}px;
          width:6px; height:6px;
          background:${color};
          --dx:${Math.cos(angle) * dist}px;
          --dy:${Math.sin(angle) * dist}px;
          animation-duration:${1 + Math.random() * 0.8}s;
        `;
        overlay.appendChild(el);
        setTimeout(() => el.remove(), 2500);
      }
    }, burst * 300);
  }
}

function triggerHearts() {
  const overlay = document.getElementById("effectOverlay");
  if (!overlay) return;
  const w = window.innerWidth;
  for (let i = 0; i < 12; i++) {
    const el = document.createElement("div");
    el.className = "effect-particle heart";
    el.textContent = ["❤️", "💕", "💗", "💖", "💓"][
      Math.floor(Math.random() * 5)
    ];
    el.style.cssText = `
      left:${Math.random() * w}px; bottom:0;
      animation-duration:${1.5 + Math.random() * 1}s;
      animation-delay:${Math.random() * 0.8}s;
      font-size:${18 + Math.random() * 20}px;
    `;
    overlay.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

function triggerCelebration() {
  createConfetti(60);
  setTimeout(triggerFireworks, 600);
}

function triggerMessageEffect(type) {
  switch (type) {
    case "confetti":
      createConfetti(50);
      break;
    case "fireworks":
      triggerFireworks();
      break;
    case "heart":
      triggerHearts();
      break;
    case "celebration":
      triggerCelebration();
      break;
    default:
      createConfetti(40);
  }
}

// ========================================
// FEATURE: Message Search by Date
// ========================================
var currentDateFilter = "";
function searchMessagesByDate(dateStr) {
  currentDateFilter = dateStr;
  var messages = document.querySelectorAll("#messagesArea .message");
  var count = 0;
  messages.forEach(function (msg) {
    var timeEl = msg.querySelector(".message-time");
    if (!timeEl) return;
    var show = true;
    if (dateStr) {
      var msgDate = timeEl.textContent.trim();
      var parts = dateStr.split("-");
      var d = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2]),
      );
      var formatted = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      show = msgDate.indexOf(formatted) > -1;
    }
    msg.style.display = show ? "" : "none";
    if (show) count++;
  });
  var resultCount = document.getElementById("searchResultCount");
  if (resultCount)
    resultCount.textContent =
      count > 0 ? count + " messages on this date" : "No messages found";
  if (count > 0) {
    var firstMsg = document.querySelector(
      '#messagesArea .message:not([style*="display: none"])',
    );
    if (firstMsg)
      firstMsg.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

// ========================================
// FEATURE EVENT LISTENERS
// ========================================
document.addEventListener("DOMContentLoaded", function () {
  const jumpBtn = document.getElementById("jumpToUnreadBtn");
  if (jumpBtn) {
    jumpBtn.addEventListener("click", async function () {
      const msgId = await getFirstUnreadMessageId();
      scrollToMessage(msgId);
      jumpBtn.style.display = "none";
    });
  }

  const msgInput = document.getElementById("messageInput");
  if (msgInput) {
    msgInput.addEventListener("input", function () {
      checkEmojiPredictions(this.value);
    });
  }

  const messagesArea = document.getElementById("messagesArea");
  if (messagesArea) {
    messagesArea.addEventListener("scroll", function () {
      const jumpBtn = document.getElementById("jumpToUnreadBtn");
      if (jumpBtn) jumpBtn.style.display = "none";
    });
  }
});
