/* call-recording.js � Record voice/video calls with local MediaRecorder */
(function () {
  'use strict';

  var CC = window._CC;
  if (!CC) return;

  var _recorder = null;
  var _chunks = [];
  var _isRecording = false;
  var _startTime = 0;
  var _durationTimer = null;

  function _showBtn() {
    var btn = CC.$('btn-record');
    if (btn) btn.classList.remove('hidden');
  }

  function _hideBtn() {
    var btn = CC.$('btn-record');
    if (btn) btn.classList.add('hidden');
    stopRecording();
  }

  function toggleRecording() {
    if (_isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  async function startRecording() {
    if (_isRecording) return;
    try {
      var stream = null;
      var pc = CC.getPeerConnection ? CC.getPeerConnection() : null;
      if (pc) {
        var remoteStream = new MediaStream();
        pc.getReceivers().forEach(function (r) {
          if (r.track) remoteStream.addTrack(r.track);
        });
        if (remoteStream.getTracks().length > 0) stream = remoteStream;
      }
      if (!stream) {
        var localVideo = CC.$('remote-video');
        if (localVideo && localVideo.srcObject) stream = localVideo.srcObject;
      }
      if (!stream) {
        CC.toast('No call stream to record', 'error');
        return;
      }
      var mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
                     MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      _recorder = new MediaRecorder(stream, { mimeType: mimeType, audioBitsPerSecond: 128000 });
      _chunks = [];
      _recorder.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) _chunks.push(e.data);
      };
      _recorder.onstop = function () {
        var blob = new Blob(_chunks, { type: _recorder.mimeType || mimeType });
        _saveRecording(blob);
      };
      _recorder.onerror = function () {
        CC.toast('Recording error', 'error');
        _resetUI();
      };
      _recorder.start(1000);
      _isRecording = true;
      _startTime = Date.now();
      _updateRecordUI(true);
      _durationTimer = setInterval(function () {
        var elapsed = Math.floor((Date.now() - _startTime) / 1000);
        var icon = CC.$('record-icon');
        if (icon) icon.textContent = 'stop_circle';
        var btn = CC.$('btn-record');
        if (btn) btn.title = 'Recording: ' + CC.fmtDur(elapsed);
      }, 1000);
      CC.toast('Recording started', 'info');
    } catch (err) {
      CC.toast('Cannot record: ' + err.message, 'error');
    }
  }

  function stopRecording() {
    if (!_isRecording || !_recorder) return;
    try {
      _recorder.stop();
    } catch (_) {}
    _isRecording = false;
    clearInterval(_durationTimer);
    _durationTimer = null;
    _updateRecordUI(false);
    CC.toast('Recording saved', 'success');
  }

  function _updateRecordUI(recording) {
    var icon = CC.$('record-icon');
    var btn = CC.$('btn-record');
    if (icon) icon.textContent = recording ? 'stop_circle' : 'fiber_manual_record';
    if (btn) {
      btn.classList.toggle('bg-red-500', recording);
      btn.classList.toggle('bg-white/10', !recording);
    }
  }

  function _resetUI() {
    _isRecording = false;
    _recorder = null;
    _chunks = [];
    clearInterval(_durationTimer);
    _durationTimer = null;
    _updateRecordUI(false);
  }

  function _saveRecording(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = 'call-recording-' + ts + '.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function isRecording() { return _isRecording; }

  CC.toggleCallRecording = toggleRecording;
  CC._showRecordBtn = _showBtn;
  CC._hideRecordBtn = _hideBtn;
  CC.isCallRecording = isRecording;
  window.toggleCallRecording = toggleRecording;
})();
