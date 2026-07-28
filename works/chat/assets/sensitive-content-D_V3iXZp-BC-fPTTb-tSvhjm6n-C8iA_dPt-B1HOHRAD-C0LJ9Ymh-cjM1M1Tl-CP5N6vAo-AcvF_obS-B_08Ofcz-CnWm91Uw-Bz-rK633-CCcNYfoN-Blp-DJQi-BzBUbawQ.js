import{n as e}from"./modulepreload-polyfill-C_LrRQgL.js";import{A as t,B as n,D as r,F as i,L as a,M as o,N as s,O as c,P as l,Q as u,S as d,T as f,U as p,W as m,X as h,Y as g,_,_t as v,a as y,d as b,dt as x,g as S,h as C,i as w,j as T,k as E,m as D,mt as O,n as k,nt as A,o as j,p as M,q as N,s as P,st as F,t as I,tt as L,v as R,w as z,x as B,y as V}from"./feature-security-B6a_Aa3r.js";var H,U;e((()=>{O(),N(),v((()=>{u(),k(),A((()=>{n(),d(),h((()=>{i(),l(),p((()=>{x(),t(),F((()=>{z(),o(),a((()=>{f(),M(),y((()=>{m(),L(),P((()=>{V(),C(),j((()=>{_(),I(),g((()=>{b(),B(),R((()=>{w(),s(),S((()=>{c(),E(),r((()=>{T(),H=D((()=>{(function(){let e=`nsl_sensitive_seen`,t=`sensitive-blur-active`;function n(){try{return JSON.parse(localStorage.getItem(e)||`[]`)}catch{return[]}}function r(t){let r=n();r.includes(t)||(r.push(t),r.length>200&&r.splice(0,r.length-200),localStorage.setItem(e,JSON.stringify(r)))}window.isImageSensitive=function(e){return e?!!(e.sensitiveContent||e.flagged||e.nsfw||e.attachment?.sensitive||e.attachment?.flagged):!1},window.markContentSensitive=function(e){if(!(!App.db||!App.currentChat)&&typeof firebase<`u`&&firebase.functions)try{firebase.functions().httpsCallable(`flagSensitiveContent`)({messageId:e,chatId:App.currentChat.id}).then(()=>{showToast(`Content marked as sensitive`,`info`)}).catch(()=>showToast(`Failed to flag content`,`error`))}catch{showToast(`Failed to flag content`,`error`)}},window.unmarkContentSensitive=function(e){if(App.db&&typeof firebase<`u`&&firebase.functions)try{firebase.functions().httpsCallable(`unflagSensitiveContent`)({messageId:e}).then(()=>{showToast(`Content unmarked`,`info`)}).catch(()=>showToast(`Failed to unmark content`,`error`))}catch{showToast(`Failed to unmark content`,`error`)}},window.revealSensitiveImage=function(e,n){r(e),n&&(n.classList.remove(t),n.style.filter=`none`,n.style.transition=`filter 0.3s ease`)},window.hideSensitiveImage=function(e,n){n&&(n.classList.add(t),n.style.filter=`blur(25px)`)};let i=document.createElement(`style`);i.textContent=`
    .${t} {
      filter: blur(25px) !important;
      transition: filter 0.3s ease !important;
    }
    .sensitive-overlay {
      position: absolute !important;
      inset: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(0,0,0,0.6) !important;
      border-radius: inherit !important;
      cursor: pointer !important;
      z-index: 5 !important;
    }
    .sensitive-overlay:hover {
      background: rgba(0,0,0,0.5) !important;
    }
    .sensitive-badge {
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      padding: 4px 10px !important;
      border-radius: 8px !important;
      background: rgba(239,68,68,0.2) !important;
      color: #ef4444 !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      margin-top: 6px !important;
    }
  `,document.head.appendChild(i),document.addEventListener(`click`,function(e){var t=e.target.closest(`.sensitive-overlay[data-sensitive-msg-id]`);if(t){e.stopPropagation();var n=t.getAttribute(`data-sensitive-msg-id`),r=t.parentElement,i=r?r.querySelector(`img`):null;revealSensitiveImage(n,i||t.previousElementSibling),t.remove()}},!0);let a=window.renderSingleMessageHTML;typeof a==`function`&&(window.renderSingleMessageHTML=function(e,t,r,i){let o=a(e,t,r,i);if(e.type!==`image`||!isImageSensitive(e)||n().includes(e.id))return o;let s=`
        <div class="sensitive-overlay" data-sensitive-msg-id="${String(e.id||``).replace(/[^a-zA-Z0-9_-]/g,``)}">
          <span class="material-symbols-outlined" style="font-size:32px;color:white;opacity:0.8">visibility_off</span>
          <div class="sensitive-badge">
            <span class="material-symbols-outlined" style="font-size:12px">warning</span>
            Sensitive Content
          </div>
          <span style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px">Tap to reveal</span>
        </div>`;return o.replace(/(<div class="bubble-media[^"]*"[^>]*>)/,`$1${s}`).replace(/(<img[^>]*alt="Image"[^>]*>)/,`$1<style>.bubble-media:has(> img[alt="Image"]) { filter: blur(25px); transition: filter 0.3s ease; }</style>`)}),window._addSensitiveContentOptions=function(e,t){if(!App.auth?.currentUser)return;let n=App.currentChat?.id;if(!n)return;let r=(App.messages[n]||[]).find(e=>e.id===t);if(!r||r.type!==`image`&&r.type!==`video`||r.from!==App.auth.currentUser.uid)return;let i=isImageSensitive(r),a=document.createElement(`button`);a.style.cssText=`display:flex;align-items:center;gap:8px;padding:12px 16px;border:none;background:transparent;color:var(--on-surface);font-size:14px;font-weight:600;cursor:pointer;width:100%;text-align:left;border-radius:0`,a.innerHTML=`<span class="material-symbols-outlined" style="font-size:20px">${i?`visibility`:`visibility_off`}</span>${i?`Unmark as Sensitive`:`Mark as Sensitive`}`,a.onclick=()=>{i?unmarkContentSensitive(t):markContentSensitive(t),typeof _removeCtxMenu==`function`?_removeCtxMenu():typeof window._removeCtxMenu==`function`&&window._removeCtxMenu()};let o=e.querySelector(`[onclick*="_removeCtxMenu"]`);o?e.insertBefore(a,o):e.appendChild(a)}})()})),U=H()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))();export{U as default};