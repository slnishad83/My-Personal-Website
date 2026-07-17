// Mood / Status Emoji — live mood next to name
(function() {
  'use strict';

  const MOOD_KEY = 'nsl_user_mood';
  const MOOD_EXPIRY_KEY = 'nsl_mood_expiry';

  const MOODS = [
    { emoji: '😊', label: 'Happy' }, { emoji: '😢', label: 'Sad' },
    { emoji: '😡', label: 'Angry' }, { emoji: '🤔', label: 'Thinking' },
    { emoji: '😴', label: 'Sleepy' }, { emoji: '🎉', label: 'Party' },
    { emoji: '😎', label: 'Cool' }, { emoji: '🤓', label: 'Nerdy' },
    { emoji: '❤️', label: 'Love' }, { emoji: '🔥', label: 'On Fire' },
    { emoji: '💪', label: 'Strong' }, { emoji: '🌟', label: 'Stellar' },
    { emoji: '🍔', label: 'Hungry' }, { emoji: '☕', label: 'Coffee' },
    { emoji: '🎵', label: 'Musical' }, { emoji: '📚', label: 'Studying' },
    { emoji: '🎮', label: 'Gaming' }, { emoji: '✈️', label: 'Traveling' },
    { emoji: '🏥', label: 'Busy' }, { emoji: '🌙', label: 'Chill' },
  ];

  function _getMood() {
    try { return localStorage.getItem(MOOD_KEY) || ''; } catch(_) { return ''; }
  }

  function _setMood(emoji) {
    localStorage.setItem(MOOD_KEY, emoji);
    _syncMoodToFirestore(emoji);
    _updateMoodUI();
  }

  function _getMoodExpiry() {
    try { return parseInt(localStorage.getItem(MOOD_EXPIRY_KEY) || '0'); } catch(_) { return 0; }
  }

  function _setMoodExpiry(hours) {
    const expiry = hours > 0 ? Date.now() + hours * 3600000 : 0;
    localStorage.setItem(MOOD_EXPIRY_KEY, String(expiry));
    return expiry;
  }

  function _isMoodExpired() {
    const expiry = _getMoodExpiry();
    return expiry > 0 && Date.now() > expiry;
  }

  async function _syncMoodToFirestore(emoji) {
    if (!App.db || !App.auth?.currentUser) return;
    try {
      await App.db.collection('users').doc(App.auth.currentUser.uid).update({
        moodEmoji: emoji || null,
        moodUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch(_) {}
  }

  function _updateMoodUI() {
    const mood = _isMoodExpired() ? '' : _getMood();
    document.querySelectorAll('.mood-emoji-badge').forEach(el => el.remove());

    if (!mood) return;

    const headerName = document.querySelector('#chat-header h2, #chat-header .chat-name');
    if (headerName && !headerName.querySelector('.mood-emoji-badge')) {
      const badge = document.createElement('span');
      badge.className = 'mood-emoji-badge';
      badge.style.cssText = 'font-size:16px;margin-left:4px;vertical-align:middle;cursor:pointer';
      badge.textContent = mood;
      badge.title = 'Tap to change mood';
      badge.onclick = (e) => { e.stopPropagation(); openMoodPicker(); };
      headerName.appendChild(badge);
    }
  }

  window.openMoodPicker = function() {
    const currentMood = _isMoodExpired() ? '' : _getMood();
    const overlay = document.createElement('div');
    overlay.id = 'mood-picker-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:24px;padding:24px;max-width:380px;width:92vw;color:var(--on-surface)';

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:18px;font-weight:700">Set Your Mood</h3>
        <button onclick="document.getElementById('mood-picker-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>
      <p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 12px">Shows next to your name in chats.</p>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:16px">`;

    MOODS.forEach(m => {
      const isActive = currentMood === m.emoji;
      html += `<button onclick="setMyMood('${m.emoji}')" style="padding:10px 4px;border-radius:12px;border:2px solid ${isActive ? 'var(--primary)' : 'transparent'};background:${isActive ? 'rgba(124,77,255,0.15)' : 'rgba(255,255,255,0.04)'};cursor:pointer;text-align:center;transition:all 0.15s">
        <div style="font-size:28px;line-height:1">${m.emoji}</div>
        <div style="font-size:10px;color:var(--on-surface-variant);margin-top:2px">${m.label}</div>
      </button>`;
    });

    html += `</div>
      <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.04);margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">Auto-clear after:</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button onclick="setMoodExpiryAndClose(1)" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,255,255,0.06);color:var(--on-surface);font-size:12px;font-weight:600;cursor:pointer">1 Hour</button>
          <button onclick="setMoodExpiryAndClose(4)" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,255,255,0.06);color:var(--on-surface);font-size:12px;font-weight:600;cursor:pointer">4 Hours</button>
          <button onclick="setMoodExpiryAndClose(8)" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,255,255,0.06);color:var(--on-surface);font-size:12px;font-weight:600;cursor:pointer">8 Hours</button>
          <button onclick="setMoodExpiryAndClose(24)" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,255,255,0.06);color:var(--on-surface);font-size:12px;font-weight:600;cursor:pointer">24 Hours</button>
          <button onclick="setMoodExpiryAndClose(0)" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,255,255,0.06);color:var(--on-surface);font-size:12px;font-weight:600;cursor:pointer">Until I change it</button>
        </div>
      </div>
      <button onclick="clearMyMood()" style="width:100%;padding:10px;border-radius:10px;border:none;background:rgba(239,68,68,0.1);color:var(--error);font-size:13px;font-weight:600;cursor:pointer">Clear Mood</button>`;

    panel.innerHTML = html;
    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  window.setMyMood = function(emoji) {
    _setMood(emoji);
    document.getElementById('mood-picker-overlay')?.remove();
    showToast(`Mood set to ${emoji}`, 'success');
  };

  window.setMoodExpiryAndClose = function(hours) {
    _setMoodExpiry(hours);
    document.getElementById('mood-picker-overlay')?.remove();
    if (hours > 0) showToast(`Mood will clear in ${hours}h`, 'info');
    else showToast('Mood will stay until you change it', 'info');
  };

  window.clearMyMood = function() {
    _setMood('');
    localStorage.removeItem(MOOD_EXPIRY_KEY);
    document.getElementById('mood-picker-overlay')?.remove();
    showToast('Mood cleared', 'info');
  };

  const _expiryTimer = setInterval(() => {
    if (_isMoodExpired() && _getMood()) {
      _setMood('');
      showToast('Your mood has expired', 'info');
    }
  }, 60000);

  const origRenderChatList = window.renderChatList;
  let _patchedRenderChatList = false;
  if (typeof origRenderChatList === 'function') {
    window.renderChatList = function() {
      origRenderChatList();
      _injectMoodInChatList();
    };
    _patchedRenderChatList = true;
  }

  function _injectMoodInChatList() {
    if (!App.db || !App.contacts) return;
    App.contacts.forEach(c => {
      if (!c.moodEmoji) return;
      const items = document.querySelectorAll(`[onclick*="openChat('${c.uid}']`);
      items.forEach(item => {
        if (item.querySelector('.mood-emoji-badge')) return;
        const nameEl = item.querySelector('.font-bold');
        if (nameEl) {
          const badge = document.createElement('span');
          badge.className = 'mood-emoji-badge';
          badge.style.cssText = 'font-size:13px;margin-left:3px;vertical-align:middle';
          badge.textContent = c.moodEmoji;
          nameEl.appendChild(badge);
        }
      });
    });
  }

  window._addMoodEmojiOption = function(menu) {
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;border:none;background:transparent;color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;width:100%;text-align:left;border-radius:0';
    const mood = _isMoodExpired() ? '' : _getMood();
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">mood</span>Set Mood ${mood || ''}`;
    btn.onclick = () => { _removeCtxMenu(); openMoodPicker(); };
    const cancelBtn = menu.querySelector('[onclick*="_removeCtxMenu"]');
    if (cancelBtn) menu.insertBefore(btn, cancelBtn);
    else menu.appendChild(btn);
  };

  const _uiTimer = setInterval(_updateMoodUI, 5000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _updateMoodUI);
  } else {
    setTimeout(_updateMoodUI, 1000);
  }

  window._moodStatusCleanup = function() {
    clearInterval(_expiryTimer);
    clearInterval(_uiTimer);
    if (_patchedRenderChatList && origRenderChatList) {
      window.renderChatList = origRenderChatList;
    }
  };
})();
