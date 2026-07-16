/**
 * Channel Mode — Persistent one-to-many broadcast channels.
 * Admins create channels within groups; channels have their own chat space.
 * Channels stored in `channels` collection; messages use existing `messages` subcollection.
 * Admin-only posting by default (toggled per channel).
 */
(function () {
  'use strict';

  function init() {
    injectChannelButton();
  }

  function injectChannelButton() {
    const run = () => {
      const sidebar = document.getElementById('sidebar') || document.getElementById('sidebar-panel');
      if (!sidebar || sidebar.querySelector('.channel-nav-btn')) return;

      const channelBtn = document.createElement('button');
      channelBtn.className = 'channel-nav-btn w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/30 transition-all cursor-pointer';
      channelBtn.onclick = () => window.openChannelPanel();
      channelBtn.innerHTML = `
        <span class="material-symbols-outlined text-[20px] text-emerald-400">tag</span>
        <span class="text-sm font-bold text-on-surface">Channels</span>
      `;
      sidebar.appendChild(channelBtn);
    };

    if (window.MutationBus) {
      window.MutationBus.onBodyChildList('channel-btn-scan', run);
    }
    setTimeout(run, 2000);
  }

  window.openChannelPanel = function () {
    if (!window.App || !window.App.currentChat) return;
    const chat = window.App.currentChat;
    if (chat.type !== 'group') {
      if (window.showToast) window.showToast('Channels are only available in group chats', 'info');
      return;
    }

    const uid = window.App.auth?.currentUser?.uid;
    const chatId = chat.id;
    const channels = chat.channels || [];

    const canCreate = window.ChatPermissions ? window.ChatPermissions.hasPermission(chatId, uid, 'create-channel') :
      (chat.roles?.[uid] === 'admin');

    const channelItemsHtml = channels.length ? channels.map(ch => `
      <div class="channel-item flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/30 transition-all cursor-pointer border border-outline-variant/20 mb-2" onclick="window._openChannel('${ch.id}')">
        <span class="material-symbols-outlined text-[20px] text-emerald-400">tag</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-on-surface truncate">${window.escHtml ? window.escHtml(ch.name) : ch.name}</p>
          <p class="text-xs text-on-surface-variant truncate">${ch.announcementOnly ? '📢 Announcement only' : '👥 All members can post'}</p>
        </div>
        <span class="material-symbols-outlined text-[16px] text-on-surface-variant">chevron_right</span>
      </div>
    `).join('') : `
      <div class="text-center py-8 text-on-surface-variant">
        <span class="material-symbols-outlined text-[40px] text-on-surface-variant/50 mb-2 block">tag</span>
        <p class="text-sm font-bold">No channels yet</p>
        <p class="text-xs mt-1">Create a channel for organized discussions</p>
      </div>
    `;

    const modalHtml = `
      <div id="channel-panel-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;">
        <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 m-4 relative animate-scale-up max-h-[85vh] overflow-y-auto">
          <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('channel-panel-modal').remove()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div class="flex items-center justify-between mb-5">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">tag</span>
              </div>
              <div>
                <h3 class="font-bold text-lg text-on-surface">Channels</h3>
                <p class="text-xs text-on-surface-variant">Organized topic discussions</p>
              </div>
            </div>
            ${canCreate ? `<button class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-md hover:brightness-110 transition-all" onclick="window._createChannel()">
              <span class="material-symbols-outlined text-[20px]">add</span>
            </button>` : ''}
          </div>

          <div class="space-y-1" id="channel-list-container">${channelItemsHtml}</div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  window._createChannel = function () {
    document.getElementById('channel-panel-modal')?.remove();

    const modalHtml = `
      <div id="create-channel-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;">
        <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 m-4 relative animate-scale-up">
          <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('create-channel-modal').remove()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div class="flex flex-col items-center mb-5">
            <div class="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[24px]">add_circle</span>
            </div>
            <h3 class="font-bold text-lg text-on-surface">Create Channel</h3>
            <p class="text-xs text-on-surface-variant text-center mt-1">Create a new topic channel</p>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Channel Name</label>
              <div class="flex items-center gap-2 bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-3">
                <span class="material-symbols-outlined text-[18px] text-on-surface-variant">#</span>
                <input type="text" id="channel-name-input" class="flex-1 bg-transparent text-on-surface text-sm focus:outline-none" placeholder="e.g. general, engineering, design">
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Description (optional)</label>
              <input type="text" id="channel-desc-input" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="What is this channel about?">
            </div>
            <div class="flex items-center justify-between bg-surface-variant/30 p-3 rounded-xl">
              <div>
                <p class="text-sm font-bold text-on-surface">Announcement Only</p>
                <p class="text-xs text-on-surface-variant">Only admins can post</p>
              </div>
              <button class="relative w-12 h-6 rounded-full bg-surface-variant transition-all" onclick="this.classList.toggle('bg-primary');this.classList.toggle('bg-surface-variant');" id="channel-announce-toggle">
                <div class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all" id="channel-announce-dot"></div>
              </button>
            </div>
          </div>

          <button class="w-full mt-5 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition-all" onclick="window._submitChannel()">
            Create Channel
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  window._submitChannel = async function () {
    if (!window.App || !window.App.db || !window.App.auth.currentUser) return;
    const uid = window.App.auth.currentUser.uid;
    const chat = window.App.currentChat;

    const nameInput = document.getElementById('channel-name-input');
    const descInput = document.getElementById('channel-desc-input');
    const announceToggle = document.getElementById('channel-announce-toggle');

    const name = nameInput?.value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!name) {
      if (window.showToast) window.showToast('Please enter a channel name', 'error');
      return;
    }

    const description = descInput?.value.trim() || '';
    const announcementOnly = announceToggle?.classList.contains('bg-primary') || false;

    try {
      const docRef = await window.App.db.collection('channels').add({
        name: name,
        description: description,
        announcementOnly: announcementOnly,
        chatId: chat.id,
        chatName: chat.name || '',
        members: chat.memberIds || chat.members || [],
        createdBy: uid,
        createdByName: window.App.currentUser?.name || 'User',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (!chat.channels) chat.channels = [];
      chat.channels.push({
        id: docRef.id,
        name: name,
        description: description,
        announcementOnly: announcementOnly
      });

      document.getElementById('create-channel-modal')?.remove();

      if (window.showToast) window.showToast(`#${name} channel created!`, 'success');
      if (window.openChannelPanel) window.openChannelPanel();
    } catch (e) {
      console.error('Create channel error:', e);
      if (window.showToast) window.showToast('Failed to create channel', 'error');
    }
  };

  window._openChannel = function (channelId) {
    document.getElementById('channel-panel-modal')?.remove();

    if (!window.App || !window.App.currentChat) return;
    const chat = window.App.currentChat;
    const channel = (chat.channels || []).find(c => c.id === channelId);
    if (!channel) return;

    const uid = window.App.auth?.currentUser?.uid;
    const canPost = channel.announcementOnly ?
      (window.ChatPermissions ? window.ChatPermissions.hasPermission(chat.id, uid, 'send') : chat.roles?.[uid] === 'admin') : true;

    window._activeChannelId = channelId;
    window._activeChannelName = channel.name;

    const chatWindow = document.getElementById('chat-window') || document.getElementById('messages-container');
    if (!chatWindow) return;

    const header = document.getElementById('chat-header') || document.querySelector('.chat-header, [class*="header"]');
    if (header) {
      const existingBanner = document.getElementById('channel-active-banner');
      if (existingBanner) existingBanner.remove();

      const banner = document.createElement('div');
      banner.id = 'channel-active-banner';
      banner.style.cssText = `
        background: var(--primary, #6366f1);
        color: white;
        padding: 6px 16px;
        text-align: center;
        font-size: 11px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        border-radius: 12px;
        margin: 0 8px;
      `;
      banner.onclick = () => window.openChannelPanel();
      banner.innerHTML = `<span class="material-symbols-outlined text-[14px]">tag</span> #${channel.name} ${channel.announcementOnly ? '• Announcement Only' : ''} <span class="material-symbols-outlined text-[14px]">chevron_right</span>`;
      header.parentElement?.insertBefore(banner, header.nextSibling);
    }

    if (window.showToast) window.showToast(`Viewing #${channel.name}`, 'info');

    if (!canPost) {
      const inputBox = document.getElementById('msg-input') || document.getElementById('message-input');
      if (inputBox) {
        inputBox.disabled = true;
        inputBox.placeholder = 'Only admins can post in this channel';
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
