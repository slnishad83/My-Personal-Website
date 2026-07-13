'use strict';

module.exports = function () {
  global.window = {};
  global.document = {
    createElement: function () {
      return { textContent: '' };
    }
  };

  delete require.cache[require.resolve('../sanitize.js')];
  require('../sanitize.js');

  describe('escapeHTML', function () {
    it('escapes & < > " \' /', function () {
      var result = window.NSLSanitize.escapeHTML('&<>"\'/');
      expect(result).toBe('&amp;&lt;&gt;&quot;&#x27;&#x2F;');
    });

    it('returns empty string for non-string input', function () {
      expect(window.NSLSanitize.escapeHTML(null)).toBe('');
      expect(window.NSLSanitize.escapeHTML(undefined)).toBe('');
      expect(window.NSLSanitize.escapeHTML(123)).toBe('');
    });

    it('returns safe text unchanged', function () {
      expect(window.NSLSanitize.escapeHTML('hello world')).toBe('hello world');
    });
  });

  describe('sanitize()', function () {
    it('strips <script> tags', function () {
      var result = window.sanitizeHTML('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('strips onclick event handlers', function () {
      var result = window.sanitizeHTML('<span onclick="alert(1)">text</span>');
      expect(result).not.toContain('onclick');
    });

    it('blocks javascript: URLs', function () {
      var result = window.sanitizeHTML('<a href="javascript:alert(1)">click</a>');
      expect(result).not.toContain('javascript:');
    });

    it('allows safe tags like <b>, <a>, <img>', function () {
      var result = window.sanitizeHTML('<b>bold</b>');
      expect(result).toContain('<b>');
      expect(result).toContain('</b>');

      var result2 = window.sanitizeHTML('<a href="https://example.com">link</a>');
      expect(result2).toContain('<a');
      expect(result2).toContain('</a>');

      var result3 = window.sanitizeHTML('<img src="pic.jpg" />');
      expect(result3).toContain('<img');
    });

    it('allows safe attributes like href, src, class', function () {
      var result = window.sanitizeHTML('<a href="https://example.com" class="link">text</a>');
      expect(result).toContain('href=');
      expect(result).toContain('class=');
    });

    it('strips unsafe attributes like onclick, onerror', function () {
      var result = window.sanitizeHTML('<img src="x.png" onerror="alert(1)">');
      expect(result).not.toContain('onerror');
      expect(result).toContain('src=');
    });

    it('handles nested tags', function () {
      var result = window.sanitizeHTML('<div><b>bold <i>italic</i></b></div>');
      expect(result).toContain('<b>');
      expect(result).toContain('<i>');
      expect(result).toContain('</i>');
      expect(result).toContain('</b>');
    });

    it('returns empty string for non-string input', function () {
      expect(window.sanitizeHTML(null)).toBe('');
      expect(window.sanitizeHTML(undefined)).toBe('');
      expect(window.sanitizeHTML(42)).toBe('');
    });

    it('returns text without tags as-is', function () {
      expect(window.sanitizeHTML('plain text')).toBe('plain text');
    });
  });

  describe('sanitizeURL()', function () {
    it('blocks javascript: protocol', function () {
      expect(window.NSLSanitize.sanitizeURL('javascript:alert(1)')).toBe('');
    });

    it('blocks data: protocol', function () {
      expect(window.NSLSanitize.sanitizeURL('data:text/html,...')).toBe('');
    });

    it('blocks vbscript: protocol', function () {
      expect(window.NSLSanitize.sanitizeURL('vbscript:msgbox')).toBe('');
    });

    it('allows https URLs', function () {
      expect(window.NSLSanitize.sanitizeURL('https://example.com')).toBe('https://example.com');
    });

    it('allows http URLs', function () {
      expect(window.NSLSanitize.sanitizeURL('http://example.com')).toBe('http://example.com');
    });

    it('returns empty string for non-string input', function () {
      expect(window.NSLSanitize.sanitizeURL(null)).toBe('');
      expect(window.NSLSanitize.sanitizeURL(123)).toBe('');
    });
  });
};
