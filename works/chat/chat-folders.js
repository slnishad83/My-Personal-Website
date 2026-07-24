'use strict';
/**
 * CHAT FOLDERS — Organize chats into folders (Work, Family, Friends, etc.)
 * Stored in Firestore user doc.
 */
(function () {
  const ChatFolders = {
    _container: null,
    _activeFolder: null,

    _defaultFolders: [
      { id: 'all', name: 'All', icon: 'chat', pinned: true },
      { id: 'unread', name: 'Unread', icon: 'mark_chat_unread', pinned: true },
      { id: 'groups', name: 'Groups', icon: 'group', pinned: true }
    ],

    async getFolders() {
      const uid = window.App?.uid?.() || window.currentUser?.uid;
      const db = window.App?.db;
      if (uid && db) {
        try {
          const doc = await db.collection('users').doc(uid).get();
          if (doc.exists && doc.data().chatFolders) {
            return [...this._defaultFolders, ...doc.data().chatFolders];
          }
        } catch (_) {}
      }
      return [...this._defaultFolders];
    },

    async saveFolders(customFolders) {
      const uid = window.App?.uid?.() || window.currentUser?.uid;
      const db = window.App?.db;
      if (uid && db) {
        try {
          await db.collection('users').doc(uid).set({
            chatFolders: customFolders
          }, { merge: true });
        } catch (_) {}
      }
      try {
        localStorage.setItem('nsl_chat_folders', JSON.stringify(customFolders));
      } catch (_) {}
    },

    async init() {
      const folders = await this.getFolders();
      this._render(folders);
      this._activeFolder = 'all';
    },

    _render(folders) {
      let tabBar = document.getElementById('chat-folder-tabs');
      if (!tabBar) {
        tabBar = document.createElement('div');
        tabBar.id = 'chat-folder-tabs';
        tabBar.style.cssText = 'display:flex;gap:0;padding:0 8px;overflow-x:auto;scrollbar-width:none;background:var(--surface-container-low,#f8f9fa);border-bottom:1px solid var(--outline-variant,#e0e0e0);flex-shrink:0;';
        tabBar.style.cssText += '::-webkit-scrollbar{display:none;}';

        const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar, .chat-list-panel');
        if (sidebar) {
          const headerEl = sidebar.querySelector('.sidebar-header, .chat-list-header') || sidebar.firstElementChild;
          if (headerEl && headerEl.nextSibling) {
            sidebar.insertBefore(tabBar, headerEl.nextSibling);
          } else {
            sidebar.insertBefore(tabBar, sidebar.firstChild);
          }
        }
      }

      tabBar.innerHTML = '';
      folders.forEach(folder => {
        const tab = document.createElement('button');
        tab.setAttribute('data-folder-id', folder.id);
        tab.style.cssText = `flex-shrink:0;padding:10px 16px;border:none;background:transparent;color:var(--on-surface-variant,#666);font-size:13px;font-weight:${folder.id === this._activeFolder ? '700' : '500'};cursor:pointer;border-bottom:2px solid ${folder.id === this._activeFolder ? 'var(--primary,#00a884)' : 'transparent'};transition:all 0.15s;white-space:nowrap;display:flex;align-items:center;gap:6px;font-family:inherit;`;
        tab.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">${folder.icon || 'folder'}</span>${this._esc(folder.name)}`;

        if (folder.id !== 'all' && folder.id !== 'unread' && folder.id !== 'groups') {
          tab.innerHTML += `<button data-remove-folder="${folder.id}" style="background:none;border:none;cursor:pointer;color:inherit;opacity:0.5;padding:0 2px;font-size:12px;" aria-label="Remove folder">✕</button>`;
        }

        tab.addEventListener('click', (e) => {
          if (e.target.closest('[data-remove-folder]')) {
            this._removeFolder(folder.id);
            return;
          }
          this._switchFolder(folder.id);
        });

        tabBar.appendChild(tab);
      });

      const addBtn = document.createElement('button');
      addBtn.style.cssText = 'flex-shrink:0;padding:10px 12px;border:none;background:transparent;color:var(--on-surface-variant,#8696a0);cursor:pointer;display:flex;align-items:center;justify-content:center;';
      addBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">add</span>';
      addBtn.title = 'Create folder';
      addBtn.addEventListener('click', () => this._openCreateFolder());
      tabBar.appendChild(addBtn);
    },

    async _switchFolder(folderId) {
      this._activeFolder = folderId;
      const folders = await this.getFolders();
      this._render(folders);

      const chatItems = document.querySelectorAll('[data-chat-id]');
      chatItems.forEach(item => {
        const chatId = item.dataset.chatId;
        const chats = window.App?.chats;
        const chat = Array.isArray(chats) ? chats.find(c => c.id === chatId) : (chats && chats[chatId]) || null;
        if (!chat) return;

        let show = true;
        if (folderId === 'unread') {
          const unread = window.MarkUnread?.getUnreadMap()?.[chatId];
          show = !!unread;
        } else if (folderId === 'groups') {
          show = chat.type === 'group';
        } else if (folderId !== 'all') {
          const folders = JSON.parse(localStorage.getItem('nsl_chat_folders') || '[]');
          const folder = folders.find(f => f.id === folderId);
          show = folder ? folder.chatIds?.includes(chatId) : true;
        }

        item.style.display = show ? '' : 'none';
      });

      document.dispatchEvent(new CustomEvent('folder-change', { detail: { folderId } }));
    },

    async _removeFolder(folderId) {
      const folders = (await this.getFolders()).filter(f => !['all', 'unread', 'groups'].includes(f.id));
      const updated = folders.filter(f => f.id !== folderId);
      await this.saveFolders(updated);
      if (this._activeFolder === folderId) this._activeFolder = 'all';
      this._render([...this._defaultFolders, ...updated]);
      if (typeof showToast === 'function') showToast('Folder removed', 'success');
    },

    _openCreateFolder() {
      const modal = document.createElement('div');
      modal.id = 'create-folder-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

      modal.innerHTML = `
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(380px,92vw);padding:24px;">
          <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;">Create Folder</h3>
          <input type="text" id="folder-name-input" placeholder="Folder name" style="width:100%;padding:12px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;background:var(--surface,#fff);color:var(--on-surface,#000);margin-bottom:12px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
            ${['work', 'family', 'friends', 'school', 'important', 'muted'].map(tag => `
              <button class="folder-chat-tag" data-tag="${tag}" style="padding:6px 12px;border:1px solid var(--outline-variant,#ccc);border-radius:16px;background:transparent;font-size:12px;cursor:pointer;">${tag}</button>
            `).join('')}
          </div>
          <div style="max-height:200px;overflow-y:auto;margin-bottom:16px;" id="folder-chat-list"></div>
          <div style="display:flex;gap:8px;">
            <button id="folder-cancel" style="flex:1;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;background:transparent;cursor:pointer;font-size:14px;">Cancel</button>
            <button id="folder-create" style="flex:1;padding:10px;border:none;border-radius:10px;background:var(--primary,#00a884);color:var(--on-primary,#fff);cursor:pointer;font-size:14px;font-weight:600;">Create</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const chatList = modal.querySelector('#folder-chat-list');
      (window.App?.chats || []).forEach(chat => {
        const label = chat.name || chat.displayName || 'Chat';
        chatList.innerHTML += `
          <label style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;cursor:pointer;">
            <input type="checkbox" value="${chat.id}" class="folder-chat-checkbox" style="width:16px;height:16px;">
            <span style="font-size:14px;">${this._esc(label)}</span>
          </label>
        `;
      });

      modal.querySelector('#folder-cancel').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });

      modal.querySelector('#folder-create').addEventListener('click', async () => {
        const name = modal.querySelector('#folder-name-input').value.trim();
        if (!name) { if (typeof showToast === 'function') showToast('Enter a folder name', 'error'); return; }
        const selected = Array.from(modal.querySelectorAll('.folder-chat-checkbox:checked')).map(cb => cb.value);
        const folder = { id: 'folder_' + Date.now(), name, icon: 'folder', chatIds: selected };

        const existing = (await this.getFolders()).filter(f => !['all', 'unread', 'groups'].includes(f.id));
        existing.push(folder);
        await this.saveFolders(existing);
        this._render([...this._defaultFolders, ...existing]);
        modal.remove();
        if (typeof showToast === 'function') showToast('Folder created', 'success');
      });
    },

    _esc(s) {
      return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    }
  };

  window.ChatFolders = ChatFolders;
})();
