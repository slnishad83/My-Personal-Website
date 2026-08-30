'use strict';

/**
 * verified-peers.js — Registered + Verified user gate for chat lists.
 *
 * Enforces that chats, groups, broadcast lists and call history only ever show
 * users who are BOTH registered (have a public `users/{uid}` doc) AND verified
 * (emailVerified or phoneVerified). Unverified/unknown peers are filtered out.
 *
 * Cheap local caching (in-memory + localStorage, TTL capped) keeps Firestore
 * reads low: each peer doc is read at most once per TTL window.
 *
 * Must load SYNCHRONOUSLY before chat-core.js / tab-engine.js (bootstrap chain).
 */
(function () {
  const CACHE_KEY = 'nsl_verified_user_cache_v1';
  const POS_TTL = 24 * 3600 * 1000; // verified cache TTL
  const NEG_TTL = 24 * 3600 * 1000; // unverified cache TTL
  const cache = {};   // uid -> { v: boolean, t: ms }
  const inflight = {}; // uid -> Promise<boolean> (single-flight)

  function getDB() {
    if (window.db) return window.db;
    if (window.App && window.App.db) return window.App.db;
    if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
    return null;
  }

  function loadCache() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      Object.keys(parsed).forEach((k) => { cache[k] = parsed[k]; });
    } catch (_) {}
  }

  function saveCache() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (_) {}
  }

  function isFresh(uid) {
    const c = cache[uid];
    if (!c) return false;
    const ttl = c.v ? POS_TTL : NEG_TTL;
    return (Date.now() - c.t) < ttl;
  }

  function remember(uid, value) {
    cache[uid] = { v: !!value, t: Date.now() };
    saveCache();
  }

  function isRegisteredVerifiedData(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.pendingVerification === true) return false;
    if (data.isActive === false || data.deletedAt || data.deleted) return false;
    if (data.emailVerified === true) return true;
    if (data.phoneVerified === true) return true;
    if (data.isVerified === true) return true;
    return false;
  }

  function fetchUser(uid) {
    if (!uid) return Promise.resolve(false);
    if (inflight[uid]) return inflight[uid];
    inflight[uid] = new Promise((resolve) => {
      const db = getDB();
      if (!db) {
        remember(uid, false);
        delete inflight[uid];
        resolve(false);
        return;
      }
      db.collection('users').doc(uid).get()
        .then((snap) => {
          const ok = !!(snap && snap.exists) && isRegisteredVerifiedData(snap.data ? snap.data() : snap.data);
          remember(uid, ok);
          delete inflight[uid];
          resolve(ok);
        })
        .catch(() => {
          remember(uid, false);
          delete inflight[uid];
          resolve(false);
        });
    });
    return inflight[uid];
  }

  /**
   * Ensures every listed uid has a (cached) verification verdict, then returns
   * the current uid -> boolean map.
   */
  function verifyUsers(list) {
    const ids = Array.isArray(list) ? list : list ? [list] : [];
    const uniques = Array.from(new Set(ids.filter((id) => !!id)));
    const todo = uniques.filter((id) => !isFresh(id));
    if (!todo.length) return Promise.resolve(getVerifiedUserMap());
    return Promise.all(todo.map(fetchUser)).then(() => getVerifiedUserMap());
  }

  function getVerifiedUserMap() {
    const out = {};
    Object.keys(cache).forEach((k) => {
      if (isFresh(k)) out[k] = cache[k].v;
    });
    return out;
  }

  function isVerifiedUser(uid) {
    return !!uid && isFresh(uid) && cache[uid].v === true;
  }

  function isGroupVerified(members, myUid) {
    const list = Array.isArray(members) ? members : [];
    return list.every((id) => !id || id === myUid || isVerifiedUser(id));
  }

  /** Uids that must be verified before a call event may be shown. */
  function callPeerIdsToCheck(call, myUid) {
    if (!call) return [];
    const isGroup =
      !!call.groupId ||
      call.chatType === 'group' ||
      call.kind === 'group-call' ||
      !!(call.participantIds && call.participantIds.length);
    if (isGroup) {
      const ps = call.participantIds || call.participants || [];
      return ps.filter((id) => id && id !== myUid);
    }
    const incoming =
      call.direction === 'incoming' ||
      (!!call.fromUserId && call.fromUserId !== myUid) ||
      (!!call.callerId && call.callerId !== myUid);
    const other = incoming ? (call.fromUserId || call.callerId || '') : (call.toUserId || call.receiverId || '');
    return other ? [other] : [];
  }

  /** True when a call event is allowed to display given the current cache. */
  function callIsEligible(call, myUid) {
    if (!call) return false;
    const ids = callPeerIdsToCheck(call, myUid);
    return ids.length === 0 ? true : ids.every((id) => isVerifiedUser(id));
  }

  // Public API
  window.verifyUsers = verifyUsers;
  window.getVerifiedUserMap = getVerifiedUserMap;
  window.isVerifiedUser = isVerifiedUser;
  window.isUserRegisteredVerifiedData = isRegisteredVerifiedData;
  window.isRegisteredVerifiedData = isRegisteredVerifiedData;
  window.callPeerIdsToCheck = callPeerIdsToCheck;
  window.callIsEligible = callIsEligible;
  window.isGroupOfRegisteredVerified = isGroupVerified;

  loadCache();
})();