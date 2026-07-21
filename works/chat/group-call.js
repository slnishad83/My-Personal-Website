/* group-call.js — now loads modularly */
/* @deprecated — use group-call-core.js, group-call-ui.js, group-call-actions.js, group-call-events.js */
(function () {
  'use strict';
  var dir = '';
  if (document.currentScript) {
    dir = document.currentScript.src.replace(/\\/g, '/').replace(/[^/]*$/, '');
  }
  var modules = [
    'group-call-core.js',
    'group-call-ui.js',
    'group-call-actions.js',
    'group-call-events.js'
  ];
  modules.forEach(function (m) {
    var s = document.createElement('script');
    s.src = dir + m;
    s.async = false;
    (document.head || document.getElementsByTagName('head')[0]).appendChild(s);
  });
})();
