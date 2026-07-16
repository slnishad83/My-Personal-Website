/**
 * In-chat Translation (Feature 6)
 * Adds a translate option to the message context menu.
 */

(function () {
  const translationsCache = {};

  function initTranslation() {
    // 1. Hook into openChatMenu to add "Translate" option
    if (window.MutationBus) {
      window.MutationBus.onBodyChildList('inject-translate-btn', () => {
        const menu = document.getElementById('_msg-ctx-menu');
        if (menu && !menu.querySelector('.translate-msg-injected')) {
          // Find the msgId from the reply button
          const replyBtn = Array.from(menu.querySelectorAll('button')).find(b => b.innerHTML.includes('Reply'));
          if (replyBtn) {
            const match = replyBtn.getAttribute('onclick')?.match(/replyToMsg\('([^']+)'\)/);
            if (match && match[1]) {
              const msgId = match[1];
              // Only inject if it's a text message (check DOM)
              const msgEl = document.getElementById(`msg-${msgId}`);
              if (msgEl && msgEl.textContent.trim().length > 0) {
                injectTranslateButton(menu, msgId);
              }
            }
          }
        }
      });
    }
  }

  function injectTranslateButton(menu, msgId) {
    const btn = document.createElement('button');
    btn.className = 'translate-msg-injected';
    btn.style.cssText = `
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:inherit; transition:background 0.15s;
    `;
    btn.innerHTML = `<span style="font-size:16px">🌐</span> Translate`;
    btn.onmouseenter = () => btn.style.background = 'var(--surface-container-highest)';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = () => { 
      if(window._removeCtxMenu) window._removeCtxMenu(); 
      translateMessage(msgId); 
    };
    
    // Insert after Copy
    const copyBtn = Array.from(menu.querySelectorAll('button')).find(b => b.innerHTML.includes('Copy'));
    if (copyBtn && copyBtn.nextSibling) {
      menu.insertBefore(btn, copyBtn.nextSibling);
    } else {
      menu.appendChild(btn);
    }
  }

  async function translateMessage(msgId) {
    if (!window.App || !window.App.currentChat) return;
    const chatId = window.App.currentChat.id;
    const msgs = window.App.messages[chatId] || [];
    const msg = msgs.find(m => m.id === msgId);
    
    if (!msg || !msg.text) return;
    
    // Find the message bubble in DOM
    const msgEl = document.getElementById(`msg-${msgId}`);
    if (!msgEl) return;
    
    // Check if we already translated it
    if (translationsCache[msgId]) {
      toggleTranslation(msgEl, msgId, msg.text);
      return;
    }
    
    // Show translating indicator
    if (window.showToast) window.showToast('Translating...', 'info');
    
    try {
      // Free mock translation API since we don't have a real backend key here, 
      // or we can use a free public API like Lingva or MyMemory.
      // We will use MyMemory Translation API for demonstration:
      const textToTranslate = encodeURIComponent(msg.text);
      const targetLang = navigator.language.split('-')[0] || 'en'; // translate to user's browser language
      
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${textToTranslate}&langpair=autodetect|${targetLang}`);
      const data = await res.json();
      
      if (data && data.responseData && data.responseData.translatedText) {
        translationsCache[msgId] = {
          original: msg.text,
          translated: data.responseData.translatedText,
          lang: targetLang
        };
        showTranslation(msgEl, msgId);
      } else {
        throw new Error('Translation failed');
      }
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('Translation failed', 'error');
    }
  }

  function showTranslation(msgEl, msgId) {
    const data = translationsCache[msgId];
    if (!data) return;
    
    // Find the text container inside the bubble
    // Usually it has whitespace-pre-wrap class
    const textContainer = msgEl.querySelector('.whitespace-pre-wrap');
    if (!textContainer) return;
    
    // Inject translation below original text
    if (!msgEl.querySelector('.msg-translation')) {
      const transDiv = document.createElement('div');
      transDiv.className = 'msg-translation mt-2 pt-2 border-t border-outline-variant/30 text-[0.9em] italic opacity-90';
      transDiv.innerHTML = `
        <div class="flex items-center gap-1 mb-1 text-[10px] uppercase font-bold tracking-wider opacity-70">
          <span class="material-symbols-outlined text-[12px]">translate</span> Translated
        </div>
        ${window.escHtml ? window.escHtml(data.translated) : data.translated}
      `;
      textContainer.parentNode.insertBefore(transDiv, textContainer.nextSibling);
    }
  }

  function toggleTranslation(msgEl, msgId, originalText) {
    const transDiv = msgEl.querySelector('.msg-translation');
    if (transDiv) {
      transDiv.remove();
    } else {
      showTranslation(msgEl, msgId);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTranslation);
  } else {
    initTranslation();
  }
})();
