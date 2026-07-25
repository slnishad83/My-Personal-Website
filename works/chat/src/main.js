/**
 * NSL Chat — Application Entry Point (ES Module)
 * 
 * This is the single entry point for Vite bundling.
 * Imports all modules in correct order with proper tree-shaking.
 * Replaces the 150-file script-tag approach.
 */

/* ── CSS Imports (Vite handles bundling + minification) ─── */
import '../app.css';
import '../redesign-base.css';

/* ── Core Modules ───────────────────────────────────────── */
import { escHtml, throttle, debounce, on, emit, $, $$ } from './src/core/utils.js';
import * as Security from './src/core/security.js';
import { showToast, showModal, confirm as uiConfirm, showBottomSheet, showLoading } from './src/ui/components.js';

/* ── Firebase (loaded via compat for backward compat) ────── */
import { FIREBASE_CONFIG } from './firebase-config.js';

/* ── Firebase Init (guarded against double init) ─────────── */
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/* ── Firestore Offline Persistence ──────────────────────── */
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('[Firestore] Offline persistence unavailable (multiple tabs).');
  } else if (err.code === 'unimplemented') {
    console.warn('[Firestore] Offline persistence not supported.');
  }
});

/* ── Auth Persistence ───────────────────────────────────── */
function isLikelyPrivateSession() {
  try {
    const testKey = 'teamChatStorageProbe';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return false;
  } catch { return true; }
}

auth.setPersistence(
  isLikelyPrivateSession()
    ? firebase.auth.Auth.Persistence.SESSION
    : firebase.auth.Auth.Persistence.LOCAL
).catch(e => console.error('Persistence error:', e));

/* ── App Namespace (backward compatibility) ─────────────── */
window.App = window.App || {};
Object.assign(window.App, {
  db, auth, storage,
  escHtml, throttle, debounce, on, emit,
  showToast, showModal, confirm: uiConfirm,
  uid: () => window.currentUser?.uid || null,
});

/* ── Security Init ──────────────────────────────────────── */
Security.startTokenRefresh();

/* ── Platform Detection ─────────────────────────────────── */
const isNativeAndroidApp =
  window.Capacitor?.isNativePlatform?.() === true &&
  window.Capacitor?.getPlatform?.() === 'android';
const isNativeIOSApp =
  window.Capacitor?.isNativePlatform?.() === true &&
  window.Capacitor?.getPlatform?.() === 'ios';

if (isNativeAndroidApp) document.body.classList.add('native-android');
if (isNativeIOSApp) document.body.classList.add('native-ios');

/* ── Signal App Ready ───────────────────────────────────── */
document.dispatchEvent(new CustomEvent('nsl:app-ready'));

/* ── Performance: Mark load complete ────────────────────── */
if ('performance' in window) {
  performance.mark('nsl-chat-module-init');
}

/* ── Exports for backward compat ────────────────────────── */
window.Security = Security;
