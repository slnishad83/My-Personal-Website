/**
 * Self-Destructing Messages (Feature 10)
 * Adds disappearing messages functionality to any chat.
 * Includes global default timer setting.
 */

(function () {
  let disappearingCheckInterval = null;
  const GLOBAL_DEFAULT_KEY = 'nsl_disappearing_default';

  const SelfDestruct = {
    getGlobalDefault() {
      try {
        return parseInt(localStorage.getItem(GLOBAL_DEFAULT_KEY) || '0', 10);
      } catch (_) { return 0; }
    },

    setGlobalDefault(timerMs) {
      try {
        localStorage.setItem(GLOBAL_DEFAULT_KEY, timerMs.toString());
      } catch (_) {}
    },

    applyDefaultToNewChats(chatId) {
      const defaultTimer = this.getGlobalDefault();
      if (defaultTimer > 0 && App.db && App.auth?.currentUser) {
        const chat = (App.chats || []).find(c => c.id === chatId);
        if (chat && !chat.ephemeralTimer) {
          const collection = chat.type === 'group' ? 'groups' : 'chats';
          App.db.collection(collection).doc(chatId).update({ ephemeralTimer: defaultTimer }).catch(() => {});
        }
      }
    },

    openGlobalDefaultSettings() {
      const current = this.getGlobalDefault();
      const options = [
        { label: 'Off', value: 0 },
        { label: '5 Minutes', value: 300000 },
        { label: '1 Hour', value: 3600000 },
        { label: '24 Hours', value: 86400000 },
        { label: '7 Days', value: 604800000 },
      ];

      const modalHtml = `
        <div id="global-disappearing-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center" style="display:flex;">
          <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-xs shadow-2xl p-6 m-4 relative">
            <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('global-disappearing-modal').remove()">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
            <div class="flex flex-col items-center mb-6">
              <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <span class="material-symbols-outlined text-[24px]">timer</span>
              </div>
              <h3 class="font-bold text-lg text-on-surface">Default Disappearing Messages</h3>
              <p class="text-xs text-on-surface-variant text-center mt-1">Set the default timer for new chats. Existing chats won't be affected.</p>
            </div>
            <div class="space-y-2">
              ${options.map(opt => `
                <label class="flex items-center justify-between p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-variant/30 transition-colors">
                  <span class="text-sm font-medium">${opt.label}</span>
                  <input type="radio" name="global-ephemeral-timer" value="${opt.value}" ${current === opt.value ? 'checked' : ''} class="w-4 h-4 text-primary">
                </label>`).join('')}
            </div>
            <button class="w-full mt-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition-all" onclick="window.saveGlobalDisappearingDefault()">Save</button>
          </div>
        </div>`;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
  };

  window.SelfDestruct = SelfDestruct;

  window.saveGlobalDisappearingDefault = function () {
    const selected = document.querySelector('input[name="global-ephemeral-timer"]:checked');
    if (!selected) return;
    const timerVal = parseInt(selected.value, 10);
    SelfDestruct.setGlobalDefault(timerVal);
    if (window.showToast) {
      showToast(timerVal === 0 ? 'Default turned off' : 'Default timer set for new chats', 'success');
    }
    document.getElementById('global-disappearing-modal')?.remove();
  };

  function initSelfDestruct() {
    // 1. Hook into openChatMenu to add "Disappearing Messages" option
    if (window.MutationBus) {
      window.MutationBus.onBodyChildList('inject-disappearing-btn', () => {
        const menu = document.getElementById('_msg-ctx-menu');
        // Check if it's the chat header menu (has "Clear History" or "Search in chat")
        if (menu && !menu.querySelector('.disappearing-msg-injected')) {
          const searchBtn = Array.from(menu.querySelectorAll('button')).find(b => b.innerHTML.includes('Search in chat'));
          if (searchBtn) {
            injectDisappearingButton(menu);
          }
        }
      });
    }

    // 2. Add an indicator in the chat header if disappearing messages are ON
    document.addEventListener('nsl:app-ready', () => {
      const originalSelectChat = window.selectChat;
      if (originalSelectChat) {
        window.selectChat = function(...args) {
          const res = originalSelectChat.apply(this, args);
          setTimeout(updateHeaderIndicator, 100);
          return res;
        };
      }
      
      // Start the background checker
      if (disappearingCheckInterval) clearInterval(disappearingCheckInterval);
      disappearingCheckInterval = setInterval(checkAndDestroyMessages, 60000); // Check every minute
    });
  }

  function injectDisappearingButton(menu) {
    if (!window.App || !window.App.currentChat) return;
    
    const chat = window.App.currentChat;
    const currentTimer = chat.ephemeralTimer || 0;
    
    let timerLabel = 'Off';
    if (currentTimer === 300000) timerLabel = '5 min';
    else if (currentTimer === 3600000) timerLabel = '1 hour';
    else if (currentTimer === 86400000) timerLabel = '24 hours';
    
    const btn = document.createElement('button');
    btn.className = 'disappearing-msg-injected';
    btn.style.cssText = `
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:inherit; transition:background 0.15s; justify-content:space-between;
    `;
    btn.innerHTML = `<div style="display:flex; align-items:center; gap:10px;"><span style="font-size:16px">â³</span> Disappearing Messages</div> <span style="font-size:11px; opacity:0.7;">${timerLabel}</span>`;
    btn.onmouseenter = () => btn.style.background = 'var(--surface-container-highest)';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = () => { 
      if(window._removeCtxMenu) window._removeCtxMenu(); 
      openDisappearingSettings(); 
    };
    
    // Insert before Clear History
    const clearBtn = Array.from(menu.querySelectorAll('button')).find(b => b.innerHTML.includes('Clear History'));
    if (clearBtn) {
      menu.insertBefore(btn, clearBtn);
    } else {
      menu.appendChild(btn);
    }
  }

  function openDisappearingSettings() {
    if (!window.App || !window.App.currentChat) return;
    const chat = window.App.currentChat;
    const currentTimer = chat.ephemeralTimer || 0;

    const modalHtml = `
      <div id="disappearing-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;">
        <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-xs shadow-2xl p-6 m-4 relative animate-scale-up">
          <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('disappearing-modal').remove()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
          
          <div class="flex flex-col items-center mb-6">
            <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[24px]">timer</span>
            </div>
            <h3 class="font-bold text-lg text-on-surface">Disappearing Messages</h3>
            <p class="text-xs text-on-surface-variant text-center mt-1">Make new messages in this chat disappear for everyone after they are sent.</p>
          </div>
          
          <div class="space-y-2">
            <label class="flex items-center justify-between p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-variant/30 transition-colors">
              <span class="text-sm font-medium">Off</span>
              <input type="radio" name="ephemeral-timer" value="0" ${currentTimer === 0 ? 'checked' : ''} class="w-4 h-4 text-primary">
            </label>
            <label class="flex items-center justify-between p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-variant/30 transition-colors">
              <span class="text-sm font-medium">5 Minutes</span>
              <input type="radio" name="ephemeral-timer" value="300000" ${currentTimer === 300000 ? 'checked' : ''} class="w-4 h-4 text-primary">
            </label>
            <label class="flex items-center justify-between p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-variant/30 transition-colors">
              <span class="text-sm font-medium">1 Hour</span>
              <input type="radio" name="ephemeral-timer" value="3600000" ${currentTimer === 3600000 ? 'checked' : ''} class="w-4 h-4 text-primary">
            </label>
            <label class="flex items-center justify-between p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-variant/30 transition-colors">
              <span class="text-sm font-medium">24 Hours</span>
              <input type="radio" name="ephemeral-timer" value="86400000" ${currentTimer === 86400000 ? 'checked' : ''} class="w-4 h-4 text-primary">
            </label>
          </div>
          
          <button class="w-full mt-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition-all" onclick="window.saveDisappearingTimer()">Save</button>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  window.saveDisappearingTimer = async function() {
    if (!window.App || !window.App.currentChat || !window.App.db) return;
    
    const selected = document.querySelector('input[name="ephemeral-timer"]:checked');
    if (!selected) return;
    
    const timerVal = parseInt(selected.value, 10);
    const chatId = window.App.currentChat.id;
    
    try {
      if (window.App.currentChat.type === 'group') {
        await window.App.db.collection('groups').doc(chatId).update({ ephemeralTimer: timerVal });
      } else {
        await window.App.db.collection('directChats').doc(chatId).update({ ephemeralTimer: timerVal });
      }
      
      window.App.currentChat.ephemeralTimer = timerVal;
      updateHeaderIndicator();
      
      if (window.showToast) window.showToast('Disappearing messages timer updated', 'success');
      document.getElementById('disappearing-modal')?.remove();
      
      // Send a system message to the chat
      if (window.App.messages && window.App.messages[chatId] && window.sendMessage) {
        // We'll let the user know, this is optional
      }
    } catch (e) {
      if (window.__DEBUG__) console.error(e);
      if (window.showToast) window.showToast('Failed to update timer', 'error');
    }
  };

  function updateHeaderIndicator() {
    if (!window.App || !window.App.currentChat) return;

    const chat = window.App.currentChat;
    const existingIcon = document.getElementById('header-ephemeral-icon');
    
    if (chat.ephemeralTimer && chat.ephemeralTimer > 0) {
      if (!existingIcon) {
        const infoDiv = document.getElementById('chat-header-info');
        if (infoDiv) {
          const icon = document.createElement('span');
          icon.id = 'header-ephemeral-icon';
          icon.className = 'material-symbols-outlined text-[16px] text-primary ml-2';
          icon.textContent = 'timer';
          icon.title = 'Disappearing Messages On';
          infoDiv.appendChild(icon);
        }
      }
    } else {
      if (existingIcon) existingIcon.remove();
    }
  }

  function checkAndDestroyMessages() {
    if (!window.App || !window.App.messages || !window.App.db) return;
    
    const now = Date.now();
    
        const chatArray = Array.isArray(window.App?.chats) ? window.App.chats : Object.values(window.App?.chats || {});
        chatArray.forEach(chat => {
          if (!chat || !chat.id) return;
          const timer = chat.ephemeralTimer || 0;
          const chatId = chat.id;
          if (timer && timer > 0) {
            const msgs = window.App.messages[chatId];
        (Array.isArray(msgs) ? msgs : []).forEach(msg => {
          if (!msg || msg.kept === true || msg.keepInChat === true) return;
          var msgTs = msg.time || (msg.timestamp && msg.timestamp.toMillis ? msg.timestamp.toMillis() : (typeof msg.timestamp === 'number' ? msg.timestamp : 0));
          if (msgTs && (now - msgTs > timer)) {
            const isGroup = chat.type === 'group' || chat.isGroup === true;
            const coll = isGroup ? 'groups' : 'chats';
            const msgRef = window.App.db.collection(coll).doc(chatId).collection('messages').doc(msg.id);
            msgRef.delete()
              .then(() => {
                if (window.App.messages[chatId]) {
                  window.App.messages[chatId] = window.App.messages[chatId].filter(m => m.id !== msg.id);
                }
              })
              .catch(e => {
                if (e.code === 7 || e.message?.includes('PERMISSION_DENIED')) {
                  if (window.__DEBUG__) console.warn('[SelfDestruct] Delete blocked by rules, server will handle');
                } else {
                  if (window.__DEBUG__) console.error('[SelfDestruct] Delete failed:', e);
                }
              });
          }
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSelfDestruct);
  } else {
    initSelfDestruct();
  }

  /* ── Keep in chat (exempt from disappearing messages) ──────────── */
  window.isMessageKept = function (msg) {
    return !!msg && (msg.kept === true || msg.keepInChat === true);
  };

  window.toggleKeepInChat = async function (chatId, msgId, keep) {
    if (!window.App || !window.App.db || !window.App.currentChat) return false;
    try {
      const chat = window.App.currentChat;
      const isGroup = chat.type === 'group' || chat.isGroup === true;
      const coll = isGroup ? 'groups' : 'chats';
      const uid = (window.App.auth && window.App.auth.currentUser && window.App.auth.currentUser.uid) || (window.currentUser && window.currentUser.uid) || '';
      const FV = (window.App.db.FieldValue) || (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue);
      const update = {};
      if (keep) {
        update.kept = true;
        update.keptAt = new Date();
        if (uid) update.keptBy = FV ? FV.arrayUnion(uid) : [uid];
      } else {
        update.kept = false;
        if (FV) {
          update.keptAt = FV.delete();
          update.keptBy = FV.delete();
        }
      }
      await window.App.db.collection(coll).doc(chatId).collection('messages').doc(msgId).update(update);
      const msgs = window.App.messages[chatId];
      if (Array.isArray(msgs)) {
        const m = msgs.find(x => x.id === msgId);
        if (m) { m.kept = keep; m.keepInChat = keep; }
      }
      if (window.showToast) window.showToast(keep ? 'Message kept in chat' : 'Message no longer kept', 'success');
      return true;
    } catch (e) {
      if (window.__DEBUG__) console.error('[SelfDestruct] toggleKeepInChat failed:', e);
      if (window.showToast) window.showToast('Failed to update keep status', 'error');
      return false;
    }
  };
})();
