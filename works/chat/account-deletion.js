/**
 * Account Deletion
 * Allows users to permanently delete their account and all associated data.
 * Includes a 30-day grace period before permanent deletion.
 */
(function () {
  'use strict';

  const AccountDeletion = {
    async init() {
      const user = App.auth?.currentUser;
      if (!user) return;
      try {
        const doc = await App.db.collection('users').doc(user.uid).get();
        const data = doc.data() || {};
        if (data.deletionScheduledAt) {
          const deadline = data.deletionScheduledAt.toDate ? data.deletionScheduledAt.toDate() : new Date(data.deletionScheduledAt);
          const daysLeft = Math.max(0, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24)));
          if (daysLeft > 0) {
            if (window.__DEBUG__) console.log(`[AccountDeletion] Account scheduled for deletion in ${daysLeft} days`);
          }
        }
      } catch (_) {}
    },

    async scheduleDeletion() {
      const user = App.auth?.currentUser;
      if (!user) return;
      const uid = user.uid;

      try {
        await App.db.collection('users').doc(uid).update({
          deletionScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: false,
        });

        showToast('Account scheduled for deletion. You have 30 days to reactivate by logging in.', 'info');
      } catch (e) {
        console.error('[AccountDeletion] Schedule error:', e);
        showToast('Failed to schedule deletion', 'error');
      }
    },

    async cancelDeletion() {
      const user = App.auth?.currentUser;
      if (!user) return;
      const uid = user.uid;

      try {
        await App.db.collection('users').doc(uid).update({
          deletionScheduledAt: firebase.firestore.FieldValue.delete(),
          isActive: true,
          onlineStatus: 'online',
          lastSeen: new Date(),
        });
        showToast('Account deletion cancelled. Welcome back!', 'success');
      } catch (e) {
        console.error('[AccountDeletion] Cancel error:', e);
        showToast('Failed to cancel deletion', 'error');
      }
    },

    async permanentDelete() {
      const user = App.auth?.currentUser;
      if (!user) return;
      const uid = user.uid;

      try {
        await App.db.collection('users').doc(uid).update({
          deletionScheduledAt: null,
          isActive: false,
          deletedAt: new Date(),
          email: null,
          displayName: 'Deleted User',
          avatar: '',
          phone: '',
          privacySettings: null,
        });

        if (typeof signOut === 'function') {
          await signOut();
        } else {
          await App.auth.signOut();
          window.location.href = 'login.html';
        }
      } catch (e) {
        console.error('[AccountDeletion] Permanent delete error:', e);
        showToast('Failed to delete account', 'error');
      }
    },

    promptDeletion() {
      const overlay = document.createElement('div');
      overlay.id = 'account-delete-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

      const panel = document.createElement('div');
      panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:24px;padding:32px;max-width:400px;width:92vw;text-align:center;color:var(--on-surface)';

      panel.innerHTML = `
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(186,26,26,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <span class="material-symbols-outlined" style="font-size:32px;color:var(--error)">delete_forever</span>
        </div>
        <h3 style="margin:0 0 4px;font-size:18px;font-weight:700">Delete Account</h3>
        <p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 16px;line-height:1.5">
          This will schedule your account for permanent deletion after <strong>30 days</strong>. During this period, you can reactivate by logging in.
        </p>
        <div style="background:rgba(186,26,26,0.08);border:1px solid rgba(186,26,26,0.15);border-radius:12px;padding:12px;margin-bottom:20px;text-align:left">
          <p style="margin:0;font-size:12px;color:var(--error);font-weight:600">This will delete:</p>
          <ul style="margin:6px 0 0;padding-left:16px;font-size:11px;color:var(--on-surface-variant);line-height:1.6">
            <li>All your messages and chats</li>
            <li>Your profile and avatar</li>
            <li>All groups you own</li>
            <li>Your call history and status updates</li>
          </ul>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button id="acc-delete-confirm" style="padding:14px;border-radius:14px;border:none;background:var(--error);color:white;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
            <span class="material-symbols-outlined" style="font-size:20px">delete_forever</span> Delete My Account
          </button>
          <button onclick="document.getElementById('account-delete-overlay')?.remove()" style="padding:10px;border-radius:10px;border:none;background:transparent;color:var(--on-surface-variant);font-size:13px;cursor:pointer">Cancel</button>
        </div>`;

      overlay.appendChild(panel);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);

      document.getElementById('acc-delete-confirm')?.addEventListener('click', async () => {
        const btn = document.getElementById('acc-delete-confirm');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:20px">progress_activity</span> Deleting...';
        await this.scheduleDeletion();
        overlay.remove();
      });
    }
  };

  window.AccountDeletion = AccountDeletion;

  window.confirmDeleteAccount = function () {
    AccountDeletion.promptDeletion();
  };

  document.addEventListener('nsl:app-ready', () => {
    AccountDeletion.init();
  });
})();
