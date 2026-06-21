// ========================================
// THREADS — SUB-CONVERSATIONS
// ========================================
// Each message can have a thread stored in a subcollection:
//   messages/{messageId}/threadReplies/{replyId}
//
// Parent message gets: threadCount, lastThreadAt, lastThreadSenderName

let currentThreadMessageId = null;
let currentThreadMessageData = null;
let threadRepliesUnsubscribe = null;

// Open the thread panel for a given parent message
async function openThreadPanel(messageId, messageData) {
  if (!messageId || !currentUser) return;
  currentThreadMessageId = messageId;
  currentThreadMessageData = messageData || {};

  const panel = document.getElementById("threadPanel");
  if (!panel) return;

  // Render the parent message header
  const parentEl = document.getElementById("threadParentMessage");
  if (parentEl) {
    const senderName = (currentThreadMessageData.senderName || "Unknown");
    const text = currentThreadMessageData.text || "";
    const ts = currentThreadMessageData.timestamp;
    const timeStr = ts ? formatTime(ts) : "";
    const attachment = currentThreadMessageData.attachment;
    parentEl.innerHTML = `
      <div class="thread-parent-bubble">
        <div class="thread-parent-header">
          <span class="thread-parent-sender">${escapeHtml(senderName)}</span>
          <span class="thread-parent-time">${escapeHtml(timeStr)}</span>
        </div>
        ${text ? `<div class="thread-parent-text">${renderMessageText(text, currentThreadMessageData.mentions || [])}</div>` : ""}
        ${attachment ? `<div class="thread-parent-attachment-label">${escapeHtml(getAttachmentLabel(attachment))}</div>` : ""}
      </div>
    `;
  }

  // Update header reply count
  const headerCount = document.getElementById("threadHeaderCount");
  const threadCount = currentThreadMessageData.threadCount || 0;
  if (headerCount) headerCount.textContent = threadCount > 0 ? `${threadCount} ${threadCount === 1 ? "reply" : "replies"}` : "";

  // Open panel
  panel.classList.add("open");
  document.body.classList.add("thread-panel-open");

  // Start listening for replies
  subscribeToThreadReplies(messageId);

  // Focus composer
  setTimeout(() => document.getElementById("threadComposer")?.focus(), 320);
}

function closeThreadPanel() {
  const panel = document.getElementById("threadPanel");
  if (panel) panel.classList.remove("open");
  document.body.classList.remove("thread-panel-open");

  if (threadRepliesUnsubscribe) {
    threadRepliesUnsubscribe();
    threadRepliesUnsubscribe = null;
  }
  currentThreadMessageId = null;
  currentThreadMessageData = null;
}

function subscribeToThreadReplies(messageId) {
  if (threadRepliesUnsubscribe) {
    threadRepliesUnsubscribe();
    threadRepliesUnsubscribe = null;
  }

  const container = document.getElementById("threadRepliesList");
  if (!container) return;

  container.innerHTML = '<div class="thread-loading">Loading replies…</div>';

  threadRepliesUnsubscribe = db
    .collection("messages")
    .doc(messageId)
    .collection("threadReplies")
    .orderBy("timestamp", "asc")
    .limit(200)
    .onSnapshot(
      (snapshot) => {
        const headerCount = document.getElementById("threadHeaderCount");
        if (headerCount) {
          const c = snapshot.size;
          headerCount.textContent = c > 0 ? `${c} ${c === 1 ? "reply" : "replies"}` : "";
        }
        if (snapshot.empty) {
          container.innerHTML = '<div class="thread-empty">No replies yet. Be the first to reply.</div>';
          return;
        }
        renderThreadReplies(snapshot.docs, container);
      },
      (err) => {
        console.error("Thread replies error:", err);
        container.innerHTML = '<div class="thread-error">Could not load replies.</div>';
      }
    );
}

function renderThreadReplies(docs, container) {
  if (!container) return;
  const wasAtBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 80;

  container.innerHTML = "";
  docs.forEach((doc) => {
    const msg = doc.data();
    const isMe = msg.senderId === currentUser?.uid;
    const time = msg.timestamp ? formatTime(msg.timestamp) : "";

    const div = document.createElement("div");
    div.className = `thread-reply-item ${isMe ? "thread-reply-mine" : "thread-reply-theirs"}`;
    div.dataset.replyId = doc.id;

    div.innerHTML = `
      <div class="thread-reply-bubble">
        ${!isMe ? `<div class="thread-reply-sender">${escapeHtml(msg.senderName || "Unknown")}</div>` : ""}
        ${msg.text ? `<div class="thread-reply-text">${renderMessageText(msg.text, msg.mentions || [])}</div>` : ""}
        ${msg.attachment ? `<div class="thread-reply-attachment">${renderAttachment(msg.attachment)}</div>` : ""}
        <div class="thread-reply-time">${escapeHtml(time)}</div>
      </div>
    `;
    container.appendChild(div);
  });

  if (wasAtBottom) container.scrollTop = container.scrollHeight;
}

async function sendThreadReply() {
  if (!currentThreadMessageId || !currentUser) return;

  const composer = document.getElementById("threadComposer");
  if (!composer) return;
  const text = (composer.value || "").trim();
  if (!text) return;

  const sendBtn = document.getElementById("threadSendBtn");
  if (sendBtn) sendBtn.disabled = true;
  composer.disabled = true;

  try {
    const replyData = {
      text,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email || "User",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      parentMessageId: currentThreadMessageId,
    };

    await db
      .collection("messages")
      .doc(currentThreadMessageId)
      .collection("threadReplies")
      .add(replyData);

    await db.collection("messages").doc(currentThreadMessageId).update({
      threadCount: firebase.firestore.FieldValue.increment(1),
      lastThreadAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastThreadSenderName: currentUser.displayName || currentUser.email || "User",
    });

    composer.value = "";
    composer.style.height = "auto";
  } catch (err) {
    console.error("Thread send error:", err);
    showToast("Could not send reply", "error");
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    composer.disabled = false;
    composer.focus();
  }
}

function setupThreadPanel() {
  const closeBtn = document.getElementById("threadPanelCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeThreadPanel);

  const sendBtn = document.getElementById("threadSendBtn");
  if (sendBtn) sendBtn.addEventListener("click", sendThreadReply);

  const composer = document.getElementById("threadComposer");
  if (composer) {
    composer.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendThreadReply();
      }
    });
    composer.addEventListener("input", () => {
      composer.style.height = "auto";
      composer.style.height = Math.min(composer.scrollHeight, 120) + "px";
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupThreadPanel);
} else {
  setupThreadPanel();
}
