/* ==========================================================
   CHAT ENHANCEMENTS - nishadsl.com/works/chat
   Fixes: PNG thumbnails · Scroll-to-latest button
   ========================================================== */
(function () {
  'use strict';

  /* ── 1. Image / PNG file thumbnail fix ───────────────────
     When a PNG (or any image) is stored in Firestore with
     type="document", renderAttachment() shows a plain file
     card with no preview. This patches those cards in place
     by detecting the image extension and injecting a real
     <img> thumbnail.
  ──────────────────────────────────────────────────────── */
  var IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|heic|heif|tiff?)(\?.*)?$/i;

  function patchFileThumbnails(root) {
    root = root || document;
    var cards = root.querySelectorAll
      ? root.querySelectorAll('a.file-attachment-card:not([data-img-patched])')
      : [];

    Array.prototype.forEach.call(cards, function (card) {
      var nameEl   = card.querySelector('.file-attachment-name');
      var filename = (nameEl && nameEl.textContent) || '';
      var href     = card.getAttribute('href') || '';

      if (!IMAGE_EXT.test(filename) && !IMAGE_EXT.test(href)) return;

      card.setAttribute('data-img-patched', '1');
      var iconEl = card.querySelector('.file-attachment-icon');
      if (!iconEl) return;

      var img      = document.createElement('img');
      img.src      = href;
      img.alt      = filename;
      img.className = 'file-attachment-thumbnail';
      img.loading  = 'lazy';
      img.decoding = 'async';

      img.onerror = function () {
        /* Fallback: show the original extension text */
        img.style.display = 'none';
        var ext = iconEl.getAttribute('data-ext') || 'IMG';
        iconEl.textContent = ext;
        iconEl.classList.remove('has-thumbnail');
        card.classList.remove('has-image-preview');
      };

      iconEl.setAttribute('data-ext', iconEl.textContent.trim());
      iconEl.innerHTML = '';
      iconEl.appendChild(img);
      iconEl.classList.add('has-thumbnail');
      card.classList.add('has-image-preview');
    });
  }

  /* Observer: runs patchFileThumbnails whenever new nodes land in the DOM */
  var thumbObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        patchFileThumbnails(node.matches && node.matches('.file-attachment-card')
          ? node.parentElement
          : node);
      });
    });
  });

  /* ── 2. Scroll-to-latest button enhancement ──────────────
     The existing #jumpToBottomBtn is a tiny 36 px circle.
     We upgrade it to a labelled pill that works on every
     device size (fixed position so it doesn't get clipped
     on mobile).
  ──────────────────────────────────────────────────────── */
  function enhanceScrollButton() {
    var btn = document.getElementById('jumpToBottomBtn');
    if (!btn || btn.dataset.enhanced) return;

    btn.dataset.enhanced = '1';
    btn.innerHTML =
      '<span class="jtb-arrow">&#8595;</span>' +
      '<span class="jtb-label">Scroll to latest</span>';
    btn.title             = 'Scroll to latest messages';
    btn.setAttribute('aria-label', 'Scroll to latest messages');
  }

  /* ── Initialise everything after DOM is ready ─────────── */
  function init() {
    /* Patch any file cards already in the DOM */
    patchFileThumbnails();

    /* Start watching for new ones */
    thumbObserver.observe(document.body, { childList: true, subtree: true });

    /* Enhance the scroll button */
    enhanceScrollButton();

    /* Re-enhance if the button is recreated later (e.g. chat switch) */
    var btnObserver = new MutationObserver(function () {
      enhanceScrollButton();
    });
    var area = document.getElementById('messagesArea');
    if (area) {
      btnObserver.observe(area.parentElement || document.body,
        { childList: true, subtree: false });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
