/* ============================================================
   ACCESSIBILITY � Focus traps, skip-nav, ARIA enhancements
   ============================================================ */
'use strict';

const A11y = {
  _focusTrapStack: [],
  _lastFocused: null,

  init() {
    this._addSkipNav();
    this._setupFocusTrap();
    this._addLiveRegions();
    this._enhanceDynamicContent();
    if (window.__DEBUG__) console.log('[A11y] Initialized');
  },

  _addSkipNav() {
    if (document.getElementById('skip-nav')) return;
    const nav = document.createElement('a');
    nav.href = '#chat-list';
    nav.className = 'sr-only';
    nav.textContent = 'Skip to chat list';
    nav.id = 'skip-nav';
    nav.style.cssText = 'position:fixed;top:-100px;left:8px;z-index:99999;padding:12px 24px;' +
      'background:var(--primary);color:var(--on-primary);border-radius:0 0 12px 12px;' +
      'font-weight:700;font-size:14px;text-decoration:none;transition:top 0.2s;';
    nav.onfocus = () => { nav.style.top = '0'; };
    nav.onblur = () => { nav.style.top = '-100px'; };
    nav.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const target = document.getElementById('chat-list') || document.getElementById('msg-input');
        if (target) { target.focus(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); nav.style.top = '-100px'; }
      }
    };
    document.body.prepend(nav);
  },

  _findTopOverlay() {
    let best = null;
    let bestZ = -1;
    const overlays = document.querySelectorAll('.overlay');
    for (const el of overlays) {
      if (el.classList.contains('hidden') || !el.offsetParent && getComputedStyle(el).position !== 'fixed') {
        continue;
      }
      if (!el.isConnected) continue;
      const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
      if (z > bestZ) { bestZ = z; best = el; }
    }
    return best;
  },

  _getFocusable(container) {
    return Array.from(container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
  },

  _setupFocusTrap() {
    if (window.A11yEnhancements || window._a11yEnhancementsActive) return;
    document.addEventListener('focusin', (e) => {
      const overlay = this._findTopOverlay();
      if (overlay && !this._lastFocused) {
        this._lastFocused = e.target;
      }
    });

    this._focusTrapHandler = (e) => {
      if (e.key !== 'Tab') return;
      const overlay = this._findTopOverlay();
      if (!overlay) return;
      const focusable = this._getFocusable(overlay);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', this._focusTrapHandler);

    this._focusTrapKeyHandler = (e) => {
      if (e.key !== 'Escape') return;
      const overlay = this._findTopOverlay();
      if (!overlay) return;
      const closeBtn = overlay.querySelector('[onclick*="close"], [onclick*="hide"], [onclick*="Close"], .close-btn, button[aria-label*="close" i], button[aria-label*="Close"]');
      if (closeBtn) closeBtn.click();
      else overlay.click();
      this._releaseFocus();
    };
    document.addEventListener('keydown', this._focusTrapKeyHandler);
  },

  _trapFocusCleanup() {
    this._releaseFocus();
  },

  _releaseFocus() {
    if (this._lastFocused && this._lastFocused.focus) {
      try { this._lastFocused.focus(); } catch(_) {}
    }
    this._lastFocused = null;
  },

  _addLiveRegions() {
    const announcements = document.createElement('div');
    announcements.id = 'a11y-announcements';
    announcements.setAttribute('aria-live', 'assertive');
    announcements.setAttribute('aria-atomic', 'true');
    announcements.className = 'sr-only';
    announcements.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    document.body.appendChild(announcements);
  },

  announce(message) {
    const el = document.getElementById('a11y-announcements');
    if (el) {
      el.textContent = '';
      setTimeout(() => { el.textContent = message; }, 50);
    }
  },

  _enhanceDynamicContent() {
    if (!('MutationObserver' in window)) return;
    const chatList = document.getElementById('chat-list');
    if (chatList) {
      chatList.setAttribute('role', 'list');
      chatList.setAttribute('aria-label', 'Conversations');
    }
    const msgWrap = document.getElementById('messages-wrap');
    if (msgWrap) {
      msgWrap.setAttribute('role', 'log');
      msgWrap.setAttribute('aria-label', 'Messages');
      msgWrap.setAttribute('aria-live', 'polite');
    }
  }
};

window.A11y = A11y;
window.announce = (msg) => A11y.announce(msg);
