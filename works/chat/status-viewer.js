(function () {
  'use strict';

  var _viewer = null;
  var _statuses = [];
  var _currentIndex = 0;
  var _userIndex = 0;
  var _userGroups = [];
  var _autoTimer = null;
  var _paused = false;
  var _progressInterval = null;
  var _progressValue = 0;
  var _totalDuration = 5000;
  var _startTime = 0;
  var _swipeStartY = 0;
  var _swipeStartX = 0;
  var _longPressTimer = null;
  var _isLongPress = false;

  var REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };
  function _toast(msg, t) { if (App && App.toast) App.toast(msg, t); else if (typeof window.showToast === 'function') window.showToast(msg, t); }
  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };
  function _now() { return Date.now(); }
  function _timeAgo(ts) {
    var diff = _now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  function _groupStatusesByUser(statuses) {
    var groups = [];
    var map = new Map();
    statuses.forEach(function (s) {
      if (!map.has(s.userId)) {
        map.set(s.userId, []);
      }
      map.get(s.userId).push(s);
    });
    map.forEach(function (userStatuses, userId) {
      userStatuses.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      var userName = 'User';
      var userPhoto = '';
      if (window.allUsers && Array.isArray(window.allUsers)) {
        var found = window.allUsers.find(function (u) { return u.uid === userId; });
        if (found) {
          userName = found.displayName || found.name || 'User';
          userPhoto = found.photoURL || found.avatar || '';
        }
      }
      groups.push({
        userId: userId,
        userName: userName,
        userPhoto: userPhoto,
        statuses: userStatuses
      });
    });
    return groups;
  }

  function _createViewerElement() {
    if (_viewer) _viewer.remove();
    _viewer = document.createElement('div');
    _viewer.id = 'status-viewer';
    _viewer.className = 'fixed inset-0 z-[10000] bg-black';
    _viewer.style.cssText = 'touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;';
    document.body.appendChild(_viewer);
    return _viewer;
  }

  function _renderProgressBars() {
    var group = _userGroups[_userIndex];
    if (!group) return '';
    var html = '<div class="flex gap-1 px-3 pt-3 pb-2">';
    group.statuses.forEach(function (s, i) {
      var isActive = i === _getLocalIndex();
      var isPast = i < _getLocalIndex();
      var pct = isActive ? _progressValue : (isPast ? 100 : 0);
      html += '<div class="flex-1 h-[3px] rounded-full overflow-hidden" style="background:rgba(255,255,255,0.3);">' +
        '<div class="h-full rounded-full transition-none" style="width:' + pct + '%;background:#fff;"></div>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  function _renderUserBar() {
    var group = _userGroups[_userIndex];
    if (!group) return '';
    var status = group.statuses[_getLocalIndex()];
    var ts = status ? _timeAgo(status.createdAt || _now()) : '';
    return '<div class="flex items-center gap-3 px-4 py-3">' +
      '<div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-surface-container-highest">' +
      (group.userPhoto ? '<img src="' + _esc(group.userPhoto) + '" class="w-full h-full object-cover" alt="' + _esc(group.userName) + '">' : '<div class="w-full h-full flex items-center justify-center text-on-surface-variant font-bold text-sm">' + _esc(group.userName.charAt(0)) + '</div>') +
      '</div>' +
      '<div class="flex-1 min-w-0">' +
      '<p class="text-white text-sm font-bold truncate">' + _esc(group.userName) + '</p>' +
      '<p class="text-white/60 text-[11px]">' + _esc(ts) + '</p>' +
      '</div>' +
      '<button class="p-2 rounded-full hover:bg-white/10 text-white/80 transition-colors" onclick="closeStatusViewer()" aria-label="Close status viewer">' +
      '<span class="material-symbols-outlined" style="font-size:22px">close</span>' +
      '</button>' +
      '</div>';
  }

  function _renderStatusContent() {
    var group = _userGroups[_userIndex];
    if (!group) return '';
    var status = group.statuses[_getLocalIndex()];
    if (!status) return '';
    var content = '';
    if (status.type === 'text') {
      var fontSize = '28px';
      var len = (status.content || '').length;
      if (len > 200) fontSize = '18px';
      else if (len > 100) fontSize = '22px';
      else if (len > 50) fontSize = '24px';
      content = '<div class="w-full h-full flex items-center justify-center p-8" style="background:' + _esc(status.bgColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)') + ';">' +
        '<p class="text-white text-center font-medium break-words max-w-md" style="font-size:' + fontSize + ';line-height:1.4;">' + _esc(status.content || '') + '</p>' +
        '</div>';
    } else if (status.type === 'image') {
      content = '<div class="w-full h-full flex items-center justify-center bg-black relative">' +
        '<img src="' + _esc(status.mediaUrl || status.content) + '" class="max-w-full max-h-full object-contain" alt="Status image" loading="eager">' +
        (status.caption ? '<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pb-6"><p class="text-white text-sm text-center">' + _esc(status.caption) + '</p></div>' : '') +
        '</div>';
    } else if (status.type === 'video') {
      content = '<div class="w-full h-full flex items-center justify-center bg-black relative">' +
        '<video id="sv-video" class="max-w-full max-h-full object-contain" src="' + _esc(status.mediaUrl || status.content) + '" autoplay muted playsinline loop></video>' +
        '<button id="sv-mute-btn" class="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white transition-colors" onclick="window._svToggleMute()" aria-label="Toggle mute">' +
        '<span class="material-symbols-outlined" style="font-size:20px">volume_off</span>' +
        '</button>' +
        (status.caption ? '<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pb-6"><p class="text-white text-sm text-center">' + _esc(status.caption) + '</p></div>' : '') +
        '</div>';
    }
    return content;
  }

  function _renderReactions() {
    var html = '<div class="flex items-center justify-center gap-2 py-2">';
    REACTION_EMOJIS.forEach(function (emoji) {
      html += '<button class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-125 transition-all text-xl" onclick="window._svReact(\'' + emoji + '\')" aria-label="React with ' + emoji + '">' + emoji + '</button>';
    });
    html += '</div>';
    return html;
  }

  function _renderReplyBar() {
    var group = _userGroups[_userIndex];
    var name = group ? group.userName : 'user';
    return '<div class="flex items-center gap-2 px-4 py-3 bg-black/60 backdrop-blur-sm">' +
      '<input id="sv-reply-input" class="flex-1 bg-white/10 text-white text-sm rounded-full px-4 py-2.5 border border-white/20 outline-none focus:border-white/40 placeholder-white/40 transition-colors" placeholder="Reply to ' + _esc(name) + '..." maxlength="500">' +
      '<button class="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0 hover:brightness-110 active:scale-95 transition-all" onclick="window._svSendReply()" aria-label="Send reply">' +
      '<span class="material-symbols-outlined" style="font-size:20px">send</span>' +
      '</button>' +
      '</div>';
  }

  function _renderActionButtons() {
    return '<div class="flex items-center justify-center gap-4 px-4 py-2">' +
      '<button class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-colors" onclick="window._svForward()" aria-label="Forward status">' +
      '<span class="material-symbols-outlined" style="font-size:16px">forward</span>Forward' +
      '</button>' +
      '<button class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-colors" onclick="window._svShareToChat()" aria-label="Share to chat">' +
      '<span class="material-symbols-outlined" style="font-size:16px">chat</span>Share' +
      '</button>' +
      '<button class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-colors" onclick="window._svReport()" aria-label="Report status">' +
      '<span class="material-symbols-outlined" style="font-size:16px">flag</span>Report' +
      '</button>' +
      '</div>';
  }

  function _getLocalIndex() {
    return _currentIndex;
  }

  function _render() {
    if (!_viewer) return;
    var group = _userGroups[_userIndex];
    if (!group) { closeStatusViewer(); return; }
    if (_getLocalIndex() >= group.statuses.length) {
      _goNextUser();
      return;
    }
    var status = group.statuses[_getLocalIndex()];
    if (!status) { closeStatusViewer(); return; }
    var isMyStatus = status.userId === _uid();
    var html = '<div class="w-full h-full flex flex-col relative">' +
      '<div class="absolute top-0 left-0 right-0 z-20" style="background:linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%);">' +
      _renderProgressBars() +
      _renderUserBar() +
      '</div>' +
      '<div class="flex-1 relative overflow-hidden">' +
      _renderStatusContent() +
      '</div>' +
      (isMyStatus ? _renderMyStatusInfo(status) : '') +
      '<div class="absolute bottom-0 left-0 right-0 z-20" style="background:linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);">' +
      _renderReactions() +
      _renderActionButtons() +
      _renderReplyBar() +
      '</div>' +
      '<div class="absolute top-0 bottom-0 left-0 w-1/3 z-10 cursor-pointer" onclick="window._svTapLeft()" aria-label="Previous"></div>' +
      '<div class="absolute top-0 bottom-0 right-0 w-1/3 z-10 cursor-pointer" onclick="window._svTapRight()" aria-label="Next"></div>' +
      '<div class="absolute top-0 bottom-0 left-1/3 right-1/3 z-10 cursor-pointer" onmousedown="window._svLongPressStart()" onmouseup="window._svLongPressEnd()" onmouseleave="window._svLongPressEnd()" ontouchstart="window._svLongPressStart()" ontouchend="window._svLongPressEnd()" aria-label="Pause"></div>' +
      '</div>';
    _viewer.innerHTML = html;
    _startAutoAdvance(status);
  }

  function _renderMyStatusInfo(status) {
    var viewCount = 0;
    if (Array.isArray(status.seenBy)) viewCount = status.seenBy.length;
    return '<div class="absolute top-20 right-4 z-30 flex flex-col items-center gap-1">' +
      '<div class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm">' +
      '<span class="material-symbols-outlined text-white" style="font-size:16px">visibility</span>' +
      '<span class="text-white text-xs font-semibold">' + viewCount + '</span>' +
      '</div>' +
      '<button class="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors mt-1" onclick="window._svDelete()" aria-label="Delete status">' +
      '<span class="material-symbols-outlined" style="font-size:16px">delete</span>' +
      '</button>' +
      '</div>';
  }

  function _startAutoAdvance(status) {
    _stopAutoAdvance();
    _paused = false;
    _progressValue = 0;
    _startTime = _now();
    if (status && status.type === 'video') {
      var vid = document.getElementById('sv-video');
      if (vid) {
        vid.onloadedmetadata = function () {
          _totalDuration = (vid.duration || 15) * 1000;
          _totalDuration = Math.max(_totalDuration, 3000);
          _totalDuration = Math.min(_totalDuration, 60000);
          _startProgressLoop();
        };
        vid.onerror = function () {
          _totalDuration = 5000;
          _startProgressLoop();
        };
        return;
      }
    }
    _totalDuration = 5000;
    _startProgressLoop();
  }

  function _startProgressLoop() {
    _stopProgressLoop();
    _progressInterval = setInterval(function () {
      if (_paused) return;
      var elapsed = _now() - _startTime;
      _progressValue = Math.min((elapsed / _totalDuration) * 100, 100);
      _updateProgressBars();
      if (_progressValue >= 100) {
        _goNext();
      }
    }, 50);
  }

  function _stopProgressLoop() {
    if (_progressInterval) { clearInterval(_progressInterval); _progressInterval = null; }
  }

  function _stopAutoAdvance() {
    _stopProgressLoop();
    _autoTimer && clearTimeout(_autoTimer);
    _autoTimer = null;
  }

  function _updateProgressBars() {
    if (!_viewer) return;
    var bars = _viewer.querySelectorAll('.flex.gap-1 > div > div');
    var group = _userGroups[_userIndex];
    if (!group) return;
    var localIdx = _getLocalIndex();
    group.statuses.forEach(function (s, i) {
      var barContainer = bars[i];
      if (!barContainer) return;
      var bar = barContainer.querySelector('div');
      if (!bar) return;
      if (i < localIdx) {
        bar.style.width = '100%';
      } else if (i === localIdx) {
        bar.style.width = _progressValue + '%';
      } else {
        bar.style.width = '0%';
      }
    });
  }

  function _goNext() {
    var group = _userGroups[_userIndex];
    if (!group) { closeStatusViewer(); return; }
    var localIdx = _getLocalIndex();
    if (localIdx < group.statuses.length - 1) {
      _currentIndex = localIdx + 1;
      _onStatusChange();
    } else {
      _goNextUser();
    }
  }

  function _goPrev() {
    var localIdx = _getLocalIndex();
    if (localIdx > 0) {
      _currentIndex = localIdx - 1;
      _onStatusChange();
    } else if (_userIndex > 0) {
      _userIndex--;
      var prevGroup = _userGroups[_userIndex];
      if (prevGroup) {
        _currentIndex = prevGroup.statuses.length - 1;
        _onStatusChange();
      }
    }
  }

  function _goNextUser() {
    if (_userIndex < _userGroups.length - 1) {
      _userIndex++;
      _currentIndex = 0;
      _animateTransition('left');
    } else {
      closeStatusViewer();
    }
  }

  function _animateTransition(dir) {
    if (!_viewer) return;
    var contentArea = _viewer.querySelector('.flex-1.relative');
    if (!contentArea) { _render(); return; }
    var startX = dir === 'left' ? '100%' : '-100%';
    contentArea.style.transition = 'none';
    contentArea.style.transform = 'translateX(' + startX + ')';
    contentArea.style.opacity = '0';
    _render();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var ca = _viewer ? _viewer.querySelector('.flex-1.relative') : null;
        if (ca) {
          ca.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease';
          ca.style.transform = 'translateX(0)';
          ca.style.opacity = '1';
          setTimeout(function () {
            if (ca) { ca.style.transition = 'none'; }
          }, 350);
        }
      });
    });
  }

  function _onStatusChange() {
    var group = _userGroups[_userIndex];
    if (!group) return;
    var status = group.statuses[_getLocalIndex()];
    if (!status) { closeStatusViewer(); return; }
    if (typeof window.markStatusSeen === 'function') {
      window.markStatusSeen(status.id, status.userId);
    }
    _render();
  }

  function openStatusViewer(statuses, startIndex) {
    if (!statuses || statuses.length === 0) return;
    _statuses = statuses;
    _currentIndex = startIndex || 0;
    _userGroups = _groupStatusesByUser(statuses);
    _userIndex = 0;
    for (var i = 0; i < _userGroups.length; i++) {
      var group = _userGroups[i];
      for (var j = 0; j < group.statuses.length; j++) {
        if (group.statuses[j].id === statuses[_currentIndex].id) {
          _userIndex = i;
          _currentIndex = j;
          break;
        }
      }
    }
    _createViewerElement();
    document.body.style.overflow = 'hidden';
    _setupTouchHandlers();
    _setupKeyboardHandlers();
    _render();
  }

  function _setupTouchHandlers() {
    if (!_viewer) return;
    _viewer.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        _swipeStartY = e.touches[0].clientY;
        _swipeStartX = e.touches[0].clientX;
      }
    }, { passive: true });
    _viewer.addEventListener('touchend', function (e) {
      var dy = e.changedTouches[0].clientY - _swipeStartY;
      var dx = e.changedTouches[0].clientX - _swipeStartX;
      if (Math.abs(dy) > Math.abs(dx) && dy > 80) {
        closeStatusViewer();
      }
    }, { passive: true });
  }

  function _setupKeyboardHandlers() {
    _viewer._keyHandler = function (e) {
      if (e.key === 'Escape') { closeStatusViewer(); return; }
      if (e.key === 'ArrowRight') { _goNext(); return; }
      if (e.key === 'ArrowLeft') { _goPrev(); return; }
      if (e.key === ' ') {
        e.preventDefault();
        if (_paused) resumeStatus(); else pauseStatus();
        return;
      }
    };
    document.addEventListener('keydown', _viewer._keyHandler);
  }

  function nextStatus() {
    _goNext();
  }

  function prevStatus() {
    _goPrev();
  }

  function pauseStatus() {
    _paused = true;
    var vid = document.getElementById('sv-video');
    if (vid && typeof vid.pause === 'function') vid.pause();
  }

  function resumeStatus() {
    _paused = false;
    _startTime = _now() - (_progressValue / 100) * _totalDuration;
    var vid = document.getElementById('sv-video');
    if (vid && typeof vid.play === 'function') vid.play().catch(function () {});
  }

  async function replyToCurrentStatus(text) {
    if (!text || !text.trim()) return;
    var group = _userGroups[_userIndex];
    if (!group) return;
    var status = group.statuses[_getLocalIndex()];
    if (!status) return;
    if (typeof window.replyToStatus === 'function') {
      await window.replyToStatus(status.id, text);
    }
  }

  function closeStatusViewer() {
    _stopAutoAdvance();
    if (_viewer && _viewer._keyHandler) {
      document.removeEventListener('keydown', _viewer._keyHandler);
    }
    if (_viewer) { _viewer.remove(); _viewer = null; }
    document.body.style.overflow = '';
    _statuses = [];
    _currentIndex = 0;
    _userIndex = 0;
    _userGroups = [];
    _paused = false;
    _progressValue = 0;
    _progressInterval && clearInterval(_progressInterval);
    _progressInterval = null;
    delete window._svTapLeft;
    delete window._svTapRight;
    delete window._svLongPressStart;
    delete window._svLongPressEnd;
    delete window._svReact;
    delete window._svSendReply;
    delete window._svForward;
    delete window._svShareToChat;
    delete window._svReport;
    delete window._svDelete;
    delete window._svToggleMute;
  }

  window._svTapLeft = function () {
    if (_isLongPress) return;
    var group = _userGroups[_userIndex];
    if (!group) return;
    var status = group.statuses[_getLocalIndex()];
    if (status && status.type === 'video') {
      var vid = document.getElementById('sv-video');
      if (vid) {
        vid.currentTime = Math.max(vid.currentTime - 3, 0);
        return;
      }
    }
    _goPrev();
  };

  window._svTapRight = function () {
    if (_isLongPress) return;
    var group = _userGroups[_userIndex];
    if (!group) return;
    var status = group.statuses[_getLocalIndex()];
    if (status && status.type === 'video') {
      var vid = document.getElementById('sv-video');
      if (vid) {
        vid.currentTime = Math.min(vid.currentTime + 3, vid.duration || 0);
        return;
      }
    }
    _goNext();
  };

  window._svLongPressStart = function () {
    _isLongPress = false;
    _longPressTimer = setTimeout(function () {
      _isLongPress = true;
      pauseStatus();
    }, 300);
  };

  window._svLongPressEnd = function () {
    if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
    if (_isLongPress) {
      _isLongPress = false;
      resumeStatus();
    }
  };

  window._svReact = function (emoji) {
    var group = _userGroups[_userIndex];
    if (!group) return;
    var status = group.statuses[_getLocalIndex()];
    if (!status) return;
    var d = (window.App && window.App.db) ? window.App.db : (typeof db !== 'undefined' ? db : null);
    var uid = _uid();
    if (!d || !uid) { _toast('Not authenticated', 'error'); return; }
    d.collection('statuses').doc(status.id).collection('reactions').add({
      userId: uid,
      emoji: emoji,
      createdAt: _now()
    }).then(function () {
      _toast('Reacted!', 'success');
    }).catch(function (e) {
      console.warn('[StatusViewer] React error:', e);
    });
  };

  window._svSendReply = function () {
    var input = document.getElementById('sv-reply-input');
    if (!input || !input.value.trim()) return;
    var text = input.value.trim();
    input.value = '';
    replyToCurrentStatus(text);
  };

  window._svForward = function () {
    var group = _userGroups[_userIndex];
    if (!group) return;
    var status = group.statuses[_getLocalIndex()];
    if (!status) return;
    if (typeof window.openForwardModal === 'function') {
      var msgText = '';
      if (status.type === 'text') msgText = status.content;
      else if (status.type === 'image') msgText = (status.caption || '') + ' ' + (status.mediaUrl || status.content);
      else if (status.type === 'video') msgText = (status.caption || '') + ' ' + (status.mediaUrl || status.content);
      window.openForwardModal({ text: msgText.trim(), type: status.type, mediaUrl: status.mediaUrl || status.content });
    } else {
      _toast('Forward feature not available', 'info');
    }
  };

  window._svShareToChat = function () {
    var group = _userGroups[_userIndex];
    if (!group) return;
    var status = group.statuses[_getLocalIndex()];
    if (!status) return;
    var d = (window.App && window.App.db) ? window.App.db : (typeof db !== 'undefined' ? db : null);
    var uid = _uid();
    if (!d || !uid) return;
    if (typeof window.openForwardModal === 'function') {
      window._svForward();
    } else {
      _toast('Shared to status', 'success');
    }
  };

  window._svReport = function () {
    var group = _userGroups[_userIndex];
    if (!group) return;
    var status = group.statuses[_getLocalIndex()];
    if (!status) return;
    var popup = document.createElement('div');
    popup.className = 'fixed inset-0 z-[10001] bg-black/60 flex items-center justify-center';
    popup.onclick = function (e) { if (e.target === popup) popup.remove(); };
    var reasons = ['Spam', 'Nudity or sexual content', 'Hate speech or symbols', 'Violence', 'Harassment', 'False information'];
    var inner = '<div class="bg-surface-container rounded-2xl w-80 p-4 shadow-xl">';
    inner += '<p class="text-sm font-bold text-on-surface mb-3">Report Status</p>';
    reasons.forEach(function (r) {
      inner += '<button class="w-full text-left px-4 py-3 rounded-xl text-sm text-on-surface hover:bg-surface-variant/20 transition-colors border-b border-outline-variant/10 last:border-0" onclick="window._svSubmitReport(\'' + _esc(r) + '\');this.closest(\'.fixed\').remove()">' + _esc(r) + '</button>';
    });
    inner += '<button class="w-full mt-2 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-variant/20 transition-colors" onclick="this.closest(\'.fixed\').remove()">Cancel</button>';
    inner += '</div>';
    popup.innerHTML = inner;
    document.body.appendChild(popup);
  };

  window._svSubmitReport = function (reason) {
    var group = _userGroups[_userIndex];
    if (!group) return;
    var status = group.statuses[_getLocalIndex()];
    if (!status) return;
    var d = (window.App && window.App.db) ? window.App.db : (typeof db !== 'undefined' ? db : null);
    var uid = _uid();
    if (!d) return;
    d.collection('reports').add({
      type: 'status',
      targetId: status.id,
      targetUserId: status.userId,
      reportedBy: uid || 'anonymous',
      reason: reason,
      createdAt: _now()
    }).then(function () {
      _toast('Status reported. Thank you.', 'success');
    }).catch(function (e) {
      console.warn('[StatusViewer] Report error:', e);
      _toast('Failed to report', 'error');
    });
  };

  window._svDelete = function () {
    var group = _userGroups[_userIndex];
    if (!group) return;
    var status = group.statuses[_getLocalIndex()];
    if (!status) return;
    if (status.userId !== _uid()) { _toast('Cannot delete others\' status', 'error'); return; }
    var popup = document.createElement('div');
    popup.className = 'fixed inset-0 z-[10001] bg-black/60 flex items-center justify-center';
    popup.onclick = function (e) { if (e.target === popup) popup.remove(); };
    popup.innerHTML = '<div class="bg-surface-container rounded-2xl w-80 p-5 shadow-xl text-center">' +
      '<span class="material-symbols-outlined text-red-400 text-4xl block mb-3">delete</span>' +
      '<p class="text-sm font-bold text-on-surface mb-1">Delete Status?</p>' +
      '<p class="text-xs text-on-surface-variant mb-4">This action cannot be undone.</p>' +
      '<div class="flex gap-2">' +
      '<button class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-surface-container-highest text-on-surface hover:brightness-110 transition-all" onclick="this.closest(\'.fixed\').remove()">Cancel</button>' +
      '<button class="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-500 text-white hover:brightness-110 transition-all" onclick="window._svConfirmDelete(\'' + _esc(status.id) + '\')">Delete</button>' +
      '</div></div>';
    document.body.appendChild(popup);
  };

  window._svConfirmDelete = async function (statusId) {
    if (typeof window.deleteStatus === 'function') {
      await window.deleteStatus(statusId);
    }
    var group = _userGroups[_userIndex];
    if (group) {
      group.statuses = group.statuses.filter(function (s) { return s.id !== statusId; });
      if (group.statuses.length === 0) {
        _userGroups.splice(_userIndex, 1);
        if (_userGroups.length === 0) { closeStatusViewer(); return; }
        if (_userIndex >= _userGroups.length) _userIndex = _userGroups.length - 1;
        _currentIndex = 0;
      } else {
        if (_currentIndex >= group.statuses.length) _currentIndex = group.statuses.length - 1;
      }
      _render();
    }
    var popup = document.querySelector('.fixed.z-\\[10001\\]');
    if (popup) popup.remove();
  };

  window._svToggleMute = function () {
    var vid = document.getElementById('sv-video');
    var btn = document.getElementById('sv-mute-btn');
    if (!vid) return;
    vid.muted = !vid.muted;
    if (btn) {
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">' + (vid.muted ? 'volume_off' : 'volume_up') + '</span>';
    }
  };

  window.openStatusViewer = openStatusViewer;
  window.nextStatus = nextStatus;
  window.prevStatus = prevStatus;
  window.pauseStatus = pauseStatus;
  window.resumeStatus = resumeStatus;
  window.replyToCurrentStatus = replyToCurrentStatus;
  window.closeStatusViewer = closeStatusViewer;

})();
