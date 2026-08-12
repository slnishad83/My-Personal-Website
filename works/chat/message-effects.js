/* ============================================================
   MESSAGE EFFECTS — WhatsApp-style message reaction effects.
   Adds an effect picker to the composer, stamps the chosen
   effect onto the message doc (cleartext `effect` field) and
   plays an animation when the message renders / arrives.
   chat-core calls MessageEffects.takePending() on send and
   chipHTML()/playOnRow() on render. This module is a no-op if
   it is not loaded.
   ============================================================ */
(function () {
  'use strict';

  var EFFECTS = {
    confetti: { emoji: '🎉', name: 'Confetti', anim: 'fx-confetti' },
    hearts:   { emoji: '❤️', name: 'Hearts',   anim: 'fx-hearts' },
    fire:     { emoji: '🔥', name: 'Fire',     anim: 'fx-fire' },
    party:    { emoji: '🎊', name: 'Party',    anim: 'fx-party' },
    laugh:    { emoji: '😂', name: 'Haha',     anim: 'fx-laugh' },
    love:     { emoji: '😍', name: 'Love',     anim: 'fx-love' }
  };

  var _pendingEffect = null;
  var _playedIds = {};
  var _pickerEl = null;

  function _effect(key) {
    return EFFECTS[key] || null;
  }

  function _styles() {
    var css = [
      '.msg-effect-chip{display:inline-flex;align-items:center;gap:4px;margin:4px 0 2px;padding:2px 8px;' +
        'border-radius:10px;background:rgba(0,0,0,0.06);font-size:11px;font-weight:600;color:var(--on-surface-variant,#667781);}',
      '.msg-effect-emoji{display:inline-block;font-size:16px;line-height:1;}',
      '.msg-effect-anim .msg-effect-emoji{animation-duration:1.4s;animation-timing-function:ease-in-out;animation-iteration-count:infinite;}',
      '.fx-confetti{animation-name:fxPopConfetti;}',
      '.fx-hearts{animation-name:fxFloatHearts;}',
      '.fx-fire{animation-name:fxRiseFire;}',
      '.fx-party{animation-name:fxSpinParty;}',
      '.fx-laugh{animation-name:fxShakeLaugh;}',
      '.fx-love{animation-name:fxPulseLove;}',
      '@keyframes fxPopConfetti{0%,100%{transform:translateY(0) rotate(0)}20%{transform:translateY(-6px) rotate(12deg)}40%{transform:translateY(0) rotate(-8deg)}60%{transform:translateY(-4px) rotate(6deg)}80%{transform:translateY(0) rotate(-4deg)}}',
      '@keyframes fxFloatHearts{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-7px) scale(1.25)}}',
      '@keyframes fxRiseFire{0%,100%{transform:translateY(0) rotate(0) scale(1)}50%{transform:translateY(-5px) rotate(20deg) scale(1.2)}}',
      '@keyframes fxSpinParty{0%{transform:rotate(0) scale(1)}50%{transform:rotate(180deg) scale(1.3)}100%{transform:rotate(360deg) scale(1)}}',
      '@keyframes fxShakeLaugh{0%,100%{transform:rotate(0)}25%{transform:rotate(14deg)}50%{transform:rotate(-12deg)}75%{transform:rotate(8deg)}}',
      '@keyframes fxPulseLove{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}',
      '#fx-picker{position:absolute;bottom:calc(100% + 8px);right:8px;z-index:60;display:flex;gap:4px;flex-wrap:wrap;' +
        'max-width:210px;padding:8px;background:var(--surface-container-high,#fff);border-radius:14px;' +
        'box-shadow:0 4px 20px rgba(0,0,0,0.18);animation:fxFadeIn 0.15s ease;}',
      '#fx-picker button{background:var(--surface-container,#f0f2f5);border:none;border-radius:10px;padding:6px 8px;' +
        'font-size:18px;cursor:pointer;transition:transform 0.12s ease;}',
      '#fx-picker button:hover{transform:scale(1.18);}',
      '#fx-picker .fx-none{font-size:12px;font-weight:600;color:var(--on-surface-variant,#667781);}',
      '@keyframes fxFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
      '.fx-picker-btn{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;' +
        'border-radius:50%;border:none;background:transparent;color:var(--on-surface-variant,#8696a0);' +
        'cursor:pointer;font-size:16px;transition:background 0.15s ease;}',
      '.fx-picker-btn:hover{background:var(--surface-container,#f0f2f5);}',
      '.fx-picker-btn.fx-active{background:rgba(0,168,132,0.15);color:var(--primary,#00a884);}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'msg-effects-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function chipHTML(effect) {
    var fx = typeof effect === 'string' ? _effect(effect) : _effect(effect && effect.key);
    if (!fx) return '';
    return '<span class="msg-effect-chip"><span class="msg-effect-emoji">' + fx.emoji + '</span>' +
      '<span>' + fx.name + '</span></span>';
  }

  function playOnRow(row, msg) {
    if (!row || !msg) return;
    var fx = _effect(msg.effect && msg.effect.key);
    if (!fx) return;
    var key = msg.id || (msg.clientId || '');
    if (_playedIds[key]) return;
    _playedIds[key] = true;
    var chip = row.querySelector('.msg-effect-chip');
    if (!chip) return;
    var bubble = row.querySelector('.message-bubble, .msg-bubble');
    if (bubble) bubble.classList.add('msg-effect-anim', fx.anim);
  }

  function takePending() {
    var fx = _pendingEffect;
    _pendingEffect = null;
    return fx;
  }

  function _setActive() {
    if (_pickerEl && _pendingEffect) {
      _pickerEl.classList.add('fx-active');
      _pickerEl.title = 'Effect: ' + (_effect(_pendingEffect.key) || {}).name || 'Effect';
    } else if (_pickerEl) {
      _pickerEl.classList.remove('fx-active');
      _pickerEl.title = 'Add an effect';
    }
  }

  function _closePicker() {
    var p = document.getElementById('fx-picker');
    if (p) p.remove();
  }

  function _openPicker(anchor) {
    _closePicker();
    var picker = document.createElement('div');
    picker.id = 'fx-picker';
    var html = '<button class="fx-none" title="No effect" data-key="">✕</button>';
    Object.keys(EFFECTS).forEach(function (k) {
      var fx = EFFECTS[k];
      html += '<button title="' + fx.name + '" data-key="' + k + '">' + fx.emoji + '</button>';
    });
    picker.innerHTML = html;
    picker.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('button[data-key]');
      if (!btn) return;
      var k = btn.getAttribute('data-key');
      _pendingEffect = k ? { key: k, emoji: EFFECTS[k].emoji, name: EFFECTS[k].name } : null;
      _closePicker();
      _setActive();
    });
    document.body.appendChild(picker);
    var r = anchor.getBoundingClientRect();
    var pRect = picker.getBoundingClientRect();
    var top = r.top - pRect.height - 8;
    var left = r.right - pRect.width;
    picker.style.position = 'fixed';
    picker.style.top = Math.max(8, top) + 'px';
    picker.style.left = Math.max(8, left) + 'px';
    picker.style.bottom = 'auto';
    picker.style.right = 'auto';
  }

  function attachPicker() {
    if (document.getElementById('fx-picker-btn')) return;
    var composer = document.getElementById('chatFooter') ||
      document.getElementById('inputArea') ||
      document.querySelector('.chat-input-area, .input-container, [data-panel="toolbar"], [class*="input-bar"], [class*="composer"]');
    if (!composer) return;
    if (composer.querySelector('.fx-picker-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'fx-picker-btn';
    btn.type = 'button';
    btn.className = 'fx-picker-btn';
    btn.title = 'Add an effect';
    btn.innerHTML = '✨';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (document.getElementById('fx-picker')) { _closePicker(); return; }
      _openPicker(btn);
    });
    _pickerEl = btn;

    var insert = function () {
      var toolbar = composer.querySelector('[data-panel="toolbar"]') ||
        composer.querySelector('[class*="toolbar"]:not(.fx-picker-btn), [class*="actions"], [class*="icons"]');
      if (toolbar) { toolbar.appendChild(btn); return true; }
      return false;
    };
    if (!insert()) {
      var inputArea = composer.querySelector('textarea, [contenteditable="true"], input');
      composer.insertBefore(btn, inputArea || composer.firstChild);
    }
    _setActive();
  }

  function _init() {
    _styles();
    var tryAttach = function () {
      if (!document.body) { setTimeout(tryAttach, 200); return; }
      attachPicker();
      var observer = new MutationObserver(function () {
        if (!document.getElementById('fx-picker-btn')) attachPicker();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };
    tryAttach();

    document.addEventListener('click', function (e) {
      if (document.getElementById('fx-picker') && !e.target.closest('#fx-picker') && !e.target.closest('.fx-picker-btn')) {
        _closePicker();
      }
    });
  }

  window.MessageEffects = {
    EFFECTS: EFFECTS,
    chipHTML: chipHTML,
    playOnRow: playOnRow,
    takePending: takePending
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
