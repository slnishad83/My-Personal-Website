"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { getDb, getAuth } = require("./admin");
const { checkRateLimit, validateCors } = require("./helpers");

exports.getTurnCredentials = onRequest(async (req, res) => {
  if (!checkRateLimit(req, res)) return;
  if (!validateCors(req, res)) return;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    await getAuth().verifyIdToken(token);

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

exports.sendNotificationReply = onRequest(async (req, res) => {
  if (!checkRateLimit(req, res)) return;
  if (!validateCors(req, res)) return;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    const { chatId, chatType, text, groupId } = req.body;

    if (!chatId || !text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing chatId or text" });
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0 || trimmedText.length > 5000) {
      return res.status(400).json({ error: "Text must be 1-5000 characters" });
    }

    const sanitizedText = trimmedText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    const validChatType = chatType === "group" ? "group" : "direct";
    const db = getDb();

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
    } catch (_) {}

    const msgData = {
      text: sanitizedText,
      senderId: decoded.uid,
      senderName: decoded.name || decoded.email || "User",
      timestamp: Date.now(),
      createdAt: Date.now(),
      status: "sent",
      readBy: { [decoded.uid]: true },
      chatId,
      chatType: validChatType,
      participants,
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let html = "";
    let finalUrl = url;
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

      // Validate final URL after redirects didn't go to a blocked host
      try {
        const finalParsed = new URL(resp.url || url);
        const finalHost = finalParsed.hostname.toLowerCase();
        for (const b of blocked) {
          if (finalHost === b || finalHost.startsWith(b)) {
            return res.status(400).json({ error: "Redirect target blocked" });
          }
        }
        finalUrl = resp.url || url;
      } catch (_) {}

      if (!resp.ok) {
        return res.json({ title: "", description: "", image: "", domain });
      }

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        return res.json({ title: "", description: "", image: "", domain });
      }

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
      return res.json({ title: "", description: "", image: "", domain });
    }

    const getMeta = (property) => {
      let match = html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"));
      if (match) return match[1].trim();
      match = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"));
      if (match) return match[1].trim();
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
      return getMeta("twitter:image:src");
    };

    // Use final URL domain (after redirects)
    let finalDomain = domain;
    try { finalDomain = new URL(finalUrl).hostname.replace("www.", ""); } catch (_) {}
    res.json({ title: getTitle(), description: getDescription(), image: getImage(), domain: finalDomain });
  } catch (error) {
    console.error("generateUrlPreview error:", error);
    res.status(500).json({ error: "Failed to generate preview" });
  }
});

exports.lookupVerifiedUserByEmailV2 = onRequest({ region: "asia-south1" }, async (req, res) => {
  if (!checkRateLimit(req, res)) return;
  if (!validateCors(req, res)) return;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const firebaseAuth = getAuth();
    const caller = await firebaseAuth.verifyIdToken(token);
    const callerRecord = await firebaseAuth.getUser(caller.uid);
    if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const email = (req.query && req.query.email) || (req.body && req.body.email);
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Missing email" });
    }

    const userRecord = await firebaseAuth.getUserByEmail(email);
    res.json({ uid: userRecord.uid, displayName: userRecord.displayName || "", verified: true });
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ error: "User not found" });
    }
    console.error("lookupVerifiedUserByEmailV2 error:", error);
    res.status(500).json({ error: "Lookup failed" });
  }
});

exports.repairGroupAccessMetadata = onRequest(async (req, res) => {
  if (!checkRateLimit(req, res)) return;
  if (!validateCors(req, res)) return;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const firebaseAuth = getAuth();
    const caller = await firebaseAuth.verifyIdToken(token);
    const callerRecord = await firebaseAuth.getUser(caller.uid);
    if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const db = getDb();
    let repaired = 0;
    const groupsSnap = await db.collection("groups").get();

    for (const groupDoc of groupsSnap.docs) {
      const groupId = groupDoc.id;
      const groupData = groupDoc.data();

      const membersSnap = await db.collection("groupMembers")
        .where("groupId", "==", groupId)
        .get();

      const actualMemberIds = membersSnap.docs.map(doc => doc.data().userId).filter(Boolean);
      const currentMemberIds = groupData.memberIds || [];

      const hasMismatch =
        actualMemberIds.length !== currentMemberIds.length ||
        !actualMemberIds.every(id => currentMemberIds.includes(id)) ||
        groupData.memberCount !== actualMemberIds.length;

      if (hasMismatch) {
        await db.collection("groups").doc(groupId).update({
          memberIds: actualMemberIds,
          members: actualMemberIds,
          memberCount: actualMemberIds.length
        });
        repaired++;
      }
    }

    res.json({ ok: true, repaired });
  } catch (error) {
    console.error("repairGroupAccessMetadata error:", error);
    res.status(500).json({ error: "Repair failed" });
  }
});
