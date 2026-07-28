import{t as e}from"./modulepreload-polyfill-1QPZNIo4.js";var t=e((()=>{(function(){let e=window.matchMedia(`(max-width: 768px)`),t=!1;function n(e,t){if(e()){t();return}document.addEventListener(`nsl:app-ready`,function n(){document.removeEventListener(`nsl:app-ready`,n),e()&&t()});let n=setTimeout(()=>{e()||window.__DEBUG__&&console.warn(`[FeaturesAddon] App not ready after 10s â€” features may not load`)},1e4);document.addEventListener(`nsl:app-ready`,()=>clearTimeout(n))}n(()=>typeof db<`u`&&typeof auth<`u`&&typeof firebase<`u`,r);function r(){i(),o(),c(),l(),u(),d(),f(),window.__DEBUG__&&console.log(`[FeaturesAddon] All 10 features loaded`)}function i(){if(!t){let n=()=>{let t=document.getElementById(`featureNavBar`);if(!t)return;let n=e.matches;t.hidden=!n,t.style.display=n?`flex`:`none`,t.setAttribute(`aria-hidden`,n?`false`:`true`)};typeof e.addEventListener==`function`?e.addEventListener(`change`,n):typeof e.addListener==`function`&&e.addListener(n),window.addEventListener(`resize`,n,{passive:!0}),t=!0}let n=document.createElement(`div`);n.className=`feature-nav-bar`,n.id=`featureNavBar`,n.innerHTML=`
      <button class="feat-nav-btn" data-action="navigate" data-action-url="album.html" title="Family Album">
        <span class="fn-icon">ðŸ“¸</span>Album
      </button>
      <button class="feat-nav-btn" data-action="navigate" data-action-url="insights.html" title="Chat Insights">
        <span class="fn-icon">ðŸ“Š</span>Insights
      </button>
      <button class="feat-nav-btn" data-action="navigate" data-action-url="calendar.html" title="Family Calendar">
        <span class="fn-icon">ðŸ“…</span>Calendar
      </button>
      <button class="feat-nav-btn" data-action="navigate" data-action-url="expenses.html" title="Expense Splitter">
        <span class="fn-icon">ðŸ’°</span>Expenses
      </button>
      <button class="feat-nav-btn" data-action="openTasksPanel" title="Tasks">
        <span class="fn-icon">âœ…</span>Tasks
      </button>
      <button class="feat-nav-btn" data-action="openTimeCapsuleModal" title="Time Capsule">
        <span class="fn-icon">â³</span>Capsule
      </button>
      <button class="feat-nav-btn" data-action="openBusyModal" title="Busy Status">
        <span class="fn-icon">ðŸ”´</span>Busy
      </button>
      <button class="feat-nav-btn" data-action="toggleCalculator" title="Calculator">
        <span class="fn-icon">ðŸ§®</span>Calc
      </button>
    `,document.body.appendChild(n),n.hidden=!e.matches,n.style.display=e.matches?`flex`:`none`,n.setAttribute(`aria-hidden`,e.matches?`false`:`true`)}let a=null;function o(){auth.onAuthStateChanged(e=>{a&&(a(),a=null),e&&(a=db.collection(`users`).doc(e.uid).onSnapshot(e=>{s((e.data()||{}).busyStatus)},function(t){window.__DEBUG__&&console.error(`[FeaturesAddon] Busy status snapshot error:`,t?.message||t),window.App&&typeof window.App.safeOnSnapshot==`function`&&setTimeout(function(){a=db.collection(`users`).doc(e.uid).onSnapshot(function(e){s((e.data()||{}).busyStatus)},function(){})},3e3)}))});let e=document.createElement(`div`);e.className=`feat-modal-overlay`,e.id=`busyModal`,e.innerHTML=`
      <div class="feat-modal-box">
        <h3>ðŸ”´ Set Busy Status</h3>
        <p style="font-size:13px;color:#667781;margin-bottom:16px">
          People who message you will get an automatic reply. Clear it when you're available again.
        </p>
        <div class="feat-form-group">
          <label>Status message</label>
          <select id="busyPreset" onchange="document.getElementById('busyMsg').value=this.value">
            <option value="">Choose a presetâ€¦</option>
            <option value="In a meeting, will reply soon">In a meeting</option>
            <option value="Driving, will reply when I stop">Driving ðŸš—</option>
            <option value="Sleeping, will reply in the morning">Sleeping ðŸ˜´</option>
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
      </div>`,document.body.appendChild(e),window.openBusyModal=()=>e.classList.add(`show`),window.closeBusyModal=()=>e.classList.remove(`show`),window.saveBusyStatus=async()=>{let t=document.getElementById(`busyMsg`).value.trim();if(!t){typeof showToast==`function`&&showToast(`Enter a status message`,`error`);return}let n=auth.currentUser;if(n)try{await db.collection(`users`).doc(n.uid).update({busyStatus:t,busySetAt:firebase.firestore.FieldValue.serverTimestamp()}),e.classList.remove(`show`),typeof showToast==`function`&&showToast(`Busy status set. Auto-reply is active.`)}catch(e){window.__DEBUG__&&console.error(`[FeaturesAddon] saveBusyStatus write failed:`,e),typeof showToast==`function`&&showToast(`Failed to save. Please try again.`,`error`)}},window.clearBusyStatus=async()=>{let e=auth.currentUser;if(e)try{await db.collection(`users`).doc(e.uid).update({busyStatus:null,busySetAt:null})}catch(e){window.__DEBUG__&&console.error(`[FeaturesAddon] clearBusyStatus write failed:`,e),typeof showToast==`function`&&showToast(`Failed to clear busy status. Please try again.`,`error`)}}}function s(e){let t=document.getElementById(`busyBanner`);if(t&&t.remove(),!e)return;let n=document.createElement(`div`);n.id=`busyBanner`,n.className=`busy-banner`,n.setAttribute(`aria-live`,`polite`),n.innerHTML=`ðŸ”´ Busy: "${window.sanitizeHTML(e)}" â€” Auto-reply is on <button data-action="clearBusyStatus">Clear</button>`;let r=document.getElementById(`featureNavBar`);r&&r.parentNode?r.parentNode.insertBefore(n,r.nextSibling):document.body.prepend(n)}function c(){let e=document.createElement(`div`);e.className=`feat-modal-overlay`,e.id=`timeCapsuleModal`,e.innerHTML=`
      <div class="feat-modal-box">
        <h3>â³ Time Capsule Message</h3>
        <p style="font-size:13px;color:#667781;margin-bottom:16px">
          Write a message that will be delivered on a future date â€” a birthday next year, a new year wish, anything.
        </p>
        <div class="feat-form-group">
          <label>Your message</label>
          <textarea id="capsuleMsg" rows="4" placeholder="Write your message hereâ€¦" style="resize:none"></textarea>
        </div>
        <div class="feat-form-group">
          <label>Deliver on this date</label>
          <input type="datetime-local" id="capsuleDate"/>
        </div>
        <div class="feat-form-group">
          <label>Send to (chat)</label>
          <select id="capsuleTarget">
            <option value="">Loading chatsâ€¦</option>
          </select>
        </div>
        <div class="feat-modal-btns">
          <button class="feat-btn-cancel" data-action="closeTimeCapsuleModal">Cancel</button>
          <button class="feat-btn-save" data-action="saveTimeCapsule">Schedule ðŸš€</button>
        </div>
      </div>`,document.body.appendChild(e),window.openTimeCapsuleModal=async()=>{let t=new Date(Date.now()+10080*60*1e3);document.getElementById(`capsuleDate`).value=t.toISOString().slice(0,16),document.getElementById(`capsuleMsg`).value=``;let n=auth.currentUser;if(n)try{let e=[];e.push({value:`saved_${n.uid}`,label:`ðŸ“Œ Saved Messages (to yourself)`}),(await db.collection(`groups`).get()).docs.forEach(t=>{let r=t.data();r.memberIds&&r.memberIds.includes(n.uid)&&e.push({value:`group_${t.id}`,label:`ðŸ‘¥ ${r.name||`Group`}`})}),document.getElementById(`capsuleTarget`).innerHTML=e.map(e=>`<option value="${e.value}">${window.sanitizeHTML(e.label)}</option>`).join(``)}catch{}e.classList.add(`show`)},window.closeTimeCapsuleModal=()=>e.classList.remove(`show`),window.saveTimeCapsule=async()=>{let t=document.getElementById(`capsuleMsg`).value.trim(),n=document.getElementById(`capsuleDate`).value,r=document.getElementById(`capsuleTarget`).value;if(!t||!n||!r){typeof showToast==`function`&&showToast(`Fill in all fields`,`error`);return}let i=new Date(n);if(i<=new Date){typeof showToast==`function`&&showToast(`Choose a future date`,`error`);return}let a=auth.currentUser,[o,s]=r.split(`_`);try{await db.collection(`scheduledMessages`).add({userId:a.uid,text:t,dueAt:firebase.firestore.Timestamp.fromDate(i),status:`pending`,chatType:o===`saved`?`direct`:o,chatId:s,directId:o===`direct`||o===`saved`?s:null,groupId:o===`group`?s:null,isTimeCapsule:!0,createdAt:firebase.firestore.FieldValue.serverTimestamp()}),e.classList.remove(`show`),typeof showToast==`function`&&showToast(`â³ Message scheduled for ${i.toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`})}`)}catch(e){window.__DEBUG__&&console.error(`[FeaturesAddon] saveTimeCapsule write failed:`,e),typeof showToast==`function`&&showToast(`Failed to schedule. Please try again.`,`error`)}}}function l(){function e(){let e=document.querySelector(`.chat-header, [class*="chat-header"], .message-header`);if(!e||e.querySelector(`.catchup-btn`)||window.matchMedia(`(min-width: 901px)`).matches)return;let t=document.createElement(`button`);t.className=`catchup-btn`,t.title=`Catch Me Up â€” AI summary of recent messages`,t.style.cssText=`background:none;border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;color:var(--brand-dark,#008069);font-weight:600;font-family:inherit;margin-right:4px`,t.innerHTML=`ðŸ§\xA0 Catch Me Up`,t.onclick=()=>{typeof window.catchMeUp==`function`&&window.catchMeUp()};let n=e.querySelector(`[class*="actions"], [class*="right"], [class*="icons"]`);n&&n.prepend(t)}window.MutationBus?MutationBus.onBodyChildList(`feat:catchup-btn`,function(){e()}):new MutationObserver(e).observe(document.body,{childList:!0,subtree:!0}),window.catchMeUp=async()=>{let e=document.getElementById(`catchupResult`);if(e){e.remove();return}if(typeof currentChat>`u`||!currentChat){typeof showToast==`function`&&showToast(`Open a chat first`);return}let t=document.createElement(`div`);t.id=`catchupResult`,t.className=`catchup-result`,t.setAttribute(`role`,`status`),t.setAttribute(`aria-live`,`polite`),t.innerHTML=`<div class="catchup-title">ðŸ§\xA0 AI Summary</div><div>Analysing messagesâ€¦</div>`;let n=document.querySelector(`.messages-area, #messagesArea, [class*="messages"]`);n&&n.before(t);try{let e=firebase.functions().httpsCallable(`catchMeUp`,{timeout:3e4}),n=typeof currentChatType<`u`?currentChatType:`direct`,r=await e({chatId:currentChat.id,chatType:n});t.innerHTML=`<div class="catchup-title">&#129504; What you missed</div>${window.sanitizeHTML(r.data.summary||`Nothing new since you were last here.`)}`}catch{t.innerHTML=`<div class="catchup-title">ðŸ§\xA0 Catch Me Up</div>Could not generate summary. Try again.`}}}function u(){let e=document.createElement(`div`);e.className=`tasks-panel`,e.id=`tasksPanel`,e.innerHTML=`
      <div class="tasks-header">
        <h3>âœ… My Tasks</h3>
        <button class="tasks-close" data-action="closeTasksPanel">âœ•</button>
      </div>
      <div class="tasks-add-row">
        <input type="text" id="taskInput" placeholder="Add a taskâ€¦" onkeydown="if(event.key==='Enter')addTask()"/>
        <button data-action="addTask">Add</button>
      </div>
      <div class="tasks-list" id="tasksList" aria-live="polite"><div class="tasks-empty">No tasks yet. Add one above!</div></div>
    `,document.body.appendChild(e);let t=null;window.openTasksPanel=()=>{e.classList.add(`open`);let r=auth.currentUser;r&&(t&&t(),t=db.collection(`tasks`).where(`userId`,`==`,r.uid).orderBy(`createdAt`,`desc`).limit(100).onSnapshot(e=>{n(e.docs.map(e=>({id:e.id,...e.data()})))},function(e){window.__DEBUG__&&console.error(`[FeaturesAddon] Tasks snapshot error:`,e?.message||e),typeof showToast==`function`&&showToast(`Failed to load tasks`,`error`)}))},window.closeTasksPanel=()=>{e.classList.remove(`open`),t&&(t(),t=null)},window.addTask=async()=>{let e=document.getElementById(`taskInput`),t=e.value.trim();if(!t)return;let n=auth.currentUser;if(n){e.value=``;try{await db.collection(`tasks`).add({userId:n.uid,text:t,done:!1,createdAt:firebase.firestore.FieldValue.serverTimestamp()})}catch(e){window.__DEBUG__&&console.error(`[FeaturesAddon] addTask write failed:`,e),typeof showToast==`function`&&showToast(`Failed to add task. Please try again.`,`error`)}}},window.toggleTask=async(e,t)=>{try{await db.collection(`tasks`).doc(e).update({done:!t})}catch(e){window.__DEBUG__&&console.error(`[FeaturesAddon] toggleTask write failed:`,e)}},window.deleteTask=async e=>{try{await db.collection(`tasks`).doc(e).delete()}catch(e){window.__DEBUG__&&console.error(`[FeaturesAddon] deleteTask write failed:`,e)}};function n(e){let t=document.getElementById(`tasksList`);if(!e.length){t.innerHTML=`<div class="tasks-empty">No tasks yet!</div>`;return}t.innerHTML=e.map(e=>`
        <div class="task-item">
          <input class="task-cb" type="checkbox" ${e.done?`checked`:``} onchange="toggleTask('${e.id}',${e.done})"/>
          <span class="task-text ${e.done?`done`:``}">${p(e.text)}</span>
          <button class="task-del" data-action="deleteTask" data-action-arg="${e.id}">ðŸ—‘</button>
        </div>`).join(``)}}function d(){function e(){document.querySelectorAll(`.voice-message, [class*="voice"], audio`).forEach(e=>{let t=e.closest(`.message-bubble, [class*="bubble"], [class*="message-content"]`);if(!t||t.querySelector(`.transcribe-btn, .transcription-text`))return;let n=t.closest(`[data-message-id], [class*="message"]`),r=n?.dataset?.messageId||n?.id,i=document.createElement(`button`);i.className=`transcribe-btn`,i.textContent=`ðŸ“ Transcribe`,i.onclick=()=>transcribeVoice(r,i,t),t.appendChild(i)})}window.MutationBus?MutationBus.onBodyChildList(`feat:voice-tx`,function(){e()}):new MutationObserver(e).observe(document.body,{childList:!0,subtree:!0}),window.transcribeVoice=async(e,t,n)=>{if(e){t.textContent=`Transcribingâ€¦`,t.disabled=!0;try{var r=App&&App.currentChat&&App.currentChat.id||``,i=r?db.collection(`messages`).doc(r).collection(`items`).doc(e):db.collection(`messages`).doc(e);let n=(await i.get()).data();if(!n?.attachment?.url){t.textContent=`âŒ No audio`;return}if(n.transcription){let e=document.createElement(`span`);e.className=`transcription-text`,e.textContent=`ðŸ“ `+n.transcription,t.replaceWith(e);return}let a=await firebase.functions().httpsCallable(`transcribeVoiceMessage`,{timeout:3e4})({messageId:e,audioUrl:n.attachment.url}),o=document.createElement(`span`);o.className=`transcription-text`,o.textContent=`ðŸ“ `+(a.data.text||`Could not transcribe`),t.replaceWith(o),a.data.text&&await i.update({transcription:a.data.text})}catch{t.textContent=`âŒ Failed`,t.disabled=!1,setTimeout(()=>{t.textContent=`ðŸ“ Transcribe`},2e3)}}}}function f(){function e(){let e=document.querySelector(`#settingsModal, [id*="settings"], [class*="settings-modal"]`);if(!e||e.querySelector(`.auto-translate-toggle`))return;let t=document.createElement(`div`);t.className=`auto-translate-toggle`,t.style.cssText=`padding:12px 18px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border,#e2e8f0)`,t.innerHTML=`
        <div>
          <div style="font-weight:600;font-size:14px">ðŸŒ Auto-Translate Messages</div>
          <div style="font-size:12px;color:var(--muted,#667781)">Translate incoming messages to your language</div>
        </div>
        <label style="position:relative;display:inline-block;width:44px;height:24px">
          <input type="checkbox" id="autoTranslateToggle" style="opacity:0;width:0;height:0" onchange="setAutoTranslate(this.checked)"/>
          <span style="position:absolute;cursor:pointer;inset:0;background:#ccc;border-radius:24px;transition:0.2s"></span>
        </label>`,e.querySelector(`[class*="body"], [class*="content"], div`)?.appendChild(t);let n=localStorage.getItem(`autoTranslate`)===`true`,r=document.getElementById(`autoTranslateToggle`);r&&(r.checked=n)}window.MutationBus?MutationBus.onBodyChildList(`feat:auto-translate`,function(){e()}):new MutationObserver(e).observe(document.body,{childList:!0,subtree:!0}),window.setAutoTranslate=e=>{localStorage.setItem(`autoTranslate`,e),typeof showToast==`function`&&showToast(e?`ðŸŒ Auto-translate ON`:`Auto-translate OFF`)}}function p(e){return String(e||``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`)}})()}));export default t();