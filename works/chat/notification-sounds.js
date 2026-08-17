/* ============================================================
   NOTIFICATION SOUNDS — High-quality synthesized notification
   tones using Web Audio API. No external audio files needed.
   Provides message, group message, call ringtone, call ended,
   missed call, and custom sound support.
   ============================================================ */
'use strict';

const NotificationSounds = (() => {
  let _ctx = null;
  let _unlocked = false;

  function getCtx() {
    if (!_ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      _ctx = new Ctx();
    }
    if (_ctx.state === 'suspended') {
      _ctx.resume().catch(() => {});
    }
    return _ctx;
  }

  function unlock() {
    if (_unlocked) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
      _unlocked = true;
    } catch (_) {}
  }

  function _playTone(freq, duration, volume, type, attackTime, decayTime) {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    const atk = attackTime || 0.01;
    const _dec = decayTime || duration * 0.3;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume || 0.15, now + atk);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  function _playChord(freqs, duration, volume, type) {
    freqs.forEach((f, i) => {
      setTimeout(() => _playTone(f, duration, volume, type), i * 30);
    });
  }

  const sounds = {
    /* WhatsApp-style message "ding" — bright, short, pleasant */
    message() {
      _playTone(880, 0.08, 0.12, 'sine', 0.005, 0.04);
      setTimeout(() => _playTone(1175, 0.07, 0.10, 'sine', 0.005, 0.035), 70);
    },

    /* Group message — slightly different tone to distinguish */
    groupMessage() {
      _playTone(784, 0.08, 0.12, 'sine', 0.005, 0.04);
      setTimeout(() => _playTone(1047, 0.07, 0.10, 'sine', 0.005, 0.035), 70);
      setTimeout(() => _playTone(1319, 0.06, 0.08, 'sine', 0.005, 0.03), 140);
    },

    /* Incoming call ringtone — dual-tone pattern like WhatsApp */
    callRing() {
      _playTone(440, 0.4, 0.12, 'sine', 0.01, 0.15);
      setTimeout(() => _playTone(480, 0.4, 0.12, 'sine', 0.01, 0.15), 50);
      setTimeout(() => _playTone(523, 0.35, 0.10, 'sine', 0.01, 0.12), 500);
      setTimeout(() => _playTone(587, 0.35, 0.10, 'sine', 0.01, 0.12), 550);
    },

    /* Outgoing call — gentle connecting tone */
    outgoingCall() {
      _playTone(440, 0.25, 0.08, 'sine', 0.02, 0.1);
      setTimeout(() => _playTone(523, 0.25, 0.08, 'sine', 0.02, 0.1), 300);
      setTimeout(() => _playTone(659, 0.25, 0.08, 'sine', 0.02, 0.1), 600);
    },

    /* Call connected — positive confirmation tone */
    callConnected() {
      _playTone(523, 0.15, 0.10, 'sine', 0.005, 0.08);
      setTimeout(() => _playTone(659, 0.15, 0.10, 'sine', 0.005, 0.08), 100);
      setTimeout(() => _playTone(784, 0.2, 0.12, 'sine', 0.005, 0.1), 200);
    },

    /* Call ended — descending tone */
    callEnded() {
      _playTone(659, 0.15, 0.08, 'sine', 0.005, 0.08);
      setTimeout(() => _playTone(523, 0.15, 0.08, 'sine', 0.005, 0.08), 100);
      setTimeout(() => _playTone(440, 0.2, 0.08, 'sine', 0.005, 0.1), 200);
    },

    /* Call declined — short negative tone */
    callDeclined() {
      _playTone(440, 0.15, 0.08, 'sine', 0.005, 0.08);
      setTimeout(() => _playTone(370, 0.2, 0.08, 'sine', 0.005, 0.1), 100);
    },

    /* Missed call — alert pattern */
    missedCall() {
      _playTone(698, 0.12, 0.12, 'sine', 0.005, 0.06);
      setTimeout(() => _playTone(880, 0.12, 0.12, 'sine', 0.005, 0.06), 120);
      setTimeout(() => _playTone(698, 0.12, 0.12, 'sine', 0.005, 0.06), 240);
      setTimeout(() => _playTone(880, 0.15, 0.12, 'sine', 0.005, 0.08), 360);
    },

    /* Sent message — subtle outgoing confirmation */
    sent() {
      _playTone(1047, 0.05, 0.06, 'sine', 0.003, 0.025);
    },

    /* Reaction notification */
    reaction() {
      _playTone(1319, 0.06, 0.08, 'sine', 0.003, 0.03);
      setTimeout(() => _playTone(1568, 0.08, 0.08, 'sine', 0.003, 0.04), 60);
    },

    /* Mention notification — attention-getting */
    mention() {
      _playTone(1047, 0.08, 0.12, 'sine', 0.005, 0.04);
      setTimeout(() => _playTone(1319, 0.08, 0.12, 'sine', 0.005, 0.04), 80);
      setTimeout(() => _playTone(1568, 0.1, 0.10, 'sine', 0.005, 0.05), 160);
    },

    /* Error / failure tone */
    error() {
      _playTone(330, 0.15, 0.08, 'sawtooth', 0.005, 0.08);
      setTimeout(() => _playTone(277, 0.2, 0.08, 'sawtooth', 0.005, 0.1), 120);
    },

    /* WhatsApp "Silent" tone — for previewing silent setting */
    silent() {
      // No-op: plays nothing
    },

    /* WhatsApp-style "Ding" — classic notification */
    ding() {
      _playTone(1047, 0.06, 0.10, 'sine', 0.003, 0.03);
    },

    /* WhatsApp-style "Note" — musical two-tone */
    note() {
      _playTone(659, 0.10, 0.10, 'sine', 0.005, 0.05);
      setTimeout(() => _playTone(880, 0.12, 0.10, 'sine', 0.005, 0.06), 100);
    },

    /* WhatsApp-style "Chime" — bright ascending */
    chime() {
      _playTone(784, 0.08, 0.10, 'sine', 0.003, 0.04);
      setTimeout(() => _playTone(1047, 0.08, 0.10, 'sine', 0.003, 0.04), 60);
      setTimeout(() => _playTone(1319, 0.10, 0.10, 'sine', 0.003, 0.05), 120);
    },

    /* WhatsApp-style "Bell" — resonant */
    bell() {
      _playTone(1319, 0.15, 0.10, 'sine', 0.005, 0.08);
      setTimeout(() => _playTone(1568, 0.2, 0.10, 'sine', 0.005, 0.1), 50);
    },

    /* WhatsApp-style "Digital" — electronic */
    digital() {
      _playTone(880, 0.04, 0.08, 'square', 0.003, 0.02);
      setTimeout(() => _playTone(880, 0.04, 0.08, 'square', 0.003, 0.02), 80);
    },

    /* WhatsApp-style "Soft" — gentle warm tone */
    soft() {
      _playTone(440, 0.12, 0.08, 'sine', 0.02, 0.06);
      setTimeout(() => _playTone(554, 0.12, 0.08, 'sine', 0.02, 0.06), 80);
    },

    /* WhatsApp-style "Alert" — attention-getting two-tone */
    alert() {
      _playTone(1047, 0.06, 0.12, 'sine', 0.005, 0.03);
      setTimeout(() => _playTone(1319, 0.08, 0.12, 'sine', 0.005, 0.04), 80);
    },

    /* WhatsApp-style "Whistle" — ascending three-tone */
    whistle() {
      _playTone(1175, 0.10, 0.10, 'sine', 0.005, 0.05);
      setTimeout(() => _playTone(1397, 0.10, 0.10, 'sine', 0.005, 0.05), 100);
      setTimeout(() => _playTone(1568, 0.15, 0.10, 'sine', 0.005, 0.08), 200);
    }
  };

  return {
    unlock,
    getCtx,
    play(name) {
      unlock();
      if (sounds[name]) {
        sounds[name]();
      } else {
        sounds.message();
      }
    },
    sounds,
    get isUnlocked() { return _unlocked; },
    suspend() { if (_ctx && _ctx.state === 'running') _ctx.suspend().catch(() => {}); },
    resume() { if (_ctx && _ctx.state === 'suspended') _ctx.resume().catch(() => {}); }
  };
})();

window.NotificationSounds = NotificationSounds;

/* Auto-unlock on first user interaction */
['click', 'touchstart', 'keydown'].forEach(evt => {
  document.addEventListener(evt, () => NotificationSounds.unlock(), { once: true, passive: true });
});

/* Suspend AudioContext when page hidden, resume when visible */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    NotificationSounds.suspend();
  } else {
    NotificationSounds.resume();
  }
});
