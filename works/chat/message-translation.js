'use strict';
/**
 * MESSAGE TRANSLATION — Translate any message with a single tap
 * Uses free Google Translate API (no key needed for short texts).
 */
(function () {
  const MessageTranslation = {
    _translations: {},

    async translate(text, targetLang) {
      if (!text || !text.trim()) return '';
      targetLang = targetLang || this._detectTargetLang();
      const cacheKey = `${text.slice(0, 100)}_${targetLang}`;
      if (this._translations[cacheKey]) return this._translations[cacheKey];

      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text.slice(0, 500))}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Translation failed');
        const data = await resp.json();
        let result = '';
        if (data && data[0]) {
          data[0].forEach(part => {
            if (part[0]) result += part[0];
          });
        }
        this._translations[cacheKey] = result;
        return result;
      } catch (e) {
        console.warn('[MessageTranslation] Error:', e);
        return text;
      }
    },

    _detectTargetLang() {
      try {
        return localStorage.getItem('nsl_translate_lang') || navigator.language.slice(0, 2) || 'en';
      } catch (_) { return 'en'; }
    },

    async translateMessage(msgId, text) {
      const existing = document.querySelector(`[data-translate-id="${msgId}"]`);
      if (existing) {
        existing.remove();
        return;
      }

      const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
      if (!msgEl) return;

      const translated = await this.translate(text);
      if (!translated || translated === text) {
        if (typeof showToast === 'function') showToast('Already in your language', 'info');
        return;
      }

      const lang = this._detectTargetLang();
      const translateEl = document.createElement('div');
      translateEl.setAttribute('data-translate-id', msgId);
      translateEl.style.cssText = 'margin-top:4px;padding:6px 10px;border-radius:8px;background:var(--surface-variant,#f0f2f5);font-size:12px;color:var(--on-surface-variant,#666);border-left:2px solid var(--primary,#00a884);';
      translateEl.innerHTML = `<span style="font-weight:600;color:var(--primary,#00a884);">Translated (${this._esc(lang)}):</span> ${this._esc(translated)}`;
      msgEl.querySelector('.msg-text, .message-text, [data-text]')?.parentElement?.appendChild(translateEl);
    },

    _esc(s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    injectTranslateButton(msgId, text) {
      const existing = document.querySelector(`[data-msg-id="${msgId}"] .translate-msg-btn`);
      if (existing) return;

      const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
      if (!msgEl) return;

      const btn = document.createElement('button');
      btn.className = 'translate-msg-btn';
      btn.setAttribute('aria-label', 'Translate message');
      btn.style.cssText = 'background:none;border:none;cursor:pointer;padding:2px;color:var(--on-surface-variant,#8696a0);opacity:0.6;transition:opacity 0.15s;';
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">translate</span>';
      btn.addEventListener('mouseenter', () => btn.style.opacity = '1');
      btn.addEventListener('mouseleave', () => btn.style.opacity = '0.6');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.translateMessage(msgId, text);
      });

      const actionsEl = msgEl.querySelector('.msg-actions, .message-actions');
      if (actionsEl) {
        actionsEl.appendChild(btn);
      } else {
        msgEl.appendChild(btn);
      }
    },

    addTranslateToContextMenu() {
      if (window.MutationBus) {
        window.MutationBus.onBodyChildList('translate-msg-inject', () => {
          const menu = document.getElementById('_msg-ctx-menu');
          if (menu && !menu.querySelector('.translate-msg-option')) {
            const btn = document.createElement('button');
            btn.className = 'translate-msg-option';
            btn.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left;color:inherit;';
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">translate</span> Translate';
            btn.onmouseenter = () => btn.style.background = 'var(--surface-container-highest)';
            btn.onmouseleave = () => btn.style.background = 'transparent';
            btn.addEventListener('click', () => {
              const msgId = menu.dataset.msgId;
              const text = menu.dataset.msgText;
              if (msgId && text) this.translateMessage(msgId, text);
              if (window._removeCtxMenu) window._removeCtxMenu();
            });
            const lastBtn = menu.querySelector('button:last-child');
            if (lastBtn) {
              menu.insertBefore(btn, lastBtn);
            } else {
              menu.appendChild(btn);
            }
          }
        });
      }
    },

    openLanguagePicker() {
      const languages = [
        { code: 'en', name: 'English' }, { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' }, { code: 'de', name: 'German' },
        { code: 'hi', name: 'Hindi' }, { code: 'ar', name: 'Arabic' },
        { code: 'zh', name: 'Chinese' }, { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' }, { code: 'pt', name: 'Portuguese' },
        { code: 'ru', name: 'Russian' }, { code: 'bn', name: 'Bengali' },
        { code: 'te', name: 'Telugu' }, { code: 'ml', name: 'Malayalam' },
        { code: 'ta', name: 'Tamil' }, { code: 'ur', name: 'Urdu' }
      ];

      const current = this._detectTargetLang();
      const modal = document.createElement('div');
      modal.id = 'lang-picker-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

      modal.innerHTML = `
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(350px,92vw);max-height:70vh;overflow-y:auto;padding:20px;">
          <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;">Translation Language</h3>
          ${languages.map(l => `
            <button data-lang="${l.code}" style="width:100%;text-align:left;padding:12px;border:none;background:${l.code === current ? 'var(--primary,#00a884)' : 'transparent'};color:${l.code === current ? 'var(--on-primary,#fff)' : 'var(--on-surface,#000)'};border-radius:10px;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              ${l.code === current ? '<span class="material-symbols-outlined" style="font-size:18px;">check</span>' : '<span style="width:18px;"></span>'}
              ${l.name}
            </button>
          `).join('')}
        </div>
      `;

      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
        const btn = e.target.closest('[data-lang]');
        if (btn) {
          localStorage.setItem('nsl_translate_lang', btn.dataset.lang);
          modal.remove();
          if (typeof showToast === 'function') showToast('Translation language set to ' + btn.dataset.lang, 'success');
        }
      });
    }
  };

  window.MessageTranslation = MessageTranslation;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MessageTranslation.addTranslateToContextMenu());
  } else {
    MessageTranslation.addTranslateToContextMenu();
  }
})();
