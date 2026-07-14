/* NSL Chat — Single Source of Truth for App Version */
(function() {
  'use strict';
  var VERSION = '2.5.0';
  var BUILD = new Date().toISOString().split('T')[0];
  window.NSL_VERSION = VERSION;
  console.log('%c NSL Chat v' + VERSION + ' (built ' + BUILD + ') ', 'background:#008069;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;');
  document.addEventListener('DOMContentLoaded', function() {
    if (!document.title.includes('NSL Chat')) document.title = 'NSL Chat';
  });
})();
