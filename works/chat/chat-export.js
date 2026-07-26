// Chat Export — export chat as PDF or text file
(function() {
  'use strict';

  window.openChatExport = function() {
    if (!App.currentChat) { window.showToast?.('Open a chat first', 'info'); return; }

    const overlay = document.createElement('div');
    overlay.id = 'chat-export-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:500px;color:var(--on-surface)';

    const chatName = App.currentChat.name || App.currentChat.displayName || 'Chat';
    const msgCount = (App.messages[App.currentChat.id] || []).length;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:16px;font-weight:700">Export Chat</h3>
        <button onclick="document.getElementById('chat-export-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>
      <div style="padding:12px;border-radius:12px;background:var(--surface-container-low,rgba(0,0,0,0.04));margin-bottom:16px">
        <div style="font-size:13px;font-weight:600">${escHtml(chatName)}</div>
        <div style="font-size:11px;color:var(--on-surface-variant)">${msgCount} messages</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="exportChatAsText()" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;border:none;background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);cursor:pointer;text-align:left">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(76,175,80,0.15);display:flex;align-items:center;justify-content:center">
            <span class="material-symbols-outlined" style="color:#4CAF50;font-size:20px">text_snippet</span>
          </div>
          <div>
            <div style="font-size:13px;font-weight:600">Export as Text</div>
            <div style="font-size:11px;color:var(--on-surface-variant)">Plain text file (.txt)</div>
          </div>
        </button>
        <button onclick="exportChatAsHTML()" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;border:none;background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);cursor:pointer;text-align:left">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(33,150,243,0.15);display:flex;align-items:center;justify-content:center">
            <span class="material-symbols-outlined" style="color:#2196F3;font-size:20px">html</span>
          </div>
          <div>
            <div style="font-size:13px;font-weight:600">Export as HTML</div>
            <div style="font-size:11px;color:var(--on-surface-variant)">Formatted web page (.html)</div>
          </div>
        </button>
        <button onclick="exportChatAsJSON()" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;border:none;background:var(--surface-container-low,rgba(0,0,0,0.04));color:var(--on-surface);cursor:pointer;text-align:left">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,152,0,0.15);display:flex;align-items:center;justify-content:center">
            <span class="material-symbols-outlined" style="color:#FF9800;font-size:20px">data_object</span>
          </div>
          <div>
            <div style="font-size:13px;font-weight:600">Export as JSON</div>
            <div style="font-size:11px;color:var(--on-surface-variant)">Structured data (.json)</div>
          </div>
        </button>
      </div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  function _getMessages() {
    if (!App.currentChat) return [];
    return (App.messages[App.currentChat.id] || []).slice().sort((a, b) => (a.time || 0) - (b.time || 0));
  }

  function _formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString();
  }

  function _getMsgText(msg) {
    if (msg.text) return msg.text;
    if (msg.type === 'image') return '[Image]';
    if (msg.type === 'video') return '[Video]';
    if (msg.type === 'audio' || msg.type === 'voice') return '[Audio/Voice]';
    if (msg.type === 'document') return '[Document: ' + (msg.attachment?.name || 'file') + ']';
    if (msg.type === 'location') return '[Location]';
    if (msg.type === 'contact') return '[Contact: ' + (msg.attachment?.contactName || '') + ']';
    if (msg.type === 'poll') return '[Poll: ' + (msg.poll?.question || msg.text || '') + ']';
    if (msg.type === 'system') return '[System] ' + (msg.text || '');
    if (msg.type === 'sticker') return '[Sticker]';
    return msg.text || '[Attachment]';
  }

  window.exportChatAsText = function() {
    const msgs = _getMessages();
    const chatName = App.currentChat.name || App.currentChat.displayName || 'Chat';
    let txt = `Chat: ${chatName}\nExported: ${new Date().toLocaleString()}\nMessages: ${msgs.length}\n${'='.repeat(50)}\n\n`;

    msgs.forEach(msg => {
      const sender = msg.senderName || msg.senderId || 'Unknown';
      const time = _formatTime(msg.time || msg.timestamp);
      const text = _getMsgText(msg);
      txt += `[${time}] ${sender}: ${text}\n`;
    });

    _downloadFile(txt, `chat-${chatName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.txt`, 'text/plain');
    document.getElementById('chat-export-overlay')?.remove();
    window.showToast?.('Exported as text', 'success');
  };

  window.exportChatAsHTML = function() {
    const msgs = _getMessages();
    const chatName = App.currentChat.name || App.currentChat.displayName || 'Chat';

    const _eh = (typeof escHtml === 'function' ? escHtml : (s) => String(s ?? ''));
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chat: ${_eh(chatName)}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:800px;margin:0 auto;padding:20px;background:#0d1117;color:#e6edf3}
      h1{color:#58a6ff;border-bottom:1px solid #30363d;padding-bottom:10px}
      .msg{padding:8px 12px;margin:4px 0;border-radius:8px;background:#161b22;border:1px solid #30363d}
      .msg.me{background:#1a2332;border-color:#1f6feb44}
      .sender{font-weight:700;color:#58a6ff;font-size:13px}
      .time{color:#8b949e;font-size:11px;margin-left:8px}
      .text{margin-top:4px;font-size:14px;line-height:1.5}
      .system{text-align:center;color:#8b949e;font-style:italic;font-size:12px}
      .meta{color:#8b949e;font-size:11px;margin-top:10px;border-top:1px solid #30363d;padding-top:10px}
    </style></head><body>
    <h1>💬 ${_eh(chatName)}</h1>
    <div class="meta">Exported: ${new Date().toLocaleString()} · ${msgs.length} messages</div>`;

    msgs.forEach(msg => {
      const sender = msg.senderName || msg.senderId || 'Unknown';
      const time = _formatTime(msg.time || msg.timestamp);
      const text = _getMsgText(msg);
      const isMe = msg.senderId === App.auth?.currentUser?.uid;
      const isSystem = msg.type === 'system';

      if (isSystem) {
        html += `<div class="msg system">${_eh(text)}</div>`;
      } else {
        html += `<div class="msg${isMe ? ' me' : ''}">
          <span class="sender">${_eh(sender)}</span><span class="time">${time}</span>
          <div class="text">${_eh(text)}</div>
        </div>`;
      }
    });

    html += '</body></html>';
    _downloadFile(html, `chat-${chatName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.html`, 'text/html');
    document.getElementById('chat-export-overlay')?.remove();
    window.showToast?.('Exported as HTML', 'success');
  };

  window.exportChatAsJSON = function() {
    const msgs = _getMessages();
    const chatName = App.currentChat.name || App.currentChat.displayName || 'Chat';

    const data = {
      chatName,
      exportedAt: new Date().toISOString(),
      messageCount: msgs.length,
      messages: msgs.map(msg => ({
        id: msg.id,
        sender: msg.senderName || msg.senderId,
        senderId: msg.senderId,
        text: msg.text || '',
        type: msg.type || 'text',
        time: msg.time || msg.timestamp,
        attachment: msg.attachment || null,
        reactions: msg.reactions || [],
      })),
    };

    _downloadFile(JSON.stringify(data, null, 2), `chat-${chatName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.json`, 'application/json');
    document.getElementById('chat-export-overlay')?.remove();
    showToast('Exported as JSON', 'success');
  };

  function _downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

})();
