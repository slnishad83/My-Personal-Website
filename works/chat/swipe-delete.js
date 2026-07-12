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

  init() {
    if (this._enabled) return;
    document.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: true });
    document.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this._onTouchEnd.bind(this), { passive: true });
    this._enabled = true;
    console.log('[SwipeDelete] Initialized');
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

  _closeAll() {
    document.querySelectorAll('.chat-list-swipe-container.swiping').forEach(el => {
      el.style.transform = '';
      el.classList.remove('swiping');
    });
  },

  close() {
    this._closeAll();
  },

  destroy() {
    this._enabled = false;
  }
};

window.SwipeDelete = SwipeDelete;
