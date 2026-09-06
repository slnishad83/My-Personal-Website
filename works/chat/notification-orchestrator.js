/* ============================================================
   NOTIFICATION ORCHESTRATOR
   Reliability layer for message alerts, calls, sounds, vibration,
   badges, history, duplicate suppression, and cross-tab sync.
   ============================================================ */
'use strict';

(function () {
  const HISTORY_KEY = 'tcNotificationHistory';
  const PREF_KEY = 'tcNotificationPrefs';
  const DEDUPE_TTL_MS = 45000;
  const HISTORY_LIMIT = 250;
  const CALL_RING_LIMIT_MS = 90000;

  const defaults = {
    messageSound: true,
    groupSound: true,
    callSound: true,
    callVibration: true,
    vibration: true,
    previews: true,
    silentUntil: 0
  };

  const Orchestrator = {
    _seen: new Map(),
    _channel: null,
    _ringInterval: null,
    _ringLimitTimer: null,
    _vibrateInterval: null,
    _activeCallId: '',
    _audio: null,

    _storedUnreadCount: 0,

    init() {
      this._setupBroadcastChannel();
      this._setupServiceWorkerBridge();
      this._setupRecoveryHooks();
      this.syncBadge();
    },

    getPrefs() {
      try { return { ...defaults, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; }
      catch (_) { return { ...defaults }; }
    },

    setPrefs(prefs) {
      const next = { ...this.getPrefs(), ...(prefs || {}) };
      try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch (_) {}
      return next;
    },

    notifyMessage(payload) {
      const item = this._normalizeMessage(payload);
      if (!item || this._isDuplicate(item.key)) return false;
      this._recordHistory(item);
      this._setBadge(item.unreadCount);
      document.dispatchEvent(new CustomEvent('tc:notification:message', { detail: item }));
      // Check if chat is muted (bypass for reactions - user should always see them)
      const isMuted = item.kind !== 'reaction' && this._isChatMuted(item.chatId);
      if (!isMuted && !this._isSilent(item)) {
        this._messageTone(item);
        // WhatsApp-style vibration patterns per type
        const vibratePattern = item.kind === 'mention' ? [220, 90, 220, 90, 220]
          : item.kind === 'reaction' ? [100]
          : item.chatType === 'group' ? [140, 50, 140]
          : [140];
        this._vibrate(vibratePattern);
      }
      if (document.visibilityState !== 'visible') this._showBrowserNotification(item);
      return true;
    },

    notifyCall(payload) {
      const item = this._normalizeCall(payload);
      if (!item || this._isDuplicate(item.key)) return false;
      this._recordHistory(item);
      this._activeCallId = item.callId;
      this._broadcast({ type: 'call-ringing', callId: item.callId });
      document.dispatchEvent(new CustomEvent('tc:notification:call', { detail: item }));
      // Calls always ring even if chat is muted (user should be able to decline)
      if (!this._isSilent(item)) this.startRingtone(item);
      if (document.visibilityState !== 'visible') this._showBrowserNotification(item);
      return true;
    },

    _isChatMuted(chatId) {
      if (!chatId) return false;
      // Check global mute
      if (typeof App !== 'undefined' && App._isMutedGlobal) return true;
      // Check per-chat mute with expiry
      if (typeof App !== 'undefined' && App._mutedChats?.has(chatId)) {
        if (typeof App !== 'undefined' && App._mutedUntil?.[chatId]) {
          const until = App._mutedUntil[chatId];
          if (until > 0 && until <= Date.now()) {
            // Mute expired, clean up
            App._mutedChats.delete(chatId);
            delete App._mutedUntil[chatId];
            return false;
          }
        }
        return true;
      }
      // Check DND settings from localStorage
      try {
        const dnd = JSON.parse(localStorage.getItem('nsl_dnd_settings') || '{}');
        if (dnd.enabled && dnd.from && dnd.to) {
          const now = new Date();
          const tzOffset = dnd.tzOffset || -now.getTimezoneOffset();
          const serverUtcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
          const userLocalMinutes = (serverUtcMinutes - tzOffset + 1440) % 1440;
          const [fromH, fromM] = dnd.from.split(':').map(Number);
          const [toH, toM] = dnd.to.split(':').map(Number);
          const fromMinutes = fromH * 60 + fromM;
          const toMinutes = toH * 60 + toM;
          let inDnd;
          if (fromMinutes <= toMinutes) {
            inDnd = userLocalMinutes >= fromMinutes && userLocalMinutes <= toMinutes;
          } else {
            inDnd = userLocalMinutes >= fromMinutes || userLocalMinutes <= toMinutes;
          }
          if (inDnd) return true;
        }
      } catch (_) {}
      return false;
    },

    markRead(scope) {
      const detail = scope || {};
      this._setBadge(Number(detail.unreadCount || 0));
      document.dispatchEvent(new CustomEvent('tc:notification:mark-read', { detail }));
      this._broadcast({ type: 'mark-read', scope: detail });
      if (detail.chatId) this.closeTag(`chat-${detail.chatType || 'chat'}-${detail.chatId}`);
    },

    callAnswered(callId) {
      this.stopRingtone(callId);
      if (window.NotificationSounds) window.NotificationSounds.play('callConnected');
      this._broadcast({ type: 'call-answered', callId });
      if (window.recordCallSyncEvent) window.recordCallSyncEvent({ callId, direction: 'incoming', status: 'answered' });
    },

    callDeclined(callId) {
      this.stopRingtone(callId);
      if (window.NotificationSounds) window.NotificationSounds.play('callDeclined');
      this._broadcast({ type: 'call-declined', callId });
      if (window.recordCallSyncEvent) window.recordCallSyncEvent({ callId, direction: 'incoming', status: 'declined' });
    },

    callMissed(callId, payload) {
      this.stopRingtone(callId);
      const item = this._normalizeCall({ ...(payload || {}), callId, kind: 'missed_call', status: 'missed' });
      this._recordHistory(item);
      if (window.recordCallSyncEvent) window.recordCallSyncEvent(item);
      if (window.NotificationSounds) {
        window.NotificationSounds.play('missedCall');
      } else if (!this._isSilent(item)) {
        this._messageTone({ priority: 'high' });
      }
    },

    callEnded() {
      if (window.NotificationSounds) window.NotificationSounds.play('callEnded');
    },

    startRingtone(call) {
      this.stopRingtone();
      this._activeCallId = call.callId || '';
      this._ringPattern();
      this._ringInterval = setInterval(() => this._ringPattern(), 2400);
      // WhatsApp-style call vibration: continuous pulse while ringing.
      // Controlled by the "Vibrate for calls" setting (independent of message vibration).
      const ringPrefs = this.getPrefs();
      if (ringPrefs.callVibration !== false) {
        this._vibrate([700, 250, 700, 700]);
        this._vibrateInterval = setInterval(() => this._vibrate([700, 250, 700, 700]), 2400);
      }
      // Auto-miss after 90 seconds (WhatsApp behavior)
      this._ringLimitTimer = setTimeout(() => this.callMissed(this._activeCallId, call), CALL_RING_LIMIT_MS);
    },

    stopRingtone(callId) {
      if (callId && this._activeCallId && callId !== this._activeCallId) return;
      clearInterval(this._ringInterval);
      clearInterval(this._vibrateInterval);
      clearTimeout(this._ringLimitTimer);
      this._ringInterval = null;
      this._vibrateInterval = null;
      this._ringLimitTimer = null;
      this._activeCallId = '';
      if (navigator.vibrate) navigator.vibrate(0);
    },

    closeTag(tag) {
      if (!navigator.serviceWorker?.ready || !tag) return;
      navigator.serviceWorker.ready.then((reg) => {
        if (!reg.getNotifications) return;
        return reg.getNotifications({ tag }).then((items) => items.forEach((item) => item.close()));
      }).catch(() => {});
    },

    getHistory() {
      try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        return Array.isArray(history) ? history : [];
      } catch (_) {
        return [];
      }
    },

    syncBadge() {
      this._setBadge(this._readUnreadCount());
    },

    _normalizeMessage(payload) {
      if (!payload || typeof payload !== 'object') return null;
      const chatId = String(payload.chatId || payload.groupId || payload.chatUserId || 'general');
      const chatType = String(payload.chatType || (payload.groupId ? 'group' : 'direct'));
      const kind = String(payload.kind || payload.messageType || 'message');
      const messageId = String(payload.messageId || payload.id || `${chatId}-${Date.now()}`);
      const previews = this.getPrefs().previews !== false;
      return {
        ...payload,
        key: `message:${messageId}`,
        kind,
        chatId,
        chatType,
        tag: `chat-${chatType}-${chatId}`,
        title: String(payload.title || this._titleFor(kind, chatType)),
        body: previews ? String(payload.body || payload.text || this._bodyFor(kind)) : 'New message',
        unreadCount: Number(payload.unreadCount || this._readUnreadCount() || 1),
        priority: payload.priority || (payload.mentioned ? 'high' : 'normal'),
        timestamp: Date.now()
      };
    },

    _normalizeCall(payload) {
      if (!payload || typeof payload !== 'object') return null;
      const callId = String(payload.callId || payload.id || `call-${Date.now()}`);
      const callType = payload.type === 'video' || payload.callType === 'video' ? 'video' : 'voice';
      const name = String(payload.fromUserName || payload.callerName || 'My Team Chat');
      const missed = payload.kind === 'missed_call' || payload.status === 'missed';
      return {
        ...payload,
        key: `${missed ? 'missed' : 'call'}:${callId}:${payload.status || 'ringing'}`,
        kind: missed ? 'missed_call' : 'call',
        callId,
        callType,
        direction: payload.direction || 'incoming',
        status: payload.status || 'ringing',
        tag: `call-${callId}`,
        title: payload.title || (missed ? 'Missed call' : `Incoming ${callType} call`),
        body: payload.body || `${name} ${missed ? 'called you' : 'is calling'}`,
        priority: 'high',
        requireInteraction: true,
        timestamp: Date.now()
      };
    },

    _titleFor(kind, chatType) {
      const titles = {
        image: 'Photo', video: 'Video', voice: 'Voice message', document: 'Document',
        file: 'File', contact: 'Contact', location: 'Location', sticker: 'Sticker',
        reaction: 'Reaction', mention: 'Mention', reply: 'Reply', edit: 'Edited message',
        delete: 'Deleted message', status_update: 'Status update', broadcast: 'Broadcast',
        announcement: 'Announcement', security: 'Security notification'
      };
      return titles[kind] || (chatType === 'group' ? 'New group message' : 'New message');
    },

    _bodyFor(kind) {
      const bodies = {
        image: 'Sent a photo', video: 'Sent a video', voice: 'Sent a voice message',
        document: 'Sent a document', file: 'Sent a file', contact: 'Shared a contact',
        location: 'Shared a location', sticker: 'Sent a sticker', reaction: 'Reacted to a message',
        mention: 'Mentioned you', reply: 'Replied to a message', edit: 'Edited a message',
        delete: 'Deleted a message', security: 'Security settings changed'
      };
      return bodies[kind] || 'New message';
    },

    _isDuplicate(key) {
      const now = Date.now();
      this._seen.forEach((at, seenKey) => { if (now - at > DEDUPE_TTL_MS) this._seen.delete(seenKey); });
      if (this._seen.size > 500) {
        var keys = Array.from(this._seen.keys());
        for (var i = 0; i < 100 && i < keys.length; i++) this._seen.delete(keys[i]);
      }
      if (this._seen.has(key)) return true;
      this._seen.set(key, now);
      return false;
    },

    _recordHistory(item) {
      const history = this.getHistory();
      history.unshift({
        key: item.key, kind: item.kind, title: item.title, body: item.body,
        tag: item.tag, chatId: item.chatId || '', callId: item.callId || '',
        timestamp: item.timestamp || Date.now()
      });
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT))); } catch (_) {}
    },

    _isSilent(item) {
      const prefs = this.getPrefs();
      if (Number(prefs.silentUntil || 0) > Date.now()) return true;
      return item?.silent === true || item?.soundEnabled === false || item?.soundEnabled === 'false';
    },

    _showBrowserNotification(item) {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const isReaction = item.kind === 'reaction';
      const notifOptions = {
        body: item.body,
        tag: isReaction ? 'reaction-' + (item.messageId || item.id || '') : item.tag,
        renotify: isReaction || item.priority === 'high',
        requireInteraction: Boolean(item.requireInteraction),
        icon: item.senderAvatar || item.fromUserAvatar || 'app-icon-192.png',
        badge: 'app-icon-192.png',
        image: item.kind === 'image' || item.kind === 'sticker' ? (item.attachmentUrl || item.image || '') : '',
        timestamp: item.timestamp || Date.now(),
        silent: false,
        data: isReaction
          ? { chatId: item.chatId, messageId: item.messageId || item.id, chatType: item.chatType, kind: 'reaction' }
          : item,
        vibrate: item.kind === 'call' ? [700, 250, 700, 700]
          : isReaction ? [100]
          : [140]
      };

      if (item.kind === 'call') {
        notifOptions.actions = [
          { action: 'reject', title: 'Decline', icon: 'app-icon-192.png' },
          { action: 'accept', title: 'Accept', icon: 'app-icon-192.png' }
        ];
      } else if (!isReaction) {
        notifOptions.actions = [
          { action: 'reply', title: 'Reply' },
          { action: 'mark_read', title: 'Mark as read' }
        ];
      }

      if (item.kind === 'call') notifOptions.tag = 'call-' + (item.callId || '');
      else if (!isReaction) {
        if (item.chatType === 'group') notifOptions.tag = 'group-' + (item.chatId || '');
        else notifOptions.tag = 'chat-' + (item.chatId || '');
      }

      navigator.serviceWorker?.ready.then((reg) => reg.showNotification(item.title, notifOptions)).catch(() => {});
    },

    _messageTone(item) {
      const prefs = this.getPrefs();
      if (!prefs.messageSound) return;
      if (item?.kind === 'reaction') {
        if (window.NotificationSounds) {
          window.NotificationSounds.play('reaction');
        } else {
          this._beep(1200, 0.03, 0.03);
        }
        return;
      }
      if (item?.chatType === 'group' && !prefs.groupSound) return;
      if (window.NotificationSounds) {
        window.NotificationSounds.play(item?.chatType === 'group' ? 'groupMessage' : 'message');
      } else {
        this._beep(880, 0.055, 0.045);
        setTimeout(() => this._beep(1174, 0.05, 0.035), 75);
      }
    },

    _ringPattern() {
      const cs = this.getPrefs().callSound;
      if (!cs || cs === 'silent' || cs === 'none') return;
      if (window.NotificationSounds) {
        const name = (typeof cs === 'string') ? cs : 'callRing';
        window.NotificationSounds.play(name);
      } else {
        this._beep(740, 0.45, 0.06);
        setTimeout(() => this._beep(880, 0.45, 0.055), 520);
      }
    },

    _beep(freq, seconds, volume) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!this._audio) this._audio = new Ctx();
        const osc = this._audio.createOscillator();
        const gain = this._audio.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.value = volume;
        osc.connect(gain);
        gain.connect(this._audio.destination);
        osc.start();
        osc.stop(this._audio.currentTime + seconds);
      } catch (_) {}
    },

    _vibrate(pattern) {
      if (!this.getPrefs().vibration || !navigator.vibrate) return;
      try { navigator.vibrate(pattern); } catch (_) {}
    },

    _setBadge(count) {
      const unread = Math.max(0, Number(count || 0));
      this._storedUnreadCount = unread;
      if (navigator.setAppBadge) {
        if (unread > 0) navigator.setAppBadge(unread).catch(() => {});
        else { try { navigator.clearAppBadge?.(); } catch(_){} }
      }
      document.dispatchEvent(new CustomEvent('tc:badge:update', { detail: { unread } }));
    },

    _readUnreadCount() {
      if (typeof this._storedUnreadCount === 'number') return this._storedUnreadCount;
      let total = 0;
      document.querySelectorAll('.unread-badge,.chat-unread-count,[data-unread-count]').forEach((node) => {
        total += Number(node.dataset.unreadCount || node.textContent || 0) || 0;
      });
      return total;
    },

    _setupBroadcastChannel() {
      if (!('BroadcastChannel' in window)) return;
      this._channel = new BroadcastChannel('tc-notifications');
      this._channel.onmessage = (event) => {
        const msg = event.data || {};
        if (msg.type === 'call-answered' || msg.type === 'call-declined') this.stopRingtone(msg.callId);
        if (msg.type === 'mark-read') this.syncBadge();
      };
    },

    _broadcast(message) {
      try { this._channel?.postMessage(message); } catch (_) {}
    },

    _setupServiceWorkerBridge() {
      if (!navigator.serviceWorker) return;
      navigator.serviceWorker.addEventListener('message', (event) => {
        const msg = event.data || {};
        if (msg.type === 'TC_PUSH_MESSAGE') this.notifyMessage(msg.payload || {});
        if (msg.type === 'TC_PUSH_CALL') this.notifyCall(msg.payload || {});
        if (msg.type === 'TC_MARK_READ') this.markRead(msg.scope || {});
        if (msg.type === 'TC_CALL_STOP') this.stopRingtone(msg.callId);
        if (msg.type === 'TC_READ_SYNC') {
          document.dispatchEvent(new CustomEvent('tc:notification:read-sync', { detail: msg }));
          this.syncBadge();
        }
      });
    },

    _setupRecoveryHooks() {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.syncBadge();
      });
      window.addEventListener('online', () => {
        this.syncBadge();
        if (window.CallSync?.processQueue) window.CallSync.processQueue();
      });
    }
  };

  window.NotificationOrchestrator = Orchestrator;
  window.notifyTeamChatMessage = (payload) => Orchestrator.notifyMessage(payload);
  window.notifyTeamChatCall = (payload) => Orchestrator.notifyCall(payload);

  if (document.readyState === 'complete') setTimeout(() => Orchestrator.init(), 0);
  else window.addEventListener('load', () => setTimeout(() => Orchestrator.init(), 0));
})();
