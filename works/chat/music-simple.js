// Simple Music Player — upload, search, play, mini player, screen lock
// Replaces music-player.js + music-library.js with one clean file
(function() {
  'use strict';

  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
  const _esc = (s) => window.escHtml ? window.escHtml(String(s ?? '')) : String(s ?? '');
  const _haptic = () => { try { navigator.vibrate?.(10); } catch(_) {} };
  const _fmt = (s) => window.formatTrackDuration ? window.formatTrackDuration(s) : '0:00';

  // ─── STATE ───
  const S = {
    audio: new Audio(),
    queue: [],
    idx: -1,
    track: null,
    playing: false,
    volume: parseFloat(localStorage.getItem('nsm_vol') || '1'),
    muted: false,
    speed: 1,
    shuffle: false,
    repeat: 'off',
    wakeLock: null,
    wakeActive: false,
    library: [],
  };
  S.audio.preload = 'auto';
  S.audio.crossOrigin = 'anonymous';
  S.audio.volume = S.volume;
  window.MusicPlayer = S;

  // ─── SEARCH SOURCES ───
  const INV = [
    'https://inv.nadeko.net','https://invidious.nerdvpn.de','https://invidious.jing.rocks',
    'https://vid.puffyan.us','https://yewtu.be','https://iv.ggtyler.dev',
    'https://invidious.privacyredirect.com','https://invidious.perennialte.ch',
    'https://yt.artemislena.eu','https://invidious.fdn.fr','https://inv.tux.pizza',
    'https://invidious.protokolla.fi','https://invidious.lunar.icu',
  ];
  const PIP = [
    'https://pipedapi.kavin.rocks','https://api.piped.projectsegfau.lt',
    'https://pipedapi.adminforge.de','https://pipedapi.r4fo.com',
    'https://pipedapi.leptons.xyz','https://pipedapi.moomoo.me',
    'https://pipedapi.tokhmi.xyz','https://pipedapi.mint.lgbt',
    'https://pipedapi.drgns.space','https://api.piped.yt',
    'https://pipedapi.in.projectsegfau.lt','https://watchapi.whatever.social',
  ];
  let _wInv = null, _wPip = null;

  async function _fetch(instances, path, timeout) {
    const list = _wInv ? [_wInv, ...instances.filter(i => i !== _wInv)] : instances;
    for (const base of list) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), timeout || 8000);
        const r = await fetch(base + path, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!r.ok) continue;
        const d = await r.json();
        if (!d || (Array.isArray(d) && !d.length)) continue;
        if (d.error) continue;
        if (instances === INV) _wInv = base; else _wPip = base;
        return d;
      } catch(_) { continue; }
    }
    return null;
  }

  async function searchYouTube(q) {
    if (!q || q.length < 2) return [];

    // Source 1: Invidious
    let r = await _fetch(INV, '/api/v1/search?q=' + encodeURIComponent(q) + '&type=video', 10000);
    if (r && Array.isArray(r)) {
      const results = r.filter(v => v?.videoId).slice(0, 30).map(v => ({
        id: 'yt_' + v.videoId, videoId: v.videoId,
        title: v.title || 'Untitled', artist: v.author || 'Unknown',
        duration: v.lengthSeconds || 0,
        thumbnail: (v.videoThumbnails?.find(t => t.quality === 'medium') || v.videoThumbnails?.[0] || {}).url || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
        viewCount: v.viewCount || 0, publishedText: v.publishedText || '',
      }));
      if (results.length) return results;
    }

    // Source 2: Piped
    r = await _fetch(PIP, '/search?q=' + encodeURIComponent(q) + '&filter=music_songs', 10000);
    if (r?.items) {
      const results = r.items.filter(v => v?.url).slice(0, 30).map(v => {
        const vid = (v.url || '').replace('/watch?v=', '');
        return {
          id: 'yt_' + vid, videoId: vid,
          title: v.title || 'Untitled', artist: v.uploaderName || 'Unknown',
          duration: v.duration || 0,
          thumbnail: v.thumbnailUrl || `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
          viewCount: v.views || 0, publishedText: v.uploadedDate || '',
        };
      });
      if (results.length) return results;
    }

    // Source 3: Jamendo (CC music)
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 10000);
      const url = `https://api.jamendo.com/v3.0/tracks/?client_id=b2301a74&search=${encodeURIComponent(q)}&format=json&limit=30&audioformat=mp32`;
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      const data = await res.json();
      if (data?.results?.length) {
        return data.results.filter(t => t?.audio).map(t => ({
          id: 'jam_' + t.id, videoId: null,
          title: t.name || 'Untitled', artist: t.artist_name || 'Unknown',
          duration: t.duration || 0, thumbnail: t.album_image || t.image || null,
          audioUrl: t.audio, source: 'jamendo',
        }));
      }
    } catch(_) {}

    return [];
  }

  async function _getAudioUrl(videoId) {
    if (!videoId) return null;
    // Try cache
    try {
      const cache = JSON.parse(localStorage.getItem('nsm_aurl') || '{}');
      if (cache[videoId] && (Date.now() - cache[videoId].ts < 4 * 3600000)) return cache[videoId].url;
    } catch(_) {}
    // Invidious
    const inv = await _fetch(INV, '/api/v1/videos/' + videoId + '?fields=adaptiveFormats', 12000);
    if (inv?.adaptiveFormats) {
      const a = inv.adaptiveFormats.filter(f => f.type?.startsWith('audio/')).sort((a, b) => (b.audioBitrate || b.bitrate || 0) - (a.audioBitrate || a.bitrate || 0));
      if (a[0]?.url) { _cacheUrl(videoId, a[0].url); return a[0].url; }
    }
    // Piped
    const pip = await _fetch(PIP, '/streams/' + videoId, 12000);
    if (pip?.audioStreams) {
      const a = pip.audioStreams.filter(s => s.mimeType?.startsWith('audio/')).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      if (a[0]?.url) { _cacheUrl(videoId, a[0].url); return a[0].url; }
    }
    return null;
  }

  function _cacheUrl(vid, url) {
    try {
      const c = JSON.parse(localStorage.getItem('nsm_aurl') || '{}');
      c[vid] = { url, ts: Date.now() };
      const keys = Object.keys(c);
      if (keys.length > 40) { keys.sort((a, b) => (c[a].ts || 0) - (c[b].ts || 0)); keys.slice(0, keys.length - 40).forEach(k => delete c[k]); }
      localStorage.setItem('nsm_aurl', JSON.stringify(c));
    } catch(_) {}
  }

  // ─── PLAYBACK ───
  S.play = function(track) {
    _haptic();
    if (!track?.url) { showToast('No audio', 'error'); return; }
    S.audio.src = track.url;
    S.audio.load();
    S.audio.play().catch(() => {});
    S.track = track;
    S.playing = true;
    _addRecent(track);
    _updateMediaSession(track);
    _showMini();
    _updateMini(track);
    _showFullIfOpen();
  };

  S.togglePlay = function() {
    _haptic();
    if (S.playing) S.audio.pause();
    else if (S.track) S.audio.play().catch(() => {});
    else if (S.queue.length) S.playTrack(0);
  };

  S.next = function() {
    _haptic();
    if (!S.queue.length) return;
    if (S.repeat === 'one') { S.audio.currentTime = 0; S.audio.play().catch(() => {}); return; }
    let n = S.idx + 1;
    if (n >= S.queue.length) { if (S.repeat === 'all') n = 0; else { S.audio.pause(); return; } }
    S.playTrack(n);
  };

  S.prev = function() {
    _haptic();
    if (!S.queue.length) return;
    if (S.audio.currentTime > 3) { S.audio.currentTime = 0; return; }
    let p = S.idx - 1;
    if (p < 0) p = S.repeat === 'all' ? S.queue.length - 1 : 0;
    S.playTrack(p);
  };

  S.playTrack = function(i) {
    if (i < 0 || i >= S.queue.length) return;
    S.idx = i;
    S.play(S.queue[i]);
  };

  S.setQueue = function(tracks, startIdx) {
    S.queue = [...tracks];
    S.idx = startIdx || 0;
    if (S.queue[S.idx]) S.play(S.queue[S.idx]);
  };

  S.addToQueue = function(track) {
    S.queue.push(track);
    _haptic();
    showToast(`Added "${track.title}"`, 'success');
  };

  S.setVolume = function(v) {
    S.volume = Math.max(0, Math.min(1, v));
    S.muted = false;
    S.audio.volume = S.volume;
    localStorage.setItem('nsm_vol', String(S.volume));
  };

  S.toggleMute = function() {
    S.muted = !S.muted;
    S.audio.volume = S.muted ? 0 : S.volume;
  };

  S.seek = function(t) { if (S.audio) S.audio.currentTime = t; };
  S.seekPercent = function(p) { if (S.audio && S.audio.duration) S.audio.currentTime = (p / 100) * S.audio.duration; };

  S.cycleRepeat = function() {
    const m = ['off', 'all', 'one'];
    S.repeat = m[(m.indexOf(S.repeat) + 1) % 3];
    localStorage.setItem('nsm_repeat', S.repeat);
    _updateFullUI();
  };

  S.toggleShuffle = function() {
    S.shuffle = !S.shuffle;
    if (S.shuffle) {
      const cur = S.queue[S.idx];
      const rest = S.queue.filter((_, i) => i !== S.idx);
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      S.queue = [cur, ...rest];
      S.idx = 0;
    } else {
      const cur = S.queue[S.idx];
      // restore original order if available
    }
    _updateFullUI();
  };

  S.stop = function() {
    S.audio.pause();
    S.audio.src = '';
    S.playing = false;
    S.track = null;
    S.idx = -1;
    _hideMini();
    _releaseWakeLock();
  };

  // ─── EVENTS ───
  S.audio.addEventListener('play', () => {
    S.playing = true;
    _updatePlayBtns();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  });
  S.audio.addEventListener('pause', () => {
    S.playing = false;
    _updatePlayBtns();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  });
  S.audio.addEventListener('ended', () => S.next());
  S.audio.addEventListener('timeupdate', () => {
    if (S._seeking) return;
    _updateSeek();
    _updateMiniProgress();
  });
  S.audio.addEventListener('loadedmetadata', () => _updateFullUI());
  S.audio.addEventListener('error', () => {
    if (S.track?.videoId && S.audio.error?.code >= 2) {
      // Retry with fresh audio URL
      _getAudioUrl(S.track.videoId).then(url => {
        if (url) { S.audio.src = url; S.audio.play().catch(() => {}); }
        else { showToast('Audio unavailable', 'error'); S.next(); }
      });
    }
  });

  // ─── MEDIA SESSION ───
  function _setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => S.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => S.togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => S.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => S.next());
    navigator.mediaSession.setActionHandler('seekto', (e) => { if (e.seekTime != null) S.seek(e.seekTime); });
  }
  function _updateMediaSession(t) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title || 'Unknown', artist: t.artist || 'Unknown', album: 'NSL Music',
      artwork: t.thumbnail ? [{ src: t.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
  }

  // ─── WAKE LOCK ───
  S.toggleWakeLock = async function() {
    if (S.wakeActive) { _releaseWakeLock(); return; }
    try {
      if ('wakeLock' in navigator) {
        S.wakeLock = await navigator.wakeLock.request('screen');
        S.wakeActive = true;
        showToast('Screen will stay on', 'success');
        S.wakeLock.addEventListener('release', () => { S.wakeActive = false; _updateLockIcon(); });
        _updateLockIcon();
      } else {
        showToast('Not supported on this device', 'error');
      }
    } catch(_) { showToast('Could not lock screen', 'error'); }
  };
  function _releaseWakeLock() {
    S.wakeLock?.release?.().catch(() => {});
    S.wakeLock = null;
    S.wakeActive = false;
    _updateLockIcon();
  }
  function _updateLockIcon() {
    const el = document.getElementById('nsm-lock-icon');
    if (el) {
      el.textContent = S.wakeActive ? 'screen_lock_portrait' : 'lock_open';
      el.style.color = S.wakeActive ? 'var(--primary)' : 'var(--on-surface-variant)';
    }
  }

  // ─── MINI PLAYER (floating, draggable) ───
  const _MKEY = 'nsm_mini_pos';
  let _dragging = false, _dragSX = 0, _dragSY = 0, _dragL = 0, _dragT = 0, _dragMoved = false;

  function _showMini() {
    if (document.getElementById('nsm-mini')) return;
    const el = document.createElement('div');
    el.id = 'nsm-mini';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Music mini player');
    let pos;
    try { pos = JSON.parse(localStorage.getItem(_MKEY)); } catch(_) {}
    if (!pos || typeof pos.left !== 'number' || typeof pos.top !== 'number') {
      pos = { left: window.innerWidth - 224, top: window.innerHeight - 90 };
    }
    pos.left = Math.max(8, Math.min(pos.left, window.innerWidth - 216));
    pos.top = Math.max(8, Math.min(pos.top, window.innerHeight - 80));
    el.style.cssText = `position:fixed;left:${pos.left}px;top:${pos.top}px;z-index:95;width:208px;background:var(--surface-container-high,#1e2a34);border-radius:14px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));box-shadow:0 6px 24px rgba(0,0,0,0.4);padding:8px 10px;display:flex;align-items:center;gap:8px;cursor:grab;animation:fadeIn 0.2s ease;touch-action:none;user-select:none;-webkit-user-select:none;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)`;
    el.onclick = (e) => { if (_dragMoved) return; if (e.target.closest('button')) return; openFullPlayer(); };
    document.body.appendChild(el);

    function onStart(ex, ey) {
      _dragging = true; _dragMoved = false;
      _dragSX = ex; _dragSY = ey;
      const r = el.getBoundingClientRect(); _dragL = r.left; _dragT = r.top;
      el.style.cursor = 'grabbing'; el.style.transition = 'none';
    }
    function onMove(ex, ey) {
      if (!_dragging) return;
      const dx = ex - _dragSX, dy = ey - _dragSY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _dragMoved = true;
      el.style.left = Math.max(0, Math.min(_dragL + dx, window.innerWidth - 216)) + 'px';
      el.style.top = Math.max(0, Math.min(_dragT + dy, window.innerHeight - 80)) + 'px';
    }
    function onEnd() {
      if (!_dragging) return; _dragging = false;
      el.style.cursor = 'grab'; el.style.transition = '';
      const r = el.getBoundingClientRect();
      localStorage.setItem(_MKEY, JSON.stringify({ left: r.left, top: r.top }));
      setTimeout(() => { _dragMoved = false; }, 50);
    }
    el.addEventListener('touchstart', e => { if (!e.target.closest('button')) onStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    el.addEventListener('touchmove', e => { if (_dragging) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      e.preventDefault(); onStart(e.clientX, e.clientY);
      const mm = ev => onMove(ev.clientX, ev.clientY);
      const mu = () => { onEnd(); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
      document.addEventListener('mousemove', mm);
      document.addEventListener('mouseup', mu);
    });
  }

  function _hideMini() { document.getElementById('nsm-mini')?.remove(); }

  function _updateMini(t) {
    if (!t) return;
    _showMini();
    const el = document.getElementById('nsm-mini');
    if (!el) return;
    el.innerHTML = `
      <div style="width:38px;height:38px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--surface-container-low,rgba(0,0,0,0.05))">
        ${t.thumbnail ? `<img src="${_esc(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">music_note</span></div>'}
      </div>
      <div style="flex:1;min-width:0;pointer-events:none">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--on-surface)">${_esc(t.title)}</div>
        <div style="font-size:10px;color:var(--on-surface-variant);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(t.artist)}</div>
      </div>
      <button class="nsm-play" onclick="event.stopPropagation();event.preventDefault();MusicPlayer.togglePlay()" style="background:none;border:none;color:var(--on-surface);cursor:pointer;padding:2px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">
        <span class="material-symbols-outlined" style="font-size:26px">${S.playing ? 'pause_circle' : 'play_circle'}</span>
      </button>
      <button onclick="event.stopPropagation();event.preventDefault();MusicPlayer.next()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:2px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">
        <span class="material-symbols-outlined" style="font-size:18px">skip_next</span>
      </button>
      <div style="position:absolute;bottom:0;left:8px;right:8px;height:2px;background:var(--outline-variant,rgba(0,0,0,0.08));border-radius:1px">
        <div id="nsm-mini-progress" style="height:100%;background:var(--primary);transition:width 0.3s;width:0%;border-radius:1px"></div>
      </div>`;
  }

  function _updateMiniProgress() {
    const bar = document.getElementById('nsm-mini-progress');
    if (bar && S.audio.duration) bar.style.width = ((S.audio.currentTime / S.audio.duration) * 100) + '%';
  }

  function _updatePlayBtns() {
    $$('.nsm-play .material-symbols-outlined').forEach(el => {
      el.textContent = S.playing ? 'pause' : 'play_arrow';
    });
    // Also update mini player icon
    const mini = document.getElementById('nsm-mini');
    if (mini) {
      const icon = mini.querySelector('.nsm-play .material-symbols-outlined');
      if (icon) icon.textContent = S.playing ? 'pause_circle' : 'play_circle';
    }
  }

  // ─── FULL PLAYER ───
  window.openFullPlayer = function() {
    const t = S.track;
    if (!t) { showToast('No track playing', 'info'); return; }
    const existing = document.getElementById('nsm-full');
    if (existing) existing.remove();

    const ov = document.createElement('div');
    ov.id = 'nsm-full';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Music player');
    ov.setAttribute('aria-modal', 'true');
    ov.style.cssText = 'position:fixed;inset:0;z-index:9998;background:var(--surface-container,#0d1b2a);display:flex;flex-direction:column;animation:slideUp 0.3s ease;touch-action:manipulation;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px) 0';
    ov.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px">
        <button onclick="document.getElementById('nsm-full')?.remove()" style="background:none;border:none;color:var(--on-surface);cursor:pointer">
          <span class="material-symbols-outlined">keyboard_arrow_down</span>
        </button>
        <div style="font-size:11px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:1px">Now Playing</div>
        <div style="display:flex;align-items:center;gap:4px">
          <button onclick="MusicPlayer.toggleWakeLock()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:8px" title="Keep screen on">
            <span class="material-symbols-outlined" id="nsm-lock-icon">${S.wakeActive ? 'screen_lock_portrait' : 'lock_open'}</span>
          </button>
          <button onclick="MusicPlayer.minimizePlayer()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:8px" title="Minimize">
            <span class="material-symbols-outlined">picture_in_picture_alt</span>
          </button>
        </div>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 32px">
        <div style="width:min(280px,65vw);height:min(280px,65vw);max-height:50vh;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.5);margin-bottom:32px;background:var(--surface-container-low,rgba(0,0,0,0.05))">
          ${t.thumbnail ? `<img class="nsm-thumb" src="${_esc(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover">` : '<div class="nsm-thumb" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:80px;color:var(--primary);opacity:0.4">music_note</span></div>'}
        </div>
        <div style="text-align:center;width:100%">
          <div class="nsm-title" style="font-size:20px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(t.title)}</div>
          <div class="nsm-artist" style="font-size:14px;color:var(--on-surface-variant);margin-top:4px">${_esc(t.artist)}</div>
        </div>
      </div>

      <div style="padding:0 24px 8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span id="nsm-cur" style="font-size:11px;color:var(--on-surface-variant);width:40px;text-align:right">0:00</span>
          <input type="range" id="nsm-seek" min="0" max="100" value="0" oninput="MusicPlayer.seekPercent(this.value)" onmousedown="MusicPlayer._seeking=true" onmouseup="MusicPlayer._seeking=false" onchange="MusicPlayer._seeking=false" ontouchstart="MusicPlayer._seeking=true" ontouchend="MusicPlayer._seeking=false" style="flex:1;accent-color:var(--primary);height:4px;touch-action:pan-x" aria-label="Seek">
          <span id="nsm-dur" style="font-size:11px;color:var(--on-surface-variant);width:40px">0:00</span>
        </div>

        <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin:8px 0">
          <button onclick="MusicPlayer.toggleShuffle()" style="background:none;border:none;color:${S.shuffle?'var(--primary)':'var(--on-surface-variant)'};cursor:pointer;padding:8px">
            <span class="material-symbols-outlined" style="font-size:22px">shuffle</span>
          </button>
          <button onclick="MusicPlayer.prev()" style="background:none;border:none;color:var(--on-surface);cursor:pointer;padding:8px">
            <span class="material-symbols-outlined" style="font-size:32px">skip_previous</span>
          </button>
          <button class="nsm-play" onclick="MusicPlayer.togglePlay()" style="background:var(--primary);border:none;color:var(--on-primary);width:64px;height:64px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(124,77,255,0.4)">
            <span class="material-symbols-outlined" style="font-size:36px">${S.playing ? 'pause' : 'play_arrow'}</span>
          </button>
          <button onclick="MusicPlayer.next()" style="background:none;border:none;color:var(--on-surface);cursor:pointer;padding:8px">
            <span class="material-symbols-outlined" style="font-size:32px">skip_next</span>
          </button>
          <button onclick="MusicPlayer.cycleRepeat()" style="background:none;border:none;color:${S.repeat!=='off'?'var(--primary)':'var(--on-surface-variant)'};cursor:pointer;padding:8px">
            <span class="material-symbols-outlined" style="font-size:22px">${S.repeat==='one'?'repeat_one':'repeat'}</span>
          </button>
        </div>

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <button onclick="MusicPlayer.toggleMute()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:4px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">
            <span class="material-symbols-outlined" style="font-size:20px">${S.muted?'volume_off':'volume_up'}</span>
          </button>
          <input type="range" id="nsm-vol" min="0" max="100" value="${S.volume*100}" oninput="MusicPlayer.setVolume(this.value/100)" style="flex:1;accent-color:var(--primary);height:3px" aria-label="Volume">
        </div>
      </div>`;

    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    const escHandler = e => { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
    document.body.appendChild(ov);
    _updateSeek();
  };

  function _showFullIfOpen() {
    const el = document.getElementById('nsm-full');
    if (!el || !S.track) return;
    const title = el.querySelector('.nsm-title');
    const artist = el.querySelector('.nsm-artist');
    const thumb = el.querySelector('.nsm-thumb');
    if (title) title.textContent = S.track.title;
    if (artist) artist.textContent = S.track.artist;
    if (thumb && S.track.thumbnail) { thumb.src = S.track.thumbnail; thumb.style.display = ''; }
  }

  S.minimizePlayer = function() {
    document.getElementById('nsm-full')?.remove();
    _showMini();
    _updateMini(S.track);
  };

  function _updateSeek() {
    const bar = document.getElementById('nsm-seek');
    const cur = document.getElementById('nsm-cur');
    const dur = document.getElementById('nsm-dur');
    if (bar && S.audio.duration) bar.value = (S.audio.currentTime / S.audio.duration) * 100;
    if (cur) cur.textContent = _fmt(S.audio.currentTime);
    if (dur) dur.textContent = _fmt(S.audio.duration);
  }

  function _updateFullUI() {
    _updateSeek();
    _updatePlayBtns();
  }

  // ─── ONBOARDING (only shown when music player first opened) ───
  function _showOnboarding() {
    if (document.getElementById('nsm-onboard')) return;
    const ov = document.createElement('div');
    ov.id = 'nsm-onboard';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease';
    ov.innerHTML = `<div style="background:var(--surface-container,#1e1e2e);border-radius:24px;padding:32px;max-width:340px;width:85vw;text-align:center;color:var(--on-surface)">
      <div style="width:72px;height:72px;border-radius:50%;background:rgba(124,77,255,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
        <span class="material-symbols-outlined" style="font-size:32px;color:var(--primary)">music_note</span>
      </div>
      <h2 style="margin:0 0 8px;font-size:18px;font-weight:700">Music Player</h2>
      <p style="margin:0 0 20px;font-size:13px;color:var(--on-surface-variant);line-height:1.5">Search any song, upload your music, and listen while you chat. Music plays in a floating mini player!</p>
      <button onclick="document.getElementById('nsm-onboard')?.remove();document.getElementById('nsm-lib')?.remove()" style="width:100%;padding:12px;border-radius:12px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Got it!</button>
    </div>`;
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  // ─── MUSIC LIBRARY OVERLAY ───
  window.openMusicLibrary = function() {
    const existing = document.getElementById('nsm-lib');
    if (existing) { existing.remove(); return; }

    // Show onboarding only on first open
    if (!localStorage.getItem('nsm_onboarded')) {
      localStorage.setItem('nsm_onboarded', '1');
      _showOnboarding();
    }

    const ov = document.createElement('div');
    ov.id = 'nsm-lib';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Music Library');
    ov.style.cssText = 'position:fixed !important;inset:0 !important;z-index:9999 !important;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex !important;align-items:flex-end;justify-content:center;transition:all 0.3s ease;';

    const panel = document.createElement('div');
    panel.className = 'music-lib-panel';
    panel.style.cssText = 'background:var(--surface-container,#1a1b2e);border-radius:20px 20px 0 0;width:100%;max-width:600px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;color:var(--on-surface);animation:slideUp 0.25s ease';
    panel.innerHTML = `
      <div style="padding:16px 16px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h2 style="margin:0;font-size:18px;font-weight:700">Music</h2>
          <button onclick="document.getElementById('nsm-lib')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">&times;</button>
        </div>
        <div id="nsm-tabs" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none">
          <button class="nsm-tab active" onclick="window._nsmTab('my')" style="min-height:36px;flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:var(--primary);color:var(--on-primary)">My Music</button>
          <button class="nsm-tab" onclick="window._nsmTab('upload')" style="min-height:36px;flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant)">Upload</button>
          <button class="nsm-tab" onclick="window._nsmTab('search')" style="min-height:36px;flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant)">Search</button>
        </div>
      </div>
      <div id="nsm-content" style="flex:1;overflow-y:auto;padding:12px 16px 24px"></div>`;

    ov.appendChild(panel);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);

    const escH = e => { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', escH); } };
    document.addEventListener('keydown', escH);

    window._nsmTab('my');
  };

  // Tab switching
  window._nsmTab = function(tab) {
    $$('.nsm-tab').forEach(b => {
      b.style.background = 'var(--surface-container,rgba(0,0,0,0.06))';
      b.style.color = 'var(--on-surface-variant)';
      b.classList.remove('active');
    });
    const active = $(`.nsm-tab[onclick*="'${tab}'"]`);
    if (active) { active.style.background = 'var(--primary)'; active.style.color = 'var(--on-primary)'; active.classList.add('active'); }
    const c = document.getElementById('nsm-content');
    if (!c) return;
    if (tab === 'my') _renderMyMusic(c);
    else if (tab === 'upload') _renderUpload(c);
    else if (tab === 'search') _renderSearch(c);
  };

  // ─── MY MUSIC TAB ───
  async function _renderMyMusic(el) {
    await _loadLibrary();
    const tracks = S.library;
    if (!tracks.length) {
      el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--on-surface-variant)">
        <span class="material-symbols-outlined" style="font-size:48px;opacity:0.3">library_music</span>
        <p style="font-size:14px;font-weight:600;margin:12px 0 4px">Your library is empty</p>
        <p style="font-size:12px;margin:0 0 16px">Upload songs or search online</p>
        <button onclick="window._nsmTab('upload')" style="padding:10px 24px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Upload Music</button>
      </div>`;
      return;
    }

    el.innerHTML = `
      <input type="search" placeholder="Search my music..." oninput="window._nsmFilterLib(this.value)" style="width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);font-size:13px;outline:none;margin-bottom:12px;box-sizing:border-box">
      <div id="nsm-lib-list">${tracks.map((t, i) => _libRow(t, i)).join('')}</div>`;
  }

  window._nsmFilterLib = function(q) {
    const lower = q.toLowerCase();
    const filtered = S.library.filter(t => t.title.toLowerCase().includes(lower) || t.artist.toLowerCase().includes(lower));
    const list = document.getElementById('nsm-lib-list');
    if (list) list.innerHTML = filtered.map((t, i) => _libRow(t, i)).join('');
  };

  function _libRow(t) {
    const isPlaying = S.track?.id === t.id;
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:${isPlaying ? 'rgba(124,77,255,0.1)' : 'var(--surface-container-low,rgba(0,0,0,0.03))'};margin-bottom:6px;cursor:pointer" onclick="window._nsmPlayLib('${t.id}')">
      <div style="width:42px;height:42px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--surface-container-low,rgba(0,0,0,0.05));display:flex;align-items:center;justify-content:center">
        ${t.thumbnail ? `<img src="${_esc(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover">` : '<span class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">music_note</span>'}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(t.title)}</div>
        <div style="font-size:11px;color:var(--on-surface-variant);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(t.artist)}</div>
      </div>
      <button onclick="event.stopPropagation();window._nsmDeleteLib('${t.id}')" style="background:none;border:none;cursor:pointer;padding:8px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;color:var(--on-surface-variant)" title="Delete">
        <span class="material-symbols-outlined" style="font-size:18px">delete</span>
      </button>
    </div>`;
  }

  window._nsmPlayLib = function(id) {
    const t = S.library.find(x => x.id === id);
    if (!t?.url) { showToast('No audio', 'error'); return; }
    const idx = S.library.indexOf(t);
    S.setQueue(S.library.filter(x => x.url), idx);
  };

  window._nsmDeleteLib = async function(id) {
    if (!App.db || !App.auth?.currentUser) return;
    try {
      await App.db.collection('musicLibrary').doc(id).delete();
      S.library = S.library.filter(t => t.id !== id);
      showToast('Deleted', 'success');
      const list = document.getElementById('nsm-lib-list');
      if (list) list.innerHTML = S.library.map((t, i) => _libRow(t, i)).join('');
    } catch(_) { showToast('Delete failed', 'error'); }
  };

  async function _loadLibrary() {
    if (!App.db || !App.auth?.currentUser) return;
    try {
      const snap = await App.db.collection('musicLibrary').where('addedBy', '==', App.auth.currentUser.uid).orderBy('addedAt', 'desc').get();
      S.library = snap.docs.map(d => d.data());
    } catch(_) { S.library = []; }
  }

  // ─── UPLOAD TAB ───
  function _renderUpload(el) {
    el.innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div id="nsm-dropzone" style="border:2px dashed var(--outline-variant,rgba(0,0,0,0.15));border-radius:16px;padding:32px 20px;margin-bottom:16px;cursor:pointer;transition:all 0.2s" onclick="document.getElementById('nsm-fileinput').click()" ondragover="event.preventDefault();this.style.borderColor='var(--primary)'" ondrop="event.preventDefault();this.style.borderColor='var(--outline-variant,rgba(0,0,0,0.15))';window._nsmHandleFiles(event.dataTransfer.files)">
          <span class="material-symbols-outlined" style="font-size:40px;color:var(--on-surface-variant);opacity:0.4">upload_file</span>
          <p style="font-size:13px;font-weight:600;color:var(--on-surface);margin:8px 0 4px">Tap to select audio files</p>
          <p style="font-size:11px;color:var(--on-surface-variant);margin:0">MP3, WAV, OGG, M4A — up to 50MB</p>
          <input type="file" id="nsm-fileinput" accept="audio/*" multiple style="display:none" onchange="window._nsmHandleFiles(this.files)">
        </div>
        <div id="nsm-upload-progress" style="display:none;margin-bottom:16px">
          <div style="height:4px;background:var(--surface-container,rgba(0,0,0,0.1));border-radius:2px;overflow:hidden">
            <div id="nsm-upload-bar" style="height:100%;background:var(--primary);width:0%;transition:width 0.3s"></div>
          </div>
          <p id="nsm-upload-text" style="font-size:11px;color:var(--on-surface-variant);margin-top:4px">Uploading...</p>
        </div>
        <div id="nsm-upload-form" style="display:none;text-align:left">
          <div style="margin-bottom:12px">
            <label style="font-size:11px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">TITLE</label>
            <input id="nsm-up-title" type="text" placeholder="Song title" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);font-size:13px;box-sizing:border-box">
          </div>
          <div style="margin-bottom:12px">
            <label style="font-size:11px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">ARTIST</label>
            <input id="nsm-up-artist" type="text" placeholder="Artist name" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);font-size:13px;box-sizing:border-box">
          </div>
          <button onclick="window._nsmSubmitUpload()" style="width:100%;padding:12px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Upload to Library</button>
        </div>
      </div>`;
  }

  let _pendingFile = null;

  window._nsmHandleFiles = function(files) {
    if (!files?.length) return;
    if (files.length === 1) { _prepUpload(files[0]); return; }
    // Batch upload
    const audio = Array.from(files).filter(f => f.type.startsWith('audio/'));
    if (!audio.length) { showToast('No audio files', 'error'); return; }
    showToast(`Uploading ${audio.length} files...`, 'info');
    const prog = document.getElementById('nsm-upload-progress');
    if (prog) prog.style.display = 'block';
    let done = 0;
    async function next() {
      if (done >= audio.length) { showToast('All uploaded!', 'success'); window._nsmTab('my'); return; }
      const bar = document.getElementById('nsm-upload-bar');
      if (bar) bar.style.width = Math.round((done / audio.length) * 100) + '%';
      await _doUpload(audio[done], audio[done].name.replace(/\.[^.]+$/, ''), 'Unknown');
      done++;
      next();
    }
    next();
  };

  function _prepUpload(file) {
    if (!file.type.startsWith('audio/')) { showToast('Select an audio file', 'error'); return; }
    _pendingFile = file;
    const name = file.name.replace(/\.[^.]+$/, '');
    const title = document.getElementById('nsm-up-title');
    const form = document.getElementById('nsm-upload-form');
    const dz = document.getElementById('nsm-dropzone');
    if (title) title.value = name;
    if (form) form.style.display = 'block';
    if (dz) {
      dz.innerHTML = `<span class="material-symbols-outlined" style="font-size:32px;color:var(--primary)">audio_file</span><p style="font-size:12px;font-weight:600;color:var(--primary);margin:4px 0">${_esc(file.name)}</p><p style="font-size:10px;color:var(--on-surface-variant)">${(file.size / (1024*1024)).toFixed(1)} MB</p>`;
      dz.onclick = null;
    }
  }

  window._nsmSubmitUpload = async function() {
    if (!_pendingFile) { showToast('No file selected', 'error'); return; }
    const title = document.getElementById('nsm-up-title')?.value || _pendingFile.name.replace(/\.[^.]+$/, '');
    const artist = document.getElementById('nsm-up-artist')?.value || 'Unknown';
    const prog = document.getElementById('nsm-upload-progress');
    if (prog) prog.style.display = 'block';
    await _doUpload(_pendingFile, title, artist);
    _pendingFile = null;
    window._nsmTab('my');
  };

  async function _doUpload(file, title, artist) {
    if (!App.auth?.currentUser || !App.db) { showToast('Sign in required', 'error'); return; }
    if (file.size > 50 * 1024 * 1024) { showToast('Max 50MB', 'error'); return; }
    const uid = App.auth.currentUser.uid;
    const path = `music/${uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    try {
      const ref = App.storage.ref(path);
      const task = ref.put(file);
      task.on('state_changed',
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          const bar = document.getElementById('nsm-upload-bar');
          const txt = document.getElementById('nsm-upload-text');
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = `Uploading... ${pct}%`;
        },
        (err) => {
          showToast('Upload failed: ' + (err.message || 'Unknown'), 'error');
          const prog = document.getElementById('nsm-upload-progress');
          if (prog) prog.style.display = 'none';
        }
      );
      await task;
      const url = await ref.getDownloadURL();
      const track = {
        id: 'mt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
        title, artist, url, thumbnail: null, duration: 0,
        source: 'upload', addedBy: uid, addedByName: App.auth.currentUser.displayName || 'User',
        addedAt: Date.now(),
      };
      await App.db.collection('musicLibrary').doc(track.id).set(track);
      S.library.unshift(track);
      showToast('Uploaded: ' + title, 'success');
    } catch(e) { showToast('Upload failed', 'error'); }
  }

  // ─── SEARCH TAB ───
  function _renderSearch(el) {
    el.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input type="search" id="nsm-search-input" placeholder="Search any song..." style="flex:1;min-width:0;padding:10px 14px;border-radius:12px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);font-size:13px;outline:none" onkeydown="if(event.key==='Enter')window._nsmDoSearch()">
        <button onclick="window._nsmDoSearch()" style="min-height:44px;flex-shrink:0;padding:10px 18px;border-radius:12px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:700;cursor:pointer">Search</button>
      </div>
      <div id="nsm-search-results"></div>
      <div style="margin-top:16px">
        <div style="font-size:11px;font-weight:700;color:var(--on-surface-variant);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">Quick Browse</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${['Malayalam songs','Hindi songs','Tamil songs','Telugu songs','English songs','Old Bollywood','New releases 2025','Malayalam old hits','Hindi romantic','Tamil rock'].map(q =>
            `<button onclick="document.getElementById('nsm-search-input').value='${q}';window._nsmDoSearch()" style="padding:6px 12px;border-radius:20px;border:1px solid var(--outline-variant,rgba(0,0,0,0.08));background:var(--surface-container-low,rgba(0,0,0,0.03));color:var(--on-surface-variant);font-size:11px;cursor:pointer;transition:all 0.2s">${q}</button>`
          ).join('')}
        </div>
      </div>`;
  }

  window._nsmDoSearch = async function() {
    const q = document.getElementById('nsm-search-input')?.value;
    if (!q || q.length < 2) return;
    const el = document.getElementById('nsm-search-results');
    if (!el) return;
    el.innerHTML = `<div style="text-align:center;padding:20px">
      <span class="material-symbols-outlined animate-spin" style="color:var(--primary);font-size:24px">progress_activity</span>
      <p style="color:var(--on-surface-variant);font-size:11px;margin-top:8px">Searching for "${_esc(q)}"...</p>
    </div>`;
    const results = await searchYouTube(q);
    if (!results.length) {
      el.innerHTML = '<p style="text-align:center;font-size:12px;color:var(--on-surface-variant);padding:16px">No results found</p>';
      return;
    }
    el.innerHTML = results.map((t, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;background:var(--surface-container-low,rgba(0,0,0,0.03));margin-bottom:4px;cursor:pointer" onclick="window._nsmPlaySearch(${i})">
        <div style="width:48px;height:36px;border-radius:6px;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
          ${t.thumbnail ? `<img src="${_esc(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'" loading="lazy">` : '<span class="material-symbols-outlined" style="font-size:16px;color:var(--on-surface-variant)">play_circle</span>'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(t.title)}</div>
          <div style="font-size:10px;color:var(--on-surface-variant)">${_esc(t.artist)}${t.duration ? ' · ' + _fmt(t.duration) : ''}</div>
        </div>
        <button onclick="event.stopPropagation();window._nsmAddSearchQ(${i})" style="background:rgba(124,77,255,0.15);border:none;border-radius:6px;padding:4px 8px;color:var(--primary);font-size:10px;font-weight:600;cursor:pointer;flex-shrink:0;min-height:32px" title="Add to queue">+ Q</button>
      </div>`).join('');
    // Store results for playback
    window._nsmSearchResults = results;
  };

  window._nsmPlaySearch = async function(i) {
    const t = window._nsmSearchResults?.[i];
    if (!t) return;
    // If it's a Jamendo track with direct audio URL
    if (t.source === 'jamendo' && t.audioUrl) {
      const tracks = window._nsmSearchResults.filter(x => x.source === 'jamendo' && x.audioUrl);
      S.setQueue(tracks.map(x => ({
        id: x.id, title: x.title, artist: x.artist, url: x.audioUrl,
        thumbnail: x.thumbnail, duration: x.duration, source: 'jamendo',
      })), tracks.indexOf(t));
      return;
    }
    // YouTube track — resolve audio URL
    if (!t.videoId) { showToast('Cannot play this track', 'error'); return; }
    showToast('Loading audio...', 'info');
    const url = await _getAudioUrl(t.videoId);
    if (!url) { showToast('Audio unavailable', 'error'); return; }
    const tracks = window._nsmSearchResults.filter(x => x.videoId);
    const queue = [];
    for (const x of tracks) {
      queue.push({ id: x.id, title: x.title, artist: x.artist, url: null, videoId: x.videoId, thumbnail: x.thumbnail, duration: x.duration, source: 'youtube' });
    }
    // Resolve all audio URLs lazily
    const playIdx = tracks.indexOf(t);
    // Resolve current track immediately
    queue[playIdx].url = url;
    S.queue = queue;
    S.idx = playIdx;
    S.play(queue[playIdx]);
    // Resolve remaining tracks in background
    for (let j = 0; j < queue.length; j++) {
      if (j === playIdx || queue[j].url) continue;
      const vId = queue[j].videoId;
      if (vId) {
        _getAudioUrl(vId).then(u => { if (u) queue[j].url = u; });
      }
    }
  };

  window._nsmAddSearchQ = async function(i) {
    const t = window._nsmSearchResults?.[i];
    if (!t) return;
    if (t.source === 'jamendo' && t.audioUrl) {
      S.addToQueue({ id: t.id, title: t.title, artist: t.artist, url: t.audioUrl, thumbnail: t.thumbnail, duration: t.duration, source: 'jamendo' });
      return;
    }
    if (!t.videoId) return;
    showToast('Resolving audio...', 'info');
    const url = await _getAudioUrl(t.videoId);
    if (!url) { showToast('Audio unavailable', 'error'); return; }
    S.addToQueue({ id: t.id, title: t.title, artist: t.artist, url, thumbnail: t.thumbnail, duration: t.duration, source: 'youtube' });
  };

  // ─── SESSION RESTORE ───
  function _restore() {
    try {
      const last = JSON.parse(localStorage.getItem('nsm_last') || 'null');
      if (last?.url) {
        S.track = last;
        S.audio.src = last.url;
        if (last._pos > 0) S.audio.currentTime = last._pos;
        _updateMini(last);
      }
    } catch(_) {}
  }

  setInterval(() => {
    if (S.track && S.audio && S.playing) {
      try {
        localStorage.setItem('nsm_last', JSON.stringify({ ...S.track, _pos: S.audio.currentTime || 0 }));
      } catch(_) {}
    }
  }, 5000);

  // ─── INIT ───
  S.volume = parseFloat(localStorage.getItem('nsm_vol') || '1');
  S.audio.volume = S.volume;
  S.shuffle = localStorage.getItem('nsm_shuffle') === 'true';
  S.repeat = localStorage.getItem('nsm_repeat') || 'off';

  _setupMediaSession();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => _restore());
  } else {
    _restore();
  }

})();
