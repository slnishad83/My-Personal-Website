/**
 * Reply Privately in Groups
 * Allows replying to a group message privately via DM.
 */
(function () {
  'use strict';

  const ReplyPrivate = {
    init() {},

    async replyPrivately(msg, groupChatId) {
      const user = App.auth?.currentUser;
      if (!user || !msg || !msg.senderId) return;

      if (msg.senderId === user.uid) {
        showToast("You can't reply privately to your own message", 'info');
        return;
      }

      try {
        let directChatId = null;
        const chatQuery = await App.db.collection('directChats')
          .where('members', 'array-contains', user.uid)
          .get();

        for (const doc of chatQuery.docs) {
          const data = doc.data();
          if (data.members && data.members.includes(msg.senderId)) {
            directChatId = doc.id;
            break;
          }
        }

        if (!directChatId) {
          const chatRef = await App.db.collection('directChats').add({
            members: [user.uid, msg.senderId],
            createdAt: new Date(),
            lastMessage: '',
            lastMessageTime: new Date(),
          });
          directChatId = chatRef.id;
        }

        const quotedText = msg.text ? msg.text.substring(0, 100) : (msg.type || 'media');
        const quotedSender = msg.senderName || 'Unknown';

        window.currentReplyTo = {
          id: msg.id,
          text: quotedText,
          senderName: quotedSender,
          groupId: groupChatId,
          groupName: currentGroup?.name || 'Group',
        };

        if (typeof openChat === 'function') {
          openChat(directChatId, 'direct');
        }

        showToast(`Reply privately to ${quotedSender}`, 'info');
      } catch (e) {
        console.error('[ReplyPrivate] Error:', e);
        showToast('Failed to start private reply', 'error');
      }
    },

    addReplyPrivateOption(menu, msg, groupChatId) {
      if (!msg || !groupChatId) return;

      const btn = document.createElement('button');
      btn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;border:none;background:transparent;color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;width:100%;text-align:left;border-radius:0';
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">reply_private</span>Reply Privately';
      btn.onclick = () => {
        this.replyPrivately(msg, groupChatId);
        if (window._removeCtxMenu) window._removeCtxMenu();
      };

      const replyBtn = Array.from(menu.querySelectorAll('button')).find(b => b.innerHTML.includes('Reply'));
      if (replyBtn) {
        menu.insertBefore(btn, replyBtn.nextSibling);
      } else {
        const firstBtn = menu.querySelector('button');
        if (firstBtn) menu.insertBefore(btn, firstBtn);
        else menu.appendChild(btn);
      }
    }
  };

  window.ReplyPrivate = ReplyPrivate;

  document.addEventListener('nsl:app-ready', () => {
    ReplyPrivate.init();
  });
})();
