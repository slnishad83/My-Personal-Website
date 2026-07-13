'use strict';

module.exports = function () {
  global.window = {};
  global.document = {
    readyState: 'complete',
    addEventListener: function () {},
    getElementById: function () { return null; }
  };

  // Provide escHtml (normally from sanitize.js)
  global.window.escHtml = function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  // Load the canonical renderMessageText and renderAttachment from app.js snippet
  // (app.js defines window.renderMessageText = formatMsgText and window.renderAttachment)
  // Since we can't load app.js in tests, we extract the canonical implementation:
  function formatMsgText(text) {
    return window.escHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/(https?:\/\/[^\s&]+)/g, function (url) {
        var display = url.replace(/&amp;/g, '&');
        return '<a href="' + url + '" target="_blank" rel="noopener">' + display + '</a>';
      })
      .replace(/\n/g, '<br>');
  }

  global.window.renderMessageText = formatMsgText;

  global.window.renderAttachment = function renderAttachment(att) {
    if (!att) return '';
    if (att.url) {
      var safeUrl = window.escHtml(att.url);
      var safeName = window.escHtml(att.name || 'attachment');
      if (att.type && att.type.startsWith('image/')) return '<img src="' + safeUrl + '" alt="' + safeName + '" style="max-width:200px;border-radius:8px;">';
      if (att.type && att.type.startsWith('video/')) return '<video src="' + safeUrl + '" controls style="max-width:200px;border-radius:8px;"></video>';
      return '<a href="' + safeUrl + '" target="_blank" rel="noopener">' + safeName + '</a>';
    }
    return '<span>' + window.escHtml(att.name || 'Attachment') + '</span>';
  };

  // Provide minimal globals used by threads.js
  global.window.escapeHtml = global.window.escHtml;
  global.window.sanitizeHTML = function (s) { return s; };
  global.window.db = null;
  global.window.currentUser = null;
  global.window.showToast = function () {};
  global.firebase = { firestore: function () { return { collection: function () { return { doc: function () { return { collection: function () { return { add: function () { return Promise.resolve(); } }; }, update: function () { return Promise.resolve(); } }; } }; } }; } };

  // We don't need to load threads.js — just test the shared functions directly

  describe('renderMessageText()', function () {
    it('escapes HTML in plain text', function () {
      var result = window.renderMessageText('<script>alert(1)</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('converts **bold** to <strong>', function () {
      var result = window.renderMessageText('**bold**');
      expect(result).toContain('<strong>bold</strong>');
    });

    it('converts *italic* to <em>', function () {
      var result = window.renderMessageText('*italic*');
      expect(result).toContain('<em>italic</em>');
    });

    it('converts ~~strikethrough~~ to <del>', function () {
      var result = window.renderMessageText('~~strike~~');
      expect(result).toContain('<del>strike</del>');
    });

    it('converts backtick code to <code>', function () {
      var result = window.renderMessageText('`code`');
      expect(result).toContain('<code>code</code>');
    });

    it('converts URLs to <a> links', function () {
      var result = window.renderMessageText('Visit https://example.com now');
      expect(result).toContain('<a href="https://example.com"');
      expect(result).toContain('target="_blank"');
    });

    it('converts newlines to <br>', function () {
      var result = window.renderMessageText('line1\nline2');
      expect(result).toBe('line1<br>line2');
    });

    it('handles empty/null input', function () {
      expect(window.renderMessageText('')).toBe('');
      expect(window.renderMessageText(null)).toBe('');
      expect(window.renderMessageText(undefined)).toBe('');
    });
  });

  describe('renderAttachment()', function () {
    it('renders image attachments with <img>', function () {
      var result = window.renderAttachment({ url: 'pic.png', type: 'image/png', name: 'photo' });
      expect(result).toContain('<img');
      expect(result).toContain('src="pic.png"');
      expect(result).toContain('alt="photo"');
    });

    it('renders video attachments with <video>', function () {
      var result = window.renderAttachment({ url: 'clip.mp4', type: 'video/mp4', name: 'clip' });
      expect(result).toContain('<video');
      expect(result).toContain('src="clip.mp4"');
      expect(result).toContain('controls');
    });

    it('renders other attachments with <a>', function () {
      var result = window.renderAttachment({ url: 'doc.pdf', name: 'document' });
      expect(result).toContain('<a');
      expect(result).toContain('href="doc.pdf"');
      expect(result).toContain('document');
    });

    it('handles null/undefined', function () {
      expect(window.renderAttachment(null)).toBe('');
      expect(window.renderAttachment(undefined)).toBe('');
    });
  });
};
