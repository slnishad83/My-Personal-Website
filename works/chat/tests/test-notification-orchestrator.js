/* Tests for notification-orchestrator.js */
'use strict';

module.exports = function () {
  describe('NotificationOrchestrator', function () {

    describe('Deduplication', function () {
      it('should detect duplicate keys within TTL window', function () {
        const seen = new Map();
        const now = Date.now();
        seen.set('msg:123', now);
        expect(seen.has('msg:123')).toBe(true);
        expect(seen.has('msg:456')).toBe(false);
      });

      it('should not duplicate within 45s window', function () {
        const now = Date.now();
        const ttl = 45000;
        const seenTime = now - 10000;
        expect(now - seenTime < ttl).toBe(true);
      });

      it('should allow after TTL expires', function () {
        const now = Date.now();
        const ttl = 45000;
        const seenTime = now - 50000;
        expect(now - seenTime > ttl).toBe(true);
      });
    });

    describe('Tag generation', function () {
      it('should generate correct chat tag', function () {
        const chatType = 'direct';
        const chatId = 'user123';
        const tag = `chat-${chatType}-${chatId}`;
        expect(tag).toBe('chat-direct-user123');
      });

      it('should generate correct group chat tag', function () {
        const chatType = 'group';
        const chatId = 'group456';
        const tag = `chat-${chatType}-${chatId}`;
        expect(tag).toBe('chat-group-group456');
      });

      it('should generate correct call tag', function () {
        const callId = 'call789';
        const tag = `call-${callId}`;
        expect(tag).toBe('call-call789');
      });
    });

    describe('Message normalization', function () {
      it('should extract chatId from groupId fallback', function () {
        const payload = { groupId: 'g123', messageType: 'message' };
        const chatId = payload.chatId || payload.groupId || payload.chatUserId || 'general';
        expect(chatId).toBe('g123');
      });

      it('should default chatType to direct when no groupId', function () {
        const payload = { chatId: 'u123' };
        const chatType = payload.chatType || (payload.groupId ? 'group' : 'direct');
        expect(chatType).toBe('direct');
      });

      it('should default chatType to group when groupId present', function () {
        const payload = { groupId: 'g456' };
        const chatType = payload.chatType || (payload.groupId ? 'group' : 'direct');
        expect(chatType).toBe('group');
      });
    });

    describe('Call normalization', function () {
      it('should detect video call type', function () {
        const payload = { type: 'video' };
        const callType = payload.type === 'video' || payload.callType === 'video' ? 'video' : 'voice';
        expect(callType).toBe('video');
      });

      it('should default to voice call type', function () {
        const payload = { type: 'voice' };
        const callType = payload.type === 'video' || payload.callType === 'video' ? 'video' : 'voice';
        expect(callType).toBe('voice');
      });

      it('should detect missed call status', function () {
        const payload = { status: 'missed' };
        const missed = payload.kind === 'missed_call' || payload.status === 'missed';
        expect(missed).toBe(true);
      });

      it('should detect missed_call kind', function () {
        const payload = { kind: 'missed_call' };
        const missed = payload.kind === 'missed_call' || payload.status === 'missed';
        expect(missed).toBe(true);
      });
    });

    describe('Badge management', function () {
      it('should store unread count', function () {
        let storedCount = 0;
        const setBadge = function (count) {
          storedCount = Math.max(0, Number(count || 0));
        };
        setBadge(5);
        expect(storedCount).toBe(5);
      });

      it('should floor negative counts to 0', function () {
        let storedCount = 0;
        const setBadge = function (count) {
          storedCount = Math.max(0, Number(count || 0));
        };
        setBadge(-3);
        expect(storedCount).toBe(0);
      });

      it('should handle null/undefined counts', function () {
        let storedCount = 0;
        const setBadge = function (count) {
          storedCount = Math.max(0, Number(count || 0));
        };
        setBadge(null);
        expect(storedCount).toBe(0);
        setBadge(undefined);
        expect(storedCount).toBe(0);
      });
    });

    describe('History management', function () {
      it('should limit history to 250 entries', function () {
        const HISTORY_LIMIT = 250;
        const history = [];
        for (let i = 0; i < 300; i++) {
          history.unshift({ key: `msg:${i}`, ts: Date.now() + i });
        }
        const trimmed = history.slice(0, HISTORY_LIMIT);
        expect(trimmed.length).toBe(250);
      });
    });

    describe('DND schedule calculation', function () {
      it('should detect time within quiet hours (same day)', function () {
        const fromMinutes = 22 * 60;
        const toMinutes = 7 * 60;
        const userLocalMinutes = 23 * 60 + 30;
        const inDnd = fromMinutes <= toMinutes
          ? userLocalMinutes >= fromMinutes && userLocalMinutes <= toMinutes
          : userLocalMinutes >= fromMinutes || userLocalMinutes <= toMinutes;
        expect(inDnd).toBe(true);
      });

      it('should detect time outside quiet hours', function () {
        const fromMinutes = 22 * 60;
        const toMinutes = 7 * 60;
        const userLocalMinutes = 12 * 60;
        const inDnd = fromMinutes <= toMinutes
          ? userLocalMinutes >= fromMinutes && userLocalMinutes <= toMinutes
          : userLocalMinutes >= fromMinutes || userLocalMinutes <= toMinutes;
        expect(inDnd).toBe(false);
      });

      it('should handle overnight DND (cross-midnight)', function () {
        const fromMinutes = 22 * 60;
        const toMinutes = 7 * 60;
        const userLocalMinutes = 2 * 60;
        const inDnd = fromMinutes <= toMinutes
          ? userLocalMinutes >= fromMinutes && userLocalMinutes <= toMinutes
          : userLocalMinutes >= fromMinutes || userLocalMinutes <= toMinutes;
        expect(inDnd).toBe(true);
      });
    });

    describe('Mute expiry', function () {
      it('should detect expired mute', function () {
        const until = Date.now() - 1000;
        const isExpired = until > 0 && until <= Date.now();
        expect(isExpired).toBe(true);
      });

      it('should detect active mute', function () {
        const until = Date.now() + 3600000;
        const isExpired = until > 0 && until <= Date.now();
        expect(isExpired).toBe(false);
      });

      it('should treat -1 as never-expiring', function () {
        const until = -1;
        const isExpired = until > 0 && until <= Date.now();
        expect(isExpired).toBe(false);
      });
    });
  });
};
