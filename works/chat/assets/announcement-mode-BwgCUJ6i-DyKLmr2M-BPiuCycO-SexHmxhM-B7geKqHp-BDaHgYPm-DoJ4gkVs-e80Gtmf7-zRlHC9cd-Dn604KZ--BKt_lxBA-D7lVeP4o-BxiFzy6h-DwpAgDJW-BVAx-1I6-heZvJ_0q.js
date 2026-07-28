import{n as e}from"./modulepreload-polyfill-C_LrRQgL.js";import{$ as t,A as n,C as r,D as i,F as a,H as o,M as s,O as c,St as l,T as u,V as d,X as f,Z as p,_ as m,_t as h,a as g,b as _,ct as v,et as y,f as b,ft as x,g as S,h as C,ht as w,i as T,j as E,k as D,lt as O,m as k,mt as A,n as j,nt as M,o as N,ot as P,pt as F,q as I,rt as L,t as R,tt as z,ut as B,v as V,x as H,yt as U,z as W}from"./feature-security-COzR4rmb.js";var G,K;e((()=>{U(),f(),l((()=>{M(),L(),P((()=>{o(),a(),y((()=>{s(),p(),I((()=>{h(),v(),x((()=>{w(),z(),O((()=>{r(),B(),W((()=>{F(),d(),g((()=>{N(),j(),A((()=>{V(),H(),u((()=>{S(),R(),t((()=>{b(),_(),m((()=>{T(),E(),C((()=>{c(),D(),i((()=>{n(),G=k((()=>{(function(){function e(){t(),n()}function t(){let e=()=>{let e=document.getElementById(`group-settings-btn`)||document.getElementById(`chat-settings-btn`)||Array.from(document.querySelectorAll(`[onclick*="openGroupSettings"], [onclick*="openChatSettings"]`))[0];if(!e||e.dataset.announceInjection||!window.App||!window.App.currentChat||window.App.currentChat.type!==`group`||window.App.currentChat.announcementOnly===void 0)return;let t=document.createElement(`div`);t.id=`announcement-mode-banner`,t.style.cssText=`display:none;`,document.body.appendChild(t),e.dataset.announceInjection=`1`};window.MutationBus&&window.MutationBus.onBodyChildList(`announce-toggle-scan`,e),setTimeout(e,2e3)}function n(){document.addEventListener(`keydown`,async e=>{if(e.key!==`Enter`||e.shiftKey||!window.App||!window.App.currentChat)return;let t=window.App.currentChat;if(!t.announcementOnly)return;let n=window.App.auth?.currentUser?.uid;if(!n)return;let r=t.id;window.ChatPermissions&&window.ChatPermissions.hasPermission(r,n,`send`)||(e.target.tagName===`TEXTAREA`||e.target.tagName===`SELECT`||e.target.tagName===`INPUT`||e.target.isContentEditable||e.target.closest(`#input-bar, .wa-textarea, .message-input`))&&(window.showToast&&window.showToast(`Only admins can post in this announcement channel`,`error`),e.preventDefault(),e.stopPropagation())},!0)}window.toggleAnnouncementMode=async function(){if(!window.App||!window.App.db||!window.App.currentChat)return;let e=window.App.currentChat;if(e.type!==`group`)return;let t=window.App.auth?.currentUser?.uid;if(window.ChatPermissions&&!window.ChatPermissions.hasPermission(e.id,t,`manage-settings`)){window.showToast&&window.showToast(`Only admins can change this setting`,`error`);return}let n=!e.announcementOnly;try{await window.App.db.collection(`chats`).doc(e.id).update({announcementOnly:n}),window.App.currentChat.announcementOnly=n,window.showToast&&window.showToast(n?`Announcement mode enabled â€” only admins can post`:`Announcement mode disabled â€” everyone can post`,`success`),r(n)}catch(e){window.__DEBUG__&&console.error(`Toggle announcement mode error:`,e),window.showToast&&window.showToast(`Failed to update setting`,`error`)}};function r(e){let t=document.getElementById(`messages-box`)||document.getElementById(`msg-container`);if(!t)return;let n=document.getElementById(`announcement-banner`);if(n&&n.remove(),!e)return;let r=document.createElement(`div`);r.id=`announcement-banner`,r.style.cssText=`
      background: var(--primary, #6366f1);
      color: white;
      padding: 8px 16px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: 12px;
      margin: 8px auto;
      max-width: 90%;
    `,r.innerHTML=`<span class="material-symbols-outlined text-[16px]">campaign</span> Announcement Mode â€” Only admins can post`,t.parentElement?.insertBefore(r,t)}window.openAnnouncementSettings=function(){if(!window.App||!window.App.currentChat)return;let e=window.App.currentChat.announcementOnly||!1,t=`
      <div id="announcement-settings-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;">
        <div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 m-4 relative animate-scale-up">
          <button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById('announcement-settings-modal').remove()">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
          <div class="flex flex-col items-center mb-5">
            <div class="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[24px]">campaign</span>
            </div>
            <h3 class="font-bold text-lg text-on-surface">Announcement Mode</h3>
            <p class="text-xs text-on-surface-variant text-center mt-1">Control who can post messages</p>
          </div>

          <div class="bg-surface-variant/30 rounded-xl p-4 mb-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-bold text-on-surface">Announcement Only</p>
                <p class="text-xs text-on-surface-variant mt-0.5">Only admins and moderators can send messages</p>
              </div>
              <button class="relative w-12 h-6 rounded-full transition-all ${e?`bg-primary`:`bg-surface-variant`}" onclick="window.toggleAnnouncementMode()" id="announce-toggle">
                <div class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${e?`left-[26px]`:`left-0.5`}" id="announce-toggle-dot"></div>
              </button>
            </div>
          </div>

          <div class="bg-surface-variant/30 rounded-xl p-3">
            <p class="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">How it works</p>
            <div class="space-y-1.5 text-xs text-on-surface-variant">
              <div class="flex items-start gap-2"><span class="material-symbols-outlined text-[14px] text-primary mt-0.5">admin_panel_settings</span> Admins and moderators can always post</div>
              <div class="flex items-start gap-2"><span class="material-symbols-outlined text-[14px] text-on-surface-variant mt-0.5">lock</span> Regular members can only read messages</div>
              <div class="flex items-start gap-2"><span class="material-symbols-outlined text-[14px] text-on-surface-variant mt-0.5">info</span> Great for company updates and team announcements</div>
            </div>
          </div>
        </div>
      </div>
    `;document.body.insertAdjacentHTML(`beforeend`,t)},document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,e):e()})()})),K=G()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))();export{K as default};