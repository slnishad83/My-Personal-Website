/* ============================================================
   COMMUNITIES � community hubs that bundle groups together.
   Firestore model (see firestore.rules):
   - communities/{id}: { name, createdBy, memberIds[], createdAt }
   - communityMembers/{id}: { communityId, userId, role }
   - communityGroups/{id}/groups/{gid}: { name, chatId }
   Creator manages members & groups; members open linked groups.
   ============================================================ */
(function () {
  'use strict';

  var _modal = null;
  var _currentCommunity = null;

  function _db() {
    return (window.App && window.App.db) || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  }
  function _uid() {
    return (window.currentUser && window.currentUser.uid) ||
      (window.App && window.App.auth && window.App.auth.currentUser && window.App.auth.currentUser.uid) ||
      null;
  }
  function _esc(s) {
    return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
  }
  function _toast(m, t) { if (typeof window.showToast === 'function') window.showToast(m, t); }

  function _styles() {
    if (document.getElementById('communities-style')) return;
    var css = [
      '.communities-sheet{position:fixed;left:0;right:0;bottom:0;z-index:70;background:var(--surface-container-low,#fff);' +
        'border-radius:20px 20px 0 0;max-height:86vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,0.22);animation:comSheetUp 0.25s ease;}',
      '@keyframes comSheetUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '.communities-sheet .com-head{position:sticky;top:0;background:inherit;padding:16px 18px 12px;display:flex;align-items:center;gap:10px;' +
        'border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08));}',
      '.communities-sheet .com-body{padding:14px 18px 24px;}',
      '.com-card{display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;background:var(--surface-container,#f0f2f5);' +
        'cursor:pointer;margin-bottom:10px;transition:transform 0.1s ease;}',
      '.com-card:active{transform:scale(0.98);}',
      '.com-avatar{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;' +
        'font-size:20px;font-weight:700;color:#fff;background:linear-gradient(135deg,#00a884,#0e7a5f);flex-shrink:0;}',
      '.com-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 14px;border-radius:22px;' +
        'border:none;cursor:pointer;font-size:13px;font-weight:600;transition:filter 0.12s ease;}',
      '.com-btn:active{filter:brightness(0.92);}',
      '.com-btn-primary{background:var(--primary,#00a884);color:#fff;}',
      '.com-btn-ghost{background:var(--surface-container,#f0f2f5);color:var(--on-surface,#1c1c1e);}',
      '.com-btn-danger{background:rgba(234,67,53,0.12);color:#ea4335;}',
      '.com-field{width:100%;padding:10px 12px;border:1px solid var(--outline-variant,rgba(0,0,0,0.12));border-radius:12px;' +
        'background:var(--surface-container-high,#fff);color:var(--on-surface,#1c1c1e);font-size:14px;margin:6px 0;}',
      '.com-group-row{display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:var(--surface-container,#f0f2f5);' +
        'margin-bottom:8px;cursor:pointer;}',
      '.com-empty{text-align:center;padding:28px 12px;color:var(--on-surface-variant,#8696a0);font-size:13px;}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'communities-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function _closeModal() {
    if (_modal) { _modal.remove(); _modal = null; }
    _currentCommunity = null;
  }

  function _overlay() {
    if (document.getElementById('communities-overlay')) return;
    var ov = document.createElement('div');
    ov.id = 'communities-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:69;background:rgba(0,0,0,0.4);animation:fadeIn 0.2s ease;';
    ov.addEventListener('click', _closeModal);
    document.body.appendChild(ov);
  }

  function open() {
    _styles();
    _overlay();
    _modal = document.createElement('div');
    _modal.className = 'communities-sheet';
    document.body.appendChild(_modal);
    _renderHome();
  }

  function _header(title) {
    return '<div class="com-head"><span class="material-symbols-outlined" style="font-size:22px;color:var(--primary,#00a884);cursor:pointer" onclick="window.Communities && Communities._goHome()">arrow_back</span>' +
      '<h2 style="flex:1;font-size:17px;font-weight:700;margin:0;color:var(--on-surface,#1c1c1e);">' + _esc(title) + '</h2>' +
      '<span class="material-symbols-outlined" style="font-size:22px;color:var(--on-surface-variant,#8696a0);cursor:pointer" onclick="window.Communities && Communities.close()">close</span></div>';
  }

  function _renderHome() {
    var db = _db();
    var uid = _uid();
    if (!db || !uid) { _closeModal(); return; }
    _modal.innerHTML = _header('Communities') +
      '<div class="com-body"><div style="display:flex;gap:8px;margin-bottom:14px;">' +
      '<button class="com-btn com-btn-primary" onclick="window.Communities && Communities.showCreate()"><span class="material-symbols-outlined" style="font-size:16px">add</span>New community</button>' +
      '<button class="com-btn com-btn-ghost" onclick="window.Communities && Communities.showJoin()"><span class="material-symbols-outlined" style="font-size:16px">person_add</span>Join</button>' +
      '</div><div id="com-list"><div class="com-empty">Loading communities�</div></div></div>';

    var list = _modal.querySelector('#com-list');
    var results = [];
    var done = 0;
    var finish = function () {
      done++;
      if (done < 2) return;
      results.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      if (!results.length) {
        list.innerHTML = '<div class="com-empty"><span class="material-symbols-outlined" style="font-size:40px;display:block;opacity:0.4">groups</span>' +
          'No communities yet.<br>Create one to bring your groups together.</div>';
        return;
      }
      list.innerHTML = results.map(function (c) {
        var isCreator = c.createdBy === uid;
        return '<div class="com-card" data-id="' + c.id + '">' +
          '<div class="com-avatar">' + _esc((c.name || 'C')[0].toUpperCase()) + '</div>' +
          '<div style="flex:1;min-width:0;">' +
          '<div style="font-weight:700;font-size:14px;color:var(--on-surface,#1c1c1e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(c.name || 'Untitled') + '</div>' +
          '<div style="font-size:12px;color:var(--on-surface-variant,#8696a0);">' + (c.memberIds ? c.memberIds.length : 1) + ' members' +
          (isCreator ? ' � You are the admin' : '') + '</div></div>' +
          '<span class="material-symbols-outlined" style="color:var(--on-surface-variant,#8696a0)">chevron_right</span></div>';
      }).join('');

      list.querySelectorAll('.com-card').forEach(function (el) {
        el.addEventListener('click', function () { Communities.openCommunity(el.dataset.id); });
      });
    };

    db.collection('communities').where('memberIds', 'array-contains', uid).get().then(function (snap) {
      snap.forEach(function (d) { results.push(Object.assign({ id: d.id }, d.data())); });
      finish();
    }).catch(function () { finish(); });

    db.collection('communities').where('createdBy', '==', uid).get().then(function (snap) {
      snap.forEach(function (d) {
        if (!results.some(function (r) { return r.id === d.id; })) results.push(Object.assign({ id: d.id }, d.data()));
      });
      finish();
    }).catch(function () { finish(); });
  }

  function showCreate() {
    if (!_modal) return;
    _modal.innerHTML = _header('New community') +
      '<div class="com-body"><label style="font-size:12px;font-weight:600;color:var(--on-surface-variant,#8696a0);">Community name</label>' +
      '<input id="com-name" class="com-field" placeholder="e.g. Design Team" maxlength="60" />' +
      '<div style="display:flex;gap:8px;margin-top:12px;">' +
      '<button class="com-btn com-btn-primary" style="flex:1" onclick="window.Communities && Communities.create()"><span class="material-symbols-outlined" style="font-size:16px">check</span>Create</button>' +
      '<button class="com-btn com-btn-ghost" style="flex:1" onclick="window.Communities && Communities._goHome()">Cancel</button></div></div>';
    var input = _modal.querySelector('#com-name');
    if (input) { input.focus(); input.addEventListener('keydown', function (e) { if (e.key === 'Enter') Communities.create(); }); }
  }

  async function create() {
    var db = _db();
    var uid = _uid();
    var input = _modal && _modal.querySelector('#com-name');
    var name = (input && input.value.trim()) || '';
    if (!db || !uid) return;
    if (!name) { _toast('Enter a community name', 'error'); return; }
    try {
      var docRef = db.collection('communities').doc();
      await docRef.set({
        name: name,
        createdBy: uid,
        memberIds: [uid],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('communityMembers').doc().set({
        communityId: docRef.id,
        userId: uid,
        role: 'owner',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      _toast('Community created', 'success');
      _renderHome();
    } catch (e) {
      if (window.__DEBUG__) console.warn('[Communities] create failed:', e);
      _toast('Could not create community', 'error');
    }
  }

  function showJoin() {
    if (!_modal) return;
    _modal.innerHTML = _header('Join community') +
      '<div class="com-body"><label style="font-size:12px;font-weight:600;color:var(--on-surface-variant,#8696a0);">Community ID</label>' +
      '<input id="com-join-id" class="com-field" placeholder="Paste the community ID" />' +
      '<button class="com-btn com-btn-primary" style="margin-top:12px" onclick="window.Communities && Communities.join()"><span class="material-symbols-outlined" style="font-size:16px">login</span>Join</button></div>';
  }

  async function join() {
    var db = _db();
    var uid = _uid();
    var input = _modal && _modal.querySelector('#com-join-id');
    var id = (input && input.value.trim()) || '';
    if (!db || !uid) return;
    if (!id) { _toast('Enter a community ID', 'error'); return; }
    try {
      var snap = await db.collection('communities').doc(id).get();
      if (!snap.exists) { _toast('Community not found', 'error'); return; }
      var c = snap.data();
      if (!c.memberIds || c.memberIds.indexOf(uid) === -1) {
        _toast('You are not a member yet. Ask the community admin to add you.', 'info');
        return;
      }
      var existing = await db.collection('communityMembers').where('communityId', '==', id).where('userId', '==', uid).get();
      if (existing.empty) {
        await db.collection('communityMembers').doc().set({
          communityId: id,
          userId: uid,
          role: 'member',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      _toast('Joined ' + (c.name || 'community'), 'success');
      openCommunity(id);
    } catch (e) {
      if (window.__DEBUG__) console.warn('[Communities] join failed:', e);
      _toast('Could not join community', 'error');
    }
  }

  async function openCommunity(communityId) {
    var db = _db();
    var uid = _uid();
    if (!db || !uid || !_modal) return;
    try {
      var snap = await db.collection('communities').doc(communityId).get();
      if (!snap.exists) { _toast('Community not found', 'error'); return; }
      _currentCommunity = Object.assign({ id: communityId }, snap.data());
      _renderCommunity();
    } catch (e) { _toast('Could not load community', 'error'); }
  }

  function _renderCommunity() {
    var c = _currentCommunity;
    var uid = _uid();
    if (!c || !_modal) return;
    var isCreator = c.createdBy === uid;
    _modal.innerHTML = _header(c.name || 'Community') +
      '<div class="com-body">' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;background:var(--surface-container,#f0f2f5);margin-bottom:14px;">' +
      '<div class="com-avatar">' + _esc((c.name || 'C')[0].toUpperCase()) + '</div>' +
      '<div><div style="font-weight:700;font-size:15px;color:var(--on-surface,#1c1c1e);">' + _esc(c.name || 'Untitled') + '</div>' +
      '<div style="font-size:12px;color:var(--on-surface-variant,#8696a0);">' + (c.memberIds ? c.memberIds.length : 1) + ' members' + (isCreator ? ' � Admin' : '') + '</div></div>' +
      (isCreator ? '<span class="material-symbols-outlined" style="margin-left:auto;color:var(--on-surface-variant,#8696a0);cursor:pointer" onclick="window.Communities && Communities.copyId()">content_copy</span>' : '') +
      '</div>' +
      (isCreator
        ? '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">' +
          '<button class="com-btn com-btn-ghost" onclick="window.Communities && Communities.showAddGroup()"><span class="material-symbols-outlined" style="font-size:16px">group_add</span>Link group</button>' +
          '<button class="com-btn com-btn-ghost" onclick="window.Communities && Communities.showAddMember()"><span class="material-symbols-outlined" style="font-size:16px">person_add</span>Add member</button>' +
          '</div>'
        : '') +
      '<h3 style="font-size:13px;font-weight:700;color:var(--on-surface-variant,#8696a0);margin:6px 0 10px;">GROUPS</h3>' +
      '<div id="com-groups"><div class="com-empty">Loading groups�</div></div></div>';

    var list = _modal.querySelector('#com-groups');
    _db().collection('communityGroups').doc(c.id).collection('groups').get().then(function (snap) {
      var groups = [];
      snap.forEach(function (d) { groups.push(Object.assign({ id: d.id }, d.data())); });
      if (!groups.length) {
        list.innerHTML = '<div class="com-empty">No groups linked yet.</div>';
        return;
      }
      list.innerHTML = groups.map(function (g) {
        return '<div class="com-group-row" data-gid="' + g.id + '">' +
          '<span class="material-symbols-outlined" style="color:var(--primary,#00a884);font-size:20px">group</span>' +
          '<div style="flex:1;min-width:0;font-size:14px;font-weight:600;color:var(--on-surface,#1c1c1e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(g.name || 'Group') + '</div>' +
          '<span class="material-symbols-outlined" style="color:var(--on-surface-variant,#8696a0);font-size:18px">chevron_right</span></div>';
      }).join('');
      list.querySelectorAll('.com-group-row').forEach(function (el) {
        el.addEventListener('click', function () {
          var g = groups.find(function (x) { return x.id === el.dataset.gid; });
          if (g && g.chatId && typeof window.openChat === 'function') {
            _closeModal();
            window.openChat(g.chatId, 'group');
          } else {
            _toast('No chat linked to this group', 'info');
          }
        });
      });
    }).catch(function () {
      list.innerHTML = '<div class="com-empty">Could not load groups.</div>';
    });
  }

  function copyId() {
    if (!_currentCommunity) return;
    try {
      navigator.clipboard.writeText(_currentCommunity.id).then(function () {
        _toast('Community ID copied', 'success');
      }, function () { _toast(_currentCommunity.id, 'info'); });
    } catch (e) { _toast(_currentCommunity.id, 'info'); }
  }

  function showAddMember() {
    if (!_modal || !_currentCommunity) return;
    _modal.innerHTML = _header('Add member') +
      '<div class="com-body"><label style="font-size:12px;font-weight:600;color:var(--on-surface-variant,#8696a0);">User ID</label>' +
      '<input id="com-member-id" class="com-field" placeholder="Paste the user ID" />' +
      '<button class="com-btn com-btn-primary" style="margin-top:12px" onclick="window.Communities && Communities.addMember()"><span class="material-symbols-outlined" style="font-size:16px">check</span>Add</button></div>';
  }

  async function addMember() {
    var db = _db();
    var uid = _uid();
    var c = _currentCommunity;
    var input = _modal && _modal.querySelector('#com-member-id');
    var memberId = (input && input.value.trim()) || '';
    if (!db || !uid || !c) return;
    if (!memberId) { _toast('Enter a user ID', 'error'); return; }
    if (memberId === uid) { _toast('You are already a member', 'info'); return; }
    if (c.memberIds && c.memberIds.indexOf(memberId) !== -1) { _toast('Already a member', 'info'); return; }
    try {
      var memberIds = (c.memberIds || []).concat([memberId]);
      await db.collection('communities').doc(c.id).update({ memberIds: memberIds });
      _currentCommunity.memberIds = memberIds;
      _toast('Member added', 'success');
      _renderCommunity();
    } catch (e) {
      if (window.__DEBUG__) console.warn('[Communities] addMember failed:', e);
      _toast('Could not add member', 'error');
    }
  }

  function showAddGroup() {
    if (!_modal || !_currentCommunity) return;
    _modal.innerHTML = _header('Link a group') +
      '<div class="com-body"><label style="font-size:12px;font-weight:600;color:var(--on-surface-variant,#8696a0);">Group name</label>' +
      '<input id="com-group-name" class="com-field" placeholder="e.g. Frontend chat" maxlength="60" />' +
      '<label style="font-size:12px;font-weight:600;color:var(--on-surface-variant,#8696a0);">Group chat ID</label>' +
      '<input id="com-group-chat" class="com-field" placeholder="Group document ID" />' +
      '<button class="com-btn com-btn-primary" style="margin-top:12px" onclick="window.Communities && Communities.addGroup()"><span class="material-symbols-outlined" style="font-size:16px">link</span>Link group</button></div>';
  }

  async function addGroup() {
    var db = _db();
    var c = _currentCommunity;
    var nameEl = _modal && _modal.querySelector('#com-group-name');
    var chatEl = _modal && _modal.querySelector('#com-group-chat');
    var name = (nameEl && nameEl.value.trim()) || '';
    var chatId = (chatEl && chatEl.value.trim()) || '';
    if (!db || !c) return;
    if (!name || !chatId) { _toast('Fill in both fields', 'error'); return; }
    try {
      await db.collection('communityGroups').doc(c.id).collection('groups').doc().set({
        name: name,
        chatId: chatId,
        createdBy: c.createdBy,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      _toast('Group linked', 'success');
      _renderCommunity();
    } catch (e) {
      if (window.__DEBUG__) console.warn('[Communities] addGroup failed:', e);
      _toast('Could not link group', 'error');
    }
  }

  window.Communities = {
    open: open,
    close: _closeModal,
    create: create,
    join: join,
    showCreate: showCreate,
    showJoin: showJoin,
    openCommunity: openCommunity,
    copyId: copyId,
    addMember: addMember,
    showAddMember: showAddMember,
    addGroup: addGroup,
    showAddGroup: showAddGroup,
    _goHome: _renderHome
  };
})();
