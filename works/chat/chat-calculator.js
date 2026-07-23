'use strict';
/**
 * CHAT CALCULATOR — Inline calculator in chat input
 * Type "=100*5+20" and get the result displayed before sending.
 */
(function () {
  const ChatCalculator = {
    _resultEl: null,
    _lastExpr: '',

    init() {
      this._createResultElement();
      this._observeInput();
    },

    _createResultElement() {
      this._resultEl = document.createElement('div');
      this._resultEl.id = 'chat-calc-result';
      this._resultEl.style.cssText = 'display:none;padding:4px 14px 0;font-size:12px;color:var(--primary,#00a884);font-weight:600;font-family:monospace;';

      const inputBar = document.getElementById('input-bar') || document.querySelector('.chat-input-bar, .input-container');
      if (inputBar) {
        inputBar.parentElement.insertBefore(this._resultEl, inputBar);
      }
    },

    _observeInput() {
      document.addEventListener('input', (e) => {
        if (e.target.id === 'message-input' || e.target.getAttribute('contenteditable') === 'true') {
          const text = (e.target.value || e.target.textContent || '').trim();
          this._evaluateExpression(text);
        }
      });
    },

    _evaluateExpression(text) {
      if (!this._resultEl) return;

      if (!text.startsWith('=')) {
        this._resultEl.style.display = 'none';
        return;
      }

      const expr = text.slice(1).trim();
      if (!expr || expr === this._lastExpr) return;
      this._lastExpr = expr;

      const result = this._safeEval(expr);
      if (result !== null && !isNaN(result) && isFinite(result)) {
        this._resultEl.textContent = '= ' + this._formatNumber(result);
        this._resultEl.style.display = 'block';
        this._resultEl.style.cursor = 'pointer';
        this._resultEl.onclick = () => {
          const input = document.getElementById('message-input') || document.querySelector('[contenteditable="true"], textarea');
          if (input) {
            if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
              input.value = this._formatNumber(result);
            } else {
              input.textContent = this._formatNumber(result);
            }
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          this._resultEl.style.display = 'none';
        };
      } else {
        this._resultEl.style.display = 'none';
      }
    },

    _safeEval(expr) {
      const sanitized = expr.replace(/[^0-9+\-*/().,%^e\s]/g, '');
      if (!sanitized) return null;

      const powered = sanitized.replace(/\^/g, '**');

      try {
        return this._parseExpr(powered, { pos: 0 });
      } catch (_) {
        return null;
      }
    },

    // Recursive descent math parser (no eval/new Function needed)
    _parseExpr(s, st) {
      let val = this._parseTerm(s, st);
      while (st.pos < s.length) {
        const ch = s[st.pos];
        if (ch === '+') { st.pos++; val += this._parseTerm(s, st); }
        else if (ch === '-') { st.pos++; val -= this._parseTerm(s, st); }
        else break;
      }
      return val;
    },

    _parseTerm(s, st) {
      let val = this._parsePower(s, st);
      while (st.pos < s.length) {
        const ch = s[st.pos];
        if (ch === '*') { st.pos++; val *= this._parsePower(s, st); }
        else if (ch === '/') { st.pos++; val /= this._parsePower(s, st); }
        else if (ch === '%') { st.pos++; val %= this._parsePower(s, st); }
        else break;
      }
      return val;
    },

    _parsePower(s, st) {
      let val = this._parseUnary(s, st);
      this._skipWS(s, st);
      if (st.pos + 1 < s.length && s[st.pos] === '*' && s[st.pos + 1] === '*') {
        st.pos += 2;
        val = Math.pow(val, this._parseUnary(s, st));
      }
      return val;
    },

    _parseUnary(s, st) {
      this._skipWS(s, st);
      if (st.pos < s.length && s[st.pos] === '-') { st.pos++; return -this._parseAtom(s, st); }
      if (st.pos < s.length && s[st.pos] === '+') { st.pos++; }
      return this._parseAtom(s, st);
    },

    _parseAtom(s, st) {
      this._skipWS(s, st);
      if (st.pos < s.length && s[st.pos] === '(') {
        st.pos++;
        const val = this._parseExpr(s, st);
        this._skipWS(s, st);
        if (st.pos < s.length && s[st.pos] === ')') st.pos++;
        return val;
      }
      let numStr = '';
      while (st.pos < s.length && /[0-9.eE]/.test(s[st.pos])) {
        numStr += s[st.pos++];
      }
      return numStr ? Number(numStr) : NaN;
    },

    _skipWS(s, st) {
      while (st.pos < s.length && /\s/.test(s[st.pos])) st.pos++;
    },

    _formatNumber(num) {
      if (Number.isInteger(num) && Math.abs(num) < 1e15) {
        return num.toLocaleString();
      }
      const rounded = Math.round(num * 1e10) / 1e10;
      return rounded.toLocaleString(undefined, { maximumFractionDigits: 10 });
    }
  };

  window.ChatCalculator = ChatCalculator;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ChatCalculator.init());
  } else {
    setTimeout(() => ChatCalculator.init(), 1000);
  }
})();
