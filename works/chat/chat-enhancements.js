/* ============================================================
   CHAT ENHANCEMENTS v4.1 — nishadsl.com/works/chat
   · Read receipts: real-time "Seen by" avatar indicators
   · Incoming messages marked read on scroll into view
   · Universal dark mode (theme-color, OS sync)
   · All file types: image / video / audio / document preview
   · Scroll-to-latest: all devices, browsers, PWA
   ============================================================ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     UTILITIES
     ══════════════════════════════════════════════════════════ */

  function getInitials(name) {
    return ((name || '?').trim().split(/\s+/).map(function (w) {
      return w[0] || '';
    }).join('').toUpperCase().slice(0, 2)) || '?';
  }

  function esc(str) {
    return (str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isDark() { return document.body.classList.contains('dark'); }


  /* ══════════════════════════════════════════════════════════
     DARK MODE — theme-color meta + OS sync
     ══════════════════════════════════════════════════════════ */

  var DARK_CHROME  = '#0b141a';
  var LIGHT_CHROME = '#008069';

  function syncThemeColor(dark) {
    var tm = document.querySelector('meta[name="theme-color"]');
    if (!tm) { tm = document.createElement('meta'); tm.name = 'theme-color'; document.head.appendChild(tm); }
    tm.content = dark ? DARK_CHROME : LIGHT_CHROME;

    var apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!apple) { apple = document.createElement('meta'); apple.name = 'apple-mobile-web-app-status-bar-style'; document.head.appendChild(apple); }
    apple.content = dark ? 'black-translucent' : 'default';
  }

  new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.attributeName === 'class') {
        var d = isDark();
        syncThemeColor(d);
        refreshDocIconColors(d);
      }
    });
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  function setupOsSync() {
    var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (!mq) return;
    if (localStorage.getItem('darkMode') === null) {
      document.body.classList.toggle('dark', mq.matches);
    }
    mq.addEventListener('change', function (e) {
      if (localStorage.getItem('darkMode') === null) {
        document.body.classList.toggle('dark', e.matches);
        syncThemeColor(e.matches);
      }
    });
  }


  /* ══════════════════════════════════════════════════════════
     READ RECEIPTS — "Seen by" avatar indicators
     ══════════════════════════════════════════════════════════ */

  var _userCache     = Object.create(null);
  var _snapListeners = Object.create(null);
  var _MAX_LISTENERS = 40;

  function getUserInfo(uid) {
    if (_userCache[uid]) return Promise.resolve(_userCache[uid]);

    var members = (window.currentChat && (window.currentChat.members || window.currentChat.participants)) || [];
    for (var i = 0; i < members.length; i++) {
      var m = members[i];
      if ((m.id || m.uid) === uid) {
        var info = { name: m.name || m.displayName || uid.slice(0, 6), photoURL: m.avatar || m.photoURL || null };
        _userCache[uid] = info;
        return Promise.resolve(info);
      }
    }

    var globals = [window.teamMembers, window._members, window.groupMembers, window._groupMembers, window.allUsers];
    for (var g = 0; g < globals.length; g++) {
      if (!Array.isArray(globals[g])) continue;
      for (var k = 0; k < globals[g].length; k++) {
        var tm = globals[g][k];
        if ((tm.id || tm.uid) === uid) {
          var tinfo = { name: tm.name || tm.displayName || uid.slice(0, 6), photoURL: tm.avatar || tm.photoURL || null };
          _userCache[uid] = tinfo;
          return Promise.resolve(tinfo);
        }
      }
    }

    if (!window.db) return Promise.resolve({ name: uid.slice(0, 6), photoURL: null });
    return window.db.collection('users').doc(uid).get()
      .then(function (doc) {
        var d = (doc && doc.exists) ? (doc.data() || {}) : {};
        var r = { name: d.displayName || d.name || d.email || uid.slice(0, 6), photoURL: d.photoURL || d.avatar || null };
        _userCache[uid] = r;
        return r;
      })
      .catch(function () { return { name: uid.slice(0, 6), photoURL: null }; });
  }

  function renderSeenBy(msgEl, readBy) {
    var myUid = window.currentUser && window.currentUser.uid;
    var readerUids = Object.keys(readBy || {}).filter(function (uid) { return uid !== myUid; });

    var old = msgEl.querySelector('.ce-seen-by');
    if (old) old.remove();
    if (!readerUids.length) return;

    var SHOW = 5;
    var visible = readerUids.slice(0, SHOW);
    var extra   = readerUids.length - visible.length;

    var row = document.createElement('div');
    row.className = 'ce-seen-by';

    Promise.all(visible.map(getUserInfo)).then(function (users) {
      users.forEach(function (u) {
        var av = document.createElement('div');
        av.className = 'ce-seen-avatar';
        av.title = esc(u.name);
        if (u.photoURL) {
          var img = document.createElement('img');
          img.src = u.photoURL; img.alt = esc(u.name); img.loading = 'lazy';
          img.onerror = function () { av.textContent = getInitials(u.name); };
          av.appendChild(img);
        } else {
          av.textContent = getInitials(u.name);
        }
        row.appendChild(av);
      });

      if (extra > 0) {
        var more = document.createElement('span');
        more.className = 'ce-seen-more';
        more.textContent = '+' + extra;
        more.title = extra + ' more';
        row.appendChild(more);
      }

      var lbl = document.createElement('span');
      lbl.className = 'ce-seen-label';
      lbl.textContent = readerUids.length === 1
        ? ('Seen by ' + users[0].name.split(' ')[0])
        : ('Seen by ' + readerUids.length);
      row.appendChild(lbl);

      row.title = 'Seen by: ' + users.map(function (u) { return u.name; }).join(', ')
                  + (extra > 0 ? ' +' + extra + ' more' : '');

      msgEl.appendChild(row);
    });
  }

  function attachSeenByListener(msgEl) {
    var msgId = msgEl.dataset.messageId;
    if (!msgId || _snapListeners[msgId]) return;
    if (!window.db) return;

    var keys = Object.keys(_snapListeners);
    if (keys.length >= _MAX_LISTENERS) {
      var oldest = keys[0];
      _snapListeners[oldest]();
      delete _snapListeners[oldest];
    }

    var unsub = window.db.collection('messages').doc(msgId)
      .onSnapshot(
        function (snap) {
          if (!snap || !snap.exists) return;
          renderSeenBy(msgEl, (snap.data() || {}).readBy || {});
        },
        function () {}
      );

    _snapListeners[msgId] = unsub;
  }

  function scanOutgoingMessages(root) {
    root = root || document;
    if (!window.db || !window.currentUser) return;
    var msgs = root.querySelectorAll
      ? root.querySelectorAll('.my-message[data-message-id]') : [];
    var arr = Array.prototype.slice.call(msgs);
    arr.slice(-_MAX_LISTENERS).forEach(attachSeenByListener);
  }


  /* ══════════════════════════════════════════════════════════
     MARK INCOMING AS READ ON SCROLL INTO VIEW
     ══════════════════════════════════════════════════════════ */

  function setupReadOnScroll() {
    if (!window.IntersectionObserver) return;
    var timers = new Map();

    function markOneRead(msgId) {
      var uid = window.currentUser && window.currentUser.uid;
      if (!msgId || !uid || !window.db || !window.firebase) return;
      window.db.collection('messages').doc(msgId).get()
        .then(function (doc) {
          if (!doc || !doc.exists) return;
          var d = doc.data() || {};
          if (d.senderId === uid) return;
          if (d.readBy && d.readBy[uid]) return;
          if ((window.privacySettings || {}).hideReadReceipts) return;
          var upd = {};
          upd['readBy.'   + uid] = window.firebase.firestore.FieldValue.serverTimestamp();
          upd['openedBy.' + uid] = window.firebase.firestore.FieldValue.serverTimestamp();
          window.db.collection('messages').doc(msgId).update(upd).catch(function () {});
        })
        .catch(function () {});
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (entry.isIntersecting) {
          if (!timers.has(el)) {
            var t = setTimeout(function () {
              timers.delete(el); observer.unobserve(el);
              markOneRead(el.dataset.messageId);
            }, 1500);
            timers.set(el, t);
          }
        } else {
          var t2 = timers.get(el);
          if (t2) { clearTimeout(t2); timers.delete(el); }
        }
      });
    }, { threshold: 0.6 });

    function observeIncoming(root) {
      root = root || document;
      var msgs = root.querySelectorAll
        ? root.querySelectorAll('.message:not(.my-message)[data-message-id]') : [];
      Array.prototype.forEach.call(msgs, function (el) { observer.observe(el); });
    }

    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.classList && node.classList.contains('message') &&
              !node.classList.contains('my-message') &&
              node.dataset && node.dataset.messageId) {
            observer.observe(node);
          } else if (node.querySelectorAll) { observeIncoming(node); }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });

    observeIncoming();
  }

  function initReadReceipts() {
    if (!window.db || !window.currentUser) { setTimeout(initReadReceipts, 600); return; }

    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.classList && node.classList.contains('my-message') &&
              node.dataset && node.dataset.messageId) {
            attachSeenByListener(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('.my-message[data-message-id]').forEach(attachSeenByListener);
          }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });

    scanOutgoingMessages();
    setupReadOnScroll();
  }


  /* ══════════════════════════════════════════════════════════
     FILE-TYPE DETECTION & MEDIA PREVIEWS

     BUG FIX (v4.1): Previously joined name + '|' + href into
     one string and tested with a $-anchored regex. When the
     Firebase Storage URL is UUID-based (no extension), the
     filename's ".png" lands in the MIDDLE of the combined
     string — not at $, so the regex never matched.

     FIX: test name and href INDEPENDENTLY. The filename
     (from data-filename attribute) always carries the real
     extension; the href may or may not.

     Also: use data-filename as primary source (set by the
     app's renderAttachment to the original upload filename),
     fall back to the visible .file-attachment-name text.

     Retry scans at 0.5 s / 2 s / 5 s catch messages that
     load from Firestore after the initial DOM scan.
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

  var DOC_COLOR = {
    pdf:     { bg: '#ffebee', fg: '#c62828' },
    word:    { bg: '#e3f2fd', fg: '#1565c0' },
    excel:   { bg: '#e8f5e9', fg: '#2e7d32' },
    ppt:     { bg: '#fff3e0', fg: '#e65100' },
    archive: { bg: '#fff8e1', fg: '#f57f17' },
    code:    { bg: '#f3e5f5', fg: '#6a1b9a' },
  };

  var DOC_COLOR_DARK = {
    pdf:     { bg: '#4a0000', fg: '#ef9a9a' },
    word:    { bg: '#0d2137', fg: '#90caf9' },
    excel:   { bg: '#0a2010', fg: '#a5d6a7' },
    ppt:     { bg: '#3e1a00', fg: '#ffcc80' },
    archive: { bg: '#3e2800', fg: '#ffe082' },
    code:    { bg: '#1a0030', fg: '#ce93d8' },
  };

  /**
   * ✅ FIXED: test name and href SEPARATELY so the end-of-string
   * anchor ($) works correctly against each individual value.
   */
  function detectType(name, href) {
    for (var t in TYPES) {
      if (TYPES[t].test(name) || TYPES[t].test(href)) return t;
    }
    return null;
  }

  function applyIconColor(iconEl, type, dark) {
    var palette = (dark ? DOC_COLOR_DARK : DOC_COLOR)[type];
    if (!palette) return;
    iconEl.style.setProperty('background', palette.bg, 'important');
    iconEl.style.setProperty('color',      palette.fg, 'important');
  }

  function refreshDocIconColors(dark) {
    document.querySelectorAll('.file-attachment-icon[data-ce-coloured]')
      .forEach(function (iconEl) {
        var card = iconEl.closest('[data-ce-type]');
        if (card) applyIconColor(iconEl, card.getAttribute('data-ce-type'), dark);
      });
  }

  function enhanceFileCard(card) {
    if (card.dataset.ceDone) return;
    card.dataset.ceDone = '1';

    /* ✅ FIXED: use data-filename (always has the real extension)
       as primary source; fall back to visible name text */
    var filename = card.getAttribute('data-filename')
                || (card.querySelector('.file-attachment-name')
                    ? card.querySelector('.file-attachment-name').textContent.trim()
                    : '');

    var href = card.getAttribute('href')
            || card.getAttribute('data-preview-url')
            || '';

    var type = detectType(filename, href);
    card.setAttribute('data-ce-type', type || 'file');

    switch (type) {
      case 'image': addImagePreview(card, href, filename); break;
      case 'video': addVideoPreview(card, href, filename); break;
      case 'audio': addAudioPlayer(card, href);            break;
      default:
        if (type) {
          var iconEl = card.querySelector('.file-attachment-icon');
          if (iconEl && !iconEl.dataset.ceColoured) {
            iconEl.dataset.ceColoured = '1';
            applyIconColor(iconEl, type, isDark());
          }
        }
    }
  }

  function addImagePreview(card, href, filename) {
    if (card.querySelector('.ce-preview')) return;

    var wrap = document.createElement('div');
    wrap.className = 'ce-preview';

    var img = document.createElement('img');
    img.className = 'ce-preview-img';
    img.src       = href;
    img.alt       = filename;
    img.loading   = 'lazy';
    img.decoding  = 'async';
    /* On failure: hide preview div and revert card to original file-card layout */
    img.onerror   = function () {
      wrap.style.display = 'none';
      card.classList.remove('has-image-preview');
    };

    wrap.appendChild(img);
    card.insertBefore(wrap, card.firstChild);
    /* Add class immediately so the CSS grid restructures right away */
    card.classList.add('has-image-preview');
  }

  function addVideoPreview(card, href, filename) {
    if (card.querySelector('.ce-preview')) return;
    var wrap = document.createElement('div');
    wrap.className = 'ce-preview';

    var vid = document.createElement('video');
    vid.className   = 'ce-preview-video';
    vid.src         = href;
    vid.preload     = 'metadata';
    vid.muted       = true;
    vid.playsInline = true;
    vid.setAttribute('playsinline', '');
    vid.addEventListener('loadedmetadata', function () { vid.currentTime = 0.5; });

    var overlay = document.createElement('div');
    overlay.className = 'ce-play-overlay';
    overlay.innerHTML = '&#9654;';
    overlay.setAttribute('aria-hidden', 'true');

    wrap.appendChild(vid); wrap.appendChild(overlay);
    card.insertBefore(wrap, card.firstChild);
    card.classList.add('has-video-preview');
  }

  function addAudioPlayer(card, href) {
    if (card.querySelector('audio')) return;
    var wrap = document.createElement('div');
    wrap.className = 'ce-audio-player';
    var audio = document.createElement('audio');
    audio.src = href; audio.controls = true; audio.preload = 'metadata';
    wrap.appendChild(audio);
    card.appendChild(wrap);
    card.classList.add('has-audio-card');
  }

  /** Scan any root element for unprocessed file cards */
  function scanFileCards(root) {
    root = root || document;
    var cards = root.querySelectorAll
      ? root.querySelectorAll('a.file-attachment-card:not([data-ce-done])') : [];
    Array.prototype.forEach.call(cards, enhanceFileCard);
  }

  /* MutationObserver: catch cards added dynamically (new messages from Firestore) */
  new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('a.file-attachment-card')) enhanceFileCard(node);
        else scanFileCards(node);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  /* ✅ FIXED: Delayed retries catch messages that arrive from Firestore
     after the initial synchronous scan at boot */
  function scheduleRetryScans() {
    setTimeout(scanFileCards, 500);
    setTimeout(scanFileCards, 2000);
    setTimeout(scanFileCards, 5000);
  }


  /* ══════════════════════════════════════════════════════════
     SCROLL-TO-LATEST BUTTON
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

  new MutationObserver(function () { enhanceScrollBtn(); })
    .observe(document.getElementById('messages-wrap') || document.getElementById('chat-area') || document.body,
             { childList: true, subtree: false });


  /* ══════════════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════════════ */

  function boot() {
    syncThemeColor(isDark());
    setupOsSync();

    scanFileCards();          /* immediate pass */
    scheduleRetryScans();     /* delayed retries for Firestore-loaded messages */
    enhanceScrollBtn();

    initReadReceipts();       /* waits for Firebase globals */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
