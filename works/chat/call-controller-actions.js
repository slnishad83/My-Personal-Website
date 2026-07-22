/* call-controller-actions.js — Mute, camera, speaker, screen share, hold, end screen, quality badge */
(function () {
  'use strict';

  var CC = window._CC;

  function toggleMute() {
    micMuted = !micMuted;
    if (localCallStream) localCallStream.getAudioTracks().forEach(function (t) { t.enabled = !micMuted; });
    var btn = CC.$('btn-mute');
    var icon = CC.$('mute-icon');
    if (btn) btn.classList.toggle('bg-red-500', micMuted);
    if (icon) icon.textContent = micMuted ? 'mic_off' : 'mic';
  }

  function toggleCamera() {
    cameraOff = !cameraOff;
    if (localCallStream) localCallStream.getVideoTracks().forEach(function (t) { t.enabled = !cameraOff; });
    var icon = CC.$('cam-icon');
    if (icon) icon.textContent = cameraOff ? 'videocam_off' : 'videocam';
  }

  function toggleSpeaker() {
    speakerOn = !speakerOn;
    var icon = CC.$('speaker-icon');
    if (icon) icon.textContent = speakerOn ? 'volume_up' : 'volume_off';
    var btn = CC.$('btn-speaker');
    if (btn) btn.classList.toggle('bg-primary/30', speakerOn);
    var rv = CC.$('remote-video');
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

  async function toggleScreenShare() {
    if (CC.screenShareStream) {
      CC.screenShareStream.getTracks().forEach(function (t) { t.stop(); });
      CC.screenShareStream = null;
      if (CC.screenShareSender && peerConnection && localCallStream) {
        var camTrack = localCallStream.getVideoTracks()[0];
        if (camTrack) await CC.screenShareSender.replaceTrack(camTrack).catch(function () {});
      }
      CC.screenShareSender = null;
      var lv1 = CC.$('local-video');
      if (lv1 && localCallStream) lv1.srcObject = localCallStream;
      var si = CC.$('screenshare-icon');
      if (si) si.textContent = 'screen_share';
      isScreenSharing = false;
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
      CC.screenShareSender = peerConnection?.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
      if (CC.screenShareSender) await CC.screenShareSender.replaceTrack(screenTrack);
      if (screenStream.getAudioTracks().length > 0) {
        var audioTrack = screenStream.getAudioTracks()[0];
        if (peerConnection && localCallStream) {
          peerConnection.addTrack(audioTrack, screenStream);
        }
      }
      var lv2 = CC.$('local-video');
      if (lv2) lv2.srcObject = screenStream;
      var si2 = CC.$('screenshare-icon');
      if (si2) si2.textContent = 'stop_screen_share';
      isScreenSharing = true;
      screenTrack.onended = function () { toggleScreenShare(); };
      CC.toast('Sharing your screen' + (screenStream.getAudioTracks().length > 0 ? ' with audio' : ''), 'info');
    } catch (_) { CC.toast('Screen share cancelled', 'info'); }
  }

  async function switchCamera() {
    preferredCameraFacingMode = preferredCameraFacingMode === 'user' ? 'environment' : 'user';
    if (!localCallStream || CC.callType !== 'video') return;
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
      var lv = CC.$('local-video');
      if (lv) lv.srcObject = localCallStream;
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
    var controls = cs.querySelector('.call-controls, [class*="fixed bottom"]');
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
    var endHtml = '<div id="call-end-screen" class="absolute inset-0 bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center z-40 px-6 text-center">' +
      '<div class="mb-4">' + avatarHtml + '</div>' +
      '<h2 class="text-white text-xl font-bold mb-1">' + CC.escHtml(remoteName || 'Unknown') + '</h2>' +
      '<p class="text-white/50 text-sm mb-1">' + directionLabel + ' ' + typeLabel + ' Call</p>' +
      '<p class="text-white/70 text-2xl font-mono font-semibold mb-6">' + durText + '</p>' +
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
      if (remoteName) window.startVoiceCall();
    };
    var infoBtn = CC.$('end-screen-info');
    if (infoBtn) infoBtn.onclick = function () {
      dismissCallEndScreen();
      CC.toast(typeLabel + ' call with ' + (remoteName || 'Unknown') + ' · Duration: ' + durText, 'info');
    };
  }

  function dismissCallEndScreen() {
    var es = CC.$('call-end-screen');
    if (es) es.remove();
    var cs = CC.$('call-screen');
    if (cs) {
      var controls = cs.querySelector('.call-controls, [class*="fixed bottom"]');
      if (controls) controls.style.display = '';
    }
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
  }

  function updateCallQuality(stats) {
    showCallQualityBadge(stats);
  }

  CC.toggleMute = toggleMute;
  CC.toggleCamera = toggleCamera;
  CC.toggleSpeaker = toggleSpeaker;
  CC.toggleScreenShare = toggleScreenShare;
  CC.switchCamera = switchCamera;
  CC.showCallEndScreen = showCallEndScreen;
  CC.dismissCallEndScreen = dismissCallEndScreen;
  CC.showCallQualityBadge = showCallQualityBadge;
  CC.updateCallQuality = updateCallQuality;

  window.toggleMute = toggleMute;
  window.toggleCamera = toggleCamera;
  window.toggleSpeaker = toggleSpeaker;
  window.toggleScreenShare = toggleScreenShare;
  window.switchCamera = switchCamera;

})();
