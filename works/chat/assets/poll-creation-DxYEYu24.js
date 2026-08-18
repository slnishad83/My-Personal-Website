import{n as e}from"./firebase-config-B1gHZycV.js";var t=e((()=>{(function(){function e(){if(typeof window.sendPollMessage!=`function`){typeof showToast==`function`&&showToast(`Poll feature not available`,`error`);return}let e=document.createElement(`div`);e.style.cssText=`position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;`,e.innerHTML=`
      <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(420px,92vw);max-height:85vh;overflow:hidden;display:flex;flex-direction:column;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--outline-variant,#eee);display:flex;align-items:center;gap:10px;">
          <span class="material-symbols-outlined" style="font-size:20px;color:var(--primary,#00a884);">poll</span>
          <h3 style="margin:0;flex:1;font-size:16px;font-weight:700;">Create Poll</h3>
          <button id="close-poll-creator" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant,#666);font-size:18px;">✕</button>
        </div>

        <div style="padding:16px 20px;overflow-y:auto;flex:1;">
          <div style="margin-bottom:16px;">
            <label style="font-size:13px;font-weight:600;color:var(--on-surface-variant,#666);display:block;margin-bottom:6px;">Question</label>
            <input type="text" id="poll-question" placeholder="Ask a question..." maxlength="200" style="width:100%;padding:10px 12px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;background:var(--surface,#fff);color:var(--on-surface,#000);box-sizing:border-box;">
            <div id="poll-question-count" style="text-align:right;font-size:11px;color:var(--on-surface-variant,#999);margin-top:4px;">0/200</div>
          </div>

          <div style="margin-bottom:16px;">
            <label style="font-size:13px;font-weight:600;color:var(--on-surface-variant,#666);display:block;margin-bottom:6px;">Options</label>
            <div id="poll-options-list" style="display:flex;flex-direction:column;gap:8px;">
              <div class="poll-option-row" style="display:flex;gap:8px;align-items:center;">
                <input type="text" class="poll-option-input" placeholder="Option 1" maxlength="100" style="flex:1;padding:10px 12px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;background:var(--surface,#fff);color:var(--on-surface,#000);">
              </div>
              <div class="poll-option-row" style="display:flex;gap:8px;align-items:center;">
                <input type="text" class="poll-option-input" placeholder="Option 2" maxlength="100" style="flex:1;padding:10px 12px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;background:var(--surface,#fff);color:var(--on-surface,#000);">
              </div>
            </div>
            <button id="add-poll-option" style="margin-top:8px;padding:8px 0;border:none;background:none;color:var(--primary,#00a884);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;">
              <span class="material-symbols-outlined" style="font-size:16px;">add</span> Add option
            </button>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:10px;background:var(--surface-variant,#f8f9fa);">
            <div>
              <div style="font-size:14px;font-weight:500;color:var(--on-surface,#000);">Allow multiple answers</div>
              <div style="font-size:12px;color:var(--on-surface-variant,#666);">Voters can select more than one option</div>
            </div>
            <label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;">
              <input type="checkbox" id="poll-multi" style="opacity:0;width:0;height:0;">
              <span id="poll-multi-slider" style="position:absolute;inset:0;background:var(--outline,#ccc);border-radius:12px;transition:0.3s;"></span>
            </label>
          </div>
        </div>

        <div style="padding:12px 20px;border-top:1px solid var(--outline-variant,#eee);">
          <button id="create-poll-btn" disabled style="width:100%;padding:12px;border:none;border-radius:10px;background:var(--primary,#00a884);opacity:0.5;color:var(--on-primary,#fff);font-size:15px;font-weight:600;cursor:not-allowed;">Create Poll</button>
        </div>
      </div>
    `,document.body.appendChild(e);let t=e.querySelector(`#poll-question`),n=e.querySelector(`#poll-question-count`),r=e.querySelector(`#poll-options-list`),i=e.querySelector(`#add-poll-option`),a=e.querySelector(`#poll-multi`),o=e.querySelector(`#poll-multi-slider`),s=e.querySelector(`#create-poll-btn`),c=2;t.addEventListener(`input`,function(){n.textContent=t.value.length+`/200`,u()}),i.addEventListener(`click`,function(){if(c>=12){typeof showToast==`function`&&showToast(`Maximum 12 options`,`error`);return}c++;let e=document.createElement(`div`);e.className=`poll-option-row`,e.style.cssText=`display:flex;gap:8px;align-items:center;`,e.innerHTML=`<input type="text" class="poll-option-input" placeholder="Option ${c}" maxlength="100" style="flex:1;padding:10px 12px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;background:var(--surface,#fff);color:var(--on-surface,#000);">`,e.querySelector(`input`).addEventListener(`input`,u),r.appendChild(e),u()}),r.addEventListener(`input`,u),a.addEventListener(`change`,function(){o.style.background=a.checked?`var(--primary,#00a884)`:`var(--outline,#ccc)`,o.querySelector(`::after`)}),l();function l(){a.checked?(o.style.background=`var(--primary,#00a884)`,o.innerHTML=`<span style="position:absolute;left:22px;top:2px;width:20px;height:20px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></span>`):(o.style.background=`var(--outline,#ccc)`,o.innerHTML=`<span style="position:absolute;left:2px;top:2px;width:20px;height:20px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></span>`)}a.addEventListener(`change`,l);function u(){let e=t.value.trim(),n=Array.from(r.querySelectorAll(`.poll-option-input`)).map(function(e){return e.value.trim()}).filter(function(e){return e.length>0}),i=e.length>0&&n.length>=2;s.disabled=!i,s.style.opacity=i?`1`:`0.5`,s.style.cursor=i?`pointer`:`not-allowed`}s.addEventListener(`click`,function(){if(s.disabled)return;let n=t.value.trim(),i=Array.from(r.querySelectorAll(`.poll-option-input`)).map(function(e){return e.value.trim()}).filter(function(e){return e.length>0}),o=a.checked;n&&i.length>=2&&(window.sendPollMessage(n,i,o),e.remove())}),e.querySelector(`#close-poll-creator`).addEventListener(`click`,function(){e.remove()}),e.addEventListener(`click`,function(t){t.target===e&&e.remove()})}window.PollCreationUI={open:e}})()}));export default t();