// Music Library — user uploads, Archive.org free music, YouTube via Invidious, language filters
(function() {
  'use strict';

  // ─── STATE ───
  App.musicLibrary = [];
  App._musicUploadProgress = 0;
  const LANGUAGES = ['Malayalam','Tamil','Telugu','Hindi','Kannada','Bengali','Marathi','Punjabi','English','Other'];
  const _trackCache = {};

  // ─── INVIDIOUS YOUTUBE API (100% free, no API key) ───
  const INV_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.jing.rocks',
    'https://vid.puffyan.us',
    'https://yewtu.be',
    'https://iv.ggtyler.dev',
    'https://invidious.privacyredirect.com',
  ];
  let _workingInstance = null;

  async function _invFetch(path, timeout) {
    const instances = _workingInstance
      ? [_workingInstance, ...INV_INSTANCES.filter(i => i !== _workingInstance)]
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
        _workingInstance = inst;
        return data;
      } catch(_) { continue; }
    }
    return null;
  }

  window.searchInvidious = async function(query) {
    if (!query || query.length < 2) return [];
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
  };

  window.getYouTubeAudioUrl = async function(videoId) {
    if (!videoId) return null;
    const data = await _invFetch('/api/v1/videos/' + videoId + '?fields=adaptiveFormats,title,author', 12000);
    if (!data || !data.adaptiveFormats) return null;
    const audio = data.adaptiveFormats
      .filter(f => f.type && f.type.startsWith('audio/'))
      .sort((a, b) => (b.audioBitrate || b.bitrate || 0) - (a.audioBitrate || a.bitrate || 0));
    if (audio.length && audio[0].url) return audio[0].url;
    return null;
  };

  window.playYouTubeTrack = async function(videoId, title, artist, thumbnail, duration) {
    if (!videoId) return;
    showToast('Loading audio...', 'info');
    const audioUrl = await getYouTubeAudioUrl(videoId);
    if (!audioUrl) {
      showToast('Audio unavailable — opening YouTube', 'info');
      window.open('https://www.youtube.com/watch?v=' + videoId, '_blank');
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
        <div style="padding:16px 16px 0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h2 style="margin:0;font-size:18px;font-weight:700;color:var(--on-surface)">Music Library</h2>
            <div style="display:flex;align-items:center;gap:10px">
              <button onclick="openPlaylists(App.currentChat?.id)" style="background:rgba(124,77,255,0.15);border:none;border-radius:12px;padding:6px 12px;color:var(--primary);font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px">
                <span class="material-symbols-outlined" style="font-size:14px">playlist_play</span> Playlists
              </button>
              <button onclick="document.getElementById('music-library-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
            </div>
          </div>
          <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px" id="ml-tabs">
            <button class="ml-tab active" onclick="switchMusicLibTab('my')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:var(--primary);color:var(--on-primary)">My Music</button>
            <button class="ml-tab" onclick="switchMusicLibTab('upload')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:var(--on-surface-variant)">Upload</button>
            <button class="ml-tab" onclick="switchMusicLibTab('search')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:var(--on-surface-variant)">Search</button>
            <button class="ml-tab" onclick="switchMusicLibTab('languages')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:var(--on-surface-variant)">Languages</button>
          </div>
        </div>
        <div id="music-lib-content" style="flex:1;overflow-y:auto;padding:8px 16px 20px"></div>`;

      overlay.appendChild(panel);
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);

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
        <input type="search" placeholder="Search my music..." oninput="filterMyMusic(this.value)" style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:13px;outline:none">
        <select id="ml-lang-filter" onchange="filterMyMusicByLang(this.value)" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:12px;margin-right:4px;">
          <option value="">All Languages</option>
          ${LANGUAGES.map(l => `<option value="${l}">${l}</option>`).join('')}
        </select>
        <button onclick="switchMusicLibTab('upload')" style="padding:8px 14px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">
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
        <button onclick="event.stopPropagation();toggleMusicFavorite('${t.id}');switchMusicLibTab('my')" style="background:none;border:none;cursor:pointer;padding:4px;font-size:16px">${t.favorite ? '❤️' : '🤍'}</button>
        ${t.addedBy === App.auth?.currentUser?.uid ? `<button onclick="event.stopPropagation();editMusicTrack('${t.id}')" style="background:none;border:none;cursor:pointer;padding:4px;font-size:14px;opacity:0.5" title="Edit">✏️</button>` : ''}
        ${t.addedBy === App.auth?.currentUser?.uid ? `<button onclick="event.stopPropagation();deleteMusicTrack('${t.id}').then(()=>switchMusicLibTab('my'))" style="background:none;border:none;cursor:pointer;padding:4px;font-size:14px;opacity:0.5" title="Delete">🗑️</button>` : ''}
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

  // ─── SEARCH TAB (YouTube via Invidious + Archive.org) ───
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
          <input type="search" id="yt-search-input" placeholder="Search any song on YouTube..." style="flex:1;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:13px;outline:none" onkeydown="if(event.key==='Enter')doYouTubeSearch()">
          <button onclick="doYouTubeSearch()" style="padding:10px 18px;border-radius:12px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:700;cursor:pointer">Search</button>
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

  window.doArchiveSearch = function() {
    const q = document.getElementById('archive-search-input')?.value;
    if (!q || q.length < 2) return;
    _doArchiveSearch(q);
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
        <button onclick="event.stopPropagation();addCachedTrackToLibrary('${t.id}')" style="background:rgba(124,77,255,0.15);border:none;border-radius:6px;padding:4px 8px;color:var(--primary);font-size:10px;font-weight:600;cursor:pointer">+ Add</button>
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

    if (!results.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:16px">
          <p style="color:var(--on-surface-variant);font-size:12px;margin:0 0 8px">No results found</p>
          <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' song')}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;background:rgba(255,0,0,0.1);color:#ff4444;font-size:12px;font-weight:600;text-decoration:none">
            <span class="material-symbols-outlined" style="font-size:16px">open_in_new</span> Search on YouTube
          </a>
        </div>`;
      return;
    }

    results.forEach(t => { _trackCache[t.id] = t; });

    container.innerHTML = results.map(t => `
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

})();
