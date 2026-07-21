/* call-controller-actions.js — Mute, camera, speaker, screen share toggle functions */
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
      var screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      CC.screenShareStream = screenStream;
      var screenTrack = screenStream.getVideoTracks()[0];
      CC.screenShareSender = peerConnection?.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
      if (CC.screenShareSender) await CC.screenShareSender.replaceTrack(screenTrack);
      var lv2 = CC.$('local-video');
      if (lv2) lv2.srcObject = screenStream;
      var si2 = CC.$('screenshare-icon');
      if (si2) si2.textContent = 'stop_screen_share';
      isScreenSharing = true;
      screenTrack.onended = function () { toggleScreenShare(); };
      CC.toast('Sharing your screen', 'info');
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

  CC.toggleMute = toggleMute;
  CC.toggleCamera = toggleCamera;
  CC.toggleSpeaker = toggleSpeaker;
  CC.toggleScreenShare = toggleScreenShare;
  CC.switchCamera = switchCamera;

  window.toggleMute = toggleMute;
  window.toggleCamera = toggleCamera;
  window.toggleSpeaker = toggleSpeaker;
  window.toggleScreenShare = toggleScreenShare;
  window.switchCamera = switchCamera;

})();
