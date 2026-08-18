/* ============================================================
   TYPING INDICATOR — Shows "typing..." to other users
   Writes presence to Firestore, reads peer presence.
   ============================================================ */
'use strict';

(function() {
  const _debounceMs = 3000;
  const _heartbeatMs = 5000;
  let _typingTimer = null;
  let _rendered = false;

  function _uid() {
    return (window.currentUser && window.currentUser.uid) ||
      (window.App && window.App.auth && window.App.auth.currentUser && window.App.auth.currentUser.uid) || null;
  }

  function _chatId() {
    return window.currentChat && window.currentChat.id
      ? window.currentChat.id
      : (window.currentChat || null);
  }

  function _chatType() {
    return window.currentChatType || 'direct';
  }

  function _isGroup() {
    return _chatType() === 'group';
  }

  function _peerUid() {
    const chatId = _chatId();
    if (!chatId || _isGroup()) return null;
    const parts = String(chatId).split('_');
    const me = _uid();
    if (!me || parts.length < 2) return null;
    return parts[0] === me ? parts[1] : parts[0];
  }

  function startTyping() {
    const me = _uid();
    const chatId = _chatId();
    if (!me || !chatId) return;
    const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
    if (!db) return;
    const coll = _isGroup() ? 'groups' : 'chats';
    db.collection(coll).doc(chatId).collection('presence').doc(me).set({
      typing: true,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(function() {});
    _scheduleStop();
  }

  function stopTyping() {
    const me = _uid();
    const chatId = _chatId();
    if (!me || !chatId) return;
    const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
    if (!db) return;
    const coll = _isGroup() ? 'groups' : 'chats';
    db.collection(coll).doc(chatId).collection('presence').doc(me).set({
      typing: false,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(function() {});
  }

  function _scheduleStop() {
    if (_typingTimer) clearTimeout(_typingTimer);
    _typingTimer = setTimeout(stopTyping, _debounceMs);
  }

  function listenForTyping() {
    const me = _uid();
    const chatId = _chatId();
    if (!me || !chatId) return;
    const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
    if (!db) return;
    const coll = _isGroup() ? 'groups' : 'chats';
    const ref = db.collection(coll).doc(chatId).collection('presence');
    ref.onSnapshot(function(snap) {
      const typers = [];
      snap.forEach(function(doc) {
        const d = doc.data();
        if (doc.id !== me && d.typing) {
          typers.push(d.senderName || d.displayName || 'Someone');
        }
      });
      _renderTyping(typers);
    });
  }

  function _renderTyping(typers) {
    const container = document.getElementById('typing-indicator') || document.getElementById('typingIndicator');
    if (!container) {
      if (_rendered && typers.length === 0) _rendered = false;
      return;
    }
    if (!typers.length) {
      container.innerHTML = '';
      container.style.display = 'none';
      _rendered = false;
      return;
    }
    _rendered = true;
    const text = typers.length === 1
      ? `${typers[0]} is typing`
      : typers.length === 2
        ? `${typers[0]} and ${typers[1]} are typing`
        : `${typers[0]} and ${typers.length - 1} others are typing`;
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 16px;font-size:13px;color:var(--primary,#00a884);font-style:italic;">
        <div class="typing-dots" style="display:flex;gap:3px;">
          <span style="width:6px;height:6px;border-radius:50%;background:var(--primary,#00a884);animation:typingBounce 1.2s infinite;animation-delay:0s"></span>
          <span style="width:6px;height:6px;border-radius:50%;background:var(--primary,#00a884);animation:typingBounce 1.2s infinite;animation-delay:0.2s"></span>
          <span style="width:6px;height:6px;border-radius:50%;background:var(--primary,#00a884);animation:typingBounce 1.2s infinite;animation-delay:0.4s"></span>
        </div>
        <span>${esc(text)}</span>
      </div>`;
    container.style.display = 'block';
    _injectStyles();
  }

  function _injectStyles() {
    if (document.getElementById('typing-indicator-css')) return;
    const style = document.createElement('style');
    style.id = 'typing-indicator-css';
    style.textContent = '@keyframes typingBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}';
    document.head.appendChild(style);
  }

  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function _wireInput() {
    const msgInput = document.getElementById('msg-input') || document.getElementById('messageInput');
    if (!msgInput || msgInput._typingWired) return;
    msgInput._typingWired = true;
    msgInput.addEventListener('input', function() {
      if (msgInput.value.trim()) startTyping();
      else stopTyping();
    });
  }

  window.TypingIndicator = { startTyping, stopTyping, listenForTyping };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { _wireInput(); listenForTyping(); });
  } else {
    _wireInput();
    listenForTyping();
  }
})();
