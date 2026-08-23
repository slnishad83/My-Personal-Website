/* =============================================
   MESSAGE SEARCH v1.0
   Full-text search across all chat history.
   - Debounced live search (350ms)
   - Highlighted match snippets
   - Infinite scroll with Firestore cursor pagination
   - Scope toggle: All Chats vs Current Chat
   - Click result → jumps to that chat + message
   - Keyboard shortcut: Ctrl+F / Cmd+F
   ============================================= */
(function () {
  'use strict';

  /* ─── state ─────────────────────────────────────────────────────── */
  let _query       = '';
  let _scope       = 'all';           // 'all' | 'current'
  let _filterType  = 'all';           // 'all'|'text'|'image'|'video'|'audio'|'voice'|'doc'|'link'
  let _filterDate  = 'any';           // 'any'|'today'|'week'|'month'
  let _lastDocs    = {};              // { chatId: firestoreDocSnapshot }
  let _exhausted   = {};             // { chatId: true }
  let _loading     = false;
  let _debounce    = null;
  let _observer    = null;
  const PAGE_SIZE  = 20;             // messages per chat per page

  /* ─── WhatsApp-style category tab state ───────────────────────── */
  let _activeTab      = 'all';       // 'all'|'chats'|'messages'|'media'|'links'|'docs'
  let _mediaSubFilter = 'all';       // 'all'|'photos'|'videos'|'gifs'|'audio'
  let _dateRangeStart = '';          // YYYY-MM-DD
  let _dateRangeEnd   = '';          // YYYY-MM-DD
  let _totalResults   = 0;

  /* ─── in-chat search state ────────────────────────────────────── */
  let _icsActive     = false;
  let _icsQuery      = '';
  let _icsResults    = [];
  let _icsIndex      = -1;
  let _icsFilter     = 'all';        // 'all'|'text'|'media'|'links'|'docs'|'audio'
  let _icsDebounce   = null;

  /* ─── escape html ───────────────────────────────────────────────── */
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ─── highlight match in text ───────────────────────────────────── */
  function highlight(text, query) {
    if (!query) return esc(text);
    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
    return esc(text).replace(re, '<mark class="ms-highlight">$1</mark>');
  }

  /* ─── snippet around match ──────────────────────────────────────── */
  function snippet(text, query, radius) {
    radius = radius || 60;
    if (!query) return esc(text.slice(0, 140));
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return esc(text.slice(0, 140));
    const start = Math.max(0, idx - radius);
    const end   = Math.min(text.length, idx + query.length + radius);
    const pre   = start > 0 ? '…' : '';
    const post  = end < text.length ? '…' : '';
    return pre + highlight(text.slice(start, end), query) + post;
  }

  /* ─── format timestamp ──────────────────────────────────────────── */
  function fmtTs(ts) {
    if (!ts) return '';
    let d;
    try { d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts); } catch (_) { return ''; }
    if (isNaN(d.getTime())) return '';
    const now    = new Date();
    const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffD  = Math.round((today - msgDay) / 86400000);
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0');
    const ampm = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
    const time = h12 + ':' + m + ' ' + ampm;
    if (diffD === 0) return 'Today, ' + time;
    if (diffD === 1) return 'Yesterday, ' + time;
    if (diffD < 7)  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] + ', ' + time;
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    return d.getDate() + ' ' + mo + ' ' + d.getFullYear() + ', ' + time;
  }

  /* ─── get chats to search ───────────────────────────────────────── */
  function getChatIds() {
    if (_scope === 'current' && window.currentChat?.id) {
      return [window.currentChat.id];
    }
    // pull from sidebar chat list
    const items = document.querySelectorAll('.chat-list-item[data-chat-id], [class*="chat-row"][data-chat-id]');
    const ids   = new Set();
    items.forEach(el => { if (el.dataset.chatId) ids.add(el.dataset.chatId); });

    // also try window.chats / window.chatList
    const chats = window.chats || window.chatList || [];
    (Array.isArray(chats) ? chats : Object.values(chats)).forEach(c => {
      if (c && (c.id || c.chatId)) ids.add(c.id || c.chatId);
    });

    if (window.currentChat?.id) ids.add(window.currentChat.id);
    return Array.from(ids);
  }

  /* ─── search one chat in Firestore ──────────────────────────────── */
  async function searchChat(db, chatId, q) {
    if (_exhausted[chatId]) return [];
    const qLower = q.toLowerCase();

    const chatColls = chatCollFor(chatId);
    let found = [];
    for (let i = 0; i < chatColls.length; i++) {
      const coll = chatColls[i];
      let ref = db.collection(coll).doc(chatId).collection('messages')
                  .orderBy('timestamp', 'desc')
                  .limit(PAGE_SIZE);

      if (_lastDocs[chatId]) ref = ref.startAfter(_lastDocs[chatId]);

      let snap;
      try { snap = await ref.get(); } catch (_) {
        try {
          ref = db.collection(coll).doc(chatId).collection('messages').orderBy('createdAt','desc').limit(PAGE_SIZE);
          if (_lastDocs[chatId]) ref = ref.startAfter(_lastDocs[chatId]);
          snap = await ref.get();
        } catch (e2) { if (window.__DEBUG__) console.warn('[MsgSearch] firestore error', chatId, e2.message); snap = null; }
      }
      if (!snap) continue;
      if (snap.empty || snap.docs.length < PAGE_SIZE) _exhausted[chatId] = true;
      if (snap.docs.length) _lastDocs[chatId] = snap.docs[snap.docs.length - 1];

      found = found.concat(snap.docs
        .map(d => ({ id: d.id, chatId, ...d.data() }))
        .filter(m => {
          const txt = (m.text || m.message || m.body || m.content || '').toLowerCase();
          const sender = (m.senderName || m.displayName || m.name || '').toLowerCase();
          return (txt.includes(qLower) || sender.includes(qLower)) && matchesFilters(m);
        }));
      if (chatColls.length > 1) break;
    }
    return found;
  }

  function chatCollFor(chatId) {
    if (window.currentChat && window.currentChat.id === chatId) {
      return window.currentChatType === 'group' ? ['groups'] : (window.currentChatType === 'broadcast' ? ['broadcasts'] : ['chats']);
    }
    const el = document.querySelector('[data-chat-id="' + String(chatId).replace(/"/g, '\\"') + '"]');
    if (el) {
      const t = el.getAttribute('data-chat-type') || el.getAttribute('data-type') || 'direct';
      if (t === 'group') return ['groups'];
      if (t === 'broadcast') return ['broadcasts'];
      return ['chats'];
    }
    return ['chats', 'groups'];
  }

  /* ─── avatar helper ─────────────────────────────────────────────── */
  function avatarHtml(name, avatarUrl) {
    const initial = (name || '?').charAt(0).toUpperCase();
    if (avatarUrl) {
      return `<img class="ms-card-avatar" src="${esc(avatarUrl)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` +
             `<div class="ms-card-avatar-fallback" style="display:none">${esc(initial)}</div>`;
    }
    return `<div class="ms-card-avatar-fallback">${esc(initial)}</div>`;
  }

  /* ─── build result card HTML ─────────────────────────────────────── */
  function buildCard(msg, q) {
    const text       = msg.text || msg.message || msg.body || msg.content || '';
    const senderName = esc(msg.senderName || msg.displayName || msg.name || 'Unknown');
    const chatName   = esc(msg.chatName || msg.groupName || '');
    const sender     = esc(msg.senderName || msg.displayName || msg.name || 'Unknown');
    const avatarUrl  = msg.senderAvatar || msg.avatar || msg.photoURL || msg.senderPhoto || '';
    const ts         = fmtTs(msg.createdAt || msg.timestamp);
    const snip       = snippet(text, q);

    return `<div class="ms-card" role="option" data-msg-id="${esc(msg.id)}" data-chat-id="${esc(msg.chatId)}" tabindex="0"
  aria-label="${esc(text.slice(0,80))}">
  <div class="ms-card-body">
    <div class="ms-card-meta">
      <span class="ms-card-chat">${chatName || '<em>Direct message</em>'}</span>
      <span class="ms-card-time">${esc(ts)}</span>
    </div>
    <div class="ms-card-sender">${sender}</div>
    <div class="ms-card-snippet">${snip}</div>
  </div>
  <div class="ms-card-avatar-wrap">${avatarHtml(sender, avatarUrl)}</div>
</div>`;
  }

  /* ─── render results into the container ──────────────────────────── */
  function renderResults(results, q, append) {
    const container = document.getElementById('globalSearchResults');
    if (!container) return;

    if (!append) {
      container.innerHTML = '';
      _totalResults = 0;
      // Add scope toggle
      if (!document.getElementById('msScopeToggle')) {
        const toggleBar = document.createElement('div');
        toggleBar.className = 'ms-scope-bar';
        toggleBar.innerHTML = `
<button class="ms-scope-btn${_scope==='all'?' ms-active':''}" data-scope="all">All Chats</button>
<button class="ms-scope-btn${_scope==='current'?' ms-active':''}" data-scope="current">Current Chat</button>`;
        container.before(toggleBar);
        // Inject WhatsApp-style tab filters
        renderFilterRow(container.parentElement || container);


        toggleBar.querySelectorAll('.ms-scope-btn').forEach(btn => {
          btn.setAttribute('aria-pressed', btn.classList.contains('ms-active') ? 'true' : 'false');
          btn.addEventListener('click', () => {
            _scope = btn.dataset.scope;
            toggleBar.querySelectorAll('.ms-scope-btn').forEach(b => { b.classList.remove('ms-active'); b.setAttribute('aria-pressed', 'false'); });
            btn.classList.add('ms-active');
            btn.setAttribute('aria-pressed', 'true');
            doSearch(true);
          });
        });
      }
    }

    if (!results.length && !append) {
      _totalResults = 0;
      container.innerHTML =
        '<div class="ms-empty-illustration">' +
          '<div class="ms-empty-icon"><span class="material-symbols-outlined">search_off</span></div>' +
          '<div class="ms-empty-title">No results for \u2018' + esc(q) + '\u2019</div>' +
          '<div class="ms-empty-sub">Try different keywords or check your filters</div>' +
        '</div>';
      return;
    }

    _totalResults += results.length;

    // Show result count
    if (!append) {
      const countEl = document.createElement('div');
      countEl.className = 'ms-result-count';
      countEl.textContent = _totalResults + ' result' + (_totalResults !== 1 ? 's' : '') + ' for \u2018' + q + '\u2019';
      container.appendChild(countEl);
    }

    results.forEach(msg => {
      const div = document.createElement('div');
      div.innerHTML = buildCard(msg, q);
      container.appendChild(div.firstElementChild);
    });

    // add / update sentinel for infinite scroll
    let sentinel = container.querySelector('.ms-sentinel');
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.className = 'ms-sentinel';
      sentinel.innerHTML = '<div class="ms-loader" aria-label="Loading more results…"></div>';
      container.appendChild(sentinel);
      if (_observer) _observer.disconnect();
      _observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !_loading) loadMore(q);
      }, { root: container, threshold: 0.1 });
      _observer.observe(sentinel);
    }

    // attach click/enter → jump to message
    container.querySelectorAll('.ms-card:not([data-ms-bound])').forEach(card => {
      card.dataset.msBound = '1';
      const jump = () => jumpToMessage(card.dataset.chatId, card.dataset.msgId);
      card.addEventListener('click', jump);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); } });
    });
  }

  /* ─── load more (infinite scroll) ───────────────────────────────── */
  async function loadMore(q) {
    const db = window.db || window.firestore;
    if (!db || _loading) return;
    _loading = true;

    const sentinel = document.getElementById('globalSearchResults')?.querySelector('.ms-sentinel');
    if (sentinel) sentinel.classList.add('ms-loading');

    const chatIds = getChatIds();
    const pages = await Promise.all(chatIds.map(id => searchChat(db, id, q)));
    const results = pages.flat().sort((a,b) => {
      const ta = (a.createdAt?.toMillis?.() || a.createdAt || 0);
      const tb = (b.createdAt?.toMillis?.() || b.createdAt || 0);
      return tb - ta;
    });

    if (sentinel) sentinel.classList.remove('ms-loading');
    _loading = false;

    if (!results.length) {
      if (sentinel) sentinel.remove();
      if (_observer) { _observer.disconnect(); _observer = null; }
      const container = document.getElementById('globalSearchResults');
      if (container && !container.querySelector('.ms-end')) {
        const end = document.createElement('div');
        end.className = 'ms-end';
        end.textContent = 'No more results';
        container.appendChild(end);
      }
      return;
    }

    renderResults(results, q, true);
  }

  /* ─── main search ────────────────────────────────────────────────── */
  let doSearch = async function(reset) {
    const q   = _query.trim();
    const container = document.getElementById('globalSearchResults');
    if (!container) return;

    if (!q) {
      container.innerHTML = '<div class="ms-empty-state">Enter a keyword to search across all chats</div>';
      document.getElementById('msScopeToggle') && document.getElementById('msScopeToggle').remove();
      return;
    }

    if (reset) {
      _lastDocs  = {};
      _exhausted = {};
      if (_observer) { _observer.disconnect(); _observer = null; }
      container.innerHTML = '<div class="ms-spinner" aria-label="Searching…"></div>';
    }

    const db = window.db || window.firestore;
    if (!db) {
      container.innerHTML = '<div class="ms-empty">Database not available yet. Please try again.</div>';
      return;
    }

    _loading = true;
    const chatIds = getChatIds();
    const pages   = await Promise.all(chatIds.map(id => searchChat(db, id, q)));
    const results = pages.flat().sort((a, b) => {
      const ta = (a.createdAt?.toMillis?.() || +new Date(a.createdAt) || 0);
      const tb = (b.createdAt?.toMillis?.() || +new Date(b.createdAt) || 0);
      return tb - ta;
    });
    _loading = false;

    renderResults(results, q, false);
  }

  /* ─── jump to message ────────────────────────────────────────────── */
  async function jumpToMessage(chatId, msgId) {
    // close search modal
    const modal = document.getElementById('globalSearchModal');
    if (modal) modal.style.display = 'none';

    // open the chat if not already open
    if (!window.currentChat || window.currentChat.id !== chatId) {
      // try clicking the sidebar item
      const item = document.querySelector(`.chat-list-item[data-chat-id="${CSS.escape(chatId)}"]`);
      if (item) { item.click(); await new Promise(r => setTimeout(r, 600)); }
      else if (typeof window.openChat === 'function') {
        await window.openChat(chatId);
        await new Promise(r => setTimeout(r, 600));
      }
    }

    // find the message element and scroll into view
    const findAndScroll = (attempt) => {
      attempt = attempt || 0;
      const msgEl = document.querySelector(`[data-message-id="${CSS.escape(msgId)}"], [data-id="${CSS.escape(msgId)}"]`);
      if (msgEl) {
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        msgEl.classList.add('ms-jump-flash');
        setTimeout(() => msgEl.classList.remove('ms-jump-flash'), 1800);
      } else if (attempt < 5) {
        setTimeout(() => findAndScroll(attempt + 1), 400);
      }
    };
    findAndScroll();
  }

  /* ─── wire up the existing modal ────────────────────────────────── */
  function initModal() {
    const input = document.getElementById('globalSearchInput');
    if (!input) { setTimeout(initModal, 500); return; }

    // upgrade the results container
    const resultsBox = document.getElementById('globalSearchResults');
    if (resultsBox) {
      resultsBox.classList.add('ms-results-container');
      resultsBox.setAttribute('role', 'listbox');
      resultsBox.setAttribute('aria-label', 'Search results');
    }

    // upgrade the input
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck',   'false');
    input.setAttribute('role',         'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls',     'globalSearchResults');
    input.placeholder = 'Search messages…';

    // add clear button if not present
    if (!document.getElementById('msInputClear')) {
      const clear = document.createElement('button');
      clear.id = 'msInputClear';
      clear.className = 'ms-input-clear';
      clear.type = 'button';
      clear.setAttribute('aria-label', 'Clear search');
      clear.textContent = '✕';
      clear.style.display = 'none';
      input.parentNode.style.position = 'relative';
      input.after(clear);
      clear.addEventListener('click', () => {
        input.value = '';
        _query = '';
        _filterType = 'all';
        _filterDate = 'any';
        _activeTab = 'all';
        _mediaSubFilter = 'all';
        _dateRangeStart = '';
        _dateRangeEnd = '';
        _totalResults = 0;
        clear.style.display = 'none';
        const c = document.getElementById('globalSearchResults');
        if (c) c.innerHTML = '<div class="ms-empty-state">Enter a keyword to search across all chats</div>';
        input.focus();
      });
      input.addEventListener('input', () => {
        clear.style.display = input.value ? 'block' : 'none';
      });
    }

    // debounced search
    input.addEventListener('input', () => {
      const val = input.value.trim();
      _query = val;
      clearTimeout(_debounce);
      if (!val) { _query = ''; doSearch(true); return; }
      _debounce = setTimeout(() => doSearch(true), 350);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(_debounce); doSearch(true); }
      if (e.key === 'Escape') {
        const modal = document.getElementById('globalSearchModal');
        if (modal) modal.style.display = 'none';
      }
    });

    // focus input when modal opens
    const observer = new MutationObserver(() => {
      const modal = document.getElementById('globalSearchModal');
      if (!modal) return;
      if (modal.style.display !== 'none') {
        setTimeout(() => input.focus(), 80);
      }
    });
    const modal = document.getElementById('globalSearchModal');
    if (modal) observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
  }

  /* ─── filter helpers ────────────────────────────────────────────── */
  function matchesFilters(msg) {
    // Category tab filter
    if (_activeTab !== 'all') {
      const att = msg.attachment || {};
      const text = msg.text || msg.message || '';
      const hasLink = /https?:\/\//.test(text);
      const hasImage = att.type === 'image' || (att.url && /\.(jpg|jpeg|png|gif|webp)/i.test(att.url));
      const hasVideo = att.type === 'video' || (att.url && /\.(mp4|webm|mov)/i.test(att.url));
      const hasAudio = att.type === 'audio' || att.type === 'voice' || (att.url && /\.(mp3|ogg|wav|m4a)/i.test(att.url));
      const hasDoc = att.type === 'document' || (att.url && /\.(pdf|doc|docx|xls|xlsx|ppt|txt|csv)/i.test(att.url));
      const hasMedia = hasImage || hasVideo || hasAudio || att.type;

      if (_activeTab === 'chats') {
        // Show results from chats (all messages qualify)
      } else if (_activeTab === 'messages') {
        // Only text messages (no attachment)
        if (att.type) return false;
      } else if (_activeTab === 'media') {
        if (!hasMedia) return false;
        // Sub-filter for media types
        if (_mediaSubFilter !== 'all') {
          if (_mediaSubFilter === 'photos' && !hasImage) return false;
          if (_mediaSubFilter === 'videos' && !hasVideo) return false;
          if (_mediaSubFilter === 'gifs' && !(att.type === 'image' && /\.gif/i.test(att.url || ''))) return false;
          if (_mediaSubFilter === 'audio' && !hasAudio) return false;
        }
      } else if (_activeTab === 'links') {
        if (!hasLink) return false;
      } else if (_activeTab === 'docs') {
        if (!hasDoc) return false;
      }
    }

    // Type filter (legacy filter pills)
    if (_filterType !== 'all') {
      const att = msg.attachment || {};
      const text = msg.text || '';
      if (_filterType === 'text'  && (!text || att.type)) return false;
      if (_filterType === 'image' && att.type !== 'image') return false;
      if (_filterType === 'video' && att.type !== 'video') return false;
      if (_filterType === 'audio' && att.type !== 'audio') return false;
      if (_filterType === 'voice' && att.type !== 'voice') return false;
      if (_filterType === 'doc'   && att.type !== 'document') return false;
      if (_filterType === 'link'  && !/https?:\/\//.test(text)) return false;
    }

    // Date range filter
    if (_dateRangeStart || _dateRangeEnd) {
      let ts;
      try { ts = msg.createdAt || msg.timestamp;
        if (ts && typeof ts.toDate === 'function') ts = ts.toDate();
        else if (ts && ts.seconds) ts = new Date(ts.seconds * 1000);
        else ts = new Date(ts);
      } catch (_) { return true; }
      if (!ts || isNaN(ts.getTime())) return true;
      if (_dateRangeStart) {
        const start = new Date(_dateRangeStart + 'T00:00:00');
        if (ts < start) return false;
      }
      if (_dateRangeEnd) {
        const end = new Date(_dateRangeEnd + 'T23:59:59');
        if (ts > end) return false;
      }
    }

    // Legacy date filter pills
    if (_filterDate !== 'any' && msg.timestamp) {
      let ts;
      try { ts = typeof msg.timestamp.toDate === 'function' ? msg.timestamp.toDate() : new Date(msg.timestamp); } catch (_) { return true; }
      const now = new Date();
      const diff = now - ts;
      if (_filterDate === 'today'  && diff > 86400000) return false;
      if (_filterDate === 'week'   && diff > 604800000) return false;
      if (_filterDate === 'month'  && diff > 2592000000) return false;
    }
    return true;
  }

  function renderFilterRow(container) {
    if (container.querySelector('.ms-tab-bar')) return;

    /* ── Category tabs ── */
    const tabBar = document.createElement('div');
    tabBar.className = 'ms-tab-bar';
    const tabs = [
      ['all',     'All'],
      ['chats',   'Chats'],
      ['messages','Messages'],
      ['media',   'Media'],
      ['links',   'Links'],
      ['docs',    'Docs']
    ];
    tabs.forEach(([val, label]) => {
      const btn = document.createElement('button');
      btn.className = 'ms-tab-chip' + (_activeTab === val ? ' active' : '');
      btn.dataset.msTab = val;
      btn.textContent = label;
      btn.setAttribute('aria-pressed', _activeTab === val ? 'true' : 'false');
      btn.addEventListener('click', () => {
        _activeTab = val;
        tabBar.querySelectorAll('[data-ms-tab]').forEach(b => {
          b.classList.toggle('active', b.dataset.msTab === val);
          b.setAttribute('aria-pressed', b.dataset.msTab === val ? 'true' : 'false');
        });
        updateMediaSubBar(container);
        doSearch(true);
      });
      tabBar.appendChild(btn);
    });
    container.insertBefore(tabBar, container.firstChild);

    /* ── Media sub-filter bar ── */
    const subBar = document.createElement('div');
    subBar.className = 'ms-media-sub-bar';
    subBar.id = 'msMediaSubBar';
    subBar.style.display = 'none';
    tabBar.after(subBar);
    updateMediaSubBar(container);

    /* ── Date range row ── */
    const dateRow = document.createElement('div');
    dateRow.className = 'ms-date-row';
    dateRow.innerHTML = `
      <label>From</label>
      <input type="date" id="msDateFrom" value="${esc(_dateRangeStart)}" aria-label="Filter from date">
      <label>To</label>
      <input type="date" id="msDateTo" value="${esc(_dateRangeEnd)}" aria-label="Filter to date">
      <button class="ms-date-clear" id="msDateClear" title="Clear dates" aria-label="Clear date filter">
        <span class="material-symbols-outlined" style="font-size:16px">close</span>
      </button>
    `;
    subBar.after(dateRow);

    dateRow.querySelector('#msDateFrom').addEventListener('change', function () {
      _dateRangeStart = this.value;
      doSearch(true);
    });
    dateRow.querySelector('#msDateTo').addEventListener('change', function () {
      _dateRangeEnd = this.value;
      doSearch(true);
    });
    dateRow.querySelector('#msDateClear').addEventListener('click', function () {
      _dateRangeStart = '';
      _dateRangeEnd = '';
      dateRow.querySelector('#msDateFrom').value = '';
      dateRow.querySelector('#msDateTo').value = '';
      doSearch(true);
    });
  }

  function updateMediaSubBar(container) {
    const subBar = container.querySelector('#msMediaSubBar') || document.getElementById('msMediaSubBar');
    if (!subBar) return;
    subBar.style.display = _activeTab === 'media' ? 'flex' : 'none';
    if (subBar.dataset.bound) return;
    subBar.dataset.bound = '1';

    const mediaChips = [
      ['all',    'All'],
      ['photos', 'Photos'],
      ['videos', 'Videos'],
      ['gifs',   'GIFs'],
      ['audio',  'Audio']
    ];
    mediaChips.forEach(([val, label]) => {
      const btn = document.createElement('button');
      btn.className = 'ms-media-chip' + (_mediaSubFilter === val ? ' active' : '');
      btn.dataset.msMedia = val;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        _mediaSubFilter = val;
        subBar.querySelectorAll('[data-ms-media]').forEach(b => {
          b.classList.toggle('active', b.dataset.msMedia === val);
        });
        doSearch(true);
      });
      subBar.appendChild(btn);
    });
  }

  /* ─── in-chat search (WhatsApp-style) ────────────────────────────── */
  function initInChatSearch() {
    // Add keyboard shortcut Ctrl+F / Cmd+F for in-chat search
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (!window.currentChat?.id) return;
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && active.id !== 'globalSearchInput') return;
        e.preventDefault();
        openInChatSearch();
      }
    });

    // Hook into the header search button for in-chat search
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="openChatSearch"]');
      if (btn && window.currentChat?.id) {
        e.preventDefault();
        e.stopPropagation();
        openInChatSearch();
      }
    });
  }

  function openInChatSearch() {
    if (_icsActive) return;
    _icsActive = true;

    const chatArea = document.getElementById('chat-area');
    if (!chatArea) return;

    // Create the search bar if not present
    let bar = document.getElementById('ics-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'ics-bar';
      bar.innerHTML =
        '<button class="ics-close-btn" id="ics-close" title="Close search" aria-label="Close search"><span class="material-symbols-outlined">close</span></button>' +
        '<input type="text" id="ics-input" placeholder="Search..." autocomplete="off" spellcheck="false" aria-label="Search in chat">' +
        '<span class="ics-counter" id="ics-counter"></span>' +
        '<button class="ics-nav-btn" id="ics-prev" title="Previous result" aria-label="Previous result"><span class="material-symbols-outlined">keyboard_arrow_up</span></button>' +
        '<button class="ics-nav-btn" id="ics-next" title="Next result" aria-label="Next result"><span class="material-symbols-outlined">keyboard_arrow_down</span></button>';

      // Insert bar after the chat header or at the top of chat-area
      const header = chatArea.querySelector('#chat-header');
      if (header && header.nextSibling) {
        chatArea.insertBefore(bar, header.nextSibling);
      } else {
        chatArea.prepend(bar);
      }

      // Create filter chips
      let chips = document.getElementById('ics-chips');
      if (!chips) {
        chips = document.createElement('div');
        chips.id = 'ics-chips';
        const chipDefs = [
          ['all',   'Text'],
          ['media', 'Media'],
          ['links', 'Links'],
          ['docs',  'Docs'],
          ['audio', 'Audio']
        ];
        chipDefs.forEach(([val, label]) => {
          const btn = document.createElement('button');
          btn.className = 'ics-chip' + (_icsFilter === val ? ' active' : '');
          btn.dataset.icsFilter = val;
          btn.textContent = label;
          btn.addEventListener('click', () => {
            _icsFilter = val;
            chips.querySelectorAll('[data-ics-filter]').forEach(b => {
              b.classList.toggle('active', b.dataset.icsFilter === val);
            });
            runInChatSearch();
          });
          chips.appendChild(btn);
        });
        bar.after(chips);
      }

      // Event handlers
      bar.querySelector('#ics-close').addEventListener('click', closeInChatSearch);
      const input = bar.querySelector('#ics-input');
      input.addEventListener('input', () => {
        _icsQuery = input.value.trim();
        clearTimeout(_icsDebounce);
        _icsDebounce = setTimeout(() => runInChatSearch(), 250);
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) navigateInChatSearch(-1);
          else navigateInChatSearch(1);
        }
        if (e.key === 'Escape') closeInChatSearch();
      });
      bar.querySelector('#ics-prev').addEventListener('click', () => navigateInChatSearch(-1));
      bar.querySelector('#ics-next').addEventListener('click', () => navigateInChatSearch(1));
    }

    bar.classList.add('visible');
    const chipsEl = document.getElementById('ics-chips');
    if (chipsEl) chipsEl.classList.add('visible');

    // Reset state
    _icsResults = [];
    _icsIndex = -1;
    bar.querySelector('#ics-input').value = '';
    bar.querySelector('#ics-counter').textContent = '';
    bar.querySelector('#ics-input').focus();
  }

  function closeInChatSearch() {
    _icsActive = false;
    _icsQuery = '';
    _icsResults = [];
    _icsIndex = -1;
    clearInChatHighlights();
    const bar = document.getElementById('ics-bar');
    if (bar) bar.classList.remove('visible');
    const chips = document.getElementById('ics-chips');
    if (chips) chips.classList.remove('visible');
  }

  function runInChatSearch() {
    clearInChatHighlights();
    _icsResults = [];
    _icsIndex = -1;

    if (!_icsQuery) {
      updateInChatCounter();
      return;
    }

    const qLower = _icsQuery.toLowerCase();
    const messages = document.querySelectorAll('.message-bubble, .message-row, [data-message-id], [data-id]');

    messages.forEach(el => {
      // Filter by type
      if (_icsFilter !== 'all') {
        const hasAttachment = el.querySelector('[data-attachment-type], .attachment-preview, img[src*="attachment"], video, audio, .voice-msg');
        if (_icsFilter === 'media' && !hasAttachment) return;
        if (_icsFilter === 'links' && !el.querySelector('a[href], .url-preview')) return;
        if (_icsFilter === 'docs' && !el.querySelector('[data-attachment-type="document"], .doc-preview')) return;
        if (_icsFilter === 'audio' && !el.querySelector('audio, .voice-msg, [data-attachment-type="audio"], [data-attachment-type="voice"]')) return;
        if (_icsFilter === 'all' && hasAttachment) return; // text only
      }

      const textEl = el.querySelector('.message-text, .msg-text, .text-content, p');
      if (!textEl) return;
      const text = textEl.textContent || '';
      if (!text.toLowerCase().includes(qLower)) return;

      _icsResults.push({ el, textEl });
    });

    if (_icsResults.length > 0) {
      _icsIndex = 0;
      highlightCurrentInChatMatch();
    }
    updateInChatCounter();
  }

  function highlightCurrentInChatMatch() {
    // Remove previous active highlights
    document.querySelectorAll('.ics-match-highlight.active-match').forEach(el => {
      el.classList.remove('active-match');
    });

    if (_icsIndex < 0 || _icsIndex >= _icsResults.length) return;
    const match = _icsResults[_icsIndex];
    const text = match.textEl.textContent;
    const re = new RegExp('(' + _icsQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');

    // Highlight text in the element
    match.textEl.innerHTML = esc(text).replace(re, '<span class="ics-match-highlight active-match">$1</span>');

    // Scroll into view
    const highlighted = match.textEl.querySelector('.ics-match-highlight.active-match');
    if (highlighted) {
      highlighted.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function clearInChatHighlights() {
    document.querySelectorAll('.ics-match-highlight').forEach(el => {
      el.replaceWith(el.textContent);
    });
  }

  function navigateInChatSearch(dir) {
    if (!_icsResults.length) return;
    _icsIndex = (_icsIndex + dir + _icsResults.length) % _icsResults.length;
    highlightCurrentInChatMatch();
    updateInChatCounter();
  }

  function updateInChatCounter() {
    const counter = document.getElementById('ics-counter');
    if (!counter) return;
    if (!_icsResults.length) {
      counter.textContent = _icsQuery ? 'No results' : '';
    } else {
      counter.textContent = (_icsIndex + 1) + ' of ' + _icsResults.length;
    }
  }

  /* ─── keyboard shortcut Ctrl+Shift+F / Cmd+Shift+F ──────────────── */
  function initShortcut() {
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && active.id !== 'globalSearchInput') return;
        e.preventDefault();
        // find and click the search button or open modal directly
        const btn = document.getElementById('searchGlobalBtn') ||
                    document.querySelector('[data-action="global-search"], .global-search-trigger');
        if (btn) { btn.click(); return; }
        const modal = document.getElementById('globalSearchModal');
        if (modal) {
          modal.style.display = 'flex';
          setTimeout(() => document.getElementById('globalSearchInput')?.focus(), 80);
        }
      }
    });
  }

  /* ─── add search button to header ───────────────────────────────── */
  function initHeaderBtn() {
    if (document.getElementById('msGlobalSearchBtn')) return;
    const header = document.querySelector('.chat-header .chat-header-actions, .chat-header-buttons, #chatHeaderActions');
    if (!header) return;
    const btn = document.createElement('button');
    btn.id = 'msGlobalSearchBtn';
    btn.className = 'icon-btn ms-global-btn';
    btn.type = 'button';
    btn.title = 'Search all messages (Ctrl+Shift+F)';
    btn.setAttribute('aria-label', 'Search all messages');
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;
    btn.addEventListener('click', () => {
      const modal = document.getElementById('globalSearchModal');
      if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('globalSearchInput')?.focus(), 80);
      }
    });
    header.prepend(btn);
  }

  /* ─── AI-Assisted Search ───────────────────────────────────────── */
  async function aiRerankSearch(query, existingResults) {
    if (!query || !existingResults.length) return existingResults;

    try {
      const functions = firebase.functions();
      const aiSearch = functions.httpsCallable('aiSearchMessages', { timeout: 20000 });
      const chatIds = [...new Set(existingResults.map(r => r.chatId))];
      const result = await aiSearch({ query, chatIds });
      if (result.data && result.data.results && result.data.aiRanked) {
        return result.data.results;
      }
    } catch (err) {
      if (window.__DEBUG__) console.warn('[MsgSearch] AI rerank failed:', err.message);
    }
    return existingResults;
  }

  /* ─── Enhanced doSearch with AI mode ──────────────────────────── */
  const _origDoSearch = doSearch;
  async function doSearchWithAI(reset) {
    await _origDoSearch.call(this, reset);

    // If AI search is active and we have keyword results, rerank them
    if (window.AIFeatures?.isAiSearchActive?.() && _query.trim()) {
      const container = document.getElementById('globalSearchResults');
      if (!container) return;

      const cards = container.querySelectorAll('.ms-card');
      if (cards.length > 1) {
        // Collect current results
        const results = Array.from(cards).map(card => ({
          id: card.dataset.msgId,
          chatId: card.dataset.chatId,
          text: card.querySelector('.ms-card-snippet')?.textContent || '',
          senderName: card.querySelector('.ms-card-sender')?.textContent || '',
          chatName: card.querySelector('.ms-card-chat')?.textContent || ''
        }));

        // Show reranking indicator
        const indicator = document.createElement('div');
        indicator.className = 'ms-ai-rerank-indicator';
        indicator.innerHTML = '<span style="font-size:12px;color:var(--primary);font-weight:600;">✨ AI reranking results...</span>';
        container.insertBefore(indicator, container.firstChild);

        const reranked = await aiRerankSearch(_query, results);

        // Re-render with reranked order
        indicator.remove();
        container.innerHTML = '';
        renderResults(reranked, _query, false);
      }
    }
  }

  /* ─── init ──────────────────────────────────────────────────────── */
  function init() {
    initModal();
    initShortcut();
    initInChatSearch();
    // wait a tick for DOM to settle before adding header btn
    setTimeout(initHeaderBtn, 800);

    // Override doSearch to add AI mode
    doSearch = doSearchWithAI;

    // Expose openChatSearch for header button and context menu
    window.openChatSearch = function (scope) {
      if (scope === 'current') _scope = 'current';
      else _scope = 'all';
      var modal = document.getElementById('globalSearchModal');
      if (modal) { modal.style.display = 'flex'; setTimeout(function () { var inp = document.getElementById('globalSearchInput'); if (inp) inp.focus(); }, 80); }
    };

    // expose API
    window.messageSearch = { open: function () {
      var modal = document.getElementById('globalSearchModal');
      if (modal) { modal.style.display = 'flex'; setTimeout(function () { var inp = document.getElementById('globalSearchInput'); if (inp) inp.focus(); }, 80); }
    }};
  }

  if (document.readyState === 'complete') setTimeout(init, 0);
  else window.addEventListener('load', () => setTimeout(init, 0));
})();
