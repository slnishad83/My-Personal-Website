// ========================================
// AI ASSISTANT BOT — Powered by Google Gemini
// ========================================
// Trigger: Any message containing @AI or @AIBot (case-insensitive)
// Example: "@AI summarise today's messages" or "@AIBot explain this error"
//
// SETUP REQUIRED (one time):
//   1. Add your Gemini API key to Firebase Functions secrets:
//        firebase functions:secrets:set GEMINI_API_KEY
//   2. Deploy the Cloud Function:
//        firebase deploy --only functions:aiChatBot
//   3. That's it — the bot will start responding in any chat.

const AI_BOT_TRIGGER_RE = /@aibot\b|@ai\b/i;
const AI_BOT_UID = "ai-bot";
const AI_BOT_NAME = "AI Assistant";

function isAiBotTrigger(text) {
  return AI_BOT_TRIGGER_RE.test(text || "");
}

function extractAiBotPrompt(text) {
  return (text || "")
    .replace(/@aibot\b/gi, "")
    .replace(/@ai\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Add a temporary "thinking" bubble in the chat
function showAiBotThinkingBubble() {
  const area = document.getElementById("messagesArea");
  if (!area) return null;
  const id = `ai-thinking-${Date.now()}`;
  const div = document.createElement("div");
  div.id = id;
  div.className = "message ai-bot-message ai-bot-thinking";
  div.innerHTML = `
    <div class="message-bubble">
      <div class="message-sender ai-bot-sender">${AI_BOT_NAME}</div>
      <div class="message-text">
        <span class="ai-thinking-dot"></span>
        <span class="ai-thinking-dot"></span>
        <span class="ai-thinking-dot"></span>
      </div>
    </div>
  `;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
  return id;
}

function removeAiBotThinkingBubble(id) {
  if (id) document.getElementById(id)?.remove();
}

// Call the Firebase Cloud Function which calls Gemini and posts the reply
async function callAiBotFunction(prompt, chatId, chatType) {
  const projectId = (typeof firebaseConfig !== "undefined" && firebaseConfig.projectId)
    || firebase.app().options.projectId
    || "";

  if (!projectId) {
    throw new Error("Firebase project ID not found");
  }

  const region = "us-central1";
  const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/aiChatBot`;

  const idToken = await currentUser.getIdToken(false);

  const resp = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ prompt, chatId, chatType, senderName: currentUser.displayName || currentUser.email }),
    signal: AbortSignal.timeout(35000),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`AI function returned ${resp.status}: ${body}`);
  }
}

// Main entry — called from sendMessage after the user's message is saved
async function triggerAiBotIfMentioned(text, chatId, chatType) {
  if (!isAiBotTrigger(text)) return;

  const prompt = extractAiBotPrompt(text);
  if (!prompt) {
    showToast('Add a question after @AI — e.g. "@AI summarise the last 10 messages"');
    return;
  }

  const thinkingId = showAiBotThinkingBubble();

  try {
    await callAiBotFunction(prompt, chatId, chatType);
  } catch (err) {
    console.error("AI bot error:", err);
    showToast("AI Assistant is unavailable. Make sure the Cloud Function is deployed.", "error");
  } finally {
    removeAiBotThinkingBubble(thinkingId);
  }
}

// Show AI Bot status badge in the chat header when active
function renderAiBotPresenceBadge() {
  const header = document.getElementById("chatHeaderName");
  if (!header || header.querySelector(".ai-bot-badge")) return;
  const badge = document.createElement("span");
  badge.className = "ai-bot-badge";
  badge.title = "Type @AI to ask the AI assistant";
  badge.textContent = "AI";
  header.appendChild(badge);
}

// Expose globally so sendMessage can call it
window.triggerAiBotIfMentioned = triggerAiBotIfMentioned;
window.isAiBotTrigger = isAiBotTrigger;
