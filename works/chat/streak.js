/**
 * Streak Counter (Feature 3)
 * Calculates consecutive days chatted between two users.
 */

(function () {
  function initStreaks() {
    // Inject CSS for streak badge
    const style = document.createElement('style');
    style.textContent = `
      .streak-badge {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        background: rgba(255, 152, 0, 0.15);
        color: #ff9800;
        padding: 2px 6px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 700;
        margin-left: 6px;
        vertical-align: middle;
      }
      .streak-badge.fire {
        animation: pulseFire 2s infinite;
      }
      @keyframes pulseFire {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);

    // Render streaks on chat list update
    document.addEventListener('nsl:app-ready', () => {
      if (window.MutationBus) {
        window.MutationBus.onBodyChildList('streak-render', () => {
          renderStreaksInList();
          renderStreakInHeader();
        });
      }
    });
  }

  function calculateStreak(chatId) {
    if (!window.App || !window.App.messages) return 0;
    
    const messages = window.App.messages.filter(m => m.chatId === chatId);
    if (!messages.length) return 0;

    // Group messages by day string (YYYY-MM-DD)
    const daysChatted = new Set();
    messages.forEach(m => {
      if (m.timestamp) {
        const date = new Date(m.timestamp);
        daysChatted.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
      }
    });

    const sortedDays = Array.from(daysChatted).sort((a, b) => new Date(b) - new Date(a));
    
    let streak = 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let expectedDay = today;
    let foundTodayOrYesterday = false;
    
    for (let i = 0; i < sortedDays.length; i++) {
      const dayDate = new Date(sortedDays[i]);
      dayDate.setHours(0,0,0,0);
      
      if (i === 0) {
        if (dayDate.getTime() === today.getTime() || dayDate.getTime() === yesterday.getTime()) {
          foundTodayOrYesterday = true;
          streak++;
          expectedDay = new Date(dayDate);
        } else {
          break; // Streak lost
        }
      } else {
        expectedDay.setDate(expectedDay.getDate() - 1);
        if (dayDate.getTime() === expectedDay.getTime()) {
          streak++;
        } else {
          break;
        }
      }
    }
    
    return streak;
  }

  function renderStreaksInList() {
    if (!window.App) return;
    const chatItems = document.querySelectorAll('.chat-list-item');
    chatItems.forEach(item => {
      const chatId = item.getAttribute('data-chat-id');
      if (!chatId) return;
      
      // Only show streaks for 1-on-1 chats for now
      const chat = window.App.chats.find(c => c.id === chatId);
      if (chat && chat.type === 'group') return;
      
      const streakCount = calculateStreak(chatId);
      
      let badge = item.querySelector('.streak-badge');
      if (streakCount >= 3) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'streak-badge fire';
          // Find the name container
          const nameEl = item.querySelector('.name');
          if (nameEl) {
            nameEl.appendChild(badge);
          }
        }
        badge.innerHTML = `🔥 ${streakCount}`;
      } else if (badge) {
        badge.remove();
      }
    });
  }

  function renderStreakInHeader() {
    if (!window.App || !window.App.currentChatId) return;
    
    const chat = window.App.chats.find(c => c.id === window.App.currentChatId);
    if (!chat || chat.type === 'group') return; // Skip groups
    
    const streakCount = calculateStreak(chat.id);
    const headerName = document.querySelector('#chat-header h2');
    
    if (headerName) {
      let badge = headerName.querySelector('.streak-badge');
      if (streakCount >= 3) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'streak-badge fire';
          headerName.appendChild(badge);
        }
        badge.innerHTML = `🔥 ${streakCount}`;
      } else if (badge) {
        badge.remove();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStreaks);
  } else {
    initStreaks();
  }
})();
