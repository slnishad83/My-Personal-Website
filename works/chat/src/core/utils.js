/**
 * NSL Chat — Shared Utilities Module (ES Module)
 * Single source of truth for all utility functions.
 * Eliminates duplicate escHtml, throttle, debounce across codebase.
 */

/* ── Safe HTML Escaping (XSS prevention) ──────────────────── */
const _escDiv = document.createElement('div');

export function escHtml(str) {
  if (str == null) return '';
  _escDiv.textContent = String(str);
  return _escDiv.innerHTML;
}

/* ── Throttle ─────────────────────────────────────────────── */
export function throttle(fn, delay) {
  let last = 0;
  let timer = null;
  return function (...args) {
    const now = Date.now();
    const remaining = delay - (now - last);
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = null;
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/* ── Debounce ─────────────────────────────────────────────── */
export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* ── Deep Clone (structured clone fallback) ───────────────── */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

/* ── Safe JSON Parse ──────────────────────────────────────── */
export function safeJsonParse(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

/* ── Format File Size ─────────────────────────────────────── */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

/* ── Time Ago ─────────────────────────────────────────────── */
export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  const intervals = [
    { label: 'y', seconds: 31536000 },
    { label: 'mo', seconds: 2592000 },
    { label: 'w', seconds: 604800 },
    { label: 'd', seconds: 86400 },
    { label: 'h', seconds: 3600 },
    { label: 'm', seconds: 60 },
  ];
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) return `${count}${interval.label}`;
  }
  return 'just now';
}

/* ── Generate UID ─────────────────────────────────────────── */
export function generateUid() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/* ── DOM Helpers ──────────────────────────────────────────── */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

export function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value);
  }
  for (const child of children) {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  }
  return el;
}

/* ── Event Bus (decoupled module communication) ───────────── */
const _listeners = new Map();

export function on(event, callback) {
  if (!_listeners.has(event)) _listeners.set(event, new Set());
  _listeners.get(event).add(callback);
  return () => _listeners.get(event)?.delete(callback);
}

export function emit(event, data) {
  _listeners.get(event)?.forEach(cb => {
    try { cb(data); } catch (e) { console.error(`[EventBus] Error in "${event}" handler:`, e); }
  });
}

/* ── Error Boundary ───────────────────────────────────────── */
export function safeAsync(fn) {
  return fn().catch(e => {
    console.error('[SafeAsync]', e);
    return null;
  });
}
