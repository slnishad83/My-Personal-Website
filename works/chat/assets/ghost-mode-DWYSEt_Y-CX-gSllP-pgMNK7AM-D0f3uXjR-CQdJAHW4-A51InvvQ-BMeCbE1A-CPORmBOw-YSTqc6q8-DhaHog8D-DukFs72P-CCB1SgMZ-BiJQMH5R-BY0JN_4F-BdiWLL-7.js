import{n as e}from"./modulepreload-polyfill-C_LrRQgL.js";import{A as t,B as n,D as r,F as i,L as a,M as o,N as s,O as c,P as l,Q as u,S as d,T as f,U as p,W as m,X as h,Y as g,_,_t as v,a as y,d as b,dt as x,g as S,h as C,i as w,j as T,k as E,m as D,mt as O,n as k,nt as A,o as j,p as M,q as N,s as P,st as F,t as I,tt as L,v as R,w as z,x as B,y as V}from"./feature-security-B6a_Aa3r.js";var H,U;e((()=>{O(),N(),v((()=>{u(),k(),A((()=>{n(),d(),h((()=>{i(),l(),p((()=>{x(),t(),F((()=>{z(),o(),a((()=>{f(),M(),y((()=>{m(),L(),P((()=>{V(),C(),j((()=>{_(),I(),g((()=>{b(),B(),R((()=>{w(),s(),S((()=>{c(),E(),r((()=>{T(),H=D((()=>{(function(){let e=`nsl_ghost_mode`,t=`nsl_ghost_contacts`;function n(){try{return JSON.parse(localStorage.getItem(e)||`{}`)}catch{return{}}}function r(t){localStorage.setItem(e,JSON.stringify(t)),i(t)}async function i(e){if(!(!App.db||!App.auth?.currentUser))try{await App.db.collection(`users`).doc(App.auth.currentUser.uid).update({ghostMode:e.enabled||!1,ghostContacts:e.specificContacts||[],ghostUpdatedAt:firebase.firestore.FieldValue.serverTimestamp()})}catch{}}function a(){try{return JSON.parse(localStorage.getItem(t)||`[]`)}catch{return[]}}function o(e){localStorage.setItem(t,JSON.stringify(e))}window.isGhostModeActive=function(){return!!n().enabled},window.isGhostForContact=function(e){let t=n();return t.enabled?!t.specificContacts||!t.specificContacts.length||t.specificContacts.includes(e):!1};let s=null;function c(){if(!(typeof Presence>`u`||!Presence.setOnline)&&(s||(s=Presence.setOnline.bind(Presence)),Presence.setOnline=function(){if(isGhostModeActive()){l();return}return s()},Presence._startHeartbeat)){let e=Presence._startHeartbeat.bind(Presence);Presence._startHeartbeat=function(){if(isGhostModeActive()){l();return}return e()}}}function l(){if(!(!App.db||!App.auth?.currentUser))try{let e=n().lastFrozenAt||Date.now();App.db.collection(`users`).doc(App.auth.currentUser.uid).update({onlineStatus:`offline`,lastSeen:e,lastHeartbeat:e}).catch(()=>{})}catch{}}function u(){s&&s()}let d=Presence?.setOffline;function f(){if(typeof Presence>`u`)return;let e=Presence.setOffline.bind(Presence);Presence.setOffline=function(){if(isGhostModeActive()){l();return}return e()}}window.toggleGhostMode=function(e){let t=n();t.enabled=!t.enabled,e===`specific`?t.specificContacts=t.specificContacts||[]:e||(t.specificContacts=[]),t.enabled?t.lastFrozenAt=Date.now():t.lastFrozenAt=null,r(t),t.enabled?(l(),showToast(`Ghost mode ON — you appear offline`,`success`)):(u(),showToast(`Ghost mode OFF — you appear online`,`info`)),typeof renderChatList==`function`&&renderChatList()},window.setGhostForContacts=function(e){let t=n();t.enabled=!0,t.specificContacts=e,r(t),l(),showToast(`Ghost mode set for `+e.length+` contact(s)`,`success`)},window.toggleGhostForContact=function(e){let t=a(),i=t.indexOf(e);if(i>=0?t.splice(i,1):t.push(e),t.length>0)setGhostForContacts(t);else{let e=n();e.enabled=!1,e.specificContacts=[],r(e),u(),showToast(`Ghost mode OFF`,`info`)}},window.openGhostModeSettings=function(){let e=n(),t=document.createElement(`div`);t.id=`ghost-mode-overlay`,t.style.cssText=`position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease`;let r=document.createElement(`div`);r.style.cssText=`background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:420px;width:92vw;max-height:80vh;overflow-y:auto;color:var(--on-surface)`;let i=a();r.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:18px;font-weight:700">👻 Ghost Mode</h3>
        <button onclick="document.getElementById('ghost-mode-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>
      <p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 16px">Appear offline to others while still being able to use the app.</p>

      <div style="padding:16px;border-radius:14px;background:var(--surface-container-low,rgba(0,0,0,0.04));margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:14px;font-weight:600">Enable Ghost Mode</div>
            <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px">Appear offline to everyone</div>
          </div>
          <label style="position:relative;width:48px;height:26px;cursor:pointer">
            <input type="checkbox" ${e.enabled&&!e.specificContacts?.length?`checked`:``} onchange="toggleGhostMode()" style="display:none">
            <div style="position:absolute;inset:0;border-radius:13px;background:${e.enabled&&!e.specificContacts?.length?`var(--primary)`:`var(--outline-variant,rgba(0,0,0,0.15))`};transition:background 0.2s">
              <div style="position:absolute;top:3px;left:${e.enabled&&!e.specificContacts?.length?`25px`:`3px`};width:20px;height:20px;border-radius:50%;background:white;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>
            </div>
          </label>
        </div>
      </div>

      <div style="padding:16px;border-radius:14px;background:var(--surface-container-low,rgba(0,0,0,0.04));margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:14px;font-weight:600">Specific Contacts</div>
            <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px">Appear offline only to selected contacts (${i.length} selected)</div>
          </div>
          <button onclick="_showGhostContactPicker()" style="padding:6px 12px;border-radius:8px;border:none;background:var(--primary);color:var(--on-primary);font-size:12px;font-weight:600;cursor:pointer">Choose</button>
        </div>
      </div>

      <div style="padding:16px;border-radius:14px;background:var(--surface-container-low,rgba(0,0,0,0.04))">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:14px;font-weight:600">Status Override</div>
            <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px">Show a fake "last seen" time</div>
          </div>
          <button onclick="showToast('Last seen will show as ' + new Date(Date.now() - 3600000).toLocaleTimeString(), 'info')" style="padding:6px 12px;border-radius:8px;border:none;background:var(--outline-variant,rgba(0,0,0,0.08));color:var(--on-surface);font-size:12px;font-weight:600;cursor:pointer">1 hr ago</button>
        </div>
      </div>`,t.appendChild(r),t.addEventListener(`click`,e=>{e.target===t&&t.remove()}),document.body.appendChild(t)},window._showGhostContactPicker=function(){let e=document.getElementById(`ghost-mode-overlay`);e&&(e.style.display=`none`);let t=document.createElement(`div`);t.id=`ghost-contact-picker`,t.style.cssText=`position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease`;let n=document.createElement(`div`);n.style.cssText=`background:var(--surface-container,#1e1e2e);border-radius:20px;padding:20px;max-width:400px;width:92vw;max-height:80vh;overflow-y:auto;color:var(--on-surface)`;let r=a(),i=App.contacts||[],o=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0;font-size:16px;font-weight:700">Select Contacts</h3>
        <button onclick="document.getElementById('ghost-contact-picker')?.remove();document.getElementById('ghost-mode-overlay')?.style.removeProperty('display')" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:18px">&times;</button>
      </div>`;i.forEach(e=>{let t=r.includes(e.uid),n=escHtml(e.uid||``);o+=`<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;margin-bottom:4px;background:${t?`rgba(124,77,255,0.15)`:`transparent`}" data-ghost-uid="${n}">
        <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0">
          ${e.photoURL?`<img src="${escHtml(e.photoURL)}" style="width:100%;height:100%;object-fit:cover" alt="">`:`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--outline-variant,rgba(0,0,0,0.1));font-size:14px;font-weight:700">${escHtml(e.initials||`?`)}</div>`}
        </div>
        <div style="flex:1"><div style="font-size:13px;font-weight:600">${escHtml(e.name)}</div><div style="font-size:11px;color:var(--on-surface-variant)">${escHtml(e.email||``)}</div></div>
        <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${t?`var(--primary)`:`var(--outline-variant,rgba(0,0,0,0.2))`};display:flex;align-items:center;justify-content:center;background:${t?`var(--primary)`:`transparent`}">
          ${t?`<span class="material-symbols-outlined" style="font-size:14px;color:white">check</span>`:``}
        </div>
      </div>`}),i.length||(o+=`<p style="text-align:center;color:var(--on-surface-variant);font-size:13px;padding:16px 0">No contacts found</p>`),n.innerHTML=o,t.appendChild(n),n.addEventListener(`click`,function(e){var t=e.target.closest(`[data-ghost-uid]`);t&&_toggleGhostContact(t.getAttribute(`data-ghost-uid`))}),t.addEventListener(`click`,n=>{n.target===t&&(t.remove(),e?.style.removeProperty(`display`))}),document.body.appendChild(t)},window._toggleGhostContact=function(e){let t=a(),n=t.indexOf(e);n>=0?t.splice(n,1):t.push(e),o(t),_showGhostContactPicker()},document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,()=>{c(),f()}):(c(),f());let p=window.showMsgContextMenu;typeof p==`function`&&(window.showMsgContextMenu=function(e,t){p(e,t)}),window._ghostModeCleanup=function(){s&&typeof Presence<`u`&&(Presence.setOnline=s),d&&typeof Presence<`u`&&(Presence.setOffline=d),p&&(window.showMsgContextMenu=p)}})()})),U=H()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))();export{U as default};