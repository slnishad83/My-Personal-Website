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
  _heightCache: new Map(),
  _startIdx: 0,
  _endIdx: 0,
  _MAX_POOL: 100,

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
    if (window.__DEBUG__) console.log(`[VirtualScroll] Enabled for ${this._items.length} messages`);
    this._onScroll = this._render.bind(this);
    this._container.addEventListener('scroll', this._onScroll, { passive: true });
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
    if (this._pool.size > this._MAX_POOL) {
      const oldestKeys = Array.from(this._pool.keys()).slice(0, this._pool.size - this._MAX_POOL);
      for (const k of oldestKeys) this._pool.delete(k);
    }
    return this._pool.get(i) || null;
  },

  _measureHeight(el) {
    if (!el || !this._container) return this._rowHeight;
    const id = el.dataset && (el.dataset.msgId || el.dataset.messageId || el.getAttribute('data-vs-idx'));
    if (id && this._heightCache.has(id)) return this._heightCache.get(id);
    const temp = el.cloneNode(true);
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.style.width = this._container.clientWidth + 'px';
    this._container.appendChild(temp);
    const h = temp.offsetHeight || this._rowHeight;
    temp.remove();
    if (id) this._heightCache.set(id, h);
    return h;
  },

  _getOffset(idx) {
    let total = 0;
    for (let i = 0; i < idx; i++) {
      const itemId = this._items[i] && (this._items[i].id || this._items[i].messageId || i);
      total += (this._heightCache.get(itemId) || this._rowHeight);
    }
    return total;
  },

  _getTotalHeight() {
    let total = 0;
    for (let i = 0; i < this._items.length; i++) {
      const itemId = this._items[i] && (this._items[i].id || this._items[i].messageId || i);
      total += (this._heightCache.get(itemId) || this._rowHeight);
    }
    return total;
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
      const msgId = el.dataset && (el.dataset.msgId || el.dataset.messageId);
      if (msgId) {
        document.dispatchEvent(new CustomEvent('vs:node-recycled', { detail: { messageId: msgId } }));
      }
    }
  },

  _render() {
    if (!this._enabled || !this._container) return;

    const scrollTop = this._container.scrollTop;
    const viewHeight = this._container.clientHeight || Math.max(document.documentElement.clientHeight, window.innerHeight || 600);

    let accH = 0;
    let newStart = 0;
    for (let i = 0; i < this._items.length; i++) {
      const itemId = this._items[i] && (this._items[i].id || this._items[i].messageId || i);
      const h = this._heightCache.get(itemId) || this._rowHeight;
      if (accH + h > scrollTop - this._bufferRows * this._rowHeight) { newStart = i; break; }
      accH += h;
    }

    let newEnd = newStart;
    let visH = 0;
    for (let i = newStart; i < this._items.length; i++) {
      const itemId = this._items[i] && (this._items[i].id || this._items[i].messageId || i);
      const h = this._heightCache.get(itemId) || this._rowHeight;
      visH += h;
      newEnd = i + 1;
      if (visH > viewHeight + this._bufferRows * this._rowHeight) break;
    }

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
    const topH = this._getOffset(newStart);
    topSpacer.style.height = topH + 'px';
    topSpacer.style.minHeight = topH + 'px';
    fragment.appendChild(topSpacer);

    for (let i = newStart; i < newEnd; i++) {
      let el = this._pool.get(i);
      if (!el) {
        el = this._getCachedEl(i);
      }
      if (el) {
        el.setAttribute('data-vs-idx', String(i));
        fragment.appendChild(el);
        const itemId = this._items[i] && (this._items[i].id || this._items[i].messageId || i);
        if (!this._heightCache.has(itemId)) {
          const measured = this._measureHeight(el);
          this._heightCache.set(itemId, measured);
        }
      }
    }

    const bottomSpacer = document.createElement('div');
    const bottomH = Math.max(0, this._getTotalHeight() - this._getOffset(newEnd));
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
    this._container.scrollTop = this._getOffset(idx);
    if (this._enabled) this._render();
  },

  destroy() {
    if (this._container && this._onScroll) {
      this._container.removeEventListener('scroll', this._onScroll);
    }
    this._pool.clear();
    this._enabled = false;
    this._items = [];
    this._startIdx = 0;
    this._endIdx = 0;
    if (this._container) this._container.innerHTML = '';
    this._container = null;
    this._renderFn = null;
    this._onScroll = null;
  }
};

window.VirtualScroll = VirtualScroll;
