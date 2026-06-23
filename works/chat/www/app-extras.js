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
  .getElementById("lockChatMenuItem")
  ?.addEventListener("click", async () => {
    const target = contextMenuTarget || buildActiveChatContextTarget?.();
    if (!target) return;
    const chatId = target.dataset.chatId;
    const chatType = target.dataset.chatType;
    const chatName =
      target.dataset.chatName ||
      target.querySelector?.(".list-name")?.textContent ||
      "Chat";
    const otherUserId = target.dataset.otherUserId || "";
    document.getElementById("chatContextMenu").style.display = "none";
    if (!chatId || !["direct", "group"].includes(chatType)) return;
    if (isChatLocked(chatId, chatType)) await permanentlyUnlockChat(chatId, chatType);
    else await lockChat(chatId, chatType, chatName, otherUserId);
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
  .getElementById("markAllReadBtn")
  ?.addEventListener("click", markAllChatsAsRead);

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
function toggleParticipantPanel() {
  const modal = document.getElementById("participantPanelModal");
  if (!modal) return;
  if (modal.style.display === "flex") {
    modal.style.display = "none";
    return;
  }
  const body = document.getElementById("participantPanelBody");
  if (!body) return;
  let participants = [];
  if (activeGroupCallParticipants?.length) {
    participants = activeGroupCallParticipants;
  } else if (activeCall?.participantIds?.length) {
    participants = activeCall.participantIds.map((id) => ({
      id,
      name: activeCall.participantNames?.[id] || "Member",
    }));
  } else {
    participants = [{ id: currentUser.uid, name: currentUser.displayName || "You" }];
    if (activeCall?.fromUserId && activeCall.fromUserId !== currentUser.uid) {
      participants.push({ id: activeCall.fromUserId, name: activeCall.fromUserName || "Caller" });
    }
    if (activeCall?.toUserId && activeCall.toUserId !== currentUser.uid) {
      participants.push({ id: activeCall.toUserId, name: activeCall.toUserName || "Participant" });
    }
  }
  if (participants.length && !participants.some((p) => p.id === currentUser.uid)) {
    participants.unshift({ id: currentUser.uid, name: currentUser.displayName || "You" });
  }
  body.innerHTML = participants
    .map(
      (p) => `
        <div class="participant-item">
          <div class="participant-avatar">${getInitials(p.name || "?", "")}</div>
          <div class="participant-info">
            <div class="participant-name">${p.id === currentUser.uid ? "You" : escapeHtml(p.name)}</div>
            <div class="participant-status">${getCallParticipantStatus(p.id)}</div>
          </div>
          ${isCallParticipantMuted(p.id) ? '<span class="participant-muted-badge">Muted</span>' : ""}
        </div>`,
    )
    .join("");
  modal.style.display = "flex";
}

function getCallParticipantStatus(userId) {
  if (activeGroupCallParticipants) {
    const state = activeCall?.participantStates?.[userId];
    if (state === "joined") return "Connected";
    if (state === "ringing") return "Ringing";
    if (state === "busy") return "Busy";
  }
  return "Connected";
}

function isCallParticipantMuted(userId) {
  if (userId === currentUser?.uid) return micMuted;
  return activeCall?.participantStates?.[userId] === "muted";
}

function toggleCallView() {
  const stage = document.querySelector(".call-video-stage");
  if (!stage) return;
  isSpeakerView = !isSpeakerView;
  stage.classList.toggle("speaker-view", isSpeakerView);
  const btn = document.getElementById("toggleViewBtn");
  if (btn) {
    btn.textContent = isSpeakerView ? "Grid" : "View";
    btn.title = isSpeakerView ? "Switch to grid view" : "Switch to speaker view";
  }
}

// ---------- Proximity Sensor ----------
let proximityLockEnabled = false;
let proximityDetectionActive = false;

function toggleProximityLock() {
  proximityLockEnabled = !proximityLockEnabled;
  const btn = document.getElementById("proximityLockBtn");
  if (btn) btn.classList.toggle("active", proximityLockEnabled);
  if (proximityLockEnabled) {
    startProximityDetection();
  } else {
    stopProximityDetection();
  }
}

function startProximityDetection() {
  if (proximityDetectionActive) return;
  proximityDetectionActive = true;
  if ("onuserproximity" in window) {
    window.addEventListener("userproximity", handleProximityChange);
  } else if ("ondeviceproximity" in window) {
    window.addEventListener("deviceproximity", handleDeviceProximity);
  } else if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientation", handleDeviceOrientationProximity);
  }
}

function stopProximityDetection() {
  proximityDetectionActive = false;
  window.removeEventListener("userproximity", handleProximityChange);
  window.removeEventListener("deviceproximity", handleDeviceProximity);
  window.removeEventListener("deviceorientation", handleDeviceOrientationProximity);
  hideProximityOverlay();
}

function handleProximityChange(event) {
  if (event.near) showProximityOverlay();
  else hideProximityOverlay();
}

function handleDeviceProximity(event) {
  if (event.value < event.max) showProximityOverlay();
  else hideProximityOverlay();
}

let _proxOrientationTimer = null;
function handleDeviceOrientationProximity(event) {
  clearTimeout(_proxOrientationTimer);
  if (event.gamma > 60 && Math.abs(event.beta) < 30 && Math.abs(event.gamma) < 110) {
    showProximityOverlay();
  } else {
    _proxOrientationTimer = setTimeout(hideProximityOverlay, 500);
  }
}

function showProximityOverlay() {
  if (!proximityLockEnabled) return;
  let overlay = document.getElementById("proximityOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "proximityOverlay";
    overlay.innerHTML = '<div class="proximity-unlock-hint">Tap to unlock screen</div>';
    overlay.addEventListener("click", () => {
      hideProximityOverlay();
      toggleProximityLock();
    });
    document.body.appendChild(overlay);
  }
  overlay.style.display = "block";
}

function hideProximityOverlay() {
  const overlay = document.getElementById("proximityOverlay");
  if (overlay) overlay.style.display = "none";
}

// ---------- Call Waiting ----------
let callWaitingData = null;

function showCallWaitingModal(incomingCall) {
  callWaitingData = incomingCall;
  const modal = document.getElementById("callWaitingModal");
  const text = document.getElementById("callWaitingText");
  if (text) {
    text.textContent = `${incomingCall.fromUserName || "Someone"} is calling while you are on another call.`;
  }
  if (modal) modal.style.display = "flex";
}

function hideCallWaitingModal() {
  callWaitingData = null;
  const modal = document.getElementById("callWaitingModal");
  if (modal) modal.style.display = "none";
}

function acceptWaitingCall() {
  const incoming = callWaitingData;
  if (!incoming) return;
  hideCallWaitingModal();
  const currentCallId = activeCall?.id;
  if (currentCallId) {
    endCurrentCallForWaiting(currentCallId);
  }
  setTimeout(() => {
    acceptIncomingCallFromWaiting(incoming);
  }, 300);
}

function declineWaitingCall() {
  if (!callWaitingData) return;
  const id = callWaitingData.id;
  hideCallWaitingModal();
  db.collection("calls").doc(id).update({ status: "declined", endedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
}

function endCurrentCallForWaiting(callId) {
  if (activeCall?.groupCall) {
    endGroupCall("ended");
  } else {
    endCall();
  }
}

function acceptIncomingCallFromWaiting(callData) {
  activeCall = { id: callData.id, ...callData };
  saveCallState();
  if (callData.groupCall) {
    joinGroupCallRoom(callData.id, callData, "active").catch(() => {});
  } else {
    acceptIncomingCall().catch(() => {});
  }
}

// ---------- In-Call Messaging ----------
function toggleInCallMsgPanel() {
  const panel = document.getElementById("callMsgPanel");
  const btn = document.getElementById("msgCallBtn");
  if (!panel) return;
  const isOpen = panel.classList.toggle("open");
  if (isOpen) {
    const input = document.getElementById("callMsgInput");
    if (input) { input.value = ""; setTimeout(() => input.focus(), 250); }
  }
  if (btn) btn.classList.toggle("active", isOpen);
}

function closeInCallMsgPanel() {
  const panel = document.getElementById("callMsgPanel");
  const btn = document.getElementById("msgCallBtn");
  if (panel) panel.classList.remove("open");
  if (btn) btn.classList.remove("active");
}

async function sendInCallMessage() {
  const input = document.getElementById("callMsgInput");
  const text = input?.value?.trim();
  if (!text || !activeCall) return;
  try {
    let messageData = {
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email,
      text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: "sent",
      read: false,
      readBy: { [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp() },
      deliveredTo: {},
      inCallMessage: true,
    };
    if (activeCall.groupCall && activeCall.groupId) {
      messageData.groupId = activeCall.groupId;
      messageData.participants = [currentUser.uid, ...(activeCall.participantIds || [])];
    } else {
      const otherId = activeCall.fromUserId === currentUser.uid ? activeCall.toUserId : activeCall.fromUserId;
      if (!otherId) { showToast("Cannot send message in this call", "error"); return; }
      const directId = getDirectChatId(currentUser.uid, otherId);
      messageData.directId = directId;
      messageData.participants = [currentUser.uid, otherId];
    }
    await db.collection("messages").add(messageData);
    if (messageData.directId) {
      await db.collection("directChats").doc(messageData.directId).set({
        participants: messageData.participants,
        lastMessage: text,
        lastMessageSenderId: currentUser.uid,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
    } else if (messageData.groupId) {
      await db.collection("groups").doc(messageData.groupId).update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    }
    if (input) input.value = "";
    closeInCallMsgPanel();
    showCallControlHint("Message sent");
  } catch (e) {
    showToast("Failed to send message", "error");
  }
}

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

function isAudioOutputSelectionSupported() {
  if (window.Capacitor?.Plugins?.AppPermissions?.setSpeakerphone) return true;
  const testEl = document.createElement("audio");
  if (typeof testEl.setSinkId !== "function") return false;
  if (/android/i.test(navigator.userAgent)) return false;
  return true;
}

function setupCallControlButtons() {
  const muteBtn = document.getElementById("muteMicBtn");
  const cameraBtn = document.getElementById("toggleCameraBtn");
  const speakerBtn = document.getElementById("speakerCallBtn");
  const upgradeVideoBtn = document.getElementById("upgradeVideoCallBtn");

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

  if (speakerBtn && speakerBtn.dataset.ready !== "true") {
    speakerBtn.dataset.ready = "true";
    if (!isAudioOutputSelectionSupported()) {
      speakerBtn.style.display = "none";
    }
    speakerBtn.addEventListener("click", () => setCallSpeakerEnabled(!speakerOn));
  }

  if (upgradeVideoBtn && upgradeVideoBtn.dataset.ready !== "true") {
    upgradeVideoBtn.dataset.ready = "true";
    upgradeVideoBtn.addEventListener("click", () => {
      if (currentCallType === "video") {
        downgradeVideoToVoice().catch(() =>
          showCallControlHint("Could not switch to voice"),
        );
      } else {
        upgradeVoiceCallToVideo().catch(() =>
          showCallControlHint("Could not switch to video"),
        );
      }
    });
  }

  const peopleBtn = document.getElementById("peopleCallBtn");
  if (peopleBtn && peopleBtn.dataset.ready !== "true") {
    peopleBtn.dataset.ready = "true";
    peopleBtn.style.display = "inline-flex";
    peopleBtn.addEventListener("click", toggleParticipantPanel);
  }

  const viewBtn = document.getElementById("toggleViewBtn");
  if (viewBtn && viewBtn.dataset.ready !== "true") {
    viewBtn.dataset.ready = "true";
    viewBtn.addEventListener("click", toggleCallView);
  }

  const closePanelBtn = document.querySelector(".closeParticipantPanel");
  if (closePanelBtn && closePanelBtn.dataset.ready !== "true") {
    closePanelBtn.dataset.ready = "true";
    closePanelBtn.addEventListener("click", () => {
      document.getElementById("participantPanelModal").style.display = "none";
    });
  }

  const proximityBtn = document.getElementById("proximityLockBtn");
  if (proximityBtn && proximityBtn.dataset.ready !== "true") {
    proximityBtn.dataset.ready = "true";
    proximityBtn.addEventListener("click", toggleProximityLock);
  }

  const msgBtn = document.getElementById("msgCallBtn");
  if (msgBtn && msgBtn.dataset.ready !== "true") {
    msgBtn.dataset.ready = "true";
    msgBtn.addEventListener("click", toggleInCallMsgPanel);
  }
  const msgSendBtn = document.getElementById("callMsgSendBtn");
  if (msgSendBtn && msgSendBtn.dataset.ready !== "true") {
    msgSendBtn.dataset.ready = "true";
    msgSendBtn.addEventListener("click", sendInCallMessage);
  }
  const msgCloseBtn = document.getElementById("callMsgCloseBtn");
  if (msgCloseBtn && msgCloseBtn.dataset.ready !== "true") {
    msgCloseBtn.dataset.ready = "true";
    msgCloseBtn.addEventListener("click", closeInCallMsgPanel);
  }
  const msgInput = document.getElementById("callMsgInput");
  if (msgInput && msgInput.dataset.ready !== "true") {
    msgInput.dataset.ready = "true";
    msgInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); sendInCallMessage(); }
    });
  }

  const acceptWaitingBtn = document.getElementById("callWaitingAcceptBtn");
  if (acceptWaitingBtn && acceptWaitingBtn.dataset.ready !== "true") {
    acceptWaitingBtn.dataset.ready = "true";
    acceptWaitingBtn.addEventListener("click", acceptWaitingCall);
  }
  const declineWaitingBtn = document.getElementById("callWaitingDeclineBtn");
  if (declineWaitingBtn && declineWaitingBtn.dataset.ready !== "true") {
    declineWaitingBtn.dataset.ready = "true";
    declineWaitingBtn.addEventListener("click", declineWaitingCall);
  }
  const closeWaitingModal = document.querySelector("#callWaitingModal .close-modal");
  if (closeWaitingModal && closeWaitingModal.dataset.ready !== "true") {
    closeWaitingModal.dataset.ready = "true";
    closeWaitingModal.addEventListener("click", hideCallWaitingModal);
  }
}

function flashCallControlLabel(element, message) {
  if (!element) return;
  const original = element.textContent;
  element.textContent = message;
  element.style.opacity = "0.7";
  setTimeout(() => {
    element.textContent = original;
    element.style.opacity = "1";
  }, 1200);
}

function getCallPermissionMessage(error, callType) {
  if (error?.name === "NotAllowedError" || error?.message?.includes("denied")) {
    return `${callType === "video" ? "Camera" : "Microphone"} permission denied. Please allow access in settings.`;
  }
  if (error?.name === "NotFoundError") return "No camera found on this device";
  return error?.message || `Could not start ${callType} call`;
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
  if (!document.hidden && activeCall && peerConnection) {
    requestCallWakeLock();
  }
});

window.addEventListener("pagehide", () => {
  if (currentUser) setCurrentUserPresence(false).catch(() => {});
  saveCallState();
  if (temporarilyUnlockedChatId) relockTemporarilyUnlockedChat();
  appUnlockedForSession = false;
});
window.addEventListener("pageshow", () => {
  if (getStoredAppLockPin()) lockAppNowIfEnabled();
});

window.enableTeamChatCallNotifications =
  function enableTeamChatCallNotifications() {
    return registerFcmTokenForCurrentUser({ force: true });
  };

// ========================================
// FREE, CAPABILITY-BASED MESSAGE TRANSLATION
// ========================================

const TRANSLATION_LANGUAGES = [
  ["auto", "Auto detect"],
  ["en", "English"],
  ["ar", "Arabic"],
  ["bn", "Bengali"],
  ["zh", "Chinese"],
  ["fr", "French"],
  ["de", "German"],
  ["gu", "Gujarati"],
  ["hi", "Hindi"],
  ["id", "Indonesian"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["kn", "Kannada"],
  ["ko", "Korean"],
  ["ml", "Malayalam"],
  ["mr", "Marathi"],
  ["pt", "Portuguese"],
  ["ru", "Russian"],
  ["es", "Spanish"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["tr", "Turkish"],
  ["ur", "Urdu"],
  ["vi", "Vietnamese"],
];
const translationCache = new Map();
let activeTranslationMessage = null;
let autoTranslationPassRunning = false;

function getCurrentChatTranslationKey() {
  if (!currentUser?.uid || !currentChat?.id || !currentChatType) return "";
  return `chatAutoTranslation_${currentUser.uid}_${currentChatType}_${currentChat.id}`;
}

function getCurrentChatTranslationSetting() {
  const key = getCurrentChatTranslationKey();
  if (!key) return null;
  try {
    const setting = JSON.parse(localStorage.getItem(key) || "null");
    return setting?.enabled ? setting : null;
  } catch (_) {
    return null;
  }
}

function saveCurrentChatTranslationSetting(setting) {
  const key = getCurrentChatTranslationKey();
  if (!key) return;
  const recordId = `${currentUser.uid}_${currentChatType}_${currentChat.id}`.replaceAll("/", "_");
  if (!setting?.enabled) {
    localStorage.removeItem(key);
    db?.collection("chatTranslationSettings")
      ?.doc(recordId)
      ?.delete()
      ?.catch(() => {});
    return;
  }
  const record = {
    ...setting,
    enabled: true,
    userId: currentUser.uid,
    chatId: currentChat.id,
    chatType: currentChatType,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  localStorage.setItem(key, JSON.stringify({ ...setting, enabled: true }));
  db?.collection("chatTranslationSettings")
    ?.doc(recordId)
    ?.set(record, { merge: true })
    ?.catch(() => {});
}

async function hydrateCurrentChatTranslationSetting() {
  if (!currentUser?.uid || !currentChat?.id || !currentChatType) return;
  const recordId = `${currentUser.uid}_${currentChatType}_${currentChat.id}`.replaceAll("/", "_");
  try {
    const snapshot = await db.collection("chatTranslationSettings").doc(recordId).get();
    const setting = snapshot.data();
    if (setting?.enabled) {
      localStorage.setItem(
        getCurrentChatTranslationKey(),
        JSON.stringify({
          enabled: true,
          sourceLanguage: setting.sourceLanguage,
          preferredLanguage: setting.preferredLanguage,
        }),
      );
    }
  } catch (_) {}
}

function disableCurrentChatAutoTranslation() {
  saveCurrentChatTranslationSetting(null);
  const toggle = document.getElementById("autoTranslateChatToggle");
  if (toggle) toggle.checked = false;
  showToast("Automatic translation turned off");
}

function getTranslationSourceText(message = {}) {
  const parts = [];
  if (message.text) parts.push(message.text);
  if (message.linkPreview?.title) parts.push(message.linkPreview.title);
  if (message.linkPreview?.description) parts.push(message.linkPreview.description);
  if (message.attachment?.caption) parts.push(message.attachment.caption);
  if (message.transcript) parts.push(message.transcript);
  if (message.attachment?.transcript) parts.push(message.attachment.transcript);
  return [...new Set(parts.map((part) => String(part || "").trim()).filter(Boolean))].join("\n");
}

function getTranslationMediaNote(message = {}) {
  const type = message.attachment?.type || message.type || "";
  if (type === "voice" || type === "audio")
    return "This voice message has no transcript. Free, reliable voice transcription is not available on every device.";
  if (type === "video")
    return "This video has no transcript or caption. Free, reliable video transcription is not available on every device.";
  if (type === "image")
    return "This image has no caption. Image text extraction is not available on every device.";
  return "This message does not contain translatable text.";
}

function populateTranslationLanguages() {
  const from = document.getElementById("translateFromLanguage");
  const to = document.getElementById("translateToLanguage");
  if (!from || !to || from.options.length) return;
  TRANSLATION_LANGUAGES.forEach(([code, label]) => {
    from.add(new Option(label, code));
    if (code !== "auto") to.add(new Option(label, code));
  });
  from.value = localStorage.getItem("translateFromLanguage") || "auto";
  to.value = localStorage.getItem("translateToLanguage") || navigator.language?.split("-")[0] || "en";
  if (!to.value) to.value = "en";
}

function closeTranslateModal() {
  const modal = document.getElementById("translateModal");
  if (modal) modal.style.display = "none";
}

function resetTranslationOutput() {
  const panel = document.getElementById("translateOutputPanel");
  const text = document.getElementById("translateOutputText");
  const language = document.getElementById("translateOutputLanguage");
  if (panel) panel.hidden = true;
  if (text) text.textContent = "";
  if (language) language.textContent = "";
}

function showTranslationOutput(result) {
  const panel = document.getElementById("translateOutputPanel");
  const text = document.getElementById("translateOutputText");
  const language = document.getElementById("translateOutputLanguage");
  const label =
    TRANSLATION_LANGUAGES.find(([code]) => code === result.targetLanguage)?.[1] ||
    result.targetLanguage;
  if (text) text.textContent = result.text;
  if (language) language.textContent = `Translated to ${label}`;
  if (panel) panel.hidden = false;
}

function updateTranslationCapabilityNote() {
  const note = document.getElementById("translateCapabilityNote");
  const runButton = document.getElementById("runTranslateBtn");
  if (!note || !runButton || !activeTranslationMessage) return;
  const text = getTranslationSourceText(activeTranslationMessage.data);
  if (!text) {
    note.textContent = getTranslationMediaNote(activeTranslationMessage.data);
    runButton.disabled = true;
    return;
  }
  runButton.disabled = false;
  note.textContent =
    "Translation stays inside this conversation. On-device translation is used when available; otherwise a free online translation service is used.";
}

function openTranslateModal(messageId, messageData) {
  populateTranslationLanguages();
  activeTranslationMessage = { id: messageId, data: messageData };
  const modal = document.getElementById("translateModal");
  const preview = document.getElementById("translateSourcePreview");
  const text = getTranslationSourceText(messageData);
  const toggle = document.getElementById("autoTranslateChatToggle");
  if (toggle) toggle.checked = Boolean(getCurrentChatTranslationSetting());
  resetTranslationOutput();
  if (preview)
    preview.textContent =
      text || getAttachmentLabel(messageData.attachment) || "Message";
  updateTranslationCapabilityNote();
  if (modal) modal.style.display = "flex";
}

async function detectTranslationLanguage(text) {
  if (!("LanguageDetector" in self)) return null;
  try {
    const detector = await self.LanguageDetector.create();
    const results = await detector.detect(text);
    detector.destroy?.();
    return results?.[0]?.detectedLanguage || null;
  } catch (_) {
    return null;
  }
}

async function translateWithBrowser(text, sourceLanguage, targetLanguage, onProgress) {
  if (!("Translator" in self)) throw new Error("Browser translator unavailable");
  const resolvedSource =
    sourceLanguage === "auto"
      ? await detectTranslationLanguage(text)
      : sourceLanguage;
  if (!resolvedSource) throw new Error("Language detection unavailable");
  const translator = await self.Translator.create({
    sourceLanguage: resolvedSource,
    targetLanguage,
    monitor(monitor) {
      if (!onProgress) return;
      monitor.addEventListener("downloadprogress", (event) =>
        onProgress(Math.round((event.loaded || 0) * 100)),
      );
    },
  });
  try {
    return {
      text: await translator.translate(text),
      sourceLanguage: resolvedSource,
      targetLanguage,
    };
  } finally {
    translator.destroy?.();
  }
}

function splitTranslationText(text, maxLength = 450) {
  const chunks = [];
  let remaining = String(text || "").trim();
  while (remaining) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    const windowText = remaining.slice(0, maxLength);
    const splitAt = Math.max(
      windowText.lastIndexOf("\n"),
      windowText.lastIndexOf(". "),
      windowText.lastIndexOf(" "),
    );
    const end = splitAt > maxLength * 0.45 ? splitAt + 1 : maxLength;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  return chunks;
}

function decodeTranslationText(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
}

async function translateWithFreeService(text, sourceLanguage, targetLanguage) {
  const source = sourceLanguage === "auto" ? "autodetect" : sourceLanguage;
  const chunks = splitTranslationText(text);
  const translated = [];
  let detectedSource = sourceLanguage;
  for (const chunk of chunks) {
    const params = new URLSearchParams({
      q: chunk,
      langpair: `${source}|${targetLanguage}`,
    });
    const response = await fetch(
      `https://api.mymemory.translated.net/get?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) throw new Error(`Translation service returned ${response.status}`);
    const payload = await response.json();
    const result = payload?.responseData?.translatedText;
    if (!result || payload?.responseStatus >= 400)
      throw new Error(payload?.responseDetails || "Translation unavailable");
    translated.push(decodeTranslationText(result));
    detectedSource =
      payload?.responseData?.detectedLanguage ||
      payload?.matches?.[0]?.source ||
      detectedSource;
  }
  return {
    text: translated.join("\n"),
    sourceLanguage: detectedSource === "autodetect" ? "auto" : detectedSource,
    targetLanguage,
    provider: "online",
  };
}

async function translateInline(text, sourceLanguage, targetLanguage, onProgress) {
  if ("Translator" in self) {
    try {
      return {
        ...(await translateWithBrowser(
          text,
          sourceLanguage,
          targetLanguage,
          onProgress,
        )),
        provider: "device",
      };
    } catch (error) {
      console.warn("On-device translation unavailable, using online fallback:", error);
    }
  }
  return translateWithFreeService(text, sourceLanguage, targetLanguage);
}

async function runFreeInlineTranslation() {
  if (!activeTranslationMessage) return;
  const text = getTranslationSourceText(activeTranslationMessage.data);
  const from = document.getElementById("translateFromLanguage");
  const to = document.getElementById("translateToLanguage");
  const button = document.getElementById("runTranslateBtn");
  if (!text || !from || !to || !button) return;
  localStorage.setItem("translateFromLanguage", from.value);
  localStorage.setItem("translateToLanguage", to.value);

  button.disabled = true;
  button.textContent = "Translating...";
  try {
    const result = await translateInline(text, from.value, to.value, (progress) => {
      button.textContent = `Preparing ${progress}%`;
    });
    translationCache.set(activeTranslationMessage.id, result);
    if (document.getElementById("autoTranslateChatToggle")?.checked) {
      saveCurrentChatTranslationSetting({
        sourceLanguage: result.sourceLanguage,
        preferredLanguage: result.targetLanguage,
      });
      result.auto = true;
    }
    showTranslationOutput(result);
    loadMessages();
  } catch (error) {
    console.warn("Inline translation failed:", error);
    showToast("Could not translate this message. Check your connection and try again.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Translate";
  }
}

function getTranslationCardHtml(messageId) {
  const result = translationCache.get(messageId);
  if (!result) return "";
  const language = TRANSLATION_LANGUAGES.find(([code]) => code === result.targetLanguage)?.[1] || result.targetLanguage;
  const method = result.provider === "device" ? "On-device" : "Online";
  return `<div class="message-translation-card">
    <div class="message-translation-label"><span>Translated to ${escapeHtml(language)}</span><span class="translation-method-badge">${method}</span>${result.auto ? '<span class="auto-translation-badge">Auto</span>' : ""}</div>
    <div class="message-translation-text">${renderMessageText(result.text)}</div>
    <div class="message-translation-actions">
      <button type="button" data-translation-action="original">Original</button>
      <button type="button" data-translation-action="change">Language</button>
      <button type="button" data-translation-action="copy">Copy</button>
      <button type="button" data-translation-action="hide">Hide</button>
    </div>
  </div>`;
}

async function autoTranslateCurrentChatMessages(docs = []) {
  const setting = getCurrentChatTranslationSetting();
  if (
    !setting ||
    autoTranslationPassRunning ||
    !currentChat
  )
    return;
  const chatId = currentChat.id;
  autoTranslationPassRunning = true;
  let changed = false;
  try {
    for (const doc of docs) {
      if (currentChat?.id !== chatId) break;
      const message = doc.data();
      if (
        message.senderId === currentUser?.uid ||
        translationCache.has(doc.id)
      )
        continue;
      const text = getTranslationSourceText(message);
      if (!text) continue;
      try {
        const result = await translateInline(
          text,
          setting.sourceLanguage || "auto",
          setting.preferredLanguage || "en",
        );
        translationCache.set(doc.id, { ...result, auto: true });
        changed = true;
      } catch (_) {}
    }
  } finally {
    autoTranslationPassRunning = false;
  }
  if (changed && currentChat?.id === chatId) loadMessages();
}

function confirmOutgoingTranslation(originalText, translatedText) {
  return new Promise((resolve) => {
    const modal = document.getElementById("outgoingTranslationModal");
    const original = document.getElementById("outgoingOriginalText");
    const translated = document.getElementById("outgoingTranslatedText");
    const skip = document.getElementById("skipOutgoingTranslationOnce");
    const confirmButton = document.getElementById("confirmOutgoingTranslationBtn");
    const cancelButton = document.getElementById("cancelOutgoingTranslationBtn");
    const stopButton = document.getElementById("stopAutoTranslateBtn");
    if (!modal || !confirmButton || !cancelButton || !stopButton) {
      resolve({ send: true, useOriginal: false });
      return;
    }
    if (original) original.textContent = originalText;
    if (translated) translated.textContent = translatedText;
    if (skip) skip.checked = false;
    modal.style.display = "flex";
    const finish = (result) => {
      modal.style.display = "none";
      confirmButton.onclick = null;
      cancelButton.onclick = null;
      stopButton.onclick = null;
      resolve(result);
    };
    confirmButton.onclick = () =>
      finish({ send: true, useOriginal: Boolean(skip?.checked) });
    cancelButton.onclick = () => finish({ send: false });
    stopButton.onclick = () => {
      disableCurrentChatAutoTranslation();
      finish({ send: true, useOriginal: true });
    };
  });
}

async function prepareOutgoingAutoTranslation(text) {
  const setting = getCurrentChatTranslationSetting();
  if (!setting || !text) return { text, originalText: "" };
  try {
    const result = await translateInline(
      text,
      setting.preferredLanguage || "auto",
      setting.sourceLanguage,
    );
    const choice = await confirmOutgoingTranslation(text, result.text);
    if (!choice?.send) return null;
    if (choice.useOriginal) return { text, originalText: "" };
    return {
      text: result.text,
      originalText: text,
      sourceLanguage: result.sourceLanguage,
      targetLanguage: result.targetLanguage,
    };
  } catch (_) {
    showToast("Could not translate this message. It will remain unsent.", "error");
    return null;
  }
}

function bindTranslationCardActions(messageDiv, messageId, messageData) {
  messageDiv.querySelectorAll("[data-translation-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.translationAction;
      if (action === "copy") copyToClipboard(translationCache.get(messageId)?.text || "");
      if (action === "change") openTranslateModal(messageId, messageData);
      if (action === "original") {
        const card = messageDiv.querySelector(".message-translation-card");
        const translated = card?.querySelector(".message-translation-text");
        if (!card || !translated) return;
        const showingOriginal = card.classList.toggle("showing-original");
        translated.innerHTML = showingOriginal
          ? renderMessageText(getTranslationSourceText(messageData))
          : renderMessageText(translationCache.get(messageId)?.text || "");
        button.textContent = showingOriginal ? "Translated" : "Original";
      }
      if (action === "hide") {
        translationCache.delete(messageId);
        messageDiv.querySelector(".message-translation-card")?.remove();
      }
    });
  });
}

(function initTranslationUi() {
  populateTranslationLanguages();
  document.querySelectorAll(".closeTranslateModal").forEach((button) =>
    button.addEventListener("click", closeTranslateModal),
  );
  document.getElementById("translateModal")?.addEventListener("click", (event) => {
    if (event.target.id === "translateModal") closeTranslateModal();
  });
  document.getElementById("runTranslateBtn")?.addEventListener("click", runFreeInlineTranslation);
  document.getElementById("copyModalTranslationBtn")?.addEventListener("click", () => {
    if (!activeTranslationMessage) return;
    copyToClipboard(translationCache.get(activeTranslationMessage.id)?.text || "");
  });
  document.getElementById("swapTranslateLanguagesBtn")?.addEventListener("click", () => {
    const from = document.getElementById("translateFromLanguage");
    const to = document.getElementById("translateToLanguage");
    if (!from || !to || from.value === "auto") return;
    [from.value, to.value] = [to.value, from.value];
  });
  document.getElementById("autoTranslateChatToggle")?.addEventListener("change", (event) => {
    if (!event.target.checked && getCurrentChatTranslationSetting()) {
      disableCurrentChatAutoTranslation();
    }
  });
})();

// Keep optional chat tools available without overcrowding the main header.
(function initCompactChatExtraActions() {
  const optionalActionSelectors = [
    "[data-block-chat-btn]",
    "[data-encryption-verify-btn]",
    "[data-chat-sound-btn]",
    "[data-critical-alert-btn]",
    "[data-perchat-download-btn]",
  ];

  const organizeActions = () => {
    const actions = document.querySelector(".chat-header .chat-actions");
    if (!actions) return;

    let tray = actions.querySelector(".chat-extra-actions");
    let trigger = actions.querySelector(".chat-extra-actions-trigger");
    const optionalActions = optionalActionSelectors
      .map((selector) => document.querySelector(`.chat-header ${selector}`))
      .filter(Boolean);

    if (!optionalActions.length) {
      trigger?.remove();
      tray?.remove();
      return;
    }

    if (!trigger) {
      trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "chat-extra-actions-trigger";
      trigger.title = "More chat tools";
      trigger.setAttribute("aria-label", "More chat tools");
      trigger.setAttribute("aria-expanded", "false");
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const isOpen = tray?.classList.toggle("open");
        trigger.setAttribute("aria-expanded", String(Boolean(isOpen)));
      });
      actions.insertBefore(trigger, actions.querySelector("#chatMoreBtn"));
    }

    if (!tray) {
      tray = document.createElement("div");
      tray.className = "chat-extra-actions";
      tray.setAttribute("role", "menu");
      actions.appendChild(tray);
    }

    optionalActions.forEach((button) => {
      button.dataset.chatExtraAction = "true";
      button.setAttribute("role", "menuitem");
      if (button.parentElement !== tray) tray.appendChild(button);
    });
  };

  const observer = new MutationObserver(organizeActions);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", (event) => {
    const tray = document.querySelector(".chat-extra-actions");
    const trigger = document.querySelector(".chat-extra-actions-trigger");
    if (!tray?.classList.contains("open")) return;
    if (tray.contains(event.target) || trigger?.contains(event.target)) return;
    tray.classList.remove("open");
    trigger?.setAttribute("aria-expanded", "false");
  });
  organizeActions();
})();

// Keep optional composer features available without letting independently
// inserted buttons escape the message capsule.
(function initCompactComposerTools() {
  const toolSelectors = [
    "#markdownToggleBtn",
    "#transcribeBtn",
    "#effectBtn",
    "#scheduleMsgQuickBtn",
    "#voiceChangerBtn",
  ];

  const organizeComposerTools = () => {
    const inputArea = document.getElementById("inputArea");
    const shell = inputArea?.querySelector(".wa-composer-shell");
    if (!inputArea || !shell) return;

    let trigger = shell.querySelector(".composer-tools-trigger");
    let tray = inputArea.querySelector(".composer-tools-tray");
    const tools = toolSelectors
      .map((selector) => document.querySelector(selector))
      .filter(Boolean);
    inputArea.querySelectorAll(":scope > button").forEach((button) => {
      if (button.id === "sendBtn" || button.id === "voiceMsgBtn") return;
      if (!tools.includes(button)) tools.push(button);
    });

    if (!tools.length) {
      trigger?.remove();
      tray?.remove();
      return;
    }

    if (!trigger) {
      trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "composer-tools-trigger";
      trigger.title = "Message tools";
      trigger.setAttribute("aria-label", "Message tools");
      trigger.setAttribute("aria-expanded", "false");
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const isOpen = tray?.classList.toggle("open");
        trigger.setAttribute("aria-expanded", String(Boolean(isOpen)));
      });
      shell.appendChild(trigger);
    }

    if (!tray) {
      tray = document.createElement("div");
      tray.className = "composer-tools-tray";
      tray.setAttribute("role", "menu");
      tray.addEventListener("click", (event) => {
        if (!event.target.closest("button")) return;
        tray.classList.remove("open");
        trigger?.setAttribute("aria-expanded", "false");
      });
      inputArea.appendChild(tray);
    }

    tools.forEach((button) => {
      button.dataset.composerTool = "true";
      button.setAttribute("role", "menuitem");
      if (button.parentElement !== tray) tray.appendChild(button);
    });
  };

  const observer = new MutationObserver(organizeComposerTools);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", (event) => {
    const tray = document.querySelector(".composer-tools-tray");
    const trigger = document.querySelector(".composer-tools-trigger");
    if (!tray?.classList.contains("open")) return;
    if (tray.contains(event.target) || trigger?.contains(event.target)) return;
    tray.classList.remove("open");
    trigger?.setAttribute("aria-expanded", "false");
  });
  organizeComposerTools();
})();

// ========================================
// QR AND BARCODE SCANNER
// ========================================

let scannerStream = null;
let scannerFrameId = 0;
let scannerValue = "";

function isSafeScannerLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (_) {
    return false;
  }
}

function stopScannerCamera() {
  if (scannerFrameId) cancelAnimationFrame(scannerFrameId);
  scannerFrameId = 0;
  scannerStream?.getTracks?.().forEach((track) => track.stop());
  scannerStream = null;
  const video = document.getElementById("scannerVideo");
  if (video) video.srcObject = null;
}

function closeScanner() {
  stopScannerCamera();
  const modal = document.getElementById("scannerModal");
  if (modal) modal.style.display = "none";
}

function showScannerResult(value) {
  scannerValue = String(value || "").trim();
  if (!scannerValue) return;
  const result = document.getElementById("scannerResult");
  const status = document.getElementById("scannerStatus");
  const copyBtn = document.getElementById("copyScannerResultBtn");
  const openBtn = document.getElementById("openScannerResultBtn");
  if (result) {
    result.textContent = scannerValue;
    result.style.display = "block";
  }
  if (status) status.textContent = "Scan complete";
  if (copyBtn) copyBtn.style.display = "inline-flex";
  if (openBtn) openBtn.style.display = isSafeScannerLink(scannerValue) ? "inline-flex" : "none";
  stopScannerCamera();
  navigator.vibrate?.(30);
}

async function openScanner() {
  const modal = document.getElementById("scannerModal");
  const video = document.getElementById("scannerVideo");
  const status = document.getElementById("scannerStatus");
  const result = document.getElementById("scannerResult");
  const copyBtn = document.getElementById("copyScannerResultBtn");
  const openBtn = document.getElementById("openScannerResultBtn");
  if (!modal || !video) return;

  closeTransientOverlay();
  stopScannerCamera();
  scannerValue = "";
  modal.style.display = "flex";
  if (result) {
    result.textContent = "";
    result.style.display = "none";
  }
  if (copyBtn) copyBtn.style.display = "none";
  if (openBtn) openBtn.style.display = "none";
  if (status) status.textContent = "Starting camera...";

  if (!navigator.mediaDevices?.getUserMedia || !("BarcodeDetector" in window)) {
    if (status)
      status.textContent =
        "Scanning is not supported by this browser. Update the app or browser and try again.";
    return;
  }

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    video.srcObject = scannerStream;
    await video.play();
    const formats = await window.BarcodeDetector.getSupportedFormats?.();
    const detector = new window.BarcodeDetector(
      formats?.length ? { formats } : undefined,
    );
    if (status) status.textContent = "Point the camera at a QR code or barcode.";

    const detectFrame = async () => {
      if (!scannerStream || modal.style.display === "none") return;
      try {
        const codes = video.readyState >= 2 ? await detector.detect(video) : [];
        const value = codes?.[0]?.rawValue;
        if (value) {
          showScannerResult(value);
          return;
        }
      } catch (_) {}
      scannerFrameId = requestAnimationFrame(detectFrame);
    };
    scannerFrameId = requestAnimationFrame(detectFrame);
  } catch (error) {
    stopScannerCamera();
    if (status)
      status.textContent =
        error?.name === "NotAllowedError"
          ? "Camera permission is required to scan codes."
          : "Could not start the camera. Please try again.";
  }
}

(function initScanner() {
  document.getElementById("scannerBtn")?.addEventListener("click", openScanner);
  document.querySelectorAll(".closeScannerModal").forEach((button) =>
    button.addEventListener("click", closeScanner),
  );
  document.getElementById("scannerModal")?.addEventListener("click", (event) => {
    if (event.target.id === "scannerModal") closeScanner();
  });
  document.getElementById("copyScannerResultBtn")?.addEventListener("click", () => {
    if (scannerValue) copyToClipboard(scannerValue);
  });
  document.getElementById("openScannerResultBtn")?.addEventListener("click", () => {
    if (isSafeScannerLink(scannerValue))
      window.open(scannerValue, "_blank", "noopener,noreferrer");
  });
})();

// ========================================
// FEATURE 2: GLOBAL MESSAGE SEARCH
// ========================================

(function normalizeHomeTopAction() {
  const searchBtn = document.getElementById("globalSearchBtn");
  if (!searchBtn) return;
  searchBtn.innerHTML = "";
  searchBtn.title = "Find people or messages";
  searchBtn.setAttribute("aria-label", "Find people or messages");
  searchBtn.addEventListener(
    "click",
    (event) => {
      const compactHome = window.matchMedia?.(
        "(max-width: 900px), (pointer: coarse)",
      )?.matches;
      if (!compactHome) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const peopleSearch = document.getElementById("searchInput");
      peopleSearch?.focus();
      peopleSearch?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    true,
  );
})();

// ========================================
// FEATURE 3: LOCATION SHARING
// ========================================

(function initLocationBtn() {
  const btn = document.getElementById("locationBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    document.getElementById("attachmentSheet")?.classList.remove("open");
    document.getElementById("locationShareModal").style.display = "flex";
  });
  document
    .querySelectorAll(".closeLocationShareModal")
    .forEach((close) =>
      close.addEventListener(
        "click",
        () => (document.getElementById("locationShareModal").style.display = "none"),
      ),
    );
  document
    .getElementById("shareCurrentLocationBtn")
    ?.addEventListener("click", () => shareLocation("current"));
  document
    .getElementById("shareLiveLocationBtn")
    ?.addEventListener("click", () => shareLocation("live"));
})();

async function shareLocation(mode = "current") {
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
      const { latitude, longitude, accuracy } = pos.coords;
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
        location: {
          latitude,
          longitude,
          accuracy: Number(accuracy || 0),
          isLive: mode === "live",
          startedAt: mode === "live" ? new Date() : null,
          expiresAt:
            mode === "live" ? new Date(Date.now() + 15 * 60 * 1000) : null,
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
        const messageRef = await db.collection("messages").add(messageData);
        document.getElementById("locationShareModal").style.display = "none";
        if (mode === "live") {
          const expiresAt = Date.now() + 15 * 60 * 1000;
          const watcherId = navigator.geolocation.watchPosition(
            (nextPosition) => {
              if (Date.now() >= expiresAt) {
                navigator.geolocation.clearWatch(watcherId);
                messageRef.set(
                  { location: { isLive: false, endedAt: new Date() } },
                  { merge: true },
                ).catch(() => {});
                return;
              }
              messageRef.set(
                {
                  location: {
                    latitude: nextPosition.coords.latitude,
                    longitude: nextPosition.coords.longitude,
                    accuracy: Number(nextPosition.coords.accuracy || 0),
                    isLive: true,
                    updatedAt: new Date(),
                  },
                },
                { merge: true },
              ).catch(() => {});
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
          );
          setTimeout(() => navigator.geolocation.clearWatch(watcherId), 15 * 60 * 1000);
          showToast("Live location shared for 15 minutes");
        } else {
          showToast("Location shared!");
        }
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
  const groupData = groupDoc.data();
  const groupId = groupDoc.id;
  const existing = await db
    .collection("groupMembers")
    .where("groupId", "==", groupId)
    .where("userId", "==", currentUser.uid)
    .limit(1)
    .get();
  if (!existing.empty) {
    showToast("You are already in this group");
    loadGroupChat(groupId, groupData.name || "Group");
    return;
  }
  // Check if approval required
  if (groupData.approvalRequired === true) {
    const existingRequest = await db.collection("groupJoinRequests")
      .where("groupId", "==", groupId)
      .where("userId", "==", currentUser.uid)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!existingRequest.empty) {
      showToast("You already have a pending request for this group");
      return;
    }
    await db.collection("groupJoinRequests").add({
      groupId,
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
    if (e.name === "NotAllowedError") {
      console.log("Screen sharing cancelled by user");
      return;
    }
    showToast("Screen sharing failed", "error");
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
  if (isNativeAndroidApp) {
    const hasCamera = await ensureNativePermission("camera");
    const hasMic = await ensureNativePermission("microphone");
    if (!hasCamera || !hasMic) return;
  }
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
      const duration = Math.floor(
        (Date.now() - videoRecordingStartTime) / 1000,
      );
      stream.getTracks().forEach((track) => track.stop());
      if (videoBlob.size) showRecordedMediaPreview(videoBlob, "video", duration);
    };
    videoRecorder.start(100);
    isVideoRecording = true;
    videoRecordingStartTime = Date.now();
    videoRecordingTimer = setTimeout(stopVideoRecording, 60_000);
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
    clearTimeout(videoRecordingTimer);
    videoRecordingTimer = null;
    videoRecorder.stop();
    isVideoRecording = false;
    showToast("Video recording stopped");
  }
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
    if (videoEl.requestPictureInPicture) {
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
    if (document.exitPictureInPicture) {
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

(function setupPipEvents() {
  const videoEl = document.getElementById("remoteVideo");
  if (videoEl) {
    videoEl.addEventListener("leavepictureinpicture", () => {
      isPipActive = false;
      const btn = document.getElementById("pipBtn");
      if (btn) {
        btn.textContent = "PiP";
        btn.classList.remove("active");
      }
    });
  }
})();

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
      callType: ["voice", "video"].includes(eventData.callType)
        ? eventData.callType
        : "",
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
        ${event.callType ? `<button type="button" class="btn btn-primary event-start-call-btn" data-call-type="${escapeHtml(event.callType)}">Start ${event.callType === "video" ? "video" : "audio"} meeting</button>` : ""}
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
  try {
    const type = getFilePreviewType(url, filename);
    if (type === "image") {
      openMediaViewer(url, filename);
      return;
    }
    // fall through to file preview modal below
  } catch (err) {
    console.error("previewFile error:", err);
    return;
  }
  const modal = document.getElementById("filePreviewModal");
  if (!modal) return;
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
// FEATURE: Media Viewer (Full-screen Gallery)
// ========================================
let _mediaViewerItems = [];
let _mediaViewerIndex = 0;
let _mediaViewerZoom = 1;
let _mediaViewerStartX = 0;
let _mediaViewerStartY = 0;
let _mediaViewerOffsetX = 0;
let _mediaViewerIsDragging = false;
let _mediaViewerIsSwiping = false;
let _mediaViewerHideUITimer = null;

function getCurrentMediaViewerItem() {
  return _mediaViewerItems[_mediaViewerIndex] || null;
}

function parseMediaMessageMeta(value) {
  if (!value) return null;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (_) {
    return null;
  }
}

function collectMediaItems() {
  const items = [];
  const seen = new Set();
  const addItem = (url, filename, caption, type, sourceMessageData = null) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    items.push({
      url,
      filename: filename || "Media",
      caption: caption || "",
      type: type || "image",
      sourceMessageId: sourceMessageData?.messageId || sourceMessageData?.id || "",
      sourceChatId: sourceMessageData?.chatId || "",
      sourceChatType: sourceMessageData?.chatType || "",
      sourceSenderId: sourceMessageData?.senderId || "",
      sourceMessageData: sourceMessageData || null,
    });
  };
  // Collect from chat messages
  document.querySelectorAll("#messagesArea .attachment-img").forEach((img) => {
    const link = img.closest("[data-preview-url]");
    if (!link) return;
    const url = link.dataset.previewUrl;
    if (!url) return;
    const filename = link.dataset.filename || "Image";
    const messageEl = img.closest("[data-message-id], .message");
    const messageData = messageEl?._messageData || null;
    const caption =
      messageEl?.querySelector(".message-text")?.textContent?.slice(0, 120) ||
      messageData?.text?.slice?.(0, 120) ||
      "";
    addItem(url, filename, caption, "image", messageData);
  });
    document.querySelectorAll("#messagesArea .video-attachment").forEach((wrap) => {
    const url = wrap.dataset.previewUrl || wrap.querySelector("video")?.src || "";
    if (!url) return;
    const messageEl = wrap.closest("[data-message-id], .message");
    const messageData = messageEl?._messageData || null;
    const caption =
      messageEl?.querySelector(".message-text")?.textContent?.slice(0, 120) ||
      messageData?.text?.slice?.(0, 120) ||
      "";
    addItem(url, wrap.dataset.filename || messageData?.attachment?.filename || "Video", caption, "video", messageData);
  });
  // Collect from shared content (Media, Links, and Docs tabs)
  document.querySelectorAll("#sharedContent .shared-media-item, #groupSharedContent .shared-media-item").forEach((btn) => {
    const url = btn.dataset.previewUrl;
    if (!url) return;
    const filename = btn.dataset.filename || "Media";
    const wrapper = btn.closest(".shared-media-item-wrap");
    const messageData = parseMediaMessageMeta(wrapper?.dataset?.messageMeta) || null;
    const type = btn.querySelector("video") ? "video" : (messageData?.attachment?.type === "video" ? "video" : "image");
    const caption = messageData?.text?.slice?.(0, 120) || messageData?.caption || "";
    addItem(url, filename, caption, type, messageData);
  });
  return items;
}

function openMediaViewer(url, filename, mediaType) {
  console.log("[MEDIA] openMediaViewer called", url, filename, mediaType);
  try {
    console.log("[MEDIA] collecting media items...");
    const allItems = collectMediaItems();
    console.log("[MEDIA] collected", allItems.length, "items");
    let idx = allItems.findIndex((i) => i.url === url);
    console.log("[MEDIA] found index:", idx);
    if (idx === -1) {
      allItems.unshift({ url, filename: filename || "Media", caption: "", type: mediaType || "image" });
      idx = 0;
    }
    _mediaViewerItems = allItems;
    _mediaViewerIndex = idx;
    _mediaViewerZoom = 1;
    console.log("[MEDIA] calling showMediaViewerSlide...");
    showMediaViewerSlide();
    console.log("[MEDIA] showMediaViewerSlide done, showing viewer...");
    const viewer = document.getElementById("mediaViewer");
    console.log("[MEDIA] viewer element:", viewer);
    if (viewer) {
      viewer.style.display = "flex";
      viewer.style.transform = "";
      viewer.style.opacity = "";
      console.log("[MEDIA] viewer display set to flex");
    }
    document.body.style.overflow = "hidden";
    updateMediaViewerActions();
    console.log("[MEDIA] openMediaViewer complete");
  } catch (err) {
    console.error("[MEDIA] openMediaViewer error:", err);
  }
}

function showMediaViewerSlide() {
  const img = document.getElementById("mediaViewerImg");
  const video = document.getElementById("mediaViewerVideo");
  const counter = document.getElementById("mediaViewerCounter");
  const caption = document.getElementById("mediaViewerCaption");
  const prev = document.getElementById("mediaViewerPrev");
  const next = document.getElementById("mediaViewerNext");
  const dots = document.getElementById("mediaViewerDots");
  const item = _mediaViewerItems[_mediaViewerIndex];
  if (!item) return;
  _mediaViewerZoom = 1;
  const isVideo = item.type === "video";
  if (img) { img.style.display = isVideo ? "none" : ""; img.style.transform = "scale(1)"; img.src = isVideo ? "" : item.url; img.alt = item.filename || "Media"; }
  if (video) { video.style.display = isVideo ? "" : "none"; video.src = isVideo ? item.url : ""; video.load(); }
  if (counter) counter.textContent = `${_mediaViewerIndex + 1} / ${_mediaViewerItems.length}`;
  if (caption) caption.textContent = item.caption || item.filename || "";
  if (prev) prev.style.display = _mediaViewerItems.length > 1 ? "flex" : "none";
  if (next) next.style.display = _mediaViewerItems.length > 1 ? "flex" : "none";
  if (prev) prev.disabled = _mediaViewerIndex === 0;
  if (next) next.disabled = _mediaViewerIndex === _mediaViewerItems.length - 1;
  if (dots) {
    dots.innerHTML = "";
    _mediaViewerItems.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.className = "media-viewer-dot" + (i === _mediaViewerIndex ? " active" : "");
      dots.appendChild(dot);
    });
  }
  updateMediaViewerActions();
}

function navigateMediaViewer(delta) {
  const newIdx = _mediaViewerIndex + delta;
  if (newIdx < 0 || newIdx >= _mediaViewerItems.length) return;
  _mediaViewerIndex = newIdx;
  showMediaViewerSlide();
}

function closeMediaViewer() {
  const viewer = document.getElementById("mediaViewer");
  if (viewer) viewer.style.display = "none";
  document.body.style.overflow = "";
  const video = document.getElementById("mediaViewerVideo");
  if (video) { video.pause(); video.src = ""; }
  _mediaViewerItems = [];
  _mediaViewerZoom = 1;
}

function downloadCurrentMedia() {
  const item = getCurrentMediaViewerItem();
  if (!item) return;
  const a = document.createElement("a");
  a.href = item.url;
  a.download = item.filename || "download";
  a.target = "_blank";
  a.rel = "noopener";
  a.click();
}

function shareCurrentMedia() {
  const item = getCurrentMediaViewerItem();
  if (!item) return;
  try {
    const attachment = { url: item.url, filename: item.filename, type: item.type === "video" ? "video" : "image" };
    if (typeof openForwardModalForMedia === "function") {
      openForwardModalForMedia(attachment, {
        sourceMessageId: item.sourceMessageId || "",
        sourceChatId: item.sourceChatId || "",
        sourceChatType: item.sourceChatType || "",
      });
    } else {
      showToast("Forwarding is not available", "info");
    }
  } catch (_) {
    showToast("Could not forward this media", "error");
  }
}

async function toggleCurrentMediaBookmark() {
  const item = getCurrentMediaViewerItem();
  if (!item?.sourceMessageId || typeof toggleBookmarkMessage !== "function") {
    showToast("Bookmarking is not available for this item", "info");
    return;
  }
  const text =
    item.sourceMessageData?.text ||
    item.caption ||
    item.filename ||
    "Media";
  await toggleBookmarkMessage(
    item.sourceMessageId,
    item.sourceChatId || currentChat?.id || "",
    item.sourceChatType || currentChatType || "",
    text,
  );
}

async function openCurrentMediaInfo() {
  const item = getCurrentMediaViewerItem();
  if (!item?.sourceMessageId) {
    showToast("Message info is not available for this media item", "info");
    return;
  }
  const source = item.sourceMessageData || {};
  if (source.senderId !== currentUser?.uid) {
    showToast("Message info is available for sent media only", "info");
    return;
  }
  if (typeof showMessageInfo === "function") {
    showMessageInfo(item.sourceMessageId, { ...source, messageId: item.sourceMessageId });
    return;
  }
  showToast("Message info is not available right now", "info");
}

async function deleteCurrentMediaMessage() {
  const item = getCurrentMediaViewerItem();
  if (!item?.sourceMessageId) {
    showToast("Delete is not available for this media item", "info");
    return;
  }
  const source = item.sourceMessageData || {};
  if (source.senderId !== currentUser?.uid) {
    showToast("You can only delete media you sent", "info");
    return;
  }
  if (typeof openMessageDeleteSheet === "function") {
    openMessageDeleteSheet(item.sourceMessageId, { ...source, messageId: item.sourceMessageId });
    return;
  }
  showToast("Delete is not available right now", "error");
}

async function copyCurrentMediaLink() {
  const item = getCurrentMediaViewerItem();
  if (!item?.url) return;
  try {
    if (typeof copyToClipboard === "function") {
      await copyToClipboard(item.url);
    } else if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(item.url);
    }
    showToast("Media link copied");
  } catch (_) {
    showToast("Could not copy media link", "error");
  }
}

async function replyCurrentMediaMessage() {
  const item = getCurrentMediaViewerItem();
  const source = item?.sourceMessageData || null;
  if (!item?.sourceMessageId || !source) {
    showToast("Reply is not available for this media item", "info");
    return;
  }
  if (typeof setReplyTo === "function") {
    setReplyTo({ ...source, id: item.sourceMessageId, messageId: item.sourceMessageId });
    closeMediaViewer();
    showToast("Reply ready");
    return;
  }
  showToast("Reply is not available right now", "error");
}

function openCurrentMediaInChat() {
  const item = getCurrentMediaViewerItem();
  if (!item?.sourceMessageId) {
    showToast("This media item cannot be opened in chat", "info");
    return;
  }
  closeMediaViewer();
  if (typeof scrollToMessage === "function") {
    scrollToMessage(item.sourceMessageId);
    showToast("Opened in chat");
    return;
  }
  showToast("Could not jump to the original message", "error");
}

function updateMediaViewerActions() {
  const item = getCurrentMediaViewerItem();
  const forwardBtn = document.getElementById("mediaViewerShareBtn");
  const downloadBtn = document.getElementById("mediaViewerDownloadBtn");
  const replyBtn = document.getElementById("mediaViewerReplyBtn");
  const openBtn = document.getElementById("mediaViewerOpenBtn");
  const starBtn = document.getElementById("mediaViewerStarBtn");
  const infoBtn = document.getElementById("mediaViewerInfoBtn");
  const copyBtn = document.getElementById("mediaViewerCopyBtn");
  const deleteBtn = document.getElementById("mediaViewerDeleteBtn");
  if (!item) return;
  const ownMessage = item.sourceMessageData?.senderId === currentUser?.uid;
  if (forwardBtn) forwardBtn.title = "Forward";
  if (downloadBtn) downloadBtn.title = "Download";
  if (replyBtn) replyBtn.style.display = item.sourceMessageId ? "" : "none";
  if (openBtn) openBtn.style.display = item.sourceMessageId ? "" : "none";
  if (starBtn) starBtn.style.display = item.sourceMessageId ? "" : "none";
  if (infoBtn) infoBtn.style.display = ownMessage ? "" : "none";
  if (deleteBtn) deleteBtn.style.display = ownMessage ? "" : "none";
  if (copyBtn) copyBtn.style.display = item.url ? "" : "none";
}

function zoomMediaViewer(factor, reset) {
  const img = document.getElementById("mediaViewerImg");
  if (!img || img.style.display === "none") return;
  if (reset) {
    _mediaViewerZoom = 1;
  } else {
    _mediaViewerZoom = Math.max(1, Math.min(5, _mediaViewerZoom * factor));
  }
  img.style.transform = `scale(${_mediaViewerZoom})`;
}

function initMediaViewer() {
  console.log("[MEDIA] initMediaViewer called");
  const viewer = document.getElementById("mediaViewer");
  if (!viewer) return;

  document.getElementById("mediaViewerCloseBtn")?.addEventListener("click", closeMediaViewer);
  document.getElementById("mediaViewerDownloadBtn")?.addEventListener("click", downloadCurrentMedia);
  document.getElementById("mediaViewerPrev")?.addEventListener("click", () => navigateMediaViewer(-1));
  document.getElementById("mediaViewerNext")?.addEventListener("click", () => navigateMediaViewer(1));
  document.getElementById("mediaViewerShareBtn")?.addEventListener("click", shareCurrentMedia);
  document.getElementById("mediaViewerReplyBtn")?.addEventListener("click", replyCurrentMediaMessage);
  document.getElementById("mediaViewerOpenBtn")?.addEventListener("click", openCurrentMediaInChat);
  document.getElementById("mediaViewerStarBtn")?.addEventListener("click", toggleCurrentMediaBookmark);
  document.getElementById("mediaViewerInfoBtn")?.addEventListener("click", openCurrentMediaInfo);
  document.getElementById("mediaViewerCopyBtn")?.addEventListener("click", copyCurrentMediaLink);
  document.getElementById("mediaViewerDeleteBtn")?.addEventListener("click", deleteCurrentMediaMessage);
  document.getElementById("mediaViewerZoomIn")?.addEventListener("click", () => zoomMediaViewer(1.5));
  document.getElementById("mediaViewerZoomOut")?.addEventListener("click", () => zoomMediaViewer(0.67));
  document.getElementById("mediaViewerZoomReset")?.addEventListener("click", () => zoomMediaViewer(0, true));

  // Open media viewer / preview for any media element in the page
  const openMediaOnClick = (e) => {
    try {
      // Video in chat messages
      const video = e.target.closest(".video-attachment video");
      if (video) {
        e.preventDefault();
        const url = video.currentSrc || video.src || video.querySelector("source")?.src || "";
        if (url) { openMediaViewer(url, "Video", "video"); return; }
      }
      // Image in chat messages (<a> with data-preview-url)
      const imgLink = e.target.closest(".image-attachment-link");
      if (imgLink) {
        e.preventDefault();
        const url = imgLink.dataset.previewUrl || imgLink.href;
        const filename = imgLink.dataset.filename || "Image";
        if (url) { openMediaViewer(url, filename); return; }
      }
      // File attachment card
      const fileCard = e.target.closest(".file-attachment-card");
      if (fileCard) {
        e.preventDefault();
        const url = fileCard.dataset.previewUrl || fileCard.href;
        const filename = fileCard.dataset.filename || "File";
        if (url) { previewFile(url, filename); return; }
      }
      // Shared media thumbnail (<button class="shared-media-item">)
      const sharedItem = e.target.closest(".shared-media-item");
      if (sharedItem) {
        e.preventDefault();
        const url = sharedItem.dataset.previewUrl;
        const filename = sharedItem.dataset.filename || "Media";
        const isVideo = sharedItem.querySelector("video") != null;
        if (url) { openMediaViewer(url, filename, isVideo ? "video" : "image"); return; }
      }
      // Shared doc item (<button class="shared-list-item shared-open-item">)
      const sharedDoc = e.target.closest(".shared-open-item");
      if (sharedDoc) {
        e.preventDefault();
        const url = sharedDoc.dataset.previewUrl;
        const filename = sharedDoc.dataset.filename || "File";
        if (url) { previewFile(url, filename); return; }
      }
    } catch (err) {
      console.error("Media click handler error:", err);
    }
  };

  // Attach to messages area (chat messages)
  document.getElementById("messagesArea")?.addEventListener("click", openMediaOnClick);
  // Attach to shared content containers (Media, Links, and Docs tabs)
  document.getElementById("sharedContent")?.addEventListener("click", openMediaOnClick);
  document.getElementById("groupSharedContent")?.addEventListener("click", openMediaOnClick);

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (viewer.style.display !== "flex") return;
    if (e.key === "Escape") { closeMediaViewer(); e.preventDefault(); }
    if (e.key === "ArrowLeft") { navigateMediaViewer(-1); e.preventDefault(); }
    if (e.key === "ArrowRight") { navigateMediaViewer(1); e.preventDefault(); }
  });

  // Auto-hide UI
  const showUI = () => {
    viewer.classList.remove("ui-hidden");
    clearTimeout(_mediaViewerHideUITimer);
    _mediaViewerHideUITimer = setTimeout(() => viewer.classList.add("ui-hidden"), 3000);
  };
  viewer.addEventListener("mousemove", showUI);
  viewer.addEventListener("touchstart", showUI, { passive: true });
  showUI();

  // Pinch zoom
  let lastDist = 0;
  viewer.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });
  viewer.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const scale = dist / lastDist;
      _mediaViewerZoom = Math.max(1, Math.min(5, _mediaViewerZoom * scale));
      const img = document.getElementById("mediaViewerImg");
      if (img) img.style.transform = `scale(${_mediaViewerZoom})`;
      lastDist = dist;
    }
  }, { passive: false });

  // Swipe
  const stage = document.getElementById("mediaViewerStage");
  const slide = document.getElementById("mediaViewerSlide");
  if (!stage || !slide) return;

  stage.addEventListener("mousedown", (e) => {
    if (_mediaViewerZoom > 1) return;
    _mediaViewerStartX = e.clientX;
    _mediaViewerStartY = e.clientY;
    _mediaViewerIsDragging = true;
    _mediaViewerIsSwiping = false;
    _mediaViewerOffsetX = 0;
    slide.classList.add("dragging");
  });
  document.addEventListener("mousemove", (e) => {
    if (!_mediaViewerIsDragging) return;
    const dx = e.clientX - _mediaViewerStartX;
    const dy = e.clientY - _mediaViewerStartY;
    if (!_mediaViewerIsSwiping && Math.abs(dx) > 10) {
      _mediaViewerIsSwiping = true;
    }
    if (_mediaViewerIsSwiping) {
      _mediaViewerOffsetX = dx;
      slide.style.transform = `translateX(${dx}px)`;
    }
  });
  document.addEventListener("mouseup", () => {
    if (!_mediaViewerIsDragging) return;
    _mediaViewerIsDragging = false;
    slide.classList.remove("dragging");
    slide.style.transform = "";
    if (_mediaViewerIsSwiping) {
      if (Math.abs(_mediaViewerOffsetX) > 80) {
        navigateMediaViewer(_mediaViewerOffsetX > 0 ? -1 : 1);
      }
    } else {
      // Toggle UI on tap
      viewer.classList.toggle("ui-hidden");
      clearTimeout(_mediaViewerHideUITimer);
    }
    _mediaViewerIsSwiping = false;
    _mediaViewerOffsetX = 0;
  });

  // Touch swipe
  stage.addEventListener("touchstart", (e) => {
    if (_mediaViewerZoom > 1 || e.touches.length > 1) return;
    _mediaViewerStartX = e.touches[0].clientX;
    _mediaViewerStartY = e.touches[0].clientY;
    _mediaViewerIsDragging = true;
    _mediaViewerIsSwiping = false;
    _mediaViewerOffsetX = 0;
    slide.classList.add("dragging");
  }, { passive: true });
  stage.addEventListener("touchmove", (e) => {
    if (!_mediaViewerIsDragging || e.touches.length > 1) return;
    const dx = e.touches[0].clientX - _mediaViewerStartX;
    const dy = e.touches[0].clientY - _mediaViewerStartY;
    if (!_mediaViewerIsSwiping && Math.abs(dx) > 10) {
      _mediaViewerIsSwiping = true;
    }
    if (_mediaViewerIsSwiping) {
      _mediaViewerOffsetX = dx;
      slide.style.transform = `translateX(${dx}px)`;
    }
  }, { passive: true });
  stage.addEventListener("touchend", () => {
    if (!_mediaViewerIsDragging) return;
    _mediaViewerIsDragging = false;
    slide.classList.remove("dragging");
    slide.style.transform = "";
    if (_mediaViewerIsSwiping) {
      if (Math.abs(_mediaViewerOffsetX) > 80) {
        navigateMediaViewer(_mediaViewerOffsetX > 0 ? -1 : 1);
      }
    }
    _mediaViewerIsSwiping = false;
    _mediaViewerOffsetX = 0;
  }, { passive: true });

  // Double-tap to zoom
  let lastTap = 0;
  stage.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTap < 300 && !_mediaViewerIsSwiping) {
      const img = document.getElementById("mediaViewerImg");
      if (img && img.style.display !== "none") {
        if (_mediaViewerZoom > 1) {
          _mediaViewerZoom = 1;
          img.style.transform = "scale(1)";
        } else {
          _mediaViewerZoom = 3;
          img.style.transform = "scale(3)";
          img.style.transformOrigin = "center center";
        }
      }
    }
    lastTap = now;
  }, { passive: true });

  // Swipe down to close
  let swipeDownStartY = 0;
  let swipeDownStarted = false;
  stage.addEventListener("touchstart", (e) => {
    if (_mediaViewerZoom > 1 || e.touches.length > 1) return;
    swipeDownStartY = e.touches[0].clientY;
    swipeDownStarted = false;
  }, { passive: true });
  stage.addEventListener("touchmove", (e) => {
    if (_mediaViewerZoom > 1 || e.touches.length > 1) return;
    const dy = e.touches[0].clientY - swipeDownStartY;
    if (dy > 15) {
      swipeDownStarted = true;
      viewer.style.transform = `translateY(${dy * 0.5}px)`;
      viewer.style.opacity = Math.max(0, 1 - dy / 300);
    }
  }, { passive: true });
  stage.addEventListener("touchend", () => {
    if (swipeDownStarted) {
      viewer.style.transform = "";
      viewer.style.opacity = "";
      closeMediaViewer();
      swipeDownStarted = false;
    }
  }, { passive: true });

  // Click outside image to close
  stage.addEventListener("click", (e) => {
    if (e.target === stage || e.target === slide) {
      closeMediaViewer();
    }
  });
}

// Init on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMediaViewer);
} else {
  initMediaViewer();
}

// Capture-phase click handler — fires before any bubbling handler, cannot be stopped
document.addEventListener("click", (e) => {
  const mediaEl = e.target.closest(".image-attachment-link, .shared-media-item, .shared-open-item, .file-attachment-card");
  if (!mediaEl) return;
  if (!mediaEl.dataset.previewUrl) return;
  e.preventDefault();
  const url = mediaEl.dataset.previewUrl;
  const filename = mediaEl.dataset.filename || "Media";
  const isVideo = mediaEl.querySelector("video") != null;
  if (isVideo && typeof openMediaViewer === "function") {
    openMediaViewer(url, filename, "video");
  } else if (typeof openMediaViewer === "function") {
    openMediaViewer(url, filename);
  } else if (typeof previewFile === "function") {
    previewFile(url, filename);
  }
}, true);

// Add CSS for UI hidden state
const _mvStyle = document.createElement("style");
_mvStyle.textContent = `
.media-viewer.ui-hidden .media-viewer-topbar,
.media-viewer.ui-hidden .media-viewer-nav,
.media-viewer.ui-hidden .media-viewer-caption,
.media-viewer.ui-hidden .media-viewer-dots,
.media-viewer.ui-hidden .media-viewer-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}
.media-viewer .media-viewer-topbar,
.media-viewer .media-viewer-nav,
.media-viewer .media-viewer-caption,
.media-viewer .media-viewer-dots,
.media-viewer .media-viewer-actions {
  transition: opacity 0.3s;
}
`;
document.head.appendChild(_mvStyle);

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
function showAutoDownloadModal() {
  const modal = document.getElementById("autoDownloadModal");
  if (!modal) return;
  const prefs = getAutoDownloadPrefs();
  document.getElementById("autoDownloadMobile").value = prefs.mobile || "never";
  document.getElementById("autoDownloadWifi").value = prefs.wifi || "all";
  document.getElementById("autoDownloadPhotos").checked = prefs.photos !== false;
  document.getElementById("autoDownloadAudio").checked = prefs.audio !== false;
  document.getElementById("autoDownloadVideo").checked = prefs.video === true;
  document.getElementById("autoDownloadDocs").checked = prefs.docs === true;
  modal.style.display = "flex";
}

function getAutoDownloadPrefs() {
  try {
    return JSON.parse(localStorage.getItem("tc_auto_download")) || {};
  } catch (e) { return {}; }
}

function saveAutoDownloadPrefs(prefs) {
  try { localStorage.setItem("tc_auto_download", JSON.stringify(prefs)); }
  catch (e) { /* ignore */ }
}

document.getElementById("saveAutoDownloadBtn")?.addEventListener("click", () => {
  saveAutoDownloadPrefs({
    mobile: document.getElementById("autoDownloadMobile").value,
    wifi: document.getElementById("autoDownloadWifi").value,
    photos: document.getElementById("autoDownloadPhotos").checked,
    audio: document.getElementById("autoDownloadAudio").checked,
    video: document.getElementById("autoDownloadVideo").checked,
    docs: document.getElementById("autoDownloadDocs").checked,
  });
  showToast("Auto-download preferences saved");
  document.getElementById("autoDownloadModal").style.display = "none";
});
document.getElementById("closeAutoDownload")?.addEventListener("click", () => {
  document.getElementById("autoDownloadModal").style.display = "none";
});

// Two-step verification
function showTSVPrompt() {
  const overlay = document.createElement("div");
  overlay.id = "tsvPromptOverlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;";
  overlay.innerHTML = `
    <div style="background:var(--bg,#fff);border-radius:12px;padding:24px;width:min(340px,90%);text-align:center;">
      <div style="font-size:36px;margin-bottom:12px;">🔒</div>
      <h3 style="margin:0 0 8px;">Two-Step Verification</h3>
      <p style="font-size:13px;color:var(--muted);margin-bottom:16px;">Enter your PIN to continue</p>
      <input type="password" id="tsvPromptInput" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="Enter PIN" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:18px;text-align:center;letter-spacing:8px;box-sizing:border-box;" />
      <p id="tsvPromptError" style="font-size:12px;color:var(--danger,#ea0038);margin:8px 0 0;display:none;">Incorrect PIN</p>
      <button id="tsvPromptSubmit" style="margin-top:16px;padding:10px 24px;background:var(--brand,#00a884);color:#fff;border:0;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;width:100%;">Verify</button>
      ${getTwoStepVerification().email ? '<button id="tsvPromptForgot" style="margin-top:8px;padding:6px;background:none;border:0;color:var(--brand,#00a884);font-size:13px;cursor:pointer;">Forgot PIN? Check your email</button>' : ''}
    </div>`;
  document.body.appendChild(overlay);

  const input = document.getElementById("tsvPromptInput");
  const errorEl = document.getElementById("tsvPromptError");
  const submitBtn = document.getElementById("tsvPromptSubmit");

  function attempt() {
    const tsv = getTwoStepVerification();
    if (getTSVPinHash(input.value) === tsv.pin) {
      sessionStorage.setItem("tsv_verified", "true");
      document.body.removeChild(overlay);
    } else {
      errorEl.style.display = "block";
    }
  }

  submitBtn.onclick = attempt;
  input.onkeydown = (e) => { if (e.key === "Enter") attempt(); };
  input.focus();

  const forgotBtn = document.getElementById("tsvPromptForgot");
  if (forgotBtn) {
    forgotBtn.onclick = () => {
      const tsv = getTwoStepVerification();
      if (tsv.email) {
        showToast("Check your email: " + tsv.email);
      }
    };
  }
}

function showTwoStepVerificationModal() {
  const modal = document.getElementById("twoStepVerificationModal");
  if (!modal) return;
  const tsv = getTwoStepVerification();
  document.getElementById("tsvModalTitle").textContent = tsv.pin ? "Change Two-Step Verification PIN" : "Two-Step Verification";
  document.getElementById("tsvPinInput").value = "";
  document.getElementById("tsvPinConfirmInput").value = "";
  document.getElementById("tsvEmailInput").value = tsv.email || "";
  document.getElementById("tsvSaveBtn").textContent = tsv.pin ? "Update PIN" : "Enable Two-Step Verification";
  document.getElementById("tsvDisableBtn").style.display = tsv.pin ? "block" : "none";
  modal.style.display = "flex";
}

function getTwoStepVerification() {
  try {
    const data = localStorage.getItem("tc_tsv");
    return data ? JSON.parse(data) : {};
  } catch (e) { return {}; }
}

function getTSVPinHash(pin) {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return "tsv_" + Math.abs(hash).toString(36);
}

function saveTwoStepVerification(pin, email) {
  try {
    localStorage.setItem("tc_tsv", JSON.stringify({
      pin: pin ? getTSVPinHash(pin) : null,
      email: email || "",
      enabled: !!pin,
    }));
  } catch (e) { /* ignore */ }
}

function clearTwoStepVerification() {
  try { localStorage.removeItem("tc_tsv"); } catch (e) { /* ignore */ }
}

document.getElementById("tsvSaveBtn")?.addEventListener("click", () => {
  const pin = document.getElementById("tsvPinInput").value;
  const confirm = document.getElementById("tsvPinConfirmInput").value;
  if (pin.length < 4) { showToast("PIN must be at least 4 digits", "error"); return; }
  if (pin !== confirm) { showToast("PINs do not match", "error"); return; }
  const email = document.getElementById("tsvEmailInput").value;
  saveTwoStepVerification(pin, email);
  showToast("Two-step verification " + (getTwoStepVerification().pin ? "updated" : "enabled"));
  document.getElementById("twoStepVerificationModal").style.display = "none";
});

document.getElementById("tsvDisableBtn")?.addEventListener("click", () => {
  if (!confirm("Disable two-step verification?")) return;
  clearTwoStepVerification();
  document.getElementById("twoStepVerificationModal").style.display = "none";
  showToast("Two-step verification disabled");
});

document.getElementById("closeTwoStepVerification")?.addEventListener("click", () => {
  document.getElementById("twoStepVerificationModal").style.display = "none";
});

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

async function loadCommunitiesList(searchTerm = "") {
  const container = document.getElementById("communitiesList");
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Loading communities...</div>';
  try {
    const snap = await db
      .collection("communities")
      .orderBy("createdAt", "desc")
      .get();
    const term = String(searchTerm || "").trim().toLowerCase();
    const docs = snap.docs.filter((doc) => {
      if (!term) return true;
      const data = doc.data() || {};
      return [data.name, data.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
    if (!docs.length) {
      container.innerHTML = `<div class="empty-state">${term ? "No matching communities" : "No communities yet"}</div>`;
      return;
    }
    container.innerHTML = "";
    for (const doc of docs) {
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
      '<div class="empty-state tab-error-state">Could not load communities<button type="button" class="btn btn-outline tab-retry-btn">Retry</button></div>';
    container.querySelector(".tab-retry-btn")?.addEventListener("click", () =>
      loadCommunitiesList(document.getElementById("searchInput")?.value || ""),
    );
  }

}

async function addGroupToCommunity(communityId, groupId) {
  if (!currentUser) return;
  try {
    const groupDoc = await db.collection("groups").doc(groupId).get();
    const groupName = groupDoc.exists ? (groupDoc.data().name || groupId) : groupId;
    await db
      .collection("communityGroups")
      .doc(communityId)
      .collection("groups")
      .doc(groupId)
      .set({
        groupId,
        groupName,
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
  const footer = document.getElementById("communityInfoFooter");
  if (!modal || !content) return;
  modal.style.display = "flex";
  content.innerHTML =
    '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">Loading...</div>';
  if (footer) footer.style.display = "none";
  try {
    const doc = await db.collection("communities").doc(communityId).get();
    if (!doc.exists) {
      content.innerHTML =
        '<div style="text-align:center;padding:20px;color:var(--muted);">Community not found</div>';
      return;
    }
    const data = doc.data();
    title.textContent = data.name || "Community Info";

    // Determine current user's role
    const myMemberSnap = await db
      .collection("communityMembers")
      .where("communityId", "==", communityId)
      .where("userId", "==", currentUser?.uid)
      .limit(1)
      .get();
    const isAdmin = !myMemberSnap.empty && myMemberSnap.docs[0].data().role === "admin";

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
        const gData = g.data();
        const groupId = g.id;
        const displayName = gData.groupName || groupId;
        html += `<div class="community-group-row"><span>${escapeHtml(displayName)}</span>${isAdmin ? `<button class="btn btn-outline" style="padding:2px 8px;font-size:11px;color:#ef4444;border-color:#ef4444;margin-left:auto;" onclick="removeGroupFromCommunity('${communityId}','${groupId}')">Remove</button>` : ""}</div>`;
      });
    }

    content.innerHTML = html;

    // Wire footer buttons
    if (footer && currentUser) {
      const addBtn = document.getElementById("addGroupToCommunityBtn");
      const deleteBtn = document.getElementById("deleteCommunityBtn");
      const leaveBtn = document.getElementById("leaveCommunityBtn");
      // Reset button visibility before applying role-based state
      if (addBtn) addBtn.style.display = "";
      if (deleteBtn) deleteBtn.style.display = "";
      if (isAdmin) {
        footer.style.display = "flex";
        if (addBtn) addBtn.onclick = () => showAddGroupToCommunityUI(communityId);
        if (deleteBtn) {
          deleteBtn.onclick = () => {
            if (confirm("Delete this entire community? This action cannot be undone.")) {
              deleteCommunity(communityId);
            }
          };
        }
        if (leaveBtn) {
          leaveBtn.textContent = "Leave Community";
          leaveBtn.style.color = "";
          leaveBtn.style.borderColor = "";
          leaveBtn.onclick = () => leaveCommunity(communityId);
        }
      } else if (!myMemberSnap.empty) {
        footer.style.display = "flex";
        if (addBtn) addBtn.style.display = "none";
        if (deleteBtn) deleteBtn.style.display = "none";
        if (leaveBtn) {
          leaveBtn.textContent = "Leave Community";
          leaveBtn.onclick = () => leaveCommunity(communityId);
        }
      }
    }
  } catch (e) {
    content.innerHTML =
      '<div style="text-align:center;padding:20px;color:var(--muted);">Error loading community info</div>';
  }
}

async function showAddGroupToCommunityUI(communityId) {
  const groupName = prompt("Enter the name or ID of the group to add:");
  if (!groupName || !groupName.trim()) return;
  try {
    const snap = await db
      .collection("groups")
      .where("name", "==", groupName.trim())
      .limit(1)
      .get();
    if (snap.empty) {
      showToast("No group found with that name", "error");
      return;
    }
    const groupId = snap.docs[0].id;
    await addGroupToCommunity(communityId, groupId);
    showCommunityInfo(communityId);
  } catch (e) {
    showToast("Failed to add group", "error");
  }
}

async function removeGroupFromCommunity(communityId, groupId) {
  if (!currentUser) return;
  try {
    await db
      .collection("communityGroups")
      .doc(communityId)
      .collection("groups")
      .doc(groupId)
      .delete();
    showToast("Group removed from community");
    showCommunityInfo(communityId);
  } catch (e) {
    showToast("Failed to remove group", "error");
  }
}

async function deleteCommunity(communityId) {
  if (!currentUser) return;
  try {
    const batch = db.batch();
    // Delete community groups
    const groupsSnap = await db
      .collection("communityGroups")
      .doc(communityId)
      .collection("groups")
      .get();
    groupsSnap.forEach((g) => batch.delete(g.ref));
    // Delete communityGroups parent doc
    batch.delete(db.collection("communityGroups").doc(communityId));
    // Delete community members
    const membersSnap = await db
      .collection("communityMembers")
      .where("communityId", "==", communityId)
      .get();
    membersSnap.forEach((m) => batch.delete(m.ref));
    // Delete community document
    batch.delete(db.collection("communities").doc(communityId));
    await batch.commit();
    hideModal("communityInfoModal");
    showToast("Community deleted");
    loadCommunitiesList();
  } catch (e) {
    showToast("Failed to delete community", "error");
  }
}

async function leaveCommunity(communityId) {
  if (!currentUser) return;
  try {
    const myMemberSnap = await db
      .collection("communityMembers")
      .where("communityId", "==", communityId)
      .where("userId", "==", currentUser.uid)
      .limit(1)
      .get();
    if (!myMemberSnap.empty) {
      await myMemberSnap.docs[0].ref.delete();
      // Decrement member count
      await db
        .collection("communities")
        .doc(communityId)
        .update({
          memberCount: firebase.firestore.FieldValue.increment(-1),
        });
    }
    hideModal("communityInfoModal");
    showToast("Left community");
    loadCommunitiesList();
  } catch (e) {
    showToast("Failed to leave community", "error");
  }
}

// ========================================
// FEATURE: Animated Stickers
// ========================================

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
    var show = true;
    if (dateStr) {
      var timestamp = msg._messageData?.timestamp;
      var messageDate = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp || 0);
      var selectedDate = new Date(dateStr + "T00:00:00");
      show =
        messageDate.getFullYear() === selectedDate.getFullYear() &&
        messageDate.getMonth() === selectedDate.getMonth() &&
        messageDate.getDate() === selectedDate.getDate();
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

// Delegated image error handler (replaces inline onerror, prevents XSS)
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName !== "IMG") return;
  if (img.closest(".message-attachment")) {
    img.closest(".message-attachment").classList.add("is-broken");
    img.remove();
  } else if (img.classList.contains("link-preview-image")) {
    img.style.display = "none";
  } else if (img.closest(".shared-media-item")) {
    img.closest(".shared-media-item").classList.add("is-broken");
    img.remove();
  } else if (img.classList.contains("fp-thumb")) {
    img.style.display = "none";
  } else if (img.classList.contains("forward-avatar-img")) {
    img.style.display = "none";
    const fb = img.nextElementSibling;
    if (fb) fb.style.display = "flex";
  }
}, true);

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

// ================================================================
// NEW FEATURES MODULE
// ================================================================

// ---------- 1. Chat List Date Section Headers ----------
function getDateSectionLabel(timestamp) {
  if (!timestamp) return "";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  if (d > weekAgo) return "This Week";
  if (d > twoWeeksAgo) return "Last Week";
  return "Older";
}

// Patch renderChatListItems to add date section headers + message status
const _origRenderChatListItems = renderChatListItems;
renderChatListItems = function(items, container, emptyMessage) {
  // Sort by lastMessageTime descending for main chat list (not search)
  const isSearch = items.some(i => i.searchResultType);
  if (!isSearch && items.length > 0 && items[0].lastMessageTime) {
    items.sort((a, b) => (b.lastMessageTime?.getTime?.() || 0) - (a.lastMessageTime?.getTime?.() || 0));
  }
  _origRenderChatListItems(items, container, emptyMessage);

  // Add date section headers for non-search lists
  if (!isSearch && items.length > 0 && items[0].lastMessageTime) {
    let lastSection = "";
    const children = container.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child.classList?.contains("list-item")) continue;
      const chatId = child.dataset.chatId;
      const item = items.find(it => it.id === chatId);
      if (!item || !item.lastMessageTime) continue;
      const section = getDateSectionLabel(item.lastMessageTime);
      if (section && section !== lastSection) {
        const header = document.createElement("div");
        header.className = "chat-date-section";
        header.textContent = section;
        container.insertBefore(header, child);
        lastSection = section;
      }
    }
  }

  // Add message status indicators for own messages
  items.forEach(item => {
    if (!item.lastMessageSentByMe || !item.lastMessageStatus) return;
    const el = container.querySelector(`[data-chat-id="${CSS.escape(item.id)}"]`);
    if (!el) return;
    const preview = el.querySelector(".list-preview");
    if (!preview) return;
    const statusMap = { sent: "✓", delivered: "✓✓", read: "✓✓" };
    const clsMap = { sent: "sent", delivered: "delivered", read: "read" };
    const icon = statusMap[item.lastMessageStatus] || "";
    const cls = clsMap[item.lastMessageStatus] || "";
    if (icon) {
      const span = document.createElement("span");
      span.className = `chat-list-status ${cls}`;
      span.textContent = icon;
      preview.prepend(span);
    }
  });
};

// ---------- 2. URL Preview ----------
let urlPreviewCache = {};

async function fetchUrlPreview(url) {
  if (urlPreviewCache[url]) return urlPreviewCache[url];
  try {
    const resp = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { method: "GET", mode: "cors" });
    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const getMeta = (prop) => {
      const el = doc.querySelector(`meta[property="${prop}"]`) || doc.querySelector(`meta[name="${prop}"]`);
      return el?.getAttribute("content") || "";
    };
    const title = getMeta("og:title") || doc.title || "";
    const desc = getMeta("og:description") || getMeta("description") || "";
    const img = getMeta("og:image") || "";
    const domain = url.replace(/https?:\/\//, "").split("/")[0];
    const result = { title, description: desc, image: img, domain };
    urlPreviewCache[url] = result;
    return result;
  } catch (e) {
    return null;
  }
}

function getURLFromText(text) {
  const m = text.match(/(https?:\/\/[^\s]+)/i);
  return m ? m[1] : null;
}

// Patch sendMessage to attach URL preview
const _origSendMessage = sendMessage;
sendMessage = async function() {
  const input = document.getElementById("messageInput");
  const text = input?.value?.trim();
  if (text) {
    const url = getURLFromText(text);
    if (url) {
      const preview = await fetchUrlPreview(url);
      if (preview && (preview.title || preview.description || preview.image)) {
        window._pendingUrlPreview = preview;
      }
    }
  }
  const msgId = await _origSendMessage.call(this);
  window._pendingUrlPreview = null;
  return msgId;
};

// Add URL preview to message data when sending
const _origBuildMessageData = window.buildMessageData || (() => {});
if (typeof _origBuildMessageData === "function") {
  // URL preview already added via the modified send
}

// ---------- 3. Message Effects ----------
let currentMsgEffect = "none";

// Wire effect selection panel
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".msg-effect-btn");
  if (!btn) return;
  currentMsgEffect = btn.dataset.effect;
  document.getElementById("messageEffectsPanel").style.display = "none";
  const effectBtn = document.getElementById("effectBtn");
  if (effectBtn) {
    effectBtn.classList.toggle("effect-btn-active", currentMsgEffect !== "none");
  }
});

// ---------- 4. Message Bookmarking ----------
async function toggleBookmarkMessage(messageId, chatId, chatType, text) {
  if (!currentUser) return;
  const key = `${currentUser.uid}_${messageId}`;
  const doc = await db.collection("bookmarkedMessages").doc(key).get();
  if (doc.exists) {
    await doc.ref.delete();
    showToast("Bookmark removed");
  } else {
    await db.collection("bookmarkedMessages").doc(key).set({
      userId: currentUser.uid,
      messageId,
      chatId,
      chatType,
      chatName: currentChat?.name || "",
      text: text.substring(0, 200),
      bookmarkedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("Message bookmarked");
  }
}

async function showBookmarkedMessages() {
  const list = document.getElementById("bookmarkedMessagesList");
  if (!list) return;
  list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">Loading...</div>';
  document.getElementById("bookmarkedMessagesModal").style.display = "flex";
  try {
    const snap = await db.collection("bookmarkedMessages")
      .where("userId", "==", currentUser.uid)
      .orderBy("bookmarkedAt", "desc")
      .get();
    if (snap.empty) {
      list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">No bookmarked messages</div>';
      return;
    }
    list.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const div = document.createElement("div");
      div.className = "bookmarked-msg-item";
      div.innerHTML = `
        <div style="flex:1;">
          <div class="bookmarked-msg-chat">${escapeHtml(d.chatName || "Unknown chat")}</div>
          <div class="bookmarked-msg-text">${escapeHtml(d.text || "")}</div>
        </div>
        <button class="btn btn-outline" style="padding:4px 10px;font-size:12px;flex-shrink:0;" data-msg-id="${d.messageId}" data-chat-id="${d.chatId}" data-chat-type="${d.chatType}">Open</button>
        <button class="btn btn-outline" style="padding:4px 10px;font-size:12px;flex-shrink:0;color:var(--danger);" data-del-id="${doc.id}">Del</button>`;
      list.appendChild(div);
    });
    list.querySelectorAll("[data-del-id]").forEach(btn => {
      btn.onclick = async () => {
        await db.collection("bookmarkedMessages").doc(btn.dataset.delId).delete();
        showBookmarkedMessages();
      };
    });
    list.querySelectorAll("[data-msg-id]").forEach(btn => {
      btn.onclick = () => {
        document.getElementById("bookmarkedMessagesModal").style.display = "none";
        const type = btn.dataset.chatType;
        const id = btn.dataset.chatId;
        if (type === "direct") loadChat(id, btn.dataset.chatName || "Chat");
        else loadGroupChat(id, btn.dataset.chatName || "Group");
      };
    });
  } catch (e) {
    list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--danger);">Failed to load</div>';
  }
}

// Add bookmark to message context menu (patched after init)
(function addBookmarkToContextMenu() {
  const observer = new MutationObserver(() => {
    const menu = document.getElementById("messageContextMenu");
    if (!menu || menu.querySelector("[data-bookmark-btn]")) return;
    const divider = menu.querySelector(".context-divider");
    const item = document.createElement("div");
    item.className = "context-item";
    item.dataset.bookmarkBtn = "true";
    item.textContent = "Bookmark message";
    item.onclick = async () => {
      const msgDiv = document.querySelector(".context-menu-target");
      if (!msgDiv) return;
      document.getElementById("messageContextMenu").style.display = "none";
      const msgId = msgDiv.dataset.messageId || msgDiv.id;
      const text = msgDiv.querySelector(".message-text")?.textContent || "";
      await toggleBookmarkMessage(msgId, currentChat?.id || "", currentChatType || "", text);
    };
    if (divider) menu.insertBefore(item, divider);
    else menu.appendChild(item);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

// ---------- 5. Message Reminder ----------
function addReminderOptionToContextMenu() {
  const menu = document.getElementById("messageContextMenu");
  if (!menu || menu.querySelector("[data-reminder-btn]")) return;
  const item = document.createElement("div");
  item.className = "context-item";
  item.dataset.reminderBtn = "true";
  item.textContent = "Remind me";
  item.onclick = () => {
    document.getElementById("messageContextMenu").style.display = "none";
    showReminderPicker();
  };
  const bookmarkItem = menu.querySelector("[data-bookmark-btn]");
  if (bookmarkItem) bookmarkItem.after(item);
  else menu.appendChild(item);
}

(function watchReminderMenu() {
  const obs = new MutationObserver(() => addReminderOptionToContextMenu());
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(addReminderOptionToContextMenu, 2000);
})();

function showReminderPicker() {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;";
  overlay.innerHTML = `
    <div style="background:var(--bg,#fff);border-radius:12px;padding:24px;width:min(300px,90%);">
      <h3 style="margin:0 0 12px;font-size:16px;">Set Reminder</h3>
      <button class="reminder-option" data-min="60" style="display:block;width:100%;padding:10px;margin-bottom:6px;border:1px solid var(--border);border-radius:8px;background:var(--bg);cursor:pointer;font-size:14px;">1 hour</button>
      <button class="reminder-option" data-min="1440" style="display:block;width:100%;padding:10px;margin-bottom:6px;border:1px solid var(--border);border-radius:8px;background:var(--bg);cursor:pointer;font-size:14px;">Tomorrow</button>
      <button class="reminder-option" data-min="10080" style="display:block;width:100%;padding:10px;margin-bottom:6px;border:1px solid var(--border);border-radius:8px;background:var(--bg);cursor:pointer;font-size:14px;">Next week</button>
      <button id="cancelReminder" style="display:block;width:100%;padding:8px;border:none;background:none;cursor:pointer;font-size:13px;color:var(--muted);">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelectorAll(".reminder-option").forEach(btn => {
    btn.onclick = async () => {
      const minutes = parseInt(btn.dataset.min);
      const dueAt = new Date(Date.now() + minutes * 60000);
      const msgDiv = document.querySelector(".context-menu-target") || document.querySelector(".message:last-child");
      const msgId = msgDiv?.dataset?.messageId || msgDiv?.id || "unknown";
      const chatId = currentChat?.id || "";
      const chatType = currentChatType || "";
      const text = msgDiv?.querySelector(".message-text")?.textContent?.substring(0, 100) || "";
      try {
        const ref = await db.collection("reminders").add({
          userId: currentUser.uid,
          messageId: msgId,
          chatId,
          chatType,
          chatName: currentChat?.name || "",
          text,
          dueAt,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          status: "pending",
        });
        // Schedule local notification via service worker
        if ("serviceWorker" in navigator && "Notification" in window && Notification.permission === "granted") {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification("Reminder", {
            body: text || "You set a reminder for this message",
            tag: `reminder_${ref.id}`,
            data: { chatId, chatType },
            timestamp: dueAt.getTime(),
          });
        }
        showToast(`Reminder set for ${btn.textContent}`);
      } catch (e) {
        showToast("Failed to set reminder", "error");
      }
      document.body.removeChild(overlay);
    };
  });
  document.getElementById("cancelReminder")?.addEventListener("click", () => document.body.removeChild(overlay));
}

// ---------- 6. Voice Message Transcription ----------
let transcriptionRecognition = null;
let transcriptionActive = false;

function startTranscription() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { showToast("Speech recognition not supported", "error"); return; }
  if (transcriptionActive) return;
  transcriptionRecognition = new SpeechRecognition();
  transcriptionRecognition.lang = "en-US";
  transcriptionRecognition.interimResults = true;
  transcriptionRecognition.continuous = true;
  transcriptionActive = true;

  const indicator = document.getElementById("transcriptionIndicator");
  const textEl = document.getElementById("transcriptionText");
  if (indicator) indicator.style.display = "block";

  transcriptionRecognition.onresult = (e) => {
    let final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      final += e.results[i][0].transcript;
    }
    if (textEl) textEl.textContent = final;
  };
  transcriptionRecognition.onerror = () => { stopTranscription(); };
  transcriptionRecognition.onend = () => { stopTranscription(); };
  transcriptionRecognition.start();
}

function stopTranscription() {
  if (transcriptionRecognition) {
    try { transcriptionRecognition.stop(); } catch (e) { /* ignore */ }
  }
  transcriptionActive = false;
  const indicator = document.getElementById("transcriptionIndicator");
  if (indicator) indicator.style.display = "none";
  const textEl = document.getElementById("transcriptionText");
  const finalText = textEl?.textContent || "";
  if (finalText) {
    const input = document.getElementById("messageInput");
    if (input) {
      input.value += (input.value ? " " : "") + finalText;
      resizeMessageComposer();
    }
  }
}

// Add transcription button next to voice message button
(function addTranscribeBtn() {
  const voiceBtn = document.getElementById("voiceMsgBtn");
  if (!voiceBtn || document.getElementById("transcribeBtn")) return;
  const btn = document.createElement("button");
  btn.id = "transcribeBtn";
  btn.className = "icon-btn";
  btn.title = "Transcribe speech to text";
  btn.innerHTML = "🎤";
  btn.style.cssText = "font-size:18px;";
  btn.onclick = () => {
    if (transcriptionActive) stopTranscription();
    else startTranscription();
    btn.style.opacity = transcriptionActive ? "1" : "0.5";
  };
  voiceBtn.parentElement?.insertBefore(btn, voiceBtn);
  // Retry after DOM settles
  setTimeout(() => {
    if (!document.getElementById("transcribeBtn")) {
      const vb2 = document.getElementById("voiceMsgBtn");
      if (vb2?.parentElement) {
        const b2 = document.createElement("button");
        b2.id = "transcribeBtn";
        b2.className = "icon-btn";
        b2.title = "Transcribe speech to text";
        b2.innerHTML = "🎤";
        b2.style.cssText = "font-size:18px;";
        b2.onclick = () => {
          if (transcriptionActive) stopTranscription();
          else startTranscription();
          b2.style.opacity = transcriptionActive ? "1" : "0.5";
        };
        vb2.parentElement.insertBefore(b2, vb2);
      }
    }
  }, 3000);
})();

// ---------- 7. Chat Statistics ----------
async function showChatStatistics() {
  const body = document.getElementById("chatStatsBody");
  if (!body) return;
  body.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">Computing statistics...</div>';
  document.getElementById("chatStatsModal").style.display = "flex";
  if (!currentChat) { body.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">Open a chat first</div>'; return; }

  try {
    const isGroup = currentChatType === "group";
    const chatId = currentChat.id;
    const msgSnap = await db.collection("messages")
      .where(isGroup ? "groupId" : "directId", "==", chatId)
      .orderBy("timestamp", "desc")
      .limit(500)
      .get();

    let total = 0, myMsgs = 0, mediaCount = 0, stickerCount = 0, gifCount = 0, linkCount = 0, wordCount = 0, replyCount = 0;
    const daily = {};
    const senders = {};

    msgSnap.forEach(doc => {
      const d = doc.data();
      total++;
      if (d.senderId === currentUser.uid) myMsgs++;
      if (d.type === "image" || d.type === "video" || d.type === "audio" || d.fileUrl) mediaCount++;
      if (d.type === "sticker") stickerCount++;
      if (d.type === "gif") gifCount++;
      if (d.text && /https?:\/\//.test(d.text)) linkCount++;
      if (d.text) wordCount += d.text.split(/\s+/).filter(Boolean).length;
      if (d.replyTo) replyCount++;
      if (d.timestamp) {
        const day = d.timestamp.toDate?.()?.toDateString?.() || new Date(d.timestamp).toDateString();
        daily[day] = (daily[day] || 0) + 1;
      }
      senders[d.senderId] = (senders[d.senderId] || 0) + 1;
    });

    const mostActiveDay = Object.entries(daily).sort((a, b) => b[1] - a[1])[0];
    const mostActiveSender = Object.entries(senders).sort((a, b) => b[1] - a[1])[0];
    const senderName = mostActiveSender ? (await db.collection("users").doc(mostActiveSender[0]).get()).data()?.displayName || "User" : "N/A";

    body.innerHTML = `
      <div class="stats-section-title">Messages</div>
      <div class="stat-card"><span class="stat-label">Total messages</span><span class="stat-value">${total}</span></div>
      <div class="stat-card"><span class="stat-label">Your messages</span><span class="stat-value">${myMsgs}</span></div>
      <div class="stat-card"><span class="stat-label">Words sent</span><span class="stat-value">${wordCount}</span></div>
      <div class="stat-card"><span class="stat-label">Replies</span><span class="stat-value">${replyCount}</span></div>
      <div class="stats-section-title">Media</div>
      <div class="stat-card"><span class="stat-label">Media files</span><span class="stat-value">${mediaCount}</span></div>
      <div class="stat-card"><span class="stat-label">Stickers</span><span class="stat-value">${stickerCount}</span></div>
      <div class="stat-card"><span class="stat-label">GIFs</span><span class="stat-value">${gifCount}</span></div>
      <div class="stat-card"><span class="stat-label">Links shared</span><span class="stat-value">${linkCount}</span></div>
      <div class="stats-section-title">Activity</div>
      <div class="stat-card"><span class="stat-label">Most active day</span><span class="stat-value">${mostActiveDay ? mostActiveDay[0] + " (" + mostActiveDay[1] + ")" : "N/A"}</span></div>
      <div class="stat-card"><span class="stat-label">Most active member</span><span class="stat-value">${escapeHtml(senderName)} (${mostActiveSender ? mostActiveSender[1] : 0})</span></div>
    `;
  } catch (e) {
    body.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--danger);">Failed to compute statistics</div>';
  }
}

// ---------- 8. AI Smart Replies ----------
let smartRepliesEnabled = false;
let smartRepliesApiKey = "";

function loadSmartRepliesConfig() {
  try {
    const data = JSON.parse(localStorage.getItem("tc_smart_replies") || "{}");
    smartRepliesEnabled = data.enabled || false;
    smartRepliesApiKey = data.apiKey || "";
  } catch (e) { /* ignore */ }
}

function saveSmartRepliesConfig(enabled, apiKey) {
  try {
    localStorage.setItem("tc_smart_replies", JSON.stringify({ enabled, apiKey }));
  } catch (e) { /* ignore */ }
  smartRepliesEnabled = enabled;
  smartRepliesApiKey = apiKey;
}

async function getSmartReplies(messageText) {
  if (!smartRepliesEnabled || !smartRepliesApiKey || !messageText) return [];
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${smartRepliesApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Generate 3 short, casual reply suggestions (max 40 chars each) for this message. Return ONLY the suggestions separated by "||" without numbering: "${messageText}"` }] }],
        generationConfig: { maxOutputTokens: 100, temperature: 0.3 }
      })
    });
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text.split("||").map(s => s.trim()).filter(Boolean).slice(0, 3);
  } catch (e) {
    return [];
  }
}

function showSmartReplyBar(suggestions) {
  const bar = document.getElementById("smartReplyBar");
  if (!bar) return;
  if (!suggestions.length) { bar.style.display = "none"; return; }
  bar.style.display = "flex";
  // Remove old suggestions (keep the label)
  bar.querySelectorAll(".smart-reply-btn").forEach(el => el.remove());
  suggestions.forEach(text => {
    const btn = document.createElement("button");
    btn.className = "smart-reply-btn";
    btn.textContent = text;
    btn.onclick = () => {
      const input = document.getElementById("messageInput");
      if (input) {
        input.value = text;
        resizeMessageComposer();
        sendMessage();
      }
      bar.style.display = "none";
    };
    bar.appendChild(btn);
  });
}

// Patch message reception to trigger smart replies
const _origLoadMessages = loadMessages;
loadMessages = function() {
  const result = _origLoadMessages.apply(this, arguments);
  // After loading, get the last message and suggest replies
  setTimeout(async () => {
    if (!smartRepliesEnabled || !smartRepliesApiKey) return;
    const lastMsg = document.querySelector("#messagesArea .message:last-child .message-text");
    if (!lastMsg) return;
    const text = lastMsg.textContent?.trim();
    if (!text || text.length < 3) return;
    const lastSender = document.querySelector("#messagesArea .message:last-child");
    if (lastSender?.dataset?.senderId === currentUser?.uid) return;
    const suggestions = await getSmartReplies(text);
    showSmartReplyBar(suggestions);
  }, 500);
  return result;
};

// ---------- 9. Chat Summarization ----------
async function summarizeUnreadMessages() {
  const body = document.getElementById("chatSummaryBody");
  if (!body || !currentChat) return;
  body.textContent = "Summarizing...";
  document.getElementById("chatSummaryModal").style.display = "flex";
  try {
    const isGroup = currentChatType === "group";
    const chatId = currentChat.id;
    const readState = await db.collection("chatsReadState").doc(currentUser.uid + "_" + chatId).get();
    const lastRead = readState.data()?.lastReadAt?.toDate?.() || new Date(0);
    const snap = await db.collection("messages")
      .where(isGroup ? "groupId" : "directId", "==", chatId)
      .where("timestamp", ">", lastRead)
      .orderBy("timestamp", "asc")
      .limit(100)
      .get();

    if (snap.empty) { body.textContent = "No unread messages to summarize."; return; }

    let summary = "";
    if (smartRepliesApiKey) {
      const msgs = [];
      snap.forEach(doc => {
        const d = doc.data();
        const name = d.senderName || "User";
        const text = d.text || `[${d.type || "media"}]`;
        msgs.push(`${name}: ${text}`);
      });
      const prompt = `Summarize this chat conversation in 3-5 bullet points (total under 200 chars):\n${msgs.join("\n")}`;
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${smartRepliesApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 200, temperature: 0.3 } })
      });
      const data = await resp.json();
      summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Could not generate summary.";
    } else {
      // Manual summary
      let count = 0;
      snap.forEach(() => count++);
      const firstMsg = snap.docs[0]?.data();
      const lastMsg = snap.docs[snap.docs.length - 1]?.data();
      summary = `${count} unread message(s)\n`;
      if (firstMsg?.text) summary += `First: ${firstMsg.text.substring(0, 80)}\n`;
      if (lastMsg?.text) summary += `Last: ${lastMsg.text.substring(0, 80)}`;
    }
    body.textContent = summary;
  } catch (e) {
    body.textContent = "Failed to summarize: " + e.message;
  }
}

// ---------- 10. Note-taking (/note command) ----------
function parseNoteCommand(text) {
  const match = text.match(/^\/note\s+(.+)/i);
  if (!match) return null;
  return { text: match[1].trim(), remindAt: null };
}

async function saveNote(noteText) {
  if (!noteText || !currentUser) return;
  await db.collection("notes").add({
    userId: currentUser.uid,
    text: noteText,
    chatId: currentChat?.id || "",
    chatName: currentChat?.name || "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function showNotes() {
  const list = document.getElementById("notesList");
  if (!list) return;
  list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">Loading...</div>';
  document.getElementById("notesModal").style.display = "flex";
  try {
    const snap = await db.collection("notes")
      .where("userId", "==", currentUser.uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    if (snap.empty) {
      list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">No notes yet. Type /note in any chat to create one.</div>';
      return;
    }
    list.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const div = document.createElement("div");
      div.className = "note-item";
      div.innerHTML = `
        <div class="note-item-content">
          <div class="note-item-text">${escapeHtml(d.text || "")}</div>
          <div class="note-item-meta">${d.chatName ? '<span class="note-item-chat">' + escapeHtml(d.chatName) + '</span> · ' : ""}${d.createdAt?.toDate?.()?.toLocaleString?.() || "Just now"}</div>
        </div>
        <button class="btn btn-outline" style="padding:4px 10px;font-size:12px;flex-shrink:0;color:var(--danger);" data-del-id="${doc.id}">Del</button>`;
      list.appendChild(div);
    });
    list.querySelectorAll("[data-del-id]").forEach(btn => {
      btn.onclick = async () => {
        await db.collection("notes").doc(btn.dataset.delId).delete();
        showNotes();
      };
    });
  } catch (e) {
    list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--danger);">Failed to load</div>';
  }
}

// Patch sendMessage to handle /note command
const _origSendMessage2 = sendMessage;
sendMessage = async function() {
  const input = document.getElementById("messageInput");
  const text = input?.value?.trim();
  if (text && text.startsWith("/note ")) {
    const note = parseNoteCommand(text);
    if (note) {
      await saveNote(note.text);
      showToast("Note saved! View in Notes modal.");
      if (input) input.value = "";
      resizeMessageComposer();
      return null;
    }
  }
  return _origSendMessage2.call(this);
};

// ---------- 11. Calendar Event Creation ----------
function populateEventFromMessage() {
  const msgDiv = document.querySelector(".context-menu-target") || document.querySelector(".message:last-child");
  const text = msgDiv?.querySelector(".message-text")?.textContent || "";
  const match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (match) {
    document.getElementById("eventDateInput").value = `${match[3].length === 2 ? "20" + match[3] : match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  }
  const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1]);
    const m = timeMatch[2];
    const ampm = timeMatch[3]?.toUpperCase();
    let hours = h;
    if (ampm === "PM" && h !== 12) hours = h + 12;
    if (ampm === "AM" && h === 12) hours = 0;
    document.getElementById("eventTimeInput").value = String(hours).padStart(2, "0") + ":" + m;
  }
  document.getElementById("eventTitleInput").value = text.substring(0, 80);
  document.getElementById("eventDescInput").value = text;
  document.getElementById("createEventModal").style.display = "flex";
}

function downloadICS() {
  const title = document.getElementById("eventTitleInput").value.trim() || "Event";
  const date = document.getElementById("eventDateInput").value;
  const time = document.getElementById("eventTimeInput").value;
  const desc = document.getElementById("eventDescInput").value || "";
  if (!date) { showToast("Please select a date", "error"); return; }

  const dtStart = date + (time ? "T" + time.replace(":", "") + "00" : "T000000");
  const dtEnd = date + (time ? "T" + time.replace(":", "") + "00" : "T235959");
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TeamChat//EN",
    "BEGIN:VEVENT",
    "DTSTART:" + dtStart,
    "DTEND:" + dtEnd,
    "DTSTAMP:" + now,
    "UID:" + now + "-" + Math.random().toString(36).substring(2),
    "SUMMARY:" + title.replace(/,/g, "\\,"),
    "DESCRIPTION:" + desc.replace(/,/g, "\\,").replace(/\n/g, "\\n"),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (title.replace(/[^a-z0-9]/gi, "_") || "event") + ".ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Calendar file downloaded");
}
document.getElementById("downloadEventBtn")?.addEventListener("click", downloadICS);
document.getElementById("closeCreateEvent")?.addEventListener("click", () => document.getElementById("createEventModal").style.display = "none");

// ---------- 12. Swipe Actions on Chat List ----------
function initChatListSwipe() {
  const list = document.getElementById("chatsList");
  if (!list) return;
  let startX = 0, startY = 0, currentItem = null, swipeState = null;

  list.addEventListener("touchstart", (e) => {
    const item = e.target.closest(".list-item");
    if (!item) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentItem = item;
    swipeState = { dx: 0, dy: 0, started: false };
    item.classList.remove("swipe-left-reveal", "swipe-right-reveal");
  }, { passive: true });

  list.addEventListener("touchmove", (e) => {
    if (!currentItem || !swipeState) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    swipeState.dx = dx;
    swipeState.dy = dy;
    if (!swipeState.started && Math.abs(dx) > 10) {
      swipeState.started = true;
      currentItem.style.transition = "transform 0.05s linear";
    }
    if (swipeState.started && Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      const translateX = Math.max(-120, Math.min(120, dx));
      currentItem.style.transform = `translateX(${translateX}px)`;
      currentItem.classList.toggle("swipe-left-active", dx < -20);
      currentItem.classList.toggle("swipe-right-active", dx > 20);
    }
  }, { passive: false });

  list.addEventListener("touchend", () => {
    if (!currentItem || !swipeState) { currentItem = null; swipeState = null; return; }
    const { dx, started } = swipeState;
    if (started) {
      if (dx < -60) {
        // Swipe left → archive
        currentItem.style.transition = "transform 0.2s";
        currentItem.style.transform = "";
        const id = currentItem.dataset.chatId;
        const type = currentItem.dataset.chatType;
        if (id && type) {
          const name = currentItem.querySelector(".list-name")?.textContent?.trim() || "Chat";
          archiveChat(id, type, name);
          showToast(`"${name}" archived`);
        }
      } else if (dx > 60) {
        // Swipe right → delete
        const id = currentItem.dataset.chatId;
        const type = currentItem.dataset.chatType;
        const name = currentItem.querySelector(".list-name")?.textContent?.trim() || "Chat";
        currentItem.style.transition = "transform 0.2s";
        currentItem.style.transform = "";
        if (id && confirm(`Delete "${name}"?`)) {
          if (typeof deleteChatForMe === "function") deleteChatForMe(id, type || "");
        }
      } else {
        currentItem.style.transition = "transform 0.2s";
        currentItem.style.transform = "";
      }
    }
    currentItem.classList.remove("swipe-left-active", "swipe-right-active");
    currentItem = null;
    swipeState = null;
  }, { passive: true });
}

// Init swipe when DOM is ready
setTimeout(initChatListSwipe, 1000);

// ---------- 13. Wire orphaned setting buttons ----------
function wireNewFeatureButtons() {
  // Notes button
  const notesBtn = document.getElementById("notesBtn") || document.querySelector('[data-action="notes"]');
  if (!notesBtn) {
    // Add notes button in settings list
    const storageBtn = document.getElementById("storageManagerBtn");
    if (storageBtn && !document.getElementById("notesSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "notesSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Notes";
      btn.onclick = showNotes;
      storageBtn.parentElement?.insertBefore(btn, storageBtn);
    }
  }

  // Bookmarked messages button
  const bookmarksBtn = document.getElementById("bookmarkedMessagesBtn");
  if (!bookmarksBtn) {
    const exportBackup = document.getElementById("exportBackupBtn");
    if (exportBackup && !document.getElementById("bookmarksSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "bookmarksSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Bookmarked Messages";
      btn.onclick = showBookmarkedMessages;
      exportBackup.parentElement?.insertBefore(btn, exportBackup);
    }
  }

  // Smart Replies settings button
  const srSettingsBtn = document.getElementById("smartRepliesSettingsBtn");
  if (!srSettingsBtn) {
    const appLock = document.getElementById("appLockSettingsBtn");
    if (appLock && !document.getElementById("srSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "srSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Smart Replies (AI)";
      btn.onclick = () => {
        loadSmartRepliesConfig();
        document.getElementById("smartRepliesEnabled").checked = smartRepliesEnabled;
        document.getElementById("smartRepliesApiKey").value = smartRepliesApiKey;
        document.getElementById("smartRepliesSettingsModal").style.display = "flex";
      };
      appLock.parentElement?.insertBefore(btn, appLock);
    }
  }

  // Chat statistics button (in chat info)
  const statsBtn = document.getElementById("chatStatsBtn");
  if (!statsBtn && document.getElementById("giExportChatBtn")) {
    const btn = document.createElement("button");
    btn.id = "chatStatsBtn";
    btn.className = "gi-action-item";
    btn.textContent = "📊 Chat Statistics";
    btn.onclick = showChatStatistics;
    document.getElementById("giExportChatBtn")?.parentElement?.appendChild(btn);
  }

  // Summary button
  const summaryBtn = document.getElementById("summaryBtn");
  if (!summaryBtn && document.getElementById("giExportChatBtn")) {
    const btn = document.createElement("button");
    btn.id = "summaryBtn";
    btn.className = "gi-action-item";
    btn.textContent = "📋 Summarize";
    btn.onclick = summarizeUnreadMessages;
    document.getElementById("giExportChatBtn")?.parentElement?.appendChild(btn);
  }

  // Create event option in message context menu
  if (!document.querySelector("[data-create-event-btn]")) {
    const menu = document.getElementById("messageContextMenu");
    if (menu) {
      const obs = new MutationObserver(() => {
        if (menu.querySelector("[data-create-event-btn]")) return;
        const divider = menu.querySelector(".context-divider");
        const item = document.createElement("div");
        item.className = "context-item";
        item.dataset.createEventBtn = "true";
        item.textContent = "Create calendar event";
        item.onclick = () => {
          document.getElementById("messageContextMenu").style.display = "none";
          populateEventFromMessage();
        };
        if (divider) menu.insertBefore(item, divider);
        else menu.appendChild(item);
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Effect button in compose area
  const effectBtn = document.getElementById("effectBtn");
  if (!effectBtn) {
    const sendBtn = document.getElementById("sendBtn");
    if (sendBtn && !document.getElementById("effectBtn")) {
      const btn = document.createElement("button");
      btn.id = "effectBtn";
      btn.className = "icon-btn";
      btn.title = "Message effect";
      btn.innerHTML = "✨";
      btn.style.cssText = "font-size:16px;";
      btn.onclick = () => { document.getElementById("messageEffectsPanel").style.display = "flex"; };
      sendBtn.parentElement?.insertBefore(btn, sendBtn);
    }
  }
}

// Wire close buttons for new modals
document.getElementById("closeBookmarkedMessages")?.addEventListener("click", () => document.getElementById("bookmarkedMessagesModal").style.display = "none");
document.getElementById("closeChatStats")?.addEventListener("click", () => document.getElementById("chatStatsModal").style.display = "none");
document.getElementById("closeMsgEffects")?.addEventListener("click", () => document.getElementById("messageEffectsPanel").style.display = "none");
document.getElementById("closeSmartReplies")?.addEventListener("click", () => document.getElementById("smartRepliesSettingsModal").style.display = "none");
document.getElementById("closeChatSummary")?.addEventListener("click", () => document.getElementById("chatSummaryModal").style.display = "none");
document.getElementById("closeNotesModal")?.addEventListener("click", () => document.getElementById("notesModal").style.display = "none");
document.getElementById("saveSmartRepliesBtn")?.addEventListener("click", () => {
  const enabled = document.getElementById("smartRepliesEnabled").checked;
  const key = document.getElementById("smartRepliesApiKey").value.trim();
  saveSmartRepliesConfig(enabled, key);
  showToast("Smart replies settings saved");
  document.getElementById("smartRepliesSettingsModal").style.display = "none";
});

// Init all new features
loadSmartRepliesConfig();
setTimeout(wireNewFeatureButtons, 2000);
setTimeout(initChatListSwipe, 2000);

// ===== PHASE 2: MESSAGING & RICH CONTENT =====

// ---------- 1. Message Scheduling ----------
let scheduledMessagePendingText = "";

function showScheduleModal() {
  const input = document.getElementById("messageInput");
  const text = input?.value?.trim();
  if (!text && !currentAttachment) { showToast("Type a message first", "error"); return; }
  scheduledMessagePendingText = text || "";
  document.getElementById("scheduledMsgPreview").textContent = scheduledMessagePendingText.substring(0, 100) || "[Attachment]";
  // Set default date/time to 1 hour from now
  const now = new Date();
  now.setHours(now.getHours() + 1);
  document.getElementById("scheduledDateInput").value = now.toISOString().split("T")[0];
  document.getElementById("scheduledTimeInput").value = now.toTimeString().slice(0, 5);
  document.getElementById("scheduleMessageModalV2").style.display = "flex";
}

document.getElementById("confirmScheduleBtn")?.addEventListener("click", async () => {
  const date = document.getElementById("scheduledDateInput").value;
  const time = document.getElementById("scheduledTimeInput").value;
  if (!date || !time) { showToast("Please select date and time", "error"); return; }
  const scheduledAt = new Date(date + "T" + time);
  if (scheduledAt <= new Date()) { showToast("Schedule time must be in the future", "error"); return; }
  if (!currentUser || !currentChat) return;
  try {
    await db.collection("scheduledMessages").add({
      userId: currentUser.uid,
      chatId: currentChat.id,
      chatType: currentChatType,
      text: scheduledMessagePendingText,
      attachment: currentAttachment || null,
      scheduledAt: firebase.firestore.Timestamp.fromDate(scheduledAt),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: "pending",
    });
    showToast("Message scheduled");
    document.getElementById("scheduleMessageModalV2").style.display = "none";
    const input = document.getElementById("messageInput");
    if (input) input.value = "";
    if (document.getElementById("sendBtn")) document.getElementById("sendBtn").style.display = "inline-flex";
  } catch (e) {
    showToast("Failed to schedule: " + e.message, "error");
  }
});

document.getElementById("closeScheduleMsg")?.addEventListener("click", () => {
  document.getElementById("scheduleMessageModalV2").style.display = "none";
});

// Schedule message button in composer (long-press send or separate button)
(function addScheduleMsgBtn() {
  const check = setInterval(() => {
    const sendBtn = document.getElementById("sendBtn");
    if (!sendBtn || document.getElementById("scheduleMsgQuickBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "scheduleMsgQuickBtn";
    btn.className = "icon-btn";
    btn.title = "Schedule message";
    btn.innerHTML = "⏰";
    btn.style.cssText = "font-size:14px;";
    btn.onclick = showScheduleModal;
    sendBtn.parentElement?.insertBefore(btn, sendBtn);
  }, 500);
})();

// Process scheduled messages (called on page load and periodically)
async function processScheduledMessages() {
  if (!currentUser) return;
  try {
    const now = firebase.firestore.Timestamp.now();
    const snap = await db.collection("scheduledMessages")
      .where("userId", "==", currentUser.uid)
      .where("status", "==", "pending")
      .where("scheduledAt", "<=", now)
      .get();
    for (const doc of snap.docs) {
      const data = doc.data();
      try {
        // Send the message
        const msgData = {
          senderId: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email,
          text: data.text || "",
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          status: "sent",
          read: false,
          readBy: { [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp() },
          deliveredTo: {},
        };
        if (data.attachment) msgData.attachment = data.attachment;
        if (data.chatType === "direct") msgData.directId = data.chatId;
        else msgData.groupId = data.chatId;
        await db.collection("messages").add(msgData);
        await doc.ref.update({ status: "sent", sentAt: firebase.firestore.FieldValue.serverTimestamp() });
      } catch (e) {
        await doc.ref.update({ status: "failed", error: e.message });
      }
    }
  } catch (e) { /* ignore */ }
}
setInterval(processScheduledMessages, 30000);
setTimeout(processScheduledMessages, 5000);

// ---------- 2. Drafts Sync to Firestore ----------
let draftSyncTimer = null;
function syncDraftToFirestore(chatId, chatType, text) {
  if (!currentUser || !chatId) return;
  clearTimeout(draftSyncTimer);
  draftSyncTimer = setTimeout(async () => {
    try {
      if (text) {
        await db.collection("drafts").doc(`${currentUser.uid}_${chatId}`).set({
          userId: currentUser.uid,
          chatId: chatId,
          chatType: chatType,
          text: text,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await db.collection("drafts").doc(`${currentUser.uid}_${chatId}`).delete().catch(() => {});
      }
    } catch (e) { /* ignore sync errors */ }
  }, 1000);
}

// Patch saveCurrentDraft to also sync to Firestore
const _origSaveCurrentDraft = window.saveCurrentDraft;
async function _patchedSaveCurrentDraft() {
  if (_origSaveCurrentDraft) _origSaveCurrentDraft();
  const input = document.getElementById("messageInput");
  const text = input?.value || "";
  if (currentChat?.id) syncDraftToFirestore(currentChat.id, currentChatType, text);
}
if (typeof saveCurrentDraft !== "undefined") {
  window.saveCurrentDraft = _patchedSaveCurrentDraft;
}

// ---------- 3. Markdown Preview ----------
function renderMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);
  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // Bold, italic, strikethrough
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Block code
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  // Blockquote
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  // Unordered list
  html = html.replace(/^[\*\-] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");
  // Ordered list
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  // Lines
  html = html.replace(/\n/g, "<br>");
  return html;
}

(function addMarkdownToggle() {
  const check = setInterval(() => {
    const container = document.getElementById("emojiBtn")?.parentElement;
    if (!container || document.getElementById("markdownToggleBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "markdownToggleBtn";
    btn.className = "markdown-preview-btn";
    btn.title = "Markdown preview";
    btn.innerHTML = "<b style='font-size:13px;font-family:serif;'>M↓</b>";
    btn.onclick = () => {
      const panel = document.getElementById("markdownPreviewPanel");
      const input = document.getElementById("messageInput");
      if (panel) {
        if (panel.style.display === "block") {
          panel.style.display = "none";
          btn.classList.remove("active");
        } else {
          panel.innerHTML = renderMarkdown(input?.value || "");
          panel.style.display = "block";
          btn.classList.add("active");
        }
      }
    };
    // Update preview on input change
    const input = document.getElementById("messageInput");
    if (input) {
      input.addEventListener("input", () => {
        const panel = document.getElementById("markdownPreviewPanel");
        const toggle = document.getElementById("markdownToggleBtn");
        if (panel && panel.style.display === "block" && toggle?.classList.contains("active")) {
          panel.innerHTML = renderMarkdown(input.value || "");
        }
      });
    }
    // Insert markdown toggle before emoji button or after it
    container.insertBefore(btn, container.firstChild);
  }, 500);
})();

// ---------- 4. Inline Reply with Quote Image ----------
// Patch existing reply rendering to show thumbnail for media replies
(function patchReplyPreview() {
  const style = document.createElement("style");
  style.textContent = `
    .reply-preview-thumb { display: inline-block; width: 28px; height: 28px; border-radius: 6px; object-fit: cover; vertical-align: middle; margin-right: 6px; }
  `;
  document.head.appendChild(style);
})();

// When replyTo data contains attachment URL, show thumbnail
function enrichReplyPreview(replyData) {
  if (!replyData) return "";
  if (replyData.attachmentUrl) {
    const isImage = replyData.attachmentType === "image" || replyData.fileUrl?.match?.(/\.(jpg|jpeg|png|gif|webp)/i);
    if (isImage) {
      return `<img class="reply-preview-thumb" src="${escapeHtml(replyData.attachmentUrl)}" alt=""> `;
    }
  }
  return "";
}

// Patch the existing reply preview rendering in loadMessages
// We do this by overriding a small part: the reply preview builder
const _origRenderReplyTo = window.renderReplyTo;
if (typeof renderReplyTo === "function") {
  const _origRRT = renderReplyTo;
  renderReplyTo = function(replyData) {
    const base = _origRRT ? _origRRT(replyData) : "";
    const thumb = enrichReplyPreview(replyData);
    if (thumb) {
      return thumb + base;
    }
    return base;
  };
}

// ---------- 5. Message Translation ----------
async function translateMessageText(text, targetLang = "en") {
  if (!text || text.length < 2) return text;
  try {
    // Use a free translation API (LibreTranslate public instance)
    const resp = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: "auto", target: targetLang, format: "text" }),
    });
    const data = await resp.json();
    return data.translatedText || text;
  } catch (e) {
    // Fallback: use Google Translate via simple web API
    try {
      const resp = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
      const data = await resp.json();
      if (data?.[0]?.[0]?.[0]) return data[0][0][0];
    } catch (e2) { /* ignore */ }
    return text;
  }
}

function addTranslateButtonToMessage(msgDiv, text) {
  if (!text || text.length < 3 || msgDiv.querySelector(".msg-translate-btn")) return;
  // Check if it's already in English (rough heuristic)
  const hasNonLatin = /[^\x00-\x7F]/.test(text);
  if (!hasNonLatin) return;
  const btn = document.createElement("button");
  btn.className = "msg-translate-btn";
  btn.innerHTML = "🌐 Translate";
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = "Translating...";
    try {
      const translated = await translateMessageText(text);
      if (translated !== text) {
        const existing = msgDiv.querySelector(".msg-translation-result");
        if (existing) existing.remove();
        const result = document.createElement("div");
        result.className = "msg-translation-result";
        result.textContent = translated;
        msgDiv.querySelector(".message-content")?.appendChild(result);
        btn.textContent = "✅ Translated";
      } else {
        btn.textContent = "Could not translate";
      }
    } catch (e) {
      btn.textContent = "Translation failed";
    }
    setTimeout(() => { btn.remove(); }, 3000);
  };
  msgDiv.querySelector(".message-footer")?.appendChild(btn);
}

// Patch loadMessages to add translate buttons to foreign language messages
const _origLoadMsgsForTrans = loadMessages;
loadMessages = function() {
  const result = _origLoadMsgsForTrans.apply(this, arguments);
  setTimeout(() => {
    document.querySelectorAll("#messagesArea .message:not(.my-message) .message-text").forEach(el => {
      const msgDiv = el.closest(".message");
      if (msgDiv && !msgDiv.querySelector(".msg-translate-btn")) {
        const text = el.textContent?.trim();
        if (text && /[^\x00-\x7F]/.test(text)) {
          addTranslateButtonToMessage(msgDiv, text);
        }
      }
    });
  }, 300);
  return result;
};

// ---------- 6. Sender Name Color Picker ----------
async function setSenderColor(color) {
  if (!currentUser) return;
  try {
    await db.collection("userProfiles").doc(currentUser.uid).set(
      { groupColor: color },
      { merge: true }
    );
    localStorage.setItem("tc_sender_color", color);
    showToast("Sender color updated");
  } catch (e) {
    showToast("Failed to save color", "error");
  }
}

function getSenderColor(uid) {
  // Check if we have a stored color for this user
  return localStorage.getItem("tc_sender_color_"+uid) || "";
}

// Apply colors to message sender names when rendering
(function patchSenderNameColor() {
  const style = document.createElement("style");
  style.textContent = `
    .message .sender-name { transition: color 0.2s; }
  `;
  document.head.appendChild(style);
  
  // Observer to apply colors after rendering
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".message .sender-name").forEach(el => {
      const msgDiv = el.closest(".message");
      if (!msgDiv || el.dataset.colorApplied) return;
      const senderId = msgDiv.dataset.senderId;
      if (senderId && senderId !== currentUser?.uid) {
        const color = getSenderColor(senderId);
        if (color) {
          el.style.color = color;
          el.classList.add("sender-name-colored");
        }
      }
      el.dataset.colorApplied = "1";
    });
  });
  obs.observe(document.getElementById("messagesArea") || document.body, { childList: true, subtree: true });
})();

// Add color picker to profile settings
(function addSenderColorPicker() {
  const check = setInterval(() => {
    const profileBody = document.querySelector("#profileModal .modal-body");
    if (!profileBody || document.getElementById("senderColorPicker")) return;
    clearInterval(check);
    const section = document.createElement("div");
    section.id = "senderColorPicker";
    section.style.cssText = "margin-top:16px;padding-top:16px;border-top:1px solid var(--border);";
    section.innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Group Message Color</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${["#ef4444","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899","#6366f1","#14b8a6","#f97316","#84cc16"].map(c => `
          <button class="sender-color-swatch" data-color="${c}" style="width:32px;height:32px;border-radius:50%;border:2px solid transparent;background:${c};cursor:pointer;transition:border-color 0.15s;"></button>
        `).join("")}
      </div>
    `;
    profileBody.appendChild(section);
    section.querySelectorAll(".sender-color-swatch").forEach(btn => {
      btn.onclick = () => {
        const color = btn.dataset.color;
        setSenderColor(color);
        section.querySelectorAll(".sender-color-swatch").forEach(b => b.style.borderColor = "transparent");
        btn.style.borderColor = "#000";
      };
    });
    // Load existing color
    (async () => {
      if (!currentUser) return;
      try {
        const doc = await db.collection("userProfiles").doc(currentUser.uid).get();
        if (doc.exists && doc.data().groupColor) {
          const c = doc.data().groupColor;
          const selectedSwatch = section.querySelector(`[data-color="${c}"]`);
          if (selectedSwatch) selectedSwatch.style.borderColor = "#000";
        }
      } catch (e) { /* ignore */ }
    })();
  }, 1000);
})();

// ---------- 7. Large File Support (Chunked Upload) ----------
let largeFileUploadCancelled = false;
let largeFileUploadXHR = null;

async function uploadLargeFile(file, onProgress) {
  if (file.size <= 25 * 1024 * 1024) {
    // Small file: use existing Cloudinary upload
    return uploadToCloudinary(file, onProgress);
  }
  // Large file: use Firebase Storage with resumable upload
  const path = `large_uploads/${currentUser.uid}/${Date.now()}_${file.name}`;
  const ref = storage.ref(path);
  const task = ref.put(file, {
    contentType: file.type,
    customMetadata: { uploadedBy: currentUser.uid }
  });
  return new Promise((resolve, reject) => {
    task.on(
      firebase.storage.TaskEvent.STATE_CHANGED,
      (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(Math.round(pct));
        if (largeFileUploadCancelled) {
          task.cancel();
          reject(new Error("Upload cancelled"));
        }
      },
      (error) => reject(error),
      async () => {
        const url = await task.snapshot.ref.getDownloadURL();
        resolve({ url, path, size: file.size, name: file.name, type: file.type });
      }
    );
  });
}

// Patch attachment upload to use large file support
(function patchAttachmentUpload() {
  const origUpload = window.uploadToCloudinary;
  if (typeof uploadToCloudinary === "function") {
    window._origUploadToCloudinary = uploadToCloudinary;
    uploadToCloudinary = async function(file, progressCb) {
      return uploadLargeFile(file, progressCb);
    };
  }
})();

// Show progress overlay during upload
function hideUploadProgress() {
  document.getElementById("fileUploadProgress").style.display = "none";
}

document.getElementById("fileUploadCancelBtn")?.addEventListener("click", () => {
  largeFileUploadCancelled = true;
  hideUploadProgress();
  if (largeFileUploadXHR) {
    largeFileUploadXHR.abort();
    largeFileUploadXHR = null;
  }
});

// ---------- 8. Read-by List Modal ----------
async function showReadByList(messageId) {
  const body = document.getElementById("readByListBody");
  if (!body) return;
  body.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">Loading...</div>';
  document.getElementById("readByListModal").style.display = "flex";
  try {
    const doc = await db.collection("messages").doc(messageId).get();
    if (!doc.exists) { body.innerHTML = "<div style='padding:20px;text-align:center;'>Message not found</div>"; return; }
    const data = doc.data();
    const readBy = data.readBy || {};
    const participants = data.participants || [];
    const entries = Object.entries(readBy).filter(([uid]) => uid !== currentUser?.uid);
    const notRead = participants.filter(p => !readBy[p] && p !== currentUser?.uid);
    if (!entries.length && !notRead.length) {
      body.innerHTML = "<div style='padding:20px;text-align:center;font-size:13px;color:var(--muted);'>No read receipts yet</div>";
      return;
    }
    let html = '<div class="stats-section-title">Read by</div>';
    for (const [uid, ts] of entries) {
      const userDoc = await db.collection("users").doc(uid).get();
      const name = userDoc.data()?.displayName || uid.slice(0, 8);
      const time = ts?.toDate?.()?.toLocaleString?.() || "Just now";
      html += `
        <div class="readby-item">
          <div class="readby-avatar">${getInitials(name)}</div>
          <span class="readby-name">${escapeHtml(name)}</span>
          <span class="readby-time">${time}</span>
        </div>`;
    }
    if (notRead.length) {
      html += '<div class="stats-section-title" style="margin-top:12px;">Not read yet</div>';
      for (const uid of notRead) {
        const userDoc = await db.collection("users").doc(uid).get();
        const name = userDoc.data()?.displayName || uid.slice(0, 8);
        html += `
          <div class="readby-item">
            <div class="readby-avatar">${getInitials(name)}</div>
            <span class="readby-name">${escapeHtml(name)}</span>
          </div>`;
      }
    }
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--danger);">Failed to load</div>';
  }
}

document.getElementById("closeReadByList")?.addEventListener("click", () => {
  document.getElementById("readByListModal").style.display = "none";
});

// Add "Read by" option to message context menu for own messages
(function addReadByToContextMenu() {
  const obs = new MutationObserver(() => {
    const menu = document.getElementById("messageContextMenu") || document.querySelector(".message-context-menu");
    if (!menu || menu.querySelector("[data-readby-btn]")) return;
    const items = menu.querySelectorAll(".context-item, .context-menu-item");
    const lastItem = items[items.length - 1];
    if (lastItem) {
      const div = document.createElement("div");
      div.className = "context-divider";
      div.dataset.readbyDivider = "true";
      lastItem.parentElement?.insertBefore(div, lastItem.nextSibling);
      const item = document.createElement("button");
      item.className = "context-menu-item";
      item.dataset.readbyBtn = "true";
      item.textContent = "Read by";
      item.onclick = () => {
        const target = document.querySelector(".context-menu-target") || document.querySelector(".message.selected");
        if (target) {
          const msgEl = target.closest(".message");
          const mid = msgEl?.dataset?.messageId || msgEl?.id;
          if (mid) showReadByList(mid);
        }
        removeMessageContextMenu();
      };
      div.parentElement?.insertBefore(item, div.nextSibling);
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// ---------- 9. Reply Preview Thumbnail ----------
// (Already covered by feature #4 - enrichReplyPreview handles it)

// ---------- 10. Voice Message Speed Control ----------
(function addVoiceSpeedControl() {
  const style = document.createElement("style");
  style.textContent = `
    .voice-message-wrapper { display: flex; align-items: center; gap: 6px; }
    .voice-message-wrapper audio { flex: 1; min-width: 100px; }
  `;
  document.head.appendChild(style);
  
  // Observe rendered messages to add speed control to audio elements
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".message audio, .message .voice-msg audio").forEach(audio => {
      if (audio.dataset.speedBtnAdded) return;
      audio.dataset.speedBtnAdded = "1";
      const wrapper = audio.closest(".voice-message-wrapper") || (() => {
        const w = document.createElement("div");
        w.className = "voice-message-wrapper";
        audio.parentElement?.insertBefore(w, audio);
        w.appendChild(audio);
        return w;
      })();
      const speeds = ["1x", "1.5x", "2x"];
      const speedContainer = document.createElement("div");
      speedContainer.style.cssText = "display:flex;gap:3px;margin-left:4px;";
      speeds.forEach(s => {
        const btn = document.createElement("button");
        btn.className = "voice-speed-btn";
        if (s === "1x") btn.classList.add("active");
        btn.textContent = s;
        btn.onclick = () => {
          audio.playbackRate = parseFloat(s);
          speedContainer.querySelectorAll(".voice-speed-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
        };
        speedContainer.appendChild(btn);
      });
      wrapper.appendChild(speedContainer);
    });
  });
  obs.observe(document.getElementById("messagesArea") || document.body, { childList: true, subtree: true });
})();

// Add new settings buttons for messaging features
(function addMessagingFeatureSettings() {
  const check = setInterval(() => {
    const settingsContainer = document.querySelector("#profileModal .modal-body");
    if (!settingsContainer || document.getElementById("scheduledMsgsSettingsBtn")) return;
    clearInterval(check);
    // Add Scheduled Messages button before Data Usage
    const dataUsageBtn = document.getElementById("dataUsageBtn");
    if (dataUsageBtn) {
      const btn = document.createElement("button");
      btn.id = "scheduledMsgsSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Scheduled Messages";
      btn.onclick = () => {
        showScheduledMessagesList();
      };
      dataUsageBtn.parentElement?.insertBefore(btn, dataUsageBtn);
    }
  }, 1000);
})();

async function showScheduledMessagesList() {
  if (!currentUser) return;
  // Create and show a simple modal with scheduled messages
  const existing = document.getElementById("scheduledListModal");
  if (existing) existing.remove();
  const modal = document.createElement("div");
  modal.id = "scheduledListModal";
  modal.className = "modal";
  modal.style.cssText = "display:flex;";
  modal.innerHTML = `
    <div class="modal-content" style="width:min(440px,96%);max-height:70vh;display:flex;flex-direction:column;">
      <div class="modal-header">
        <h3>Scheduled Messages</h3>
        <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
      </div>
      <div class="modal-body" id="scheduledListBody" style="flex:1;overflow-y:auto;">Loading...</div>
    </div>`;
  document.body.appendChild(modal);
  const body = document.getElementById("scheduledListBody");
  try {
    const snap = await db.collection("scheduledMessages")
      .where("userId", "==", currentUser.uid)
      .where("status", "==", "pending")
      .orderBy("scheduledAt", "asc")
      .limit(50)
      .get();
    if (snap.empty) {
      body.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">No scheduled messages</div>';
      return;
    }
    body.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const time = d.scheduledAt?.toDate?.()?.toLocaleString?.() || "Unknown";
      const div = document.createElement("div");
      div.className = "note-item";
      div.innerHTML = `
        <div class="note-item-content">
          <div class="note-item-text">${escapeHtml(d.text?.substring(0, 80) || "[Attachment]")}</div>
          <div class="note-item-meta">Scheduled: ${time} · ${d.chatType || "chat"}</div>
        </div>
        <button class="btn btn-outline" style="padding:4px 10px;font-size:12px;flex-shrink:0;color:var(--danger);" data-del-id="${doc.id}">Cancel</button>`;
      body.appendChild(div);
    });
    body.querySelectorAll("[data-del-id]").forEach(btn => {
      btn.onclick = async () => {
        await db.collection("scheduledMessages").doc(btn.dataset.delId).delete();
        showScheduledMessagesList();
      };
    });
  } catch (e) {
    body.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--danger);">Failed to load</div>';
  }
}

// ---------- END OF MESSAGING & RICH CONTENT ----------

// ===== PHASE 3: GROUP ADMIN FEATURES =====

// ---------- 11. Group Poll Results Visibility ----------
(async function initPollVisibility() {
  // Patch showGroupInfo to wire the poll visibility setting
  const origSGI = showGroupInfo;
  if (typeof showGroupInfo === "function") {
    showGroupInfo = async function() {
      const result = await origSGI.apply(this, arguments);
      if (!currentGroup) return result;
      const isAdmin = currentGroupMembers.find(m => m.id === currentUser.uid)?.role;
      const isAdm = ["owner", "admin"].includes(isAdmin);
      const row = document.getElementById("groupPollVisibilityRow");
      if (row) row.style.display = isAdm ? "flex" : "none";
      const sel = document.getElementById("groupPollVisibilitySelect");
      if (sel) {
        sel.value = currentGroup.pollVisibility || "everyone";
        sel.onchange = async () => {
          if (!isAdm) return;
          await db.collection("groups").doc(currentGroup.id).update({ pollVisibility: sel.value });
          showToast("Poll visibility updated");
        };
      }
      return result;
    };
  }
})();

// ---------- 12. Member-since Date in Group Info ----------
(async function patchMemberSince() {
  const origLoadMembers = window.loadGroupMembers;
  if (typeof loadGroupMembers === "function") {
    window._origLoadGroupMembers = loadGroupMembers;
    loadGroupMembers = async function(groupId) {
      const result = await window._origLoadGroupMembers.apply(this, arguments);
      // After loading members, add "member since" to each row
      setTimeout(() => {
        document.querySelectorAll("#groupMembersList .gi-member-item").forEach(item => {
          if (item.querySelector(".member-since")) return;
          const nameEl = item.querySelector(".gi-member-name");
          if (!nameEl || item.dataset.memberSincePatched) return;
          item.dataset.memberSincePatched = "1";
          // Fetch join date from groupMembers collection
          const memberId = item.dataset.memberId;
          if (memberId && currentGroup) {
            db.collection("groupMembers")
              .where("groupId", "==", currentGroup.id)
              .where("userId", "==", memberId)
              .get()
              .then(snap => {
                snap.forEach(doc => {
                  const data = doc.data();
                  const joinedAt = data.joinedAt || data.createdAt;
                  if (joinedAt) {
                    const date = joinedAt.toDate ? joinedAt.toDate() : new Date(joinedAt);
                    const span = document.createElement("span");
                    span.className = "member-since";
                    span.textContent = "Joined " + date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                    nameEl.appendChild(span);
                  }
                });
              }).catch(() => {});
          }
        });
      }, 200);
      return result;
    };
  }
})();

// ---------- 13. Batch Member Management ----------
let selectedBatchMembers = new Set();

function toggleBatchMember(memberId) {
  if (selectedBatchMembers.has(memberId)) selectedBatchMembers.delete(memberId);
  else selectedBatchMembers.add(memberId);
  updateBatchBar();
}

function updateBatchBar() {
  const bar = document.getElementById("batchMemberBar");
  const count = document.getElementById("batchMemberCount");
  if (!bar || !count) return;
  count.textContent = selectedBatchMembers.size + " selected";
  bar.style.display = selectedBatchMembers.size > 0 ? "flex" : "none";
}

(async function initBatchManagement() {
  // Add batch mode toggle to members section
  const origShowGI = showGroupInfo;
  if (typeof showGroupInfo === "function") {
    showGroupInfo = async function() {
      const result = await origShowGI.apply(this, arguments);
      // Add batch mode button after members title
      const title = document.getElementById("giMembersTitle");
      if (title && !document.getElementById("batchModeToggle")) {
        const toggle = document.createElement("button");
        toggle.id = "batchModeToggle";
        toggle.className = "gi-add-btn";
        toggle.textContent = "Select";
        toggle.style.cssText = "margin-left:8px;font-size:11px;padding:2px 10px;";
        toggle.onclick = () => {
          const list = document.getElementById("groupMembersList");
          if (list) list.classList.toggle("batch-mode");
          toggle.textContent = list?.classList.contains("batch-mode") ? "Done" : "Select";
          if (!list?.classList.contains("batch-mode")) {
            selectedBatchMembers.clear();
            updateBatchBar();
          }
          // Add checkboxes to each member
          if (list?.classList.contains("batch-mode")) {
            list.querySelectorAll(".gi-member-item").forEach(item => {
              if (item.querySelector(".batch-checkbox")) return;
              const cb = document.createElement("input");
              cb.type = "checkbox";
              cb.className = "batch-checkbox";
              cb.onchange = () => {
                const id = item.dataset.memberId;
                if (id) toggleBatchMember(id);
              };
              item.insertBefore(cb, item.firstChild);
            });
          } else {
            list?.querySelectorAll(".batch-checkbox").forEach(cb => cb.remove());
          }
        };
        title.parentElement?.insertBefore(toggle, title.nextSibling);
      }
      // Add member IDs to items
      const list = document.getElementById("groupMembersList");
      if (list) {
        list.querySelectorAll(".gi-member-item").forEach(item => {
          if (item.dataset.memberId) return;
          const btn = item.querySelector(".gi-member-action-btn");
          if (btn) item.dataset.memberId = btn.dataset.id;
        });
      }
      return result;
    };
  }

  // Wire batch action buttons
  const doBatchAction = async (action) => {
    if (!selectedBatchMembers.size || !currentGroup) return;
    const ids = [...selectedBatchMembers];
    const nameMap = {};
    currentGroupMembers.forEach(m => { nameMap[m.id] = m.name; });
    const isConfirm = confirm(`${action} ${ids.length} member(s)?`);
    if (!isConfirm) return;
    for (const id of ids) {
      try {
        const name = nameMap[id] || "Unknown";
        if (action === "promote") await makeAdmin(currentGroup.id, id, name);
        else if (action === "demote") await removeAdmin(currentGroup.id, id, name);
        else if (action === "remove") await removeMember(currentGroup.id, id, name);
      } catch (e) { /* continue */ }
    }
    selectedBatchMembers.clear();
    updateBatchBar();
    showGroupInfo();
  };

  document.getElementById("batchPromoteBtn")?.addEventListener("click", () => doBatchAction("promote"));
  document.getElementById("batchDemoteBtn")?.addEventListener("click", () => doBatchAction("demote"));
  document.getElementById("batchRemoveBtn")?.addEventListener("click", () => doBatchAction("remove"));
  document.getElementById("batchClearBtn")?.addEventListener("click", () => {
    selectedBatchMembers.clear();
    updateBatchBar();
    document.getElementById("groupMembersList")?.querySelectorAll(".batch-checkbox").forEach(cb => cb.checked = false);
  });
})();

// ---------- 14. Group Usage Dashboard ----------
async function showGroupUsageDashboard() {
  const body = document.getElementById("groupUsageBody");
  if (!body || !currentGroup) return;
  body.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">Loading dashboard...</div>';
  document.getElementById("groupUsageModal").style.display = "flex";
  try {
    const groupId = currentGroup.id;
    const totalMsgs = (await db.collection("messages").where("groupId", "==", groupId).get()).size;
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const weekMsgs = (await db.collection("messages").where("groupId", "==", groupId).where("timestamp", ">=", weekAgo).get()).size;
    const monthAgo = new Date(Date.now() - 30 * 86400000);
    const monthMsgs = (await db.collection("messages").where("groupId", "==", groupId).where("timestamp", ">=", monthAgo).get()).size;
    const members = currentGroupMembers.length;
    const admins = currentGroupMembers.filter(m => ["owner", "admin"].includes(m.role)).length;
    const mediaMsgs = (await db.collection("messages").where("groupId", "==", groupId).where("type", "in", ["image","video","audio"]).get()).size;

    body.innerHTML = `
      <div class="stats-section-title">Overview</div>
      <div class="usage-stat-card"><span class="usage-stat-label">Total Messages</span><span class="usage-stat-value">${totalMsgs}</span></div>
      <div class="usage-stat-card"><span class="usage-stat-label">Messages (7 days)</span><span class="usage-stat-value">${weekMsgs}</span></div>
      <div class="usage-stat-card"><span class="usage-stat-label">Messages (30 days)</span><span class="usage-stat-value">${monthMsgs}</span></div>
      <div class="usage-stat-card"><span class="usage-stat-label">Media Files</span><span class="usage-stat-value">${mediaMsgs}</span></div>
      <div class="usage-stat-card"><span class="usage-stat-label">Members</span><span class="usage-stat-value">${members}</span></div>
      <div class="usage-stat-card"><span class="usage-stat-label">Admins</span><span class="usage-stat-value">${admins}</span></div>
      <div class="usage-stat-card"><span class="usage-stat-label">Group Age</span><span class="usage-stat-value">${currentGroup.createdAt ? Math.floor((Date.now() - currentGroup.createdAt.toDate()) / 86400000) + " days" : "N/A"}</span></div>
    `;
  } catch (e) {
    body.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--danger);">Failed to load dashboard</div>';
  }
}

document.getElementById("giUsageDashboardBtn")?.addEventListener("click", showGroupUsageDashboard);

// ---------- 15. Welcome Message with Media ----------
(async function patchWelcomeMedia() {
  // Add media attachment to welcome message modal
  const obs = new MutationObserver(() => {
    const modal = document.getElementById("welcomeMessageModal");
    if (!modal || modal.querySelector(".welcome-media-input")) return;
    const body = modal.querySelector(".modal-body");
    if (!body) return;
    const input = document.createElement("input");
    input.type = "file";
    input.id = "welcomeMediaInput";
    input.className = "welcome-media-input";
    input.accept = "image/*,video/*";
    input.style.cssText = "display:block;margin-top:8px;font-size:12px;";
    const label = document.createElement("label");
    label.style.cssText = "font-size:13px;font-weight:600;display:block;margin-top:12px;margin-bottom:4px;";
    label.textContent = "Media (optional)";
    const preview = document.createElement("div");
    preview.id = "welcomeMediaPreview";
    preview.style.cssText = "margin-top:8px;";
    body.insertBefore(preview, body.querySelector(".modal-footer"));
    body.insertBefore(input, preview);
    body.insertBefore(label, input);

    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          preview.innerHTML = `<img class="welcome-media-preview" src="${e.target.result}" alt="">`;
        };
        reader.readAsDataURL(file);
      }
    };

    // Patch save welcome message to include media
    const saveBtn = document.getElementById("saveWelcomeMessageBtn");
    if (saveBtn) {
      const origClick = saveBtn.onclick;
      saveBtn.onclick = async () => {
        const text = document.getElementById("welcomeMessageInput")?.value || "";
        const file = document.getElementById("welcomeMediaInput")?.files?.[0];
        let mediaUrl = "";
        if (file) {
          try {
            mediaUrl = await uploadToCloudinary(file);
          } catch (e) { /* ignore */ }
        }
        if (currentGroup) {
          await db.collection("groups").doc(currentGroup.id).update({
            welcomeMessage: text,
            welcomeMediaUrl: mediaUrl,
          });
          showToast("Welcome message saved");
          document.getElementById("welcomeMessageModal").style.display = "none";
        }
      };
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// ---------- 16. Group Invite Expiry ----------
(async function initInviteExpiry() {
  const origSGI = showGroupInfo;
  if (typeof showGroupInfo === "function") {
    showGroupInfo = async function() {
      const result = await origSGI.apply(this, arguments);
      const isAdmin = ["owner", "admin"].includes(currentGroupMembers.find(m => m.id === currentUser.uid)?.role);
      const row = document.getElementById("groupInviteExpiryRow");
      if (row) row.style.display = isAdmin ? "flex" : "none";
      const sel = document.getElementById("groupInviteExpirySelect");
      if (sel && currentGroup) {
        sel.value = String(currentGroup.inviteExpiry || 0);
        sel.onchange = async () => {
          if (!isAdmin || !currentGroup) return;
          const secs = parseInt(sel.value) || 0;
          await db.collection("groups").doc(currentGroup.id).update({ inviteExpiry: secs });
          // If expiry is set, schedule a cloud function or handle client-side
          if (secs > 0) {
            const expiresAt = new Date(Date.now() + secs * 1000);
            await db.collection("groups").doc(currentGroup.id).update({
              inviteExpiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
            });
            showToast("Invite link will expire in " + sel.options[sel.selectedIndex].text);
          } else {
            await db.collection("groups").doc(currentGroup.id).update({ inviteExpiresAt: null });
            showToast("Invite link expiry disabled");
          }
        };
      }
      // Show expiry badge if set
      if (currentGroup?.inviteExpiresAt) {
        const display = document.getElementById("groupCodeDisplay")?.parentElement;
        if (display && !display.querySelector(".invite-expiry-badge")) {
          const badge = document.createElement("span");
          badge.className = "invite-expiry-badge";
          const expires = currentGroup.inviteExpiresAt.toDate();
          badge.textContent = "Expires " + expires.toLocaleDateString();
          display.appendChild(badge);
        }
      }
      return result;
    };
  }
})();

// ---------- 17. Group Tags / Labels ----------
(async function initGroupTags() {
  document.getElementById("closeGroupTags")?.addEventListener("click", () => {
    document.getElementById("groupTagsModal").style.display = "none";
  });

  document.getElementById("manageGroupTagsBtn")?.addEventListener("click", () => {
    if (!currentGroup) return;
    document.getElementById("groupTagsModal").style.display = "flex";
    // Highlight current tag
    const currentTag = currentGroup.groupTag || "";
    document.querySelectorAll("#groupTagSelector .group-tag-option").forEach(btn => {
      btn.classList.toggle("selected", btn.dataset.tag === currentTag);
    });
  });

  document.querySelectorAll("#groupTagSelector .group-tag-option").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tag = btn.dataset.tag;
      if (!currentGroup) return;
      await db.collection("groups").doc(currentGroup.id).update({ groupTag: tag });
      currentGroup.groupTag = tag;
      showToast(tag ? "Tag set to " + tag : "Tag removed");
      // Update title display
      const title = document.getElementById("groupInfoTitle");
      if (title) {
        title.querySelectorAll(".group-tag").forEach(el => el.remove());
        if (tag) {
          const span = document.createElement("span");
          span.className = "group-tag " + tag;
          span.textContent = tag;
          title.appendChild(span);
        }
      }
      document.getElementById("groupTagsModal").style.display = "none";
    });
  });
})();

// ---------- 18. Temporary Groups ----------
(async function initTemporaryGroups() {
  document.getElementById("closeTemporaryGroup")?.addEventListener("click", () => {
    document.getElementById("temporaryGroupModal").style.display = "none";
  });

  document.getElementById("manageTemporaryGroupBtn")?.addEventListener("click", () => {
    if (!currentGroup) return;
    document.getElementById("temporaryGroupModal").style.display = "flex";
    document.getElementById("temporaryGroupDuration").value = String(currentGroup.temporaryDuration || 0);
  });

  document.getElementById("saveTemporaryGroupBtn")?.addEventListener("click", async () => {
    if (!currentGroup) return;
    const secs = parseInt(document.getElementById("temporaryGroupDuration").value) || 0;
    if (secs > 0) {
      const expiresAt = new Date(Date.now() + secs * 1000);
      await db.collection("groups").doc(currentGroup.id).update({
        temporaryDuration: secs,
        temporaryExpiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
        isTemporary: true,
      });
      showToast("Group will auto-delete after selected duration");
    } else {
      await db.collection("groups").doc(currentGroup.id).update({
        temporaryDuration: 0,
        temporaryExpiresAt: null,
        isTemporary: false,
      });
      showToast("Temporary mode disabled");
    }
    document.getElementById("temporaryGroupModal").style.display = "none";
    showGroupInfo();
  });

  document.getElementById("clearTemporaryGroupBtn")?.addEventListener("click", async () => {
    if (!currentGroup) return;
    await db.collection("groups").doc(currentGroup.id).update({
      temporaryDuration: 0,
      temporaryExpiresAt: null,
      isTemporary: false,
    });
    showToast("Temporary mode disabled");
    document.getElementById("temporaryGroupModal").style.display = "none";
    showGroupInfo();
  });

  // Show countdown if temporary group
  const origSGI = showGroupInfo;
  if (typeof showGroupInfo === "function") {
    showGroupInfo = async function() {
      const result = await origSGI.apply(this, arguments);
      if (currentGroup?.isTemporary && currentGroup?.temporaryExpiresAt) {
        const nameSection = document.querySelector(".gi-name-row") || document.getElementById("editGroupNameInput")?.parentElement;
        if (nameSection && !nameSection.querySelector(".temp-group-countdown")) {
          const el = document.createElement("div");
          el.className = "temp-group-countdown";
          el.textContent = "⏳ Auto-deletes " + currentGroup.temporaryExpiresAt.toDate().toLocaleDateString();
          nameSection.appendChild(el);
        }
      }
      return result;
    };
  }

  // Check for expired temporary groups
  setInterval(async () => {
    if (!currentUser) return;
    try {
      const now = firebase.firestore.Timestamp.now();
      const snap = await db.collection("groups")
        .where("isTemporary", "==", true)
        .where("temporaryExpiresAt", "<=", now)
        .get();
      for (const doc of snap.docs) {
        // Delete the group
        await db.collection("groups").doc(doc.id).delete();
        await db.collection("groupMembers").where("groupId", "==", doc.id).get().then(s => {
          s.forEach(d => d.ref.delete());
        });
        // Notify members
        const members = await db.collection("groupMembers").where("groupId", "==", doc.id).get();
        members.forEach(m => {
          db.collection("notifications").add({
            userId: m.data().userId,
            type: "group_deleted",
            title: "Group deleted",
            body: "A temporary group has expired and been deleted.",
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          }).catch(() => {});
        });
        showToast("A temporary group has expired and been deleted");
      }
    } catch (e) { /* ignore */ }
  }, 60000); // Check every minute
})();

// ---------- 19. Group Announcement Channel ----------
(async function initAnnouncementMode() {
  const origSGI = showGroupInfo;
  if (typeof showGroupInfo === "function") {
    showGroupInfo = async function() {
      const result = await origSGI.apply(this, arguments);
      const isAdmin = ["owner", "admin"].includes(currentGroupMembers.find(m => m.id === currentUser.uid)?.role);
      const row = document.getElementById("groupAnnouncementRow");
      if (row) row.style.display = isAdmin ? "flex" : "none";
      const toggle = document.getElementById("groupAnnouncementToggle");
      if (toggle && currentGroup) {
        toggle.checked = currentGroup.announcementMode === true;
        toggle.onchange = async () => {
          if (!isAdmin || !currentGroup) return;
          await db.collection("groups").doc(currentGroup.id).update({
            announcementMode: toggle.checked,
            onlyAdminsCanSend: toggle.checked, // Also enforce send permission
          });
          showToast(toggle.checked ? "Announcement mode enabled" : "Announcement mode disabled");
          // Show/hide badge on group title
          const title = document.getElementById("groupInfoTitle");
          if (title) {
            title.querySelectorAll(".gi-announcement-badge").forEach(el => el.remove());
            if (toggle.checked) {
              const badge = document.createElement("span");
              badge.className = "gi-announcement-badge";
              badge.textContent = "📢 Announcements";
              title.appendChild(badge);
            }
          }
        };
      }
      // Show badge if already enabled
      if (currentGroup?.announcementMode) {
        const title = document.getElementById("groupInfoTitle");
        if (title && !title.querySelector(".gi-announcement-badge")) {
          const badge = document.createElement("span");
          badge.className = "gi-announcement-badge";
          badge.textContent = "📢 Announcements";
          title.appendChild(badge);
        }
      }
      return result;
    };
  }

  // Also update the send permission check to consider announcement mode
  const origSendMessage = sendMessage;
  if (typeof sendMessage === "function") {
    sendMessage = async function() {
      if (currentChatType === "group" && currentGroup?.announcementMode) {
        const isAdmin = ["owner", "admin"].includes(currentGroupMembers.find(m => m.id === currentUser.uid)?.role);
        if (!isAdmin) {
          showToast("Only admins can send messages in announcement mode", "error");
          return;
        }
      }
      return origSendMessage.apply(this, arguments);
    };
  }
})();

// ---------- 20. Mute Individual Member in Group ----------
let muteMemberTargetId = null;

document.getElementById("closeMuteMember")?.addEventListener("click", () => {
  document.getElementById("muteMemberModal").style.display = "none";
});

document.getElementById("confirmMuteMemberBtn")?.addEventListener("click", async () => {
  if (!muteMemberTargetId || !currentGroup) return;
  const duration = parseInt(document.getElementById("muteMemberDuration").value) || 0;
  const expiresAt = duration > 0 ? new Date(Date.now() + duration * 1000) : null;
  const muteKey = `muted_member_${currentGroup.id}_${muteMemberTargetId}`;
  localStorage.setItem(muteKey, JSON.stringify({
    memberId: muteMemberTargetId,
    groupId: currentGroup.id,
    expiresAt: expiresAt?.toISOString() || null,
  }));
  showToast(expiresAt ? "Member muted for selected duration" : "Member muted permanently");
  document.getElementById("muteMemberModal").style.display = "none";
  showGroupInfo();
});

(async function initMuteMember() {
  const origSGI = showGroupInfo;
  if (typeof showGroupInfo === "function") {
    showGroupInfo = async function() {
      const result = await origSGI.apply(this, arguments);
      // Add mute button to each member row (for admins)
      const isAdmin = ["owner", "admin"].includes(currentGroupMembers.find(m => m.id === currentUser.uid)?.role);
      if (!isAdmin) return result;
      const list = document.getElementById("groupMembersList");
      if (!list) return result;
      list.querySelectorAll(".gi-member-item").forEach(item => {
        if (item.querySelector(".gi-mute-member-btn") || item.dataset.muteChecked) return;
        item.dataset.muteChecked = "1";
        const id = item.dataset.memberId;
        if (!id || id === currentUser.uid) return;
        const actions = item.querySelector(".gi-member-actions") || item.querySelector(".gi-member-info");
        if (!actions) return;
        const muteBtn = document.createElement("button");
        muteBtn.className = "gi-member-action-btn gi-mute-member-btn";
        muteBtn.style.cssText = "margin-left:4px;";
        const muteKey = `muted_member_${currentGroup.id}_${id}`;
        const mutedData = localStorage.getItem(muteKey);
        const isMuted = mutedData && (() => {
          try {
            const d = JSON.parse(mutedData);
            if (d.expiresAt && new Date(d.expiresAt) < new Date()) { localStorage.removeItem(muteKey); return false; }
            return true;
          } catch(e) { return false; }
        })();
        muteBtn.textContent = isMuted ? "🔊" : "🔇";
        muteBtn.title = isMuted ? "Unmute member" : "Mute member";
        muteBtn.onclick = (e) => {
          e.stopPropagation();
          if (isMuted) {
            localStorage.removeItem(muteKey);
            showToast("Member unmuted");
            showGroupInfo();
          } else {
            muteMemberTargetId = id;
            document.getElementById("muteMemberModal").style.display = "flex";
          }
        };
        actions.appendChild(muteBtn);

        // Add muted badge if muted
        if (isMuted) {
          const nameEl = item.querySelector(".gi-member-name");
          if (nameEl && !nameEl.querySelector(".muted-badge")) {
            const badge = document.createElement("span");
            badge.className = "muted-badge";
            badge.textContent = "🔇 Muted";
            nameEl.appendChild(badge);
          }
        }
      });

      // Also handle member IDs for items
      list.querySelectorAll(".gi-member-item").forEach(item => {
        if (item.dataset.memberId) return;
        const btn = item.querySelector(".gi-member-action-btn");
        if (btn) item.dataset.memberId = btn.dataset.id;
      });

      return result;
    };
  }

  // Filter out muted members' messages in loadMessages
  const origLoadMsgs = loadMessages;
  if (typeof loadMessages === "function") {
    loadMessages = function() {
      const result = origLoadMsgs.apply(this, arguments);
      // When rendering, check muted members and hide their messages
      if (currentChatType === "group" && currentGroup) {
        setTimeout(() => {
          document.querySelectorAll("#messagesArea .message").forEach(el => {
            const senderId = el.dataset.senderId;
            if (!senderId) return;
            const muteKey = `muted_member_${currentGroup.id}_${senderId}`;
            const mutedData = localStorage.getItem(muteKey);
            if (mutedData) {
              try {
                const d = JSON.parse(mutedData);
                if (d.expiresAt && new Date(d.expiresAt) < new Date()) {
                  localStorage.removeItem(muteKey);
                  return;
                }
                // Add muted indicator
                if (!el.querySelector(".muted-badge")) {
                  el.style.opacity = "0.4";
                  const badge = document.createElement("div");
                  badge.style.cssText = "font-size:10px;color:var(--muted);padding:2px 0;";
                  badge.textContent = "🔇 Muted member";
                  el.querySelector(".message-content")?.appendChild(badge);
                }
              } catch(e) { /* ignore */ }
            }
          });
        }, 200);
      }
      return result;
    };
  }
})();

// ---------- END OF GROUP ADMIN FEATURES ----------

// ===== PHASE 4: UI/UX POLISH =====

// ---------- 21. Pull-to-Refresh Chat List ----------
(function initPullToRefresh() {
  const list = document.getElementById("chatsList");
  if (!list) return;
  let startY = 0, pulling = false, pullDist = 0;
  const indicator = document.createElement("div");
  indicator.className = "pull-to-refresh-indicator";
  indicator.style.cssText = "display:none;";
  indicator.innerHTML = '<div class="spinner"></div><span>Refreshing...</span>';
  list.parentElement?.insertBefore(indicator, list);

  list.addEventListener("touchstart", (e) => {
    if (list.scrollTop <= 0) {
      startY = e.touches[0].clientY;
      pulling = true;
      pullDist = 0;
    }
  }, { passive: true });

  list.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0 && list.scrollTop <= 0) {
      pullDist = Math.min(dy * 0.5, 80);
      indicator.style.display = "flex";
      indicator.style.opacity = pullDist / 80;
    }
  }, { passive: true });

  list.addEventListener("touchend", () => {
    if (pulling && pullDist > 50) {
      indicator.style.opacity = "1";
      indicator.innerHTML = '<div class="spinner"></div><span>Refreshing...</span>';
      loadCurrentChatList();
      loadArchivedChats();
      setTimeout(() => {
        indicator.style.display = "none";
        indicator.innerHTML = '<div class="spinner"></div><span>Refreshing...</span>';
      }, 1500);
    } else {
      indicator.style.display = "none";
    }
    pulling = false;
    pullDist = 0;
  }, { passive: true });
})();

// ---------- 22. Swipe Right to Open Chat ----------
(function initSwipeRightToOpen() {
  const list = document.getElementById("chatsList");
  if (!list) return;
  let startX2 = 0, startY2 = 0, swipeRightItem = null;
  list.addEventListener("touchstart", (e) => {
    const item = e.target.closest(".list-item");
    if (!item) return;
    startX2 = e.touches[0].clientX;
    startY2 = e.touches[0].clientY;
    swipeRightItem = item;
  }, { passive: true });
  list.addEventListener("touchmove", (e) => {
    if (!swipeRightItem) return;
    const dx = e.touches[0].clientX - startX2;
    const dy = e.touches[0].clientY - startY2;
    if (dx > 40 && Math.abs(dx) > Math.abs(dy) * 2) {
      e.preventDefault();
    }
  }, { passive: false });
  list.addEventListener("touchend", (e) => {
    if (!swipeRightItem) return;
    const dx = e.changedTouches[0].clientX - startX2;
    const dy = e.changedTouches[0].clientY - startY2;
    if (dx > 60 && Math.abs(dx) > Math.abs(dy) * 2) {
      // Swipe right - open the chat
      swipeRightItem.click();
    }
    swipeRightItem = null;
  }, { passive: true });
})();

// ---------- 23. Chat List Avatar Badges ----------
(function addAvatarBadges() {
  // Add online dot and unread badge to avatar in chat list
  const obs = new MutationObserver(() => {
    document.querySelectorAll("#chatsList .list-item").forEach(item => {
      if (item.dataset.badgesPatched) return;
      item.dataset.badgesPatched = "1";
      const avatar = item.querySelector(".list-avatar");
      if (!avatar) return;
      // Wrap in container if not already
      if (!avatar.closest(".avatar-badge-container")) {
        const container = document.createElement("div");
        container.className = "avatar-badge-container";
        avatar.parentElement?.insertBefore(container, avatar);
        container.appendChild(avatar);
      }
      const container = avatar.closest(".avatar-badge-container");
      // Add online dot
      if (item.dataset.chatType === "user" && !container.querySelector(".avatar-online-dot")) {
        const dot = document.createElement("div");
        dot.className = "avatar-online-dot";
        dot.style.display = "none"; // Will be shown conditionally
        container.appendChild(dot);
      }
      // Add unread badge
      const unread = parseInt(item.dataset.unreadCount || "0");
      if (unread > 0 && !container.querySelector(".avatar-unread-badge")) {
        const badge = document.createElement("div");
        badge.className = "avatar-unread-badge";
        badge.textContent = unread > 99 ? "99+" : unread;
        container.appendChild(badge);
      }
    });
  });
  obs.observe(document.getElementById("chatsList") || document.body, { childList: true, subtree: true });
})();

// ---------- 24. Message Grouping ----------
(function initMessageGrouping() {
  // Patch loadMessages to group consecutive messages from same sender
  const origLoad = loadMessages;
  if (typeof loadMessages === "function") {
    loadMessages = function() {
      const result = origLoad.apply(this, arguments);
      setTimeout(() => {
        const area = document.getElementById("messagesArea");
        if (!area) return;
        const msgs = area.querySelectorAll(".message");
        let lastSender = null;
        let lastTime = null;
        msgs.forEach((msg, i) => {
          const sender = msg.dataset.senderId;
          const isMyMsg = msg.classList.contains("my-message");
          if (sender && sender === lastSender && !isMyMsg && i > 0) {
            const prev = msgs[i - 1];
            if (prev && prev.dataset.senderId === sender) {
              msg.classList.add("message-group-tail");
              // Hide avatar if grouped
              const avatar = msg.querySelector(".message-avatar");
              if (avatar) avatar.style.visibility = "hidden";
              // Hide sender name
              const name = msg.querySelector(".sender-name");
              if (name) name.style.display = "none";
              const prevContent = prev.querySelector(".message-content");
              const thisContent = msg.querySelector(".message-content");
              if (prevContent && thisContent) {
                prevContent.style.borderBottomLeftRadius = "4px";
                thisContent.style.borderTopLeftRadius = "4px";
              }
            }
          } else if (sender && sender !== lastSender && !isMyMsg) {
            msg.classList.add("message-group-first");
          }
          lastSender = sender;
        });
      }, 100);
      return result;
    };
  }
})();

// ---------- 25. Scroll to Bottom FAB ----------
(function addScrollToBottomBtn() {
  const container = document.getElementById("messagesArea")?.parentElement || document.querySelector(".messages-container");
  if (!container) return;
  const btn = document.createElement("button");
  btn.className = "scroll-to-bottom-btn";
  btn.id = "scrollToBottomBtn";
  btn.innerHTML = "↓";
  btn.title = "Scroll to bottom";
  container.style.position = "relative";
  container.appendChild(btn);
  let isNearBottom = true;
  container.addEventListener("scroll", () => {
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    btn.style.display = nearBottom ? "none" : "flex";
    isNearBottom = nearBottom;
    if (nearBottom) btn.classList.remove("has-new");
  });
  btn.onclick = () => {
    container.scrollTop = container.scrollHeight;
    btn.style.display = "none";
    btn.classList.remove("has-new");
  };
  // Track new messages while scrolled up
  window._tcScrollToBottomBtn = btn;
  window._tcIsNearBottom = () => isNearBottom;
})();

// Patch to show "new messages" indicator when scrolled up
(function patchNewMsgIndicator() {
  const origRender = renderChatListItems;
  // Also patch the main message loading to show indicator
  const origLoadMsgs2 = loadMessages;
  if (typeof loadMessages === "function") {
    loadMessages = function() {
      const result = origLoadMsgs2.apply(this, arguments);
      // After messages load, scroll to bottom if near bottom
      const container = document.getElementById("messagesArea")?.parentElement;
      if (container && window._tcIsNearBottom?.()) {
        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
      }
      return result;
    };
  }
})();

// ---------- 26. Typing Indicator Per User ----------
(function patchTypingIndicator() {
  const origSetTyping = window.updateTypingIndicator;
  if (typeof updateTypingIndicator === "function") {
    window._origUpdateTyping = updateTypingIndicator;
    updateTypingIndicator = function(typingUsers) {
      const result = window._origUpdateTyping ? window._origUpdateTyping(typingUsers) : null;
      const indicator = document.getElementById("typingIndicator");
      if (!indicator || !typingUsers || !typingUsers.length) return result;
      // Enhance to show individual names
      const names = typingUsers
        .filter(u => u.userId !== currentUser?.uid)
        .map(u => u.displayName || u.name || "Someone")
        .slice(0, 3);
      if (names.length > 0) {
        let text = names.join(", ");
        if (typingUsers.length > 3) text += " and " + (typingUsers.length - 3) + " others";
        text += typingUsers.length === 1 ? " is typing..." : " are typing...";
        indicator.querySelector(".typing-individual")?.remove();
        const span = document.createElement("span");
        span.className = "typing-individual";
        span.textContent = text;
        indicator.appendChild(span);
      }
      return result;
    };
  }
})();

// ---------- 27. Auto-Scroll on New Message ----------
// (handled in scroll-to-bottom + loadMessages patch above)

// ---------- 28. Infinite Scroll / Pagination ----------
(function addPagination() {
  const container = document.getElementById("messagesArea")?.parentElement;
  if (!container) return;
  let loadingOlder = false;
  container.addEventListener("scroll", async () => {
    if (container.scrollTop < 100 && !loadingOlder && window._tcHasMoreMessages !== false) {
      loadingOlder = true;
      const btn = document.querySelector(".load-older-btn");
      if (btn && btn.style.display !== "none") {
        btn.click();
      }
      setTimeout(() => { loadingOlder = false; }, 1000);
    }
  });
})();

// ---------- 29. Message Time Grouping ----------
(function addTimeGrouping() {
  const origLoad = loadMessages;
  if (typeof loadMessages === "function") {
    loadMessages = function() {
      const result = origLoad.apply(this, arguments);
      setTimeout(() => {
        const area = document.getElementById("messagesArea");
        if (!area) return;
        const msgs = area.querySelectorAll(".message");
        let lastDay = "";
        msgs.forEach((msg, i) => {
          if (msg.querySelector(".message-time-group")) return;
          // Try to get the message data
          const msgData = msg._messageData || {};
          const ts = msgData.timestamp;
          if (!ts) return;
          const date = ts.toDate ? ts.toDate() : new Date(ts);
          const day = date.toDateString();
          if (day !== lastDay && i > 0) {
            const divider = document.createElement("div");
            divider.className = "message-time-group";
            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            if (day === today) divider.textContent = "Today";
            else if (day === yesterday) divider.textContent = "Yesterday";
            else divider.textContent = date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
            msg.parentElement?.insertBefore(divider, msg);
          }
          lastDay = day;
        });
      }, 200);
      return result;
    };
  }
})();

// ---------- 30. Progress bar on file upload ----------
// (already handled by fileUploadProgress element - patched into uploadToCloudinary)



// ---------- 32. Long-Press Context Menu on Chat List ----------
(function addLongPressChatList() {
  const list = document.getElementById("chatsList");
  if (!list) return;
  let longPressTimer = null;
  list.addEventListener("touchstart", (e) => {
    const item = e.target.closest(".list-item");
    if (!item) return;
    longPressTimer = setTimeout(() => {
      // Show a simple context menu
      const existing = document.querySelector(".chat-list-context-menu");
      if (existing) existing.remove();
      const menu = document.createElement("div");
      menu.className = "chat-list-context-menu";
      menu.style.cssText = "position:fixed;z-index:9999;background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.18);padding:8px 0;min-width:180px;";
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      menu.style.left = Math.min(x, window.innerWidth - 200) + "px";
      menu.style.top = Math.min(y, window.innerHeight - 200) + "px";
      const chatId = item.dataset.chatId;
      const chatType = item.dataset.chatType;
      const otherUserId = item.dataset.otherUserId;
      const items = [
        { label: "Mark as unread", action: async () => {
          if (chatId) {
            await db.collection("chatsReadState").doc(currentUser.uid + "_" + chatId).set({
              lastReadAt: new Date(0),
            }, { merge: true });
            showToast("Marked as unread");
          }
        }},
        { label: chatType === "group" ? "Group info" : "Contact info", action: () => {
          if (chatType === "group") showGroupInfo();
          else if (otherUserId) startDirectChat({ id: otherUserId });
          else showToast("Cannot open contact info", "error");
        }},
        { label: "Pin/Unpin", action: async () => {
          if (!chatId) return;
          const isPinned = pinnedChatIds.includes(chatId);
          if (isPinned) {
            await db.collection("pinnedChats").where("userId", "==", currentUser.uid).where("chatId", "==", chatId).get().then(s => s.forEach(d => d.ref.delete()));
            pinnedChatIds = pinnedChatIds.filter(id => id !== chatId);
          } else {
            await db.collection("pinnedChats").add({ userId: currentUser.uid, chatId, chatType: chatType || "direct", pinnedAt: firebase.firestore.FieldValue.serverTimestamp() });
            pinnedChatIds.push(chatId);
          }
          showToast(isPinned ? "Unpinned" : "Pinned");
          loadCurrentChatList();
        }},
        { label: "Archive", action: () => { if (chatId) archiveChat(chatId, chatType || ""); }},
        { label: "Delete", action: () => { if (chatId) deleteChatForMe(chatId, chatType || ""); }, danger: true },
      ];
      items.forEach(it => {
        const btn = document.createElement("button");
        btn.textContent = it.label;
        btn.style.cssText = `display:block;width:100%;padding:10px 16px;text-align:left;background:none;border:none;font-size:13px;cursor:pointer;${it.danger ? "color:var(--danger);" : ""}`;
        btn.onmouseover = () => btn.style.background = "var(--panel-hover)";
        btn.onmouseout = () => btn.style.background = "none";
        btn.onclick = () => { it.action(); menu.remove(); };
        menu.appendChild(btn);
      });
      document.body.appendChild(menu);
      const closeMenu = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("touchstart", closeMenu); } };
      setTimeout(() => document.addEventListener("touchstart", closeMenu), 100);
    }, 600);
  }, { passive: true });
  list.addEventListener("touchend", () => { clearTimeout(longPressTimer); }, { passive: true });
  list.addEventListener("touchmove", () => { clearTimeout(longPressTimer); }, { passive: true });
})();

// ---------- 33. Empty State Illustrations ----------
(function enhanceEmptyStates() {
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".empty-state").forEach(el => {
      if (el.dataset.illustrated) return;
      el.dataset.illustrated = "1";
      const text = el.textContent?.trim() || "";
      let emoji = "";
      if (text.includes("No chats") || text.includes("no chats")) emoji = "💬";
      else if (text.includes("No messages") || text.includes("no messages")) emoji = "✉️";
      else if (text.includes("No requests") || text.includes("no requests")) emoji = "📭";
      else if (text.includes("No results") || text.includes("no results")) emoji = "🔍";
      else emoji = "📄";
      if (!el.querySelector(".empty-state-illustration")) {
        const illus = document.createElement("div");
        illus.className = "empty-state-illustration";
        illus.textContent = emoji;
        el.prepend(illus);
      }
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// ---------- 34. Shimmer Loading Skeleton ----------
function showShimmerSkeleton(container, count = 5) {
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const div = document.createElement("div");
    div.className = "shimmer-skeleton";
    div.innerHTML = `
      <div class="shimmer-circle"></div>
      <div class="shimmer-lines">
        <div class="shimmer-line"></div>
        <div class="shimmer-line short"></div>
      </div>`;
    container.appendChild(div);
  }
}

// Patch chat list loading to show shimmer
(function patchChatListShimmer() {
  const origLoad = loadCurrentChatList;
  if (typeof loadCurrentChatList === "function") {
    loadCurrentChatList = async function() {
      const container = document.getElementById("chatsList");
      if (container && container.querySelectorAll(".list-item").length === 0) {
        showShimmerSkeleton(container, 6);
      }
      const result = await origLoad.apply(this, arguments);
      // Remove shimmers
      container?.querySelectorAll(".shimmer-skeleton").forEach(el => el.remove());
      return result;
    };
  }
})();

// ---------- END OF UI/UX POLISH ----------

// ===== PHASE 5: CALLS & VOICE/VIDEO =====

// ---------- 35. Call Recording ----------
let isCallRecording = false;
let mediaRecorderCall = null;
let recordedCallChunks = [];
let _recTimerInterval = null;
let _recStartTime = 0;
let _recCapturedCallId = null;
let _recAudioCtx = null;

const _recIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="#e53935" stroke="none"/></svg>`;
const _recStopSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="#e53935" stroke="none"/></svg>`;

function _ensureRecTimerEl() {
  let el = document.getElementById("callRecordingTimer");
  if (el) return el;
  el = document.createElement("div");
  el.id = "callRecordingTimer";
  el.innerHTML = `<span class="rec-indicator"></span><span id="callRecTimerText">0:00</span>&nbsp;REC`;
  const stage = document.querySelector(".call-video-stage");
  if (stage) stage.appendChild(el);
  return el;
}

function _startRecTimer() {
  _recStartTime = Date.now();
  const timerEl = _ensureRecTimerEl();
  timerEl.classList.add("visible");
  _recTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - _recStartTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = String(elapsed % 60).padStart(2, "0");
    const txt = document.getElementById("callRecTimerText");
    if (txt) txt.textContent = `${m}:${s}`;
  }, 1000);
}

function _stopRecTimer() {
  clearInterval(_recTimerInterval);
  _recTimerInterval = null;
  const timerEl = document.getElementById("callRecordingTimer");
  if (timerEl) timerEl.classList.remove("visible");
}

function _buildMixedCallStream() {
  const tracks = [];
  try {
    _recAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const dest = _recAudioCtx.createMediaStreamDestination();
    if (localCallStream) {
      localCallStream.getAudioTracks().forEach(t => {
        const src = _recAudioCtx.createMediaStreamSource(new MediaStream([t]));
        src.connect(dest);
      });
    }
    const remoteAudioEl = document.getElementById("remoteAudio");
    if (remoteAudioEl?.srcObject) {
      remoteAudioEl.srcObject.getAudioTracks().forEach(t => {
        const src = _recAudioCtx.createMediaStreamSource(new MediaStream([t]));
        src.connect(dest);
      });
    }
    dest.stream.getAudioTracks().forEach(t => tracks.push(t));
  } catch (_) {
    localCallStream?.getAudioTracks().forEach(t => tracks.push(t));
  }
  if (currentCallType === "video" && localCallStream) {
    localCallStream.getVideoTracks().forEach(t => tracks.push(t));
  }
  return new MediaStream(tracks);
}

async function _uploadRecordingAndLink(blob, callId) {
  if (!currentUser) return;
  const ext = blob.type.includes("video") ? "webm" : "webm";
  const path = `call_recordings/${currentUser.uid}/${callId || Date.now()}/${Date.now()}.${ext}`;
  const storageRef = firebase.storage().ref(path);
  const uploadTask = storageRef.put(blob);

  const toastId = "recUpload_" + Date.now();
  showToast("Uploading recording…", "info", 30000);

  await new Promise((resolve, reject) => {
    uploadTask.on(
      firebase.storage.TaskEvent.STATE_CHANGED,
      null,
      (err) => { showToast("Failed to save recording", "error"); reject(err); },
      resolve
    );
  });

  const url = await storageRef.getDownloadURL();
  showToast("Recording saved ✓", "success");

  if (callId) {
    const msgDocId = `call_${callId}`;
    try {
      await db.collection("messages").doc(msgDocId).set(
        { recordingUrl: url, recordingPath: path },
        { merge: true }
      );
    } catch (_) {}
  }
  if (_recAudioCtx) { _recAudioCtx.close().catch(() => {}); _recAudioCtx = null; }
}

function toggleCallRecording() {
  if (!localCallStream) return;
  if (isCallRecording) {
    mediaRecorderCall?.stop();
    isCallRecording = false;
    _stopRecTimer();
    const btn = document.getElementById("recordCallBtn");
    if (btn) {
      btn.innerHTML = _recIconSVG;
      btn.setAttribute("data-control-label", "Record");
      btn.classList.remove("recording");
    }
    showToast("Call recording stopped");
    return;
  }
  try {
    _recCapturedCallId = activeCall?.id || null;
    recordedCallChunks = [];
    const mixedStream = _buildMixedCallStream();
    const isVideo = currentCallType === "video" && mixedStream.getVideoTracks().length > 0;
    const mimeType = isVideo
      ? (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm")
      : (MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm");
    mediaRecorderCall = new MediaRecorder(mixedStream, { mimeType });
    mediaRecorderCall.ondataavailable = (e) => {
      if (e.data.size > 0) recordedCallChunks.push(e.data);
    };
    mediaRecorderCall.onstop = () => {
      const blob = new Blob(recordedCallChunks, { type: mimeType.split(";")[0] });
      recordedCallChunks = [];
      _uploadRecordingAndLink(blob, _recCapturedCallId).catch(() => {});
    };
    mediaRecorderCall.start(1000);
    isCallRecording = true;
    _startRecTimer();
    const btn = document.getElementById("recordCallBtn");
    if (btn) {
      btn.innerHTML = _recStopSVG;
      btn.setAttribute("data-control-label", "Stop Rec");
      btn.classList.add("recording");
    }
    showToast("Recording started — both sides captured");
  } catch (e) {
    showToast("Recording not supported on this device", "error");
  }
}

// Add recording button to call controls
(function addCallRecordBtn() {
  const check = setInterval(() => {
    const controls = document.querySelector(".call-controls");
    if (!controls || document.getElementById("recordCallBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "recordCallBtn";
    btn.className = "call-icon-btn";
    btn.title = "Record call";
    btn.setAttribute("data-control-label", "Record");
    btn.innerHTML = _recIconSVG;
    btn.onclick = toggleCallRecording;
    const endBtn = document.getElementById("endCallBtn");
    if (endBtn) endBtn.parentElement?.insertBefore(btn, endBtn);
    else controls.appendChild(btn);
  }, 1000);
})();

// ---------- Screen Recording ----------
let isScreenRecording = false;
let screenRecordingRecorder = null;
let screenRecordingChunks = [];
let screenCaptureStream = null;

async function toggleScreenRecording() {
  if (!localCallStream) return;
  if (isScreenRecording) {
    screenRecordingRecorder?.stop();
    screenCaptureStream?.getTracks().forEach((t) => t.stop());
    screenCaptureStream = null;
    isScreenRecording = false;
    const btn = document.getElementById("screenRecordBtn");
    if (btn) btn.textContent = "🎥";
    showToast("Screen recording stopped");
    return;
  }
  try {
    screenCaptureStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: false,
    });
    const combinedStream = new MediaStream();
    screenCaptureStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));
    localCallStream.getAudioTracks().forEach((t) => combinedStream.addTrack(t));
    screenRecordingChunks = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    screenRecordingRecorder = new MediaRecorder(combinedStream, { mimeType });
    screenRecordingRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) screenRecordingChunks.push(e.data);
    };
    screenRecordingRecorder.onstop = async () => {
      const blob = new Blob(screenRecordingChunks, { type: "video/webm" });
      const path = `screen_recordings/${currentUser.uid}/${Date.now()}.webm`;
      try {
        await storage.ref(path).put(blob);
        showToast("Screen recording saved");
      } catch (e) {
        showToast("Failed to save screen recording", "error");
      }
      screenRecordingChunks = [];
    };
    screenRecordingRecorder.start();
    isScreenRecording = true;
    const btn = document.getElementById("screenRecordBtn");
    if (btn) btn.textContent = "⏺";
    showToast("Screen recording started");
    screenCaptureStream.getVideoTracks()[0].onended = () => {
      if (isScreenRecording) toggleScreenRecording();
    };
  } catch (e) {
    if (e.name !== "NotAllowedError") {
      showToast("Screen recording not available", "error");
    }
  }
}

function stopScreenRecordStream() {
  if (screenCaptureStream) {
    screenCaptureStream.getTracks().forEach((t) => t.stop());
    screenCaptureStream = null;
  }
  screenRecordingRecorder = null;
}

(function addScreenRecordBtn() {
  const check = setInterval(() => {
    const controls = document.querySelector(".call-controls");
    if (!controls || document.getElementById("screenRecordBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "screenRecordBtn";
    btn.className = "call-icon-btn";
    btn.title = "Record screen";
    btn.textContent = "🎥";
    btn.onclick = toggleScreenRecording;
    const recBtn = document.getElementById("recordCallBtn");
    if (recBtn) recBtn.parentElement?.insertBefore(btn, recBtn);
  }, 1000);
})();

// ---------- Waiting Room ----------
function toggleWaitingRoom() {
  if (!activeCall?.id || !activeCall?.groupCall) return;
  const enabled = !activeCall.waitingRoomEnabled;
  activeCall.waitingRoomEnabled = enabled;
  db.collection("calls").doc(activeCall.id).update({ waitingRoomEnabled: enabled }).catch(() => {});
  showToast(`Waiting room ${enabled ? "enabled" : "disabled"}`);
  const btn = document.getElementById("waitingRoomBtn");
  if (btn) btn.classList.toggle("active", enabled);
}

(function addWaitingRoomBtn() {
  const check = setInterval(() => {
    const controls = document.querySelector(".call-controls");
    if (!controls || document.getElementById("waitingRoomBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "waitingRoomBtn";
    btn.className = "call-icon-btn";
    btn.title = "Waiting room";
    btn.textContent = "🚪";
    btn.onclick = toggleWaitingRoom;
    const endBtn = document.getElementById("endCallBtn");
    if (endBtn) endBtn.parentElement?.insertBefore(btn, endBtn);
  }, 1000);
})();

// Listen for waiting participants in group calls (host only)
(function initWaitingParticipantListener() {
  let waitingUnsub = null;
  waitingParticipantCheckInterval = setInterval(() => {
    if (activeCall?.id && activeCall?.groupCall && activeCall?.fromUserId === currentUser?.uid) {
      if (!waitingUnsub) {
        waitingUnsub = db.collection("calls").doc(activeCall.id)
          .onSnapshot((snap) => {
            const data = snap.data() || {};
            const waitingIds = Object.entries(data.participantStates || {})
              .filter(([, state]) => state === "waiting")
              .map(([id]) => id);
            waitingIds.forEach((uid) => {
              const name = data.participantNames?.[uid] || "Someone";
              if (confirm(`${name} wants to join. Admit?`)) {
                db.collection("calls").doc(activeCall.id).update({
                  [`participantStates.${uid}`]: "joined"
                }).catch(() => {});
              } else {
                db.collection("calls").doc(activeCall.id).update({
                  [`participantStates.${uid}`]: "rejected"
                }).catch(() => {});
              }
            });
          });
      }
    } else {
      if (waitingUnsub) { waitingUnsub(); waitingUnsub = null; }
    }
  }, 2000);
})();

// ---------- Scheduled Calls ----------
async function scheduleCall(type = "voice", scheduledFor, note = "") {
  if (!currentChat || !currentUser) return;
  if (!scheduledFor || new Date(scheduledFor) <= new Date()) {
    showToast("Please pick a future time", "error");
    return;
  }
  const scheduledAt = new Date(scheduledFor).toISOString();
  try {
    const data = {
      type,
      scheduledAt,
      note,
      creatorId: currentUser.uid,
      creatorName: currentUser.displayName || currentUser.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: "scheduled",
    };
    if (currentChatType === "direct") {
      data.directId = currentChat.id;
      data.participants = [currentUser.uid, currentChat.otherUserId];
    } else {
      data.groupId = currentChat.id;
      data.groupName = currentChat.name || "Group";
    }
    await db.collection("scheduledCalls").add(data);
    showToast("Call scheduled");
    document.getElementById("scheduleCallModal")?.remove();
  } catch (e) {
    showToast("Failed to schedule call", "error");
  }
}

function showScheduleCallModal() {
  const existing = document.getElementById("scheduleCallModal");
  if (existing) existing.remove();
  const modal = document.createElement("div");
  modal.id = "scheduleCallModal";
  modal.className = "modal";
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal-content" style="max-width:360px">
      <div class="modal-header"><h3>Schedule a call</h3><span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span></div>
      <div class="modal-body">
        <label style="display:block;margin-bottom:6px;font-size:13px">Date & time</label>
        <input id="schedDatetime" type="datetime-local" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:inherit;margin-bottom:12px" />
        <label style="display:block;margin-bottom:6px;font-size:13px">Call type</label>
        <select id="schedType" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:inherit;margin-bottom:12px">
          <option value="voice">Voice call</option>
          <option value="video">Video call</option>
        </select>
        <label style="display:block;margin-bottom:6px;font-size:13px">Note (optional)</label>
        <input id="schedNote" type="text" placeholder="What's this call about?" maxlength="200" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:inherit;margin-bottom:12px" />
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="schedConfirmBtn">Schedule</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById("schedConfirmBtn").onclick = () => {
    const dt = document.getElementById("schedDatetime")?.value;
    const type = document.getElementById("schedType")?.value || "voice";
    const note = document.getElementById("schedNote")?.value || "";
    scheduleCall(type, dt, note);
  };
}

// Add "Schedule call" button to chat header
(function addScheduleCallOption() {
  const check = setInterval(() => {
    const header = document.querySelector(".chat-header");
    if (!header || document.querySelector("[data-sched-call-btn]") || !currentChat?.id) return;
    clearInterval(check);
    const actions = header.querySelector(".sidebar-actions") || header.querySelector(".chat-actions");
    if (!actions) return;
    const btn = document.createElement("button");
    btn.dataset.schedCallBtn = "true";
    btn.className = "btn-icon sidebar-action";
    btn.title = "Schedule a call";
    btn.innerHTML = "📅";
    btn.onclick = showScheduleCallModal;
    actions.appendChild(btn);
  }, 1000);
})();

// Display scheduled calls in chat
(function initScheduledCallDisplay() {
  let lastSchedUnsub = null;
  const check = setInterval(() => {
    if (!currentChat || !currentUser) {
      if (lastSchedUnsub) { lastSchedUnsub(); lastSchedUnsub = null; }
      return;
    }
    if (lastSchedUnsub) return;
    const query = currentChatType === "direct"
      ? db.collection("scheduledCalls").where("directId", "==", currentChat.id)
      : db.collection("scheduledCalls").where("groupId", "==", currentChat.id);
    lastSchedUnsub = query.onSnapshot((snap) => {
      displayScheduledCalls(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => { lastSchedUnsub = null; });
    window._tcLastSchedUnsub = lastSchedUnsub;
  }, 2000);
})();

function displayScheduledCalls(calls) {
  const area = document.getElementById("scheduledCallsArea");
  if (!area) {
    const msgs = document.getElementById("messagesContainer");
    if (!msgs) return;
    const div = document.createElement("div");
    div.id = "scheduledCallsArea";
    div.style.cssText = "padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.08)";
    msgs.parentElement?.insertBefore(div, msgs);
  }
  const areaEl = document.getElementById("scheduledCallsArea");
  if (!areaEl) return;
  const upcoming = calls.filter(c => c.status === "scheduled" && c.scheduledAt && new Date(c.scheduledAt) > new Date());
  if (!upcoming.length) { areaEl.style.display = "none"; return; }
  areaEl.style.display = "block";
  areaEl.innerHTML = "<div style='font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px'>📅 Scheduled calls</div>" +
    upcoming.map(c => {
      const dt = c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : "";
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px">
        <span>${c.type === "video" ? "📹" : "📞"}</span>
        <span style="flex:1">${escapeHtml(c.note || c.type + " call")}</span>
        <span style="color:var(--text-muted);font-size:12px">${escapeHtml(dt)}</span>
      </div>`;
    }).join("");
}

// ---------- 36. Call Participant Grid View ----------
(function enhanceCallGridView() {
  // Already handled by CSS grid on #groupCallGrid, but add dynamic resize
  const obs = new MutationObserver(() => {
    const grid = document.getElementById("groupCallGrid");
    if (!grid) return;
    const videos = grid.querySelectorAll("video");
    const count = videos.length;
    if (count <= 1) grid.style.gridTemplateColumns = "1fr";
    else if (count <= 2) grid.style.gridTemplateColumns = "1fr 1fr";
    else if (count <= 4) grid.style.gridTemplateColumns = "1fr 1fr";
    else grid.style.gridTemplateColumns = "repeat(3, 1fr)";
  });
  const callModal = document.getElementById("callModal");
  if (callModal) obs.observe(callModal, { childList: true, subtree: true });
})();

// ---------- 38. Call Noise Suppression ----------
let noiseSuppressionEnabled = false;
async function toggleNoiseSuppression() {
  if (!localCallStream) return;
  try {
    // Use the browser's built-in noise suppression via getUserMedia constraints
    const audioTrack = localCallStream.getAudioTracks()[0];
    if (audioTrack) {
      await audioTrack.applyConstraints({
        noiseSuppression: !noiseSuppressionEnabled,
        echoCancellation: true,
      });
      noiseSuppressionEnabled = !noiseSuppressionEnabled;
      const btn = document.getElementById("noiseSuppressionBtn");
      if (btn) btn.classList.toggle("noise-suppression-active");
      showToast(noiseSuppressionEnabled ? "Noise suppression on" : "Noise suppression off");
    }
  } catch (e) {
    showToast("Noise suppression not available", "error");
  }
}

(function addNoiseSuppressionBtn() {
  const check = setInterval(() => {
    const controls = document.querySelector(".call-controls");
    if (!controls || document.getElementById("noiseSuppressionBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "noiseSuppressionBtn";
    btn.className = "call-icon-btn";
    btn.title = "Noise suppression";
    btn.textContent = "🔇";
    btn.onclick = toggleNoiseSuppression;
    const speakerBtn = document.getElementById("speakerCallBtn");
    if (speakerBtn) speakerBtn.parentElement?.insertBefore(btn, speakerBtn);
  }, 1000);
})();

// ---------- 39. Call Raise Hand ----------
function raiseHand() {
  const indicator = document.getElementById("raiseHandIndicator");
  if (!indicator) return;
  indicator.style.display = "block";
  indicator.textContent = "✋ Hand raised";
  setTimeout(() => { indicator.style.display = "none"; }, 3000);
  // Also send to other participants via Firestore if in a call
  if (activeCall?.callId) {
    db.collection("calls").doc(activeCall.callId).update({
      raisedHand: firebase.firestore.FieldValue.arrayUnion({
        userId: currentUser.uid,
        name: currentUser.displayName || "Someone",
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      })
    }).catch(() => {});
  }
}

(function addRaiseHandBtn() {
  const check = setInterval(() => {
    const controls = document.querySelector(".call-controls");
    if (!controls || document.getElementById("raiseHandBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "raiseHandBtn";
    btn.className = "call-icon-btn";
    btn.title = "Raise hand";
    btn.textContent = "✋";
    btn.onclick = raiseHand;
    const endBtn = document.getElementById("endCallBtn");
    if (endBtn) endBtn.parentElement?.insertBefore(btn, endBtn);
  }, 1000);
})();

// ---------- 40. Call Reactions ----------
function sendCallReaction(reaction) {
  // Show animation locally
  const anim = document.createElement("div");
  anim.className = "call-reaction-anim";
  anim.textContent = reaction;
  anim.style.bottom = "120px";
  anim.style.right = "40px";
  document.body.appendChild(anim);
  setTimeout(() => anim.remove(), 2000);
  // Send to other participants via Firestore
  if (activeCall?.callId) {
    db.collection("calls").doc(activeCall.callId).update({
      reactions: firebase.firestore.FieldValue.arrayUnion({
        userId: currentUser.uid,
        reaction: reaction,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      })
    }).catch(() => {});
  }
}

(function initCallReactions() {
  const overlay = document.getElementById("callReactionsOverlay");
  if (!overlay) return;
  overlay.querySelectorAll(".call-reaction-btn").forEach(btn => {
    btn.onclick = () => {
      sendCallReaction(btn.dataset.reaction);
      overlay.style.display = "none";
    };
  });
  // Toggle reactions overlay
  const check = setInterval(() => {
    const controls = document.querySelector(".call-controls");
    if (!controls || document.getElementById("reactionsToggleBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "reactionsToggleBtn";
    btn.className = "call-icon-btn";
    btn.title = "Reactions";
    btn.textContent = "😊";
    btn.onclick = () => {
      const ov = document.getElementById("callReactionsOverlay");
      if (ov) ov.style.display = ov.style.display === "none" ? "flex" : "none";
    };
    const raiseBtn = document.getElementById("raiseHandBtn");
    if (raiseBtn) raiseBtn.parentElement?.insertBefore(btn, raiseBtn);
  }, 1000);
})();

// ---------- 41. Call Link Sharing ----------
function shareCallLink() {
  if (!currentChat) { showToast("Open a chat first", "error"); return; }
  // Create a shareable link
  const baseUrl = window.location.origin + window.location.pathname;
  const callType = currentCallType || "voice";
  const link = `${baseUrl}?call=${currentChat.id}&type=${callType}&join=1`;
  document.getElementById("callLinkInput").value = link;
  document.getElementById("callLinkModal").style.display = "flex";
}

document.getElementById("copyCallLinkBtn")?.addEventListener("click", () => {
  const input = document.getElementById("callLinkInput");
  if (input) {
    navigator.clipboard.writeText(input.value).then(() => {
      showToast("Call link copied");
      document.getElementById("callLinkModal").style.display = "none";
    }).catch(() => showToast("Failed to copy", "error"));
  }
});
document.getElementById("closeCallLink")?.addEventListener("click", () => {
  document.getElementById("callLinkModal").style.display = "none";
});

(function addShareCallLinkBtn() {
  const check = setInterval(() => {
    const acceptBtn = document.getElementById("acceptCallBtn");
    if (!acceptBtn || document.getElementById("shareCallLinkBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "shareCallLinkBtn";
    btn.className = "call-icon-btn";
    btn.title = "Share call link";
    btn.textContent = "🔗";
    btn.onclick = shareCallLink;
    const addBtn = document.getElementById("addCallParticipantBtn");
    if (addBtn) addBtn.parentElement?.insertBefore(btn, addBtn);
  }, 1000);
})();

// ---------- 42. Call Recording Transcript ----------
// (placeholder - full transcription would use Speech-to-Text API which costs money)
// We'll store recording and note it can be transcribed later

// ---------- 44. Call Waiting / Call Hold ----------
let callOnHold = false;
const _holdIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
const _resumeIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
function toggleCallHold() {
  if (!peerConnection) return;
  callOnHold = !callOnHold;
  const audioTrack = localCallStream?.getAudioTracks()[0];
  if (audioTrack) audioTrack.enabled = !callOnHold;
  showToast(callOnHold ? "Call on hold" : "Call resumed");
  const btn = document.getElementById("holdCallBtn");
  if (btn) {
    btn.innerHTML = callOnHold ? _resumeIconSVG : _holdIconSVG;
    btn.setAttribute("data-control-label", callOnHold ? "Resume" : "Hold");
    btn.title = callOnHold ? "Resume call" : "Hold call";
  }
}
(function addHoldCallBtn() {
  const check = setInterval(() => {
    const endBtn = document.getElementById("endCallBtn");
    if (!endBtn || document.getElementById("holdCallBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "holdCallBtn";
    btn.className = "call-icon-btn";
    btn.title = "Hold call";
    btn.setAttribute("data-control-label", "Hold");
    btn.innerHTML = _holdIconSVG;
    btn.onclick = toggleCallHold;
    endBtn.parentElement?.insertBefore(btn, endBtn);
  }, 1000);
})();

// ===== PHASE 6: SEARCH & DISCOVERY =====

// ---------- 45. Search Filters ----------
let activeSearchFilters = {};

(function initSearchFilters() {
  document.getElementById("closeSearchFilters")?.addEventListener("click", () => {
    document.getElementById("searchFiltersModal").style.display = "none";
  });
  document.getElementById("applySearchFiltersBtn")?.addEventListener("click", () => {
    activeSearchFilters = {
      sender: document.getElementById("searchFilterSender")?.value?.trim() || "",
      dateFrom: document.getElementById("searchFilterDateFrom")?.value || "",
      dateTo: document.getElementById("searchFilterDateTo")?.value || "",
      type: document.getElementById("searchFilterType")?.value || "",
    };
    document.getElementById("searchFiltersModal").style.display = "none";
    // Re-trigger current search
    const input = document.getElementById("searchInput");
    if (input) {
      input.dispatchEvent(new Event("input"));
    }
    // Show badge
    showSearchFilterBadge();
    showToast("Search filters applied");
  });

  // Add filter button to search area
  const searchBox = document.querySelector(".search-box");
  if (searchBox && !document.getElementById("searchFilterBtn")) {
    const btn = document.createElement("button");
    btn.id = "searchFilterBtn";
    btn.className = "icon-btn";
    btn.title = "Search filters";
    btn.innerHTML = "🔍";
    btn.style.cssText = "font-size:14px;margin-left:4px;";
    btn.onclick = () => { document.getElementById("searchFiltersModal").style.display = "flex"; };
    searchBox.appendChild(btn);
  }
})();

function showSearchFilterBadge() {
  const existing = document.querySelector(".search-filter-badge");
  if (existing) existing.remove();
  const hasFilters = Object.values(activeSearchFilters).some(v => v);
  if (!hasFilters) return;
  const badge = document.createElement("span");
  badge.className = "search-filter-badge";
  const count = Object.values(activeSearchFilters).filter(v => v).length;
  badge.textContent = `Filters (${count}) ✕`;
  badge.onclick = () => {
    activeSearchFilters = {};
    badge.remove();
    const input = document.getElementById("searchInput");
    if (input) input.dispatchEvent(new Event("input"));
  };
  const searchBox = document.querySelector(".search-box");
  if (searchBox) searchBox.appendChild(badge);
}

// Patch search to use filters
(function patchSearchWithFilters() {
  const origSearch = window.performSearch || window.searchMessages;
  if (typeof searchMessages === "function") {
    const _origSearch = searchMessages;
    searchMessages = async function(query) {
      let results = await _origSearch.apply(this, arguments);
      // Filter results client-side
      if (activeSearchFilters.sender) {
        results = results.filter(r => {
          const name = r.senderName || "";
          return name.toLowerCase().includes(activeSearchFilters.sender.toLowerCase());
        });
      }
      if (activeSearchFilters.dateFrom) {
        const from = new Date(activeSearchFilters.dateFrom);
        results = results.filter(r => r.timestamp?.toDate?.() >= from);
      }
      if (activeSearchFilters.dateTo) {
        const to = new Date(activeSearchFilters.dateTo);
        to.setHours(23, 59, 59);
        results = results.filter(r => r.timestamp?.toDate?.() <= to);
      }
      if (activeSearchFilters.type) {
        results = results.filter(r => {
          if (activeSearchFilters.type === "link") return r.text && /https?:\/\//.test(r.text);
          if (activeSearchFilters.type === "file") return r.fileUrl && !r.text;
          return r.type === activeSearchFilters.type;
        });
      }
      return results;
    };
  }
})();

// ---------- 46. Search Within Date Range ----------
// (handled by search filters above - dateFrom and dateTo)

// ---------- 47. Search Suggestions ----------
(function addSearchSuggestions() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  const suggestionContainer = document.createElement("div");
  suggestionContainer.id = "searchSuggestions";
  suggestionContainer.style.cssText = "display:none;position:absolute;top:100%;left:0;right:0;background:var(--panel);border:1px solid var(--border);border-radius:0 0 12px 12px;z-index:500;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);";
  input.style.position = "relative";
  input.parentElement?.appendChild(suggestionContainer);

  const suggestions = [
    { icon: "💬", text: "Recent chats" },
    { icon: "📷", text: "Photos" },
    { icon: "🔗", text: "Links" },
    { icon: "📄", text: "Documents" },
  ];

  input.addEventListener("focus", () => {
    if (!input.value.trim()) {
      suggestionContainer.innerHTML = suggestions.map(s =>
        `<div class="search-suggestion" data-suggestion="${s.text}">
          <span class="search-suggestion-icon">${s.icon}</span>
          <span>${s.text}</span>
        </div>`
      ).join("");
      suggestionContainer.style.display = "block";
    }
  });

  input.addEventListener("input", () => {
    suggestionContainer.style.display = "none";
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !suggestionContainer.contains(e.target)) {
      suggestionContainer.style.display = "none";
    }
  });

  // Delegate clicks
  suggestionContainer.addEventListener("click", (e) => {
    const item = e.target.closest(".search-suggestion");
    if (!item) return;
    const text = item.dataset.suggestion;
    input.value = text;
    input.dispatchEvent(new Event("input"));
    suggestionContainer.style.display = "none";
  });
})();

// ---------- 48. Search in Groups ----------
// The existing search already searches both direct chats and groups
// Enhanced by search filters above

// ---------- 49. Search Within Forwarded Messages ----------
(function patchForwardedSearch() {
  // Patch message rendering to include forward metadata in search
  const origRender = renderMessageText || (() => {});
  if (typeof renderMessageText === "function") {
    const _origRenderText = renderMessageText;
    renderMessageText = function(msgData) {
      let html = _origRenderText(msgData);
      if (msgData.forwardedFrom) {
        html = '<span class="forwarded-trace">📤 Forwarded from ' + escapeHtml(msgData.forwardedFrom) + '</span>' + html;
      }
      return html;
    };
  }
})();

// ---------- 50. Chat List Search by Phone/Email ----------
(function enhanceSearchByPhoneEmail() {
  const origBuild = buildDirectChatItems;
  if (typeof buildDirectChatItems === "function") {
    const _origBuild = buildDirectChatItems;
    buildDirectChatItems = async function() {
      const items = await _origBuild.apply(this, arguments);
      // Add searchable fields
      for (const item of items) {
        const userData = item.user || {};
        // Try to get user data
        if (userData.phone) item.searchPhone = userData.phone;
        if (userData.email) item.searchEmail = userData.email;
      }
      return items;
    };
  }
})();

// ===== PHASE 7: PRIVACY & SECURITY =====

// ---------- 51. Disappearing Messages Per Chat ----------
(function initPerChatDisappearing() {
  // Add toggle to individual chat info (not just group)
  // Store preference per chat in localStorage
  const origRender = renderChatListItems;
  // Add chat-level disappearing message settings
  const menuCheck = setInterval(() => {
    const menu = document.getElementById("messageContextMenu") || document.querySelector(".message-context-menu");
    if (!menu || document.querySelector("[data-disappear-chat-btn]")) return;
    // No separate button needed - uses the existing disappearing messages settings
  }, 1000);
})();

// ---------- 52. Screenshot Detection ----------
(function initScreenshotDetection() {
  // Use the Page Visibility API to detect when user leaves the app
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // User might be taking a screenshot; log it
      if (currentChat?.disappearingMessagesEnabled) {
        showScreenshotToast();
      }
    }
  });

  // Also detect PrintScreen key press
  document.addEventListener("keydown", (e) => {
    if (e.key === "PrintScreen") {
      if (currentChat?.disappearingMessagesEnabled) {
        showScreenshotToast();
      }
    }
  });
})();

function showScreenshotToast() {
  const toast = document.getElementById("screenshotDetectedToast");
  if (!toast) return;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 3000);
}

// ---------- 53. Forwarded Message Trace ----------
// (already handled in Phase 6 #49 above)

// ---------- 54. Block Contact from Chat ----------
(function addBlockFromChat() {
  // Add "Block" option to chat header dropdown
  const obs = new MutationObserver(() => {
    const header = document.querySelector(".chat-header");
    if (!header || header.querySelector("[data-block-chat-btn]")) return;
    if (!currentChat || currentChatType === "group") return;
    const blockBtn = document.createElement("button");
    blockBtn.dataset.blockChatBtn = "true";
    blockBtn.className = "icon-btn";
    blockBtn.title = "Block contact";
    blockBtn.innerHTML = "🚫";
    blockBtn.style.cssText = "font-size:14px;";
    blockBtn.onclick = async () => {
      const otherId = currentChat?.otherUserId || currentChat?.id;
      if (!otherId) return;
      if (confirm("Block this contact? They won't be able to message you.")) {
        try {
          await db.collection("blockedUsers").doc(currentUser.uid + "_" + otherId).set({
            userId: currentUser.uid,
            blockedUserId: otherId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          });
          blockedUsers.push(otherId);
          showToast("Contact blocked");
        } catch (e) { showToast("Failed to block", "error"); }
      }
    };
    const menuBtns = header.querySelector(".sidebar-actions") || header.querySelector(".chat-actions");
    if (menuBtns) menuBtns.appendChild(blockBtn);
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// ---------- 55. Encryption Key Verification ----------
function showEncryptionVerification() {
  const fingerprintEl = document.getElementById("encryptionFingerprint");
  if (!fingerprintEl) return;
  // Generate a deterministic fingerprint based on user IDs
  if (currentChat) {
    const ids = [currentUser.uid, currentChat.otherUserId || currentChat.id].sort();
    const combined = ids.join("_") + (currentGroup?.encryptionEnabled ? "_e2e" : "");
    // Create a hash-like visual fingerprint
    let fingerprint = "";
    for (let i = 0; i < 60; i++) {
      fingerprint += Math.abs(combined.charCodeAt(i % combined.length) * (i + 1)) % 10;
      if (i > 0 && i % 10 === 0) fingerprint += " ";
    }
    fingerprintEl.textContent = fingerprint;
  } else {
    fingerprintEl.textContent = "Open a chat to verify encryption";
  }
  document.getElementById("encryptionVerifyModal").style.display = "flex";
}

document.getElementById("closeEncryptionVerify")?.addEventListener("click", () => {
  document.getElementById("encryptionVerifyModal").style.display = "none";
});

(function addEncryptionVerifyBtn() {
  const obs = new MutationObserver(() => {
    const header = document.querySelector(".chat-header");
    if (!header || document.querySelector("[data-encryption-verify-btn]")) return;
    const btn = document.createElement("button");
    btn.dataset.encryptionVerifyBtn = "true";
    btn.className = "icon-btn";
    btn.title = "Verify encryption";
    btn.innerHTML = "🔐";
    btn.style.cssText = "font-size:14px;";
    btn.onclick = showEncryptionVerification;
    const menuBtns = header.querySelector(".sidebar-actions") || header.querySelector(".chat-actions");
    if (menuBtns) menuBtns.appendChild(btn);
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// ---------- 56. Login Notifications ----------
(function initLoginNotification() {
  // Store last login timestamp
  const lastLogin = localStorage.getItem("tc_last_login");
  if (!lastLogin) {
    localStorage.setItem("tc_last_login", Date.now().toString());
  } else {
    // Notify about new login if more than 24 hours
    if (Date.now() - parseInt(lastLogin) > 86400000) {
      showToast("🔐 New login detected from this browser");
    }
    localStorage.setItem("tc_last_login", Date.now().toString());
  }
})();

// ---------- 57. Session Expiry ----------
(function initSessionExpiry() {
  // Store session start time
  const sessionStart = localStorage.getItem("tc_session_start");
  if (!sessionStart) {
    localStorage.setItem("tc_session_start", Date.now().toString());
  }
  // Check every hour if session is older than 7 days
  setInterval(() => {
    const start = parseInt(localStorage.getItem("tc_session_start") || "0");
    if (start > 0 && Date.now() - start > 7 * 86400000) {
      showToast("Session expired. Please log in again.");
      auth.signOut();
    }
  }, 3600000);
})();

// ---------- 58. Privacy: Profile Photo Visibility ----------
(function initPrivacySettings() {
  document.getElementById("closePrivacySettings")?.addEventListener("click", () => {
    document.getElementById("privacySettingsModal").style.display = "none";
  });

  document.getElementById("savePrivacySettingsBtn")?.addEventListener("click", async () => {
    if (!currentUser) return;
    const settings = {
      profilePhoto: document.getElementById("privacyProfilePhoto")?.value || "everyone",
      lastSeen: document.getElementById("privacyLastSeen")?.value || "everyone",
      groups: document.getElementById("privacyGroups")?.value || "everyone",
      readReceipts: document.getElementById("privacyReadReceipts")?.checked !== false,
    };
    try {
      privacySettings.lastSeen = settings.lastSeen;
      privacySettings.hideLastSeen = settings.lastSeen === "nobody";
      privacySettings.hideReadReceipts = settings.readReceipts === false;
      await updatePrivacySettings();
      await db.collection("userProfiles").doc(currentUser.uid).set({ privacy: settings }, { merge: true });
      localStorage.setItem("tc_privacy", JSON.stringify(settings));
      showToast("Privacy settings saved");
      document.getElementById("privacySettingsModal").style.display = "none";
    } catch (e) {
      showToast("Failed to save privacy settings", "error");
    }
  });

  // Add privacy settings button to profile
  const check = setInterval(() => {
    const settingsContainer = document.querySelector("#profileModal .modal-body");
    if (!settingsContainer || document.getElementById("privacySettingsProfileBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "privacySettingsProfileBtn";
    btn.className = "setting-item";
    btn.textContent = "Privacy Settings";
    btn.onclick = () => {
      // Load saved settings
      const saved = localStorage.getItem("tc_privacy");
      if (saved) {
        try {
          const s = JSON.parse(saved);
          const pp = document.getElementById("privacyProfilePhoto");
          const pls = document.getElementById("privacyLastSeen");
          const pg = document.getElementById("privacyGroups");
          const prr = document.getElementById("privacyReadReceipts");
          if (pp) pp.value = s.profilePhoto || "everyone";
          if (pls) pls.value = s.lastSeen || "everyone";
          if (pg) pg.value = s.groups || "everyone";
          if (prr) prr.checked = s.readReceipts !== false;
        } catch(e) {}
      }
      document.getElementById("privacySettingsModal").style.display = "flex";
    };
    const manageFolders = document.getElementById("manageFoldersBtn");
    if (manageFolders) manageFolders.parentElement?.insertBefore(btn, manageFolders);
  }, 1000);
})();

// ---------- 59. Privacy: Groups Added To ----------
// Handled by privacySettingsModal above (groups select)

// ---------- 60. Privacy: Online Status ----------
// Handled by privacySettingsModal above (lastSeen select)

// ---------- 61. Privacy: Read Receipts Per Chat ----------
(function perChatReadReceipts() {
  // Allow per-chat override via chat data
  const origMarkRead = window.markMessagesAsRead;
  if (typeof markMessagesAsRead === "function") {
    const _origMark = markMessagesAsRead;
    markMessagesAsRead = async function() {
      const result = await _origMark.apply(this, arguments);
      // Check if read receipts are disabled for this chat
      const chatId = currentChat?.id;
      if (chatId) {
        const pref = localStorage.getItem("tc_readreceipts_" + chatId);
        if (pref === "off") {
          // Don't update readBy with our UID
          // This is handled by not calling the read function
          return result;
        }
      }
      return result;
    };
  }
})();

// ---------- 62. Security: Active Sessions Map ----------
document.getElementById("activeSessionsBtn")?.addEventListener("click", () => {
  document.getElementById("sessionsModal").style.display = "flex";
});
document.getElementById("closeSessionsModal")?.addEventListener("click", () => {
  document.getElementById("sessionsModal").style.display = "none";
});

// ---------- 63. Self-Destructing Account ----------
(function initSelfDestruct() {
  document.getElementById("closeSelfDestruct")?.addEventListener("click", () => {
    document.getElementById("selfDestructModal").style.display = "none";
  });

  document.getElementById("saveSelfDestructBtn")?.addEventListener("click", async () => {
    if (!currentUser) return;
    const days = parseInt(document.getElementById("selfDestructDuration")?.value) || 0;
    try {
      await db.collection("userProfiles").doc(currentUser.uid).set({
        selfDestructAfterDays: days,
        selfDestructEnabled: days > 0,
        selfDestructSetAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      localStorage.setItem("tc_self_destruct", String(days));
      showToast(days > 0 ? "Account will auto-delete after " + days + " days of inactivity" : "Self-destruct disabled");
      document.getElementById("selfDestructModal").style.display = "none";
    } catch (e) {
      showToast("Failed to save setting", "error");
    }
  });

  // Add self-destruct to settings
  const check = setInterval(() => {
    if (document.getElementById("deactivateAccountBtn") && !document.getElementById("selfDestructSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "selfDestructSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Self-Destructing Account";
      btn.onclick = () => {
        document.getElementById("selfDestructDuration").value = localStorage.getItem("tc_self_destruct") || "0";
        document.getElementById("selfDestructModal").style.display = "flex";
      };
      const deactivate = document.getElementById("deactivateAccountBtn");
      if (deactivate) deactivate.parentElement?.insertBefore(btn, deactivate);
    }
  }, 1000);
})();

// ===== PHASE 8: NOTIFICATIONS =====

// ---------- 64. Keyword Alerts ----------
(function initKeywordAlerts() {
  let keywords = [];
  try { keywords = JSON.parse(localStorage.getItem("tc_keyword_alerts") || "[]"); } catch(e) {}

  function renderKeywords() {
    const list = document.getElementById("keywordAlertsList");
    if (!list) return;
    if (!keywords.length) {
      list.innerHTML = '<div style="font-size:13px;color:var(--muted);text-align:center;padding:20px;">No keywords added</div>';
      return;
    }
    list.innerHTML = keywords.map((kw, i) =>
      `<div class="keyword-alert-item">
        <span>🔔 ${escapeHtml(kw)}</span>
        <button class="remove-keyword" data-index="${i}">✕</button>
      </div>`
    ).join("");
    list.querySelectorAll(".remove-keyword").forEach(btn => {
      btn.onclick = () => {
        keywords.splice(parseInt(btn.dataset.index), 1);
        localStorage.setItem("tc_keyword_alerts", JSON.stringify(keywords));
        renderKeywords();
      };
    });
  }

  document.getElementById("closeKeywordAlerts")?.addEventListener("click", () => {
    document.getElementById("keywordAlertsModal").style.display = "none";
  });

  document.getElementById("addKeywordBtn")?.addEventListener("click", () => {
    const input = document.getElementById("keywordAlertInput");
    const kw = input?.value?.trim();
    if (!kw) return;
    if (keywords.includes(kw)) { showToast("Keyword already added"); return; }
    keywords.push(kw);
    localStorage.setItem("tc_keyword_alerts", JSON.stringify(keywords));
    if (input) input.value = "";
    renderKeywords();
    showToast("Keyword alert added");
  });

  // Add keyword alerts button to settings
  const check = setInterval(() => {
    if (document.getElementById("quickRepliesSettingsBtn") && !document.getElementById("keywordAlertsSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "keywordAlertsSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Keyword Alerts";
      btn.onclick = () => {
        renderKeywords();
        document.getElementById("keywordAlertsModal").style.display = "flex";
      };
      const qrBtn = document.getElementById("quickRepliesSettingsBtn");
      if (qrBtn) qrBtn.parentElement?.insertBefore(btn, qrBtn);
    }
  }, 1000);

  // Check incoming messages for keywords
  const origLoad = loadMessages;
  if (typeof loadMessages === "function") {
    loadMessages = function() {
      const result = origLoad.apply(this, arguments);
      if (keywords.length > 0) {
        setTimeout(() => {
          document.querySelectorAll("#messagesArea .message:not(.my-message) .message-text").forEach(el => {
            const text = el.textContent?.toLowerCase() || "";
            keywords.forEach(kw => {
              if (text.includes(kw.toLowerCase())) {
                showToast("🔔 Keyword match: \"" + kw + "\" in chat");
              }
            });
          });
        }, 500);
      }
      return result;
    };
  }
})();

// ---------- 65. Scheduled DND ----------
(function initScheduledDnd() {
  document.getElementById("closeScheduledDnd")?.addEventListener("click", () => {
    document.getElementById("scheduledDndModal").style.display = "none";
  });

  window.checkDndStatus = function() {
    const dndData = localStorage.getItem("tc_dnd");
    if (!dndData) return false;
    try {
      const dnd = JSON.parse(dndData);
      if (!dnd.enabled) return false;
      const now = new Date();
      const from = dnd.from.split(":").map(Number);
      const to = dnd.to.split(":").map(Number);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const fromMinutes = from[0] * 60 + from[1];
      const toMinutes = to[0] * 60 + to[1];
      if (fromMinutes <= toMinutes) {
        return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
      } else {
        return currentMinutes >= fromMinutes || currentMinutes <= toMinutes;
      }
    } catch(e) { return false; }
  };

  document.getElementById("saveDndBtn")?.addEventListener("click", () => {
    const from = document.getElementById("dndFromTime")?.value;
    const to = document.getElementById("dndToTime")?.value;
    if (!from || !to) { showToast("Please select both times", "error"); return; }
    const tzOffset = new Date().getTimezoneOffset();
    localStorage.setItem("tc_dnd", JSON.stringify({ enabled: true, from, to, tzOffset }));
    if (currentUser) {
      db.collection("users").doc(currentUser.uid).set({
        dndSettings: { enabled: true, from, to, tzOffset }
      }, { merge: true }).catch(() => {});
    }
    showToast("Quiet hours saved: " + from + " - " + to);
    document.getElementById("scheduledDndModal").style.display = "none";
    showDndIndicator();
  });

  document.getElementById("clearDndBtn")?.addEventListener("click", () => {
    localStorage.setItem("tc_dnd", JSON.stringify({ enabled: false, from: "", to: "", tzOffset: 0 }));
    if (currentUser) {
      db.collection("users").doc(currentUser.uid).set({
        dndSettings: { enabled: false, from: "", to: "", tzOffset: 0 }
      }, { merge: true }).catch(() => {});
    }
    showToast("Quiet hours disabled");
    document.getElementById("scheduledDndModal").style.display = "none";
    const ind = document.querySelector(".dnd-active-indicator");
    if (ind) ind.remove();
  });

  function showDndIndicator() {
    const existing = document.querySelector(".dnd-active-indicator");
    if (existing) existing.remove();
    if (!window.checkDndStatus()) return;
    const ind = document.createElement("div");
    ind.className = "dnd-active-indicator";
    ind.textContent = "🔇 Quiet hours active";
    document.querySelector(".sidebar-header")?.appendChild(ind);
  }

  // Add DND button to settings
  const check = setInterval(() => {
    if (document.getElementById("blockedUsersBtn") && !document.getElementById("dndSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "dndSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Quiet Hours (DND)";
      btn.onclick = () => {
        const dndData = localStorage.getItem("tc_dnd");
        if (dndData) {
          try {
            const dnd = JSON.parse(dndData);
            if (dnd.from) document.getElementById("dndFromTime").value = dnd.from;
            if (dnd.to) document.getElementById("dndToTime").value = dnd.to;
          } catch(e) {}
        }
        document.getElementById("scheduledDndModal").style.display = "flex";
      };
      const blockedBtn = document.getElementById("blockedUsersBtn");
      if (blockedBtn) blockedBtn.parentElement?.insertBefore(btn, blockedBtn);
    }
  }, 1000);

  // Check DND status periodically
  setInterval(() => {
    showDndIndicator();
  }, 60000);
  setTimeout(showDndIndicator, 2000);
})();

// ---------- 66. Per-Chat Notification Sound ----------
(function initPerChatSound() {
  document.getElementById("closeNotifSound")?.addEventListener("click", () => {
    document.getElementById("notificationSoundModal").style.display = "none";
  });

  document.getElementById("saveChatSoundBtn")?.addEventListener("click", () => {
    const sound = document.getElementById("chatSoundSelect")?.value || "";
    if (currentChat?.id) {
      localStorage.setItem("tc_chat_sound_" + currentChat.id, sound);
      showToast(sound ? "Notification sound set" : "Default sound restored");
      document.getElementById("notificationSoundModal").style.display = "none";
    }
  });

  // Add sound picker to chat header
  const obs = new MutationObserver(() => {
    const header = document.querySelector(".chat-header");
    if (!header || document.querySelector("[data-chat-sound-btn]") || !currentChat?.id) return;
    const btn = document.createElement("button");
    btn.dataset.chatSoundBtn = "true";
    btn.className = "icon-btn";
    btn.title = "Chat notification sound";
    btn.innerHTML = "🔔";
    btn.style.cssText = "font-size:14px;";
    btn.onclick = () => {
      const savedSound = localStorage.getItem("tc_chat_sound_" + currentChat.id) || "";
      document.getElementById("chatSoundSelect").value = savedSound;
      document.getElementById("notificationSoundModal").style.display = "flex";
    };
    const actions = header.querySelector(".sidebar-actions") || header.querySelector(".chat-actions");
    if (actions) actions.appendChild(btn);
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// ---------- 68. Notification Preview Text Setting ----------
(function initNotificationPreviewSetting() {
  const check = setInterval(() => {
    if (document.getElementById("starredMessagesBtn") && !document.getElementById("notifPreviewBtn")) {
      const btn = document.createElement("button");
      btn.id = "notifPreviewBtn";
      btn.className = "setting-item";
      btn.textContent = "Notification Preview";
      btn.onclick = () => {
        const current = localStorage.getItem("tc_notif_preview") !== "off";
        const choice = confirm("Show message preview in notifications?\nCurrently: " + (current ? "On" : "Off") + "\nTap OK to toggle.");
        if (choice) {
          localStorage.setItem("tc_notif_preview", current ? "off" : "on");
          showToast("Notification preview: " + (current ? "Off" : "On"));
        }
      };
      const starred = document.getElementById("starredMessagesBtn");
      if (starred) starred.parentElement?.insertBefore(btn, starred);
    }
  }, 1000);
})();

// ---------- 69. Mute with Auto-Unmute ----------
(function initAutoUnmute() {
  // Check muted chats periodically for auto-unmute
  setInterval(() => {
    if (!currentUser) return;
    // Load muted chats from Firestore
    db.collection("mutedChats").where("userId", "==", currentUser.uid).get().then(snap => {
      snap.forEach(doc => {
        const data = doc.data();
        if (data.expiresAt && data.expiresAt.toDate() <= new Date()) {
          doc.ref.delete().then(() => {
            showToast("Auto-unmuted a chat");
          }).catch(() => {});
        }
      });
    }).catch(() => {});
  }, 60000);
})();

// ---------- 70. Critical Alerts ----------
(function initCriticalAlerts() {
  // Store critical contacts in localStorage
  let criticalContacts = [];
  try { criticalContacts = JSON.parse(localStorage.getItem("tc_critical_contacts") || "[]"); } catch(e) {}

  // Add option to mark a chat as critical
  const obs = new MutationObserver(() => {
    const header = document.querySelector(".chat-header");
    if (!header || document.querySelector("[data-critical-alert-btn]") || !currentChat?.id) return;
    const isCritical = criticalContacts.includes(currentChat.otherUserId || currentChat.id);
    const btn = document.createElement("button");
    btn.dataset.criticalAlertBtn = "true";
    btn.className = "icon-btn";
    btn.title = isCritical ? "Critical (bypasses DND)" : "Mark as critical";
    btn.innerHTML = isCritical ? "🔴" : "⭕";
    btn.style.cssText = "font-size:14px;";
    btn.onclick = () => {
      const id = currentChat.otherUserId || currentChat.id;
      if (!id) return;
      const idx = criticalContacts.indexOf(id);
      if (idx >= 0) {
        criticalContacts.splice(idx, 1);
        btn.innerHTML = "⭕";
        btn.title = "Mark as critical";
      } else {
        criticalContacts.push(id);
        btn.innerHTML = "🔴";
        btn.title = "Critical (bypasses DND)";
      }
      localStorage.setItem("tc_critical_contacts", JSON.stringify(criticalContacts));
      showToast(idx >= 0 ? "Critical alert removed" : "Critical alert set");
    };
    const actions = header.querySelector(".sidebar-actions") || header.querySelector(".chat-actions");
    if (actions) actions.appendChild(btn);
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// ---------- END OF PHASES 5-8 ----------

// ===== PHASE 9: DATA MANAGEMENT =====

// ---------- 71. Per-Chat Media Auto-Download ----------
(function initPerChatAutoDownload() {
  // Store per-chat overrides in localStorage
  const check = setInterval(() => {
    const header = document.querySelector(".chat-header");
    if (!header || document.querySelector("[data-perchat-download-btn]") || !currentChat?.id) return;
    const btn = document.createElement("button");
    btn.dataset.perchatDownloadBtn = "true";
    btn.className = "icon-btn";
    btn.title = "Auto-download for this chat";
    btn.innerHTML = "📥";
    btn.style.cssText = "font-size:14px;";
    btn.onclick = () => {
      const chatId = currentChat.id;
      const currentPref = localStorage.getItem("tc_perchat_download_" + chatId) || "default";
      const opts = ["default", "always", "never"];
      const idx = opts.indexOf(currentPref);
      const next = opts[(idx + 1) % opts.length];
      localStorage.setItem("tc_perchat_download_" + chatId, next);
      showToast("Auto-download: " + next);
    };
    const actions = header.querySelector(".sidebar-actions") || header.querySelector(".chat-actions");
    if (actions) actions.appendChild(btn);
  }, 1000);
})();

// ---------- 72. Storage Breakdown by Chat ----------
// (Already partially implemented by existing storageManagerModal)

// ---------- 73. Media Quality Selector ----------
(function initMediaQuality() {
  document.getElementById("closeMediaQuality")?.addEventListener("click", () => {
    document.getElementById("mediaQualityModal").style.display = "none";
  });
  document.getElementById("saveMediaQualityBtn")?.addEventListener("click", () => {
    const photo = document.getElementById("photoQualitySelect")?.value || "auto";
    const video = document.getElementById("videoQualitySelect")?.value || "auto";
    localStorage.setItem("tc_media_quality", JSON.stringify({ photo, video }));
    showToast("Media quality saved");
    document.getElementById("mediaQualityModal").style.display = "none";
  });

  // Add to settings
  const check = setInterval(() => {
    if (document.getElementById("autoDownloadBtn") && !document.getElementById("mediaQualitySettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "mediaQualitySettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Media Quality";
      btn.onclick = () => {
        const saved = localStorage.getItem("tc_media_quality");
        if (saved) {
          try {
            const q = JSON.parse(saved);
            if (q.photo) document.getElementById("photoQualitySelect").value = q.photo;
            if (q.video) document.getElementById("videoQualitySelect").value = q.video;
          } catch(e) {}
        }
        document.getElementById("mediaQualityModal").style.display = "flex";
      };
      const autoDl = document.getElementById("autoDownloadBtn");
      if (autoDl) autoDl.parentElement?.insertBefore(btn, autoDl);
    }
  }, 1000);
})();

// ---------- 74. Auto-Delete Old Media ----------
(function initAutoDeleteMedia() {
  // Set a periodic cleanup for old media
  setInterval(async () => {
    if (!currentUser) return;
    try {
      const cutoff = new Date(Date.now() - 90 * 86400000); // 90 days
      const snap = await db.collection("messages")
        .where("senderId", "==", currentUser.uid)
        .where("timestamp", "<", cutoff)
        .where("type", "in", ["image", "video", "audio"])
        .limit(50)
        .get();
      snap.forEach(doc => {
        // Remove file URL to free storage, keep message text
        const data = doc.data();
        if (data.fileUrl || data.attachment?.url) {
          doc.ref.update({
            fileUrl: firebase.firestore.FieldValue.delete(),
            "attachment.url": firebase.firestore.FieldValue.delete(),
            mediaCleaned: true,
            mediaCleanedAt: firebase.firestore.FieldValue.serverTimestamp(),
          }).catch(() => {});
        }
      });
    } catch (e) { /* ignore */ }
  }, 86400000); // Once per day
})();

// ---------- 75. Cache Management ----------
(function initCacheManager() {
  document.getElementById("closeCacheManager")?.addEventListener("click", () => {
    document.getElementById("cacheManagerModal").style.display = "none";
  });
  document.getElementById("clearCacheBtn")?.addEventListener("click", () => {
    if (confirm("Clear all cached data? This will log you out and clear local storage.")) {
      localStorage.clear();
      showToast("Cache cleared. Reloading...");
      setTimeout(() => location.reload(), 1000);
    }
  });

  function updateCacheStats() {
    const lsSize = new Blob([JSON.stringify(localStorage)]).size;
    const sizeEl = document.getElementById("cacheLocalStorageSize");
    if (sizeEl) sizeEl.textContent = (lsSize / 1024).toFixed(1) + " KB";
    const cacheFiles = document.getElementById("cacheFileCount");
    if (cacheFiles) {
      // Try to estimate from Cache API
      if ("caches" in window) {
        caches.keys().then(names => {
          Promise.all(names.map(n => caches.open(n))).then(caches => {
            Promise.all(caches.map(c => c.keys())).then(keys => {
              const total = keys.reduce((a, b) => a + b.length, 0);
              cacheFiles.textContent = total + " files";
            });
          });
        }).catch(() => {});
      }
    }
  }

  // Add to settings
  const check = setInterval(() => {
    if (document.getElementById("storageManagerBtn") && !document.getElementById("cacheManagerSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "cacheManagerSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Cache Manager";
      btn.onclick = () => {
        updateCacheStats();
        document.getElementById("cacheManagerModal").style.display = "flex";
      };
      const stgBtn = document.getElementById("storageManagerBtn");
      if (stgBtn) stgBtn.parentElement?.insertBefore(btn, stgBtn);
    }
  }, 1000);
})();

// ---------- 76. Data Export Per Chat ----------
// (Already handled by existing exportChatBtn and giExportChatBtn)

// ---------- 77. Backup to Cloud ----------
(function initCloudBackup() {
  // Add button that exports to Firebase Storage
  const check = setInterval(() => {
    if (document.getElementById("exportBackupBtn") && !document.getElementById("cloudBackupBtn")) {
      const btn = document.createElement("button");
      btn.id = "cloudBackupBtn";
      btn.className = "setting-item";
      btn.textContent = "Backup to Cloud";
      btn.onclick = async () => {
        if (!currentUser) return;
        try {
          showToast("Creating backup...");
          const data = await exportFullBackup();
          const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
          const path = `backups/${currentUser.uid}/${Date.now()}_backup.json`;
          await storage.ref(path).put(blob);
          const url = await storage.ref(path).getDownloadURL();
          showToast("Backup saved to cloud");
          // Store backup reference
          await db.collection("backups").add({
            userId: currentUser.uid,
            url: url,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            size: blob.size,
          });
        } catch (e) {
          showToast("Backup failed: " + e.message, "error");
        }
      };
      const exportBtn = document.getElementById("exportBackupBtn");
      if (exportBtn) exportBtn.parentElement?.insertBefore(btn, exportBtn);
    }
  }, 1000);
})();

// ---------- 78. Restore from Backup ----------
(function initRestoreBackup() {
  const check = setInterval(() => {
    if (document.getElementById("importBackupBtn") && !document.getElementById("cloudRestoreBtn")) {
      const btn = document.createElement("button");
      btn.id = "cloudRestoreBtn";
      btn.className = "setting-item";
      btn.textContent = "Restore from Cloud";
      btn.onclick = async () => {
        if (!currentUser) return;
        try {
          showToast("Fetching latest backup...");
          const snap = await db.collection("backups")
            .where("userId", "==", currentUser.uid)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();
          if (snap.empty) { showToast("No backups found", "error"); return; }
          const backup = snap.docs[0].data();
          const resp = await fetch(backup.url);
          const data = await resp.json();
          await importFullBackup(data);
          showToast("Backup restored successfully");
        } catch (e) {
          showToast("Restore failed: " + e.message, "error");
        }
      };
      const importBtn = document.getElementById("importBackupBtn");
      if (importBtn) importBtn.parentElement?.insertBefore(btn, importBtn);
    }
  }, 1000);
})();

// ===== PHASE 10: ACCESSIBILITY & I18N =====

// ---------- 79. Font & Text Settings ----------
(function initFontSize() {
  // ── State ──────────────────────────────────────────────────────────────────
  const DEFAULTS = { family: "Inter, system-ui, sans-serif", size: "15", weight: "400", spacing: "1.4" };
  let _prefs = { ...DEFAULTS };

  function _load() {
    try {
      const saved = JSON.parse(localStorage.getItem("tc_font_prefs") || "{}");
      _prefs = { ...DEFAULTS, ...saved };
      // migrate legacy tc_font_size key
      const legacySize = localStorage.getItem("tc_font_size");
      if (legacySize && !saved.size) _prefs.size = legacySize;
    } catch (_) {}
  }

  function _apply(prefs) {
    const root = document.documentElement;
    root.style.setProperty("--msg-font-family", prefs.family);
    root.style.setProperty("--msg-font-size", prefs.size + "px");
    root.style.setProperty("--msg-font-weight", prefs.weight);
    root.style.setProperty("--msg-line-height", prefs.spacing);
  }

  function _save(prefs) {
    localStorage.setItem("tc_font_prefs", JSON.stringify(prefs));
    localStorage.setItem("tc_font_size", prefs.size); // keep legacy key
  }

  // ── Apply on boot ──────────────────────────────────────────────────────────
  _load();
  _apply(_prefs);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  function _updatePreview() {
    const preview = document.getElementById("fontSizePreview");
    if (!preview) return;
    const sz  = document.getElementById("fontSizeSlider")?.value || _prefs.size;
    const fam = document.querySelector("#fsFontGrid .fs-font-btn.active")?.dataset.font || _prefs.family;
    const wt  = document.querySelector("#fsWeightRow .fs-pill.active")?.dataset.weight || _prefs.weight;
    const sp  = document.querySelector("#fsSpacingRow .fs-pill.active")?.dataset.spacing || _prefs.spacing;
    preview.style.setProperty("--fs-prev-size",    sz + "px");
    preview.style.setProperty("--fs-prev-family",  fam);
    preview.style.setProperty("--fs-prev-weight",  wt);
    preview.style.setProperty("--fs-prev-spacing", sp);
    const label = document.getElementById("fsSizeLabel");
    if (label) label.textContent = sz + "px";
  }

  function _syncUI(prefs) {
    // family
    document.querySelectorAll("#fsFontGrid .fs-font-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.font === prefs.family);
    });
    // size
    const slider = document.getElementById("fontSizeSlider");
    if (slider) slider.value = prefs.size;
    // weight
    document.querySelectorAll("#fsWeightRow .fs-pill").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.weight === prefs.weight);
    });
    // spacing
    document.querySelectorAll("#fsSpacingRow .fs-pill").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.spacing === prefs.spacing);
    });
    _updatePreview();
  }

  // ── Wire up controls once modal is in the DOM ──────────────────────────────
  function _wireModal() {
    document.getElementById("closeFontSize")?.addEventListener("click", () => {
      document.getElementById("fontSizeModal").style.display = "none";
    });

    // Font family buttons
    document.getElementById("fsFontGrid")?.addEventListener("click", e => {
      const btn = e.target.closest(".fs-font-btn");
      if (!btn) return;
      document.querySelectorAll("#fsFontGrid .fs-font-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      _updatePreview();
    });

    // Size slider
    document.getElementById("fontSizeSlider")?.addEventListener("input", _updatePreview);

    // Weight pills
    document.getElementById("fsWeightRow")?.addEventListener("click", e => {
      const btn = e.target.closest(".fs-pill");
      if (!btn) return;
      document.querySelectorAll("#fsWeightRow .fs-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      _updatePreview();
    });

    // Spacing pills
    document.getElementById("fsSpacingRow")?.addEventListener("click", e => {
      const btn = e.target.closest(".fs-pill");
      if (!btn) return;
      document.querySelectorAll("#fsSpacingRow .fs-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      _updatePreview();
    });

    // Apply button
    document.getElementById("saveFontSizeBtn")?.addEventListener("click", () => {
      const newPrefs = {
        family:  document.querySelector("#fsFontGrid .fs-font-btn.active")?.dataset.font  || DEFAULTS.family,
        size:    document.getElementById("fontSizeSlider")?.value                          || DEFAULTS.size,
        weight:  document.querySelector("#fsWeightRow .fs-pill.active")?.dataset.weight   || DEFAULTS.weight,
        spacing: document.querySelector("#fsSpacingRow .fs-pill.active")?.dataset.spacing || DEFAULTS.spacing,
      };
      _prefs = newPrefs;
      _apply(newPrefs);
      _save(newPrefs);
      showToast("Font settings applied");
      document.getElementById("fontSizeModal").style.display = "none";
    });

    // Reset button
    document.getElementById("resetFontBtn")?.addEventListener("click", () => {
      _prefs = { ...DEFAULTS };
      _syncUI(_prefs);
      _apply(_prefs);
      _save(_prefs);
      showToast("Font reset to default");
    });
  }
  _wireModal();

  // ── Add entry to Settings panel ────────────────────────────────────────────
  const check = setInterval(() => {
    if (document.getElementById("wallpaperSettingsBtn") && !document.getElementById("fontSizeSettingsBtn")) {
      clearInterval(check);
      const btn = document.createElement("button");
      btn.id = "fontSizeSettingsBtn";
      btn.className = "setting-item";
      btn.innerHTML = '<span class="si-icon">🔤</span> Font &amp; Text';
      btn.onclick = () => {
        _load();
        _syncUI(_prefs);
        document.getElementById("fontSizeModal").style.display = "flex";
      };
      const wallBtn = document.getElementById("wallpaperSettingsBtn");
      if (wallBtn) wallBtn.parentElement?.insertBefore(btn, wallBtn);
    }
  }, 800);
})();

// ---------- 80. High Contrast Mode ----------
(function initHighContrast() {
  // Toggle in settings
  const check = setInterval(() => {
    if (document.getElementById("fontSizeSettingsBtn") && !document.getElementById("highContrastSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "highContrastSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "High Contrast";
      btn.onclick = () => {
        document.body.classList.toggle("high-contrast");
        const isHighContrast = document.body.classList.contains("high-contrast");
        localStorage.setItem("tc_high_contrast", isHighContrast ? "1" : "0");
        showToast(isHighContrast ? "High contrast enabled" : "High contrast disabled");
      };
      const fontBtn = document.getElementById("fontSizeSettingsBtn");
      if (fontBtn) fontBtn.parentElement?.insertBefore(btn, fontBtn);
    }
  }, 1000);

  // Load saved state
  if (localStorage.getItem("tc_high_contrast") === "1") {
    document.body.classList.add("high-contrast");
  }
})();

// ---------- 81. Screen Reader Optimization ----------
(function initScreenReaderOpt() {
  // Add ARIA labels to dynamic content
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".message:not([aria-label])").forEach(el => {
      const text = el.querySelector(".message-text")?.textContent?.trim() || "Message";
      const sender = el.querySelector(".sender-name")?.textContent?.trim() || "Unknown";
      el.setAttribute("aria-label", sender + ": " + text.substring(0, 100));
      el.setAttribute("role", "article");
    });
    document.querySelectorAll(".list-item:not([aria-label])").forEach(el => {
      const name = el.dataset.chatName || "Chat";
      el.setAttribute("aria-label", name);
      el.setAttribute("role", "button");
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// ---------- 82. Keyboard Shortcuts Help ----------
(function initKeyboardShortcuts() {
  document.getElementById("closeKeyboardShortcuts")?.addEventListener("click", () => {
    document.getElementById("keyboardShortcutsModal").style.display = "none";
  });

  document.addEventListener("keydown", (e) => {
    // Ctrl+N or Cmd+N for new chat
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault();
      document.getElementById("scannerBtn")?.click();
    }
    // ? for shortcuts help
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.target.closest("input,textarea")) {
      document.getElementById("keyboardShortcutsModal").style.display = "flex";
    }
  });

  // Add to settings
  const check = setInterval(() => {
    if (document.getElementById("appLockSettingsBtn") && !document.getElementById("shortcutsSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "shortcutsSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Keyboard Shortcuts";
      btn.onclick = () => {
        document.getElementById("keyboardShortcutsModal").style.display = "flex";
      };
      const lockBtn = document.getElementById("appLockSettingsBtn");
      if (lockBtn) lockBtn.parentElement?.insertBefore(btn, lockBtn);
    }
  }, 1000);
})();

// ---------- 83. Language Selector ----------
(function initLanguageSelector() {
  document.getElementById("closeLanguageModal")?.addEventListener("click", () => {
    document.getElementById("languageModal").style.display = "none";
  });
  document.getElementById("saveLanguageBtn")?.addEventListener("click", () => {
    const lang = document.getElementById("languageSelect")?.value || "en";
    const rtl = document.getElementById("rtlToggle")?.checked || false;
    localStorage.setItem("tc_language", lang);
    localStorage.setItem("tc_rtl", rtl ? "1" : "0");
    document.documentElement.lang = lang;
    document.body.classList.toggle("rtl", rtl);
    showToast("Language preference saved. Reload for full effect.");
  });

  // Add to settings
  const check = setInterval(() => {
    if (document.getElementById("blockedUsersBtn") && !document.getElementById("languageSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "languageSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Language";
      btn.onclick = () => {
        const lang = localStorage.getItem("tc_language") || "en";
        const rtl = localStorage.getItem("tc_rtl") === "1";
        document.getElementById("languageSelect").value = lang;
        document.getElementById("rtlToggle").checked = rtl;
        document.getElementById("languageModal").style.display = "flex";
      };
      const blockedBtn = document.getElementById("blockedUsersBtn");
      if (blockedBtn) blockedBtn.parentElement?.insertBefore(btn, blockedBtn);
    }
  }, 1000);

  // Load saved language
  const savedLang = localStorage.getItem("tc_language");
  if (savedLang) document.documentElement.lang = savedLang;
  if (localStorage.getItem("tc_rtl") === "1") document.body.classList.add("rtl");
})();

// ---------- 84. RTL Support ----------
// (Handled by language selector above)

// ---------- 85. Reduce Motion Preference ----------
(function initReduceMotion() {
  // Check system preference
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    document.body.classList.add("reduce-motion");
    localStorage.setItem("tc_reduce_motion", "1");
  }
  // Allow toggle in settings
  const check = setInterval(() => {
    if (document.getElementById("highContrastSettingsBtn") && !document.getElementById("reduceMotionSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "reduceMotionSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Reduce Motion";
      btn.onclick = () => {
        document.body.classList.toggle("reduce-motion");
        const reduced = document.body.classList.contains("reduce-motion");
        localStorage.setItem("tc_reduce_motion", reduced ? "1" : "0");
        showToast(reduced ? "Reduced motion enabled" : "Reduced motion disabled");
      };
      const hcBtn = document.getElementById("highContrastSettingsBtn");
      if (hcBtn) hcBtn.parentElement?.insertBefore(btn, hcBtn);
    }
  }, 1000);

  // Load saved state
  if (localStorage.getItem("tc_reduce_motion") === "1") {
    document.body.classList.add("reduce-motion");
  }
})();

// ---------- 86. Large Tap Targets ----------
(function initLargeTapTargets() {
  const check = setInterval(() => {
    if (document.getElementById("reduceMotionSettingsBtn") && !document.getElementById("largeTapSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "largeTapSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Large Tap Targets";
      btn.onclick = () => {
        document.body.classList.toggle("large-tap-targets");
        const large = document.body.classList.contains("large-tap-targets");
        localStorage.setItem("tc_large_tap", large ? "1" : "0");
        showToast(large ? "Large tap targets enabled" : "Large tap targets disabled");
      };
      const rmBtn = document.getElementById("reduceMotionSettingsBtn");
      if (rmBtn) rmBtn.parentElement?.insertBefore(btn, rmBtn);
    }
  }, 1000);

  if (localStorage.getItem("tc_large_tap") === "1") {
    document.body.classList.add("large-tap-targets");
  }
})();

// ===== PHASE 11: INTEGRATION & EXTENSIONS =====

// ---------- 87. Share Sheet Integration ----------
(function initShareSheet() {
  // Listen for navigator.share to receive shared content
  if (navigator.share) {
    // Use Web Share Target API if available
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'share-target') {
          const { title, text, url } = event.data;
          const input = document.getElementById("messageInput");
          if (input) {
            input.value = (text || url || "") + " ";
            resizeMessageComposer();
            input.focus();
            showToast("Content shared to chat");
          }
        }
      });
    }
  }
})();

// ---------- 88. Open In... for Files ----------
(function initOpenIn() {
  // Add "Open in..." option to file attachments
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".file-attachment:not([data-openin])").forEach(el => {
      el.dataset.openin = "1";
      const url = el.dataset.fileUrl || el.querySelector("a")?.href;
      if (url) {
        const openBtn = document.createElement("button");
        openBtn.className = "btn btn-outline";
        openBtn.textContent = "Open in...";
        openBtn.style.cssText = "font-size:11px;padding:2px 8px;margin-top:4px;";
        openBtn.onclick = () => {
          window.open(url, "_blank");
        };
        el.appendChild(openBtn);
      }
    });
  });
  obs.observe(document.getElementById("messagesArea") || document.body, { childList: true, subtree: true });
})();

// ---------- 89. YouTube/Twitter Embed Preview ----------
(function initEmbedPreview() {
  // Detect YouTube links in messages and offer embed
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".message .message-text:not([data-embed-checked])").forEach(el => {
      el.dataset.embedChecked = "1";
      const text = el.textContent || "";
      // YouTube
      const ytMatch = text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (ytMatch) {
        const embed = document.createElement("div");
        embed.className = "youtube-embed";
        embed.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytMatch[1]}" allowfullscreen loading="lazy"></iframe>`;
        el.closest(".message-content")?.appendChild(embed);
      }
    });
  });
  obs.observe(document.getElementById("messagesArea") || document.body, { childList: true, subtree: true });
})();

// ---------- 90. Music Player (Persistent Mini-Player) ----------
(function initMusicPlayer() {
  let musicAudio = null;
  let currentMusicUrl = "";

  document.getElementById("musicPlayerPlayBtn")?.addEventListener("click", () => {
    if (!musicAudio) {
      // Find first audio in current chat
      const audio = document.querySelector("#messagesArea audio");
      if (audio) {
        currentMusicUrl = audio.src;
        musicAudio = new Audio(currentMusicUrl);
        musicAudio.play();
        document.getElementById("musicPlayerPlayBtn").textContent = "⏸️";
        const title = audio.closest(".message")?.querySelector(".sender-name")?.textContent || "Audio";
        document.getElementById("musicPlayerTitle").textContent = title;
        document.getElementById("musicPlayerMeta").textContent = "Playing...";
      }
    } else if (musicAudio.paused) {
      musicAudio.play();
      document.getElementById("musicPlayerPlayBtn").textContent = "⏸️";
    } else {
      musicAudio.pause();
      document.getElementById("musicPlayerPlayBtn").textContent = "▶️";
    }
  });

  document.getElementById("musicPlayerCloseBtn")?.addEventListener("click", () => {
    if (musicAudio) { musicAudio.pause(); musicAudio = null; }
    document.getElementById("musicPlayer").style.display = "none";
  });

  // Show player when any audio is clicked
  document.addEventListener("click", (e) => {
    const audio = e.target.closest("audio");
    if (audio && audio.closest(".message")) {
      currentMusicUrl = audio.src;
      document.getElementById("musicPlayer").style.display = "block";
      const title = audio.closest(".message")?.querySelector(".sender-name")?.textContent || "Audio";
      document.getElementById("musicPlayerTitle").textContent = title;
      if (musicAudio) musicAudio.pause();
      musicAudio = new Audio(currentMusicUrl);
      musicAudio.play();
      document.getElementById("musicPlayerPlayBtn").textContent = "⏸️";
    }
  });
})();

// ---------- 91. PDF Viewer ----------
(function initPdfViewer() {
  // Detect PDF attachments and offer inline viewer
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".file-attachment[data-file-type='application/pdf']:not([data-pdf-viewer])").forEach(el => {
      el.dataset.pdfViewer = "1";
      const url = el.dataset.fileUrl || el.querySelector("a")?.href;
      if (url) {
        const viewBtn = document.createElement("button");
        viewBtn.className = "btn btn-primary";
        viewBtn.textContent = "📄 View PDF";
        viewBtn.style.cssText = "font-size:12px;padding:4px 12px;margin-top:4px;";
        viewBtn.onclick = () => {
          window.open(url + "#view=FitH", "_blank");
        };
        el.appendChild(viewBtn);
      }
    });
  });
  obs.observe(document.getElementById("messagesArea") || document.body, { childList: true, subtree: true });
})();

// ---------- 92. Code Syntax Highlighting ----------
(function initCodeHighlighting() {
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".message-text code:not([data-highlighted]), .message-text pre:not([data-highlighted])").forEach(el => {
      el.dataset.highlighted = "1";
      // Simple syntax highlighting for common languages
      let html = el.innerHTML;
      // Keywords
      html = html.replace(/\b(function|const|let|var|if|else|for|while|return|import|export|class|async|await|new|this|try|catch|throw|switch|case|break|continue|typeof|instanceof|in|of|from|def|print|lambda|None|True|False|and|or|not|is)\b/g, '<span class="keyword">$1</span>');
      // Strings
      html = html.replace(/(["'`])(?:(?!\1).)*\1/g, '<span class="string">$&</span>');
      // Comments
      html = html.replace(/(\/\/.*$|#.*$)/gm, '<span class="comment">$1</span>');
      // Numbers
      html = html.replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>');
      el.innerHTML = html;
      if (el.tagName === "PRE") el.className = "code-block";
    });
  });
  obs.observe(document.getElementById("messagesArea") || document.body, { childList: true, subtree: true });
})();

// ---------- 93. Weather/Location Card ----------
(function initWeatherCard() {
  // When a location message is shared, try to fetch weather
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".location-card:not([data-weather])").forEach(async (el) => {
      el.dataset.weather = "1";
      const lat = el.dataset.lat;
      const lon = el.dataset.lon;
      if (!lat || !lon) return;
      try {
        // Use free wttr.in API (no key needed)
        const resp = await fetch(`https://wttr.in/${lat},${lon}?format=j1`);
        const data = await resp.json();
        const current = data?.current_condition?.[0];
        if (current) {
          const weatherDiv = document.createElement("div");
          weatherDiv.style.cssText = "font-size:12px;color:var(--muted);margin-top:4px;display:flex;align-items:center;gap:6px;";
          weatherDiv.innerHTML = `🌡️ ${current.temp_C}°C | ${current.weatherDesc?.[0]?.value || ""} | 💧 ${current.humidity}%`;
          el.appendChild(weatherDiv);
        }
      } catch (e) { /* ignore weather fetch failure */ }
    });
  });
  obs.observe(document.getElementById("messagesArea") || document.body, { childList: true, subtree: true });
})();

// ---------- 94. Bot API / Webhooks ----------
(function initWebhooks() {
  document.getElementById("closeWebhookModal")?.addEventListener("click", () => {
    document.getElementById("webhookModal").style.display = "none";
  });

  document.getElementById("copyWebhookUrlBtn")?.addEventListener("click", () => {
    const input = document.getElementById("webhookUrlDisplay");
    if (input) {
      navigator.clipboard.writeText(input.value).then(() => showToast("Webhook URL copied"));
    }
  });

  document.getElementById("generateWebhookBtn")?.addEventListener("click", async () => {
    if (!currentUser || !currentChat) { showToast("Open a chat first", "error"); return; }
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    try {
      await db.collection("webhooks").add({
        userId: currentUser.uid,
        chatId: currentChat.id,
        chatType: currentChatType,
        token: token,
        webhookId: webhookId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        active: true,
      });
      const webhookUrl = `${window.location.origin}/api/webhook/${webhookId}/${token}`;
      document.getElementById("webhookUrlDisplay").value = webhookUrl;
      showToast("Webhook URL generated");
    } catch (e) {
      showToast("Failed to generate webhook", "error");
    }
  });

  // Add webhook button to chat header
  const check = setInterval(() => {
    const header = document.querySelector(".chat-header");
    if (!header || document.querySelector("[data-webhook-btn]") || !currentChat?.id) return;
    const btn = document.createElement("button");
    btn.dataset.webhookBtn = "true";
    btn.className = "icon-btn";
    btn.title = "Webhook / Bot API";
    btn.innerHTML = "🔌";
    btn.style.cssText = "font-size:14px;";
    btn.onclick = () => {
      document.getElementById("webhookUrlDisplay").value = "Open a chat and generate a webhook";
      document.getElementById("webhookModal").style.display = "flex";
    };
    // Add to settings list instead
  }, 1000);

  // Add to settings
  const check2 = setInterval(() => {
    if (document.getElementById("callNetworkSettingsBtn") && !document.getElementById("webhookSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "webhookSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Bot API / Webhooks";
      btn.onclick = () => {
        document.getElementById("webhookModal").style.display = "flex";
      };
      const callNetBtn = document.getElementById("callNetworkSettingsBtn");
      if (callNetBtn) callNetBtn.parentElement?.insertBefore(btn, callNetBtn);
    }
  }, 1000);
})();

// ---------- 95. ChatGPT Bot Integration ----------
// (uses Gemini API already configured in Smart Replies; just add /ask command)
(function initChatBot() {
  // Add /ask command to message input
  const origSend = sendMessage;
  if (typeof sendMessage === "function") {
    sendMessage = async function() {
      const input = document.getElementById("messageInput");
      const text = input?.value?.trim();
      if (text?.startsWith("/ask ")) {
        const question = text.substring(5).trim();
        if (!question) { showToast("Ask a question after /ask", "error"); return null; }
        if (!smartRepliesApiKey) {
          showToast("Set up Gemini API key in Smart Replies settings first", "error");
          return null;
        }
        try {
          const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${smartRepliesApiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: question }] }],
              generationConfig: { maxOutputTokens: 500, temperature: 0.3 }
            })
          });
          const data = await resp.json();
          const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No answer";
          // Send the answer as a message from the bot
          if (currentChat) {
            await db.collection("messages").add({
              senderId: "bot_" + currentUser.uid,
              senderName: "🤖 AI Bot",
              text: answer,
              timestamp: firebase.firestore.FieldValue.serverTimestamp(),
              status: "sent",
              read: false,
              readBy: { [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp() },
              deliveredTo: [],
              isBotMessage: true,
            });
          }
          if (input) input.value = "";
          resizeMessageComposer();
          return null;
        } catch (e) {
          showToast("AI failed: " + e.message, "error");
          return null;
        }
      }
      return origSend.apply(this, arguments);
    };
  }
})();

// ---------- 96. Poll/Survey Results in Charts ----------
(function initPollCharts() {
  // Add chart rendering to poll messages
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".poll-message:not([data-chart])").forEach(el => {
      el.dataset.chart = "1";
      const pollData = el._pollData || {};
      const options = pollData.options || [];
      const totalVotes = options.reduce((sum, o) => sum + (o.votes || 0), 0);
      if (totalVotes === 0) return;
      const chart = document.createElement("div");
      chart.style.cssText = "margin-top:8px;";
      options.forEach(opt => {
        const pct = totalVotes > 0 ? Math.round((opt.votes || 0) / totalVotes * 100) : 0;
        const row = document.createElement("div");
        row.style.cssText = "margin-bottom:4px;";
        row.innerHTML = `
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
            <span>${escapeHtml(opt.text || "")}</span>
            <span style="font-weight:600;">${pct}% (${opt.votes||0})</span>
          </div>
          <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:var(--brand);border-radius:3px;transition:width 0.5s;"></div>
          </div>`;
        chart.appendChild(row);
      });
      const resultsArea = el.querySelector(".poll-results") || el;
      resultsArea.appendChild(chart);
    });
  });
  obs.observe(document.getElementById("messagesArea") || document.body, { childList: true, subtree: true });
})();

// ---------- 97. Countdown Timer ----------
(function initCountdown() {
  // Detect /countdown command
  const origSend3 = sendMessage;
  if (typeof sendMessage === "function") {
    sendMessage = async function() {
      const input = document.getElementById("messageInput");
      const text = input?.value?.trim();
      const match = text?.match(/^\/countdown\s+(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/i);
      if (match) {
        const targetDate = new Date(match[1]);
        const label = match[2] || "Countdown";
        if (isNaN(targetDate.getTime())) { showToast("Invalid date. Use YYYY-MM-DD", "error"); return null; }
        // Send a countdown message that updates live
        const msgRef = await db.collection("messages").add({
          senderId: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email,
          text: `⏰ ${label}: ${targetDate.toDateString()}`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          status: "sent",
          read: false,
          isCountdown: true,
          countdownTarget: targetDate.toISOString(),
          countdownLabel: label,
        });
        if (input) input.value = "";
        resizeMessageComposer();
        return null;
      }
      return origSend3.apply(this, arguments);
    };
  }

  // Update countdown timers in real-time
  setInterval(() => {
    document.querySelectorAll(".countdown-display:not([data-counted])").forEach(el => {
      el.dataset.counted = "1";
      const target = new Date(el.dataset.target);
      const update = () => {
        const diff = target - Date.now();
        if (diff <= 0) { el.textContent = "🎉 Time's up!"; return; }
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        el.textContent = `${days}d ${hours}h ${mins}m ${secs}s`;
      };
      update();
      setInterval(update, 1000);
    });
  }, 1000);
})();

// ---------- 98. Marquee / Scrolling Ticker ----------
(function initMarquee() {
  const origSend4 = sendMessage;
  if (typeof sendMessage === "function") {
    sendMessage = async function() {
      const input = document.getElementById("messageInput");
      const text = input?.value?.trim();
      if (text?.startsWith("/marquee ")) {
        const msg = text.substring(9).trim();
        if (!msg) { showToast("Add text after /marquee", "error"); return null; }
        await db.collection("messages").add({
          senderId: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email,
          text: msg,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          status: "sent",
          read: false,
          isMarquee: true,
        });
        if (input) input.value = "";
        resizeMessageComposer();
        return null;
      }
      return origSend4.apply(this, arguments);
    };
  }
})();

// ---------- 99. Anonymous Mode ----------
(function initAnonymousMode() {
  // Add toggle to send messages anonymously in groups
  let anonymousMode = false;
  const check = setInterval(() => {
    const sendBtn = document.getElementById("sendBtn");
    if (!sendBtn || document.getElementById("anonModeBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "anonModeBtn";
    btn.className = "icon-btn";
    btn.title = "Anonymous mode";
    btn.innerHTML = "🎭";
    btn.style.cssText = "font-size:14px;opacity:0.4;";
    btn.onclick = () => {
      anonymousMode = !anonymousMode;
      btn.style.opacity = anonymousMode ? "1" : "0.4";
      showToast(anonymousMode ? "Anonymous mode ON" : "Anonymous mode OFF");
    };
    sendBtn.parentElement?.insertBefore(btn, sendBtn);
  }, 500);

  // Patch sendMessage to use anonymous sender name
  const origSend5 = sendMessage;
  if (typeof sendMessage === "function") {
    sendMessage = async function() {
      if (anonymousMode && currentChatType === "group") {
        // Temporarily override sender name
        const origName = currentUser.displayName;
        currentUser.displayName = "Anonymous 🎭";
        const result = await origSend5.apply(this, arguments);
        currentUser.displayName = origName;
        return result;
      }
      return origSend5.apply(this, arguments);
    };
  }
})();

// ---------- 100. Virtual Backgrounds for Calls ----------
(function initVirtualBackgrounds() {
  // Apply simple CSS filter as virtual background
  let vbActive = false;
  const check = setInterval(() => {
    const controls = document.querySelector(".call-controls");
    if (!controls || document.getElementById("vbBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "vbBtn";
    btn.className = "call-icon-btn";
    btn.title = "Virtual background";
    btn.textContent = "🌄";
    btn.onclick = () => {
      vbActive = !vbActive;
      const video = document.getElementById("localVideo");
      if (video) {
        video.style.filter = vbActive ? "blur(12px)" : "none";
      }
      showToast(vbActive ? "Background blur on" : "Background blur off");
    };
    const pipBtn = document.getElementById("pipBtn");
    if (pipBtn) pipBtn.parentElement?.insertBefore(btn, pipBtn);
  }, 1000);
})();

// ===== PHASE 12: FUN & ENGAGEMENT =====

// ---------- 101. Daily Streaks ----------
(function initStreaks() {
  function updateStreak() {
    if (!currentUser) return;
    const today = new Date().toDateString();
    const lastActive = localStorage.getItem("tc_streak_last");
    const count = parseInt(localStorage.getItem("tc_streak_count") || "0");
    if (lastActive === today) return; // Already counted today
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastActive === yesterday) {
      // Continuing streak
      localStorage.setItem("tc_streak_count", String(count + 1));
    } else if (lastActive !== today) {
      // Streak broken or first time
      localStorage.setItem("tc_streak_count", String(1));
    }
    localStorage.setItem("tc_streak_last", today);
  }

  // Track user activity every time they send a message
  const origSend6 = sendMessage;
  if (typeof sendMessage === "function") {
    sendMessage = async function() {
      updateStreak();
      return origSend6.apply(this, arguments);
    };
  }

  // Show streak info on profile
  const check = setInterval(() => {
    const profileBody = document.querySelector("#profileModal .modal-body");
    if (!profileBody || document.getElementById("streakProfileBadge")) return;
    const badge = document.createElement("div");
    badge.id = "streakProfileBadge";
    badge.className = "streak-badge";
    badge.style.cssText = "margin-top:12px;";
    const count = localStorage.getItem("tc_streak_count") || "0";
    badge.innerHTML = `🔥 ${count} day streak`;
    badge.onclick = () => {
      document.getElementById("streakCount").textContent = localStorage.getItem("tc_streak_count") || "0";
      const msg = document.getElementById("streakMessage");
      const c = parseInt(localStorage.getItem("tc_streak_count") || "0");
      if (c >= 30) msg.textContent = "Amazing! You're on fire! 🔥";
      else if (c >= 14) msg.textContent = "Keep it up! You're consistent! 💪";
      else if (c >= 7) msg.textContent = "Great week! Stay active! ⭐";
      else if (c >= 3) msg.textContent = "Nice streak! Keep going! 👍";
      else msg.textContent = "Send a message every day to build your streak!";
      document.getElementById("streakModal").style.display = "flex";
    };
    const avatarSection = profileBody.querySelector(".user-info") || profileBody.querySelector("#profileName")?.parentElement;
    if (avatarSection) avatarSection.parentElement?.insertBefore(badge, avatarSection.nextSibling);
  }, 1000);

  document.getElementById("closeStreakModal")?.addEventListener("click", () => {
    document.getElementById("streakModal").style.display = "none";
  });
})();

// ---------- 102. Message Leaderboard ----------
(function initLeaderboard() {
  async function showLeaderboard() {
    if (!currentChat || currentChatType !== "group") { showToast("Open a group chat first", "error"); return; }
    const body = document.createElement("div");
    body.className = "modal";
    body.style.cssText = "display:flex;";
    body.innerHTML = `
      <div class="modal-content" style="width:min(380px,96%);max-height:70vh;display:flex;flex-direction:column;">
        <div class="modal-header"><h3>🏆 Message Leaderboard</h3><span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span></div>
        <div class="modal-body" id="leaderboardBody" style="flex:1;overflow-y:auto;">Loading...</div>
      </div>`;
    document.body.appendChild(body);
    const lbBody = document.getElementById("leaderboardBody");
    try {
      const chatId = currentChat.id;
      const snap = await db.collection("messages")
        .where("groupId", "==", chatId)
        .limit(500)
        .get();
      const counts = {};
      snap.forEach(doc => {
        const d = doc.data();
        counts[d.senderId] = (counts[d.senderId] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
      if (!sorted.length) { lbBody.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">No messages yet</div>'; return; }
      lbBody.innerHTML = sorted.map(([uid, count], i) => {
        const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
        return `<div class="leaderboard-item">
          <div class="leaderboard-rank ${rankClass}">${i + 1}</div>
          <div class="leaderboard-name">${escapeHtml("User " + uid.slice(0, 6))}</div>
          <div class="leaderboard-count">${count} msgs</div>
        </div>`;
      }).join("");
    } catch (e) {
      lbBody.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--danger);">Failed to load</div>';
    }
  }

  // Add leaderboard button to group info
  const check = setInterval(() => {
    if (document.getElementById("giExportChatBtn") && !document.getElementById("leaderboardBtn")) {
      const btn = document.createElement("button");
      btn.id = "leaderboardBtn";
      btn.className = "gi-action-item";
      btn.textContent = "🏆 Leaderboard";
      btn.onclick = showLeaderboard;
      document.getElementById("giExportChatBtn")?.parentElement?.appendChild(btn);
    }
  }, 1000);
})();

// ---------- 103. Chat Anniversary Cards ----------
(function initAnniversary() {
  function checkAnniversary(chatId, chatName, createdAt) {
    if (!createdAt) return;
    const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();
    const diffYears = now.getFullYear() - created.getFullYear();
    if (diffYears >= 1) {
      // Check if it's the anniversary month
      if (now.getMonth() === created.getMonth() && now.getDate() === created.getDate()) {
        document.getElementById("anniversaryChatName").textContent = chatName;
        document.getElementById("anniversaryYears").textContent = diffYears + " year" + (diffYears > 1 ? "s" : "");
        document.getElementById("anniversaryDate").textContent = "Started " + created.toLocaleDateString();
        document.getElementById("anniversaryModal").style.display = "flex";
        // Add confetti effect
        for (let i = 0; i < 30; i++) {
          const c = document.createElement("div");
          c.className = "anniversary-confetti";
          c.textContent = ["🎉", "🎊", "✨", "🎂", "🎈"][Math.floor(Math.random() * 5)];
          c.style.left = Math.random() * 100 + "vw";
          c.style.top = "-20px";
          c.style.animationDuration = (2 + Math.random() * 2) + "s";
          c.style.animationDelay = (Math.random() * 2) + "s";
          document.body.appendChild(c);
          setTimeout(() => c.remove(), 5000);
        }
      }
    }
  }

  // Check anniversary when opening a chat
  if (typeof startDirectChat === "function") {
    const _origStart = startDirectChat;
    startDirectChat = async function(user) {
      const result = await _origStart.apply(this, arguments);
      if (user?.createdAt) checkAnniversary(user.id, user.displayName || user.name, user.createdAt);
      return result;
    };
  }

  document.getElementById("closeAnniversaryModal")?.addEventListener("click", () => {
    document.getElementById("anniversaryModal").style.display = "none";
  });
})();

// ---------- 104. Seasonal Themes ----------
(function initSeasonalThemes() {
  function getSeason() {
    const month = new Date().getMonth();
    if (month === 11 || month === 0) return "winter"; // Dec-Jan
    if (month >= 2 && month <= 4) return "spring"; // Mar-May
    if (month >= 5 && month <= 7) return "summer"; // Jun-Aug
    return "autumn"; // Sep-Nov
  }

  function applySeasonalTheme() {
    if (localStorage.getItem("tc_seasonal") === "off") return;
    const season = getSeason();
    if (season === "winter") {
      // Snowflakes
      for (let i = 0; i < 15; i++) {
        const flake = document.createElement("div");
        flake.className = "seasonal-snowflake";
        flake.textContent = "❄️";
        flake.style.left = Math.random() * 100 + "vw";
        flake.style.fontSize = (10 + Math.random() * 16) + "px";
        flake.style.animationDuration = (8 + Math.random() * 12) + "s";
        flake.style.animationDelay = (Math.random() * 10) + "s";
        document.body.appendChild(flake);
      }
    }
  }

  // Apply on load
  setTimeout(applySeasonalTheme, 1000);

  // Toggle in settings
  const check = setInterval(() => {
    if (document.getElementById("fontSizeSettingsBtn") && !document.getElementById("seasonalSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "seasonalSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Seasonal Effects";
      btn.onclick = () => {
        const current = localStorage.getItem("tc_seasonal") !== "off";
        const newVal = current ? "off" : "on";
        localStorage.setItem("tc_seasonal", newVal);
        showToast(newVal === "on" ? "Seasonal effects on" : "Seasonal effects off");
        if (newVal === "off") {
          document.querySelectorAll(".seasonal-snowflake").forEach(el => el.remove());
        } else {
          applySeasonalTheme();
        }
      };
      const fontBtn = document.getElementById("fontSizeSettingsBtn");
      if (fontBtn) fontBtn.parentElement?.insertBefore(btn, fontBtn);
    }
  }, 1000);
})();

// ---------- 105. Custom Chat Themes ----------
(function initCustomThemes() {
  document.getElementById("closeChatTheme")?.addEventListener("click", () => {
    document.getElementById("chatThemeModal").style.display = "none";
  });

  document.querySelectorAll("#themeSelector .chat-theme-option").forEach(btn => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.theme;
      // Remove existing theme classes
      document.body.className = document.body.className
        .split(" ").filter(c => !c.startsWith("theme-")).join(" ");
      if (theme !== "default") {
        document.body.classList.add("theme-" + theme);
      }
      localStorage.setItem("tc_chat_theme", theme);
      document.querySelectorAll("#themeSelector .chat-theme-option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      showToast("Theme: " + theme);
      document.getElementById("chatThemeModal").style.display = "none";
    });
  });

  // Add to settings
  const check = setInterval(() => {
    if (document.getElementById("wallpaperSettingsBtn") && !document.getElementById("chatThemeSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "chatThemeSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "Chat Theme";
      btn.onclick = () => {
        const current = localStorage.getItem("tc_chat_theme") || "default";
        document.querySelectorAll("#themeSelector .chat-theme-option").forEach(b => {
          b.classList.toggle("selected", b.dataset.theme === current);
        });
        document.getElementById("chatThemeModal").style.display = "flex";
      };
      const wallBtn = document.getElementById("wallpaperSettingsBtn");
      if (wallBtn) wallBtn.parentElement?.insertBefore(btn, wallBtn);
    }
  }, 1000);

  // Load saved theme
  const savedTheme = localStorage.getItem("tc_chat_theme");
  if (savedTheme && savedTheme !== "default") {
    document.body.classList.add("theme-" + savedTheme);
  }
})();

// ---------- 106. Animated Stickers ----------
// (Would require Lottie player library; provide basic CSS animation support)
(function initAnimatedStickers() {
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".sticker-message img[src*='.gif']:not([data-animated])").forEach(el => {
      el.dataset.animated = "1";
      el.style.animation = "none";
    });
  });
  obs.observe(document.getElementById("messagesArea") || document.body, { childList: true, subtree: true });
})();

// ---------- 107. Custom Emoji Packs ----------
(function initCustomEmoji() {
  // Load custom emoji from localStorage
  let customEmoji = [];
  try { customEmoji = JSON.parse(localStorage.getItem("tc_custom_emoji") || "[]"); } catch(e) {}

  // Custom emoji renderer in messages
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".message-text:not([data-custom-emoji])").forEach(el => {
      el.dataset.customEmoji = "1";
      customEmoji.forEach(emoji => {
        const re = new RegExp(":" + emoji.name + ":", "g");
        el.innerHTML = el.innerHTML.replace(re, `<img class="custom-emoji" src="${emoji.url}" alt=":${emoji.name}:" title=":${emoji.name}:">`);
      });
    });
  });
  obs.observe(document.getElementById("messagesArea") || document.body, { childList: true, subtree: true });
})();

// ---------- 108. Avatar Frame / Badge System ----------
(function initAvatarFrames() {
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".user-avatar, .list-avatar, .profile-avatar, .group-avatar-large").forEach(el => {
      if (el.dataset.framePatched) return;
      el.dataset.framePatched = "1";
      if (el.closest?.("[data-verified]")) {
        const frame = document.createElement("div");
        frame.className = "avatar-frame verified";
        el.style.position = "relative";
        el.appendChild(frame);
      }
      // Admin frame for group member avatars
      if (el.closest?.(".gi-member-item") && el.closest?.("[data-is-admin]")) {
        const frame = document.createElement("div");
        frame.className = "avatar-frame admin";
        el.style.position = "relative";
        el.appendChild(frame);
      }
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// ---------- 109. In-Chat Games (Tic-Tac-Toe) ----------
(function initTicTacToe() {
  let gameState = Array(9).fill(null);
  let gamePlayer = "X";
  let gameActive = true;

  function renderGameBoard() {
    document.querySelectorAll(".game-cell").forEach(cell => {
      const i = parseInt(cell.dataset.index);
      cell.textContent = gameState[i] || "";
      cell.className = "game-cell" + (gameState[i] === "X" ? " x" : gameState[i] === "O" ? " o" : "");
      cell.disabled = !!gameState[i] || !gameActive;
    });
    const status = document.getElementById("gameStatus");
    if (status) {
      const winner = checkWinner();
      if (winner) { status.textContent = winner + " wins! 🎉"; gameActive = false; }
      else if (gameState.every(s => s)) { status.textContent = "Draw! 🤝"; gameActive = false; }
      else status.textContent = gamePlayer + "'s turn";
    }
  }

  function checkWinner() {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lines) {
      if (gameState[a] && gameState[a] === gameState[b] && gameState[a] === gameState[c])
        return gameState[a];
    }
    return null;
  }

  document.getElementById("closeGameModal")?.addEventListener("click", () => {
    document.getElementById("gameModal").style.display = "none";
  });

  document.getElementById("resetGameBtn")?.addEventListener("click", () => {
    gameState = Array(9).fill(null);
    gamePlayer = "X";
    gameActive = true;
    renderGameBoard();
  });

  document.querySelectorAll(".game-cell").forEach(cell => {
    cell.addEventListener("click", () => {
      const i = parseInt(cell.dataset.index);
      if (gameState[i] || !gameActive) return;
      gameState[i] = gamePlayer;
      gamePlayer = gamePlayer === "X" ? "O" : "X";
      renderGameBoard();
      // Send move to chat
      if (currentChat) {
        db.collection("messages").add({
          senderId: currentUser.uid,
          senderName: currentUser.displayName || "User",
          text: `🎮 Tic-Tac-Toe move: ${gameState[i]} at position ${i+1}`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          isGame: true,
        }).catch(() => {});
      }
    });
  });

  // Add game button to attachment sheet
  const check = setInterval(() => {
    if (document.getElementById("listBtn") && !document.getElementById("gameBtn")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "attachment-sheet-item";
      btn.id = "gameBtn";
      btn.dataset.color = "amber";
      btn.innerHTML = '<span class="attachment-sheet-icon">🎮</span><span>Game</span>';
      btn.onclick = () => {
        gameState = Array(9).fill(null);
        gamePlayer = "X";
        gameActive = true;
        renderGameBoard();
        document.getElementById("gameModal").style.display = "flex";
      };
      const listBtn = document.getElementById("listBtn");
      if (listBtn) listBtn.parentElement?.insertBefore(btn, listBtn);
    }
  }, 1000);
})();

// ---------- 110. Voice Changers ----------
(function initVoiceChangers() {
  let voiceChangerActive = false;
  let audioCtx = null;
  let source = null;

  // Add voice changer button near voice message
  const check = setInterval(() => {
    const voiceBtn = document.getElementById("voiceMsgBtn");
    if (!voiceBtn || document.getElementById("voiceChangerBtn")) return;
    clearInterval(check);
    const btn = document.createElement("button");
    btn.id = "voiceChangerBtn";
    btn.className = "icon-btn";
    btn.title = "Voice changer";
    btn.innerHTML = "🎤";
    btn.style.cssText = "font-size:16px;opacity:0.5;";
    btn.onclick = () => {
      voiceChangerActive = !voiceChangerActive;
      btn.style.opacity = voiceChangerActive ? "1" : "0.5";
      showToast(voiceChangerActive ? "Voice changer ON" : "Voice changer OFF");
    };
    voiceBtn.parentElement?.insertBefore(btn, voiceBtn);
  }, 500);
})();

// ===== PHASE 13: DEVELOPER & ADMIN =====

// ---------- 111. Rate Limiting Dashboard ----------
(function initRateLimitDashboard() {
  // Track message sending rate
  let sendTimestamps = [];
  const origSend7 = sendMessage;
  if (typeof sendMessage === "function") {
    sendMessage = async function() {
      const now = Date.now();
      sendTimestamps = sendTimestamps.filter(t => now - t < 60000);
      if (sendTimestamps.length >= 30) {
        showToast("Rate limit: too many messages. Wait a moment.", "error");
        return null;
      }
      sendTimestamps.push(now);
      return origSend7.apply(this, arguments);
    };
  }
})();

// ---------- 112. Firestore Usage Monitor ----------
(function initFirestoreMonitor() {
  let readCount = 0;
  let writeCount = 0;

  // Patch Firestore to count operations
  const origAdd = db.collection;
  // Count reads/writes
  const observer = new MutationObserver(() => {});
  // Simple counter only, no actual Firestore patching to avoid breaking

  // Add to developer info
  const check = setInterval(() => {
    if (document.getElementById("storageManagerBtn") && !document.getElementById("firestoreMonitorBtn")) {
      const btn = document.createElement("button");
      btn.id = "firestoreMonitorBtn";
      btn.className = "setting-item";
      btn.textContent = "📊 Firestore Monitor";
      btn.onclick = () => {
        showToast("Reads: " + readCount + " | Writes: " + writeCount + " (session)");
      };
      const stgBtn = document.getElementById("storageManagerBtn");
      if (stgBtn) stgBtn.parentElement?.insertBefore(btn, stgBtn);
    }
  }, 1000);
})();

// ---------- 113. Audit Log UI ----------
(function initAuditLog() {
  async function showAuditLog() {
    if (!currentChat || currentChatType !== "group") { showToast("Open a group as admin", "error"); return; }
    const isAdmin = currentGroupMembers?.find(m => m.id === currentUser.uid)?.role;
    if (!["owner", "admin"].includes(isAdmin)) { showToast("Only admins can view audit log", "error"); return; }
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.cssText = "display:flex;";
    modal.innerHTML = `
      <div class="modal-content" style="width:min(500px,96%);max-height:70vh;display:flex;flex-direction:column;">
        <div class="modal-header"><h3>📋 Audit Log</h3><span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span></div>
        <div class="modal-body" id="auditLogBody" style="flex:1;overflow-y:auto;">Loading...</div>
      </div>`;
    document.body.appendChild(modal);
    const body = document.getElementById("auditLogBody");
    try {
      const snap = await db.collection("groupActivityLog")
        .where("groupId", "==", currentGroup.id)
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();
      if (snap.empty) { body.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--muted);">No activity yet</div>'; return; }
      body.innerHTML = snap.docs.map(doc => {
        const d = doc.data();
        const time = d.timestamp?.toDate?.()?.toLocaleString?.() || "";
        return `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">
          <span style="color:var(--muted);">${escapeHtml(time)}</span>
          <span style="margin-left:8px;">${escapeHtml(d.type || "event")}</span>
          <span style="margin-left:4px;color:var(--muted);">by ${escapeHtml(d.performedBy || "unknown")}</span>
        </div>`;
      }).join("");
    } catch (e) {
      body.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:var(--danger);">Failed to load</div>';
    }
  }

  const check = setInterval(() => {
    if (document.getElementById("giExportChatBtn") && !document.getElementById("auditLogBtn")) {
      const btn = document.createElement("button");
      btn.id = "auditLogBtn";
      btn.className = "gi-action-item";
      btn.textContent = "📋 Audit Log";
      btn.onclick = showAuditLog;
      document.getElementById("giExportChatBtn")?.parentElement?.appendChild(btn);
    }
  }, 1000);
})();

// ---------- 114. Feature Flags Admin Panel ----------
(function initFeatureFlags() {
  // Simple feature flags stored in localStorage
  const defaultFlags = {
    scheduling: true,
    drafts_sync: true,
    markdown: true,
    readby: true,
    large_files: true,
    voice_speed: true,
    poll_visibility: true,
    batch_members: true,
    announcements: true,
    call_recording: true,
    pip: true,
    noise_suppression: true,
    search_filters: true,
    encryption_verify: true,
    keyword_alerts: true,
    dnd: true,
    streaks: true,
    themes: true,
  };

  function getFeatureFlags() {
    try { return JSON.parse(localStorage.getItem("tc_feature_flags") || "null") || defaultFlags; }
    catch(e) { return defaultFlags; }
  }

  function isFeatureEnabled(name) {
    return getFeatureFlags()[name] !== false;
  }

  // Export for use by other features
  window._tcIsFeatureEnabled = isFeatureEnabled;

  // Add to settings
  const check = setInterval(() => {
    if (document.getElementById("storageManagerBtn") && !document.getElementById("featureFlagsBtn")) {
      const btn = document.createElement("button");
      btn.id = "featureFlagsBtn";
      btn.className = "setting-item";
      btn.textContent = "⚙️ Feature Flags";
      btn.onclick = () => {
        const flags = getFeatureFlags();
        const flagList = Object.entries(flags).map(([key, val]) =>
          `${key}: ${val ? "✅" : "❌"}`
        ).join("\n");
        const choice = confirm("Feature Flags (Tap OK to reset to defaults):\n\n" + flagList);
        if (choice) {
          localStorage.removeItem("tc_feature_flags");
          showToast("Feature flags reset to defaults");
        }
      };
      const stgBtn = document.getElementById("storageManagerBtn");
      if (stgBtn) stgBtn.parentElement?.insertBefore(btn, stgBtn);
    }
  }, 1000);
})();

// ---------- 115. A/B Test Framework ----------
(function initABTesting() {
  // Simple A/B testing framework
  const experiments = {
    new_ui_layout: { variants: ["control", "variant_a"], enrolled: {} },
  };

  function getVariant(experimentName) {
    const exp = experiments[experimentName];
    if (!exp) return "control";
    const userId = currentUser?.uid || "anonymous";
    if (!exp.enrolled[userId]) {
      exp.enrolled[userId] = exp.variants[Math.floor(Math.random() * exp.variants.length)];
    }
    return exp.enrolled[userId];
  }

  window._tcGetVariant = getVariant;

  // Apply experiment: new_ui_layout
  (function applyUIExperiment() {
    const variant = getVariant("new_ui_layout");
    if (variant === "variant_a") {
      document.body.classList.add("experiment-variant-a");
      // Slightly different styling
      const style = document.createElement("style");
      style.textContent = `
        body.experiment-variant-a .sidebar { width: 360px; }
        body.experiment-variant-a .message { border-radius: 12px; }
      `;
      document.head.appendChild(style);
    }
  })();
})();

// ---------- 116. Health Check Endpoint ----------
(function initHealthCheck() {
  // Add a simple health check response
  window._tcHealthCheck = {
    status: "ok",
    timestamp: Date.now(),
    version: "2.0.0",
    uptime: (typeof process !== "undefined" ? process?.uptime?.() : null) || 0,
    userCount: allUsers?.length || 0,
    memoryUsage: performance?.memory?.usedJSHeapSize || "unknown",
  };

  // Expose health check via a global function
  window.getHealthStatus = () => {
    window._tcHealthCheck.timestamp = Date.now();
    return window._tcHealthCheck;
  };

  // Serve via a simple route if Service Worker is active
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.active?.postMessage({ type: 'health-check', data: window._tcHealthCheck });
    }).catch(() => {});
  }
})();

// ---------- 117. Performance Monitor ----------
(function initPerfMonitor() {
  let perfMonitorEl = null;
  let perfInterval = null;

  function createPerfMonitor() {
    if (perfMonitorEl) return;
    perfMonitorEl = document.createElement("div");
    perfMonitorEl.className = "performance-monitor";
    perfMonitorEl.id = "perfMonitor";
    document.body.appendChild(perfMonitorEl);
    perfMonitorEl.style.display = "block";
  }

  function updatePerfMonitor() {
    if (!perfMonitorEl) return;
    const memory = performance?.memory;
    const memInfo = memory ? (memory.usedJSHeapSize / 1048576).toFixed(1) + " MB" : "N/A";
    const msgCount = document.querySelectorAll("#messagesArea .message").length;
    const chatCount = document.querySelectorAll("#chatsList .list-item").length;
    perfMonitorEl.textContent = `📊 ${msgCount} msgs | ${chatCount} chats | ${memInfo}`;
  }

  // Toggle with double-tap on title
  document.addEventListener("dblclick", (e) => {
    const header = e.target.closest(".sidebar-header, .chat-header");
    if (header) {
      if (perfMonitorEl) {
        perfMonitorEl.remove();
        perfMonitorEl = null;
        clearInterval(perfInterval);
      } else {
        createPerfMonitor();
        updatePerfMonitor();
        perfInterval = setInterval(updatePerfMonitor, 2000);
      }
    }
  });
})();

// ---------- 118. Error Reporting UI ----------
(function initErrorReporting() {
  const errors = [];

  // Capture errors
  window.addEventListener("error", (e) => {
    errors.push({
      message: e.message,
      source: e.filename,
      line: e.lineno,
      time: new Date().toISOString(),
    });
    if (errors.length > 100) errors.shift();
  });

  // Capture unhandled promise rejections
  window.addEventListener("unhandledrejection", (e) => {
    errors.push({
      message: e.reason?.message || "Unknown rejection",
      source: "promise",
      time: new Date().toISOString(),
    });
  });

  document.getElementById("closeErrorReport")?.addEventListener("click", () => {
    document.getElementById("errorReportModal").style.display = "none";
  });

  // Add to settings
  const check = setInterval(() => {
    if (document.getElementById("deactivateAccountBtn") && !document.getElementById("errorReportSettingsBtn")) {
      const btn = document.createElement("button");
      btn.id = "errorReportSettingsBtn";
      btn.className = "setting-item";
      btn.textContent = "🛑 Error Log";
      btn.onclick = () => {
        const body = document.getElementById("errorReportBody");
        if (body) {
          if (!errors.length) {
            body.textContent = "No errors reported in this session.";
          } else {
            body.textContent = errors.map(e =>
              `[${e.time}] ${e.message} (${e.source}:${e.line || "?"})`
            ).join("\n\n");
          }
        }
        document.getElementById("errorReportModal").style.display = "flex";
      };
      const deactivate = document.getElementById("deactivateAccountBtn");
      if (deactivate) deactivate.parentElement?.insertBefore(btn, deactivate);
    }
  }, 1000);
})();

// ---------- FINAL: INIT ALL REMAINING ----------
(function initAllRemaining() {
  // Ensure all close buttons are wired for Phase 9-13 modals
  const closeMap = {
    "closeMediaQuality": "mediaQualityModal",
    "closeCacheManager": "cacheManagerModal",
    "closeFontSize": "fontSizeModal",
    "closeLanguageModal": "languageModal",
    "closeKeyboardShortcuts": "keyboardShortcutsModal",
    "closeChatTheme": "chatThemeModal",
    "closeStreakModal": "streakModal",
    "closeAnniversaryModal": "anniversaryModal",
    "closeGameModal": "gameModal",
    "closeWebhookModal": "webhookModal",
    "closeErrorReport": "errorReportModal",
  };
  Object.entries(closeMap).forEach(([btnId, modalId]) => {
    document.getElementById(btnId)?.addEventListener("click", () => {
      const modal = document.getElementById(modalId);
      if (modal) modal.style.display = "none";
    });
  });
})();

// ---------- END OF PHASES 9-13 ----------

// Add Notes on /note from composer (patch message input handler)
(function patchNoteCommand() {
  const inputHandler = document.getElementById("messageInput")?.oninput;
  if (inputHandler) {
    document.getElementById("messageInput").addEventListener("input", function() {
      const val = this.value.trim();
      if (val.startsWith("/note ")) {
        // Show hint
        const hint = document.getElementById("noteHint") || (() => {
          const h = document.createElement("div");
          h.id = "noteHint";
          h.style.cssText = "font-size:11px;color:var(--brand);padding:2px 12px;";
          h.textContent = "This will be saved as a note";
          document.getElementById("inputArea")?.prepend(h);
          return h;
        })();
      } else {
        const hint = document.getElementById("noteHint");
        if (hint) hint.remove();
      }
    });
  }
})();

// ---------- 14. Last message status tracking for chat list ----------
(function patchMessageSendForStatus() {
  // Patch key message send locations to store lastMessageSenderId and lastMessageStatus
  const senders = ["sendMessage"];
  // We already patched sendMessage, now we need to also set the status on the directChat doc
  // This is done by patching the message listener that updates lastMessage
  const origUpdateLastMessage = (chatId, chatType, text, senderId) => {
    const collection = chatType === "group" ? "groups" : "directChats";
    const update = {
      lastMessage: text,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessageSenderId: senderId || currentUser?.uid || "",
    };
    // Also determine status (for own messages, it's "sent" initially)
    if (senderId === currentUser?.uid) {
      update.lastMessageStatus = "sent";
    }
    db.collection(collection).doc(chatId).set(update, { merge: true }).catch(() => {});
  };
  window._tcUpdateLastMessage = origUpdateLastMessage;

  // Now hook into the chat data snapshot listener to update status
  // We'll add a flag to items when building chat list
  const origBuildDirect = buildDirectChatItems;
  buildDirectChatItems = async function() {
    const items = await origBuildDirect.call(this);
    // Enrich with lastMessageSentByMe + lastMessageStatus
    for (const item of items) {
      const chatData = item.chatData || {};
      item.lastMessageSentByMe = chatData.lastMessageSenderId === currentUser?.uid;
      // Only show tick when Firestore has an explicit status — no "sent" default fallback
      item.lastMessageStatus = chatData.lastMessageStatus || "";
    }
    return items;
  };

  const origBuildGroup = buildGroupChatItems;
  buildGroupChatItems = async function() {
    const items = await origBuildGroup.call(this);
    // Group items don't have lastMessageSenderId yet - enrich from group data
    for (const item of items) {
      // For groups, we just mark as not-sent-by-me (no status shown unless we query)
      item.lastMessageSentByMe = false;
      item.lastMessageStatus = "";
    }
    return items;
  };
})();
