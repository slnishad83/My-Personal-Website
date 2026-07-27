/* ============================================================
   Clipboard Paste Handler (D-C1)
   Handles paste of images, files, and text from clipboard on
   the main chat area — desktop & mobile.
   ============================================================ */
(function () {
  'use strict';

  const PASTE_TYPES = {
    image: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/webm'],
    audio: ['audio/mpeg', 'audio/ogg', 'audio/wav'],
    file: [
      'application/pdf', 'application/zip', 'application/x-rar-compressed',
      'text/plain', 'text/csv', 'application/json'
    ]
  };

  const MAX_PASTE_SIZE = 25 * 1024 * 1024; // 25 MB
  const MAX_PASTE_FILES = 10;

  function classifyMIME(type) {
    for (const [cat, mimes] of Object.entries(PASTE_TYPES)) {
      if (mimes.includes(type)) return cat;
    }
    return 'file';
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function showPasteError(msg) {
    if (typeof showToast === 'function') {
      showToast(msg, 'error');
    } else {
      console.warn('[ClipboardPaste]', msg);
    }
  }

  function dispatchFilesToComposer(files) {
    if (!files || files.length === 0) return;

    if (files.length > MAX_PASTE_FILES) {
      showPasteError(`Maximum ${MAX_PASTE_FILES} files at once.`);
      return;
    }

    const oversized = Array.from(files).find(f => f.size > MAX_PASTE_SIZE);
    if (oversized) {
      showPasteError(`File "${oversized.name}" exceeds ${formatBytes(MAX_PASTE_SIZE)} limit.`);
      return;
    }

    // Create a synthetic DataTransfer so existing drop handlers can consume the files
    const dt = new DataTransfer();
    Array.from(files).forEach(f => dt.items.add(f));

    const dropTarget = document.querySelector('#msg-input') ||
                       document.querySelector('#messages-wrap') ||
                       document.querySelector('#chat-area');

    if (dropTarget) {
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt
      });
      dropTarget.dispatchEvent(dropEvent);
    }

    // Fallback: if no drop handler processed it, try the file input
    if (dt.files.length > 0) {
      const fileInput = document.querySelector('#file-input, input[type="file"]');
      if (fileInput) {
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  function handlePasteEvent(e) {
    const clipData = e.clipboardData || window.clipboardData;
    if (!clipData) return;

    const items = clipData.items;
    if (!items || items.length === 0) return;

    const files = [];
    let _hasImage = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
          if (classifyMIME(file.type) === 'image') _hasImage = true;
        }
      }
    }

    // If files are pasted, prevent default and dispatch to composer
    if (files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      dispatchFilesToComposer(files);
      return;
    }

    // For text paste — let it flow normally into the input
    // (no interception needed, default behavior handles it)
  }

  function init() {
    // Listen on chat area for paste events
    const chatArea = document.querySelector('#chat-area') ||
                     document.querySelector('#messages-wrap') ||
                     document.body;

    if (chatArea) {
      chatArea.addEventListener('paste', handlePasteEvent, { capture: true });
    }

    // Also listen on the message input specifically
    const msgInput = document.querySelector('#msg-input');
    if (msgInput) {
      msgInput.addEventListener('paste', handlePasteEvent, { capture: true });
    }
  }

  // Init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
