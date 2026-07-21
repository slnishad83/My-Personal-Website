/**
 * NSL Chat — Application Entry Point (ES Module)
 * 
 * This is the single entry point for Vite bundling.
 * Imports all modules in correct order with proper tree-shaking.
 * Replaces the 150-file script-tag approach.
 */

/* ── CSS Imports (Vite handles bundling + minification) ─── */
import './src/styles/main.css';

/* ── Core Modules ───────────────────────────────────────── */
import { escHtml, throttle, debounce, on, emit, $, $$ } from './src/core/utils.js';
import * as Security from './src/core/security.js';
import { showToast, showModal, confirm, showBottomSheet, showLoading } from './src/ui/components.js';

/* ── Firebase (loaded via compat for backward compat) ────── */
const firebaseConfig = {
  apiKey: "AIzaSyCdbut_FdscAjl-OVSlAUhb7TOTiRNkh34",
  authDomain: "my-team-chat-2255.firebaseapp.com",
  projectId: "my-team-chat-2255",
  storageBucket: "my-team-chat-2255.firebasestorage.app",
  messagingSenderId: "805016891521",
  appId: "1:805016891521:web:ac9bc7a252bcf33686dd80",
};

firebase.initializeApp(firebaseConfig);
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
  showToast, showModal, confirm,
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

/* ── Feature Module Lazy Loading ────────────────────────── */
const _loadedModules = new Set();
const _loadingModules = new Map();

export async function loadModule(name) {
  if (_loadedModules.has(name)) return true;
  if (_loadingModules.has(name)) return _loadingModules.get(name);

  const promise = import(`./src/features/${name}.js`)
    .then(mod => {
      _loadedModules.add(name);
      _loadingModules.delete(name);
      return mod;
    })
    .catch(e => {
      console.warn(`[ModuleLoader] Failed to load "${name}":`, e);
      _loadingModules.delete(name);
      return null;
    });

  _loadingModules.set(name, promise);
  return promise;
}

/* ── Eager-load critical modules ────────────────────────── */
const CRITICAL_MODULES = [
  'messaging', 'calls', 'groups', 'notifications', 'presence'
];

/* ── Signal App Ready ───────────────────────────────────── */
document.dispatchEvent(new CustomEvent('nsl:app-ready'));

/* ── Performance: Mark load complete ────────────────────── */
if ('performance' in window) {
  performance.mark('nsl-chat-module-init');
}

/* ── Exports for backward compat ────────────────────────── */
window.Security = Security;
window.loadModule = loadModule;
