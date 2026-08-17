import{n as e}from"./firebase-config-B1gHZycV.js";var t=e((()=>{(function(){var e=function(){return App&&App.uid?App.uid():window.currentUser?window.currentUser.uid:null},t=function(){return App&&App.db?App.db:typeof firebase<`u`?firebase.firestore():null};function n(e){if(typeof window.escHtml==`function`)return window.escHtml(e);var t=document.createElement(`div`);return t.textContent=e,t.innerHTML}function r(){var n=e();if(!n)return null;var r=t();return r?r.collection(`users`).doc(n):null}function i(e,t){App&&App.toast?App.toast(e,t):typeof showToast==`function`&&showToast(e,t)}async function a(){var e=r();if(e)try{await e.set({blockedUsers:window.blockedUsers||[]},{merge:!0})}catch(e){window.__DEBUG__&&console.error(`[Block] persist failed`,e)}}async function o(){var e=r();if(e)try{var t=await e.get();if(t.exists){var n=t.data();Array.isArray(n.blockedUsers)&&(window.blockedUsers=n.blockedUsers)}}catch(e){window.__DEBUG__&&console.error(`[Block] load failed`,e)}}function s(){Array.isArray(window.blockedUsers)||(window.blockedUsers=[])}function c(){if(!document.getElementById(`block-user-styles`)){var e=document.createElement(`style`);e.id=`block-user-styles`,e.textContent=`
.block-dialog-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.2s ease;}
.block-dialog-overlay.open{opacity:1;pointer-events:auto;}
.block-dialog{background:var(--surface-container,#1f2c34);border-radius:16px;padding:24px;max-width:340px;width:90%;text-align:center;transform:scale(0.9);transition:transform 0.2s ease;box-shadow:0 8px 24px rgba(0,0,0,0.4);}
.block-dialog-overlay.open .block-dialog{transform:scale(1);}
.block-dialog-avatar{width:64px;height:64px;border-radius:50%;object-fit:cover;margin:0 auto 16px;display:block;background:var(--surface-container-highest,#2a3942);}
.block-dialog-name{font-size:18px;font-weight:600;color:var(--on-surface,#e9edef);margin-bottom:8px;}
.block-dialog-msg{font-size:14px;color:var(--on-surface-variant,#8696a0);margin-bottom:20px;line-height:1.4;}
.block-dialog-btns{display:flex;gap:12px;justify-content:center;}
.block-dialog-btn{min-width:100px;padding:10px 16px;border-radius:8px;border:none;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.15s;min-height:48px;}
.block-dialog-btn.cancel{background:var(--surface-container-high,#2a3942);color:var(--on-surface,#e9edef);}
.block-dialog-btn.cancel:hover{background:var(--surface-container-highest,#374045);}
.block-dialog-btn.confirm-block{background:#e74c3c;color:white;}
.block-dialog-btn.confirm-block:hover{background:#c0392b;}
.block-dialog-btn.confirm-unblock{background:var(--primary,#00a884);color:white;}
.block-dialog-btn.confirm-unblock:hover{background:#008f73;}
.blocked-users-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.2s;}
.blocked-users-overlay.open{opacity:1;pointer-events:auto;}
.blocked-users-panel{background:var(--surface-container,#1f2c34);border-radius:16px;width:90%;max-width:420px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;transform:scale(0.9);transition:transform 0.2s;}
.blocked-users-overlay.open .blocked-users-panel{transform:scale(1);}
.blocked-users-header{display:flex;align-items:center;padding:16px;border-bottom:1px solid var(--outline-variant,#313d45);}
.blocked-users-title{font-size:18px;font-weight:600;color:var(--on-surface,#e9edef);flex:1;}
.blocked-users-close{background:none;border:none;color:var(--on-surface-variant,#8696a0);font-size:22px;cursor:pointer;padding:4px 8px;border-radius:50%;min-width:48px;min-height:48px;display:flex;align-items:center;justify-content:center;}
.blocked-users-body{flex:1;overflow-y:auto;padding:8px 0;}
.blocked-user-item{display:flex;align-items:center;padding:10px 16px;gap:12px;min-height:56px;}
.blocked-user-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;background:var(--surface-container-highest,#2a3942);flex-shrink:0;}
.blocked-user-info{flex:1;min-width:0;}
.blocked-user-name{font-size:15px;font-weight:500;color:var(--on-surface,#e9edef);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.blocked-user-sub{font-size:12px;color:var(--on-surface-variant,#8696a0);}
.blocked-user-unblock{background:none;border:1px solid var(--outline-variant,#313d45);color:var(--on-surface-variant,#8696a0);padding:6px 14px;border-radius:8px;font-size:12px;cursor:pointer;font-weight:500;min-height:40px;white-space:nowrap;}
.blocked-user-unblock:hover{border-color:var(--primary,#00a884);color:var(--primary,#00a884);}
.blocked-users-empty{text-align:center;padding:40px 20px;color:var(--on-surface-variant,#8696a0);}
.blocked-indicator{display:flex;align-items:center;gap:6px;padding:4px 8px;background:rgba(231,76,60,0.15);border-radius:6px;font-size:12px;color:#e74c3c;margin-top:2px;}
`,document.head.appendChild(e)}}function l(e){if(typeof allUsers<`u`&&Array.isArray(allUsers)){for(var t=0;t<allUsers.length;t++)if(allUsers[t].uid===e)return allUsers[t]}return null}function u(e,t,r,i,a,o,s){var c=document.createElement(`div`);c.className=`block-dialog-overlay`;var l=o||``;c.innerHTML=`
<div class="block-dialog" role="alertdialog">
`+(l?`<img class="block-dialog-avatar" src="`+n(l)+`" alt="" onerror="this.style.display='none'">`:`<div class="block-dialog-avatar" style="display:flex;align-items:center;justify-content:center;font-size:28px;">👤</div>`)+`<div class="block-dialog-name">`+n(a||`Unknown`)+`</div>
<div class="block-dialog-msg">`+t+`</div>
<div class="block-dialog-btns">
  <button class="block-dialog-btn cancel">Cancel</button>
  <button class="block-dialog-btn `+i+`">`+n(r)+`</button>
</div>
</div>`,document.body.appendChild(c),requestAnimationFrame(function(){c.classList.add(`open`)}),c.querySelector(`.cancel`).addEventListener(`click`,function(){c.classList.remove(`open`),setTimeout(function(){c.remove()},200)}),c.addEventListener(`click`,function(e){e.target===c&&(c.classList.remove(`open`),setTimeout(function(){c.remove()},200))}),c.querySelector(`.`+i).addEventListener(`click`,function(){c.classList.remove(`open`),setTimeout(function(){c.remove()},200),s()})}window.blockUser=function(e,t){e&&(s(),window.blockedUsers.indexOf(e)===-1&&(window.blockedUsers.push(e),a(),i(n(t||`User`)+` blocked`),d(),f()))},window.unblockUser=function(e,t){if(e){s();var r=window.blockedUsers.indexOf(e);r!==-1&&(window.blockedUsers.splice(r,1),a(),i(n(t||`User`)+` unblocked`),d(),f())}},window.isUserBlocked=function(e){return s(),window.blockedUsers.indexOf(e)!==-1},window.openBlockDialog=function(e,t,n){u(`Block `+(t||`User`),`Blocked users will no longer be able to call you or send you messages. They won't be able to see your last seen or online status.`,`Block`,`confirm-block`,t,n,function(){window.blockUser(e,t)})},window.openUnblockDialog=function(e,t,r){u(`Unblock `+(t||`User`),`Once unblocked, `+n(t||`this user`)+` will be able to call you and send you messages again.`,`Unblock`,`confirm-unblock`,t,r,function(){window.unblockUser(e,t)})},window.showBlockedUsersList=function(){s();var e=document.createElement(`div`);e.className=`blocked-users-overlay`;var t=document.createElement(`div`);t.className=`blocked-users-panel`,t.innerHTML=`
<div class="blocked-users-header">
  <span class="blocked-users-title">Blocked Users</span>
  <button class="blocked-users-close" aria-label="Close">&times;</button>
</div>
<div class="blocked-users-body"></div>`,e.appendChild(t),document.body.appendChild(e);var r=t.querySelector(`.blocked-users-body`),i=window.blockedUsers||[];if(i.length===0)r.innerHTML=`<div class="blocked-users-empty">No blocked users</div>`;else for(var a=0;a<i.length;a++){var o=l(i[a]),c=o?o.displayName||o.email||`Unknown`:i[a],u=o&&o.photoURL||``,d=document.createElement(`div`);d.className=`blocked-user-item`,d.innerHTML=`
`+(u?`<img class="blocked-user-avatar" src="`+n(u)+`" alt="" onerror="this.style.display='none'">`:`<div class="blocked-user-avatar" style="display:flex;align-items:center;justify-content:center;font-size:18px;">👤</div>`)+`<div class="blocked-user-info">
  <div class="blocked-user-name">`+n(c)+`</div>
  <div class="blocked-user-sub">Blocked</div>
</div>
<button class="blocked-user-unblock">Unblock</button>`,(function(t,n){d.querySelector(`.blocked-user-unblock`).addEventListener(`click`,function(){window.unblockUser(t,n),e.classList.remove(`open`),setTimeout(function(){e.remove()},200),setTimeout(function(){window.showBlockedUsersList()},300)})})(i[a],c),r.appendChild(d)}requestAnimationFrame(function(){e.classList.add(`open`)}),t.querySelector(`.blocked-users-close`).addEventListener(`click`,function(){e.classList.remove(`open`),setTimeout(function(){e.remove()},200)}),e.addEventListener(`click`,function(t){t.target===e&&(e.classList.remove(`open`),setTimeout(function(){e.remove()},200))})};function d(){var e=document.getElementById(`chat-header-name`)||document.getElementById(`chat-user-name`);if(e){var t=e.parentElement.querySelector(`.blocked-indicator`);if(t&&t.remove(),typeof currentChat<`u`&&currentChat&&currentChat.id&&window.isUserBlocked(currentChat.id)){var n=document.createElement(`div`);n.className=`blocked-indicator`,n.textContent=`🚫 Blocked`,e.parentElement.appendChild(n)}}}function f(){s();for(var e=document.querySelectorAll(`.chat-list-item[data-chat-id]`),t=0;t<e.length;t++){var n=e[t].dataset.chatId;window.isUserBlocked(n)&&(e[t].style.display=`none`)}}function p(){c(),o().then(function(){f(),d()})}document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,p):p()})()}));export default t();