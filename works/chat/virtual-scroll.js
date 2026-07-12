/* ============================================================
   VIRTUAL SCROLL — DOM-recycling windowed message renderer
   Renders only visible messages + buffer, reuses DOM nodes
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
  _pool: new Map(),
  _startIdx: 0,
  _endIdx: 0,

  init(container, renderFn, options) {
    this._container = container;
    this._renderFn = renderFn;
    this._rowHeight = options?.rowHeight || 80;
    this._bufferRows = options?.bufferRows || 10;
    this._threshold = options?.threshold || 150;
    this._enabled = false;
    this._pool.clear();
    this._startIdx = 0;
    this._endIdx = 0;
  },

  setItems(items) {
    this._items = items || [];
    if (!this._enabled && this._items.length > this._threshold) {
      this._enable();
    }
    if (this._enabled) {
      this._startIdx = 0;
      this._endIdx = 0;
      this._render();
    }
  },

  _enable() {
    this._enabled = true;
    if (!this._container) return;
    console.log(`[VirtualScroll] Enabled for ${this._items.length} messages`);
    this._render();
  },

  _getCachedEl(i) {
    if (this._pool.has(i)) return this._pool.get(i);
    const el = this._renderFn(this._items[i], i);
    if (el) {
      if (typeof el === 'string') {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = el;
        this._pool.set(i, wrapper.firstElementChild || wrapper);
      } else {
        this._pool.set(i, el);
      }
    }
    return this._pool.get(i) || null;
  },

  _recycle(prevStart, prevEnd, newStart, newEnd) {
    const keep = new Set();
    for (let i = newStart; i < newEnd; i++) keep.add(i);

    const toRemove = [];
    for (let i = prevStart; i < prevEnd; i++) {
      if (!keep.has(i)) toRemove.push(i);
    }

    const children = Array.from(this._container.children);
    const idxAttr = 'data-vs-idx';
    const toRecycle = [];

    for (const child of children) {
      const idx = parseInt(child.getAttribute(idxAttr), 10);
      if (isNaN(idx)) continue;
      if (!keep.has(idx)) {
        toRecycle.push(child);
      }
    }

    for (const el of toRecycle) {
      el.remove();
      const idx = parseInt(el.getAttribute(idxAttr), 10);
      if (!isNaN(idx)) this._pool.delete(idx);
    }
  },

  _render() {
    if (!this._enabled || !this._container) return;

    const scrollTop = this._container.scrollTop;
    const viewHeight = this._container.clientHeight || Math.max(document.documentElement.clientHeight, window.innerHeight || 600);
    const newStart = Math.max(0, Math.floor(scrollTop / this._rowHeight) - this._bufferRows);
    const newEnd = Math.min(this._items.length, Math.ceil((scrollTop + viewHeight) / this._rowHeight) + this._bufferRows);

    const prevStart = this._startIdx;
    const prevEnd = this._endIdx;

    if (newStart === prevStart && newEnd === prevEnd && prevEnd > 0) return;

    if (prevEnd > 0 && prevStart < prevEnd) {
      this._recycle(prevStart, prevEnd, newStart, newEnd);
    }

    this._startIdx = newStart;
    this._endIdx = newEnd;

    const fragment = document.createDocumentFragment();

    const topSpacer = document.createElement('div');
    topSpacer.style.height = (newStart * this._rowHeight) + 'px';
    topSpacer.style.minHeight = (newStart * this._rowHeight) + 'px';
    fragment.appendChild(topSpacer);

    for (let i = newStart; i < newEnd; i++) {
      let el = this._pool.get(i);
      if (!el) {
        el = this._getCachedEl(i);
      }
      if (el) {
        el.setAttribute('data-vs-idx', String(i));
        fragment.appendChild(el);
      }
    }

    const bottomSpacer = document.createElement('div');
    const bottomH = Math.max(0, (this._items.length - newEnd) * this._rowHeight);
    bottomSpacer.style.height = bottomH + 'px';
    bottomSpacer.style.minHeight = bottomH + 'px';
    fragment.appendChild(bottomSpacer);

    if (prevEnd === 0) {
      this._container.innerHTML = '';
    }
    this._container.appendChild(fragment);
  },

  scrollToIndex(idx) {
    if (!this._container) return;
    this._container.scrollTop = idx * this._rowHeight;
    if (this._enabled) this._render();
  },

  destroy() {
    this._pool.clear();
    this._enabled = false;
    this._items = [];
    this._startIdx = 0;
    this._endIdx = 0;
    if (this._container) this._container.innerHTML = '';
    this._container = null;
    this._renderFn = null;
  }
};

window.VirtualScroll = VirtualScroll;
