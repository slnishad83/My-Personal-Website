// ============================================================
// fixes.js  v3 — My-Personal-Website chat app
//
// Features:
//   1. Self-contained fullscreen viewer (image + video + doc + file)
//   2. WhatsApp-style action bar: Forward, Star, Delete, Show in chat,
//      Rotate, Set as wallpaper, Create sticker, Edit, Copy link, Download
//   3. Canvas image editor: Draw, Text, Emoji, Crop, Rotate
//   4. File attachment sending via Firebase Storage
//
// Add after app-init.js in index.html:
//   <script src="fixes.js?v=3"></script>
// ============================================================

(function () {
  "use strict";

  // ============================================================
  // STYLES
  // ============================================================
  function _injectStyles() {
    if (document.getElementById("_fv_style")) return;
    var s = document.createElement("style");
    s.id = "_fv_style";
    s.textContent = [
      /* overlay */
      "#_fv{position:fixed;inset:0;z-index:2147483647;background:#000;display:none;flex-direction:column;touch-action:none;}",
      /* top bar */
      "#_fv_bar{display:flex;align-items:center;gap:8px;padding:8px 12px;",
      "background:linear-gradient(rgba(0,0,0,.8),transparent);flex-shrink:0;position:absolute;top:0;left:0;right:0;z-index:3;}",
      "#_fv_name{color:#fff;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}",
      "#_fv_x{background:none;border:none;color:#fff;font-size:28px;cursor:pointer;padding:0 4px;line-height:1;flex-shrink:0;}",
      /* stage */
      "#_fv_stage{flex:1;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;}",
      "#_fv_img{max-width:100%;max-height:100%;object-fit:contain;display:none;user-select:none;transform-origin:center center;}",
      "#_fv_video{max-width:100%;max-height:100%;display:none;outline:none;background:#000;}",
      "#_fv_doc{flex:1;width:100%;border:none;display:none;position:absolute;inset:0;height:100%;}",
      "#_fv_txt{position:absolute;inset:0;overflow:auto;padding:20px 24px;color:#e0e0e0;",
      "font-family:monospace;font-size:13px;white-space:pre-wrap;word-break:break-all;display:none;}",
      "#_fv_file{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;",
      "justify-content:center;color:#fff;gap:16px;padding:32px;text-align:center;}",
      "#_fv_file_icon{font-size:72px;line-height:1;}",
      "#_fv_file_name{font-size:17px;font-weight:500;max-width:80%;word-break:break-word;}",
      "#_fv_file_btn{background:#4fc3f7;color:#000;padding:11px 28px;border-radius:24px;text-decoration:none;font-weight:700;font-size:15px;}",
      "#_fv_file_dl2{color:#4fc3f7;font-size:14px;text-decoration:none;}",
      /* nav arrows */
      "#_fv_prev,#_fv_next{position:absolute;top:50%;transform:translateY(-50%);",
      "background:rgba(255,255,255,.15);border:none;color:#fff;font-size:30px;",
      "width:44px;height:70px;border-radius:8px;cursor:pointer;z-index:2;display:none;",
      "align-items:center;justify-content:center;}",
      "#_fv_prev{left:6px;}#_fv_next{right:6px;}",
      /* counter */
      "#_fv_counter{position:absolute;bottom:70px;left:50%;transform:translateX(-50%);",
      "background:rgba(0,0,0,.55);color:#fff;font-size:12px;padding:3px 10px;",
      "border-radius:12px;pointer-events:none;display:none;z-index:3;}",
      /* bottom action bar */
      "#_fv_abar{display:flex;align-items:center;justify-content:center;gap:0;",
      "background:linear-gradient(transparent,rgba(0,0,0,.85));",
      "padding:8px 4px 16px;flex-shrink:0;position:absolute;bottom:0;left:0;right:0;",
      "overflow-x:auto;z-index:3;scrollbar-width:none;}",
      "#_fv_abar::-webkit-scrollbar{display:none;}",
      "._fva{display:flex;flex-direction:column;align-items:center;gap:3px;",
      "background:none;border:none;color:#fff;font-size:11px;cursor:pointer;",
      "padding:6px 10px;min-width:52px;opacity:.92;flex-shrink:0;}",
      "._fva:hover{opacity:1;}",
      "._fva .ico{font-size:22px;line-height:1;}",
      "._fva .lbl{font-size:10px;white-space:nowrap;}",
      "._fva.danger{color:#ff6b6b;}",
      /* delete submenu */
      "#_fv_delmenu{position:absolute;bottom:90px;left:50%;transform:translateX(-50%);",
      "background:#1e1e2e;border-radius:12px;overflow:hidden;z-index:10;",
      "box-shadow:0 4px 20px rgba(0,0,0,.6);display:none;min-width:220px;}",
      "._fvdel_opt{display:block;width:100%;background:none;border:none;padding:14px 20px;",
      "color:#fff;font-size:14px;text-align:left;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.08);}",
      "._fvdel_opt:last-child{border-bottom:none;}",
      "._fvdel_opt.danger{color:#ff6b6b;}",
      "._fvdel_opt:hover{background:rgba(255,255,255,.08);}",
      /* edit overlay */
      "#_fv_edit{position:absolute;inset:0;z-index:20;background:#000;display:none;flex-direction:column;}",
      "#_fv_edit canvas{flex:1;display:block;touch-action:none;cursor:crosshair;}",
      "#_fv_etbar{display:flex;align-items:center;gap:6px;padding:8px 10px;",
      "background:#111;flex-shrink:0;overflow-x:auto;scrollbar-width:none;}",
      "#_fv_etbar::-webkit-scrollbar{display:none;}",
      "._fvet{background:#2a2a3e;border:none;color:#fff;border-radius:8px;",
      "padding:7px 12px;font-size:13px;cursor:pointer;white-space:nowrap;flex-shrink:0;}",
      "._fvet.active{background:#4fc3f7;color:#000;}",
      "#_fv_ecolor{width:32px;height:32px;border:none;border-radius:6px;cursor:pointer;padding:0;flex-shrink:0;}",
      "#_fv_esize{width:70px;flex-shrink:0;}",
      "#_fv_efont{width:60px;flex-shrink:0;}",
      "#_fv_ebar2{display:flex;align-items:center;gap:6px;padding:8px 10px;",
      "background:#0d0d1a;flex-shrink:0;justify-content:flex-end;}",
      "#_fv_etextinput{position:absolute;display:none;background:transparent;border:none;",
      "outline:none;color:#fff;font-size:20px;font-family:sans-serif;",
      "text-shadow:1px 1px 3px #000;cursor:move;resize:none;min-width:100px;}",
      /* sticker overlay */
      "#_fv_sticker{position:absolute;inset:0;z-index:21;background:#000;display:none;flex-direction:column;}",
      "#_fv_stickercanvas{flex:1;display:block;touch-action:none;}",
      "#_fv_stkbar{display:flex;gap:8px;padding:10px;background:#111;flex-shrink:0;justify-content:center;}",
    ].join("");
    document.head.appendChild(s);
  }

  // ============================================================
  // BUILD DOM
  // ============================================================
  function _buildViewer() {
    if (document.getElementById("_fv")) return;
    _injectStyles();

    var d = document.createElement("div");
    d.id = "_fv";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-modal", "true");
    d.innerHTML =
      /* top bar */
      '<div id="_fv_bar">' +
        '<span id="_fv_name"></span>' +
        '<button id="_fv_x" aria-label="Close">&times;</button>' +
      '</div>' +
      /* stage */
      '<div id="_fv_stage">' +
        '<button id="_fv_prev" aria-label="Previous">&#8249;</button>' +
        '<img id="_fv_img" alt="">' +
        '<video id="_fv_video" controls playsinline></video>' +
        '<iframe id="_fv_doc" allowfullscreen></iframe>' +
        '<div id="_fv_txt"></div>' +
        '<div id="_fv_file">' +
          '<div id="_fv_file_icon">&#128196;</div>' +
          '<div id="_fv_file_name"></div>' +
          '<a id="_fv_file_btn" target="_blank" rel="noopener">Open File</a>' +
          '<a id="_fv_file_dl2">\u2B15 Download</a>' +
        '</div>' +
        '<button id="_fv_next" aria-label="Next">&#8250;</button>' +
        '<div id="_fv_counter"></div>' +
        /* edit overlay */
        '<div id="_fv_edit">' +
          '<div id="_fv_etbar">' +
            '<button class="_fvet active" id="_fv_edraw">\u270F Draw</button>' +
            '<button class="_fvet" id="_fv_etext">T Text</button>' +
            '<button class="_fvet" id="_fv_eemoji">\uD83D\uDE00 Emoji</button>' +
            '<button class="_fvet" id="_fv_ecrop">\u2B1C Crop</button>' +
            '<input type="color" id="_fv_ecolor" value="#ff0000" title="Color">' +
            '<input type="range" id="_fv_esize" min="1" max="24" value="4" title="Size">' +
            '<input type="range" id="_fv_efont" min="12" max="60" value="24" title="Font size">' +
          '</div>' +
          '<canvas id="_fv_ecanvas"></canvas>' +
          '<textarea id="_fv_etextinput" rows="1" placeholder="Type text\u2026"></textarea>' +
          '<div id="_fv_ebar2">' +
            '<button class="_fvet" id="_fv_eundo">\u21A9 Undo</button>' +
            '<button class="_fvet" id="_fv_eclear">Clear</button>' +
            '<button class="_fvet" id="_fv_ecancel">Cancel</button>' +
            '<button class="_fvet active" id="_fv_edone">Done \u2713</button>' +
          '</div>' +
        '</div>' +
        /* sticker overlay */
        '<div id="_fv_sticker">' +
          '<canvas id="_fv_stickercanvas"></canvas>' +
          '<div id="_fv_stkbar">' +
            '<button class="_fvet" id="_fv_stk_cancel">Cancel</button>' +
            '<button class="_fvet active" id="_fv_stk_dl">\u2B15 Save Sticker</button>' +
            '<button class="_fvet active" id="_fv_stk_send">Send as Image</button>' +
          '</div>' +
        '</div>' +
        /* delete submenu */
        '<div id="_fv_delmenu">' +
          '<button class="_fvdel_opt" id="_fv_del_me">Delete for me</button>' +
          '<button class="_fvdel_opt danger" id="_fv_del_all">Delete for everyone</button>' +
          '<button class="_fvdel_opt" id="_fv_del_cancel">Cancel</button>' +
        '</div>' +
      '</div>' +
      /* bottom action bar */
      '<div id="_fv_abar">' +
        '<button class="_fva" id="_fva_forward"><span class="ico">&#8599;</span><span class="lbl">Forward</span></button>' +
        '<button class="_fva" id="_fva_star"><span class="ico">&#9733;</span><span class="lbl">Star</span></button>' +
        '<button class="_fva" id="_fva_show"><span class="ico">&#128172;</span><span class="lbl">Show</span></button>' +
        '<button class="_fva" id="_fva_copy"><span class="ico">&#128279;</span><span class="lbl">Copy link</span></button>' +
        '<button class="_fva" id="_fva_dl"><span class="ico">&#11015;</span><span class="lbl">Download</span></button>' +
        '<button class="_fva _img_act" id="_fva_edit"><span class="ico">&#9998;</span><span class="lbl">Edit</span></button>' +
        '<button class="_fva _img_act" id="_fva_rotate"><span class="ico">&#8635;</span><span class="lbl">Rotate</span></button>' +
        '<button class="_fva _img_act" id="_fva_wallpaper"><span class="ico">&#128444;</span><span class="lbl">Wallpaper</span></button>' +
        '<button class="_fva _img_act" id="_fva_sticker"><span class="ico">&#127773;</span><span class="lbl">Sticker</span></button>' +
        '<button class="_fva danger" id="_fva_delete"><span class="ico">&#128465;</span><span class="lbl">Delete</span></button>' +
      '</div>';

    document.body.appendChild(d);
    _bindViewerEvents();
    _bindActionBar();
    _bindEditMode();
    _bindStickerMode();
  }

  // ============================================================
  // STATE
  // ============================================================
  var _items   = [];
  var _idx     = 0;
  var _rotDeg  = 0;
  var _zoom    = 1;
  var _panX    = 0;
  var _panY    = 0;
  var _isDragging     = false;
  var _dragStartX     = 0;
  var _dragStartY     = 0;
  var _dragBasePanX   = 0;
  var _dragBasePanY   = 0;
  var _pinchStartDist = 0;
  var _pinchStartZoom = 1;
  var _swipeStartX    = 0;
  var _swipeStartY    = 0;

  // ============================================================
  // OPEN
  // ============================================================
  function _openViewer(url, filename, typeHint, msgId, msgMeta) {
    _buildViewer();

    var seen = {};
    _items = [];

    document.querySelectorAll("[data-preview-url]").forEach(function (el) {
      var u = el.dataset.previewUrl;
      if (!u || seen[u]) return;
      seen[u] = true;
      var f   = el.dataset.filename || _basename(u);
      var hasV = el.querySelector("video") || el.classList.contains("video-attachment");
      var hasI = el.querySelector("img");
      var t   = hasV ? "video" : hasI ? "image" : _typeOf(u);
      // collect message meta
      var id  = null;
      var meta = null;
      var msgEl = el.closest(".message[data-message-id]");
      if (msgEl) id = msgEl.dataset.messageId;
      var wrapEl = el.closest("[data-message-meta]");
      if (wrapEl) {
        try { meta = JSON.parse(wrapEl.dataset.messageMeta); id = id || meta.messageId; }
        catch (_) {}
      }
      _items.push({ url: u, filename: f, type: t, messageId: id, meta: meta });
    });

    if (!seen[url]) {
      _items.unshift({ url: url, filename: filename || _basename(url),
        type: typeHint || _typeOf(url), messageId: msgId || null, meta: msgMeta || null });
    }

    _idx = _items.findIndex(function (i) { return i.url === url; });
    if (_idx < 0) _idx = 0;
    // Override meta if caller provided it
    if (msgId)  _items[_idx].messageId = msgId;
    if (msgMeta) _items[_idx].meta = msgMeta;

    _rotDeg = 0; _zoom = 1; _panX = 0; _panY = 0;
    _renderSlide();

    var ov = document.getElementById("_fv");
    ov.style.display = "flex";
    document.body.style.overflow = "hidden";

    // Hide delete submenu if open
    document.getElementById("_fv_delmenu").style.display = "none";
  }

  // ============================================================
  // CLOSE
  // ============================================================
  function _closeViewer() {
    var ov = document.getElementById("_fv");
    if (!ov) return;
    var vid = document.getElementById("_fv_video");
    if (vid) { try { vid.pause(); } catch (_) {} vid.src = ""; }
    var doc = document.getElementById("_fv_doc");
    if (doc) doc.src = "about:blank";
    ov.style.display = "none";
    document.body.style.overflow = "";
    // Close sub-overlays
    document.getElementById("_fv_edit").style.display    = "none";
    document.getElementById("_fv_sticker").style.display = "none";
    document.getElementById("_fv_delmenu").style.display = "none";
  }

  // ============================================================
  // RENDER SLIDE
  // ============================================================
  function _renderSlide() {
    var item  = _items[_idx] || {};
    var url   = item.url || "";
    var fname = item.filename || _basename(url);
    var type  = item.type || _typeOf(url);

    document.getElementById("_fv_name").textContent = fname;

    // Hide all panels
    ["_fv_img","_fv_video","_fv_doc","_fv_txt","_fv_file"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    _rotDeg = 0; _zoom = 1; _panX = 0; _panY = 0;

    if (type === "image") {
      var img = document.getElementById("_fv_img");
      img.src = url;
      img.style.display = "block";
      img.style.transform = "rotate(0deg) scale(1) translate(0,0)";
      img.style.cursor = "zoom-in";
      // Show image-only actions
      document.querySelectorAll("._img_act").forEach(function (b) { b.style.display = "flex"; });

    } else if (type === "video") {
      var vid = document.getElementById("_fv_video");
      vid.src = url;
      vid.style.display = "block";
      document.querySelectorAll("._img_act").forEach(function (b) { b.style.display = "none"; });

    } else if (type === "pdf" || type === "office") {
      var iframe = document.getElementById("_fv_doc");
      iframe.src = "https://docs.google.com/viewer?url=" + encodeURIComponent(url) + "&embedded=true";
      iframe.style.display = "block";
      document.querySelectorAll("._img_act").forEach(function (b) { b.style.display = "none"; });

    } else if (type === "text") {
      var txtEl = document.getElementById("_fv_txt");
      txtEl.style.display = "block";
      txtEl.textContent = "Loading\u2026";
      fetch(url).then(function (r) { return r.text(); })
        .then(function (t) { txtEl.textContent = t; })
        .catch(function () { txtEl.textContent = "Could not load. Use Download."; });
      document.querySelectorAll("._img_act").forEach(function (b) { b.style.display = "none"; });

    } else {
      var fp = document.getElementById("_fv_file");
      fp.style.display = "flex";
      document.getElementById("_fv_file_name").textContent = fname;
      var fbtn = document.getElementById("_fv_file_btn"); fbtn.href = url;
      var fdl  = document.getElementById("_fv_file_dl2"); fdl.href = url; fdl.setAttribute("download", fname);
      document.querySelectorAll("._img_act").forEach(function (b) { b.style.display = "none"; });
    }

    // Download button
    var dlBtn = document.getElementById("_fva_dl");
    if (dlBtn) {
      dlBtn.onclick = function () {
        var a = document.createElement("a");
        a.href = url; a.download = fname;
        a.target = "_blank"; a.click();
      };
    }

    // Nav
    var isMedia = (type === "image" || type === "video");
    var showNav = isMedia && _items.filter(function (i) { return i.type === "image" || i.type === "video"; }).length > 1;
    document.getElementById("_fv_prev").style.display  = showNav ? "flex" : "none";
    document.getElementById("_fv_next").style.display  = showNav ? "flex" : "none";
    var ctr = document.getElementById("_fv_counter");
    ctr.style.display = showNav ? "block" : "none";
    if (showNav) ctr.textContent = (_idx + 1) + " / " + _items.length;
  }

  function _navigate(delta) {
    var vid = document.getElementById("_fv_video");
    if (vid) { try { vid.pause(); } catch (_) {} vid.src = ""; }
    _idx = ((_idx + delta) + _items.length) % _items.length;
    _rotDeg = 0; _zoom = 1; _panX = 0; _panY = 0;
    document.getElementById("_fv_delmenu").style.display = "none";
    _renderSlide();
  }

  // ============================================================
  // VIEWER CORE EVENTS
  // ============================================================
  function _bindViewerEvents() {
    var ov  = document.getElementById("_fv");
    var img = document.getElementById("_fv_img");

    document.getElementById("_fv_x").addEventListener("click", _closeViewer);
    document.getElementById("_fv_prev").addEventListener("click", function () { _navigate(-1); });
    document.getElementById("_fv_next").addEventListener("click", function () { _navigate(1); });

    ov.addEventListener("click", function (e) {
      if (e.target === ov || e.target === document.getElementById("_fv_stage")) _closeViewer();
    });

    document.addEventListener("keydown", function (e) {
      var v = document.getElementById("_fv");
      if (!v || v.style.display === "none") return;
      if (e.key === "Escape")     _closeViewer();
      if (e.key === "ArrowLeft")  _navigate(-1);
      if (e.key === "ArrowRight") _navigate(1);
    });

    // Wheel zoom
    img.addEventListener("wheel", function (e) {
      e.preventDefault();
      _zoom = Math.max(1, Math.min(6, _zoom + (e.deltaY > 0 ? -0.2 : 0.2)));
      if (_zoom <= 1) { _panX = 0; _panY = 0; }
      _applyImgTransform();
    }, { passive: false });

    // Mouse drag (pan)
    img.addEventListener("mousedown", function (e) {
      if (_zoom <= 1) return;
      e.preventDefault();
      _isDragging = true; _dragStartX = e.clientX; _dragStartY = e.clientY;
      _dragBasePanX = _panX; _dragBasePanY = _panY;
      img.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", function (e) {
      if (!_isDragging) return;
      _panX = _dragBasePanX + (e.clientX - _dragStartX) / _zoom;
      _panY = _dragBasePanY + (e.clientY - _dragStartY) / _zoom;
      _applyImgTransform();
    });
    document.addEventListener("mouseup", function () {
      if (!_isDragging) return;
      _isDragging = false;
      img.style.cursor = _zoom > 1 ? "grab" : "zoom-in";
    });

    // Touch
    ov.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) {
        _pinchStartDist = _touchDist(e.touches); _pinchStartZoom = _zoom;
      } else if (e.touches.length === 1) {
        _swipeStartX = e.touches[0].clientX; _swipeStartY = e.touches[0].clientY;
        if (_zoom > 1) {
          _isDragging = true;
          _dragStartX = e.touches[0].clientX; _dragStartY = e.touches[0].clientY;
          _dragBasePanX = _panX; _dragBasePanY = _panY;
        }
      }
    }, { passive: true });

    ov.addEventListener("touchmove", function (e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        _zoom = Math.max(1, Math.min(6, _pinchStartZoom * (_touchDist(e.touches) / _pinchStartDist)));
        if (_zoom <= 1) { _panX = 0; _panY = 0; }
        _applyImgTransform();
      } else if (e.touches.length === 1 && _isDragging && _zoom > 1) {
        _panX = _dragBasePanX + (e.touches[0].clientX - _dragStartX) / _zoom;
        _panY = _dragBasePanY + (e.touches[0].clientY - _dragStartY) / _zoom;
        _applyImgTransform();
      }
    }, { passive: false });

    ov.addEventListener("touchend", function (e) {
      _isDragging = false;
      if (_zoom <= 1 && e.changedTouches.length === 1) {
        var dx = e.changedTouches[0].clientX - _swipeStartX;
        var dy = e.changedTouches[0].clientY - _swipeStartY;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) _navigate(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  function _applyImgTransform() {
    var img = document.getElementById("_fv_img");
    if (!img) return;
    img.style.transform = "rotate(" + _rotDeg + "deg) scale(" + _zoom + ") translate(" + _panX + "px," + _panY + "px)";
    img.style.cursor = _zoom > 1 ? "grab" : "zoom-in";
  }

  function _touchDist(t) {
    var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ============================================================
  // ACTION BAR
  // ============================================================
  function _bindActionBar() {
    // Forward
    document.getElementById("_fva_forward").addEventListener("click", function () {
      var item = _items[_idx]; if (!item) return;
      _closeViewer();
      var att = { type: item.type, url: item.url, filename: item.filename };
      if (item.messageId && typeof window.openForwardModal === "function") {
        window.openForwardModal(item.messageId, item.meta || {});
      } else if (typeof window.openForwardModalForMedia === "function") {
        window.openForwardModalForMedia(att);
      } else {
        _toast("Forward not available in this context");
      }
    });

    // Star
    document.getElementById("_fva_star").addEventListener("click", function () {
      var item = _items[_idx]; if (!item) return;
      if (item.messageId && typeof window.starMessage === "function") {
        window.starMessage(item.messageId, item.meta || { text: "", attachment: { type: item.type, url: item.url, filename: item.filename } });
      } else {
        _toast("Cannot star — message info unavailable");
      }
    });

    // Show in chat
    document.getElementById("_fva_show").addEventListener("click", function () {
      var item = _items[_idx]; if (!item) return;
      if (!item.messageId) { _toast("Message location unknown"); return; }
      _closeViewer();
      setTimeout(function () {
        if (typeof window.scrollToMessage === "function") {
          window.scrollToMessage(item.messageId);
        } else {
          var el = document.querySelector('.message[data-message-id="' + CSS.escape(item.messageId) + '"]');
          if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }, 120);
    });

    // Copy link
    document.getElementById("_fva_copy").addEventListener("click", function () {
      var url = (_items[_idx] || {}).url; if (!url) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { _toast("Link copied"); });
      } else {
        var ta = document.createElement("textarea");
        ta.value = url; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
        _toast("Link copied");
      }
    });

    // Rotate (image only)
    document.getElementById("_fva_rotate").addEventListener("click", function () {
      var img = document.getElementById("_fv_img"); if (!img || img.style.display === "none") return;
      _rotDeg = (_rotDeg + 90) % 360;
      _applyImgTransform();
    });

    // Set as wallpaper (image only)
    document.getElementById("_fva_wallpaper").addEventListener("click", function () {
      var item = _items[_idx]; if (!item || item.type !== "image") return;
      var chatId = window.currentChat && window.currentChat.id;
      if (!chatId) { _toast("Open a chat first"); return; }
      if (window.chatWallpapers) window.chatWallpapers[chatId] = item.url;
      if (typeof window.saveWallpaperToStorage === "function") window.saveWallpaperToStorage();
      if (typeof window.applyCurrentChatWallpaper === "function") {
        window.applyCurrentChatWallpaper();
      } else {
        var area = document.getElementById("messagesArea");
        if (area) { area.style.backgroundImage = "url(" + item.url + ")"; area.style.backgroundSize = "cover"; area.style.backgroundPosition = "center"; }
      }
      _closeViewer();
      _toast("Wallpaper set for this chat");
    });

    // Edit
    document.getElementById("_fva_edit").addEventListener("click", function () {
      var img = document.getElementById("_fv_img");
      if (!img || img.style.display === "none") return;
      _openEditMode(img.src, img);
    });

    // Create sticker
    document.getElementById("_fva_sticker").addEventListener("click", function () {
      var img = document.getElementById("_fv_img");
      if (!img || img.style.display === "none") return;
      _openStickerMode(img.src);
    });

    // Delete — show submenu
    document.getElementById("_fva_delete").addEventListener("click", function () {
      var dm = document.getElementById("_fv_delmenu");
      dm.style.display = dm.style.display === "block" ? "none" : "block";
    });
    document.getElementById("_fv_del_cancel").addEventListener("click", function () {
      document.getElementById("_fv_delmenu").style.display = "none";
    });
    document.getElementById("_fv_del_me").addEventListener("click", function () {
      var item = _items[_idx]; if (!item) return;
      if (!item.messageId) { _toast("Cannot delete — message info unavailable"); return; }
      document.getElementById("_fv_delmenu").style.display = "none";
      _closeViewer();
      if (typeof window.deleteMessageForMe === "function") {
        window.deleteMessageForMe(item.messageId).then(function () { _toast("Deleted for you"); }).catch(function () { _toast("Delete failed", "error"); });
      } else { _toast("Delete not available"); }
    });
    document.getElementById("_fv_del_all").addEventListener("click", function () {
      var item = _items[_idx]; if (!item) return;
      if (!item.messageId) { _toast("Cannot delete — message info unavailable"); return; }
      document.getElementById("_fv_delmenu").style.display = "none";
      _closeViewer();
      if (typeof window.deleteMessageForEveryone === "function") {
        window.deleteMessageForEveryone(item.messageId, item.meta || null)
          .then(function () { _toast("Deleted for everyone"); })
          .catch(function () { _toast("Delete failed", "error"); });
      } else { _toast("Delete not available"); }
    });
  }

  // ============================================================
  // EDIT MODE
  // ============================================================
  var _editHistory = [];
  var _editMode    = "draw";
  var _editImg     = null;
  var _editDrawing = false;
  var _editTextActive = false;

  function _openEditMode(src) {
    var overlay = document.getElementById("_fv_edit");
    var canvas  = document.getElementById("_fv_ecanvas");
    overlay.style.display = "flex";

    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      _editImg = img;
      var maxW = window.innerWidth, maxH = window.innerHeight - 120;
      var scale = Math.min(maxW / img.width, maxH / img.height, 1);
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      _editHistory = [];
      _editRedraw();
    };
    img.src = src;
  }

  function _editRedraw() {
    var canvas = document.getElementById("_fv_ecanvas");
    var ctx    = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (_editImg) ctx.drawImage(_editImg, 0, 0, canvas.width, canvas.height);
    _editHistory.forEach(function (step) { _editReplayStep(ctx, step); });
  }

  function _editReplayStep(ctx, step) {
    if (step.type === "draw") {
      ctx.strokeStyle = step.color; ctx.lineWidth = step.size;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      step.pts.forEach(function (p, i) { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
      ctx.stroke();
    } else if (step.type === "text") {
      ctx.font = step.size + "px sans-serif";
      ctx.fillStyle = step.color;
      ctx.shadowColor = "#000"; ctx.shadowBlur = 4;
      ctx.fillText(step.text, step.x, step.y);
      ctx.shadowBlur = 0;
    } else if (step.type === "emoji") {
      ctx.font = step.size + "px sans-serif";
      ctx.fillText(step.emoji, step.x, step.y);
    }
  }

  var _EMOJIS = ["😀","😂","❤️","🔥","👍","😍","🎉","😭","😎","🤔","💯","🙏","✨","💪","🤣"];

  function _bindEditMode() {
    var canvas   = document.getElementById("_fv_ecanvas");
    var ctx      = canvas.getContext("2d");
    var colorEl  = document.getElementById("_fv_ecolor");
    var sizeEl   = document.getElementById("_fv_esize");
    var fontEl   = document.getElementById("_fv_efont");
    var textInput = document.getElementById("_fv_etextinput");

    // Mode buttons
    ["_fv_edraw","_fv_etext","_fv_eemoji","_fv_ecrop"].forEach(function (id) {
      document.getElementById(id).addEventListener("click", function () {
        document.querySelectorAll("._fvet").forEach(function (b) { if (["_fv_edraw","_fv_etext","_fv_eemoji","_fv_ecrop"].includes(b.id)) b.classList.remove("active"); });
        this.classList.add("active");
        _editMode = { "_fv_edraw": "draw", "_fv_etext": "text", "_fv_eemoji": "emoji", "_fv_ecrop": "crop" }[id];
        textInput.style.display = "none"; _editTextActive = false;
        if (_editMode === "emoji") _showEmojiPicker();
      });
    });

    function _getPos(e) {
      var r = canvas.getBoundingClientRect();
      var t = e.touches ? e.touches[0] : e;
      return { x: (t.clientX - r.left) * (canvas.width / r.width), y: (t.clientY - r.top) * (canvas.height / r.height) };
    }

    var _curStroke = null;
    canvas.addEventListener("mousedown", function (e) {
      if (_editMode === "draw") {
        _editDrawing = true;
        var p = _getPos(e);
        _curStroke = { type: "draw", color: colorEl.value, size: parseInt(sizeEl.value), pts: [p] };
        ctx.strokeStyle = colorEl.value; ctx.lineWidth = parseInt(sizeEl.value);
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
      } else if (_editMode === "text") {
        var p2 = _getPos(e);
        textInput.style.display = "block";
        textInput.style.left = (e.clientX) + "px";
        textInput.style.top  = (e.clientY - 20) + "px";
        textInput.style.color = colorEl.value;
        textInput.style.fontSize = fontEl.value + "px";
        textInput.focus();
        _editTextActive = true;
        textInput._canvasX = p2.x; textInput._canvasY = p2.y;
      } else if (_editMode === "emoji") {
        // handled by picker
      }
    });
    canvas.addEventListener("mousemove", function (e) {
      if (!_editDrawing || _editMode !== "draw") return;
      var p = _getPos(e); _curStroke.pts.push(p);
      ctx.lineTo(p.x, p.y); ctx.stroke();
    });
    canvas.addEventListener("mouseup", function () {
      if (_editMode === "draw" && _editDrawing && _curStroke) {
        _editHistory.push(_curStroke); _curStroke = null;
      }
      _editDrawing = false;
    });

    // Touch draw
    canvas.addEventListener("touchstart", function (e) { e.preventDefault(); if (_editMode === "draw") { var p = _getPos(e); _editDrawing = true; _curStroke = { type: "draw", color: colorEl.value, size: parseInt(sizeEl.value), pts: [p] }; ctx.beginPath(); ctx.moveTo(p.x, p.y); } }, { passive: false });
    canvas.addEventListener("touchmove", function (e) { e.preventDefault(); if (!_editDrawing) return; var p = _getPos(e); _curStroke.pts.push(p); ctx.strokeStyle = colorEl.value; ctx.lineWidth = parseInt(sizeEl.value); ctx.lineCap = "round"; ctx.lineTo(p.x, p.y); ctx.stroke(); }, { passive: false });
    canvas.addEventListener("touchend", function () { if (_editMode === "draw" && _curStroke) { _editHistory.push(_curStroke); _curStroke = null; } _editDrawing = false; });

    // Commit text on Enter or blur
    textInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault(); _commitText();
      }
    });
    textInput.addEventListener("blur", function () { if (_editTextActive) _commitText(); });

    function _commitText() {
      var txt = textInput.value.trim();
      if (txt && textInput._canvasX !== undefined) {
        var step = { type: "text", text: txt, color: colorEl.value, size: parseInt(fontEl.value), x: textInput._canvasX, y: textInput._canvasY };
        _editHistory.push(step);
        _editRedraw();
      }
      textInput.style.display = "none"; textInput.value = ""; _editTextActive = false;
    }

    // Undo
    document.getElementById("_fv_eundo").addEventListener("click", function () {
      if (_editHistory.length) { _editHistory.pop(); _editRedraw(); }
    });

    // Clear
    document.getElementById("_fv_eclear").addEventListener("click", function () {
      _editHistory = []; _editRedraw();
    });

    // Cancel edit
    document.getElementById("_fv_ecancel").addEventListener("click", function () {
      document.getElementById("_fv_edit").style.display = "none";
    });

    // Done — export and offer Send / Download
    document.getElementById("_fv_edone").addEventListener("click", function () {
      canvas.toBlob(function (blob) {
        if (!blob) { _toast("Export failed", "error"); return; }
        var item = _items[_idx] || {};
        var fname = "edited_" + (item.filename || "image.png");
        // Show choice
        var choice = confirm("Send edited image to chat? (Cancel = Download only)");
        if (choice) {
          var file = new File([blob], fname, { type: "image/png" });
          _uploadToStorage(file).then(function (url) {
            window.currentAttachment = { type: "image", url: url, filename: fname, size: blob.size };
            if (typeof window.setAttachmentPreview === "function") window.setAttachmentPreview();
            _toast("Edited image ready — tap Send in chat");
            document.getElementById("_fv_edit").style.display = "none";
            _closeViewer();
          }).catch(function (err) { _toast("Upload failed: " + err.message, "error"); });
        } else {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob); a.download = fname; a.click();
          document.getElementById("_fv_edit").style.display = "none";
        }
      }, "image/png");
    });
  }

  function _showEmojiPicker() {
    // Simple inline emoji picker
    var existing = document.getElementById("_fv_epicker");
    if (existing) { existing.remove(); return; }
    var picker = document.createElement("div");
    picker.id = "_fv_epicker";
    picker.style.cssText = "position:absolute;bottom:60px;left:50%;transform:translateX(-50%);background:#1e1e2e;border-radius:12px;padding:10px;display:flex;flex-wrap:wrap;gap:6px;z-index:30;max-width:260px;box-shadow:0 4px 20px rgba(0,0,0,.6);";
    _EMOJIS.forEach(function (em) {
      var b = document.createElement("button");
      b.textContent = em;
      b.style.cssText = "background:none;border:none;font-size:24px;cursor:pointer;";
      b.addEventListener("click", function () {
        var canvas = document.getElementById("_fv_ecanvas");
        var ctx    = canvas.getContext("2d");
        var x = canvas.width / 2, y = canvas.height / 2;
        var step = { type: "emoji", emoji: em, size: 40, x: x, y: y };
        _editHistory.push(step); _editRedraw();
        picker.remove();
      });
      picker.appendChild(b);
    });
    document.getElementById("_fv_edit").appendChild(picker);
  }

  // ============================================================
  // STICKER MODE
  // ============================================================
  var _stkImg = null;
  var _stkCrop = { x: 0, y: 0, w: 0, h: 0 };

  function _openStickerMode(src) {
    var overlay = document.getElementById("_fv_sticker");
    var canvas  = document.getElementById("_fv_stickercanvas");
    overlay.style.display = "flex";

    var img = new Image(); img.crossOrigin = "anonymous";
    img.onload = function () {
      _stkImg = img;
      var size = Math.min(window.innerWidth, window.innerHeight - 80, 400);
      canvas.width = size; canvas.height = size;
      var sq = Math.min(img.width, img.height);
      _stkCrop = { x: (img.width - sq) / 2, y: (img.height - sq) / 2, w: sq, h: sq };
      _stkRedraw();
    };
    img.src = src;
  }

  function _stkRedraw() {
    var canvas = document.getElementById("_fv_stickercanvas");
    var ctx    = canvas.getContext("2d");
    var sz = canvas.width;
    ctx.clearRect(0, 0, sz, sz);
    // Rounded clip
    ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, sz, sz, sz * 0.15); ctx.clip();
    ctx.drawImage(_stkImg, _stkCrop.x, _stkCrop.y, _stkCrop.w, _stkCrop.h, 0, 0, sz, sz);
    ctx.restore();
    // Border guides
    ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(1, 1, sz - 2, sz - 2, sz * 0.15); ctx.stroke();
  }

  function _bindStickerMode() {
    document.getElementById("_fv_stk_cancel").addEventListener("click", function () {
      document.getElementById("_fv_sticker").style.display = "none";
    });

    document.getElementById("_fv_stk_dl").addEventListener("click", function () {
      var canvas = document.getElementById("_fv_stickercanvas");
      canvas.toBlob(function (blob) {
        if (!blob) { _toast("Export failed", "error"); return; }
        var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = "sticker.webp"; a.click();
        document.getElementById("_fv_sticker").style.display = "none";
      }, "image/webp");
    });

    document.getElementById("_fv_stk_send").addEventListener("click", function () {
      var canvas = document.getElementById("_fv_stickercanvas");
      canvas.toBlob(function (blob) {
        if (!blob) { _toast("Export failed", "error"); return; }
        var file = new File([blob], "sticker.png", { type: "image/png" });
        _uploadToStorage(file).then(function (url) {
          window.currentAttachment = { type: "image", url: url, filename: "sticker.png", size: blob.size };
          if (typeof window.setAttachmentPreview === "function") window.setAttachmentPreview();
          _toast("Sticker ready — tap Send in chat");
          document.getElementById("_fv_sticker").style.display = "none";
          _closeViewer();
        }).catch(function (err) { _toast("Upload failed: " + err.message, "error"); });
      }, "image/png");
    });
  }

  // ============================================================
  // TYPE HELPERS
  // ============================================================
  function _isVideo(u) { return /\.(mp4|webm|ogg|mov|avi|mkv|m4v)(\?|#|$)/i.test(u); }
  function _isImage(u) { return /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)(\?|#|$)/i.test(u); }
  function _typeOf(url) {
    var u = (url || "").toLowerCase().split("?")[0].split("#")[0];
    if (_isImage(url)) return "image";
    if (_isVideo(url)) return "video";
    if (u.endsWith(".pdf")) return "pdf";
    if (/\.(doc|docx|xls|xlsx|ppt|pptx)$/.test(u)) return "office";
    if (/\.(txt|csv)$/.test(u)) return "text";
    return "file";
  }
  function _basename(url) {
    try { return decodeURIComponent((url || "").split("?")[0].split("/").pop()) || "Media"; }
    catch (_) { return "Media"; }
  }
  function _toast(msg, type) {
    if (typeof window.showToast === "function") window.showToast(msg, type || "success");
    else console.log("[fixes] toast:", msg);
  }

  // ============================================================
  // EVENT DELEGATION (capture — fires before <a href>)
  // ============================================================
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-preview-url]");
    if (el) {
      var url = el.dataset.previewUrl; if (!url) return;
      e.preventDefault(); e.stopPropagation();
      var fname = el.dataset.filename || _basename(url);
      var type  = el.querySelector("video") || el.classList.contains("video-attachment") ? "video"
                : el.querySelector("img") ? "image" : _typeOf(url);
      // Collect message meta
      var msgId = null, msgMeta = null;
      var msgEl = el.closest(".message[data-message-id]");
      if (msgEl) msgId = msgEl.dataset.messageId;
      var wrapEl = el.closest("[data-message-meta]");
      if (wrapEl) { try { msgMeta = JSON.parse(wrapEl.dataset.messageMeta); msgId = msgId || msgMeta.messageId; } catch (_) {} }
      _openViewer(url, fname, type, msgId, msgMeta);
      return;
    }
    // ▶ play button
    var pb = e.target.closest(".video-play-overlay");
    if (pb) {
      e.preventDefault(); e.stopPropagation();
      var wrap = pb.closest("[data-preview-url]");
      if (wrap && wrap.dataset.previewUrl) { _openViewer(wrap.dataset.previewUrl, wrap.dataset.filename || "Video", "video"); return; }
      var vid = pb.parentElement && pb.parentElement.querySelector("video");
      if (vid) { var s = vid.currentSrc || vid.src; if (s) _openViewer(s, "Video", "video"); }
    }
  }, true);

  window.addEventListener("popstate", function () {
    var ov = document.getElementById("_fv");
    if (ov && ov.style.display !== "none") _closeViewer();
  });

  // ============================================================
  // FIX 2 — Firebase Storage upload (replaces Cloudinary)
  // ============================================================
  async function _uploadToStorage(file) {
    var s = window.storage, user = window.currentUser;
    if (!s || !user) throw new Error("Firebase Storage not ready");
    var safe = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    var path = "chat_uploads/" + user.uid + "/" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + "_" + safe;
    var ref  = s.ref(path);
    var task = ref.put(file);
    task.on("state_changed", function (snap) {
      var pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
      _toast("Uploading\u2026 " + pct + "%", "info");
    });
    await task;
    return await ref.getDownloadURL();
  }

  window.uploadToCloudinary  = _uploadToStorage;
  window.uploadDocument      = _uploadToStorage;
  window.uploadRecordedMedia = _uploadToStorage;

  console.log("[fixes.js v3] Loaded.");
})();
