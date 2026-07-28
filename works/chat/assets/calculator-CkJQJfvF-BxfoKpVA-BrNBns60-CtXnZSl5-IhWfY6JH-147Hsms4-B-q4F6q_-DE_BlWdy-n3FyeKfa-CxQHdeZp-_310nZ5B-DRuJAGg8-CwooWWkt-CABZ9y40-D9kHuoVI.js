import{n as e}from"./modulepreload-polyfill-C_LrRQgL.js";import{A as t,B as n,D as r,F as i,L as a,M as o,N as s,O as c,P as l,Q as u,S as d,T as f,U as p,W as m,X as h,Y as g,_,_t as v,a as y,d as b,dt as x,g as S,h as C,i as w,j as T,k as E,m as D,mt as O,n as k,nt as A,o as j,p as M,q as N,s as P,st as F,t as I,tt as L,v as R,w as z,x as B,y as V}from"./feature-security-B6a_Aa3r.js";var H,U;e((()=>{O(),N(),v((()=>{u(),k(),A((()=>{n(),d(),h((()=>{i(),l(),p((()=>{x(),t(),F((()=>{z(),o(),a((()=>{f(),M(),y((()=>{m(),L(),P((()=>{V(),C(),j((()=>{_(),I(),g((()=>{b(),B(),R((()=>{w(),s(),S((()=>{c(),E(),r((()=>{T(),H=D((()=>{(function(){let e=null,t=!1,n=0,r=0,i=null,a=null,o=``,s=`0`,c=[];function l(){u(),d(),f(),g()}function u(){if(document.getElementById(`calc-styles`))return;let e=document.createElement(`style`);e.id=`calc-styles`,e.textContent=`
      .calc-widget {
        position: fixed;
        right: 24px;
        top: 80px;
        width: 300px;
        background: var(--surface-container-highest, #222e35);
        border: 1px solid var(--outline-variant, rgba(134, 150, 160, 0.15));
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        z-index: 9000;
        display: none;
        flex-direction: column;
        user-select: none;
        overflow: hidden;
        font-family: var(--font-body-md, "Inter", sans-serif);
      }
      @media (max-width: 600px) {
        .calc-widget {
          right: 12px !important;
          left: 12px !important;
          width: auto !important;
          max-width: 400px;
          bottom: calc(76px + env(safe-area-inset-bottom, 0px)) !important;
          top: auto !important;
          border-radius: 16px 16px 0 0;
        }
      }
      @media (min-width: 601px) and (max-width: 900px) {
        .calc-widget {
          width: 320px;
        }
      }
      html:not(.dark) .calc-widget {
        background: var(--surface-container-highest, #ffffff);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      }
      .calc-header {
        background: var(--brand, #008069);
        color: #ffffff;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: move;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .calc-header-btn {
        background: transparent;
        border: none;
        color: #ffffff;
        cursor: pointer;
        opacity: 0.8;
        padding: 2px;
        min-width: 44px;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.15s;
      }
      .calc-header-btn:hover {
        opacity: 1;
      }
      .calc-display-area {
        padding: 14px;
        background: rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: center;
        min-height: 80px;
        border-bottom: 1px solid var(--outline-variant, rgba(134, 150, 160, 0.08));
      }
      html:not(.dark) .calc-display-area {
        background: rgba(0, 0, 0, 0.02);
      }
      .calc-expr {
        font-size: 13px;
        color: var(--text-secondary, #8696a0);
        min-height: 18px;
        word-break: break-all;
        text-align: right;
        margin-bottom: 4px;
        font-family: var(--font-timestamp, monospace);
      }
      .calc-result {
        font-size: 24px;
        font-weight: 600;
        color: var(--text, #d1d7db);
        word-break: break-all;
        text-align: right;
        font-family: var(--font-timestamp, monospace);
      }
      html:not(.dark) .calc-result {
        color: #111b21;
      }
      .calc-buttons {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        padding: 12px;
      }
      .calc-btn {
        background: var(--surface-container-high, #202c33);
        color: var(--text, #d1d7db);
        border: none;
        border-radius: 8px;
        height: 44px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, transform 0.1s;
        font-family: var(--font-timestamp, monospace);
      }
      .calc-btn:active {
        transform: scale(0.95);
      }
      html:not(.dark) .calc-btn {
        background: var(--surface-container-low, #f0f2f5);
        color: #111b21;
      }
      .calc-btn:hover {
        background: var(--surface-container-highest, #2a3942);
      }
      html:not(.dark) .calc-btn:hover {
        background: #e9edef;
      }
      .calc-btn.operator {
        color: var(--brand, #008069);
        font-weight: 700;
      }
      .calc-btn.action-clear {
        color: #ea0038;
        font-weight: 700;
      }
      .calc-btn.action-equal {
        background: var(--brand, #008069);
        color: #ffffff;
        font-weight: 700;
      }
      .calc-btn.action-equal:hover {
        opacity: 0.9;
      }
      .calc-share-bar {
        display: flex;
        gap: 6px;
        padding: 0 12px 12px 12px;
      }
      .calc-share-btn {
        flex: 1;
        background: var(--brand-soft, rgba(0, 128, 105, 0.12));
        color: var(--brand, #008069);
        border: none;
        border-radius: 8px;
        padding: 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        transition: all 0.15s;
      }
      .calc-share-btn:hover {
        background: var(--brand, #008069);
        color: #ffffff;
      }
    `,document.head.appendChild(e)}function d(){document.getElementById(`calc-widget`)||(e=document.createElement(`div`),e.id=`calc-widget`,e.className=`calc-widget`,e.innerHTML=`
      <div class="calc-header" id="calc-header">
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="material-symbols-outlined" style="font-size:16px;">calculate</span>
          <span>Calculator</span>
        </div>
        <button class="calc-header-btn" data-action="toggleCalculator" title="Close">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      </div>
      <div class="calc-display-area">
        <div class="calc-expr" id="calc-expr"></div>
        <div class="calc-result" id="calc-result">0</div>
      </div>
      <div class="calc-buttons">
        <button class="calc-btn action-clear" data-val="C">C</button>
        <button class="calc-btn operator" data-val="(">(</button>
        <button class="calc-btn operator" data-val=")">)</button>
        <button class="calc-btn operator" data-val="backspace"><span class="material-symbols-outlined" style="font-size:18px;">backspace</span></button>
        
        <button class="calc-btn" data-val="7">7</button>
        <button class="calc-btn" data-val="8">8</button>
        <button class="calc-btn" data-val="9">9</button>
        <button class="calc-btn operator" data-val="/">/</button>
        
        <button class="calc-btn" data-val="4">4</button>
        <button class="calc-btn" data-val="5">5</button>
        <button class="calc-btn" data-val="6">6</button>
        <button class="calc-btn operator" data-val="*">*</button>
        
        <button class="calc-btn" data-val="1">1</button>
        <button class="calc-btn" data-val="2">2</button>
        <button class="calc-btn" data-val="3">3</button>
        <button class="calc-btn operator" data-val="-">-</button>
        
        <button class="calc-btn" data-val="0">0</button>
        <button class="calc-btn" data-val=".">.</button>
        <button class="calc-btn action-equal" data-val="=">=</button>
        <button class="calc-btn operator" data-val="+">+</button>
      </div>
      <div class="calc-share-bar">
        <button class="calc-share-btn" id="calc-share-result" title="Paste just the final result into chat">
          <span class="material-symbols-outlined" style="font-size:14px;">content_copy</span>Result
        </button>
        <button class="calc-share-btn" id="calc-share-full" title="Paste the formula and result into chat">
          <span class="material-symbols-outlined" style="font-size:14px;">send</span>Full Formula
        </button>
      </div>
    `,document.body.appendChild(e))}function f(){let e=document.getElementById(`calc-header`);e&&(e.addEventListener(`mousedown`,p),document.addEventListener(`mousemove`,m),document.addEventListener(`mouseup`,h),e.addEventListener(`touchstart`,p,{passive:!1}),document.addEventListener(`touchmove`,m,{passive:!1}),document.addEventListener(`touchend`,h),i=function(){e.removeEventListener(`mousedown`,p),document.removeEventListener(`mousemove`,m),document.removeEventListener(`mouseup`,h),e.removeEventListener(`touchstart`,p),document.removeEventListener(`touchmove`,m),document.removeEventListener(`touchend`,h)})}function p(i){if(i.target.closest(`.calc-header-btn`))return;t=!0;let a=i.type===`touchstart`?i.touches[0].clientX:i.clientX,o=i.type===`touchstart`?i.touches[0].clientY:i.clientY,s=e.getBoundingClientRect();n=a-s.left,r=o-s.top,i.cancelable&&i.preventDefault()}function m(i){if(!t)return;let a=i.type===`touchmove`?i.touches[0].clientX:i.clientX,o=i.type===`touchmove`?i.touches[0].clientY:i.clientY,s=a-n,c=o-r,l=window.innerWidth-e.offsetWidth,u=window.innerHeight-e.offsetHeight;s=Math.max(0,Math.min(s,l)),c=Math.max(0,Math.min(c,u)),e.style.left=`${s}px`,e.style.top=`${c}px`,e.style.right=`auto`,i.cancelable&&i.preventDefault()}function h(){t=!1}function g(){e.querySelectorAll(`.calc-btn`).forEach(e=>{e.addEventListener(`click`,()=>{_(e.getAttribute(`data-val`))})}),document.getElementById(`calc-share-result`).addEventListener(`click`,()=>{x(s)}),document.getElementById(`calc-share-full`).addEventListener(`click`,()=>{x(o?`${o} = ${s}`:s)}),a=function(t){if(!e||e.style.display!==`flex`)return;let n=t.key;/[0-9.+\-*/()]/.test(n)?(t.preventDefault(),_(n)):n===`Enter`||n===`=`?(t.preventDefault(),_(`=`)):n===`Backspace`?(t.preventDefault(),_(`backspace`)):n===`Escape`?toggleCalculator():n.toLowerCase()===`c`&&_(`C`)},document.addEventListener(`keydown`,a)}function _(e){let t=document.getElementById(`calc-expr`),n=document.getElementById(`calc-result`);if(e===`C`)o=``,s=`0`;else if(e===`backspace`)o=o.slice(0,-1);else if(e===`=`)try{o&&(s=v(o),c.push(`${o} = ${s}`),c.length>10&&c.shift())}catch{s=`Error`}else{let t=[`+`,`-`,`*`,`/`],n=o.slice(-1);t.includes(e)&&t.includes(n)?o=o.slice(0,-1)+e:o+=e}t.textContent=o,n.textContent=s}function v(e){let t=e.replace(/x/g,`*`).replace(/÷/g,`/`);if(!/^[0-9+\-*/().\s]+$/.test(t))throw Error(`Invalid characters`);var n=y(t);if(n===void 0||isNaN(n)||!isFinite(n))throw Error(`Math error`);return Number(n.toFixed(8)).toString()}function y(e){var t=b(e),n=0;function r(){return n<t.length?t[n]:null}function i(){return t[n++]}function a(){for(var e=o();r()===`+`||r()===`-`;){var t=i(),n=o();e=t===`+`?e+n:e-n}return e}function o(){for(var e=s();r()===`*`||r()===`/`;){var t=i(),n=s();if(t===`*`)e*=n;else{if(n===0)throw Error(`Division by zero`);e/=n}}return e}function s(){var e=r();if(e===`(`){i();var t=a();if(i()!==`)`)throw Error(`Mismatched parentheses`);return t}if(e===`-`)return i(),-s();if(e===`+`)return i(),s();if(e!==null&&/^[0-9]*\.?[0-9]+$/.test(e))return parseFloat(i());throw Error(`Unexpected token: `+e)}var c=a();if(n<t.length)throw Error(`Unexpected trailing characters`);return c}function b(e){for(var t=[],n=0,r=e.replace(/\s+/g,``);n<r.length;)if(`+-*/()`.indexOf(r[n])!==-1)t.push(r[n]),n++;else if(/[0-9.]/.test(r[n])){for(var i=``;n<r.length&&/[0-9.]/.test(r[n]);)i+=r[n],n++;t.push(i)}else throw Error(`Unexpected character: `+r[n]);return t}function x(e){let t=document.getElementById(`msg-input`);if(!t){typeof showToast==`function`&&showToast(`Open a chat to share results!`,`warning`);return}let n=t.selectionStart,r=t.selectionEnd,i=t.value;t.value=i.substring(0,n)+e+i.substring(r),t.selectionStart=t.selectionEnd=n+e.length,t.focus(),typeof window.onInputChange==`function`?window.onInputChange():t.dispatchEvent(new Event(`input`,{bubbles:!0}))}function S(){i&&(i(),i=null),a&&(document.removeEventListener(`keydown`,a),a=null),e&&(e.remove(),e=null);var t=document.getElementById(`calc-styles`);t&&t.remove()}window.toggleCalculator=function(){e||l(),e.style.display===`flex`?e.style.display=`none`:(e.style.display=`flex`,e.style.left===``&&(window.innerWidth<=600?(e.style.left=`12px`,e.style.right=`12px`,e.style.top=`auto`):(e.style.right=`24px`,e.style.top=`80px`)))},window.CalculatorWidget={destroy:S}})()})),U=H()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))();export{U as default};