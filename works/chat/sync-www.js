/**
 * sync-www.js — Build & sync web assets to dist/, www/ and root works/chat/
 * 
 * With Vite, this script:
 * 1. Runs `vite build` to produce dist/
 * 2. Copies dist/ contents to www/ (for Capacitor) and ROOT (for GitHub Pages / web hosting)
 * 3. Copies static assets (sounds/, sw.js, etc.)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const WWW = path.join(ROOT, 'www');
const DIST = path.join(ROOT, 'dist');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ── Step 1: Run Vite build ──────────────────────────────
console.log('Building with Vite...');
try {
  const output = execSync('node node_modules/vite/bin/vite.js build', { cwd: ROOT, stdio: 'pipe' });
  console.log(output.toString());
  console.log('Vite build complete.');
} catch (e) {
  console.error('Vite build failed:', e.message);
  process.exit(1);
}

// ── Step 2: Copy dist/ to www/ and ROOT ──────────────────
console.log('\nSyncing dist/ to www/ and root workspace...');
ensureDir(WWW);

// Clear old www contents
for (const entry of fs.readdirSync(WWW)) {
  const entryPath = path.join(WWW, entry);
  fs.rmSync(entryPath, { recursive: true, force: true });
}

// Copy dist contents to www/
copyDirRecursive(DIST, WWW);
console.log('  Copied dist/ -> www/');

// Copy dist assets/ and HTML files to ROOT (works/chat/) for web hosting
const distAssets = path.join(DIST, 'assets');
if (fs.existsSync(distAssets)) {
  copyDirRecursive(distAssets, path.join(ROOT, 'assets'));
  console.log('  Copied dist/assets -> works/chat/assets/');
}

const htmlFiles = fs.readdirSync(DIST).filter(f => f === 'version.json' || f === 'sw.js');
for (const htmlFile of htmlFiles) {
  fs.copyFileSync(path.join(DIST, htmlFile), path.join(ROOT, htmlFile));
}
console.log('  Copied version.json and sw.js -> works/chat/ root');

// ── Step 3: Copy additional static assets not in dist ───
const EXTRA_FILES = [
  'sw.js',
  'manifest.json',
  'firebase-messaging-sw.js',
  'CNAME',
  'twemoji/twemoji.min.js',
  'twemoji/twemoji-config.js',
];

for (const file of EXTRA_FILES) {
  const src = path.join(ROOT, file);
  const dest = path.join(WWW, file);
  if (fs.existsSync(src)) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

// Copy sounds directory
const soundsDir = path.join(ROOT, 'sounds');
if (fs.existsSync(soundsDir)) {
  copyDirRecursive(soundsDir, path.join(WWW, 'sounds'));
}

// Copy static images and APK
const staticRoot = fs.readdirSync(ROOT).filter(f =>
  /\.(png|jpg|jpeg|gif|svg|ico|webp|apk)$/i.test(f)
);
for (const file of staticRoot) {
  fs.copyFileSync(path.join(ROOT, file), path.join(WWW, file));
}

console.log(`\nDone! All compiled assets synced to www/ and root works/chat/.`);
