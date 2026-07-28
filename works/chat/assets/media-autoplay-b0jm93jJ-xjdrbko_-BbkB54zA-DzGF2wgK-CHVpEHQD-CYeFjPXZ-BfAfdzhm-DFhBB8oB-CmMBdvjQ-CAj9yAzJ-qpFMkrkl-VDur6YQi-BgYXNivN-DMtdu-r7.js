import{n as e}from"./modulepreload-polyfill-C_LrRQgL.js";import{$ as t,B as n,C as r,D as i,F as a,J as o,K as s,L as c,M as l,O as u,P as d,S as f,W as p,Y as m,Z as h,_ as g,a as _,at as v,ct as y,d as b,et as x,f as S,ft as C,g as w,i as T,it as E,j as D,k as O,l as k,lt as A,n as j,o as M,rt as N,s as P,t as F,u as I,x as L,y as R}from"./feature-security-DwgR72Uf.js";var z,B;e((()=>{A(),s(),C((()=>{h(),w(),x((()=>{n(),I(),m((()=>{a(),D(),p((()=>{c(),i(),N((()=>{_(),S(),v((()=>{P(),O(),E((()=>{o(),T(),M((()=>{R(),y(),j((()=>{g(),F(),L((()=>{u(),f(),r((()=>{k(),d(),b((()=>{l(),z=t((()=>{(function(){window.MediaAutoplay={_defaults:{gifAutoplay:!0,videoAutoplay:!1,videoMuted:!0},get(e){try{return JSON.parse(localStorage.getItem(`nsl_media_autoplay`)||`{}`)[e]??this._defaults[e]}catch{return this._defaults[e]}},set(e,t){let n=JSON.parse(localStorage.getItem(`nsl_media_autoplay`)||`{}`);n[e]=t;try{localStorage.setItem(`nsl_media_autoplay`,JSON.stringify(n))}catch{}this._applyGlobal()},_applyGlobal(){document.querySelectorAll(`img[src*="gif"]`).forEach(e=>{this.get(`gifAutoplay`)||(e.loading=`lazy`,e.setAttribute(`data-defer-src`,e.src),e.src=`data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7`,e.style.cursor=`pointer`,e.onclick=function(){this.src=this.getAttribute(`data-defer-src`),this.onclick=null})}),document.querySelectorAll(`video`).forEach(e=>{e.muted=this.get(`videoMuted`),this.get(`videoAutoplay`)||(e.pause(),e.removeAttribute(`autoplay`),e.controls=!0)})},observeNewMedia(){let e=document.getElementById(`messages-container`)||document.querySelector(`.messages-wrapper`);e&&new MutationObserver(e=>{e.forEach(e=>{e.addedNodes.forEach(e=>{e.nodeType===1&&((e.querySelectorAll?e.querySelectorAll(`img[src*="gif"]`):[]).forEach(e=>{this.get(`gifAutoplay`)||(e.setAttribute(`data-defer-src`,e.src),e.src=`data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7`,e.style.cursor=`pointer`,e.onclick=function(){this.src=this.getAttribute(`data-defer-src`),this.onclick=null})}),(e.querySelectorAll?e.querySelectorAll(`video`):[]).forEach(e=>{e.muted=this.get(`videoMuted`),this.get(`videoAutoplay`)||(e.pause(),e.removeAttribute(`autoplay`),e.controls=!0)}))})})}).observe(e,{childList:!0,subtree:!0})},openSettings(){let e=document.createElement(`div`);e.id=`media-autoplay-modal`,e.style.cssText=`position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;`,e.innerHTML=`
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(380px,92vw);padding:24px;">
          <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;">Media Auto-play</h3>

          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--outline-variant,#eee);">
            <div>
              <div style="font-size:14px;font-weight:600;">GIF Auto-play</div>
              <div style="font-size:12px;color:var(--on-surface-variant,#666);">Automatically play GIF animations</div>
            </div>
            <input type="checkbox" id="autoplay-gif" ${this.get(`gifAutoplay`)?`checked`:``} style="width:18px;height:18px;">
          </label>

          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--outline-variant,#eee);">
            <div>
              <div style="font-size:14px;font-weight:600;">Video Auto-play</div>
              <div style="font-size:12px;color:var(--on-surface-variant,#666);">Automatically play videos</div>
            </div>
            <input type="checkbox" id="autoplay-video" ${this.get(`videoAutoplay`)?`checked`:``} style="width:18px;height:18px;">
          </label>

          <label style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;">
            <div>
              <div style="font-size:14px;font-weight:600;">Videos Muted</div>
              <div style="font-size:12px;color:var(--on-surface-variant,#666);">Start videos muted by default</div>
            </div>
            <input type="checkbox" id="autoplay-muted" ${this.get(`videoMuted`)?`checked`:``} style="width:18px;height:18px;">
          </label>
        </div>
      `,document.body.appendChild(e),e.addEventListener(`click`,t=>{t.target===e&&e.remove()}),e.querySelector(`#autoplay-gif`).addEventListener(`change`,e=>{this.set(`gifAutoplay`,e.target.checked),typeof showToast==`function`&&showToast(`GIF auto-play `+(e.target.checked?`on`:`off`),`success`)}),e.querySelector(`#autoplay-video`).addEventListener(`change`,e=>{this.set(`videoAutoplay`,e.target.checked),typeof showToast==`function`&&showToast(`Video auto-play `+(e.target.checked?`on`:`off`),`success`)}),e.querySelector(`#autoplay-muted`).addEventListener(`change`,e=>{this.set(`videoMuted`,e.target.checked),this._applyGlobal()})}}})()})),B=z()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))();export{B as default};