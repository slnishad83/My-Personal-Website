'use strict';
(function () {
  var QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  var ALL_REACTION_EMOJIS = [
    '👍', '👎', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
    '😂', '🤣', '😭', '😤', '🤯', '🥺', '😴', '🤔', '😏', '🙄',
    '😮', '😱', '🤮', '🤧', '😇', '😈', '🤡', '💀', '👻', '👽',
    '🙏', '👏', '🤝', '💪', '🫶', '✋', '👋', '🤙', '👆', '👇',
    '❤️‍🔥', '💔', '💯', '🔥', '⭐', '🎉', '🎊', '✅', '❌', '⚠️'
  ];

  var _usageCounts = {};
  var _activePicker = null;
  var _reactionUnsubscribes = {};

  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  var _db = function() { return App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };

  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };

  function _loadUsageCounts() {
    try {
      _usageCounts = JSON.parse(localStorage.getItem('nsl_reaction_usage') || '{}');
    } catch (_) {
      _usageCounts = {};
    }
  }

  function _saveUsageCounts() {
    try {
      localStorage.setItem('nsl_reaction_usage', JSON.stringify(_usageCounts));
    } catch (_) {}
  }

  function _recordUsage(emoji) {
    _usageCounts[emoji] = (_usageCounts[emoji] || 0) + 1;
    _saveUsageCounts();
  }

  function getQuickReactions() {
    var sorted = Object.keys(_usageCounts).sort(function (a, b) {
      return (_usageCounts[b] || 0) - (_usageCounts[a] || 0);
    });
    var result = [];
    for (var i = 0; i < sorted.length && result.length < 6; i++) {
      result.push(sorted[i]);
    }
    QUICK_EMOJIS.forEach(function (e) {
      if (result.length < 6 && result.indexOf(e) === -1) result.push(e);
    });
    return result.slice(0, 6);
  }

  function _ensureAnimationStyle() {
    if (document.getElementById('nsl-reaction-anim-style')) return;
    var style = document.createElement('style');
    style.id = 'nsl-reaction-anim-style';
    style.textContent =
      '@keyframes nslReactionBounce{0%{transform:scale(0);opacity:0}50%{transform:scale(1.3)}100%{transform:scale(1);opacity:1}}' +
      '@keyframes nslReactionPop{0%{transform:scale(1)}30%{transform:scale(1.4)}100%{transform:scale(1)}}' +
      '@keyframes nslShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}' +
      '.nsl-reaction-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:12px;font-size:12px;border:1px solid var(--outline-variant,#ccc);background:var(--surface-container-high,#f0f0f0);cursor:pointer;transition:all .15s;animation:nslReactionBounce .3s ease}' +
      '.nsl-reaction-badge:hover{background:var(--surface-variant,#e0e0e0)}' +
      '.nsl-reaction-badge.active{background:var(--primary,#6750A4);color:var(--on-primary,#fff);border-color:var(--primary,#6750A4)}' +
      '.nsl-reaction-badge .nsl-r-count{font-size:10px;font-weight:600}' +
      '.nsl-reaction-bar{display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:20px;background:var(--surface-container,#fff);border:1px solid var(--outline-variant,#ddd);box-shadow:0 2px 12px rgba(0,0,0,0.15);animation:nslReactionBounce .2s ease}' +
      '.nsl-reaction-bar button{background:none;border:none;font-size:20px;cursor:pointer;padding:4px 6px;border-radius:8px;transition:transform .12s;line-height:1}' +
      '.nsl-reaction-bar button:hover{transform:scale(1.3)}' +
      '.nsl-full-picker{position:fixed;z-index:99999;background:var(--surface-container,#fff);border:1px solid var(--outline-variant,#ddd);border-radius:16px;padding:12px;box-shadow:0 4px 24px rgba(0,0,0,0.25);animation:nslReactionBounce .2s ease}' +
      '.nsl-full-picker-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;max-height:250px;overflow-y:auto}' +
      '.nsl-full-picker-grid button{background:none;border:none;font-size:22px;cursor:pointer;padding:6px;border-radius:8px;transition:transform .12s;line-height:1}' +
      '.nsl-full-picker-grid button:hover{transform:scale(1.3);background:var(--surface-variant,#e0e0e0)}' +
      '.nsl-reaction-viewer{position:fixed;z-index:99999;background:var(--surface-container,#fff);border:1px solid var(--outline-variant,#ddd);border-radius:12px;padding:10px 14px;box-shadow:0 4px 20px rgba(0,0,0,0.2);max-width:250px;max-height:200px;overflow-y:auto}' +
      '.nsl-reaction-viewer .nsl-rv-row{display:flex;align-items:center;gap:6px;padding:4px 0;font-size:13px;border-bottom:1px solid var(--outline-variant,#eee)}' +
      '.nsl-reaction-viewer .nsl-rv-row:last-child{border-bottom:none}';
    document.head.appendChild(style);
  }

  function _removeActivePickers() {
    if (_activePicker) {
      _activePicker.remove();
      _activePicker = null;
    }
    document.querySelectorAll('.nsl-full-picker, .nsl-reaction-bar, .nsl-reaction-viewer').forEach(function (el) { el.remove(); });
  }

  function showReactionPicker(msgId) {
    _removeActivePickers();
    _ensureAnimationStyle();

    var quick = getQuickReactions();
    var bar = document.createElement('div');
    bar.className = 'nsl-reaction-bar';

    quick.forEach(function (emoji) {
      var btn = document.createElement('button');
      btn.textContent = emoji;
      btn.onclick = function (e) {
        e.stopPropagation();
        _removeActivePickers();
        toggleReaction(msgId, emoji);
      };
      bar.appendChild(btn);
    });

    var moreBtn = document.createElement('button');
    moreBtn.textContent = '➕';
    moreBtn.style.fontSize = '16px';
    moreBtn.onclick = function (e) {
      e.stopPropagation();
      bar.remove();
      _showFullPicker(msgId);
    };
    bar.appendChild(moreBtn);

    document.body.appendChild(bar);
    _activePicker = bar;

    var msgEl = document.querySelector('[data-message-id="' + msgId + '"]');
    if (msgEl) {
      var rect = msgEl.getBoundingClientRect();
      bar.style.position = 'fixed';
      bar.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - 300)) + 'px';
      bar.style.top = Math.max(10, rect.top - 50) + 'px';
    } else {
      bar.style.position = 'fixed';
      bar.style.left = '50%';
      bar.style.top = '50%';
      bar.style.transform = 'translate(-50%, -50%)';
    }

    setTimeout(function () {
      document.addEventListener('click', function closeBar() {
        _removeActivePickers();
        document.removeEventListener('click', closeBar);
      }, { once: true });
    }, 20);
  }

  function _showFullPicker(msgId) {
    _ensureAnimationStyle();
    var picker = document.createElement('div');
    picker.className = 'nsl-full-picker';

    var search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search emoji...';
    search.style.cssText = 'width:100%;padding:6px 10px;border:1px solid var(--outline-variant,#ccc);border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box;background:var(--surface,#fff);color:var(--on-surface,#000)';
    picker.appendChild(search);

    var grid = document.createElement('div');
    grid.className = 'nsl-full-picker-grid';

    function renderGrid(filter) {
      grid.innerHTML = '';
      var list = filter
        ? ALL_REACTION_EMOJIS.filter(function (e) { return e.indexOf(filter) !== -1; })
        : ALL_REACTION_EMOJIS;
      list.forEach(function (emoji) {
        var btn = document.createElement('button');
        btn.textContent = emoji;
        btn.onclick = function (e) {
          e.stopPropagation();
          _removeActivePickers();
          toggleReaction(msgId, emoji);
        };
        grid.appendChild(btn);
      });
    }

    renderGrid('');
    search.addEventListener('input', function () { renderGrid(search.value); });
    picker.appendChild(grid);

    document.body.appendChild(picker);
    _activePicker = picker;
    picker.style.left = '50%';
    picker.style.top = '50%';
    picker.style.transform = 'translate(-50%, -50%)';
    search.focus();

    setTimeout(function () {
      document.addEventListener('click', function closePicker(ev) {
        if (!picker.contains(ev.target)) {
          _removeActivePickers();
          document.removeEventListener('click', closePicker);
        }
      }, { once: true });
    }, 20);
  }

  function _showReactionViewer(msgId, reactions) {
    _removeActivePickers();
    _ensureAnimationStyle();

    var viewer = document.createElement('div');
    viewer.className = 'nsl-reaction-viewer';

    var allUsers = window.allUsers || [];
    var userMap = {};
    allUsers.forEach(function (u) { userMap[u.uid] = u.displayName || u.email || 'User'; });

    Object.keys(reactions).sort(function (a, b) {
      return (reactions[b] || []).length - (reactions[a] || []).length;
    }).forEach(function (emoji) {
      var users = reactions[emoji] || [];
      users.forEach(function (uid) {
        var row = document.createElement('div');
        row.className = 'nsl-rv-row';
        row.innerHTML = '<span>' + _esc(emoji) + '</span><span>' + _esc(userMap[uid] || uid.substring(0, 8)) + '</span>';
        viewer.appendChild(row);
      });
    });

    document.body.appendChild(viewer);

    var msgEl = document.querySelector('[data-message-id="' + msgId + '"]');
    if (msgEl) {
      var badgeEl = msgEl.querySelector('.nsl-reaction-badge');
      if (badgeEl) {
        var rect = badgeEl.getBoundingClientRect();
        viewer.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - 260)) + 'px';
        viewer.style.top = Math.max(10, rect.top - viewer.offsetHeight - 8) + 'px';
        if (parseInt(viewer.style.top) < 10) {
          viewer.style.top = (rect.bottom + 8) + 'px';
        }
      }
    }

    setTimeout(function () {
      document.addEventListener('click', function closeViewer() {
        viewer.remove();
        document.removeEventListener('click', closeViewer);
      }, { once: true });
    }, 20);
  }

  async function toggleReaction(msgId, emoji) {
    var d = _db();
    var uid = _uid();
    if (!d || !uid || !msgId) return;

    _recordUsage(emoji);

    try {
      var msgRef = d.collection('messages').doc(msgId);
      var snap = await msgRef.get();
      if (!snap.exists) return;

      var data = snap.data();
      var reactions = data.reactions || {};
      var users = reactions[emoji] || [];

      var idx = users.indexOf(uid);
      if (idx !== -1) {
        users.splice(idx, 1);
        if (users.length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = users;
        }
      } else {
        reactions[emoji] = users.concat([uid]);
      }

      await msgRef.update({ reactions: reactions });

      if (idx === -1) {
        _sendReactionNotification(msgId, emoji, data);
      }
    } catch (err) {
      console.error('Reaction error:', err);
      if (typeof showToast === 'function') showToast('Failed to react', 'error');
    }
  }

  function _sendReactionNotification(msgId, emoji, msgData) {
    var uid = _uid();
    if (!uid) return;
    if (msgData.senderId === uid) return;

    var senderName = 'Someone';
    if (window.currentUser) senderName = window.currentUser.displayName || window.currentUser.email || 'Someone';

    try {
      if (typeof window.sendPushNotification === 'function') {
        window.sendPushNotification(msgData.senderId, {
          title: senderName + ' reacted ' + emoji,
          body: msgData.text ? msgData.text.substring(0, 100) : 'to your message',
          tag: 'reaction-' + msgId,
          url: window.location.href
        });
      }
    } catch (_) {}
  }

  function renderReactions(msgId, reactions) {
    _ensureAnimationStyle();
    var uid = _uid();
    if (!reactions || typeof reactions !== 'object') return '';

    var keys = Object.keys(reactions);
    if (keys.length === 0) return '';

    var sorted = keys.filter(function (k) {
      return reactions[k] && reactions[k].length > 0;
    }).sort(function (a, b) {
      return (reactions[b] || []).length - (reactions[a] || []).length;
    });

    if (sorted.length === 0) return '';

    var html = '<div class="nsl-reactions-container" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">';
    sorted.forEach(function (emoji) {
      var users = reactions[emoji] || [];
      var isActive = uid && users.indexOf(uid) !== -1;
      html += '<button class="nsl-reaction-badge' + (isActive ? ' active' : '') + '" data-msg-id="' + _esc(msgId) + '" data-emoji="' + _esc(emoji) + '">';
      html += '<span>' + _esc(emoji) + '</span>';
      html += '<span class="nsl-r-count">' + users.length + '</span>';
      html += '</button>';
    });
    html += '</div>';
    return html;
  }

  function _attachReactionListeners(container) {
    if (!container) return;
    container.addEventListener('click', function (e) {
      var badge = e.target.closest('.nsl-reaction-badge');
      if (badge) {
        e.stopPropagation();
        var msgId = badge.dataset.msgId;
        var emoji = badge.dataset.emoji;
        if (msgId && emoji) toggleReaction(msgId, emoji);
        return;
      }
    });

    container.addEventListener('dblclick', function (e) {
      var msgEl = e.target.closest('[data-message-id]');
      if (msgEl) {
        e.preventDefault();
        var msgId = msgEl.dataset.messageId;
        if (msgId) showReactionPicker(msgId);
      }
    });

    container.addEventListener('contextmenu', function (e) {
      var msgEl = e.target.closest('[data-message-id]');
      if (msgEl) {
        var msgId = msgEl.dataset.messageId;
        if (msgId) {
          e.preventDefault();
          e.stopPropagation();
          showReactionPicker(msgId);
        }
      }
    });
  }

  function subscribeToReactions(msgId) {
    var d = _db();
    if (!d || !msgId) return;

    if (_reactionUnsubscribes[msgId]) return;

    _reactionUnsubscribes[msgId] = d.collection('messages').doc(msgId)
      .onSnapshot(function (snap) {
        if (!snap.exists) return;
        var data = snap.data();
        var reactions = data.reactions || {};
        var badges = renderReactions(msgId, reactions);
        var msgEl = document.querySelector('[data-message-id="' + msgId + '"]');
        if (!msgEl) return;

        var existing = msgEl.querySelector('.nsl-reactions-container');
        if (Object.keys(reactions).length === 0) {
          if (existing) existing.remove();
          return;
        }

        if (existing) {
          existing.outerHTML = badges;
        } else {
          var bubble = msgEl.querySelector('.message-bubble, .msg-bubble, [class*="bubble"]');
          if (bubble) {
            bubble.insertAdjacentHTML('afterend', badges);
          } else {
            msgEl.insertAdjacentHTML('beforeend', badges);
          }
        }
      });
  }

  function unsubscribeAllReactions() {
    Object.keys(_reactionUnsubscribes).forEach(function (msgId) {
      try { _reactionUnsubscribes[msgId](); } catch (_) {}
    });
    _reactionUnsubscribes = {};
  }

  function initReactionListeners(container) {
    if (!container) container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) return;
    _attachReactionListeners(container);
  }

  function wireReactionPostRender() {
    if (typeof MutationObserver === 'undefined') return;
    var container = document.getElementById('messagesContainer') || document.getElementById('messagesList');
    if (!container) {
      setTimeout(wireReactionPostRender, 1000);
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          var msgEl = node.dataset && node.dataset.messageId ? node : node.querySelector('[data-message-id]');
          if (!msgEl) return;
          var msgId = msgEl.dataset.messageId;
          if (!msgId) return;
          subscribeToReactions(msgId);
        });
      });
    });

    observer.observe(container, { childList: true, subtree: true });

    container.querySelectorAll('[data-message-id]').forEach(function (el) {
      subscribeToReactions(el.dataset.messageId);
    });
  }

  _loadUsageCounts();
  _ensureAnimationStyle();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initReactionListeners();
      wireReactionPostRender();
    });
  } else {
    initReactionListeners();
    wireReactionPostRender();
  }

  window.toggleReaction = toggleReaction;
  window.showReactionPicker = showReactionPicker;
  window.renderReactions = renderReactions;
  window.getQuickReactions = getQuickReactions;
  window.initReactionListeners = initReactionListeners;
  window.wireReactionPostRender = wireReactionPostRender;
  window.unsubscribeAllReactions = unsubscribeAllReactions;
})();
