'use strict';
/**
 * SCROLL TO FIRST UNREAD � Floating button to jump to first unread message
 * Shows a downward arrow button when scrolled up in a chat with unread messages.
 */
(function () {
  let _btn = null;
  let _observer = null;
  let _firstUnreadId = null;

  const ScrollToUnread = {
    show(chatId) {
      this.hide();
      if (!chatId) return;

      _btn = document.createElement('button');
      _btn.id = 'scroll-to-unread-btn';
      _btn.setAttribute('aria-label', 'Scroll to first unread message');
      _btn.style.cssText = 'position:absolute;bottom:80px;right:16px;z-index:50;width:40px;height:40px;border-radius:50%;background:var(--primary,#00a884);color:var(--on-primary,#fff);border:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.2s,opacity 0.2s;';
      _btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">keyboard_arrow_down</span>';

      const countEl = document.createElement('span');
      countEl.id = 'unread-count-badge';
      countEl.style.cssText = 'position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;';
      _btn.appendChild(countEl);

      _btn.addEventListener('click', function () {
        const container = document.getElementById('messages-container') || document.querySelector('.messages-wrapper');
        if (container) {
          const unreadEl = container.querySelector('.msg-unread-marker, [data-unread="true"]');
          if (unreadEl) {
            unreadEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else if (_firstUnreadId) {
            const msgEl = container.querySelector(`[data-msg-id="${_firstUnreadId}"]`);
            if (msgEl) msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        _btn.style.display = 'none';
      });

      const chatArea = document.getElementById('chat-area') || document.querySelector('.chat-main');
      if (chatArea) {
        chatArea.style.position = 'relative';
        chatArea.appendChild(_btn);
      }

      this._startObserver();
    },

    hide() {
      if (_btn) { _btn.remove(); _btn = null; }
      if (_observer) { _observer.disconnect(); _observer = null; }
      _firstUnreadId = null;
    },

    _startObserver() {
      const container = document.getElementById('messages-container') || document.querySelector('.messages-wrapper');
      if (!container) return;

      const sentinel = container.firstElementChild;
      if (!sentinel) return;

      _observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting && _btn) {
            _btn.style.display = 'flex';
          } else if (_btn) {
            _btn.style.display = 'none';
          }
        });
      }, { threshold: 0.1 });

      _observer.observe(sentinel);
    },

    setFirstUnreadId(msgId) {
      _firstUnreadId = msgId;
    },

    addUnreadMarker(msgEl) {
      if (msgEl) {
        msgEl.classList.add('msg-unread-marker');
        msgEl.setAttribute('data-unread', 'true');
        msgEl.style.borderLeft = '3px solid var(--primary,#00a884)';
      }
    },

    removeUnreadMarkers() {
      document.querySelectorAll('.msg-unread-marker').forEach(el => {
        el.classList.remove('msg-unread-marker');
        el.removeAttribute('data-unread');
        el.style.borderLeft = '';
      });
    }
  };

  window.ScrollToUnread = ScrollToUnread;

  document.addEventListener('click', function (e) {
    const chatItem = e.target.closest('[data-chat-id]');
    if (chatItem) {
      setTimeout(() => ScrollToUnread.show(chatItem.dataset.chatId), 200);
    }
  });
})();
