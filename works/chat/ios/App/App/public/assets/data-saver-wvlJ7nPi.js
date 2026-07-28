import{t as e}from"./modulepreload-polyfill-1QPZNIo4.js";var t=e((()=>{(function(){let e=`nsl_data_saver_settings`,t={enabled:!1,wifi:{photos:!0,videos:!0,audio:!0,documents:!0},mobile:{photos:!0,videos:!1,audio:!1,documents:!1},roaming:{photos:!1,videos:!1,audio:!1,documents:!1}},n={_settings:null,init(){this._settings=this._load(),this._applyTheme()},_load(){try{let n=localStorage.getItem(e);return n?{...t,...JSON.parse(n)}:{...t}}catch{return{...t}}},_save(){try{localStorage.setItem(e,JSON.stringify(this._settings))}catch{}},_applyTheme(){this._settings.enabled?document.body.classList.add(`data-saver`):document.body.classList.remove(`data-saver`)},isEnabled(){return this._settings.enabled},getNetworkType(){let e=navigator.connection||navigator.mozConnection||navigator.webkitConnection;if(!e)return`wifi`;let t=e.effectiveType||e.type||`4g`;return t===`slow-2g`||t===`2g`||t===`3g`||e.saveData?`mobile`:`wifi`},shouldAutoDownload(e){if(!this._settings.enabled)return!0;let t=this.getNetworkType();return(this._settings[t]||this._settings.wifi)[e]!==!1},getSettings(){return{...this._settings}},updateSetting(e,t,n){this._settings[e]&&(this._settings[e][t]=!!n,this._save())},toggle(e){this._settings.enabled=!!e,this._save(),this._applyTheme()},openSettings(){let e=document.createElement(`div`);e.id=`data-saver-overlay`,e.style.cssText=`position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease`;let t=document.createElement(`div`);t.style.cssText=`background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;max-width:420px;width:92vw;max-height:80vh;overflow-y:auto;color:var(--on-surface)`;let n=this.getNetworkType(),r={wifi:`WiFi`,mobile:`Mobile Data`,roaming:`Roaming`},i=[`photos`,`videos`,`audio`,`documents`],a={photos:`image`,videos:`videocam`,audio:`audiotrack`,documents:`description`},o=``;for(let e of[`wifi`,`mobile`,`roaming`]){let t=``;for(let n of i){let r=this._settings[e][n]?`checked`:``;t+=`
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="material-symbols-outlined" style="font-size:16px;color:var(--on-surface-variant)">${a[n]}</span>
                <span style="font-size:13px;text-transform:capitalize">${n}</span>
              </div>
              <button class="ds-toggle-btn" data-network="${e}" data-media="${n}" data-checked="${r}"
                style="width:40px;height:22px;border-radius:11px;border:none;cursor:pointer;position:relative;transition:background 0.2s;${r?`background:var(--primary)`:`background:var(--outline-variant)`}">
                <span style="position:absolute;top:2px;left:${r?`20px`:`2px`};width:18px;height:18px;border-radius:50%;background:white;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>
              </button>
            </div>`}o+=`
          <div style="margin-bottom:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary)">${e===`wifi`?`wifi`:e===`mobile`?`signal_cellular_alt`:`roaming`}</span>
              <span style="font-size:13px;font-weight:600">${r[e]}</span>
              ${e===n?`<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--primary);color:var(--on-primary);font-weight:600">CURRENT</span>`:``}
            </div>
            ${t}
          </div>`}t.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;font-size:18px;font-weight:700">Data Saver</h3>
          <button onclick="document.getElementById('data-saver-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px;border-radius:12px;background:var(--surface-container-low);margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="material-symbols-outlined" style="font-size:22px;color:var(--primary)">data_saver_on</span>
            <div>
              <p style="margin:0;font-size:14px;font-weight:600">Data Saver Mode</p>
              <p style="margin:2px 0 0;font-size:11px;color:var(--on-surface-variant)">Control media auto-download per network</p>
            </div>
          </div>
          <button id="ds-master-toggle" style="width:48px;height:26px;border-radius:13px;border:none;cursor:pointer;position:relative;transition:background 0.2s;${this._settings.enabled?`background:var(--primary)`:`background:var(--outline-variant)`}">
            <span style="position:absolute;top:3px;left:${this._settings.enabled?`25px`:`3px`};width:20px;height:20px;border-radius:50%;background:white;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>
          </button>
        </div>
        <div id="ds-network-settings" style="${this._settings.enabled?``:`opacity:0.5;pointer-events:none`}">
          ${o}
        </div>`,e.appendChild(t),e.addEventListener(`click`,t=>{t.target===e&&e.remove()}),document.body.appendChild(e),document.getElementById(`ds-master-toggle`)?.addEventListener(`click`,()=>{this._settings.enabled=!this._settings.enabled,this._save(),this._applyTheme(),e.remove(),this.openSettings()}),t.querySelectorAll(`.ds-toggle-btn`).forEach(t=>{t.addEventListener(`click`,()=>{let n=t.dataset.network,r=t.dataset.media,i=t.dataset.checked===`checked`;this.updateSetting(n,r,!i),e.remove(),this.openSettings()})})}};window.DataSaver=n,document.addEventListener(`nsl:app-ready`,()=>{n.init()})})()}));export default t();