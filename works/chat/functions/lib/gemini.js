"use strict";

const { defineSecret } = require("firebase-functions/params");
const { getDb } = require("./admin");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CB = {
  failures: 0,
  state: "closed",
  lastFailure: 0,
  threshold: 5,
  resetMs: 60000,
  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) this.state = "open";
  },
  recordSuccess() {
    this.failures = 0;
    this.state = "closed";
  },
  isAllowed() {
    if (this.state === "closed") return true;
    if (Date.now() - this.lastFailure > this.resetMs) {
      this.state = "half-open";
      return true;
    }
    return false;
  }
};

const FETCH_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

async function callGemini(prompt, apiKey) {
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Run: firebase functions:secrets:set GEMINI_API_KEY");
  }
  if (!CB.isAllowed()) {
    throw new Error("Gemini API circuit breaker open — too many failures, retrying later");
  }

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (resp.status === 429 || resp.status === 503) {
        lastErr = new Error(`Gemini API ${resp.status}: rate limited`);
        CB.recordFailure();
        continue;
      }
      if (!resp.ok) {
        const err = await resp.text();
        CB.recordFailure();
        throw new Error(`Gemini API error ${resp.status}: ${err}`);
      }
      CB.recordSuccess();
      const data = await resp.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (e.name === "AbortError") {
        lastErr = new Error("Gemini API request timed out");
      }
      CB.recordFailure();
    }
  }
  throw lastErr;
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
