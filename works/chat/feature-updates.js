/* =============================================
   FEATURE UPDATES v1.0
   #23 Typing indicators with name + animated dots
   #25 Enhanced doc/file thumbnails
   #26 Upload progress visibility
   #27/#28 Message info full date+time format
   ============================================= */
(function () {
  'use strict';

  /* ---- safe helpers ---- */
  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };
  function _bytes(b) {
    if (typeof window.formatBytes === 'function') return window.formatBytes(b);
    if (!b) return '';
    const u = ['B','KB','MB','GB']; let i = 0, v = Number(b);
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return v.toFixed(i > 0 ? 1 : 0) + ' ' + u[i];
  }

  /* ---- #27/#28 full date+time formatter ---- */
  function fmtInfoTime(val) {
    if (!val) return null;
    let d;
    try { d = typeof val.toDate === 'function' ? val.toDate() : new Date(val); } catch(e) { return null; }
    if (isNaN(d.getTime())) return null;
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${d.getDate()} ${mo[d.getMonth()]} ${d.getFullYear()} - ${h}:${mm} ${ampm}`;
  }

  /* ================================================
     #23 — TYPING INDICATOR
     Show name in personal chat + animated dots
     ================================================ */
  function patchTypingIndicator() {
    if (typeof window.listenForTypingIndicator !== 'function') return;

    window.listenForTypingIndicator = function () {
      const chat = window.currentChat;
      const user = window.currentUser;
      if (!chat || !user) return;

      if (typeof window.typingUnsubscribe === 'function') {
        window.typingUnsubscribe();
        window.typingUnsubscribe = null;
      }

      const statusEl = document.getElementById('chatStatus');
      const base = statusEl ? (statusEl.dataset.tcBase || statusEl.textContent || '') : '';
      if (statusEl) statusEl.dataset.tcBase = base;

      function renderTyping(users) {
        if (!statusEl) return;
        if (!users.length) {
          statusEl.textContent = statusEl.dataset.tcBase || '';
          return;
        }
        const names = users.map(u => u.userName || 'Someone');
        let label;
        if (names.length === 1)      label = names[0] + ' is typing';
        else if (names.length === 2) label = names[0] + ' and ' + names[1] + ' are typing';
        else                         label = names.length + ' people are typing';

        statusEl.innerHTML =
          _esc(label) +
          '<span class="tc-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
      }

      try {
        window.typingUnsubscribe = window.db
          .collection('typingIndicators')
          .where('chatId', '==', chat.id)
          .onSnapshot(
            snap => {
              const typing = snap.docs
                .map(d => d.data())
                .filter(d => d.userId !== user.uid && d.isTyping);
              renderTyping(typing);
            },
            err => console.warn('[TC] typing indicator error', err)
          );
      } catch (e) {
        console.warn('[TC] could not set up typing indicator', e);
      }
    };
  }

  /* ================================================
     #25 — ENHANCED DOC / FILE THUMBNAILS
     ================================================ */
  function docTypeClass(ext) {
    const e = (ext || '').toLowerCase();
    if (e === 'pdf')                          return 'type-pdf';
    if (['doc','docx'].includes(e))           return 'type-doc';
    if (['xls','xlsx','csv'].includes(e))     return 'type-xls';
    if (['ppt','pptx'].includes(e))           return 'type-ppt';
    if (['zip','rar','7z','tar','gz'].includes(e)) return 'type-zip';
    if (e === 'txt')                          return 'type-txt';
    return 'type-default';
  }

  function patchRenderAttachment() {
    if (typeof window.renderAttachment !== 'function') return;
    const _orig = window.renderAttachment;

    window.renderAttachment = function (attachment) {
      if (!attachment || !attachment.url) return _orig.apply(this, arguments);
      const type = (attachment.type || '').toLowerCase();
      // Leave image / gif / video / audio / voice to original renderer
      if (['image','gif','video','audio','voice'].includes(type)) {
        return _orig.apply(this, arguments);
      }
      if (!/^https?:\/\//i.test(attachment.url)) return _orig.apply(this, arguments);

      const url      = _esc(attachment.url);
      const rawName  = attachment.filename
        || attachment.url.split('/').pop().split('?')[0]
        || 'File';
      const filename = _esc(rawName);
      const ext      = rawName.includes('.') ? rawName.split('.').pop() : 'FILE';
      const extUp    = ext.toUpperCase();
      const cls      = docTypeClass(ext);
      const size     = attachment.size ? _bytes(attachment.size) : '';
      const meta     = _esc([extUp + ' file', size].filter(Boolean).join(' · '));

      return `<div class="message-attachment">
  <a class="pdf-attachment-card"
     href="${url}" target="_blank" rel="noopener noreferrer"
     data-preview-url="${url}" data-filename="${filename}"
     aria-label="Open ${filename}">
    <div class="pdf-thumb-icon ${cls}" aria-hidden="true">${_esc(extUp)}</div>
    <div class="pdf-attach-info">
      <div class="pdf-attach-name" title="${filename}">${filename}</div>
      <div class="pdf-attach-meta">${meta}</div>
    </div>
  </a>
</div>`;
    };
  }

  /* ================================================
     #27 / #28 — MESSAGE INFO full date+time
     Temporarily swap formatWhen during showMessageInfo
     ================================================ */
  function patchMessageInfo() {
    if (typeof window.showMessageInfo !== 'function') return;
    const _origShow = window.showMessageInfo;
    const _origFmt  = window.formatWhen;

    window.showMessageInfo = async function () {
      // Swap formatter
      if (typeof window.formatWhen === 'function') {
        window.formatWhen = fmtInfoTime;
      }
      try {
        await _origShow.apply(this, arguments);
      } finally {
        // Always restore
        window.formatWhen = _origFmt;
      }
    };
  }

  /* ================================================
     #26 — UPLOAD PROGRESS VISIBILITY
     Intercept Firebase Storage upload tasks and
     inject a slim progress bar into the sending bubble
     ================================================ */
  function patchUploadProgress() {
    // Only patch if firebase storage is available
    if (!window.firebase || !window.firebase.storage) return;

    const _origRef = firebase.storage().ref.bind(firebase.storage());

    // We inject progress UI when a message bubble is in "pending" state
    // and a file upload is detected via the tc-upload-progress class
    document.addEventListener('tc:upload:start', function (e) {
      const { task, localId } = e.detail || {};
      if (!task || !localId) return;
      const bubble = document.querySelector(`[data-local-id="${CSS.escape(localId)}"]`);
      if (!bubble) return;

      let wrap = bubble.querySelector('.tc-upload-progress-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'tc-upload-progress-wrap';
        wrap.innerHTML = '<div class="tc-upload-progress-bar"></div>';
        const statusText = document.createElement('span');
        statusText.className = 'tc-upload-status-text';
        statusText.textContent = 'Uploading…';
        bubble.appendChild(wrap);
        bubble.appendChild(statusText);
      }
      const bar = wrap.querySelector('.tc-upload-progress-bar');
      const txt = bubble.querySelector('.tc-upload-status-text');

      task.on('state_changed',
        snap => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100) || 0;
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = `Uploading… ${pct}%`;
        },
        _err => {
          if (txt) txt.textContent = 'Upload failed — tap Retry';
          if (bar) { bar.style.width = '100%'; bar.style.background = '#ef4444'; }
        },
        () => {
          if (wrap) wrap.remove();
          if (txt) txt.remove();
        }
      );
    });
  }

  /* ================================================
     INIT
     ================================================ */
  function init() {
    patchTypingIndicator();
    patchRenderAttachment();
    patchMessageInfo();
    patchUploadProgress();
  }

  // Run after all deferred scripts have executed
  if (document.readyState === 'complete') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 0); });
  }
})();
