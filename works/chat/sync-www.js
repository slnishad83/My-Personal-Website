const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const WWW = path.join(ROOT, 'www');

const INCLUDE = [
  'index.html', 'login.html', 'verify.html', 'reset.html', 'turn.html',
  'album.html', 'calendar.html', 'expenses.html', 'insights.html',
  'app.js', 'app-extras.js', 'app-init.js', 'config.js',
  'sanitize.js', 'platform-detect.js', 'presence.js', 'multi-device.js',
  'offline-queue.js', 'call-sync.js', 'threads.js',
  'notification-orchestrator.js', 'notification-digest.js', 'notification-bell.js',
  'notification-prefs.js', 'notification-sounds.js', 'notification-telemetry.js',
  'notification-prefs.css', 'notification-reply.js',
  'push-notifications.js', 'whatsapp-enhancements.js', 'whatsapp-share.js',
  'message-search.js', 'message-actions.css',
  'desktop-context-menu.js', 'desktop-notifications.js', 'desktop-fullscreen.js',
  'ios-callkit.js', 'ios-keyboard-fix.js',
  'keyboard-shortcuts.js', 'swipe-nav.js', 'swipe-delete.js',
  'pinch-zoom.js', 'pull-to-refresh.js', 'clipboard-paste.js',
  'virtual-scroll.js', 'mutation-bus.js', 'error-boundary.js',
  'request-priority.js', 'attachment-reliability.js', 'back-button.js',
  'pwa-install.js', 'window-title.js', 'url-preview.js', 'url-preview.css',
  'ai-bot.js', 'sync-audit.js', 'sync-audit.css',
  'redesign-base.js', 'redesign-base.css',
  'chat.css', 'chat-enhancements.js', 'chat-enhancements.css',
  'chat-theme.css', 'chat-missing-features.js', 'chat-missing-features.css',
  'chat-fixes.js', 'auth-theme.css', 'login-styles.css', 'features-addon.js', 'feature-updates.js', 'jsQR.js', 'calculator.js',
  'group-message-info.js', 'audit-interactions.js', 'ui-compliance.js',
  'two-factor-auth.js', 'account-deletion.js', 'view-once.js', 'live-location.js',
  'data-saver.js', 'wallpaper-gallery.js', 'help-support.js', 'reply-private.js',
  'group-meta.js', 'self-destruct.js',
  'call-controller.js', 'group-call.js', 'call-history.js',
  'archive-chat.js', 'forward-modal.js', 'block-user.js',
  'message-reactions.js', 'delete-group.js', 'profile-edit.js', 'app-lock.js',
  'video-notes.js', 'in-call-reactions.js', 'status.js', 'status-viewer.js',
  'new-features.css',
  'notification-nav.js', 'unread-polish.js', 'home-camera.js', 'group-features.js',
  'onboarding.js', 'empty-states.js', 'form-validation.js', 'toast-ux.js', 'a11y-enhancements.js', 'message-errors.js',
  'report-user.js', 'gif-picker.js', 'sticker-packs.js', 'micro-interactions.js', 'profile-setup.js', 'lazy-images.js',
  'qr-code-gen.js', 'qr-scanner.js', 'contact-sync.js',
  'snooze-enhancements.js', 'snooze-enhancements.css',
  'snooze-history.js', 'snooze-history.css',
  'scheduled-calendar.js', 'scheduled-calendar.css',
  'security.js', 'translation-ui.css',
  'manifest.json', 'sw.js',
  'accessibility.js', 'permissions-manager.js', 'fixes.js',
  'app-icon-192.png', 'app-icon-512.png', 'app-icon.svg', 'nsl-logo.png'
];

const COPY_DIRS = ['sounds'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.copyFileSync(src, dest);
  return true;
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

console.log('Syncing web assets to www/...');
ensureDir(WWW);

let copied = 0;
let missing = 0;

for (const file of INCLUDE) {
  let src = path.join(ROOT, file);
  const dest = path.join(WWW, file);
  
  // Fallback: check one level up if not in current root
  if (!fs.existsSync(src)) {
    src = path.join(ROOT, '..', file);
  }

  if (copyFile(src, dest)) {
    copied++;
  } else {
    missing++;
    console.warn(`  Missing: ${file}`);
  }
}

for (const dir of COPY_DIRS) {
  let src = path.join(ROOT, dir);
  const dest = path.join(WWW, dir);
  
  // Fallback: check one level up
  if (!fs.existsSync(src)) {
    src = path.join(ROOT, '..', dir);
  }

  if (fs.existsSync(src)) {
    copyDir(src, dest);
    copied++;
  } else {
    missing++;
    console.warn(`  Missing dir: ${dir}`);
  }
}

console.log(`Done: ${copied} copied, ${missing} missing`);

// Compile Tailwind CSS for Capacitor www folder
try {
  console.log('Compiling Tailwind CSS for Capacitor www/app.css...');
  const { execSync } = require('child_process');
  const localCli = path.join(ROOT, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
  let cmd = 'npx tailwindcss -i app.css -o www/app.css --minify';
  if (fs.existsSync(localCli)) {
    cmd = `node "${localCli}" -i app.css -o www/app.css --minify`;
  }
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
  console.log('Successfully compiled Tailwind CSS to www/app.css');
} catch (e) {
  console.warn('Tailwind compilation failed for www/app.css, using raw file: ' + e.message);
  try {
    let rawSrc = path.join(ROOT, 'app.css');
    if (!fs.existsSync(rawSrc)) rawSrc = path.join(ROOT, '..', 'app.css');
    fs.copyFileSync(rawSrc, path.join(WWW, 'app.css'));
  } catch (_) {}
}
