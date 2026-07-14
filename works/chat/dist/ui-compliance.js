/* =============================================
   UI COMPLIANCE v1.1
   Items #7-14: Runtime fixes for responsive
   compliance, install card placement, scroll
   validation, modal z-index, interaction audit.
   ── v1.1: MutationBus + named handlers + destroy()
   ============================================= */
(function () {
  'use strict';

  var _destroyFns = [];     // cleanup functions for logout
  var _btnObservers = [];   // per-button attribute observers

  /* ─── helpers ────────────────────────────────────────────────── */
  function _trackCleanup(fn) { _destroyFns.push(fn); }

  /* ─── #8 Move mobile-install-card to bottom of sidebar ─────── */
  function fixInstallCardPlacement() {
    const card   = document.querySelector('.mobile-install-card');
    const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
    if (!card || !sidebar) return;
    if (card.parentElement === sidebar && sidebar.lastElementChild === card) return;
    sidebar.appendChild(card);
    card.style.display = '';
  }

  /* ─── #10 Universal scrolling: validate all containers ──────── */
  function fixScrollContainers() {
    const selectors = [
      '#chatList', '.chat-list', '#chatMessages', '.messages-area', '#messagesArea',
      '#requestList', '.request-list', '#archiveList', '.archive-list',
      '#pinnedMessagesList', '.pinned-messages-list', '.modal-body', '.modal-content',
      '.settings-body', '#settingsBody', '.emoji-picker', '.context-menu',
      '#globalSearchResults', '.ms-results-container', '.gmi-body'
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.overflowY === 'visible' || style.overflowY === 'hidden') {
          if (el.scrollHeight > el.clientHeight + 4) {
            el.style.overflowY = 'auto';
          }
        }
        el.style.webkitOverflowScrolling = 'touch';
      });
    });
  }

  /* ─── #9 Clamp context menus / dropdowns to viewport ────────── */
  function clampMenuToViewport(menu) {
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const vpW  = window.innerWidth;
    const vpH  = window.innerHeight;
    let { left, top } = menu.style;
    left = parseFloat(left) || 0;
    top  = parseFloat(top)  || 0;
    if (rect.right  > vpW - 8)  { menu.style.left = Math.max(8, vpW - rect.width  - 8) + 'px'; }
    if (rect.bottom > vpH - 8)  { menu.style.top  = Math.max(8, vpH - rect.height - 8) + 'px'; }
    if (rect.left   < 8)        { menu.style.left = '8px'; }
    if (rect.top    < 8)        { menu.style.top  = '8px'; }
  }

  /* ─── #11 Fix any icon-btn that has no aria-label ────────────── */
  function fixAriaLabels() {
    const map = {
      'darkModeBtn'   : 'Toggle dark mode',
      'logoutBtn'     : 'Log out',
      'scannerBtn'    : 'Scan QR code',
      'voiceCallBtn'  : 'Voice call',
      'videoCallBtn'  : 'Video call',
      'searchChatBtn' : 'Search in chat',
      'groupInfoBtn'  : 'Group info',
      'wallpaperBtn'  : 'Change wallpaper',
      'selectModeBtn' : 'Select messages',
      'chatMoreBtn'   : 'More options',
      'mobileMenuBtn' : 'Back to chats',
      'installAppBtn' : 'Install app',
      'msGlobalSearchBtn' : 'Search all messages'
    };
    Object.entries(map).forEach(([id, label]) => {
      const el = document.getElementById(id);
      if (el && !el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
    });
  }

  /* ─── #12 Interaction audit: right-click → context menu on mobile ─ */
  function fixContextMenuTrigger() {
    function _onContextMenu(e) {
      const msg = e.target.closest('.message-bubble,.msg-bubble,.message-row,.message-item');
      if (!msg) return;
      if ('ontouchstart' in window) e.preventDefault();
    }
    document.addEventListener('contextmenu', _onContextMenu);
    _trackCleanup(function () { document.removeEventListener('contextmenu', _onContextMenu); });
  }

  /* ─── #12 Fix button double-fire on iOS (click + touchend) ──── */
  function fixDoubleFire() {
    if (!('ontouchstart' in window)) return;
    var lastTouchEnd = 0;
    function _onTouchEnd(e) {
      var now = Date.now();
      if (now - lastTouchEnd <= 300) return;
      var target = e.target.closest('button, [role="button"], a');
      if (!target) return;
      if (target.tagName === 'A' && target.href) return;
      lastTouchEnd = now;
    }
    document.addEventListener('touchend', _onTouchEnd, { passive: true, capture: false });
    _trackCleanup(function () { document.removeEventListener('touchend', _onTouchEnd); });
  }

  /* ─── #9 Fix modal: trap scroll, prevent body scroll behind ──── */
  function initModalScrollLock() {
    function _checkModalScroll() {
      const open = document.querySelector(
        '.modal:not([style*="display: none"]):not([style*="display:none"]), .modal.open, .modal.visible'
      );
      document.body.style.overflow = open ? 'hidden' : '';
    }
    if (window.MutationBus) {
      MutationBus.observe('uc:modal-lock', document.body,
        { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] },
        _checkModalScroll);
    } else {
      var obs = new MutationObserver(_checkModalScroll);
      obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
      _trackCleanup(function () { obs.disconnect(); });
    }
  }

  /* ─── #13 Orientation change: re-layout ─────────────────────── */
  function initOrientationHandler() {
    function _onOrientationChange() {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        fixScrollContainers();
        fixInstallCardPlacement();
        document.querySelectorAll('.context-menu,.dropdown-menu,.more-menu,[class*="context-menu"]')
          .forEach(clampMenuToViewport);
      }, 200);
    }
    window.addEventListener('orientationchange', _onOrientationChange);
    _trackCleanup(function () { window.removeEventListener('orientationchange', _onOrientationChange); });
    if (screen.orientation) {
      screen.orientation.addEventListener('change', _onOrientationChange);
      _trackCleanup(function () { screen.orientation.removeEventListener('change', _onOrientationChange); });
    }
  }

  /* ─── #9 Prevent horizontal scroll from any child ────────────── */
  function preventHorizontalScroll() {
    function _onScroll() {
      if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
    }
    window.addEventListener('scroll', _onScroll, { passive: true });
    _trackCleanup(function () { window.removeEventListener('scroll', _onScroll); });
  }

  /* ─── #11 Fix disabled button pointer-events ─────────────────── */
  function initDisabledButtonFix() {
    function _updateDisabledState(el) {
      if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
        const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled');
        el.style.pointerEvents = disabled ? 'none' : '';
        el.style.cursor        = disabled ? 'not-allowed' : '';
      }
    }

    function _observeNewButtons() {
      document.querySelectorAll('button:not([data-uc-observed]),[role="button"]:not([data-uc-observed])').forEach(el => {
        el.dataset.ucObserved = '1';
        var btnObs = new MutationObserver(function (muts) {
          for (var i = 0; i < muts.length; i++) _updateDisabledState(muts[i].target);
        });
        btnObs.observe(el, { attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'class'] });
        _btnObservers.push(btnObs);
      });
    }

    _observeNewButtons();
    if (window.MutationBus) {
      MutationBus.onBodyChildList('uc:btn-fix', function () { _observeNewButtons(); });
    } else {
      var domObs = new MutationObserver(_observeNewButtons);
      domObs.observe(document.body, { childList: true, subtree: true });
      _trackCleanup(function () { domObs.disconnect(); });
    }
  }

  /* ─── #9 Clamp new context menus after they are inserted ─────── */
  function initMenuClamp() {
    function _onAdded(added) {
      for (var i = 0; i < added.length; i++) {
        var node = added[i];
        if (node.nodeType !== 1) continue;
        if (node.matches && node.matches('.context-menu,.dropdown-menu,.more-menu,#chatContextMenu,[class*="context-menu"]')) {
          setTimeout(function (n) { clampMenuToViewport(n); }, 0, node);
        }
        if (node.querySelectorAll) {
          node.querySelectorAll('.context-menu,.dropdown-menu,.more-menu,[class*="context-menu"]')
            .forEach(function (n) { setTimeout(function () { clampMenuToViewport(n); }, 0); });
        }
      }
    }
    if (window.MutationBus) {
      MutationBus.onBodyChildList('uc:menu-clamp', _onAdded);
    } else {
      var mo = new MutationObserver(function (muts) {
        muts.forEach(function (m) { _onAdded(m.addedNodes); });
      });
      mo.observe(document.body, { childList: true, subtree: true });
      _trackCleanup(function () { mo.disconnect(); });
    }
  }

  /* ─── #10 Chat messages auto-scroll-to-bottom on new messages ── */
  function initAutoScroll() {
    const area = document.getElementById('messagesArea') ||
                 document.getElementById('chatMessages') ||
                 document.querySelector('.messages-area');
    if (!area) return;

    let userScrolledUp = false;
    function _onAreaScroll() {
      const bottom = area.scrollHeight - area.scrollTop - area.clientHeight;
      userScrolledUp = bottom > 80;
    }
    area.addEventListener('scroll', _onAreaScroll, { passive: true });
    _trackCleanup(function () { area.removeEventListener('scroll', _onAreaScroll); });

    if (window.MutationBus) {
      MutationBus.observe('uc:auto-scroll', area, { childList: true, subtree: false }, function () {
        if (!userScrolledUp) area.scrollTop = area.scrollHeight;
      });
    } else {
      var mo = new MutationObserver(function () {
        if (!userScrolledUp) area.scrollTop = area.scrollHeight;
      });
      mo.observe(area, { childList: true, subtree: false });
      _trackCleanup(function () { mo.disconnect(); });
    }
  }

  /* ─── #14 PWA: ensure manifest and viewport are correct ──────── */
  function checkPWAMeta() {
    let vp = document.querySelector('meta[name="viewport"]');
    if (!vp) {
      vp = document.createElement('meta');
      vp.name = 'viewport';
      document.head.appendChild(vp);
    }
    if (!vp.content.includes('viewport-fit=cover')) {
      vp.content = 'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover';
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const tc = document.createElement('meta');
      tc.name = 'theme-color';
      tc.content = '#00a884';
      document.head.appendChild(tc);
    }
  }

  /* ─── #12 Keyboard: Escape closes any open overlay ──────────── */
  function initEscapeClose() {
    function _onKeydown(e) {
      if (e.key !== 'Escape') return;
      const menu = document.querySelector(
        '.context-menu:not([style*="none"]),.dropdown-menu.open,.more-menu.open,#chatContextMenu:not([style*="none"])'
      );
      if (menu) { menu.style.display = 'none'; menu.classList.remove('open', 'visible'); return; }
      const modal = document.querySelector(
        '.modal:not([style*="display: none"]):not([style*="display:none"]):not(#groupMsgInfoModal)'
      );
      if (modal) {
        const closeBtn = modal.querySelector('.close-modal, [data-action="close"], [aria-label="Close"], .modal-close');
        if (closeBtn) closeBtn.click();
        else modal.style.display = 'none';
      }
    }
    document.addEventListener('keydown', _onKeydown);
    _trackCleanup(function () { document.removeEventListener('keydown', _onKeydown); });
  }

  /* ─── init ───────────────────────────────────────────────────── */
  function init() {
    fixInstallCardPlacement();
    fixAriaLabels();
    fixContextMenuTrigger();
    fixScrollContainers();
    initModalScrollLock();
    initOrientationHandler();
    preventHorizontalScroll();
    initDisabledButtonFix();
    initMenuClamp();
    initAutoScroll();
    checkPWAMeta();
    initEscapeClose();

    // Re-run placement after any sidebar mutations (chat list load)
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      if (window.MutationBus) {
        MutationBus.observe('uc:sidebar-card', sidebar, { childList: true }, fixInstallCardPlacement);
      } else {
        new MutationObserver(fixInstallCardPlacement).observe(sidebar, { childList: true });
      }
    }
  }

  /* ─── destroy (logout cleanup) ────────────────────────────────── */
  function destroy() {
    if (window.MutationBus) {
      MutationBus.off('uc:modal-lock');
      MutationBus.off('uc:btn-fix');
      MutationBus.off('uc:menu-clamp');
      MutationBus.off('uc:auto-scroll');
      MutationBus.off('uc:sidebar-card');
    }
    _btnObservers.forEach(function (o) { try { o.disconnect(); } catch (e) {} });
    _btnObservers = [];
    _destroyFns.forEach(function (fn) { try { fn(); } catch (e) {} });
    _destroyFns = [];
    document.body.style.overflow = '';
  }

  window.UICompliance = { destroy: destroy };

  if (document.readyState === 'complete') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 0); });
  }
})();
