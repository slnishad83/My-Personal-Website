let waitingParticipantCheckInterval = null;

// ========================================
// HELPER FUNCTIONS
// ========================================

function showToast(message, type = "success", duration) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  toast.setAttribute("aria-atomic", "true");
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  const remove = () => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 400);
  };
  setTimeout(remove, duration || 3000);
  toast.addEventListener("click", remove);
  // Keep max 3 toasts
  while (container.children.length > 3) {
    container.firstChild.classList.remove("show");
    container.firstChild.addEventListener("transitionend", () => {
      if (container.firstChild && !container.firstChild.classList.contains("show")) container.firstChild.remove();
    }, { once: true });
    setTimeout(() => { if (container.firstChild && container.firstChild.parentNode) container.firstChild.remove(); }, 400);
  }
}

let _undoTimeout = null;
function showUndoSendToast(msgId) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  if (_undoTimeout) { clearTimeout(_undoTimeout); _undoTimeout = null; }
  const existing = container.querySelector(".undo-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast success undo-toast";
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "polite");
  toast.innerHTML = '<span>Message sent</span><button class="undo-btn" type="button">Undo</button>';
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  const dismiss = () => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 400);
    _undoTimeout = null;
  };
  _undoTimeout = setTimeout(dismiss, 5000);
  toast.querySelector(".undo-btn").addEventListener("click", async () => {
    clearTimeout(_undoTimeout);
    _undoTimeout = null;
    await deleteMessageForEveryone(msgId);
    dismiss();
  });
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

function cleanupAllFirestoreListeners() {
  const unsubs = [
    messagesUnsubscribe, typingUnsubscribe,
    directChatsUnsubscribe, groupChatsUnsubscribe,
    usersUnsubscribe, chatRequestsUnsubscribe,
    sentChatRequestsUnsubscribe, groupInvitesUnsubscribe,
    statusesUnsubscribe, outgoingCallsListUnsubscribe,
    incomingCallsListUnsubscribe, groupCallsListUnsubscribe,
    incomingCallsUnsubscribe, callDocUnsubscribe,
    callCandidatesUnsubscribe, groupCallsUnsubscribe,
    groupCallDocUnsubscribe, sessionWatchUnsubscribe,
    currentBroadcastUnsubscribe, currentBroadcastMessagesUnsubscribe,
  ];
  let lastSchedUnsub;
  try { lastSchedUnsub = window._tcLastSchedUnsub; } catch (_) {}
  if (lastSchedUnsub) unsubs.push(lastSchedUnsub);
  unsubs.forEach((fn) => { if (typeof fn === "function") { try { fn(); } catch (_) {} } });
  [messagesUnsubscribe, typingUnsubscribe, directChatsUnsubscribe, groupChatsUnsubscribe,
   usersUnsubscribe, chatRequestsUnsubscribe, sentChatRequestsUnsubscribe,
   groupInvitesUnsubscribe, statusesUnsubscribe, outgoingCallsListUnsubscribe,
   incomingCallsListUnsubscribe, groupCallsListUnsubscribe, incomingCallsUnsubscribe,
   callDocUnsubscribe, callCandidatesUnsubscribe, groupCallsUnsubscribe,
   groupCallDocUnsubscribe, sessionWatchUnsubscribe, currentBroadcastUnsubscribe,
   currentBroadcastMessagesUnsubscribe] = Array(20).fill(null);
  if (typeof callWaitingUnsub === "function") { try { callWaitingUnsub(); } catch (_) {} callWaitingUnsub = null; }
  groupCallCandidateUnsubscribes.forEach((fn) => { if (typeof fn === "function") { try { fn(); } catch (_) {} } });
  groupCallCandidateUnsubscribes = [];
  messageRenderLimits.clear();
  seenPendingChatRequestIds.clear();
  seenSentChatRequestIds.clear();
  seenPendingGroupInviteIds.clear();
}

function closeTopVisibleModal() {
  const visibleModals = Array.from(document.querySelectorAll(".modal, .chat-lock-modal-backdrop, .app-lock-backdrop")).filter(
    (modal) => {
      if (modal.classList.contains("show")) return true;
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
  if (topModal.id === "scannerModal") {
    closeScanner();
    return true;
  }
  if (topModal.id === "translateModal") {
    closeTranslateModal();
    return true;
  }
  hideModal(topModal.id);
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
  if (attachment.type === "audio") return "Audio file";
  if (attachment.type === "video") return "Video";
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
    return `<div class="message-attachment"><a class="image-attachment-link" href="${url}" target="_blank" rel="noopener" data-preview-url="${url}" data-filename="${filename}"><img src="${url}" alt="${filename}" loading="lazy" class="attachment-img"><span class="attachment-image-fallback">Image unavailable</span></a>${viewOnceHtml}</div>`;
  }

  if (attachment.type === "video") {
    return `<div class="message-attachment video-attachment" data-preview-url="${url}" data-filename="${filename}"><div class="video-thumb-wrap"><video src="${url}" preload="metadata" muted playsinline></video><button type="button" class="video-play-overlay" aria-label="Play video">&#9654;</button></div>${viewOnceHtml}</div>`;
  }

  if (attachment.type === "voice") {
    const duration = Number(attachment.duration) || 0;
    const wfId = `wf-${Math.random().toString(36).slice(2, 8)}`;
    const bars = Array.from({ length: 30 }, (_, i) => {
      const h = 4 + Math.random() * 28;
      return `<span class="wf-bar" style="height:${h}px;animation-delay:${(i * 0.06).toFixed(2)}s"></span>`;
    }).join("");
    return `<div class="voice-message"><button class="voice-play-btn" data-url="${url}" type="button">Play</button><div class="voice-waveform" id="${wfId}">${bars}</div><span class="voice-duration">${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}</span><button class="voice-speed-btn" type="button">1×</button></div>`;
  }

  if (attachment.type === "audio") {
    return `<div class="message-attachment audio-attachment"><audio src="${url}" controls preload="metadata"></audio></div>`;
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
    ? `<img src="${escapeHtml(preview.image)}" alt="" class="link-preview-image">`
    : "";
  return `<div class="link-preview"><a href="${escapeHtml(preview.url)}" target="_blank" rel="noopener noreferrer" class="link-preview-link">${image}<div class="link-preview-text"><strong class="link-preview-title">${escapeHtml(preview.title || preview.url)}</strong>${preview.description ? `<span class="link-preview-desc">${escapeHtml(preview.description.substring(0, 100))}</span>` : ""}<span class="link-preview-domain">${escapeHtml(new URL(preview.url).hostname)}</span></div></a></div>`;
}

const linkPreviewCache = new Map();
const LINK_PREVIEW_CACHE_MAX = 100;

async function fetchLinkPreview(url) {
  if (linkPreviewCache.has(url)) return linkPreviewCache.get(url);
  if (linkPreviewCache.size >= LINK_PREVIEW_CACHE_MAX) {
    const firstKey = linkPreviewCache.keys().next().value;
    if (firstKey !== undefined) linkPreviewCache.delete(firstKey);
  }
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

function getLinkPreviewSetting() {
  try { return localStorage.getItem("wa_link_preview_enabled") !== "false"; } catch { return true; }
}

async function tryAttachLinkPreview(messageId, msgData) {
  if (!messageId || msgData.linkPreview) return;
  if (!getLinkPreviewSetting()) return;
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
  const accuracy = Number(location.accuracy || 0);
  const liveExpiry =
    location.expiresAt?.toMillis?.() ||
    (location.expiresAt ? new Date(location.expiresAt).getTime() : 0);
  const isLive = location.isLive && (!liveExpiry || liveExpiry > Date.now());
  const liveLabel = isLive ? "Live location" : "Shared location";

  return `
    <div class="location-card">
      <iframe src="${escapeHtml(embedUrl)}" loading="lazy" title="Shared location"></iframe>
      <div class="location-card-body">
        <strong>${liveLabel}</strong>
        <span>${escapeHtml(lat)}, ${escapeHtml(lng)}</span>
        ${accuracy ? `<span>Accuracy: about ${Math.round(accuracy)} m</span>` : ""}
        <div class="location-card-actions">
          <a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>
          <a href="${escapeHtml(osmUrl)}" target="_blank" rel="noopener">OpenStreetMap</a>
        </div>
      </div>
    </div>
  `;
}

function getCallIcon(type = "voice", status = "ended") {
  if (status === "missed") return "!";
  if (status === "rejected" || status === "declined" || status === "failed") return "x";
  return type === "video" ? "VID" : "CALL";
}

function renderCallMessage(msg = {}) {
  const direction = msg.callFromUserId === currentUser?.uid ? "Outgoing" : "Incoming";
  const callView = getCallHistoryView({
    ...msg,
    type: msg.callType,
    status: msg.callStatus,
    participantNames: msg.callParticipantNames,
  });
  const participantText = getCallParticipantDetails({
    ...msg,
    type: msg.callType,
    status: msg.callStatus,
    participantNames: msg.callParticipantNames,
  }, callView);
  const text = escapeHtml(getViewedCallHistoryText(
    msg.callStatus || "ended",
    msg.callType || "voice",
    msg.callDurationMs || 0,
    direction,
  ));
  const icon = getCallIcon(msg.callType, msg.callStatus);
  const canCallAgain = Boolean(msg.groupId || msg.callFromUserId || msg.callToUserId);
  return `<div class="message-bubble call-history-message-bubble">
    <span class="call-history-message-icon" aria-hidden="true">${icon}</span>
    <span class="call-history-message-text"><strong>${text}</strong><small>${escapeHtml(participantText)}</small><small>${escapeHtml(formatCallHistoryTimestamp(msg.timestamp))}</small></span>
    <span class="call-history-message-actions">
      ${canCallAgain ? `<button type="button" class="call-again-btn" title="Call again" aria-label="Call again">${msg.callType === "video" ? "Video" : "Call"}</button>` : ""}
      <button type="button" class="call-history-message-delete" title="Delete call entry" aria-label="Delete call entry">Delete</button>
    </span>
  </div>`;
}

function getViewedCallHistoryText(status, type, durationMs = 0, direction = "") {
  const label = type === "video" ? "video call" : "voice call";
  const prefix = direction ? `${direction} ` : "";
  if (status === "missed")
    return `${direction === "Outgoing" ? "Not answered" : "Missed"} ${label}`;
  if (status === "failed") return `${prefix}${label} rejected`;
  if (status === "cancelled") return `${prefix}${label} cancelled`;
  if (status === "rejected") return `${prefix}${label} rejected`;
  if (status === "declined") return `${prefix}${label} declined`;
  if (durationMs > 0) return `${prefix}${label} · ${formatCallDuration(durationMs)}`;
  return `${prefix}${label}`;
}

function formatCallHistoryTimestamp(timestamp) {
  const date = timestamp?.toDate?.() || (timestamp instanceof Date ? timestamp : null);
  if (!date) return "";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCallHistoryView(call = {}) {
  const isGroup = Boolean(call.groupCall || call.groupId);
  const outgoing = call.fromUserId === currentUser?.uid;
  const participantState = isGroup ? call.participantStates?.[currentUser?.uid] : "";
  let status = call.status || "ended";
  if (isGroup && !outgoing) {
    if (participantState === "rejected") status = "declined";
    else if (participantState === "failed") status = "rejected";
    else if (!["joined", "left"].includes(participantState) && status !== "ringing")
      status = "missed";
  }
  const direction = outgoing ? "Outgoing" : "Incoming";
  const outcome =
    status === "ended" || status === "connected" || status === "accepted"
      ? direction
      : status === "missed"
        ? "Missed"
        : status === "declined"
          ? "Declined"
          : status === "rejected" || status === "failed"
            ? "Rejected"
            : status === "cancelled"
              ? "Cancelled"
              : direction;
  return { isGroup, outgoing, direction, status, outcome };
}

function getCallParticipantDetails(call = {}, view = getCallHistoryView(call)) {
  if (!view.isGroup) {
    const name = view.outgoing ? call.toUserName : call.fromUserName;
    return name ? `${view.direction} personal call with ${name}` : `${view.direction} personal call`;
  }
  const names = Object.entries(call.participantNames || {})
    .filter(([id]) => id !== currentUser?.uid)
    .map(([, name]) => name)
    .filter(Boolean);
  if (!names.length) return `${view.direction} group call`;
  const visible = names.slice(0, 3).join(", ");
  return `${view.direction} group call · ${visible}${names.length > 3 ? ` +${names.length - 3}` : ""}`;
}

function getHiddenCallHistoryIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(`hiddenCallHistory_${currentUser?.uid || ""}`) || "[]"));
  } catch (_) {
    return new Set();
  }
}

function hideCallHistoryForMe(callId) {
  hideCallHistoryIdsForMe([callId]);
}

function hideCallHistoryIdsForMe(callIds = []) {
  const hidden = getHiddenCallHistoryIds();
  callIds.filter(Boolean).forEach((callId) => hidden.add(callId));
  localStorage.setItem(
    `hiddenCallHistory_${currentUser.uid}`,
    JSON.stringify([...hidden]),
  );
  selectedCallHistoryIds.clear();
  callHistorySelectionMode = false;
  loadCallsList();
}

function toggleCallHistorySelection(callId) {
  if (selectedCallHistoryIds.has(callId)) selectedCallHistoryIds.delete(callId);
  else selectedCallHistoryIds.add(callId);
  loadCallsList();
}

function renderCallHistoryToolbar(list, calls = [], allCalls = calls) {
  const toolbar = document.createElement("div");
  toolbar.className = "call-history-toolbar";
  toolbar.innerHTML = callHistorySelectionMode
    ? `<div class="call-history-toolbar-main">
        <button type="button" data-call-action="cancel">Cancel</button>
        <strong>${selectedCallHistoryIds.size} selected</strong>
        <button type="button" data-call-action="select-all">Select all</button>
        <button type="button" data-call-action="delete-selected" ${selectedCallHistoryIds.size ? "" : "disabled"}>Delete</button>
      </div>`
    : `<div class="call-history-toolbar-main">
        <strong>Calls</strong>
        <button type="button" data-call-action="select">Select</button>
        <button type="button" data-call-action="clear-all" ${allCalls.length ? "" : "disabled"}>Clear all</button>
      </div>
      <div class="call-history-filters" role="tablist" aria-label="Filter call history">
        ${[
          ["all", "All"],
          ["missed", "Missed"],
          ["incoming", "Incoming"],
          ["outgoing", "Outgoing"],
        ].map(([value, label]) => `<button type="button" role="tab" data-call-filter="${value}" aria-selected="${callHistoryFilter === value}" class="${callHistoryFilter === value ? "active" : ""}">${label}</button>`).join("")}
      </div>`;
  toolbar.addEventListener("click", (event) => {
    const filter = event.target.closest("[data-call-filter]")?.dataset.callFilter;
    if (filter) {
      callHistoryFilter = filter;
      loadCallsList(document.getElementById("searchInput")?.value || "");
      return;
    }
    const action = event.target.closest("[data-call-action]")?.dataset.callAction;
    if (!action) return;
    if (action === "select") {
      callHistorySelectionMode = true;
      selectedCallHistoryIds.clear();
      loadCallsList();
    } else if (action === "cancel") {
      callHistorySelectionMode = false;
      selectedCallHistoryIds.clear();
      loadCallsList();
    } else if (action === "select-all") {
      selectedCallHistoryIds = new Set(calls.map((call) => call.id));
      loadCallsList();
    } else if (action === "delete-selected" && selectedCallHistoryIds.size) {
      if (confirm(`Delete ${selectedCallHistoryIds.size} selected call entries from your history?`)) {
        hideCallHistoryIdsForMe([...selectedCallHistoryIds]);
      }
    } else if (action === "clear-all" && allCalls.length) {
      if (confirm("Delete all call history entries for you?")) {
        hideCallHistoryIdsForMe(allCalls.map((call) => call.id));
      }
    }
  });
  list.appendChild(toolbar);
}

function getCallHistoryDate(call = {}) {
  return call.endedAt?.toDate?.() || call.connectedAt?.toDate?.() ||
    call.acceptedAt?.toDate?.() || call.createdAt?.toDate?.() || new Date(0);
}

async function redialCall(call) {
  if (call.groupCall || call.groupId) {
    if (!call.groupId) return showToast("This group call cannot be reopened", "error");
    await loadGroupChat(call.groupId, call.groupName || call.title || "Group");
    await startCall(call.type || call.callType || "voice");
    return;
  }
  const otherUserId = call.fromUserId === currentUser.uid ? call.toUserId : call.fromUserId;
  let user = allUsers.find((item) => item.id === otherUserId);
  if (!user && otherUserId) {
    const snapshot = await db.collection("users").doc(otherUserId).get().catch(() => null);
    if (snapshot?.exists) user = { id: snapshot.id, ...snapshot.data() };
  }
  if (!user) return showToast("Contact is unavailable", "error");
  await startDirectChat(user);
  await startCall(call.type || call.callType || "voice");
}

async function openCallHistoryChat(call) {
  if (call.groupCall || call.groupId) {
    if (!call.groupId) return showToast("This group is unavailable", "error");
    await loadGroupChat(call.groupId, call.groupName || call.title || "Group");
    return;
  }
  const otherUserId = call.fromUserId === currentUser.uid ? call.toUserId : call.fromUserId;
  let user = allUsers.find((item) => item.id === otherUserId);
  if (!user && otherUserId) {
    const snapshot = await db.collection("users").doc(otherUserId).get().catch(() => null);
    if (snapshot?.exists) user = { id: snapshot.id, ...snapshot.data() };
  }
  if (!user) return showToast("Contact is unavailable", "error");
  await startDirectChat(user);
}

async function loadCallsList(searchTerm = "") {
  const list = document.getElementById("callsList");
  if (!list || !currentUser) return;
  const token = ++callHistoryLoadToken;
  if (!list.dataset.loaded)
    list.innerHTML = '<div class="empty-state tab-loading-state">Loading calls...</div>';
  try {
    const results = await Promise.allSettled([
      db.collection("calls").where("fromUserId", "==", currentUser.uid).get(),
      db.collection("calls").where("toUserId", "==", currentUser.uid).get(),
      db.collection("calls").where("participantIds", "array-contains", currentUser.uid).get(),
    ]);
    if (token !== callHistoryLoadToken) return;
    const successful = results.filter((result) => result.status === "fulfilled");
    results
      .filter((result) => result.status === "rejected")
      .forEach((result) =>
        console.warn("A call history source is unavailable:", result.reason),
      );
    if (!successful.length) throw results[0]?.reason || new Error("Call history unavailable");
    const hidden = getHiddenCallHistoryIds();
    const unique = new Map();
    successful.flatMap((result) => result.value.docs).forEach((doc) => {
      if (!hidden.has(doc.id)) unique.set(doc.id, { id: doc.id, ...doc.data() });
    });
    const allCalls = [...unique.values()].filter((call) => {
      if (call.status !== "ringing") return true;
      const participantState = call.participantStates?.[currentUser.uid];
      return call.groupCall === true && ["rejected", "failed"].includes(participantState);
    })
      .sort((a, b) => getCallHistoryDate(b) - getCallHistoryDate(a));
    const term = String(searchTerm || "").trim().toLowerCase();
    let filteredCalls = term
      ? allCalls.filter((call) => {
          const view = getCallHistoryView(call);
          return [
            call.groupName,
            call.title,
            call.fromUserName,
            call.toUserName,
            call.type === "video" ? "video" : "audio voice",
            view.direction,
            view.outcome,
            view.status,
            getCallParticipantDetails(call, view),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term);
        })
      : allCalls;
    if (callHistoryFilter !== "all") {
      filteredCalls = filteredCalls.filter((call) => {
        const view = getCallHistoryView(call);
        if (callHistoryFilter === "missed")
          return ["missed", "declined", "rejected", "failed", "busy"].includes(view.status);
        return view.direction.toLowerCase() === callHistoryFilter;
      });
    }
    const calls = filteredCalls.slice(0, 200);
    list.dataset.loaded = "true";
    if (!calls.length) {
      list.innerHTML = "";
      renderCallHistoryToolbar(list, []);
      list.insertAdjacentHTML(
        "beforeend",
        `<div class="empty-state call-history-empty">${term ? "No matching calls" : callHistoryFilter === "all" ? "No calls yet" : `No ${escapeHtml(callHistoryFilter)} calls`}</div>`,
      );
      return;
    }
    list.innerHTML = "";
    renderCallHistoryToolbar(list, calls, allCalls);
    let lastDay = "";
    calls.forEach((call) => {
      const date = getCallHistoryDate(call);
      const day = date.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
      if (day !== lastDay) {
        const label = document.createElement("div");
        label.className = "calls-day-label";
        label.textContent = day;
        list.appendChild(label);
        lastDay = day;
      }
      const view = getCallHistoryView(call);
      const outgoingCall = view.outgoing;
      const otherUserId = outgoingCall ? call.toUserId : call.fromUserId;
      const user = allUsers.find((item) => item.id === otherUserId);
      const name = call.groupName || call.title || user?.displayName ||
        (outgoingCall ? call.toUserName : call.fromUserName) || "Unknown caller";
      const durationMs = Number(call.callDurationMs) || 0;
      const dateText = date.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
      const timeText = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const row = document.createElement("div");
      row.className = "call-history-row";
      row.classList.add(`call-${view.status}`);
      row.classList.toggle("selection-mode", callHistorySelectionMode);
      row.classList.toggle("selected", selectedCallHistoryIds.has(call.id));
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", `Open chat with ${name}`);
      row.innerHTML = `
        ${callHistorySelectionMode ? `<span class="call-history-check" aria-hidden="true">${selectedCallHistoryIds.has(call.id) ? "✓" : ""}</span>` : ""}
        <div class="call-history-avatar">${user?.avatar ? `<img src="${escapeHtml(user.avatar)}" alt="">` : escapeHtml(getInitials(name))}</div>
        <div class="call-history-main">
          <div class="call-history-heading"><div class="call-history-name">${escapeHtml(name)}</div><span class="call-history-status ${escapeHtml(view.status)}">${escapeHtml(view.outcome)}</span></div>
          <div class="call-history-participants">${escapeHtml(getCallParticipantDetails(call, view))}</div>
          <div class="call-history-meta ${escapeHtml(view.status)}"><span class="call-history-direction">${view.outgoing ? "↗" : "↙"} ${escapeHtml(call.type === "video" ? "Video" : "Voice")}</span><span>${escapeHtml(dateText)}</span><span>${escapeHtml(timeText)}</span>${durationMs ? `<span>${escapeHtml(formatCallDuration(durationMs))}</span>` : ""}</div>
        </div>
        <div class="call-history-actions" ${callHistorySelectionMode ? 'style="display:none"' : ""}>
          <button class="call-history-action voice ${call.type !== "video" ? "preferred" : ""}" data-call-type="voice" type="button" title="Voice call" aria-label="Start audio call with ${escapeHtml(name)}"></button>
          <button class="call-history-action video ${call.type === "video" ? "preferred" : ""}" data-call-type="video" type="button" title="Video call" aria-label="Start video call with ${escapeHtml(name)}"></button>
          <button class="call-history-action remove" type="button" aria-label="Remove call from my history"></button>
        </div>`;
      row.addEventListener("click", () => {
        if (callHistorySelectionMode) toggleCallHistorySelection(call.id);
        else openCallHistoryChat(call);
      });
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (callHistorySelectionMode) toggleCallHistorySelection(call.id);
          else openCallHistoryChat(call);
        }
      });
      row.querySelectorAll(".call-history-action[data-call-type]").forEach((button) =>
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          redialCall({ ...call, type: button.dataset.callType });
        }),
      );
      row.querySelector(".call-history-action.remove")?.addEventListener("click", (event) => {
        event.stopPropagation();
        hideCallHistoryForMe(call.id);
      });
      list.appendChild(row);
    });
  } catch (error) {
    console.warn("Could not load call history:", error);
    if (token !== callHistoryLoadToken) return;
    if (list.dataset.loaded && list.querySelector(".call-history-row")) {
      showToast("Call history refresh paused. Showing your existing calls.", "error");
      return;
    }
    list.innerHTML = '<div class="empty-state tab-error-state">Could not load calls<button type="button" class="btn btn-outline tab-retry-btn">Retry</button></div>';
    list.querySelector(".tab-retry-btn")?.addEventListener("click", () =>
      loadCallsList(document.getElementById("searchInput")?.value || ""),
    );
  }
}

let activeDraftKey = "";
let currentForwardMessage = null;
let currentForwardMessages = [];
let selectedChatMessages = new Map();

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

function scrollToFirstUnread(area) {
  if (!area) area = document.getElementById("messagesArea");
  if (!area) return;
  const msgs = area.querySelectorAll(".message:not(.my-message)");
  for (const el of msgs) {
    const id = el.dataset.messageId;
    if (id && _msgReadState?.[id] === false) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("unread-highlight");
      setTimeout(() => el.classList.remove("unread-highlight"), 2000);
      return;
    }
  }
}

const _msgReadState = {};

function updateJumpToBottomBtn(area) {
  const btn = document.getElementById("jumpToBottomBtn");
  if (!btn || !area) return;
  const hidden = area.scrollHeight - area.scrollTop - area.clientHeight < 100;
  btn.classList.toggle("visible", !hidden);
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
function renderChatListItems(items, container, emptyMessage = "") {
  ensureDraftPreviewStyle();
  container.innerHTML = "";
  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px;">
        <div>${escapeHtml(emptyMessage || "No chats yet. Search for people or create a group.")}</div>
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
    if (item.divider) {
      const div = document.createElement("div");
      div.className = "caught-up-divider";
      div.textContent = item.name || "";
      container.appendChild(div);
      return;
    }
    if (item.section && item.section !== lastSection) {
      const section = document.createElement("div");
      section.className = "search-section-label";
      section.textContent = item.section;
      container.appendChild(section);
      lastSection = item.section;
    }
    const chatDiv = document.createElement("div");
    chatDiv.className = "list-item";
    if (item.isPinned) chatDiv.classList.add("pinned");
    if (item.isLocked) chatDiv.classList.add("locked");
    if (item.searchResultType)
      chatDiv.classList.add(`search-result-${item.searchResultType}`);
    chatDiv.dataset.chatId = item.id;
    chatDiv.dataset.chatType = item.type;
    chatDiv.dataset.unreadCount = item.unreadCount || 0;
    if (item.otherUserId || item.user?.id)
      chatDiv.dataset.otherUserId = item.otherUserId || item.user.id;
    chatDiv.dataset.chatName = item.name || "";
    chatDiv.dataset.aliasDirectIds = (item.aliasDirectIds || []).join(",");
    chatDiv.dataset.locked = item.isLocked ? "true" : "false";

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
    const lockOverlay = item.isLocked ? `<span class="lock-badge-overlay" title="Locked chat">&#x1F512;</span>` : "";
    const lockedPreview = item.isLocked ? `<span class="locked-preview">&#x1F512; Locked${item.unreadCount ? ` &middot; ${item.unreadCount} new` : ""}</span>` : "";
    const folderPreview = item.isLockedFolder ? `<span style="color:var(--text-muted);font-size:12px">${item.lockedCount || 0} locked</span>` : "";
    const previewContent = item.isLockedFolder ? folderPreview : (item.isLocked ? lockedPreview : (previewHtml || ""));
    chatDiv.innerHTML = `
      <div class="list-avatar">${item.isLockedFolder ? '&#x1F512;' : item.avatar}${lockOverlay}</div>
      <div class="list-info" style="flex:1; cursor:pointer;">
        <div class="list-name">${tagHtml}${item.isPinned ? '<span class="pin-icon">&#x1F4CC;</span> ' : ""}${item.isFavorite ? "* " : ""}${item.isLocked ? '&#x1F512; ' : ""}${escapeHtml(item.name)}${searchMeta}</div>
        <div class="list-preview">${previewContent}</div>
      </div>
      ${statusChip}
      ${!item.isLocked && !item.isLockedFolder ? unread : ""}
      ${!item.isLockedFolder ? `<button class="list-item-menu ${item.isLocked ? "unlock-chat-btn" : "mute-chat-btn"}" ${!item.isLocked ? `data-chat-id="${item.id}" data-chat-type="${item.type}"` : ""}>${item.isLocked ? "Unlock" : item.isMuted ? "Unmute" : "Mute"}</button><button class="list-item-menu archive-chat-btn" data-chat-id="${item.id}" data-chat-type="${item.type}" data-chat-name="${escapeHtml(item.name)}" title="Archive">&#x1F4E5;</button>` : ""}
    `;

    if (item.type === "user" || item.type === "saved") {
      chatDiv
        .querySelectorAll(".mute-chat-btn, .archive-chat-btn")
        .forEach((btn) => btn.remove());
    }

    container.appendChild(chatDiv);

    chatDiv
      .querySelector(".unlock-chat-btn")
      ?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await unlockChat(item.id, item.type);
      });

    chatDiv
      .querySelector(".archive-chat-btn")
      ?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await archiveChat(
          item.id,
          item.type,
          item.name,
          item.aliasDirectIds || [],
        );
        showToast(`"${item.name}" archived`);
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

    chatDiv.addEventListener("click", async (e) => {
      if (e.target.closest("button")) return;
      try {
        if (item.isLockedFolder) {
          showLockedChatsView();
          return;
        }
        if (item.isLocked) {
          if (!(await showUnlockChatPrompt(item.id, item.type))) return;
          temporarilyUnlockedChatId = item.id;
          // Fall through to open the chat after temporary unlock
        }
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
  filterChatListByFolder();
  renderFolderTabs();
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

function isEmojiOnly(text) {
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|[\u200D\u20E3\uFE0F]){1,5}$/u;
  const stripped = text.replace(/\s/g, "");
  if (!stripped) return false;
  return emojiRegex.test(stripped);
}

function renderMessageText(text = "", mentions = []) {
  let html = escapeHtml(text);

  // 1. Mentions highlight
  const hasEveryone = mentions.some((m) => m.isEveryone);
  // Handle @everyone first
  if (hasEveryone) {
    html = html.replace(/@everyone/gi, '<span class="mention-highlight-everyone">@everyone</span>');
  }
  mentions.forEach((mention) => {
    const label = escapeHtml(mention.label || mention.name || "");
    if (!label || label === "everyone") return;
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

  // 4. Hyperlink parsing
  const urlRegex =
    /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
  html = html.replace(
    urlRegex,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>',
  );

  // Search term highlighting
  if (currentInChatSearchTerm) {
    const sterm = escapeHtml(currentInChatSearchTerm).replace(/[-[\]{}()*+.,\\^$|#\s]/g, '\\$&');
    if (sterm) {
      html = html.replace(new RegExp(`(${sterm})`, 'gi'), '<mark class="search-highlight">$1</mark>');
    }
  }

  return html;
}

function initializeEmojiPicker() {
  const picker = document.getElementById("emojiPicker");
  if (!picker) return;

  picker.innerHTML = "";

  // Search bar
  const searchRow = document.createElement("div");
  searchRow.className = "emoji-search-row";
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "emoji-search-input";
  searchInput.placeholder = "Search emoji...";
  searchRow.appendChild(searchInput);
  picker.appendChild(searchRow);

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

  // Emoji search (flat keyword map for common emojis)
  const emojiKeywords = buildEmojiKeywordMap(categories);
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase().trim();
    contentArea.querySelectorAll(".emoji-picker-section").forEach(s => {
      if (!q) { s.style.display = ""; return; }
      const cat = s.dataset.category;
      const items = s.querySelectorAll(".emoji-picker-grid span");
      let anyMatch = false;
      items.forEach(el => {
        const key = emojiKeywords[el.textContent] || "";
        const match = key.includes(q) || el.textContent.includes(q);
        el.style.display = match ? "" : "none";
        if (match) anyMatch = true;
      });
      s.style.display = anyMatch ? "" : "none";
    });
  });

  picker.appendChild(categoryBar);
  picker.appendChild(contentArea);
}

function buildEmojiKeywordMap(categories) {
  const map = {};
  const kw = {
    "😀": "grinning face smile happy", "😃": "grinning face smile happy", "😄": "grinning face smile happy", "😁": "beaming face smile happy",
    "😆": "grinning squinting face laugh", "😅": "grinning sweat face smile", "😂": "joy tears laugh cry", "🤣": "rolling floor laughing",
    "😊": "smiling eyes blush happy", "😇": "innocent angel smile", "🙂": "slightly smiling face", "🙃": "upside down face silly",
    "😉": "winking face flirt", "😌": "relieved face", "😍": "heart eyes love crush", "🥰": "smiling hearts love",
    "😘": "face blowing kiss love", "😗": "kissing face", "😙": "kissing smiling eyes", "😚": "kissing closed eyes",
    "😋": "savouring food delicious", "😛": "face tongue playful", "😝": "squinting tongue playful", "😜": "winking tongue playful",
    "🤪": "zany face crazy", "🤨": "raised eyebrow skeptical", "🧐": "face monocle", "🤓": "nerd face geek",
    "😎": "smiling sunglasses cool", "🤩": "star struck excited", "🥳": "partying face celebration", "😏": "smirking face smug",
    "😒": "unamused face", "😞": "disappointed face sad", "😔": "pensive face sad", "😟": "worried face anxious",
    "😕": "confused face", "🙁": "slightly frowning face", "☹️": "frowning face", "😢": "cry sad tear",
    "😭": "loudly crying sob", "😤": "steam from nose angry", "😠": "angry face", "😡": "pouting face rage",
    "🤬": "face with symbols swearing", "🤯": "exploding head mind blown", "😳": "flushed face embarrassed",
    "🥵": "hot face fever", "🥶": "cold face freezing", "😱": "screaming fear shocked", "😨": "fearful face afraid",
    "😰": "anxious sweat worried", "😥": "sad relieved disappointed", "😓": "downcast sweat", "🤗": "hugging face",
    "🤔": "thinking face", "🤭": "face hand over mouth", "🤫": "shushing face quiet", "🤥": "lying face pinocchio",
    "👋": "wave hand hello goodbye", "🤚": "raised back of hand", "🖐️": "splayed fingers hand", "✋": "raised hand stop",
    "🖖": "vulcan salute star trek", "👌": "ok hand gesture", "🤌": "pinched fingers italian", "🤏": "pinching hand small",
    "✌️": "victory hand peace", "🤞": "crossed fingers luck", "🤟": "love you gesture", "🤘": "sign of horns rock",
    "🤙": "call me hand", "👈": "backhand index pointing left", "👉": "backhand index pointing right",
    "👆": "backhand index pointing up", "👇": "backhand index pointing down", "👍": "thumbs up like",
    "👎": "thumbs down dislike", "✊": "raised fist", "👊": "oncoming fist punch", "🤛": "left facing fist",
    "🤜": "right facing fist", "👏": "clapping hands applause", "🙌": "raising hands celebration", "👐": "open hands",
    "🤲": "palms up together pray", "🤝": "handshake agreement", "🙏": "folded hands pray please thank you",
    "✍️": "writing hand", "💪": "flexed biceps strong muscle", "👀": "eyes look",
    "🐶": "dog face pet", "🐱": "cat face pet", "🐭": "mouse face", "🐹": "hamster face", "🐰": "rabbit face bunny",
    "🦊": "fox face", "🐻": "bear face", "🐼": "panda face", "🐨": "koala face", "🐯": "tiger face",
    "🦁": "lion face", "🐮": "cow face", "🐷": "pig face", "🐸": "frog face", "🐵": "monkey face",
    "🐒": "monkey", "🐔": "chicken", "🐧": "penguin", "🐦": "bird", "🐤": "baby chick",
    "🐝": "honeybee", "🐛": "bug", "🦋": "butterfly", "🐌": "snail", "🐞": "ladybug lady beetle",
    "🐜": "ant", "🕷️": "spider", "🐙": "octopus", "🐠": "tropical fish", "🐬": "dolphin",
    "🍏": "green apple fruit", "🍎": "red apple fruit", "🍐": "pear fruit", "🍊": "tangerine orange fruit",
    "🍋": "lemon fruit", "🍌": "banana fruit", "🍉": "watermelon fruit", "🍇": "grapes fruit",
    "🍓": "strawberry fruit", "🍒": "cherries fruit", "🍑": "peach fruit", "🥭": "mango fruit",
    "🍍": "pineapple fruit", "🥥": "coconut fruit", "🥝": "kiwi fruit", "🍅": "tomato vegetable",
    "🍆": "eggplant vegetable", "🥑": "avocado fruit", "🥦": "broccoli vegetable", "🥒": "cucumber vegetable",
    "🌶️": "hot pepper spicy", "🍞": "bread", "🧀": "cheese", "🍖": "meat bone",
    "🍗": "poultry leg chicken", "🍔": "hamburger burger", "🍟": "french fries", "🍕": "pizza",
    "🌭": "hot dog", "🍰": "shortcake cake dessert", "🍩": "doughnut donut", "☕": "hot beverage coffee tea",
    "⚽": "soccer ball football", "🏀": "basketball", "🏈": "american football", "⚾": "baseball",
    "🥎": "softball", "🎾": "tennis", "🏐": "volleyball", "🎱": "pool 8 ball billiard",
    "🏓": "ping pong table tennis", "🏸": "badminton", "🎯": "bullseye target dart", "🎮": "video game controller",
    "🕹️": "joystick", "🎨": "artist palette paint", "🎭": "performing arts theater", "🎤": "microphone sing",
    "🎧": "headphone earphone music", "🎸": "guitar", "🎹": "musical keyboard piano", "🎬": "clapper board movie film",
    "🚗": "car automobile", "🚲": "bicycle bike", "✈️": "airplane flight travel", "🚀": "rocket space",
    "⛵": "sailboat", "⌚": "watch", "📱": "mobile phone smartphone", "💻": "laptop computer",
    "💡": "light bulb idea", "🔑": "key lock", "❤️": "red heart love", "🔥": "fire hot",
  };
  // Build category-based keywords as fallback
  Object.entries(categories).forEach(([name, cat]) => {
    cat.emojis.forEach(e => {
      map[e] = (kw[e] || name.toLowerCase()) + " " + name.toLowerCase();
    });
  });
  return map;
}

function getMessageMentions(text = "") {
  if (currentChatType !== "group" || !text.includes("@")) return [];
  const lowerText = text.toLowerCase();
  const mentions = [];
  // Check for @everyone
  if (lowerText.includes("@everyone")) {
    mentions.push({
      id: "everyone",
      name: "everyone",
      label: "everyone",
      isEveryone: true,
    });
    // Also add all members except self for notification
    currentGroupMembers
      .filter((m) => m.id !== currentUser.uid)
      .forEach((m) => {
        if (!mentions.some((mt) => mt.id === m.id)) {
          mentions.push({ id: m.id, name: m.name, label: m.name });
        }
      });
    return mentions;
  }
  currentGroupMembers
    .filter(
      (member) =>
        member.id !== currentUser.uid &&
        member.name &&
        lowerText.includes(`@${member.name.toLowerCase()}`),
    )
    .forEach((member) => {
      if (!mentions.some((m) => m.id === member.id)) {
        mentions.push({
          id: member.id,
          name: member.name,
          label: member.name,
        });
      }
    });
  return mentions;
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
  // Build items array with @everyone as first option if query matches
  const items = [];
  if ("everyone".startsWith(range.query)) {
    items.push({ id: "everyone", name: "everyone", avatar: "", isEveryone: true });
  }
  items.push(...matches);
  if (!items.length) {
    hideMentionSuggestions();
    return;
  }
  mentionSuggestionItems = items;
  mentionSuggestionRange = range;
  mentionSuggestionIndex = 0;
  box.innerHTML = "";
  items.forEach((member) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mention-suggestion";
    if (member.isEveryone) {
      button.innerHTML = `<span class="list-avatar" style="background:var(--brand);color:white;">@</span><span>@everyone</span>`;
    } else {
      button.innerHTML = `<span class="list-avatar">${member.avatar ? `<img src="${member.avatar}">` : escapeHtml(getInitials(member.name || ""))}</span><span>${escapeHtml(member.name)}</span>`;
    }
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
        <span class="poll-option-top"><span>${escapeHtml(option)}</span><span>${percent}% (${count})</span></span>
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

async function showPollVoters(messageId, optionIndex) {
  if (!messageId || Number.isNaN(optionIndex)) return;
  try {
    const doc = await db.collection("messages").doc(messageId).get();
    if (!doc.exists) return;
    const poll = doc.data().poll || {};
    const votes = poll.votes || {};
    const voterIds = Object.keys(votes).filter(id => Number(votes[id]) === optionIndex);
    const label = (poll.options || [])[optionIndex] || "Unknown";
    if (!voterIds.length) { showToast(`No votes for "${label}"`, "info"); return; }
    const names = voterIds.map(id => {
      const user = allUsers.find(u => u.id === id);
      return user?.displayName || user?.name || id.slice(0, 6);
    });
    showToast(`${label}: ${names.join(", ")}`, "info", 5000);
  } catch (e) { showToast("Could not load poll data", "error"); }
}

async function votePoll(messageId, optionIndex) {
  if (!currentUser || !messageId || Number.isNaN(optionIndex)) return;
  const updates = {};
  updates[`poll.votes.${currentUser.uid}`] = Number(optionIndex);
  await db.collection("messages").doc(messageId).update(updates);
}

function bindRenderedMessageActions() {
  document.querySelectorAll(".voice-play-btn").forEach((btn) => {
    if (btn.dataset.voiceBound) return;
    btn.dataset.voiceBound = "true";
    btn.addEventListener("click", () => {
      if (activeVoicePlayback?.button === btn) {
        if (activeVoicePlayback.audio.paused) {
          activeVoicePlayback.audio.play().catch(() => {
            showToast("Could not play audio message", "error");
          });
        } else {
          activeVoicePlayback.audio.pause();
        }
        return;
      }
      if (activeVoicePlayback) {
        activeVoicePlayback.audio.pause();
        activeVoicePlayback.button.textContent = "Play";
      }
      const audio = new Audio(btn.dataset.url);
      const speedBtn = btn.parentElement?.querySelector(".voice-speed-btn");
      const speed = speedBtn ? parseFloat(speedBtn.textContent) || 1 : 1;
      audio.playbackRate = speed;
      activeVoicePlayback = { audio, button: btn };
      audio.addEventListener("play", () => {
        btn.textContent = "Pause";
        btn.classList.add("playing");
      });
      audio.addEventListener("pause", () => {
        btn.textContent = "Play";
        btn.classList.remove("playing");
      });
      audio.addEventListener("ended", () => {
        btn.textContent = "Play";
        btn.classList.remove("playing");
        if (activeVoicePlayback?.audio === audio) activeVoicePlayback = null;
      });
      audio.play().catch(() => {
        btn.textContent = "Play";
        activeVoicePlayback = null;
        showToast("Could not play audio message", "error");
      });
    });
  });
  document.querySelectorAll(".voice-speed-btn").forEach((btn) => {
    if (btn.dataset.speedBound) return;
    btn.dataset.speedBound = "true";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const speeds = [1, 1.5, 2];
      const cur = parseFloat(btn.textContent) || 1;
      const idx = speeds.indexOf(cur);
      const next = speeds[(idx + 1) % speeds.length];
      btn.textContent = next + "×";
      if (activeVoicePlayback?.audio && activeVoicePlayback.button?.parentElement?.querySelector(".voice-speed-btn") === btn) {
        activeVoicePlayback.audio.playbackRate = next;
      }
    });
  });
  document.querySelectorAll(".poll-option").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      if (e.ctrlKey || e.metaKey) {
        showPollVoters(btn.dataset.messageId, Number(btn.dataset.optionIndex));
        return;
      }
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
  // Direct click handlers for media preview
  document.querySelectorAll("[data-preview-url]").forEach((el) => {
    if (el.dataset.previewBound) return;
    el.dataset.previewBound = "true";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("[MEDIA] click [data-preview-url]", el.dataset.previewUrl);
      var url = el.dataset.previewUrl; if (!url) return;
      try {
        if (el.querySelector("video") && typeof openMediaViewer === "function") {
          openMediaViewer(url, el.dataset.filename || "Media", "video");
        } else if (el.querySelector("img") && typeof openMediaViewer === "function") {
          openMediaViewer(url, el.dataset.filename || "Image");
        } else if (typeof previewFile === "function") {
          previewFile(url, el.dataset.filename);
        } else {
          console.log("[MEDIA] fallback - openMediaViewer/previewFile not defined");
          forceShowViewer(url);
        }
      } catch(ex) {
        console.error("[MEDIA] error in handler, using fallback", ex);
        forceShowViewer(url);
      }
    });
  });
  document.querySelectorAll(".video-attachment video").forEach((video) => {
    if (video.dataset.videoBound) return;
    video.dataset.videoBound = "true";
    video.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      var url = video.currentSrc || video.src || (video.querySelector("source")?.src) || "";
      console.log("[MEDIA] click video-attachment", url);
      if (!url) return;
      try {
        if (typeof openMediaViewer === "function") {
          openMediaViewer(url, "Video", "video");
        } else {
          console.log("[MEDIA] fallback - openMediaViewer not defined");
          forceShowViewer(url);
        }
      } catch(ex) {
        console.error("[MEDIA] error in video handler", ex);
        forceShowViewer(url);
      }
    });
  });
}

function forceShowViewer(url) {
  console.log("[MEDIA] forceShowViewer", url);
  var viewer = document.getElementById("mediaViewer");
  var img = document.getElementById("mediaViewerImg");
  var video = document.getElementById("mediaViewerVideo");
  if (!viewer || !img) { console.log("[MEDIA] viewer DOM missing"); return; }
  try { video.pause(); video.src = ""; } catch(_) {}
  video.style.display = "none";
  img.style.display = "";
  img.src = url;
  viewer.style.display = "flex";
  viewer.style.transform = "";
  viewer.style.opacity = "";
  document.body.style.overflow = "hidden";
  console.log("[MEDIA] viewer displayed");
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
  // Re-lock temporarily unlocked chat on navigation away
  if (temporarilyUnlockedChatId) relockTemporarilyUnlockedChat();
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
  const descBanner = document.getElementById("groupDescriptionBanner");
  if (descBanner) descBanner.style.display = "none";
  const headerSub = document.getElementById("chatHeaderSub");
  if (headerSub) headerSub.style.display = "none";
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
  if ("setAppBadge" in navigator) {
    if (totalUnread > 0) navigator.setAppBadge(totalUnread).catch(() => {});
    else navigator.clearAppBadge?.().catch(() => {});
  }
  document.title =
    totalUnread > 0 ? `(${totalUnread}) Team Chat` : "Team Chat - Complete";
  // Show/hide mark-all-read bar based on unreads (all + unread tabs)
  const bar = document.getElementById("markAllReadBar");
  if (bar && (currentViewTab === "all" || currentViewTab === "unread")) {
    bar.style.display = totalUnread > 0 ? "flex" : "none";
  }
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
  const isVideo = currentAttachment.type === "video";
  const isAudio = ["audio", "voice"].includes(currentAttachment.type);
  const attachmentType = isImage
    ? "Image attachment"
    : getAttachmentLabel(currentAttachment);
  preview.style.display = "flex";
  preview.innerHTML = `
    ${
      isImage
        ? `<img src="${currentAttachment.url}" alt="Attachment preview">`
        : isVideo
          ? `<video src="${currentAttachment.url}" controls playsinline preload="metadata"></video>`
          : isAudio
            ? `<audio src="${currentAttachment.url}" controls preload="metadata"></audio>`
            : '<span class="attachment-file-icon"></span>'
    }
    <div style="min-width:0">
      <strong>${escapeHtml(currentAttachment.filename || (isImage ? "Image ready" : "Document ready"))}</strong>
      <div class="list-preview">${escapeHtml(attachmentType)}${currentAttachment.size ? ` · ${formatBytes(currentAttachment.size)}` : ""}</div>
    </div>
    <button type="button" id="clearAttachmentBtn">Remove</button>
  `;
  if (!isImage && !isVideo && !isAudio) {
    const icon = preview.querySelector(".attachment-file-icon");
    if (icon) {
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
  const speakerBtn = document.getElementById("speakerCallBtn");
  const upgradeVideoBtn = document.getElementById("upgradeVideoCallBtn");
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

  if (speakerBtn) {
    speakerBtn.classList.toggle("active", speakerOn);
    speakerBtn.title = speakerOn ? "Use earpiece or default output" : "Use speaker";
    speakerBtn.setAttribute("aria-label", speakerBtn.title);
    speakerBtn.dataset.controlLabel = speakerOn ? "SPEAKER" : "OUTPUT";
  }

  if (upgradeVideoBtn) {
    if (activeCallMode === "active") {
      upgradeVideoBtn.style.display = "inline-flex";
      upgradeVideoBtn.textContent = currentCallType === "video" ? "Voice" : "Video";
      upgradeVideoBtn.title = currentCallType === "video" ? "Switch to voice call" : "Switch to video call";
    } else {
      upgradeVideoBtn.style.display = "none";
    }
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

  const peopleBtn = document.getElementById("peopleCallBtn");
  if (peopleBtn) {
    peopleBtn.style.display = activeCallMode === "active" ? "inline-flex" : "none";
  }
  const viewBtn = document.getElementById("toggleViewBtn");
  if (viewBtn) {
    viewBtn.style.display = activeCallMode === "active" ? "inline-flex" : "none";
    viewBtn.textContent = isSpeakerView ? "Grid" : "View";
  }

  const proximityBtn = document.getElementById("proximityLockBtn");
  if (proximityBtn) {
    proximityBtn.style.display = activeCallMode === "active" ? "inline-flex" : "none";
    proximityBtn.classList.toggle("active", proximityLockEnabled);
  }

  const msgBtn = document.getElementById("msgCallBtn");
  if (msgBtn) {
    msgBtn.style.display = activeCallMode === "active" ? "inline-flex" : "none";
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

function setupCallAudioSession() {
  if (!navigator.mediaSession) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: activeCall?.fromUserName || activeCall?.toUserName || "Call",
      album: currentCallType === "video" ? "Video call" : "Voice call",
      artwork: [{ src: "app-icon-192.png", sizes: "192x192", type: "image/png" }],
    });
    navigator.mediaSession.setActionHandler("hangup", () => {
      endActiveCall("ended").catch(() => {});
    });
  } catch (e) {
    console.warn("Could not set up media session:", e);
  }
}

function clearCallAudioSession() {
  if (!navigator.mediaSession) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.setActionHandler("hangup", null);
  } catch (e) {}
}

function startIncomingRingtone() {
  stopIncomingRingtone();
  // Native apps and browsers must let their notification system decide whether
  // a call rings or vibrates. Direct audio/vibration here would bypass silent
  // mode, DND, per-app channel settings, or browser notification restrictions.
}

function notifyIncomingCall(call) {
  if (Notification.permission === "granted") {
    showStrongIncomingCallNotification(call);
  }
  requestCallWakeLock();
}

async function clearChatNotifications(chatId, chatType) {
  if (!chatId || !chatType) return;
  const tag = `chat-${chatType}-${chatId}`;
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications({ tag });
      notifications.forEach((notification) => notification.close());
    }
  } catch (error) {
    console.warn("Could not clear browser chat notification:", error);
  }
  try {
    const nativePlugin = window.Capacitor?.Plugins?.AppPermissions;
    if (isNativeAndroidApp && nativePlugin?.clearChatNotification) {
      await nativePlugin.clearChatNotification({ chatId, chatType });
    }
  } catch (error) {
    console.warn("Could not clear native chat notification:", error);
  }
}

async function clearCallNotifications(callId) {
  if (!callId) return;
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications({
        tag: `call-${callId}`,
      });
      notifications.forEach((notification) => notification.close());
    }
  } catch (error) {
    console.warn("Could not clear browser call notification:", error);
  }
  try {
    const nativePlugin = window.Capacitor?.Plugins?.AppPermissions;
    if (isNativeAndroidApp && nativePlugin?.clearCallNotification) {
      await nativePlugin.clearCallNotification({ callId });
    }
  } catch (error) {
    console.warn("Could not clear native call notification:", error);
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
  const pushSetupTimeout = setTimeout(() => { pushSetupStarted = false; }, 30000);
  try {
    const permissionReady = await ensureCallNotificationPermission({ force });
    if (!permissionReady) return;

    if (!firebase.messaging) {
      console.warn("Firebase Messaging SDK is not loaded.");
      return;
    }

    messaging = messaging || firebase.messaging();

    const registration = await navigator.serviceWorker.register(
      "sw.js?v=189",
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
      messaging.onMessage(async (payload) => {
        const data = payload.data || {};
        if (typeof checkDndStatus === 'function' && checkDndStatus()) {
          console.log('[DND] Suppressed foreground notification during quiet hours');
          return;
        }
        if (data.kind === "call" && document.hidden) {
          showStrongIncomingCallNotification({
            id: data.callId,
            type: data.type,
            fromUserName: data.fromUserName,
            senderAvatar: data.senderAvatar,
          });
        } else if (data.kind === "chat_request") {
          showToast(
            payload.notification?.body ||
              `${data.fromUserName || "Someone"} updated a chat request.`,
          );
        } else if (["message", "missed_call", "status_update"].includes(data.kind)) {
          const title = payload.notification?.title || data.title || "Team Chat";
          const body = payload.notification?.body || data.body || "New notification";
          const chatKey = data.chatId && data.chatType ? `${data.chatType}-${data.chatId}` : "";
          if (document.hidden && Notification.permission === "granted") {
            navigator.serviceWorker.ready.then((reg) =>
              reg.showNotification(title, {
                body,
                icon: data.senderAvatar || "app-icon-192.png",
                badge: "app-icon-192.png",
                image: data.senderAvatar || "app-icon-512.png",
                tag:
                  data.kind === "message" && chatKey
                    ? `chat-${chatKey}`
                    : `${data.kind}-${data.messageId || data.callId || Date.now()}`,
                renotify: data.kind === "missed_call",
                data: {
                  url: data.url || "./index.html",
                  kind: data.kind || "",
                  chatId: data.chatId || "",
                  chatType: data.chatType || "",
                  chatUserId: data.chatUserId || "",
                  groupId: data.groupId || "",
                  unreadCount: Number(data.unreadCount || 0),
                },
                silent: data.soundEnabled === "false",
                vibrate:
                  data.vibrate === "false"
                    ? []
                    : data.kind === "missed_call"
                      ? [180, 80, 180]
                      : [180, 80, 180],
                actions: [{ action: "open", title: "Open chat" }],
              }),
            ).catch(() => {});
          } else {
            showToast(`${title}: ${body}`);
          }
        }
      });
      if (messaging.onTokenRefresh && !window.__teamChatFcmTokenRefreshBound) {
        window.__teamChatFcmTokenRefreshBound = true;
        messaging.onTokenRefresh(async (refreshedToken) => {
          if (!currentUser) return;
          const tokenKey = refreshedToken.replace(/[^a-zA-Z0-9]/g, "").slice(-120);
          await db.collection("users").doc(currentUser.uid).set({
            fcmTokens: {
              [tokenKey]: {
                token: refreshedToken,
                platform: navigator.userAgent || "web",
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                permission: Notification.permission,
                scope: (await navigator.serviceWorker.ready).scope || "./",
                purpose: "incoming-calls",
              },
            },
            lastFcmTokenUpdateAt: firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }).catch(() => {});
          localStorage.setItem(getFcmTokenStorageKey(), String(Date.now()));
        });
      }
    }
  } catch (error) {
    console.warn("FCM registration failed:", error);
    showToast(
      "Could not enable call notifications. Check Chrome notification permission.",
      "error",
    );
  } finally {
    clearTimeout(pushSetupTimeout);
    pushSetupStarted = false;
  }
}

async function showStrongIncomingCallNotification(call = {}) {
  if (typeof checkDndStatus === 'function' && checkDndStatus()) {
    console.log('[DND] Suppressed call notification during quiet hours');
    return;
  }
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
        icon: call.senderAvatar || "app-icon-192.png",
        badge: "app-icon-192.png",
        image: call.senderAvatar || "app-icon-512.png",
        timestamp: Date.now(),
        vibrate: [700, 250, 700, 250, 700, 250, 700, 250, 700],
        data: {
          url: "./index.html",
          callId: call.id || "",
          kind: "call",
          fromUserName: call.fromUserName || "",
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
  if (ringtoneAudioContext) {
    ringtoneAudioContext.close().catch(() => {});
    ringtoneAudioContext = null;
  }
}

function clearCallTimeout() {
  clearTimeout(callTimeoutTimer);
  callTimeoutTimer = null;
}

async function writeCompleteCallHistory(status, callData = activeCall) {
  if (!callData?.id || !currentUser) return;
  const durationMs = callStartedAt
    ? Date.now() - callStartedAt
    : Number(callData.callDurationMs) || 0;
  const type = callData.type || currentCallType || "voice";
  const isGroup = Boolean(callData.groupCall || callData.groupId);
  const directId = isGroup ? "" : getDirectChatId(callData.fromUserId, callData.toUserId);
  const groupId = callData.groupId || "";
  const direction = callData.fromUserId === currentUser.uid ? "Outgoing" : "Incoming";
  const text = getViewedCallHistoryText(status, type, durationMs, direction);
  await db.collection("messages").doc(`call_${callData.historyDocumentId || callData.id}`).set({
    type: "call",
    callId: callData.id,
    callType: type,
    callStatus: status,
    callDurationMs: durationMs,
    callFromUserId: callData.fromUserId,
    callToUserId: callData.toUserId || "",
    callParticipantNames: callData.participantNames || {},
    ...(directId ? { directId, participants: [callData.fromUserId, callData.toUserId] } : {}),
    ...(groupId ? { groupId } : {}),
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    readBy: { [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp() },
  }, { merge: true }).catch((error) => console.warn("Could not write complete call history:", error));

  if (groupId) {
    await db.collection("groups").doc(groupId).set({
      lastMessage: text,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
  } else if (directId) {
    await db.collection("directChats").doc(directId).set({
      participants: [callData.fromUserId, callData.toUserId],
      status: "active",
      lastMessage: text,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
  }
  callLogWritten = true;
}

async function writeGroupParticipantCallHistory(status, callData = activeCall) {
  if (!callData?.id || !currentUser) return;
  await writeCompleteCallHistory(status, {
    ...callData,
    historyDocumentId: `${callData.id}_${currentUser.uid}`,
  });
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
        await writeCompleteCallHistory("missed", { id: snapshot.id, ...data });
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
  document.getElementById("speakerCallBtn").style.display =
    mode === "incoming" ? "none" : (isAudioOutputSelectionSupported() ? "inline-flex" : "none");
  const addParticipantBtn = document.getElementById("addCallParticipantBtn");
  if (addParticipantBtn) {
    addParticipantBtn.style.display =
      mode === "active" ? "inline-flex" : "none";
  }
  document.getElementById("toggleCameraBtn").style.display =
    mode !== "incoming" && type === "video" ? "inline-flex" : "none";
  const upgradeVideoBtn = document.getElementById("upgradeVideoCallBtn");
  if (upgradeVideoBtn) {
    upgradeVideoBtn.style.display =
      mode === "active" && type === "voice" ? "inline-flex" : "none";
  }
  const switchCameraBtn = document.getElementById("switchCameraBtn");
  if (switchCameraBtn) {
    switchCameraBtn.style.display =
      mode !== "incoming" && type === "video" ? "inline-flex" : "none";
  }
  const peopleBtn = document.getElementById("peopleCallBtn");
  if (peopleBtn) {
    peopleBtn.style.display = mode === "active" ? "inline-flex" : "none";
  }
  const viewBtn = document.getElementById("toggleViewBtn");
  if (viewBtn) {
    viewBtn.style.display = mode === "active" ? "inline-flex" : "none";
    viewBtn.textContent = isSpeakerView ? "Grid" : "View";
  }
  const proximityBtn = document.getElementById("proximityLockBtn");
  if (proximityBtn) {
    proximityBtn.style.display = mode === "active" ? "inline-flex" : "none";
    proximityBtn.classList.toggle("active", proximityLockEnabled);
  }
  const msgBtn = document.getElementById("msgCallBtn");
  if (msgBtn) {
    msgBtn.style.display = mode === "active" ? "inline-flex" : "none";
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

  callMiniBar = document.createElement("div");
  callMiniBar.className = "call-mini-bar";
  callMiniBar.tabIndex = 0;
  callMiniBar.setAttribute("role", "button");
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
  callMiniBar.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      restoreActiveCallUi();
    }
  });
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

function clearCallIceRestartTimer() {
  clearTimeout(callIceRestartTimer);
  callIceRestartTimer = null;
}

function clearCallRenegotiationTimer() {
  clearTimeout(callRenegotiationTimer);
  callRenegotiationTimer = null;
}

async function attemptIceRestart() {
  if (!peerConnection || !activeCall?.id || isIceRestarting) return;
  if (["connected", "connecting"].includes(peerConnection.connectionState)) return;
  if (peerConnection.signalingState !== "stable") return;

  isIceRestarting = true;
  setCallStatus(document.hidden ? "Reconnecting in background..." : "Reconnecting...");
  showCallMiniBar("Reconnecting...");
  try {
    const offer = await peerConnection.createOffer({ iceRestart: true });
    await peerConnection.setLocalDescription(offer);
    await db.collection("calls").doc(activeCall.id).set({
      offer,
      renegotiatedBy: currentUser?.uid || "",
      type: currentCallType,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    callIceRestartTimer = setTimeout(() => {
      isIceRestarting = false;
      if (!peerConnection || !activeCall) return;
      if (["connected", "connecting"].includes(peerConnection.connectionState)) return;
      scheduleCallConnectionFailure("failed");
    }, 10000);
  } catch (e) {
    console.warn("ICE restart failed:", e);
    isIceRestarting = false;
    scheduleCallConnectionFailure("failed");
  }
}

function handleCallConnectionDegraded() {
  scheduleCallConnectionFailure("failed");
  attemptIceRestart();
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

const CALL_STATE_KEY = "tc_call_state";

function saveCallState() {
  if (!activeCall?.id) return;
  try {
    sessionStorage.setItem(CALL_STATE_KEY, JSON.stringify({
      id: activeCall.id,
      type: currentCallType,
      mode: activeCallMode,
      startedAt: callStartedAt,
      groupCall: activeCall.groupCall || false,
      savedAt: Date.now(),
    }));
  } catch (e) {}
}

function clearCallState() {
  try { sessionStorage.removeItem(CALL_STATE_KEY); } catch (e) {}
}

async function restoreCallStateIfNeeded() {
  let saved;
  try {
    const raw = sessionStorage.getItem(CALL_STATE_KEY);
    if (!raw) return false;
    saved = JSON.parse(raw);
  } catch (e) {
    clearCallState();
    return false;
  }
  if (Date.now() - (saved.savedAt || 0) > 120000 || activeCall?.id === saved.id) {
    clearCallState();
    return false;
  }
  try {
    const snap = await db.collection("calls").doc(saved.id).get();
    if (!snap.exists) { clearCallState(); return false; }
    const callData = snap.data() || {};
    const status = callData.status;
    if (status === "connected" || status === "ringing") {
      showCallRecoveryModal(saved, callData);
      return true;
    }
    clearCallState();
    showToast("Your previous call has ended");
    return false;
  } catch (e) {
    console.warn("Call state recovery check failed:", e);
    clearCallState();
    return false;
  }
}

function showCallRecoveryModal(saved, callData) {
  const existing = document.getElementById("callRecoveryModal");
  if (existing) existing.remove();
  const isRinging = callData.status === "ringing";
  const title = callData.fromUserName || callData.groupName || "Call";
  const type = saved.type || "voice";
  const modal = document.createElement("div");
  modal.id = "callRecoveryModal";
  modal.className = "modal call-modal";
  modal.style.cssText = "display:flex;z-index:9999";
  modal.innerHTML = `
    <div class="call-shell" style="padding:24px;text-align:center">
      <h3 style="margin:0 0 8px">${isRinging ? "Incoming call" : "Call interrupted"}</h3>
      <p style="margin:0 0 16px;color:rgba(255,255,255,0.7);font-size:14px">
        ${isRinging ? `${title} is calling\u2026` : `You were in a ${type} call with ${title}`}
      </p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        ${isRinging
          ? `<button id="recoveryAcceptBtn" class="call-icon-btn accept-call" style="padding:12px 32px">Accept</button>
             <button id="recoveryRejectBtn" class="call-icon-btn" style="padding:12px 32px;background:#e74c3c">Decline</button>`
          : `<button id="recoveryRejoinBtn" class="call-icon-btn accept-call" style="padding:12px 32px">Rejoin</button>
             <button id="recoveryEndBtn" class="call-icon-btn" style="padding:12px 32px;background:#e74c3c">End call</button>`}
        <button id="recoveryDismissBtn" class="call-icon-btn" style="padding:12px 32px;background:#555">Dismiss</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("recoveryDismissBtn")?.addEventListener("click", () => { modal.remove(); clearCallState(); });
  document.getElementById("recoveryRejoinBtn")?.addEventListener("click", async () => { modal.remove(); await rejoinCall(saved, callData); });
  document.getElementById("recoveryEndBtn")?.addEventListener("click", async () => { modal.remove(); await endCallFromRecovery(saved); });
  document.getElementById("recoveryAcceptBtn")?.addEventListener("click", async () => { modal.remove(); clearCallState(); await autoAcceptNativeCall(saved.id); });
  document.getElementById("recoveryRejectBtn")?.addEventListener("click", async () => { modal.remove(); clearCallState(); await autoRejectNativeCall(saved.id); });
}

async function rejoinCall(saved, callData) {
  cleanupCallUi();
  clearCallState();
  if (saved.groupCall || callData.groupCall) {
    await joinGroupCallRoom(saved.id, callData, "active");
    return;
  }
  activeCall = { id: saved.id, ...callData };
  currentCallType = saved.type || "voice";
  const rejoiningRole = callData.fromUserId === currentUser?.uid ? "caller" : "callee";
  try {
    await preparePeerConnection(saved.id, rejoiningRole);
    const offer = await peerConnection.createOffer({ iceRestart: true });
    await peerConnection.setLocalDescription(offer);
    await db.collection("calls").doc(saved.id).set({
      offer, renegotiatedBy: currentUser?.uid || "",
      status: "reconnecting",
      reconnectedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    setCallUi({ mode: "active", type: currentCallType, title: callData.fromUserName || callData.toUserName || "Call", status: "Reconnecting..." });
    const otherRole = rejoiningRole === "caller" ? "callee" : "caller";
    callCandidatesUnsubscribe = db.collection("calls").doc(saved.id)
      .collection(`${otherRole}Candidates`)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") addRemoteIceCandidate(change.doc.data());
        });
      });
    callDocUnsubscribe = db.collection("calls").doc(saved.id).onSnapshot((snap) => {
      const d = snap.data();
      if (!d) return;
      if (d.answer && !peerConnection?.currentRemoteDescription) setPeerRemoteDescription(d.answer);
      if (["ended","cancelled","rejected","declined","missed","failed","busy"].includes(d.status)) { cleanupCallUi(); showToast("Call has ended"); }
    });
    saveCallState();
  } catch (e) {
    console.warn("Could not rejoin call:", e);
    showToast("Could not rejoin call", "error");
    cleanupCallUi();
  }
}

async function endCallFromRecovery(saved) {
  try {
    await db.collection("calls").doc(saved.id).set({
      status: "ended",
      endedAt: firebase.firestore.FieldValue.serverTimestamp(),
      endedBy: currentUser?.uid || "unknown",
    }, { merge: true });
    showToast("Call ended");
  } catch (e) { showToast("Could not end call", "error"); }
  clearCallState();
}

function startCallHeartbeat() {
  clearInterval(callHeartbeatTimer);
  callHeartbeatTimer = setInterval(() => {
    if (activeCall?.id) {
      db.collection("calls").doc(activeCall.id).set({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }
  }, 30000);
}

function stopCallHeartbeat() {
  clearInterval(callHeartbeatTimer);
  callHeartbeatTimer = null;
}

function cleanupCallUi() {
  const closingCallId = activeCall?.id || "";
  clearCallNotifications(closingCallId);
  hideMiniCallBar();
  clearCallTimeout();
  clearCallConnectionFailureTimer();
  hideCallMiniBar();
  document.body.classList.remove("call-minimized");
  document.querySelector(".call-video-stage")?.classList.remove("speaker-view");
  stopIncomingRingtone();
  stopCallDuration();
  stopCallHeartbeat();
  clearCallState();
  clearCallIceRestartTimer();
  clearCallRenegotiationTimer();
  isIceRestarting = false;
  clearCallAudioSession();
  releaseCallWakeLock();
  if (proximityLockEnabled) toggleProximityLock();
  hideCallWaitingModal();
  closeInCallMsgPanel();
  if (isScreenRecording) toggleScreenRecording();
  stopScreenRecordStream();
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
  if (callWaitingUnsub) { callWaitingUnsub(); callWaitingUnsub = null; }
  if (waitingParticipantCheckInterval) {
    clearInterval(waitingParticipantCheckInterval);
    waitingParticipantCheckInterval = null;
  }
  callDocUnsubscribe = null;
  callCandidatesUnsubscribe = null;
  activeCall = null;
  activeCallMode = null;
  cameraSender = null;
  callLogWritten = false;
  lastHandledRenegotiationSdp = "";
  micMuted = false;
  cameraOff = false;
  speakerOn = false;
  isSpeakerView = false;
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
    track.onended = () => {
      if (track.kind === "video") {
        showToast("Camera disconnected — check your device", "error");
      } else if (track.kind === "audio") {
        showToast("Microphone disconnected — check your device", "error");
      }
    };
  });
  peerConnection.ontrack = (event) => {
    event.streams[0]
      .getTracks()
      .forEach((track) => {
        remoteCallStream.addTrack(track);
        track.onended = () => {
          showToast("Remote participant's media lost", "error");
        };
      });
    remoteAudio?.play?.().catch(() => {});
    remoteVideo?.play?.().catch(() => {});
  };
  peerConnection.onconnectionstatechange = async () => {
    if (!peerConnection) return;
    const state = peerConnection.connectionState;
    if (state === "connected") {
      clearCallTimeout();
      clearCallConnectionFailureTimer();
      clearCallIceRestartTimer();
      isIceRestarting = false;
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
      saveCallState();
      startCallHeartbeat();
      setupCallAudioSession();
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
      handleCallConnectionDegraded();
    } else if (state === "failed") {
      handleCallConnectionDegraded();
    } else if (state === "closed") {
      cleanupCallUi();
    }
  };
  peerConnection.oniceconnectionstatechange = async () => {
    if (!peerConnection) return;
    const iceState = peerConnection.iceConnectionState;
    if (iceState === "connected" || iceState === "completed") {
      clearCallIceRestartTimer();
      clearCallRenegotiationTimer();
      isIceRestarting = false;
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

async function downgradeVideoToVoice() {
  if (!activeCall?.id || !peerConnection || !localCallStream) return;
  try {
    setCallStatus("Switching to voice...");
    const videoTracks = localCallStream.getVideoTracks();
    videoTracks.forEach((track) => {
      localCallStream.removeTrack(track);
      track.stop();
    });
    if (cameraSender) {
      peerConnection.removeTrack(cameraSender).catch(() => {});
      cameraSender = null;
    }
    const localVideo = document.getElementById("localVideo");
    const remoteVideo = document.getElementById("remoteVideo");
    if (localVideo) localVideo.style.display = "none";
    if (remoteVideo) {
      remoteVideo.style.display = "none";
      remoteVideo.srcObject = null;
    }
    const grid = document.getElementById("groupCallGrid");
    if (grid) {
      grid.querySelectorAll("video").forEach((v) => v.remove());
      grid.querySelectorAll(".group-call-tile").forEach((t) => t.classList.add("voice-only"));
    }
    currentCallType = "voice";
    cameraOff = true;
    if (activeCall) activeCall.type = "voice";
    if (isSpeakerView) {
      isSpeakerView = false;
      document.querySelector(".call-video-stage")?.classList.remove("speaker-view");
      const viewBtn = document.getElementById("toggleViewBtn");
      if (viewBtn) { viewBtn.textContent = "View"; viewBtn.title = "Switch to speaker view"; }
    }
    const label = document.getElementById("callTypeLabel");
    if (label) label.textContent = "Voice call";
    const camBtn = document.getElementById("toggleCameraBtn");
    if (camBtn) camBtn.style.display = "none";
    const swBtn = document.getElementById("switchCameraBtn");
    if (swBtn) swBtn.style.display = "none";
    updateCallControlState();
    await renegotiateActiveCall();
  } catch (error) {
    showToast("Failed to switch to voice call", "error");
    setCallStatus(callStartedAt ? "Connected" : "Connecting...");
  }
}

async function renegotiateActiveCall() {
  if (!activeCall?.id || !peerConnection) return;
  clearCallRenegotiationTimer();
  const callRef = db.collection("calls").doc(activeCall.id);
  const offer = await peerConnection.createOffer({ iceRestart: true });
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
  callRenegotiationTimer = setTimeout(async () => {
    callRenegotiationTimer = null;
    if (!peerConnection || !activeCall?.id) return;
    if (peerConnection.signalingState !== "have-local-offer") return;
    try {
      await peerConnection.setLocalDescription({ type: "rollback" });
    } catch (_) {}
  }, 15000);
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
  try {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.offer),
    );
  } catch (e) {
    console.warn("Renegotiation setRemoteDescription failed, rolling back:", e);
    if (peerConnection.signalingState !== "stable") {
      try { await peerConnection.setLocalDescription({ type: "rollback" }); } catch (_) {}
    }
    return;
  }
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
  clearCallRenegotiationTimer();
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
  saveCallState();
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
    if (callData.waitingRoomEnabled && callData.fromUserId !== currentUser.uid) {
      await db.collection("calls").doc(callId).update({
        [`participantStates.${currentUser.uid}`]: "waiting",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      setCallStatus("Waiting for host to let you in...");
      showToast("Waiting for host to admit you");
      callWaitingUnsub = db.collection("calls").doc(callId).onSnapshot((snap) => {
        const state = snap.data()?.participantStates?.[currentUser.uid];
        if (state === "joined") {
          if (callWaitingUnsub) { callWaitingUnsub(); callWaitingUnsub = null; }
          activeGroupCallParticipants = getGroupCallParticipantsFromIds(
            snap.data()?.participantIds || [],
          ).then((participants) => {
            for (const p of participants) {
              if (p.id !== currentUser.uid) connectGroupPeer(callId, p);
            }
            setCallStatus("Connected");
            startCallDuration();
            requestCallWakeLock();
          });
          setCallStatus("Connecting...");
        } else if (state === "rejected") {
          if (callWaitingUnsub) { callWaitingUnsub(); callWaitingUnsub = null; }
          showToast("Host declined your join request", "error");
          cleanupCallUi();
        }
      });
      return;
    }
    await db
      .collection("calls")
      .doc(callId)
      .update({
        [`participantStates.${currentUser.uid}`]: "joined",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
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
        if (activeCall?.fromUserId === currentUser.uid) {
          const busyNames = Object.entries(data.participantStates || {})
            .filter(([id, state]) => id !== currentUser.uid && state === "busy")
            .map(([id]) => data.participantNames?.[id] || "A participant");
          const notified = new Set(activeCall.busyNotified || []);
          busyNames.forEach((name) => {
            if (notified.has(name)) return;
            notified.add(name);
            showToast(`${name} is currently in another call`, "error");
          });
          activeCall.busyNotified = [...notified];
        }
        if (["ended", "cancelled", "failed", "rejected", "declined"].includes(data.status))
          cleanupCallUi();
      });
  } catch (error) {
    showToast(getCallPermissionMessage(error, currentCallType), "error");
    await db
      .collection("calls")
      .doc(callId)
      .update({
        [`participantStates.${currentUser.uid}`]: "failed",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => {});
    await writeGroupParticipantCallHistory("failed", activeCall);
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
    fromUserAvatar:
      document.querySelector("#userAvatar img")?.src || currentUser.photoURL || "",
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
      await db.collection("calls").doc(activeCall.id).update({
        [`participantStates.${currentUser.uid}`]: "failed",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
      await writeGroupParticipantCallHistory("failed", activeCall);
      cleanupCallUi();
      return;
    }
    if (activeCall.type === "video") {
      const hasCam = await ensureNativePermission("camera");
      if (!hasCam) {
        await db.collection("calls").doc(activeCall.id).update({
          [`participantStates.${currentUser.uid}`]: "failed",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {});
        await writeGroupParticipantCallHistory("failed", activeCall);
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
  const callData = activeCall ? { ...activeCall } : null;
  try {
    if (callId) {
      if (status === "declined" && activeCallMode === "incoming") {
        await db
          .collection("calls")
          .doc(callId)
          .update({
            [`participantStates.${currentUser.uid}`]: "rejected",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        await writeGroupParticipantCallHistory("declined", callData);
        cleanupCallUi();
        return;
      }
      if (callData?.fromUserId !== currentUser.uid) {
        await db
          .collection("calls")
          .doc(callId)
          .update({
            [`participantStates.${currentUser.uid}`]: "left",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        cleanupCallUi();
        return;
      }
      await db
        .collection("calls")
        .doc(callId)
        .update({
          status,
          endedBy: currentUser?.uid || null,
          callDurationMs: callStartedAt ? Date.now() - callStartedAt : 0,
          endedAt: firebase.firestore.FieldValue.serverTimestamp(),
          [`participantStates.${currentUser.uid}`]: "left",
        });
      await writeCompleteCallHistory(status, callData);
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
    fromUserAvatar:
      document.querySelector("#userAvatar img")?.src || currentUser.photoURL || "",
    toUserId: currentChat.otherUserId,
    toUserName: currentChat.otherUserName || currentChat.name || "Contact",
  };
  saveCallState();
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
      if (data.status === "declined") {
        showToast("Call declined", "error");
      }
      if (data.status === "missed") {
        showToast("Call missed", "error");
      }
      if (data.status === "busy") {
        showToast("This person is currently in another call", "error");
      }
      if (
        ["ended", "cancelled", "rejected", "declined", "missed", "failed", "busy"].includes(
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
      endedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await writeCompleteCallHistory("failed", activeCall);
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
        .update({
          status: "rejected",
          endedAt: firebase.firestore.FieldValue.serverTimestamp(),
          endedBy: currentUser.uid,
        });
      await writeCompleteCallHistory("rejected", activeCall);
      cleanupCallUi();
      return;
    }
    if (activeCall.type === "video") {
      const hasCam = await ensureNativePermission("camera");
      if (!hasCam) {
        await db
          .collection("calls")
          .doc(activeCall.id)
          .update({
            status: "rejected",
            endedAt: firebase.firestore.FieldValue.serverTimestamp(),
            endedBy: currentUser.uid,
          });
        await writeCompleteCallHistory("rejected", activeCall);
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
        ["ended", "cancelled", "rejected", "declined", "missed", "failed", "busy"].includes(
          snapshot.data()?.status,
        )
      )
        cleanupCallUi();
    });
  } catch (error) {
    showToast(getCallPermissionMessage(error, currentCallType), "error");
    await callRef.update({
      status: "failed",
      error: error.message,
      endedAt: firebase.firestore.FieldValue.serverTimestamp(),
      endedBy: currentUser.uid,
    });
    await writeCompleteCallHistory("failed", activeCall);
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

    const isGroupParticipant =
      callData.groupCall === true &&
      Array.isArray(callData.participantIds) &&
      callData.participantIds.includes(currentUser.uid);
    if (callData.toUserId !== currentUser.uid && !isGroupParticipant) return;
    if (!["ringing", "accepted"].includes(callData.status)) return;

    activeCall = { id: snap.id, ...callData };
    saveCallState();
    currentCallType = activeCall.type || "voice";

    if (isGroupParticipant) await acceptIncomingGroupCall();
    else await acceptIncomingCall();
  } catch (error) {
    console.warn("autoAcceptNativeCall failed:", error);
    showToast("Could not open accepted call. Please try again.", "error");
  }
}

async function autoRejectNativeCall(callId) {
  if (!callId || !currentUser) return;
  try {
    const callRef = db.collection("calls").doc(callId);
    const snap = await callRef.get();
    const callData = snap.data() || {};
    const isGroupParticipant =
      callData.groupCall === true &&
      Array.isArray(callData.participantIds) &&
      callData.participantIds.includes(currentUser.uid);
    if (!snap.exists || (callData.toUserId !== currentUser.uid && !isGroupParticipant)) return;
    if (!["ringing", "accepted"].includes(callData.status)) return;
    if (isGroupParticipant) {
      await callRef.update({
        [`participantStates.${currentUser.uid}`]: "rejected",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await writeCompleteCallHistory("declined", {
        id: snap.id,
        ...callData,
        historyDocumentId: `${snap.id}_${currentUser.uid}`,
      });
      if (activeCall?.id === callId) cleanupCallUi();
      showToast("Group call declined");
      return;
    }
    await callRef.set(
      {
        status: "declined",
        endedAt: firebase.firestore.FieldValue.serverTimestamp(),
        endedBy: currentUser.uid,
      },
      { merge: true },
    );
    await writeCompleteCallHistory("declined", { id: snap.id, ...callData });
    if (activeCall?.id === callId) cleanupCallUi();
    showToast("Call declined");
  } catch (error) {
    console.warn("autoRejectNativeCall failed:", error);
    showToast("Could not reject the call. Please try again.", "error");
  }
}

async function handlePendingWebCallAction() {
  const params = new URLSearchParams(window.location.search);
  const callId = params.get("callId");
  const action = params.get("callAction");
  if (!callId || !currentUser) return;
  params.delete("callId");
  params.delete("callAction");
  const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
  history.replaceState(history.state, "", clean);
  if (action === "reject") await autoRejectNativeCall(callId);
  else await autoAcceptNativeCall(callId);
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
  setCallStatus(status === "declined" ? "Declining..." : status === "rejected" ? "Rejecting..." : "Ending call...");

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

      if (["ended", "cancelled", "rejected", "declined", "missed", "failed"].includes(finalStatus)) {
        await writeCompleteCallHistory(finalStatus, call).catch((error) =>
          console.warn("Call history failed:", error),
        );
      }

      await callRef.set(
        {
          status: finalStatus,
          callDurationMs: callStartedAt ? Date.now() - callStartedAt : 0,
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
    showToast(status === "declined" ? "Call declined" : status === "rejected" ? "Call rejected" : "Call ended");
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

        // If another active connected/outgoing call is running, show call waiting
        if (
          activeCall &&
          activeCall.id !== call.id &&
          activeCallMode !== "incoming"
        ) {
          showCallWaitingModal({ id: call.id, ...call.data() });
          return;
        }

        if (!activeCall || activeCall.id !== call.id) {
          activeCall = { id: call.id, ...call.data() };
          saveCallState();
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
                ["ended", "cancelled", "rejected", "declined", "missed", "failed", "busy"].includes(
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
            !["joined", "rejected", "left", "busy"].includes(
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
        ) {
          showCallWaitingModal({ id: call.id, ...call.data(), groupCall: true });
          return;
        }
        if (!activeCall || activeCall.id !== call.id) {
          activeCall = { id: call.id, ...call.data(), groupCall: true };
          saveCallState();
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
    endGroupCall(activeCallMode === "incoming" ? "declined" : "ended");
    return;
  }
  if (activeCallMode === "incoming") {
    endActiveCall("declined");
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

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate();
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getDirectChatId(userId1, userId2) {
  return [userId1, userId2].sort().join("_");
}

function normalizeEmail(email = "") {
  return String(email || "")
    .trim()
    .toLowerCase();
}

async function openDirectChatFromNotification(chatUserId) {
  if (!chatUserId) return;
  if (!currentUser) {
    localStorage.setItem("pendingNotificationChatUserId", chatUserId);
    return;
  }

  localStorage.removeItem("pendingNotificationChatUserId");
  await refreshAllUsersOnce();
  const userDoc = await db.collection("users").doc(chatUserId).get();
  const user = userDoc.exists
    ? { id: chatUserId, ...userDoc.data() }
    : allUsers.find((item) => item.id === chatUserId);
  if (!user) {
    showToast("The accepted chat is not available yet. Please try again.", "error");
    return;
  }
  await startDirectChat(user);
}

async function setCallSpeakerEnabled(enabled) {
  const next = Boolean(enabled);
  try {
    const nativePlugin = window.Capacitor?.Plugins?.AppPermissions;
    if (isNativeAndroidApp && nativePlugin?.setSpeakerphone) {
      await nativePlugin.setSpeakerphone({ enabled: next });
      speakerOn = next;
    } else {
      const outputs = await navigator.mediaDevices?.enumerateDevices?.();
      const audioOutputs = (outputs || []).filter((device) => device.kind === "audiooutput");
      const speaker =
        audioOutputs.find((device) => /speaker/i.test(device.label || "")) ||
        audioOutputs.find((device) => device.deviceId === "default");
      const earpiece =
        audioOutputs.find((device) => /earpiece|communications/i.test(device.label || "")) ||
        audioOutputs.find((device) => device.deviceId === "default");
      const target = next ? speaker : earpiece;
      const sinkTargets = [
        document.getElementById("remoteAudio"),
        document.getElementById("remoteVideo"),
      ].filter((element) => typeof element?.setSinkId === "function");
      if (!target || !sinkTargets.length) {
        showCallControlHint("Audio routing is controlled by this device");
        return;
      }
      await Promise.all(sinkTargets.map((element) => element.setSinkId(target.deviceId)));
      speakerOn = next;
    }
    updateCallControlState();
    flashCallControlLabel(
      document.getElementById("speakerCallBtn"),
      speakerOn ? "SPEAKER" : "DEFAULT",
    );
  } catch (error) {
    console.warn("Could not change call audio route:", error);
    showCallControlHint("Audio routing is controlled by this device");
  }
}

async function openGroupChatFromNotification(groupId) {
  if (!groupId) return;
  if (!currentUser) {
    localStorage.setItem("pendingNotificationGroupId", groupId);
    return;
  }
  localStorage.removeItem("pendingNotificationGroupId");
  const groupDoc = await db.collection("groups").doc(groupId).get().catch(() => null);
  if (!groupDoc?.exists) {
    showToast("This group is not available", "error");
    return;
  }
  await loadGroupChat(groupId, groupDoc.data()?.name || "Group");
}

async function handlePendingDirectChatOpen() {
  const params = new URLSearchParams(window.location.search);
  const chatUserId = params.get("chatUserId");
  const groupId = params.get("groupId");
  if ((!chatUserId && !groupId) || !currentUser) return;

  params.delete("chatUserId");
  params.delete("groupId");
  const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
  history.replaceState(history.state, "", clean);
  if (groupId) await openGroupChatFromNotification(groupId);
  else await openDirectChatFromNotification(chatUserId);
}

function handlePendingNavigationTab() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  if (
    ![
      "all",
      "unread",
      "groups",
      "calls",
      "status",
      "favorites",
      "muted",
      "broadcasts",
      "communities",
      "notifications",
    ].includes(tab)
  )
    return;
  params.delete("tab");
  const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
  history.replaceState(history.state, "", clean);
  switchTab(tab);
}

function isValidEmailAddress(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || "").trim());
}

async function lookupVerifiedUserByEmail(email = "", timeoutMs = 20000) {
  if (!currentUser || !isValidEmailAddress(email)) return null;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const token = await currentUser.getIdToken();
    const response = await fetch(
      `${VERIFIED_USER_LOOKUP_ENDPOINT}?email=${encodeURIComponent(normalizeEmail(email))}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("Verified email lookup failed:", error);
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function ensureGroupAccessMetadata() {
  if (!currentUser) return;
  const token = await currentUser.getIdToken();
  const response = await fetch(GROUP_ACCESS_REPAIR_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Group access repair returned ${response.status}`);
  }
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

  // Only a complete valid email address can reveal a directory profile.
  const looksLikeEmailSearch = isValidEmailAddress(term);
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
  if (isValidEmailAddress(term) && email) {
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
  if (/^[✓✔✅]+$/.test(text)) return "";

  if (/^missed\s+(voice|video)\s+call/i.test(text)) return text;
  if (/^(voice|video)\s+call\s+(ended|cancelled|declined|rejected)/i.test(text))
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
  if (user.email && user.emailVerified !== true) return false;
  if (user.pendingVerification === true) return false;
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
      if (data.openedBy?.[currentUser.uid] || data.readBy?.[currentUser.uid]) return false;

      return true;
    }).length;
  } catch (error) {
    console.warn("Could not calculate unread count:", error);
    return 0;
  }
}
async function markAllChatsAsRead() {
  if (!currentUser) return;
  const bar = document.getElementById("markAllReadBar");
  const btn = document.getElementById("markAllReadBtn");
  if (btn) btn.disabled = true;
  try {
    const [directItems, groupItems] = await Promise.all([
      buildDirectChatItems(),
      buildGroupChatItems(),
    ]);
    const allItems = [...directItems, ...groupItems];
    const unreadItems = allItems.filter((item) => Number(item.unreadCount || 0) > 0);

    if (unreadItems.length === 0) {
      showToast("No unread messages");
      if (bar) bar.style.display = "none";
      return;
    }

    await Promise.all(
      unreadItems.map((item) => {
        const chatId =
          item.type === "direct"
            ? (item.aliasDirectIds || item.id)
            : item.id;
        return markChatReadState(chatId, item.type, true);
      }),
    );

    showToast(`Marked ${unreadItems.length} chat${unreadItems.length > 1 ? "s" : ""} as read`);
    loadCurrentChatList();
  } catch (error) {
    console.error("markAllChatsAsRead failed:", error);
    showToast("Could not mark all as read", "error");
  } finally {
    if (btn) btn.disabled = false;
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
        updates[`openedBy.${currentUser.uid}`] =
          firebase.firestore.FieldValue.serverTimestamp();
        if (!privacySettings.hideReadReceipts) {
          updates[`readBy.${currentUser.uid}`] =
            firebase.firestore.FieldValue.serverTimestamp();
          updates.status = "read";
        }
      } else {
        updates[`openedBy.${currentUser.uid}`] =
          firebase.firestore.FieldValue.delete();
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

function getMediaDuration(file) {
  return new Promise((resolve, reject) => {
    const media = document.createElement(
      file?.type?.startsWith("audio/") ? "audio" : "video",
    );
    const url = URL.createObjectURL(file);
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      const duration = Number(media.duration || 0);
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    media.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read media duration"));
    };
    media.src = url;
  });
}

function closeRecordedMediaPreview() {
  if (pendingRecordedMedia?.previewUrl) {
    URL.revokeObjectURL(pendingRecordedMedia.previewUrl);
  }
  pendingRecordedMedia = null;
  const modal = document.getElementById("recordedMediaPreviewModal");
  if (modal) modal.style.display = "none";
  const body = document.getElementById("recordedMediaPreviewBody");
  if (body) body.innerHTML = "";
  const caption = document.getElementById("recordedMediaCaption");
  if (caption) caption.value = "";
  const status = document.getElementById("recordedMediaUploadStatus");
  if (status) status.textContent = "";
}

function showRecordedMediaPreview(blob, type, duration) {
  closeRecordedMediaPreview();
  const previewUrl = URL.createObjectURL(blob);
  pendingRecordedMedia = { blob, type, duration, previewUrl };
  document.getElementById("recordedMediaPreviewTitle").textContent =
    type === "voice" ? "Preview audio message" : "Preview video message";
  document.getElementById("recordedMediaPreviewBody").innerHTML =
    type === "voice"
      ? `<audio src="${previewUrl}" controls preload="metadata"></audio>`
      : `<video src="${previewUrl}" controls playsinline preload="metadata"></video>`;
  const caption = document.getElementById("recordedMediaCaption");
  if (caption) caption.style.display = type === "video" ? "block" : "none";
  document.getElementById("recordedMediaPreviewModal").style.display = "flex";
}

async function uploadRecordedMedia(blob) {
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("resource_type", "video");
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
    { method: "POST", body: formData },
  );
  const data = await response.json();
  if (!data.secure_url) throw new Error("Recorded media upload failed");
  return data.secure_url;
}

async function sendPendingRecordedMedia() {
  if (!pendingRecordedMedia || !currentChat) return;
  const sendBtn = document.getElementById("sendRecordedMediaBtn");
  const cancelBtn = document.getElementById("cancelRecordedMediaBtn");
  const status = document.getElementById("recordedMediaUploadStatus");
  sendBtn.disabled = true;
  cancelBtn.disabled = true;
  if (status) status.textContent = "Uploading recording...";
  try {
    const media = pendingRecordedMedia;
    const url = await uploadRecordedMedia(media.blob);
    currentAttachment = {
      type: media.type,
      url,
      duration: media.duration,
      filename: media.type === "voice" ? "Voice message" : "Video message",
      size: media.blob.size,
    };
    const caption = document.getElementById("recordedMediaCaption")?.value.trim() || "";
    if (caption) document.getElementById("messageInput").value = caption;
    closeRecordedMediaPreview();
    await sendMessage();
  } catch (error) {
    console.warn("Could not send recorded media:", error);
    if (status) status.textContent = "Upload failed. Tap Send to retry.";
    showToast("Recorded message upload failed", "error");
  } finally {
    sendBtn.disabled = false;
    cancelBtn.disabled = false;
  }
}

// ========================================================================
// FIXED: STRICT PREFIX & EXACT MULTI-CRITERIA SEARCH ENGINE
// ========================================================================
async function searchUsersRealtime(searchTerm) {
  const chatsList = document.getElementById("chatsList");
  if (!chatsList) return;

  if (!searchTerm || searchTerm.trim() === "") {
    ++chatSearchToken;
    if (currentViewTab === "groups") loadGroupsList();
    else if (currentViewTab === "calls") loadCallsList();
    else if (currentViewTab === "status") loadStatusList();
    else if (currentViewTab === "broadcasts") loadBroadcastsList();
    else if (currentViewTab === "communities") loadCommunitiesList();
    else if (currentViewTab === "notifications")
      renderInAppNotifications(currentInAppNotifications);
    else loadCurrentChatList();
    return;
  }

  const term = searchTerm.trim().toLowerCase();

  if (currentViewTab === "groups") {
    searchGroupsRealtime(term);
    return;
  }
  if (currentViewTab === "calls") {
    loadCallsList(term);
    return;
  }
  if (currentViewTab === "status") {
    loadStatusList(term);
    return;
  }
  if (currentViewTab === "broadcasts") {
    loadBroadcastsList(term);
    return;
  }
  if (currentViewTab === "communities") {
    loadCommunitiesList(term);
    return;
  }
  if (currentViewTab === "notifications") {
    renderInAppNotifications(currentInAppNotifications, term);
    return;
  }

  // Search requests have their own token so background real-time list
  // refreshes cannot leave the visible search stuck in a loading state.
  const searchToken = ++chatSearchToken;

  // Show a loading indicator in the list while we fetch
  chatsList.innerHTML = `<div class="empty-state" style="padding:32px;color:#667781;">Searching...</div>`;

  try {
    const looksLikeEmail = isValidEmailAddress(term);
    const verifiedLookupPromise = looksLikeEmail
      ? lookupVerifiedUserByEmail(term)
      : Promise.resolve(null);
    await refreshSearchDirectoryWithinTimeout().catch((error) => {
      console.warn("Directory refresh skipped during search:", error);
    });

    if (searchToken !== chatSearchToken) return;

    try {
      await loadAllChatsList(term, searchToken);
    } catch (error) {
      console.warn("Existing chat/message search partially failed:", error);
      if (searchToken === chatSearchToken) {
        renderChatListItems(
          [],
          chatsList,
          "No matching chats or messages found. Verified-user discovery is still running.",
        );
      }
    }

    // Existing chats/messages appear first. Exact-email discovery is added
    // when the verified account lookup finishes, without blocking search.
    const verifiedUser = await verifiedLookupPromise;
    if (searchToken !== chatSearchToken || !verifiedUser) return;
    if (!allUsers.some((user) => user.id === verifiedUser.id)) {
      allUsers = [...allUsers, verifiedUser];
    }
    try {
      await loadAllChatsList(term, searchToken);
    } catch (error) {
      console.warn("Verified-user result could not be rendered:", error);
    }
  } catch (error) {
    console.warn("Search failed:", error);
    if (searchToken === chatSearchToken) {
      renderChatListItems(
        [],
        chatsList,
        "Search could not be completed. Check your connection and try again.",
      );
    }
  }
}

async function refreshSearchDirectoryWithinTimeout(timeoutMs = 8000) {
  let timeoutId;
  try {
    await Promise.race([
      refreshAllUsersOnce(),
      new Promise((resolve) => {
        timeoutId = window.setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// ========================================================================
// FIXED: COMBINED REAL-TIME HISTORY & DIRECTORY LOOKUP ENGINE
// ========================================================================
// ========================================================================
// FIXED: COMBINED REAL-TIME HISTORY & DIRECTORY LOOKUP ENGINE
// ========================================================================
let chatListLoadToken = 0;
let chatSearchToken = 0;
async function loadAllChatsList(searchTerm = "", searchToken = null) {
  const chatsList = document.getElementById("chatsList");
  if (!chatsList) return;
  const loadToken = ++chatListLoadToken;

  // Show skeleton loading while fetching
  if (!searchTerm && !chatsList.children.length) {
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
  // Background list updates may supersede one another, but they must not
  // cancel an active search. Only a newer search may cancel a search render.
  if (searchToken !== null) {
    if (searchToken !== chatSearchToken) return;
  } else if (loadToken !== chatListLoadToken) {
    return;
  }
  try { await refreshLockedChats(); } catch (e) { lockedChats = new Map(); console.warn("refreshLockedChats failed:", e); }
  const lockedChatCount = lockedChats.size;
  const allItems = [...directItems, ...groupItems];

  // Filter locked chats out of the visible list — they live in the folder only
  let items = allItems.filter(
    (item) => item.type === "saved" || !isChatLocked(item.id, item.type)
  );
  updateUnreadBadges(allItems);

  if (currentViewTab === "favorites")
    items = items.filter((item) => item.isFavorite);
  if (currentViewTab === "unread")
    items = items.filter((item) => item.unreadCount > 0);
  if (currentViewTab === "muted") items = items.filter((item) => item.isMuted);
  if (activeFolderChatIds)
    items = items.filter((item) => activeFolderChatIds.has(item.id));

  const term = searchTerm.trim().toLowerCase();

  // If PIN was verified via search bar, show locked-chat folder + normal list
  let pinVerified = false;
  try { pinVerified = /^\d{4}$/.test(term) && (await verifyChatLockPin(term)); } catch (e) { console.warn("PIN verification failed:", e); }
  if (pinVerified) {
    lockPinVerifiedForSearch = true;
    lockedChatFolderVisible = true;
    const folderEntry = {
      id: "__lockedChatFolder",
      type: "folder",
      name: `🔒 Locked Chats`,
      isLockedFolder: true,
      lockedCount: lockedChatCount,
      section: "",
    };
    const archivedItems = (await getArchivedChatListItems())
      .filter((item) => !isChatLocked(item.id, item.type))
      .map((item) => ({ ...item, section: "Archived Chats" }));
    const normalItems = items.map((item) => ({ ...item, section: "Chats" }));
    renderChatListItems([folderEntry, ...archivedItems, ...normalItems], chatsList);
    return;
  }
  lockPinVerifiedForSearch = false;

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

    // NOTE: We intentionally skip refreshAllUsersOnce() here.
    // For email searches, searchUsersRealtime() already did a fresh Firestore
    // fetch before calling us. Calling it again would overwrite allUsers with
    // a potentially stale cached result.

    // MATCH 2: Look through the directory for users you haven't messaged yet
    const looksLikeEmailSearch = isValidEmailAddress(term);
    const userPool = allUsers.filter(isSearchableUser);
    for (const user of userPool) {
      if (isUserInLockedDirectChat(user.id)) continue;
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
      ...decorateSearchItems(contactMatches, "User Discovery", "contact"),
      ...decorateSearchItems(messageMatches, "Messages", "message"),
    ];
  } else {
    // Whitelist core operational fallback: when no search text is active, default back to showing WhatsApp style history list
    items = allItems.filter(
      (item) => item.type === "saved" || !isChatLocked(item.id, item.type)
    );
    if (currentViewTab === "favorites")
      items = items.filter((item) => item.isFavorite);
    if (currentViewTab === "unread")
      items = items.filter((item) => item.unreadCount > 0);
    if (currentViewTab === "muted")
      items = items.filter((item) => item.isMuted);
    if (activeFolderChatIds)
      items = items.filter((item) => activeFolderChatIds.has(item.id));
  }

  // Also show folder if previously verified (e.g. after navigating back)
  if (lockedChatFolderVisible && lockedChatCount > 0) {
    const folderEntry = {
      id: "__lockedChatFolder",
      type: "folder",
      name: `🔒 Locked Chats`,
      isLockedFolder: true,
      lockedCount: lockedChatCount,
      section: "",
    };
    items = [folderEntry, ...items];
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
      const order = { Chats: 1, "User Discovery": 2, Messages: 3 };
      const sectionDiff = (order[a.section] || 99) - (order[b.section] || 99);
      if (sectionDiff) return sectionDiff;
    }
    if (a.type === "saved") return -1;
    if (b.type === "saved") return 1;
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (
      b.lastMessageTime - a.lastMessageTime || a.name.localeCompare(b.name)
    );
  });
  if (searchToken !== null && searchToken !== chatSearchToken) return;

  // Add "You're all caught up" divider when all chats are read on All tab
  if (
    !term &&
    currentViewTab === "all" &&
    !activeFolderChatIds &&
    items.length > 0 &&
    items.every((i) => !Number(i.unreadCount || 0))
  ) {
    items.unshift({ id: "_caught_up", type: "divider", name: "You\u2019re all caught up", divider: true, lastMessageTime: new Date(0) });
  }

  renderChatListItems(
    items,
    chatsList,
    term
      ? "No matching chats, messages, or verified users found."
      : currentViewTab === "unread"
        ? "No unread chats or messages."
        : currentViewTab === "favorites"
          ? "No favorite chats yet."
          : currentViewTab === "muted"
            ? "No muted chats."
            : "",
  );
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
  if (!user.id || user.id === currentUser.uid) {
    showToast("You cannot send a chat request to yourself", "error");
    return;
  }
  if (isBlocked(user.id) || (await isBlockedByUser(user.id))) {
    showToast("Request cannot be sent to this user", "error");
    return;
  }
  const directChatId = getDirectChatId(currentUser.uid, user.id);
  const requestRef = db.collection("chatRequests").doc(directChatId);

  // Check for existing directChats (including deleted ones)
  let directChatDoc = null;
  let directChatDeleted = false;
  try {
    directChatDoc = await db.collection("directChats").doc(directChatId).get();
    if (directChatDoc.exists) {
      const dcStatus = directChatDoc.data()?.status;
      if (dcStatus === "active") {
        showToast("A chat with this user already exists");
        return;
      }
      if (dcStatus === "deleted") directChatDeleted = true;
    }
  } catch (_) {}

  // Check for existing chat request
  let existingRequest = null;
  try {
    existingRequest = await requestRef.get();
  } catch (_) {}
  if (existingRequest?.exists) {
    const request = existingRequest.data() || {};
    if (request.status === "pending") {
      if (request.fromUserId === currentUser.uid) {
        showToast("Request already sent to this user");
        return;
      }
      showToast(
        `${user.displayName || user.email} already sent you a request. Accept it from Requests.`,
      );
      return;
    }
    if (request.status === "accepted") {
      if (directChatDeleted) {
        try {
          await db.collection("directChats").doc(directChatId).update({
            status: "active",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          showToast("Chat restored");
        } catch (_) {
          showToast("Could not restore chat", "error");
        }
      } else {
        showToast("A chat with this user already exists");
      }
      return;
    }
  }

  try {
    // Restore deleted directChat if needed
    if (directChatDeleted) {
      await db.collection("directChats").doc(directChatId).update({
        status: "active",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Write the chat request (create if new, update if re-sending after decline/cancel)
    await requestRef.set({
      fromUserId: currentUser.uid,
      fromUserName: currentUser.displayName || currentUser.email.split("@")[0],
      fromUserEmail: normalizeEmail(currentUser.email),
      toUserId: user.id,
      toUserName: user.displayName || user.email,
      toUserEmail: normalizeEmail(user.email),
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    const msg = error?.message || "";
    if (msg.includes("permission-denied") || msg.includes("Missing or insufficient")) {
      showToast("Could not send request. Please make sure the user is verified and try again.", "error");
    } else {
      showToast(error?.message || "Could not send chat request", "error");
    }
    return;
  }
  showToast("Request sent");
  await loadReceivedRequests();
  loadCurrentChatList();
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
    const batch = db.batch();
    batch.set(
      db.collection("directChats").doc(chatId),
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
    batch.update(db.collection("chatRequests").doc(requestId), {
      status: "accepted",
      respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

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
    const [chatSnapshot, sentChatSnapshot, groupSnapshot] = await Promise.all([
      db
        .collection("chatRequests")
        .where("toUserId", "==", currentUser.uid)
        .where("status", "==", "pending")
        .get(),
      db
        .collection("chatRequests")
        .where("fromUserId", "==", currentUser.uid)
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
        direction: "incoming",
        ...doc.data(),
      })),
      ...sentChatSnapshot.docs.map((doc) => ({
        id: doc.id,
        requestType: "chat",
        direction: "outgoing",
        ...doc.data(),
      })),
      ...groupSnapshot.docs.map((doc) => ({
        id: doc.id,
        requestType: "group",
        direction: "incoming",
        ...doc.data(),
      })),
    ].sort(
      (a, b) =>
        (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0),
    );

    if (badge) {
      const incomingCount = chatSnapshot.size + groupSnapshot.size;
      if (incomingCount > 0) {
        badge.textContent =
          incomingCount > 99 ? "99+" : String(incomingCount);
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
      requestSection?.classList.remove("expanded");
      if (requestToggle) requestToggle.textContent = "▼";
      if (requestSection) requestSection.style.display = "none";
      return;
    }
    if (requestSection) requestSection.style.display = "";

    for (const req of requests) {
      const isGroupInvite = req.requestType === "group";
      const isOutgoing = req.direction === "outgoing";
      const displayName = isOutgoing
        ? req.toUserName || req.toUserEmail || "User"
        : isGroupInvite
          ? req.groupName || "Group invite"
          : req.fromUserName || "User";
      const reqDiv = document.createElement("div");
      reqDiv.className = "list-item request-card";
      reqDiv.innerHTML = `
        <div class="list-avatar">${escapeHtml(getInitials(displayName, isOutgoing ? req.toUserEmail || "" : req.fromUserEmail || ""))}</div>
        <div class="list-info">
          <div class="list-name">${escapeHtml(displayName)}</div>
          <div class="list-preview">${isOutgoing ? "Pending chat request" : isGroupInvite ? `Group invite from ${escapeHtml(req.fromUserName || "User")}` : `Wants to chat${req.fromUserEmail ? ` - ${escapeHtml(req.fromUserEmail)}` : ""}`}</div>
        </div>
        <div class="request-actions">
          ${isOutgoing
            ? `<button class="btn btn-outline cancel-request-btn" data-id="${req.id}">Cancel</button>`
            : `<button class="btn btn-success accept-request-btn" data-type="${req.requestType}" data-id="${req.id}" data-from="${escapeHtml(req.fromUserId || "")}">Accept</button>
          <button class="btn btn-outline decline-request-btn" data-type="${req.requestType}" data-id="${req.id}">Decline</button>
          <button class="btn btn-outline block-request-btn" data-type="${req.requestType}" data-id="${req.id}" data-from="${escapeHtml(req.fromUserId || "")}" data-name="${escapeHtml(req.fromUserName || "User")}">Block</button>`}
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
    requestList.querySelectorAll(".decline-request-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (btn.dataset.type === "group")
          await declineGroupInvite(btn.dataset.id);
        else await declineChatRequest(btn.dataset.id);
      });
    });
    requestList.querySelectorAll(".cancel-request-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        try { await cancelChatRequest(btn.dataset.id); } finally { btn.disabled = false; }
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
  if (sentChatRequestsUnsubscribe) sentChatRequestsUnsubscribe();
  if (groupInvitesUnsubscribe) groupInvitesUnsubscribe();
  seenPendingChatRequestIds = new Set();
  seenSentChatRequestIds = new Set();
  seenPendingGroupInviteIds = new Set();
  chatRequestListenerReady = false;
  sentChatRequestListenerReady = false;
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
  sentChatRequestsUnsubscribe = db
    .collection("chatRequests")
    .where("fromUserId", "==", currentUser.uid)
    .where("status", "==", "pending")
    .onSnapshot((snapshot) => {
      const currentIds = new Set(snapshot.docs.map((doc) => doc.id));
      if (
        sentChatRequestListenerReady &&
        (currentIds.size !== seenSentChatRequestIds.size ||
          [...currentIds].some((id) => !seenSentChatRequestIds.has(id)))
      ) {
        loadReceivedRequests();
      }
      seenSentChatRequestIds = currentIds;
      sentChatRequestListenerReady = true;
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

// =============================================
// FIX 4: IN-APP NOTIFICATIONS (acceptance alerts)
// =============================================
let inAppNotifUnsubscribe = null;
let currentInAppNotifications = [];

function setupInAppNotificationsListener() {
  if (!currentUser) return;
  if (inAppNotifUnsubscribe) inAppNotifUnsubscribe();

  inAppNotifUnsubscribe = db
    .collection("inAppNotifications")
    .where("toUserId", "==", currentUser.uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .onSnapshot((snapshot) => {
      currentInAppNotifications = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderInAppNotifications(
        currentInAppNotifications,
        currentViewTab === "notifications"
          ? document.getElementById("searchInput")?.value || ""
          : "",
      );
    }, (err) => {
      console.warn("In-app notifications listener error:", err);
      if (currentViewTab === "notifications") {
        const panel = document.getElementById("notificationsPanel");
        if (panel)
          panel.innerHTML =
            '<div class="empty-state tab-error-state">Could not load alerts<button type="button" class="btn btn-outline tab-retry-btn">Retry</button></div>';
        panel?.querySelector(".tab-retry-btn")?.addEventListener("click", setupInAppNotificationsListener);
      }
    });
}

function renderInAppNotifications(notifications, searchTerm = "") {
  const panel = document.getElementById("notificationsPanel");
  const badge = document.getElementById("notifAlertBadge");
  if (!panel) return;

  const unreadCount = notifications.filter((n) => !n.read).length;
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      badge.style.display = "inline-flex";
    } else {
      badge.textContent = "";
      badge.style.display = "none";
    }
  }

  const term = String(searchTerm || "").trim().toLowerCase();
  const visibleNotifications = term
    ? notifications.filter((notification) =>
        [
          notification.fromUserName,
          notification.message,
          notification.type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term),
      )
    : notifications;
  if (!visibleNotifications.length) {
    panel.innerHTML = `<div class="empty-state">${term ? "No matching alerts" : "No alerts yet"}</div>`;
    return;
  }

  panel.innerHTML = visibleNotifications.map((n) => {
    const ts = n.createdAt && n.createdAt.toDate ? n.createdAt.toDate() : null;
    const time = ts ? formatRelativeTime(ts) : "";
    return `
      <div class="list-item notif-item ${n.read ? "" : "notif-unread"}" data-notif-id="${n.id}" data-notif-type="${escapeHtml(n.type || "")}" data-chat-user-id="${escapeHtml(n.chatUserId || "")}" data-group-id="${escapeHtml(n.chatType === "group" ? n.chatId || "" : "")}" style="cursor:pointer;">
        <div class="list-avatar" style="background:var(--accent,#008069);color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;">&#10003;</div>
        <div class="list-info">
          <div class="list-name" style="font-weight:${n.read ? "400" : "600"};">${escapeHtml(n.fromUserName || "Someone")}</div>
          <div class="list-preview">${escapeHtml(n.message || "Accepted your chat request")}</div>
        </div>
        <div class="list-meta">
          <div class="list-time">${time}</div>
        </div>
      </div>`;
  }).join("");
  panel.querySelectorAll(".notif-item").forEach((item) => {
    item.addEventListener("click", async () => {
      await db.collection("inAppNotifications").doc(item.dataset.notifId).update({ read: true }).catch(() => {});
      if (item.dataset.notifType === "status_update") switchTab("status");
      else if (item.dataset.groupId) await openGroupChatFromNotification(item.dataset.groupId);
      else if (item.dataset.chatUserId) await openDirectChatFromNotification(item.dataset.chatUserId);
    });
  });
}

async function markAllNotificationsRead() {
  if (!currentUser) return;
  try {
    const snap = await db.collection("inAppNotifications")
      .where("toUserId", "==", currentUser.uid)
      .where("read", "==", false)
      .get();
    const batch = db.batch();
    snap.forEach((doc) => batch.update(doc.ref, { read: true }));
    await batch.commit();
  } catch (e) {
    console.warn("Could not mark notifications read:", e);
  }
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

async function declineChatRequest(requestId) {
  if (!requestId) return;
  await db.collection("chatRequests").doc(requestId).update({
    status: "declined",
    respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast("Request declined");
  loadReceivedRequests();
}

async function cancelChatRequest(requestId) {
  if (!requestId) return;
  await db.collection("chatRequests").doc(requestId).update({
    status: "cancelled",
    respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast("Request cancelled");
  await loadReceivedRequests();
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
  else await declineChatRequest(requestId);
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

async function loadReactions(messageId, container) {
  const snapshot = await db
    .collection("messageReactions")
    .where("messageId", "==", messageId)
    .get();
  const reactions = {};
  snapshot.forEach((doc) => {
    const d = doc.data();
    if (!reactions[d.reaction]) reactions[d.reaction] = { count: 0, names: [] };
    reactions[d.reaction].count++;
    const name = d.userName || "Someone";
    reactions[d.reaction].names.push(name);
  });

  if (Object.keys(reactions).length === 0) return;

  const reactionDiv = document.createElement("div");
  reactionDiv.className = "reactions-container";
  for (const [reaction, { count, names }] of Object.entries(reactions)) {
    const wrapper = document.createElement("span");
    wrapper.className = "reaction-badge-wrapper";

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

    const tooltip = document.createElement("span");
    tooltip.className = "reaction-tooltip";
    const header = `<span class="reaction-tooltip-emoji">${reaction}</span>`;
    const list = names.length <= 5
      ? names.map(n => `<span>${escapeHtml(n)}</span>`).join("")
      : names.slice(0, 4).map(n => `<span>${escapeHtml(n)}</span>`).join("") +
        `<span>+${names.length - 4} more</span>`;
    tooltip.innerHTML = header + list;

    wrapper.appendChild(badge);
    wrapper.appendChild(tooltip);
    reactionDiv.appendChild(wrapper);
  }
  container.appendChild(reactionDiv);
}

const _allReactions = ["👍","❤️","😂","😮","😢","🙏","🔥","🎉","💯","✅","👏","🤣","🥰","😍","🤔","🤩","😭","😤","🤗","🥳"];

function getReactionOptions() {
  return _allReactions.slice(0, 8);
}

function getRecentReactions() {
  try {
    const stored = localStorage.getItem("wa_recent_reactions_" + (currentUser?.uid || ""));
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function trackRecentReaction(emoji) {
  if (!emoji || !currentUser) return;
  try {
    const key = "wa_recent_reactions_" + currentUser.uid;
    let recent = getRecentReactions();
    recent = recent.filter(r => r !== emoji);
    recent.unshift(emoji);
    if (recent.length > 5) recent = recent.slice(0, 5);
    localStorage.setItem(key, JSON.stringify(recent));
  } catch { /* ignore */ }
}

async function addReaction(messageId, reaction) {
  trackRecentReaction(reaction);
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
      const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
      stream.getTracks().forEach((track) => track.stop());
      if (audioBlob.size) showRecordedMediaPreview(audioBlob, "voice", duration);
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
    mediaRecorder.stream?.getTracks().forEach((track) => track.stop());
    isRecording = false;
    clearInterval(recordingTimer);
    document
      .getElementById("voiceRecordingIndicator")
      ?.classList.remove("show");
  }
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

function playNotificationBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (_) {}
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
  cleanupAllFirestoreListeners();
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
  const modal = document.getElementById("wallpaperModal");
  modal.style.display = "flex";
  modal.classList.toggle("wallpaper-modal-current", wallpaperModalMode === "current");
  if (wallpaperModalMode === "current" && currentChat) {
    const chatColors = JSON.parse(localStorage.getItem("chatColors") || "{}");
    const curColor = chatColors[currentChat.id] || "";
    document.querySelectorAll(".chat-color-swatch").forEach((sw) => {
      sw.classList.toggle("selected", sw.dataset.color === curColor);
    });
  }
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

  messagesArea.style.display = "flex";
  messagesArea.style.flexDirection = "column";

  applyCurrentChatAccent();
}

function applyCurrentChatAccent() {
  const messagesArea = document.getElementById("messagesArea");
  if (!messagesArea || !currentChat) return;
  const chatColors = JSON.parse(localStorage.getItem("chatColors") || "{}");
  const color = chatColors[currentChat.id] || "";
  messagesArea.style.setProperty("--chat-accent", color || null);
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
  const [directDoc, requestDoc] = await Promise.all([
    db.collection("directChats").doc(directId).get().catch(() => null),
    db.collection("chatRequests").doc(directId).get().catch(() => null),
  ]);
  if (directDoc?.exists && directDoc.data()?.status !== "deleted") return true;
  return requestDoc?.exists && requestDoc.data()?.status === "accepted";
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
  try {
    const requestId = getDirectChatId(currentUser.uid, userId);
    const [requestDoc, directDoc] = await Promise.all([
      db.collection("chatRequests").doc(requestId).get().catch(() => null),
      db.collection("directChats").doc(requestId).get().catch(() => null),
    ]);
    if (directDoc?.exists && directDoc.data()?.status !== "deleted") {
      return { status: "accepted", label: "Connected" };
    }
    if (requestDoc?.exists) {
      const request = requestDoc.data() || {};
      if (request.status === "accepted") {
        return { status: "accepted", label: "Connected" };
      }
      if (request.status === "pending") {
        if (request.fromUserId === currentUser.uid) {
          return { status: "sent", label: "Request sent" };
        }
        if (request.toUserId === currentUser.uid) {
          return { status: "received", label: "Accept request" };
        }
      }
    }
  } catch (error) {
    console.warn("Could not read chat request state:", error);
  }
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

function getLockedChatKey(chatId, chatType) {
  return `${chatType}:${chatId}`;
}

function getLockedChatDocId(chatId, chatType) {
  return `${currentUser.uid}_${chatType}_${chatId}`.replaceAll("/", "_");
}

function isChatLocked(chatId, chatType) {
  return lockedChats.has(getLockedChatKey(chatId, chatType));
}

function isUserInLockedDirectChat(userId) {
  return [...lockedChats.values()].some(
    (record) => record.chatType === "direct" && record.otherUserId === userId,
  );
}

async function refreshLockedChats() {
  lockedChats = new Map();
  if (!currentUser) return lockedChats;
  const snapshot = await db
    .collection("lockedChats")
    .where("userId", "==", currentUser.uid)
    .get();
  snapshot.docs.forEach((doc) => {
    const data = { recordId: doc.id, ...doc.data() };
    if (data.chatId && data.chatType)
      lockedChats.set(getLockedChatKey(data.chatId, data.chatType), data);
  });
  return lockedChats;
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((value) => (binary += String.fromCharCode(value)));
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function deriveChatLockPin(pin, salt, iterations = 120000) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function saveChatLockPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 120000;
  const pinHash = await deriveChatLockPin(pin, salt, iterations);
  await db.collection("chatLockSettings").doc(currentUser.uid).set({
    userId: currentUser.uid,
    pinHash,
    pinSalt: bytesToBase64(salt),
    pinIterations: iterations,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function getChatLockSettings() {
  if (!currentUser) return null;
  const doc = await db.collection("chatLockSettings").doc(currentUser.uid).get();
  return doc.exists ? doc.data() : null;
}

async function verifyChatLockPin(pin) {
  if (!/^\d{4}$/.test(pin) || !crypto?.subtle) return false;
  let settings;
  try { settings = await getChatLockSettings(); } catch (e) { console.warn("getChatLockSettings failed:", e); return false; }
  if (!settings?.pinHash || !settings?.pinSalt) return false;
  const candidate = await deriveChatLockPin(
    pin,
    base64ToBytes(settings.pinSalt),
    settings.pinIterations || 120000,
  );
  return candidate === settings.pinHash;
}

function showModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = "flex"; requestAnimationFrame(() => el.classList.add("show")); }
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("show");
  setTimeout(() => { el.style.display = "none"; }, 160);
}

function hideChatLockModal() {
  hideModal("chatLockModal");
}

function hideChatLockSetupModal() {
  hideModal("chatLockSetupModal");
}

function showChatLockResetModal() {
  const modal = document.getElementById("chatLockResetModal");
  if (!modal) return;
  const error = document.getElementById("chatLockResetError");
  if (error) error.textContent = "";
  showModal("chatLockResetModal");
}

function hideChatLockResetModal() {
  hideModal("chatLockResetModal");
}

function openChatLockPinModal({ title, message, confirmLabel = "Continue", allowRecovery = true }) {
  return new Promise((resolve) => {
    const modal = document.getElementById("chatLockModal");
    const titleEl = document.getElementById("chatLockModalTitle");
    const msgEl = document.getElementById("chatLockModalMessage");
    const input = document.getElementById("chatLockPinInput");
    const error = document.getElementById("chatLockError");
    const confirmBtn = document.getElementById("chatLockConfirmBtn");
    const cancelBtn = document.getElementById("chatLockCancelBtn");
    const forgotBtn = document.getElementById("chatLockForgotBtn");
    if (!modal) return resolve(null);
    if (titleEl) titleEl.textContent = title || "Enter locked-chat PIN";
    if (msgEl) msgEl.textContent = message || "Enter your PIN.";
    if (input) input.value = "";
    if (error) error.textContent = "";
    if (forgotBtn) forgotBtn.style.display = allowRecovery ? "" : "none";
    if (confirmBtn) {
      confirmBtn.textContent = "";
      confirmBtn.appendChild(document.createTextNode(String(confirmLabel || "Continue")));
      confirmBtn.setAttribute("aria-label", String(confirmLabel || "Continue"));
    }
    const close = (result) => {
      hideModal("chatLockModal");
      resolve(result);
    };
    const cleanup = () => {
      cancelBtn?.removeEventListener("click", onCancel);
      modal.querySelector(".closeChatLockModal")?.removeEventListener("click", onCancel);
      confirmBtn?.removeEventListener("click", onConfirm);
      forgotBtn?.removeEventListener("click", onForgot);
      modal.removeEventListener("click", onBackdrop);
    };
    const onCancel = () => { cleanup(); close(null); };
    const onConfirm = () => {
      const value = (input?.value || "").trim();
      if (!/^\d{4}$/.test(value)) {
        if (error) error.textContent = "Enter exactly 4 digits.";
        return;
      }
      cleanup();
      close(value);
    };
    const onForgot = () => {
      cleanup();
      close(null);
      setTimeout(() => showChatLockResetModal(), 100);
    };
    const onBackdrop = (e) => { if (e.target === modal) { cleanup(); close(null); } };
    cancelBtn?.addEventListener("click", onCancel);
    modal.querySelector(".closeChatLockModal")?.addEventListener("click", onCancel);
    confirmBtn?.addEventListener("click", onConfirm);
    forgotBtn?.addEventListener("click", onForgot);
    modal.addEventListener("click", onBackdrop);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onConfirm();
      if (e.key === "Escape") onCancel();
    });
    showModal("chatLockModal");
    setTimeout(() => input?.focus(), 100);
  });
}

async function ensureChatLockPin() {
  const settings = await getChatLockSettings();
  if (!settings) {
    const pin = await new Promise((resolve) => {
      const modal = document.getElementById("chatLockSetupModal");
      const pinInput = document.getElementById("chatLockSetupPinInput");
      const confirmInput = document.getElementById("chatLockSetupConfirmInput");
      const error = document.getElementById("chatLockSetupError");
      const saveBtn = document.getElementById("chatLockSetupSaveBtn");
      if (!modal) return resolve(null);
      pinInput.value = "";
      confirmInput.value = "";
      error.textContent = "";
      const close = (result) => { hideModal("chatLockSetupModal"); resolve(result); };
      const onCancel = () => { close(null); };
      const onSave = () => {
        const pin = (pinInput?.value || "").trim();
        const conf = (confirmInput?.value || "").trim();
        if (!/^\d{4}$/.test(pin)) { error.textContent = "Enter exactly 4 digits."; return; }
        if (pin !== conf) { error.textContent = "The PINs do not match."; return; }
        close(pin);
      };
      document.querySelectorAll(".closeChatLockSetupModal").forEach((el) => el.addEventListener("click", onCancel));
      saveBtn?.addEventListener("click", onSave);
      pinInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") onSave(); });
      confirmInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") onSave(); });
      showModal("chatLockSetupModal");
      setTimeout(() => pinInput?.focus(), 100);
    });
    if (!pin) return null;
    await saveChatLockPin(pin);
    return pin;
  }
  const pin = await openChatLockPinModal({
    title: "Confirm locked-chat PIN",
    message: "Enter your PIN to lock this chat.",
  });
  if (!pin || !(await verifyChatLockPin(pin))) {
    if (pin) showToast("Incorrect locked-chat PIN", "error");
    return null;
  }
  return pin;
}

async function lockChat(chatId, chatType, chatName = "Chat", otherUserId = "") {
  if (!currentUser || !["direct", "group"].includes(chatType)) return;
  try {
    if (!(await ensureChatLockPin())) return;
    const safeChatId = String(chatId || "").trim();
    const safeChatType = String(chatType || "").trim();
    const safeChatName = String(chatName || "Chat").trim() || "Chat";
    const safeOtherUserId = String(otherUserId || "").trim();
    if (!safeChatId || !["direct", "group"].includes(safeChatType)) {
      showToast("Could not lock this chat: invalid chat details.", "error");
      return;
    }
    await db.collection("lockedChats").doc(getLockedChatDocId(safeChatId, safeChatType)).set({
      userId: currentUser.uid,
      chatId: safeChatId,
      chatType: safeChatType,
      chatName: safeChatName,
      otherUserId: safeOtherUserId,
      lockedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await refreshLockedChats();
    if (currentChat?.id === safeChatId && currentChatType === safeChatType) resetChatPanel();
    showToast(`${safeChatName} locked`);
    loadCurrentChatList();
    loadArchivedChats();
  } catch (error) {
    console.error("Lock chat failed:", error);
    const detail = error?.code ? ` (${error.code})` : "";
    showToast(`Could not lock this chat${detail}. Please try again.`, "error");
  }
}

async function showUnlockChatPrompt(chatId, chatType) {
  const record = lockedChats.get(getLockedChatKey(chatId, chatType));
  if (!record) return false;
  const pin = await openChatLockPinModal({
    title: "Unlock chat",
    message: `Enter your locked-chat PIN to open ${record.chatName || "this chat"}.`,
    confirmLabel: "Unlock",
  });
  if (!pin) return false;
  if (!(await verifyChatLockPin(pin))) {
    showToast("Incorrect locked-chat PIN", "error");
    return false;
  }
  return true;
}

async function unlockChat(chatId, chatType) {
  return permanentlyUnlockChat(chatId, chatType);
}

function lockedRecordToListItem(record) {
  if (!record?.chatId || !record?.chatType) return null;
  const prepId = record.chatType === "direct" ? record.chatId.split("_").find((id) => id !== currentUser?.uid) : "";
  return {
    id: record.chatId,
    type: record.chatType,
    name: record.chatName || "Locked chat",
    avatar: escapeHtml(getInitials(record.chatName || "Locked chat")),
    preview: "Locked",
    unreadCount: 0,
    isMuted: false,
    isPinned: false,
    isFavorite: false,
    isLocked: true,
    otherUserId: record.otherUserId || prepId || "",
    lastMessageTime: record.lockedAt?.toDate?.() || new Date(0),
  };
}

async function getLockedChatListItems() {
  const items = [];
  for (const record of lockedChats.values()) {
    if (!record?.chatId || !record?.chatType) continue;
    const item = lockedRecordToListItem(record);
    if (!item) continue;
    try {
      const unread = await getChatUnreadCount(record.chatId, record.chatType);
      item.unreadCount = unread;
    } catch (_) {}
    items.push(item);
  }
  return items;
}

async function handleChatLockReset() {
  if (!confirm("Locked chats will be cleared and all chats will be permanently unlocked. Continue?")) return;
  const error = document.getElementById("chatLockResetError");
  try {
    // Delete all locked chat records
    const batch = db.batch();
    lockedChats.forEach((record) => {
      const ref = db.collection("lockedChats").doc(record.recordId || getLockedChatDocId(record.chatId, record.chatType));
      batch.delete(ref);
    });
    await batch.commit();
    // Delete PIN settings
    await db.collection("chatLockSettings").doc(currentUser.uid).delete().catch(() => {});
    await refreshLockedChats();
    hideModal("chatLockResetModal");
    lockedChatFolderVisible = false;
    lockPinVerifiedForSearch = false;
    showToast("All locked chats cleared and unlocked");
    if (typeof loadCurrentChatList === "function") loadCurrentChatList();
  } catch (resetError) {
    console.error("Chat lock reset failed:", resetError);
    if (error) error.textContent = "Failed to reset. Check connection and try again.";
  }
}

// Show locked-chats-only list view (called when user taps the "🔒 Locked Chats" folder)
async function showLockedChatsView() {
  const container = document.getElementById("chatsList");
  if (!container) return;
  container.innerHTML = "";
  // Back button
  const back = document.createElement("div");
  back.className = "list-item";
  back.style.cssText = "font-weight:600;cursor:pointer";
  back.innerHTML = '<span style="margin-right:8px">&#x2190;</span> Back';
  back.addEventListener("click", () => { loadCurrentChatList(); });
  container.appendChild(back);

  const items = await getLockedChatListItems();
  if (!items.length) {
    container.innerHTML += '<div class="empty-state" style="padding:40px;text-align:center;color:var(--text-muted)">No locked chats</div>';
    return;
  }

  // "Unlock All" option at top of locked list
  const unlockAll = document.createElement("div");
  unlockAll.className = "list-item";
  unlockAll.style.cssText = "cursor:pointer;opacity:0.8";
  unlockAll.innerHTML = '<span style="margin-right:8px">&#x1F513;</span> Unlock All';
  unlockAll.addEventListener("click", async () => {
    if (!confirm("All locked chats will be permanently unlocked. Continue?")) return;
    try {
      const batch = db.batch();
      lockedChats.forEach((record) => {
        const ref = db.collection("lockedChats").doc(record.recordId || getLockedChatDocId(record.chatId, record.chatType));
        batch.delete(ref);
      });
      await batch.commit();
      await refreshLockedChats();
      lockedChatFolderVisible = false;
      showToast("All chats unlocked");
      loadCurrentChatList();
    } catch (e) {
      showToast("Could not unlock all chats", "error");
    }
  });
  container.appendChild(unlockAll);

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.dataset.chatId = item.id;
    div.dataset.chatType = item.type;
    div.innerHTML = `
      <div class="list-avatar"><span class="lock-badge-overlay">&#x1F512;</span>${item.avatar}</div>
      <div class="list-info" style="flex:1">
        <div class="list-name">&#x1F512; ${escapeHtml(item.name)}</div>
        <div class="list-preview">${item.unreadCount ? `${item.unreadCount} new` : "Locked"}</div>
      </div>
      <button class="list-item-menu unlock-chat-btn" title="Permanently unlock this chat">Unlock</button>
    `;
    // Tap chat → temporarily unlock + open
    div.addEventListener("click", async (e) => {
      if (e.target.closest("button")) return;
      if (!(await showUnlockChatPrompt(item.id, item.type))) return;
      temporarilyUnlockedChatId = item.id;
      if (item.type === "group") await loadGroupChat(item.id, item.name, item);
      else {
        const record = lockedChats.get(getLockedChatKey(item.id, item.type));
        const otherId = record?.otherUserId || "";
        if (otherId) await startDirectChat({ id: otherId, displayName: item.name });
      }
    });
    // "Unlock" button → permanently unlock (deletes lock record)
    div.querySelector(".unlock-chat-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      await permanentlyUnlockChat(item.id, item.type);
      showLockedChatsView(); // refresh the locked-chats list
    });
    container.appendChild(div);
  });
}

// Permanent unlock — deletes the lock record from Firestore
async function permanentlyUnlockChat(chatId, chatType) {
  const record = lockedChats.get(getLockedChatKey(chatId, chatType));
  if (!record) return;
  if (!(await showUnlockChatPrompt(chatId, chatType))) return;
  try {
    await db.collection("lockedChats").doc(record.recordId || getLockedChatDocId(chatId, chatType)).delete();
    await refreshLockedChats();
    showToast(`${record.chatName || "Chat"} permanently unlocked`);
    if (typeof loadCurrentChatList === "function") loadCurrentChatList();
  } catch (error) {
    console.error("Permanent unlock failed:", error);
    showToast("Could not unlock this chat. Check connection and try again.", "error");
  }
}

// Re-lock the temporarily unlocked chat when user navigates away
async function relockTemporarilyUnlockedChat() {
  if (!temporarilyUnlockedChatId) return;
  temporarilyUnlockedChatId = null;
  if (typeof loadCurrentChatList === "function") loadCurrentChatList();
}

async function getArchivedChatListItems() {
  if (!currentUser) return [];
  const snapshot = await db.collection("archivedChats").where("userId", "==", currentUser.uid).get();
  return snapshot.docs.map((doc) => {
    const record = doc.data() || {};
    return {
      id: record.chatId,
      type: record.chatType,
      name: record.chatName || "Archived chat",
      avatar: escapeHtml(getInitials(record.chatName || "Archived chat")),
      preview: "Archived",
      unreadCount: 0,
      isMuted: false,
      isPinned: false,
      isFavorite: false,
      lastMessageTime: record.archivedAt?.toDate?.() || new Date(0),
    };
  }).filter((item) => item.id && item.type);
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
  const archiveSection = document.querySelector(".archive-section");
  const archiveBadge = document.getElementById("archiveBadge");
  // Preserve expanded state across refreshes
  const wasExpanded = archiveList.classList.contains("show");
  const snapshot = await db
    .collection("archivedChats")
    .where("userId", "==", currentUser.uid)
    .get();
  if (snapshot.empty) {
    archiveList.innerHTML =
      '<div class="empty-state" style="padding:20px;">No archived chats</div>';
    if (archiveSection) archiveSection.style.display = "none";
    archiveList.classList.remove("show");
    if (archiveBadge) { archiveBadge.textContent = ""; archiveBadge.style.display = "none"; }
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
  await refreshLockedChats();
  const archivedChats = [...deduped.values()].filter(
    (item) => !isChatLocked(item.chatId, item.chatType),
  ).sort(
    (a, b) =>
      (b.archivedAt?.toMillis?.() || 0) - (a.archivedAt?.toMillis?.() || 0),
  );
  if (!archivedChats.length) {
    archiveList.innerHTML =
      '<div class="empty-state" style="padding:20px;">No archived chats</div>';
    if (archiveSection) archiveSection.style.display = "none";
    archiveList.classList.remove("show");
    if (archiveBadge) { archiveBadge.textContent = ""; archiveBadge.style.display = "none"; }
    return;
  }
  if (archiveSection) archiveSection.style.display = "";
  // Restore expanded state
  if (wasExpanded) archiveList.classList.add("show");
  // Update badge count
  if (archiveBadge) {
    archiveBadge.textContent = archivedChats.length > 99 ? "99+" : String(archivedChats.length);
    archiveBadge.style.display = "inline-flex";
  }
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
  else if (currentViewTab === "calls") loadCallsList();
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
  const lockItem = document.getElementById("lockChatMenuItem");
  if (lockItem) {
    lockItem.hidden = !["direct", "group"].includes(chatType);
    lockItem.textContent = isChatLocked(chatId, chatType) ? "Unlock Chat" : "Lock Chat";
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
  if (blockItem) blockItem.hidden = !isDirect;
  if (reportItem) reportItem.textContent = isGroup ? "Report group" : "Report contact";
  if (exitItem) exitItem.hidden = !isGroup;
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
  return `last seen ${date.toLocaleDateString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} at ${time}`;
}

function setChatStatus(text = "") {
  const chatStatus = document.getElementById("chatStatus");
  if (!chatStatus) return;
  chatStatus.textContent = text;
  chatStatus.title = text;
  chatStatus.setAttribute("aria-label", text || "No status available");
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
  const viewerHide = privacySettings.lastSeen === "nobody" || privacySettings.hideLastSeen;
  if (viewerHide) return "last seen hidden";
  const targetHide = userData.privacySettings?.lastSeen || (userData.privacySettings?.hideLastSeen ? "nobody" : "everyone");
  if (targetHide === "nobody") return "last seen hidden";
  if (targetHide === "mycontacts" && currentUser && userData.uid && currentUser.uid !== userData.uid) {
    const chats = Array.from(document.querySelectorAll(".list-item")) || [];
    const hasContact = chats.some((c) => {
      const id = c.dataset.chatId || "";
      return id.includes(currentUser.uid) && id.includes(userData.uid);
    });
    if (!hasContact) return "last seen hidden";
  }
  if (isUserOnlineNow(userData)) return "online";
  if (userData.lastSeen) return formatLastSeen(userData.lastSeen);
  return "";
}

async function setCurrentUserPresence(isOnline) {
  if (!currentUser) return;
  const hideOnline = (privacySettings.lastSeen || (privacySettings.hideLastSeen ? "nobody" : "everyone")) === "nobody";
  await db
    .collection("users")
    .doc(currentUser.uid)
    .set(
      {
        onlineStatus: hideOnline ? "offline" : isOnline ? "online" : "offline",
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        lastPresenceAt: firebase.firestore.FieldValue.serverTimestamp(),
        privacySettings: privacySettings,
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
  if (user && chatStatus) setChatStatus(getPresenceText(user));
}

async function loadGroupsList() {
  if (!currentUser) return;
  const groupsList = document.getElementById("groupsList");
  const groupActions = document.getElementById("groupActions");
  if (!groupsList) return;
  await refreshLockedChats();
  const enhancedGroups = (await buildGroupChatItems()).filter(
    (group) => !isChatLocked(group.id, "group"),
  );

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
    groupDiv.innerHTML = `<div class="list-avatar">${group.icon ? `<img src="${group.icon}">` : escapeHtml(getInitials(group.name || "Group"))}</div><div class="list-info" style="flex:1; cursor:pointer;"><div class="list-name">${group.isPinned ? '<span class="pin-icon">&#x1F4CC;</span> ' : ""}${group.isFavorite ? "* " : ""}${escapeHtml(group.name)} ${isMuted ? "[Muted]" : ""}</div><div class="list-preview">${escapeHtml(groupPreview)}${group.unreadCount ? ` - ${group.unreadCount} unread` : ""}</div></div><div class="group-row-actions"><button class="list-item-menu mute-chat-btn" title="${isMuted ? "Unmute group" : "Mute group"}" aria-label="${isMuted ? "Unmute group" : "Mute group"}" data-chat-id="${group.id}" data-chat-type="group">${isMuted ? "Unmute" : "Mute"}</button><button class="list-item-menu archive-chat-btn" title="Archive group" aria-label="Archive group" data-chat-id="${group.id}" data-chat-type="group" data-chat-name="${escapeHtml(group.name)}">Archive</button></div>`;
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
        await archiveChat(group.id, "group", group.name);
        showToast(`"${group.name}" archived`);
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

async function loadBroadcastsList(searchTerm = "") {
  if (!currentUser) return;
  const container = document.getElementById("broadcastsList");
  const actions = document.getElementById("broadcastActions");
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Loading broadcasts...</div>';
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
    console.warn("loadBroadcastsList error:", e);
    container.innerHTML =
      '<div class="empty-state tab-error-state">Could not load broadcasts<button type="button" class="btn btn-outline tab-retry-btn">Retry</button></div>';
    container.querySelector(".tab-retry-btn")?.addEventListener("click", () =>
      loadBroadcastsList(document.getElementById("searchInput")?.value || ""),
    );
    return;
  }
  if (currentViewTab !== "broadcasts") return;
  if (actions) actions.style.display = "flex";
  const term = String(searchTerm || "").trim().toLowerCase();
  const visibleBroadcasts = term
    ? currentBroadcasts.filter((broadcast) =>
        [broadcast.name, broadcast.description, broadcast.ownerName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term),
      )
    : currentBroadcasts;
  if (!visibleBroadcasts.length) {
    container.innerHTML =
      `<div class="empty-state">${term ? "No matching broadcasts" : "No broadcasts yet. Create one to send messages to multiple people."}</div>`;
    return;
  }
  container.innerHTML = "";
  for (const b of visibleBroadcasts) {
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
  await hydrateCurrentChatTranslationSetting();
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
  const chatDoc = await chatRef.get().catch((error) => {
    console.warn("Direct chat metadata read skipped:", error);
    return null;
  });
  if (!chatDoc?.exists && !(await hasAcceptedChatRelationship(otherUserId))) {
    showToast("Accept the chat request before opening this chat.", "error");
    return;
  }
  if (!Object.keys(chatData).length) {
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
          [currentUser.uid]: normalizeEmail(currentUser.email || ""),
          [otherUserId]: normalizeEmail(user.email || ""),
        },
        participantNames: {
          [currentUser.uid]: currentUser.displayName || currentUser.email || "Me",
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
  clearChatNotifications(chatId, "direct");
  await hydrateCurrentChatTranslationSetting();
  setActiveDraftKey();
  document.getElementById("currentChatName").textContent =
    currentChat.otherUserName;
  setChatStatus(getPresenceText(user));
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

  // Derive E2E shared key and mark chat encrypted
  if (currentChatType === "direct" && currentChat.otherUserId && currentChat.otherUserId !== currentUser.uid) {
    deriveSharedAESKey(currentChat.otherUserId).then(key => {
      if (key) {
        db.collection("directChats").doc(currentChat.id).set(
          { encryptionEnabled: true },
          { merge: true }
        ).catch(() => {});
        updateEncryptionBadge(currentChat.id, "direct");
      }
    }).catch(() => {});
  }

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

// Group creation wizard state
let createGroupState = {
  selectedMembers: [],
  step: 1,
};

function resetCreateGroupState() {
  createGroupState = { selectedMembers: [], step: 1 };
}

function openCreateGroupModal() {
  resetCreateGroupState();
  document.getElementById("createGroupModal").style.display = "flex";
  showCreateGroupStep(1);
  loadAllContactsForGroupCreate();
}

function showCreateGroupStep(step) {
  createGroupState.step = step;
  document.getElementById("createGroupStep1").style.display = step === 1 ? "block" : "none";
  document.getElementById("createGroupStep2").style.display = step === 2 ? "block" : "none";
  document.getElementById("createGroupBackBtn").style.display = step === 2 ? "inline-flex" : "none";
  document.getElementById("createGroupStepTitle").textContent = step === 1 ? "Add Members" : "New Group";
  document.getElementById("createGroupNextBtn").style.display = step === 1 ? "inline-flex" : "none";
  document.getElementById("createGroupConfirmBtn").style.display = step === 2 ? "inline-flex" : "none";
}

function loadAllContactsForGroupCreate() {
  const container = document.getElementById("allContactsList");
  if (!container) return;
  const contacts = allUsers.filter((u) => u.id !== currentUser.uid && !isBlocked(u.id));
  container.innerHTML = "";
  if (!contacts.length) {
    container.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--muted);text-align:center;">No contacts found. Invite people to Team Chat first.</div>';
    return;
  }
  contacts.forEach((user) => {
    const isSelected = createGroupState.selectedMembers.some((m) => m.id === user.id);
    const div = document.createElement("div");
    div.className = "member-search-item" + (isSelected ? " selected" : "");
    div.dataset.userId = user.id;
    div.innerHTML = `
      <div class="member-check">${isSelected ? "✓" : ""}</div>
      <div class="gi-member-avatar">${user.avatar ? `<img src="${user.avatar}">` : (user.displayName?.[0]?.toUpperCase() || "U")}</div>
      <div style="flex:1;"><strong>${escapeHtml(user.displayName || user.email)}</strong></div>
    `;
    div.onclick = () => toggleCreateGroupMember(user);
    container.appendChild(div);
  });
  updateMemberChips();
}

function toggleCreateGroupMember(user) {
  const idx = createGroupState.selectedMembers.findIndex((m) => m.id === user.id);
  if (idx >= 0) createGroupState.selectedMembers.splice(idx, 1);
  else createGroupState.selectedMembers.push(user);
  loadAllContactsForGroupCreate();
  updateMemberChips();
}

function updateMemberChips() {
  const container = document.getElementById("selectedMemberChips");
  if (!container) return;
  container.innerHTML = createGroupState.selectedMembers
    .map((m) => `<span class="member-chip">${escapeHtml(m.displayName || m.email)} <button class="member-chip-remove" data-id="${m.id}">&times;</button></span>`)
    .join("");
  container.querySelectorAll(".member-chip-remove").forEach((btn) => {
    btn.onclick = () => {
      const user = allUsers.find((u) => u.id === btn.dataset.id);
      if (user) toggleCreateGroupMember(user);
    };
  });
}

// Create group step-by-step
async function createGroup() {
  const name = document.getElementById("newGroupName")?.value?.trim();
  if (!name) {
    showToast("Please enter a group name", "error");
    return;
  }
  const description = document.getElementById("newGroupDescription")?.value?.trim() || "";
  const adminsOnlySend = !!document.getElementById("newGroupAdminsOnlySend")?.checked;
  const approvalRequired = !!document.getElementById("newGroupApprovalRequired")?.checked;
  const groupCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  const invitedUsers = [...createGroupState.selectedMembers];

  const groupRef = await db.collection("groups").add({
    name: name.trim(),
    description,
    code: groupCode,
    inviteCode: groupCode,
    createdBy: currentUser.uid,
    ownerId: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    memberCount: 1,
    memberIds: [currentUser.uid],
    adminIds: [currentUser.uid],
    onlyAdminsCanSend: adminsOnlySend,
    onlyAdminsCanEdit: true,
    onlyAdminsCanAddMembers: true,
    approvalRequired,
    encryptionEnabled: true,
  });
  await db.collection("groupMembers").add({
    groupId: groupRef.id,
    userId: currentUser.uid,
    role: "admin",
    joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  // Handle group icon from step 2
  const iconFile = document.getElementById("createGroupIconInput")?.files?.[0];
  if (iconFile) {
    try {
      const url = await uploadToCloudinary(iconFile);
      await db.collection("groups").doc(groupRef.id).update({ icon: url });
    } catch (e) { console.warn("Icon upload failed:", e); }
  }
  for (const user of invitedUsers) {
    await sendGroupInvite(groupRef.id, name.trim(), user);
  }
  showToast(`Group "${name}" created!`);
  document.getElementById("createGroupModal").style.display = "none";
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
  clearChatNotifications(groupId, "group");
  await hydrateCurrentChatTranslationSetting();
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
  // Show member count + encryption hint in chat header
  const headerSub = document.getElementById("chatHeaderSub");
  const memberCountEl = document.getElementById("groupMemberCount");
  if (headerSub) headerSub.style.display = "flex";
  if (memberCountEl) memberCountEl.textContent = (currentGroup.memberCount || currentGroupMembers.length) + " members";

  // Show/hide description banner
  const descBanner = document.getElementById("groupDescriptionBanner");
  if (descBanner) {
    const desc = groupData.description || groupData.rules || "";
    if (desc) {
      descBanner.style.display = "flex";
      document.getElementById("groupDescBannerAvatar").innerHTML = groupData.icon
        ? `<img src="${groupData.icon}" style="width:36px;height:36px;border-radius:50%;">`
        : "G";
      document.getElementById("groupDescBannerName").textContent = resolvedGroupName;
      document.getElementById("groupDescBannerDesc").textContent = desc;
      document.getElementById("groupDescBannerMeta").textContent =
        (currentGroup.memberCount || currentGroupMembers.length) + " members · Tap here for group info";
      descBanner.onclick = (e) => {
        if (e.target.closest(".group-desc-banner-close")) return;
        showGroupInfo();
      };
      const closeDescBtn = document.getElementById("groupDescBannerClose");
      if (closeDescBtn) closeDescBtn.onclick = (e) => {
        e.stopPropagation();
        descBanner.style.display = "none";
      };
    } else {
      descBanner.style.display = "none";
    }
  }
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
      const userData = userDoc.data();
      const lastSeen = userData.lastSeen?.toDate?.() || userData.lastSeen;
      const isOnline = userData.onlineStatus === "online" && lastSeen && (Date.now() - new Date(lastSeen).getTime() < 90000);
      currentGroupMembers.push({
        id: userDoc.id,
        name: userData.displayName || userData.email,
        role: doc.data().role,
        avatar: userData.avatar,
        onlineStatus: isOnline ? "online" : "offline",
        lastSeen: lastSeen,
      });
    }
  }
  return currentGroupMembers;
}

function isGroupMemberAdmin(uid) {
  if (!currentGroupMembers || !Array.isArray(currentGroupMembers)) return false;
  return currentGroupMembers.some(m => m.id === uid && ["owner", "admin"].includes(m.role));
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
  const currentUserRole = currentGroupMembers.find(
    (m) => m.id === currentUser.uid,
  )?.role;
  const isAdmin = ["owner", "admin"].includes(currentUserRole);
  const adminCount = currentGroupMembers.filter((member) =>
    ["owner", "admin"].includes(member.role),
  ).length;
  const canEditInfo = isAdmin || group.onlyAdminsCanEdit === false;

  // Title
  document.getElementById("groupInfoTitle").textContent = group.name;

  // Profile section - Avatar
  const avatarLarge = document.getElementById("groupAvatarLarge");
  const avatarText = document.getElementById("groupAvatarLargeText");
  if (avatarText) {
    avatarText.textContent = group.icon ? "" : (getInitials(group.name || "Group"));
  }
  avatarLarge.style.backgroundImage = group.icon ? `url(${group.icon})` : "";
  avatarLarge.style.backgroundSize = "cover";
  avatarLarge.style.backgroundPosition = "center";
  avatarLarge.innerHTML = group.icon
    ? `<div class="avatar-edit-overlay" style="position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:24px;opacity:0;transition:opacity 0.2s;cursor:pointer;">📷</div>`
    : `<span id="groupAvatarLargeText">${escapeHtml(getInitials(group.name || "Group"))}</span><div class="avatar-edit-overlay" style="position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:24px;opacity:0;transition:opacity 0.2s;cursor:pointer;">📷</div>`;
  avatarLarge.style.pointerEvents = canEditInfo ? "auto" : "none";

  // Click avatar to view fullscreen photo
  avatarLarge.onclick = (e) => {
    if (e.target.closest('.avatar-edit-overlay')) {
      document.getElementById("groupIconInput").click();
      return;
    }
    if (group.icon) {
      document.getElementById("groupPhotoViewerImg").src = group.icon;
      document.getElementById("groupPhotoViewerModal").style.display = "flex";
    }
  };

  // Group icon upload
  const iconInput = document.getElementById("groupIconInput");
  if (iconInput) {
    iconInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await updateGroupIcon(file);
    };
  }

  // Name editing
  const nameInput = document.getElementById("editGroupNameInput");
  if (nameInput) {
    nameInput.value = group.name || "";
    nameInput.disabled = !canEditInfo;
    nameInput.oninput = () => {
      document.getElementById("editGroupNameSaveBtn").style.display = canEditInfo && nameInput.value !== group.name ? "inline-flex" : "none";
    };
    nameInput.onchange = async () => {
      if (!canEditInfo || !nameInput.value.trim()) return;
      await updateGroupName(nameInput.value.trim());
      document.getElementById("editGroupNameSaveBtn").style.display = "none";
    };
  }
  const nameSaveBtn = document.getElementById("editGroupNameSaveBtn");
  if (nameSaveBtn) {
    nameSaveBtn.style.display = "none";
    nameSaveBtn.onclick = async () => {
      if (!canEditInfo || !nameInput?.value.trim()) return;
      await updateGroupName(nameInput.value.trim());
      nameSaveBtn.style.display = "none";
    };
  }

  // Description editing
  const descInput = document.getElementById("editGroupDescriptionInput");
  if (descInput) {
    descInput.value = group.description || "";
    descInput.disabled = !canEditInfo;
    descInput.oninput = () => {
      document.getElementById("editGroupDescSaveBtn").style.display = canEditInfo && descInput.value !== (group.description || "") ? "inline-flex" : "none";
    };
  }
  const descSaveBtn = document.getElementById("editGroupDescSaveBtn");
  if (descSaveBtn) {
    descSaveBtn.onclick = async () => {
      if (!canEditInfo || !currentGroup) return;
      await db.collection("groups").doc(currentGroup.id).update({ description: descInput?.value.trim() || "" });
      currentGroup.description = descInput?.value.trim() || "";
      showToast("Group description updated");
      descSaveBtn.style.display = "none";
    };
  }

  // Invite Code / Link
  const codeDisplay = document.getElementById("groupCodeDisplay");
  if (codeDisplay) codeDisplay.value = group.code || group.inviteCode || "";
  const shareBtn = document.getElementById("shareInviteLinkBtn");
  if (shareBtn) {
    shareBtn.onclick = async () => {
      const link = await generateInviteLink(currentGroup.id);
      if (link) {
        await navigator.clipboard.writeText(link);
        showToast("Invite link copied!");
      } else showToast("Failed to generate invite link", "error");
    };
  }
  const copyBtn = document.getElementById("copyGroupCodeBtn");
  if (copyBtn) {
    copyBtn.onclick = async () => {
      const code = group.code || group.inviteCode || "";
      if (code) {
        await navigator.clipboard.writeText(code);
        showToast("Invite code copied!");
      }
    };
  }
  const resetLinkBtn = document.getElementById("resetInviteLinkBtn");
  if (resetLinkBtn) {
    resetLinkBtn.style.display = isAdmin ? "inline-flex" : "none";
    resetLinkBtn.onclick = () => {
      document.getElementById("resetInviteLinkModal").style.display = "flex";
    };
  }
  const confirmResetBtn = document.getElementById("confirmResetInviteLinkBtn");
  if (confirmResetBtn) {
    confirmResetBtn.onclick = async () => {
      if (!currentGroup || !isAdmin) return;
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await db.collection("groups").doc(currentGroup.id).update({ inviteCode: code, code });
      if (codeDisplay) codeDisplay.value = code;
      showToast("Invite link reset!");
      document.getElementById("resetInviteLinkModal").style.display = "none";
    };
  }

  // Members section
  const membersTitle = document.getElementById("giMembersTitle");
  if (membersTitle) membersTitle.textContent = currentGroupMembers.length + " members";
  const memberList = document.getElementById("groupMembersList");
  memberList.innerHTML = "";
  for (const member of currentGroupMembers) {
    const isMemberAdmin = ["owner", "admin"].includes(member.role);
    const isCurrentUser = member.id === currentUser.uid;
    const canModifyOther = isAdmin && !isCurrentUser;
    const canDemoteSelf = isAdmin && isCurrentUser && isMemberAdmin && adminCount > 1;
    const canModify = canModifyOther || canDemoteSelf;
    const actionsHtml = canModify
      ? `<div class="gi-member-actions">${!isMemberAdmin ? `<button class="gi-member-action-btn make-admin-btn" data-id="${member.id}" data-name="${escapeHtml(member.name)}">Promote</button>` : `<button class="gi-member-action-btn remove-admin-btn" data-id="${member.id}" data-name="${escapeHtml(member.name)}">Demote</button>`}${canModifyOther ? `<button class="gi-member-action-btn remove-member-btn" data-id="${member.id}" data-name="${escapeHtml(member.name)}" style="color:#ea0038;">Remove</button>` : ""}</div>`
      : "";
    const statusDot = member.id === currentUser.uid
      ? '<span class="gi-member-online-dot" title="You"></span>'
      : `<span class="${member.onlineStatus === 'online' ? 'gi-member-online-dot' : 'gi-member-offline-dot'}" title="${member.onlineStatus === 'online' ? 'Online' : 'Offline'}"></span>`;
    const div = document.createElement("div");
    div.className = "gi-member-item";
    div.innerHTML = `
      <div class="gi-member-avatar">${member.avatar ? `<img src="${member.avatar}">` : (member.name?.[0]?.toUpperCase() || "U")}</div>
      <div class="gi-member-info">
        <div class="gi-member-name">${statusDot} ${escapeHtml(member.name)} ${isCurrentUser ? "(You)" : ""} ${isMemberAdmin ? '<span class="gi-member-role">Admin</span>' : ""}</div>
        <div class="gi-member-status">${isCurrentUser ? "" : (member.onlineStatus === "online" ? "Online" : (member.lastSeen ? formatLastSeen(member.lastSeen) : ""))}</div>
      </div>
      ${actionsHtml}`;
    memberList.appendChild(div);
  }
  // Add member row
  const canAddMembers = isAdmin || group.onlyAdminsCanAddMembers !== true;
  const addRow = document.getElementById("giAddMemberRow");
  if (addRow) addRow.style.display = canAddMembers ? "flex" : "none";
  const addBtn = document.getElementById("addMemberBtn");
  if (addBtn) addBtn.style.display = canAddMembers ? "inline-flex" : "none";
  if (addBtn) {
    addBtn.onclick = () => {
      const row = document.getElementById("giAddMemberRow");
      if (row) row.style.display = row.style.display === "none" ? "flex" : "none";
    };
  }
  const addConfirmBtn = document.getElementById("addMemberConfirmBtn");
  if (addConfirmBtn) {
    addConfirmBtn.onclick = () => {
      const emailInput = document.getElementById("addMemberEmail");
      if (emailInput) {
        addMemberToGroup(emailInput.value);
        emailInput.value = "";
      }
    };
  }
  // Member search
  const memberSearch = document.getElementById("giMembersSearch");
  if (memberSearch) {
    memberSearch.oninput = () => {
      const term = memberSearch.value.toLowerCase().trim();
      memberList.querySelectorAll(".gi-member-item").forEach((item) => {
        const name = item.querySelector(".gi-member-name")?.textContent?.toLowerCase() || "";
        item.style.display = term && !name.includes(term) ? "none" : "flex";
      });
    };
  }

  // Settings section - show for admins
  const settingsSections = ["groupSendPermissionRow", "groupEditPermissionRow", "groupAddMembersPermissionRow", "groupSlowModeRow", "groupWelcomeMessageRow", "groupJoinQuestionsRow", "groupModerationRow"];
  settingsSections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = isAdmin ? "flex" : "none";
  });

  // Send messages select
  const sendSelect = document.getElementById("groupAdminsOnlySendSelect");
  if (sendSelect) {
    sendSelect.value = group.onlyAdminsCanSend ? "true" : "false";
    sendSelect.disabled = !isAdmin;
    sendSelect.onchange = async () => {
      if (!isAdmin) return;
      await db.collection("groups").doc(currentGroup.id).update({ onlyAdminsCanSend: sendSelect.value === "true" });
      showToast(sendSelect.value === "true" ? "Only admins can send messages" : "All members can send messages");
    };
  }

  // Edit info select
  const editSelect = document.getElementById("groupAdminsOnlyEditSelect");
  if (editSelect) {
    editSelect.value = group.onlyAdminsCanEdit !== false ? "true" : "false";
    editSelect.disabled = !isAdmin;
    editSelect.onchange = async () => {
      if (!isAdmin) return;
      await db.collection("groups").doc(currentGroup.id).update({ onlyAdminsCanEdit: editSelect.value === "true" });
      showToast(editSelect.value === "true" ? "Only admins can edit info" : "All members can edit info");
    };
  }

  // Add members permission select
  const addMembersSelect = document.getElementById("groupAdminsOnlyAddMembersSelect");
  if (addMembersSelect) {
    addMembersSelect.value = group.onlyAdminsCanAddMembers ? "true" : "false";
    addMembersSelect.disabled = !isAdmin;
    addMembersSelect.onchange = async () => {
      if (!isAdmin) return;
      await db.collection("groups").doc(currentGroup.id).update({ onlyAdminsCanAddMembers: addMembersSelect.value === "true" });
      showToast(addMembersSelect.value === "true" ? "Only admins can add members" : "All members can add members");
    };
  }

  // Approve new members toggle
  const approveToggle = document.getElementById("groupApprovalRequiredToggle");
  if (approveToggle) {
    approveToggle.checked = group.approvalRequired === true;
    approveToggle.disabled = !isAdmin;
    approveToggle.onchange = async () => {
      if (!isAdmin) return;
      await db.collection("groups").doc(currentGroup.id).update({ approvalRequired: approveToggle.checked });
      showToast(approveToggle.checked ? "Approval required for new members" : "Anyone can join via link");
    };
    // Add link to view pending requests
    const pendingLink = document.createElement("button");
    pendingLink.className = "gi-approve-link";
    pendingLink.textContent = "View pending requests";
    pendingLink.onclick = () => showPendingJoinRequests(currentGroup.id);
    if (approveToggle.parentElement) {
      approveToggle.parentElement.after(pendingLink);
    }
  }

  // Disappearing messages
  const disappearSelect = document.getElementById("groupInfoDisappearingSelect");
  if (disappearSelect) {
    disappearSelect.value = String(group.disappearAfterSecs || 0);
    disappearSelect.disabled = !isAdmin;
    disappearSelect.onchange = async () => {
      if (!isAdmin) return;
      await db.collection("groups").doc(currentGroup.id).update({ disappearAfterSecs: parseInt(disappearSelect.value) || 0 });
      showToast("Disappearing messages updated");
    };
  }

  // Encryption toggle
  const encToggle = document.getElementById("groupEncryptionToggle");
  if (encToggle) {
    encToggle.checked = group.encryptionEnabled === true;
    encToggle.disabled = !isAdmin;
    encToggle.onchange = async () => {
      if (!isAdmin) return;
      await db.collection("groups").doc(currentGroup.id).update({ encryptionEnabled: encToggle.checked });
      showToast(encToggle.checked ? "Encryption enabled" : "Encryption disabled");
    };
  }

  // Slow mode
  const slowModeSelect = document.getElementById("groupSlowModeSelect");
  if (slowModeSelect) {
    slowModeSelect.value = String(group.slowModeInterval || 0);
    slowModeSelect.onchange = () => setSlowMode(currentGroup.id, parseInt(slowModeSelect.value) || 0);
  }

  // Welcome message
  const editWelcomeBtn = document.getElementById("editWelcomeMessageBtn");
  if (editWelcomeBtn) {
    editWelcomeBtn.onclick = () => {
      const input = document.getElementById("welcomeMessageInput");
      if (input) input.value = group.welcomeMessage || "";
      document.getElementById("welcomeMessageModal").style.display = "flex";
    };
  }
  const saveWelcomeBtn = document.getElementById("saveWelcomeMessageBtn");
  if (saveWelcomeBtn) {
    saveWelcomeBtn.onclick = () => {
      const input = document.getElementById("welcomeMessageInput");
      if (input) setWelcomeMessage(currentGroup.id, input.value);
    };
  }
  const clearWelcomeBtn = document.getElementById("clearWelcomeMessageBtn");
  if (clearWelcomeBtn) {
    clearWelcomeBtn.onclick = () => {
      setWelcomeMessage(currentGroup.id, "");
      document.getElementById("welcomeMessageModal").style.display = "none";
    };
  }

  // Join questions
  const joinBtn = document.getElementById("manageJoinQuestionsBtn");
  if (joinBtn) joinBtn.onclick = showJoinQuestionsEditorModal;

  // Moderation
  const modBtn = document.getElementById("groupModerationBtn");
  if (modBtn) modBtn.onclick = showModerationSettingsModal;

  // Shared Media
  document.querySelectorAll(".gi-media-tab").forEach((btn) => {
    btn.onclick = async () => {
      document.querySelectorAll(".gi-media-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      await renderSharedContent(btn.dataset.giMediaTab || "media", "groupSharedContent");
    };
  });
  await renderSharedContent("media", "groupSharedContent");

  // Past Participants section
  const ppSection = document.getElementById("giPastParticipantsSection");
  if (ppSection) ppSection.style.display = isAdmin ? "block" : "none";

  // Actions
  const markUnreadBtn = document.getElementById("groupInfoMarkUnreadBtn");
  if (markUnreadBtn) {
    markUnreadBtn.onclick = async () => {
      await db.collection("chatsReadState").doc(currentUser.uid + "_" + currentGroup.id).set({
        userId: currentUser.uid, chatId: currentGroup.id, chatType: "group",
        lastReadAt: new Date(0),
      }, { merge: true });
      showToast("Marked as unread");
      document.getElementById("groupInfoModal").style.display = "none";
    };
  }
  const muteBtn = document.getElementById("giMuteGroupBtn");
  if (muteBtn) {
    const isMuted = isChatMuted(currentGroup.id);
    muteBtn.textContent = isMuted ? "Unmute Notifications" : "Mute Notifications";
    muteBtn.onclick = async () => {
      if (isMuted) {
        const muteRecord = getActiveMuteRecord(currentGroup.id, "group");
        if (muteRecord) await unmuteChat(muteRecord.id);
      } else {
        await muteChat(currentGroup.id, "group", "always");
      }
      showToast(isMuted ? "Unmuted" : "Muted");
    };
  }
  const wallpaperBtn = document.getElementById("giWallpaperBtn");
  if (wallpaperBtn) wallpaperBtn.onclick = () => document.getElementById("wallpaperBtn")?.click();
  const exportBtn = document.getElementById("giExportChatBtn");
  if (exportBtn) exportBtn.onclick = () => { document.getElementById("groupInfoModal").style.display = "none"; exportCurrentChat(); };
  const clearBtn = document.getElementById("giClearChatBtn");
  if (clearBtn) clearBtn.onclick = () => { document.getElementById("groupInfoModal").style.display = "none"; clearChatHistoryForMe(currentGroup.id, "group", currentGroup.name); };
  const reportBtn = document.getElementById("giReportGroupBtn");
  if (reportBtn) reportBtn.onclick = () => {
    document.getElementById("groupInfoModal").style.display = "none";
    if (confirm(`Report this group?`)) {
      db.collection("userReports").add({
        reporterUserId: currentUser.uid,
        reportedGroupId: currentGroup.id,
        reportedGroupName: currentGroup.name,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      }).then(() => showToast("Group reported")).catch(() => showToast("Failed to report", "error"));
    }
  };
  const leaveBtn = document.getElementById("giLeaveGroupBtn");
  if (leaveBtn) leaveBtn.onclick = () => leaveGroup();
  const deleteBtn = document.getElementById("deleteGroupBtn");
  if (deleteBtn) {
    deleteBtn.style.display = isAdmin ? "flex" : "none";
    deleteBtn.onclick = () => deleteGroup();
  }

  document.getElementById("groupInfoModal").style.display = "flex";
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
  // Log removal for Past Participants
  await db.collection("groupActivityLog").add({
    groupId,
    type: "member_removed",
    userId: memberId,
    userName: memberName,
    removedBy: currentUser.uid,
    removedByName: currentUser.displayName || currentUser.email,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast("Member removed");
  await loadGroupMembers(groupId);
  showGroupInfo();
  loadGroupsList();
}

async function addMemberToGroup(email) {
  if (!currentGroup) return;
  const isAdmin = isCurrentUserGroupAdmin();
  const canAddMembers = isAdmin || currentGroup.onlyAdminsCanAddMembers !== true;
  if (!canAddMembers) { showToast("Only admins can add members", "error"); return; }
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
  await db.collection("groupActivityLog").add({
    groupId: currentGroup.id,
    type: "member_left",
    userId: currentUser.uid,
    userName: currentUser.displayName || currentUser.email,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });
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
  // Check if approval required
  if (groupData.approvalRequired === true) {
    // Create a join request instead of joining directly
    const existingRequest = await db.collection("groupJoinRequests")
      .where("groupId", "==", group.id)
      .where("userId", "==", currentUser.uid)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!existingRequest.empty) {
      showToast("You already have a pending request for this group");
      return;
    }
    await db.collection("groupJoinRequests").add({
      groupId: group.id,
      groupName: groupData.name || "Group",
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
      userAvatar: currentUser.photoURL || "",
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("Join request sent! An admin will review it.");
    return;
  }
  if (groupData.joinQuestions && groupData.joinQuestions.length) {
    await showJoinQuestionsModal(group.id);
    return;
  }
  await joinGroupFinalize(group.id);
}

async function showPendingJoinRequests(groupId) {
  const list = document.getElementById("pendingJoinRequestsList");
  if (!list) return;
  list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">Loading...</div>';
  document.getElementById("approveMembersModal").style.display = "flex";
  try {
    const snapshot = await db.collection("groupJoinRequests")
      .where("groupId", "==", groupId)
      .where("status", "==", "pending")
      .get();
    if (snapshot.empty) {
      list.innerHTML = '<div class="empty-state" style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">No pending requests</div>';
      return;
    }
    list.innerHTML = "";
    for (const doc of snapshot.docs) {
      const req = doc.data();
      const div = document.createElement("div");
      div.className = "pending-request-item";
      div.innerHTML = `
        <div class="gi-member-avatar">${req.userAvatar ? `<img src="${req.userAvatar}">` : (req.userName?.[0]?.toUpperCase() || "U")}</div>
        <div class="pending-request-info">
          <div class="pending-request-name">${escapeHtml(req.userName)}</div>
          <div class="pending-request-meta">Requested to join</div>
        </div>
        <div class="pending-request-actions">
          <button class="pending-request-approve" data-req-id="${doc.id}">Approve</button>
          <button class="pending-request-reject" data-req-id="${doc.id}">Reject</button>
        </div>`;
      list.appendChild(div);
    }
    list.querySelectorAll(".pending-request-approve").forEach((btn) => {
      btn.onclick = async () => {
        const reqId = btn.dataset.reqId;
        try {
          const reqDoc = await db.collection("groupJoinRequests").doc(reqId).get();
          const reqData = reqDoc.data();
          if (!reqData) return;
          await db.collection("groupMembers").add({
            groupId: reqData.groupId,
            userId: reqData.userId,
            role: "member",
            joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          await db.collection("groups").doc(reqData.groupId).update({
            memberCount: firebase.firestore.FieldValue.increment(1),
          });
          await db.collection("groupJoinRequests").doc(reqId).update({
            status: "approved",
            respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          await sendWelcomeMessage(reqData.groupId, reqData.userId);
          showToast(`Approved ${reqData.userName}'s request`);
          showPendingJoinRequests(groupId);
        } catch (e) {
          showToast("Failed to approve request", "error");
        }
      };
    });
    list.querySelectorAll(".pending-request-reject").forEach((btn) => {
      btn.onclick = async () => {
        const reqId = btn.dataset.reqId;
        await db.collection("groupJoinRequests").doc(reqId).update({
          status: "rejected",
          respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        showToast("Request rejected");
        showPendingJoinRequests(groupId);
      };
    });
  } catch (e) {
    list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--danger);">Failed to load requests</div>';
  }
}

function togglePastParticipants() {
  const list = document.getElementById("giPastParticipantsList");
  const chevron = document.getElementById("giPastParticipantsChevron");
  if (!list) return;
  const isOpen = list.style.display !== "none";
  list.style.display = isOpen ? "none" : "block";
  if (chevron) chevron.textContent = isOpen ? "▶" : "▼";
  if (!isOpen && !list.dataset.loaded) {
    list.dataset.loaded = "true";
    loadPastParticipants();
  }
}

async function loadPastParticipants() {
  const list = document.getElementById("giPastParticipantsList");
  if (!list || !currentGroup) return;
  list.innerHTML = '<div style="padding:12px;text-align:center;font-size:13px;color:var(--muted);">Loading...</div>';
  try {
    const snap = await db.collection("groupActivityLog")
      .where("groupId", "==", currentGroup.id)
      .where("type", "in", ["member_removed", "member_left"])
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();
    if (snap.empty) {
      list.innerHTML = '<div style="padding:12px;text-align:center;font-size:13px;color:var(--muted);">No past participants</div>';
      return;
    }
    list.innerHTML = "";
    for (const doc of snap.docs) {
      const entry = doc.data();
      const ts = entry.timestamp?.toDate?.() || entry.timestamp;
      const div = document.createElement("div");
      div.className = "gi-member-item";
      div.innerHTML = `
        <div class="gi-member-avatar" style="opacity:0.6;">${entry.userName?.[0]?.toUpperCase() || "U"}</div>
        <div class="gi-member-info">
          <div class="gi-member-name" style="opacity:0.8;">${escapeHtml(entry.userName)}</div>
          <div class="gi-member-status">${entry.type === "member_removed" ? "Removed by " + escapeHtml(entry.removedByName || "admin") : "Left"} · ${ts ? formatLastSeen(ts) : ""}</div>
        </div>`;
      list.appendChild(div);
    }
  } catch (e) {
    console.warn("loadPastParticipants error:", e);
    list.innerHTML = '<div style="padding:12px;text-align:center;font-size:13px;color:var(--muted);">Could not load</div>';
  }
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
  await sendWelcomeMessage(groupId, currentUser.uid);
  showToast(`Joined Group!`);
  loadGroupsList();
}

// ========================================
// STATUS STORIES FLOWS
// ========================================

async function loadStatusList(searchTerm = "") {
  const statusList = document.getElementById("statusList");
  const statusActions = document.getElementById("statusActions");
  if (!statusList || !currentUser) return;
  if (!statusList.dataset.loaded)
    statusList.innerHTML = '<div class="empty-state tab-loading-state">Loading status updates...</div>';
  let statuses = [];
  try {
    const [snapshot, directChats] = await Promise.all([
      db.collection("statuses").where("expiresAt", ">", new Date()).get(),
      db
        .collection("directChats")
        .where("participants", "array-contains", currentUser.uid)
        .get(),
    ]);
    const connectedUserIds = new Set([currentUser.uid]);
    directChats.docs.forEach((doc) => {
      if (doc.data()?.status === "deleted") return;
      (doc.data()?.participants || []).forEach((id) => connectedUserIds.add(id));
    });
    statuses = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((status) => connectedUserIds.has(status.userId))
      .sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0),
      );
  } catch (e) {
    console.warn("Could not load status updates:", e);
    if (statusActions) statusActions.style.display = "none";
    statusList.innerHTML =
      '<div class="empty-state tab-error-state">Could not load status updates<button type="button" class="btn btn-outline tab-retry-btn">Retry</button></div>';
    statusList.querySelector(".tab-retry-btn")?.addEventListener("click", () =>
      loadStatusList(document.getElementById("searchInput")?.value || ""),
    );
    return;
  }

  const term = String(searchTerm || "").trim().toLowerCase();
  if (term) {
    statuses = statuses.filter((status) =>
      [status.userName, status.text]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
      );
  }
  statusList.dataset.loaded = "true";
  if (!statuses.length) {
    if (statusActions) statusActions.style.display = "none";
    statusList.innerHTML = term
      ? '<div class="empty-state tab-empty-state"><div class="tab-empty-icon status-empty-icon" aria-hidden="true"></div><div class="empty-state-title">No matching updates</div><div class="empty-state-copy">Try a different status search.</div></div>'
      : '<div class="empty-state tab-empty-state"><div class="tab-empty-icon status-empty-icon" aria-hidden="true"></div><div class="empty-state-title">No status updates yet</div><div class="empty-state-copy">Share a photo, video, or note with your connected contacts.</div><button type="button" class="join-btn empty-add-status">Add status</button></div>';
    statusList.querySelector(".empty-add-status")?.addEventListener("click", () => {
      document.getElementById("createStatusModal").style.display = "flex";
    });
    return;
  }
  if (statusActions)
    statusActions.style.display = currentViewTab === "status" ? "flex" : "none";
  const byUser = new Map();
  statuses.forEach((s) => {
    if (!byUser.has(s.userId)) byUser.set(s.userId, []);
    byUser.get(s.userId).push(s);
  });
  statusList.innerHTML = "";
  const orderedStatusSets = [...byUser.values()].sort((a, b) => {
    if (a[0]?.userId === currentUser.uid) return -1;
    if (b[0]?.userId === currentUser.uid) return 1;
    return (b[0]?.createdAt?.toMillis?.() || 0) - (a[0]?.createdAt?.toMillis?.() || 0);
  });
  for (const userStatuses of orderedStatusSets) {
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

function setupMainNavigationLiveListeners() {
  if (!currentUser) return;
  [
    statusesUnsubscribe,
    outgoingCallsListUnsubscribe,
    incomingCallsListUnsubscribe,
    groupCallsListUnsubscribe,
  ].forEach((unsubscribe) => {
    if (typeof unsubscribe === "function") unsubscribe();
  });

  const handleNavigationListenerError = (error) => {
    console.warn("Main navigation live update paused:", error?.message || error);
  };
  const scheduleStatusRefresh = () => {
    clearTimeout(statusRefreshTimer);
    statusRefreshTimer = setTimeout(() => {
      if (currentViewTab === "status")
        loadStatusList(document.getElementById("searchInput")?.value || "");
    }, 120);
  };
  const scheduleCallsRefresh = () => {
    clearTimeout(callHistoryRefreshTimer);
    callHistoryRefreshTimer = setTimeout(() => {
      if (currentViewTab === "calls")
        loadCallsList(document.getElementById("searchInput")?.value || "");
    }, 160);
  };
  statusesUnsubscribe = db.collection("statuses").onSnapshot(() => {
    scheduleStatusRefresh();
  }, handleNavigationListenerError);
  outgoingCallsListUnsubscribe = db
    .collection("calls")
    .where("fromUserId", "==", currentUser.uid)
    .onSnapshot(scheduleCallsRefresh, handleNavigationListenerError);
  incomingCallsListUnsubscribe = db
    .collection("calls")
    .where("toUserId", "==", currentUser.uid)
    .onSnapshot(scheduleCallsRefresh, handleNavigationListenerError);
  groupCallsListUnsubscribe = db
    .collection("calls")
    .where("participantIds", "array-contains", currentUser.uid)
    .onSnapshot(scheduleCallsRefresh, handleNavigationListenerError);
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
  const statusMedia = status.image
    ? status.image.type === "video"
      ? `<video src="${escapeHtml(status.image.url)}" autoplay muted playsinline controls></video>`
      : `<img src="${escapeHtml(status.image.url)}" alt="">`
    : "";
  const statusCaption = status.text
    ? `<div class="status-viewer-text status-viewer-caption">${escapeHtml(status.text)}</div>`
    : "";
  document.getElementById("statusViewerBody").innerHTML = statusMedia
    ? `${statusMedia}${statusCaption}`
    : statusCaption || '<div class="status-viewer-text">Status unavailable</div>';
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
  const nextDelay = status.image?.type === "video" ? 15000 : status.image ? 8000 : 5000;
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
  renderChatStorageStats();
  await renderSharedContent("media");
}

function renderChatStorageStats() {
  const el = document.getElementById("chatStorageStats");
  if (!el || !currentChat) return;
  getCurrentSharedMessages().then(messages => {
    const total = messages.length;
    const media = messages.filter(m => ["image","gif","video"].includes(m.attachment?.type)).length;
    const docs = messages.filter(m => m.attachment?.type === "document" || m.attachment?.type === "audio").length;
    const voice = messages.filter(m => m.attachment?.type === "voice").length;
    const links = messages.filter(m => findUrls(m.text || "").length > 0).length;
    let totalSize = 0;
    messages.forEach(m => { if (m.attachment?.size) totalSize += m.attachment.size; });
    const sizeStr = totalSize > 1048576 ? (totalSize / 1048576).toFixed(1) + " MB" : totalSize > 1024 ? Math.round(totalSize / 1024) + " KB" : totalSize + " B";
    el.innerHTML = `<div class="stats-header">Storage</div>
      <div class="stats-row"><span>Messages</span><strong>${total}</strong></div>
      <div class="stats-row"><span>Media</span><strong>${media}</strong></div>
      <div class="stats-row"><span>Voice notes</span><strong>${voice}</strong></div>
      <div class="stats-row"><span>Documents</span><strong>${docs}</strong></div>
      <div class="stats-row"><span>Links</span><strong>${links}</strong></div>
      <div class="stats-row" style="border:none"><span>Total size</span><strong>${sizeStr}</strong></div>`;
  }).catch(() => { el.innerHTML = ""; });
}

async function renderSharedContent(type, containerId = "sharedContent") {
  const container = document.getElementById(containerId);
  if (!container || !currentChat) return;
  container.innerHTML = '<div class="shared-empty">Loading items...</div>';
  let messages = await getCurrentSharedMessages();
  if (type === "media") {
    const media = messages.filter(
      (m) => ["image", "gif", "video"].includes(m.attachment?.type) && m.attachment?.url,
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
  bindSharedSelection(container, messages);
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
  const messageMeta = escapeHtml(JSON.stringify({
    messageId: message.id || "",
    chatId: message.chatId || currentChat?.id || "",
    chatType: message.chatType || currentChatType || "",
    senderId: message.senderId || "",
    senderName: message.senderName || "",
    text: message.text || "",
    timestamp: message.timestamp || "",
    attachment: message.attachment || {},
  }));
  return `
    <div class="shared-media-item-wrap shared-selectable-item" data-message-id="${escapeHtml(message.id)}" data-message-meta="${messageMeta}">
      <button type="button" class="shared-select-toggle" aria-label="Select item"></button>
      <button type="button" class="shared-media-item" data-preview-url="${url}" data-filename="${filename}" title="${filename}">
        ${attachment.type === "video" ? `<video src="${url}" preload="metadata" muted playsinline></video>` : `<img src="${url}" alt="${filename}" loading="lazy" class="shared-media-img">`}
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
    <div class="shared-list-item-wrap shared-selectable-item" data-message-id="${escapeHtml(message.id)}">
      <button type="button" class="shared-select-toggle" aria-label="Select item"></button>
      <button type="button" class="shared-list-item shared-open-item" data-preview-url="${url}" data-filename="${filename}">
        <span>${filename}</span>
        <small>${escapeHtml(detail || "Document")}</small>
      </button>
      <button type="button" class="shared-item-share-btn" title="Share" data-share-attachment="${attJson}">↪ Share</button>
    </div>
  `;
}

function bindSharedContentActions(root = document) {
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
  // Direct click handlers for shared media preview
  root.querySelectorAll("[data-preview-url]").forEach((el) => {
    if (el.dataset.sharedPreviewBound === "true") return;
    el.dataset.sharedPreviewBound = "true";
    el.addEventListener("click", (event) => {
      event.preventDefault();
      console.log("[MEDIA] click shared [data-preview-url]", el.dataset.previewUrl);
      var url = el.dataset.previewUrl;
      if (!url) { showToast("Media is not available", "error"); return; }
      var filename = el.dataset.filename || "Shared item";
      try {
        if (el.querySelector("video") && typeof openMediaViewer === "function") {
          openMediaViewer(url, filename, "video");
        } else if (el.querySelector("img") && typeof openMediaViewer === "function") {
          openMediaViewer(url, filename, "image");
        } else if (typeof previewFile === "function") {
          previewFile(url, filename);
        } else {
          console.log("[MEDIA] fallback shared - functions not defined");
          forceShowViewer(url);
        }
      } catch(ex) {
        console.error("[MEDIA] error in shared handler", ex);
        forceShowViewer(url);
      }
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
        !data.openedBy?.[currentUser.uid]
      ) {
        updates[`openedBy.${currentUser.uid}`] =
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
    clearChatNotifications(currentChat.id, currentChatType);
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

  let receiptHtml = "";
  let detailData = "";

  if (
    readByTarget ||
    (!privacySettings.hideReadReceipts &&
      msg.status === "read" &&
      (targets.length === 0 || msg.read))
  ) {
    receiptHtml = '<span class="read-receipt read" title="Read">✓✓</span>';
    const readTime = msg.readBy ? getEarliestReadTime(msg.readBy, targets) : null;
    detailData = readTime ? "Read " + formatTime(readTime) : "Read";
  } else if (deliveredToTarget || msg.status === "delivered") {
    receiptHtml = '<span class="read-receipt delivered" title="Delivered">✓✓</span>';
  } else {
    receiptHtml = '<span class="read-receipt sent" title="Sent">✓</span>';
  }

  if (msg.timestamp && (receiptHtml.includes("read-receipt"))) {
    return `<span class="read-receipt-wrapper" onclick="showReceiptDetail(this, '${escapeHtml(detailData)}')" style="cursor:pointer">${receiptHtml}</span>`;
  }
  return receiptHtml;
}

function getEarliestReadTime(readBy, targets) {
  let earliest = null;
  if (readBy && targets && targets.length) {
    targets.forEach(id => {
      const t = readBy[id];
      if (t) {
        const ms = t?.toMillis?.() || new Date(t).getTime();
        if (!earliest || ms < earliest) earliest = ms;
      }
    });
  }
  return earliest ? new Date(earliest) : null;
}

function showReceiptDetail(el, detail) {
  const existing = el.querySelector(".receipt-detail");
  if (existing) { existing.remove(); return; }
  const tip = document.createElement("div");
  tip.className = "receipt-detail";
  tip.textContent = detail;
  tip.style.cssText = "position:absolute;bottom:100%;right:0;background:var(--panel);color:var(--text);font-size:11px;padding:4px 8px;border-radius:6px;box-shadow:var(--shadow);white-space:nowrap;z-index:10;pointer-events:none";
  el.style.position = "relative";
  el.appendChild(tip);
  setTimeout(() => tip.remove(), 2500);
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
  bindRenderedMessageActions();
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
    mentions: getMessageMentions(failed.text || "").filter((m) => !m.isEveryone),
    mentionEveryone: getMessageMentions(failed.text || "").some((m) => m.isEveryone),
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
    messageDiv.classList.remove("delete-swipe-active");
    messageDiv.style.removeProperty("--reply-swipe-x");
    startX = null;
    startY = null;
    pointerId = null;
    gestureLocked = false;
    moved = false;
  };

  messageDiv.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (
      event.target.closest(
        ".message-options-btn, .message-quick-actions, button, a, input, textarea, select",
      )
    )
      return;
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
      const pull = Math.max(-86, Math.min(dx, 86));
      messageDiv.style.setProperty("--reply-swipe-x", `${pull}px`);
    }
    moved = absDx > 18 && dy < 56;
    messageDiv.classList.toggle("reply-swipe-active", moved && dx > 0);
    messageDiv.classList.toggle("delete-swipe-active", moved && dx < 0);
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
    } else if (dx < -52 && dy < 64) {
      openMessageDeleteSheet(messageData.messageId, messageData);
    }
    resetSwipe();
  });
  messageDiv.addEventListener("pointercancel", resetSwipe);
  messageDiv.addEventListener("lostpointercapture", resetSwipe);
}

function positionMessageQuickActions(messageDiv) {
  const messagesArea = messageDiv?.closest?.(".messages-area");
  const bubble = messageDiv?.querySelector?.(".message-bubble");
  const actions = messageDiv?.querySelector?.(".message-quick-actions");
  if (!messagesArea || !bubble || !actions) return;

  messageDiv.classList.remove("actions-below");
  requestAnimationFrame(() => {
    const areaRect = messagesArea.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const neededSpace = actions.offsetWidth + 12;
    const sideSpace = messageDiv.classList.contains("my-message")
      ? bubbleRect.left - areaRect.left
      : areaRect.right - bubbleRect.right;
    messageDiv.classList.toggle("actions-below", sideSpace < neededSpace);
  });
}

function bindSharedSelection(container, messages = []) {
  const byId = new Map(messages.map((message) => [message.id, message]));
  container.querySelectorAll(".shared-selectable-item").forEach((item) => {
    item.querySelector(".shared-select-toggle")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const message = byId.get(item.dataset.messageId);
      if (!message) return;
      toggleSelectedMessage(message.id, message);
      item.classList.toggle("bulk-selected", selectedChatMessages.has(message.id));
    });
  });
}

function positionAllMessageQuickActions() {
  document
    .querySelectorAll("#messagesArea .message")
    .forEach(positionMessageQuickActions);
}

window.addEventListener("resize", positionAllMessageQuickActions);
window.addEventListener("orientationchange", positionAllMessageQuickActions);

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
      if (
        messageDiv.classList.contains("reply-swipe-active") ||
        messageDiv.classList.contains("delete-swipe-active")
      )
        return;
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
    async (snapshot) => {
      if (!messagesArea) return;
      const previousHeight = messagesArea.scrollHeight;
      const previousScrollTop = messagesArea.scrollTop;
      const shouldStickToBottom =
        previousHeight - previousScrollTop - messagesArea.clientHeight < 100;
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

      // Decrypt E2E messages before rendering
      const decryptedTexts = {};
      if (currentChatType === "direct") {
        const peerUid = _getPeerUid();
        if (peerUid) {
          await Promise.all(docsToRender.map(async (doc) => {
            const msg = doc.data();
            if (msg.encrypted && msg.iv) {
              const plaintext = await decryptMessageText(msg.text, msg.iv, peerUid);
              if (plaintext !== null) decryptedTexts[doc.id] = plaintext;
            }
          }));
        }
      }

      let _prevRenderedMsg = null;
      docsToRender.forEach((doc) => {
        const msg = doc.data();
        if (decryptedTexts[doc.id]) {
          msg.text = decryptedTexts[doc.id];
        } else if (msg.encrypted) {
          msg.text = "🔒 Encrypted message";
          msg._decryptFailed = true;
        }
        if (isExpiredByDisappearingSetting(msg)) return;
        if (
          msg.deletedFor?.[currentUser.uid] ||
          msg.deletedForEveryone ||
          isBlocked(msg.senderId)
        )
          return;
        const isMyMessage = msg.senderId === currentUser.uid;
        const _prevTs = _prevRenderedMsg?.timestamp?.toMillis?.() || 0;
        const _curTs = msg.timestamp?.toMillis?.() || 0;
        const isContinuation = !!(
          _prevRenderedMsg &&
          _prevRenderedMsg.senderId === msg.senderId &&
          msg.type !== "call" &&
          _prevRenderedMsg.type !== "call" &&
          !msg.replyTo &&
          (_curTs - _prevTs) < 5 * 60 * 1000
        );
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${isMyMessage ? "my-message" : ""}${isContinuation ? " msg-continuation" : ""}`;
        messageDiv.dataset.messageId = doc.id;
        messageDiv._messageData = { ...msg, messageId: doc.id };

        if (msg.type === "call") {
          messageDiv.className = "message call-message";
          messageDiv.innerHTML = renderCallMessage(msg);
          messageDiv
            .querySelector(".call-again-btn")
            ?.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              redialCall({
                ...msg,
                id: msg.callId,
                type: msg.callType || "voice",
                groupCall: Boolean(msg.groupId),
              });
            });
          messageDiv
            .querySelector(".call-history-message-delete")
            ?.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              openMessageDeleteSheet(doc.id, { ...msg, messageId: doc.id });
            });
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
        let textContent =
          msg.type === "location"
            ? ""
            : isMyMessage && msg.translatedForSend && msg.originalText
              ? msg.originalText
              : msg.text || "";

        if (!isMyMessage && msg.read === false) _msgReadState[doc.id] = true;

        messageDiv.innerHTML = `
        <div class="swipe-reply-indicator" aria-hidden="true"></div>
        <div class="swipe-delete-indicator" aria-hidden="true"></div>
        <div class="message-quick-actions ${isMyMessage ? "sent-message-actions" : "received-message-actions"}"><button type="button" class="quick-message-action quick-forward-btn" title="Forward message" aria-label="Forward message"></button><button type="button" class="quick-message-action quick-translate-btn" title="Translate message" aria-label="Translate message"></button><button type="button" class="quick-message-action quick-delete-btn" title="Delete message" aria-label="Delete message"></button></div>
        <div class="message-bubble">
          <button type="button" class="message-options-btn" title="Message options" aria-label="Message options">⋮</button>
          ${!isMyMessage && !isContinuation ? `<div class="message-sender">${escapeHtml(msg.senderName)}${currentChatType === "group" && isGroupMemberAdmin(msg.senderId) ? ' <span class="admin-badge" title="Group admin">👑</span>' : ""}</div>` : ""}
          ${replyHtml}
          ${textContent ? `<div class="message-text${isEmojiOnly(textContent) ? ' emoji-large' : ''}">${renderMessageText(textContent, msg.mentionEveryone ? [...(msg.mentions || []), { id: 'everyone', name: 'everyone', label: 'everyone', isEveryone: true }] : (msg.mentions || []))}</div>` : ""}
          ${isMyMessage && msg.translatedForSend ? `<details class="sent-translation-details"><summary>Sent translated</summary><div>${renderMessageText(msg.text || "")}</div></details>` : ""}
          ${stickerHtml}
          ${linkPreviewHtml}
          ${attachmentHtml}
          ${locationHtml}
          ${pollHtml}
          ${contactHtml}
          ${eventHtml}
          ${listHtml}
          ${getTranslationCardHtml(doc.id)}
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
        messageDiv.addEventListener("click", (event) => {
          const selMode = document.body.classList.contains("selection-mode");
          if (!selectedChatMessages.size && !selMode) return;
          if (event.target.closest("button, a, input, textarea, select, audio, video, .msg-select-checkbox")) return;
          event.preventDefault();
          toggleSelectedMessage(doc.id, msg);
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
        messageDiv
          .querySelector(".quick-delete-btn")
          ?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openMessageDeleteSheet(doc.id, { ...msg, messageId: doc.id });
          });
        messageDiv
          .querySelector(".quick-forward-btn")
          ?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openForwardModal(doc.id, { ...msg, messageId: doc.id });
          });
        messageDiv
          .querySelector(".quick-translate-btn")
          ?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openTranslateModal(doc.id, { ...msg, messageId: doc.id });
          });
        bindTranslationCardActions(messageDiv, doc.id, {
          ...msg,
          messageId: doc.id,
        });
        messageDiv.addEventListener("dblclick", (e) => {
          if (e.target.closest("button, a, input, textarea, select")) return;
          const recentR = getRecentReactions();
          const quickEmoji = recentR.length > 0 ? recentR[0] : "❤️";
          addReaction(doc.id, quickEmoji);
          const heart = document.createElement("span");
          heart.textContent = quickEmoji;
          heart.style.cssText = "position:absolute;font-size:32px;pointer-events:none;z-index:10;animation:heartPop 0.6s ease forwards;";
          const bubble = messageDiv.querySelector(".message-bubble");
          if (bubble) {
            bubble.style.position = "relative";
            bubble.appendChild(heart);
            setTimeout(() => heart.remove(), 700);
          }
        });
        _prevRenderedMsg = msg;
        messagesArea.appendChild(messageDiv);
        positionMessageQuickActions(messageDiv);
        bindSwipeToReply(messageDiv, { ...msg, messageId: doc.id });
        messageDiv
          .querySelector(".event-start-call-btn")
          ?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            startCall(event.currentTarget.dataset.callType || "voice");
          });
        messageDiv.querySelectorAll("img, video").forEach((media) => {
          media.addEventListener("load", () => positionMessageQuickActions(messageDiv), {
            once: true,
          });
          media.addEventListener("loadedmetadata", () => positionMessageQuickActions(messageDiv), {
            once: true,
          });
        });
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
      const wasEmpty = messagesArea.children.length === 0;
      messagesArea.scrollTop = shouldStickToBottom
        ? messagesArea.scrollHeight
        : previousScrollTop + (messagesArea.scrollHeight - previousHeight);
      updateJumpToBottomBtn(messagesArea);
      messagesArea._jumpListenerActive = messagesArea._jumpListenerActive || (() => {
        messagesArea.addEventListener("scroll", () => updateJumpToBottomBtn(messagesArea), { passive: true });
        return true;
      })();
      if (wasEmpty && !shouldStickToBottom && previousScrollTop === 0) scrollToFirstUnread(messagesArea);
      renderSuggestedReplies(messagesArea);
      bindRenderedMessageActions();
      // Mobile tap-to-toggle reaction tooltips
      messagesArea.querySelectorAll(".reaction-badge-wrapper").forEach((w) => {
        if (w.dataset.tooltipBound) return;
        w.dataset.tooltipBound = "true";
        w.addEventListener("click", (e) => {
          if (window.matchMedia("(hover: none)").matches) {
            const isActive = w.classList.contains("tooltip-active");
            document.querySelectorAll(".reaction-badge-wrapper.tooltip-active")
              .forEach((el) => el.classList.remove("tooltip-active"));
            if (!isActive) { e.stopPropagation(); w.classList.add("tooltip-active"); }
          }
        });
      });
      document.addEventListener("click", () => {
        document.querySelectorAll(".reaction-badge-wrapper.tooltip-active")
          .forEach((el) => el.classList.remove("tooltip-active"));
      }, { once: false, capture: false });
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
      autoTranslateCurrentChatMessages(docsToRender);
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

  const outgoingTranslation = text
    ? await prepareOutgoingAutoTranslation(text)
    : { text, originalText: "" };
  if (!outgoingTranslation) return;

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

  const messageMentions = currentChatType === "group"
    ? getMessageMentions(outgoingTranslation.text || "")
    : [];
  const hasEveryone = messageMentions.some((m) => m.isEveryone);

  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text: outgoingTranslation.text,
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
    mentions: messageMentions.filter((m) => !m.isEveryone),
    mentionEveryone: hasEveryone,
  };

  if (outgoingTranslation.originalText) {
    messageData.originalText = outgoingTranslation.originalText;
    messageData.translatedForSend = true;
    messageData.translationSourceLanguage = outgoingTranslation.sourceLanguage;
    messageData.translationTargetLanguage = outgoingTranslation.targetLanguage;
  }

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

  // Encrypt message text for direct chats
  if (currentChatType === "direct" && messageData.text && !currentAttachment?.viewOnce) {
    const peerUid = currentChat.otherUserId || currentChat.id?.split("_")?.find(id => id !== currentUser.uid);
    if (peerUid) {
      const encrypted = await encryptMessageText(messageData.text, peerUid);
      if (encrypted) {
        messageData.text = encrypted.ciphertext;
        messageData.encrypted = true;
        messageData.iv = encrypted.iv;
      }
    }
  }

  try {
    const msgRef = await db.collection("messages").add(messageData);
    const sentMsgId = msgRef.id;
    const textBytes = new Blob([outgoingTranslation.text || ""]).size;
    const attachBytes = currentAttachment?.size || 0;
    trackDataUsage(textBytes + attachBytes, "sent");

    const previewText =
      outgoingTranslation.text ||
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

    showUndoSendToast(sentMsgId);
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
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const isAudio = file.type.startsWith("audio/");
  if (isImage) {
    showPhotoEditor(file);
    return;
  }
  try {
    const url = isVideo ? await uploadRecordedMedia(file) : await uploadDocument(file);
    const duration =
      isVideo || isAudio ? await getMediaDuration(file).catch(() => 0) : 0;
    currentAttachment = {
      type: isVideo ? "video" : isAudio ? "audio" : "document",
      url,
      filename: file.name,
      size: file.size,
      duration,
    };
    setAttachmentPreview();
  } catch (e) {
    showToast("File uploading failed", "error");
  }
}

function showPhotoEditor(file) {
  closePhotoEditor();
  const modal = document.getElementById("photoEditorModal");
  if (!modal) return;
  modal.style.display = "flex";
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.getElementById("photoEditCanvas");
      const ctx = canvas.getContext("2d");
      const preview = document.getElementById("photoEditPreview");
      let crop = { x: 0, y: 0, w: img.width, h: img.height };
      let isDrawing = false, isDragging = false, dragStart = { x: 0, y: 0 };
      let drawColor = document.getElementById("photoDrawColor")?.value || "#ff0000";
      let drawSize = parseInt(document.getElementById("photoDrawSize")?.value) || 3;
      let drawPoints = [];
      let mode = "crop";
      const MAX_W = 600, MAX_H = 500;
      const scale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
      const dispW = img.width * scale, dispH = img.height * scale;
      canvas.width = dispW; canvas.height = dispH;
      crop = { x: 0, y: 0, w: img.width, h: img.height };

      function redraw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, dispW, dispH);
        if (mode === "crop") {
          const cx = crop.x * scale, cy = crop.y * scale, cw = crop.w * scale, ch = crop.h * scale;
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.fillRect(0, 0, canvas.width, cy);
          ctx.fillRect(0, cy + ch, canvas.width, canvas.height - cy - ch);
          ctx.fillRect(0, cy, cx, ch);
          ctx.fillRect(cx + cw, cy, canvas.width - cx - cw, ch);
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(cx, cy, cw, ch);
          ctx.setLineDash([]);
          for (const [px, py] of [[cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch]]) {
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#00a884";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
        if (drawPoints.length > 1 && mode === "draw") {
          ctx.strokeStyle = drawColor;
          ctx.lineWidth = drawSize;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
          for (let i = 1; i < drawPoints.length; i++) {
            ctx.lineTo(drawPoints[i].x, drawPoints[i].y);
          }
          ctx.stroke();
        }
        if (preview) {
          const outCanvas = document.createElement("canvas");
          outCanvas.width = crop.w; outCanvas.height = crop.h;
          const octx = outCanvas.getContext("2d");
          if (drawPoints.length > 1) {
            octx.drawImage(canvas, crop.x * scale, crop.y * scale, crop.w * scale, crop.h * scale, 0, 0, crop.w, crop.h);
          } else {
            octx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
          }
          preview.src = outCanvas.toDataURL("image/png");
        }
      }

      // Mode toggle
      const cropBtn = document.getElementById("photoCropBtn");
      const drawBtn = document.getElementById("photoDrawBtn");
      if (cropBtn) cropBtn.onclick = () => { mode = "crop"; cropBtn.classList.add("active"); if (drawBtn) drawBtn.classList.remove("active"); redraw(); };
      if (drawBtn) drawBtn.onclick = () => { mode = "draw"; drawBtn.classList.add("active"); if (cropBtn) cropBtn.classList.remove("active"); redraw(); };
      const colorInput = document.getElementById("photoDrawColor");
      if (colorInput) colorInput.oninput = () => { drawColor = colorInput.value; };
      const sizeInput = document.getElementById("photoDrawSize");
      if (sizeInput) sizeInput.oninput = () => { drawSize = parseInt(sizeInput.value) || 3; };

      // Mouse/touch handlers
      function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: (t.clientX - rect.left) * (canvas.width / rect.width), y: (t.clientY - rect.top) * (canvas.height / rect.height) };
      }
      canvas.onmousedown = canvas.ontouchstart = (e) => {
        e.preventDefault();
        const p = getPos(e);
        if (mode === "crop") {
          const cx = crop.x * scale, cy = crop.y * scale, cw = crop.w * scale, ch = crop.h * scale;
          const corners = [[cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch]];
          for (const [x, y] of corners) {
            if (Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10) { isDragging = true; dragStart = { x: p.x, y: p.y, cx: crop.x, cy: crop.y, cw: crop.w, ch: crop.h, corner: true }; return; }
          }
          if (p.x >= cx && p.x <= cx + cw && p.y >= cy && p.y <= cy + ch) { isDragging = true; dragStart = { x: p.x, y: p.y, cx: crop.x, cy: crop.y, cw: crop.w, ch: crop.h }; return; }
          crop = { x: Math.max(0, (p.x / scale - 50)), y: Math.max(0, (p.y / scale - 50)), w: 100, h: 100 };
          redraw();
        } else {
          isDrawing = true;
          drawPoints = [p];
        }
      };
      canvas.onmousemove = canvas.ontouchmove = (e) => {
        e.preventDefault();
        const p = getPos(e);
        if (isDragging && mode === "crop") {
          const dx = (p.x - dragStart.x) / scale, dy = (p.y - dragStart.y) / scale;
          if (dragStart.corner) {
            // Moving corner - coming soon, just drag for now
          }
          crop.x = Math.max(0, Math.min(img.width - crop.w, dragStart.cx + dx));
          crop.y = Math.max(0, Math.min(img.height - crop.h, dragStart.cy + dy));
          redraw();
        }
        if (isDrawing && mode === "draw") {
          drawPoints.push(p);
          redraw();
        }
      };
      canvas.onmouseup = canvas.ontouchend = () => { isDragging = false; isDrawing = false; };

      redraw();

      // Save
      const saveBtn = document.getElementById("photoEditSaveBtn");
      if (saveBtn) {
        saveBtn.onclick = async () => {
          const outCanvas = document.createElement("canvas");
          outCanvas.width = crop.w; outCanvas.height = crop.h;
          const octx = outCanvas.getContext("2d");
          if (drawPoints.length > 1) {
            const tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = canvas.width; tmpCanvas.height = canvas.height;
            const tctx = tmpCanvas.getContext("2d");
            tctx.drawImage(img, 0, 0, dispW, dispH);
            tctx.strokeStyle = drawColor;
            tctx.lineWidth = drawSize * scale;
            tctx.lineCap = "round"; tctx.lineJoin = "round";
            tctx.beginPath();
            tctx.moveTo(drawPoints[0].x, drawPoints[0].y);
            for (let i = 1; i < drawPoints.length; i++) tctx.lineTo(drawPoints[i].x, drawPoints[i].y);
            tctx.stroke();
            octx.drawImage(tmpCanvas, crop.x * scale, crop.y * scale, crop.w * scale, crop.h * scale, 0, 0, crop.w, crop.h);
          } else {
            octx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
          }
          outCanvas.toBlob(async (blob) => {
            if (!blob) { showToast("Failed to process image", "error"); return; }
            closePhotoEditor();
            try {
              const url = await uploadToCloudinary(new File([blob], file.name, { type: "image/png" }));
              currentAttachment = {
                type: "image",
                url,
                filename: "Edited_" + file.name,
                size: blob.size,
              };
              setAttachmentPreview();
            } catch (e) {
              showToast("Edited image upload failed", "error");
            }
          }, "image/png");
        };
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function closePhotoEditor() {
  const modal = document.getElementById("photoEditorModal");
  if (modal) modal.style.display = "none";
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
  const participantIds = [];
  if (currentChatType === "group" && hasGroupMembers) {
    currentGroupMembers.forEach((member) => participantIds.push(member.id));
  } else if (currentChatType === "direct" && currentChat?.otherUserId) {
    participantIds.push(currentChat.otherUserId);
  }
  if (Array.isArray(messageData.participants)) {
    participantIds.push(...messageData.participants);
  }
  const allIds = [
    ...new Set(
      [
        ...participantIds,
        ...Object.keys(deliveredTo),
        ...Object.keys(readBy),
      ].filter((id) => id && id !== currentUser.uid),
    ),
  ];

  const previewText = (messageData.text || "").substring(0, 120);
  const modal = document.getElementById("messageInfoModal");
  const previewEl = document.getElementById("messageInfoPreview");
  const recipientsEl = document.getElementById("messageInfoRecipients");
  previewEl.textContent = previewText || "(no text)";

  const sentTime = messageData.timestamp
    ? formatWhen(messageData.timestamp)
    : "Pending";
  let html = `<div class="message-info-summary"><strong>Sent</strong><span>${escapeHtml(sentTime)}</span></div>`;
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
  try {
    await db.collection("messages").doc(id).update({
      [`deletedFor.${currentUser.uid}`]: true,
      [`deletedForAt.${currentUser.uid}`]:
        firebase.firestore.FieldValue.serverTimestamp(),
    });
    translationCache.delete(id);
    showToast("Message deleted for you");
  } catch (error) {
    console.error("Delete for me failed:", error);
    showToast("Could not delete this message for you", "error");
  }
}
function canDeleteForEveryone(messageData) {
  // Read, delivered, and opened receipts intentionally do not affect this.
  // The original sender can remove their message for everyone at any time.
  return Boolean(
    messageData &&
      currentUser?.uid &&
      messageData.senderId === currentUser.uid &&
      !messageData.deletedForEveryone,
  );
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
  const messageRef = db.collection("messages").doc(id);
  const latestDoc = await messageRef.get().catch(() => null);
  const latestMessage = latestDoc?.exists ? latestDoc.data() : messageData;
  if (!canDeleteForEveryone(latestMessage)) {
    showToast("Only the sender can delete this message for everyone", "error");
    return;
  }
  try {
    await messageRef.update({
      text: "",
      originalText: firebase.firestore.FieldValue.delete(),
      attachment: firebase.firestore.FieldValue.delete(),
      poll: firebase.firestore.FieldValue.delete(),
      sticker: firebase.firestore.FieldValue.delete(),
      animatedSticker: firebase.firestore.FieldValue.delete(),
      linkPreview: firebase.firestore.FieldValue.delete(),
      transcript: firebase.firestore.FieldValue.delete(),
      contact: firebase.firestore.FieldValue.delete(),
      event: firebase.firestore.FieldValue.delete(),
      list: firebase.firestore.FieldValue.delete(),
      location: firebase.firestore.FieldValue.delete(),
      deletedForEveryone: true,
      deletedForEveryoneBy: currentUser.uid,
      deletedForEveryoneAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    translationCache.delete(id);
    showToast("Message deleted for everyone");
  } catch (error) {
    console.error("Delete for everyone failed:", error);
    showToast("Could not delete this message for everyone", "error");
  }
}

function ensureMessageSelectionToolbar() {
  let toolbar = document.getElementById("messageSelectionToolbar");
  if (toolbar) return toolbar;
  toolbar = document.createElement("div");
  toolbar.id = "messageSelectionToolbar";
  toolbar.className = "message-selection-toolbar";
  toolbar.innerHTML = `
    <button type="button" data-selection-action="cancel" aria-label="Cancel selection">Cancel</button>
    <strong id="messageSelectionCount">0 selected</strong>
    <button type="button" data-selection-action="all">Select all</button>
    <button type="button" data-selection-action="forward">Forward</button>
    <button type="button" data-selection-action="delete">Delete</button>`;
  toolbar.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-selection-action]")?.dataset.selectionAction;
    if (action === "cancel") clearMessageSelection();
    if (action === "all") selectAllVisibleMessages();
    if (action === "forward") openForwardModalForSelectedMessages();
    if (action === "delete") openBulkDeleteSheet();
  });
  document.body.appendChild(toolbar);
  return toolbar;
}

function updateMessageSelectionUi() {
  const count = selectedChatMessages.size;
  const selMode = document.body.classList.contains("selection-mode");
  // Hide the legacy floating toolbar when our selection bar is active
  const toolbar = document.getElementById("messageSelectionToolbar");
  if (toolbar) toolbar.classList.toggle("show", count > 0 && !selMode);
  document.querySelectorAll("[data-message-id]").forEach((element) => {
    element.classList.toggle("bulk-selected", selectedChatMessages.has(element.dataset.messageId));
  });
  // Update our selection bar
  const selBar = document.getElementById("selectionBar");
  const countEl = document.getElementById("selectionCount");
  if (selBar) {
    selBar.style.display = selMode ? "flex" : "none";
    if (countEl) countEl.textContent = count + " selected";
    selBar.querySelectorAll(".sel-action").forEach((b) => {
      b.style.display = count > 0 ? "inline-flex" : "none";
    });
  }
}

function toggleSelectedMessage(messageId, messageData) {
  if (!messageId || !messageData) return;
  if (selectedChatMessages.has(messageId)) selectedChatMessages.delete(messageId);
  else selectedChatMessages.set(messageId, { ...messageData, messageId });
  updateMessageSelectionUi();
}

function clearMessageSelection() {
  selectedChatMessages.clear();
  updateMessageSelectionUi();
}

function selectAllVisibleMessages() {
  document.querySelectorAll("#messagesArea .message[data-message-id]").forEach((element) => {
    if (element._messageData) {
      selectedChatMessages.set(element.dataset.messageId, element._messageData);
    }
  });
  updateMessageSelectionUi();
}

function openForwardModalForSelectedMessages() {
  if (!selectedChatMessages.size) return;
  currentForwardMessages = [...selectedChatMessages.values()];
  openForwardModal(currentForwardMessages[0].messageId, currentForwardMessages[0]);
}

function openBulkDeleteSheet() {
  if (!selectedChatMessages.size) return;
  closeActionSheet();
  const messages = [...selectedChatMessages.values()];
  const canDeleteAll = messages.every(canDeleteForEveryone);
  const backdrop = document.createElement("div");
  backdrop.className = "app-action-sheet-backdrop";
  backdrop.innerHTML = `
    <div class="app-action-sheet" role="dialog" aria-modal="true" aria-label="Delete selected messages">
      <div class="action-sheet-handle" aria-hidden="true"></div>
      <div class="action-sheet-heading"><strong>Delete ${messages.length} messages</strong></div>
      <button type="button" class="action-sheet-option danger delete-for-me-option">Delete for me</button>
      ${canDeleteAll ? '<button type="button" class="action-sheet-option danger delete-for-all-option">Delete for all</button>' : ""}
    </div>`;
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("show"));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeActionSheet();
  });
  backdrop.querySelector(".delete-for-me-option")?.addEventListener("click", async () => {
    closeActionSheet();
    for (const message of messages) await deleteMessageForMe(message.messageId);
    clearMessageSelection();
  });
  backdrop.querySelector(".delete-for-all-option")?.addEventListener("click", async () => {
    closeActionSheet();
    for (const message of messages) await deleteMessageForEveryone(message.messageId, message);
    clearMessageSelection();
  });
}

function closeActionSheet() {
  document.querySelector(".app-action-sheet-backdrop")?.remove();
}

function openMessageDeleteSheet(messageId, messageData) {
  closeActionSheet();
  const canDeleteAll = canDeleteForEveryone(messageData);
  const backdrop = document.createElement("div");
  backdrop.className = "app-action-sheet-backdrop";
  backdrop.innerHTML = `
    <div class="app-action-sheet" role="dialog" aria-modal="true" aria-label="Delete message">
      <div class="action-sheet-handle" aria-hidden="true"></div>
      <div class="action-sheet-heading">
        <strong>Delete message</strong>
        <span>${canDeleteAll ? "As the sender, you can delete this for everyone even after it has been read." : "Choose where this message should be removed."}</span>
      </div>
      <button type="button" class="action-sheet-option danger delete-for-me-option">Delete for me</button>
      ${canDeleteAll ? '<button type="button" class="action-sheet-option danger delete-for-all-option">Delete for all</button>' : ""}
    </div>`;
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("show"));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeActionSheet();
  });
  backdrop.querySelector(".delete-for-me-option")?.addEventListener("click", async () => {
    closeActionSheet();
    await deleteMessageForMe(messageId);
  });
  backdrop.querySelector(".delete-for-all-option")?.addEventListener("click", async () => {
    closeActionSheet();
    await deleteMessageForEveryone(messageId, messageData);
  });
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

// ===== Bookmark / Read Later =====
const BOOKMARK_CATEGORIES = ["Read Later", "Important", "Work", "Personal", "Reference"];
async function bookmarkMessage(id, data, category) {
  if (!category || !BOOKMARK_CATEGORIES.includes(category)) category = "Read Later";
  await db.collection("bookmarks").add({
    userId: currentUser.uid,
    messageId: id,
    text: data.text || getAttachmentLabel(data.attachment) || "Message",
    senderName: data.senderName || "",
    chatId: currentChat?.id || "",
    chatType: currentChatType || "",
    category: category,
    bookmarkedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast(`Bookmarked (${category})`);
}
async function removeBookmark(bookmarkId) {
  await db.collection("bookmarks").doc(bookmarkId).delete();
  showToast("Bookmark removed");
}
async function showBookmarksModal(categoryFilter) {
  if (!currentUser) return;
  let modal = document.getElementById("bookmarksModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "bookmarksModal";
    modal.className = "modal";
    modal.style.display = "none";
    modal.innerHTML = `
      <div class="modal-content" style="max-width:520px">
        <div class="modal-header">
          <h3>Bookmarks</h3>
          <span class="close-modal" id="closeBookmarksModal">&times;</span>
        </div>
        <div class="modal-body" style="padding:12px 20px">
          <div class="bookmark-tabs" id="bookmarkTabs" style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
            ${BOOKMARK_CATEGORIES.map(c => `<button class="bookmark-tab" data-cat="${c}" style="padding:4px 12px;border-radius:999px;border:1px solid var(--border);background:transparent;font-size:12px;cursor:pointer">${c}</button>`).join("")}
          </div>
          <div id="bookmarksList" style="max-height:60vh;overflow-y:auto"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById("closeBookmarksModal").addEventListener("click", () => modal.style.display = "none");
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
    document.getElementById("bookmarkTabs").addEventListener("click", (e) => {
      const tab = e.target.closest(".bookmark-tab");
      if (!tab) return;
      document.querySelectorAll(".bookmark-tab").forEach(t => t.style.background = "transparent");
      tab.style.background = "var(--brand)";
      tab.style.color = "#fff";
      tab.style.borderColor = "transparent";
      showBookmarksModal(tab.dataset.cat);
    });
  }
  const list = document.getElementById("bookmarksList");
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">Loading bookmarks...</div>';
  modal.style.display = "flex";
  try {
    let q = db.collection("bookmarks").where("userId", "==", currentUser.uid).orderBy("bookmarkedAt", "desc");
    if (categoryFilter) q = q.where("category", "==", categoryFilter);
    const snap = await q.get();
    if (snap.empty) {
      list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">No bookmarks yet. Long-press a message to bookmark it.</div>';
      return;
    }
    list.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const div = document.createElement("div");
      div.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);gap:10px";
      div.innerHTML = `
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(d.senderName || "Unknown")}</div>
          <div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(d.text || "")}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px"><span style="background:var(--panel-soft);padding:1px 6px;border-radius:999px">${escapeHtml(d.category)}</span></div>
        </div>
        <button class="bookmark-remove-btn" data-id="${doc.id}" style="flex:0 0 32px;height:32px;border:0;border-radius:50%;background:transparent;cursor:pointer;font-size:16px;color:var(--muted)" title="Remove bookmark">&times;</button>
      `;
      list.appendChild(div);
      div.querySelector(".bookmark-remove-btn").addEventListener("click", async () => {
        await removeBookmark(doc.id);
        div.remove();
        if (!list.children.length) list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">No bookmarks yet.</div>';
      });
    });
  } catch (e) {
    console.error("Failed to load bookmarks:", e);
    list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger)">Failed to load bookmarks</div>';
  }
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
  if (!selectedChatMessages.size) currentForwardMessages = [];
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
      html = `<div class="fp-media"><img src="${escapeHtml(att.url || "")}" class="fp-thumb"><span class="fp-label">${escapeHtml(att.filename || getAttachmentLabel(att))}</span></div>`;
    } else if (att.type === "voice") {
      html = `<div class="fp-media"><span class="fp-icon">🎤</span><span class="fp-label">Voice note</span></div>`;
    } else if (att.type === "video") {
      html = `<div class="fp-media"><span class="fp-icon">🎬</span><span class="fp-label">${escapeHtml(att.filename || "Video")}</span></div>`;
    } else {
      html = `<div class="fp-media"><span class="fp-icon">📎</span><span class="fp-label">${escapeHtml(att.filename || getAttachmentLabel(att))}</span></div>`;
    }
  } else if (msg.text) {
    html = `<div class="fp-text"><textarea id="forwardEditInput" class="forward-edit-input" rows="2" placeholder="Edit forwarded text...">${escapeHtml(msg.text)}</textarea></div>`;
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
      avatarHtml = `<img src="${escapeHtml(photoUrl)}" class="forward-avatar-img"><span class="forward-avatar-fallback" style="display:none;">${escapeHtml(getInitials(item.name || "Chat", item.email || ""))}</span>`;
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
  const messagesToForward = currentForwardMessages.length
    ? [...currentForwardMessages]
    : [currentForwardMessage];
  for (const message of messagesToForward) {
    currentForwardMessage = message;
    for (const item of selectedItems) {
      await forwardMessageTo(item, false);
    }
  }
  currentForwardSelectionKeys = new Set();
  currentForwardSelectionMap = new Map();
  currentForwardMessage = null;
  currentForwardMessages = [];
  clearMessageSelection();
  document.getElementById("forwardModal").style.display = "none";
  showToast(`${messagesToForward.length} message(s) forwarded to ${selectedItems.length} chat(s)`);
}

async function forwardMessageTo(chatItem, closeModal = true) {
  if (!currentForwardMessage || !chatItem || !currentUser) return;
  const editInput = document.getElementById("forwardEditInput");
  const editedText = editInput ? editInput.value.trim() : "";
  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text: editedText || currentForwardMessage.text || "",
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
  menu.className = "context-menu message-context-menu context-menu-opening";

  const reactionStrip = document.createElement("div");
  reactionStrip.className = "message-context-reactions";

  // Recent reactions row
  const recent = getRecentReactions();
  if (recent.length > 0) {
    const recentRow = document.createElement("div");
    recentRow.className = "recent-reactions-row";
    recent.forEach((emoji) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "message-context-reaction-btn recent";
      btn.textContent = emoji;
      btn.setAttribute("aria-label", `React with ${emoji}`);
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        addReaction(messageId, emoji);
        removeMessageContextMenu();
      });
      recentRow.appendChild(btn);
    });
    reactionStrip.appendChild(recentRow);
  }

  getReactionOptions().forEach((emoji) => {
    const reactionBtn = document.createElement("button");
    reactionBtn.type = "button";
    reactionBtn.className = "message-context-reaction-btn";
    reactionBtn.textContent = emoji;
    reactionBtn.setAttribute("aria-label", `React with ${emoji}`);
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
    { text: "Select", action: () => toggleSelectedMessage(messageId, messageData) },
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
    { text: "Bookmark", action: () => {
      const sheet = document.createElement("div");
      sheet.className = "app-action-sheet-backdrop";
      sheet.innerHTML = `<div class="app-action-sheet" role="dialog" aria-modal="true" aria-label="Bookmark">
        <div class="action-sheet-handle"></div>
        <div class="action-sheet-heading"><strong>Bookmark message</strong><span>Choose a category</span></div>
        ${BOOKMARK_CATEGORIES.map(c => `<button type="button" class="action-sheet-option bookmark-cat-option" data-cat="${c}">${c}</button>`).join("")}
      </div>`;
      document.body.appendChild(sheet);
      requestAnimationFrame(() => sheet.classList.add("show"));
      sheet.addEventListener("click", (e) => {
        const opt = e.target.closest(".bookmark-cat-option");
        if (opt) { bookmarkMessage(messageId, messageData, opt.dataset.cat); closeActionSheet(); }
        if (e.target === sheet) closeActionSheet();
      });
    }},
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
  window.setTimeout(() => menu.classList.remove("context-menu-opening"), 220);
}

function removeMessageContextMenu() {
  const existing = document.querySelector(".message-context-menu");
  if (existing) existing.remove();
  document.body.classList.remove("message-menu-open");
}

function positionContextMenu(menu, x, y) {
  if (!menu) return;
  const margin = 12;
  const touchBottomInset = window.matchMedia?.("(pointer: coarse)").matches
    ? 72
    : 0;
  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const viewportOffsetLeft = window.visualViewport?.offsetLeft || 0;
  const viewportOffsetTop = window.visualViewport?.offsetTop || 0;
  menu.style.display = "block";
  menu.style.left = "0px";
  menu.style.top = "0px";
  menu.style.maxHeight = `${Math.max(180, viewportHeight - margin * 2 - touchBottomInset)}px`;
  const rect = menu.getBoundingClientRect();
  const leftMin = viewportOffsetLeft + margin;
  const leftMax = viewportOffsetLeft + viewportWidth - rect.width - margin;
  const left = Math.min(
    Math.max(leftMin, x),
    Math.max(leftMin, leftMax),
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
  updateComposeCounter();
}

function updateComposeCounter() {
  const counter = document.getElementById("composeCounter");
  if (!counter) return;
  const input = document.getElementById("messageInput");
  const val = input?.value || "";
  if (!val.trim()) { counter.textContent = ""; return; }
  const chars = val.length;
  const lines = val.split("\n").length;
  if (chars > 200) {
    counter.textContent = `${chars} / 4096`;
  } else if (lines > 1) {
    counter.textContent = `${lines} lines`;
  } else {
    counter.textContent = "";
  }
}

function triggerDocumentPicker() {
  toggleAttachmentSheet(false);
  const input = document.getElementById("fileInput");
  if (!input) return;
  input.removeAttribute("capture");
  input.accept =
    "audio/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,.csv,.zip,.rar";
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
  if (!currentUser) return;
  await db.collection("users").doc(currentUser.uid).set({ privacySettings }, { merge: true });
  await db.collection("userProfiles").doc(currentUser.uid).set(
    {
      privacy: {
        lastSeen: privacySettings.lastSeen || (privacySettings.hideLastSeen ? "nobody" : "everyone"),
        readReceipts: !privacySettings.hideReadReceipts,
        typingIndicator: !privacySettings.hideTypingIndicator,
      },
    },
    { merge: true },
  );
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
  const lpToggle = document.getElementById("linkPreviewToggle");
  if (lpToggle) lpToggle.checked = getLinkPreviewSetting();
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

// Permission functions moved to permissions-manager.js

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
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    const labels = {
      all: "Search for Users and Messages",
      unread: "Search unread chats and messages",
      groups: "Search groups",
      calls: "Search call history",
      status: "Search status updates",
      favorites: "Search favorite chats",
      muted: "Search muted chats",
      broadcasts: "Search broadcasts",
      communities: "Search communities",
      notifications: "Search alerts",
    };
    searchInput.placeholder = labels[tab] || "Search";
    searchInput.value = "";
    updateMainSearchClearButton();
  }
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.add("active");
  const moreTabsBtn = document.getElementById("moreTabsBtn");
  if (moreTabsBtn) {
    moreTabsBtn.classList.toggle(
      "active",
      ["favorites", "muted", "broadcasts", "communities", "notifications"].includes(tab),
    );
  }

  const chatsList = document.getElementById("chatsList");
  const groupsList = document.getElementById("groupsList");
  const broadcastsList = document.getElementById("broadcastsList");
  const statusList = document.getElementById("statusList");
  const callsList = document.getElementById("callsList");
  const communitiesList = document.getElementById("communitiesList");
  const statusActions = document.getElementById("statusActions");
  const groupActions = document.getElementById("groupActions");
  const broadcastActions = document.getElementById("broadcastActions");
  const communityActions = document.getElementById("communityActions");

  // FIX 4c: hide/show notifications panel
  const notifPanel = document.getElementById("notificationsPanel");
  if (notifPanel) notifPanel.style.display = tab === "notifications" ? "block" : "none";

  chatsList.style.display =
    tab === "groups" ||
    tab === "status" ||
    tab === "broadcasts" ||
    tab === "calls" ||
    tab === "communities" ||
    tab === "notifications"
      ? "none"
      : "block";
  groupsList.style.display = tab === "groups" ? "block" : "none";
  if (broadcastsList)
    broadcastsList.style.display = tab === "broadcasts" ? "block" : "none";
  if (statusList)
    statusList.style.display = tab === "status" ? "block" : "none";
  if (callsList)
    callsList.style.display = tab === "calls" ? "block" : "none";
  if (communitiesList)
    communitiesList.style.display = tab === "communities" ? "block" : "none";
  if (groupActions)
    groupActions.style.display = tab === "groups" ? "flex" : "none";
  if (broadcastActions)
    broadcastActions.style.display = tab === "broadcasts" ? "flex" : "none";
  if (statusActions)
    statusActions.style.display =
      tab === "status" &&
      statusList?.dataset.loaded === "true" &&
      !statusList.querySelector(".empty-add-status")
        ? "flex"
        : "none";
  if (communityActions)
    communityActions.style.display = tab === "communities" ? "flex" : "none";

  const markAllReadBar = document.getElementById("markAllReadBar");
  // Hide bar on tabs where it doesn't belong; updateUnreadBadges manages the rest
  if (markAllReadBar && tab !== "all" && tab !== "unread") {
    markAllReadBar.style.display = "none";
  }

  if (tab === "groups") loadGroupsList();
  else if (tab === "broadcasts") loadBroadcastsList();
  else if (tab === "status") loadStatusList();
  else if (tab === "calls") loadCallsList();
  else if (tab === "communities") loadCommunitiesList();
  else if (tab === "notifications") {
    renderInAppNotifications(currentInAppNotifications);
    markAllNotificationsRead();
  }
  else loadCurrentChatList();
}

function bindSearchInput() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  let searchTimer = null;

  input.addEventListener("input", (e) => {
    updateMainSearchClearButton();
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => searchUsersRealtime(e.target.value), 220);
  });

  // FIX 1: Enter key forces an immediate full search (important for email lookup)
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(searchTimer);
      updateMainSearchClearButton();
      searchUsersRealtime(input.value);
    }
  });
  document.getElementById("clearSearchInputBtn")?.addEventListener("click", () => {
    input.value = "";
    updateMainSearchClearButton();
    ++chatSearchToken;
    searchUsersRealtime("");
    input.focus();
  });
  updateMainSearchClearButton();
}

function updateMainSearchClearButton() {
  const input = document.getElementById("searchInput");
  const clearButton = document.getElementById("clearSearchInputBtn");
  if (!input || !clearButton) return;
  clearButton.classList.toggle("show", Boolean(input.value.trim()));
}

function updateInChatSearch() {
  const term = (document.getElementById("inChatSearchInput")?.value || "")
    .trim()
    .toLowerCase();

  // Remove text-level search highlights
  document
    .querySelectorAll(".search-highlight")
    .forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
      }
    });

  document
    .querySelectorAll(".message.search-hit, .message.search-current")
    .forEach((el) => {
      el.classList.remove("search-hit", "search-current");
    });
  currentSearchResults = [];
  currentSearchIndex = 0;
  currentInChatSearchTerm = term;
  if (!term) {
    document.getElementById("searchResultCount").textContent = "";
    document.getElementById("prevSearchBtn").disabled = true;
    document.getElementById("nextSearchBtn").disabled = true;
    return;
  }
  currentSearchResults = [
    ...document.querySelectorAll("#messagesArea .message"),
  ].filter((el) => el.textContent.toLowerCase().includes(term));
  currentSearchResults.forEach((el) => el.classList.add("search-hit"));

  // Highlight matching text within message-text elements
  currentSearchResults.forEach((el) => {
    const textEl = el.querySelector(".message-text");
    if (!textEl) return;
    const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT, null, false);
    const markNodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const lower = node.textContent.toLowerCase();
      let idx = 0;
      while ((idx = lower.indexOf(term, idx)) !== -1) {
        markNodes.push({ node, start: idx, end: idx + term.length });
        idx += term.length;
      }
    }
    // Apply marks from end to preserve positions
    markNodes.reverse().forEach(({ node, start, end }) => {
      const after = node.splitText(end);
      const mid = node.splitText(start);
      const mark = document.createElement("mark");
      mark.className = "search-highlight";
      mark.textContent = mid.textContent;
      mid.parentNode.replaceChild(mark, mid);
    });
  });

  focusCurrentSearchResult();
}

function focusCurrentSearchResult() {
  const count = currentSearchResults.length;
  const countEl = document.getElementById("searchResultCount");
  const previousButton = document.getElementById("prevSearchBtn");
  const nextButton = document.getElementById("nextSearchBtn");
  const disabled = count < 2;
  if (previousButton) previousButton.disabled = disabled;
  if (nextButton) nextButton.disabled = disabled;
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

const APP_LOCK_STORAGE_KEY = "teamChatAppLockPin";
const APP_LOCK_ITERATIONS = 120000;

function getStoredAppLockPin() {
  try {
    return localStorage.getItem(APP_LOCK_STORAGE_KEY) || "";
  } catch (_) {
    return "";
  }
}

async function setStoredAppLockPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pinHash = await deriveChatLockPin(pin, salt, APP_LOCK_ITERATIONS);
  const settings = {
    version: 2,
    pinHash,
    pinSalt: bytesToBase64(salt),
    pinIterations: APP_LOCK_ITERATIONS,
  };
  try {
    localStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(settings));
  } catch (_) {}
  return settings;
}

function clearStoredAppLockPin() {
  try {
    localStorage.removeItem(APP_LOCK_STORAGE_KEY);
  } catch (_) {}
}

async function saveRemoteAppLockSettings(settings) {
  if (!currentUser || !settings?.pinHash || !settings?.pinSalt) return;
  await db.collection("appLockSettings").doc(currentUser.uid).set({
    userId: currentUser.uid,
    version: settings.version || 2,
    pinHash: settings.pinHash,
    pinSalt: settings.pinSalt,
    pinIterations: settings.pinIterations || APP_LOCK_ITERATIONS,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function loadRemoteAppLockSettings() {
  if (!currentUser) return null;
  try {
    const doc = await db.collection("appLockSettings").doc(currentUser.uid).get();
    if (!doc.exists) return null;
    const data = doc.data() || {};
    if (data.userId !== currentUser.uid || !data.pinHash || !data.pinSalt) return null;
    const settings = {
      version: data.version || 2,
      pinHash: data.pinHash,
      pinSalt: data.pinSalt,
      pinIterations: data.pinIterations || APP_LOCK_ITERATIONS,
    };
    try {
      localStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {}
    return settings;
  } catch (error) {
    console.warn("Remote app lock load failed:", error);
    return null;
  }
}

async function deleteRemoteAppLockSettings() {
  if (!currentUser) return;
  try {
    await db.collection("appLockSettings").doc(currentUser.uid).delete();
  } catch (error) {
    console.warn("Remote app lock delete failed:", error);
  }
}

function lockAppNowIfEnabled() {
  const pin = getStoredAppLockPin();
  if (!pin) return;
  appUnlockedForSession = false;
  const input = document.getElementById("unlockPinInput");
  const error = document.getElementById("unlockAppError");
  if (input) input.value = "";
  if (error) error.textContent = "";
  showModal("unlockModal");
  window.setTimeout(() => input?.focus(), 100);
}

async function verifyStoredAppLockPin(pin) {
  const stored = getStoredAppLockPin();
  if (!stored || !/^\d{4}$/.test(pin)) return false;
  if (/^\d{4}$/.test(stored)) {
    if (pin !== stored) return false;
    const settings = await setStoredAppLockPin(pin);
    await saveRemoteAppLockSettings(settings);
    return true;
  }
  try {
    const settings = JSON.parse(stored);
    if (!settings?.pinHash || !settings?.pinSalt) return false;
    const candidate = await deriveChatLockPin(
      pin,
      base64ToBytes(settings.pinSalt),
      settings.pinIterations || APP_LOCK_ITERATIONS,
    );
    return candidate === settings.pinHash;
  } catch (_) {
    return false;
  }
}

async function unlockAppAttempt() {
  if (!getStoredAppLockPin()) return;
  const input = document.getElementById("unlockPinInput");
  const value = (input?.value || "").trim();
  if (!(await verifyStoredAppLockPin(value))) {
    const error = document.getElementById("unlockAppError");
    if (error) error.textContent = "Incorrect PIN. Try again.";
    if (input) {
      input.value = "";
      input.focus();
    }
    return;
  }
  appUnlockedForSession = true;
  if (input) input.value = "";
  hideModal("unlockModal");
}

function showAppLockModal() {
  const enabled = Boolean(getStoredAppLockPin());
  showModal("appLockModal");
  const input = document.getElementById("appLockPinInput");
  const currentInput = document.getElementById("appLockCurrentPinInput");
  const currentField = document.getElementById("appLockCurrentField");
  const confirmInput = document.getElementById("appLockConfirmPinInput");
  const confirmField = document.getElementById("appLockConfirmField");
  const helper = document.getElementById("appLockHelper");
  const saveButton = document.getElementById("saveAppLockPinBtn");
  const disableButton = document.getElementById("disableAppLockBtn");
  const error = document.getElementById("appLockError");
  if (input) input.value = "";
  if (currentInput) currentInput.value = "";
  if (currentField) currentField.style.display = enabled ? "grid" : "none";
  if (confirmInput) confirmInput.value = "";
  if (confirmField) confirmField.style.display = "grid";
  if (helper) helper.textContent = enabled
    ? "App lock is enabled. Confirm the current PIN before changing or disabling it."
    : "Set a 4-digit PIN. The app locks whenever you leave it and must be unlocked when you return.";
  if (saveButton) saveButton.textContent = enabled ? "Change PIN" : "Enable lock";
  if (disableButton) disableButton.style.display = enabled ? "inline-flex" : "none";
  if (error) error.textContent = "";
  window.setTimeout(() => (enabled ? currentInput : input)?.focus(), 0);
}

async function saveAppLockPin() {
  const input = document.getElementById("appLockPinInput");
  const currentInput = document.getElementById("appLockCurrentPinInput");
  const confirmInput = document.getElementById("appLockConfirmPinInput");
  const error = document.getElementById("appLockError");
  const pin = (input?.value || "").trim();
  const currentPin = (currentInput?.value || "").trim();
  const confirmation = (confirmInput?.value || "").trim();
  if (!/^\d{4}$/.test(pin)) {
    if (error) error.textContent = "Enter exactly 4 digits.";
    return;
  }
  if (pin !== confirmation) {
    if (error) error.textContent = "The PINs do not match.";
    return;
  }
  if (getStoredAppLockPin() && !(await verifyStoredAppLockPin(currentPin))) {
    if (error) error.textContent = "The current PIN is incorrect.";
    currentInput?.focus();
    return;
  }
  if (!globalThis.crypto?.subtle) {
    if (error) error.textContent = "Secure app lock is unavailable on this device.";
    return;
  }
  const settings = await setStoredAppLockPin(pin);
  try {
    await saveRemoteAppLockSettings(settings);
  } catch (saveError) {
    console.error("Remote app lock save failed:", saveError);
    if (error) error.textContent = "Could not save app lock. Check connection and try again.";
    return;
  }
  showToast("App lock enabled");
  hideModal("appLockModal");
  lockAppNowIfEnabled();
}

async function disableAppLock() {
  const input = document.getElementById("appLockCurrentPinInput");
  const error = document.getElementById("appLockError");
  const pin = (input?.value || "").trim();
  if (!(await verifyStoredAppLockPin(pin))) {
    if (error) error.textContent = "Enter the current PIN to disable app lock.";
    input?.focus();
    return;
  }
  clearStoredAppLockPin();
  await deleteRemoteAppLockSettings();
  appUnlockedForSession = true;
  showToast("App lock disabled");
  hideModal("appLockModal");
}

function redirectToLogin() {
  document.body.classList.remove("auth-ready");
  window.location.replace("login.html");
}

function showStartupRecovery(message = "Team Chat could not finish starting.") {
  const gate = document.getElementById("authGate");
  if (!gate) return;
  gate.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "auth-gate-recovery";
  const text = document.createElement("p");
  text.textContent = message;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Retry";
  retry.addEventListener("click", () => window.location.reload());
  panel.append(text, retry);
  gate.appendChild(panel);
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
  const authStateTimeout = window.setTimeout(() => {
    if (!document.body.classList.contains("auth-ready")) {
      showStartupRecovery(
        "Session checking is taking longer than expected. Check your connection and retry.",
      );
    }
  }, 15000);
  auth.onAuthStateChanged(async (user) => {
    window.clearTimeout(authStateTimeout);
    if (!user) {
      cleanupAllFirestoreListeners();
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
      handlePendingWebCallAction().catch((error) =>
        console.warn("Could not process notification call action:", error),
      );
      restoreCallStateIfNeeded().catch((error) =>
        console.warn("Could not restore call state:", error),
      );
      currentSessionId = getOrCreateSessionId();
      revealAuthenticatedApp();
      requestNativeNotificationPermission();
      initE2EKeys().catch(e => console.warn("E2E init error:", e));
      // Check two-step verification
      const tsv = getTwoStepVerification();
      if (tsv.pin && !sessionStorage.getItem("tsv_verified")) {
        showTSVPrompt();
      }

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
      await runBootstrapStep("ensureGroupAccessMetadata", () =>
        ensureGroupAccessMetadata(),
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
      const pendingNotificationChatUserId = localStorage.getItem(
        "pendingNotificationChatUserId",
      );
      if (pendingNotificationChatUserId) {
        await runBootstrapStep("openPendingNotificationChat", () =>
          openDirectChatFromNotification(pendingNotificationChatUserId),
        );
      }
      const pendingNotificationGroupId = localStorage.getItem(
        "pendingNotificationGroupId",
      );
      if (pendingNotificationGroupId) {
        await runBootstrapStep("openPendingNotificationGroup", () =>
          openGroupChatFromNotification(pendingNotificationGroupId),
        );
      }
      await runBootstrapStep("handlePendingDirectChatOpen", () =>
        handlePendingDirectChatOpen(),
      );
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
      await runBootstrapStep("setupMainNavigationLiveListeners", async () => {
        setupMainNavigationLiveListeners();
      });
      await runBootstrapStep("setupInAppNotificationsListener", async () => {
        setupInAppNotificationsListener(); // FIX 4d
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
      handlePendingNavigationTab();
      await runBootstrapStep("loadRemoteAppLockSettings", () =>
        loadRemoteAppLockSettings(),
      );
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
  document.getElementById("sendBtn")?.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openScheduleModal();
  });
  document.getElementById("jumpToBottomBtn")?.addEventListener("click", () => {
    const area = document.getElementById("messagesArea");
    if (area) { area.scrollTo({ top: area.scrollHeight, behavior: "smooth" }); }
  });
  document.getElementById("messageInput")?.addEventListener("keydown", (e) => {
    if (handleMentionKeydown(e)) return;
    if (e.key === "Escape") hideMentionSuggestions();
    const enterSends = localStorage.getItem("tc_enter_to_send") !== "false";
    if (e.key === "Enter" && (enterSends ? !e.shiftKey : e.shiftKey)) {
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
      if (inEditable) return;
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
    }
  });
  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest(".close-modal, [data-dismiss='modal']");
    if (!closeBtn) return;
    const modal = closeBtn.closest(".modal, .chat-lock-modal-backdrop, .app-lock-backdrop");
    if (!modal || modal.id === "unlockModal" && !appUnlockedForSession) return;
    if (modal.id === "callModal" && hasLiveCallSession()) return;
    e.preventDefault();
    hideModal(modal.id);
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
  document.getElementById("enterToSendToggle")?.addEventListener("change", (e) => {
    localStorage.setItem("tc_enter_to_send", e.target.checked);
  });
  document.getElementById("compactModeToggle")?.addEventListener("change", (e) => {
    localStorage.setItem("tc_compact_mode", e.target.checked);
    document.body.classList.toggle("compact-mode", e.target.checked);
  });
  if (localStorage.getItem("tc_compact_mode") === "true") {
    document.body.classList.add("compact-mode");
    const cmp = document.getElementById("compactModeToggle");
    if (cmp) cmp.checked = true;
  }
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
  })();
  document.getElementById("cancelReplyBtn")?.addEventListener("click", () => {
    currentReplyTo = null;
    document.getElementById("replyPreviewBar").style.display = "none";
  });
  document.getElementById("searchChatBtn")?.addEventListener("click", () => {
    document.getElementById("inChatSearchBar").style.display = "flex";
    document.getElementById("prevSearchBtn").disabled = true;
    document.getElementById("nextSearchBtn").disabled = true;
    document.getElementById("inChatSearchInput")?.focus();
  });
  document.getElementById("selectModeBtn")?.addEventListener("click", () => {
    document.body.classList.toggle("selection-mode");
    const active = document.body.classList.contains("selection-mode");
    document.getElementById("selectModeBtn")?.classList.toggle("active", active);
    document.getElementById("selectModeBtn")?.classList.toggle("selected", active);
    if (!active) clearMessageSelection();
    updateMessageSelectionUi();
  });
  document.getElementById("selectionCancelBtn")?.addEventListener("click", () => {
    document.body.classList.remove("selection-mode");
    document.getElementById("selectModeBtn")?.classList.remove("active", "selected");
    clearMessageSelection();
    updateMessageSelectionUi();
  });
  document.querySelectorAll("#selectionBar .sel-action").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.selAction;
      if (action === "forward") openForwardModalForSelectedMessages();
      else if (action === "delete") openBulkDeleteSheet();
      else if (action === "star") {
        selectedChatMessages.forEach((msg, id) => {
          bookmarkMessage(id, msg.text || "");
        });
        showToast(`Starred ${selectedChatMessages.size} messages`);
        clearMessageSelection();
        updateMessageSelectionUi();
      }
    });
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
    document.getElementById("dateSearchInput").value = "";
    document.getElementById("clearDateSearch")?.classList.remove("show");
    searchMessagesByDate("");
    updateInChatSearch();
  });
  // Formatting toolbar
  initFormatToolbar();
  // Chat folders
  initFolders();
  // Scheduled messages
  initScheduledMessages();
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
    const callType = document.getElementById("eventCallType")?.value || "";
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
    sendEventMessage({ title, date, time, description, location, callType });
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
  document
    .getElementById("sendRecordedMediaBtn")
    ?.addEventListener("click", sendPendingRecordedMedia);
  document
    .getElementById("cancelRecordedMediaBtn")
    ?.addEventListener("click", closeRecordedMediaPreview);
  document
    .querySelectorAll(".closeRecordedMediaPreview")
    .forEach((btn) => btn.addEventListener("click", closeRecordedMediaPreview));
  document.getElementById("emojiBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleEmojiSheet();
  });
  document
    .querySelectorAll(".tab[data-tab]")
    .forEach((t) =>
      t.addEventListener("click", () => switchTab(t.dataset.tab)),
    );
  document.getElementById("moreTabsBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById("moreTabsModal").style.display = "flex";
  });
  document.querySelectorAll(".closeMoreTabsModal").forEach((button) =>
    button.addEventListener("click", () => {
      document.getElementById("moreTabsModal").style.display = "none";
    }),
  );
  document.querySelectorAll(".more-tab-option").forEach((button) =>
    button.addEventListener("click", () => {
      document.getElementById("moreTabsModal").style.display = "none";
      switchTab(button.dataset.moreTab);
    }),
  );
  document.getElementById("moreTabsModal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.style.display = "none";
  });
  document
    .getElementById("profileBtn")
    ?.addEventListener("click", showProfileModal);
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    cleanupAllFirestoreListeners();
    stopSessionHeartbeat();
    clearInterval(chatListRefreshTimer);
    clearInterval(scheduledMessagesTimer);
    clearInterval(statusRefreshTimer);
    clearInterval(presenceHeartbeatTimer);
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
      const callIdMatch = url.match(/[?&]callId=([^&]+)/);
      const actionMatch = url.match(/[?&]action=([^&]+)/);
      const chatUserIdMatch = url.match(/[?&]chatUserId=([^&]+)/);
      const groupIdMatch = url.match(/[?&]groupId=([^&]+)/);
      const tabMatch = url.match(/[?&]tab=([^&]+)/);
      if (callIdMatch?.[1]) {
        const callId = decodeURIComponent(callIdMatch[1]);
        const action = decodeURIComponent(actionMatch?.[1] || "accept");
        if (action === "reject") await autoRejectNativeCall(callId);
        else await autoAcceptNativeCall(callId);
      } else if (chatUserIdMatch?.[1]) {
        const chatUserId = decodeURIComponent(chatUserIdMatch[1]);
        await openDirectChatFromNotification(chatUserId);
      } else if (groupIdMatch?.[1]) {
        await openGroupChatFromNotification(decodeURIComponent(groupIdMatch[1]));
      } else if (tabMatch?.[1]) {
        switchTab(decodeURIComponent(tabMatch[1]));
      }
    });

    window.Capacitor.Plugins.App.getLaunchUrl?.().then(async (result) => {
      const url = result?.url || "";
      const chatUserIdMatch = url.match(/[?&]chatUserId=([^&]+)/);
      const groupIdMatch = url.match(/[?&]groupId=([^&]+)/);
      const tabMatch = url.match(/[?&]tab=([^&]+)/);
      if (chatUserIdMatch?.[1]) {
        await openDirectChatFromNotification(
          decodeURIComponent(chatUserIdMatch[1]),
        );
      } else if (groupIdMatch?.[1]) {
        await openGroupChatFromNotification(decodeURIComponent(groupIdMatch[1]));
      } else if (tabMatch?.[1]) {
        switchTab(decodeURIComponent(tabMatch[1]));
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
    if (activeCall?.groupCall) endGroupCall("declined");
    else endActiveCall("declined");
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
    .querySelectorAll(".closeProfileModal")
    .forEach((b) =>
      b.addEventListener(
        "click",
        () => (document.getElementById("profileModal").style.display = "none"),
      ),
    );
  document.getElementById("profileModal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = "none";
  });
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
    .getElementById("bookmarksBtn")
    ?.addEventListener("click", () => showBookmarksModal());
  document
    .getElementById("scheduledMessagesBtn")
    ?.addEventListener("click", showScheduledMessagesModal);
  document
    .getElementById("activeSessionsBtn")
    ?.addEventListener("click", showSessionsModal);
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
        () => hideModal("appLockModal"),
      ),
    );
  document
    .querySelectorAll(".closeChatLockModal")
    .forEach((btn) =>
      btn.addEventListener("click", () => hideChatLockModal()),
    );
  document
    .querySelectorAll(".closeChatLockSetupModal")
    .forEach((btn) =>
      btn.addEventListener("click", () => hideChatLockSetupModal()),
    );
  document
    .querySelectorAll(".closeChatLockResetModal")
    .forEach((btn) =>
      btn.addEventListener("click", () => hideChatLockResetModal()),
    );
  document
    .getElementById("chatLockResetConfirmBtn")
    ?.addEventListener("click", handleChatLockReset);
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
    if (document.visibilityState === "visible") {
      if (getStoredAppLockPin()) lockAppNowIfEnabled();
    } else {
      // Re-lock temporarily unlocked chat when app goes to background
      if (temporarilyUnlockedChatId) relockTemporarilyUnlockedChat();
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
    .getElementById("twoStepVerificationBtn")
    ?.addEventListener("click", showTwoStepVerificationModal);
  document
    .getElementById("autoDownloadBtn")
    ?.addEventListener("click", showAutoDownloadModal);
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
      document
        .getElementById("clearDateSearch")
        ?.classList.toggle("show", Boolean(e.target.value));
      searchMessagesByDate(e.target.value);
    });
  document.getElementById("clearDateSearch")?.addEventListener("click", () => {
    document.getElementById("dateSearchInput").value = "";
    document.getElementById("clearDateSearch")?.classList.remove("show");
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
  document.getElementById("linkPreviewToggle")?.addEventListener("change", (event) => {
    try { localStorage.setItem("wa_link_preview_enabled", event.target.checked ? "true" : "false"); } catch {}
    showToast(event.target.checked ? "Link previews enabled" : "Link previews disabled");
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
      if (event.target.closest("video, button, a")) return;
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
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          showToast("Choose an image or video", "error");
          return;
        }
        if (file.type.startsWith("video/")) {
          const duration = await getMediaDuration(file);
          if (duration > 60) {
            showToast("Status videos must be 60 seconds or shorter", "error");
            return;
          }
        }
         const url = file.type.startsWith("video/")
          ? await uploadRecordedMedia(file)
          : await uploadToCloudinary(file);
        statusImageAttachment = {
          type: file.type.startsWith("video/") ? "video" : "image",
          url,
          filename: file.name,
          size: file.size,
        };
        const preview = document.getElementById("statusImagePreview");
        preview.innerHTML = statusImageAttachment.type === "video"
          ? `<video src="${url}" controls playsinline></video>`
          : `<img src="${url}" alt="">`;
        preview.style.display = "block";
      } catch (error) {
        showToast("Status media upload failed", "error");
      } finally {
        event.target.value = "";
      }
    });
  document.querySelectorAll(".closeForwardModal").forEach((btn) =>
    btn.addEventListener("click", () => {
      currentForwardMessage = null;
      currentForwardMessages = [];
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

  // Setup Modals - Create Group (WhatsApp-style step wizard)
  const createGroupModal = document.getElementById("createGroupModal");
  document.getElementById("createGroupBtn")?.addEventListener("click", () => {
    openCreateGroupModal();
  });
  document
    .querySelectorAll(".closeCreateModal, .cancelGroupBtn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        createGroupModal.style.display = "none";
      });
    });
  document.getElementById("createGroupNextBtn")?.addEventListener("click", () => {
    if (createGroupState.selectedMembers.length === 0) {
      showToast("Please select at least one member", "error");
      return;
    }
    showCreateGroupStep(2);
  });
  document.getElementById("createGroupBackBtn")?.addEventListener("click", () => {
    showCreateGroupStep(1);
  });
  document.getElementById("createGroupConfirmBtn")?.addEventListener("click", async () => {
    const groupName = document.getElementById("newGroupName")?.value?.trim();
    if (!groupName) {
      showToast("Please enter a group name", "error");
      return;
    }
    await createGroup();
  });
  // Member search in step 1
  document.getElementById("newGroupMembersSearch")?.addEventListener("input", function() {
    const term = this.value.toLowerCase().trim();
    const results = document.getElementById("memberSearchResults");
    if (!results) return;
    if (!term) { results.style.display = "none"; return; }
    const filtered = allUsers.filter((u) => u.id !== currentUser.uid && !isBlocked(u.id) &&
      ((u.displayName || "").toLowerCase().includes(term) || (u.email || "").toLowerCase().includes(term)));
    results.style.display = "block";
    results.innerHTML = filtered.length ? filtered.map((u) => {
      const isSelected = createGroupState.selectedMembers.some((m) => m.id === u.id);
      return `<div class="member-search-item${isSelected ? " selected" : ""}" data-id="${u.id}">
        <div class="member-check">${isSelected ? "✓" : ""}</div>
        <div class="gi-member-avatar">${u.avatar ? `<img src="${u.avatar}" style="width:36px;height:36px;border-radius:50%;">` : (u.displayName?.[0]?.toUpperCase() || "U")}</div>
        <div><strong>${escapeHtml(u.displayName || u.email)}</strong><br><span style="font-size:11px;color:var(--muted);">${escapeHtml(u.email || "")}</span></div>
      </div>`;
    }).join("") : '<div style="padding:16px;text-align:center;font-size:13px;color:var(--muted);">No contacts found</div>';
    results.querySelectorAll(".member-search-item").forEach((el) => {
      el.onclick = () => {
        const user = allUsers.find((u) => u.id === el.dataset.id);
        if (user) toggleCreateGroupMember(user);
        this.value = "";
        results.style.display = "none";
      };
    });
  });
  document.getElementById("createGroupAvatar")?.addEventListener("click", () => {
    document.getElementById("createGroupIconInput")?.click();
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
  document.getElementById("groupInfoModal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = "none";
  });
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
  document.getElementById("chatInfoModal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = "none";
  });
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
  document.getElementById("chatInfoMarkUnreadBtn")?.addEventListener("click", async () => {
    if (!currentChat) return;
    await markChatReadState(
      currentChatType === "direct" ? (currentChat.aliasDirectIds || currentChat.id) : currentChat.id,
      currentChatType,
      false,
    );
    document.getElementById("chatInfoModal").style.display = "none";
  });
  document.getElementById("groupInfoMarkUnreadBtn")?.addEventListener("click", async () => {
    if (!currentGroup?.id) return;
    await markChatReadState(currentGroup.id, "group", false);
    document.getElementById("groupInfoModal").style.display = "none";
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
  document.querySelectorAll(".chat-color-swatch").forEach((sw) =>
    sw.addEventListener("click", () => {
      const color = sw.dataset.color || "";
      document.querySelectorAll(".chat-color-swatch").forEach((s) => s.classList.remove("selected"));
      sw.classList.add("selected");
      if (currentChat) {
        const chatColors = JSON.parse(localStorage.getItem("chatColors") || "{}");
        if (color) chatColors[currentChat.id] = color;
        else delete chatColors[currentChat.id];
        localStorage.setItem("chatColors", JSON.stringify(chatColors));
        applyCurrentChatAccent();
        if (typeof renderMessageList === "function") renderMessageList();
      }
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

// ===== Export Chat as PDF =====
async function exportChatAsPDF() {
  if (!currentChat) { showToast("Open a chat first", "error"); return; }
  const chatName = currentChat.name || "Chat";
  const messages = await getCurrentChatMessages();
  if (!messages.length) { showToast("No messages to export", "error"); return; }

  const win = window.open("", "_blank");
  if (!win) { showToast("Please allow pop-ups for PDF export", "error"); return; }

  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  let bodyHtml = messages.map(msg => {
    const sender = escapeHtml(msg.senderName || "Unknown");
    const text = escapeHtml(msg.text || "");
    const time = msg.timestamp?.toDate?.()?.toLocaleString() || "";
    const isMine = msg.senderId === currentUser?.uid;
    const side = isMine ? "right" : "left";
    const bg = isMine ? "#d9fdd3" : "#ffffff";
    return `<div style="text-align:${side};margin:6px 0"><div style="display:inline-block;max-width:80%;padding:8px 12px;border-radius:8px;background:${bg};box-shadow:0 1px 1px rgba(0,0,0,0.1);text-align:left"><div style="font-size:12px;font-weight:700;color:#008069;margin-bottom:2px">${sender}</div><div style="font-size:14px;color:#111b21">${text}</div><div style="font-size:10px;color:#667781;margin-top:4px;text-align:right">${time}</div></div></div>`;
  }).join("\n");

  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(chatName)} - Chat Export</title><style>
    @page { margin: 15mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #f0f2f5; padding: 20px; color: #111b21; }
    .header { text-align: center; padding: 20px 0 16px; border-bottom: 2px solid #008069; margin-bottom: 20px; }
    .header h1 { font-size: 22px; color: #008069; }
    .header p { font-size: 12px; color: #667781; margin-top: 4px; }
    .footer { text-align: center; padding: 16px 0; margin-top: 20px; border-top: 1px solid #e9edef; font-size: 10px; color: #667781; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style></head><body>
    <div class="header"><h1>${escapeHtml(chatName)}</h1><p>Exported on ${dateStr} &middot; ${messages.length} messages</p></div>
    ${bodyHtml}
    <div class="footer">Generated by Team Chat &middot; ${messages.length} messages</div>
    <div class="no-print" style="text-align:center;padding:20px"><button onclick="window.print()" style="padding:10px 28px;border:0;border-radius:999px;background:#008069;color:#fff;font-size:15px;font-weight:700;cursor:pointer">Save as PDF</button> <button onclick="window.close()" style="padding:10px 28px;border:1px solid #e9edef;border-radius:999px;background:#fff;color:#111b21;font-size:15px;cursor:pointer;margin-left:8px">Close</button></div>
    <script>setTimeout(() => { window.print(); }, 500);<\/script>
  </body></html>`);
  win.document.close();
}

// Add PDF export button to existing export menu
document.addEventListener("DOMContentLoaded", () => {
  const exportBtn = document.getElementById("exportChatsBtn");
  if (exportBtn) {
    const origClick = exportBtn._listeners?.[0] || exportBtn.onclick;
    exportBtn.addEventListener("click", async (e) => {
      const choice = await new Promise(resolve => {
        const sheet = document.createElement("div");
        sheet.className = "app-action-sheet-backdrop";
        sheet.innerHTML = `<div class="app-action-sheet" role="dialog"><div class="action-sheet-handle"></div><div class="action-sheet-heading"><strong>Export Chat</strong><span>Choose export format</span></div>
          <button type="button" class="action-sheet-option" data-fmt="txt">Plain Text (.txt)</button>
          <button type="button" class="action-sheet-option" data-fmt="json">JSON (.json)</button>
          <button type="button" class="action-sheet-option" data-fmt="pdf">PDF (.pdf)</button></div>`;
        document.body.appendChild(sheet);
        requestAnimationFrame(() => sheet.classList.add("show"));
        sheet.addEventListener("click", (ev) => {
          const opt = ev.target.closest("[data-fmt]");
          if (opt) { resolve(opt.dataset.fmt); closeActionSheet(); }
          if (ev.target === sheet) { resolve(null); closeActionSheet(); }
        });
      });
      if (choice === "pdf") {
        e.preventDefault();
        e.stopImmediatePropagation();
        await exportChatAsPDF();
      }
    });
  }
});

// ===== Status / Stories =====
let _storiesData = [];
let _storiesCurrentUserIdx = 0;
let _storiesCurrentStoryIdx = 0;
let _storiesTimer = null;

async function loadStories() {
  const strip = document.getElementById("storiesStrip");
  const inner = document.getElementById("storiesStripInner");
  if (!strip || !inner) return;
  try {
    const oneDayAgo = new Date(Date.now() - 86400000);
    const snap = await db.collection("stories")
      .where("expiresAt", ">=", oneDayAgo)
      .orderBy("expiresAt", "desc")
      .get();
    const userStories = {};
    snap.forEach(doc => {
      const d = doc.data();
      if (d.deletedFor?.currentUser?.uid) return;
      const uid = d.userId;
      if (!userStories[uid]) userStories[uid] = { userId: uid, userName: d.userName || "Unknown", userAvatar: d.userAvatar || "", stories: [] };
      userStories[uid].stories.push({ ...d, id: doc.id });
    });
    const users = Object.values(userStories);
    users.forEach(u => u.stories.sort((a, b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0)));
    _storiesData = users;

    // Build strip
    let html = `<button class="story-avatar my-story" id="myStoryBtn" title="Add status update">
      <span class="story-avatar-ring"></span>
      <span class="story-avatar-img" id="myStoryAvatar">${currentUser?.displayName?.[0] || "U"}</span>
      <span class="story-add-badge">+</span>
    </button>`;
    users.forEach((u, idx) => {
      if (u.userId === currentUser?.uid) return;
      html += `<button class="story-avatar has-story" data-user-idx="${idx}" title="${escapeHtml(u.userName)}">
        <span class="story-avatar-ring"></span>
        <span class="story-avatar-img">${u.userAvatar ? `<img src="${escapeHtml(u.userAvatar)}" alt="" />` : escapeHtml(u.userName[0] || "?")}</span>
        <span class="story-label">${escapeHtml(u.userName.split(" ")[0])}</span>
      </button>`;
    });
    inner.innerHTML = html;
    strip.style.display = users.length > 0 || currentUser ? "block" : "none";

    // Wire click handlers
    inner.querySelectorAll(".story-avatar[data-user-idx]").forEach(btn => {
      btn.addEventListener("click", () => openStoryViewer(Number(btn.dataset.userIdx)));
    });
    document.getElementById("myStoryBtn")?.addEventListener("click", () => {
      document.getElementById("storyCreatorModal").style.display = "flex";
    });

    // Cleanup expired stories
    cleanupExpiredStories();
  } catch (e) { console.error("Load stories error:", e); }
}

async function postStory(mediaUrl, mediaType, caption) {
  if (!currentUser) return;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 86400000);
  try {
    await db.collection("stories").add({
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email || "User",
      userAvatar: currentUser.photoURL || "",
      mediaUrl: mediaUrl || "",
      mediaType: mediaType || "text",
      caption: caption || "",
      text: mediaType === "text" ? caption : "",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
    });
    showToast("Status posted");
    await loadStories();
  } catch (e) { console.error("Post story error:", e); showToast("Failed to post status", "error"); }
}

async function cleanupExpiredStories() {
  try {
    const old = new Date(Date.now() - 86400000);
    const snap = await db.collection("stories").where("expiresAt", "<", old).get();
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    if (snap.size) await batch.commit();
  } catch (e) { /* ignore */ }
}

function openStoryViewer(userIdx) {
  const user = _storiesData[userIdx];
  if (!user || !user.stories.length) return;
  _storiesCurrentUserIdx = userIdx;
  _storiesCurrentStoryIdx = 0;
  showCurrentStory();
  document.getElementById("storyViewer").style.display = "flex";
  startStoryTimer();
}

function showCurrentStory() {
  const user = _storiesData[_storiesCurrentUserIdx];
  const story = user?.stories[_storiesCurrentStoryIdx];
  if (!story) { closeStoryViewer(); return; }

  const avatar = document.getElementById("storyViewerAvatar");
  const name = document.getElementById("storyViewerName");
  const time = document.getElementById("storyViewerTime");
  const content = document.getElementById("storyViewerContent");
  const deleteBtn = document.getElementById("storyViewerDeleteBtn");

  if (avatar) {
    if (user.userAvatar) { avatar.innerHTML = `<img src="${escapeHtml(user.userAvatar)}" alt="" />`; }
    else { avatar.textContent = user.userName[0] || "U"; avatar.style.background = document.body.classList.contains('dark') ? '#202c33' : '#dfe5e7'; }
  }
  if (name) name.textContent = user.userName;
  if (time) time.textContent = story.timestamp?.toDate?.()?.toLocaleTimeString() || "";

  if (story.mediaType === "image") {
    content.innerHTML = `<img src="${escapeHtml(story.mediaUrl)}" alt="Status update" />`;
  } else {
    const bgColors = ["#008069", "#5b4a9a", "#c75c3a", "#1b6b8a", "#8a4a6a"];
    const bg = bgColors[_storiesCurrentStoryIdx % bgColors.length];
    content.innerHTML = `<div class="story-text-content" style="background:${bg};border-radius:16px;color:#fff">${escapeHtml(story.text || story.caption || "")}</div>`;
  }

  // Show viewers list for own stories
  const viewersEl = document.getElementById("storyViewersList");
  if (viewersEl) {
    if (story.userId === currentUser?.uid && story.viewedBy && Object.keys(story.viewedBy).length > 0) {
      const viewerIds = Object.keys(story.viewedBy);
      viewerIds.sort((a, b) => (story.viewedBy[a]?.toMillis?.() || 0) - (story.viewedBy[b]?.toMillis?.() || 0));
      const names = viewerIds.map(id => {
        const user = allUsers.find(u => u.id === id);
        return user?.displayName || user?.name || id.slice(0, 6);
      });
      viewersEl.innerHTML = `<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:4px">Viewed by ${names.length}</div>${names.map(n => `<div style="font-size:13px;padding:2px 0">${escapeHtml(n)}</div>`).join("")}`;
      viewersEl.style.display = "";
    } else {
      viewersEl.style.display = "none";
    }
  }

  // Show/hide delete button
  if (deleteBtn) deleteBtn.style.display = story.userId === currentUser?.uid ? "flex" : "none";

  // Progress bar
  const bar = document.getElementById("storyProgressBar");
  if (bar) {
    const stories = user.stories;
    bar.innerHTML = stories.map((_, i) => `<div class="story-progress-seg ${i === _storiesCurrentStoryIdx ? "active" : ""}"><div class="fill" style="${i < _storiesCurrentStoryIdx ? "width:100%" : i === _storiesCurrentStoryIdx ? "width:0%;transition:width 5s linear" : "width:0%"}"></div></div>`).join("");
  }
}

function startStoryTimer() {
  if (_storiesTimer) clearTimeout(_storiesTimer);
  const fill = document.querySelector(".story-progress-seg.active .fill");
  if (fill) fill.style.width = "100%";
  _storiesTimer = setTimeout(() => {
    navigateStory(1);
  }, 5000);
}

function navigateStory(direction) {
  if (_storiesTimer) clearTimeout(_storiesTimer);
  const user = _storiesData[_storiesCurrentUserIdx];
  if (!user) return;
  _storiesCurrentStoryIdx += direction;
  if (_storiesCurrentStoryIdx < 0) {
    // Previous user
    _storiesCurrentUserIdx--;
    if (_storiesCurrentUserIdx < 0) { closeStoryViewer(); return; }
    const prevUser = _storiesData[_storiesCurrentUserIdx];
    if (prevUser) _storiesCurrentStoryIdx = prevUser.stories.length - 1;
  } else if (_storiesCurrentStoryIdx >= user.stories.length) {
    // Next user
    _storiesCurrentUserIdx++;
    if (_storiesCurrentUserIdx >= _storiesData.length) { closeStoryViewer(); return; }
    _storiesCurrentStoryIdx = 0;
  }
  showCurrentStory();
  startStoryTimer();
}

function closeStoryViewer() {
  if (_storiesTimer) clearTimeout(_storiesTimer);
  document.getElementById("storyViewer").style.display = "none";
}

function initStories() {
  const viewer = document.getElementById("storyViewer");
  if (!viewer) return;

  document.getElementById("storyViewerCloseBtn")?.addEventListener("click", closeStoryViewer);
  document.getElementById("storyViewerTapLeft")?.addEventListener("click", () => navigateStory(-1));
  document.getElementById("storyViewerTapRight")?.addEventListener("click", () => navigateStory(1));
  document.getElementById("storyViewerDeleteBtn")?.addEventListener("click", async () => {
    const user = _storiesData[_storiesCurrentUserIdx];
    const story = user?.stories[_storiesCurrentStoryIdx];
    if (!story || !story.id) return;
    try {
      await db.collection("stories").doc(story.id).delete();
      showToast("Status deleted");
      closeStoryViewer();
      await loadStories();
    } catch (e) { showToast("Failed to delete", "error"); }
  });

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (viewer.style.display !== "flex") return;
    if (e.key === "Escape") { closeStoryViewer(); e.preventDefault(); }
    if (e.key === "ArrowLeft") { navigateStory(-1); e.preventDefault(); }
    if (e.key === "ArrowRight") { navigateStory(1); e.preventDefault(); }
  });

  // Reply
  document.getElementById("storyReplySendBtn")?.addEventListener("click", async () => {
    const input = document.getElementById("storyReplyInput");
    const text = input?.value.trim();
    if (!text || !currentUser) return;
    const user = _storiesData[_storiesCurrentUserIdx];
    const story = user?.stories[_storiesCurrentStoryIdx];
    if (!story) return;
    try {
      await db.collection("messages").add({
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        text: `📸 Reply to status: ${text}`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: "sent",
        directId: story.userId,
        participants: [currentUser.uid, story.userId],
      });
      showToast("Reply sent");
      if (input) input.value = "";
    } catch (e) { showToast("Failed to send reply", "error"); }
  });

  // Story creator
  document.getElementById("closeStoryCreator")?.addEventListener("click", () => {
    document.getElementById("storyCreatorModal").style.display = "none";
  });
  document.getElementById("storyPhotoBtn")?.addEventListener("click", () => {
    document.getElementById("storyPhotoInput").click();
  });
  document.getElementById("storyTextBtn")?.addEventListener("click", () => {
    document.getElementById("storyTextInputRow").style.display = "block";
  });
  document.getElementById("storyPhotoInput")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById("storyPhotoPreview");
      const img = document.getElementById("storyPhotoPreviewImg");
      if (img && preview) { img.src = ev.target.result; preview.style.display = "block"; }
    };
    reader.readAsDataURL(file);
  });
  document.getElementById("storyPostPhotoBtn")?.addEventListener("click", async () => {
    const file = document.getElementById("storyPhotoInput").files?.[0];
    if (!file) { showToast("Select a photo first", "error"); return; }
    try {
      const ref = firebase.storage().ref(`stories/${currentUser.uid}/${Date.now()}_${file.name}`);
      await ref.put(file);
      const url = await ref.getDownloadURL();
      await postStory(url, "image", "");
      document.getElementById("storyCreatorModal").style.display = "none";
    } catch (e) { showToast("Failed to upload photo", "error"); }
  });
  document.getElementById("storyPostBtn")?.addEventListener("click", async () => {
    const text = document.getElementById("storyTextInput")?.value.trim();
    if (!text) { showToast("Enter some text", "error"); return; }
    await postStory("", "text", text);
    document.getElementById("storyCreatorModal").style.display = "none";
  });

  // Initial load
  loadStories();
  // Refresh every 60 seconds
  setInterval(loadStories, 60000);
}

// Init stories on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStories);
} else {
  initStories();
}

// ===== End-to-End Encryption (ECDH + AES-GCM) =====
const _e2eSharedKeys = {};
const _e2eSalt = new Uint8Array([87,65,45,69,50,69,45,83,65,76,84]); // "WA-E2E-SALT"

function _bufToBase64(u8) {
  let binary = "";
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}
function _base64ToBuf(b64) {
  const binary = atob(b64);
  const u8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
  return u8;
}

async function initE2EKeys() {
  if (!currentUser) return false;
  try {
    const keyStr = localStorage.getItem("wa_e2e_" + currentUser.uid);
    if (keyStr) {
      const jwk = JSON.parse(keyStr);
      await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
      return true;
    }
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
    );
    const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    localStorage.setItem("wa_e2e_" + currentUser.uid, JSON.stringify(privateJwk));
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    await db.collection("userPublicKeys").doc(currentUser.uid).set({
      publicKey: publicJwk,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (e) { console.warn("E2E init failed:", e); return false; }
}

async function _loadE2EPrivateKey() {
  if (!currentUser) return null;
  try {
    const keyStr = localStorage.getItem("wa_e2e_" + currentUser.uid);
    if (!keyStr) return null;
    return await crypto.subtle.importKey(
      "jwk", JSON.parse(keyStr),
      { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]
    );
  } catch (e) { return null; }
}

async function _fetchPeerPublicKey(peerUid) {
  try {
    const doc = await db.collection("userPublicKeys").doc(peerUid).get();
    if (!doc.exists) return null;
    const jwk = doc.data().publicKey;
    if (!jwk) return null;
    return await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
  } catch (e) { return null; }
}

async function deriveSharedAESKey(peerUid) {
  if (_e2eSharedKeys[peerUid]) return _e2eSharedKeys[peerUid];
  const privKey = await _loadE2EPrivateKey();
  if (!privKey) return null;
  const pubKey = await _fetchPeerPublicKey(peerUid);
  if (!pubKey) return null;
  try {
    const sharedBits = await crypto.subtle.deriveBits(
      { name: "ECDH", namedCurve: "P-256", public: pubKey },
      privKey, 256
    );
    const hkdfKey = await crypto.subtle.importKey("raw", sharedBits, { name: "HKDF" }, false, ["deriveKey"]);
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: _e2eSalt,
        info: new TextEncoder().encode("wa-e2e-v1"),
      },
      hkdfKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    _e2eSharedKeys[peerUid] = aesKey;
    return aesKey;
  } catch (e) { console.warn("E2E derive failed:", e); return null; }
}

function _getPeerUid() {
  return currentChat?.otherUserId || null;
}

async function encryptMessageText(text, peerUid) {
  if (!text || !peerUid) return null;
  try {
    const key = await deriveSharedAESKey(peerUid);
    if (!key) return null;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, key, new TextEncoder().encode(text)
    );
    return { ciphertext: _bufToBase64(new Uint8Array(encrypted)), iv: _bufToBase64(iv) };
  } catch (e) { return null; }
}

async function decryptMessageText(ciphertext, iv, peerUid) {
  if (!ciphertext || !iv || !peerUid) return null;
  try {
    const key = await deriveSharedAESKey(peerUid);
    if (!key) return null;
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: _base64ToBuf(iv) },
      key,
      _base64ToBuf(ciphertext)
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) { return null; }
}

// ===== Text Formatting Toolbar =====
const _fmtMap = { bold: ["**", "**"], italic: ["*", "*"], strike: ["~~", "~~"], mono: ["`", "`"] };
const _fmtKeys = { b: "bold", i: "italic" };

function initFormatToolbar() {
  const toolbar = document.getElementById("formatToolbar");
  const input = document.getElementById("messageInput");
  if (!toolbar || !input) return;

  const fmtBtns = toolbar.querySelectorAll(".fmt-btn");
  fmtBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const fmt = btn.dataset.fmt;
      if (!fmt || !_fmtMap[fmt]) return;
      const selStart = input.selectionStart;
      const selEnd = input.selectionEnd;
      const text = input.value;
      const [open, close] = _fmtMap[fmt];
      const hasSelection = selStart < selEnd;

      if (hasSelection) {
        const selected = text.substring(selStart, selEnd);
        const wrapped = open + selected + close;
        input.value = text.substring(0, selStart) + wrapped + text.substring(selEnd);
        input.selectionStart = selStart + open.length;
        input.selectionEnd = selStart + open.length + selected.length;
      } else {
        const insertion = open + close;
        input.value = text.substring(0, selStart) + insertion + text.substring(selStart);
        input.selectionStart = selStart + open.length;
        input.selectionEnd = selStart + open.length;
      }
      input.focus();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  // Show/hide toolbar based on focus and text length
  const toggleToolbar = () => {
    const isFocused = document.activeElement === input;
    const hasText = input.value.trim().length > 0;
    const isVisible = toolbar.style.display !== "none";
    if (isFocused || hasText) {
      if (!isVisible) toolbar.style.display = "flex";
    } else {
      if (isVisible) toolbar.style.display = "none";
    }
  };

  input.addEventListener("focus", toggleToolbar);
  input.addEventListener("blur", () => {
    // Hide after a delay so button clicks can register
    setTimeout(() => {
      if (document.activeElement !== input && !input.value.trim()) {
        toolbar.style.display = "none";
      }
    }, 150);
  });
  input.addEventListener("input", toggleToolbar);

  // Keyboard shortcuts: Ctrl+B, Ctrl+I
  input.addEventListener("keydown", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    const fmt = _fmtKeys[e.key.toLowerCase()];
    if (!fmt) return;
    e.preventDefault();
    const btn = toolbar.querySelector(`[data-fmt="${fmt}"]`);
    if (btn) btn.click();
  });
}

// ===== Scheduled Messages =====
function openScheduleModal() {
  const modal = document.getElementById("scheduleModal");
  if (!modal) return;
  const dt = document.getElementById("scheduleDateTime");
  if (dt) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    dt.min = now.toISOString().slice(0, 16);
    dt.value = now.toISOString().slice(0, 16);
  }
  modal.style.display = "flex";
}

async function scheduleMessage() {
  const dt = document.getElementById("scheduleDateTime");
  const input = document.getElementById("messageInput");
  if (!dt || !input || !currentChat || !currentUser) return;
  const scheduledAt = new Date(dt.value);
  if (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    showToast("Please pick a future time", "error");
    return;
  }
  const text = input.value.trim();
  if (!text) { showToast("Enter a message to schedule", "error"); return; }
  try {
    await db.collection("scheduledMessages").add({
      chatId: currentChat.id,
      chatType: currentChatType,
      text: text,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email,
      scheduledAt: firebase.firestore.Timestamp.fromDate(scheduledAt),
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast(`Message scheduled for ${scheduledAt.toLocaleString()}`);
    input.value = "";
    updateComposerActionState();
    document.getElementById("scheduleModal").style.display = "none";
  } catch (e) {
    showToast("Failed to schedule message: " + (e.message || ""), "error");
  }
}

async function processScheduledMessages() {
  if (!currentUser) return;
  try {
    const now = firebase.firestore.Timestamp.now();
    const snapshot = await db
      .collection("scheduledMessages")
      .where("senderId", "==", currentUser.uid)
      .where("status", "==", "pending")
      .where("scheduledAt", "<=", now)
      .get();
    const promises = snapshot.docs.map(async (doc) => {
      const data = doc.data();
      try {
        const msgRef = await db.collection("messages").add({
          chatId: data.chatId,
          chatType: data.chatType || "direct",
          senderId: currentUser.uid,
          senderName: data.senderName || currentUser.displayName || currentUser.email,
          text: data.text,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          status: "sent",
          scheduled: true,
          read: false,
          readBy: { [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp() },
          deliveredTo: {},
          participants: [],
        });
        await db.collection("scheduledMessages").doc(doc.id).update({ status: "sent", sentMessageId: msgRef.id });
      } catch (e) {
        await db.collection("scheduledMessages").doc(doc.id).update({ status: "failed", error: e.message });
      }
    });
    if (promises.length > 0) {
      await Promise.allSettled(promises);
      if (typeof loadCurrentChatList === "function") loadCurrentChatList();
    }
  } catch (e) {
    console.warn("processScheduledMessages error:", e);
  }
}

function initScheduledMessages() {
  document.querySelectorAll(".closeScheduleModal").forEach((el) => {
    el.addEventListener("click", () => document.getElementById("scheduleModal").style.display = "none");
  });
  document.getElementById("scheduleSendBtn")?.addEventListener("click", scheduleMessage);
  // Process due messages every 30s
  processScheduledMessages();
  setInterval(processScheduledMessages, 30000);
}

// ===== Chat Folders =====
function getFolders() {
  try { return JSON.parse(localStorage.getItem("wa_folders") || "{}"); } catch { return {}; }
}
function saveFolders(folders) {
  localStorage.setItem("wa_folders", JSON.stringify(folders));
}
function getChatFolder(chatId) {
  const folders = getFolders();
  for (const name in folders) {
    if (folders[name].includes(chatId)) return name;
  }
  return "";
}
function setChatFolder(chatId, folderName) {
  const folders = getFolders();
  for (const name in folders) {
    folders[name] = folders[name].filter((id) => id !== chatId);
    if (folders[name].length === 0) delete folders[name];
  }
  if (folderName) {
    if (!folders[folderName]) folders[folderName] = [];
    if (!folders[folderName].includes(chatId)) folders[folderName].push(chatId);
  }
  saveFolders(folders);
}
function renderFolderTabs() {
  const container = document.getElementById("folderTabs");
  if (!container) return;
  const folders = getFolders();
  const names = Object.keys(folders);
  const activeFolder = localStorage.getItem("wa_active_folder") || "";
  container.innerHTML = names.map((name) => {
    const count = folders[name].length;
    const unread = folders[name].reduce((sum, id) => {
      const el = document.querySelector(`.list-item[data-chat-id="${CSS.escape(id)}"]`);
      return sum + (Number(el?.dataset?.unreadCount) || 0);
    }, 0);
    return `<button class="folder-tab ${name === activeFolder ? "active" : ""}" data-folder="${name}">${escapeHtml(name)}${unread > 0 ? `<span class="folder-badge">${unread}</span>` : ""}</button>`;
  }).join("") + (names.length ? '<button class="folder-tab folder-manage-btn" id="manageFoldersBtn" title="Manage folders">✎</button>' : "");
  if (names.length > 0) {
    container.querySelectorAll(".folder-tab[data-folder]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const folder = tab.dataset.folder;
        const active = localStorage.getItem("wa_active_folder") || "";
        if (active === folder) {
          localStorage.removeItem("wa_active_folder");
          document.querySelectorAll(".folder-tab").forEach((t) => t.classList.remove("active"));
        } else {
          localStorage.setItem("wa_active_folder", folder);
          document.querySelectorAll(".folder-tab").forEach((t) => t.classList.toggle("active", t.dataset.folder === folder));
        }
        filterChatListByFolder();
      });
    });
    const manageBtn = document.getElementById("manageFoldersBtn");
    if (manageBtn) {
      manageBtn.addEventListener("click", () => {
        document.getElementById("folderModal").style.display = "flex";
        renderFolderList();
      });
    }
  }
}
function filterChatListByFolder() {
  const activeFolder = localStorage.getItem("wa_active_folder") || "";
  const folders = getFolders();
  document.querySelectorAll("#chatsList .list-item, #groupsList .list-item, #broadcastsList .list-item").forEach((el) => {
    if (!activeFolder) { el.style.display = ""; return; }
    const chatId = el.dataset.chatId || "";
    const inFolder = folders[activeFolder]?.includes(chatId);
    el.style.display = inFolder ? "" : "none";
  });
}
function renderFolderList() {
  const container = document.getElementById("folderList");
  if (!container) return;
  const folders = getFolders();
  const names = Object.keys(folders);
  if (names.length === 0) {
    container.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">No folders yet. Create one above.</div>';
    return;
  }
  container.innerHTML = names.map((name) =>
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px;border:1px solid var(--border);border-radius:6px;">
      <span style="font-size:13px;font-weight:600;">${escapeHtml(name)} <span style="color:var(--muted);font-weight:400;">(${folders[name].length} chats)</span></span>
      <button class="btn btn-outline delete-folder-btn" data-folder="${name}" style="padding:3px 10px;font-size:12px;">Delete</button>
    </div>`
  ).join("");
  container.querySelectorAll(".delete-folder-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.folder;
      const folders = getFolders();
      delete folders[name];
      saveFolders(folders);
      if (localStorage.getItem("wa_active_folder") === name) localStorage.removeItem("wa_active_folder");
      renderFolderList();
      renderFolderTabs();
      filterChatListByFolder();
    });
  });
}
function initFolders() {
  renderFolderTabs();
  filterChatListByFolder();
  document.getElementById("addFolderBtn")?.addEventListener("click", () => {
    const input = document.getElementById("newFolderName");
    const name = input?.value?.trim();
    if (!name) { showToast("Enter a folder name", "error"); return; }
    const folders = getFolders();
    if (folders[name]) { showToast("Folder already exists", "error"); return; }
    folders[name] = [];
    saveFolders(folders);
    input.value = "";
    renderFolderList();
    renderFolderTabs();
    showToast(`Folder "${name}" created`);
  });
  document.querySelectorAll(".closeFolderModal").forEach((el) => {
    el.addEventListener("click", () => document.getElementById("folderModal").style.display = "none");
  });
  document.querySelectorAll(".closeFolderPickerModal").forEach((el) => {
    el.addEventListener("click", () => document.getElementById("folderPickerModal").style.display = "none");
  });
  document.getElementById("folderChatMenuItem")?.addEventListener("click", () => {
    document.getElementById("chatContextMenu").style.display = "none";
    if (!currentChat) { showToast("Open a chat first", "error"); return; }
    const body = document.getElementById("folderPickerBody");
    if (!body) return;
    const folders = getFolders();
    const names = Object.keys(folders);
    const curFolder = getChatFolder(currentChat.id);
    body.innerHTML = names.map((name) =>
      `<button class="context-menu-item" data-folder="${name}" style="width:100%;text-align:left;">${curFolder === name ? "✓ " : ""}${escapeHtml(name)}</button>`
    ).join("") + (curFolder ? `<button class="context-menu-item" data-folder="" style="width:100%;text-align:left;color:var(--danger);">Remove from folder</button>` : "");
    if (names.length === 0) {
      body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">No folders yet. Create one in chat settings.</div>';
    } else {
      body.querySelectorAll("[data-folder]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const folder = btn.dataset.folder || "";
          setChatFolder(currentChat.id, folder);
          document.getElementById("folderPickerModal").style.display = "none";
          renderFolderTabs();
          filterChatListByFolder();
          showToast(folder ? `Chat moved to "${folder}"` : "Chat removed from folder");
        });
      });
    }
    document.getElementById("folderPickerModal").style.display = "flex";
  });
}



async function refreshCurrentChatList() {
  const activeTab = document.querySelector(".primary-tabs .tab.active");
  const tab = activeTab?.dataset?.tab || "chats";
  try {
    if (tab === "chats") await loadCurrentChatList();
    else if (tab === "groups") await loadGroupList();
    else if (tab === "broadcasts") await loadBroadcastList();
    else if (tab === "status") await loadStories();
    showToast("Refreshed");
  } catch { showToast("Refresh failed", "error"); }
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

// ===== Global Full-Text Search =====
let _globalSearchTimeout = null;
let _globalSearchChatList = [];

async function buildGlobalSearchChatList() {
  if (_globalSearchChatList.length) return _globalSearchChatList;
  const chats = [];
  try {
    const dcSnap = await db.collection("directChats").where("participants", "array-contains", currentUser.uid).get();
    dcSnap.forEach(doc => {
      const d = doc.data();
      const otherId = d.participants?.find(p => p !== currentUser.uid);
      chats.push({ id: doc.id, type: "direct", name: d.lastMessage ? (otherId || doc.id) : doc.id });
    });
    const gSnap = await db.collection("groups").where("members", "array-contains", currentUser.uid).get();
    gSnap.forEach(doc => {
      const d = doc.data();
      chats.push({ id: doc.id, type: "group", name: d.name || doc.id });
    });
  } catch (e) { console.error("Build search chat list error:", e); }
  _globalSearchChatList = chats;
  return chats;
}

async function performGlobalSearch(term) {
  if (!term || term.length < 2) return [];
  const results = [];
  const chats = await buildGlobalSearchChatList();
  const batchSize = Math.min(chats.length, 20);
  const promises = [];
  for (let i = 0; i < batchSize; i++) {
    const chat = chats[i];
    const field = chat.type === "direct" ? "directId" : "groupId";
    promises.push((async () => {
      try {
        const snap = await db.collection("messages")
          .where(field, "==", chat.id)
          .where("text", ">=", term)
          .where("text", "<=", term + "\uf8ff")
          .orderBy("text")
          .limit(5)
          .get();
        snap.forEach(doc => {
          const d = doc.data();
          if (d.deletedForEveryone || d.deletedFor?.[currentUser.uid]) return;
          results.push({ ...d, id: doc.id, chatId: chat.id, chatType: chat.type, chatName: chat.name });
        });
      } catch (e) {
        // Fallback: search without composite index
        try {
          const snap = await db.collection("messages")
            .where(field, "==", chat.id)
            .orderBy("timestamp", "desc")
            .limit(100)
            .get();
          snap.forEach(doc => {
            const d = doc.data();
            if (d.deletedForEveryone || d.deletedFor?.[currentUser.uid]) return;
            if (d.text && d.text.toLowerCase().includes(term.toLowerCase())) {
              results.push({ ...d, id: doc.id, chatId: chat.id, chatType: chat.type, chatName: chat.name });
            }
          });
        } catch (e2) {}
      }
    })());
  }
  await Promise.allSettled(promises);
  results.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
  return results.slice(0, 50);
}

function initGlobalSearch() {
  const modal = document.getElementById("globalSearchModal");
  const input = document.getElementById("globalSearchInput");
  const results = document.getElementById("globalSearchResults");
  const closeBtn = document.getElementById("closeGlobalSearch");
  if (!modal || !input || !results) return;

  closeBtn?.addEventListener("click", () => modal.style.display = "none");
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });

  input.addEventListener("input", () => {
    clearTimeout(_globalSearchTimeout);
    const term = input.value.trim();
    if (term.length < 2) { results.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">Type at least 2 characters to search</div>'; return; }
    results.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">Searching...</div>';
    _globalSearchTimeout = setTimeout(async () => {
      const hits = await performGlobalSearch(term);
      if (hits.length === 0) {
        results.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">No messages found</div>';
        return;
      }
      results.innerHTML = "";
      const groupMap = {};
      hits.forEach(h => {
        const key = `${h.chatType}:${h.chatId}`;
        if (!groupMap[key]) groupMap[key] = { name: h.chatName || h.chatId, type: h.chatType, msgs: [] };
        groupMap[key].msgs.push(h);
      });
      Object.entries(groupMap).forEach(([key, group]) => {
        const header = document.createElement("div");
        header.style.cssText = "padding:8px 0 4px;font-size:13px;font-weight:700;color:var(--brand-dark);border-bottom:1px solid var(--border);margin-top:8px";
        header.textContent = `${group.type === "group" ? "👥" : "💬"} ${group.name} (${group.msgs.length})`;
        results.appendChild(header);
        group.msgs.forEach(msg => {
          const row = document.createElement("button");
          row.style.cssText = "display:block;width:100%;text-align:left;padding:8px 10px;border:0;border-radius:8px;background:transparent;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)";
          const sender = escapeHtml(msg.senderName || "Unknown");
          const text = escapeHtml(msg.text || "(media)");
          const time = msg.timestamp?.toDate?.()?.toLocaleString() || "";
          row.innerHTML = `<span style="font-weight:600;color:var(--text)">${sender}</span> <span style="color:var(--muted)">${text}</span> <span style="font-size:10px;color:var(--muted-strong);float:right">${time}</span>`;
          row.addEventListener("click", async () => {
            modal.style.display = "none";
            try {
              if (msg.chatType === "group") {
                const gDoc = await db.collection("groups").doc(msg.chatId).get();
                if (gDoc.exists) await loadGroupChat(msg.chatId, gDoc.data().name || "Group", gDoc.data());
              } else {
                const dcDoc = await db.collection("directChats").doc(msg.chatId).get();
                if (dcDoc.exists) {
                  const dcData = dcDoc.data();
                  const otherId = dcData.participants?.find(p => p !== currentUser.uid);
                  if (otherId) {
                    const uDoc = await db.collection("users").doc(otherId).get();
                    if (uDoc.exists) await startDirectChat({ ...uDoc.data(), uid: otherId, directChatId: msg.chatId });
                  }
                }
              }
            } catch (e) { console.error("Open chat from search error:", e); }
            setTimeout(() => {
              const target = document.querySelector(`[data-message-id="${msg.id}"]`);
              if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 800);
          });
          results.appendChild(row);
        });
      });
    }, 300);
  });
}

// Wire up global search button
document.addEventListener("DOMContentLoaded", () => {
  initGlobalSearch();
  const searchBtn = document.getElementById("searchChatBtn");
  if (searchBtn) {
    searchBtn.addEventListener("click", (e) => {
      if (currentChat) {
        // Existing in-chat search behavior
        return;
      }
      // No chat open = global search
      const modal = document.getElementById("globalSearchModal");
      if (modal) {
        modal.style.display = "flex";
        document.getElementById("globalSearchInput")?.focus();
      }
    });
  }
});
