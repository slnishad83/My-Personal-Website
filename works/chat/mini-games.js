// Mini Games — word chain, trivia, 20 questions inside a chat
(function() {
  'use strict';

  // ─── WORD CHAIN ───
  const _wordChainDict = [
    'apple','elephant','tiger','rain','notebook','kite','elephant','tree','eagle','lion',
    'nose','ear','ring','girl','love','egg','goat','time','eye','yellow',
    'water','rainbow','wind','dog','green','night','train','net','ten','nice',
    'earth','heart','table','elephant','tall','lemon','moon','night','tea','ant',
    'tiger','red','dog','guitar','rain','note','earth','home','egg','gate',
    'apple','eye','yellow','wolf','fox','octopus','sun','net','turtle','elephant',
    'tea','ant','tree','eye','yellow','wolf','fox','sun','rain','note',
    'book','king','goat','table','elephant','tiger','red','dog','green','nose',
    'ear','ring','girl','love','egg','gate','apple','eye','yellow','lion',
    'nose','ear','ring','kite','ear','rain','note','tea','ant','tiger',
    'red','dog','guitar','rain','note','earth','home','egg','gate','apple'
  ];

  let _wcUsedWords = [];
  let _wcLastWord = '';
  let _wcPlayerScore = 0;
  let _wcBotScore = 0;

  window.openWordChain = function() {
    _wcUsedWords = [];
    _wcLastWord = '';
    _wcPlayerScore = 0;
    _wcBotScore = 0;
    const firstWord = _wordChainDict[Math.floor(Math.random() * _wordChainDict.length)];
    _wcUsedWords.push(firstWord);
    _wcLastWord = firstWord;

    const overlay = document.createElement('div');
    overlay.id = 'game-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:24px;padding:28px;max-width:420px;width:92vw;color:var(--on-surface)';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:18px;font-weight:700">🔗 Word Chain</h3>
        <button onclick="closeGame()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>
      <p style="font-size:12px;color:var(--on-surface-variant);margin:0 0 12px">Type a word that starts with the last letter of the previous word.</p>
      <div style="display:flex;justify-content:space-between;margin-bottom:16px">
        <div style="padding:8px 16px;border-radius:10px;background:rgba(124,77,255,0.15);font-size:13px;font-weight:700;color:var(--primary)">You: <span id="wc-player-score">0</span></div>
        <div style="padding:8px 16px;border-radius:10px;background:var(--surface-container,rgba(0,0,0,0.06));font-size:13px;font-weight:700;color:var(--on-surface-variant)">Bot: <span id="wc-bot-score">0</span></div>
      </div>
      <div id="wc-chat" style="max-height:250px;overflow-y:auto;margin-bottom:12px;padding:8px;border-radius:12px;background:rgba(0,0,0,0.2)">
        <div style="text-align:center;margin-bottom:8px"><span style="font-size:12px;color:var(--on-surface-variant)">Bot started with:</span></div>
        <div style="text-align:center"><span style="display:inline-block;padding:8px 16px;border-radius:12px;background:var(--surface-container,rgba(0,0,0,0.08));font-size:16px;font-weight:700;letter-spacing:2px">${firstWord.toUpperCase()}</span></div>
      </div>
      <div style="display:flex;gap:8px">
        <input id="wc-input" type="text" placeholder="Your word..." style="flex:1;padding:12px;border-radius:12px;border:2px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:14px;outline:none" autocomplete="off">
        <button onclick="submitWordChain()" style="padding:12px 18px;border-radius:12px;border:none;background:var(--primary);color:var(--on-primary);font-size:14px;font-weight:700;cursor:pointer">Go</button>
      </div>
      <div id="wc-msg" style="font-size:12px;color:var(--error);margin-top:8px;min-height:16px"></div>
      <button onclick="sendGameResult('word-chain', {player:${() => _wcPlayerScore}, bot:${() => _wcBotScore}, words:${() => JSON.stringify(_wcUsedWords)}})" style="margin-top:12px;width:100%;padding:10px;border-radius:10px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant);font-size:12px;font-weight:600;cursor:pointer">Send result to chat</button>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    const input = document.getElementById('wc-input');
    input?.focus();
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') submitWordChain(); });
  };

  window.submitWordChain = function() {
    const input = document.getElementById('wc-input');
    const msg = document.getElementById('wc-msg');
    if (!input || !msg) return;
    const word = input.value.trim().toLowerCase();
    input.value = '';
    msg.textContent = '';

    if (!word) { msg.textContent = 'Type a word'; return; }
    if (word.length < 2) { msg.textContent = 'Word must be at least 2 letters'; return; }
    if (_wcUsedWords.includes(word)) { msg.textContent = 'Word already used!'; return; }

    const lastLetter = _wcLastWord.slice(-1);
    if (word[0] !== lastLetter) { msg.textContent = `Must start with "${lastLetter.toUpperCase()}"`; return; }

    _wcPlayerScore++;
    _wcUsedWords.push(word);
    _wcLastWord = word;
    document.getElementById('wc-player-score').textContent = _wcPlayerScore;

    const chat = document.getElementById('wc-chat');
    if (chat) {
      chat.innerHTML += `<div style="text-align:right;margin-bottom:8px"><span style="display:inline-block;padding:8px 16px;border-radius:12px;background:var(--primary);color:var(--on-primary);font-size:14px;font-weight:700">${word.toUpperCase()}</span></div>`;
      chat.scrollTop = chat.scrollHeight;
    }

    setTimeout(() => {
      const botWord = _findBotWord(word);
      if (!botWord) {
        msg.textContent = 'Bot can\'t find a word — you win this round!';
        return;
      }
      _wcBotScore++;
      _wcUsedWords.push(botWord);
      _wcLastWord = botWord;
      document.getElementById('wc-bot-score').textContent = _wcBotScore;

      if (chat) {
        chat.innerHTML += `<div style="margin-bottom:8px"><span style="display:inline-block;padding:8px 16px;border-radius:12px;background:var(--surface-container,rgba(0,0,0,0.08));font-size:14px;font-weight:700">${botWord.toUpperCase()}</span></div>`;
        chat.scrollTop = chat.scrollHeight;
      }
    }, 800);
  };

  function _findBotWord(prevWord) {
    const lastLetter = prevWord.slice(-1);
    const available = _wordChainDict.filter(w => w[0] === lastLetter && !_wcUsedWords.includes(w));
    if (available.length) return available[Math.floor(Math.random() * available.length)];
    const all = _wordChainDict.filter(w => w[0] === lastLetter);
    return all.length ? all[Math.floor(Math.random() * all.length)] : null;
  }

  // ─── TRIVIA ───
  const _triviaQuestions = [
    { q: 'What planet is known as the Red Planet?', opts: ['Venus','Mars','Jupiter','Saturn'], a: 1 },
    { q: 'How many continents are there?', opts: ['5','6','7','8'], a: 2 },
    { q: 'What is the largest ocean?', opts: ['Atlantic','Indian','Arctic','Pacific'], a: 3 },
    { q: 'Which gas do plants absorb?', opts: ['Oxygen','Nitrogen','Carbon Dioxide','Hydrogen'], a: 2 },
    { q: 'What year did WW2 end?', opts: ['1943','1944','1945','1946'], a: 2 },
    { q: 'What is the chemical symbol for gold?', opts: ['Go','Gd','Au','Ag'], a: 2 },
    { q: 'How many bones are in the human body?', opts: ['106','206','306','406'], a: 1 },
    { q: 'What is the capital of Japan?', opts: ['Seoul','Beijing','Tokyo','Bangkok'], a: 2 },
    { q: 'Which planet has the most moons?', opts: ['Jupiter','Saturn','Uranus','Neptune'], a: 1 },
    { q: 'What is the speed of light in km/s?', opts: ['200,000','300,000','400,000','500,000'], a: 1 },
    { q: 'Which element has atomic number 1?', opts: ['Helium','Oxygen','Hydrogen','Carbon'], a: 2 },
    { q: 'What is the largest mammal?', opts: ['Elephant','Blue Whale','Giraffe','Hippopotamus'], a: 1 },
    { q: 'How many days in a leap year?', opts: ['364','365','366','367'], a: 2 },
    { q: 'What is the hardest natural substance?', opts: ['Gold','Iron','Diamond','Quartz'], a: 2 },
    { q: 'Which country has the most people?', opts: ['USA','India','China','Indonesia'], a: 2 },
    { q: 'What language has the most native speakers?', opts: ['English','Hindi','Mandarin','Spanish'], a: 2 },
    { q: 'What is the smallest prime number?', opts: ['0','1','2','3'], a: 2 },
    { q: 'How many colors are in a rainbow?', opts: ['5','6','7','8'], a: 2 },
    { q: 'What is the boiling point of water?', opts: ['90°C','100°C','110°C','120°C'], a: 1 },
    { q: 'Which planet is closest to the Sun?', opts: ['Venus','Earth','Mercury','Mars'], a: 2 },
  ];

  let _triviaScore = 0;
  let _triviaTotal = 0;
  let _triviaCurrent = null;

  window.openTrivia = function() {
    _triviaScore = 0;
    _triviaTotal = 0;
    _showTriviaQuestion();
  };

  function _showTriviaQuestion() {
    const used = Math.floor(Math.random() * _triviaQuestions.length);
    _triviaCurrent = _triviaQuestions[used];

    const overlay = document.getElementById('game-overlay');
    if (overlay) overlay.remove();

    const ov = document.createElement('div');
    ov.id = 'game-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:24px;padding:28px;max-width:420px;width:92vw;color:var(--on-surface)';

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:18px;font-weight:700">🧠 Trivia</h3>
        <button onclick="closeGame()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:16px">
        <div style="font-size:13px;font-weight:600;color:var(--primary)">Score: ${_triviaScore}/${_triviaTotal}</div>
        <div style="font-size:13px;color:var(--on-surface-variant)">Question ${_triviaTotal + 1} of 10</div>
      </div>
      <div style="padding:16px;border-radius:14px;background:var(--surface-container-low,rgba(0,0,0,0.04));margin-bottom:16px">
        <p style="font-size:15px;font-weight:600;margin:0;line-height:1.5">${_triviaCurrent.q}</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">`;

    _triviaCurrent.opts.forEach((opt, i) => {
      html += `<button class="trivia-opt" data-idx="${i}" onclick="answerTrivia(${i})" style="padding:14px 16px;border-radius:12px;border:2px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;text-align:left;transition:all 0.15s">${String.fromCharCode(65 + i)}. ${opt}</button>`;
    });

    html += '</div><div id="trivia-msg" style="font-size:13px;margin-top:12px;min-height:20px"></div>';
    html += `<button onclick="sendGameResult('trivia', {score:${_triviaScore}, total:${_triviaTotal}})" style="margin-top:8px;width:100%;padding:10px;border-radius:10px;border:none;background:var(--surface-container,rgba(0,0,0,0.06));color:var(--on-surface-variant);font-size:12px;font-weight:600;cursor:pointer;display:none" id="trivia-send-btn">Send result to chat</button>`;

    panel.innerHTML = html;
    ov.appendChild(panel);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  window.answerTrivia = function(idx) {
    const msg = document.getElementById('trivia-msg');
    const btns = document.querySelectorAll('.trivia-opt');
    btns.forEach(b => b.disabled = true);
    _triviaTotal++;

    if (idx === _triviaCurrent.a) {
      _triviaScore++;
      btns[idx].style.background = 'rgba(0,230,118,0.2)';
      btns[idx].style.borderColor = '#00E676';
      msg.innerHTML = '<span style="color:#00E676;font-weight:700">✓ Correct!</span>';
    } else {
      btns[idx].style.background = 'rgba(239,68,68,0.2)';
      btns[idx].style.borderColor = '#ef4444';
      btns[_triviaCurrent.a].style.background = 'rgba(0,230,118,0.2)';
      btns[_triviaCurrent.a].style.borderColor = '#00E676';
      msg.innerHTML = '<span style="color:#ef4444;font-weight:700">✗ Wrong!</span>';
    }

    setTimeout(() => {
      if (_triviaTotal >= 10) {
        document.getElementById('trivia-send-btn').style.display = 'block';
        msg.innerHTML += `<br><span style="font-weight:700;color:var(--on-surface)">Final: ${_triviaScore}/10</span>`;
      } else {
        _showTriviaQuestion();
      }
    }, 1200);
  };

  // ─── 20 QUESTIONS ───
  const _twentyQSuggestions = [
    'an animal','a fruit','a country','a movie','a sport','a musical instrument',
    'a color','a food','a vehicle','a celebrity','a historical figure','a city',
    'a planet','an element','a book','a TV show','a holiday','a job','a toy','a website'
  ];

  let _tqThinking = '';
  let _tqYesCount = 0;
  let _tqNoCount = 0;
  let _tqGuesses = [];

  window.openTwentyQuestions = function() {
    _tqYesCount = 0;
    _tqNoCount = 0;
    _tqGuesses = [];
    _tqThinking = _twentyQSuggestions[Math.floor(Math.random() * _twentyQSuggestions.length)];

    const overlay = document.createElement('div');
    overlay.id = 'game-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:24px;padding:28px;max-width:420px;width:92vw;color:var(--on-surface)';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:18px;font-weight:700">❓ 20 Questions</h3>
        <button onclick="closeGame()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>
      <p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 4px">Think of something! I'll try to guess it.</p>
      <p style="font-size:11px;color:var(--on-surface-variant);margin:0 0 12px">Hint: Think of ${_tqThinking}</p>
      <div style="display:flex;justify-content:space-around;margin-bottom:16px">
        <div style="text-align:center"><div style="font-size:24px;font-weight:700;color:#00E676" id="tq-yes-count">0</div><div style="font-size:10px;color:var(--on-surface-variant)">Yes</div></div>
        <div style="text-align:center"><div style="font-size:24px;font-weight:700;color:#ef4444" id="tq-no-count">0</div><div style="font-size:10px;color:var(--on-surface-variant)">No</div></div>
        <div style="text-align:center"><div style="font-size:24px;font-weight:700;color:var(--primary)" id="tq-q-num">1</div><div style="font-size:10px;color:var(--on-surface-variant)">Question</div></div>
      </div>
      <div id="tq-chat" style="max-height:200px;overflow-y:auto;margin-bottom:12px;padding:8px;border-radius:12px;background:rgba(0,0,0,0.2)">
        <div style="text-align:center;color:var(--on-surface-variant);font-size:12px;padding:8px">Answer Yes or No to each question!</div>
      </div>
      <div id="tq-question-area" style="text-align:center;padding:16px;border-radius:14px;background:var(--surface-container-low,rgba(0,0,0,0.04));margin-bottom:12px">
        <div style="font-size:15px;font-weight:600" id="tq-question">Loading...</div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="answerTwentyQ(true)" style="flex:1;padding:14px;border-radius:12px;border:none;background:#00E676;color:#000;font-size:14px;font-weight:700;cursor:pointer">👍 Yes</button>
        <button onclick="answerTwentyQ(false)" style="flex:1;padding:14px;border-radius:12px;border:none;background:#ef4444;color:white;font-size:14px;font-weight:700;cursor:pointer">👎 No</button>
      </div>
      <div id="tq-msg" style="font-size:12px;margin-top:8px;min-height:16px;text-align:center"></div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    _nextTwentyQQuestion();
  };

  const _tqQuestions = [
    'Is it alive?', 'Is it bigger than a bread box?', 'Can you hold it in your hand?',
    'Is it man-made?', 'Does it come from nature?', 'Is it found in a kitchen?',
    'Is it a common household item?', 'Do people use it daily?', 'Is it expensive?',
    'Does it move on its own?', 'Is it found in water?', 'Can you eat it?',
    'Is it used for entertainment?', 'Is it older than 100 years?', 'Is it electronic?',
    'Does it have legs?', 'Is it a type of food?', 'Does it fly?',
    'Is it a country?', 'Is it used in sports?'
  ];

  let _tqQIdx = 0;

  function _nextTwentyQQuestion() {
    if (_tqQIdx >= _tqQuestions.length) {
      document.getElementById('tq-question').textContent = 'My guess: ' + _tqThinking;
      document.getElementById('tq-msg').innerHTML = '<button onclick="sendGameResult(\'20-questions\', {thinking:\'' + _tqThinking + '\', questions:' + _tqQIdx + '})" style="padding:8px 16px;border-radius:8px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:600;cursor:pointer">Send result to chat</button>';
      return;
    }
    document.getElementById('tq-question').textContent = _tqQuestions[_tqQIdx];
    document.getElementById('tq-q-num').textContent = _tqQIdx + 1;
  }

  window.answerTwentyQ = function(yes) {
    const chat = document.getElementById('tq-chat');
    if (chat) {
      chat.innerHTML += `<div style="margin-bottom:6px;padding:6px 10px;border-radius:8px;background:var(--surface-container,rgba(0,0,0,0.06));font-size:13px"><span style="font-weight:600">Q${_tqQIdx + 1}:</span> ${_tqQuestions[_tqQIdx]}</div>`;
      chat.innerHTML += `<div style="text-align:right;margin-bottom:8px;padding:4px 10px;border-radius:8px;background:${yes ? 'rgba(0,230,118,0.15)' : 'rgba(239,68,68,0.15)'};font-size:13px;font-weight:600;color:${yes ? '#00E676' : '#ef4444'}">${yes ? 'Yes' : 'No'}</div>`;
      chat.scrollTop = chat.scrollHeight;
    }

    if (yes) _tqYesCount++;
    else _tqNoCount++;

    document.getElementById('tq-yes-count').textContent = _tqYesCount;
    document.getElementById('tq-no-count').textContent = _tqNoCount;

    _tqQIdx++;
    _nextTwentyQQuestion();
  };

  // ─── GAME LAUNCHER ───
  window.openMiniGames = function() {
    const overlay = document.createElement('div');
    overlay.id = 'game-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:24px;padding:28px;max-width:380px;width:92vw;color:var(--on-surface)';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 style="margin:0;font-size:18px;font-weight:700">🎮 Mini Games</h3>
        <button onclick="closeGame()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button onclick="closeGame();setTimeout(openWordChain,100)" style="display:flex;align-items:center;gap:12px;padding:16px;border-radius:14px;border:none;background:rgba(124,77,255,0.1);color:var(--on-surface);cursor:pointer;text-align:left">
          <span style="font-size:32px">🔗</span>
          <div><div style="font-size:14px;font-weight:700">Word Chain</div><div style="font-size:12px;color:var(--on-surface-variant)">Type words starting with the last letter</div></div>
        </button>
        <button onclick="closeGame();setTimeout(openTrivia,100)" style="display:flex;align-items:center;gap:12px;padding:16px;border-radius:14px;border:none;background:rgba(255,152,0,0.1);color:var(--on-surface);cursor:pointer;text-align:left">
          <span style="font-size:32px">🧠</span>
          <div><div style="font-size:14px;font-weight:700">Trivia</div><div style="font-size:12px;color:var(--on-surface-variant)">10 general knowledge questions</div></div>
        </button>
        <button onclick="closeGame();setTimeout(openTwentyQuestions,100)" style="display:flex;align-items:center;gap:12px;padding:16px;border-radius:14px;border:none;background:rgba(0,230,118,0.1);color:var(--on-surface);cursor:pointer;text-align:left">
          <span style="font-size:32px">❓</span>
          <div><div style="font-size:14px;font-weight:700">20 Questions</div><div style="font-size:12px;color:var(--on-surface-variant)">Think of something, I'll guess it</div></div>
        </button>
      </div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  window.closeGame = function() {
    document.getElementById('game-overlay')?.remove();
  };

  window.sendGameResult = function(gameType, result) {
    let text = '';
    if (gameType === 'word-chain') {
      text = `🎮 Word Chain — You: ${result.player} | Bot: ${result.bot}\nWords: ${result.words?.join(' → ') || ''}`;
    } else if (gameType === 'trivia') {
      text = `🧠 Trivia — Score: ${result.score}/${result.total}`;
    } else if (gameType === '20-questions') {
      text = `❓ 20 Questions — Thought of: ${result.thinking} (${result.questions} questions)`;
    }

    if (text && App.currentChat) {
      const input = document.getElementById('msg-input');
      if (input) { input.value = text; }
      closeGame();
      showToast('Game result ready to send', 'success');
    }
  };
})();
