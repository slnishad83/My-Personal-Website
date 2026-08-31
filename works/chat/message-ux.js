/* message-ux.js — Message-level UX enhancements:
   1. Tappable reply preview — tap the composer reply bar to scroll to the original message.
   2. Per-message disappearing (view-once / self-destruct) countdown badge with live ticking.
   3. Message-level Report option (context menu) backed by `messageReports` collection.
*/
(function () {
  'use strict';

  var _esc = function (s) {
    return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
  };
  var _toast = function (msg, t) { if (typeof window.showToast === 'function') window.showToast(msg, t); };
  var _db = function () { return window.App && App.db ? App.db : (typeof firebase !== 'undefined' ? firebase.firestore() : null); };
  var _uid = function () { return window.currentUser && currentUser.uid ? currentUser.uid : (window.App && App.auth && App.auth.currentUser ? App.auth.currentUser.uid : null); };
  var _debug = function () { if (window.__DEBUG__) { try { console.log.apply(console, ['[MsgUX]'].concat(Array.prototype.slice.call(arguments))); } catch (_e) {} } };
  var _chatId = function () { return window.currentChat && currentChat.id ? currentChat.id : (window.App && App.currentChat ? App.currentChat.id : null); };
  var _chatType = function () { return window.currentChatType || (window.App && App.currentChatType) || 'direct'; };

  function _coll() { return (_chatType() === 'group' || (_chatType() !== 'broadcast' && window.currentChat && currentChat.type === 'group')) ? 'groups' : 'chats'; }

  /* ════════════════════════════════════════════════════════════
     1. TAPPABLE REPLY PREVIEW — scroll to original message
     ════════════════════════════════════════════════════════════ */
  function patchReplyPreviewTap() {
    document.addEventListener('click', function (e) {
      var bar = document.getElementById('reply-preview');
      if (!bar || bar.classList.contains('hidden')) return;
      if (e.target.closest('[data-action="cancelReply"]')) return;
      if (!e.target.closest('#reply-preview')) return;
      var msgId = bar.getAttribute('data-reply-to') || bar.dataset.replyTo;
      if (!msgId) return;
      var el = document.querySelector('[data-msg-id="' + msgId + '"],[data-message-id="' + msgId + '"]');
      if (el) {
        if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background-color .4s ease, box-shadow .4s ease';
        el.style.backgroundColor = 'rgba(0,168,132,0.18)';
        el.style.boxShadow = '0 0 0 2px rgba(0,168,132,0.45)';
        el.style.borderRadius = '10px';
        setTimeout(function () {
          el.style.backgroundColor = '';
          el.style.boxShadow = '';
        }, 2200);
      } else if (typeof window.highlightMessage === 'function') {
        window.highlightMessage(msgId);
      }
    });
  }

  /* ════════════════════════════════════════════════════════════
     2. PER-MESSAGE DISAPPEARING COUNTDOWN
     ════════════════════════════════════════════════════════════ */
  var _countdownInterval = null;
  var _lastTime = 0;

  function _normalizeTs(ts) {
    if (!ts) return 0;
    if (ts.toMillis) return ts.toMillis();
    if (ts.seconds) return ts.seconds * 1000;
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'number') return ts;
    return parseInt(ts, 10) || 0;
  }

  function _msgFromRow(row) {
    var msgId = row.getAttribute('data-msg-id') || row.getAttribute('data-message-id');
    if (!msgId) return null;
    var msgs = (typeof window.getCurrentMessages === 'function') ? window.getCurrentMessages() : null;
    if (msgs && Array.isArray(msgs)) {
      for (var i = 0; i < msgs.length; i++) {
        if (msgs[i] && msgs[i].id === msgId) return msgs[i];
      }
    }
    return null;
  }

  function _msgExpiryFromData(msg) {
    if (!msg) return 0;
    if (msg.expiresAt) {
      var e = _normalizeTs(msg.expiresAt);
      if (e > 0) return e;
    }
    if (msg.disappearIn) {
      var d = _normalizeTs(msg.disappearIn);
      if (d > 0) return d;
    }
    if (msg.selfDestructTimer && msg.timestamp) {
      var s = _normalizeTs(msg.selfDestructTimer) + _normalizeTs(msg.timestamp);
      if (s > 0) return s;
    }
    if (msg.viewOnce && msg.viewedAt) {
      var v = _normalizeTs(msg.viewedAt) + 60000;
      return v;
    }
    return 0;
  }

  function _msgExpiryMs(row) {
    var expAttr = row.getAttribute('data-expires-at');
    if (expAttr) return parseInt(expAttr, 10) || 0;
    var msg = _msgFromRow(row);
    return _msgExpiryFromData(msg);
  }

  function _fmt(ms) {
    ms = Math.max(0, ms);
    var s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60);
    s = s % 60;
    if (m < 60) return m + 'm ' + s + 's';
    var h = Math.floor(m / 60);
    m = m % 60;
    return h + 'h ' + m + 'm';
  }

  function _animateRow(row, expiry) {
    if (expiry <= Date.now()) {
      _fadeAndHideRow(row);
      return;
    }
    var bubble = row.querySelector('.message-bubble') || row.querySelector('.msg-bubble');
    if (!bubble) return;
    if (bubble.querySelector('.msgux-countdown')) return;
    var badge = document.createElement('span');
    badge.className = 'msgux-countdown';
    badge.setAttribute('data-expiry', String(expiry));
    badge.style.cssText = 'display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;color:var(--error,#d32f2f);background:rgba(211,47,47,0.12);border-radius:8px;padding:1px 6px;margin-left:4px;white-space:nowrap;';
    badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px">timer</span><span class="msgux-countdown-val"></span>';
    bubble.appendChild(badge);
  }

  function _fadeAndHideRow(row) {
    row.style.transition = 'opacity .5s ease';
    row.style.opacity = '0';
    setTimeout(function () {
      if (row && row.parentNode) row.parentNode.removeChild(row);
      document.dispatchEvent(new CustomEvent('tc:message-expired', { detail: { } }));
    }, 500);
  }

  function _renderCountdowns() {
    var now = Date.now();
    var wrap = document.getElementById('messages-wrap');
    if (!wrap) return;
    var rows = wrap.querySelectorAll('.message-row');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var expiry = _msgExpiryMs(row);
      if (!expiry) continue;
      if (!row.getAttribute('data-expires-at')) row.setAttribute('data-expires-at', String(expiry));
      if (expiry <= now) { _fadeAndHideRow(row); continue; }
      var bubble = row.querySelector('.message-bubble') || row;
      if (!bubble) continue;
      var badge = bubble.querySelector('.msgux-countdown');
      var val = badge ? badge.querySelector('.msgux-countdown-val') : null;
      if (!badge || !val) { _animateRow(row, expiry); continue; }
      val.textContent = _fmt(expiry - now);
    }
  }

  var _observer = null;
  function startCountdownWatcher() {
    if (_countdownInterval) return;
    _countdownInterval = setInterval(_renderCountdowns, 1000);
    _renderCountdowns();
    if (_observer || typeof MutationObserver === 'undefined') return;
    _observer = new MutationObserver(function () {
      _renderCountdowns();
    });
    var wrap = document.getElementById('messages-wrap');
    if (wrap) _observer.observe(wrap, { childList: true, subtree: true });
  }

  /* ════════════════════════════════════════════════════════════
     3. MESSAGE-LEVEL REPORT
     ════════════════════════════════════════════════════════════ */
  var _currentReport = null;

  function openReportMessage(msgId, senderName, senderId, messageText) {
    var uid = _uid();
    if (!uid) { _toast('Please sign in to report', 'error'); return; }
    _currentReport = { msgId: msgId, senderName: senderName || 'Someone', senderId: senderId || null, messageText: messageText || '', reporterId: uid, chatId: _chatId(), chatType: _chatType() };
    var existing = document.getElementById('msgux-report-overlay');
    if (existing) existing.remove();

    var categories = [
      { v: 'spam', label: 'Spam', desc: 'Unsolicited or misleading content' },
      { v: 'harassment', label: 'Harassment', desc: 'Bullying or threatening messages' },
      { v: 'inappropriate', label: 'Inappropriate content', desc: 'Offensive or explicit material' },
      { v: 'scam', label: 'Scam or fraud', desc: 'Attempts to deceive or defraud' },
      { v: 'other', label: 'Other', desc: 'Something else' }
    ];

    var overlay = document.createElement('div');
    overlay.id = 'msgux-report-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);padding:16px;';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

    var sheet = document.createElement('div');
    sheet.style.cssText = 'width:100%;max-width:420px;background:var(--surface,#fff);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

    var header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08));display:flex;align-items:center;justify-content:space-between;';
    header.innerHTML = '<h3 style="margin:0;font-size:16px;font-weight:700;color:var(--on-surface,#1a1a1a);">Report message</h3>' +
      '<button id="msgux-report-close" style="background:none;border:none;font-size:22px;color:var(--on-surface-variant,#666);cursor:pointer;padding:4px;">&times;</button>';
    sheet.appendChild(header);

    var body = document.createElement('div');
    body.style.cssText = 'padding:16px 20px;';
    var info = document.createElement('div');
    info.style.cssText = 'font-size:12px;color:var(--on-surface-variant,#777);margin-bottom:12px;';
    info.textContent = 'Reporting a message from ' + _esc(senderName) + '. This will not notify the sender.';
    body.appendChild(info);
    if (messageText) {
      var quote = document.createElement('div');
      quote.style.cssText = 'background:var(--surface-variant,rgba(0,0,0,0.04));border-left:3px solid var(--primary,#00a884);padding:8px 10px;border-radius:6px;font-size:13px;color:var(--on-surface,#1a1a1a);margin-bottom:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      quote.textContent = messageText;
      body.appendChild(quote);
    }
    var cats = document.createElement('div');
    cats.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:12px;';
    categories.forEach(function (c) {
      var label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:14px;color:var(--on-surface,#1a1a1a);';
      label.innerHTML = '<input type="radio" name="msgux-report-reason" value="' + c.v + '" style="accent-color:var(--primary,#00a884);width:16px;height:16px;flex-shrink:0;">' +
        '<span><span style="font-weight:600;display:block;">' + _esc(c.label) + '</span><span style="font-size:12px;color:var(--on-surface-variant,#777);">' + _esc(c.desc) + '</span></span>';
      cats.appendChild(label);
    });
    body.appendChild(cats);

    var details = document.createElement('textarea');
    details.id = 'msgux-report-details';
    details.maxLength = 500;
    details.placeholder = 'Add any additional details (optional)...';
    details.style.cssText = 'width:100%;min-height:70px;max-height:120px;padding:10px 12px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.12));background:var(--surface-variant,rgba(0,0,0,0.03));color:var(--on-surface,#1a1a1a);font-size:13px;font-family:inherit;resize:vertical;outline:none;box-sizing:border-box;';
    body.appendChild(details);
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:var(--on-surface-variant,#777);text-align:right;margin-top:4px;';
    hint.id = 'msgux-report-count';
    hint.textContent = '0/500';
    body.appendChild(hint);
    sheet.appendChild(body);

    var actions = document.createElement('div');
    actions.style.cssText = 'padding:12px 20px 20px;border-top:1px solid var(--outline-variant,rgba(0,0,0,0.06));display:flex;gap:10px;';
    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'flex:1;padding:10px;border-radius:10px;border:1px solid var(--outline-variant,rgba(0,0,0,0.15));background:transparent;color:var(--on-surface-variant,#666);font-size:14px;font-weight:600;cursor:pointer;';
    cancelBtn.addEventListener('click', function () { overlay.remove(); });
    actions.appendChild(cancelBtn);
    var submitBtn = document.createElement('button');
    submitBtn.textContent = 'Report';
    submitBtn.disabled = true;
    submitBtn.style.cssText = 'flex:1;padding:10px;border-radius:10px;border:none;background:var(--primary,#00a884);color:#fff;font-size:14px;font-weight:700;cursor:pointer;opacity:0.4;';
    actions.appendChild(submitBtn);
    sheet.appendChild(actions);

    body.querySelectorAll('input[name="msgux-report-reason"]').forEach(function (rb) {
      rb.addEventListener('change', function () {
        submitBtn.disabled = false;
        submitBtn.style.opacity = 1;
      });
    });
    details.addEventListener('input', function () {
      var n = details.value.length;
      hint.textContent = n + '/500';
    });
    submitBtn.addEventListener('click', async function () {
      var reasonEl = body.querySelector('input[name="msgux-report-reason"]:checked');
      var reason = reasonEl ? reasonEl.value : '';
      if (!reason) { _toast('Please select a reason', 'error'); return; }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      var ok = await submitMessageReport(reason, details.value.trim());
      if (ok) { overlay.remove(); }
      else { submitBtn.disabled = false; submitBtn.textContent = 'Report'; submitBtn.style.opacity = 1; }
    });

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    document.getElementById('msgux-report-close').addEventListener('click', function () { overlay.remove(); });

    (function () {
      var btn = document.getElementById('msgux-report-close');
      if (btn) btn.addEventListener('click', function () { overlay.remove(); });
    })();
  }

  async function submitMessageReport(reason, details) {
    var rep = _currentReport;
    if (!rep || !reason) return false;
    var db = _db();
    if (!db) { _toast('Unable to report — offline', 'error'); return false; }
    try {
      await db.collection('messageReports').add({
        reporterUserId: rep.reporterId,
        reporterId: rep.reporterId,
        reportedUserId: rep.senderId || null,
        messageId: rep.msgId,
        senderId: rep.senderId || null,
        senderName: rep.senderName || null,
        chatId: rep.chatId || null,
        chatType: rep.chatType || null,
        reason: reason,
        details: details || '',
        createdAt: typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : Date.now(),
        status: 'pending'
      });
      _toast('Message reported. We\'ll review it shortly.', 'success');
      _currentReport = null;
      return true;
    } catch (err) {
      _debug('submitMessageReport failed:', err);
      _toast('Failed to submit report. Please try again.', 'error');
      return false;
    }
  }

  /* ════════════════════════════════════════════════════════════
     Init
     ════════════════════════════════════════════════════════════ */
  function init() {
    patchReplyPreviewTap();
    startCountdownWatcher();
    document.addEventListener('nsl:chat-opened', startCountdownWatcher);
    document.addEventListener('tc:chat-opened', startCountdownWatcher);
    if (window.MutationBus && typeof MutationBus.onBodyChildList === 'function') {
      MutationBus.onBodyChildList('msgux-countdown', function () { _renderCountdowns(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.MessageUX = {
    openReportMessage: openReportMessage,
    submitMessageReport: submitMessageReport,
    scrollToMessage: function (msgId) {
      var el = document.querySelector('[data-msg-id="' + msgId + '"],[data-message-id="' + msgId + '"]');
      if (el) { if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; }
      if (typeof window.highlightMessage === 'function') { window.highlightMessage(msgId); return true; }
      return false;
    }
  };
})();
