/* =============================================
   ATTACHMENT RELIABILITY v1.0 — #26
   Upload retry (3× exponential backoff),
   download progress tracking, network recovery,
   file size validation.
   ============================================= */
(function () {
  'use strict';

  const MAX_RETRIES  = 3;
  const RETRY_BASE   = 1500;

  /* ─── Status badge in message bubble ───────────────────────── */
  function showBubbleStatus(localId, text, type) {
    if (!localId) return;
    const bubble = document.querySelector('[data-local-id="' + CSS.escape(String(localId)) + '"]');
    if (!bubble) return;
    let el = bubble.querySelector('.tc-attach-status');
    if (!el) {
      el = document.createElement('span');
      el.className = 'tc-attach-status';
      bubble.appendChild(el);
    }
    el.textContent = text;
    el.className = 'tc-attach-status tc-attach-status--' + (type || 'info');
    if (type === 'done') setTimeout(() => el.remove(), 2000);
  }

  /* ─── Retry wrapper ─────────────────────────────────────────── */
  async function withRetry(fn, localId, attempt) {
    attempt = attempt || 0;
    try { return await fn(); } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      const delay = RETRY_BASE * Math.pow(2, attempt);
      showBubbleStatus(localId, 'Retrying (' + (attempt+1) + '/' + MAX_RETRIES + ')…', 'warn');
      await new Promise(r => setTimeout(r, delay));
      return withRetry(fn, localId, attempt + 1);
    }
  }

  /* ─── Patch upload functions ────────────────────────────────── */
  function patchUploaders() {
    ['uploadFile','uploadAttachment','uploadMedia','sendFileMessage'].forEach(function(name) {
      var orig = window[name];
      if (typeof orig !== 'function') {
        if (window.__DEBUG__) console.warn('[AttachmentReliability] ' + name + ' not found — retry patch deferred');
        return;
      }
      window[name] = async function() {
        const localId = (arguments[arguments.length-1]||{}).localId || null;
        try {
          showBubbleStatus(localId, 'Uploading…', 'info');
          const result = await withRetry(() => orig.apply(this, arguments), localId);
          showBubbleStatus(localId, 'Sent ✓', 'done');
          return result;
        } catch (err) {
          showBubbleStatus(localId, 'Upload failed — tap to retry', 'error');
          throw err;
        }
      };
    });
  }

  /* ─── Network recovery: nudge error bubbles on reconnect ────── */
  var _onOnline = null;
  var _onOffline = null;
  var _onDownloadClick = null;
  var _onFileChange = null;

  function initNetworkRecovery() {
    let wasOffline = !navigator.onLine;
    _onOnline = function () {
      if (!wasOffline) return;
      wasOffline = false;
      document.querySelectorAll('.tc-attach-status--error').forEach(el => {
        el.textContent = 'Reconnected — please resend';
      });
    };
    _onOffline = function () { wasOffline = true; };
    window.addEventListener('online', _onOnline);
    window.addEventListener('offline', _onOffline);
  }

  /* ─── Download progress via XHR ────────────────────────────── */
  function initDownloadProgress() {
    _onDownloadClick = function (e) {
      const link = e.target.closest('a.pdf-attachment-card, a.attachment-download, .tc-download-btn');
      if (!link || !link.href || !/^https?:\/\//.test(link.href)) return;
      e.preventDefault();
      const href = link.href;

      let prog = link.querySelector('.tc-dl-progress');
      if (!prog) {
        prog = document.createElement('div');
        prog.className = 'tc-dl-progress';
        prog.innerHTML = '<div class="tc-dl-bar"></div><span class="tc-dl-text">Downloading…</span>';
        link.appendChild(prog);
      }
      const bar  = prog.querySelector('.tc-dl-bar');
      const txt  = prog.querySelector('.tc-dl-text');

      const xhr = new XMLHttpRequest();
      xhr.open('GET', href, true);
      xhr.responseType = 'blob';
      xhr.onprogress = e => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded/e.total)*100);
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = 'Downloading… ' + pct + '%';
        }
      };
      xhr.onload = () => {
        prog.remove();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(xhr.response);
        a.download = href.split('/').pop().split('?')[0] || 'download';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        if (typeof showToast === 'function') showToast('File saved to Downloads', 'success');
      };
      xhr.onerror = () => {
        if (txt) txt.textContent = 'Download failed — tap to retry';
        if (bar) { bar.style.width = '100%'; bar.style.background = '#ef4444'; }
      };
      xhr.send();
    };
    document.addEventListener('click', _onDownloadClick);
  }

  /* ─── File size validation ──────────────────────────────────── */
  function initFileValidation() {
    const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
    _onFileChange = function (e) {
      if (e.target.type !== 'file') return;
      const over = Array.from(e.target.files || []).filter(f => f.size > MAX_BYTES);
        if (over.length) {
        var msg = over.map(function(f){ return f.name; }).join(', ') + ' exceeds the 100 MB limit. Please choose a smaller file.';
        if (typeof showToast === 'function') showToast(msg, 'error');
        else if (window.__DEBUG__) console.warn('[AttachmentReliability] ' + msg);
        e.target.value = '';
      }
    };
    document.addEventListener('change', _onFileChange);
  }

  function init() {
    patchUploaders();
    initNetworkRecovery();
    initDownloadProgress();
    initFileValidation();
  }

  function destroy() {
    if (_onOnline) { window.removeEventListener('online', _onOnline); _onOnline = null; }
    if (_onOffline) { window.removeEventListener('offline', _onOffline); _onOffline = null; }
    if (_onDownloadClick) { document.removeEventListener('click', _onDownloadClick); _onDownloadClick = null; }
    if (_onFileChange) { document.removeEventListener('change', _onFileChange); _onFileChange = null; }
  }

  if (document.readyState === 'complete') setTimeout(init, 0);
  else window.addEventListener('load', () => setTimeout(init, 0));

  window.AttachmentReliability = { init, destroy };
})();
