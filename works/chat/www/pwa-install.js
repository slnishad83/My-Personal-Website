/* pwa-install.js v200 — Universal Install/Download button
 * 
 * Behaviour matrix:
 * ─────────────────────────────────────────────────────────────────────
 * Running INSIDE native Capacitor app  → "✓ App is installed"  (no action)
 * Android browser   + app installed    → opens app via deep-link Intent
 * Android browser   + NOT installed    → downloads APK directly
 * Android PWA (standalone)             → "✓ Web app installed" + "Get native APK" link
 * iOS (any browser)                    → Add-to-Home-Screen guide
 * Desktop Chrome/Edge/Opera            → native beforeinstallprompt OR fallback instructions
 * Desktop Firefox / other              → browser-specific manual instructions
 * Any device (fallback)               → APK download link + install instructions
 * ─────────────────────────────────────────────────────────────────────
 * The button is ALWAYS visible. It never hides entirely.
 */
(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────────────── */
  const APK_FILENAME   = 'my-team-chat.apk';
  const APP_PACKAGE    = 'com.nishad.myteamchat';
  const APP_SCHEME     = 'myteamchat';
  const APP_NAME       = 'My Team Chat';
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=' + APP_PACKAGE;

  /* Absolute APK URL — works whether page is served from /works/chat/ or anywhere */
  const APK_URL = (() => {
    try {
      // Always point to the canonical location regardless of www/ subdirectory
      const base = window.location.origin + '/works/chat/' + APK_FILENAME;
      return base;
    } catch (_) {
      return APK_FILENAME;
    }
  })();

  /* Android Intent URL — opens app if installed, falls back to APK download */
  const ANDROID_INTENT_URL =
    'intent://' + APP_SCHEME + '/open#Intent;' +
    'scheme=' + APP_SCHEME + ';' +
    'package=' + APP_PACKAGE + ';' +
    'S.browser_fallback_url=' + encodeURIComponent(APK_URL) + ';' +
    'end';

  /* Custom-scheme URL for browsers that don't support Intent (Firefox Android etc.) */
  const APP_CUSTOM_SCHEME = APP_SCHEME + '://open';

  /* Storage key so nudge doesn't flash every session */
  const RELOAD_KEY = 'tcInstallReloaded';

  /* ── Device detection ──────────────────────────────────────────── */
  const ua       = navigator.userAgent || '';
  const platform = navigator.platform  || '';

  const IS_IOS     = /iphone|ipad|ipod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const IS_ANDROID = /android/i.test(ua);
  const IS_SAFARI  = IS_IOS && /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
  const IS_CHROME_IOS = /crios/i.test(ua);
  const IS_FIREFOX = /firefox|fxios/i.test(ua);
  const IS_SAMSUNG = /samsungbrowser/i.test(ua);
  const IS_EDGE    = /edg\//i.test(ua);
  const IS_OPERA   = /opr\//i.test(ua);
  /* Browsers that honour the android intent:// scheme */
  const SUPPORTS_INTENT = IS_ANDROID && /chrome|crios|edg|opr|samsungbrowser/i.test(ua);

  const IS_NATIVE_CAPACITOR =
    window.Capacitor?.isNativePlatform?.() === true ||
    Boolean(window.Capacitor?.Plugins?.App);

  const IS_STANDALONE =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true;

  /* ── State ─────────────────────────────────────────────────────── */
  let deferredPrompt    = null;  // beforeinstallprompt event (Chrome/Edge desktop)
  let swReady           = null;  // service worker ready promise

  /* ── Helpers ───────────────────────────────────────────────────── */
  function qs(sel) { return document.querySelector(sel); }

  function getButtons() {
    return Array.from(document.querySelectorAll('[data-install-app], #installAppBtn'));
  }

  function setLabel(text, subtext) {
    getButtons().forEach(btn => {
      const labelEl = btn.querySelector('.install-app-label');
      if (labelEl) {
        labelEl.textContent = text;
      } else {
        // Replace text nodes only, preserve child elements (icons)
        for (const node of btn.childNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent = ' ' + text;
            return;
          }
        }
        btn.textContent = text;
      }
      btn.title = subtext || text;
      btn.setAttribute('aria-label', subtext || text);
    });
  }

  function setDisabled(disabled) {
    getButtons().forEach(btn => {
      btn.disabled = disabled;
      btn.setAttribute('aria-busy', disabled ? 'true' : 'false');
    });
  }

  function setHelp(msg) {
    const el = qs('[data-install-help]');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  function showToastOrAlert(msg, isError) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, isError ? 'error' : 'success');
      return;
    }
    const id = isError ? 'authError' : 'authSuccess';
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = 'block'; return; }
    alert(msg);
  }

  function prepSW() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    if (!swReady) {
      swReady = navigator.serviceWorker
        .register('sw.js?v=180', { scope: './' })
        .then(reg => { reg.update?.().catch(() => {}); return navigator.serviceWorker.ready; })
        .catch(() => null);
    }
    return swReady;
  }

  /* ── Determine what the button should say + do ─────────────────── */
  function computeState() {
    // 1. Already running inside the native Capacitor Android/iOS app
    if (IS_NATIVE_CAPACITOR) {
      return {
        label: '✓ App installed',
        help:  APP_NAME + ' is running as the native installed app.',
        action: 'installed',
      };
    }

    // 2. Android device
    if (IS_ANDROID) {
      if (IS_STANDALONE) {
        // Installed as PWA — still offer native APK
        return {
          label: 'Get Native App',
          help:  'Download the Android APK for the full native app experience.',
          action: 'android-download',
        };
      }
      return {
        label: 'Open App / Install',
        help:  'Opens the installed app — or downloads the APK if not yet installed.',
        action: 'android-open-or-download',
      };
    }

    // 3. iOS device
    if (IS_IOS) {
      if (IS_STANDALONE) {
        return {
          label: '✓ App installed',
          help:  APP_NAME + ' is already added to your Home Screen.',
          action: 'ios-installed',
        };
      }
      return {
        label: IS_SAFARI ? 'Add to Home Screen' : 'Install App',
        help:  'Tap Share → "Add to Home Screen" to install ' + APP_NAME + '.',
        action: 'ios-add-to-home',
      };
    }

    // 4. Desktop / other — PWA prompt available
    if (deferredPrompt) {
      return {
        label: 'Install App',
        help:  'Install ' + APP_NAME + ' as a desktop app — works offline.',
        action: 'pwa-prompt',
      };
    }

    // 5. Desktop — already installed as PWA
    if (IS_STANDALONE) {
      return {
        label: '✓ App installed',
        help:  APP_NAME + ' is installed as a web app.',
        action: 'installed',
      };
    }

    // 6. Desktop / other browser — manual install or APK download
    return {
      label: IS_EDGE ? 'Install App' : IS_FIREFOX ? 'Download App' : 'Install App',
      help:  getManualHelp(),
      action: 'manual-or-apk',
    };
  }

  function getManualHelp() {
    if (IS_EDGE)    return 'Click "…" → Apps → Install this site as an app.';
    if (IS_FIREFOX) return 'Firefox: use the address-bar install icon, or download the Android APK.';
    if (IS_SAFARI)  return 'Safari: Share → Add to Dock / Add to Home Screen.';
    return 'Open browser menu → Install app / Add to Home Screen, or download the Android APK below.';
  }

  function updateUI() {
    const state = computeState();
    setLabel(state.label, state.help);
    setHelp(state.help);
    setDisabled(false);
    // Update data attribute so the click handler can read it
    getButtons().forEach(btn => btn.dataset.installAction = state.action);
  }

  /* ── Android: open app via Intent URL or download APK ──────────── */
  function androidOpenOrDownload() {
    setDisabled(true);
    setHelp('Opening app… if not installed, download will begin shortly.');

    if (SUPPORTS_INTENT) {
      // Chrome/Samsung/Edge Android: Intent URL handles open-or-fallback natively
      window.location.href = ANDROID_INTENT_URL;
      setTimeout(() => { setDisabled(false); }, 2000);
      return;
    }

    // Firefox Android / other: try custom scheme then fall back to APK
    let appFound = false;
    const onHide = () => { appFound = document.visibilityState === 'hidden'; };
    document.addEventListener('visibilitychange', onHide, { once: true });

    // Try custom scheme
    const launcher = document.createElement('iframe');
    launcher.hidden = true;
    launcher.src = APP_CUSTOM_SCHEME;
    document.body.appendChild(launcher);

    setTimeout(() => {
      launcher.remove();
      document.removeEventListener('visibilitychange', onHide);
      setDisabled(false);
      if (!appFound) {
        // App not found — download APK
        downloadApk();
      }
    }, 1800);
  }

  function downloadApk() {
    setHelp('Downloading APK… After download, tap it to install. You may need to allow "Install unknown apps" in Android settings.');
    const a = document.createElement('a');
    a.href = APK_URL;
    a.download = APK_FILENAME;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 2000);
    showToastOrAlert('APK download started. Tap the file to install after it finishes.');
  }

  /* ── iOS: show detailed Add-to-Home-Screen guide ───────────────── */
  function showIosGuide() {
    const browser = IS_CHROME_IOS ? 'Chrome' : IS_SAFARI ? 'Safari' : 'your browser';
    const steps = IS_SAFARI
      ? '1. Tap the Share button (⬆) at the bottom of Safari.\n2. Scroll down and tap "Add to Home Screen".\n3. Tap "Add" — done!'
      : `1. Open this page in Safari (not ${browser}).\n2. Tap Share (⬆) → "Add to Home Screen".\n3. Tap "Add".`;

    setHelp(steps.replace(/\n/g, '  '));
    showToastOrAlert(steps);
  }

  /* ── Desktop PWA prompt ─────────────────────────────────────────── */
  async function triggerPwaPrompt() {
    if (!deferredPrompt) return false;
    setDisabled(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === 'accepted') {
        showToastOrAlert(APP_NAME + ' installed successfully!');
        updateUI();
        return true;
      }
    } catch (_) {}
    setDisabled(false);
    return false;
  }

  /* ── Desktop manual / APK modal ─────────────────────────────────── */
  function showManualOrApkModal() {
    const help = getManualHelp();
    setHelp(help);

    // Show a small modal with both options
    const existing = document.getElementById('installOptionsModal');
    if (existing) { existing.style.display = 'flex'; return; }

    const modal = document.createElement('div');
    modal.id = 'installOptionsModal';
    modal.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;' +
      'align-items:center;justify-content:center;padding:16px;';

    modal.innerHTML = `
      <div style="background:var(--bg,#fff);border-radius:16px;padding:28px 24px;max-width:400px;width:100%;
                  box-shadow:0 8px 32px rgba(0,0,0,.3);font-family:inherit;color:var(--text,#1e293b);">
        <h3 style="margin:0 0 16px;font-size:18px;">Install ${APP_NAME}</h3>

        <div style="border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:16px;margin-bottom:12px;">
          <strong>🖥️ Install as web app (this device)</strong>
          <p style="font-size:13px;margin:8px 0 12px;color:#64748b;">${help}</p>
          ${deferredPrompt
            ? '<button id="modalPwaBtn" style="background:var(--brand,#008069);color:#fff;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-size:14px;">Install Web App</button>'
            : '<em style="font-size:13px;color:#94a3b8;">Use browser menu → Install / Add to Home Screen</em>'}
        </div>

        <div style="border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:16px;margin-bottom:20px;">
          <strong>📱 Download Android APK</strong>
          <p style="font-size:13px;margin:8px 0 12px;color:#64748b;">
            For Android phones and tablets only.
            After downloading, tap the APK file and allow installation from unknown sources.
          </p>
          <a id="modalApkBtn" href="${APK_URL}" download="${APK_FILENAME}"
             style="display:inline-block;background:#1e293b;color:#fff;border-radius:8px;
                    padding:10px 20px;text-decoration:none;font-size:14px;">
            ⬇ Download APK
          </a>
        </div>

        <button id="modalCloseBtn" style="background:none;border:1px solid var(--border,#e2e8f0);
               border-radius:8px;padding:8px 18px;cursor:pointer;font-size:14px;width:100%;">
          Close
        </button>
      </div>`;

    document.body.appendChild(modal);

    modal.querySelector('#modalCloseBtn')?.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

    modal.querySelector('#modalPwaBtn')?.addEventListener('click', async () => {
      modal.style.display = 'none';
      await triggerPwaPrompt();
    });

    modal.querySelector('#modalApkBtn')?.addEventListener('click', () => {
      modal.style.display = 'none';
      showToastOrAlert('APK download started. On Android, tap the file to install.');
    });
  }

  /* ── Main click handler ─────────────────────────────────────────── */
  async function onInstallClick(e) {
    e.preventDefault();
    const action = e.currentTarget.dataset.installAction || computeState().action;

    switch (action) {
      case 'installed':
      case 'ios-installed':
        showToastOrAlert(APP_NAME + ' is already installed on this device.');
        break;

      case 'android-open-or-download':
        androidOpenOrDownload();
        break;

      case 'android-download':
        downloadApk();
        break;

      case 'ios-add-to-home':
        showIosGuide();
        break;

      case 'pwa-prompt': {
        const installed = await triggerPwaPrompt();
        if (!installed) setHelp(getManualHelp());
        break;
      }

      case 'manual-or-apk':
      default:
        // On desktop show modal with both options; on Android just download
        if (IS_ANDROID) {
          downloadApk();
        } else {
          if (deferredPrompt) {
            const ok = await triggerPwaPrompt();
            if (!ok) showManualOrApkModal();
          } else {
            showManualOrApkModal();
          }
        }
        break;
    }
  }

  /* ── Event wiring ───────────────────────────────────────────────── */
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    updateUI();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showToastOrAlert(APP_NAME + ' installed successfully!');
    updateUI();
  });

  window.addEventListener('load', prepSW);

  document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    getButtons().forEach(btn => btn.addEventListener('click', onInstallClick));
  });

  // Re-evaluate if standalone state changes (e.g., Chrome shows prompt mid-session)
  window.matchMedia('(display-mode: standalone)').addEventListener('change', updateUI);

})();
