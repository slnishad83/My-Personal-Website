'use strict';
(function () {
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

  function _esc(s) { return window.escHtml ? window.escHtml(String(s ?? '')) : String(s ?? ''); }

  function _fmtTime(ts) {
    if (!ts) return '';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (msgDay.getTime() === today.getTime()) return time;
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday ' + time;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
    } catch (_) { return ''; }
  }

  function _attLabel(att) {
    if (!att) return 'Attachment';
    if (att.type === 'image') return '📷 Image';
    if (att.type === 'video') return '🎬 Video';
    if (att.type === 'audio') return '🎵 Audio';
    if (att.type === 'file') return '📄 ' + (att.name || 'File');
    return '📎 ' + (att.name || 'Attachment');
  }

  function _db() { return (window.App && window.App.db) ? window.App.db : null; }

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
      const timeStr = _fmtTime(ts);
      const attachment = currentThreadMessageData.attachment;
      const renderMsg = window.renderMessageText || function (t) { return _esc(t); };
      parentEl.innerHTML = `
        <div class="thread-parent-bubble">
          <div class="thread-parent-header">
            <span class="thread-parent-sender">${_esc(senderName)}</span>
            <span class="thread-parent-time">${_esc(timeStr)}</span>
          </div>
          ${text ? `<div class="thread-parent-text">${renderMsg(text, currentThreadMessageData.mentions || [])}</div>` : ""}
          ${attachment ? `<div class="thread-parent-attachment-label">${_esc(_attLabel(attachment))}</div>` : ""}
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

    const db = _db();
    if (!db) { container.innerHTML = '<div class="thread-error">Database not ready.</div>'; return; }

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
    const renderMsg = window.renderMessageText || function (t) { return _esc(t); };
    const renderAtt = window.renderAttachment || function () { return ''; };
    const sanitize = window.sanitizeHTML || function (s) { return s; };

    docs.forEach((doc) => {
      const msg = doc.data();
      const isMe = msg.senderId === (window.currentUser && window.currentUser.uid);
      const time = _fmtTime(msg.timestamp);

      const div = document.createElement("div");
      div.className = `thread-reply-item ${isMe ? "thread-reply-mine" : "thread-reply-theirs"}`;
      div.dataset.replyId = doc.id;

      div.innerHTML = `
        <div class="thread-reply-bubble">
          ${!isMe ? `<div class="thread-reply-sender">${sanitize(_esc(msg.senderName || "Unknown"))}</div>` : ""}
          ${msg.text ? `<div class="thread-reply-text">${renderMsg(msg.text, msg.mentions || [])}</div>` : ""}
          ${msg.attachment ? `<div class="thread-reply-attachment">${renderAtt(msg.attachment)}</div>` : ""}
          <div class="thread-reply-time">${_esc(time)}</div>
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

    const db = _db();
    if (!db) return;

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

      await db
        .collection("messages")
        .doc(currentThreadMessageId)
        .collection("threadReplies")
        .add(replyData);

      await db.collection("messages").doc(currentThreadMessageId).update({
        threadCount: firebase.firestore.FieldValue.increment(1),
        lastThreadAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastThreadSenderName: window.currentUser.displayName || window.currentUser.email || "User",
      });

      composer.value = "";
      composer.style.height = "auto";
    } catch (err) {
      console.error("Thread send error:", err);
      if (typeof showToast === "function") showToast("Could not send reply", "error");
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

    document.getElementById("threadSummaryCard")?.remove();

    try {
      const summarizeFn = firebase.functions().httpsCallable("summarizeThread", { timeout: 30000 });
      const result = await summarizeFn({ messageId: currentThreadMessageId });
      const summaryText = result.data?.summary || "No summary generated.";

      const lines = summaryText.split("\n").map(l => l.trim().replace(/^[-•*]\s*/, "")).filter(Boolean);
      const listHtml = lines.map(l => `<li>${_esc(l)}</li>`).join("");

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

  window.openThreadPanel = openThreadPanel;
  window.closeThreadPanel = closeThreadPanel;
  window.summarizeCurrentThread = summarizeCurrentThread;

  // Helper for context menu — looks up message data from App.messages
  window._openThreadForMsg = function (msgId) {
    try {
      const chatId = window.App && window.App.currentChat && window.App.currentChat.id;
      const msgs = (chatId && window.App.messages && window.App.messages[chatId]) || [];
      const msg = msgs.find(m => m.id === msgId);
      if (msg) {
        openThreadPanel(msgId, {
          senderName: msg.senderName || msg.senderName || '',
          text: msg.text || '',
          timestamp: msg.timestamp || msg.time || null,
          attachment: msg.attachment || null,
          mentions: msg.mentions || [],
          threadCount: msg.threadCount || 0
        });
      } else {
        openThreadPanel(msgId, {});
      }
    } catch (_) {
      openThreadPanel(msgId, {});
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupThreadPanel);
  } else {
    setupThreadPanel();
  }
})();
