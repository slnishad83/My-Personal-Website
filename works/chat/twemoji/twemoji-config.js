// Twemoji Configuration - Self-hosted emoji rendering
// This file overrides the default twemoji base URL to point to local SVGs

if (typeof twemoji !== 'undefined') {
  twemoji.parse(document.body, {
    folder: 'svg',
    ext: '.svg',
    base: './twemoji/svg/'
  });
}