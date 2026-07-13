/* ============================================================
   iOS KEYBOARD FIX — Handles virtual keyboard viewport issues
   On iOS Safari, the virtual keyboard resizes the viewport
   unpredictably. This module:
   - Uses visualViewport API to track keyboard state
   - Adjusts input bar positioning
   - Scrolls messages into view when keyboard opens
   - Prevents content from being hidden behind keyboard
   ============================================================ */
'use strict';

const IOSKeyboardFix = {
  _enabled: false,
  _inputBar: null,
  _messagesWrap: null,
  _chatArea: null,
  _keyboardHeight: 0,
  _isKeyboardOpen: false,

  init() {
    if (this._enabled) return;
    if (!/iPhone|iPad|iPod/i.test(navigator.userAgent)) return;

    this._inputBar = document.getElementById('input-bar');
    this._messagesWrap = document.getElementById('messages-wrap');
    this._chatArea = document.getElementById('chat-area');

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._onResize.bind(this));
      window.visualViewport.addEventListener('scroll', this._onScroll.bind(this));
    }

    window.addEventListener('focusin', this._onFocusIn.bind(this));
    window.addEventListener('focusout', this._onFocusOut.bind(this));
    this._enabled = true;
    if (window.__DEBUG__) console.log('[IOSKeyboardFix] Initialized');
  },

  _onResize() {
    if (!window.visualViewport) return;
    const vh = window.visualViewport.height;
    const wh = window.innerHeight;
    this._keyboardHeight = Math.max(0, wh - vh);
    this._isKeyboardOpen = this._keyboardHeight > 100;

    if (this._isKeyboardOpen) {
      document.documentElement.style.setProperty('--keyboard-height', this._keyboardHeight + 'px');
      document.body.classList.add('ios-keyboard-open');
      if (this._inputBar) {
        this._inputBar.style.transform = `translateY(-${this._keyboardHeight}px)`;
      }
      this._scrollToBottom();
    } else {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.body.classList.remove('ios-keyboard-open');
      if (this._inputBar) {
        this._inputBar.style.transform = '';
      }
    }
  },

  _onScroll() {
    if (this._isKeyboardOpen) {
      this._scrollToBottom();
    }
  },

  _onFocusIn(e) {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.contentEditable === 'true') {
      setTimeout(() => this._scrollToBottom(), 300);
    }
  },

  _onFocusOut() {
    setTimeout(() => {
      if (!document.activeElement || document.activeElement === document.body) {
        document.documentElement.style.setProperty('--keyboard-height', '0px');
        document.body.classList.remove('ios-keyboard-open');
        if (this._inputBar) this._inputBar.style.transform = '';
        this._isKeyboardOpen = false;
      }
    }, 100);
  },

  _scrollToBottom() {
    if (this._messagesWrap) {
      this._messagesWrap.scrollTop = this._messagesWrap.scrollHeight;
    }
  },

  destroy() {
    this._enabled = false;
    document.documentElement.style.setProperty('--keyboard-height', '0px');
    document.body.classList.remove('ios-keyboard-open');
  }
};

window.IOSKeyboardFix = IOSKeyboardFix;
