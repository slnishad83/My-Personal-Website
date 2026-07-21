"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

const ALLOWED_ORIGINS = [
  "https://my-team-chat-2255.web.app",
  "https://nishadsl.com",
  "http://localhost"
];

const rateLimitCache = new Map();
const LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS = 30;

function requireAuth(context) {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  return context.auth.uid;
}

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

module.exports = { requireAuth, checkRateLimit, validateCors };
