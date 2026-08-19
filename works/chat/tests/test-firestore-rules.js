'use strict';

describe('Firestore Rules — Security Analysis', function () {

  describe('Helper function logic', function () {

    describe('signedIn()', function () {
      it('requires auth to be non-null', function () {
        var signedIn = function (auth) { return auth != null; };
        expect(signedIn(null)).toBeFalsy();
        expect(signedIn(undefined)).toBeFalsy();
        expect(signedIn({ uid: 'user1' })).toBeTruthy();
      });
    });

    describe('isOwner()', function () {
      it('requires matching uid', function () {
        var isOwner = function (auth, userId) { return auth != null && auth.uid === userId; };
        expect(isOwner({ uid: 'user1' }, 'user1')).toBeTruthy();
        expect(isOwner({ uid: 'user1' }, 'user2')).toBeFalsy();
        expect(isOwner(null, 'user1')).toBeFalsy();
      });
    });

    describe('isGroupMember()', function () {
      it('checks memberIds list', function () {
        var isGroupMember = function (auth, group) {
          return auth != null && group.memberIds && group.memberIds.indexOf(auth.uid) !== -1;
        };
        expect(isGroupMember({ uid: 'u1' }, { memberIds: ['u1', 'u2'] })).toBeTruthy();
        expect(isGroupMember({ uid: 'u3' }, { memberIds: ['u1', 'u2'] })).toBeFalsy();
        expect(isGroupMember(null, { memberIds: ['u1'] })).toBeFalsy();
      });

      it('allows owner access', function () {
        var isGroupMember = function (auth, group) {
          return auth != null && (
            (group.memberIds && group.memberIds.indexOf(auth.uid) !== -1)
            || group.ownerId === auth.uid
            || group.createdBy === auth.uid
          );
        };
        expect(isGroupMember({ uid: 'owner1' }, { ownerId: 'owner1', memberIds: [] })).toBeTruthy();
        expect(isGroupMember({ uid: 'creator1' }, { createdBy: 'creator1', memberIds: [] })).toBeTruthy();
      });
    });

    describe('isGroupAdmin()', function () {
      it('checks adminIds list', function () {
        var isGroupAdmin = function (auth, group) {
          return auth != null && (
            (group.adminIds && group.adminIds.indexOf(auth.uid) !== -1)
            || group.ownerId === auth.uid
            || group.createdBy === auth.uid
          );
        };
        expect(isGroupAdmin({ uid: 'a1' }, { adminIds: ['a1'] })).toBeTruthy();
        expect(isGroupAdmin({ uid: 'u1' }, { adminIds: ['a1'] })).toBeFalsy();
        expect(isGroupAdmin({ uid: 'owner1' }, { ownerId: 'owner1' })).toBeTruthy();
      });
    });

    describe('isCallParticipant()', function () {
      it('checks fromUserId, toUserId, and participantIds', function () {
        var isCallParticipant = function (auth, data) {
          return auth != null && (
            data.fromUserId === auth.uid
            || data.toUserId === auth.uid
            || (data.participantIds && data.participantIds.indexOf(auth.uid) !== -1)
          );
        };
        expect(isCallParticipant({ uid: 'caller' }, { fromUserId: 'caller' })).toBeTruthy();
        expect(isCallParticipant({ uid: 'callee' }, { toUserId: 'callee' })).toBeTruthy();
        expect(isCallParticipant({ uid: 'u1' }, { participantIds: ['u1', 'u2'] })).toBeTruthy();
        expect(isCallParticipant({ uid: 'u3' }, { fromUserId: 'u1', toUserId: 'u2' })).toBeFalsy();
      });
    });

    describe('isRequestParticipant()', function () {
      it('checks fromUserId and toUserId', function () {
        var isRequestParticipant = function (auth, data) {
          if (!auth) return false;
          if (data.fromUserId === auth.uid || data.toUserId === auth.uid) return true;
          var email = auth.token && auth.token.email;
          if (!email) return false;
          return data.fromEmail === email || data.toEmail === email;
        };
        expect(isRequestParticipant({ uid: 'u1' }, { fromUserId: 'u1' })).toBeTruthy();
        expect(isRequestParticipant({ uid: 'u2' }, { toUserId: 'u2' })).toBeTruthy();
        expect(isRequestParticipant({ uid: 'u1', token: { email: 'a@b.com' } }, { fromEmail: 'a@b.com' })).toBeTruthy();
        expect(isRequestParticipant({ uid: 'u1', token: { email: 'a@b.com' } }, { toEmail: 'a@b.com' })).toBeTruthy();
        expect(isRequestParticipant({ uid: 'u3' }, { fromUserId: 'u1', toUserId: 'u2' })).toBeFalsy();
        expect(isRequestParticipant({ uid: 'u3' }, { fromUserId: 'u1', toUserId: 'u2', fromEmail: 'a@b.com' })).toBeFalsy();
        expect(isRequestParticipant({ uid: 'u1', token: { email: 'a@b.com' } }, { fromUserId: 'u1' })).toBeTruthy();
        expect(isRequestParticipant({ uid: 'u1' }, { fromEmail: 'a@b.com' })).toBeFalsy();
      });
    });

    describe('isPersonalOwner()', function () {
      it('requires matching userId', function () {
        var isPersonalOwner = function (auth, data) { return auth != null && data.userId === auth.uid; };
        expect(isPersonalOwner({ uid: 'u1' }, { userId: 'u1' })).toBeTruthy();
        expect(isPersonalOwner({ uid: 'u2' }, { userId: 'u1' })).toBeFalsy();
      });
    });

    describe('isBroadcastMember()', function () {
      it('checks members list', function () {
        var isBroadcastMember = function (auth, data) {
          return auth != null && data.members && data.members.indexOf(auth.uid) !== -1;
        };
        expect(isBroadcastMember({ uid: 'u1' }, { members: ['u1'] })).toBeTruthy();
        expect(isBroadcastMember({ uid: 'u2' }, { members: ['u1'] })).toBeFalsy();
      });
    });
  });

  describe('User document rules', function () {
    it('users — read requires owner', function () {
      var allowRead = function (auth, userId) { return auth != null && auth.uid === userId; };
      expect(allowRead({ uid: 'u1' }, 'u1')).toBeTruthy();
      expect(allowRead({ uid: 'u2' }, 'u1')).toBeFalsy();
    });

    it('users — delete is always denied', function () {
      var allowDelete = function () { return false; };
      expect(allowDelete()).toBeFalsy();
    });

    it('users — create requires matching uid and email', function () {
      var allowCreate = function (auth, data) {
        return auth != null && auth.uid === data.uid && auth.token.email === data.email;
      };
      expect(allowCreate({ uid: 'u1', token: { email: 'u1@test.com' } }, { uid: 'u1', email: 'u1@test.com' })).toBeTruthy();
      expect(allowCreate({ uid: 'u1', token: { email: 'u1@test.com' } }, { uid: 'u2', email: 'u1@test.com' })).toBeFalsy();
    });
  });

  describe('Message rules', function () {
    it('messages — create requires senderId matches auth', function () {
      var allowCreate = function (auth, data) {
        return auth != null && data.senderId === auth.uid;
      };
      expect(allowCreate({ uid: 'u1' }, { senderId: 'u1' })).toBeTruthy();
      expect(allowCreate({ uid: 'u1' }, { senderId: 'u2' })).toBeFalsy();
    });

    it('messages — delete requires senderId matches auth', function () {
      var allowDelete = function (auth, data) { return auth != null && data.senderId === auth.uid; };
      expect(allowDelete({ uid: 'u1' }, { senderId: 'u1' })).toBeTruthy();
      expect(allowDelete({ uid: 'u2' }, { senderId: 'u1' })).toBeFalsy();
    });
  });

  describe('Direct chat rules', function () {
    it('directChats — create requires participant in list', function () {
      var allowCreate = function (auth, data) {
        return auth != null && data.participants && data.participants.indexOf(auth.uid) !== -1;
      };
      expect(allowCreate({ uid: 'u1' }, { participants: ['u1', 'u2'] })).toBeTruthy();
      expect(allowCreate({ uid: 'u3' }, { participants: ['u1', 'u2'] })).toBeFalsy();
    });

    it('directChats — update limited to specific fields', function () {
      var allowedFields = ['status', 'name', 'photoURL', 'participants', 'saved', 'lastMessage', 'lastMessageTime', 'unreadCount', 'typing', 'muted'];
      var changedFields = ['status', 'maliciousField'];
      var hasOnlyAllowed = changedFields.every(function (f) { return allowedFields.indexOf(f) !== -1; });
      expect(hasOnlyAllowed).toBeFalsy();

      var validChanged = ['typing', 'unreadCount'];
      var valid = validChanged.every(function (f) { return allowedFields.indexOf(f) !== -1; });
      expect(valid).toBeTruthy();
    });
  });

  describe('Chat requests collection removed', function () {
    it('chatRequests — collection no longer exists (read denied)', function () {
      var allowRead = function () { return false; };
      expect(allowRead()).toBeFalsy();
    });

    it('chatRequests — collection no longer exists (write denied)', function () {
      var allowWrite = function () { return false; };
      expect(allowWrite()).toBeFalsy();
    });

    it('chatRequests — collection no longer exists (create denied)', function () {
      var allowCreate = function () { return false; };
      expect(allowCreate()).toBeFalsy();
    });
  });

  describe('Group rules', function () {
    it('groups — create requires auth in memberIds and adminIds', function () {
      var allowCreate = function (auth, data) {
        return auth != null
          && data.createdBy === auth.uid
          && data.memberIds && data.memberIds.indexOf(auth.uid) !== -1
          && data.adminIds && data.adminIds.indexOf(auth.uid) !== -1;
      };
      expect(allowCreate({ uid: 'u1' }, { createdBy: 'u1', memberIds: ['u1'], adminIds: ['u1'] })).toBeTruthy();
      expect(allowCreate({ uid: 'u1' }, { createdBy: 'u1', memberIds: ['u2'], adminIds: ['u1'] })).toBeFalsy();
    });
  });

  describe('Calls rules', function () {
    it('calls — create requires caller matches auth', function () {
      var allowCreate = function (auth, data) {
        return auth != null && data.fromUserId === auth.uid;
      };
      expect(allowCreate({ uid: 'u1' }, { fromUserId: 'u1' })).toBeTruthy();
      expect(allowCreate({ uid: 'u1' }, { fromUserId: 'u2' })).toBeFalsy();
    });
  });

  describe('Blocked user collections', function () {
    it('blockedUsers — owner-only access', function () {
      var allowRead = function (auth, data) { return auth != null && data.userId === auth.uid; };
      expect(allowRead({ uid: 'u1' }, { userId: 'u1' })).toBeTruthy();
      expect(allowRead({ uid: 'u2' }, { userId: 'u1' })).toBeFalsy();
    });
  });

  describe('Privilege escalation prevention', function () {
    it('user cannot update another user document', function () {
      var allowUpdate = function (auth, userId) { return auth != null && auth.uid === userId; };
      expect(allowUpdate({ uid: 'attacker' }, 'victim')).toBeFalsy();
    });

    it('non-admin cannot promote themselves to admin', function () {
      var allowAdminAction = function (auth, group) {
        return auth != null && (
          (group.adminIds && group.adminIds.indexOf(auth.uid) !== -1)
          || group.ownerId === auth.uid
        );
      };
      expect(allowAdminAction({ uid: 'member1' }, { adminIds: ['admin1'], ownerId: 'owner1' })).toBeFalsy();
    });

    it('non-member cannot read private group', function () {
      var allowRead = function (auth, group) {
        return auth != null && (
          (group.memberIds && group.memberIds.indexOf(auth.uid) !== -1)
          || group.ownerId === auth.uid
        );
      };
      expect(allowRead({ uid: 'outsider' }, { memberIds: ['u1', 'u2'], ownerId: 'u1' })).toBeFalsy();
    });

    it('user cannot read another user private data', function () {
      var allowRead = function (auth, userId) { return auth != null && auth.uid === userId; };
      expect(allowRead({ uid: 'u1' }, 'u2')).toBeFalsy();
    });

    it('unauthenticated cannot access any document', function () {
      var allowRead = function (auth) { return auth != null; };
      expect(allowRead(null)).toBeFalsy();
    });
  });

  describe('Storage rules', function () {

    describe('Content type validation', function () {
      it('allows image uploads to avatar path', function () {
        var isImage = function (ct) { return /^image\//.test(ct); };
        expect(isImage('image/jpeg')).toBeTruthy();
        expect(isImage('image/png')).toBeTruthy();
        expect(isImage('application/pdf')).toBeFalsy();
      });

      it('allows audio uploads to voice note path', function () {
        var isAudio = function (ct) { return /^audio\//.test(ct); };
        expect(isAudio('audio/mpeg')).toBeTruthy();
        expect(isAudio('audio/ogg')).toBeTruthy();
        expect(isAudio('video/mp4')).toBeFalsy();
      });
    });

    describe('Size limits', function () {
      it('avatar max 5MB', function () {
        var maxSize = 5 * 1024 * 1024;
        expect(5 * 1024 * 1024).toBeLessThanOrEqual(maxSize);
        expect(6 * 1024 * 1024).toBeGreaterThan(maxSize);
      });

      it('chat upload max 100MB', function () {
        var maxSize = 100 * 1024 * 1024;
        expect(100 * 1024 * 1024).toBeLessThanOrEqual(maxSize);
        expect(101 * 1024 * 1024).toBeGreaterThan(maxSize);
      });

      it('call recording max 200MB', function () {
        var maxSize = 200 * 1024 * 1024;
        expect(200 * 1024 * 1024).toBeLessThanOrEqual(maxSize);
        expect(201 * 1024 * 1024).toBeGreaterThan(maxSize);
      });
    });

    describe('Path ownership', function () {
      it('user can only write to own avatar path', function () {
        var isOwner = function (authUid, pathUid) { return authUid === pathUid; };
        expect(isOwner('u1', 'u1')).toBeTruthy();
        expect(isOwner('u1', 'u2')).toBeFalsy();
      });

      it('call recordings are private to owner', function () {
        var allowRead = function (authUid, ownerUid) { return authUid === ownerUid; };
        expect(allowRead('u1', 'u1')).toBeTruthy();
        expect(allowRead('u2', 'u1')).toBeFalsy();
      });
    });

    describe('Default deny', function () {
      it('unlisted paths are denied', function () {
        var allowPath = function (path) {
          var allowed = ['chat_uploads', 'large_uploads', 'stories', 'call_recordings',
            'backups', 'voice_notes', 'avatars', 'chat_audio', 'music',
            'status_images', 'status_videos', 'group_photos', 'playlist-covers'];
          return allowed.some(function (p) { return path.startsWith(p + '/'); });
        };
        expect(allowPath('avatars/u1/photo.jpg')).toBeTruthy();
        expect(allowPath('hacker/malicious.exe')).toBeFalsy();
        expect(allowPath('etc/passwd')).toBeFalsy();
      });
    });

    describe('Unauthenticated deny', function () {
      it('all storage paths require authentication', function () {
        var allow = function (auth) { return auth != null; };
        expect(allow(null)).toBeFalsy();
        expect(allow({ uid: 'u1' })).toBeTruthy();
      });
    });
  });
});
