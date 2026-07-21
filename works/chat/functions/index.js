const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// =============================================
// GEMINI API KEY (stored as Firebase secret)
// =============================================
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// =============================================
// HELPER: Call Gemini API
// =============================================
async function callGemini(prompt, apiKey) {
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Run: firebase functions:secrets:set GEMINI_API_KEY");
  }
  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// =============================================
// HELPER: Verify authenticated request
// =============================================
function requireAuth(context) {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  return context.auth.uid;
}

// =============================================
// HELPER: CORS validation for HTTP endpoints
// =============================================
const ALLOWED_ORIGINS = [
  "https://my-team-chat-2255.web.app",
  "https://nishadsl.com",
  "http://localhost"
];

const rateLimitCache = new Map();
const LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30; // max 30 requests per minute

function checkRateLimit(req, res) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();
  
  if (!rateLimitCache.has(ip)) {
    rateLimitCache.set(ip, []);
  }
  
  const timestamps = rateLimitCache.get(ip);
  const activeTimestamps = timestamps.filter(t => now - t < LIMIT_WINDOW);
  
  if (activeTimestamps.length >= MAX_REQUESTS) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return false;
  }
  
  activeTimestamps.push(now);
  rateLimitCache.set(ip, activeTimestamps);
  return true;
}

function validateCors(req, res) {
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  let matchedOrigin = null;
  if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    matchedOrigin = origin;
  } else if (referer) {
    try {
      const parsedUrl = new URL(referer);
      const refOrigin = parsedUrl.origin;
      if (ALLOWED_ORIGINS.some(o => refOrigin.startsWith(o))) {
        matchedOrigin = refOrigin;
      }
    } catch (_) {}
  }

  if (req.method === "OPTIONS") {
    if (matchedOrigin) {
      res.set("Access-Control-Allow-Origin", matchedOrigin);
      res.status(204).send();
    } else {
      res.set("Access-Control-Allow-Origin", ALLOWED_ORIGINS[0]);
      res.status(403).send();
    }
    return false;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return false;
  }

  if (!matchedOrigin) {
    res.status(403).json({ error: "Access Denied" });
    return false;
  }

  res.set("Access-Control-Allow-Origin", matchedOrigin);
  return true;
}

// =============================================
// HTTP: getTurnCredentials
// Returns TURN/STUN server credentials for WebRTC.
// In production, integrate with a TURN provider (e.g., Twilio, Metered).
// =============================================
exports.getTurnCredentials = onRequest(async (req, res) => {
  if (!checkRateLimit(req, res)) return;
  if (!validateCors(req, res)) return;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = await auth.verifyIdToken(token);

    // Stub: Return Google STUN servers. Replace with real TURN credentials.
    const iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" }
    ];

    res.json(iceServers);
  } catch (error) {
    console.error("getTurnCredentials error:", error);
    res.status(500).json({ error: "Failed to get credentials" });
  }
});

// =============================================
// HTTP: sendNotificationReply
// Sends a reply from push notification inline-reply when no app tab is open.
// =============================================
exports.sendNotificationReply = onRequest(async (req, res) => {
  if (!checkRateLimit(req, res)) return;
  if (!validateCors(req, res)) return;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = await auth.verifyIdToken(token);
    const { chatId, chatType, text, groupId } = req.body;

    if (!chatId || !text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing chatId or text" });
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0 || trimmedText.length > 5000) {
      return res.status(400).json({ error: "Text must be 1-5000 characters" });
    }

    // H7: Escape HTML to prevent XSS
    const sanitizedText = trimmedText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

    const validChatType = chatType === "group" ? "group" : "direct";

    // Verify sender is a member of the chat
    let isMember = false;
    try {
      if (validChatType === "group" && groupId) {
        const groupDoc = await db.collection("groupChats").doc(groupId).get();
        if (groupDoc.exists) {
          const members = groupDoc.data().members || groupDoc.data().memberIds || [];
          isMember = members.includes(decoded.uid);
        }
      } else {
        const chatDoc = await db.collection("directChats").doc(chatId).get();
        if (chatDoc.exists) {
          const members = chatDoc.data().members || chatDoc.data().participants || [];
          isMember = members.includes(decoded.uid);
        }
      }
    } catch (_) {}
    if (!isMember) {
      return res.status(403).json({ error: "You are not a member of this chat" });
    }

    // Build participants list with all chat members
    const participants = [decoded.uid];
    try {
      if (validChatType === "group" && groupId) {
        const groupDoc = await db.collection("groupChats").doc(groupId).get();
        if (groupDoc.exists && groupDoc.data().members) {
          for (const uid of groupDoc.data().members) {
            if (!participants.includes(uid)) participants.push(uid);
          }
        }
      } else {
        const chatDoc = await db.collection("directChats").doc(chatId).get();
        if (chatDoc.exists && chatDoc.data().members) {
          for (const uid of chatDoc.data().members) {
            if (!participants.includes(uid)) participants.push(uid);
          }
        }
      }
    } catch (_) {
      // Fallback: at least the sender
    }

    const msgData = {
      text: sanitizedText,
      senderId: decoded.uid,
      senderName: decoded.name || decoded.email || "User",
      timestamp: Date.now(),
      createdAt: Date.now(),
      status: "sent",
      readBy: { [decoded.uid]: true },
      chatId: chatId,
      chatType: validChatType,
      participants: participants,
      sentViaNotification: true
    };

    if (groupId) msgData.groupId = groupId;

    await db.collection("messages").add(msgData);

    res.json({ ok: true });
  } catch (error) {
    console.error("sendNotificationReply error:", error);
    res.status(500).json({ error: "Failed to send reply" });
  }
});

// =============================================
// HTTP: generateUrlPreview
// Generates Open Graph metadata for URL preview cards.
// Fetches the target URL server-side and extracts <meta> OG tags.
// Falls back to <title> and <meta name="description"> if OG tags missing.
// =============================================
exports.generateUrlPreview = onRequest(async (req, res) => {
  if (!checkRateLimit(req, res)) return;
  if (!validateCors(req, res)) return;

  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing url" });
    }

    let domain = "";
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      domain = parsedUrl.hostname.replace("www.", "");
    } catch (_) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    // SSRF protection: only allow http/https, block private IPs and internal hosts
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: "Only HTTP/HTTPS URLs allowed" });
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', 'metadata.google.internal',
      'metadata.google', 'metadata', '169.254.169.254', '10.', '172.16.', '172.17.', '172.18.',
      '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.',
      '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.', '169.254.'];
    for (const b of blocked) {
      if (hostname === b || hostname.startsWith(b)) {
        return res.status(400).json({ error: "Private/internal URLs not allowed" });
      }
    }

    // Fetch the page HTML with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let html = "";
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NSLChatBot/1.0; +https://nishadsl.com)",
          "Accept": "text/html,application/xhtml+xml"
        },
        redirect: "follow"
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        return res.json({ title: "", description: "", image: "", domain });
      }

      // Read only first 50KB to avoid downloading huge pages
      const reader = resp.body.getReader();
      const chunks = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalBytes += value.length;
        if (totalBytes > 50000) break;
      }
      const decoder = new TextDecoder("utf-8", { fatal: false });
      html = decoder.decode(Buffer.concat(chunks));
    } catch (fetchErr) {
      clearTimeout(timeout);
      // Fetch failed (timeout, DNS, etc.) — return empty preview
      return res.json({ title: "", description: "", image: "", domain });
    }

    // Extract OG/meta tags using regex (no external deps needed)
    const getMeta = (property) => {
      // Try property attribute first (og:*, twitter:*)
      let match = html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"));
      if (match) return match[1].trim();
      // Try content before property
      match = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"));
      if (match) return match[1].trim();
      // Try name attribute (twitter:*, description)
      match = html.match(new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"));
      if (match) return match[1].trim();
      match = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"));
      if (match) return match[1].trim();
      return "";
    };

    const getTitle = () => {
      const og = getMeta("og:title");
      if (og) return og;
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return match ? match[1].trim() : "";
    };

    const getDescription = () => {
      const og = getMeta("og:description");
      if (og) return og;
      const twitter = getMeta("twitter:description");
      if (twitter) return twitter;
      return getMeta("description");
    };

    const getImage = () => {
      const og = getMeta("og:image");
      if (og) return og;
      const twitter = getMeta("twitter:image");
      if (twitter) return twitter;
      // Try twitter:image:src
      return getMeta("twitter:image:src");
    };

    const result = {
      title: getTitle(),
      description: getDescription(),
      image: getImage(),
      domain: domain
    };

    res.json(result);
  } catch (error) {
    console.error("generateUrlPreview error:", error);
    res.status(500).json({ error: "Failed to generate preview" });
  }
});

// =============================================
// HTTP: lookupVerifiedUserByEmailV2
// Looks up a user by email for verification.
// =============================================
exports.lookupVerifiedUserByEmailV2 = onRequest({ region: "asia-south1" }, async (req, res) => {
  if (!checkRateLimit(req, res)) return;
  if (!validateCors(req, res)) return;

  try {
    // Require authenticated request with admin claim
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const caller = await auth.verifyIdToken(token);
    const callerRecord = await auth.getUser(caller.uid);
    if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const email = (req.query && req.query.email) || (req.body && req.body.email);
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Missing email" });
    }

    const userRecord = await auth.getUserByEmail(email);

    // Return minimal non-sensitive fields
    res.json({
      uid: userRecord.uid,
      displayName: userRecord.displayName || "",
      verified: true
    });
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ error: "User not found" });
    }
    console.error("lookupVerifiedUserByEmailV2 error:", error);
    res.status(500).json({ error: "Lookup failed" });
  }
});

// =============================================
// HTTP: repairGroupAccessMetadata
// Repairs group membership metadata inconsistencies.
// =============================================
exports.repairGroupAccessMetadata = onRequest(async (req, res) => {
  if (!checkRateLimit(req, res)) return;
  if (!validateCors(req, res)) return;

  try {
    // Require authenticated admin user
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const caller = await auth.verifyIdToken(token);
    const callerRecord = await auth.getUser(caller.uid);
    if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    let repaired = 0;
    const groupsSnap = await db.collection("groups").get();
    
    for (const groupDoc of groupsSnap.docs) {
      const groupId = groupDoc.id;
      const groupData = groupDoc.data();
      
      // Get all members from groupMembers collection
      const membersSnap = await db.collection("groupMembers")
        .where("groupId", "==", groupId)
        .get();
      
      const actualMemberIds = membersSnap.docs.map(doc => doc.data().userId).filter(Boolean);
      const currentMemberIds = groupData.memberIds || [];
      
      // Check for mismatches
      const hasMismatch = 
        actualMemberIds.length !== currentMemberIds.length ||
        !actualMemberIds.every(id => currentMemberIds.includes(id)) ||
        groupData.memberCount !== actualMemberIds.length;
        
      if (hasMismatch) {
        await db.collection("groups").doc(groupId).update({
          memberIds: actualMemberIds,
          members: actualMemberIds, // Sync both fields if both exist
          memberCount: actualMemberIds.length
        });
        repaired++;
      }
    }

    res.json({ ok: true, repaired: repaired });
  } catch (error) {
    console.error("repairGroupAccessMetadata error:", error);
    res.status(500).json({ error: "Repair failed" });
  }
});

// =============================================
// HELPER: Fetch last N messages for a chat
// =============================================
async function fetchRecentMessages(chatId, count = 50) {
  let snap;
  try {
    snap = await db.collection("messages")
      .where("chatId", "==", chatId)
      .orderBy("createdAt", "desc")
      .limit(count)
      .get();
  } catch (_) {
    snap = await db.collection("messages")
      .where("chatId", "==", chatId)
      .orderBy("timestamp", "desc")
      .limit(count)
      .get();
  }
  return snap.docs.map(d => {
    const m = d.data();
    return {
      sender: m.senderName || m.displayName || "Unknown",
      text: m.text || m.message || m.body || m.content || "",
      time: m.createdAt || m.timestamp || 0
    };
  }).filter(m => m.text).reverse();
}

// =============================================
// HELPER: Format messages for Gemini prompt
// =============================================
function formatMessagesForPrompt(messages) {
  return messages.map(m => {
    const d = m.time ? new Date(m.time) : new Date();
    const ts = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return `[${ts}] ${m.sender}: ${m.text}`;
  }).join("\n");
}

// =============================================
// CALLABLE: catchMeUp
// AI-powered summary of missed messages in a chat.
// =============================================
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

// =============================================
// CALLABLE: transcribeVoiceMessage
// Transcribes voice message audio to text.
// =============================================
exports.transcribeVoiceMessage = onCall(async (request) => {
  requireAuth(request);
  const { messageId, audioUrl } = request.data;

  if (!messageId || !audioUrl) {
    throw new HttpsError("invalid-argument", "Missing messageId or audioUrl");
  }

  return { text: "Transcription unavailable" };
});

// =============================================
// CALLABLE: aiChatBot
// AI chatbot that responds to @AI messages.
// =============================================
exports.aiChatBot = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  requireAuth(request);
  const { prompt, chatId, chatType, senderName } = request.data;

  if (!prompt || !chatId) {
    throw new HttpsError("invalid-argument", "Missing prompt or chatId");
  }

  const apiKey = GEMINI_API_KEY.value();
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

  // Fetch recent context for smarter replies
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

// =============================================
// CALLABLE: summarizeThread
// Generates an AI summary of a threaded conversation.
// =============================================
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

// =============================================
// CALLABLE: generateMeetingNotes
// AI reads a group chat and generates meeting notes.
// =============================================
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

// =============================================
// CALLABLE: analyzeTone
// Warns if a message sounds rude/aggressive before sending.
// =============================================
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

// =============================================
// CALLABLE: autoTagChat
// AI labels chats automatically.
// =============================================
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

// =============================================
// CALLABLE: aiSearchMessages
// AI-assisted search: keyword + semantic ranking.
// =============================================
exports.aiSearchMessages = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  requireAuth(request);
  const { query, chatIds } = request.data;

  if (!query || typeof query !== "string") {
    throw new HttpsError("invalid-argument", "Missing query");
  }

  const apiKey = GEMINI_API_KEY.value();

  // Phase 1: keyword search across chats (works without AI too)
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

  // Phase 2: If Gemini available, rank by semantic relevance
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
        // Add any remaining results not ranked by AI
        const rankedIds = new Set(reranked.map(r => r.id));
        results.filter(r => !rankedIds.has(r.id)).forEach(r => reranked.push(r));
        return { results: reranked.slice(0, 20), aiRanked: true };
      }
    } catch (_) {}
  }

  return { results: results.slice(0, 20), aiRanked: false };
});

// =============================================
// CALLABLE: classifyNotification
// AI decides notification priority: high / medium / low
// =============================================
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
      // Validate priority value
      if (["high", "medium", "low"].includes(parsed.priority)) {
        return parsed;
      }
    }
  } catch (_) {}

  // Fallback: mention = high, group = medium, direct = high
  if (isMentioned) return { priority: "high", reason: "You were mentioned" };
  if (isGroup) return { priority: "medium", reason: "Group message" };
  return { priority: "high", reason: "Direct message" };
});

// =============================================
// CALLABLE: leaveGroup
// Removes the current user from a group chat.
// =============================================
exports.leaveGroup = onCall(async (request) => {
  const uid = requireAuth(request);
  const { groupId } = request.data;

  if (!groupId) {
    throw new HttpsError("invalid-argument", "Missing groupId");
  }

  const groupRef = db.collection("groups").doc(groupId);
  const groupDoc = await groupRef.get();

  if (!groupDoc.exists) {
    throw new HttpsError("not-found", "Group not found");
  }

  const groupData = groupDoc.data();
  if (!groupData.memberIds || !groupData.memberIds.includes(uid)) {
    throw new HttpsError("failed-precondition", "You are not a member of this group");
  }

  await groupRef.update({
    memberIds: admin.firestore.FieldValue.arrayRemove(uid)
  });

  return { ok: true };
});

// =============================================
// CALLABLE: adminDeleteUser
// Permanently deletes a user (admin only).
// =============================================
exports.adminDeleteUser = onCall(async (request) => {
  const uid = requireAuth(request);
  const { targetUid } = request.data;

  const callerRecord = await auth.getUser(uid);
  if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Missing targetUid");
  }

  // Cleanup: delete user's messages (limit 500 per batch)
  const messagesSnap = await db.collection("messages")
    .where("senderId", "==", targetUid).limit(500).get();
  const batch1 = db.batch();
  messagesSnap.forEach(doc => batch1.delete(doc.ref));
  if (messagesSnap.size > 0) await batch1.commit();

  // Cleanup: delete user's sessions subcollection
  const sessionsSnap = await db.collection("users").doc(targetUid)
    .collection("sessions").limit(500).get();
  const batch2 = db.batch();
  sessionsSnap.forEach(doc => batch2.delete(doc.ref));
  if (sessionsSnap.size > 0) await batch2.commit();

  // Cleanup: delete user's callEvents subcollection
  const callsSnap = await db.collection("users").doc(targetUid)
    .collection("callEvents").limit(500).get();
  const batch3 = db.batch();
  callsSnap.forEach(doc => batch3.delete(doc.ref));
  if (callsSnap.size > 0) await batch3.commit();

  // Cleanup: delete user's groupMembers flat collection documents
  const groupMembersSnap = await db.collection("groupMembers")
    .where("userId", "==", targetUid).limit(500).get();
  const batchGM = db.batch();
  groupMembersSnap.forEach(doc => batchGM.delete(doc.ref));
  if (groupMembersSnap.size > 0) await batchGM.commit();

  // Cleanup: delete user's status documents
  const statusSnap = await db.collection("statuses")
    .where("userId", "==", targetUid).limit(500).get();
  const batchStatus = db.batch();
  statusSnap.forEach(doc => batchStatus.delete(doc.ref));
  if (statusSnap.size > 0) await batchStatus.commit();

  // Cleanup: delete user's tasks
  const tasksSnap = await db.collection("tasks")
    .where("userId", "==", targetUid).limit(500).get();
  const batchTasks = db.batch();
  tasksSnap.forEach(doc => batchTasks.delete(doc.ref));
  if (tasksSnap.size > 0) await batchTasks.commit();

  // Cleanup: delete calendar events added by user
  const calendarSnap = await db.collection("calendarEvents")
    .where("addedBy", "==", targetUid).limit(500).get();
  const batchCal = db.batch();
  calendarSnap.forEach(doc => batchCal.delete(doc.ref));
  if (calendarSnap.size > 0) await batchCal.commit();

  // Cleanup: delete group expenses added by user
  const expensesSnap = await db.collection("groupExpenses")
    .where("addedBy", "==", targetUid).limit(500).get();
  const batchExp = db.batch();
  expensesSnap.forEach(doc => batchExp.delete(doc.ref));
  if (expensesSnap.size > 0) await batchExp.commit();

  // Cleanup: delete direct chats user was in
  const directChatsSnap = await db.collection("directChats")
    .where("participants", "array-contains", targetUid).limit(500).get();
  const batchDC = db.batch();
  directChatsSnap.forEach(doc => batchDC.delete(doc.ref));
  if (directChatsSnap.size > 0) await batchDC.commit();

  // Cleanup: delete notification telemetry
  const telemetrySnap = await db.collection("notificationTelemetry")
    .where("userId", "==", targetUid).limit(500).get();
  const batchTel = db.batch();
  telemetrySnap.forEach(doc => batchTel.delete(doc.ref));
  if (telemetrySnap.size > 0) await batchTel.commit();

  // Cleanup: remove from group memberships
  const groupsSnap = await db.collection("groups")
    .where("memberIds", "array-contains", targetUid).get();
  const batch4 = db.batch();
  groupsSnap.forEach(doc => {
    batch4.update(doc.ref, {
      memberIds: admin.firestore.FieldValue.arrayRemove(targetUid)
    });
  });
  if (groupsSnap.size > 0) await batch4.commit();

  // Delete Firebase Auth user and Firestore profile
  await auth.deleteUser(targetUid);
  await db.collection("users").doc(targetUid).delete();

  return { ok: true, messagesDeleted: messagesSnap.size };
});

// =============================================
// CALLABLE: adminBanUser
// Bans a user (admin only).
// =============================================
exports.adminBanUser = onCall(async (request) => {
  const uid = requireAuth(request);
  const { targetUid, reason } = request.data;

  const callerRecord = await auth.getUser(uid);
  if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Missing targetUid");
  }

  await auth.setCustomUserClaims(targetUid, { banned: true });
  await db.collection("users").doc(targetUid).update({
    banned: true,
    bannedAt: Date.now(),
    bannedBy: uid,
    banReason: reason || ""
  });

  return { ok: true };
});

// =============================================
// CALLABLE: adminUnbanUser
// Unbans a user (admin only).
// =============================================
exports.adminUnbanUser = onCall(async (request) => {
  const uid = requireAuth(request);
  const { targetUid } = request.data;

  const callerRecord = await auth.getUser(uid);
  if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Missing targetUid");
  }

  const targetRecord = await auth.getUser(targetUid);
  const claims = { ...targetRecord.customClaims };
  delete claims.banned;
  await auth.setCustomUserClaims(targetUid, claims);

  await db.collection("users").doc(targetUid).update({
    banned: false,
    unbannedAt: Date.now(),
    unbannedBy: uid
  });

  return { ok: true };
});

// =============================================
// CHAT LOCK — Server-side PIN (PBKDF2)
// =============================================
const crypto = require("crypto");

function hashPinServer(pin, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(pin, salt, 100000, 64, "sha512", (err, derived) => {
      if (err) reject(err);
      else resolve(derived.toString("hex"));
    });
  });
}

const _pinRateLimit = new Map();
function checkPinRateLimit(uid, action) {
  const key = `${uid}:${action}`;
  const now = Date.now();
  const entry = _pinRateLimit.get(key);
  if (entry && now - entry.start < 60000 && entry.count >= 10) return false;
  if (!entry || now - entry.start >= 60000) _pinRateLimit.set(key, { start: now, count: 1 });
  else entry.count++;
  return true;
}

exports.setChatPin = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "set")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin, oldPin } = request.data;
  if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin))
    throw new HttpsError("invalid-argument", "PIN must be 4-8 digits");

  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};
  if (userData.pinSalt && userData.pinHash) {
    if (!oldPin) throw new HttpsError("invalid-argument", "Old PIN required");
    const oldHash = await hashPinServer(oldPin, userData.pinSalt);
    if (oldHash !== userData.pinHash) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }

  const salt = crypto.randomBytes(32).toString("hex");
  const hash = await hashPinServer(pin, salt);
  await db.collection("users").doc(uid).set({ pinSalt: salt, pinHash: hash, pinUpdatedAt: Date.now() }, { merge: true });
  return { ok: true };
});

exports.verifyChatPin = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "verify")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin } = request.data;
  if (!pin || typeof pin !== "string") throw new HttpsError("invalid-argument", "Missing PIN");

  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};

  if (!userData.pinHash || !userData.pinSalt) {
    throw new HttpsError("failed-precondition", "No chat PIN set. Use setChatPin to create one.");
  }

  const hash = await hashPinServer(pin, userData.pinSalt);
  if (hash !== userData.pinHash) throw new HttpsError("permission-denied", "Incorrect PIN");
  return { ok: true };
});

exports.resetChatPin = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "reset")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  await db.collection("users").doc(uid).set(
    { pinSalt: admin.firestore.FieldValue.delete(), pinHash: admin.firestore.FieldValue.delete(), pinResetAt: Date.now() },
    { merge: true }
  );
  return { ok: true };
});

// =============================================
// TWO-FACTOR AUTHENTICATION — Server-side PIN (PBKDF2)
// =============================================
exports.setTwoFactorPin = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "2fa-set")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin, oldPin } = request.data;
  if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin))
    throw new HttpsError("invalid-argument", "PIN must be 4-8 digits");

  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};
  if (userData.twofaPinHash && userData.twofaPinSalt) {
    if (!oldPin) throw new HttpsError("invalid-argument", "Old PIN required");
    const oldHash = await hashPinServer(oldPin, userData.twofaPinSalt);
    if (oldHash !== userData.twofaPinHash) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }

  const salt = crypto.randomBytes(32).toString("hex");
  const hash = await hashPinServer(pin, salt);
  await db.collection("users").doc(uid).set({ twofaPinSalt: salt, twofaPinHash: hash, twofaEnabled: true, twofaUpdatedAt: Date.now() }, { merge: true });
  return { ok: true };
});

exports.verifyTwoFactorPin = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "2fa-verify")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin } = request.data;
  if (!pin || typeof pin !== "string") throw new HttpsError("invalid-argument", "Missing PIN");

  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};

  if (!userData.twofaPinHash || !userData.twofaPinSalt) {
    throw new HttpsError("failed-precondition", "No 2FA PIN set. Use setTwoFactorPin to create one.");
  }

  const hash = await hashPinServer(pin, userData.twofaPinSalt);
  if (hash !== userData.twofaPinHash) throw new HttpsError("permission-denied", "Incorrect PIN");
  return { ok: true };
});

exports.resetTwoFactorPin = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "2fa-reset")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  await db.collection("users").doc(uid).set(
    {
      twofaPinSalt: admin.firestore.FieldValue.delete(),
      twofaPinHash: admin.firestore.FieldValue.delete(),
      twofaEnabled: false,
      twofaResetAt: Date.now()
    },
    { merge: true }
  );
  return { ok: true };
});

// =============================================
// ACCOUNT DELETION — Server-side cleanup
// =============================================
exports.deleteUserAccount = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) throw new HttpsError("not-found", "User not found");
  const userData = userDoc.data() || {};

  if (userData.deletionScheduledAt) {
    const scheduled = userData.deletionScheduledAt.toDate ? userData.deletionScheduledAt.toDate() : new Date(userData.deletionScheduledAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (scheduled < thirtyDaysAgo) {
      await db.collection("users").doc(uid).delete();
      return { ok: true, deleted: true };
    }
  }

  return { ok: true, deleted: false, message: "Account not yet eligible for permanent deletion" };
});
