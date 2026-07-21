/**
 * NSL Chat Build Script
 * - Concatenates JS files in load order into a single bundle
 * - Copies static assets to dist/
 * - Processes HTML to reference the bundle
 * - No ES module conversion needed - preserves global scope
 */

const { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, statSync, rmSync, existsSync } = require('fs');
const { join, resolve, dirname } = require('path');
const { createHash } = require('crypto');

const ROOT = __dirname;
const DIST = join(ROOT, 'dist');

// JS files in load order (matching index.html script tags)
const BUNDLE_ORDER = [
  // Parent dir files referenced by index.html
  'config.js',
  'app.js',
  'app-extras.js',
  // Feature files from works/chat/
  'platform-detect.js',
  'offline-queue.js',
  'call-sync.js',
  'presence.js',
  'multi-device.js',
  'security.js',
  'error-boundary.js',
  'mutation-bus.js',
  'virtual-scroll.js',
  'accessibility.js',
  'keyboard-shortcuts.js',
  'permissions-manager.js',
  'chat-missing-features.js',
  'pull-to-refresh.js',
  'pinch-zoom.js',
  'swipe-delete.js',
  'back-button.js',
  'ios-keyboard-fix.js',
  'chat-enhancements.js',
  'chat-fixes.js',
  'threads.js',
  'message-search.js',
  'notification-prefs.js',
  'notification-digest.js',
  'notification-reply.js',
  'notification-orchestrator.js',
  'notification-bell.js',
  'notification-telemetry.js',
  'ios-callkit.js',
  'desktop-notifications.js',
  'pwa-install.js',
  'ui-compliance.js',
  'audit-interactions.js',
  'whatsapp-enhancements.js',
  'jsQR.js',
  'calculator.js',
  'features-addon.js',
  'scheduled-calendar.js',
  'snooze-history.js',
  'snooze-enhancements.js',
  'ai-bot.js',
  'group-message-info.js',
  'fixes.js',
  'feature-updates.js',
  'sync-audit.js',
  'url-preview.js',
  'redesign-base.js',
  'request-priority.js',
  'sanitize.js',
  'clipboard-paste.js',
  'desktop-fullscreen.js',
  'desktop-context-menu.js',
  'window-title.js',
  'whatsapp-share.js',
  'swipe-nav.js',
  'push-notifications.js',
  'attachment-reliability.js',
  'task-from-message.js',
  'meeting-scheduler.js',
  'chat-permissions.js',
  'announcement-mode.js',
  'channel-mode.js',
  'smart-reply.js',
  'streak.js',
  'saved-messages.js',
  'self-destruct.js',
  'message-scheduler.js',
  'translation.js',
  'message-copy.js',
  'smart-notifications.js',
  'file-versioning.js',
  'cloud-drive.js',
  'collaborative-whiteboard.js',
  'image-annotation.js',
  'screen-share.js',
  'chat-lock.js',
  'ghost-mode.js',
  'screenshot-control.js',
  'message-recall.js',
  'sensitive-content.js',
  'mini-games.js',
  'mood-status.js',
  'date-reminders.js',
  'ai-features.js',
  'chat-export.js',
  'music-player.js',
  'music-library.js',
  'playlist-core.js',
  'playlist-ui.js',
  'playlist-sync.js',
  'call-controller.js',
  'group-call.js',
  'call-history.js',
  'archive-chat.js',
  'forward-modal.js',
  'block-user.js',
  'message-reactions.js',
  'delete-group.js',
  'profile-edit.js',
  'app-lock.js',
  'video-notes.js',
  'in-call-reactions.js',
  'status.js',
  'status-viewer.js',
  'notification-nav.js',
  'unread-polish.js',
  'home-camera.js',
  'group-features.js',
  // UI-UX enhancement modules
  'onboarding.js',
  'empty-states.js',
  'form-validation.js',
  'toast-ux.js',
  'a11y-enhancements.js',
  'message-errors.js',
  // Feature modules (v3.5)
  'report-user.js',
  'gif-picker.js',
  'sticker-packs.js',
  'micro-interactions.js',
  'profile-setup.js',
  'lazy-images.js',
  // Android native bridges
  'biometric.js',
  'screenshot-protection.js',
  'in-app-update.js',
  'app-shortcuts.js',
  'haptic-feedback.js',
  'app-init.js',
];

// HTML pages
const HTML_PAGES = [
  'index.html',
  'login.html',
  'album.html',
  'calendar.html',
  'expenses.html',
  'insights.html',
  'reset.html',
  'verify.html',
  'turn.html',
];

// Inline script files to extract from index.html
const INLINE_SCRIPTS = [
  'inline-sw-register.js',
  'inline-broadcast-channel.js',
  'inline-version.js',
  'inline-idle-timeout.js',
];

// CSS files
const CSS_FILES = [
  'chat-theme.css',
  'redesign-base.css',
  'chat-enhancements.css',
  'chat.css',
  'chat-missing-features.css',
  'accessibility.css',
  'message-actions.css',
  'scheduled-calendar.css',
  'notification-prefs.css',
  'url-preview.css',
  'translation-ui.css',
  'sync-audit.css',
  'snooze-history.css',
  'snooze-enhancements.css',
  'chat-consolidated.css',
  'new-features.css',
  'auth-theme.css',
];

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  try {
    copyFileSync(resolve(ROOT, src), resolve(dest));
  } catch (e) {
    // Parent dir files may be one level up
    try {
      copyFileSync(resolve(ROOT, '..', src), resolve(dest));
    } catch (_) {
      console.warn(`[warn] Could not copy ${src}`);
    }
  }
}

function readFile(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function readParentFile(path) {
  try {
    return readFileSync(resolve(ROOT, '..', path), 'utf8');
  } catch (_) {
    return readFileSync(resolve(ROOT, path), 'utf8');
  }
}

function hash(content) {
  return createHash('md5').update(content).digest('hex').slice(0, 8);
}

// ── Step 0: Clean DIST ──
if (existsSync(DIST)) {
  console.log('[build] Cleaning dist directory...');
  try {
    rmSync(DIST, { recursive: true, force: true });
  } catch (e) {
    console.warn('[warn] Failed to clean dist:', e.message);
  }
}

// ── Step 1: Bundle JS ──
console.log('[build] Bundling JS files...');
let bundle = '/* NSL Chat Bundle - Built ' + new Date().toISOString() + ' */\n';
let filesBundled = 0;

for (const file of BUNDLE_ORDER) {
  try {
    let content;
    // Try parent dir first for app-extras.js and app.js
    if (file === 'app-extras.js' || file === 'app.js') {
      content = readParentFile(file);
    } else {
      content = readFile(file);
    }
    bundle += `\n/* ═══ ${file} ═══ */\n`;
    bundle += content;
    filesBundled++;
  } catch (e) {
    console.warn(`[warn] Skipping ${file}: ${e.message}`);
  }
}

/* ── Minification passes ── */
// Strip console.log(...) lines (preserve console.warn/error)
bundle = bundle.replace(/^\s*console\.log\s*\([^)]*\)\s*;?\s*$/gm, '');

// Strip single-line // comments (not inside strings, not URLs)
bundle = bundle.replace(/(^\s+)(\/\/(?!\/)(?!.*https?:\/\/)[^\n]*)/gm, '$1');

// Collapse multiple newlines into one
bundle = bundle.replace(/\n{3,}/g, '\n\n');

// Strip trailing whitespace per line
bundle = bundle.replace(/[ \t]+$/gm, '');

ensureDir(DIST);
const buildVersion = Date.now().toString();
writeFileSync(join(DIST, 'version.json'), JSON.stringify({ version: buildVersion }));
console.log(`[build] Created version.json (Build ID: ${buildVersion})`);

const jsHash = hash(bundle);
const jsFilename = `app-bundle.${jsHash}.js`;
writeFileSync(join(DIST, jsFilename), bundle);
console.log(`[build] Bundled ${filesBundled} files → ${jsFilename} (${(bundle.length / 1024).toFixed(1)} KB)`);

// ── Step 1.5: Bundle CSS ──
console.log('[build] Bundling CSS files...');
let cssBundle = '';
for (const file of CSS_FILES) {
  try {
    const content = readFile(file);
    cssBundle += `\n/* ═══ ${file} ═══ */\n`;
    cssBundle += content;
  } catch (e) {
    console.warn(`[warn] Skipping CSS file ${file}: ${e.message}`);
  }
}
const cssHash = hash(cssBundle);
const cssFilename = `chat-bundle.${cssHash}.css`;
writeFileSync(join(DIST, cssFilename), cssBundle);
console.log(`[build] Bundled CSS files → ${cssFilename} (${(cssBundle.length / 1024).toFixed(1)} KB)`);

// ── Step 2: Copy notification-sounds.js separately (loaded with defer) ──
try {
  copyFile('notification-sounds.js', join(DIST, 'notification-sounds.js'));
} catch (_) {}

// ── Step 3: Extract inline scripts from index.html ──
console.log('[build] Extracting inline scripts...');
const indexHtml = readFile('index.html');

// Inline SW registration script
const swScript = `/* PWA Service Worker Registration & Version Control */
(function() {
  if (!('serviceWorker' in navigator)) return;

  // ── Strategy 2: Listen for Controller Changes (New SW Activation) ──
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  // ── Strategy 3: Check version.json for updates ──
  function checkVersion() {
    fetch('/works/chat/version.json?t=' + Date.now())
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data || !data.version) return;
        const currentVersion = localStorage.getItem('nsl_app_version');
        
        // If no version stored yet, set it and initialize
        if (!currentVersion) {
          localStorage.setItem('nsl_app_version', data.version);
          return;
        }

        // If version has changed, clear caches and reload
        if (currentVersion !== data.version) {
          console.log('[VersionControl] New update detected:', data.version, '. Cleaning caches...');
          localStorage.setItem('nsl_app_version', data.version);
          
          // Clear all caches
          if ('caches' in window) {
            caches.keys().then(function(keys) {
              return Promise.all(keys.map(function(key) {
                return caches.delete(key);
              }));
            }).then(function() {
              // Unregister service workers
              navigator.serviceWorker.getRegistrations().then(function(regs) {
                return Promise.all(regs.map(function(reg) {
                  return reg.unregister();
                }));
              }).then(function() {
                console.log('[VersionControl] Caches and SW cleared. Reloading page...');
                window.location.reload();
              });
            }).catch(function() {
              window.location.reload();
            });
          } else {
            window.location.reload();
          }
        }
      })
      .catch(function(err) {
        console.warn('[VersionControl] Check failed:', err);
      });
  }

  // Run version check on load
  checkVersion();

  // Register service worker
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(function(reg) {
        console.log('[SW] Registered:', reg.scope);
        // Force service worker update check
        if (typeof reg.update === 'function') reg.update().catch(function() {});
      })
      .catch(function(err) {
        console.warn('[SW] Registration failed:', err);
      });
  });
})();

/* M2: Sidebar expand/collapse toggle */
window.toggleSidebarExpand = function() {
  var sidebar = document.getElementById('sidebar');
  var icon = document.getElementById('sidebar-toggle-icon');
  if (!sidebar) return;
  if (sidebar.classList.contains('w-20')) {
    sidebar.classList.remove('w-20');
    sidebar.classList.add('w-64');
    if (icon) icon.textContent = 'menu';
  } else {
    sidebar.classList.remove('w-64');
    sidebar.classList.add('w-20');
    if (icon) icon.textContent = 'menu_open';
  }
};

window.addEventListener('load', () => {
  if (window.ErrorBoundary) ErrorBoundary.init();
  if (window.A11y) A11y.init();
  if (window.KeyboardShortcuts) KeyboardShortcuts.init();
  if (window.SwipeDelete) SwipeDelete.init();
  if (window.BackButton) BackButton.init();
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && window.IOSKeyboardFix) IOSKeyboardFix.init();
  const chatList = document.getElementById('chat-list');
  if (chatList && window.PullToRefresh) PullToRefresh.init(chatList);
  if (window.PinchZoom) PinchZoom.init(document.getElementById('messages-wrap'));

  setTimeout(async () => {
    if (window.OfflineQueue) await OfflineQueue.init();
  }, 3000);
});

firebase.auth().onAuthStateChanged((user) => {
  window.currentUser = user || null;
  if (user) {
    setTimeout(async () => {
      if (window.Presence) await Presence.init();
      if (window.MultiDevice) await MultiDevice.init();
      if (window.Security) await Security.init();
    }, 2000);
  } else {
    if (window.Presence) Presence.destroy();
    if (window.MultiDevice) MultiDevice.destroy();
    if (window.Security) Security.destroy();
    window.location.replace('login.html');
  }
});`;

writeFileSync(join(DIST, 'inline-sw-register.js'), swScript);

// BroadcastChannel script
const bcScript = `/* D-C5: Multi-window support via BroadcastChannel */
(function() {
  if (!('BroadcastChannel' in window)) return;
  const channel = new BroadcastChannel('nsl-chat-sync');
  channel.onmessage = function(e) {
    if (!e.data || !e.data.type) return;
    switch (e.data.type) {
      case 'new-message':
        if (e.data.chatId && typeof window.currentChat !== 'undefined' && e.data.chatId !== window.currentChat) {
          if (typeof showToast === 'function') showToast('New message in ' + (e.data.chatName || 'another chat'), 'info');
        }
        break;
      case 'call-incoming':
        if (typeof e.data.callId !== 'undefined') {
          if (typeof showIncomingCall === 'function') showIncomingCall(e.data.callId, e.data.callerName, e.data.callType);
        }
        break;
      case 'logout':
        window.location.reload();
        break;
      case 'theme-change':
        if (e.data.dark) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        break;
      case 'focus-chat':
        if (e.data.chatId && typeof openChat === 'function') {
          openChat(e.data.chatId, e.data.chatType || 'direct');
        }
        break;
    }
  };
  window.NSLBroadcastChannel = channel;
  window.broadcastToTabs = function(type, data) {
    try { channel.postMessage({ type, ...data }); } catch (_) {}
  };
  const origToggle = window.toggleTheme;
  window.toggleTheme = function() {
    if (origToggle) origToggle();
    const isDark = document.documentElement.classList.contains('dark');
    channel.postMessage({ type: 'theme-change', dark: isDark });
  };
})();`;

writeFileSync(join(DIST, 'inline-broadcast-channel.js'), bcScript);

// Version display script — reads from version.js single source of truth
const versionScript = `/* D-L7: App version display in console (backwards compat for build output) */
(function() {
  /* Version is defined in version.js — this is a fallback for bundled builds */
  if (window.NSL_VERSION) {
    console.log('%c NSL Chat v' + window.NSL_VERSION + ' ', 'background:#008069;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;');
  }
  document.addEventListener('DOMContentLoaded', function() {
    if (!document.title.includes('NSL Chat')) document.title = 'NSL Chat';
  });
})();`;

writeFileSync(join(DIST, 'inline-version.js'), versionScript);

// Idle timeout script
const idleScript = `
(function() {
  window.resetAppState = function() {
    if (typeof window.currentChat !== 'undefined') window.currentChat = null;
    if (typeof window.currentChatType !== 'undefined') window.currentChatType = null;
    if (typeof window.MutationBus !== 'undefined') MutationBus.destroyAll();
    if (typeof window.ChatEnhancements !== 'undefined') ChatEnhancements.destroy();
    if (typeof window.UICompliance !== 'undefined') UICompliance.destroy();
    if (typeof window.AuditInteractions !== 'undefined') AuditInteractions.destroy();
    if (typeof window.WAEnhance !== 'undefined') WAEnhance.destroy();
    if (typeof window.Security !== 'undefined') Security.destroy();
    if (typeof window.OfflineQueue !== 'undefined') OfflineQueue.destroy && OfflineQueue.destroy();
    if (window.NSLBroadcastChannel) {
      try { window.NSLBroadcastChannel.postMessage({ type: 'logout' }); } catch(_) {}
    }
  };
})();
`;

writeFileSync(join(DIST, 'inline-idle-timeout.js'), idleScript);

// ── Step 4: Process index.html ──
console.log('[build] Processing HTML files...');

function processIndexHtml() {
  let html = readFile('index.html');

  // Remove the Tailwind CDN script tag (we use build-time CSS now)
  html = html.replace(/<script src="https:\/\/cdn\.tailwindcss\.com\?plugins=forms,container-queries"><\/script>\s*\n?/, '');

  // Remove the inline tailwind config script
  html = html.replace(/<script id="tailwind-config">[\s\S]*?<\/script>\s*\n?/, '');

  // Replace all individual CSS links with bundled CSS and app.css
  const cssLinkRegex = /<link rel="stylesheet" href="(?:chat-theme|redesign-base|chat-enhancements|chat-consolidated|chat|chat-missing-features|accessibility|message-actions|scheduled-calendar|notification-prefs|url-preview|translation-ui|sync-audit|snooze-history|snooze-enhancements|new-features|auth-theme)\.css">\s*\n?/g;
  html = html.replace(cssLinkRegex, '');
  
  html = html.replace(
    /<!-- Consolidated Theme CSS \(responsive \+ dark\/light mode\) -->\s*\n?/,
    `<link rel="stylesheet" href="app.css">\n  <link rel="stylesheet" href="${cssFilename}">\n`
  );

  // Remove noscript from <head> (invalid HTML, move to body)
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>\s*\n?/, '');

  // Add noscript to body
  html = html.replace(/<body([^>]*)>/, `<body$1>\n  <noscript><div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#11131c;color:#e1e1ef;font-family:system-ui,sans-serif;padding:24px;text-align:center;"><div><h1 style="font-size:24px;margin-bottom:12px;">NSL Chat requires JavaScript</h1><p style="color:#918fa0;font-size:14px;">Please enable JavaScript in your browser settings to use NSL Chat.</p></div></div></noscript>`);

  // Replace all individual local script tags with bundle
  const scriptRegex = /<script src="(?!http)[^"]*\.js"(?:\s*[^>]*)?><\/script>\s*\n?/g;
  html = html.replace(scriptRegex, '');

  // Remove inline script blocks
  html = html.replace(/<!-- PWA Service Worker Registration -->\s*<script>[\s\S]*?<\/script>/, '');
  html = html.replace(/<!-- D-C5: Multi-window support via BroadcastChannel -->\s*<script>[\s\S]*?<\/script>/, '');
  html = html.replace(/<!-- D-L7: App version display in console -->\s*<script>[\s\S]*?<\/script>/, '');
  html = html.replace(/<!-- C5: Auto-logout on 20min idle.*?-->\s*<script>[\s\S]*?<\/script>/, '');

  // Insert bundle + extracted scripts before closing body
  const scriptTags = `  <script src="notification-sounds.js" defer></script>\n  <script src="${jsFilename}"></script>\n  <script src="inline-sw-register.js"></script>\n  <script src="inline-broadcast-channel.js"></script>\n  <script src="inline-version.js"></script>\n  <script src="inline-idle-timeout.js"></script>\n`;

  // Insert before </body>
  html = html.replace(/<\/body>/, scriptTags + '</body>');

  // Production CSP — nonce-based where possible, unsafe-inline for inline onclick handlers
  html = html.replace(
    /<meta http-equiv="Content-Security-Policy" content="[^"]*">/,
    `<meta http-equiv="Content-Security-Policy" content="default-src 'self' https: blob: data:; script-src 'self' 'unsafe-eval' https://www.gstatic.com https://unpkg.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: blob: data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https: wss://*.firebaseio.com; frame-src 'self' https:; worker-src 'self' blob:; frame-ancestors 'self'; form-action 'self'; base-uri 'self';">`
  );

  return html;
}

// Process other HTML pages
function processOtherHtml(filename) {
  let html = readFile(filename);

  // Remove Tailwind CDN and inline config if present
  html = html.replace(/<script src="https:\/\/cdn\.tailwindcss\.com[^"]*"><\/script>\s*\n?/, '');
  html = html.replace(/<script id="tailwind-config">[\s\S]*?<\/script>\s*\n?/, '');

  // Replace individual JS tags with just the files that page needs
  // (these pages have fewer scripts - just redesign-base.js)
  html = html.replace(
    /<script src="(?:\.\/)?redesign-base\.js(?:\?[^"]*)?"><\/script>/g,
    `<script src="${jsFilename}"></script>`
  );

  return html;
}

// Write processed index.html
writeFileSync(join(DIST, 'index.html'), processIndexHtml());

// Write other pages
for (const page of HTML_PAGES) {
  if (page === 'index.html') continue;
  let processed;
  if (page === 'login.html') {
    processed = readFile(page);
    // Remove tailwind CDN and config
    processed = processed.replace(/<script src="https:\/\/cdn\.tailwindcss\.com[^"]*"><\/script>\s*\n?/, '');
    processed = processed.replace(/<script id="tailwind-config">[\s\S]*?<\/script>\s*\n?/, '');
    // Remove inline scripts from login too
    processed = processed.replace(/<script>\s*\/\* NSL Login[\s\S]*?<\/script>/, '');
    // Add app.css for login
    processed = processed.replace(
      /(<link rel="stylesheet" href="chat-theme\.css">)/,
      '$1\n  <link rel="stylesheet" href="app.css">'
    );
  } else {
    try { processed = processOtherHtml(page); } catch (_) { continue; }
  }
  writeFileSync(join(DIST, page), processed);
}

// ── Step 5: Copy static assets ──
console.log('[build] Copying static assets...');
ensureDir(join(DIST, 'sounds'));

// Copy JS files not in bundle (processing sw.js for dynamic caching)
const extraJs = ['sw.js', 'notification-sounds.js', 'pwa-install.js', 'version.js', 'lazy-modules.js'];
for (const f of extraJs) {
  try {
    if (f === 'sw.js') {
      let swContent = readFile('sw.js');
      swContent = swContent.replace(
        "const CACHE_NAME = 'nsl-chat-v2.5.1';",
        `const CACHE_NAME = 'nsl-chat-v2.5.1-${jsHash}';`
      );
      const newStaticAssets = `const STATIC_ASSETS = [
  'app.css',
  '${cssFilename}',
  'config.js',
  'notification-sounds.js',
  'manifest.json',
  'app-icon.svg',
  'app-icon-192.png',
  'app-icon-512.png',
  'pwa-install.js',
  '${jsFilename}',
  'inline-sw-register.js',
  'inline-broadcast-channel.js',
  'inline-version.js',
  'inline-idle-timeout.js'
];`;
      swContent = swContent.replace(/const STATIC_ASSETS = \[\s*[\s\S]*?\];/m, newStaticAssets);
      writeFileSync(join(DIST, 'sw.js'), swContent);
    } else {
      copyFile(f, join(DIST, f));
    }
  } catch (_) {}
}

// Copy parent dir files
const parentFiles = ['app.js', 'app-extras.js'];
for (const f of parentFiles) {
  try {
    const content = readParentFile(f);
    writeFileSync(join(DIST, f), content);
  } catch (_) {}
}

// Copy images
const imageFiles = readdirSync(ROOT).filter(f =>
  /\.(png|jpg|jpeg|gif|svg|ico|webp|apk)$/i.test(f)
);
for (const f of imageFiles) {
  copyFile(f, join(DIST, f));
}

// Copy sounds
const soundsDir = join(ROOT, 'sounds');
if (statSync(soundsDir, { throwOnError: false })) {
  readdirSync(soundsDir).forEach(f => {
    const src = join(soundsDir, f);
    if (statSync(src).isFile()) {
      copyFileSync(src, join(DIST, 'sounds', f));
    }
  });
}

// Copy CSS files
for (const css of CSS_FILES) {
  try { copyFile(css, join(DIST, css)); } catch (_) {}
}

// Compile and copy app.css (runs Tailwind v4 CLI dynamically)
try {
  console.log('[build] Compiling Tailwind CSS v4 via CLI...');
  const { execSync } = require('child_process');
  const fs = require('fs');
  const localCli = join(ROOT, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
  let cmd = 'npx tailwindcss -i app.css -o dist/app.css --minify';
  if (fs.existsSync(localCli)) {
    cmd = `node "${localCli}" -i app.css -o dist/app.css --minify`;
  }
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
  console.log('[build] Tailwind CSS compiled successfully to dist/app.css');
} catch (e) {
  console.warn('[build] Tailwind compilation failed, copying raw app.css: ' + e.message);
  try { copyFile('app.css', join(DIST, 'app.css')); } catch (_) {}
}

// Copy manifest
try { copyFile('manifest.json', join(DIST, 'manifest.json')); } catch (_) {}

/* ── Build size report ── */
console.log('\n[build] === Size Report ===');
let totalSize = 0;
const distFiles = readdirSync(DIST);
const jsFiles = distFiles.filter(f => f.endsWith('.js'));
const cssFiles = distFiles.filter(f => f.endsWith('.css'));

jsFiles.forEach(function (f) {
  const s = statSync(join(DIST, f)).size;
  totalSize += s;
  console.log('[build]   ' + f + '  ' + (s / 1024).toFixed(1) + ' KB');
});
cssFiles.forEach(function (f) {
  const s = statSync(join(DIST, f)).size;
  totalSize += s;
  console.log('[build]   ' + f + '  ' + (s / 1024).toFixed(1) + ' KB');
});
console.log('[build] ──────────────────');
console.log('[build] Total (JS+CSS): ' + (totalSize / 1024).toFixed(1) + ' KB (' + (totalSize / 1048576).toFixed(2) + ' MB)');

console.log(`[build] ✓ Build complete!`);
console.log(`[build] Output: ${DIST}`);
console.log(`[build] ${distFiles.length} files in dist/`);
