const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

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
function validateCors(req, res) {
  const origin = req.headers.origin || req.headers.referer || "";
  if (origin && !ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.set("Access-Control-Allow-Origin", ALLOWED_ORIGINS[0]);
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  res.set("Access-Control-Allow-Origin", "*");
  return true;
}

// =============================================
// HTTP: getTurnCredentials
// Returns TURN/STUN server credentials for WebRTC.
// In production, integrate with a TURN provider (e.g., Twilio, Metered).
// =============================================
exports.getTurnCredentials = onRequest(async (req, res) => {
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

    const validChatType = chatType === "group" ? "group" : "direct";

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
      text: trimmedText,
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
// =============================================
exports.generateUrlPreview = onRequest(async (req, res) => {
  if (!validateCors(req, res)) return;

  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing url" });
    }

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
exports.lookupVerifiedUserByEmailV2 = onRequest({ region: "asia-south1" }, async (req, res) => {
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
  if (!validateCors(req, res)) return;

  try {
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
exports.catchMeUp = onCall(async (request) => {
  requireAuth(request);
  const { chatId, chatType } = request.data;

  if (!chatId) {
    throw new HttpsError("invalid-argument", "Missing chatId");
  }

  // Stub: Return placeholder. Replace with AI summary (Gemini, OpenAI, etc.).
  return { summary: "<p>Summary unavailable. Open the chat to catch up.</p>" };
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

  // Stub: Return placeholder. Replace with Speech-to-Text API.
  return { text: "Transcription unavailable" };
});

// =============================================
// CALLABLE: aiChatBot
// AI chatbot that responds to @AI messages.
// =============================================
exports.aiChatBot = onCall(async (request) => {
  requireAuth(request);
  const { prompt, chatId, chatType, senderName } = request.data;

  if (!prompt || !chatId) {
    throw new HttpsError("invalid-argument", "Missing prompt or chatId");
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
exports.summarizeThread = onCall(async (request) => {
  requireAuth(request);
  const { messageId } = request.data;

  if (!messageId) {
    throw new HttpsError("invalid-argument", "Missing messageId");
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
