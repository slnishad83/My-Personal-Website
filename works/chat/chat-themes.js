'use strict';
(function () {
  var STORAGE_KEY = 'nsl_chat_themes';

  var THEMES = [
    { id: 'default',  name: 'Default',  emoji: '💬', sent: null,           received: null,           header: null },
    { id: 'ocean',    name: 'Ocean',    emoji: '🌊', sent: '#0077b6',      received: '#023e8a',      header: '#0077b6' },
    { id: 'sunset',   name: 'Sunset',   emoji: '🌅', sent: '#e63946',      received: '#457b9d',      header: '#e63946' },
    { id: 'forest',   name: 'Forest',   emoji: '🌲', sent: '#2d6a4f',      received: '#40916c',      header: '#2d6a4f' },
    { id: 'lavender', name: 'Lavender', emoji: '💜', sent: '#7b2cbf',      received: '#9d4edd',      header: '#7b2cbf' },
    { id: 'midnight', name: 'Midnight', emoji: '🌙', sent: '#1a1a2e',      received: '#16213e',      header: '#1a1a2e' },
    { id: 'rose',     name: 'Rose',     emoji: '🌹', sent: '#c9184a',      received: '#ff758f',      header: '#c9184a' },
    { id: 'mint',     name: 'Mint',     emoji: '🍃', sent: '#00b4d8',      received: '#90e0ef',      header: '#00b4d8' },
    { id: 'amber',    name: 'Amber',    emoji: '🔥', sent: '#e85d04',      received: '#fb8500',      header: '#e85d04' },
    { id: 'slate',    name: 'Slate',    emoji: '🪨', sent: '#334155',      received: '#475569',      header: '#334155' },
    { id: 'teal',     name: 'Teal',     emoji: '💎', sent: '#0d9488',      received: '#14b8a6',      header: '#0d9488' },
    { id: 'crimson',  name: 'Crimson',  emoji: '❤️', sent: '#dc2626',      received: '#f87171',      header: '#dc2626' },
  ];

  var _chatThemes = {};
  var _activeOverlay = null;

  function _load() {
    try { _chatThemes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (_) { _chatThemes = {}; }
  }

  function _persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_chatThemes)); }
    catch (_) {}
  }

  function _ensureStyles() {
    if (document.getElementById('nsl-chat-themes-css')) return;
    var s = document.createElement('style');
    s.id = 'nsl-chat-themes-css';
    s.textContent =
      '.nsl-theme-picker{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);animation:nslFadeIn .2s ease}' +
      '.nsl-theme-sheet{background:var(--surface-container,#1e1e2e);border-radius:20px;padding:20px;max-width:380px;width:90vw;max-height:80vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.4);animation:nslSlideUp .25s ease}' +
      '.nsl-theme-title{font-size:16px;font-weight:700;color:var(--on-surface,#e9edef);margin-bottom:16px;text-align:center}' +
      '.nsl-theme-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}' +
      '.nsl-theme-swatch{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;border-radius:14px;border:2px solid transparent;cursor:pointer;transition:all .15s;background:var(--surface-container-high,#2a2a3a)}' +
      '.nsl-theme-swatch:hover{transform:scale(1.05);border-color:var(--outline-variant,#555)}' +
      '.nsl-theme-swatch.active{border-color:var(--primary,#6750A4);background:rgba(103,80,164,0.15)}' +
      '.nsl-theme-swatch .nsl-ts-preview{display:flex;gap:3px}' +
      '.nsl-theme-swatch .nsl-ts-dot{width:18px;height:18px;border-radius:50%;border:1px solid rgba(255,255,255,0.1)}' +
      '.nsl-theme-swatch .nsl-ts-name{font-size:11px;font-weight:600;color:var(--on-surface-variant,#aaa)}' +
      '.nsl-theme-close{display:block;margin:12px auto 0;padding:8px 24px;border:none;border-radius:10px;background:var(--surface-variant,#333);color:var(--on-surface,#e9edef);font-size:13px;font-weight:600;cursor:pointer}' +
      '@keyframes nslFadeIn{from{opacity:0}to{opacity:1}}' +
      '@keyframes nslSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';
    document.head.appendChild(s);
  }

  function getThemeForChat(chatId) {
    return _chatThemes[chatId] || null;
  }

  function setThemeForChat(chatId, themeId) {
    var theme = THEMES.find(function (t) { return t.id === themeId; });
    if (!theme) return;
    if (theme.id === 'default') {
      delete _chatThemes[chatId];
    } else {
      _chatThemes[chatId] = theme;
    }
    _persist();
    applyTheme(chatId);
  }

  function removeThemeForChat(chatId) {
    delete _chatThemes[chatId];
    _persist();
    clearTheme(chatId);
  }

  function applyTheme(chatId) {
    var container = document.getElementById('messages-wrap')
      || document.getElementById('messagesContainer')
      || document.querySelector('.messages-container');
    if (!container) return;

    var theme = _chatThemes[chatId];
    if (!theme) {
      clearTheme(chatId);
      return;
    }

    container.style.setProperty('--msg-sent-bg', theme.sent, 'important');
    container.style.setProperty('--msg-sent-color', '#fff', 'important');
    container.style.setProperty('--msg-received-bg', theme.received, 'important');
    container.style.setProperty('--msg-received-color', '#fff', 'important');

    var header = document.querySelector('.chat-header');
    if (header && theme.header) {
      header.style.setProperty('background', theme.header, 'important');
    }
  }

  function clearTheme(_chatId) {
    var container = document.getElementById('messages-wrap')
      || document.getElementById('messagesContainer')
      || document.querySelector('.messages-container');
    if (container) {
      container.style.removeProperty('--msg-sent-bg');
      container.style.removeProperty('--msg-sent-color');
      container.style.removeProperty('--msg-received-bg');
      container.style.removeProperty('--msg-received-color');
    }
    var header = document.querySelector('.chat-header');
    if (header) {
      header.style.removeProperty('background');
    }
  }

  function openThemePicker(chatId) {
    _ensureStyles();
    _removeOverlay();

    var currentTheme = _chatThemes[chatId];

    var overlay = document.createElement('div');
    overlay.className = 'nsl-theme-picker';
    overlay.onclick = function (e) { if (e.target === overlay) _removeOverlay(); };

    var sheet = document.createElement('div');
    sheet.className = 'nsl-theme-sheet';

    var title = document.createElement('div');
    title.className = 'nsl-theme-title';
    title.textContent = 'Chat Theme';
    sheet.appendChild(title);

    var grid = document.createElement('div');
    grid.className = 'nsl-theme-grid';

    THEMES.forEach(function (theme) {
      var swatch = document.createElement('div');
      swatch.className = 'nsl-theme-swatch' + (currentTheme && currentTheme.id === theme.id ? ' active' : '') +
        (!currentTheme && theme.id === 'default' ? ' active' : '');

      var preview = document.createElement('div');
      preview.className = 'nsl-ts-preview';
      var dot1 = document.createElement('div');
      dot1.className = 'nsl-ts-dot';
      dot1.style.background = theme.sent || 'var(--primary,#6750A4)';
      var dot2 = document.createElement('div');
      dot2.className = 'nsl-ts-dot';
      dot2.style.background = theme.received || 'var(--surface-container-high,#333)';
      preview.appendChild(dot1);
      preview.appendChild(dot2);
      swatch.appendChild(preview);

      var name = document.createElement('div');
      name.className = 'nsl-ts-name';
      name.textContent = theme.emoji + ' ' + theme.name;
      swatch.appendChild(name);

      swatch.onclick = function () {
        setThemeForChat(chatId, theme.id);
        grid.querySelectorAll('.nsl-theme-swatch').forEach(function (s) { s.classList.remove('active'); });
        swatch.classList.add('active');
        if (typeof showToast === 'function') {
          showToast(theme.id === 'default' ? 'Theme reset to default' : theme.name + ' theme applied', 'success');
        }
        setTimeout(_removeOverlay, 300);
      };

      grid.appendChild(swatch);
    });

    sheet.appendChild(grid);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'nsl-theme-close';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = _removeOverlay;
    sheet.appendChild(closeBtn);

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    _activeOverlay = overlay;
  }

  function _removeOverlay() {
    if (_activeOverlay) {
      _activeOverlay.remove();
      _activeOverlay = null;
    }
  }

  _load();
  _ensureStyles();

  window.ChatThemes = {
    THEMES: THEMES,
    getThemeForChat: getThemeForChat,
    setThemeForChat: setThemeForChat,
    removeThemeForChat: removeThemeForChat,
    applyTheme: applyTheme,
    clearTheme: clearTheme,
    openThemePicker: openThemePicker
  };
})();
