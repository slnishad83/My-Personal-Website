/* group-call-actions.js — Mute, camera, screen share for group calls; participant management */
(function () {
  'use strict';

  var GC = window._GC;
  var CC = window._CC;

  async function addToCall(userId) {
    if (!GC._isInGroupCall() || !GC._isInitiator) { GC._toast('Only the call initiator can add participants', 'error'); return; }
    if (!userId || userId === GC._myUid) return;
    if (!GC._canAddParticipant()) { GC._toast('Maximum ' + GC._GRID_MAX + ' participants allowed', 'error'); return; }
    var alreadyIn = (window.activeGroupCallParticipants || []).some(function (p) { return p.uid === userId; });
    if (alreadyIn) { GC._toast('Already in the call', 'info'); return; }
    if (!GC._firestore() || !GC._currentCallId) return;

    try {
      var callDoc = await GC._firestore().collection('groupCalls').doc(GC._currentCallId).get();
      var callData = callDoc.data();
      var currentIds = callData.participantIds || [];
      if (currentIds.indexOf(userId) === -1) currentIds.push(userId);
      await GC._firestore().collection('groupCalls').doc(GC._currentCallId).update({
        participantIds: currentIds
      });
      await GC._sendInvite(GC._currentCallId, userId, GC._currentCallType);
      GC._toast('Invitation sent', 'success');
    } catch (err) {
      GC._toast('Failed to add participant: ' + err.message, 'error');
    }
  }

  function removeFromCall(userId) {
    if (!GC._isInGroupCall()) return;
    if (!GC._isInitiator) { GC._toast('Only the call initiator can remove participants', 'error'); return; }
    if (!userId || userId === GC._myUid) return;
    var participant = (window.activeGroupCallParticipants || []).find(function (p) { return p.uid === userId; });
    if (!participant) return;
    var hasJoined = GC._participantJoinTime.has(userId);
    if (hasJoined) {
      GC._removeParticipantFromGrid(userId);
      if (GC._firestore() && GC._currentCallId) {
        var remaining = (window.activeGroupCallParticipants || []).map(function (p) { return p.uid; });
        remaining.push(GC._myUid);
        var updatePayload = { participantIds: remaining };
        var detailUpdate = {};
        detailUpdate[userId] = firebase.firestore.FieldValue.delete();
        updatePayload.participantDetails = detailUpdate;
        GC._firestore().collection('groupCalls').doc(GC._currentCallId).update(updatePayload).catch(function () {});
      }
      GC._toast(participant.name + ' removed from call', 'info');
    } else {
      GC._cancelInvite(GC._currentCallId, userId);
      GC._toast('Invitation cancelled', 'info');
    }
  }

  function muteParticipant(userId) {
    if (!GC._isInGroupCall()) return;
    if (!userId || userId === GC._myUid) return;
    if (!GC._firestore() || !GC._currentCallId) return;
    var currentMuted = GC._participantMuteState.get(userId) || false;
    var newMuted = !currentMuted;
    GC._participantMuteState.set(userId, newMuted);
    var detailUpdate = {};
    detailUpdate['participantDetails.' + userId] = { isMuted: newMuted };
    GC._firestore().collection('groupCalls').doc(GC._currentCallId).update(detailUpdate).catch(function () {});
    var signalingRef = GC._firestore().collection('groupCalls').doc(GC._currentCallId).collection('signaling');
    function sendMuteRequest() {
      signalingRef.add({
        type: 'mute-request',
        from: GC._myUid,
        to: userId,
        muted: newMuted,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () {});
    }
    sendMuteRequest();
    var _retryTimer = setTimeout(function () {
      var stillMuted = GC._participantMuteState.get(userId);
      if (stillMuted === newMuted) sendMuteRequest();
    }, 3000);
    var participant = (window.activeGroupCallParticipants || []).find(function (p) { return p.uid === userId; });
    if (participant) {
      participant.isMuted = newMuted;
    }
    GC._renderGrid();
    GC._toast(newMuted ? (participant ? participant.name + ' muted' : 'Participant muted') : (participant ? participant.name + ' unmuted' : 'Participant unmuted'), 'info');
  }

  function addToCallBeforeAnswer(userId) {
    if (!GC._isInGroupCall() || !GC._isInitiator) { GC._toast('Only the call initiator can add participants', 'error'); return; }
    if (!userId || userId === GC._myUid) return;
    if (!GC._canAddParticipant()) { GC._toast('Maximum ' + GC._GRID_MAX + ' participants allowed', 'error'); return; }
    var alreadyIn = (window.activeGroupCallParticipants || []).some(function (p) { return p.uid === userId; });
    if (alreadyIn) { GC._toast('Already in the call', 'info'); return; }
    addToCall(userId);
  }

  function getGroupCallParticipants() {
    return (window.activeGroupCallParticipants || []).map(function (p) {
      return {
        uid: p.uid,
        name: p.name,
        avatar: p.avatar,
        isMuted: GC._participantMuteState.get(p.uid) || false,
        isVideoOff: GC._participantVideoState.get(p.uid) || false,
        joinedAt: GC._participantJoinTime.get(p.uid) || null,
        stream: GC._participantStreams.get(p.uid) || null
      };
    });
  }

  function renderGroupCallGrid() {
    GC._ensureGridContainer();
    GC._renderGrid();
  }

  function cleanupGroupCalls() {
    GC._stopSpeakerDetection();
    GC._cleanupAllPeerConnections();
    GC._cleanupListeners();
    if (CC.getLocalStream()) {
      CC.getLocalStream().getTracks().forEach(function (t) { t.stop(); });
      CC.setLocalStream(null);
    }
    window.activeGroupCallParticipants = [];
    GC._currentCallId = null;
    GC._isInitiator = false;
    GC._myUid = null;
    GC._gridContainer = null;
    var gcGrid = GC._$('gc-grid');
    if (gcGrid) gcGrid.remove();
    GC._hideGroupCallInvite();
  }

  window.addToCall = addToCall;
  window.removeFromCall = removeFromCall;
  window.muteParticipant = muteParticipant;
  window.addToCallBeforeAnswer = addToCallBeforeAnswer;
  window.getGroupCallParticipants = getGroupCallParticipants;
  window.renderGroupCallGrid = renderGroupCallGrid;
  window.cleanupGroupCalls = cleanupGroupCalls;

})();
