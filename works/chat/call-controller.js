(function () {
  'use strict';

  const STATES = { IDLE: 0, RINGING: 1, CONNECTING: 2, ACTIVE: 3, ENDED: 4 };
  let state = STATES.IDLE;
  let callType = 'voice';
  let callId = null;
  let callStartTime = null;
  let timerInterval = null;
  let timeoutHandle = null;
  let heartbeatHandle = null;
  let qualityInterval = null;
  let reconnOverlayTimer = null;
  let reconnAttemptTimer = null;
  let reconnAttempt = 0;
  const MAX_RECONN_ATTEMPTS = 5;
  const CALL_TIMEOUT_MS = 45000;
  let unsubAnswer = null;
  let unsubCandidates = null;
  let unsubStatus = null;
  let unsubIncoming = null;
  let incomingTimeoutHandle = null;
  let screenShareStream = null;
  let screenShareSender = null;
  let incomingData = null;
  let bcChannel = null;
  try { bcChannel = new BroadcastChannel('tc-calls'); } catch (_) {}
  let incomingBcHandler = null;

  function db() { return App.db || null; }
  function uid() { return App.auth?.currentUser?.uid || null; }
  function me() { return App.currentUser || null; }
  function chat() { return App.currentChat || null; }

  function $(id) { return document.getElementById(id); }
  function txt(id, v) { var e = $(id); if (e) e.textContent = v; }
  function show(id) { $(id)?.classList.remove('hidden'); }
  function hide(id) { $(id)?.classList.add('hidden'); }
  function toast(msg, t) { if (typeof window.showToast === 'function') showToast(msg, t || 'info'); }
  function closeModalFn(id) { if (typeof window.closeModal === 'function') closeModal(id); }

  function setState(s) { state = s; }

  function stopTimer() { clearInterval(timerInterval); timerInterval = null; }
  function startTimer() {
    stopTimer();
    callStartTime = Date.now();
    timerInterval = setInterval(function () {
      var s = Math.floor((Date.now() - callStartTime) / 1000);
      var d = fmtDur(s);
      txt('call-timer', d);
      txt('bubble-call-timer', d);
    }, 1000);
  }
  function fmtDur(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function clearAllTimers() {
    clearTimeout(timeoutHandle); timeoutHandle = null;
    clearInterval(heartbeatHandle); heartbeatHandle = null;
    clearInterval(qualityInterval); qualityInterval = null;
    clearTimeout(reconnOverlayTimer); reconnOverlayTimer = null;
    clearTimeout(reconnAttemptTimer); reconnAttemptTimer = null;
    stopTimer();
  }

  function cleanupListeners() {
    if (unsubAnswer) { try { unsubAnswer(); } catch (_) {} unsubAnswer = null; }
    if (unsubCandidates) { try { unsubCandidates(); } catch (_) {} unsubCandidates = null; }
    if (unsubStatus) { try { unsubStatus(); } catch (_) {} unsubStatus = null; }
    if (incomingTimeoutHandle) { clearTimeout(incomingTimeoutHandle); incomingTimeoutHandle = null; }
  }

  function stopExistingRingtone() {
    if (typeof window.stopRingtone === 'function') stopRingtone();
  }

  function playSound(name) {
    if (window.NotificationSounds && typeof window.NotificationSounds.play === 'function') {
      window.NotificationSounds.play(name);
    }
  }

  function requestWake() {
    if (typeof window.requestWakeLock === 'function') requestWakeLock();
  }
  function releaseWake() {
    if (typeof window.releaseWakeLock === 'function') releaseWakeLock();
  }

  function broadcastToTabs(type, extra) {
    if (bcChannel) {
      try { bcChannel.postMessage(Object.assign({ type: type }, extra || {})); } catch (_) {}
    }
  }

  function writeCallLog(direction, status, durationMs) {
    if (typeof window.recordCallSyncEvent === 'function') {
      window.recordCallSyncEvent({
        callId: callId,
        direction: direction,
        status: status,
        callType: callType,
        fromUserId: uid(),
        fromUserName: me()?.displayName || 'User',
        toUserId: incomingData?.fromUserId || incomingData?.toUserId || '',
        toUserName: incomingData?.fromUserName || incomingData?.toUserName || '',
        durationMs: durationMs || null,
        participantIds: uid() ? [uid()] : []
      });
    }
  }

  function showCallScreen(type, name, initials) {
    callType = type;
    App.callActive = true;
    micMuted = false;
    cameraOff = (type === 'voice');
    App._activeCallId = callId;

    txt('call-name', name || 'Unknown');
    txt('call-status', type === 'video' ? 'Connecting…' : 'Calling…');
    hide('call-timer');
    show('call-screen');
    txt('call-quality-text', type === 'video' ? 'HD Video call' : 'HD Voice call');
    var camBtn = $('btn-cam');
    var ssBtn = $('btn-screenshare');
    if (camBtn) camBtn.classList.toggle('hidden', type === 'voice');
    if (ssBtn) ssBtn.classList.add('hidden');
    var rv = $('remote-video');
    var lvc = $('local-video-container');
    if (rv) rv.classList.add('hidden');
    if (lvc) lvc.classList.add('hidden');
    show('call-info-section');

    var av = $('call-avatar');
    if (av) {
      av.className = 'w-32 h-32 rounded-full border-4 border-primary/30 flex items-center justify-center text-5xl bg-white/10 animate-pulse';
      av.textContent = initials || '?';
    }
    var bb = $('call-bubble');
    if (bb) bb.style.display = 'none';

    var encBadge = $('call-encryption-badge');
    if (!encBadge) {
      var info = $('call-info-section');
      if (info) {
        var badge = document.createElement('p');
        badge.id = 'call-encryption-badge';
        badge.className = 'text-white/40 text-[10px] mt-2 flex items-center gap-1';
        badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px">lock</span> End-to-end encrypted';
        info.appendChild(badge);
      }
    }

    try { history.pushState({ callActive: true }, ''); } catch (_) {}
  }

  function addLocalTracks(stream) {
    if (!stream || !peerConnection) return;
    stream.getTracks().forEach(function (track) { peerConnection.addTrack(track, stream); });
  }

  function setupPeerConnection(pc) {
    pc.onicecandidate = function (e) {
      if (e.candidate && db() && callId) {
        db().collection('calls').doc(callId).collection('candidates').add({
          candidate: e.candidate.toJSON(),
          sender: uid(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function () {});
      }
    };

    pc.ontrack = function (e) {
      remoteCallStream = e.streams[0];
      var rv = $('remote-video');
      if (rv) {
        rv.srcObject = remoteCallStream;
        rv.classList.toggle('hidden', callType === 'voice');
      }
      if (callType === 'video') hide('call-info-section');
    };

    pc.onconnectionstatechange = function () {
      var s = pc.connectionState;
      if (s === 'connected') {
        onCallConnected();
      } else if (s === 'failed') {
        onConnectionFailed();
      } else if (s === 'disconnected') {
        onConnectionDisconnected();
      } else if (s === 'closed') {
        if (state === STATES.ACTIVE) {
          tryReconnect();
        }
      }
    };

    pc.oniceconnectionstatechange = function () {
      var iceState = pc.iceConnectionState;
      if (iceState === 'failed') {
        onConnectionFailed();
      } else if (iceState === 'disconnected') {
        onConnectionDisconnected();
      } else if (iceState === 'connected' || iceState === 'completed') {
        hideReconnOverlay();
        reconnAttempt = 0;
      }
    };
  }

  function onCallConnected() {
    setState(STATES.ACTIVE);
    txt('call-status', 'Active');
    stopExistingRingtone();
    show('call-timer');
    startTimer();
    hideReconnOverlay();
    reconnAttempt = 0;
    startQualityAdaptation();
    var ssBtn = $('btn-screenshare');
    if (ssBtn) ssBtn.classList.toggle('hidden', callType === 'voice');
    playSound('callConnected');
    if (db() && callId) {
      db().collection('calls').doc(callId).update({
        status: 'active',
        startedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () {});
    }
  }

  function onConnectionFailed() {
    if (state !== STATES.ACTIVE && state !== STATES.CONNECTING) return;
    txt('call-status', 'Call failed');
    showReconnOverlay();
    tryReconnect();
  }

  function onConnectionDisconnected() {
    if (state !== STATES.ACTIVE) return;
    txt('call-status', 'Reconnecting…');
    showReconnOverlay();
    tryReconnect();
  }

  function showReconnOverlay() {
    var ov = $('call-reconn-overlay');
    if (ov) { ov.classList.remove('hidden'); return; }
    var cs = $('call-screen');
    if (!cs) return;
    var div = document.createElement('div');
    div.id = 'call-reconn-overlay';
    div.className = 'absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-30';
    div.innerHTML = '<div class="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>' +
      '<p class="text-white font-semibold text-sm">Reconnecting…</p>' +
      '<p class="text-white/50 text-xs mt-1" id="reconn-attempt-text"></p>';
    cs.appendChild(div);
  }

  function hideReconnOverlay() {
    var ov = $('call-reconn-overlay');
    if (ov) ov.classList.add('hidden');
  }

  function tryReconnect() {
    if (!peerConnection || state === STATES.ENDED || state === STATES.IDLE) return;
    if (reconnAttempt >= MAX_RECONN_ATTEMPTS) {
      txt('call-status', 'Connection lost');
      endCall();
      return;
    }
    reconnAttempt++;
    txt('reconn-attempt-text', 'Attempt ' + reconnAttempt + ' of ' + MAX_RECONN_ATTEMPTS);
    clearTimeout(reconnAttemptTimer);
    reconnAttemptTimer = setTimeout(function () {
      if (!peerConnection || state === STATES.ENDED) return;
      try {
        peerConnection.restartIce();
      } catch (_) {
        attemptFullReconnect();
      }
    }, 2000);
  }

  function attemptFullReconnect() {
    if (!peerConnection || state === STATES.ENDED) return;
    peerConnection.close();
    peerConnection = null;
    peerConnection = new RTCPeerConnection(defaultRtcConfig);
    if (localCallStream) addLocalTracks(localCallStream);
    setupPeerConnection(peerConnection);
    if (callType === 'voice') {
      createOfferAndSignal();
    }
  }

  async function createOfferAndSignal() {
    if (!peerConnection || !db() || !callId) return;
    try {
      var offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await db().collection('calls').doc(callId).update({
        offer: { sdp: offer.sdp, type: offer.type }
      });
    } catch (_) {}
  }

  function startQualityAdaptation() {
    clearInterval(qualityInterval);
    if (callType !== 'video' || !peerConnection) return;
    qualityInterval = setInterval(async function () {
      if (!peerConnection || state !== STATES.ACTIVE) return;
      try {
        var stats = await peerConnection.getStats();
        var rtt = null;
        stats.forEach(function (report) {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime != null) {
            rtt = report.currentRoundTripTime * 1000;
          }
        });
        var sender = peerConnection.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
        if (sender && sender.getParameters) {
          var params = sender.getParameters();
          if (!params.encodings || !params.encodings.length) params.encodings = [{}];
          var maxBr = 2500000;
          if (rtt !== null && rtt > 300) maxBr = 500000;
          else if (rtt !== null && rtt > 150) maxBr = 1000000;
          params.encodings[0].maxBitrate = maxBr;
          sender.setParameters(params).catch(function () {});
        }
      } catch (_) {}
    }, 5000);
  }

  function startHeartbeat(cId) {
    clearInterval(heartbeatHandle);
    heartbeatHandle = setInterval(function () {
      if (!db() || !uid()) return;
      db().collection('calls').doc(cId).update({
        heartbeat: firebase.firestore.FieldValue.serverTimestamp(),
        heartbeatUid: uid()
      }).catch(function () {});
    }, 15000);
  }

  async function getMedia(type) {
    var constraints = { audio: true };
    if (type === 'video') {
      constraints.video = {
        facingMode: preferredCameraFacingMode,
        width: { ideal: window.isTablet ? 1920 : 1280 },
        height: { ideal: window.isTablet ? 1080 : 720 }
      };
    }
    var stream = await navigator.mediaDevices.getUserMedia(constraints);
    localCallStream = stream;
    if (type === 'video') {
      var lv = $('local-video');
      if (lv) { lv.srcObject = stream; show('local-video-container'); }
    }
    return stream;
  }

  function listenAnswer(cId) {
    if (!db()) return;
    unsubAnswer = db().collection('calls').doc(cId).onSnapshot(function (doc) {
      var data = doc.data();
      if (!data) return;
      if (data.status === 'active' && data.answer && peerConnection && peerConnection.signalingState === 'have-local-offer') {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(function () {});
      }
      if (data.status === 'ended' || data.status === 'missed' || data.status === 'rejected' || data.status === 'cancelled') {
        endCall();
      }
    });
  }

  function listenCandidates(cId) {
    if (!db()) return;
    var myUid = uid();
    unsubCandidates = db().collection('calls').doc(cId).collection('candidates')
      .orderBy('createdAt').onSnapshot(function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === 'added') {
            var c = change.doc.data();
            if (c.sender !== myUid && peerConnection) {
              peerConnection.addIceCandidate(new RTCIceCandidate(c.candidate)).catch(function () {});
            }
          }
        });
      });
  }

  function listenStatus(cId) {
    if (!db()) return;
    unsubStatus = db().collection('calls').doc(cId).onSnapshot(function (doc) {
      var data = doc.data();
      if (!data) return;
      if (data.status === 'ended' || data.status === 'missed' || data.status === 'rejected' || data.status === 'cancelled') {
        endCall();
      }
    });
  }

  function listenIncomingCalls() {
    if (!db() || !uid()) return;
    if (unsubIncoming) unsubIncoming();
    var myUid = uid();
    unsubIncoming = db().collection('calls')
      .where('toUserId', '==', myUid)
      .where('status', '==', 'ringing')
      .onSnapshot(function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === 'added') {
            var call = change.doc.data();
            if (call.fromUserId === myUid) return;
            if (state !== STATES.IDLE) {
              db().collection('calls').doc(change.doc.id).update({ status: 'missed' }).catch(function () {});
              return;
            }
            incomingData = {
              callId: change.doc.id,
              type: call.type,
              fromUserId: call.fromUserId,
              fromUserName: call.fromUserName || 'Unknown',
              groupCall: call.groupCall,
              groupId: call.groupId,
              groupName: call.groupName,
              toUserId: call.toUserId
            };
            showIncomingCall(incomingData);
            broadcastToTabs('incoming-call', { callId: change.doc.id });
          }
          if (change.type === 'removed' || change.type === 'modified') {
            var cd = change.doc.data();
            if (cd && (cd.status === 'active' || cd.status === 'ended' || cd.status === 'rejected' || cd.status === 'missed' || cd.status === 'cancelled')) {
              hideIncomingCall();
              if (incomingData && incomingData.callId === change.doc.id) incomingData = null;
            }
          }
        });
      });
    if (bcChannel) {
      if (incomingBcHandler) bcChannel.removeEventListener('message', incomingBcHandler);
      incomingBcHandler = function (e) {
        if (e.data && (e.data.type === 'call-accepted' || e.data.type === 'call-ended')) {
          hideIncomingCall();
        }
      };
      bcChannel.addEventListener('message', incomingBcHandler);
    }
  }

  function showIncomingCall(data) {
    var name = data.fromUserName || 'Unknown';
    txt('incoming-call-name', name);
    var isGroup = data.groupCall === true;
    txt('incoming-call-type', (isGroup ? '👥 ' : '') + (data.type === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'));
    var av = $('incoming-call-avatar');
    if (av) av.textContent = name[0]?.toUpperCase() || '?';
    show('incoming-call-overlay');
    playSound('callRing');
    if (navigator.vibrate) navigator.vibrate([700, 250, 700, 250, 700, 250, 700, 250, 700]);
    requestWake();
    incomingTimeoutHandle = setTimeout(function () {
      if (incomingData && incomingData.callId === data.callId) {
        hideIncomingCall();
        if (db()) {
          db().collection('calls').doc(data.callId).update({ status: 'missed' }).catch(function () {});
        }
        incomingData = null;
      }
    }, CALL_TIMEOUT_MS);
  }

  function hideIncomingCall() {
    hide('incoming-call-overlay');
    stopExistingRingtone();
    if (incomingTimeoutHandle) { clearTimeout(incomingTimeoutHandle); incomingTimeoutHandle = null; }
  }

  function setupIncomingAnswer(cId, type, fromUserName, groupCall, groupId, groupName) {
    setState(STATES.CONNECTING);
    showCallScreen(type, fromUserName, (fromUserName || '?')[0].toUpperCase());
  }

  function cleanup() {
    cleanupListeners();
    clearAllTimers();
    if (screenShareStream) { screenShareStream.getTracks().forEach(function (t) { t.stop(); }); screenShareStream = null; screenShareSender = null; }
    if (peerConnection) { try { peerConnection.close(); } catch (_) {} peerConnection = null; }
    if (localCallStream) { localCallStream.getTracks().forEach(function (t) { t.stop(); }); localCallStream = null; }
    remoteCallStream = null;
    var rv = $('remote-video');
    var lv = $('local-video');
    if (rv) rv.srcObject = null;
    if (lv) lv.srcObject = null;
    hide('call-screen');
    var bb = $('call-bubble');
    if (bb) bb.style.display = 'none';
    hide('local-video-container');
    var ssIcon = $('screenshare-icon');
    if (ssIcon) ssIcon.textContent = 'screen_share';
    show('call-info-section');
    var encBadge = $('call-encryption-badge');
    if (encBadge) encBadge.remove();
    hideReconnOverlay();
    var cs = $('call-reconn-overlay');
    if (cs) cs.remove();
    App.callActive = false;
    App._activeCallId = null;
    activeCallMode = null;
    incomingData = null;
    reconnAttempt = 0;
    speakerOn = false;
    micMuted = false;
    cameraOff = false;
    isScreenSharing = false;
    if (typeof cleanupGroupCalls === 'function') cleanupGroupCalls();
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC: startVoiceCall / startVideoCall
     ═══════════════════════════════════════════════════ */
  async function startVoiceCall() {
    if (state !== STATES.IDLE) return;
    if (!uid() || !db()) { toast('Not signed in', 'error'); return; }
    var c = chat();
    if (c && c.type === 'group') { startGroupCall('voice'); return; }
    if (c && c.uid) { await initiateOutgoingCall('voice', c); return; }
    openCallPicker();
  }

  async function startVideoCall() {
    if (state !== STATES.IDLE) return;
    if (!uid() || !db()) { toast('Not signed in', 'error'); return; }
    var c = chat();
    if (c && c.type === 'group') { startGroupCall('video'); return; }
    if (c && c.uid) { await initiateOutgoingCall('video', c); return; }
    openCallPicker();
  }

  async function initiateOutgoingCall(type, targetChat) {
    var myUid = uid();
    var otherUid = targetChat.uid;
    if (!otherUid) return;

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(type === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) return;
    }

    setState(STATES.CONNECTING);
    callId = null;
    callType = type;
    showCallScreen(type, targetChat.name, targetChat.initials);

    try {
      await getMedia(type);
      var rtcConfig = await getRtcConfig();
      peerConnection = new RTCPeerConnection(rtcConfig);
      addLocalTracks(localCallStream);
      setupPeerConnection(peerConnection);

      var offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      var callRef = await db().collection('calls').add({
        fromUserId: myUid,
        fromUserName: me()?.displayName || 'User',
        toUserId: otherUid,
        type: type,
        status: 'ringing',
        groupCall: false,
        offer: { sdp: offer.sdp, type: offer.type },
        participants: [myUid, otherUid],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      callId = callRef.id;
      App._activeCallId = callRef.id;
      listenAnswer(callId);
      listenCandidates(callId);
      listenStatus(callId);
      requestWake();
      startHeartbeat(callId);
      playSound('outgoingCall');

      timeoutHandle = setTimeout(function () {
        if (callId && state !== STATES.IDLE && state !== STATES.ACTIVE) {
          txt('call-status', 'No answer');
          endCall();
        }
      }, CALL_TIMEOUT_MS);

    } catch (err) {
      console.error('Call start error:', err);
      toast('Could not start call: ' + (err.name === 'NotAllowedError' ? 'Camera/mic permission denied' : err.message), 'error');
      cleanup();
      setState(STATES.IDLE);
    }
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC: acceptCall
     ═══════════════════════════════════════════════════ */
  async function acceptCall() {
    if (!incomingData) return;
    hideIncomingCall();
    broadcastToTabs('call-accepted', { callId: incomingData.callId });

    if (incomingData.groupCall) {
      acceptGroupCall(incomingData);
      incomingData = null;
      return;
    }

    var myUid = uid();
    if (!myUid || !db()) return;

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(incomingData.type === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) { incomingData = null; return; }
    }

    callId = incomingData.callId;
    callType = incomingData.type;
    var fromName = incomingData.fromUserName;

    setState(STATES.CONNECTING);
    showCallScreen(incomingData.type, fromName, (fromName || '?')[0].toUpperCase());

    try {
      await getMedia(incomingData.type);
      var rtcConfig = await getRtcConfig();
      peerConnection = new RTCPeerConnection(rtcConfig);
      addLocalTracks(localCallStream);
      setupPeerConnection(peerConnection);

      var callDoc = await db().collection('calls').doc(callId).get();
      var callSnapshot = callDoc.data();
      if (callSnapshot && callSnapshot.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(callSnapshot.offer));
        var answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await db().collection('calls').doc(callId).update({
          answer: { sdp: answer.sdp, type: answer.type },
          status: 'active'
        });
      }

      listenCandidates(callId);
      listenStatus(callId);
      requestWake();
      startHeartbeat(callId);

    } catch (err) {
      console.error('Accept call error:', err);
      toast('Could not connect call', 'error');
      cleanup();
      setState(STATES.IDLE);
    }

    incomingData = null;
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC: declineCall
     ═══════════════════════════════════════════════════ */
  function declineCall() {
    stopExistingRingtone();
    hideIncomingCall();
    if (incomingData) {
      broadcastToTabs('call-ended', { callId: incomingData.callId });
      if (db() && incomingData.callId) {
        db().collection('calls').doc(incomingData.callId).update({ status: 'rejected' }).catch(function () {});
      }
      playSound('callDeclined');
      incomingData = null;
    }
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC: endCall
     ═══════════════════════════════════════════════════ */
  function endCall() {
    var wasActive = state === STATES.ACTIVE;
    var dur = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;

    txt('call-status', dur > 0 ? 'Call ended' : 'Call ended');
    cleanup();
    setState(STATES.ENDED);

    if (callId && db()) {
      var payload = { status: 'ended', endedAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (dur > 0) payload.duration = dur;
      db().collection('calls').doc(callId).update(payload).catch(function () {});
      writeCallLog('outgoing', 'ended', dur > 0 ? dur * 1000 : null);
    }

    if (wasActive && dur > 0) {
      playSound('callEnded');
      toast('Call ended · ' + fmtDur(dur), 'info');
    } else if (wasActive) {
      playSound('callEnded');
    }

    callId = null;
    callStartTime = null;
    releaseWake();
    setTimeout(function () { setState(STATES.IDLE); }, 300);
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC: toggleMute / toggleCamera / toggleSpeaker
     ═══════════════════════════════════════════════════ */
  function toggleMute() {
    micMuted = !micMuted;
    if (localCallStream) localCallStream.getAudioTracks().forEach(function (t) { t.enabled = !micMuted; });
    var btn = $('btn-mute');
    var icon = $('mute-icon');
    if (btn) btn.classList.toggle('bg-red-500', micMuted);
    if (icon) icon.textContent = micMuted ? 'mic_off' : 'mic';
  }

  function toggleCamera() {
    cameraOff = !cameraOff;
    if (localCallStream) localCallStream.getVideoTracks().forEach(function (t) { t.enabled = !cameraOff; });
    var icon = $('cam-icon');
    if (icon) icon.textContent = cameraOff ? 'videocam_off' : 'videocam';
  }

  function toggleSpeaker() {
    speakerOn = !speakerOn;
    var icon = $('speaker-icon');
    if (icon) icon.textContent = speakerOn ? 'volume_up' : 'volume_off';
    var btn = $('btn-speaker');
    if (btn) btn.classList.toggle('bg-primary/30', speakerOn);
    var rv = $('remote-video');
    if (rv) {
      rv.volume = speakerOn ? 1.0 : 0.7;
      if (speakerOn && typeof rv.setSinkId === 'function') {
        navigator.mediaDevices?.enumerateDevices?.().then(function (devices) {
          var speaker = devices.find(function (d) { return d.kind === 'audiooutput' && d.label.toLowerCase().includes('speaker'); });
          if (speaker) rv.setSinkId(speaker.deviceId).catch(function () {});
        }).catch(function () {});
      }
    }
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC: toggleScreenShare
     ═══════════════════════════════════════════════════ */
  async function toggleScreenShare() {
    if (screenShareStream) {
      screenShareStream.getTracks().forEach(function (t) { t.stop(); });
      screenShareStream = null;
      if (screenShareSender && peerConnection && localCallStream) {
        var camTrack = localCallStream.getVideoTracks()[0];
        if (camTrack) await screenShareSender.replaceTrack(camTrack).catch(function () {});
      }
      screenShareSender = null;
      var lv1 = $('local-video');
      if (lv1 && localCallStream) lv1.srcObject = localCallStream;
      var si = $('screenshare-icon');
      if (si) si.textContent = 'screen_share';
      isScreenSharing = false;
      toast('Screen share stopped', 'info');
      return;
    }
    try {
      var screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenShareStream = screenStream;
      var screenTrack = screenStream.getVideoTracks()[0];
      screenShareSender = peerConnection?.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
      if (screenShareSender) await screenShareSender.replaceTrack(screenTrack);
      var lv2 = $('local-video');
      if (lv2) lv2.srcObject = screenStream;
      var si2 = $('screenshare-icon');
      if (si2) si2.textContent = 'stop_screen_share';
      isScreenSharing = true;
      screenTrack.onended = function () { toggleScreenShare(); };
      toast('Sharing your screen', 'info');
    } catch (_) { toast('Screen share cancelled', 'info'); }
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC: switchCamera
     ═══════════════════════════════════════════════════ */
  async function switchCamera() {
    preferredCameraFacingMode = preferredCameraFacingMode === 'user' ? 'environment' : 'user';
    if (!localCallStream || callType !== 'video') return;
    try {
      var newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: preferredCameraFacingMode,
          width: { ideal: window.isTablet ? 1920 : 1280 },
          height: { ideal: window.isTablet ? 1080 : 720 }
        }
      });
      var newTrack = newStream.getVideoTracks()[0];
      var sender = peerConnection?.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
      if (sender) await sender.replaceTrack(newTrack);
      localCallStream.getVideoTracks()[0].stop();
      localCallStream.removeTrack(localCallStream.getVideoTracks()[0]);
      localCallStream.addTrack(newTrack);
      var lv = $('local-video');
      if (lv) lv.srcObject = localCallStream;
    } catch (_) {}
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC: minimizeCall / maximizeCall
     ═══════════════════════════════════════════════════ */
  function minimizeCall() {
    hide('call-screen');
    if (App.callActive) {
      var bubble = $('call-bubble');
      if (bubble) {
        bubble.style.display = 'flex';
        txt('bubble-call-name', $('call-name')?.textContent || 'Call');
        txt('bubble-call-timer', $('call-timer')?.textContent || '0:00');
      }
      if (navigator.vibrate) navigator.vibrate(30);
    }
  }

  function maximizeCall() {
    if (!App.callActive) return;
    var bubble = $('call-bubble');
    if (bubble) bubble.style.display = 'none';
    show('call-screen');
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC: openCallPicker / selectCallContact
     ═══════════════════════════════════════════════════ */
  async function openCallPicker() {
    if (state !== STATES.IDLE) { toast('Already in a call', 'info'); return; }
    var list = $('call-picker-list');
    if (!list) return;
    list.innerHTML = '<div class="flex items-center justify-center p-8 text-on-surface-variant text-sm"><div class="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-3"></div>Loading contacts…</div>';
    show('call-picker-overlay');

    try {
      var myUid = uid();
      if (!myUid || !db()) { list.innerHTML = '<p class="text-on-surface-variant text-sm text-center p-8">Sign in to make calls</p>'; return; }

      var usersSnap = await db().collection('users').orderBy('displayName').limit(100).get();
      var html = '';
      usersSnap.forEach(function (doc) {
        var u = doc.data();
        var uId = doc.id;
        if (uId === myUid) return;
        if (u.deletedAt || u.deletionScheduledAt) return;
        var name = u.displayName || u.email || 'Unknown';
        var initials = (name[0] || '?').toUpperCase();
        var avatarHtml = u.photoURL
          ? '<img src="' + u.photoURL + '" class="w-11 h-11 rounded-full object-cover" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm" style="display:none">' + escHtml(initials) + '</div>'
          : '<div class="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">' + escHtml(initials) + '</div>';
        html += '<div class="flex items-center gap-3 px-4 py-3 hover:bg-surface-variant/50 rounded-xl cursor-pointer transition-colors" onclick="selectCallContact(\'' + escHtml(uId) + '\',\'' + escHtml(name.replace(/'/g, "\\'")) + '\',\'' + escHtml(u.photoURL || '') + '\')">' +
          avatarHtml +
          '<div class="flex-1 min-w-0">' +
          '<div class="font-semibold text-sm text-on-surface truncate">' + escHtml(name) + '</div>' +
          '<div class="text-xs text-on-surface-variant">' + escHtml(u.email || '') + '</div>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
          '<button class="w-9 h-9 rounded-full bg-green-500/10 text-green-500 hover:bg-green-500/20 flex items-center justify-center transition-all" title="Voice call"><span class="material-symbols-outlined text-lg">call</span></button>' +
          '<button class="w-9 h-9 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 flex items-center justify-center transition-all" title="Video call"><span class="material-symbols-outlined text-lg">videocam</span></button>' +
          '</div></div>';
      });

      if (!html) {
        html = '<p class="text-on-surface-variant text-sm text-center p-8">No contacts found</p>';
      }
      list.innerHTML = html;
    } catch (err) {
      console.warn('Call picker load error:', err);
      list.innerHTML = '<p class="text-on-surface-variant text-sm text-center p-8">Failed to load contacts</p>';
    }
  }

  function selectCallContact(targetUid, targetName, targetAvatar) {
    closeModalFn('call-picker-overlay');
    var c = { uid: targetUid, name: targetName, initials: (targetName || '?')[0].toUpperCase(), type: 'direct', photoURL: targetAvatar };
    if (state !== STATES.IDLE) { toast('Already in a call', 'info'); return; }
    initiateOutgoingCall('voice', c);
  }

  function escHtml(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); }

  /* ═══════════════════════════════════════════════════
     GROUP CALLS
     ═══════════════════════════════════════════════════ */
  async function startGroupCall(type) {
    var c = chat();
    if (!c || !db() || !uid()) return;
    if (c.type !== 'group') return;
    var myUid = uid();
    var memberIds = (c.members || []).filter(function (m) { return m && m !== myUid; });
    if (!memberIds.length) { toast('No other members to call', 'info'); return; }

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(type === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) return;
    }

    callType = type;
    activeCallMode = 'group';
    showCallScreen(type, c.name, c.initials || 'G');
    txt('call-quality-text', type === 'video' ? 'HD Group Video' : 'HD Group Voice');
    txt('call-status', 'Calling ' + memberIds.length + ' people…');

    try {
      await getMedia(type);
      var allParticipants = [myUid].concat(memberIds);
      var callRef = await db().collection('calls').add({
        fromUserId: myUid,
        fromUserName: me()?.displayName || 'User',
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
      callId = callRef.id;
      App._activeCallId = callRef.id;
      if (typeof listenForGroupCallParticipants === 'function') listenForGroupCallParticipants(callId, type);
      listenStatus(callId);
      requestWake();
      startHeartbeat(callId);
      timeoutHandle = setTimeout(function () {
        if (callId && state !== STATES.ACTIVE && state !== STATES.IDLE) {
          txt('call-status', 'No answer');
          endCall();
        }
      }, CALL_TIMEOUT_MS);
    } catch (err) {
      console.error('Group call error:', err);
      toast('Could not start group call: ' + err.message, 'error');
      cleanup();
      setState(STATES.IDLE);
    }
  }

  function acceptGroupCall(data) {
    if (typeof window._handleAcceptedGroupCall === 'function') {
      window._handleAcceptedGroupCall(data);
    }
  }

  /* ═══════════════════════════════════════════════════
     DRAGGABLE FLOATING BUBBLE
     ═══════════════════════════════════════════════════ */
  function initBubbleDrag() {
    var bubble = $('call-bubble');
    if (!bubble || bubble.dataset.dragInit) return;
    bubble.dataset.dragInit = '1';

    var dragging = false;
    var startX = 0, startY = 0;
    var origLeft = 0, origTop = 0;
    var moved = false;
    var isRight = true;

    function getPos(e) {
      if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: e.clientX, y: e.clientY };
    }

    function onStart(e) {
      var rect = bubble.getBoundingClientRect();
      isRight = rect.left > window.innerWidth / 2;
      origLeft = isRight ? (window.innerWidth - rect.right) : rect.left;
      origTop = rect.top;
      var pos = getPos(e);
      startX = pos.x;
      startY = pos.y;
      dragging = true;
      moved = false;
      bubble.style.transition = 'none';
      bubble.style.right = 'auto';
      bubble.style.left = 'auto';
      bubble.style.bottom = 'auto';
      bubble.style.top = origTop + 'px';
      if (isRight) bubble.style.right = origLeft + 'px';
      else bubble.style.left = origLeft + 'px';
    }

    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      var pos = getPos(e);
      var dx = pos.x - startX;
      var dy = pos.y - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;
      var newTop = Math.max(0, Math.min(window.innerHeight - 50, origTop + dy));
      var newSide = origLeft + dx;
      bubble.style.top = newTop + 'px';
      if (isRight) {
        bubble.style.right = Math.max(0, Math.min(window.innerWidth - 60, newSide)) + 'px';
        bubble.style.left = 'auto';
      } else {
        bubble.style.left = Math.max(0, Math.min(window.innerWidth - 60, newSide)) + 'px';
        bubble.style.right = 'auto';
      }
    }

    function onEnd() {
      if (!dragging) return;
      dragging = false;
      bubble.style.transition = '';
      var rect = bubble.getBoundingClientRect();
      var nearRight = rect.left > window.innerWidth / 2;
      var nearBottom = rect.top > window.innerHeight / 2;
      bubble.style.right = 'auto';
      bubble.style.left = 'auto';
      bubble.style.bottom = 'auto';
      bubble.style.top = 'auto';
      if (nearRight) {
        bubble.style.right = Math.max(24, window.innerWidth - rect.right) + 'px';
      } else {
        bubble.style.left = Math.max(24, rect.left) + 'px';
      }
      bubble.style.bottom = Math.max(24, window.innerHeight - rect.bottom) + 'px';
    }

    bubble.addEventListener('mousedown', function (e) { if (e.target.closest('button')) return; onStart(e); });
    bubble.addEventListener('touchstart', function (e) { if (e.target.closest('button')) return; onStart(e); }, { passive: true });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);

    var origClick = bubble.onclick;
    bubble.addEventListener('click', function (e) {
      if (moved || e.target.closest('button')) return;
      maximizeCall();
    });
  }

  /* ═══════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════ */
  function init() {
    listenIncomingCalls();
    initBubbleDrag();
    var origMinimize = window.minimizeCall;
    if (!origMinimize || origMinimize === minimizeCall) {
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 0); });
  }

  /* ═══════════════════════════════════════════════════
     EXPORT TO WINDOW
     ═══════════════════════════════════════════════════ */
  window.startVoiceCall = startVoiceCall;
  window.startVideoCall = startVideoCall;
  window.acceptCall = acceptCall;
  window.declineCall = declineCall;
  window.endCall = endCall;
  window.toggleMute = toggleMute;
  window.toggleCamera = toggleCamera;
  window.toggleSpeaker = toggleSpeaker;
  window.toggleScreenShare = toggleScreenShare;
  window.switchCamera = switchCamera;
  window.minimizeCall = minimizeCall;
  window.maximizeCall = maximizeCall;
  window.openCallPicker = openCallPicker;
  window.selectCallContact = selectCallContact;

  if (typeof window.startGroupVoiceCall !== 'function') {
    window.startGroupVoiceCall = function () { startGroupCall('voice'); };
  }
  if (typeof window.startGroupVideoCall !== 'function') {
    window.startGroupVideoCall = function () { startGroupCall('video'); };
  }

})();
