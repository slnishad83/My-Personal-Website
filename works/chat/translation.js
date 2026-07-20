/**
 * In-chat Translation
 * Translate option in message context menu + permanent auto-translation for personal chats.
 * Uses MyMemory free translation API (no key required).
 */
(function () {
  const translationsCache = {};
  const CACHE_MAX = 200;
  const AUTO_TRANSLATE_KEY = 'nsl_auto_translate';

  function _evictCache() {
    const keys = Object.keys(translationsCache);
    if (keys.length > CACHE_MAX) {
      for (let i = 0; i < keys.length - CACHE_MAX; i++) delete translationsCache[keys[i]];
    }
  }

  function getAutoTranslateSettings() {
    try { return JSON.parse(localStorage.getItem(AUTO_TRANSLATE_KEY) || '{}'); } catch (_) { return {}; }
  }

  function setAutoTranslateSetting(chatId, enabled, targetLang) {
    const settings = getAutoTranslateSettings();
    if (enabled) {
      settings[chatId] = { enabled: true, lang: targetLang || (navigator.language.split('-')[0] || 'en') };
    } else {
      delete settings[chatId];
    }
    try { localStorage.setItem(AUTO_TRANSLATE_KEY, JSON.stringify(settings)); } catch (_) {}
  }

  function initTranslation() {
    // Inject translate button into context menu whenever it appears (throttled)
    var _ctxMenuThrottle = false;
    var observer = new MutationObserver(function() {
      if (_ctxMenuThrottle) return;
      _ctxMenuThrottle = true;
      setTimeout(function() { _ctxMenuThrottle = false; }, 300);
      const menu = document.getElementById('_msg-ctx-menu');
      if (!menu || menu.querySelector('.translate-msg-injected')) return;

      const replyBtn = Array.from(menu.querySelectorAll('button')).find(b => (b.textContent || '').includes('Reply'));
      if (!replyBtn) return;

      const match = replyBtn.getAttribute('onclick')?.match(/replyToMsg\('([^']+)'\)/);
      if (!match || !match[1]) return;
      const msgId = match[1];

      const msgEl = document.getElementById('msg-' + msgId);
      if (!msgEl || !msgEl.textContent.trim()) return;

      const btn = document.createElement('button');
      btn.className = 'translate-msg-injected';
      btn.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left;color:inherit;transition:background 0.15s;';
      btn.innerHTML = '<span style="font-size:16px">🌐</span> Translate';
      btn.onmouseenter = function() { btn.style.background = 'var(--surface-container-highest)'; };
      btn.onmouseleave = function() { btn.style.background = 'transparent'; };
      btn.onclick = function() {
        if (window._removeCtxMenu) window._removeCtxMenu();
        showTranslationPopup(msgId);
      };

      const copyBtn = Array.from(menu.querySelectorAll('button')).find(b => (b.textContent || '').includes('Copy'));
      if (copyBtn && copyBtn.nextSibling) {
        menu.insertBefore(btn, copyBtn.nextSibling);
      } else {
        menu.appendChild(btn);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Add auto-translate toggle in chat header
    _injectAutoTranslateToggle();

    // Listen for new messages to auto-translate
    document.addEventListener('tc:new-message', function(e) {
      const detail = e.detail || {};
      _autoTranslateMessage(detail);
    });
  }

  function showTranslationPopup(msgId) {
    const chatId = window.App?.currentChat?.id;
    const msgs = window.App?.messages?.[chatId] || [];
    const msg = msgs.find(function(m) { return m.id === msgId; });
    if (!msg || !msg.text) return;

    // Remove existing popup
    var existing = document.getElementById('translation-popup');
    if (existing) existing.remove();

    // If already cached, show/hide
    if (translationsCache[msgId]) {
      _toggleTranslationInBubble(msgId);
      return;
    }

    var targetLang = navigator.language.split('-')[0] || 'en';
    var text = encodeURIComponent(msg.text);

    var popup = document.createElement('div');
    popup.id = 'translation-popup';
    popup.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--surface-container-high,#1e2a34);border:1px solid var(--outline-variant,rgba(255,255,255,0.12));border-radius:16px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:340px;width:90%;animation:slideUp 0.2s ease;';
    popup.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><span style="font-size:14px;font-weight:700;color:var(--on-surface)">🌐 Translate</span><button onclick="document.getElementById(\'translation-popup\').remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:4px"><span class="material-symbols-outlined" style="font-size:18px">close</span></button></div><div id="translation-popup-content" style="text-align:center;padding:16px"><span class="material-symbols-outlined animate-spin" style="color:var(--primary);font-size:24px">progress_activity</span><p style="color:var(--on-surface-variant);font-size:12px;margin-top:8px">Translating...</p></div>';
    document.body.appendChild(popup);

    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 8000);
    fetch('https://api.mymemory.translated.net/get?q=' + text + '&langpair=autodetect|' + targetLang, { signal: controller.signal })
      .then(function(res) { clearTimeout(timeoutId); return res.json(); })
      .then(function(data) {
        if (data && data.responseData && data.responseData.translatedText) {
          translationsCache[msgId] = { original: msg.text, translated: data.responseData.translatedText, lang: targetLang };
          _evictCache();
          var content = document.getElementById('translation-popup-content');
          if (content) {
            content.innerHTML = '<div style="background:var(--surface-container,rgba(255,255,255,0.04));border-radius:10px;padding:12px;margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Original</div><div style="font-size:13px;color:var(--on-surface);line-height:1.4">' + escHtml(msg.text) + '</div></div><div style="background:var(--primary-container,rgba(124,77,255,0.1));border-radius:10px;padding:12px"><div style="font-size:10px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Translated</div><div style="font-size:13px;color:var(--on-surface);line-height:1.4">' + escHtml(data.responseData.translatedText) + '</div></div>';
          }
          // Also inject into the message bubble
          _injectTranslationIntoBubble(msgId, data.responseData.translatedText);
        } else {
          throw new Error('No translation');
        }
      })
      .catch(function() {
        var content = document.getElementById('translation-popup-content');
        if (content) content.innerHTML = '<p style="color:var(--error,#f44336);font-size:13px">Translation failed. Try again.</p>';
      });

    // Auto-close after 10 seconds
    setTimeout(function() {
      var p = document.getElementById('translation-popup');
      if (p) p.remove();
    }, 10000);
  }

  function _injectTranslationIntoBubble(msgId, translatedText) {
    var msgEl = document.getElementById('msg-' + msgId);
    if (!msgEl) return;
    var existing = msgEl.querySelector('.msg-translation');
    if (existing) return;
    var textContainer = msgEl.querySelector('.whitespace-pre-wrap');
    if (!textContainer) return;
    var transDiv = document.createElement('div');
    transDiv.className = 'msg-translation';
    transDiv.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;font-style:italic;opacity:0.85;';
    transDiv.innerHTML = '<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;opacity:0.6"><span class="material-symbols-outlined" style="font-size:12px">translate</span>Translated</div>' + escHtml(translatedText);
    textContainer.parentNode.insertBefore(transDiv, textContainer.nextSibling);
  }

  function _toggleTranslationInBubble(msgId) {
    var msgEl = document.getElementById('msg-' + msgId);
    if (!msgEl) return;
    var transDiv = msgEl.querySelector('.msg-translation');
    if (transDiv) { transDiv.remove(); return; }
    var data = translationsCache[msgId];
    if (data) _injectTranslationIntoBubble(msgId, data.translated);
  }

  function _injectAutoTranslateToggle() {
    // Add a small translate icon in chat header for permanent auto-translate
    var _autoTransThrottle = false;
    var observer = new MutationObserver(function() {
      if (_autoTransThrottle) return;
      _autoTransThrottle = true;
      setTimeout(function() { _autoTransThrottle = false; }, 500);
      var headerBtns = document.querySelector('#chat-header-actions, .chat-header .flex.items-center.gap-1');
      if (!headerBtns || headerBtns.querySelector('#auto-translate-btn')) return;
      if (!window.App?.currentChat) return;

      var btn = document.createElement('button');
      btn.id = 'auto-translate-btn';
      btn.className = 'text-on-surface-variant/70 hover:text-on-surface transition-all p-2 rounded-full hover:bg-surface-variant/50 active:scale-90';
      btn.title = 'Auto-translate messages';
      btn.setAttribute('aria-label', 'Auto-translate messages');
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">translate</span>';
      btn.onclick = function() { _showAutoTranslateDialog(); };
      headerBtns.appendChild(btn);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function _showAutoTranslateDialog() {
    var chatId = window.App?.currentChat?.id;
    if (!chatId) return;
    var settings = getAutoTranslateSettings();
    var current = settings[chatId];
    var isEnabled = !!current?.enabled;
    var currentLang = current?.lang || 'en';

    var existing = document.getElementById('auto-translate-dialog');
    if (existing) { existing.remove(); return; }

    var langs = [
      { code: 'en', name: 'English' }, { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' }, { code: 'hi', name: 'Hindi' }, { code: 'ml', name: 'Malayalam' },
      { code: 'ta', name: 'Tamil' }, { code: 'te', name: 'Telugu' }, { code: 'kn', name: 'Kannada' },
      { code: 'bn', name: 'Bengali' }, { code: 'mr', name: 'Marathi' }, { code: 'ar', name: 'Arabic' },
      { code: 'zh', name: 'Chinese' }, { code: 'ja', name: 'Japanese' }, { code: 'ko', name: 'Korean' },
      { code: 'pt', name: 'Portuguese' }, { code: 'ru', name: 'Russian' }, { code: 'ur', name: 'Urdu' }
    ];

    var optionsHtml = langs.map(function(l) {
      return '<option value="' + l.code + '"' + (l.code === currentLang ? ' selected' : '') + '>' + l.name + '</option>';
    }).join('');

    var dialog = document.createElement('div');
    dialog.id = 'auto-translate-dialog';
    dialog.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';
    dialog.innerHTML = '<div style="background:var(--surface-container,#1a1b2e);border:1px solid var(--outline-variant,rgba(255,255,255,0.12));border-radius:20px;padding:24px;max-width:360px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5)"><div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><span class="material-symbols-outlined" style="color:var(--primary);font-size:24px">translate</span><span style="font-size:16px;font-weight:700;color:var(--on-surface)">Auto-Translate</span></div><p style="font-size:12px;color:var(--on-surface-variant);margin-bottom:16px">Automatically translate incoming messages in this chat to your preferred language.</p><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"><span style="font-size:14px;color:var(--on-surface)">Enable auto-translate</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer"><input type="checkbox" id="auto-translate-toggle"' + (isEnabled ? ' checked' : '') + ' style="opacity:0;width:0;height:0"><span style="position:absolute;inset:0;background:' + (isEnabled ? 'var(--primary)' : 'var(--outline-variant)') + ';border-radius:12px;transition:0.3s"></span><span id="auto-translate-knob" style="position:absolute;left:' + (isEnabled ? '22px' : '2px') + ';top:2px;width:20px;height:20px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></span></label></div><div style="margin-bottom:16px"><label style="font-size:12px;font-weight:600;color:var(--on-surface-variant);display:block;margin-bottom:6px">Target Language</label><select id="auto-translate-lang" style="width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--outline-variant,rgba(255,255,255,0.12));background:var(--surface-container-high,rgba(255,255,255,0.06));color:var(--on-surface);font-size:14px">' + optionsHtml + '</select></div><div style="display:flex;gap:8px"><button onclick="document.getElementById(\'auto-translate-dialog\').remove()" style="flex:1;padding:10px;border-radius:12px;border:none;background:var(--surface-container-high,rgba(255,255,255,0.06));color:var(--on-surface);font-weight:600;cursor:pointer">Cancel</button><button id="auto-translate-save" style="flex:1;padding:10px;border-radius:12px;border:none;background:var(--primary);color:var(--on-primary);font-weight:700;cursor:pointer">Save</button></div></div>';
    document.body.appendChild(dialog);

    // Toggle styling
    var toggle = document.getElementById('auto-translate-toggle');
    var knob = document.getElementById('auto-translate-knob');
    if (toggle) {
      toggle.onchange = function() {
        if (toggle.checked) {
          toggle.previousElementSibling.style.background = 'var(--primary)';
          knob.style.left = '22px';
        } else {
          toggle.previousElementSibling.style.background = 'var(--outline-variant)';
          knob.style.left = '2px';
        }
      };
    }

    // Save button
    document.getElementById('auto-translate-save').onclick = function() {
      var enabled = document.getElementById('auto-translate-toggle').checked;
      var lang = document.getElementById('auto-translate-lang').value;
      setAutoTranslateSetting(chatId, enabled, lang);
      if (window.showToast) window.showToast(enabled ? 'Auto-translate enabled for this chat' : 'Auto-translate disabled', 'success');
      dialog.remove();
    };

    dialog.addEventListener('click', function(e) { if (e.target === dialog) dialog.remove(); });
  }

  async function _autoTranslateMessage(detail) {
    var chatId = window.App?.currentChat?.id;
    if (!chatId || !detail.msgId || !detail.text) return;
    var settings = getAutoTranslateSettings();
    var setting = settings[chatId];
    if (!setting || !setting.enabled) return;

    // Wait for message to render
    setTimeout(function() {
      var msgEl = document.getElementById('msg-' + detail.msgId);
      if (!msgEl) return;
      var text = encodeURIComponent(detail.text);
      var targetLang = setting.lang || 'en';

      var ac2 = new AbortController();
      var tid2 = setTimeout(function() { ac2.abort(); }, 8000);
      fetch('https://api.mymemory.translated.net/get?q=' + text + '&langpair=autodetect|' + targetLang, { signal: ac2.signal })
        .then(function(res) { clearTimeout(tid2); return res.json(); })
        .then(function(data) {
          if (data && data.responseData && data.responseData.translatedText) {
            translationsCache[detail.msgId] = { original: detail.text, translated: data.responseData.translatedText, lang: targetLang };
            _evictCache();
            _injectTranslationIntoBubble(detail.msgId, data.responseData.translatedText);
          }
        })
        .catch(function() {});
    }, 500);
  }

  window.showTranslationPopup = showTranslationPopup;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTranslation);
  } else {
    initTranslation();
  }
})();
