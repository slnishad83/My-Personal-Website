import{n as e}from"./modulepreload-polyfill-C_LrRQgL.js";import{a as t,c as n,d as r,o as i,s as a}from"./feature-security-BAUo4eYB.js";var o,s;e((()=>{n(),t(),r((()=>{a(),o=i((()=>{(function(){typeof CanvasRenderingContext2D<`u`&&!CanvasRenderingContext2D.prototype.roundRect&&(CanvasRenderingContext2D.prototype.roundRect=function(e,t,n,r,i){typeof i==`number`?i=[i,i,i,i]:Array.isArray(i)||(i=[0,0,0,0]);var a=i[0]||0,o=i[1]||i[0]||0,s=i[2]||i[0]||0,c=i[3]||i[1]||i[0]||0;return this.beginPath(),this.moveTo(e+a,t),this.lineTo(e+n-o,t),this.quadraticCurveTo(e+n,t,e+n,t+o),this.lineTo(e+n,t+r-s),this.quadraticCurveTo(e+n,t+r,e+n-s,t+r),this.lineTo(e+c,t+r),this.quadraticCurveTo(e,t+r,e,t+r-c),this.lineTo(e,t+a),this.quadraticCurveTo(e,t,e+a,t),this.closePath(),this});function e(){if(document.getElementById(`_fv_style`))return;let e=document.createElement(`style`);e.id=`_fv_style`,e.textContent=`
/* ── reset inside viewer ────────────────────────────────── */
#_fv, #_fv * {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent;
}
/* ── outer shell ─────────────────────────────────────────── */
#_fv {
  position: fixed; inset: 0;
  z-index: 2147483647;
  display: none;
  flex-direction: column;
  background: var(--bg, #0d0d0f);
  touch-action: none;
}

/* ── TOP BAR ─────────────────────────────────────────────── */
#_fv_bar {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  background: var(--bg-card, #1c1c28);
  border-bottom: 1px solid rgba(255,255,255,0.09);
  flex-shrink: 0;
}
#_fv_name {
  color: #eeeef5;
  font-size: 14px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  flex: 1;
}
#_fv_x {
  background: rgba(255,255,255,0.1);
  border: none; color: #fff; font-size: 18px; cursor: pointer;
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: background .15s;
}
#_fv_x:hover { background: rgba(255,255,255,0.22); }

/* ── STAGE (image/video area) ────────────────────────────── */
#_fv_stage {
  flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden;
  background: var(--bg, #0d0d0f);
}
#_fv_img {
  max-width: 100%; max-height: 100%;
  object-fit: contain; display: none;
  user-select: none; transform-origin: center center;
}
#_fv_video {
  max-width: 100%; max-height: 100%;
  display: none; outline: none; background: #000;
}
#_fv_doc {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  border: none; display: none;
}
#_fv_txt {
  position: absolute; inset: 0;
  overflow: auto; padding: 24px;
  color: #d0d0e0; font-size: 13px; font-family: monospace;
  white-space: pre-wrap; word-break: break-all; display: none;
}
#_fv_file {
  position: absolute; inset: 0;
  display: none; flex-direction: column;
  align-items: center; justify-content: center;
  color: #fff; gap: 16px; padding: 32px; text-align: center;
}
#_fv_file_icon { font-size: 72px; line-height: 1; }
#_fv_file_name { font-size: 17px; font-weight: 500; max-width: 80%; word-break: break-word; color:#eee; }
#_fv_file_btn  { background: #4fc3f7; color: #000; padding: 11px 28px; border-radius: 24px; text-decoration: none; font-weight: 700; font-size: 15px; }
#_fv_file_dl2  { color: #4fc3f7; font-size: 14px; text-decoration: none; }

/* ── NAV ARROWS ──────────────────────────────────────────── */
#_fv_prev, #_fv_next {
  position: absolute; top: 50%; transform: translateY(-50%);
  background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15);
  color: #fff; font-size: 26px;
  width: 42px; height: 68px; border-radius: 8px;
  cursor: pointer; z-index: 2;
  display: none; align-items: center; justify-content: center;
  backdrop-filter: blur(6px);
}
#_fv_prev:hover, #_fv_next:hover { background: rgba(0,0,0,0.8); }
#_fv_prev { left: 10px; }
#_fv_next { right: 10px; }

/* ── COUNTER ─────────────────────────────────────────────── */
#_fv_counter {
  position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.65); color: #fff;
  font-size: 12px; font-weight: 600;
  padding: 3px 12px; border-radius: 12px;
  pointer-events: none; display: none; z-index: 3;
}

/* ── ACTION BAR (sits BELOW the image — not overlapping) ─── */
#_fv_abar {
  display: flex; align-items: stretch; justify-content: center;
  gap: 6px; flex-wrap: nowrap; overflow-x: auto;
  flex-shrink: 0;
  background: var(--bg-card, #1c1c28);
  border-top: 1px solid rgba(255,255,255,0.09);
  padding: 12px 10px 18px;
  scrollbar-width: none;
}
#_fv_abar::-webkit-scrollbar { display: none; }

/* individual action buttons */
._fva {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 6px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  color: #dde0ee;
  cursor: pointer;
  min-width: 66px; padding: 10px 8px;
  flex-shrink: 0;
  transition: background .15s, border-color .15s;
}
._fva:hover, ._fva:active { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.25); }
._fva .ico { font-size: 22px; line-height: 1; }
._fva .lbl {
  font-size: 10px; font-weight: 700;
  letter-spacing: .04em; text-transform: uppercase;
  color: #aab0cc; white-space: nowrap;
}
._fva.danger       { color: #ff6b6b; border-color: rgba(255,80,80,0.2); }
._fva.danger .lbl  { color: #ff8888; }
._fva.danger:hover { background: rgba(255,60,60,0.18); border-color: rgba(255,80,80,0.4); }

/* ── DELETE SUBMENU ──────────────────────────────────────── */
#_fv_delmenu {
  position: absolute; bottom: 108px; left: 50%; transform: translateX(-50%);
  background: #1e2030; border-radius: 14px; overflow: hidden; z-index: 10;
  box-shadow: 0 8px 32px rgba(0,0,0,0.7);
  display: none; min-width: 230px;
  border: 1px solid rgba(255,255,255,0.1);
}
._fvdel_opt {
  display: block; width: 100%; background: none; border: none;
  padding: 15px 20px; color: #e0e0f0; font-size: 14px;
  text-align: left; cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
._fvdel_opt:last-child { border-bottom: none; }
._fvdel_opt.danger { color: #ff6b6b; }
._fvdel_opt:hover { background: rgba(255,255,255,0.08); }

/* ── EDIT OVERLAY ────────────────────────────────────────── */
#_fv_edit {
  position: absolute; inset: 0; z-index: 20;
  background: #000; display: none; flex-direction: column;
}
#_fv_ecanvas { flex: 1; display: block; touch-action: none; cursor: crosshair; }
#_fv_etbar {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 12px; background: #111520;
  flex-shrink: 0; overflow-x: auto; scrollbar-width: none;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
#_fv_etbar::-webkit-scrollbar { display: none; }
._fvet {
  background: #252535; border: 1px solid rgba(255,255,255,0.12);
  color: #dde; border-radius: 9px;
  padding: 7px 13px; font-size: 13px;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: background .12s;
}
._fvet:hover { background: #303048; }
._fvet.active { background: #4fc3f7; color: #000; border-color: #4fc3f7; }
#_fv_ecolor { width: 44px; height: 44px; border: 2px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer; padding: 0; flex-shrink: 0; }
#_fv_esize  { width: 72px; flex-shrink: 0; accent-color: #4fc3f7; }
#_fv_efont  { width: 64px; flex-shrink: 0; accent-color: #4fc3f7; }
#_fv_ebar2 {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 12px; background: #0d0d18;
  flex-shrink: 0; justify-content: flex-end;
  border-top: 1px solid rgba(255,255,255,0.08);
}
#_fv_etextinput {
  position: absolute; display: none;
  background: transparent; border: none; outline: none;
  color: #fff; font-size: 20px; font-family: sans-serif;
  text-shadow: 1px 1px 4px #000; cursor: move;
  resize: none; min-width: 100px;
}

/* ── STICKER OVERLAY ─────────────────────────────────────── */
#_fv_sticker {
  position: absolute; inset: 0; z-index: 21;
  background: #000; display: none; flex-direction: column;
  align-items: center; justify-content: center;
}
#_fv_sticker > p {
  color: #888; font-size: 13px; margin: 0 0 10px;
}
#_fv_stickercanvas { display: block; touch-action: none; border-radius: 16px; }
#_fv_stkbar {
  display: flex; gap: 10px; padding: 14px 16px;
  background: #111520; flex-shrink: 0; justify-content: center;
  width: 100%; border-top: 1px solid rgba(255,255,255,0.08);
}
`,document.head.appendChild(e)}function t(){if(document.getElementById(`_fv`))return;e();let t=document.createElement(`div`);t.id=`_fv`,t.setAttribute(`role`,`dialog`),t.setAttribute(`aria-modal`,`true`),t.innerHTML=`<div id="_fv_bar">
        <span id="_fv_name"></span>
        <button id="_fv_x" aria-label="Close">&#10005;</button>
      </div><div id="_fv_stage">
        <button id="_fv_prev" aria-label="Previous">&#8249;</button>
        <img id="_fv_img" alt="">
        <video id="_fv_video" controls playsinline></video>
        <iframe id="_fv_doc" allowfullscreen></iframe>
        <div id="_fv_txt"></div>
        <div id="_fv_file">
          <div id="_fv_file_icon">&#128196;</div>
          <div id="_fv_file_name"></div>
          <a id="_fv_file_btn" target="_blank" rel="noopener">Open File</a>
          <a id="_fv_file_dl2">&#11015; Download</a>
        </div>
        <button id="_fv_next" aria-label="Next">&#8250;</button>
        <div id="_fv_counter"></div>

        <!-- Edit overlay -->
        <div id="_fv_edit">
          <div id="_fv_etbar">
            <button class="_fvet active" id="_fv_edraw">&#9998; Draw</button>
            <button class="_fvet" id="_fv_etext">T&nbsp;Text</button>
            <button class="_fvet" id="_fv_eemoji">&#128512; Emoji</button>
            <input type="color" id="_fv_ecolor" value="#ff0000" title="Color">
            <input type="range" id="_fv_esize" min="1" max="24" value="4" title="Brush size">
            <input type="range" id="_fv_efont" min="14" max="72" value="24" title="Font size">
          </div>
          <canvas id="_fv_ecanvas"></canvas>
          <textarea id="_fv_etextinput" rows="1" placeholder="Type text…"></textarea>
          <div id="_fv_ebar2">
            <button class="_fvet" id="_fv_eundo">&#8617; Undo</button>
            <button class="_fvet" id="_fv_eclear">Clear</button>
            <button class="_fvet" id="_fv_ecancel">Cancel</button>
            <button class="_fvet active" id="_fv_edone">Done &#10003;</button>
          </div>
        </div>

        <!-- Sticker overlay -->
        <div id="_fv_sticker">
          <p>Drag to adjust crop</p>
          <canvas id="_fv_stickercanvas"></canvas>
          <div id="_fv_stkbar">
            <button class="_fvet" id="_fv_stk_cancel">Cancel</button>
            <button class="_fvet active" id="_fv_stk_dl">&#11015; Save Sticker</button>
            <button class="_fvet active" id="_fv_stk_send">Send as Image</button>
          </div>
        </div>

        <!-- Delete submenu -->
        <div id="_fv_delmenu">
          <button class="_fvdel_opt" id="_fv_del_me">Delete for me</button>
          <button class="_fvdel_opt danger" id="_fv_del_all">Delete for everyone</button>
          <button class="_fvdel_opt" id="_fv_del_cancel">Cancel</button>
        </div>
      </div><div id="_fv_abar">
        <button class="_fva" id="_fva_forward"><span class="ico">&#8599;</span><span class="lbl">Forward</span></button>
        <button class="_fva" id="_fva_star">   <span class="ico">&#9733;</span><span class="lbl">Star</span></button>
        <button class="_fva" id="_fva_show">   <span class="ico">&#128172;</span><span class="lbl">Show</span></button>
        <button class="_fva" id="_fva_copy">   <span class="ico">&#128279;</span><span class="lbl">Copy&nbsp;link</span></button>
        <button class="_fva" id="_fva_dl">     <span class="ico">&#11015;</span><span class="lbl">Download</span></button>
        <button class="_fva _img_act" id="_fva_edit">    <span class="ico">&#9998;</span><span class="lbl">Edit</span></button>
        <button class="_fva _img_act" id="_fva_rotate">  <span class="ico">&#8635;</span><span class="lbl">Rotate</span></button>
        <button class="_fva _img_act" id="_fva_wallpaper"><span class="ico">&#127756;</span><span class="lbl">Wallpaper</span></button>
        <button class="_fva _img_act" id="_fva_sticker">  <span class="ico">&#127914;</span><span class="lbl">Sticker</span></button>
        <button class="_fva danger"   id="_fva_delete">  <span class="ico">&#128465;</span><span class="lbl">Delete</span></button>
      </div>`,document.body.appendChild(t),x=!0,E(),k(),z(),W()}let n=[],r=0,i=0,a=1,o=0,s=0,c=!1,l=0,u=0,d=0,f=0,p=0,m=1,h=0,g=0,_=!1,v=null,y=null,b=null,x=!1;function S(e,c,l,u,d){t();let f={};n=[],document.querySelectorAll(`[data-preview-url]`).forEach(e=>{let t=e.dataset.previewUrl;if(!t||f[t])return;f[t]=!0;let r=e.dataset.filename||K(t),i=e.querySelector(`video`)||e.classList.contains(`video-attachment`),a=e.querySelector(`img`),o=i?`video`:a?`image`:G(t),s=null,c=null,l=e.closest(`.message[data-message-id]`);l&&(s=l.dataset.messageId);let u=e.closest(`[data-message-meta]`);if(u)try{c=JSON.parse(u.dataset.messageMeta),s=s||c.messageId}catch{}n.push({url:t,filename:r,type:o,messageId:s,meta:c})}),f[e]||n.unshift({url:e,filename:c||K(e),type:l||G(e),messageId:u||null,meta:d||null}),r=n.findIndex(t=>t.url===e),r<0&&(r=0),u&&(n[r].messageId=u),d&&(n[r].meta=d),i=0,a=1,o=0,s=0,w(),document.getElementById(`_fv`).style.display=`flex`,document.body.style.overflow=`hidden`,document.getElementById(`_fv_delmenu`).style.display=`none`}function C(){let e=document.getElementById(`_fv`);if(!e)return;v&&(document.removeEventListener(`keydown`,v),v=null),y&&(document.removeEventListener(`mousemove`,y),y=null),b&&(document.removeEventListener(`mouseup`,b),b=null);let t=document.getElementById(`_fv_video`);if(t){try{t.pause()}catch{}t.src=``}let n=document.getElementById(`_fv_doc`);n&&(n.src=`about:blank`);let r=document.getElementById(`_fv_img`);if(r&&r.src&&r.src.startsWith(`blob:`))try{URL.revokeObjectURL(r.src)}catch{}e.style.display=`none`,document.body.style.overflow=``,[`_fv_edit`,`_fv_sticker`,`_fv_delmenu`].forEach(e=>{let t=document.getElementById(e);t&&(t.style.display=`none`)})}function w(){let e=n[r]||{},t=e.url||``,c=e.filename||K(t),l=e.type||G(t);if(document.getElementById(`_fv_name`).textContent=c,[`_fv_img`,`_fv_video`,`_fv_doc`,`_fv_txt`,`_fv_file`].forEach(e=>{let t=document.getElementById(e);t&&(t.style.display=`none`)}),i=0,a=1,o=0,s=0,document.querySelectorAll(`._img_act`).forEach(e=>e.style.display=`none`),l===`image`){let e=document.getElementById(`_fv_img`);e.src=t,e.style.display=`block`,e.style.transform=``,e.style.cursor=`zoom-in`,document.querySelectorAll(`._img_act`).forEach(e=>e.style.display=`flex`)}else if(l===`video`){let e=document.getElementById(`_fv_video`);e.src=t,e.style.display=`block`}else if(l===`pdf`||l===`office`){let e=document.getElementById(`_fv_doc`);e.src=`https://docs.google.com/viewer?url=`+encodeURIComponent(t)+`&embedded=true`,e.style.display=`block`}else if(l===`text`){let e=document.getElementById(`_fv_txt`);e.style.display=`block`,e.textContent=`Loading…`,fetch(t).then(e=>e.text()).then(t=>{e.textContent=t}).catch(()=>{e.textContent=`Could not load. Use Download.`})}else{let e=document.getElementById(`_fv_file`);e.style.display=`flex`,document.getElementById(`_fv_file_name`).textContent=c,document.getElementById(`_fv_file_btn`).href=t;let n=document.getElementById(`_fv_file_dl2`);n.href=t,n.setAttribute(`download`,c)}let u=document.getElementById(`_fva_dl`);u&&(u.onclick=()=>{let e=document.createElement(`a`);e.href=t,e.download=c,e.target=`_blank`,e.click(),typeof showToast==`function`&&showToast(`File saved to Downloads`,`success`)});let d=n.filter(e=>e.type===`image`||e.type===`video`),f=(l===`image`||l===`video`)&&d.length>1;document.getElementById(`_fv_prev`).style.display=f?`flex`:`none`,document.getElementById(`_fv_next`).style.display=f?`flex`:`none`;let p=document.getElementById(`_fv_counter`);p.style.display=f?`block`:`none`,f&&(p.textContent=r+1+` / `+n.length)}function T(e){let t=document.getElementById(`_fv_video`);if(t){try{t.pause()}catch{}t.src=``}r=(r+e+n.length)%n.length,i=0,a=1,o=0,s=0,document.getElementById(`_fv_delmenu`).style.display=`none`,w()}function E(){let e=document.getElementById(`_fv`),t=document.getElementById(`_fv_img`);document.getElementById(`_fv_x`).addEventListener(`click`,C),document.getElementById(`_fv_prev`).addEventListener(`click`,function(){T(-1)}),document.getElementById(`_fv_next`).addEventListener(`click`,function(){T(1)}),e.addEventListener(`click`,function(t){(t.target===e||t.target.id===`_fv_stage`)&&C()}),v=function(e){var t=document.getElementById(`_fv`);!t||t.style.display===`none`||(e.key===`Escape`&&C(),e.key===`ArrowLeft`&&T(-1),e.key===`ArrowRight`&&T(1))},document.removeEventListener(`keydown`,v),document.addEventListener(`keydown`,v),t.addEventListener(`wheel`,function(e){e.preventDefault(),a=Math.max(1,Math.min(6,a+(e.deltaY>0?-.2:.2))),a<=1&&(o=0,s=0),D()},{passive:!1}),t.addEventListener(`mousedown`,function(e){a<=1||(e.preventDefault(),c=!0,l=e.clientX,u=e.clientY,d=o,f=s,t.style.cursor=`grabbing`)}),y=function(e){c&&(o=d+(e.clientX-l)/a,s=f+(e.clientY-u)/a,D())},b=function(){c&&(c=!1,t.style.cursor=a>1?`grab`:`zoom-in`)},document.removeEventListener(`mousemove`,y),document.removeEventListener(`mouseup`,b),document.addEventListener(`mousemove`,y),document.addEventListener(`mouseup`,b),e.addEventListener(`touchstart`,e=>{e.touches.length===2?(_=!0,p=O(e.touches),m=a):e.touches.length===1&&!_&&(h=e.touches[0].clientX,g=e.touches[0].clientY,a>1&&(c=!0,l=e.touches[0].clientX,u=e.touches[0].clientY,d=o,f=s))},{passive:!0}),e.addEventListener(`touchmove`,e=>{e.touches.length===2||_?(e.preventDefault(),_=!0,a=Math.max(1,Math.min(6,m*(O(e.touches)/p))),a<=1&&(o=0,s=0),D()):e.touches.length===1&&c&&a>1&&(o=d+(e.touches[0].clientX-l)/a,s=f+(e.touches[0].clientY-u)/a,D())},{passive:!1}),e.addEventListener(`touchend`,e=>{if(_&&e.touches.length<2&&(_=!1),c=!1,!_&&a<=1&&e.changedTouches.length===1){let t=e.changedTouches[0].clientX-h,n=e.changedTouches[0].clientY-g;Math.abs(t)>50&&Math.abs(t)>Math.abs(n)*1.2&&T(t<0?1:-1)}},{passive:!0})}function D(){let e=document.getElementById(`_fv_img`);e&&(e.style.transform=`rotate(${i}deg) scale(${a}) translate(${o}px,${s}px)`,e.style.cursor=a>1?`grab`:`zoom-in`)}function O(e){let t=e[0].clientX-e[1].clientX,n=e[0].clientY-e[1].clientY;return Math.sqrt(t*t+n*n)}function k(){document.getElementById(`_fva_forward`).addEventListener(`click`,()=>{let e=n[r];if(!e)return;C();let t={type:e.type,url:e.url,filename:e.filename};e.messageId&&typeof window.openForwardModal==`function`?window.openForwardModal(e.messageId,e.meta||{}):typeof window.openForwardModalForMedia==`function`?window.openForwardModalForMedia(t):J(`Forward not available in this context`)}),document.getElementById(`_fva_star`).addEventListener(`click`,()=>{let e=n[r];e&&(e.messageId&&typeof window.starMessage==`function`?window.starMessage(e.messageId,e.meta||{text:``,attachment:{type:e.type,url:e.url,filename:e.filename}}):J(`Cannot star — message info unavailable`))}),document.getElementById(`_fva_show`).addEventListener(`click`,()=>{let e=n[r];if(e){if(!e.messageId){J(`Message location unknown`);return}C(),setTimeout(()=>{if(typeof window.scrollToMessage==`function`)window.scrollToMessage(e.messageId);else{let t=document.querySelector(`.message[data-message-id="${CSS.escape(e.messageId)}"]`);t&&t.scrollIntoView({block:`center`,behavior:`smooth`})}},120)}}),document.getElementById(`_fva_copy`).addEventListener(`click`,()=>{let e=(n[r]||{}).url;e&&(navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(e).then(()=>J(`Link copied`)).catch(()=>q(e)):q(e))}),document.getElementById(`_fva_rotate`).addEventListener(`click`,()=>{let e=document.getElementById(`_fv_img`);!e||e.style.display===`none`||(i=(i+90)%360,D())}),document.getElementById(`_fva_wallpaper`).addEventListener(`click`,()=>{let e=n[r];if(!e||e.type!==`image`)return;let t=window.currentChat&&window.currentChat.id;if(!t){J(`Open a chat first`);return}if(window.chatWallpapers&&(window.chatWallpapers[t]=e.url),typeof window.saveWallpaperToStorage==`function`&&window.saveWallpaperToStorage(),typeof window.applyCurrentChatWallpaper==`function`)window.applyCurrentChatWallpaper();else{let t=document.getElementById(`messagesArea`);t&&(t.style.backgroundImage=`url(${e.url})`,t.style.backgroundSize=`cover`,t.style.backgroundPosition=`center`)}C(),J(`Wallpaper set for this chat`)}),document.getElementById(`_fva_edit`).addEventListener(`click`,()=>{let e=document.getElementById(`_fv_img`);!e||e.style.display===`none`||I(e.src)}),document.getElementById(`_fva_sticker`).addEventListener(`click`,()=>{let e=document.getElementById(`_fv_img`);!e||e.style.display===`none`||H(e.src)}),document.getElementById(`_fva_delete`).addEventListener(`click`,()=>{let e=document.getElementById(`_fv_delmenu`);e.style.display=e.style.display===`block`?`none`:`block`}),document.getElementById(`_fv_del_cancel`).addEventListener(`click`,()=>{document.getElementById(`_fv_delmenu`).style.display=`none`}),document.getElementById(`_fv_del_me`).addEventListener(`click`,()=>{let e=n[r];if(e){if(!e.messageId){J(`Cannot delete — message info unavailable`);return}document.getElementById(`_fv_delmenu`).style.display=`none`,C(),typeof window.deleteMessageForMe==`function`?window.deleteMessageForMe(e.messageId).then(()=>J(`Deleted for you`)).catch(()=>J(`Delete failed`,`error`)):J(`Delete not available`)}}),document.getElementById(`_fv_del_all`).addEventListener(`click`,()=>{let e=n[r];if(e){if(!e.messageId){J(`Cannot delete — message info unavailable`);return}document.getElementById(`_fv_delmenu`).style.display=`none`,C(),typeof window.deleteMessageForEveryone==`function`?window.deleteMessageForEveryone(e.messageId,e.meta||null).then(()=>J(`Deleted for everyone`)).catch(()=>J(`Delete failed`,`error`)):J(`Delete not available`)}})}let A=[],j=`draw`,M=null,N=!1,P=!1,F=[`😀`,`😂`,`❤️`,`🔥`,`👍`,`😍`,`🎉`,`😭`,`😎`,`🤔`,`💯`,`🙏`,`✨`,`💪`,`🤣`,`🥳`,`😅`,`😊`,`🫶`,`⭐`];function I(e){let t=document.getElementById(`_fv_edit`),n=document.getElementById(`_fv_ecanvas`);t.style.display=`flex`;let r=new Image;r.crossOrigin=`anonymous`,r.onload=()=>{M=r;let e=window.innerWidth,t=window.innerHeight-130,i=Math.min(e/r.width,t/r.height,1);n.width=r.width*i,n.height=r.height*i,A=[],L()},r.src=e}function L(){let e=document.getElementById(`_fv_ecanvas`),t=e.getContext(`2d`);t.clearRect(0,0,e.width,e.height),M&&t.drawImage(M,0,0,e.width,e.height),A.forEach(e=>R(t,e))}function R(e,t){t.type===`draw`?(e.strokeStyle=t.color,e.lineWidth=t.size,e.lineCap=`round`,e.lineJoin=`round`,e.beginPath(),t.pts.forEach((t,n)=>n===0?e.moveTo(t.x,t.y):e.lineTo(t.x,t.y)),e.stroke()):t.type===`text`?(e.font=`${t.size}px sans-serif`,e.fillStyle=t.color,e.shadowColor=`#000`,e.shadowBlur=5,e.fillText(t.text,t.x,t.y),e.shadowBlur=0):t.type===`emoji`&&(e.font=`${t.size}px sans-serif`,e.fillText(t.emoji,t.x,t.y))}function z(){let e=document.getElementById(`_fv_ecanvas`),t=document.getElementById(`_fv_ecolor`),i=document.getElementById(`_fv_esize`),a=document.getElementById(`_fv_efont`),o=document.getElementById(`_fv_etextinput`);[`_fv_edraw`,`_fv_etext`,`_fv_eemoji`].forEach(e=>{document.getElementById(e).addEventListener(`click`,function(){document.querySelectorAll(`#_fv_etbar ._fvet`).forEach(e=>e.classList.remove(`active`)),this.classList.add(`active`),j={_fv_edraw:`draw`,_fv_etext:`text`,_fv_eemoji:`emoji`}[e],o.style.display=`none`,P=!1,j===`emoji`&&B()})});function s(t){let n=e.getBoundingClientRect(),r=t.touches?t.touches[0]:t;return{x:(r.clientX-n.left)*(e.width/n.width),y:(r.clientY-n.top)*(e.height/n.height)}}let c=null;e.addEventListener(`mousedown`,e=>{if(j===`draw`){N=!0;let n=s(e);c={type:`draw`,color:t.value,size:+i.value,pts:[n]}}else if(j===`text`){let n=s(e);o.style.display=`block`,o.style.left=e.clientX+`px`,o.style.top=e.clientY-20+`px`,o.style.color=t.value,o.style.fontSize=a.value+`px`,o.focus(),P=!0,o._canvasX=n.x,o._canvasY=n.y}}),e.addEventListener(`mousemove`,n=>{if(!N||j!==`draw`)return;let r=s(n),a=e.getContext(`2d`);c.pts.push(r),a.strokeStyle=t.value,a.lineWidth=+i.value,a.lineCap=`round`,a.lineJoin=`round`,c.pts.length===2&&(a.beginPath(),a.moveTo(c.pts[0].x,c.pts[0].y)),a.lineTo(r.x,r.y),a.stroke()}),e.addEventListener(`mouseup`,()=>{j===`draw`&&N&&c&&(A.push(c),c=null),N=!1}),e.addEventListener(`touchstart`,e=>{if(e.preventDefault(),j===`draw`){let n=s(e);N=!0,c={type:`draw`,color:t.value,size:+i.value,pts:[n]}}},{passive:!1}),e.addEventListener(`touchmove`,n=>{if(n.preventDefault(),!N)return;let r=s(n);c.pts.push(r);let a=e.getContext(`2d`);a.strokeStyle=t.value,a.lineWidth=+i.value,a.lineCap=`round`,a.lineTo(r.x,r.y),a.stroke()},{passive:!1}),e.addEventListener(`touchend`,()=>{j===`draw`&&c&&(A.push(c),c=null),N=!1}),o.addEventListener(`keydown`,e=>{e.key===`Enter`&&!e.shiftKey&&(e.preventDefault(),l())}),o.addEventListener(`blur`,()=>{P&&l()});function l(){let e=o.value.trim();e&&o._canvasX!==void 0&&(A.push({type:`text`,text:e,color:t.value,size:+a.value,x:o._canvasX,y:o._canvasY}),L()),o.style.display=`none`,o.value=``,P=!1}document.getElementById(`_fv_eundo`).addEventListener(`click`,()=>{A.length&&(A.pop(),L())}),document.getElementById(`_fv_eclear`).addEventListener(`click`,()=>{A=[],L()}),document.getElementById(`_fv_ecancel`).addEventListener(`click`,()=>{document.getElementById(`_fv_edit`).style.display=`none`}),document.getElementById(`_fv_edone`).addEventListener(`click`,()=>{e.toBlob(e=>{if(!e){J(`Export failed`,`error`);return}let t=`edited_`+((n[r]||{}).filename||`image.png`);if(confirm(`Send edited image to chat? (Cancel = Download only)`))Y(new File([e],t,{type:`image/png`})).then(n=>{window.currentAttachment={type:`image`,url:n,filename:t,size:e.size},typeof window.setAttachmentPreview==`function`&&window.setAttachmentPreview(),J(`Edited image ready — tap Send`),document.getElementById(`_fv_edit`).style.display=`none`,C()}).catch(e=>J(`Upload failed: `+e.message,`error`));else{var i=URL.createObjectURL(e),a=document.createElement(`a`);a.href=i,a.download=t,a.click(),setTimeout(function(){try{URL.revokeObjectURL(i)}catch{}},1e3),typeof showToast==`function`&&showToast(`File saved to Downloads`,`success`),document.getElementById(`_fv_edit`).style.display=`none`}},`image/png`)})}function B(){let e=document.getElementById(`_fv_epicker`);if(e){e.remove();return}let t=document.createElement(`div`);t.id=`_fv_epicker`,t.style.cssText=`position:absolute;bottom:60px;left:50%;transform:translateX(-50%);background:#1e2030;border-radius:14px;padding:12px;display:flex;flex-wrap:wrap;gap:6px;z-index:30;max-width:280px;box-shadow:0 8px 32px rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.1);`,F.forEach(e=>{let n=document.createElement(`button`);n.textContent=e,n.style.cssText=`background:none;border:none;font-size:26px;cursor:pointer;padding:2px;`,n.addEventListener(`click`,()=>{let n=document.getElementById(`_fv_ecanvas`);A.push({type:`emoji`,emoji:e,size:48,x:n.width/2,y:n.height/2}),L(),t.remove()}),t.appendChild(n)}),document.getElementById(`_fv_edit`).appendChild(t)}let V=null;function H(e){let t=document.getElementById(`_fv_sticker`),n=document.getElementById(`_fv_stickercanvas`);t.style.display=`flex`;let r=new Image;r.crossOrigin=`anonymous`,r.onload=()=>{V=r;let e=Math.min(window.innerWidth-32,window.innerHeight-140,380);n.width=e,n.height=e,U()},r.src=e}function U(){let e=document.getElementById(`_fv_stickercanvas`),t=e.getContext(`2d`),n=e.width;t.clearRect(0,0,n,n);let r=Math.min(V.width,V.height),i=(V.width-r)/2,a=(V.height-r)/2;t.save(),t.beginPath(),t.roundRect(0,0,n,n,n*.15),t.clip(),t.drawImage(V,i,a,r,r,0,0,n,n),t.restore(),t.strokeStyle=`rgba(255,255,255,0.35)`,t.lineWidth=2,t.beginPath(),t.roundRect(1,1,n-2,n-2,n*.15),t.stroke()}function W(){document.getElementById(`_fv_stk_cancel`).addEventListener(`click`,()=>{document.getElementById(`_fv_sticker`).style.display=`none`}),document.getElementById(`_fv_stk_dl`).addEventListener(`click`,function(){document.getElementById(`_fv_stickercanvas`).toBlob(function(e){if(!e){J(`Export failed`,`error`);return}var t=URL.createObjectURL(e),n=document.createElement(`a`);n.href=t,n.download=`sticker.png`,n.click(),setTimeout(function(){try{URL.revokeObjectURL(t)}catch{}},1e3),typeof showToast==`function`&&showToast(`Sticker saved to Downloads`,`success`),document.getElementById(`_fv_sticker`).style.display=`none`},`image/png`)}),document.getElementById(`_fv_stk_send`).addEventListener(`click`,()=>{document.getElementById(`_fv_stickercanvas`).toBlob(e=>{if(!e){J(`Export failed`,`error`);return}Y(new File([e],`sticker.png`,{type:`image/png`})).then(t=>{window.currentAttachment={type:`image`,url:t,filename:`sticker.png`,size:e.size},typeof window.setAttachmentPreview==`function`&&window.setAttachmentPreview(),J(`Sticker ready — tap Send`),document.getElementById(`_fv_sticker`).style.display=`none`,C()}).catch(e=>J(`Upload failed: `+e.message,`error`))},`image/png`)})}function G(e){let t=(e||``).toLowerCase().split(`?`)[0].split(`#`)[0];return/\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)$/.test(t)?`image`:/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/.test(t)?`video`:t.endsWith(`.pdf`)?`pdf`:/\.(doc|docx|xls|xlsx|ppt|pptx)$/.test(t)?`office`:/\.(txt|csv)$/.test(t)?`text`:`file`}function K(e){try{return decodeURIComponent((e||``).split(`?`)[0].split(`/`).pop())||`Media`}catch{return`Media`}}function q(e){let t=document.createElement(`textarea`);t.value=e,t.style.position=`fixed`,t.style.left=`-9999px`,t.setAttribute(`readonly`,``),document.body.appendChild(t),t.select();try{document.execCommand(`copy`),J(`Copied`)}catch{J(`Copy failed — select and copy manually`,`error`)}document.body.removeChild(t)}function J(e,t){App&&App.toast?App.toast(e,t):typeof window.showToast==`function`?window.showToast(e,t):window.__DEBUG__&&console.log(`[fixes] `+e)}document.addEventListener(`click`,function(e){let t=e.target.closest(`[data-preview-url]`);if(t){let n=t.dataset.previewUrl;if(!n)return;e.preventDefault(),e.stopPropagation();let r=t.dataset.filename||K(n),i=t.querySelector(`video`)||t.classList.contains(`video-attachment`)?`video`:t.querySelector(`img`)?`image`:G(n),a=null,o=null,s=t.closest(`.message[data-message-id]`);s&&(a=s.dataset.messageId);let c=t.closest(`[data-message-meta]`);if(c)try{o=JSON.parse(c.dataset.messageMeta),a=a||o.messageId}catch{}S(n,r,i,a,o);return}let n=e.target.closest(`.video-play-overlay`);if(n){e.preventDefault(),e.stopPropagation();let t=n.closest(`[data-preview-url]`);if(t&&t.dataset.previewUrl){S(t.dataset.previewUrl,t.dataset.filename||`Video`,`video`);return}let r=n.parentElement&&n.parentElement.querySelector(`video`);if(r){let e=r.currentSrc||r.src;e&&S(e,`Video`,`video`)}}},!0),window.addEventListener(`popstate`,()=>{let e=document.getElementById(`_fv`);e&&e.style.display!==`none`&&C()});async function Y(e,t,n){var r=window.storage||typeof firebase<`u`&&firebase.storage&&firebase.storage(),i=window.currentUser||App&&App.currentUser;if(!r)throw Error(`Firebase Storage not initialized`);var a=i?i.uid:`anonymous`,o=t||`chat_uploads`,s=(e.name||`file`).replace(/[^a-zA-Z0-9._-]/g,`_`),c=o+`/`+a+`/`+Date.now()+`_`+Math.random().toString(36).slice(2,8)+`_`+s,l=r.ref(c),u=l.put(e);return typeof n==`function`?u.on(`state_changed`,function(e){n(Math.round(e.bytesTransferred/e.totalBytes*100))}):u.on(`state_changed`,function(e){var t=Math.round(e.bytesTransferred/e.totalBytes*100);typeof J==`function`&&J(`Uploading… `+t+`%`,`info`)}),await u,await l.getDownloadURL()}window.uploadToCloudinary=Y,window.uploadDocument=Y,window.uploadRecordedMedia=Y,window.uploadToFirebaseStorage=Y,(function(){let e=`_fix_profile_style`;if(document.getElementById(e))return;let t=document.createElement(`style`);t.id=e,t.textContent=`
/* Fix: profile name & status always fill available width without hard caps */
.user-info > div:not(.user-avatar) {
  overflow: hidden !important;
  min-width: 0 !important;
  flex: 1 1 0 !important;
}
.user-name {
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.user-status-text {
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  display: block !important;
}
`,document.head.appendChild(t)})(),(function(){let e=window.getChatListPreviewText;typeof e==`function`&&(window.getChatListPreviewText=function(t,n){if(n===`user`)return``;let r=e.call(this,t,n);return/^[✓✔☑\u2713\u2714\u2611]+$/.test(r.trim())?``:r})})(),window.__DEBUG__&&console.log(`[fixes.js v5] Loaded — viewer + profile fix + tick fix.`)})()})),s=o()}))()}))();export{s as default};