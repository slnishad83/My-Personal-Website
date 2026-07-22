(function () {
  'use strict';

  var _enabled = false;
  var _replySwipeActive = false;
  var _replySwipeTarget = null;
  var _replySwipeStartX = 0;
  var _replySwipeStartY = 0;
  var _replySwipeLocked = false;
  var _replySwipeThreshold = 80;
  var _longPressTimer = null;
  var _longPressTarget = null;
  var _longPressTimeout = 500;
  var _menuEl = null;
  var _multiSelectMode = false;
  var _selectedMessages = new Set();
  var _scrollPositions = {};
  var _currentChatId = null;
  var _scrollFab = null;
  var _multiSelectHeader = null;
  var _multiSelectBar = null;
  var _typingIndicator = null;
  var _isRecording = false;
  var _recordingTimer = null;
  var _recordingStartTime = 0;
  var _boundHandlers = {};

  function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function getMsgWrap() {
    return document.getElementById('messages-wrap');
  }

  function getInput() {
    return document.getElementById('msg-input');
  }

  function getSendBtn() {
    return document.getElementById('send-btn') || document.querySelector('.send-btn, [onclick*="send"], button[aria-label="Send"]');
  }

  function getChatArea() {
    return document.getElementById('chat-area');
  }

  function getReplyPreview() {
    return document.getElementById('reply-preview');
  }

  function getTypingIndicator() {
    return document.getElementById('typing-indicator');
  }

  function getScrollToBottom() {
    return document.getElementById('scroll-to-bottom');
  }

  function getScrollBadge() {
    return document.getElementById('scroll-badge');
  }

  function createRipple(e, el) {
    if (prefersReducedMotion()) return;
    var rect = el.getBoundingClientRect();
    var ripple = document.createElement('span');
    ripple.className = 'ripple';
    var size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    el.appendChild(ripple);
    ripple.addEventListener('animationend', function () { ripple.remove(); });
  }

  function createFab() {
    if (_scrollFab) return _scrollFab;
    _scrollFab = document.createElement('button');
    _scrollFab.className = 'scroll-fab';
    _scrollFab.setAttribute('aria-label', 'Scroll to bottom');
    _scrollFab.innerHTML = '<span class="material-symbols-outlined">expand_more</span>';
    _scrollFab.addEventListener('click', function () {
      var wrap = getMsgWrap();
      if (wrap) wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
    });
    document.body.appendChild(_scrollFab);
    return _scrollFab;
  }

  function createMultiSelectHeader() {
    if (_multiSelectHeader) return _multiSelectHeader;
    _multiSelectHeader = document.createElement('div');
    _multiSelectHeader.className = 'multi-select-header hidden';
    _multiSelectHeader.innerHTML = '<div class="flex items-center gap-3"><span class="material-symbols-outlined cursor-pointer" id="ms-close">close</span><span id="ms-count">0 selected</span></div><div class="flex items-center gap-2"></div>';
    document.body.appendChild(_multiSelectHeader);
    var closeBtn = _multiSelectHeader.querySelector('#ms-close');
    if (closeBtn) closeBtn.addEventListener('click', exitMultiSelect);
    return _multiSelectHeader;
  }

  function createMultiSelectBar() {
    if (_multiSelectBar) return _multiSelectBar;
    _multiSelectBar = document.createElement('div');
    _multiSelectBar.className = 'multi-select-bar hidden';
    _multiSelectBar.innerHTML = '<button class="flex flex-col items-center gap-1 p-2" id="ms-action-delete"><span class="material-symbols-outlined text-[20px]" style="color:var(--error,#dc3545)">delete</span><span class="text-[10px]" style="color:var(--error,#dc3545)">Delete</span></button><button class="flex flex-col items-center gap-1 p-2" id="ms-action-forward"><span class="material-symbols-outlined text-[20px]" style="color:var(--on-surface-variant)">forward</span><span class="text-[10px]" style="color:var(--on-surface-variant)">Forward</span></button><button class="flex flex-col items-center gap-1 p-2" id="ms-action-star"><span class="material-symbols-outlined text-[20px]" style="color:var(--on-surface-variant)">star</span><span class="text-[10px]" style="color:var(--on-surface-variant)">Star</span></button><button class="flex flex-col items-center gap-1 p-2" id="ms-action-reply"><span class="material-symbols-outlined text-[20px]" style="color:var(--on-surface-variant)">reply</span><span class="text-[10px]" style="color:var(--on-surface-variant)">Reply</span></button>';
    document.body.appendChild(_multiSelectBar);
    var fwdBtn = _multiSelectBar.querySelector('#ms-action-forward');
    if (fwdBtn) fwdBtn.addEventListener('click', function() {
      var ids = Array.from(_selectedMessages);
      if (ids.length === 0) return;
      if (ids.length === 1 && typeof window.openForwardModal === 'function') {
        exitMultiSelect();
        window.openForwardModal(ids[0]);
      } else if (ids.length > 1 && typeof window.openForwardModalMultiple === 'function') {
        exitMultiSelect();
        window.openForwardModalMultiple(ids);
      }
    });
    var delBtn = _multiSelectBar.querySelector('#ms-action-delete');
    if (delBtn) delBtn.addEventListener('click', function() {
      var ids = Array.from(_selectedMessages);
      if (ids.length === 0) return;
      if (typeof window.deleteMessagesByIds === 'function') {
        exitMultiSelect();
        window.deleteMessagesByIds(ids);
      } else if (typeof window.deleteMessageById === 'function') {
        exitMultiSelect();
        ids.forEach(function(id) { window.deleteMessageById(id); });
      }
    });
    var starBtn = _multiSelectBar.querySelector('#ms-action-star');
    if (starBtn) starBtn.addEventListener('click', function() {
      var ids = Array.from(_selectedMessages);
      ids.forEach(function(id) {
        var el = document.querySelector('[data-msg-id="' + id + '"]');
        if (el) starMsg(el);
      });
      exitMultiSelect();
    });
    return _multiSelectBar;
  }

  function findMsgEl(target) {
    return target.closest('.message, [data-msg-id], .message-row, .message-bubble-wrap');
  }

  function findMsgBubble(target) {
    return target.closest('.message-bubble, .msg-bubble');
  }

  function isOutgoing(msgEl) {
    return msgEl && (msgEl.classList.contains('my-message') || msgEl.classList.contains('msg-out'));
  }

  function getMsgSenderId(msgEl) {
    if (isOutgoing(msgEl)) return 'You';
    var nameEl = msgEl && msgEl.querySelector('.sender-name, .msg-sender, .message-sender');
    return nameEl ? nameEl.textContent.trim() : 'Someone';
  }

  function getMsgText(msgEl) {
    if (!msgEl) return '';
    var textEl = msgEl.querySelector('.msg-text, .message-text, .message-bubble');
    return textEl ? textEl.textContent.trim().substring(0, 80) : '';
  }

  function getMsgId(msgEl) {
    return msgEl && (msgEl.getAttribute('data-msg-id') || msgEl.getAttribute('data-message-id') || '');
  }

  function exitMultiSelect() {
    _multiSelectMode = false;
    _selectedMessages.forEach(function (id) {
      var el = document.querySelector('[data-msg-id="' + id + '"], [data-message-id="' + id + '"]');
      if (el) el.classList.remove('msg-selected');
    });
    _selectedMessages.clear();
    if (_multiSelectHeader) _multiSelectHeader.classList.add('hidden');
    if (_multiSelectBar) _multiSelectBar.classList.add('hidden');
    var wrap = getMsgWrap();
    if (wrap) wrap.classList.remove('message-selecting');
  }

  function toggleMsgSelect(msgEl) {
    var id = getMsgId(msgEl);
    if (!id) return;
    if (_selectedMessages.has(id)) {
      _selectedMessages.delete(id);
      msgEl.classList.remove('msg-selected');
    } else {
      _selectedMessages.add(id);
      msgEl.classList.add('msg-selected');
    }
    var countEl = _multiSelectHeader && _multiSelectHeader.querySelector('#ms-count');
    if (countEl) countEl.textContent = _selectedMessages.size + ' selected';
    if (_selectedMessages.size === 0) exitMultiSelect();
  }

  function enterMultiSelect(msgEl) {
    _multiSelectMode = true;
    var wrap = getMsgWrap();
    if (wrap) wrap.classList.add('message-selecting');
    createMultiSelectHeader();
    createMultiSelectBar();
    _multiSelectHeader.classList.remove('hidden');
    _multiSelectBar.classList.remove('hidden');
    toggleMsgSelect(msgEl);
  }

  function dismissMenu() {
    if (_menuEl) {
      _menuEl.style.opacity = '0';
      _menuEl.style.transform = 'scale(0.9)';
      _menuEl.style.transition = 'opacity 0.15s, transform 0.15s';
      var el = _menuEl;
      setTimeout(function () { if (el.parentNode) el.remove(); }, 150);
      _menuEl = null;
    }
    _longPressTarget = null;
  }

  function showLongPressMenu(msgEl, x, y) {
    dismissMenu();
    vibrate(10);

    var menu = document.createElement('div');
    menu.className = 'long-press-menu';

    var items = [
      { icon: 'reply', label: 'Reply', action: 'reply' },
      { icon: 'forward', label: 'Forward', action: 'forward' },
      { icon: 'content_copy', label: 'Copy', action: 'copy' },
      { icon: 'star', label: 'Star', action: 'star' },
      { icon: 'delete', label: 'Delete', action: 'delete', destructive: true },
      { icon: 'info', label: 'Info', action: 'info' }
    ];

    var starIcon = getStarState(msgEl);
    if (starIcon) items[3].icon = 'star_off';

    items.forEach(function (item, i) {
      var div = document.createElement('div');
      div.className = 'menu-item' + (item.destructive ? ' destructive' : '');
      div.innerHTML = '<span class="material-symbols-outlined">' + item.icon + '</span><span>' + item.label + '</span>';
      div.style.opacity = '0';
      div.style.transform = 'translateY(8px)';
      div.setAttribute('data-action', item.action);
      div.addEventListener('click', function (e) {
        e.stopPropagation();
        createRipple(e, div);
        setTimeout(function () { handleMenuAction(item.action, msgEl); dismissMenu(); }, 100);
      });
      div.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse') createRipple(e, div);
      });
      menu.appendChild(div);
    });

    document.body.appendChild(menu);
    _menuEl = menu;

    var menuRect = menu.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var menuW = menuRect.width;
    var menuH = menuRect.height;
    var posX = Math.min(x, vw - menuW - 8);
    var posY = Math.min(y, vh - menuH - 8);
    posX = Math.max(8, posX);
    posY = Math.max(8, posY);

    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';

    requestAnimationFrame(function () {
      var menuItems = menu.querySelectorAll('.menu-item');
      menuItems.forEach(function (mi, idx) {
        setTimeout(function () {
          mi.style.opacity = '1';
          mi.style.transform = 'translateY(0)';
          mi.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        }, idx * 50);
      });
    });

    msgEl.classList.add('msg-reply-active');
  }

  function getStarState(msgEl) {
    if (!msgEl) return false;
    var starEl = msgEl.querySelector('.star-icon, [class*="star"]');
    return starEl && (starEl.classList.contains('starred') || starEl.textContent.trim() === '★');
  }

  function handleMenuAction(action, msgEl) {
    switch (action) {
      case 'reply':
        triggerReply(msgEl);
        break;
      case 'forward':
        if (typeof window.forwardMessage === 'function') window.forwardMessage(msgEl);
        else if (typeof window.forwardMsg === 'function') window.forwardMsg(msgEl);
        break;
      case 'copy':
        copyMsgText(msgEl);
        break;
      case 'star':
        starMsg(msgEl);
        break;
      case 'delete':
        deleteMsg(msgEl);
        break;
      case 'info':
        if (typeof window.showMessageInfo === 'function') window.showMessageInfo(msgEl);
        break;
    }
  }

  function copyMsgText(msgEl) {
    var text = getMsgText(msgEl);
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  function starMsg(msgEl) {
    var id = getMsgId(msgEl);
    if (typeof window.starMessage === 'function') { window.starMessage(id); return; }
    if (typeof window.toggleStar === 'function') { window.toggleStar(id); return; }
    var starEl = msgEl.querySelector('.star-icon, [class*="star"]');
    if (starEl) {
      starEl.classList.toggle('starred');
      if (!prefersReducedMotion()) {
        starEl.classList.remove('star-animate');
        void starEl.offsetWidth;
        starEl.classList.add('star-animate');
      }
    }
  }

  function deleteMsg(msgEl) {
    if (prefersReducedMotion()) {
      msgEl.remove();
      return;
    }
    msgEl.classList.add('msg-delete');
    msgEl.addEventListener('animationend', function () { msgEl.remove(); }, { once: true });
  }

  function triggerReply(msgEl) {
    vibrate(10);
    var id = getMsgId(msgEl);
    var sender = getMsgSenderId(msgEl);
    var text = getMsgText(msgEl);
    if (typeof window.setReply === 'function') { window.setReply(id, sender, text, msgEl); return; }
    if (typeof window.replyToMessage === 'function') { window.replyToMessage(id, sender, text, msgEl); return; }

    var replyPreview = getReplyPreview();
    if (replyPreview) {
      var nameEl = replyPreview.querySelector('#reply-name, .reply-name');
      var textEl = replyPreview.querySelector('#reply-text, .reply-text');
      if (nameEl) nameEl.textContent = sender;
      if (textEl) textEl.textContent = text;
      replyPreview.classList.remove('hidden');
      if (replyPreview.style.display === 'none') replyPreview.style.display = '';
    }

    if (!prefersReducedMotion() && msgEl) {
      msgEl.classList.remove('msg-reply-quoted');
      void msgEl.offsetWidth;
      msgEl.classList.add('msg-reply-quoted');
    }

    var input = getInput();
    if (input) { input.focus(); input.setAttribute('data-reply-to', id); }
  }

  function cancelReplyMode() {
    var replyPreview = getReplyPreview();
    if (replyPreview) {
      replyPreview.classList.add('hidden');
      replyPreview.style.display = 'none';
    }
    var input = getInput();
    if (input) input.removeAttribute('data-reply-to');
    var wrap = getMsgWrap();
    if (wrap) wrap.classList.remove('message-replying');
    _replySwipeActive = false;
    _replySwipeTarget = null;
  }

  function initReplySwipe() {
    var wrap = getMsgWrap();
    if (!wrap) return;

    var handlers = {
      onTouchStart: function (e) {
        if (e.touches.length !== 1) return;
        var msgEl = findMsgEl(e.target);
        if (!msgEl) return;
        var bubble = findMsgBubble(e.target);
        if (!bubble) return;
        var input = getInput();
        if (input && document.activeElement === input) return;

        _replySwipeTarget = msgEl;
        _replySwipeStartX = e.touches[0].clientX;
        _replySwipeStartY = e.touches[0].clientY;
        _replySwipeLocked = false;
      },
      onTouchMove: function (e) {
        if (!_replySwipeTarget) return;
        var cx = e.touches[0].clientX;
        var cy = e.touches[0].clientY;
        var dx = cx - _replySwipeStartX;
        var dy = cy - _replySwipeStartY;

        if (!_replySwipeLocked) {
          if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
            if (Math.abs(dy) > Math.abs(dx)) {
              _replySwipeTarget = null;
              return;
            }
            _replySwipeLocked = true;
          }
          return;
        }

        if (dx < 0) { _replySwipeTarget = null; return; }
        e.preventDefault();

        var bubble = findMsgBubble(_replySwipeTarget);
        if (!bubble) return;
        var offset = Math.min(dx, 200);
        var progress = Math.min(offset / _replySwipeThreshold, 1);

        bubble.style.transform = 'translateX(' + offset + 'px)';
        bubble.style.opacity = 1 - progress * 0.4;
        bubble.classList.add('msg-swiping');
      },
      onTouchEnd: function () {
        if (!_replySwipeTarget) return;
        var bubble = findMsgBubble(_replySwipeTarget);
        var target = _replySwipeTarget;

        if (bubble) {
          var transform = bubble.style.transform;
          var match = transform.match(/translateX\((\d+(?:\.\d+)?)px\)/);
          var offset = match ? parseFloat(match[1]) : 0;

          if (offset >= _replySwipeThreshold) {
            triggerReply(target);
            vibrate(10);
          }
        }

        if (bubble) {
          bubble.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease';
          bubble.style.transform = '';
          bubble.style.opacity = '';
          bubble.classList.remove('msg-swiping');
          setTimeout(function () {
            bubble.style.transition = '';
          }, 300);
        }

        _replySwipeTarget = null;
        _replySwipeLocked = false;
      }
    };

    _boundHandlers.replyTouchStart = handlers.onTouchStart;
    _boundHandlers.replyTouchMove = handlers.onTouchMove;
    _boundHandlers.replyTouchEnd = handlers.onTouchEnd;

    wrap.addEventListener('touchstart', handlers.onTouchStart, { passive: true });
    wrap.addEventListener('touchmove', handlers.onTouchMove, { passive: false });
    wrap.addEventListener('touchend', handlers.onTouchEnd, { passive: true });
  }

  function initLongPressMenu() {
    var wrap = getMsgWrap();
    if (!wrap) return;

    _boundHandlers.longPressPointerDown = function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var msgEl = findMsgEl(e.target);
      if (!msgEl) return;
      if (e.target.closest('button, a, input, .menu-item')) return;

      var sx = e.clientX;
      var sy = e.clientY;
      var moved = false;

      if (e.pointerType !== 'mouse') vibrate(15);
      if (!prefersReducedMotion()) {
        msgEl.style.transition = 'transform 0.2s ease';
        msgEl.style.transform = 'scale(0.97)';
      }

      _longPressTimer = setTimeout(function () {
        if (!moved) {
          _longPressTarget = msgEl;
          showLongPressMenu(msgEl, sx, sy);
        }
        msgEl.style.transform = '';
      }, _longPressTimeout);

      var onMove = function (ev) {
        if (Math.abs(ev.clientX - sx) > 10 || Math.abs(ev.clientY - sy) > 10) {
          moved = true;
          clearTimeout(_longPressTimer);
          msgEl.style.transform = '';
        }
      };

      var onUp = function () {
        clearTimeout(_longPressTimer);
        msgEl.style.transform = '';
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };

      document.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerup', onUp, { passive: true });
    };

    wrap.addEventListener('pointerdown', _boundHandlers.longPressPointerDown, { passive: true });
  }

  function initMessageAnimations() {
    var wrap = getMsgWrap();
    if (!wrap || prefersReducedMotion()) return;

    _boundHandlers.msgObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          var bubbles = node.querySelectorAll ? node.querySelectorAll('.message-bubble, .msg-bubble') : [];
          var el = node.matches && node.matches('.message-bubble, .msg-bubble') ? node : null;
          if (el) bubbles.length ? null : bubbles = [el];

          bubbles.forEach(function (bubble) {
            var row = bubble.closest('.message, .message-row, [data-msg-id]');
            if (isOutgoing(row)) {
              bubble.classList.add('msg-appear-right');
            } else {
              bubble.classList.add('msg-appear-left');
            }
            bubble.addEventListener('animationend', function () {
              bubble.classList.remove('msg-appear-right', 'msg-appear-left');
            }, { once: true });
          });
        });
      });
    });

    _boundHandlers.msgObserver.observe(wrap, { childList: true, subtree: true });
  }

  function initScrollInteractions() {
    var wrap = getMsgWrap();
    if (!wrap) return;

    createFab();

    _boundHandlers.scrollHandler = function () {
      var scrollTop = wrap.scrollTop;
      var scrollHeight = wrap.scrollHeight;
      var clientHeight = wrap.clientHeight;
      var distFromBottom = scrollHeight - scrollTop - clientHeight;

      if (_scrollFab) {
        if (distFromBottom > 200) {
          _scrollFab.classList.add('visible');
        } else {
          _scrollFab.classList.remove('visible');
        }
      }

      if (_currentChatId) {
        _scrollPositions[_currentChatId] = scrollTop;
      }
    };

    wrap.addEventListener('scroll', _boundHandlers.scrollHandler, { passive: true });

    var existingFab = getScrollToBottom();
    if (existingFab) {
      existingFab.removeEventListener('click', existingFab._miClick);
      existingFab._miClick = function () {
        wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
      };
      existingFab.addEventListener('click', existingFab._miClick);
    }
  }

  function initInputAnimations() {
    var input = getInput();
    var sendBtn = getSendBtn();
    if (!input || !sendBtn) return;

    sendBtn.classList.add('send-morph');

    _boundHandlers.inputHandler = function () {
      var val = input.value.trim();
      var iconEl = sendBtn.querySelector('.material-symbols-outlined');
      var isCurrentlyMic = iconEl && iconEl.textContent.trim() === 'mic';
      var isCurrentlySend = iconEl && (iconEl.textContent.trim() === 'send' || iconEl.textContent.trim() === 'arrow_upward');

      if (val.length > 0 && isCurrentlyMic) {
        if (iconEl) { iconEl.textContent = 'send'; }
        if (!prefersReducedMotion()) {
          sendBtn.style.transform = 'scale(0.8) rotate(-90deg)';
          requestAnimationFrame(function () {
            sendBtn.style.transform = 'scale(1) rotate(0)';
          });
        }
      } else if (val.length === 0 && isCurrentlySend) {
        if (iconEl) { iconEl.textContent = 'mic'; }
        if (!prefersReducedMotion()) {
          sendBtn.style.transform = 'scale(0.8) rotate(90deg)';
          requestAnimationFrame(function () {
            sendBtn.style.transform = 'scale(1) rotate(0)';
          });
        }
      }

      var maxLen = parseInt(input.getAttribute('maxlength') || '0', 10);
      if (maxLen > 0) {
        var ratio = input.value.length / maxLen;
        if (ratio > 0.9) {
          input.style.borderColor = 'var(--error, #dc3545)';
        } else if (ratio > 0.75) {
          input.style.borderColor = 'var(--warning, #ff9800)';
        } else {
          input.style.borderColor = '';
        }
      }
    };

    input.addEventListener('input', _boundHandlers.inputHandler, { passive: true });

    _boundHandlers.inputFocus = function () {
      if (_scrollFab) _scrollFab.classList.remove('visible');
    };
    input.addEventListener('focus', _boundHandlers.inputFocus, { passive: true });
  }

  function showTypingIndicator(name) {
    var indicator = getTypingIndicator();
    if (!indicator) return;
    var nameEl = indicator.querySelector('.typing-user-name');
    if (nameEl && name) nameEl.textContent = name;
    indicator.classList.remove('hidden');
    if (indicator.style.display === 'none') indicator.style.display = '';
  }

  function hideTypingIndicator() {
    var indicator = getTypingIndicator();
    if (indicator) {
      indicator.classList.add('hidden');
      indicator.style.display = 'none';
    }
  }

  function animateReaction(el) {
    if (!el || prefersReducedMotion()) return;
    el.classList.remove('reaction-appear');
    void el.offsetWidth;
    el.classList.add('reaction-appear');
    el.addEventListener('animationend', function () {
      el.classList.remove('reaction-appear');
    }, { once: true });
  }

  function animateStar(el) {
    if (!el || prefersReducedMotion()) return;
    el.classList.remove('star-animate');
    void el.offsetWidth;
    el.classList.add('star-animate');
    el.addEventListener('animationend', function () {
      el.classList.remove('star-animate');
    }, { once: true });
  }

  function animateMsgDelete(el) {
    if (!el) return;
    if (prefersReducedMotion()) { el.remove(); return; }
    el.classList.add('msg-delete');
    el.addEventListener('animationend', function () { el.remove(); }, { once: true });
  }

  function setupListHoverStates() {
    if (prefersReducedMotion()) return;

    _boundHandlers.listHoverClick = function (e) {
      var target = e.target.closest('.chat-list-item, [data-chat-id], .menu-item, .settings-item, .contact-item');
      if (target && (e.pointerType !== 'mouse' || e.type === 'pointerdown')) {
        createRipple(e, target);
      }
    };

    document.addEventListener('pointerdown', _boundHandlers.listHoverClick, { passive: true });
  }

  function setupGlobalDismiss() {
    _boundHandlers.globalClick = function (e) {
      if (_menuEl && !_menuEl.contains(e.target)) {
        var msgEl = findMsgEl(e.target);
        if (!msgEl || msgEl !== _longPressTarget) {
          dismissMenu();
        }
      }
    };

    _boundHandlers.globalEscape = function (e) {
      if (e.key === 'Escape') {
        dismissMenu();
        if (_multiSelectMode) exitMultiSelect();
        cancelReplyMode();
      }
    };

    _boundHandlers.globalTouch = function (e) {
      if (_menuEl && !_menuEl.contains(e.target)) {
        dismissMenu();
      }
    };

    document.addEventListener('click', _boundHandlers.globalClick, { passive: true });
    document.addEventListener('keydown', _boundHandlers.globalEscape);
    document.addEventListener('touchstart', _boundHandlers.globalTouch, { passive: true });
  }

  function initInputClickHandlers() {
    _boundHandlers.sendClick = function (e) {
      var sendBtn = getSendBtn();
      if (sendBtn && sendBtn.contains(e.target)) {
        setTimeout(cancelReplyMode, 50);
      }
    };
    document.addEventListener('click', _boundHandlers.sendClick, { passive: true });
  }

  function onChatSwitch(chatId) {
    _currentChatId = chatId;
    dismissMenu();
    if (_multiSelectMode) exitMultiSelect();
  }

  function restoreScrollPosition(chatId) {
    if (chatId && _scrollPositions[chatId] !== undefined) {
      var wrap = getMsgWrap();
      if (wrap) wrap.scrollTop = _scrollPositions[chatId];
    }
  }

  function initMicroInteractions() {
    if (_enabled) return;
    _enabled = true;
    initReplySwipe();
    initLongPressMenu();
    initMessageAnimations();
    initScrollInteractions();
    initInputAnimations();
    setupListHoverStates();
    setupGlobalDismiss();
    initInputClickHandlers();
  }

  window.initMicroInteractions = initMicroInteractions;
  window.initReplySwipe = initReplySwipe;
  window.initLongPressMenu = initLongPressMenu;
  window.initMessageAnimations = initMessageAnimations;
  window.initScrollInteractions = initScrollInteractions;
  window.initInputAnimations = initInputAnimations;
  window.setupListHoverStates = setupListHoverStates;
  window.cancelReplyMode = cancelReplyMode;
  window.triggerReply = triggerReply;
  window.showTypingIndicator = showTypingIndicator;
  window.hideTypingIndicator = hideTypingIndicator;
  window.animateReaction = animateReaction;
  window.animateStar = animateStar;
  window.animateMsgDelete = animateMsgDelete;
  window.exitMultiSelect = exitMultiSelect;
  window.onChatSwitch = onChatSwitch;
  window.restoreScrollPosition = restoreScrollPosition;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMicroInteractions);
  } else {
    initMicroInteractions();
  }
})();
