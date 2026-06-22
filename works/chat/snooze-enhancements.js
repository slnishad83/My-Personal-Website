// ============================================================
// SNOOZE ENHANCEMENTS
//   1. Custom date+time picker option in every snooze menu
//   2. Live countdown on every snoozed card (updates every 30 s)
//
// Drop into works/chat/ and add to index.html <head>:
//   <script src="snooze-enhancements.js" defer></script>
//
// Requires the app.js patches described at the bottom of this file.
// ============================================================

(function () {
  'use strict';

  // ── Countdown helpers ─────────────────────────────────────────────────────

  function formatCountdown(remainingMs) {
    if (remainingMs <= 0) return 'expired';
    const totalSec = Math.floor(remainingMs / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  }

  function refreshCountdowns() {
    const now = Date.now();
    document.querySelectorAll('.snooze-countdown[data-expiry]').forEach((el) => {
      const expiry = parseInt(el.dataset.expiry, 10);
      if (!expiry) return;
      const remaining = expiry - now;
      el.textContent = remaining > 0
        ? `· ${formatCountdown(remaining)} left`
        : '· expired';
      el.classList.toggle('snooze-countdown--expiring', remaining > 0 && remaining < 3600000); // < 1 h
      el.classList.toggle('snooze-countdown--expired', remaining <= 0);
    });
  }

  // Tick every 30 s, plus immediately
  refreshCountdowns();
  setInterval(refreshCountdowns, 30000);

  // Also refresh whenever the request list re-renders (new cards added)
  const _listObserver = new MutationObserver(refreshCountdowns);
  function _attachListObserver() {
    const list = document.getElementById('requestList');
    if (list) {
      _listObserver.observe(list, { childList: true, subtree: true });
    } else {
      setTimeout(_attachListObserver, 500);
    }
  }
  _attachListObserver();

  // ── Custom picker state ────────────────────────────────────────────────────
  let _activePickerReqId = null;
  let _pickerEl = null;

  function _destroyPicker() {
    if (_pickerEl) { _pickerEl.remove(); _pickerEl = null; }
    _activePickerReqId = null;
  }

  // ── Build the custom picker element ───────────────────────────────────────
  function _buildPicker(reqId) {
    const wrap = document.createElement('div');
    wrap.className = 'snooze-custom-picker';
    wrap.dataset.reqId = reqId;

    // Default: now + 3 hours, rounded to next 15-min slot
    const def = new Date(Date.now() + 3 * 3600 * 1000);
    def.setMinutes(Math.ceil(def.getMinutes() / 15) * 15, 0, 0);
    const toLocal = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const minVal = toLocal(new Date(Date.now() + 60000)); // min = now + 1 min

    wrap.innerHTML = `
      <div class="snooze-picker-label">Snooze until</div>
      <input
        class="snooze-picker-input"
        type="datetime-local"
        value="${toLocal(def)}"
        min="${minVal}"
      />
      <div class="snooze-picker-actions">
        <button class="snooze-picker-cancel" type="button">Cancel</button>
        <button class="snooze-picker-set" type="button">Set snooze</button>
      </div>`;

    wrap.querySelector('.snooze-picker-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      _destroyPicker();
    });

    wrap.querySelector('.snooze-picker-set').addEventListener('click', async (e) => {
      e.stopPropagation();
      const input = wrap.querySelector('.snooze-picker-input');
      const chosen = new Date(input.value);
      if (!input.value || isNaN(chosen.getTime())) {
        input.classList.add('snooze-picker-input--error');
        input.setCustomValidity('Please pick a valid date and time');
        input.reportValidity();
        return;
      }
      if (chosen.getTime() <= Date.now() + 60000) {
        input.classList.add('snooze-picker-input--error');
        input.setCustomValidity('Snooze time must be at least 1 minute from now');
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      input.classList.remove('snooze-picker-input--error');

      const setBtn = wrap.querySelector('.snooze-picker-set');
      setBtn.disabled = true;
      setBtn.textContent = 'Saving…';

      try {
        const expiryMs = chosen.getTime();
        // Use globals from app.js
        const _db = typeof db !== 'undefined' ? db : null;
        const _user = typeof currentUser !== 'undefined' ? currentUser
          : (typeof auth !== 'undefined' ? auth.currentUser : null);
        if (!_db || !_user) throw new Error('Firebase not ready');

        await _db.collection('chatRequestsSnooze').doc(_user.uid).set(
          { snoozes: { [reqId]: expiryMs } },
          { merge: true },
        );
        _destroyPicker();
      } catch (err) {
        setBtn.disabled = false;
        setBtn.textContent = 'Set snooze';
        if (typeof showToast === 'function') {
          showToast('Could not set custom snooze. Try again.', 'error');
        }
      }
    });

    return wrap;
  }

  // ── Open the picker anchored below a snooze menu ───────────────────────────
  function openCustomPicker(reqId) {
    _destroyPicker();
    _activePickerReqId = reqId;

    const menu = document.getElementById(`snooze-menu-${reqId}`);
    if (!menu) return;

    // Close the dropdown menu itself before showing picker
    menu.style.display = 'none';

    _pickerEl = _buildPicker(reqId);

    // Attach picker to the snooze-wrapper that contains this menu
    const wrapper = menu.closest('.snooze-wrapper') || menu.parentNode;
    wrapper.style.position = 'relative';
    wrapper.appendChild(_pickerEl);

    // Focus the input
    setTimeout(() => _pickerEl?.querySelector('.snooze-picker-input')?.focus(), 50);
  }

  // Expose for app.js to call and for the event handler below
  window.snoozeEnhancements = { openCustomPicker, refreshCountdowns };

  // ── Event delegation: handle custom-btn clicks ────────────────────────────
  // (Works even if app.js patch is not applied — MutationObserver injects
  //  the custom button into every snooze menu as it appears.)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.snooze-custom-btn');
    if (!btn) return;
    e.stopPropagation();
    const reqId = btn.dataset.id;
    if (reqId) openCustomPicker(reqId);
  }, true);

  // Close custom picker on outside click
  document.addEventListener('click', (e) => {
    if (_pickerEl && !_pickerEl.contains(e.target) && !e.target.closest('.snooze-custom-btn')) {
      _destroyPicker();
    }
  });

  // Escape key closes picker
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _pickerEl) _destroyPicker();
  });

  // ── MutationObserver: inject "Custom time…" into snooze menus ─────────────
  // This handles menus that already exist AND new ones added dynamically.
  // If the app.js patch is applied, the button is already in the HTML and
  // this observer simply skips menus that already have it.
  function _injectCustomBtn(menu) {
    if (menu.querySelector('.snooze-custom-btn')) return; // already present
    const reqId = menu.id?.replace('snooze-menu-', '');
    if (!reqId) return;
    const btn = document.createElement('button');
    btn.className = 'snooze-option snooze-custom-btn';
    btn.dataset.id = reqId;
    btn.dataset.hours = '-1';
    btn.textContent = '🗓 Custom time…';
    // Insert before the clear button (last child) or append
    const clearBtn = menu.querySelector('.snooze-clear');
    if (clearBtn) menu.insertBefore(btn, clearBtn);
    else menu.appendChild(btn);
  }

  const _menuObserver = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.classList?.contains('snooze-menu')) _injectCustomBtn(node);
        node.querySelectorAll?.('.snooze-menu').forEach(_injectCustomBtn);
      });
    });
  });
  _menuObserver.observe(document.body, { childList: true, subtree: true });
  // Also handle menus already in the DOM at init time
  document.querySelectorAll('.snooze-menu').forEach(_injectCustomBtn);

})();

// ============================================================
// APP.JS PATCHES — apply these 3 changes in works/chat/app.js
//
// PATCH 1 — snooze label (add data-expiry + countdown span)
// Find:
//   const snoozePreviewLabel = isSnoozed
//     ? ` <span class="snooze-label">· ⏰ Until ${escapeHtml(snoozeUntilLabel)}</span>`
//     : "";
// Replace with:
//   const snoozePreviewLabel = isSnoozed
//     ? ` <span class="snooze-label">· ⏰ Until ${escapeHtml(snoozeUntilLabel)} <span class="snooze-countdown" data-expiry="${snoozeExpiryMs}"></span></span>`
//     : "";
//
// PATCH 2 — snooze menu (add Custom time… button)
// Find:
//               <button class="snooze-option" data-id="${req.id}" data-hours="24">1 day</button>
//               ${snoozeClearBtn}
// Replace with:
//               <button class="snooze-option" data-id="${req.id}" data-hours="24">1 day</button>
//               <button class="snooze-option snooze-custom-btn" data-id="${req.id}" data-hours="-1">🗓 Custom time…</button>
//               ${snoozeClearBtn}
//
// PATCH 3 — snooze-option click handler (skip hours === -1)
// Find:
//         const snoozeDocRef = db.collection("chatRequestsSnooze").doc(currentUser.uid);
//         try {
//           if (hours === 0) {
// Replace with:
//         if (hours === -1) { if (typeof window.snoozeEnhancements?.openCustomPicker === 'function') window.snoozeEnhancements.openCustomPicker(reqId); return; }
//         const snoozeDocRef = db.collection("chatRequestsSnooze").doc(currentUser.uid);
//         try {
//           if (hours === 0) {
// ============================================================
