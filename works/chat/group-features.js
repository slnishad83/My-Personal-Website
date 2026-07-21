(function () {
  'use strict';

  function _db() { return (window.App && window.App.db) ? window.App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); }
  function _uid() { return (window.currentUser ? window.currentUser.uid : null); }
  function _toast(msg, t) { if (typeof window.showToast === 'function') window.showToast(msg, t || 'info'); }
  function _esc(s) { return (window.escHtml ? window.escHtml(s) : String(s)); }

  function _getGroupRef(groupId) {
    var f = _db();
    return f ? f.collection('groups').doc(groupId) : null;
  }

  function _getGroupMembersRef(groupId) {
    var f = _db();
    return f ? f.collection('groups').doc(groupId).collection('members') : null;
  }

  async function _isGroupAdmin(groupId, userId) {
    var ref = _getGroupRef(groupId);
    if (!ref) return false;
    var snap = await ref.get();
    if (!snap.exists) return false;
    var data = snap.data();
    return data.admins && data.admins.includes(userId);
  }

  async function _isGroupCreator(groupId, userId) {
    var ref = _getGroupRef(groupId);
    if (!ref) return false;
    var snap = await ref.get();
    if (!snap.exists) return false;
    return snap.data().createdBy === userId;
  }

  function _confirm(msg) {
    return new Promise(function (resolve) {
      if (typeof window.showConfirmDialog === 'function') {
        window.showConfirmDialog(msg, function () { resolve(true); }, function () { resolve(false); });
      } else {
        resolve(window.confirm(msg));
      }
    });
  }

  function _showDialog(title, bodyHtml, actions) {
    var existing = document.getElementById('gf-dialog');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'gf-dialog';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;';
    var backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);';
    backdrop.addEventListener('click', function () { overlay.remove(); });
    overlay.appendChild(backdrop);
    var dialog = document.createElement('div');
    dialog.style.cssText = 'position:relative;width:90%;max-width:420px;background:var(--surface,#fff);border-radius:16px;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,0.2);';
    var h = document.createElement('h3');
    h.style.cssText = 'margin:0 0 12px;font-size:18px;font-weight:700;color:var(--on-surface,#1a1a1a);';
    h.textContent = title;
    dialog.appendChild(h);
    var body = document.createElement('div');
    body.style.cssText = 'margin-bottom:20px;font-size:14px;color:var(--on-surface-variant,#666);line-height:1.5;';
    body.innerHTML = bodyHtml;
    dialog.appendChild(body);
    var actionsRow = document.createElement('div');
    actionsRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
    actions.forEach(function (a) {
      var btn = document.createElement('button');
      btn.textContent = a.label;
      var isDestructive = a.style === 'destructive';
      btn.style.cssText = 'padding:8px 18px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;background:' + (isDestructive ? 'var(--error,#d32f2f)' : 'var(--primary,#128C7E)') + ';color:#fff;';
      btn.addEventListener('click', function () { overlay.remove(); a.action(); });
      actionsRow.appendChild(btn);
    });
    dialog.appendChild(actionsRow);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  function _showDropdown(anchorEl, options) {
    var existing = document.getElementById('gf-dropdown');
    if (existing) existing.remove();
    var dd = document.createElement('div');
    dd.id = 'gf-dropdown';
    dd.style.cssText = 'position:absolute;z-index:10000;background:var(--surface,#fff);border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);overflow:hidden;min-width:180px;';
    options.forEach(function (o) {
      var item = document.createElement('button');
      item.style.cssText = 'width:100%;display:flex;align-items:center;gap:10px;padding:12px 16px;border:none;background:none;cursor:pointer;font-size:14px;color:var(--on-surface,#1a1a1a);text-align:left;';
      if (o.icon) {
        item.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;color:var(--on-surface-variant,#666)">' + _esc(o.icon) + '</span>' + _esc(o.label);
      } else {
        item.textContent = o.label;
      }
      item.addEventListener('mouseenter', function () { item.style.background = 'var(--surface-variant,rgba(0,0,0,0.04))'; });
      item.addEventListener('mouseleave', function () { item.style.background = 'none'; });
      item.addEventListener('click', function () { dd.remove(); o.action(); });
      dd.appendChild(item);
    });
    document.body.appendChild(dd);
    var rect = anchorEl.getBoundingClientRect();
    dd.style.top = (rect.bottom + 4) + 'px';
    dd.style.right = (window.innerWidth - rect.right) + 'px';
    var close = function (e) { if (!dd.contains(e.target)) { dd.remove(); document.removeEventListener('click', close); } };
    setTimeout(function () { document.addEventListener('click', close); }, 10);
  }

  async function getGroupInfo(groupId) {
    var ref = _getGroupRef(groupId);
    if (!ref) { _toast('Group not found', 'error'); return null; }
    var snap = await ref.get();
    if (!snap.exists) { _toast('Group not found', 'error'); return null; }
    var data = snap.data();
    data.id = snap.id;
    var membersRef = _getGroupMembersRef(groupId);
    if (membersRef) {
      var membersSnap = await membersRef.get();
      data.members = [];
      membersSnap.forEach(function (doc) {
        var m = doc.data();
        m.id = doc.id;
        data.members.push(m);
      });
    } else {
      data.members = [];
    }
    return data;
  }

  function openGroupParticipantPicker(groupId) {
    var existing = document.getElementById('gf-participant-picker');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'gf-participant-picker';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;';
    var backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);';
    backdrop.addEventListener('click', function () { overlay.remove(); });
    overlay.appendChild(backdrop);
    var panel = document.createElement('div');
    panel.style.cssText = 'position:relative;width:100%;max-width:480px;max-height:80vh;background:var(--surface,#fff);border-radius:16px 16px 0 0;display:flex;flex-direction:column;overflow:hidden;';

    var header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08));display:flex;align-items:center;justify-content:space-between;';
    var hTitle = document.createElement('h3');
    hTitle.style.cssText = 'margin:0;font-size:16px;font-weight:700;color:var(--on-surface,#1a1a1a);';
    hTitle.textContent = 'Add participants';
    header.appendChild(hTitle);
    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'border:none;background:none;cursor:pointer;color:var(--on-surface-variant,#666);padding:4px;';
    closeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:24px">close</span>';
    closeBtn.addEventListener('click', function () { overlay.remove(); });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    var searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'padding:12px 20px;';
    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search contacts...';
    searchInput.style.cssText = 'width:100%;padding:10px 14px;border:1px solid var(--outline-variant,rgba(0,0,0,0.12));border-radius:10px;font-size:14px;background:var(--surface-variant,rgba(0,0,0,0.03));color:var(--on-surface,#1a1a1a);outline:none;';
    searchWrap.appendChild(searchInput);
    panel.appendChild(searchWrap);

    var listWrap = document.createElement('div');
    listWrap.style.cssText = 'flex:1;overflow-y:auto;padding:0 12px;max-height:50vh;';
    panel.appendChild(listWrap);

    var selectedIds = new Set();
    var existingMemberIds = new Set();

    var addBar = document.createElement('div');
    addBar.style.cssText = 'padding:12px 20px;border-top:1px solid var(--outline-variant,rgba(0,0,0,0.08));display:none;';
    var addBtn = document.createElement('button');
    addBtn.style.cssText = 'width:100%;padding:12px;border:none;border-radius:10px;background:var(--primary,#128C7E);color:#fff;font-size:14px;font-weight:600;cursor:pointer;';
    addBtn.textContent = 'Add selected';
    addBtn.addEventListener('click', function () {
      if (selectedIds.size > 0) {
        addParticipantsToGroup(groupId, Array.from(selectedIds));
        overlay.remove();
      }
    });
    addBar.appendChild(addBtn);
    panel.appendChild(addBar);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    panel.style.transform = 'translateY(100%)';
    requestAnimationFrame(function () { panel.style.transition = 'transform .3s ease'; panel.style.transform = 'translateY(0)'; });

    async function _loadMembers() {
      var membersRef = _getGroupMembersRef(groupId);
      if (membersRef) {
        var snap = await membersRef.get();
        snap.forEach(function (doc) { existingMemberIds.add(doc.id); });
      }
    }

    async function _loadContacts(query) {
      listWrap.innerHTML = '';
      var users = window.allUsers || [];
      var filtered = users.filter(function (u) {
        if (existingMemberIds.has(u.uid)) return false;
        if (!query) return true;
        var name = (u.displayName || '').toLowerCase();
        var email = (u.email || '').toLowerCase();
        return name.includes(query) || email.includes(query);
      });
      if (filtered.length === 0) {
        listWrap.innerHTML = '<div style="padding:24px;text-align:center;color:var(--on-surface-variant,#999);font-size:14px;">No contacts found</div>';
        return;
      }
      filtered.forEach(function (u) {
        var item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background .15s;';
        var avatar = document.createElement('div');
        avatar.style.cssText = 'width:40px;height:40px;border-radius:50%;background:var(--primary,#128C7E);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0;overflow:hidden;';
        if (u.photoURL) {
          avatar.innerHTML = '<img src="' + _esc(u.photoURL) + '" style="width:100%;height:100%;object-fit:cover;" />';
        } else {
          avatar.textContent = (u.displayName || '?')[0].toUpperCase();
        }
        item.appendChild(avatar);
        var info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        var nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-weight:600;font-size:14px;color:var(--on-surface,#1a1a1a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        nameEl.textContent = u.displayName || 'Unknown';
        info.appendChild(nameEl);
        if (u.email) {
          var emailEl = document.createElement('div');
          emailEl.style.cssText = 'font-size:12px;color:var(--on-surface-variant,#999);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
          emailEl.textContent = u.email;
          info.appendChild(emailEl);
        }
        item.appendChild(info);
        var check = document.createElement('div');
        check.style.cssText = 'width:22px;height:22px;border-radius:50%;border:2px solid var(--outline-variant,rgba(0,0,0,0.2));flex-shrink:0;transition:all .15s;display:flex;align-items:center;justify-content:center;';
        item.appendChild(check);
        item.addEventListener('click', function () {
          if (selectedIds.has(u.uid)) {
            selectedIds.delete(u.uid);
            check.style.background = 'none';
            check.style.borderColor = 'var(--outline-variant,rgba(0,0,0,0.2))';
            check.innerHTML = '';
          } else {
            selectedIds.add(u.uid);
            check.style.background = 'var(--primary,#128C7E)';
            check.style.borderColor = 'var(--primary,#128C7E)';
            check.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;color:#fff">check</span>';
          }
          addBar.style.display = selectedIds.size > 0 ? 'block' : 'none';
          addBtn.textContent = 'Add ' + selectedIds.size + ' participant' + (selectedIds.size !== 1 ? 's' : '');
        });
        item.addEventListener('mouseenter', function () { item.style.background = 'var(--surface-variant,rgba(0,0,0,0.03))'; });
        item.addEventListener('mouseleave', function () { item.style.background = 'none'; });
        listWrap.appendChild(item);
      });
    }

    searchInput.addEventListener('input', function () {
      _loadContacts(searchInput.value.toLowerCase().trim());
    });

    await _loadMembers();
    _loadContacts('');
  }

  async function addParticipantsToGroup(groupId, userIds) {
    if (!userIds || !userIds.length) { _toast('No users selected', 'error'); return; }
    var uid = _uid();
    if (!uid) { _toast('Not authenticated', 'error'); return; }
    var isAdmin = await _isGroupAdmin(groupId, uid);
    if (!isAdmin) { _toast('Only admins can add participants', 'error'); return; }
    var membersRef = _getGroupMembersRef(groupId);
    var groupRef = _getGroupRef(groupId);
    if (!membersRef || !groupRef) { _toast('Group error', 'error'); return; }
    var batch = _db().batch();
    var users = window.allUsers || [];
    for (var i = 0; i < userIds.length; i++) {
      var u = users.find(function (us) { return us.uid === userIds[i]; });
      batch.set(membersRef.doc(userIds[i]), {
        uid: userIds[i],
        displayName: u ? (u.displayName || 'Unknown') : 'Unknown',
        photoURL: u ? (u.photoURL || '') : '',
        role: 'member',
        addedBy: uid,
        addedAt: Date.now(),
      });
    }
    batch.update(groupRef, { memberCount: firebase.firestore.FieldValue.increment(userIds.length), updatedAt: Date.now() });
    await batch.commit();
    _toast(userIds.length + ' participant' + (userIds.length > 1 ? 's' : '') + ' added', 'success');
  }

  async function removeParticipantFromGroup(groupId, userId) {
    var uid = _uid();
    if (!uid) { _toast('Not authenticated', 'error'); return; }
    var isAdmin = await _isGroupAdmin(groupId, uid);
    if (!isAdmin && uid !== userId) { _toast('Only admins can remove participants', 'error'); return; }
    var confirmed = await _confirm('Remove this participant from the group?');
    if (!confirmed) return;
    var groupRef = _getGroupRef(groupId);
    var membersRef = _getGroupMembersRef(groupId);
    if (!groupRef || !membersRef) { _toast('Group error', 'error'); return; }
    var batch = _db().batch();
    batch.delete(membersRef.doc(userId));
    batch.update(groupRef, { memberCount: firebase.firestore.FieldValue.increment(-1), updatedAt: Date.now() });
    await batch.commit();
    _toast('Participant removed', 'success');
  }

  async function promoteToAdmin(groupId, userId) {
    var uid = _uid();
    if (!uid) { _toast('Not authenticated', 'error'); return; }
    var isCreator = await _isGroupCreator(groupId, uid);
    if (!isCreator) { _toast('Only the group creator can promote admins', 'error'); return; }
    var groupRef = _getGroupRef(groupId);
    if (!groupRef) { _toast('Group error', 'error'); return; }
    await groupRef.update({ admins: firebase.firestore.FieldValue.arrayUnion(userId), updatedAt: Date.now() });
    var membersRef = _getGroupMembersRef(groupId);
    if (membersRef) {
      await membersRef.doc(userId).update({ role: 'admin' }).catch(function () {});
    }
    _toast('Promoted to admin', 'success');
  }

  async function demoteFromAdmin(groupId, userId) {
    var uid = _uid();
    if (!uid) { _toast('Not authenticated', 'error'); return; }
    var isCreator = await _isGroupCreator(groupId, uid);
    if (!isCreator) { _toast('Only the group creator can demote admins', 'error'); return; }
    var groupRef = _getGroupRef(groupId);
    if (!groupRef) { _toast('Group error', 'error'); return; }
    await groupRef.update({ admins: firebase.firestore.FieldValue.arrayRemove(userId), updatedAt: Date.now() });
    var membersRef = _getGroupMembersRef(groupId);
    if (membersRef) {
      await membersRef.doc(userId).update({ role: 'member' }).catch(function () {});
    }
    _toast('Removed admin status', 'success');
  }

  async function setGroupDescription(groupId, description) {
    if (typeof description !== 'string') { _toast('Invalid description', 'error'); return; }
    var trimmed = description.trim();
    if (trimmed.length > 250) { _toast('Description max 250 characters', 'error'); return; }
    var uid = _uid();
    if (!uid) { _toast('Not authenticated', 'error'); return; }
    var isAdmin = await _isGroupAdmin(groupId, uid);
    if (!isAdmin) { _toast('Only admins can change description', 'error'); return; }
    var groupRef = _getGroupRef(groupId);
    if (!groupRef) { _toast('Group error', 'error'); return; }
    await groupRef.update({ description: trimmed, updatedAt: Date.now() });
    _toast('Description updated', 'success');
  }

  async function setGroupPhoto(groupId, file) {
    if (!file) { _toast('No file selected', 'error'); return; }
    var uid = _uid();
    if (!uid) { _toast('Not authenticated', 'error'); return; }
    var isAdmin = await _isGroupAdmin(groupId, uid);
    if (!isAdmin) { _toast('Only admins can change group photo', 'error'); return; }
    _toast('Uploading photo...', 'info');
    var url;
    if (typeof window.uploadToCloudinary === 'function') {
      url = await window.uploadToCloudinary(file);
    } else {
      var _storage = window.storage || (typeof firebase !== 'undefined' ? firebase.storage() : null);
      if (!_storage) { _toast('Storage unavailable', 'error'); return; }
      var path = 'group_photos/' + groupId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var ref = _storage.ref(path);
      await ref.put(file);
      url = await ref.getDownloadURL();
    }
    var groupRef = _getGroupRef(groupId);
    if (!groupRef) { _toast('Group error', 'error'); return; }
    await groupRef.update({ photoURL: url, updatedAt: Date.now() });
    _toast('Group photo updated', 'success');
  }

  function muteGroupNotifications(groupId, duration) {
    var options = [
      { label: '8 hours', value: 8 * 60 * 60 * 1000, icon: 'schedule' },
      { label: '1 week', value: 7 * 24 * 60 * 60 * 1000, icon: 'date_range' },
      { label: 'Always', value: -1, icon: 'notifications_off' },
    ];
    _showDialog('Mute notifications', '<div style="font-size:14px;color:var(--on-surface-variant,#666);">Choose mute duration:</div>', options.map(function (o) {
      return {
        label: o.icon ? '<span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle;margin-right:8px;">' + o.icon + '</span>' + _esc(o.label) : o.label,
        action: async function () {
          var uid = _uid();
          if (!uid) { _toast('Not authenticated', 'error'); return; }
          var f = _db();
          if (!f) { _toast('Firestore unavailable', 'error'); return; }
          var until = o.value === -1 ? -1 : Date.now() + o.value;
          await f.collection('users').doc(uid).collection('mutedChats').doc(groupId).set({ mutedUntil: until, groupId: groupId, mutedAt: Date.now() });
          if (window._mutedChats && typeof window._mutedChats.set === 'function') {
            window._mutedChats.set(groupId, { mutedUntil: until });
          }
          _toast('Muted for ' + o.label, 'success');
        }
      };
    }));
  }

  async function exitGroup(groupId) {
    var uid = _uid();
    if (!uid) { _toast('Not authenticated', 'error'); return; }
    var isCreator = await _isGroupCreator(groupId, uid);
    if (isCreator) { _toast('Group creator cannot exit. Transfer ownership or delete.', 'error'); return; }
    var confirmed = await _confirm('Exit this group? You won\'t receive messages anymore.');
    if (!confirmed) return;
    var groupRef = _getGroupRef(groupId);
    var membersRef = _getGroupMembersRef(groupId);
    if (!groupRef || !membersRef) { _toast('Group error', 'error'); return; }
    var batch = _db().batch();
    batch.delete(membersRef.doc(uid));
    batch.update(groupRef, { memberCount: firebase.firestore.FieldValue.increment(-1), updatedAt: Date.now() });
    await batch.commit();
    _toast('You left the group', 'success');
    if (typeof window.backToList === 'function') window.backToList();
  }

  async function deleteGroupForEveryone(groupId) {
    var uid = _uid();
    if (!uid) { _toast('Not authenticated', 'error'); return; }
    var isCreator = await _isGroupCreator(groupId, uid);
    if (!isCreator) { _toast('Only the group creator can delete', 'error'); return; }
    var confirmed1 = await _confirm('Delete this group for everyone? This cannot be undone.');
    if (!confirmed1) return;
    var confirmed2 = await _confirm('Are you absolutely sure? All messages will be lost.');
    if (!confirmed2) return;
    var f = _db();
    if (!f) { _toast('Firestore unavailable', 'error'); return; }
    var membersRef = _getGroupMembersRef(groupId);
    if (membersRef) {
      var membersSnap = await membersRef.get();
      var batch = f.batch();
      membersSnap.forEach(function (doc) { batch.delete(doc.ref); });
      await batch.commit();
    }
    await f.collection('groups').doc(groupId).delete();
    _toast('Group deleted for everyone', 'success');
    if (typeof window.backToList === 'function') window.backToList();
  }

  async function changeGroupSubject(groupId, name) {
    if (!name || !name.trim()) { _toast('Name cannot be empty', 'error'); return; }
    var uid = _uid();
    if (!uid) { _toast('Not authenticated', 'error'); return; }
    var isAdmin = await _isGroupAdmin(groupId, uid);
    if (!isAdmin) { _toast('Only admins can rename the group', 'error'); return; }
    var groupRef = _getGroupRef(groupId);
    if (!groupRef) { _toast('Group error', 'error'); return; }
    await groupRef.update({ name: name.trim(), updatedAt: Date.now() });
    _toast('Group renamed', 'success');
  }

  async function searchInGroup(groupId, query) {
    if (!query || !query.trim()) { _toast('Enter a search term', 'error'); return; }
    var f = _db();
    if (!f) { _toast('Firestore unavailable', 'error'); return; }
    var q = query.trim().toLowerCase();
    var results = [];
    try {
      var msgsRef = f.collection('groups').doc(groupId).collection('messages');
      var snap = await msgsRef.orderBy('createdAt', 'desc').limit(500).get();
      snap.forEach(function (doc) {
        var data = doc.data();
        var text = (data.text || data.content || '').toLowerCase();
        if (text.includes(q)) {
          results.push({ id: doc.id, text: data.text || data.content || '', sender: data.senderName || data.senderId, createdAt: data.createdAt });
        }
      });
    } catch (e) {
      _toast('Search failed', 'error');
      return results;
    }
    _showSearchResults(results, q);
    return results;
  }

  function _showSearchResults(results, query) {
    var existing = document.getElementById('gf-search-results');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'gf-search-results';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;';
    var backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);';
    backdrop.addEventListener('click', function () { overlay.remove(); });
    overlay.appendChild(backdrop);
    var panel = document.createElement('div');
    panel.style.cssText = 'position:relative;width:100%;max-width:480px;max-height:70vh;background:var(--surface,#fff);border-radius:16px 16px 0 0;display:flex;flex-direction:column;overflow:hidden;';
    var header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08));display:flex;align-items:center;justify-content:space-between;';
    var h3 = document.createElement('h3');
    h3.style.cssText = 'margin:0;font-size:16px;font-weight:700;color:var(--on-surface,#1a1a1a);';
    h3.textContent = results.length + ' result' + (results.length !== 1 ? 's' : '') + ' for "' + query + '"';
    header.appendChild(h3);
    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'border:none;background:none;cursor:pointer;color:var(--on-surface-variant,#666);';
    closeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:24px">close</span>';
    closeBtn.addEventListener('click', function () { overlay.remove(); });
    header.appendChild(closeBtn);
    panel.appendChild(header);
    var list = document.createElement('div');
    list.style.cssText = 'flex:1;overflow-y:auto;padding:8px 0;';
    if (results.length === 0) {
      list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--on-surface-variant,#999);font-size:14px;">No results found</div>';
    } else {
      results.forEach(function (r) {
        var item = document.createElement('div');
        item.style.cssText = 'padding:12px 20px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.04));cursor:pointer;';
        var sender = document.createElement('div');
        sender.style.cssText = 'font-weight:600;font-size:13px;color:var(--primary,#128C7E);margin-bottom:4px;';
        sender.textContent = r.sender;
        item.appendChild(sender);
        var text = document.createElement('div');
        text.style.cssText = 'font-size:14px;color:var(--on-surface,#1a1a1a);line-height:1.4;';
        text.textContent = r.text.substring(0, 200);
        item.appendChild(text);
        item.addEventListener('mouseenter', function () { item.style.background = 'var(--surface-variant,rgba(0,0,0,0.03))'; });
        item.addEventListener('mouseleave', function () { item.style.background = 'none'; });
        list.appendChild(item);
      });
    }
    panel.appendChild(list);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    panel.style.transform = 'translateY(100%)';
    requestAnimationFrame(function () { panel.style.transition = 'transform .3s ease'; panel.style.transform = 'translateY(0)'; });
  }

  async function openGroupInviteLink(groupId) {
    var uid = _uid();
    if (!uid) { _toast('Not authenticated', 'error'); return; }
    var isAdmin = await _isGroupAdmin(groupId, uid);
    if (!isAdmin) { _toast('Only admins can manage invite links', 'error'); return; }
    var groupRef = _getGroupRef(groupId);
    if (!groupRef) { _toast('Group error', 'error'); return; }
    var snap = await groupRef.get();
    var data = snap.data();
    var inviteCode = data.inviteCode;
    if (!inviteCode) {
      inviteCode = _generateCode(12);
      await groupRef.update({ inviteCode: inviteCode, updatedAt: Date.now() });
    }
    var baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    var inviteUrl = baseUrl + 'invite.html?group=' + inviteCode;
    var existing = document.getElementById('gf-invite-dialog');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'gf-invite-dialog';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;';
    var backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);';
    backdrop.addEventListener('click', function () { overlay.remove(); });
    overlay.appendChild(backdrop);
    var dialog = document.createElement('div');
    dialog.style.cssText = 'position:relative;width:90%;max-width:400px;background:var(--surface,#fff);border-radius:16px;padding:24px;';
    var h = document.createElement('h3');
    h.style.cssText = 'margin:0 0 12px;font-size:18px;font-weight:700;color:var(--on-surface,#1a1a1a);';
    h.textContent = 'Invite Link';
    dialog.appendChild(h);
    var urlBox = document.createElement('div');
    urlBox.style.cssText = 'padding:10px 14px;background:var(--surface-variant,rgba(0,0,0,0.04));border-radius:8px;font-size:13px;color:var(--on-surface-variant,#666);word-break:break-all;margin-bottom:16px;';
    urlBox.textContent = inviteUrl;
    dialog.appendChild(urlBox);
    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px;';
    var copyBtn = document.createElement('button');
    copyBtn.style.cssText = 'flex:1;padding:10px;border:none;border-radius:8px;background:var(--primary,#128C7E);color:#fff;font-size:14px;font-weight:600;cursor:pointer;';
    copyBtn.textContent = 'Copy link';
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(inviteUrl).then(function () { _toast('Link copied!', 'success'); }).catch(function () {
        var ta = document.createElement('textarea');
        ta.value = inviteUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        _toast('Link copied!', 'success');
      });
    });
    btns.appendChild(copyBtn);
    var shareBtn = document.createElement('button');
    shareBtn.style.cssText = 'flex:1;padding:10px;border:none;border-radius:8px;background:var(--surface-variant,rgba(0,0,0,0.06));color:var(--on-surface,#1a1a1a);font-size:14px;font-weight:600;cursor:pointer;';
    shareBtn.textContent = 'Share';
    shareBtn.addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({ title: 'Join group', text: 'Join our group!', url: inviteUrl }).catch(function () {});
      } else {
        _toast('Share not supported', 'info');
      }
    });
    btns.appendChild(shareBtn);
    dialog.appendChild(btns);
    var closeRow = document.createElement('div');
    closeRow.style.cssText = 'text-align:center;margin-top:12px;';
    var closeLink = document.createElement('button');
    closeLink.style.cssText = 'border:none;background:none;color:var(--on-surface-variant,#666);font-size:13px;cursor:pointer;';
    closeLink.textContent = 'Close';
    closeLink.addEventListener('click', function () { overlay.remove(); });
    closeRow.appendChild(closeLink);
    dialog.appendChild(closeRow);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  async function revokeGroupInviteLink(groupId) {
    var uid = _uid();
    if (!uid) { _toast('Not authenticated', 'error'); return; }
    var isAdmin = await _isGroupAdmin(groupId, uid);
    if (!isAdmin) { _toast('Only admins can revoke invite links', 'error'); return; }
    var confirmed = await _confirm('Revoke the current invite link? Existing links will stop working.');
    if (!confirmed) return;
    var groupRef = _getGroupRef(groupId);
    if (!groupRef) { _toast('Group error', 'error'); return; }
    var newCode = _generateCode(12);
    await groupRef.update({ inviteCode: newCode, inviteRevokedAt: Date.now(), updatedAt: Date.now() });
    _toast('Invite link revoked. A new link has been generated.', 'success');
  }

  function _generateCode(len) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var code = '';
    for (var i = 0; i < len; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  window.openGroupParticipantPicker = openGroupParticipantPicker;
  window.addParticipantsToGroup = addParticipantsToGroup;
  window.removeParticipantFromGroup = removeParticipantFromGroup;
  window.promoteToAdmin = promoteToAdmin;
  window.demoteFromAdmin = demoteFromAdmin;
  window.setGroupDescription = setGroupDescription;
  window.setGroupPhoto = setGroupPhoto;
  window.muteGroupNotifications = muteGroupNotifications;
  window.exitGroup = exitGroup;
  window.deleteGroupForEveryone = deleteGroupForEveryone;
  window.changeGroupSubject = changeGroupSubject;
  window.searchInGroup = searchInGroup;
  window.getGroupInfo = getGroupInfo;
  window.openGroupInviteLink = openGroupInviteLink;
  window.revokeGroupInviteLink = revokeGroupInviteLink;
})();
