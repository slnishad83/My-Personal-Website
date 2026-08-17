/* proximity-sensor.js � Proximity sensor detection + auto earpiece/speaker switching */
(function () {
  'use strict';

  var _proximityActive = false;
  var _proximityListener = null;
  var _audioOutputAutoSwitch = true;
  var _lastOutputDevice = 'default';

  function isSupported() {
    return 'Sensor' in window && 'ProximitySensor' in window;
  }

  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
  }

  async function start() {
    if (!isSupported() || !isMobile()) return false;
    try {
      var sensor = new ProximitySensor({ frequency: 1 });
      _proximityListener = function () {
        var near = sensor.near;
        if (near) {
          _setAudioOutput('earpiece');
          _dimScreen(true);
        } else {
          _setAudioOutput('speaker');
          _dimScreen(false);
        }
      };
      sensor.addEventListener('reading', _proximityListener);
      sensor.addEventListener('error', function () {});
      await sensor.start();
      _proximityActive = true;
      _setupAudioOutputAutoSwitch();
      return true;
    } catch (_) {
      return false;
    }
  }

  function stop() {
    _proximityActive = false;
    _dimScreen(false);
    _setAudioOutput('speaker');
    if (_deviceChangeHandler && navigator.mediaDevices) {
      try { navigator.mediaDevices.removeEventListener('devicechange', _deviceChangeHandler); } catch (_) {}
      _deviceChangeHandler = null;
    }
  }

  function _dimScreen(dim) {
    var cs = document.getElementById('call-screen');
    if (!cs) return;
    if (dim) {
      cs.style.opacity = '0.01';
      cs.style.pointerEvents = 'none';
    } else {
      cs.style.opacity = '';
      cs.style.pointerEvents = '';
    }
  }

  async function _setAudioOutput(device) {
    var rv = document.getElementById('remote-video');
    if (!rv) return;
    try {
      if (typeof rv.setSinkId !== 'function') return;
      if (device === 'earpiece') {
        var devices = await navigator.mediaDevices.enumerateDevices();
        var earpiece = devices.find(function (d) {
          return d.kind === 'audiooutput' && (
            d.label.toLowerCase().includes('earpiece') ||
            d.label.toLowerCase().includes('phone') ||
            d.label.toLowerCase().includes('receiver')
          );
        });
        if (earpiece) {
          await rv.setSinkId(earpiece.deviceId);
          _lastOutputDevice = earpiece.deviceId;
        }
      } else {
        var devices2 = await navigator.mediaDevices.enumerateDevices();
        var speaker = devices2.find(function (d) {
          return d.kind === 'audiooutput' && (
            d.label.toLowerCase().includes('speaker') ||
            d.label.toLowerCase().includes('loud')
          );
        });
        if (speaker) {
          await rv.setSinkId(speaker.deviceId);
          _lastOutputDevice = speaker.deviceId;
        } else {
          await rv.setSinkId('default');
        }
      }
    } catch (_) {}
  }

  var _deviceChangeHandler = null;

  function _setupAudioOutputAutoSwitch() {
    if (typeof navigator.mediaDevices === 'undefined' || !navigator.mediaDevices.addEventListener) return;
    _deviceChangeHandler = async function () {
      if (!_audioOutputAutoSwitch || !_proximityActive) return;
      try {
        var devices = await navigator.mediaDevices.enumerateDevices();
        var hasHeadphones = devices.some(function (d) {
          return d.kind === 'audiooutput' && (
            d.label.toLowerCase().includes('headphone') ||
            d.label.toLowerCase().includes('headset') ||
            d.label.toLowerCase().includes('airpod') ||
            d.label.toLowerCase().includes('bluetooth')
          );
        });
        if (hasHeadphones) {
          _setAudioOutput('speaker');
        }
      } catch (_) {}
    };
    navigator.mediaDevices.addEventListener('devicechange', _deviceChangeHandler);
  }

  function isActive() { return _proximityActive; }

  window._ProximitySensor = {
    start: start,
    stop: stop,
    isSupported: isSupported,
    isActive: isActive
  };

})();
