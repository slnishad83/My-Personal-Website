(function() {
  'use strict';

  let _archivedChatIds = new Set();
  let _archivedSectionExpanded = true;
  let _archiveCountBadge = null;
  let _archiveSectionEl = null;
  let _undoTimers = new Map();

  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };

  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  function _docRef() {
    const uid = _uid();
    if (!uid) return null;
    const database = window.App?.db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
    if (!database) return null;
    return database.collection('users').doc(uid);
  }

  async function _persist() {
    const ref = _docRef();
    if (!ref) return;
    try {
      await ref.set({ archivedChats: Array.from(_archivedChatIds) }, { merge: true });
    } catch (e) {
      if (window.__DEBUG__) console.error('[Archive] persist failed', e);
    }
  }

  async function _loadArchived() {
    const ref = _docRef();
    if (!ref) return;
    try {
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data();
        const arr = Array.isArray(data.archivedChatIds) ? data.archivedChatIds : (Array.isArray(data.archivedChats) ? data.archivedChats : []);
        if (arr.length) {
          _archivedChatIds = new Set(arr);
        }
      }
    } catch (e) {
      if (window.__DEBUG__) console.error('[Archive] load failed', e);
    }
    _updateBadge();
    _renderArchiveSection();
  }

  function _updateBadge() {
    if (!_archiveCountBadge) {
      _archiveCountBadge = document.getElementById('archive-count-badge');
    }
    if (_archiveCountBadge) {
      const count = _archivedChatIds.size;
      if (count > 0) {
        _archiveCountBadge.textContent = count > 99 ? '99+' : count;
        _archiveCountBadge.style.display = 'flex';
      } else {
        _archiveCountBadge.style.display = 'none';
      }
    }
  }

  function _hideChatFromList(chatId) {
    const el = document.querySelector('[data-chat-id="' + chatId + '"]');
    if (el) el.style.display = 'none';
  }

  function _showChatInList(chatId) {
    const el = document.querySelector('[data-chat-id="' + chatId + '"]');
    if (el) el.style.display = '';
  }

  function _showToast(msg, type) { if (App && App.toast) App.toast(msg, type); else if (typeof showToast === 'function') showToast(msg, type); }

  function _showUndoToast(chatId, action) {
    const _toastId = 'archive-toast-' + Date.now();
    let toastEl = document.getElementById('archive-undo-toast');
    if (toastEl) toastEl.remove();
    toastEl = document.createElement('div');
    toastEl.id = 'archive-undo-toast';
    toastEl.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1f2c34;color:#e9edef;padding:12px 16px;border-radius:12px;display:flex;align-items:center;gap:12px;z-index:100000;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);min-width:200px;max-width:90vw;animation:slideUpToast 0.3s ease;';
    const msgSpan = document.createElement('span');
    msgSpan.textContent = action === 'archive' ? 'Chat archived' : 'Chat unarchived';
    msgSpan.style.flex = '1';
    const undoBtn = document.createElement('button');
    undoBtn.textContent = 'UNDO';
    undoBtn.style.cssText = 'background:none;border:none;color:#00a884;font-weight:700;cursor:pointer;font-size:14px;padding:4px 8px;text-transform:uppercase;';
    toastEl.appendChild(msgSpan);
    toastEl.appendChild(undoBtn);
    document.body.appendChild(toastEl);

    if (_undoTimers.has(chatId)) {
      clearTimeout(_undoTimers.get(chatId));
      _undoTimers.delete(chatId);
    }

    undoBtn.addEventListener('click', function() {
      if (action === 'archive') {
        window.unarchiveChat(chatId);
      } else {
        window.archiveChat(chatId);
      }
      if (toastEl.parentNode) toastEl.remove();
      if (_undoTimers.has(chatId)) {
        clearTimeout(_undoTimers.get(chatId));
        _undoTimers.delete(chatId);
      }
    });

    const timer = setTimeout(function() {
      if (toastEl.parentNode) toastEl.remove();
      _undoTimers.delete(chatId);
    }, 3000);
    _undoTimers.set(chatId, timer);
  }

  function _injectStyles() {
    if (document.getElementById('archive-chat-styles')) return;
    const style = document.createElement('style');
    style.id = 'archive-chat-styles';
    style.textContent = '\n' +
      '@keyframes slideUpToast{from{transform:translateX(-50%) translateY(20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}\n' +
      '.archive-section-header{display:flex;align-items:center;padding:12px 16px;cursor:pointer;user-select:none;border-bottom:1px solid var(--outline-variant,#313d45);background:var(--surface-container,#1f2c34);}\n' +
      '.archive-section-header:hover{background:var(--surface-container-high,#2a3942);}\n' +
      '.archive-section-chevron{font-size:18px;color:var(--on-surface-variant,#8696a0);transition:transform 0.2s;margin-right:10px;}\n' +
      '.archive-section-chevron.collapsed{transform:rotate(-90deg);}\n' +
      '.archive-section-title{font-size:14px;font-weight:600;color:var(--on-surface,#e9edef);flex:1;}\n' +
      '.archive-section-count{font-size:12px;color:var(--on-surface-variant,#8696a0);background:var(--surface-container-highest,#2a3942);padding:2px 8px;border-radius:10px;}\n' +
      '.archive-section-list{overflow:hidden;transition:max-height 0.3s ease;}\n' +
      '.archive-section-list.collapsed{max-height:0!important;}\n';
    document.head.appendChild(style);
  }

  function _chatStateChats() {
    if (typeof window.getCurrentChatState !== 'function') return [];
    const s = window.getCurrentChatState();
    return (s && s.chats) || [];
  }

  function _chatRow(chat) {
    const uid = _uid();
    const name = chat.name || chat.displayName || (chat.type === 'direct' && chat.otherUserId ? chat.otherUserId : 'Chat');
    const photo = chat.photoURL || chat.avatar || '';
    const type = chat.type || 'direct';
    const initials = (name || '?')[0].toUpperCase();
    const avatar = photo
      ? '<img src="' + (window.App && App.escHtml ? App.escHtml(photo) : String(photo)) + '" class="w-11 h-11 rounded-full object-cover flex-shrink-0" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0" style="display:none">' + _esc(initials) + '</div>'
      : '<div class="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">' + _esc(initials) + '</div>';
    const row = document.createElement('div');
    row.setAttribute('data-chat-id', chat.id);
    row.setAttribute('data-chat-type', type);
    row.className = 'archive-chat-row';
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;border-radius:12px;transition:background 0.15s;user-select:none;';
    row.innerHTML = avatar +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-weight:600;font-size:14px;color:var(--on-surface,#e9edef);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(name) + '</div>' +
      '<div style="font-size:12px;color:var(--on-surface-variant,#8696a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(chat.lastMessage || '') + '</div>' +
      '</div>';
    row.addEventListener('click', function () {
      if (chat.id === uid && typeof window.startSavedMessages === 'function') return window.startSavedMessages();
      if (typeof window.openChat === 'function') window.openChat(chat.id, type);
      else if (typeof window.selectChat === 'function') window.selectChat(chat.id, type);
    });
    row.addEventListener('mouseenter', function () { row.style.background = 'var(--surface-container,#2a3942)'; });
    row.addEventListener('mouseleave', function () { row.style.background = 'transparent'; });
    return row;
  }

  function _renderArchiveSection() {
    const chatList = document.getElementById('chat-list');
    if (!chatList) return;

    const existing = document.getElementById('archive-section-wrapper');
    if (existing) existing.remove();

    if (_archivedChatIds.size === 0) {
      _updateBadge();
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'archive-section-wrapper';
    wrapper.style.flexShrink = '0';

    const header = document.createElement('div');
    header.className = 'archive-section-header';
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', String(_archivedSectionExpanded));

    const chevron = document.createElement('span');
    chevron.className = 'archive-section-chevron' + (_archivedSectionExpanded ? '' : ' collapsed');
    chevron.textContent = '▾';

    const title = document.createElement('span');
    title.className = 'archive-section-title';
    title.textContent = 'Archived Chats';

    const count = document.createElement('span');
    count.className = 'archive-section-count';
    count.id = 'archive-count-badge';
    count.textContent = _archivedChatIds.size;
    _archiveCountBadge = count;

    header.appendChild(chevron);
    header.appendChild(title);
    header.appendChild(count);

    const list = document.createElement('div');
    list.className = 'archive-section-list' + (_archivedSectionExpanded ? '' : ' collapsed');
    list.style.maxHeight = _archivedSectionExpanded ? '2000px' : '0';

    const stateChats = _chatStateChats();
    let rowsRendered = 0;
    Array.from(_archivedChatIds).forEach(function (cid) {
      const chat = stateChats.find(function (c) { return c.id === cid; });
      if (!chat) return;
      list.appendChild(_chatRow(chat));
      rowsRendered++;
    });
    if (rowsRendered === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:8px 16px;font-size:12px;color:var(--on-surface-variant,#8696a0);';
      empty.textContent = 'Archived chats not in your list yet';
      list.appendChild(empty);
    }

    header.addEventListener('click', function() {
      _archivedSectionExpanded = !_archivedSectionExpanded;
      chevron.classList.toggle('collapsed', !_archivedSectionExpanded);
      header.setAttribute('aria-expanded', String(_archivedSectionExpanded));
      list.style.maxHeight = _archivedSectionExpanded ? '2000px' : '0';
      list.classList.toggle('collapsed', !_archivedSectionExpanded);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(list);

    const firstChild = chatList.firstChild;
    if (firstChild) {
      chatList.insertBefore(wrapper, firstChild);
    } else {
      chatList.appendChild(wrapper);
    }

    _updateBadge();
  }

  window._te_renderArchives = _renderArchiveSection;

  window.archiveChat = function(chatId) {
    if (!chatId) {
      if (typeof currentChat !== 'undefined' && currentChat) {
        chatId = currentChat.id || currentChat;
      }
    }
    if (!chatId) return;

    if (_archivedChatIds.has(chatId)) return;
    _archivedChatIds.add(chatId);
    _hideChatFromList(chatId);
    _persist();
    _renderArchiveSection();
    _showUndoToast(chatId, 'archive');
  };

  window.unarchiveChat = function(chatId) {
    if (!chatId) return;
    if (!_archivedChatIds.has(chatId)) return;
    _archivedChatIds.delete(chatId);
    _showChatInList(chatId);
    _persist();
    _renderArchiveSection();
    _showUndoToast(chatId, 'unarchive');
  };

  window.getArchivedChats = function() {
    return Array.from(_archivedChatIds);
  };

  window.isChatArchived = function(chatId) {
    return _archivedChatIds.has(chatId);
  };

  window.toggleArchiveSection = function() {
    _archivedSectionExpanded = !_archivedSectionExpanded;
    _renderArchiveSection();
  };

  function _init() {
    _injectStyles();
    _loadArchived();

    document.addEventListener('nsl:chats-loaded', function () {
      _renderArchiveSection();
    });
    document.addEventListener('nsl:chats-list-rendered', function () {
      _renderArchiveSection();
    });

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(function(mutations) {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              const items = node.matches && node.matches('[data-chat-id]') ? [node] : (node.querySelectorAll ? Array.from(node.querySelectorAll('[data-chat-id]')) : []);
              items.forEach(function(el) {
                if (el.closest && el.closest('#archive-section-wrapper')) return;
                const cid = el.dataset && el.dataset.chatId;
                if (cid && _archivedChatIds.has(cid)) {
                  el.style.display = 'none';
                }
              });
            }
          }
        }
      });
      const chatList = document.getElementById('chat-list');
      if (chatList) {
        observer.observe(chatList, { childList: true, subtree: true });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
