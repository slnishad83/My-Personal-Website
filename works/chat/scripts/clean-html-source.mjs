import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const DIR = fileURLToPath(new URL('..', import.meta.url));
const htmlFiles = readdirSync(DIR).filter(f => f.endsWith('.html'));

for (const file of htmlFiles) {
  const fp = join(DIR, file);
  let html = readFileSync(fp, 'utf-8');
  const orig = html;

  html = html.replace(/^\s*<link rel="modulepreload"[^>]*href="\.\/assets\/[^"]+"[^>]*>\s*$/gm, '');
  html = html.replace(/^\s*<link rel="stylesheet"[^>]*href="\.\/assets\/[^"]+"[^>]*>\s*$/gm, '');
  html = html.replace(/^\s*<script[^>]*crossorigin[^>]*src="\.\/assets\/[^"]+"[^>]*><\/script>\s*$/gm, '');
  html = html.replace(/^\s*<!-- Vite ES Module Entry.*-->\s*$/gm, '');

  html = html.replace(
    /^\s*<link rel="manifest"[^>]*href="\.\/assets\/[^"]+"[^>]*>\s*$/gm,
    '  <link rel="manifest" href="./manifest.json">\n'
  );

  html = html.replace(
    /^\s*<link rel="apple-touch-icon"[^>]*href="\.\/assets\/[^"]+"[^>]*>\s*$/gm,
    '  <link rel="apple-touch-icon" href="./app-icon-192.png">\n'
  );

  html = html.replace(
    /^\s*<link rel="icon"[^>]*href="\.\/assets\/[^"]+"[^>]*>\s*$/gm,
    '  <link rel="icon" href="./app-icon.svg" type="image/svg+xml">\n'
  );

  if (html !== orig) {
    writeFileSync(fp, html, 'utf-8');
    console.log(`Cleaned: ${file}`);
  } else {
    console.log(`No change: ${file}`);
  }
}
console.log('Done.');
