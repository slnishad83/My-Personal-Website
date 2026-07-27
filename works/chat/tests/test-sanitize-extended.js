'use strict';

describe('Sanitize — Extended Coverage', function () {

  var ENTITY_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
  var ENTITY_REGEX = /[&<>"'/]/g;

  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(ENTITY_REGEX, function (c) { return ENTITY_MAP[c]; });
  }

  function sanitizeURL(url) {
    if (typeof url !== 'string') return '';
    var decoded = url.trim().toLowerCase();
    var BLOCKED = ['javascript:', 'data:', 'vbscript:', 'file:', 'blob:'];
    for (var i = 0; i < BLOCKED.length; i++) {
      if (decoded.startsWith(BLOCKED[i])) return '';
    }
    return url;
  }

  describe('escapeHTML', function () {
    it('escapes ampersand', function () {
      expect(escapeHTML('a & b')).toBe('a &amp; b');
    });

    it('escapes angle brackets', function () {
      expect(escapeHTML('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes quotes', function () {
      expect(escapeHTML('"hello"')).toBe('&quot;hello&quot;');
    });

    it('escapes single quotes', function () {
      expect(escapeHTML("it's")).toBe("it&#x27;s");
    });

    it('escapes forward slash', function () {
      expect(escapeHTML('a/b')).toBe('a&#x2F;b');
    });

    it('handles empty string', function () {
      expect(escapeHTML('')).toBe('');
    });

    it('handles non-string input', function () {
      expect(escapeHTML(null)).toBe('');
      expect(escapeHTML(undefined)).toBe('');
      expect(escapeHTML(123)).toBe('');
    });

    it('escapes mixed dangerous chars', function () {
      var input = '<img src=x onerror=alert(1)>';
      var result = escapeHTML(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('handles already-escaped HTML', function () {
      expect(escapeHTML('&amp;')).toBe('&amp;amp;');
    });
  });

  describe('sanitizeURL', function () {
    it('allows https URLs', function () {
      expect(sanitizeURL('https://example.com')).toBe('https://example.com');
    });

    it('allows http URLs', function () {
      expect(sanitizeURL('http://example.com')).toBe('http://example.com');
    });

    it('blocks javascript: protocol', function () {
      expect(sanitizeURL('javascript:alert(1)')).toBe('');
    });

    it('blocks data: protocol', function () {
      expect(sanitizeURL('data:text/html,<script>')).toBe('');
    });

    it('blocks vbscript: protocol', function () {
      expect(sanitizeURL('vbscript:MsgBox(1)')).toBe('');
    });

    it('blocks file: protocol', function () {
      expect(sanitizeURL('file:///etc/passwd')).toBe('');
    });

    it('blocks blob: protocol', function () {
      expect(sanitizeURL('blob:https://example.com/id')).toBe('');
    });

    it('handles non-string input', function () {
      expect(sanitizeURL(null)).toBe('');
      expect(sanitizeURL(undefined)).toBe('');
      expect(sanitizeURL(42)).toBe('');
    });

    it('handles empty string', function () {
      expect(sanitizeURL('')).toBe('');
    });

    it('allows mailto: links', function () {
      expect(sanitizeURL('mailto:user@example.com')).toBe('mailto:user@example.com');
    });

    it('blocks case-insensitive javascript:', function () {
      expect(sanitizeURL('JavaScript:alert(1)')).toBe('');
      expect(sanitizeURL('JAVASCRIPT:alert(1)')).toBe('');
    });
  });

  describe('XSS prevention patterns', function () {
    it('script tag injection', function () {
      var input = '<script>alert("xss")</script>';
      var result = escapeHTML(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('event handler injection — tags are escaped so handler is inert', function () {
      var input = '<img src=x onerror=alert(1)>';
      var result = escapeHTML(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('&lt;img');
    });

    it('style injection — tags are escaped so style block is inert', function () {
      var input = '<div style="background:url(javascript:alert(1))">';
      var result = escapeHTML(input);
      expect(result).not.toContain('<div');
      expect(result).toContain('&lt;div');
    });

    it('SVG-based XSS', function () {
      var input = '<svg onload=alert(1)>';
      var result = escapeHTML(input);
      expect(result).not.toContain('<svg');
    });
  });
});
