/* call-controller-events.js â€” Event listeners, call state machine, incoming call handling, call waiting, swipe */
(function () {
  'use strict';

  var CC = window._CC;
  var _waitingIncoming = null;
  var _swipeState = null;
  var _outgoingRingtoneInterval = null;
  var _lastCallAttemptTime = 0;
  var _esc = function (s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''); };

  function _startOutgoingRingtone() {
    _stopOutgoingRingtone();
    CC.playSound('outgoingCall');
    _outgoingRingtoneInterval = setInterval(function () { CC.playSound('outgoingCall'); }, 3000);
  }
  function _stopOutgoingRingtone() {
    if (_outgoingRingtoneInterval) { clearInterval(_outgoingRingtoneInterval); _outgoingRingtoneInterval = null; }
  }

  function listenIncomingCalls() {
    if (!CC.db() || !CC.uid()) return;
    if (CC.unsubIncoming) CC.unsubIncoming();
    var myUid = CC.uid();
    CC.unsubIncoming = CC.db().collection('calls')
      .where('toUserId', '==', myUid)
      .where('status', '==', 'ringing')
      .onSnapshot(function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === 'added') {
            var call = change.doc.data();
            if (call.fromUserId === myUid) return;
            var incomingPayload = {
              callId: change.doc.id,
              type: call.type,
              fromUserId: call.fromUserId,
              fromUserName: call.fromUserName || 'Unknown',
              fromUserPhoto: call.fromUserPhoto || '',
              groupCall: call.groupCall,
              groupId: call.groupId,
              groupName: call.groupName,
              toUserId: call.toUserId
            };
            if (CC.state !== CC.STATES.IDLE) {
              if (CC.state === CC.STATES.ACTIVE || CC.state === CC.STATES.CONNECTING) {
                _waitingIncoming = incomingPayload;
                _showCallWaitingUI(incomingPayload);
              } else if (CC.state === CC.STATES.RINGING) {
                CC.db().collection('calls').doc(change.doc.id).update({ status: 'busy' }).catch(function () {});
              } else {
                CC.db().collection('calls').doc(change.doc.id).update({ status: 'missed' }).catch(function () {});
              }
              return;
            }
            CC.incomingData = incomingPayload;
            showIncomingCall(CC.incomingData);
            CC.broadcastToTabs('incoming-call', { callId: change.doc.id });
          }
          if (change.type === 'removed' || change.type === 'modified') {
            var cd = change.doc.data();
            if (cd && (cd.status === 'active' || cd.status === 'ended' || cd.status === 'rejected' || cd.status === 'missed' || cd.status === 'cancelled')) {
              hideIncomingCall();
              _hideCallWaitingUI();
              if (CC.incomingData && CC.incomingData.callId === change.doc.id) CC.incomingData = null;
              if (_waitingIncoming && _waitingIncoming.callId === change.doc.id) _waitingIncoming = null;
            }
          }
        });
      });
    if (CC.bcChannel) {
      if (CC.incomingBcHandler) CC.bcChannel.removeEventListener('message', CC.incomingBcHandler);
      CC.incomingBcHandler = function (e) {
        if (e.data && (e.data.type === 'call-accepted' || e.data.type === 'call-ended')) {
          hideIncomingCall();
          _hideCallWaitingUI();
        }
      };
      CC.bcChannel.addEventListener('message', CC.incomingBcHandler);
    }
  }

  function showIncomingCall(data) {
    var name = data.fromUserName || 'Unknown';
    CC.txt('incoming-call-name', name);
    var isGroup = data.groupCall === true;
    CC.txt('incoming-call-type', (isGroup ? '👥 ' : '') + (data.type === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'));
    var av = CC.$('incoming-call-avatar');
    if (av) {
      if (data.fromUserPhoto) {
        av.innerHTML = '<img src="' + CC.escHtml(data.fromUserPhoto) + '" class="w-full h-full rounded-full object-cover" alt="">';
        var _avImg = av.querySelector('img');
        if (_avImg) {
          _avImg.addEventListener('error', function () {
            av.textContent = name[0]?.toUpperCase() || '?';
            av.className = 'w-24 h-24 rounded-full border-4 border-green-500/30 flex items-center justify-center text-4xl bg-white/10';
          }, { once: true });
        }
        av.className = 'w-24 h-24 rounded-full border-4 border-green-500/30 overflow-hidden bg-white/10';
      } else {
        av.textContent = name[0]?.toUpperCase() || '?';
        av.className = 'w-24 h-24 rounded-full border-4 border-green-500/30 flex items-center justify-center text-4xl bg-white/10';
      }
    }
    var videoPreview = CC.$('incoming-call-video-preview');
    if (videoPreview) {
      if (data.type === 'video' && data.fromUserPhoto) {
        videoPreview.src = data.fromUserPhoto;
        videoPreview.classList.remove('hidden');
      } else {
        videoPreview.classList.add('hidden');
      }
    }
    CC.show('incoming-call-overlay');
    CC.playSound('callRing');
    if (typeof window.AppHaptics !== 'undefined' && typeof window.AppHaptics.vibrate === 'function') { window.AppHaptics.vibrate([700, 250, 700, 250, 700, 250, 700, 250, 700]); } else if (navigator.vibrate) navigator.vibrate([700, 250, 700, 250, 700, 250, 700, 250, 700]);
    CC.requestWake();
    _setupSwipeToAnswer();
    CC.incomingTimeoutHandle = setTimeout(function () {
      if (CC.incomingData && CC.incomingData.callId === data.callId) {
        hideIncomingCall();
        if (CC.db()) {
          CC.db().collection('calls').doc(data.callId).update({ status: 'missed' }).catch(function () {});
          CC.writeCallLog('incoming', 'missed', null);
        }
        CC.incomingData = null;
      }
    }, CC.CALL_TIMEOUT_MS);
  }

  function hideIncomingCall() {
    CC.hide('incoming-call-overlay');
    CC.stopExistingRingtone();
    _teardownSwipeToAnswer();
    if (CC.incomingTimeoutHandle) { clearTimeout(CC.incomingTimeoutHandle); CC.incomingTimeoutHandle = null; }
  }

  function _showCallWaitingUI(data) {
    var existing = CC.$('call-waiting-bar');
    if (existing) existing.remove();
    var name = data.fromUserName || 'Unknown';
    var typeLabel = data.type === 'video' ? 'Video' : 'Voice';
    var html = '<div id="call-waiting-bar" class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-surface border border-outline/20 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 max-w-sm w-[calc(100%-2rem)] cursor-pointer hover:bg-surface-variant/50 transition-colors" style="top:calc(16px + env(safe-area-inset-top, 0px))">' +
      '<div class="w-10 h-10 rounded-full bg-yellow-500/15 text-yellow-500 flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-xl">phone_in_talk</span></div>' +
      '<div class="flex-1 min-w-0">' +
      '<p class="text-on-surface font-semibold text-sm truncate">' + CC.escHtml(name) + '</p>' +
      '<p class="text-on-surface-variant text-xs">' + typeLabel + ' Call · Waiting…</p>' +
      '</div>' +
      '<div class="flex items-center gap-2">' +
      '<button id="cw-decline" class="min-w-[44px] min-h-[44px] rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors" title="Decline"><span class="material-symbols-outlined text-white" style="font-size:18px">call_end</span></button>' +
      '<button id="cw-switch" class="min-w-[44px] min-h-[44px] rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors" title="Switch call"><span class="material-symbols-outlined text-white" style="font-size:18px">swap_horiz</span></button>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    var declineBtn = CC.$('cw-decline');
    if (declineBtn) declineBtn.onclick = function (e) {
      e.stopPropagation();
      if (data.callId && CC.db()) {
        CC.db().collection('calls').doc(data.callId).update({ status: 'rejected' }).catch(function () {});
        CC.writeCallLog('incoming', 'rejected', null, {
          callId: data.callId,
          fromUserId: data.fromUserId || '',
          fromUserName: data.fromUserName || 'Unknown',
          fromUserAvatar: data.fromUserPhoto || '',
          toUserId: '',
          toUserName: ''
        });
      }
      _hideCallWaitingUI();
      _waitingIncoming = null;
    };
    var switchBtn = CC.$('cw-switch');
    if (switchBtn) switchBtn.onclick = function (e) {
      e.stopPropagation();
      _switchToWaitingCall();
    };
    var bar = CC.$('call-waiting-bar');
    if (bar) bar.onclick = function () { _switchToWaitingCall(); };
  }

  function _hideCallWaitingUI() {
    var bar = CC.$('call-waiting-bar');
    if (bar) bar.remove();
  }

  function _switchToWaitingCall() {
    if (!_waitingIncoming) return;
    var _currentCallId = CC.callId;
    var _currentDuration = CC.callStartTime ? Math.floor((Date.now() - CC.callStartTime) / 1000) : 0;
    window.endCall();
    _hideCallWaitingUI();
    CC.incomingData = _waitingIncoming;
    _waitingIncoming = null;
    if (CC.incomingData.groupCall) {
      acceptGroupCall(CC.incomingData);
    } else {
      acceptCall();
    }
  }

  function _setupSwipeToAnswer() {
    var overlay = CC.$('incoming-call-overlay');
    if (!overlay || overlay.dataset.swipeInit) return;
    overlay.dataset.swipeInit = '1';
    var swipeZone = overlay.querySelector('.relative') || overlay;
    var startX = 0, currentX = 0, isDragging = false;
    var answerThreshold = 100;
    var declineThreshold = -100;
    var swipeIndicator = document.createElement('div');
    swipeIndicator.id = 'swipe-indicator';
    swipeIndicator.className = 'absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40 text-xs pointer-events-none transition-opacity';
    swipeIndicator.style.bottom = 'calc(80px + env(safe-area-inset-bottom, 0px))';
    swipeIndicator.innerHTML = '<span class="material-symbols-outlined text-2xl animate-bounce">swipe_up</span><span>Swipe right to answer · left to decline</span>';
    swipeIndicator.style.opacity = '0';
    swipeIndicator.style.transition = 'opacity 0.3s';
    overlay.appendChild(swipeIndicator);
    var answerIcon = document.createElement('div');
    answerIcon.className = 'absolute top-1/2 -translate-y-1/2 right-8 text-green-500 opacity-0 transition-opacity pointer-events-none';
    answerIcon.innerHTML = '<span class="material-symbols-outlined text-4xl">call</span>';
    answerIcon.style.opacity = '0';
    overlay.appendChild(answerIcon);
    var declineIcon = document.createElement('div');
    declineIcon.className = 'absolute top-1/2 -translate-y-1/2 left-8 text-red-500 opacity-0 transition-opacity pointer-events-none';
    declineIcon.innerHTML = '<span class="material-symbols-outlined text-4xl">call_end</span>';
    declineIcon.style.opacity = '0';
    overlay.appendChild(declineIcon);
    function onTouchStart(e) {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      currentX = 0;
      swipeIndicator.style.opacity = '1';
    }
    function onTouchMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      var x = e.touches ? e.touches[0].clientX : e.clientX;
      currentX = x - startX;
      var progress = Math.min(1, Math.abs(currentX) / answerThreshold);
      if (currentX > 0) {
        answerIcon.style.opacity = String(progress);
        declineIcon.style.opacity = '0';
      } else {
        declineIcon.style.opacity = String(progress);
        answerIcon.style.opacity = '0';
      }
    }
    function onTouchEnd() {
      if (!isDragging) return;
      isDragging = false;
      swipeIndicator.style.opacity = '0';
      answerIcon.style.opacity = '0';
      declineIcon.style.opacity = '0';
      if (currentX > answerThreshold) {
        acceptCall();
      } else if (currentX < declineThreshold) {
        declineCall();
      }
    }
    swipeZone.addEventListener('touchstart', onTouchStart, { passive: true });
    swipeZone.addEventListener('touchmove', onTouchMove, { passive: false });
    swipeZone.addEventListener('touchend', onTouchEnd);
    swipeZone.addEventListener('mousedown', onTouchStart);
    swipeZone.addEventListener('mousemove', onTouchMove);
    swipeZone.addEventListener('mouseup', onTouchEnd);
    overlay._swipeCleanup = function () {
      swipeZone.removeEventListener('touchstart', onTouchStart);
      swipeZone.removeEventListener('touchmove', onTouchMove);
      swipeZone.removeEventListener('touchend', onTouchEnd);
      swipeZone.removeEventListener('mousedown', onTouchStart);
      swipeZone.removeEventListener('mousemove', onTouchMove);
      swipeZone.removeEventListener('mouseup', onTouchEnd);
      if (swipeIndicator.parentNode) swipeIndicator.remove();
      if (answerIcon.parentNode) answerIcon.remove();
      if (declineIcon.parentNode) declineIcon.remove();
    };
  }

  function _teardownSwipeToAnswer() {
    var overlay = CC.$('incoming-call-overlay');
    if (overlay && overlay._swipeCleanup) {
      overlay._swipeCleanup();
      delete overlay._swipeCleanup;
      delete overlay.dataset.swipeInit;
    }
  }

  async function startVoiceCall() {
    if (CC.state !== CC.STATES.IDLE) return;
    if (Date.now() - _lastCallAttemptTime < 3000) { CC.toast('Please wait before trying again', 'info'); return; }
    _lastCallAttemptTime = Date.now();
    if (!CC.uid() || !CC.db()) { CC.toast('Not signed in', 'error'); return; }
    var c = CC.chat();
    if (c && c.type === 'group') { _openGroupParticipantPicker('voice'); return; }
    if (c && (c.uid || c.otherUserId)) { await initiateOutgoingCall('voice', c); return; }
    CC.openCallPicker();
  }

  async function startVideoCall() {
    if (CC.state !== CC.STATES.IDLE) return;
    if (Date.now() - _lastCallAttemptTime < 3000) { CC.toast('Please wait before trying again', 'info'); return; }
    _lastCallAttemptTime = Date.now();
    if (!CC.uid() || !CC.db()) { CC.toast('Not signed in', 'error'); return; }
    var c = CC.chat();
    if (c && c.type === 'group') { _openGroupParticipantPicker('video'); return; }
    if (c && (c.uid || c.otherUserId)) { await initiateOutgoingCall('video', c); return; }
    CC.openCallPicker();
  }

  async function initiateOutgoingCall(type, targetChat) {
    var myUid = CC.uid();
    var otherUid = (targetChat && (targetChat.uid || targetChat.otherUserId)) || '';
    if (!otherUid) return;

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(type === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) return;
    }

    CC.setState(CC.STATES.CONNECTING);
    CC.callId = null;
    CC.callType = type;
    CC._outgoingAvatar = targetChat.photoURL || '';
    CC.callMeta = {
      direction: 'outgoing',
      fromUserId: myUid,
      fromUserName: CC.me()?.displayName || 'User',
      fromUserAvatar: CC.me()?.photoURL || '',
      toUserId: otherUid,
      toUserName: targetChat.name || 'Unknown',
      toUserAvatar: targetChat.photoURL || ''
    };
    CC.showCallScreen(type, targetChat.name, targetChat.initials);

    try {
      await CC.getMedia(type);
      var rtcConfig = await getRtcConfig();
      CC.setPeerConnection(new RTCPeerConnection(rtcConfig));
      CC.addLocalTracks(CC.getLocalStream());
      CC.setupPeerConnection(CC.getPeerConnection());

      var offer = await CC.getPeerConnection().createOffer();
      await CC.getPeerConnection().setLocalDescription(offer);

      var callRef = await CC.db().collection('calls').add({
        fromUserId: myUid,
        fromUserName: CC.me()?.displayName || 'User',
        fromUserPhoto: CC.me()?.photoURL || '',
        toUserId: otherUid,
        type: type,
        status: 'ringing',
        groupCall: false,
        offer: { sdp: offer.sdp, type: offer.type },
        participants: [myUid, otherUid],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      CC.callId = callRef.id;
      App._activeCallId = callRef.id;
      CC.listenAnswer(CC.callId);
      CC.listenOffer(CC.callId);
      CC.listenCandidates(CC.callId);
      CC.listenStatus(CC.callId);
      CC.requestWake();
      CC.startHeartbeat(CC.callId);
      _startOutgoingRingtone();

      CC.timeoutHandle = setTimeout(function () {
        if (CC.callId && CC.state !== CC.STATES.IDLE && CC.state !== CC.STATES.ACTIVE) {
          CC.txt('call-status', 'No answer');
          endCall();
        }
      }, CC.CALL_TIMEOUT_MS);

    } catch (err) {
      if (window.__DEBUG__) console.error('Call start error:', err);
      CC.toast('Could not start call: ' + (err.name === 'NotAllowedError' ? 'Camera/mic permission denied' : err.message), 'error');
      CC.cleanup();
      CC.setState(CC.STATES.IDLE);
    }
  }

  async function acceptCall() {
    if (!CC.incomingData) return;
    hideIncomingCall();
    _hideCallWaitingUI();
    CC.broadcastToTabs('call-accepted', { callId: CC.incomingData.callId });

    if (CC.incomingData.groupCall) {
      acceptGroupCall(CC.incomingData);
      CC.incomingData = null;
      return;
    }

    var myUid = CC.uid();
    if (!myUid || !CC.db()) return;

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(CC.incomingData.type === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) { CC.incomingData = null; return; }
    }

    CC.callId = CC.incomingData.callId;
    CC.callType = CC.incomingData.type;
    CC._outgoingAvatar = CC.incomingData.fromUserPhoto || '';
    var fromName = CC.incomingData.fromUserName;
    CC.callMeta = {
      direction: 'incoming',
      fromUserId: CC.incomingData.fromUserId || '',
      fromUserName: fromName || 'Unknown',
      fromUserAvatar: CC.incomingData.fromUserPhoto || '',
      toUserId: myUid,
      toUserName: CC.me()?.displayName || 'User'
    };

    CC.setState(CC.STATES.CONNECTING);
    CC.showCallScreen(CC.incomingData.type, fromName, (fromName || '?')[0].toUpperCase());

    try {
      await CC.getMedia(CC.incomingData.type);
      var rtcConfig = await getRtcConfig();
      CC.setPeerConnection(new RTCPeerConnection(rtcConfig));
      CC.addLocalTracks(CC.getLocalStream());
      CC.setupPeerConnection(CC.getPeerConnection());

      var callDoc = await CC.db().collection('calls').doc(CC.callId).get();
      var callSnapshot = callDoc.data();
      CC.listenCandidates(CC.callId);
      CC.listenStatus(CC.callId);
      CC.listenOffer(CC.callId);
      CC.listenAnswer(CC.callId);
      if (callSnapshot && callSnapshot.offer) {
        await CC.getPeerConnection().setRemoteDescription(new RTCSessionDescription(callSnapshot.offer));
        var answer = await CC.getPeerConnection().createAnswer();
        await CC.getPeerConnection().setLocalDescription(answer);
        await CC.db().collection('calls').doc(CC.callId).update({
          answer: { sdp: answer.sdp, type: answer.type },
          status: 'active'
        });
      }

      CC.requestWake();
      CC.startHeartbeat(CC.callId);

    } catch (err) {
      if (window.__DEBUG__) console.error('Accept call error:', err);
      CC.toast('Could not connect call', 'error');
      CC.cleanup();
      CC.setState(CC.STATES.IDLE);
    }

    CC.incomingData = null;
  }

  function declineCall() {
    CC.stopExistingRingtone();
    hideIncomingCall();
    _hideCallWaitingUI();
    if (CC.incomingData) {
      CC.broadcastToTabs('call-ended', { callId: CC.incomingData.callId });
      if (CC.db() && CC.incomingData.callId) {
        CC.db().collection('calls').doc(CC.incomingData.callId).update({ status: 'rejected' }).catch(function () {});
        CC.writeCallLog('incoming', 'rejected', null);
      }
      CC.playSound('callDeclined');
      CC.incomingData = null;
    }
  }

  function endCall(finalStatus) {
    var wasActive = CC.state === CC.STATES.ACTIVE;
    var dur = CC.callStartTime ? Math.floor((Date.now() - CC.callStartTime) / 1000) : 0;
    var endDirection = (CC.callMeta && CC.callMeta.direction) || (CC.incomingData ? 'incoming' : 'outgoing');
    var remoteName = CC.$('call-name')?.textContent || 'Unknown';
    var remoteAvatar = CC._outgoingAvatar || '';
    var savedCallId = CC.callId;
    var savedRemoteUid = (CC.callMeta && CC.callMeta.fromUserId) || CC.incomingData?.fromUserId || '';
    var logStatus = wasActive
      ? 'ended'
      : (endDirection === 'incoming' ? 'missed' : 'cancelled');
    var logMeta = CC.callMeta || {};

    CC.txt('call-status', dur > 0 ? 'Call ended' : 'No answer');
    _stopOutgoingRingtone();
    CC.cleanup();
    CC.setState(CC.STATES.ENDED);

    if (savedCallId && CC.db()) {
      var payload = { status: 'ended', endedAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (dur > 0) payload.duration = dur;
      CC.db().collection('calls').doc(savedCallId).update(payload).catch(function () {});
      CC.writeCallLog(endDirection, logStatus, dur > 0 ? dur * 1000 : null, logMeta);
    }

    if (wasActive) {
      CC.playSound('callEnded');
      if (CC._suppressEndScreen) {
        CC._suppressEndScreen = false;
      } else {
        CC.showCallEndScreen(endDirection, dur, CC.callType, remoteName, remoteAvatar);
      }
    } else {
      CC.playSound('callEnded');
    }

    CC.callId = null;
    CC.callStartTime = null;
    CC._outgoingAvatar = '';
    CC.releaseWake();
    if (typeof window.Presence !== 'undefined' && typeof window.Presence.setInCall === 'function') window.Presence.setInCall(false);
    _sendMissedCallNotification(endDirection, dur, remoteName, savedRemoteUid, savedCallId);
    CC.setState(CC.STATES.IDLE);
    if (window._GC && typeof window._GC.refreshInviteFeed === 'function') {
      window._GC.refreshInviteFeed();
    }
  }

  async function _sendMissedCallNotification(direction, duration, remoteName, remoteUid, callIdForNotif) {
    if (direction !== 'incoming' || duration > 0) return;
    if (!CC.db()) return;
    try {
      var targetUid = remoteUid || '';
      if (!targetUid) return;
      var tokenDoc = await CC.db().collection('users').doc(targetUid).get();
      var userData = tokenDoc.data();
      if (userData && userData.fcmToken) {
        var functions = firebase.app().functions('asia-south1');
        var sendNotification = functions.httpsCallable('sendPushNotification');
        await sendNotification({
          token: userData.fcmToken,
          title: 'Missed call',
          body: 'Missed call from ' + (remoteName || 'Unknown'),
          data: { type: 'missed_call', callId: callIdForNotif || '' }
        });
      }
    } catch (_) {}
  }

  function _openGroupParticipantPicker(type) {
    var c = CC.chat();
    if (!c || !CC.db() || !CC.uid()) return;
    var myUid = CC.uid();
    var memberIds = (c.members || c.participants || []).filter(function (m) { return m && m !== myUid; });
    if (!memberIds.length) { CC.toast('No other members to call', 'info'); return; }

    var existing = document.getElementById('cc-group-participant-picker');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'cc-group-participant-picker';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10010;display:flex;align-items:flex-end;justify-content:center;';
    var backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);';
    backdrop.addEventListener('click', function () { overlay.remove(); });
    overlay.appendChild(backdrop);
    var panel = document.createElement('div');
    panel.style.cssText = 'position:relative;width:100%;max-width:480px;max-height:80vh;background:var(--surface,#fff);border-radius:16px 16px 0 0;display:flex;flex-direction:column;overflow:hidden;';

    var header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08));display:flex;align-items:center;justify-content:space-between;';
    var hTitle = document.createElement('h3');
    hTitle.style.cssText = 'margin:0;font-size:16px;font-weight:700;color:var(--on-surface,#1a1a1a);';
    hTitle.textContent = (type === 'video' ? 'Select contacts for video call' : 'Select contacts for voice call');
    header.appendChild(hTitle);
    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'border:none;background:none;cursor:pointer;color:var(--on-surface-variant,#666);padding:4px;';
    closeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:24px">close</span>';
    closeBtn.addEventListener('click', function () { overlay.remove(); });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    var countBar = document.createElement('div');
    countBar.style.cssText = 'padding:8px 20px;font-size:13px;color:var(--on-surface-variant,#666);border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.06));';
    panel.appendChild(countBar);

    var searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'padding:12px 20px;';
    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search contacts...';
    searchInput.style.cssText = 'width:100%;padding:10px 14px;border:1px solid var(--outline-variant,rgba(0,0,0,0.12));border-radius:10px;font-size:14px;background:var(--surface-variant,rgba(0,0,0,0.03));color:var(--on-surface,#1a1a1a);outline:none;box-sizing:border-box;';
    searchWrap.appendChild(searchInput);
    panel.appendChild(searchWrap);

    var listWrap = document.createElement('div');
    listWrap.style.cssText = 'flex:1;overflow-y:auto;padding:0 12px;max-height:45vh;';
    panel.appendChild(listWrap);

    var selectedIds = new Set();
    var selectedMap = {};

    function _updateCount() {
      var n = selectedIds.size;
      countBar.textContent = n === 0 ? 'Select contacts to start the call' : n + (n === 1 ? ' contact selected' : ' contacts selected');
      startBtn.disabled = n === 0;
      startBtn.style.opacity = n === 0 ? '0.5' : '1';
    }

    var addBar = document.createElement('div');
    addBar.style.cssText = 'padding:12px 20px;border-top:1px solid var(--outline-variant,rgba(0,0,0,0.08));';
    var startBtn = document.createElement('button');
    startBtn.style.cssText = 'width:100%;padding:12px;border:none;border-radius:10px;background:var(--primary,#00A884);color:#fff;font-size:14px;font-weight:600;cursor:pointer;';
    startBtn.textContent = type === 'video' ? 'Start video call' : 'Start voice call';
    startBtn.disabled = true;
    startBtn.style.opacity = '0.5';
    startBtn.addEventListener('click', async function () {
      if (selectedIds.size === 0) return;
      overlay.remove();
      if (typeof window.startGroupCall === 'function' && window.startGroupCall !== startGroupCall) {
        try {
          await window.startGroupCall(Array.from(selectedIds), type === 'video' ? 'video' : 'voice', {
            groupId: c.id,
            groupName: c.name,
            groupAvatar: c.photoURL || c.avatar || ''
          });
        } catch (e) {
          if (window.__DEBUG__) console.warn('[calls] startGroupCall delegate:', e);
        }
        return;
      }
      // Fallback: start the group call directly with the chosen members
      _startGroupCallWithMembers(type, c, Array.from(selectedIds));
    });
    addBar.appendChild(startBtn);
    panel.appendChild(addBar);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    panel.style.transform = 'translateY(100%)';
    requestAnimationFrame(function () { panel.style.transition = 'transform .3s ease'; panel.style.transform = 'translateY(0)'; });

    function _render(query) {
      listWrap.innerHTML = '';
      var users = (window.allUsers || []).filter(function (u) {
        return u && (u.uid || u.id) && memberIds.indexOf(u.uid || u.id) !== -1;
      });
      if (query) {
        var q = query.toLowerCase();
        users = users.filter(function (u) {
          var name = (u.displayName || u.name || '').toLowerCase();
          var email = (u.email || '').toLowerCase();
          return name.indexOf(q) !== -1 || email.indexOf(q) !== -1;
        });
      }
      // Include any member ids missing from allUsers as raw rows so the list is never incomplete.
      var known = {};
      users.forEach(function (u) { known[u.uid || u.id] = true; });
      var missing = memberIds.filter(function (m) { return !known[m] && !selectedMap[m]; });
      missing.forEach(function (m) {
        users.push({ uid: m, displayName: selectedMap[m] ? selectedMap[m].name : 'Contact', email: '' });
      });
      users.sort(function (a, b) { return (a.displayName || a.name || '?').localeCompare(b.displayName || b.name || '?'); });
      if (users.length === 0) {
        listWrap.innerHTML = '<div style="padding:24px;text-align:center;color:var(--on-surface-variant,#999);font-size:14px;">No contacts found</div>';
        return;
      }
      users.forEach(function (u) {
        var id = u.uid || u.id;
        var name = u.displayName || u.name || 'Contact';
        var isSel = selectedIds.has(id);
        var item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background .15s;';
        var checkbox = document.createElement('span');
        checkbox.className = 'material-symbols-outlined';
        checkbox.style.cssText = 'width:22px;height:22px;border-radius:50%;border:2px solid var(--primary,#00A884);display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;flex-shrink:0;';
        checkbox.textContent = isSel ? 'check' : '';
        if (isSel) checkbox.style.background = 'var(--primary,#00A884)';
        item.appendChild(checkbox);
        var avatar = document.createElement('div');
        avatar.style.cssText = 'width:40px;height:40px;border-radius:50%;background:var(--primary,#00A884);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0;overflow:hidden;';
        if (u.photoURL) {
          avatar.innerHTML = '<img src="' + _esc(u.photoURL) + '" style="width:100%;height:100%;object-fit:cover;" />';
        } else {
          avatar.textContent = (name || '?')[0].toUpperCase();
        }
        item.appendChild(avatar);
        var info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        var nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-size:15px;font-weight:600;color:var(--on-surface,#1a1a1a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        nameEl.textContent = name;
        info.appendChild(nameEl);
        item.appendChild(info);
        item.addEventListener('click', function () {
          if (selectedIds.has(id)) {
            selectedIds.delete(id);
            selectedMap[id] = null;
          } else {
            selectedIds.add(id);
            selectedMap[id] = { name: name, photoURL: u.photoURL || '' };
          }
          _render(query);
          _updateCount();
        });
        listWrap.appendChild(item);
      });
    }

    searchInput.addEventListener('input', function () { _render(searchInput.value); });
    _render('');
    _updateCount();
    searchInput.focus();
  }

  async function _startGroupCallWithMembers(type, c, memberIds) {
    if (!CC.uid() || !CC.db()) return;
    if (await _delegateGroupCall(type, c, memberIds)) return;
    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(type === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) return;
    }
    _doStartGroupCall(type, c, memberIds);
  }

  function _doStartGroupCall(type, c, memberIds) {
    CC.callType = type;
    CC.setActiveCallMode('group');
    CC.showCallScreen(type, c.name, c.initials || 'G');
    CC.txt('call-quality-text', type === 'video' ? 'HD Group Video' : 'HD Group Voice');
    CC.txt('call-status', 'Calling ' + memberIds.length + ' people…');

    CC.getMedia(type).then(async function () {
      var allParticipants = [CC.uid()].concat(memberIds);
      var callRef = await CC.db().collection('calls').add({
        fromUserId: CC.uid(),
        fromUserName: CC.me()?.displayName || 'User',
        fromUserPhoto: CC.me()?.photoURL || '',
        type: type,
        status: 'ringing',
        groupCall: true,
        groupId: c.id,
        groupName: c.name,
        participantIds: allParticipants,
        offer: null,
        participants: allParticipants,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function (err) {
        if (window.__DEBUG__) console.error('Group call error:', err);
        CC.toast('Could not start group call: ' + err.message, 'error');
        CC.cleanup();
        CC.setState(CC.STATES.IDLE);
        return null;
      });
      if (!callRef) return;
      CC.callId = callRef.id;
      App._activeCallId = callRef.id;
      if (typeof listenForGroupCallParticipants === 'function') listenForGroupCallParticipants(CC.callId, type);
      CC.listenStatus(CC.callId);
      CC.requestWake();
      CC.startHeartbeat(CC.callId);
      CC.timeoutHandle = setTimeout(function () {
        if (CC.callId && CC.state !== CC.STATES.ACTIVE && CC.state !== CC.STATES.IDLE) {
          CC.txt('call-status', 'No answer');
          endCall();
        }
      }, CC.CALL_TIMEOUT_MS);
    }).catch(function (err) {
      if (window.__DEBUG__) console.error('Group call error:', err);
      CC.toast('Could not start group call: ' + err.message, 'error');
      CC.cleanup();
      CC.setState(CC.STATES.IDLE);
    });
  }

  async function _delegateGroupCall(type, c, memberIds) {
    if (typeof window.startGroupCall === 'function' && window.startGroupCall !== _delegateGroupCall) {
      try {
        await window.startGroupCall(memberIds, type === 'video' ? 'video' : 'voice', {
          groupId: c.id,
          groupName: c.name,
          groupAvatar: c.photoURL || c.avatar || ''
        });
      } catch (e) {
        if (window.__DEBUG__) console.warn('[calls] startGroupCall delegate:', e);
      }
      return true;
    }
    return false;
  }

  async function startGroupCall(type) {
    var c = CC.chat();
    if (!c || !CC.db() || !CC.uid()) return;
    if (c.type !== 'group') return;
    var myUid = CC.uid();
    var memberIds = (c.members || c.participants || []).filter(function (m) { return m && m !== myUid; });
    if (!memberIds.length) { CC.toast('No other members to call', 'info'); return; }

    if (await _delegateGroupCall(type, c, memberIds)) return;

    if (typeof PermissionsManager !== 'undefined') {
      var granted = await PermissionsManager.ensureForFeature(type === 'video' ? 'Video Call' : 'Audio Call');
      if (!granted) return;
    }
    _doStartGroupCall(type, c, memberIds);
  }

  function acceptGroupCall(data) {
    if (typeof window._handleAcceptedGroupCall === 'function') {
      window._handleAcceptedGroupCall(data);
    }
  }

  function init() {
    listenIncomingCalls();
    CC.initBubbleDrag();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 0); });
  }

  window.startVoiceCall = startVoiceCall;
  window.startVideoCall = startVideoCall;
  window.acceptCall = acceptCall;
  window.declineCall = declineCall;
  window.endCall = endCall;
  window.initiateOutgoingCall = initiateOutgoingCall;

  if (typeof window.startGroupVoiceCall !== 'function') {
    window.startGroupVoiceCall = function () { startGroupCall('voice'); };
  }
  if (typeof window.startGroupVideoCall !== 'function') {
    window.startGroupVideoCall = function () { startGroupCall('video'); };
  }

  window._stopOutgoingRingtone = _stopOutgoingRingtone;

})();
