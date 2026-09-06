/* NSL Chat � Single Source of Truth for App Version */
(function() {
  'use strict';
  var VERSION = '7.3.0';
  var BUILD = '2026-09-06';
  window.NSL_VERSION = VERSION;
  window.NSL_BUILD = BUILD;
  if (window.__DEBUG__) console.log('%c NSL Chat v' + VERSION + ' (built ' + BUILD + ') ', 'background:#008069;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;');
  document.addEventListener('DOMContentLoaded', function() {
    if (!document.title.includes('NSL Chat')) document.title = 'NSL Chat';
  });
})();
