/* ============================================================
   HTML Sanitizer (D-C7 — XSS Prevention)
   Wraps user-generated content before innerHTML injection.
   Whitelist-based: only allows safe tags/attributes.
   ============================================================ */
(function () {
  'use strict';

  var SAFE_TAGS = new Set([
    'b', 'i', 'u', 'em', 'strong', 'span', 'br', 'p', 'a',
    'code', 'pre', 'blockquote', 'mark', 'small', 'sub', 'sup',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img'
  ]);

  var SAFE_ATTRS = new Set([
    'href', 'target', 'rel', 'title', 'alt', 'src', 'class',
    'width', 'height', 'data-type', 'data-id', 'role',
    'aria-label', 'aria-hidden', 'tabindex', 'colspan', 'rowspan'
  ]);

  var EVENT_ATTR_REGEX = /^on[a-z]/i;

  var DANGEROUS_CSS_PROPS = [
    'position', 'z-index', 'behavior', '-moz-binding',
    'expression', 'javascript', 'vbscript', 'data:'
  ];

  var BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:', 'blob:'];

  var ENTITY_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
  var ENTITY_REGEX = /[&<>"'/]/g;

  /** @param {string} str - Raw string to escape @returns {string} HTML-entity-safe string */
  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(ENTITY_REGEX, function (c) { return ENTITY_MAP[c]; });
  }

  function decodeHTMLEntities(str) {
    if (typeof str !== 'string') return '';
    var el = document.createElement('div');
    el.textContent = str;
    return el.textContent;
  }

  /** @param {string} url - URL to validate @returns {string} The original URL or empty string if dangerous */
  function sanitizeURL(url) {
    if (typeof url !== 'string') return '';
    var decoded = decodeHTMLEntities(url).trim();
    var trimmed = decoded.toLowerCase();
    for (var i = 0; i < BLOCKED_PROTOCOLS.length; i++) {
      if (trimmed.startsWith(BLOCKED_PROTOCOLS[i])) return '';
    }
    var stripped = trimmed.replace(/[\s\x00-\x1f]+/g, ''); // eslint-disable-line no-control-regex
    for (var j = 0; j < BLOCKED_PROTOCOLS.length; j++) {
      if (stripped.startsWith(BLOCKED_PROTOCOLS[j])) return '';
    }
    return url;
  }

  function sanitizeCSSValue(value) {
    if (typeof value !== 'string') return '';
    var lower = value.toLowerCase();
    for (var i = 0; i < DANGEROUS_CSS_PROPS.length; i++) {
      if (lower.indexOf(DANGEROUS_CSS_PROPS[i]) !== -1) return '';
    }
    if (lower.indexOf('url(') !== -1) return '';
    return value;
  }

  function sanitizeAttributes(tagName, attrStr) {
    if (!attrStr) return '';
    var result = [];
    var attrRegex = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    var match;
    while ((match = attrRegex.exec(attrStr))) {
      var name = match[1].toLowerCase();
      var value = match[2] !== undefined ? match[2] : match[3];

      if (EVENT_ATTR_REGEX.test(name)) continue;
      if (!SAFE_ATTRS.has(name)) continue;

      if (name === 'href' || name === 'src') {
        var safeURL = sanitizeURL(value);
        if (safeURL) result.push(name + '="' + escapeHTML(safeURL) + '"');
      } else if (name === 'style') {
        var safeCSS = sanitizeCSSValue(value);
        if (safeCSS) result.push(name + '="' + escapeHTML(safeCSS) + '"');
      } else {
        result.push(name + '="' + escapeHTML(value) + '"');
      }
    }
    return result.join(' ');
  }

  /** @param {string} html - Raw HTML string @returns {string} Sanitized HTML with only safe tags/attributes */
  function sanitize(html) {
    if (typeof html !== 'string') return '';
    if (html.indexOf('<') === -1 && html.indexOf('&') === -1) return html;

    var result = '';
    var i = 0;
    var len = html.length;

    while (i < len) {
      if (html[i] === '<') {
        var isClosing = html[i + 1] === '/';
        var startIdx = isClosing ? i + 2 : i + 1;

        var tagName = '';
        var j = startIdx;
        while (j < len && /[a-zA-Z0-9-]/.test(html[j])) {
          tagName += html[j];
          j++;
        }
        tagName = tagName.toLowerCase();

        if (tagName && SAFE_TAGS.has(tagName)) {
          var tagEnd = j;
          var inQuote = false;
          var quoteChar = '';
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

          var fullTag = html.substring(i, tagEnd + 1);
          var isSelfClosing = fullTag.endsWith('/>');
          var attrStr = html.substring(j, tagEnd).replace(/\/$/, '').trim();

          if (isClosing) {
            result += '</' + tagName + '>';
          } else {
            var safeAttrs = sanitizeAttributes(tagName, attrStr);
            result += '<' + tagName + (safeAttrs ? ' ' + safeAttrs : '') + (isSelfClosing ? ' /' : '') + '>';
          }
          i = tagEnd + 1;
        } else {
          result += escapeHTML(html[i]);
          i++;
        }
      } else {
        result += html[i];
        i++;
      }
    }

    return result;
  }

  window.NSLSanitize = { sanitize: sanitize, escapeHTML: escapeHTML, sanitizeURL: sanitizeURL };
  window.sanitizeHTML = sanitize;
  window.sanitizeContent = sanitize;
  window.escHtml = escapeHTML;

  function safeInner(el, html) {
    if (el) el.innerHTML = sanitize(html);
  }
  window.sanitizeInto = safeInner;

})();
