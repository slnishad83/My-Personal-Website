/* ============================================================
   CHAT ENHANCEMENTS v2 — nishadsl.com/works/chat
   All file types: image · video · audio · document previews
   Scroll-to-latest button: all devices, browsers, PWA
   ============================================================ */
(function () {
  'use strict';

  /* ── File-type patterns ───────────────────────────────────── */
  var TYPES = {
    image:   /\.(png|jpe?g|gif|webp|avif|bmp|heic|heif|svg|tiff?)(\?.*)?$/i,
    video:   /\.(mp4|mov|webm|avi|mkv|ogv|3gp|m4v|wmv|flv)(\?.*)?$/i,
    audio:   /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba|aiff?|wma|caf)(\?.*)?$/i,
    pdf:     /\.pdf(\?.*)?$/i,
    word:    /\.(docx?|odt|rtf)(\?.*)?$/i,
    excel:   /\.(xlsx?|ods|csv)(\?.*)?$/i,
    ppt:     /\.(pptx?|odp|key)(\?.*)?$/i,
    archive: /\.(zip|rar|7z|tar\.gz|tar|gz|bz2|xz)(\?.*)?$/i,
    code:    /\.(json|xml|html?|css|js|ts|py|java|cpp|c|md|yaml|yml|txt)(\?.*)?$/i,
  };

  /* Icon colours per doc type */
  var DOC_STYLE = {
    pdf:     { bg: '#ffebee', fg: '#c62828' },
    word:    { bg: '#e3f2fd', fg: '#1565c0' },
    excel:   { bg: '#e8f5e9', fg: '#2e7d32' },
    ppt:     { bg: '#fff3e0', fg: '#e65100' },
    archive: { bg: '#fff8e1', fg: '#f57f17' },
    code:    { bg: '#f3e5f5', fg: '#6a1b9a' },
  };

  /* Dark-mode equivalents */
  var DOC_STYLE_DARK = {
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

  function extOf(name, href) {
    var m = (name || href || '').match(/\.([a-z0-9]{1,8})(\?.*)?$/i);
    return m ? m[1].toUpperCase() : 'FILE';
  }

  function isDark() {
    return document.body.classList.contains('dark');
  }

  /* ── Main enhancer ────────────────────────────────────────── */
  function enhanceCard(card) {
    if (card.dataset.ceDone) return;
    card.dataset.ceDone = '1';

    var nameEl   = card.querySelector('.file-attachment-name');
    var filename = nameEl ? nameEl.textContent.trim() : '';
    var href     = card.getAttribute('href') || card.getAttribute('data-preview-url') || '';
    var type     = detectType(filename, href);

    card.setAttribute('data-ce-type', type || 'file');

    switch (type) {
      case 'image':
        addImagePreview(card, href, filename);
        break;
      case 'video':
        addVideoPreview(card, href, filename);
        break;
      case 'audio':
        addAudioPlayer(card, href);
        break;
      default:
        colorDocIcon(card, type);
    }
  }

  /* ── Image: inject full-width thumbnail ───────────────────── */
  function addImagePreview(card, href, filename) {
    var wrap = document.createElement('div');
    wrap.className = 'ce-preview';

    var img = document.createElement('img');
    img.className  = 'ce-preview-img';
    img.src        = href;
    img.alt        = filename;
    img.loading    = 'lazy';
    img.decoding   = 'async';
    img.onerror    = function () {
      wrap.style.display = 'none';
      card.classList.remove('has-image-preview');
    };

    wrap.appendChild(img);
    card.insertBefore(wrap, card.firstChild);
    card.classList.add('has-image-preview');
  }

  /* ── Video: inject thumbnail + play overlay ───────────────── */
  function addVideoPreview(card, href, filename) {
    var wrap = document.createElement('div');
    wrap.className = 'ce-preview';

    var vid = document.createElement('video');
    vid.className  = 'ce-preview-video';
    vid.src        = href;
    vid.preload    = 'metadata';
    vid.muted      = true;
    vid.playsInline = true;
    vid.setAttribute('playsinline', '');
    vid.addEventListener('loadedmetadata', function () {
      vid.currentTime = 0.5;          /* seek to capture a frame */
    });

    var overlay = document.createElement('div');
    overlay.className   = 'ce-play-overlay';
    overlay.innerHTML   = '&#9654;';
    overlay.setAttribute('aria-hidden', 'true');

    wrap.appendChild(vid);
    wrap.appendChild(overlay);
    card.insertBefore(wrap, card.firstChild);
    card.classList.add('has-video-preview');
  }

  /* ── Audio: append a native audio player ──────────────────── */
  function addAudioPlayer(card, href) {
    /* Avoid adding if there's already an <audio> inside */
    if (card.querySelector('audio')) return;

    var playerWrap = document.createElement('div');
    playerWrap.className = 'ce-audio-player';

    var audio = document.createElement('audio');
    audio.src     = href;
    audio.controls = true;
    audio.preload  = 'metadata';

    playerWrap.appendChild(audio);
    card.appendChild(playerWrap);
    card.classList.add('has-audio-card');
  }

  /* ── Document/archive: colour the type badge ──────────────── */
  function colorDocIcon(card, type) {
    if (!type || !(type in DOC_STYLE)) return;
    var iconEl = card.querySelector('.file-attachment-icon');
    if (!iconEl || iconEl.dataset.ceColoured) return;
    iconEl.dataset.ceColoured = '1';

    var palette = isDark() ? DOC_STYLE_DARK[type] : DOC_STYLE[type];
    iconEl.style.setProperty('background', palette.bg, 'important');
    iconEl.style.setProperty('color', palette.fg, 'important');
  }

  /* Re-apply colours when dark mode toggles */
  function refreshDocColours() {
    document.querySelectorAll('.file-attachment-icon[data-ce-coloured]')
      .forEach(function (iconEl) {
        var card = iconEl.closest('[data-ce-type]');
        if (!card) return;
        var type = card.getAttribute('data-ce-type');
        if (!type || !(type in DOC_STYLE)) return;
        var palette = isDark() ? DOC_STYLE_DARK[type] : DOC_STYLE[type];
        iconEl.style.setProperty('background', palette.bg, 'important');
        iconEl.style.setProperty('color', palette.fg, 'important');
      });
  }

  /* ── Batch-process all unenhanced file cards ──────────────── */
  function scanCards(root) {
    root = root || document;
    var cards = root.querySelectorAll
      ? root.querySelectorAll('a.file-attachment-card:not([data-ce-done])')
      : [];
    Array.prototype.forEach.call(cards, enhanceCard);
  }

  /* ── MutationObserver watches for new messages ─────────────── */
  var cardObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('a.file-attachment-card')) {
          enhanceCard(node);
        } else {
          scanCards(node);
        }
      });
    });
  });

  /* Watch for dark-mode toggle to recolour document icons */
  var darkObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        refreshDocColours();
      }
    });
  });

  /* ── Scroll-to-latest button: device-universal upgrade ─────── */
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

  /* Re-enhance button if the chat panel is recreated on navigation */
  var btnObserver = new MutationObserver(function () {
    enhanceScrollBtn();
  });

  /* ── Boot ──────────────────────────────────────────────────── */
  function init() {
    scanCards();
    cardObserver.observe(document.body, { childList: true, subtree: true });
    darkObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

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
