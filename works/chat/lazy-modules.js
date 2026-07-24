(function() {
  'use strict';

  var _loaded = {};
  var _loading = {};

  var LAZY_MODULES = {
    'qr-scanner': ['jsQR.js'],
    'calculator': ['calculator.js'],
    'music': ['music-player.js', 'music-library.js', 'playlist-core.js', 'playlist-ui.js', 'playlist-sync.js'],
    'whiteboard': ['collaborative-whiteboard.js'],
    'annotation': ['image-annotation.js'],
    'minigames': ['mini-games.js'],
    'cloud-drive': ['cloud-drive.js'],
    'contact-sync': ['contact-sync.js']
  };

  function loadModule(name) {
    if (_loaded[name]) return Promise.resolve();
    if (_loading[name]) return _loading[name];
    var files = LAZY_MODULES[name];
    if (!files) return Promise.resolve();
    _loading[name] = Promise.all(files.map(function(src) {
      return import('./' + src).catch(function(e) {
        console.warn('[LazyModules] Failed to load ' + src + ':', e.message);
      });
    })).then(function() {
      _loaded[name] = true;
      delete _loading[name];
      if (typeof App !== 'undefined') {
        App._lazyLoaded = App._lazyLoaded || {};
        App._lazyLoaded[name] = true;
      }
    });
    return _loading[name];
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
