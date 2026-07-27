// ================================================================
// whatsapp-enhancements.js  v1
// WhatsApp-like improvements: Typing Indicators, Connection Status,
// Tab badge, Notification deduplication, Background reconnection.
// Injected AFTER app-init.js — reads global: db, auth, firebase,
// currentChat, currentChatType from app-core.js
// ================================================================
(function () {
  'use strict';

  // ── State ───────────────────────────────────────────────────────
  let _typingUnsubscribe = null;
  let _typingTimer = null;
  let _isTyping = false;
  let _lastChatKey = null;
  let _unreadCount = 0;
  const _originalTitle = document.title;
  const _notifiedIds = new Set();  // deduplication
  const _NOTIFIED_MAX = 500;
  const _cleanupFns = [];

  function _trackCleanup(fn) { _cleanupFns.push(fn); }

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

  // ================================================================
  function boot() {
    injectTypingUI();
    monitorChatSwitch();
    setupConnectionMonitor();
    setupTabBadge();
    setupPageVisibility();
    setupWindowBeforeUnload();
    if (window.__DEBUG__) console.log('[WA-Enhance] Typing indicators + WhatsApp improvements loaded');
  }

  // ── 2. TYPING INDICATOR UI INJECTION ────────────────────────────
  var _typingUiObs = null;

  function injectTypingUI() {
    function _inject() {
      if (document.getElementById('_wa_typing')) return;
      const inputArea = findInputArea();
      if (!inputArea) return;

      const banner = document.createElement('div');
      banner.id = '_wa_conn_banner';
      banner.setAttribute('role', 'alert');
      banner.setAttribute('aria-live', 'assertive');
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
      _typingUiObs = new MutationObserver(function () {
        if (!document.getElementById('_wa_typing')) _inject();
      });
      var chatPanel = findChatPanel();
      if (chatPanel) {
        _typingUiObs.observe(chatPanel, { childList: true, subtree: true });
      } else {
        _typingUiObs.observe(document.body, { childList: true, subtree: true });
      }
    }
  }

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

    textarea.addEventListener('input', App.debounce(() => {
      if (textarea.value.trim().length > 0) {
        startTyping();
      } else {
        stopTyping();
      }
    }, 300));
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
    let label;

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
    function _onCustomEvent(_e) {
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
    // Try event-based first; fall back to MutationObserver if no events fire within 2s
    var _eventFired = false;
    function _onAnyEvent() { _eventFired = true; }
    document.addEventListener('tc:chat:opened', _onAnyEvent);
    document.addEventListener('nsl:chat-opened', _onAnyEvent);
    setTimeout(function () {
      document.removeEventListener('tc:chat:opened', _onAnyEvent);
      document.removeEventListener('nsl:chat-opened', _onAnyEvent);
      if (!_eventFired) _startFallbackPoll();
    }, 2000);

    // Safety net: scoped MutationObserver (not body-level) for chat key changes
    var _safetyObs = null;
    var chatPanel = findChatPanel();
    if (chatPanel) {
      _safetyObs = new MutationObserver(function () {
        var key = getChatKey();
        if (key !== _lastChatKey) { _lastChatKey = key; _onChatSwitch(key); }
      });
      _safetyObs.observe(chatPanel, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-chat-id', 'class'] });
    }
    _trackCleanup(function () {
      if (_safetyObs) _safetyObs.disconnect();
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
    let _isOnline = navigator.onLine;

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
      _isOnline = true;
      clearTimeout(offlineTimer);
      updateBanner('reconnecting');
      setTimeout(() => updateBanner(''), 2000);
    }
    function _onOffline() {
      _isOnline = false;
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
      var chatPanel = findChatPanel();
      var observeTarget = chatPanel || document.body;
      badgeObs.observe(observeTarget, { childList: true, subtree: true, characterData: true });
      _trackCleanup(function () { badgeObs.disconnect(); });
    }
  }

  function updateTabTitle() {
    if (_unreadCount > 0) {
      document.title = `(${_unreadCount > 99 ? '99+' : _unreadCount}) ${_originalTitle}`;
    } else {
      document.title = _originalTitle;
    }
    if (navigator.setAppBadge) {
      try {
        if (_unreadCount > 0) navigator.setAppBadge(_unreadCount).catch(function() {});
        else navigator.clearAppBadge().catch(function() {});
      } catch (_) {}
    } else if (navigator.mSetAppBadge) {
      try {
        if (_unreadCount > 0) navigator.mSetAppBadge(_unreadCount);
        else navigator.mClearAppBadge();
      } catch (_) {}
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
