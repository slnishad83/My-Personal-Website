/**
 * Voice Waveform — WhatsApp-style voice message visualization & player.
 * Waveform rendering, playback, and recording visualization.
 */
window.VoiceWaveform = (function () {
  'use strict';

  /* ─── State ─────────────────────────────────────────────────────── */
  var _currentPlaying = null;
  var _currentAudio = null;
  var _animFrame = null;
  var _waveformCache = {};
  var _recordingAnalyser = null;
  var _recordingAnimFrame = null;
  var _recordingStream = null;

  var DEFAULT_OPTIONS = {
    barWidth: 3,
    barGap: 2,
    barColor: '#ccc',
    playedColor: '#008069',
    height: 40
  };

  /* ─── Waveform generation ───────────────────────────────────────── */
  async function generateWaveform(audioBlob, barCount) {
    barCount = barCount || 42;

    var cacheKey = null;
    try {
      var ab = await audioBlob.arrayBuffer();
      var cacheKey = _hashBuffer(ab);
      if (_waveformCache[cacheKey]) {
        if (window.__DEBUG__) console.log('[VoiceWaveform] Cache hit');
        return _waveformCache[cacheKey];
      }
    } catch (_) {}

    try {
      var buffer;
      if (cacheKey) {
        try {
          buffer = await _decodeAudioBlob(audioBlob);
        } catch (e) {
          if (window.__DEBUG__) console.warn('[VoiceWaveform] Decode failed, generating fallback');
          return _generateFallback(barCount);
        }
      } else {
        buffer = await _decodeAudioBlob(audioBlob);
      }

      var rawData = buffer.getChannelData(0);
      var samplesPerBar = Math.floor(rawData.length / barCount);
      var waveform = [];

      for (var i = 0; i < barCount; i++) {
        var start = i * samplesPerBar;
        var end = Math.min(start + samplesPerBar, rawData.length);
        var sum = 0;
        for (var j = start; j < end; j++) {
          sum += Math.abs(rawData[j]);
        }
        waveform.push(sum / (end - start));
      }

      var max = Math.max.apply(null, waveform) || 1;
      waveform = waveform.map(function (v) { return Math.min(v / max, 1); });

      if (cacheKey) _waveformCache[cacheKey] = waveform;
      if (window.__DEBUG__) console.log('[VoiceWaveform] Generated', barCount, 'bars');
      return waveform;
    } catch (e) {
      if (window.__DEBUG__) console.error('[VoiceWaveform] generateWaveform error:', e);
      return _generateFallback(barCount);
    }
  }

  async function _decodeAudioBlob(blob) {
    var arrayBuf = await blob.arrayBuffer();
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      var decoded = await ctx.decodeAudioData(arrayBuf);
      return decoded;
    } finally {
      try { ctx.close(); } catch (_) {}
    }
  }

  function _hashBuffer(buffer) {
    var bytes = new Uint8Array(buffer.slice(0, 8192));
    var hash = 0;
    for (var i = 0; i < bytes.length; i++) {
      hash = ((hash << 5) - hash + bytes[i]) | 0;
    }
    return 'wf_' + hash.toString(36);
  }

  function _generateFallback(count) {
    var wave = [];
    for (var i = 0; i < count; i++) {
      wave.push(0.2 + Math.random() * 0.6);
    }
    return wave;
  }

  /* ─── Render waveform ───────────────────────────────────────────── */
  function renderWaveform(container, waveformData, options) {
    var opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
    container.innerHTML = '';
    container.style.cssText = 'display:flex;align-items:center;justify-content:center;height:' + opts.height + 'px;gap:' + opts.barGap + 'px;overflow:hidden;';

    waveformData.forEach(function (amp) {
      var bar = document.createElement('div');
      var h = Math.max(2, amp * opts.height);
      bar.style.cssText = 'width:' + opts.barWidth + 'px;height:' + h + 'px;border-radius:' + (opts.barWidth / 2) + 'px;background:' + opts.barColor + ';transition:background 0.1s ease;flex-shrink:0;';
      container.appendChild(bar);
    });

    return container;
  }

  function updateProgress(container, progress) {
    var bars = container.children;
    var total = bars.length;
    var playedIdx = Math.floor(progress * total);
    for (var i = 0; i < total; i++) {
      if (i < playedIdx) {
        bars[i].style.background = _getPlayedColor(container);
      } else {
        bars[i].style.background = _getBarColor(container);
      }
    }
  }

  function _getPlayedColor(container) {
    return container.dataset.playedColor || '#008069';
  }

  function _getBarColor(container) {
    return container.dataset.barColor || '#ccc';
  }

  /* ─── Player UI ─────────────────────────────────────────────────── */
  function createPlayer(audioUrl, waveformData, options) {
    var opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
    var duration = opts.duration || 0;

    var player = document.createElement('div');
    player.className = 'sl-voice-player';
    player.dataset.audioUrl = audioUrl;
    player.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:12px;background:rgba(0,0,0,0.05);width:100%;max-width:340px;';

    /* Play button */
    var playBtn = document.createElement('button');
    playBtn.className = 'sl-play-btn';
    playBtn.style.cssText = 'width:40px;height:40px;border-radius:50%;background:#008069;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform 0.1s;';
    playBtn.innerHTML = _playIcon();
    player.appendChild(playBtn);

    /* Waveform container */
    var wfWrap = document.createElement('div');
    wfWrap.style.cssText = 'flex:1;min-width:0;overflow:hidden;';
    wfWrap.dataset.playedColor = opts.playedColor;
    wfWrap.dataset.barColor = opts.barColor || 'rgba(255,255,255,0.3)';
    renderWaveform(wfWrap, waveformData, opts);
    player.appendChild(wfWrap);

    /* Duration */
    var durEl = document.createElement('span');
    durEl.className = 'sl-duration';
    durEl.style.cssText = 'color:rgba(0,0,0,0.45);font-size:12px;flex-shrink:0;min-width:36px;text-align:right;font-variant-numeric:tabular-nums;';
    durEl.textContent = _formatTime(duration);
    player.appendChild(durEl);

    /* Speed control */
    var speedBtn = document.createElement('button');
    speedBtn.className = 'sl-speed-btn';
    speedBtn.style.cssText = 'background:none;border:1px solid rgba(0,0,0,0.15);border-radius:10px;padding:2px 8px;font-size:11px;font-weight:600;color:rgba(0,0,0,0.5);cursor:pointer;flex-shrink:0;min-width:32px;text-align:center;';
    speedBtn.textContent = '1x';
    var speeds = [1, 1.5, 2];
    var speedIdx = 0;
    speedBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      speedIdx = (speedIdx + 1) % speeds.length;
      speedBtn.textContent = speeds[speedIdx] + 'x';
      if (_currentAudio && player.dataset.playing === 'true') {
        _currentAudio.playbackRate = speeds[speedIdx];
      }
    });
    player.appendChild(speedBtn);

    /* Play/Pause handler */
    playBtn.addEventListener('click', function () {
      if (player.dataset.playing === 'true') {
        _pausePlayer(player);
      } else {
        _playPlayer(player, audioUrl, waveformData, opts);
      }
    });

    return player;
  }

  function _playPlayer(player, audioUrl, waveformData, opts) {
    _stopAllExcept(player);

    if (_currentAudio) {
      _currentAudio.pause();
      _currentAudio = null;
    }

    var audio = new Audio(audioUrl);
    _currentAudio = audio;
    _currentPlaying = player;
    player.dataset.playing = 'true';

    var playBtn = player.querySelector('.sl-play-btn');
    var durEl = player.querySelector('.sl-duration');
    var wfWrap = player.querySelector('div');
    var speedBtn = player.querySelector('.sl-speed-btn');
    var speed = parseFloat(speedBtn.textContent) || 1;
    audio.playbackRate = speed;

    playBtn.innerHTML = _pauseIcon();

    audio.addEventListener('loadedmetadata', function () {
      durEl.textContent = _formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', function () {
      if (!audio.duration) return;
      var progress = audio.currentTime / audio.duration;
      updateProgress(wfWrap, progress);
      durEl.textContent = _formatTime(audio.duration - audio.currentTime);
    });

    audio.addEventListener('ended', function () {
      _resetPlayer(player, waveformData, opts);
    });

    audio.addEventListener('error', function () {
      _resetPlayer(player, waveformData, opts);
      if (window.__DEBUG__) console.warn('[VoiceWaveform] Audio error');
    });

    audio.play().catch(function (e) {
      if (window.__DEBUG__) console.warn('[VoiceWaveform] Play error:', e);
      _resetPlayer(player, waveformData, opts);
    });
  }

  function _pausePlayer(player) {
    if (_currentAudio) _currentAudio.pause();
    player.dataset.playing = 'false';
    var playBtn = player.querySelector('.sl-play-btn');
    playBtn.innerHTML = _playIcon();
  }

  function _resetPlayer(player, waveformData, opts) {
    player.dataset.playing = 'false';
    var playBtn = player.querySelector('.sl-play-btn');
    var durEl = player.querySelector('.sl-duration');
    var wfWrap = player.querySelector('div');
    playBtn.innerHTML = _playIcon();
    durEl.textContent = _formatTime(opts.duration || 0);
    renderWaveform(wfWrap, waveformData, opts);
    _currentPlaying = null;
    _currentAudio = null;
    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
  }

  function _stopAllExcept(exceptPlayer) {
    if (_currentPlaying && _currentPlaying !== exceptPlayer) {
      _currentAudio.pause();
      _currentAudio = null;
      _currentPlaying.dataset.playing = 'false';
      var pb = _currentPlaying.querySelector('.sl-play-btn');
      if (pb) pb.innerHTML = _playIcon();
      _currentPlaying = null;
      if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
    }
  }

  function stopAll() {
    if (_currentAudio) {
      _currentAudio.pause();
      _currentAudio = null;
    }
    if (_currentPlaying) {
      _currentPlaying.dataset.playing = 'false';
      var pb = _currentPlaying.querySelector('.sl-play-btn');
      if (pb) pb.innerHTML = _playIcon();
      _currentPlaying = null;
    }
    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
  }

  /* ─── Recording visualization ───────────────────────────────────── */
  async function startRecordingVisualization(stream, container, options) {
    var opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
    _recordingStream = stream;

    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var source = ctx.createMediaStreamSource(stream);
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      _recordingAnalyser = analyser;

      var barCount = 42;
      var dataArray = new Uint8Array(analyser.frequencyBinCount);

      container.innerHTML = '';
      container.style.cssText = 'display:flex;align-items:center;justify-content:center;height:' + opts.height + 'px;gap:' + opts.barGap + 'px;overflow:hidden;';

      var bars = [];
      for (var i = 0; i < barCount; i++) {
        var bar = document.createElement('div');
        bar.style.cssText = 'width:' + opts.barWidth + 'px;height:2px;border-radius:' + (opts.barWidth / 2) + 'px;background:#008069;transition:height 0.05s ease;flex-shrink:0;';
        container.appendChild(bar);
        bars.push(bar);
      }

      function animate() {
        analyser.getByteFrequencyData(dataArray);
        var step = Math.floor(dataArray.length / barCount);
        for (var i = 0; i < barCount; i++) {
          var val = dataArray[i * step] / 255;
          var h = Math.max(2, val * opts.height);
          bars[i].style.height = h + 'px';
        }
        _recordingAnimFrame = requestAnimationFrame(animate);
      }
      animate();

      if (window.__DEBUG__) console.log('[VoiceWaveform] Recording visualization started');
    } catch (e) {
      if (window.__DEBUG__) console.error('[VoiceWaveform] Recording visualization error:', e);
    }
  }

  function stopRecordingVisualization() {
    if (_recordingAnimFrame) {
      cancelAnimationFrame(_recordingAnimFrame);
      _recordingAnimFrame = null;
    }
    _recordingAnalyser = null;
    _recordingStream = null;
    if (window.__DEBUG__) console.log('[VoiceWaveform] Recording visualization stopped');
  }

  /* ─── Icons ─────────────────────────────────────────────────────── */
  function _playIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
  }

  function _pauseIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  }

  /* ─── Helpers ────────────────────────────────────────────────────── */
  function _formatTime(seconds) {
    if (!seconds || !isFinite(seconds)) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ─── Public API ────────────────────────────────────────────────── */
  return {
    generateWaveform: generateWaveform,
    renderWaveform: renderWaveform,
    updateProgress: updateProgress,
    createPlayer: createPlayer,
    stopAll: stopAll,
    startRecordingVisualization: startRecordingVisualization,
    stopRecordingVisualization: stopRecordingVisualization,
    DEFAULT_OPTIONS: DEFAULT_OPTIONS
  };
})();
