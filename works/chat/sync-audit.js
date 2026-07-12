/* =============================================
   SYNC AUDIT v1.0  (#29 & #30)
   - Delivery marking on app startup
   - Tab / window visibility → mark as read
   - Network recovery → refresh listeners
   - Live receipt DOM update (no full re-render)
   - File download progress
   - Real-time stale-data prevention
   ============================================= */
(function () {
  'use strict';

  /* ================================================
     OFFLINE / RECONNECT BANNER
     Shows a yellow banner when network is lost,
     green banner briefly on reconnect, then auto-hides
     ================================================ */
  function setupNetworkBanner() {
    const banner = document.createElement('div');
    banner.id = 'tcOfflineBanner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    document.body.prepend(banner);

    let hideTimer = null;

    function showOffline() {
      clearTimeout(hideTimer);
      banner.textContent = '⚠ No internet connection — messages may not send or receive';
      banner.className = 'visible';
    }

    function showReconnected() {
      banner.textContent = '✓ Back online — syncing messages…';
      banner.className = 'visible reconnecting';
      hideTimer = setTimeout(() => {
        banner.className = '';
        // Re-trigger delivery marking on reconnect
        setTimeout(deliverUnreadOnStartup, 1000);
      }, 2500);
    }

    window.addEventListener('online',  showReconnected);
    window.addEventListener('offline', showOffline);

    if (!navigator.onLine) showOffline();
  }

  /* ================================================
     #29 — STARTUP DELIVERY
     When the app loads, mark all undelivered messages
     (sent to this user) as delivered across ALL chats
     ================================================ */
  let _deliveryRanOnce = false;

  async function deliverUnreadOnStartup() {
    const user = window.currentUser;
    const db   = window.db;
    if (!user || !db) return;
    if (_deliveryRanOnce) return;
    _deliveryRanOnce = true;

    try {
      // Get all direct chats this user is part of
      const chatsSnap = await db.collection('directChats')
        .where('members', 'array-contains', user.uid)
        .limit(50)
        .get();

      const chatIds = chatsSnap.docs.map(d => d.id);
      if (!chatIds.length) return;

      // Process chats in batches of 10 (Firestore 'in' limit)
      for (let i = 0; i < chatIds.length; i += 10) {
        const batchIds = chatIds.slice(i, i + 10);
        try {
          const msgsSnap = await db.collection('messages')
            .where('directId', 'in', batchIds)
            .where('senderId', '!=', user.uid)
            .limit(300)
            .get();

          const writeBatch = db.batch();
          let count = 0;

          msgsSnap.docs.forEach(doc => {
            const data = doc.data() || {};
            if (data.deliveredTo?.[user.uid]) return;
            if (data.deletedForEveryone) return;
            if (data.deletedFor?.[user.uid]) return;

            writeBatch.update(doc.ref, {
              [`deliveredTo.${user.uid}`]: firebase.firestore.FieldValue.serverTimestamp()
            });
            count++;
          });

          if (count > 0) await writeBatch.commit();
        } catch (e) {
          // Non-critical — skip this batch
        }
      }

      // Same for group chats
      const groupSnap = await db.collection('groupChats')
        .where('members', 'array-contains', user.uid)
        .limit(30)
        .get();

      const groupIds = groupSnap.docs.map(d => d.id);
      for (let i = 0; i < groupIds.length; i += 10) {
        const batchIds = groupIds.slice(i, i + 10);
        try {
          const msgsSnap = await db.collection('messages')
            .where('groupId', 'in', batchIds)
            .where('senderId', '!=', user.uid)
            .limit(200)
            .get();

          const writeBatch = db.batch();
          let count = 0;

          msgsSnap.docs.forEach(doc => {
            const data = doc.data() || {};
            if (data.deliveredTo?.[user.uid]) return;
            if (data.deletedForEveryone) return;
            if (data.deletedFor?.[user.uid]) return;

            writeBatch.update(doc.ref, {
              [`deliveredTo.${user.uid}`]: firebase.firestore.FieldValue.serverTimestamp()
            });
            count++;
          });

          if (count > 0) await writeBatch.commit();
        } catch (e) {
          // Non-critical
        }
      }
    } catch (e) {
      console.warn('[TC Sync] Startup delivery error:', e);
    }
  }

  /* ================================================
     #29 — TAB / WINDOW VISIBILITY → MARK AS READ
     When the user returns to the tab with a chat open,
     mark visible messages as read immediately
     ================================================ */
  function setupVisibilityMarkRead() {
    async function handleVisible() {
      if (document.visibilityState !== 'visible') return;
      const chat = window.currentChat;
      const user = window.currentUser;
      if (!chat || !user) return;

      // Only mark read if chat area is actually visible on screen
      const messagesArea = document.getElementById('messagesArea');
      if (!messagesArea) return;

      if (typeof window.markMessagesAsRead === 'function') {
        try { await window.markMessagesAsRead(); } catch (e) {}
      }
    }

    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleVisible);

    // Also mark read on scroll to bottom
    const area = document.getElementById('messagesArea');
    if (area) {
      let scrollTimer = null;
      area.addEventListener('scroll', function () {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(async function () {
          const atBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
          if (!atBottom) return;
          const user = window.currentUser;
          const chat = window.currentChat;
          if (!user || !chat) return;
          if (typeof window.markMessagesAsRead === 'function') {
            try { await window.markMessagesAsRead(); } catch (e) {}
          }
        }, 400);
      });
    }
  }

  /* ================================================
     #30 — LIVE RECEIPT DOM UPDATE
     Watch the messages area for receipt elements.
     When Firestore updates a message's readBy/deliveredTo,
     the onSnapshot re-renders the bubble. We add a pop
     animation so the user sees the receipt change live.
     ================================================ */
  function setupLiveReceiptAnimation() {
    const area = document.getElementById('messagesArea');
    if (!area) return;

    const seenReceipts = new Map(); // msgId → last class

    const obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          // Find receipt elements in added/changed nodes
          const receipts = node.querySelectorAll
            ? node.querySelectorAll('.read-receipt')
            : [];
          receipts.forEach(animateReceiptIfChanged);

          if (node.classList && node.classList.contains('read-receipt')) {
            animateReceiptIfChanged(node);
          }
        });
      });
    });

    obs.observe(area, { childList: true, subtree: true });

    function animateReceiptIfChanged(el) {
      const bubble = el.closest('[data-msg-id], .message-bubble-wrap, .message-row');
      const id = bubble ? (bubble.dataset.msgId || bubble.dataset.id || '') : '';
      const cls = el.className;
      const key = id + cls;
      if (seenReceipts.get(id) === cls) return;
      seenReceipts.set(id, cls);

      el.classList.add('just-updated');
      setTimeout(() => el.classList.remove('just-updated'), 400);
    }
  }

  /* ================================================
     #30 — NETWORK RECOVERY: REFRESH ON RECONNECT
     When the browser comes back online after being
     offline, re-subscribe to Firestore listeners so
     stale data is cleared
     ================================================ */
  function setupNetworkRecovery() {
    let wasOffline = false;

    window.addEventListener('offline', function () {
      wasOffline = true;
    });

    window.addEventListener('online', function () {
      if (!wasOffline) return;
      wasOffline = false;

      // Re-trigger chat list refresh if function exists
      setTimeout(function () {
        try {
          if (typeof window.loadCurrentChatList === 'function') {
            window.loadCurrentChatList();
          }
          // Re-open current chat to refresh messages
          if (window.currentChat && typeof window.openChat === 'function') {
            window.openChat(window.currentChat.id, window.currentChatType, window.currentChat);
          }
        } catch (e) {}
      }, 1500);
    });
  }

  /* ================================================
     #30 — DOWNLOAD PROGRESS INDICATOR
     Intercepts download link clicks and shows a slim
     progress bar below the file card using fetch + streams
     ================================================ */
  function setupDownloadProgress() {
    document.addEventListener('click', async function (e) {
      const link = e.target.closest('a[href][download], .file-attachment-card[href], .pdf-attachment-card[href]');
      if (!link) return;

      const url = link.getAttribute('href') || '';
      if (!url || !/^https?:\/\//i.test(url)) return;

      // Prevent default only if fetch + streams are supported
      if (!window.ReadableStream || !window.fetch) return;

      e.preventDefault();

      // Create or reuse progress bar
      let wrap = link.parentElement.querySelector('.tc-download-progress-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'tc-download-progress-wrap';
        wrap.innerHTML = '<div class="tc-download-progress-bar"></div>';
        link.parentElement.appendChild(wrap);
      }
      const bar = wrap.querySelector('.tc-download-progress-bar');
      if (bar) bar.style.width = '5%';

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Download failed');

        const total = Number(response.headers.get('Content-Length')) || 0;
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (total && bar) {
            bar.style.width = Math.min(95, Math.round((received / total) * 100)) + '%';
          }
        }

        if (bar) bar.style.width = '100%';

        // Merge chunks and trigger download
        const blob = new Blob(chunks);
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = link.dataset.filename
          || url.split('/').pop().split('?')[0]
          || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
        if (typeof showToast === 'function') showToast('File saved to Downloads', 'success');
      } catch (err) {
        console.warn('[TC Sync] Download error:', err);
        // Fallback to native download
        window.open(url, '_blank');
      } finally {
        setTimeout(() => {
          if (wrap && wrap.parentElement) wrap.remove();
        }, 800);
      }
    });
  }

  /* ================================================
     #30 — STALE DATA PREVENTION
     If a Firestore listener silently errors or stalls,
     refresh the messages listener every 5 minutes when
     the app is visible and a chat is open
     ================================================ */
  function setupListenerHealthCheck() {
    let lastMessageTime = Date.now();

    // Track incoming messages
    document.addEventListener('tc:message:received', function () {
      lastMessageTime = Date.now();
    });

    setInterval(function () {
      if (document.visibilityState !== 'visible') return;
      if (!window.currentChat || !window.currentUser) return;
      const stale = Date.now() - lastMessageTime > 5 * 60 * 1000;
      if (!stale) return;

      // Silently re-subscribe
      try {
        if (typeof window.listenToMessages === 'function') {
          window.listenToMessages();
          lastMessageTime = Date.now();
        }
      } catch (e) {}
    }, 5 * 60 * 1000);
  }

  /* ================================================
     WAIT FOR AUTH — run after Firebase auth resolves
     ================================================ */
  function waitForAuthAndRun() {
    if (!window.firebase || !window.firebase.auth) {
      setTimeout(waitForAuthAndRun, 500);
      return;
    }
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) return;
      // Small delay to let app-core finish its own init
      setTimeout(deliverUnreadOnStartup, 3000);
    });
  }

  /* ================================================
     INIT
     ================================================ */
  function init() {
    setupNetworkBanner();
    setupNetworkRecovery();
    setupLiveReceiptAnimation();
    setupDownloadProgress();
    setupListenerHealthCheck();

    // Visibility-based mark-read needs DOM ready
    if (document.getElementById('messagesArea')) {
      setupVisibilityMarkRead();
    } else {
      document.addEventListener('DOMContentLoaded', setupVisibilityMarkRead);
    }

    waitForAuthAndRun();
  }

  if (document.readyState === 'complete') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 0); });
  }
})();
