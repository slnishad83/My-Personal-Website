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

      // M9: Rate limit — 30 replies per minute per user
      checkRateLimit(uid, 'sendNotificationReply', 30);

      const { chatId, chatType, chatUserId, groupId, text } = req.body || {};
      const trimmedText = (text || '').trim();
      if (!trimmedText)  { res.status(400).json({ error: 'Empty reply text' }); return; }
      if (!chatId)       { res.status(400).json({ error: 'Missing chatId' });   return; }

      // H7: Input validation — enforce length limit and sanitize
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
      // H7: Sanitize text — encode HTML entities to prevent XSS
      const sanitizedText = trimmedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

      const userSnap = await admin.firestore().collection('users').doc(uid).get();
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

  // Validate URL — block private IPs and localhost
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

/* ─────────────────────────────────────────────────────────────
   YOUTUBE MUSIC SEARCH + STREAM (innertube API, no API key)
   Powers the in-chat Music Library search/playback.
   ───────────────────────────────────────────────────────────── */
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

// ---------- JioSaavn (free full Indian film audio; works from datacenter IPs, no bot-guard) ----------

const SAAVN_API = 'https://www.jiosaavn.com/api.php';
const SAAVN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.jiosaavn.com/',
};

async function _saavnFetch(call, params) {
  const qs = new URLSearchParams({ __call: call, _format: 'json', _marker: '0', cc: 'in', ...params });
  const response = await fetch(`${SAAVN_API}?${qs.toString()}`, { headers: SAAVN_HEADERS, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Saavn ${call} HTTP ${response.status}`);
  return response.json();
}

// DES-ECB (key 38346591) pure-JS decrypt — works on any Node runtime (OpenSSL 3 disables native DES).
const _DES_IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
const _DES_FP = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
const _DES_E = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
const _DES_P = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
const _DES_PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const _DES_PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
const _DES_SHIFTS = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
const _DES_S = [
[14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
[15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
[10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
[7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14],
[2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
[12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
[4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
[13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]
];

function _desPermute(bits, table) { return table.map(i => bits[i - 1]); }
function _desRotateLeft(bits, n) { return bits.slice(n).concat(bits.slice(0, n)); }
function _desSubkeys(keyBits) {
  const permuted = _desPermute(keyBits, _DES_PC1);
  let C = permuted.slice(0, 28);
  let D = permuted.slice(28);
  const subkeys = [];
  for (let i = 0; i < 16; i++) {
    C = _desRotateLeft(C, _DES_SHIFTS[i]);
    D = _desRotateLeft(D, _DES_SHIFTS[i]);
    subkeys.push(_desPermute(C.concat(D), _DES_PC2));
  }
  return subkeys;
}
function _desBlock(input, subkeys, decrypt) {
  let bits = _desPermute(input, _DES_IP);
  let L = bits.slice(0, 32);
  let R = bits.slice(32);
  const keys = decrypt ? subkeys.slice().reverse() : subkeys;
  for (let i = 0; i < 16; i++) {
    const xored = _desPermute(R, _DES_E).map((b, j) => b ^ keys[i][j]);
    let sOut = [];
    for (let k = 0; k < 8; k++) {
      const chunk = xored.slice(k * 6, k * 6 + 6);
      const row = (chunk[0] << 1) | chunk[5];
      const col = (chunk[1] << 3) | (chunk[2] << 2) | (chunk[3] << 1) | chunk[4];
      let v = _DES_S[k][row * 16 + col];
      for (let b = 3; b >= 0; b--) sOut.push((v >> b) & 1);
    }
    const fOut = _desPermute(sOut, _DES_P).map((b, j) => L[j] ^ b);
    L = R;
    R = fOut;
  }
  return _desPermute(R.concat(L), _DES_FP);
}
function _desDecryptEcb(cipherB64, keyStr) {
  try {
    const buf = Buffer.from(cipherB64, 'base64');
    const keyBits = [...keyStr].flatMap(ch => {
      let c = ch.charCodeAt(0);
      const bits = [];
      for (let b = 7; b >= 0; b--) bits.push((c >> b) & 1);
      return bits;
    });
    const subkeys = _desSubkeys(keyBits);
    let out = '';
    for (let o = 0; o < buf.length; o += 8) {
      const block = buf.slice(o, o + 8);
      const bits = [];
      for (const b of block) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
      const dec = _desBlock(bits, subkeys, true);
      for (let i = 0; i < dec.length; i += 8) {
        let v = 0;
        for (let j = 0; j < 8; j++) v = (v << 1) | dec[i + j];
        out += String.fromCharCode(v);
      }
    }
    return out.replace(/[\x00-\x08]/g, '');
  } catch (_) {
    return null;
  }
}

async function _saavnSearch(query, limit) {
  const data = await _saavnFetch('autocomplete.get', { query, limit: String(limit || 20) });
  const items = (data && data.songs && Array.isArray(data.songs.data)) ? data.songs.data : [];
  const results = [];
  const seen = new Set();
  for (const s of items) {
    const id = s.id || s.song_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const mi = s.more_info || {};
    results.push({
      id: 'saavn_' + id,
      saavnId: id,
      title: s.title || 'Untitled',
      artist: mi.primary_artists || mi.singers || s.subtitle || 'Unknown',
      album: s.album || '',
      language: mi.language || '',
      duration: parseInt(mi.duration || 0, 10) || 0,
      thumbnail: (s.image || '').replace('-50x50', '-500x500'),
      audioUrl: null,
      source: 'saavn',
    });
    if (results.length >= (limit || 20)) break;
  }
  return results;
}

async function _saavnFillStreams(tracks) {
  const ids = tracks.filter(t => t.saavnId).map(t => t.saavnId);
  if (!ids.length) return;
  const data = await _saavnFetch('song.getDetails', { pids: ids.join(',') });
  const songs = Array.isArray(data)
    ? data
    : (data && Array.isArray(data.songs) ? data.songs : Object.values(data || {}));
  for (const s of songs) {
    const track = tracks.find(t => t.saavnId === s.id);
    if (!track) continue;
    if (s.duration) track.duration = parseInt(s.duration, 10) || track.duration;
    if (s.more_info && s.more_info.duration) track.duration = parseInt(s.more_info.duration, 10) || track.duration;
    const encrypted = s.encrypted_media_url || s.media_url;
    if (encrypted) {
      const decrypted = _desDecryptEcb(encrypted, '38346591');
      if (decrypted && decrypted.startsWith('http')) {
        track.audioUrl = decrypted.replace(/_96\.mp4/, '_320.mp4').replace(/\x04+$/, '');
      }
    }
  }
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

    const [saavn, youtube] = await Promise.allSettled([
      _saavnSearch(searchQuery, 20),
      _youtubeSearch(searchQuery),
    ]);

    const saavnTracks = (saavn.status === 'fulfilled' && Array.isArray(saavn.value)) ? saavn.value : [];
    try {
      await _saavnFillStreams(saavnTracks);
    } catch (e) {
      console.warn('[Saavn] stream fill failed:', e.message);
    }
    const youtubeTracks = ((youtube.status === 'fulfilled' && Array.isArray(youtube.value)) ? youtube.value : []).slice(0, 10);

    res.json({ ok: true, results: [...saavnTracks, ...youtubeTracks] });
  } catch (e) {
    console.error('[youtubeSearch] Error:', e.message);
    res.status(500).json({ ok: false, error: 'Search failed' });
  }
});
