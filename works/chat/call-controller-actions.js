/* call-controller-actions.js â€” Mute, camera, speaker, screen share, hold, end screen, quality badge */
(function () {
  'use strict';

  var CC = window._CC;

  function toggleMute() {
    CC.setMicMuted(!CC.isMicMuted());
    if (CC.getLocalStream()) CC.getLocalStream().getAudioTracks().forEach(function (t) { t.enabled = !CC.isMicMuted(); });
    var btn = CC.$('btn-mute');
    var icon = CC.$('mute-icon');
    if (btn) btn.classList.toggle('bg-red-500', CC.isMicMuted());
    if (icon) icon.textContent = CC.isMicMuted() ? 'mic_off' : 'mic';
  }

  function toggleCamera() {
    CC.setCameraOff(!CC.isCameraOff());
    if (CC.getLocalStream()) CC.getLocalStream().getVideoTracks().forEach(function (t) { t.enabled = !CC.isCameraOff(); });
    var icon = CC.$('cam-icon');
    if (icon) icon.textContent = CC.isCameraOff() ? 'videocam_off' : 'videocam';
  }

  function toggleSpeaker() {
    CC.setSpeakerOn(!CC.isSpeakerOn());
    var icon = CC.$('speaker-icon');
    if (icon) icon.textContent = CC.isSpeakerOn() ? 'volume_up' : 'volume_off';
    var btn = CC.$('btn-speaker');
    if (btn) btn.classList.toggle('bg-primary/30', CC.isSpeakerOn());
    var rv = CC.$('remote-video');
    if (rv) {
      rv.volume = CC.isSpeakerOn() ? 1.0 : 0.7;
      if (CC.isSpeakerOn() && typeof rv.setSinkId === 'function') {
        navigator.mediaDevices?.enumerateDevices?.().then(function (devices) {
          var speaker = devices.find(function (d) { return d.kind === 'audiooutput' && d.label.toLowerCase().includes('speaker'); });
          if (speaker) rv.setSinkId(speaker.deviceId).catch(function () {});
        }).catch(function () {});
      }
    }
  }

  function _showScreenShareBanner(show) {
    var existing = CC.$('screenshare-banner');
    if (existing) existing.remove();
    if (!show) return;
    var cs = CC.$('call-screen');
    if (!cs) return;
    var banner = document.createElement('div');
    banner.id = 'screenshare-banner';
    banner.className = 'absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold backdrop-blur-sm';
    banner.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">screen_share</span> You are sharing your screen';
    cs.appendChild(banner);
  }

  async function toggleScreenShare() {
    if (CC.screenShareStream) {
      CC.screenShareStream.getTracks().forEach(function (t) { t.stop(); });
      if (CC.getPeerConnection() && CC.screenShareStream.getAudioTracks().length > 0) {
        var pc = CC.getPeerConnection();
        var saTrack = CC.screenShareStream.getAudioTracks()[0];
        var saSender = pc.getSenders().find(function (s) { return s.track === saTrack; });
        if (saSender) { try { pc.removeTrack(saSender); } catch (_) {} }
      }
      CC.screenShareStream = null;
      if (CC.screenShareSender && CC.getPeerConnection() && CC.getLocalStream()) {
        var camTrack = CC.getLocalStream().getVideoTracks()[0];
        if (camTrack) await CC.screenShareSender.replaceTrack(camTrack).catch(function () {});
      }
      CC.screenShareSender = null;
      var lv1 = CC.$('local-video');
      if (lv1) { lv1.srcObject = CC.getLocalStream(); lv1.style.objectFit = ''; }
      var si = CC.$('screenshare-icon');
      if (si) si.textContent = 'screen_share';
      CC.setScreenSharing(false);
      _showScreenShareBanner(false);
      CC.toast('Screen share stopped', 'info');
      return;
    }
    try {
      var displayOpts = { video: true, audio: true };
      var screenStream;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia(displayOpts);
      } catch (_) {
        displayOpts.audio = false;
        screenStream = await navigator.mediaDevices.getDisplayMedia(displayOpts);
      }
      CC.screenShareStream = screenStream;
      var screenTrack = screenStream.getVideoTracks()[0];
      CC.screenShareSender = CC.getPeerConnection()?.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
      if (CC.screenShareSender) await CC.screenShareSender.replaceTrack(screenTrack);
      if (screenStream.getAudioTracks().length > 0) {
        var audioTrack = screenStream.getAudioTracks()[0];
        if (CC.getPeerConnection() && CC.getLocalStream()) {
          CC.getPeerConnection().addTrack(audioTrack, screenStream);
        }
      }
      var lv2 = CC.$('local-video');
      if (lv2) { lv2.srcObject = screenStream; lv2.style.objectFit = 'contain'; }
      var si2 = CC.$('screenshare-icon');
      if (si2) si2.textContent = 'stop_screen_share';
      CC.setScreenSharing(true);
      screenTrack.onended = function () { toggleScreenShare(); };
      _showScreenShareBanner(true);
      CC.toast('Sharing your screen' + (screenStream.getAudioTracks().length > 0 ? ' with audio' : ''), 'info');
    } catch (_) { CC.toast('Screen share cancelled', 'info'); }
  }

  async function switchCamera() {
    CC.setPreferredCameraFacingMode(CC.getPreferredCameraFacingMode() === 'user' ? 'environment' : 'user');
    if (!CC.getLocalStream() || CC.callType !== 'video') return;
    if (CC.isScreenSharing()) { CC.toast('Stop screen share before switching camera', 'info'); return; }
    try {
      var newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: CC.getPreferredCameraFacingMode(),
          width: { ideal: window.isTablet ? 1920 : 1280 },
          height: { ideal: window.isTablet ? 1080 : 720 }
        }
      });
      var newTrack = newStream.getVideoTracks()[0];
      var sender = CC.getPeerConnection()?.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
      if (sender) await sender.replaceTrack(newTrack);
      var oldTrack = CC.getLocalStream().getVideoTracks()[0];
      if (oldTrack) { oldTrack.stop(); CC.getLocalStream().removeTrack(oldTrack); }
      CC.getLocalStream().addTrack(newTrack);
      var lv = CC.$('local-video');
      if (lv) lv.srcObject = CC.getLocalStream();
    } catch (_) {}
  }

  function showCallEndScreen(direction, duration, callType, remoteName, remoteAvatar) {
    var cs = CC.$('call-screen');
    if (!cs) return;
    CC.hide('call-timer');
    CC.hide('local-video-container');
    var rv = CC.$('remote-video');
    if (rv) rv.classList.add('hidden');
    var infoSection = CC.$('call-info-section');
    if (infoSection) infoSection.classList.add('hidden');
    var controls = CC.$('call-controls');
    if (controls) controls.style.display = 'none';
    var existing = CC.$('call-end-screen');
    if (existing) existing.remove();
    var durText = duration > 0 ? CC.fmtDur(duration) : '0:00';
    var typeLabel = callType === 'video' ? 'Video' : 'Audio';
    var directionLabel = direction === 'outgoing' ? 'Outgoing' : 'Incoming';
    var initials = (remoteName || '?')[0].toUpperCase();
    var avatarHtml = remoteAvatar
      ? '<img src="' + CC.escHtml(remoteAvatar) + '" class="w-20 h-20 rounded-full object-cover" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="w-20 h-20 rounded-full bg-primary/15 text-primary flex items-center justify-center text-3xl font-bold" style="display:none">' + CC.escHtml(initials) + '</div>'
      : '<div class="w-20 h-20 rounded-full bg-primary/15 text-primary flex items-center justify-center text-3xl font-bold">' + CC.escHtml(initials) + '</div>';
    var networkInfo = '';
    if (navigator.connection && navigator.connection.effectiveType) {
      networkInfo = '<div class="flex items-center gap-1 mb-1 text-white/40 text-xs"><span class="material-symbols-outlined" style="font-size:12px">wifi</span> ' + navigator.connection.effectiveType.toUpperCase() + '</div>';
    }
    var durationHtml = duration > 0
      ? '<p class="text-white/70 text-2xl font-mono font-semibold mb-6">' + durText + '</p>'
      : '<p class="text-white/50 text-sm mb-6">' + (duration === 0 ? 'No answer' : 'Missed call') + '</p>';
    var endHtml = '<div id="call-end-screen" class="absolute inset-0 bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center z-40 px-6 text-center">' +
      '<div class="mb-4">' + avatarHtml + '</div>' +
      '<h2 class="text-white text-xl font-bold mb-1">' + CC.escHtml(remoteName || 'Unknown') + '</h2>' +
      '<p class="text-white/50 text-sm mb-1">' + directionLabel + ' ' + typeLabel + ' Call</p>' +
      durationHtml +
      networkInfo +
      '<div class="flex items-center gap-2 mb-6 text-white/40 text-xs">' +
      '<span class="material-symbols-outlined" style="font-size:14px">wifi</span> Peer-to-peer connection' +
      '</div>' +
      '<div class="flex items-center gap-6">' +
      '<button id="end-screen-callback" class="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors" title="Call back"><span class="material-symbols-outlined text-white text-2xl">call</span></button>' +
      '<button id="end-screen-info" class="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" title="Call info"><span class="material-symbols-outlined text-white/70 text-2xl">info</span></button>' +
      '<button id="end-screen-close" class="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" title="Close"><span class="material-symbols-outlined text-white/70 text-2xl">close</span></button>' +
      '</div></div>';
    cs.insertAdjacentHTML('beforeend', endHtml);
    var closeBtn = CC.$('end-screen-close');
    if (closeBtn) closeBtn.onclick = function () { dismissCallEndScreen(); };
    var callbackBtn = CC.$('end-screen-callback');
    if (callbackBtn) callbackBtn.onclick = function () {
      dismissCallEndScreen();
      if (remoteName) {
        if (CC.callType === 'video') window.startVideoCall();
        else window.startVoiceCall();
      }
    };
    var infoBtn = CC.$('end-screen-info');
    if (infoBtn) infoBtn.onclick = function () {
      dismissCallEndScreen();
      CC.toast(typeLabel + ' call with ' + (remoteName || 'Unknown') + ' Â· Duration: ' + durText, 'info');
    };
  }

  function dismissCallEndScreen() {
    var es = CC.$('call-end-screen');
    if (es) es.remove();
    var controls = CC.$('call-controls');
    if (controls) controls.style.display = '';
  }

  function showCallQualityBadge(stats) {
    var badge = CC.$('call-quality-badge');
    if (!badge) {
      var cs = CC.$('call-screen');
      if (!cs) return;
      var b = document.createElement('div');
      b.id = 'call-quality-badge';
      b.className = 'absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold backdrop-blur-sm';
      cs.appendChild(b);
      badge = b;
    }
    var level = 'good';
    var color = 'bg-green-500/20 text-green-400';
    var label = 'HD';
    if (stats) {
      if (stats.rtt > 300 || stats.packetLoss > 5) { level = 'poor'; color = 'bg-red-500/20 text-red-400'; label = 'Poor'; }
      else if (stats.rtt > 150 || stats.packetLoss > 2) { level = 'fair'; color = 'bg-yellow-500/20 text-yellow-400'; label = 'Fair'; }
      else { label = CC.callType === 'video' ? 'HD Video' : 'HD Voice'; }
    }
    badge.className = 'absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold backdrop-blur-sm ' + color;
    badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px">signal_cellular_alt</span> ' + label;
    var tipParts = [];
    if (stats) { if (stats.rtt) tipParts.push('RTT: ' + Math.round(stats.rtt) + 'ms'); if (stats.packetLoss != null) tipParts.push('Loss: ' + stats.packetLoss.toFixed(1) + '%'); }
    badge.title = level === 'good' ? 'Excellent connection' : (tipParts.length ? label + ' â€” ' + tipParts.join(', ') : label);
  }

  function updateCallQuality(stats) {
    showCallQualityBadge(stats);
  }

  var _callOnHold = false;

  function toggleCallHold() {
    if (!CC.getLocalStream()) return;
    _callOnHold = !_callOnHold;
    CC.getLocalStream().getTracks().forEach(function (t) { t.enabled = !_callOnHold; });
    var btn = CC.$('btn-hold');
    var icon = CC.$('hold-icon');
    if (btn) btn.classList.toggle('bg-red-500', _callOnHold);
    if (icon) icon.textContent = _callOnHold ? 'play_arrow' : 'pause';
    var holdBanner = document.getElementById('callHoldBanner');
    if (_callOnHold) {
      if (!holdBanner) {
        holdBanner = document.createElement('div');
        holdBanner.id = 'callHoldBanner';
        holdBanner.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[150] bg-surface-container text-on-surface px-4 py-2 rounded-full shadow-lg text-sm font-semibold';
        holdBanner.textContent = 'Call on hold â€” tap Resume to continue';
        document.body.appendChild(holdBanner);
      }
      holdBanner.style.display = 'flex';
    } else {
      if (holdBanner) holdBanner.style.display = 'none';
    }
    CC.toast(_callOnHold ? 'Call on hold' : 'Call resumed', 'info');
  }

  function toggleFullscreen() {
    var cs = CC.$('call-screen');
    if (!cs) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      var fs = cs.requestFullscreen || cs.webkitRequestFullscreen;
      if (fs) fs.call(cs).catch(function () {});
    }
  }

  function togglePIP() {
    var rv = CC.$('remote-video');
    if (!rv) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(function () {});
    } else if (document.pictureInPictureEnabled && rv.srcObject) {
      rv.requestPictureInPicture().catch(function () {});
    }
  }

  // Audio output device picker
  async function showAudioOutputPicker() {
    try {
      var devices = await navigator.mediaDevices.enumerateDevices();
      var audioOutputs = devices.filter(function (d) { return d.kind === 'audiooutput'; });
      if (audioOutputs.length <= 1) return;

      var modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML =
        '<div class="modal-content" style="max-width:320px">' +
          '<h3 class="text-lg font-semibold mb-3">Audio Output</h3>' +
          '<div class="audio-device-list">' +
            audioOutputs.map(function (d) {
              return '<button class="audio-device-option w-full text-left px-4 py-3 rounded-xl hover:bg-surface-variant/50 flex items-center gap-3" data-device-id="' + d.deviceId + '">' +
                '<span class="material-symbols-outlined">' + (d.deviceId === 'default' ? 'volume_up' : 'speaker') + '</span>' +
                '<span>' + (d.label || 'Speaker') + '</span>' +
              '</button>';
            }).join('') +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.remove();
      });
      modal.querySelectorAll('.audio-device-option').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var deviceId = btn.dataset.deviceId;
          var rv = CC.$('remote-video');
          if (rv && typeof rv.setSinkId === 'function') {
            await rv.setSinkId(deviceId).catch(function () {});
          }
          modal.remove();
          CC.toast('Audio output changed', 'info');
        });
      });
    } catch (err) {
      if (window.__DEBUG__) console.warn('Audio device enumeration failed:', err);
    }
  }

  // Proactive network quality warning
  var _lastQualityCheck = 0;
  async function checkCallNetworkQuality() {
    if (!CC.getPeerConnection()) return;
    var now = Date.now();
    if (now - _lastQualityCheck < 10000) return;
    _lastQualityCheck = now;

    try {
      var stats = await CC.getPeerConnection().getStats();
      stats.forEach(function (report) {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          var packetsLost = report.packetsLost || 0;
          var packetsReceived = report.packetsReceived || 1;
          var lossRate = packetsLost / (packetsLost + packetsReceived);

          if (lossRate > 0.1) {
            CC.toast('âš ï¸ Poor network quality detected', 'warning');
          }
        }
      });
    } catch (_e) { /* stats not available */ }
  }

  function resetCallHoldState() {
    _callOnHold = false;
    var btn = CC.$('btn-hold');
    if (btn) btn.classList.remove('bg-red-500');
    var icon = CC.$('hold-icon');
    if (icon) icon.textContent = 'pause';
    var banner = document.getElementById('callHoldBanner');
    if (banner) banner.style.display = 'none';
  }

  function toggleCallRecording() {
    if (typeof window.toggleCallRecording === 'function' && window.toggleCallRecording !== toggleCallRecording) {
      window.toggleCallRecording();
      return;
    }
    CC.toast('Call recording not available', 'info');
  }

  // ── Switch voice call to video call ──
  async function switchToVideo() {
    if (CC.callType === 'video') return;
    if (CC.isScreenSharing()) { CC.toast('Stop screen share before switching to video', 'info'); return; }
    var localStream = CC.getLocalStream();
    var pc = CC.getPeerConnection();
    if (!localStream || !pc) return;
    if (CC.state !== CC.STATES.ACTIVE && CC.state !== CC.STATES.CONNECTING) return;
    try {
      var videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: CC.getPreferredCameraFacingMode() || 'user',
          width: { ideal: window.isTablet ? 1920 : 1280 },
          height: { ideal: window.isTablet ? 1080 : 720 },
          frameRate: { ideal: 30, max: 30 }
        }
      });
      var vTrack = videoStream.getVideoTracks()[0];
      localStream.addTrack(vTrack);
      var sender = pc.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
      if (sender) await sender.replaceTrack(vTrack);
      else pc.addTrack(vTrack, localStream);
      CC.callType = 'video';
      CC.setCameraOff(false);
      var lv = CC.$('local-video');
      if (lv) { lv.srcObject = localStream; }
      CC.show('local-video-container');
      var camBtn = CC.$('btn-cam');
      if (camBtn) { camBtn.classList.remove('hidden'); camBtn.classList.remove('bg-red-500'); }
      var camIcon = CC.$('cam-icon');
      if (camIcon) camIcon.textContent = 'videocam';
      var swBtn = CC.$('btn-switch-video');
      if (swBtn) swBtn.classList.add('hidden');
      var ssBtn = CC.$('btn-screenshare');
      if (ssBtn) ssBtn.classList.remove('hidden');
      var kpBtn = CC.$('btn-keypad');
      if (kpBtn) kpBtn.classList.add('hidden');
      var blurBtn = CC.$('btn-blur');
      if (blurBtn) blurBtn.classList.remove('hidden');
      CC.txt('call-quality-text', 'HD Video call');
      CC.toast('Switched to video call', 'info');
      if (CC.db() && CC.callId) {
        await CC.db().collection('calls').doc(CC.callId).update({ type: 'video' }).catch(function () {});
      }
      if (typeof CC.createOfferAndSignal === 'function') await CC.createOfferAndSignal();
    } catch (err) {
      if (window.__DEBUG__) console.error('switchToVideo error:', err);
      CC.toast('Could not switch to video', 'error');
    }
  }

  // Remote side: a peer upgraded the call to video — enable video here too.
  async function handleRemoteVideoUpgrade() {
    if (CC.callType === 'video') return;
    CC.callType = 'video';
    CC.setCameraOff(false);
    var camBtn = CC.$('btn-cam');
    if (camBtn) { camBtn.classList.remove('hidden'); camBtn.classList.remove('bg-red-500'); }
    var camIcon = CC.$('cam-icon');
    if (camIcon) camIcon.textContent = 'videocam';
    var swBtn = CC.$('btn-switch-video');
    if (swBtn) swBtn.classList.add('hidden');
    var ssBtn = CC.$('btn-screenshare');
    if (ssBtn) ssBtn.classList.remove('hidden');
    var kpBtn = CC.$('btn-keypad');
    if (kpBtn) kpBtn.classList.add('hidden');
    var blurBtn = CC.$('btn-blur');
    if (blurBtn) blurBtn.classList.remove('hidden');
    CC.txt('call-quality-text', 'HD Video call');
    var localStream = CC.getLocalStream();
    var pc = CC.getPeerConnection();
    if (!localStream || !pc) return;
    if (localStream.getVideoTracks().length === 0) {
      try {
        var videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: CC.getPreferredCameraFacingMode() || 'user',
            width: { ideal: window.isTablet ? 1920 : 1280 },
            height: { ideal: window.isTablet ? 1080 : 720 },
            frameRate: { ideal: 30, max: 30 }
          }
        });
        var vTrack = videoStream.getVideoTracks()[0];
        localStream.addTrack(vTrack);
        var sender = pc.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
        if (sender) await sender.replaceTrack(vTrack);
        else pc.addTrack(vTrack, localStream);
        var lv = CC.$('local-video');
        if (lv) lv.srcObject = localStream;
        CC.show('local-video-container');
      } catch (err) {
        if (window.__DEBUG__) console.warn('Remote video upgrade camera error:', err);
      }
    }
  }

  // ── Call keypad / DTMF dialpad ──
  function toggleKeypad() {
    var ov = CC.$('call-keypad-overlay');
    if (!ov) return;
    ov.classList.toggle('hidden');
    if (!ov.classList.contains('hidden')) {
      CC._keypadBuffer = '';
      var disp = CC.$('keypad-display');
      if (disp) disp.innerHTML = '&nbsp;';
    }
  }

  function hideKeypad() {
    var ov = CC.$('call-keypad-overlay');
    if (ov) ov.classList.add('hidden');
  }

  var _dtmfCtx = null;
  function playDtmfTone(digit) {
    try {
      if (!_dtmfCtx) _dtmfCtx = new (window.AudioContext || window.webkitAudioContext)();
      var freqs = { '1': [697,1209], '2': [697,1336], '3': [697,1477], '4': [770,1209], '5': [770,1336], '6': [770,1477], '7': [852,1209], '8': [852,1336], '9': [852,1477], '*': [941,1209], '0': [941,1336], '#': [941,1477] };
      var f = freqs[digit];
      if (!f) return;
      var now = _dtmfCtx.currentTime;
      f.forEach(function (freq) {
        var osc = _dtmfCtx.createOscillator();
        var gain = _dtmfCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(_dtmfCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      });
    } catch (_) {}
  }

  function sendDTMF(digit) {
    var sent = false;
    var pcs = [];
    if (CC.getPeerConnection()) pcs.push(CC.getPeerConnection());
    if (window.groupCallPeerConnections && window.groupCallPeerConnections instanceof Map) {
      window.groupCallPeerConnections.forEach(function (pc) { pcs.push(pc); });
    }
    pcs.forEach(function (pc) {
      if (!pc) return;
      var audioSender = pc.getSenders().find(function (s) { return s.track && s.track.kind === 'audio'; });
      if (audioSender && typeof audioSender.dtmf === 'object' && audioSender.dtmf) {
        try { audioSender.dtmf.insertDTMF(String(digit), 100, 60); sent = true; } catch (_) {}
      }
    });
    if (!sent) playDtmfTone(digit);
    CC._keypadBuffer = ((CC._keypadBuffer || '') + digit).slice(-24);
    var disp = CC.$('keypad-display');
    if (disp) disp.textContent = CC._keypadBuffer;
  }

  // ── Add participant to an active 1:1 call (convert to group call) ──
  function addParticipantToCall() {
    if (!App.callActive) return;
    if (typeof window.openCallPicker === 'function') {
      CC._addParticipantMode = true;
      window.openCallPicker();
    }
  }

  async function convertCallToGroup(newUid, newName) {
    CC._addParticipantMode = false;
    CC.closeModalFn('call-picker-overlay');
    var myUid = CC.uid();
    var currentRemoteUid = (CC.callMeta && CC.callMeta.toUserId) || (CC.callMeta && CC.callMeta.fromUserId) || '';
    var callType = CC.callType || 'voice';
    var currentName = CC.$('call-name')?.textContent || 'Call';
    var memberIds = [currentRemoteUid, newUid].filter(function (x) { return x && x !== myUid; });
    if (!memberIds.length) { CC.toast('No participant to add', 'error'); return; }
    CC._suppressEndScreen = true;
    window.endCall();
    CC._suppressEndScreen = false;
    if (typeof window.startGroupCall === 'function') {
      try {
        await window.startGroupCall(memberIds, callType, { groupId: '', groupName: currentName, groupAvatar: '' });
      } catch (e) {
        if (window.__DEBUG__) console.warn('convertCallToGroup error:', e);
        CC.toast('Could not start group call', 'error');
      }
    }
  }

  CC.switchToVideo = switchToVideo;
  CC.handleRemoteVideoUpgrade = handleRemoteVideoUpgrade;
  CC.toggleKeypad = toggleKeypad;
  CC.hideKeypad = hideKeypad;
  CC.sendDTMF = sendDTMF;
  CC.addParticipantToCall = addParticipantToCall;
  CC.convertCallToGroup = convertCallToGroup;
  CC.toggleMute = toggleMute;
  CC.toggleCamera = toggleCamera;
  CC.toggleSpeaker = toggleSpeaker;
  CC.toggleScreenShare = toggleScreenShare;
  CC.switchCamera = switchCamera;
  CC.toggleCallHold = toggleCallHold;
  CC.toggleFullscreen = toggleFullscreen;
  CC.togglePIP = togglePIP;
  CC.resetCallHoldState = resetCallHoldState;
  CC.showCallEndScreen = showCallEndScreen;
  CC.dismissCallEndScreen = dismissCallEndScreen;
  CC.showCallQualityBadge = showCallQualityBadge;
  CC.updateCallQuality = updateCallQuality;
  CC.showAudioOutputPicker = showAudioOutputPicker;
  CC.checkCallNetworkQuality = checkCallNetworkQuality;
  CC.toggleCallRecording = toggleCallRecording;

  window.switchToVideo = switchToVideo;
  window.toggleKeypad = toggleKeypad;
  window.hideKeypad = hideKeypad;
  window.sendDTMF = sendDTMF;
  window.addParticipantToCall = addParticipantToCall;
  window.toggleMute = toggleMute;
  window.toggleCamera = toggleCamera;
  window.toggleSpeaker = toggleSpeaker;
  window.toggleScreenShare = toggleScreenShare;
  window.switchCamera = switchCamera;
  window.toggleCallHold = toggleCallHold;
  window.toggleFullscreen = toggleFullscreen;
  window.togglePIP = togglePIP;
  window.showAudioOutputPicker = showAudioOutputPicker;
  window.toggleCallRecording = toggleCallRecording;

})();
