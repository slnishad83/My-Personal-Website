/* ============================================================
   PINCH-TO-ZOOM — Image/video pinch zoom in media viewer
   Supports touch pinch, double-tap zoom, and scroll-wheel zoom
   ============================================================ */
'use strict';

const PinchZoom = {
  _container: null,
  _target: null,
  _scale: 1,
  _minScale: 1,
  _maxScale: 5,
  _startDist: 0,
  _startScale: 1,
  _lastTap: 0,
  _originX: 0,
  _originY: 0,
  _enabled: false,

  _boundTouchStart: null,
  _boundTouchMove: null,
  _boundTouchEnd: null,
  _boundWheel: null,

  init(container) {
    if (this._enabled || !container) return;
    this._container = container;
    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchMove = this._onTouchMove.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);
    this._boundWheel = this._onWheel.bind(this);
    this._container.addEventListener('touchstart', this._boundTouchStart, { passive: false });
    this._container.addEventListener('touchmove', this._boundTouchMove, { passive: false });
    this._container.addEventListener('touchend', this._boundTouchEnd, { passive: true });
    this._container.addEventListener('wheel', this._boundWheel, { passive: false });
    this._enabled = true;
  },

  setTarget(el) {
    this._target = el;
    this._scale = 1;
    this._applyTransform();
    if (this._target) this._target.classList.add('media-zoom-container');
  },

  _getDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  _onTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      this._startDist = this._getDistance(e.touches[0], e.touches[1]);
      this._startScale = this._scale;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = this._container.getBoundingClientRect();
      this._originX = cx - rect.left;
      this._originY = cy - rect.top;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - this._lastTap < 300) {
        e.preventDefault();
        this._doubleTap(e.touches[0]);
      }
      this._lastTap = now;
    }
  },

  _onTouchMove(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = this._getDistance(e.touches[0], e.touches[1]);
      const newScale = Math.max(this._minScale, Math.min(this._maxScale, this._startScale * (dist / this._startDist)));
      this._scale = newScale;
      this._applyTransform();
    }
  },

  _onTouchEnd() {
    if (this._scale <= 1.05) {
      this._scale = 1;
      this._applyTransform();
    }
  },

  _onWheel(e) {
    if (!this._target) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this._scale = Math.max(this._minScale, Math.min(this._maxScale, this._scale * delta));
    this._applyTransform();
  },

  _doubleTap(touch) {
    if (this._scale > 1.1) {
      this._scale = 1;
    } else {
      this._scale = 2.5;
      const rect = this._container.getBoundingClientRect();
      this._originX = touch.clientX - rect.left;
      this._originY = touch.clientY - rect.top;
    }
    this._applyTransform();
  },

  _applyTransform() {
    if (!this._target) return;
    const t = this._scale === 1 ? '' : `scale(${this._scale})`;
    this._target.style.transform = t;
    if (this._scale > 1) {
      this._target.classList.add('zooming');
    } else {
      this._target.classList.remove('zooming');
    }
  },

  reset() {
    this._scale = 1;
    this._applyTransform();
  },

  destroy() {
    this._enabled = false;
    if (this._container) {
      if (this._boundTouchStart) this._container.removeEventListener('touchstart', this._boundTouchStart);
      if (this._boundTouchMove) this._container.removeEventListener('touchmove', this._boundTouchMove);
      if (this._boundTouchEnd) this._container.removeEventListener('touchend', this._boundTouchEnd);
      if (this._boundWheel) this._container.removeEventListener('wheel', this._boundWheel);
    }
    this._boundTouchStart = this._boundTouchMove = this._boundTouchEnd = this._boundWheel = null;
    this._target = null;
    this._container = null;
  }
};

window.PinchZoom = PinchZoom;
