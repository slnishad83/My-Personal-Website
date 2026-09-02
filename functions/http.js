const { onRequest, HttpsError } = require('firebase-functions/v2/https');

const _adminModule = require('firebase-admin');
let _adminInitialized = false;
const admin = new Proxy({}, {
  get(_target, prop) {
    if (!_adminInitialized) {
      _adminModule.initializeApp();
      _adminInitialized = true;
    }
    return _adminModule[prop];
  }
});

const METERED_APP_URL = 'teamchatnishad.metered.live';
const TURN_CREDENTIAL_LABEL = 'team-chat-secure-turn';
const CHAT_APP_URL = 'https://chat.nishadsl.com/works/chat/';

const ALLOWED_ORIGINS = ['https://nishadsl.com', 'https://chat.nishadsl.com', 'https://my-team-chat-2255.web.app', 'https://works.my-team-chat-2255.web.app'];
function setCorsHeaders(response, origin) {
  const matched = ALLOWED_ORIGINS.find(o => origin === o);
  const allowed = matched || ALLOWED_ORIGINS[0];
  response.set('Access-Control-Allow-Origin', allowed);
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.set('Access-Control-Max-Age', '3600');
  response.set('X-Content-Type-Options', 'nosniff');
  response.set('X-Frame-Options', 'SAMEORIGIN');
}

async function verifyFirebaseUser(request) {
  const authorization = request.get('Authorization') || '';
  const match = authorization.match(/^Bearer (.+)$/);

  if (!match) {
    throw new Error('Missing Firebase auth token');
  }

  return admin.auth().verifyIdToken(match[1]);
}

// H6: Origin validation helper (exact-match, no prefix matching)
function assertValidOrigin(request) {
  const origin = request.get('Origin') || '';
  if (!origin) throw new Error('Missing origin header');
  if (!ALLOWED_ORIGINS.some(o => origin === o)) {
    throw new Error('Invalid origin');
  }
}

// M9: Simple in-memory rate limiter (per-function, per-user) with cleanup
const _rateLimitBuckets = new Map();
let _httpCleanupStarted = false;
function checkRateLimit(userId, action, maxPerMinute) {
  if (!userId || !action) return;
  if (!_httpCleanupStarted) {
    _httpCleanupStarted = true;
    const t = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of _rateLimitBuckets) {
        if (now - bucket.start > 120000) _rateLimitBuckets.delete(key);
      }
    }, 300000);
    if (t && typeof t.unref === 'function') t.unref();
  }
  const key = `${userId}:${action}`;
  const now = Date.now();
  const windowMs = 60000;
  let bucket = _rateLimitBuckets.get(key);
  if (!bucket || (now - bucket.start) > windowMs) {
    bucket = { start: now, count: 0 };
    _rateLimitBuckets.set(key, bucket);
  }
  bucket.count++;
  if (bucket.count > maxPerMinute) {
    throw new Error(`Rate limit exceeded for ${action}. Try again later.`);
  }
}

async function syncGroupAccessMetadata(groupId) {
  if (!groupId) return;
  const memberSnap = await admin.firestore()
    .collection('groupMembers')
    .where('groupId', '==', groupId)
    .get();
  const memberIds = [];
  const adminIds = [];
  memberSnap.docs.forEach((doc) => {
    const member = doc.data() || {};
    if (!member.userId || memberIds.includes(member.userId)) return;
    memberIds.push(member.userId);
    if (member.role === 'admin' || member.role === 'owner') {
      adminIds.push(member.userId);
    }
  });
  await admin.firestore().collection('groups').doc(groupId).set({
    memberIds,
    adminIds,
    memberCount: memberIds.length,
    accessMetadataUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function assertAdmin(auth) {
  if (!auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const userRecord = await admin.auth().getUser(auth.uid);
  if (!userRecord.customClaims || !userRecord.customClaims.admin) {
    throw new HttpsError('permission-denied', 'Admin access only.');
  }
}

function normalizeIceServers(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.iceServers)) return payload.iceServers;
  if (Array.isArray(payload?.ice_servers)) return payload.ice_servers;
  return [];
}

async function fetchMeteredJson(url, options) {
  const meteredResponse = await fetch(url, options);
  let body = null;

  try {
    body = await meteredResponse.json();
  } catch (error) {
    body = null;
  }

  return {
    ok: meteredResponse.ok,
    status: meteredResponse.status,
    body
  };
}

async function fetchIceServersWithCredentialApiKey(apiKey) {
  const result = await fetchMeteredJson(
    `https://${METERED_APP_URL}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`
  );

  if (!result.ok) {
    return { ok: false, status: result.status, error: result.body?.error || 'Metered TURN request failed' };
  }

  const iceServers = normalizeIceServers(result.body);
  return iceServers.length
    ? { ok: true, iceServers }
    : { ok: false, status: 502, error: 'Metered returned no TURN servers' };
}

async function getCredentialApiKeyFromSecret(secretKey) {
  const listResult = await fetchMeteredJson(
    `https://${METERED_APP_URL}/api/v2/turn/credentials?secretKey=${encodeURIComponent(secretKey)}&all=false&label=${encodeURIComponent(TURN_CREDENTIAL_LABEL)}`
  );

  if (listResult.ok && Array.isArray(listResult.body?.data)) {
    const credential = listResult.body.data.find((item) => item?.apiKey && !item.expired) || listResult.body.data[0];
    if (credential?.apiKey) return { apiKey: credential.apiKey };
  }

  const createResult = await fetchMeteredJson(
    `https://${METERED_APP_URL}/api/v1/turn/credential?secretKey=${encodeURIComponent(secretKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: TURN_CREDENTIAL_LABEL })
    }
  );

  if (!createResult.ok || !createResult.body?.apiKey) {
    return {
      error: createResult.body?.message || createResult.body?.error || listResult.body?.message || listResult.body?.error
    };
  }

  return { apiKey: createResult.body.apiKey };
}

async function getMeteredIceServers(configuredKey) {
  const directResult = await fetchIceServersWithCredentialApiKey(configuredKey);
  if (directResult.ok) return directResult;

  if (![400, 401, 403].includes(directResult.status)) {
    return directResult;
  }

  const credentialResult = await getCredentialApiKeyFromSecret(configuredKey);
  if (!credentialResult?.apiKey) {
    return {
      ok: false,
      status: directResult.status,
      error: credentialResult?.error || 'Metered key is not a valid TURN credential API key or secret key'
    };
  }

  return fetchIceServersWithCredentialApiKey(credentialResult.apiKey);
}

/** Extract a Firebase Storage file path from a download URL. */
function _storagePathFromUrl(url) {
  try {
    // Format: .../o/chat_uploads%2Fuid%2Ffilename?alt=media&...
    const match = url.match(/\/o\/([^?#]+)/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch (_) {
    return null;
  }
}

const ALLOWED_URL_HOSTS = ['nishadsl.com', 'my-team-chat-2255.web.app', 'github.com', 'github.io'];

async function findVerifiedUserByEmail(email, callerUid) {
  const candidates = new Map();
  try {
    const authUser = await admin.auth().getUserByEmail(email);
    candidates.set(authUser.uid, authUser);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
  }

  // Newly registered profiles can become visible in Firestore before an
  // email lookup is immediately consistent in Firebase Authentication.
  const profileMatches = await admin.firestore()
    .collection('users')
    .where('email', '==', email)
    .limit(5)
    .get();
  for (const profileDoc of profileMatches.docs) {
    if (candidates.has(profileDoc.id)) continue;
    try {
      const authUser = await admin.auth().getUser(profileDoc.id);
      if (String(authUser.email || '').trim().toLowerCase() === email) {
        candidates.set(authUser.uid, authUser);
      }
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') throw error;
    }
  }

  for (const authUser of candidates.values()) {
    if (
      authUser.disabled ||
      authUser.emailVerified !== true ||
      authUser.uid === callerUid
    ) {
      continue;
    }
    const profileSnap = await admin.firestore().collection('users').doc(authUser.uid).get();
    const profile = profileSnap.data() || {};
    if (profile.isActive === false) continue;
    return {
      id: authUser.uid,
      uid: authUser.uid,
      email: authUser.email,
      emailVerified: true,
      pendingVerification: false,
      isActive: true,
      displayName: profile.displayName || authUser.displayName || email.split('@')[0],
      avatar: profile.avatar || authUser.photoURL || '',
      onlineStatus: profile.onlineStatus || 'offline'
    };
  }
  return null;
}

exports.lookupVerifiedUserByEmail = onRequest(
  {
    region: 'us-central1',
    invoker: 'public'
  },
  async (request, response) => {
    setCorsHeaders(response, request.get('Origin'));
    response.set('Cache-Control', 'private, no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'GET') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const caller = await verifyFirebaseUser(request);
      assertValidOrigin(request);
      checkRateLimit(caller.uid, 'lookupUser', 10);
      const email = String(request.query.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
        response.status(400).json({ error: 'A valid email address is required' });
        return;
      }
      const authUser = await admin.auth().getUserByEmail(email);
      if (
        authUser.disabled ||
        authUser.emailVerified !== true ||
        authUser.uid === caller.uid
      ) {
        response.status(404).json({ error: 'Verified user not found' });
        return;
      }
      const profileSnap = await admin.firestore().collection('users').doc(authUser.uid).get();
      const profile = profileSnap.data() || {};
      if (profile.isActive === false) {
        response.status(404).json({ error: 'Verified user not found' });
        return;
      }
      response.status(200).json({
        id: authUser.uid,
        uid: authUser.uid,
        email: authUser.email,
        emailVerified: true,
        pendingVerification: false,
        isActive: true,
        displayName: profile.displayName || authUser.displayName || email.split('@')[0],
        avatar: profile.avatar || authUser.photoURL || '',
        onlineStatus: profile.onlineStatus || 'offline'
      });
    } catch (error) {
      response.status(404).json({ error: 'Verified user not found' });
    }
  }
);

exports.lookupVerifiedUserByEmailV2 = onRequest(
  {
    region: 'asia-south1',
    invoker: 'public',
    timeoutSeconds: 30
  },
  async (request, response) => {
    setCorsHeaders(response, request.get('Origin'));
    response.set('Cache-Control', 'private, no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'GET') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const caller = await verifyFirebaseUser(request);
      assertValidOrigin(request);
      checkRateLimit(caller.uid, 'lookupUser', 10);
      const email = String(request.query.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
        response.status(400).json({ error: 'A valid email address is required' });
        return;
      }
      const verifiedUser = await findVerifiedUserByEmail(email, caller.uid);
      if (!verifiedUser) {
        console.info('Verified user lookup completed without a discoverable match');
        response.status(404).json({ error: 'Verified user not found' });
        return;
      }
      console.info('Verified user lookup returned a discoverable match');
      response.status(200).json(verifiedUser);
    } catch (error) {
      console.error('Verified user lookup failed', {
        code: error?.code || 'unknown',
        message: error?.message || 'Unknown error'
      });
      response.status(500).json({ error: 'User lookup is temporarily unavailable' });
    }
  }
);

exports.repairGroupAccessMetadata = onRequest(
  { region: 'us-central1', invoker: 'private' },
  async (request, response) => {
    setCorsHeaders(response, request.get('Origin'));
    response.set('Cache-Control', 'private, no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const auth = await verifyFirebaseUser(request);
      await assertAdmin(auth);
      const migrationRef = admin.firestore().collection('systemMigrations').doc('groupAccessMetadataV1');
      const migration = await migrationRef.get();
      if (migration.exists && migration.data()?.completed === true) {
        response.status(200).json({ repaired: 0, alreadyComplete: true });
        return;
      }
      const groupSnap = await admin.firestore().collection('groups').get();
      for (const groupDoc of groupSnap.docs) {
        await syncGroupAccessMetadata(groupDoc.id);
      }
      await migrationRef.set({
        completed: true,
        repairedGroups: groupSnap.size,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      response.status(200).json({ repaired: groupSnap.size, alreadyComplete: false });
    } catch (error) {
      console.error('[repairGroupAccessMetadata]', error);
      response.status(500).json({ error: 'Internal error' });
    }
  }
);

exports.getTurnCredentials = onRequest(
  {
    region: 'us-central1',
    invoker: 'public',
  },
  async (request, response) => {
    setCorsHeaders(response, request.get('Origin'));
    response.set('Cache-Control', 'private, no-store');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    // H6: Require POST (not GET) for CSRF protection
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const caller = await verifyFirebaseUser(request);
      assertValidOrigin(request);
      checkRateLimit(caller.uid, 'getTurnCredentials', 10);

      const apiKey = (process.env.METERED_API_KEY || '').trim();
      if (!apiKey) {
        response.status(500).json({ error: 'TURN secret is not configured' });
        return;
      }

      const meteredResult = await getMeteredIceServers(apiKey);
      if (!meteredResult.ok) {
        response.status(502).json({ error: meteredResult.error || 'Metered TURN request failed' });
        return;
      }

      response.status(200).json(meteredResult.iceServers);
    } catch (error) {
      if (error.message === 'Invalid origin' || error.message.startsWith('Rate limit')) {
        response.status(403).json({ error: error.message });
      } else {
        response.status(401).json({ error: 'Unauthorized' });
      }
    }
  }
);

exports.migrateCallsToCallLogs = onRequest(
  { region: 'us-central1', invoker: 'private', timeoutSeconds: 120 },
  async (request, response) => {
    setCorsHeaders(response, request.get('Origin'));
    if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
    if (request.method !== 'POST') { response.status(405).json({ error: 'Method not allowed' }); return; }
    try {
      const auth = await verifyFirebaseUser(request);
      await assertAdmin(auth);
      const callsSnap = await admin.firestore().collection('calls').get();
      let created = 0;
      for (const callDoc of callsSnap.docs) {
        const call = callDoc.data();
        const logId = callDoc.id;
        const existingLog = await admin.firestore().collection('callLogs').doc(logId).get();
        if (existingLog.exists) continue;
        await admin.firestore().collection('callLogs').doc(logId).set({
          callerId: call.fromUserId || call.callerId || '',
          calleeId: call.toUserId || call.calleeId || '',
          type: call.type || 'voice',
          duration: call.duration || 0,
          timestamp: call.timestamp || call.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          status: call.status || 'ended',
          participants: [call.fromUserId, call.toUserId].filter(Boolean)
        });
        created++;
      }
      response.status(200).json({ migrated: created, total: callsSnap.size });
    } catch (error) {
      console.error('[migrateCallsToCallLogs]', error);
      response.status(500).json({ error: 'Internal error' });
    }
  }
);

exports.backfillMessageEmails = onRequest(
  { region: 'us-central1', invoker: 'private', timeoutSeconds: 300 },
  async (request, response) => {
    setCorsHeaders(response, request.get('Origin'));
    if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
    if (request.method !== 'POST') { response.status(405).json({ error: 'Method not allowed' }); return; }
    try {
      const auth = await verifyFirebaseUser(request);
      await assertAdmin(auth);
      const msgSnap = await admin.firestore().collection('messages').get();
      let updated = 0;
      const emailCache = {};
      let batch = admin.firestore().batch();
      let opCount = 0;
      for (const msgDoc of msgSnap.docs) {
        const msg = msgDoc.data();
        if (msg.participantEmails && msg.participantEmails.length > 0) continue;
        if (!msg.participants || !msg.participants.length) continue;
        const emails = [];
        for (const uid of msg.participants) {
          if (emailCache[uid]) { emails.push(emailCache[uid]); continue; }
          try {
            const userSnap = await admin.firestore().collection('users').doc(uid).get();
            const email = userSnap.data()?.email || '';
            emailCache[uid] = email;
            if (email) emails.push(email);
          } catch (e) { emailCache[uid] = ''; }
        }
        if (emails.length) {
          batch.update(msgDoc.ref, { participantEmails: emails });
          opCount++;
          updated++;
        }
        if (opCount >= 400) {
          await batch.commit();
          batch = admin.firestore().batch();
          opCount = 0;
        }
      }
      if (opCount > 0) await batch.commit();
      response.status(200).json({ updated, total: msgSnap.size });
    } catch (error) {
      console.error('[backfillMessageEmails]', error);
      response.status(500).json({ error: 'Internal error' });
    }
  }
);

exports.sendNotificationReply = onRequest(
  { region: 'us-central1', cors: ['https://nishadsl.com', 'https://my-team-chat-2255.web.app'] },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) { res.status(401).json({ error: 'Missing auth token' }); return; }

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      // M9: Rate limit â€” 30 replies per minute per user
      checkRateLimit(uid, 'sendNotificationReply', 30);

      const { chatId, chatType, chatUserId, groupId, text } = req.body || {};
      const trimmedText = (text || '').trim();
      if (!trimmedText)  { res.status(400).json({ error: 'Empty reply text' }); return; }
      if (!chatId)       { res.status(400).json({ error: 'Missing chatId' });   return; }

      // H7: Input validation â€” enforce length limit and sanitize
      const MAX_REPLY_LENGTH = 4000;
      if (trimmedText.length > MAX_REPLY_LENGTH) {
        res.status(400).json({ error: `Message too long (max ${MAX_REPLY_LENGTH} characters)` });
        return;
      }
      // H7: Validate chatType
      const validChatTypes = ['direct', 'group', ''];
      if (chatType !== undefined && !validChatTypes.includes(chatType)) {
        res.status(400).json({ error: 'Invalid chatType' });
        return;
      }
      // H7: Sanitize text â€” encode HTML entities to prevent XSS
      const sanitizedText = trimmedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

      // M10: Authorization â€” sender must be a member of the target chat
      const db = admin.firestore();
      if (chatType === 'group' && groupId) {
        const memberSnap = await db.collection('groupMembers')
          .where('groupId', '==', groupId)
          .where('userId', '==', uid)
          .limit(1)
          .get();
        if (memberSnap.empty) {
          res.status(403).json({ error: 'Not a group member' });
          return;
        }
      } else {
        const chatSnap = await db.collection('directChats').doc(chatId).get();
        let isParticipant = false;
        if (chatSnap.exists) {
          const chat = chatSnap.data() || {};
          const participants = chat.participants || chat.members || [];
          if (Array.isArray(participants) && participants.includes(uid)) isParticipant = true;
        }
        if (!isParticipant) {
          res.status(403).json({ error: 'Not a chat participant' });
          return;
        }
      }

      const userSnap = await db.collection('users').doc(uid).get();
      const user = userSnap.data() || {};

      const msgData = {
        text: sanitizedText,
        senderId: uid,
        senderName: user.displayName || user.name || 'Team Chat',
        senderAvatar: user.avatar || user.photoURL || '',
        type: 'text',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
        readBy: { [uid]: admin.firestore.FieldValue.serverTimestamp() },
        deliveredTo: {},
        sentViaNotification: true
      };

      if (chatType === 'group' && groupId) {
        msgData.groupId = groupId;
      } else {
        msgData.directId     = chatId;
        msgData.receiverId   = chatUserId || '';
        msgData.participants = [uid, chatUserId].filter(Boolean);
        msgData.participantEmails = [user.email || ''].filter(Boolean);
      }

      const ref = await admin.firestore().collection('messages').add(msgData);
      res.status(200).json({ ok: true, messageId: ref.id });
    } catch (err) {
      console.error('sendNotificationReply error:', err);
      res.status(500).json({ error: 'Internal error' });
    }
  }
);

exports.generateUrlPreview = onRequest({ region: 'us-central1', timeoutSeconds: 15 }, async (req, res) => {
  setCorsHeaders(res, req.get('Origin'));
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  // H6: Require POST for CSRF protection (no URL in query string)
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Require authentication
  let caller;
  try {
    caller = await verifyFirebaseUser(req);
    assertValidOrigin(req);
    checkRateLimit(caller.uid, 'generateUrlPreview', 20);
  } catch (_) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  const url = (req.body && req.body.url) || '';
  if (!url || !/^https?:\/\//.test(url)) {
    res.status(400).json({ error: 'Missing or invalid url parameter' }); return;
  }

  // Validate URL â€” block private IPs and localhost
  const { URL } = require('url');
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch (_) {
    res.status(400).json({ error: 'Invalid URL' }); return;
  }
  const hostname = parsedUrl.hostname.toLowerCase();
  if (/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|metadata\.google|169\.254\.)/.test(hostname)) {
    res.status(400).json({ error: 'URL not allowed' }); return;
  }
  if (!ALLOWED_URL_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))) {
    res.status(403).json({ error: 'Domain not allowed' }); return;
  }

  const https = require('https');
  const http  = require('http');

  function getHtml(rawUrl, redirects) {
    redirects = redirects || 0;
    if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
    return new Promise((resolve, reject) => {
      const parsed = new URL(rawUrl);
      const mod = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search, method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChatBot/1.0)', Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 7000
      };
      const request = mod.request(options, response => {
        if ([301,302,303,307,308].includes(response.statusCode)) {
          const loc = response.headers.location;
          if (!loc) { reject(new Error('Redirect without location')); return; }
          const next = loc.startsWith('http') ? loc : parsed.origin + loc;
          // Re-validate redirect target against IP blocklist and allowlist
          try {
            const nextParsed = new URL(next);
            const nextHost = nextParsed.hostname.toLowerCase();
            if (/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|metadata\.google|169\.254\.|::1|\[::)/.test(nextHost)) {
              reject(new Error('Redirect to private IP blocked')); return;
            }
            if (!ALLOWED_URL_HOSTS.some(h => nextHost === h || nextHost.endsWith('.' + h))) {
              reject(new Error('Redirect to disallowed domain')); return;
            }
          } catch (_) { reject(new Error('Invalid redirect URL')); return; }
          resolve(getHtml(next, redirects + 1));
          return;
        }
        const ct = response.headers['content-type'] || '';
        if (!ct.includes('text/html') && !ct.includes('text/plain')) {
          reject(new Error('Not HTML')); return;
        }
        let data = ''; let received = 0;
        response.on('data', chunk => { received += chunk.length; if (received < 500000) data += chunk; });
        response.on('end', () => resolve(data));
      });
      request.on('error', reject);
      request.on('timeout', () => { request.destroy(); reject(new Error('Timeout')); });
      request.end();
    });
  }

  function extractMeta(html) {
    const m = (prop, name) => {
      const re1 = new RegExp('<meta[^>]+property=["\'\']' + prop + '["\'\'][^>]+content=["\'\']([^\'\'"]+)["\'\']', 'i');
      const re2 = new RegExp('<meta[^>]+content=["\'\']([^\'\'"]+)["\'\'][^>]+property=["\'\']' + prop + '["\'\']', 'i');
      const rn1 = new RegExp('<meta[^>]+name=["\'\']' + name + '["\'\'][^>]+content=["\'\']([^\'\'"]+)["\'\']', 'i');
      const rn2 = new RegExp('<meta[^>]+content=["\'\']([^\'\'"]+)["\'\'][^>]+name=["\'\']' + name + '["\'\']', 'i');
      for (const r of [re1, re2, rn1, rn2]) { const x = html.match(r); if (x) return x[1].trim(); }
      return '';
    };
    const titleM  = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const parsed2 = new URL(url);
    return {
      title      : m('og:title','og:title')       || (titleM ? titleM[1].trim() : ''),
      description: m('og:description','description') || '',
      image      : m('og:image','og:image')         || '',
      domain     : parsed2.hostname.replace(/^www\./,'')
    };
  }

  try {
    const html = await getHtml(url);
    const data = extractMeta(html);
    if (!data.title && !data.description && !data.image) {
      res.status(422).json({ error: 'No preview data found' }); return;
    }
    res.json(data);
  } catch (e) {
    console.error('[generateUrlPreview] error:', e.message);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   YOUTUBE MUSIC SEARCH + STREAM (innertube API, no API key)
   Powers the in-chat Music Library search/playback.
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const _YT_BASE = 'https://www.youtube.com';

function _youtubeParseDuration(text) {
  if (!text) return 0;
  const clean = String(text).replace(/[^0-9:]/g, '');
  const parts = clean.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

async function _youtubeSearch(query) {
  const context = {
    client: { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30, hl: 'en', gl: 'US' },
  };
  const url = `${_YT_BASE}/youtubei/v1/search?prettyPrint=false`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      'X-YouTube-Client-Name': '3',
      'X-YouTube-Client-Version': '19.09.37',
    },
    body: JSON.stringify({ query, context }),
  });
  if (!response.ok) throw new Error(`YouTube search failed: ${response.status}`);

  const data = await response.json();
  const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
  const results = [];

  for (const section of contents) {
    const items = section.itemSectionRenderer?.contents || [];
    for (const item of items) {
      const video = item.videoRenderer;
      if (!video || !video.videoId) continue;

      const thumb = video.thumbnail?.thumbnails;
      const bestThumb = thumb?.[thumb.length - 1] || thumb?.[0] || {};

      results.push({
        id: 'yt_' + video.videoId,
        videoId: video.videoId,
        title: video.title?.runs?.map(r => r.text).join('') || 'Untitled',
        artist: video.ownerText?.runs?.[0]?.text || video.longBylineText?.runs?.[0]?.text || 'Unknown',
        duration: _youtubeParseDuration(video.lengthText?.simpleText || video.lengthText?.accessibility?.accessibilityData?.label || ''),
        thumbnail: bestThumb.url || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`,
        viewCount: parseInt((video.viewCountText?.simpleText || '0').replace(/[^0-9]/g, '')) || 0,
        publishedText: video.publishedTimeText?.simpleText || '',
        source: 'youtube',
      });

      if (results.length >= 30) break;
    }
    if (results.length >= 30) break;
  }

  return results;
}

const _YT_PLAYER_CLIENTS = [
  { name: 'ANDROID_VR', clientName: 'ANDROID_VR', clientVersion: '1.60.19', deviceMake: 'Oculus', deviceModel: 'Quest 3', androidSdkVersion: 32, ua: 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12; en_US) gzip', clientNameHeader: '28' },
  { name: 'ANDROID', clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30, ua: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip', clientNameHeader: '3' },
  { name: 'IOS', clientName: 'IOS', clientVersion: '19.09.3', deviceModel: 'iPhone14,3', userAgent: 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)' },
  { name: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0' },
];

function _decodeSignatureCipher(sc) {
  try {
    const params = Object.fromEntries(sc.split('&').map(p => {
      const [k, v] = p.split('=');
      return [k, decodeURIComponent(v)];
    }));
    if (!params.s || !params.url) return null;

    const sig = params.s;
    const sigArray = sig.split('');
    const actions = [];
    let i = 0;
    while (i < sigArray.length) {
      const ch = sigArray[i];
      if (ch === 'R') { actions.push({ type: 'r', len: parseInt(sigArray[i + 1], 16) }); i += 2; }
      else if (ch === 'S') { actions.push({ type: 's', len: parseInt(sigArray[i + 1], 16) }); i += 2; }
      else if (ch === 'W') { actions.push({ type: 'w', pos: parseInt(sigArray[i + 1], 16) }); i += 2; }
      else break;
    }

    if (actions.length === 0) return null;

    let arr = sig.split('');
    for (const action of actions) {
      if (action.type === 'r') arr.reverse();
      else if (action.type === 's') { const sp = arr.splice(0, action.len); arr.push(...sp); }
      else if (action.type === 'w') { const el = arr.splice(action.pos, 1)[0]; arr.unshift(el); }
    }

    return params.url + '&sig=' + encodeURIComponent(arr.join(''));
  } catch (_) {
    return null;
  }
}

async function _getYouTubeStreamUrl(videoId) {
  for (const client of _YT_PLAYER_CLIENTS) {
    try {
      const context = { client: { clientName: client.clientName, clientVersion: client.clientVersion, hl: 'en', gl: 'US' } };
      if (client.androidSdkVersion) context.client.androidSdkVersion = client.androidSdkVersion;
      if (client.deviceModel) context.client.deviceModel = client.deviceModel;
      if (client.deviceMake) context.client.deviceMake = client.deviceMake;
      if (client.ua) context.client.userAgent = client.ua;

      const url = `${_YT_BASE}/youtubei/v1/player?prettyPrint=false`;
      const headers = { 'Content-Type': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' };
      if (client.ua) headers['User-Agent'] = client.ua;
      if (client.userAgent) headers['User-Agent'] = client.userAgent;
      if (client.clientNameHeader) headers['X-YouTube-Client-Name'] = client.clientNameHeader;
      else headers['X-YouTube-Client-Name'] = client.clientName;
      headers['X-YouTube-Client-Version'] = client.clientVersion;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ videoId, context, contentCheckOk: true, racyCheckOk: true }),
      });
      if (!response.ok) continue;
      const data = await response.json();

      const status = data.playabilityStatus?.status;
      if (status === 'UNPLAYABLE' || status === 'LOGIN_REQUIRED' || status === 'ERROR') continue;

      const formats = data.streamingData?.adaptiveFormats || data.streamingData?.formats || [];
      const audioFormats = formats
        .filter(f => f && f.mimeType && f.mimeType.startsWith('audio/'))
        .sort((a, b) => (b.audioBitrate || b.bitrate || 0) - (a.audioBitrate || a.bitrate || 0));

      for (const f of audioFormats) {
        if (f.url) return f.url;
      }
      for (const f of audioFormats) {
        if (f.signatureCipher) {
          const decoded = _decodeSignatureCipher(f.signatureCipher);
          if (decoded) return decoded;
        }
      }
    } catch (e) {
      console.warn(`[YouTube] Client ${client.name} failed:`, e.message);
    }
  }
  return null;
}

exports.youtubeSearch = onRequest({ region: 'us-central1', timeoutSeconds: 30, memory: '256MiB' }, async (req, res) => {
  setCorsHeaders(res, req.get('Origin') || req.get('Referer') || '');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  let caller;
  try {
    caller = await verifyFirebaseUser(req);
    checkRateLimit(caller.uid, 'youtubeSearch', 60);
  } catch (err) {
    console.error('youtubeSearch auth failure:', (err && err.code) || (err && err.message) || String(err));
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  const { q, videoId, lang } = req.query || {};
  const body = req.method === 'POST' ? req.body || {} : {};

  try {
    if (videoId) {
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        res.status(400).json({ ok: false, error: 'Invalid videoId format' });
        return;
      }
      const streamUrl = await _getYouTubeStreamUrl(videoId);
      if (streamUrl) {
        res.json({ ok: true, url: streamUrl });
      } else {
        res.json({ ok: false, error: 'Could not extract audio stream' });
      }
      return;
    }

    const query = (q || body.q || '').trim();
    if (!query) { res.json({ ok: true, results: [] }); return; }

    const searchQuery = lang ? `${query} ${lang}` : query;

    // YouTube only. JioSaavn (a paid subscription service) is intentionally
    // NOT scraped â€” the music player streams exclusively from free, legal
    // sources (YouTube search/stream, Jamendo, ccMixter, Internet Archive).
    const searchResult = await _youtubeSearch(searchQuery);
    const results = ((searchResult && Array.isArray(searchResult)) ? searchResult : []).slice(0, 20);

    res.json({ ok: true, results });
  } catch (e) {
    console.error('[youtubeSearch] Error:', e.message);
    res.status(500).json({ ok: false, error: 'Search failed' });
  }
});
