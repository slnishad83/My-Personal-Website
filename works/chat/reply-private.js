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

        const replyPayload = {
          id: msg.id,
          text: quotedText,
          senderName: quotedSender,
          groupId: groupChatId,
          groupName: (typeof currentGroup !== 'undefined' && currentGroup) ? currentGroup.name : 'Group',
        };

        if (typeof openChat === 'function') {
          await openChat(directChatId, 'direct');
        }

        window.currentReplyTo = replyPayload;
        if (typeof window.setReply === 'function') {
          window.setReply(msg.id, quotedSender, quotedText);
        } else if (typeof window.replyToMessage === 'function') {
          window.replyToMessage(msg.id);
        } else {
          const bar = document.getElementById('reply-preview');
          if (bar) {
            bar.classList.remove('hidden');
            const rpName = document.getElementById('reply-name');
            const rpText = document.getElementById('reply-text');
            if (rpName) rpName.textContent = quotedSender;
            if (rpText) rpText.textContent = quotedText;
            bar.dataset.replyTo = msg.id;
          }
        }

        showToast(`Reply privately to ${quotedSender}`, 'info');
      } catch (e) {
        console.error('[ReplyPrivate] Error:', e);
        showToast('Failed to start private reply', 'error');
      }
    },

    async messagePerson(msg, _groupChatId) {
      const user = App.auth?.currentUser;
      if (!user || !msg || !msg.senderId) return;

      if (msg.senderId === user.uid) {
        showToast("That's you!", 'info');
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

        if (typeof openChat === 'function') {
          await openChat(directChatId, 'direct');
        }

        showToast(`Opening chat with ${msg.senderName || 'user'}`, 'info');
      } catch (e) {
        console.error('[ReplyPrivate] Error:', e);
        showToast('Failed to open chat', 'error');
      }
    },

    addReplyPrivateOption(menu, msg, groupChatId) {
      if (!msg || !groupChatId) return;
      if (msg.senderId === (App.auth?.currentUser?.uid)) return;

      const btn = document.createElement('button');
      btn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;border:none;background:transparent;color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;width:100%;text-align:left;border-radius:0';
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">forward</span>Reply Privately';
      btn.onclick = () => {
        this.replyPrivately(msg, groupChatId);
        if (window._removeCtxMenu) window._removeCtxMenu();
      };

      const senderName = msg.senderName || 'user';
      const msgBtn = document.createElement('button');
      msgBtn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;border:none;background:transparent;color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;width:100%;text-align:left;border-radius:0';
      msgBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">chat</span>Message ' + senderName;
      msgBtn.onclick = () => {
        this.messagePerson(msg, groupChatId);
        if (window._removeCtxMenu) window._removeCtxMenu();
      };

      const replyBtn = Array.from(menu.querySelectorAll('button')).find(b => b.innerHTML.includes('Reply'));
      if (replyBtn) {
        menu.insertBefore(btn, replyBtn.nextSibling);
        menu.insertBefore(msgBtn, btn.nextSibling);
      } else {
        const firstBtn = menu.querySelector('button');
        if (firstBtn) {
          menu.insertBefore(msgBtn, firstBtn);
          menu.insertBefore(btn, msgBtn);
        } else {
          menu.appendChild(btn);
          menu.appendChild(msgBtn);
        }
      }
    }
  };

  window.ReplyPrivate = ReplyPrivate;

  document.addEventListener('nsl:app-ready', () => {
    ReplyPrivate.init();
  });
})();
