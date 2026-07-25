// Ghost Mode — appear offline to everyone or specific contacts
(function() {
  'use strict';

  const GHOST_KEY = 'nsl_ghost_mode';
  const GHOST_CONTACTS_KEY = 'nsl_ghost_contacts';

  function _getGhostState() {
    try { return JSON.parse(localStorage.getItem(GHOST_KEY) || '{}'); } catch(_) { return {}; }
  }

  function _saveGhostState(state) {
    localStorage.setItem(GHOST_KEY, JSON.stringify(state));
    _syncGhostToFirestore(state);
  }

  async function _syncGhostToFirestore(state) {
    if (!App.db || !App.auth?.currentUser) return;
    try {
      await App.db.collection('users').doc(App.auth.currentUser.uid).update({
        ghostMode: state.enabled || false,
        ghostContacts: state.specificContacts || [],
        ghostUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch(_) {}
  }

  function _getGhostContacts() {
    try { return JSON.parse(localStorage.getItem(GHOST_CONTACTS_KEY) || '[]'); } catch(_) { return []; }
  }

  function _saveGhostContacts(list) {
    localStorage.setItem(GHOST_CONTACTS_KEY, JSON.stringify(list));
  }

  window.isGhostModeActive = function() {
    const state = _getGhostState();
    return !!(state.enabled);
  };

  window.isGhostForContact = function(uid) {
    const state = _getGhostState();
    if (!state.enabled) return false;
    if (!state.specificContacts || !state.specificContacts.length) return true;
    return state.specificContacts.includes(uid);
  };

  let _ghostOriginalSetOnline = null;

  function _interceptPresence() {
    if (typeof Presence === 'undefined' || !Presence.setOnline) return;

    if (!_ghostOriginalSetOnline) {
      _ghostOriginalSetOnline = Presence.setOnline.bind(Presence);
    }

    Presence.setOnline = function() {
      if (isGhostModeActive()) {
        _freezePresence();
        return;
      }
      return _ghostOriginalSetOnline();
    };

    if (Presence._startHeartbeat) {
      const origHeartbeat = Presence._startHeartbeat.bind(Presence);
      Presence._startHeartbeat = function() {
        if (isGhostModeActive()) {
          _freezePresence();
          return;
        }
        return origHeartbeat();
      };
    }
  }

  function _freezePresence() {
    if (!App.db || !App.auth?.currentUser) return;
    try {
      const frozenTime = _getGhostState().lastFrozenAt || Date.now();
      App.db.collection('users').doc(App.auth.currentUser.uid).update({
        onlineStatus: 'offline',
        lastSeen: frozenTime,
        lastHeartbeat: frozenTime,
      }).catch(() => {});
    } catch(_) {}
  }

  function _restorePresence() {
    if (_ghostOriginalSetOnline) {
      _ghostOriginalSetOnline();
    }
  }

  const _origSetOffline = Presence?.setOffline;
  function _patchOfflineForGhost() {
    if (typeof Presence === 'undefined') return;
    const orig = Presence.setOffline.bind(Presence);
    Presence.setOffline = function() {
      if (isGhostModeActive()) {
        _freezePresence();
        return;
      }
      return orig();
    };
  }

  window.toggleGhostMode = function(specificMode) {
    const state = _getGhostState();
    state.enabled = !state.enabled;
    if (specificMode === 'specific') {
      state.specificContacts = state.specificContacts || [];
    } else if (!specificMode) {
      state.specificContacts = [];
    }
    if (state.enabled) {
      state.lastFrozenAt = Date.now();
    } else {
      state.lastFrozenAt = null;
    }
    _saveGhostState(state);

    if (state.enabled) {
      _freezePresence();
      showToast('Ghost mode ON — you appear offline', 'success');
    } else {
      _restorePresence();
      showToast('Ghost mode OFF — you appear online', 'info');
    }

    if (typeof renderChatList === 'function') renderChatList();
  };

  window.setGhostForContacts = function(uids) {
    const state = _getGhostState();
    state.enabled = true;
    state.specificContacts = uids;
    _saveGhostState(state);
    _freezePresence();
    showToast('Ghost mode set for ' + uids.length + ' contact(s)', 'success');
  };

  window.toggleGhostForContact = function(uid) {
    const contacts = _getGhostContacts();
    const idx = contacts.indexOf(uid);
    if (idx >= 0) contacts.splice(idx, 1);
    else contacts.push(uid);

    if (contacts.length > 0) {
      setGhostForContacts(contacts);
    } else {
      const state = _getGhostState();
      state.enabled = false;
      state.specificContacts = [];
      _saveGhostState(state);
      _restorePresence();
      showToast('Ghost mode OFF', 'info');
    }
  };

  window.openGhostModeSettings = function() {
    const state = _getGhostState();
    const overlay = document.createElement('div');
    overlay.id = 'ghost-mode-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:420px;width:92vw;max-height:80vh;overflow-y:auto;color:var(--on-surface)';

    const ghostContacts = _getGhostContacts();

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:18px;font-weight:700">👻 Ghost Mode</h3>
        <button onclick="document.getElementById('ghost-mode-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>
      <p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 16px">Appear offline to others while still being able to use the app.</p>

      <div style="padding:16px;border-radius:14px;background:var(--surface-container-low,rgba(0,0,0,0.04));margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:14px;font-weight:600">Enable Ghost Mode</div>
            <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px">Appear offline to everyone</div>
          </div>
          <label style="position:relative;width:48px;height:26px;cursor:pointer">
            <input type="checkbox" ${state.enabled && !state.specificContacts?.length ? 'checked' : ''} onchange="toggleGhostMode()" style="display:none">
            <div style="position:absolute;inset:0;border-radius:13px;background:${state.enabled && !state.specificContacts?.length ? 'var(--primary)' : 'var(--outline-variant,rgba(0,0,0,0.15))'};transition:background 0.2s">
              <div style="position:absolute;top:3px;left:${state.enabled && !state.specificContacts?.length ? '25px' : '3px'};width:20px;height:20px;border-radius:50%;background:white;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>
            </div>
          </label>
        </div>
      </div>

      <div style="padding:16px;border-radius:14px;background:var(--surface-container-low,rgba(0,0,0,0.04));margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:14px;font-weight:600">Specific Contacts</div>
            <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px">Appear offline only to selected contacts (${ghostContacts.length} selected)</div>
          </div>
          <button onclick="_showGhostContactPicker()" style="padding:6px 12px;border-radius:8px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:600;cursor:pointer">Choose</button>
        </div>
      </div>

      <div style="padding:16px;border-radius:14px;background:var(--surface-container-low,rgba(0,0,0,0.04))">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:14px;font-weight:600">Status Override</div>
            <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px">Show a fake "last seen" time</div>
          </div>
          <button onclick="showToast('Last seen will show as ' + new Date(Date.now() - 3600000).toLocaleTimeString(), 'info')" style="padding:6px 12px;border-radius:8px;border:none;background:var(--outline-variant,rgba(0,0,0,0.08));color:var(--on-surface);font-size:12px;font-weight:600;cursor:pointer">1 hr ago</button>
        </div>
      </div>`;

    panel.innerHTML = html;
    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  window._showGhostContactPicker = function() {
    const overlay = document.getElementById('ghost-mode-overlay');
    if (overlay) overlay.style.display = 'none';

    const pickerOverlay = document.createElement('div');
    pickerOverlay.id = 'ghost-contact-picker';
    pickerOverlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:20px;max-width:400px;width:92vw;max-height:80vh;overflow-y:auto;color:var(--on-surface)';

    const selected = _getGhostContacts();
    const contacts = App.contacts || [];

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0;font-size:16px;font-weight:700">Select Contacts</h3>
        <button onclick="document.getElementById('ghost-contact-picker')?.remove();document.getElementById('ghost-mode-overlay')?.style.removeProperty('display')" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:18px">&times;</button>
      </div>`;

    contacts.forEach(c => {
      const isSelected = selected.includes(c.uid);
      const safeUid = escHtml(c.uid || '');
      html += `<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;margin-bottom:4px;background:${isSelected ? 'rgba(124,77,255,0.15)' : 'transparent'}" data-ghost-uid="${safeUid}">
        <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0">
          ${c.photoURL ? `<img src="${escHtml(c.photoURL)}" style="width:100%;height:100%;object-fit:cover" alt="">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--outline-variant,rgba(0,0,0,0.1));font-size:14px;font-weight:700">${escHtml(c.initials || '?')}</div>`}
        </div>
        <div style="flex:1"><div style="font-size:13px;font-weight:600">${escHtml(c.name)}</div><div style="font-size:11px;color:var(--on-surface-variant)">${escHtml(c.email || '')}</div></div>
        <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${isSelected ? 'var(--primary)' : 'var(--outline-variant,rgba(0,0,0,0.2))'};display:flex;align-items:center;justify-content:center;background:${isSelected ? 'var(--primary)' : 'transparent'}">
          ${isSelected ? '<span class="material-symbols-outlined" style="font-size:14px;color:white">check</span>' : ''}
        </div>
      </div>`;
    });

    if (!contacts.length) {
      html += '<p style="text-align:center;color:var(--on-surface-variant);font-size:13px;padding:16px 0">No contacts found</p>';
    }

    panel.innerHTML = html;
    pickerOverlay.appendChild(panel);
    panel.addEventListener('click', function(e) {
      var item = e.target.closest('[data-ghost-uid]');
      if (item) {
        _toggleGhostContact(item.getAttribute('data-ghost-uid'));
      }
    });
    pickerOverlay.addEventListener('click', e => { if (e.target === pickerOverlay) { pickerOverlay.remove(); overlay?.style.removeProperty('display'); } });
    document.body.appendChild(pickerOverlay);
  };

  window._toggleGhostContact = function(uid) {
    const contacts = _getGhostContacts();
    const idx = contacts.indexOf(uid);
    if (idx >= 0) contacts.splice(idx, 1);
    else contacts.push(uid);
    _saveGhostContacts(contacts);
    _showGhostContactPicker();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { _interceptPresence(); _patchOfflineForGhost(); });
  } else {
    _interceptPresence();
    _patchOfflineForGhost();
  }

  const origShowMsgContextMenu = window.showMsgContextMenu;
  if (typeof origShowMsgContextMenu === 'function') {
    window.showMsgContextMenu = function(e, msgId) {
      origShowMsgContextMenu(e, msgId);
    };
  }

  window._ghostModeCleanup = function() {
    if (_ghostOriginalSetOnline && typeof Presence !== 'undefined') {
      Presence.setOnline = _ghostOriginalSetOnline;
    }
    if (_origSetOffline && typeof Presence !== 'undefined') {
      Presence.setOffline = _origSetOffline;
    }
    if (origShowMsgContextMenu) {
      window.showMsgContextMenu = origShowMsgContextMenu;
    }
  };
})();
