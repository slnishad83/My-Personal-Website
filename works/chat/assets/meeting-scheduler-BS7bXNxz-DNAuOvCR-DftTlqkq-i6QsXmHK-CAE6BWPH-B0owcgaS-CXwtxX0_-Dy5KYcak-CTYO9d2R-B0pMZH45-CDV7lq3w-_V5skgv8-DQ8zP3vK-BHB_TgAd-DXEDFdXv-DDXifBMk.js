import{n as e}from"./modulepreload-polyfill-C_LrRQgL.js";import{$ as t,A as n,C as r,D as i,F as a,H as o,M as s,O as c,St as l,T as u,V as d,X as f,Z as p,_ as m,_t as h,a as g,b as _,ct as v,et as y,f as b,ft as x,g as S,h as C,ht as w,i as T,j as E,k as D,lt as O,m as k,mt as A,n as j,nt as M,o as N,ot as P,pt as F,q as I,rt as L,t as R,tt as z,ut as B,v as V,x as H,yt as U,z as W}from"./feature-security-COzR4rmb.js";var G,K;e((()=>{U(),f(),l((()=>{M(),L(),P((()=>{o(),a(),y((()=>{s(),p(),I((()=>{h(),v(),x((()=>{w(),z(),O((()=>{r(),B(),W((()=>{F(),d(),g((()=>{N(),j(),A((()=>{V(),H(),u((()=>{S(),R(),t((()=>{b(),_(),m((()=>{T(),E(),C((()=>{c(),D(),i((()=>{n(),G=k((()=>{(function(){function e(){window._openMeetingCreator=function(){!window.App||!window.App.currentChat||n()},t(),o()}function t(){let e=()=>{let e=document.getElementById(`attachment-menu`)||document.getElementById(`_att-menu`);if(!e||e.querySelector(`.meeting-attach-btn`))return;let t=document.createElement(`button`);t.className=`meeting-attach-btn flex flex-col items-center gap-2 p-4 bg-surface-container-highest rounded-2xl hover:bg-surface-variant transition-all`,t.onclick=()=>{window._removeAttMenu&&window._removeAttMenu(),window._openMeetingCreator()},t.innerHTML=`
        <div class="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <span class="material-symbols-outlined text-[22px] text-emerald-500">event</span>
        </div>
        <span class="text-[11px] font-bold text-on-surface-variant">Meeting</span>
      `,e.appendChild(t)};window.MutationBus&&window.MutationBus.onBodyChildList(`meeting-attach-scan`,e),setTimeout(e,1500)}function n(){let e=window.App.currentChat?.name||`Chat`,t=r(),n=new Date,i=n.toISOString().slice(0,10),a=new Date(n.getTime()+36e5).toTimeString().slice(0,5),o=`
      <div id="meeting-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;">
        <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 m-4 relative animate-scale-up max-h-[85vh] overflow-y-auto">
          <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('meeting-modal').remove()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div class="flex flex-col items-center mb-5">
            <div class="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[24px]">event</span>
            </div>
            <h3 class="font-bold text-lg text-on-surface">Schedule Meeting</h3>
            <p class="text-xs text-on-surface-variant text-center mt-1">For ${window.escHtml?window.escHtml(e):e}</p>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Meeting Title</label>
              <input type="text" id="meeting-title-input" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="e.g. Sprint Planning">
            </div>
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="block text-xs font-bold text-on-surface-variant mb-1">Date</label>
                <input type="date" id="meeting-date-input" min="${i}" value="${i}" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer">
              </div>
              <div class="flex-1">
                <label class="block text-xs font-bold text-on-surface-variant mb-1">Time</label>
                <input type="time" id="meeting-time-input" value="${a}" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer">
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Duration (minutes)</label>
              <div class="flex gap-2">
                ${[15,30,45,60,90].map(e=>`
                  <button class="meeting-dur-btn flex-1 py-2 rounded-xl text-xs font-bold border border-outline-variant/30 transition-all ${e===30?`bg-primary/10 border-primary text-primary`:`bg-surface-container-high text-on-surface-variant hover:bg-surface-variant`}" data-dur="${e}" onclick="window._selectMeetingDur(${e})">${e}m</button>
                `).join(``)}
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-on-surface-variant mb-1">Invite Participants</label>
              <div class="bg-surface-container-high border border-outline-variant/30 rounded-xl p-3 max-h-32 overflow-y-auto space-y-1">
                <label class="flex items-center gap-2 text-sm text-on-surface cursor-pointer hover:bg-surface-variant/50 p-1 rounded-lg">
                  <input type="checkbox" class="meeting-member-cb accent-primary" checked> All members
                </label>
                ${t}
              </div>
            </div>
          </div>

          <button class="w-full mt-5 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition-all" onclick="window._submitMeeting()">
            Schedule Meeting
          </button>
        </div>
      </div>
    `;document.body.insertAdjacentHTML(`beforeend`,o),window._selectedMeetingDur=30}window._selectMeetingDur=function(e){window._selectedMeetingDur=e,document.querySelectorAll(`.meeting-dur-btn`).forEach(t=>{t.className=`meeting-dur-btn flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${parseInt(t.dataset.dur)===e?`bg-primary/10 border-primary text-primary`:`bg-surface-container-high text-on-surface-variant hover:bg-surface-variant border-outline-variant/30`}`})};function r(){if(!window.App||!window.App.currentChat)return``;let e=window.App.currentChat,t=e.memberIds||e.members||[],n=window.App.contacts||[],r=window.App.auth?.currentUser?.uid;return t.filter(e=>e!==r).map(e=>{let t=n.find(t=>t.uid===e),r=t&&(t.name||t.displayName)||e.slice(0,8);return`<label class="flex items-center gap-2 text-sm text-on-surface cursor-pointer hover:bg-surface-variant/50 p-1 rounded-lg">
        <input type="checkbox" class="meeting-member-cb accent-primary" value="${e}"> ${window.escHtml?window.escHtml(r):r}
      </label>`}).join(``)}window._submitMeeting=async function(){if(!window.App||!window.App.db||!window.App.auth.currentUser)return;let e=window.App.auth.currentUser.uid,t=document.getElementById(`meeting-title-input`),n=document.getElementById(`meeting-date-input`),r=document.getElementById(`meeting-time-input`),a=t?.value.trim()||`Meeting`,o=n?.value,s=r?.value;if(!o||!s){window.showToast&&window.showToast(`Please select date and time`,`error`);return}let c=new Date(`${o}T${s}:00`),l=window._selectedMeetingDur||30,u=document.querySelectorAll(`.meeting-member-cb`),d=[];if(u[0]?.checked){let e=window.App.currentChat;d=e.memberIds||e.members||[]}else u.forEach(e=>{e.checked&&e.value&&d.push(e.value)});try{let t=await window.App.db.collection(`meetings`).add({title:a,date:firebase.firestore.Timestamp.fromDate(c),duration:l,chatId:window.App.currentChat.id,chatName:window.App.currentChat.name||``,participants:d,accepted:[e],declined:[],createdBy:e,createdByName:window.App.currentUser?.name||`User`,createdAt:firebase.firestore.FieldValue.serverTimestamp()});document.getElementById(`meeting-modal`)?.remove();let n=`ðŸ“… Meeting: ${a}\nðŸ“† ${c.toLocaleDateString(`en-US`,{weekday:`short`,month:`short`,day:`numeric`})} at ${c.toLocaleTimeString(`en-US`,{hour:`numeric`,minute:`2-digit`})} (${l}m)\n\nâœ… Accept | âŒ Decline`;window.App.sendMessage&&await window.App.sendMessage({text:n,type:`meeting`,meetingId:t.id}),window.showToast&&window.showToast(`Meeting scheduled!`,`success`),i(c,a,l)}catch(e){window.__DEBUG__&&console.error(`Error scheduling meeting:`,e),window.showToast&&window.showToast(`Failed to schedule meeting`,`error`)}};function i(e,t,n){let r=Date.now(),i=e.getTime(),o=i-900*1e3,s=i;o>r&&setTimeout(()=>{typeof showToast==`function`&&showToast(`â° Reminder: "${t}" starts in 15 minutes!`,`success`),a(t,`starts in 15 minutes`)},o-r),s>r&&setTimeout(()=>{typeof showToast==`function`&&showToast(`ðŸ“… Meeting "${t}" is starting now!`,`success`),a(t,`is starting now`)},s-r);let c=i+n*60*1e3;c>r&&setTimeout(()=>{typeof showToast==`function`&&showToast(`ðŸ• Meeting "${t}" should be ending now`,`info`)},c-r)}function a(e,t){try{`Notification`in window&&Notification.permission===`granted`&&new Notification(`NSL Chat â€” Meeting`,{body:`"${e}" ${t}`,icon:`/icon-192.png`,tag:`meeting-reminder`})}catch{}}function o(){if(!window.App||!window.App.db||!window.App.auth?.currentUser)return;let e=window.App.auth.currentUser.uid;window.App.db.collection(`meetings`).where(`participants`,`array-contains`,e).where(`date`,`>=`,firebase.firestore.Timestamp.fromDate(new Date)).limit(10).get().then(e=>{e.forEach(e=>{let t=e.data();t.date&&t.title&&i(t.date.toDate?t.date.toDate():new Date(t.date),t.title,t.duration||30)})}).catch(()=>{})}window._acceptMeeting=async function(e){if(!window.App||!window.App.db)return;let t=window.App.auth?.currentUser?.uid;if(t)try{await window.App.db.collection(`meetings`).doc(e).update({accepted:firebase.firestore.FieldValue.arrayUnion(t),declined:firebase.firestore.FieldValue.arrayRemove(t)}),window.showToast&&window.showToast(`Meeting accepted`,`success`)}catch(e){window.__DEBUG__&&console.error(`Accept meeting error:`,e)}},window._declineMeeting=async function(e){if(!window.App||!window.App.db)return;let t=window.App.auth?.currentUser?.uid;if(t)try{await window.App.db.collection(`meetings`).doc(e).update({declined:firebase.firestore.FieldValue.arrayUnion(t),accepted:firebase.firestore.FieldValue.arrayRemove(t)}),window.showToast&&window.showToast(`Meeting declined`,`success`)}catch(e){window.__DEBUG__&&console.error(`Decline meeting error:`,e)}},document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,e):e()})()})),K=G()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))();export{K as default};