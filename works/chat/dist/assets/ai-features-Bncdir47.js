import{n as e}from"./firebase-config-B1gHZycV.js";var t=e((()=>{(function(){let e=null,t=null,n=``,r={},i=null,a=null;function o(){let e=Object.keys(r);if(e.length<=200)return;let t=e.length-200;for(let n=0;n<t;n++)delete r[e[n]];try{localStorage.setItem(`ai_chat_tags`,JSON.stringify(r))}catch{}}function s(){a&&(a.disconnect(),a=null)}function c(){if(document.getElementById(`ai-features-css`))return;let e=document.createElement(`style`);e.id=`ai-features-css`,e.textContent=`
      /* â”€â”€ Tone Analyzer Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
      .tone-banner {
        display: none;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        border-top: 1px solid var(--outline-variant);
        background: var(--surface-container);
        animation: toneSlideIn 0.25s ease;
      }
      .tone-banner.visible { display: flex; }
      .tone-banner.safe { border-top-color: #00a884; }
      .tone-banner.warning { border-top-color: #f59e0b; background: #f59e0b10; }
      .tone-banner.danger { border-top-color: #ef4444; background: #ef444410; }
      .tone-banner-icon { font-size: 18px; flex-shrink: 0; }
      .tone-banner-text { flex: 1; color: var(--on-surface-variant); }
      .tone-banner-text strong { color: var(--on-surface); }
      .tone-banner-dismiss {
        background: none; border: none; cursor: pointer;
        color: var(--on-surface-variant); padding: 4px;
        border-radius: 50%; transition: all 0.2s;
      }
      .tone-banner-dismiss:hover { background: var(--surface-variant); }
      .tone-badge {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 8px; border-radius: 12px; font-size: 11px;
        font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
      }
      .tone-badge.friendly { background: #00a88420; color: #00a884; }
      .tone-badge.neutral { background: #8696a020; color: #8696a0; }
      .tone-badge.formal { background: #53bdeb20; color: #53bdeb; }
      .tone-badge.rude { background: #f59e0b20; color: #f59e0b; }
      .tone-badge.aggressive { background: #ef444420; color: #ef4444; }
      .tone-badge.passive-aggressive { background: #a855f720; color: #a855f7; }
      .tone-badge.sarcastic { background: #f9731620; color: #f97316; }

      @keyframes toneSlideIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* â”€â”€ Summary Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
      .ai-summary-panel {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: min(520px, 92vw); max-height: 80vh;
        background: var(--surface-container-low); border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4); z-index: 9999;
        display: none; flex-direction: column; overflow: hidden;
        border: 1px solid var(--outline-variant);
        animation: panelIn 0.25s ease;
      }
      .ai-summary-panel.visible { display: flex; }
      .ai-summary-panel-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 20px 24px; border-bottom: 1px solid var(--outline-variant);
      }
      .ai-summary-panel-header h3 {
        font-size: 17px; font-weight: 700; color: var(--on-surface);
        display: flex; align-items: center; gap: 8px;
      }
      .ai-summary-panel-header h3 .material-symbols-outlined {
        color: var(--primary); font-size: 22px;
      }
      .ai-summary-panel-close {
        background: none; border: none; cursor: pointer;
        color: var(--on-surface-variant); padding: 8px;
        border-radius: 50%; transition: all 0.2s;
      }
      .ai-summary-panel-close:hover { background: var(--surface-variant); }
      .ai-summary-panel-body {
        flex: 1; overflow-y: auto; padding: 20px 24px;
        font-size: 14px; line-height: 1.7; color: var(--on-surface);
      }
      .ai-summary-panel-body h1, .ai-summary-panel-body h2, .ai-summary-panel-body h3 {
        font-size: 16px; font-weight: 700; margin: 16px 0 8px; color: var(--on-surface);
      }
      .ai-summary-panel-body ul, .ai-summary-panel-body ol {
        padding-left: 20px; margin: 8px 0;
      }
      .ai-summary-panel-body li { margin: 4px 0; }
      .ai-summary-panel-body strong { color: var(--primary); }
      .ai-summary-panel-body p { margin: 8px 0; }
      .ai-summary-panel-footer {
        display: flex; gap: 8px; padding: 16px 24px;
        border-top: 1px solid var(--outline-variant);
      }
      .ai-panel-btn {
        padding: 8px 16px; border-radius: 12px; font-size: 13px;
        font-weight: 600; cursor: pointer; transition: all 0.2s;
        border: none; display: flex; align-items: center; gap: 6px;
      }
      .ai-panel-btn-primary { background: var(--primary); color: var(--on-primary); }
      .ai-panel-btn-primary:hover { filter: brightness(1.1); }
      .ai-panel-btn-secondary {
        background: var(--surface-variant); color: var(--on-surface-variant);
      }
      .ai-panel-btn-secondary:hover { background: var(--surface-container-highest); }
      .ai-panel-btn .material-symbols-outlined { font-size: 16px; }

      .ai-summary-loading {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 12px; padding: 40px; color: var(--on-surface-variant);
      }
      .ai-summary-loading .spinner {
        width: 32px; height: 32px; border: 3px solid var(--outline-variant);
        border-top-color: var(--primary); border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      @keyframes panelIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }

      .ai-summary-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        z-index: 9998; display: none; animation: fadeIn 0.2s;
      }
      .ai-summary-backdrop.visible { display: block; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

      /* â”€â”€ Chat Tags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
      .chat-tag {
        display: inline-flex; align-items: center; gap: 3px;
        padding: 2px 7px; border-radius: 8px; font-size: 10px;
        font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
        line-height: 1.3; margin-left: 4px;
      }
      .chat-tag.Work { background: #3b82f620; color: #3b82f6; }
      .chat-tag.Family { background: #ec489920; color: #ec4899; }
      .chat-tag.Friends { background: #8b5cf620; color: #8b5cf6; }
      .chat-tag.Urgent { background: #ef444420; color: #ef4444; }
      .chat-tag.Project { background: #06b6d420; color: #06b6d4; }
      .chat-tag.Support { background: #f9731620; color: #f97316; }
      .chat-tag.Sales { background: #10b98120; color: #10b981; }
      .chat-tag.Marketing { background: #a855f720; color: #a855f7; }
      .chat-tag.Finance { background: #eab30820; color: #eab308; }
      .chat-tag.HR { background: #0ea5e920; color: #0ea5e9; }
      .chat-tag.IT { background: #6366f120; color: #6366f1; }
      .chat-tag.General { background: #8696a020; color: #8696a0; }
      .chat-tag.Social { background: #14b8a620; color: #14b8a6; }
      .chat-tag.Updates { background: #78716c20; color: #78716c; }

      .chat-tag-row {
        display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px;
      }

      /* â”€â”€ AI Search Toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
      .ai-search-toggle {
        display: flex; align-items: center; gap: 6px;
        padding: 6px 12px; border-radius: 20px; font-size: 12px;
        font-weight: 600; cursor: pointer; transition: all 0.2s;
        border: 1px solid var(--outline-variant);
        background: var(--surface-variant); color: var(--on-surface-variant);
      }
      .ai-search-toggle.active {
        background: var(--primary); color: var(--on-primary);
        border-color: var(--primary);
      }
      .ai-search-toggle .material-symbols-outlined { font-size: 14px; }

      /* â”€â”€ Summary Button in Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
      .ai-header-btn {
        position: relative;
      }
      .ai-header-btn::after {
        content: 'AI';
        position: absolute; top: 2px; right: 2px;
        font-size: 8px; font-weight: 800;
        background: var(--primary); color: var(--on-primary);
        padding: 1px 3px; border-radius: 4px;
        line-height: 1; letter-spacing: 0.02em;
      }
    `,document.head.appendChild(e)}function l(e){return e?e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/^### (.+)$/gm,`<h3>$1</h3>`).replace(/^## (.+)$/gm,`<h2>$1</h2>`).replace(/^# (.+)$/gm,`<h1>$1</h1>`).replace(/\*\*(.+?)\*\*/g,`<strong>$1</strong>`).replace(/\*(.+?)\*/g,`<em>$1</em>`).replace(/^- (.+)$/gm,`<li>$1</li>`).replace(/(<li>.*<\/li>)/gs,`<ul>$1</ul>`).replace(/\n{2,}/g,`</p><p>`).replace(/\n/g,`<br>`).replace(/^(.+)$/gm,e=>e.startsWith(`<`)?e:`<p>${e}</p>`):``}function u(){let e=document.getElementById(`header-actions-container`);if(!e||document.getElementById(`ai-summarize-btn`))return;let t=document.createElement(`button`);t.id=`ai-summarize-btn`,t.className=`ai-header-btn text-on-surface-variant hover:text-primary transition-all p-2 rounded-full hover:bg-surface-container/50`,t.title=`AI: Summarize this chat`,t.setAttribute(`aria-label`,`Summarize chat with AI`),t.innerHTML=`<span class="material-symbols-outlined">auto_awesome</span>`,t.addEventListener(`click`,f),e.insertBefore(t,e.firstChild)}function d(){if(i)return i;let e=document.createElement(`div`);e.className=`ai-summary-backdrop`,e.id=`ai-summary-backdrop`,e.addEventListener(`click`,p);let t=document.createElement(`div`);return t.className=`ai-summary-panel`,t.id=`ai-summary-panel`,t.innerHTML=`
      <div class="ai-summary-panel-header">
        <h3><span class="material-symbols-outlined">auto_awesome</span> <span id="ai-summary-title">Chat Summary</span></h3>
        <button class="ai-summary-panel-close" onclick="window.AIFeatures.closeSummary()" aria-label="Close">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="ai-summary-panel-body" id="ai-summary-body">
        <div class="ai-summary-loading"><div class="spinner"></div><span>Analyzing messages...</span></div>
      </div>
      <div class="ai-summary-panel-footer">
        <button class="ai-panel-btn ai-panel-btn-secondary" onclick="window.AIFeatures.closeSummary()">
          <span class="material-symbols-outlined">close</span> Close
        </button>
        <button class="ai-panel-btn ai-panel-btn-primary" id="ai-summary-copy-btn" onclick="window.AIFeatures.copySummary()">
          <span class="material-symbols-outlined">content_copy</span> Copy
        </button>
      </div>
    `,document.body.appendChild(e),document.body.appendChild(t),i=t,t}async function f(){let e=window.currentChat?.id||window.App?.currentChatId;if(!e){typeof showToast==`function`&&showToast(`Open a chat first to summarize it.`,`info`);return}let t=!!(window.currentGroup||window.currentChatType===`group`);d();let n=document.getElementById(`ai-summary-title`),r=document.getElementById(`ai-summary-body`);n&&(n.textContent=t?`Meeting Notes`:`Chat Summary`),r&&(r.innerHTML=`<div class="ai-summary-loading"><div class="spinner"></div><span>Analyzing messages...</span></div>`),document.getElementById(`ai-summary-backdrop`)?.classList.add(`visible`),i?.classList.add(`visible`);try{let n=firebase.functions(),i=t?`generateMeetingNotes`:`catchMeUp`,a=await n.httpsCallable(i,{timeout:6e4})({chatId:e,messageCount:t?100:50}),o=t?a.data.notes||``:a.data.summary||``;r&&(o?r.innerHTML=l(o):r.innerHTML=`<p style="text-align:center;color:var(--on-surface-variant);padding:20px;">No summary available.</p>`)}catch(e){window.__DEBUG__&&console.error(`[AIFeatures] Summary error:`,e),r&&(r.textContent=e.message?.includes(`API key`)?`AI not configured. Admin: run <code>firebase functions:secrets:set GEMINI_API_KEY</code>`:`Failed to generate summary. Please try again.`)}}function p(){i?.classList.remove(`visible`),document.getElementById(`ai-summary-backdrop`)?.classList.remove(`visible`)}function m(){let e=document.getElementById(`ai-summary-body`);if(!e)return;let t=e.innerText||e.textContent;navigator.clipboard.writeText(t).then(()=>{typeof showToast==`function`&&showToast(`Summary copied to clipboard`,`success`)}).catch(()=>{})}function h(){let e=document.getElementById(`input-bar`);if(!e||document.getElementById(`tone-banner`))return;let t=document.createElement(`div`);t.className=`tone-banner`,t.id=`tone-banner`,t.innerHTML=`
      <span class="tone-banner-icon" id="tone-icon">&#9888;&#65039;</span>
      <span class="tone-banner-text" id="tone-text"></span>
      <span class="tone-badge" id="tone-badge"></span>
      <button class="tone-banner-dismiss" onclick="window.AIFeatures.dismissTone()" aria-label="Dismiss">
        <span class="material-symbols-outlined" style="font-size:16px">close</span>
      </button>
    `,e.parentNode.insertBefore(t,e)}function g(r){if(!r||r.length<10){v();return}r!==n&&(n=r,clearTimeout(t),t=setTimeout(async()=>{try{let t=await firebase.functions().httpsCallable(`analyzeTone`,{timeout:15e3})({text:r,chatType:window.currentChatType||`direct`});e=t.data,_(t.data)}catch(e){window.__DEBUG__&&console.warn(`[AIFeatures] Tone check failed:`,e.message)}},1500))}function _(e){let t=document.getElementById(`tone-banner`),n=document.getElementById(`tone-icon`),r=document.getElementById(`tone-text`),i=document.getElementById(`tone-badge`);if(!(!t||!e)){if(e.safe&&!e.warning){v();return}if(t.classList.remove(`safe`,`warning`,`danger`),t.classList.add(`visible`),e.warning){t.classList.add(e.safe?`warning`:`danger`),n.textContent=e.safe?`âš\xA0ï¸`:`ðŸš«`,r.textContent=``;let i=document.createElement(`strong`);i.textContent=`Tone advisory: `,r.appendChild(i),r.appendChild(document.createTextNode(e.warning))}else{t.classList.add(`safe`),n.textContent=`âœ…`,r.textContent=``;let i=document.createElement(`strong`);i.textContent=`Tone looks good â€” `,r.appendChild(i),r.appendChild(document.createTextNode(e.tone||`neutral`))}i&&e.tone&&(i.className=`tone-badge `+(e.tone||`neutral`),i.textContent=e.tone||`neutral`)}}function v(){let t=document.getElementById(`tone-banner`);t&&t.classList.remove(`visible`),e=null}function y(){v()}function b(t){return e&&!e.safe?new Promise(t=>{typeof showModal==`function`?showModal(`âš\xA0ï¸ Tone Warning`,`This message may come across as <strong>${e.tone}</strong>.${e.warning?`<br><br>`+e.warning:``}<br><br>Send anyway?`,[{text:`Edit`,class:`secondary`,action:()=>t(!1)},{text:`Send Anyway`,class:`primary`,action:()=>t(!0)}]):t(confirm(`This message may sound ${e.tone}. Send anyway?`))}):Promise.resolve(!0)}async function x(e,t){if(!e||r[e])return r[e];try{let n=await firebase.functions().httpsCallable(`autoTagChat`,{timeout:2e4})({chatId:e,chatName:t});if(n.data&&n.data.tags){r[e]=n.data,o();try{localStorage.setItem(`ai_chat_tags`,JSON.stringify(r))}catch{}return n.data}}catch(e){window.__DEBUG__&&console.warn(`[AIFeatures] Auto-tag failed:`,e.message)}return null}function S(e,t){let n=r[e];if(!n||!n.tags||!n.tags.length||!t)return;t.querySelectorAll(`.chat-tag-row`).forEach(e=>e.remove());let i=document.createElement(`div`);i.className=`chat-tag-row`,n.tags.slice(0,3).forEach(e=>{let t=document.createElement(`span`);t.className=`chat-tag ${e}`,t.textContent=e,i.appendChild(t)}),t.appendChild(i)}function C(){try{r=JSON.parse(localStorage.getItem(`ai_chat_tags`)||`{}`),o()}catch{}}function w(){document.querySelectorAll(`.chat-list-item[data-chat-id]`).forEach(e=>{let t=e.dataset.chatId;if(!t||r[t]){let n=e.querySelector(`.chat-name, .font-bold, h3`);n&&r[t]&&S(t,n.parentNode);return}let n=e.querySelector(`.chat-name, .font-bold, h3`),i=n?.textContent||``;i&&x(t,i).then(e=>{e&&e.tags&&S(t,n.parentNode)})})}let T=!1;function E(){let e=document.getElementById(`globalSearchInput`);if(!e||document.getElementById(`ai-search-toggle`))return;let t=e.parentNode;if(!t)return;let n=document.createElement(`button`);n.id=`ai-search-toggle`,n.className=`ai-search-toggle`,n.innerHTML=`<span class="material-symbols-outlined">auto_awesome</span> AI Rank`,n.title=`Enable AI-powered semantic ranking`,n.addEventListener(`click`,()=>{T=!T,n.classList.toggle(`active`,T),n.setAttribute(`aria-pressed`,T),typeof showToast==`function`&&showToast(T?`AI search ranking enabled`:`AI search ranking disabled`,`info`)}),t.style.position=`relative`,t.appendChild(n)}function D(){let t=window.sendMessage;t&&!t._aiHooked&&(window.sendMessage=async function(...r){let i=document.getElementById(`msg-input`)?.value?.trim();if(!(i&&e&&!e.safe&&!await b(i)))return v(),n=``,t.apply(this,r)},window.sendMessage._aiHooked=!0)}function O(){let e=document.getElementById(`msg-input`);!e||e._aiToneHooked||(e._aiToneHooked=!0,e.addEventListener(`input`,()=>{let t=e.value.trim();t.length>15?g(t):(v(),n=``)}))}function k(){let e=document.getElementById(`chat-list`);e&&(a&&a.disconnect(),a=new MutationObserver(()=>{clearTimeout(e._aiTagTimer),e._aiTagTimer=setTimeout(w,800)}),a.observe(e,{childList:!0,subtree:!0}))}function A(){c(),C(),u(),h(),D(),O(),setTimeout(()=>{E(),k(),w()},2e3),document.addEventListener(`nsl:app-ready`,()=>{setTimeout(()=>{u(),h(),D(),O()},500)})}window.AIFeatures={openSummary:f,closeSummary:p,copySummary:m,dismissTone:y,autoTagChat:x,getChatTags:e=>r[e],isAiSearchActive:()=>T,analyzeTone:g,cleanup:s},window.addEventListener(`beforeunload`,function(){s()}),document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,A):A()})()}));export default t();