/* group-call-core.js — Multi-peer connection management, SFU/MCU signaling */
(function () {
  'use strict';

  var GC = window._GC = window._GC || {};
  var CC = window._CC;

  GC._GRID_MAX_VOICE = 32;
  GC._GRID_MAX_VIDEO = 8;
  GC._GRID_MAX = 8;
  GC._RECONNECT_INTERVAL_MS = 3000;
  GC._RECONNECT_MAX_ATTEMPTS = 5;
  GC._INVITE_TIMEOUT_MS = 30000;
  GC._speakerCheckInterval = null;
  GC._gridRenderQueued = false;
  GC._currentCallId = null;
  GC._currentCallType = 'voice';
  GC._isInitiator = false;
  GC._myUid = null;
  GC._gridContainer = null;
  GC._screenShareUserId = null;
  GC._reconnectTimers = {};
  GC._reconnectAttempts = {};
  GC._inviteTimers = {};
  GC._unsubCallDoc = null;
  GC._unsubInvites = null;
  GC._unsubCandidates = null;
  GC._unsubSignaling = null;
  GC._unsubParticipantCandidates = {};
  GC._participantStreams = new Map();
  GC._participantMuteState = new Map();
  GC._participantVideoState = new Map();
  GC._participantJoinTime = new Map();
  GC._audioLevelCache = new Map();
  GC._lastSpeakerUid = null;

  window.activeGroupCallParticipants = window.activeGroupCallParticipants || [];
  window.groupCallPeerConnections = window.groupCallPeerConnections instanceof Map ? window.groupCallPeerConnections : new Map();
  window.groupCallCandidateUnsubscribes = Array.isArray(window.groupCallCandidateUnsubscribes) ? window.groupCallCandidateUnsubscribes : [];

  function _db() { return App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); }
  function _uid() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); }
  function _me() { return (window.App && window.App.currentUser) ? window.App.currentUser : null; }
  function _$(id) { return document.getElementById(id); }
  function _txt(id, v) { var e = _$(id); if (e) e.textContent = v; }
  function _show(id) { var e = _$(id); if (e) e.classList.remove('hidden'); }
  function _hide(id) { var e = _$(id); if (e) e.classList.add('hidden'); }
  function _toast(msg, t) { if (App && App.toast) App.toast(msg, t); else if (typeof window.showToast === 'function') window.showToast(msg, t); }
  function _esc(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); }

  function _firestore() { return _db(); }
  function _isInGroupCall() { return !!GC._currentCallId; }
  function _isCallActive() { return (window.App && App.callActive) ? true : false; }

  function _getParticipantCount() {
    return window.activeGroupCallParticipants ? window.activeGroupCallParticipants.length : 0;
  }

  function _canAddParticipant() {
    return _getParticipantCount() < GC._GRID_MAX;
  }

  function _getMyDetails() {
    var m = _me();
    return {
      uid: _uid(),
      name: m ? (m.displayName || m.email || 'User') : 'User',
      avatar: m ? (m.photoURL || '') : '',
      isMuted: !!CC.isMicMuted(),
      isVideoOff: !!CC.isCameraOff()
    };
  }

  function _updateFirestoreParticipantState(updates) {
    if (!_firestore() || !GC._currentCallId) return;
    var participantDetails = {};
    participantDetails[GC._myUid] = updates;
    _firestore().collection('groupCalls').doc(GC._currentCallId).update({
      participantDetails: participantDetails
    }).catch(function () {});
  }

  async function _setupPeerConnectionForParticipant(targetUid) {
    if (!_firestore() || !GC._currentCallId) return null;
    var rtcConfig = await getRtcConfig();
    var pc = new RTCPeerConnection(rtcConfig);

    var _ls = CC.getLocalStream();
    if (_ls) {
      _ls.getTracks().forEach(function (track) {
        pc.addTrack(track, _ls);
      });
    }

    pc.onicecandidate = function (e) {
      if (e.candidate && _firestore() && GC._currentCallId) {
        _firestore().collection('groupCalls').doc(GC._currentCallId).collection('candidates').add({
          candidate: e.candidate.toJSON(),
          sender: GC._myUid,
          receiver: targetUid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function () {});
      }
    };

    pc.ontrack = function (e) {
      var stream = e.streams[0];
      if (stream) {
        GC._participantStreams.set(targetUid, stream);
        GC._renderGrid();
      }
    };

    pc.oniceconnectionstatechange = function () {
      var iceState = pc.iceConnectionState;
      if (iceState === 'connected' || iceState === 'completed') {
        delete GC._reconnectAttempts[targetUid];
        delete GC._reconnectTimers[targetUid];
        GC._renderGrid();
      } else if (iceState === 'disconnected') {
        GC._reconnectAttempts[targetUid] = (GC._reconnectAttempts[targetUid] || 0) + 1;
        GC._renderGrid();
        _scheduleReconnect(targetUid);
      } else if (iceState === 'failed') {
        GC._reconnectAttempts[targetUid] = (GC._reconnectAttempts[targetUid] || 0) + 1;
        GC._renderGrid();
        if (GC._reconnectAttempts[targetUid] < GC._RECONNECT_MAX_ATTEMPTS) {
          _scheduleReconnect(targetUid);
        }
      }
    };

    window.groupCallPeerConnections.set(targetUid, pc);
    return pc;
  }

  function _scheduleReconnect(targetUid) {
    if (GC._reconnectTimers[targetUid]) return;
    var attempts = GC._reconnectAttempts[targetUid] || 0;
    GC._reconnectTimers[targetUid] = setTimeout(async function () {
      GC._reconnectTimers[targetUid] = null;
      if (!GC._currentCallId || !_firestore()) return;
      if (attempts >= GC._RECONNECT_MAX_ATTEMPTS) {
        _removeParticipantFromGrid(targetUid);
        return;
      }
      var pc = window.groupCallPeerConnections.get(targetUid);
      if (pc && pc.signalingState !== 'closed') {
        try { pc.restartIce(); } catch (_) {}
      } else {
        await _setupPeerConnectionForParticipant(targetUid);
        var newPc = window.groupCallPeerConnections.get(targetUid);
        if (newPc) {
          try {
            var offer = await newPc.createOffer();
            await newPc.setLocalDescription(offer);
            await _firestore().collection('groupCalls').doc(GC._currentCallId).collection('signaling').add({
              type: 'renegotiate',
              offer: { sdp: offer.sdp, type: offer.type },
              from: GC._myUid,
              to: targetUid,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          } catch (_) {}
        }
      }
    }, GC._RECONNECT_INTERVAL_MS * (attempts + 1));
  }

  function _removeParticipantFromGrid(targetUid) {
    GC._participantStreams.delete(targetUid);
    GC._participantMuteState.delete(targetUid);
    GC._participantVideoState.delete(targetUid);
    GC._participantJoinTime.delete(targetUid);
    GC._audioLevelCache.delete(targetUid);
    if (GC._screenShareUserId === targetUid) GC._screenShareUserId = null;
    window.activeGroupCallParticipants = (window.activeGroupCallParticipants || []).filter(function (p) { return p.uid !== targetUid; });
    _closePeerConnection(targetUid);
    GC._renderGrid();
  }

  function _closePeerConnection(targetUid) {
    var pc = window.groupCallPeerConnections.get(targetUid);
    if (pc) {
      try { pc.close(); } catch (_) {}
      window.groupCallPeerConnections.delete(targetUid);
    }
    var unsubs = GC._unsubParticipantCandidates[targetUid];
    if (unsubs) {
      unsubs.forEach(function (fn) { try { fn(); } catch (_) {} });
      delete GC._unsubParticipantCandidates[targetUid];
    }
    if (GC._reconnectTimers[targetUid]) {
      clearTimeout(GC._reconnectTimers[targetUid]);
      delete GC._reconnectTimers[targetUid];
    }
    delete GC._reconnectAttempts[targetUid];
  }

  async function _initiatePeerConnectionTo(targetUid) {
    var pc = await _setupPeerConnectionForParticipant(targetUid);
    if (!pc) return;
    try {
      var offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (_firestore() && GC._currentCallId) {
        await _firestore().collection('groupCalls').doc(GC._currentCallId).collection('signaling').add({
          type: 'offer',
          offer: { sdp: offer.sdp, type: offer.type },
          from: GC._myUid,
          to: targetUid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (_) {}
  }

  async function _handleIncomingOffer(callId, sig) {
    var senderUid = sig.from;
    var pc = window.groupCallPeerConnections.get(senderUid);
    if (pc && pc.signalingState !== 'closed') {
      try { pc.close(); } catch (_) {}
      window.groupCallPeerConnections.delete(senderUid);
    }
    pc = await _setupPeerConnectionForParticipant(senderUid);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sig.offer));
      var answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await _firestore().collection('groupCalls').doc(callId).collection('signaling').add({
        type: 'answer',
        answer: { sdp: answer.sdp, type: answer.type },
        from: GC._myUid,
        to: senderUid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (_) {}
  }

  async function _handleIncomingAnswer(sig) {
    var senderUid = sig.from;
    var pc = window.groupCallPeerConnections.get(senderUid);
    if (!pc || pc.signalingState !== 'have-local-offer') return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sig.answer));
    } catch (_) {}
  }

  async function _handleRenegotiate(callId, sig) {
    var senderUid = sig.from;
    var pc = window.groupCallPeerConnections.get(senderUid);
    if (pc && pc.signalingState !== 'closed') {
      try { pc.close(); } catch (_) {}
      window.groupCallPeerConnections.delete(senderUid);
    }
    pc = await _setupPeerConnectionForParticipant(senderUid);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sig.offer));
      var answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await _firestore().collection('groupCalls').doc(callId).collection('signaling').add({
        type: 'answer',
        answer: { sdp: answer.sdp, type: answer.type },
        from: GC._myUid,
        to: senderUid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (_) {}
  }

  async function _listenToIncomingCandidates(callId) {
    if (!_firestore()) return;
    if (GC._unsubCandidates) { try { GC._unsubCandidates(); } catch (_) {} }
    var myUid = GC._myUid;
    GC._unsubCandidates = _firestore().collection('groupCalls').doc(callId).collection('candidates')
      .orderBy('createdAt')
      .onSnapshot(function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === 'added') {
            var c = change.doc.data();
            if (c.sender !== myUid && c.receiver === myUid) {
              var pc = window.groupCallPeerConnections.get(c.sender);
              if (pc) {
                pc.addIceCandidate(new RTCIceCandidate(c.candidate)).catch(function () {});
              }
            }
          }
        });
      }, function () {});
  }

  function _listenToSignaling(callId) {
    if (!_firestore()) return;
    if (GC._unsubSignaling) { try { GC._unsubSignaling(); } catch (_) {} }
    var myUid = GC._myUid;
    GC._unsubSignaling = _firestore().collection('groupCalls').doc(callId).collection('signaling')
      .orderBy('createdAt')
      .onSnapshot(function (snap) {
        snap.docChanges().forEach(async function (change) {
          if (change.type !== 'added') return;
          var sig = change.doc.data();
          if (sig.to !== myUid) return;
          if (sig.type === 'offer') {
            await _handleIncomingOffer(callId, sig);
          } else if (sig.type === 'answer') {
            await _handleIncomingAnswer(sig);
          } else if (sig.type === 'renegotiate') {
            await _handleRenegotiate(callId, sig);
          } else if (sig.type === 'mute-request') {
            // Admin/moderator is muting this participant's mic
            var _ls2 = CC.getLocalStream();
            if (_ls2) {
              var audioTracks = _ls2.getAudioTracks();
              audioTracks.forEach(function (track) {
                track.enabled = !sig.muted;
              });
              if (typeof showToast === 'function') {
                showToast(sig.muted ? 'Your microphone has been muted by the host' : 'Your microphone has been unmuted by the host', 'info');
              }
            }
          }
          try { await change.doc.ref.delete(); } catch (_) {}
        });
      }, function () {});
  }

  function _listenToCallDoc(callId) {
    if (!_firestore()) return;
    if (GC._unsubCallDoc) { try { GC._unsubCallDoc(); } catch (_) {} }
    GC._unsubCallDoc = _firestore().collection('groupCalls').doc(callId).onSnapshot(function (doc) {
      var data = doc.data();
      if (!data) return;
      var incomingParticipants = data.participantIds || [];
      var myInList = incomingParticipants.indexOf(GC._myUid) !== -1;
      if (data.status === 'ended' || (data.status === 'cancelled' && !myInList)) {
        _toast('Group call ended', 'info');
        window.leaveGroupCall();
        return;
      }
      if (data.screenShareUid && data.screenShareUid !== GC._screenShareUserId) {
        GC._screenShareUserId = data.screenShareUid;
        GC._renderGrid();
      } else if (!data.screenShareUid && GC._screenShareUserId) {
        GC._screenShareUserId = null;
        GC._renderGrid();
      }
      incomingParticipants.forEach(function (pUid) {
        if (pUid === GC._myUid) return;
        var existing = (window.activeGroupCallParticipants || []).find(function (p) { return p.uid === pUid; });
        if (!existing) {
          var details = data.participantDetails && data.participantDetails[pUid];
          var newParticipant = {
            uid: pUid,
            name: details ? details.name : 'Participant',
            avatar: details ? (details.avatar || '') : '',
            isMuted: details ? !!details.isMuted : false,
            isVideoOff: details ? !!details.isVideoOff : true,
            joinedAt: details ? details.joinedAt : null
          };
          window.activeGroupCallParticipants.push(newParticipant);
          if (details && details.isMuted !== undefined) GC._participantMuteState.set(pUid, details.isMuted);
          if (details && details.isVideoOff !== undefined) GC._participantVideoState.set(pUid, details.isVideoOff);
          if (!window.groupCallPeerConnections.has(pUid)) {
            _initiatePeerConnectionTo(pUid);
          }
        }
      });
      var toRemove = [];
      (window.activeGroupCallParticipants || []).forEach(function (p) {
        if (incomingParticipants.indexOf(p.uid) === -1 && p.uid !== GC._myUid) {
          toRemove.push(p.uid);
        }
      });
      toRemove.forEach(function (uid) {
        _removeParticipantFromGrid(uid);
      });
      if (data.participantDetails) {
        Object.keys(data.participantDetails).forEach(function (pUid) {
          var det = data.participantDetails[pUid];
          if (det && det.isMuted !== undefined) GC._participantMuteState.set(pUid, det.isMuted);
          if (det && det.isVideoOff !== undefined) GC._participantVideoState.set(pUid, det.isVideoOff);
        });
        GC._renderGrid();
      }
    }, function (err) {
      console.warn('[GroupCall] Call doc listener error:', err);
    });
  }

  function _listenToInvites(callId) {
    if (!_firestore()) return;
    if (GC._unsubInvites) { try { GC._unsubInvites(); } catch (_) {} }
    GC._unsubInvites = _firestore().collection('groupCalls').doc(callId).collection('invites')
      .where('status', '==', 'pending')
      .onSnapshot(function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === 'added' || change.type === 'modified') {
            var invite = change.doc.data();
            if (invite.toUserId === GC._myUid && invite.status === 'pending') {
              GC._showGroupCallInvite(callId, invite);
            }
          }
          if (change.type === 'removed') {
            var removed = change.doc.data();
            if (removed && removed.toUserId === GC._myUid) {
              GC._hideGroupCallInvite();
            }
          }
        });
      }, function (err) {
        console.warn('[GroupCall] Invites listener error:', err);
      });
  }

  async function _sendInvite(callId, targetUid, callType) {
    if (!_firestore()) return;
    var myDetails = _getMyDetails();
    try {
      await _firestore().collection('groupCalls').doc(callId).collection('invites').add({
        callId: callId,
        fromUserId: GC._myUid,
        fromUserName: myDetails.name,
        toUserId: targetUid,
        callType: callType,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      GC._inviteTimers[targetUid] = setTimeout(function () {
        _cancelInvite(callId, targetUid);
      }, GC._INVITE_TIMEOUT_MS);
    } catch (_) {}
  }

  function _cancelInvite(callId, targetUid) {
    if (GC._inviteTimers[targetUid]) {
      clearTimeout(GC._inviteTimers[targetUid]);
      delete GC._inviteTimers[targetUid];
    }
    if (!_firestore() || !GC._isInitiator) return;
    _firestore().collection('groupCalls').doc(callId).collection('invites')
      .where('toUserId', '==', targetUid)
      .where('status', '==', 'pending')
      .get().then(function (snap) {
        snap.forEach(function (doc) {
          doc.ref.update({ status: 'cancelled' }).catch(function () {});
        });
      }).catch(function () {});
  }

  function _cleanupAllPeerConnections() {
    window.groupCallPeerConnections.forEach(function (pc, _uid) {
      try { pc.close(); } catch (_) {}
    });
    window.groupCallPeerConnections.clear();
    window.groupCallCandidateUnsubscribes.forEach(function (fn) { try { fn(); } catch (_) {} });
    window.groupCallCandidateUnsubscribes = [];
    Object.keys(GC._unsubParticipantCandidates).forEach(function (uid) {
      GC._unsubParticipantCandidates[uid].forEach(function (fn) { try { fn(); } catch (_) {} });
    });
    GC._unsubParticipantCandidates = {};
    Object.keys(GC._reconnectTimers).forEach(function (uid) {
      clearTimeout(GC._reconnectTimers[uid]);
    });
    GC._reconnectTimers = {};
    GC._reconnectAttempts = {};
    Object.keys(GC._inviteTimers).forEach(function (uid) {
      clearTimeout(GC._inviteTimers[uid]);
    });
    GC._inviteTimers = {};
    GC._participantStreams.forEach(function (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
    });
    GC._participantStreams.clear();
    GC._participantMuteState.clear();
    GC._participantVideoState.clear();
    GC._participantJoinTime.clear();
    GC._audioLevelCache.clear();
    GC._lastSpeakerUid = null;
    GC._screenShareUserId = null;
  }

  function _cleanupListeners() {
    if (GC._unsubCallDoc) { try { GC._unsubCallDoc(); } catch (_) {} GC._unsubCallDoc = null; }
    if (GC._unsubInvites) { try { GC._unsubInvites(); } catch (_) {} GC._unsubInvites = null; }
    if (GC._unsubCandidates) { try { GC._unsubCandidates(); } catch (_) {} GC._unsubCandidates = null; }
    if (GC._unsubSignaling) { try { GC._unsubSignaling(); } catch (_) {} GC._unsubSignaling = null; }
    if (GC._unsubParticipantCandidates) {
      Object.keys(GC._unsubParticipantCandidates).forEach(function (uid) {
        GC._unsubParticipantCandidates[uid].forEach(function (fn) { try { fn(); } catch (_) {} });
      });
      GC._unsubParticipantCandidates = {};
    }
  }

  GC._db = _db;
  GC._uid = _uid;
  GC._me = _me;
  GC._$ = _$;
  GC._txt = _txt;
  GC._show = _show;
  GC._hide = _hide;
  GC._toast = _toast;
  GC._esc = _esc;
  GC._firestore = _firestore;
  GC._isInGroupCall = _isInGroupCall;
  GC._isCallActive = _isCallActive;
  GC._getParticipantCount = _getParticipantCount;
  GC._canAddParticipant = _canAddParticipant;
  GC._getMyDetails = _getMyDetails;
  GC._updateFirestoreParticipantState = _updateFirestoreParticipantState;
  GC._setupPeerConnectionForParticipant = _setupPeerConnectionForParticipant;
  GC._scheduleReconnect = _scheduleReconnect;
  GC._removeParticipantFromGrid = _removeParticipantFromGrid;
  GC._closePeerConnection = _closePeerConnection;
  GC._initiatePeerConnectionTo = _initiatePeerConnectionTo;
  GC._handleIncomingOffer = _handleIncomingOffer;
  GC._handleIncomingAnswer = _handleIncomingAnswer;
  GC._handleRenegotiate = _handleRenegotiate;
  GC._listenToIncomingCandidates = _listenToIncomingCandidates;
  GC._listenToSignaling = _listenToSignaling;
  GC._listenToCallDoc = _listenToCallDoc;
  GC._listenToInvites = _listenToInvites;
  GC._sendInvite = _sendInvite;
  GC._cancelInvite = _cancelInvite;
  GC._cleanupAllPeerConnections = _cleanupAllPeerConnections;
  GC._cleanupListeners = _cleanupListeners;

})();
