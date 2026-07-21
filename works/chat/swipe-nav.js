// swipe-nav.js  v1
// Swipe-right anywhere in the chat panel to go back to the chat list.
// Works on: iOS Safari, Android Chrome/Firefox/Samsung Browser,
//           installed PWA (standalone), touch laptops, stylus/hybrid devices.
// Does NOT intercept: vertical scrolls, horizontal code-block scrolls,
//                     taps on inputs/buttons, or swipes while a modal is open.

(function () {
  'use strict';

  var TRIGGER_PX  = 68;   // px dragged rightward to trigger close
  var TRIGGER_VEL = 0.40; // px/ms  — fast flick triggers even under TRIGGER_PX

  var sx = 0, sy = 0, lx = 0, lt = 0;
  var active = false, axisLocked = false, isHoriz = false;

  /* ── environment checks ────────────────────────────────────────────── */

  function isTouchEnv() {
    /* C5: Only activate on phones (<768px) or PWA — not tablets with mouse/trackpad */
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (typeof navigator.standalone === 'boolean' && navigator.standalone) return true;
    /* On tablets, only enable if pure touch (no fine pointer = no mouse/trackpad) */
    if (window.matchMedia('(max-width: 767px)').matches) return true;
    if (window.matchMedia('(pointer: coarse) and (hover: none)').matches && window.innerWidth < 1024) return true;
    return false;
  }

  function isChatOpen() {
    var el = document.getElementById('chat-area');
    return el && !el.classList.contains('hidden') && !el.classList.contains('hidden-mobile');
  }

  function isModalOpen() {
    var m = document.querySelector('#callModal');
    if (m && (m.style.display === 'flex' || m.style.display === 'block')) return true;
    if (document.querySelector('.modal-overlay:not([style*="display: none"])')) return true;
    return false;
  }

  /* Walk up the DOM: if any ancestor is horizontally scrollable with overflow
     content, let the native scroll handle it instead of our swipe. */
  function hasScrollableParent(el) {
    var node = el;
    while (node && node !== document.body) {
      var ox = window.getComputedStyle(node).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && node.scrollWidth > node.clientWidth + 4) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function isBlockedTarget(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true;
    if (el.isContentEditable) return true;
    if (el.closest && el.closest('#messageInput, .emoji-picker, .modal, .modal-content, #callModal')) return true;
    return hasScrollableParent(el);
  }

  /* ── DOM refs ──────────────────────────────────────────────────────── */

  function chatContainer() { return document.getElementById('chat-area'); }
  function chatMainEl()    { return document.getElementById('messages-wrap'); }

  /* ── drag visual state ─────────────────────────────────────────────── */

  function beginDrag() {
    var c = chatContainer();
    if (c) c.classList.add('swipe-peeking');
  }

  function applyDrag(dx) {
    var el = chatMainEl();
    if (!el) return;
    var clamped = Math.max(0, Math.min(dx, window.innerWidth * 0.92));
    el.style.setProperty('--swipe-dx', clamped + 'px');
    el.classList.add('swipe-dragging');
  }

  function clearDrag(trigger) {
    var c  = chatContainer();
    var el = chatMainEl();
    if (c)  c.classList.remove('swipe-peeking');
    if (el) {
      el.classList.remove('swipe-dragging');
      el.style.removeProperty('--swipe-dx');
    }
    if (trigger && typeof window.closeMobileChatPanel === 'function') {
      window.closeMobileChatPanel();
    }
  }

  /* ── core gesture logic ────────────────────────────────────────────── */

  function gestureStart(cx, cy, target) {
    if (!isTouchEnv() || !isChatOpen()) return;
    if (isBlockedTarget(target) || isModalOpen()) return;
    sx = lx = cx; sy = cy; lt = Date.now();
    active = true; axisLocked = false; isHoriz = false;
  }

  function gestureMove(cx, cy, preventDefaultFn) {
    if (!active) return;
    var dx = cx - sx, dy = cy - sy;

    /* Determine axis on first few pixels */
    if (!axisLocked && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      axisLocked = true;
      isHoriz    = Math.abs(dx) > Math.abs(dy) && dx > 0;
      if (!isHoriz) { active = false; return; }
      beginDrag();
    }
    if (!isHoriz) return;
    if (dx < 0) { active = false; clearDrag(false); return; }

    /* Suppress native scroll / pan while we own this gesture */
    if (preventDefaultFn) preventDefaultFn();
    lx = cx; lt = Date.now();
    applyDrag(dx);
  }

  function gestureEnd(cx) {
    if (!active || !isHoriz) { active = false; clearDrag(false); return; }
    active = false;
    var dx  = cx - sx;
    var dt  = Date.now() - lt;
    var vel = dt > 0 ? (cx - lx) / dt : 0;
    clearDrag(dx >= TRIGGER_PX || vel >= TRIGGER_VEL);
  }

  function gestureCancel() { active = false; isHoriz = false; clearDrag(false); }

  /* ── Touch Events (all mobile browsers) ───────────────────────────── */

  function onTouchStart(e) {
    var t = e.touches[0];
    gestureStart(t.clientX, t.clientY, e.target);
  }
  function onTouchMove(e) {
    var t = e.touches[0];
    gestureMove(t.clientX, t.clientY, e.cancelable ? function () { e.preventDefault(); } : null);
  }
  function onTouchEnd(e) {
    var t = e.changedTouches[0];
    gestureEnd(t.clientX);
  }

  /* ── Pointer Events (touch laptops, stylus, pen, hybrid devices) ──── */

  var ptrIds = {};

  function onPointerDown(e) {
    if (e.pointerType === 'mouse') return;   /* skip desktop mouse */
    ptrIds[e.pointerId] = true;
    gestureStart(e.clientX, e.clientY, e.target);
  }
  function onPointerMove(e) {
    if (!ptrIds[e.pointerId]) return;
    gestureMove(e.clientX, e.clientY, e.cancelable ? function () { e.preventDefault(); } : null);
  }
  function onPointerUp(e) {
    if (!ptrIds[e.pointerId]) return;
    delete ptrIds[e.pointerId];
    gestureEnd(e.clientX);
  }
  function onPointerCancel(e) {
    delete ptrIds[e.pointerId];
    gestureCancel();
  }

  /* ── attach listeners ──────────────────────────────────────────────── */

  function attach() {
    var root = document.documentElement;

    root.addEventListener('touchstart',  onTouchStart, { passive: true,  capture: false });
    root.addEventListener('touchmove',   onTouchMove,  { passive: false, capture: false });
    root.addEventListener('touchend',    onTouchEnd,   { passive: true,  capture: false });
    root.addEventListener('touchcancel', gestureCancel,{ passive: true,  capture: false });

    if (window.PointerEvent) {
      root.addEventListener('pointerdown',   onPointerDown,   { passive: true  });
      root.addEventListener('pointermove',   onPointerMove,   { passive: false });
      root.addEventListener('pointerup',     onPointerUp,     { passive: true  });
      root.addEventListener('pointercancel', onPointerCancel, { passive: true  });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }

  function detach() {
    var root = document.documentElement;
    root.removeEventListener('touchstart',  onTouchStart);
    root.removeEventListener('touchmove',   onTouchMove);
    root.removeEventListener('touchend',    onTouchEnd);
    root.removeEventListener('touchcancel', gestureCancel);
    if (window.PointerEvent) {
      root.removeEventListener('pointerdown',   onPointerDown);
      root.removeEventListener('pointermove',   onPointerMove);
      root.removeEventListener('pointerup',     onPointerUp);
      root.removeEventListener('pointercancel', onPointerCancel);
    }
  }

  window.SwipeNav = { destroy: detach };

  /* ── Close mobile chat panel (called by swipe gesture) ─────────── */
  window.closeMobileChatPanel = function() {
    var chatArea = document.getElementById('chat-area');
    var sidebar = document.getElementById('chat-list-sidebar');
    var chatHeader = document.getElementById('chat-header');
    if (chatArea) {
      chatArea.classList.remove('visible-mobile');
      chatArea.classList.add('hidden-mobile');
    }
    if (sidebar) sidebar.classList.remove('hidden');
    if (chatHeader) chatHeader.style.display = 'none';
    if (typeof renderChatList === 'function') renderChatList();
  };
})();
