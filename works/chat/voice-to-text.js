'use strict';
/**
 * VOICE TO TEXT — Web Speech API speech recognition for message input
 * Adds a microphone button to the chat input bar for dictation.
 */
(function () {
  const SpeechToText = {
    _recognition: null,
    _isListening: false,
    _targetInput: null,
    _btn: null,

    isSupported() {
      return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    },

    init() {
      if (!this.isSupported()) return;
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this._recognition = new SpeechRecognition();
      this._recognition.continuous = true;
      this._recognition.interimResults = true;
      this._recognition.lang = 'en-US';
      this._recognition.maxAlternatives = 1;

      this._recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        this._updateInput(finalTranscript || interimTranscript, !finalTranscript);
      };

      this._recognition.onerror = (event) => {
        if (window.__DEBUG__) console.warn('[SpeechToText] Error:', event.error);
        if (event.error === 'not-allowed') {
          if (typeof showToast === 'function') showToast('Microphone permission denied', 'error');
        } else if (event.error === 'no-speech') {
          if (typeof showToast === 'function') showToast('No speech detected, try again', 'info');
        }
        this.stop();
      };

      this._recognition.onend = () => {
        this._isListening = false;
        this._updateButtonState();
      };

      this._createButton();
    },

    _createButton() {
      this._btn = document.createElement('button');
      this._btn.id = 'voice-to-text-btn';
      this._btn.setAttribute('aria-label', 'Voice to text');
      this._btn.title = 'Voice to text';
      this._btn.style.cssText = 'width:36px;height:36px;border-radius:50%;border:none;background:transparent;color:var(--on-surface-variant,#8696a0);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;';
      this._btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">mic</span>';

      this._btn.addEventListener('click', () => {
        if (this._isListening) {
          this.stop();
        } else {
          this.start();
        }
      });

      this._btn.addEventListener('mouseenter', () => {
        this._btn.style.background = 'var(--surface-variant,#f0f2f5)';
      });
      this._btn.addEventListener('mouseleave', () => {
        this._btn.style.background = 'transparent';
      });

      this._insertButton();
    },

    _insertButton() {
      const inputBar = document.getElementById('input-bar') || document.querySelector('.chat-input-bar, .input-container');
      if (inputBar && !inputBar.querySelector('#voice-to-text-btn')) {
        inputBar.insertBefore(this._btn, inputBar.firstChild);
      }
    },

    start() {
      if (!this._recognition) {
        this.init();
        if (!this._recognition) return;
      }

      this._targetInput = document.getElementById('message-input') || document.querySelector('[contenteditable="true"], textarea');
      if (!this._targetInput) return;

      try {
        this._recognition.start();
        this._isListening = true;
        this._updateButtonState();
        if (typeof showToast === 'function') showToast('Listening... speak now', 'info');
      } catch (e) {
        if (window.__DEBUG__) console.warn('[SpeechToText] Start error:', e);
      }
    },

    stop() {
      if (this._recognition && this._isListening) {
        try {
          this._recognition.stop();
        } catch (_) {}
      }
      this._isListening = false;
      this._updateButtonState();
    },

    _updateInput(text, isInterim) {
      const input = this._targetInput;
      if (!input) return;

      if (isInterim) {
        input.style.opacity = '0.7';
      } else {
        input.style.opacity = '1';
      }

      if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
        const cursorPos = input.selectionStart;
        const before = input.value.slice(0, cursorPos);
        const after = input.value.slice(cursorPos);
        input.value = before + text + after;
        input.selectionStart = input.selectionEnd = cursorPos + text.length;
      } else {
        input.textContent += text;
      }

      input.dispatchEvent(new Event('input', { bubbles: true }));
    },

    _updateButtonState() {
      if (!this._btn) return;
      if (this._isListening) {
        this._btn.style.background = 'var(--primary,#00a884)';
        this._btn.style.color = 'var(--on-primary,#fff)';
        this._btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px;animation:pulse 1s infinite">mic</span>';
      } else {
        this._btn.style.background = 'transparent';
        this._btn.style.color = 'var(--on-surface-variant,#8696a0)';
        this._btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">mic</span>';
      }
    }
  };

  window.SpeechToText = SpeechToText;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SpeechToText.init());
  } else {
    setTimeout(() => SpeechToText.init(), 1000);
  }
})();
