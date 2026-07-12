/* =============================================
   AUDIT INTERACTIONS + FUNCTIONAL + PERFORMANCE v1.1
   #19 Interaction audit | #20 Functional audit | #21 Performance
   ── v1.1: named handlers + MutationBus + destroy()
   ============================================= */
(function () {
  'use strict';

  var _cleanupFns = [];
  var _observers = [];

  function _trackCleanup(fn) { _cleanupFns.push(fn); }

  /* ─── #19 Swipe navigation ──────────────────────────────────── */
  function initSwipeNav() {
    let startX = 0, startY = 0, startTime = 0;
    const SWIPE_MIN_X  = 50;
    const SWIPE_MAX_Y  = 80;
    const SWIPE_MAX_MS = 400;

    function _onTouchStart(e) {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY; startTime = Date.now();
    }
    function _onTouchEnd(e) {
      if (!e.changedTouches.length) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startTime;
      if (dt > SWIPE_MAX_MS || Math.abs(dy) > SWIPE_MAX_Y || Math.abs(dx) < SWIPE_MIN_X) return;
      if (dx > 0) {
        const backBtn = document.getElementById('backBtn') ||
                        document.querySelector('[data-action="back"], .back-btn, .header-back-btn');
        if (backBtn && window.getComputedStyle(backBtn).display !== 'none') backBtn.click();
      }
    }

    document.addEventListener('touchstart', _onTouchStart, { passive: true });
    document.addEventListener('touchend', _onTouchEnd, { passive: true });
    _trackCleanup(function () {
      document.removeEventListener('touchstart', _onTouchStart);
      document.removeEventListener('touchend', _onTouchEnd);
    });
  }

  /* ─── #19 Long-press fires context menu on mobile ───────────── */
  function initLongPress() {
    let timer = null;
    const LONG_PRESS_MS = 500;

    function _onTouchStart(e) {
      const target = e.target.closest('.message-bubble, .msg-bubble, .chat-message, .message-row');
      if (!target) return;
      timer = setTimeout(() => {
        const t = e.touches[0];
        target.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY
        }));
      }, LONG_PRESS_MS);
    }
    function _clearTimer() { clearTimeout(timer); }

    document.addEventListener('touchstart', _onTouchStart, { passive: true });
    document.addEventListener('touchend', _clearTimer, { passive: true });
    document.addEventListener('touchmove', _clearTimer, { passive: true });
    document.addEventListener('touchcancel', _clearTimer, { passive: true });
    _trackCleanup(function () {
      document.removeEventListener('touchstart', _onTouchStart);
      document.removeEventListener('touchend', _clearTimer);
      document.removeEventListener('touchmove', _clearTimer);
      document.removeEventListener('touchcancel', _clearTimer);
    });
  }

  /* ─── #19 Keyboard navigation ───────────────────────────────── */
  function initKeyboardNav() {
    function _onKeydown(e) {
      if (e.key === 'Escape') {
        const modal = document.querySelector('.modal[style*="block"], .modal.open, .modal.visible, [role="dialog"]:not([hidden])');
        if (modal) {
          const closeBtn = modal.querySelector('.modal-close, .close-btn, [data-action="close"], [aria-label="Close"]');
          if (closeBtn) { closeBtn.click(); return; }
        }
        if (typeof window.closeComposerPanels === 'function') window.closeComposerPanels();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const search = document.querySelector('#searchInput, .search-input, input[placeholder*="Search"]');
        if (search) search.focus();
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && document.activeElement?.id === 'searchInput') {
        e.preventDefault();
        const items = Array.from(document.querySelectorAll('.chat-list-item, [class*="chat-row"]:not(.hidden)'));
        if (!items.length) return;
        const focused = document.querySelector('.chat-list-item.keyboard-focus');
        const idx = focused ? items.indexOf(focused) : -1;
        if (focused) focused.classList.remove('keyboard-focus');
        const next = e.key === 'ArrowDown'
          ? items[Math.min(idx + 1, items.length - 1)]
          : items[Math.max(idx - 1, 0)];
        if (next) { next.classList.add('keyboard-focus'); next.scrollIntoView({ block: 'nearest' }); }
      }
      if (e.key === 'Enter' && document.activeElement?.id === 'searchInput') {
        const focused = document.querySelector('.chat-list-item.keyboard-focus');
        if (focused) focused.click();
      }
    }
    document.addEventListener('keydown', _onKeydown);
    _trackCleanup(function () { document.removeEventListener('keydown', _onKeydown); });
  }

  /* ─── #19 Double-tap to react ────────────────────────────────── */
  function initDoubleTapReact() {
    let lastTap = 0, lastTarget = null;
    function _onTouchEnd(e) {
      const msg = e.target.closest('.message-bubble, .msg-bubble, .message-row');
      if (!msg) return;
      const now = Date.now();
      if (lastTarget === msg && now - lastTap < 300) {
        const reactBtn = msg.querySelector('[data-action="react"], .react-btn, .emoji-react-btn');
        if (reactBtn) reactBtn.click();
        else {
          const t = e.changedTouches[0];
          msg.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY
          }));
        }
        lastTap = 0; lastTarget = null; return;
      }
      lastTap = now; lastTarget = msg;
    }
    document.addEventListener('touchend', _onTouchEnd, { passive: true });
    _trackCleanup(function () { document.removeEventListener('touchend', _onTouchEnd); });
  }

  /* ─── #21 Scroll performance ─────────────────────────────────── */
  function initScrollPerf() {
    const chatMessages = document.getElementById('chatMessages') ||
                         document.querySelector('.messages-list, .chat-messages, #messagesContainer');
    if (!chatMessages) return;
    if (!('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry =>
        entry.target.classList.toggle('tc-offscreen', !entry.isIntersecting)
      );
    }, { root: chatMessages, rootMargin: '200px' });

    const observe = () =>
      chatMessages.querySelectorAll('.message-bubble, .msg-bubble, .message-row')
        .forEach(el => io.observe(el));

    observe();
    if (window.MutationBus) {
      MutationBus.observe('audit:scroll-perf', chatMessages, { childList: true, subtree: false }, observe);
    } else {
      var mo = new MutationObserver(observe);
      mo.observe(chatMessages, { childList: true, subtree: false });
      _observers.push(mo);
    }
  }

  /* ─── #21 Image lazy loading ─────────────────────────────────── */
  function lazyImages() {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
        io.unobserve(img);
      });
    }, { rootMargin: '300px' });
    const observeAll = () => document.querySelectorAll('img[data-src]').forEach(img => io.observe(img));
    observeAll();
    if (window.MutationBus) {
      MutationBus.onBodyChildList('audit:lazy-img', function () { observeAll(); });
    } else {
      var mo = new MutationObserver(observeAll);
      mo.observe(document.body, { childList: true, subtree: true });
      _observers.push(mo);
    }
  }

  /* ─── #20 Modal focus trap ───────────────────────────────────── */
  function initFocusTrap() {
    function _onModalOpen(e) {
      const modal = e.detail?.el || document.querySelector('.modal.open, [role="dialog"]:not([hidden])');
      if (!modal) return;
      const focusable = modal.querySelectorAll(
        'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length) focusable[0].focus();
    }
    document.addEventListener('tc:modal:opened', _onModalOpen);
    _trackCleanup(function () { document.removeEventListener('tc:modal:opened', _onModalOpen); });
  }

  /* ─── #20 Prevent accidental pull-to-refresh in chat area ──── */
  function preventPullRefresh() {
    let lastY = 0;
    function _onTouchStart(e) { lastY = e.touches[0].clientY; }
    function _onTouchMove(e) {
      const el = e.target.closest('#chatMessages, .messages-list');
      if (!el) return;
      if (el.scrollTop <= 0 && e.touches[0].clientY - lastY > 0) e.preventDefault();
    }
    document.addEventListener('touchstart', _onTouchStart, { passive: true });
    document.addEventListener('touchmove', _onTouchMove, { passive: false });
    _trackCleanup(function () {
      document.removeEventListener('touchstart', _onTouchStart);
      document.removeEventListener('touchmove', _onTouchMove);
    });
  }

  /* ─── init ───────────────────────────────────────────────────── */
  function init() {
    initSwipeNav();
    initLongPress();
    initKeyboardNav();
    initDoubleTapReact();
    initScrollPerf();
    lazyImages();
    initFocusTrap();
    preventPullRefresh();
  }

  /* ─── destroy (logout cleanup) ──────────────────────────────── */
  function destroy() {
    if (window.MutationBus) {
      MutationBus.off('audit:scroll-perf');
      MutationBus.off('audit:lazy-img');
    }
    _observers.forEach(function (o) { try { o.disconnect(); } catch (e) {} });
    _observers = [];
    _cleanupFns.forEach(function (fn) { try { fn(); } catch (e) {} });
    _cleanupFns = [];
  }

  window.AuditInteractions = { destroy: destroy };

  if (document.readyState === 'complete') setTimeout(init, 0);
  else window.addEventListener('load', () => setTimeout(init, 0));
})();
