/* ============================================================
   CHANGE NUMBER — WhatsApp-style phone number migration
   ============================================================ */
(function () {
  'use strict';

  function _buildUI() {
    var overlay = document.createElement('div');
    overlay.id = 'change-number-overlay';
    overlay.className = 'overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Change Number');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:50;display:none;';
    overlay.innerHTML = '<div class="bg-surface-container w-full max-w-md rounded-2xl p-0 shadow-2xl overflow-hidden">' +
      '<div class="px-5 pt-5 pb-3 border-b border-outline-variant/20">' +
      '<div class="flex items-center gap-3 mb-3">' +
      '<button class="p-2 rounded-full hover:bg-surface-container-high transition-colors" id="cn-back-btn">' +
      '<span class="material-symbols-outlined">arrow_back</span></button>' +
      '<h3 class="font-headline-md text-headline-md font-bold text-on-surface">Change Number</h3></div>' +
      '<p class="text-xs text-on-surface-variant leading-relaxed">Changing your phone number will migrate your account info, groups, and settings to the new number.</p>' +
      '</div>' +
      '<div class="p-5 space-y-4">' +
      '<div class="space-y-1">' +
      '<label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Current Number</label>' +
      '<input type="tel" id="cn-old-number" placeholder="+1234567890" class="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors">' +
      '</div>' +
      '<div class="space-y-1">' +
      '<label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider">New Number</label>' +
      '<input type="tel" id="cn-new-number" placeholder="+0987654321" class="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors">' +
      '</div>' +
      '<div class="space-y-1">' +
      '<label class="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Confirm New Number</label>' +
      '<input type="tel" id="cn-confirm-number" placeholder="+0987654321" class="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors">' +
      '</div>' +
      '<p class="text-[11px] text-on-surface-variant/70">Please make sure both numbers can receive SMS or calls for verification.</p>' +
      '</div>' +
      '<div class="px-5 pb-5 flex gap-3">' +
      '<button class="flex-1 py-3 rounded-xl border border-outline-variant/30 text-on-surface-variant text-sm font-bold hover:bg-surface-container-high transition-colors" id="cn-cancel-btn">Cancel</button>' +
      '<button class="flex-1 py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:brightness-110 transition-colors" id="cn-next-btn">Next</button>' +
      '</div></div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.style.display = 'none';
    });
    overlay.querySelector('#cn-back-btn').addEventListener('click', function () {
      overlay.style.display = 'none';
    });
    overlay.querySelector('#cn-cancel-btn').addEventListener('click', function () {
      overlay.style.display = 'none';
    });
    overlay.querySelector('#cn-next-btn').addEventListener('click', function () {
      var oldNum = (overlay.querySelector('#cn-old-number').value || '').trim();
      var newNum = (overlay.querySelector('#cn-new-number').value || '').trim();
      var confirmNum = (overlay.querySelector('#cn-confirm-number').value || '').trim();
      if (!oldNum || !newNum) {
        if (typeof showToast === 'function') showToast('Please fill in all fields', 'error');
        return;
      }
      if (newNum !== confirmNum) {
        if (typeof showToast === 'function') showToast('New numbers do not match', 'error');
        return;
      }
      if (oldNum === newNum) {
        if (typeof showToast === 'function') showToast('New number must be different', 'error');
        return;
      }
      if (typeof window.confirm === 'function' && !window.confirm('Change your phone number from ' + oldNum + ' to ' + newNum + '?')) return;
      var uid = (typeof App !== 'undefined' && App.uid) ? App.uid() : (window.currentUser ? window.currentUser.uid : null);
      if (!uid) { if (typeof showToast === 'function') showToast('Not signed in', 'error'); return; }
      if (typeof db !== 'undefined' && db) {
        db.collection('users').doc(uid).update({
          phone: newNum,
          phoneNumber: newNum,
          previousPhone: oldNum,
          numberChangedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () {
          if (typeof showToast === 'function') showToast('Phone number updated successfully', 'success');
          overlay.style.display = 'none';
          var phoneEl = document.getElementById('user-phone');
          if (phoneEl) phoneEl.textContent = newNum;
        }).catch(function (err) {
          if (window.__DEBUG__) console.error('[ChangeNumber]', err);
          if (typeof showToast === 'function') showToast('Failed to update number: ' + (err.message || err), 'error');
        });
      } else {
        if (typeof showToast === 'function') showToast('Phone number updated (offline — will sync)', 'success');
        overlay.style.display = 'none';
      }
    });
    return overlay;
  }

  window.openChangeNumber = function () {
    var existing = document.getElementById('change-number-overlay');
    var overlay = existing || _buildUI();
    var user = (typeof App !== 'undefined' && App.user) ? App.user : (window.currentUser || null);
    if (user) {
      var oldInput = overlay.querySelector('#cn-old-number');
      if (oldInput && user.phone) oldInput.value = user.phone;
    }
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    requestAnimationFrame(function () { overlay.style.opacity = '1'; });
  };

  window.ChangeNumber = { open: window.openChangeNumber };
})();
