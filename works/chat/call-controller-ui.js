/* call-controller-ui.js — Call UI management (show/hide call screen, minimize, maximize, bubble) */
(function () {
  'use strict';

  var CC = window._CC;

  function showCallScreen(type, name, initials) {
    CC.callType = type;
    App.callActive = true;
    micMuted = false;
    cameraOff = (type === 'voice');
    App._activeCallId = CC.callId;

    CC.txt('call-name', name || 'Unknown');
    CC.txt('call-status', type === 'video' ? 'Connecting…' : 'Calling…');
    CC.hide('call-timer');
    CC.show('call-screen');
    CC.txt('call-quality-text', type === 'video' ? 'HD Video call' : 'HD Voice call');
    var camBtn = CC.$('btn-cam');
    var ssBtn = CC.$('btn-screenshare');
    if (camBtn) camBtn.classList.toggle('hidden', type === 'voice');
    if (ssBtn) ssBtn.classList.add('hidden');
    var rv = CC.$('remote-video');
    var lvc = CC.$('local-video-container');
    if (rv) rv.classList.add('hidden');
    if (lvc) lvc.classList.add('hidden');
    CC.show('call-info-section');

    var av = CC.$('call-avatar');
    if (av) {
      av.className = 'w-32 h-32 rounded-full border-4 border-primary/30 flex items-center justify-center text-5xl bg-white/10 animate-pulse';
      av.textContent = initials || '?';
    }
    var bb = CC.$('call-bubble');
    if (bb) bb.style.display = 'none';

    var encBadge = CC.$('call-encryption-badge');
    if (!encBadge) {
      var info = CC.$('call-info-section');
      if (info) {
        var badge = document.createElement('p');
        badge.id = 'call-encryption-badge';
        badge.className = 'text-white/40 text-[10px] mt-2 flex items-center gap-1';
        badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px">wifi</span> Peer-to-peer connection';
        info.appendChild(badge);
      }
    }

    try { history.pushState({ callActive: true }, ''); } catch (_) {}

    _initLocalVideoDrag();
    _initRemoteVideoPinchZoom();
    var ssBtn = CC.$('btn-screenshare');
    if (ssBtn) ssBtn.classList.toggle('hidden', type === 'voice' || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia);
  }

  function minimizeCall() {
    CC.hide('call-screen');
    if (App.callActive) {
      var bubble = CC.$('call-bubble');
      if (bubble) {
        bubble.style.display = 'flex';
        CC.txt('bubble-call-name', CC.$('call-name')?.textContent || 'Call');
        CC.txt('bubble-call-timer', CC.$('call-timer')?.textContent || '0:00');
      }
      if (navigator.vibrate) navigator.vibrate(30);
    }
  }

  function maximizeCall() {
    if (!App.callActive) return;
    var bubble = CC.$('call-bubble');
    if (bubble) bubble.style.display = 'none';
    CC.show('call-screen');
  }

  function initBubbleDrag() {
    var bubble = CC.$('call-bubble');
    if (!bubble || bubble.dataset.dragInit) return;
    bubble.dataset.dragInit = '1';

    var dragging = false;
    var startX = 0, startY = 0;
    var origLeft = 0, origTop = 0;
    var moved = false;
    var isRight = true;

    function getPos(e) {
      if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: e.clientX, y: e.clientY };
    }

    function onStart(e) {
      var rect = bubble.getBoundingClientRect();
      isRight = rect.left > window.innerWidth / 2;
      origLeft = isRight ? (window.innerWidth - rect.right) : rect.left;
      origTop = rect.top;
      var pos = getPos(e);
      startX = pos.x;
      startY = pos.y;
      dragging = true;
      moved = false;
      bubble.style.transition = 'none';
      bubble.style.right = 'auto';
      bubble.style.left = 'auto';
      bubble.style.bottom = 'auto';
      bubble.style.top = origTop + 'px';
      if (isRight) bubble.style.right = origLeft + 'px';
      else bubble.style.left = origLeft + 'px';
    }

    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      var pos = getPos(e);
      var dx = pos.x - startX;
      var dy = pos.y - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;
      var newTop = Math.max(0, Math.min(window.innerHeight - 50, origTop + dy));
      var newSide = origLeft + dx;
      bubble.style.top = newTop + 'px';
      if (isRight) {
        bubble.style.right = Math.max(0, Math.min(window.innerWidth - 60, newSide)) + 'px';
        bubble.style.left = 'auto';
      } else {
        bubble.style.left = Math.max(0, Math.min(window.innerWidth - 60, newSide)) + 'px';
        bubble.style.right = 'auto';
      }
    }

    function onEnd() {
      if (!dragging) return;
      dragging = false;
      bubble.style.transition = '';
      var rect = bubble.getBoundingClientRect();
      var nearRight = rect.left > window.innerWidth / 2;
      var nearBottom = rect.top > window.innerHeight / 2;
      bubble.style.right = 'auto';
      bubble.style.left = 'auto';
      bubble.style.bottom = 'auto';
      bubble.style.top = 'auto';
      if (nearRight) {
        bubble.style.right = Math.max(24, window.innerWidth - rect.right) + 'px';
      } else {
        bubble.style.left = Math.max(24, rect.left) + 'px';
      }
      bubble.style.bottom = Math.max(24, window.innerHeight - rect.bottom) + 'px';
    }

    bubble.addEventListener('mousedown', function (e) { if (e.target.closest('button')) return; onStart(e); });
    bubble.addEventListener('touchstart', function (e) { if (e.target.closest('button')) return; onStart(e); }, { passive: true });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);

    bubble.addEventListener('click', function (e) {
      if (moved || e.target.closest('button')) return;
      maximizeCall();
    });
  }

  async function openCallPicker() {
    if (CC.state !== CC.STATES.IDLE) { CC.toast('Already in a call', 'info'); return; }
    var list = CC.$('call-picker-list');
    if (!list) return;
    list.innerHTML = '<div class="flex items-center justify-center p-8 text-on-surface-variant text-sm"><div class="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-3"></div>Loading contacts…</div>';
    CC.show('call-picker-overlay');

    try {
      var myUid = CC.uid();
      if (!myUid || !CC.db()) { list.innerHTML = '<p class="text-on-surface-variant text-sm text-center p-8">Sign in to make calls</p>'; return; }

      var usersSnap = await CC.db().collection('users').orderBy('displayName').limit(100).get();
      var html = '';
      usersSnap.forEach(function (doc) {
        var u = doc.data();
        var uId = doc.id;
        if (uId === myUid) return;
        if (u.deletedAt || u.deletionScheduledAt) return;
        var name = u.displayName || u.email || 'Unknown';
        var initials = (name[0] || '?').toUpperCase();
        var avatarHtml = u.photoURL
          ? '<img src="' + u.photoURL + '" class="w-11 h-11 rounded-full object-cover" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm" style="display:none">' + CC.escHtml(initials) + '</div>'
          : '<div class="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">' + CC.escHtml(initials) + '</div>';
        html += '<div class="flex items-center gap-3 px-4 py-3 hover:bg-surface-variant/50 rounded-xl cursor-pointer transition-colors" onclick="selectCallContact(\'' + CC.escHtml(uId) + '\',\'' + CC.escHtml(name.replace(/'/g, "\\'")) + '\',\'' + CC.escHtml(u.photoURL || '') + '\')">' +
          avatarHtml +
          '<div class="flex-1 min-w-0">' +
          '<div class="font-semibold text-sm text-on-surface truncate">' + CC.escHtml(name) + '</div>' +
          '<div class="text-xs text-on-surface-variant">' + CC.escHtml(u.email || '') + '</div>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
          '<button class="min-w-[44px] min-h-[44px] rounded-full bg-green-500/10 text-green-500 hover:bg-green-500/20 flex items-center justify-center transition-all" title="Voice call"><span class="material-symbols-outlined text-lg">call</span></button>' +
          '<button class="min-w-[44px] min-h-[44px] rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 flex items-center justify-center transition-all" title="Video call"><span class="material-symbols-outlined text-lg">videocam</span></button>' +
          '</div></div>';
      });

      if (!html) {
        html = '<p class="text-on-surface-variant text-sm text-center p-8">No contacts found</p>';
      }
      list.innerHTML = html;
    } catch (err) {
      console.warn('Call picker load error:', err);
      list.innerHTML = '<p class="text-on-surface-variant text-sm text-center p-8">Failed to load contacts</p>';
    }
  }

  function selectCallContact(targetUid, targetName, targetAvatar, callType) {
    CC.closeModalFn('call-picker-overlay');
    var c = { uid: targetUid, name: targetName, initials: (targetName || '?')[0].toUpperCase(), type: 'direct', photoURL: targetAvatar };
    if (CC.state !== CC.STATES.IDLE) { CC.toast('Already in a call', 'info'); return; }
    window.initiateOutgoingCall(callType || 'voice', c);
  }

  function _initLocalVideoDrag() {
    var lvc = CC.$('local-video-container');
    if (!lvc || lvc.dataset.lvcDragInit) return;
    lvc.dataset.lvcDragInit = '1';
    var dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;
    function getPos(e) {
      if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: e.clientX, y: e.clientY };
    }
    function onStart(e) {
      if (e.target.closest('button')) return;
      var rect = lvc.getBoundingClientRect();
      origLeft = rect.left; origTop = rect.top;
      var pos = getPos(e); startX = pos.x; startY = pos.y;
      dragging = true; lvc.style.transition = 'none';
      lvc.style.position = 'fixed'; lvc.style.left = origLeft + 'px'; lvc.style.top = origTop + 'px';
      lvc.style.right = 'auto'; lvc.style.bottom = 'auto';
    }
    function onMove(e) {
      if (!dragging) return; e.preventDefault();
      var pos = getPos(e);
      lvc.style.left = Math.max(0, Math.min(window.innerWidth - 80, origLeft + (pos.x - startX))) + 'px';
      lvc.style.top = Math.max(0, Math.min(window.innerHeight - 80, origTop + (pos.y - startY))) + 'px';
    }
    function onEnd() {
      if (!dragging) return; dragging = false; lvc.style.transition = '';
    }
    lvc.addEventListener('mousedown', onStart);
    lvc.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
  }

  function _initRemoteVideoPinchZoom() {
    var rv = CC.$('remote-video');
    if (!rv || rv.dataset.pinchInit) return;
    rv.dataset.pinchInit = '1';
    var initialDist = 0, currentScale = 1;
    function getDist(e) {
      var t = e.touches;
      return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    }
    rv.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) { initialDist = getDist(e); }
    }, { passive: true });
    rv.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && initialDist > 0) {
        e.preventDefault();
        var scale = Math.max(1, Math.min(3, currentScale * (getDist(e) / initialDist)));
        rv.style.transform = 'scale(' + scale + ')';
      }
    }, { passive: false });
    rv.addEventListener('touchend', function (e) {
      if (e.touches.length < 2) {
        currentScale = parseFloat(rv.style.transform.replace('scale(', '').replace(')', '')) || 1;
        if (currentScale < 1.1) { currentScale = 1; rv.style.transform = ''; }
        initialDist = 0;
      }
    });
  }

  CC.showCallScreen = showCallScreen;
  CC.minimizeCall = minimizeCall;
  CC.maximizeCall = maximizeCall;
  CC.initBubbleDrag = initBubbleDrag;
  CC.openCallPicker = openCallPicker;
  CC.selectCallContact = selectCallContact;

  window.minimizeCall = minimizeCall;
  window.maximizeCall = maximizeCall;
  window.openCallPicker = openCallPicker;
  window.selectCallContact = selectCallContact;

})();
