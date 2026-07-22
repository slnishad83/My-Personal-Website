'use strict';
/**
 * PRIVACY CONTROLS — Read receipts toggle, Last seen visibility
 * Stores settings in Firestore user doc and localStorage for offline fallback.
 */
(function () {
  const Privacy = {
    _defaults: {
      readReceipts: true,      // true = show blue ticks to others
      lastSeen: 'everyone',    // 'everyone', 'contacts', 'nobody'
      profilePhoto: 'everyone', // 'everyone', 'contacts', 'nobody'
      about: 'everyone'        // 'everyone', 'contacts', 'nobody'
    },

    get(key) {
      try {
        const stored = JSON.parse(localStorage.getItem('nsl_privacy') || '{}');
        return stored[key] ?? this._defaults[key];
      } catch (_) { return this._defaults[key]; }
    },

    set(key, value) {
      const stored = JSON.parse(localStorage.getItem('nsl_privacy') || '{}');
      stored[key] = value;
      try { localStorage.setItem('nsl_privacy', JSON.stringify(stored)); } catch (_) {}
      this._persistToFirestore(stored);
      document.dispatchEvent(new CustomEvent('privacy-setting-change', { detail: { key, value } }));
    },

    getAll() {
      try {
        const stored = JSON.parse(localStorage.getItem('nsl_privacy') || '{}');
        return { ...this._defaults, ...stored };
      } catch (_) { return { ...this._defaults }; }
    },

    async _persistToFirestore(settings) {
      const uid = window.App?.uid?.() || window.currentUser?.uid;
      const db = window.App?.db;
      if (uid && db) {
        try {
          await db.collection('users').doc(uid).set({
            privacySettings: settings
          }, { merge: true });
        } catch (_) {}
      }
    },

    async loadFromFirestore() {
      const uid = window.App?.uid?.() || window.currentUser?.uid;
      const db = window.App?.db;
      if (uid && db) {
        try {
          const doc = await db.collection('users').doc(uid).get();
          if (doc.exists && doc.data().privacySettings) {
            const settings = doc.data().privacySettings;
            try { localStorage.setItem('nsl_privacy', JSON.stringify(settings)); } catch (_) {}
            return settings;
          }
        } catch (_) {}
      }
      return this.getAll();
    },

    shouldShowReadReceipts(forUserId) {
      if (!this.get('readReceipts')) return false;
      return true;
    },

    shouldShowLastSeen(forUserId) {
      const setting = this.get('lastSeen');
      if (setting === 'nobody') return false;
      if (setting === 'contacts') {
        // Check if user is a contact (simplified)
        const contacts = this._getContacts();
        return contacts.includes(forUserId);
      }
      return true;
    },

    shouldShowProfilePhoto(forUserId) {
      const setting = this.get('profilePhoto');
      if (setting === 'nobody') return false;
      if (setting === 'contacts') {
        const contacts = this._getContacts();
        return contacts.includes(forUserId);
      }
      return true;
    },

    _getContacts() {
      try {
        const chats = window.App?.chats || [];
        return chats.filter(c => c.type === 'direct').map(c => c.uid || c.id);
      } catch (_) { return []; }
    },

    openSettings() {
      const current = this.getAll();
      const modal = document.createElement('div');
      modal.id = 'privacy-settings-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';

      modal.innerHTML = `
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(400px,92vw);max-height:80vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.3);padding:24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <h2 style="font-size:18px;font-weight:700;color:var(--on-surface,#000);margin:0;">Privacy</h2>
            <button onclick="document.getElementById('privacy-settings-modal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--on-surface-variant,#666);">✕</button>
          </div>

          <div style="margin-bottom:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--outline-variant,#eee);">
              <div>
                <div style="font-size:14px;font-weight:600;color:var(--on-surface,#000);">Read receipts</div>
                <div style="font-size:12px;color:var(--on-surface-variant,#666);">Others see when you read their messages</div>
              </div>
              <label style="position:relative;display:inline-block;width:44px;height:24px;">
                <input type="checkbox" id="privacy-read-receipts" ${current.readReceipts ? 'checked' : ''} style="opacity:0;width:0;height:0;">
                <span style="position:absolute;cursor:pointer;inset:0;background:${current.readReceipts ? 'var(--primary,#00a884)' : '#ccc'};border-radius:12px;transition:0.3s;">
                  <span style="position:absolute;content:'';height:18px;width:18px;left:${current.readReceipts ? '22px' : '3px'};bottom:3px;background:#fff;border-radius:50%;transition:0.3s;"></span>
                </span>
              </label>
            </div>

            <div style="padding:12px 0;border-bottom:1px solid var(--outline-variant,#eee);">
              <div style="font-size:14px;font-weight:600;color:var(--on-surface,#000);margin-bottom:8px;">Last seen</div>
              <select id="privacy-last-seen" style="width:100%;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;background:var(--surface,#fff);color:var(--on-surface,#000);">
                <option value="everyone" ${current.lastSeen === 'everyone' ? 'selected' : ''}>Everyone</option>
                <option value="contacts" ${current.lastSeen === 'contacts' ? 'selected' : ''}>My contacts</option>
                <option value="nobody" ${current.lastSeen === 'nobody' ? 'selected' : ''}>Nobody</option>
              </select>
            </div>

            <div style="padding:12px 0;border-bottom:1px solid var(--outline-variant,#eee);">
              <div style="font-size:14px;font-weight:600;color:var(--on-surface,#000);margin-bottom:8px;">Profile photo</div>
              <select id="privacy-profile-photo" style="width:100%;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;background:var(--surface,#fff);color:var(--on-surface,#000);">
                <option value="everyone" ${current.profilePhoto === 'everyone' ? 'selected' : ''}>Everyone</option>
                <option value="contacts" ${current.profilePhoto === 'contacts' ? 'selected' : ''}>My contacts</option>
                <option value="nobody" ${current.profilePhoto === 'nobody' ? 'selected' : ''}>Nobody</option>
              </select>
            </div>

            <div style="padding:12px 0;">
              <div style="font-size:14px;font-weight:600;color:var(--on-surface,#000);margin-bottom:8px;">About</div>
              <select id="privacy-about" style="width:100%;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;background:var(--surface,#fff);color:var(--on-surface,#000);">
                <option value="everyone" ${current.about === 'everyone' ? 'selected' : ''}>Everyone</option>
                <option value="contacts" ${current.about === 'contacts' ? 'selected' : ''}>My contacts</option>
                <option value="nobody" ${current.about === 'nobody' ? 'selected' : ''}>Nobody</option>
              </select>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

      document.getElementById('privacy-read-receipts').addEventListener('change', (e) => {
        Privacy.set('readReceipts', e.target.checked);
        if (typeof showToast === 'function') showToast('Read receipts ' + (e.target.checked ? 'enabled' : 'disabled'), 'success');
      });

      document.getElementById('privacy-last-seen').addEventListener('change', (e) => {
        Privacy.set('lastSeen', e.target.value);
        if (typeof showToast === 'function') showToast('Last seen visibility updated', 'success');
      });

      document.getElementById('privacy-profile-photo').addEventListener('change', (e) => {
        Privacy.set('profilePhoto', e.target.value);
        if (typeof showToast === 'function') showToast('Profile photo visibility updated', 'success');
      });

      document.getElementById('privacy-about').addEventListener('change', (e) => {
        Privacy.set('about', e.target.value);
        if (typeof showToast === 'function') showToast('About visibility updated', 'success');
      });
    }
  };

  window.PrivacyControls = Privacy;
  window.PrivacySettings = Privacy;
})();
