/* call-link.js — Shareable call links (create, join, manage) */
(function () {
  'use strict';

  async function createCallLink(type) {
    if (!window._CC || !window._CC.db() || !window._CC.uid()) {
      window._CC && window._CC.toast('Not signed in', 'error');
      return null;
    }
    type = type || 'video';
    var myUid = window._CC.uid();
    var myName = window._CC.me()?.displayName || 'User';
    try {
      var callRef = await window._CC.db().collection('calls').add({
        fromUserId: myUid,
        fromUserName: myName,
        fromUserPhoto: window._CC.me()?.photoURL || '',
        type: type,
        status: 'waiting',
        groupCall: false,
        isLinkCall: true,
        participants: [myUid],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      var callId = callRef.id;
      var link = window.location.origin + window.location.pathname + '?call=' + callId + '&type=' + type;
      return { callId: callId, link: link, type: type };
    } catch (err) {
      window._CC.toast('Failed to create call link', 'error');
      return null;
    }
  }

  async function joinCallLink(callId, type) {
    if (!window._CC || !window._CC.db() || !window._CC.uid()) {
      window._CC && window._CC.toast('Not signed in', 'error');
      return;
    }
    try {
      var callDoc = await window._CC.db().collection('calls').doc(callId).get();
      if (!callDoc.exists) {
        window._CC.toast('Call link expired or invalid', 'error');
        return;
      }
      var callData = callDoc.data();
      if (callData.status === 'ended' || callData.status === 'missed') {
        window._CC.toast('Call has ended', 'info');
        return;
      }
      if (callData.fromUserId === window._CC.uid()) {
        window._CC.toast('Waiting for others to join…', 'info');
        return;
      }
      var targetUser = {
        uid: callData.fromUserId,
        name: callData.fromUserName || 'Unknown',
        initials: (callData.fromUserName || '?')[0].toUpperCase(),
        type: 'direct',
        photoURL: callData.fromUserPhoto || ''
      };
      window._CC.callId = callId;
      window._CC.callType = type || callData.type;
      await window.initiateOutgoingCall(type || callData.type, targetUser);
    } catch (err) {
      window._CC.toast('Failed to join call', 'error');
    }
  }

  function showCallLinkModal(type) {
    var existing = document.getElementById('call-link-modal');
    if (existing) existing.remove();
    var typeLabel = type === 'video' ? 'Video' : 'Voice';
    var html = '<div id="call-link-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">' +
      '<div class="bg-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">' +
      '<div class="flex items-center justify-between mb-4">' +
      '<h3 class="text-on-surface font-bold text-lg">Share ' + typeLabel + ' Call Link</h3>' +
      '<button onclick="document.getElementById(\'call-link-modal\').remove()" class="w-8 h-8 rounded-full hover:bg-surface-variant/50 flex items-center justify-center"><span class="material-symbols-outlined text-on-surface-variant">close</span></button>' +
      '</div>' +
      '<p class="text-on-surface-variant text-sm mb-4">Anyone with this link can join the ' + typeLabel.toLowerCase() + ' call.</p>' +
      '<div id="call-link-loading" class="flex items-center justify-center p-6"><div class="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>' +
      '<div id="call-link-result" class="hidden">' +
      '<div class="bg-surface-variant rounded-xl p-3 mb-4 flex items-center gap-2">' +
      '<input id="call-link-url" type="text" readonly class="flex-1 bg-transparent text-on-surface text-sm outline-none truncate">' +
      '<button onclick="navigator.clipboard.writeText(document.getElementById(\'call-link-url\').value);window._CC&&window._CC.toast(\'Link copied!\',\'success\')" class="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 transition-colors"><span class="material-symbols-outlined text-lg">content_copy</span></button>' +
      '</div>' +
      '<div class="flex gap-3">' +
      '<button id="call-link-join" class="flex-1 py-2.5 bg-green-500 text-white rounded-full font-medium text-sm hover:bg-green-600 transition-colors">Join Now</button>' +
      '<button id="call-link-share" class="flex-1 py-2.5 bg-primary/15 text-primary rounded-full font-medium text-sm hover:bg-primary/25 transition-colors">Share Link</button>' +
      '</div></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    createCallLink(type).then(function (result) {
      var loading = document.getElementById('call-link-loading');
      var resultDiv = document.getElementById('call-link-result');
      var urlInput = document.getElementById('call-link-url');
      if (!result) {
        if (loading) loading.innerHTML = '<p class="text-red-500 text-sm">Failed to create link</p>';
        return;
      }
      if (loading) loading.classList.add('hidden');
      if (resultDiv) resultDiv.classList.remove('hidden');
      if (urlInput) urlInput.value = result.link;
      var joinBtn = document.getElementById('call-link-join');
      if (joinBtn) joinBtn.onclick = function () {
        document.getElementById('call-link-modal')?.remove();
        joinCallLink(result.callId, type);
      };
      var shareBtn = document.getElementById('call-link-share');
      if (shareBtn) {
        if (navigator.share) {
          shareBtn.onclick = function () {
            navigator.share({ title: typeLabel + ' Call', text: 'Join my ' + typeLabel.toLowerCase() + ' call', url: result.link }).catch(function () {});
          };
        } else {
          shareBtn.onclick = function () {
            navigator.clipboard.writeText(result.link).then(function () {
              window._CC.toast('Link copied!', 'success');
            });
          };
        }
      }
    });
  }

  function checkForCallLinkParam() {
    var params = new URLSearchParams(window.location.search);
    var callId = params.get('call');
    var callType = params.get('type');
    if (callId) {
      setTimeout(function () {
        joinCallLink(callId, callType || 'video');
        window.history.replaceState({}, '', window.location.pathname);
      }, 2000);
    }
  }

  window._CallLink = {
    createCallLink: createCallLink,
    joinCallLink: joinCallLink,
    showCallLinkModal: showCallLinkModal,
    checkForCallLinkParam: checkForCallLinkParam
  };
  window.showCallLinkModal = showCallLinkModal;

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(checkForCallLinkParam, 500);
  } else {
    window.addEventListener('load', function () { setTimeout(checkForCallLinkParam, 500); });
  }

})();
