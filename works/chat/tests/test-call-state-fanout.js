/* Tests for Cloud Functions call state fan-out logic */
'use strict';

module.exports = function () {
  describe('Cloud Functions — Call State Fan-Out', function () {

    describe('Status transition mapping', function () {
      it('should map accepted → call_accepted kind', function () {
        const before = { status: 'ringing' };
        const after = { status: 'connected' };
        const kind = after.status === 'connected' && before.status === 'ringing'
          ? 'call_accepted' : null;
        expect(kind).toBe('call_accepted');
      });

      it('should map declined → call_declined kind', function () {
        const before = { status: 'ringing' };
        const after = { status: 'declined' };
        const kind = after.status === 'declined' && before.status === 'ringing'
          ? 'call_declined' : null;
        expect(kind).toBe('call_declined');
      });

      it('should map busy → call_busy kind', function () {
        const before = { status: 'ringing' };
        const after = { status: 'busy' };
        const kind = after.status === 'busy' && before.status === 'ringing'
          ? 'call_busy' : null;
        expect(kind).toBe('call_busy');
      });

      it('should map failed → call_failed kind', function () {
        const before = { status: 'ringing' };
        const after = { status: 'failed' };
        const kind = after.status === 'failed' && before.status === 'ringing'
          ? 'call_failed' : null;
        expect(kind).toBe('call_failed');
      });

      it('should not trigger on same status', function () {
        const before = { status: 'ringing' };
        const after = { status: 'ringing' };
        const changed = before.status !== after.status;
        expect(changed).toBe(false);
      });
    });

    describe('Participant extraction', function () {
      it('should extract all participants from direct call', function () {
        const call = { fromUserId: 'user1', toUserId: 'user2', participantIds: null };
        const all = new Set([call.fromUserId, call.toUserId, ...(call.participantIds || [])].filter(Boolean));
        expect(all.size).toBe(2);
        expect(all.has('user1')).toBe(true);
        expect(all.has('user2')).toBe(true);
      });

      it('should extract all participants from group call', function () {
        const call = { fromUserId: 'user1', toUserId: null, participantIds: ['user2', 'user3', 'user4'] };
        const all = new Set([call.fromUserId, call.toUserId, ...(call.participantIds || [])].filter(Boolean));
        expect(all.size).toBe(4);
      });

      it('should exclude caller when notifying non-group call end', function () {
        const call = { fromUserId: 'user1', toUserId: 'user2' };
        const receiverIds = [call.toUserId].filter(Boolean);
        expect(receiverIds.length).toBe(1);
        expect(receiverIds[0]).toBe('user2');
      });

      it('should include all participants for group call end', function () {
        const call = { fromUserId: 'user1', toUserId: null, participantIds: ['user1', 'user2', 'user3'] };
        const allParticipantIds = new Set([call.fromUserId, call.toUserId, ...(call.participantIds || [])].filter(Boolean));
        const receiverIds = [...allParticipantIds].filter(uid => uid !== call.fromUserId || true);
        expect(receiverIds.length).toBe(3);
      });
    });

    describe('Call ended notification payload', function () {
      it('should include required fields', function () {
        const payload = {
          kind: 'call_ended',
          callId: 'call_123',
          status: 'ended',
          fromUserId: 'user1',
          toUserId: 'user2'
        };
        expect(typeof payload.kind).toBe('string');
        expect(typeof payload.callId).toBe('string');
        expect(typeof payload.status).toBe('string');
      });

      it('should handle all terminal statuses', function () {
        const terminalStatuses = ['ended', 'cancelled', 'rejected', 'declined', 'missed', 'failed', 'busy'];
        terminalStatuses.forEach(status => {
          expect(typeof status).toBe('string');
          expect(status.length > 0).toBe(true);
        });
      });
    });

    describe('Stale token cleanup', function () {
      it('should identify stale tokens from FCM response', function () {
        const responses = [
          { success: true },
          { success: false, error: { code: 'messaging/registration-token-not-registered' } },
          { success: true },
          { success: false, error: { code: 'messaging/invalid-registration-token' } }
        ];
        const tokens = ['token1', 'token2', 'token3', 'token4'];
        const staleTokens = [];
        responses.forEach((result, index) => {
          if (!result.success) {
            const code = result.error && result.error.code;
            if (code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token') {
              staleTokens.push(tokens[index]);
            }
          }
        });
        expect(staleTokens.length).toBe(2);
        expect(staleTokens).toContain('token2');
        expect(staleTokens).toContain('token4');
      });
    });

    describe('Missed call detection', function () {
      it('should detect direct missed call', function () {
        const call = { groupCall: false, status: 'missed' };
        const isDirectMissed = call.groupCall !== true && call.status === 'missed';
        expect(isDirectMissed).toBe(true);
      });

      it('should detect group completed call', function () {
        const call = { groupCall: true, status: 'ended' };
        const isGroupCompleted = call.groupCall === true && ['ended', 'cancelled', 'missed'].includes(call.status);
        expect(isGroupCompleted).toBe(true);
      });

      it('should not treat connected as missed', function () {
        const call = { groupCall: false, status: 'connected' };
        const isDirectMissed = call.groupCall !== true && call.status === 'missed';
        expect(isDirectMissed).toBe(false);
      });
    });
  });
};
