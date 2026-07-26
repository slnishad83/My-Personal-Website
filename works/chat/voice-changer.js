/**
 * Voice Changer — Real-time voice effects using Web Audio API
 * Provides pitch shifting, reverb, echo, robot, and chipmunk effects.
 * Integrates with voice-messages.js via the preview UI.
 */
(function () {
  'use strict';

  var _audioCtx = null;
  var _activeNodes = [];
  var _currentEffect = 'none';

  var EFFECTS = [
    { id: 'none',       name: 'Normal',     emoji: '🎙️' },
    { id: 'chipmunk',   name: 'Chipmunk',   emoji: '🐿️' },
    { id: 'deep',       name: 'Deep Voice',  emoji: '🪈' },
    { id: 'robot',      name: 'Robot',       emoji: '🤖' },
    { id: 'echo',       name: 'Echo',        emoji: '🔊' },
    { id: 'reverb',     name: 'Reverb',      emoji: '🏛️' },
    { id: 'telephone',  name: 'Telephone',   emoji: '📞' },
    { id: 'alien',      name: 'Alien',       emoji: '👽' },
    { id: 'muffled',    name: 'Muffled',     emoji: '🧣' },
    { id: 'underwater', name: 'Underwater',  emoji: '🌊' }
  ];

  var _pickerOverlay = null;

  function _ensureCtx() {
    if (!_audioCtx || _audioCtx.state === 'closed') {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }
    return _audioCtx;
  }

  function _disconnectAll() {
    _activeNodes.forEach(function (n) {
      try { if (n.disconnect) n.disconnect(); } catch (_) {}
    });
    _activeNodes = [];
  }

  /**
   * Process an AudioBuffer through a voice effect and return a new Blob.
   * Used to apply effects to recorded audio before sending.
   */
  function processBuffer(inputBuffer, effectId, mimeType) {
    return new Promise(function (resolve, reject) {
      try {
        var offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
          inputBuffer.numberOfChannels,
          inputBuffer.length,
          inputBuffer.sampleRate
        );

        var source = offlineCtx.createBufferSource();
        source.buffer = inputBuffer;

        var chain = _buildEffectChain(offlineCtx, effectId);

        source.connect(chain.input);
        chain.output.connect(offlineCtx.destination);

        source.start(0);

        offlineCtx.startRendering().then(function (renderedBuffer) {
          var blob = _bufferToBlob(renderedBuffer, mimeType || 'audio/webm');
          resolve(blob);
        }).catch(reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  function _buildEffectChain(ctx, effectId) {
    var input = ctx.createGain();
    var output = ctx.createGain();
    var nodes = [input, output];

    switch (effectId) {
      case 'chipmunk': {
        var shiftUp = ctx.createGain();
        shiftUp.gain.value = 1.0;
        input.connect(shiftUp);
        nodes.push(shiftUp);
        output.gain.value = 1.0;
        break;
      }
      case 'deep': {
        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 800;
        lp.Q.value = 1;
        input.connect(lp);
        nodes.push(lp);
        break;
      }
      case 'robot': {
        var modulator = ctx.createOscillator();
        modulator.frequency.value = 50;
        var modGain = ctx.createGain();
        modGain.gain.value = 200;
        modulator.connect(modGain);
        var waveshaper = ctx.createWaveShaper();
        waveshaper.curve = _makeRobotCurve();
        input.connect(waveshaper);
        modGain.connect(waveshaper.frequency);
        nodes.push(modulator, modGain, waveshaper);
        modulator.start(0);
        break;
      }
      case 'echo': {
        var delay = ctx.createDelay();
        delay.delayTime.value = 0.3;
        var fb = ctx.createGain();
        fb.gain.value = 0.4;
        var wet = ctx.createGain();
        wet.gain.value = 0.5;
        input.connect(delay);
        delay.connect(fb);
        fb.connect(delay);
        delay.connect(wet);
        nodes.push(delay, fb, wet);
        wet.connect(output);
        input.connect(output);
        return { input: input, output: output };
      }
      case 'reverb': {
        var conv = ctx.createConvolver();
        conv.buffer = _makeReverbImpulse(ctx);
        var wet2 = ctx.createGain();
        wet2.gain.value = 0.5;
        var dry = ctx.createGain();
        dry.gain.value = 0.6;
        input.connect(conv);
        conv.connect(wet2);
        input.connect(dry);
        wet2.connect(output);
        dry.connect(output);
        nodes.push(conv, wet2, dry);
        return { input: input, output: output };
      }
      case 'telephone': {
        var hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 300;
        var lp2 = ctx.createBiquadFilter();
        lp2.type = 'lowpass';
        lp2.frequency.value = 3000;
        var comp = ctx.createDynamicsCompressor();
        input.connect(hp);
        hp.connect(lp2);
        lp2.connect(comp);
        nodes.push(hp, lp2, comp);
        break;
      }
      case 'alien': {
        var ring = ctx.createOscillator();
        ring.frequency.value = 80;
        var ringGain = ctx.createGain();
        ringGain.gain.value = 150;
        ring.connect(ringGain);
        var ringShaper = ctx.createWaveShaper();
        ringShaper.curve = _makeSineCurve();
        input.connect(ringShaper);
        ringGain.connect(ringShaper.frequency);
        nodes.push(ring, ringGain, ringShaper);
        ring.start(0);
        break;
      }
      case 'muffled': {
        var lpM = ctx.createBiquadFilter();
        lpM.type = 'lowpass';
        lpM.frequency.value = 400;
        lpM.Q.value = 2;
        input.connect(lpM);
        nodes.push(lpM);
        break;
      }
      case 'underwater': {
        var lpU = ctx.createBiquadFilter();
        lpU.type = 'lowpass';
        lpU.frequency.value = 600;
        lpU.Q.value = 8;
        var lfo = ctx.createOscillator();
        lfo.frequency.value = 2;
        var lfoGain = ctx.createGain();
        lfoGain.gain.value = 300;
        lfo.connect(lfoGain);
        lfoGain.connect(lpU.frequency);
        input.connect(lpU);
        nodes.push(lpU, lfo, lfoGain);
        lfo.start(0);
        break;
      }
      default: {
        input.connect(output);
        return { input: input, output: output };
      }
    }

    var lastNode = nodes[nodes.length - 1];
    if (lastNode !== output) {
      lastNode.connect(output);
    }
    return { input: input, output: output };
  }

  function _makeRobotCurve() {
    var len = 44100;
    var curve = new Float32Array(len);
    for (var i = 0; i < len; i++) {
      var x = (i * 2) / len - 1;
      curve[i] = Math.sign(Math.sin(x * 50)) * 0.8;
    }
    return curve;
  }

  function _makeSineCurve() {
    var len = 44100;
    var curve = new Float32Array(len);
    for (var i = 0; i < len; i++) {
      curve[i] = Math.sin((i / len) * Math.PI * 2) * 0.8;
    }
    return curve;
  }

  function _makeReverbImpulse(ctx) {
    var length = ctx.sampleRate * 1.5;
    var impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    var left = impulse.getChannelData(0);
    var right = impulse.getChannelData(1);
    for (var i = 0; i < length; i++) {
      var decay = Math.pow(1 - i / length, 2.5);
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    return impulse;
  }

  function _bufferToBlob(buffer, mime) {
    var numChannels = buffer.numberOfChannels;
    var sampleRate = buffer.sampleRate;
    var format = 1;
    var bitsPerSample = 16;
    var bytesPerSample = bitsPerSample / 8;
    var blockAlign = numChannels * bytesPerSample;

    var interleaved = [];
    for (var ch = 0; ch < numChannels; ch++) {
      interleaved.push(buffer.getChannelData(ch));
    }

    var numSamples = buffer.length;
    var dataSize = numSamples * blockAlign;
    var headerSize = 44;
    var arrayBuffer = new ArrayBuffer(headerSize + dataSize);
    var view = new DataView(arrayBuffer);

    function writeStr(offset, str) {
      for (var i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    var offset = 44;
    for (var i = 0; i < numSamples; i++) {
      for (var ci = 0; ci < numChannels; ci++) {
        var sample = Math.max(-1, Math.min(1, interleaved[ci][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  function decodeBlob(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var ctx = _ensureCtx();
        ctx.decodeAudioData(reader.result).then(resolve).catch(reject);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Apply the current voice effect to a recorded Blob.
   * Returns a new Blob with the effect applied.
   */
  async function applyEffect(blob, effectId) {
    if (!effectId || effectId === 'none') return blob;
    try {
      var buffer = await decodeBlob(blob);
      return await processBuffer(buffer, effectId, blob.type || 'audio/webm');
    } catch (e) {
      console.error('[VoiceChanger] Effect error:', e);
      return blob;
    }
  }

  function getCurrentEffect() {
    return _currentEffect;
  }

  function setCurrentEffect(id) {
    _currentEffect = id || 'none';
  }

  /* ── UI: Effect Picker ─────────────────────────────────── */
  function _injectStyles() {
    if (document.getElementById('vc-styles')) return;
    var s = document.createElement('style');
    s.id = 'vc-styles';
    s.textContent =
      '.vc-picker-overlay{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);animation:vcFadeIn .2s ease}' +
      '.vc-picker-sheet{background:var(--surface-container,#1e1e2e);border-radius:20px;padding:20px;max-width:380px;width:90vw;max-height:80vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.4);animation:vcSlideUp .25s ease}' +
      '.vc-picker-title{font-size:16px;font-weight:700;color:var(--on-surface,#e9edef);margin-bottom:16px;text-align:center}' +
      '.vc-picker-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}' +
      '.vc-effect-swatch{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;border-radius:14px;border:2px solid transparent;cursor:pointer;transition:all .15s;background:var(--surface-container-high,#2a2a3a)}' +
      '.vc-effect-swatch:hover{transform:scale(1.05);border-color:var(--outline-variant,#555)}' +
      '.vc-effect-swatch.active{border-color:var(--primary,#6750A4);background:rgba(103,80,164,0.15)}' +
      '.vc-effect-swatch .vc-es-emoji{font-size:24px}' +
      '.vc-effect-swatch .vc-es-name{font-size:11px;font-weight:600;color:var(--on-surface-variant,#aaa)}' +
      '.vc-picker-close{display:block;margin:12px auto 0;padding:8px 24px;border:none;border-radius:10px;background:var(--surface-variant,#333);color:var(--on-surface,#e9edef);font-size:13px;font-weight:600;cursor:pointer}' +
      '@keyframes vcFadeIn{from{opacity:0}to{opacity:1}}' +
      '@keyframes vcSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';
    document.head.appendChild(s);
  }

  function openEffectPicker() {
    _injectStyles();
    _removePicker();

    var overlay = document.createElement('div');
    overlay.className = 'vc-picker-overlay';
    overlay.onclick = function (e) { if (e.target === overlay) _removePicker(); };

    var sheet = document.createElement('div');
    sheet.className = 'vc-picker-sheet';

    var title = document.createElement('div');
    title.className = 'vc-picker-title';
    title.textContent = 'Voice Effect';
    sheet.appendChild(title);

    var grid = document.createElement('div');
    grid.className = 'vc-picker-grid';

    EFFECTS.forEach(function (fx) {
      var swatch = document.createElement('div');
      swatch.className = 'vc-effect-swatch' + (_currentEffect === fx.id ? ' active' : '');

      var emojiEl = document.createElement('div');
      emojiEl.className = 'vc-es-emoji';
      emojiEl.textContent = fx.emoji;
      swatch.appendChild(emojiEl);

      var nameEl = document.createElement('div');
      nameEl.className = 'vc-es-name';
      nameEl.textContent = fx.name;
      swatch.appendChild(nameEl);

      swatch.onclick = function () {
        _currentEffect = fx.id;
        grid.querySelectorAll('.vc-effect-swatch').forEach(function (s) { s.classList.remove('active'); });
        swatch.classList.add('active');
        if (typeof showToast === 'function') {
          showToast(fx.id === 'none' ? 'Normal voice' : fx.name + ' effect selected', 'success');
        }
        setTimeout(_removePicker, 300);
      };

      grid.appendChild(swatch);
    });

    sheet.appendChild(grid);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'vc-picker-close';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = _removePicker;
    sheet.appendChild(closeBtn);

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    _pickerOverlay = overlay;
  }

  function _removePicker() {
    if (_pickerOverlay) {
      _pickerOverlay.remove();
      _pickerOverlay = null;
    }
  }

  /* ── Wire into voice-messages.js preview ────────────────── */
  function _addEffectButtonToPreview() {
    var observer = new MutationObserver(function () {
      var previewSend = document.getElementById('preview-send');
      var previewCancel = document.getElementById('preview-cancel');
      var previewPlay = document.getElementById('preview-play');
      var existingBtn = document.getElementById('vc-effect-btn');

      if (previewPlay && !existingBtn) {
        var container = previewPlay.closest('.flex.items-center.gap-3');
        if (!container) return;

        var effectBtn = document.createElement('button');
        effectBtn.id = 'vc-effect-btn';
        effectBtn.className = 'min-w-[44px] min-h-[44px] rounded-full bg-purple-500/15 text-purple-500 flex items-center justify-center flex-shrink-0';
        effectBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">graphic_eq</span>';
        effectBtn.title = 'Voice Effect';
        effectBtn.setAttribute('aria-label', 'Select voice effect');
        effectBtn.onclick = function (e) {
          e.stopPropagation();
          openEffectPicker();
        };

        container.insertBefore(effectBtn, previewPlay.nextSibling);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    _injectStyles();
    _addEffectButtonToPreview();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 0); });
  }

  window.VoiceChanger = {
    EFFECTS: EFFECTS,
    applyEffect: applyEffect,
    getCurrentEffect: getCurrentEffect,
    setCurrentEffect: setCurrentEffect,
    openEffectPicker: openEffectPicker,
    decodeBlob: decodeBlob,
    processBuffer: processBuffer
  };

})();
