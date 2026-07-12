/* ============================================================
   HTML Sanitizer (D-C7 — XSS Prevention)
   Wraps user-generated content before innerHTML injection.
   Whitelist-based: only allows safe tags/attributes.
   ============================================================ */
(function () {
  'use strict';

  const SAFE_TAGS = new Set([
    'b', 'i', 'u', 'em', 'strong', 'span', 'br', 'p', 'a',
    'code', 'pre', 'blockquote', 'mark', 'small', 'sub', 'sup',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img',
    'svg', 'path', 'circle', 'line', 'polyline', 'rect'
  ]);

  const SAFE_ATTRS = new Set([
    'href', 'target', 'rel', 'title', 'alt', 'src', 'class',
    'style', 'width', 'height', 'viewBox', 'fill', 'stroke',
    'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd',
    'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'points', 'rx', 'ry', 'data-type', 'data-id', 'role',
    'aria-label', 'aria-hidden', 'tabindex', 'colspan', 'rowspan'
  ]);

  const BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:'];

  const ENTITY_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
  const ENTITY_REGEX = /[&<>"']/g;

  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(ENTITY_REGEX, c => ENTITY_MAP[c]);
  }

  function sanitizeURL(url) {
    if (typeof url !== 'string') return '';
    const trimmed = url.trim().toLowerCase();
    for (const proto of BLOCKED_PROTOCOLS) {
      if (trimmed.startsWith(proto)) return '';
    }
    return url;
  }

  function sanitizeAttributes(tagName, attrStr) {
    if (!attrStr) return '';
    const result = [];
    const attrRegex = /([a-zA-Z\-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let match;
    while ((match = attrRegex.exec(attrStr))) {
      const name = match[1].toLowerCase();
      const value = match[2] !== undefined ? match[2] : match[3];
      if (SAFE_ATTRS.has(name)) {
        if (name === 'href' || name === 'src') {
          const safeURL = sanitizeURL(value);
          if (safeURL) result.push(`${name}="${escapeHTML(safeURL)}"`);
        } else {
          result.push(`${name}="${escapeHTML(value)}"`);
        }
      }
    }
    return result.join(' ');
  }

  function sanitize(html) {
    if (typeof html !== 'string') return '';
    if (html.indexOf('<') === -1 && html.indexOf('&') === -1) return html;

    let result = '';
    let i = 0;
    const len = html.length;

    while (i < len) {
      if (html[i] === '<') {
        // Check for closing tag
        const isClosing = html[i + 1] === '/';
        const startIdx = isClosing ? i + 2 : i + 1;

        // Read tag name
        let tagName = '';
        let j = startIdx;
        while (j < len && /[a-zA-Z0-9\-]/.test(html[j])) {
          tagName += html[j];
          j++;
        }
        tagName = tagName.toLowerCase();

        if (tagName && SAFE_TAGS.has(tagName)) {
          // Find end of opening tag
          let tagEnd = j;
          let inQuote = false;
          let quoteChar = '';
          while (tagEnd < len) {
            if (inQuote) {
              if (html[tagEnd] === quoteChar) inQuote = false;
            } else {
              if (html[tagEnd] === '"' || html[tagEnd] === "'") {
                inQuote = true;
                quoteChar = html[tagEnd];
              } else if (html[tagEnd] === '>') {
                break;
              }
            }
            tagEnd++;
          }

          const fullTag = html.substring(i, tagEnd + 1);
          const isSelfClosing = fullTag.endsWith('/>');
          const attrStr = html.substring(j, tagEnd).replace(/\/$/, '').trim();

          if (isClosing) {
            result += `</${tagName}>`;
          } else {
            const safeAttrs = sanitizeAttributes(tagName, attrStr);
            result += `<${tagName}${safeAttrs ? ' ' + safeAttrs : ''}${isSelfClosing ? ' /' : ''}>`;
          }
          i = tagEnd + 1;
        } else {
          // Unsafe tag — escape it
          result += escapeHTML(html[i]);
          i++;
        }
      } else if (html.substring(i, i + 4) === '&lt;' || html.substring(i, i + 4) === '&gt;' ||
                 html.substring(i, i + 5) === '&amp;' || html.substring(i, i + 6) === '&quot;') {
        // Already escaped HTML entities — pass through
        result += html[i];
        i++;
      } else {
        result += html[i];
        i++;
      }
    }

    return result;
  }

  // Expose globally
  window.NSLSanitize = { sanitize, escapeHTML, sanitizeURL };

  // Also provide a safe innerHTML helper
  window.sanitizeHTML = sanitize;
  window.sanitizeContent = sanitize;

  // Monkey-patch helper: use this in place of innerHTML for user content
  function safeInner(el, html) {
    if (el) el.innerHTML = sanitize(html);
  }
  window.sanitizeInto = safeInner;

})();
