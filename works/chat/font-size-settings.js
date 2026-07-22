/* ============================================================
   FONT SIZE SETTINGS — WhatsApp-style S/M/L/XL text sizing
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'nsl_chat_font_size';
  var SIZES = {
    small:   { label: 'Small',   scale: 0.85, inputPx: 14, bodyPx: 13 },
    medium:  { label: 'Medium',  scale: 1,    inputPx: 16, bodyPx: 14 },
    large:   { label: 'Large',   scale: 1.15, inputPx: 18, bodyPx: 16 },
    xlarge:  { label: 'Extra Large', scale: 1.3, inputPx: 20, bodyPx: 18 }
  };

  function _getSaved() {
    try { return localStorage.getItem(STORAGE_KEY) || 'medium'; } catch (_) { return 'medium'; }
  }

  function _apply(size) {
    var s = SIZES[size] || SIZES.medium;
    var root = document.documentElement;
    root.style.setProperty('--chat-font-scale', s.scale);
    root.style.setProperty('--chat-font-body', s.bodyPx + 'px');
    root.style.setProperty('--chat-font-input', s.inputPx + 'px');
    var labelEl = document.getElementById('font-size-label');
    if (labelEl) labelEl.textContent = s.label;
    try { localStorage.setItem(STORAGE_KEY, size); } catch (_) {}
    var chatMsgs = document.getElementById('messages-wrap');
    if (chatMsgs) chatMsgs.style.fontSize = s.bodyPx + 'px';
    var msgInput = document.getElementById('msg-input');
    if (msgInput) msgInput.style.fontSize = s.inputPx + 'px';
  }

  function _buildUI() {
    var overlay = document.createElement('div');
    overlay.id = 'font-size-overlay';
    overlay.className = 'overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Font Size');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:50;display:none;';
    var current = _getSaved();
    var optionsHtml = '';
    Object.keys(SIZES).forEach(function (key) {
      var s = SIZES[key];
      var checked = key === current ? 'checked' : '';
      var previewPx = Math.round(14 * s.scale);
      optionsHtml += '<label class="flex items-center justify-between p-3 cursor-pointer hover:bg-surface-container-high/40 rounded-lg transition-colors">' +
        '<div class="flex items-center gap-3">' +
        '<input type="radio" name="font-size-radio" value="' + key + '" ' + checked + ' class="accent-primary w-4 h-4">' +
        '<div><span class="text-sm font-bold">' + s.label + '</span>' +
        '<p class="text-xs text-on-surface-variant mt-0.5" style="font-size:' + previewPx + 'px">Preview text</p></div></div>' +
        '</label>';
    });
    overlay.innerHTML = '<div class="bg-surface-container w-full max-w-md rounded-t-2xl md:rounded-2xl p-0 shadow-2xl overflow-hidden">' +
      '<div class="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">' +
      '<h3 class="font-headline-md text-headline-md font-bold text-on-surface">Font Size</h3>' +
      '<button class="p-2 rounded-full hover:bg-surface-container-high transition-colors" onclick="document.getElementById(\'font-size-overlay\').style.display=\'none\'">' +
      '<span class="material-symbols-outlined">close</span></button></div>' +
      '<div class="p-3 space-y-1">' + optionsHtml + '</div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.style.display = 'none';
    });
    var radios = overlay.querySelectorAll('input[name="font-size-radio"]');
    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        _apply(radio.value);
      });
    });
    return overlay;
  }

  window.openFontSizeSettings = function () {
    var existing = document.getElementById('font-size-overlay');
    var overlay = existing || _buildUI();
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'flex-end';
    if (window.innerWidth >= 768) overlay.style.alignItems = 'center';
    requestAnimationFrame(function () { overlay.style.opacity = '1'; });
  };

  window.FontSizeSettings = { apply: _apply, getSaved: _getSaved, SIZES: SIZES };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { _apply(_getSaved()); });
  } else {
    _apply(_getSaved());
  }
})();
