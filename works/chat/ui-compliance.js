/* =============================================
   UI COMPLIANCE v1.0
   Items #7-14: Runtime fixes for responsive
   compliance, install card placement, scroll
   validation, modal z-index, interaction audit.
   ============================================= */
(function () {
  'use strict';

  /* ─── #8 Move mobile-install-card to bottom of sidebar ─────────── */
  function fixInstallCardPlacement() {
    const card   = document.querySelector('.mobile-install-card');
    const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
    if (!card || !sidebar) return;

    // Only move if the card is NOT already the last child of sidebar
    if (card.parentElement === sidebar && sidebar.lastElementChild === card) return;

    sidebar.appendChild(card);
    card.style.display = ''; // ensure visible (JS may have hidden it)
  }

  /* ─── #10 Universal scrolling: validate all containers ─────────── */
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

  /* ─── #9 Clamp context menus / dropdowns to viewport ───────────── */
  function clampMenuToViewport(menu) {
    if (!menu) return;
    const rect  = menu.getBoundingClientRect();
    const vpW   = window.innerWidth;
    const vpH   = window.innerHeight;

    let { left, top } = menu.style;
    left = parseFloat(left) || 0;
    top  = parseFloat(top)  || 0;

    if (rect.right  > vpW - 8)  { menu.style.left = Math.max(8, vpW - rect.width  - 8) + 'px'; }
    if (rect.bottom > vpH - 8)  { menu.style.top  = Math.max(8, vpH - rect.height - 8) + 'px'; }
    if (rect.left   < 8)        { menu.style.left = '8px'; }
    if (rect.top    < 8)        { menu.style.top  = '8px'; }
  }

  /* ─── #11 Fix any icon-btn that has no aria-label ───────────────── */
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
    document.addEventListener('contextmenu', e => {
      const msg = e.target.closest('.message-bubble,.msg-bubble,.message-row,.message-item');
      if (!msg) return;
      // Prevent default browser context menu on mobile
      if ('ontouchstart' in window) e.preventDefault();
    });
  }

  /* ─── #12 Fix button double-fire on iOS (click + touchend) ─────── */
  function fixDoubleFire() {
    if (!('ontouchstart' in window)) return;
    var lastTouchEnd = 0;
    document.addEventListener('touchend', function (e) {
      var now = Date.now();
      if (now - lastTouchEnd <= 300) return;
      var target = e.target.closest('button, [role="button"], a');
      if (!target) return;
      if (target.tagName === 'A' && target.href) return;
      lastTouchEnd = now;
    }, { passive: true, capture: false });
  }

  /* ─── #9 Fix modal: trap scroll, prevent body scroll behind ─────── */
  function initModalScrollLock() {
    const observer = new MutationObserver(() => {
      const open = document.querySelector(
        '.modal:not([style*="display: none"]):not([style*="display:none"]), .modal.open, .modal.visible'
      );
      document.body.style.overflow = open ? 'hidden' : '';
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','class'] });
  }

  /* ─── #13 Orientation change: re-layout ────────────────────────── */
  function initOrientationHandler() {
    const onOrientationChange = () => {
      // Force a re-paint after orientation settles
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        fixScrollContainers();
        fixInstallCardPlacement();
        // Clamp any open menus
        document.querySelectorAll('.context-menu,.dropdown-menu,.more-menu,[class*="context-menu"]')
          .forEach(clampMenuToViewport);
      }, 200);
    };
    window.addEventListener('orientationchange', onOrientationChange);
    screen.orientation?.addEventListener('change', onOrientationChange);
  }

  /* ─── #9 Prevent horizontal scroll from any child ───────────────── */
  function preventHorizontalScroll() {
    window.addEventListener('scroll', () => {
      if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
    }, { passive: true });
  }

  /* ─── #11 Fix disabled button pointer-events ────────────────────── */
  function initDisabledButtonFix() {
    const observer = new MutationObserver(muts => {
      muts.forEach(m => {
        const el = m.target;
        if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
          const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled');
          el.style.pointerEvents = disabled ? 'none' : '';
          el.style.cursor        = disabled ? 'not-allowed' : '';
        }
      });
    });
    document.querySelectorAll('button,[role="button"]').forEach(el =>
      observer.observe(el, { attributes: true, attributeFilter: ['disabled','aria-disabled','class'] })
    );
    const domObserver = new MutationObserver(() => {
      document.querySelectorAll('button:not([data-uc-observed])').forEach(el => {
        el.dataset.ucObserved = '1';
        observer.observe(el, { attributes: true, attributeFilter: ['disabled','aria-disabled'] });
      });
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
  }

  /* ─── #9 Clamp new context menus after they are inserted ────────── */
  function initMenuClamp() {
    const mo = new MutationObserver(muts => {
      muts.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches('.context-menu,.dropdown-menu,.more-menu,#chatContextMenu,[class*="context-menu"]')) {
            setTimeout(() => clampMenuToViewport(node), 0);
          }
          node.querySelectorAll?.('.context-menu,.dropdown-menu,.more-menu,[class*="context-menu"]')
            .forEach(n => setTimeout(() => clampMenuToViewport(n), 0));
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* ─── #10 Chat messages auto-scroll-to-bottom on new messages ───── */
  function initAutoScroll() {
    const area = document.getElementById('messagesArea') ||
                 document.getElementById('chatMessages') ||
                 document.querySelector('.messages-area');
    if (!area) return;

    let userScrolledUp = false;
    area.addEventListener('scroll', () => {
      const bottom = area.scrollHeight - area.scrollTop - area.clientHeight;
      userScrolledUp = bottom > 80;
    }, { passive: true });

    const mo = new MutationObserver(() => {
      if (!userScrolledUp) {
        area.scrollTop = area.scrollHeight;
      }
    });
    mo.observe(area, { childList: true, subtree: false });
  }

  /* ─── #14 PWA: ensure manifest and viewport are correct ─────────── */
  function checkPWAMeta() {
    // viewport meta
    let vp = document.querySelector('meta[name="viewport"]');
    if (!vp) {
      vp = document.createElement('meta');
      vp.name = 'viewport';
      document.head.appendChild(vp);
    }
    if (!vp.content.includes('viewport-fit=cover')) {
      vp.content = 'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover';
    }
    // theme-color meta for PWA chrome
    if (!document.querySelector('meta[name="theme-color"]')) {
      const tc = document.createElement('meta');
      tc.name = 'theme-color';
      tc.content = '#00a884';
      document.head.appendChild(tc);
    }
  }

  /* ─── #12 Keyboard: Escape closes any open overlay ─────────────── */
  function initEscapeClose() {
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      // Context menu / dropdown
      const menu = document.querySelector(
        '.context-menu:not([style*="none"]),.dropdown-menu.open,.more-menu.open,#chatContextMenu:not([style*="none"])'
      );
      if (menu) { menu.style.display = 'none'; menu.classList.remove('open','visible'); return; }
      // Modal
      const modal = document.querySelector(
        '.modal:not([style*="display: none"]):not([style*="display:none"]):not(#groupMsgInfoModal)'
      );
      if (modal) {
        const closeBtn = modal.querySelector('.close-modal, [data-action="close"], [aria-label="Close"], .modal-close');
        if (closeBtn) closeBtn.click();
        else modal.style.display = 'none';
        return;
      }
    });
  }

  /* ─── init ──────────────────────────────────────────────────────── */
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
      new MutationObserver(() => fixInstallCardPlacement())
        .observe(sidebar, { childList: true });
    }
  }

  if (document.readyState === 'complete') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', () => setTimeout(init, 0));
  }
})();
