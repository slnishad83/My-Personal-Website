/**
 * Chat Roles & Permissions — Granular permission system for group chats.
 * Roles stored on chat doc: { roles: { uid: 'admin' | 'moderator' | 'member' } }
 * Permissions: send, pin, manage-members, manage-settings
 * Admin can promote/demote; moderators can pin and manage members.
 */
(function () {
  'use strict';

  const ROLE_PERMISSIONS = {
    admin: ['send', 'pin', 'manage-members', 'manage-settings', 'delete-any', 'create-channel'],
    moderator: ['send', 'pin', 'manage-members'],
    member: ['send']
  };

  function getRole(chatId, uid) {
    if (!window.App || !window.App.db) return 'member';
    const chat = (window.App.currentChat && window.App.currentChat.id === chatId)
      ? window.App.currentChat
      : (window.App.chats || []).find(c => c.id === chatId)
        || (window.App.groups || []).find(g => g.id === chatId);
    if (!chat) return 'member';
    const roles = chat.roles || {};
    return roles[uid] || 'member';
  }

  function hasPermission(chatId, uid, perm) {
    const role = getRole(chatId, uid);
    return ROLE_PERMISSIONS[role]?.includes(perm) || false;
  }

  window.ChatPermissions = {
    getRole,
    hasPermission,
    ROLE_PERMISSIONS,

    openRoleManager: function () {
      if (!window.App || !window.App.currentChat) return;
      const chat = window.App.currentChat;
      if (chat.type !== 'group') return;

      const uid = window.App.auth?.currentUser?.uid;
      if (!hasPermission(chat.id, uid, 'manage-settings')) {
        if (window.showToast) window.showToast('Only admins can manage roles', 'error');
        return;
      }

      const members = chat.memberIds || chat.members || [];
      const contacts = window.App.contacts || [];
      const roles = chat.roles || {};

      const membersHtml = members.map(mid => {
        const contact = contacts.find(c => c.uid === mid);
        const name = contact ? (contact.name || contact.displayName || 'Unknown') : 'Unknown';
        const role = roles[mid] || 'member';
        const isMe = mid === uid;
        const _roleColor = role === 'admin' ? 'text-red-400' : role === 'moderator' ? 'text-amber-400' : 'text-on-surface-variant';

        return `
          <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/30 transition-colors">
            <div class="w-9 h-9 rounded-full bg-surface-variant flex items-center justify-center text-sm font-bold text-on-surface">${name.charAt(0).toUpperCase()}</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-on-surface truncate">${window.escHtml ? window.escHtml(name) : name} ${isMe ? '<span class="text-xs text-on-surface-variant">(You)</span>' : ''}</p>
            </div>
            <select class="role-select bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:border-primary" data-uid="${mid}" ${isMe && role !== 'admin' ? 'disabled' : ''} onchange="window.ChatPermissions._updateRole('${mid}', this.value)">
              <option value="admin" ${role === 'admin' ? 'selected' : ''} class="text-red-400">Admin</option>
              <option value="moderator" ${role === 'moderator' ? 'selected' : ''} class="text-amber-400">Moderator</option>
              <option value="member" ${role === 'member' ? 'selected' : ''} class="text-on-surface-variant">Member</option>
            </select>
          </div>
        `;
      }).join('');

      const _permsHtml = ROLE_PERMISSIONS.admin.map(p => `<span class="inline-block bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold">${p}</span>`).join(' ');

      const modalHtml = `
        <div id="role-manager-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;">
          <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 m-4 relative animate-scale-up max-h-[85vh] overflow-y-auto">
            <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('role-manager-modal').remove()">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
            <div class="flex flex-col items-center mb-5">
              <div class="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
                <span class="material-symbols-outlined text-[24px]">shield_person</span>
              </div>
              <h3 class="font-bold text-lg text-on-surface">Manage Roles</h3>
              <p class="text-xs text-on-surface-variant text-center mt-1">Assign roles to control permissions</p>
            </div>
            <div class="bg-surface-variant/30 rounded-xl p-3 mb-4">
              <p class="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-1">Permissions</p>
              <div class="flex flex-wrap gap-1">
                <span class="text-[10px] text-red-400 font-bold">Admin:</span>${ROLE_PERMISSIONS.admin.map(p => `<span class="inline-block bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded text-[10px]">${p}</span>`).join('')}
              </div>
              <div class="flex flex-wrap gap-1 mt-1">
                <span class="text-[10px] text-amber-400 font-bold">Mod:</span>${ROLE_PERMISSIONS.moderator.map(p => `<span class="inline-block bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded text-[10px]">${p}</span>`).join('')}
              </div>
              <div class="flex flex-wrap gap-1 mt-1">
                <span class="text-[10px] text-on-surface-variant font-bold">Member:</span>${ROLE_PERMISSIONS.member.map(p => `<span class="inline-block bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded text-[10px]">${p}</span>`).join('')}
              </div>
            </div>
            <div class="space-y-1">${membersHtml}</div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    _updateRole: async function (targetUid, newRole) {
      if (!window.App || !window.App.db || !window.App.currentChat) return;
      const chatId = window.App.currentChat.id;
      const uid = window.App.auth?.currentUser?.uid;

      if (!hasPermission(chatId, uid, 'manage-settings')) {
        if (window.showToast) window.showToast('Permission denied', 'error');
        return;
      }

      try {
        const fn = firebase.functions().httpsCallable('updateChatRole');
        await fn({ chatId, targetUid, newRole });

        if (window.App.currentChat.roles) {
          window.App.currentChat.roles[targetUid] = newRole;
        }

        if (window.showToast) window.showToast(`Role updated to ${newRole}`, 'success');
      } catch (e) {
        if (window.__DEBUG__) console.error('Role update error:', e);
        if (window.showToast) window.showToast(e.message || 'Failed to update role', 'error');
      }
    }
  };
})();
