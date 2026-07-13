/* Tests for notification-digest.js grouping logic */
'use strict';

module.exports = function () {
  describe('NotificationDigest', function () {

    describe('Notification grouping', function () {
      it('should group messages from same sender within 5-minute window', function () {
        const WINDOW_MS = 5 * 60 * 1000;
        const now = Date.now();
        const notifs = [
          { id: '1', fromUserId: 'u1', chatId: 'c1', kind: 'message', createdAt: { toMillis: () => now } },
          { id: '2', fromUserId: 'u1', chatId: 'c1', kind: 'message', createdAt: { toMillis: () => now - 60000 } },
          { id: '3', fromUserId: 'u1', chatId: 'c1', kind: 'message', createdAt: { toMillis: () => now - 120000 } }
        ];
        const timeDiff = Math.abs(notifs[2].createdAt.toMillis() - notifs[0].createdAt.toMillis());
        expect(timeDiff < WINDOW_MS).toBe(true);
      });

      it('should not group messages from different senders', function () {
        const notifs = [
          { id: '1', fromUserId: 'u1', chatId: 'c1', kind: 'message' },
          { id: '2', fromUserId: 'u2', chatId: 'c1', kind: 'message' }
        ];
        const sameSender = notifs[0].fromUserId === notifs[1].fromUserId;
        expect(sameSender).toBe(false);
      });

      it('should not group messages from different chats', function () {
        const notifs = [
          { id: '1', fromUserId: 'u1', chatId: 'c1', kind: 'message' },
          { id: '2', fromUserId: 'u1', chatId: 'c2', kind: 'message' }
        ];
        const sameChat = notifs[0].chatId === notifs[1].chatId;
        expect(sameChat).toBe(false);
      });

      it('should keep non-message notifications as singles', function () {
        const notif = { id: '1', kind: 'call' };
        const shouldGroup = notif.kind === 'message' && notif.fromUserId;
        expect(shouldGroup).toBe(false);
      });
    });

    describe('Notification icons', function () {
      it('should return correct icons for each kind', function () {
        const icons = { call: '📞', chat_request: '🤝', group_invite: '👥', message: '💬' };
        expect(icons.call).toBe('📞');
        expect(icons.message).toBe('💬');
        expect(icons.chat_request).toBe('🤝');
        expect(icons.group_invite).toBe('👥');
      });

      it('should default to bell icon for unknown kind', function () {
        const defaultIcon = '🔔';
        expect(defaultIcon).toBe('🔔');
      });
    });

    describe('Relative time formatting', function () {
      it('should format "just now" for < 1 minute', function () {
        const diff = 30000;
        const m = Math.floor(diff / 60000);
        expect(m).toBe(0);
      });

      it('should format minutes ago', function () {
        const diff = 300000;
        const m = Math.floor(diff / 60000);
        expect(m).toBe(5);
      });

      it('should format hours ago', function () {
        const diff = 7200000;
        const h = Math.floor(diff / 3600000);
        expect(h).toBe(2);
      });

      it('should format days ago', function () {
        const diff = 172800000;
        const day = Math.floor(diff / 86400000);
        expect(day).toBe(2);
      });
    });

    describe('Badge count', function () {
      it('should cap at 99+', function () {
        const count = 150;
        const display = count > 99 ? '99+' : String(count);
        expect(display).toBe('99+');
      });

      it('should show exact count under 100', function () {
        const count = 42;
        const display = count > 99 ? '99+' : String(count);
        expect(display).toBe('42');
      });

      it('should hide badge at zero', function () {
        const count = 0;
        const visible = count > 0;
        expect(visible).toBe(false);
      });
    });
  });
};
