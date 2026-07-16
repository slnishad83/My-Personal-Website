/* =============================================
   AI-POWERED FEATURES v1.0
   Chat Summarizer | Meeting Notes | Tone Analyzer
   Auto Tagging | AI-Assisted Search
   ============================================= */
(function () {
  'use strict';

  /* ─── State ─────────────────────────────────────────────────────── */
  let _toneCheckPending = false;
  let _toneCheckResult = null;
  let _toneDebounce = null;
  let _lastAnalyzedText = '';
  let _chatTags = {}; // { chatId: { tags: [], confidence: 0 } }
  let _summaryPanel = null;

  /* ─── CSS Injection ──────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('ai-features-css')) return;
    const style = document.createElement('style');
    style.id = 'ai-features-css';
    style.textContent = `
      /* ── Tone Analyzer Banner ──────────────────────────── */
      .tone-banner {
        display: none;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        border-top: 1px solid var(--outline-variant);
        background: var(--surface-container);
        animation: toneSlideIn 0.25s ease;
      }
      .tone-banner.visible { display: flex; }
      .tone-banner.safe { border-top-color: #00a884; }
      .tone-banner.warning { border-top-color: #f59e0b; background: #f59e0b10; }
      .tone-banner.danger { border-top-color: #ef4444; background: #ef444410; }
      .tone-banner-icon { font-size: 18px; flex-shrink: 0; }
      .tone-banner-text { flex: 1; color: var(--on-surface-variant); }
      .tone-banner-text strong { color: var(--on-surface); }
      .tone-banner-dismiss {
        background: none; border: none; cursor: pointer;
        color: var(--on-surface-variant); padding: 4px;
        border-radius: 50%; transition: all 0.2s;
      }
      .tone-banner-dismiss:hover { background: var(--surface-variant); }
      .tone-badge {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 8px; border-radius: 12px; font-size: 11px;
        font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
      }
      .tone-badge.friendly { background: #00a88420; color: #00a884; }
      .tone-badge.neutral { background: #8696a020; color: #8696a0; }
      .tone-badge.formal { background: #53bdeb20; color: #53bdeb; }
      .tone-badge.rude { background: #f59e0b20; color: #f59e0b; }
      .tone-badge.aggressive { background: #ef444420; color: #ef4444; }
      .tone-badge.passive-aggressive { background: #a855f720; color: #a855f7; }
      .tone-badge.sarcastic { background: #f9731620; color: #f97316; }

      @keyframes toneSlideIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* ── Summary Panel ─────────────────────────────────── */
      .ai-summary-panel {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: min(520px, 92vw); max-height: 80vh;
        background: var(--surface-container-low); border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4); z-index: 9999;
        display: none; flex-direction: column; overflow: hidden;
        border: 1px solid var(--outline-variant);
        animation: panelIn 0.25s ease;
      }
      .ai-summary-panel.visible { display: flex; }
      .ai-summary-panel-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 20px 24px; border-bottom: 1px solid var(--outline-variant);
      }
      .ai-summary-panel-header h3 {
        font-size: 17px; font-weight: 700; color: var(--on-surface);
        display: flex; align-items: center; gap: 8px;
      }
      .ai-summary-panel-header h3 .material-symbols-outlined {
        color: var(--primary); font-size: 22px;
      }
      .ai-summary-panel-close {
        background: none; border: none; cursor: pointer;
        color: var(--on-surface-variant); padding: 8px;
        border-radius: 50%; transition: all 0.2s;
      }
      .ai-summary-panel-close:hover { background: var(--surface-variant); }
      .ai-summary-panel-body {
        flex: 1; overflow-y: auto; padding: 20px 24px;
        font-size: 14px; line-height: 1.7; color: var(--on-surface);
      }
      .ai-summary-panel-body h1, .ai-summary-panel-body h2, .ai-summary-panel-body h3 {
        font-size: 16px; font-weight: 700; margin: 16px 0 8px; color: var(--on-surface);
      }
      .ai-summary-panel-body ul, .ai-summary-panel-body ol {
        padding-left: 20px; margin: 8px 0;
      }
      .ai-summary-panel-body li { margin: 4px 0; }
      .ai-summary-panel-body strong { color: var(--primary); }
      .ai-summary-panel-body p { margin: 8px 0; }
      .ai-summary-panel-footer {
        display: flex; gap: 8px; padding: 16px 24px;
        border-top: 1px solid var(--outline-variant);
      }
      .ai-panel-btn {
        padding: 8px 16px; border-radius: 12px; font-size: 13px;
        font-weight: 600; cursor: pointer; transition: all 0.2s;
        border: none; display: flex; align-items: center; gap: 6px;
      }
      .ai-panel-btn-primary { background: var(--primary); color: var(--on-primary); }
      .ai-panel-btn-primary:hover { filter: brightness(1.1); }
      .ai-panel-btn-secondary {
        background: var(--surface-variant); color: var(--on-surface-variant);
      }
      .ai-panel-btn-secondary:hover { background: var(--surface-container-highest); }
      .ai-panel-btn .material-symbols-outlined { font-size: 16px; }

      .ai-summary-loading {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 12px; padding: 40px; color: var(--on-surface-variant);
      }
      .ai-summary-loading .spinner {
        width: 32px; height: 32px; border: 3px solid var(--outline-variant);
        border-top-color: var(--primary); border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      @keyframes panelIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }

      .ai-summary-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        z-index: 9998; display: none; animation: fadeIn 0.2s;
      }
      .ai-summary-backdrop.visible { display: block; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

      /* ── Chat Tags ─────────────────────────────────────── */
      .chat-tag {
        display: inline-flex; align-items: center; gap: 3px;
        padding: 2px 7px; border-radius: 8px; font-size: 10px;
        font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
        line-height: 1.3; margin-left: 4px;
      }
      .chat-tag.Work { background: #3b82f620; color: #3b82f6; }
      .chat-tag.Family { background: #ec489920; color: #ec4899; }
      .chat-tag.Friends { background: #8b5cf620; color: #8b5cf6; }
      .chat-tag.Urgent { background: #ef444420; color: #ef4444; }
      .chat-tag.Project { background: #06b6d420; color: #06b6d4; }
      .chat-tag.Support { background: #f9731620; color: #f97316; }
      .chat-tag.Sales { background: #10b98120; color: #10b981; }
      .chat-tag.Marketing { background: #a855f720; color: #a855f7; }
      .chat-tag.Finance { background: #eab30820; color: #eab308; }
      .chat-tag.HR { background: #0ea5e920; color: #0ea5e9; }
      .chat-tag.IT { background: #6366f120; color: #6366f1; }
      .chat-tag.General { background: #8696a020; color: #8696a0; }
      .chat-tag.Social { background: #14b8a620; color: #14b8a6; }
      .chat-tag.Updates { background: #78716c20; color: #78716c; }

      .chat-tag-row {
        display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px;
      }

      /* ── AI Search Toggle ───────────────────────────────── */
      .ai-search-toggle {
        display: flex; align-items: center; gap: 6px;
        padding: 6px 12px; border-radius: 20px; font-size: 12px;
        font-weight: 600; cursor: pointer; transition: all 0.2s;
        border: 1px solid var(--outline-variant);
        background: var(--surface-variant); color: var(--on-surface-variant);
      }
      .ai-search-toggle.active {
        background: var(--primary); color: var(--on-primary);
        border-color: var(--primary);
      }
      .ai-search-toggle .material-symbols-outlined { font-size: 14px; }

      /* ── Summary Button in Header ────────────────────────── */
      .ai-header-btn {
        position: relative;
      }
      .ai-header-btn::after {
        content: 'AI';
        position: absolute; top: 2px; right: 2px;
        font-size: 8px; font-weight: 800;
        background: var(--primary); color: var(--on-primary);
        padding: 1px 3px; border-radius: 4px;
        line-height: 1; letter-spacing: 0.02em;
      }
    `;
    document.head.appendChild(style);
  }

  /* ─── Simple Markdown → HTML ────────────────────────────────────── */
  function mdToHtml(md) {
    if (!md) return '';
    return md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^(.+)$/gm, (m) => m.startsWith('<') ? m : `<p>${m}</p>`);
  }

  /* ═══════════════════════════════════════════════════════════════════
     FEATURE 1: CHAT SUMMARIZER
     ═══════════════════════════════════════════════════════════════════ */

  function addSummarizeButton() {
    const header = document.getElementById('header-actions-container');
    if (!header || document.getElementById('ai-summarize-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'ai-summarize-btn';
    btn.className = 'ai-header-btn text-on-surface-variant hover:text-primary transition-all p-2 rounded-full hover:bg-surface-container/50';
    btn.title = 'AI: Summarize this chat';
    btn.setAttribute('aria-label', 'Summarize chat with AI');
    btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>';
    btn.addEventListener('click', openSummaryPanel);
    header.insertBefore(btn, header.firstChild);
  }

  function createSummaryPanel() {
    if (_summaryPanel) return _summaryPanel;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'ai-summary-backdrop';
    backdrop.id = 'ai-summary-backdrop';
    backdrop.addEventListener('click', closeSummaryPanel);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'ai-summary-panel';
    panel.id = 'ai-summary-panel';
    panel.innerHTML = `
      <div class="ai-summary-panel-header">
        <h3><span class="material-symbols-outlined">auto_awesome</span> <span id="ai-summary-title">Chat Summary</span></h3>
        <button class="ai-summary-panel-close" onclick="window.AIFeatures.closeSummary()" aria-label="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="ai-summary-panel-body" id="ai-summary-body">
        <div class="ai-summary-loading"><div class="spinner"></div><span>Analyzing messages...</span></div>
      </div>
      <div class="ai-summary-panel-footer">
        <button class="ai-panel-btn ai-panel-btn-secondary" onclick="window.AIFeatures.closeSummary()">
          <span class="material-symbols-outlined">close</span> Close
        </button>
        <button class="ai-panel-btn ai-panel-btn-primary" id="ai-summary-copy-btn" onclick="window.AIFeatures.copySummary()">
          <span class="material-symbols-outlined">content_copy</span> Copy
        </button>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    _summaryPanel = panel;
    return panel;
  }

  async function openSummaryPanel() {
    const chatId = window.currentChat?.id || window.App?.currentChatId;
    if (!chatId) {
      if (typeof showToast === 'function') showToast('Open a chat first to summarize it.', 'info');
      return;
    }

    const isGroup = !!(window.currentGroup || window.currentChatType === 'group');
    createSummaryPanel();

    const title = document.getElementById('ai-summary-title');
    const body = document.getElementById('ai-summary-body');
    if (title) title.textContent = isGroup ? 'Meeting Notes' : 'Chat Summary';
    if (body) body.innerHTML = '<div class="ai-summary-loading"><div class="spinner"></div><span>Analyzing messages...</span></div>';

    document.getElementById('ai-summary-backdrop')?.classList.add('visible');
    _summaryPanel?.classList.add('visible');

    try {
      const functions = firebase.functions();
      const fnName = isGroup ? 'generateMeetingNotes' : 'catchMeUp';
      const fn = functions.httpsCallable(fnName, { timeout: 60000 });
      const result = await fn({ chatId, messageCount: isGroup ? 100 : 50 });

      const content = isGroup ? (result.data.notes || '') : (result.data.summary || '');
      if (body) {
        if (content) {
          body.innerHTML = mdToHtml(content);
        } else {
          body.innerHTML = '<p style="text-align:center;color:var(--on-surface-variant);padding:20px;">No summary available.</p>';
        }
      }
    } catch (err) {
      console.error('[AIFeatures] Summary error:', err);
      if (body) {
        const msg = err.message?.includes('API key')
          ? 'AI not configured. Admin: run <code>firebase functions:secrets:set GEMINI_API_KEY</code>'
          : 'Failed to generate summary. Please try again.';
        body.innerHTML = `<p style="text-align:center;color:var(--error);padding:20px;">${msg}</p>`;
      }
    }
  }

  function closeSummaryPanel() {
    _summaryPanel?.classList.remove('visible');
    document.getElementById('ai-summary-backdrop')?.classList.remove('visible');
  }

  function copySummary() {
    const body = document.getElementById('ai-summary-body');
    if (!body) return;
    const text = body.innerText || body.textContent;
    navigator.clipboard.writeText(text).then(() => {
      if (typeof showToast === 'function') showToast('Summary copied to clipboard', 'success');
    }).catch(() => {});
  }

  /* ═══════════════════════════════════════════════════════════════════
     FEATURE 2: TONE ANALYZER
     ═══════════════════════════════════════════════════════════════════ */

  function addToneBanner() {
    const inputBar = document.getElementById('input-bar');
    if (!inputBar || document.getElementById('tone-banner')) return;

    const banner = document.createElement('div');
    banner.className = 'tone-banner';
    banner.id = 'tone-banner';
    banner.innerHTML = `
      <span class="tone-banner-icon" id="tone-icon">⚠️</span>
      <span class="tone-banner-text" id="tone-text"></span>
      <span class="tone-badge" id="tone-badge"></span>
      <button class="tone-banner-dismiss" onclick="window.AIFeatures.dismissTone()" aria-label="Dismiss">
        <span class="material-symbols-outlined" style="font-size:16px">close</span>
      </button>
    `;
    inputBar.parentNode.insertBefore(banner, inputBar);
  }

  function analyzeTone(text) {
    if (!text || text.length < 10) {
      hideToneBanner();
      return;
    }

    // Don't re-analyze same text
    if (text === _lastAnalyzedText) return;
    _lastAnalyzedText = text;

    clearTimeout(_toneDebounce);
    _toneDebounce = setTimeout(async () => {
      try {
        const functions = firebase.functions();
        const analyzeToneFn = functions.httpsCallable('analyzeTone', { timeout: 15000 });
        const result = await analyzeToneFn({
          text,
          chatType: window.currentChatType || 'direct'
        });

        _toneCheckResult = result.data;
        showToneBanner(result.data);
      } catch (err) {
        // Silently fail — don't annoy user
        console.warn('[AIFeatures] Tone check failed:', err.message);
      }
    }, 1500); // 1.5s debounce
  }

  function showToneBanner(data) {
    const banner = document.getElementById('tone-banner');
    const icon = document.getElementById('tone-icon');
    const text = document.getElementById('tone-text');
    const badge = document.getElementById('tone-badge');
    if (!banner || !data) return;

    if (data.safe && !data.warning) {
      hideToneBanner();
      return;
    }

    banner.classList.remove('safe', 'warning', 'danger');
    banner.classList.add('visible');

    if (data.warning) {
      banner.classList.add(data.safe ? 'warning' : 'danger');
      icon.textContent = data.safe ? '⚠️' : '🚫';
      text.innerHTML = `<strong>Tone advisory:</strong> ${data.warning}`;
    } else {
      banner.classList.add('safe');
      icon.textContent = '✅';
      text.innerHTML = `<strong>Tone looks good</strong> — ${data.tone || 'neutral'}`;
    }

    if (badge && data.tone) {
      badge.className = 'tone-badge ' + (data.tone || 'neutral');
      badge.textContent = data.tone || 'neutral';
    }
  }

  function hideToneBanner() {
    const banner = document.getElementById('tone-banner');
    if (banner) banner.classList.remove('visible');
    _toneCheckResult = null;
  }

  function dismissTone() {
    hideToneBanner();
  }

  function checkBeforeSend(text) {
    if (_toneCheckResult && !_toneCheckResult.safe) {
      return new Promise((resolve) => {
        if (typeof showModal === 'function') {
          showModal(
            '⚠️ Tone Warning',
            `This message may come across as <strong>${_toneCheckResult.tone}</strong>.${_toneCheckResult.warning ? '<br><br>' + _toneCheckResult.warning : ''}<br><br>Send anyway?`,
            [
              { text: 'Edit', class: 'secondary', action: () => resolve(false) },
              { text: 'Send Anyway', class: 'primary', action: () => resolve(true) }
            ]
          );
        } else {
          // Fallback: confirm dialog
          resolve(confirm(`This message may sound ${_toneCheckResult.tone}. Send anyway?`));
        }
      });
    }
    return Promise.resolve(true);
  }

  /* ═══════════════════════════════════════════════════════════════════
     FEATURE 3: AUTO TAGGING
     ═══════════════════════════════════════════════════════════════════ */

  async function autoTagChat(chatId, chatName) {
    if (!chatId || _chatTags[chatId]) return _chatTags[chatId];

    try {
      const functions = firebase.functions();
      const autoTag = functions.httpsCallable('autoTagChat', { timeout: 20000 });
      const result = await autoTag({ chatId, chatName });
      if (result.data && result.data.tags) {
        _chatTags[chatId] = result.data;
        // Persist to localStorage
        try {
          localStorage.setItem('ai_chat_tags', JSON.stringify(_chatTags));
        } catch (_) {}
        return result.data;
      }
    } catch (err) {
      console.warn('[AIFeatures] Auto-tag failed:', err.message);
    }
    return null;
  }

  function renderChatTags(chatId, container) {
    const tagData = _chatTags[chatId];
    if (!tagData || !tagData.tags || !tagData.tags.length || !container) return;

    // Remove existing tags
    container.querySelectorAll('.chat-tag-row').forEach(el => el.remove());

    const row = document.createElement('div');
    row.className = 'chat-tag-row';
    tagData.tags.slice(0, 3).forEach(tag => {
      const span = document.createElement('span');
      span.className = `chat-tag ${tag}`;
      span.textContent = tag;
      row.appendChild(span);
    });
    container.appendChild(row);
  }

  function loadCachedTags() {
    try {
      const cached = JSON.parse(localStorage.getItem('ai_chat_tags') || '{}');
      _chatTags = cached;
    } catch (_) {}
  }

  function tagVisibleChats() {
    const chatItems = document.querySelectorAll('.chat-list-item[data-chat-id]');
    chatItems.forEach(item => {
      const chatId = item.dataset.chatId;
      if (!chatId || _chatTags[chatId]) {
        // Already tagged, render
        const nameEl = item.querySelector('.chat-name, .font-bold, h3');
        if (nameEl && _chatTags[chatId]) {
          renderChatTags(chatId, nameEl.parentNode);
        }
        return;
      }
      // Queue for tagging (don't spam)
      const nameEl = item.querySelector('.chat-name, .font-bold, h3');
      const chatName = nameEl?.textContent || '';
      if (chatName) {
        autoTagChat(chatId, chatName).then(result => {
          if (result && result.tags) renderChatTags(chatId, nameEl.parentNode);
        });
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     FEATURE 4: AI-ASSISTED SEARCH
     ═══════════════════════════════════════════════════════════════════ */

  let _aiSearchActive = false;

  function addAiSearchToggle() {
    // Will be called after message-search.js initializes
    const searchInput = document.getElementById('globalSearchInput');
    if (!searchInput || document.getElementById('ai-search-toggle')) return;

    const wrapper = searchInput.parentNode;
    if (!wrapper) return;

    const toggle = document.createElement('button');
    toggle.id = 'ai-search-toggle';
    toggle.className = 'ai-search-toggle';
    toggle.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span> AI Rank';
    toggle.title = 'Enable AI-powered semantic ranking';
    toggle.addEventListener('click', () => {
      _aiSearchActive = !_aiSearchActive;
      toggle.classList.toggle('active', _aiSearchActive);
      toggle.setAttribute('aria-pressed', _aiSearchActive);
      if (typeof showToast === 'function') {
        showToast(_aiSearchActive ? 'AI search ranking enabled' : 'AI search ranking disabled', 'info');
      }
    });
    wrapper.style.position = 'relative';
    wrapper.appendChild(toggle);
  }

  /* ═══════════════════════════════════════════════════════════════════
     FEATURE 5: MEETING NOTES (uses summary panel)
     ═══════════════════════════════════════════════════════════════════ */
  // Meeting notes are handled by the summary panel —
  // when a group chat is open, the summarize button
  // automatically calls generateMeetingNotes instead of catchMeUp.

  /* ═══════════════════════════════════════════════════════════════════
     INTEGRATION: Hook into existing sendMessage flow
     ═══════════════════════════════════════════════════════════════════ */

  function hookSendMessage() {
    const origSend = window.sendMessage;
    if (origSend && !origSend._aiHooked) {
      window.sendMessage = async function (...args) {
        // Check tone before sending
        const input = document.getElementById('msg-input');
        const text = input?.value?.trim();
        if (text && _toneCheckResult && !_toneCheckResult.safe) {
          const proceed = await checkBeforeSend(text);
          if (!proceed) return;
        }
        hideToneBanner();
        _lastAnalyzedText = '';
        return origSend.apply(this, args);
      };
      window.sendMessage._aiHooked = true;
    }
  }

  function hookInputListener() {
    const input = document.getElementById('msg-input');
    if (!input || input._aiToneHooked) return;
    input._aiToneHooked = true;

    input.addEventListener('input', () => {
      const text = input.value.trim();
      if (text.length > 15) {
        analyzeTone(text);
      } else {
        hideToneBanner();
        _lastAnalyzedText = '';
      }
    });
  }

  function hookChatListRender() {
    // Watch for chat list mutations to tag chats
    const chatList = document.getElementById('chat-list');
    if (!chatList || chatList._aiTagObserver) return;

    chatList._aiTagObserver = new MutationObserver(() => {
      clearTimeout(chatList._aiTagTimer);
      chatList._aiTagTimer = setTimeout(tagVisibleChats, 800);
    });
    chatList._aiTagObserver.observe(chatList, { childList: true, subtree: true });
  }

  /* ═══════════════════════════════════════════════════════════════════
     INITIALIZATION
     ═══════════════════════════════════════════════════════════════════ */

  function init() {
    injectStyles();
    loadCachedTags();
    addSummarizeButton();
    addToneBanner();
    hookSendMessage();
    hookInputListener();

    // Delayed inits for elements that may not exist yet
    setTimeout(() => {
      addAiSearchToggle();
      hookChatListRender();
      tagVisibleChats();
    }, 2000);

    // Re-hook on chat changes
    document.addEventListener('nsl:app-ready', () => {
      setTimeout(() => {
        addSummarizeButton();
        addToneBanner();
        hookSendMessage();
        hookInputListener();
      }, 500);
    });
  }

  // Expose API
  window.AIFeatures = {
    openSummary: openSummaryPanel,
    closeSummary: closeSummaryPanel,
    copySummary,
    dismissTone,
    autoTagChat,
    getChatTags: (chatId) => _chatTags[chatId],
    isAiSearchActive: () => _aiSearchActive,
    analyzeTone
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
