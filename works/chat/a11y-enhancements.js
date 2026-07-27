(function() {
  'use strict';
  window._a11yEnhancementsActive = true;

  var _activeTrap = null;
  var _previousFocus = null;
  var _skipLinks = [];
  var _keydownHandlers = [];

  function _getFocusable(container) {
    return Array.from(container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), ' +
      '[contenteditable="true"]'
    ));
  }

  function _announce(message) {
    var el = document.getElementById('a11y-live-region');
    if (!el) {
      el = document.createElement('div');
      el.id = 'a11y-live-region';
      el.setAttribute('aria-live', 'assertive');
      el.setAttribute('aria-atomic', 'true');
      el.className = 'sr-only';
      el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
      document.body.appendChild(el);
    }
    el.textContent = '';
    setTimeout(function() { el.textContent = message; }, 60);
  }

  function _announcePolite(message) {
    var el = document.getElementById('a11y-live-polite');
    if (!el) {
      el = document.createElement('div');
      el.id = 'a11y-live-polite';
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      el.className = 'sr-only';
      el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
      document.body.appendChild(el);
    }
    el.textContent = '';
    setTimeout(function() { el.textContent = message; }, 60);
  }

  function _matchesReducedMotion() {
    if (!window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function _animationDuration() {
    return _matchesReducedMotion() ? '0ms' : undefined;
  }

  function setupEmojiPickerNav() {
    var picker = document.getElementById('emoji-picker');
    if (!picker) return;

    picker.addEventListener('keydown', function(e) {
      var focusable = _getFocusable(picker);
      if (!focusable.length) return;
      var idx = focusable.indexOf(document.activeElement);
      if (idx < 0) return;

      var cols = 8;
      var next;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          next = Math.min(idx + 1, focusable.length - 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          next = Math.max(idx - 1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          next = Math.min(idx + cols, focusable.length - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          next = Math.max(idx - cols, 0);
          break;
        case 'Home':
          e.preventDefault();
          next = 0;
          break;
        case 'End':
          e.preventDefault();
          next = focusable.length - 1;
          break;
        default:
          return;
      }

      if (next >= 0 && next < focusable.length) {
        focusable[next].focus();
      }
    });
  }

  function setupMessageNav() {
    var wrap = document.getElementById('messages-wrap');
    if (!wrap) return;

    var handler = function(e) {
      if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;

      var msgs = Array.from(wrap.querySelectorAll('.message[data-message-id], .message[data-msg-id]'));
      if (!msgs.length) return;
      var idx = msgs.indexOf(e.target.closest('.message'));
      if (idx < 0) idx = msgs.indexOf(document.activeElement);

      var next = -1;

      switch (e.key) {
        case 'ArrowUp':
          if (e.target === wrap || e.target === document.body) {
            e.preventDefault();
            next = Math.max(idx - 1, 0);
          } else if (idx > 0) {
            e.preventDefault();
            next = idx - 1;
          }
          break;
        case 'ArrowDown':
          if (e.target === wrap || e.target === document.body) {
            e.preventDefault();
            next = Math.min(idx + 1, msgs.length - 1);
          } else if (idx < msgs.length - 1) {
            e.preventDefault();
            next = idx + 1;
          }
          break;
        case 'Home':
          if (idx >= 0 || e.target === wrap) {
            e.preventDefault();
            next = 0;
          }
          break;
        case 'End':
          if (idx >= 0 || e.target === wrap) {
            e.preventDefault();
            next = msgs.length - 1;
          }
          break;
      }

      if (next >= 0 && next < msgs.length) {
        msgs[next].setAttribute('tabindex', '-1');
        msgs[next].focus();
        msgs[next].scrollIntoView({ behavior: _matchesReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
      }
    };

    wrap.addEventListener('keydown', handler);
    _keydownHandlers.push({ el: wrap, fn: handler });
  }

  function manageAriaExpanded() {
    var toggles = document.querySelectorAll(
      '#btn-chat-menu, #btn-emoji, #btn-attach, [onclick*="openChatMenu"], ' +
      '[onclick*="toggleEmoji"], [onclick*="toggleAttach"], ' +
      '[onclick*="openSettings"], [onclick*="toggleSettings"], ' +
      '[data-toggle="menu"], [data-toggle="dropdown"]'
    );

    toggles.forEach(function(btn) {
      if (!btn.hasAttribute('aria-expanded')) {
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          var btn = m.target;
          var expanded = btn.classList.contains('active') ||
            btn.classList.contains('open') ||
            btn.classList.contains('show') ||
            btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', String(!!expanded));
        }
      });
    });

    toggles.forEach(function(btn) {
      observer.observe(btn, { attributes: true, attributeFilter: ['class', 'aria-expanded'] });
    });
  }

  function manageAriaSelected(tabs) {
    var tabEls;
    if (tabs && tabs.length) {
      tabEls = Array.from(tabs);
    } else {
      tabEls = Array.from(document.querySelectorAll(
        '.tab-item[data-tab], [role="tab"], .bottom-nav-item[data-tab], .sidebar-tab'
      ));
    }

    tabEls.forEach(function(tab) {
      if (!tab.hasAttribute('role')) {
        tab.setAttribute('role', 'tab');
      }
      var isActive = tab.classList.contains('active') ||
        tab.classList.contains('selected') ||
        tab.getAttribute('aria-current') === 'page';
      tab.setAttribute('aria-selected', String(!!isActive));
    });

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'aria-current')) {
          var tab = m.target;
          var isActive = tab.classList.contains('active') ||
            tab.classList.contains('selected') ||
            tab.getAttribute('aria-current') === 'page';
          tab.setAttribute('aria-selected', String(!!isActive));
        }
      });
    });

    tabEls.forEach(function(tab) {
      observer.observe(tab, { attributes: true, attributeFilter: ['class', 'aria-current', 'aria-selected'] });
    });
  }

  function setupFocusTrap(container) {
    if (!container) return;
    _previousFocus = document.activeElement;
    _activeTrap = container;

    var handler = function(e) {
      if (e.key !== 'Tab' || _activeTrap !== container) return;

      var focusable = _getFocusable(container);
      if (!focusable.length) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container._a11yTrapHandler = handler;
    document.addEventListener('keydown', handler);

    var escapeHandler = function(e) {
      if (e.key === 'Escape' && _activeTrap === container) {
        var closeBtn = container.querySelector(
          '[onclick*="close"], [onclick*="hide"], [onclick*="Close"], ' +
          '.close-btn, button[aria-label*="close" i], button[aria-label*="Close"]'
        );
        if (closeBtn) closeBtn.click();
        else container.click();
      }
    };

    container._a11yEscapeHandler = escapeHandler;
    document.addEventListener('keydown', escapeHandler);

    var firstFocusable = _getFocusable(container);
    if (firstFocusable.length) {
      firstFocusable[0].focus();
    }
  }

  function releaseFocusTrap() {
    if (_activeTrap) {
      if (_activeTrap._a11yTrapHandler) {
        document.removeEventListener('keydown', _activeTrap._a11yTrapHandler);
        delete _activeTrap._a11yTrapHandler;
      }
      if (_activeTrap._a11yEscapeHandler) {
        document.removeEventListener('keydown', _activeTrap._a11yEscapeHandler);
        delete _activeTrap._a11yEscapeHandler;
      }
    }

    _activeTrap = null;

    if (_previousFocus && _previousFocus.focus) {
      try { _previousFocus.focus(); } catch (e) {}
    }
    _previousFocus = null;
  }

  function addSkipLink(target, label) {
    var targetEl = typeof target === 'string' ? document.querySelector(target) : target;
    if (!targetEl) return;

    var id = 'skip-link-' + (targetEl.id || _skipLinks.length);
    if (document.getElementById(id)) return;

    var link = document.createElement('a');
    link.href = '#' + (targetEl.id || '');
    link.id = id;
    link.className = 'sr-only';
    link.textContent = label || 'Skip to content';
    link.style.cssText = 'position:fixed;top:-100px;left:8px;z-index:99999;padding:12px 24px;' +
      'background:var(--primary);color:var(--on-primary);border-radius:0 0 12px 12px;' +
      'font-weight:700;font-size:14px;text-decoration:none;transition:top 0.2s;';

    link.addEventListener('focus', function() { link.style.top = '0'; });
    link.addEventListener('blur', function() { link.style.top = '-100px'; });
    link.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        targetEl.focus();
        targetEl.scrollIntoView({ behavior: _matchesReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        link.style.top = '-100px';
      }
    });

    document.body.appendChild(link);
    _skipLinks.push(link);
  }

  function announceNewMessage(senderName) {
    _announce('New message from ' + senderName);
  }

  function announceCallEvent(senderName, callType) {
    _announce((callType || 'Incoming') + ' call from ' + senderName);
  }

  function announceTyping(senderName) {
    _announcePolite(senderName + ' is typing');
  }

  function setupReducedMotion() {
    if (!window.matchMedia) return;

    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');

    function apply(reduced) {
      document.documentElement.style.setProperty(
        '--animation-duration',
        reduced ? '0ms' : ''
      );
      if (reduced) {
        document.documentElement.classList.add('reduced-motion');
      } else {
        document.documentElement.classList.remove('reduced-motion');
      }
    }

    apply(mq.matches);

    if (mq.addEventListener) {
      mq.addEventListener('change', function(e) { apply(e.matches); });
    } else if (mq.addListener) {
      mq.addListener(function(e) { apply(e.matches); });
    }
  }

  function auditAccessibility() {
    var issues = [];

    var imgs = document.querySelectorAll('img:not([alt])');
    imgs.forEach(function(img) {
      if (img.offsetParent !== null) {
        issues.push({ type: 'warning', el: img, msg: 'Image missing alt attribute: ' + (img.src || '').slice(-50) });
      }
    });

    var buttons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
    buttons.forEach(function(btn) {
      if (btn.offsetParent !== null && !btn.textContent.trim()) {
        issues.push({ type: 'warning', el: btn, msg: 'Empty button without aria-label' });
      }
    });

    var inputs = document.querySelectorAll('input:not([type="hidden"]):not([aria-label]):not([aria-labelledby])');
    inputs.forEach(function(input) {
      if (input.offsetParent !== null) {
        var id = input.id;
        var hasLabel = id && document.querySelector('label[for="' + id + '"]');
        if (!hasLabel && !input.placeholder) {
          issues.push({ type: 'warning', el: input, msg: 'Input without label or placeholder' });
        }
      }
    });

    var headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    var prevLevel = 0;
    headings.forEach(function(h) {
      var level = parseInt(h.tagName.charAt(1), 10);
      if (level > prevLevel + 1 && prevLevel > 0) {
        issues.push({ type: 'warning', el: h, msg: 'Skipped heading level: h' + prevLevel + ' → h' + level });
      }
      prevLevel = level;
    });

    var focusable = document.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable.forEach(function(el) {
      if (el.offsetParent !== null) {
        var style = window.getComputedStyle(el);
        if (style.outlineStyle === 'none' && style.outlineWidth === '0px' && !el.classList.contains('focus-visible-only')) {
          issues.push({ type: 'info', el: el, msg: 'Focusable element has outline: none (check keyboard visibility)' });
        }
      }
    });

    var liveRegions = document.querySelectorAll('[aria-live]');
    if (liveRegions.length === 0) {
      issues.push({ type: 'info', el: document.body, msg: 'No aria-live regions found on page' });
    }

    var linkTexts = {};
    var links = document.querySelectorAll('a[href]');
    links.forEach(function(a) {
      var text = (a.textContent || '').trim().toLowerCase();
      if (text && a.offsetParent !== null) {
        if (!linkTexts[text]) linkTexts[text] = [];
        linkTexts[text].push(a);
      }
    });
    Object.keys(linkTexts).forEach(function(text) {
      if (linkTexts[text].length > 1 && ['click here', 'read more', 'here', 'more'].indexOf(text) >= 0) {
        issues.push({ type: 'warning', el: linkTexts[text][0], msg: 'Non-descriptive link text: "' + text + '" used ' + linkTexts[text].length + ' times' });
      }
    });

    if (typeof console !== 'undefined') {
      console.group('%c[A11y Audit] ' + issues.length + ' issues found', 'color: #e91e63; font-weight: bold;');
      issues.forEach(function(issue) {
        var style = issue.type === 'warning' ? 'color: orange;' : 'color: #2196f3;';
        if (window.__DEBUG__) console.log('%c' + issue.type.toUpperCase() + ': ' + issue.msg, style, issue.el);
      });
      console.groupEnd();
    }

    return issues;
  }

  function _addRoleAttributes() {
    var alertToasts = document.querySelectorAll('[class*="error-toast"], [class*="error-message"], [role="alert"]');
    alertToasts.forEach(function(el) {
      if (!el.hasAttribute('role')) el.setAttribute('role', 'alert');
    });

    var statusToasts = document.querySelectorAll('[class*="info-toast"], [class*="status-toast"], [class*="success-toast"]');
    statusToasts.forEach(function(el) {
      if (!el.hasAttribute('role')) el.setAttribute('role', 'status');
    });

    var chatList = document.getElementById('chat-list');
    if (chatList && !chatList.hasAttribute('role')) {
      chatList.setAttribute('role', 'list');
      chatList.setAttribute('aria-label', 'Conversations');
    }

    var msgWrap = document.getElementById('messages-wrap');
    if (msgWrap && !msgWrap.hasAttribute('role')) {
      msgWrap.setAttribute('role', 'log');
      msgWrap.setAttribute('aria-label', 'Messages');
      msgWrap.setAttribute('aria-live', 'polite');
    }

    var attachMenu = document.getElementById('attach-menu');
    if (attachMenu && !attachMenu.hasAttribute('role')) {
      attachMenu.setAttribute('role', 'menu');
    }

    var emojiPicker = document.getElementById('emoji-picker');
    if (emojiPicker && !emojiPicker.hasAttribute('role')) {
      emojiPicker.setAttribute('role', 'dialog');
      emojiPicker.setAttribute('aria-modal', 'true');
      emojiPicker.setAttribute('aria-label', 'Emoji picker');
    }
  }

  function _setupEscapeHandlers() {
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape') return;

      var attachMenu = document.getElementById('attach-menu');
      if (attachMenu && !attachMenu.classList.contains('hidden')) {
        if (typeof window.closeAttachMenu === 'function') window.closeAttachMenu();
        return;
      }

      var emojiPicker = document.getElementById('emoji-picker');
      if (emojiPicker && !emojiPicker.classList.contains('hidden')) {
        if (typeof window.toggleEmoji === 'function') window.toggleEmoji();
        return;
      }

      var profileOverlay = document.getElementById('profile-overlay');
      if (profileOverlay && !profileOverlay.classList.contains('hidden')) {
        if (typeof window.closeModal === 'function') window.closeModal('profile-overlay');
        return;
      }
    });
  }

  function _setupNewMessageAnnouncements() {
    var msgWrap = document.getElementById('messages-wrap');
    if (!msgWrap) return;

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          var msgEl = node.classList && node.classList.contains('message') ? node : node.querySelector('.message');
          if (!msgEl) return;
          if (msgEl.classList.contains('my-message')) return;

          var nameEl = msgEl.querySelector('.message-sender, .sender-name, [class*="sender"]');
          var name = nameEl ? nameEl.textContent.trim() : '';
          if (name) {
            setTimeout(function() { announceNewMessage(name); }, 200);
          }
        });
      });
    });

    observer.observe(msgWrap, { childList: true, subtree: true });
  }

  function initA11yEnhancements() {
    setupEmojiPickerNav();
    setupMessageNav();
    manageAriaExpanded();
    manageAriaSelected();
    setupReducedMotion();
    _addRoleAttributes();
    _setupEscapeHandlers();
    _setupNewMessageAnnouncements();
    addSkipLink('#messages-wrap', 'Skip to main content');
    addSkipLink('#chat-list', 'Skip to chat list');
  }

  window.initA11yEnhancements = initA11yEnhancements;
  window.setupEmojiPickerNav = setupEmojiPickerNav;
  window.setupMessageNav = setupMessageNav;
  window.manageAriaExpanded = manageAriaExpanded;
  window.manageAriaSelected = manageAriaSelected;
  window.announceToScreenReader = _announce;
  window.setupFocusTrap = setupFocusTrap;
  window.releaseFocusTrap = releaseFocusTrap;
  window.addSkipLink = addSkipLink;
  window.auditAccessibility = auditAccessibility;
  window.announceNewMessage = announceNewMessage;
  window.announceCallEvent = announceCallEvent;
  window.announceTyping = announceTyping;
})();
