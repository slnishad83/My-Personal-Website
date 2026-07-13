const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// =============================================
// HELPER: Verify authenticated request
// =============================================
function requireAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }
  return context.auth.uid;
}

// =============================================
// HTTP: getTurnCredentials
// Returns TURN/STUN server credentials for WebRTC.
// In production, integrate with a TURN provider (e.g., Twilio, Metered).
// =============================================
exports.getTurnCredentials = functions.https.onRequest(async (req, res) => {
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
exports.sendNotificationReply = functions.https.onRequest(async (req, res) => {
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
// =============================================
exports.generateUrlPreview = functions.https.onRequest(async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing url" });
    }

    // Stub: Return empty preview. Replace with real HTML parsing.
    let domain = "";
    try {
      domain = new URL(url).hostname.replace("www.", "");
    } catch (_) {}

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
exports.lookupVerifiedUserByEmailV2 = functions.region("asia-south1").https.onRequest(async (req, res) => {
  try {
    const email = (req.query && req.query.email) || (req.body && req.body.email);
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
});

// =============================================
// HTTP: repairGroupAccessMetadata
// Repairs group membership metadata inconsistencies.
// =============================================
exports.repairGroupAccessMetadata = functions.https.onRequest(async (req, res) => {
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
exports.catchMeUp = functions.https.onCall(async (data, context) => {
  requireAuth(context);
  const { chatId, chatType } = data;

  if (!chatId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing chatId");
  }

  // Stub: Return placeholder. Replace with AI summary (Gemini, OpenAI, etc.).
  return { summary: "<p>Summary unavailable. Open the chat to catch up.</p>" };
});

// =============================================
// CALLABLE: transcribeVoiceMessage
// Transcribes voice message audio to text.
// =============================================
exports.transcribeVoiceMessage = functions.https.onCall(async (data, context) => {
  requireAuth(context);
  const { messageId, audioUrl } = data;

  if (!messageId || !audioUrl) {
    throw new functions.https.HttpsError("invalid-argument", "Missing messageId or audioUrl");
  }

  // Stub: Return placeholder. Replace with Speech-to-Text API.
  return { text: "Transcription unavailable" };
});

// =============================================
// CALLABLE: aiChatBot
// AI chatbot that responds to @AI messages.
// =============================================
exports.aiChatBot = functions.https.onCall(async (data, context) => {
  requireAuth(context);
  const { prompt, chatId, chatType, senderName } = data;

  if (!prompt || !chatId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing prompt or chatId");
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
exports.summarizeThread = functions.https.onCall(async (data, context) => {
  requireAuth(context);
  const { messageId } = data;

  if (!messageId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing messageId");
  }

  // Stub: Return placeholder. Replace with AI summarization.
  return { summary: "Thread summary unavailable. Please read the thread manually." };
});

// =============================================
// CALLABLE: leaveGroup
// Removes the current user from a group chat.
// =============================================
exports.leaveGroup = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { groupId } = data;

  if (!groupId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing groupId");
  }

  const groupRef = db.collection("groups").doc(groupId);
  const groupDoc = await groupRef.get();

  if (!groupDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Group not found");
  }

  const groupData = groupDoc.data();
  if (!groupData.memberIds || !groupData.memberIds.includes(uid)) {
    throw new functions.https.HttpsError("failed-precondition", "You are not a member of this group");
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
exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { targetUid } = data;

  // Verify caller is admin
  const callerRecord = await auth.getUser(uid);
  if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  if (!targetUid) {
    throw new functions.https.HttpsError("invalid-argument", "Missing targetUid");
  }

  await auth.deleteUser(targetUid);
  await db.collection("users").doc(targetUid).delete();

  return { ok: true };
});

// =============================================
// CALLABLE: adminBanUser
// Bans a user (admin only).
// =============================================
exports.adminBanUser = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { targetUid, reason } = data;

  const callerRecord = await auth.getUser(uid);
  if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  if (!targetUid) {
    throw new functions.https.HttpsError("invalid-argument", "Missing targetUid");
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
exports.adminUnbanUser = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { targetUid } = data;

  const callerRecord = await auth.getUser(uid);
  if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  if (!targetUid) {
    throw new functions.https.HttpsError("invalid-argument", "Missing targetUid");
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
