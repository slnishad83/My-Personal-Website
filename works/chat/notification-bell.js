// ========================================
// NOTIFICATION BELL — sidebar toggle
// Drop this file into works/chat/ and add:
//   <script src="notification-bell.js" defer></script>
// to the <head> of works/chat/index.html
// (after config.js and before the closing </body>)
// ========================================

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  let _bellBtn = null;
  let _bellDropdown = null;
  let _dropdownOpen = false;
  const NOTIF_DISABLED_KEY = 'teamChatNotifUserDisabled';

  // ── Helpers ──────────────────────────────────────────────────────────────
  function _permission() {
    return 'Notification' in window ? Notification.permission : 'unsupported';
  }

  function _userDisabled() {
    try { return localStorage.getItem(NOTIF_DISABLED_KEY) === '1'; } catch (_) { return false; }
  }
  function _setUserDisabled(val) {
    try { val ? localStorage.setItem(NOTIF_DISABLED_KEY, '1') : localStorage.removeItem(NOTIF_DISABLED_KEY); } catch (_) {}
  }

  // ── Compute display state ─────────────────────────────────────────────────
  // Returns: 'on' | 'off' | 'blocked' | 'unsupported'
  function _getState() {
    const perm = _permission();
    if (perm === 'unsupported') return 'unsupported';
    if (perm === 'denied') return 'blocked';
    if (perm === 'granted' && !_userDisabled()) return 'on';
    return 'off';
  }

  // ── SVG bell icons ─────────────────────────────────────────────────────
  const SVG_BELL_ON = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>`;

  const SVG_BELL_OFF = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      <path d="M18.63 13A17.9 17.9 0 0 1 18 8"/>
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/>
      <path d="M18 8a6 6 0 0 0-9.33-4.99"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>`;

  const SVG_BELL_BLOCKED = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>`;

  // ── Button render ──────────────────────────────────────────────────────
  function _renderBell() {
    if (!_bellBtn) return;
    const state = _getState();
    _bellBtn.dataset.notifState = state;
    _bellBtn.title =
      state === 'on'      ? 'Notifications ON — click to manage' :
      state === 'blocked' ? 'Notifications blocked in browser — click for help' :
      state === 'unsupported' ? 'Notifications not supported in this browser' :
                             'Notifications OFF — click to enable';
    _bellBtn.innerHTML =
      state === 'on'      ? SVG_BELL_ON :
      state === 'blocked' ? SVG_BELL_BLOCKED :
                            SVG_BELL_OFF;
  }

  // ── Dropdown content ──────────────────────────────────────────────────
  function _buildDropdown() {
    const state = _getState();
    let html = `<div class="notif-bell-dropdown-inner">`;
    const icons = { on: '🔔', off: '🔕', blocked: '🚫', unsupported: '⚠️' };
    const labels = { on: 'Notifications are ON', off: 'Notifications are OFF', blocked: 'Notifications are BLOCKED', unsupported: 'Not supported' };
    html += `<div class="notif-bell-status ${state}">
      <span class="notif-bell-status-icon">${icons[state] || '🔔'}</span>
      <span class="notif-bell-status-label">${labels[state] || ''}</span>
    </div>`;

    if (state === 'on') {
      html += `
        <button class="notif-bell-action-btn notif-bell-test" id="notifBellTestBtn">
          <span>📤</span> Send test to yourself
        </button>
        <button class="notif-bell-action-btn notif-bell-disable" id="notifBellDisableBtn">
          <span>🔕</span> Turn off notifications
        </button>`;
    } else if (state === 'off') {
      html += `
        <p class="notif-bell-desc">Enable push notifications to receive messages and call alerts even when the app is in the background.</p>
        <button class="notif-bell-action-btn notif-bell-enable" id="notifBellEnableBtn">
          <span>🔔</span> Enable notifications
        </button>`;
    } else if (state === 'blocked') {
      html += `
        <p class="notif-bell-desc">Your browser has blocked notifications for this site. To fix this:</p>
        <ol class="notif-bell-steps">
          <li>Click the <strong>🔒 lock icon</strong> in your browser's address bar</li>
          <li>Find <strong>Notifications</strong> and set it to <em>Allow</em></li>
          <li>Reload this page</li>
        </ol>
        <button class="notif-bell-action-btn notif-bell-refresh" id="notifBellRefreshBtn">
          <span>🔄</span> I've allowed it — reload
        </button>`;
    }
    html += `</div>`;
    return html;
  }

  // ── Send test notification to self ────────────────────────────────────
  async function _sendTestToSelf() {
    if (_permission() !== 'granted') return;
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification('Team Chat — Test Notification ✅', {
          body: 'Push notifications are working! You\'ll receive alerts for new messages and calls.',
          icon: './app-icon-192.png',
          badge: './app-icon-192.png',
          tag: 'notif-bell-test',
          renotify: true,
          data: { url: './index.html', kind: 'test' },
          actions: [{ action: 'open', title: 'Open chat' }]
        });
        _showToast('Test notification sent! Check your notification bar.', 'success');
      } else {
        new Notification('Team Chat — Test Notification ✅', {
          body: 'Push notifications are working!',
          icon: './app-icon-192.png'
        });
      }
    } catch (e) {
      _showToast('Could not send test notification.', 'error');
    }
  }

  // ── Enable push via existing app function ────────────────────────────────
  async function _enableNotifications() {
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        _setUserDisabled(false);
        // Call the app's existing FCM registration if available
        if (typeof window.registerFcmTokenForCurrentUser === 'function') {
          await window.registerFcmTokenForCurrentUser({ force: true });
        }
        _renderBell();
        _closeDropdown();
        _showToast('Notifications enabled! You\'ll receive alerts for messages and calls.', 'success');
      } else if (perm === 'denied') {
        _renderBell();
        _renderDropdown();
      } else {
        _renderBell();
        _closeDropdown();
      }
    } catch (e) {
      _showToast('Could not enable notifications.', 'error');
    }
  }

  // ── Disable push ─────────────────────────────────────────────────────
  async function _disableNotifications() {
    _setUserDisabled(true);
    // Remove FCM token from Firestore if app globals are available
    try {
      const user = window.currentUser || App?.currentUser;
      const _db = App && App.db ? App.db : (window.db || null);
      const _messaging = window.firebase?.messaging ? firebase.messaging() : null;
      if (user && _db && _messaging && typeof _messaging.getToken === 'function') {
        const token = await _messaging.getToken({ vapidKey: window.FCM_VAPID_KEY }).catch(() => null);
        if (token) {
          const tokenKey = token.replace(/[^a-zA-Z0-9]/g, '').slice(-120);
          await _db.collection('users').doc(user.uid).update({
            [`fcmTokens.${tokenKey}`]: firebase.firestore.FieldValue.delete(),
            notificationsEnabled: false
          }).catch(() => {});
        }
      }
    } catch (_) {}
    _renderBell();
    _closeDropdown();
    _showToast('Notifications turned off.', 'info');
  }

  // ── Toast helper (use app's if available) ────────────────────────────
  function _showToast(msg, type) { if (App && App.toast) App.toast(msg, type); else if (typeof showToast === 'function') showToast(msg, type); else if (window.__DEBUG__) console.log(`[NotifBell] ${type}: ${msg}`); }

  // ── Dropdown lifecycle ─────────────────────────────────────────────────
  function _openDropdown() {
    if (!_bellDropdown) return;
    _bellDropdown.innerHTML = _buildDropdown();
    _bellDropdown.classList.add('open');
    _dropdownOpen = true;
    // Bind action buttons
    const testBtn = document.getElementById('notifBellTestBtn');
    if (testBtn) testBtn.addEventListener('click', (e) => { e.stopPropagation(); _sendTestToSelf(); _closeDropdown(); });
    const enableBtn = document.getElementById('notifBellEnableBtn');
    if (enableBtn) enableBtn.addEventListener('click', (e) => { e.stopPropagation(); _enableNotifications(); });
    const disableBtn = document.getElementById('notifBellDisableBtn');
    if (disableBtn) disableBtn.addEventListener('click', (e) => { e.stopPropagation(); _disableNotifications(); });
    const refreshBtn = document.getElementById('notifBellRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', (e) => { e.stopPropagation(); location.reload(); });
  }

  function _closeDropdown() {
    if (!_bellDropdown) return;
    _bellDropdown.classList.remove('open');
    _dropdownOpen = false;
  }

  function _renderDropdown() {
    if (_dropdownOpen) { _closeDropdown(); }
    else { _openDropdown(); }
  }

  // ── Click-outside to close ────────────────────────────────────────────
  function _onDocClick(e) {
    if (_dropdownOpen && _bellBtn && !_bellBtn.contains(e.target) && _bellDropdown && !_bellDropdown.contains(e.target)) {
      _closeDropdown();
    }
  }

  // ── Create DOM ────────────────────────────────────────────────────────
  function _createBellButton() {
    const wrapper = document.createElement('div');
    wrapper.className = 'notif-bell-wrapper';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', 'Notification settings');

    const btn = document.createElement('button');
    btn.className = 'icon-btn notif-bell-btn';
    btn.id = 'notifBellBtn';
    btn.setAttribute('aria-label', 'Notification bell');
    btn.setAttribute('type', 'button');
    wrapper.appendChild(btn);

    const dropdown = document.createElement('div');
    dropdown.className = 'notif-bell-dropdown';
    dropdown.id = 'notifBellDropdown';
    dropdown.setAttribute('role', 'dialog');
    dropdown.setAttribute('aria-label', 'Notification settings panel');
    wrapper.appendChild(dropdown);

    return { wrapper, btn, dropdown };
  }

  // ── Init ─────────────────────────────────────────────────────────────
  function _init() {
    // Wait for sidebar-actions to exist
    const sidebarActions = document.querySelector('.sidebar-actions');
    if (!sidebarActions) {
      setTimeout(_init, 300);
      return;
    }

    // Avoid double-init
    if (document.getElementById('notifBellBtn')) return;

    const { wrapper, btn, dropdown } = _createBellButton();
    _bellBtn = btn;
    _bellDropdown = dropdown;

    // Insert before the first button in sidebar-actions (after installAppBtn, before scannerBtn)
    const scannerBtn = document.getElementById('scannerBtn');
    if (scannerBtn) {
      sidebarActions.insertBefore(wrapper, scannerBtn);
    } else {
      sidebarActions.insertBefore(wrapper, sidebarActions.firstChild);
    }

    _renderBell();

    // Click handler
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const state = _getState();
      if (state === 'unsupported') {
        _showToast('Push notifications are not supported in this browser.', 'error');
        return;
      }
      if (state === 'off' && _permission() === 'default') {
        // No dropdown — directly request permission
        _enableNotifications();
        return;
      }
      _renderDropdown();
    });

    // Close on outside click
    document.addEventListener('click', _onDocClick, true);

    // Re-check state when page becomes visible again (user may have changed browser settings)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        _renderBell();
        if (_dropdownOpen) { _closeDropdown(); _openDropdown(); }
      }
    });

    // Detect if user enabled notifications in browser settings while tab was hidden
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' }).then((status) => {
        status.addEventListener('change', () => {
          _renderBell();
          if (_dropdownOpen) { _closeDropdown(); _openDropdown(); }
        });
      }).catch(() => {});
    }
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    // DOM ready but sidebar may render after auth — retry
    _init();
    // Also watch for auth-gate removal (the sidebar is hidden until login)
    const authGate = document.getElementById('authGate');
    if (authGate) {
      const mo = new MutationObserver(() => {
        if (authGate.style.display === 'none' || !authGate.style.display || authGate.classList.contains('hidden')) {
          setTimeout(_init, 400);
          mo.disconnect();
        }
      });
      mo.observe(authGate, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    // Final safety net
    setTimeout(_init, 1500);
  }

  // Expose for debugging
  window._notifBell = { getState: _getState, renderBell: _renderBell };
})();
