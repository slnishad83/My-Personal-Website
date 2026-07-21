(function() {
  'use strict';

  var _loaded = {};
  var _loading = {};

  var LAZY_MODULES = {
    'qr-scanner': ['jsQR.js?v=2'],
    'calculator': ['calculator.js'],
    'music': ['music-player.js', 'music-library.js', 'playlist-core.js', 'playlist-ui.js', 'playlist-sync.js'],
    'whiteboard': ['collaborative-whiteboard.js'],
    'annotation': ['image-annotation.js'],
    'minigames': ['mini-games.js'],
    'cloud-drive': ['cloud-drive.js'],
    'contact-sync': ['contact-sync.js']
  };

  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      if (_loaded[src]) { resolve(); return; }
      if (_loading[src]) { _loading[src].then(resolve, reject); return; }
      var script = document.createElement('script');
      script.src = src;
      script.defer = true;
      _loading[src] = new Promise(function(res, rej) {
        script.onload = function() { _loaded[src] = true; delete _loading[src]; res(); };
        script.onerror = function() { delete _loading[src]; rej(new Error('Failed to load ' + src)); };
      });
      document.head.appendChild(script);
      _loading[src].then(resolve, reject);
    });
  }

  function loadModule(name) {
    var files = LAZY_MODULES[name];
    if (!files) return Promise.resolve();
    return Promise.all(files.map(loadScript)).then(function() {
      if (typeof App !== 'undefined') App._lazyLoaded = App._lazyLoaded || {};
      if (typeof App !== 'undefined') App._lazyLoaded[name] = true;
    });
  }

  function isLoaded(name) {
    return !!(typeof App !== 'undefined' && App._lazyLoaded && App._lazyLoaded[name]);
  }

  window.LazyModules = {
    load: loadModule,
    isLoaded: isLoaded,
    register: function(name, files) { LAZY_MODULES[name] = files; }
  };

  if (typeof App !== 'undefined') {
    App.loadLazy = loadModule;
    App.isLazyLoaded = isLoaded;
  }
})();
