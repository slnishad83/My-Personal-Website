'use strict';
/**
 * QUICK REPLY SUGGESTIONS — Shows context-aware reply chips above the input bar.
 * Analyzes last received message and suggests relevant quick replies.
 */
(function () {
  const QuickReplies = {
    _container: null,
    _lastMsgText: '',

    _suggestions: {
      greeting: ['Hello!', 'Hey!', 'Hi there! 👋', 'What\'s up?'],
      question: ['Yes', 'No', 'Maybe', 'Let me check', 'I\'ll get back to you', 'Good question!'],
      thanks: ['You\'re welcome!', 'No problem!', 'Anytime!', 'Sure thing!'],
      sorry: ['It\'s okay', 'No worries', 'Don\'t worry about it', 'All good!'],
      agreement: ['Agreed!', 'I agree', 'Sounds good!', 'Perfect!', 'Let\'s do it!'],
      time: ['Morning!', 'Good afternoon!', 'Good evening!', 'Good night! 🌙'],
      emoji: ['😊', '👍', '❤️', '😂', '🎉', '🙏'],
      default: ['OK', 'Got it', '👍', 'Sure', 'Thanks!', 'Noted']
    },

    _keywords: {
      greeting: ['hello', 'hi', 'hey', 'morning', 'evening', 'afternoon', 'sup'],
      question: ['?', 'what', 'how', 'when', 'where', 'who', 'why', 'can you', 'could you'],
      thanks: ['thank', 'thanks', 'appreciate', 'grateful'],
      sorry: ['sorry', 'apologize', 'my bad', 'oops', 'forgive'],
      agreement: ['let\'s', 'we should', 'how about', 'want to', 'shall we', 'plan'],
      time: ['good night', 'good morning', 'good evening', 'good afternoon', 'night', 'sleep']
    },

    init() {
      this._createContainer();
      this._observeNewMessages();
    },

    _createContainer() {
      this._container = document.createElement('div');
      this._container.id = 'quick-reply-chips';
      this._container.style.cssText = 'display:flex;gap:6px;padding:4px 12px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;flex-shrink:0;scroll-behavior:smooth;';
      this._container.style.cssText += '::-webkit-scrollbar{display:none;}';

      const inputBar = document.getElementById('input-bar') || document.querySelector('.chat-input-bar, .input-container');
      if (inputBar) {
        inputBar.parentElement.insertBefore(this._container, inputBar);
      }
    },

    _observeNewMessages() {
      const container = document.getElementById('messages-container') || document.querySelector('.messages-wrapper');
      if (!container) {
        setTimeout(() => this._observeNewMessages(), 1000);
        return;
      }

      const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
          m.addedNodes.forEach(node => {
            if (node.nodeType === 1 && node.classList?.contains('message-bubble') && !node.classList?.contains('sent')) {
              const textEl = node.querySelector('.msg-text, .message-text, [data-text]');
              if (textEl) {
                this.generateSuggestions(textEl.textContent || textEl.getAttribute('data-text') || '');
              }
            }
          });
        });
      });

      this._observer = observer;
      observer.observe(container, { childList: true, subtree: true });
    },

    generateSuggestions(text) {
      if (!this._container) this._createContainer();
      this._lastMsgText = text.toLowerCase();

      const category = this._detectCategory(this._lastMsgText);
      const replies = this._suggestions[category] || this._suggestions.default;

      this._container.innerHTML = '';
      replies.forEach(reply => {
        const chip = document.createElement('button');
        chip.className = 'quick-reply-chip';
        chip.textContent = reply;
        chip.style.cssText = 'flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid var(--outline-variant,#d8dee2);background:var(--surface,#fff);color:var(--on-surface,#000);font-size:13px;cursor:pointer;transition:all 0.15s;white-space:nowrap;font-family:inherit;';
        chip.addEventListener('mouseenter', () => {
          chip.style.background = 'var(--primary,#00a884)';
          chip.style.color = 'var(--on-primary,#fff)';
          chip.style.borderColor = 'var(--primary,#00a884)';
        });
        chip.addEventListener('mouseleave', () => {
          chip.style.background = 'var(--surface,#fff)';
          chip.style.color = 'var(--on-surface,#000)';
          chip.style.borderColor = 'var(--outline-variant,#d8dee2)';
        });
        chip.addEventListener('click', () => {
          this._sendQuickReply(reply);
        });
        this._container.appendChild(chip);
      });

      this._container.style.display = 'flex';
    },

    _detectCategory(text) {
      for (const [category, keywords] of Object.entries(this._keywords)) {
        for (const kw of keywords) {
          if (text.includes(kw)) return category;
        }
      }
      return 'default';
    },

    _sendQuickReply(text) {
      const input = document.getElementById('message-input') || document.querySelector('[contenteditable="true"], textarea');
      if (input) {
        if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
          input.value = text;
        } else {
          input.textContent = text;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }

      // Auto-send after a brief delay
      setTimeout(() => {
        const sendBtn = document.querySelector('.send-btn, [data-action="send"], button[aria-label="Send"]');
        if (sendBtn) sendBtn.click();
      }, 100);

      this.hide();
    },

    hide() {
      if (this._container) {
        this._container.innerHTML = '';
        this._container.style.display = 'none';
      }
    },

    destroy() {
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      if (this._container) {
        this._container.remove();
        this._container = null;
      }
    }
  };

  window.QuickReplies = QuickReplies;

  document.addEventListener('click', function (e) {
    if (e.target.closest('.send-btn, [data-action="send"]')) {
      QuickReplies.hide();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { QuickReplies.init(); });
  } else {
    QuickReplies.init();
  }
})();
