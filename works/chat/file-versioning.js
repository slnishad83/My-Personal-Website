// File Versioning â€” track file versions, link new uploads to previous versions
(function() {
  'use strict';

  const _origSendFileMessage = window._sendFileMessage;

  async function _sendFileMessageWithVersioning(file, _unused, extraMeta) {
    if (!App.currentChat || !App.db) {
      return _origSendFileMessage ? _origSendFileMessage(file, _unused, extraMeta) : Promise.resolve();
    }

    const chatId = App.currentChat.id;
    const isGroup = App.currentChat.type === 'group';
    const fileName = file.name;

    let version = 1;
    let previousVersionId = null;


    try {
      let query = App.db.collection('messages')
        .where('attachment.filename', '==', fileName);

      if (isGroup) {
        query = query.where('groupId', '==', chatId);
      } else {
        query = query.where('directId', '==', chatId);
      }

      const snap = await query.orderBy('timestamp', 'desc').limit(1).get();
      if (!snap.empty) {
        const prev = snap.docs[0];
        const prevData = prev.data();
        version = (prevData.attachment?.version || 0) + 1;
        previousVersionId = prev.id;
        // previousVersionUrl reserved for future restore feature
      }
    } catch (e) {
      if (window.__DEBUG__) console.warn('File versioning: query failed (index may be building)', e);
    }

    if (!extraMeta) extraMeta = {};
    extraMeta.version = version;
    extraMeta.previousVersionId = previousVersionId;

    const result = await _origSendFileMessage(file, _unused, extraMeta);

    if (previousVersionId && App.db) {
      try {
        const messages = App.messages[chatId] || [];
        const latest = messages[messages.length - 1];
        if (latest && latest.firebaseId) {
          await App.db.collection('messages').doc(chatId).collection('items').doc(latest.firebaseId).update({
            'attachment.version': version,
            'attachment.previousVersionId': previousVersionId,
          });
        }
      } catch (e) {
        if (window.__DEBUG__) console.warn('File versioning: failed to update version metadata', e);
      }
    }

    return result;
  }

  window._sendFileMessage = _sendFileMessageWithVersioning;

  window.openFileVersionHistory = function(msgId) {
    const chatId = App.currentChat?.id;
    if (!chatId || !App.messages[chatId]) return;

    const msg = App.messages[chatId].find(m => m.id === msgId);
    if (!msg || !msg.fileName) return;

    const versions = App.messages[chatId]
      .filter(m => m.fileName === msg.fileName && m.url)
      .sort((a, b) => (b.version || 1) - (a.version || 1));

    if (versions.length < 2) {
      showToast('This is the only version', 'info');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'file-version-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:16px;padding:24px;max-width:420px;width:90vw;max-height:80vh;overflow-y:auto;color:var(--on-surface,#fff)';

    let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
    html += '<h3 style="margin:0;font-size:18px;font-weight:700">Version History</h3>';
    html += '<button onclick="document.getElementById(\'file-version-overlay\')?.remove()" style="background:none;border:none;color:var(--on-surface-variant,#aaa);cursor:pointer;font-size:20px">&times;</button>';
    html += '</div>';
    html += `<p style="font-size:13px;color:var(--on-surface-variant,#aaa);margin:0 0 16px">${versions.length} versions of "${msg.fileName}"</p>`;

    versions.forEach((v, i) => {
      const isActive = v.id === msgId;
      const border = isActive ? '2px solid var(--primary,#7C4DFF)' : '1px solid var(--outline-variant,rgba(0,0,0,0.1))';
      const time = new Date(v.time || Date.now()).toLocaleString();
      html += `<div style="border:${border};border-radius:12px;padding:12px;margin-bottom:8px;background:${isActive ? 'rgba(124,77,255,0.1)' : 'var(--surface-container-low,rgba(0,0,0,0.03))'};cursor:pointer" onclick="window.open('${v.url}','_blank')">`;
      html += '<div style="display:flex;justify-content:space-between;align-items:center">';
      html += `<span style="font-size:14px;font-weight:600">v${v.version || (versions.length - i)}</span>`;
      html += `<span style="font-size:11px;color:var(--on-surface-variant,#aaa)">${time}</span>`;
      html += '</div>';
      html += `<div style="font-size:12px;color:var(--on-surface-variant,#aaa);margin-top:4px">${v.fileSize || ''}</div>`;
      if (isActive) {
        html += '<div style="font-size:11px;color:var(--primary,#7C4DFF);margin-top:4px">Current version</div>';
      }
      html += '</div>';
    });

    panel.innerHTML = html;
    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  const origRenderMessages = window.renderMessages;
  if (typeof origRenderMessages === 'function') {
    window.renderMessages = function(chatId) {
      origRenderMessages(chatId);
      _addVersionBadges(chatId);
    };
  }

  function _addVersionBadges(chatId) {
    setTimeout(() => {
      const messages = App.messages[chatId] || [];
      messages.forEach(msg => {
        if (!msg.version || msg.version <= 1) return;
        const el = document.querySelector(`[data-msg-id="${msg.id}"]`);
        if (!el || el.querySelector('.version-badge')) return;

        const badge = document.createElement('div');
        badge.className = 'version-badge';
        badge.style.cssText = 'display:inline-flex;align-items:center;gap:3px;font-size:10px;color:var(--primary,#7C4DFF);cursor:pointer;margin-top:2px;padding:1px 6px;background:rgba(124,77,255,0.1);border-radius:8px;width:fit-content';
        badge.innerHTML = `<span class="material-symbols-outlined" style="font-size:12px">history</span>v${msg.version}`;
        badge.onclick = (e) => { e.stopPropagation(); openFileVersionHistory(msg.id); };

        const nameEl = el.querySelector('.file-name, .msg-file-name, [class*="fileName"]');
        if (nameEl) {
          nameEl.parentElement?.appendChild(badge);
        } else {
          el.appendChild(badge);
        }
      });
    }, 100);
  }

  window._addVersionBadges = _addVersionBadges;
})();
