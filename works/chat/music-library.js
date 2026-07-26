// Music Library — working search (iTunes, Deezer, Jamendo, YouTube Cloud Function), upload, play, all inside chat
(function() {
  'use strict';

  const LANGUAGES = ['Malayalam','Tamil','Telugu','Hindi','Kannada','Bengali','Marathi','Punjabi','English','Other'];
  const _trackCache = {};
  window._trackCache = _trackCache;
  const _TRACK_CACHE_MAX = 500;

  // ─── WORKING SEARCH BACKENDS ───

  // 1. iTunes Search API (free, no auth, excellent Indian music catalog)
  async function _searchiTunes(query, limit) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 10000);
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=${limit || 30}&entity=song`;
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.results) return [];
      return data.results.map(t => ({
        id: 'itunes_' + t.trackId,
        trackId: t.trackId,
        title: t.trackName || 'Untitled',
        artist: t.artistName || 'Unknown',
        duration: Math.round((t.trackTimeMillis || 0) / 1000),
        thumbnail: (t.artworkUrl100 || '').replace('100x100', '300x300'),
        audioUrl: t.previewUrl,
        source: 'itunes',
        collection: t.collectionName || '',
        releaseDate: t.releaseDate || '',
      }));
    } catch (e) {
      console.warn('[iTunes] Search failed:', e.message);
      return [];
    }
  }

  // 2. Deezer Search API (free, no auth for search, huge catalog)
  async function _searchDeezer(query, limit) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 10000);
      const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit || 30}`;
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.data) return [];
      return data.data.map(t => ({
        id: 'deezer_' + t.id,
        trackId: t.id,
        title: t.title || 'Untitled',
        artist: t.artist?.name || 'Unknown',
        duration: t.duration || 0,
        thumbnail: (t.album?.cover_medium || t.album?.cover_small || '').replace('200x200', '500x500') || null,
        audioUrl: t.preview,
        source: 'deezer',
        album: t.album?.title || '',
      }));
    } catch (e) {
      console.warn('[Deezer] Search failed:', e.message);
      return [];
    }
  }

  // 3. Jamendo API (CC-licensed, full tracks, free)
  const JAMENDO_CLIENT_ID = 'b2301a74';
  async function _searchJamendoAPI(query, limit) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 10000);
      const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&search=${encodeURIComponent(query)}&format=json&limit=${limit || 30}&include=musicinfo&audioformat=mp32`;
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.results) return [];
      return data.results.filter(t => t && t.audio).map(t => ({
        id: 'jam_' + t.id,
        trackId: t.id,
        title: t.name || 'Untitled',
        artist: t.artist_name || 'Unknown',
        duration: t.duration || 0,
        thumbnail: t.album_image || t.image || null,
        audioUrl: t.audio,
        source: 'jamendo',
        genre: t.musicinfo?.genres?.[0]?.name || '',
        license: 'CC-BY',
      }));
    } catch (e) {
      console.warn('[Jamendo] Search failed:', e.message);
      return [];
    }
  }

  // 4. YouTube via Cloud Function (InnerTube server-side, full YT catalog)
  async function _searchYouTubeViaCloud(query) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 15000);
      const fnUrl = `https://us-central1-my-team-chat-2255.cloudfunctions.net/youtubeSearch?q=${encodeURIComponent(query)}`;
      const res = await fetch(fnUrl, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.ok || !data.results) return [];
      return data.results.map(t => ({
        id: t.id,
        videoId: t.videoId,
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        thumbnail: t.thumbnail,
        viewCount: t.viewCount || 0,
        publishedText: t.publishedText || '',
        source: 'youtube',
      }));
    } catch (e) {
      console.warn('[YouTube Cloud] Search failed:', e.message);
      return [];
    }
  }

  // ─── YOUTUBE AUDIO EXTRACTION (via Cloud Function) ───
  async function _getYouTubeAudioUrl(videoId) {
    if (!videoId) return null;
    // Check cache
    try {
      const cache = JSON.parse(localStorage.getItem('nsl_yt_audio_cache') || '{}');
      const entry = cache[videoId];
      if (entry && (Date.now() - entry.ts < 4 * 3600000)) return entry.url;
    } catch(_) {}
    // Try Cloud Function
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 15000);
      const fnUrl = `https://us-central1-my-team-chat-2255.cloudfunctions.net/youtubeSearch?videoId=${videoId}`;
      const res = await fetch(fnUrl, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.ok && data.url) {
        // Cache it
        try {
          const cache = JSON.parse(localStorage.getItem('nsl_yt_audio_cache') || '{}');
          cache[videoId] = { url: data.url, ts: Date.now() };
          const keys = Object.keys(cache);
          if (keys.length > 50) { keys.sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0)); keys.slice(0, keys.length - 50).forEach(k => delete cache[k]); }
          localStorage.setItem('nsl_yt_audio_cache', JSON.stringify(cache));
        } catch(_) {}
        return data.url;
      }
    } catch (e) {
      console.warn('[YouTube Audio] Cloud function failed:', e.message);
    }
    return null;
  }
  window.getYouTubeAudioUrl = _getYouTubeAudioUrl;

  // ─── UNIFIED SEARCH (tries all backends, returns combined results) ───
  async function _searchAll(query, limit) {
    if (!query || query.length < 2) return [];

    // Search all backends in parallel
    const [itunesResults, deezerResults, jamendoResults, ytResults] = await Promise.allSettled([
      _searchiTunes(query, limit || 15),
      _searchDeezer(query, limit || 15),
      _searchJamendoAPI(query, limit || 15),
      _searchYouTubeViaCloud(query),
    ]);

    const all = [];
    const seen = new Set();

    // Merge results, dedup by title similarity
    function _addResults(results) {
      for (const t of (results.value || [])) {
        const key = (t.title + ' ' + t.artist).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(t);
      }
    }

    // YouTube first (best catalog), then iTunes/Deezer, then Jamendo
    _addResults(ytResults);
    _addResults(itunesResults);
    _addResults(deezerResults);
    _addResults(jamendoResults);

    return all;
  }

  // Backward-compatible alias
  window.searchInvidious = async function(query) {
    return _searchAll(query);
  };

  window.searchYouTubeMusic = async function(query) {
    return _searchAll(query);
  };

  // ─── PLAY FUNCTIONS ───

  window.playYouTubeTrack = async function(videoId, title, artist, thumbnail, duration) {
    if (!videoId) { showToast('No track to play', 'error'); return; }
    showToast('Loading audio...', 'info');
    const audioUrl = await _getYouTubeAudioUrl(videoId);
    if (!audioUrl) {
      showToast('Audio unavailable — try again later', 'error');
      return;
    }
    MusicPlayer.play({
      id: 'yt_' + videoId,
      title: title || 'YouTube',
      artist: artist || 'YouTube',
      url: audioUrl,
      thumbnail: thumbnail || null,
      duration: duration || 0,
      source: 'youtube',
    });
  };

  window.playYouTubeVideo = function(videoId, title) {
    playYouTubeTrack(videoId, title, '', '', 0);
  };

  window.playJamendoTrack = function(track) {
    if (!track || !track.audioUrl) { showToast('No audio URL', 'error'); return; }
    MusicPlayer.play({
      id: track.id,
      title: track.title,
      artist: track.artist,
      url: track.audioUrl,
      thumbnail: track.thumbnail,
      duration: track.duration,
      source: 'jamendo',
    });
  };

  window.playLibraryTrack = function(trackId) {
    const track = (App.musicLibrary || []).find(t => t.id === trackId);
    if (!track) { showToast('Track not found', 'error'); return; }
    if (!track.url) { showToast('No audio URL', 'error'); return; }
    MusicPlayer.play({
      id: track.id,
      title: track.title,
      artist: track.artist,
      url: track.url,
      thumbnail: track.thumbnail,
      duration: track.duration,
      source: track.source || 'upload',
      addedByName: track.addedByName,
    });
  };

  window.playCachedTrack = async function(trackId) {
    const t = _trackCache[trackId];
    if (!t) return;
    // YouTube track — resolve audio
    if (t.source === 'youtube' && t.videoId) {
      playYouTubeTrack(t.videoId, t.title, t.artist, t.thumbnail, t.duration);
      return;
    }
    // Track with direct URL
    if (t.audioUrl || t.url) {
      MusicPlayer.play({ id: t.id, title: t.title, artist: t.artist, url: t.audioUrl || t.url, thumbnail: t.thumbnail || null, duration: t.duration, source: t.source });
      return;
    }
    showToast('Cannot play this track', 'error');
  };

  // ─── RECENTLY PLAYED ───
  const RECENT_KEY = 'nsl_recent_tracks';
  window.addRecentlyPlayed = window.addRecentlyPlayed || function(track) {
    try {
      let recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      recent = recent.filter(t => t.id !== track.id);
      recent.unshift({ ...track, playedAt: Date.now() });
      if (recent.length > 100) recent = recent.slice(0, 100);
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch(_) {}
  };

  window.showRecentlyPlayed = function() {
    const existing = document.getElementById('recently-played-overlay');
    if (existing) { existing.remove(); return; }

    let recent = [];
    try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch(_) {}

    const overlay = document.createElement('div');
    overlay.id = 'recently-played-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px 20px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom,0px));width:100%;max-width:500px;max-height:75vh;overflow:hidden;display:flex;flex-direction:column;color:var(--on-surface)';

    if (!recent.length) {
      panel.innerHTML = '<div style="text-align:center;padding:32px;color:var(--on-surface-variant)"><span class="material-symbols-outlined" style="font-size:40px;opacity:0.3">history</span><p style="margin:8px 0 0;font-size:13px">No recently played tracks</p></div>';
    } else {
      panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0;font-size:16px;font-weight:700">Recently Played (${recent.length})</h3>
        <button onclick="document.getElementById('recently-played-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:18px">&times;</button>
      </div>
      <div style="flex:1;overflow-y:auto">
        ${recent.map(t => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;background:var(--surface-container-low,rgba(0,0,0,0.02));margin-bottom:4px;cursor:pointer" onclick="document.getElementById('recently-played-overlay')?.remove();playCachedTrack('${t.id}')">
            <div style="width:40px;height:40px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--surface-container-low,rgba(0,0,0,0.05))">
              ${t.thumbnail ? `<img src="${escHtml(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px;color:var(--on-surface-variant)">music_note</span></div>'}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title || 'Unknown')}</div>
              <div style="font-size:10px;color:var(--on-surface-variant)">${escHtml(t.artist || 'Unknown')}</div>
            </div>
            <button onclick="event.stopPropagation();_addToQueueFromRecent(${JSON.stringify(JSON.stringify(t)).replace(/"/g, '&quot;')})" style="background:rgba(124,77,255,0.15);border:none;border-radius:6px;padding:4px 8px;min-height:32px;color:var(--primary);font-size:10px;font-weight:600;cursor:pointer">+ Q</button>
          </div>
        `).join('')}
      </div>`;
    }

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  window._addToQueueFromRecent = function(jsonStr) {
    try {
      const t = JSON.parse(jsonStr);
      MusicPlayer.addToQueue(t);
    } catch(_) {}
  };

  // ─── UPLOAD ───
  window.uploadMusicFile = async function(file, meta = {}) {
    if (!App.auth?.currentUser || !App.db) { showToast('Sign in required', 'error'); return null; }
    if (!file || !file.type.startsWith('audio/')) { showToast('Please select an audio file', 'error'); return null; }
    if (file.size > 50 * 1024 * 1024) { showToast('File too large — max 50MB', 'error'); return null; }

    const uid = App.auth.currentUser.uid;
    const path = `music/${uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    showToast('Uploading...', 'info');

    try {
      const storageRef = App.storage ? App.storage.ref(path) : firebase.storage().ref(path);
      const uploadTask = storageRef.put(file);

      uploadTask.on('state_changed',
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          const bar = document.getElementById('music-upload-progress');
          if (bar) bar.style.width = pct + '%';
          const txt = document.getElementById('upload-status-text');
          if (txt) txt.textContent = `Uploading... ${pct}%`;
        },
        (err) => {
          console.error('Upload failed:', err);
          showToast('Upload failed: ' + err.message, 'error');
          const bar = document.getElementById('music-upload-progress');
          if (bar) bar.style.width = '0%';
          const container = document.getElementById('upload-progress-container');
          if (container) container.style.display = 'none';
          _pendingUploadFile = null;
        }
      );

      const snapshot = await uploadTask;
      const downloadURL = await snapshot.ref.getDownloadURL();

      const track = {
        id: 'mt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
        title: meta.title || file.name.replace(/\.[^.]+$/, ''),
        artist: meta.artist || 'Unknown',
        language: meta.language || 'Other',
        genre: meta.genre || '',
        url: downloadURL,
        thumbnail: null,
        duration: meta.duration || 0,
        size: file.size,
        fileName: file.name,
        storagePath: path,
        source: 'upload',
        addedBy: uid,
        addedByName: App.currentUser?.displayName || 'User',
        addedAt: Date.now(),
        playCount: 0,
        favorite: false,
      };

      await App.db.collection('musicLibrary').doc(track.id).set(track);
      App.musicLibrary.unshift(track);
      showToast('Uploaded: ' + track.title, 'success');
      return track;
    } catch(e) {
      console.error('Upload error:', e);
      showToast('Upload failed', 'error');
      return null;
    }
  };

  window.editMusicTrack = async function(trackId) {
    if (!App.db || !App.auth?.currentUser) return;
    const track = App.musicLibrary.find(t => t.id === trackId);
    if (!track || track.addedBy !== App.auth.currentUser.uid) { showToast('Not your track', 'error'); return; }
    const newTitle = prompt('Edit Title:', track.title);
    if (newTitle === null) return;
    if (!newTitle.trim()) { showToast('Title cannot be empty', 'error'); return; }
    const newArtist = prompt('Edit Artist:', track.artist || '');
    if (newArtist === null) return;
    try {
      await App.db.collection('musicLibrary').doc(trackId).update({ title: newTitle.trim(), artist: newArtist.trim() });
      track.title = newTitle.trim();
      track.artist = newArtist.trim();
      showToast('Updated', 'success');
      switchMusicLibTab('my');
    } catch(e) { showToast('Update failed', 'error'); }
  };

  window.deleteMusicTrack = async function(trackId) {
    if (!App.db || !App.auth?.currentUser) return false;
    const track = App.musicLibrary.find(t => t.id === trackId);
    if (!track) return false;
    if (track.addedBy !== App.auth.currentUser.uid) { showToast('Not your track', 'error'); return false; }
    try {
      if (track.storagePath && App.storage) await App.storage.ref(track.storagePath).delete().catch(() => {});
      await App.db.collection('musicLibrary').doc(trackId).delete();
      App.musicLibrary = App.musicLibrary.filter(t => t.id !== trackId);
      showToast('Deleted', 'success');
      return true;
    } catch(e) { showToast('Delete failed', 'error'); return false; }
  };

  window.toggleMusicFavorite = async function(trackId) {
    const track = App.musicLibrary.find(t => t.id === trackId);
    if (!track || !App.db) return;
    track.favorite = !track.favorite;
    try { await App.db.collection('musicLibrary').doc(trackId).update({ favorite: track.favorite }); } catch(_) {}
  };

  // ─── LOAD LIBRARY ───
  window.loadMusicLibrary = async function() {
    if (!App.db || !App.auth?.currentUser) return [];
    try {
      const snap = await App.db.collection('musicLibrary').where('addedBy', '==', App.auth.currentUser.uid).get();
      const tracks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      tracks.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      App.musicLibrary = tracks;
      return App.musicLibrary;
    } catch(e) { console.warn('Load library failed:', e); return []; }
  };

  // ─── MUSIC LIBRARY OVERLAY (everything inside chat, no navigation) ───
  window.openMusicLibrary = function() {
    try {
      const existing = document.getElementById('music-library-overlay');
      if (existing) { existing.remove(); return; }

      if (!localStorage.getItem('nsl_music_onboarded')) {
        showMusicOnboarding();
        return;
      }

      const overlay = document.createElement('div');
      overlay.id = 'music-library-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Music Library');
      overlay.style.cssText = 'position:fixed !important;inset:0 !important;z-index:9999 !important;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex !important;align-items:flex-end;justify-content:center;transition:all 0.3s ease;';

      const panel = document.createElement('div');
      panel.className = 'music-lib-panel';
      panel.style.cssText = 'background:var(--surface-container,#1a1b2e);border-radius:20px 20px 0 0;width:100%;max-width:600px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;color:var(--on-surface);animation:slideUp 0.25s ease';

      panel.innerHTML = `
        <div style="padding:16px 16px 0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h2 style="margin:0;font-size:18px;font-weight:700">Music</h2>
            <div style="display:flex;align-items:center;gap:10px">
              <button data-action="showRecentlyPlayed" style="background:rgba(124,77,255,0.15);border:none;border-radius:12px;padding:6px 12px;color:var(--primary);font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px">
                <span class="material-symbols-outlined" style="font-size:14px">history</span> Recent
              </button>
              <button onclick="document.getElementById('music-library-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">&times;</button>
            </div>
          </div>
          <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;-ms-overflow-style:none" id="ml-tabs">
            <button class="ml-tab active" data-action="switchMusicLibTab" data-action-arg="search" style="min-height:36px;flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:var(--primary);color:var(--on-primary)">Search</button>
            <button class="ml-tab" data-action="switchMusicLibTab" data-action-arg="my" style="min-height:36px;flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant)">My Music</button>
            <button class="ml-tab" data-action="switchMusicLibTab" data-action-arg="upload" style="min-height:36px;flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant)">Upload</button>
            <button class="ml-tab" data-action="switchMusicLibTab" data-action-arg="languages" style="min-height:36px;flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant)">Languages</button>
          </div>
        </div>
        <div id="music-lib-content" style="flex:1;overflow-y:auto;padding:8px 16px 20px"></div>`;

      overlay.appendChild(panel);
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);

      if (!document.getElementById('ml-responsive-css')) {
        const s = document.createElement('style');
        s.id = 'ml-responsive-css';
        s.textContent = '@media(max-width:400px){.filter-label{display:none!important}}#ml-tabs::-webkit-scrollbar{display:none}';
        document.head.appendChild(s);
      }

      const _mlEscHandler = function(e) {
        if (e.key === 'Escape') {
          const el = document.getElementById('music-library-overlay');
          if (el) el.remove();
          document.removeEventListener('keydown', _mlEscHandler);
        }
      };
      document.addEventListener('keydown', _mlEscHandler);

      switchMusicLibTab('search');
    } catch(err) {
      console.error('[MusicLibrary] openMusicLibrary error:', err);
      if (typeof showToast === 'function') showToast('Failed to open Music Library', 'error');
    }
  };

  // ─── TAB SWITCHING ───
  window.switchMusicLibTab = async function(tab) {
    document.querySelectorAll('.ml-tab').forEach(b => {
      b.style.background = 'var(--surface-container,rgba(0,0,0,0.06))';
      b.style.color = 'var(--on-surface-variant)';
      b.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.ml-tab[data-action-arg="${tab}"]`);
    if (activeBtn) { activeBtn.style.background = 'var(--primary)'; activeBtn.style.color = 'var(--on-primary)'; activeBtn.classList.add('active'); }

    const content = document.getElementById('music-lib-content');
    if (!content) return;

    if (tab === 'search') _renderSearchTab(content);
    else if (tab === 'my') await _renderMyMusic(content);
    else if (tab === 'upload') _renderUploadTab(content);
    else if (tab === 'languages') _renderLanguagesTab(content);
  };

  // ─── SEARCH TAB (default — shows results inside chat overlay) ───
  const _LANG_QUERIES = [
    { lang: 'Malayalam', color: '#FF6B35', queries: ['Malayalam songs', 'Malayalam hits', 'Mollywood songs', 'Malayalam romantic', 'Malayalam new'] },
    { lang: 'Hindi', color: '#FF9800', queries: ['Hindi songs', 'Bollywood songs', 'Hindi old hits', 'Hindi romantic'] },
    { lang: 'Tamil', color: '#E91E63', queries: ['Tamil songs', 'Tamil hits', 'Kollywood songs', 'Tamil romantic'] },
    { lang: 'Telugu', color: '#9C27B0', queries: ['Telugu songs', 'Telugu hits', 'Tollywood songs', 'Telugu romantic'] },
  ];

  const _SEARCH_HIST_KEY = 'nsl_yt_search_history';
  function _getSearchHistory() { try { return JSON.parse(localStorage.getItem(_SEARCH_HIST_KEY) || '[]'); } catch(_) { return []; } }
  function _addSearchHistory(q) {
    if (!q) return;
    let h = _getSearchHistory().filter(x => x.toLowerCase() !== q.toLowerCase());
    h.unshift(q); if (h.length > 15) h = h.slice(0, 15);
    localStorage.setItem(_SEARCH_HIST_KEY, JSON.stringify(h));
  }
  window._clearSearchHistory = function() {
    localStorage.removeItem(_SEARCH_HIST_KEY);
    const el = document.getElementById('yt-search-history');
    if (el) el.innerHTML = '<span style="font-size:11px;color:var(--on-surface-variant)">No recent searches</span>';
  };

  function _renderSearchTab(el) {
    const hist = _getSearchHistory();
    el.innerHTML = `
      <div style="margin-bottom:12px">
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input type="search" id="ml-search-input" placeholder="Search any song..." style="flex:1;min-width:0;padding:10px 14px;border-radius:12px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);font-size:13px;outline:none" onkeydown="if(event.key==='Enter')doMusicSearch()">
          <button data-action="doMusicSearch" style="min-height:44px;flex-shrink:0;padding:10px 18px;border-radius:12px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:700;cursor:pointer">Search</button>
        </div>
        ${hist.length ? `
        <div id="yt-search-history" style="margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:10px;font-weight:700;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:1px">Recent</span>
            <button data-action="_clearSearchHistory" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:10px">Clear</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${hist.map(h => `<button onclick="document.getElementById('ml-search-input').value='${escHtml(h).replace(/'/g, "\\'").replace(/&#x27;/g, "\\'").replace(/&#39;/g, "\\'")}';doMusicSearch()" style="padding:5px 10px;border-radius:16px;border:1px solid var(--outline-variant,rgba(0,0,0,0.08));background:var(--surface-container-low,rgba(0,0,0,0.03));color:var(--on-surface-variant);font-size:11px;cursor:pointer">${escHtml(h)}</button>`).join('')}
          </div>
        </div>` : '<div id="yt-search-history"></div>'}
      </div>
      <div id="ml-search-results"></div>
      <div style="font-size:11px;font-weight:700;color:var(--on-surface-variant);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">Browse by Language</div>
      ${_LANG_QUERIES.map(cat => `
        <div style="margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="width:36px;height:36px;border-radius:10px;background:${cat.color}20;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:${cat.color}">${cat.lang[0]}</div>
            <div style="font-size:14px;font-weight:700;color:var(--on-surface)">${cat.lang}</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${cat.queries.map(q => `
              <button onclick="document.getElementById('ml-search-input').value='${q.replace(/'/g, "\\'")}';doMusicSearch()" style="padding:6px 12px;border-radius:20px;border:1px solid var(--outline-variant,rgba(0,0,0,0.08));background:var(--surface-container-low,rgba(0,0,0,0.03));color:var(--on-surface-variant);font-size:11px;cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='${cat.color}';this.style.color='${cat.color}'" onmouseout="this.style.borderColor='var(--outline-variant)';this.style.color='var(--on-surface-variant)'">${q.replace(cat.lang + ' ', '')}</button>
            `).join('')}
          </div>
        </div>
      `).join('')}`;
  }

  window.doMusicSearch = async function() {
    const q = document.getElementById('ml-search-input')?.value?.trim();
    if (!q || q.length < 2) return;
    _addSearchHistory(q);
    const el = document.getElementById('ml-search-results');
    if (!el) return;

    el.innerHTML = `
      <div style="text-align:center;padding:24px">
        <span class="material-symbols-outlined animate-spin" style="color:var(--primary);font-size:28px">progress_activity</span>
        <p style="color:var(--on-surface-variant);font-size:12px;margin-top:8px">Searching "${escHtml(q)}"...</p>
        <div style="display:flex;gap:6px;justify-content:center;margin-top:8px;flex-wrap:wrap">
          <span style="font-size:10px;color:var(--on-surface-variant);opacity:0.6">iTunes</span>
          <span style="font-size:10px;color:var(--on-surface-variant);opacity:0.6">Deezer</span>
          <span style="font-size:10px;color:var(--on-surface-variant);opacity:0.6">Jamendo</span>
          <span style="font-size:10px;color:var(--on-surface-variant);opacity:0.6">YouTube</span>
        </div>
      </div>`;

    const results = await _searchAll(q);

    if (!results.length) {
      el.innerHTML = `
        <div style="text-align:center;padding:20px;color:var(--on-surface-variant)">
          <span class="material-symbols-outlined" style="font-size:36px;opacity:0.3">search_off</span>
          <p style="font-size:13px;margin:8px 0 4px">No results found</p>
          <p style="font-size:11px;margin:0">Try different keywords or check your connection</p>
        </div>`;
      return;
    }

    // Cache all results
    results.forEach(t => { _trackCache[t.id] = t; });
    var cacheKeys = Object.keys(_trackCache);
    if (cacheKeys.length > _TRACK_CACHE_MAX) {
      var toRemove = cacheKeys.slice(0, cacheKeys.length - _TRACK_CACHE_MAX);
      toRemove.forEach(function(k) { delete _trackCache[k]; });
    }

    // Group by source
    const ytResults = results.filter(t => t.source === 'youtube');
    const otherResults = results.filter(t => t.source !== 'youtube');

    let html = `<div style="font-size:11px;font-weight:700;color:var(--primary);margin-bottom:8px">${results.length} results for "${escHtml(q)}"</div>`;

    // YouTube results (with play via Cloud Function)
    if (ytResults.length) {
      html += `<div style="font-size:10px;font-weight:700;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;margin-top:8px">YouTube (${ytResults.length})</div>`;
      html += ytResults.map(t => _searchResultRow(t, true)).join('');
    }

    // Other results (iTunes, Deezer, Jamendo — direct playback)
    if (otherResults.length) {
      html += `<div style="font-size:10px;font-weight:700;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;margin-top:12px">Other Sources (${otherResults.length})</div>`;
      html += otherResults.map(t => _searchResultRow(t, false)).join('');
    }

    el.innerHTML = html;
    console.log('[Music] Search results rendered:', results.length, 'tracks. Cache size:', Object.keys(_trackCache).length);
    console.log('[Music] MusicPlayer available:', typeof MusicPlayer, 'play:', typeof MusicPlayer?.play);
    console.log('[Music] _playSearchResult available:', typeof window._playSearchResult);
    console.log('[Music] First track in cache:', Object.values(_trackCache)[0]?.id);
  };

  // Backward compat
  window.doYouTubeSearch = window.doMusicSearch;
  window.doYouTubeSearchFor = function(q) {
    const input = document.getElementById('ml-search-input');
    if (input) input.value = q;
    doMusicSearch();
  };

  function _searchResultRow(t, isYouTube) {
    const sourceBadge = {
      'youtube': '<span style="background:rgba(255,0,0,0.15);color:#ff4444;font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700">YT</span>',
      'itunes': '<span style="background:rgba(252,60,68,0.15);color:#fc3c44;font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700">iTunes</span>',
      'deezer': '<span style="background:rgba(168,78,255,0.15);color:#a84eff;font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700">Deezer</span>',
      'jamendo': '<span style="background:rgba(255,165,0,0.15);color:#ffa500;font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700">Jamendo</span>',
    };

    const _safeAttr = s => escHtml(s).replace(/'/g, "\\'").replace(/&#x27;/g, "\\'").replace(/&#39;/g, "\\'");
    const playAction = isYouTube
      ? `playYouTubeTrack('${t.videoId}','${_safeAttr(t.title)}','${_safeAttr(t.artist)}','${_safeAttr(t.thumbnail || '')}',${t.duration || 0})`
      : `_playSearchResult('${t.id}')`;

    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;background:var(--surface-container-low,rgba(0,0,0,0.03));margin-bottom:4px;cursor:pointer" onclick="${playAction}">
        <div style="width:48px;height:36px;border-radius:6px;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
          ${t.thumbnail ? `<img src="${escHtml(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'" loading="lazy">` : '<span class="material-symbols-outlined" style="font-size:16px;color:var(--on-surface-variant)">play_circle</span>'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:4px">${escHtml(t.title)} ${sourceBadge[t.source] || ''}</div>
          <div style="font-size:10px;color:var(--on-surface-variant)">${escHtml(t.artist)}${t.duration ? ' · ' + formatTrackDuration(t.duration) : ''}</div>
        </div>
        <button onclick="event.stopPropagation();_addSearchToQueue('${t.id}')" style="background:rgba(124,77,255,0.15);border:none;border-radius:6px;padding:4px 8px;color:var(--primary);font-size:10px;font-weight:600;cursor:pointer;flex-shrink:0;min-height:32px" title="Add to queue">+ Q</button>
      </div>`;
  }

  window._playSearchResult = async function(trackId) {
    showToast('🎵 Playing track...', 'info');
    console.log('[Music] _playSearchResult called:', trackId);
    const t = _trackCache[trackId];
    if (!t) { console.warn('[Music] Track not in cache:', trackId); return; }
    if (t.audioUrl || t.url) {
      MusicPlayer.play({ id: t.id, title: t.title, artist: t.artist, url: t.audioUrl || t.url, thumbnail: t.thumbnail || null, duration: t.duration, source: t.source });
    } else if (t.videoId) {
      console.log('[Music] Playing YouTube:', t.videoId);
      playYouTubeTrack(t.videoId, t.title, t.artist, t.thumbnail, t.duration);
    } else {
      console.warn('[Music] Track has no audio URL and no videoId:', t);
    }
  };

  window._addSearchToQueue = async function(trackId) {
    const t = _trackCache[trackId];
    if (!t) return;
    if (t.source === 'youtube' && t.videoId) {
      showToast('Resolving audio...', 'info');
      const url = await _getYouTubeAudioUrl(t.videoId);
      if (!url) { showToast('Audio unavailable', 'error'); return; }
      MusicPlayer.addToQueue({ id: t.id, title: t.title, artist: t.artist, url, thumbnail: t.thumbnail, duration: t.duration, source: 'youtube' });
    } else if (t.audioUrl || t.url) {
      MusicPlayer.addToQueue({ id: t.id, title: t.title, artist: t.artist, url: t.audioUrl || t.url, thumbnail: t.thumbnail, duration: t.duration, source: t.source });
    }
  };

  // ─── MY MUSIC TAB ───
  async function _renderMyMusic(el) {
    await loadMusicLibrary();
    const tracks = App.musicLibrary;
    if (!tracks.length) {
      el.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--on-surface-variant)">
          <span class="material-symbols-outlined" style="font-size:48px;opacity:0.3">library_music</span>
          <p style="font-size:14px;font-weight:600;margin:12px 0 4px">Your library is empty</p>
          <p style="font-size:12px;margin:0 0 16px">Upload songs or search online</p>
          <button data-action="switchMusicLibTab" data-action-arg="upload" style="padding:10px 24px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Upload Music</button>
        </div>`;
      return;
    }

    let html = `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input type="search" placeholder="Search my music..." oninput="filterMyMusic(this.value)" style="flex:1;min-width:0;padding:8px 12px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);font-size:13px;outline:none">
        <select id="ml-lang-filter" onchange="filterMyMusicByLang(this.value)" style="max-width:120px;padding:8px 12px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);font-size:12px">
          <option value="">All Languages</option>
          ${LANGUAGES.map(l => `<option value="${l}">${l}</option>`).join('')}
        </select>
      </div>
      <div id="my-music-list">`;
    tracks.forEach(t => { html += _libRow(t); });
    html += '</div>';
    el.innerHTML = html;
  }

  window.filterMyMusic = function(q) {
    const lower = q.toLowerCase();
    const filtered = App.musicLibrary.filter(t => t.title.toLowerCase().includes(lower) || t.artist.toLowerCase().includes(lower));
    const list = document.getElementById('my-music-list');
    if (list) list.innerHTML = filtered.map(t => _libRow(t)).join('');
  };

  window.filterMyMusicByLang = function(lang) {
    const filtered = lang ? App.musicLibrary.filter(t => t.language === lang) : App.musicLibrary;
    const list = document.getElementById('my-music-list');
    if (list) list.innerHTML = filtered.map(t => _libRow(t)).join('');
  };

  function _libRow(t) {
    const isPlaying = MusicPlayer?._currentTrack?.id === t.id || MusicPlayer?.track?.id === t.id;
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:${isPlaying ? 'rgba(124,77,255,0.1)' : 'var(--surface-container-low,rgba(0,0,0,0.03))'};margin-bottom:6px;cursor:pointer" data-action="playLibraryTrack" data-action-arg="${t.id}">
      <div style="width:42px;height:42px;border-radius:8px;background:linear-gradient(135deg,rgba(124,77,255,0.2),rgba(74,0,224,0.1));display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
        ${t.thumbnail ? `<img src="${escHtml(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">` : '<span class="material-symbols-outlined" style="font-size:18px;color:var(--primary)">music_note</span>'}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title)}</div>
        <div style="font-size:11px;color:var(--on-surface-variant);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.artist)}${t.language ? ' · ' + t.language : ''}</div>
      </div>
      <div style="display:flex;gap:4px">
        ${t.addedBy === App.auth?.currentUser?.uid ? `<button onclick="event.stopPropagation();editMusicTrack('${t.id}')" style="background:none;border:none;cursor:pointer;padding:8px;min-width:36px;min-height:36px;display:inline-flex;align-items:center;justify-content:center;color:var(--on-surface-variant)" title="Edit"><span class="material-symbols-outlined" style="font-size:16px">edit</span></button>` : ''}
        ${t.addedBy === App.auth?.currentUser?.uid ? `<button onclick="event.stopPropagation();deleteMusicTrack('${t.id}').then(()=>switchMusicLibTab('my'))" style="background:none;border:none;cursor:pointer;padding:8px;min-width:36px;min-height:36px;display:inline-flex;align-items:center;justify-content:center;color:var(--on-surface-variant)" title="Delete"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button>` : ''}
      </div>
    </div>`;
  }

  // ─── UPLOAD TAB ───
  function _renderUploadTab(el) {
    el.innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div style="border:2px dashed var(--outline-variant,rgba(0,0,0,0.15));border-radius:16px;padding:32px 20px;margin-bottom:16px;cursor:pointer;transition:all 0.2s" id="upload-drop-zone" onclick="document.getElementById('music-file-input').click()" ondragover="event.preventDefault();this.style.borderColor='var(--primary)'" ondragleave="this.style.borderColor='var(--outline-variant,rgba(0,0,0,0.15))'" ondrop="event.preventDefault();this.style.borderColor='var(--outline-variant,rgba(0,0,0,0.15))';handleMusicFileDrop(event)">
          <span class="material-symbols-outlined" style="font-size:40px;color:var(--on-surface-variant);opacity:0.4">upload_file</span>
          <p style="font-size:13px;font-weight:600;color:var(--on-surface);margin:8px 0 4px">Tap to select audio files</p>
          <p style="font-size:11px;color:var(--on-surface-variant);margin:0">MP3, WAV, OGG, M4A — up to 50MB</p>
          <input type="file" id="music-file-input" accept="audio/*" multiple style="display:none" onchange="handleMusicFileSelect(event)">
        </div>
        <div id="upload-progress-container" style="display:none;margin-bottom:16px">
          <div style="height:4px;background:var(--outline-variant,rgba(255,255,255,0.1));border-radius:2px;overflow:hidden">
            <div id="music-upload-progress" style="height:100%;background:var(--primary);width:0%;transition:width 0.3s"></div>
          </div>
          <p id="upload-status-text" style="font-size:11px;color:var(--on-surface-variant);margin-top:4px">Uploading...</p>
        </div>
        <div id="upload-form" style="display:none;text-align:left">
          <div style="margin-bottom:12px">
            <label style="font-size:11px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">TITLE</label>
            <input id="upload-title" type="text" placeholder="Song title" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--outline-variant);background:var(--surface-container-low);color:var(--on-surface);font-size:13px;box-sizing:border-box">
          </div>
          <div style="margin-bottom:12px">
            <label style="font-size:11px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">ARTIST</label>
            <input id="upload-artist" type="text" placeholder="Artist name" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--outline-variant);background:var(--surface-container-low);color:var(--on-surface);font-size:13px;box-sizing:border-box">
          </div>
          <div style="margin-bottom:12px">
            <label style="font-size:11px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">LANGUAGE</label>
            <select id="upload-language" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--outline-variant);background:var(--surface-container-low);color:var(--on-surface);font-size:13px">
              ${LANGUAGES.map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
          <button data-action="submitMusicUpload" style="width:100%;padding:12px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Upload to Library</button>
        </div>
      </div>`;
  }

  window.handleMusicFileSelect = function(e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    if (files.length === 1) { _prepareUpload(files[0]); return; }
    _prepareUploadBatch(Array.from(files));
  };

  window.handleMusicFileDrop = function(e) {
    const files = e.dataTransfer.files;
    if (!files || !files.length) return;
    if (files.length === 1) { _prepareUpload(files[0]); return; }
    _prepareUploadBatch(Array.from(files));
  };

  let _pendingUploadFile = null;
  function _prepareUpload(file) {
    if (!file.type.startsWith('audio/')) { showToast('Please select an audio file', 'error'); return; }
    _pendingUploadFile = file;
    const name = file.name.replace(/\.[^.]+$/, '');
    const titleInput = document.getElementById('upload-title');
    const form = document.getElementById('upload-form');
    const dropZone = document.getElementById('upload-drop-zone');
    if (titleInput) titleInput.value = name;
    if (form) form.style.display = 'block';
    if (dropZone) {
      dropZone.innerHTML = `<span class="material-symbols-outlined" style="font-size:32px;color:var(--primary)">audio_file</span><p style="font-size:12px;font-weight:600;color:var(--primary);margin:4px 0">${escHtml(file.name)}</p><p style="font-size:10px;color:var(--on-surface-variant)">${(file.size / (1024*1024)).toFixed(1)} MB</p>`;
      dropZone.onclick = null;
    }
  }

  function _prepareUploadBatch(files) {
    const audio = files.filter(f => f.type.startsWith('audio/'));
    if (!audio.length) { showToast('No audio files found', 'error'); return; }
    showToast(`Uploading ${audio.length} files...`, 'info');
    const container = document.getElementById('upload-progress-container');
    if (container) container.style.display = 'block';
    let done = 0;
    async function next() {
      if (done >= audio.length) { showToast('All uploaded!', 'success'); switchMusicLibTab('my'); return; }
      const bar = document.getElementById('music-upload-progress');
      if (bar) bar.style.width = Math.round((done / audio.length) * 100) + '%';
      await uploadMusicFile(audio[done], { title: audio[done].name.replace(/\.[^.]+$/, ''), artist: 'Unknown' });
      done++;
      next();
    }
    next();
  }

  window.submitMusicUpload = async function() {
    if (!_pendingUploadFile) { showToast('No file selected', 'error'); return; }
    const container = document.getElementById('upload-progress-container');
    if (container) container.style.display = 'block';
    const track = await uploadMusicFile(_pendingUploadFile, {
      title: document.getElementById('upload-title')?.value,
      artist: document.getElementById('upload-artist')?.value,
      language: document.getElementById('upload-language')?.value,
    });
    _pendingUploadFile = null;
    if (track) switchMusicLibTab('my');
  };

  // ─── LANGUAGES TAB ───
  function _renderLanguagesTab(el) {
    const colors = {
      'Malayalam': '#FF6B35', 'Tamil': '#E91E63', 'Telugu': '#9C27B0',
      'Hindi': '#FF9800', 'Kannada': '#4CAF50', 'Bengali': '#2196F3',
      'Marathi': '#00BCD4', 'Punjabi': '#FF5722', 'English': '#607D8B', 'Other': '#78909C',
    };
    let html = '<p style="font-size:12px;color:var(--on-surface-variant);margin-bottom:12px">Browse music by language — searches iTunes, Deezer, Jamendo & YouTube</p>';
    LANGUAGES.forEach(lang => {
      html += `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:var(--surface-container-low,rgba(0,0,0,0.03));margin-bottom:6px;cursor:pointer" data-action="browseLanguageYT" data-action-arg="${lang}">
          <div style="width:42px;height:42px;border-radius:10px;background:${colors[lang] || '#666'}20;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:${colors[lang]}">${lang[0]}</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--on-surface)">${lang}</div>
            <div style="font-size:11px;color:var(--on-surface-variant)">Browse ${lang} songs</div>
          </div>
          <span class="material-symbols-outlined" style="color:var(--on-surface-variant);font-size:18px">chevron_right</span>
        </div>`;
    });
    el.innerHTML = html;
  }

  window.browseLanguageYT = function(lang) {
    switchMusicLibTab('search');
    setTimeout(() => {
      const input = document.getElementById('ml-search-input');
      if (input) { input.value = lang + ' songs'; }
      _addSearchHistory(lang + ' songs');
      doMusicSearch();
    }, 100);
  };

  window.browseLanguageMusic = function(lang) { browseLanguageYT(lang); };

  // ─── ARCHIVE.ORG SEARCH (public domain) ───
  window.searchJamendo = async function(query, page) {
    if (!query || query.length < 2) return [];
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 10000);
      const url = `https://archive.org/advancedsearch.php?q=(title:(${encodeURIComponent(query)}) OR creator:(${encodeURIComponent(query)})) AND format:(MP3 OR "VBR MP3")&fl[]=identifier,title,creator,downloads&rows=30&output=json`;
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      const data = await res.json();
      return (data.response?.docs || []).map(t => ({
        id: 'arc_' + t.identifier, identifier: t.identifier,
        title: t.title || 'Unknown', artist: t.creator || 'Unknown',
        url: null, thumbnail: `https://archive.org/services/img/${t.identifier}`,
        duration: 0, source: 'archive',
      }));
    } catch(_) { return []; }
  };

  window.searchJamendoByLanguage = async function(lang) {
    return _searchAll(lang + ' songs');
  };

  window.resolveArchiveTrackUrl = async function(identifier) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(`https://archive.org/metadata/${identifier}`, { signal: ctrl.signal });
      clearTimeout(tid);
      const data = await res.json();
      const mp3 = (data.files || []).find(f => f.name.endsWith('.mp3') && (f.format === 'VBR MP3' || f.format === 'MP3'));
      if (mp3) {
        const url = `https://archive.org/download/${identifier}/${encodeURIComponent(mp3.name)}`;
        let duration = 0;
        if (mp3.length) {
          const p = mp3.length.split(':').map(Number);
          duration = p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p.length === 2 ? p[0]*60+p[1] : 0;
        }
        return { url, duration };
      }
      return null;
    } catch(_) { return null; }
  };

  window.doArchiveSearch = function() {
    const q = document.getElementById('archive-search-input')?.value;
    const searchInput = document.getElementById('ml-search-input');
    if (q && searchInput) { searchInput.value = q; doMusicSearch(); }
  };

  // ─── YOUTUBE PLAYLIST IMPORT ───
  window.fetchYouTubePlaylist = async function(url) {
    const m = (url || '').match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (!m) { showToast('Invalid playlist URL', 'error'); return []; }
    // For now, search instead of importing
    showToast('Playlist import via search', 'info');
    return [];
  };

  window.doYouTubePlaylistImport = function() {
    showToast('Use search to find playlist tracks', 'info');
  };

  // ─── ONBOARDING ───
  window.checkMusicOnboarding = function() {
    if (localStorage.getItem('nsl_music_onboarded')) return;
    setTimeout(() => showMusicOnboarding(), 2000);
  };

  window.showMusicOnboarding = function() {
    if (document.getElementById('onboarding-overlay')) return;
    const steps = [
      { icon: 'music_note', title: 'Welcome to Music!', desc: 'Search any song from multiple sources, upload your music, and listen while you chat.' },
      { icon: 'search', title: 'Search Any Song', desc: 'Find songs from iTunes, Deezer, Jamendo, and YouTube — all in one search!' },
      { icon: 'library_music', title: 'Your Library', desc: 'Upload your own MP3s and organize them by language.' },
      { icon: 'download', title: 'Background Play', desc: 'Music keeps playing in a floating mini player even when you switch chats or lock your phone.' },
    ];
    let step = 0;

    function renderStep() {
      const s = steps[step];
      const overlay = document.getElementById('onboarding-overlay');
      if (!overlay) return;
      overlay.innerHTML = `
        <div style="background:var(--surface-container,#1e1e2e);border-radius:24px;padding:32px;max-width:360px;width:85vw;text-align:center;color:var(--on-surface)">
          <div style="width:80px;height:80px;border-radius:50%;background:rgba(124,77,255,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
            <span class="material-symbols-outlined" style="font-size:36px;color:var(--primary)">${s.icon}</span>
          </div>
          <h2 style="margin:0 0 8px;font-size:20px;font-weight:700">${s.title}</h2>
          <p style="margin:0 0 24px;font-size:14px;color:var(--on-surface-variant);line-height:1.5">${s.desc}</p>
          <div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px">
            ${steps.map((_, i) => `<div style="width:${i===step?'20px':'6px'};height:6px;border-radius:3px;background:${i===step?'var(--primary)':'var(--outline-variant)'};transition:all 0.3s"></div>`).join('')}
          </div>
          <div style="display:flex;gap:8px">
            ${step < steps.length - 1 ? `<button onclick="document.getElementById('onboarding-overlay')?.remove()" style="flex:1;padding:12px;border-radius:12px;border:none;background:var(--surface-container-high);color:var(--on-surface-variant);font-size:13px;font-weight:600;cursor:pointer">Skip</button>` : ''}
            <button onclick="${step < steps.length - 1 ? 'window._onboardStep()' : 'window._finishOnboarding()'}" style="flex:1;padding:12px;border-radius:12px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">${step < steps.length - 1 ? 'Next' : 'Get Started'}</button>
          </div>
        </div>`;
    }

    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease';
    overlay.addEventListener('click', e => { if (e.target === overlay) window._finishOnboarding(); });
    document.body.appendChild(overlay);

    window._onboardStep = function() { step++; renderStep(); };
    window._finishOnboarding = function() {
      localStorage.setItem('nsl_music_onboarded', 'true');
      document.getElementById('onboarding-overlay')?.remove();
    };
    renderStep();
  };

})();
