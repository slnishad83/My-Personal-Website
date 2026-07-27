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

  async function toggleScreenShare() {
    if (CC.screenShareStream) {
      CC.screenShareStream.getTracks().forEach(function (t) { t.stop(); });
      CC.screenShareStream = null;
      if (CC.screenShareSender && CC.getPeerConnection() && CC.getLocalStream()) {
        var camTrack = CC.getLocalStream().getVideoTracks()[0];
        if (camTrack) await CC.screenShareSender.replaceTrack(camTrack).catch(function () {});
      }
      CC.screenShareSender = null;
      var lv1 = CC.$('local-video');
      if (lv1 && CC.getLocalStream()) lv1.srcObject = CC.getLocalStream();
      var si = CC.$('screenshare-icon');
      if (si) si.textContent = 'screen_share';
      CC.setScreenSharing(false);
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
      if (lv2) lv2.srcObject = screenStream;
      var si2 = CC.$('screenshare-icon');
      if (si2) si2.textContent = 'stop_screen_share';
      CC.setScreenSharing(true);
      screenTrack.onended = function () { toggleScreenShare(); };
      CC.toast('Sharing your screen' + (screenStream.getAudioTracks().length > 0 ? ' with audio' : ''), 'info');
    } catch (_) { CC.toast('Screen share cancelled', 'info'); }
  }

  async function switchCamera() {
    CC.setPreferredCameraFacingMode(CC.getPreferredCameraFacingMode() === 'user' ? 'environment' : 'user');
    if (!CC.getLocalStream() || CC.callType !== 'video') return;
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

  // Call recording
  var _callRecorder = null;
  var _callRecordingChunks = [];

  function toggleCallRecording() {
    if (_callRecorder && _callRecorder.state === 'recording') {
      _callRecorder.stop();
      CC.toast('Call recording saved', 'info');
      return;
    }

    var stream = CC.getRemoteStream() || CC.getLocalStream();
    if (!stream) return;

    try {
      _callRecordingChunks = [];
      _callRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      _callRecorder.ondataavailable = function (e) {
        if (e.data.size > 0) _callRecordingChunks.push(e.data);
      };
      _callRecorder.onstop = function () {
        var blob = new Blob(_callRecordingChunks, { type: 'audio/webm' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'call-recording-' + Date.now() + '.webm';
        a.click();
        URL.revokeObjectURL(url);
      };
      _callRecorder.start();
      CC.toast('Recording started', 'info');
    } catch (err) {
      CC.toast('Recording not supported', 'error');
    }
  }

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
