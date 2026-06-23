/**
 * Capgo OTA live-update initialisation.
 *
 * Called on every app start inside the native WebView.
 * notifyAppReady() tells Capgo "this bundle loaded fine — do not roll back."
 * Without this call Capgo will revert to the previous bundle after 3 failed
 * launches, which is how bad updates are automatically recovered from.
 *
 * autoUpdate is enabled in capacitor.config.json, so new bundles are
 * downloaded in the background and applied on the next cold start.
 */
(function () {
  if (typeof window === "undefined") return; // safety guard for Node checks
  if (window.__capgoReady) return;           // prevent double-init
  window.__capgoReady = true;

  function initCapgo() {
    if (
      typeof Capacitor !== "undefined" &&
      Capacitor.isNativePlatform() &&
      Capacitor.Plugins &&
      Capacitor.Plugins.CapacitorUpdater
    ) {
      Capacitor.Plugins.CapacitorUpdater.notifyAppReady();
    }
  }

  // Capacitor is synchronously available once the WebView has loaded.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCapgo);
  } else {
    initCapgo();
  }
})();
