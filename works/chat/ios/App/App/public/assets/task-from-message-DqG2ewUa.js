import{n as e}from"./firebase-config-B1gHZycV.js";var t=e((()=>{(function(){let e=[{value:`low`,label:`Low`,color:`#86a8e7`},{value:`medium`,label:`Medium`,color:`#f0c040`},{value:`high`,label:`High`,color:`#ef4444`}];function t(){window.MutationBus&&window.MutationBus.onBodyChildList(`inject-task-btn`,()=>{let e=document.getElementById(`_msg-ctx-menu`);if(e&&!e.querySelector(`.create-task-injected`)){let t=Array.from(e.querySelectorAll(`button`)).find(e=>e.innerHTML.includes(`Reply`));if(t){let r=t.getAttribute(`onclick`)?.match(/replyToMsg\('([^']+)'\)/);r&&r[1]&&n(e,r[1])}}}),document.addEventListener(`nsl:app-ready`,()=>{window.MutationBus&&window.MutationBus.onBodyChildList(`task-msg-scan`,()=>a())})}function n(e,t){let n=document.createElement(`button`);n.className=`create-task-injected`,n.style.cssText=`
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:inherit; transition:background 0.15s;
    `,n.innerHTML=`<span style="font-size:16px">âœ…</span> Create Task`,n.onmouseenter=()=>n.style.background=`var(--surface-container-highest)`,n.onmouseleave=()=>n.style.background=`transparent`,n.onclick=()=>{window._removeCtxMenu&&window._removeCtxMenu(),r(t)};let i=Array.from(e.querySelectorAll(`button`)).find(e=>e.innerHTML.includes(`Save`)),a=Array.from(e.querySelectorAll(`button`)).find(e=>e.innerHTML.includes(`Delete`)),o=i||a;o?e.insertBefore(n,o):e.appendChild(n)}function r(t){if(!window.App||!window.App.currentChat)return;let n=window.App.currentChat.id,r=(window.App.messages[n]||[]).find(e=>e.id===t);if(!r)return;let a=window.App.currentChat.type===`group`,o=r.senderName||`Unknown`,s=(r.text||``).slice(0,120),c=a?i():``,l=`
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
            <p class="text-xs text-on-surface-variant text-center mt-1">From message by ${window.escHtml?window.escHtml(o):o}</p>
          </div>

          <div class="bg-surface-variant/30 p-3 rounded-xl mb-4 max-h-20 overflow-y-auto">
            <p class="text-xs text-on-surface-variant italic">${window.escHtml?window.escHtml(s):s}</p>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Task Title</label>
              <input type="text" id="task-title-input" value="${window.escHtml?window.escHtml(s):s}" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="What needs to be done?">
            </div>
            ${a?`
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Assign To</label>
              <select id="task-assignee-select" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors">
                <option value="">Unassigned</option>
                ${c}
              </select>
            </div>`:``}
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Priority</label>
              <div class="flex gap-2">
                ${e.map(e=>`
                  <button class="task-priority-btn flex-1 py-2 rounded-xl text-xs font-bold border border-outline-variant/30 transition-all ${e.value===`medium`?`bg-primary/10 border-primary text-primary`:`bg-surface-container-high text-on-surface-variant hover:bg-surface-variant`}" data-priority="${e.value}" onclick="window._selectTaskPriority('${e.value}')">
                    ${e.label}
                  </button>
                `).join(``)}
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Due Date</label>
              <input type="date" id="task-due-input" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer">
            </div>
          </div>

          <button class="w-full mt-5 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition-all" onclick="window._submitTaskFromMessage('${t}')">
            Create Task
          </button>
        </div>
      </div>
    `;document.body.insertAdjacentHTML(`beforeend`,l),window._selectedTaskPriority=`medium`}function i(){if(!window.App||!window.App.currentChat)return``;let e=window.App.currentChat,t=e.memberIds||e.members||[],n=window.App.contacts||[];return t.map(e=>{let t=n.find(t=>t.uid===e),r=t&&(t.name||t.displayName)||`Unknown`;return`<option value="${e}">${window.escHtml?window.escHtml(r):r}</option>`}).join(``)}window._selectTaskPriority=function(e){window._selectedTaskPriority=e,document.querySelectorAll(`.task-priority-btn`).forEach(t=>{t.className=`task-priority-btn flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${t.dataset.priority===e?`bg-primary/10 border-primary text-primary`:`bg-surface-container-high text-on-surface-variant hover:bg-surface-variant border-outline-variant/30`}`})},window._submitTaskFromMessage=async function(e){if(!window.App||!window.App.db||!window.App.auth.currentUser)return;let t=window.App.auth.currentUser.uid,n=window.App.currentChat.id,r=document.getElementById(`task-title-input`),i=document.getElementById(`task-assignee-select`),a=document.getElementById(`task-due-input`),o=r?r.value.trim():``;if(!o){window.showToast&&window.showToast(`Please enter a task title`,`error`);return}let s=i?i.value:``,c=a?a.value:``,l=window._selectedTaskPriority||`medium`;try{await window.App.db.collection(`tasks`).add({userId:t,text:o,done:!1,priority:l,assigneeId:s,dueDate:c,messageId:e,chatId:n,chatName:window.App.currentChat.name||``,createdBy:t,createdByName:window.App.currentUser?.name||`User`,createdAt:firebase.firestore.FieldValue.serverTimestamp()}),window.showToast&&window.showToast(`Task created successfully`,`success`),document.getElementById(`create-task-modal`)?.remove(),window.openTasksPanel&&window.openTasksPanel()}catch(e){window.__DEBUG__&&console.error(`Error creating task:`,e),window.showToast&&window.showToast(`Failed to create task`,`error`)}};function a(){document.querySelectorAll(`.message-bubble, .msg-bubble, .chat-message`).forEach(e=>{if(e.dataset.taskLinked)return;let t=e.closest(`[data-msg-id], [id^="msg-"]`);if(!t)return;let n=t.dataset.msgId||t.id?.replace(`msg-`,``);if(!n)return;let r=(window.App?.messages?.[window.App?.currentChat?.id]||[]).find(e=>e.id===n);if(r&&r.taskId){let t=document.createElement(`div`);t.className=`task-linked-badge`,t.innerHTML=`<span class="material-symbols-outlined text-[12px]">task_alt</span> Task`,t.style.cssText=`
          display:inline-flex; align-items:center; gap:3px;
          font-size:10px; font-weight:600; color:var(--primary);
          background:var(--primary/10); padding:2px 6px;
          border-radius:8px; margin-top:4px; cursor:pointer;
        `,t.onclick=()=>{window.openTasksPanel&&window.openTasksPanel()},e.appendChild(t),e.dataset.taskLinked=`1`}})}document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,t):t()})()}));export default t();