/* group-call-ui.js � Grid layout, participant tiles, speaker view */
(function () {
  'use strict';

  var GC = window._GC;
  var CC = window._CC;
  GC._speakerViewMode = false;
  var _shownInviteCallId = null;

  function _renderAvatar(name, avatar, _size) {
    var initials = (name || '?')[0].toUpperCase();
    if (avatar) {
      return '<img src="' + GC._esc(avatar) + '" class="w-full h-full object-cover rounded-lg" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
        '<div class="w-full h-full rounded-lg bg-primary/15 text-primary items-center justify-center font-bold text-2xl" style="display:none">' + GC._esc(initials) + '</div>';
    }
    return '<div class="w-full h-full rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-2xl">' + GC._esc(initials) + '</div>';
  }

  function _getGridLayout(count, hasScreenShare) {
    if (hasScreenShare && count > 1) {
      return { mainCount: 1, stripCount: count - 1, layout: 'screenshare' };
    }
    switch (count) {
      case 0: return { cols: 1, rows: 1, layout: 'empty' };
      case 1: return { cols: 1, rows: 1, layout: 'fullscreen' };
      case 2: return { cols: 2, rows: 1, layout: 'split' };
      case 3: return { cols: 2, rows: 2, layout: 'speaker-plus-two' };
      case 4: return { cols: 2, rows: 2, layout: 'grid-2x2' };
      case 5: case 6: return { cols: 3, rows: 2, layout: 'grid-3x2' };
      case 7: case 8: case 9: return { cols: 3, rows: 3, layout: 'grid-3x3' };
      case 10: case 11: case 12: return { cols: 4, rows: 3, layout: 'grid-4x3' };
      case 13: case 14: case 15: case 16: return { cols: 4, rows: 4, layout: 'grid-4x4' };
      case 17: case 18: case 19: case 20: return { cols: 5, rows: 4, layout: 'grid-5x4' };
      case 21: case 22: case 23: case 24: case 25: return { cols: 5, rows: 5, layout: 'grid-5x5' };
      default: return { cols: 6, rows: 6, layout: 'grid-6x6' };
    }
  }

  function _getVideoBudgetUids(participants) {
    var budget = (window.isMobile || (typeof window.innerWidth === 'number' && window.innerWidth < 768))
      ? (window.GROUP_CALL_VIDEO_RENDER_BUDGET_MOBILE || 6)
      : (window.GROUP_CALL_VIDEO_RENDER_BUDGET || 9);
    if (!participants || participants.length <= budget) {
      return new Set(participants.map(function (p) { return p.uid; }));
    }
    var myUid = GC._myUid;
    var result = [myUid];
    var withVideo = participants
      .filter(function (p) { return p.uid !== myUid && GC._participantVideoState.get(p.uid) !== true && GC._participantStreams.has(p.uid); })
      .sort(function (a, b) {
        var la = GC._audioLevelCache.get(a.uid) || 0;
        var lb = GC._audioLevelCache.get(b.uid) || 0;
        return lb - la;
      });
    withVideo.forEach(function (p) {
      if (result.length < budget) result.push(p.uid);
    });
    if (GC._screenShareUserId && result.indexOf(GC._screenShareUserId) === -1) result.push(GC._screenShareUserId);
    return new Set(result);
  }

  function _getParticipantTile(uid, name, avatar, isMuted, isVideoOff, isSpeaking, isReconnecting, isScreenSharing, stream) {
    var speakingClass = isSpeaking ? 'ring-2 ring-green-400 shadow-lg shadow-green-400/20' : '';
    var reconnectClass = isReconnecting ? 'opacity-60' : '';
    var screenShareClass = isScreenSharing ? 'ring-2 ring-blue-400' : '';
    var videoStyle = (!isVideoOff && stream) ? '' : 'display:none;';
    var avatarStyle = (isVideoOff || !stream) ? '' : 'display:none;';
    var muteIndicator = isMuted ? '<div class="absolute top-2 right-2 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center"><span class="material-symbols-outlined text-white" style="font-size:12px">mic_off</span></div>' : '';
    var reconnectOverlay = isReconnecting ? '<div class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg z-10"><div class="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin mb-2"></div><span class="text-white text-xs font-medium">Reconnecting�</span></div>' : '';
    var screenShareBadge = isScreenSharing ? '<div class="absolute top-2 left-2 bg-blue-500 rounded px-1.5 py-0.5 flex items-center gap-1 z-10"><span class="material-symbols-outlined text-white" style="font-size:10px">screen_share</span><span class="text-white text-[10px] font-medium">Sharing</span></div>' : '';

    return '<div class="relative overflow-hidden rounded-lg bg-gray-900 ' + speakingClass + ' ' + reconnectClass + ' ' + screenShareClass + ' transition-all duration-200" data-gc-uid="' + GC._esc(uid) + '">' +
      '<video class="w-full h-full object-cover rounded-lg" style="' + videoStyle + '" autoplay playsinline muted data-gc-video="' + GC._esc(uid) + '"></video>' +
      '<div class="w-full h-full flex items-center justify-center rounded-lg" style="' + avatarStyle + '">' +
      _renderAvatar(name, avatar) +
      '</div>' +
      muteIndicator +
      screenShareBadge +
      reconnectOverlay +
      '<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 flex items-center justify-between">' +
      '<span class="text-white text-xs font-medium truncate">' + GC._esc(name || 'Unknown') + '</span>' +
      '<div class="flex items-center gap-1" data-gc-controls="' + GC._esc(uid) + '"></div>' +
      '</div>' +
      '</div>';
  }

  function _renderGrid() {
    if (GC._gridRenderQueued) return;
    GC._gridRenderQueued = true;
    requestAnimationFrame(function () {
      GC._gridRenderQueued = false;
      _doRenderGrid();
    });
  }

  function _doRenderGrid() {
    var container = GC._$('gc-grid');
    if (!container) return;
    var participants = window.activeGroupCallParticipants || [];
    var count = participants.length;
    var ssUserId = GC._screenShareUserId;
    var hasSS = !!ssUserId && participants.some(function (p) { return p.uid === ssUserId; });
    var grid = _getGridLayout(count, hasSS);
    var videoBudget = _getVideoBudgetUids(participants);
    var budgetedStream = function (p) {
      var s = GC._participantStreams.get(p.uid);
      return videoBudget.has(p.uid) ? s : null;
    };

    if (count === 0) {
      container.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center text-white/50">' +
        '<span class="material-symbols-outlined text-5xl mb-3">group</span>' +
        '<p class="text-sm font-medium">Waiting for participants�</p>' +
        '</div>';
      container.className = 'w-full flex-1 min-h-0';
      return;
    }

    if (grid.layout === 'screenshare') {
      var mainParticipant = participants.find(function (p) { return p.uid === ssUserId; });
      var stripParticipants = participants.filter(function (p) { return p.uid !== ssUserId; });
      var mainStream = mainParticipant ? GC._participantStreams.get(mainParticipant.uid) : null;
      var mainMuted = mainParticipant ? GC._participantMuteState.get(mainParticipant.uid) : false;
      var mainVidOff = mainParticipant ? GC._participantVideoState.get(mainParticipant.uid) : true;
      var mainHtml = '<div class="w-full h-full">' + _getParticipantTile(
        mainParticipant ? mainParticipant.uid : '', mainParticipant ? mainParticipant.name : '', mainParticipant ? mainParticipant.avatar : '',
        mainMuted, mainVidOff, false, false, true, mainStream
      ) + '</div>';

      var stripHtml = '<div class="flex gap-1.5 p-1.5 overflow-x-auto">' +
        stripParticipants.map(function (p) {
          var s = budgetedStream(p);
          var m = GC._participantMuteState.get(p.uid);
          var v = GC._participantVideoState.get(p.uid);
          var spk = GC._lastSpeakerUid === p.uid;
          return '<div class="flex-shrink-0 w-24 h-32">' + _getParticipantTile(p.uid, p.name, p.avatar, m, v, spk, !!GC._reconnectAttempts[p.uid], false, s) + '</div>';
        }).join('') +
        '</div>';

      container.innerHTML = '<div class="flex flex-col h-full">' +
        '<div class="flex-1 min-h-0">' + mainHtml + '</div>' +
        stripHtml +
        '</div>';
      container.className = 'w-full h-full';
    } else if (GC._speakerViewMode && count > 1 && GC._lastSpeakerUid) {
      var speaker = participants.find(function (p) { return p.uid === GC._lastSpeakerUid; }) || participants[0];
      var others = participants.filter(function (p) { return p.uid !== speaker.uid; });
      var spkStream = GC._participantStreams.get(speaker.uid);
      var spkMuted = GC._participantMuteState.get(speaker.uid);
      var spkVidOff = GC._participantVideoState.get(speaker.uid);
      var spkHtml = '<div class="flex-1 min-h-0 p-1">' + _getParticipantTile(speaker.uid, speaker.name, speaker.avatar, spkMuted, spkVidOff, true, !!GC._reconnectAttempts[speaker.uid], false, spkStream) + '</div>';
      var stripHtml2 = '<div class="flex gap-1.5 p-1.5 overflow-x-auto" style="max-height:120px">' +
        others.map(function (p) {
          var s = budgetedStream(p);
          var m = GC._participantMuteState.get(p.uid);
          var v = GC._participantVideoState.get(p.uid);
          return '<div class="flex-shrink-0 w-20 h-28">' + _getParticipantTile(p.uid, p.name, p.avatar, m, v, false, !!GC._reconnectAttempts[p.uid], false, s) + '</div>';
        }).join('') +
        '</div>';
      container.innerHTML = '<div class="flex flex-col h-full">' + spkHtml + stripHtml2 + '</div>';
      container.className = 'w-full h-full';
    } else {
      var _total = count;
      var gridHtml = participants.map(function (p) {
        var s = budgetedStream(p);
        var m = GC._participantMuteState.get(p.uid);
        var v = GC._participantVideoState.get(p.uid);
        var spk = GC._lastSpeakerUid === p.uid;
        return _getParticipantTile(p.uid, p.name, p.avatar, m, v, spk, !!GC._reconnectAttempts[p.uid], false, s);
      }).join('');

      if (grid.layout === 'speaker-plus-two' && count === 3) {
        var speakerIdx = participants.findIndex(function (p) { return GC._lastSpeakerUid === p.uid; });
        if (speakerIdx < 0) speakerIdx = 0;
        var tiles = participants.map(function (p, i) {
          var s = budgetedStream(p);
          var m = GC._participantMuteState.get(p.uid);
          var v = GC._participantVideoState.get(p.uid);
          var spk = GC._lastSpeakerUid === p.uid;
          var sizeClass = (i === speakerIdx) ? 'col-span-2 row-span-1' : 'col-span-1 row-span-1';
          return '<div class="' + sizeClass + '">' + _getParticipantTile(p.uid, p.name, p.avatar, m, v, spk, !!GC._reconnectAttempts[p.uid], false, s) + '</div>';
        });
        container.innerHTML = '<div class="grid grid-cols-2 grid-rows-2 gap-1 h-full p-1">' + tiles.join('') + '</div>';
      } else {
        var gridCols = 'grid-cols-' + grid.cols;
        container.innerHTML = '<div class="grid ' + gridCols + ' gap-1 h-full p-1">' + gridHtml + '</div>';
      }
      container.className = 'w-full flex-1 min-h-0';
    }

    _bindTileInteractions();
    _attachParticipantStreams();
  }

  function _attachParticipantStreams() {
    var vids = document.querySelectorAll('[data-gc-video]');
    var budget = _getVideoBudgetUids(window.activeGroupCallParticipants || []);
    vids.forEach(function (vidEl) {
      var uid = vidEl.getAttribute('data-gc-video');
      if (budget && !budget.has(uid)) return;
      var stream = GC._participantStreams.get(uid);
      if (stream && vidEl.srcObject !== stream) {
        vidEl.srcObject = stream;
      }
    });
  }

  function _bindTileInteractions() {
    var tiles = document.querySelectorAll('[data-gc-uid]');
    tiles.forEach(function (tile) {
      if (tile.dataset.gcBound) return;
      tile.dataset.gcBound = '1';
      var uid = tile.getAttribute('data-gc-uid');
      var longPressTimer = null;

      tile.addEventListener('touchstart', function (_e) {
        longPressTimer = setTimeout(function () {
          longPressTimer = null;
          _showParticipantOptions(uid);
        }, 600);
      }, { passive: true });

      tile.addEventListener('touchend', function () {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      });

      tile.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        longPressTimer = setTimeout(function () {
          longPressTimer = null;
          _showParticipantOptions(uid);
        }, 600);
      });

      tile.addEventListener('mouseup', function () {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      });

      tile.addEventListener('mouseleave', function () {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      });
    });
  }

  function _showParticipantOptions(targetUid) {
    if (!targetUid) return;
    var isSelf = targetUid === GC._myUid;
    var participant = (window.activeGroupCallParticipants || []).find(function (p) { return p.uid === targetUid; });
    if (!participant) return;
    var hasJoined = GC._participantJoinTime.has(targetUid);
    var isMuted = GC._participantMuteState.get(targetUid) || false;
    var existing = GC._$('gc-participant-menu');
    if (existing) existing.remove();
    var muteLabel = isMuted ? 'Unmute' : 'Mute';
    var muteIcon = isMuted ? 'mic' : 'mic_off';
    var menuHtml = '<div id="gc-participant-menu" class="fixed inset-0 z-50 flex items-end justify-center" onclick="event.stopPropagation()">' +
      '<div class="absolute inset-0 bg-black/40" onclick="document.getElementById(\'gc-participant-menu\').remove()"></div>' +
      '<div class="relative bg-surface rounded-t-2xl w-full max-w-md p-4 pb-8 z-10 animate-slide-up">' +
      '<div class="flex items-center gap-3 mb-4 pb-3 border-b border-outline/20">' +
      '<div class="w-10 h-10 rounded-full overflow-hidden">' + _renderAvatar(participant.name, participant.avatar) + '</div>' +
      '<div><p class="font-semibold text-on-surface text-sm">' + GC._esc(participant.name) + '</p>' +
      '<p class="text-xs text-on-surface-variant">' + (isSelf ? 'You' : (hasJoined ? 'In call' : 'Invited � not joined')) + '</p></div>' +
      '</div>' +
      (isSelf
        ? '<button class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window.toggleMute();document.getElementById(\'gc-participant-menu\').remove()">' +
          '<span class="material-symbols-outlined">' + (CC.isMicMuted() ? 'mic' : 'mic_off') + '</span>' +
          '<span class="font-medium text-sm">' + (CC.isMicMuted() ? 'Unmute yourself' : 'Mute yourself') + '</span>' +
          '</button>'
        : (hasJoined ? '<button class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window.muteParticipant(\'' + GC._esc(targetUid) + '\');document.getElementById(\'gc-participant-menu\').remove()">' +
          '<span class="material-symbols-outlined">' + muteIcon + '</span>' +
          '<span class="font-medium text-sm">' + muteLabel + ' participant</span>' +
          '</button>' : '')) +
      (!isSelf ? '<button class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant/50 transition-colors text-red-500" onclick="window.removeFromCall(\'' + GC._esc(targetUid) + '\');document.getElementById(\'gc-participant-menu\').remove()">' +
      '<span class="material-symbols-outlined">person_remove</span>' +
      '<span class="font-medium text-sm">Remove from call</span>' +
      '</button>' : '') +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', menuHtml);
  }

  function _ensureGridContainer() {
    if (GC._gridContainer && GC._gridContainer.parentNode) return GC._gridContainer;
    var cs = GC._$('call-screen');
    if (!cs) return null;
    var existing = GC._$('gc-grid');
    if (existing) { GC._gridContainer = existing; return GC._gridContainer; }
    var div = document.createElement('div');
    div.id = 'gc-grid';
    div.className = 'w-full flex-1 min-h-0';
    var callContent = cs.querySelector('.relative') || cs;
    callContent.appendChild(div);
    GC._gridContainer = div;
    return GC._gridContainer;
  }

  function _showGroupCallScreen() {
    var cs = GC._$('call-screen');
    if (cs) cs.classList.remove('hidden');
    var typeLabel = GC._currentCallType === 'video' ? 'Group Video Call' : 'Group Voice Call';
    GC._txt('call-name', typeLabel);
    GC._show('call-screen');
    var camBtn = GC._$('btn-cam');
    var ssBtn = GC._$('btn-screenshare');
    if (camBtn) camBtn.classList.toggle('hidden', GC._currentCallType === 'voice');
    if (ssBtn) {
      ssBtn.classList.remove('hidden');
      ssBtn.onclick = function () { if (typeof toggleGroupScreenShare === 'function') toggleGroupScreenShare(); };
    }
    var swBtn = GC._$('btn-switch-video');
    if (swBtn) swBtn.classList.toggle('hidden', GC._currentCallType !== 'video');
    var kpBtn = GC._$('btn-keypad');
    if (kpBtn) kpBtn.classList.toggle('hidden', GC._currentCallType !== 'voice');
    var blurBtn = GC._$('btn-blur');
    if (blurBtn) blurBtn.classList.toggle('hidden', GC._currentCallType !== 'video');
    var addBtn = GC._$('btn-add-participant');
    if (addBtn) addBtn.classList.add('hidden');
    var rv = GC._$('remote-video');
    var lvc = GC._$('local-video-container');
    if (rv) rv.classList.add('hidden');
    if (lvc) {
      lvc.classList.remove('hidden');
      lvc.style.cssText = 'position:absolute;bottom:120px;right:16px;width:120px;height:160px;z-20;';
      var lv = GC._$('local-video');
      if (lv && CC.getLocalStream()) {
        lv.srcObject = CC.getLocalStream();
        lv.style.objectFit = 'cover';
      }
      if (GC._currentCallType === 'voice') lvc.classList.add('hidden');
    }
    GC._show('call-info-section');
    var av = GC._$('call-avatar');
    if (av) {
      var groupChat = typeof App !== 'undefined' && App.currentChat;
      var groupName = groupChat?.name || 'Group';
      var groupPhoto = groupChat?.photoURL || '';
      var groupInitials = groupName[0]?.toUpperCase() || 'G';
      if (groupPhoto) {
        av.className = 'w-32 h-32 rounded-full border-4 border-primary/30 overflow-hidden bg-white/10 animate-pulse';
        av.innerHTML = '<img src="' + GC._esc(groupPhoto) + '" class="w-full h-full object-cover" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="w-full h-full flex items-center justify-center text-5xl" style="display:none">' + GC._esc(groupInitials) + '</div>';
      } else {
        av.className = 'w-32 h-32 rounded-full border-4 border-primary/30 flex items-center justify-center text-5xl bg-white/10 animate-pulse';
        av.textContent = groupInitials;
      }
    }
    _addParticipantCountBadge();
    _addInviteButton();
    try { history.pushState({ callActive: true }, ''); } catch (_) {}
  }

  function _showGroupCallInvite(callId, invite) {
    if (!callId || !invite) return;
    if (GC._isBusyInCall()) return;
    var existing = GC._$('gc-incoming-overlay');
    if (existing) return;
    var inviterName = invite.fromUserName || 'Someone';
    var callTypeLabel = invite.callType === 'video' ? 'Video Call' : 'Voice Call';
    var overlayHtml = '<div id="gc-incoming-overlay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">' +
      '<div class="bg-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">' +
      '<div class="w-16 h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto mb-4">' +
      '<span class="material-symbols-outlined text-3xl">group</span></div>' +
      '<h3 class="text-on-surface font-bold text-lg mb-1">' + GC._esc(inviterName) + '</h3>' +
      '<p class="text-on-surface-variant text-sm mb-6">Group ' + GC._esc(callTypeLabel) + '</p>' +
      '<div class="flex gap-3 justify-center">' +
      '<button onclick="window.declineGroupCall(\'' + GC._esc(callId) + '\')" class="px-6 py-2.5 bg-red-500/15 text-red-500 rounded-full font-medium text-sm hover:bg-red-500/25 transition-colors">Decline</button>' +
      '<button onclick="window.joinGroupCall(\'' + GC._esc(callId) + '\')" class="px-6 py-2.5 bg-green-500 text-white rounded-full font-medium text-sm hover:bg-green-600 transition-colors">Join</button>' +
      '</div></div></div>';
    _shownInviteCallId = callId;
    document.body.insertAdjacentHTML('beforeend', overlayHtml);
    if (typeof CC.playSound === 'function') { try { CC.playSound('callRing'); } catch (_) {} }
    if (navigator.vibrate) navigator.vibrate([700, 250, 700]);
  }

  function _hideGroupCallInvite(callId) {
    if (callId && _shownInviteCallId && _shownInviteCallId !== callId) return;
    var ov = GC._$('gc-incoming-overlay');
    var wasShown = false;
    if (ov) { ov.remove(); wasShown = true; }
    if (_shownInviteCallId) wasShown = true;
    _shownInviteCallId = null;
    if (wasShown && typeof CC.stopExistingRingtone === 'function') { try { CC.stopExistingRingtone(); } catch (_) {} }
  }

  var _speakerAudioContext = null;
  var _speakerAudioSource = null;
  var _speakerCachedStream = null;
  var _speakerAnalyser = null;

  function _startSpeakerDetection() {
    _stopSpeakerDetection();
    // Reuse a single AudioContext to prevent resource leak
    try {
      _speakerAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {}
    var _speakerTick = async function () {
      if (!GC._isInGroupCall()) return;
      var maxLevel = 0;
      var maxUid = null;
      var myStream = CC.getLocalStream();
      if (myStream && _speakerAudioContext) {
        try {
          var audioTrack = myStream.getAudioTracks()[0];
          if (audioTrack && audioTrack.enabled) {
            if (_speakerAudioContext.state === 'suspended') {
              await _speakerAudioContext.resume();
            }
            if (!_speakerAudioSource || _speakerCachedStream !== myStream) {
              if (_speakerAudioSource) { try { _speakerAudioSource.disconnect(); } catch (_) {} }
              _speakerAudioSource = _speakerAudioContext.createMediaStreamSource(myStream);
              _speakerCachedStream = myStream;
              _speakerAnalyser = _speakerAudioContext.createAnalyser();
              _speakerAnalyser.fftSize = 256;
              try { _speakerAudioSource.connect(_speakerAnalyser); } catch (_) {}
            }
            if (_speakerAnalyser) {
              var data = new Uint8Array(_speakerAnalyser.frequencyBinCount);
              _speakerAnalyser.getByteFrequencyData(data);
              var level = data.reduce(function (a, b) { return a + b; }, 0) / data.length;
              GC._audioLevelCache.set(GC._myUid, level);
              if (level > maxLevel) { maxLevel = level; maxUid = GC._myUid; }
            }
          }
        } catch (_) {}
      }
      for (var i = 0; i < window.groupCallPeerConnections.size; i++) {
        var entry = Array.from(window.groupCallPeerConnections.entries())[i];
        var pUid = entry[0];
        var pc = entry[1];
        try {
          var stats = await pc.getStats();
          stats.forEach(function (report) {
            if (report.type === 'inbound-rtp' && report.kind === 'audio' && report.audioLevel != null) {
              var level = report.audioLevel * 100;
              GC._audioLevelCache.set(pUid, level);
              if (level > maxLevel) { maxLevel = level; maxUid = pUid; }
            }
          });
        } catch (_) {}
      }
      var threshold = 8;
      if (maxLevel > threshold && maxUid !== GC._lastSpeakerUid) {
        GC._lastSpeakerUid = maxUid;
        _renderGrid();
      } else if (maxLevel <= threshold && GC._lastSpeakerUid) {
        GC._lastSpeakerUid = null;
        _renderGrid();
      }
      if (!GC._isInGroupCall()) return;
      GC._speakerCheckInterval = setTimeout(_speakerTick, Math.max(500, Math.min(1500, 300 * ((window.activeGroupCallParticipants || []).length || 1))));
    };
    GC._speakerCheckInterval = setTimeout(_speakerTick, 500);
  }

  function _stopSpeakerDetection() {
    if (GC._speakerCheckInterval) {
      clearTimeout(GC._speakerCheckInterval);
      GC._speakerCheckInterval = null;
    }
    if (_speakerAudioSource) { try { _speakerAudioSource.disconnect(); } catch (_) {} _speakerAudioSource = null; }
    _speakerCachedStream = null;
    _speakerAnalyser = null;
    if (_speakerAudioContext) {
      try {
        if (_speakerAudioContext.state !== 'closed') {
          _speakerAudioContext.close();
        }
      } catch (_) {}
      _speakerAudioContext = null;
    }
    GC._lastSpeakerUid = null;
    GC._audioLevelCache.clear();
  }

  function _updateGridUI() {
    var cs = GC._$('call-screen');
    if (!cs) return;
    var gcGrid = GC._$('gc-grid');
    if (!gcGrid) {
      _ensureGridContainer();
    }
    _renderGrid();
    _updateParticipantCountBadge();
    var gridEl = GC._$('gc-grid');
    var hasTiles = gridEl && gridEl.querySelector('[data-gc-uid]');
    var infoSec = GC._$('call-info-section');
    if (infoSec) infoSec.classList.toggle('hidden', !!hasTiles);
  }

  function _addParticipantCountBadge() {
    var existing = GC._$('gc-participant-count');
    if (existing) existing.remove();
    var badge = document.createElement('div');
    badge.id = 'gc-participant-count';
    badge.className = 'absolute top-4 left-4 z-20 bg-white/10 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 text-white text-xs font-semibold';
    badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">group</span> <span id="gc-participant-count-text">0</span>';
    var cs = GC._$('call-screen');
    if (cs) cs.appendChild(badge);
    _updateParticipantCountBadge();
  }

  function _updateParticipantCountBadge() {
    var countEl = GC._$('gc-participant-count-text');
    if (countEl) countEl.textContent = (window.activeGroupCallParticipants || []).length;
  }

  function _addInviteButton() {
    var controls = GC._$('call-controls');
    if (!controls || GC._$('btn-gc-invite')) return;
    if (!GC._isInitiator) return;
    var inviteBtn = document.createElement('button');
    inviteBtn.id = 'btn-gc-invite';
    inviteBtn.className = 'w-14 h-14 min-w-[48px] min-h-[48px] bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all text-white';
    inviteBtn.setAttribute('aria-label', 'Invite participant');
    inviteBtn.innerHTML = '<span class="material-symbols-outlined">person_add</span>';
    inviteBtn.onclick = function () { if (typeof openCallPicker === 'function') openCallPicker(); };
    var endBtn = controls.querySelector('[data-action="endCall"]');
    if (endBtn) controls.insertBefore(inviteBtn, endBtn);
    else controls.appendChild(inviteBtn);
  }

  GC._renderAvatar = _renderAvatar;
  GC._getGridLayout = _getGridLayout;
  GC._getParticipantTile = _getParticipantTile;
  GC._renderGrid = _renderGrid;
  GC._doRenderGrid = _doRenderGrid;
  GC._attachParticipantStreams = _attachParticipantStreams;
  GC._bindTileInteractions = _bindTileInteractions;
  GC._showParticipantOptions = _showParticipantOptions;
  GC._ensureGridContainer = _ensureGridContainer;
  GC._showGroupCallScreen = _showGroupCallScreen;
  GC._showGroupCallInvite = _showGroupCallInvite;
  GC._hideGroupCallInvite = _hideGroupCallInvite;
  GC._startSpeakerDetection = _startSpeakerDetection;
  GC._stopSpeakerDetection = _stopSpeakerDetection;
  GC._updateGridUI = _updateGridUI;

})();
