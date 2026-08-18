/* ============================================================
   CALL REJECT WITH MESSAGE — Reject incoming call with a
   predefined text message (like WhatsApp)
   ============================================================ */
'use strict';

(function() {
  const quickReplies = [
    "Sorry, I'm busy right now. I'll call you later.",
    "Can't talk right now. I'll message you.",
    "I'm in a meeting. Will call back soon.",
    "Driving right now. I'll text you.",
    "In a class/meeting. Will respond later.",
    "Sorry, can't take this call."
  ];

  function showRejectWithMessage(callId, callerId, callerName) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;padding-bottom:env(safe-area-inset-bottom,16px);';

    modal.innerHTML = `
      <div style="background:var(--surface-container,#1f2c34);border-radius:16px 16px 0 0;width:100%;max-width:420px;padding:16px 16px 24px;animation:slideUp 0.3s ease;">
        <div style="width:40px;height:4px;border-radius:2px;background:var(--outline,#667781);margin:0 auto 16px;"></div>
        <div style="font-size:15px;font-weight:600;color:var(--text,#e9edef);margin-bottom:12px;">Send message to ${esc(callerName || 'caller')}:</div>
        <div id="quick-replies" style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
          ${quickReplies.map((r, i) => `
            <button class="qr-btn" data-idx="${i}" style="text-align:left;padding:12px 14px;border:none;border-radius:10px;background:var(--surface,#374045);color:var(--text,#e9edef);font-size:14px;cursor:pointer;transition:background 0.15s;">
              ${esc(r)}
            </button>
          `).join('')}
        </div>
        <input type="text" id="custom-reject-msg" placeholder="Type a custom message..." style="width:100%;padding:12px;border:1px solid var(--outline,#667781);border-radius:10px;background:var(--surface,#202c33);color:var(--text,#e9edef);font-size:14px;margin-bottom:12px;box-sizing:border-box;">
        <div style="display:flex;gap:10px;">
          <button id="cancel-reject" style="flex:1;padding:12px;border:1px solid var(--outline,#667781);border-radius:10px;background:transparent;color:var(--text,#e9edef);font-size:14px;cursor:pointer;">Cancel</button>
          <button id="send-reject-msg" style="flex:1;padding:12px;border:none;border-radius:10px;background:var(--primary,#00a884);color:var(--on-primary,#fff);font-size:14px;font-weight:600;cursor:pointer;">Send</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('.qr-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const idx = parseInt(btn.getAttribute('data-idx'));
        document.getElementById('custom-reject-msg').value = quickReplies[idx];
        modal.querySelectorAll('.qr-btn').forEach(function(b) { b.style.background = 'var(--surface,#374045)'; });
        btn.style.background = 'var(--primary,#00a884)';
      });
    });

    document.getElementById('cancel-reject').addEventListener('click', function() { modal.remove(); });

    document.getElementById('send-reject-msg').addEventListener('click', function() {
      const msg = document.getElementById('custom-reject-msg').value.trim();
      if (!msg) { if (typeof showToast === 'function') showToast('Enter a message', 'error'); return; }
      _sendRejectMessage(callId, callerId, callerName, msg);
      modal.remove();
    });

    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
  }

  function _sendRejectMessage(callId, callerId, callerName, text) {
    const uid = (window.currentUser && window.currentUser.uid) || (window.App && window.App.auth && window.App.auth.currentUser && window.App.auth.currentUser.uid);
    if (!uid) return;
    const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
    if (!db) return;
    const chatId = [uid, callerId].sort().join('_');

    db.collection('chats').doc(chatId).collection('messages').add({
      text: text,
      senderId: uid,
      senderName: (window.currentUser && window.currentUser.displayName) || 'Me',
      type: 'call-reject',
      callId: callId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      readBy: { [uid]: true }
    }).then(function() {
      db.collection('chats').doc(chatId).update({
        lastMessage: text,
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSenderId: uid
      });
    }).catch(function() {});

    if (typeof showToast === 'function') showToast('Message sent', 'success');
  }

  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  window.CallRejectMessage = { show: showRejectWithMessage, quickReplies: quickReplies };
})();
