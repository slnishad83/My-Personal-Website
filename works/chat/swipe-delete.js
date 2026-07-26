/* ============================================================
   SWIPE-TO-DELETE — Swipe left on chat list items to reveal
   delete/archive action buttons (WhatsApp-style)
   ============================================================ */
'use strict';

const SwipeDelete = {
  _enabled: false,
  _activeContainer: null,
  _startX: 0,
  _currentX: 0,
  _swiping: false,
  _threshold: 80,

  _boundTouchStart: null,
  _boundTouchMove: null,
  _boundTouchEnd: null,
  _boundClick: null,

  init() {
    if (this._enabled) return;
    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchMove = this._throttledTouchMove.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);
    this._boundClick = this._onDocumentClick.bind(this);
    document.addEventListener('touchstart', this._boundTouchStart, { passive: true });
    document.addEventListener('touchmove', this._boundTouchMove, { passive: false });
    document.addEventListener('touchend', this._boundTouchEnd, { passive: true });
    document.addEventListener('click', this._boundClick);
    this._enabled = true;
    if (window.__DEBUG__) console.log('[SwipeDelete] Initialized');
  },

  _throttledTouchMove(e) {
    if (!this._activeContainer) return;
    if (this._moveRaf) return;
    this._moveRaf = requestAnimationFrame(() => {
      this._moveRaf = null;
      this._onTouchMove(e);
    });
  },

  _findChatItem(target) {
    return target.closest('.chat-list-item, [data-chat-id]');
  },

  _onTouchStart(e) {
    if (this._activeContainer) return;
    const item = this._findChatItem(e.target);
    if (!item) return;
    if (e.touches.length !== 1) return;

    this._activeContainer = item;
    this._startX = e.touches[0].clientX;
    this._currentX = this._startX;
    this._swiping = false;
  },

  _onTouchMove(e) {
    if (!this._activeContainer) return;
    this._currentX = e.touches[0].clientX;
    const dx = this._startX - this._currentX;

    if (dx > 10 && !this._swiping) {
      this._swiping = true;
      this._closeAll();
      this._activeContainer.classList.add('swiping');
      if (!this._activeContainer.querySelector('.chat-list-swipe-actions')) {
        this._ensureSwipeActions(this._activeContainer);
      }
    }

    if (this._swiping && dx > 0) {
      e.preventDefault();
      const offset = Math.min(dx, 160);
      const actions = this._activeContainer.querySelector('.chat-list-swipe-actions');
      if (actions) {
        this._activeContainer.style.transform = `translateX(-${offset}px)`;
      }
    }
  },

  _onTouchEnd() {
    if (!this._activeContainer) return;
    const dx = this._startX - this._currentX;

    if (dx > this._threshold) {
      this._activeContainer.style.transform = 'translateX(-140px)';
    } else {
      this._activeContainer.style.transform = '';
      this._activeContainer.classList.remove('swiping');
    }
    this._activeContainer = null;
    this._swiping = false;
  },

  _onDocumentClick(e) {
    const openItems = document.querySelectorAll('.chat-list-swipe-container.swiping');
    if (!openItems.length) return;
    if (e.target.closest('.chat-list-swipe-container')) return;
    this._closeAll();
  },

  _closeAll() {
    document.querySelectorAll('.chat-list-swipe-container.swiping').forEach(el => {
      el.style.transform = '';
      el.classList.remove('swiping');
    });
  },

  close() {
    this._closeAll();
  },

  _ensureSwipeActions(item) {
    const chatId = item.dataset?.chatId || '';
    const actions = document.createElement('div');
    actions.className = 'chat-list-swipe-actions';
    const safeChatId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(chatId) : chatId;
    actions.innerHTML =
      '<button class="swipe-unread" data-action="mark-unread" data-chat-id="' + safeChatId + '">' +
        '<span class="material-symbols-outlined" style="font-size:20px">mark_chat_unread</span>' +
        '<span>Unread</span>' +
      '</button>' +
      '<button class="swipe-archive">' +
        '<span class="material-symbols-outlined" style="font-size:20px">archive</span>' +
        '<span>Archive</span>' +
      '</button>' +
      '<button class="swipe-delete">' +
        '<span class="material-symbols-outlined" style="font-size:20px">delete</span>' +
        '<span>Delete</span>' +
      '</button>';
    item.style.position = 'relative';
    item.appendChild(actions);
    const unreadBtn = actions.querySelector('[data-action="mark-unread"]');
    if (unreadBtn) {
      unreadBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const cid = this.dataset.chatId;
        if (cid && typeof window.MarkUnread === 'object') {
          window.MarkUnread.markChatUnread(cid);
          if (typeof showToast === 'function') showToast('Marked as unread', 'success');
        }
      });
    }
  },

  destroy() {
    this._enabled = false;
    this._closeAll();
    if (this._boundTouchStart) document.removeEventListener('touchstart', this._boundTouchStart);
    if (this._boundTouchMove) document.removeEventListener('touchmove', this._boundTouchMove);
    if (this._boundTouchEnd) document.removeEventListener('touchend', this._boundTouchEnd);
    if (this._boundClick) document.removeEventListener('click', this._boundClick);
    this._boundTouchStart = this._boundTouchMove = this._boundTouchEnd = this._boundClick = null;
  }
};

window.SwipeDelete = SwipeDelete;
