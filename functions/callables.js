const { onCall, HttpsError } = require('firebase-functions/v2/https');

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

const CHAT_APP_URL = 'https://chat.nishadsl.com/works/chat/';

// Simple in-memory rate limiter per user (5 requests/min, 30/hour for AI functions)
const _aiRateBuckets = new Map();
let _aiCleanupStarted = false;
function checkAiRateLimit(uid) {
  if (!_aiCleanupStarted) {
    _aiCleanupStarted = true;
    const t = setInterval(() => {
      const now = Date.now();
      for (const [uid, bucket] of _aiRateBuckets) {
        bucket.minute = bucket.minute.filter(t => now - t < 60000);
        bucket.hour = bucket.hour.filter(t => now - t < 3600000);
        if (bucket.minute.length === 0 && bucket.hour.length === 0) _aiRateBuckets.delete(uid);
      }
    }, 300000);
    if (t && typeof t.unref === 'function') t.unref();
  }
  const now = Date.now();
  const bucket = _aiRateBuckets.get(uid) || { minute: [], hour: [] };
  bucket.minute = bucket.minute.filter(t => now - t < 60000);
  bucket.hour = bucket.hour.filter(t => now - t < 3600000);
  if (bucket.minute.length >= 5 || bucket.hour.length >= 30) {
    return false;
  }
  bucket.minute.push(now);
  bucket.hour.push(now);
  _aiRateBuckets.set(uid, bucket);
  return true;
}

exports.aiChatBot = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to use the AI assistant.');
    }

    if (!checkAiRateLimit(request.auth.uid)) {
      throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    }

    const { prompt, chatId, chatType, senderName } = request.data || {};
    if (!prompt || !chatId || !chatType) {
      throw new HttpsError('invalid-argument', 'Missing prompt, chatId, or chatType.');
    }
    if (typeof prompt !== 'string' || prompt.length > 10000) {
      throw new HttpsError('invalid-argument', 'Prompt must be a string of 10,000 characters or fewer.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'GEMINI_API_KEY secret is not configured.');
    }

    // Verify user has access to this chat
    if (chatType === 'direct') {
      const chatSnap = await admin.firestore().collection('directChats').doc(chatId).get();
      if (!chatSnap.exists || !(chatSnap.data()?.participants || []).includes(request.auth.uid)) {
        throw new HttpsError('permission-denied', 'You do not have access to this chat.');
      }
    } else if (chatType === 'group') {
      const groupSnap = await admin.firestore().collection('groups').doc(chatId).get();
      if (!groupSnap.exists || !(groupSnap.data()?.memberIds || []).includes(request.auth.uid)) {
        throw new HttpsError('permission-denied', 'You are not a member of this group.');
      }
    }

    // Fetch recent chat messages for context (last 10)
    let contextMessages = '';
    try {
      const snap = await admin.firestore()
        .collection('messages')
        .where(chatType === 'direct' ? 'directId' : 'groupId', '==', chatId)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();
      const recent = snap.docs.reverse().map(d => {
        const data = d.data();
        return `${data.senderName || 'User'}: ${data.text || '[media]'}`;
      }).join('\n');
      if (recent) contextMessages = `\nRecent conversation:\n${recent}\n`;
    } catch (_) {}

    const systemPrompt = `You are a helpful AI assistant inside a team chat app called Team Chat. Be concise, friendly, and helpful.${contextMessages}`;

    let botText;
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser asks: ${prompt}` }] }
            ],
            generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
          })
        }
      );

      if (!geminiRes.ok) {
        const errBody = await geminiRes.text();
        console.error('[aiChatBot] Gemini error:', errBody);
        throw new HttpsError('internal', 'AI service temporarily unavailable.');
      }

      const geminiData = await geminiRes.json();
      botText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
        || 'Sorry, I could not generate a response.';
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error('[aiChatBot] Gemini fetch error:', err);
      throw new HttpsError('internal', 'AI service temporarily unavailable.');
    }

    // Post the AI reply as a chat message
    const messageData = {
      text: botText,
      senderId: 'ai-bot',
      senderName: 'AI Assistant',
      isAiBot: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      readBy: { [request.auth.uid]: admin.firestore.FieldValue.serverTimestamp() },
    };
    if (chatType === 'direct') messageData.directId = chatId;
    else if (chatType === 'group') messageData.groupId = chatId;

    await admin.firestore().collection('messages').add(messageData);

    return { ok: true };
  }
);

exports.summarizeThread = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { messageId } = request.data || {};
    if (!messageId) throw new HttpsError('invalid-argument', 'Missing messageId.');

    // Verify user has access to the parent message's chat
    const msgSnap = await admin.firestore().collection('messages').doc(messageId).get();
    if (!msgSnap.exists) throw new HttpsError('not-found', 'Message not found.');
    const msgData = msgSnap.data();
    const uid = request.auth.uid;
    let hasAccess = msgData.senderId === uid;
    if (!hasAccess && msgData.directId) {
      const chatSnap = await admin.firestore().collection('directChats').doc(msgData.directId).get();
      hasAccess = chatSnap.exists && (chatSnap.data()?.participants || []).includes(uid);
    }
    if (!hasAccess && msgData.groupId) {
      const groupSnap = await admin.firestore().collection('groups').doc(msgData.groupId).get();
      hasAccess = groupSnap.exists && (groupSnap.data()?.memberIds || []).includes(uid);
    }
    if (!hasAccess) throw new HttpsError('permission-denied', 'You do not have access to this message.');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured.');

    const snap = await admin.firestore()
      .collection('messages').doc(messageId)
      .collection('threadReplies')
      .orderBy('timestamp', 'asc')
      .limit(100)
      .get();

    if (snap.empty) throw new HttpsError('not-found', 'No replies to summarize yet.');

    const replies = snap.docs.map(d => {
      const data = d.data();
      return `${data.senderName || 'User'}: ${data.text || '[media]'}`;
    }).join('\n');

    const prompt = `Summarize the following team chat thread into 3-5 concise bullet points. Each bullet should capture a key point, decision, or action item. Do not use markdown formatting — plain text only, one bullet per line starting with a dash.\n\nThread:\n${replies}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 400, temperature: 0.4 }
        })
      }
    );
    if (!geminiRes.ok) {
      console.error('[summarizeThread] Gemini error:', await geminiRes.text());
      throw new HttpsError('internal', 'AI service temporarily unavailable.');
    }
    const geminiData = await geminiRes.json();
    const summary = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate summary.';
    return { summary };
  }
);

exports.explainMessage = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { text } = request.data || {};
    if (!text) throw new HttpsError('invalid-argument', 'Missing message text.');
    if (typeof text !== 'string' || text.length > 5000) {
      throw new HttpsError('invalid-argument', 'Message text must be 5,000 characters or fewer.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured.');

    const prompt = `A user received this chat message and wants it explained clearly and briefly (2-4 sentences). Explain what it means, any implied context, tone, or intent. Be concise and friendly.\n\nMessage: "${text}"`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.5 }
        })
      }
    );
    if (!geminiRes.ok) {
      console.error('[explainMessage] Gemini error:', await geminiRes.text());
      throw new HttpsError('internal', 'AI service temporarily unavailable.');
    }
    const geminiData = await geminiRes.json();
    const explanation = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not explain this message.';
    return { explanation };
  }
);

exports.transcribeVoiceMessage = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { messageId, audioUrl } = request.data || {};
    if (!audioUrl || typeof audioUrl !== 'string') throw new HttpsError('invalid-argument', 'Missing audioUrl.');
    const audioUrlObj = new URL(audioUrl);
    const audioHost = audioUrlObj.hostname.toLowerCase();
    if (!audioHost.endsWith('firebasestorage.googleapis.com') && !audioHost.endsWith('cloudinary.com')) {
      throw new HttpsError('invalid-argument', 'Audio URL must be from Firebase Storage or Cloudinary.');
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not set.');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const audioRes = await fetch(audioUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!audioRes.ok) throw new Error('Could not fetch audio file.');
      const contentLength = Number(audioRes.headers.get('content-length') || 0);
      if (contentLength > 25 * 1024 * 1024) throw new Error('Audio file too large (max 25MB).');
      const buffer = await audioRes.arrayBuffer();
      if (buffer.byteLength > 25 * 1024 * 1024) throw new Error('Audio file too large (max 25MB).');
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = audioRes.headers.get('content-type') || 'audio/webm';
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: 'Please transcribe this voice message accurately. Return only the transcribed text, nothing else. If you cannot transcribe, say "Could not transcribe."' }
              ]
            }],
            generationConfig: { maxOutputTokens: 500, temperature: 0 }
          })
        }
      );
      if (!gemRes.ok) {
        console.error('[transcribeVoiceMessage] Gemini error:', gemRes.status);
        throw new Error('Transcription service error');
      }
      const gemData = await gemRes.json();
      const text = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not transcribe.';
      if (messageId && typeof messageId === 'string') {
        await admin.firestore().collection('messages').doc(messageId).update({ transcription: text.trim() }).catch(() => {});
      }
      return { text: text.trim() };
    } catch (err) {
      console.error('[transcribeVoiceMessage]', err.message);
      throw new HttpsError('internal', 'Transcription failed. Please try again.');
    }
  }
);

exports.catchMeUp = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { chatId, chatType } = request.data || {};
    if (!chatId || !chatType) throw new HttpsError('invalid-argument', 'Missing chatId or chatType.');
    // Verify user has access to this chat
    if (chatType === 'group') {
      const groupSnap = await admin.firestore().collection('groups').doc(chatId).get();
      if (!groupSnap.exists || !(groupSnap.data()?.memberIds || []).includes(request.auth.uid)) {
        throw new HttpsError('permission-denied', 'You are not a member of this group.');
      }
    } else {
      const chatSnap = await admin.firestore().collection('directChats').doc(chatId).get();
      if (!chatSnap.exists || !(chatSnap.data()?.participants || []).includes(request.auth.uid)) {
        throw new HttpsError('permission-denied', 'You do not have access to this chat.');
      }
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not set.');
    try {
      const field = chatType === 'group' ? 'groupId' : 'directId';
      const snap = await admin.firestore().collection('messages')
        .where(field, '==', chatId)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
      if (snap.empty) return { summary: 'No messages yet in this chat.' };
      const messages = snap.docs.reverse().map(d => {
        const data = d.data();
        return `${data.senderName || 'Someone'}: ${data.text || (data.attachment ? '[media]' : '')}`;
      }).filter(Boolean).join('\n');
      const prompt = `These are the last messages in a team chat. Give a short, friendly summary (3-5 bullet points) of what was discussed, any decisions made, and anything that needs attention. Use plain text with dash bullets. Be brief and conversational.\n\nMessages:\n${messages}`;
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 400, temperature: 0.5 }
          })
        }
      );
      if (!gemRes.ok) {
        console.error('[catchMeUp] Gemini API error:', gemRes.status);
        return { summary: 'Could not generate summary.' };
      }
      const gemData = await gemRes.json();
      const summary = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate summary.';
      return { summary };
    } catch (err) {
      throw new HttpsError('internal', err.message);
    }
  }
);

exports.detectCalendarEvent = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { text } = request.data || {};
    if (!text) throw new HttpsError('invalid-argument', 'Missing text.');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not set.');
    const today = new Date().toISOString().split('T')[0];
    const prompt = `Today is ${today}. Analyze this message and extract any event or appointment details.\nMessage: "${text}"\n\nReturn ONLY valid JSON like: {"hasEvent":true,"title":"Dinner","date":"2026-06-25","time":"19:00","note":"at Taj Hotel"}\nIf no event, return: {"hasEvent":false}`;
    try {
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 100, temperature: 0 }
          })
        }
      );
      if (!gemRes.ok) {
        console.error('[detectCalendarEvent] Gemini API error:', gemRes.status);
        return { hasEvent: false };
      }
      const gemData = await gemRes.json();
      const raw = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '{"hasEvent":false}';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { hasEvent: false };
      return result;
    } catch (_) {
      return { hasEvent: false };
    }
  }
);

exports.muteChatNotification = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const { chatId, duration } = request.data || {};
    if (!chatId) throw new HttpsError('invalid-argument', 'Missing chatId.');

    const uid = request.auth.uid;
    const docId = `${uid}_${chatId}`;

    if (duration === 0 || duration === 'off') {
      // Unmute: delete the mute document and mutedChats entry
      await admin.firestore().collection('chatNotifSettings').doc(docId).delete().catch(() => {});
      const muteDocs = await admin.firestore().collection('mutedChats')
        .where('userId', '==', uid).where('chatId', '==', chatId).get();
      for (const doc of muteDocs.docs) {
        await doc.ref.delete();
      }
      return { muted: false };
    }

    const durationNum = Number(duration);
    if (!Number.isFinite(durationNum) || durationNum < -1) {
      throw new HttpsError('invalid-argument', 'duration must be a non-negative number (ms) or -1 for forever.');
    }

    // Mute for a duration (in milliseconds)
    const muteUntil = durationNum === -1
      ? null // Mute forever
      : admin.firestore.Timestamp.fromMillis(Date.now() + durationNum);

    await admin.firestore().collection('mutedChats').add({
      userId: uid,
      chatId,
      muteUntil,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { muted: true, muteUntil: muteUntil?.toMillis?.() || null };
  }
);

exports.setDndSchedule = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const { enabled, from, to, tzOffset } = request.data || {};
    if (typeof from === 'number' && (from < 0 || from > 1440)) {
      throw new HttpsError('invalid-argument', 'from must be 0–1440 minutes.');
    }
    if (typeof to === 'number' && (to < 0 || to > 1440)) {
      throw new HttpsError('invalid-argument', 'to must be 0–1440 minutes.');
    }

    await admin.firestore().collection('users').doc(request.auth.uid).set({
      dndSettings: {
        enabled: Boolean(enabled),
        from: from || null,
        to: to || null,
        tzOffset: typeof tzOffset === 'number' ? tzOffset : 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });

    return { ok: true };
  }
);

const _chatLockRateBuckets = new Map();
let _chatLockCleanupStarted = false;
function checkChatLockRateLimit(uid) {
  if (!_chatLockCleanupStarted) {
    _chatLockCleanupStarted = true;
    const t = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of _chatLockRateBuckets) {
        bucket.t = bucket.t.filter(ts => now - ts < 60000);
        if (bucket.t.length === 0) _chatLockRateBuckets.delete(key);
      }
    }, 300000);
    if (t && typeof t.unref === 'function') t.unref();
  }
  const now = Date.now();
  const bucket = _chatLockRateBuckets.get(uid) || { t: [] };
  bucket.t = bucket.t.filter(ts => now - ts < 60000);
  if (bucket.t.length >= 10) return false;
  bucket.t.push(now);
  _chatLockRateBuckets.set(uid, bucket);
  return true;
}

exports.toggleChatLock = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkChatLockRateLimit(request.auth.uid)) {
      throw new HttpsError('resource-exhausted', 'Too many lock/unlock requests. Wait a moment.');
    }
    const { chatId, locked } = request.data || {};
    if (!chatId || typeof chatId !== 'string') {
      throw new HttpsError('invalid-argument', 'chatId is required.');
    }
    if (typeof locked !== 'boolean') {
      throw new HttpsError('invalid-argument', 'locked must be a boolean.');
    }
    const uid = request.auth.uid;
    const userRef = admin.firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();
    const currentLocks = (userDoc.data() && userDoc.data().lockedChats) || {};
    if (locked) {
      currentLocks[chatId] = {
        locked: true,
        method: 'biometric_or_pin',
        lockedAt: admin.firestore.FieldValue.serverTimestamp()
      };
    } else {
      delete currentLocks[chatId];
    }
    await userRef.set({ lockedChats: currentLocks }, { merge: true });
    return { ok: true, lockedChats: currentLocks };
  }
);

/* ══════════════════════════════════════════════════════════════
   Missing callables wired by the web client (gap-fix)
   ══════════════════════════════════════════════════════════════ */

exports.sendPushNotification = onCall(
  { region: 'asia-south1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const { token, title, body, data } = request.data || {};
    if (!token || typeof token !== 'string') {
      throw new HttpsError('invalid-argument', 'token is required.');
    }
    const message = {
      token,
      notification: {
        title: String(title || 'NSL Chat'),
        body: String(body || ''),
      },
      data: {
        ...(data || {}),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
    };
    try {
      await admin.messaging().send(message);
      return { ok: true };
    } catch (err) {
      if (err && (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token')) {
        // Clean up stale token
        const users = await admin.firestore().collection('users')
          .where('fcmToken', '==', token)
          .limit(1)
          .get();
        users.forEach((doc) => {
          doc.ref.update({ fcmToken: admin.firestore.FieldValue.delete() }).catch(() => {});
        });
        return { ok: false, reason: 'token-unregistered' };
      }
      throw new HttpsError('internal', 'Failed to send notification.');
    }
  }
);

exports.analyzeTone = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { text } = request.data || {};
    if (!text || typeof text !== 'string' || text.length > 5000) {
      throw new HttpsError('invalid-argument', 'text must be a string of 5,000 characters or fewer.');
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured.');
    try {
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: `Analyze the tone of this message and return ONLY valid JSON like: {"safe":true,"tone":"neutral","warning":""} or {"safe":false,"tone":"aggressive","warning":"This may come across as aggressive."}.\nMessage: "${text}"` }]
            }],
            generationConfig: { maxOutputTokens: 120, temperature: 0 }
          })
        }
      );
      if (!gemRes.ok) return { safe: true, tone: 'neutral', warning: '' };
      const gemData = await gemRes.json();
      const raw = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '{"safe":true,"tone":"neutral","warning":""}';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { safe: true, tone: 'neutral', warning: '' };
      return { safe: !!result.safe, tone: result.tone || 'neutral', warning: result.warning || '' };
    } catch (_) {
      return { safe: true, tone: 'neutral', warning: '' };
    }
  }
);

exports.autoTagChat = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { chatId, chatName } = request.data || {};
    if (!chatId) throw new HttpsError('invalid-argument', 'chatId is required.');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured.');
    try {
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: `Suggest 2-4 short tags (single words, lowercase) for a chat named "${chatName || 'Unknown'}" based on typical WhatsApp chat topics. Return ONLY valid JSON like {"tags":["work","family"]}.` }]
            }],
            generationConfig: { maxOutputTokens: 80, temperature: 0.4 }
          })
        }
      );
      if (!gemRes.ok) return { tags: [] };
      const gemData = await gemRes.json();
      const raw = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '{"tags":[]}';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { tags: [] };
      return { tags: Array.isArray(result.tags) ? result.tags.slice(0, 4) : [] };
    } catch (_) {
      return { tags: [] };
    }
  }
);

exports.classifyNotification = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { senderName, text, chatType, chatName, isGroup, isMentioned, isReply, hasAttachment } = request.data || {};
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const gemRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [{ text: `Classify the importance of this chat notification. Return ONLY valid JSON like {"priority":"high"|"medium"|"low","reason":"short reason"}.\nContext: sender=${senderName || 'unknown'}, group=${!!isGroup}, chatName=${chatName || ''}, mentioned=${!!isMentioned}, reply=${!!isReply}, hasAttachment=${!!hasAttachment}.\nMessage: "${String(text || '').slice(0, 300)}"` }]
              }],
              generationConfig: { maxOutputTokens: 60, temperature: 0 }
            })
          }
        );
        if (gemRes.ok) {
          const gemData = await gemRes.json();
          const raw = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '{"priority":"high","reason":"Message"}';
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { priority: 'high' };
          const priority = ['high', 'medium', 'low'].includes(result.priority) ? result.priority : 'high';
          return { priority, reason: result.reason || '' };
        }
      } catch (_) {}
    }
    // Deterministic fallback (matches client fallback)
    if (isMentioned) return { priority: 'high', reason: 'Mentioned' };
    if (isGroup) return { priority: 'medium', reason: 'Group message' };
    return { priority: 'high', reason: 'Direct message' };
  }
);

exports.flagSensitiveContent = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const { messageId, chatId } = request.data || {};
    if (!messageId || typeof messageId !== 'string') {
      throw new HttpsError('invalid-argument', 'messageId is required.');
    }
    const msgRef = admin.firestore().collection('messages').doc(messageId);
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) throw new HttpsError('not-found', 'Message not found.');
    const msg = msgSnap.data() || {};
    const uid = request.auth.uid;
    const isSender = msg.senderId === uid;
    let isParticipant = isSender;
    if (!isParticipant && msg.directId) {
      const chatSnap = await admin.firestore().collection('directChats').doc(msg.directId).get();
      isParticipant = chatSnap.exists && (chatSnap.data()?.participants || []).includes(uid);
    }
    if (!isParticipant && msg.groupId) {
      const groupSnap = await admin.firestore().collection('groups').doc(msg.groupId).get();
      isParticipant = groupSnap.exists && (groupSnap.data()?.memberIds || []).includes(uid);
    }
    if (!isParticipant) throw new HttpsError('permission-denied', 'You do not have access to this message.');
    await msgRef.update({
      sensitive: true,
      flaggedBy: uid,
      flaggedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true, messageId };
  }
);

exports.unflagSensitiveContent = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const { messageId } = request.data || {};
    if (!messageId || typeof messageId !== 'string') {
      throw new HttpsError('invalid-argument', 'messageId is required.');
    }
    const msgRef = admin.firestore().collection('messages').doc(messageId);
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) throw new HttpsError('not-found', 'Message not found.');
    const msg = msgSnap.data() || {};
    const uid = request.auth.uid;
    const isSender = msg.senderId === uid;
    const isFlogger = msg.flaggedBy === uid;
    let isParticipant = isSender || isFlogger;
    if (!isParticipant && msg.directId) {
      const chatSnap = await admin.firestore().collection('directChats').doc(msg.directId).get();
      isParticipant = chatSnap.exists && (chatSnap.data()?.participants || []).includes(uid);
    }
    if (!isParticipant && msg.groupId) {
      const groupSnap = await admin.firestore().collection('groups').doc(msg.groupId).get();
      isParticipant = groupSnap.exists && (groupSnap.data()?.memberIds || []).includes(uid);
    }
    if (!isParticipant) throw new HttpsError('permission-denied', 'You do not have access to this message.');
    await msgRef.update({
      sensitive: false,
      unflagBy: uid,
      unflagAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true, messageId };
  }
);

exports.updateChatRole = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const { chatId, targetUid, newRole } = request.data || {};
    if (!chatId || typeof chatId !== 'string') {
      throw new HttpsError('invalid-argument', 'chatId is required.');
    }
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid is required.');
    }
    if (!['admin', 'moderator', 'member'].includes(newRole)) {
      throw new HttpsError('invalid-argument', 'newRole must be admin, moderator, or member.');
    }
    if (uid === targetUid) {
      throw new HttpsError('invalid-argument', 'You cannot change your own role.');
    }

    const chatRef = admin.firestore().collection('groups').doc(chatId);
    const chatSnap = await chatRef.get();
    if (!chatSnap.exists) {
      // Try direct chat doc roles (chats collection)
      const altRef = admin.firestore().collection('chats').doc(chatId);
      const altSnap = await altRef.get();
      if (!altSnap.exists) throw new HttpsError('not-found', 'Chat not found.');
      const alt = altSnap.data() || {};
      const adminIds = alt.adminIds || alt.admins || [];
      const isOwner = alt.createdBy === uid || alt.ownerId === uid;
      if (!adminIds.includes(uid) && !isOwner) {
        throw new HttpsError('permission-denied', 'Only admins can manage roles.');
      }
      await altRef.update({ [`roles.${targetUid}`]: newRole, updatedAt: Date.now() });
      return { ok: true };
    }

    const chat = chatSnap.data() || {};
    const adminIds = chat.adminIds || chat.admins || [];
    const isOwner = chat.createdBy === uid || chat.ownerId === uid;
    if (!adminIds.includes(uid) && !isOwner) {
      throw new HttpsError('permission-denied', 'Only admins can manage roles.');
    }
    await chatRef.update({ [`roles.${targetUid}`]: newRole, updatedAt: Date.now() });
    return { ok: true };
  }
);

exports.aiSearchMessages = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { query, chatIds } = request.data || {};
    if (!query || typeof query !== 'string' || query.length > 200) {
      throw new HttpsError('invalid-argument', 'query is required (max 200 chars).');
    }
    const ids = Array.isArray(chatIds) ? chatIds.slice(0, 50) : [];
    if (!ids.length) return { results: [], aiRanked: true };

    // Keyword match first so results are grounded in real data
    const keyword = query.toLowerCase();
    const candidates = [];
    for (const chatId of ids) {
      try {
        const snap = await admin.firestore().collection('messages')
          .where('directId', '==', chatId)
          .orderBy('timestamp', 'desc')
          .limit(30)
          .get();
        snap.docs.forEach((d) => {
          const m = d.data() || {};
          const text = String(m.text || '');
          if (text && text.toLowerCase().includes(keyword)) {
            candidates.push({ id: d.id, chatId, text: text.slice(0, 300), senderName: m.senderName || 'Unknown' });
          }
        });
      } catch (_) {}
      try {
        const snap2 = await admin.firestore().collection('messages')
          .where('groupId', '==', chatId)
          .orderBy('timestamp', 'desc')
          .limit(30)
          .get();
        snap2.docs.forEach((d) => {
          const m = d.data() || {};
          const text = String(m.text || '');
          if (text && text.toLowerCase().includes(keyword)) {
            candidates.push({ id: d.id, chatId, text: text.slice(0, 300), senderName: m.senderName || 'Unknown' });
          }
        });
      } catch (_) {}
    }

    // Dedup by id
    const seen = new Set();
    const unique = candidates.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));

    if (!unique.length) return { results: [], aiRanked: true };

    // AI ranking (fall back to keyword order if Gemini fails)
    const apiKey = process.env.GEMINI_API_KEY;
    let ranked = unique;
    if (apiKey) {
      try {
        const snippet = unique.slice(0, 20).map((m) => `- ${m.senderName}: ${m.text}`).join('\n');
        const gemRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [{ text: `Rank these chat search results by relevance to the query "${query}". Return ONLY a JSON array of indices (numbers) in best-to-worst order, like [2,0,1].\nResults:\n${snippet}` }]
              }],
              generationConfig: { maxOutputTokens: 100, temperature: 0 }
            })
          }
        );
        if (gemRes.ok) {
          const gemData = await gemRes.json();
          const raw = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const jsonMatch = raw.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const order = JSON.parse(jsonMatch[0]);
            if (Array.isArray(order) && order.length) {
              const valid = order.filter((i) => typeof i === 'number' && i >= 0 && i < unique.length);
              const sorted = valid.map((i) => unique[i]).concat(unique.filter((_, i) => !valid.includes(i)));
              ranked = sorted;
            }
          }
        }
      } catch (_) {}
    }
    return { results: ranked, aiRanked: true };
  }
);
