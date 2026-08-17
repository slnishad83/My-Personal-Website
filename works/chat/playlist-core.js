// Playlist Core — Firestore schema, CRUD, ownership, permissions, search
(function() {
  'use strict';

  const COLLECTION = 'playlists';

  // ─── STATE ───
  App.playlists = {};
  App.currentPlaylist = null;
  App._playlistUnsubs = {};

  // ─── SCHEMA ───
  // Firestore: playlists/{playlistId}
  // {
  //   id: string,
  //   name: string,
  //   description: string,
  //   coverUrl: string | null,
  //   ownerUid: string,
  //   ownerName: string,
  //   chatId: string | null,        // null = personal, set = shared in chat
  //   groupId: string | null,       // set if shared in group
  //   type: 'personal' | 'shared' | 'group',
  //   folderId: string | null,
  //   tracks: [{
  //     id: string,
  //     title: string,
  //     artist: string,
  //     duration: number,            // seconds
  //     url: string,                 // audio URL
  //     thumbnail: string | null,
  //     source: string,              // 'url' | 'upload' | 'youtube'
  //     addedBy: string,             // uid
  //     addedByName: string,
  //     addedAt: timestamp,
  //   }],
  //   order: string[],              // track IDs in playback order
  //   likedBy: string[],            // UIDs who liked the playlist
  //   collaborators: string[],      // UIDs who can edit (empty = owner only)
  //   isPublic: boolean,
  //   tags: string[],
  //   playCount: number,
  //   totalDuration: number,
  //   createdAt: timestamp,
  //   updatedAt: timestamp,
  // }

  function _genId() {
    return 'pl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function _trackId() {
    return 'tr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ─── CREATE ───
  window.createPlaylist = async function(opts = {}) {
    if (!App.db || !App.auth?.currentUser) return null;
    const uid = App.auth.currentUser.uid;
    const name = opts.name || 'New Playlist';

    const playlist = {
      name,
      description: opts.description || '',
      coverUrl: opts.coverUrl || null,
      ownerUid: uid,
      ownerName: App.currentUser?.displayName || 'User',
      chatId: opts.chatId || null,
      groupId: opts.groupId || null,
      type: opts.type || (opts.chatId ? 'shared' : 'personal'),
      folderId: opts.folderId || null,
      tracks: [],
      order: [],
      likedBy: [],
      collaborators: opts.collaborators || [],
      isPublic: opts.isPublic !== false,
      tags: opts.tags || [],
      playCount: 0,
      totalDuration: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      const ref = await App.db.collection(COLLECTION).add(playlist);
      playlist.id = ref.id;
      App.playlists[ref.id] = playlist;
      showToast('Playlist created', 'success');
      return playlist;
    } catch(e) {
      if (window.__DEBUG__) console.error('Create playlist failed:', e);
      showToast('Failed to create playlist', 'error');
      return null;
    }
  };

  // ─── READ ───
  window.loadPlaylists = async function(chatId) {
    if (!App.db) return [];
    try {
      let query;
      if (chatId) {
        query = App.db.collection(COLLECTION)
          .where('chatId', '==', chatId);
      } else {
        const uid = App.auth?.currentUser?.uid;
        if (!uid) return [];
        query = App.db.collection(COLLECTION)
          .where('ownerUid', '==', uid);
      }
      const snap = await query.limit(200).get();
      const results = [];
      snap.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;
        App.playlists[doc.id] = data;
        results.push(data);
      });
      // Sort in-memory to avoid requiring a composite index
      results.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return results.slice(0, 50);
    } catch(e) {
      if (window.__DEBUG__) console.warn('Load playlists failed:', e);
      return [];
    }
  };

  window.getPlaylist = async function(playlistId) {
    if (App.playlists[playlistId]) return App.playlists[playlistId];
    if (!App.db) return null;
    try {
      const doc = await App.db.collection(COLLECTION).doc(playlistId).get();
      if (doc.exists) {
        const data = doc.data();
        data.id = doc.id;
        App.playlists[doc.id] = data;
        return data;
      }
    } catch(_) {}
    return null;
  };

  window.searchPlaylists = async function(query) {
    if (!App.db || !query) return [];
    try {
      const snap = await App.db.collection(COLLECTION)
        .where('isPublic', '==', true)
        .get();
      const results = [];
      const q = query.toLowerCase();
      snap.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;
        if (data.name.toLowerCase().includes(q) ||
            data.tags?.some(t => t.toLowerCase().includes(q)) ||
            data.ownerName?.toLowerCase().includes(q)) {
          results.push(data);
        }
      });
      // Sort in-memory by playCount to avoid requiring a composite index
      results.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
      return results.slice(0, 30);
    } catch(e) {
      if (window.__DEBUG__) console.warn('Search playlists failed:', e);
      return [];
    }
  };

  // ─── UPDATE ───
  async function _updatePlaylist(playlistId, updates) {
    if (!App.db) return;
    updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    try {
      await App.db.collection(COLLECTION).doc(playlistId).update(updates);
      if (App.playlists[playlistId]) Object.assign(App.playlists[playlistId], updates);
    } catch(e) {
      if (window.__DEBUG__) console.error('Update playlist failed:', e);
    }
  }

  window.renamePlaylist = async function(playlistId, name) {
    await _updatePlaylist(playlistId, { name });
    showToast('Playlist renamed', 'success');
  };

  window.setPlaylistCover = async function(playlistId, coverUrl) {
    await _updatePlaylist(playlistId, { coverUrl });
  };

  // ─── TRACKS ───
  window.addTrackToPlaylist = async function(playlistId, track) {
    const pl = App.playlists[playlistId];
    if (!pl) return;

    const uid = App.auth?.currentUser?.uid;
    const trackData = {
      id: _trackId(),
      title: track.title || 'Unknown Track',
      artist: track.artist || 'Unknown Artist',
      duration: track.duration || 0,
      url: track.url,
      thumbnail: track.thumbnail || null,
      source: track.source || 'url',
      addedBy: uid,
      addedByName: App.currentUser?.displayName || 'User',
      addedAt: Date.now(),
    };

    pl.tracks.push(trackData);
    pl.order.push(trackData.id);
    pl.totalDuration = pl.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

    await _updatePlaylist(playlistId, {
      tracks: pl.tracks,
      order: pl.order,
      totalDuration: pl.totalDuration,
    });

    if (window.MusicOfflineStorage && (trackData.url || track.audioUrl)) {
      const audioTargetUrl = trackData.url || track.audioUrl;
      fetch(audioTargetUrl).then(res => res.blob()).then(blob => {
        window.MusicOfflineStorage.saveTrackBlob(trackData.id, blob, { title: trackData.title, artist: trackData.artist });
      }).catch(()=>{});
    }

    showToast(`Added "${trackData.title}" ⚡ (Offline Cached)`, 'success');
    return trackData;
  };

  window.removeTrackFromPlaylist = async function(playlistId, trackId) {
    const pl = App.playlists[playlistId];
    if (!pl) return;

    pl.tracks = pl.tracks.filter(t => t.id !== trackId);
    pl.order = pl.order.filter(id => id !== trackId);
    pl.totalDuration = pl.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

    await _updatePlaylist(playlistId, {
      tracks: pl.tracks,
      order: pl.order,
      totalDuration: pl.totalDuration,
    });

    showToast('Track removed', 'info');
  };

  window.reorderPlaylist = async function(playlistId, newOrder) {
    const pl = App.playlists[playlistId];
    if (!pl) return;
    pl.order = newOrder;
    await _updatePlaylist(playlistId, { order: newOrder });
  };

  window.moveTrack = async function(playlistId, trackId, direction) {
    const pl = App.playlists[playlistId];
    if (!pl) return;
    const idx = pl.order.indexOf(trackId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= pl.order.length) return;
    [pl.order[idx], pl.order[newIdx]] = [pl.order[newIdx], pl.order[idx]];
    await _updatePlaylist(playlistId, { order: pl.order });
  };

  // ─── LIKE / FAVORITE ───
  window.togglePlaylistLike = async function(playlistId) {
    const pl = App.playlists[playlistId];
    if (!pl) return;
    const uid = App.auth?.currentUser?.uid;
    if (!uid) return;
    const idx = (pl.likedBy || []).indexOf(uid);
    if (idx >= 0) pl.likedBy.splice(idx, 1);
    else pl.likedBy.push(uid);
    await _updatePlaylist(playlistId, { likedBy: pl.likedBy });
  };

  // ─── COLLABORATORS ───
  window.addCollaborator = async function(playlistId, uid) {
    const pl = App.playlists[playlistId];
    if (!pl || pl.ownerUid !== App.auth?.currentUser?.uid) return;
    if (!pl.collaborators.includes(uid)) pl.collaborators.push(uid);
    await _updatePlaylist(playlistId, { collaborators: pl.collaborators });
  };

  window.removeCollaborator = async function(playlistId, uid) {
    const pl = App.playlists[playlistId];
    if (!pl || pl.ownerUid !== App.auth?.currentUser?.uid) return;
    pl.collaborators = pl.collaborators.filter(u => u !== uid);
    await _updatePlaylist(playlistId, { collaborators: pl.collaborators });
  };

  window.canEditPlaylist = function(playlist) {
    if (!playlist) return false;
    const uid = App.auth?.currentUser?.uid;
    if (!uid) return false;
    return playlist.ownerUid === uid || (playlist.collaborators || []).includes(uid);
  };

  // ─── DELETE ───
  window.deletePlaylist = async function(playlistId) {
    if (!App.db) return;
    try {
      await App.db.collection(COLLECTION).doc(playlistId).delete();
      delete App.playlists[playlistId];
      showToast('Playlist deleted', 'info');
    } catch(e) {
      if (window.__DEBUG__) console.error('Delete playlist failed:', e);
    }
  };

  // ─── RECENTLY PLAYED ───
  const RECENT_KEY = 'nsl_recent_tracks';

  window.addRecentlyPlayed = function(track) {
    try {
      let recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      recent = recent.filter(t => t.url !== track.url);
      recent.unshift({ ...track, playedAt: Date.now() });
      if (recent.length > 100) recent = recent.slice(0, 100);
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch(_) {}
  };

  window.getRecentlyPlayed = function() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch(_) { return []; }
  };

  // ─── FAVORITES ───
  const FAV_KEY = 'nsl_fav_tracks';

  window.toggleTrackFavorite = function(track) {
    try {
      let favs = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
      const idx = favs.findIndex(t => t.url === track.url);
      if (idx >= 0) { favs.splice(idx, 1); showToast('Removed from favorites', 'info'); }
      else { favs.unshift(track); showToast('Added to favorites', 'success'); }
      localStorage.setItem(FAV_KEY, JSON.stringify(favs));
      return idx < 0;
    } catch(_) { return false; }
  };

  window.isTrackFavorite = function(trackUrl) {
    try {
      const favs = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
      return favs.some(t => t.url === trackUrl);
    } catch(_) { return false; }
  };

  window.getFavoriteTracks = function() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch(_) { return []; }
  };

  // ─── SHARING ───
  window.sharePlaylist = function(playlistId) {
    const playlist = App._playlists?.find(p => p.id === playlistId) || App.playlists?.[playlistId];
    if (!playlist) return;
    const shareUrl = window.location.origin + window.location.pathname + '?playlist=' + playlistId;
    if (navigator.share) {
      navigator.share({ title: playlist.name || 'Playlist', text: `Check out this playlist: ${playlist.name}`, url: shareUrl }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => showToast('Playlist link copied!', 'success'));
    }
  };

  window.importSharedPlaylist = async function(playlistId) {
    if (!App.db || !App.auth?.currentUser) { showToast('Sign in required', 'error'); return; }
    if (!playlistId) { showToast('Enter a playlist ID or link', 'error'); return; }
    try {
      if (playlistId.includes('playlist=')) {
        playlistId = playlistId.split('playlist=')[1].split('&')[0];
      } else if (playlistId.includes('#playlist=')) {
        playlistId = playlistId.split('#playlist=')[1].split('&')[0];
      }
      const doc = await App.db.collection('playlists').doc(playlistId).get();
      if (!doc.exists) { showToast('Playlist not found', 'error'); return; }
      const source = doc.data();
      const uid = App.auth.currentUser.uid;
      const newPlaylist = {
        id: 'pl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
        name: source.name + ' (imported)',
        description: source.description || '',
        tracks: source.tracks || [],
        coverImage: source.coverImage || null,
        createdBy: uid,
        createdByName: App.currentUser?.displayName || 'User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPublic: false,
        importedFrom: playlistId,
      };
      await App.db.collection('playlists').doc(newPlaylist.id).set(newPlaylist);
      showToast('Playlist imported!', 'success');
    } catch(e) {
      if (window.__DEBUG__) console.error('Import failed:', e);
      showToast('Import failed', 'error');
    }
  };

  // ─── FOLDERS ───
  window.createPlaylistFolder = async function(name) {
    if (!App.db || !App.auth?.currentUser) return null;
    if (!name || !name.trim()) return null;
    const folder = {
      id: 'folder_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      name: name.trim(),
      createdBy: App.auth.currentUser.uid,
      createdAt: Date.now(),
    };
    try {
      await App.db.collection('playlistFolders').doc(folder.id).set(folder);
      return folder;
    } catch(e) { return null; }
  };

  window.renamePlaylistFolder = async function(folderId, newName) {
    if (!App.db || !newName?.trim()) return;
    try {
      await App.db.collection('playlistFolders').doc(folderId).update({ name: newName.trim() });
    } catch(_) {}
  };

  window.deletePlaylistFolder = async function(folderId) {
    if (!App.db) return;
    try {
      await App.db.collection('playlistFolders').doc(folderId).delete();
      const snap = await App.db.collection('playlists').where('folderId', '==', folderId).get();
      const batch = App.db.batch();
      snap.docs.forEach(doc => batch.update(doc.ref, { folderId: null }));
      await batch.commit();
    } catch(_) {}
  };

  window.movePlaylistToFolder = async function(playlistId, folderId) {
    if (!App.db) return;
    try {
      await App.db.collection('playlists').doc(playlistId).update({ folderId: folderId || null });
    } catch(_) {}
  };

  window.loadPlaylistFolders = async function() {
    if (!App.db || !App.auth?.currentUser) return [];
    try {
      const snap = await App.db.collection('playlistFolders').where('createdBy', '==', App.auth.currentUser.uid).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(_) { return []; }
  };

  // ─── UTILITY ───
  window.formatPlaylistDuration = function(seconds) {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
  };

  window.formatTrackDuration = function(seconds) {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2,'0')}`;
  };
})();
