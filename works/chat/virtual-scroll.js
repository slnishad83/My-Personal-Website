/* ============================================================
   VIRTUAL SCROLL — Lightweight windowed message renderer
   Renders only visible messages + buffer for smooth scrolling
   ============================================================ */
'use strict';

const VirtualScroll = {
  _container: null,
  _items: [],
  _renderFn: null,
  _rowHeight: 80,
  _bufferRows: 10,
  _enabled: false,
  _threshold: 150,
  _observer: null,
  _sentinelTop: null,
  _sentinelBottom: null,

  init(container, renderFn, options) {
    this._container = container;
    this._renderFn = renderFn;
    this._rowHeight = options?.rowHeight || 80;
    this._bufferRows = options?.bufferRows || 10;
    this._threshold = options?.threshold || 150;
    this._enabled = false;
  },

  setItems(items) {
    this._items = items || [];
    if (!this._enabled && this._items.length > this._threshold) {
      this._enable();
    }
    if (this._enabled) {
      this._render();
    }
  },

  _enable() {
    this._enabled = true;
    if (!this._container) return;

    this._container.style.contentVisibility = 'auto';
    this._container.style.containIntrinsicSize = `auto ${this._rowHeight * Math.min(this._items.length, 20)}px`;

    if ('IntersectionObserver' in window) {
      this._observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.dataset.vsIdx, 10);
            if (!isNaN(idx)) this._renderAround(idx);
          }
        }
      }, { root: this._container, rootMargin: '400px 0px' });
    }

    console.log(`[VirtualScroll] Enabled for ${this._items.length} messages`);
  },

  _render() {
    if (!this._enabled || !this._container) return;

    const scrollTop = this._container.scrollTop;
    const viewHeight = this._container.clientHeight;
    const startIdx = Math.max(0, Math.floor(scrollTop / this._rowHeight) - this._bufferRows);
    const endIdx = Math.min(this._items.length, Math.ceil((scrollTop + viewHeight) / this._rowHeight) + this._bufferRows);

    const fragment = document.createDocumentFragment();

    const topSpacer = document.createElement('div');
    topSpacer.style.height = (startIdx * this._rowHeight) + 'px';
    topSpacer.dataset.vsIdx = startIdx;
    fragment.appendChild(topSpacer);

    for (let i = startIdx; i < endIdx; i++) {
      const el = this._renderFn(this._items[i], i);
      if (el) {
        if (typeof el === 'string') {
          const wrapper = document.createElement('div');
          wrapper.innerHTML = el;
          fragment.appendChild(wrapper.firstElementChild || wrapper);
        } else {
          fragment.appendChild(el);
        }
      }
    }

    const bottomSpacer = document.createElement('div');
    bottomSpacer.style.height = Math.max(0, (this._items.length - endIdx) * this._rowHeight) + 'px';
    fragment.appendChild(bottomSpacer);

    this._container.innerHTML = '';
    this._container.appendChild(fragment);

    if (this._observer) {
      this._observer.disconnect();
      const spacers = this._container.querySelectorAll('[data-vs-idx]');
      spacers.forEach(s => this._observer.observe(s));
    }
  },

  _renderAround(centerIdx) {
    this._render();
  },

  scrollToIndex(idx) {
    if (!this._container) return;
    this._container.scrollTop = idx * this._rowHeight;
    this._render();
  },

  destroy() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this._enabled = false;
    this._items = [];
  }
};

window.VirtualScroll = VirtualScroll;
