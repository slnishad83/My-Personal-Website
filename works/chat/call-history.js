'use strict';
(function () {
  var _loadToken = 0;
  var _allCalls = [];
  var _filteredCalls = [];
  var _searchQuery = '';
  var _activeFilter = 'all';
  var callHistoryFilter = 'all';
  var _listenerActive = false;
  var _selectionMode = false;
  var _selectedIds = new Set();
  var _longPressTimer = null;
  var _detailOverlay = null;

  var _db = function() { return App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };
  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };
  function _me() { return (window.App && window.App.currentUser) ? window.App.currentUser : null; }
  function _$(id) { return document.getElementById(id); }
  function _txt(id, v) { var e = _$(id); if (e) e.textContent = v; }
  function _show(id) { var e = _$(id); if (e) e.classList.remove('hidden'); }
  function _hide(id) { var e = _$(id); if (e) e.classList.add('hidden'); }
  function _toast(msg, t) { if (App && App.toast) App.toast(msg, t); else if (typeof window.showToast === 'function') window.showToast(msg, t); }
  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  /* ── Chat-state enrichment (resolve names / avatars like WhatsApp) ── */
  function _chatState() {
    if (typeof window.getCurrentChatState === 'function') {
      var s = window.getCurrentChatState();
      return (s && s.chats) || [];
    }
    return [];
  }

  function _getCallDuration(durationMs) {
    if (durationMs == null || durationMs === 0) return '';
    var totalSec = Math.floor(durationMs / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return min + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function _formatTimestamp(ts) {
    if (!ts) return '';
    var date;
    if (ts && ts.toMillis && typeof ts.toMillis === 'function') {
      date = new Date(ts.toMillis());
    } else if (ts && ts.seconds) {
      date = new Date(ts.seconds * 1000);
    } else if (typeof ts === 'number') {
      date = new Date(ts);
    } else if (ts instanceof Date) {
      date = ts;
    } else {
      return '';
    }
    return date.getTime();
  }

  function _formatCallTime(timestampMs) {
    if (!timestampMs) return '';
    var date = new Date(timestampMs);
    var h = date.getHours();
    var m = date.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  /* WhatsApp shows a time for today, else the date. */
  function _formatListTime(timestampMs) {
    if (!timestampMs) return '';
    var now = new Date();
    var date = new Date(timestampMs);
    var sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
    if (sameDay) return _formatCallTime(timestampMs);
    var sameYear = date.getFullYear() === now.getFullYear();
    if (sameYear) {
      var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      return days[date.getDay()];
    }
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
  }

  function _formatCallDate(timestampMs) {
    if (!timestampMs) return '';
    var date = new Date(timestampMs);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
  }

  function _isGroupCall(call) {
    if (!call) return false;
    if (call.metadata && call.metadata.groupCall) return true;
    return call.groupCall === true || call.isGroupCall === true;
  }

  function _getContactName(call) {
    var myUid = _uid();
    if (call.fromUserId === myUid) return call.toUserName || 'Unknown';
    if (call.toUserId === myUid) return call.fromUserName || 'Unknown';
    return call.fromUserName || call.toUserName || 'Unknown';
  }

  function _getContactUid(call) {
    var myUid = _uid();
    if (call.fromUserId === myUid) return call.toUserId || '';
    if (call.toUserId === myUid) return call.fromUserId || '';
    return call.fromUserId || '';
  }

  function _getContactAvatar(call) {
    var myUid = _uid();
    if (call.fromUserId === myUid) return call.toUserAvatar || '';
    if (call.toUserId === myUid) return call.fromUserAvatar || '';
    return call.fromUserAvatar || '';
  }

  /* Resolve display info (name, avatar, target ids) for a call, WhatsApp-style. */
  function _getCallInfo(call) {
    var isGroup = _isGroupCall(call);
    var meta = call.metadata && typeof call.metadata === 'object' ? call.metadata : {};
    if (isGroup) {
      var gid = call.groupId || meta.groupId || '';
      var gName = call.groupName || meta.groupName || '';
      var gAvatar = call.groupAvatar || meta.groupAvatar || '';
      var group = gid
        ? _chatState().find(function (c) { return c.type === 'group' && c.id === gid; })
        : null;
      if (!group && gName) {
        var gNameLower = String(gName).toLowerCase();
        group = _chatState().find(function (c) { return c.type === 'group' && c.name && String(c.name).toLowerCase() === gNameLower; }) || null;
      }
      if (group) {
        gName = group.name || gName;
        gAvatar = gAvatar || group.photoURL || '';
        if (!gid) gid = group.id;
      }
      return {
        isGroup: true,
        name: gName || 'Group call',
        avatar: gAvatar || '',
        groupId: gid,
        participants: call.participantIds || [],
        fromUserId: call.fromUserId || call.initiatorId || ''
      };
    }
    var uid = _getContactUid(call);
    var name = _getContactName(call);
    var avatar = _getContactAvatar(call);
    var direct = uid
      ? _chatState().find(function (c) { return c.type === 'direct' && c.otherUserId === uid; }) || null
      : null;
    if (direct) {
      name = direct.name || name;
      avatar = avatar || direct.photoURL || '';
    }
    return { isGroup: false, name: name, avatar: avatar, uid: uid };
  }

  function _getDirection(call) {
    var myUid = _uid();
    if (call.fromUserId === myUid) return 'outgoing';
    return 'incoming';
  }

  function _isMissedCall(call) {
    if (!call) return false;
    if (call.status === 'declined') return false;
    if (call.status === 'missed' || call.status === 'no-answer' || call.status === 'busy') {
      return true;
    }
    if (call.status === 'cancelled' || call.status === 'rejected') {
      return _getDirection(call) === 'incoming';
    }
    return false;
  }

  function _getStatusLabel(call, info, direction, missed) {
    if (missed) return 'Missed';
    var status = call && call.status ? call.status : '';
    if (status === 'declined' || status === 'rejected') return 'Declined';
    if (status === 'cancelled') return 'Cancelled';
    if (status === 'busy') return 'Busy';
    if (info && info.isGroup) return direction === 'incoming' ? 'Incoming group call' : 'Outgoing group call';
    return direction === 'incoming' ? 'Incoming' : 'Outgoing';
  }

  /* ── WhatsApp actions ─────────────────────────────────────────── */
  function _openChatForCall(call) {
    if (!call) return;
    var info = _getCallInfo(call);
    if (info.isGroup) {
      var g = null;
      if (info.groupId) {
        g = _chatState().find(function (c) { return c.type === 'group' && c.id === info.groupId; }) || null;
      }
      if (!g) {
        var gLower = String(info.name).toLowerCase();
        g = _chatState().find(function (c) { return c.type === 'group' && c.name && String(c.name).toLowerCase() === gLower; }) || null;
      }
      if (g && typeof window.openChat === 'function') return window.openChat(g.id, 'group');
      if (info.groupId && typeof window.openChat === 'function') return window.openChat(info.groupId, 'group');
      return;
    }
    if (!info.uid) return;
    if (typeof window.startDirectChat === 'function') {
      return window.startDirectChat({ uid: info.uid, name: info.name, photoURL: info.avatar });
    }
    if (typeof window.openChat === 'function') {
      var myUid = _uid();
      return window.openChat([myUid, info.uid].sort().join('_'), 'direct');
    }
  }

  function _callBackForCall(call) {
    if (!call) return;
    var info = _getCallInfo(call);
    var type = call.callType || 'voice';
    if (info.isGroup) {
      var pid = (info.participants || []).filter(function (p) { return p && p !== _uid(); });
      if (typeof window.startGroupCall === 'function') {
        return window.startGroupCall(pid, type, {
          groupId: info.groupId,
          groupName: info.name,
          groupAvatar: info.avatar
        });
      }
      if (type === 'video' && typeof window.startGroupVideoCall === 'function') return window.startGroupVideoCall();
      if (typeof window.startGroupVoiceCall === 'function') return window.startGroupVoiceCall();
      return;
    }
    if (info.uid && typeof window.callContact === 'function') return window.callContact(info.uid, type);
  }

  function _renderAvatar(name, avatar) {
    var initials = (name || '?')[0].toUpperCase();
    if (avatar) {
      return '<img src="' + _esc(avatar) + '" class="w-11 h-11 rounded-full object-cover" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
        '<div class="w-11 h-11 rounded-full bg-primary/15 text-primary items-center justify-center font-bold text-sm" style="display:none">' + _esc(initials) + '</div>';
    }
    return '<div class="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">' + _esc(initials) + '</div>';
  }

  function _filterCalls() {
    var calls = _allCalls;
    var filter = _activeFilter;
    var query = (_searchQuery || '').toLowerCase().trim();

    if (filter === 'missed') {
      calls = calls.filter(function (c) { return _isMissedCall(c); });
    } else if (filter === 'incoming') {
      calls = calls.filter(function (c) { return _getDirection(c) === 'incoming'; });
    } else if (filter === 'outgoing') {
      calls = calls.filter(function (c) { return _getDirection(c) === 'outgoing'; });
    }

    if (query) {
      calls = calls.filter(function (c) {
        var info = _getCallInfo(c);
        var name = (info.name || '').toLowerCase();
        var phone = (c.fromUserPhone || c.toUserPhone || '').toLowerCase();
        return name.indexOf(query) !== -1 || phone.indexOf(query) !== -1;
      });
    }

    _filteredCalls = calls;
    return calls;
  }

  function _renderCallHistoryItem(call) {
    var info = _getCallInfo(call);
    var name = info.name;
    var avatar = info.avatar;
    var direction = _getDirection(call);
    var missed = _isMissedCall(call);
    var durationMs = call.durationMs;
    var duration = _getCallDuration(durationMs);
    var ts = _formatTimestamp(call.startedAt || call.createdAt || call.endedAt);
    var timeStr = _formatListTime(ts);
    var statusLabel = _getStatusLabel(call, info, direction, missed);
    var nameColor = missed ? 'text-red-500' : 'text-on-surface';
    var statusColor = missed ? 'text-red-500' : 'text-on-surface-variant';
    var isSelected = _selectedIds.has(call.id);
    var selectedCheck = isSelected ? '<div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-white" style="font-size:14px">check</span></div>' : '<div class="w-5 h-5 rounded-full border-2 border-outline/40 flex-shrink-0"></div>';
    var selectionClass = _selectionMode ? 'pl-2' : '';

    var dirIcon;
    var dirColor;
    if (missed) {
      dirIcon = 'call_missed';
      dirColor = 'text-red-500';
    } else if (direction === 'incoming') {
      dirIcon = 'call_received';
      dirColor = 'text-green-400';
    } else {
      dirIcon = 'call_made';
      dirColor = 'text-green-400';
    }

    var callIcon = (call.callType || call.type) === 'video' ? 'videocam' : 'call';
    var subParts = [statusLabel];
    if (!missed && duration) subParts.push(duration);
    if (timeStr) subParts.push(timeStr);
    var subline = subParts.join(' \u00b7 ');

    var infoBtn = '<button class="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-surface-variant/50 transition-colors flex-shrink-0" data-call-info="' + _esc(call.id) + '" title="Call details" aria-label="Call details"><span class="material-symbols-outlined text-on-surface-variant" style="font-size:16px">info</span></button>';
    var callBtn = '<button class="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-green-500/10 transition-colors flex-shrink-0" data-call-callback="' + _esc(call.id) + '" data-call-type="' + _esc(call.callType || 'voice') + '" title="' + (callIcon === 'videocam' ? 'Video call' : 'Call back') + '" aria-label="' + (callIcon === 'videocam' ? 'Video call' : 'Call back') + '"><span class="material-symbols-outlined text-green-500" style="font-size:16px">' + callIcon + '</span></button>';

    return '<div class="flex items-center gap-3 px-4 py-3 hover:bg-surface-variant/30 rounded-xl cursor-pointer transition-colors group ' + selectionClass + '" data-call-entry="' + _esc(call.id) + '" role="button" tabindex="0">' +
      (_selectionMode ? selectedCheck : '') +
      '<div class="relative flex-shrink-0">' +
      '<div class="w-11 h-11 rounded-full overflow-hidden">' + _renderAvatar(name, avatar) + '</div>' +
      '</div>' +
      '<div class="flex-1 min-w-0">' +
      '<span class="block font-semibold text-sm ' + nameColor + ' truncate">' + _esc(name) + '</span>' +
      '<div class="flex items-center gap-1.5 mt-0.5">' +
      '<span class="material-symbols-outlined ' + dirColor + '" style="font-size:14px">' + dirIcon + '</span>' +
      '<span class="text-xs ' + statusColor + ' truncate">' + _esc(subline) + '</span>' +
      '</div>' +
      '</div>' +
      '<div class="flex items-center gap-1 flex-shrink-0">' +
      (!_selectionMode ? infoBtn : '') +
      (!_selectionMode ? callBtn : '') +
      '</div>' +
      '</div>';
  }

  function _getCallDateGroup(timestampMs) {
    if (!timestampMs) return 'Earlier';
    var now = new Date();
    var date = new Date(timestampMs);
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var diffDays = Math.round((today - msgDay) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 7) return 'This Week';
    return 'Earlier';
  }

  function _renderCallHistory() {
    var container = _$('call-history-list');
    if (!container) return;
    var calls = _filterCalls().slice().sort(function (a, b) {
      var tsA = _formatTimestamp(a.startedAt || a.createdAt || a.endedAt) || 0;
      var tsB = _formatTimestamp(b.startedAt || b.createdAt || b.endedAt) || 0;
      return tsB - tsA;
    });

    if (!calls.length) {
      var emptyMsg = _searchQuery ? 'No calls found for "' + _esc(_searchQuery) + '"' : (_activeFilter !== 'all' ? 'No ' + _activeFilter + ' calls' : 'No calls yet');
      container.innerHTML = '<div class="flex flex-col items-center justify-center py-16 px-8">' +
        '<span class="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-3">call</span>' +
        '<p class="text-on-surface-variant text-sm text-center">' + _esc(emptyMsg) + '</p>' +
        '</div>';
      return;
    }

    // Date-group the calls
    var groups = {};
    var groupOrder = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    calls.forEach(function (c) {
      var ts = _formatTimestamp(c.startedAt || c.createdAt || c.endedAt);
      var group = _getCallDateGroup(ts);
      if (!groups[group]) groups[group] = [];
      groups[group].push(c);
    });

    var html = '';
    groupOrder.forEach(function (groupName) {
      if (!groups[groupName] || !groups[groupName].length) return;
      html += '<div class="px-4 pt-3 pb-1 text-xs font-semibold text-on-surface-variant/70 uppercase tracking-wider">' + _esc(groupName) + '</div>';
      html += groups[groupName].map(function (c) { return _renderCallHistoryItem(c); }).join('');
    });

    container.innerHTML = html;
    _bindCallHistoryEvents();
  }

  function _bindCallHistoryEvents() {
    var entries = document.querySelectorAll('[data-call-entry]');
    entries.forEach(function (entry) {
      if (entry.dataset.bound) return;
      entry.dataset.bound = '1';
      var callId = entry.getAttribute('data-call-entry');

      entry.addEventListener('touchstart', function (_e) {
        if (_selectionMode) return;
        _longPressTimer = setTimeout(function () {
          _longPressTimer = null;
          _enterSelectionMode(callId);
        }, 600);
      }, { passive: true });

      entry.addEventListener('touchend', function () {
        if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
      });

      entry.addEventListener('touchmove', function () {
        if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
      });

      entry.addEventListener('mousedown', function (e) {
        if (e.button !== 0 || _selectionMode) return;
        _longPressTimer = setTimeout(function () {
          _longPressTimer = null;
          _enterSelectionMode(callId);
        }, 600);
      });

      entry.addEventListener('mouseup', function () {
        if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
      });

      entry.addEventListener('mouseleave', function () {
        if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
      });

      entry.addEventListener('click', function (e) {
        if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
        if (_selectionMode) {
          e.stopPropagation();
          _toggleSelection(callId);
          return;
        }
        if (e.target.closest('[data-call-info]')) {
          e.stopPropagation();
          _showCallDetail(callId);
          return;
        }
        if (e.target.closest('[data-call-callback]')) {
          e.stopPropagation();
          var cbCall = _allCalls.find(function (c) { return c.id === callId; });
          _callBackForCall(cbCall);
          return;
        }
        var call = _allCalls.find(function (c) { return c.id === callId; });
        _openChatForCall(call);
      });

      entry.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var call = _allCalls.find(function (c) { return c.id === callId; });
          _openChatForCall(call);
        }
      });
    });
  }

  function _enterSelectionMode(callId) {
    _selectionMode = true;
    window.callHistorySelectionMode = true;
    _selectedIds.clear();
    if (callId) _selectedIds.add(callId);
    _renderSelectionToolbar();
    _renderCallHistory();
  }

  function _exitSelectionMode() {
    _selectionMode = false;
    window.callHistorySelectionMode = false;
    _selectedIds.clear();
    _hideSelectionToolbar();
    _renderCallHistory();
  }

  function _toggleSelection(callId) {
    if (_selectedIds.has(callId)) {
      _selectedIds.delete(callId);
    } else {
      _selectedIds.add(callId);
    }
    if (_selectedIds.size === 0) {
      _exitSelectionMode();
      return;
    }
    _renderSelectionToolbar();
    _renderCallHistory();
  }

  function _renderSelectionToolbar() {
    var toolbar = _$('call-history-toolbar');
    if (!toolbar) {
      var cs = _$('calls-section') || _$('calls-tab') || _$('_te_calls_panel');
      if (!cs) return;
      toolbar = document.createElement('div');
      toolbar.id = 'call-history-toolbar';
      toolbar.className = 'hidden';
      cs.prepend(toolbar);
    }
    var count = _selectedIds.size;
    toolbar.innerHTML = '<div class="flex items-center gap-3 px-4 py-3 bg-surface border-b border-outline/10">' +
      '<button class="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-surface-variant/50" onclick="window._exitCallHistorySelection()">' +
      '<span class="material-symbols-outlined text-on-surface">close</span></button>' +
      '<span class="text-on-surface font-medium text-sm">' + count + ' selected</span>' +
      '<div class="flex-1"></div>' +
      '<button class="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-red-500/10 transition-colors" onclick="window.deleteSelectedCallHistory()">' +
      '<span class="material-symbols-outlined text-red-500" style="font-size:20px">delete</span></button>' +
      '</div>';
    toolbar.classList.remove('hidden');
  }

  function _hideSelectionToolbar() {
    var toolbar = _$('call-history-toolbar');
    if (toolbar) toolbar.classList.add('hidden');
  }

  function _showCallDetail(callId) {
    var call = _allCalls.find(function (c) { return c.id === callId; });
    if (!call) return;
    var info = _getCallInfo(call);
    var name = info.name;
    var avatar = info.avatar;
    var direction = _getDirection(call);
    var missed = _isMissedCall(call);
    var ts = _formatTimestamp(call.startedAt || call.createdAt || call.endedAt);
    var dateStr = _formatCallDate(ts);
    var timeStr = _formatCallTime(ts);
    var duration = _getCallDuration(call.durationMs);
    var typeLabel = ((call.callType === 'video' ? 'Video' : 'Voice')) + ' Call';
    if (info.isGroup) typeLabel = 'Group ' + typeLabel;
    var dirLabel = direction === 'incoming' ? 'Incoming' : 'Outgoing';
    var statusLabel = missed ? 'Missed' : (call.status === 'ended' ? 'Ended' : _getStatusLabel(call, info, direction, false));
    var statusColor = missed ? 'text-red-500' : 'text-green-500';
    var participantCount = info.isGroup ? (info.participants || []).length : 0;

    if (_detailOverlay) _detailOverlay.remove();
    var html = '<div id="gc-detail-overlay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">' +
      '<div class="bg-surface rounded-2xl max-w-sm w-full mx-4 shadow-2xl overflow-hidden" style="max-height:calc(100dvh - 2rem);max-height:calc(100vh - 2rem);overflow-y:auto;overflow-x:hidden">' +
      '<div class="p-6 text-center border-b border-outline/10">' +
      '<div class="w-16 h-16 rounded-full overflow-hidden mx-auto mb-3">' + _renderAvatar(name, avatar) + '</div>' +
      '<h3 class="text-on-surface font-bold text-lg">' + _esc(name) + '</h3>' +
      '<p class="text-on-surface-variant text-sm mt-1">' + _esc(typeLabel) + '</p>' +
      '</div>' +
      '<div class="p-4 space-y-3">' +
      '<div class="flex justify-between items-center py-2 border-b border-outline/10">' +
      '<span class="text-on-surface-variant text-sm">Status</span>' +
      '<span class="text-sm font-medium ' + statusColor + '">' + _esc(statusLabel) + '</span>' +
      '</div>' +
      '<div class="flex justify-between items-center py-2 border-b border-outline/10">' +
      '<span class="text-on-surface-variant text-sm">Direction</span>' +
      '<span class="text-on-surface text-sm">' + _esc(dirLabel) + '</span>' +
      '</div>' +
      (info.isGroup && participantCount ? '<div class="flex justify-between items-center py-2 border-b border-outline/10">' +
      '<span class="text-on-surface-variant text-sm">Participants</span>' +
      '<span class="text-on-surface text-sm">' + participantCount + '</span>' +
      '</div>' : '') +
      '<div class="flex justify-between items-center py-2 border-b border-outline/10">' +
      '<span class="text-on-surface-variant text-sm">Date</span>' +
      '<span class="text-on-surface text-sm">' + _esc(dateStr) + '</span>' +
      '</div>' +
      '<div class="flex justify-between items-center py-2 border-b border-outline/10">' +
      '<span class="text-on-surface-variant text-sm">Time</span>' +
      '<span class="text-on-surface text-sm">' + _esc(timeStr) + '</span>' +
      '</div>' +
      (duration ? '<div class="flex justify-between items-center py-2 border-b border-outline/10">' +
      '<span class="text-on-surface-variant text-sm">Duration</span>' +
      '<span class="text-on-surface text-sm">' + _esc(duration) + '</span>' +
      '</div>' : '') +
      '<div class="flex justify-between items-center py-2">' +
      '<span class="text-on-surface-variant text-sm">Quality</span>' +
      '<span class="text-on-surface text-sm">HD</span>' +
      '</div>' +
      '</div>' +
      '<div class="flex gap-3 p-4 pt-2">' +
      '<button class="flex-1 py-2.5 bg-surface-variant/50 text-on-surface rounded-xl font-medium text-sm hover:bg-surface-variant transition-colors" onclick="document.getElementById(\'gc-detail-overlay\').remove()">Close</button>' +
      (typeof _openChatForCall === 'function' ? '<button class="flex-1 py-2.5 bg-surface-variant/50 text-on-surface rounded-xl font-medium text-sm hover:bg-surface-variant transition-colors" onclick="document.getElementById(\'gc-detail-overlay\').remove();window._openCallHistoryChat(\'' + _esc(call.id) + '\')">Open Chat</button>' : '') +
      '<button class="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-medium text-sm hover:bg-green-600 transition-colors" onclick="document.getElementById(\'gc-detail-overlay\').remove();window._callBackCallHistory(\'' + _esc(call.id) + '\')">Call Back</button>' +
      '</div>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    _detailOverlay = _$('gc-detail-overlay');
  }

  /* Expose detail actions for the inline onclick handlers */
  window._openCallHistoryChat = function (callId) {
    var call = _allCalls.find(function (c) { return c.id === callId; });
    _openChatForCall(call);
  };
  window._callBackCallHistory = function (callId) {
    var call = _allCalls.find(function (c) { return c.id === callId; });
    _callBackForCall(call);
  };

  /* ── Header: WhatsApp-style search + All/Missed chips ────────── */
  function _ensureHeader() {
    var root = _$('call-history-root');
    if (!root) {
      var panel = _$('_te_calls_panel');
      if (!panel) return false;
      root = document.createElement('div');
      root.id = 'call-history-root';
      root.style.cssText = 'display:flex;flex-direction:column;height:100%;';
      panel.innerHTML = '';
      panel.appendChild(root);
    }

    if (!_$('call-history-header')) {
      var header = document.createElement('div');
      header.id = 'call-history-header';
      header.innerHTML =
        '<div class="px-3 pt-2 pb-1 flex gap-1 overflow-x-auto select-none wa-chips-scroll">' +
          '<button class="wa-chip active" data-call-filter="all" aria-pressed="true">All</button>' +
          '<button class="wa-chip" data-call-filter="missed" aria-pressed="false">Missed</button>' +
          '<button class="wa-chip" data-call-filter="incoming" aria-pressed="false">Incoming</button>' +
          '<button class="wa-chip" data-call-filter="outgoing" aria-pressed="false">Outgoing</button>' +
        '</div>' +
        '<div class="relative px-4 mb-1">' +
          '<span class="material-symbols-outlined absolute left-7 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none" style="font-size:20px">search</span>' +
          '<input id="call-history-search" class="w-full bg-surface-container border-none rounded-xl py-2 pl-11 pr-9 text-on-surface focus:ring-1 focus:ring-primary font-body-md placeholder-on-surface-variant/50" placeholder="Search calls..." type="text" autocomplete="off" aria-label="Search calls"/>' +
          '<span class="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-on-surface-variant cursor-pointer hover:text-primary hidden" id="call-history-search-clear" style="font-size:18px" title="Clear search" aria-label="Clear search">close</span>' +
        '</div>';
      root.appendChild(header);

      var searchInput = _$('call-history-search');
      var clearBtn = _$('call-history-search-clear');
      if (searchInput) {
        var debounce = null;
        searchInput.addEventListener('input', function () {
          var val = searchInput.value;
          if (clearBtn) clearBtn.classList.toggle('hidden', !val);
          clearTimeout(debounce);
          debounce = setTimeout(function () { window.searchCalls(val); }, 200);
        });
        if (clearBtn) clearBtn.addEventListener('click', function () {
          searchInput.value = '';
          clearBtn.classList.add('hidden');
          window.searchCalls('');
          searchInput.focus();
        });
      }
    }

    if (!_$('call-history-list')) {
      var list = document.createElement('div');
      list.id = 'call-history-list';
      list.className = 'flex-1 overflow-y-auto custom-scrollbar p-1';
      root.appendChild(list);
    }
    _updateFilterChips();
    return true;
  }

  function _setAllCalls(calls) {
    var myUid = _uid();
    var ids = [];
    (calls || []).forEach(function (c) {
      if (window.callPeerIdsToCheck) window.callPeerIdsToCheck(c, myUid).forEach(function (id) { if (id) ids.push(id); });
    });
    var apply = function () {
      _allCalls = (calls || []).filter(function (c) {
        return window.callIsEligible ? window.callIsEligible(c, myUid) : true;
      });
      _renderCallHistory();
    };
    if (!window.verifyUsers || !ids.length) { apply(); return; }
    window.verifyUsers(Array.from(new Set(ids))).then(apply, apply);
  }

  function _loadFromFirestore() {
    var myUid = _uid();
    if (!myUid || !_db()) return;
    if (_listenerActive) return;
    _loadToken++;
    var token = _loadToken;

    _db().collection('users').doc(myUid).collection('callEvents')
      .orderBy('startedAt', 'desc')
      .limit(150)
      .get().then(function (snap) {
        if (token !== _loadToken) return;
        var calls = snap.docs.map(function (doc) {
          return { id: doc.id, ...doc.data() };
        });
        _setAllCalls(calls);
        _listenerActive = true;
        _setupFirestoreListener();
      }).catch(function (err) {
        if (window.__DEBUG__) console.warn('[CallHistory] Firestore load error:', err);
        var cached = [];
        try {
          var raw = localStorage.getItem('tcCallHistory');
          if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed.calls)) cached = parsed.calls;
          }
        } catch (_) {}
        if (cached.length) {
          _setAllCalls(cached);
        }
      });
  }

  function _setupFirestoreListener() {
    var myUid = _uid();
    if (!myUid || !_db()) return;
    if (window.outgoingCallsListUnsubscribe) {
      try { window.outgoingCallsListUnsubscribe(); } catch (_) {}
    }
    if (window.incomingCallsListUnsubscribe) {
      try { window.incomingCallsListUnsubscribe(); } catch (_) {}
    }
    window.outgoingCallsListUnsubscribe = _db().collection('users').doc(myUid).collection('callEvents')
      .orderBy('startedAt', 'desc')
      .limit(150)
      .onSnapshot(function (snap) {
        var calls = snap.docs.map(function (doc) {
          return { id: doc.id, ...doc.data() };
        });
        _setAllCalls(calls);
      }, function (err) {
        if (window.__DEBUG__) console.warn('[CallHistory] Listener error:', err);
      });
  }

  function loadCallHistory() {
    if (!_ensureHeader()) return;
    _loadFromFirestore();
  }

  function searchCalls(query) {
    _searchQuery = query || '';
    _filterCalls();
    _renderCallHistory();
  }

  function filterCalls(filter) {
    _activeFilter = filter || 'all';
    callHistoryFilter = _activeFilter;
    _updateFilterChips();
    _filterCalls();
    _renderCallHistory();
  }

  function _updateFilterChips() {
    var chips = document.querySelectorAll('[data-call-filter]');
    chips.forEach(function (chip) {
      var f = chip.getAttribute('data-call-filter');
      var on = f === _activeFilter;
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function deleteCallHistory(callId) {
    if (!callId) return;
    var myUid = _uid();
    if (!myUid || !_db()) return;
    _db().collection('users').doc(myUid).collection('callEvents').doc(callId).delete()
      .then(function () {
        _allCalls = _allCalls.filter(function (c) { return c.id !== callId; });
        _renderCallHistory();
        _toast('Call deleted', 'info');
      }).catch(function (err) {
        _toast('Failed to delete: ' + err.message, 'error');
      });
  }

  function deleteSelectedCallHistory() {
    if (_selectedIds.size === 0) return;
    var myUid = _uid();
    if (!myUid || !_db()) return;
    var ids = Array.from(_selectedIds);
    var batch = _db().batch();
    ids.forEach(function (callId) {
      var ref = _db().collection('users').doc(myUid).collection('callEvents').doc(callId);
      batch.delete(ref);
    });
    batch.commit().then(function () {
      _allCalls = _allCalls.filter(function (c) { return ids.indexOf(c.id) === -1; });
      _exitSelectionMode();
      _renderCallHistory();
      _toast(ids.length + ' call' + (ids.length > 1 ? 's' : '') + ' deleted', 'info');
    }).catch(function (err) {
      _toast('Failed to delete: ' + err.message, 'error');
    });
  }

  async function callContact(uid, type) {
    if (!uid) return;
    if (typeof window.startVoiceCall === 'function' && type === 'voice') {
      var usersSnap = await _db().collection('users').doc(uid).get().catch(function () { return null; });
      if (usersSnap && usersSnap.exists) {
        var userData = usersSnap.data();
        var name = userData.displayName || userData.email || 'Unknown';
        if (typeof window.selectCallContact === 'function') {
          window.selectCallContact(uid, name, userData.photoURL || '');
        } else {
          window.startVoiceCall();
        }
        return;
      }
    }
    if (type === 'video' && typeof window.startVideoCall === 'function') {
      usersSnap = await _db().collection('users').doc(uid).get().catch(function () { return null; });
      if (usersSnap && usersSnap.exists) {
        userData = usersSnap.data();
        name = userData.displayName || userData.email || 'Unknown';
        if (typeof window.selectCallContact === 'function') {
          window.selectCallContact(uid, name, userData.photoURL || '', 'video');
        } else {
          window.startVideoCall();
        }
        return;
      }
    }
    if (typeof window.startVoiceCall === 'function') window.startVoiceCall();
  }

  function renderCallHistoryItem(call) {
    return _renderCallHistoryItem(call);
  }

  function _init() {
    document.addEventListener('tc:call-history:sync', function (e) {
      var calls = e.detail && e.detail.calls;
      if (Array.isArray(calls) && calls.length) {
        _setAllCalls(calls);
      }
    });

    document.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-call-filter]');
      if (chip) {
        window.filterCalls(chip.getAttribute('data-call-filter'));
      }
    });

    callHistoryFilter = callHistoryFilter || 'all';
    _activeFilter = callHistoryFilter;
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(_init, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(_init, 0); });
  }

  window.loadCallHistory = loadCallHistory;
  window.searchCalls = searchCalls;
  window.filterCalls = filterCalls;
  window.deleteCallHistory = deleteCallHistory;
  window.deleteSelectedCallHistory = deleteSelectedCallHistory;
  window.callContact = callContact;
  window.renderCallHistoryItem = renderCallHistoryItem;
  window.getCallDuration = _getCallDuration;
  window._exitCallHistorySelection = _exitSelectionMode;
  window._enterCallHistorySelection = function () { _enterSelectionMode(null); };
  window._toggleCallSelection = _toggleSelection;
})();
