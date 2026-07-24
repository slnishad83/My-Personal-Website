// Screen Share in Call — enhanced screen sharing with remote notification
(function() {
  'use strict';

  function _notifyScreenShareStart() {
    if (!App.db || !App.currentChat || !App.auth?.currentUser) return;
    const chatId = App.currentChat.id;
    const isGroup = App.currentChat.type === 'group';

    try {
      const data = {
        senderId: App.auth.currentUser.uid,
        senderName: App.currentUser?.displayName || App.auth.currentUser.email || 'User',
        text: '🖥️ Started screen sharing',
        type: 'system',
        systemType: 'screen_share_start',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (isGroup) data.groupId = chatId;
      else { data.directId = chatId; data.participants = [App.auth.currentUser.uid, App.currentChat.uid || '']; }

      App.db.collection('messages').add(data).catch(() => {});
    } catch(_) {}

    showToast('Screen sharing active — others can see your screen', 'success');
  }

  function _notifyScreenShareEnd() {
    if (!App.db || !App.currentChat || !App.auth?.currentUser) return;
    const chatId = App.currentChat.id;
    const isGroup = App.currentChat.type === 'group';

    try {
      const data = {
        senderId: App.auth.currentUser.uid,
        senderName: App.currentUser?.displayName || App.auth.currentUser.email || 'User',
        text: '🖥️ Stopped screen sharing',
        type: 'system',
        systemType: 'screen_share_end',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (isGroup) data.groupId = chatId;
      else { data.directId = chatId; data.participants = [App.auth.currentUser.uid, App.currentChat.uid || '']; }

      App.db.collection('messages').add(data).catch(() => {});
    } catch(_) {}
  }

  function _handleScreenShareEnd() {
    var stream = (typeof CC !== 'undefined' && CC.screenShareStream) || null;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.addEventListener('ended', () => {
        _notifyScreenShareEnd();
        try {
          const icon = document.getElementById('screenshare-icon');
          if (icon) icon.textContent = 'screen_share';
        } catch(_) {}
      });
    }
  }

  function _enhanceScreenShareButton() {
    const btn = document.getElementById('btn-screenshare');
    if (!btn) return;
    btn.title = 'Share your screen with the other person';
    btn.setAttribute('aria-label', 'Share screen');
  }

  function _patchToggleScreenShare() {
    const orig = window.toggleScreenShare;
    if (typeof orig !== 'function') return;

    window.toggleScreenShare = async function() {
      if (_screenShareStream) {
        _notifyScreenShareEnd();
        return orig();
      }

      try {
        await orig();
        if (_screenShareStream) {
          _notifyScreenShareStart();
          _handleScreenShareEnd();
        }
      } catch(e) {
        console.warn('Screen share error:', e);
      }
    };
  }

  function init() {
    _enhanceScreenShareButton();
    _patchToggleScreenShare();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
