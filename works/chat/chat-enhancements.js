/* ============================================================
   CHAT ENHANCEMENTS v4 — nishadsl.com/works/chat
   · Read receipts: real-time "Seen by" avatar indicators
     below outgoing messages (persists via Firestore readBy)
   · Incoming messages marked as read when scrolled into view
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

  /** Escape HTML to avoid XSS when inserting user-supplied text */
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
    /* Browser address bar / PWA title bar */
    var tm = document.querySelector('meta[name="theme-color"]');
    if (!tm) { tm = document.createElement('meta'); tm.name = 'theme-color'; document.head.appendChild(tm); }
    tm.content = dark ? DARK_CHROME : LIGHT_CHROME;

    /* iOS status bar style inside installed PWA */
    var apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!apple) { apple = document.createElement('meta'); apple.name = 'apple-mobile-web-app-status-bar-style'; document.head.appendChild(apple); }
    apple.content = dark ? 'black-translucent' : 'default';
  }

  /* Watch body class changes to keep theme-color in sync */
  new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.attributeName === 'class') {
        var d = isDark();
        syncThemeColor(d);
        refreshDocIconColors(d);
      }
    });
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* Mirror OS dark-mode preference if user hasn't set one manually */
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
     ══════════════════════════════════════════════════════════

     How it works:
     - Each message document in Firestore has a readBy map:
         { uid1: serverTimestamp, uid2: serverTimestamp, … }
     - For every outgoing (.my-message) element we find in the
       DOM, we open an onSnapshot listener on that message doc.
     - When readBy changes we rebuild the "Seen by" indicator
       below the message bubble — instantly, in real time.
     - On page reload the first snapshot fires immediately with
       the existing Firestore data, so history is always shown.
     ══════════════════════════════════════════════════════════ */

  var _userCache   = Object.create(null);   // uid → { name, photoURL }
  var _snapListeners = Object.create(null); // msgId → unsubscribe fn
  var _MAX_LISTENERS = 40;                  // cap open listeners

  /** Resolve a user's display info with multi-level caching */
  function getUserInfo(uid) {
    if (_userCache[uid]) return Promise.resolve(_userCache[uid]);

    /* 1 — scan current group member list (already in memory) */
    var members = (window.currentChat && (window.currentChat.members || window.currentChat.participants)) || [];
    for (var i = 0; i < members.length; i++) {
      var m = members[i];
      var mid = m.id || m.uid;
      if (mid === uid) {
        var info = { name: m.name || m.displayName || uid.slice(0, 6), photoURL: m.avatar || m.photoURL || null };
        _userCache[uid] = info;
        return Promise.resolve(info);
      }
    }

    /* 2 — scan global member arrays the app may expose */
    var globals = [window.teamMembers, window._members, window.groupMembers, window._groupMembers, window.allUsers];
    for (var g = 0; g < globals.length; g++) {
      var list = globals[g];
      if (!Array.isArray(list)) continue;
      for (var k = 0; k < list.length; k++) {
        var tm = list[k];
        if ((tm.id || tm.uid) === uid) {
          var tinfo = { name: tm.name || tm.displayName || uid.slice(0, 6), photoURL: tm.avatar || tm.photoURL || null };
          _userCache[uid] = tinfo;
          return Promise.resolve(tinfo);
        }
      }
    }

    /* 3 — fetch from Firestore users collection */
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

  /** Build / refresh the "Seen by" row under an outgoing message */
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
      /* Avatar circles */
      users.forEach(function (u) {
        var av = document.createElement('div');
        av.className = 'ce-seen-avatar';
        av.title     = esc(u.name);

        if (u.photoURL) {
          var img = document.createElement('img');
          img.src     = u.photoURL;
          img.alt     = esc(u.name);
          img.loading = 'lazy';
          img.onerror = function () { av.textContent = getInitials(u.name); };
          av.appendChild(img);
        } else {
          av.textContent = getInitials(u.name);
        }
        row.appendChild(av);
      });

      /* "+N more" chip */
      if (extra > 0) {
        var more = document.createElement('span');
        more.className   = 'ce-seen-more';
        more.textContent = '+' + extra;
        more.title       = extra + ' more';
        row.appendChild(more);
      }

      /* "Seen" / "Seen by N" label */
      var lbl = document.createElement('span');
      lbl.className   = 'ce-seen-label';
      lbl.textContent = readerUids.length === 1
        ? ('Seen by ' + users[0].name.split(' ')[0])
        : ('Seen by ' + readerUids.length);
      row.appendChild(lbl);

      /* Full tooltip on the row */
      row.title = 'Seen by: ' + users.map(function (u) { return u.name; }).join(', ')
                  + (extra > 0 ? ' +' + extra + ' more' : '');

      /* Insert below the message bubble */
      msgEl.appendChild(row);
    });
  }

  /** Open a Firestore snapshot listener for one outgoing message */
  function attachSeenByListener(msgEl) {
    var msgId = msgEl.dataset.messageId;
    if (!msgId || _snapListeners[msgId]) return;
    if (!window.db) return;

    /* Cap open listeners — remove oldest if needed */
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
        function () {} /* swallow permission errors silently */
      );

    _snapListeners[msgId] = unsub;
  }

  /** Scan any container for outgoing messages and attach listeners */
  function scanOutgoingMessages(root) {
    root = root || document;
    if (!window.db || !window.currentUser) return;
    var msgs = root.querySelectorAll
      ? root.querySelectorAll('.my-message[data-message-id]') : [];
    /* Limit to last _MAX_LISTENERS messages to avoid too many listeners */
    var arr = Array.prototype.slice.call(msgs);
    arr.slice(-_MAX_LISTENERS).forEach(attachSeenByListener);
  }


  /* ══════════════════════════════════════════════════════════
     MARK INCOMING MESSAGES AS READ ON SCROLL INTO VIEW
     ══════════════════════════════════════════════════════════
     The app already calls markMessagesAsRead() on chat open
     (batch). This IntersectionObserver adds per-message
     granularity: each incoming message is marked read 1.5 s
     after it becomes 60 % visible in the viewport — even if
     the user only scrolls partway through a long history.
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
          if (d.senderId === uid) return;           /* own message */
          if (d.readBy && d.readBy[uid]) return;    /* already read */
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
              timers.delete(el);
              observer.unobserve(el);
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

    /* Watch for newly added messages */
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.classList && node.classList.contains('message') &&
              !node.classList.contains('my-message') &&
              node.dataset && node.dataset.messageId) {
            observer.observe(node);
          } else if (node.querySelectorAll) {
            observeIncoming(node);
          }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });

    observeIncoming();
  }

  /** Called once Firebase globals are ready */
  function initReadReceipts() {
    if (!window.db || !window.currentUser) {
      setTimeout(initReadReceipts, 600);
      return;
    }

    /* Watch for new outgoing messages */
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.classList && node.classList.contains('my-message') &&
              node.dataset && node.dataset.messageId) {
            attachSeenByListener(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('.my-message[data-message-id]')
              .forEach(attachSeenByListener);
          }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });

    scanOutgoingMessages();
    setupReadOnScroll();
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

  function detectType(name, href) {
    var s = name + '|' + href;
    for (var t in TYPES) if (TYPES[t].test(s)) return t;
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

    var nameEl   = card.querySelector('.file-attachment-name');
    var filename = nameEl ? nameEl.textContent.trim() : '';
    var href     = card.getAttribute('href') || card.getAttribute('data-preview-url') || '';
    var type     = detectType(filename, href);
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
    var wrap = document.createElement('div');
    wrap.className = 'ce-preview';
    var img = document.createElement('img');
    img.className = 'ce-preview-img';
    img.src = href; img.alt = filename;
    img.loading = 'lazy'; img.decoding = 'async';
    img.onerror = function () { wrap.style.display = 'none'; card.classList.remove('has-image-preview'); };
    wrap.appendChild(img);
    card.insertBefore(wrap, card.firstChild);
    card.classList.add('has-image-preview');
  }

  function addVideoPreview(card, href, filename) {
    var wrap = document.createElement('div');
    wrap.className = 'ce-preview';
    var vid = document.createElement('video');
    vid.className = 'ce-preview-video';
    vid.src = href; vid.preload = 'metadata'; vid.muted = true; vid.playsInline = true;
    vid.setAttribute('playsinline', '');
    vid.addEventListener('loadedmetadata', function () { vid.currentTime = 0.5; });
    var overlay = document.createElement('div');
    overlay.className = 'ce-play-overlay'; overlay.innerHTML = '&#9654;';
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

  function scanFileCards(root) {
    root = root || document;
    var cards = root.querySelectorAll
      ? root.querySelectorAll('a.file-attachment-card:not([data-ce-done])') : [];
    Array.prototype.forEach.call(cards, enhanceFileCard);
  }

  new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('a.file-attachment-card')) enhanceFileCard(node);
        else scanFileCards(node);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });


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
    .observe(document.getElementById('chatMain') || document.querySelector('.chat-main') || document.body,
             { childList: true, subtree: false });


  /* ══════════════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════════════ */

  function boot() {
    syncThemeColor(isDark());
    setupOsSync();

    scanFileCards();
    enhanceScrollBtn();

    /* Kick off read receipts — waits for Firebase */
    initReadReceipts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
