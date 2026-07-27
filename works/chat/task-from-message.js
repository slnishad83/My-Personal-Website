/* task-from-message.js — Convert messages to tasks, personal & group to-do lists */
(function () {
  'use strict';

  var Tasks = window.Tasks = window.Tasks || {};
  Tasks.list = [];

  function db() { return window.App && window.App.db ? window.App.db : null; }
  function uid() { return window.App && window.App.auth && window.App.auth.currentUser ? window.App.auth.currentUser.uid : null; }
  function esc(s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }
  function toast(msg, t) { if (typeof window.showToast === 'function') window.showToast(msg, t || 'info'); }

  Tasks.init = async function () {
    var userId = uid();
    if (!userId || !db()) return;
    try {
      var snap = await db().collection('tasks').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
      Tasks.list = snap.docs.map(function (d) {
        var data = d.data();
        data.id = d.id;
        return data;
      });
    } catch (e) {
      if (window.__DEBUG__) console.warn('[Tasks] Load failed:', e.message);
    }
  };

  Tasks.createTaskFromMessage = async function (msgText, msgId, chatId) {
    var userId = uid();
    if (!userId || !db()) { toast('Sign in required', 'error'); return null; }
    if (!msgText) return null;

    var task = {
      userId: userId,
      chatId: chatId || null,
      messageId: msgId || null,
      title: msgText.length > 80 ? msgText.substring(0, 80) + '...' : msgText,
      description: msgText,
      completed: false,
      priority: 'medium', // 'high' | 'medium' | 'low'
      dueAt: Date.now() + 86400000, // default 24h
      createdAt: Date.now()
    };

    try {
      var ref = await db().collection('tasks').add(task);
      task.id = ref.id;
      Tasks.list.unshift(task);
      toast('Task created from message 🎯', 'success');
      return task;
    } catch (e) {
      toast('Failed to create task', 'error');
      return null;
    }
  };

  Tasks.toggleTask = async function (taskId) {
    var task = Tasks.list.find(function (t) { return t.id === taskId; });
    if (!task || !db()) return;
    task.completed = !task.completed;
    try {
      await db().collection('tasks').doc(taskId).update({ completed: task.completed, updatedAt: Date.now() });
      toast(task.completed ? 'Task completed! 🎉' : 'Task reopened', 'info');
      Tasks.renderUI();
    } catch (_) {}
  };

  Tasks.deleteTask = async function (taskId) {
    if (!db()) return;
    try {
      await db().collection('tasks').doc(taskId).delete();
      Tasks.list = Tasks.list.filter(function (t) { return t.id !== taskId; });
      toast('Task deleted', 'info');
      Tasks.renderUI();
    } catch (_) {}
  };

  Tasks.showModal = async function () {
    await Tasks.init();
    var existing = document.getElementById('tasks-modal');
    if (existing) { existing.remove(); return; }

    var overlay = document.createElement('div');
    overlay.id = 'tasks-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;width:92vw;max-width:500px;max-height:85vh;overflow-y:auto;color:var(--on-surface);box-shadow:0 20px 60px rgba(0,0,0,0.4)';

    panel.innerHTML = '\
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">\
        <div style="display:flex;align-items:center;gap:8px">\
          <span class="material-symbols-outlined" style="color:var(--primary);font-size:24px">task_alt</span>\
          <h3 style="margin:0;font-size:18px;font-weight:700">Tasks & To-Dos</h3>\
        </div>\
        <button onclick="document.getElementById(\'tasks-modal\')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px;min-width:44px;min-height:44px">&times;</button>\
      </div>\
      <div style="display:flex;gap:8px;margin-bottom:16px">\
        <input type="text" id="new-task-input" placeholder="Add a new task..." style="flex:1;padding:10px 14px;border-radius:12px;border:1px solid var(--outline-variant);background:var(--surface-container-low);color:var(--on-surface);font-size:13px;outline:none" onkeydown="if(event.key===\'Enter\')Tasks.addNewFromInput()">\
        <button onclick="Tasks.addNewFromInput()" style="padding:10px 16px;border-radius:12px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:700;cursor:pointer">Add</button>\
      </div>\
      <div id="tasks-list-container"></div>';

    overlay.appendChild(panel);
    overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);

    Tasks.renderUI();
  };

  Tasks.addNewFromInput = function () {
    var input = document.getElementById('new-task-input');
    if (!input || !input.value.trim()) return;
    var val = input.value.trim();
    input.value = '';
    Tasks.createTaskFromMessage(val);
    setTimeout(Tasks.renderUI, 300);
  };

  Tasks.renderUI = function () {
    var container = document.getElementById('tasks-list-container');
    if (!container) return;

    if (!Tasks.list.length) {
      container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--on-surface-variant)"><span class="material-symbols-outlined" style="font-size:40px;opacity:0.3">check_circle</span><p style="margin:8px 0 0;font-size:13px">No tasks — all caught up!</p></div>';
      return;
    }

    container.innerHTML = Tasks.list.map(function (t) {
      return '\
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--surface-container-low,rgba(0,0,0,0.03));margin-bottom:8px;border:1px solid var(--outline-variant,rgba(0,0,0,0.06))">\
          <input type="checkbox" ' + (t.completed ? 'checked' : '') + ' onchange="Tasks.toggleTask(\'' + t.id + '\')" style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer">\
          <div style="flex:1;min-width:0">\
            <div style="font-size:13px;font-weight:600;' + (t.completed ? 'text-decoration:line-through;opacity:0.5' : '') + '">' + esc(t.title) + '</div>\
          </div>\
          <button onclick="Tasks.deleteTask(\'' + t.id + '\')" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;padding:4px;min-width:36px;min-height:36px"><span class="material-symbols-outlined" style="font-size:18px">delete</span></button>\
        </div>';
    }).join('');
  };
})();
