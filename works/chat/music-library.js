// Music Library — user uploads, Jamendo free music, YouTube search, language filters
(function() {
  'use strict';

  // ─── STATE ───
  App.musicLibrary = [];
  App._musicUploadProgress = 0;
  const LANGUAGES = ['Malayalam','Tamil','Telugu','Hindi','Kannada','Bengali','Marathi','Punjabi','English','Other'];
  const JAMENDO_CLIENT_ID = 'e24b4955'; // free Jamendo API client ID
  const YOUTUBE_SEARCH_ENABLED = true;
  const _trackCache = {}; // cache track data for onclick references

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
    if (!App.db || !App.auth?.currentUser) return;
    const track = App.musicLibrary.find(t => t.id === trackId);
    if (!track) return;
    if (track.addedBy !== App.auth.currentUser.uid) { showToast('Not your track', 'error'); return; }

    try {
      if (track.storagePath && App.storage) {
        await App.storage.ref(track.storagePath).delete().catch(() => {});
      }
      await App.db.collection('musicLibrary').doc(trackId).delete();
      App.musicLibrary = App.musicLibrary.filter(t => t.id !== trackId);
      showToast('Deleted', 'success');
    } catch(e) {
      showToast('Delete failed', 'error');
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

  // ─── JAMENDO FREE MUSIC ───
  window.searchJamendo = async function(query, page = 1) {
    if (!query || query.length < 2) return [];
    try {
      const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&search=${encodeURIComponent(query)}&limit=20&page=${page}&audioformat=mp3&include=musicinfo&order=popularity_total`;
      const res = await fetch(url);
      const data = await res.json();
      return (data.results || []).map(t => ({
        id: 'jm_' + t.id,
        title: t.name,
        artist: t.artist_name,
        url: t.audio,
        thumbnail: t.image || t.album_image,
        duration: t.duration,
        source: 'jamendo',
        genre: t.musicinfo?.genres?.[0] || '',
        language: _guessLanguage(t.name + ' ' + t.artist_name + ' ' + (t.musicinfo?.tags?.join(' ') || '')),
        license: 'CC',
      }));
    } catch(e) {
      console.warn('Jamendo search failed:', e);
      return [];
    }
  };

  window.searchJamendoByLanguage = async function(language) {
    try {
      const tags = _jamendoTagsForLanguage(language);
      const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&tags=${encodeURIComponent(tags)}&limit=30&audioformat=mp3&include=musicinfo&order=popularity_total`;
      const res = await fetch(url);
      const data = await res.json();
      return (data.results || []).map(t => ({
        id: 'jm_' + t.id,
        title: t.name,
        artist: t.artist_name,
        url: t.audio,
        thumbnail: t.image || t.album_image,
        duration: t.duration,
        source: 'jamendo',
        genre: t.musicinfo?.genres?.[0] || '',
        language: language,
        license: 'CC',
      }));
    } catch(e) { return []; }
  };

  function _jamendoTagsForLanguage(lang) {
    const map = {
      'Malayalam': 'indian,world,asia',
      'Tamil': 'indian,world,asia',
      'Telugu': 'indian,world,asia',
      'Hindi': 'indian,bollywood,world',
      'Kannada': 'indian,world',
      'Bengali': 'indian,world',
      'Marathi': 'indian,world',
      'Punjabi': 'indian,punjabi,world',
      'English': 'english,pop,rock',
    };
    return map[lang] || 'world,indian';
  }

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

  // ─── YOUTUBE SEARCH ───
  window.searchYouTubeMusic = async function(query) {
    if (!query || query.length < 2) return [];
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' song audio')}`;
      return [{ _youtubeSearch: true, query, url: searchUrl }];
    } catch(e) { return []; }
  };

  window.playYouTubeVideo = function(videoId, title) {
    const overlay = document.createElement('div');
    overlay.id = 'yt-player-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    overlay.innerHTML = `
      <div style="width:100%;max-width:640px;padding:16px;text-align:center">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="color:white;font-size:14px;font-weight:600;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%">${escHtml(title || 'YouTube')}</h3>
          <button onclick="document.getElementById('yt-player-overlay')?.remove()" style="background:none;border:none;color:white;cursor:pointer;font-size:20px">&times;</button>
        </div>
        <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px">
          <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allow="autoplay; encrypted-media" allowfullscreen></iframe>
        </div>
        <p style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:12px">YouTube plays in foreground only (browser limitation)</p>
      </div>`;

    document.body.appendChild(overlay);
  };

  // ─── CURATED INDIAN MUSIC ───
  window.openMusicLibrary = function() {
    const overlay = document.createElement('div');
    overlay.id = 'music-library-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px 20px 0 0;width:100%;max-width:500px;max-height:85vh;color:var(--on-surface);display:flex;flex-direction:column';

    panel.innerHTML = `
      <div style="padding:16px 16px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h2 style="margin:0;font-size:18px;font-weight:700">🎵 Music Library</h2>
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
          <button class="ml-tab" onclick="switchMusicLibTab('discover')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:var(--on-surface-variant)">Search Online</button>
          <button class="ml-tab" onclick="switchMusicLibTab('languages')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:var(--on-surface-variant)">Languages</button>
          <button class="ml-tab" onclick="switchMusicLibTab('youtube')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.06);color:var(--on-surface-variant)">YouTube</button>
        </div>
      </div>
      <div id="music-lib-content" style="flex:1;overflow-y:auto;padding:8px 16px 20px"></div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    switchMusicLibTab('my');
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
    else if (tab === 'discover') await _renderDiscoverTab(content);
    else if (tab === 'languages') _renderLanguagesTab(content);
    else if (tab === 'youtube') _renderYouTubeTab(content);
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
        ${t.addedBy === App.auth?.currentUser?.uid ? `<button onclick="event.stopPropagation();deleteMusicTrack('${t.id}');switchMusicLibTab('my')" style="background:none;border:none;cursor:pointer;padding:4px;font-size:14px;opacity:0.5" title="Delete">🗑️</button>` : ''}
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

  // ─── DISCOVER TAB ───
  async function _renderDiscoverTab(el) {
    el.innerHTML = `
      <div style="margin-bottom:12px">
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input type="search" id="jamendo-search" placeholder="Search online songs..." onkeydown="if(event.key==='Enter')doJamendoSearch()" style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:13px;outline:none">
          <button onclick="doJamendoSearch()" style="padding:8px 16px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:700;cursor:pointer">Search</button>
        </div>
        <p style="font-size:10px;color:var(--on-surface-variant);margin:0 0 8px">Free Creative Commons music via Jamendo</p>
      </div>
      <div id="discover-results" style="color:var(--on-surface-variant);text-align:center;padding:20px">
        <p style="font-size:12px">Search for songs or browse by language</p>
      </div>`;
  }

  window.doJamendoSearch = function() {
    const q = document.getElementById('jamendo-search')?.value;
    if (q) window.debounceJamendoSearch(q);
  };

  let _jamendoTimeout;
  window.debounceJamendoSearch = function(q) {
    clearTimeout(_jamendoTimeout);
    _jamendoTimeout = setTimeout(async () => {
      if (!q || q.length < 2) return;
      const el = document.getElementById('discover-results');
      if (el) el.innerHTML = '<p style="text-align:center;font-size:12px;color:var(--on-surface-variant)">Searching...</p>';
      const results = await searchJamendo(q);
      if (el) {
        if (!results.length) {
          el.innerHTML = '<p style="text-align:center;font-size:12px;color:var(--on-surface-variant)">No results found</p>';
          return;
        }
        results.forEach(t => { _trackCache[t.id] = t; });
        el.innerHTML = results.map(t => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:rgba(255,255,255,0.03);margin-bottom:6px;cursor:pointer" onclick="playCachedTrack('${t.id}')">
            <div style="width:42px;height:42px;border-radius:8px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
              ${t.thumbnail ? `<img src="${escHtml(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover">` : '<span style="font-size:16px">🎵</span>'}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title)}</div>
              <div style="font-size:11px;color:var(--on-surface-variant)">${escHtml(t.artist)} · ${t.language || 'CC'}</div>
            </div>
            <button onclick="event.stopPropagation();addCachedTrackToLibrary('${t.id}')" style="background:rgba(124,77,255,0.15);border:none;border-radius:8px;padding:6px 10px;color:var(--primary);font-size:11px;font-weight:600;cursor:pointer" title="Add to library">+ Add</button>
          </div>`).join('');
      }
    }, 500);
  };

  window.playCachedTrack = function(trackId) {
    const t = _trackCache[trackId];
    if (!t) return;
    MusicPlayer.play({ id: t.id, title: t.title, artist: t.artist, url: t.url, thumbnail: t.thumbnail || null, duration: t.duration, source: 'jamendo' });
  };

  window.addCachedTrackToLibrary = function(trackId) {
    const t = _trackCache[trackId];
    if (!t) return;
    addToLibraryFromJamendo(t.id, t.url, t.title, t.artist, t.thumbnail, t.duration, t.language);
  };

  window.addToLibraryFromJamendo = async function(id, url, title, artist, thumb, dur, lang) {
    if (!App.db || !App.auth?.currentUser) { showToast('Sign in required', 'error'); return; }
    const uid = App.auth.currentUser.uid;
    const track = {
      id: 'mt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      title, artist,
      language: lang || 'Other',
      url, thumbnail: thumb || null,
      duration: dur,
      source: 'jamendo',
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

  // ─── LANGUAGES TAB ───
  function _renderLanguagesTab(el) {
    const colors = {
      'Malayalam': '#FF6B35', 'Tamil': '#E91E63', 'Telugu': '#9C27B0',
      'Hindi': '#FF9800', 'Kannada': '#4CAF50', 'Bengali': '#2196F3',
      'Marathi': '#00BCD4', 'Punjabi': '#FF5722', 'English': '#607D8B', 'Other': '#78909C',
    };
    let html = '<p style="font-size:12px;color:var(--on-surface-variant);margin-bottom:12px">Browse free music by language (via Jamendo)</p>';
    LANGUAGES.forEach(lang => {
      html += `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);margin-bottom:6px;cursor:pointer" onclick="browseLanguageMusic('${lang}')">
          <div style="width:42px;height:42px;border-radius:10px;background:${colors[lang] || '#666'}20;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:${colors[lang]}">${lang[0]}</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--on-surface)">${lang}</div>
            <div style="font-size:11px;color:var(--on-surface-variant)">Browse free ${lang} music</div>
          </div>
          <span class="material-symbols-outlined" style="color:var(--on-surface-variant);font-size:18px">chevron_right</span>
        </div>`;
    });
    el.innerHTML = html;
  }

  window.browseLanguageMusic = async function(lang) {
    const el = document.getElementById('music-lib-content');
    if (!el) return;
    el.innerHTML = `<p style="text-align:center;font-size:12px;color:var(--on-surface-variant);padding:20px">Loading ${lang} music...</p>`;
    const results = await searchJamendoByLanguage(lang);
    let html = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <button onclick="switchMusicLibTab('languages')" style="background:none;border:none;color:var(--primary);cursor:pointer;padding:4px"><span class="material-symbols-outlined" style="font-size:20px">arrow_back</span></button>
        <h3 style="margin:0;font-size:15px;font-weight:700">${lang}</h3>
        <span style="font-size:11px;color:var(--on-surface-variant)">${results.length} tracks</span>
      </div>`;
    if (!results.length) {
      html += '<p style="text-align:center;color:var(--on-surface-variant);font-size:12px;padding:20px">No results found for this language</p>';
    } else {
      results.forEach(t => { _trackCache[t.id] = t; });
      results.forEach(t => {
        html += `
        <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:rgba(255,255,255,0.03);margin-bottom:6px;cursor:pointer" onclick="playCachedTrack('${t.id}')">
          <div style="width:42px;height:42px;border-radius:8px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
            ${t.thumbnail ? `<img src="${escHtml(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover">` : '<span style="font-size:16px">🎵</span>'}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title)}</div>
            <div style="font-size:11px;color:var(--on-surface-variant)">${escHtml(t.artist)}</div>
          </div>
          <button onclick="event.stopPropagation();addCachedTrackToLibrary('${t.id}')" style="background:rgba(124,77,255,0.15);border:none;border-radius:8px;padding:6px 10px;color:var(--primary);font-size:11px;font-weight:600;cursor:pointer">+ Add</button>
        </div>`;
      });
    }
    el.innerHTML = html;
  };

  // ─── YOUTUBE TAB ───
  function _renderYouTubeTab(el) {
    el.innerHTML = `
      <div style="margin-bottom:12px">
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input type="search" id="yt-search-input" placeholder="Search YouTube songs..." style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--on-surface);font-size:13px;outline:none" onkeydown="if(event.key==='Enter')doYouTubeSearch()">
          <button onclick="doYouTubeSearch()" style="padding:8px 16px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:700;cursor:pointer">Search</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
          <button onclick="doYouTubeSearchFor('Malayalam songs 2024')" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:var(--on-surface-variant);font-size:10px;cursor:pointer">Malayalam</button>
          <button onclick="doYouTubeSearchFor('Tamil songs 2024')" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:var(--on-surface-variant);font-size:10px;cursor:pointer">Tamil</button>
          <button onclick="doYouTubeSearchFor('Telugu songs 2024')" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:var(--on-surface-variant);font-size:10px;cursor:pointer">Telugu</button>
          <button onclick="doYouTubeSearchFor('Hindi songs 2024')" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:var(--on-surface-variant);font-size:10px;cursor:pointer">Hindi</button>
        </div>
        <p style="font-size:10px;color:var(--on-surface-variant);margin:0">⚠️ YouTube plays in foreground only (browser limitation for background/lock screen)</p>
      </div>
      <div id="yt-results"></div>`;
  }

  window.doYouTubeSearch = function() {
    const q = document.getElementById('yt-search-input')?.value;
    if (!q) return;
    _openYouTubeSearch(q);
  };

  window.doYouTubeSearchFor = function(q) {
    _openYouTubeSearch(q);
  };

  function _openYouTubeSearch(query) {
    // Open YouTube search in a new overlay with embed player
    const overlay = document.createElement('div');
    overlay.id = 'yt-search-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;animation:fadeIn 0.2s ease';

    overlay.innerHTML = `
      <div style="padding:12px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,0.1)">
        <button onclick="document.getElementById('yt-search-overlay')?.remove()" style="background:none;border:none;color:white;cursor:pointer;font-size:20px">←</button>
        <input type="search" value="${escHtml(query)}" id="yt-overlay-search" style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:white;font-size:13px;outline:none" onkeydown="if(event.key==='Enter')_refreshYouTubeResults(this.value)">
        <button onclick="_refreshYouTubeResults(document.getElementById('yt-overlay-search').value)" style="padding:8px 12px;border-radius:10px;border:none;background:var(--primary);color:white;font-size:12px;font-weight:600;cursor:pointer">Go</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:12px 16px" id="yt-overlay-results">
        <p style="color:rgba(255,255,255,0.5);font-size:12px;text-align:center;margin-top:40px">Loading YouTube results...</p>
      </div>`;

    document.body.appendChild(overlay);
    _refreshYouTubeResults(query);
  }

  window._refreshYouTubeResults = function(query) {
    const el = document.getElementById('yt-overlay-results');
    if (!el) return;
    el.innerHTML = `
      <div style="border-radius:12px;overflow:hidden;margin-bottom:12px;background:#000;position:relative;padding-bottom:56.25%;height:0">
        <iframe src="https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allow="autoplay; encrypted-media" allowfullscreen></iframe>
      </div>
      <div style="text-align:center;margin-bottom:16px">
        <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' song')}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:10px;background:rgba(255,0,0,0.15);color:#ff4444;font-size:13px;font-weight:600;text-decoration:none">
          <span class="material-symbols-outlined" style="font-size:18px">open_in_new</span> Open in YouTube
        </a>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:10px;text-align:center">Click any video in the player above to play. YouTube does not support background playback in browsers.</p>
      <div style="margin-top:16px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.05)">
        <p style="color:var(--primary);font-size:12px;font-weight:600;margin:0 0 4px">Tip</p>
        <p style="color:rgba(255,255,255,0.5);font-size:11px;margin:0">For background music, upload your own MP3 files in the Upload tab — they play even when minimized or locked!</p>
      </div>`;
  };

})();
