/* call-controller-events.js — Event listeners, call state machine, incoming call handling */
(function () {
  'use strict';

  var CC = window._CC;

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
            if (CC.state !== CC.STATES.IDLE) {
              CC.db().collection('calls').doc(change.doc.id).update({ status: 'missed' }).catch(function () {});
              return;
            }
            CC.incomingData = {
              callId: change.doc.id,
              type: call.type,
              fromUserId: call.fromUserId,
              fromUserName: call.fromUserName || 'Unknown',
              groupCall: call.groupCall,
              groupId: call.groupId,
              groupName: call.groupName,
              toUserId: call.toUserId
            };
            showIncomingCall(CC.incomingData);
            CC.broadcastToTabs('incoming-call', { callId: change.doc.id });
          }
          if (change.type === 'removed' || change.type === 'modified') {
            var cd = change.doc.data();
            if (cd && (cd.status === 'active' || cd.status === 'ended' || cd.status === 'rejected' || cd.status === 'missed' || cd.status === 'cancelled')) {
              hideIncomingCall();
              if (CC.incomingData && CC.incomingData.callId === change.doc.id) CC.incomingData = null;
            }
          }
        });
      });
    if (CC.bcChannel) {
      if (CC.incomingBcHandler) CC.bcChannel.removeEventListener('message', CC.incomingBcHandler);
      CC.incomingBcHandler = function (e) {
        if (e.data && (e.data.type === 'call-accepted' || e.data.type === 'call-ended')) {
          hideIncomingCall();
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
    if (av) av.textContent = name[0]?.toUpperCase() || '?';
    CC.show('incoming-call-overlay');
    CC.playSound('callRing');
    if (navigator.vibrate) navigator.vibrate([700, 250, 700, 250, 700, 250, 700, 250, 700]);
    CC.requestWake();
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
    if (CC.incomingTimeoutHandle) { clearTimeout(CC.incomingTimeoutHandle); CC.incomingTimeoutHandle = null; }
  }

  function setupIncomingAnswer(cId, type, fromUserName, groupCall, groupId, groupName) {
    CC.setState(CC.STATES.CONNECTING);
    CC.showCallScreen(type, fromUserName, (fromUserName || '?')[0].toUpperCase());
  }

  async function startVoiceCall() {
    if (CC.state !== CC.STATES.IDLE) return;
    if (!CC.uid() || !CC.db()) { CC.toast('Not signed in', 'error'); return; }
    var c = CC.chat();
    if (c && c.type === 'group') { startGroupCall('voice'); return; }
    if (c && c.uid) { await initiateOutgoingCall('voice', c); return; }
    CC.openCallPicker();
  }

  async function startVideoCall() {
    if (CC.state !== CC.STATES.IDLE) return;
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
      CC.playSound('outgoingCall');

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
      if (callSnapshot && callSnapshot.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(callSnapshot.offer));
        var answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await CC.db().collection('calls').doc(CC.callId).update({
          answer: { sdp: answer.sdp, type: answer.type },
          status: 'active'
        });
      }

      CC.listenCandidates(CC.callId);
      CC.listenStatus(CC.callId);
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

    CC.txt('call-status', dur > 0 ? 'Call ended' : 'Call ended');
    CC.cleanup();
    CC.setState(CC.STATES.ENDED);

    if (CC.callId && CC.db()) {
      var payload = { status: 'ended', endedAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (dur > 0) payload.duration = dur;
      CC.db().collection('calls').doc(CC.callId).update(payload).catch(function () {});
      CC.writeCallLog('outgoing', 'ended', dur > 0 ? dur * 1000 : null);
    }

    if (wasActive && dur > 0) {
      CC.playSound('callEnded');
      CC.toast('Call ended · ' + CC.fmtDur(dur), 'info');
    } else if (wasActive) {
      CC.playSound('callEnded');
    }

    CC.callId = null;
    CC.callStartTime = null;
    CC.releaseWake();
    setTimeout(function () { CC.setState(CC.STATES.IDLE); }, 300);
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

})();
