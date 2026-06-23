/**
 * app.js — runs inside the Capacitor WebView on every launch.
 *
 * OTA update strategy:
 *   capacitor.config.json → server.url points to Firebase Hosting.
 *   Every push to GitHub triggers firebase-deploy.yml which redeploys the
 *   chat files.  The installed APK loads the live Firebase URL on each
 *   launch, so web-only changes (HTML / CSS / JS) are visible immediately
 *   without reinstalling the APK or going through the Play Store.
 *
 *   Native code changes (plugins, permissions, AndroidManifest) still
 *   require a new APK build and install.
 */
