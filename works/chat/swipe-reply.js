/* ============================================================
   SWIPE TO REPLY — Touch gesture on message bubbles
   Swipe right to trigger reply on a message
   ============================================================ */
'use strict';

(function() {
  let _swipeTarget = null;
  let _swipeStartX = 0;
  let _swipeStartY = 0;
  let _swipeMsgId = null;
  let _swipeThreshold = 80;
  let _replyIndicator = null;

  function _init() {
    document.addEventListener('pointerdown', _onPointerDown, { passive: true });
    document.addEventListener('pointermove', _onPointerMove, { passive: false });
    document.addEventListener('pointerup', _onPointerUp, { passive: true });
    document.addEventListener('pointercancel', _onPointerUp, { passive: true });
  }

  function _onPointerDown(e) {
    const row = e.target.closest('.message-row');
    if (!row) return;
    _swipeTarget = row;
    _swipeStartX = e.clientX;
    _swipeStartY = e.clientY;
    _swipeMsgId = row.getAttribute('data-msg-id') || row.getAttribute('data-message-id');
  }

  function _onPointerMove(e) {
    if (!_swipeTarget || !_swipeMsgId) return;
    const dx = e.clientX - _swipeStartX;
    const dy = e.clientY - _swipeStartY;
    if (Math.abs(dy) > Math.abs(dx) * 1.5) {
      _cancelSwipe();
      return;
    }
    if (dx <= 0) {
      _cancelSwipe();
      return;
    }
    if (dx < 10) return;
    e.preventDefault();
    const progress = Math.min(dx / _swipeThreshold, 1);
    _swipeTarget.style.transition = 'none';
    _swipeTarget.style.transform = `translateX(${dx * 0.6}px)`;
    _swipeTarget.style.opacity = 1 - progress * 0.15;
    if (!_replyIndicator) {
      _replyIndicator = document.createElement('div');
      _replyIndicator.style.cssText = 'position:fixed;left:12px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:var(--primary,#00a884);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;transition:opacity 0.15s;pointer-events:none';
      _replyIndicator.innerHTML = '<span class="material-symbols-outlined" style="color:white;font-size:20px">reply</span>';
      document.body.appendChild(_replyIndicator);
    }
    _replyIndicator.style.opacity = progress > 0.3 ? '1' : '0';
  }

  function _onPointerUp(e) {
    if (!_swipeTarget || !_swipeMsgId) { _cancelSwipe(); return; }
    const dx = e.clientX - _swipeStartX;
    if (dx >= _swipeThreshold) {
      _triggerReply(_swipeMsgId);
    }
    _resetSwipe();
  }

  function _cancelSwipe() {
    _resetSwipe();
  }

  function _resetSwipe() {
    if (_swipeTarget) {
      _swipeTarget.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      _swipeTarget.style.transform = '';
      _swipeTarget.style.opacity = '';
    }
    _swipeTarget = null;
    _swipeStartX = 0;
    _swipeStartY = 0;
    _swipeMsgId = null;
    if (_replyIndicator) {
      _replyIndicator.style.opacity = '0';
      setTimeout(() => { if (_replyIndicator && _replyIndicator.parentNode) _replyIndicator.remove(); _replyIndicator = null; }, 200);
    }
  }

  function _triggerReply(msgId) {
    if (typeof window.replyToMessage === 'function') {
      window.replyToMessage(msgId);
    } else {
      const msg = (window.ChatCore && window.ChatCore.findMessage) ? window.ChatCore.findMessage(msgId) : null;
      if (!msg) return;
      const msgInput = document.getElementById('msg-input') || document.getElementById('messageInput');
      if (!msgInput) return;
      const replyBar = document.getElementById('reply-preview') || document.getElementById('replyBar');
      if (replyBar) {
        replyBar.classList.remove('hidden');
        replyBar.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface-container,#fff);border-left:3px solid var(--primary,#00a884);border-radius:4px;margin:4px 8px;"><div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:var(--primary,#00a884);">${esc(msg.senderName || 'User')}</div><div style="font-size:12px;opacity:0.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc((msg.text || '').substring(0, 60))}</div></div><button onclick="this.closest('#reply-preview,#replyBar')?.classList.add('hidden')" style="background:none;border:none;cursor:pointer;padding:4px;"><span class="material-symbols-outlined" style="font-size:16px">close</span></button></div>`;
      }
      msgInput.focus();
      msgInput._replyTo = msg;
    }
  }

  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
