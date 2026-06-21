// ============================================================
// fixes.js  v2 — Drop-in patch for My-Personal-Website chat app
//
// Fixes:
//   1. Image/video/doc viewer — fully self-contained, works in
//      chat messages AND shared-media / files panel in options
//   2. File attachment sending via Firebase Storage (not Cloudinary)
//
// Add after app-init.js in index.html:
//   <script src="fixes.js?v=2"></script>
// ============================================================

(function () {
  "use strict";

  // ----------------------------------------------------------
  // STYLES
  // ----------------------------------------------------------
  function _injectStyles() {
    if (document.getElementById("_fv_style")) return;
    var s = document.createElement("style");
    s.id = "_fv_style";
    s.textContent =
      "#_fv{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.96);" +
      "display:none;flex-direction:column;touch-action:none;}" +
      "#_fv_bar{display:flex;align-items:center;justify-content:space-between;" +
      "padding:10px 14px;background:rgba(0,0,0,.7);flex-shrink:0;gap:8px;}" +
      "#_fv_name{color:#fff;font-size:13px;font-weight:500;overflow:hidden;" +
      "text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}" +
      "#_fv_actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}" +
      "#_fv_dl{color:#4fc3f7;font-size:13px;text-decoration:none;" +
      "padding:5px 11px;border:1px solid #4fc3f7;border-radius:6px;white-space:nowrap;}" +
      "#_fv_open{color:#81c784;font-size:13px;text-decoration:none;" +
      "padding:5px 11px;border:1px solid #81c784;border-radius:6px;white-space:nowrap;}" +
      "#_fv_x{background:none;border:none;color:#fff;font-size:28px;" +
      "cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0;}" +
      "#_fv_stage{flex:1;display:flex;align-items:center;justify-content:center;" +
      "position:relative;overflow:hidden;min-height:0;}" +
      "#_fv_img{max-width:100%;max-height:100%;object-fit:contain;display:none;" +
      "user-select:none;transform-origin:center center;}" +
      "#_fv_video{max-width:100%;max-height:100%;display:none;outline:none;}" +
      "#_fv_doc{flex:1;width:100%;border:none;display:none;height:100%;}" +
      "#_fv_txt{flex:1;overflow:auto;padding:20px 24px;color:#e0e0e0;" +
      "font-family:monospace;font-size:13px;white-space:pre-wrap;word-break:break-all;display:none;}" +
      "#_fv_file{flex:1;display:none;flex-direction:column;align-items:center;" +
      "justify-content:center;color:#fff;gap:18px;padding:32px;text-align:center;}" +
      "#_fv_file_icon{font-size:72px;line-height:1;}" +
      "#_fv_file_name{font-size:17px;font-weight:500;max-width:80%;word-break:break-word;}" +
      "#_fv_file_btn{background:#4fc3f7;color:#000;padding:11px 28px;border-radius:24px;" +
      "text-decoration:none;font-weight:700;font-size:15px;}" +
      "#_fv_file_dl{color:#4fc3f7;font-size:14px;text-decoration:none;}" +
      "#_fv_prev,#_fv_next{position:absolute;top:50%;transform:translateY(-50%);" +
      "background:rgba(255,255,255,.14);border:none;color:#fff;font-size:30px;" +
      "width:42px;height:68px;border-radius:6px;cursor:pointer;z-index:2;" +
      "display:none;align-items:center;justify-content:center;}" +
      "#_fv_prev{left:6px;}#_fv_next{right:6px;}" +
      "#_fv_counter{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);" +
      "background:rgba(0,0,0,.55);color:#fff;font-size:12px;padding:3px 10px;" +
      "border-radius:12px;pointer-events:none;display:none;}";
    document.head.appendChild(s);
  }

  // ----------------------------------------------------------
  // BUILD VIEWER DOM (once)
  // ----------------------------------------------------------
  function _buildViewer() {
    if (document.getElementById("_fv")) return;
    _injectStyles();
    var d = document.createElement("div");
    d.id = "_fv";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-modal", "true");
    d.innerHTML =
      '<div id="_fv_bar">' +
        '<span id="_fv_name"></span>' +
        '<div id="_fv_actions">' +
          '<a id="_fv_dl" download="">\u2B15 Download</a>' +
          '<a id="_fv_open" target="_blank" rel="noopener">\u2197 Open</a>' +
          '<button id="_fv_x" aria-label="Close">&times;</button>' +
        '</div>' +
      '</div>' +
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
          '<a id="_fv_file_dl">\u2B15 Download</a>' +
        '</div>' +
        '<button id="_fv_next" aria-label="Next">&#8250;</button>' +
        '<div id="_fv_counter"></div>' +
      '</div>';
    document.body.appendChild(d);
    _bindViewerEvents();
  }

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------
  var _items = [];
  var _idx = 0;
  var _zoom = 1;
  var _panX = 0;
  var _panY = 0;
  var _isDragging = false;
  var _dragStartX = 0;
  var _dragStartY = 0;
  var _dragBasePanX = 0;
  var _dragBasePanY = 0;
  var _pinchStartDist = 0;
  var _pinchStartZoom = 1;
  var _swipeStartX = 0;
  var _swipeStartY = 0;

  // ----------------------------------------------------------
  // OPEN
  // ----------------------------------------------------------
  function _openViewer(url, filename, typeHint) {
    _buildViewer();

    // Collect all image/video items currently in the DOM for navigation
    var seen = {};
    _items = [];
    document.querySelectorAll("[data-preview-url]").forEach(function (el) {
      var u = el.dataset.previewUrl;
      if (!u || seen[u]) return;
      seen[u] = true;
      var f = el.dataset.filename || _basename(u);
      var hasVid = !!el.querySelector("video") || el.classList.contains("video-attachment");
      var hasImg = !!el.querySelector("img");
      var t = hasVid ? "video" : hasImg ? "image" : _typeOf(u);
      if (t === "image" || t === "video") {
        _items.push({ url: u, filename: f, type: t });
      }
    });

    // Make sure the clicked item is in the list
    if (!seen[url]) {
      var ft = typeHint || _typeOf(url);
      _items.unshift({ url: url, filename: filename || _basename(url), type: ft });
    }

    _idx = _items.findIndex(function (i) { return i.url === url; });
    if (_idx < 0) _idx = 0;

    _zoom = 1; _panX = 0; _panY = 0;
    _renderSlide();
    document.getElementById("_fv").style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  // ----------------------------------------------------------
  // CLOSE
  // ----------------------------------------------------------
  function _closeViewer() {
    var ov = document.getElementById("_fv");
    if (!ov) return;
    var vid = document.getElementById("_fv_video");
    if (vid) { try { vid.pause(); } catch (_) {} vid.src = ""; }
    var doc = document.getElementById("_fv_doc");
    if (doc) doc.src = "about:blank";
    ov.style.display = "none";
    document.body.style.overflow = "";
  }

  // ----------------------------------------------------------
  // RENDER SLIDE
  // ----------------------------------------------------------
  function _renderSlide() {
    var item = _items[_idx] || {};
    var url = item.url || "";
    var filename = item.filename || _basename(url);
    var type = item.type || _typeOf(url);

    // Top bar
    var nameEl = document.getElementById("_fv_name");
    var dlEl   = document.getElementById("_fv_dl");
    var openEl = document.getElementById("_fv_open");
    if (nameEl) nameEl.textContent = filename;
    if (dlEl)   { dlEl.href = url; dlEl.setAttribute("download", filename); }
    if (openEl) openEl.href = url;

    // Hide all panels
    ["_fv_img", "_fv_video", "_fv_doc", "_fv_txt", "_fv_file"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    if (type === "image") {
      var img = document.getElementById("_fv_img");
      img.src = url;
      img.style.display = "block";
      img.style.transform = "scale(1) translate(0px,0px)";
      img.style.cursor = "zoom-in";

    } else if (type === "video") {
      var vid = document.getElementById("_fv_video");
      vid.src = url;
      vid.style.display = "block";

    } else if (type === "pdf" || type === "office") {
      var iframe = document.getElementById("_fv_doc");
      iframe.src = "https://docs.google.com/viewer?url=" + encodeURIComponent(url) + "&embedded=true";
      iframe.style.display = "block";

    } else if (type === "text") {
      var txtEl = document.getElementById("_fv_txt");
      txtEl.style.display = "block";
      txtEl.textContent = "Loading\u2026";
      fetch(url).then(function (r) { return r.text(); })
        .then(function (t) { txtEl.textContent = t; })
        .catch(function () { txtEl.textContent = "Could not load content. Use Download above."; });

    } else {
      var filePanel = document.getElementById("_fv_file");
      filePanel.style.display = "flex";
      var fnEl  = document.getElementById("_fv_file_name");
      var btnEl = document.getElementById("_fv_file_btn");
      var fdlEl = document.getElementById("_fv_file_dl");
      if (fnEl)  fnEl.textContent = filename;
      if (btnEl) btnEl.href = url;
      if (fdlEl) { fdlEl.href = url; fdlEl.setAttribute("download", filename); }
    }

    // Nav arrows + counter
    var isMedia = (type === "image" || type === "video");
    var showNav = isMedia && _items.length > 1;
    var prevBtn  = document.getElementById("_fv_prev");
    var nextBtn  = document.getElementById("_fv_next");
    var counter  = document.getElementById("_fv_counter");
    if (prevBtn)  prevBtn.style.display  = showNav ? "flex"  : "none";
    if (nextBtn)  nextBtn.style.display  = showNav ? "flex"  : "none";
    if (counter) {
      counter.style.display = showNav ? "block" : "none";
      counter.textContent = (_idx + 1) + " / " + _items.length;
    }
  }

  function _navigate(delta) {
    if (_items.length < 2) return;
    var vid = document.getElementById("_fv_video");
    if (vid) { try { vid.pause(); } catch (_) {} vid.src = ""; }
    _idx = ((_idx + delta) + _items.length) % _items.length;
    _zoom = 1; _panX = 0; _panY = 0;
    _renderSlide();
  }

  // ----------------------------------------------------------
  // VIEWER EVENTS
  // ----------------------------------------------------------
  function _bindViewerEvents() {
    var ov  = document.getElementById("_fv");
    var img = document.getElementById("_fv_img");

    document.getElementById("_fv_x").addEventListener("click", _closeViewer);
    document.getElementById("_fv_prev").addEventListener("click", function () { _navigate(-1); });
    document.getElementById("_fv_next").addEventListener("click", function () { _navigate(1); });

    // Tap dark backdrop to close
    ov.addEventListener("click", function (e) {
      if (e.target === ov || e.target === document.getElementById("_fv_stage")) {
        _closeViewer();
      }
    });

    // Keyboard nav
    document.addEventListener("keydown", function (e) {
      var v = document.getElementById("_fv");
      if (!v || v.style.display === "none") return;
      if (e.key === "Escape")      _closeViewer();
      if (e.key === "ArrowLeft")   _navigate(-1);
      if (e.key === "ArrowRight")  _navigate(1);
    });

    // Mouse wheel zoom on images
    img.addEventListener("wheel", function (e) {
      e.preventDefault();
      _zoom = Math.max(1, Math.min(6, _zoom + (e.deltaY > 0 ? -0.2 : 0.2)));
      if (_zoom <= 1) { _panX = 0; _panY = 0; }
      _applyImgTransform();
    }, { passive: false });

    // Mouse drag (pan when zoomed)
    img.addEventListener("mousedown", function (e) {
      if (_zoom <= 1) return;
      e.preventDefault();
      _isDragging = true;
      _dragStartX = e.clientX;
      _dragStartY = e.clientY;
      _dragBasePanX = _panX;
      _dragBasePanY = _panY;
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

    // Touch: pinch-zoom + swipe nav
    ov.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) {
        _pinchStartDist = _touchDist(e.touches);
        _pinchStartZoom = _zoom;
      } else if (e.touches.length === 1) {
        _swipeStartX = e.touches[0].clientX;
        _swipeStartY = e.touches[0].clientY;
        if (_zoom > 1) {
          _isDragging = true;
          _dragStartX = e.touches[0].clientX;
          _dragStartY = e.touches[0].clientY;
          _dragBasePanX = _panX;
          _dragBasePanY = _panY;
        }
      }
    }, { passive: true });

    ov.addEventListener("touchmove", function (e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        var d = _touchDist(e.touches);
        _zoom = Math.max(1, Math.min(6, _pinchStartZoom * (d / _pinchStartDist)));
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
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          _navigate(dx < 0 ? 1 : -1);
        }
      }
    }, { passive: true });
  }

  function _applyImgTransform() {
    var img = document.getElementById("_fv_img");
    if (!img) return;
    img.style.transform = "scale(" + _zoom + ") translate(" + _panX + "px," + _panY + "px)";
    img.style.cursor = _zoom > 1 ? "grab" : "zoom-in";
  }

  function _touchDist(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ----------------------------------------------------------
  // TYPE HELPERS
  // ----------------------------------------------------------
  function _isVideo(url) {
    return /\.(mp4|webm|ogg|mov|avi|mkv|m4v)(\?|#|$)/i.test(url);
  }
  function _isImage(url) {
    return /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)(\?|#|$)/i.test(url);
  }
  function _typeOf(url) {
    var u = (url || "").toLowerCase().split("?")[0].split("#")[0];
    if (_isImage(url)) return "image";
    if (_isVideo(url)) return "video";
    if (u.endsWith(".pdf"))  return "pdf";
    if (/\.(doc|docx|xls|xlsx|ppt|pptx)$/.test(u)) return "office";
    if (/\.(txt|csv)$/.test(u)) return "text";
    return "file";
  }
  function _basename(url) {
    try { return decodeURIComponent((url || "").split("?")[0].split("/").pop()) || "Media"; }
    catch (_) { return "Media"; }
  }

  // ----------------------------------------------------------
  // EVENT DELEGATION (capture phase — fires before <a href> nav)
  // ----------------------------------------------------------
  document.addEventListener("click", function (e) {
    // Any element with data-preview-url
    var el = e.target.closest("[data-preview-url]");
    if (el) {
      var url = el.dataset.previewUrl;
      if (!url) return;
      e.preventDefault();
      e.stopPropagation();
      var filename = el.dataset.filename || _basename(url);
      // Detect type from DOM children first, then from URL
      var type;
      if (el.querySelector("video") || el.classList.contains("video-attachment")) {
        type = "video";
      } else if (el.querySelector("img")) {
        type = "image";
      } else {
        type = _typeOf(url);
      }
      _openViewer(url, filename, type);
      return;
    }

    // The ▶ play overlay button inside video attachments
    var playBtn = e.target.closest(".video-play-overlay");
    if (playBtn) {
      e.preventDefault();
      e.stopPropagation();
      var wrap = playBtn.closest("[data-preview-url]");
      if (wrap && wrap.dataset.previewUrl) {
        _openViewer(wrap.dataset.previewUrl, wrap.dataset.filename || "Video", "video");
        return;
      }
      var vid = playBtn.parentElement && playBtn.parentElement.querySelector("video");
      if (vid) {
        var src = vid.currentSrc || vid.src || "";
        if (src) _openViewer(src, "Video", "video");
      }
    }
  }, true /* capture phase */);

  // Android back-button closes viewer
  window.addEventListener("popstate", function () {
    var ov = document.getElementById("_fv");
    if (ov && ov.style.display !== "none") _closeViewer();
  });

  // ----------------------------------------------------------
  // FIX 2 — Firebase Storage upload (replaces Cloudinary)
  // ----------------------------------------------------------
  async function _uploadToStorage(file) {
    var s    = window.storage;
    var user = window.currentUser;
    if (!s || !user) throw new Error("Firebase Storage not ready");

    var safeName = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    var path = "chat_uploads/" + user.uid + "/" +
               Date.now() + "_" +
               Math.random().toString(36).slice(2, 8) + "_" + safeName;

    var ref  = s.ref(path);
    var task = ref.put(file);

    task.on("state_changed", function (snap) {
      var pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
      if (typeof window.showToast === "function") {
        window.showToast("Uploading\u2026 " + pct + "%", "info");
      }
    });

    await task;
    return await ref.getDownloadURL();
  }

  // Override all upload paths used by the chat app
  window.uploadToCloudinary  = _uploadToStorage;
  window.uploadDocument      = _uploadToStorage;
  window.uploadRecordedMedia = _uploadToStorage;

  console.log("[fixes.js v2] Loaded \u2014 viewer + upload active.");
})();
