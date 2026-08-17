(function () {
  'use strict';

  var STATUS_DURATION_MS = 24 * 60 * 60 * 1000;
  var _statusCache = new Map();
  var _userStatusMap = new Map();
  var _seenSet = new Set();
  var _mutedUsers = new Set();
  var _privacySetting = { mode: 'everyone', exceptUids: [], shareWithUids: [] };
  var _loadAttempted = false;
  var MAX_SEEN_SIZE = 500;

  var _db = function() { return App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };
  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };
  function _userName() {
    var u = (window.App && window.App.auth && window.App.auth.currentUser) ? window.App.auth.currentUser : window.currentUser;
    return u ? (u.displayName || 'Me') : 'Me';
  }
  function _userPhoto() {
    var u = (window.App && window.App.auth && window.App.auth.currentUser) ? window.App.auth.currentUser : window.currentUser;
    return u ? (u.photoURL || '') : '';
  }
  function _toast(msg, t) { if (App && App.toast) App.toast(msg, t); else if (typeof window.showToast === 'function') window.showToast(msg, t); }
  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };
  function _now() { return Date.now(); }
  function _expiresAt() { return _now() + STATUS_DURATION_MS; }
  function _isExpired(s) { return s && s.expiresAt && s.expiresAt < _now(); }

  function _getChatContacts() {
    var uid = _uid();
    var out = [];
    try {
      var State = (typeof window.getCurrentChatState === 'function') ? window.getCurrentChatState() : null;
      var chats = (State && Array.isArray(State.chats)) ? State.chats : (window.App && Array.isArray(window.App.chats) ? window.App.chats : []);
      chats.forEach(function (c) {
        if (!c || c.type !== 'direct') return;
        var other = c.otherUserId || c.uid;
        if (!other || other === uid) return;
        if (out.some(function (o) { return o.uid === other; })) return;
        out.push({
          uid: other,
          name: c.name || c.displayName || 'User',
          photoURL: c.photoURL || c.avatar || ''
        });
      });
    } catch (_) {}
    return out;
  }

  function _getContactUids() {
    return _getChatContacts().map(function (c) { return c.uid; });
  }

  async function _syncUserContacts() {
    var d = _db();
    var uid = _uid();
    if (!d || !uid) return;
    var contacts = {};
    _getContactUids().forEach(function (u) { contacts[u] = _now(); });
    try {
      await d.collection('userContacts').doc(uid).set({
        contacts: contacts,
        syncedAt: _now()
      }, { merge: true });
    } catch (e) {
      if (window.__DEBUG__) console.warn('[Status] Sync contacts error:', e);
    }
  }

  function _normalizePrivacy(p) {
    if (!p || typeof p === 'string') {
      var str = p || 'everyone';
      var mode = 'everyone';
      if (str === 'nobody') mode = 'only_share';
      else if (str === 'contacts' || str === 'everyone' || str === 'contacts_except' || str === 'only_share') mode = str;
      return { mode: mode, exceptUids: [], shareWithUids: [] };
    }
    var m = p.mode || 'everyone';
    if (m !== 'contacts_except' && m !== 'only_share' && m !== 'contacts' && m !== 'everyone') m = 'everyone';
    return {
      mode: m,
      exceptUids: Array.isArray(p.exceptUids) ? p.exceptUids.slice(0, 2000) : [],
      shareWithUids: Array.isArray(p.shareWithUids) ? p.shareWithUids.slice(0, 2000) : []
    };
  }

  function _privacyLabel(p) {
    var n = _normalizePrivacy(p);
    if (n.mode === 'contacts') return 'My Contacts';
    if (n.mode === 'contacts_except') return n.exceptUids.length ? 'My Contacts Except ' + n.exceptUids.length : 'My Contacts Except...';
    if (n.mode === 'only_share') return n.shareWithUids.length ? 'Only Share With ' + n.shareWithUids.length : 'Only Share With...';
    return 'Everyone';
  }

  function _computeVisibleTo() {
    var uid = _uid();
    var priv = _normalizePrivacy(_privacySetting);
    var mine = uid ? [uid] : [];
    var all, vis;
    if (priv.mode === 'everyone') {
      vis = ['*'].concat(mine);
    } else if (priv.mode === 'contacts') {
      all = mine.concat(_getContactUids());
      vis = all;
    } else if (priv.mode === 'contacts_except') {
      var excluded = priv.exceptUids || [];
      vis = mine.concat(_getContactUids().filter(function (c) { return excluded.indexOf(c) < 0; }));
    } else if (priv.mode === 'only_share') {
      vis = mine.concat((priv.shareWithUids || []).filter(function (c) { return c !== uid; }));
    } else {
      vis = ['*'].concat(mine);
    }
    var unique = Array.from(new Set(vis.filter(Boolean)));
    return { visibleTo: unique, privacyMode: priv.mode };
  }

  function _isVisibleToMe(s) {
    if (!s) return false;
    var uid = _uid();
    if (s.userId === uid) return true;
    if (!Array.isArray(s.visibleTo)) return false;
    return s.visibleTo.indexOf('*') >= 0 || (uid != null && s.visibleTo.indexOf(uid) >= 0);
  }

  function _trimSeenSet() {
    if (_seenSet.size <= MAX_SEEN_SIZE) return;
    var arr = Array.from(_seenSet);
    var excess = arr.length - MAX_SEEN_SIZE;
    for (var i = 0; i < excess; i++) {
      _seenSet.delete(arr[i]);
    }
  }

  function _sanitizeType(t) {
    if (t === 'text' || t === 'image' || t === 'video' || t === 'link') return t;
    return 'text';
  }

  function _storeStatus(doc) {
    var data = doc.data ? doc.data() : doc;
    data.id = doc.id || data.id;
    data._ref = doc.ref || null;
    if (_isExpired(data)) return null;
    _statusCache.set(data.id, data);
    var uid = data.userId;
    if (!_userStatusMap.has(uid)) _userStatusMap.set(uid, []);
    var arr = _userStatusMap.get(uid);
    var idx = arr.findIndex(function (s) { return s.id === data.id; });
    if (idx >= 0) arr[idx] = data; else arr.push(data);
    arr.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    return data;
  }

  function _removeStatus(statusId) {
    var data = _statusCache.get(statusId);
    _statusCache.delete(statusId);
    if (data) {
      var uid = data.userId;
      var arr = _userStatusMap.get(uid);
      if (arr) {
        var idx = arr.findIndex(function (s) { return s.id === statusId; });
        if (idx >= 0) arr.splice(idx, 1);
        if (arr.length === 0) _userStatusMap.delete(uid);
      }
    }
  }

  async function uploadStatusMedia(file) {
    if (!file) throw new Error('No file provided');
    if (typeof window.uploadToCloudinary === 'function') {
      return await window.uploadToCloudinary(file);
    }
    var _storage = window.storage || (window.firebase && window.firebase.storage && window.firebase.storage());
    if (!_storage) throw new Error('Storage not available');
    var user = _uid();
    if (!user) throw new Error('Not authenticated');
    var safe = (file.name || 'status').replace(/[^a-zA-Z0-9._-]/g, '_');
    var ext = safe.split('.').pop().toLowerCase();
    var isVid = file.type && file.type.startsWith('video');
    var folder = isVid ? 'status_videos' : 'status_images';
    var path = folder + '/' + user + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    var ref = _storage.ref(path);
    var task = ref.put(file);
    if (typeof window.showToast === 'function') {
      task.on('state_changed', function (snap) {
        var pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        window.showToast('Uploading\u2026 ' + pct + '%', 'info');
      });
    }
    await task;
    return await ref.getDownloadURL();
  }

  async function createTextStatus(text, bgColor) {
    if (!text || !text.trim()) { _toast('Please enter some text', 'error'); return null; }
    var d = _db();
    var uid = _uid();
    if (!d || !uid) { _toast('Not authenticated', 'error'); return null; }
    var visibility = _computeVisibleTo();
    var statusData = {
      userId: uid,
      type: 'text',
      content: text.trim(),
      caption: '',
      bgColor: bgColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      mediaUrl: '',
      createdAt: _now(),
      expiresAt: _expiresAt(),
      seenBy: [],
      replies: [],
      visibleTo: visibility.visibleTo,
      privacyMode: visibility.privacyMode
    };
    try {
      await _syncUserContacts();
      var ref = await d.collection('statuses').add(statusData);
      statusData.id = ref.id;
      _storeStatus(statusData);
      _toast('Status posted!', 'success');
      renderStatusRow();
      return statusData;
    } catch (e) {
      if (window.__DEBUG__) console.error('[Status] Create text error:', e);
      _toast('Failed to post status', 'error');
      return null;
    }
  }

  async function createImageStatus(imageUrl, caption) {
    if (!imageUrl) { _toast('No image provided', 'error'); return null; }
    var d = _db();
    var uid = _uid();
    if (!d || !uid) { _toast('Not authenticated', 'error'); return null; }
    var visibility = _computeVisibleTo();
    var statusData = {
      userId: uid,
      type: 'image',
      content: imageUrl,
      caption: caption || '',
      bgColor: '',
      mediaUrl: imageUrl,
      createdAt: _now(),
      expiresAt: _expiresAt(),
      seenBy: [],
      replies: [],
      visibleTo: visibility.visibleTo,
      privacyMode: visibility.privacyMode
    };
    try {
      await _syncUserContacts();
      var ref = await d.collection('statuses').add(statusData);
      statusData.id = ref.id;
      _storeStatus(statusData);
      _toast('Status posted!', 'success');
      renderStatusRow();
      return statusData;
    } catch (e) {
      if (window.__DEBUG__) console.error('[Status] Create image error:', e);
      _toast('Failed to post status', 'error');
      return null;
    }
  }

  async function createVideoStatus(videoUrl, caption) {
    if (!videoUrl) { _toast('No video provided', 'error'); return null; }
    var d = _db();
    var uid = _uid();
    if (!d || !uid) { _toast('Not authenticated', 'error'); return null; }
    var visibility = _computeVisibleTo();
    var statusData = {
      userId: uid,
      type: 'video',
      content: videoUrl,
      caption: caption || '',
      bgColor: '',
      mediaUrl: videoUrl,
      createdAt: _now(),
      expiresAt: _expiresAt(),
      seenBy: [],
      replies: [],
      visibleTo: visibility.visibleTo,
      privacyMode: visibility.privacyMode
    };
    try {
      await _syncUserContacts();
      var ref = await d.collection('statuses').add(statusData);
      statusData.id = ref.id;
      _storeStatus(statusData);
      _toast('Status posted!', 'success');
      renderStatusRow();
      return statusData;
    } catch (e) {
      if (window.__DEBUG__) console.error('[Status] Create video error:', e);
      _toast('Failed to post status', 'error');
      return null;
    }
  }

  async function createLinkStatus(link, caption) {
    var url = (link || '').trim();
    if (!url) { _toast('Enter a link', 'error'); return null; }
    if (!/^(https?:\/\/)/i.test(url)) url = 'https://' + url;
    var d = _db();
    var uid = _uid();
    if (!d || !uid) { _toast('Not authenticated', 'error'); return null; }
    var visibility = _computeVisibleTo();
    var statusData = {
      userId: uid,
      type: 'link',
      content: url,
      caption: caption || '',
      bgColor: '',
      mediaUrl: '',
      createdAt: _now(),
      expiresAt: _expiresAt(),
      seenBy: [],
      replies: [],
      visibleTo: visibility.visibleTo,
      privacyMode: visibility.privacyMode
    };
    try {
      await _syncUserContacts();
      var ref = await d.collection('statuses').add(statusData);
      statusData.id = ref.id;
      _storeStatus(statusData);
      _toast('Status posted!', 'success');
      renderStatusRow();
      return statusData;
    } catch (e) {
      if (window.__DEBUG__) console.error('[Status] Create link error:', e);
      _toast('Failed to post status', 'error');
      return null;
    }
  }

  async function deleteStatus(statusId) {
    var d = _db();
    var uid = _uid();
    if (!d || !uid) return;
    var data = _statusCache.get(statusId);
    if (data && data.userId !== uid) { _toast('Cannot delete others\' status', 'error'); return; }
    try {
      await d.collection('statuses').doc(statusId).delete();
      _removeStatus(statusId);
      _toast('Status deleted', 'success');
      renderStatusRow();
    } catch (e) {
      if (window.__DEBUG__) console.error('[Status] Delete error:', e);
      _toast('Failed to delete', 'error');
    }
  }

  async function loadStatuses() {
    var d = _db();
    var uid = _uid();
    if (!d || !uid) return [];
    var now = _now();
    var _cutoff = now - STATUS_DURATION_MS;
    await loadMutedStatusUsers();
    try {
      var snap = await d.collection('statuses')
        .where('visibleTo', 'array-contains-any', [uid, '*'])
        .where('expiresAt', '>', now)
        .orderBy('expiresAt', 'asc')
        .limit(200)
        .get();
      var loaded = [];
      snap.forEach(function (doc) {
        var s = _storeStatus(doc);
        if (s) loaded.push(s);
      });
      if (uid) {
        var mySnap = await d.collection('statuses')
          .where('userId', '==', uid)
          .where('expiresAt', '>', now)
          .get();
        mySnap.forEach(function (doc) {
          var s = _storeStatus(doc);
          if (s && loaded.findIndex(function (x) { return x.id === s.id; }) < 0) {
            loaded.push(s);
          }
        });
      }
      _loadSeenFromStorage();
      renderStatusRow();
      renderStatusRings();
      return loaded;
    } catch (e) {
      if (window.__DEBUG__) console.error('[Status] Load error:', e);
      return [];
    }
  }

  function _startStatusListener() {
    var d = _db();
    var uid = _uid();
    if (!d || !uid) return;
    if (typeof window.statusesUnsubscribe === 'function') {
      try { window.statusesUnsubscribe(); } catch (_) {}
    }
    var now = _now();
    window.statusesUnsubscribe = d.collection('statuses')
      .where('visibleTo', 'array-contains-any', [uid, '*'])
      .where('expiresAt', '>', now)
      .orderBy('expiresAt', 'asc')
      .onSnapshot(function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === 'added' || change.type === 'modified') {
            _storeStatus(change.doc);
          } else if (change.type === 'removed') {
            _removeStatus(change.doc.id);
          }
        });
        renderStatusRow();
        renderStatusRings();
      }, function (err) {
        if (window.__DEBUG__) console.warn('[Status] Listener error:', err);
      });
      if (window.statusRefreshTimer) clearInterval(window.statusRefreshTimer);
      window.statusRefreshTimer = setInterval(function () {
        var expired = [];
        _statusCache.forEach(function (s, id) {
          if (_isExpired(s)) expired.push(id);
        });
        expired.forEach(_removeStatus);
        if (expired.length > 0) {
          renderStatusRow();
          renderStatusRings();
        }
      }, 60000);
  }

  function _clearStatusIntervals() {
    if (window.statusRefreshTimer) {
      clearInterval(window.statusRefreshTimer);
      window.statusRefreshTimer = null;
    }
    if (window._statusReminderInterval) {
      clearInterval(window._statusReminderInterval);
      window._statusReminderInterval = null;
    }
  }

  function _loadSeenFromStorage() {
    try {
      var raw = localStorage.getItem('status_seen_' + _uid());
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          var start = Math.max(0, arr.length - MAX_SEEN_SIZE);
          for (var i = start; i < arr.length; i++) {
            _seenSet.add(arr[i]);
          }
        }
      }
    } catch (_) {}
  }

  function _saveSeenToStorage() {
    try {
      localStorage.setItem('status_seen_' + _uid(), JSON.stringify(Array.from(_seenSet)));
    } catch (_) {}
  }

  function _loadMutedFromStorage() {
    try {
      var raw = localStorage.getItem('status_muted_' + _uid());
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach(function (u) { if (u) _mutedUsers.add(String(u)); });
        }
      }
    } catch (_) {}
  }

  function _saveMutedToStorage() {
    try {
      localStorage.setItem('status_muted_' + _uid(), JSON.stringify(Array.from(_mutedUsers)));
    } catch (_) {}
  }

  function isStatusMuted(userId) {
    return !!userId && _mutedUsers.has(String(userId));
  }

  function getMutedStatusUsers() {
    return Array.from(_mutedUsers);
  }

  /* Load the muted-status list for the signed-in user (Firestore first, localStorage fallback). */
  async function loadMutedStatusUsers() {
    var d = _db();
    var uid = _uid();
    _loadMutedFromStorage();
    if (!d || !uid) return Array.from(_mutedUsers);
    try {
      var doc = await d.collection('userSettings').doc(uid).get();
      if (doc.exists && Array.isArray(doc.data().statusMutedUsers)) {
        _mutedUsers = new Set(doc.data().statusMutedUsers.map(String).filter(Boolean));
        _saveMutedToStorage();
      }
    } catch (_) {}
    return Array.from(_mutedUsers);
  }

  async function _persistMutedUsers() {
    var d = _db();
    var uid = _uid();
    if (!d || !uid) return;
    try {
      await d.collection('userSettings').doc(uid).set({
        statusMutedUsers: Array.from(_mutedUsers),
        updatedAt: _now()
      }, { merge: true });
    } catch (e) {
      if (window.__DEBUG__) console.warn('[Status] Persist muted list error:', e);
    }
  }

  async function muteStatusUser(userId) {
    if (!userId || userId === _uid()) { _toast('Cannot mute yourself', 'error'); return; }
    _mutedUsers.add(String(userId));
    _saveMutedToStorage();
    await _persistMutedUsers();
    renderStatusRow();
    renderStatusRings();
  }

  async function unmuteStatusUser(userId) {
    if (!userId) return;
    _mutedUsers.delete(String(userId));
    _saveMutedToStorage();
    await _persistMutedUsers();
    renderStatusRow();
    renderStatusRings();
  }

  async function markStatusSeen(statusId, _userId) {
    if (!statusId) return;
    var wasNew = !_seenSet.has(statusId);
    _seenSet.add(statusId);
    _trimSeenSet();
    _saveSeenToStorage();
    if (!wasNew) return;
    var d = _db();
    var uid = _uid();
    if (!d || !uid) return;
    try {
      var ref = d.collection('statuses').doc(statusId);
      await ref.update({
        seenBy: firebase.firestore.FieldValue.arrayUnion(uid)
      });
      var data = _statusCache.get(statusId);
      if (data && Array.isArray(data.seenBy) && data.seenBy.indexOf(uid) < 0) {
        data.seenBy.push(uid);
      }
    } catch (e) {
      if (window.__DEBUG__) console.warn('[Status] Mark seen error:', e);
    }
  }

  function getUnseenStatusCount() {
    var count = 0;
    var uid = _uid();
    _userStatusMap.forEach(function (statuses, userId) {
      if (userId === uid) return;
      if (_mutedUsers.has(String(userId))) return;
      statuses.forEach(function (s) {
        if (!_seenSet.has(s.id)) count++;
      });
    });
    return count;
  }

  function viewStatus(statusId) {
    var data = _statusCache.get(statusId);
    if (!data) { _toast('Status not found', 'error'); return; }
    var userStatuses = _userStatusMap.get(data.userId) || [];
    var validStatuses = userStatuses.filter(function (s) { return !_isExpired(s); });
    var idx = validStatuses.findIndex(function (s) { return s.id === statusId; });
    if (idx < 0) idx = 0;
    if (typeof window.openStatusViewer === 'function') {
      window.openStatusViewer(validStatuses, idx);
    }
  }

  function viewUserStatuses(userId) {
    var userStatuses = _userStatusMap.get(userId) || [];
    var valid = userStatuses.filter(function (s) { return !_isExpired(s); });
    if (valid.length === 0) { _toast('No statuses from this user', 'info'); return; }
    if (typeof window.openStatusViewer === 'function') {
      window.openStatusViewer(valid, 0);
    }
  }

  async function replyToStatus(statusId, text) {
    if (!text || !text.trim()) return;
    var d = _db();
    var uid = _uid();
    if (!d || !uid) { _toast('Not authenticated', 'error'); return; }
    var data = _statusCache.get(statusId);
    if (!data) { _toast('Status not found', 'error'); return; }
    try {
      await d.collection('statuses').doc(statusId).collection('replies').add({
        userId: uid,
        userName: _userName(),
        text: text.trim(),
        createdAt: _now()
      });
      if (data.userId !== uid) {
        try {
          var userDoc = await d.collection('users').doc(data.userId).get();
          var userData = userDoc.data();
          if (userData && userData.fcmToken) {
            d.collection('notifications').add({
              to: data.userId,
              type: 'status_reply',
              from: uid,
              fromName: _userName(),
              statusId: statusId,
              text: text.trim(),
              createdAt: _now(),
              read: false
            }).catch(function () {});
          }
        } catch (_) {}
      }
      _toast('Reply sent!', 'success');
    } catch (e) {
      if (window.__DEBUG__) console.error('[Status] Reply error:', e);
      _toast('Failed to send reply', 'error');
    }
  }

  async function getStatusPrivacy() {
    var d = _db();
    var uid = _uid();
    if (!d || !uid) return _normalizePrivacy(_privacySetting);
    try {
      var doc = await d.collection('userSettings').doc(uid).get();
      if (doc.exists && doc.data().statusPrivacy) {
        _privacySetting = _normalizePrivacy(doc.data().statusPrivacy);
        return _privacySetting;
      }
    } catch (_) {}
    try {
      var legacy = await d.collection('users').doc(uid).collection('settings').doc('statusPrivacy').get();
      if (legacy.exists && legacy.data().value) {
        _privacySetting = _normalizePrivacy(legacy.data().value);
        return _privacySetting;
      }
    } catch (_) {}
    return _normalizePrivacy(_privacySetting);
  }

  async function setStatusPrivacy(setting, uids) {
    var normalized;
    if (setting && typeof setting === 'object' && typeof setting.mode === 'string') {
      normalized = _normalizePrivacy(setting);
    } else if (typeof setting === 'string') {
      normalized = _normalizePrivacy(setting);
      if (Array.isArray(uids)) {
        if (normalized.mode === 'contacts_except') normalized.exceptUids = uids.slice(0, 2000);
        else if (normalized.mode === 'only_share') normalized.shareWithUids = uids.slice(0, 2000);
      }
    } else {
      _toast('Invalid privacy setting', 'error');
      return;
    }
    var d = _db();
    var uid = _uid();
    if (!d || !uid) { _toast('Not authenticated', 'error'); return; }
    try {
      await d.collection('userSettings').doc(uid).set({
        statusPrivacy: normalized,
        updatedAt: _now()
      }, { merge: true });
      _privacySetting = normalized;
      if (window.PrivacyControls && typeof window.PrivacyControls.set === 'function') {
        try { window.PrivacyControls.set('status', normalized.mode); } catch (_) {}
      }
      _toast('Status privacy updated', 'success');
      renderStatusRow();
    } catch (e) {
      if (window.__DEBUG__) console.error('[Status] Privacy error:', e);
      _toast('Failed to update privacy', 'error');
    }
  }

  function renderStatusRings() {
    var uid = _uid();
    var avatarEls = document.querySelectorAll('[data-user-avatar], .status-avatar, #header-avatar, #sidebar-avatar');
    avatarEls.forEach(function (el) {
      var userId = el.getAttribute('data-user-id') || el.closest('[data-user-id]')?.getAttribute('data-user-id');
      if (!userId && el.id === 'sidebar-avatar') userId = uid;
      if (!userId) return;
      var ring = el.closest('.status-ring-wrap') || el.parentElement;
      if (!ring) return;
      var existingRing = ring.querySelector('.status-ring-indicator');
      if (existingRing) existingRing.remove();
      if (userId === uid) return;
      if (_mutedUsers.has(String(userId))) return;
      var userStatuses = _userStatusMap.get(userId);
      if (!userStatuses || userStatuses.length === 0) return;
      var hasUnseen = userStatuses.some(function (s) { return !_seenSet.has(s.id); });
      var ringDiv = document.createElement('div');
      ringDiv.className = 'status-ring-indicator';
      ringDiv.style.cssText = 'position:absolute;top:-3px;left:-3px;right:-3px;bottom:-3px;border-radius:50%;pointer-events:none;z-index:5;';
      if (hasUnseen) {
        ringDiv.style.background = 'linear-gradient(135deg, #25D366 0%, #128C7E 40%, #075E54 70%, #00A884 100%)';
      } else {
        ringDiv.style.background = '#667781';
      }
      ringDiv.style.padding = '3px';
      var innerMask = document.createElement('div');
      innerMask.style.cssText = 'width:100%;height:100%;border-radius:50%;background:var(--surface-container-lowest, #11131c);';
      ringDiv.appendChild(innerMask);
      ring.style.position = 'relative';
      ring.insertBefore(ringDiv, ring.firstChild);
    });
  }

  function renderStatusRow(container) {
    container = container || document.getElementById('chat-list');
    if (!container) return;
    var existingRow = container.querySelector('.status-row-container');
    if (existingRow) existingRow.remove();
    var uid = _uid();
    var hasMyStatus = _userStatusMap.has(uid) && _userStatusMap.get(uid).length > 0;
    var otherUsers = [];
    _userStatusMap.forEach(function (statuses, userId) {
      if (userId === uid) return;
      if (_mutedUsers.has(String(userId))) return;
      var valid = statuses.filter(function (s) { return !_isExpired(s) && _isVisibleToMe(s); });
      if (valid.length > 0) {
        var latest = valid[valid.length - 1];
        var hasUnseen = valid.some(function (s) { return !_seenSet.has(s.id); });
        var userName = 'User';
        var userPhoto = '';
        if (window.allUsers && Array.isArray(window.allUsers)) {
          var found = window.allUsers.find(function (u) { return u.uid === userId; });
          if (found) {
            userName = found.displayName || found.name || 'User';
            userPhoto = found.photoURL || found.avatar || '';
          }
        }
        otherUsers.push({
          userId: userId,
          userName: userName,
          userPhoto: userPhoto,
          latestStatus: latest,
          hasUnseen: hasUnseen,
          count: valid.length
        });
      }
    });
    otherUsers.sort(function (a, b) {
      if (a.hasUnseen && !b.hasUnseen) return -1;
      if (!a.hasUnseen && b.hasUnseen) return 1;
      return (b.latestStatus.createdAt || 0) - (a.latestStatus.createdAt || 0);
    });
    if (!hasMyStatus && otherUsers.length === 0) {
      var emptyRow = document.createElement('div');
      emptyRow.className = 'status-row-container px-3 py-2 border-b border-outline-variant/10';
      emptyRow.innerHTML = '<div class="flex items-center gap-3 cursor-pointer py-2 px-2 rounded-xl hover:bg-surface-variant/20 transition-colors" data-action="openStatusComposer">' +
        '<div class="relative flex-shrink-0">' +
        '<div class="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden border-2 border-dashed border-primary/40">' +
        '<span class="material-symbols-outlined text-primary/60 text-xl">add</span>' +
        '</div>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
        '<p class="text-sm font-semibold text-on-surface truncate">My Status</p>' +
        '<p class="text-xs text-on-surface-variant/60">Tap to add status update</p>' +
        '</div>' +
        '</div>';
      container.insertBefore(emptyRow, container.firstChild);
      return;
    }
    var row = document.createElement('div');
    row.className = 'status-row-container px-1 py-2 border-b border-outline-variant/10';
    var scrollHtml = '<div class="flex gap-3 overflow-x-auto scrollbar-hide px-2 pb-1" style="scroll-snap-type: x mandatory;">';
    if (hasMyStatus) {
      var myStatuses = _userStatusMap.get(uid) || [];
      var _myLatest = myStatuses[myStatuses.length - 1];
      var myViewCount = 0;
      myStatuses.forEach(function (s) {
        if (Array.isArray(s.seenBy)) myViewCount += s.seenBy.length;
      });
      scrollHtml += '<div class="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer" style="scroll-snap-align:start;width:68px;" data-action="viewUserStatuses" data-action-arg="' + _esc(uid) + '">' +
        '<div class="relative">' +
        '<div class="w-14 h-14 rounded-full p-[3px] bg-gradient-to-br from-green-400 via-blue-500 to-purple-500">' +
        '<div class="w-full h-full rounded-full overflow-hidden border-2 border-surface-container-lowest bg-surface-container-highest">' +
        (_userPhoto() ? '<img src="' + _esc(_userPhoto()) + '" class="w-full h-full object-cover" alt="My Status">' : '<div class="w-full h-full flex items-center justify-center text-on-surface-variant font-bold text-sm">' + _esc(_userName().charAt(0)) + '</div>') +
        '</div></div>' +
        '<div class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-surface-container-lowest">' +
        '<span class="material-symbols-outlined text-on-primary" style="font-size:12px;">add</span>' +
        '</div></div>' +
        '<span class="text-[11px] text-on-surface-variant font-medium truncate w-full text-center">My Status</span>' +
        '<span class="text-[10px] text-on-surface-variant/50">' + myViewCount + ' views</span>' +
        '</div>';
    } else {
      scrollHtml += '<div class="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer" style="scroll-snap-align:start;width:68px;" data-action="openStatusComposer">' +
        '<div class="relative">' +
        '<div class="w-14 h-14 rounded-full p-[3px] border-2 border-dashed border-primary/40 bg-surface-container-highest flex items-center justify-center">' +
        '<span class="material-symbols-outlined text-primary/60" style="font-size:24px;">add</span>' +
        '</div></div>' +
        '<span class="text-[11px] text-on-surface-variant font-medium truncate w-full text-center">My Status</span>' +
        '</div>';
    }
    otherUsers.forEach(function (user) {
      var borderColor = user.hasUnseen ? 'bg-gradient-to-br from-green-400 via-blue-500 to-purple-500' : 'bg-gray-500';
      scrollHtml += '<div class="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer" style="scroll-snap-align:start;width:68px;" data-action="viewUserStatuses" data-action-arg="' + _esc(user.userId) + '">' +
        '<div class="relative">' +
        '<div class="w-14 h-14 rounded-full p-[3px] ' + borderColor + '">' +
        '<div class="w-full h-full rounded-full overflow-hidden border-2 border-surface-container-lowest bg-surface-container-highest">' +
        (user.userPhoto ? '<img src="' + _esc(user.userPhoto) + '" class="w-full h-full object-cover" alt="' + _esc(user.userName) + '">' : '<div class="w-full h-full flex items-center justify-center text-on-surface-variant font-bold text-sm">' + _esc(user.userName.charAt(0)) + '</div>') +
        '</div></div>' +
        (user.count > 1 ? '<div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-on-primary text-[9px] font-bold flex items-center justify-center border border-surface-container-lowest">' + user.count + '</div>' : '') +
        '</div>' +
        '<span class="text-[11px] text-on-surface-variant font-medium truncate w-full text-center">' + _esc(user.userName.length > 10 ? user.userName.substring(0, 10) + '..' : user.userName) + '</span>' +
        '</div>';
    });
    scrollHtml += '</div>';
    row.innerHTML = scrollHtml;
    container.insertBefore(row, container.firstChild);
    if (container === document.getElementById('chat-list')) {
      var panel = document.getElementById('_te_status_panel');
      if (panel && panel.style.display !== 'none' && !panel._rendering) {
        panel._rendering = true;
        try { renderStatusPanel(panel); } finally { panel._rendering = false; }
      }
    }
  }

  function renderStatusPanel(container) {
    if (!container) return;
    container.innerHTML = '';
    var header = document.createElement('button');
    header.className = 'w-full flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-surface-variant/20 transition-colors border-b border-outline-variant/10';
    header.setAttribute('data-action', 'openStatusComposer');
    header.setAttribute('aria-label', 'Add status update');
    header.innerHTML = '<div class="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden border-2 border-dashed border-primary/40 flex-shrink-0">' +
      '<span class="material-symbols-outlined text-primary/60 text-xl">add</span>' +
      '</div>' +
      '<div class="flex-1 min-w-0 text-left">' +
      '<p class="text-sm font-semibold text-on-surface truncate">My Status</p>' +
      '<p class="text-xs text-on-surface-variant/60">Tap to add status update</p>' +
      '</div>';
    container.appendChild(header);
    var rowContainer = document.createElement('div');
    rowContainer.id = '_te_status_row';
    container.appendChild(rowContainer);
    renderStatusRow(rowContainer);
  }

  function openStatusComposer() {
    var overlay = document.createElement('div');
    overlay.id = 'status-composer-overlay';
    overlay.className = 'fixed inset-0 z-[9000] bg-black/80 flex items-end md:items-center justify-center animate-fade-in';
    overlay.onclick = function (e) { if (e.target === overlay) closeStatusComposer(); };

    var bgPresets = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
      'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'linear-gradient(135deg, #13547a 0%, #80d0c7 100%)',
      'linear-gradient(135deg, #0c0c1d 0%, #1a1a3e 50%, #2d1b69 100%)'
    ];

    var composerHtml = '<div class="bg-surface-container rounded-t-3xl md:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-slide-up" onclick="event.stopPropagation()">' +
      '<div class="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">' +
      '<h3 class="font-bold text-on-surface text-base">Create Status</h3>' +
      '<button class="p-1.5 rounded-full hover:bg-surface-variant/30 text-on-surface-variant transition-colors" data-action="closeStatusComposer" aria-label="Close"><span class="material-symbols-outlined" style="font-size:22px">close</span></button>' +
      '</div>' +
      '<div class="flex-1 overflow-y-auto p-4 space-y-4">' +
      '<div class="flex gap-2">' +
      '<button class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all bg-primary text-on-primary" id="sc-tab-text" onclick="window._scSwitchTab(\'text\')" aria-label="Text status">Text</button>' +
      '<button class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all bg-surface-container-highest text-on-surface-variant hover:text-on-surface" id="sc-tab-image" onclick="window._scSwitchTab(\'image\')" aria-label="Image status">Image</button>' +
      '<button class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all bg-surface-container-highest text-on-surface-variant hover:text-on-surface" id="sc-tab-video" onclick="window._scSwitchTab(\'video\')" aria-label="Video status">Video</button>' +
      '<button class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all bg-surface-container-highest text-on-surface-variant hover:text-on-surface" id="sc-tab-link" onclick="window._scSwitchTab(\'link\')" aria-label="Link status">Link</button>' +
      '</div>' +
      '<div id="sc-panel-text">' +
      '<textarea id="sc-text-input" class="w-full h-40 rounded-2xl p-4 text-on-surface text-base resize-none focus:ring-2 focus:ring-primary border-none outline-none" placeholder="What\'s on your mind?" maxlength="700" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff;" oninput="window._scUpdateTextBg(this)"></textarea>' +
      '<div class="flex gap-2 mt-3 overflow-x-auto pb-2" id="sc-bg-presets"></div>' +
      '</div>' +
      '<div id="sc-panel-image" class="hidden">' +
      '<div class="border-2 border-dashed border-outline-variant/30 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors" onclick="document.getElementById(\'sc-image-input\').click()">' +
      '<span class="material-symbols-outlined text-on-surface-variant/40 text-4xl block mb-2">image</span>' +
      '<p class="text-sm text-on-surface-variant/60">Tap to select an image</p>' +
      '<input type="file" id="sc-image-input" accept="image/*" class="hidden" onchange="window._scPreviewImage(this)">' +
      '</div>' +
      '<div id="sc-image-preview" class="hidden mt-3"><img class="w-full max-h-60 object-contain rounded-2xl" id="sc-preview-img" alt="Preview"></div>' +
      '<input id="sc-image-caption" class="w-full mt-3 bg-surface-container-highest rounded-xl py-2.5 px-4 text-on-surface text-sm border-none outline-none focus:ring-1 focus:ring-primary" placeholder="Add a caption..." maxlength="200">' +
      '</div>' +
      '<div id="sc-panel-video" class="hidden">' +
      '<div class="border-2 border-dashed border-outline-variant/30 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors" onclick="document.getElementById(\'sc-video-input\').click()">' +
      '<span class="material-symbols-outlined text-on-surface-variant/40 text-4xl block mb-2">videocam</span>' +
      '<p class="text-sm text-on-surface-variant/60">Tap to select a video</p>' +
      '<input type="file" id="sc-video-input" accept="video/*" class="hidden" onchange="window._scPreviewVideo(this)">' +
      '</div>' +
      '<div id="sc-video-preview" class="hidden mt-3"><video class="w-full max-h-60 rounded-2xl" id="sc-preview-vid" controls muted playsinline></video></div>' +
      '<input id="sc-video-caption" class="w-full mt-3 bg-surface-container-highest rounded-xl py-2.5 px-4 text-on-surface text-sm border-none outline-none focus:ring-1 focus:ring-primary" placeholder="Add a caption..." maxlength="200">' +
      '</div>' +
      '<div id="sc-panel-link" class="hidden">' +
      '<div class="border-2 border-dashed border-outline-variant/30 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors" onclick="document.getElementById(\'sc-link-input\').focus()">' +
      '<span class="material-symbols-outlined text-on-surface-variant/40 text-4xl block mb-2">link</span>' +
      '<p class="text-sm text-on-surface-variant/60">Share a link</p>' +
      '</div>' +
      '<input id="sc-link-input" type="url" class="w-full mt-3 bg-surface-container-highest rounded-xl py-2.5 px-4 text-on-surface text-sm border-none outline-none focus:ring-1 focus:ring-primary" placeholder="https://example.com" maxlength="500" oninput="window._scUpdateLink(this)">' +
      '<input id="sc-link-caption" class="w-full mt-3 bg-surface-container-highest rounded-xl py-2.5 px-4 text-on-surface text-sm border-none outline-none focus:ring-1 focus:ring-primary" placeholder="Add a caption..." maxlength="200">' +
      '</div>' +
      '</div>' +
      '<div class="px-5 py-4 border-t border-outline-variant/10">' +
      '<div class="flex items-center justify-between mb-3">' +
      '<button class="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors" onclick="window._scOpenPrivacy()" aria-label="Status privacy">' +
      '<span class="material-symbols-outlined" style="font-size:16px">visibility</span>' +
      '<span id="sc-privacy-label">Everyone</span>' +
      '</button>' +
      '</div>' +
      '<button id="sc-post-btn" class="w-full py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all" onclick="window._scPostStatus()" disabled>Post Status</button>' +
      '</div>' +
      '</div>';

    overlay.innerHTML = composerHtml;
    document.body.appendChild(overlay);

    var presetsEl = document.getElementById('sc-bg-presets');
    if (presetsEl) {
      bgPresets.forEach(function (bg) {
        var swatch = document.createElement('button');
        swatch.className = 'w-10 h-10 rounded-xl flex-shrink-0 border-2 border-transparent hover:border-white/50 transition-all cursor-pointer';
        swatch.style.background = bg;
        swatch.onclick = function () {
          var inp = document.getElementById('sc-text-input');
          if (inp) { inp.style.background = bg; window._scCurrentBg = bg; }
          presetsEl.querySelectorAll('button').forEach(function (b) { b.classList.remove('border-white/80'); });
          swatch.classList.add('border-white/80');
        };
        presetsEl.appendChild(swatch);
      });
    }

    getStatusPrivacy().then(function (p) {
      var label = document.getElementById('sc-privacy-label');
      if (label) label.textContent = _privacyLabel(p);
    });

    window._scCurrentBg = bgPresets[0];
    window._scSelectedFile = null;
    window._scSelectedType = 'text';

    window._scSwitchTab = function (tab) {
      window._scSelectedType = tab;
      ['text', 'image', 'video', 'link'].forEach(function (t) {
        var panel = document.getElementById('sc-panel-' + t);
        var tabBtn = document.getElementById('sc-tab-' + t);
        if (panel) panel.classList.toggle('hidden', t !== tab);
        if (tabBtn) {
          tabBtn.classList.toggle('bg-primary', t === tab);
          tabBtn.classList.toggle('text-on-primary', t === tab);
          tabBtn.classList.toggle('bg-surface-container-highest', t !== tab);
          tabBtn.classList.toggle('text-on-surface-variant', t !== tab);
        }
      });
      _updatePostBtn();
    };

    window._scUpdateTextBg = function (inp) {
      var _v = inp.value.trim();
      _updatePostBtn();
    };

    window._scUpdateLink = function (inp) {
      _updatePostBtn();
    };

    window._scPreviewImage = function (input) {
      if (!input.files || !input.files[0]) return;
      window._scSelectedFile = input.files[0];
      var reader = new FileReader();
      reader.onload = function (e) {
        var preview = document.getElementById('sc-image-preview');
        var img = document.getElementById('sc-preview-img');
        if (preview && img) { img.src = e.target.result; preview.classList.remove('hidden'); }
      };
      reader.readAsDataURL(input.files[0]);
      _updatePostBtn();
    };

    window._scPreviewVideo = function (input) {
      if (!input.files || !input.files[0]) return;
      window._scSelectedFile = input.files[0];
      var reader = new FileReader();
      reader.onload = function (e) {
        var preview = document.getElementById('sc-video-preview');
        var vid = document.getElementById('sc-preview-vid');
        if (preview && vid) { vid.src = e.target.result; preview.classList.remove('hidden'); }
      };
      reader.readAsDataURL(input.files[0]);
      _updatePostBtn();
    };

    function _updatePostBtn() {
      var btn = document.getElementById('sc-post-btn');
      if (!btn) return;
      var ready;
      if (window._scSelectedType === 'text') {
        var inp = document.getElementById('sc-text-input');
        ready = inp && inp.value.trim().length > 0;
      } else if (window._scSelectedType === 'link') {
        var linkInp = document.getElementById('sc-link-input');
        ready = linkInp && linkInp.value.trim().length > 0;
      } else {
        ready = !!window._scSelectedFile;
      }
      btn.disabled = !ready;
    }

    window._scPostStatus = async function () {
      var btn = document.getElementById('sc-post-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Posting...'; }
      try {
        if (window._scSelectedType === 'text') {
          var inp = document.getElementById('sc-text-input');
          await createTextStatus(inp ? inp.value : '', window._scCurrentBg);
        } else if (window._scSelectedType === 'image') {
          if (!window._scSelectedFile) { _toast('Select an image first', 'error'); return; }
          var urlImg = await uploadStatusMedia(window._scSelectedFile);
          var capImg = document.getElementById('sc-image-caption');
          await createImageStatus(urlImg, capImg ? capImg.value : '');
        } else if (window._scSelectedType === 'video') {
          if (!window._scSelectedFile) { _toast('Select a video first', 'error'); return; }
          var urlVid = await uploadStatusMedia(window._scSelectedFile);
          var capVid = document.getElementById('sc-video-caption');
          await createVideoStatus(urlVid, capVid ? capVid.value : '');
        } else if (window._scSelectedType === 'link') {
          var linkInp = document.getElementById('sc-link-input');
          if (!linkInp || !linkInp.value.trim()) { _toast('Enter a link first', 'error'); return; }
          var capLink = document.getElementById('sc-link-caption');
          await createLinkStatus(linkInp.value, capLink ? capLink.value : '');
        }
        closeStatusComposer();
      } catch (e) {
        if (window.__DEBUG__) console.error('[Status] Post error:', e);
        _toast('Failed to post status', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Post Status'; }
      }
    };

    window._scOpenPrivacy = function () {
      var current = _normalizePrivacy(_privacySetting);
      var options = [
        { value: 'everyone', label: 'Everyone', icon: 'public', picker: false },
        { value: 'contacts', label: 'My Contacts', icon: 'contacts', picker: false },
        { value: 'contacts_except', label: 'My Contacts Except...', icon: 'person_off', picker: true },
        { value: 'only_share', label: 'Only Share With...', icon: 'lock_person', picker: true }
      ];
      var popup = document.createElement('div');
      popup.id = 'status-privacy-popup';
      popup.className = 'fixed inset-0 z-[9001] bg-black/60 flex items-center justify-center';
      popup.onclick = function (e) { if (e.target === popup) { popup.remove(); window._scPrivacyPopup = null; } };
      var inner = '<div class="bg-surface-container rounded-2xl w-80 p-1 shadow-xl">';
      inner += '<p class="px-4 py-3 text-sm font-bold text-on-surface border-b border-outline-variant/10">Who can see my status?</p>';
      options.forEach(function (opt) {
        var checked = current.mode === opt.value;
        inner += '<button class="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-variant/20 transition-colors ' + (checked ? 'text-primary' : 'text-on-surface') + '" onclick="window._scSetPrivacy(this, \'' + opt.value + '\', ' + (opt.picker ? 'true' : 'false') + ')">' +
          '<span class="material-symbols-outlined" style="font-size:20px">' + opt.icon + '</span>' +
          '<span class="text-sm font-medium">' + opt.label + '</span>' +
          (checked ? '<span class="material-symbols-outlined ml-auto" style="font-size:18px">check</span>' : '') +
          '</button>';
      });
      inner += '</div>';
      popup.innerHTML = inner;
      document.body.appendChild(popup);
      window._scPrivacyPopup = popup;
    };

    window._scSetPrivacy = async function (el, val, isPicker) {
      var popup = window._scPrivacyPopup;
      if (isPicker) {
        var current = _normalizePrivacy(_privacySetting);
        var preselected = val === 'contacts_except' ? current.exceptUids : current.shareWithUids;
        if (popup) { popup.remove(); window._scPrivacyPopup = null; }
        var picked = await _statusPickContacts(val, preselected);
        if (picked && picked.uids) {
          await setStatusPrivacy(val, picked.uids);
        }
      } else {
        if (popup) { popup.remove(); window._scPrivacyPopup = null; }
        await setStatusPrivacy(val);
      }
      var label = document.getElementById('sc-privacy-label');
      if (label) label.textContent = _privacyLabel(_privacySetting);
    };

    var textInput = document.getElementById('sc-text-input');
    if (textInput) setTimeout(function () { textInput.focus(); }, 300);
  }

  function closeStatusComposer() {
    var overlay = document.getElementById('status-composer-overlay');
    if (overlay) overlay.remove();
    var popup = document.getElementById('status-privacy-popup');
    if (popup) popup.remove();
    var pickOverlay = document.getElementById('status-contacts-overlay');
    if (pickOverlay) pickOverlay.remove();
    delete window._scSwitchTab;
    delete window._scUpdateTextBg;
    delete window._scUpdateLink;
    delete window._scPreviewImage;
    delete window._scPreviewVideo;
    delete window._scPostStatus;
    delete window._scOpenPrivacy;
    delete window._scSetPrivacy;
    delete window._scCurrentBg;
    delete window._scSelectedFile;
    delete window._scSelectedType;
    delete window._scPrivacyPopup;
  }

  function _statusPickContacts(mode, preselected) {
    var contacts = _getChatContacts();
    var selected = new Set(Array.isArray(preselected) ? preselected : []);
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.id = 'status-contacts-overlay';
      overlay.className = 'fixed inset-0 z-[9002] bg-black/80 flex items-end md:items-center justify-center animate-fade-in';
      overlay.onclick = function (e) { if (e.target === overlay) { overlay.remove(); resolve(null); } };

      var title = mode === 'contacts_except' ? 'Choose contacts to EXCLUDE' : 'Choose who can see your status';
      var html = '<div class="bg-surface-container rounded-t-3xl md:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-slide-up" onclick="event.stopPropagation()">' +
        '<div class="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">' +
        '<h3 class="font-bold text-on-surface text-base">' + title + '</h3>' +
        '<button class="p-1.5 rounded-full hover:bg-surface-variant/30 text-on-surface-variant transition-colors" data-sc-pick-cancel aria-label="Close"><span class="material-symbols-outlined" style="font-size:22px">close</span></button>' +
        '</div>' +
        '<div class="px-5 pt-3">' +
        '<input id="sc-contact-search" class="w-full bg-surface-container-highest rounded-xl py-2.5 px-4 text-on-surface text-sm border-none outline-none focus:ring-1 focus:ring-primary" placeholder="Search contacts..." maxlength="100">' +
        '</div>' +
        '<div class="flex-1 overflow-y-auto p-3 space-y-1" id="sc-contact-list"></div>' +
        '<div class="px-5 py-4 border-t border-outline-variant/10">' +
        '<div class="flex items-center justify-between mb-3">' +
        '<span class="text-xs text-on-surface-variant" id="sc-contact-count"></span>' +
        '</div>' +
        '<button id="sc-contact-done" class="w-full py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm hover:brightness-110 transition-all">Done</button>' +
        '</div>' +
        '</div>';
      overlay.innerHTML = html;
      document.body.appendChild(overlay);

      var listEl = overlay.querySelector('#sc-contact-list');
      var searchEl = overlay.querySelector('#sc-contact-search');
      var countEl = overlay.querySelector('#sc-contact-count');
      var doneBtn = overlay.querySelector('#sc-contact-done');

      function updateCount() {
        if (countEl) countEl.textContent = selected.size + ' selected';
      }

      function renderList() {
        var q = (searchEl.value || '').trim().toLowerCase();
        listEl.innerHTML = '';
        var shown = 0;
        contacts.forEach(function (c) {
          if (q && (c.name || '').toLowerCase().indexOf(q) < 0 && c.uid.toLowerCase().indexOf(q) < 0) return;
          shown++;
          var isSel = selected.has(c.uid);
          var row = document.createElement('button');
          row.type = 'button';
          row.className = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/20 transition-colors text-left';
          row.innerHTML =
            '<div class="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden flex-shrink-0">' +
            (c.photoURL ? '<img src="' + _esc(c.photoURL) + '" class="w-full h-full object-cover" alt="">' : '<span class="material-symbols-outlined text-on-surface-variant text-lg">person</span>') +
            '</div>' +
            '<div class="flex-1 min-w-0">' +
            '<p class="text-sm text-on-surface font-medium truncate">' + _esc(c.name || 'User') + '</p>' +
            '</div>' +
            '<div class="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center ' + (isSel ? 'bg-primary border-primary' : 'border-outline-variant') + '">' +
            (isSel ? '<span class="material-symbols-outlined text-on-primary" style="font-size:14px">check</span>' : '') +
            '</div>';
          row.onclick = function () {
            if (selected.has(c.uid)) selected.delete(c.uid); else selected.add(c.uid);
            renderList();
            updateCount();
          };
          listEl.appendChild(row);
        });
        if (shown === 0) {
          listEl.innerHTML = '<p class="text-sm text-on-surface-variant/60 text-center py-8">No contacts found' + (contacts.length === 0 ? '. Start a chat to add contacts.' : '') + '</p>';
        }
      }

      searchEl.addEventListener('input', renderList);
      overlay.querySelector('[data-sc-pick-cancel]').onclick = function () { overlay.remove(); resolve(null); };
      doneBtn.onclick = function () {
        overlay.remove();
        resolve({ mode: mode, uids: Array.from(selected) });
      };

      renderList();
      updateCount();
      setTimeout(function () { searchEl.focus(); }, 200);
    });
  }

  function createStatusReminder() {
    if (window._statusReminderInterval) {
      clearInterval(window._statusReminderInterval);
    }
    window._statusReminderInterval = setInterval(function () {
      _now();
      var expired = [];
      _statusCache.forEach(function (s, id) {
        if (_isExpired(s)) expired.push(id);
      });
      expired.forEach(_removeStatus);
      if (expired.length > 0) {
        renderStatusRow();
        renderStatusRings();
      }
    }, 30000);
  }

  function _init() {
    if (_loadAttempted) return;
    _loadAttempted = true;
    _loadSeenFromStorage();
    createStatusReminder();
    window.addEventListener('nsl:chats-loaded', function () {
      _syncUserContacts();
    });
    if (typeof window._statusInitStarted !== 'undefined') return;
    window._statusInitStarted = true;
    var checkAuth = setInterval(function () {
      var uid = _uid();
      if (uid) {
        clearInterval(checkAuth);
        loadStatuses().then(function () {
          _startStatusListener();
          _syncUserContacts();
        });
      }
    }, 1000);
    setTimeout(function () { clearInterval(checkAuth); }, 15000);
  }

  window.openStatusComposer = openStatusComposer;
  window.createTextStatus = createTextStatus;
  window.createImageStatus = createImageStatus;
  window.createVideoStatus = createVideoStatus;
  window.createLinkStatus = createLinkStatus;
  window.uploadStatusMedia = uploadStatusMedia;
  window.viewStatus = viewStatus;
  window.viewUserStatuses = viewUserStatuses;
  window.replyToStatus = replyToStatus;
  window.deleteStatus = deleteStatus;
  window.getStatusPrivacy = getStatusPrivacy;
  window.setStatusPrivacy = setStatusPrivacy;
  window.loadStatuses = loadStatuses;
  window.renderStatusRings = renderStatusRings;
  window.renderStatusRow = renderStatusRow;
  window.renderStatusPanel = renderStatusPanel;
  window.getUnseenStatusCount = getUnseenStatusCount;
  window.markStatusSeen = markStatusSeen;
  window.muteStatusUser = muteStatusUser;
  window.unmuteStatusUser = unmuteStatusUser;
  window.isStatusMuted = isStatusMuted;
  window.getMutedStatusUsers = getMutedStatusUsers;
  window.loadMutedStatusUsers = loadMutedStatusUsers;
  window.createStatusReminder = createStatusReminder;
  window._clearStatusIntervals = _clearStatusIntervals;
  window._statusDataCache = _statusCache;
  window._statusUserMap = _userStatusMap;
  window._statusSeenSet = _seenSet;
  window.computeStatusVisibleTo = _computeVisibleTo;
  window._statusPickContacts = _statusPickContacts;
  window.Status = {
    getStatusPrivacy: getStatusPrivacy,
    setStatusPrivacy: setStatusPrivacy,
    syncContacts: _syncUserContacts,
    createTextStatus: createTextStatus,
    createImageStatus: createImageStatus,
    createVideoStatus: createVideoStatus,
    createLinkStatus: createLinkStatus,
    uploadStatusMedia: uploadStatusMedia,
    deleteStatus: deleteStatus,
    replyToStatus: replyToStatus,
    viewStatus: viewStatus,
    viewUserStatuses: viewUserStatuses,
    loadStatuses: loadStatuses,
    getUnseenStatusCount: getUnseenStatusCount,
    markStatusSeen: markStatusSeen,
    muteStatusUser: muteStatusUser,
    unmuteStatusUser: unmuteStatusUser,
    isStatusMuted: isStatusMuted,
    getMutedStatusUsers: getMutedStatusUsers
  };

  window.addEventListener('beforeunload', function () {
    _clearStatusIntervals();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
