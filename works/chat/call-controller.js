/* call-controller.js — now loads modularly */
/* @deprecated — use call-controller-core.js, call-controller-ui.js, call-controller-actions.js, call-controller-events.js */
(function () {
  'use strict';
  var dir = '';
  if (document.currentScript) {
    dir = document.currentScript.src.replace(/\\/g, '/').replace(/[^/]*$/, '');
  }
  var modules = [
    'call-controller-core.js',
    'call-controller-ui.js',
    'call-controller-actions.js',
    'call-controller-events.js'
  ];
  modules.forEach(function (m) {
    var s = document.createElement('script');
    s.src = dir + m;
    s.async = false;
    (document.head || document.getElementsByTagName('head')[0]).appendChild(s);
  });
})();
