// ============================================================
// REQUEST PRIORITY + AUTO-DECLINE
//
// 1. Priority labels (🔴 High / 🟡 Normal / 🟢 Low) on each
//    incoming request card — stored in Firestore.
// 2. Filter bar (All / High / Normal / Low) above the list.
// 3. Auto-decline: configurable threshold (7 / 14 / 30 days).
//    Runs whenever the request list renders.
//
// Drop into works/chat/ and add to index.html:
//   <script src="request-priority.js" defer></script>
//
// Requires ONE app.js patch described at the bottom.
// ============================================================

(function () {
  'use strict';

  const COLLECTION      = 'chatRequestPriority';
  const AD_KEY          = 'reqAutoDecline';      // localStorage
  const FILTER_KEY      = 'reqPriorityFilter';
  let _priorities       = {};   // { reqId: 'high'|'normal'|'low' }
  let _activeFilter     = 'all';
  let _adEnabled        = false;
  let _adDays           = 14;
  let _unsubPriority    = null;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _uid() {
    return (typeof currentUser !== 'undefined' ? currentUser : auth?.currentUser)?.uid || null;
  }
  function _db()  { return typeof db !== 'undefined' ? db : null; }
  function _esc(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  const PRIORITY_CFG = {
    high:   { label: 'High',   icon: '🔴', cls: 'rp-high' },
    normal: { label: 'Normal', icon: '🟡', cls: 'rp-normal' },
    low:    { label: 'Low',    icon: '🟢', cls: 'rp-low' },
  };

  // ── Persist preferences ───────────────────────────────────────────────────

  function _loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(AD_KEY) || '{}');
      _adEnabled = !!p.enabled;
      _adDays    = Number(p.days) || 14;
      _activeFilter = localStorage.getItem(FILTER_KEY) || 'all';
    } catch (_) {}
  }

  function _savePrefs() {
    try {
      localStorage.setItem(AD_KEY, JSON.stringify({ enabled: _adEnabled, days: _adDays }));
      localStorage.setItem(FILTER_KEY, _activeFilter);
    } catch (_) {}
  }

  // ── Firestore sync ────────────────────────────────────────────────────────

  function _subscribe() {
    const uid = _uid(); const database = _db();
    if (!uid || !database) { setTimeout(_subscribe, 1000); return; }
    if (_unsubPriority) _unsubPriority();
    _unsubPriority = database.collection(COLLECTION).doc(uid)
      .onSnapshot(snap => {
        _priorities = snap.exists ? (snap.data()?.priorities || {}) : {};
        _refreshAll();
      }, () => {});
  }

  async function _setPriority(reqId, level) {
    const uid = _uid(); const database = _db();
    if (!uid || !database) return;
    if (level === 'none') {
      _priorities = { ..._priorities };
      delete _priorities[reqId];
    } else {
      _priorities = { ..._priorities, [reqId]: level };
    }
    _refreshAll();
    try {
      await database.collection(COLLECTION).doc(uid).set(
        { priorities: { [reqId]: level === 'none' ? firebase.firestore.FieldValue.delete() : level } },
        { merge: true }
      );
    } catch (_) {}
  }

  // ── Auto-decline ──────────────────────────────────────────────────────────

  async function _runAutoDecline() {
    if (!_adEnabled) return;
    const uid = _uid(); const database = _db();
    if (!uid || !database) return;

    const thresholdMs = _adDays * 24 * 3600 * 1000;
    const now = Date.now();
    const cards = document.querySelectorAll('#requestList .request-card[data-req-created]');
    const old = [...cards].filter(c => {
      const created = parseInt(c.dataset.reqCreated, 10);
      return created > 0 && (now - created) > thresholdMs;
    });
    if (!old.length) return;

    let declined = 0;
    for (const card of old) {
      const reqId = card.dataset.reqId || card.dataset.rpReqId;
      if (!reqId) continue;
      try {
        await database.collection('chatRequests').doc(reqId).update({
          status: 'declined',
          declinedAt: firebase.firestore.FieldValue.serverTimestamp(),
          declinedBy: uid,
          declineReason: 'auto-decline'
        });
        card.style.display = 'none';
        declined++;
        await new Promise(r => setTimeout(r, 200));
      } catch (_) {}
    }
    if (declined > 0 && typeof showToast === 'function') {
      showToast('Auto-declined ' + declined + ' request' + (declined > 1 ? 's' : '') + ' older than ' + _adDays + ' days', 'info');
    }
  }

  // ── Inject priority badge + picker into a card ────────────────────────────

  function _injectCard(card) {
    if (card.dataset.rpInjected) return;
    card.dataset.rpInjected = '1';

    const reqId = card.querySelector('[data-id]')?.dataset.id;
    if (!reqId) return;

    // Don't show on outgoing cards
    if (card.querySelector('.cancel-request-btn')) return;

    card.dataset.rpReqId = reqId;

    // Badge
    const badge = document.createElement('button');
    badge.className = 'rp-badge';
    badge.type = 'button';
    badge.dataset.reqId = reqId;
    badge.setAttribute('aria-label', 'Set priority');
    _updateBadge(badge, reqId);

    // Picker popover
    const picker = document.createElement('div');
    picker.className = 'rp-picker';
    picker.id = `rp-picker-${reqId}`;
    picker.setAttribute('role', 'menu');
    picker.style.display = 'none';
    picker.innerHTML = `
      <div class="rp-picker-title">Set priority</div>
      ${['high','normal','low','none'].map(l => `
        <button class="rp-picker-opt${l === 'none' ? ' rp-none' : ''}" data-level="${l}" data-req-id="${reqId}" type="button">
          ${l === 'none' ? '✕ Remove' : PRIORITY_CFG[l].icon + ' ' + PRIORITY_CFG[l].label}
        </button>`).join('')}`;

    const wrap = document.createElement('span');
    wrap.className = 'rp-wrapper';
    wrap.style.position = 'relative';
    wrap.appendChild(badge);
    wrap.appendChild(picker);

    // Insert before the list-info or at start of actions
    const listInfo = card.querySelector('.list-info');
    if (listInfo) card.insertBefore(wrap, listInfo);
    else card.querySelector('.request-actions')?.prepend(wrap);

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.rp-picker').forEach(p => { if (p !== picker) p.style.display = 'none'; });
      picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    });

    picker.querySelectorAll('.rp-picker-opt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        picker.style.display = 'none';
        _setPriority(btn.dataset.reqId, btn.dataset.level);
      });
    });
  }

  function _updateBadge(badge, reqId) {
    const level = _priorities[reqId];
    if (level && PRIORITY_CFG[level]) {
      const cfg = PRIORITY_CFG[level];
      badge.textContent = cfg.icon;
      badge.title = `Priority: ${cfg.label} — click to change`;
      badge.className = `rp-badge rp-badge--set ${cfg.cls}`;
    } else {
      badge.textContent = '⚑';
      badge.title = 'Set priority';
      badge.className = 'rp-badge';
    }
  }

  // ── Refresh all badges and apply filter ───────────────────────────────────

  function _refreshAll() {
    document.querySelectorAll('#requestList .request-card').forEach(card => {
      const reqId = card.dataset.rpReqId;
      if (!reqId) return;
      const badge = card.querySelector(`.rp-badge[data-req-id="${reqId}"]`);
      if (badge) _updateBadge(badge, reqId);
      _applyFilterToCard(card);
    });
    _updateFilterBar();
  }

  function _applyFilterToCard(card) {
    if (_activeFilter === 'all') { card.style.display = ''; return; }
    const reqId   = card.dataset.rpReqId;
    const level   = _priorities[reqId] || 'normal';
    card.style.display = (level === _activeFilter) ? '' : 'none';
  }

  // ── Filter bar ────────────────────────────────────────────────────────────

  function _injectFilterBar() {
    if (document.getElementById('rpFilterBar')) return;
    const requestList = document.getElementById('requestList');
    if (!requestList) return;

    const bar = document.createElement('div');
    bar.id = 'rpFilterBar';
    bar.className = 'rp-filter-bar';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Filter by priority');

    ['all','high','normal','low'].forEach(level => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `rp-filter-btn${_activeFilter === level ? ' active' : ''}`;
      btn.dataset.level = level;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(_activeFilter === level));
      btn.innerHTML = level === 'all'
        ? 'All'
        : `${PRIORITY_CFG[level].icon} ${PRIORITY_CFG[level].label}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _activeFilter = level;
        _savePrefs();
        _updateFilterBar();
        _refreshAll();
      });
      bar.appendChild(btn);
    });

    // Auto-decline toggle button
    const adBtn = document.createElement('button');
    adBtn.id = 'rpAutoDeclineBtn';
    adBtn.type = 'button';
    adBtn.className = `rp-filter-btn rp-ad-btn${_adEnabled ? ' active' : ''}`;
    adBtn.title = `Auto-decline requests older than ${_adDays} days`;
    adBtn.innerHTML = `⏳ Auto-decline`;
    adBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _showAdSettings(adBtn);
    });
    bar.appendChild(adBtn);

    requestList.parentNode.insertBefore(bar, requestList);
  }

  function _updateFilterBar() {
    document.querySelectorAll('.rp-filter-btn[data-level]').forEach(btn => {
      const active = btn.dataset.level === _activeFilter;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    const adBtn = document.getElementById('rpAutoDeclineBtn');
    if (adBtn) {
      adBtn.classList.toggle('active', _adEnabled);
      adBtn.title = `Auto-decline requests older than ${_adDays} days (${_adEnabled ? 'ON' : 'OFF'})`;
    }
  }

  // ── Auto-decline settings popover ────────────────────────────────────────

  let _adPanel = null;

  function _showAdSettings(anchor) {
    if (_adPanel) { _adPanel.remove(); _adPanel = null; return; }

    const panel = document.createElement('div');
    panel.className = 'rp-ad-panel';
    panel.innerHTML = `
      <div class="rp-ad-title">Auto-decline old requests</div>
      <label class="rp-ad-toggle">
        <input type="checkbox" id="rpAdToggle"${_adEnabled ? ' checked' : ''}>
        <span>Enable auto-decline</span>
      </label>
      <div class="rp-ad-days" id="rpAdDaysRow" style="${_adEnabled ? '' : 'opacity:0.4;pointer-events:none'}">
        <span>Decline after</span>
        <select id="rpAdDaysSel">
          ${[7,14,30,60].map(d => `<option value="${d}"${_adDays===d?' selected':''}>${d} days</option>`).join('')}
        </select>
      </div>
      <button class="rp-ad-run" id="rpAdRunNow" type="button">Run now</button>`;

    _adPanel = panel;
    anchor.parentNode?.appendChild(panel);

    panel.querySelector('#rpAdToggle').addEventListener('change', (e) => {
      _adEnabled = e.target.checked;
      _savePrefs();
      _updateFilterBar();
      panel.querySelector('#rpAdDaysRow').style.cssText =
        _adEnabled ? '' : 'opacity:0.4;pointer-events:none';
    });
    panel.querySelector('#rpAdDaysSel').addEventListener('change', (e) => {
      _adDays = parseInt(e.target.value, 10);
      _savePrefs();
    });
    panel.querySelector('#rpAdRunNow').addEventListener('click', (e) => {
      e.stopPropagation();
      _runAutoDecline();
      panel.remove(); _adPanel = null;
    });

    document.addEventListener('click', function closePanel(ev) {
      if (!panel.contains(ev.target) && ev.target !== anchor) {
        panel.remove(); _adPanel = null;
        document.removeEventListener('click', closePanel, true);
      }
    }, true);
  }

  // ── MutationObserver ──────────────────────────────────────────────────────

  function _observe() {
    const list = document.getElementById('requestList');
    if (!list) { setTimeout(_observe, 500); return; }

    _injectFilterBar();

    new MutationObserver(() => {
      document.querySelectorAll('#requestList .request-card:not([data-rp-injected])').forEach(_injectCard);
      _refreshAll();
      _runAutoDecline();
    }).observe(list, { childList: true, subtree: false });

    // Handle existing cards
    document.querySelectorAll('#requestList .request-card').forEach(_injectCard);
    _refreshAll();
  }

  // Close pickers on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.rp-picker').forEach(p => p.style.display = 'none');
  });

  // ── Boot ─────────────────────────────────────────────────────────────────

  _loadPrefs();
  var _booted = false;

  function _boot() {
    if (_booted) return;
    _booted = true;
    _observe();
    _subscribe();
  }

  // Wait for auth
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(function (user) {
      if (user && !_booted) { setTimeout(_boot, 500); }
    });
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_boot, 800); });
  } else {
    setTimeout(_boot, 800);
  }

})();

// ============================================================
// APP.JS PATCH — add data-req-created to reqDiv
//
// FIND (around line 7446 after our previous patches):
//   reqDiv.className =
//     "list-item request-card" +
//     (isRead ? " request-card--read" : "") +
//     (isSnoozed ? " request-card--snoozed" : "");
//
// ADD these two lines immediately after it:
//   reqDiv.dataset.reqCreated = req.createdAt?.toMillis?.() || 0;
//   reqDiv.dataset.reqId = req.id;
// ============================================================
