// ============================================================
// MESSAGE SEARCH — deep cross-conversation search
// Enhances the existing #globalSearchModal with real Firestore
// queries across all the user's chats.
//
// Drop into works/chat/ and add to index.html <head>:
//   <script src="message-search.js" defer></script>
// ============================================================

(function () {
  'use strict';

  const DEBOUNCE_MS   = 350;
  const MAX_PER_CHAT  = 30;
  const MAX_CHATS     = 25;
  const MIN_QUERY_LEN = 2;

  let _timer = null;
  let _lastQuery = '';
  let _searching = false;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _uid() {
    return (typeof currentUser !== 'undefined' ? currentUser : auth?.currentUser)?.uid || null;
  }

  function _db() { return typeof db !== 'undefined' ? db : null; }

  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _highlight(text, query) {
    if (!query) return _esc(text);
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return _esc(text).replace(new RegExp(`(${safe})`, 'gi'), '<mark class="ms-hl">$1</mark>');
  }

  function _relTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const day = Math.floor(h / 24);
    if (day > 0) return `${day}d ago`;
    if (h > 0)   return `${h}h ago`;
    if (m > 0)   return `${m}m ago`;
    return 'just now';
  }

  // ── Fetch user's chat IDs ─────────────────────────────────────────────────

  async function _getChatIds(uid) {
    const database = _db();
    if (!database) return [];
    const [directs, groups] = await Promise.all([
      database.collection('directChats')
        .where('memberIds', 'array-contains', uid)
        .orderBy('lastMessageAt', 'desc')
        .limit(MAX_CHATS)
        .get().catch(() => ({ docs: [] })),
      database.collection('groups')
        .where('memberIds', 'array-contains', uid)
        .orderBy('lastMessageAt', 'desc')
        .limit(MAX_CHATS)
        .get().catch(() => ({ docs: [] })),
    ]);
    const result = [];
    directs.docs.forEach(d => result.push({ id: d.id, type: 'direct', name: d.data().name || '' }));
    groups.docs.forEach(d  => result.push({ id: d.id, type: 'group',  name: d.data().name || 'Group' }));
    return result;
  }

  // ── Search messages in a single chat ──────────────────────────────────────

  async function _searchChat(chatInfo, query, uid) {
    const database = _db();
    if (!database) return [];
    const field = chatInfo.type === 'direct' ? 'directId' : 'groupId';
    const snap = await database.collection('messages')
      .where(field, '==', chatInfo.id)
      .orderBy('createdAt', 'desc')
      .limit(MAX_PER_CHAT)
      .get().catch(() => ({ docs: [] }));

    const q = query.toLowerCase();
    return snap.docs
      .filter(doc => {
        const t = doc.data().text || '';
        return t.toLowerCase().includes(q);
      })
      .map(doc => ({
        chatInfo,
        message: { id: doc.id, ...doc.data() },
      }));
  }

  // ── Resolve chat display name for direct chats ────────────────────────────

  async function _resolveChatNames(chatIds, uid) {
    const database = _db();
    if (!database) return chatIds;
    const directs = chatIds.filter(c => c.type === 'direct');
    if (!directs.length) return chatIds;

    const otherUids = [...new Set(
      directs.map(c => {
        // directChat ID is usually `uid1_uid2` sorted
        const parts = c.id.split('_');
        return parts.find(p => p !== uid) || '';
      }).filter(Boolean)
    )];

    if (!otherUids.length) return chatIds;

    const userDocs = await Promise.all(
      otherUids.map(u => database.collection('users').doc(u).get().catch(() => null))
    );
    const userMap = {};
    userDocs.forEach(doc => {
      if (doc?.exists) userMap[doc.id] = doc.data()?.displayName || doc.data()?.email || doc.id;
    });

    return chatIds.map(c => {
      if (c.type !== 'direct') return c;
      const parts = c.id.split('_');
      const otherId = parts.find(p => p !== uid) || '';
      return { ...c, name: userMap[otherId] || c.name || 'Direct chat' };
    });
  }

  // ── Render results ────────────────────────────────────────────────────────

  function _renderResults(results, query) {
    const container = document.getElementById('globalSearchResults');
    if (!container) return;

    if (!results.length) {
      container.innerHTML = `<div class="ms-empty">No messages found for "<strong>${_esc(query)}</strong>"</div>`;
      return;
    }

    // Group by chat
    const byChat = new Map();
    results.forEach(r => {
      const key = r.chatInfo.id;
      if (!byChat.has(key)) byChat.set(key, { info: r.chatInfo, msgs: [] });
      byChat.get(key).msgs.push(r.message);
    });

    let html = `<div class="ms-count">${results.length} result${results.length !== 1 ? 's' : ''} in ${byChat.size} conversation${byChat.size !== 1 ? 's' : ''}</div>`;

    byChat.forEach(({ info, msgs }) => {
      const typeIcon = info.type === 'group' ? '👥' : '💬';
      html += `<div class="ms-group">
        <div class="ms-group-header">${typeIcon} ${_esc(info.name || info.id)}</div>`;
      msgs.forEach(msg => {
        const preview = (msg.text || '').substring(0, 160);
        html += `<div class="ms-result" data-chat-id="${_esc(info.id)}" data-chat-type="${_esc(info.type)}" data-msg-id="${_esc(msg.id)}">
          <div class="ms-result-text">${_highlight(preview, query)}</div>
          <div class="ms-result-meta">
            <span>${_esc(msg.senderName || msg.senderUID || '')}</span>
            <span>${_relTime(msg.createdAt)}</span>
          </div>
        </div>`;
      });
      html += `</div>`;
    });

    container.innerHTML = html;

    // Click to navigate
    container.querySelectorAll('.ms-result').forEach(el => {
      el.addEventListener('click', () => {
        const { chatId, chatType } = el.dataset;
        _closeModal();
        // Use app globals to open the chat
        if (chatType === 'group' && typeof openGroupChat === 'function') {
          openGroupChat(chatId);
        } else if (typeof openDirectChat === 'function') {
          openDirectChat(chatId);
        } else if (typeof openChat === 'function') {
          openChat(chatId, chatType);
        }
      });
    });
  }

  function _setLoading(on) {
    const container = document.getElementById('globalSearchResults');
    if (!container) return;
    if (on) container.innerHTML = '<div class="ms-loading"><span class="ms-spinner"></span> Searching…</div>';
  }

  // ── Run search ────────────────────────────────────────────────────────────

  async function _runSearch(query) {
    if (_searching || query === _lastQuery) return;
    if (query.length < MIN_QUERY_LEN) {
      const c = document.getElementById('globalSearchResults');
      if (c) c.innerHTML = `<div class="ms-hint">Type at least ${MIN_QUERY_LEN} characters to search across all messages</div>`;
      return;
    }

    const uid = _uid();
    const database = _db();
    if (!uid || !database) return;

    _searching = true;
    _lastQuery = query;
    _setLoading(true);

    try {
      let chatIds = await _getChatIds(uid);
      chatIds = await _resolveChatNames(chatIds, uid);

      const allResults = (await Promise.all(
        chatIds.map(c => _searchChat(c, query, uid))
      )).flat();

      // Sort by newest first
      allResults.sort((a, b) => {
        const ta = a.message.createdAt?.toMillis?.() || 0;
        const tb = b.message.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });

      _renderResults(allResults, query);
    } catch (err) {
      const c = document.getElementById('globalSearchResults');
      if (c) c.innerHTML = `<div class="ms-empty">Search failed. Try again.</div>`;
    } finally {
      _searching = false;
    }
  }

  // ── Modal open/close ──────────────────────────────────────────────────────

  function _closeModal() {
    const modal = document.getElementById('globalSearchModal');
    if (modal) modal.style.display = 'none';
    _lastQuery = '';
  }

  // ── Hook into existing globalSearchInput ──────────────────────────────────

  function _hookInput() {
    const input = document.getElementById('globalSearchInput');
    if (!input || input._msPatched) return;
    input._msPatched = true;

    // Update placeholder
    input.placeholder = 'Search messages across all conversations…';

    input.addEventListener('input', () => {
      const query = input.value.trim();
      clearTimeout(_timer);
      if (!query) {
        _lastQuery = '';
        const c = document.getElementById('globalSearchResults');
        if (c) c.innerHTML = `<div class="ms-hint">Start typing to search messages across all your conversations</div>`;
        return;
      }
      _timer = setTimeout(() => _runSearch(query), DEBOUNCE_MS);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') _closeModal();
    });

    // Set initial hint
    const c = document.getElementById('globalSearchResults');
    if (c && !c.innerHTML.trim()) {
      c.innerHTML = `<div class="ms-hint">Start typing to search messages across all your conversations</div>`;
    }
  }

  // ── Keyboard shortcut Ctrl/Cmd+K ─────────────────────────────────────────

  function _hookShortcut() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const modal = document.getElementById('globalSearchModal');
        if (!modal) return;
        if (modal.style.display === 'none' || !modal.style.display) {
          modal.style.display = 'flex';
          setTimeout(() => document.getElementById('globalSearchInput')?.focus(), 50);
        } else {
          _closeModal();
        }
      }
    });
  }

  // ── Add Ctrl+K hint below input ───────────────────────────────────────────

  function _addShortcutHint() {
    const input = document.getElementById('globalSearchInput');
    if (!input || document.querySelector('.ms-kbd-hint')) return;
    const hint = document.createElement('div');
    hint.className = 'ms-kbd-hint';
    hint.innerHTML = `<kbd>Ctrl</kbd><kbd>K</kbd> to open · <kbd>Esc</kbd> to close`;
    input.parentNode?.insertBefore(hint, input.nextSibling);
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  function _boot() {
    _hookInput();
    _hookShortcut();
    _addShortcutHint();
    // Watch for the modal being opened (it starts display:none)
    const modal = document.getElementById('globalSearchModal');
    if (modal) {
      const mo = new MutationObserver(() => {
        if (modal.style.display !== 'none') {
          _hookInput();
          _addShortcutHint();
          setTimeout(() => document.getElementById('globalSearchInput')?.focus(), 50);
        }
      });
      mo.observe(modal, { attributes: true, attributeFilter: ['style'] });
    }
    setTimeout(_boot, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

})();
