/* group-call-events.js — Participant join/leave, call events, state */
(function () {
  'use strict';

  var GC = window._GC;
  var CC = window._CC;

  async function startGroupCall(participantIds, type) {
    GC._myUid = GC._uid();
    if (!GC._myUid || !GC._firestore()) { GC._toast('Not signed in', 'error'); return; }
    if (GC._isInGroupCall()) { GC._toast('Already in a call', 'info'); return; }
    var pid = Array.isArray(participantIds) ? participantIds.filter(function (p) { return p && p !== GC._myUid; }) : [];
    var myDetails = GC._getMyDetails();
    if (type !== 'voice' && type !== 'video') type = 'voice';
    GC._currentCallType = type;
    GC._isInitiator = true;

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(type === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) return;
    }

    try {
      var constraints = { audio: true };
      if (type === 'video') {
        constraints.video = {
          facingMode: CC.getPreferredCameraFacingMode() || 'user',
          width: { ideal: window.isTablet ? 1920 : 1280 },
          height: { ideal: window.isTablet ? 1080 : 720 }
        };
      }
      CC.setLocalStream(await navigator.mediaDevices.getUserMedia(constraints));
    } catch (err) {
      GC._toast('Could not access camera/mic: ' + (err.name === 'NotAllowedError' ? 'Permission denied' : err.message), 'error');
      return;
    }

    var participantDetails = {};
    participantDetails[GC._myUid] = {
      name: myDetails.name,
      avatar: myDetails.avatar,
      isMuted: !!CC.isMicMuted(),
      isVideoOff: !!CC.isCameraOff(),
      joinedAt: Date.now()
    };
    GC._participantJoinTime.set(GC._myUid, Date.now());

    var allParticipantIds = [GC._myUid].concat(pid);
    var callRef;
    try {
      callRef = await GC._firestore().collection('groupCalls').add({
        initiatorId: GC._myUid,
        type: type,
        status: 'ringing',
        participantIds: allParticipantIds,
        participantDetails: participantDetails,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        screenShareUid: null
      });
    } catch (err) {
      GC._toast('Failed to create group call: ' + err.message, 'error');
      var _fcs = CC.getLocalStream();
      if (_fcs) { _fcs.getTracks().forEach(function (t) { t.stop(); }); }
      CC.setLocalStream(null);
      return;
    }

    GC._currentCallId = callRef.id;
    window.activeGroupCallParticipants = [{ uid: GC._myUid, name: myDetails.name, avatar: myDetails.avatar, isMuted: false, isVideoOff: false }];
    App.callActive = true;
    App._activeCallId = GC._currentCallId;

    GC._ensureGridContainer();
    GC._renderGrid();
    GC._showGroupCallScreen();
    GC._listenToCallDoc(GC._currentCallId);
    GC._listenToSignaling(GC._currentCallId);
    GC._listenToIncomingCandidates(GC._currentCallId);
    GC._listenToInvites(GC._currentCallId);
    GC._startSpeakerDetection();

    pid.forEach(function (targetUid) {
      GC._sendInvite(GC._currentCallId, targetUid, type);
    });

    if (typeof window.recordCallSyncEvent === 'function') {
      window.recordCallSyncEvent({
        callId: GC._currentCallId,
        direction: 'outgoing',
        status: 'ringing',
        callType: type,
        fromUserId: GC._myUid,
        fromUserName: myDetails.name,
        participantIds: allParticipantIds,
        metadata: { groupCall: true }
      });
    }

    if (pid.length > 0) {
      GC._txt('call-status', 'Calling ' + pid.length + ' participant' + (pid.length > 1 ? 's' : '') + '…');
    } else {
      GC._txt('call-status', 'Waiting for participants…');
    }
  }

  async function joinGroupCall(callId) {
    GC._myUid = GC._uid();
    if (!GC._myUid || !GC._firestore()) { GC._toast('Not signed in', 'error'); return; }
    if (GC._isInGroupCall()) { GC._toast('Already in a call', 'info'); return; }
    if (!callId) return;
    GC._hideGroupCallInvite();
    GC._currentCallId = callId;
    GC._isInitiator = false;

    var callDoc;
    try {
      callDoc = await GC._firestore().collection('groupCalls').doc(callId).get();
    } catch (err) {
      GC._toast('Failed to join call: ' + err.message, 'error');
      GC._currentCallId = null;
      return;
    }
    if (!callDoc.exists) { GC._toast('Call not found', 'error'); GC._currentCallId = null; return; }
    var callData = callDoc.data();
    if (callData.status === 'ended' || callData.status === 'cancelled') { GC._toast('Call has ended', 'info'); GC._currentCallId = null; return; }

    GC._currentCallType = callData.type || 'voice';
    var myDetails = GC._getMyDetails();

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(GC._currentCallType === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) { GC._currentCallId = null; return; }
    }

    try {
      var constraints = { audio: true };
      if (GC._currentCallType === 'video') {
        constraints.video = {
          facingMode: CC.getPreferredCameraFacingMode() || 'user',
          width: { ideal: window.isTablet ? 1920 : 1280 },
          height: { ideal: window.isTablet ? 1080 : 720 }
        };
      }
      CC.setLocalStream(await navigator.mediaDevices.getUserMedia(constraints));
    } catch (err) {
      GC._toast('Could not access camera/mic', 'error');
      GC._currentCallId = null;
      return;
    }

    GC._participantJoinTime.set(GC._myUid, Date.now());
    var newParticipantIds = (callData.participantIds || []);
    if (newParticipantIds.indexOf(GC._myUid) === -1) newParticipantIds.push(GC._myUid);

    var participantDetailsUpdate = {};
    participantDetailsUpdate[GC._myUid] = {
      name: myDetails.name,
      avatar: myDetails.avatar,
      isMuted: !!CC.isMicMuted(),
      isVideoOff: !!CC.isCameraOff(),
      joinedAt: Date.now()
    };

    try {
      await GC._firestore().collection('groupCalls').doc(callId).update({
        participantIds: newParticipantIds,
        status: 'active',
        participantDetails: participantDetailsUpdate
      });
    } catch (err) {
      GC._toast('Failed to join: ' + err.message, 'error');
      var _jcs = CC.getLocalStream();
      if (_jcs) { _jcs.getTracks().forEach(function (t) { t.stop(); }); }
      CC.setLocalStream(null);
      GC._currentCallId = null;
      return;
    }

    var existingParticipants = (callData.participantIds || []).filter(function (p) { return p !== GC._myUid; });
    window.activeGroupCallParticipants = [{ uid: GC._myUid, name: myDetails.name, avatar: myDetails.avatar, isMuted: false, isVideoOff: false }];
    existingParticipants.forEach(function (pUid) {
      var det = callData.participantDetails && callData.participantDetails[pUid];
      window.activeGroupCallParticipants.push({
        uid: pUid,
        name: det ? det.name : 'Participant',
        avatar: det ? (det.avatar || '') : '',
        isMuted: det ? !!det.isMuted : false,
        isVideoOff: det ? !!det.isVideoOff : true
      });
      if (det) {
        if (det.isMuted !== undefined) GC._participantMuteState.set(pUid, det.isMuted);
        if (det.isVideoOff !== undefined) GC._participantVideoState.set(pUid, det.isVideoOff);
      }
    });

    App.callActive = true;
    App._activeCallId = GC._currentCallId;

    GC._ensureGridContainer();
    GC._renderGrid();
    GC._showGroupCallScreen();
    GC._listenToCallDoc(GC._currentCallId);
    GC._listenToSignaling(GC._currentCallId);
    GC._listenToIncomingCandidates(GC._currentCallId);
    GC._listenToInvites(GC._currentCallId);
    GC._startSpeakerDetection();

    existingParticipants.forEach(function (targetUid) {
      GC._initiatePeerConnectionTo(targetUid);
    });

    if (typeof window.recordCallSyncEvent === 'function') {
      window.recordCallSyncEvent({
        callId: GC._currentCallId,
        direction: 'incoming',
        status: 'answered',
        callType: GC._currentCallType,
        fromUserId: callData.initiatorId || '',
        fromUserName: callData.initiatorName || '',
        toUserId: GC._myUid,
        toUserName: myDetails.name,
        participantIds: newParticipantIds,
        metadata: { groupCall: true }
      });
    }

    GC._txt('call-status', 'Connected');
  }

  function leaveGroupCall() {
    if (!GC._isInGroupCall()) return;
    var wasInitiator = GC._isInitiator;
    var callId = GC._currentCallId;
    var myUid = GC._myUid;

    GC._stopSpeakerDetection();
    GC._cleanupAllPeerConnections();
    GC._cleanupListeners();

    if (CC.getLocalStream()) {
      CC.getLocalStream().getTracks().forEach(function (t) { t.stop(); });
      CC.setLocalStream(null);
    }

    if (callId && GC._firestore() && myUid) {
      var remainingParticipants = (window.activeGroupCallParticipants || []).filter(function (p) { return p.uid !== myUid; });
      if (remainingParticipants.length === 0 || wasInitiator) {
        GC._firestore().collection('groupCalls').doc(callId).update({
          status: 'ended',
          endedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function () {});
        GC._firestore().collection('groupCalls').doc(callId).collection('invites')
          .where('status', '==', 'pending')
          .get().then(function (snap) {
            snap.forEach(function (doc) {
              doc.ref.update({ status: 'cancelled' }).catch(function () {});
            });
          }).catch(function () {});
      } else {
        var newIds = remainingParticipants.map(function (p) { return p.uid; });
        var updatePayload = { participantIds: newIds };
        var detailUpdate = {};
        detailUpdate[myUid] = firebase.firestore.FieldValue.delete();
        updatePayload.participantDetails = detailUpdate;
        GC._firestore().collection('groupCalls').doc(callId).update(updatePayload).catch(function () {});
      }

      if (typeof window.recordCallSyncEvent === 'function') {
        window.recordCallSyncEvent({
          callId: callId,
          direction: wasInitiator ? 'outgoing' : 'incoming',
          status: 'ended',
          callType: GC._currentCallType,
          fromUserId: myUid,
          toUserId: '',
          participantIds: remainingParticipants.map(function (p) { return p.uid; }),
          durationMs: null,
          metadata: { groupCall: true, leftCall: true }
        });
      }
    }

    window.activeGroupCallParticipants = [];
    GC._currentCallId = null;
    GC._isInitiator = false;
    GC._myUid = null;
    App.callActive = false;
    App._activeCallId = null;

    var gcGrid = GC._$('gc-grid');
    if (gcGrid) gcGrid.remove();
    GC._gridContainer = null;

    var cs = GC._$('call-screen');
    if (cs) cs.classList.add('hidden');
    GC._hideGroupCallInvite();

    GC._toast('You left the call', 'info');
  }

  if (typeof window.startGroupCall !== 'function') { window.startGroupCall = startGroupCall; }
  window.joinGroupCall = joinGroupCall;
  window.leaveGroupCall = leaveGroupCall;
  window.declineGroupCall = function (callId) {
    GC._hideGroupCallInvite();
    if (GC._firestore() && callId) {
      GC._firestore().collection('groupCalls').doc(callId).collection('invites')
        .where('toUserId', '==', GC._uid())
        .where('status', '==', 'pending')
        .get().then(function (snap) {
          snap.forEach(function (doc) {
            doc.ref.update({ status: 'declined' }).catch(function () {});
          });
        }).catch(function () {});
    }
  };
  window._handleAcceptedGroupCall = function (data) {
    if (data && data.callId) {
      joinGroupCall(data.callId);
    }
  };
  window.listenForGroupCallParticipants = function (callId, _type) {
    GC._listenToCallDoc(callId);
    GC._listenToSignaling(callId);
    GC._listenToIncomingCandidates(callId);
    GC._listenToInvites(callId);
  };

})();
