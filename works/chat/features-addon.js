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
  function waitFor(check, cb) {
    if (check()) { cb(); return; }
    document.addEventListener('nsl:app-ready', function onReady() {
      document.removeEventListener('nsl:app-ready', onReady);
      if (check()) cb();
    });
    // H8: Event-driven only — no polling fallback. Warn after 10s if not ready.
    const timeout = setTimeout(() => {
      if (!check()) console.warn('[FeaturesAddon] App not ready after 10s — features may not load');
    }, 10000);
    document.addEventListener('nsl:app-ready', () => clearTimeout(timeout));
  }

  waitFor(() => typeof db !== 'undefined' && typeof auth !== 'undefined' && typeof firebase !== 'undefined', init);

  function init() {
    injectFeatureNav();
    setupBusyStatus();
    setupTimeCapsuleButton();
    setupCatchMeUpButton();
    setupTasksButton();
    setupVoiceTranscription();
    setupAutoTranslatePreference();
    if (window.__DEBUG__) console.log('[FeaturesAddon] All 10 features loaded');
  }

  // ── 2. FEATURE NAVIGATION BAR ────────────────────────────────────
  function injectFeatureNav() {
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
      <button class="feat-nav-btn" data-action="navigate" data-action-url="album.html" title="Family Album">
        <span class="fn-icon">📸</span>Album
      </button>
      <button class="feat-nav-btn" data-action="navigate" data-action-url="insights.html" title="Chat Insights">
        <span class="fn-icon">📊</span>Insights
      </button>
      <button class="feat-nav-btn" data-action="navigate" data-action-url="calendar.html" title="Family Calendar">
        <span class="fn-icon">📅</span>Calendar
      </button>
      <button class="feat-nav-btn" data-action="navigate" data-action-url="expenses.html" title="Expense Splitter">
        <span class="fn-icon">💰</span>Expenses
      </button>
      <button class="feat-nav-btn" data-action="openTasksPanel" title="Tasks">
        <span class="fn-icon">✅</span>Tasks
      </button>
      <button class="feat-nav-btn" data-action="openTimeCapsuleModal" title="Time Capsule">
        <span class="fn-icon">⏳</span>Capsule
      </button>
      <button class="feat-nav-btn" data-action="openBusyModal" title="Busy Status">
        <span class="fn-icon">🔴</span>Busy
      </button>
      <button class="feat-nav-btn" data-action="toggleCalculator" title="Calculator">
        <span class="fn-icon">🧮</span>Calc
      </button>
    `;
    // Insert into document.body so it's NOT inside the hidden sidebar
    document.body.appendChild(nav);
    nav.hidden = !featureNavMedia.matches;
    nav.style.display = featureNavMedia.matches ? 'flex' : 'none';
    nav.setAttribute('aria-hidden', featureNavMedia.matches ? 'false' : 'true');
  }

  // ── 3. BUSY STATUS (Feature 10) ──────────────────────────────────
  let _busyStatusUnsub = null;
  function setupBusyStatus() {
    // Check if user is currently busy on load
    auth.onAuthStateChanged(user => {
      if (_busyStatusUnsub) { _busyStatusUnsub(); _busyStatusUnsub = null; }
      if (!user) return;
      _busyStatusUnsub = db.collection('users').doc(user.uid).onSnapshot(snap => {
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
          <button class="feat-btn-cancel" data-action="closeBusyModal">Cancel</button>
          <button class="feat-btn-save" data-action="saveBusyStatus">Set Busy</button>
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
      try {
        await db.collection('users').doc(user.uid).update({ busyStatus: msg, busySetAt: firebase.firestore.FieldValue.serverTimestamp() });
        modal.classList.remove('show');
        if (typeof showToast === 'function') showToast('Busy status set. Auto-reply is active.');
      } catch (err) {
        console.error('[FeaturesAddon] saveBusyStatus write failed:', err);
        if (typeof showToast === 'function') showToast('Failed to save. Please try again.', 'error');
      }
    };
    window.clearBusyStatus = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        await db.collection('users').doc(user.uid).update({ busyStatus: null, busySetAt: null });
      } catch (err) {
        console.error('[FeaturesAddon] clearBusyStatus write failed:', err);
        if (typeof showToast === 'function') showToast('Failed to clear busy status. Please try again.', 'error');
      }
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
    banner.innerHTML = `🔴 Busy: "${window.sanitizeHTML(busyStatus)}" — Auto-reply is on <button data-action="clearBusyStatus">Clear</button>`;
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
          <button class="feat-btn-cancel" data-action="closeTimeCapsuleModal">Cancel</button>
          <button class="feat-btn-save" data-action="saveTimeCapsule">Schedule 🚀</button>
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
      try {
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
      } catch (err) {
        console.error('[FeaturesAddon] saveTimeCapsule write failed:', err);
        if (typeof showToast === 'function') showToast('Failed to schedule. Please try again.', 'error');
      }
    };
  }

  // ── 5. CATCH ME UP AI (Feature 4) ────────────────────────────────
  function setupCatchMeUpButton() {
    function _injectCatchUpBtn() {
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
    }
    if (window.MutationBus) {
      MutationBus.onBodyChildList('feat:catchup-btn', function () { _injectCatchUpBtn(); });
    } else {
      const observer = new MutationObserver(_injectCatchUpBtn);
      observer.observe(document.body, { childList: true, subtree: true });
    }

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
        <button class="tasks-close" data-action="closeTasksPanel">✕</button>
      </div>
      <div class="tasks-add-row">
        <input type="text" id="taskInput" placeholder="Add a task…" onkeydown="if(event.key==='Enter')addTask()"/>
        <button data-action="addTask">Add</button>
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
      try {
        await db.collection('tasks').add({ userId: user.uid, text, done: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      } catch (err) {
        console.error('[FeaturesAddon] addTask write failed:', err);
        if (typeof showToast === 'function') showToast('Failed to add task. Please try again.', 'error');
      }
    };
    window.toggleTask = async (id, done) => {
      try {
        await db.collection('tasks').doc(id).update({ done: !done });
      } catch (err) {
        console.error('[FeaturesAddon] toggleTask write failed:', err);
      }
    };
    window.deleteTask = async (id) => {
      try {
        await db.collection('tasks').doc(id).delete();
      } catch (err) {
        console.error('[FeaturesAddon] deleteTask write failed:', err);
      }
    };

    function renderTasks(tasks) {
      const el = document.getElementById('tasksList');
      if (!tasks.length) { el.innerHTML = '<div class="tasks-empty">No tasks yet!</div>'; return; }
      el.innerHTML = tasks.map(t => `
        <div class="task-item">
          <input class="task-cb" type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask('${t.id}',${t.done})"/>
          <span class="task-text ${t.done ? 'done' : ''}">${esc(t.text)}</span>
          <button class="task-del" data-action="deleteTask" data-action-arg="${t.id}">🗑</button>
        </div>`).join('');
    }
  }

  // ── 7. VOICE TRANSCRIPTION (Feature 1) ───────────────────────────
  function setupVoiceTranscription() {
    function _scanVoiceMessages() {
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
    }
    if (window.MutationBus) {
      MutationBus.onBodyChildList('feat:voice-tx', function () { _scanVoiceMessages(); });
    } else {
      const observer = new MutationObserver(_scanVoiceMessages);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    window.transcribeVoice = async (msgId, btn, bubble) => {
      if (!msgId) return;
      btn.textContent = 'Transcribing…';
      btn.disabled = true;
      try {
        var tChatId = (App && App.currentChat && App.currentChat.id) || '';
        var tMsgRef = tChatId
          ? db.collection('messages').doc(tChatId).collection('items').doc(msgId)
          : db.collection('messages').doc(msgId);
        const msgDoc = await tMsgRef.get();
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
        if (res.data.text) await tMsgRef.update({ transcription: res.data.text });
      } catch (e) {
        btn.textContent = '❌ Failed';
        btn.disabled = false;
        setTimeout(() => { btn.textContent = '📝 Transcribe'; }, 2000);
      }
    };
  }

  // ── 8. AUTO-TRANSLATE PREFERENCE (Feature 6) ─────────────────────
  function setupAutoTranslatePreference() {
    function _injectAutoTranslate() {
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
      const pref = localStorage.getItem('autoTranslate') === 'true';
      const cb = document.getElementById('autoTranslateToggle');
      if (cb) cb.checked = pref;
    }
    if (window.MutationBus) {
      MutationBus.onBodyChildList('feat:auto-translate', function () { _injectAutoTranslate(); });
    } else {
      const observer = new MutationObserver(_injectAutoTranslate);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    window.setAutoTranslate = (enabled) => {
      localStorage.setItem('autoTranslate', enabled);
      if (typeof showToast === 'function') showToast(enabled ? '🌍 Auto-translate ON' : 'Auto-translate OFF');
    };
  }

  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

})();
