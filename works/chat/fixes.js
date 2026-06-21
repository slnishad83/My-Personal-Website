// ============================================================
// fixes.js  v4 — My-Personal-Website chat app
//
// WhatsApp-style fullscreen media viewer:
//   • Top bar  : filename + close button (solid, always visible)
//   • Stage    : image / video / doc / file (dark background)
//   • Bottom   : action bar BELOW the image (not overlapping)
//     — Forward, Star, Show in chat, Copy link, Download
//     — Edit, Rotate, Wallpaper, Sticker  (image only)
//     — Delete (submenu: for me / for everyone)
//   • Edit mode : draw, text, emoji, undo, done→send or download
//   • Sticker   : square crop → save or send
//   • CSS fully isolated — works identically in light AND dark mode
//
// <script src="fixes.js?v=4"></script>   (after app-init.js)
// ============================================================
(function () {
  "use strict";

  // ============================================================
  // 1. STYLES  — all scoped to #_fv, no app theme bleeds in
  // ============================================================
  function _injectStyles() {
    if (document.getElementById("_fv_style")) return;
    const S = `
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
  background: #0d0d0f;
  touch-action: none;
}

/* ── TOP BAR ─────────────────────────────────────────────── */
#_fv_bar {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  background: #1c1c28;
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
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: background .15s;
}
#_fv_x:hover { background: rgba(255,255,255,0.22); }

/* ── STAGE (image/video area) ────────────────────────────── */
#_fv_stage {
  flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden;
  background: #0d0d0f;
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
  background: #1c1c28;
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
#_fv_ecolor { width: 34px; height: 34px; border: 2px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer; padding: 0; flex-shrink: 0; }
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
`;
    const el = document.createElement("style");
    el.id = "_fv_style";
    el.textContent = S;
    document.head.appendChild(el);
  }

  // ============================================================
  // 2. BUILD DOM
  // ============================================================
  function _buildViewer() {
    if (document.getElementById("_fv")) return;
    _injectStyles();
    const d = document.createElement("div");
    d.id = "_fv";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-modal", "true");
    d.innerHTML =
      /* TOP BAR */
      `<div id="_fv_bar">
        <span id="_fv_name"></span>
        <button id="_fv_x" aria-label="Close">&#10005;</button>
      </div>` +
      /* STAGE */
      `<div id="_fv_stage">
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
          <textarea id="_fv_etextinput" rows="1" placeholder="Type text\u2026"></textarea>
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
      </div>` +
      /* ACTION BAR — below the stage, never overlapping */
      `<div id="_fv_abar">
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
      </div>`;
    document.body.appendChild(d);
    _bindViewerEvents();
    _bindActionBar();
    _bindEditMode();
    _bindStickerMode();
  }

  // ============================================================
  // 3. STATE
  // ============================================================
  let _items = [], _idx = 0, _rotDeg = 0, _zoom = 1, _panX = 0, _panY = 0;
  let _isDragging = false, _dragStartX = 0, _dragStartY = 0, _dragBasePanX = 0, _dragBasePanY = 0;
  let _pinchStartDist = 0, _pinchStartZoom = 1, _swipeStartX = 0, _swipeStartY = 0;

  // ============================================================
  // 4. OPEN
  // ============================================================
  function _openViewer(url, filename, typeHint, msgId, msgMeta) {
    _buildViewer();
    const seen = {};
    _items = [];
    document.querySelectorAll("[data-preview-url]").forEach(el => {
      const u = el.dataset.previewUrl; if (!u || seen[u]) return; seen[u] = true;
      const f = el.dataset.filename || _basename(u);
      const hasV = el.querySelector("video") || el.classList.contains("video-attachment");
      const hasI = el.querySelector("img");
      const t = hasV ? "video" : hasI ? "image" : _typeOf(u);
      let id = null, meta = null;
      const msgEl = el.closest(".message[data-message-id]");
      if (msgEl) id = msgEl.dataset.messageId;
      const wrapEl = el.closest("[data-message-meta]");
      if (wrapEl) { try { meta = JSON.parse(wrapEl.dataset.messageMeta); id = id || meta.messageId; } catch(_){} }
      _items.push({ url: u, filename: f, type: t, messageId: id, meta });
    });
    if (!seen[url]) _items.unshift({ url, filename: filename || _basename(url), type: typeHint || _typeOf(url), messageId: msgId || null, meta: msgMeta || null });
    _idx = _items.findIndex(i => i.url === url);
    if (_idx < 0) _idx = 0;
    if (msgId)  _items[_idx].messageId = msgId;
    if (msgMeta) _items[_idx].meta = msgMeta;
    _rotDeg = 0; _zoom = 1; _panX = 0; _panY = 0;
    _renderSlide();
    document.getElementById("_fv").style.display = "flex";
    document.body.style.overflow = "hidden";
    document.getElementById("_fv_delmenu").style.display = "none";
  }

  // ============================================================
  // 5. CLOSE
  // ============================================================
  function _closeViewer() {
    const ov = document.getElementById("_fv"); if (!ov) return;
    const vid = document.getElementById("_fv_video");
    if (vid) { try { vid.pause(); } catch(_){} vid.src = ""; }
    const doc = document.getElementById("_fv_doc"); if (doc) doc.src = "about:blank";
    ov.style.display = "none";
    document.body.style.overflow = "";
    ["_fv_edit","_fv_sticker","_fv_delmenu"].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = "none"; });
  }

  // ============================================================
  // 6. RENDER SLIDE
  // ============================================================
  function _renderSlide() {
    const item = _items[_idx] || {};
    const url = item.url || "", fname = item.filename || _basename(url), type = item.type || _typeOf(url);
    document.getElementById("_fv_name").textContent = fname;

    ["_fv_img","_fv_video","_fv_doc","_fv_txt","_fv_file"].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = "none";
    });
    _rotDeg = 0; _zoom = 1; _panX = 0; _panY = 0;
    document.querySelectorAll("._img_act").forEach(b => b.style.display = "none");

    if (type === "image") {
      const img = document.getElementById("_fv_img");
      img.src = url; img.style.display = "block";
      img.style.transform = ""; img.style.cursor = "zoom-in";
      document.querySelectorAll("._img_act").forEach(b => b.style.display = "flex");
    } else if (type === "video") {
      const vid = document.getElementById("_fv_video");
      vid.src = url; vid.style.display = "block";
    } else if (type === "pdf" || type === "office") {
      const iframe = document.getElementById("_fv_doc");
      iframe.src = "https://docs.google.com/viewer?url=" + encodeURIComponent(url) + "&embedded=true";
      iframe.style.display = "block";
    } else if (type === "text") {
      const txtEl = document.getElementById("_fv_txt"); txtEl.style.display = "block"; txtEl.textContent = "Loading\u2026";
      fetch(url).then(r => r.text()).then(t => { txtEl.textContent = t; }).catch(() => { txtEl.textContent = "Could not load. Use Download."; });
    } else {
      const fp = document.getElementById("_fv_file"); fp.style.display = "flex";
      document.getElementById("_fv_file_name").textContent = fname;
      document.getElementById("_fv_file_btn").href = url;
      const fdl = document.getElementById("_fv_file_dl2"); fdl.href = url; fdl.setAttribute("download", fname);
    }

    // Download button
    const dlBtn = document.getElementById("_fva_dl");
    if (dlBtn) dlBtn.onclick = () => { const a = document.createElement("a"); a.href = url; a.download = fname; a.target = "_blank"; a.click(); };

    // Nav
    const mediaItems = _items.filter(i => i.type === "image" || i.type === "video");
    const showNav = (type === "image" || type === "video") && mediaItems.length > 1;
    document.getElementById("_fv_prev").style.display = showNav ? "flex" : "none";
    document.getElementById("_fv_next").style.display = showNav ? "flex" : "none";
    const ctr = document.getElementById("_fv_counter"); ctr.style.display = showNav ? "block" : "none";
    if (showNav) ctr.textContent = (_idx + 1) + " / " + _items.length;
  }

  function _navigate(delta) {
    const vid = document.getElementById("_fv_video"); if (vid) { try { vid.pause(); } catch(_){} vid.src = ""; }
    _idx = ((_idx + delta) + _items.length) % _items.length;
    _rotDeg = 0; _zoom = 1; _panX = 0; _panY = 0;
    document.getElementById("_fv_delmenu").style.display = "none";
    _renderSlide();
  }

  // ============================================================
  // 7. VIEWER EVENTS (zoom, pan, swipe, keyboard)
  // ============================================================
  function _bindViewerEvents() {
    const ov  = document.getElementById("_fv");
    const img = document.getElementById("_fv_img");

    document.getElementById("_fv_x").addEventListener("click", _closeViewer);
    document.getElementById("_fv_prev").addEventListener("click", () => _navigate(-1));
    document.getElementById("_fv_next").addEventListener("click", () => _navigate(1));

    ov.addEventListener("click", e => { if (e.target === ov || e.target.id === "_fv_stage") _closeViewer(); });

    document.addEventListener("keydown", e => {
      const v = document.getElementById("_fv"); if (!v || v.style.display === "none") return;
      if (e.key === "Escape") _closeViewer();
      if (e.key === "ArrowLeft")  _navigate(-1);
      if (e.key === "ArrowRight") _navigate(1);
    });

    img.addEventListener("wheel", e => { e.preventDefault(); _zoom = Math.max(1, Math.min(6, _zoom + (e.deltaY > 0 ? -0.2 : 0.2))); if (_zoom <= 1) { _panX = 0; _panY = 0; } _applyImgT(); }, { passive: false });

    img.addEventListener("mousedown", e => { if (_zoom <= 1) return; e.preventDefault(); _isDragging = true; _dragStartX = e.clientX; _dragStartY = e.clientY; _dragBasePanX = _panX; _dragBasePanY = _panY; img.style.cursor = "grabbing"; });
    document.addEventListener("mousemove", e => { if (!_isDragging) return; _panX = _dragBasePanX + (e.clientX - _dragStartX) / _zoom; _panY = _dragBasePanY + (e.clientY - _dragStartY) / _zoom; _applyImgT(); });
    document.addEventListener("mouseup", () => { if (!_isDragging) return; _isDragging = false; img.style.cursor = _zoom > 1 ? "grab" : "zoom-in"; });

    ov.addEventListener("touchstart", e => { if (e.touches.length === 2) { _pinchStartDist = _tdist(e.touches); _pinchStartZoom = _zoom; } else if (e.touches.length === 1) { _swipeStartX = e.touches[0].clientX; _swipeStartY = e.touches[0].clientY; if (_zoom > 1) { _isDragging = true; _dragStartX = e.touches[0].clientX; _dragStartY = e.touches[0].clientY; _dragBasePanX = _panX; _dragBasePanY = _panY; } } }, { passive: true });
    ov.addEventListener("touchmove", e => { if (e.touches.length === 2) { e.preventDefault(); _zoom = Math.max(1, Math.min(6, _pinchStartZoom * (_tdist(e.touches) / _pinchStartDist))); if (_zoom <= 1) { _panX = 0; _panY = 0; } _applyImgT(); } else if (e.touches.length === 1 && _isDragging && _zoom > 1) { _panX = _dragBasePanX + (e.touches[0].clientX - _dragStartX) / _zoom; _panY = _dragBasePanY + (e.touches[0].clientY - _dragStartY) / _zoom; _applyImgT(); } }, { passive: false });
    ov.addEventListener("touchend", e => { _isDragging = false; if (_zoom <= 1 && e.changedTouches.length === 1) { const dx = e.changedTouches[0].clientX - _swipeStartX, dy = e.changedTouches[0].clientY - _swipeStartY; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) _navigate(dx < 0 ? 1 : -1); } }, { passive: true });
  }

  function _applyImgT() { const img = document.getElementById("_fv_img"); if (!img) return; img.style.transform = `rotate(${_rotDeg}deg) scale(${_zoom}) translate(${_panX}px,${_panY}px)`; img.style.cursor = _zoom > 1 ? "grab" : "zoom-in"; }
  function _tdist(t) { const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx*dx+dy*dy); }

  // ============================================================
  // 8. ACTION BAR HANDLERS
  // ============================================================
  function _bindActionBar() {
    // Forward
    document.getElementById("_fva_forward").addEventListener("click", () => {
      const item = _items[_idx]; if (!item) return;
      _closeViewer();
      const att = { type: item.type, url: item.url, filename: item.filename };
      if (item.messageId && typeof window.openForwardModal === "function") window.openForwardModal(item.messageId, item.meta || {});
      else if (typeof window.openForwardModalForMedia === "function") window.openForwardModalForMedia(att);
      else _toast("Forward not available in this context");
    });

    // Star
    document.getElementById("_fva_star").addEventListener("click", () => {
      const item = _items[_idx]; if (!item) return;
      if (item.messageId && typeof window.starMessage === "function")
        window.starMessage(item.messageId, item.meta || { text: "", attachment: { type: item.type, url: item.url, filename: item.filename } });
      else _toast("Cannot star — message info unavailable");
    });

    // Show in chat
    document.getElementById("_fva_show").addEventListener("click", () => {
      const item = _items[_idx]; if (!item) return;
      if (!item.messageId) { _toast("Message location unknown"); return; }
      _closeViewer();
      setTimeout(() => {
        if (typeof window.scrollToMessage === "function") window.scrollToMessage(item.messageId);
        else { const el = document.querySelector(`.message[data-message-id="${CSS.escape(item.messageId)}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }
      }, 120);
    });

    // Copy link
    document.getElementById("_fva_copy").addEventListener("click", () => {
      const url = (_items[_idx] || {}).url; if (!url) return;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => _toast("Link copied"));
      else { const ta = document.createElement("textarea"); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); _toast("Link copied"); }
    });

    // Rotate
    document.getElementById("_fva_rotate").addEventListener("click", () => {
      const img = document.getElementById("_fv_img"); if (!img || img.style.display === "none") return;
      _rotDeg = (_rotDeg + 90) % 360; _applyImgT();
    });

    // Set as wallpaper
    document.getElementById("_fva_wallpaper").addEventListener("click", () => {
      const item = _items[_idx]; if (!item || item.type !== "image") return;
      const chatId = window.currentChat && window.currentChat.id;
      if (!chatId) { _toast("Open a chat first"); return; }
      if (window.chatWallpapers) window.chatWallpapers[chatId] = item.url;
      if (typeof window.saveWallpaperToStorage === "function") window.saveWallpaperToStorage();
      if (typeof window.applyCurrentChatWallpaper === "function") window.applyCurrentChatWallpaper();
      else { const area = document.getElementById("messagesArea"); if (area) { area.style.backgroundImage = `url(${item.url})`; area.style.backgroundSize = "cover"; area.style.backgroundPosition = "center"; } }
      _closeViewer(); _toast("Wallpaper set for this chat");
    });

    // Edit
    document.getElementById("_fva_edit").addEventListener("click", () => {
      const img = document.getElementById("_fv_img"); if (!img || img.style.display === "none") return;
      _openEditMode(img.src);
    });

    // Sticker
    document.getElementById("_fva_sticker").addEventListener("click", () => {
      const img = document.getElementById("_fv_img"); if (!img || img.style.display === "none") return;
      _openStickerMode(img.src);
    });

    // Delete — show submenu
    document.getElementById("_fva_delete").addEventListener("click", () => {
      const dm = document.getElementById("_fv_delmenu"); dm.style.display = dm.style.display === "block" ? "none" : "block";
    });
    document.getElementById("_fv_del_cancel").addEventListener("click", () => { document.getElementById("_fv_delmenu").style.display = "none"; });
    document.getElementById("_fv_del_me").addEventListener("click", () => {
      const item = _items[_idx]; if (!item) return;
      if (!item.messageId) { _toast("Cannot delete — message info unavailable"); return; }
      document.getElementById("_fv_delmenu").style.display = "none"; _closeViewer();
      if (typeof window.deleteMessageForMe === "function")
        window.deleteMessageForMe(item.messageId).then(() => _toast("Deleted for you")).catch(() => _toast("Delete failed", "error"));
      else _toast("Delete not available");
    });
    document.getElementById("_fv_del_all").addEventListener("click", () => {
      const item = _items[_idx]; if (!item) return;
      if (!item.messageId) { _toast("Cannot delete — message info unavailable"); return; }
      document.getElementById("_fv_delmenu").style.display = "none"; _closeViewer();
      if (typeof window.deleteMessageForEveryone === "function")
        window.deleteMessageForEveryone(item.messageId, item.meta || null).then(() => _toast("Deleted for everyone")).catch(() => _toast("Delete failed", "error"));
      else _toast("Delete not available");
    });
  }

  // ============================================================
  // 9. EDIT MODE
  // ============================================================
  let _editHistory = [], _editMode = "draw", _editImg = null, _editDrawing = false, _editTextActive = false;
  const _EMOJIS = ["😀","😂","❤️","🔥","👍","😍","🎉","😭","😎","🤔","💯","🙏","✨","💪","🤣","🥳","😅","😊","🫶","⭐"];

  function _openEditMode(src) {
    const overlay = document.getElementById("_fv_edit"), canvas = document.getElementById("_fv_ecanvas");
    overlay.style.display = "flex";
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      _editImg = img;
      const maxW = window.innerWidth, maxH = window.innerHeight - 130;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      _editHistory = []; _editRedraw();
    };
    img.src = src;
  }

  function _editRedraw() {
    const canvas = document.getElementById("_fv_ecanvas"), ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (_editImg) ctx.drawImage(_editImg, 0, 0, canvas.width, canvas.height);
    _editHistory.forEach(step => _editReplayStep(ctx, step));
  }

  function _editReplayStep(ctx, step) {
    if (step.type === "draw") {
      ctx.strokeStyle = step.color; ctx.lineWidth = step.size; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); step.pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.stroke();
    } else if (step.type === "text") {
      ctx.font = `${step.size}px sans-serif`; ctx.fillStyle = step.color;
      ctx.shadowColor = "#000"; ctx.shadowBlur = 5; ctx.fillText(step.text, step.x, step.y); ctx.shadowBlur = 0;
    } else if (step.type === "emoji") {
      ctx.font = `${step.size}px sans-serif`; ctx.fillText(step.emoji, step.x, step.y);
    }
  }

  function _bindEditMode() {
    const canvas = document.getElementById("_fv_ecanvas");
    const colorEl = document.getElementById("_fv_ecolor"), sizeEl = document.getElementById("_fv_esize"), fontEl = document.getElementById("_fv_efont");
    const textInput = document.getElementById("_fv_etextinput");

    ["_fv_edraw","_fv_etext","_fv_eemoji"].forEach(id => {
      document.getElementById(id).addEventListener("click", function () {
        document.querySelectorAll("#_fv_etbar ._fvet").forEach(b => b.classList.remove("active")); this.classList.add("active");
        _editMode = { "_fv_edraw": "draw", "_fv_etext": "text", "_fv_eemoji": "emoji" }[id];
        textInput.style.display = "none"; _editTextActive = false;
        if (_editMode === "emoji") _showEmojiPicker();
      });
    });

    function _getPos(e) {
      const r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e;
      return { x: (t.clientX - r.left) * (canvas.width / r.width), y: (t.clientY - r.top) * (canvas.height / r.height) };
    }

    let _curStroke = null;
    canvas.addEventListener("mousedown", e => {
      if (_editMode === "draw") { _editDrawing = true; const p = _getPos(e); _curStroke = { type:"draw", color:colorEl.value, size:+sizeEl.value, pts:[p] }; }
      else if (_editMode === "text") {
        const p2 = _getPos(e); textInput.style.display = "block"; textInput.style.left = e.clientX+"px"; textInput.style.top = (e.clientY-20)+"px";
        textInput.style.color = colorEl.value; textInput.style.fontSize = fontEl.value+"px"; textInput.focus();
        _editTextActive = true; textInput._canvasX = p2.x; textInput._canvasY = p2.y;
      }
    });
    canvas.addEventListener("mousemove", e => {
      if (!_editDrawing || _editMode !== "draw") return;
      const p = _getPos(e), ctx = canvas.getContext("2d");
      _curStroke.pts.push(p); ctx.strokeStyle = colorEl.value; ctx.lineWidth = +sizeEl.value; ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (_curStroke.pts.length === 2) { ctx.beginPath(); ctx.moveTo(_curStroke.pts[0].x, _curStroke.pts[0].y); } ctx.lineTo(p.x, p.y); ctx.stroke();
    });
    canvas.addEventListener("mouseup", () => { if (_editMode === "draw" && _editDrawing && _curStroke) { _editHistory.push(_curStroke); _curStroke = null; } _editDrawing = false; });

    canvas.addEventListener("touchstart", e => { e.preventDefault(); if (_editMode === "draw") { const p = _getPos(e); _editDrawing = true; _curStroke = { type:"draw", color:colorEl.value, size:+sizeEl.value, pts:[p] }; } }, { passive:false });
    canvas.addEventListener("touchmove", e => { e.preventDefault(); if (!_editDrawing) return; const p = _getPos(e); _curStroke.pts.push(p); const ctx = canvas.getContext("2d"); ctx.strokeStyle = colorEl.value; ctx.lineWidth = +sizeEl.value; ctx.lineCap = "round"; ctx.lineTo(p.x,p.y); ctx.stroke(); }, { passive:false });
    canvas.addEventListener("touchend", () => { if (_editMode === "draw" && _curStroke) { _editHistory.push(_curStroke); _curStroke = null; } _editDrawing = false; });

    textInput.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); _commitText(); } });
    textInput.addEventListener("blur", () => { if (_editTextActive) _commitText(); });
    function _commitText() {
      const txt = textInput.value.trim();
      if (txt && textInput._canvasX !== undefined) { _editHistory.push({ type:"text", text:txt, color:colorEl.value, size:+fontEl.value, x:textInput._canvasX, y:textInput._canvasY }); _editRedraw(); }
      textInput.style.display = "none"; textInput.value = ""; _editTextActive = false;
    }

    document.getElementById("_fv_eundo").addEventListener("click", () => { if (_editHistory.length) { _editHistory.pop(); _editRedraw(); } });
    document.getElementById("_fv_eclear").addEventListener("click", () => { _editHistory = []; _editRedraw(); });
    document.getElementById("_fv_ecancel").addEventListener("click", () => { document.getElementById("_fv_edit").style.display = "none"; });
    document.getElementById("_fv_edone").addEventListener("click", () => {
      canvas.toBlob(blob => {
        if (!blob) { _toast("Export failed", "error"); return; }
        const item = _items[_idx] || {}, fname = "edited_" + (item.filename || "image.png");
        if (confirm("Send edited image to chat? (Cancel = Download only)")) {
          const file = new File([blob], fname, { type:"image/png" });
          _uploadToStorage(file).then(url => {
            window.currentAttachment = { type:"image", url, filename:fname, size:blob.size };
            if (typeof window.setAttachmentPreview === "function") window.setAttachmentPreview();
            _toast("Edited image ready — tap Send"); document.getElementById("_fv_edit").style.display = "none"; _closeViewer();
          }).catch(err => _toast("Upload failed: " + err.message, "error"));
        } else {
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fname; a.click();
          document.getElementById("_fv_edit").style.display = "none";
        }
      }, "image/png");
    });
  }

  function _showEmojiPicker() {
    const existing = document.getElementById("_fv_epicker"); if (existing) { existing.remove(); return; }
    const picker = document.createElement("div"); picker.id = "_fv_epicker";
    picker.style.cssText = "position:absolute;bottom:60px;left:50%;transform:translateX(-50%);background:#1e2030;border-radius:14px;padding:12px;display:flex;flex-wrap:wrap;gap:6px;z-index:30;max-width:280px;box-shadow:0 8px 32px rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.1);";
    _EMOJIS.forEach(em => {
      const b = document.createElement("button"); b.textContent = em; b.style.cssText = "background:none;border:none;font-size:26px;cursor:pointer;padding:2px;";
      b.addEventListener("click", () => {
        const canvas = document.getElementById("_fv_ecanvas");
        _editHistory.push({ type:"emoji", emoji:em, size:48, x:canvas.width/2, y:canvas.height/2 });
        _editRedraw(); picker.remove();
      });
      picker.appendChild(b);
    });
    document.getElementById("_fv_edit").appendChild(picker);
  }

  // ============================================================
  // 10. STICKER MODE
  // ============================================================
  let _stkImg = null;

  function _openStickerMode(src) {
    const overlay = document.getElementById("_fv_sticker"), canvas = document.getElementById("_fv_stickercanvas");
    overlay.style.display = "flex";
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      _stkImg = img;
      const size = Math.min(window.innerWidth - 32, window.innerHeight - 140, 380);
      canvas.width = size; canvas.height = size;
      _stkDraw();
    };
    img.src = src;
  }

  function _stkDraw() {
    const canvas = document.getElementById("_fv_stickercanvas"), ctx = canvas.getContext("2d"), sz = canvas.width;
    ctx.clearRect(0, 0, sz, sz);
    const sq = Math.min(_stkImg.width, _stkImg.height);
    const sx = (_stkImg.width - sq) / 2, sy = (_stkImg.height - sq) / 2;
    ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, sz, sz, sz * 0.15); ctx.clip();
    ctx.drawImage(_stkImg, sx, sy, sq, sq, 0, 0, sz, sz); ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(1, 1, sz-2, sz-2, sz*0.15); ctx.stroke();
  }

  function _bindStickerMode() {
    document.getElementById("_fv_stk_cancel").addEventListener("click", () => { document.getElementById("_fv_sticker").style.display = "none"; });
    document.getElementById("_fv_stk_dl").addEventListener("click", () => {
      document.getElementById("_fv_stickercanvas").toBlob(blob => {
        if (!blob) { _toast("Export failed", "error"); return; }
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sticker.png"; a.click();
        document.getElementById("_fv_sticker").style.display = "none";
      }, "image/png");
    });
    document.getElementById("_fv_stk_send").addEventListener("click", () => {
      document.getElementById("_fv_stickercanvas").toBlob(blob => {
        if (!blob) { _toast("Export failed", "error"); return; }
        const file = new File([blob], "sticker.png", { type:"image/png" });
        _uploadToStorage(file).then(url => {
          window.currentAttachment = { type:"image", url, filename:"sticker.png", size:blob.size };
          if (typeof window.setAttachmentPreview === "function") window.setAttachmentPreview();
          _toast("Sticker ready — tap Send"); document.getElementById("_fv_sticker").style.display = "none"; _closeViewer();
        }).catch(err => _toast("Upload failed: " + err.message, "error"));
      }, "image/png");
    });
  }

  // ============================================================
  // 11. TYPE HELPERS
  // ============================================================
  function _typeOf(url) {
    const u = (url || "").toLowerCase().split("?")[0].split("#")[0];
    if (/\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)$/.test(u)) return "image";
    if (/\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/.test(u)) return "video";
    if (u.endsWith(".pdf")) return "pdf";
    if (/\.(doc|docx|xls|xlsx|ppt|pptx)$/.test(u)) return "office";
    if (/\.(txt|csv)$/.test(u)) return "text";
    return "file";
  }
  function _basename(url) {
    try { return decodeURIComponent((url || "").split("?")[0].split("/").pop()) || "Media"; } catch(_) { return "Media"; }
  }
  function _toast(msg, type) {
    if (typeof window.showToast === "function") window.showToast(msg, type || "success");
    else console.log("[fixes] " + msg);
  }

  // ============================================================
  // 12. EVENT DELEGATION — capture phase fires before any <a href>
  // ============================================================
  document.addEventListener("click", function (e) {
    const el = e.target.closest("[data-preview-url]");
    if (el) {
      const url = el.dataset.previewUrl; if (!url) return;
      e.preventDefault(); e.stopPropagation();
      const fname = el.dataset.filename || _basename(url);
      const type  = el.querySelector("video") || el.classList.contains("video-attachment") ? "video"
                  : el.querySelector("img") ? "image" : _typeOf(url);
      let msgId = null, msgMeta = null;
      const msgEl = el.closest(".message[data-message-id]"); if (msgEl) msgId = msgEl.dataset.messageId;
      const wrapEl = el.closest("[data-message-meta]"); if (wrapEl) { try { msgMeta = JSON.parse(wrapEl.dataset.messageMeta); msgId = msgId || msgMeta.messageId; } catch(_){} }
      _openViewer(url, fname, type, msgId, msgMeta);
      return;
    }
    const pb = e.target.closest(".video-play-overlay");
    if (pb) {
      e.preventDefault(); e.stopPropagation();
      const wrap = pb.closest("[data-preview-url]");
      if (wrap && wrap.dataset.previewUrl) { _openViewer(wrap.dataset.previewUrl, wrap.dataset.filename || "Video", "video"); return; }
      const vid = pb.parentElement && pb.parentElement.querySelector("video");
      if (vid) { const s = vid.currentSrc || vid.src; if (s) _openViewer(s, "Video", "video"); }
    }
  }, true);

  window.addEventListener("popstate", () => { const ov = document.getElementById("_fv"); if (ov && ov.style.display !== "none") _closeViewer(); });

  // ============================================================
  // 13. FIREBASE STORAGE UPLOAD (replaces Cloudinary)
  // ============================================================
  async function _uploadToStorage(file) {
    const s = window.storage, user = window.currentUser;
    if (!s || !user) throw new Error("Firebase Storage not ready");
    const safe = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `chat_uploads/${user.uid}/${Date.now()}_${Math.random().toString(36).slice(2,8)}_${safe}`;
    const ref = s.ref(path), task = ref.put(file);
    task.on("state_changed", snap => _toast("Uploading\u2026 " + Math.round(snap.bytesTransferred / snap.totalBytes * 100) + "%", "info"));
    await task;
    return await ref.getDownloadURL();
  }

  window.uploadToCloudinary  = _uploadToStorage;
  window.uploadDocument      = _uploadToStorage;
  window.uploadRecordedMedia = _uploadToStorage;

  console.log("[fixes.js v4] Loaded — WhatsApp-style viewer ready.");
})();
