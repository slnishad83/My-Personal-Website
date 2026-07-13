const { onCall, onRequest } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { initializeApp } = require("firebase-admin/app");

initializeApp();

const db = getFirestore();
const auth = getAuth();

// =============================================
// HELPER: Verify authenticated request
// =============================================
function requireAuth(context) {
  if (!context.auth) {
    throw new Error("Unauthorized: Must be signed in.");
  }
  return context.auth.uid;
}

// =============================================
// HTTP: getTurnCredentials
// Returns TURN/STUN server credentials for WebRTC.
// In production, integrate with a TURN provider (e.g., Twilio, Metered).
// =============================================
exports.getTurnCredentials = onRequest({ cors: true }, async (req, res) => {
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

    // TODO: Integrate with TURN provider
    // const turnCredentials = await fetchTurnCredentials(decoded.uid);
    // iceServers.push(...turnCredentials);

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
exports.sendNotificationReply = onRequest({ cors: true }, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = await auth.verifyIdToken(token);
    const { chatId, chatType, text, groupId } = req.body;

    if (!chatId || !text) {
      return res.status(400).json({ error: "Missing chatId or text" });
    }

    const msgData = {
      text: text.trim(),
      senderId: decoded.uid,
      senderName: decoded.name || decoded.email || "User",
      timestamp: Date.now(),
      createdAt: Date.now(),
      status: "sent",
      readBy: { [decoded.uid]: true },
      chatId: chatId,
      chatType: chatType || "direct",
      participants: [decoded.uid],
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
// In production, parse the HTML and extract og: tags.
// =============================================
exports.generateUrlPreview = onRequest({ cors: true }, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing url" });
    }

    // Stub: Return empty preview. Replace with real HTML parsing.
    const domain = new URL(url).hostname.replace("www.", "");
    res.json({
      title: "",
      description: "",
      image: "",
      domain: domain
    });
  } catch (error) {
    console.error("generateUrlPreview error:", error);
    res.status(500).json({ error: "Failed to generate preview" });
  }
});

// =============================================
// HTTP: lookupVerifiedUserByEmailV2
// Looks up a user by email for verification.
// =============================================
exports.lookupVerifiedUserByEmailV2 = onRequest(
  { region: "asia-south1", cors: true },
  async (req, res) => {
    try {
      const { email } = req.query || req.body;
      if (!email) {
        return res.status(400).json({ error: "Missing email" });
      }

      const userRecord = await auth.getUserByEmail(email);
      res.json({
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName || "",
        photoURL: userRecord.photoURL || "",
        verified: true
      });
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        return res.status(404).json({ error: "User not found" });
      }
      console.error("lookupVerifiedUserByEmailV2 error:", error);
      res.status(500).json({ error: "Lookup failed" });
    }
  }
);

// =============================================
// HTTP: repairGroupAccessMetadata
// Repairs group membership metadata inconsistencies.
// =============================================
exports.repairGroupAccessMetadata = onRequest({ cors: true }, async (req, res) => {
  try {
    // Stub: No-op. Implement batch repair logic as needed.
    res.json({ ok: true, repaired: 0 });
  } catch (error) {
    console.error("repairGroupAccessMetadata error:", error);
    res.status(500).json({ error: "Repair failed" });
  }
});

// =============================================
// CALLABLE: catchMeUp
// AI-powered summary of missed messages in a chat.
// =============================================
exports.catchMeUp = onCall({ timeoutSeconds: 30 }, async (request) => {
  const uid = requireAuth(request);
  const { chatId, chatType } = request.data;

  if (!chatId) {
    throw new Error("Missing chatId");
  }

  // Stub: Return placeholder. Replace with AI summary (Gemini, OpenAI, etc.).
  return { summary: "<p>Summary unavailable. Open the chat to catch up.</p>" };
});

// =============================================
// CALLABLE: transcribeVoiceMessage
// Transcribes voice message audio to text.
// =============================================
exports.transcribeVoiceMessage = onCall({ timeoutSeconds: 30 }, async (request) => {
  const uid = requireAuth(request);
  const { messageId, audioUrl } = request.data;

  if (!messageId || !audioUrl) {
    throw new Error("Missing messageId or audioUrl");
  }

  // Stub: Return placeholder. Replace with Speech-to-Text API.
  return { text: "Transcription unavailable" };
});

// =============================================
// CALLABLE: aiChatBot
// AI chatbot that responds to @AI messages.
// In production, calls Gemini or OpenAI API.
// =============================================
exports.aiChatBot = onCall({ timeoutSeconds: 35 }, async (request) => {
  const uid = requireAuth(request);
  const { prompt, chatId, chatType, senderName } = request.data;

  if (!prompt || !chatId) {
    throw new Error("Missing prompt or chatId");
  }

  // Stub: Post a placeholder response. Replace with AI API call.
  const replyText = "AI bot is not configured yet. Please set up an AI provider.";

  await db.collection("messages").add({
    text: replyText,
    senderId: "ai-bot",
    senderName: "AI Bot",
    timestamp: Date.now(),
    createdAt: Date.now(),
    status: "sent",
    readBy: {},
    chatId: chatId,
    chatType: chatType || "direct",
    participants: []
  });

  return { ok: true };
});

// =============================================
// CALLABLE: summarizeThread
// Generates an AI summary of a threaded conversation.
// =============================================
exports.summarizeThread = onCall({ timeoutSeconds: 30 }, async (request) => {
  const uid = requireAuth(request);
  const { messageId } = request.data;

  if (!messageId) {
    throw new Error("Missing messageId");
  }

  // Stub: Return placeholder. Replace with AI summarization.
  return { summary: "Thread summary unavailable. Please read the thread manually." };
});

// =============================================
// CALLABLE: leaveGroup
// Removes the current user from a group chat.
// =============================================
exports.leaveGroup = onCall(async (request) => {
  const uid = requireAuth(request);
  const { groupId } = request.data;

  if (!groupId) {
    throw new Error("Missing groupId");
  }

  const groupRef = db.collection("groups").doc(groupId);
  const groupDoc = await groupRef.get();

  if (!groupDoc.exists) {
    throw new Error("Group not found");
  }

  const data = groupDoc.data();
  if (!data.memberIds || !data.memberIds.includes(uid)) {
    throw new Error("You are not a member of this group");
  }

  await groupRef.update({
    memberIds: require("firebase-admin/firestore").FieldValue.arrayRemove(uid)
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

  // Verify caller is admin
  const callerRecord = await auth.getUser(uid);
  if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
    throw new Error("Unauthorized: Admin only");
  }

  if (!targetUid) {
    throw new Error("Missing targetUid");
  }

  await auth.deleteUser(targetUid);
  await db.collection("users").doc(targetUid).delete();

  return { ok: true };
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
    throw new Error("Unauthorized: Admin only");
  }

  if (!targetUid) {
    throw new Error("Missing targetUid");
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
    throw new Error("Unauthorized: Admin only");
  }

  if (!targetUid) {
    throw new Error("Missing targetUid");
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
