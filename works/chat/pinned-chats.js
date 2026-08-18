/* ============================================================
   PINNED CHATS — Pin/unpin chats in chat list
   Pinned chats appear at top of chat list with 📌 icon
   ============================================================ */
'use strict';

(function() {
  function _uid() {
    return (window.currentUser && window.currentUser.uid) ||
      (window.App && window.App.auth && window.App.auth.currentUser && window.App.auth.currentUser.uid) || null;
  }

  function _db() {
    return (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
  }

  function pinChat(chatId) {
    const uid = _uid();
    const db = _db();
    if (!uid || !db || !chatId) return;
    db.collection('userPins').doc(uid).set({
      [chatId]: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(function() {});
    showToast('Chat pinned');
  }

  function unpinChat(chatId) {
    const uid = _uid();
    const db = _db();
    if (!uid || !db || !chatId) return;
    const update = {};
    update[chatId] = firebase.firestore.FieldValue.delete();
    db.collection('userPins').doc(uid).update(update).catch(function() {});
    showToast('Chat unpinned');
  }

  function isPinned(chatId, pinnedMap) {
    return !!(pinnedMap && pinnedMap[chatId]);
  }

  function renderPinIcon(chatId, pinnedMap) {
    if (!isPinned(chatId, pinnedMap)) return '';
    return '<span class="pin-icon" style="font-size:12px;opacity:0.5;margin-left:4px" title="Pinned">📌</span>';
  }

  function sortChatsByPinned(chats, pinnedMap) {
    if (!pinnedMap || !Object.keys(pinnedMap).length) return chats;
    const pinned = [];
    const unpinned = [];
    chats.forEach(function(c) {
      if (pinnedMap[c.id]) pinned.push(c);
      else unpinned.push(c);
    });
    pinned.sort(function(a, b) {
      const ta = pinnedMap[a.id] || 0;
      const tb = pinnedMap[b.id] || 0;
      return (typeof ta === 'number' ? ta : 0) - (typeof tb === 'number' ? tb : 0);
    });
    return pinned.concat(unpinned);
  }

  function addPinOption(chatId, pinnedMap) {
    const isPin = !isPinned(chatId, pinnedMap);
    return `<button onclick="window.PinnedChats.${isPin ? 'pin' : 'unpin'}('${chatId}');this.closest('.context-menu,.dropdown-menu')?.remove()" style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;border:none;background:none;cursor:pointer;font-size:14px;text-align:left;color:var(--text)">
      <span style="font-size:16px">${isPin ? '📌' : '📍'}</span>${isPin ? 'Pin chat' : 'Unpin chat'}
    </button>`;
  }

  function showToast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg, 'success');
  }

  window.PinnedChats = { pinChat, unpinChat, isPinned, renderPinIcon, sortChatsByPinned, addPinOption, pin: pinChat, unpin: unpinChat };
})();
