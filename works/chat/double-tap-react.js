/* ============================================================
   DOUBLE-TAP TO REACT — Double-tap message bubble to react
   with a ❤️ (like WhatsApp)
   ============================================================ */
'use strict';

(function() {
  let _lastTap = 0;
  let _lastTapMsgId = null;
  let _doubleTapDelay = 300;

  function _init() {
    document.addEventListener('pointerup', _onPointerUp, { passive: true });
  }

  function _onPointerUp(e) {
    const row = e.target.closest('.message-row');
    if (!row) return;
    const msgId = row.getAttribute('data-msg-id') || row.getAttribute('data-message-id');
    if (!msgId) return;
    const now = Date.now();
    if (msgId === _lastTapMsgId && (now - _lastTap) < _doubleTapDelay) {
      _lastTapMsgId = null;
      _lastTap = 0;
      _reactWithHeart(msgId, row);
    } else {
      _lastTapMsgId = msgId;
      _lastTap = now;
    }
  }

  function _reactWithHeart(msgId, row) {
    if (typeof window.addReaction === 'function') {
      window.addReaction(msgId, '❤️');
    } else if (typeof window.toggleReaction === 'function') {
      window.toggleReaction(msgId, '❤️');
    } else {
      const uid = (window.currentUser && window.currentUser.uid) || (window.App && window.App.currentUser && window.App.currentUser.uid);
      if (!uid) return;
      const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
      if (!db) return;
      const chatId = window.State && window.State.activeId;
      const chatType = window.State && window.State.activeType;
      if (!chatId || !msgId) return;
      const coll = chatType === 'group' ? 'groups' : 'chats';
      db.collection(coll).doc(chatId).collection('messages').doc(msgId).update({
        [`reactions.${uid}`]: firebase.firestore.FieldValue.arrayUnion('❤️')
      }).catch(function() {});
    }
    _showHeartAnimation(row);
  }

  function _showHeartAnimation(row) {
    const bubble = row.querySelector('.message-bubble');
    if (!bubble) return;
    const heart = document.createElement('div');
    heart.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);font-size:48px;z-index:9999;pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
    heart.textContent = '❤️';
    bubble.style.position = 'relative';
    bubble.appendChild(heart);
    requestAnimationFrame(() => {
      heart.style.transition = 'transform 0.3s cubic-bezier(0.17,0.67,0.21,1.69), opacity 0.3s ease 0.3s';
      heart.style.transform = 'translate(-50%,-50%) scale(1)';
      heart.style.opacity = '1';
      setTimeout(() => {
        heart.style.transform = 'translate(-50%,-50%) scale(1.3)';
        heart.style.opacity = '0';
        setTimeout(() => heart.remove(), 600);
      }, 400);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
