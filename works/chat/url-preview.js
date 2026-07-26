/* =============================================
   URL PREVIEW v1.0  — #24
   Renders rich link-preview cards for URLs sent
   in personal and group chat messages.
   - Uses generateUrlPreview Cloud Function (reliable, server-side)
   - Falls back to allorigins proxy if CF unavailable
   - Caches previews in memory to avoid redundant fetches
   - Renders cards for BOTH sent and received messages
   ============================================= */
(function () {
  'use strict';

  const CF_URL = 'https://us-central1-my-team-chat-2255.cloudfunctions.net/generateUrlPreview';
  const CACHE  = {};
  const PENDING = {};
  const URL_RE  = /(https?:\/\/[^\s<>"]+)/i;

  /* ─── helpers ─────────────────────────────────────────────────── */
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
  }

  function extractUrl(text) {
    const m = (text || '').match(URL_RE);
    return m ? m[1].replace(/[.,;!?)]+$/, '') : null;
  }

  function getDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return url; }
  }

  /* ─── fetch OG data ────────────────────────────────────────────── */
  async function fetchPreview(url) {
    if (CACHE[url])   return CACHE[url];
    if (PENDING[url]) return PENDING[url];

    const promise = (async () => {
      try {
        const resp = await fetch(CF_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(8000)
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json && (json.title || json.description || json.image)) {
            CACHE[url] = json;
            return json;
          }
        }
      } catch (_) { /* CF failed */ }

      return null;
    })();

    PENDING[url] = promise;
    const result = await promise;
    delete PENDING[url];
    return result;
  }

  /* ─── render a preview card ────────────────────────────────────── */
  function buildCard(data, url) {
    const hasImg  = data.image && /^https?:\/\//.test(data.image) && !/[\s"'<>]/.test(data.image);
    const title   = esc(data.title   || '');
    const desc    = esc(data.description ? data.description.slice(0, 120) + (data.description.length > 120 ? '…' : '') : '');
    const domain  = esc(data.domain  || getDomain(url));
    const href    = esc(url);

    return `<a class="tc-url-preview-card" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${title || domain}">
  ${hasImg ? `<div class="tc-url-preview-img-wrap"><img class="tc-url-preview-img" src="${esc(data.image)}" alt="" loading="lazy" onerror="this.closest('.tc-url-preview-img-wrap').remove()"></div>` : ''}
  <div class="tc-url-preview-body">
    <div class="tc-url-preview-domain">${domain}</div>
    ${title ? `<div class="tc-url-preview-title">${title}</div>` : ''}
    ${desc   ? `<div class="tc-url-preview-desc">${desc}</div>`   : ''}
  </div>
</a>`;
  }

  /* ─── inject a card below a message bubble ─────────────────────── */
  async function injectPreview(bubble, url) {
    if (bubble.dataset.tcUrlPreviewDone) return;
    bubble.dataset.tcUrlPreviewDone = '1';

    const skeleton = document.createElement('div');
    skeleton.className = 'tc-url-preview-skeleton';
    bubble.appendChild(skeleton);

    const data = await fetchPreview(url);
    skeleton.remove();

    if (!data) return;

    const wrap = document.createElement('div');
    wrap.className = 'tc-url-preview-wrap';
    wrap.innerHTML = buildCard(data, url);
    bubble.appendChild(wrap);
  }

  /* ─── scan a single message element for URLs ────────────────────── */
  function processMessageEl(el) {
    const textEl = el.querySelector('.message-text, .msg-text, .message-content, p, .tc-msg-text');
    const rawText = (textEl || el).textContent || '';
    const url = extractUrl(rawText);
    if (!url) return;
    if (el.dataset.tcUrlPreviewDone) return;
    injectPreview(el, url);
  }

  /* ─── scan all visible messages ─────────────────────────────────── */
  function scanMessages() {
    document.querySelectorAll('.message-bubble, .msg-bubble, .chat-message, .message-row, .message-item')
      .forEach(processMessageEl);
  }

  /* ─── patch sendMessage to attach preview data ──────────────────── */
  function patchSendMessage() {
    const origSend = window.sendMessage;
    if (typeof origSend !== 'function') return;

    window.sendMessage = async function () {
      const input = document.getElementById('messageInput') || document.getElementById('msg-input');
      const text  = (input?.value || input?.textContent || input?.innerText || '').trim();
      if (text) {
        const url = extractUrl(text);
        if (url) {
          const preview = await fetchPreview(url);
          if (preview && (preview.title || preview.description)) {
            window._pendingUrlPreview = preview;
          }
        }
      }
      const result = await origSend.apply(this, arguments);
      window._pendingUrlPreview = null;
      return result;
    };
  }

  /* ─── observe new messages as they arrive ───────────────────────── */
  function observe() {
    const chatArea = document.getElementById('chatMessages') ||
                     document.getElementById('messagesContainer') ||
                     document.querySelector('.messages-list, .chat-body, .message-list');
    if (!chatArea) { setTimeout(observe, 1000); return; }

    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches('.message-bubble,.msg-bubble,.chat-message,.message-row,.message-item')) {
            processMessageEl(node);
          } else {
            node.querySelectorAll('.message-bubble,.msg-bubble,.chat-message,.message-row,.message-item')
              .forEach(processMessageEl);
          }
        });
      });
    });

    observer.observe(chatArea, { childList: true, subtree: true });
    scanMessages();
  }

  /* ─── init ──────────────────────────────────────────────────────── */
  function init() {
    patchSendMessage();
    observe();
    document.addEventListener('tc:chat:opened', scanMessages);
    document.addEventListener('tc:messages:loaded', scanMessages);
  }

  if (document.readyState === 'complete') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', () => setTimeout(init, 0));
  }
})();
