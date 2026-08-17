'use strict';
/**
 * DRAFT MESSAGES � Auto-save and restore message drafts per chat
 * Stores drafts in localStorage keyed by chatId.
 */
(function () {
  const Drafts = {
    _prefix: 'nsl_draft_',

    getDraft(chatId) {
      if (!chatId) return '';
      try { return localStorage.getItem(this._prefix + chatId) || ''; } catch (_) { return ''; }
    },

    saveDraft(chatId, text) {
      if (!chatId) return;
      try {
        if (text && text.trim()) {
          localStorage.setItem(this._prefix + chatId, text);
        } else {
          localStorage.removeItem(this._prefix + chatId);
        }
      } catch (_) {}
    },

    deleteDraft(chatId) {
      if (!chatId) return;
      try { localStorage.removeItem(this._prefix + chatId); } catch (_) {}
    },

    getAllDrafts() {
      const drafts = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(this._prefix)) {
            const chatId = key.slice(this._prefix.length);
            const text = localStorage.getItem(key);
            if (text) drafts[chatId] = text;
          }
        }
      } catch (_) {}
      return drafts;
    },

    showDraftIndicator(chatId) {
      if (!chatId) return;
      const text = this.getDraft(chatId);
      const input = document.getElementById('message-input') || document.querySelector('[contenteditable="true"]');
      if (input && text) {
        if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
          input.value = text;
        } else {
          input.textContent = text;
        }
        input.dispatchEvent(new Event('input'));
      }
    },

    injectDraftBadge(chatItem, chatId) {
      if (!chatItem || !chatId) return;
      const text = this.getDraft(chatId);
      if (!text) return;
      let badge = chatItem.querySelector('.draft-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'draft-badge';
        badge.style.cssText = 'font-size:12px;font-style:italic;color:var(--primary,#00a884);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;margin-top:2px;';
        const previewEl = chatItem.querySelector('.chat-preview, .text-sm, .text-xs, .last-msg, .chat-item-subtitle, [class*="preview"], [class*="snippet"]');
        const nameEl = chatItem.querySelector('.chat-name, .chat-item-name, [class*="name"]');
        const insertTarget = previewEl || nameEl;
        if (insertTarget && insertTarget.parentElement) {
          insertTarget.parentElement.insertBefore(badge, insertTarget.nextSibling);
        }
      }
      badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:2px;">edit</span>' + window.escHtml(text.slice(0, 50));
    }
  };

  window.ChatDrafts = Drafts;

  let _draftSaveTimeout = null;
  var _draftHandler = function (e) {
    if (e.target.id === 'message-input' || e.target.getAttribute('contenteditable') === 'true') {
      const chatId = window.App?.currentChat?.id;
      if (!chatId) return;
      clearTimeout(_draftSaveTimeout);
      _draftSaveTimeout = setTimeout(() => {
        const text = e.target.value || e.target.textContent || '';
        Drafts.saveDraft(chatId, text);
      }, 500);
    }
  };
  if (typeof App !== 'undefined' && typeof App.debounce === 'function') {
    document.addEventListener('input', App.debounce(_draftHandler, 500));
  } else {
    document.addEventListener('input', _draftHandler);
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('.send-btn, [data-action="send"]')) {
      const chatId = window.App?.currentChat?.id;
      if (chatId) Drafts.deleteDraft(chatId);
    }
  });

  function _restoreDraftForCurrentChat() {
    const input = document.getElementById('message-input') || document.querySelector('[contenteditable="true"]');
    const chatId = window.App?.currentChat?.id || input?.dataset?.chatId;
    if (!chatId) return;
    const draft = Drafts.getDraft(chatId);
    if (!draft) return;
    const text = input.value || input.textContent || '';
    if (text.trim()) return;
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      input.value = draft;
    } else {
      input.textContent = draft;
    }
    input.dispatchEvent(new Event('input'));
  }

  let _draftCheckTimer = null;
  function _pollForChatChange() {
    clearTimeout(_draftCheckTimer);
    _draftCheckTimer = setTimeout(function () {
      const input = document.getElementById('message-input') || document.querySelector('[contenteditable="true"]');
      const chatId = window.App?.currentChat?.id || input?.dataset?.chatId;
      if (chatId) _restoreDraftForCurrentChat();
    }, 300);
  }

  const origOpenChat = window.openChat;
  if (typeof origOpenChat === 'function') {
    window.openChat = function () {
      const result = origOpenChat.apply(this, arguments);
      if (result && typeof result.then === 'function') {
        result.then(function () { _pollForChatChange(); }).catch(function () {});
      } else {
        _pollForChatChange();
      }
      return result;
    };
  }

  if (typeof window.App !== 'undefined' && window.App) {
    const origSwitch = window.App.switchChat;
    if (typeof origSwitch === 'function') {
      window.App.switchChat = function () {
        const result = origSwitch.apply(this, arguments);
        if (result && typeof result.then === 'function') {
          result.then(function () { _pollForChatChange(); }).catch(function () {});
        } else {
          _pollForChatChange();
        }
        return result;
      };
    }
  }

  const origRenderChatList = window.renderChatList;
  let _draftOrigRenderChatList = null;
  if (typeof origRenderChatList === 'function') {
    window.renderChatList = function() {
      origRenderChatList.apply(this, arguments);
      setTimeout(_injectDraftBadges, 120);
    };
    _draftOrigRenderChatList = origRenderChatList;
  }

  function _injectDraftBadges() {
    document.querySelectorAll('.chat-item, [data-chat-id]').forEach(function(el) {
      let chatId = null;
      const onclick = el.getAttribute('onclick') || '';
      const match = onclick.match(/openChat\(['"]([^'"]+)['"]\)/);
      if (match) chatId = match[1];
      if (!chatId) chatId = el.dataset.chatId;
      if (chatId) Drafts.injectDraftBadge(el, chatId);
    });
  }

  window._draftCleanup = function() {
    if (_draftOrigRenderChatList) window.renderChatList = _draftOrigRenderChatList;
  };

  window.ChatDrafts = Drafts;
})();
