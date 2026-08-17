import{n as e}from"./firebase-config-B1gHZycV.js";var t=e((()=>{(function(){let e=[],t=null;function n(){let e=document.createElement(`style`);e.textContent=`
      .saved-msg-item {
        padding: 12px 16px;
        border-bottom: 1px solid var(--outline-variant);
        cursor: pointer;
        transition: background 0.2s;
      }
      .saved-msg-item:hover {
        background: var(--surface-variant);
      }
      .saved-msg-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      .saved-msg-title {
        font-weight: 700;
        font-size: 13px;
        color: var(--on-surface);
      }
      .saved-msg-time {
        font-size: 11px;
        color: var(--on-surface-variant);
      }
      .saved-msg-body {
        font-size: 13px;
        color: var(--on-surface-variant);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .saved-msg-empty {
        padding: 40px 20px;
        text-align: center;
        color: var(--on-surface-variant);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
    `,document.head.appendChild(e),window.MutationBus&&window.MutationBus.onBodyChildList(`inject-save-btn`,()=>{let e=document.getElementById(`_msg-ctx-menu`);if(e&&!e.querySelector(`.save-msg-injected`)){let t=Array.from(e.querySelectorAll(`button`)).find(e=>e.innerHTML.includes(`Reply`));if(t){let n=t.getAttribute(`onclick`)?.match(/replyToMsg\('([^']+)'\)/);if(n&&n[1]){let t=n[1];r(e,t)}}}});let t=window.switchTab;t&&(window.switchTab=function(e){t(e),e===`more`&&o()})}function r(e,t){document.documentElement.classList.contains(`dark`)||document.body.classList.contains(`dark`)||document.documentElement.getAttribute(`data-theme`);let n=document.createElement(`button`);n.className=`save-msg-injected`,n.style.cssText=`
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:inherit; transition:background 0.15s;
    `,n.innerHTML=`<span style="font-size:16px">🔖</span> Save Message`,n.onmouseenter=()=>n.style.background=`var(--surface-container-highest)`,n.onmouseleave=()=>n.style.background=`transparent`,n.onclick=()=>{window._removeCtxMenu&&window._removeCtxMenu(),i(t)};let r=Array.from(e.querySelectorAll(`button`)).find(e=>e.innerHTML.includes(`Delete`));r?e.insertBefore(n,r):e.appendChild(n)}async function i(e){if(!window.App||!window.App.db||!window.App.auth.currentUser)return;let t=window.App.auth.currentUser.uid,n=window.App.currentChat?.id;if(!n)return;let r=(window.App.messages[n]||[]).find(t=>t.id===e);if(r)try{await window.App.db.collection(`users`).doc(t).collection(`savedMessages`).doc(e).set({...r,savedAt:Date.now(),originalChatId:n,originalChatName:window.App.currentChat.name}),window.showToast&&window.showToast(`Message saved to Bookmarks`,`success`)}catch(e){window.__DEBUG__&&console.error(`Error saving message:`,e),window.showToast&&window.showToast(`Failed to save message`,`error`)}}function a(){if(t&&(t(),t=null),!window.App||!window.App.db||!window.App.auth.currentUser)return;let n=window.App.auth.currentUser.uid;t=window.App.db.collection(`users`).doc(n).collection(`savedMessages`).orderBy(`savedAt`,`desc`).onSnapshot(t=>{e=t.docs.map(e=>e.data()),window.App.activeTab===`more`&&o()})}function o(){let t=document.getElementById(`chat-list`);if(!t)return;if(document.getElementById(`chats-sidebar-title`).textContent=`Saved Messages`,e.length===0){t.innerHTML=`
        <div class="saved-msg-empty">
          <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.5;">bookmark_border</span>
          <div>
            <h3 class="font-bold mb-1">No Saved Messages</h3>
            <p class="text-xs">Save messages to read them later</p>
          </div>
        </div>
      `;return}let n=``;e.forEach(e=>{let t=new Date(e.savedAt),r=t.toLocaleDateString()+` `+t.toLocaleTimeString([],{hour:`2-digit`,minute:`2-digit`}),i=e.text||``;(e.type===`image`||e.attachment?.type===`image`)&&(i=`📷 Image `+i),(e.type===`video`||e.attachment?.type===`video`)&&(i=`🎥 Video `+i),(e.type===`voice`||e.attachment?.type===`voice`)&&(i=`🎤 Voice message`),n+=`
        <div class="saved-msg-item" onclick="openSavedMessage('${e.originalChatId}', '${e.id}')">
          <div class="saved-msg-header">
            <span class="saved-msg-title">${window.escHtml?window.escHtml(e.originalChatName):e.originalChatName}</span>
            <span class="saved-msg-time">${r}</span>
          </div>
          <div class="saved-msg-body">${window.escHtml?window.escHtml(i):i}</div>
        </div>
      `}),t.innerHTML=n}window.openSavedMessage=function(e,t){window.selectChat&&(window.selectChat(e),setTimeout(()=>{window.scrollToMsg&&window.scrollToMsg(t)},500))},document.readyState===`loading`?(document.addEventListener(`DOMContentLoaded`,n),document.addEventListener(`nsl:app-ready`,a)):(n(),a())})()}));export default t();