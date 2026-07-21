/* call-controller-core.js — WebRTC setup, peer connection, ICE candidates, SDP offer/answer */
(function () {
  'use strict';

  var CC = window._CC = window._CC || {};

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
  CC.unsubCandidates = null;
  CC.unsubStatus = null;
  CC.unsubIncoming = null;
  CC.incomingTimeoutHandle = null;
  CC.screenShareStream = null;
  CC.screenShareSender = null;
  CC.incomingData = null;
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
    var m = Math.floor(sec / 60);
    var s = sec % 60;
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
    if (CC.unsubCandidates) { try { CC.unsubCandidates(); } catch (_) {} CC.unsubCandidates = null; }
    if (CC.unsubStatus) { try { CC.unsubStatus(); } catch (_) {} CC.unsubStatus = null; }
    if (CC.incomingTimeoutHandle) { clearTimeout(CC.incomingTimeoutHandle); CC.incomingTimeoutHandle = null; }
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
    if (CC.bcChannel) {
      try { CC.bcChannel.postMessage(Object.assign({ type: type }, extra || {})); } catch (_) {}
    }
  }

  function writeCallLog(direction, status, durationMs) {
    if (typeof window.recordCallSyncEvent === 'function') {
      window.recordCallSyncEvent({
        callId: CC.callId,
        direction: direction,
        status: status,
        callType: CC.callType,
        fromUserId: uid(),
        fromUserName: me()?.displayName || 'User',
        toUserId: CC.incomingData?.fromUserId || CC.incomingData?.toUserId || '',
        toUserName: CC.incomingData?.fromUserName || CC.incomingData?.toUserName || '',
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
  }

  function onCallConnected() {
    setState(CC.STATES.ACTIVE);
    txt('call-status', 'Active');
    stopExistingRingtone();
    show('call-timer');
    startTimer();
    hideReconnOverlay();
    CC.reconnAttempt = 0;
    startQualityAdaptation();
    var ssBtn = $('btn-screenshare');
    if (ssBtn) ssBtn.classList.toggle('hidden', CC.callType === 'voice');
    playSound('callConnected');
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

  function attemptFullReconnect() {
    if (!peerConnection || CC.state === CC.STATES.ENDED) return;
    peerConnection.close();
    peerConnection = null;
    peerConnection = new RTCPeerConnection(defaultRtcConfig);
    if (localCallStream) addLocalTracks(localCallStream);
    setupPeerConnection(peerConnection);
    if (CC.callType === 'voice') {
      createOfferAndSignal();
    }
  }

  async function createOfferAndSignal() {
    if (!peerConnection || !db() || !CC.callId) return;
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
    if (CC.callType !== 'video' || !peerConnection) return;
    CC.qualityInterval = setInterval(async function () {
      if (!peerConnection || CC.state !== CC.STATES.ACTIVE) return;
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
    CC.unsubStatus = db().collection('calls').doc(cId).onSnapshot(function (doc) {
      var data = doc.data();
      if (!data) return;
      if (data.status === 'ended' || data.status === 'missed' || data.status === 'rejected' || data.status === 'cancelled') {
        window.endCall();
      }
    });
  }

  function cleanup() {
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
    App.callActive = false;
    App._activeCallId = null;
    activeCallMode = null;
    CC.incomingData = null;
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
  CC.listenCandidates = listenCandidates;
  CC.listenStatus = listenStatus;
  CC.cleanup = cleanup;

})();
