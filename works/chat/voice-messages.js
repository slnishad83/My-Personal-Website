/* voice-messages.js — WhatsApp-exact voice message recording + playback */
(function () {
  'use strict';

  var _recorder = null;
  var _audioChunks = [];
  var _audioStream = null;
  var _audioContext = null;
  var _analyser = null;
  var _animFrame = null;
  var _isRecording = false;
  var _isPaused = false;
  var _isLocked = false;
  var _startTime = 0;
  var _pausedTime = 0;
  var _totalPaused = 0;
  var _timerInterval = null;
  var _holdTimer = null;
  var _swipeStartY = 0;
  var _swipeActive = false;
  var _lockThreshold = 80;
  var _maxDuration = 300;
  var _recordedBlob = null;
  var _recordedDuration = 0;
  var _currentlyPlaying = null;
  var _playbackSpeeds = [1, 1.5, 2];
  var _currentSpeedIdx = 0;

  function _db() { return window.App && window.App.db ? window.App.db : null; }
  function _uid() { return window.App && window.App.auth && window.App.auth.currentUser ? window.App.auth.currentUser.uid : null; }
  function _chat() { return window.App && window.App.currentChat ? window.App.currentChat : null; }
  function _esc(s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }
  function _toast(msg, t) { if (typeof window.showToast === 'function') window.showToast(msg, t); }

  function _getMediaConstraints() {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000
      }
    };
  }

  function _injectStyles() {
    if (document.getElementById('vm-styles')) return;
    var style = document.createElement('style');
    style.id = 'vm-styles';
    style.textContent = '' +
      '.vm-recording-active #mic-btn { background: #ef4444 !important; color: white !important; animation: vm-pulse 1s infinite; }' +
      '@keyframes vm-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }' +
      '.vm-waveform-bar { display: inline-block; width: 3px; margin: 0 1px; background: currentColor; border-radius: 2px; transition: height 0.05s; min-height: 4px; }' +
      '.vm-player { display: flex; align-items: center; gap: 8px; padding: 6px 0; min-width: 200px; max-width: 300px; }' +
      '.vm-play-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,150,136,0.15); color: #009688; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s; }' +
      '.vm-play-btn:hover { background: rgba(0,150,136,0.25); }' +
      '.vm-play-btn:active { transform: scale(0.95); }' +
      '.vm-waveform-container { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }' +
      '.vm-waveform { display: flex; align-items: center; height: 28px; cursor: pointer; position: relative; }' +
      '.vm-waveform-bars { display: flex; align-items: center; height: 100%; width: 100%; }' +
      '.vm-progress-overlay { position: absolute; left: 0; top: 0; height: 100%; background: rgba(0,150,136,0.3); pointer-events: none; transition: width 0.1s linear; }' +
      '.vm-info-row { display: flex; align-items: center; justify-content: space-between; }' +
      '.vm-time { font-size: 11px; color: rgba(0,0,0,0.45); font-variant-numeric: tabular-nums; }' +
      '.vm-speed-btn { font-size: 11px; font-weight: 600; color: #009688; background: none; border: 1px solid rgba(0,150,136,0.3); border-radius: 4px; padding: 1px 5px; cursor: pointer; line-height: 1.2; }' +
      '.vm-speed-btn:hover { background: rgba(0,150,136,0.1); }' +
      '.vm-lock-hint { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.75); color: white; font-size: 12px; padding: 4px 12px; border-radius: 12px; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 0.2s; margin-bottom: 8px; }' +
      '.vm-lock-hint.visible { opacity: 1; }' +
      '.vm-lock-zone { position: fixed; bottom: 0; left: 0; right: 0; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 16px; z-index: 100; pointer-events: none; }' +
      '.vm-lock-icon { width: 48px; height: 48px; border-radius: 50%; background: rgba(0,0,0,0.6); color: white; display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(20px); transition: all 0.2s; pointer-events: auto; }' +
      '.vm-lock-icon.visible { opacity: 1; transform: translateY(0); }' +
      '.vm-delete-zone { position: fixed; top: 0; left: 0; right: 0; height: 100px; display: flex; align-items: flex-start; justify-content: center; padding-top: 30px; z-index: 100; pointer-events: none; }' +
      '.vm-delete-icon { width: 40px; height: 40px; border-radius: 50%; background: rgba(239,68,68,0.15); color: #ef4444; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; }' +
      '.vm-delete-icon.visible { opacity: 1; }';
    document.head.appendChild(style);
  }

  function _ensureRecordingBar() {
    var bar = document.getElementById('recording-bar');
    if (!bar) return null;
    return bar;
  }

  function _updateTimer() {
    if (!_isRecording || _isPaused) return;
    var elapsed = Math.floor((Date.now() - _startTime - _totalPaused) / 1000);
    if (elapsed >= _maxDuration) {
      _stopRecordingAndSend();
      return;
    }
    var timer = document.getElementById('rec-timer');
    if (timer) timer.textContent = _formatTime(elapsed);
    var limit = document.getElementById('rec-limit');
    if (limit) {
      var remaining = _maxDuration - elapsed;
      limit.textContent = remaining <= 30 ? remaining + 's' : '';
      limit.classList.toggle('text-red-500', remaining <= 10);
    }
  }

  function _formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function _startWaveform(stream) {
    try {
      _audioContext = new (window.AudioContext || window.webkitAudioContext)();
      _analyser = _audioContext.createAnalyser();
      _analyser.fftSize = 64;
      var source = _audioContext.createMediaStreamSource(stream);
      source.connect(_analyser);
      var container = document.getElementById('recording-waveform');
      if (!container) return;
      container.innerHTML = '';
      var barCount = 30;
      for (var i = 0; i < barCount; i++) {
        var bar = document.createElement('div');
        bar.className = 'vm-waveform-bar';
        bar.style.height = '4px';
        container.appendChild(bar);
      }
      var bars = container.querySelectorAll('.vm-waveform-bar');
      var dataArray = new Uint8Array(_analyser.frequencyBinCount);
      function animate() {
        if (!_isRecording || !_analyser) return;
        _analyser.getByteFrequencyData(dataArray);
        var step = Math.floor(dataArray.length / barCount);
        for (var j = 0; j < barCount; j++) {
          var val = dataArray[j * step] || 0;
          var h = Math.max(4, (val / 255) * 28);
          bars[j].style.height = h + 'px';
        }
        _animFrame = requestAnimationFrame(animate);
      }
      animate();
    } catch (_) {}
  }

  function _stopWaveform() {
    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
    if (_audioContext) { try { _audioContext.close(); } catch (_) {} _audioContext = null; }
    _analyser = null;
    var container = document.getElementById('recording-waveform');
    if (container) container.innerHTML = '';
  }

  let _micListenersAttached = false;
  async function toggleRecording(e) {
    if (_isRecording) {
      _stopRecordingAndSend();
      return;
    }
    if (!_micListenersAttached) {
      var micBtn = document.getElementById('mic-btn');
      if (micBtn) {
        micBtn.addEventListener('touchstart', _onMicTouchStart, { passive: false });
        micBtn.addEventListener('touchmove', _onMicTouchMove, { passive: false });
        micBtn.addEventListener('touchend', _onMicTouchEnd);
        micBtn.addEventListener('mousedown', _onMicMouseDown);
        _micListenersAttached = true;
      }
    }
    _startRecording();
  }

  function _onMicTouchStart(e) {
    e.preventDefault();
    _swipeStartY = e.touches[0].clientY;
    _swipeActive = true;
    _holdTimer = setTimeout(function () {
      if (_isRecording && !_isLocked && _swipeActive) {
        _lockRecording();
      }
    }, 500);
  }

  function _onMicTouchMove(e) {
    if (!_swipeActive || !_isRecording) return;
    var dy = _swipeStartY - e.touches[0].clientY;
    var lockIcon = document.querySelector('.vm-lock-icon');
    var deleteIcon = document.querySelector('.vm-delete-icon');
    if (dy > _lockThreshold) {
      if (lockIcon) lockIcon.classList.add('visible');
      if (deleteIcon) deleteIcon.classList.remove('visible');
    } else if (dy < -_lockThreshold) {
      if (deleteIcon) deleteIcon.classList.add('visible');
      if (lockIcon) lockIcon.classList.remove('visible');
    } else {
      if (lockIcon) lockIcon.classList.remove('visible');
      if (deleteIcon) deleteIcon.classList.remove('visible');
    }
  }

  function _onMicTouchEnd(e) {
    _swipeActive = false;
    if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
    var lockIcon = document.querySelector('.vm-lock-icon');
    var deleteIcon = document.querySelector('.vm-delete-icon');
    if (lockIcon) lockIcon.classList.remove('visible');
    if (deleteIcon) deleteIcon.classList.remove('visible');
    if (_isRecording && !_isLocked) {
      var changedTouch = e.changedTouches && e.changedTouches[0];
      if (changedTouch) {
        var dy = _swipeStartY - changedTouch.clientY;
        if (dy < -_lockThreshold) {
          cancelRecording();
          return;
        }
      }
      _stopRecordingAndSend();
    }
  }

  function _onMicMouseDown(e) {
    _swipeStartY = e.clientY;
    _swipeActive = true;
    _holdTimer = setTimeout(function () {
      if (_isRecording && !_isLocked && _swipeActive) {
        _lockRecording();
      }
    }, 500);
    document.addEventListener('mouseup', _onMicMouseUp);
  }

  function _onMicMouseUp(e) {
    _swipeActive = false;
    if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
    if (_isRecording && !_isLocked) {
      _stopRecordingAndSend();
    }
    document.removeEventListener('mouseup', _onMicMouseUp);
  }

  function _lockRecording() {
    _isLocked = true;
    _swipeActive = false;
    var bar = _ensureRecordingBar();
    if (bar) bar.classList.add('vm-locked');
    _showLockUI();
  }

  function _showLockUI() {
    var existing = document.querySelector('.vm-lock-zone');
    if (existing) existing.remove();
    var lockHtml = '<div class="vm-lock-zone">' +
      '<div class="vm-lock-icon" id="vm-lock-icon">' +
      '<span class="material-symbols-outlined">lock</span>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', lockHtml);
  }

  function _hideLockUI() {
    var zone = document.querySelector('.vm-lock-zone');
    if (zone) zone.remove();
  }

  async function _startRecording() {
    if (_isRecording) return;
    try {
      _audioStream = await navigator.mediaDevices.getUserMedia(_getMediaConstraints());
      var mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/ogg;codecs=opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
          }
        }
      }
      var opts = mimeType ? { mimeType: mimeType } : {};
      _recorder = new MediaRecorder(_audioStream, opts);
      _audioChunks = [];
      _recorder.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) _audioChunks.push(e.data);
      };
      _recorder.onstop = function () {
        if (_audioChunks.length > 0) {
          _recordedBlob = new Blob(_audioChunks, { type: _recorder.mimeType || 'audio/webm' });
          _recordedDuration = Math.floor((Date.now() - _startTime - _totalPaused) / 1000);
          if (!_isLocked && _recordedDuration < 1) {
            _recordedBlob = null;
            _hideRecordingUI();
            return;
          }
          _showPreview();
        }
      };
      _recorder.start(100);
      _isRecording = true;
      _isPaused = false;
      _isLocked = false;
      _startTime = Date.now();
      _totalPaused = 0;
      _recordedBlob = null;
      _showRecordingUI();
      _startWaveform(_audioStream);
      _timerInterval = setInterval(_updateTimer, 200);
    } catch (err) {
      _toast('Microphone access denied', 'error');
    }
  }

  function _showRecordingUI() {
    var bar = _ensureRecordingBar();
    if (bar) {
      bar.classList.remove('hidden');
      bar.style.display = '';
    }
    var inputBar = document.getElementById('input-bar');
    if (inputBar) inputBar.style.display = 'none';
    var micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.classList.add('recording-active');
    document.body.classList.add('vm-recording-active');
    var timer = document.getElementById('rec-timer');
    if (timer) timer.textContent = '0:00';
  }

  function _hideRecordingUI() {
    var bar = _ensureRecordingBar();
    if (bar) {
      bar.classList.add('hidden');
      bar.style.display = 'none';
    }
    var inputBar = document.getElementById('input-bar');
    if (inputBar) inputBar.style.display = '';
    var micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.classList.remove('recording-active');
    document.body.classList.remove('vm-recording-active');
    _hideLockUI();
    _stopWaveform();
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  }

  function togglePauseRecording() {
    if (!_isRecording) return;
    if (_isPaused) {
      _resumeRecording();
    } else {
      _pauseRecording();
    }
  }

  function _pauseRecording() {
    if (_recorder && _recorder.state === 'recording') {
      _recorder.pause();
      _isPaused = true;
      _pausedTime = Date.now();
      var icon = document.getElementById('rec-pause-icon');
      if (icon) icon.textContent = 'play_arrow';
      var dot = document.getElementById('rec-dot');
      if (dot) dot.style.animationPlayState = 'paused';
    }
  }

  function _resumeRecording() {
    if (_recorder && _recorder.state === 'paused') {
      _recorder.resume();
      _isPaused = false;
      _totalPaused += Date.now() - _pausedTime;
      var icon = document.getElementById('rec-pause-icon');
      if (icon) icon.textContent = 'pause';
      var dot = document.getElementById('rec-dot');
      if (dot) dot.style.animationPlayState = '';
    }
  }

  function cancelRecording() {
    _isRecording = false;
    _isPaused = false;
    _isLocked = false;
    if (_recorder && _recorder.state !== 'inactive') {
      try { _recorder.stop(); } catch (_) {}
    }
    if (_audioStream) {
      _audioStream.getTracks().forEach(function (t) { t.stop(); });
      _audioStream = null;
    }
    _recorder = null;
    _audioChunks = [];
    _recordedBlob = null;
    _hideRecordingUI();
    _hidePreview();
  }

  function _stopRecordingAndSend() {
    _isRecording = false;
    _isPaused = false;
    if (_recorder && _recorder.state !== 'inactive') {
      try { _recorder.stop(); } catch (_) {}
    }
    if (_audioStream) {
      _audioStream.getTracks().forEach(function (t) { t.stop(); });
      _audioStream = null;
    }
    _recorder = null;
    _hideRecordingUI();
  }

  function _showPreview() {
    if (!_recordedBlob) return;
    var url = URL.createObjectURL(_recordedBlob);
    var bar = _ensureRecordingBar();
    if (!bar) return;
    bar.classList.remove('hidden');
    bar.style.display = '';
    var inputBar = document.getElementById('input-bar');
    if (inputBar) inputBar.style.display = 'none';
    bar.innerHTML = '<div class="flex items-center gap-3 w-full px-4 py-3">' +
      '<button id="preview-play" class="w-10 h-10 rounded-full bg-teal-500/15 text-teal-600 flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-xl">play_arrow</span></button>' +
      '<div class="flex-1 min-w-0">' +
      '<div class="flex items-center gap-2">' +
      '<div id="preview-waveform" class="flex-1 h-7 flex items-center"></div>' +
      '</div>' +
      '<div class="flex items-center justify-between mt-1">' +
      '<span id="preview-time" class="vm-time">0:00 / ' + _formatTime(_recordedDuration) + '</span>' +
      '<div class="flex items-center gap-2">' +
      '<button id="preview-cancel" class="text-red-500 hover:text-red-600"><span class="material-symbols-outlined" style="font-size:20px">delete</span></button>' +
      '</div></div></div>' +
      '<button id="preview-send" class="w-12 h-12 rounded-full bg-teal-500 text-white flex items-center justify-center flex-shrink-0 hover:bg-teal-600 transition-colors"><span class="material-symbols-outlined">send</span></button>' +
      '</div>';
    var waveformContainer = bar.querySelector('#preview-waveform');
    if (waveformContainer) {
      var barCount = 30;
      for (var i = 0; i < barCount; i++) {
        var barEl = document.createElement('div');
        barEl.className = 'vm-waveform-bar';
        barEl.style.height = Math.max(4, Math.random() * 24) + 'px';
        barEl.style.background = '#009688';
        waveformContainer.appendChild(barEl);
      }
    }
    var previewAudio = new Audio(url);
    var playBtn = document.getElementById('preview-play');
    var timeEl = document.getElementById('preview-time');
    var isPlaying = false;
    if (playBtn) {
      playBtn.onclick = function () {
        if (isPlaying) {
          previewAudio.pause();
          playBtn.innerHTML = '<span class="material-symbols-outlined text-xl">play_arrow</span>';
          isPlaying = false;
        } else {
          previewAudio.play();
          playBtn.innerHTML = '<span class="material-symbols-outlined text-xl">pause</span>';
          isPlaying = true;
        }
      };
    }
    previewAudio.ontimeupdate = function () {
      if (timeEl) timeEl.textContent = _formatTime(Math.floor(previewAudio.currentTime)) + ' / ' + _formatTime(_recordedDuration);
    };
    previewAudio.onended = function () {
      isPlaying = false;
      if (playBtn) playBtn.innerHTML = '<span class="material-symbols-outlined text-xl">play_arrow</span>';
      try { URL.revokeObjectURL(url); } catch (_) {}
    };
    var cancelBtn = document.getElementById('preview-cancel');
    if (cancelBtn) cancelBtn.onclick = function () {
      _recordedBlob = null;
      _hidePreview();
      _hideRecordingUI();
      try { URL.revokeObjectURL(url); } catch (_) {}
    };
    var sendBtn = document.getElementById('preview-send');
    if (sendBtn) sendBtn.onclick = function () {
      _hidePreview();
      _sendVoiceMessage();
      try { URL.revokeObjectURL(url); } catch (_) {}
    };
  }

  function _hidePreview() {
    var bar = _ensureRecordingBar();
    if (bar) {
      bar.classList.add('hidden');
      bar.style.display = 'none';
    }
    var inputBar = document.getElementById('input-bar');
    if (inputBar) inputBar.style.display = '';
  }

  async function _sendVoiceMessage() {
    if (!_recordedBlob) return;
    var chat = _chat();
    var db = _db();
    var user = window.App && window.App.auth ? window.App.auth.currentUser : null;
    if (!chat || !db || !user) { _toast('Not ready', 'error'); return; }
    _toast('Sending voice message…', 'info');
    try {
      var blobToSend = _recordedBlob;
      var vc = window.VoiceChanger;
      if (vc && typeof vc.getCurrentEffect === 'function' && vc.getCurrentEffect() !== 'none') {
        blobToSend = await vc.applyEffect(_recordedBlob, vc.getCurrentEffect());
      }
      var ext = 'webm';
      if (blobToSend.type.indexOf('ogg') !== -1) ext = 'ogg';
      else if (blobToSend.type.indexOf('mp4') !== -1) ext = 'mp4';
      else if (blobToSend.type.indexOf('wav') !== -1) ext = 'wav';
      var fileName = 'voice-' + Date.now() + '.' + ext;
      var ref = firebase.storage().ref().child('chat_audio/' + chat.id + '/' + user.uid + '/' + fileName);
      await ref.put(blobToSend, { contentType: blobToSend.type || 'audio/webm' });
      var downloadURL = await ref.getDownloadURL();
      var msgData = {
        text: '',
        type: 'voice',
        audioURL: downloadURL,
        audioDuration: _recordedDuration,
        from: user.uid,
        fromName: user.displayName || 'User',
        chatId: chat.id,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      };
      await db.collection('messages').doc(chat.id).collection('items').add(msgData);
      await db.collection('messages').doc(chat.id).update({
        lastMessage: '🎤 Voice message',
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageFrom: user.uid
      }).catch(function() {});
      _toast('Voice message sent', 'success');
    } catch (err) {
      console.error('Voice send error:', err);
      _toast('Failed to send voice message', 'error');
    }
    _recordedBlob = null;
    _recordedDuration = 0;
  }

  function renderVoiceMessage(msgId, audioURL, duration, container, isSent) {
    if (!container) return;
    var id = 'vm-' + msgId;
    var playIcon = isSent ? '#fff' : '#009688';
    var playBg = isSent ? 'rgba(255,255,255,0.15)' : 'rgba(0,150,136,0.12)';
    var timeColor = isSent ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)';
    var barColor = isSent ? 'rgba(255,255,255,0.3)' : 'rgba(0,150,136,0.25)';
    var barActiveColor = isSent ? 'rgba(255,255,255,0.8)' : '#009688';
    var speedColor = isSent ? 'rgba(255,255,255,0.8)' : '#009688';
    var durText = _formatTime(duration || 0);
    var barCount = 28;
    var barsHtml = '';
    for (var i = 0; i < barCount; i++) {
      var h = Math.max(4, Math.random() * 24);
      barsHtml += '<div class="vm-waveform-bar" style="height:' + h + 'px;background:' + barColor + '" data-idx="' + i + '"></div>';
    }
    var html = '<div class="vm-player" data-vm-id="' + _esc(id) + '" data-vm-url="' + _esc(audioURL) + '" data-vm-dur="' + (duration || 0) + '">' +
      '<button class="vm-play-btn" style="background:' + playBg + ';color:' + playIcon + '" data-vm-play="' + _esc(id) + '">' +
      '<span class="material-symbols-outlined" style="font-size:22px">play_arrow</span></button>' +
      '<div class="vm-waveform-container">' +
      '<div class="vm-waveform" data-vm-scrub="' + _esc(id) + '">' +
      '<div class="vm-progress-overlay" id="vm-prog-' + _esc(id) + '" style="background:' + barActiveColor + '33;width:0%"></div>' +
      '<div class="vm-waveform-bars" id="vm-bars-' + _esc(id) + '">' + barsHtml + '</div>' +
      '</div>' +
      '<div class="vm-info-row">' +
      '<span class="vm-time" style="color:' + timeColor + '" id="vm-time-' + _esc(id) + '">' + durText + '</span>' +
      '<button class="vm-speed-btn" style="color:' + speedColor + ';border-color:' + speedColor + '33" data-vm-speed="' + _esc(id) + '">1x</button>' +
      '</div></div></div>';
    var existingAudio = container.querySelector('.vm-player');
    var savedTime = 0;
    var wasPlaying = false;
    if (existingAudio) {
      var prevPlayerId = existingAudio.getAttribute('data-vm-id');
      if (prevPlayerId && _currentlyPlaying === prevPlayerId) {
        var prevAudio = existingAudio._vmAudio;
        if (prevAudio && !prevAudio.paused) {
          savedTime = prevAudio.currentTime;
          wasPlaying = true;
          prevAudio.pause();
          _currentlyPlaying = null;
        }
      }
    }
    container.innerHTML = html;
    _wireVoicePlayer(id, audioURL, duration || 0, barColor, barActiveColor);
    if (wasPlaying && savedTime > 0) {
      var newPlayer = container.querySelector('.vm-player');
      if (newPlayer && newPlayer._vmAudio) {
        newPlayer._vmAudio.currentTime = savedTime;
        newPlayer._vmAudio.play().catch(function () {});
      }
    }
  }

  function _wireVoicePlayer(id, audioURL, totalDur, barColor, barActiveColor) {
    var player = document.querySelector('[data-vm-id="' + id + '"]');
    if (!player) return;
    var audio = new Audio(audioURL);
    audio.preload = 'metadata';
    var playBtn = player.querySelector('[data-vm-play]');
    var scrub = player.querySelector('[data-vm-scrub]');
    var speedBtn = player.querySelector('[data-vm-speed"]');
    var timeEl = document.getElementById('vm-time-' + id);
    var progEl = document.getElementById('vm-prog-' + id);
    var barsEl = document.getElementById('vm-bars-' + id);
    var bars = barsEl ? barsEl.querySelectorAll('.vm-waveform-bar') : [];
    var speedIdx = 0;
    var speeds = [1, 1.5, 2];
    var isPlaying = false;

    audio.addEventListener('loadedmetadata', function () {
      if (totalDur === 0) totalDur = Math.floor(audio.duration);
      if (timeEl) timeEl.textContent = _formatTime(totalDur);
    });

    audio.addEventListener('timeupdate', function () {
      var cur = audio.currentTime;
      var dur = audio.duration || totalDur;
      var pct = dur > 0 ? (cur / dur * 100) : 0;
      if (progEl) progEl.style.width = pct + '%';
      if (timeEl) timeEl.textContent = _formatTime(Math.floor(cur));
      var activeCount = Math.floor(pct / 100 * bars.length);
      for (var i = 0; i < bars.length; i++) {
        bars[i].style.background = i <= activeCount ? barActiveColor : barColor;
      }
    });

    audio.addEventListener('ended', function () {
      isPlaying = false;
      if (playBtn) playBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">play_arrow</span>';
      if (progEl) progEl.style.width = '0%';
      bars.forEach(function (b) { b.style.background = barColor; });
      if (timeEl) timeEl.textContent = _formatTime(totalDur);
      if (_currentlyPlaying === id) _currentlyPlaying = null;
    });

    if (playBtn) {
      playBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (_currentlyPlaying && _currentlyPlaying !== id) {
          var prevPlayer = document.querySelector('[data-vm-id="' + _currentlyPlaying + '"]');
          if (prevPlayer) {
            var prevEvt = new CustomEvent('vm-stop');
            prevPlayer.dispatchEvent(prevEvt);
          }
        }
        if (isPlaying) {
          audio.pause();
          isPlaying = false;
          playBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">play_arrow</span>';
          _currentlyPlaying = null;
        } else {
          audio.play().catch(function () {});
          isPlaying = true;
          playBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">pause</span>';
          _currentlyPlaying = id;
        }
      });
    }

    player.addEventListener('vm-stop', function () {
      audio.pause();
      audio.currentTime = 0;
      isPlaying = false;
      if (playBtn) playBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">play_arrow</span>';
      if (progEl) progEl.style.width = '0%';
      bars.forEach(function (b) { b.style.background = barColor; });
    });

    if (scrub) {
      scrub.addEventListener('click', function (e) {
        var rect = scrub.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var pct = Math.max(0, Math.min(1, x / rect.width));
        audio.currentTime = pct * (audio.duration || totalDur);
      });
    }

    if (speedBtn) {
      speedBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        speedIdx = (speedIdx + 1) % speeds.length;
        audio.playbackRate = speeds[speedIdx];
        speedBtn.textContent = speeds[speedIdx] + 'x';
      });
    }
  }

  function wireExistingVoiceMessages(container) {
    if (!container) return;
    var players = container.querySelectorAll('.vm-player[data-vm-id]');
    players.forEach(function (player) {
      var id = player.getAttribute('data-vm-id');
      var url = player.getAttribute('data-vm-url');
      var dur = parseInt(player.getAttribute('data-vm-dur') || '0', 10);
      if (id && url && !player.dataset.vmWired) {
        player.dataset.vmWired = '1';
        var isSent = player.closest('.message-sent, [class*="sent"]') !== null;
        _wireVoicePlayer(id.replace('vm-', ''), url, dur,
          isSent ? 'rgba(255,255,255,0.3)' : 'rgba(0,150,136,0.25)',
          isSent ? 'rgba(255,255,255,0.8)' : '#009688');
      }
    });
  }

  function _initDelegatedActions() {
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;
      var action = target.getAttribute('data-action');
      if (action === 'toggleRecording') { e.preventDefault(); toggleRecording(e); }
      else if (action === 'togglePauseRecording') { e.preventDefault(); togglePauseRecording(); }
      else if (action === 'cancelRecording') { e.preventDefault(); cancelRecording(); }
      else if (action === 'sendVoiceMessage') { e.preventDefault(); _stopRecordingAndSend(); }
    });
  }

  function init() {
    _injectStyles();
    _initDelegatedActions();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 0); });
  }

  window._VoiceMessages = {
    toggleRecording: toggleRecording,
    togglePauseRecording: togglePauseRecording,
    cancelRecording: cancelRecording,
    renderVoiceMessage: renderVoiceMessage,
    wireExistingVoiceMessages: wireExistingVoiceMessages
  };
  window.toggleRecording = toggleRecording;
  window.togglePauseRecording = togglePauseRecording;
  window.cancelRecording = cancelRecording;
  window.sendVoiceMessage = function () { _stopRecordingAndSend(); };

})();
