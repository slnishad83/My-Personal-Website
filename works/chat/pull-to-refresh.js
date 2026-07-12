/* ============================================================
   PULL-TO-REFRESH — Touch gesture to reload chat list
   Shows a spinner at the top of the chat list while refreshing
   ============================================================ */
'use strict';

const PullToRefresh = {
  _container: null,
  _indicator: null,
  _startY: 0,
  _pulling: false,
  _threshold: 80,
  _refreshing: false,
  _enabled: false,

  init(container) {
    if (this._enabled) return;
    this._container = container;
    if (!this._container) return;

    this._indicator = document.getElementById('pull-to-refresh');
    if (!this._indicator) {
      this._indicator = document.createElement('div');
      this._indicator.id = 'pull-to-refresh';
      this._indicator.setAttribute('role', 'status');
      this._indicator.setAttribute('aria-live', 'polite');
      this._indicator.innerHTML = '<div class="spinner"></div><span>Pull to refresh</span>';
      this._container.prepend(this._indicator);
    }

    this._container.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: true });
    this._container.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
    this._container.addEventListener('touchend', this._onTouchEnd.bind(this), { passive: true });
    this._enabled = true;
    console.log('[PullToRefresh] Initialized');
  },

  _onTouchStart(e) {
    if (this._refreshing) return;
    if (this._container.scrollTop > 5) return;
    this._startY = e.touches[0].clientY;
    this._pulling = true;
  },

  _onTouchMove(e) {
    if (!this._pulling || this._refreshing) return;
    const dy = e.touches[0].clientY - this._startY;
    if (dy <= 0) {
      this._indicator?.classList?.remove('visible', 'pulling');
      return;
    }
    if (this._container.scrollTop > 0) return;

    e.preventDefault();
    const progress = Math.min(dy / this._threshold, 1);
    this._indicator?.classList?.add('visible');
    if (progress < 1) {
      this._indicator?.classList?.add('pulling');
      this._indicator?.querySelector('span').textContent = 'Pull to refresh';
    } else {
      this._indicator?.classList?.remove('pulling');
      this._indicator?.querySelector('span').textContent = 'Release to refresh';
    }
  },

  async _onTouchEnd() {
    if (!this._pulling) return;
    this._pulling = false;

    if (this._indicator?.classList?.contains('visible') && !this._indicator?.classList?.contains('pulling')) {
      this._refreshing = true;
      this._indicator.querySelector('span').textContent = 'Refreshing…';

      try {
        if (typeof window.loadChats === 'function') await window.loadChats();
        if (typeof window.loadGroups === 'function') await window.loadGroups();
        if (typeof window.showToast === 'function') window.showToast('Refreshed', 'success');
      } catch (e) {
        console.warn('[PullToRefresh] Refresh failed:', e);
        if (typeof window.showToast === 'function') window.showToast('Refresh failed', 'error');
      }

      this._refreshing = false;
      this._indicator?.classList?.remove('visible', 'pulling');
    } else {
      this._indicator?.classList?.remove('visible', 'pulling');
    }
  },

  destroy() {
    this._enabled = false;
    this._container = null;
  }
};

window.PullToRefresh = PullToRefresh;
