'use strict';
function renderEmojis(el) {
  if (typeof twemoji === 'undefined' || !el) return;
  twemoji.parse(el, { folder: 'svg', ext: '.svg', base: './twemoji/svg/' });
  el.querySelectorAll('img.emoji').forEach(img => {
    img.style.cssText = 'display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.2em;margin:0 1px;';
  });
}
