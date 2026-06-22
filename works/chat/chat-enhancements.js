/* ============================================================
   CHAT ENHANCEMENTS v3 — nishadsl.com/works/chat
   · Truly universal dark mode (theme-color, OS sync)
   · All file types: image / video / audio / document preview
   · Scroll-to-latest: all devices, browsers, PWA
   ============================================================ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     DARK MODE — UNIVERSAL EXTRAS
     The CSS handles color-scheme and visual overrides.
     JS handles:
       1. <meta name="theme-color"> — controls the browser
          address bar and PWA title bar colour on every
          mobile browser and installed app.
       2. OS dark-mode sync — if the user hasn't manually
          toggled dark mode, mirror the OS preference.
     ══════════════════════════════════════════════════════════ */

  var DARK_THEME  = '#0b141a';   /* dark mode browser chrome */
  var LIGHT_THEME = '#008069';   /* light mode browser chrome */

  /** Update <meta name="theme-color"> for mobile & PWA chrome */
  function syncThemeColor(isDark) {
    var existing = document.querySelector('meta[name="theme-color"]');
    var meta = existing || document.createElement('meta');
    if (!existing) {
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = isDark ? DARK_THEME : LIGHT_THEME;

    /* Also update apple-mobile-web-app-status-bar-style */
    var appleBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!appleBar) {
      appleBar = document.createElement('meta');
      appleBar.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(appleBar);
    }
    appleBar.content = isDark ? 'black-translucent' : 'default';
  }

  /** Returns true when body has .dark class */
  function isDark() {
    return document.body.classList.contains('dark');
  }

  /* Watch body class changes to sync theme-color automatically */
  var darkWatcher = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        var dark = isDark();
        syncThemeColor(dark);
        refreshDocIconColors(dark);
      }
    });
  });

  /**
   * OS-level dark-mode sync.
   * If the user has never manually toggled dark mode (no localStorage key),
   * automatically match the OS/system preference.
   * Once the user toggles it manually, we respect their choice forever.
   */
  function setupOsSync() {
    var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (!mq) return;

    /* Only auto-apply if no manual preference is saved */
    if (localStorage.getItem('darkMode') === null) {
      if (mq.matches && !isDark()) {
        document.body.classList.add('dark');
      } else if (!mq.matches && isDark()) {
        document.body.classList.remove('dark');
      }
    }

    /* When the OS theme changes, follow it — but only if the user
       hasn't manually set a preference (localStorage not yet set) */
    mq.addEventListener('change', function (e) {
      if (localStorage.getItem('darkMode') === null) {
        document.body.classList.toggle('dark', e.matches);
        syncThemeColor(e.matches);
      }
    });
  }


  /* ══════════════════════════════════════════════════════════
     FILE-TYPE DETECTION & MEDIA PREVIEWS
     ══════════════════════════════════════════════════════════ */

  var TYPES = {
    image:   /\.(png|jpe?g|gif|webp|avif|bmp|heic|heif|svg|tiff?)(\?.*)?$/i,
    video:   /\.(mp4|mov|webm|avi|mkv|ogv|3gp|m4v|wmv|flv)(\?.*)?$/i,
    audio:   /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba|aiff?|wma|caf)(\?.*)?$/i,
    pdf:     /\.pdf(\?.*)?$/i,
    word:    /\.(docx?|odt|rtf)(\?.*)?$/i,
    excel:   /\.(xlsx?|ods|csv)(\?.*)?$/i,
    ppt:     /\.(pptx?|odp|key)(\?.*)?$/i,
    archive: /\.(zip|rar|7z|tar\.gz|tar|gz|bz2|xz)(\?.*)?$/i,
    code:    /\.(json|xml|html?|css|js|ts|py|java|cpp|c|md|ya?ml|txt)(\?.*)?$/i,
  };

  /* Light-mode icon colours */
  var DOC_COLOR = {
    pdf:     { bg: '#ffebee', fg: '#c62828' },
    word:    { bg: '#e3f2fd', fg: '#1565c0' },
    excel:   { bg: '#e8f5e9', fg: '#2e7d32' },
    ppt:     { bg: '#fff3e0', fg: '#e65100' },
    archive: { bg: '#fff8e1', fg: '#f57f17' },
    code:    { bg: '#f3e5f5', fg: '#6a1b9a' },
  };

  /* Dark-mode icon colours */
  var DOC_COLOR_DARK = {
    pdf:     { bg: '#4a0000', fg: '#ef9a9a' },
    word:    { bg: '#0d2137', fg: '#90caf9' },
    excel:   { bg: '#0a2010', fg: '#a5d6a7' },
    ppt:     { bg: '#3e1a00', fg: '#ffcc80' },
    archive: { bg: '#3e2800', fg: '#ffe082' },
    code:    { bg: '#1a0030', fg: '#ce93d8' },
  };

  function detectType(name, href) {
    var s = name + '|' + href;
    for (var t in TYPES) if (TYPES[t].test(s)) return t;
    return null;
  }

  function enhanceCard(card) {
    if (card.dataset.ceDone) return;
    card.dataset.ceDone = '1';

    var nameEl   = card.querySelector('.file-attachment-name');
    var filename = nameEl ? nameEl.textContent.trim() : '';
    var href     = card.getAttribute('href') || card.getAttribute('data-preview-url') || '';
    var type     = detectType(filename, href);

    card.setAttribute('data-ce-type', type || 'file');

    switch (type) {
      case 'image': addImagePreview(card, href, filename); break;
      case 'video': addVideoPreview(card, href, filename); break;
      case 'audio': addAudioPlayer(card, href);            break;
      default:      colorDocIcon(card, type);
    }
  }

  function addImagePreview(card, href, filename) {
    var wrap = document.createElement('div');
    wrap.className = 'ce-preview';
    var img = document.createElement('img');
    img.className = 'ce-preview-img';
    img.src = href;  img.alt = filename;
    img.loading = 'lazy';  img.decoding = 'async';
    img.onerror = function () {
      wrap.style.display = 'none';
      card.classList.remove('has-image-preview');
    };
    wrap.appendChild(img);
    card.insertBefore(wrap, card.firstChild);
    card.classList.add('has-image-preview');
  }

  function addVideoPreview(card, href, filename) {
    var wrap = document.createElement('div');
    wrap.className = 'ce-preview';
    var vid = document.createElement('video');
    vid.className = 'ce-preview-video';
    vid.src = href;  vid.preload = 'metadata';
    vid.muted = true;  vid.playsInline = true;
    vid.setAttribute('playsinline', '');
    vid.addEventListener('loadedmetadata', function () { vid.currentTime = 0.5; });
    var overlay = document.createElement('div');
    overlay.className = 'ce-play-overlay';
    overlay.innerHTML = '&#9654;';
    overlay.setAttribute('aria-hidden', 'true');
    wrap.appendChild(vid);  wrap.appendChild(overlay);
    card.insertBefore(wrap, card.firstChild);
    card.classList.add('has-video-preview');
  }

  function addAudioPlayer(card, href) {
    if (card.querySelector('audio')) return;
    var wrap = document.createElement('div');
    wrap.className = 'ce-audio-player';
    var audio = document.createElement('audio');
    audio.src = href;  audio.controls = true;  audio.preload = 'metadata';
    wrap.appendChild(audio);
    card.appendChild(wrap);
    card.classList.add('has-audio-card');
  }

  function colorDocIcon(card, type) {
    if (!type || !(type in DOC_COLOR)) return;
    var iconEl = card.querySelector('.file-attachment-icon');
    if (!iconEl || iconEl.dataset.ceColoured) return;
    iconEl.dataset.ceColoured = '1';
    applyIconColor(iconEl, type, isDark());
  }

  function applyIconColor(iconEl, type, dark) {
    var palette = (dark ? DOC_COLOR_DARK : DOC_COLOR)[type];
    if (!palette) return;
    iconEl.style.setProperty('background', palette.bg, 'important');
    iconEl.style.setProperty('color', palette.fg, 'important');
  }

  function refreshDocIconColors(dark) {
    document.querySelectorAll('.file-attachment-icon[data-ce-coloured]')
      .forEach(function (iconEl) {
        var card = iconEl.closest('[data-ce-type]');
        if (!card) return;
        applyIconColor(iconEl, card.getAttribute('data-ce-type'), dark);
      });
  }

  function scanCards(root) {
    root = root || document;
    var cards = root.querySelectorAll
      ? root.querySelectorAll('a.file-attachment-card:not([data-ce-done])') : [];
    Array.prototype.forEach.call(cards, enhanceCard);
  }

  var cardObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('a.file-attachment-card')) enhanceCard(node);
        else scanCards(node);
      });
    });
  });


  /* ══════════════════════════════════════════════════════════
     SCROLL-TO-LATEST BUTTON — LABELED PILL
     ══════════════════════════════════════════════════════════ */

  function enhanceScrollBtn() {
    var btn = document.getElementById('jumpToBottomBtn');
    if (!btn || btn.dataset.ceEnhanced) return;
    btn.dataset.ceEnhanced = '1';
    btn.innerHTML =
      '<span class="jtb-arrow" aria-hidden="true">&#8595;</span>' +
      '<span class="jtb-label">Latest messages</span>';
    btn.title = 'Jump to latest messages';
    btn.setAttribute('aria-label', 'Jump to latest messages');
  }

  var btnObserver = new MutationObserver(function () { enhanceScrollBtn(); });


  /* ══════════════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════════════ */

  function init() {
    /* Dark mode extras */
    syncThemeColor(isDark());
    setupOsSync();
    darkWatcher.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    /* File-card media previews */
    scanCards();
    cardObserver.observe(document.body, { childList: true, subtree: true });

    /* Scroll button */
    enhanceScrollBtn();
    var anchor = document.getElementById('chatMain')
               || document.querySelector('.chat-main')
               || document.body;
    btnObserver.observe(anchor, { childList: true, subtree: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
