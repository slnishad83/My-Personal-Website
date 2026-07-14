/* ============================================================
   ACCESSIBILITY — Focus traps, skip-nav, ARIA enhancements
   ============================================================ */
'use strict';

const A11y = {
  _focusTrapStack: [],
  _lastFocused: null,

  init() {
    this._addSkipNav();
    this._setupFocusTrapObserver();
    this._addLiveRegions();
    this._enhanceDynamicContent();
    if (window.__DEBUG__) console.log('[A11y] Initialized');
  },

  _addSkipNav() {
    if (document.getElementById('skip-nav')) return;
    const nav = document.createElement('a');
    nav.href = '#msg-input';
    nav.className = 'sr-only';
    nav.textContent = 'Skip to message input';
    nav.id = 'skip-nav';
    nav.style.cssText = 'position:fixed;top:-100px;left:8px;z-index:99999;padding:12px 24px;' +
      'background:var(--primary);color:var(--on-primary);border-radius:0 0 12px 12px;' +
      'font-weight:700;font-size:14px;text-decoration:none;transition:top 0.2s;';
    nav.onfocus = () => { nav.style.top = '0'; };
    nav.onblur = () => { nav.style.top = '-100px'; };
    nav.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const input = document.getElementById('msg-input');
        if (input) { input.focus(); nav.style.top = '-100px'; }
      }
    };
    document.body.prepend(nav);
  },

  _setupFocusTrapObserver() {
    if (!('MutationObserver' in window)) return;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1 && node.classList?.contains('overlay') && !node.classList.contains('hidden')) {
            this._trapFocus(node);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },

  _trapFocus(overlay) {
    const focusable = overlay.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    this._lastFocused = document.activeElement;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const trap = (e) => {
      if (e.key !== 'Tab') {
        if (e.key === 'Escape') {
          const closeBtn = overlay.querySelector('[onclick*="close"], [onclick*="hide"]');
          if (closeBtn) closeBtn.click();
          this._releaseFocus();
          return;
        }
        return;
      }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    overlay._a11yTrap = trap;
    overlay._a11yRelease = () => this._releaseFocus();
    overlay.addEventListener('keydown', trap);
    first.focus();
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
