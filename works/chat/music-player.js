// Music Player â€” full playback engine with controls, Media Session, background play
(function() {
  'use strict';

  // â”€â”€â”€ STATE â”€â”€â”€
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

  // Safety fallback â€” playlist-core.js defines the real version, but this prevents crashes if load order changes
  if (typeof window.formatTrackDuration !== 'function') {
    window.formatTrackDuration = function(seconds) {
      if (!seconds || seconds <= 0) return '0:00';
      var m = Math.floor(seconds / 60);
      var s = Math.floor(seconds % 60);
      return m + ':' + String(s).padStart(2, '0');
    };
  }
  if (typeof window.showToast !== 'function') {
    window.showToast = function(msg) { if (window.__DEBUG__) console.log('[Music]', msg); };
  }
  if (typeof window.escHtml !== 'function') {
    window.escHtml = function(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  }

  function _haptic(style) {
    try {
      if (navigator.vibrate) {
        if (style === 'light') navigator.vibrate(10);
        else if (style === 'medium') navigator.vibrate(20);
        else if (style === 'heavy') navigator.vibrate(40);
        else navigator.vibrate(10);
      }
    } catch(_) {}
  }

  // â”€â”€â”€ INIT â”€â”€â”€
  function _init() {
    Player.audio = new Audio();
    Player.audio.preload = 'auto';

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

  // â”€â”€â”€ EQUALIZER â”€â”€â”€
  let _audioCtx = null;
  let _analyser = null;
  let _eqBands = null;
  let _eqEnabled = false;
  const _EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
  const _EQ_PRESETS = {
    'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'Bass Boost': [8, 6, 4, 2, 0, 0, 0, 0, 0, 0],
    'Vocal': [-2, 0, 2, 4, 4, 3, 1, 0, -1, -2],
    'Classical': [0, 0, 0, 0, 0, 0, -4, -4, -4, -6],
    'Pop': [-1, 2, 4, 5, 3, 0, -1, -1, 2, 3],
    'Rock': [5, 4, 2, 0, -1, -1, 0, 2, 3, 4],
    'Jazz': [0, 0, 2, 4, 4, 4, 0, 2, 3, 3],
    'Electronic': [6, 4, 0, -2, 0, 0, 0, 2, 4, 6],
  };
  let _eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  Player.initEqualizer = function() {
    if (_audioCtx) {
      if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(()=>{});
      return;
    }
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(()=>{});
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
      if (window.__DEBUG__) console.warn('Equalizer init failed:', e);
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

  Player.applyEqPreset = function(name) {
    const gains = _EQ_PRESETS[name];
    if (!gains) return;
    _eqGains = [...gains];
    if (_eqBands) _eqBands.forEach((b, i) => b.gain.value = _eqGains[i]);
    localStorage.setItem('nsl_eq_gains', JSON.stringify(_eqGains));
    showToast('Preset: ' + name, 'info');
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
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:400px;width:92vw;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;color:var(--on-surface)';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:16px;font-weight:700">Equalizer</h3>
        <button onclick="document.getElementById('equalizer-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:18px">&times;</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;justify-content:center">
        ${Object.keys(_EQ_PRESETS).map(name => `<button onclick="MusicPlayer.applyEqPreset('${name}')" style="padding:6px 12px;border-radius:8px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface-variant);font-size:11px;font-weight:600;cursor:pointer;min-height:32px">${name}</button>`).join('')}
      </div>
      <canvas id="eq-visualizer" width="360" height="80" style="width:100%;height:80px;border-radius:10px;background:rgba(0,0,0,0.3);margin-bottom:16px"></canvas>
      <div style="display:flex;gap:4px;justify-content:space-between;align-items:flex-end;height:200px;margin-bottom:8px">
        ${labels.map((label, i) => `
          <div style="display:flex;flex-direction:column;align-items:center;flex:1">
            <input type="range" min="-12" max="12" value="${_eqGains[i]}" orient="vertical" oninput="MusicPlayer.setEqBand(${i},Number(this.value));this.nextElementSibling.textContent=this.value+'dB'" style="writing-mode:vertical-lr;direction:rtl;height:160px;accent-color:var(--primary);width:28px">
            <div style="font-size:9px;color:var(--on-surface-variant);margin-top:4px">${_eqGains[i]}dB</div>
            <div style="font-size:8px;color:var(--on-surface-variant);margin-top:2px">${label}</div>
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button onclick="MusicPlayer.resetEq()" style="padding:8px 16px;border-radius:8px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant);font-size:12px;font-weight:600;cursor:pointer;min-height:44px">Reset</button>
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
    const data = new Uint8Array(_analyser.frequencyBinCount);

    function draw() {
      const cv = document.getElementById('eq-visualizer');
      if (!cv || !_analyser) return;
      const ctx = cv.getContext('2d');
      _analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, cv.width, cv.height);
      const barWidth = cv.width / 32;
      for (let i = 0; i < 32; i++) {
        const val = data[i] / 255;
        const h = val * cv.height * 0.9;
        ctx.fillStyle = `rgba(124, 77, 255, ${0.3 + val * 0.7})`;
        ctx.fillRect(i * barWidth + 1, cv.height - h, barWidth - 2, h);
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  // --- OFFLINE MUSIC STORAGE (IndexedDB) ---
  const MusicOfflineStorage = {
    _dbName: 'nsl_music_offline_db',
    _storeName: 'audio_blobs',
    _db: null,
    async init() {
      if (this._db) return this._db;
      return new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open(this._dbName, 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(this._storeName)) {
              db.createObjectStore(this._storeName, { keyPath: 'id' });
            }
          };
          req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
          req.onerror = () => reject(req.error);
        } catch(err) { reject(err); }
      });
    },
    async saveTrackBlob(id, blob, metadata = {}) {
      try {
        const db = await this.init();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(this._storeName, 'readwrite');
          const store = tx.objectStore(this._storeName);
          store.put({ id, blob, metadata, cachedAt: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        });
      } catch(e) { return false; }
    },
    async getTrackBlob(id) {
      try {
        const db = await this.init();
        return new Promise((resolve) => {
          const tx = db.transaction(this._storeName, 'readonly');
          const store = tx.objectStore(this._storeName);
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result ? req.result.blob : null);
          req.onerror = () => resolve(null);
        });
      } catch(e) { return null; }
    },
    async isTrackCached(id) {
      const blob = await this.getTrackBlob(id);
      return !!blob;
    },
    async removeTrack(id) {
      try {
        const db = await this.init();
        return new Promise((resolve) => {
          const tx = db.transaction(this._storeName, 'readwrite');
          const store = tx.objectStore(this._storeName);
          store.delete(id);
          tx.oncomplete = () => resolve(true);
        });
      } catch(_) { return false; }
    }
  };
  window.MusicOfflineStorage = MusicOfflineStorage;

  // ─── PLAYBACK ───
  Player.play = async function(track, playlistId) {
    if (window.__DEBUG__) console.log('[MusicPlayer] play() called:', track ? { id: track.id, title: track.title } : 'null track');
    _haptic('light');
    if (!track || (!track.url && !track.id)) { if (window.__DEBUG__) console.warn('[MusicPlayer] No track or URL'); showToast('No audio URL', 'error'); return; }
    if (playlistId) Player.playlistId = playlistId;

    // Resume AudioContext if suspended (mobile autoplay policy)
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(()=>{});
    }

    let playbackUrl = track.url;
    let isOfflineSource = false;

    // Check IndexedDB offline cache first
    try {
      const offlineBlob = await MusicOfflineStorage.getTrackBlob(track.id);
      if (offlineBlob) {
        playbackUrl = URL.createObjectURL(offlineBlob);
        isOfflineSource = true;
      }
    } catch(_) {}

    if (!playbackUrl && navigator.onLine === false) {
      showToast('Track not cached for offline play ⚡', 'error');
      return;
    }

    if (Player.audio.src === playbackUrl) {
      Player.audio.play().catch(() => {});
      return;
    }

    Player.audio.src = playbackUrl;
    Player.audio.load();
    Player.audio.play().then(() => {
      if (window.__DEBUG__) console.log('[MusicPlayer] Audio playback started successfully', isOfflineSource ? '(Offline Cache)' : '(Network)');
      // If played from network successfully, auto-cache to IndexedDB in background
      if (!isOfflineSource && track.url && (track.source === 'upload' || track.source === 'library')) {
        fetch(track.url).then(res => res.blob()).then(blob => {
          MusicOfflineStorage.saveTrackBlob(track.id, blob, { title: track.title, artist: track.artist });
        }).catch(()=>{});
      }
    }).catch(e => {
      if (window.__DEBUG__) console.error('[MusicPlayer] Playback failed:', e.name, e.message);
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
    _haptic('light');
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

  // â”€â”€â”€ QUEUE â”€â”€â”€
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
    _haptic('light');
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
    _haptic('light');
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
    _haptic('light');
    if (!Player.queue.length) return;
    if (Player.audio.currentTime > 3) {
      Player.audio.currentTime = 0;
      return;
    }
    let prev = Player.queueIndex - 1;
    if (prev < 0) prev = Player.repeatMode === 'all' ? Player.queue.length - 1 : 0;
    Player.playTrack(prev);
  };

  // â”€â”€â”€ CONTROLS â”€â”€â”€
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

  // â”€â”€â”€ EVENTS â”€â”€â”€
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
    Player._retryCount = 0;
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
    if (window.__DEBUG__) console.warn('Audio error:', e);
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
      showToast('Track unavailable â€” skipping', 'error');
      Player._retryCount = 0;
      setTimeout(() => Player.next(), 1500);
    }
  }

  // â”€â”€â”€ PLAYBACK SPEED â”€â”€â”€
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

  // â”€â”€â”€ CROSSFADE â”€â”€â”€
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
    // Clear any existing crossfade interval to prevent leaks
    if (Player._crossfadeInInterval) { clearInterval(Player._crossfadeInInterval); Player._crossfadeInInterval = null; }
    Player._isCrossfading = true;
    Player.audio.volume = 0;
    const targetVol = Player.isMuted ? 0 : Player.volume;
    const step = targetVol / (Player.crossfadeDuration * 10);
    Player._crossfadeInInterval = setInterval(() => {
      if (!Player._isCrossfading || Player.audio.volume >= targetVol) {
        Player.audio.volume = targetVol;
        Player._isCrossfading = false;
        clearInterval(Player._crossfadeInInterval);
        Player._crossfadeInInterval = null;
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

  // â”€â”€â”€ SLEEP TIMER â”€â”€â”€
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
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;padding-bottom:calc(24px + env(safe-area-inset-bottom,0px));max-width:320px;width:85vw;color:var(--on-surface)';

    const presets = [
      { label: '15 min', minutes: 15 },
      { label: '30 min', minutes: 30 },
      { label: '45 min', minutes: 45 },
      { label: '1 hour', minutes: 60 },
      { label: '2 hours', minutes: 120 },
    ];

    panel.innerHTML = `
      <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;text-align:center">Sleep Timer</h3>
      ${Player._sleepTimerEnd ? `<p style="text-align:center;color:var(--primary);font-size:13px;margin:0 0 12px">Active â€” auto-stop in <span id="sleep-timer-countdown"></span></p>` : ''}
      <div style="display:flex;flex-direction:column;gap:8px">
        ${presets.map(p => `<button onclick="MusicPlayer.setSleepTimer(${p.minutes});document.getElementById('sleep-timer-menu')?.remove()" style="padding:12px;border-radius:12px;border:1px solid ${Player._sleepTimerEnd ? 'var(--outline-variant,rgba(0,0,0,0.08))' : 'rgba(124,77,255,0.3)'};background:rgba(124,77,255,0.08);color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;text-align:center">${p.label}</button>`).join('')}
      </div>
      ${Player._sleepTimerEnd ? `<button onclick="MusicPlayer.cancelSleepTimer();document.getElementById('sleep-timer-menu')?.remove()" style="width:100%;margin-top:12px;padding:12px;border-radius:12px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);color:var(--error);font-size:13px;font-weight:700;cursor:pointer">Cancel Timer</button>` : ''}
      <button onclick="document.getElementById('sleep-timer-menu')?.remove()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant);font-size:13px;font-weight:600;cursor:pointer">Close</button>`;

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

  // â”€â”€â”€ SHARE TRACK â”€â”€â”€
  Player.shareTrack = function(track) {
    const t = track || Player._currentTrack;
    if (!t) return;
    if (navigator.share) {
      navigator.share({ title: t.title || 'Song', text: `${t.title || 'Song'} â€” ${t.artist || 'Unknown'}`, url: window.location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${t.title || 'Song'} â€” ${t.artist || 'Unknown'}`).then(() => showToast('Copied to clipboard', 'success'));
    }
  };

  // â”€â”€â”€ QUEUE REORDER â”€â”€â”€
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

  // â”€â”€â”€ BACKGROUND MODE (Capacitor) â”€â”€â”€
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

  // â”€â”€â”€ NETWORK HANDLING â”€â”€â”€
  function _setupNetworkListener() {
    window.addEventListener('online', () => {
      Player._isOnline = true;
      if (Player._currentTrack && !Player.isPlaying) {
        showToast('Back online â€” resuming', 'success');
        Player.audio.play().catch(() => {});
      }
    });
    window.addEventListener('offline', () => {
      Player._isOnline = false;
      showToast('You are offline', 'info');
    });
  }

  // â”€â”€â”€ QUALITY DISPLAY â”€â”€â”€
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
    const _track = Player._currentTrack;
    showToast(`Speed: ${info.speed}x | Volume: ${info.volume} | Network: ${info.networkType} | ${info.downlink}`, 'info');
  };

  // â”€â”€â”€ MEDIA SESSION â”€â”€â”€
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

  // â”€â”€â”€ SHUFFLE â”€â”€â”€
  function _shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // â”€â”€â”€ UI UPDATE â”€â”€â”€
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
      <div class="queue-item" data-idx="${i}" draggable="true" ondragstart="_qDragStart(event,${i})" ondragover="event.preventDefault()" ondrop="_qDrop(event,${i})" ondragend="_qDragEnd()" style="display:flex;align-items:center;gap:3px;padding:6px 8px;border-radius:10px;background:${i===Player.queueIndex?'rgba(124,77,255,0.1)':'var(--surface-container-low,rgba(0,0,0,0.02))'};margin-bottom:3px;transition:all 0.3s ease;${i===Player.queueIndex?'transform:scale(1.02);box-shadow:0 0 12px rgba(124,77,255,0.15);':'transform:scale(1);'}">
        <span class="material-symbols-outlined" style="font-size:14px;color:var(--on-surface-variant);cursor:grab;opacity:0.4;flex-shrink:0;user-select:none;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center" title="Drag to reorder">drag_indicator</span>
        <div style="width:36px;height:36px;border-radius:6px;overflow:hidden;flex-shrink:0;background:var(--surface-container-low,rgba(0,0,0,0.05));display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="MusicPlayer.playTrack(${i})">
          ${t.thumbnail ? `<img src="${escHtml(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover">` : '<span class="material-symbols-outlined" style="font-size:14px;color:var(--on-surface-variant)">music_note</span>'}
        </div>
        <div class="flex-1 min-w-0" style="cursor:pointer" onclick="MusicPlayer.playTrack(${i})">
          <div style="font-size:12px;font-weight:${i===Player.queueIndex?700:500};${i===Player.queueIndex?'color:var(--primary)':''}" class="truncate">${escHtml(t.title)}</div>
          <div style="font-size:10px;color:var(--on-surface-variant)" class="truncate">${escHtml(t.artist)}</div>
        </div>
        ${i===Player.queueIndex ? '<div style="display:flex;gap:1px;align-items:flex-end;height:12px;flex-shrink:0"><span style="display:inline-block;width:2px;background:var(--primary);border-radius:1px;animation:eqBar 0.8s ease-in-out infinite alternate"></span><span style="display:inline-block;width:2px;background:var(--primary);border-radius:1px;animation:eqBar 0.6s ease-in-out 0.2s infinite alternate"></span><span style="display:inline-block;width:2px;background:var(--primary);border-radius:1px;animation:eqBar 0.7s ease-in-out 0.1s infinite alternate"></span></div>' : ''}
        <span style="font-size:10px;color:var(--on-surface-variant);flex-shrink:0">${formatTrackDuration(t.duration)}</span>
        <button onclick="event.stopPropagation();MusicPlayer.removeFromQueue(${i})" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:4px;flex-shrink:0;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">
          <span class="material-symbols-outlined" style="font-size:14px">close</span>
        </button>
      </div>
    `).join('');
  }

  let _qDragIdx = null;
  window._qDragStart = function(e, idx) {
    _qDragIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
    var item = e.target.closest('.queue-item');
    if (item) item.style.opacity = '0.4';
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

  // â”€â”€â”€ MINI PLAYER (Floating, draggable) â”€â”€â”€
  const _MINI_POS_KEY = 'nsl_mini_player_pos';
  let _miniDragging = false;
  let _miniDragStartX = 0;
  let _miniDragStartY = 0;
  let _miniStartLeft = 0;
  let _miniStartTop = 0;
  let _miniMoved = false;

  function _showMiniPlayer() {
    if (document.getElementById('music-mini-player')) return;
    const mini = document.createElement('div');
    mini.id = 'music-mini-player';
    mini.setAttribute('role', 'region');
    mini.setAttribute('aria-label', 'Music mini player');
    // Restore saved position or default to bottom-right
    let pos;
    try { pos = JSON.parse(localStorage.getItem(_MINI_POS_KEY)); } catch(_) {}
    if (!pos || typeof pos.left !== 'number' || typeof pos.top !== 'number') {
      const miniW = Math.min(280, window.innerWidth - 32);
      pos = { left: window.innerWidth - miniW - 16, top: window.innerHeight - 80 - 16 };
    }
    const miniW = Math.min(280, window.innerWidth - 32);
    pos.left = Math.max(8, Math.min(pos.left, window.innerWidth - miniW));
    pos.top = Math.max(8, Math.min(pos.top, window.innerHeight - 80));
    mini.style.cssText = `position:fixed;left:${pos.left}px;top:${pos.top}px;z-index:95;width:${miniW}px;max-width:calc(100vw - 32px);background:var(--surface-container-high,#1e2a34);border-radius:14px;border:1px solid var(--outline-variant,rgba(255,255,255,0.1));box-shadow:0 6px 24px rgba(0,0,0,0.4);padding:8px 10px;display:flex;align-items:center;gap:4px;cursor:grab;animation:fadeIn 0.2s ease;touch-action:none;user-select:none;-webkit-user-select:none;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)`;
    mini.onclick = (e) => {
      if (_miniMoved) return;
      if (e.target.closest('button')) return;
      openFullPlayer();
    };
    document.body.appendChild(mini);

    // Drag handlers (touch + mouse)
    function _onDragStart(ex, ey) {
      _miniDragging = true;
      _miniMoved = false;
      _miniDragStartX = ex;
      _miniDragStartY = ey;
      const rect = mini.getBoundingClientRect();
      _miniStartLeft = rect.left;
      _miniStartTop = rect.top;
      mini.style.cursor = 'grabbing';
      mini.style.transition = 'none';
    }
    function _onDragMove(ex, ey) {
      if (!_miniDragging) return;
      const dx = ex - _miniDragStartX;
      const dy = ey - _miniDragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _miniMoved = true;
      let newLeft = _miniStartLeft + dx;
      let newTop = _miniStartTop + dy;
      const mw = Math.min(280, window.innerWidth - 32);
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - mw));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - 80));
      mini.style.left = newLeft + 'px';
      mini.style.top = newTop + 'px';
    }
    function _onDragEnd() {
      if (!_miniDragging) return;
      _miniDragging = false;
      mini.style.cursor = 'grab';
      mini.style.transition = '';
      const rect = mini.getBoundingClientRect();
      localStorage.setItem(_MINI_POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
      // Snap to nearest edge if close
      setTimeout(() => { _miniMoved = false; }, 50);
    }
    // Touch events
    mini.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;
      _onDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    mini.addEventListener('touchmove', (e) => {
      if (!_miniDragging) return;
      e.preventDefault();
      _onDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    mini.addEventListener('touchend', () => _onDragEnd(), { passive: true });
    // Mouse events
    mini.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      _onDragStart(e.clientX, e.clientY);
      const _mm = (ev) => _onDragMove(ev.clientX, ev.clientY);
      const _mu = () => { _onDragEnd(); document.removeEventListener('mousemove', _mm); document.removeEventListener('mouseup', _mu); };
      document.addEventListener('mousemove', _mm);
      document.addEventListener('mouseup', _mu);
    });
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
      <div style="width:38px;height:38px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--surface-container-low,rgba(0,0,0,0.05))">
        ${track.thumbnail ? `<img src="${escHtml(track.thumbnail)}" style="width:100%;height:100%;object-fit:cover">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">music_note</span></div>'}
      </div>
      <div style="flex:1;min-width:0;pointer-events:none">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--on-surface)">${escHtml(track.title)}</div>
        <div style="font-size:10px;color:var(--on-surface-variant);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(track.artist)}</div>
      </div>
      <button class="music-play-btn" onclick="event.stopPropagation();event.preventDefault();MusicPlayer.togglePlay()" aria-label="${Player.isPlaying ? 'Pause' : 'Play'}" style="background:none;border:none;color:var(--on-surface);cursor:pointer;padding:2px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">
        <span class="material-symbols-outlined" style="font-size:26px">${Player.isPlaying ? 'pause_circle' : 'play_circle'}</span>
      </button>
      <button onclick="event.stopPropagation();event.preventDefault();MusicPlayer.next()" aria-label="Next track" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:2px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">
        <span class="material-symbols-outlined" style="font-size:18px">skip_next</span>
      </button>
      <button onclick="event.stopPropagation();event.preventDefault();openFullPlayer()" aria-label="Maximize player" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:2px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">
        <span class="material-symbols-outlined" style="font-size:16px">open_in_full</span>
      </button>
      <button onclick="event.stopPropagation();event.preventDefault();MusicPlayer.stop()" aria-label="Close player" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:2px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">
        <span class="material-symbols-outlined" style="font-size:16px">close</span>
      </button>
      <div style="position:absolute;bottom:0;left:8px;right:8px;height:2px;background:var(--outline-variant,rgba(0,0,0,0.08));border-radius:1px">
        <div id="mini-progress-bar" style="height:100%;background:var(--primary);transition:width 0.3s;width:0%;border-radius:1px"></div>
      </div>`;
  }

  function _updateMiniPlayerProgress() {
    const bar = document.getElementById('mini-progress-bar');
    if (bar && Player.duration) bar.style.width = ((Player.currentTime / Player.duration) * 100) + '%';
  }

  // â”€â”€â”€ NOW PLAYING BADGE â”€â”€â”€
  Player.getNowPlayingInfo = function() {
    if (!Player._currentTrack || !Player.isPlaying) return null;
    return { title: Player._currentTrack.title, artist: Player._currentTrack.artist, thumbnail: Player._currentTrack.thumbnail };
  };

  Player.renderNowPlayingBadge = function() {
    const info = Player.getNowPlayingInfo();
    if (!info) return '';
    return `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;background:rgba(124,77,255,0.1);border:1px solid rgba(124,77,255,0.2);margin-bottom:8px;cursor:pointer" data-action="openFullPlayer">
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

  // â”€â”€â”€ FULL PLAYER â”€â”€â”€
  window.openFullPlayer = function() {
    const track = Player._currentTrack;
    if (!track) { showToast('No track playing', 'info'); return; }

    const existingOverlay = document.getElementById('full-player-overlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'full-player-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Music player');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:var(--surface-container,#0d1b2a);display:flex;flex-direction:column;animation:slideUp 0.3s ease;touch-action:manipulation;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px) 0';

    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px">
        <div style="display:flex;align-items:center;gap:4px">
          <button onclick="MusicPlayer.stop()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:8px" title="Close player">
            <span class="material-symbols-outlined">close</span>
          </button>
          <button onclick="document.getElementById('full-player-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface);cursor:pointer;padding:8px" title="Minimize player">
            <span class="material-symbols-outlined">keyboard_arrow_down</span>
          </button>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:1px">Now Playing</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <button id="music-screen-lock-btn" onclick="MusicPlayer.toggleWakeLock()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:8px" title="Keep screen on">
            <span class="material-symbols-outlined" id="music-lock-icon">screen_lock_portrait</span>
          </button>
          <button onclick="MusicPlayer.minimizePlayer()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:8px" title="Mini player">
            <span class="material-symbols-outlined">picture_in_picture_alt</span>
          </button>
          <button onclick="document.getElementById('full-player-overlay')?.remove();openPlaylistQueue()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:8px">
            <span class="material-symbols-outlined">queue_music</span>
          </button>
        </div>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 32px">
        <div style="width:min(280px,65vw,40vh);height:min(280px,65vw,40vh);max-height:50vh;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.5);margin-bottom:32px;background:var(--surface-container-low,rgba(0,0,0,0.05))">
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
          <input type="range" id="music-seek-bar" min="0" max="100" value="0" oninput="MusicPlayer.seekPercent(this.value)" onmousedown="MusicPlayer._seeking=true" onmouseup="MusicPlayer._seeking=false" onchange="MusicPlayer._seeking=false" ontouchstart="MusicPlayer._seeking=true" ontouchend="MusicPlayer._seeking=false" aria-label="Seek" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" style="flex:1;accent-color:var(--primary);height:6px;touch-action:pan-x">
          <span id="music-duration" style="font-size:11px;color:var(--on-surface-variant);width:40px">0:00</span>
        </div>

        <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin:8px 0">
          <button id="music-shuffle-btn" onclick="MusicPlayer.toggleShuffle()" style="background:none;border:none;color:${Player.isShuffle?'var(--primary)':'var(--on-surface-variant)'};cursor:pointer;padding:8px">
            <span class="material-symbols-outlined" style="font-size:22px">shuffle</span>
          </button>
          <button onclick="MusicPlayer.prev()" style="background:none;border:none;color:var(--on-surface);cursor:pointer;padding:8px">
            <span class="material-symbols-outlined" style="font-size:32px">skip_previous</span>
          </button>
          <button class="music-play-btn" onclick="MusicPlayer.togglePlay()" style="background:var(--primary);border:none;color:var(--on-primary);width:64px;height:64px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(124,77,255,0.4)">
            <span class="material-symbols-outlined" style="font-size:36px">${Player.isPlaying ? 'pause' : 'play_arrow'}</span>
          </button>
          <button onclick="MusicPlayer.next()" style="background:none;border:none;color:var(--on-surface);cursor:pointer;padding:8px">
            <span class="material-symbols-outlined" style="font-size:32px">skip_next</span>
          </button>
          <button id="music-repeat-btn" onclick="MusicPlayer.cycleRepeat()" style="background:none;border:none;color:${Player.repeatMode!=='off'?'var(--primary)':'var(--on-surface-variant)'};cursor:pointer;padding:8px">
            <span class="material-symbols-outlined" style="font-size:22px">${Player.repeatMode==='one'?'repeat_one':'repeat'}</span>
          </button>
        </div>

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
          <button id="music-volume-icon" onclick="MusicPlayer.toggleMute()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:4px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">
            <span class="material-symbols-outlined" style="font-size:20px">${Player.isMuted?'volume_off':'volume_up'}</span>
          </button>
          <input type="range" id="music-volume" min="0" max="100" value="${Player.volume*100}" oninput="MusicPlayer.setVolume(this.value/100)" aria-label="Volume" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Player.volume*100)}" style="flex:1;accent-color:var(--primary);height:6px">
          <button onclick="(typeof toggleTrackFavorite==='function') && toggleTrackFavorite(Player._currentTrack)" style="background:none;border:none;color:${typeof isTrackFavorite==='function' && isTrackFavorite(track.url)?'var(--error)':'var(--on-surface-variant)'};cursor:pointer;padding:4px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">
            <span class="material-symbols-outlined" style="font-size:20px">${typeof isTrackFavorite==='function' && isTrackFavorite(track.url)?'favorite':'favorite_border'}</span>
          </button>
        </div>

        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px;flex-wrap:wrap">
          <button id="music-full-speed" onclick="MusicPlayer.cyclePlaybackSpeed()" style="background:var(--surface-container,rgba(0,0,0,0.06));border:none;border-radius:8px;padding:4px 10px;color:${Player.playbackSpeed!==1?'var(--primary)':'var(--on-surface-variant)'};cursor:pointer;font-size:11px;font-weight:700">${Player.playbackSpeed}x</button>
          <button id="music-crossfade-btn" onclick="MusicPlayer.cycleCrossfade()" style="background:var(--surface-container,rgba(0,0,0,0.06));border:none;border-radius:8px;padding:4px 10px;color:${Player.crossfadeDuration>0?'var(--primary)':'var(--on-surface-variant)'};cursor:pointer;font-size:11px;font-weight:700" title="${Player.crossfadeDuration?'Crossfade: '+Player.crossfadeDuration+'s':'Crossfade off'}">${Player.crossfadeDuration ? Player.crossfadeDuration+'s' : 'X-Fade'}</button>
          <button onclick="MusicPlayer.showSleepTimerMenu()" style="background:var(--surface-container,rgba(0,0,0,0.06));border:none;border-radius:8px;padding:4px 10px;color:${Player._sleepTimerEnd?'var(--primary)':'var(--on-surface-variant)'};cursor:pointer;font-size:11px;font-weight:700;display:flex;align-items:center;gap:4px" title="Sleep Timer">
            <span class="material-symbols-outlined" style="font-size:14px">bedtime</span>
            <span id="music-sleep-timer" style="display:none"></span>
            ${!Player._sleepTimerEnd ? 'Sleep' : ''}
          </button>
          <button onclick="MusicPlayer.showEqualizer()" style="background:var(--surface-container,rgba(0,0,0,0.06));border:none;border-radius:8px;padding:4px 10px;color:var(--on-surface-variant);cursor:pointer;font-size:11px;font-weight:700" title="Equalizer">
            <span class="material-symbols-outlined" style="font-size:14px">equalizer</span>
          </button>
          <button onclick="MusicPlayer.shareTrack()" style="background:var(--surface-container,rgba(0,0,0,0.06));border:none;border-radius:8px;padding:4px 10px;color:var(--on-surface-variant);cursor:pointer;font-size:11px;font-weight:700" title="Share">
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

  // â”€â”€â”€ QUEUE PANEL â”€â”€â”€
  window.openPlaylistQueue = function() {
    const existing = document.getElementById('playlist-queue-overlay');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'playlist-queue-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:500px;max-height:70vh;overflow:hidden;display:flex;flex-direction:column;color:var(--on-surface);overscroll-behavior:contain';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0;font-size:16px;font-weight:700">Queue (${Player.queue.length} tracks)</h3>
        <button onclick="document.getElementById('playlist-queue-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:18px">&times;</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="MusicPlayer.clearQueue()" style="padding:6px 12px;border-radius:8px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant);font-size:11px;font-weight:600;cursor:pointer">Clear All</button>
        <button onclick="MusicPlayer.toggleShuffle()" style="padding:6px 12px;border-radius:8px;border:none;background:${Player.isShuffle?'rgba(124,77,255,0.2)':'var(--surface-container,rgba(0,0,0,0.06))'};color:${Player.isShuffle?'var(--primary)':'var(--on-surface-variant)'};font-size:11px;font-weight:600;cursor:pointer">Shuffle</button>
      </div>
      <div id="music-queue-list" style="flex:1;overflow-y:auto"></div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    _updateQueueUI();
  };

  // â”€â”€â”€ SCREEN WAKE LOCK â”€â”€â”€
  let _wakeLockSentinel = null;
  Player._wakeLockActive = false;

  Player.toggleWakeLock = async function() {
    if (Player._wakeLockActive) {
      Player.releaseWakeLock();
      return;
    }
    try {
      if ('wakeLock' in navigator) {
        _wakeLockSentinel = await navigator.wakeLock.request('screen');
        Player._wakeLockActive = true;
        showToast('Screen will stay on', 'success');
        _updateWakeLockUI();
        _wakeLockSentinel.addEventListener('release', () => {
          Player._wakeLockActive = false;
          _updateWakeLockUI();
        });
      } else {
        showToast('Screen lock not supported on this device', 'error');
      }
    } catch(e) {
      if (window.__DEBUG__) console.warn('Wake lock failed:', e);
      showToast('Could not lock screen', 'error');
    }
  };

  Player.releaseWakeLock = function() {
    if (_wakeLockSentinel) {
      _wakeLockSentinel.release().catch(() => {});
      _wakeLockSentinel = null;
    }
    Player._wakeLockActive = false;
    _updateWakeLockUI();
  };

  function _updateWakeLockUI() {
    const icon = document.getElementById('music-lock-icon');
    if (icon) {
      icon.textContent = Player._wakeLockActive ? 'screen_lock_portrait' : 'lock_open';
      icon.style.color = Player._wakeLockActive ? 'var(--primary)' : 'var(--on-surface-variant)';
    }
  }

  // â”€â”€â”€ MINIMIZE PLAYER (Picture-in-Picture style) â”€â”€â”€
  Player.minimizePlayer = function() {
    const overlay = document.getElementById('full-player-overlay');
    if (overlay) overlay.remove();
    showToast('Player minimized to mini player', 'info');
    _showMiniPlayer();
    _updateMiniPlayer(Player._currentTrack);
  };

  // â”€â”€â”€ RESTORE â”€â”€â”€
  function _restoreSession() {
    try {
      const last = JSON.parse(localStorage.getItem('nsl_last_track') || 'null');
      if (last && last.url) {
        // Check if YouTube URL is stale (>4 hours old)
        const isYouTube = last.source === 'youtube' || (last.url && last.url.includes('googlevideo'));
        const isStale = isYouTube && last._savedTs && (Date.now() - last._savedTs > 4 * 60 * 60 * 1000);
        if (isStale) {
          // Re-fetch audio URL for expired YouTube tracks
          if (last.videoId && typeof getYouTubeAudioUrl === 'function') {
            showToast('Refreshing audio link...', 'info');
            getYouTubeAudioUrl(last.videoId).then(freshUrl => {
              if (freshUrl) {
                last.url = freshUrl;
                Player._currentTrack = last;
                Player.audio.src = freshUrl;
                if (last._savedPosition > 0) Player.audio.currentTime = last._savedPosition;
                _updateMiniPlayer(last);
              } else {
                showToast('Audio expired â€” search to play again', 'error');
              }
            });
            return;
          }
        }
        Player._currentTrack = last;
        Player.audio.src = last.url;
        if (last._savedPosition && last._savedPosition > 0) {
          Player.audio.currentTime = last._savedPosition;
        }
        _updateMiniPlayer(last);
      }
    } catch(_) {}
  }

  window.addEventListener('mouseup', function() { Player._seeking = false; });
  window.addEventListener('touchend', function() { Player._seeking = false; });
  window.addEventListener('touchcancel', function() { Player._seeking = false; });

  setInterval(() => {
    if (Player._currentTrack && Player.audio && Player.isPlaying) {
      try {
        const toSave = { ...Player._currentTrack, _savedPosition: Player.audio.currentTime || 0, _savedTs: Date.now() };
        localStorage.setItem('nsl_last_track', JSON.stringify(toSave));
      } catch(_) {}
    }
  }, 5000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { _init(); _restoreSession(); if (window.__DEBUG__) console.log('[MusicPlayer] Initialized via DOMContentLoaded'); });
  } else {
    _init();
    _restoreSession();
    if (window.__DEBUG__) console.log('[MusicPlayer] Initialized immediately. Player.play exists:', typeof Player.play);
  }
})();
