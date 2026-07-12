/* ============================================================
   AUDIO MANAGER — Ringtones, notification sounds, playback
   Handles Web Audio API, fallback to HTMLAudioElement
   ============================================================ */
'use strict';

const AudioManager = {
  _audioContext: null,
  _ringtoneOsc: null,
  _ringtoneGain: null,
  _ringtonePlaying: false,
  _ringtoneTimer: null,
  _notificationSounds: {},
  _volume: 1.0,
  _muted: false,
  _currentRingtone: null,

  init() {
    this._preloadSounds();
    console.log('[AudioManager] Initialized');
  },

  _getCtx() {
    if (this._audioContext && this._audioContext.state !== 'closed') {
      if (this._audioContext.state === 'suspended') this._audioContext.resume().catch(() => {});
      return this._audioContext;
    }
    try {
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      return this._audioContext;
    } catch (_) { return null; }
  },

  _preloadSounds() {
    this._notificationSounds = {};
  },

  /* ── Ringtone ─────────────────────────────────────────── */
  startRingtone(type) {
    if (this._ringtonePlaying) return;
    this._ringtonePlaying = true;
    const ctx = this._getCtx();
    if (!ctx) { this._playRingtoneFallback(type); return; }

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.value = type === 'video' ? 440 : 420;
    osc2.frequency.value = type === 'video' ? 480 : 460;
    gain.gain.value = 0;

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(compressor);
    compressor.connect(ctx.destination);

    const fadeIn = 0.3;
    gain.gain.setTargetAtTime(0.15, ctx.currentTime, fadeIn);
    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);

    this._ringtoneOsc = [osc1, osc2];
    this._ringtoneGain = gain;

    let on = true;
    this._ringtoneTimer = setInterval(() => {
      if (!this._ringtonePlaying) return;
      on = !on;
      if (on) {
        gain.gain.setTargetAtTime(0.15, ctx.currentTime, 0.05);
      } else {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
    }, 2000);

    if (Platform?.capabilities?.vibrateSupported) {
      navigator.vibrate([700, 250, 700, 250, 700, 250, 700, 250, 700]);
    }
  },

  stopRingtone() {
    this._ringtonePlaying = false;
    if (this._ringtoneTimer) {
      clearInterval(this._ringtoneTimer);
      this._ringtoneTimer = null;
    }
    if (this._ringtoneGain) {
      try {
        const ctx = this._getCtx();
        if (ctx) this._ringtoneGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      } catch (_) {}
    }
    if (this._ringtoneOsc) {
      setTimeout(() => {
        try {
          if (Array.isArray(this._ringtoneOsc)) {
            this._ringtoneOsc.forEach(o => { try { o.stop(); } catch (_) {} });
          }
        } catch (_) {}
        this._ringtoneOsc = null;
        this._ringtoneGain = null;
      }, 500);
    }
    if (Platform?.capabilities?.vibrateSupported) {
      navigator.vibrate(0);
    }
  },

  _playRingtoneFallback(type) {
    try {
      const audio = new Audio(type === 'video' ? 'ringtone-video.mp3' : 'ringtone-voice.mp3');
      audio.loop = true;
      audio.volume = this.getTabletVolume();
      this._currentRingtone = audio;
      audio.play().catch(() => {});
    } catch (_) {}
  },

  /* ── Notification Sound ───────────────────────────────── */
  playNotificationSound(type) {
    if (this._muted) return;
    if (Platform?.capabilities?.vibrateSupported) {
      navigator.vibrate([180, 80, 180]);
    }
    const ctx = this._getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = type === 'group' ? 660 : 880;
      gain.gain.value = this.getTabletVolume() * 0.12;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      gain.gain.setTargetAtTime(0, ctx.currentTime + 0.08, 0.04);
      osc.stop(ctx.currentTime + 0.3);
    } catch (_) {}
  },

  playMessageSent() { this._playTone(520, 0.08, 'sine'); },
  playMessageReceived() { this._playTone(660, 0.1, 'sine'); },
  playCallEnd() { this._playTone(330, 0.15, 'sine'); },

  _playTone(freq, dur, type) {
    if (this._muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.value = this.getTabletVolume() * 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      gain.gain.setTargetAtTime(0, ctx.currentTime, dur * 0.5);
      osc.stop(ctx.currentTime + dur);
    } catch (_) {}
  },

  /* ── Volume / Mute ───────────────────────────────────── */
  setVolume(v) { this._volume = Math.max(0, Math.min(1, v)); },
  getVolume() { return this._volume; },
  /* L3: Tablet notification volume — louder on tablets for better hearing */
  getTabletVolume() { return (window.isTablet && this._volume < 0.8) ? Math.min(1, this._volume + 0.2) : this._volume; },
  mute() { this._muted = true; this.stopRingtone(); },
  unmute() { this._muted = false; },
  isMuted() { return this._muted; },
  toggleMute() { this._muted ? this.unmute() : this.mute(); return this._muted; },

  destroy() {
    this.stopRingtone();
    if (this._audioContext) {
      try { this._audioContext.close(); } catch (_) {}
    }
    this._notificationSounds = {};
  }
};

window.AudioManager = AudioManager;
