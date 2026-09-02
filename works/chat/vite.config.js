import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync, statSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

/* Read Firebase config once � single source of truth */
const firebaseConfig = JSON.parse(readFileSync('firebase-env.json', 'utf-8'));

// Custom plugin: copy static assets (sounds, images, APK, HTML pages) to dist
function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');

      // Copy sounds directory
      const soundsDir = join('.', 'sounds');
      if (existsSync(soundsDir)) {
        const destSounds = resolve(distDir, 'sounds');
        mkdirSync(destSounds, { recursive: true });
        readdirSync(soundsDir).forEach(file => {
          const src = join(soundsDir, file);
          if (statSync(src).isFile()) {
            copyFileSync(src, join(destSounds, file));
          }
        });
      }

      // Copy images (no executables — APKs break Firebase Spark plan)
      const staticFiles = readdirSync('.').filter(f =>
        /\.(png|jpg|jpeg|gif|svg|ico|webp)$/i.test(f)
      );
      staticFiles.forEach(file => {
        copyFileSync(resolve('.', file), resolve(distDir, file));
      });

      // Copy non-module JS files referenced by HTML pages
      const staticJsFiles = ['firebase-config.js', 'dnd-quiet-hours.js', 'redesign-base.js', 'monitoring.js'];
      staticJsFiles.forEach(file => {
        const src = resolve('.', file);
        if (existsSync(src)) {
          copyFileSync(src, resolve(distDir, file));
        }
      });

      // Copy CSS files for login.html (not processed by Vite bundler)
      const staticCssFiles = ['auth-theme.css', 'login-styles.css'];
      staticCssFiles.forEach(file => {
        const src = resolve('.', file);
        if (existsSync(src)) {
          copyFileSync(src, resolve(distDir, file));
        }
      });

      // Copy manifest.json
      if (existsSync('manifest.json')) {
        copyFileSync('manifest.json', resolve(distDir, 'manifest.json'));
      }

      console.log('[build] Static assets copied to dist/');
    }
  };
}

// Custom plugin: generate version.json for cache busting
function generateVersionJson() {
  return {
    name: 'generate-version',
    generateBundle() {
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
      const version = {
        version: pkg.version,
        buildTime: new Date().toISOString(),
        cacheName: `nsl-chat-v${pkg.version}`
      };
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(version, null, 2)
      });
    }
  };
}

// Custom plugin: generate sw.js with Firebase config injected from firebase-env.json
function generateSwPlugin() {
  const pkgVersion = JSON.parse(readFileSync('package.json', 'utf-8')).version;
  return {
    name: 'generate-sw',
    generateBundle() {
      let sw = readFileSync('sw.js', 'utf-8');
      // Replace the placeholder with the actual config
      sw = sw.replace(
        /\/\* __FIREBASE_CONFIG__ \*\/\s*\{[^}]+\}/,
        JSON.stringify(firebaseConfig)
      );
      // Version-derived cache name so each release busts stale SW caches
      sw = sw.replace(/var CACHE_NAME = __CACHE_NAME__;/, `var CACHE_NAME = 'nsl-chat-v${pkgVersion}';`);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: sw
      });
    }
  };
}

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/works/chat/' : './',
  root: '.',
  plugins: [
    tailwindcss(),
    copyStaticAssets(),
    generateVersionJson(),
    generateSwPlugin()
  ],
  define: {
    __FIREBASE_CONFIG__: JSON.stringify(firebaseConfig)
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    esbuild: {
      pure: ['console.log', 'console.info'],
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        album: resolve(__dirname, 'album.html'),
        calendar: resolve(__dirname, 'calendar.html'),
        expenses: resolve(__dirname, 'expenses.html'),
        insights: resolve(__dirname, 'insights.html'),
        reset: resolve(__dirname, 'reset.html'),
        verify: resolve(__dirname, 'verify.html'),
        turn: resolve(__dirname, 'turn.html'),
        offline: resolve(__dirname, 'offline.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          // Vendor: all node_modules into a single chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          // jsQR is 251KB � put in its own chunk (only loaded on QR scan)
          if (id.includes('jsQR')) {
            return 'lib-qr';
          }
          // twemoji (~17KB) � separate chunk for cache efficiency
          if (id.includes('twemoji')) {
            return 'lib-twemoji';
          }
          // Calls & real-time
          if (id.includes('call-controller') || id.includes('group-call') || id.includes('call-history') ||
              id.includes('call-sync') || id.includes('background-call-handler') || id.includes('call-link') ||
              id.includes('in-call-reactions') || id.includes('ios-callkit')) {
            return 'feature-calls';
          }
          // Notifications subsystem
          if (id.includes('notification-orchestrator') || id.includes('notification-prefs') ||
              id.includes('notification-sounds') || id.includes('notification-digest') ||
              id.includes('notification-bell') || id.includes('notification-telemetry') ||
              id.includes('notification-reply') || id.includes('notification-nav') ||
              id.includes('push-notifications')) {
            return 'feature-notifications';
          }
          // UI enhancements & micro-interactions
          if (id.includes('micro-interactions') || id.includes('keyboard-shortcuts') ||
              id.includes('pull-to-refresh') || id.includes('pinch-zoom') ||
              id.includes('swipe-delete') || id.includes('swipe-nav') ||
              id.includes('haptic-feedback') || id.includes('toast-ux') ||
              id.includes('a11y-enhancements') || id.includes('empty-states') ||
              id.includes('form-validation') || id.includes('redesign-base')) {
            return 'feature-ux';
          }
          // Music & media features
          if (id.includes('music-player') || id.includes('music-library') ||
              id.includes('playlist-core') || id.includes('playlist-ui') ||
              id.includes('playlist-sync')) {
            return 'feature-music';
          }
          // Chat-specific features
          if (id.includes('chat-enhancements') || id.includes('chat-fixes') ||
              id.includes('chat-missing') || id.includes('chat-export') ||
              id.includes('chat-lock') || id.includes('chat-permissions') ||
              id.includes('chat-mark-unread') || id.includes('chat-drafts') ||
              id.includes('chat-scroll') || id.includes('chat-folders') ||
              id.includes('chat-calculator')) {
            return 'feature-chat';
          }
          // Message & content features
          if (id.includes('message-search') || id.includes('message-actions') ||
              id.includes('message-reactions') || id.includes('message-recall') ||
              id.includes('message-scheduler') || id.includes('message-copy') ||
              id.includes('message-translation') || id.includes('message-reminders') ||
              id.includes('message-edit') || id.includes('message-star') ||
              id.includes('threads') || id.includes('mention-autocomplete') ||
              id.includes('quick-replies')) {
            return 'feature-messages';
          }
          // Security & auth
          if (id.includes('security') || id.includes('two-factor') ||
              id.includes('app-lock') || id.includes('biometric') ||
              id.includes('screenshot-protection') || id.includes('account-deletion') ||
              id.includes('privacy-controls') || id.includes('permissions-manager')) {
            return 'feature-security';
          }
          // Desktop/Electron features
          if (id.includes('desktop-notifications') || id.includes('desktop-context-menu') ||
              id.includes('desktop-fullscreen') || id.includes('electron')) {
            return 'feature-desktop';
          }
        }
      },
    },
    cssMinify: 'lightningcss',
    sourcemap: false,
    target: 'es2020',
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@core': resolve(__dirname, 'src/core'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@features': resolve(__dirname, 'src/features'),
    },
  },
  server: {
    port: 3000,
    open: '/works/chat/login.html',
    fs: {
      allow: ['..', '.'],
    },
  },
  css: {
    devSourcemap: true,
  },
}));
