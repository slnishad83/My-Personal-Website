// ========================================================
// whatsapp-share.js  v1
// Adds two options to every message long-press menu:
//   1. "Share to WhatsApp"  — opens wa.me link with message text
//   2. "Save to My Notes"   — forwards message to Saved Messages
//
// Works in browser AND Android Capacitor app.
// Place in works/chat/ and add before </body> in index.html:
//   <script src="whatsapp-share.js" defer></script>
// ========================================================

(function () {
  'use strict';

  // ── Wait until the core app globals are ready ───────────────
  let _tries = 0;
  function waitForApp(cb) {
    if (typeof showContextMenu === 'function' && typeof db !== 'undefined') {
      cb();
    } else if (_tries++ < 120) {
      setTimeout(() => waitForApp(cb), 250);
    } else {
      console.warn('[wa-share] Core app not found after 30s, giving up.');
    }
  }

  // ── Share to WhatsApp ────────────────────────────────────────
  function shareToWhatsApp(messageData) {
    const text = (messageData.text || '').trim();
    const caption = messageData.attachment?.caption || '';
    const combined = [text, caption].filter(Boolean).join('\n');

    if (!combined) {
      if (typeof showToast === 'function') showToast('No text to share', 'error');
      return;
    }

    const url = 'https://wa.me/?text=' + encodeURIComponent(combined);

    // On Android Capacitor: use native browser plugin if available, else window.open
    const BrowserPlugin = window.Capacitor?.Plugins?.Browser;
    if (BrowserPlugin?.open) {
      BrowserPlugin.open({ url });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  // ── Save to My Notes (Saved Messages) ───────────────────────
  async function saveToMyNotes(messageData) {
    if (typeof currentUser === 'undefined' || !currentUser) {
      if (typeof showToast === 'function') showToast('Please sign in first', 'error');
      return;
    }

    const chatId = typeof getSavedMessagesChatId === 'function'
      ? getSavedMessagesChatId()
      : `saved_${currentUser.uid}`;

    if (!chatId) return;

    // Ensure the saved-messages Firestore doc exists
    try {
      const chatRef = db.collection('directChats').doc(chatId);
      const snap = await chatRef.get();
      if (!snap.exists) {
        await chatRef.set({
          participants: [currentUser.uid],
          status: 'active',
          saved: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn('[wa-share] Could not ensure saved-messages doc:', e);
    }

    const senderName = messageData.senderName || currentUser.displayName || 'Me';
    const originalTime = messageData.timestamp
      ? (messageData.timestamp.toDate
          ? messageData.timestamp.toDate().toLocaleString()
          : new Date(messageData.timestamp).toLocaleString())
      : '';
    const header = originalTime
      ? `Forwarded from ${senderName} (${originalTime}):\n`
      : `Forwarded from ${senderName}:\n`;
    const body = (messageData.text || '').trim();
    const textToSave = body ? header + body : '';

    const msgDoc = {
      directId: chatId,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email || 'Me',
      receiverId: currentUser.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      readBy: { [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp() },
      ...(textToSave ? { text: textToSave } : {}),
    };

    // Forward attachment if present
    if (messageData.attachment) {
      msgDoc.attachment = { ...messageData.attachment };
      if (!textToSave) msgDoc.text = header.trim();
    }

    try {
      await db.collection('messages').add(msgDoc);
      if (typeof showToast === 'function') showToast('Saved to My Notes ⭐', 'success');
    } catch (e) {
      console.error('[wa-share] Save to notes failed:', e);
      if (typeof showToast === 'function') showToast('Could not save to notes', 'error');
    }
  }

  // ── Inject extra buttons via DOM MutationObserver ───────────
  // We watch for .message-context-menu being added, then append our buttons.
  // This is non-invasive — no patching of existing functions needed.
  function injectMenuItems(menu, messageData) {
    // Avoid double-injection
    if (menu.dataset.waShareInjected) return;
    menu.dataset.waShareInjected = 'true';

    const text = (messageData?.text || '').trim();
    const hasText = Boolean(text || messageData?.attachment?.caption);

    // "Share to WhatsApp" — only when there is text/caption to share
    if (hasText) {
      const waBtn = document.createElement('button');
      waBtn.type = 'button';
      waBtn.className = 'context-menu-item wa-share-btn';
      waBtn.innerHTML = '<span class="wa-share-icon">📤</span> Share to WhatsApp';
      waBtn.addEventListener('click', () => {
        if (typeof removeMessageContextMenu === 'function') removeMessageContextMenu();
        shareToWhatsApp(messageData);
      });
      menu.appendChild(waBtn);
    }

    // "Save to My Notes" — always available (forwards text + attachments)
    const notesBtn = document.createElement('button');
    notesBtn.type = 'button';
    notesBtn.className = 'context-menu-item wa-notes-btn';
    notesBtn.innerHTML = '<span class="wa-notes-icon">⭐</span> Save to My Notes';
    notesBtn.addEventListener('click', () => {
      if (typeof removeMessageContextMenu === 'function') removeMessageContextMenu();
      saveToMyNotes(messageData);
    });
    menu.appendChild(notesBtn);
  }

  // ── MutationObserver: watch for context menu appearing ──────
  function observeContextMenus() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (!node.classList.contains('message-context-menu')) continue;
          // Retrieve message data from the currently selected message element
          // The app stores messageId in the long-press handler; we read dataset
          const msgId = node.dataset?.messageId || '';
          // Read messageData from the closest .message element that has focus
          let messageData = null;
          try {
            // Try global map used by the app
            if (typeof window._lastContextMenuMessageData !== 'undefined') {
              messageData = window._lastContextMenuMessageData;
            }
          } catch (_) {}
          injectMenuItems(node, messageData || {});
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: false });
  }

  // ── Patch showContextMenu to capture messageData ─────────────
  // We wrap the existing function once to record the messageData
  // so the MutationObserver can access it.
  function patchShowContextMenu() {
    const original = window.showContextMenu;
    if (!original || typeof original !== 'function') return;
    window.showContextMenu = function (x, y, messageId, messageData, isMyMessage) {
      window._lastContextMenuMessageData = messageData || null;
      return original.call(this, x, y, messageId, messageData, isMyMessage);
    };
  }

  // ── Boot ────────────────────────────────────────────────────
  function boot() {
    patchShowContextMenu();
    observeContextMenus();
    if (window.__DEBUG__) console.log('[wa-share] Share to WhatsApp + Save to My Notes ready');
  }

  waitForApp(boot);
})();
