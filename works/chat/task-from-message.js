/**
 * Task/To-Do from Message — Create assignable tasks from any chat message.
 * Long-press / context menu → "Create Task" → modal with title, assignee, priority, due date.
 * Tasks are stored in Firestore `tasks` collection with a `messageId` link.
 */
(function () {
  'use strict';

  const PRIORITIES = [
    { value: 'low', label: 'Low', color: '#86a8e7' },
    { value: 'medium', label: 'Medium', color: '#f0c040' },
    { value: 'high', label: 'High', color: '#ef4444' }
  ];

  function init() {
    if (window.MutationBus) {
      window.MutationBus.onBodyChildList('inject-task-btn', () => {
        const menu = document.getElementById('_msg-ctx-menu');
        if (menu && !menu.querySelector('.create-task-injected')) {
          const replyBtn = Array.from(menu.querySelectorAll('button')).find(b => b.innerHTML.includes('Reply'));
          if (replyBtn) {
            const match = replyBtn.getAttribute('onclick')?.match(/replyToMsg\('([^']+)'\)/);
            if (match && match[1]) {
              injectCreateTaskButton(menu, match[1]);
            }
          }
        }
      });
    }

    document.addEventListener('nsl:app-ready', () => {
      if (window.MutationBus) {
        window.MutationBus.onBodyChildList('task-msg-scan', () => scanMessagesForTasks());
      }
    });
  }

  function injectCreateTaskButton(menu, msgId) {
    const btn = document.createElement('button');
    btn.className = 'create-task-injected';
    btn.style.cssText = `
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:inherit; transition:background 0.15s;
    `;
    btn.innerHTML = `<span style="font-size:16px">✅</span> Create Task`;
    btn.onmouseenter = () => btn.style.background = 'var(--surface-container-highest)';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = () => {
      if (window._removeCtxMenu) window._removeCtxMenu();
      openTaskFromMessage(msgId);
    };

    const saveBtn = Array.from(menu.querySelectorAll('button')).find(b => b.innerHTML.includes('Save'));
    const deleteBtn = Array.from(menu.querySelectorAll('button')).find(b => b.innerHTML.includes('Delete'));
    const anchor = saveBtn || deleteBtn;
    if (anchor) {
      menu.insertBefore(btn, anchor);
    } else {
      menu.appendChild(btn);
    }
  }

  function openTaskFromMessage(msgId) {
    if (!window.App || !window.App.currentChat) return;
    const chatId = window.App.currentChat.id;
    const msgs = window.App.messages[chatId] || [];
    const msg = msgs.find(m => m.id === msgId);
    if (!msg) return;

    const isGroup = window.App.currentChat.type === 'group';
    const senderName = msg.senderName || 'Unknown';
    const msgPreview = (msg.text || '').slice(0, 120);

    const membersHtml = isGroup ? buildMemberOptions() : '';

    const modalHtml = `
      <div id="create-task-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;">
        <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 m-4 relative animate-scale-up">
          <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('create-task-modal').remove()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div class="flex flex-col items-center mb-5">
            <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[24px]">task_alt</span>
            </div>
            <h3 class="font-bold text-lg text-on-surface">Create Task</h3>
            <p class="text-xs text-on-surface-variant text-center mt-1">From message by ${window.escHtml ? window.escHtml(senderName) : senderName}</p>
          </div>

          <div class="bg-surface-variant/30 p-3 rounded-xl mb-4 max-h-20 overflow-y-auto">
            <p class="text-xs text-on-surface-variant italic">${window.escHtml ? window.escHtml(msgPreview) : msgPreview}</p>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Task Title</label>
              <input type="text" id="task-title-input" value="${window.escHtml ? window.escHtml(msgPreview) : msgPreview}" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="What needs to be done?">
            </div>
            ${isGroup ? `
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Assign To</label>
              <select id="task-assignee-select" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors">
                <option value="">Unassigned</option>
                ${membersHtml}
              </select>
            </div>` : ''}
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Priority</label>
              <div class="flex gap-2">
                ${PRIORITIES.map(p => `
                  <button class="task-priority-btn flex-1 py-2 rounded-xl text-xs font-bold border border-outline-variant/30 transition-all ${p.value === 'medium' ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'}" data-priority="${p.value}" onclick="window._selectTaskPriority('${p.value}')">
                    ${p.label}
                  </button>
                `).join('')}
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Due Date</label>
              <input type="date" id="task-due-input" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer">
            </div>
          </div>

          <button class="w-full mt-5 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition-all" onclick="window._submitTaskFromMessage('${msgId}')">
            Create Task
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    window._selectedTaskPriority = 'medium';
  }

  function buildMemberOptions() {
    if (!window.App || !window.App.currentChat) return '';
    const chat = window.App.currentChat;
    const members = chat.memberIds || chat.members || [];
    const contacts = window.App.contacts || [];

    return members.map(uid => {
      const contact = contacts.find(c => c.uid === uid);
      const name = contact ? (contact.name || contact.displayName || 'Unknown') : 'Unknown';
      return `<option value="${uid}">${window.escHtml ? window.escHtml(name) : name}</option>`;
    }).join('');
  }

  window._selectTaskPriority = function (priority) {
    window._selectedTaskPriority = priority;
    document.querySelectorAll('.task-priority-btn').forEach(btn => {
      const isActive = btn.dataset.priority === priority;
      btn.className = `task-priority-btn flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${isActive ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant border-outline-variant/30'}`;
    });
  };

  window._submitTaskFromMessage = async function (msgId) {
    if (!window.App || !window.App.db || !window.App.auth.currentUser) return;
    const uid = window.App.auth.currentUser.uid;
    const chatId = window.App.currentChat.id;

    const titleInput = document.getElementById('task-title-input');
    const assigneeSelect = document.getElementById('task-assignee-select');
    const dueInput = document.getElementById('task-due-input');

    const title = titleInput ? titleInput.value.trim() : '';
    if (!title) {
      if (window.showToast) window.showToast('Please enter a task title', 'error');
      return;
    }

    const assigneeId = assigneeSelect ? assigneeSelect.value : '';
    const dueDate = dueInput ? dueInput.value : '';
    const priority = window._selectedTaskPriority || 'medium';

    try {
      await window.App.db.collection('tasks').add({
        userId: uid,
        text: title,
        done: false,
        priority: priority,
        assigneeId: assigneeId,
        dueDate: dueDate,
        messageId: msgId,
        chatId: chatId,
        chatName: window.App.currentChat.name || '',
        createdBy: uid,
        createdByName: window.App.currentUser?.name || 'User',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (window.showToast) window.showToast('Task created successfully', 'success');
      document.getElementById('create-task-modal')?.remove();

      if (window.openTasksPanel) window.openTasksPanel();
    } catch (e) {
      console.error('Error creating task:', e);
      if (window.showToast) window.showToast('Failed to create task', 'error');
    }
  };

  function scanMessagesForTasks() {
    document.querySelectorAll('.message-bubble, .msg-bubble, .chat-message').forEach(el => {
      if (el.dataset.taskLinked) return;
      const msgEl = el.closest('[data-msg-id], [id^="msg-"]');
      if (!msgEl) return;
      const msgId = msgEl.dataset.msgId || msgEl.id?.replace('msg-', '');
      if (!msgId) return;

      const msgs = window.App?.messages?.[window.App?.currentChat?.id] || [];
      const msg = msgs.find(m => m.id === msgId);
      if (msg && msg.taskId) {
        const badge = document.createElement('div');
        badge.className = 'task-linked-badge';
        badge.innerHTML = `<span class="material-symbols-outlined text-[12px]">task_alt</span> Task`;
        badge.style.cssText = `
          display:inline-flex; align-items:center; gap:3px;
          font-size:10px; font-weight:600; color:var(--primary);
          background:var(--primary/10); padding:2px 6px;
          border-radius:8px; margin-top:4px; cursor:pointer;
        `;
        badge.onclick = () => { if (window.openTasksPanel) window.openTasksPanel(); };
        el.appendChild(badge);
        el.dataset.taskLinked = '1';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
