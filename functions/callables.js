const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const _adminModule = require('firebase-admin');
const admin = new Proxy({}, {
  get(_target, prop) {
    if (!_adminModule.getApps().length) {
      _adminModule.initializeApp();
    }
    return _adminModule[prop];
  }
});

const CHAT_APP_URL = 'https://nishadsl.com/works/chat/';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Simple in-memory rate limiter per user (5 requests/min, 30/hour for AI functions)
const _aiRateBuckets = new Map();
let _aiCleanupStarted = false;
function checkAiRateLimit(uid) {
  if (!_aiCleanupStarted) {
    _aiCleanupStarted = true;
    setInterval(() => {
      const now = Date.now();
      for (const [uid, bucket] of _aiRateBuckets) {
        bucket.minute = bucket.minute.filter(t => now - t < 60000);
        bucket.hour = bucket.hour.filter(t => now - t < 3600000);
        if (bucket.minute.length === 0 && bucket.hour.length === 0) _aiRateBuckets.delete(uid);
      }
    }, 300000);
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
  { region: 'us-central1', secrets: [geminiApiKey] },
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

    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'GEMINI_API_KEY secret is not configured.');
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
  { region: 'us-central1', secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { messageId } = request.data || {};
    if (!messageId) throw new HttpsError('invalid-argument', 'Missing messageId.');

    const apiKey = geminiApiKey.value();
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
  { region: 'us-central1', secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { text } = request.data || {};
    if (!text) throw new HttpsError('invalid-argument', 'Missing message text.');
    if (typeof text !== 'string' || text.length > 5000) {
      throw new HttpsError('invalid-argument', 'Message text must be 5,000 characters or fewer.');
    }

    const apiKey = geminiApiKey.value();
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
  { region: 'us-central1', secrets: [geminiApiKey] },
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
    const apiKey = geminiApiKey.value();
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
  { region: 'us-central1', secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { chatId, chatType } = request.data || {};
    if (!chatId || !chatType) throw new HttpsError('invalid-argument', 'Missing chatId or chatType.');
    const apiKey = geminiApiKey.value();
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
  { region: 'us-central1', secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!checkAiRateLimit(request.auth.uid)) throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.');
    const { text } = request.data || {};
    if (!text) throw new HttpsError('invalid-argument', 'Missing text.');
    const apiKey = geminiApiKey.value();
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
