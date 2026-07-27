// ========================================
// AI ASSISTANT BOT â€” Powered by Google Gemini
// ========================================
// Trigger: Any message containing @AI or @AIBot (case-insensitive)
// Example: "@AI summarise today's messages" or "@AIBot explain this error"
//
// SETUP REQUIRED (one time):
//   1. Add your Gemini API key to Firebase Functions secrets:
//        firebase functions:secrets:set GEMINI_API_KEY
//   2. Deploy the Cloud Function:
//        firebase deploy --only functions:aiChatBot
//   3. That's it â€” the bot will start responding in any chat.

const AI_BOT_TRIGGER_RE = /@aibot\b|@ai\b/i;
const _AI_BOT_UID = "ai-bot";
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
// Uses httpsCallable â€” auth is handled automatically by the Firebase SDK
async function callAiBotFunction(prompt, chatId, chatType) {
  const functions = firebase.functions();
  // If you deployed to a non-default region, set it here:
  // firebase.app().functions("us-central1")
  const aiChatBot = functions.httpsCallable("aiChatBot", { timeout: 35000 });
  await aiChatBot({
    prompt,
    chatId,
    chatType,
    senderName: currentUser.displayName || currentUser.email || "User",
  });
}

// Main entry â€” called from sendMessage after the user's message is saved
async function triggerAiBotIfMentioned(text, chatId, chatType) {
  if (!isAiBotTrigger(text)) return;

  const prompt = extractAiBotPrompt(text);
  if (!prompt) {
    showToast('Add a question after @AI â€” e.g. "@AI summarise the last 10 messages"');
    return;
  }

  const thinkingId = showAiBotThinkingBubble();

  try {
    await callAiBotFunction(prompt, chatId, chatType);
  } catch (err) {
    if (window.__DEBUG__) console.error("AI bot error:", err);
    showToast("AI Assistant is unavailable. Make sure the Cloud Function is deployed.", "error");
  } finally {
    removeAiBotThinkingBubble(thinkingId);
  }
}

// Show AI Bot status badge in the chat header when active
function _renderAiBotPresenceBadge() {
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
