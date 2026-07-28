import{n as e}from"./modulepreload-polyfill-C_LrRQgL.js";import{A as t,B as n,D as r,F as i,L as a,M as o,N as s,O as c,P as l,Q as u,S as d,T as f,U as p,W as m,X as h,Y as g,_,_t as v,a as y,d as b,dt as x,g as S,h as C,i as w,j as T,k as E,m as D,mt as O,n as k,nt as A,o as j,p as M,q as N,s as P,st as F,t as I,tt as L,v as R,w as z,x as B,y as V}from"./feature-security-B6a_Aa3r.js";var H,U;e((()=>{O(),N(),v((()=>{u(),k(),A((()=>{n(),d(),h((()=>{i(),l(),p((()=>{x(),t(),F((()=>{z(),o(),a((()=>{f(),M(),y((()=>{m(),L(),P((()=>{V(),C(),j((()=>{_(),I(),g((()=>{b(),B(),R((()=>{w(),s(),S((()=>{c(),E(),r((()=>{T(),H=D((()=>{(function(){window.PinnedHeader={_container:null,async show(e){if(this.hide(),!e)return;let t=window.App?.db;if(t)try{let n=await t.collection(`pinnedMessages`).where(`chatId`,`==`,e).orderBy(`pinnedAt`,`desc`).limit(3).get();if(n.empty)return;let r=[];n.forEach(e=>r.push({id:e.id,...e.data()})),this._container=document.createElement(`div`),this._container.id=`pinned-header-bar`,this._container.style.cssText=`display:flex;align-items:center;gap:10px;padding:8px 16px;background:var(--surface-container,#fff);border-bottom:1px solid var(--outline-variant,#eee);cursor:pointer;transition:background 0.15s;flex-shrink:0;`;let i=r[0],a=i.senderName||i.senderId||`Unknown`,o=i.text||i.content||``,s=r.length;this._container.innerHTML=`
          <span class="material-symbols-outlined" style="font-size:18px;color:var(--primary,#00a884);">push_pin</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:600;color:var(--primary,#00a884);">${this._esc(a)}</div>
            <div style="font-size:13px;color:var(--on-surface,#000);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this._esc(o.slice(0,100))}</div>
          </div>
          ${s>1?`<span style="font-size:11px;color:var(--on-surface-variant,#666);white-space:nowrap;">${s} pinned</span>`:``}
          <button aria-label="Close pinned bar" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant,#666);padding:4px;">
            <span class="material-symbols-outlined" style="font-size:16px;">close</span>
          </button>
        `,this._container.addEventListener(`click`,t=>{if(t.target.closest(`button`)){this.hide();return}this._openPinnedPanel(e,r)}),this._container.addEventListener(`mouseenter`,()=>{this._container.style.background=`var(--surface-variant,#f0f2f5)`}),this._container.addEventListener(`mouseleave`,()=>{this._container.style.background=`var(--surface-container,#fff)`});let c=document.getElementById(`chat-header`)||document.querySelector(`.chat-header`);c&&c.parentElement.insertBefore(this._container,c.nextSibling)}catch(e){window.__DEBUG__&&console.warn(`[PinnedHeader] Error:`,e)}},hide(){this._container&&(this._container.remove(),this._container=null)},_openPinnedPanel(e,t){let n=document.createElement(`div`);n.id=`pinned-messages-panel`,n.style.cssText=`position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;`,n.innerHTML=`
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(420px,92vw);max-height:70vh;overflow:hidden;display:flex;flex-direction:column;">
          <div style="padding:16px 20px;border-bottom:1px solid var(--outline-variant,#eee);display:flex;align-items:center;gap:10px;">
            <span class="material-symbols-outlined" style="font-size:20px;color:var(--primary,#00a884);">push_pin</span>
            <h3 style="margin:0;flex:1;font-size:16px;font-weight:700;">Pinned Messages</h3>
            <button id="close-pinned-panel" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant,#666);font-size:18px;">âœ•</button>
          </div>
          <div style="overflow-y:auto;flex:1;padding:12px;">
            ${t.map(e=>`
              <div style="padding:12px;border-radius:12px;background:var(--surface-variant,#f8f9fa);margin-bottom:8px;cursor:pointer;" data-pin-msg-id="${e.messageId||e.id}">
                <div style="font-size:12px;font-weight:600;color:var(--primary,#00a884);margin-bottom:4px;">${this._esc(e.senderName||`Unknown`)}</div>
                <div style="font-size:14px;color:var(--on-surface,#000);">${this._esc((e.text||e.content||``).slice(0,200))}</div>
                <div style="font-size:11px;color:var(--on-surface-variant,#666);margin-top:4px;">${e.pinnedAt?(e.pinnedAt.toDate?e.pinnedAt.toDate():new Date(e.pinnedAt)).toLocaleString():``}</div>
              </div>
            `).join(``)}
          </div>
        </div>
      `,document.body.appendChild(n),n.querySelector(`#close-pinned-panel`).addEventListener(`click`,()=>n.remove()),n.addEventListener(`click`,e=>{e.target===n&&n.remove();let t=e.target.closest(`[data-pin-msg-id]`);if(t){let e=t.dataset.pinMsgId;e&&typeof window.scrollToMessage==`function`&&window.scrollToMessage(e),n.remove()}})},_esc(e){return e?String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`):``}}})()})),U=H()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))();export{U as default};