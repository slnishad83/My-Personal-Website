'use strict';
// ========================================
// THREADS — SUB-CONVERSATIONS
// ========================================
// Each message can have a thread stored in a subcollection:
//   messages/{messageId}/threadReplies/{replyId}
//
// Parent message gets: threadCount, lastThreadAt, lastThreadSenderName

/* ── Polyfill: renderMessageText (safe, sanitized) ─────── */
if (typeof renderMessageText === 'undefined') {
  window.renderMessageText = function renderMessageText(text, mentions) {
    var esc = window.escHtml || window.escapeHtml || window.NSLSanitize?.escapeHTML || function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');};
    var safe = esc(text || '');
    safe = safe
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/(https?:\/\/[^\s&<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
    return safe;
  };
}

if (typeof renderAttachment === 'undefined') {
  window.renderAttachment = function renderAttachment(att) {
    if (!att) return '';
    var esc = window.escHtml || window.escapeHtml || window.NSLSanitize?.escapeHTML || function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};
    if (att.url) {
      if (att.type && att.type.startsWith('image/')) return '<img src="' + esc(att.url) + '" alt="' + esc(att.name || 'attachment') + '" style="max-width:200px;border-radius:8px;">';
      if (att.type && att.type.startsWith('video/')) return '<video src="' + esc(att.url) + '" controls style="max-width:200px;border-radius:8px;"></video>';
      return '<a href="' + esc(att.url) + '" target="_blank" rel="noopener">' + esc(att.name || 'Attachment') + '</a>';
    }
    return '<span>' + esc(att.name || 'Attachment') + '</span>';
  };
}

let currentThreadMessageId = null;
let currentThreadMessageData = null;
let threadRepliesUnsubscribe = null;

// Open the thread panel for a given parent message
async function openThreadPanel(messageId, messageData) {
  if (!messageId || !window.currentUser) return;
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
  container.setAttribute('aria-live', 'polite');

  container.innerHTML = '<div class="thread-loading">Loading replies…</div>';

  threadRepliesUnsubscribe = window.db
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
    const isMe = msg.senderId === window.currentUser?.uid;
    const time = msg.timestamp ? formatTime(msg.timestamp) : "";

    const div = document.createElement("div");
    div.className = `thread-reply-item ${isMe ? "thread-reply-mine" : "thread-reply-theirs"}`;
    div.dataset.replyId = doc.id;

    div.innerHTML = `
      <div class="thread-reply-bubble">
        ${!isMe ? `<div class="thread-reply-sender">${window.sanitizeHTML(escapeHtml(msg.senderName || "Unknown"))}</div>` : ""}
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
  if (!currentThreadMessageId || !window.currentUser) return;

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
      senderId: window.currentUser.uid,
      senderName: window.currentUser.displayName || window.currentUser.email || "User",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      parentMessageId: currentThreadMessageId,
    };

    await window.db
      .collection("messages")
      .doc(currentThreadMessageId)
      .collection("threadReplies")
      .add(replyData);

    await window.db.collection("messages").doc(currentThreadMessageId).update({
      threadCount: firebase.firestore.FieldValue.increment(1),
      lastThreadAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastThreadSenderName: window.currentUser.displayName || window.currentUser.email || "User",
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

// ── Thread Summary ────────────────────────────────────────────────────────
async function summarizeCurrentThread() {
  if (!currentThreadMessageId) return;

  const btn = document.getElementById("threadSummarizeBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Summarizing…"; }

  // Remove any previous summary card
  document.getElementById("threadSummaryCard")?.remove();

  try {
    const summarizeFn = firebase.functions().httpsCallable("summarizeThread", { timeout: 30000 });
    const result = await summarizeFn({ messageId: currentThreadMessageId });
    const summaryText = result.data?.summary || "No summary generated.";

    // Parse lines into bullet list
    const lines = summaryText.split("\n").map(l => l.trim().replace(/^[-•*]\s*/, "")).filter(Boolean);
    const listHtml = lines.map(l => `<li>${escapeHtml(l)}</li>`).join("");

    const card = document.createElement("div");
    card.id = "threadSummaryCard";
    card.className = "thread-summary-card";
    card.innerHTML = `
      <div class="thread-summary-header">
        <span class="thread-summary-icon">✨</span>
        <span class="thread-summary-title">AI Summary</span>
        <button class="thread-summary-close" type="button" aria-label="Close summary">&#x2715;</button>
      </div>
      <ul class="thread-summary-list">${listHtml}</ul>
    `;
    card.querySelector(".thread-summary-close").addEventListener("click", () => card.remove());

    const repliesList = document.getElementById("threadRepliesList");
    if (repliesList) repliesList.parentNode.insertBefore(card, repliesList);
  } catch (err) {
    console.error("[summarizeThread]", err);
    if (typeof showToast === "function") showToast("Could not summarize thread. Deploy the Cloud Function first.", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "✨ Summarize"; }
  }
}

function setupThreadPanel() {
  const closeBtn = document.getElementById("threadPanelCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeThreadPanel);

  const sendBtn = document.getElementById("threadSendBtn");
  if (sendBtn) sendBtn.addEventListener("click", sendThreadReply);

  const summarizeBtn = document.getElementById("threadSummarizeBtn");
  if (summarizeBtn) summarizeBtn.addEventListener("click", summarizeCurrentThread);

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
