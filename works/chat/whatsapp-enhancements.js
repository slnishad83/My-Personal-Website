// ================================================================
// whatsapp-enhancements.js  v1
// WhatsApp-like improvements: Typing Indicators, Connection Status,
// Tab badge, Notification deduplication, Background reconnection.
// Injected AFTER app-init.js — reads global: db, auth, firebase,
// currentChat, currentChatType from app-core.js
// ================================================================
(function () {
  'use strict';

  // ── Wait for core app to be ready ──────────────────────────────
  let _readyTrials = 0;
  function waitForApp(cb) {
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && typeof firebase !== 'undefined') {
      cb();
    } else if (_readyTrials++ < 100) {
      setTimeout(() => waitForApp(cb), 150);
    }
  }
  waitForApp(boot);

  // ── State ───────────────────────────────────────────────────────
  let _typingUnsubscribe = null;
  let _typingTimer = null;
  let _isTyping = false;
  let _lastChatKey = null;
  let _unreadCount = 0;
  const _originalTitle = document.title;
  const _notifiedIds = new Set();  // deduplication
  const _cleanupFns = [];

  function _trackCleanup(fn) { _cleanupFns.push(fn); }

  // ================================================================
  function boot() {
    injectStyles();
    injectTypingUI();
    monitorChatSwitch();
    setupConnectionMonitor();
    setupTabBadge();
    setupPageVisibility();
    setupWindowBeforeUnload();
    console.log('[WA-Enhance] Typing indicators + WhatsApp improvements loaded');
  }

  // ── 1. STYLES ────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('_wa_style')) return;
    const s = document.createElement('style');
    s.id = '_wa_style';
    s.textContent = `
      /* ── Typing Indicator ────────────────────────────── */
      #_wa_typing {
        height: 22px;
        padding: 0 16px;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--wa-typing-color, #008069);
        font-style: italic;
        font-weight: 500;
        transition: opacity 0.25s;
        opacity: 0;
        pointer-events: none;
        user-select: none;
        flex-shrink: 0;
        line-height: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      #_wa_typing.visible { opacity: 1; }

      /* Animated dots */
      #_wa_typing .wa-dots {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        flex-shrink: 0;
      }
      #_wa_typing .wa-dots span {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: currentColor;
        animation: _waTypingBounce 1.2s infinite ease-in-out;
      }
      #_wa_typing .wa-dots span:nth-child(1) { animation-delay: 0s; }
      #_wa_typing .wa-dots span:nth-child(2) { animation-delay: 0.2s; }
      #_wa_typing .wa-dots span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes _waTypingBounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-4px); opacity: 1; }
      }

      /* ── Connection Status Banner ────────────────────── */
      #_wa_conn_banner {
        display: none;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 7px 16px;
        font-size: 12px;
        font-weight: 600;
        font-style: normal;
        flex-shrink: 0;
        z-index: 100;
      }
      #_wa_conn_banner.offline {
        display: flex;
        background: #fef3c7;
        color: #92400e;
        border-bottom: 1px solid #fde68a;
      }
      #_wa_conn_banner.reconnecting {
        display: flex;
        background: #e0f2fe;
        color: #0369a1;
        border-bottom: 1px solid #bae6fd;
      }
      #_wa_conn_banner .conn-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: currentColor;
        animation: _waPulse 1.2s infinite;
      }
      @keyframes _waPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      /* ── Dark mode overrides ─────────────────────────── */
      [data-theme="dark"] #_wa_typing,
      .dark #_wa_typing,
      body.dark-mode #_wa_typing {
        --wa-typing-color: #25d366;
      }
      [data-theme="dark"] #_wa_conn_banner.offline,
      .dark #_wa_conn_banner.offline {
        background: #44380a;
        color: #fcd34d;
        border-color: #6b4f0a;
      }
    `;
    document.head.appendChild(s);
  }

  // ── 2. TYPING INDICATOR UI INJECTION ────────────────────────────
  function injectTypingUI() {
    function _inject() {
      if (document.getElementById('_wa_typing')) return;
      const inputArea = findInputArea();
      if (!inputArea) return;

      const banner = document.createElement('div');
      banner.id = '_wa_conn_banner';
      banner.innerHTML = '<div class="conn-dot"></div><span>Checking connection…</span>';
      const chatPanel = findChatPanel();
      if (chatPanel) chatPanel.prepend(banner);

      const typingEl = document.createElement('div');
      typingEl.id = '_wa_typing';
      typingEl.innerHTML = '<div class="wa-dots"><span></span><span></span><span></span></div><span class="wa-typing-text"></span>';
      inputArea.parentNode.insertBefore(typingEl, inputArea);

      hookInputTyping();
      if (window.MutationBus) MutationBus.off('wa:typing-ui');
      else if (_typingUiObs) { _typingUiObs.disconnect(); _typingUiObs = null; }
    }

    if (window.MutationBus) {
      MutationBus.onBodyChildList('wa:typing-ui', function (added) {
        for (var i = 0; i < added.length; i++) { _inject(); if (document.getElementById('_wa_typing')) return; }
      });
    } else {
      _typingUiObs = new MutationObserver(_inject);
      _typingUiObs.observe(document.body, { childList: true, subtree: true });
    }
  }
  var _typingUiObs = null;

  function findInputArea() {
    const selectors = [
      '.message-input-area', '#messageInputArea', '.chat-input',
      '#chatInput', '.input-area', '[class*="input-area"]',
      '[class*="message-input"]', '[class*="chat-footer"]',
      '.footer', '#footer', '.chat-footer', '#chatFooter'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    // Fallback: find by textarea
    const ta = document.querySelector('textarea[placeholder*="message"], textarea[placeholder*="type"], textarea[placeholder*="Type"], #messageInput');
    return ta ? ta.closest('div') : null;
  }

  function findChatPanel() {
    const selectors = ['.chat-panel', '#chatPanel', '.chat-window', '#chatWindow', '.main-chat', '#mainChat', '[class*="chat-panel"]'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // ── 3. HOOK MESSAGE INPUT FOR OUTGOING TYPING STATUS ────────────
  function hookInputTyping() {
    const textarea = document.querySelector(
      'textarea[placeholder*="message"], textarea[placeholder*="type"], textarea[placeholder*="Type"], #messageInput, .message-input, [id*="msgInput"], [id*="messageInput"]'
    );
    if (!textarea || textarea.dataset.waTypingHooked) return;
    textarea.dataset.waTypingHooked = '1';

    textarea.addEventListener('input', () => {
      if (textarea.value.trim().length > 0) {
        startTyping();
      } else {
        stopTyping();
      }
    });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) stopTyping();
    });
    textarea.addEventListener('blur', stopTyping);
  }

  // ── 4. OUTGOING TYPING STATUS (write to Firestore) ──────────────
  function startTyping() {
    const key = getChatKey();
    if (!key || !auth.currentUser) return;

    // Debounce: reset 5-second auto-stop timer
    clearTimeout(_typingTimer);
    _typingTimer = setTimeout(stopTyping, 5000);

    if (_isTyping && key === _lastChatKey) return; // already flagged
    _isTyping = true;
    _lastChatKey = key;

    const user = auth.currentUser;
    const displayName = user.displayName || getUserDisplayName() || user.email?.split('@')[0] || 'Someone';
    db.collection('typingStatus').doc(key).set(
      { [user.uid]: { name: displayName, at: firebase.firestore.FieldValue.serverTimestamp() } },
      { merge: true }
    ).catch(() => {});
  }

  function stopTyping() {
    clearTimeout(_typingTimer);
    if (!_isTyping) return;
    _isTyping = false;
    const key = _lastChatKey || getChatKey();
    if (!key || !auth.currentUser) return;
    db.collection('typingStatus').doc(key).update(
      { [auth.currentUser.uid]: firebase.firestore.FieldValue.delete() }
    ).catch(() => {});
  }

  function getUserDisplayName() {
    // Try to get from the DOM header (common pattern in chat apps)
    const nameEl = document.querySelector('.current-user-name, #currentUserName, [class*="user-name"]');
    return nameEl?.textContent?.trim() || null;
  }

  // ── 5. INCOMING TYPING STATUS LISTENER ─────────────────────────
  function listenTyping(chatKey) {
    if (_typingUnsubscribe) { _typingUnsubscribe(); _typingUnsubscribe = null; }
    if (!chatKey) { setTypingText([]); return; }

    _typingUnsubscribe = db.collection('typingStatus').doc(chatKey).onSnapshot(snap => {
      if (!snap.exists) { setTypingText([]); return; }
      const data = snap.data() || {};
      const myUid = auth.currentUser?.uid;
      const now = Date.now();
      // Filter: exclude self, exclude stale entries (older than 8 seconds)
      const typers = Object.entries(data)
        .filter(([uid, v]) => {
          if (uid === myUid) return false;
          if (!v || !v.at) return true; // include if no timestamp (serverTimestamp may not yet be set)
          const ms = v.at.toMillis ? v.at.toMillis() : (v.at.seconds * 1000);
          return (now - ms) < 8000;
        })
        .map(([, v]) => v.name || 'Someone');
      setTypingText(typers, chatKey);
    }, () => { setTypingText([]); });
  }

  function setTypingText(typers, chatKey) {
    const el = document.getElementById('_wa_typing');
    const textEl = el?.querySelector('.wa-typing-text');
    if (!el || !textEl) return;

    if (!typers || typers.length === 0) {
      el.classList.remove('visible');
      textEl.textContent = '';
      return;
    }

    // Determine if this is a direct (personal) or group chat
    const isGroup = chatKey ? chatKey.startsWith('group:') : (typeof currentChatType !== 'undefined' && currentChatType === 'group');
    let label = '';

    if (isGroup) {
      // Group: show names
      if (typers.length === 1) {
        label = `${typers[0]} is typing`;
      } else if (typers.length === 2) {
        label = `${typers[0]} and ${typers[1]} are typing`;
      } else {
        label = `${typers[0]} and ${typers.length - 1} others are typing`;
      }
    } else {
      // Direct (personal): no name, just "typing..."
      label = 'typing';
    }

    textEl.textContent = label;
    el.classList.add('visible');
  }

  // ── 6. MONITOR CHAT SWITCHES (re-subscribe typing on chat change) ─
  function monitorChatSwitch() {
    function _onChatSwitch(key) {
      stopTyping();
      _isTyping = false;
      listenTyping(key);
      setTimeout(hookInputTyping, 300);
      setTimeout(hookInputTyping, 1000);
    }

    // Prefer custom events from the app (tc:chat:opened, nsl:chat-opened)
    function _onCustomEvent(e) {
      var key = getChatKey();
      if (key !== _lastChatKey) { _lastChatKey = key; _onChatSwitch(key); }
    }
    document.addEventListener('tc:chat:opened', _onCustomEvent);
    document.addEventListener('nsl:chat-opened', _onCustomEvent);
    _trackCleanup(function () {
      document.removeEventListener('tc:chat:opened', _onCustomEvent);
      document.removeEventListener('nsl:chat-opened', _onCustomEvent);
    });

    // Fallback: MutationObserver on chat header area for apps that don't fire events
    var _pollFallback = null;
    var _lastKey = null;
    function _startFallbackPoll() {
      var chatPanel = findChatPanel();
      if (!chatPanel) return;
      _pollFallback = new MutationObserver(function () {
        var key = getChatKey();
        if (key !== _lastKey) { _lastKey = key; _onChatSwitch(key); }
      });
      _pollFallback.observe(chatPanel, { childList: true, subtree: true });
    }
    // Try event-based first; fall back to observer if no events fire within 2s
    var _eventFired = false;
    function _onAnyEvent() { _eventFired = true; }
    document.addEventListener('tc:chat:opened', _onAnyEvent);
    document.addEventListener('nsl:chat-opened', _onAnyEvent);
    setTimeout(function () {
      document.removeEventListener('tc:chat:opened', _onAnyEvent);
      document.removeEventListener('nsl:chat-opened', _onAnyEvent);
      if (!_eventFired) _startFallbackPoll();
    }, 2000);

    // Also poll every 5s (much less aggressive than 400ms) as a safety net
    var _safetyPoll = setInterval(function () {
      var key = getChatKey();
      if (key !== _lastChatKey) { _lastChatKey = key; _onChatSwitch(key); }
    }, 5000);
    _trackCleanup(function () {
      clearInterval(_safetyPoll);
      if (_pollFallback) _pollFallback.disconnect();
    });
  }

  function getChatKey() {
    try {
      // Use the app's own getCurrentChatKey if available
      if (typeof getCurrentChatKey === 'function') {
        return getCurrentChatKey();
      }
      const chat = (typeof currentChat !== 'undefined') ? currentChat : null;
      const type = (typeof currentChatType !== 'undefined') ? currentChatType : null;
      if (!chat || !type) return null;
      return `${type}:${chat.id}`;
    } catch (_) { return null; }
  }

  // ── 7. CONNECTION STATUS MONITOR ─────────────────────────────────
  function setupConnectionMonitor() {
    let offlineTimer = null;
    let isOnline = navigator.onLine;

    function updateBanner(state) {
      const banner = document.getElementById('_wa_conn_banner');
      if (!banner) return;
      banner.className = '';
      if (state === 'offline') {
        banner.className = 'offline';
        banner.innerHTML = '⚠️ <span>No internet connection</span>';
      } else if (state === 'reconnecting') {
        banner.className = 'reconnecting';
        banner.innerHTML = '<div class="conn-dot"></div><span>Reconnecting…</span>';
      }
    }

    function _onOnline() {
      isOnline = true;
      clearTimeout(offlineTimer);
      updateBanner('reconnecting');
      setTimeout(() => updateBanner(''), 2000);
    }
    function _onOffline() {
      isOnline = false;
      offlineTimer = setTimeout(() => updateBanner('offline'), 500);
    }

    window.addEventListener('online', _onOnline);
    window.addEventListener('offline', _onOffline);
    _trackCleanup(function () {
      window.removeEventListener('online', _onOnline);
      window.removeEventListener('offline', _onOffline);
      clearTimeout(offlineTimer);
    });

    if (!navigator.onLine) updateBanner('offline');
  }

  // ── 8. TAB BADGE (unread count in title) ─────────────────────────
  function setupTabBadge() {
    function _onUnreadEvent(e) {
      _unreadCount = e.detail?.count || 0;
      updateTabTitle();
    }
    window.addEventListener('wa-unread-update', _onUnreadEvent);
    _trackCleanup(function () { window.removeEventListener('wa-unread-update', _onUnreadEvent); });

    function _scanBadges() {
      const badges = document.querySelectorAll('.unread-count, .unread-badge, [class*="unread-count"], [class*="badge-count"]');
      let total = 0;
      badges.forEach(b => {
        const n = parseInt(b.textContent, 10);
        if (!isNaN(n) && b.offsetParent !== null) total += n;
      });
      if (total !== _unreadCount) {
        _unreadCount = total;
        updateTabTitle();
      }
    }

    if (window.MutationBus) {
      MutationBus.onBodyChildList('wa:tab-badge', _scanBadges);
    } else {
      var badgeObs = new MutationObserver(_scanBadges);
      badgeObs.observe(document.body, { childList: true, subtree: true, characterData: true });
      _trackCleanup(function () { badgeObs.disconnect(); });
    }
  }

  function updateTabTitle() {
    if (_unreadCount > 0) {
      document.title = `(${_unreadCount > 99 ? '99+' : _unreadCount}) ${_originalTitle}`;
    } else {
      document.title = _originalTitle;
    }
    // Update PWA badge if supported
    if (navigator.setAppBadge) {
      if (_unreadCount > 0) navigator.setAppBadge(_unreadCount).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }
  }

  // ── 9. PAGE VISIBILITY (mark read / stop typing) ────────────────
  function setupPageVisibility() {
    function _onVisibilityChange() {
      if (document.hidden) {
        stopTyping();
      } else {
        _unreadCount = 0;
        updateTabTitle();
      }
    }
    document.addEventListener('visibilitychange', _onVisibilityChange);
    _trackCleanup(function () { document.removeEventListener('visibilitychange', _onVisibilityChange); });
  }

  // ── 10. CLEANUP ON WINDOW UNLOAD ────────────────────────────────
  function setupWindowBeforeUnload() {
    function _onUnload() { stopTyping(); }
    window.addEventListener('beforeunload', _onUnload);
    window.addEventListener('pagehide', _onUnload);
    _trackCleanup(function () {
      window.removeEventListener('beforeunload', _onUnload);
      window.removeEventListener('pagehide', _onUnload);
    });
  }

  // ── 11. DESTROY (logout cleanup) ──────────────────────────────
  function destroy() {
    stopTyping();
    if (_typingUnsubscribe) { _typingUnsubscribe(); _typingUnsubscribe = null; }
    if (_typingUiObs) { _typingUiObs.disconnect(); _typingUiObs = null; }
    if (window.MutationBus) {
      MutationBus.off('wa:typing-ui');
      MutationBus.off('wa:tab-badge');
    }
    _cleanupFns.forEach(function (fn) { try { fn(); } catch (e) {} });
    _cleanupFns.length = 0;
    _notifiedIds.clear();
    document.title = _originalTitle;
  }

  window.WAEnhance = { destroy: destroy };

})();
