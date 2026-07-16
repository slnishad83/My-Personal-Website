/**
 * Announcement-Only Mode — Admin toggle for group chats.
 * When enabled, only admins/moderators can post messages.
 * Stored as `announcementOnly: true/false` on the chat document.
 */
(function () {
  'use strict';

  function init() {
    injectAnnouncementToggle();
    observeMessageInput();
  }

  function injectAnnouncementToggle() {
    const run = () => {
      const settingsBtn = document.getElementById('group-settings-btn') ||
        document.getElementById('chat-settings-btn') ||
        Array.from(document.querySelectorAll('[onclick*="openGroupSettings"], [onclick*="openChatSettings"]'))[0];
      if (!settingsBtn || settingsBtn.dataset.announceInjection) return;

      if (!window.App || !window.App.currentChat || window.App.currentChat.type !== 'group') return;

      const chat = window.App.currentChat;
      if (chat.announcementOnly === undefined) return;

      const indicator = document.createElement('div');
      indicator.id = 'announcement-mode-banner';
      indicator.style.cssText = `display:none;`;
      document.body.appendChild(indicator);

      settingsBtn.dataset.announceInjection = '1';
    };

    if (window.MutationBus) {
      window.MutationBus.onBodyChildList('announce-toggle-scan', run);
    }
    setTimeout(run, 2000);
  }

  function observeMessageInput() {
    document.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      if (!window.App || !window.App.currentChat) return;
      const chat = window.App.currentChat;
      if (!chat.announcementOnly) return;

      const uid = window.App.auth?.currentUser?.uid;
      if (!uid) return;

      const chatId = chat.id;
      if (window.ChatPermissions && window.ChatPermissions.hasPermission(chatId, uid, 'send')) return;

      if (window.showToast) window.showToast('Only admins can post in this announcement channel', 'error');
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  window.toggleAnnouncementMode = async function () {
    if (!window.App || !window.App.db || !window.App.currentChat) return;
    const chat = window.App.currentChat;
    if (chat.type !== 'group') return;

    const uid = window.App.auth?.currentUser?.uid;
    if (window.ChatPermissions && !window.ChatPermissions.hasPermission(chat.id, uid, 'manage-settings')) {
      if (window.showToast) window.showToast('Only admins can change this setting', 'error');
      return;
    }

    const newVal = !chat.announcementOnly;

    try {
      await window.App.db.collection('chats').doc(chat.id).update({
        announcementOnly: newVal
      });
      window.App.currentChat.announcementOnly = newVal;

      if (window.showToast) {
        window.showToast(
          newVal ? 'Announcement mode enabled — only admins can post' : 'Announcement mode disabled — everyone can post',
          'success'
        );
      }

      updateAnnouncementBanner(newVal);
    } catch (e) {
      console.error('Toggle announcement mode error:', e);
      if (window.showToast) window.showToast('Failed to update setting', 'error');
    }
  };

  function updateAnnouncementBanner(isOn) {
    const msgBox = document.getElementById('messages-box') || document.getElementById('msg-container');
    if (!msgBox) return;

    const existing = document.getElementById('announcement-banner');
    if (existing) existing.remove();

    if (!isOn) return;

    const banner = document.createElement('div');
    banner.id = 'announcement-banner';
    banner.style.cssText = `
      background: var(--primary, #6366f1);
      color: white;
      padding: 8px 16px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: 12px;
      margin: 8px auto;
      max-width: 90%;
    `;
    banner.innerHTML = `<span class="material-symbols-outlined text-[16px]">campaign</span> Announcement Mode — Only admins can post`;

    msgBox.parentElement?.insertBefore(banner, msgBox);
  }

  window.openAnnouncementSettings = function () {
    if (!window.App || !window.App.currentChat) return;
    const chat = window.App.currentChat;
    const isOn = chat.announcementOnly || false;

    const modalHtml = `
      <div id="announcement-settings-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;">
        <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 m-4 relative animate-scale-up">
          <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('announcement-settings-modal').remove()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
          <div class="flex flex-col items-center mb-5">
            <div class="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[24px]">campaign</span>
            </div>
            <h3 class="font-bold text-lg text-on-surface">Announcement Mode</h3>
            <p class="text-xs text-on-surface-variant text-center mt-1">Control who can post messages</p>
          </div>

          <div class="bg-surface-variant/30 rounded-xl p-4 mb-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-bold text-on-surface">Announcement Only</p>
                <p class="text-xs text-on-surface-variant mt-0.5">Only admins and moderators can send messages</p>
              </div>
              <button class="relative w-12 h-6 rounded-full transition-all ${isOn ? 'bg-primary' : 'bg-surface-variant'}" onclick="window.toggleAnnouncementMode()" id="announce-toggle">
                <div class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${isOn ? 'left-[26px]' : 'left-0.5'}" id="announce-toggle-dot"></div>
              </button>
            </div>
          </div>

          <div class="bg-surface-variant/30 rounded-xl p-3">
            <p class="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">How it works</p>
            <div class="space-y-1.5 text-xs text-on-surface-variant">
              <div class="flex items-start gap-2"><span class="material-symbols-outlined text-[14px] text-primary mt-0.5">admin_panel_settings</span> Admins and moderators can always post</div>
              <div class="flex items-start gap-2"><span class="material-symbols-outlined text-[14px] text-on-surface-variant mt-0.5">lock</span> Regular members can only read messages</div>
              <div class="flex items-start gap-2"><span class="material-symbols-outlined text-[14px] text-on-surface-variant mt-0.5">info</span> Great for company updates and team announcements</div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
