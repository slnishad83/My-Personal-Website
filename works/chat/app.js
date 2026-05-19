// ========================================
// COMPLETE CHAT APP - FINAL REFACTOR VERSION
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

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((error) => {
  console.error("Persistence error:", error);
});
const db = firebase.firestore();
const storage = firebase.storage();

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = "du2dsimyz";
const CLOUDINARY_UPLOAD_PRESET = "chat_app_uploads";
const TURN_CREDENTIALS_ENDPOINT =
  "https://us-central1-my-team-chat-2255.cloudfunctions.net/getTurnCredentials";

// Global Variables
let currentUser = null;
let currentChat = null;
let currentChatType = null;
let allUsers = [];
let messagesUnsubscribe = null;
let typingUnsubscribe = null;
let directChatsUnsubscribe = null;
let groupChatsUnsubscribe = null;
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
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let recordingTimer = null;
let wallpaperModalMode = "global";
let chatListRefreshTimer = null;
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
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.opacity = "1";
  setTimeout(() => {
    toast.style.opacity = "0";
  }, 3000);
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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
  const url = escapeHtml(attachment.url);
  const filename = escapeHtml(
    attachment.filename || getFileNameFromUrl(attachment.url) || "Attachment",
  );

  if (attachment.type === "image") {
    return `<div class="message-attachment"><a class="image-attachment-link" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${filename}"></a></div>`;
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
    <a class="file-attachment-card" href="${url}" target="_blank" rel="noopener">
      <span class="file-attachment-icon">${escapeHtml(ext)}</span>
      <span class="file-attachment-info">
        <span class="file-attachment-name">${filename}</span>
        <span class="file-attachment-meta">${escapeHtml(detail || "File")}</span>
      </span>
      <span class="file-attachment-action">Download</span>
    </a>
  `;
}

function getCallIcon(type = "voice", status = "ended") {
  if (status === "missed" || status === "failed") return "↯";
  if (status === "rejected") return "✕";
  return type === "video" ? "🎥" : "📞";
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

function getSavedMessagesChatId() {
  return currentUser ? `saved_${currentUser.uid}` : "";
}

// ========================================
// CORE LIST RENDERING (Unified Fix)
// ========================================
function renderChatListItems(items, container) {
  container.innerHTML = "";
  if (items.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="padding:40px;">No chats yet. Search for people or create a group.</div>';
    return;
  }

  items.forEach((item) => {
    const chatDiv = document.createElement("div");
    chatDiv.className = "list-item";
    chatDiv.dataset.chatId = item.id;
    chatDiv.dataset.chatType = item.type;
    chatDiv.dataset.unreadCount = item.unreadCount || 0;
    if (item.otherUserId || item.user?.id)
      chatDiv.dataset.otherUserId = item.otherUserId || item.user.id;
    chatDiv.dataset.chatName = item.name || "";

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

    let statusChip = "";
    let requestAction = "";
    if (item.type === "user" && item.requestState) {
      const state = item.requestState.status || "none";
      const label = item.requestState.label || "Send request";
      const disabled = state === "sent" ? "disabled" : "";
      requestAction = `<button class="request-action-btn status-chip ${state}" data-user-id="${escapeHtml(item.user?.id || item.rawUser?.id || item.id.replace(/^user_/, ""))}" ${disabled} type="button">${escapeHtml(label)}</button>`;
    } else if (item.type !== "direct" && item.type !== "saved" && item.requestState) {
      statusChip = `<span class="status-chip ${item.requestState.status}">${escapeHtml(item.requestState.label)}</span>`;
    }

    chatDiv.innerHTML = `
      <div class="list-avatar">${item.avatar}</div>
      <div class="list-info" style="flex:1; cursor:pointer;">
        <div class="list-name">${item.isFavorite ? "★ " : ""}${escapeHtml(item.name)} ${item.isMuted ? "🔇" : ""}</div>
        <div class="list-preview">${escapeHtml(item.preview || "")}</div>
      </div>
      ${requestAction || statusChip}
      ${unread}
      <button class="list-item-menu mute-chat-btn" data-chat-id="${item.id}" data-chat-type="${item.type}">🔇</button>
      <button class="list-item-menu archive-chat-btn" data-chat-id="${item.id}" data-chat-type="${item.type}" data-chat-name="${escapeHtml(item.name)}">📦</button>
    `;

    if (item.type === "user" || item.type === "saved") {
      chatDiv
        .querySelectorAll(".mute-chat-btn, .archive-chat-btn")
        .forEach((btn) => btn.remove());
    }

    chatDiv.querySelector(".request-action-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      await handleUserSelection({
        ...(item.user || item.rawUser || item),
        requestState: item.requestState,
      });
    });

    chatDiv
      .querySelector(".archive-chat-btn")
      ?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm(`Archive "${item.name}"?`))
          await archiveChat(item.id, item.type, item.name);
      });

    chatDiv
      .querySelector(".mute-chat-btn")
      ?.addEventListener("click", async (e) => {
        e.stopPropagation();
        const duration = prompt("Mute for: 8h, 1w, or always?", "8h");
        if (duration === "8h" || duration === "1w" || duration === "always") {
          await muteChat(item.id, item.type, duration);
          loadCurrentChatList();
        }
      });

    chatDiv.addEventListener("click", () => {
      if (item.type === "user")
        handleUserSelection({
          ...(item.user || item.rawUser || item),
          requestState: item.requestState,
        });
      else if (item.type === "saved") startSavedMessages();
      else if (item.type === "group") loadGroupChat(item.id, item.name);
      else if (item.user)
        startDirectChat({ ...item.user, aliasDirectIds: item.aliasDirectIds });
      else
        db.collection("users")
          .doc(item.otherUserId)
          .get()
          .then((doc) => {
            startDirectChat(
              doc.exists
                ? {
                    id: item.otherUserId,
                    ...doc.data(),
                    aliasDirectIds: item.aliasDirectIds,
                  }
                : {
                    id: item.otherUserId,
                    displayName: item.name,
                    aliasDirectIds: item.aliasDirectIds,
                  },
            );
          });
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
    isMuted: false,
    lastMessageTime: new Date(8640000000000000),
  };
}

function renderMessageText(text = "", mentions = []) {
  let html = escapeHtml(text);
  mentions.forEach((mention) => {
    const label = escapeHtml(mention.label || mention.name || "");
    if (!label) return;
    const escapedPattern = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(
      new RegExp(`@${escapedPattern}`, "g"),
      `<span class="mention-highlight">@${label}</span>`,
    );
  });
  return html;
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
}

function openMobileChatPanel() {
  document.querySelector(".chat-container")?.classList.add("chat-open");
  pushMobileChatHistory();
}

function closeMobileChatPanel() {
  document.querySelector(".chat-container")?.classList.remove("chat-open");
  mobileChatHistoryOpen = false;
}

function shouldUseMobileBackGuard() {
  return (
    window.matchMedia("(max-width: 768px)").matches ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function pushMobileChatHistory() {
  if (!shouldUseMobileBackGuard() || mobileChatHistoryOpen) return;
  history.pushState({ teamChatView: "chat" }, "", window.location.href);
  mobileChatHistoryOpen = true;
}

function setupMobileBackGuard() {
  if (mobileBackGuardReady) return;
  mobileBackGuardReady = true;
  if (history.state?.teamChatView !== "home") {
    history.replaceState({ teamChatView: "home" }, "", window.location.href);
  }
  window.addEventListener("popstate", () => {
    if (!shouldUseMobileBackGuard()) return;
    const chatContainer = document.querySelector(".chat-container");
    if (chatContainer?.classList.contains("chat-open")) {
      closeMobileChatPanel();
      history.replaceState({ teamChatView: "home" }, "", window.location.href);
      return;
    }
    history.pushState({ teamChatView: "home" }, "", window.location.href);
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
  document.getElementById("messagesArea").innerHTML =
    '<div class="empty-state"><div class="empty-icon">💬</div><p>Select a chat to start messaging</p></div>';
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

function setAttachmentPreview() {
  const preview = document.getElementById("attachmentPreview");
  if (!preview) return;
  if (!currentAttachment) {
    preview.style.display = "none";
    preview.innerHTML = "";
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
  }
  if (input) input.disabled = isSending;
}

function getCallPermissionMessage(error, type = "voice") {
  const device = type === "video" ? "camera and microphone" : "microphone";
  if (!error) return `Please allow ${device} access to continue.`;
  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return `${device[0].toUpperCase()}${device.slice(1)} access was blocked. Allow permission in the browser and try again.`;
  }
  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return `No ${type === "video" ? "camera/microphone" : "microphone"} was found on this device.`;
  }
  if (error.name === "NotReadableError" || error.name === "TrackStartError") {
    return `The ${device} is already in use by another app.`;
  }
  return `Unable to access ${device}. Check device permission and try again.`;
}

function setCallStatus(status) {
  const statusEl = document.getElementById("callStatusText");
  if (statusEl) statusEl.textContent = status;
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
    navigator.vibrate([260, 180, 260]);
    vibrationTimer = setInterval(
      () => navigator.vibrate?.([260, 180, 260]),
      1400,
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
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ringtoneAudioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.08,
        ringtoneAudioContext.currentTime + 0.03,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ringtoneAudioContext.currentTime + 0.42,
      );
      oscillator.connect(gain);
      gain.connect(ringtoneAudioContext.destination);
      oscillator.start();
      oscillator.stop(ringtoneAudioContext.currentTime + 0.45);
    };
    playTone();
    ringtoneTimer = setInterval(playTone, 1500);
  } catch (error) {
    console.warn("Incoming call tone could not start:", error);
  }
}

function notifyIncomingCall(call) {
  if (!document.hidden || Notification.permission !== "granted") return;
  try {
    new Notification(
      call.type === "video" ? "Incoming video call" : "Incoming voice call",
      {
        body: call.fromUserName || "Team Chat",
        tag: `call-${call.id}`,
        requireInteraction: true,
      },
    );
  } catch (error) {
    console.warn("Incoming call notification could not be shown:", error);
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
  const modal = document.getElementById("callModal");
  const shell = modal?.querySelector(".call-shell");
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const audioAvatar = document.getElementById("callAudioAvatar");
  if (!modal) return;
  activeCallMode = mode;
  modal.style.display = "flex";
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
  document.getElementById("toggleCameraBtn").style.display =
    mode === "incoming" ? "none" : "inline-flex";
  if (localVideo)
    localVideo.style.display = type === "video" ? "block" : "none";
  if (remoteVideo)
    remoteVideo.style.display = type === "video" ? "block" : "none";
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
  const localStream = localVideo.srcObject;
  localVideo.srcObject = remoteVideo.srcObject;
  remoteVideo.srcObject = localStream;
  localVideo.dataset.swapped =
    localVideo.dataset.swapped === "true" ? "false" : "true";
}

function setupCallPreviewInteractions() {
  const localVideo = document.getElementById("localVideo");
  const stage = document.querySelector(".call-video-stage");
  if (!localVideo || !stage || localVideo.dataset.previewReady === "true")
    return;
  localVideo.dataset.previewReady = "true";

  let dragStart = null;
  let pointerMoved = false;
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

  localVideo.addEventListener("pointerdown", (event) => {
    if (localVideo.style.display === "none") return;
    const rect = localVideo.getBoundingClientRect();
    pointerMoved = false;
    dragStart = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    localVideo.setPointerCapture?.(event.pointerId);
  });

  localVideo.addEventListener("pointermove", (event) => {
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;
    if (
      Math.abs(event.clientX - dragStart.startX) > 4 ||
      Math.abs(event.clientY - dragStart.startY) > 4
    ) {
      pointerMoved = true;
    }
    const stageRect = stage.getBoundingClientRect();
    const width = localVideo.offsetWidth;
    const height = localVideo.offsetHeight;
    const left = clamp(
      event.clientX - stageRect.left - dragStart.offsetX,
      8,
      stageRect.width - width - 8,
    );
    const top = clamp(
      event.clientY - stageRect.top - dragStart.offsetY,
      8,
      stageRect.height - height - 8,
    );
    localVideo.style.left = `${left}px`;
    localVideo.style.top = `${top}px`;
    localVideo.style.right = "auto";
    localVideo.style.bottom = "auto";
  });

  localVideo.addEventListener("pointerup", (event) => {
    if (dragStart?.pointerId === event.pointerId) dragStart = null;
  });
  localVideo.addEventListener("pointercancel", () => {
    dragStart = null;
  });
  localVideo.addEventListener("click", (event) => {
    if (pointerMoved) {
      event.preventDefault();
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

function cleanupCallUi() {
  clearCallTimeout();
  stopIncomingRingtone();
  stopCallDuration();
  releaseCallWakeLock();
  const modal = document.getElementById("callModal");
  modal.style.display = "none";
  modal.querySelector(".call-shell")?.classList.remove("incoming");
  document.getElementById("callAudioAvatar")?.classList.remove("ringing");
  stopLocalCallStream();
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
  document.getElementById("muteMicBtn")?.classList.remove("active");
  document.getElementById("toggleCameraBtn")?.classList.remove("active");
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
    video: currentCallType === "video",
  });
  document.getElementById("localVideo").srcObject = localCallStream;
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
      stopIncomingRingtone();
      document.getElementById("callAudioAvatar")?.classList.remove("ringing");
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
      setCallStatus("Reconnecting...");
    } else if (state === "failed") {
      setCallStatus("Call failed");
      if (activeCall?.id) await endActiveCall("failed");
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
  const existingVideo = localCallStream.getVideoTracks()[0];
  if (existingVideo) {
    cameraOff = !cameraOff;
    existingVideo.enabled = !cameraOff;
    document
      .getElementById("toggleCameraBtn")
      .classList.toggle("active", cameraOff);
    return;
  }
  try {
    setCallStatus("Starting camera...");
    const videoStream = await navigator.mediaDevices.getUserMedia({
      video: true,
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
    if (activeCall) activeCall.type = "video";
    document.getElementById("callTypeLabel").textContent = "Video call";
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

async function startCall(type = "voice") {
  if (!currentUser || !currentChat || currentChatType !== "direct") {
    showToast("Calls are available for personal chats only", "error");
    return;
  }
  if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
    showToast("Calls are not supported in this browser", "error");
    return;
  }
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
      if (["ended", "rejected", "missed", "failed"].includes(data.status))
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
        ["ended", "rejected", "missed", "failed"].includes(
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

async function endActiveCall(status = "ended") {
  if (activeCall?.id) {
    await writeCallHistory(status);
    await db
      .collection("calls")
      .doc(activeCall.id)
      .update({
        status,
        endedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => {});
  }
  cleanupCallUi();
}

function listenForIncomingCalls() {
  if (!currentUser) return;
  if (incomingCallsUnsubscribe) incomingCallsUnsubscribe();
  incomingCallsUnsubscribe = db
    .collection("calls")
    .where("toUserId", "==", currentUser.uid)
    .where("status", "==", "ringing")
    .onSnapshot((snapshot) => {
      const call = snapshot.docs[0];
      if (!call && activeCallMode === "incoming") {
        cleanupCallUi();
        return;
      }
      if (!call || activeCall) return;
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
    });
}

function handleCallCloseAction() {
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

function getContactMergeKey(item) {
  const email = (item.email || item.user?.email || "").trim().toLowerCase();
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

function normalizeSearchText(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function isFullEmailSearch(term) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(term);
}

function isFullIndianPhoneSearch(term) {
  return /^[6-9]\d{9}$/.test(term);
}

function getUserSearchName(user = {}) {
  return normalizeSearchText(
    user.displayName || user.name || user.fullName || "",
  );
}

function matchesNameSearch(name, term) {
  const cleanName = normalizeSearchText(name);
  const cleanTerm = normalizeSearchText(term);
  if (!cleanName || !cleanTerm) return false;
  if (cleanName.includes(cleanTerm)) return true;

  const nameParts = cleanName.split(" ").filter(Boolean);
  const termParts = cleanTerm.split(" ").filter(Boolean);
  return termParts.every((termPart) =>
    nameParts.some((namePart) => namePart.startsWith(termPart)),
  );
}

function matchesUserSearch(user, rawTerm) {
  const term = normalizeSearchText(rawTerm);
  if (!term) return false;

  const name = getUserSearchName(user);
  const email = normalizeSearchText(user.email || "");
  const phone = String(user.phone || user.phoneNumber || "").replace(/\D/g, "");
  const digits = term.replace(/\D/g, "");

  if (matchesNameSearch(name, term)) return true;

  // Search registered users by partial email after at least 3 characters.
  if (term.length >= 3 && email.includes(term)) return true;

  // Search registered users by partial phone after at least 3 digits.
  if (digits.length >= 3 && phone.includes(digits)) return true;

  return false;
}

function matchesChatItemSearch(item, rawTerm) {
  const term = normalizeSearchText(rawTerm);
  if (!term) return true;

  const name = normalizeSearchText(item.name || "");
  const email = normalizeSearchText(item.email || item.user?.email || "");
  const phone = String(
    item.phone || item.user?.phone || item.user?.phoneNumber || "",
  ).replace(/\D/g, "");
  const digits = term.replace(/\D/g, "");
  const preview = normalizeSearchText(item.preview || "");

  if (matchesNameSearch(name, term)) return true;
  if (term.length >= 3 && email.includes(term)) return true;
  if (digits.length >= 3 && phone.includes(digits)) return true;
  if (term.length >= 2 && preview.includes(term)) return true;

  return false;
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

window.chatDebug = async function chatDebug() {
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
};

async function renderChatDebugPanel() {
  if (!new URLSearchParams(window.location.search).has("debugChats")) return;
  const panel = document.createElement("pre");
  panel.id = "chatDebugPanel";
  panel.style.cssText =
    "position:fixed;inset:12px;z-index:99999;overflow:auto;background:#111b21;color:#e9edef;padding:16px;border-radius:8px;font:12px/1.4 monospace;white-space:pre-wrap;";
  panel.textContent = "Loading chat debug report...";
  document.body.appendChild(panel);
  try {
    const report = await window.chatDebug();
    panel.textContent = JSON.stringify(report, null, 2);
  } catch (error) {
    panel.textContent = `Debug failed: ${error.message || error}`;
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

async function getChatUnreadCount(chatId, chatType) {
  if (!currentUser || !chatId || !chatType) return 0;
  try {
    const query = db
      .collection("messages")
      .where(chatType === "direct" ? "directId" : "groupId", "==", chatId)
      .where("senderId", "!=", currentUser.uid);
    const snapshot = await query.get();
    return snapshot.docs.filter((doc) => !doc.data().readBy?.[currentUser.uid])
      .length;
  } catch (error) {
    return 0;
  }
}

async function markChatReadState(chatId, chatType, readState) {
  if (!currentUser || !chatId || !chatType) return;
  const query = db
    .collection("messages")
    .where(chatType === "direct" ? "directId" : "groupId", "==", chatId)
    .where("senderId", "!=", currentUser.uid);
  const snapshot = await query.get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) =>
    batch.update(doc.ref, {
      read: readState,
      [`readBy.${currentUser.uid}`]: readState
        ? firebase.firestore.FieldValue.serverTimestamp()
        : firebase.firestore.FieldValue.delete(),
    }),
  );
  if (snapshot.docs.length > 0) await batch.commit();
  showToast(readState ? "Marked as read" : "Marked as unread");
}

function updateFilterButtons() {
  document
    .getElementById("favoriteFilterBtn")
    ?.classList.toggle("active", currentViewTab === "favorites");
  document
    .getElementById("unreadFilterBtn")
    ?.classList.toggle("active", currentViewTab === "unread");
}

function isValidIndianPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}

function isCompleteEmail(email) {
  return email.includes("@") && email.includes(".");
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
function searchUsersRealtime(searchTerm) {
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

  // Pass control straight to our updated combining engine
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

  // 1. Compile conversations from active chat histories
  const directItems = await buildDirectChatItems();
  const groupItems = await buildGroupChatItems();
  const allItems = [...directItems, ...groupItems];
  updateUnreadBadges(allItems);

  let items = [...allItems];
  if (currentViewTab === "favorites")
    items = items.filter((item) => item.isFavorite);
  if (currentViewTab === "unread")
    items = items.filter((item) => item.unreadCount > 0);

  const term = normalizeSearchText(searchTerm);
  lastSearchValue = searchTerm || "";

  if (term) {
    // MATCH 1: Search your existing active chat logs
    const chatMatches = items.filter((item) => matchesChatItemSearch(item, term));

    // Track unique IDs that are already matching in your chat history view
    const visibleUserIds = new Set();
    chatMatches.forEach((item) => {
      if (item.otherUserId) visibleUserIds.add(item.otherUserId);
      if (item.user?.id) visibleUserIds.add(item.user.id);
    });

    const userMatches = [];

    // MATCH 2: Look through the directory for ALL registered users.
    const directoryMatches = searchUsersByIdentity(term);
    for (const user of directoryMatches) {
      if (!visibleUserIds.has(user.id)) {
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
          isMuted: false,
          onlineStatus: user.onlineStatus || "offline",
          user: { ...user, requestState },
          rawUser: { ...user, requestState },
          lastMessageTime: new Date(0),
        });
      }
    }

    // FIXED CORRECTION LAYER: Read directly from item.id to completely avoid mapping crashes
    const cleanUserMatches = Array.from(
      new Map(userMatches.map((u) => [u.id, u])).values(),
    );
    items = [...chatMatches, ...cleanUserMatches];
  } else {
    // Whitelist core operational fallback: when no search text is active, default back to showing WhatsApp style history list
    items = [...allItems];
    if (currentViewTab === "favorites")
      items = items.filter((item) => item.isFavorite);
    if (currentViewTab === "unread")
      items = items.filter((item) => item.unreadCount > 0);
  }

  // Sort chronologically and update layout view
  items.sort(
    (a, b) =>
      (b.lastMessageTime?.getTime?.() || b.lastMessageTime || 0) -
        (a.lastMessageTime?.getTime?.() || a.lastMessageTime || 0) ||
      (a.name || "").localeCompare(b.name || ""),
  );
  renderChatListItems(items, chatsList);
}

async function sendChatRequest(user) {
  if (!currentUser || !user) return;
  if (await isBlockedByUser(user.id)) {
    showToast("Request cannot be sent to this user", "error");
    return;
  }
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
    toUserId: user.id,
    toUserName: user.displayName || user.email,
    status: "pending",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast("Request sent");
  lastSearchValue = document.getElementById("searchInput")?.value || lastSearchValue;
  loadCurrentChatList();
  scheduleChatListRefresh();
}

async async function handleUserSelection(user) {
  if (!currentUser || !user?.id) return;
  if (isBlocked(user.id)) {
    showToast("You have blocked this user.", "error");
    return;
  }

  const requestState = user.requestState || (await getContactRequestState(user.id));

  if (requestState.status === "accepted") {
    await ensureDirectChatDocument(user);
    startDirectChat(user);
    return;
  }

  if (requestState.status === "received") {
    if (requestState.requestId) {
      await acceptChatRequest(requestState.requestId, user.id);
    } else {
      showToast("Accept this user's request from Requests first");
    }
    return;
  }

  if (requestState.status === "sent") {
    showToast("Request already sent");
    return;
  }

  await sendChatRequest(user);
}

async function ensureDirectChatDocument(user) {
  if (!currentUser || !user?.id) return "";
  const chatId = getDirectChatId(currentUser.uid, user.id);
  await db
    .collection("directChats")
    .doc(chatId)
    .set(
      {
        participants: [currentUser.uid, user.id],
        participantNames: {
          [currentUser.uid]:
            currentUser.displayName || currentUser.email?.split("@")[0] || "Me",
          [user.id]: user.displayName || user.email || "User",
        },
        status: "active",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  return chatId;
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
    const chatId = getDirectChatId(currentUser.uid, fromUserId);
    const chatDoc = await db.collection("directChats").doc(chatId).get();
    if (!chatDoc.exists) {
      await db
        .collection("directChats")
        .doc(chatId)
        .set(
          {
            participants: [currentUser.uid, fromUserId],
            participantNames: {
              [currentUser.uid]:
                currentUser.displayName || currentUser.email?.split("@")[0] || "Me",
              [fromUserId]: "Contact",
            },
            status: "active",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    }
    await db
      .collection("chatRequests")
      .doc(requestId)
      .update({
        status: "accepted",
        respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    showToast("Request accepted");
    await loadReceivedRequests();
    lastSearchValue = document.getElementById("searchInput")?.value || lastSearchValue;
    loadCurrentChatList();
    scheduleChatListRefresh();

    const userDoc = await db.collection("users").doc(fromUserId).get();
    if (userDoc.exists) {
      startDirectChat({ id: fromUserId, ...userDoc.data() });
    }
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

  const chatSnapshot = await db
    .collection("chatRequests")
    .where("toUserId", "==", currentUser.uid)
    .where("status", "==", "pending")
    .get();
  const groupSnapshot = await db
    .collection("groupInvites")
    .where("toUserId", "==", currentUser.uid)
    .where("status", "==", "pending")
    .get();

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

  const badge = document.getElementById("requestBadge");
  if (requests.length === 0) {
    requestList.innerHTML =
      '<div class="empty-state" style="padding:20px;">No requests</div>';
    if (badge) badge.style.display = "none";
    if (requestToggle) requestToggle.textContent = "▼";
    requestSection?.classList.remove("expanded");
    return;
  }

  if (badge) {
    badge.textContent = requests.length;
    badge.style.display = "inline-block";
  }
  if (requestToggle)
    requestToggle.textContent = requestSection?.classList.contains("expanded")
      ? "▲"
      : "▼";

  requestList.innerHTML = "";
  for (const req of requests) {
    const isGroupInvite = req.requestType === "group";
    const reqDiv = document.createElement("div");
    reqDiv.className = "list-item";
    reqDiv.innerHTML = `
      <div class="list-avatar">${isGroupInvite ? "G" : "C"}</div>
      <div class="list-info">
        <div class="list-name">${escapeHtml(isGroupInvite ? req.groupName || "Group invite" : req.fromUserName || "User")}</div>
        <div class="list-preview">${isGroupInvite ? `Group invite from ${escapeHtml(req.fromUserName || "User")}` : "Chat request"}</div>
      </div>
      <div class="request-actions">
        <button class="btn btn-success accept-request-btn" data-type="${req.requestType}" data-id="${req.id}" data-from="${escapeHtml(req.fromUserId || "")}">Accept</button>
        <button class="btn btn-outline delete-request-btn" data-type="${req.requestType}" data-id="${req.id}">Delete</button>
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
      if (btn.dataset.type === "group") await deleteGroupInvite(btn.dataset.id);
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
}

function setupRequestListeners() {
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
  let muteUntil = null;
  if (duration === "8h") muteUntil = new Date(Date.now() + 8 * 60 * 60 * 1000);
  else if (duration === "1w")
    muteUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

function isChatMuted(chatId) {
  const mute = mutedChats.find((m) => m.chatId === chatId);
  if (!mute) return false;
  if (mute.muteUntil && mute.muteUntil.toDate() < new Date()) {
    unmuteChat(mute.id);
    return false;
  }
  return true;
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
    reactionDiv.appendChild(badge);
  }
  container.appendChild(reactionDiv);
}

// ========================================
// VOICE RECORDING
// ========================================

async function startVoiceRecording() {
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
    .onSnapshot((snapshot) => {
      const someoneTyping = snapshot.docs.some(
        (doc) => doc.data().userId !== currentUser.uid,
      );
      if (chatStatus)
        chatStatus.textContent = someoneTyping ? "typing..." : baseStatus;
    });
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
  await auth.signOut();
  window.location.replace("login.html");
}

async function changeEmail() {
  const newEmail = prompt("Enter your new email address:");
  if (!newEmail) return;
  try {
    await currentUser.updateEmail(newEmail);
    await currentUser.sendEmailVerification();
    await db
      .collection("users")
      .doc(currentUser.uid)
      .update({ email: newEmail });
    showToast("Email changed! Please verify your new email address.");
  } catch (error) {
    showToast(error.message, "error");
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
  return new Promise((resolve) => {
    let firstSnapshotResolved = false;
    db.collection("users").onSnapshot(
      (snapshot) => {
        const userMap = new Map();
        const getUserSortTime = (data) =>
          data.createdAt?.toMillis?.() || data.createdAt?.getTime?.() || 0;
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (
            doc.id === currentUser.uid ||
            isBlocked(doc.id) ||
            data.isActive === false
          )
            return;

          const phone = data.phone || data.phoneNumber || "";
          const displayName =
            data.displayName ||
            data.name ||
            data.fullName ||
            (data.email || "").split("@")[0] ||
            "User";
          const dedupeKey =
            (data.email || "").trim().toLowerCase() ||
            String(phone).replace(/\D/g, "") ||
            doc.id;
          const user = { id: doc.id, ...data, displayName, phone };
          const existing = userMap.get(dedupeKey);
          if (!existing || getUserSortTime(data) >= getUserSortTime(existing)) {
            userMap.set(dedupeKey, user);
          }
        });
        allUsers = [...userMap.values()];
        populateGroupMemberSuggestions();

        if (document.getElementById("searchInput")?.value.trim()) {
          loadCurrentChatList();
        }
        if (!firstSnapshotResolved) {
          firstSnapshotResolved = true;
          resolve(allUsers);
        }
      },
      () => {
        if (!firstSnapshotResolved) {
          firstSnapshotResolved = true;
          resolve(allUsers);
        }
      },
    );
  });
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
    (user) => !isBlocked(user.id) && matchesUserSearch(user, term),
  );
}

async async function getContactRequestState(userId) {
  if (!currentUser || !userId) return { status: "none", label: "" };

  const sentPending = await db
    .collection("chatRequests")
    .where("fromUserId", "==", currentUser.uid)
    .where("toUserId", "==", userId)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!sentPending.empty)
    return {
      status: "sent",
      label: "Request sent",
      requestId: sentPending.docs[0].id,
    };

  const receivedPending = await db
    .collection("chatRequests")
    .where("fromUserId", "==", userId)
    .where("toUserId", "==", currentUser.uid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!receivedPending.empty)
    return {
      status: "received",
      label: "Accept request",
      requestId: receivedPending.docs[0].id,
    };

  if (await hasAcceptedChatRelationship(userId))
    return { status: "accepted", label: "Connected" };

  return { status: "none", label: "Send request" };
}

async function hasAcceptedChatRelationship(userId) {
  if (!currentUser || !userId) return false;
  const chatId = getDirectChatId(currentUser.uid, userId);
  const directDoc = await db.collection("directChats").doc(chatId).get();
  if (directDoc.exists) {
    const data = directDoc.data() || {};
    if (!data.status || data.status === "active") return true;
  }

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
}

// ========================================
// ARCHIVE & CHAT ACTIONS
// ========================================

async function archiveChat(chatId, chatType, chatName) {
  await db.collection("archivedChats").doc(`${currentUser.uid}_${chatId}`).set({
    userId: currentUser.uid,
    chatId,
    chatType,
    chatName,
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
  if (!currentUser) return new Set();
  const snapshot = await db
    .collection("archivedChats")
    .where("userId", "==", currentUser.uid)
    .get();
  return new Set(snapshot.docs.map((doc) => doc.data().chatId));
}

async function getDeletedChatIds() {
  if (!currentUser) return new Set();
  const snapshot = await db
    .collection("deletedChats")
    .where("userId", "==", currentUser.uid)
    .get();
  return new Set(snapshot.docs.map((doc) => doc.data().chatId));
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
  const archivedChats = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort(
      (a, b) =>
        (b.archivedAt?.toMillis?.() || 0) - (a.archivedAt?.toMillis?.() || 0),
    );
  for (const archive of archivedChats) {
    const archiveDiv = document.createElement("div");
    archiveDiv.className = "list-item";
    archiveDiv.style.opacity = "0.7";
    archiveDiv.innerHTML = `<div class="list-avatar">${archive.chatType === "group" ? "👥" : "👤"}</div><div class="list-info"><div class="list-name">${escapeHtml(archive.chatName)}</div><div class="list-preview">Archived</div></div><button class="list-item-menu unarchive-btn" data-id="${archive.id}">📤</button>`;
    archiveList.appendChild(archiveDiv);
  }
  document.querySelectorAll(".unarchive-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await unarchiveChat(btn.dataset.id);
    });
  });
}

async function buildDirectChatItems() {
  if (!currentUser) return [];
  const archivedChatIds = await getArchivedChatIds();
  const deletedChatIds = await getDeletedChatIds();
  const directChats = await db
    .collection("directChats")
    .where("participants", "array-contains", currentUser.uid)
    .get();
  const directChatDocs = new Map();
  directChats.docs.forEach((doc) =>
    directChatDocs.set(doc.id, { id: doc.id, data: doc.data() }),
  );

  const acceptedRequests = [];
  const sentAccepted = await db
    .collection("chatRequests")
    .where("fromUserId", "==", currentUser.uid)
    .where("status", "==", "accepted")
    .get();
  sentAccepted.docs.forEach((doc) =>
    acceptedRequests.push({ id: doc.id, ...doc.data() }),
  );
  const receivedAccepted = await db
    .collection("chatRequests")
    .where("toUserId", "==", currentUser.uid)
    .where("status", "==", "accepted")
    .get();
  receivedAccepted.docs.forEach((doc) =>
    acceptedRequests.push({ id: doc.id, ...doc.data() }),
  );

  acceptedRequests.forEach((request) => {
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
        participantNames: {
          [request.fromUserId]: request.fromUserName,
          [request.toUserId]: request.toUserName,
        },
        status: "active",
        lastMessage: "Connected - start chatting",
        lastMessageTime: request.respondedAt || request.createdAt,
      },
    });
  });

  const items = [getSavedMessagesItem()];

  for (const chat of directChatDocs.values()) {
    const chatData = chat.data;
    if (chatData.status && chatData.status !== "active") continue;
    if (archivedChatIds.has(chat.id) || deletedChatIds.has(chat.id)) continue;
    const participants = chatData.participants || chat.id.split("_");
    const otherUserId = participants.find((id) => id !== currentUser.uid);
    if (!otherUserId || isBlocked(otherUserId)) continue;
    const fallbackName =
      chatData.participantNames?.[otherUserId] || "Unknown contact";
    const userDoc = await db.collection("users").doc(otherUserId).get();
    const profileMatch = userDoc.exists
      ? null
      : findProfileByFallbackName(fallbackName);
    const resolvedUserId = userDoc.exists
      ? otherUserId
      : profileMatch?.id || otherUserId;
    const userData = userDoc.exists ? userDoc.data() : profileMatch || {};
    if ((userDoc.exists || profileMatch) && userData.isActive === false)
      continue;
    const displayName = userData.displayName || userData.email || fallbackName;
    const onlineStatus = userData.onlineStatus || "offline";
    const presenceText = getPresenceText(userData);
    const preview = chatData.lastMessage || "Tap to open chat";

    items.push({
      id: chat.id,
      type: "direct",
      name: displayName,
      avatar: userData.avatar
        ? `<img src="${userData.avatar}">`
        : escapeHtml((displayName || "?")[0].toUpperCase()),
      preview,
      unreadCount: await getChatUnreadCount(chat.id, "direct"),
      isFavorite: favoriteChatIds.includes(chat.id),
      isMuted: isChatMuted(chat.id),
      otherUserId: resolvedUserId,
      user: { id: resolvedUserId, ...userData, displayName },
      email: userData.email || "",
      phone: userData.phone || userData.phoneNumber || "",
      hasUserProfile: userDoc.exists || !!profileMatch,
      aliasDirectIds: [chat.id],
      onlineStatus,
      presenceText,
      lastMessageTime: chatData.lastMessageTime?.toDate?.() || new Date(0),
    });
  }

  return [
    getSavedMessagesItem(),
    ...mergeDirectContactItems(items.filter((item) => item.type !== "saved")),
  ];
}

async function buildGroupChatItems() {
  if (!currentUser) return [];
  const archivedChatIds = await getArchivedChatIds();
  const deletedChatIds = await getDeletedChatIds();
  const groupIds = new Set();
  const memberSnapshot = await db
    .collection("groupMembers")
    .where("userId", "==", currentUser.uid)
    .get();
  memberSnapshot.docs.forEach((memberDoc) => {
    if (memberDoc.data().groupId) groupIds.add(memberDoc.data().groupId);
  });

  const createdGroupsSnapshot = await db
    .collection("groups")
    .where("createdBy", "==", currentUser.uid)
    .get();
  createdGroupsSnapshot.docs.forEach((groupDoc) => groupIds.add(groupDoc.id));

  const items = [];

  for (const groupId of groupIds) {
    if (archivedChatIds.has(groupId) || deletedChatIds.has(groupId)) continue;
    const groupDoc = await db.collection("groups").doc(groupId).get();
    if (!groupDoc.exists) continue;
    const group = groupDoc.data();
    items.push({
      id: groupDoc.id,
      type: "group",
      name: group.name,
      avatar: group.icon ? `<img src="${group.icon}">` : "👥",
      preview: group.memberCount
        ? `${group.memberCount} members`
        : `Invite code ${group.code || ""}`.trim(),
      unreadCount: await getChatUnreadCount(groupDoc.id, "group"),
      isFavorite: favoriteChatIds.includes(groupDoc.id),
      isMuted: isChatMuted(groupDoc.id),
      code: group.code || "",
      lastMessageTime:
        group.updatedAt?.toDate?.() ||
        group.createdAt?.toDate?.() ||
        new Date(0),
    });
  }
  return items;
}

function loadCurrentChatList() {
  if (currentViewTab === "groups") loadGroupsList();
  else loadAllChatsList(document.getElementById("searchInput")?.value || "");
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

function getPresenceText(userData) {
  if (!userData) return "";
  const canSeePresence =
    !privacySettings.hideLastSeen && !userData.privacySettings?.hideLastSeen;
  if (!canSeePresence) return "last seen hidden";
  if (userData.onlineStatus === "online") return "online";
  if (userData.lastSeen) return formatLastSeen(userData.lastSeen);
  return "";
}

async function loadGroupsList() {
  if (!currentUser) return;
  const groupsList = document.getElementById("groupsList");
  if (!groupsList) return;
  const enhancedGroups = await buildGroupChatItems();

  const filteredGroups = enhancedGroups.filter((group) => {
    if (currentViewTab === "favorites" && !group.isFavorite) return false;
    if (currentViewTab === "unread" && group.unreadCount === 0) return false;
    return true;
  });

  if (filteredGroups.length === 0) {
    groupsList.innerHTML = `<div class="empty-state" style="padding:40px;">No groups found.</div>`;
    return;
  }

  groupsList.innerHTML = "";
  for (const group of filteredGroups) {
    const isMuted = isChatMuted(group.id);
    const groupDiv = document.createElement("div");
    groupDiv.className = "list-item";
    groupDiv.dataset.chatId = group.id;
    groupDiv.dataset.chatType = "group";
    groupDiv.dataset.unreadCount = group.unreadCount;
    groupDiv.dataset.chatName = group.name || "";
    if (currentChat?.id === group.id && currentChatType === "group")
      groupDiv.classList.add("active");
    groupDiv.innerHTML = `<div class="list-avatar">${group.icon ? `<img src="${group.icon}">` : "👥"}</div><div class="list-info" style="flex:1; cursor:pointer;"><div class="list-name">${group.isFavorite ? "⭐ " : ""}${escapeHtml(group.name)} ${isMuted ? "🔇" : ""}</div><div class="list-preview">${group.code}${group.unreadCount ? ` • ${group.unreadCount} unread` : ""}</div></div><button class="list-item-menu mute-chat-btn" data-chat-id="${group.id}" data-chat-type="group">🔇</button><button class="list-item-menu archive-chat-btn" data-chat-id="${group.id}" data-chat-type="group" data-chat-name="${escapeHtml(group.name)}">📦</button>`;
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
        const duration = prompt("Mute for: 8h, 1w, or always?", "8h");
        if (duration === "8h" || duration === "1w" || duration === "always") {
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
// CHAT FRAMEWORK STARTERS
// ========================================

async function startSavedMessages() {
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
  loadMessages();
  loadPinnedMessages();
  applyCurrentChatWallpaper();
  openMobileChatPanel();
  loadCurrentChatList();
}

async function startDirectChat(user) {
  if (isBlocked(user.id)) {
    showToast("You have blocked this user.", "error");
    return;
  }
  const chatId = getDirectChatId(currentUser.uid, user.id);
  currentChat = {
    id: chatId,
    otherUserId: user.id,
    otherUserName: user.displayName || user.email,
    type: "direct",
    aliasDirectIds: [...new Set([chatId, ...(user.aliasDirectIds || [])])],
  };
  currentChatType = "direct";
  document.getElementById("currentChatName").textContent =
    user.displayName || user.email;
  document.getElementById("chatStatus").textContent = getPresenceText(user);
  setChatHeaderAvatar(
    user.avatar
      ? `<img src="${user.avatar}">`
      : escapeHtml((user.displayName || user.email || "?")[0].toUpperCase()),
  );
  document.getElementById("inputArea").style.display = "flex";
  document.getElementById("groupInfoBtn").style.display = "none";
  document.getElementById("voiceCallBtn").style.display = "inline-flex";
  document.getElementById("videoCallBtn").style.display = "inline-flex";
  document.getElementById("replyPreviewBar").style.display = "none";
  currentReplyTo = null;
  loadMessages();
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
    code: groupCode,
    createdBy: currentUser.uid,
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

async function loadGroupChat(groupId, groupName) {
  const groupDoc = await db.collection("groups").doc(groupId).get();
  currentChat = { id: groupId, name: groupName, type: "group" };
  currentChatType = "group";
  const groupData = groupDoc.data() || {};
  currentGroup = {
    id: groupId,
    name: groupName,
    icon: groupData.icon,
    ...groupData,
  };
  document.getElementById("currentChatName").textContent = groupName;
  document.getElementById("chatStatus").textContent = "Group Chat";
  setChatHeaderAvatar(groupData.icon ? `<img src="${groupData.icon}">` : "👥");
  await loadGroupMembers(groupId);
  const inputArea = document.getElementById("inputArea");
  const canSend = !currentGroup.onlyAdminsCanSend || isCurrentUserGroupAdmin();
  if (inputArea) inputArea.style.display = canSend ? "flex" : "none";
  document.getElementById("groupInfoBtn").style.display = "block";
  document.getElementById("voiceCallBtn").style.display = "none";
  document.getElementById("videoCallBtn").style.display = "none";
  loadMessages();
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
    (member) => member.id === currentUser?.uid && member.role === "admin",
  );
}

async function showGroupInfo() {
  if (!currentGroup) return;
  const groupDoc = await db.collection("groups").doc(currentGroup.id).get();
  const group = groupDoc.data();
  document.getElementById("groupInfoTitle").textContent = group.name;
  document.getElementById("groupAvatarLarge").innerHTML = group.icon
    ? `<img src="${group.icon}">`
    : "👥";
  document.getElementById("editGroupNameInput").value = group.name;
  document.getElementById("groupCodeDisplay").textContent = group.code;

  const currentUserRole = currentGroupMembers.find(
    (m) => m.id === currentUser.uid,
  )?.role;
  const isAdmin = currentUserRole === "admin";
  document.getElementById("addMemberBtn").style.display = isAdmin
    ? "block"
    : "none";
  document.getElementById("addMemberEmail").style.display = isAdmin
    ? "inline-block"
    : "none";
  document.getElementById("deleteGroupBtn").style.display = isAdmin
    ? "block"
    : "none";

  const membersList = document.getElementById("groupMembersList");
  membersList.innerHTML = "";
  for (const member of currentGroupMembers) {
    const isMemberAdmin = member.role === "admin";
    const isCurrentUser = member.id === currentUser.uid;
    const canModify = isAdmin && !isCurrentUser;
    const memberDiv = document.createElement("div");
    memberDiv.className = "member-item";
    memberDiv.innerHTML = `<div class="member-info"><div class="member-avatar">${member.avatar ? `<img src="${member.avatar}" style="width:36px;height:36px;border-radius:50%;">` : member.name?.[0]?.toUpperCase() || "👤"}</div><div><span>${escapeHtml(member.name)}</span>${isMemberAdmin ? '<span style="font-size:10px; color:#667eea; margin-left:8px;">Admin</span>' : ""}</div></div>${canModify ? `<div class="member-actions">${!isMemberAdmin ? `<button class="make-admin-btn" data-id="${member.id}" data-name="${escapeHtml(member.name)}">👑</button>` : ""}<button class="remove-member-btn" data-id="${member.id}" data-name="${escapeHtml(member.name)}">❌</button></div>` : ""}`;
    membersList.appendChild(memberDiv);
  }
  await renderPendingGroupInvites(currentGroup.id, membersList, isAdmin);
  document.getElementById("groupInfoModal").style.display = "flex";
}

async function makeAdmin(groupId, memberId, memberName) {
  if (!confirm(`Make ${memberName} an admin?`)) return;
  const memberDoc = await db
    .collection("groupMembers")
    .where("groupId", "==", groupId)
    .where("userId", "==", memberId)
    .get();
  memberDoc.forEach((doc) => doc.ref.update({ role: "admin" }));
  showToast(`${memberName} is now admin`);
  showGroupInfo();
}

async function removeMember(groupId, memberId, memberName) {
  if (!confirm(`Remove ${memberName} from group?`)) return;
  await db
    .collection("groupMembers")
    .where("groupId", "==", groupId)
    .where("userId", "==", memberId)
    .get()
    .then((s) => s.forEach((d) => d.ref.delete()));
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
  if (!newName.trim() || !isCurrentUserGroupAdmin()) return;
  await db
    .collection("groups")
    .doc(currentGroup.id)
    .update({ name: newName.trim() });
  if (currentChat?.id === currentGroup.id)
    document.getElementById("currentChatName").textContent = newName;
  loadGroupsList();
}

async function updateGroupIcon(file) {
  if (!isCurrentUserGroupAdmin()) return;
  const url = await uploadToCloudinary(file);
  await db.collection("groups").doc(currentGroup.id).update({ icon: url });
  if (currentChat?.id === currentGroup.id) currentGroup.icon = url;
  loadGroupsList();
  showGroupInfo();
}

async function leaveGroup() {
  if (!confirm(`Leave group "${currentGroup.name}"?`)) return;
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
  if (!confirm("Permanently delete group for everyone?")) return;
  await db.collection("groups").doc(currentGroup.id).delete();
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
  await db
    .collection("groupMembers")
    .add({
      groupId: group.id,
      userId: currentUser.uid,
      role: "member",
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  await db
    .collection("groups")
    .doc(group.id)
    .update({ memberCount: firebase.firestore.FieldValue.increment(1) });
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
  document.getElementById("createStatusModal").style.display = "none";
  loadStatusList();
}

async function showStatusViewer(statuses, index = 0) {
  const status = statuses[index];
  if (!status) return;
  const modal = document.getElementById("statusViewerModal");
  document.getElementById("statusViewerName").textContent = status.userName;
  document.getElementById("statusViewerBody").innerHTML = status.image
    ? `<img src="${status.image.url}">`
    : `<div class="status-viewer-text">${escapeHtml(status.text)}</div>`;
  modal.style.display = "flex";
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
    div.innerHTML = `<span>${escapeHtml(invite.toUserName)} (Pending)</span>`;
    membersList.appendChild(div);
  });
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
  modal.style.display = "flex";
  await renderSharedContent("media");
}

async function renderSharedContent(type) {
  const container = document.getElementById("sharedContent");
  if (!container || !currentChat) return;
  container.innerHTML = "Loading items...";
  let messages = await getCurrentDirectMessages();
  if (type === "media") {
    const media = messages.filter((m) => m.attachment?.type === "image");
    container.innerHTML = media.length
      ? `<div class="shared-grid">${media.map((m) => `<img src="${m.attachment.url}">`).join("")}</div>`
      : "No media";
  } else {
    container.innerHTML = "No shared documents found";
  }
}

// ========================================
// REAL-TIME MESSAGES SUBSCRIBERS LISTENER
// ========================================

async function markMessagesAsRead() {
  if (!currentChat || privacySettings.hideReadReceipts) return;
  const fieldKey = `readBy.${currentUser.uid}`;
  let query = db
    .collection("messages")
    .where(
      currentChatType === "direct" ? "directId" : "groupId",
      "==",
      currentChat.id,
    )
    .where("senderId", "!=", currentUser.uid);
  const snapshot = await query.get();
  const batch = db.batch();
  let updatesMade = false;
  snapshot.docs.forEach((doc) => {
    if (!doc.data().readBy?.[currentUser.uid]) {
      batch.update(doc.ref, {
        read: true,
        [fieldKey]: firebase.firestore.FieldValue.serverTimestamp(),
      });
      updatesMade = true;
    }
  });
  if (updatesMade) await batch.commit();
}

function getMessageReceiptHtml(msg, isMyMessage) {
  if (!isMyMessage || privacySettings.hideReadReceipts || currentChat?.isSaved)
    return "";
  if (msg.failed) return "❌";
  if (msg.pending) return "...";
  return msg.read
    ? '<span class="read-receipt seen">✓✓</span>'
    : '<span class="read-receipt sent">✓</span>';
}

function loadMessages() {
  if (!currentChat) return;
  const messagesArea = document.getElementById("messagesArea");
  if (messagesUnsubscribe) messagesUnsubscribe();

  let query = db
    .collection("messages")
    .where(
      currentChatType === "direct" ? "directId" : "groupId",
      "==",
      currentChat.id,
    )
    .orderBy("timestamp", "asc");

  messagesUnsubscribe = query.onSnapshot((snapshot) => {
    if (!messagesArea) return;
    messagesArea.innerHTML = "";
    if (snapshot.empty) {
      messagesArea.innerHTML =
        '<div class="empty-state">No messages here yet.</div>';
      return;
    }

    snapshot.docs.forEach((doc) => {
      const msg = doc.data();
      if (msg.deletedFor?.[currentUser.uid] || isBlocked(msg.senderId)) return;
      const isMyMessage = msg.senderId === currentUser.uid;
      const messageDiv = document.createElement("div");
      messageDiv.className = `message ${isMyMessage ? "my-message" : ""}`;

      if (msg.type === "call") {
        messageDiv.className = "message call-message";
        messageDiv.innerHTML = renderCallMessage(msg);
        messagesArea.appendChild(messageDiv);
        return;
      }

      let replyHtml = msg.replyTo
        ? `<div class="reply-preview"><strong>${escapeHtml(msg.replyTo.senderName)}</strong>: ${escapeHtml(msg.replyTo.text || "Media")}</div>`
        : "";
      let attachmentHtml = msg.attachment
        ? renderAttachment(msg.attachment)
        : "";
      let textContent = msg.deletedForEveryone
        ? "This message was deleted"
        : msg.text || "";

      messageDiv.innerHTML = `
        <div class="message-bubble">
          ${!isMyMessage ? `<div class="message-sender">${escapeHtml(msg.senderName)}</div>` : ""}
          ${replyHtml}
          <div class="message-text">${escapeHtml(textContent)}</div>
          ${attachmentHtml}
          <div class="message-footer">
            <span class="message-time">${msg.timestamp ? formatTime(msg.timestamp) : ""}</span>
            ${getMessageReceiptHtml(msg, isMyMessage)}
          </div>
        </div>
      `;
      messageDiv.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, doc.id, msg, isMyMessage);
      });
      messagesArea.appendChild(messageDiv);
    });
    messagesArea.scrollTop = messagesArea.scrollHeight;
    markMessagesAsRead();
  });
}

// ========================================
// MESSAGE TRANSMISSIONS OPERATIONS
// ========================================

async function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input ? input.value.trim() : "";
  if ((!text && !currentAttachment) || !currentChat) return;
  setSendingState(true);

  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    read: false,
    readBy: { [currentUser.uid]: new Date() },
  };
  if (currentReplyTo) {
    messageData.replyTo = {
      messageId: currentReplyTo.id,
      text: currentReplyTo.text,
      senderName: currentReplyTo.senderName,
    };
  }
  if (currentAttachment) messageData.attachment = currentAttachment;

  if (currentChatType === "direct") messageData.directId = currentChat.id;
  else messageData.groupId = currentChat.id;

  try {
    if (
      currentChatType === "direct" &&
      currentChat.otherUserId &&
      !currentChat.isSaved
    ) {
      await ensureDirectChatDocument({
        id: currentChat.otherUserId,
        displayName: currentChat.otherUserName || currentChat.name,
        email: currentChat.otherUserEmail || "",
      });
    }
    await db.collection("messages").add(messageData);
    if (currentChatType === "direct") {
      await db
        .collection("directChats")
        .doc(currentChat.id)
        .set(
          {
            lastMessage: text || (currentAttachment ? "Attachment" : ""),
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    } else if (currentChatType === "group") {
      await db
        .collection("groups")
        .doc(currentChat.id)
        .set(
          { updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        );
    }
    if (input) input.value = "";
    currentAttachment = null;
    currentReplyTo = null;
    document.getElementById("replyPreviewBar").style.display = "none";
    setAttachmentPreview();
  } catch (e) {
    showToast("Failed to deliver message", "error");
  } finally {
    setSendingState(false);
  }
}

async function handleFileUpload(file) {
  if (!file) return;
  try {
    const url = file.type.startsWith("image/")
      ? await uploadToCloudinary(file)
      : await uploadDocument(file);
    currentAttachment = {
      type: file.type.startsWith("image/") ? "image" : "document",
      url,
      filename: file.name,
      size: file.size,
    };
    setAttachmentPreview();
  } catch (e) {
    showToast("File uploading failed", "error");
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast("Copied text!");
}
function setReplyTo(msg) {
  currentReplyTo = msg;
  document.getElementById("replyPreviewBar").style.display = "block";
  document.getElementById("replyPreviewSender").textContent = msg.senderName;
  document.getElementById("replyPreviewText").textContent = msg.text || "Media";
}
async function deleteMessage(id) {
  await db
    .collection("messages")
    .doc(id)
    .update({ text: "This message was deleted", deletedForEveryone: true });
}
async function starMessage(id, data) {
  await db
    .collection("starredMessages")
    .add({ userId: currentUser.uid, messageId: id, text: data.text });
  showToast("Starred");
}

function showContextMenu(x, y, messageId, messageData, isMyMessage) {
  const existing = document.querySelector(".message-context-menu");
  if (existing) existing.remove();
  const menu = document.createElement("div");
  menu.className = "context-menu message-context-menu";
  menu.style.display = "block";
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const items = [
    { text: "📋 Copy Text", action: () => copyToClipboard(messageData.text) },
    { text: "↩️ Thread Reply", action: () => setReplyTo(messageData) },
    {
      text: "⭐ Star Message",
      action: () => starMessage(messageId, messageData),
    },
    {
      text: "📌 Pin Message",
      action: () => pinMessage(messageId, messageData),
    },
  ];
  if (isMyMessage) {
    items.push({
      text: "🗑️ Delete Everyone",
      action: () => deleteMessage(messageId),
    });
  }

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "context-menu-item";
    div.textContent = item.text;
    div.onclick = () => {
      item.action();
      menu.remove();
    };
    menu.appendChild(div);
  });
  document.body.appendChild(menu);
}

// ========================================
// SYSTEM PROFILES CONFIGURATORS
// ========================================

async function updateProfileAvatar(file) {
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
  await db.collection("users").doc(currentUser.uid).update({ statusText: txt });
}
async function updatePrivacySettings() {
  await db.collection("users").doc(currentUser.uid).update({ privacySettings });
}

async function showProfileModal() {
  const doc = await db.collection("users").doc(currentUser.uid).get();
  const d = doc.data() || {};
  document.getElementById("profileName").textContent =
    d.displayName || currentUser.email;
  document.getElementById("profileEmail").textContent = d.email;
  document.getElementById("profilePhone").textContent = d.phone || "Not set";
  document.getElementById("profileModal").style.display = "flex";
}

async function showBlockedUsersModal() {
  document.getElementById("blockedModal").style.display = "flex";
}
function showQuickRepliesModal() {
  document.getElementById("quickRepliesModal").style.display = "flex";
}
async function exportCurrentChat() {
  showToast("Chat framework configuration exported");
}
async function clearAllChats() {
  if (confirm("Clear chat records?"))
    showToast("Wiped local active text references");
}

// ========================================
// CORE CONTROLLERS & APP INITIALIZATIONS
// ========================================

function switchTab(tab) {
  if (tab === "chats") tab = "all";
  currentViewTab = tab || "all";
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(`.tab[data-tab="${currentViewTab}"]`)
    ?.classList.add("active");

  const chatsList = document.getElementById("chatsList");
  const groupsList = document.getElementById("groupsList");
  const statusList = document.getElementById("statusList");
  const groupActions = document.getElementById("groupActions");
  const statusActions = document.getElementById("statusActions");

  if (chatsList)
    chatsList.style.display =
      currentViewTab === "groups" || currentViewTab === "status"
        ? "none"
        : "block";
  if (groupsList)
    groupsList.style.display = currentViewTab === "groups" ? "block" : "none";
  if (statusList)
    statusList.style.display = currentViewTab === "status" ? "block" : "none";
  if (groupActions)
    groupActions.style.display = currentViewTab === "groups" ? "flex" : "none";
  if (statusActions)
    statusActions.style.display = currentViewTab === "status" ? "flex" : "none";

  loadCurrentChatList();
}

function bindSearchInput() {
  const input = document.getElementById("searchInput");
  if (!input || input.dataset.searchBound === "true") return;
  input.dataset.searchBound = "true";
  input.addEventListener("input", (e) => {
    lastSearchValue = e.target.value || "";
    searchUsersRealtime(lastSearchValue);
  });
}

function toggleDarkMode() {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
}

async function init() {
  bindSearchInput();
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.replace("login.html");
      return;
    }
    currentUser = user;

    document.getElementById("userName").textContent =
      user.displayName || user.email.split("@")[0];
    const userRef = db.collection("users").doc(user.uid);
    await userRef.set(
      {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split("@")[0],
        onlineStatus: "online",
        lastSeen: new Date(),
      },
      { merge: true },
    );

    await loadBlockedUsers();
    await loadMutedChats();
    await loadFavoriteChatIds();
    await loadQuickReplies();
    await loadAllUsers();
    loadWallpaperFromStorage();
    setupChatListListeners();
    setupRequestListeners();
    listenForIncomingCalls();
    switchTab("all");
  });

  // Attach Event Handlers
  document.getElementById("sendBtn")?.addEventListener("click", sendMessage);
  document.getElementById("messageInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
  document
    .getElementById("messageInput")
    ?.addEventListener("input", sendTypingIndicator);
  document
    .querySelectorAll(".tab")
    .forEach((t) =>
      t.addEventListener("click", () => switchTab(t.dataset.tab)),
    );

  document
    .getElementById("profileBtn")
    ?.addEventListener("click", showProfileModal);
  document
    .getElementById("logoutBtn")
    ?.addEventListener("click", () =>
      auth.signOut().then(() => window.location.replace("login.html")),
    );
  document
    .getElementById("voiceCallBtn")
    ?.addEventListener("click", () => startCall("voice"));
  document
    .getElementById("videoCallBtn")
    ?.addEventListener("click", () => startCall("video"));
  document
    .getElementById("acceptCallBtn")
    ?.addEventListener("click", acceptIncomingCall);
  document
    .getElementById("rejectCallBtn")
    ?.addEventListener("click", () => endActiveCall("rejected"));
  document
    .getElementById("endCallBtn")
    ?.addEventListener("click", () => endActiveCall("ended"));
  document
    .getElementById("darkModeBtn")
    ?.addEventListener("click", toggleDarkMode);

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
    ?.addEventListener("change", (e) => handleFileUpload(e.target.files[0]));
  document
    .getElementById("attachBtn")
    ?.addEventListener("click", () =>
      document.getElementById("fileInput").click(),
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

  if (localStorage.getItem("darkMode") === "true")
    document.body.classList.add("dark");
}

// Run framework initializes
init();
// ========================================
// SIDEBAR CONTEXT MENU HANDLERS
// ========================================
let contextMenuTarget = null;

window.addEventListener("click", () => {
  const menu = document.getElementById("chatContextMenu");
  if (menu) menu.style.display = "none";
});

document.getElementById("chatsList")?.addEventListener("contextmenu", (e) => {
  const item = e.target.closest(".list-item");
  if (!item) return;
  e.preventDefault();

  contextMenuTarget = item;
  const menu = document.getElementById("chatContextMenu");
  if (menu) {
    menu.style.display = "block";
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
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
