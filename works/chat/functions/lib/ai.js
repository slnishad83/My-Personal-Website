"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb } = require("./admin");
const { requireAuth } = require("./helpers");
const { GEMINI_API_KEY, callGemini, fetchRecentMessages, formatMessagesForPrompt } = require("./gemini");

exports.catchMeUp = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  requireAuth(request);
  const { chatId, chatType, messageCount } = request.data;

  if (!chatId) {
    throw new HttpsError("invalid-argument", "Missing chatId");
  }

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    return { summary: "AI not configured. Add Gemini API key: firebase functions:secrets:set GEMINI_API_KEY" };
  }

  const count = Math.min(messageCount || 50, 100);
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
});

exports.transcribeVoiceMessage = onCall(async (request) => {
  requireAuth(request);
  const { messageId, audioUrl } = request.data;

  if (!messageId || !audioUrl) {
    throw new HttpsError("invalid-argument", "Missing messageId or audioUrl");
  }

  return { text: "Transcription unavailable" };
});

exports.aiChatBot = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  requireAuth(request);
  const { prompt, chatId, chatType, senderName } = request.data;

  if (!prompt || !chatId) {
    throw new HttpsError("invalid-argument", "Missing prompt or chatId");
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
    participants: []
  });

  return { ok: true };
});

exports.summarizeThread = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  requireAuth(request);
  const { messageId } = request.data;

  if (!messageId) {
    throw new HttpsError("invalid-argument", "Missing messageId");
  }

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    return { summary: "AI not configured." };
  }

  return { summary: "Thread summary unavailable." };
});

exports.generateMeetingNotes = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  requireAuth(request);
  const { chatId, messageCount } = request.data;

  if (!chatId) {
    throw new HttpsError("invalid-argument", "Missing chatId");
  }

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    return { notes: "AI not configured. Add Gemini API key." };
  }

  const count = Math.min(messageCount || 100, 200);
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
});

exports.analyzeTone = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  requireAuth(request);
  const { text, chatType } = request.data;

  if (!text || typeof text !== "string") {
    throw new HttpsError("invalid-argument", "Missing text");
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

exports.autoTagChat = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  requireAuth(request);
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

exports.aiSearchMessages = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  requireAuth(request);
  const { query, chatIds } = request.data;

  if (!query || typeof query !== "string") {
    throw new HttpsError("invalid-argument", "Missing query");
  }

  const apiKey = GEMINI_API_KEY.value();
  const db = getDb();
  const qLower = query.toLowerCase();
  const searchChats = Array.isArray(chatIds) && chatIds.length ? chatIds : [];
  const results = [];

  for (const cid of searchChats.slice(0, 10)) {
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

exports.classifyNotification = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  requireAuth(request);
  const { senderName, text, chatType, chatName, isGroup, isMentioned, isReply, hasAttachment } = request.data;

  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) {
    return { priority: "high", reason: "AI not configured — defaulting to show" };
  }

  const prompt = `Classify this chat notification's priority. Be strict — only truly important messages should be "high".

Notification details:
- From: ${senderName || "Unknown"}
- Chat: ${chatName || "Direct message"} (${isGroup ? "group" : "direct"})
- Mentioned you: ${isMentioned ? "yes" : "no"}
- Is a reply: ${isReply ? "yes" : "no"}
- Has attachment: ${hasAttachment ? "yes" : "no"}
- Message: "${(text || "").slice(0, 300)}"

Respond in this EXACT JSON format only:
{"priority": "high" or "medium" or "low", "reason": "brief 1-sentence explanation"}

Rules:
- "high": Mentions your name, urgent/time-sensitive, from a boss/admin, contains "urgent"/"asap"/"emergency", or is a direct question to you
- "medium": Normal conversation in a group you're in, reply to your message, relevant work discussion
- "low": Group chatter not directed at you, generic updates, casual conversation, "thanks"/"ok"/emoji-only messages, broadcast announcements`;

  try {
    const result = await callGemini(prompt, apiKey);
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (["high", "medium", "low"].includes(parsed.priority)) {
        return parsed;
      }
    }
  } catch (_) {}

  if (isMentioned) return { priority: "high", reason: "You were mentioned" };
  if (isGroup) return { priority: "medium", reason: "Group message" };
  return { priority: "high", reason: "Direct message" };
});
