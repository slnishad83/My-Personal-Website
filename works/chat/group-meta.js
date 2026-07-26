/**
 * Group Description & Icon
 * Full group metadata management: description, icon upload, admin controls.
 */
(function () {
  'use strict';

  const GroupMeta = {
    init() {},

    async updateDescription(groupId, description) {
      const user = App.auth?.currentUser;
      if (!user || !groupId) return;

      try {
        const groupDoc = await App.db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) return;
        const group = groupDoc.data();

        if (group.owner !== user.uid && !(group.admins || []).includes(user.uid)) {
          showToast('Only admins can change group description', 'error');
          return;
        }

        await App.db.collection('groups').doc(groupId).update({
          description: description || '',
          descriptionUpdatedAt: new Date(),
          descriptionUpdatedBy: user.uid,
        });

        showToast('Group description updated', 'success');
      } catch (e) {
        console.error('[GroupMeta] Update description error:', e);
        showToast('Failed to update description', 'error');
      }
    },

    async updateGroupIcon(groupId, file) {
      const user = App.auth?.currentUser;
      if (!user || !groupId || !file) return;

      try {
        const groupDoc = await App.db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) return;
        const group = groupDoc.data();

        if (group.owner !== user.uid && !(group.admins || []).includes(user.uid)) {
          showToast('Only admins can change group icon', 'error');
          return;
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          showToast('Icon must be under 5MB', 'error');
          return;
        }

        showToast('Uploading group icon...', 'info');

        const storageRef = firebase.storage().ref(`group_icons/${groupId}/${Date.now()}_${file.name}`);
        await storageRef.put(file);
        const iconUrl = await storageRef.getDownloadURL();

        await App.db.collection('groups').doc(groupId).update({
          icon: iconUrl,
          iconUpdatedAt: new Date(),
          iconUpdatedBy: user.uid,
        });

        showToast('Group icon updated', 'success');
        return iconUrl;
      } catch (e) {
        console.error('[GroupMeta] Update icon error:', e);
        showToast('Failed to upload icon', 'error');
        return null;
      }
    },

    async setOnlyAdminsCanEdit(groupId, value) {
      const user = App.auth?.currentUser;
      if (!user || !groupId) return;

      try {
        const groupDoc = await App.db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) return;
        const group = groupDoc.data();

        if (group.owner !== user.uid) {
          showToast('Only the group owner can change this setting', 'error');
          return;
        }

        await App.db.collection('groups').doc(groupId).update({
          onlyAdminsCanEdit: !!value,
          settingsUpdatedAt: new Date(),
        });

        showToast(value ? 'Only admins can edit group info' : 'All members can edit group info', 'success');
      } catch (e) {
        console.error('[GroupMeta] Set admin edit error:', e);
      }
    },

    async setOnlyAdminsCanSend(groupId, value) {
      const user = App.auth?.currentUser;
      if (!user || !groupId) return;

      try {
        const groupDoc = await App.db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) return;
        const group = groupDoc.data();

        if (group.owner !== user.uid && !(group.admins || []).includes(user.uid)) {
          showToast('Only admins can change this setting', 'error');
          return;
        }

        await App.db.collection('groups').doc(groupId).update({
          onlyAdminsCanSend: !!value,
          settingsUpdatedAt: new Date(),
        });

        showToast(value ? 'Only admins can send messages' : 'All members can send messages', 'success');
      } catch (e) {
        console.error('[GroupMeta] Set admin send error:', e);
      }
    },

    async removeMember(groupId, memberId) {
      const user = App.auth?.currentUser;
      if (!user || !groupId || !memberId) return;

      try {
        const groupDoc = await App.db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) return;
        const group = groupDoc.data();

        if (group.owner !== user.uid && !(group.admins || []).includes(user.uid)) {
          showToast('Only admins can remove members', 'error');
          return;
        }

        if (memberId === group.owner) {
          showToast("Can't remove the group owner", 'error');
          return;
        }

        await App.db.collection('groups').doc(groupId).update({
          members: firebase.firestore.FieldValue.arrayRemove(memberId),
          removedAt: firebase.firestore.FieldValue.arrayUnion({ uid: memberId, at: Date.now(), by: user.uid }),
        });

        showToast('Member removed', 'success');
      } catch (e) {
        console.error('[GroupMeta] Remove member error:', e);
        showToast('Failed to remove member', 'error');
      }
    },

    openGroupDescriptionEditor(groupId) {
      const group = (App.chats || []).find(c => c.id === groupId) || currentGroup;
      const currentDesc = group?.description || '';

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

      const panel = document.createElement('div');
      panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:400px;width:92vw;color:var(--on-surface)';

      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;font-size:16px;font-weight:700">Group Description</h3>
          <button onclick="this.closest('.fixed')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
        </div>
        <textarea id="group-desc-input" placeholder="Add a group description..." style="width:100%;min-height:100px;padding:12px;border-radius:10px;border:1px solid var(--outline-variant);background:var(--surface-container-low);color:var(--on-surface);font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box">${escHtml(currentDesc)}</textarea>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button id="group-desc-save" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:600;cursor:pointer">Save</button>
        </div>`;

      overlay.appendChild(panel);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);

      document.getElementById('group-desc-save')?.addEventListener('click', async () => {
        const desc = document.getElementById('group-desc-input')?.value?.trim() || '';
        await this.updateDescription(groupId, desc);
        overlay.remove();
      });
    },

    openGroupIconPicker(groupId) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const iconUrl = await this.updateGroupIcon(groupId, file);
          if (iconUrl && typeof renderChatList === 'function') renderChatList();
        }
      };
      input.click();
    }
  };

  window.GroupMeta = GroupMeta;

  document.addEventListener('nsl:app-ready', () => {
    GroupMeta.init();
  });
})();
