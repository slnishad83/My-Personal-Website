/**
 * Account Deletion (Client-Side)
 * Permanently deletes the user's account and all associated Firestore data.
 * Uses firebase.auth().currentUser.delete() for self-deletion — no Cloud Functions needed.
 * Works on Firebase Spark (free) plan.
 */
(function () {
  'use strict';

  const BATCH_LIMIT = 450;

  const AccountDeletion = {
    async init() {},

    async _deleteFirestoreData(uid, db) {
      const _deleteBatch = async (docs) => {
        if (!docs.length) return 0;
        const batch = db.batch();
        docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        return docs.length;
      };

      const _collectSubcollection = async (colRef) => {
        const snap = await colRef.limit(500).get();
        return snap.docs;
      };

      let totalDeleted = 0;

      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const _subs = [
          'fcmTokens', 'notificationSettings', 'dndSettings', 'snoozeSettings',
          'callHistory', 'personalChats', 'groupMemberships', 'status'
        ];
        for (const sub of _subs) {
          const docs = await _collectSubcollection(db.collection('users').doc(uid).collection(sub));
          totalDeleted += await _deleteBatch(docs);
        }
      }

      let chatPages = 0;
      let hasMoreChats = true;
      while (hasMoreChats && chatPages < 20) {
        const chatsSnap = await db.collection('chats')
          .where('participantIds', 'array-contains', uid)
          .limit(100)
          .get();

        if (chatsSnap.empty) { hasMoreChats = false; break; }

        for (const chatDoc of chatsSnap.docs) {
          const chatData = chatDoc.data();
          const participants = chatData.participantIds || [];

          let msgCount = 0;
          let hasMoreMsgs = true;
          while (hasMoreMsgs && msgCount < 2000) {
            const msgsSnap = await db.collection('chats').doc(chatDoc.id)
              .collection('messages')
              .where('senderId', '==', uid)
              .limit(BATCH_LIMIT)
              .get();

            if (msgsSnap.empty) { hasMoreMsgs = false; break; }
            msgCount += await _deleteBatch(msgsSnap.docs);
          }

          let otherMsgsCount = 0;
          let hasMoreOtherMsgs = true;
          while (hasMoreOtherMsgs && otherMsgsCount < 1000) {
            const otherSnap = await db.collection('chats').doc(chatDoc.id)
              .collection('messages')
              .limit(BATCH_LIMIT)
              .get();

            if (otherSnap.empty) { hasMoreOtherMsgs = false; break; }
            otherMsgsCount += await _deleteBatch(otherSnap.docs);
          }

          totalDeleted += msgCount + otherMsgsCount;

          if (participants.length <= 2) {
            const subCols = ['messages', 'typing', 'readStatus', 'pinnedMessages'];
            for (const sub of subCols) {
              const subDocs = await _collectSubcollection(db.collection('chats').doc(chatDoc.id).collection(sub));
              await _deleteBatch(subDocs);
            }
            await chatDoc.ref.delete();
            totalDeleted++;
          }
        }
        chatPages++;
      }

      const callSnap = await db.collection('callLogs').where('participants', 'array-contains', uid).limit(500).get();
      totalDeleted += await _deleteBatch(callSnap.docs);

      const myCallsSnap = await db.collection('callLogs').where('fromUserId', '==', uid).limit(500).get();
      totalDeleted += await _deleteBatch(myCallsSnap.docs);

      const statusSnap = await db.collection('statuses').where('userId', '==', uid).limit(500).get();
      totalDeleted += await _deleteBatch(statusSnap.docs);

      const notifSnap = await db.collection('inAppNotifications').where('toUserId', '==', uid).limit(500).get();
      totalDeleted += await _deleteBatch(notifSnap.docs);

      const userDocRef = db.collection('users').doc(uid);
      if ((await userDocRef.get()).exists) {
        await userDocRef.delete();
        totalDeleted++;
      }

      if (window.__DEBUG__) console.log('[AccountDeletion] Firestore docs deleted:', totalDeleted);
      return totalDeleted;
    },

    async _reauthenticateWithPassword(db, user) {
      return new Promise((resolve, reject) => {
        const overlay = document.createElement('div');
        overlay.id = 'acc-reauth-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

        const panel = document.createElement('div');
        panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:24px;padding:32px;max-width:380px;width:92vw;text-align:center;color:var(--on-surface)';

        panel.innerHTML = `
          <div style="width:56px;height:56px;border-radius:50%;background:rgba(25,118,210,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
            <span class="material-symbols-outlined" style="font-size:28px;color:#1976d2">lock</span>
          </div>
          <h3 style="margin:0 0 4px;font-size:17px;font-weight:700">Re-authenticate to continue</h3>
          <p style="font-size:12px;color:var(--on-surface-variant);margin:0 0 16px;line-height:1.4">
            For your security, please enter your password to confirm account deletion.
          </p>
          <div style="margin-bottom:16px;text-align:left">
            <input id="acc-reauth-pw" type="password" placeholder="Enter your password" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--outline-variant,rgba(255,255,255,0.15));background:var(--surface,#121212);color:var(--on-surface);font-size:13px;box-sizing:border-box" />
            <div id="acc-reauth-err" style="color:var(--error);font-size:11px;margin-top:6px;display:none"></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button id="acc-reauth-confirm" style="padding:14px;border-radius:14px;border:none;background:#1976d2;color:white;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
              <span class="material-symbols-outlined" style="font-size:20px">login</span> Confirm
            </button>
            <button id="acc-reauth-cancel" style="padding:10px;border-radius:10px;border:none;background:transparent;color:var(--on-surface-variant);font-size:13px;cursor:pointer">Cancel</button>
          </div>`;

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        const pwInput = document.getElementById('acc-reauth-pw');
        const errDiv = document.getElementById('acc-reauth-err');
        setTimeout(() => pwInput.focus(), 100);

        pwInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') document.getElementById('acc-reauth-confirm').click();
        });

        document.getElementById('acc-reauth-cancel').addEventListener('click', () => {
          overlay.remove();
          reject(new Error('cancelled'));
        });

        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) { overlay.remove(); reject(new Error('cancelled')); }
        });

        document.getElementById('acc-reauth-confirm').addEventListener('click', async () => {
          const pw = pwInput.value;
          if (!pw) return;

          const btn = document.getElementById('acc-reauth-confirm');
          btn.disabled = true;
          btn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:20px">progress_activity</span> Verifying...';

          try {
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, pw);
            await user.reauthenticateWithCredential(credential);
            overlay.remove();
            resolve();
          } catch (e) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">login</span> Confirm';
            errDiv.style.display = 'block';
            errDiv.textContent = e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
              ? 'Incorrect password. Please try again.'
              : 'Re-authentication failed. Please try again.';
            pwInput.value = '';
            pwInput.focus();
          }
        });
      });
    },

    async permanentDelete() {
      const user = App.auth?.currentUser;
      if (!user) return;

      const uid = user.uid;
      const db = App.db || firebase.firestore();

      try {
        if (typeof showToast === 'function') showToast('Deleting your data...', 'info');

        await this._deleteFirestoreData(uid, db);

        try {
          await user.delete();
        } catch (e) {
          if (e.code === 'auth/requires-recent-login') {
            await this._reauthenticateWithPassword(db, user);
            await user.delete();
          } else {
            throw e;
          }
        }

        if (typeof showToast === 'function') showToast('Account deleted successfully', 'success');

        try {
          localStorage.removeItem('nsl_chat_state');
          localStorage.removeItem('nsl_last_active_chat');
          localStorage.removeItem('nsl_unread_counts');
        } catch (_) {}

        setTimeout(() => {
          window.location.href = 'login.html?deleted=1';
        }, 600);
      } catch (e) {
        if (window.__DEBUG__) console.error('[AccountDeletion] Delete error:', e);
        if (typeof showToast === 'function') {
          showToast('Failed to delete account: ' + (e.message || 'Unknown error'), 'error');
        }
        const confirmBtn = document.getElementById('acc-delete-confirm');
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">delete_forever</span> DELETE';
        }
      }
    },

    promptDeletion() {
      const user = App.auth?.currentUser;
      if (!user) return;
      const userEmail = user.email || '';

      const overlay = document.createElement('div');
      overlay.id = 'account-delete-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

      const panel = document.createElement('div');
      panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:24px;padding:32px;max-width:400px;width:92vw;text-align:center;color:var(--on-surface)';

      panel.innerHTML = `
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(186,26,26,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <span class="material-symbols-outlined" style="font-size:32px;color:var(--error)">delete_forever</span>
        </div>
        <h3 style="margin:0 0 4px;font-size:18px;font-weight:700">Delete account?</h3>
        <p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 16px;line-height:1.5">
          This will permanently delete your NSL Chat account and all associated data. This action cannot be undone.
        </p>
        <div style="background:rgba(186,26,26,0.08);border:1px solid rgba(186,26,26,0.15);border-radius:12px;padding:12px;margin-bottom:20px;text-align:left">
          <p style="margin:0;font-size:12px;color:var(--error);font-weight:600">This will delete:</p>
          <ul style="margin:6px 0 0;padding-left:16px;font-size:11px;color:var(--on-surface-variant);line-height:1.6">
            <li>All your messages and chats</li>
            <li>Your profile and avatar</li>
            <li>All groups you own</li>
            <li>Your call history and status updates</li>
            <li>Your notification settings</li>
            <li>Your Firebase account</li>
          </ul>
        </div>
        <div style="margin-bottom:16px;text-align:left">
          <label style="font-size:12px;color:var(--on-surface-variant);display:block;margin-bottom:6px">Type your email to confirm:</label>
          <input id="acc-delete-email" type="email" placeholder="${userEmail}" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--outline-variant,rgba(255,255,255,0.15));background:var(--surface,#121212);color:var(--on-surface);font-size:13px;box-sizing:border-box" />
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button id="acc-delete-confirm" disabled style="padding:14px;border-radius:14px;border:none;background:var(--error,#ba1a1a);color:white;font-size:14px;font-weight:700;cursor:not-allowed;opacity:0.5;display:flex;align-items:center;justify-content:center;gap:8px">
            <span class="material-symbols-outlined" style="font-size:20px">delete_forever</span> DELETE
          </button>
          <button id="acc-delete-cancel" style="padding:10px;border-radius:10px;border:none;background:transparent;color:var(--on-surface-variant);font-size:13px;cursor:pointer">Cancel</button>
        </div>`;

      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      const emailInput = document.getElementById('acc-delete-email');
      const confirmBtn = document.getElementById('acc-delete-confirm');

      emailInput.addEventListener('input', () => {
        const matches = emailInput.value.trim().toLowerCase() === userEmail.toLowerCase();
        confirmBtn.disabled = !matches;
        confirmBtn.style.cursor = matches ? 'pointer' : 'not-allowed';
        confirmBtn.style.opacity = matches ? '1' : '0.5';
      });

      emailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !confirmBtn.disabled) {
          confirmBtn.click();
        }
      });

      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

      document.getElementById('acc-delete-cancel')?.addEventListener('click', () => overlay.remove());

      confirmBtn.addEventListener('click', async () => {
        if (confirmBtn.disabled) return;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:20px">progress_activity</span> Deleting...';
        emailInput.disabled = true;
        await this.permanentDelete();
        overlay.remove();
      });

      setTimeout(() => emailInput.focus(), 100);
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
