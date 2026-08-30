'use strict';

module.exports = function () {
  var path = require('path');

  function installEnv(docs) {
    var usersById = docs || {};
    var w = {};
    w.db = {
      collection: function (name) {
        if (name !== 'users') throw new Error('unexpected collection ' + name);
        return {
          doc: function (id) {
            return {
              get: function () {
                return Promise.resolve({
                  exists: Object.prototype.hasOwnProperty.call(usersById, id),
                  data: function () { return usersById[id]; }
                });
              }
            };
          }
        };
      }
    };
    global.window = w;
    delete require.cache[path.join(__dirname, '..', 'verified-peers.js')];
    require('../verified-peers.js');
    return w;
  }

  function doc(emailVerified, pendingVerification, extra) {
    var d = Object.assign({ emailVerified: !!emailVerified, pendingVerification: !!pendingVerification }, extra || {});
    return d;
  }

  describe('Verified peers — data verdict', function () {
    it('email-verified user is verified', function () {
      var w = installEnv({});
      expect(w.isUserRegisteredVerifiedData(doc(true, false))).toBe(true);
    });
    it('phone-verified user is verified', function () {
      var w = installEnv({});
      expect(w.isUserRegisteredVerifiedData({ phoneVerified: true, pendingVerification: false })).toBe(true);
    });
    it('pending-verification user is not verified', function () {
      var w = installEnv({});
      expect(w.isUserRegisteredVerifiedData(doc(false, true))).toBe(false);
      expect(w.isUserRegisteredVerifiedData(doc(true, true))).toBe(false);
    });
    it('registered but not verified is not verified', function () {
      var w = installEnv({});
      expect(w.isUserRegisteredVerifiedData(doc(false, false))).toBe(false);
    });
    it('deleted / inactive users are not verified', function () {
      var w = installEnv({});
      expect(w.isUserRegisteredVerifiedData({ emailVerified: true, deletedAt: 1 })).toBe(false);
      expect(w.isUserRegisteredVerifiedData({ phoneVerified: true, isActive: false })).toBe(false);
    });
    it('missing doc is not verified', function () {
      var w = installEnv({});
      expect(w.isUserRegisteredVerifiedData(null)).toBe(false);
    });
  });

  describe('Verified peers — verifyUsers', function () {
    it('resolves a map marking only registered+verified users', async function () {
      var docs = {
        v1: doc(true, false),
        v2: { phoneVerified: true, pendingVerification: false },
        u1: doc(false, true),
        u3: doc(false, false)
      };
      var w = installEnv(docs);
      var map = await w.verifyUsers(['v1', 'v2', 'u1', 'u3', 'u4']);
      expect(map.v1).toBe(true);
      expect(map.v2).toBe(true);
      expect(map.u1).toBe(false);
      expect(map.u3).toBe(false);
      expect(map.u4).toBe(false);
      return true;
    });

    it('caches results so repeat checks do not re-read Firestore', async function () {
      var docs = { v1: doc(true, false) };
      var w = installEnv(docs);
      var reads = 0;
      var origDoc = w.db.collection('users').doc;
      w.db.collection('users').doc = function (id) { reads++; return origDoc(id); };
      await w.verifyUsers(['v1']);
      var first = reads;
      await w.verifyUsers(['v1']);
      expect(reads).toBe(first);
      expect(w.isVerifiedUser('v1')).toBe(true);
      return true;
    });

    it('isVerifiedUser reflects cache (async-safe after verify)', async function () {
      var docs = { v1: doc(true, false), u3: doc(false, false) };
      var w = installEnv(docs);
      await w.verifyUsers(['v1', 'u3']);
      expect(w.isVerifiedUser('v1')).toBe(true);
      expect(w.isVerifiedUser('u3')).toBe(false);
      expect(w.getVerifiedUserMap().v1).toBe(true);
      return true;
    });
  });

  describe('Verified peers — group gate', function () {
    it('accepts groups whose members are all verified', async function () {
      var docs = { v1: doc(true, false), v2: { phoneVerified: true } };
      var w = installEnv(docs);
      await w.verifyUsers(['v1', 'v2']);
      expect(w.isGroupOfRegisteredVerified(['v1', 'v2'], 'me')).toBe(true);
      return true;
    });
    it('rejects groups containing an unverified member', async function () {
      var docs = { v1: doc(true, false), u3: doc(false, false) };
      var w = installEnv(docs);
      await w.verifyUsers(['v1', 'u3']);
      expect(w.isGroupOfRegisteredVerified(['v1', 'u3'], 'me')).toBe(false);
      return true;
    });
    it('ignores self and empty members', function () {
      var w = installEnv({});
      expect(w.isGroupOfRegisteredVerified(['me'], 'me')).toBe(true);
      expect(w.isGroupOfRegisteredVerified([], 'me')).toBe(true);
    });
  });

  describe('Verified peers — call gate', function () {
    var docs = { v1: doc(true, false), u3: doc(false, false) };

    it('computes the ids to check for direct calls', function () {
      var w = installEnv(docs);
      expect(w.callPeerIdsToCheck({ direction: 'incoming', fromUserId: 'v1', toUserId: 'me' }, 'me'))
        .toEqual(['v1']);
      expect(w.callPeerIdsToCheck({ direction: 'outgoing', toUserId: 'v2' }, 'me'))
        .toEqual(['v2']);
    });
    it('computes participant ids for group calls', function () {
      var w = installEnv(docs);
      expect(w.callPeerIdsToCheck({ groupId: 'g1', participantIds: ['me', 'v1'] }, 'me'))
        .toEqual(['v1']);
    });
    it('eligible only when the other party is verified', async function () {
      var w = installEnv(docs);
      await w.verifyUsers(['v1', 'u3']);
      expect(w.callIsEligible({ direction: 'incoming', fromUserId: 'v1', toUserId: 'me' }, 'me')).toBe(true);
      expect(w.callIsEligible({ direction: 'incoming', fromUserId: 'u3', toUserId: 'me' }, 'me')).toBe(false);
      expect(w.callIsEligible({ direction: 'outgoing', toUserId: 'v1' }, 'me')).toBe(true);
      expect(w.callIsEligible({ groupId: 'g1', participantIds: ['me', 'v1'] }, 'me')).toBe(true);
      expect(w.callIsEligible({ groupId: 'g1', participantIds: ['me', 'u3'] }, 'me')).toBe(false);
      return true;
    });
  });
};