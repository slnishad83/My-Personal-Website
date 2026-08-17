/* call-controller-core.js � WebRTC setup, peer connection, ICE candidates, SDP offer/answer */
(function () {
  'use strict';

  var CC = window._CC = window._CC || {};

  var peerConnection = null;
  var localCallStream = null;
  var remoteCallStream = null;
  var micMuted = false;
  var cameraOff = false;
  var speakerOn = false;
  var isScreenSharing = false;
  var activeCallMode = null;
  var preferredCameraFacingMode = 'user';

  CC.getPeerConnection = function () { return peerConnection; };
  CC.getLocalStream = function () { return localCallStream; };
  CC.getRemoteStream = function () { return remoteCallStream; };
  CC.isMicMuted = function () { return micMuted; };
  CC.isCameraOff = function () { return cameraOff; };
  CC.isSpeakerOn = function () { return speakerOn; };
  CC.isScreenSharing = function () { return isScreenSharing; };
  CC.getActiveCallMode = function () { return activeCallMode; };
  CC.getPreferredCameraFacingMode = function () { return preferredCameraFacingMode; };
  CC.setMicMuted = function (v) { micMuted = v; };
  CC.setCameraOff = function (v) { cameraOff = v; };
  CC.setSpeakerOn = function (v) { speakerOn = v; };
  CC.setScreenSharing = function (v) { isScreenSharing = v; };
  CC.setActiveCallMode = function (v) { activeCallMode = v; };
  CC.setPreferredCameraFacingMode = function (v) { preferredCameraFacingMode = v; };
  CC.setPeerConnection = function (v) { peerConnection = v; };
  CC.setLocalStream = function (v) { localCallStream = v; };
  CC.setRemoteStream = function (v) { remoteCallStream = v; };

  CC.STATES = { IDLE: 0, RINGING: 1, CONNECTING: 2, ACTIVE: 3, ENDED: 4 };
  CC.state = CC.STATES.IDLE;
  CC.callType = 'voice';
  CC.callId = null;
  CC.callStartTime = null;
  CC.timerInterval = null;
  CC.timeoutHandle = null;
  CC.heartbeatHandle = null;
  CC.qualityInterval = null;
  CC.reconnOverlayTimer = null;
  CC.reconnAttemptTimer = null;
  CC.reconnAttempt = 0;
  CC.MAX_RECONN_ATTEMPTS = 5;
  CC.CALL_TIMEOUT_MS = 45000;
  CC.unsubAnswer = null;
  CC.unsubOffer = null;
  CC.unsubCandidates = null;
  CC.unsubStatus = null;
  CC.unsubIncoming = null;
  CC.incomingTimeoutHandle = null;
  CC.screenShareStream = null;
  CC.screenShareSender = null;
  CC.incomingData = null;
  CC.callMeta = null;
  CC.bcChannel = null;
  try { CC.bcChannel = new BroadcastChannel('tc-calls'); } catch (_) {}
  CC.incomingBcHandler = null;

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

  function escHtml(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); }

  function setState(s) { CC.state = s; }

  function stopTimer() { clearInterval(CC.timerInterval); CC.timerInterval = null; }
  function startTimer() {
    stopTimer();
    CC.callStartTime = Date.now();
    CC.timerInterval = setInterval(function () {
      var s = Math.floor((Date.now() - CC.callStartTime) / 1000);
      var d = fmtDur(s);
      txt('call-timer', d);
      txt('bubble-call-timer', d);
    }, 1000);
  }
  function fmtDur(sec) {
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function clearAllTimers() {
    clearTimeout(CC.timeoutHandle); CC.timeoutHandle = null;
    clearInterval(CC.heartbeatHandle); CC.heartbeatHandle = null;
    clearInterval(CC.qualityInterval); CC.qualityInterval = null;
    clearTimeout(CC.reconnOverlayTimer); CC.reconnOverlayTimer = null;
    clearTimeout(CC.reconnAttemptTimer); CC.reconnAttemptTimer = null;
    stopTimer();
  }

  function cleanupListeners() {
    if (CC.unsubAnswer) { try { CC.unsubAnswer(); } catch (_) {} CC.unsubAnswer = null; }
    if (CC.unsubOffer) { try { CC.unsubOffer(); } catch (_) {} CC.unsubOffer = null; }
    if (CC.unsubCandidates) { try { CC.unsubCandidates(); } catch (_) {} CC.unsubCandidates = null; }
    if (CC.unsubStatus) { try { CC.unsubStatus(); } catch (_) {} CC.unsubStatus = null; }
    if (CC.incomingTimeoutHandle) { clearTimeout(CC.incomingTimeoutHandle); CC.incomingTimeoutHandle = null; }
  }

  function stopExistingRingtone() {
    if (typeof window.Orchestrator !== 'undefined' && typeof window.Orchestrator.stopRingtone === 'function') {
      window.Orchestrator.stopRingtone();
    }
  }

  function playSound(name) {
    if (window.NotificationSounds && typeof window.NotificationSounds.play === 'function') {
      window.NotificationSounds.play(name);
    }
  }

  var _wakeLock = null;
  function requestWake() {
    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen').then(function(lock) { _wakeLock = lock; }).catch(function() {});
    }
  }
  function releaseWake() {
    if (_wakeLock) { try { _wakeLock.release(); } catch(_) {} _wakeLock = null; }
  }

  function broadcastToTabs(type, extra) {
    if (CC.bcChannel) {
      try { CC.bcChannel.postMessage(Object.assign({ type: type }, extra || {})); } catch (_) {}
    }
  }

  function writeCallLog(direction, status, durationMs, metaOverride) {
    if (typeof window.recordCallSyncEvent === 'function') {
      var meta = metaOverride || CC.callMeta || {};
      var inc = CC.incomingData || {};
      var toUid = meta.toUserId || inc.toUserId || '';
      var toName = meta.toUserName || inc.toUserName || '';
      var toAvatar = meta.toUserAvatar || inc.fromUserPhoto || '';
      window.recordCallSyncEvent({
        callId: (metaOverride && metaOverride.callId) || CC.callId || inc.callId || '',
        direction: direction,
        status: status,
        callType: CC.callType,
        fromUserId: meta.fromUserId || uid() || inc.fromUserId || '',
        fromUserName: meta.fromUserName || me()?.displayName || 'User',
        fromUserAvatar: meta.fromUserAvatar || '',
        toUserId: toUid,
        toUserName: toName,
        toUserAvatar: toAvatar,
        durationMs: durationMs || null,
        participantIds: uid() ? [uid()] : []
      });
    }
  }

  function addLocalTracks(stream) {
    if (!stream || !peerConnection) return;
    stream.getTracks().forEach(function (track) { peerConnection.addTrack(track, stream); });
  }

  function setupPeerConnection(pc) {
    pc.onicecandidate = function (e) {
      if (e.candidate && db() && CC.callId) {
        db().collection('calls').doc(CC.callId).collection('candidates').add({
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
        rv.classList.toggle('hidden', CC.callType === 'voice');
      }
      if (CC.callType === 'video') hide('call-info-section');
      if (remoteCallStream) {
        remoteCallStream.getVideoTracks().forEach(function (track) {
          track.onmute = function () { show('call-info-section'); };
          track.onunmute = function () { if (CC.callType === 'video') hide('call-info-section'); };
        });
      }
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
        if (CC.state === CC.STATES.ACTIVE) {
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
        CC.reconnAttempt = 0;
      }
    };

    pc.onnegotiationneeded = function () {
      if (CC.state !== CC.STATES.ACTIVE) return;
      if (pc.signalingState !== 'stable') return;
      createOfferAndSignal();
    };
  }

  function onCallConnected() {
    setState(CC.STATES.ACTIVE);
    txt('call-status', 'Active');
    stopExistingRingtone();
    if (typeof window._stopOutgoingRingtone === 'function') window._stopOutgoingRingtone();
    show('call-timer');
    startTimer();
    hideReconnOverlay();
    CC.reconnAttempt = 0;
    startQualityAdaptation();
    var ssBtn = $('btn-screenshare');
    if (ssBtn) ssBtn.classList.toggle('hidden', CC.callType === 'voice');
    var holdBtn = $('btn-hold');
    if (holdBtn) holdBtn.classList.remove('hidden');
    var fsBtn = $('btn-fullscreen');
    if (fsBtn) fsBtn.classList.toggle('hidden', !document.fullscreenEnabled && !document.webkitFullscreenEnabled);
    var pipBtn = $('btn-pip');
    if (pipBtn) pipBtn.classList.toggle('hidden', !document.pictureInPictureEnabled || CC.callType === 'voice');
    var swBtn = $('btn-switch-video');
    if (swBtn) swBtn.classList.toggle('hidden', CC.callType !== 'voice');
    var kpBtn = $('btn-keypad');
    if (kpBtn) kpBtn.classList.toggle('hidden', CC.callType !== 'voice');
    var blurBtn = $('btn-blur');
    if (blurBtn) blurBtn.classList.toggle('hidden', CC.callType !== 'video');
    var addBtn = $('btn-add-participant');
    if (addBtn) addBtn.classList.toggle('hidden', CC.getActiveCallMode() === 'group');
    playSound('callConnected');
    if (typeof window.Presence !== 'undefined' && typeof window.Presence.setInCall === 'function') window.Presence.setInCall(true);
    if (window._ProximitySensor && typeof window._ProximitySensor.start === 'function') {
      try { window._ProximitySensor.start(); } catch (_) {}
    }
    if (db() && CC.callId) {
      db().collection('calls').doc(CC.callId).update({
        status: 'active',
        startedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () {});
    }
  }

  function onConnectionFailed() {
    if (CC.state !== CC.STATES.ACTIVE && CC.state !== CC.STATES.CONNECTING) return;
    txt('call-status', 'Call failed');
    showReconnOverlay();
    tryReconnect();
  }

  function onConnectionDisconnected() {
    if (CC.state !== CC.STATES.ACTIVE) return;
    txt('call-status', 'Reconnecting�');
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
      '<p class="text-white font-semibold text-sm">Reconnecting�</p>' +
      '<p class="text-white/50 text-xs mt-1" id="reconn-attempt-text"></p>';
    cs.appendChild(div);
  }

  function hideReconnOverlay() {
    var ov = $('call-reconn-overlay');
    if (ov) ov.classList.add('hidden');
  }

  function tryReconnect() {
    if (!peerConnection || CC.state === CC.STATES.ENDED || CC.state === CC.STATES.IDLE) return;
    if (CC.reconnAttempt >= CC.MAX_RECONN_ATTEMPTS) {
      txt('call-status', 'Connection lost');
      window.endCall();
      return;
    }
    CC.reconnAttempt++;
    txt('reconn-attempt-text', 'Attempt ' + CC.reconnAttempt + ' of ' + CC.MAX_RECONN_ATTEMPTS);
    clearTimeout(CC.reconnAttemptTimer);
    CC.reconnAttemptTimer = setTimeout(function () {
      if (!peerConnection || CC.state === CC.STATES.ENDED) return;
      try {
        peerConnection.restartIce();
      } catch (_) {
        attemptFullReconnect();
      }
    }, 2000);
  }

  async function attemptFullReconnect() {
    if (!peerConnection || CC.state === CC.STATES.ENDED) return;
    peerConnection.close();
    peerConnection = null;
    var rtcConfig = await getRtcConfig();
    peerConnection = new RTCPeerConnection(rtcConfig);
    if (localCallStream) addLocalTracks(localCallStream);
    setupPeerConnection(peerConnection);
    createOfferAndSignal();
  }

  async function createOfferAndSignal() {
    if (!peerConnection || !db() || !CC.callId) return;
    if (peerConnection.signalingState !== 'stable') return;
    try {
      var offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await db().collection('calls').doc(CC.callId).update({
        offer: { sdp: offer.sdp, type: offer.type }
      });
    } catch (_) {}
  }

  function startQualityAdaptation() {
    clearInterval(CC.qualityInterval);
    CC.qualityInterval = setInterval(async function () {
      if (!peerConnection || CC.state !== CC.STATES.ACTIVE) return;
      try {
        var stats = await peerConnection.getStats();
        var rtt = null;
        var packetsLost = 0;
        var packetsReceived = 0;
        stats.forEach(function (report) {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime != null) {
            rtt = report.currentRoundTripTime * 1000;
          }
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            packetsLost = (report.packetsLost || 0);
            packetsReceived = (report.packetsReceived || 0);
          }
        });
        var totalPackets = packetsLost + packetsReceived;
        var packetLoss = totalPackets > 0 ? (packetsLost / totalPackets * 100) : 0;
        if (CC.callType === 'video') {
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
        }
        if (typeof CC.updateCallQuality === 'function') {
          CC.updateCallQuality({ rtt: rtt || 0, packetLoss: packetLoss });
        }
        if (typeof CC.checkCallNetworkQuality === 'function') {
          CC.checkCallNetworkQuality();
        }
      } catch (_) {}
    }, 3000);
  }

  function startHeartbeat(cId) {
    clearInterval(CC.heartbeatHandle);
    CC.heartbeatHandle = setInterval(function () {
      if (!db() || !uid()) return;
      db().collection('calls').doc(cId).update({
        heartbeat: firebase.firestore.FieldValue.serverTimestamp(),
        heartbeatUid: uid()
      }).catch(function () {});
    }, 15000);
  }

  async function getMedia(type) {
    var constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000
      }
    };
    if (type === 'video') {
      constraints.video = {
        facingMode: preferredCameraFacingMode,
        width: { ideal: window.isTablet ? 1920 : 1280 },
        height: { ideal: window.isTablet ? 1080 : 720 },
        frameRate: { ideal: 30, max: 30 }
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
    if (CC.unsubAnswer) { try { CC.unsubAnswer(); } catch(_) {} }
    CC.unsubAnswer = db().collection('calls').doc(cId).onSnapshot(function (doc) {
      var data = doc.data();
      if (!data) return;
      if (data.status === 'active' && data.answer && peerConnection && peerConnection.signalingState === 'have-local-offer') {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(function () {});
      }
      if (data.status === 'ended' || data.status === 'missed' || data.status === 'rejected' || data.status === 'cancelled') {
        window.endCall();
      }
    });
  }

  function listenOffer(cId) {
    if (!db()) return;
    if (CC.unsubOffer) { try { CC.unsubOffer(); } catch(_) {} }
    var _lastOfferSdp = null;
    try { _lastOfferSdp = peerConnection && peerConnection.remoteDescription ? peerConnection.remoteDescription.sdp : null; } catch(_) {}
    CC.unsubOffer = db().collection('calls').doc(cId).onSnapshot(async function (doc) {
      var data = doc.data();
      if (!data || !data.offer) return;
      if (data.offer.sdp === _lastOfferSdp) return;
      if (CC.state !== CC.STATES.ACTIVE && CC.state !== CC.STATES.CONNECTING) return;
      try {
        if (peerConnection.localDescription && peerConnection.localDescription.sdp === data.offer.sdp) return;
      } catch (_) {}
      _lastOfferSdp = data.offer.sdp;
      try {
        // Peer upgraded a voice call to video � enable local video before answering
        // so the answer carries our own video direction (bidirectional upgrade).
        if (data.type === 'video' && CC.callType === 'voice' && typeof CC.handleRemoteVideoUpgrade === 'function') {
          await CC.handleRemoteVideoUpgrade();
        }
        // Glare: if we have a pending local offer (we renegotiated at the same
        // time), roll it back before applying the remote offer.
        if (peerConnection.signalingState === 'have-local-offer') {
          try { await peerConnection.setLocalDescription({ type: 'rollback' }); } catch (_) {}
        }
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        var answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await db().collection('calls').doc(cId).update({ answer: { sdp: answer.sdp, type: answer.type } });
        CC.reconnAttempt = 0;
        hideReconnOverlay();
      } catch (_) {}
    });
  }

  function listenCandidates(cId) {
    if (!db()) return;
    var myUid = uid();
    CC.unsubCandidates = db().collection('calls').doc(cId).collection('candidates')
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
    if (CC.unsubStatus) { try { CC.unsubStatus(); } catch(_) {} }
    CC.unsubStatus = db().collection('calls').doc(cId).onSnapshot(function (doc) {
      var data = doc.data();
      if (!data) return;
      if (data.status === 'ended' || data.status === 'missed' || data.status === 'rejected' || data.status === 'cancelled' || data.status === 'busy') {
        window.endCall(data.status);
      }
      if (data.type === 'video' && CC.callType === 'voice' && (CC.state === CC.STATES.ACTIVE || CC.state === CC.STATES.CONNECTING)) {
        if (typeof CC.handleRemoteVideoUpgrade === 'function') {
          CC.handleRemoteVideoUpgrade();
        }
      }
    });
  }

  function cleanup() {
    if (CC.state === CC.STATES.IDLE) return;
    cleanupListeners();
    clearAllTimers();
    if (CC.screenShareStream) { CC.screenShareStream.getTracks().forEach(function (t) { t.stop(); }); CC.screenShareStream = null; CC.screenShareSender = null; }
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
    if (typeof CC.resetCallHoldState === 'function') CC.resetCallHoldState();
    var holdBtn = $('btn-hold');
    if (holdBtn) holdBtn.classList.add('hidden');
    var fsBtn = $('btn-fullscreen');
    if (fsBtn) fsBtn.classList.add('hidden');
    var pipBtn = $('btn-pip');
    if (pipBtn) pipBtn.classList.add('hidden');
    var swBtn = $('btn-switch-video');
    if (swBtn) swBtn.classList.add('hidden');
    var kpBtn = $('btn-keypad');
    if (kpBtn) kpBtn.classList.add('hidden');
    var blurBtn = $('btn-blur');
    if (blurBtn) blurBtn.classList.add('hidden');
    var addBtn = $('btn-add-participant');
    if (addBtn) addBtn.classList.add('hidden');
    var kpOv = $('call-keypad-overlay');
    if (kpOv) kpOv.classList.add('hidden');
    CC._keypadBuffer = '';
    CC._addParticipantMode = false;
    if (typeof window.stopBackgroundBlur === 'function') { try { window.stopBackgroundBlur(); } catch (_) {} }
    if (document.pictureInPictureElement) { try { document.exitPictureInPicture(); } catch (_) {} }
    if (window._ProximitySensor && typeof window._ProximitySensor.stop === 'function') {
      try { window._ProximitySensor.stop(); } catch (_) {}
    }
    if (typeof window.stopInCallReactionListener === 'function') { try { window.stopInCallReactionListener(); } catch (_) {} }
    App.callActive = false;
    App._activeCallId = null;
    activeCallMode = null;
    CC.incomingData = null;
    CC.callMeta = null;
    CC.callType = 'voice';
    CC.reconnAttempt = 0;
    speakerOn = false;
    micMuted = false;
    cameraOff = false;
    isScreenSharing = false;
    if (typeof cleanupGroupCalls === 'function') cleanupGroupCalls();
  }

  CC.db = db;
  CC.uid = uid;
  CC.me = me;
  CC.chat = chat;
  CC.$ = $;
  CC.txt = txt;
  CC.show = show;
  CC.hide = hide;
  CC.toast = toast;
  CC.closeModalFn = closeModalFn;
  CC.escHtml = escHtml;
  CC.setState = setState;
  CC.stopTimer = stopTimer;
  CC.startTimer = startTimer;
  CC.fmtDur = fmtDur;
  CC.clearAllTimers = clearAllTimers;
  CC.cleanupListeners = cleanupListeners;
  CC.stopExistingRingtone = stopExistingRingtone;
  CC.playSound = playSound;
  CC.requestWake = requestWake;
  CC.releaseWake = releaseWake;
  CC.broadcastToTabs = broadcastToTabs;
  CC.writeCallLog = writeCallLog;
  CC.addLocalTracks = addLocalTracks;
  CC.setupPeerConnection = setupPeerConnection;
  CC.onCallConnected = onCallConnected;
  CC.onConnectionFailed = onConnectionFailed;
  CC.onConnectionDisconnected = onConnectionDisconnected;
  CC.showReconnOverlay = showReconnOverlay;
  CC.hideReconnOverlay = hideReconnOverlay;
  CC.tryReconnect = tryReconnect;
  CC.attemptFullReconnect = attemptFullReconnect;
  CC.createOfferAndSignal = createOfferAndSignal;
  CC.startQualityAdaptation = startQualityAdaptation;
  CC.startHeartbeat = startHeartbeat;
  CC.getMedia = getMedia;
  CC.listenAnswer = listenAnswer;
  CC.listenOffer = listenOffer;
  CC.listenCandidates = listenCandidates;
  CC.listenStatus = listenStatus;
  CC.cleanup = cleanup;

  document.addEventListener('visibilitychange', function () {
    if (CC.state === CC.STATES.ACTIVE && CC.callType === 'video' && document.hidden) {
      var rv = $('remote-video');
      if (rv && !rv.srcObject) return;
      if (rv && document.pictureInPictureEnabled && !document.pictureInPictureElement) {
        rv.requestPictureInPicture().catch(function () {});
      }
    }
  });

})();
