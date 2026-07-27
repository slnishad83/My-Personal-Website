/**
 * Saved Messages (Bookmarks) - Feature 11
 * Allows bookmarking any message and viewing them in the "Saved" tab.
 */

(function () {
  let savedMessagesCache = [];
  let _savedMessagesUnsub = null;
  
  function initSavedMessages() {
    // 1. Inject CSS for saved items
    const style = document.createElement('style');
    style.textContent = `
      .saved-msg-item {
        padding: 12px 16px;
        border-bottom: 1px solid var(--outline-variant);
        cursor: pointer;
        transition: background 0.2s;
      }
      .saved-msg-item:hover {
        background: var(--surface-variant);
      }
      .saved-msg-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      .saved-msg-title {
        font-weight: 700;
        font-size: 13px;
        color: var(--on-surface);
      }
      .saved-msg-time {
        font-size: 11px;
        color: var(--on-surface-variant);
      }
      .saved-msg-body {
        font-size: 13px;
        color: var(--on-surface-variant);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .saved-msg-empty {
        padding: 40px 20px;
        text-align: center;
        color: var(--on-surface-variant);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
    `;
    document.head.appendChild(style);

    // 2. Add "Save" to Context Menu via monkey-patching showMsgContextMenu if possible, 
    // or by overriding window.NSLContextMenu
    if (window.MutationBus) {
      // Whenever a context menu is opened, inject our button
      window.MutationBus.onBodyChildList('inject-save-btn', () => {
        const menu = document.getElementById('_msg-ctx-menu');
        if (menu && !menu.querySelector('.save-msg-injected')) {
          // Find the msgId from the reply or delete button
          const replyBtn = Array.from(menu.querySelectorAll('button')).find(b => b.innerHTML.includes('Reply'));
          if (replyBtn) {
            const match = replyBtn.getAttribute('onclick')?.match(/replyToMsg\('([^']+)'\)/);
            if (match && match[1]) {
              const msgId = match[1];
              injectSaveButton(menu, msgId);
            }
          }
        }
      });
    }

    // 3. Hook into Tab Switcher for "more"
    const originalSwitchTab = window.switchTab;
    if (originalSwitchTab) {
      window.switchTab = function(tab) {
        originalSwitchTab(tab);
        if (tab === 'more') {
          renderSavedMessagesTab();
        }
      };
    }
  }

  function injectSaveButton(menu, msgId) {
    const _isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
    const btn = document.createElement('button');
    btn.className = 'save-msg-injected';
    btn.style.cssText = `
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:inherit; transition:background 0.15s;
    `;
    btn.innerHTML = `<span style="font-size:16px">🔖</span> Save Message`;
    btn.onmouseenter = () => btn.style.background = 'var(--surface-container-highest)';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = () => { 
      if(window._removeCtxMenu) window._removeCtxMenu(); 
      saveMessageToDb(msgId); 
    };
    
    // Insert before Delete
    const deleteBtn = Array.from(menu.querySelectorAll('button')).find(b => b.innerHTML.includes('Delete'));
    if (deleteBtn) {
      menu.insertBefore(btn, deleteBtn);
    } else {
      menu.appendChild(btn);
    }
  }

  async function saveMessageToDb(msgId) {
    if (!window.App || !window.App.db || !window.App.auth.currentUser) return;
    const uid = window.App.auth.currentUser.uid;
    const chatId = window.App.currentChat?.id;
    if (!chatId) return;

    const msgs = window.App.messages[chatId] || [];
    const msg = msgs.find(m => m.id === msgId);
    if (!msg) return;

    try {
      const savedMsgRef = window.App.db.collection('users').doc(uid).collection('savedMessages').doc(msgId);
      await savedMsgRef.set({
        ...msg,
        savedAt: Date.now(),
        originalChatId: chatId,
        originalChatName: window.App.currentChat.name
      });
      if (window.showToast) window.showToast('Message saved to Bookmarks', 'success');
    } catch (e) {
      console.error('Error saving message:', e);
      if (window.showToast) window.showToast('Failed to save message', 'error');
    }
  }

  function fetchSavedMessages() {
    if (_savedMessagesUnsub) { _savedMessagesUnsub(); _savedMessagesUnsub = null; }
    if (!window.App || !window.App.db || !window.App.auth.currentUser) return;
    const uid = window.App.auth.currentUser.uid;
    
    _savedMessagesUnsub = window.App.db.collection('users').doc(uid).collection('savedMessages')
      .orderBy('savedAt', 'desc')
      .onSnapshot(snap => {
        savedMessagesCache = snap.docs.map(doc => doc.data());
        if (window.App.activeTab === 'more') {
          renderSavedMessagesTab();
        }
      });
  }

  function renderSavedMessagesTab() {
    const list = document.getElementById('chat-list');
    if (!list) return;
    
    document.getElementById('chats-sidebar-title').textContent = 'Saved Messages';
    
    if (savedMessagesCache.length === 0) {
      list.innerHTML = `
        <div class="saved-msg-empty">
          <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.5;">bookmark_border</span>
          <div>
            <h3 class="font-bold mb-1">No Saved Messages</h3>
            <p class="text-xs">Save messages to read them later</p>
          </div>
        </div>
      `;
      return;
    }

    let html = '';
    savedMessagesCache.forEach(msg => {
      const d = new Date(msg.savedAt);
      const timeStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      let preview = msg.text || '';
      if (msg.type === 'image' || msg.attachment?.type === 'image') preview = '📷 Image ' + preview;
      if (msg.type === 'video' || msg.attachment?.type === 'video') preview = '🎥 Video ' + preview;
      if (msg.type === 'voice' || msg.attachment?.type === 'voice') preview = '🎤 Voice message';

      html += `
        <div class="saved-msg-item" onclick="openSavedMessage('${msg.originalChatId}', '${msg.id}')">
          <div class="saved-msg-header">
            <span class="saved-msg-title">${window.escHtml ? window.escHtml(msg.originalChatName) : msg.originalChatName}</span>
            <span class="saved-msg-time">${timeStr}</span>
          </div>
          <div class="saved-msg-body">${window.escHtml ? window.escHtml(preview) : preview}</div>
        </div>
      `;
    });
    
    list.innerHTML = html;
  }

  window.openSavedMessage = function(chatId, msgId) {
    if (window.selectChat) {
      window.selectChat(chatId);
      setTimeout(() => {
        if (window.scrollToMsg) window.scrollToMsg(msgId);
      }, 500);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSavedMessages);
    document.addEventListener('nsl:app-ready', fetchSavedMessages);
  } else {
    initSavedMessages();
    fetchSavedMessages();
  }
})();
