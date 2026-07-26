/**
 * Message Scheduling (Feature 2)
 * Allows scheduling a message to be sent at a later date/time.
 */

(function () {
  let scheduledCheckInterval = null;

  function initMessageScheduler() {
    // 1. Inject "Schedule" option into the Attachment menu
    var _scheduleBtnHtml = '<button class="flex flex-col items-center gap-1.5 group schedule-msg-btn" onclick="toggleAttachMenu();window.openMessageScheduler()" role="menuitem"><div class="w-12 h-12 rounded-2xl bg-[#E64A19] flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95"><span class="material-symbols-outlined text-white text-[22px]" style="font-variation-settings:\'FILL\' 1;">schedule_send</span></div><span class="text-[11px] text-on-surface-variant font-medium">Schedule</span></button>';

    function _tryInjectScheduleBtn() {
      var attachMenu = document.querySelector('#attach-menu .grid');
      if (attachMenu && !attachMenu.querySelector('.schedule-msg-btn')) {
        attachMenu.insertAdjacentHTML('beforeend', _scheduleBtnHtml);
        return true;
      }
      return false;
    }

    // Try immediately, then retry with a timer until success (max 5 seconds)
    if (!_tryInjectScheduleBtn()) {
      var _attempts = 0;
      var _retryTimer = setInterval(function() {
        _attempts++;
        if (_tryInjectScheduleBtn() || _attempts > 50) clearInterval(_retryTimer);
      }, 100);
    }

    // Also listen for MutationBus as fallback
    if (window.MutationBus) {
      window.MutationBus.onBodyChildList('inject-schedule-btn', function() { _tryInjectScheduleBtn(); });
    }

    // Start background poller to send scheduled messages
    document.addEventListener('nsl:app-ready', () => {
      if (scheduledCheckInterval) clearInterval(scheduledCheckInterval);
      scheduledCheckInterval = setInterval(checkAndSendScheduledMessages, 10000); // every 10 seconds
    });
  }

  window.openMessageScheduler = function() {
    if (!window.App || !window.App.currentChat) {
      if (window.showToast) window.showToast('Please select a chat first', 'error');
      return;
    }
    
    // Check if there is text in the input box
    const msgInput = document.getElementById('msg-input');
    const textToSchedule = msgInput ? msgInput.value.trim() : '';
    
    if (!textToSchedule) {
      if (window.showToast) window.showToast('Type a message first to schedule it', 'error');
      return;
    }
    
    const now = new Date();
    // Default to 10 minutes from now
    now.setMinutes(now.getMinutes() + 10);
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(now - tzoffset)).toISOString().slice(0, 16);

    const modalHtml = `
      <div id="schedule-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;" onclick="if(event.target===this)this.remove()">
        <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 m-4 relative animate-scale-up">
          <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('schedule-modal').remove()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
          
          <div class="flex flex-col items-center mb-6">
            <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[24px]">schedule_send</span>
            </div>
            <h3 class="font-bold text-lg text-on-surface">Schedule Message</h3>
            <p class="text-xs text-on-surface-variant text-center mt-1">Pick a date and time to send this message.</p>
          </div>
          
          <div class="bg-surface-variant/30 p-3 rounded-xl mb-4 max-h-32 overflow-y-auto">
            <p class="text-sm text-on-surface italic">${window.escHtml ? window.escHtml(textToSchedule) : textToSchedule}</p>
          </div>
          
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Date & Time</label>
              <input type="datetime-local" id="schedule-datetime" min="${localISOTime}" value="${localISOTime}" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors cursor-pointer">
            </div>
          </div>
          
          <button class="w-full mt-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition-all" onclick="window.saveScheduledMessage()">Schedule Send</button>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  window.saveScheduledMessage = async function() {
    if (!window.App || !window.App.db || !window.App.auth.currentUser) return;
    
    const dtInput = document.getElementById('schedule-datetime');
    if (!dtInput || !dtInput.value) return;
    
    const sendTime = new Date(dtInput.value).getTime();
    if (sendTime <= Date.now()) {
      if (window.showToast) window.showToast('Please select a future time', 'error');
      return;
    }
    
    const msgInput = document.getElementById('msg-input');
    const textToSend = msgInput ? msgInput.value.trim() : '';
    if (!textToSend) return;
    
    const uid = window.App.auth.currentUser.uid;
    const chatId = window.App.currentChat.id;
    
    try {
      await window.App.db.collection('users').doc(uid).collection('scheduledMessages').add({
        chatId: chatId,
        text: textToSend,
        sendAt: sendTime,
        createdAt: Date.now()
      });
      
      // Clear input
      if (msgInput) {
        msgInput.value = '';
        if (window.onInputChange) window.onInputChange();
      }
      
      if (window.showToast) window.showToast('Message scheduled successfully', 'success');
      document.getElementById('schedule-modal')?.remove();
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('Failed to schedule message', 'error');
    }
  };

  let isCheckingScheduled = false;
  async function checkAndSendScheduledMessages() {
    if (isCheckingScheduled) return;
    if (!window.App || !window.App.db || !window.App.auth.currentUser) return;
    
    const uid = window.App.auth.currentUser.uid;
    const now = Date.now();
    isCheckingScheduled = true;
    
    try {
      const snap = await window.App.db.collection('users').doc(uid).collection('scheduledMessages')
        .where('sendAt', '<=', now)
        .get();
        
      if (!snap.empty) {
        for (let doc of snap.docs) {
          const data = doc.data();
          
          // Send message
          // We can reuse the existing window.sendMessage logic by faking the state, or constructing a message directly.
          // Since window.sendMessage might depend on App.currentChat matching, we'll manually push it to the chat's collection.
          await sendMsgToDb(data.chatId, data.text);
          
          // Delete scheduled entry
          await doc.ref.delete();
        }
      }
    } catch (e) {
      console.error('Error checking scheduled messages:', e);
    }
    
    isCheckingScheduled = false;
  }
  
  async function sendMsgToDb(chatId, text) {
    const uid = window.App.auth.currentUser.uid;
    const chatArr = Array.isArray(window.App.chats) ? window.App.chats : Object.values(window.App.chats || {});
    const isGroup = chatArr.find(c => c.id === chatId)?.type === 'group';
    
    const msg = {
      text: text,
      from: isGroup ? uid : 'me',
      senderId: uid,
      senderName: window.App.currentUser?.name || 'User',
      time: Date.now(),
      type: 'text'
    };
    
    try {
      const chatRef = window.App.db.collection(isGroup ? 'groups' : 'chats').doc(chatId);
      await window.App.db.collection('messages').add({
        ...msg,
        chatId: chatId
      });
      
      await chatRef.update({
        lastMessage: text,
        lastMessageTime: msg.time,
        unread: (typeof firebase !== 'undefined' ? firebase : window.firebase).firestore.FieldValue.increment(1) // Not accurate for the sender, but usually ignored on client sync
      });
    } catch (err) {
      console.error('[MessageScheduler] sendMsgToDb write failed:', err);
      if (typeof window.showToast === 'function') window.showToast('Failed to send scheduled message.', 'error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMessageScheduler);
  } else {
    initMessageScheduler();
  }
})();
