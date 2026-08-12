'use strict';
(function () {
  var _activeDialog = null;

  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  var _db = function() { return App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };

  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };

  function _removeDialog() {
    if (_activeDialog) {
      _activeDialog.remove();
      _activeDialog = null;
    }
  }

  function _ensureStyles() {
    if (document.getElementById('nsl-delete-group-style')) return;
    var s = document.createElement('style');
    s.id = 'nsl-delete-group-style';
    s.textContent =
      '.nsl-dg-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;animation:ctxFadeIn .15s ease}' +
      '@keyframes ctxFadeIn{from{opacity:0}to{opacity:1}}' +
      '.nsl-dg-dialog{background:var(--surface-container,#fff);border-radius:16px;width:min(380px,92vw);max-height:85vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.3);animation:ctxFadeIn .15s ease}' +
      '.nsl-dg-header{display:flex;align-items:center;gap:12px;padding:20px 20px 12px;border-bottom:1px solid var(--outline-variant,#eee)}' +
      '.nsl-dg-avatar{width:48px;height:48px;border-radius:50%;background:var(--primary,#6750A4);color:var(--on-primary,#fff);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;flex-shrink:0}' +
      '.nsl-dg-title{font-size:17px;font-weight:600;color:var(--on-surface,#000)}' +
      '.nsl-dg-subtitle{font-size:12px;color:var(--on-surface-variant,#666);margin-top:2px}' +
      '.nsl-dg-body{padding:12px 20px 8px}' +
      '.nsl-dg-option{display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:12px;cursor:pointer;transition:background .12s;border:1px solid transparent}' +
      '.nsl-dg-option:hover{background:var(--surface-variant,#f0f0f0)}' +
      '.nsl-dg-option.selected{background:var(--primary,#6750A4);color:var(--on-primary,#fff);border-color:var(--primary,#6750A4)}' +
      '.nsl-dg-option-icon{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}' +
      '.nsl-dg-option.selected .nsl-dg-option-icon{background:rgba(255,255,255,0.2)}' +
      '.nsl-dg-option-text{flex:1}' +
      '.nsl-dg-option-title{font-size:14px;font-weight:600}' +
      '.nsl-dg-option-desc{font-size:11px;opacity:0.75;margin-top:1px}' +
      '.nsl-dg-footer{display:flex;gap:8px;padding:8px 20px 16px;justify-content:flex-end}' +
      '.nsl-dg-btn{padding:8px 20px;border-radius:10px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .12s}' +
      '.nsl-dg-btn-cancel{background:var(--surface-variant,#e0e0e0);color:var(--on-surface,#000)}' +
      '.nsl-dg-btn-confirm{background:var(--error,#B3261E);color:#fff}' +
      '.nsl-dg-btn-confirm:disabled{opacity:0.5;cursor:not-allowed}' +
      '.nsl-dg-btn-confirm.danger{background:var(--error,#B3261E)}' +
      '.nsl-dg-confirm-overlay{position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center}' +
      '.nsl-dg-confirm-box{background:var(--surface-container,#fff);border-radius:16px;padding:24px;width:min(340px,90vw);text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.3)}' +
      '.nsl-dg-confirm-box h3{margin:0 0 8px;font-size:16px;color:var(--on-surface,#000)}' +
      '.nsl-dg-confirm-box p{margin:0 0 16px;font-size:13px;color:var(--on-surface-variant,#666)}' +
      '.nsl-dg-confirm-actions{display:flex;gap:8px;justify-content:center}';
    document.head.appendChild(s);
  }

  function _showConfirmation(title, message) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'nsl-dg-confirm-overlay';

      var box = document.createElement('div');
      box.className = 'nsl-dg-confirm-box';
      box.innerHTML =
        '<h3>' + _esc(title) + '</h3>' +
        '<p>' + _esc(message) + '</p>' +
        '<div class="nsl-dg-confirm-actions">' +
          '<button class="nsl-dg-btn nsl-dg-btn-cancel">Cancel</button>' +
          '<button class="nsl-dg-btn nsl-dg-btn-confirm danger">Confirm</button>' +
        '</div>';

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      box.querySelector('.nsl-dg-btn-cancel').onclick = function () { overlay.remove(); resolve(false); };
      box.querySelector('.nsl-dg-btn-confirm').onclick = function () { overlay.remove(); resolve(true); };
      overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    });
  }

  async function _leaveGroup(groupId) {
    var d = _db();
    var uid = _uid();
    if (!d || !uid) return false;

    try {
      if (typeof firebase !== 'undefined' && firebase.functions) {
        var fn = firebase.functions().httpsCallable('exitGroup');
        await fn({ groupId: groupId });
      } else if (typeof window.exitGroup === 'function') {
        await window.exitGroup(groupId);
      } else {
        await d.collection('groups').doc(groupId).update({
          memberIds: firebase.firestore.FieldValue.arrayRemove(uid),
          leftBy: firebase.firestore.FieldValue.arrayUnion(uid),
          lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      return true;
    } catch (err) {
      if (window.__DEBUG__) console.error('Leave group error:', err);
      if (typeof showToast === 'function') showToast('Failed to leave group', 'error');
      return false;
    }
  }

  async function _deleteGroupMessages(groupId) {
    var d = _db();
    if (!d) return;

    try {
      var chatId = window.currentChat && window.currentChat.id === groupId ? groupId : groupId;
      if (window.App && window.App.messages && window.App.messages[chatId]) {
        delete window.App.messages[chatId];
      }
      if (typeof window.renderMessages === 'function' && window.currentChat && window.currentChat.id === chatId) {
        window.renderMessages(chatId);
      }
    } catch (_) {}
  }

  async function _blockGroupMembers(groupId) {
    var d = _db();
    var uid = _uid();
    if (!d || !uid) return;

    try {
      var groupDoc = await d.collection('groups').doc(groupId).get();
      if (!groupDoc.exists) return;
      var groupData = groupDoc.data();
      var memberIds = groupData.memberIds || [];

      var blocked = [];
      try {
        var userDoc = await d.collection('users').doc(uid).get();
        if (userDoc.exists) blocked = userDoc.data().blockedUsers || [];
      } catch (_) {}

      var newBlocked = blocked.slice();
      memberIds.forEach(function (mid) {
        if (mid !== uid && newBlocked.indexOf(mid) === -1) newBlocked.push(mid);
      });

      if (newBlocked.length > blocked.length) {
        await d.collection('users').doc(uid).update({ blockedUsers: newBlocked });
        window.blockedUsers = newBlocked;
      }
    } catch (err) {
      if (window.__DEBUG__) console.error('Block members error:', err);
    }
  }

  function _removeFromChatList(groupId) {
    try {
      if (window.currentChat && window.currentChat.id === groupId) {
        window.currentChat = null;
        window.currentChatType = null;
        if (typeof window.renderChatList === 'function') window.renderChatList();
      }
    } catch (_) {}
  }

  function _isGroupAdmin(groupData) {
    var uid = _uid();
    if (!uid || !groupData) return false;
    if (groupData.createdBy === uid) return true;
    if (groupData.adminIds && groupData.adminIds.indexOf(uid) !== -1) return true;
    if (groupData.roles && groupData.roles[uid] === 'admin') return true;
    return false;
  }

  async function openDeleteGroupDialog(groupId, groupName) {
    _removeDialog();
    _ensureStyles();

    var d = _db();
    var groupData = null;

    try {
      if (d) {
        var snap = await d.collection('groups').doc(groupId).get();
        if (snap.exists) groupData = snap.data();
      }
    } catch (_) {}

    var isAdmin = _isGroupAdmin(groupData);
    var avatarText = groupName ? groupName.charAt(0).toUpperCase() : '?';
    var avatarUrl = groupData && groupData.avatar ? groupData.avatar : null;

    var overlay = document.createElement('div');
    overlay.className = 'nsl-dg-overlay';

    var dialog = document.createElement('div');
    dialog.className = 'nsl-dg-dialog';

    var avatarHtml = avatarUrl
      ? '<img src="' + _esc(avatarUrl) + '" style="width:48px;height:48px;border-radius:50%;object-fit:cover" alt="">'
      : _esc(avatarText);

    var options = [
      { id: 'exit', icon: '🚪', title: 'Exit Group', desc: 'Leave this group. You will no longer receive messages.', bg: 'var(--error-container,#FDECEA)' },
      { id: 'exit-delete', icon: '🗑️', title: 'Exit and Delete', desc: 'Leave and remove all group messages from your device.', bg: 'var(--error-container,#FDECEA)' },
      { id: 'block-delete', icon: '🚫', title: 'Block and Delete', desc: 'Block all members, leave, and delete all messages.', bg: 'var(--error-container,#FDECEA)' }
    ];

    if (isAdmin) {
      options.push({ id: 'admin-delete', icon: '⚠️', title: 'Delete Group for Everyone', desc: 'Permanently delete this group for all members.', bg: 'var(--error-container,#FDECEA)' });
    }

    var optionsHtml = options.map(function (opt) {
      return '<div class="nsl-dg-option" data-action="' + opt.id + '">' +
        '<div class="nsl-dg-option-icon" style="background:' + opt.bg + '">' + opt.icon + '</div>' +
        '<div class="nsl-dg-option-text">' +
          '<div class="nsl-dg-option-title">' + _esc(opt.title) + '</div>' +
          '<div class="nsl-dg-option-desc">' + _esc(opt.desc) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    dialog.innerHTML =
      '<div class="nsl-dg-header">' +
        '<div class="nsl-dg-avatar">' + avatarHtml + '</div>' +
        '<div>' +
          '<div class="nsl-dg-title">' + _esc(groupName || 'Group') + '</div>' +
          '<div class="nsl-dg-subtitle">' + (isAdmin ? 'Admin' : 'Member') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="nsl-dg-body">' + optionsHtml + '</div>' +
      '<div class="nsl-dg-footer">' +
        '<button class="nsl-dg-btn nsl-dg-btn-cancel">Cancel</button>' +
        '<button class="nsl-dg-btn nsl-dg-btn-confirm" disabled>Continue</button>' +
      '</div>';

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    _activeDialog = overlay;

    var selectedAction = null;
    var optionsEls = dialog.querySelectorAll('.nsl-dg-option');
    var confirmBtn = dialog.querySelector('.nsl-dg-btn-confirm');

    optionsEls.forEach(function (optEl) {
      optEl.addEventListener('click', function () {
        optionsEls.forEach(function (o) { o.classList.remove('selected'); });
        optEl.classList.add('selected');
        selectedAction = optEl.dataset.action;
        confirmBtn.disabled = false;
      });
    });

    dialog.querySelector('.nsl-dg-btn-cancel').addEventListener('click', function () {
      _removeDialog();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) _removeDialog();
    });

    confirmBtn.addEventListener('click', async function () {
      if (!selectedAction) return;

      var confirmMessages = {
        'exit': 'Are you sure you want to leave this group?',
        'exit-delete': 'Are you sure you want to leave and delete all messages?',
        'block-delete': 'Are you sure you want to block all members and leave?',
        'admin-delete': 'Are you sure you want to permanently delete this group for everyone? This cannot be undone.'
      };

      var confirmed = await _showConfirmation(
        'Confirm Action',
        confirmMessages[selectedAction] || 'Are you sure?'
      );

      if (!confirmed) return;

      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Processing...';

      try {
        switch (selectedAction) {
          case 'exit':
            var left = await _leaveGroup(groupId);
            if (left) {
              _removeFromChatList(groupId);
              if (typeof showToast === 'function') showToast('Left group', 'info');
            }
            break;

          case 'exit-delete':
            var left2 = await _leaveGroup(groupId);
            if (left2) {
              await _deleteGroupMessages(groupId);
              _removeFromChatList(groupId);
              if (typeof showToast === 'function') showToast('Left group and deleted messages', 'info');
            }
            break;

          case 'block-delete':
            await _blockGroupMembers(groupId);
            var left3 = await _leaveGroup(groupId);
            if (left3) {
              await _deleteGroupMessages(groupId);
              _removeFromChatList(groupId);
              if (typeof showToast === 'function') showToast('Blocked members, left group, deleted messages', 'info');
            }
            break;

          case 'admin-delete':
            if (d) {
              await d.collection('groups').doc(groupId).update({
                deleted: true,
                deletedBy: _uid(),
                deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
                memberIds: []
              });
              _removeFromChatList(groupId);
              if (typeof showToast === 'function') showToast('Group deleted for everyone', 'success');
            }
            break;
        }
      } catch (err) {
        if (window.__DEBUG__) console.error('Delete group action error:', err);
        if (typeof showToast === 'function') showToast('Action failed. Please try again.', 'error');
      }

      _removeDialog();
    });
  }

  window.openDeleteGroupDialog = openDeleteGroupDialog;
})();
