// ============================================================
// NOTIFICATION PREFERENCES — Snoozed Request Display Toggle
//
// Drop this file into works/chat/ and add ONE line to index.html
// inside <head> (after notification-bell.js):
//
//   <script src="notification-prefs.js" defer></script>
//
// Then apply the ONE-LINE patch to app.js described at the bottom
// of this file (search for "APP.JS PATCH").
// ============================================================

(function () {
  'use strict';

  const PREF_KEY = 'chatSnoozeDisplayPref';   // 'dim' | 'hide'
  const BTN_ID   = 'snoozePrefBtn';
  const PANEL_ID = 'snoozePrefPanel';

  // ── Read / write pref ─────────────────────────────────────────────────────
  function getPref() {
    try { return localStorage.getItem(PREF_KEY) || 'dim'; } catch (_) { return 'dim'; }
  }
  function setPref(val) {
    try { localStorage.setItem(PREF_KEY, val); } catch (_) {}
  }

  // Expose for app.js to call
  window._notifPrefs = { getSnoozedDisplayPref: getPref };

  // ── DND / Quiet Hours ────────────────────────────────────────────────────
  const DND_STORAGE_KEY = 'nsl_dnd_settings';

  function getDndSettings() {
    try {
      return JSON.parse(localStorage.getItem(DND_STORAGE_KEY) || '{}');
    } catch (_) { return {}; }
  }

  function saveDndSettings(settings) {
    try {
      localStorage.setItem(DND_STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {}
    // Sync to Firestore
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      const uid = firebase.auth().currentUser.uid;
      if (firebase.firestore) {
        firebase.firestore().collection('users').doc(uid).set({
          dndSettings: {
            enabled: Boolean(settings.enabled),
            from: settings.from || null,
            to: settings.to || null,
            tzOffset: settings.tzOffset || new Date().getTimezoneOffset()
          }
        }, { merge: true }).catch(() => {});
      }
    }
    document.dispatchEvent(new CustomEvent('dndSettingsChanged', { detail: settings }));
  }

  function renderDndSettingsPanel() {
    const s = getDndSettings();
    const fromTime = s.from || '22:00';
    const toTime = s.to || '07:00';
    const enabled = Boolean(s.enabled);

    return `
      <div class="snz-pref-panel-inner" style="padding:12px;">
        <div class="snz-pref-title" style="margin-bottom:12px;">Do Not Disturb</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <span style="font-size:13px;color:var(--on-surface,#fff);">Quiet hours</span>
          <button id="dnd-toggle" class="toggle-track${enabled ? ' active' : ''}">
            <div class="toggle-knob"></div>
          </button>
        </div>
        <div id="dnd-time-settings" style="display:${enabled ? 'block' : 'none'};">
          <div style="display:flex;gap:12px;margin-bottom:12px;">
            <div style="flex:1;">
              <label style="font-size:11px;color:var(--on-surface-variant,#aaa);display:block;margin-bottom:4px;">From</label>
              <input type="time" id="dnd-from" value="${fromTime}" style="
                width:100%;padding:8px;border-radius:8px;border:1px solid var(--outline-variant,rgba(255,255,255,0.12));
                background:var(--surface-container,#2a2a3e);color:var(--on-surface,#fff);font-size:13px;
              ">
            </div>
            <div style="flex:1;">
              <label style="font-size:11px;color:var(--on-surface-variant,#aaa);display:block;margin-bottom:4px;">To</label>
              <input type="time" id="dnd-to" value="${toTime}" style="
                width:100%;padding:8px;border-radius:8px;border:1px solid var(--outline-variant,rgba(255,255,255,0.12));
                background:var(--surface-container,#2a2a3e);color:var(--on-surface,#fff);font-size:13px;
              ">
            </div>
          </div>
          <div style="font-size:11px;color:var(--on-surface-variant,#aaa);text-align:center;">
            Notifications silenced during quiet hours
          </div>
        </div>
      </div>`;
  }

  function initDndSettings() {
    const container = document.getElementById('notification-settings-container');
    if (!container) {
      setTimeout(initDndSettings, 500);
      return;
    }
    // Don't duplicate
    if (container.querySelector('#dnd-toggle')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'dnd-settings-section';
    wrapper.style.cssText = 'margin-top:12px;padding:0 4px;';
    wrapper.innerHTML = renderDndSettingsPanel();
    container.appendChild(wrapper);

    const toggle = wrapper.querySelector('#dnd-toggle');
    const timeSection = wrapper.querySelector('#dnd-time-settings');

    toggle.addEventListener('click', () => {
      const s = getDndSettings();
      s.enabled = !s.enabled;
      saveDndSettings(s);
      toggle.classList.toggle('active', s.enabled);
      timeSection.style.display = s.enabled ? 'block' : 'none';
    });

    const fromInput = wrapper.querySelector('#dnd-from');
    const toInput = wrapper.querySelector('#dnd-to');

    fromInput.addEventListener('change', () => {
      const s = getDndSettings();
      s.from = fromInput.value;
      s.tzOffset = new Date().getTimezoneOffset();
      saveDndSettings(s);
    });

    toInput.addEventListener('change', () => {
      const s = getDndSettings();
      s.to = toInput.value;
      s.tzOffset = new Date().getTimezoneOffset();
      saveDndSettings(s);
    });
  }

  // ── SVG gear icon ──────────────────────────────────────────────────────────
  const SVG_GEAR = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06
      a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09
      A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83
      l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
      A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83
      l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
      a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83
      l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
      a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`;

  // ── Build panel HTML ──────────────────────────────────────────────────────
  function buildPanel() {
    const pref = getPref();
    return `
      <div class="snz-pref-panel-inner">
        <div class="snz-pref-title">Snoozed request display</div>
        <label class="snz-pref-option${pref === 'dim' ? ' selected' : ''}" data-val="dim">
          <span class="snz-pref-radio${pref === 'dim' ? ' checked' : ''}"></span>
          <span class="snz-pref-option-body">
            <span class="snz-pref-option-label">Show dimmed</span>
            <span class="snz-pref-option-desc">Snoozed requests stay visible in the list, faded out</span>
          </span>
        </label>
        <label class="snz-pref-option${pref === 'hide' ? ' selected' : ''}" data-val="hide">
          <span class="snz-pref-radio${pref === 'hide' ? ' checked' : ''}"></span>
          <span class="snz-pref-option-body">
            <span class="snz-pref-option-label">Hide until expires</span>
            <span class="snz-pref-option-desc">Snoozed requests disappear and reappear when the snooze ends</span>
          </span>
        </label>
      </div>`;
  }

  // ── Refresh the request list in app.js ───────────────────────────────────
  function refreshRequests() {
    if (typeof loadReceivedRequests === 'function') {
      loadReceivedRequests();
    } else {
      document.dispatchEvent(new CustomEvent('snoozePrefChanged'));
    }
  }

  // ── Toggle panel open/close ───────────────────────────────────────────────
  let _panelOpen = false;

  function openPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.innerHTML = buildPanel();
    panel.classList.add('open');
    _panelOpen = true;
    panel.querySelectorAll('.snz-pref-option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.val;
        if (getPref() === val) { closePanel(); return; }
        setPref(val);
        closePanel();
        refreshRequests();
      });
    });
  }

  function closePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.classList.remove('open');
    _panelOpen = false;
  }

  function togglePanel(e) {
    e.stopPropagation();
    _panelOpen ? closePanel() : openPanel();
  }

  // ── Click-outside to close ────────────────────────────────────────────────
  function onDocClick(e) {
    const btn   = document.getElementById(BTN_ID);
    const panel = document.getElementById(PANEL_ID);
    if (_panelOpen && btn && !btn.contains(e.target) && panel && !panel.contains(e.target)) {
      closePanel();
    }
  }

  // ── Inject button + panel into request-header ────────────────────────────
  var _injectRetries = 0;
  function inject() {
    if (document.getElementById(BTN_ID)) return; // already injected

    const requestToggleSpan = document.getElementById('requestToggle');
    if (!requestToggleSpan) {
      _injectRetries++;
      if (_injectRetries < 20) setTimeout(inject, 300);
      return;
    }

    const wrapper = document.createElement('span');
    wrapper.className = 'snz-pref-wrapper';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', 'Notification display preferences');

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.className = 'snz-pref-btn';
    btn.setAttribute('aria-label', 'Notification display preferences');
    btn.setAttribute('title', 'Snoozed request display preference');
    btn.innerHTML = SVG_GEAR;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'snz-pref-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Snoozed display preferences');

    wrapper.appendChild(btn);
    wrapper.appendChild(panel);

    // Insert just before the ▼ toggle span
    requestToggleSpan.parentNode.insertBefore(wrapper, requestToggleSpan);

    btn.addEventListener('click', togglePanel);
    document.addEventListener('click', onDocClick, true);
  }

  // Hydrate DND settings from Firestore so quiet-hours follow the user across
  // devices/locations (server is source of truth, local is a cache).
  function hydrateDndFromFirestore() {
    try {
      if (typeof firebase === 'undefined' || !firebase.firestore || !firebase.auth) return;
      const user = firebase.auth().currentUser;
      if (!user) return;
      firebase.firestore().collection('users').doc(user.uid).get().then((snap) => {
        if (!snap.exists) return;
        const data = snap.data() || {};
        if (data.dndSettings) {
          const local = getDndSettings();
          const remote = data.dndSettings;
          const changed =
            Boolean(local.enabled) !== Boolean(remote.enabled) ||
            local.from !== remote.from ||
            local.to !== remote.to;
          if (changed) {
            try { localStorage.setItem(DND_STORAGE_KEY, JSON.stringify({
              enabled: Boolean(remote.enabled),
              from: remote.from || '22:00',
              to: remote.to || '07:00',
              tzOffset: remote.tzOffset != null ? remote.tzOffset : new Date().getTimezoneOffset()
            })); } catch (_) {}
            document.dispatchEvent(new CustomEvent('dndSettingsChanged', { detail: remote }));
          }
        }
      }).catch(() => {});
    } catch (_) {}
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function boot() {
    inject();
    initDndSettings();
    hydrateDndFromFirestore();
    setTimeout(hydrateDndFromFirestore, 1500);
    // Also watch for the auth gate closing (sidebar hidden until login)
    const authGate = document.getElementById('authGate');
    if (authGate) {
      const mo = new MutationObserver(() => {
        const hidden =
          authGate.style.display === 'none' ||
          authGate.classList.contains('hidden') ||
          authGate.style.visibility === 'hidden';
        if (hidden) { setTimeout(inject, 400); setTimeout(initDndSettings, 500); mo.disconnect(); }
      });
      mo.observe(authGate, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    setTimeout(inject, 1500); // safety net
    setTimeout(initDndSettings, 2000); // safety net for DND
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

// ============================================================
// APP.JS PATCH — ONE LINE CHANGE
//
// In works/chat/app.js, inside the for-loop of loadReceivedRequests()
// (around the line that reads: const isSnoozed = ...)
//
// FIND this block (around line 7416):
//
//   const isSnoozed = !isOutgoing && activeSnoozedIds.has(req.id);
//
// ADD these two lines immediately after it:
//
//   if (isSnoozed && window._notifPrefs?.getSnoozedDisplayPref() === 'hide') continue;
//
// That's the only change needed in app.js.
// The full context looks like:
//
//   const isSnoozed = !isOutgoing && activeSnoozedIds.has(req.id);
//   if (isSnoozed && window._notifPrefs?.getSnoozedDisplayPref() === 'hide') continue;  // <-- ADD THIS
//   const snoozeExpiryMs = isSnoozed ? cachedSnoozes[req.id] : null;
//
// ============================================================
