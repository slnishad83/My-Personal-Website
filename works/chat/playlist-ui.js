// Playlist UI — playlist browser, create/edit, add tracks, sharing
(function() {
  'use strict';

  // ─── BROWSE PLAYLISTS ───
  window.openPlaylists = function(chatId) {
    const overlay = document.createElement('div');
    overlay.id = 'playlists-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;animation:fadeIn 0.2s ease';

    overlay.innerHTML = `
      <div style="padding:12px 16px;display:flex;align-items:center;gap:12px;background:rgba(0,0,0,0.3);backdrop-filter:blur(10px)">
        <button onclick="document.getElementById('playlists-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface);cursor:pointer"><span class="material-symbols-outlined">arrow_back</span></button>
        <h3 style="margin:0;font-size:18px;font-weight:700;color:var(--on-surface);flex:1">Playlists</h3>
        <button onclick="showCreatePlaylistDialog('${chatId || ''}')" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:13px;font-weight:700;white-space:nowrap;flex-shrink:0;min-height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center">+ New</button>
        <button onclick="showCreateFolderDialog()" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:13px;font-weight:700;white-space:nowrap;flex-shrink:0;min-height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center">+ Folder</button>
      </div>
      <div id="playlists-tabs" style="display:flex;gap:4px;padding:8px 16px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch">
        <button class="pl-tab active" onclick="switchPlaylistTab('my',this)" style="padding:6px 14px;border-radius:8px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;min-height:36px">My Playlists</button>
        <button class="pl-tab" onclick="switchPlaylistTab('recent',this)" style="padding:6px 14px;border-radius:8px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant);font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;min-height:36px">Recently Played</button>
        <button class="pl-tab" onclick="switchPlaylistTab('favs',this)" style="padding:6px 14px;border-radius:8px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant);font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;min-height:36px">Favorites</button>
        ${chatId ? `<button class="pl-tab" onclick="switchPlaylistTab('chat',this)" style="padding:6px 14px;border-radius:8px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant);font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;min-height:36px">Chat</button>` : ''}
      </div>
      <div id="playlists-content" style="flex:1;overflow-y:auto;padding:0 16px 80px"></div>`;

    document.body.appendChild(overlay);
    _loadMyPlaylists(chatId);
  };

  window.switchPlaylistTab = function(tab, btn) {
    document.querySelectorAll('.pl-tab').forEach(b => {
      b.style.background = 'var(--surface-container,rgba(0,0,0,0.06))';
      b.style.color = 'var(--on-surface-variant)';
    });
    btn.style.background = 'var(--primary)';
    btn.style.color = 'var(--on-primary)';

    if (tab === 'my') _loadMyPlaylists();
    else if (tab === 'recent') _loadRecentlyPlayed();
    else if (tab === 'favs') _loadFavorites();
    else if (tab === 'chat') _loadChatPlaylists();
  };

  async function _loadMyPlaylists(chatId) {
    const content = document.getElementById('playlists-content');
    if (!content) return;
    content.innerHTML = '<div style="text-align:center;padding:40px"><span class="material-symbols-outlined animate-spin text-3xl" style="color:var(--primary)">progress_activity</span></div>';

    const playlists = await loadPlaylists(chatId);

    if (!playlists.length) {
      content.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <span class="material-symbols-outlined text-4xl" style="color:var(--on-surface-variant);opacity:0.4">queue_music</span>
          <p style="color:var(--on-surface-variant);font-size:13px;margin-top:8px">No playlists yet. Create one to get started!</p>
          <button onclick="showCreatePlaylistDialog('${chatId || ''}')" style="margin-top:12px;padding:10px 20px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Create Playlist</button>
        </div>`;
      return;
    }

    content.innerHTML = playlists.map(pl => _playlistCardHTML(pl)).join('') + `
      <div style="margin-top:16px;padding:12px;border-radius:12px;background:var(--surface-container-low,rgba(0,0,0,0.03));border:1px dashed var(--outline-variant,rgba(0,0,0,0.1))">
        <div style="font-size:11px;font-weight:700;color:var(--on-surface-variant);margin-bottom:6px">Import Shared Playlist</div>
        <div style="display:flex;gap:8px">
          <input type="text" id="import-playlist-id" placeholder="Paste playlist link or ID..." style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.08));background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);font-size:12px;outline:none">
          <button onclick="importSharedPlaylist(document.getElementById('import-playlist-id')?.value)" style="padding:8px 14px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:11px;font-weight:700;cursor:pointer">Import</button>
        </div>
      </div>`;
  }

  function _loadRecentlyPlayed() {
    const content = document.getElementById('playlists-content');
    if (!content) return;
    const recent = getRecentlyPlayed();
    if (!recent.length) {
      content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--on-surface-variant);font-size:13px">No recently played tracks</div>';
      return;
    }
    content.innerHTML = '<div style="font-size:12px;font-weight:700;color:var(--on-surface-variant);margin-bottom:8px">RECENTLY PLAYED</div>' +
      recent.map(t => _trackRowHTML(t, null, true)).join('');
  }

  function _loadFavorites() {
    const content = document.getElementById('playlists-content');
    if (!content) return;
    const favs = getFavoriteTracks();
    if (!favs.length) {
      content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--on-surface-variant);font-size:13px">No favorite tracks yet</div>';
      return;
    }
    content.innerHTML = '<div style="font-size:12px;font-weight:700;color:var(--on-surface-variant);margin-bottom:8px">FAVORITES</div>' +
      favs.map(t => _trackRowHTML(t, null, true)).join('');
  }

  async function _loadChatPlaylists() {
    const content = document.getElementById('playlists-content');
    if (!content || !App.currentChat) return;
    content.innerHTML = '<div style="text-align:center;padding:40px"><span class="material-symbols-outlined animate-spin text-3xl" style="color:var(--primary)">progress_activity</span></div>';
    const playlists = await loadPlaylists(App.currentChat.id);
    if (!playlists.length) {
      content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--on-surface-variant);font-size:13px">No shared playlists in this chat yet</div>';
      return;
    }
    content.innerHTML = playlists.map(pl => _playlistCardHTML(pl)).join('');
  }

  function _playlistCardHTML(pl) {
    const trackCount = pl.tracks?.length || 0;
    const duration = formatPlaylistDuration(pl.totalDuration || 0);
    const isOwner = pl.ownerUid === App.auth?.currentUser?.uid;
    const coverHtml = pl.coverUrl
      ? `<img src="${escHtml(pl.coverUrl)}" style="width:100%;height:100%;object-fit:cover">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--primary),#4a00e0)"><span class="material-symbols-outlined" style="font-size:28px;color:white;opacity:0.6">music_note</span></div>`;

    return `
    <div style="display:flex;gap:12px;padding:12px;border-radius:14px;background:var(--surface-container-low,rgba(0,0,0,0.03));margin-bottom:8px;cursor:pointer;min-height:72px" onclick="openPlaylistDetail('${pl.id}')">
      <div style="width:60px;height:60px;border-radius:10px;overflow:hidden;flex-shrink:0">${coverHtml}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(pl.name)}</div>
        <div style="font-size:11px;color:var(--on-surface-variant);margin-top:2px">${trackCount} tracks · ${duration} ${pl.type === 'shared' ? '· Shared' : ''}</div>
        <div style="font-size:11px;color:var(--on-surface-variant);margin-top:2px">${isOwner ? 'You' : escHtml(pl.ownerName || 'Unknown')}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
        <button onclick="event.stopPropagation();playPlaylist('${pl.id}')" style="width:36px;height:36px;border-radius:50%;background:var(--primary);border:none;color:var(--on-primary);cursor:pointer;display:flex;align-items:center;justify-content:center">
          <span class="material-symbols-outlined" style="font-size:20px">play_arrow</span>
        </button>
      </div>
    </div>`;
  }

  function _trackRowHTML(track, playlistId, showPlay) {
    const isFav = isTrackFavorite(track.url);
    const isCurrent = MusicPlayer._currentTrack?.url === track.url;
    const trackRef = '_plTrackCache_' + Math.random().toString(36).slice(2,8);
    if (!window._plTrackCache) window._plTrackCache = {};
    window._plTrackCache[trackRef] = track;
    return `
    <div class="flex items-center gap-3 p-2 rounded-lg ${isCurrent ? 'bg-primary/10' : 'hover:bg-white/5'}" style="cursor:pointer" data-track-ref="${trackRef}" onclick="${showPlay ? `playTrackFromRef('${trackRef}')` : `playTrackInPlaylist('${playlistId}','${track.id}')`}">
      <div style="width:40px;height:40px;border-radius:6px;overflow:hidden;flex-shrink:0;background:var(--surface-container-low,rgba(0,0,0,0.05));display:flex;align-items:center;justify-content:center">
        ${track.thumbnail ? `<img src="${escHtml(track.thumbnail)}" style="width:100%;height:100%;object-fit:cover">` : '<span class="material-symbols-outlined" style="font-size:18px;color:var(--on-surface-variant)">music_note</span>'}
      </div>
      <div class="flex-1 min-w-0">
        <div style="font-size:13px;font-weight:${isCurrent ? 700 : 500};color:${isCurrent ? 'var(--primary)' : 'var(--on-surface)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(track.title)}</div>
        <div style="font-size:11px;color:var(--on-surface-variant);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(track.artist)}${track.addedByName ? ' · ' + escHtml(track.addedByName) : ''}</div>
      </div>
      <span style="font-size:10px;color:var(--on-surface-variant)">${formatTrackDuration(track.duration)}</span>
      <button onclick="event.stopPropagation();toggleTrackFavorite(window._plTrackCache['${trackRef}']);openPlaylistDetail('${playlistId}')" style="background:none;border:none;color:${isFav ? 'var(--error)' : 'var(--on-surface-variant)'};cursor:pointer;padding:8px;min-width:40px;min-height:40px;display:inline-flex;align-items:center;justify-content:center">
        <span class="material-symbols-outlined" style="font-size:16px">${isFav ? 'favorite' : 'favorite_border'}</span>
      </button>
      ${playlistId && canEditPlaylist(App.playlists[playlistId]) ? `
      <button onclick="event.stopPropagation();removeTrackFromPlaylist('${playlistId}','${track.id}');setTimeout(()=>openPlaylistDetail('${playlistId}'),300)" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:8px;min-width:40px;min-height:40px;display:inline-flex;align-items:center;justify-content:center">
        <span class="material-symbols-outlined" style="font-size:16px">close</span>
      </button>` : ''}
    </div>`;
  }

  // ─── PLAYLIST DETAIL ───
  window.openPlaylistDetail = async function(playlistId) {
    const pl = await getPlaylist(playlistId);
    if (!pl) { showToast('Playlist not found', 'error'); return; }

    const overlay = document.createElement('div');
    overlay.id = 'playlist-detail-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;animation:fadeIn 0.2s ease';

    const isOwner = pl.ownerUid === App.auth?.currentUser?.uid;
    const canEdit = canEditPlaylist(pl);

    overlay.innerHTML = `
      <div style="padding:12px 16px;display:flex;align-items:center;gap:12px;background:rgba(0,0,0,0.3)">
        <button onclick="document.getElementById('playlist-detail-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface);cursor:pointer"><span class="material-symbols-outlined">arrow_back</span></button>
        <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--on-surface);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(pl.name)}</h3>
        ${canEdit ? `<button onclick="showAddTrackDialog('${playlistId}')" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:13px;font-weight:700;white-space:nowrap;flex-shrink:0">+ Add</button>` : ''}
        ${isOwner ? `<button onclick="showCollaboratorManager('${playlistId}')" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;min-width:40px;min-height:40px;display:inline-flex;align-items:center;justify-content:center" title="Manage collaborators"><span class="material-symbols-outlined" style="font-size:20px">group</span></button>` : ''}
        ${isOwner ? `<button onclick="uploadPlaylistCover('${playlistId}')" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;min-width:40px;min-height:40px;display:inline-flex;align-items:center;justify-content:center" title="Change cover"><span class="material-symbols-outlined" style="font-size:20px">add_a_photo</span></button>` : ''}
        <button onclick="sharePlaylist('${playlistId}')" style="background:rgba(124,77,255,0.15);border:none;border-radius:8px;padding:6px 12px;color:var(--primary);font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;min-width:40px;min-height:40px">
          <span class="material-symbols-outlined" style="font-size:14px">share</span> Share
        </button>
        ${isOwner ? `<button onclick="deletePlaylist('${playlistId}');document.getElementById('playlist-detail-overlay')?.remove()" style="background:none;border:none;color:var(--error);cursor:pointer;min-width:40px;min-height:40px;display:inline-flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:20px">delete</span></button>` : ''}
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 16px 80px">
        <div style="display:flex;gap:16px;padding:16px 0">
          <div style="width:min(100px,22vw);height:min(100px,22vw);border-radius:12px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,var(--primary),#4a00e0);display:flex;align-items:center;justify-content:center">
            ${pl.coverUrl ? `<img src="${escHtml(pl.coverUrl)}" style="width:100%;height:100%;object-fit:cover">` : '<span class="material-symbols-outlined" style="font-size:40px;color:white;opacity:0.6">music_note</span>'}
          </div>
          <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
            <div style="font-size:11px;color:var(--on-surface-variant);margin-bottom:4px">${pl.tracks?.length || 0} tracks · ${formatPlaylistDuration(pl.totalDuration || 0)}</div>
            <div style="font-size:12px;color:var(--on-surface-variant);margin-bottom:8px">${escHtml(pl.description || '')}</div>
            <div style="display:flex;gap:8px">
              <button onclick="playPlaylist('${playlistId}')" style="padding:8px 20px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px">
                <span class="material-symbols-outlined" style="font-size:18px">play_arrow</span>Play
              </button>
              <button onclick="shufflePlayPlaylist('${playlistId}')" style="padding:8px 16px;border-radius:10px;border:none;background:var(--outline-variant,rgba(0,0,0,0.08));color:var(--on-surface);font-size:13px;font-weight:600;cursor:pointer">Shuffle</button>
            </div>
          </div>
        </div>
        <div id="playlist-tracks-list"></div>
      </div>`;

    document.body.appendChild(overlay);

    const listEl = document.getElementById('playlist-tracks-list');
    if (pl.tracks?.length) {
      listEl.innerHTML = pl.tracks.map(t => _trackRowHTML(t, playlistId, false)).join('');
    } else {
      listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--on-surface-variant);font-size:13px">No tracks yet. Tap "+ Add" to add music.</div>';
    }
  };

  // ─── ADD TRACK DIALOG ───
  window.showAddTrackDialog = function(playlistId) {
    const overlay = document.createElement('div');
    overlay.id = 'add-track-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:400px;width:92vw;color:var(--on-surface)';

    panel.innerHTML = `
      <h3 style="margin:0 0 16px;font-size:16px;font-weight:700">Add Track</h3>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">Audio URL *</label>
        <input type="url" id="add-track-url" placeholder="https://example.com/song.mp3" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:13px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">Title *</label>
        <input type="text" id="add-track-title" placeholder="Song title" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:13px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">Artist</label>
        <input type="text" id="add-track-artist" placeholder="Artist name" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:13px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">Thumbnail URL (optional)</label>
        <input type="url" id="add-track-thumb" placeholder="https://example.com/cover.jpg" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:13px;box-sizing:border-box">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('add-track-overlay')?.remove()" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface);font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
        <button onclick="_submitAddTrack('${playlistId}')" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Add Track</button>
      </div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  window._submitAddTrack = async function(playlistId) {
    const url = document.getElementById('add-track-url')?.value?.trim();
    const title = document.getElementById('add-track-title')?.value?.trim();
    const artist = document.getElementById('add-track-artist')?.value?.trim() || 'Unknown Artist';
    const thumbnail = document.getElementById('add-track-thumb')?.value?.trim() || null;

    if (!url || !title) { showToast('URL and title are required', 'error'); return; }

    const track = { url, title, artist, thumbnail, source: 'url', duration: 0 };

    try {
      const audio = new Audio();
      audio.src = url;
      await new Promise((resolve, reject) => {
        audio.onloadedmetadata = resolve;
        audio.onerror = reject;
        setTimeout(resolve, 5000);
      });
      track.duration = audio.duration || 0;
    } catch(_) {}

    await addTrackToPlaylist(playlistId, track);
    document.getElementById('add-track-overlay')?.remove();
    openPlaylistDetail(playlistId);
  };

  // ─── CREATE PLAYLIST DIALOG ───
  window.showCreatePlaylistDialog = function(chatId) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:380px;width:92vw;color:var(--on-surface)';

    panel.innerHTML = `
      <h3 style="margin:0 0 16px;font-size:16px;font-weight:700">Create Playlist</h3>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">Name *</label>
        <input type="text" id="create-pl-name" placeholder="My Playlist" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:13px;box-sizing:border-box" autofocus>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">Description</label>
        <input type="text" id="create-pl-desc" placeholder="Optional description" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:13px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:11px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">FOLDER</label>
        <select id="playlist-folder-select" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);font-size:13px">
          <option value="">No folder</option>
        </select>
      </div>
      <div style="margin-bottom:16px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;min-height:44px">
          <input type="checkbox" id="create-pl-public" checked style="accent-color:var(--primary)">
          <span style="font-size:13px">Public (others can discover)</span>
        </label>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="this.closest('[style*=\"fixed\"]')?.remove()" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface);font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
        <button onclick="_submitCreatePlaylist('${chatId || ''}')" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Create</button>
      </div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    setTimeout(() => document.getElementById('create-pl-name')?.focus(), 100);

    loadPlaylistFolders().then(folders => {
      const sel = document.getElementById('playlist-folder-select');
      if (sel && folders.length) {
        folders.forEach(f => {
          const opt = document.createElement('option');
          opt.value = f.id;
          opt.textContent = f.name;
          sel.appendChild(opt);
        });
      }
    });
  };

  window._submitCreatePlaylist = async function(chatId) {
    const name = document.getElementById('create-pl-name')?.value?.trim();
    if (!name) { showToast('Name is required', 'error'); return; }
    const desc = document.getElementById('create-pl-desc')?.value?.trim() || '';
    const isPublic = document.getElementById('create-pl-public')?.checked;
    const folderId = document.getElementById('playlist-folder-select')?.value || null;

    const pl = await createPlaylist({
      name, description: desc, isPublic, folderId,
      chatId: chatId || null,
      type: chatId ? 'shared' : 'personal',
    });

    document.querySelectorAll('[style*="fixed"]').forEach(el => {
      if (el.querySelector('#create-pl-name')) el.remove();
    });

    if (pl) openPlaylistDetail(pl.id);
  };

  // ─── PLAY HELPERS ───
  window.playPlaylist = async function(playlistId) {
    const pl = await getPlaylist(playlistId);
    if (!pl || !pl.tracks?.length) { showToast('Playlist is empty', 'info'); return; }
    MusicPlayer.setQueue(pl.tracks, 0);
    MusicPlayer.playlistId = playlistId;
    showToast(`Playing "${pl.name}"`, 'success');
  };

  window.shufflePlayPlaylist = async function(playlistId) {
    const pl = await getPlaylist(playlistId);
    if (!pl || !pl.tracks?.length) { showToast('Playlist is empty', 'info'); return; }
    const shuffled = [...pl.tracks].sort(() => Math.random() - 0.5);
    MusicPlayer.setQueue(shuffled, 0);
    MusicPlayer.isShuffle = true;
    showToast(`Shuffling "${pl.name}"`, 'success');
  };

  window.playTrackInPlaylist = async function(playlistId, trackId) {
    const pl = await getPlaylist(playlistId);
    if (!pl) return;
    const idx = pl.tracks.findIndex(t => t.id === trackId);
    if (idx < 0) return;
    MusicPlayer.setQueue(pl.tracks, idx);
    MusicPlayer.playlistId = playlistId;
  };

  window.playTrackFromUrl = function(track) {
    MusicPlayer.play(track);
  };

  window.playTrackFromRef = function(ref) {
    const track = window._plTrackCache?.[ref];
    if (track) MusicPlayer.play(track);
  };

  // ─── SHARE ───

  // ─── COLLABORATOR MANAGER ───
  window.showCollaboratorManager = async function(playlistId) {
    const pl = await getPlaylist(playlistId);
    if (!pl) return;

    const overlay = document.createElement('div');
    overlay.id = 'collab-manager-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:500px;max-height:60vh;color:var(--on-surface)';

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:16px;font-weight:700">Manage Collaborators</h3>
        <button onclick="document.getElementById('collab-manager-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">&times;</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input type="text" id="collab-uid-input" placeholder="Enter user UID..." style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);font-size:13px">
        <button onclick="addCollaboratorToPlaylist('${playlistId}')" style="padding:10px 16px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Add</button>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--on-surface-variant);margin-bottom:8px">OWNER</div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:var(--surface-container-low,rgba(0,0,0,0.03));margin-bottom:8px">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:white">${(pl.ownerName || 'U')[0].toUpperCase()}</div>
        <div style="flex:1;font-size:13px;font-weight:600">${escHtml(pl.ownerName || 'Owner')}</div>
        <span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--primary);color:var(--on-primary);font-weight:700">YOU</span>
      </div>`;

    if (pl.collaborators?.length) {
      html += '<div style="font-size:12px;font-weight:700;color:var(--on-surface-variant);margin:12px 0 8px">COLLABORATORS</div>';
      pl.collaborators.forEach(uid => {
        html += `
        <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:var(--surface-container-low,rgba(0,0,0,0.03));margin-bottom:4px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--surface-container,rgba(0,0,0,0.1));display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--on-surface-variant)">${uid[0].toUpperCase()}</div>
          <div style="flex:1;font-size:13px;color:var(--on-surface-variant)">${escHtml(uid)}</div>
          <button onclick="removeCollaboratorFromPlaylist('${playlistId}','${uid}')" style="background:none;border:none;color:var(--error);cursor:pointer;padding:4px"><span class="material-symbols-outlined" style="font-size:18px">close</span></button>
        </div>`;
      });
    } else {
      html += '<p style="font-size:12px;color:var(--on-surface-variant);text-align:center;padding:12px">No collaborators yet</p>';
    }

    panel.innerHTML = html;
    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  window.addCollaboratorToPlaylist = async function(playlistId) {
    const input = document.getElementById('collab-uid-input');
    const uid = input?.value?.trim();
    if (!uid) { showToast('Enter a user UID', 'error'); return; }
    await addCollaborator(playlistId, uid);
    showCollaboratorManager(playlistId);
  };

  window.removeCollaboratorFromPlaylist = async function(playlistId, uid) {
    await removeCollaborator(playlistId, uid);
    showCollaboratorManager(playlistId);
  };

  // ─── CREATE FOLDER DIALOG ───
  window.showCreateFolderDialog = function() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:380px;width:92vw;color:var(--on-surface)';

    panel.innerHTML = `
      <h3 style="margin:0 0 16px;font-size:16px;font-weight:700">Create Folder</h3>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:4px">Folder Name *</label>
        <input type="text" id="create-folder-name" placeholder="My Folder" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:13px;box-sizing:border-box" autofocus>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="this.closest('[style*=\"fixed\"]')?.remove()" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface);font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
        <button onclick="_submitCreateFolder()" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Create</button>
      </div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    setTimeout(() => document.getElementById('create-folder-name')?.focus(), 100);
  };

  window._submitCreateFolder = async function() {
    const name = document.getElementById('create-folder-name')?.value?.trim();
    if (!name) { showToast('Name is required', 'error'); return; }
    await createPlaylistFolder(name);
    document.querySelectorAll('[style*="fixed"]').forEach(el => {
      if (el.querySelector('#create-folder-name')) el.remove();
    });
    showToast('Folder created', 'success');
  };

  // ─── COVER UPLOAD ───
  window.uploadPlaylistCover = function(playlistId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!App.storage || !App.auth?.currentUser) { showToast('Storage not available', 'error'); return; }

      showToast('Uploading cover...', 'info');
      try {
        const path = `playlist-covers/${playlistId}_${Date.now()}.${file.name.split('.').pop()}`;
        const ref = App.storage.ref(path);
        await ref.put(file);
        const url = await ref.getDownloadURL();
        await setPlaylistCover(playlistId, url);
        showToast('Cover updated', 'success');
        openPlaylistDetail(playlistId);
      } catch(e) {
        showToast('Upload failed', 'error');
      }
    };
    input.click();
  };

  // ─── FROM URL HASH ───
  function _checkPlaylistHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#playlist=')) {
      const id = hash.replace('#playlist=', '');
      setTimeout(() => openPlaylistDetail(id), 2000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _checkPlaylistHash);
  } else {
    _checkPlaylistHash();
  }
})();
