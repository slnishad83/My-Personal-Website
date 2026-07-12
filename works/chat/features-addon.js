// ================================================================
// TEAM CHAT — FEATURES ADDON
// Adds 10 innovative features without touching the core app.js
// Features: Voice Transcription, Time Capsule, Catch Me Up,
//           Tasks, Auto-Translate, Busy Status, Quick Nav
// ================================================================

(function() {
  'use strict';

  const featureNavMedia = window.matchMedia('(max-width: 768px)');
  let featureNavSyncBound = false;

  // ── Wait for app to be ready ────────────────────────────────────
  function waitFor(check, cb, ms = 200, max = 50) {
    let tries = 0;
    const t = setInterval(() => {
      if (check() || ++tries > max) { clearInterval(t); if (check()) cb(); }
    }, ms);
  }

  waitFor(() => typeof db !== 'undefined' && typeof auth !== 'undefined' && typeof firebase !== 'undefined', init);

  function init() {
    injectStyles();
    injectFeatureNav();
    setupBusyStatus();
    setupTimeCapsuleButton();
    setupCatchMeUpButton();
    setupTasksButton();
    setupVoiceTranscription();
    setupAutoTranslatePreference();
    console.log('[FeaturesAddon] All 10 features loaded');
  }

  // ── 1. STYLES ────────────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Feature Nav Bar */
      .feature-nav-bar {
        display: none; gap: 0; overflow-x: auto; background: #f0f2f5;
        border-top: 1px solid #e2e8f0; padding: 0;
        scrollbar-width: none; position: relative; z-index: 5;
      }
      .feature-nav-bar::-webkit-scrollbar { display: none; }
      .feat-nav-btn {
        flex-shrink: 0; display: flex; flex-direction: column; align-items: center;
        gap: 3px; padding: 8px 14px; cursor: pointer; font-size: 11px;
        color: #667781; font-family: inherit; background: none; border: none;
        transition: background 0.15s; border-bottom: 2px solid transparent;
        font-weight: 600;
      }
      .feat-nav-btn:hover { background: rgba(0,128,105,0.06); color: #008069; }
      .feat-nav-btn .fn-icon { font-size: 18px; }

      @media (max-width: 768px) {
        .feature-nav-bar { display: flex; }
      }

      @media (min-width: 769px) {
        .feature-nav-bar { display: none !important; }
      }

      /* Busy Status Banner */
      .busy-banner {
        background: #fff3cd; border-bottom: 1px solid #ffc107; padding: 8px 16px;
        display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600;
        color: #856404;
      }
      .busy-banner button { margin-left: auto; font-size: 11px; padding: 4px 10px;
        border: 1px solid #856404; border-radius: 6px; background: none;
        color: #856404; cursor: pointer; font-family: inherit; font-weight: 600; }

      /* Feature modals */
      .feat-modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 9000;
        display: flex; align-items: center; justify-content: center;
        padding: 16px; box-sizing: border-box;
        opacity: 0; visibility: hidden; transition: opacity 0.2s, visibility 0.2s;
      }
      .feat-modal-overlay.show { opacity: 1; visibility: visible; }
      .feat-modal-box {
        background: #fff; border-radius: 16px;
        padding: 24px;
        width: 100%; max-width: 480px;
        max-height: min(90dvh, calc(100vh - 32px));
        overflow-y: auto; overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        box-sizing: border-box;
      }
      /* Mobile: bottom-sheet style */
      @media (max-width: 540px) {
        .feat-modal-overlay {
          align-items: flex-end;
          padding: 0;
        }
        .feat-modal-box {
          border-radius: 18px 18px 0 0;
          padding: 20px 16px calc(20px + env(safe-area-inset-bottom, 0px));
          max-width: 100%;
          max-height: min(88dvh, 88vh);
        }
      }
      /* Very small screens / landscape with keyboard */
      @media (max-height: 500px) {
        .feat-modal-box {
          max-height: min(96dvh, 96vh);
          padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px));
        }
        .feat-modal-box h3 { font-size: 14px; margin-bottom: 6px; }
        .feat-modal-box > p { display: none; }
        .feat-form-group { margin-bottom: 6px; }
        .feat-form-group input,
        .feat-form-group select,
        .feat-form-group textarea { padding: 7px 10px; font-size: 13px; }
      }
      .feat-modal-box h3 { font-size: 17px; font-weight: 700; margin-bottom: 16px; }
      .feat-form-group { margin-bottom: 13px; }
      .feat-form-group label { font-size: 11px; font-weight: 700; color: #667781;
        display: block; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.4px; }
      .feat-form-group input, .feat-form-group select, .feat-form-group textarea {
        width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 9px;
        font-size: 14px; font-family: inherit; outline: none; }
      .feat-form-group input:focus, .feat-form-group select:focus { border-color: #008069; }
      .feat-modal-btns { display: flex; gap: 10px; margin-top: 16px; }
      .feat-btn-cancel { flex: 1; padding: 11px; border: 1.5px solid #e2e8f0; border-radius: 9px;
        background: #fff; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
      .feat-btn-save { flex: 2; padding: 11px; border: none; border-radius: 9px;
        background: #008069; color: #fff; font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }

      /* Tasks panel */
      .tasks-panel {
        position: fixed; right: 0; top: 0; bottom: 0; width: 320px;
        background: #fff; box-shadow: -4px 0 20px rgba(0,0,0,0.12); z-index: 8000;
        display: flex; flex-direction: column; transform: translateX(100%);
        transition: transform 0.3s ease;
      }
      .tasks-panel.open { transform: translateX(0); }
      .tasks-header { background: #008069; color: #fff; padding: 16px 18px;
        display: flex; align-items: center; gap: 12px; }
      .tasks-header h3 { flex: 1; font-size: 16px; font-weight: 700; }
      .tasks-close { background: none; border: none; color: #fff; font-size: 22px; cursor: pointer; }
      .tasks-add-row { padding: 12px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 8px; }
      .tasks-add-row input { flex: 1; padding: 9px 12px; border: 1.5px solid #e2e8f0;
        border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; }
      .tasks-add-row input:focus { border-color: #008069; }
      .tasks-add-row button { padding: 9px 14px; background: #008069; color: #fff;
        border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-family: inherit; }
      .tasks-list { flex: 1; overflow-y: auto; padding: 8px; }
      .task-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 8px;
        border-bottom: 1px solid #f0f2f5; }
      .task-cb { width: 20px; height: 20px; flex-shrink: 0; cursor: pointer; accent-color: #008069; margin-top: 2px; }
      .task-text { flex: 1; font-size: 14px; line-height: 1.4; }
      .task-text.done { text-decoration: line-through; color: #667781; }
      .task-del { background: none; border: none; color: #667781; cursor: pointer; font-size: 15px; padding: 2px; }
      .tasks-empty { text-align: center; padding: 40px 20px; color: #667781; font-size: 14px; }

      /* Transcription badge */
      .transcription-text {
        font-size: 12px; color: #667781; font-style: italic; padding: 4px 8px;
        background: #f0f2f5; border-radius: 6px; margin-top: 4px; display: block;
        line-height: 1.4;
      }
      .transcribe-btn {
        font-size: 11px; color: #008069; background: none; border: none;
        cursor: pointer; font-family: inherit; font-weight: 600; padding: 2px 0;
        text-decoration: underline;
      }

      /* Catch me up */
      .catchup-result {
        background: #f0f9f6; border: 1px solid #b2dfdb; border-radius: 10px;
        padding: 12px 14px; margin: 8px 16px; font-size: 13px; line-height: 1.6;
        color: #111b21;
      }
      .catchup-result .catchup-title { font-weight: 700; color: #008069; margin-bottom: 6px; }

      /* Auto-translate indicator */
      .auto-translate-on { font-size: 10px; background: #e8f5e9; color: #2e7d32;
        padding: 2px 8px; border-radius: 10px; font-weight: 600; }
    `;
    document.head.appendChild(style);
  }

  // ── 2. FEATURE NAVIGATION BAR ────────────────────────────────────
  function injectFeatureNav() {
    const sidebar = document.querySelector('.chat-sidebar, .sidebar, #chatSidebar, [class*="sidebar"]');
    if (!sidebar) return;
    if (!featureNavSyncBound) {
      const syncFeatureNav = () => {
        const nav = document.getElementById('featureNavBar');
        if (!nav) return;
        const shouldShow = featureNavMedia.matches;
        nav.hidden = !shouldShow;
        nav.style.display = shouldShow ? 'flex' : 'none';
        nav.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
      };
      if (typeof featureNavMedia.addEventListener === 'function') {
        featureNavMedia.addEventListener('change', syncFeatureNav);
      } else if (typeof featureNavMedia.addListener === 'function') {
        featureNavMedia.addListener(syncFeatureNav);
      }
      window.addEventListener('resize', syncFeatureNav, { passive: true });
      featureNavSyncBound = true;
    }
    const nav = document.createElement('div');
    nav.className = 'feature-nav-bar';
    nav.id = 'featureNavBar';
    nav.innerHTML = `
      <button class="feat-nav-btn" onclick="window.location.href='album.html'" title="Family Album">
        <span class="fn-icon">📸</span>Album
      </button>
      <button class="feat-nav-btn" onclick="window.location.href='insights.html'" title="Chat Insights">
        <span class="fn-icon">📊</span>Insights
      </button>
      <button class="feat-nav-btn" onclick="window.location.href='calendar.html'" title="Family Calendar">
        <span class="fn-icon">📅</span>Calendar
      </button>
      <button class="feat-nav-btn" onclick="window.location.href='expenses.html'" title="Expense Splitter">
        <span class="fn-icon">💰</span>Expenses
      </button>
      <button class="feat-nav-btn" onclick="openTasksPanel()" title="Tasks">
        <span class="fn-icon">✅</span>Tasks
      </button>
      <button class="feat-nav-btn" onclick="openTimeCapsuleModal()" title="Time Capsule">
        <span class="fn-icon">⏳</span>Capsule
      </button>
      <button class="feat-nav-btn" onclick="openBusyModal()" title="Busy Status">
        <span class="fn-icon">🔴</span>Busy
      </button>
    `;
    // Try to insert after header or at bottom of sidebar
    const sidebarHeader = sidebar.querySelector('.sidebar-header, [class*="header"]');
    if (sidebarHeader && sidebarHeader.nextSibling) {
      sidebar.insertBefore(nav, sidebarHeader.nextSibling);
    } else {
      sidebar.appendChild(nav);
    }
    nav.hidden = !featureNavMedia.matches;
    nav.style.display = featureNavMedia.matches ? 'flex' : 'none';
    nav.setAttribute('aria-hidden', featureNavMedia.matches ? 'false' : 'true');
  }

  // ── 3. BUSY STATUS (Feature 10) ──────────────────────────────────
  function setupBusyStatus() {
    // Check if user is currently busy on load
    auth.onAuthStateChanged(user => {
      if (!user) return;
      db.collection('users').doc(user.uid).onSnapshot(snap => {
        const data = snap.data() || {};
        showOrHideBusyBanner(data.busyStatus);
      });
    });

    // Create busy modal
    const modal = document.createElement('div');
    modal.className = 'feat-modal-overlay';
    modal.id = 'busyModal';
    modal.innerHTML = `
      <div class="feat-modal-box">
        <h3>🔴 Set Busy Status</h3>
        <p style="font-size:13px;color:#667781;margin-bottom:16px">
          People who message you will get an automatic reply. Clear it when you're available again.
        </p>
        <div class="feat-form-group">
          <label>Status message</label>
          <select id="busyPreset" onchange="document.getElementById('busyMsg').value=this.value">
            <option value="">Choose a preset…</option>
            <option value="In a meeting, will reply soon">In a meeting</option>
            <option value="Driving, will reply when I stop">Driving 🚗</option>
            <option value="Sleeping, will reply in the morning">Sleeping 😴</option>
            <option value="On a call, will reply shortly">On a call</option>
            <option value="Busy right now, will get back to you">Busy right now</option>
          </select>
        </div>
        <div class="feat-form-group">
          <label>Or type your own</label>
          <input type="text" id="busyMsg" placeholder="e.g. At the gym, back in an hour"/>
        </div>
        <div class="feat-modal-btns">
          <button class="feat-btn-cancel" onclick="closeBusyModal()">Cancel</button>
          <button class="feat-btn-save" onclick="saveBusyStatus()">Set Busy</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    window.openBusyModal = () => modal.classList.add('show');
    window.closeBusyModal = () => modal.classList.remove('show');
    window.saveBusyStatus = async () => {
      const msg = document.getElementById('busyMsg').value.trim();
      if (!msg) { if (typeof showToast === 'function') showToast('Enter a status message', 'error'); return; }
      const user = auth.currentUser;
      if (!user) return;
      await db.collection('users').doc(user.uid).update({ busyStatus: msg, busySetAt: firebase.firestore.FieldValue.serverTimestamp() });
      modal.classList.remove('show');
      if (typeof showToast === 'function') showToast('Busy status set. Auto-reply is active.');
    };
    window.clearBusyStatus = async () => {
      const user = auth.currentUser;
      if (!user) return;
      await db.collection('users').doc(user.uid).update({ busyStatus: null, busySetAt: null });
    };
  }

  function showOrHideBusyBanner(busyStatus) {
    const existing = document.getElementById('busyBanner');
    if (existing) existing.remove();
    if (!busyStatus) return;
    const banner = document.createElement('div');
    banner.id = 'busyBanner';
    banner.className = 'busy-banner';
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `🔴 Busy: "${window.sanitizeHTML(busyStatus)}" — Auto-reply is on <button onclick="clearBusyStatus()">Clear</button>`;
    const nav = document.getElementById('featureNavBar');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(banner, nav.nextSibling);
    else document.body.prepend(banner);
  }

  // ── 4. TIME CAPSULE (Feature 2) ──────────────────────────────────
  function setupTimeCapsuleButton() {
    const modal = document.createElement('div');
    modal.className = 'feat-modal-overlay';
    modal.id = 'timeCapsuleModal';
    modal.innerHTML = `
      <div class="feat-modal-box">
        <h3>⏳ Time Capsule Message</h3>
        <p style="font-size:13px;color:#667781;margin-bottom:16px">
          Write a message that will be delivered on a future date — a birthday next year, a new year wish, anything.
        </p>
        <div class="feat-form-group">
          <label>Your message</label>
          <textarea id="capsuleMsg" rows="4" placeholder="Write your message here…" style="resize:none"></textarea>
        </div>
        <div class="feat-form-group">
          <label>Deliver on this date</label>
          <input type="datetime-local" id="capsuleDate"/>
        </div>
        <div class="feat-form-group">
          <label>Send to (chat)</label>
          <select id="capsuleTarget">
            <option value="">Loading chats…</option>
          </select>
        </div>
        <div class="feat-modal-btns">
          <button class="feat-btn-cancel" onclick="closeTimeCapsuleModal()">Cancel</button>
          <button class="feat-btn-save" onclick="saveTimeCapsule()">Schedule 🚀</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    window.openTimeCapsuleModal = async () => {
      // Set default date to 1 week from now
      const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      document.getElementById('capsuleDate').value = d.toISOString().slice(0, 16);
      document.getElementById('capsuleMsg').value = '';
      // Load available chats
      const user = auth.currentUser;
      if (user) {
        try {
          const chats = [];
          // Saved messages
          chats.push({ value: `saved_${user.uid}`, label: '📌 Saved Messages (to yourself)' });
          // Groups
          const gSnap = await db.collection('groups').get();
          gSnap.docs.forEach(d => {
            const g = d.data();
            if (g.memberIds && g.memberIds.includes(user.uid)) chats.push({ value: `group_${d.id}`, label: `👥 ${g.name || 'Group'}` });
          });
          document.getElementById('capsuleTarget').innerHTML = chats.map(c => `<option value="${c.value}">${window.sanitizeHTML(c.label)}</option>`).join('');
        } catch (_) {}
      }
      modal.classList.add('show');
    };
    window.closeTimeCapsuleModal = () => modal.classList.remove('show');
    window.saveTimeCapsule = async () => {
      const msg = document.getElementById('capsuleMsg').value.trim();
      const dateVal = document.getElementById('capsuleDate').value;
      const target = document.getElementById('capsuleTarget').value;
      if (!msg || !dateVal || !target) { if (typeof showToast === 'function') showToast('Fill in all fields', 'error'); return; }
      const dueAt = new Date(dateVal);
      if (dueAt <= new Date()) { if (typeof showToast === 'function') showToast('Choose a future date', 'error'); return; }
      const user = auth.currentUser;
      const [type, id] = target.split('_');
      await db.collection('scheduledMessages').add({
        userId: user.uid,
        text: msg,
        dueAt: firebase.firestore.Timestamp.fromDate(dueAt),
        status: 'pending',
        chatType: type === 'saved' ? 'direct' : type,
        chatId: type === 'saved' ? id : id,
        directId: type === 'direct' ? id : (type === 'saved' ? id : null),
        groupId: type === 'group' ? id : null,
        isTimeCapsule: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      modal.classList.remove('show');
      if (typeof showToast === 'function') showToast(`⏳ Message scheduled for ${dueAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`);
    };
  }

  // ── 5. CATCH ME UP AI (Feature 4) ────────────────────────────────
  function setupCatchMeUpButton() {
    // Inject "Catch Me Up" button into chat header when a chat is opened
    const observer = new MutationObserver(() => {
      const chatHeader = document.querySelector('.chat-header, [class*="chat-header"], .message-header');
      if (!chatHeader || chatHeader.querySelector('.catchup-btn')) return;
      if (window.matchMedia('(min-width: 901px)').matches) return;
      const btn = document.createElement('button');
      btn.className = 'catchup-btn';
      btn.title = 'Catch Me Up — AI summary of recent messages';
      btn.style.cssText = 'background:none;border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;color:var(--brand-dark,#008069);font-weight:600;font-family:inherit;margin-right:4px';
      btn.innerHTML = '🧠 Catch Me Up';
      btn.onclick = catchMeUp;
      const actionsArea = chatHeader.querySelector('[class*="actions"], [class*="right"], [class*="icons"]');
      if (actionsArea) actionsArea.prepend(btn);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.catchMeUp = async () => {
      const existing = document.getElementById('catchupResult');
      if (existing) { existing.remove(); return; }
      if (typeof currentChat === 'undefined' || !currentChat) {
        if (typeof showToast === 'function') showToast('Open a chat first');
        return;
      }
      const result = document.createElement('div');
      result.id = 'catchupResult';
      result.className = 'catchup-result';
      result.setAttribute('role', 'status');
      result.setAttribute('aria-live', 'polite');
      result.innerHTML = '<div class="catchup-title">🧠 AI Summary</div><div>Analysing messages…</div>';
      const area = document.querySelector('.messages-area, #messagesArea, [class*="messages"]');
      if (area) area.before(result);
      try {
        const functions = firebase.functions();
        const fn = functions.httpsCallable('catchMeUp', { timeout: 30000 });
        const chatType = typeof currentChatType !== 'undefined' ? currentChatType : 'direct';
        const res = await fn({ chatId: currentChat.id, chatType });
        result.innerHTML = `<div class="catchup-title">🧠 What you missed</div>${window.sanitizeHTML(res.data.summary || 'Nothing new since you were last here.')}`;
      } catch (e) {
        result.innerHTML = '<div class="catchup-title">🧠 Catch Me Up</div>Could not generate summary. Try again.';
      }
    };
  }

  // ── 6. TASKS PANEL (Feature 5) ───────────────────────────────────
  function setupTasksButton() {
    const panel = document.createElement('div');
    panel.className = 'tasks-panel';
    panel.id = 'tasksPanel';
    panel.innerHTML = `
      <div class="tasks-header">
        <h3>✅ My Tasks</h3>
        <button class="tasks-close" onclick="closeTasksPanel()">✕</button>
      </div>
      <div class="tasks-add-row">
        <input type="text" id="taskInput" placeholder="Add a task…" onkeydown="if(event.key==='Enter')addTask()"/>
        <button onclick="addTask()">Add</button>
      </div>
      <div class="tasks-list" id="tasksList" aria-live="polite"><div class="tasks-empty">No tasks yet. Add one above!</div></div>
    `;
    document.body.appendChild(panel);

    let tasksUnsubscribe = null;

    window.openTasksPanel = () => {
      panel.classList.add('open');
      const user = auth.currentUser;
      if (!user) return;
      if (tasksUnsubscribe) tasksUnsubscribe();
      tasksUnsubscribe = db.collection('tasks').where('userId', '==', user.uid).orderBy('createdAt', 'desc').limit(100).onSnapshot(snap => {
        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTasks(tasks);
      });
    };
    window.closeTasksPanel = () => {
      panel.classList.remove('open');
      if (tasksUnsubscribe) { tasksUnsubscribe(); tasksUnsubscribe = null; }
    };
    window.addTask = async () => {
      const input = document.getElementById('taskInput');
      const text = input.value.trim();
      if (!text) return;
      const user = auth.currentUser;
      if (!user) return;
      input.value = '';
      await db.collection('tasks').add({ userId: user.uid, text, done: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    };
    window.toggleTask = async (id, done) => {
      await db.collection('tasks').doc(id).update({ done: !done });
    };
    window.deleteTask = async (id) => {
      await db.collection('tasks').doc(id).delete();
    };

    function renderTasks(tasks) {
      const el = document.getElementById('tasksList');
      if (!tasks.length) { el.innerHTML = '<div class="tasks-empty">No tasks yet!</div>'; return; }
      el.innerHTML = tasks.map(t => `
        <div class="task-item">
          <input class="task-cb" type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask('${t.id}',${t.done})"/>
          <span class="task-text ${t.done ? 'done' : ''}">${esc(t.text)}</span>
          <button class="task-del" onclick="deleteTask('${t.id}')">🗑</button>
        </div>`).join('');
    }
  }

  // ── 7. VOICE TRANSCRIPTION (Feature 1) ───────────────────────────
  function setupVoiceTranscription() {
    const observer = new MutationObserver(() => {
      // Find all voice message bubbles that don't have transcription yet
      document.querySelectorAll('.voice-message, [class*="voice"], audio').forEach(el => {
        const bubble = el.closest('.message-bubble, [class*="bubble"], [class*="message-content"]');
        if (!bubble || bubble.querySelector('.transcribe-btn, .transcription-text')) return;
        const msgEl = bubble.closest('[data-message-id], [class*="message"]');
        const msgId = msgEl?.dataset?.messageId || msgEl?.id;
        const btn = document.createElement('button');
        btn.className = 'transcribe-btn';
        btn.textContent = '📝 Transcribe';
        btn.onclick = () => transcribeVoice(msgId, btn, bubble);
        bubble.appendChild(btn);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.transcribeVoice = async (msgId, btn, bubble) => {
      if (!msgId) return;
      btn.textContent = 'Transcribing…';
      btn.disabled = true;
      try {
        const msgDoc = await db.collection('messages').doc(msgId).get();
        const msgData = msgDoc.data();
        if (!msgData?.attachment?.url) { btn.textContent = '❌ No audio'; return; }
        // Check if already transcribed
        if (msgData.transcription) {
          const span = document.createElement('span');
          span.className = 'transcription-text';
          span.textContent = '📝 ' + msgData.transcription;
          btn.replaceWith(span);
          return;
        }
        const functions = firebase.functions();
        const fn = functions.httpsCallable('transcribeVoiceMessage', { timeout: 30000 });
        const res = await fn({ messageId: msgId, audioUrl: msgData.attachment.url });
        const span = document.createElement('span');
        span.className = 'transcription-text';
        span.textContent = '📝 ' + (res.data.text || 'Could not transcribe');
        btn.replaceWith(span);
        // Save to Firestore
        if (res.data.text) await db.collection('messages').doc(msgId).update({ transcription: res.data.text });
      } catch (e) {
        btn.textContent = '❌ Failed';
        btn.disabled = false;
        setTimeout(() => { btn.textContent = '📝 Transcribe'; }, 2000);
      }
    };
  }

  // ── 8. AUTO-TRANSLATE PREFERENCE (Feature 6) ─────────────────────
  function setupAutoTranslatePreference() {
    // Add toggle to settings if settings panel exists
    const observer = new MutationObserver(() => {
      const settingsPanel = document.querySelector('#settingsModal, [id*="settings"], [class*="settings-modal"]');
      if (!settingsPanel || settingsPanel.querySelector('.auto-translate-toggle')) return;
      const toggle = document.createElement('div');
      toggle.className = 'auto-translate-toggle';
      toggle.style.cssText = 'padding:12px 18px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border,#e2e8f0)';
      toggle.innerHTML = `
        <div>
          <div style="font-weight:600;font-size:14px">🌍 Auto-Translate Messages</div>
          <div style="font-size:12px;color:var(--muted,#667781)">Translate incoming messages to your language</div>
        </div>
        <label style="position:relative;display:inline-block;width:44px;height:24px">
          <input type="checkbox" id="autoTranslateToggle" style="opacity:0;width:0;height:0" onchange="setAutoTranslate(this.checked)"/>
          <span style="position:absolute;cursor:pointer;inset:0;background:#ccc;border-radius:24px;transition:0.2s"></span>
        </label>`;
      settingsPanel.querySelector('[class*="body"], [class*="content"], div')?.appendChild(toggle);
      // Set initial state
      const pref = localStorage.getItem('autoTranslate') === 'true';
      const cb = document.getElementById('autoTranslateToggle');
      if (cb) cb.checked = pref;
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.setAutoTranslate = (enabled) => {
      localStorage.setItem('autoTranslate', enabled);
      if (typeof showToast === 'function') showToast(enabled ? '🌍 Auto-translate ON' : 'Auto-translate OFF');
    };
  }

  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

})();
