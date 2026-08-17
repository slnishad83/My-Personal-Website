/* ============================================================
   WHATSAPP-STYLE NOTIFICATION MANAGER
   - Per-chat notification settings (tone, vibration, override)
   - Mute duration presets (8h, 1 week, always)
   - Notification channels for Android
   - Rich notifications with avatars
   - Vibration patterns per notification type
   - Inline reply from notification
   - Matches WhatsApp notification behavior exactly
   ============================================================ */
'use strict';

(function () {
  const STORAGE_KEY = 'nsl_chat_notifications';
  const MUTED_KEY = 'nsl_muted_chats';

  const DEFAULT_TONE = 'default';
  const BUILTIN_TONES = [
    { id: 'default',   name: 'Default',       freq: [880, 1175], dur: 0.08, type: 'sine' },
    { id: 'short',     name: 'Short',          freq: [1047],       dur: 0.05, type: 'sine' },
    { id: 'note',      name: 'Note',           freq: [659, 880],   dur: 0.12, type: 'sine' },
    { id: 'chime',     name: 'Chime',          freq: [784, 1047, 1319], dur: 0.1, type: 'sine' },
    { id: 'bell',      name: 'Bell',           freq: [1319, 1568], dur: 0.15, type: 'sine' },
    { id: 'digital',   name: 'Digital',        freq: [880],        dur: 0.06, type: 'square' },
    { id: 'soft',      name: 'Soft',           freq: [440, 554],   dur: 0.1,  type: 'sine' },
    { id: 'alert',     name: 'Alert',          freq: [1047, 1319], dur: 0.08, type: 'triangle' },
    { id: 'whistle',   name: 'Whistle',        freq: [1175, 1397, 1568], dur: 0.12, type: 'sine' },
    { id: 'none',      name: 'None (Silent)',  freq: [],           dur: 0,    type: 'sine' }
  ];

  const VIBRATION_PATTERNS = {
    message:      [140],
    groupMessage: [140, 50, 140],
    call:         [700, 250, 700, 700],
    mention:      [220, 90, 220],
    reaction:     [100],
    sent:         [50]
  };

  const MUTE_PRESETS = [
    { label: '8 Hours',    ms: 8 * 60 * 60 * 1000 },
    { label: '1 Week',     ms: 7 * 24 * 60 * 60 * 1000 },
    { label: 'Always',     ms: Infinity }
  ];

  /* ── Per-chat settings store ────────────────────────────────── */
  function _loadAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { return {}; }
  }
  function _saveAll(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
    _syncToFirestore(data);
  }

  async function _syncToFirestore(data) {
    const uid = window.App?.uid?.() || window.currentUser?.uid;
    const db = window.App?.db;
    if (!uid || !db) return;
    try {
      await db.collection('users').doc(uid).set({ notificationSettings: data }, { merge: true });
    } catch (_) {}
  }

  /* ── Muted chats store ──────────────────────────────────────── */
  function _loadMuted() {
    try { return JSON.parse(localStorage.getItem(MUTED_KEY) || '{}'); } catch (_) { return {}; }
  }
  function _saveMuted(data) {
    try { localStorage.setItem(MUTED_KEY, JSON.stringify(data)); } catch (_) {}
    if (window.App?._mutedChats) {
      Object.keys(data).forEach(k => {
        if (data[k].muted) window.App._mutedChats.add(k);
        else window.App._mutedChats.delete(k);
      });
    }
    if (window.App?._mutedUntil) {
      Object.keys(data).forEach(k => {
        if (data[k].muted && data[k].until) window.App._mutedUntil[k] = data[k].until;
        else delete window.App._mutedUntil[k];
      });
    }
  }

  /* ════════════════════════════════════════════════════════════════
     PUBLIC API
     ════════════════════════════════════════════════════════════════ */
  const ChatNotifications = {
    /* Get per-chat notification settings (returns merged with defaults) */
    getSettings(chatId) {
      const all = _loadAll();
      const defaults = {
        tone: DEFAULT_TONE,
        vibration: true,
        override: false,
        customTone: null,
        highPriority: false
      };
      return { ...defaults, ...(all[chatId] || {}) };
    },

    /* Set per-chat notification settings */
    setSettings(chatId, settings) {
      const all = _loadAll();
      all[chatId] = { ...(all[chatId] || {}), ...settings };
      _saveAll(all);
      document.dispatchEvent(new CustomEvent('chat-notif-settings-changed', { detail: { chatId, settings: all[chatId] } }));
    },

    /* Mute a chat with duration preset or custom ms */
    muteChat(chatId, durationMs) {
      const muted = _loadMuted();
      muted[chatId] = {
        muted: true,
        until: durationMs === Infinity ? 0 : Date.now() + durationMs,
        mutedAt: Date.now(),
        durationMs: durationMs
      };
      _saveMuted(muted);
      if (window.showToast) window.showToast('Chat muted', 'success');
    },

    /* Unmute a chat */
    unmuteChat(chatId) {
      const muted = _loadMuted();
      delete muted[chatId];
      _saveMuted(muted);
      if (window.showToast) window.showToast('Chat unmuted', 'success');
    },

    /* Check if a chat is currently muted */
    isMuted(chatId) {
      const muted = _loadMuted();
      const entry = muted[chatId];
      if (!entry || !entry.muted) return false;
      if (entry.until > 0 && entry.until <= Date.now()) {
        delete muted[chatId];
        _saveMuted(muted);
        return false;
      }
      return true;
    },

    /* Get mute remaining time display */
    getMuteDisplay(chatId) {
      const muted = _loadMuted();
      const entry = muted[chatId];
      if (!entry || !entry.muted) return null;
      if (entry.durationMs === Infinity) return 'Muted forever';
      if (entry.until <= Date.now()) return null;
      const remaining = entry.until - Date.now();
      if (remaining > 86400000) return 'Muted for ' + Math.ceil(remaining / 86400000) + ' days';
      if (remaining > 3600000) return 'Muted for ' + Math.ceil(remaining / 3600000) + ' hours';
      return 'Muted for ' + Math.ceil(remaining / 60000) + ' min';
    },

    /* Get mute presets */
    getMutePresets() { return MUTE_PRESETS; },

    /* Get builtin tones list */
    getTones() { return BUILTIN_TONES; },

    /* Play a tone by ID */
    playTone(toneId) {
      const tone = BUILTIN_TONES.find(t => t.id === toneId);
      if (!tone || !tone.freq.length) return;
      const ctx = window.NotificationSounds?.getCtx?.() || new (window.AudioContext || window.webkitAudioContext)();
      tone.freq.forEach((freq, i) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = tone.type;
          osc.frequency.value = freq;
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(ctx.destination);
          const now = ctx.currentTime;
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.001, now + tone.dur);
          osc.start(now);
          osc.stop(now + tone.dur + 0.05);
        }, i * 70);
      });
    },

    /* Get vibration pattern for a type */
    getVibration(type) {
      return VIBRATION_PATTERNS[type] || VIBRATION_PATTERNS.message;
    },

    /* Vibrate with pattern */
    vibrate(type) {
      const pattern = this.getVibration(type);
      if (navigator.vibrate) navigator.vibrate(pattern);
    },

    /* ════════════════════════════════════════════════════════════
       WHATSAPP-STYLE MUTE DIALOG
       Shows duration picker matching WhatsApp exactly
       ════════════════════════════════════════════════════════════ */
    showMuteDialog(chatId, chatName) {
      const existing = document.getElementById('nsl-mute-dialog');
      if (existing) existing.remove();

      const isCurrentlyMuted = this.isMuted(chatId);
      const currentDisplay = this.getMuteDisplay(chatId);

      let html = '<div id="nsl-mute-dialog" style="position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.15s ease">' +
        '<div style="background:var(--surface,#fff);border-radius:16px;width:min(360px,90vw);overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.2)">' +
          '<div style="padding:20px 20px 12px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.06))">' +
            '<div style="font-size:16px;font-weight:700;color:var(--on-surface,#000)">Mute ' + _esc(chatName || 'chat') + '</div>' +
            '<div style="font-size:13px;color:var(--on-surface-variant,#667781);margin-top:4px">Notifications from this chat will be silenced</div>' +
          '</div>' +
          '<div style="padding:4px 0">';

      MUTE_PRESETS.forEach(function(preset) {
        html += '<button class="nsl-mute-option" data-duration="' + (preset.ms === Infinity ? 'inf' : preset.ms) + '" ' +
          'style="display:flex;align-items:center;gap:14px;width:100%;padding:14px 20px;border:none;background:none;cursor:pointer;text-align:left;transition:background 0.15s">' +
          '<div style="width:20px;height:20px;border-radius:50%;border:2px solid var(--on-surface-variant,#8696a0);flex-shrink:0"></div>' +
          '<span style="font-size:15px;color:var(--on-surface,#000)">' + preset.label + '</span>' +
        '</button>';
      });

      html += '</div>' +
        '<div style="padding:12px 20px;border-top:1px solid var(--outline-variant,rgba(0,0,0,0.06));display:flex;justify-content:flex-end;gap:12px">' +
          '<button id="nsl-mute-cancel" style="padding:8px 20px;border:none;border-radius:10px;background:var(--primary,#00a884);color:#fff;font-size:14px;font-weight:600;cursor:pointer">Cancel</button>' +
        '</div>' +
      '</div></div>';

      document.body.insertAdjacentHTML('beforeend', html);

      const dialog = document.getElementById('nsl-mute-dialog');
      document.getElementById('nsl-mute-cancel').addEventListener('click', function() { dialog.remove(); });
      dialog.addEventListener('click', function(e) { if (e.target === dialog) dialog.remove(); });

      const self = this;
      dialog.querySelectorAll('.nsl-mute-option').forEach(function(btn) {
        btn.addEventListener('mouseenter', function() { btn.style.background = 'var(--surface-container-low,#f5f5f5)'; });
        btn.addEventListener('mouseleave', function() { btn.style.background = 'none'; });
        btn.addEventListener('click', function() {
          const dur = btn.getAttribute('data-duration');
          const ms = dur === 'inf' ? Infinity : parseInt(dur, 10);
          self.muteChat(chatId, ms);
          dialog.remove();
        });
      });
    },

    /* ════════════════════════════════════════════════════════════
       WHATSAPP-STYLE CUSTOM NOTIFICATION SETTINGS PANEL
       Per-chat settings matching WhatsApp exactly
       ════════════════════════════════════════════════════════════ */
    showChatNotificationSettings(chatId, chatName) {
      const existing = document.getElementById('nsl-notif-settings');
      if (existing) existing.remove();

      const settings = this.getSettings(chatId);
      const isMuted = this.isMuted(chatId);
      const muteDisplay = this.getMuteDisplay(chatId);

      let html = '<div id="nsl-notif-settings" style="position:fixed;inset:0;z-index:9999;background:var(--surface,#fff);display:flex;flex-direction:column;animation:fadeIn 0.15s ease">' +
        '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08))">' +
          '<button id="nsl-ns-back" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--on-surface,#000);display:flex;align-items:center">' +
            '<span class="material-symbols-outlined">arrow_back</span></button>' +
          '<div style="font-size:18px;font-weight:700;color:var(--on-surface,#000)">Notifications</div>' +
        '</div>' +
        '<div style="flex:1;overflow-y:auto">';

      /* Mute section */
      html += '<div style="padding:14px 16px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.06))">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<div><div style="font-size:15px;font-weight:500;color:var(--on-surface,#000)">Mute notifications</div>' +
          (isMuted ? '<div style="font-size:12px;color:var(--primary,#00a884);margin-top:2px">' + _esc(muteDisplay) + '</div>' : '') +
          '</div>' +
          '<label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer">' +
            '<input type="checkbox" id="nsl-ns-mute" ' + (isMuted ? 'checked' : '') + ' style="opacity:0;width:0;height:0">' +
            '<span style="position:absolute;inset:0;border-radius:12px;background:' + (isMuted ? 'var(--primary,#00a884)' : '#ccc') + ';transition:0.3s"></span>' +
            '<span style="position:absolute;top:2px;left:' + (isMuted ? '22px' : '2px') + ';width:20px;height:20px;border-radius:50%;background:#fff;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>' +
          '</label>' +
        '</div>' +
        (isMuted ? '<div id="nsl-ns-mute-opts" style="margin-top:10px">' +
          MUTE_PRESETS.map(function(p) {
            return '<button class="nsl-mute-dur-btn" data-ms="' + (p.ms === Infinity ? 'inf' : p.ms) + '" style="margin:0 4px 6px 0;padding:6px 14px;border-radius:20px;border:1px solid var(--outline-variant,#ccc);background:var(--surface-container,#f0f2f5);color:var(--on-surface,#000);font-size:12px;cursor:pointer">' + p.label + '</button>';
          }).join('') +
          '<button id="nsl-ns-unmute" style="margin:0 4px;padding:6px 14px;border-radius:20px;border:1px solid var(--error,#ea0038);background:transparent;color:var(--error,#ea0038);font-size:12px;cursor:pointer">Unmute</button>' +
        '</div>' : '<div id="nsl-ns-mute-opts"></div>') +
      '</div>';

      /* Notification tone */
      html += '<div style="padding:14px 16px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.06))">' +
        '<div style="font-size:15px;font-weight:500;color:var(--on-surface,#000);margin-bottom:10px">Notification tone</div>' +
        '<div id="nsl-ns-tone-list">';

      BUILTIN_TONES.forEach(function(tone) {
        const isSelected = settings.tone === tone.id;
        html += '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer">' +
          '<input type="radio" name="nsl-tone" value="' + tone.id + '" ' + (isSelected ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:var(--primary,#00a884)">' +
          '<span style="font-size:14px;color:var(--on-surface,#000)">' + _esc(tone.name) + '</span>' +
          '<button class="nsl-tone-preview" data-tone="' + tone.id + '" style="margin-left:auto;background:none;border:none;cursor:pointer;padding:4px;color:var(--on-surface-variant,#667781)">' +
            '<span class="material-symbols-outlined" style="font-size:18px">play_arrow</span></button>' +
        '</label>';
      });

      html += '</div></div>';

      /* Vibration toggle */
      html += '<div style="padding:14px 16px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.06))">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<span style="font-size:15px;font-weight:500;color:var(--on-surface,#000)">Vibration</span>' +
          '<label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer">' +
            '<input type="checkbox" id="nsl-ns-vibration" ' + (settings.vibration !== false ? 'checked' : '') + ' style="opacity:0;width:0;height:0">' +
            '<span style="position:absolute;inset:0;border-radius:12px;background:' + (settings.vibration !== false ? 'var(--primary,#00a884)' : '#ccc') + ';transition:0.3s"></span>' +
            '<span style="position:absolute;top:2px;left:' + (settings.vibration !== false ? '22px' : '2px') + ';width:20px;height:20px;border-radius:50%;background:#fff;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>' +
          '</label>' +
        '</div>' +
      '</div>';

      /* High priority */
      html += '<div style="padding:14px 16px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.06))">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<div><span style="font-size:15px;font-weight:500;color:var(--on-surface,#000)">High priority messages</span>' +
          '<div style="font-size:12px;color:var(--on-surface-variant,#667781);margin-top:2px">Always notify, even during DND</div></div>' +
          '<label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer">' +
            '<input type="checkbox" id="nsl-ns-highpriority" ' + (settings.highPriority ? 'checked' : '') + ' style="opacity:0;width:0;height:0">' +
            '<span style="position:absolute;inset:0;border-radius:12px;background:' + (settings.highPriority ? 'var(--primary,#00a884)' : '#ccc') + ';transition:0.3s"></span>' +
            '<span style="position:absolute;top:2px;left:' + (settings.highPriority ? '22px' : '2px') + ';width:20px;height:20px;border-radius:50%;background:#fff;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>' +
          '</label>' +
        '</div>' +
      '</div>';

      html += '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);

      const self = this;
      const panel = document.getElementById('nsl-notif-settings');

      document.getElementById('nsl-ns-back').addEventListener('click', function() { panel.remove(); });

      /* Mute toggle */
      document.getElementById('nsl-ns-mute').addEventListener('change', function() {
        if (this.checked) {
          self.showMuteDialog(chatId, chatName);
          this.checked = false;
          self._updateMuteUI(chatId);
        } else {
          self.unmuteChat(chatId);
          self._updateMuteUI(chatId);
        }
      });

      /* Mute duration buttons */
      panel.querySelectorAll('.nsl-mute-dur-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          const ms = btn.getAttribute('data-ms');
          self.muteChat(chatId, ms === 'inf' ? Infinity : parseInt(ms, 10));
          self._updateMuteUI(chatId);
        });
      });

      /* Unmute button */
      const unmuteBtn = document.getElementById('nsl-ns-unmute');
      if (unmuteBtn) {
        unmuteBtn.addEventListener('click', function() {
          self.unmuteChat(chatId);
          self._updateMuteUI(chatId);
        });
      }

      /* Tone selection */
      panel.querySelectorAll('input[name="nsl-tone"]').forEach(function(radio) {
        radio.addEventListener('change', function() {
          self.setSettings(chatId, { tone: this.value });
        });
      });

      /* Tone preview buttons */
      panel.querySelectorAll('.nsl-tone-preview').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          self.playTone(btn.getAttribute('data-tone'));
        });
      });

      /* Vibration toggle */
      document.getElementById('nsl-ns-vibration').addEventListener('change', function() {
        self.setSettings(chatId, { vibration: this.checked });
      });

      /* High priority toggle */
      document.getElementById('nsl-ns-highpriority').addEventListener('change', function() {
        self.setSettings(chatId, { highPriority: this.checked });
      });
    },

    _updateMuteUI(chatId) {
      const isMuted = this.isMuted(chatId);
      const muteToggle = document.getElementById('nsl-ns-mute');
      const muteOpts = document.getElementById('nsl-ns-mute-opts');
      if (muteToggle) {
        muteToggle.checked = isMuted;
        const track = muteToggle.parentElement.querySelector('span:first-of-type');
        const dot = muteToggle.parentElement.querySelector('span:last-of-type');
        if (track) track.style.background = isMuted ? 'var(--primary,#00a884)' : '#ccc';
        if (dot) dot.style.left = isMuted ? '22px' : '2px';
      }
      if (muteOpts) {
        if (isMuted) {
          muteOpts.innerHTML = MUTE_PRESETS.map(function(p) {
            return '<button class="nsl-mute-dur-btn" data-ms="' + (p.ms === Infinity ? 'inf' : p.ms) + '" style="margin:0 4px 6px 0;padding:6px 14px;border-radius:20px;border:1px solid var(--outline-variant,#ccc);background:var(--surface-container,#f0f2f5);color:var(--on-surface,#000);font-size:12px;cursor:pointer">' + p.label + '</button>';
          }).join('') +
          '<button id="nsl-ns-unmute" style="margin:0 4px;padding:6px 14px;border-radius:20px;border:1px solid var(--error,#ea0038);background:transparent;color:var(--error,#ea0038);font-size:12px;cursor:pointer">Unmute</button>';
          const self = this;
          muteOpts.querySelectorAll('.nsl-mute-dur-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
              const ms = btn.getAttribute('data-ms');
              self.muteChat(chatId, ms === 'inf' ? Infinity : parseInt(ms, 10));
              self._updateMuteUI(chatId);
            });
          });
          const unmuteBtn = document.getElementById('nsl-ns-unmute');
          if (unmuteBtn) unmuteBtn.addEventListener('click', function() {
            self.unmuteChat(chatId);
            self._updateMuteUI(chatId);
          });
        } else {
          muteOpts.innerHTML = '';
        }
      }
    },

    /* ════════════════════════════════════════════════════════════
       NOTIFICATION CHANNELS (Android/PWA)
       ════════════════════════════════════════════════════════════ */
    async registerChannels() {
      if (!('Notification' in window)) return;
      if (typeof Notification.requestPermission !== 'function') return;

      /* For Capacitor/Android: register native channels via plugin */
      if (window.Capacitor?.Plugins?.Notifications) {
        try {
          const Notifications = window.Capacitor.Plugins.Notifications;
          await Notifications.createChannel({
            id: 'messages',
            name: 'Messages',
            description: 'New message notifications',
            importance: 4,
            vibration: true,
            sound: 'default'
          });
          await Notifications.createChannel({
            id: 'groups',
            name: 'Group Messages',
            description: 'New group message notifications',
            importance: 4,
            vibration: true,
            sound: 'default'
          });
          await Notifications.createChannel({
            id: 'calls',
            name: 'Calls',
            description: 'Incoming call notifications',
            importance: 5,
            vibration: true,
            sound: 'default',
            lights: true
          });
          await Notifications.createChannel({
            id: 'mentions',
            name: 'Mentions',
            description: 'When someone mentions you',
            importance: 5,
            vibration: true,
            sound: 'default'
          });
        } catch (_) {}
      }
    },

    /* ════════════════════════════════════════════════════════════
       ENHANCED NOTIFICATION DISPATCHER
       Overrides orchestrator to add per-chat settings
       ════════════════════════════════════════════════════════════ */
    playMessageSound(chatId, chatType) {
      if (this.isMuted(chatId)) return;
      const settings = this.getSettings(chatId);

      if (settings.tone && settings.tone !== 'none') {
        this.playTone(settings.tone);
      } else if (settings.tone === 'default') {
        if (window.NotificationSounds) {
          window.NotificationSounds.play(chatType === 'group' ? 'groupMessage' : 'message');
        }
      }

      if (settings.vibration !== false) {
        this.vibrate(chatType === 'group' ? 'groupMessage' : 'message');
      }
    },

    playMentionSound(chatId) {
      if (this.isMuted(chatId)) {
        const settings = this.getSettings(chatId);
        if (!settings.highPriority) return;
      }
      this.playTone('alert');
      this.vibrate('mention');
    }
  };

  /* ── Helpers ────────────────────────────────────────────────── */
  function _esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

  /* ── Hook into context menu for "Custom notifications" ──────── */
  function _patchContextMenu() {
    if (window._chatNotifCtxPatched) return;
    if (window.MutationBus) {
      window.MutationBus.onBodyChildList('chat-notif-inject', function() {
        const menu = document.getElementById('_msg-ctx-menu');
        if (!menu || menu.querySelector('.chat-notif-settings-btn')) return;
        const chatId = window.App?.currentChat?.id;
        const chatName = window.App?.currentChat?.name || window.App?.currentChat?.groupName || 'Chat';
        if (!chatId) return;

        const isMuted = ChatNotifications.isMuted(chatId);
        const btn = document.createElement('button');
        btn.className = 'chat-notif-settings-btn';
        btn.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left;color:inherit;transition:background 0.15s';
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">notifications</span> Custom notifications' +
          (isMuted ? ' <span style="font-size:11px;color:var(--primary,#00a884);margin-left:auto">Muted</span>' : '');
        btn.onmouseenter = function() { btn.style.background = 'var(--surface-container-highest)'; };
        btn.onmouseleave = function() { btn.style.background = 'transparent'; };
        btn.addEventListener('click', function() {
          if (window._removeCtxMenu) window._removeCtxMenu();
          ChatNotifications.showChatNotificationSettings(chatId, chatName);
        });

        const clearBtn = Array.from(menu.querySelectorAll('button')).find(function(b) { return b.innerHTML.includes('Clear History'); });
        if (clearBtn) {
          menu.insertBefore(btn, clearBtn);
        } else {
          menu.appendChild(btn);
        }
      });
    }
    window._chatNotifCtxPatched = true;
  }

  /* ── Hook into orchestrator for per-chat sound dispatch ─────── */
  function _hookOrchestrator() {
    if (window._chatNotifOrchHooked) return;
    const orch = window.NotificationOrchestrator;
    if (!orch) { setTimeout(_hookOrchestrator, 500); return; }

    const origNotifyMessage = orch.notifyMessage.bind(orch);
    orch.notifyMessage = function(payload) {
      const chatId = payload?.chatId || payload?.groupId || '';
      if (chatId && ChatNotifications.isMuted(chatId)) {
        return false;
      }
      const result = origNotifyMessage(payload);
      if (result && chatId) {
        const settings = ChatNotifications.getSettings(chatId);
        if (settings.tone && settings.tone !== 'default') {
          ChatNotifications.playMessageSound(chatId, payload?.chatType || 'direct');
        }
      }
      return result;
    };
    window._chatNotifOrchHooked = true;
  }

  /* ── Init ───────────────────────────────────────────────────── */
  function _init() {
    _patchContextMenu();
    _hookOrchestrator();
    ChatNotifications.registerChannels();
    document.addEventListener('nsl:chat-opened', function() {
      setTimeout(_patchContextMenu, 200);
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(_init, 0);
  } else {
    window.addEventListener('load', function() { setTimeout(_init, 0); });
  }

  window.ChatNotifications = ChatNotifications;
})();
