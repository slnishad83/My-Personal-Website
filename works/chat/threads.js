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
  let threadTypingUnsubscribe = null;
  let threadTypingDebounceTimer = null;
  let threadTypingIndicator = null;
  const THREAD_TYPING_DEBOUNCE_MS = 3000;

  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

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

  var _db = function() { return App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };

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

    // Start listening for typing indicators
    subscribeToThreadTyping(messageId);

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
    cleanupThreadTyping();
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

    container.innerHTML = `
      <div class="thread-skeleton">
        <div class="thread-skeleton-card thread-skeleton-mine">
          <div class="thread-skeleton-bubble"><div class="thread-skeleton-line" style="width:60%"></div><div class="thread-skeleton-line" style="width:85%"></div></div>
        </div>
        <div class="thread-skeleton-card thread-skeleton-theirs">
          <div class="thread-skeleton-avatar"></div>
          <div class="thread-skeleton-bubble"><div class="thread-skeleton-line" style="width:45%"></div><div class="thread-skeleton-line" style="width:70%"></div><div class="thread-skeleton-line" style="width:30%"></div></div>
        </div>
        <div class="thread-skeleton-card thread-skeleton-mine">
          <div class="thread-skeleton-bubble"><div class="thread-skeleton-line" style="width:75%"></div></div>
        </div>
      </div>`;

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
            container.innerHTML = `
              <div class="thread-empty">
                <div class="thread-empty-icon">&#x1F4AC;</div>
                <div class="thread-empty-heading">Start the conversation</div>
                <div class="thread-empty-desc">Reply to this thread to join the discussion</div>
              </div>`;
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
      const replyId = doc.id;

      // Render reactions
      let reactionsHtml = '';
      const reactions = msg.reactions || {};
      const emojiKeys = Object.keys(reactions);
      if (emojiKeys.length) {
        reactionsHtml = '<div class="flex flex-wrap gap-1 mt-1">';
        emojiKeys.forEach(emoji => {
          const users = reactions[emoji] || [];
          const hasReacted = users.includes(window.currentUser?.uid);
          reactionsHtml += `<button class="thread-reply-reaction px-1.5 py-0.5 rounded-full text-[11px] border cursor-pointer transition-all ${hasReacted ? 'bg-primary/15 border-primary text-primary' : 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'}" data-parent="${_esc(currentThreadMessageId)}" data-reply="${_esc(replyId)}" data-emoji="${_esc(emoji)}">${emoji} <span class="text-[9px] font-bold">${users.length}</span></button>`;
        });
        reactionsHtml += '</div>';
      }

      const div = document.createElement("div");
      div.className = `thread-reply-item ${isMe ? "thread-reply-mine" : "thread-reply-theirs"}`;
      div.dataset.replyId = replyId;

      div.innerHTML = `
        <div class="thread-reply-bubble" data-parent="${_esc(currentThreadMessageId)}" data-reply="${_esc(replyId)}">
          ${!isMe ? `<div class="thread-reply-sender">${sanitize(_esc(msg.senderName || "Unknown"))}</div>` : ""}
          ${msg.text ? `<div class="thread-reply-text">${renderMsg(msg.text, msg.mentions || [])}</div>` : ""}
          ${msg.attachment ? `<div class="thread-reply-attachment">${renderAtt(msg.attachment)}</div>` : ""}
          <div class="thread-reply-time">${_esc(time)}</div>
        </div>
        ${reactionsHtml}
      `;
      container.appendChild(div);
    });

    if (wasAtBottom) container.scrollTop = container.scrollHeight;
  }

  // ── Thread Reply Reactions ────────────────────────────────────────────────
  const THREAD_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  window._showThreadReactionPicker = function (event, parentMsgId, replyId) {
    // Remove any existing picker
    document.getElementById('_thread-reaction-picker')?.remove();

    const picker = document.createElement('div');
    picker.id = '_thread-reaction-picker';
    picker.style.cssText = 'position:fixed;z-index:99999;background:var(--surface-container,#fff);border:1px solid var(--outline-variant,#ddd);border-radius:24px;padding:6px 8px;display:flex;gap:2px;box-shadow:0 4px 20px rgba(0,0,0,0.25);animation:ctxFadeIn 0.12s ease;';

    THREAD_REACTION_EMOJIS.forEach(emoji => {
      const btn = document.createElement('button');
      btn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:4px 6px;border-radius:8px;transition:transform 0.15s;';
      btn.textContent = emoji;
      btn.onmouseenter = () => btn.style.transform = 'scale(1.3)';
      btn.onmouseleave = () => btn.style.transform = 'scale(1)';
      btn.onclick = (e) => {
        e.stopPropagation();
        picker.remove();
        window._toggleThreadReaction(parentMsgId, replyId, emoji);
      };
      picker.appendChild(btn);
    });

    document.body.appendChild(picker);

    const rect = picker.getBoundingClientRect();
    const x = Math.min(event.clientX || event.pageX || 0, window.innerWidth - rect.width - 10);
    const y = Math.min((event.clientY || event.pageY || 0) - rect.height - 8, window.innerHeight - rect.height - 10);
    picker.style.left = Math.max(10, x) + 'px';
    picker.style.top = Math.max(10, y) + 'px';

    setTimeout(() => {
      const close = (e) => { if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', close); } };
      document.addEventListener('click', close, { once: true });
    }, 10);
  };

  window._toggleThreadReaction = async function (parentMsgId, replyId, emoji) {
    const db = _db();
    if (!db || !window.currentUser) return;
    const uid = window.currentUser.uid;

    try {
      const replyRef = db.collection("messages").doc(parentMsgId).collection("threadReplies").doc(replyId);
      const snap = await replyRef.get();
      if (!snap.exists) return;
      const data = snap.data();
      const reactions = data.reactions || {};
      const users = reactions[emoji] || [];

      if (users.includes(uid)) {
        users.splice(users.indexOf(uid), 1);
        if (users.length === 0) delete reactions[emoji];
        else reactions[emoji] = users;
      } else {
        reactions[emoji] = [...users, uid];
      }

      await replyRef.update({ reactions });
    } catch (err) {
      console.error("Thread reaction error:", err);
    }
  };

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

      const batch = db.batch();
      const replyRef = db
        .collection("messages")
        .doc(currentThreadMessageId)
        .collection("threadReplies")
        .doc();
      batch.set(replyRef, replyData);

      const parentRef = db.collection("messages").doc(currentThreadMessageId);
      batch.update(parentRef, {
        threadCount: firebase.firestore.FieldValue.increment(1),
        lastThreadAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastThreadSenderName: window.currentUser.displayName || window.currentUser.email || "User",
      });

      await batch.commit();

      composer.value = "";
      composer.style.height = "auto";
      if (threadTypingDebounceTimer) {
        clearTimeout(threadTypingDebounceTimer);
        threadTypingDebounceTimer = null;
      }
      updateThreadTypingStatus(false);
    } catch (err) {
      console.error("Thread send error:", err);
      if (typeof showToast === "function") showToast("Could not send reply", "error");
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      composer.disabled = false;
      composer.focus();
    }
  }

  // ── Thread Typing Indicator ───────────────────────────────────────────────

  function _getTypingDocId(uid, messageId) {
    return uid + '_' + messageId;
  }

  function _ensureTypingIndicatorEl() {
    if (threadTypingIndicator) return threadTypingIndicator;
    const composer = document.getElementById('threadComposer');
    if (!composer) return null;
    const el = document.createElement('div');
    el.className = 'thread-typing-indicator';
    el.style.display = 'none';
    composer.parentNode.insertBefore(el, composer);
    threadTypingIndicator = el;
    return el;
  }

  async function updateThreadTypingStatus(isTyping) {
    if (!currentThreadMessageId || !window.currentUser) return;
    const db = _db();
    if (!db) return;

    const uid = window.currentUser.uid;
    const docId = _getTypingDocId(uid, currentThreadMessageId);
    const ref = db.collection('typingStatus').doc(docId);

    try {
      if (isTyping) {
        await ref.set({
          userId: uid,
          userName: window.currentUser.displayName || window.currentUser.email || 'User',
          messageId: currentThreadMessageId,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await ref.delete().catch(function () {});
      }
    } catch (err) {
      console.error('[threadTyping] write error', err);
    }
  }

  function handleThreadComposerTyping() {
    updateThreadTypingStatus(true);

    if (threadTypingDebounceTimer) clearTimeout(threadTypingDebounceTimer);
    threadTypingDebounceTimer = setTimeout(function () {
      updateThreadTypingStatus(false);
    }, THREAD_TYPING_DEBOUNCE_MS);
  }

  function subscribeToThreadTyping(messageId) {
    cleanupThreadTyping();

    const db = _db();
    if (!db) return;

    threadTypingUnsubscribe = db
      .collection('typingStatus')
      .where('messageId', '==', messageId)
      .onSnapshot(function (snapshot) {
        const el = _ensureTypingIndicatorEl();
        if (!el) return;

        const myUid = window.currentUser && window.currentUser.uid;
        var typingUsers = [];

        snapshot.forEach(function (doc) {
          var data = doc.data();
          if (data.userId === myUid) return;
          if (data.timestamp) {
            var ts = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
            var age = Date.now() - ts.getTime();
            if (age > THREAD_TYPING_DEBOUNCE_MS + 1000) return;
          }
          typingUsers.push(data.userName || 'Someone');
        });

        if (typingUsers.length === 0) {
          el.style.display = 'none';
          el.innerHTML = '';
        } else {
          var label = typingUsers.length === 1
            ? _esc(typingUsers[0]) + ' is typing'
            : _esc(typingUsers.join(', ')) + ' are typing';
          el.innerHTML =
            '<span class="thread-typing-name">' + label + '</span>' +
            '<span class="thread-typing-dots"><span></span><span></span><span></span></span>';
          el.style.display = '';
        }
      }, function (err) {
        console.error('[threadTyping] listener error', err);
      });
  }

  function cleanupThreadTyping() {
    if (threadTypingUnsubscribe) {
      threadTypingUnsubscribe();
      threadTypingUnsubscribe = null;
    }
    if (threadTypingDebounceTimer) {
      clearTimeout(threadTypingDebounceTimer);
      threadTypingDebounceTimer = null;
    }
    updateThreadTypingStatus(false);
    if (threadTypingIndicator) {
      threadTypingIndicator.style.display = 'none';
      threadTypingIndicator.innerHTML = '';
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
    if (repliesList) repliesList.addEventListener('click', (e) => {
      const btn = e.target.closest('.thread-reply-reaction[data-parent]');
      if (!btn) return;
      e.stopPropagation();
      window._toggleThreadReaction(btn.dataset.parent, btn.dataset.reply, btn.dataset.emoji);
    });
    if (repliesList) repliesList.addEventListener('dblclick', (e) => {
      const bubble = e.target.closest('.thread-reply-bubble[data-parent]');
      if (!bubble) return;
      e.stopPropagation();
      window._showThreadReactionPicker(e, bubble.dataset.parent, bubble.dataset.reply);
    });
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
        handleThreadComposerTyping();
      });
    }

    // Swipe-to-close on mobile
    const panel = document.getElementById("threadPanel");
    if (panel) {
      let swipeStartX = 0;
      let swipeStartY = 0;
      let swiping = false;

      panel.addEventListener("touchstart", (e) => {
        const touch = e.touches[0];
        const panelWidth = panel.offsetWidth;
        if (touch.clientX > panelWidth * 0.7) {
          swipeStartX = touch.clientX;
          swipeStartY = touch.clientY;
          swiping = true;
          panel.classList.add("thread-swipe-active");
        }
      }, { passive: true });

      panel.addEventListener("touchmove", (e) => {
        if (!swiping) return;
        const dx = e.touches[0].clientX - swipeStartX;
        const dy = Math.abs(e.touches[0].clientY - swipeStartY);
        if (dy > 40) { swiping = false; panel.classList.remove("thread-swipe-active"); panel.style.transform = ""; return; }
        if (dx < 0) {
          panel.style.transform = "translateX(" + Math.max(dx, -panel.offsetWidth) + "px)";
        }
      }, { passive: true });

      panel.addEventListener("touchend", (e) => {
        if (!swiping) return;
        swiping = false;
        const endX = e.changedTouches[0] ? e.changedTouches[0].clientX : swipeStartX;
        const dx = endX - swipeStartX;
        panel.style.transform = "";
        panel.classList.remove("thread-swipe-active");
        if (dx < -80) closeThreadPanel();
      }, { passive: true });
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
