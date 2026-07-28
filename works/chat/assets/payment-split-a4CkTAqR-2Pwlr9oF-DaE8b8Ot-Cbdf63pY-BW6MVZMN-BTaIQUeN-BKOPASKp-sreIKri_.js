import{n as e}from"./modulepreload-polyfill-C_LrRQgL.js";import{A as t,C as n,D as r,E as i,I as a,M as o,N as s,S as c,T as l,_ as u,b as d,f,i as p,j as m,k as h,n as g,p as _,s as v,t as y,u as b}from"./feature-security-B7iC-g0p.js";var x,S;e((()=>{s(),n(),a((()=>{i(),c(),r((()=>{u(),y(),l((()=>{h(),v(),d((()=>{t(),_(),m((()=>{g(),f(),p((()=>{b(),x=o((()=>{(function(){window.PaymentSplit={async addExpense(e,t){let n=window.App?.uid?.()||window.currentUser?.uid,r=window.App?.db;if(!n||!r||!e)return;let i={chatId:e,description:t.description,amount:parseFloat(t.amount),currency:t.currency||`USD`,paidBy:n,paidByName:t.paidByName||window.currentUser?.displayName||`Unknown`,splitAmong:t.splitAmong||[],perPerson:t.amount/(t.splitAmong?.length||1),createdAt:Date.now(),settled:!1};try{return await r.collection(`groupExpenses`).add(i),typeof showToast==`function`&&showToast(`Expense added`,`success`),i}catch(e){window.__DEBUG__&&console.error(`[PaymentSplit] Error:`,e),typeof showToast==`function`&&showToast(`Failed to add expense`,`error`)}},async getExpenses(e){let t=window.App?.db;if(!t||!e)return[];try{let n=await t.collection(`groupExpenses`).where(`chatId`,`==`,e).orderBy(`createdAt`,`desc`).get(),r=[];return n.forEach(e=>r.push({id:e.id,...e.data()})),r}catch{return[]}},calculateSettlements(e){let t={};e.filter(e=>!e.settled).forEach(e=>{t[e.paidBy]||(t[e.paidBy]={name:e.paidByName,amount:0}),t[e.paidBy].amount+=e.amount,(e.splitAmong||[]).forEach(n=>{t[n]||(t[n]={name:n,amount:0}),t[n].amount-=e.perPerson})});let n=[],r=[];Object.entries(t).forEach(([e,t])=>{let i=Math.round(t.amount*100)/100;i<0?n.push({uid:e,name:t.name,amount:Math.abs(i)}):i>0&&r.push({uid:e,name:t.name,amount:i})});let i=[],a=0,o=0;for(;a<n.length&&o<r.length;){let e=Math.min(n[a].amount,r[o].amount);e>.01&&i.push({from:n[a],to:r[o],amount:Math.round(e*100)/100}),n[a].amount-=e,r[o].amount-=e,n[a].amount<.01&&a++,r[o].amount<.01&&o++}return i},async openExpensePanel(e){let t=await this.getExpenses(e),n=this.calculateSettlements(t),r=(window.App?.chats||[]).find(t=>t.id===e),i=r?.members||r?.memberIds||[],a=document.createElement(`div`);a.id=`expense-panel-modal`,a.style.cssText=`position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;`,a.innerHTML=`
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(420px,92vw);max-height:80vh;overflow:hidden;display:flex;flex-direction:column;">
          <div style="padding:16px 20px;border-bottom:1px solid var(--outline-variant,#eee);display:flex;align-items:center;gap:10px;">
            <span class="material-symbols-outlined" style="font-size:20px;color:var(--primary,#00a884);">receipt_long</span>
            <h3 style="margin:0;flex:1;font-size:16px;font-weight:700;">Expenses</h3>
            <button id="add-expense-btn" style="padding:6px 14px;border-radius:10px;border:none;background:var(--primary,#00a884);color:var(--on-primary,#fff);font-size:12px;font-weight:600;cursor:pointer;">+ Add</button>
            <button id="close-expense-panel" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant,#666);font-size:18px;">âœ•</button>
          </div>

          ${n.length>0?`
          <div style="padding:12px 20px;background:var(--surface-variant,#f8f9fa);border-bottom:1px solid var(--outline-variant,#eee);">
            <div style="font-size:12px;font-weight:600;color:var(--on-surface-variant,#666);margin-bottom:8px;">Settlements</div>
            ${n.map(e=>`
              <div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;">
                <span style="color:var(--on-surface,#000);font-weight:500;">${this._esc(e.from.name)}</span>
                <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary,#00a884);">arrow_forward</span>
                <span style="color:var(--on-surface,#000);font-weight:500;">${this._esc(e.to.name)}</span>
                <span style="margin-left:auto;font-weight:700;color:var(--primary,#00a884);">$${e.amount.toFixed(2)}</span>
              </div>
            `).join(``)}
          </div>
          `:``}

          <div style="overflow-y:auto;flex:1;padding:12px 20px;">
            ${t.length===0?`<div style="text-align:center;padding:32px;color:var(--on-surface-variant,#666);">No expenses yet. Tap "+ Add" to record one.</div>`:t.map(e=>`
                <div style="padding:12px;border-radius:12px;background:var(--surface-variant,#f8f9fa);margin-bottom:8px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:14px;font-weight:600;color:var(--on-surface,#000);">${this._esc(e.description)}</span>
                    <span style="font-size:14px;font-weight:700;color:var(--primary,#00a884);">$${e.amount.toFixed(2)}</span>
                  </div>
                  <div style="font-size:12px;color:var(--on-surface-variant,#666);margin-top:4px;">Paid by ${this._esc(e.paidByName)} â€¢ $${e.perPerson?.toFixed(2)} each</div>
                </div>
              `).join(``)}
          </div>
        </div>
      `,document.body.appendChild(a),a.querySelector(`#close-expense-panel`).addEventListener(`click`,()=>a.remove()),a.addEventListener(`click`,e=>{e.target===a&&a.remove()}),a.querySelector(`#add-expense-btn`).addEventListener(`click`,()=>{a.remove(),this._openAddExpense(e,i)})},_openAddExpense(e,t){window.App?.uid?.()||window.currentUser?.uid;let n=document.createElement(`div`);n.id=`add-expense-modal`,n.style.cssText=`position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;`,n.innerHTML=`
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(380px,92vw);padding:24px;">
          <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;">Add Expense</h3>
          <input type="text" id="expense-desc" placeholder="What was it for?" style="width:100%;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;margin-bottom:12px;background:var(--surface,#fff);color:var(--on-surface,#000);">
          <input type="number" id="expense-amount" placeholder="Amount ($)" step="0.01" min="0" style="width:100%;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;margin-bottom:12px;background:var(--surface,#fff);color:var(--on-surface,#000);">
          <div style="font-size:12px;font-weight:600;color:var(--on-surface-variant,#666);margin-bottom:8px;">Split among:</div>
          <div id="expense-members" style="max-height:150px;overflow-y:auto;margin-bottom:16px;">
            ${t.map(e=>`
              <label style="display:flex;align-items:center;gap:8px;padding:6px;cursor:pointer;">
                <input type="checkbox" value="${e}" class="expense-member-check" checked style="width:16px;height:16px;">
                <span style="font-size:13px;">${this._esc(e)}</span>
              </label>
            `).join(``)}
          </div>
          <div style="display:flex;gap:8px;">
            <button id="expense-cancel" style="flex:1;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;background:transparent;cursor:pointer;font-size:14px;">Cancel</button>
            <button id="expense-save" style="flex:1;padding:10px;border:none;border-radius:10px;background:var(--primary,#00a884);color:var(--on-primary,#fff);cursor:pointer;font-size:14px;font-weight:600;">Add</button>
          </div>
        </div>
      `,document.body.appendChild(n),n.querySelector(`#expense-cancel`).addEventListener(`click`,()=>n.remove()),n.addEventListener(`click`,e=>{e.target===n&&n.remove()}),n.querySelector(`#expense-save`).addEventListener(`click`,async()=>{let t=n.querySelector(`#expense-desc`).value.trim(),r=parseFloat(n.querySelector(`#expense-amount`).value),i=Array.from(n.querySelectorAll(`.expense-member-check:checked`)).map(e=>e.value);if(!t){typeof showToast==`function`&&showToast(`Enter description`,`error`);return}if(!r||r<=0){typeof showToast==`function`&&showToast(`Enter amount`,`error`);return}if(i.length===0){typeof showToast==`function`&&showToast(`Select members to split with`,`error`);return}await this.addExpense(e,{description:t,amount:r,paidByName:window.currentUser?.displayName||`You`,splitAmong:i}),n.remove(),this.openExpensePanel(e)})},_esc(e){return e?String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`):``}}})()})),S=x()}))()}))()}))()}))()}))()}))()}))();export{S as default};