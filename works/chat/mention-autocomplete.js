/* ============================================================
   MENTION AUTOCOMPLETE — @mention in group chats
   Detects @ in input, shows member picker dropdown, inserts mention.
   ============================================================ */
(function () {
  'use strict';

  let _popup = null;
  let _active = false;
  let _query = '';
  let _members = [];
  let _filtered = [];
  let _selectedIndex = 0;
  let _inputEl = null;
  let _caretPos = 0;
  let _atStart = -1;

  function _getPopup() {
    if (_popup) return _popup;
    _popup = document.createElement('div');
    _popup.id = 'mention-popup';
    _popup.className = 'mention-popup hidden';
    _popup.innerHTML = '<div class="mention-popup-list"></div>';
    document.body.appendChild(_popup);
    return _popup;
  }

  function _injectStyles() {
    if (document.getElementById('mention-autocomplete-styles')) return;
    var style = document.createElement('style');
    style.id = 'mention-autocomplete-styles';
    style.textContent = '\n' +
      '.mention-popup{position:fixed;z-index:9999;background:var(--surface-container,#1f2c34);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.35);max-height:240px;width:280px;overflow:hidden;transform-origin:bottom;transition:opacity 0.15s,transform 0.15s;opacity:1;transform:scale(1);}\n' +
      '.mention-popup.hidden{opacity:0;transform:scale(0.95);pointer-events:none;}\n' +
      '.mention-popup-list{overflow-y:auto;max-height:240px;padding:6px 0;}\n' +
      '.mention-popup-item{display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;transition:background 0.1s;}\n' +
      '.mention-popup-item:hover,.mention-popup-item.selected{background:var(--surface-container-high,#2a3942);}\n' +
      '.mention-popup-avatar{width:32px;height:32px;border-radius:50%;object-fit:cover;background:var(--surface-container-highest,#2a3942);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--on-surface-variant,#8696a0);flex-shrink:0;}\n' +
      '.mention-popup-name{font-size:14px;font-weight:500;color:var(--on-surface,#e9edef);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n' +
      '.mention-popup-handle{font-size:12px;color:var(--on-surface-variant,#8696a0);margin-left:auto;flex-shrink:0;}\n';
    document.head.appendChild(style);
  }

  function _loadMembers() {
    _members = [];
    if (typeof App === 'undefined' || !App.currentChat) return;
    var chat = App.currentChat;
    if (chat.type !== 'group') return;
    var myUid = App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null);
    if (chat.members && Array.isArray(chat.members)) {
      chat.members.forEach(function (m) {
        if (m.uid === myUid) return;
        _members.push({
          uid: m.uid || m.id,
          name: m.displayName || m.name || m.email || 'Unknown',
          avatar: m.photoURL || m.avatar || '',
          handle: m.handle || ''
        });
      });
    }
    if (_members.length === 0 && typeof allUsers !== 'undefined' && Array.isArray(allUsers)) {
      allUsers.forEach(function (u) {
        if (u.uid === myUid) return;
        _members.push({
          uid: u.uid,
          name: u.displayName || u.email || 'Unknown',
          avatar: u.photoURL || '',
          handle: u.handle || ''
        });
      });
    }
    if (_members.length === 0) {
      var groupDoc = chat._groupData || chat;
      if (groupDoc && groupDoc.memberDetails) {
        var details = groupDoc.memberDetails;
        Object.keys(details).forEach(function (uid) {
          if (uid === myUid) return;
          var d = details[uid];
          _members.push({
            uid: uid,
            name: (d && (d.displayName || d.name)) || 'Unknown',
            avatar: (d && d.photoURL) || '',
            handle: (d && d.handle) || ''
          });
        });
      }
    }
  }

  function _filterMembers(q) {
    var lower = q.toLowerCase();
    _filtered = _members.filter(function (m) {
      return m.name.toLowerCase().indexOf(lower) !== -1 ||
        (m.handle && m.handle.toLowerCase().indexOf(lower) !== -1) ||
        m.uid.toLowerCase().indexOf(lower) !== -1;
    }).slice(0, 10);
    _selectedIndex = 0;
  }

  function _renderPopup() {
    var list = _popup && _popup.querySelector('.mention-popup-list');
    if (!list) return;
    if (_filtered.length === 0) {
      _popup.classList.add('hidden');
      return;
    }
    list.innerHTML = '';
    _filtered.forEach(function (m, i) {
      var div = document.createElement('div');
      div.className = 'mention-popup-item' + (i === _selectedIndex ? ' selected' : '');
      var avatarHtml = m.avatar
        ? '<img class="mention-popup-avatar" src="' + m.avatar.replace(/"/g, '&quot;') + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
        : '';
      var fallbackHtml = '<div class="mention-popup-avatar" style="display:flex;align-items:center;justify-content:center;">' + (m.name ? m.name[0].toUpperCase() : '?') + '</div>';
      div.innerHTML = (m.avatar ? '<div style="position:relative">' + avatarHtml + fallbackHtml + '</div>' : fallbackHtml) +
        '<span class="mention-popup-name">' + (m.name ? m.name.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Unknown') + '</span>' +
        (m.handle ? '<span class="mention-popup-handle">@' + m.handle.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' : '');
      div.addEventListener('click', function () {
        _selectMember(i);
      });
      div.addEventListener('mouseenter', function () {
        _selectedIndex = i;
        _updateSelection();
      });
      list.appendChild(div);
    });
    _positionPopup();
    _popup.classList.remove('hidden');
  }

  function _positionPopup() {
    if (!_popup || !_inputEl) return;
    var rect = _inputEl.getBoundingClientRect();
    var left = rect.left;
    var bottom = window.innerHeight - rect.top + 4;
    var maxLeft = window.innerWidth - 290;
    if (left > maxLeft) left = maxLeft;
    if (left < 8) left = 8;
    _popup.style.left = left + 'px';
    _popup.style.bottom = bottom + 'px';
    _popup.style.top = 'auto';
  }

  function _updateSelection() {
    if (!_popup) return;
    var items = _popup.querySelectorAll('.mention-popup-item');
    items.forEach(function (item, i) {
      item.classList.toggle('selected', i === _selectedIndex);
    });
  }

  function _selectMember(index) {
    if (index < 0 || index >= _filtered.length) return;
    var member = _filtered[index];
    var input = _inputEl || document.getElementById('msg-input');
    if (!input) return;
    var val = input.value;
    var before = val.substring(0, _atStart);
    var after = val.substring(input.selectionStart);
    var displayName = member.name || member.uid;
    var mentionText = '@' + displayName + ' ';
    if (before.indexOf(mentionText) !== -1 || val.indexOf('@' + displayName) !== -1) {
      _close();
      return;
    }
    input.value = before + mentionText + after;
    var newPos = before.length + mentionText.length;
    input.setSelectionRange(newPos, newPos);
    input.focus();
    _close();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function _close() {
    _active = false;
    _query = '';
    _atStart = -1;
    if (_popup) _popup.classList.add('hidden');
  }

  function _onInput() {
    var input = _inputEl || document.getElementById('msg-input');
    if (!input) return;
    var val = input.value;
    var pos = input.selectionStart;
    if (!_active) {
      var ch = val.substring(pos - 1, pos);
      if (ch === '@') {
        var isGroup = typeof App !== 'undefined' && App.currentChat && App.currentChat.type === 'group';
        if (!isGroup) return;
        _loadMembers();
        if (_members.length === 0) return;
        _active = true;
        _atStart = pos - 1;
        _query = '';
        _filterMembers('');
        _getPopup();
        _renderPopup();
      }
      return;
    }
    var textBefore = val.substring(_atStart, pos);
    if (textBefore.charAt(0) !== '@' || textBefore.indexOf(' ') !== -1 || textBefore.indexOf('\n') !== -1) {
      _close();
      return;
    }
    _query = textBefore.substring(1);
    _filterMembers(_query);
    _renderPopup();
  }

  function _onKeyDown(e) {
    if (!_active) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _selectedIndex = Math.min(_selectedIndex + 1, _filtered.length - 1);
      _updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _selectedIndex = Math.max(_selectedIndex - 1, 0);
      _updateSelection();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (_filtered.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        _selectMember(_selectedIndex);
      }
    } else if (e.key === 'Escape') {
      _close();
    }
  }

  function _onFocus() {
    _inputEl = document.getElementById('msg-input');
  }

  function init() {
    _injectStyles();
    _inputEl = document.getElementById('msg-input');
    if (!_inputEl) {
      document.addEventListener('DOMContentLoaded', function () {
        _inputEl = document.getElementById('msg-input');
        if (_inputEl) _attachListeners();
      });
    } else {
      _attachListeners();
    }
  }

  function _attachListeners() {
    const _debounced = typeof window.App?.debounce === 'function' ? window.App.debounce(_onInput, 200) : (e) => { clearTimeout(_inputEl._mentionTimer); _inputEl._mentionTimer = setTimeout(_onInput, 200, e); };
    _inputEl.addEventListener('input', _debounced, { passive: true });
    _inputEl.addEventListener('keydown', _onKeyDown);
    _inputEl.addEventListener('focus', _onFocus, { passive: true });
    document.addEventListener('click', function (e) {
      if (_popup && !_popup.contains(e.target) && e.target !== _inputEl) {
        _close();
      }
    }, { passive: true });
  }

  window.MentionAutocomplete = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
