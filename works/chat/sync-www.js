#!/usr/bin/env node
/**
 * sync-www.js — keeps works/chat/www/ in perfect sync with works/chat/
 *
 * Run manually:  node works/chat/sync-www.js
 * Run via CI:    See .github/workflows/firebase-deploy.yml
 *
 * What it syncs:
 *   1. Every .js and .css source file (except dev-only tools)
 *   2. The CSS <link> block in www/index.html (between canonical → manifest)
 *   3. The app <script> block in www/index.html (after Firebase CDN scripts)
 *
 * What it does NOT touch:
 *   - www/index.html body HTML, modals, or Capacitor-specific tags
 *   - Files that live only in www/ (native Capacitor configs)
 */

const fs   = require('fs');
const path = require('path');

const CHAT_DIR = __dirname;               // works/chat/
const WWW_DIR  = path.join(CHAT_DIR, 'www');

// Files to skip (dev tools, not runtime assets)
const EXCLUDE = new Set(['eslint.config.js', 'sync-www.js']);

// ── 1. Sync JS/CSS source files ──────────────────────────────────────────
const entries = fs.readdirSync(CHAT_DIR);
const copied  = [];
const skipped = [];
for (const name of entries) {
  if (!/\.(js|css)$/.test(name)) continue;
  if (EXCLUDE.has(name)) { skipped.push(name); continue; }
  const src = path.join(CHAT_DIR, name);
  const dst = path.join(WWW_DIR,  name);
  if (!fs.statSync(src).isFile()) continue;
  fs.copyFileSync(src, dst);
  copied.push(name);
}
console.log(`[sync-www] Files synced : ${copied.length}`);
if (skipped.length) console.log(`[sync-www] Files skipped: ${skipped.join(', ')}`);

// ── 2+3. Sync CSS and scripts blocks in www/index.html ───────────────────
const CSS_START = '<link rel="canonical"';
const CSS_END   = '<link rel="manifest"';
const JS_START  = 'firebase-messaging-compat.js';
const JS_END    = '</body>';

function extractBlock(lines, startMarker, endMarker) {
  let startI = -1, endI = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startI === -1 && lines[i].includes(startMarker)) startI = i;
    else if (startI !== -1 && endI === -1 && lines[i].includes(endMarker)) { endI = i; break; }
  }
  if (startI === -1 || endI === -1) throw new Error(`Anchors not found: "${startMarker}" / "${endMarker}"`);
  return { startI, endI, block: lines.slice(startI + 1, endI).join('\n') };
}

function replaceBlock(lines, startMarker, endMarker, newBlock) {
  const { startI, endI } = extractBlock(lines, startMarker, endMarker);
  return [
    ...lines.slice(0, startI + 1),
    newBlock,
    ...lines.slice(endI),
  ].join('\n');
}

const webLines = fs.readFileSync(path.join(CHAT_DIR, 'index.html'), 'utf8').split('\n');
let   wwwHtml  = fs.readFileSync(path.join(WWW_DIR,  'index.html'), 'utf8');

const cssBlock = extractBlock(webLines, CSS_START, CSS_END).block;
const jsBlock  = extractBlock(webLines, JS_START,  JS_END).block;

let wwwLines = wwwHtml.split('\n');
wwwLines = replaceBlock(wwwLines, CSS_START, CSS_END, cssBlock).split('\n');
wwwLines = replaceBlock(wwwLines, JS_START,  JS_END,  jsBlock).split('\n');

fs.writeFileSync(path.join(WWW_DIR, 'index.html'), wwwLines.join('\n'), 'utf8');

console.log('[sync-www] www/index.html — CSS links block synced');
console.log('[sync-www] www/index.html — app scripts block synced');
console.log('[sync-www] Done. www/ is now in sync with the web version.');
