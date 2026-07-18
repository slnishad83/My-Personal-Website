// Music Player — full playback engine with controls, Media Session, background play
(function() {
  'use strict';

  // ─── STATE ───
  const Player = {
    audio: null,
    queue: [],           // [{id, title, artist, url, thumbnail, duration, addedBy, addedByName}]
    queueIndex: -1,
    playlistId: null,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 'off',   // 'off' | 'all' | 'one'
    volume: 1,
    isMuted: false,
    currentTime: 0,
    duration: 0,
    playbackSpeed: 1,
    _seeking: false,
    _shuffleOrder: [],
    _originalOrder: [],
    _retryCount: 0,
    _maxRetries: 3,
    _isOnline: navigator.onLine !== false,
    crossfadeDuration: parseFloat(localStorage.getItem('nsl_music_crossfade') || '0'),
    _sleepTimerEnd: null,
    _sleepTimerInterval: null,
    _isCrossfading: false,
  };
  window.MusicPlayer = Player;

  // ─── INIT ───
  function _init() {
    Player.audio = new Audio();
    Player.audio.preload = 'auto';
    Player.audio.crossOrigin = 'anonymous';

    Player.audio.addEventListener('timeupdate', _onTimeUpdate);
    Player.audio.addEventListener('loadedmetadata', _onMetadata);
    Player.audio.addEventListener('ended', _onEnded);
    Player.audio.addEventListener('play', _onPlay);
    Player.audio.addEventListener('pause', _onPause);
    Player.audio.addEventListener('error', _onError);

    Player.volume = parseFloat(localStorage.getItem('nsl_music_volume') || '1');
    Player.audio.volume = Player.volume;
    Player.isShuffle = localStorage.getItem('nsl_music_shuffle') === 'true';
    Player.repeatMode = localStorage.getItem('nsl_music_repeat') || 'off';
    Player.playbackSpeed = parseFloat(localStorage.getItem('nsl_music_speed') || '1');

    _setupMediaSession();
    _setupNetworkListener();
    // Load saved EQ gains
    try { _eqGains = JSON.parse(localStorage.getItem('nsl_eq_gains') || '[0,0,0,0,0,0,0,0,0,0]'); } catch(_) {}
  }

  // ─── EQUALIZER ───
  let _audioCtx = null;
  let _analyser = null;
  let _eqBands = null;
  let _eqEnabled = false;
  const _EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
  let _eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  Player.initEqualizer = function() {
    if (_audioCtx) return;
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = _audioCtx.createMediaElementSource(Player.audio);
      _analyser = _audioCtx.createAnalyser();
      _analyser.fftSize = 256;

      _eqBands = _EQ_FREQUENCIES.map((freq) => {
        const filter = _audioCtx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.4;
        filter.gain.value = 0;
        return filter;
      });

      source.connect(_analyser);
      let lastNode = _analyser;
      _eqBands.forEach(band => { lastNode.connect(band); lastNode = band; });
      lastNode.connect(_audioCtx.destination);
      _eqEnabled = true;
    } catch (e) {
      console.warn('Equalizer init failed:', e);
    }
  };

  Player.setEqBand = function(index, gain) {
    if (!_eqBands || !_eqBands[index]) return;
    _eqGains[index] = gain;
    _eqBands[index].gain.value = gain;
    localStorage.setItem('nsl_eq_gains', JSON.stringify(_eqGains));
  };

  Player.resetEq = function() {
    _eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    if (_eqBands) _eqBands.forEach(b => b.gain.value = 0);
    localStorage.setItem('nsl_eq_gains', JSON.stringify(_eqGains));
    showToast('Equalizer reset', 'info');
  };

  Player.getAnalyserData = function() {
    if (!_analyser) return null;
    const data = new Uint8Array(_analyser.frequencyBinCount);
    _analyser.getByteFrequencyData(data);
    return data;
  };

  Player.showEqualizer = function() {
    Player.initEqualizer();
    const existing = document.getElementById('equalizer-overlay');
    if (existing) { existing.remove(); return; }

    const labels = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];

    const overlay = document.createElement('div');
    overlay.id = 'equalizer-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:400px;width:90vw;color:var(--on-surface)';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:16px;font-weight:700">Equalizer</h3>
        <button onclick="document.getElementById(\'equalizer-overlay\')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:18px">&times;</button>
      </div>
      <canvas id="eq-visualizer" width="360" height="80" style="width:100%;height:80px;border-radius:10px;background:rgba(0,0,0,0.3);margin-bottom:16px"></canvas>
      <div style="display:flex;gap:4px;justify-content:space-between;align-items:flex-end;height:200px;margin-bottom:8px">
        ${labels.map((label, i) => `
          <div style="display:flex;flex-direction:column;align-items:center;flex:1">
            <input type="range" min="-12" max="12" value="${_eqGains[i]}" orient="vertical" oninput="MusicPlayer.setEqBand(${i},Number(this.value));this.nextElementSibling.textContent=this.value+'dB'" style="writing-mode:vertical-lr;direction:rtl;height:160px;accent-color:var(--primary);width:24px">
            <div style="font-size:9px;color:var(--on-surface-variant);margin-top:4px">${_eqGains[i]}dB</div>
            <div style="font-size:8px;color:var(--on-surface-variant);margin-top:2px">${label}</div>
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button onclick="MusicPlayer.resetEq()" style="padding:8px 16px;border-radius:8px;border:none;background:rgba(255,255,255,0.06);color:var(--on-surface-variant);font-size:12px;font-weight:600;cursor:pointer">Reset</button>
      </div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    // Start visualizer animation
    _startVisualizer();
  };

  function _startVisualizer() {
    const canvas = document.getElementById('eq-visualizer');
    if (!canvas || !_analyser) return;
    const ctx = canvas.getContext('2d');
    const data = new Uint8Array(_analyser.frequencyBinCount);

    function draw() {
      const cv = document.getElementById('eq-visualizer');
      if (!cv) return;
      _analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / 32;
      for (let i = 0; i < 32; i++) {
        const val = data[i] / 255;
        const h = val * canvas.height * 0.9;
        ctx.fillStyle = `rgba(124, 77, 255, ${0.3 + val * 0.7})`;
        ctx.fillRect(i * barWidth + 1, canvas.height - h, barWidth - 2, h);
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  // ─── PLAYBACK ───
  Player.play = function(track, playlistId) {
    if (!track || !track.url) { showToast('No audio URL', 'error'); return; }
    if (playlistId) Player.playlistId = playlistId;

    if (Player.audio.src === track.url) {
      Player.audio.play().catch(() => {});
      return;
    }

    Player.audio.src = track.url;
    Player.audio.load();
    Player.audio.play().catch(e => {
      console.warn('Playback failed:', e);
      showToast('Playback failed — tap to retry', 'error');
    });

    Player._currentTrack = track;
    Player.isPlaying = true;
    Player.currentTime = 0;

    addRecentlyPlayed(track);
    _updateMediaSession(track);
    _updateMiniPlayer(track);
    _showMiniPlayer();
    _crossfadeIn();
  };

  Player.pause = function() {
    Player.audio?.pause();
  };

  Player.togglePlay = function() {
    if (Player.isPlaying) Player.pause();
    else if (Player._currentTrack) Player.audio?.play().catch(() => {});
    else if (Player.queue.length) Player.playTrack(0);
  };

  Player.stop = function() {
    Player.audio?.pause();
    Player.audio.src = '';
    Player.isPlaying = false;
    Player._currentTrack = null;
    Player.queueIndex = -1;
    _deactivateBackgroundMode();
    _hideMiniPlayer();
  };

  // ─── QUEUE ───
  Player.setQueue = function(tracks, startIndex) {
    Player._originalOrder = [...tracks];
    if (Player.isShuffle) {
      Player._shuffleOrder = _shuffleArray([...tracks]);
      Player.queue = Player._shuffleOrder;
    } else {
      Player.queue = [...tracks];
      Player._shuffleOrder = [];
    }
    Player.queueIndex = startIndex || 0;
    if (Player.queue[Player.queueIndex]) {
      Player.play(Player.queue[Player.queueIndex], Player.playlistId);
    }
  };

  Player.addToQueue = function(track) {
    Player.queue.push(track);
    Player._originalOrder.push(track);
    showToast(`Added "${track.title}" to queue`, 'success');
    _updateQueueUI();
  };

  Player.removeFromQueue = function(index) {
    if (index < 0 || index >= Player.queue.length) return;
    const wasPlaying = index === Player.queueIndex;
    Player.queue.splice(index, 1);
    if (index < Player.queueIndex) Player.queueIndex--;
    if (wasPlaying && Player.queue[Player.queueIndex]) {
      Player.play(Player.queue[Player.queueIndex]);
    }
    _updateQueueUI();
  };

  Player.clearQueue = function() {
    Player.queue = [];
    Player.queueIndex = -1;
    Player.stop();
  };

  Player.playTrack = function(index) {
    if (index < 0 || index >= Player.queue.length) return;
    Player.queueIndex = index;
    Player.play(Player.queue[index]);
  };

  Player.next = function() {
    if (!Player.queue.length) return;
    if (Player.repeatMode === 'one') {
      Player.audio.currentTime = 0;
      Player.audio.play().catch(() => {});
      return;
    }
    let next = Player.queueIndex + 1;
    if (next >= Player.queue.length) {
      if (Player.repeatMode === 'all') next = 0;
      else { Player.pause(); return; }
    }
    Player.playTrack(next);
  };

  Player.prev = function() {
    if (!Player.queue.length) return;
    if (Player.audio.currentTime > 3) {
      Player.audio.currentTime = 0;
      return;
    }
    let prev = Player.queueIndex - 1;
    if (prev < 0) prev = Player.repeatMode === 'all' ? Player.queue.length - 1 : 0;
    Player.playTrack(prev);
  };

  // ─── CONTROLS ───
  Player.seek = function(time) {
    if (Player.audio) Player.audio.currentTime = time;
  };

  Player.seekPercent = function(percent) {
    if (Player.audio && Player.duration) {
      Player.audio.currentTime = (percent / 100) * Player.duration;
    }
  };

  Player.setVolume = function(vol) {
    vol = Math.max(0, Math.min(1, vol));
    Player.volume = vol;
    Player.isMuted = false;
    if (Player.audio) Player.audio.volume = vol;
    localStorage.setItem('nsl_music_volume', String(vol));
    _updateVolumeUI();
  };

  Player.toggleMute = function() {
    Player.isMuted = !Player.isMuted;
    if (Player.audio) Player.audio.volume = Player.isMuted ? 0 : Player.volume;
    _updateVolumeUI();
  };

  Player.toggleShuffle = function() {
    Player.isShuffle = !Player.isShuffle;
    localStorage.setItem('nsl_music_shuffle', String(Player.isShuffle));

    if (Player.isShuffle) {
      const current = Player.queue[Player.queueIndex];
      const rest = Player.queue.filter((_, i) => i !== Player.queueIndex);
      Player._shuffleOrder = [current, ..._shuffleArray(rest)];
      Player.queue = Player._shuffleOrder;
      Player.queueIndex = 0;
    } else {
      const current = Player.queue[Player.queueIndex];
      Player.queue = [...Player._originalOrder];
      Player.queueIndex = Player.queue.findIndex(t => t.id === current?.id);
    }
    _updatePlayerUI();
  };

  Player.cycleRepeat = function() {
    const modes = ['off', 'all', 'one'];
    const idx = modes.indexOf(Player.repeatMode);
    Player.repeatMode = modes[(idx + 1) % modes.length];
    localStorage.setItem('nsl_music_repeat', Player.repeatMode);
    _updatePlayerUI();
  };

  // ─── EVENTS ───
  function _onTimeUpdate() {
    if (!Player.audio || Player._seeking) return;
    Player.currentTime = Player.audio.currentTime;
    _updateSeekUI();
    _updateMiniPlayerProgress();
    _applyCrossfade();
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && Player.duration) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Player.duration,
          playbackRate: Player.playbackSpeed || 1,
          position: Player.currentTime
        });
      } catch (e) {}
    }
  }

  function _onMetadata() {
    if (Player.audio) Player.duration = Player.audio.duration || 0;
    _updatePlayerUI();
  }

  function _onEnded() {
    Player.next();
  }

  function _onPlay() {
    Player.isPlaying = true;
    _updatePlayButtons();
    _activateBackgroundMode();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  function _onPause() {
    Player.isPlaying = false;
    _updatePlayButtons();
    _deactivateBackgroundMode();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }

  function _onError(e) {
    console.warn('Audio error:', e);
    if (Player._retryCount < Player._maxRetries && Player._isOnline) {
      Player._retryCount++;
      showToast(`Retrying... (${Player._retryCount}/${Player._maxRetries})`, 'info');
      setTimeout(() => {
        if (Player._currentTrack) {
          Player.audio.src = Player._currentTrack.url;
          Player.audio.load();
          Player.audio.play().catch(() => {});
        }
      }, 2000 * Player._retryCount);
    } else {
      showToast('Track unavailable — skipping', 'error');
      Player._retryCount = 0;
      setTimeout(() => Player.next(), 1500);
    }
  }

  // ─── PLAYBACK SPEED ───
  Player.setPlaybackSpeed = function(speed) {
    Player.playbackSpeed = speed;
    if (Player.audio) Player.audio.playbackRate = speed;
    localStorage.setItem('nsl_music_speed', speed.toString());
    _updateSpeedUI();
  };

  Player.cyclePlaybackSpeed = function() {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const idx = speeds.indexOf(Player.playbackSpeed);
    const next = speeds[(idx + 1) % speeds.length];
    Player.setPlaybackSpeed(next);
  };

  function _updateSpeedUI() {
    const el = document.getElementById('music-speed-btn');
    if (el) {
      el.textContent = Player.playbackSpeed + 'x';
      el.style.color = Player.playbackSpeed !== 1 ? 'var(--primary)' : 'var(--on-surface-variant)';
    }
    const fullEl = document.getElementById('music-full-speed');
    if (fullEl) {
      fullEl.textContent = Player.playbackSpeed + 'x';
      fullEl.style.color = Player.playbackSpeed !== 1 ? 'var(--primary)' : 'var(--on-surface-variant)';
    }
  }

  // ─── CROSSFADE ───
  Player.setCrossfade = function(seconds) {
    Player.crossfadeDuration = Math.max(0, Math.min(10, seconds));
    localStorage.setItem('nsl_music_crossfade', String(Player.crossfadeDuration));
    _updateCrossfadeUI();
  };

  Player.cycleCrossfade = function() {
    const opts = [0, 2, 3, 5, 8];
    const idx = opts.indexOf(Player.crossfadeDuration);
    Player.setCrossfade(opts[(idx + 1) % opts.length]);
    showToast(Player.crossfadeDuration ? `Crossfade: ${Player.crossfadeDuration}s` : 'Crossfade off', 'info');
  };

  function _applyCrossfade() {
    if (!Player.audio || Player.crossfadeDuration <= 0 || !Player.duration) return;
    const remaining = Player.duration - Player.currentTime;
    if (remaining < Player.crossfadeDuration && remaining > 0) {
      const progress = remaining / Player.crossfadeDuration;
      Player.audio.volume = Math.max(0, (Player.isMuted ? 0 : Player.volume) * progress);
    }
  }

  function _crossfadeIn() {
    if (Player.crossfadeDuration <= 0) return;
    Player._isCrossfading = true;
    Player.audio.volume = 0;
    const targetVol = Player.isMuted ? 0 : Player.volume;
    const step = targetVol / (Player.crossfadeDuration * 10);
    const fadeIn = setInterval(() => {
      if (!Player._isCrossfading || Player.audio.volume >= targetVol) {
        Player.audio.volume = targetVol;
        Player._isCrossfading = false;
        clearInterval(fadeIn);
        return;
      }
      Player.audio.volume = Math.min(Player.audio.volume + step, targetVol);
    }, 100);
  }

  function _updateCrossfadeUI() {
    const el = document.getElementById('music-crossfade-btn');
    if (el) {
      el.style.color = Player.crossfadeDuration > 0 ? 'var(--primary)' : 'var(--on-surface-variant)';
      el.title = Player.crossfadeDuration ? `Crossfade: ${Player.crossfadeDuration}s` : 'Crossfade off';
    }
  }

  // ─── SLEEP TIMER ───
  Player.setSleepTimer = function(minutes) {
    Player.cancelSleepTimer();
    if (minutes <= 0) return;
    Player._sleepTimerEnd = Date.now() + minutes * 60000;
    Player._sleepTimerInterval = setInterval(() => {
      const remaining = Player._sleepTimerEnd - Date.now();
      if (remaining <= 0) {
        Player.cancelSleepTimer();
        Player.pause();
        showToast('Sleep timer ended', 'info');
        return;
      }
      if (remaining < 10000 && Player.isPlaying) {
        const vol = Player.isMuted ? 0 : Player.volume;
        Player.audio.volume = Math.max(0, vol * (remaining / 10000));
      }
      _updateSleepTimerUI(remaining);
    }, 1000);
    showToast(`Sleep timer: ${minutes} min`, 'success');
    _updateSleepTimerUI(minutes * 60000);
  };

  Player.cancelSleepTimer = function() {
    if (Player._sleepTimerInterval) clearInterval(Player._sleepTimerInterval);
    Player._sleepTimerInterval = null;
    Player._sleepTimerEnd = null;
    if (Player.audio) Player.audio.volume = Player.isMuted ? 0 : Player.volume;
    _updateSleepTimerUI(0);
  };

  Player.showSleepTimerMenu = function() {
    const existing = document.getElementById('sleep-timer-menu');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'sleep-timer-menu';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:320px;width:85vw;color:var(--on-surface)';

    const presets = [
      { label: '15 min', minutes: 15 },
      { label: '30 min', minutes: 30 },
      { label: '45 min', minutes: 45 },
      { label: '1 hour', minutes: 60 },
      { label: '2 hours', minutes: 120 },
    ];

    panel.innerHTML = `
      <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;text-align:center">Sleep Timer</h3>
      ${Player._sleepTimerEnd ? `<p style="text-align:center;color:var(--primary);font-size:13px;margin:0 0 12px">Active — auto-stop in <span id="sleep-timer-countdown"></span></p>` : ''}
      <div style="display:flex;flex-direction:column;gap:8px">
        ${presets.map(p => `<button onclick="MusicPlayer.setSleepTimer(${p.minutes});document.getElementById('sleep-timer-menu')?.remove()" style="padding:12px;border-radius:12px;border:1px solid ${Player._sleepTimerEnd ? 'rgba(255,255,255,0.08)' : 'rgba(124,77,255,0.3)'};background:rgba(124,77,255,0.08);color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;text-align:center">${p.label}</button>`).join('')}
      </div>
      ${Player._sleepTimerEnd ? `<button onclick="MusicPlayer.cancelSleepTimer();document.getElementById('sleep-timer-menu')?.remove()" style="width:100%;margin-top:12px;padding:12px;border-radius:12px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);color:var(--error);font-size:13px;font-weight:700;cursor:pointer">Cancel Timer</button>` : ''}
      <button onclick="document.getElementById('sleep-timer-menu')?.remove()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;border:none;background:rgba(255,255,255,0.06);color:var(--on-surface-variant);font-size:13px;font-weight:600;cursor:pointer">Close</button>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  function _updateSleepTimerUI(ms) {
    const el = document.getElementById('music-sleep-timer');
    if (!el) return;
    if (!ms || ms <= 0) { el.textContent = ''; el.style.display = 'none'; return; }
    el.style.display = '';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    el.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  // ─── SHARE TRACK ───
  Player.shareTrack = function(track) {
    const t = track || Player._currentTrack;
    if (!t) return;
    if (navigator.share) {
      navigator.share({ title: t.title || 'Song', text: `${t.title || 'Song'} — ${t.artist || 'Unknown'}`, url: window.location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${t.title || 'Song'} — ${t.artist || 'Unknown'}`).then(() => showToast('Copied to clipboard', 'success'));
    }
  };

  // ─── QUEUE REORDER ───
  Player.moveInQueue = function(fromIdx, toIdx) {
    if (fromIdx < 0 || fromIdx >= Player.queue.length) return;
    if (toIdx < 0 || toIdx >= Player.queue.length) return;
    const [item] = Player.queue.splice(fromIdx, 1);
    Player.queue.splice(toIdx, 0, item);
    if (Player.queueIndex === fromIdx) Player.queueIndex = toIdx;
    else if (fromIdx < Player.queueIndex && toIdx >= Player.queueIndex) Player.queueIndex--;
    else if (fromIdx > Player.queueIndex && toIdx <= Player.queueIndex) Player.queueIndex++;
    _updateQueueUI();
  };

  // ─── BACKGROUND MODE (Capacitor) ───
  let _bgModeActive = false;

  function _activateBackgroundMode() {
    if (_bgModeActive) return;
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BackgroundMode) {
        window.Capacitor.Plugins.BackgroundMode.enable().then(() => {
          window.Capacitor.Plugins.BackgroundMode.set({ title: 'NSL Chat', text: 'Music playback active', color: '1A1B2E' });
          _bgModeActive = true;
        }).catch(() => {});
      }
    } catch(_) {}
  }

  function _deactivateBackgroundMode() {
    if (!_bgModeActive) return;
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BackgroundMode) {
        window.Capacitor.Plugins.BackgroundMode.disable().catch(() => {});
        _bgModeActive = false;
      }
    } catch(_) {}
  }

  // ─── NETWORK HANDLING ───
  function _setupNetworkListener() {
    window.addEventListener('online', () => {
      Player._isOnline = true;
      if (Player._currentTrack && !Player.isPlaying) {
        showToast('Back online — resuming', 'success');
        Player.audio.play().catch(() => {});
      }
    });
    window.addEventListener('offline', () => {
      Player._isOnline = false;
      showToast('You are offline', 'info');
    });
  }

  // ─── QUALITY DISPLAY ───
  Player.getAudioInfo = function() {
    if (!Player.audio) return null;
    return {
      sampleRate: Player.audio.sampleRate || 'unknown',
      channels: Player.audio.numberOfChannels || 'unknown',
      speed: Player.playbackSpeed,
      volume: Math.round(Player.volume * 100) + '%',
      networkType: navigator.connection?.effectiveType || 'unknown',
      downlink: navigator.connection?.downlink ? navigator.connection.downlink + ' Mbps' : 'unknown',
    };
  };

  Player.showAudioInfo = function() {
    const info = Player.getAudioInfo();
    if (!info) return;
    const track = Player._currentTrack;
    showToast(`Speed: ${info.speed}x | Volume: ${info.volume} | Network: ${info.networkType} | ${info.downlink}`, 'info');
  };

  // ─── MEDIA SESSION ───
  function _setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => Player.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => Player.togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => Player.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => Player.next());
    navigator.mediaSession.setActionHandler('seekbackward', (e) => {
      Player.seek(Math.max(0, Player.currentTime - (e.seekOffset || 10)));
    });
    navigator.mediaSession.setActionHandler('seekforward', (e) => {
      Player.seek(Math.min(Player.duration, Player.currentTime + (e.seekOffset || 10)));
    });
    navigator.mediaSession.setActionHandler('seekto', (e) => {
      if (e.seekTime != null) Player.seek(e.seekTime);
    });
  }

  function _updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || 'Unknown',
      artist: track.artist || 'Unknown',
      album: 'NSL Chat',
      artwork: track.thumbnail ? [{ src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
  }

  // ─── SHUFFLE ───
  function _shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ─── UI UPDATE ───
  function _updatePlayButtons() {
    document.querySelectorAll('.music-play-btn').forEach(btn => {
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = Player.isPlaying ? 'pause' : 'play_arrow';
    });
  }

  function _updateSeekUI() {
    const bar = document.getElementById('music-seek-bar');
    const timeEl = document.getElementById('music-current-time');
    const durEl = document.getElementById('music-duration');
    if (bar && Player.duration) bar.value = (Player.currentTime / Player.duration) * 100;
    if (timeEl) timeEl.textContent = formatTrackDuration(Player.currentTime);
    if (durEl) durEl.textContent = formatTrackDuration(Player.duration);
  }

  function _updateVolumeUI() {
    const slider = document.getElementById('music-volume');
    const icon = document.getElementById('music-volume-icon');
    if (slider) slider.value = Player.isMuted ? 0 : Player.volume * 100;
    if (icon) {
      if (Player.isMuted || Player.volume === 0) icon.textContent = 'volume_off';
      else if (Player.volume < 0.5) icon.textContent = 'volume_down';
      else icon.textContent = 'volume_up';
    }
  }

  function _updatePlayerUI() {
    const track = Player._currentTrack;
    if (!track) return;

    document.querySelectorAll('.music-track-title').forEach(el => el.textContent = track.title);
    document.querySelectorAll('.music-track-artist').forEach(el => el.textContent = track.artist);
    document.querySelectorAll('.music-track-thumb').forEach(el => {
      if (track.thumbnail) { el.src = track.thumbnail; el.style.display = ''; }
      else { el.style.display = 'none'; }
    });

    const shuffleBtn = document.getElementById('music-shuffle-btn');
    const repeatBtn = document.getElementById('music-repeat-btn');
    if (shuffleBtn) shuffleBtn.style.color = Player.isShuffle ? 'var(--primary)' : '';
    if (repeatBtn) {
      repeatBtn.style.color = Player.repeatMode !== 'off' ? 'var(--primary)' : '';
      const icon = repeatBtn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = Player.repeatMode === 'one' ? 'repeat_one' : 'repeat';
    }

    _updatePlayButtons();
    _updateSeekUI();
    _updateVolumeUI();
    _updateQueueUI();
  }

  function _updateQueueUI() {
    const list = document.getElementById('music-queue-list');
    if (!list) return;
    if (!Player.queue.length) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--on-surface-variant);font-size:13px">Queue is empty</div>';
      return;
    }
    list.innerHTML = Player.queue.map((t, i) => `
      <div class="queue-item" data-idx="${i}" draggable="true" ondragstart="_qDragStart(event,${i})" ondragover="event.preventDefault()" ondrop="_qDrop(event,${i})" ondragend="_qDragEnd()" style="display:flex;align-items:center;gap:3px;padding:6px 8px;border-radius:10px;background:${i===Player.queueIndex?'rgba(124,77,255,0.1)':'rgba(255,255,255,0.02)'};margin-bottom:3px;transition:background 0.15s">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--on-surface-variant);cursor:grab;opacity:0.4;flex-shrink:0;user-select:none" title="Drag to reorder">drag_indicator</span>
        <div style="width:36px;height:36px;border-radius:6px;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="MusicPlayer.playTrack(${i})">
          ${t.thumbnail ? `<img src="${escHtml(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover">` : '<span class="material-symbols-outlined" style="font-size:14px;color:var(--on-surface-variant)">music_note</span>'}
        </div>
        <div class="flex-1 min-w-0" style="cursor:pointer" onclick="MusicPlayer.playTrack(${i})">
          <div style="font-size:12px;font-weight:${i===Player.queueIndex?700:500};${i===Player.queueIndex?'color:var(--primary)':''}" class="truncate">${escHtml(t.title)}</div>
          <div style="font-size:10px;color:var(--on-surface-variant)" class="truncate">${escHtml(t.artist)}</div>
        </div>
        <span style="font-size:10px;color:var(--on-surface-variant);flex-shrink:0">${formatTrackDuration(t.duration)}</span>
        <button onclick="event.stopPropagation();MusicPlayer.removeFromQueue(${i})" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:4px;flex-shrink:0">
          <span class="material-symbols-outlined" style="font-size:14px">close</span>
        </button>
      </div>
    `).join('');
  }

  let _qDragIdx = null;
  window._qDragStart = function(e, idx) {
    _qDragIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
    e.target.closest('.queue-item').style.opacity = '0.4';
  };
  window._qDrop = function(e, toIdx) {
    e.preventDefault();
    if (_qDragIdx !== null && _qDragIdx !== toIdx) {
      Player.moveInQueue(_qDragIdx, toIdx);
    }
    _qDragIdx = null;
  };
  window._qDragEnd = function() {
    _qDragIdx = null;
    document.querySelectorAll('.queue-item').forEach(el => el.style.opacity = '');
  };

  // ─── MINI PLAYER ───
  function _showMiniPlayer() {
    if (document.getElementById('music-mini-player')) return;
    const mini = document.createElement('div');
    mini.id = 'music-mini-player';
    mini.setAttribute('role', 'region');
    mini.setAttribute('aria-label', 'Music mini player');
    mini.style.cssText = 'position:fixed;bottom:60px;left:0;right:0;z-index:95;background:var(--surface-container-high,#1e2a34);border-top:1px solid rgba(255,255,255,0.08);padding:8px 12px;padding-bottom:calc(8px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:10px;cursor:pointer;animation:slideUp 0.2s ease';
    mini.onclick = (e) => { if (e.target.closest('button')) return; openFullPlayer(); };
    document.body.appendChild(mini);
    let _swipeStartX = 0;
    let _swipeStartY = 0;
    mini.addEventListener('touchstart', (e) => {
      _swipeStartX = e.touches[0].clientX;
      _swipeStartY = e.touches[0].clientY;
    }, { passive: true });
    mini.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - _swipeStartX;
      const dy = e.changedTouches[0].clientY - _swipeStartY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) { Player.prev(); showToast('Previous', 'info'); }
        else { Player.next(); showToast('Next', 'info'); }
      }
    }, { passive: true });
  }

  function _hideMiniPlayer() {
    document.getElementById('music-mini-player')?.remove();
  }

  function _updateMiniPlayer(track) {
    if (!track) return;
    _showMiniPlayer();
    const mini = document.getElementById('music-mini-player');
    if (!mini) return;
    mini.innerHTML = `
      <div style="width:42px;height:42px;border-radius:8px;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,0.05)">
        ${track.thumbnail ? `<img src="${escHtml(track.thumbnail)}" style="width:100%;height:100%;object-fit:cover">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:20px;color:var(--primary)">music_note</span></div>'}
      </div>
      <div class="flex-1 min-w-0">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(track.title)}</div>
        <div style="font-size:11px;color:var(--on-surface-variant);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(track.artist)}</div>
      </div>
      <button class="music-play-btn" onclick="event.stopPropagation();MusicPlayer.togglePlay()" aria-label="${Player.isPlaying ? 'Pause' : 'Play'}" style="background:none;border:none;color:var(--on-surface);cursor:pointer;padding:4px">
        <span class="material-symbols-outlined" style="font-size:28px">${Player.isPlaying ? 'pause_circle' : 'play_circle'}</span>
      </button>
      <button onclick="event.stopPropagation();MusicPlayer.next()" aria-label="Next track" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:4px">
        <span class="material-symbols-outlined" style="font-size:22px">skip_next</span>
      </button>
      <div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:rgba(255,255,255,0.1)">
        <div id="mini-progress-bar" style="height:100%;background:var(--primary);transition:width 0.3s;width:0%"></div>
      </div>`;
  }

  function _updateMiniPlayerProgress() {
    const bar = document.getElementById('mini-progress-bar');
    if (bar && Player.duration) bar.style.width = ((Player.currentTime / Player.duration) * 100) + '%';
  }

  // ─── NOW PLAYING BADGE ───
  Player.getNowPlayingInfo = function() {
    if (!Player._currentTrack || !Player.isPlaying) return null;
    return { title: Player._currentTrack.title, artist: Player._currentTrack.artist, thumbnail: Player._currentTrack.thumbnail };
  };

  Player.renderNowPlayingBadge = function() {
    const info = Player.getNowPlayingInfo();
    if (!info) return '';
    return `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;background:rgba(124,77,255,0.1);border:1px solid rgba(124,77,255,0.2);margin-bottom:8px;cursor:pointer" onclick="openFullPlayer()">
    <div style="display:flex;gap:2px;align-items:flex-end;height:16px">
      <span class="np-bar" style="display:inline-block;width:3px;background:var(--primary);border-radius:2px;animation:eqBar 0.8s ease-in-out infinite alternate"></span>
      <span class="np-bar" style="display:inline-block;width:3px;background:var(--primary);border-radius:2px;animation:eqBar 0.6s ease-in-out 0.2s infinite alternate"></span>
      <span class="np-bar" style="display:inline-block;width:3px;background:var(--primary);border-radius:2px;animation:eqBar 0.7s ease-in-out 0.1s infinite alternate"></span>
      <span class="np-bar" style="display:inline-block;width:3px;background:var(--primary);border-radius:2px;animation:eqBar 0.5s ease-in-out 0.3s infinite alternate"></span>
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:11px;font-weight:600;color:var(--primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(info.title)}</div>
      <div style="font-size:10px;color:var(--on-surface-variant);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(info.artist)}</div>
    </div>
    <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary)">equalizer</span>
  </div>`;
  };

  Player.renderNowPlayingCSS = function() {
    return '<style>@keyframes eqBar{0%{height:4px}100%{height:16px}}</style>';
  };

  // ─── FULL PLAYER ───
  window.openFullPlayer = function() {
    const track = Player._currentTrack;
    if (!track) { showToast('No track playing', 'info'); return; }

    const overlay = document.createElement('div');
    overlay.id = 'full-player-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Music player');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:var(--surface-container,#0d1b2a);display:flex;flex-direction:column;animation:slideUp 0.3s ease';

    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px">
        <button onclick="document.getElementById('full-player-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface);cursor:pointer">
          <span class="material-symbols-outlined">keyboard_arrow_down</span>
        </button>
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:1px">Now Playing</div>
        </div>
        <button onclick="document.getElementById('full-player-overlay')?.remove();openPlaylistQueue()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer">
          <span class="material-symbols-outlined">queue_music</span>
        </button>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 32px">
        <div style="width:min(300px,70vw);height:min(300px,70vw);border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.5);margin-bottom:32px;background:rgba(255,255,255,0.05)">
          ${track.thumbnail ? `<img class="music-track-thumb" src="${escHtml(track.thumbnail)}" style="width:100%;height:100%;object-fit:cover">` : '<div class="music-track-thumb" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:80px;color:var(--primary);opacity:0.4">music_note</span></div>'}
        </div>
        <div style="text-align:center;width:100%">
          <div class="music-track-title" style="font-size:20px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(track.title)}</div>
          <div class="music-track-artist" style="font-size:14px;color:var(--on-surface-variant);margin-top:4px">${escHtml(track.artist)}</div>
          ${track.addedByName ? `<div style="font-size:11px;color:var(--on-surface-variant);margin-top:4px;opacity:0.6">Added by ${escHtml(track.addedByName)}</div>` : ''}
        </div>
      </div>

      <div style="padding:0 24px 8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span id="music-current-time" style="font-size:11px;color:var(--on-surface-variant);width:40px;text-align:right">0:00</span>
          <input type="range" id="music-seek-bar" min="0" max="100" value="0" oninput="MusicPlayer.seekPercent(this.value)" onmousedown="MusicPlayer._seeking=true" onmouseup="MusicPlayer._seeking=false" onchange="MusicPlayer._seeking=false" ontouchstart="MusicPlayer._seeking=true" ontouchend="MusicPlayer._seeking=false" aria-label="Seek" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" style="flex:1;accent-color:var(--primary);height:4px">
          <span id="music-duration" style="font-size:11px;color:var(--on-surface-variant);width:40px">0:00</span>
        </div>

        <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin:8px 0">
          <button id="music-shuffle-btn" onclick="MusicPlayer.toggleShuffle()" style="background:none;border:none;color:${Player.isShuffle?'var(--primary)':'var(--on-surface-variant)'};cursor:pointer;padding:4px">
            <span class="material-symbols-outlined" style="font-size:22px">shuffle</span>
          </button>
          <button onclick="MusicPlayer.prev()" style="background:none;border:none;color:var(--on-surface);cursor:pointer;padding:4px">
            <span class="material-symbols-outlined" style="font-size:32px">skip_previous</span>
          </button>
          <button class="music-play-btn" onclick="MusicPlayer.togglePlay()" style="background:var(--primary);border:none;color:var(--on-primary);width:64px;height:64px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(124,77,255,0.4)">
            <span class="material-symbols-outlined" style="font-size:36px">${Player.isPlaying ? 'pause' : 'play_arrow'}</span>
          </button>
          <button onclick="MusicPlayer.next()" style="background:none;border:none;color:var(--on-surface);cursor:pointer;padding:4px">
            <span class="material-symbols-outlined" style="font-size:32px">skip_next</span>
          </button>
          <button id="music-repeat-btn" onclick="MusicPlayer.cycleRepeat()" style="background:none;border:none;color:${Player.repeatMode!=='off'?'var(--primary)':'var(--on-surface-variant)'};cursor:pointer;padding:4px">
            <span class="material-symbols-outlined" style="font-size:22px">${Player.repeatMode==='one'?'repeat_one':'repeat'}</span>
          </button>
        </div>

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
          <button id="music-volume-icon" onclick="MusicPlayer.toggleMute()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:4px">
            <span class="material-symbols-outlined" style="font-size:20px">${Player.isMuted?'volume_off':'volume_up'}</span>
          </button>
          <input type="range" id="music-volume" min="0" max="100" value="${Player.volume*100}" oninput="MusicPlayer.setVolume(this.value/100)" aria-label="Volume" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Player.volume*100)}" style="flex:1;accent-color:var(--primary);height:3px">
          <button onclick="toggleTrackFavorite(Player._currentTrack)" style="background:none;border:none;color:${isTrackFavorite(track.url)?'var(--error)':'var(--on-surface-variant)'};cursor:pointer;padding:4px">
            <span class="material-symbols-outlined" style="font-size:20px">${isTrackFavorite(track.url)?'favorite':'favorite_border'}</span>
          </button>
        </div>

        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px;flex-wrap:wrap">
          <button id="music-full-speed" onclick="MusicPlayer.cyclePlaybackSpeed()" style="background:rgba(255,255,255,0.06);border:none;border-radius:8px;padding:4px 10px;color:${Player.playbackSpeed!==1?'var(--primary)':'var(--on-surface-variant)'};cursor:pointer;font-size:11px;font-weight:700">${Player.playbackSpeed}x</button>
          <button id="music-crossfade-btn" onclick="MusicPlayer.cycleCrossfade()" style="background:rgba(255,255,255,0.06);border:none;border-radius:8px;padding:4px 10px;color:${Player.crossfadeDuration>0?'var(--primary)':'var(--on-surface-variant)'};cursor:pointer;font-size:11px;font-weight:700" title="${Player.crossfadeDuration?'Crossfade: '+Player.crossfadeDuration+'s':'Crossfade off'}">${Player.crossfadeDuration ? Player.crossfadeDuration+'s' : 'X-Fade'}</button>
          <button onclick="MusicPlayer.showSleepTimerMenu()" style="background:rgba(255,255,255,0.06);border:none;border-radius:8px;padding:4px 10px;color:${Player._sleepTimerEnd?'var(--primary)':'var(--on-surface-variant)'};cursor:pointer;font-size:11px;font-weight:700;display:flex;align-items:center;gap:4px" title="Sleep Timer">
            <span class="material-symbols-outlined" style="font-size:14px">bedtime</span>
            <span id="music-sleep-timer" style="display:none"></span>
            ${!Player._sleepTimerEnd ? 'Sleep' : ''}
          </button>
          <button onclick="MusicPlayer.showEqualizer()" style="background:rgba(255,255,255,0.06);border:none;border-radius:8px;padding:4px 10px;color:var(--on-surface-variant);cursor:pointer;font-size:11px;font-weight:700" title="Equalizer">
            <span class="material-symbols-outlined" style="font-size:14px">equalizer</span>
          </button>
          <button onclick="MusicPlayer.shareTrack()" style="background:rgba(255,255,255,0.06);border:none;border-radius:8px;padding:4px 10px;color:var(--on-surface-variant);cursor:pointer;font-size:11px;font-weight:700" title="Share">
            <span class="material-symbols-outlined" style="font-size:14px">share</span>
          </button>
        </div>
      </div>`;

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    const _fullPlayerEscHandler = function(e) {
      if (e.key === 'Escape') {
        const el = document.getElementById('full-player-overlay');
        if (el) el.remove();
        document.removeEventListener('keydown', _fullPlayerEscHandler);
      }
    };
    document.addEventListener('keydown', _fullPlayerEscHandler);
    document.body.appendChild(overlay);
  };

  // ─── QUEUE PANEL ───
  window.openPlaylistQueue = function() {
    const existing = document.getElementById('playlist-queue-overlay');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'playlist-queue-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:500px;max-height:70vh;overflow:hidden;display:flex;flex-direction:column;color:var(--on-surface)';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0;font-size:16px;font-weight:700">Queue (${Player.queue.length} tracks)</h3>
        <button onclick="document.getElementById('playlist-queue-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:18px">&times;</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="MusicPlayer.clearQueue()" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,255,255,0.06);color:var(--on-surface-variant);font-size:11px;font-weight:600;cursor:pointer">Clear All</button>
        <button onclick="MusicPlayer.toggleShuffle()" style="padding:6px 12px;border-radius:8px;border:none;background:${Player.isShuffle?'rgba(124,77,255,0.2)':'rgba(255,255,255,0.06)'};color:${Player.isShuffle?'var(--primary)':'var(--on-surface-variant)'};font-size:11px;font-weight:600;cursor:pointer">Shuffle</button>
      </div>
      <div id="music-queue-list" style="flex:1;overflow-y:auto"></div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    _updateQueueUI();
  };

  // ─── RESTORE ───
  function _restoreSession() {
    try {
      const last = JSON.parse(localStorage.getItem('nsl_last_track') || 'null');
      if (last && last.url) {
        Player._currentTrack = last;
        Player.audio.src = last.url;
        if (last._savedPosition && last._savedPosition > 0) {
          Player.audio.currentTime = last._savedPosition;
        }
        _updateMiniPlayer(last);
      }
    } catch(_) {}
  }

  setInterval(() => {
    if (Player._currentTrack && Player.audio) {
      try {
        const toSave = { ...Player._currentTrack, _savedPosition: Player.audio.currentTime || 0 };
        localStorage.setItem('nsl_last_track', JSON.stringify(toSave));
      } catch(_) {}
    }
  }, 5000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { _init(); _restoreSession(); });
  } else {
    _init();
    _restoreSession();
  }
})();
