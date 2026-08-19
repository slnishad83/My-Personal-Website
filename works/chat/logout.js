// logout.js — WhatsApp-style logout with full cleanup
'use strict';

(function () {
  function _getAuth() {
    if (window.App && window.App.auth) return window.App.auth;
    if (typeof firebase !== 'undefined' && firebase.auth) return firebase.auth();
    return null;
  }

  function _getDB() {
    return window.db || (window.App && window.App.db) || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  }

  function _getUser() {
    return window.currentUser || (window.App && window.App.currentUser);
  }

  function _debug() {
    if (window.__DEBUG__) console.log.apply(console, ['[Logout]'].concat(Array.prototype.slice.call(arguments)));
  }

  /* ── WhatsApp-style loading overlay ─────────────────────────────── */
  function _showSpinner(msg) {
    var existing = document.getElementById('nsl-logout-overlay');
    if (existing) return;
    var overlay = document.createElement('div');
    overlay.id = 'nsl-logout-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML =
      '<div style="background:var(--surface-container,#1e1e2e);border-radius:16px;padding:32px 40px;text-align:center;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.25);display:flex;flex-direction:column;align-items:center;gap:16px;">' +
        '<div style="width:36px;height:36px;border:3px solid var(--primary,#00a884);border-top-color:transparent;' +
          'border-radius:50%;animation:nslLogoutSpin 0.75s linear infinite;"></div>' +
        '<div style="font-size:15px;font-weight:500;color:var(--on-surface,#e9ecef);">' + (msg || 'Logging out...') + '</div>' +
      '</div>' +
      '<style>@keyframes nslLogoutSpin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(overlay);
  }

  function _hideSpinner() {
    var el = document.getElementById('nsl-logout-overlay');
    if (el) el.remove();
  }

  /* ── WhatsApp-style confirmation dialog ─────────────────────────── */
  function _showConfirm(title, message) {
    return new Promise(function (resolve) {
      var existing = document.getElementById('nsl-logout-confirm');
      if (existing) existing.remove();

      var overlay = document.createElement('div');
      overlay.id = 'nsl-logout-confirm';
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.45);display:flex;align-items:center;' +
        'justify-content:center;animation:nslFadeIn 0.15s ease;';

      var dialog = document.createElement('div');
      dialog.style.cssText =
        'background:var(--surface-container,#202c33);border-radius:12px;padding:24px 20px 12px;max-width:320px;' +
        'width:90%;box-shadow:0 4px 24px rgba(0,0,0,0.28);animation:nslScaleIn 0.15s ease;';

      var titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-size:16px;font-weight:600;color:var(--on-surface,#e9ecef);margin-bottom:8px;';
      titleEl.textContent = title;

      var msgEl = document.createElement('div');
      msgEl.style.cssText = 'font-size:14px;color:var(--on-surface-variant,#8696a0);margin-bottom:20px;line-height:1.4;';
      msgEl.textContent = message;

      var btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;';

      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText =
        'background:none;border:none;color:var(--primary,#00a884);font-size:14px;font-weight:600;' +
        'padding:8px 16px;cursor:pointer;border-radius:8px;transition:background 0.15s;';
      cancelBtn.onmouseenter = function () { cancelBtn.style.background = 'rgba(0,168,132,0.1)'; };
      cancelBtn.onmouseleave = function () { cancelBtn.style.background = 'none'; };

      var okBtn = document.createElement('button');
      okBtn.textContent = 'OK';
      okBtn.style.cssText =
        'background:var(--primary,#00a884);border:none;color:#fff;font-size:14px;font-weight:600;' +
        'padding:8px 20px;cursor:pointer;border-radius:8px;transition:background 0.15s;';
      okBtn.onmouseenter = function () { okBtn.style.background = '#008f6f'; };
      okBtn.onmouseleave = function () { okBtn.style.background = 'var(--primary,#00a884)'; };

      var cleanup = function (result) {
        overlay.remove();
        resolve(result);
      };

      cancelBtn.onclick = function () { cleanup(false); };
      okBtn.onclick = function () { cleanup(true); };
      overlay.onclick = function (e) { if (e.target === overlay) cleanup(false); };

      var onKey = function (e) {
        if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', onKey); }
      };
      document.addEventListener('keydown', onKey);

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(okBtn);
      dialog.appendChild(titleEl);
      dialog.appendChild(msgEl);
      dialog.appendChild(btnRow);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      okBtn.focus();
    });
  }

  /* ── Core logout logic ──────────────────────────────────────────── */
  async function _performLogout() {
    var auth = _getAuth();
    var db = _getDB();
    var user = _getUser();

    _debug('Starting logout cleanup...');

    // (b) Unsubscribe ALL Firestore listeners
    try {
      if (typeof window.Presence === 'object' && typeof window.Presence.destroy === 'function') {
        window.Presence.destroy();
        _debug('Presence destroyed');
      }
    } catch (e) { _debug('Presence cleanup error:', e); }

    try {
      if (window.Presence && typeof window.Presence._stopHeartbeat === 'function') {
        window.Presence._stopHeartbeat();
      }
    } catch (_) {}

    // Try State unsubs from chat-core (may be on window or a closure)
    var stateUnsubs = ['messagesUnsub', 'chatsUnsub', 'groupsUnsub', 'broadcastsUnsub'];
    stateUnsubs.forEach(function (key) {
      try {
        var unsub = (window.State && typeof window.State[key] === 'function' && window.State[key])
          || (window.App && typeof window.App[key] === 'function' && window.App[key]);
        if (typeof unsub === 'function') {
          unsub();
          _debug(key + ' unsubscribed');
        }
      } catch (e) { _debug(key + ' unsubscribe error:', e); }
    });

    // (c) Update user's Firestore document: set offline
    if (db && user && user.uid) {
      var userRef = db.collection('users').doc(user.uid);
      try {
        await userRef.update({
          onlineStatus: 'offline',
          lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
        _debug('Set user offline in Firestore');
      } catch (e) {
        _debug('Failed to update offline status:', e);
      }

      // (d) Remove FCM token from users/{uid}.fcmTokens
      try {
        if (window.firebase && typeof firebase.messaging === 'function') {
          var messaging = firebase.messaging();
          if (messaging && typeof messaging.getToken === 'function') {
            var token = await messaging.getToken({ vapidKey: window.FCM_VAPID_KEY }).catch(function () { return null; });
            if (token) {
              var fcmKey = token.replace(/[^a-zA-Z0-9]/g, '').slice(-120);
              var fcmUpdate = {};
              fcmUpdate['fcmTokens.' + fcmKey] = firebase.firestore.FieldValue.delete();
              await userRef.update(fcmUpdate).catch(function () {});
              _debug('FCM token removed');
            }
          }
        }
      } catch (e) { _debug('FCM token removal error:', e); }

      // Also try deleting the FCM token from messaging service worker
      try {
        if (window.firebase && typeof firebase.messaging === 'function') {
          var m = firebase.messaging();
          if (m && typeof m.deleteToken === 'function') {
            await m.deleteToken().catch(function () {});
          }
        }
      } catch (_) {}
    }

    // (e) Clear heartbeat interval
    try {
      if (window.Presence && typeof window.Presence._stopHeartbeat === 'function') {
        window.Presence._stopHeartbeat();
      }
    } catch (_) {}

    // Also scan for any stray setInterval timers related to heartbeat
    try {
      if (window._nslHeartbeatTimer) {
        clearInterval(window._nslHeartbeatTimer);
        window._nslHeartbeatTimer = null;
      }
    } catch (_) {}

    // (f) Clear all local state
    try {
      if (window.State) {
        window.State.chats = [];
        window.State.messages = [];
        window.State.activeId = null;
        window.State.activeChatData = null;
        window.State.activeType = null;
        window.State.messagesUnsub = null;
        window.State.chatsUnsub = null;
        window.State.groupsUnsub = null;
        if (window.State.broadcastsUnsub) window.State.broadcastsUnsub = null;
      }
    } catch (_) {}

    // Clear window-level state
    try {
      window.currentChat = null;
      window.currentChatType = null;
      window.currentUser = null;
      window._onlineUsers = {};
      if (window.App) {
        window.App.currentUser = null;
        window.App.currentChat = null;
        window.App.currentChatType = null;
      }
    } catch (_) {}

    // (g) Clear sensitive localStorage items (keep theme settings)
    try {
      var _sensitiveKeys = [
        'tc_unread_state', 'tc_unread_chats',
        'tcSessionId',
        'tcCallHistory',
        'nsl_unread_chats', 'nsl_unread_state',
        'nsl_offline_queue',
        'nsl_2fa_ok', 'nsl_2fa_pending',
        'nsl_dnd', 'nsl-dnd',
        'chatLockSettings', 'chatLockPin',
        'chatLockAttempts', 'chatLockLockout',
        'chatLockSkipUntil',
        'nsl_session_active'
      ];
      _sensitiveKeys.forEach(function (k) {
        try { localStorage.removeItem(k); } catch (_) {}
      });

      // Also clear any tc_auth_* keys
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && (key.indexOf('tc_auth_') === 0 || key.indexOf('nsl_auth_') === 0 || key.indexOf('tcDraft_') === 0)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(function (k) {
        try { localStorage.removeItem(k); } catch (_) {}
      });

      // Clear related sessionStorage
      try { sessionStorage.removeItem('tcSessionId'); } catch (_) {}
      try { sessionStorage.removeItem('nsl_2fa_ok'); } catch (_) {}
      try { sessionStorage.removeItem('nsl_2fa_pending'); } catch (_) {}

      _debug('LocalStorage cleaned');
    } catch (e) { _debug('LocalStorage cleanup error:', e); }

    // (h) Call firebase.auth().signOut()
    try {
      if (auth && typeof auth.signOut === 'function') {
        await auth.signOut();
        _debug('Firebase auth.signOut() complete');
      } else if (typeof window.signOut === 'function') {
        // Avoid infinite recursion — only call if it's the old simple version
        _debug('Using fallback signOut');
      }
    } catch (e) {
      _debug('auth.signOut() failed:', e);
    }

    // (i) Clear the app badge
    try {
      if (navigator.clearAppBadge) {
        await navigator.clearAppBadge();
        _debug('App badge cleared');
      }
    } catch (_) {}

    // (j) Redirect to login.html
    _debug('Redirecting to login.html');
    window.location.href = 'login.html';
  }

  /* ── Public logout function ─────────────────────────────────────── */
  async function logout() {
    // Prevent double-trigger
    if (window._nslLoggingOut) return;
    window._nslLoggingOut = true;

    try {
      // (1) Show WhatsApp-style confirmation dialog
      var confirmed = await _showConfirm(
        'Log out',
        'Are you sure you want to log out?'
      );

      if (!confirmed) {
        _debug('Logout cancelled by user');
        window._nslLoggingOut = false;
        return;
      }

      // (2a) Show loading spinner
      _showSpinner('Logging out...');

      // (2b-2k) Perform all cleanup then sign out and redirect
      await _performLogout();

    } catch (e) {
      _debug('Logout error (forcing redirect):', e);
      // (2k) If anything fails, still sign out and redirect
      try {
        var auth = _getAuth();
        if (auth && typeof auth.signOut === 'function') {
          await auth.signOut();
        }
      } catch (_) {}
      window.location.href = 'login.html';
    } finally {
      window._nslLoggingOut = false;
    }
  }

  /* ── Expose on window ────────────────────────────────────────────── */
  window.logout = logout;
  window.performLogout = logout;

  // Override the existing simple signOut from ui-glue.js with our comprehensive version
  window.signOut = logout;

  _debug('Module loaded');
})();
