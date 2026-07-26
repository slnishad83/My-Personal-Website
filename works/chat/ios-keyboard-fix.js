/* ============================================================
   VIRTUAL KEYBOARD FIX — Handles keyboard viewport issues
   Works on iOS Safari and Android Chrome/Firefox.
   - Uses visualViewport API to track keyboard state
   - Adjusts input bar positioning
   - Scrolls messages into view when keyboard opens
   - Prevents content from being hidden behind keyboard
   ============================================================ */
'use strict';

const VirtualKeyboardFix = {
  _enabled: false,
  _inputBar: null,
  _messagesWrap: null,
  _chatArea: null,
  _keyboardHeight: 0,
  _isKeyboardOpen: false,
  _resizeTimeout: null,
  _isIOS: false,
  _isAndroid: false,

  init() {
    if (this._enabled) return;
    if (!window.visualViewport) return;

    this._isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    this._isAndroid = /Android/.test(navigator.userAgent);

    this._inputBar = document.getElementById('input-bar');
    this._messagesWrap = document.getElementById('messages-wrap');
    this._chatArea = document.getElementById('chat-area');

    this._boundResize = this._onResize.bind(this);
    this._boundScroll = this._onScroll.bind(this);
    this._boundFocusIn = this._onFocusIn.bind(this);
    this._boundFocusOut = this._onFocusOut.bind(this);

    window.visualViewport.addEventListener('resize', this._boundResize);
    window.visualViewport.addEventListener('scroll', this._boundScroll);

    window.addEventListener('focusin', this._boundFocusIn);
    window.addEventListener('focusout', this._boundFocusOut);
    this._enabled = true;
    if (window.__DEBUG__) console.log('[VirtualKeyboardFix] Initialized', { ios: this._isIOS, android: this._isAndroid });
  },

  _onResize() {
    if (!window.visualViewport) return;
    
    clearTimeout(this._resizeTimeout);
    this._resizeTimeout = setTimeout(() => {
      const vh = window.visualViewport.height;
      const wh = window.innerHeight;
      this._keyboardHeight = Math.max(0, wh - vh);
      
      // Different thresholds for different platforms
      const threshold = this._isIOS ? 100 : 150;
      this._isKeyboardOpen = this._keyboardHeight > threshold;

      if (this._isKeyboardOpen) {
        document.documentElement.style.setProperty('--keyboard-height', this._keyboardHeight + 'px');
        document.body.classList.add('virtual-keyboard-open');
        if (this._isIOS) document.body.classList.add('ios-keyboard-open');
        if (this._isAndroid) document.body.classList.add('android-keyboard-open');
        
        const app = document.getElementById('app');
        if (app) app.classList.add('keyboard-visible');
        
        if (this._inputBar) {
          // Android sometimes needs a slightly different approach
          if (this._isAndroid) {
            this._inputBar.style.bottom = `${this._keyboardHeight}px`;
          } else {
            this._inputBar.style.transform = `translateY(-${this._keyboardHeight}px)`;
          }
        }
        this._scrollToBottom();
      } else {
        document.documentElement.style.setProperty('--keyboard-height', '0px');
        document.body.classList.remove('virtual-keyboard-open', 'ios-keyboard-open', 'android-keyboard-open');
        const app = document.getElementById('app');
        if (app) app.classList.remove('keyboard-visible');
        if (this._inputBar) {
          this._inputBar.style.transform = '';
          this._inputBar.style.bottom = '';
        }
      }
    }, this._isAndroid ? 50 : 0); // Android needs debouncing
  },

  _onScroll() {
    if (this._isKeyboardOpen) {
      this._scrollToBottom();
    }
  },

  _onFocusIn(e) {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.contentEditable === 'true') {
      setTimeout(() => this._scrollToBottom(), this._isAndroid ? 500 : 300);
    }
  },

  _onFocusOut() {
    setTimeout(() => {
      if (!document.activeElement || document.activeElement === document.body) {
        document.documentElement.style.setProperty('--keyboard-height', '0px');
        document.body.classList.remove('virtual-keyboard-open', 'ios-keyboard-open', 'android-keyboard-open');
        if (this._inputBar) {
          this._inputBar.style.transform = '';
          this._inputBar.style.bottom = '';
        }
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
    clearTimeout(this._resizeTimeout);
    document.documentElement.style.setProperty('--keyboard-height', '0px');
    document.body.classList.remove('virtual-keyboard-open', 'ios-keyboard-open', 'android-keyboard-open');
    const app = document.getElementById('app');
    if (app) app.classList.remove('keyboard-visible');
    if (this._boundResize && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._boundResize);
      window.visualViewport.removeEventListener('scroll', this._boundScroll);
    }
    if (this._boundFocusIn) {
      window.removeEventListener('focusin', this._boundFocusIn);
      window.removeEventListener('focusout', this._boundFocusOut);
    }
    if (this._inputBar) {
      this._inputBar.style.transform = '';
      this._inputBar.style.bottom = '';
    }
  }
};

// Keep backward compatibility
window.IOSKeyboardFix = VirtualKeyboardFix;
window.VirtualKeyboardFix = VirtualKeyboardFix;
