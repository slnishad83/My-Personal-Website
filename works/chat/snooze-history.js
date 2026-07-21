// ============================================================
// SNOOZE HISTORY — tracks every snooze you set, shows a
// clock-icon panel in the Chat Requests header.
//
// Drop into works/chat/ and add to index.html <head>:
//   <script src="snooze-history.js" defer></script>
//
// No app.js changes required — works as a pure drop-in.
// ============================================================

(function () {
  'use strict';

  const STORAGE_PREFIX = 'snoozeHistory_';
  const MAX_ENTRIES    = 100;
  const BTN_ID         = 'snoozeHistoryBtn';
  const PANEL_ID       = 'snoozeHistoryPanel';

  // ── Storage helpers ───────────────────────────────────────────────────────

  function _uid() {
    try {
      const u = typeof currentUser !== 'undefined' ? currentUser
        : (typeof auth !== 'undefined' ? auth.currentUser : null);
      return u?.uid || 'anon';
    } catch (_) { return 'anon'; }
  }

  function _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_PREFIX + _uid()) || '[]');
    } catch (_) { return []; }
  }

  function _save(entries) {
    try {
      localStorage.setItem(STORAGE_PREFIX + _uid(), JSON.stringify(entries.slice(-MAX_ENTRIES)));
    } catch (_) {}
  }

  function _addEntry(reqId, displayName, snoozedAt, expiresAt) {
    const entries = _load();
    // Upsert: replace existing entry for same reqId if present
    const idx = entries.findIndex((e) => e.reqId === reqId);
    const entry = { reqId, displayName, snoozedAt, expiresAt };
    if (idx !== -1) entries.splice(idx, 1, entry);
    else entries.push(entry);
    _save(entries);
    _refreshPanel();
  }

  function _removeEntry(reqId) {
    const entries = _load().filter((e) => e.reqId !== reqId);
    _save(entries);
    _refreshPanel();
  }

  function _clearAll() {
    _save([]);
    _refreshPanel();
  }

  // ── Intercept snooze actions to log them ──────────────────────────────────

  // Capture display name from the request card that owns a given reqId
  function _getDisplayName(reqId) {
    const snoozeBtn = document.querySelector(`.snooze-request-btn[data-id="${CSS.escape(reqId)}"]`);
    if (!snoozeBtn) return reqId;
    const card = snoozeBtn.closest('.request-card');
    return card?.querySelector('.list-name')?.textContent?.trim() || reqId;
  }

  // Listen for preset snooze-option clicks (1h / 8h / 1d)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.snooze-option');
    if (!btn) return;
    const hours = parseFloat(btn.dataset.hours);
    if (!btn.dataset.id || hours <= 0) return;      // skip clear (-1) and custom
    const reqId   = btn.dataset.id;
    const name    = _getDisplayName(reqId);
    const now     = Date.now();
    const expires = now + hours * 3600 * 1000;
    // Log after a brief delay so Firestore write has started
    setTimeout(() => _addEntry(reqId, name, now, expires), 100);
  }, true);

  // Listen for the custom picker "Set snooze" save
  // snooze-enhancements.js fires a custom event after a successful save
  document.addEventListener('snoozeCustomSaved', (e) => {
    const { reqId, expiresAt } = e.detail || {};
    if (!reqId || !expiresAt) return;
    _addEntry(reqId, _getDisplayName(reqId), Date.now(), expiresAt);
  });

  // Also patch the custom picker button in snooze-enhancements.js if loaded
  // by monkey-patching openCustomPicker after DOMContentLoaded
  function _patchCustomPicker() {
    const orig = window.snoozeEnhancements?.openCustomPicker;
    if (!orig || window.snoozeEnhancements._historyPatched) return;
    window.snoozeEnhancements._historyPatched = true;
    window.snoozeEnhancements.openCustomPicker = function (reqId) {
      orig(reqId);
      // After the picker renders, wrap its "Set snooze" button
      setTimeout(() => {
        const picker = document.querySelector(`.snooze-custom-picker[data-req-id="${CSS.escape(reqId)}"]`);
        const setBtn = picker?.querySelector('.snooze-picker-set');
        if (!setBtn || setBtn._historyPatched) return;
        setBtn._historyPatched = true;
        setBtn.addEventListener('click', () => {
          const input = picker.querySelector('.snooze-picker-input');
          if (!input?.value) return;
          const expires = new Date(input.value).getTime();
          if (expires > Date.now()) {
            setTimeout(() => _addEntry(reqId, _getDisplayName(reqId), Date.now(), expires), 300);
          }
        }, true);
      }, 80);
    };
  }
  // Try patching after snooze-enhancements loads
  setTimeout(_patchCustomPicker, 1200);

  // ── Date formatting ───────────────────────────────────────────────────────

  function _relTime(ts) {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return 'just now';
  }

  function _fmtDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const isToday    = d.toDateString() === now.toDateString();
    const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday)    return `Today ${time}`;
    if (isTomorrow) return `Tomorrow ${time}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
  }

  // ── Panel HTML ────────────────────────────────────────────────────────────

  function _buildPanel() {
    const entries = _load().slice().reverse(); // newest first
    if (!entries.length) {
      return `<div class="sh-panel-inner">
        <div class="sh-panel-header">
          <span class="sh-panel-title">Snooze history</span>
        </div>
        <div class="sh-empty">No snooze history yet.<br>Snooze a request to see it here.</div>
      </div>`;
    }
    const rows = entries.map((e) => {
      const isExpired = e.expiresAt < Date.now();
      return `
        <div class="sh-row${isExpired ? ' sh-row--expired' : ''}">
          <div class="sh-row-info">
            <span class="sh-row-name">${_esc(e.displayName)}</span>
            <span class="sh-row-meta">
              Set ${_relTime(e.snoozedAt)}
              &nbsp;·&nbsp;
              ${isExpired ? '<span class="sh-expired-chip">Expired</span>' : ''}
              Until ${_fmtDate(e.expiresAt)}
            </span>
          </div>
          <button class="sh-remove-btn" data-req-id="${_esc(e.reqId)}" title="Remove from history">✕</button>
        </div>`;
    }).join('');

    return `<div class="sh-panel-inner">
      <div class="sh-panel-header">
        <span class="sh-panel-title">Snooze history</span>
        <button class="sh-clear-btn" id="shClearAllBtn" type="button">Clear all</button>
      </div>
      <div class="sh-list">${rows}</div>
    </div>`;
  }

  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  // ── Panel lifecycle ───────────────────────────────────────────────────────

  let _panelOpen = false;

  function _openPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    _refreshPanel();
    panel.classList.add('open');
    _panelOpen = true;
  }

  function _closePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.classList.remove('open');
    _panelOpen = false;
  }

  function _refreshPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.innerHTML = _buildPanel();
    panel.querySelector('#shClearAllBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      _clearAll();
    });
    panel.querySelectorAll('.sh-remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _removeEntry(btn.dataset.reqId);
      });
    });
    // Update badge
    _renderBadge();
  }

  function _togglePanel(e) {
    e.stopPropagation();
    _panelOpen ? _closePanel() : _openPanel();
  }

  document.addEventListener('click', (e) => {
    const btn   = document.getElementById(BTN_ID);
    const panel = document.getElementById(PANEL_ID);
    if (_panelOpen && btn && !btn.contains(e.target) && panel && !panel.contains(e.target)) {
      _closePanel();
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _panelOpen) _closePanel();
  });

  // ── Badge count ───────────────────────────────────────────────────────────

  function _renderBadge() {
    const badge = document.querySelector('.sh-badge');
    if (!badge) return;
    const count = _load().length;
    badge.textContent = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  // ── SVG clock icon ────────────────────────────────────────────────────────

  const SVG_CLOCK = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>`;

  // ── DOM injection ─────────────────────────────────────────────────────────

  function _inject() {
    if (document.getElementById(BTN_ID)) return;
    const requestToggle = document.getElementById('requestToggle');
    if (!requestToggle) { setTimeout(_inject, 300); return; }

    const wrapper = document.createElement('span');
    wrapper.className = 'sh-wrapper';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', 'Snooze history');

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.className = 'sh-btn';
    btn.setAttribute('aria-label', 'Snooze history');
    btn.setAttribute('title', 'View snooze history');
    btn.innerHTML = SVG_CLOCK + '<span class="sh-badge" style="display:none"></span>';

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'sh-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Snooze history panel');

    wrapper.appendChild(btn);
    wrapper.appendChild(panel);

    // Insert just before the ▼ toggle span (after the ⚙ gear from notification-prefs)
    requestToggle.parentNode.insertBefore(wrapper, requestToggle);

    btn.addEventListener('click', _togglePanel);
    _renderBadge();
  }

  function _boot() {
    _inject();
    const authGate = document.getElementById('authGate');
    if (authGate) {
      const mo = new MutationObserver(() => {
        const hidden = authGate.style.display === 'none' || authGate.classList.contains('hidden');
        if (hidden) { setTimeout(_inject, 400); mo.disconnect(); }
      });
      mo.observe(authGate, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    setTimeout(_inject, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

})();
