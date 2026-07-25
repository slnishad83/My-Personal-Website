/* call-controller-events.js — Event listeners, call state machine, incoming call handling, call waiting, swipe */
(function () {
  'use strict';

  var CC = window._CC;
  var _waitingIncoming = null;
  var _swipeState = null;
  var _outgoingRingtoneInterval = null;
  var _lastCallAttemptTime = 0;

  function _startOutgoingRingtone() {
    _stopOutgoingRingtone();
    CC.playSound('outgoingCall');
    _outgoingRingtoneInterval = setInterval(function () { CC.playSound('outgoingCall'); }, 3000);
  }
  function _stopOutgoingRingtone() {
    if (_outgoingRingtoneInterval) { clearInterval(_outgoingRingtoneInterval); _outgoingRingtoneInterval = null; }
  }

  function listenIncomingCalls() {
    if (!CC.db() || !CC.uid()) return;
    if (CC.unsubIncoming) CC.unsubIncoming();
    var myUid = CC.uid();
    CC.unsubIncoming = CC.db().collection('calls')
      .where('toUserId', '==', myUid)
      .where('status', '==', 'ringing')
      .onSnapshot(function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === 'added') {
            var call = change.doc.data();
            if (call.fromUserId === myUid) return;
            var incomingPayload = {
              callId: change.doc.id,
              type: call.type,
              fromUserId: call.fromUserId,
              fromUserName: call.fromUserName || 'Unknown',
              fromUserPhoto: call.fromUserPhoto || '',
              groupCall: call.groupCall,
              groupId: call.groupId,
              groupName: call.groupName,
              toUserId: call.toUserId
            };
            if (CC.state !== CC.STATES.IDLE) {
              if (CC.state === CC.STATES.ACTIVE || CC.state === CC.STATES.CONNECTING) {
                _waitingIncoming = incomingPayload;
                _showCallWaitingUI(incomingPayload);
              } else if (CC.state === CC.STATES.RINGING) {
                CC.db().collection('calls').doc(change.doc.id).update({ status: 'busy' }).catch(function () {});
              } else {
                CC.db().collection('calls').doc(change.doc.id).update({ status: 'missed' }).catch(function () {});
              }
              return;
            }
            CC.incomingData = incomingPayload;
            showIncomingCall(CC.incomingData);
            CC.broadcastToTabs('incoming-call', { callId: change.doc.id });
          }
          if (change.type === 'removed' || change.type === 'modified') {
            var cd = change.doc.data();
            if (cd && (cd.status === 'active' || cd.status === 'ended' || cd.status === 'rejected' || cd.status === 'missed' || cd.status === 'cancelled')) {
              hideIncomingCall();
              _hideCallWaitingUI();
              if (CC.incomingData && CC.incomingData.callId === change.doc.id) CC.incomingData = null;
              if (_waitingIncoming && _waitingIncoming.callId === change.doc.id) _waitingIncoming = null;
            }
          }
        });
      });
    if (CC.bcChannel) {
      if (CC.incomingBcHandler) CC.bcChannel.removeEventListener('message', CC.incomingBcHandler);
      CC.incomingBcHandler = function (e) {
        if (e.data && (e.data.type === 'call-accepted' || e.data.type === 'call-ended')) {
          hideIncomingCall();
          _hideCallWaitingUI();
        }
      };
      CC.bcChannel.addEventListener('message', CC.incomingBcHandler);
    }
  }

  function showIncomingCall(data) {
    var name = data.fromUserName || 'Unknown';
    CC.txt('incoming-call-name', name);
    var isGroup = data.groupCall === true;
    CC.txt('incoming-call-type', (isGroup ? '👥 ' : '') + (data.type === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'));
    var av = CC.$('incoming-call-avatar');
    if (av) {
      if (data.fromUserPhoto) {
        av.innerHTML = '<img src="' + CC.escHtml(data.fromUserPhoto) + '" class="w-full h-full rounded-full object-cover" alt="">';
        var _avImg = av.querySelector('img');
        if (_avImg) {
          _avImg.addEventListener('error', function () {
            av.textContent = name[0]?.toUpperCase() || '?';
            av.className = 'w-24 h-24 rounded-full border-4 border-green-500/30 flex items-center justify-center text-4xl bg-white/10';
          }, { once: true });
        }
        av.className = 'w-24 h-24 rounded-full border-4 border-green-500/30 overflow-hidden bg-white/10';
      } else {
        av.textContent = name[0]?.toUpperCase() || '?';
        av.className = 'w-24 h-24 rounded-full border-4 border-green-500/30 flex items-center justify-center text-4xl bg-white/10';
      }
    }
    CC.show('incoming-call-overlay');
    CC.playSound('callRing');
    if (typeof window.AppHaptics !== 'undefined' && typeof window.AppHaptics.vibrate === 'function') { window.AppHaptics.vibrate([700, 250, 700, 250, 700, 250, 700, 250, 700]); } else if (navigator.vibrate) navigator.vibrate([700, 250, 700, 250, 700, 250, 700, 250, 700]);
    CC.requestWake();
    _setupSwipeToAnswer();
    CC.incomingTimeoutHandle = setTimeout(function () {
      if (CC.incomingData && CC.incomingData.callId === data.callId) {
        hideIncomingCall();
        if (CC.db()) {
          CC.db().collection('calls').doc(data.callId).update({ status: 'missed' }).catch(function () {});
        }
        CC.incomingData = null;
      }
    }, CC.CALL_TIMEOUT_MS);
  }

  function hideIncomingCall() {
    CC.hide('incoming-call-overlay');
    CC.stopExistingRingtone();
    _teardownSwipeToAnswer();
    if (CC.incomingTimeoutHandle) { clearTimeout(CC.incomingTimeoutHandle); CC.incomingTimeoutHandle = null; }
  }

  function _showCallWaitingUI(data) {
    var existing = CC.$('call-waiting-bar');
    if (existing) existing.remove();
    var name = data.fromUserName || 'Unknown';
    var typeLabel = data.type === 'video' ? 'Video' : 'Voice';
    var html = '<div id="call-waiting-bar" class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-surface border border-outline/20 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 max-w-sm w-[calc(100%-2rem)] cursor-pointer hover:bg-surface-variant/50 transition-colors">' +
      '<div class="w-10 h-10 rounded-full bg-yellow-500/15 text-yellow-500 flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-xl">phone_in_talk</span></div>' +
      '<div class="flex-1 min-w-0">' +
      '<p class="text-on-surface font-semibold text-sm truncate">' + CC.escHtml(name) + '</p>' +
      '<p class="text-on-surface-variant text-xs">' + typeLabel + ' Call · Waiting…</p>' +
      '</div>' +
      '<div class="flex items-center gap-2">' +
      '<button id="cw-decline" class="min-w-[44px] min-h-[44px] rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors" title="Decline"><span class="material-symbols-outlined text-white" style="font-size:18px">call_end</span></button>' +
      '<button id="cw-switch" class="min-w-[44px] min-h-[44px] rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors" title="Switch call"><span class="material-symbols-outlined text-white" style="font-size:18px">swap_horiz</span></button>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    var declineBtn = CC.$('cw-decline');
    if (declineBtn) declineBtn.onclick = function (e) {
      e.stopPropagation();
      if (data.callId && CC.db()) CC.db().collection('calls').doc(data.callId).update({ status: 'rejected' }).catch(function () {});
      _hideCallWaitingUI();
      _waitingIncoming = null;
    };
    var switchBtn = CC.$('cw-switch');
    if (switchBtn) switchBtn.onclick = function (e) {
      e.stopPropagation();
      _switchToWaitingCall();
    };
    var bar = CC.$('call-waiting-bar');
    if (bar) bar.onclick = function () { _switchToWaitingCall(); };
  }

  function _hideCallWaitingUI() {
    var bar = CC.$('call-waiting-bar');
    if (bar) bar.remove();
  }

  function _switchToWaitingCall() {
    if (!_waitingIncoming) return;
    var currentCallId = CC.callId;
    var currentDuration = CC.callStartTime ? Math.floor((Date.now() - CC.callStartTime) / 1000) : 0;
    window.endCall();
    _hideCallWaitingUI();
    CC.incomingData = _waitingIncoming;
    _waitingIncoming = null;
    if (CC.incomingData.groupCall) {
      acceptGroupCall(CC.incomingData);
    } else {
      acceptCall();
    }
  }

  function _setupSwipeToAnswer() {
    var overlay = CC.$('incoming-call-overlay');
    if (!overlay || overlay.dataset.swipeInit) return;
    overlay.dataset.swipeInit = '1';
    var swipeZone = overlay.querySelector('.relative') || overlay;
    var startX = 0, currentX = 0, isDragging = false;
    var answerThreshold = 100;
    var declineThreshold = -100;
    var swipeIndicator = document.createElement('div');
    swipeIndicator.id = 'swipe-indicator';
    swipeIndicator.className = 'absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40 text-xs pointer-events-none transition-opacity';
    swipeIndicator.innerHTML = '<span class="material-symbols-outlined text-2xl animate-bounce">swipe_up</span><span>Swipe right to answer · left to decline</span>';
    swipeIndicator.style.opacity = '0';
    swipeIndicator.style.transition = 'opacity 0.3s';
    overlay.appendChild(swipeIndicator);
    var answerIcon = document.createElement('div');
    answerIcon.className = 'absolute top-1/2 -translate-y-1/2 right-8 text-green-500 opacity-0 transition-opacity pointer-events-none';
    answerIcon.innerHTML = '<span class="material-symbols-outlined text-4xl">call</span>';
    answerIcon.style.opacity = '0';
    overlay.appendChild(answerIcon);
    var declineIcon = document.createElement('div');
    declineIcon.className = 'absolute top-1/2 -translate-y-1/2 left-8 text-red-500 opacity-0 transition-opacity pointer-events-none';
    declineIcon.innerHTML = '<span class="material-symbols-outlined text-4xl">call_end</span>';
    declineIcon.style.opacity = '0';
    overlay.appendChild(declineIcon);
    function onTouchStart(e) {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      currentX = 0;
      swipeIndicator.style.opacity = '1';
    }
    function onTouchMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      var x = e.touches ? e.touches[0].clientX : e.clientX;
      currentX = x - startX;
      var progress = Math.min(1, Math.abs(currentX) / answerThreshold);
      if (currentX > 0) {
        answerIcon.style.opacity = String(progress);
        declineIcon.style.opacity = '0';
      } else {
        declineIcon.style.opacity = String(progress);
        answerIcon.style.opacity = '0';
      }
    }
    function onTouchEnd() {
      if (!isDragging) return;
      isDragging = false;
      swipeIndicator.style.opacity = '0';
      answerIcon.style.opacity = '0';
      declineIcon.style.opacity = '0';
      if (currentX > answerThreshold) {
        acceptCall();
      } else if (currentX < declineThreshold) {
        declineCall();
      }
    }
    swipeZone.addEventListener('touchstart', onTouchStart, { passive: true });
    swipeZone.addEventListener('touchmove', onTouchMove, { passive: false });
    swipeZone.addEventListener('touchend', onTouchEnd);
    swipeZone.addEventListener('mousedown', onTouchStart);
    swipeZone.addEventListener('mousemove', onTouchMove);
    swipeZone.addEventListener('mouseup', onTouchEnd);
    overlay._swipeCleanup = function () {
      swipeZone.removeEventListener('touchstart', onTouchStart);
      swipeZone.removeEventListener('touchmove', onTouchMove);
      swipeZone.removeEventListener('touchend', onTouchEnd);
      swipeZone.removeEventListener('mousedown', onTouchStart);
      swipeZone.removeEventListener('mousemove', onTouchMove);
      swipeZone.removeEventListener('mouseup', onTouchEnd);
      if (swipeIndicator.parentNode) swipeIndicator.remove();
      if (answerIcon.parentNode) answerIcon.remove();
      if (declineIcon.parentNode) declineIcon.remove();
    };
  }

  function _teardownSwipeToAnswer() {
    var overlay = CC.$('incoming-call-overlay');
    if (overlay && overlay._swipeCleanup) {
      overlay._swipeCleanup();
      delete overlay._swipeCleanup;
      delete overlay.dataset.swipeInit;
    }
  }

  async function startVoiceCall() {
    if (CC.state !== CC.STATES.IDLE) return;
    if (Date.now() - _lastCallAttemptTime < 3000) { CC.toast('Please wait before trying again', 'info'); return; }
    _lastCallAttemptTime = Date.now();
    if (!CC.uid() || !CC.db()) { CC.toast('Not signed in', 'error'); return; }
    var c = CC.chat();
    if (c && c.type === 'group') { startGroupCall('voice'); return; }
    if (c && c.uid) { await initiateOutgoingCall('voice', c); return; }
    CC.openCallPicker();
  }

  async function startVideoCall() {
    if (CC.state !== CC.STATES.IDLE) return;
    if (Date.now() - _lastCallAttemptTime < 3000) { CC.toast('Please wait before trying again', 'info'); return; }
    _lastCallAttemptTime = Date.now();
    if (!CC.uid() || !CC.db()) { CC.toast('Not signed in', 'error'); return; }
    var c = CC.chat();
    if (c && c.type === 'group') { startGroupCall('video'); return; }
    if (c && c.uid) { await initiateOutgoingCall('video', c); return; }
    CC.openCallPicker();
  }

  async function initiateOutgoingCall(type, targetChat) {
    var myUid = CC.uid();
    var otherUid = targetChat.uid;
    if (!otherUid) return;

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(type === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) return;
    }

    CC.setState(CC.STATES.CONNECTING);
    CC.callId = null;
    CC.callType = type;
    CC._outgoingAvatar = targetChat.photoURL || '';
    CC.showCallScreen(type, targetChat.name, targetChat.initials);

    try {
      await CC.getMedia(type);
      var rtcConfig = await getRtcConfig();
      peerConnection = new RTCPeerConnection(rtcConfig);
      CC.addLocalTracks(localCallStream);
      CC.setupPeerConnection(peerConnection);

      var offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      var callRef = await CC.db().collection('calls').add({
        fromUserId: myUid,
        fromUserName: CC.me()?.displayName || 'User',
        fromUserPhoto: CC.me()?.photoURL || '',
        toUserId: otherUid,
        type: type,
        status: 'ringing',
        groupCall: false,
        offer: { sdp: offer.sdp, type: offer.type },
        participants: [myUid, otherUid],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      CC.callId = callRef.id;
      App._activeCallId = callRef.id;
      CC.listenAnswer(CC.callId);
      CC.listenCandidates(CC.callId);
      CC.listenStatus(CC.callId);
      CC.requestWake();
      CC.startHeartbeat(CC.callId);
      _startOutgoingRingtone();

      CC.timeoutHandle = setTimeout(function () {
        if (CC.callId && CC.state !== CC.STATES.IDLE && CC.state !== CC.STATES.ACTIVE) {
          CC.txt('call-status', 'No answer');
          endCall();
        }
      }, CC.CALL_TIMEOUT_MS);

    } catch (err) {
      console.error('Call start error:', err);
      CC.toast('Could not start call: ' + (err.name === 'NotAllowedError' ? 'Camera/mic permission denied' : err.message), 'error');
      CC.cleanup();
      CC.setState(CC.STATES.IDLE);
    }
  }

  async function acceptCall() {
    if (!CC.incomingData) return;
    hideIncomingCall();
    _hideCallWaitingUI();
    CC.broadcastToTabs('call-accepted', { callId: CC.incomingData.callId });

    if (CC.incomingData.groupCall) {
      acceptGroupCall(CC.incomingData);
      CC.incomingData = null;
      return;
    }

    var myUid = CC.uid();
    if (!myUid || !CC.db()) return;

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(CC.incomingData.type === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) { CC.incomingData = null; return; }
    }

    CC.callId = CC.incomingData.callId;
    CC.callType = CC.incomingData.type;
    CC._outgoingAvatar = CC.incomingData.fromUserPhoto || '';
    var fromName = CC.incomingData.fromUserName;

    CC.setState(CC.STATES.CONNECTING);
    CC.showCallScreen(CC.incomingData.type, fromName, (fromName || '?')[0].toUpperCase());

    try {
      await CC.getMedia(CC.incomingData.type);
      var rtcConfig = await getRtcConfig();
      peerConnection = new RTCPeerConnection(rtcConfig);
      CC.addLocalTracks(localCallStream);
      CC.setupPeerConnection(peerConnection);

      var callDoc = await CC.db().collection('calls').doc(CC.callId).get();
      var callSnapshot = callDoc.data();
      CC.listenCandidates(CC.callId);
      CC.listenStatus(CC.callId);
      CC.listenOffer(CC.callId);
      if (callSnapshot && callSnapshot.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(callSnapshot.offer));
        var answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await CC.db().collection('calls').doc(CC.callId).update({
          answer: { sdp: answer.sdp, type: answer.type },
          status: 'active'
        });
      }

      CC.requestWake();
      CC.startHeartbeat(CC.callId);

    } catch (err) {
      console.error('Accept call error:', err);
      CC.toast('Could not connect call', 'error');
      CC.cleanup();
      CC.setState(CC.STATES.IDLE);
    }

    CC.incomingData = null;
  }

  function declineCall() {
    CC.stopExistingRingtone();
    hideIncomingCall();
    _hideCallWaitingUI();
    if (CC.incomingData) {
      CC.broadcastToTabs('call-ended', { callId: CC.incomingData.callId });
      if (CC.db() && CC.incomingData.callId) {
        CC.db().collection('calls').doc(CC.incomingData.callId).update({ status: 'rejected' }).catch(function () {});
      }
      CC.playSound('callDeclined');
      CC.incomingData = null;
    }
  }

  function endCall() {
    var wasActive = CC.state === CC.STATES.ACTIVE;
    var dur = CC.callStartTime ? Math.floor((Date.now() - CC.callStartTime) / 1000) : 0;
    var endDirection = CC.incomingData ? 'incoming' : 'outgoing';
    var remoteName = CC.$('call-name')?.textContent || 'Unknown';
    var remoteAvatar = CC._outgoingAvatar || '';
    var savedCallId = CC.callId;
    var savedRemoteUid = CC.incomingData?.fromUserId || '';

    CC.txt('call-status', dur > 0 ? 'Call ended' : 'No answer');
    _stopOutgoingRingtone();
    CC.cleanup();
    CC.setState(CC.STATES.ENDED);

    if (savedCallId && CC.db()) {
      var payload = { status: 'ended', endedAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (dur > 0) payload.duration = dur;
      CC.db().collection('calls').doc(savedCallId).update(payload).catch(function () {});
      CC.writeCallLog(endDirection, 'ended', dur > 0 ? dur * 1000 : null);
    }

    if (wasActive) {
      CC.playSound('callEnded');
      CC.showCallEndScreen(endDirection, dur, CC.callType, remoteName, remoteAvatar);
    } else {
      CC.playSound('callEnded');
    }

    CC.callId = null;
    CC.callStartTime = null;
    CC._outgoingAvatar = '';
    CC.releaseWake();
    if (typeof window.Presence !== 'undefined' && typeof window.Presence.setInCall === 'function') window.Presence.setInCall(false);
    _sendMissedCallNotification(endDirection, dur, remoteName, savedRemoteUid, savedCallId);
    CC.setState(CC.STATES.IDLE);
  }

  async function _sendMissedCallNotification(direction, duration, remoteName, remoteUid, callIdForNotif) {
    if (direction !== 'incoming' || duration > 0) return;
    if (!CC.db()) return;
    try {
      var targetUid = remoteUid || '';
      if (!targetUid) return;
      var tokenDoc = await CC.db().collection('users').doc(targetUid).get();
      var userData = tokenDoc.data();
      if (userData && userData.fcmToken) {
        var functions = firebase.app().functions('asia-south1');
        var sendNotification = functions.httpsCallable('sendPushNotification');
        await sendNotification({
          token: userData.fcmToken,
          title: 'Missed call',
          body: 'Missed call from ' + (remoteName || 'Unknown'),
          data: { type: 'missed_call', callId: callIdForNotif || '' }
        });
      }
    } catch (_) {}
  }

  async function startGroupCall(type) {
    var c = CC.chat();
    if (!c || !CC.db() || !CC.uid()) return;
    if (c.type !== 'group') return;
    var myUid = CC.uid();
    var memberIds = (c.members || []).filter(function (m) { return m && m !== myUid; });
    if (!memberIds.length) { CC.toast('No other members to call', 'info'); return; }

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(type === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) return;
    }

    CC.callType = type;
    activeCallMode = 'group';
    CC.showCallScreen(type, c.name, c.initials || 'G');
    CC.txt('call-quality-text', type === 'video' ? 'HD Group Video' : 'HD Group Voice');
    CC.txt('call-status', 'Calling ' + memberIds.length + ' people…');

    try {
      await CC.getMedia(type);
      var allParticipants = [myUid].concat(memberIds);
      var callRef = await CC.db().collection('calls').add({
        fromUserId: myUid,
        fromUserName: CC.me()?.displayName || 'User',
        fromUserPhoto: CC.me()?.photoURL || '',
        type: type,
        status: 'ringing',
        groupCall: true,
        groupId: c.id,
        groupName: c.name,
        participantIds: allParticipants,
        offer: null,
        participants: allParticipants,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      CC.callId = callRef.id;
      App._activeCallId = callRef.id;
      if (typeof listenForGroupCallParticipants === 'function') listenForGroupCallParticipants(CC.callId, type);
      CC.listenStatus(CC.callId);
      CC.requestWake();
      CC.startHeartbeat(CC.callId);
      CC.timeoutHandle = setTimeout(function () {
        if (CC.callId && CC.state !== CC.STATES.ACTIVE && CC.state !== CC.STATES.IDLE) {
          CC.txt('call-status', 'No answer');
          endCall();
        }
      }, CC.CALL_TIMEOUT_MS);
    } catch (err) {
      console.error('Group call error:', err);
      CC.toast('Could not start group call: ' + err.message, 'error');
      CC.cleanup();
      CC.setState(CC.STATES.IDLE);
    }
  }

  function acceptGroupCall(data) {
    if (typeof window._handleAcceptedGroupCall === 'function') {
      window._handleAcceptedGroupCall(data);
    }
  }

  function init() {
    listenIncomingCalls();
    CC.initBubbleDrag();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 0); });
  }

  window.startVoiceCall = startVoiceCall;
  window.startVideoCall = startVideoCall;
  window.acceptCall = acceptCall;
  window.declineCall = declineCall;
  window.endCall = endCall;
  window.initiateOutgoingCall = initiateOutgoingCall;

  if (typeof window.startGroupVoiceCall !== 'function') {
    window.startGroupVoiceCall = function () { startGroupCall('voice'); };
  }
  if (typeof window.startGroupVideoCall !== 'function') {
    window.startGroupVideoCall = function () { startGroupCall('video'); };
  }

  window._stopOutgoingRingtone = _stopOutgoingRingtone;

})();
