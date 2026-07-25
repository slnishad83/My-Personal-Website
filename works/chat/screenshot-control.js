// Screenshot Control — per-chat screenshot restriction
(function() {
  'use strict';

  const SS_RESTRICT_KEY = 'nsl_screenshot_restrictions';

  function _getRestrictions() {
    try { return JSON.parse(localStorage.getItem(SS_RESTRICT_KEY) || '{}'); } catch(_) { return {}; }
  }

  function _saveRestrictions(r) {
    localStorage.setItem(SS_RESTRICT_KEY, JSON.stringify(r));
    try {
      if (App.db && App.auth?.currentUser) {
        App.db.collection('users').doc(App.auth.currentUser.uid).update({ screenshotRestrictions: r }).catch(() => {});
      }
    } catch(_) {}
  }

  window.isScreenshotRestricted = function(chatId) {
    const r = _getRestrictions();
    return !!(r[chatId]);
  };

  window.setScreenshotRestriction = function(chatId, restricted) {
    const r = _getRestrictions();
    if (restricted) r[chatId] = { restricted: true, since: Date.now() };
    else delete r[chatId];
    _saveRestrictions(r);
    showToast(restricted ? 'Screenshots restricted in this chat' : 'Screenshots allowed in this chat', 'info');
  };

  window.toggleScreenshotRestriction = function(chatId) {
    setScreenshotRestriction(chatId, !isScreenshotRestricted(chatId));
  };

  let _ssWarningShown = false;
  let _ssListenersAttached = false;

  function _detectScreenshotAttempt() {
    if (_ssListenersAttached) return;
    _ssListenersAttached = true;

    document.addEventListener('keydown', (e) => {
      if (!App.currentChat) return;
      if (!isScreenshotRestricted(App.currentChat.id)) return;

      const isPrintScreen = e.key === 'PrintScreen';
      const isAltPrintScreen = e.key === 'PrintScreen' && e.altKey;
      const isCtrlShiftS = e.key === 'S' && e.ctrlKey && e.shiftKey;
      const isCtrlShiftSShortcut = e.key === 's' && e.ctrlKey && e.shiftKey;

      if (isPrintScreen || isAltPrintScreen || isCtrlShiftS || isCtrlShiftSShortcut) {
        e.preventDefault();
        e.stopPropagation();
        _showScreenshotWarning();
        return false;
      }
    }, true);

    document.addEventListener('keyup', (e) => {
      if (e.key === 'PrintScreen') {
        try { navigator.clipboard.writeText(''); } catch(_) {}
      }
    }, true);

    document.addEventListener('copy', (e) => {
      if (!App.currentChat) return;
      if (!isScreenshotRestricted(App.currentChat.id)) return;
      e.preventDefault();
      _showScreenshotWarning();
      return false;
    }, true);

    document.addEventListener('cut', (e) => {
      if (!App.currentChat) return;
      if (!isScreenshotRestricted(App.currentChat.id)) return;
      e.preventDefault();
      _showScreenshotWarning();
      return false;
    }, true);

    document.addEventListener('contextmenu', (e) => {
      if (!App.currentChat) return;
      if (!isScreenshotRestricted(App.currentChat.id)) return;
      e.preventDefault();
      _showScreenshotWarning();
      return false;
    }, true);

    const origToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function() {
      if (App.currentChat && isScreenshotRestricted(App.currentChat.id)) {
        _showScreenshotWarning();
        return;
      }
      return origToBlob.apply(this, arguments);
    };

    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      if (App.currentChat && isScreenshotRestricted(App.currentChat.id)) {
        _showScreenshotWarning();
        return 'data:,RESTRICTED';
      }
      return origToDataURL.apply(this, arguments);
    };

    const origGetUserMedia = navigator.mediaDevices?.getUserMedia;
    if (origGetUserMedia) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        if (App.currentChat && isScreenshotRestricted(App.currentChat.id)) {
          if (constraints?.video?.displaySurface || constraints?.video?.selfBrowserSurface) {
            _showScreenshotWarning();
            return Promise.reject(new Error('Screenshot restricted'));
          }
        }
        return origGetUserMedia.apply(this, arguments);
      };
    }
  }

  function _showScreenshotWarning() {
    if (_ssWarningShown) return;
    _ssWarningShown = true;
    setTimeout(() => { _ssWarningShown = false; }, 2000);

    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999;background:var(--error,#ef4444);color:white;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:fadeIn 0.2s ease';
    toast.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">screenshot</span> Screenshots are restricted in this chat';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);

    _logScreenshotAttempt();
  }

  function _logScreenshotAttempt() {
    if (!App.db || !App.auth?.currentUser || !App.currentChat) return;
    try {
      App.db.collection('screenshotAttempts').add({
        userId: App.auth.currentUser.uid,
        chatId: App.currentChat.id,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userAgent: navigator.userAgent,
      }).catch(() => {});
    } catch(_) {}
  }

  window.openScreenshotSettings = function(chatId) {
    const restricted = isScreenshotRestricted(chatId);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:380px;width:90vw;color:var(--on-surface)';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0;font-size:18px;font-weight:700">📸 Screenshot Settings</h3>
        <button onclick="this.closest('[style*=\"fixed\"]')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>
      <p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 16px">Control whether the other person can take screenshots in this chat. You can still take screenshots unless they restrict you too.</p>

      <div style="padding:16px;border-radius:14px;background:var(--surface-container-low,rgba(0,0,0,0.04));margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:14px;font-weight:600">Restrict Screenshots</div>
            <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px">${restricted ? 'Currently restricted' : 'Currently allowed'}</div>
          </div>
          <label style="position:relative;width:48px;height:26px;cursor:pointer">
            <input type="checkbox" ${restricted ? 'checked' : ''} onchange="toggleScreenshotRestriction('${chatId}');this.closest('[style*=\"fixed\"]')?.remove()" style="display:none">
            <div style="position:absolute;inset:0;border-radius:13px;background:${restricted ? 'var(--primary)' : 'var(--outline-variant,rgba(0,0,0,0.15))'};transition:background 0.2s">
              <div style="position:absolute;top:3px;left:${restricted ? '25px' : '3px'};width:20px;height:20px;border-radius:50%;background:white;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>
            </div>
          </label>
        </div>
      </div>

      <div style="padding:12px;border-radius:10px;background:var(--surface-container-low,rgba(0,0,0,0.04));font-size:12px;color:var(--on-surface-variant)">
        <strong>Note:</strong> On web, screenshot restrictions are best-effort. The other person will see a warning, but technical bypasses may exist. For maximum security, use the mobile app.
      </div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _detectScreenshotAttempt);
  } else {
    _detectScreenshotAttempt();
  }

  window._addScreenshotRestrictOption = function(menu, chatId) {
    const restricted = isScreenshotRestricted(chatId);
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;border:none;background:transparent;color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;width:100%;text-align:left;border-radius:0';
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${restricted ? 'photo_camera' : 'no_photography'}</span>${restricted ? 'Allow Screenshots' : 'Restrict Screenshots'}`;
    btn.onclick = () => { toggleScreenshotRestriction(chatId); _removeCtxMenu(); };
    const cancelBtn = menu.querySelector('[onclick*="_removeCtxMenu"]');
    if (cancelBtn) menu.insertBefore(btn, cancelBtn);
    else menu.appendChild(btn);
  };
})();
