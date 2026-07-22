"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb } = require("./admin");
const { requireAuth } = require("./helpers");
const { GEMINI_API_KEY, callGemini, fetchRecentMessages, formatMessagesForPrompt } = require("./gemini");

// Free tier rate limiter: 5 requests per minute per user, 30 per hour
const _rateLimits = new Map();
const RATE_LIMIT_PER_MIN = 5;
const RATE_LIMIT_PER_HOUR = 30;
const MINUTE_MS = 60000;
const HOUR_MS = 3600000;

function _checkRateLimit(uid) {
  if (!uid) return true;
  var now = Date.now();
  var limits = _rateLimits.get(uid);
  if (!limits) {
    limits = { minute: [], hour: [] };
    _rateLimits.set(uid, limits);
  }
  limits.minute = limits.minute.filter(function(t) { return now - t < MINUTE_MS; });
  limits.hour = limits.hour.filter(function(t) { return now - t < HOUR_MS; });
  if (limits.minute.length >= RATE_LIMIT_PER_MIN || limits.hour.length >= RATE_LIMIT_PER_HOUR) {
    return false;
  }
  limits.minute.push(now);
  limits.hour.push(now);
  return true;
}

// Cleanup old entries every 10 minutes
setInterval(function() {
  var now = Date.now();
  _rateLimits.forEach(function(limits, uid) {
    limits.minute = limits.minute.filter(function(t) { return now - t < MINUTE_MS; });
    limits.hour = limits.hour.filter(function(t) { return now - t < HOUR_MS; });
    if (limits.minute.length === 0 && limits.hour.length === 0) _rateLimits.delete(uid);
  });
}, 600000);

exports.catchMeUp = onCall({ secrets: [GEMINI_API_KEY], memory: "128MiB" }, async (request) => {
  requireAuth(request);
  const uid = request.auth.uid;
  if (!_checkRateLimit(uid)) {
    throw new HttpsError("resource-exhausted", "AI rate limit reached. Please try again later.");
  }
  const { chatId, chatType, messageCount } = request.data;

  if (!chatId || typeof chatId !== "string") {
    throw new HttpsError("invalid-argument", "Missing or invalid chatId");
  }

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    return { summary: "AI not configured. Add Gemini API key: firebase functions:secrets:set GEMINI_API_KEY" };
  }

  try {
    const count = Math.min(Math.max(parseInt(messageCount) || 50, 1), 100);
    const messages = await fetchRecentMessages(chatId, count);

    if (!messages.length) {
      return { summary: "No messages to summarize." };
    }

    const formatted = formatMessagesForPrompt(messages);
    const prompt = `You are a helpful chat assistant. Summarize the following ${messages.length} messages from a ${chatType || "direct"} chat into a clear, concise summary. Use bullet points for key topics. Keep it under 200 words.

Messages:
${formatted}

Summary:`;

    const summary = await callGemini(prompt, apiKey);
    return { summary, messageCount: messages.length };
  } catch (e) {
    return { summary: "Unable to generate summary right now.", messageCount: 0 };
  }
});

exports.transcribeVoiceMessage = onCall(async (request) => {
  requireAuth(request);
  throw new HttpsError("unimplemented", "Voice transcription not yet available");
});

exports.aiChatBot = onCall({ secrets: [GEMINI_API_KEY], memory: "128MiB" }, async (request) => {
  requireAuth(request);
  const uid = request.auth.uid;
  if (!_checkRateLimit(uid)) {
    throw new HttpsError("resource-exhausted", "AI rate limit reached. Please try again later.");
  }
  const { prompt, chatId, chatType, senderName } = request.data;

  if (!prompt || !chatId) {
    throw new HttpsError("invalid-argument", "Missing prompt or chatId");
  }
  if (typeof prompt !== "string" || prompt.length > 10000) {
    throw new HttpsError("invalid-argument", "Prompt must be a string under 10000 characters");
  }

  const apiKey = GEMINI_API_KEY.value();
  const db = getDb();

  if (!apiKey) {
    await db.collection("messages").add({
      text: "AI bot is not configured. Admin: set GEMINI_API_KEY secret.",
      senderId: "ai-bot",
      senderName: "AI Bot",
      timestamp: Date.now(),
      createdAt: Date.now(),
      status: "sent",
      readBy: {},
      chatId,
      chatType: chatType || "direct",
      participants: []
    });
    return { ok: true };
  }

  const recentMsgs = await fetchRecentMessages(chatId, 20);
  const context = recentMsgs.length
    ? "\n\nRecent chat context:\n" + formatMessagesForPrompt(recentMsgs.slice(-10))
    : "";

  const systemPrompt = `You are a helpful AI assistant in a team chat. Reply concisely and helpfully. You can answer questions, summarize, translate, write code, or help with any task. Keep responses under 300 words unless asked for detail.${context}\n\nUser (${senderName}): ${prompt}`;

  const replyText = await callGemini(systemPrompt, apiKey);

  // Fetch participants so the message is visible under Firestore rules
  let participants = [];
  try {
    if (chatType === 'group' && request.data.groupId) {
      const groupDoc = await db.collection('groupChats').doc(request.data.groupId).get();
      if (groupDoc.exists) participants = groupDoc.data().members || groupDoc.data().memberIds || [];
    } else {
      const chatDoc = await db.collection('directChats').doc(chatId).get();
      if (chatDoc.exists) participants = chatDoc.data().members || chatDoc.data().participants || [];
    }
  } catch (_) {}

  await db.collection("messages").add({
    text: replyText,
    senderId: "ai-bot",
    senderName: "AI Assistant",
    timestamp: Date.now(),
    createdAt: Date.now(),
    status: "sent",
    readBy: {},
    chatId,
    chatType: chatType || "direct",
    participants
  });

  return { ok: true };
});

exports.summarizeThread = onCall({ secrets: [GEMINI_API_KEY], memory: "128MiB" }, async (request) => {
  requireAuth(request);
  throw new HttpsError("unimplemented", "Thread summarization not yet available");
});

exports.generateMeetingNotes = onCall({ secrets: [GEMINI_API_KEY], memory: "128MiB" }, async (request) => {
  requireAuth(request);
  const uid = request.auth.uid;
  if (!_checkRateLimit(uid)) {
    throw new HttpsError("resource-exhausted", "AI rate limit reached. Please try again later.");
  }
  const { chatId, messageCount } = request.data;

  if (!chatId || typeof chatId !== "string") {
    throw new HttpsError("invalid-argument", "Missing or invalid chatId");
  }

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    return { notes: "AI not configured. Add Gemini API key." };
  }

  try {
    const count = Math.min(Math.max(parseInt(messageCount) || 100, 1), 200);
    const messages = await fetchRecentMessages(chatId, count);

    if (!messages.length) {
      return { notes: "No messages to analyze." };
    }

    const formatted = formatMessagesForPrompt(messages);
    const prompt = `You are a professional meeting notes generator. Analyze the following group chat messages and generate structured meeting notes. Include:

1. **Meeting Summary** - One paragraph overview
2. **Key Discussion Points** - Bullet points of main topics discussed
3. **Decisions Made** - Any decisions or conclusions reached
4. **Action Items** - Tasks assigned or mentioned, with who is responsible if clear
5. **Follow-ups** - Items that need future attention

Messages from the chat:
${formatted}

Generate the meeting notes in clean markdown:`;

    const notes = await callGemini(prompt, apiKey);
    return { notes, messageCount: messages.length };
  } catch (e) {
    return { notes: "Unable to generate meeting notes right now.", messageCount: 0 };
  }
});

exports.analyzeTone = onCall({ secrets: [GEMINI_API_KEY], memory: "128MiB" }, async (request) => {
  requireAuth(request);
  const uid = request.auth.uid;
  if (!_checkRateLimit(uid)) {
    throw new HttpsError("resource-exhausted", "AI rate limit reached. Please try again later.");
  }
  const { text, chatType } = request.data;

  if (!text || typeof text !== "string" || text.length > 5000) {
    throw new HttpsError("invalid-argument", "Missing or invalid text (max 5000 chars)");
  }

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    return { safe: true, tone: "neutral", warning: null };
  }

  const prompt = `Analyze the tone of this message for a ${chatType || "team"} chat. Be strict but fair.

Message: "${text}"

Respond in this EXACT JSON format only, nothing else:
{"safe": true/false, "tone": "one of: friendly, neutral, formal, rude, aggressive, passive-aggressive, sarcastic", "warning": "null if safe, or a brief helpful suggestion to make the message more professional if tone is negative", "score": 0-100 where 100 is perfectly polite}

Rules:
- "safe": false only for clearly rude, aggressive, or hostile messages
- Be lenient with casual/friendly language — that's normal in team chats
- Sarcasm and passive-aggression should get warnings but may still be "safe"
- Only flag messages that would genuinely damage professional relationships`;

  try {
    const result = await callGemini(prompt, apiKey);
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (_) {}

  return { safe: true, tone: "neutral", warning: null };
});

exports.autoTagChat = onCall({ secrets: [GEMINI_API_KEY], memory: "128MiB" }, async (request) => {
  requireAuth(request);
  const uid = request.auth.uid;
  if (!_checkRateLimit(uid)) {
    throw new HttpsError("resource-exhausted", "AI rate limit reached. Please try again later.");
  }
  const { chatId, chatName, recentMessages } = request.data;

  if (!chatId) {
    throw new HttpsError("invalid-argument", "Missing chatId");
  }

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    return { tags: [] };
  }

  let messages = recentMessages;
  if (!messages || !messages.length) {
    messages = await fetchRecentMessages(chatId, 30);
  }

  if (!messages.length) {
    return { tags: [] };
  }

  const formatted = formatMessagesForPrompt(messages);
  const prompt = `Analyze this chat "${chatName || "Unknown"}" and suggest up to 3 labels/tags that accurately describe it.

Available tags: Work, Family, Friends, Urgent, Project, Support, Sales, Marketing, Finance, HR, IT, Legal, Personal, Social, Events, Planning, Updates, General

Chat messages:
${formatted}

Respond in this EXACT JSON format only:
{"tags": ["tag1", "tag2"], "confidence": 0.85}

Rules:
- Pick the most relevant 1-3 tags from the available list
- confidence: 0-1 indicating how confident you are
- If the chat doesn't fit any tag well, use "General"
- Consider the overall theme, not just the last message`;

  try {
    const result = await callGemini(prompt, apiKey);
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (_) {}

  return { tags: [] };
});

exports.aiSearchMessages = onCall({ secrets: [GEMINI_API_KEY], memory: "128MiB" }, async (request) => {
  requireAuth(request);
  const uid = request.auth.uid;
  if (!_checkRateLimit(uid)) {
    throw new HttpsError("resource-exhausted", "AI rate limit reached. Please try again later.");
  }
  const { query, chatIds } = request.data;

  if (!query || typeof query !== "string" || query.length > 1000) {
    throw new HttpsError("invalid-argument", "Missing or invalid query (max 1000 chars)");
  }

  if (!Array.isArray(chatIds) || chatIds.length === 0) {
    throw new HttpsError("invalid-argument", "Missing or empty chatIds array");
  }

  const apiKey = GEMINI_API_KEY.value();
  const db = getDb();
  const qLower = query.toLowerCase();
  const searchChats = Array.isArray(chatIds) ? chatIds.slice(0, 10) : [];
  const results = [];

  for (const cid of searchChats) {
    let snap;
    try {
      snap = await db.collection("messages")
        .where("chatId", "==", cid)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
    } catch (_) {
      try {
        snap = await db.collection("messages")
          .where("chatId", "==", cid)
          .orderBy("timestamp", "desc")
          .limit(50)
          .get();
      } catch (_) { continue; }
    }

    for (const doc of snap.docs) {
      const m = doc.data();
      const text = (m.text || m.message || m.body || "").toLowerCase();
      if (text.includes(qLower)) {
        results.push({
          id: doc.id,
          chatId: cid,
          text: m.text || m.message || m.body || "",
          senderName: m.senderName || "Unknown",
          createdAt: m.createdAt || m.timestamp || 0,
          keywordMatch: true
        });
      }
    }
  }

  if (apiKey && results.length > 1) {
    try {
      const msgList = results.slice(0, 30).map((r, i) =>
        `[${i}] ${r.senderName}: ${r.text.slice(0, 200)}`
      ).join("\n");

      const prompt = `Given this search query: "${query}"

Here are matching messages ranked by relevance. Return ONLY a JSON array of indices sorted by relevance (most relevant first). Only include indices of messages that are actually relevant to the query meaning, not just keyword matches.

Messages:
${msgList}

Response format: [2, 0, 5, ...]`;

      const aiResult = await callGemini(prompt, apiKey);
      const indicesMatch = aiResult.match(/\[[\d\s,]*\]/);
      if (indicesMatch) {
        const indices = JSON.parse(indicesMatch[0]);
        const reranked = indices
          .filter(i => i < results.length)
          .map(i => ({ ...results[i], aiRank: true }));
        const rankedIds = new Set(reranked.map(r => r.id));
        results.filter(r => !rankedIds.has(r.id)).forEach(r => reranked.push(r));
        return { results: reranked.slice(0, 20), aiRanked: true };
      }
    } catch (_) {}
  }

  return { results: results.slice(0, 20), aiRanked: false };
});

exports.classifyNotification = onCall({ secrets: [GEMINI_API_KEY], memory: "128MiB" }, async (request) => {
  requireAuth(request);
  const { senderName, text, chatType, chatName, isGroup, isMentioned, isReply, hasAttachment } = request.data;

  if (text && typeof text === "string" && text.length > 2000) {
    throw new HttpsError("invalid-argument", "Text exceeds 2000 characters");
  }

  // Rule-based classifier (no Gemini needed — saves free tier quota)
  const lowerText = (text || "").toLowerCase();
  const urgentWords = /\b(urgent|asap|emergency|important|critical|deadline|immediately|help)\b/i;
  const mentionIndicators = /\b(@you|@everyone|hey)\b/i;

  let priority = "medium";
  let reason = "Normal message";

  if (isMentioned || (mentionIndicators.test(lowerText) && isGroup)) {
    priority = "high";
    reason = "You were mentioned";
  } else if (urgentWords.test(lowerText)) {
    priority = "high";
    reason = "Contains urgent keywords";
  } else if (isReply) {
    priority = "medium";
    reason = "Reply to your message";
  } else if (!isGroup) {
    priority = "medium";
    reason = "Direct message";
  } else {
    priority = "low";
    reason = "Group message";
  }

  return { priority, reason };
});
