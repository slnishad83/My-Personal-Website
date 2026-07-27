// Streak Counter — consecutive days chatted between two users
(function() {
  'use strict';

  function _initStreaks() {
    const style = document.createElement('style');
    style.id = 'streak-styles';
    style.textContent = `
      .streak-badge {
        display: inline-flex; align-items: center; gap: 2px;
        background: rgba(255, 152, 0, 0.15); color: #ff9800;
        padding: 2px 6px; border-radius: 12px; font-size: 10px;
        font-weight: 700; margin-left: 6px; vertical-align: middle;
      }
      .streak-badge.fire { animation: pulseFire 2s infinite; }
      @keyframes pulseFire { 0%{transform:scale(1)} 50%{transform:scale(1.1)} 100%{transform:scale(1)} }
      .streak-details { display:none; position:absolute; top:100%; left:0; z-index:50; background:var(--surface-container-high); border-radius:12px; padding:12px; min-width:160px; box-shadow:0 4px 20px rgba(0,0,0,0.3); margin-top:4px; }
      .streak-badge:hover .streak-details { display:block; }
    `;
    document.head.appendChild(style);

    const origRenderChatList = window.renderChatList;
    if (typeof origRenderChatList === 'function') {
      window.renderChatList = function() {
        origRenderChatList();
        setTimeout(_renderStreaksInList, 100);
      };
      _streakOrigRenderChatList = origRenderChatList;
    }
  }

  let _streakOrigRenderChatList = null;

  function _calculateStreak(chatId) {
    if (!window.App || !window.App.messages) return { count: 0, maxStreak: 0 };
    const messages = window.App.messages[chatId];
    if (!messages || !messages.length) return { count: 0, maxStreak: 0 };

    const daysChatted = new Set();
    messages.forEach(m => {
      const ts = m.time || m.timestamp;
      if (ts) {
        const d = new Date(typeof ts === 'number' ? ts : (ts?.toMillis ? ts.toMillis() : 0));
        if (!isNaN(d.getTime())) {
          daysChatted.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
        }
      }
    });

    if (!daysChatted.size) return { count: 0, maxStreak: 0 };

    const sortedDays = Array.from(daysChatted).sort().reverse();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

    let streak = 0;
    let expectedDate = null;

    for (let i = 0; i < sortedDays.length; i++) {
      const dayStr = sortedDays[i];
      if (i === 0) {
        if (dayStr === todayKey || dayStr === yesterdayKey) {
          streak = 1;
          expectedDate = new Date(dayStr + 'T00:00:00');
        } else {
          break;
        }
      } else {
        const prev = new Date(expectedDate);
        prev.setDate(prev.getDate() - 1);
        const prevKey = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
        if (dayStr === prevKey) {
          streak++;
          expectedDate = prev;
        } else {
          break;
        }
      }
    }

    let maxStreak = streak;
    let currentRun = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const curr = new Date(sortedDays[i] + 'T00:00:00');
      const prev = new Date(sortedDays[i-1] + 'T00:00:00');
      const diff = (prev - curr) / (1000 * 60 * 60 * 24);
      if (Math.abs(diff - 1) < 0.01) {
        currentRun++;
        maxStreak = Math.max(maxStreak, currentRun);
      } else {
        currentRun = 1;
      }
    }

    return { count: streak, maxStreak };
  }

  function _renderStreaksInList() {
    if (!window.App) return;

    const chatItems = document.querySelectorAll('[onclick*="openChat("]');
    chatItems.forEach(item => {
      const onclick = item.getAttribute('onclick') || '';
      const match = onclick.match(/openChat\('([^']+)'\)/);
      if (!match) return;
      const chatId = match[1];

      const chat = window.App.chats?.find(c => c.id === chatId);
      if (chat?.type === 'group') return;

      const { count, maxStreak } = _calculateStreak(chatId);
      let badge = item.querySelector('.streak-badge');

      if (count >= 3) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'streak-badge fire';
          const nameEl = item.querySelector('.font-bold');
          if (nameEl) nameEl.appendChild(badge);
        }
        badge.innerHTML = `🔥 ${count}`;
        badge.style.position = 'relative';
        badge.innerHTML = `🔥 ${count}<div class="streak-details">
          <div style="font-size:13px;font-weight:700;margin-bottom:4px">🔥 ${count} day streak!</div>
          <div style="font-size:11px;color:var(--on-surface-variant)">Best: ${maxStreak} days</div>
        </div>`;
      } else if (badge) {
        badge.remove();
      }
    });
  }

  function _renderStreakInHeader() {
    if (!window.App?.currentChat) return;
    const chat = window.App.currentChat;
    if (chat.type === 'group') return;

    const { count, maxStreak: _maxStreak } = _calculateStreak(chat.id);
    const headerName = document.querySelector('#chat-header h2, #chat-header .chat-name');

    if (headerName) {
      let badge = headerName.querySelector('.streak-badge');
      if (count >= 3) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'streak-badge fire';
          headerName.appendChild(badge);
        }
        badge.innerHTML = `🔥 ${count}`;
      } else if (badge) {
        badge.remove();
      }
    }
  }

  window.getStreakCount = function(chatId) {
    return _calculateStreak(chatId).count;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initStreaks);
  } else {
    _initStreaks();
  }

  window._streakCleanup = function() {
    if (_streakOrigRenderChatList) {
      window.renderChatList = _streakOrigRenderChatList;
    }
    document.getElementById('streak-styles')?.remove();
  };
})();
