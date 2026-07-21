'use strict';
(function () {
  var _loadToken = 0;
  var _allCalls = [];
  var _filteredCalls = [];
  var _searchQuery = '';
  var _activeFilter = 'all';
  var _selectionMode = false;
  var _selectedIds = new Set();
  var _longPressTimer = null;
  var _detailOverlay = null;
  var _dateGroups = {};

  var _db = function() { return App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };
  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };
  function _me() { return (window.App && window.App.currentUser) ? window.App.currentUser : null; }
  function _$(id) { return document.getElementById(id); }
  function _txt(id, v) { var e = _$(id); if (e) e.textContent = v; }
  function _show(id) { var e = _$(id); if (e) e.classList.remove('hidden'); }
  function _hide(id) { var e = _$(id); if (e) e.classList.add('hidden'); }
  function _toast(msg, t) { if (App && App.toast) App.toast(msg, t); else if (typeof window.showToast === 'function') window.showToast(msg, t); }
  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

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
    if (ts.seconds) {
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

  function _getDateGroup(timestampMs) {
    if (!timestampMs) return 'Older';
    var now = new Date();
    var date = new Date(timestampMs);
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var yesterday = new Date(today.getTime() - 86400000);
    var weekStart = new Date(today.getTime() - (today.getDay() * 86400000));
    var lastWeekStart = new Date(weekStart.getTime() - 7 * 86400000);
    var dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (dateDay.getTime() === today.getTime()) return 'Today';
    if (dateDay.getTime() === yesterday.getTime()) return 'Yesterday';
    if (date >= weekStart) return 'This Week';
    if (date >= lastWeekStart) return 'Last Week';
    return 'Older';
  }

  function _formatDateGroup(group) {
    return group;
  }

  function _formatCallTime(timestampMs) {
    if (!timestampMs) return '';
    var date;
    if (typeof timestampMs === 'number') {
      date = new Date(timestampMs);
    } else if (timestampMs.seconds) {
      date = new Date(timestampMs.seconds * 1000);
    } else {
      return '';
    }
    var h = date.getHours();
    var m = date.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function _formatCallDate(timestampMs) {
    if (!timestampMs) return '';
    var date;
    if (typeof timestampMs === 'number') {
      date = new Date(timestampMs);
    } else if (timestampMs.seconds) {
      date = new Date(timestampMs.seconds * 1000);
    } else {
      return '';
    }
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
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

  function _isMissedCall(call) {
    if (call.groupCall) return false;
    return call.status === 'missed' || call.status === 'rejected' || call.status === 'cancelled';
  }

  function _getDirection(call) {
    var myUid = _uid();
    if (call.groupCall) {
      if (call.fromUserId === myUid) return 'outgoing';
      return 'incoming';
    }
    if (call.fromUserId === myUid) return 'outgoing';
    return 'incoming';
  }

  function _getDirectionIcon(direction, status) {
    if (status === 'missed' || status === 'rejected' || status === 'cancelled') {
      return '<span class="material-symbols-outlined text-red-500" style="font-size:16px">call_missed</span>';
    }
    if (direction === 'incoming') {
      return '<span class="material-symbols-outlined text-green-400" style="font-size:16px">call_received</span>';
    }
    return '<span class="material-symbols-outlined text-green-400" style="font-size:16px">call_made</span>';
  }

  function _getCallTypeIcon(callType) {
    if (callType === 'video') {
      return '<span class="material-symbols-outlined" style="font-size:18px">videocam</span>';
    }
    return '<span class="material-symbols-outlined" style="font-size:18px">call</span>';
  }

  function _getCallCountToday(calls, contactUid) {
    var today = new Date();
    var todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return calls.filter(function (c) {
      var ts = _formatTimestamp(c.startedAt || c.createdAt);
      var cUid = _getContactUid(c);
      return cUid === contactUid && ts >= todayStart;
    }).length;
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
      calls = calls.filter(function (c) { return _getDirection(c) === 'incoming' && !_isMissedCall(c); });
    } else if (filter === 'outgoing') {
      calls = calls.filter(function (c) { return _getDirection(c) === 'outgoing'; });
    }

    if (query) {
      calls = calls.filter(function (c) {
        var name = _getContactName(c).toLowerCase();
        var phone = (c.fromUserPhone || c.toUserPhone || '').toLowerCase();
        return name.indexOf(query) !== -1 || phone.indexOf(query) !== -1;
      });
    }

    _filteredCalls = calls;
    return calls;
  }

  function _groupByDate(calls) {
    var groups = {};
    var groupOrder = ['Today', 'Yesterday', 'This Week', 'Last Week', 'Older'];
    groupOrder.forEach(function (g) { groups[g] = []; });
    calls.forEach(function (c) {
      var ts = _formatTimestamp(c.startedAt || c.createdAt);
      var group = _getDateGroup(ts);
      if (!groups[group]) groups[group] = [];
      groups[group].push(c);
    });
    groupOrder.forEach(function (g) {
      groups[g].sort(function (a, b) {
        var tsA = _formatTimestamp(a.startedAt || a.createdAt) || 0;
        var tsB = _formatTimestamp(b.startedAt || b.createdAt) || 0;
        return tsB - tsA;
      });
    });
    _dateGroups = groups;
    return groups;
  }

  function _renderCallHistoryItem(call) {
    var myUid = _uid();
    var name = _getContactName(call);
    var contactUid = _getContactUid(call);
    var avatar = _getContactAvatar(call);
    var direction = _getDirection(call);
    var missed = _isMissedCall(call);
    var durationMs = call.durationMs;
    var duration = _getCallDuration(durationMs);
    var ts = _formatTimestamp(call.startedAt || call.createdAt);
    var timeStr = _formatCallTime(ts);
    var typeIcon = _getCallTypeIcon(call.callType || call.type);
    var dirIcon = _getDirectionIcon(direction, call.status);
    var nameColor = missed ? 'text-red-500' : 'text-on-surface';
    var count = _getCallCountToday(_allCalls, contactUid);
    var badge = count > 1 ? '<span class="ml-1 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">' + count + '</span>' : '';
    var isSelected = _selectedIds.has(call.id);
    var selectedCheck = isSelected ? '<div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-white" style="font-size:14px">check</span></div>' : '<div class="w-5 h-5 rounded-full border-2 border-outline/40 flex-shrink-0"></div>';
    var selectionClass = _selectionMode ? 'pl-2' : '';
    var missedLabel = missed ? '<span class="text-red-500 text-xs font-medium">Missed</span>' : '';
    var durationLabel = duration ? '<span class="text-on-surface-variant text-xs">' + _esc(duration) + '</span>' : '';
    var timeLabel = '<span class="text-on-surface-variant text-xs">' + _esc(timeStr) + '</span>';
    var infoBtn = '<button class="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-variant/50 transition-colors flex-shrink-0" data-call-info="' + _esc(call.id) + '"><span class="material-symbols-outlined text-on-surface-variant" style="font-size:16px">info</span></button>';
    var callBtn = '<button class="w-7 h-7 rounded-full flex items-center justify-center hover:bg-green-500/10 transition-colors flex-shrink-0" data-call-callback="' + _esc(contactUid) + '" data-call-type="' + _esc(call.callType || 'voice') + '"><span class="material-symbols-outlined text-green-500" style="font-size:16px">call</span></button>';

    return '<div class="flex items-center gap-3 px-4 py-3 hover:bg-surface-variant/30 rounded-xl cursor-pointer transition-colors group ' + selectionClass + '" data-call-entry="' + _esc(call.id) + '" data-contact-uid="' + _esc(contactUid) + '">' +
      (_selectionMode ? selectedCheck : '') +
      '<div class="relative flex-shrink-0">' +
      '<div class="w-11 h-11 rounded-full overflow-hidden">' + _renderAvatar(name, avatar) + '</div>' +
      '</div>' +
      '<div class="flex-1 min-w-0">' +
      '<div class="flex items-center gap-1.5">' +
      dirIcon +
      '<span class="font-semibold text-sm ' + nameColor + ' truncate">' + _esc(name) + '</span>' +
      badge +
      '</div>' +
      '<div class="flex items-center gap-2 mt-0.5">' +
      missedLabel +
      (!missed ? durationLabel : '') +
      (!missed ? timeLabel : (missed ? timeLabel : '')) +
      '</div>' +
      '</div>' +
      '<div class="flex items-center gap-1 flex-shrink-0">' +
      '<span class="text-on-surface-variant">' + typeIcon + '</span>' +
      (!_selectionMode ? infoBtn : '') +
      (!_selectionMode ? callBtn : '') +
      '</div>' +
      '</div>';
  }

  function _renderCallHistory() {
    var container = _$('call-history-list');
    if (!container) return;
    var calls = _filterCalls();
    var groups = _groupByDate(calls);
    var totalHtml = '';
    var groupOrder = ['Today', 'Yesterday', 'This Week', 'Last Week', 'Older'];
    var hasAny = false;
    groupOrder.forEach(function (g) {
      var groupCalls = groups[g];
      if (!groupCalls || groupCalls.length === 0) return;
      hasAny = true;
      totalHtml += '<div class="mb-2">' +
        '<div class="px-4 py-1.5">' +
        '<span class="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">' + _esc(_formatDateGroup(g)) + '</span>' +
        '</div>' +
        groupCalls.map(function (c) { return _renderCallHistoryItem(c); }).join('') +
        '</div>';
    });

    if (!hasAny) {
      var emptyMsg = _searchQuery ? 'No calls found for "' + _esc(_searchQuery) + '"' : (_activeFilter !== 'all' ? 'No ' + _activeFilter + ' calls' : 'No call history yet');
      totalHtml = '<div class="flex flex-col items-center justify-center py-16 px-8">' +
        '<span class="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-3">call</span>' +
        '<p class="text-on-surface-variant text-sm text-center">' + _esc(emptyMsg) + '</p>' +
        '</div>';
    }

    container.innerHTML = totalHtml;
    _bindCallHistoryEvents();
  }

  function _bindCallHistoryEvents() {
    var entries = document.querySelectorAll('[data-call-entry]');
    entries.forEach(function (entry) {
      if (entry.dataset.bound) return;
      entry.dataset.bound = '1';
      var callId = entry.getAttribute('data-call-entry');
      var contactUid = entry.getAttribute('data-contact-uid');

      entry.addEventListener('touchstart', function (e) {
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
          var type = e.target.closest('[data-call-callback]').getAttribute('data-call-type') || 'voice';
          window.callContact(contactUid, type);
          return;
        }
        if (!_selectionMode) {
          var call = _allCalls.find(function (c) { return c.id === callId; });
          if (call) {
            var type = call.callType || 'voice';
            window.callContact(contactUid, type);
          }
        }
      });
    });

    var infoBtns = document.querySelectorAll('[data-call-info]');
    infoBtns.forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var callId = btn.getAttribute('data-call-info');
        _showCallDetail(callId);
      });
    });

    var callbackBtns = document.querySelectorAll('[data-call-callback]');
    callbackBtns.forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var uid = btn.getAttribute('data-call-callback');
        var type = btn.getAttribute('data-call-type') || 'voice';
        window.callContact(uid, type);
      });
    });
  }

  function _enterSelectionMode(callId) {
    _selectionMode = true;
    callHistorySelectionMode = true;
    _selectedIds.clear();
    if (callId) _selectedIds.add(callId);
    _renderSelectionToolbar();
    _renderCallHistory();
  }

  function _exitSelectionMode() {
    _selectionMode = false;
    callHistorySelectionMode = false;
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
      var cs = _$('calls-section') || _$('calls-tab');
      if (!cs) return;
      toolbar = document.createElement('div');
      toolbar.id = 'call-history-toolbar';
      toolbar.className = 'hidden';
      cs.prepend(toolbar);
    }
    var count = _selectedIds.size;
    toolbar.innerHTML = '<div class="flex items-center gap-3 px-4 py-3 bg-surface border-b border-outline/10">' +
      '<button class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-variant/50" onclick="window._exitCallHistorySelection()">' +
      '<span class="material-symbols-outlined text-on-surface">close</span></button>' +
      '<span class="text-on-surface font-medium text-sm">' + count + ' selected</span>' +
      '<div class="flex-1"></div>' +
      '<button class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/10 transition-colors" onclick="window.deleteSelectedCallHistory()">' +
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
    var name = _getContactName(call);
    var avatar = _getContactAvatar(call);
    var direction = _getDirection(call);
    var missed = _isMissedCall(call);
    var ts = _formatTimestamp(call.startedAt || call.createdAt);
    var dateStr = _formatCallDate(ts);
    var timeStr = _formatCallTime(ts);
    var duration = _getCallDuration(call.durationMs);
    var typeLabel = (call.callType === 'video' ? 'Video' : 'Voice') + ' Call';
    var dirLabel = direction === 'incoming' ? 'Incoming' : 'Outgoing';
    var statusLabel = missed ? 'Missed' : (call.status || 'Ended');
    var statusColor = missed ? 'text-red-500' : 'text-green-500';

    if (_detailOverlay) _detailOverlay.remove();
    var html = '<div id="gc-detail-overlay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">' +
      '<div class="bg-surface rounded-2xl max-w-sm w-full mx-4 shadow-2xl overflow-hidden">' +
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
      '<button class="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-medium text-sm hover:bg-green-600 transition-colors" onclick="document.getElementById(\'gc-detail-overlay\').remove();window.callContact(\'' + _esc(_getContactUid(call)) + '\',\'' + _esc(call.callType || 'voice') + '\')">Call Back</button>' +
      '</div>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    _detailOverlay = _$('gc-detail-overlay');
  }

  function _loadFromFirestore() {
    var myUid = _uid();
    if (!myUid || !_db()) return;
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
        _allCalls = calls;
        callHistoryLoadToken = _loadToken;
        _renderCallHistory();
        _setupFirestoreListener();
      }).catch(function (err) {
        console.warn('[CallHistory] Firestore load error:', err);
        var cached = [];
        try {
          var raw = localStorage.getItem('tcCallHistory');
          if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed.calls)) cached = parsed.calls;
          }
        } catch (_) {}
        if (cached.length) {
          _allCalls = cached;
          _renderCallHistory();
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
        _allCalls = calls;
        _renderCallHistory();
      }, function (err) {
        console.warn('[CallHistory] Listener error:', err);
      });
  }

  function loadCallHistory() {
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
      if (f === _activeFilter) {
        chip.classList.add('bg-primary', 'text-white');
        chip.classList.remove('bg-surface-variant/50', 'text-on-surface-variant');
      } else {
        chip.classList.remove('bg-primary', 'text-white');
        chip.classList.add('bg-surface-variant/50', 'text-on-surface-variant');
      }
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
        var c = { uid: uid, name: name, initials: (name[0] || '?').toUpperCase(), type: 'direct', photoURL: userData.photoURL || '' };
        if (typeof window.selectCallContact === 'function') {
          window.selectCallContact(uid, name, userData.photoURL || '');
        } else {
          window.startVoiceCall();
        }
        return;
      }
    }
    if (type === 'video' && typeof window.startVideoCall === 'function') {
      var usersSnap = await _db().collection('users').doc(uid).get().catch(function () { return null; });
      if (usersSnap && usersSnap.exists) {
        var userData = usersSnap.data();
        var name = userData.displayName || userData.email || 'Unknown';
        if (typeof window.selectCallContact === 'function') {
          window.selectCallContact(uid, name, userData.photoURL || '');
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
        _allCalls = calls;
        _renderCallHistory();
      }
    });

    document.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-call-filter]');
      if (chip) {
        var f = chip.getAttribute('data-call-filter');
        window.filterCalls(f);
      }
    });

    var searchInput = _$('call-history-search');
    if (searchInput) {
      var debounce = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(debounce);
        var val = searchInput.value;
        debounce = setTimeout(function () {
          window.searchCalls(val);
        }, 200);
      });
    }

    callHistoryFilter = callHistoryFilter || 'all';
    _activeFilter = callHistoryFilter;
    _updateFilterChips();
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
})();
