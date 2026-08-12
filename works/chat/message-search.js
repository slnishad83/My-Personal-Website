/* =============================================
   MESSAGE SEARCH v1.0
   Full-text search across all chat history.
   - Debounced live search (350ms)
   - Highlighted match snippets
   - Infinite scroll with Firestore cursor pagination
   - Scope toggle: All Chats vs Current Chat
   - Click result â†’ jumps to that chat + message
   - Keyboard shortcut: Ctrl+F / Cmd+F
   ============================================= */
(function () {
  'use strict';

  /* â”€â”€â”€ state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  /* â”€â”€â”€ escape html â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* â”€â”€â”€ highlight match in text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function highlight(text, query) {
    if (!query) return esc(text);
    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
    return esc(text).replace(re, '<mark class="ms-highlight">$1</mark>');
  }

  /* â”€â”€â”€ snippet around match â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function snippet(text, query, radius) {
    radius = radius || 60;
    if (!query) return esc(text.slice(0, 140));
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return esc(text.slice(0, 140));
    const start = Math.max(0, idx - radius);
    const end   = Math.min(text.length, idx + query.length + radius);
    const pre   = start > 0 ? 'â€¦' : '';
    const post  = end < text.length ? 'â€¦' : '';
    return pre + highlight(text.slice(start, end), query) + post;
  }

  /* â”€â”€â”€ format timestamp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  /* â”€â”€â”€ get chats to search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  /* â”€â”€â”€ search one chat in Firestore â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  /* â”€â”€â”€ build result card HTML â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function buildCard(msg, q) {
    const text       = msg.text || msg.message || msg.body || msg.content || '';
    const senderName = esc(msg.senderName || msg.displayName || msg.name || 'Unknown');
    const chatName   = esc(msg.chatName || msg.groupName || msg.chatId || '');
    const ts         = fmtTs(msg.createdAt || msg.timestamp);
    const snip       = snippet(text, q);

    return `<div class="ms-card" role="option" data-msg-id="${esc(msg.id)}" data-chat-id="${esc(msg.chatId)}" tabindex="0"
  aria-label="${esc(text.slice(0,80))}">
  <div class="ms-card-meta">
    <span class="ms-card-chat">${chatName || '<em>Direct message</em>'}</span>
    <span class="ms-card-time">${esc(ts)}</span>
  </div>
  <div class="ms-card-sender">${senderName}</div>
  <div class="ms-card-snippet">${snip}</div>
</div>`;
  }

  /* â”€â”€â”€ render results into the container â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function renderResults(results, q, append) {
    const container = document.getElementById('globalSearchResults');
    if (!container) return;

    if (!append) {
      container.innerHTML = '';
      // Add scope toggle
      if (!document.getElementById('msScopeToggle')) {
        const toggleBar = document.createElement('div');
        toggleBar.className = 'ms-scope-bar';
        toggleBar.innerHTML = `
<button class="ms-scope-btn${_scope==='all'?' ms-active':''}" data-scope="all">All Chats</button>
<button class="ms-scope-btn${_scope==='current'?' ms-active':''}" data-scope="current">Current Chat</button>`;
        container.before(toggleBar);
        // Inject advanced filter pills
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
      container.innerHTML = '<div class="ms-empty">No messages found for "<strong>' + esc(q) + '</strong>"</div>';
      return;
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
      sentinel.innerHTML = '<div class="ms-loader" aria-label="Loading more resultsâ€¦"></div>';
      container.appendChild(sentinel);
      if (_observer) _observer.disconnect();
      _observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !_loading) loadMore(q);
      }, { root: container, threshold: 0.1 });
      _observer.observe(sentinel);
    }

    // attach click/enter â†’ jump to message
    container.querySelectorAll('.ms-card:not([data-ms-bound])').forEach(card => {
      card.dataset.msBound = '1';
      const jump = () => jumpToMessage(card.dataset.chatId, card.dataset.msgId);
      card.addEventListener('click', jump);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); } });
    });
  }

  /* â”€â”€â”€ load more (infinite scroll) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  /* â”€â”€â”€ main search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
      container.innerHTML = '<div class="ms-spinner" aria-label="Searchingâ€¦"></div>';
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

  /* â”€â”€â”€ jump to message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  /* â”€â”€â”€ wire up the existing modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
    input.placeholder = 'Search messagesâ€¦';

    // add clear button if not present
    if (!document.getElementById('msInputClear')) {
      const clear = document.createElement('button');
      clear.id = 'msInputClear';
      clear.className = 'ms-input-clear';
      clear.type = 'button';
      clear.setAttribute('aria-label', 'Clear search');
      clear.textContent = 'âœ•';
      clear.style.display = 'none';
      input.parentNode.style.position = 'relative';
      input.after(clear);
      clear.addEventListener('click', () => {
        input.value = '';
        _query = '';
        _filterType = 'all';
        _filterDate = 'any';
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

  /* â”€â”€â”€ filter helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function matchesFilters(msg) {
    // Type filter
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
    // Date filter
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
    if (container.querySelector('.ms-filter-row')) return;
    const row = document.createElement('div');
    row.className = 'ms-filter-row';

    // Type pills
    const typeLabel = document.createElement('span');
    typeLabel.className = 'ms-filter-group-label';
    typeLabel.textContent = 'Type:';
    row.appendChild(typeLabel);

    [['all','All'],['text','Text'],['image','Images'],['video','Videos'],
     ['voice','Voice'],['audio','Audio'],['doc','Docs'],['link','Links']].forEach(([val, label]) => {
      const btn = document.createElement('button');
      btn.className = 'ms-filter-pill' + (_filterType === val ? ' active' : '');
      btn.dataset.filterType = val;
      btn.textContent = label;
      btn.setAttribute('aria-pressed', _filterType === val ? 'true' : 'false');
      btn.addEventListener('click', () => {
        _filterType = val;
        row.querySelectorAll('[data-filter-type]').forEach(b => { b.classList.toggle('active', b.dataset.filterType === val); b.setAttribute('aria-pressed', b.dataset.filterType === val ? 'true' : 'false'); });
        doSearch(true);
      });
      row.appendChild(btn);
    });

    // Date pills
    const dateLabel = document.createElement('span');
    dateLabel.className = 'ms-filter-group-label';
    dateLabel.style.marginLeft = '8px';
    dateLabel.textContent = 'Date:';
    row.appendChild(dateLabel);

    [['any','Any time'],['today','Today'],['week','This week'],['month','This month']].forEach(([val, label]) => {
      const btn = document.createElement('button');
      btn.className = 'ms-filter-pill' + (_filterDate === val ? ' active' : '');
      btn.dataset.filterDate = val;
      btn.textContent = label;
      btn.setAttribute('aria-pressed', _filterDate === val ? 'true' : 'false');
      btn.addEventListener('click', () => {
        _filterDate = val;
        row.querySelectorAll('[data-filter-date]').forEach(b => { b.classList.toggle('active', b.dataset.filterDate === val); b.setAttribute('aria-pressed', b.dataset.filterDate === val ? 'true' : 'false'); });
        doSearch(true);
      });
      row.appendChild(btn);
    });

    container.appendChild(row);
  }

  /* â”€â”€â”€ keyboard shortcut Ctrl+Shift+F / Cmd+Shift+F â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  /* â”€â”€â”€ add search button to header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  /* â”€â”€â”€ AI-Assisted Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  /* â”€â”€â”€ Enhanced doSearch with AI mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
        indicator.innerHTML = '<span style="font-size:12px;color:var(--primary);font-weight:600;">âœ¨ AI reranking results...</span>';
        container.insertBefore(indicator, container.firstChild);

        const reranked = await aiRerankSearch(_query, results);

        // Re-render with reranked order
        indicator.remove();
        container.innerHTML = '';
        renderResults(reranked, _query, false);
      }
    }
  }

  /* â”€â”€â”€ init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function init() {
    initModal();
    initShortcut();
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
