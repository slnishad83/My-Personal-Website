// Playlist Sync — group listening rooms, real-time sync, host controls
(function() {
  'use strict';

  // ─── STATE ───
  App._listeningRoom = null;
  App._listeningRoomUnsub = null;
  App._listeningRoomListeners = [];

  // ─── Firestore schema: listeningRooms/{chatId}
  // {
  //   chatId: string,
  //   playlistId: string,
  //   hostUid: string,
  //   hostName: string,
  //   currentTrackId: string,
  //   currentTrackIndex: number,
  //   isPlaying: boolean,
  //   position: number,           // current playback position in seconds
  //   lastSyncAt: timestamp,
  //   listeners: [{ uid, name, joinedAt, isCoHost }],
  //   settings: {
  //     allowQueueAdd: boolean,
  //     allowSkip: boolean,
  //     syncPlayback: boolean,
  //   },
  //   createdAt: timestamp,
  // }

  // ─── CREATE / JOIN ROOM ───
  window.startListeningRoom = async function(playlistId) {
    if (!App.db || !App.auth?.currentUser || !App.currentChat) return;
    const uid = App.auth.currentUser.uid;
    const chatId = App.currentChat.id;
    const pl = await getPlaylist(playlistId);
    if (!pl) { showToast('Playlist not found', 'error'); return; }

    const existing = await _getRoom(chatId);
    if (existing) {
      showToast('A listening room is already active', 'info');
      _joinRoom(existing);
      return;
    }

    const room = {
      chatId,
      playlistId,
      hostUid: uid,
      hostName: App.currentUser?.displayName || 'User',
      currentTrackId: pl.tracks?.[0]?.id || null,
      currentTrackIndex: 0,
      isPlaying: false,
      position: 0,
      lastSyncAt: firebase.firestore.FieldValue.serverTimestamp(),
      listeners: [{ uid, name: App.currentUser?.displayName || 'User', joinedAt: Date.now(), isCoHost: false }],
      settings: { allowQueueAdd: true, allowSkip: true, syncPlayback: true },
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await App.db.collection('listeningRooms').doc(chatId).set(room);
      App._listeningRoom = { ...room, chatId };
      _listenToRoom(chatId);
      showToast('Listening room started!', 'success');

      await App.db.collection('messages').add({
        senderId: uid,
        senderName: App.currentUser?.displayName || 'User',
        text: `🎵 Started a listening session with "${pl.name}"`,
        type: 'system',
        systemType: 'listening_room_start',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        ...(App.currentChat.type === 'group' ? { groupId: chatId } : { directId: chatId, participants: [uid, App.currentChat.uid || ''] }),
      }).catch(() => {});

    } catch(e) {
      console.error('Start room failed:', e);
      showToast('Failed to start room', 'error');
    }
  };

  window.joinListeningRoom = async function(chatId) {
    if (!App.db || !App.auth?.currentUser) return;
    const room = await _getRoom(chatId || App.currentChat?.id);
    if (!room) { showToast('No active listening room', 'info'); return; }
    _joinRoom(room);
  };

  async function _joinRoom(room) {
    const uid = App.auth.currentUser.uid;
    const name = App.currentUser?.displayName || 'User';

    const existing = (room.listeners || []).find(l => l.uid === uid);
    if (!existing) {
      room.listeners = room.listeners || [];
      room.listeners.push({ uid, name, joinedAt: Date.now(), isCoHost: false });
      try {
        await App.db.collection('listeningRooms').doc(room.chatId).update({
          listeners: room.listeners,
        });
      } catch(_) {}
    }

    App._listeningRoom = room;
    _listenToRoom(room.chatId);

    const pl = await getPlaylist(room.playlistId);
    if (pl && room.currentTrackIndex >= 0 && pl.tracks[room.currentTrackIndex]) {
      MusicPlayer.setQueue(pl.tracks, room.currentTrackIndex);
      MusicPlayer.playlistId = room.playlistId;
      if (room.isPlaying) MusicPlayer.audio?.play().catch(() => {});
    }

    showToast('Joined listening room', 'success');
  }

  // ─── LISTEN TO ROOM UPDATES ───
  function _listenToRoom(chatId) {
    if (App._listeningRoomUnsub) App._listeningRoomUnsub();

    try {
      App._listeningRoomUnsub = App.db.collection('listeningRooms').doc(chatId)
        .onSnapshot(doc => {
          if (!doc.exists) {
            App._listeningRoom = null;
            _hideListeningIndicator();
            return;
          }

          const data = doc.data();
          const prev = App._listeningRoom;
          App._listeningRoom = data;

          _showListeningIndicator(data);

          if (prev && data.currentTrackId !== prev.currentTrackId) {
            _syncToRoomTrack(data);
          }

          if (data.settings?.syncPlayback && data.hostUid !== App.auth?.currentUser?.uid) {
            _syncPlaybackPosition(data);
          }

          _updateListenerCount(data.listeners?.length || 0);
        });
    } catch(e) {
      console.warn('Room listener failed:', e);
    }
  }

  async function _syncToRoomTrack(room) {
    const pl = await getPlaylist(room.playlistId);
    if (!pl || !pl.tracks) return;
    const idx = room.currentTrackIndex || 0;
    if (idx < pl.tracks.length) {
      MusicPlayer.setQueue(pl.tracks, idx);
      if (room.isPlaying) MusicPlayer.audio?.play().catch(() => {});
    }
  }

  function _syncPlaybackPosition(room) {
    if (!MusicPlayer.audio || !room.lastSyncAt) return;
    const syncTime = room.lastSyncAt?.toMillis ? room.lastSyncAt.toMillis() : Date.now();
    const elapsed = (Date.now() - syncTime) / 1000;
    const expectedPos = (room.position || 0) + elapsed;
    const drift = Math.abs(MusicPlayer.audio.currentTime - expectedPos);
    if (drift > 3) {
      MusicPlayer.audio.currentTime = expectedPos;
    }
  }

  // ─── HOST CONTROLS ───
  window.syncRoomState = async function(updates) {
    const room = App._listeningRoom;
    if (!room || room.hostUid !== App.auth?.currentUser?.uid || !App.db) return;

    updates.lastSyncAt = firebase.firestore.FieldValue.serverTimestamp();
    try {
      await App.db.collection('listeningRooms').doc(room.chatId).update(updates);
    } catch(_) {}
  };

  window.endListeningRoom = async function() {
    const room = App._listeningRoom;
    if (!room || !App.db) return;

    if (room.hostUid === App.auth?.currentUser?.uid) {
      try {
        await App.db.collection('listeningRooms').doc(room.chatId).delete();
        await App.db.collection('messages').add({
          senderId: App.auth.currentUser.uid,
          senderName: App.currentUser?.displayName || 'User',
          text: '🎵 Listening session ended',
          type: 'system',
          systemType: 'listening_room_end',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          ...(App.currentChat.type === 'group' ? { groupId: room.chatId } : { directId: room.chatId, participants: [App.auth.currentUser.uid, App.currentChat.uid || ''] }),
        }).catch(() => {});
      } catch(_) {}
    } else {
      const listeners = (room.listeners || []).filter(l => l.uid !== App.auth?.currentUser?.uid);
      try {
        await App.db.collection('listeningRooms').doc(room.chatId).update({ listeners });
      } catch(_) {}
    }

    if (App._listeningRoomUnsub) { App._listeningRoomUnsub(); App._listeningRoomUnsub = null; }
    App._listeningRoom = null;
    _hideListeningIndicator();
    showToast('Left listening room', 'info');
  };

  // ─── REAL-TIME TRACK ADD/REMOVE ───
  const origAddTrack = window.addTrackToPlaylist;
  window.addTrackToPlaylist = async function(playlistId, track) {
    const result = await origAddTrack(playlistId, track);
    const room = App._listeningRoom;
    if (room && room.playlistId === playlistId && App.db) {
      try {
        await App.db.collection('messages').add({
          senderId: App.auth?.currentUser?.uid,
          senderName: App.currentUser?.displayName || 'User',
          text: `🎵 Added "${track.title}" to the shared playlist`,
          type: 'system',
          systemType: 'playlist_track_added',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          ...(App.currentChat.type === 'group' ? { groupId: room.chatId } : { directId: room.chatId, participants: [App.auth?.currentUser?.uid, App.currentChat?.uid || ''] }),
        }).catch(() => {});
      } catch(_) {}
    }
    return result;
  };

  // ─── UI INDICATORS ───
  function _showListeningIndicator(room) {
    let indicator = document.getElementById('listening-room-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'listening-room-indicator';
      indicator.style.cssText = 'position:fixed;bottom:120px;left:12px;right:12px;z-index:89;background:linear-gradient(135deg,rgba(124,77,255,0.15),rgba(74,0,224,0.15));border:1px solid rgba(124,77,255,0.3);border-radius:14px;padding:10px 14px;display:flex;align-items:center;gap:10px;animation:slideUp 0.2s ease;cursor:pointer';
      indicator.onclick = () => { if (room) openListeningRoomPanel(room.chatId); };
      document.body.appendChild(indicator);
    }

    const isHost = room.hostUid === App.auth?.currentUser?.uid;
    indicator.innerHTML = `
      <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;animation:pulseFire 2s infinite">
        <span class="material-symbols-outlined" style="font-size:18px;color:white">headphones</span>
      </div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:700;color:var(--on-surface)">🎵 Listening Room ${isHost ? '(Host)' : ''}</div>
        <div style="font-size:11px;color:var(--on-surface-variant)">${room.listeners?.length || 1} listener${(room.listeners?.length || 1) > 1 ? 's' : ''}</div>
      </div>
      <button onclick="event.stopPropagation();openListeningRoomPanel('${room.chatId}')" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:4px">
        <span class="material-symbols-outlined" style="font-size:18px">open_in_new</span>
      </button>`;
  }

  function _hideListeningIndicator() {
    document.getElementById('listening-room-indicator')?.remove();
  }

  function _updateListenerCount(count) {
    const indicator = document.getElementById('listening-room-indicator');
    if (indicator) {
      const countEl = indicator.querySelector('div:nth-child(2) div:nth-child(2)');
      if (countEl) countEl.textContent = `${count} listener${count > 1 ? 's' : ''}`;
    }
  }

  // ─── ROOM PANEL ───
  window.openListeningRoomPanel = function(chatId) {
    const room = App._listeningRoom;
    if (!room) { showToast('No active room', 'info'); return; }

    const overlay = document.createElement('div');
    overlay.id = 'listening-room-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease';

    const isHost = room.hostUid === App.auth?.currentUser?.uid;

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:500px;max-height:70vh;overflow-y:auto;color:var(--on-surface)';

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:16px;font-weight:700">🎵 Listening Room</h3>
        <button onclick="document.getElementById('listening-room-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:18px">&times;</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <div style="flex:1;padding:10px;border-radius:10px;background:rgba(255,255,255,0.04);text-align:center">
          <div style="font-size:20px;font-weight:700;color:var(--primary)">${room.listeners?.length || 1}</div>
          <div style="font-size:11px;color:var(--on-surface-variant)">Listeners</div>
        </div>
        <div style="flex:1;padding:10px;border-radius:10px;background:rgba(255,255,255,0.04);text-align:center">
          <div style="font-size:20px;font-weight:700;color:var(--on-surface)">${room.isPlaying ? '▶' : '⏸'}</div>
          <div style="font-size:11px;color:var(--on-surface-variant)">${room.isPlaying ? 'Playing' : 'Paused'}</div>
        </div>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--on-surface-variant);margin-bottom:8px">LISTENERS</div>`;

    (room.listeners || []).forEach(l => {
      html += `<div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.03);margin-bottom:4px">
        <div style="width:28px;height:28px;border-radius:50%;background:rgba(124,77,255,0.15);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--primary)">${(l.name || '?')[0].toUpperCase()}</div>
        <div style="flex:1;font-size:13px;font-weight:500">${escHtml(l.name)}</div>
        ${l.uid === room.hostUid ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--primary);color:var(--on-primary);font-weight:600">HOST</span>' : ''}
        ${isHost && l.uid !== room.hostUid ? `<button onclick="promoteToCoHost('${l.uid}')" style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--on-surface-variant);border:none;cursor:pointer">Co-host</button>` : ''}
      </div>`;
    });

    if (isHost) {
      html += `
        <div style="font-size:12px;font-weight:700;color:var(--on-surface-variant);margin:16px 0 8px">HOST CONTROLS</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-radius:8px;background:rgba(255,255,255,0.04)">
            <span style="font-size:13px">Sync playback for all</span>
            <input type="checkbox" ${room.settings?.syncPlayback ? 'checked' : ''} onchange="toggleRoomSetting('syncPlayback',this.checked)" style="accent-color:var(--primary)">
          </label>
          <label style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-radius:8px;background:rgba(255,255,255,0.04)">
            <span style="font-size:13px">Allow listeners to add tracks</span>
            <input type="checkbox" ${room.settings?.allowQueueAdd ? 'checked' : ''} onchange="toggleRoomSetting('allowQueueAdd',this.checked)" style="accent-color:var(--primary)">
          </label>
          <label style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-radius:8px;background:rgba(255,255,255,0.04)">
            <span style="font-size:13px">Allow listeners to skip</span>
            <input type="checkbox" ${room.settings?.allowSkip ? 'checked' : ''} onchange="toggleRoomSetting('allowSkip',this.checked)" style="accent-color:var(--primary)">
          </label>
        </div>
        <button onclick="endListeningRoom();document.getElementById('listening-room-overlay')?.remove()" style="width:100%;padding:12px;border-radius:10px;border:none;background:rgba(239,68,68,0.15);color:var(--error);font-size:13px;font-weight:700;cursor:pointer;margin-top:12px">End Session</button>`;
    } else {
      html += `<button onclick="endListeningRoom();document.getElementById('listening-room-overlay')?.remove()" style="width:100%;padding:12px;border-radius:10px;border:none;background:rgba(255,255,255,0.06);color:var(--on-surface-variant);font-size:13px;font-weight:600;cursor:pointer;margin-top:12px">Leave Room</button>`;
    }

    panel.innerHTML = html;
    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  window.toggleRoomSetting = async function(setting, value) {
    const room = App._listeningRoom;
    if (!room || !App.db) return;
    const settings = { ...room.settings, [setting]: value };
    try {
      await App.db.collection('listeningRooms').doc(room.chatId).update({ settings });
      room.settings = settings;
    } catch(_) {}
  };

  window.promoteToCoHost = async function(uid) {
    const room = App._listeningRoom;
    if (!room || !App.db) return;
    const listeners = (room.listeners || []).map(l => {
      if (l.uid === uid) l.isCoHost = true;
      return l;
    });
    try {
      await App.db.collection('listeningRooms').doc(room.chatId).update({ listeners });
      room.listeners = listeners;
      showToast('Promoted to co-host', 'success');
    } catch(_) {}
  };

  // ─── HELPER ───
  async function _getRoom(chatId) {
    if (!App.db || !chatId) return null;
    try {
      const doc = await App.db.collection('listeningRooms').doc(chatId).get();
      return doc.exists ? doc.data() : null;
    } catch(_) { return null; }
  }

  // ─── HOOK INTO PLAYER ───
  const origPlay = MusicPlayer?.play;
  if (origPlay) {
    MusicPlayer.play = function(track, playlistId) {
      origPlay.call(MusicPlayer, track, playlistId);
      const room = App._listeningRoom;
      if (room && room.hostUid === App.auth?.currentUser?.uid) {
        const idx = MusicPlayer.queueIndex;
        syncRoomState({ currentTrackId: track?.id, currentTrackIndex: idx, isPlaying: true, position: 0 });
      }
    };
  }

  const origTogglePlay = MusicPlayer?.togglePlay;
  if (origTogglePlay) {
    MusicPlayer.togglePlay = function() {
      origTogglePlay.call(MusicPlayer);
      const room = App._listeningRoom;
      if (room && room.hostUid === App.auth?.currentUser?.uid) {
        syncRoomState({ isPlaying: MusicPlayer.isPlaying, position: MusicPlayer.currentTime });
      }
    };
  }

  const origNext = MusicPlayer?.next;
  if (origNext) {
    MusicPlayer.next = function() {
      origNext.call(MusicPlayer);
      const room = App._listeningRoom;
      if (room && room.hostUid === App.auth?.currentUser?.uid) {
        syncRoomState({ currentTrackIndex: MusicPlayer.queueIndex, position: 0 });
      }
    };
  }

  window._playlistSyncCleanup = function() {
    if (App._listeningRoomUnsub) { App._listeningRoomUnsub(); App._listeningRoomUnsub = null; }
    App._listeningRoom = null;
    if (origAddTrack) window.addTrackToPlaylist = origAddTrack;
    if (origPlay) MusicPlayer.play = origPlay;
    if (origTogglePlay) MusicPlayer.togglePlay = origTogglePlay;
    if (origNext) MusicPlayer.next = origNext;
  };
})();
