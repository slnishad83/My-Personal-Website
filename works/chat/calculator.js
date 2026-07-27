/**
 * NSL Chat Interactive Calculator Addon
 * Creates a floating, draggable calculator widget with direct chat input integration.
 */
(function() {
  let calcEl = null;
  let isDragging = false;
  let startX = 0, startY = 0;
  let _dragCleanup = null;
  let _keyHandler = null;

  // Calculator State
  let expression = '';
  let result = '0';
  let history = [];

  function init() {
    injectCalculatorStyles();
    createCalculatorDOM();
    bindDragEvents();
    bindCalculatorEvents();
  }

  function injectCalculatorStyles() {
    if (document.getElementById('calc-styles')) return;
    const style = document.createElement('style');
    style.id = 'calc-styles';
    style.textContent = `
      .calc-widget {
        position: fixed;
        right: 24px;
        top: 80px;
        width: 300px;
        background: var(--surface-container-highest, #222e35);
        border: 1px solid var(--outline-variant, rgba(134, 150, 160, 0.15));
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        z-index: 9000;
        display: none;
        flex-direction: column;
        user-select: none;
        overflow: hidden;
        font-family: var(--font-body-md, "Inter", sans-serif);
      }
      @media (max-width: 600px) {
        .calc-widget {
          right: 12px !important;
          left: 12px !important;
          width: auto !important;
          max-width: 400px;
          bottom: calc(76px + env(safe-area-inset-bottom, 0px)) !important;
          top: auto !important;
          border-radius: 16px 16px 0 0;
        }
      }
      @media (min-width: 601px) and (max-width: 900px) {
        .calc-widget {
          width: 320px;
        }
      }
      html:not(.dark) .calc-widget {
        background: var(--surface-container-highest, #ffffff);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      }
      .calc-header {
        background: var(--brand, #008069);
        color: #ffffff;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: move;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .calc-header-btn {
        background: transparent;
        border: none;
        color: #ffffff;
        cursor: pointer;
        opacity: 0.8;
        padding: 2px;
        min-width: 44px;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.15s;
      }
      .calc-header-btn:hover {
        opacity: 1;
      }
      .calc-display-area {
        padding: 14px;
        background: rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: center;
        min-height: 80px;
        border-bottom: 1px solid var(--outline-variant, rgba(134, 150, 160, 0.08));
      }
      html:not(.dark) .calc-display-area {
        background: rgba(0, 0, 0, 0.02);
      }
      .calc-expr {
        font-size: 13px;
        color: var(--text-secondary, #8696a0);
        min-height: 18px;
        word-break: break-all;
        text-align: right;
        margin-bottom: 4px;
        font-family: var(--font-timestamp, monospace);
      }
      .calc-result {
        font-size: 24px;
        font-weight: 600;
        color: var(--text, #d1d7db);
        word-break: break-all;
        text-align: right;
        font-family: var(--font-timestamp, monospace);
      }
      html:not(.dark) .calc-result {
        color: #111b21;
      }
      .calc-buttons {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        padding: 12px;
      }
      .calc-btn {
        background: var(--surface-container-high, #202c33);
        color: var(--text, #d1d7db);
        border: none;
        border-radius: 8px;
        height: 44px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, transform 0.1s;
        font-family: var(--font-timestamp, monospace);
      }
      .calc-btn:active {
        transform: scale(0.95);
      }
      html:not(.dark) .calc-btn {
        background: var(--surface-container-low, #f0f2f5);
        color: #111b21;
      }
      .calc-btn:hover {
        background: var(--surface-container-highest, #2a3942);
      }
      html:not(.dark) .calc-btn:hover {
        background: #e9edef;
      }
      .calc-btn.operator {
        color: var(--brand, #008069);
        font-weight: 700;
      }
      .calc-btn.action-clear {
        color: #ea0038;
        font-weight: 700;
      }
      .calc-btn.action-equal {
        background: var(--brand, #008069);
        color: #ffffff;
        font-weight: 700;
      }
      .calc-btn.action-equal:hover {
        opacity: 0.9;
      }
      .calc-share-bar {
        display: flex;
        gap: 6px;
        padding: 0 12px 12px 12px;
      }
      .calc-share-btn {
        flex: 1;
        background: var(--brand-soft, rgba(0, 128, 105, 0.12));
        color: var(--brand, #008069);
        border: none;
        border-radius: 8px;
        padding: 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        transition: all 0.15s;
      }
      .calc-share-btn:hover {
        background: var(--brand, #008069);
        color: #ffffff;
      }
    `;
    document.head.appendChild(style);
  }

  function createCalculatorDOM() {
    if (document.getElementById('calc-widget')) return;

    calcEl = document.createElement('div');
    calcEl.id = 'calc-widget';
    calcEl.className = 'calc-widget';
    calcEl.innerHTML = `
      <div class="calc-header" id="calc-header">
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="material-symbols-outlined" style="font-size:16px;">calculate</span>
          <span>Calculator</span>
        </div>
        <button class="calc-header-btn" data-action="toggleCalculator" title="Close">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      </div>
      <div class="calc-display-area">
        <div class="calc-expr" id="calc-expr"></div>
        <div class="calc-result" id="calc-result">0</div>
      </div>
      <div class="calc-buttons">
        <button class="calc-btn action-clear" data-val="C">C</button>
        <button class="calc-btn operator" data-val="(">(</button>
        <button class="calc-btn operator" data-val=")">)</button>
        <button class="calc-btn operator" data-val="backspace"><span class="material-symbols-outlined" style="font-size:18px;">backspace</span></button>
        
        <button class="calc-btn" data-val="7">7</button>
        <button class="calc-btn" data-val="8">8</button>
        <button class="calc-btn" data-val="9">9</button>
        <button class="calc-btn operator" data-val="/">/</button>
        
        <button class="calc-btn" data-val="4">4</button>
        <button class="calc-btn" data-val="5">5</button>
        <button class="calc-btn" data-val="6">6</button>
        <button class="calc-btn operator" data-val="*">*</button>
        
        <button class="calc-btn" data-val="1">1</button>
        <button class="calc-btn" data-val="2">2</button>
        <button class="calc-btn" data-val="3">3</button>
        <button class="calc-btn operator" data-val="-">-</button>
        
        <button class="calc-btn" data-val="0">0</button>
        <button class="calc-btn" data-val=".">.</button>
        <button class="calc-btn action-equal" data-val="=">=</button>
        <button class="calc-btn operator" data-val="+">+</button>
      </div>
      <div class="calc-share-bar">
        <button class="calc-share-btn" id="calc-share-result" title="Paste just the final result into chat">
          <span class="material-symbols-outlined" style="font-size:14px;">content_copy</span>Result
        </button>
        <button class="calc-share-btn" id="calc-share-full" title="Paste the formula and result into chat">
          <span class="material-symbols-outlined" style="font-size:14px;">send</span>Full Formula
        </button>
      </div>
    `;
    document.body.appendChild(calcEl);
  }

  function bindDragEvents() {
    const header = document.getElementById('calc-header');
    if (!header) return;

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);

    header.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('touchend', dragEnd);

    _dragCleanup = function () {
      header.removeEventListener('mousedown', dragStart);
      document.removeEventListener('mousemove', dragMove);
      document.removeEventListener('mouseup', dragEnd);
      header.removeEventListener('touchstart', dragStart);
      document.removeEventListener('touchmove', dragMove);
      document.removeEventListener('touchend', dragEnd);
    };
  }

  function dragStart(e) {
    if (e.target.closest('.calc-header-btn')) return;
    isDragging = true;
    
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    
    const rect = calcEl.getBoundingClientRect();
    startX = clientX - rect.left;
    startY = clientY - rect.top;
    
    if (e.cancelable) e.preventDefault();
  }

  function dragMove(e) {
    if (!isDragging) return;
    
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    
    let x = clientX - startX;
    let y = clientY - startY;

    // Viewport constraints
    const maxW = window.innerWidth - calcEl.offsetWidth;
    const maxH = window.innerHeight - calcEl.offsetHeight;

    x = Math.max(0, Math.min(x, maxW));
    y = Math.max(0, Math.min(y, maxH));

    calcEl.style.left = `${x}px`;
    calcEl.style.top = `${y}px`;
    calcEl.style.right = 'auto'; // Break initial right positioning
    
    if (e.cancelable) e.preventDefault();
  }

  function dragEnd() {
    isDragging = false;
  }

  function bindCalculatorEvents() {
    // Buttons Click Handler
    calcEl.querySelectorAll('.calc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        handleInput(val);
      });
    });

    // Paste Result Button
    document.getElementById('calc-share-result').addEventListener('click', () => {
      insertIntoChat(result);
    });

    // Paste Full Formula Button
    document.getElementById('calc-share-full').addEventListener('click', () => {
      if (expression) {
        insertIntoChat(`${expression} = ${result}`);
      } else {
        insertIntoChat(result);
      }
    });

    // Keyboard support (stored reference for cleanup)
    _keyHandler = function (e) {
      if (!calcEl || calcEl.style.display !== 'flex') return;
      const key = e.key;
      if (/[0-9.+\-*/()]/.test(key)) {
        e.preventDefault();
        handleInput(key);
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleInput('=');
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleInput('backspace');
      } else if (key === 'Escape') {
        toggleCalculator();
      } else if (key.toLowerCase() === 'c') {
        handleInput('C');
      }
    };
    document.addEventListener('keydown', _keyHandler);
  }

  function handleInput(val) {
    const exprDiv = document.getElementById('calc-expr');
    const resultDiv = document.getElementById('calc-result');

    if (val === 'C') {
      expression = '';
      result = '0';
    } else if (val === 'backspace') {
      expression = expression.slice(0, -1);
    } else if (val === '=') {
      try {
        if (expression) {
          result = evaluateExpression(expression);
          // Add to log
          history.push(`${expression} = ${result}`);
          if (history.length > 10) history.shift();
        }
      } catch (err) {
        result = 'Error';
      }
    } else {
      // Prevent consecutive operators
      const ops = ['+', '-', '*', '/'];
      const lastChar = expression.slice(-1);
      if (ops.includes(val) && ops.includes(lastChar)) {
        expression = expression.slice(0, -1) + val;
      } else {
        expression += val;
      }
    }

    exprDiv.textContent = expression;
    resultDiv.textContent = result;
  }

  function evaluateExpression(expr) {
    let cleanExpr = expr.replace(/x/g, '*').replace(/÷/g, '/');
    if (!/^[0-9+\-*/().\s]+$/.test(cleanExpr)) {
      throw new Error('Invalid characters');
    }
    var val = _safeEval(cleanExpr);
    if (val === undefined || isNaN(val) || !isFinite(val)) {
      throw new Error('Math error');
    }
    return Number(val.toFixed(8)).toString();
  }

  /* ── Safe math expression evaluator (no eval / no Function) ──── */
  function _safeEval(expr) {
    var tokens = _tokenize(expr);
    var pos = 0;

    function peek() { return pos < tokens.length ? tokens[pos] : null; }
    function consume() { return tokens[pos++]; }

    function parseExpr() {
      var left = parseTerm();
      while (peek() === '+' || peek() === '-') {
        var op = consume();
        var right = parseTerm();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    }

    function parseTerm() {
      var left = parseFactor();
      while (peek() === '*' || peek() === '/') {
        var op = consume();
        var right = parseFactor();
        if (op === '*') left = left * right;
        else {
          if (right === 0) throw new Error('Division by zero');
          left = left / right;
        }
      }
      return left;
    }

    function parseFactor() {
      var token = peek();
      if (token === '(') {
        consume();
        var val = parseExpr();
        if (consume() !== ')') throw new Error('Mismatched parentheses');
        return val;
      }
      if (token === '-') {
        consume();
        return -parseFactor();
      }
      if (token === '+') {
        consume();
        return parseFactor();
      }
      if (token !== null && /^[0-9]*\.?[0-9]+$/.test(token)) {
        return parseFloat(consume());
      }
      throw new Error('Unexpected token: ' + token);
    }

    var result = parseExpr();
    if (pos < tokens.length) throw new Error('Unexpected trailing characters');
    return result;
  }

  function _tokenize(expr) {
    var tokens = [];
    var i = 0;
    var s = expr.replace(/\s+/g, '');
    while (i < s.length) {
      if ('+-*/()'.indexOf(s[i]) !== -1) {
        tokens.push(s[i]);
        i++;
      } else if (/[0-9.]/.test(s[i])) {
        var num = '';
        while (i < s.length && /[0-9.]/.test(s[i])) { num += s[i]; i++; }
        tokens.push(num);
      } else {
        throw new Error('Unexpected character: ' + s[i]);
      }
    }
    return tokens;
  }

  function insertIntoChat(text) {
    const textarea = document.getElementById('msg-input');
    if (!textarea) {
      if (typeof showToast === 'function') showToast('Open a chat to share results!', 'warning');
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    
    textarea.value = val.substring(0, start) + text + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
    
    // Trigger textarea auto-grow input change event
    if (typeof window.onInputChange === 'function') {
      window.onInputChange();
    } else {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Expose global controller
  /* ── Destroy: clean up all listeners ────────────────────────────── */
  function destroyCalculator() {
    if (_dragCleanup) { _dragCleanup(); _dragCleanup = null; }
    if (_keyHandler) { document.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
    if (calcEl) { calcEl.remove(); calcEl = null; }
    var styleEl = document.getElementById('calc-styles');
    if (styleEl) styleEl.remove();
  }

  window.toggleCalculator = function() {
    if (!calcEl) {
      init();
    }

    if (calcEl.style.display === 'flex') {
      calcEl.style.display = 'none';
    } else {
      calcEl.style.display = 'flex';
      if (calcEl.style.left === '') {
        if (window.innerWidth <= 600) {
          calcEl.style.left = '12px';
          calcEl.style.right = '12px';
          calcEl.style.top = 'auto';
        } else {
          calcEl.style.right = '24px';
          calcEl.style.top = '80px';
        }
      }
    }
  };

  window.CalculatorWidget = { destroy: destroyCalculator };

})();
