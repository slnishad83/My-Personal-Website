(function () {
  'use strict';

  var REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
  var RATE_LIMIT = 10;
  var RATE_WINDOW = 5000;
  var ANIMATION_DURATION = 3000;
  var FLOAT_DISTANCE = 200;

  var _rateTimestamps = [];
  var _reactionUnsub = null;
  var _pickerVisible = false;
  var _pickerEl = null;
  var _containerEl = null;
  var _popCtx = null;

  function getDb() { return window.db || (window.App && window.App.db) || null; }
  function getUser() { return window.currentUser || (window.App && window.App.currentUser) || null; }
  function getActiveCallId() { return (window.App && window.App._activeCallId) || null; }
  function toast(msg, type) { if (typeof window.showToast === 'function') window.showToast(msg, type); }

  function injectStyles() {
    if (document.getElementById('icr-styles')) return;
    var s = document.createElement('style');
    s.id = 'icr-styles';
    s.textContent = '\
      .icr-reaction-trigger{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.12);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;transition:all 0.2s;position:relative}\
      .icr-reaction-trigger:active{transform:scale(0.9)}\
      .icr-reaction-trigger:hover{background:rgba(255,255,255,0.2)}\
      .icr-picker{position:absolute;bottom:60px;left:50%;transform:translateX(-50%) scale(0.8);background:rgba(30,30,30,0.95);backdrop-filter:blur(12px);border-radius:28px;padding:8px 12px;display:none;gap:4px;box-shadow:0 8px 32px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);opacity:0;transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1);z-index:10}\
      .icr-picker.visible{display:flex;opacity:1;transform:translateX(-50%) scale(1)}\
      .icr-picker-btn{width:44px;height:44px;border-radius:50%;border:none;background:transparent;font-size:26px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s}\
      .icr-picker-btn:hover{background:rgba(255,255,255,0.15);transform:scale(1.2)}\
      .icr-picker-btn:active{transform:scale(0.9)}\
      .icr-float-container{position:fixed;inset:0;pointer-events:none;z-index:110;overflow:hidden}\
      .icr-floating-emoji{position:absolute;font-size:36px;animation:icrFloatUp var(--icr-duration) ease-out forwards;pointer-events:none;will-change:transform,opacity}\
      @keyframes icrFloatUp{0%{opacity:1;transform:translateY(0) scale(1)}20%{opacity:1;transform:translateY(calc(var(--icr-float) * 0.2)) scale(1.15)}60%{opacity:0.8;transform:translateY(calc(var(--icr-float) * 0.7)) scale(1.3)}100%{opacity:0;transform:translateY(var(--icr-float)) scale(1.5)}}\
      .icr-sender-label{position:absolute;font-size:10px;color:rgba(255,255,255,0.8);white-space:nowrap;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,0.5);animation:icrFloatUp var(--icr-duration) ease-out forwards;pointer-events:none;will-change:transform,opacity}\
      @media (max-width:400px){.icr-picker{left:auto!important;right:0!important;transform:translateX(0) scale(.85)!important;max-width:calc(100vw - 16px);padding:8px 6px}.icr-picker.visible{transform:translateX(0) scale(1)!important}.icr-picker-btn{width:40px;height:40px;font-size:24px}}\
    ';
    document.head.appendChild(s);
  }

  function ensureContainer() {
    if (_containerEl && document.body.contains(_containerEl)) return _containerEl;
    _containerEl = document.createElement('div');
    _containerEl.className = 'icr-float-container';
    document.body.appendChild(_containerEl);
    return _containerEl;
  }

  function ensurePicker() {
    if (_pickerEl && document.body.contains(_pickerEl)) return _pickerEl;
    injectStyles();

    var callControls = document.getElementById('call-controls');
    if (!callControls) return null;

    var triggerWrap = document.createElement('div');
    triggerWrap.style.position = 'relative';
    triggerWrap.style.display = 'inline-flex';

    var trigger = document.createElement('button');
    trigger.className = 'icr-reaction-trigger';
    trigger.textContent = '😊';
    trigger.setAttribute('aria-label', 'Send reaction');
    trigger.id = 'icr-trigger';

    var picker = document.createElement('div');
    picker.className = 'icr-picker';
    picker.id = 'icr-picker';

    REACTIONS.forEach(function (emoji) {
      var btn = document.createElement('button');
      btn.className = 'icr-picker-btn';
      btn.textContent = emoji;
      btn.setAttribute('aria-label', 'React with ' + emoji);
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        sendInCallReaction(emoji);
        hidePicker();
      });
      picker.appendChild(btn);
    });

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePicker();
    });

    triggerWrap.appendChild(picker);
    triggerWrap.appendChild(trigger);

    var endBtn = callControls.querySelector('[data-action="endCall"]') || callControls.querySelector('button:last-child') || callControls.lastElementChild;
    if (endBtn && endBtn.parentNode === callControls) {
      callControls.insertBefore(triggerWrap, endBtn);
    } else {
      callControls.appendChild(triggerWrap);
    }

    _pickerEl = picker;

    document.addEventListener('click', function (e) {
      if (_pickerVisible && !picker.contains(e.target) && e.target !== trigger) {
        hidePicker();
      }
    });

    return picker;
  }

  function togglePicker() {
    if (_pickerVisible) {
      hidePicker();
    } else {
      showPicker();
    }
  }

  function showPicker() {
    var picker = ensurePicker();
    if (!picker) return;
    picker.classList.add('visible');
    _pickerVisible = true;
  }

  function hidePicker() {
    if (_pickerEl) _pickerEl.classList.remove('visible');
    _pickerVisible = false;
  }

  function showInCallReactionPicker() {
    showPicker();
  }

  function canSendReaction() {
    var now = Date.now();
    _rateTimestamps = _rateTimestamps.filter(function (t) { return now - t < RATE_WINDOW; });
    return _rateTimestamps.length < RATE_LIMIT;
  }

  function playPopSound() {
    try {
      if (!_popCtx) {
        _popCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (_popCtx.state === 'suspended') {
        _popCtx.resume();
      }
      var osc = _popCtx.createOscillator();
      var gain = _popCtx.createGain();
      osc.connect(gain);
      gain.connect(_popCtx.destination);
      osc.frequency.setValueAtTime(800, _popCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, _popCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, _popCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, _popCtx.currentTime + 0.15);
      osc.start(_popCtx.currentTime);
      osc.stop(_popCtx.currentTime + 0.15);
    } catch (_) {}
  }

  function sendInCallReaction(emoji) {
    if (!canSendReaction()) {
      toast('Slow down!', 'info');
      return;
    }

    _rateTimestamps.push(Date.now());

    var user = getUser();
    var callId = getActiveCallId();
    var db = getDb();

    if (!callId || !db || !user) return;

    playPopSound();
    renderInCallReaction(emoji, user.displayName || 'Someone');

    db.collection('calls').doc(callId).collection('reactions').add({
      emoji: emoji,
      senderId: user.uid,
      senderName: user.displayName || 'Someone',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function () {});
  }

  function renderInCallReaction(emoji, senderName) {
    var container = ensureContainer();

    var floatEl = document.createElement('div');
    floatEl.className = 'icr-floating-emoji';
    floatEl.textContent = emoji;

    var randomX = 20 + Math.random() * 60;
    var floatDist = FLOAT_DISTANCE + Math.random() * 80;

    floatEl.style.left = randomX + '%';
    floatEl.style.bottom = '120px';
    floatEl.style.setProperty('--icr-float', '-' + floatDist + 'px');
    floatEl.style.setProperty('--icr-duration', ANIMATION_DURATION + 'ms');

    container.appendChild(floatEl);

    if (senderName) {
      var label = document.createElement('div');
      label.className = 'icr-sender-label';
      label.textContent = senderName;
      label.style.left = randomX + '%';
      label.style.bottom = '100px';
      label.style.setProperty('--icr-float', '-' + floatDist + 'px');
      label.style.setProperty('--icr-duration', ANIMATION_DURATION + 'ms');
      container.appendChild(label);

      label.addEventListener('animationend', function () { label.remove(); });
    }

    floatEl.addEventListener('animationend', function () { floatEl.remove(); });

    setTimeout(function () {
      if (floatEl.parentNode) floatEl.remove();
      if (label && label.parentNode) label.remove();
    }, ANIMATION_DURATION + 200);
  }

  function startInCallReactionListener(callId) {
    stopInCallReactionListener();

    var db = getDb();
    if (!db || !callId) return;

    var user = getUser();
    var myUid = user ? user.uid : null;

    _reactionUnsub = db.collection('calls').doc(callId).collection('reactions')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .onSnapshot(function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type !== 'added') return;
          var data = change.doc.data();
          if (!data || !data.emoji) return;
          if (data.senderId === myUid) return;
          playPopSound();
          renderInCallReaction(data.emoji, data.senderName || 'Someone');
        });
      }, function () {});
  }

  function stopInCallReactionListener() {
    if (_reactionUnsub) {
      try { _reactionUnsub(); } catch (_) {}
      _reactionUnsub = null;
    }
  }

  window.showInCallReactionPicker = showInCallReactionPicker;
  window.sendInCallReaction = sendInCallReaction;
  window.renderInCallReaction = renderInCallReaction;
  window.startInCallReactionListener = startInCallReactionListener;
  window.stopInCallReactionListener = stopInCallReactionListener;
})();
