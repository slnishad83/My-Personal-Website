/* ============================================================
   Universal Message Copy (UC-1)
   Copies ANY message type intelligently:
   - Text: copies formatted text
   - Image/Video: copies caption + URL
   - Voice: copies transcript or "[Voice message]"
   - Document: copies filename + URL
   - Location: copies address/coordinates + map URL
   - Contact: copies name + phone + email
   - Poll: copies question + options + results
   ============================================================ */
(function () {
  'use strict';

  /* ─── Fallback copy for older browsers ─────────────────────── */
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {
      if (window.__DEBUG__) console.warn('[MessageCopy] execCommand copy fallback failed; clipboard API may be required.');
    }
    document.body.removeChild(ta);
  }

  /* ─── Copy text to clipboard with toast ────────────────────── */
  function copyToClipboard(text, label) {
    if (!text) {
      if (typeof showToast === 'function') showToast('Nothing to copy', 'info');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          if (typeof showToast === 'function') {
            showToast(label ? `Copied: ${label}` : 'Copied to clipboard', 'success');
          }
        })
        .catch(() => {
          fallbackCopy(text);
          if (typeof showToast === 'function') showToast('Copied to clipboard', 'success');
        });
    } else {
      fallbackCopy(text);
      if (typeof showToast === 'function') showToast('Copied to clipboard', 'success');
    }
  }

  /* ─── Find message object by ID ────────────────────────────── */
  function findMessage(msgId) {
    if (!msgId) return null;
    const chatId = window.App?.currentChat?.id || window.currentChat?.id;
    if (chatId && window.App?.messages?.[chatId]) {
      const msgs = window.App.messages[chatId];
      return msgs.find(m => m.id === msgId) || null;
    }
    // Fallback: search all messages
    if (window.App?.messages) {
      for (const cid of Object.keys(window.App.messages)) {
        const found = window.App.messages[cid].find(m => m.id === msgId);
        if (found) return found;
      }
    }
    return null;
  }

  /* ─── Format message content by type ───────────────────────── */
  function formatCopyText(msg) {
    if (!msg) return '';

    const _sender = msg.senderName || msg.displayName || '';
    var ts = msg.createdAt || msg.timestamp;
    const _time = ts ? (typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)).toLocaleString() : '';

    switch (msg.type) {
      case 'image': {
        const caption = msg.text || msg.caption || '';
        const url = msg.attachment?.url || msg.url || msg.mediaUrl || '';
        const parts = [];
        if (caption) parts.push(caption);
        if (url) parts.push(url);
        return parts.join('\n') || '[Image]';
      }

      case 'video': {
        const caption = msg.text || msg.caption || '';
        const url = msg.attachment?.url || msg.url || msg.mediaUrl || '';
        const parts = [];
        if (caption) parts.push(caption);
        if (url) parts.push(url);
        return parts.join('\n') || '[Video]';
      }

      case 'voice':
      case 'audio': {
        const transcript = msg.text || msg.transcript || '';
        const duration = msg.attachment?.duration || msg.duration || '';
        const url = msg.attachment?.url || msg.url || '';
        const parts = [];
        if (transcript) parts.push(transcript);
        else parts.push('[Voice message]');
        if (duration) parts.push(`Duration: ${duration}s`);
        if (url) parts.push(url);
        return parts.join('\n');
      }

      case 'doc':
      case 'document': {
        const name = msg.attachment?.name || msg.fileName || msg.text || 'Document';
        const url = msg.attachment?.url || msg.url || '';
        const size = msg.attachment?.size || '';
        const parts = [name];
        if (size) parts.push(`Size: ${formatBytes(size)}`);
        if (url) parts.push(url);
        return parts.join('\n');
      }

      case 'location': {
        const lat = msg.latitude || msg.attachment?.latitude || '';
        const lng = msg.longitude || msg.attachment?.longitude || '';
        const addr = msg.text || msg.address || msg.attachment?.address || '';
        const isLive = msg.locationExpiry || msg.attachment?.expiry;
        const parts = [];
        if (addr) parts.push(addr);
        if (lat && lng) {
          parts.push(`Coordinates: ${lat}, ${lng}`);
          parts.push(`https://www.google.com/maps?q=${lat},${lng}`);
        }
        if (isLive) parts.push('[Live location]');
        return parts.join('\n') || '[Location]';
      }

      case 'contact': {
        const name = msg.contactName || msg.text || msg.attachment?.name || '';
        const phone = msg.contactPhone || msg.attachment?.phone || '';
        const email = msg.contactEmail || msg.attachment?.email || '';
        const parts = [];
        if (name) parts.push(`Name: ${name}`);
        if (phone) parts.push(`Phone: ${phone}`);
        if (email) parts.push(`Email: ${email}`);
        return parts.join('\n') || '[Contact]';
      }

      case 'poll': {
        const question = msg.pollQuestion || msg.text || msg.attachment?.question || '';
        const options = msg.pollOptions || msg.attachment?.options || [];
        const votes = msg.pollVotes || msg.attachment?.votes || {};
        const parts = [];
        if (question) parts.push(`Poll: ${question}`);
        if (Array.isArray(options)) {
          options.forEach((opt, i) => {
            const text = typeof opt === 'string' ? opt : opt.text || opt.option || '';
            const count = votes[i] || votes[text] || 0;
            parts.push(`  ${i + 1}. ${text} (${count} votes)`);
          });
        }
        return parts.join('\n') || '[Poll]';
      }

      case 'call':
      case 'call-answered':
      case 'call-declined': {
        return msg.text || `[${msg.type === 'call-declined' ? 'Missed call' : 'Call'}]`;
      }

      case 'sticker': {
        return msg.text || '[Sticker]';
      }

      // Default: text messages and unknown types
      default: {
        const text = msg.text || msg.message || msg.body || msg.content || '';
        return text || '';
      }
    }
  }

  /* ─── Format bytes helper ──────────────────────────────────── */
  function formatBytes(bytes) {
    if (!bytes) return '';
    bytes = Number(bytes);
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  /* ─── Get type-specific label for toast ────────────────────── */
  function getCopyLabel(msg) {
    if (!msg) return '';
    const type = msg.type || 'text';
    const labels = {
      text: 'message',
      image: 'image & caption',
      video: 'video & caption',
      voice: 'voice message',
      audio: 'audio',
      doc: 'document',
      document: 'document',
      location: 'location',
      contact: 'contact',
      poll: 'poll',
      sticker: 'sticker'
    };
    return labels[type] || 'message';
  }

  /* ─── Universal copy function ──────────────────────────────── */
  function copyMessageContent(msgId) {
    const msg = findMessage(msgId);
    if (!msg) {
      if (typeof showToast === 'function') showToast('Message not found', 'error');
      return;
    }
    const text = formatCopyText(msg);
    const label = getCopyLabel(msg);
    copyToClipboard(text, label);
  }

  /* ─── Hook into existing copyMsgText ───────────────────────── */
  function hookCopyMsgText() {
    const orig = window.copyMsgText;
    window.copyMsgText = function (msgId) {
      copyMessageContent(msgId);
    };
    // Keep original as backup
    window._origCopyMsgText = orig;
  }

  /* ─── Hook into desktop context menu copy ──────────────────── */
  function hookDesktopContextMenu() {
    // The desktop context menu creates its own copy action.
    // We intercept by watching for context menu creation and replacing the copy action.
    const observer = new MutationObserver(() => {
      const menu = document.getElementById('desktop-context-menu');
      if (!menu) return;
      const copyBtn = Array.from(menu.querySelectorAll('button')).find(
        b => b.textContent.includes('Copy') && !b.textContent.includes('URL')
      );
      if (copyBtn && !copyBtn._ucHooked) {
        copyBtn._ucHooked = true;
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Find the message element that was right-clicked
          const msgEl = e.target.closest('.message[data-msg-id]') || e.target.closest('[data-msg-id]');
          if (msgEl) {
            copyMessageContent(msgEl.dataset.msgId);
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ─── Hook into keyboard Ctrl+C ────────────────────────────── */
  function hookKeyboardCopy() {
    document.addEventListener('keydown', (e) => {
      // Only intercept Ctrl+C when not in an input/textarea and when a message is "active"
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

        // Check if there's a selected/hovered message
        const hovered = document.querySelector('.message:hover[data-msg-id]');
        if (hovered) {
          e.preventDefault();
          copyMessageContent(hovered.dataset.msgId);
        }
      }
    });
  }

  /* ─── Hook long-press copy option ──────────────────────────── */
  function hookLongPressCopy() {
    // Watch for the quick reaction bar and enhance its copy button
    const observer = new MutationObserver(() => {
      const menu = document.getElementById('_msg-ctx-menu');
      if (!menu) return;
      const copyBtn = Array.from(menu.querySelectorAll('div, button')).find(
        el => el.textContent.includes('Copy')
      );
      if (copyBtn && !copyBtn._ucHooked) {
        copyBtn._ucHooked = true;
        // Override the existing copy to use our universal copy
        const msgId = copyBtn.closest('[data-msg-id]')?.dataset?.msgId
          || menu.dataset?.msgId
          || null;
        if (msgId) {
          copyBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            copyMessageContent(msgId);
          };
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ─── Add "Copy" option to ALL message type context menus ──── */
  function addCopyToAllMenus() {
    // For messages that previously had no copy option (non-text),
    // we now ensure copy is always available via the existing copyMsgText hook
    // which we've already overridden above.
  }

  /* ─── Init ─────────────────────────────────────────────────── */
  function init() {
    hookCopyMsgText();
    hookDesktopContextMenu();
    hookKeyboardCopy();
    hookLongPressCopy();
    addCopyToAllMenus();
  }

  // Expose API
  window.MessageCopy = {
    copy: copyMessageContent,
    formatText: formatCopyText
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
