(function() {
  'use strict';

  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };

  function _esc(str) {
    if (typeof window.escHtml === 'function') return window.escHtml(str);
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function _docRef() {
    var uid = _uid();
    if (!uid) return null;
    return db.collection('users').doc(uid);
  }

  function _showToast(msg, type) { if (App && App.toast) App.toast(msg, type); else if (typeof showToast === 'function') showToast(msg, type); }

  async function _persist() {
    var ref = _docRef();
    if (!ref) return;
    try {
      await ref.set({ blockedUsers: window.blockedUsers || [] }, { merge: true });
    } catch (e) {
      if (window.__DEBUG__) console.error('[Block] persist failed', e);
    }
  }

  async function _loadBlocked() {
    var ref = _docRef();
    if (!ref) return;
    try {
      var snap = await ref.get();
      if (snap.exists) {
        var data = snap.data();
        if (Array.isArray(data.blockedUsers)) {
          window.blockedUsers = data.blockedUsers;
        }
      }
    } catch (e) {
      if (window.__DEBUG__) console.error('[Block] load failed', e);
    }
  }

  function _ensureBlockedUsersArray() {
    if (!Array.isArray(window.blockedUsers)) {
      window.blockedUsers = [];
    }
  }

  function _injectStyles() {
    if (document.getElementById('block-user-styles')) return;
    var style = document.createElement('style');
    style.id = 'block-user-styles';
    style.textContent = '\n' +
      '.block-dialog-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.2s ease;}\n' +
      '.block-dialog-overlay.open{opacity:1;pointer-events:auto;}\n' +
      '.block-dialog{background:var(--surface-container,#1f2c34);border-radius:16px;padding:24px;max-width:340px;width:90%;text-align:center;transform:scale(0.9);transition:transform 0.2s ease;box-shadow:0 8px 24px rgba(0,0,0,0.4);}\n' +
      '.block-dialog-overlay.open .block-dialog{transform:scale(1);}\n' +
      '.block-dialog-avatar{width:64px;height:64px;border-radius:50%;object-fit:cover;margin:0 auto 16px;display:block;background:var(--surface-container-highest,#2a3942);}\n' +
      '.block-dialog-name{font-size:18px;font-weight:600;color:var(--on-surface,#e9edef);margin-bottom:8px;}\n' +
      '.block-dialog-msg{font-size:14px;color:var(--on-surface-variant,#8696a0);margin-bottom:20px;line-height:1.4;}\n' +
      '.block-dialog-btns{display:flex;gap:12px;justify-content:center;}\n' +
      '.block-dialog-btn{min-width:100px;padding:10px 16px;border-radius:8px;border:none;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.15s;min-height:48px;}\n' +
      '.block-dialog-btn.cancel{background:var(--surface-container-high,#2a3942);color:var(--on-surface,#e9edef);}\n' +
      '.block-dialog-btn.cancel:hover{background:var(--surface-container-highest,#374045);}\n' +
      '.block-dialog-btn.confirm-block{background:#e74c3c;color:white;}\n' +
      '.block-dialog-btn.confirm-block:hover{background:#c0392b;}\n' +
      '.block-dialog-btn.confirm-unblock{background:var(--primary,#00a884);color:white;}\n' +
      '.block-dialog-btn.confirm-unblock:hover{background:#008f73;}\n' +
      '.blocked-users-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.2s;}\n' +
      '.blocked-users-overlay.open{opacity:1;pointer-events:auto;}\n' +
      '.blocked-users-panel{background:var(--surface-container,#1f2c34);border-radius:16px;width:90%;max-width:420px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;transform:scale(0.9);transition:transform 0.2s;}\n' +
      '.blocked-users-overlay.open .blocked-users-panel{transform:scale(1);}\n' +
      '.blocked-users-header{display:flex;align-items:center;padding:16px;border-bottom:1px solid var(--outline-variant,#313d45);}\n' +
      '.blocked-users-title{font-size:18px;font-weight:600;color:var(--on-surface,#e9edef);flex:1;}\n' +
      '.blocked-users-close{background:none;border:none;color:var(--on-surface-variant,#8696a0);font-size:22px;cursor:pointer;padding:4px 8px;border-radius:50%;min-width:48px;min-height:48px;display:flex;align-items:center;justify-content:center;}\n' +
      '.blocked-users-body{flex:1;overflow-y:auto;padding:8px 0;}\n' +
      '.blocked-user-item{display:flex;align-items:center;padding:10px 16px;gap:12px;min-height:56px;}\n' +
      '.blocked-user-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;background:var(--surface-container-highest,#2a3942);flex-shrink:0;}\n' +
      '.blocked-user-info{flex:1;min-width:0;}\n' +
      '.blocked-user-name{font-size:15px;font-weight:500;color:var(--on-surface,#e9edef);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n' +
      '.blocked-user-sub{font-size:12px;color:var(--on-surface-variant,#8696a0);}\n' +
      '.blocked-user-unblock{background:none;border:1px solid var(--outline-variant,#313d45);color:var(--on-surface-variant,#8696a0);padding:6px 14px;border-radius:8px;font-size:12px;cursor:pointer;font-weight:500;min-height:40px;white-space:nowrap;}\n' +
      '.blocked-user-unblock:hover{border-color:var(--primary,#00a884);color:var(--primary,#00a884);}\n' +
      '.blocked-users-empty{text-align:center;padding:40px 20px;color:var(--on-surface-variant,#8696a0);}\n' +
      '.blocked-indicator{display:flex;align-items:center;gap:6px;padding:4px 8px;background:rgba(231,76,60,0.15);border-radius:6px;font-size:12px;color:#e74c3c;margin-top:2px;}\n';
    document.head.appendChild(style);
  }

  function _findUserById(uid) {
    if (typeof allUsers !== 'undefined' && Array.isArray(allUsers)) {
      for (var i = 0; i < allUsers.length; i++) {
        if (allUsers[i].uid === uid) return allUsers[i];
      }
    }
    return null;
  }

  function _buildDialog(title, msg, confirmText, confirmClass, name, avatar, onConfirm) {
    var overlay = document.createElement('div');
    overlay.className = 'block-dialog-overlay';
    var avatarSrc = avatar || '';
    var avatarHtml = avatarSrc
      ? '<img class="block-dialog-avatar" src="' + _esc(avatarSrc) + '" alt="" onerror="this.style.display=\'none\'">'
      : '<div class="block-dialog-avatar" style="display:flex;align-items:center;justify-content:center;font-size:28px;">ðŸ‘¤</div>';
    overlay.innerHTML = '\n' +
      '<div class="block-dialog" role="alertdialog">\n' +
      avatarHtml +
      '<div class="block-dialog-name">' + _esc(name || 'Unknown') + '</div>\n' +
      '<div class="block-dialog-msg">' + msg + '</div>\n' +
      '<div class="block-dialog-btns">\n' +
      '  <button class="block-dialog-btn cancel">Cancel</button>\n' +
      '  <button class="block-dialog-btn ' + confirmClass + '">' + _esc(confirmText) + '</button>\n' +
      '</div>\n' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() {
      overlay.classList.add('open');
    });
    overlay.querySelector('.cancel').addEventListener('click', function() {
      overlay.classList.remove('open');
      setTimeout(function() { overlay.remove(); }, 200);
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        setTimeout(function() { overlay.remove(); }, 200);
      }
    });
    overlay.querySelector('.' + confirmClass).addEventListener('click', function() {
      overlay.classList.remove('open');
      setTimeout(function() { overlay.remove(); }, 200);
      onConfirm();
    });
  }

  window.blockUser = function(uid, name) {
    if (!uid) return;
    _ensureBlockedUsersArray();
    if (window.blockedUsers.indexOf(uid) !== -1) return;
    window.blockedUsers.push(uid);
    _persist();
    _showToast(_esc(name || 'User') + ' blocked');
    _updateChatHeaderIndicator();
    _filterBlockedFromChatList();
  };

  window.unblockUser = function(uid, name) {
    if (!uid) return;
    _ensureBlockedUsersArray();
    var idx = window.blockedUsers.indexOf(uid);
    if (idx === -1) return;
    window.blockedUsers.splice(idx, 1);
    _persist();
    _showToast(_esc(name || 'User') + ' unblocked');
    _updateChatHeaderIndicator();
    _filterBlockedFromChatList();
  };

  window.isUserBlocked = function(uid) {
    _ensureBlockedUsersArray();
    return window.blockedUsers.indexOf(uid) !== -1;
  };

  window.openBlockDialog = function(uid, name, avatar) {
    _buildDialog(
      'Block ' + (name || 'User'),
      'Blocked users will no longer be able to call you or send you messages. They won\'t be able to see your last seen or online status.',
      'Block',
      'confirm-block',
      name,
      avatar,
      function() { window.blockUser(uid, name); }
    );
  };

  window.openUnblockDialog = function(uid, name, avatar) {
    _buildDialog(
      'Unblock ' + (name || 'User'),
      'Once unblocked, ' + _esc(name || 'this user') + ' will be able to call you and send you messages again.',
      'Unblock',
      'confirm-unblock',
      name,
      avatar,
      function() { window.unblockUser(uid, name); }
    );
  };

  window.showBlockedUsersList = function() {
    _ensureBlockedUsersArray();
    var overlay = document.createElement('div');
    overlay.className = 'blocked-users-overlay';
    var panel = document.createElement('div');
    panel.className = 'blocked-users-panel';
    panel.innerHTML = '\n' +
      '<div class="blocked-users-header">\n' +
      '  <span class="blocked-users-title">Blocked Users</span>\n' +
      '  <button class="blocked-users-close" aria-label="Close">&times;</button>\n' +
      '</div>\n' +
      '<div class="blocked-users-body"></div>';
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    var body = panel.querySelector('.blocked-users-body');
    var blockedIds = window.blockedUsers || [];

    if (blockedIds.length === 0) {
      body.innerHTML = '<div class="blocked-users-empty">No blocked users</div>';
    } else {
      for (var i = 0; i < blockedIds.length; i++) {
        var user = _findUserById(blockedIds[i]);
        var uname = user ? (user.displayName || user.email || 'Unknown') : blockedIds[i];
        var uavatar = user ? (user.photoURL || '') : '';
        var item = document.createElement('div');
        item.className = 'blocked-user-item';
        var itemAvatar = uavatar
          ? '<img class="blocked-user-avatar" src="' + _esc(uavatar) + '" alt="" onerror="this.style.display=\'none\'">'
          : '<div class="blocked-user-avatar" style="display:flex;align-items:center;justify-content:center;font-size:18px;">ðŸ‘¤</div>';
        item.innerHTML = '\n' +
          itemAvatar +
          '<div class="blocked-user-info">\n' +
          '  <div class="blocked-user-name">' + _esc(uname) + '</div>\n' +
          '  <div class="blocked-user-sub">Blocked</div>\n' +
          '</div>\n' +
          '<button class="blocked-user-unblock">Unblock</button>';
        (function(blockedUid, blockedName) {
          item.querySelector('.blocked-user-unblock').addEventListener('click', function() {
            window.unblockUser(blockedUid, blockedName);
            overlay.classList.remove('open');
            setTimeout(function() { overlay.remove(); }, 200);
            setTimeout(function() { window.showBlockedUsersList(); }, 300);
          });
        })(blockedIds[i], uname);
        body.appendChild(item);
      }
    }

    requestAnimationFrame(function() {
      overlay.classList.add('open');
    });

    panel.querySelector('.blocked-users-close').addEventListener('click', function() {
      overlay.classList.remove('open');
      setTimeout(function() { overlay.remove(); }, 200);
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        setTimeout(function() { overlay.remove(); }, 200);
      }
    });
  };

  function _updateChatHeaderIndicator() {
    var headerName = document.getElementById('chat-header-name') || document.getElementById('chat-user-name');
    if (!headerName) return;
    var existing = headerName.parentElement.querySelector('.blocked-indicator');
    if (existing) existing.remove();
    if (typeof currentChat !== 'undefined' && currentChat && currentChat.id && window.isUserBlocked(currentChat.id)) {
      var indicator = document.createElement('div');
      indicator.className = 'blocked-indicator';
      indicator.textContent = 'ðŸš« Blocked';
      headerName.parentElement.appendChild(indicator);
    }
  }

  function _filterBlockedFromChatList() {
    _ensureBlockedUsersArray();
    var items = document.querySelectorAll('.chat-list-item[data-chat-id]');
    for (var i = 0; i < items.length; i++) {
      var cid = items[i].dataset.chatId;
      if (window.isUserBlocked(cid)) {
        items[i].style.display = 'none';
      }
    }
  }

  function _init() {
    _injectStyles();
    _loadBlocked().then(function() {
      _filterBlockedFromChatList();
      _updateChatHeaderIndicator();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
