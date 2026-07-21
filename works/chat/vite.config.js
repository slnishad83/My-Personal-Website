import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Custom plugin: copy static assets (sounds, images, APK, HTML pages) to dist
function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');

      // Copy sounds directory
      const soundsDir = join('.', 'sounds');
      if (statSync(soundsDir, { throwOnError: false })) {
        const destSounds = resolve(distDir, 'sounds');
        mkdirSync(destSounds, { recursive: true });
        readdirSync(soundsDir).forEach(file => {
          const src = join(soundsDir, file);
          if (statSync(src).isFile()) {
            copyFileSync(src, join(destSounds, file));
          }
        });
      }

      // Copy images and APK
      const staticFiles = readdirSync('.').filter(f =>
        /\.(png|jpg|jpeg|gif|svg|ico|webp|apk)$/i.test(f)
      );
      staticFiles.forEach(file => {
        copyFileSync(resolve('.', file), resolve(distDir, file));
      });

      // Copy manifest.json
      if (statSync('manifest.json', { throwOnError: false })) {
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

export default defineConfig({
  root: '.',
  plugins: [
    tailwindcss(),
    copyStaticAssets(),
    generateVersionJson()
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
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
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('call-controller') || id.includes('group-call') || id.includes('call-history')) {
            return 'feature-calls';
          }
          if (id.includes('notification-orchestrator') || id.includes('notification-prefs') || id.includes('notification-sounds')) {
            return 'feature-notifications';
          }
          if (id.includes('micro-interactions') || id.includes('keyboard-shortcuts') || id.includes('pull-to-refresh')) {
            return 'feature-ux';
          }
        }
      },
    },
    cssMinify: 'lightningcss',
    sourcemap: false,
    target: 'es2020',
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
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
  },
  css: {
    devSourcemap: true,
  },
});
