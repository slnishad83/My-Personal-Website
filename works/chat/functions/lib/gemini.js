"use strict";

const { defineSecret } = require("firebase-functions/params");
const { getDb } = require("./admin");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

async function fetchRecentMessages(chatId, count = 50) {
  const db = getDb();
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

function formatMessagesForPrompt(messages) {
  return messages.map(m => {
    const d = m.time ? new Date(m.time) : new Date();
    const ts = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return `[${ts}] ${m.sender}: ${m.text}`;
  }).join("\n");
}

module.exports = { GEMINI_API_KEY, callGemini, fetchRecentMessages, formatMessagesForPrompt };
