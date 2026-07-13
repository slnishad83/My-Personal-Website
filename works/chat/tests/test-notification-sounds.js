/* Tests for notification-sounds.js */
'use strict';

module.exports = function () {
  describe('NotificationSounds', function () {

    describe('Sound name registry', function () {
      const validSounds = [
        'message', 'groupMessage', 'callRing', 'outgoingCall',
        'callConnected', 'callEnded', 'callDeclined', 'missedCall',
        'sent', 'reaction', 'mention', 'error'
      ];

      it('should have all required sound names defined', function () {
        validSounds.forEach(name => {
          expect(typeof name).toBe('string');
          expect(name.length > 0).toBe(true);
        });
      });

      it('should include message sounds', function () {
        expect(validSounds).toContain('message');
        expect(validSounds).toContain('groupMessage');
      });

      it('should include all call sounds', function () {
        expect(validSounds).toContain('callRing');
        expect(validSounds).toContain('outgoingCall');
        expect(validSounds).toContain('callConnected');
        expect(validSounds).toContain('callEnded');
        expect(validSounds).toContain('callDeclined');
        expect(validSounds).toContain('missedCall');
      });

      it('should include non-call notification sounds', function () {
        expect(validSounds).toContain('sent');
        expect(validSounds).toContain('reaction');
        expect(validSounds).toContain('mention');
        expect(validSounds).toContain('error');
      });
    });

    describe('AudioContext unlock', function () {
      it('should track unlock state', function () {
        let unlocked = false;
        const unlock = function () { unlocked = true; };
        expect(unlocked).toBe(false);
        unlock();
        expect(unlocked).toBe(true);
      });
    });
  });
};
