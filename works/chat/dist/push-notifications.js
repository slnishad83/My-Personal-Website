/* =============================================
   PUSH NOTIFICATIONS v1.1
   - Proactive chat notification permission prompt
   - Registers FCM token for BOTH calls AND messages
   - Handles permission state across all browsers
   - Respects user-disabled flag from notification-bell.js
   - iOS Safari: prompts to Add to Home Screen before enabling
   - Theme-aware prompt colors using CSS custom properties
   ============================================= */
(function () {
  'use strict';

  const PROMPTED_KEY     = 'tcPushPrompted';
  const DISABLED_KEY     = 'teamChatNotifUserDisabled';
  const REGISTERED_AT_KEY = 'tcPushRegisteredAt';
  const PROMPT_DELAY_MS  = 4000;
  const REREGISTER_MS    = 1000 * 60 * 60 * 24 * 5;

  function userDisabled() {
    try { return localStorage.getItem(DISABLED_KEY) === '1'; } catch (_) { return false; }
  }
  function alreadyPrompted() {
    try { return Boolean(localStorage.getItem(PROMPTED_KEY)); } catch (_) { return false; }
  }
  function setPrompted() {
    try { localStorage.setItem(PROMPTED_KEY, '1'); } catch (_) {}
  }
  function lastRegisteredAt() {
    try { return Number(localStorage.getItem(REGISTERED_AT_KEY) || 0); } catch (_) { return 0; }
  }
  function setRegisteredAt() {
    try { localStorage.setItem(REGISTERED_AT_KEY, String(Date.now())); } catch (_) {}
  }
  function shouldReregister() {
    return Date.now() - lastRegisteredAt() > REREGISTER_MS;
  }

  function notifSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }
  function notifGranted() {
    return notifSupported() && Notification.permission === 'granted';
  }
  function notifBlocked() {
    return notifSupported() && Notification.permission === 'denied';
  }

  function isIOSSafari() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
      /^((?!chrome|android|crios|fxios|edg|opr|samsung).)*safari/i.test(navigator.userAgent);
  }
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  async function registerToken(force) {
    if (typeof window.registerFcmTokenForCurrentUser === 'function') {
      try {
        await window.registerFcmTokenForCurrentUser({ force: Boolean(force) });
      } catch (e) {
        console.warn('[TC Push] registerFcmTokenForCurrentUser failed:', e);
      }
      return;
    }

    const user = window.currentUser;
    const db   = window.db;
    if (!user || !db || !window.firebase?.messaging) return;
    if (!window.FCM_VAPID_KEY) return;

    try {
      const messaging = firebase.messaging();
      const reg = await navigator.serviceWorker.ready;
      const token = await messaging.getToken({
        vapidKey: window.FCM_VAPID_KEY,
        serviceWorkerRegistration: reg
      });
      if (!token) return;

      const key = token.replace(/[^a-zA-Z0-9]/g, '').slice(-120);
      await db.collection('users').doc(user.uid).set({
        fcmTokens: {
          [key]: {
            token,
            platform: navigator.userAgent || 'web',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            permission: Notification.permission,
            purpose: 'all'
          }
        },
        notificationsEnabled: true,
        lastFcmTokenUpdateAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      setRegisteredAt();
    } catch (e) {
      console.warn('[TC Push] Manual FCM registration failed:', e);
    }
  }

  function showPermissionPrompt() {
    if (document.getElementById('tcPushPromptBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'tcPushPromptBanner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Enable notifications');

    const isDark = document.documentElement.classList.contains('dark');
    const bg = isDark ? 'var(--surface-container)' : 'var(--surface-container-lowest, #fff)';
    const fg = isDark ? 'var(--on-surface)' : 'var(--on-surface)';
    const muted = 'var(--on-surface-variant)';
    const btnBg = 'var(--primary)';
    const btnFg = 'var(--on-primary)';

    banner.style.cssText = `
      position:fixed;bottom:70px;left:50%;transform:translateX(-50%);
      width:min(90vw,360px);background:${bg};color:${fg};
      border-radius:12px;padding:14px 16px;z-index:99990;
      box-shadow:0 6px 24px rgba(0,0,0,0.4);display:flex;
      flex-direction:column;gap:10px;font-family:inherit;
      animation:tcBannerIn 0.3s ease;
      border:1px solid var(--outline-variant);
    `;

    const style = document.createElement('style');
    style.textContent = `@keyframes tcBannerIn{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
    document.head.appendChild(style);

    const iosHint = isIOSSafari() && !isStandalone()
      ? `<div style="font-size:11px;color:${muted};margin-top:4px;line-height:1.4;">
           iOS Safari: tap <b>Share → Add to Home Screen</b> first for full push support.
         </div>`
      : '';

    banner.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="font-size:22px;flex-shrink:0;margin-top:2px;">🔔</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:14px;margin-bottom:3px;">Stay notified</div>
          <div style="font-size:12.5px;color:${muted};line-height:1.45;">
            Get alerts for new messages even when the app is closed or your screen is locked.
          </div>
          ${iosHint}
        </div>
        <button id="tcPushPromptClose" aria-label="Dismiss"
          style="background:none;border:none;color:${muted};font-size:18px;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0;">✕</button>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="tcPushPromptNo"
          style="background:none;border:none;color:${muted};font-size:13px;cursor:pointer;padding:6px 10px;border-radius:6px;">
          Not now
        </button>
        <button id="tcPushPromptYes"
          style="background:${btnBg};border:none;color:${btnFg};font-size:13px;font-weight:600;
                 cursor:pointer;padding:7px 16px;border-radius:8px;">
          Enable notifications
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    function dismiss() {
      banner.remove();
      setPrompted();
    }

    document.getElementById('tcPushPromptClose').addEventListener('click', dismiss);
    document.getElementById('tcPushPromptNo').addEventListener('click', dismiss);
    document.getElementById('tcPushPromptYes').addEventListener('click', async function () {
      dismiss();
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await registerToken(true);
          if (typeof window.showToast === 'function') {
            window.showToast('Notifications enabled ✓');
          }
        }
      } catch (e) {
        console.warn('[TC Push] Permission request failed:', e);
      }
    });

    // Auto-dismiss after 15s
    setTimeout(dismiss, 15000);
  }

  /* ── Main init — runs after Firebase auth resolves ────────────────── */
  function initPush() {
    if (!notifSupported()) return;
    if (!window.firebase?.auth) {
      setTimeout(initPush, 600);
      return;
    }

    firebase.auth().onAuthStateChanged(async function (user) {
      if (!user) return;

      // If already granted: re-register silently if due
      if (notifGranted() && !userDisabled()) {
        if (shouldReregister()) {
          await registerToken(false);
        }
        return;
      }

      // If blocked: do nothing (user consciously denied)
      if (notifBlocked()) return;

      // If user disabled from bell toggle: do nothing
      if (userDisabled()) return;

      // If already prompted once: do nothing (don't nag)
      if (alreadyPrompted()) return;

      // Show the soft prompt after a short delay
      setTimeout(showPermissionPrompt, PROMPT_DELAY_MS);
    });
  }

  if (document.readyState === 'complete') {
    setTimeout(initPush, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(initPush, 0); });
  }
})();
