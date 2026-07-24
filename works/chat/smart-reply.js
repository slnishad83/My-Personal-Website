/**
 * Smart Reply Suggestions (Feature 1)
 * Analyzes incoming messages and suggests 3 quick replies.
 */

(function () {
  const PREDEFINED_REPLIES = {
    greeting: ['Hey there!', 'Hi!', 'Hello, how are you?'],
    agreement: ['Agreed.', 'Sounds good.', 'Yes, absolutely.'],
    gratitude: ['Thank you!', 'Thanks a lot!', 'Appreciate it.'],
    farewell: ['Bye!', 'See you later.', 'Take care.'],
    question: ['I am not sure.', 'Let me check and get back to you.', 'Can you clarify?'],
    default: ['Okay.', 'Got it.', 'Thanks.']
  };

  let suggestionsContainer = null;
  let _originalSelectChat = null;
  let _selectChatHooked = false;

  function initSmartReply() {
    // Inject CSS for smart replies
    const style = document.createElement('style');
    style.textContent = `
      #smart-reply-container {
        display: flex;
        gap: 8px;
        padding: 8px 16px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        background: var(--background);
        border-top: 1px solid var(--outline-variant);
        transition: all 0.3s ease;
      }
      #smart-reply-container::-webkit-scrollbar { display: none; }
      .smart-reply-chip {
        white-space: nowrap;
        padding: 6px 14px;
        border-radius: 16px;
        background: var(--surface-variant);
        color: var(--on-surface-variant);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--outline-variant);
        transition: all 0.2s ease;
      }
      .smart-reply-chip:hover {
        background: var(--primary);
        color: var(--on-primary);
        border-color: var(--primary);
      }
    `;
    document.head.appendChild(style);

    // Create container
    suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'smart-reply-container';
    suggestionsContainer.style.display = 'none'; // Hidden by default

    // Insert above input-bar
    const inputBar = document.getElementById('input-bar');
    if (inputBar && inputBar.parentNode) {
      inputBar.parentNode.insertBefore(suggestionsContainer, inputBar);
    }

    // Hook into App's active chat changes or new messages
    document.addEventListener('nsl:app-ready', () => {
      // Monitor new messages in current chat
      if (window.MutationBus) {
        window.MutationBus.onBodyChildList('smart-reply', () => {
          analyzeCurrentChatContext();
        });
      }
      
      // Also listen for chat selection change
      if (!_selectChatHooked && window.selectChat) {
        _originalSelectChat = window.selectChat;
        window.selectChat = function(...args) {
          const res = _originalSelectChat.apply(this, args);
          setTimeout(analyzeCurrentChatContext, 100);
          return res;
        };
        _selectChatHooked = true;
      }
    });
  }

  function analyzeCurrentChatContext() {
    if (!window.App || !window.App.currentChatId) {
      hideSuggestions();
      return;
    }

    // Get the last message from the UI or App.messages
    const messages = window.App.messages.filter(m => m.chatId === window.App.currentChatId);
    if (!messages.length) {
      hideSuggestions();
      return;
    }

    const lastMsg = messages[messages.length - 1];
    
    // Don't suggest replies to our own messages
    if (lastMsg.senderId === window.App.currentUser.uid) {
      hideSuggestions();
      return;
    }

    if (!lastMsg.text) {
      hideSuggestions();
      return;
    }

    const intent = detectIntent(lastMsg.text);
    showSuggestions(PREDEFINED_REPLIES[intent] || PREDEFINED_REPLIES.default);
  }

  function detectIntent(text) {
    if (typeof text !== 'string') return 'default';
    const t = text.toLowerCase();
    if (t.match(/^(hi|hello|hey)/)) return 'greeting';
    if (t.match(/\?$/)) return 'question';
    if (t.match(/(thanks|thank you)/)) return 'gratitude';
    if (t.match(/(bye|cya|goodbye)/)) return 'farewell';
    if (t.match(/(ok|okay|sure|sound good)/)) return 'agreement';
    return 'default';
  }

  function showSuggestions(suggestions) {
    if (!suggestionsContainer) return;
    
    suggestionsContainer.innerHTML = '';
    suggestions.forEach(text => {
      const chip = document.createElement('div');
      chip.className = 'smart-reply-chip';
      chip.textContent = text;
      chip.onclick = () => {
        // Insert text into input box
        const input = document.getElementById('msg-input');
        if (input) {
          input.value = text;
          // Trigger input event to resize textarea and show send button
          input.dispatchEvent(new Event('input'));
          input.focus();
          hideSuggestions();
        }
      };
      suggestionsContainer.appendChild(chip);
    });
    
    suggestionsContainer.style.display = 'flex';
  }

  function hideSuggestions() {
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }
  }

  function unhookSelectChat() {
    if (_selectChatHooked && _originalSelectChat) {
      window.selectChat = _originalSelectChat;
      _originalSelectChat = null;
      _selectChatHooked = false;
    }
  }

  window.unhookSmartReplySelectChat = unhookSelectChat;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSmartReply);
  } else {
    initSmartReply();
  }
})();
