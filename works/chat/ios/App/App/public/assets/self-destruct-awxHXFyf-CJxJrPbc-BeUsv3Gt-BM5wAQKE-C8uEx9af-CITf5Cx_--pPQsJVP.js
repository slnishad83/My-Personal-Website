import{n as e}from"./modulepreload-polyfill-C_LrRQgL.js";import{C as t,D as n,E as r,O as i,S as a,T as o,a as s,b as c,d as l,h as u,i as d,j as f,l as p,s as m,u as h,v as g,x as _}from"./feature-security-BDorBO9o.js";var v,y;e((()=>{i(),c(),f((()=>{a(),l(),t((()=>{u(),p(),_((()=>{o(),h(),g((()=>{r(),d(),n((()=>{s(),v=m((()=>{(function(){let e=null,t=`nsl_disappearing_default`,n={getGlobalDefault(){try{return parseInt(localStorage.getItem(t)||`0`,10)}catch{return 0}},setGlobalDefault(e){try{localStorage.setItem(t,e.toString())}catch{}},applyDefaultToNewChats(e){let t=this.getGlobalDefault();if(t>0&&App.db&&App.auth?.currentUser){let n=(App.chats||[]).find(t=>t.id===e);if(n&&!n.ephemeralTimer){let r=n.type===`group`?`groups`:`directChats`;App.db.collection(r).doc(e).update({ephemeralTimer:t}).catch(()=>{})}}},openGlobalDefaultSettings(){let e=this.getGlobalDefault(),t=`
        <div id="global-disappearing-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center" style="display:flex;">
          <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-xs shadow-2xl p-6 m-4 relative">
            <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('global-disappearing-modal').remove()">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
            <div class="flex flex-col items-center mb-6">
              <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <span class="material-symbols-outlined text-[24px]">timer</span>
              </div>
              <h3 class="font-bold text-lg text-on-surface">Default Disappearing Messages</h3>
              <p class="text-xs text-on-surface-variant text-center mt-1">Set the default timer for new chats. Existing chats won't be affected.</p>
            </div>
            <div class="space-y-2">
              ${[{label:`Off`,value:0},{label:`5 Minutes`,value:3e5},{label:`1 Hour`,value:36e5},{label:`24 Hours`,value:864e5},{label:`7 Days`,value:6048e5}].map(t=>`
                <label class="flex items-center justify-between p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-variant/30 transition-colors">
                  <span class="text-sm font-medium">${t.label}</span>
                  <input type="radio" name="global-ephemeral-timer" value="${t.value}" ${e===t.value?`checked`:``} class="w-4 h-4 text-primary">
                </label>`).join(``)}
            </div>
            <button class="w-full mt-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition-all" onclick="window.saveGlobalDisappearingDefault()">Save</button>
          </div>
        </div>`;document.body.insertAdjacentHTML(`beforeend`,t)}};window.SelfDestruct=n,window.saveGlobalDisappearingDefault=function(){let e=document.querySelector(`input[name="global-ephemeral-timer"]:checked`);if(!e)return;let t=parseInt(e.value,10);n.setGlobalDefault(t),window.showToast&&showToast(t===0?`Default turned off`:`Default timer set for new chats`,`success`),document.getElementById(`global-disappearing-modal`)?.remove()};function r(){window.MutationBus&&window.MutationBus.onBodyChildList(`inject-disappearing-btn`,()=>{let e=document.getElementById(`_msg-ctx-menu`);e&&!e.querySelector(`.disappearing-msg-injected`)&&Array.from(e.querySelectorAll(`button`)).find(e=>e.innerHTML.includes(`Search in chat`))&&i(e)}),document.addEventListener(`nsl:app-ready`,()=>{let t=window.selectChat;t&&(window.selectChat=function(...e){let n=t.apply(this,e);return setTimeout(o,100),n}),e&&clearInterval(e),e=setInterval(s,6e4)})}function i(e){if(!window.App||!window.App.currentChat)return;let t=window.App.currentChat.ephemeralTimer||0,n=`Off`;t===3e5?n=`5 min`:t===36e5?n=`1 hour`:t===864e5&&(n=`24 hours`);let r=document.createElement(`button`);r.className=`disappearing-msg-injected`,r.style.cssText=`
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:inherit; transition:background 0.15s; justify-content:space-between;
    `,r.innerHTML=`<div style="display:flex; align-items:center; gap:10px;"><span style="font-size:16px">â³</span> Disappearing Messages</div> <span style="font-size:11px; opacity:0.7;">${n}</span>`,r.onmouseenter=()=>r.style.background=`var(--surface-container-highest)`,r.onmouseleave=()=>r.style.background=`transparent`,r.onclick=()=>{window._removeCtxMenu&&window._removeCtxMenu(),a()};let i=Array.from(e.querySelectorAll(`button`)).find(e=>e.innerHTML.includes(`Clear History`));i?e.insertBefore(r,i):e.appendChild(r)}function a(){if(!window.App||!window.App.currentChat)return;let e=window.App.currentChat.ephemeralTimer||0,t=`
      <div id="disappearing-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;">
        <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-xs shadow-2xl p-6 m-4 relative animate-scale-up">
          <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('disappearing-modal').remove()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
          
          <div class="flex flex-col items-center mb-6">
            <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[24px]">timer</span>
            </div>
            <h3 class="font-bold text-lg text-on-surface">Disappearing Messages</h3>
            <p class="text-xs text-on-surface-variant text-center mt-1">Make new messages in this chat disappear for everyone after they are sent.</p>
          </div>
          
          <div class="space-y-2">
            <label class="flex items-center justify-between p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-variant/30 transition-colors">
              <span class="text-sm font-medium">Off</span>
              <input type="radio" name="ephemeral-timer" value="0" ${e===0?`checked`:``} class="w-4 h-4 text-primary">
            </label>
            <label class="flex items-center justify-between p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-variant/30 transition-colors">
              <span class="text-sm font-medium">5 Minutes</span>
              <input type="radio" name="ephemeral-timer" value="300000" ${e===3e5?`checked`:``} class="w-4 h-4 text-primary">
            </label>
            <label class="flex items-center justify-between p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-variant/30 transition-colors">
              <span class="text-sm font-medium">1 Hour</span>
              <input type="radio" name="ephemeral-timer" value="3600000" ${e===36e5?`checked`:``} class="w-4 h-4 text-primary">
            </label>
            <label class="flex items-center justify-between p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-variant/30 transition-colors">
              <span class="text-sm font-medium">24 Hours</span>
              <input type="radio" name="ephemeral-timer" value="86400000" ${e===864e5?`checked`:``} class="w-4 h-4 text-primary">
            </label>
          </div>
          
          <button class="w-full mt-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition-all" onclick="window.saveDisappearingTimer()">Save</button>
        </div>
      </div>
    `;document.body.insertAdjacentHTML(`beforeend`,t)}window.saveDisappearingTimer=async function(){if(!window.App||!window.App.currentChat||!window.App.db)return;let e=document.querySelector(`input[name="ephemeral-timer"]:checked`);if(!e)return;let t=parseInt(e.value,10),n=window.App.currentChat.id;try{window.App.currentChat.type===`group`?await window.App.db.collection(`groups`).doc(n).update({ephemeralTimer:t}):await window.App.db.collection(`directChats`).doc(n).update({ephemeralTimer:t}),window.App.currentChat.ephemeralTimer=t,o(),window.showToast&&window.showToast(`Disappearing messages timer updated`,`success`),document.getElementById(`disappearing-modal`)?.remove(),window.App.messages&&window.App.messages[n]&&window.sendMessage}catch(e){window.__DEBUG__&&console.error(e),window.showToast&&window.showToast(`Failed to update timer`,`error`)}};function o(){if(!window.App||!window.App.currentChat)return;let e=window.App.currentChat,t=document.getElementById(`header-ephemeral-icon`);if(e.ephemeralTimer&&e.ephemeralTimer>0){if(!t){let e=document.getElementById(`chat-header-info`);if(e){let t=document.createElement(`span`);t.id=`header-ephemeral-icon`,t.className=`material-symbols-outlined text-[16px] text-primary ml-2`,t.textContent=`timer`,t.title=`Disappearing Messages On`,e.appendChild(t)}}}else t&&t.remove()}function s(){if(!window.App||!window.App.messages||!window.App.db)return;let e=Date.now();(Array.isArray(window.App?.chats)?window.App.chats:Object.values(window.App?.chats||{})).forEach(t=>{if(!t||!t.id)return;let n=t.ephemeralTimer||0,r=t.id;if(n&&n>0){let t=window.App.messages[r];(Array.isArray(t)?t:[]).forEach(t=>{var i=t.time||(t.timestamp&&t.timestamp.toMillis?t.timestamp.toMillis():typeof t.timestamp==`number`?t.timestamp:0);i&&e-i>n&&window.App.db.collection(`messages`).doc(r).collection(`items`).doc(t.id).delete().then(()=>{window.App.messages[r]&&(window.App.messages[r]=window.App.messages[r].filter(e=>e.id!==t.id))}).catch(e=>{e.code===7||e.message?.includes(`PERMISSION_DENIED`)?window.__DEBUG__&&console.warn(`[SelfDestruct] Delete blocked by rules, server will handle`):window.__DEBUG__&&console.error(`[SelfDestruct] Delete failed:`,e)})})}})}document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,r):r()})()})),y=v()}))()}))()}))()}))()}))()}))();export{y as default};