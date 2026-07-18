// Music Library — user uploads, Archive.org free music, YouTube via Piped+Invidious, language filters
(function() {
  'use strict';

  // ─── STATE ───
  App.musicLibrary = [];
  App._musicUploadProgress = 0;
  const LANGUAGES = ['Malayalam','Tamil','Telugu','Hindi','Kannada','Bengali','Marathi','Punjabi','English','Other'];
  const _trackCache = {};
  window._trackCache = _trackCache;

  // ─── SEARCH FILTER STATE ───
  let _ytFilterDuration = 'all';
  let _ytFilterSort = 'relevance';
  let _ytFilterLang = 'all';

  // ─── YOUTUBE PROXY BACKENDS (100% free, no API key) ───

  // Invidious instances (expanded for reliability)
  const INV_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.jing.rocks',
    'https://vid.puffyan.us',
    'https://yewtu.be',
    'https://iv.ggtyler.dev',
    'https://invidious.privacyredirect.com',
    'https://invidious.perennialte.ch',
    'https://yt.artemislena.eu',
    'https://invidious.fdn.fr',
    'https://inv.tux.pizza',
    'https://invidious.protokolla.fi',
    'https://invidious.lunar.icu',
  ];
  let _workingInv = null;

  // Piped instances (second backend — independent infrastructure)
  const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.r4fo.com',
    'https://pipedapi.leptons.xyz',
    'https://pipedapi.moomoo.me',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.mint.lgbt',
    'https://pipedapi.drgns.space',
    'https://api.piped.yt',
    'https://pipedapi.in.projectsegfau.lt',
    'https://watchapi.whatever.social',
  ];
  let _workingPiped = null;

  // ─── Invidious fetcher ───
  async function _invFetch(path, timeout) {
    const instances = _workingInv
      ? [_workingInv, ...INV_INSTANCES.filter(i => i !== _workingInv)]
      : INV_INSTANCES;
    for (const inst of instances) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), timeout || 8000);
        const res = await fetch(inst + path, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) continue;
        const data = await res.json();
        if (!data || (Array.isArray(data) && !data.length)) continue;
        _workingInv = inst;
        return data;
      } catch(_) { continue; }
    }
    return null;
  }

  // ─── Piped fetcher ───
  async function _pipedFetch(path, timeout) {
    const instances = _workingPiped
      ? [_workingPiped, ...PIPED_INSTANCES.filter(i => i !== _workingPiped)]
      : PIPED_INSTANCES;
    for (const inst of instances) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), timeout || 8000);
        const res = await fetch(inst + path, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) continue;
        const data = await res.json();
        if (!data) continue;
        if (data.error) continue;
        _workingPiped = inst;
        return data;
      } catch(_) { continue; }
    }
    return null;
  }

  // ─── YouTube search: try Invidious, fallback to Piped ───
  async function _searchInvidiousRaw(query) {
    const data = await _invFetch('/api/v1/search?q=' + encodeURIComponent(query) + '&type=video', 10000);
    if (!data || !Array.isArray(data)) return [];
    return data.filter(v => v && v.videoId).slice(0, 30).map(v => ({
      id: 'yt_' + v.videoId,
      videoId: v.videoId,
      title: v.title || 'Untitled',
      artist: v.author || 'Unknown',
      duration: v.lengthSeconds || 0,
      thumbnail: (v.videoThumbnails && v.videoThumbnails.find(t => t.quality === 'medium') || (v.videoThumbnails && v.videoThumbnails[0]) || {}).url || ('https://i.ytimg.com/vi/' + v.videoId + '/mqdefault.jpg'),
      viewCount: v.viewCount || 0,
      publishedText: v.publishedText || '',
      source: 'youtube',
    }));
  }

  async function _searchPipedRaw(query) {
    const data = await _pipedFetch('/search?q=' + encodeURIComponent(query) + '&filter=music_songs', 10000);
    if (!data || !data.items) return [];
    return data.items.filter(v => v && v.url).slice(0, 30).map(v => {
      const videoId = (v.url || '').replace('/watch?v=', '');
      return {
        id: 'yt_' + videoId,
        videoId,
        title: v.title || 'Untitled',
        artist: v.uploaderName || 'Unknown',
        duration: v.duration || 0,
        thumbnail: v.thumbnailUrl || ('https://i.ytimg.com/vi/' + videoId + '/mqdefault.jpg'),
        viewCount: v.views || 0,
        publishedText: v.uploadedDate || '',
        source: 'youtube',
      };
    });
  }

  window.searchInvidious = async function(query) {
    if (!query || query.length < 2) return [];
    // Try Invidious first, fallback to Piped, then Jamendo
    let results = await _searchInvidiousRaw(query);
    if (!results.length) {
      results = await _searchPipedRaw(query);
    }
    if (!results.length) {
      results = await _searchJamendoAPI(query);
    }
    return results;
  };

  // ─── YouTube audio extraction: try Invidious, fallback to Piped ───
  async function _getInvAudioUrl(videoId) {
    const data = await _invFetch('/api/v1/videos/' + videoId + '?fields=adaptiveFormats,title,author', 12000);
    if (!data || !data.adaptiveFormats) return null;
    const audio = data.adaptiveFormats
      .filter(f => f.type && f.type.startsWith('audio/'))
      .sort((a, b) => (b.audioBitrate || b.bitrate || 0) - (a.audioBitrate || a.bitrate || 0));
    if (audio.length && audio[0].url) return audio[0].url;
    return null;
  }

  async function _getPipedAudioUrl(videoId) {
    const data = await _pipedFetch('/streams/' + videoId, 12000);
    if (!data || !data.audioStreams) return null;
    const audio = data.audioStreams
      .filter(s => s.mimeType && s.mimeType.startsWith('audio/'))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    if (audio.length && audio[0].url) return audio[0].url;
    return null;
  }

  // ─── AUDIO URL CACHE (4-hour TTL for offline fallback) ───
  const _YT_CACHE_KEY = 'nsl_yt_audio_cache';
  const _YT_CACHE_TTL = 4 * 60 * 60 * 1000;

  function _getCachedAudioUrl(videoId) {
    try {
      const cache = JSON.parse(localStorage.getItem(_YT_CACHE_KEY) || '{}');
      const entry = cache[videoId];
      if (entry && (Date.now() - entry.ts < _YT_CACHE_TTL)) return entry.url;
      if (entry) delete cache[videoId];
      localStorage.setItem(_YT_CACHE_KEY, JSON.stringify(cache));
    } catch(_) {}
    return null;
  }

  function _cacheAudioUrl(videoId, url) {
    if (!videoId || !url) return;
    try {
      const cache = JSON.parse(localStorage.getItem(_YT_CACHE_KEY) || '{}');
      cache[videoId] = { url, ts: Date.now() };
      const keys = Object.keys(cache);
      if (keys.length > 50) {
        keys.sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0));
        keys.slice(0, keys.length - 50).forEach(k => delete cache[k]);
      }
      localStorage.setItem(_YT_CACHE_KEY, JSON.stringify(cache));
    } catch(_) {}
  }

  // ─── YOUTUBE PLAYLIST IMPORT ───
  function _parseYouTubePlaylistId(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      return u.searchParams.get('list') || null;
    } catch(_) {
      const m = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
      return m ? m[1] : null;
    }
  }

  async function _fetchPipedPlaylist(playlistId) {
    const data = await _pipedFetch('/playlists/' + playlistId, 15000);
    if (!data || !data.relatedStreams) return [];
    return data.relatedStreams.map(v => {
      const vid = (v.url || '').replace('/watch?v=', '');
      return {
        id: 'yt_' + vid,
        videoId: vid,
        title: v.title || 'Untitled',
        artist: v.uploaderName || 'Unknown',
        duration: v.duration || 0,
        thumbnail: v.thumbnailUrl || ('https://i.ytimg.com/vi/' + vid + '/mqdefault.jpg'),
        source: 'youtube',
      };
    });
  }

  async function _fetchInvPlaylist(playlistId) {
    const data = await _invFetch('/api/v1/playlists/' + playlistId, 15000);
    if (!data || !data.videos) return [];
    return data.videos.map(v => ({
      id: 'yt_' + v.videoId,
      videoId: v.videoId,
      title: v.title || 'Untitled',
      artist: v.author || 'Unknown',
      duration: v.lengthSeconds || 0,
      thumbnail: (v.videoThumbnails && v.videoThumbnails.find(t => t.quality === 'medium') || (v.videoThumbnails && v.videoThumbnails[0]) || {}).url || ('https://i.ytimg.com/vi/' + v.videoId + '/mqdefault.jpg'),
      source: 'youtube',
    }));
  }

  window.fetchYouTubePlaylist = async function(url) {
    const playlistId = _parseYouTubePlaylistId(url);
    if (!playlistId) { showToast('Invalid playlist URL', 'error'); return []; }
    let tracks = await _fetchPipedPlaylist(playlistId);
    if (!tracks.length) tracks = await _fetchInvPlaylist(playlistId);
    return tracks;
  };

  window.getYouTubeAudioUrl = async function(videoId) {
    if (!videoId) return null;
    // 1. Try cached URL first (fast, works offline)
    const cached = _getCachedAudioUrl(videoId);
    if (cached) return cached;
    // 2. Try Invidious, fallback to Piped
    let url = await _getInvAudioUrl(videoId);
    if (!url) url = await _getPipedAudioUrl(videoId);
    // 3. Cache successful result
    if (url) _cacheAudioUrl(videoId, url);
    return url;
  };

  window.playYouTubeTrack = async function(videoId, title, artist, thumbnail, duration) {
    if (!videoId) return;
    showToast('Loading audio...', 'info');
    const audioUrl = await getYouTubeAudioUrl(videoId);
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

  // ─── SEARCH HISTORY ───
  const _SEARCH_HIST_KEY = 'nsl_yt_search_history';

  function _getSearchHistory() {
    try { return JSON.parse(localStorage.getItem(_SEARCH_HIST_KEY) || '[]'); } catch(_) { return []; }
  }
  function _addSearchHistory(query) {
    if (!query) return;
    let hist = _getSearchHistory().filter(h => h.toLowerCase() !== query.toLowerCase());
    hist.unshift(query);
    if (hist.length > 15) hist = hist.slice(0, 15);
    localStorage.setItem(_SEARCH_HIST_KEY, JSON.stringify(hist));
  }
  window._clearSearchHistory = function() {
    localStorage.removeItem(_SEARCH_HIST_KEY);
    const el = document.getElementById('yt-search-history');
    if (el) el.innerHTML = '<span style="font-size:11px;color:var(--on-surface-variant)">No recent searches</span>';
  };

  // ─── UPLOAD MUSIC ───
  window.uploadMusicFile = async function(file, meta = {}) {
    if (!App.auth?.currentUser || !App.db) { showToast('Sign in required', 'error'); return null; }
    if (!file || !file.type.startsWith('audio/')) { showToast('Please select an audio file', 'error'); return null; }

    const uid = App.auth.currentUser.uid;
    const ext = file.name.split('.').pop() || 'mp3';
    const path = `music/${uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    showToast('Uploading...', 'info');
    App._musicUploadProgress = 0;

    try {
      const storageRef = App.storage ? App.storage.ref(path) : firebase.storage().ref(path);
      const uploadTask = storageRef.put(file);

      uploadTask.on('state_changed',
        (snap) => {
          App._musicUploadProgress = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          const bar = document.getElementById('music-upload-progress');
          if (bar) bar.style.width = App._musicUploadProgress + '%';
        },
        (err) => {
          console.error('Upload failed:', err);
          showToast('Upload failed: ' + err.message, 'error');
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

  // ─── LOAD USER LIBRARY ───
  window.loadMusicLibrary = async function() {
    if (!App.db || !App.auth?.currentUser) return [];
    const uid = App.auth.currentUser.uid;
    try {
      const snap = await App.db.collection('musicLibrary')
        .where('addedBy', '==', uid)
        .get();
      const tracks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in-memory to avoid requiring a composite index
      tracks.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      App.musicLibrary = tracks;
      return App.musicLibrary;
    } catch(e) {
      console.warn('Load library failed:', e);
      return [];
    }
  };

  // ─── DELETE TRACK ───
  window.deleteMusicTrack = async function(trackId) {
    if (!App.db || !App.auth?.currentUser) return false;
    const track = App.musicLibrary.find(t => t.id === trackId);
    if (!track) return false;
    if (track.addedBy !== App.auth.currentUser.uid) { showToast('Not your track', 'error'); return false; }

    try {
      if (track.storagePath && App.storage) {
        await App.storage.ref(track.storagePath).delete().catch(() => {});
      }
      await App.db.collection('musicLibrary').doc(trackId).delete();
      App.musicLibrary = App.musicLibrary.filter(t => t.id !== trackId);
      showToast('Deleted', 'success');
      return true;
    } catch(e) {
      showToast('Delete failed', 'error');
      return false;
    }
  };

  // ─── EDIT TRACK ───
  window.editMusicTrack = async function(trackId) {
    if (!App.db || !App.auth?.currentUser) return;
    const track = App.musicLibrary.find(t => t.id === trackId);
    if (!track) return;
    if (track.addedBy !== App.auth.currentUser.uid) { showToast('Not your track', 'error'); return; }

    const newTitle = prompt('Edit Title:', track.title);
    if (newTitle === null) return;
    if (!newTitle.trim()) { showToast('Title cannot be empty', 'error'); return; }

    const newArtist = prompt('Edit Artist:', track.artist || '');
    if (newArtist === null) return;

    const newLang = prompt('Edit Language:', track.language || 'Other');
    if (newLang === null) return;

    try {
      const updates = {
        title: newTitle.trim(),
        artist: newArtist.trim(),
        language: newLang.trim()
      };
      await App.db.collection('musicLibrary').doc(trackId).update(updates);
      Object.assign(track, updates);
      showToast('Updated', 'success');
      switchMusicLibTab('my');
    } catch(e) {
      showToast('Update failed', 'error');
    }
  };

  // ─── TOGGLE FAVORITE ───
  window.toggleMusicFavorite = async function(trackId) {
    const track = App.musicLibrary.find(t => t.id === trackId);
    if (!track || !App.db) return;
    track.favorite = !track.favorite;
    try {
      await App.db.collection('musicLibrary').doc(trackId).update({ favorite: track.favorite });
    } catch(_) {}
  };

  // ─── PLAY LIBRARY TRACK ───
  window.playLibraryTrack = function(trackId) {
    const track = App.musicLibrary.find(t => t.id === trackId);
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

  // ─── JAMENDO API (Free CC-licensed music, no auth for streaming) ───
  const JAMENDO_CLIENT_ID = 'b2301a74'; // public Jamendo demo client ID
  const JAMENDO_BASE = 'https://api.jamendo.com/v3.0';

  async function _searchJamendoAPI(query) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 10000);
      const url = `${JAMENDO_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}&search=${encodeURIComponent(query)}&format=json&limit=30&include=musicinfo&audioformat=mp32`;
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      const data = await res.json();
      if (!data || !data.results) return [];
      return data.results.filter(t => t && t.audio).map(t => ({
        id: 'jam_' + t.id,
        title: t.name || 'Untitled',
        artist: t.artist_name || 'Unknown',
        duration: t.duration || 0,
        thumbnail: t.album_image || t.image || null,
        audioUrl: t.audio,
        source: 'jamendo',
        genre: t.musicinfo?.genres?.[0]?.name || '',
        license: 'CC-BY',
      }));
    } catch(e) {
      console.warn('Jamendo search failed:', e);
      return [];
    }
  }

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

  // ─── ARCHIVE.ORG MP3 SEARCH (Mapped to Jamendo names for HTML compatibility) ───
  window.searchJamendo = async function(query, page = 1) {
    if (!query || query.length < 2) return [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const url = `https://archive.org/advancedsearch.php?q=(title:(${encodeURIComponent(query)}) OR creator:(${encodeURIComponent(query)})) AND format:(MP3 OR "VBR MP3")&fl[]=identifier,title,creator,downloads&rows=30&output=json`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      const docs = data.response?.docs || [];
      return docs.map(t => ({
        id: 'arc_' + t.identifier,
        identifier: t.identifier,
        title: t.title || 'Unknown Title',
        artist: t.creator || 'Unknown Artist',
        url: null, // resolved on play/add
        thumbnail: `https://archive.org/services/img/${t.identifier}`,
        duration: 0,
        source: 'archive',
        genre: '',
        language: _guessLanguage((t.title || '') + ' ' + (t.creator || '')),
        license: 'Public Domain / CC',
      }));
    } catch(e) {
      console.warn('Archive search failed:', e);
      return [];
    }
  };

  window.searchJamendoByLanguage = async function(language) {
    const query = `${language} songs`;
    return window.searchJamendo(query);
  };

  window.resolveArchiveTrackUrl = async function(identifier) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const url = `https://archive.org/metadata/${identifier}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      const files = data.files || [];
      const mp3File = files.find(f => f.name.endsWith('.mp3') && (f.format === 'VBR MP3' || f.format === 'MP3'));
      if (mp3File) {
        const downloadUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(mp3File.name)}`;
        let duration = 0;
        if (mp3File.length) {
          const parts = mp3File.length.split(':').map(Number);
          if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
          else if (parts.length === 2) duration = parts[0] * 60 + parts[1];
        }
        return { url: downloadUrl, duration };
      }
      return null;
    } catch(e) {
      console.warn('Failed to resolve Archive file:', e);
      return null;
    }
  };

  function _guessLanguage(text) {
    const lower = (text || '').toLowerCase();
    if (/malayalam|malayali|mollywood|mly/.test(lower)) return 'Malayalam';
    if (/tamil|kollywood|tly/.test(lower)) return 'Tamil';
    if (/telugu|tollywood|tlg/.test(lower)) return 'Telugu';
    if (/hindi|bollywood|hnd/.test(lower)) return 'Hindi';
    if (/kannada|sandalwood/.test(lower)) return 'Kannada';
    if (/bengali|bangla/.test(lower)) return 'Bengali';
    if (/marathi/.test(lower)) return 'Marathi';
    if (/punjabi/.test(lower)) return 'Punjabi';
    return 'Other';
  }

  // ─── YOUTUBE SEARCH (via Invidious — free, no API key) ───
  window.searchYouTubeMusic = async function(query) {
    return searchInvidious(query);
  };

  window.playYouTubeVideo = function(videoId, title) {
    playYouTubeTrack(videoId, title, '', '', 0);
  };

  // ─── CURATED INDIAN MUSIC ───
  window.openMusicLibrary = function() {
    try {
      const existing = document.getElementById('music-library-overlay');
      if (existing) { existing.remove(); return; }

      const overlay = document.createElement('div');
      overlay.id = 'music-library-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Music Library');
      overlay.style.cssText = 'position:fixed !important;inset:0 !important;z-index:9999 !important;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex !important;align-items:flex-end;justify-content:center;transition:all 0.3s ease;';

      const panel = document.createElement('div');
      panel.className = 'music-lib-panel';

      panel.innerHTML = `
        <div style="padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h2 style="margin:0;font-size:18px;font-weight:700;color:var(--on-surface)">Music Library</h2>
            <div style="display:flex;align-items:center;gap:10px">
              <button onclick="openPlaylists(App.currentChat?.id)" style="background:rgba(124,77,255,0.15);border:none;border-radius:12px;padding:6px 12px;color:var(--primary);font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px">
                <span class="material-symbols-outlined" style="font-size:14px">playlist_play</span> Playlists
              </button>
              <button onclick="document.getElementById('music-library-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
            </div>
          </div>
          <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;-ms-overflow-style:none" id="ml-tabs">
            <button class="ml-tab active" onclick="switchMusicLibTab('my')" style="min-height:36px;flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:var(--primary);color:var(--on-primary)">My Music</button>
            <button class="ml-tab" onclick="switchMusicLibTab('upload')" style="min-height:36px;flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:var(--on-surface-variant)">Upload</button>
            <button class="ml-tab" onclick="switchMusicLibTab('search')" style="min-height:36px;flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:var(--on-surface-variant)">Search</button>
            <button class="ml-tab" onclick="switchMusicLibTab('discover')" style="min-height:36px;flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:var(--on-surface-variant)">Discover</button>
            <button class="ml-tab" onclick="switchMusicLibTab('languages')" style="min-height:36px;flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:var(--on-surface-variant)">Languages</button>
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

      switchMusicLibTab('my');
    } catch(err) {
      console.error('[MusicLibrary] openMusicLibrary error:', err);
      if (typeof showToast === 'function') showToast('Failed to open Music Library', 'error');
    }
  };

  // ─── TAB SWITCHING ───
  window.switchMusicLibTab = async function(tab) {
    document.querySelectorAll('.ml-tab').forEach(b => {
      b.style.background = 'rgba(255,255,255,0.06)';
      b.style.color = 'var(--on-surface-variant)';
      b.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.ml-tab[onclick*="'${tab}'"]`);
    if (activeBtn) { activeBtn.style.background = 'var(--primary)'; activeBtn.style.color = 'var(--on-primary)'; activeBtn.classList.add('active'); }

    const content = document.getElementById('music-lib-content');
    if (!content) return;

    if (tab === 'my') await _renderMyMusic(content);
    else if (tab === 'upload') _renderUploadTab(content);
    else if (tab === 'search') _renderSearchTab(content);
    else if (tab === 'discover') await _renderDiscoverTab(content);
    else if (tab === 'languages') _renderLanguagesTab(content);
  };

  // ─── MY MUSIC TAB ───
  async function _renderMyMusic(el) {
    await loadMusicLibrary();
    const tracks = App.musicLibrary;
    if (!tracks.length) {
      el.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--on-surface-variant)">
          <div style="font-size:48px;margin-bottom:12px">🎶</div>
          <p style="font-size:14px;font-weight:600;margin-bottom:4px">Your library is empty</p>
          <p style="font-size:12px;margin-bottom:16px">Upload your songs or discover free music</p>
          <button onclick="switchMusicLibTab('upload')" style="padding:10px 24px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Upload Music</button>
        </div>`;
      return;
    }

    let html = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <input type="search" placeholder="Search my music..." oninput="filterMyMusic(this.value)" style="flex:1;min-width:0;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:13px;outline:none">
        <select id="ml-lang-filter" onchange="filterMyMusicByLang(this.value)" style="max-width:120px;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:12px;margin-right:4px;">
          <option value="">All Languages</option>
          ${LANGUAGES.map(l => `<option value="${l}">${l}</option>`).join('')}
        </select>
        <button onclick="switchMusicLibTab('upload')" style="min-height:44px;flex-shrink:0;padding:8px 14px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">
          <span class="material-symbols-outlined" style="font-size:16px;">add</span> Add
        </button>
      </div>
      <div id="my-music-list">`;
    tracks.forEach((t, i) => {
      html += _trackRow(t, i);
    });
    html += '</div>';
    el.innerHTML = html;
  }

  window.filterMyMusic = function(q) {
    const lower = q.toLowerCase();
    const filtered = App.musicLibrary.filter(t => t.title.toLowerCase().includes(lower) || t.artist.toLowerCase().includes(lower));
    const list = document.getElementById('my-music-list');
    if (list) list.innerHTML = filtered.map((t, i) => _trackRow(t, i)).join('');
  };

  window.filterMyMusicByLang = function(lang) {
    const filtered = lang ? App.musicLibrary.filter(t => t.language === lang) : App.musicLibrary;
    const list = document.getElementById('my-music-list');
    if (list) list.innerHTML = filtered.map((t, i) => _trackRow(t, i)).join('');
  };

  function _trackRow(t, i) {
    const isPlaying = MusicPlayer?._currentTrack?.id === t.id;
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:${isPlaying ? 'rgba(124,77,255,0.1)' : 'rgba(255,255,255,0.03)'};margin-bottom:6px;cursor:pointer" onclick="playLibraryTrack('${t.id}')">
      <div style="width:42px;height:42px;border-radius:8px;background:linear-gradient(135deg,rgba(124,77,255,0.2),rgba(74,0,224,0.1));display:flex;align-items:center;justify-content:center;flex-shrink:0">
        ${t.thumbnail ? `<img src="${t.thumbnail}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">` : `<span style="font-size:18px">🎵</span>`}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title)}</div>
        <div style="font-size:11px;color:var(--on-surface-variant);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.artist)} · ${t.language}</div>
      </div>
      <div style="display:flex;gap:4px">
        <button onclick="event.stopPropagation();toggleMusicFavorite('${t.id}');switchMusicLibTab('my')" style="background:none;border:none;cursor:pointer;padding:8px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:16px">${t.favorite ? '❤️' : '🤍'}</button>
        ${t.addedBy === App.auth?.currentUser?.uid ? `<button onclick="event.stopPropagation();editMusicTrack('${t.id}')" style="background:none;border:none;cursor:pointer;padding:8px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;opacity:0.5" title="Edit">✏️</button>` : ''}
        ${t.addedBy === App.auth?.currentUser?.uid ? `<button onclick="event.stopPropagation();deleteMusicTrack('${t.id}').then(()=>switchMusicLibTab('my'))" style="background:none;border:none;cursor:pointer;padding:8px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;opacity:0.5" title="Delete">🗑️</button>` : ''}
      </div>
    </div>`;
  }

  // ─── UPLOAD TAB ───
  function _renderUploadTab(el) {
    el.innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div style="border:2px dashed rgba(255,255,255,0.15);border-radius:16px;padding:32px 20px;margin-bottom:16px;cursor:pointer;transition:all 0.2s" id="upload-drop-zone" onclick="document.getElementById('music-file-input').click()" ondragover="event.preventDefault();this.style.borderColor='var(--primary)'" ondragleave="this.style.borderColor='rgba(255,255,255,0.15)'" ondrop="event.preventDefault();this.style.borderColor='rgba(255,255,255,0.15)';handleMusicFileDrop(event)">
          <div style="font-size:40px;margin-bottom:8px">📁</div>
          <p style="font-size:13px;font-weight:600;color:var(--on-surface);margin:0">Tap to select audio files</p>
          <p style="font-size:11px;color:var(--on-surface-variant);margin:4px 0 0">MP3, WAV, OGG, M4A supported</p>
          <input type="file" id="music-file-input" accept="audio/*" multiple style="display:none" onchange="handleMusicFileSelect(event)">
        </div>
        <div id="upload-progress-container" style="display:none;margin-bottom:16px">
          <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden">
            <div id="music-upload-progress" style="height:100%;background:var(--primary);width:0%;transition:width 0.3s"></div>
          </div>
          <p id="upload-status-text" style="font-size:11px;color:var(--on-surface-variant);margin-top:4px">Uploading...</p>
        </div>
        <div id="upload-form" style="display:none;text-align:left">
          <div style="margin-bottom:12px">
            <label style="font-size:11px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">TITLE</label>
            <input id="upload-title" type="text" placeholder="Song title" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:13px;box-sizing:border-box">
          </div>
          <div style="margin-bottom:12px">
            <label style="font-size:11px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">ARTIST</label>
            <input id="upload-artist" type="text" placeholder="Artist name" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:13px;box-sizing:border-box">
          </div>
          <div style="margin-bottom:12px">
            <label style="font-size:11px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">LANGUAGE</label>
            <select id="upload-language" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:13px">
              ${LANGUAGES.map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
          <button onclick="submitMusicUpload()" style="width:100%;padding:12px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Upload to Library</button>
        </div>
      </div>`;
  }

  window.handleMusicFileSelect = function(e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    _prepareUpload(files[0]);
  };

  window.handleMusicFileDrop = function(e) {
    const files = e.dataTransfer.files;
    if (!files || !files.length) return;
    _prepareUpload(files[0]);
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
      dropZone.innerHTML = `<div style="font-size:32px;margin-bottom:4px">🎵</div><p style="font-size:12px;font-weight:600;color:var(--primary)">${file.name}</p><p style="font-size:10px;color:var(--on-surface-variant)">${(file.size / (1024*1024)).toFixed(1)} MB</p>`;
      dropZone.onclick = null;
    }
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
    if (track) {
      switchMusicLibTab('my');
    }
  };

  // ─── SEARCH TAB (YouTube via Piped+Invidious + Archive.org) ───
  const YT_CATEGORIES = [
    { lang: 'Malayalam', color: '#FF6B35', queries: ['Malayalam songs', 'Malayalam old hits', 'Malayalam new 2025', 'Malayalam devotional', 'Malayalam romantic', 'Mollywood songs'] },
    { lang: 'Hindi', color: '#FF9800', queries: ['Hindi songs', 'Hindi old hits', 'Bollywood 2025', 'Hindi devotional', 'Hindi romantic', 'Hindi classical'] },
    { lang: 'Tamil', color: '#E91E63', queries: ['Tamil songs', 'Tamil old hits', 'Tamil new 2025', 'Tamil devotional', 'Tamil romantic', 'Kollywood songs'] },
    { lang: 'Telugu', color: '#9C27B0', queries: ['Telugu songs', 'Telugu old hits', 'Telugu new 2025', 'Telugu devotional', 'Telugu romantic', 'Tollywood songs'] },
  ];

  function _renderSearchTab(el) {
    const hist = _getSearchHistory();
    el.innerHTML = `
      <div style="margin-bottom:12px">
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input type="search" id="yt-search-input" placeholder="Search any song on YouTube..." style="flex:1;min-width:0;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:13px;outline:none" onkeydown="if(event.key==='Enter')doYouTubeSearch()">
          <button onclick="doYouTubeSearch()" style="min-height:44px;flex-shrink:0;padding:10px 18px;border-radius:12px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:700;cursor:pointer">Search</button>
          <button onclick="toggleSearchFilters()" id="yt-filter-toggle" style="padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface-variant);font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;min-width:44px;min-height:44px;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px">tune</span><span class="filter-label">Filters</span></button>
        </div>
        <div id="yt-filter-panel" style="display:none;margin-bottom:10px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:120px">
              <label style="font-size:10px;font-weight:700;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Duration</label>
              <select id="yt-filter-duration" onchange="updateSearchFilter('duration',this.value)" style="width:100%;padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:12px">
                <option value="all"${_ytFilterDuration === 'all' ? ' selected' : ''}>All</option>
                <option value="short"${_ytFilterDuration === 'short' ? ' selected' : ''}>Short (&lt;4min)</option>
                <option value="medium"${_ytFilterDuration === 'medium' ? ' selected' : ''}>Medium (4-20min)</option>
                <option value="long"${_ytFilterDuration === 'long' ? ' selected' : ''}>Long (&gt;20min)</option>
              </select>
            </div>
            <div style="flex:1;min-width:120px">
              <label style="font-size:10px;font-weight:700;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Sort By</label>
              <select id="yt-filter-sort" onchange="updateSearchFilter('sort',this.value)" style="width:100%;padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:12px">
                <option value="relevance"${_ytFilterSort === 'relevance' ? ' selected' : ''}>Relevance</option>
                <option value="views"${_ytFilterSort === 'views' ? ' selected' : ''}>View Count</option>
                <option value="date"${_ytFilterSort === 'date' ? ' selected' : ''}>Date (newest)</option>
              </select>
            </div>
            <div style="flex:1;min-width:120px">
              <label style="font-size:10px;font-weight:700;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Language</label>
              <select id="yt-filter-lang" onchange="updateSearchFilter('lang',this.value)" style="width:100%;padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:12px">
                <option value="all"${_ytFilterLang === 'all' ? ' selected' : ''}>All</option>
                <option value="malayalam"${_ytFilterLang === 'malayalam' ? ' selected' : ''}>Malayalam</option>
                <option value="hindi"${_ytFilterLang === 'hindi' ? ' selected' : ''}>Hindi</option>
                <option value="tamil"${_ytFilterLang === 'tamil' ? ' selected' : ''}>Tamil</option>
                <option value="telugu"${_ytFilterLang === 'telugu' ? ' selected' : ''}>Telugu</option>
                <option value="english"${_ytFilterLang === 'english' ? ' selected' : ''}>English</option>
              </select>
            </div>
          </div>
          <div style="margin-top:8px;text-align:right">
            <button onclick="resetSearchFilters()" style="padding:5px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--on-surface-variant);font-size:11px;cursor:pointer">Reset Filters</button>
          </div>
        </div>
        ${hist.length ? `
        <div id="yt-search-history" style="margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:10px;font-weight:700;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:1px">Recent</span>
            <button onclick="_clearSearchHistory()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:10px">Clear</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${hist.map(h => `<button onclick="document.getElementById('yt-search-input').value='${escHtml(h).replace(/'/g, "\\'")}';doYouTubeSearch()" style="padding:5px 10px;border-radius:16px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--on-surface-variant);font-size:11px;cursor:pointer">${escHtml(h)}</button>`).join('')}
          </div>
        </div>` : '<div id="yt-search-history"></div>'}
      </div>
      <div id="yt-search-results" style="margin-bottom:16px"></div>
      <div style="font-size:11px;font-weight:700;color:var(--on-surface-variant);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">Browse by Language</div>
      ${YT_CATEGORIES.map(cat => `
        <div style="margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="width:36px;height:36px;border-radius:10px;background:${cat.color}20;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:${cat.color}">${cat.lang[0]}</div>
            <div style="font-size:14px;font-weight:700;color:var(--on-surface)">${cat.lang}</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${cat.queries.map(q => `
              <button onclick="doYouTubeSearchFor('${q.replace(/'/g, "\\'")}')" style="padding:6px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--on-surface-variant);font-size:11px;cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='${cat.color}';this.style.color='${cat.color}'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)';this.style.color='var(--on-surface-variant)'">${q.replace(cat.lang + ' ', '')}</button>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <div style="margin-top:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05)">
        <div style="font-size:11px;font-weight:700;color:var(--on-surface-variant);margin-bottom:6px">Direct Stream (Archive.org)</div>
        <p style="font-size:11px;color:var(--on-surface-variant);margin:0 0 8px">Public domain & Creative Commons — plays in background</p>
        <div style="display:flex;gap:8px">
          <input type="search" id="archive-search-input" placeholder="Search Archive.org..." style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:12px;outline:none" onkeydown="if(event.key==='Enter')doArchiveSearch()">
          <button onclick="doArchiveSearch()" style="padding:8px 14px;border-radius:10px;border:none;background:rgba(124,77,255,0.15);color:var(--primary);font-size:11px;font-weight:600;cursor:pointer">Search</button>
        </div>
        <div id="archive-search-results" style="margin-top:8px"></div>
      </div>
      <div style="margin-top:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05)">
        <div style="font-size:11px;font-weight:700;color:var(--on-surface-variant);margin-bottom:6px">YouTube Playlist Import</div>
        <p style="font-size:11px;color:var(--on-surface-variant);margin:0 0 8px">Paste a YouTube playlist URL to import all tracks</p>
        <div style="display:flex;gap:8px">
          <input type="text" id="yt-playlist-url-input" placeholder="https://youtube.com/playlist?list=..." style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:12px;outline:none">
          <button onclick="doYouTubePlaylistImport()" style="padding:8px 14px;border-radius:10px;border:none;background:rgba(124,77,255,0.15);color:var(--primary);font-size:11px;font-weight:600;cursor:pointer">Import</button>
        </div>
        <div id="yt-playlist-import-results" style="margin-top:8px"></div>
      </div>`;
  }

  window.doYouTubeSearch = function() {
    const q = document.getElementById('yt-search-input')?.value;
    if (!q || q.length < 2) return;
    _addSearchHistory(q);
    _doInvidiousSearch(q, document.getElementById('yt-search-results'));
  };

  window.doYouTubeSearchFor = function(q) {
    _addSearchHistory(q);
    _doInvidiousSearch(q, document.getElementById('yt-search-results'));
  };

  // ─── SEARCH FILTER CONTROLS ───
  window.toggleSearchFilters = function() {
    const panel = document.getElementById('yt-filter-panel');
    if (!panel) return;
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    const btn = document.getElementById('yt-filter-toggle');
    if (btn) {
      const hasFilters = _ytFilterDuration !== 'all' || _ytFilterSort !== 'relevance' || _ytFilterLang !== 'all';
      btn.style.borderColor = (!isVisible && hasFilters) ? 'var(--primary)' : 'rgba(255,255,255,0.1)';
      btn.style.color = (!isVisible && hasFilters) ? 'var(--primary)' : 'var(--on-surface-variant)';
    }
  };

  window.updateSearchFilter = function(type, value) {
    if (type === 'duration') _ytFilterDuration = value;
    else if (type === 'sort') _ytFilterSort = value;
    else if (type === 'lang') _ytFilterLang = value;
  };

  window.resetSearchFilters = function() {
    _ytFilterDuration = 'all';
    _ytFilterSort = 'relevance';
    _ytFilterLang = 'all';
    const d = document.getElementById('yt-filter-duration');
    const s = document.getElementById('yt-filter-sort');
    const l = document.getElementById('yt-filter-lang');
    if (d) d.value = 'all';
    if (s) s.value = 'relevance';
    if (l) l.value = 'all';
  };

  function _applySearchFilters(results) {
    let out = results.slice();
    // Duration filter
    if (_ytFilterDuration === 'short') out = out.filter(r => r.duration > 0 && r.duration < 240);
    else if (_ytFilterDuration === 'medium') out = out.filter(r => r.duration >= 240 && r.duration <= 1200);
    else if (_ytFilterDuration === 'long') out = out.filter(r => r.duration > 1200);
    // Language filter
    if (_ytFilterLang !== 'all') {
      const langName = _ytFilterLang.charAt(0).toUpperCase() + _ytFilterLang.slice(1);
      out = out.filter(r => {
        const text = ((r.title || '') + ' ' + (r.artist || '')).toLowerCase();
        return text.includes(_ytFilterLang.toLowerCase()) || text.includes(langName.toLowerCase());
      });
    }
    // Sort
    if (_ytFilterSort === 'views') out.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    else if (_ytFilterSort === 'date') out.sort((a, b) => {
      const parseRecency = (txt) => {
        if (!txt) return 0;
        const t = txt.toLowerCase();
        if (t.includes('minute') || t.includes('hour') || t.includes('just') || t.includes('second')) return 5;
        if (t.includes('day')) return 4;
        if (t.includes('week')) return 3;
        if (t.includes('month')) return 2;
        if (t.includes('year')) return 1;
        return 0;
      };
      return parseRecency(b.publishedText) - parseRecency(a.publishedText);
    });
    return out;
  }

  window.doArchiveSearch = function() {
    const q = document.getElementById('archive-search-input')?.value;
    if (!q || q.length < 2) return;
    _doArchiveSearch(q);
  };

  window.doYouTubePlaylistImport = async function() {
    const url = document.getElementById('yt-playlist-url-input')?.value;
    if (!url) { showToast('Paste a YouTube playlist URL', 'error'); return; }
    const el = document.getElementById('yt-playlist-import-results');
    if (!el) return;
    el.innerHTML = `
      <div style="text-align:center;padding:16px">
        <span class="material-symbols-outlined animate-spin" style="color:var(--primary);font-size:24px">progress_activity</span>
        <p style="color:var(--on-surface-variant);font-size:11px;margin-top:8px">Loading playlist...</p>
      </div>`;
    const tracks = await fetchYouTubePlaylist(url);
    if (!tracks.length) {
      el.innerHTML = '<p style="text-align:center;font-size:12px;color:var(--on-surface-variant);padding:12px">No tracks found. Check the URL and try again.</p>';
      return;
    }
    tracks.forEach(t => { _trackCache[t.id] = t; });
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:11px;font-weight:700;color:var(--primary)">${tracks.length} tracks found</span>
        <button onclick="playAllPlaylistTracks()" style="padding:5px 10px;border-radius:8px;border:none;background:var(--primary);color:var(--on-primary);font-size:10px;font-weight:700;cursor:pointer">Play All</button>
      </div>
      ${tracks.map((t, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px;border-radius:10px;background:rgba(255,255,255,0.03);margin-bottom:3px;cursor:pointer" onclick="playYouTubeTrack('${t.videoId}','${escHtml(t.title).replace(/'/g, "\\'")}','${escHtml(t.artist).replace(/'/g, "\\'")}','${escHtml(t.thumbnail).replace(/'/g, "\\'")}',${t.duration})">
          <div style="width:18px;font-size:10px;color:var(--on-surface-variant);text-align:center;flex-shrink:0">${i + 1}</div>
          <div style="width:36px;height:36px;border-radius:6px;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
            <img src="${escHtml(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'" loading="lazy">
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title)}</div>
            <div style="font-size:10px;color:var(--on-surface-variant)">${escHtml(t.artist)}${t.duration ? ' · ' + formatTrackDuration(t.duration) : ''}</div>
          </div>
          <button onclick="event.stopPropagation();MusicPlayer.addToQueue(_trackCache['${t.id}']);showToast('Added to queue','success')" style="background:rgba(124,77,255,0.15);border:none;border-radius:6px;padding:3px 6px;min-height:32px;color:var(--primary);font-size:10px;font-weight:600;cursor:pointer;flex-shrink:0">+ Q</button>
        </div>`).join('')}`;
  };

  window.playAllPlaylistTracks = function() {
    const el = document.getElementById('yt-playlist-import-results');
    if (!el) return;
    const items = el.querySelectorAll('[onclick*="playYouTubeTrack"]');
    if (!items.length) return;
    items[0]?.click();
    for (let i = 1; i < items.length; i++) {
      const match = items[i].getAttribute('onclick')?.match(/playYouTubeTrack\('([^']+)','([^']*)','([^']*)','([^']*)',(\d+)\)/);
      if (match) {
        const t = { id: 'yt_' + match[1], videoId: match[1], title: match[2] || 'YouTube', artist: match[3] || 'YouTube', thumbnail: match[4] || null, duration: parseInt(match[5]) || 0, source: 'youtube' };
        _trackCache[t.id] = t;
        MusicPlayer.addToQueue(t);
      }
    }
    showToast('Added all tracks to queue', 'success');
  };

  async function _doArchiveSearch(q) {
    const el = document.getElementById('archive-search-results');
    if (!el) return;
    el.innerHTML = '<p style="text-align:center;font-size:11px;color:var(--on-surface-variant)">Searching...</p>';
    const results = await searchJamendo(q);
    if (!results.length) {
      el.innerHTML = '<p style="text-align:center;font-size:11px;color:var(--on-surface-variant)">No results</p>';
      return;
    }
    results.forEach(t => { _trackCache[t.id] = t; });
    el.innerHTML = results.slice(0, 10).map(t => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:10px;background:rgba(255,255,255,0.03);margin-bottom:4px;cursor:pointer" onclick="playCachedTrack('${t.id}')">
        <div style="width:36px;height:36px;border-radius:6px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
          ${t.thumbnail ? `<img src="${escHtml(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover">` : '<span class="material-symbols-outlined" style="font-size:14px;color:var(--on-surface-variant)">music_note</span>'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title)}</div>
          <div style="font-size:10px;color:var(--on-surface-variant)">${escHtml(t.artist)}</div>
        </div>
        <button onclick="event.stopPropagation();addCachedTrackToLibrary('${t.id}')" style="background:rgba(124,77,255,0.15);border:none;border-radius:6px;padding:4px 8px;min-height:32px;color:var(--primary);font-size:10px;font-weight:600;cursor:pointer">+ Add</button>
      </div>`).join('');
  }

  async function _doInvidiousSearch(query, container) {
    if (!container) return;
    container.innerHTML = `
      <div style="text-align:center;padding:20px">
        <span class="material-symbols-outlined animate-spin" style="color:var(--primary);font-size:24px">progress_activity</span>
        <p style="color:var(--on-surface-variant);font-size:11px;margin-top:8px">Searching YouTube for "${escHtml(query)}"...</p>
      </div>`;

    const results = await searchInvidious(query);
    const filtered = _applySearchFilters(results);

    if (!filtered.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:16px">
          <p style="color:var(--on-surface-variant);font-size:12px;margin:0 0 8px">${results.length ? 'No results match current filters' : 'No results found'}</p>
          ${results.length ? '<button onclick="resetSearchFilters();doYouTubeSearch()" style="padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--on-surface-variant);font-size:11px;cursor:pointer;margin-bottom:8px">Reset Filters & Retry</button>' : ''}
          <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' song')}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;background:rgba(255,0,0,0.1);color:#ff4444;font-size:12px;font-weight:600;text-decoration:none">
            <span class="material-symbols-outlined" style="font-size:16px">open_in_new</span> Search on YouTube
          </a>
        </div>`;
      return;
    }

    filtered.forEach(t => { _trackCache[t.id] = t; });

    container.innerHTML = filtered.map(t => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;background:rgba(255,255,255,0.03);margin-bottom:4px;cursor:pointer" onclick="playYouTubeTrack('${t.videoId}','${escHtml(t.title).replace(/'/g, "\\'")}','${escHtml(t.artist).replace(/'/g, "\\'")}','${escHtml(t.thumbnail).replace(/'/g, "\\'")}',${t.duration})">
        <div style="width:48px;height:36px;border-radius:6px;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
          <img src="${escHtml(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" loading="lazy">
          <span class="material-symbols-outlined" style="font-size:16px;color:var(--on-surface-variant);display:none">play_circle</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title)}</div>
          <div style="font-size:10px;color:var(--on-surface-variant)">${escHtml(t.artist)}${t.duration ? ' · ' + formatTrackDuration(t.duration) : ''}</div>
        </div>
        <button onclick="event.stopPropagation();MusicPlayer.addToQueue(_trackCache['${t.id}']);showToast('Added to queue','success')" style="background:rgba(124,77,255,0.15);border:none;border-radius:6px;padding:4px 8px;color:var(--primary);font-size:10px;font-weight:600;cursor:pointer;flex-shrink:0" title="Add to queue">+ Q</button>
      </div>`).join('');
  }

  window.playCachedTrack = async function(trackId) {
    const t = _trackCache[trackId];
    if (!t) return;
    
    if (t.source === 'archive' && !t.url) {
      showToast('Resolving audio link...', 'info');
      const res = await window.resolveArchiveTrackUrl(t.identifier);
      if (res) {
        t.url = res.url;
        t.duration = res.duration;
      } else {
        showToast('Could not resolve audio link', 'error');
        return;
      }
    }
    
    if (t.source === 'youtube' && t.videoId) {
      playYouTubeTrack(t.videoId, t.title, t.artist, t.thumbnail, t.duration);
      return;
    }

    MusicPlayer.play({ id: t.id, title: t.title, artist: t.artist, url: t.url, thumbnail: t.thumbnail || null, duration: t.duration, source: t.source });
  };

  window.addCachedTrackToLibrary = async function(trackId) {
    const t = _trackCache[trackId];
    if (!t) return;

    if (t.source === 'archive' && !t.url) {
      showToast('Resolving audio link...', 'info');
      const res = await window.resolveArchiveTrackUrl(t.identifier);
      if (res) {
        t.url = res.url;
        t.duration = res.duration;
      } else {
        showToast('Could not resolve audio link', 'error');
        return;
      }
    }
    
    addToLibraryFromJamendo(t.id, t.url, t.title, t.artist, t.thumbnail, t.duration, t.language, t.source);
  };

  window.addToLibraryFromJamendo = async function(id, url, title, artist, thumb, dur, lang, source = 'jamendo') {
    if (!App.db || !App.auth?.currentUser) { showToast('Sign in required', 'error'); return; }
    const uid = App.auth.currentUser.uid;
    const track = {
      id: 'mt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      title, artist,
      language: lang || 'Other',
      url, thumbnail: thumb || null,
      duration: dur,
      source: source || 'jamendo',
      addedBy: uid,
      addedByName: App.currentUser?.displayName || 'User',
      addedAt: Date.now(),
      playCount: 0,
      favorite: false,
    };
    try {
      await App.db.collection('musicLibrary').doc(track.id).set(track);
      App.musicLibrary.unshift(track);
      showToast('Added: ' + title, 'success');
    } catch(e) { showToast('Failed to add', 'error'); }
  };

  // ─── DISCOVER TAB ───
  function _renderDiscoverTrackCard(t) {
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;background:rgba(255,255,255,0.03);margin-bottom:4px;cursor:pointer" onclick="playYouTubeTrack('${t.videoId}','${escHtml(t.title).replace(/'/g, "\\'")}','${escHtml(t.artist).replace(/'/g, "\\'")}','${escHtml(t.thumbnail).replace(/'/g, "\\'")}',${t.duration})">
        <div style="width:48px;height:36px;border-radius:6px;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
          <img src="${escHtml(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" loading="lazy">
          <span class="material-symbols-outlined" style="font-size:16px;color:var(--on-surface-variant);display:none">play_circle</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title)}</div>
          <div style="font-size:10px;color:var(--on-surface-variant)">${escHtml(t.artist)}${t.duration ? ' · ' + formatTrackDuration(t.duration) : ''}</div>
        </div>
        <button onclick="event.stopPropagation();MusicPlayer.addToQueue(_trackCache['${t.id}']);showToast('Added to queue','success')" style="background:rgba(124,77,255,0.15);border:none;border-radius:6px;padding:4px 8px;color:var(--primary);font-size:10px;font-weight:600;cursor:pointer;flex-shrink:0" title="Add to queue">+ Q</button>
      </div>`;
  }

  function _discoverSpinner() {
    return `<div style="text-align:center;padding:20px">
      <span class="material-symbols-outlined animate-spin" style="color:var(--primary);font-size:24px">progress_activity</span>
      <p style="color:var(--on-surface-variant);font-size:11px;margin-top:8px">Fetching live results...</p>
    </div>`;
  }

  async function _fetchDiscoverSection(sectionId, queries) {
    const container = document.getElementById(sectionId);
    if (!container) return;
    container.innerHTML = _discoverSpinner();

    let allResults = [];
    const seen = new Set();
    for (const q of queries) {
      try {
        const results = await searchInvidious(q);
        for (const t of results) {
          if (!seen.has(t.id)) { seen.add(t.id); allResults.push(t); _trackCache[t.id] = t; }
        }
      } catch(_) {}
    }

    if (!allResults.length) {
      container.innerHTML = '<p style="text-align:center;font-size:11px;color:var(--on-surface-variant);padding:12px">No results found</p>';
      return;
    }

    container.innerHTML = allResults.slice(0, 15).map(t => _renderDiscoverTrackCard(t)).join('');
  }

  async function _renderDiscoverTab(el) {
    const sections = [
      {
        title: 'Trending Now',
        icon: 'trending_up',
        color: '#FF6B35',
        id: 'discover-trending',
        queries: ['Trending songs 2025', 'Viral songs India'],
      },
      {
        title: 'New Releases',
        icon: 'new_releases',
        color: '#E91E63',
        id: 'discover-new',
        queries: ['New music releases 2025', 'Latest hits 2025'],
      },
      {
        title: 'Top Charts',
        icon: 'emoji_events',
        color: '#FFD700',
        id: 'discover-charts',
        queries: ['Top songs India 2025', 'Most popular songs'],
      },
    ];

    let html = '';
    sections.forEach(sec => {
      html += `
        <div style="margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <div style="width:32px;height:32px;border-radius:8px;background:${sec.color}20;display:flex;align-items:center;justify-content:center">
              <span class="material-symbols-outlined" style="font-size:18px;color:${sec.color}">${sec.icon}</span>
            </div>
            <span style="font-size:14px;font-weight:700;color:var(--on-surface)">${sec.title}</span>
            <div style="flex:1"></div>
            <button onclick="_fetchDiscoverSection('${sec.id}',${JSON.stringify(sec.queries).replace(/"/g, '&quot;')})" style="padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface-variant);font-size:10px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px">
              <span class="material-symbols-outlined" style="font-size:13px">refresh</span>Refresh
            </button>
          </div>
          <div id="${sec.id}">${_discoverSpinner()}</div>
        </div>`;
    });

    el.innerHTML = `
      <div style="margin-bottom:12px">
        <p style="font-size:12px;color:var(--on-surface-variant);margin:0 0 16px">Live trending music — results fetched in real time</p>
        ${html}
      </div>`;

    sections.forEach(sec => _fetchDiscoverSection(sec.id, sec.queries));
  }

  // ─── LANGUAGES TAB (YouTube-powered) ───
  function _renderLanguagesTab(el) {
    const colors = {
      'Malayalam': '#FF6B35', 'Tamil': '#E91E63', 'Telugu': '#9C27B0',
      'Hindi': '#FF9800', 'Kannada': '#4CAF50', 'Bengali': '#2196F3',
      'Marathi': '#00BCD4', 'Punjabi': '#FF5722', 'English': '#607D8B', 'Other': '#78909C',
    };
    let html = '<p style="font-size:12px;color:var(--on-surface-variant);margin-bottom:12px">Browse music by language via YouTube</p>';
    LANGUAGES.forEach(lang => {
      html += `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);margin-bottom:6px;cursor:pointer" onclick="browseLanguageYT('${lang}')">
          <div style="width:42px;height:42px;border-radius:10px;background:${colors[lang] || '#666'}20;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:${colors[lang]}">${lang[0]}</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--on-surface)">${lang}</div>
            <div style="font-size:11px;color:var(--on-surface-variant)">Browse ${lang} songs on YouTube</div>
          </div>
          <span class="material-symbols-outlined" style="color:var(--on-surface-variant);font-size:18px">chevron_right</span>
        </div>`;
    });
    el.innerHTML = html;
  }

  window.browseLanguageYT = function(lang) {
    switchMusicLibTab('search');
    setTimeout(() => {
      const input = document.getElementById('yt-search-input');
      if (input) { input.value = lang + ' songs'; }
      _addSearchHistory(lang + ' songs');
      _doInvidiousSearch(lang + ' songs', document.getElementById('yt-search-results'));
    }, 100);
  };

  window.browseLanguageMusic = function(lang) {
    browseLanguageYT(lang);
  };

  // ─── RECENTLY PLAYED QUICK ACCESS ───
  window.showRecentlyPlayed = function() {
    const existing = document.getElementById('recently-played-overlay');
    if (existing) { existing.remove(); return; }

    let recent = [];
    try { recent = JSON.parse(localStorage.getItem('nsl_recent_tracks') || '[]'); } catch(_) {}

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
        ${recent.map((t, i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;background:rgba(255,255,255,0.02);margin-bottom:4px;cursor:pointer" onclick="document.getElementById('recently-played-overlay')?.remove();playCachedTrack('${t.id}')">
            <div style="width:40px;height:40px;border-radius:8px;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,0.05)">
              ${t.thumbnail ? `<img src="${escHtml(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px;color:var(--on-surface-variant)">music_note</span></div>'}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title || 'Unknown')}</div>
              <div style="font-size:10px;color:var(--on-surface-variant)">${escHtml(t.artist || 'Unknown')}</div>
            </div>
            <button onclick="event.stopPropagation();MusicPlayer.addToQueue(_trackCache['${t.id}'] || ${JSON.stringify(t).replace(/'/g, "\\'")});showToast('Added to queue','success')" style="background:rgba(124,77,255,0.15);border:none;border-radius:6px;padding:4px 8px;min-height:32px;color:var(--primary);font-size:10px;font-weight:600;cursor:pointer">+ Q</button>
          </div>
        `).join('')}
      </div>`;
    }

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  // ─── ONBOARDING ───
  const _ONBOARD_KEY = 'nsl_music_onboarded';

  window.checkMusicOnboarding = function() {
    if (localStorage.getItem(_ONBOARD_KEY)) return;
    setTimeout(() => showMusicOnboarding(), 2000);
  };

  window.showMusicOnboarding = function() {
    if (document.getElementById('onboarding-overlay')) return;

    const steps = [
      { icon: 'music_note', title: 'Welcome to Music!', desc: 'Search YouTube, upload your songs, or browse free music from Archive.org' },
      { icon: 'search', title: 'Search Any Song', desc: 'Find any song on YouTube using our built-in search. Supports all languages!' },
      { icon: 'library_music', title: 'Your Library', desc: 'Upload your own MP3s, create playlists, and organize by language' },
      { icon: 'group', title: 'Listening Rooms', desc: 'Listen together in real-time with friends. Share your music taste!' },
      { icon: 'download', title: 'Background Play', desc: 'Music keeps playing even when you switch apps or lock your phone' },
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
            ${steps.map((_, i) => `<div style="width:${i===step?'20px':'6px'};height:6px;border-radius:3px;background:${i===step?'var(--primary)':'rgba(255,255,255,0.2)'};transition:all 0.3s"></div>`).join('')}
          </div>
          <div style="display:flex;gap:8px">
            ${step < steps.length - 1 ? `<button onclick="document.getElementById('onboarding-overlay')?.remove()" style="flex:1;padding:12px;border-radius:12px;border:none;background:rgba(255,255,255,0.06);color:var(--on-surface-variant);font-size:13px;font-weight:600;cursor:pointer">Skip</button>` : ''}
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
      localStorage.setItem(_ONBOARD_KEY, 'true');
      document.getElementById('onboarding-overlay')?.remove();
    };

    renderStep();
  };

  checkMusicOnboarding();

})();
