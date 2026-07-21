'use strict';
(function () {
  var _GRID_MAX = 4;
  var _RECONNECT_INTERVAL_MS = 3000;
  var _RECONNECT_MAX_ATTEMPTS = 5;
  var _INVITE_TIMEOUT_MS = 30000;
  var _speakerCheckInterval = null;
  var _gridRenderQueued = false;
  var _currentCallId = null;
  var _currentCallType = 'voice';
  var _isInitiator = false;
  var _myUid = null;
  var _gridContainer = null;
  var _screenShareUserId = null;
  var _reconnectTimers = {};
  var _reconnectAttempts = {};
  var _inviteTimers = {};
  var _unsubCallDoc = null;
  var _unsubInvites = null;
  var _unsubParticipantCandidates = {};
  var _participantStreams = new Map();
  var _participantMuteState = new Map();
  var _participantVideoState = new Map();
  var _participantJoinTime = new Map();
  var _audioLevelCache = new Map();
  var _lastSpeakerUid = null;

  var _db = function() { return App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };
  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };
  function _me() { return (window.App && window.App.currentUser) ? window.App.currentUser : null; }
  function _$(id) { return document.getElementById(id); }
  function _txt(id, v) { var e = _$(id); if (e) e.textContent = v; }
  function _show(id) { var e = _$(id); if (e) e.classList.remove('hidden'); }
  function _hide(id) { var e = _$(id); if (e) e.classList.add('hidden'); }
  function _toast(msg, t) { if (App && App.toast) App.toast(msg, t); else if (typeof window.showToast === 'function') window.showToast(msg, t); }
  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  function _firestore() { return _db(); }
  function _isInGroupCall() { return !!_currentCallId; }
  function _isCallActive() { return (window.App && App.callActive) ? true : false; }

  function _getParticipantCount() {
    return activeGroupCallParticipants ? activeGroupCallParticipants.length : 0;
  }

  function _canAddParticipant() {
    return _getParticipantCount() < _GRID_MAX;
  }

  function _getMyDetails() {
    var m = _me();
    return {
      uid: _uid(),
      name: m ? (m.displayName || m.email || 'User') : 'User',
      avatar: m ? (m.photoURL || '') : '',
      isMuted: !!micMuted,
      isVideoOff: !!cameraOff
    };
  }

  function _renderAvatar(name, avatar, size) {
    var initials = (name || '?')[0].toUpperCase();
    if (avatar) {
      return '<img src="' + _esc(avatar) + '" class="w-full h-full object-cover rounded-lg" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
        '<div class="w-full h-full rounded-lg bg-primary/15 text-primary items-center justify-center font-bold text-2xl" style="display:none">' + _esc(initials) + '</div>';
    }
    return '<div class="w-full h-full rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-2xl">' + _esc(initials) + '</div>';
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
      default: return { cols: 2, rows: 2, layout: 'grid-2x2' };
    }
  }

  function _getParticipantTile(uid, name, avatar, isMuted, isVideoOff, isSpeaking, isReconnecting, isScreenSharing, stream) {
    var speakingClass = isSpeaking ? 'ring-2 ring-green-400 shadow-lg shadow-green-400/20' : '';
    var reconnectClass = isReconnecting ? 'opacity-60' : '';
    var screenShareClass = isScreenSharing ? 'ring-2 ring-blue-400' : '';
    var videoStyle = (!isVideoOff && stream) ? '' : 'display:none;';
    var avatarStyle = (isVideoOff || !stream) ? '' : 'display:none;';
    var muteIndicator = isMuted ? '<div class="absolute top-2 right-2 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center"><span class="material-symbols-outlined text-white" style="font-size:12px">mic_off</span></div>' : '';
    var reconnectOverlay = isReconnecting ? '<div class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg z-10"><div class="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin mb-2"></div><span class="text-white text-xs font-medium">Reconnecting…</span></div>' : '';
    var screenShareBadge = isScreenSharing ? '<div class="absolute top-2 left-2 bg-blue-500 rounded px-1.5 py-0.5 flex items-center gap-1 z-10"><span class="material-symbols-outlined text-white" style="font-size:10px">screen_share</span><span class="text-white text-[10px] font-medium">Sharing</span></div>' : '';

    return '<div class="relative overflow-hidden rounded-lg bg-gray-900 ' + speakingClass + ' ' + reconnectClass + ' ' + screenShareClass + ' transition-all duration-200" data-gc-uid="' + _esc(uid) + '">' +
      '<video class="w-full h-full object-cover rounded-lg" style="' + videoStyle + '" autoplay playsinline muted data-gc-video="' + _esc(uid) + '"></video>' +
      '<div class="w-full h-full flex items-center justify-center rounded-lg" style="' + avatarStyle + '">' +
      _renderAvatar(name, avatar) +
      '</div>' +
      muteIndicator +
      screenShareBadge +
      reconnectOverlay +
      '<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 flex items-center justify-between">' +
      '<span class="text-white text-xs font-medium truncate">' + _esc(name || 'Unknown') + '</span>' +
      '<div class="flex items-center gap-1" data-gc-controls="' + _esc(uid) + '"></div>' +
      '</div>' +
      '</div>';
  }

  function _renderGrid() {
    if (_gridRenderQueued) return;
    _gridRenderQueued = true;
    requestAnimationFrame(function () {
      _gridRenderQueued = false;
      _doRenderGrid();
    });
  }

  function _doRenderGrid() {
    var container = _$('gc-grid');
    if (!container) return;
    var participants = activeGroupCallParticipants || [];
    var count = participants.length;
    var ssUserId = _screenShareUserId;
    var hasSS = !!ssUserId && participants.some(function (p) { return p.uid === ssUserId; });
    var grid = _getGridLayout(count, hasSS);

    if (count === 0) {
      container.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center text-white/50">' +
        '<span class="material-symbols-outlined text-5xl mb-3">group</span>' +
        '<p class="text-sm font-medium">Waiting for participants…</p>' +
        '</div>';
      container.className = 'w-full h-full';
      return;
    }

    if (grid.layout === 'screenshare') {
      var mainParticipant = participants.find(function (p) { return p.uid === ssUserId; });
      var stripParticipants = participants.filter(function (p) { return p.uid !== ssUserId; });
      var mainStream = mainParticipant ? _participantStreams.get(mainParticipant.uid) : null;
      var mainMuted = mainParticipant ? _participantMuteState.get(mainParticipant.uid) : false;
      var mainVidOff = mainParticipant ? _participantVideoState.get(mainParticipant.uid) : true;
      var mainHtml = '<div class="w-full h-full">' + _getParticipantTile(
        mainParticipant ? mainParticipant.uid : '', mainParticipant ? mainParticipant.name : '', mainParticipant ? mainParticipant.avatar : '',
        mainMuted, mainVidOff, false, false, true, mainStream
      ) + '</div>';

      var stripHtml = '<div class="flex gap-1.5 p-1.5 overflow-x-auto">' +
        stripParticipants.map(function (p) {
          var s = _participantStreams.get(p.uid);
          var m = _participantMuteState.get(p.uid);
          var v = _participantVideoState.get(p.uid);
          var spk = _lastSpeakerUid === p.uid;
          return '<div class="flex-shrink-0 w-24 h-32">' + _getParticipantTile(p.uid, p.name, p.avatar, m, v, spk, !!_reconnectAttempts[p.uid], false, s) + '</div>';
        }).join('') +
        '</div>';

      container.innerHTML = '<div class="flex flex-col h-full">' +
        '<div class="flex-1 min-h-0">' + mainHtml + '</div>' +
        stripHtml +
        '</div>';
      container.className = 'w-full h-full';
    } else {
      var total = count;
      var gridHtml = participants.map(function (p) {
        var s = _participantStreams.get(p.uid);
        var m = _participantMuteState.get(p.uid);
        var v = _participantVideoState.get(p.uid);
        var spk = _lastSpeakerUid === p.uid;
        return _getParticipantTile(p.uid, p.name, p.avatar, m, v, spk, !!_reconnectAttempts[p.uid], false, s);
      }).join('');

      if (grid.layout === 'speaker-plus-two' && count === 3) {
        var tiles = participants.map(function (p, i) {
          var s = _participantStreams.get(p.uid);
          var m = _participantMuteState.get(p.uid);
          var v = _participantVideoState.get(p.uid);
          var spk = _lastSpeakerUid === p.uid;
          var sizeClass = (i === 0) ? 'col-span-2 row-span-1' : 'col-span-1 row-span-1';
          return '<div class="' + sizeClass + '">' + _getParticipantTile(p.uid, p.name, p.avatar, m, v, spk, !!_reconnectAttempts[p.uid], false, s) + '</div>';
        });
        container.innerHTML = '<div class="grid grid-cols-2 grid-rows-2 gap-1 h-full p-1">' + tiles.join('') + '</div>';
      } else {
        var gridCols = 'grid-cols-' + grid.cols;
        container.innerHTML = '<div class="grid ' + gridCols + ' gap-1 h-full p-1">' + gridHtml + '</div>';
      }
      container.className = 'w-full h-full';
    }

    _bindTileInteractions();
    _attachParticipantStreams();
  }

  function _attachParticipantStreams() {
    var vids = document.querySelectorAll('[data-gc-video]');
    vids.forEach(function (vidEl) {
      var uid = vidEl.getAttribute('data-gc-video');
      var stream = _participantStreams.get(uid);
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

      tile.addEventListener('touchstart', function (e) {
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
    if (!targetUid || targetUid === _myUid) return;
    if (!_isInitiator) return;
    var participant = (activeGroupCallParticipants || []).find(function (p) { return p.uid === targetUid; });
    if (!participant) return;
    var hasJoined = _participantJoinTime.has(targetUid);
    var existing = _$('gc-participant-menu');
    if (existing) existing.remove();
    var menuHtml = '<div id="gc-participant-menu" class="fixed inset-0 z-50 flex items-end justify-center" onclick="event.stopPropagation()">' +
      '<div class="absolute inset-0 bg-black/40" onclick="document.getElementById(\'gc-participant-menu\').remove()"></div>' +
      '<div class="relative bg-surface rounded-t-2xl w-full max-w-md p-4 pb-8 z-10 animate-slide-up">' +
      '<div class="flex items-center gap-3 mb-4 pb-3 border-b border-outline/20">' +
      '<div class="w-10 h-10 rounded-full overflow-hidden">' + _renderAvatar(participant.name, participant.avatar) + '</div>' +
      '<div><p class="font-semibold text-on-surface text-sm">' + _esc(participant.name) + '</p>' +
      '<p class="text-xs text-on-surface-variant">' + (hasJoined ? 'In call' : 'Invited — not joined') + '</p></div>' +
      '</div>' +
      '<button class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant/50 transition-colors text-red-500" onclick="window.removeFromCall(\'' + _esc(targetUid) + '\');document.getElementById(\'gc-participant-menu\').remove()">' +
      '<span class="material-symbols-outlined">person_remove</span>' +
      '<span class="font-medium text-sm">Remove from call</span>' +
      '</button>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', menuHtml);
  }

  function _ensureGridContainer() {
    if (_gridContainer && _gridContainer.parentNode) return _gridContainer;
    var cs = _$('call-screen');
    if (!cs) return null;
    var existing = _$('gc-grid');
    if (existing) { _gridContainer = existing; return _gridContainer; }
    var div = document.createElement('div');
    div.id = 'gc-grid';
    div.className = 'w-full h-full';
    var callContent = cs.querySelector('.relative') || cs;
    callContent.appendChild(div);
    _gridContainer = div;
    return _gridContainer;
  }

  async function _setupPeerConnectionForParticipant(targetUid) {
    if (!_firestore() || !_currentCallId) return null;
    var rtcConfig = await getRtcConfig();
    var pc = new RTCPeerConnection(rtcConfig);

    if (localCallStream) {
      localCallStream.getTracks().forEach(function (track) {
        pc.addTrack(track, localCallStream);
      });
    }

    pc.onicecandidate = function (e) {
      if (e.candidate && _firestore() && _currentCallId) {
        _firestore().collection('groupCalls').doc(_currentCallId).collection('candidates').add({
          candidate: e.candidate.toJSON(),
          sender: _myUid,
          receiver: targetUid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function () {});
      }
    };

    pc.ontrack = function (e) {
      var stream = e.streams[0];
      if (stream) {
        _participantStreams.set(targetUid, stream);
        _renderGrid();
      }
    };

    pc.oniceconnectionstatechange = function () {
      var iceState = pc.iceConnectionState;
      if (iceState === 'connected' || iceState === 'completed') {
        delete _reconnectAttempts[targetUid];
        delete _reconnectTimers[targetUid];
        _renderGrid();
      } else if (iceState === 'disconnected') {
        _reconnectAttempts[targetUid] = (_reconnectAttempts[targetUid] || 0) + 1;
        _renderGrid();
        _scheduleReconnect(targetUid);
      } else if (iceState === 'failed') {
        _reconnectAttempts[targetUid] = (_reconnectAttempts[targetUid] || 0) + 1;
        _renderGrid();
        if (_reconnectAttempts[targetUid] < _RECONNECT_MAX_ATTEMPTS) {
          _scheduleReconnect(targetUid);
        }
      }
    };

    groupCallPeerConnections.set(targetUid, pc);
    return pc;
  }

  function _scheduleReconnect(targetUid) {
    if (_reconnectTimers[targetUid]) return;
    _reconnectTimers[targetUid] = setTimeout(async function () {
      _reconnectTimers[targetUid] = null;
      if (!_currentCallId || !_firestore()) return;
      var attempts = _reconnectAttempts[targetUid] || 0;
      if (attempts >= _RECONNECT_MAX_ATTEMPTS) {
        _removeParticipantFromGrid(targetUid);
        return;
      }
      var pc = groupCallPeerConnections.get(targetUid);
      if (pc && pc.signalingState !== 'closed') {
        try { pc.restartIce(); } catch (_) {}
      } else {
        await _setupPeerConnectionForParticipant(targetUid);
        var newPc = groupCallPeerConnections.get(targetUid);
        if (newPc) {
          try {
            var offer = await newPc.createOffer();
            await newPc.setLocalDescription(offer);
            await _firestore().collection('groupCalls').doc(_currentCallId).collection('signaling').add({
              type: 'renegotiate',
              offer: { sdp: offer.sdp, type: offer.type },
              from: _myUid,
              to: targetUid,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          } catch (_) {}
        }
      }
    }, _RECONNECT_INTERVAL_MS * (attempts + 1));
  }

  function _removeParticipantFromGrid(targetUid) {
    _participantStreams.delete(targetUid);
    _participantMuteState.delete(targetUid);
    _participantVideoState.delete(targetUid);
    _participantJoinTime.delete(targetUid);
    _audioLevelCache.delete(targetUid);
    if (_screenShareUserId === targetUid) _screenShareUserId = null;
    activeGroupCallParticipants = (activeGroupCallParticipants || []).filter(function (p) { return p.uid !== targetUid; });
    _closePeerConnection(targetUid);
    _renderGrid();
  }

  function _closePeerConnection(targetUid) {
    var pc = groupCallPeerConnections.get(targetUid);
    if (pc) {
      try { pc.close(); } catch (_) {}
      groupCallPeerConnections.delete(targetUid);
    }
    var unsubs = _unsubParticipantCandidates[targetUid];
    if (unsubs) {
      unsubs.forEach(function (fn) { try { fn(); } catch (_) {} });
      delete _unsubParticipantCandidates[targetUid];
    }
    if (_reconnectTimers[targetUid]) {
      clearTimeout(_reconnectTimers[targetUid]);
      delete _reconnectTimers[targetUid];
    }
    delete _reconnectAttempts[targetUid];
  }

  function _listenToCallDoc(callId) {
    if (!_firestore()) return;
    if (_unsubCallDoc) { try { _unsubCallDoc(); } catch (_) {} }
    _unsubCallDoc = _firestore().collection('groupCalls').doc(callId).onSnapshot(function (doc) {
      var data = doc.data();
      if (!data) return;
      var incomingParticipants = data.participantIds || [];
      var myInList = incomingParticipants.indexOf(_myUid) !== -1;
      if (data.status === 'ended' || (data.status === 'cancelled' && !myInList)) {
        _toast('Group call ended', 'info');
        leaveGroupCall();
        return;
      }
      if (data.screenShareUid && data.screenShareUid !== _screenShareUserId) {
        _screenShareUserId = data.screenShareUid;
        _renderGrid();
      } else if (!data.screenShareUid && _screenShareUserId) {
        _screenShareUserId = null;
        _renderGrid();
      }
      incomingParticipants.forEach(function (pUid) {
        if (pUid === _myUid) return;
        var existing = (activeGroupCallParticipants || []).find(function (p) { return p.uid === pUid; });
        if (!existing) {
          var details = data.participantDetails && data.participantDetails[pUid];
          var newParticipant = {
            uid: pUid,
            name: details ? details.name : 'Participant',
            avatar: details ? (details.avatar || '') : '',
            isMuted: details ? !!details.isMuted : false,
            isVideoOff: details ? !!details.isVideoOff : true,
            joinedAt: details ? details.joinedAt : null
          };
          activeGroupCallParticipants.push(newParticipant);
          if (details && details.isMuted !== undefined) _participantMuteState.set(pUid, details.isMuted);
          if (details && details.isVideoOff !== undefined) _participantVideoState.set(pUid, details.isVideoOff);
          if (!groupCallPeerConnections.has(pUid)) {
            _initiatePeerConnectionTo(pUid);
          }
        }
      });
      var toRemove = [];
      (activeGroupCallParticipants || []).forEach(function (p) {
        if (incomingParticipants.indexOf(p.uid) === -1 && p.uid !== _myUid) {
          toRemove.push(p.uid);
        }
      });
      toRemove.forEach(function (uid) {
        _removeParticipantFromGrid(uid);
      });
      if (data.participantDetails) {
        Object.keys(data.participantDetails).forEach(function (pUid) {
          var det = data.participantDetails[pUid];
          if (det && det.isMuted !== undefined) _participantMuteState.set(pUid, det.isMuted);
          if (det && det.isVideoOff !== undefined) _participantVideoState.set(pUid, det.isVideoOff);
        });
        _renderGrid();
      }
    }, function (err) {
      console.warn('[GroupCall] Call doc listener error:', err);
    });
  }

  function _listenToInvites(callId) {
    if (!_firestore()) return;
    if (_unsubInvites) { try { _unsubInvites(); } catch (_) {} }
    _unsubInvites = _firestore().collection('groupCalls').doc(callId).collection('invites')
      .where('status', '==', 'pending')
      .onSnapshot(function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === 'added' || change.type === 'modified') {
            var invite = change.doc.data();
            if (invite.toUserId === _myUid && invite.status === 'pending') {
              _showGroupCallInvite(callId, invite);
            }
          }
          if (change.type === 'removed') {
            var removed = change.doc.data();
            if (removed && removed.toUserId === _myUid) {
              _hideGroupCallInvite();
            }
          }
        });
      }, function (err) {
        console.warn('[GroupCall] Invites listener error:', err);
      });
  }

  function _listenToSignaling(callId) {
    if (!_firestore()) return;
    var myUid = _myUid;
    _firestore().collection('groupCalls').doc(callId).collection('signaling')
      .orderBy('createdAt')
      .onSnapshot(function (snap) {
        snap.docChanges().forEach(async function (change) {
          if (change.type !== 'added') return;
          var sig = change.doc.data();
          if (sig.to !== myUid) return;
          if (sig.type === 'offer') {
            await _handleIncomingOffer(callId, sig);
          } else if (sig.type === 'answer') {
            await _handleIncomingAnswer(sig);
          } else if (sig.type === 'renegotiate') {
            await _handleRenegotiate(callId, sig);
          }
          try { await change.doc.ref.delete(); } catch (_) {}
        });
      }, function () {});
  }

  async function _initiatePeerConnectionTo(targetUid) {
    var pc = await _setupPeerConnectionForParticipant(targetUid);
    if (!pc) return;
    try {
      var offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (_firestore() && _currentCallId) {
        await _firestore().collection('groupCalls').doc(_currentCallId).collection('signaling').add({
          type: 'offer',
          offer: { sdp: offer.sdp, type: offer.type },
          from: _myUid,
          to: targetUid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (_) {}
  }

  async function _handleIncomingOffer(callId, sig) {
    var senderUid = sig.from;
    var pc = groupCallPeerConnections.get(senderUid);
    if (pc && pc.signalingState !== 'closed') {
      try { pc.close(); } catch (_) {}
      groupCallPeerConnections.delete(senderUid);
    }
    pc = await _setupPeerConnectionForParticipant(senderUid);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sig.offer));
      var answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await _firestore().collection('groupCalls').doc(callId).collection('signaling').add({
        type: 'answer',
        answer: { sdp: answer.sdp, type: answer.type },
        from: _myUid,
        to: senderUid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (_) {}
  }

  async function _handleIncomingAnswer(sig) {
    var senderUid = sig.from;
    var pc = groupCallPeerConnections.get(senderUid);
    if (!pc || pc.signalingState !== 'have-local-offer') return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sig.answer));
    } catch (_) {}
  }

  async function _handleRenegotiate(callId, sig) {
    var senderUid = sig.from;
    var pc = groupCallPeerConnections.get(senderUid);
    if (pc && pc.signalingState !== 'closed') {
      try { pc.close(); } catch (_) {}
      groupCallPeerConnections.delete(senderUid);
    }
    pc = await _setupPeerConnectionForParticipant(senderUid);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sig.offer));
      var answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await _firestore().collection('groupCalls').doc(callId).collection('signaling').add({
        type: 'answer',
        answer: { sdp: answer.sdp, type: answer.type },
        from: _myUid,
        to: senderUid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (_) {}
  }

  async function _listenToIncomingCandidates(callId) {
    if (!_firestore()) return;
    var myUid = _myUid;
    _firestore().collection('groupCalls').doc(callId).collection('candidates')
      .orderBy('createdAt')
      .onSnapshot(function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === 'added') {
            var c = change.doc.data();
            if (c.sender !== myUid && c.receiver === myUid) {
              var pc = groupCallPeerConnections.get(c.sender);
              if (pc) {
                pc.addIceCandidate(new RTCIceCandidate(c.candidate)).catch(function () {});
              }
            }
          }
        });
      }, function () {});
  }

  function _showGroupCallInvite(callId, invite) {
    var existing = _$('gc-incoming-overlay');
    if (existing) return;
    var inviterName = invite.fromUserName || 'Someone';
    var callTypeLabel = invite.callType === 'video' ? 'Video Call' : 'Voice Call';
    var overlayHtml = '<div id="gc-incoming-overlay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">' +
      '<div class="bg-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">' +
      '<div class="w-16 h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto mb-4">' +
      '<span class="material-symbols-outlined text-3xl">group</span></div>' +
      '<h3 class="text-on-surface font-bold text-lg mb-1">' + _esc(inviterName) + '</h3>' +
      '<p class="text-on-surface-variant text-sm mb-6">Group ' + _esc(callTypeLabel) + '</p>' +
      '<div class="flex gap-3 justify-center">' +
      '<button onclick="window.declineGroupCall(\'' + _esc(callId) + '\')" class="px-6 py-2.5 bg-red-500/15 text-red-500 rounded-full font-medium text-sm hover:bg-red-500/25 transition-colors">Decline</button>' +
      '<button onclick="window.joinGroupCall(\'' + _esc(callId) + '\')" class="px-6 py-2.5 bg-green-500 text-white rounded-full font-medium text-sm hover:bg-green-600 transition-colors">Join</button>' +
      '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', overlayHtml);
    if (navigator.vibrate) navigator.vibrate([700, 250, 700]);
  }

  function _hideGroupCallInvite() {
    var ov = _$('gc-incoming-overlay');
    if (ov) ov.remove();
  }

  function _startSpeakerDetection() {
    _stopSpeakerDetection();
    _speakerCheckInterval = setInterval(async function () {
      if (!_isInGroupCall()) return;
      var maxLevel = 0;
      var maxUid = null;
      var myStream = localCallStream;
      if (myStream) {
        try {
          var audioTrack = myStream.getAudioTracks()[0];
          if (audioTrack && audioTrack.enabled) {
            var ac = new AudioContext();
            var src = ac.createMediaStreamSource(myStream);
            var analyser = ac.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            var data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
            var level = data.reduce(function (a, b) { return a + b; }, 0) / data.length;
            _audioLevelCache.set(_myUid, level);
            if (level > maxLevel) { maxLevel = level; maxUid = _myUid; }
            src.disconnect();
            ac.close();
          }
        } catch (_) {}
      }
      for (var i = 0; i < groupCallPeerConnections.size; i++) {
        var entry = Array.from(groupCallPeerConnections.entries())[i];
        var pUid = entry[0];
        var pc = entry[1];
        try {
          var stats = await pc.getStats();
          stats.forEach(function (report) {
            if (report.type === 'inbound-rtp' && report.kind === 'audio' && report.audioLevel != null) {
              var level = report.audioLevel * 100;
              _audioLevelCache.set(pUid, level);
              if (level > maxLevel) { maxLevel = level; maxUid = pUid; }
            }
          });
        } catch (_) {}
      }
      var threshold = 8;
      if (maxLevel > threshold && maxUid !== _lastSpeakerUid) {
        _lastSpeakerUid = maxUid;
        _renderGrid();
      } else if (maxLevel <= threshold && _lastSpeakerUid) {
        _lastSpeakerUid = null;
        _renderGrid();
      }
    }, 500);
  }

  function _stopSpeakerDetection() {
    if (_speakerCheckInterval) {
      clearInterval(_speakerCheckInterval);
      _speakerCheckInterval = null;
    }
    _lastSpeakerUid = null;
    _audioLevelCache.clear();
  }

  function _updateFirestoreParticipantState(updates) {
    if (!_firestore() || !_currentCallId) return;
    var participantDetails = {};
    participantDetails[_myUid] = updates;
    _firestore().collection('groupCalls').doc(_currentCallId).update({
      participantDetails: participantDetails
    }).catch(function () {});
  }

  function _cleanupAllPeerConnections() {
    groupCallPeerConnections.forEach(function (pc, uid) {
      try { pc.close(); } catch (_) {}
    });
    groupCallPeerConnections.clear();
    groupCallCandidateUnsubscribes.forEach(function (fn) { try { fn(); } catch (_) {} });
    groupCallCandidateUnsubscribes = [];
    Object.keys(_unsubParticipantCandidates).forEach(function (uid) {
      _unsubParticipantCandidates[uid].forEach(function (fn) { try { fn(); } catch (_) {} });
    });
    _unsubParticipantCandidates = {};
    Object.keys(_reconnectTimers).forEach(function (uid) {
      clearTimeout(_reconnectTimers[uid]);
    });
    _reconnectTimers = {};
    _reconnectAttempts = {};
    Object.keys(_inviteTimers).forEach(function (uid) {
      clearTimeout(_inviteTimers[uid]);
    });
    _inviteTimers = {};
    _participantStreams.forEach(function (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
    });
    _participantStreams.clear();
    _participantMuteState.clear();
    _participantVideoState.clear();
    _participantJoinTime.clear();
    _audioLevelCache.clear();
    _lastSpeakerUid = null;
    _screenShareUserId = null;
  }

  function _cleanupListeners() {
    if (_unsubCallDoc) { try { _unsubCallDoc(); } catch (_) {} _unsubCallDoc = null; }
    if (_unsubInvites) { try { _unsubInvites(); } catch (_) {} _unsubInvites = null; }
    if (_unsubParticipantCandidates) {
      Object.keys(_unsubParticipantCandidates).forEach(function (uid) {
        _unsubParticipantCandidates[uid].forEach(function (fn) { try { fn(); } catch (_) {} });
      });
      _unsubParticipantCandidates = {};
    }
  }

  function _updateGridUI() {
    var cs = _$('call-screen');
    if (!cs) return;
    var gcGrid = _$('gc-grid');
    if (!gcGrid) {
      _ensureGridContainer();
    }
    _renderGrid();
  }

  async function startGroupCall(participantIds, type) {
    _myUid = _uid();
    if (!_myUid || !_firestore()) { _toast('Not signed in', 'error'); return; }
    if (_isInGroupCall()) { _toast('Already in a call', 'info'); return; }
    var pid = Array.isArray(participantIds) ? participantIds.filter(function (p) { return p && p !== _myUid; }) : [];
    var myDetails = _getMyDetails();
    if (type !== 'voice' && type !== 'video') type = 'voice';
    _currentCallType = type;
    _isInitiator = true;

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(type === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) return;
    }

    try {
      var constraints = { audio: true };
      if (type === 'video') {
        constraints.video = {
          facingMode: preferredCameraFacingMode || 'user',
          width: { ideal: window.isTablet ? 1920 : 1280 },
          height: { ideal: window.isTablet ? 1080 : 720 }
        };
      }
      localCallStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      _toast('Could not access camera/mic: ' + (err.name === 'NotAllowedError' ? 'Permission denied' : err.message), 'error');
      return;
    }

    var participantDetails = {};
    participantDetails[_myUid] = {
      name: myDetails.name,
      avatar: myDetails.avatar,
      isMuted: !!micMuted,
      isVideoOff: !!cameraOff,
      joinedAt: Date.now()
    };
    _participantJoinTime.set(_myUid, Date.now());

    var allParticipantIds = [_myUid].concat(pid);
    var callRef;
    try {
      callRef = await _firestore().collection('groupCalls').add({
        initiatorId: _myUid,
        type: type,
        status: 'ringing',
        participantIds: allParticipantIds,
        participantDetails: participantDetails,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        screenShareUid: null
      });
    } catch (err) {
      _toast('Failed to create group call: ' + err.message, 'error');
      localCallStream.getTracks().forEach(function (t) { t.stop(); });
      localCallStream = null;
      return;
    }

    _currentCallId = callRef.id;
    activeGroupCallParticipants = [{ uid: _myUid, name: myDetails.name, avatar: myDetails.avatar, isMuted: false, isVideoOff: false }];
    App.callActive = true;
    App._activeCallId = _currentCallId;

    _ensureGridContainer();
    _renderGrid();
    _showGroupCallScreen();
    _listenToCallDoc(_currentCallId);
    _listenToSignaling(_currentCallId);
    _listenToIncomingCandidates(_currentCallId);
    _listenToInvites(_currentCallId);
    _startSpeakerDetection();

    pid.forEach(function (targetUid) {
      _sendInvite(_currentCallId, targetUid, type);
    });

    if (typeof window.recordCallSyncEvent === 'function') {
      window.recordCallSyncEvent({
        callId: _currentCallId,
        direction: 'outgoing',
        status: 'ringing',
        callType: type,
        fromUserId: _myUid,
        fromUserName: myDetails.name,
        participantIds: allParticipantIds,
        metadata: { groupCall: true }
      });
    }

    if (pid.length > 0) {
      _txt('call-status', 'Calling ' + pid.length + ' participant' + (pid.length > 1 ? 's' : '') + '…');
    } else {
      _txt('call-status', 'Waiting for participants…');
    }
  }

  function _showGroupCallScreen() {
    var cs = _$('call-screen');
    if (cs) cs.classList.remove('hidden');
    var typeLabel = _currentCallType === 'video' ? 'Group Video Call' : 'Group Voice Call';
    _txt('call-name', typeLabel);
    _show('call-screen');
    var camBtn = _$('btn-cam');
    var ssBtn = _$('btn-screenshare');
    if (camBtn) camBtn.classList.toggle('hidden', _currentCallType === 'voice');
    if (ssBtn) ssBtn.classList.remove('hidden');
    var rv = _$('remote-video');
    var lvc = _$('local-video-container');
    if (rv) rv.classList.add('hidden');
    if (lvc) lvc.classList.add('hidden');
    _show('call-info-section');
    var av = _$('call-avatar');
    if (av) {
      av.className = 'w-32 h-32 rounded-full border-4 border-primary/30 flex items-center justify-center text-5xl bg-white/10 animate-pulse';
      av.textContent = 'G';
    }
    try { history.pushState({ callActive: true }, ''); } catch (_) {}
  }

  async function _sendInvite(callId, targetUid, callType) {
    if (!_firestore()) return;
    var myDetails = _getMyDetails();
    try {
      await _firestore().collection('groupCalls').doc(callId).collection('invites').add({
        callId: callId,
        fromUserId: _myUid,
        fromUserName: myDetails.name,
        toUserId: targetUid,
        callType: callType,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      _inviteTimers[targetUid] = setTimeout(function () {
        _cancelInvite(callId, targetUid);
      }, _INVITE_TIMEOUT_MS);
    } catch (_) {}
  }

  function _cancelInvite(callId, targetUid) {
    if (_inviteTimers[targetUid]) {
      clearTimeout(_inviteTimers[targetUid]);
      delete _inviteTimers[targetUid];
    }
    if (!_firestore() || !_isInitiator) return;
    _firestore().collection('groupCalls').doc(callId).collection('invites')
      .where('toUserId', '==', targetUid)
      .where('status', '==', 'pending')
      .get().then(function (snap) {
        snap.forEach(function (doc) {
          doc.ref.update({ status: 'cancelled' }).catch(function () {});
        });
      }).catch(function () {});
  }

  async function joinGroupCall(callId) {
    _myUid = _uid();
    if (!_myUid || !_firestore()) { _toast('Not signed in', 'error'); return; }
    if (_isInGroupCall()) { _toast('Already in a call', 'info'); return; }
    if (!callId) return;
    _hideGroupCallInvite();
    _currentCallId = callId;
    _isInitiator = false;

    var callDoc;
    try {
      callDoc = await _firestore().collection('groupCalls').doc(callId).get();
    } catch (err) {
      _toast('Failed to join call: ' + err.message, 'error');
      _currentCallId = null;
      return;
    }
    if (!callDoc.exists) { _toast('Call not found', 'error'); _currentCallId = null; return; }
    var callData = callDoc.data();
    if (callData.status === 'ended' || callData.status === 'cancelled') { _toast('Call has ended', 'info'); _currentCallId = null; return; }

    _currentCallType = callData.type || 'voice';
    var myDetails = _getMyDetails();

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(_currentCallType === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) { _currentCallId = null; return; }
    }

    try {
      var constraints = { audio: true };
      if (_currentCallType === 'video') {
        constraints.video = {
          facingMode: preferredCameraFacingMode || 'user',
          width: { ideal: window.isTablet ? 1920 : 1280 },
          height: { ideal: window.isTablet ? 1080 : 720 }
        };
      }
      localCallStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      _toast('Could not access camera/mic', 'error');
      _currentCallId = null;
      return;
    }

    _participantJoinTime.set(_myUid, Date.now());
    var newParticipantIds = (callData.participantIds || []);
    if (newParticipantIds.indexOf(_myUid) === -1) newParticipantIds.push(_myUid);

    var participantDetailsUpdate = {};
    participantDetailsUpdate[_myUid] = {
      name: myDetails.name,
      avatar: myDetails.avatar,
      isMuted: !!micMuted,
      isVideoOff: !!cameraOff,
      joinedAt: Date.now()
    };

    try {
      await _firestore().collection('groupCalls').doc(callId).update({
        participantIds: newParticipantIds,
        status: 'active',
        participantDetails: participantDetailsUpdate
      });
    } catch (err) {
      _toast('Failed to join: ' + err.message, 'error');
      localCallStream.getTracks().forEach(function (t) { t.stop(); });
      localCallStream = null;
      _currentCallId = null;
      return;
    }

    var existingParticipants = (callData.participantIds || []).filter(function (p) { return p !== _myUid; });
    activeGroupCallParticipants = [{ uid: _myUid, name: myDetails.name, avatar: myDetails.avatar, isMuted: false, isVideoOff: false }];
    existingParticipants.forEach(function (pUid) {
      var det = callData.participantDetails && callData.participantDetails[pUid];
      activeGroupCallParticipants.push({
        uid: pUid,
        name: det ? det.name : 'Participant',
        avatar: det ? (det.avatar || '') : '',
        isMuted: det ? !!det.isMuted : false,
        isVideoOff: det ? !!det.isVideoOff : true
      });
      if (det) {
        if (det.isMuted !== undefined) _participantMuteState.set(pUid, det.isMuted);
        if (det.isVideoOff !== undefined) _participantVideoState.set(pUid, det.isVideoOff);
      }
    });

    App.callActive = true;
    App._activeCallId = _currentCallId;

    _ensureGridContainer();
    _renderGrid();
    _showGroupCallScreen();
    _listenToCallDoc(_currentCallId);
    _listenToSignaling(_currentCallId);
    _listenToIncomingCandidates(_currentCallId);
    _listenToInvites(_currentCallId);
    _startSpeakerDetection();

    existingParticipants.forEach(function (targetUid) {
      _initiatePeerConnectionTo(targetUid);
    });

    if (typeof window.recordCallSyncEvent === 'function') {
      window.recordCallSyncEvent({
        callId: _currentCallId,
        direction: 'incoming',
        status: 'answered',
        callType: _currentCallType,
        fromUserId: callData.initiatorId || '',
        fromUserName: callData.initiatorName || '',
        toUserId: _myUid,
        toUserName: myDetails.name,
        participantIds: newParticipantIds,
        metadata: { groupCall: true }
      });
    }

    _txt('call-status', 'Connected');
  }

  function leaveGroupCall() {
    if (!_isInGroupCall()) return;
    var wasInitiator = _isInitiator;
    var callId = _currentCallId;
    var myUid = _myUid;

    _stopSpeakerDetection();
    _cleanupAllPeerConnections();
    _cleanupListeners();

    if (localCallStream) {
      localCallStream.getTracks().forEach(function (t) { t.stop(); });
      localCallStream = null;
    }

    if (callId && _firestore() && myUid) {
      var remainingParticipants = (activeGroupCallParticipants || []).filter(function (p) { return p.uid !== myUid; });
      if (remainingParticipants.length === 0 || wasInitiator) {
        _firestore().collection('groupCalls').doc(callId).update({
          status: 'ended',
          endedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function () {});
        _firestore().collection('groupCalls').doc(callId).collection('invites')
          .where('status', '==', 'pending')
          .get().then(function (snap) {
            snap.forEach(function (doc) {
              doc.ref.update({ status: 'cancelled' }).catch(function () {});
            });
          }).catch(function () {});
      } else {
        var newIds = remainingParticipants.map(function (p) { return p.uid; });
        var updatePayload = { participantIds: newIds };
        var detailUpdate = {};
        detailUpdate[myUid] = firebase.firestore.FieldValue.delete();
        updatePayload.participantDetails = detailUpdate;
        _firestore().collection('groupCalls').doc(callId).update(updatePayload).catch(function () {});
      }

      if (typeof window.recordCallSyncEvent === 'function') {
        window.recordCallSyncEvent({
          callId: callId,
          direction: wasInitiator ? 'outgoing' : 'incoming',
          status: 'ended',
          callType: _currentCallType,
          fromUserId: myUid,
          toUserId: '',
          participantIds: remainingParticipants.map(function (p) { return p.uid; }),
          durationMs: null,
          metadata: { groupCall: true, leftCall: true }
        });
      }
    }

    activeGroupCallParticipants = [];
    _currentCallId = null;
    _isInitiator = false;
    _myUid = null;
    App.callActive = false;
    App._activeCallId = null;

    var gcGrid = _$('gc-grid');
    if (gcGrid) gcGrid.remove();
    _gridContainer = null;

    var cs = _$('call-screen');
    if (cs) cs.classList.add('hidden');
    _hideGroupCallInvite();

    _toast('You left the call', 'info');
  }

  async function addToCall(userId) {
    if (!_isInGroupCall() || !_isInitiator) { _toast('Only the call initiator can add participants', 'error'); return; }
    if (!userId || userId === _myUid) return;
    if (!_canAddParticipant()) { _toast('Maximum ' + _GRID_MAX + ' participants allowed', 'error'); return; }
    var alreadyIn = (activeGroupCallParticipants || []).some(function (p) { return p.uid === userId; });
    if (alreadyIn) { _toast('Already in the call', 'info'); return; }
    if (!_firestore() || !_currentCallId) return;

    try {
      var callDoc = await _firestore().collection('groupCalls').doc(_currentCallId).get();
      var callData = callDoc.data();
      var currentIds = callData.participantIds || [];
      if (currentIds.indexOf(userId) === -1) currentIds.push(userId);
      await _firestore().collection('groupCalls').doc(_currentCallId).update({
        participantIds: currentIds
      });
      await _sendInvite(_currentCallId, userId, _currentCallType);
      _toast('Invitation sent', 'success');
    } catch (err) {
      _toast('Failed to add participant: ' + err.message, 'error');
    }
  }

  function removeFromCall(userId) {
    if (!_isInGroupCall()) return;
    if (!_isInitiator) { _toast('Only the call initiator can remove participants', 'error'); return; }
    if (!userId || userId === _myUid) return;
    var participant = (activeGroupCallParticipants || []).find(function (p) { return p.uid === userId; });
    if (!participant) return;
    var hasJoined = _participantJoinTime.has(userId);
    if (hasJoined) {
      _removeParticipantFromGrid(userId);
      if (_firestore() && _currentCallId) {
        var remaining = (activeGroupCallParticipants || []).map(function (p) { return p.uid; });
        remaining.push(_myUid);
        var updatePayload = { participantIds: remaining };
        var detailUpdate = {};
        detailUpdate[userId] = firebase.firestore.FieldValue.delete();
        updatePayload.participantDetails = detailUpdate;
        _firestore().collection('groupCalls').doc(_currentCallId).update(updatePayload).catch(function () {});
      }
      _toast(participant.name + ' removed from call', 'info');
    } else {
      _cancelInvite(_currentCallId, userId);
      _toast('Invitation cancelled', 'info');
    }
  }

  function addToCallBeforeAnswer(userId) {
    if (!_isInGroupCall() || !_isInitiator) { _toast('Only the call initiator can add participants', 'error'); return; }
    if (!userId || userId === _myUid) return;
    if (!_canAddParticipant()) { _toast('Maximum ' + _GRID_MAX + ' participants allowed', 'error'); return; }
    var alreadyIn = (activeGroupCallParticipants || []).some(function (p) { return p.uid === userId; });
    if (alreadyIn) { _toast('Already in the call', 'info'); return; }
    addToCall(userId);
  }

  function getGroupCallParticipants() {
    return (activeGroupCallParticipants || []).map(function (p) {
      return {
        uid: p.uid,
        name: p.name,
        avatar: p.avatar,
        isMuted: _participantMuteState.get(p.uid) || false,
        isVideoOff: _participantVideoState.get(p.uid) || false,
        joinedAt: _participantJoinTime.get(p.uid) || null,
        stream: _participantStreams.get(p.uid) || null
      };
    });
  }

  function renderGroupCallGrid() {
    _ensureGridContainer();
    _renderGrid();
  }

  function cleanupGroupCalls() {
    _stopSpeakerDetection();
    _cleanupAllPeerConnections();
    _cleanupListeners();
    if (localCallStream) {
      localCallStream.getTracks().forEach(function (t) { t.stop(); });
      localCallStream = null;
    }
    activeGroupCallParticipants = [];
    _currentCallId = null;
    _isInitiator = false;
    _myUid = null;
    _gridContainer = null;
    var gcGrid = _$('gc-grid');
    if (gcGrid) gcGrid.remove();
    _hideGroupCallInvite();
  }

  window.startGroupCall = startGroupCall;
  window.joinGroupCall = joinGroupCall;
  window.leaveGroupCall = leaveGroupCall;
  window.addToCall = addToCall;
  window.removeFromCall = removeFromCall;
  window.addToCallBeforeAnswer = addToCallBeforeAnswer;
  window.getGroupCallParticipants = getGroupCallParticipants;
  window.renderGroupCallGrid = renderGroupCallGrid;
  window.declineGroupCall = function (callId) {
    _hideGroupCallInvite();
    if (_firestore() && callId) {
      _firestore().collection('groupCalls').doc(callId).collection('invites')
        .where('toUserId', '==', _uid())
        .where('status', '==', 'pending')
        .get().then(function (snap) {
          snap.forEach(function (doc) {
            doc.ref.update({ status: 'declined' }).catch(function () {});
          });
        }).catch(function () {});
    }
  };
  window._handleAcceptedGroupCall = function (data) {
    if (data && data.callId) {
      joinGroupCall(data.callId);
    }
  };
  window.listenForGroupCallParticipants = function (callId, type) {
    _listenToCallDoc(callId);
    _listenToSignaling(callId);
    _listenToIncomingCandidates(callId);
    _listenToInvites(callId);
  };
  window.cleanupGroupCalls = cleanupGroupCalls;
})();
