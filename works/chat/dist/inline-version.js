/* D-L7: App version display in console (backwards compat for build output) */
(function() {
  /* Version is defined in version.js — this is a fallback for bundled builds */
  if (window.NSL_VERSION) {
    console.log('%c NSL Chat v' + window.NSL_VERSION + ' ', 'background:#008069;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;');
  }
  document.addEventListener('DOMContentLoaded', function() {
    if (!document.title.includes('NSL Chat')) document.title = 'NSL Chat';
  });
})();