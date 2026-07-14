import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { writeFileSync, readFileSync, copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Custom plugin to copy static assets (JS files, images, etc.) to dist
function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');

      // JS files to copy
      const jsFiles = readdirSync('.').filter(f => f.endsWith('.js') && !f.startsWith('vite'));

      // Copy JS files
      jsFiles.forEach(file => {
        copyFileSync(resolve('.', file), resolve(distDir, file));
      });

      // Copy images
      const imageFiles = readdirSync('.').filter(f =>
        /\.(png|jpg|jpeg|gif|svg|ico|webp|apk)$/i.test(f)
      );
      imageFiles.forEach(file => {
        copyFileSync(resolve('.', file), resolve(distDir, file));
      });

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

      console.log('[copy-static-assets] Copied JS, images, and sounds to dist/');
    }
  };
}

export default defineConfig({
  root: '.',
  plugins: [tailwindcss(), copyStaticAssets()],
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
      },
    },
    cssMinify: true,
    sourcemap: false,
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    open: '/works/chat/login.html',
  },
});
