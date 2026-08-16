/* ============================================================
   NSL CHAT — APP EXTRAS  v2.0
   All missing features: media viewer, voice, context menus,
   delete / forward / edit / react, search, uploads, groups, profile
   Loaded BEFORE app.js — shares global App state
   ============================================================ */
'use strict';

/* ══════════════════════════════════════════════════════════════
   1. MEDIA VIEWER — open/close/prev/next/download
   ══════════════════════════════════════════════════════════════ */

function _getSenderInfo(item) {
  if (!item.from || item.from === 'me') return { name: 'You', isMe: true };
  const contact = App.contacts.find(c => c.uid === item.from);
  if (contact) return { name: contact.name, isMe: false };
  const chat = App.chats.find(c => c.uid === item.from);
  if (chat) return { name: chat.name, isMe: false };
  return { name: 'Unknown', isMe: false };
}

function _formatViewerDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function openMediaViewer(msgIdOrUrl, forceType) {
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const gallery = msgs.filter(m => m.type === 'image' || m.type === 'video' || m.type === 'doc' || m.type === 'voice');

  let startIdx = gallery.findIndex(m => m.id === msgIdOrUrl || m.url === msgIdOrUrl);
  if (startIdx < 0) {
    App.mediaViewerItems = [{ type: forceType || 'image', url: msgIdOrUrl, id: '_single' }];
    startIdx = 0;
  } else {
    App.mediaViewerItems = gallery;
  }
  App.mediaViewerIndex = Math.max(0, startIdx);
  _renderMediaViewer();
  show('media-viewer');
  document.body.style.overflow = 'hidden';
}

function _renderMediaViewer() {
  const items = App.mediaViewerItems || [];
  const idx   = App.mediaViewerIndex;
  const item  = items[idx];
  if (!item) return;

  const content = document.getElementById('media-viewer-content');
  const caption = document.getElementById('media-viewer-caption');
  const captionSub = document.getElementById('media-viewer-caption-sub');
  if (!content) return;

  if (caption) {
    const sender = _getSenderInfo(item);
    const nameStr = sender.name;
    const position = items.length > 1 ? ` · ${idx + 1} / ${items.length}` : '';
    caption.textContent = `${nameStr}${position}`;
  }
  if (captionSub) {
    captionSub.textContent = _formatViewerDate(item.time || Date.now());
  }

  const isMsg = item.id && item.id !== '_single';
  const deleteBtn = document.getElementById('media-viewer-delete-btn');
  if (deleteBtn) deleteBtn.style.display = isMsg ? 'flex' : 'none';

  if (item.type === 'video') {
    content.innerHTML = `<video src="${escHtml(item.url)}" controls autoplay class="max-w-full max-h-full rounded-xl" style="max-height:85vh;max-width:90vw" playsinline></video>`;
  } else if (item.type === 'voice' || item.type === 'audio') {
    content.innerHTML = `
      <div class="flex flex-col items-center gap-4 bg-surface-container-high/40 p-6 rounded-2xl border border-outline-variant/20 w-full max-w-md mx-auto">
        <span class="material-symbols-outlined text-primary text-5xl">audiotrack</span>
        <audio src="${escHtml(item.url)}" controls autoplay class="w-full"></audio>
      </div>`;
  } else if (item.type === 'doc') {
    content.innerHTML = `<iframe src="${escHtml(item.url)}" class="w-full h-full rounded-xl border border-outline-variant/20" style="width:85vw; height:75vh; background:white;"></iframe>`;
  } else {
    content.innerHTML = `<div class="relative flex items-center justify-center w-full h-full" id="media-zoom-container" style="touch-action:none">
      <img src="${escHtml(item.url)}" alt="Media" id="media-zoom-img"
           class="max-w-full max-h-full rounded-xl object-contain transition-transform duration-200 cursor-zoom-in"
           style="max-height:85vh;transform-origin:center center"
           ondragstart="return false"
           onclick="toggleMediaZoom()">
    </div>`;
  }

  App._mediaViewerCurrentUrl = item.url;
  App._mediaViewerCurrentType = item.type;
  App._mediaViewerZoomed = false;
  App._mediaViewerScale = 1;
  App._mediaViewerPanX = 0;
  App._mediaViewerPanY = 0;
  // Pinch-to-zoom support (use AbortController to prevent listener accumulation)
  if (App._mediaViewerAbort) { try { App._mediaViewerAbort.abort(); } catch(_) {} }
  App._mediaViewerAbort = new AbortController();
  const _mvSignal = App._mediaViewerAbort.signal;
  const zoomContainer = document.getElementById('media-zoom-container');
  if (zoomContainer && item.type !== 'video' && item.type !== 'voice' && item.type !== 'audio' && item.type !== 'doc') {
    let lastDist = 0, lastMidX = 0, lastMidY = 0, isPinching = false;
    zoomContainer.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        isPinching = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastDist = Math.hypot(dx, dy);
        lastMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        lastMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        e.preventDefault();
      }
    }, { passive: false, signal: _mvSignal });
    zoomContainer.addEventListener('touchmove', e => {
      if (isPinching && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scaleDelta = dist / lastDist;
        App._mediaViewerScale = Math.max(0.5, Math.min(5, App._mediaViewerScale * scaleDelta));
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        App._mediaViewerPanX += midX - lastMidX;
        App._mediaViewerPanY += midY - lastMidY;
        lastDist = dist;
        lastMidX = midX;
        lastMidY = midY;
        const img = document.getElementById('media-zoom-img');
        if (img) {
          img.style.transform = `translate(${App._mediaViewerPanX}px, ${App._mediaViewerPanY}px) scale(${App._mediaViewerScale})`;
          img.style.maxHeight = 'none';
          img.style.maxWidth = 'none';
        }
        e.preventDefault();
      }
    }, { passive: false, signal: _mvSignal });
    zoomContainer.addEventListener('touchend', e => {
      if (isPinching && e.touches.length < 2) {
        isPinching = false;
        if (App._mediaViewerScale < 1.1) {
          App._mediaViewerScale = 1;
          App._mediaViewerPanX = 0;
          App._mediaViewerPanY = 0;
          const img = document.getElementById('media-zoom-img');
          if (img) {
            img.style.transform = '';
            img.style.maxHeight = '85vh';
            img.style.maxWidth = '100%';
          }
        }
      }
    }, { signal: _mvSignal });
  }
}

function toggleMediaZoom() {
  const img = document.getElementById('media-zoom-img');
  if (!img) return;
  App._mediaViewerZoomed = !App._mediaViewerZoomed;
  if (App._mediaViewerZoomed) {
    img.style.maxHeight = 'none';
    img.style.maxWidth = 'none';
    img.style.width = 'auto';
    img.style.height = 'auto';
    img.style.cursor = 'zoom-out';
    img.style.transform = 'scale(1)';
  } else {
    img.style.maxHeight = '85vh';
    img.style.maxWidth = '100%';
    img.style.width = '';
    img.style.height = '';
    img.style.cursor = 'zoom-in';
    img.style.transform = '';
  }
}

function closeMediaViewer() {
  hide('media-viewer');
  document.body.style.overflow = '';
  const content = document.getElementById('media-viewer-content');
  if (content) {
    const vid = content.querySelector('video');
    if (vid) { vid.pause(); vid.src = ''; }
    const aud = content.querySelector('audio');
    if (aud) { aud.pause(); aud.src = ''; }
    content.innerHTML = '';
  }
}

function prevMedia() {
  if (!App.mediaViewerItems || !App.mediaViewerItems.length) return;
  App.mediaViewerIndex = (App.mediaViewerIndex - 1 + App.mediaViewerItems.length) % App.mediaViewerItems.length;
  _renderMediaViewer();
}

function nextMedia() {
  if (!App.mediaViewerItems || !App.mediaViewerItems.length) return;
  App.mediaViewerIndex = (App.mediaViewerIndex + 1) % App.mediaViewerItems.length;
  _renderMediaViewer();
}

function downloadMedia() {
  const url = App._mediaViewerCurrentUrl;
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  const ext = App._mediaViewerCurrentType === 'video' ? 'mp4' : App._mediaViewerCurrentType === 'doc' ? 'pdf' : App._mediaViewerCurrentType === 'voice' ? 'mp3' : 'jpg';
  a.download = `nsl-chat-media-${Date.now()}.${ext}`;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof showToast === 'function') showToast('File saved to Downloads', 'success');
}

function forwardCurrentMedia() {
  const items = App.mediaViewerItems || [];
  const idx = App.mediaViewerIndex;
  const item = items[idx];
  if (!item || !item.id || item.id === '_single') return;
  
  closeMediaViewer();
  openForwardModal(item.id);
}

function deleteCurrentMedia() {
  const items = App.mediaViewerItems || [];
  const idx = App.mediaViewerIndex;
  const item = items[idx];
  if (!item || !item.id || item.id === '_single') return;
  
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const msg = msgs.find(m => m.id === item.id);
  if (!msg) return;
  
  const isMe = msg.from === 'me';
  const uid = App.auth && App.auth.currentUser && App.auth.currentUser.uid;
  const isMyMsg = isMe || (uid && msg.senderId === uid);
  
  showConfirm('Delete this media?', async () => {
    const scope = isMyMsg ? 'everyone' : 'me';
    await deleteMessage(item.id, scope);
    
    // Remove from viewer items and navigate
    App.mediaViewerItems.splice(idx, 1);
    if (App.mediaViewerItems.length === 0) {
      closeMediaViewer();
      return;
    }
    // Navigate to previous item (or stay within bounds)
    App.mediaViewerIndex = Math.min(idx, App.mediaViewerItems.length - 1);
    _renderMediaViewer();
  });
}

// Keyboard: Escape → close, Arrow → prev/next
document.addEventListener('keydown', function(e) {
  const viewer = document.getElementById('media-viewer');
  if (!viewer || viewer.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeMediaViewer();
  if (e.key === 'ArrowLeft')  prevMedia();
  if (e.key === 'ArrowRight') nextMedia();
});

/* L6: S Pen button handler — button 5 (stylus side button) for undo/redo in drawing */
document.addEventListener('pointerdown', function(e) {
  if (e.button === 5) {
    e.preventDefault();
    if (e.shiftKey || e.ctrlKey) { if (typeof redo === 'function') redo(); }
    else { if (typeof undo === 'function') undo(); }
  }
});

/* ══════════════════════════════════════════════════════════════
   2. VOICE PLAYBACK — real Web Audio / HTML5
   ══════════════════════════════════════════════════════════════ */
let _currentAudio = null;
let _currentPlayBtn = null;

function playVoice(msgId) {
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const msg = msgs.find(m => m.id === msgId);

  if (!msg || !msg.url) {
    showToast('Voice message not available', 'error');
    return;
  }

  // If already playing this same message, toggle pause
  if (_currentAudio && App._currentVoiceMsgId === msgId) {
    if (_currentAudio.paused) {
      _currentAudio.play();
      _updatePlayBtn(msgId, true);
    } else {
      _currentAudio.pause();
      _updatePlayBtn(msgId, false);
    }
    return;
  }

  // Stop any currently playing
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.onended = null;
    _currentAudio.ontimeupdate = null;
    _currentAudio.onplay = null;
    _currentAudio.onpause = null;
    _currentAudio.onerror = null;
    _currentAudio.src = '';
    _currentAudio.load();
    _currentAudio = null;
    if (App._currentVoiceMsgId) _updatePlayBtn(App._currentVoiceMsgId, false);
  }

  const audio = new Audio(msg.url);
  _currentAudio = audio;
  App._currentVoiceMsgId = msgId;

  // Get speed from button
  const speedBtn = document.querySelector(`.voice-speed[data-msg-id="${msgId}"]`);
  const speed = speedBtn ? parseFloat(speedBtn.dataset.speed) || 1 : 1;
  audio.playbackRate = speed;

  const timeLabel = document.querySelector(`.voice-time[data-msg-id="${msgId}"]`);
  const maxDur = msg.durationSec || 0;

  audio.addEventListener('timeupdate', () => {
    const wave = document.getElementById(`wave-${msgId}`);
    if (wave && audio.duration) {
      const pct = audio.currentTime / audio.duration;
      const spans = wave.querySelectorAll('span');
      const activeCount = Math.floor(pct * spans.length);
      spans.forEach((span, idx) => {
        span.classList.toggle('active', idx <= activeCount);
      });
    }
    if (timeLabel) {
      const remaining = maxDur ? Math.max(0, maxDur - Math.floor(audio.currentTime)) : Math.floor(audio.currentTime);
      if (maxDur) timeLabel.textContent = '-' + _fmtDur(remaining);
      else timeLabel.textContent = _fmtDur(Math.floor(audio.currentTime));
    }
  });
  audio.addEventListener('play',  () => _updatePlayBtn(msgId, true));
  audio.addEventListener('pause', () => _updatePlayBtn(msgId, false));
  audio.addEventListener('ended', () => {
    _updatePlayBtn(msgId, false);
    const wave = document.getElementById(`wave-${msgId}`);
    if (wave) {
      wave.querySelectorAll('span').forEach(span => span.classList.remove('active'));
    }
    if (timeLabel && maxDur) timeLabel.textContent = _fmtDur(maxDur);
    _currentAudio = null;
    App._currentVoiceMsgId = null;
  });
  audio.addEventListener('error', () => {
    showToast('Could not play voice message', 'error');
    _updatePlayBtn(msgId, false);
    _currentAudio = null;
    App._currentVoiceMsgId = null;
  });

  audio.play().catch(() => showToast('Could not play voice message', 'error'));
}

function scrubVoice(msgId, time) {
  if (_currentAudio && App._currentVoiceMsgId === msgId) {
    _currentAudio.currentTime = parseFloat(time);
  }
}

function cycleVoiceSpeed(btn) {
  const speeds = [1, 1.5, 2, 0.75];
  let current = parseFloat(btn.dataset.speed) || 1;
  let idx = speeds.indexOf(current);
  idx = (idx + 1) % speeds.length;
  const newSpeed = speeds[idx];
  btn.dataset.speed = newSpeed;
  btn.textContent = newSpeed + 'x';
  if (_currentAudio && App._currentVoiceMsgId === btn.dataset.msgId) {
    _currentAudio.playbackRate = newSpeed;
  }
}

function _updatePlayBtn(msgId, isPlaying) {
  const el = document.querySelector(`.voice-play[data-msg-id="${msgId}"]`);
  if (el) el.textContent = isPlaying ? '⏸' : '▶';
  const wave = document.getElementById(`wave-${msgId}`);
  if (wave) {
    wave.classList.toggle('playing', isPlaying);
  }
}

function scrubVoiceFromWave(msgId, event) {
  const wave = document.getElementById(`wave-${msgId}`);
  if (!wave || !_currentAudio || App._currentVoiceMsgId !== msgId) return;
  const rect = wave.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const percentage = Math.max(0, Math.min(1, clickX / rect.width));
  const newTime = percentage * _currentAudio.duration;
  if (!isNaN(newTime)) {
    _currentAudio.currentTime = newTime;
  }
}
window.scrubVoiceFromWave = scrubVoiceFromWave;

/* ══════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS HELP DIALOG
   ══════════════════════════════════════════════════════════════ */
function showKeyboardHelp() {
  const existing = document.getElementById('kb-help-overlay');
  if (existing) { existing.remove(); return; }

  const shortcuts = [
    { keys: 'Ctrl + Shift + F', desc: 'Search messages' },
    { keys: 'Ctrl + Shift + N', desc: 'New chat' },
    { keys: 'Ctrl + I', desc: 'Toggle info panel' },
    { keys: 'Ctrl + Shift + D', desc: 'Toggle dark mode' },
    { keys: 'Ctrl + L', desc: 'Clear chat' },
    { keys: 'Ctrl + Shift + M', desc: 'Toggle mute' },
    { keys: 'Ctrl + E', desc: 'Toggle emoji picker' },
    { keys: 'Escape', desc: 'Close overlay / Cancel search' },
    { keys: '1 / 2 / 3', desc: 'Switch to Chats / Groups / Calls' },
    { keys: '?', desc: 'Show this help' },
  ];

  const overlay = document.createElement('div');
  overlay.id = 'kb-help-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;animation:ctxFadeIn 0.15s ease;';

  const panel = document.createElement('div');
  panel.style.cssText = 'background:var(--surface-container-high);border:1px solid var(--outline-variant);border-radius:20px;padding:28px 32px;max-width:420px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,0.4);';

  panel.innerHTML = `
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:var(--on-surface);display:flex;align-items:center;gap:8px;">
      <span class="material-symbols-outlined" style="font-size:22px;">keyboard</span> Keyboard Shortcuts
    </h2>
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${shortcuts.map(s => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--outline-variant,rgba(255,255,255,0.08));">
          <span style="color:var(--on-surface);font-size:13px;">${s.desc}</span>
          <kbd style="background:var(--surface-container-highest,var(--surface));padding:3px 8px;border-radius:6px;font-size:12px;font-family:monospace;color:var(--on-surface);border:1px solid var(--outline-variant);white-space:nowrap;">${s.keys}</kbd>
        </div>
      `).join('')}
    </div>
    <p style="margin:14px 0 0;font-size:11px;color:var(--on-surface-variant);text-align:center;">Press <kbd style="background:var(--surface-container-highest);padding:1px 5px;border-radius:4px;font-family:monospace;border:1px solid var(--outline-variant);">Esc</kbd> or <kbd style="background:var(--surface-container-highest);padding:1px 5px;border-radius:4px;font-family:monospace;border:1px solid var(--outline-variant);">?</kbd> to close</p>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const close = () => { overlay.remove(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function _kbHelpEsc(e) {
    if (e.key === 'Escape' || e.key === '?') { close(); document.removeEventListener('keydown', _kbHelpEsc); }
  });
}

/* ══════════════════════════════════════════════════════════════
   3. MESSAGE RIGHT-CLICK CONTEXT MENU
   ══════════════════════════════════════════════════════════════ */
let _ctxMenu = null;

function _execAction(actionStr) {
  try {
    const match = actionStr.match(/^(\w+)\(([^)]*)\)$/);
    if (match) {
      const fnName = match[1];
      const argStr = (match[2] || '').trim();
      const args = [];
      if (argStr) {
        const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|(\d+)|true|false/g;
        let m;
        while ((m = re.exec(argStr))) {
          const val = m[1] || m[2] || m[3] || m[0];
          args.push(/^true$/.test(val) ? true : /^false$/.test(val) ? false : val.replace(/\\'/g, "'").replace(/\\"/g, '"'));
        }
      }
      if (typeof window[fnName] === 'function') {
        window[fnName].apply(null, args);
        return;
      }
    }
    console.warn('Unknown action:', actionStr);
  } catch(e) { console.error('Action exec error:', e); }
}

function showMsgContextMenu(event, msgId) {
  event.preventDefault();
  event.stopPropagation();
  _removeCtxMenu();

  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const msg = msgs.find(m => m.id === msgId);
  if (!msg) return;

  const isMe = msg.from === 'me';
  const uid  = App.auth && App.auth.currentUser && App.auth.currentUser.uid;
  const isMyMsg = isMe || (uid && msg.senderId === uid);

  const menu = document.createElement('div');
  menu.id = '_msg-ctx-menu';
  menu.style.cssText = `
    position:fixed; z-index:9999;
    background:var(--surface-container,#1f2c34);
    border:1px solid var(--outline-variant,#2a3942);
    color:var(--on-surface,#e9edef);
    border-radius:16px; padding:6px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    min-width:180px; font-size:13px; font-weight:600;
    animation: ctxFadeIn 0.12s ease;
  `;

  // Horizontal Quick Reactions bar at the top of context menu
  const emojiRow = document.createElement('div');
  emojiRow.style.cssText = `
    display:flex; justify-content:space-between; align-items:center;
    padding:6px 10px; border-bottom:1px solid var(--outline-variant);
    margin-bottom:6px; gap:4px;
  `;
  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  quickReactions.forEach(emoji => {
    const rBtn = document.createElement('button');
    rBtn.style.cssText = `
      background:none; border:none; font-size:20px; cursor:pointer;
      padding:4px; border-radius:8px; display:flex; align-items:center;
      justify-content:center; transition:transform 0.15s, background 0.1s;
    `;
    rBtn.onmouseenter = () => {
      rBtn.style.transform = 'scale(1.25)';
      rBtn.style.background = 'var(--surface-container-highest)';
    };
    rBtn.onmouseleave = () => {
      rBtn.style.transform = 'scale(1)';
      rBtn.style.background = 'transparent';
    };
    rBtn.onclick = () => {
      _removeCtxMenu();
      toggleReaction(msgId, emoji);
    };
    rBtn.textContent = emoji;
    emojiRow.appendChild(rBtn);
  });
  menu.appendChild(emojiRow);

  const isPinned = (App.currentChatPinnedMessages || []).some(p => p.messageId === msgId);
  const canEdit = isMyMsg && (Date.now() - (msg.time || 0)) < 15 * 60 * 1000;
  const isEphemeralChat = !!((App.currentChat && App.currentChat.ephemeralTimer) || 0);
  const isKept = msg.kept === true || msg.keepInChat === true;
  const actions = [
    { icon: '↩️', label: 'Reply',   fn: `replyToMsg('${msgId}')` },
    { icon: '🧵', label: 'Thread',  fn: `_openThreadForMsg('${msgId}')` },
    { icon: '✏️', label: 'Edit',    fn: `editMessage('${msgId}')`,  show: canEdit },
    { icon: '↪️', label: 'Forward', fn: `openForwardModal('${msgId}')` },
    { icon: '📋', label: 'Copy',    fn: `copyMsgText('${msgId}')` },
    { icon: '📌', label: isPinned ? 'Unpin message' : 'Pin message', fn: isPinned ? `unpinMessageByMsgId('${msgId}')` : `pinMessage('${msgId}')` },
    { icon: '⭐', label: 'Star',    fn: `starMessage('${msgId}')` },
    { icon: '📌', label: isKept ? 'Keep in chat (on)' : 'Keep in chat', fn: `toggleKeepInChat('${chatId}','${msgId}',${isKept ? 'false' : 'true'})`, show: isEphemeralChat },
    { icon: 'ℹ️', label: 'Info',    fn: `openMsgInfo('${msgId}')` },
    { icon: '🗑️', label: 'Delete',  fn: `openDeleteMenu('${msgId}')`, danger: true },
  ];

  actions.forEach(({ icon, label, fn, show, danger }) => {
    if (show === false) return;
    const btn = document.createElement('button');
    btn.style.cssText = `
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:${danger ? 'var(--error, #ef4444)' : 'inherit'};
      transition:background 0.15s;
    `;
    btn.innerHTML = `<span style="font-size:16px">${icon}</span> ${label}`;
    btn.onmouseenter = () => btn.style.background = danger ? 'rgba(186,26,26,0.1)' : 'var(--surface-container-highest)';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = () => { _removeCtxMenu(); _execAction(fn); };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);

  // Intelligently fit menu inside viewport to prevent offscreen cut-offs
  // H6: On tablet, clamp within chat area bounds (sidebar 72px + chat-list varies)
  const rect = menu.getBoundingClientRect();
  let cx = event.clientX || event.pageX || 0;
  let cy = event.clientY || event.pageY || 0;
  if (!cx && !cy && event.touches && event.touches.length) {
    cx = event.touches[0].clientX;
    cy = event.touches[0].clientY;
  }
  const chatAreaEl = document.getElementById('chat-area');
  const chatAreaLeft = chatAreaEl ? chatAreaEl.getBoundingClientRect().left : 0;
  const x = Math.min(cx || (window.innerWidth / 2), window.innerWidth - rect.width - 20);
  const y = Math.min(cy || (window.innerHeight / 2), window.innerHeight - rect.height - 20);
  menu.style.left = Math.max(chatAreaLeft + 10, x) + 'px';
  menu.style.top  = Math.max(10, y) + 'px';

  _ctxMenu = menu;

  // Close on outside click or Escape key
  setTimeout(() => {
    document.addEventListener('click', _removeCtxMenu, { once: true });
    document.addEventListener('contextmenu', _removeCtxMenu, { once: true });
    const _ctxEscHandler = (e) => {
      if (e.key === 'Escape') { _removeCtxMenu(); document.removeEventListener('keydown', _ctxEscHandler); }
    };
    document.addEventListener('keydown', _ctxEscHandler);
  }, 50);
}

function _removeCtxMenu() {
  if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
}

/* ══════════════════════════════════════════════════════════════
   4. CHAT LIST RIGHT-CLICK CONTEXT MENU
   ══════════════════════════════════════════════════════════════ */
function chatContextMenu(event, chatId) {
  event.preventDefault();
  event.stopPropagation();
  _removeCtxMenu();

  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) return;

  const menu = document.createElement('div');
  menu.id = '_msg-ctx-menu';
  menu.style.cssText = `
    position:fixed; z-index:9999;
    background:var(--surface-container,#1f2c34);
    border:1px solid var(--outline-variant,#2a3942);
    color:var(--on-surface,#e9edef);
    border-radius:16px; padding:6px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    min-width:160px; font-size:13px; font-weight:600;
  `;
  const actions = [
    { icon: '🔔', label: chat.muted ? 'Unmute Chat' : 'Mute Chat', fn: `showMuteChatOptions('${chatId}')` },
    { icon: '📂', label: 'Archive Chat', fn: `archiveChat('${chatId}')` },
    { icon: '📦', label: 'Export Chat', fn: `exportChatAsZip('${chatId}')` },
    { icon: '🗑️', label: 'Delete Chat', fn: `confirmDeleteChat('${chatId}')`, danger: true },
  ];

  if (typeof isChatLocked === 'function') {
    const locked = isChatLocked(chatId);
    actions.splice(4, 0, { icon: locked ? '🔓' : '🔒', label: locked ? 'Unlock Chat' : 'Lock Chat', fn: `toggleChatLock('${chatId}')` });
  }
  if (typeof isScreenshotRestricted === 'function') {
    const ssRestricted = isScreenshotRestricted(chatId);
    actions.splice(5, 0, { icon: ssRestricted ? '📸' : '🚫', label: ssRestricted ? 'Allow Screenshots' : 'Restrict Screenshots', fn: `toggleScreenshotRestriction('${chatId}')` });
  }

  actions.forEach(({ icon, label, fn, danger }) => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:${danger ? 'var(--error, #ef4444)' : 'inherit'};
      transition:background 0.15s;
    `;
    btn.innerHTML = `<span style="font-size:16px">${icon}</span> ${label}`;
    btn.onmouseenter = () => btn.style.background = danger ? 'rgba(186,26,26,0.1)' : 'var(--surface-container-highest)';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = () => { _removeCtxMenu(); _execAction(fn); };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  
  // Measure rect boundaries to prevent offscreen/cut-off menu display
  const rect = menu.getBoundingClientRect();
  let cx2 = event.clientX || event.pageX || 0;
  let cy2 = event.clientY || event.pageY || 0;
  if (!cx2 && !cy2 && event.touches && event.touches.length) {
    cx2 = event.touches[0].clientX;
    cy2 = event.touches[0].clientY;
  }
  const x = Math.min(cx2 || (window.innerWidth / 2), window.innerWidth - rect.width - 20);
  const y = Math.min(cy2 || (window.innerHeight / 2), window.innerHeight - rect.height - 20);
  menu.style.left = Math.max(10, x) + 'px';
  menu.style.top  = Math.max(10, y) + 'px';

  _ctxMenu = menu;
  setTimeout(() => {
    document.addEventListener('click', _removeCtxMenu, { once: true });
    document.addEventListener('contextmenu', _removeCtxMenu, { once: true });
  }, 50);
}

/* ─── Call Log Context Menu ─── */
function callLogContextMenu(event, logId) {
  event.preventDefault();
  event.stopPropagation();
  _removeCtxMenu();

  const menu = document.createElement('div');
  menu.id = '_msg-ctx-menu';
  menu.style.cssText = `
    position:fixed; z-index:9999;
    background:var(--surface-container,#1f2c34);
    border:1px solid var(--outline-variant,#2a3942);
    color:var(--on-surface,#e9edef);
    border-radius:16px; padding:6px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    min-width:160px; font-size:13px; font-weight:600;
  `;

  const actions = [
    { icon: '🗑️', label: 'Delete Call Log', fn: `confirmDeleteCallLog('${logId}')`, danger: true },
  ];

  actions.forEach(({ icon, label, fn, danger }) => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:${danger ? 'var(--error, #ef4444)' : 'inherit'};
      transition:background 0.15s;
    `;
    btn.innerHTML = `<span style="font-size:16px">${icon}</span> ${label}`;
    btn.onmouseenter = () => btn.style.background = danger ? 'rgba(186,26,26,0.1)' : 'var(--surface-container-highest)';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = () => { _removeCtxMenu(); _execAction(fn); };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  const x = Math.min(event.clientX, window.innerWidth - rect.width - 20);
  const y = Math.min(event.clientY, window.innerHeight - rect.height - 20);
  menu.style.left = Math.max(10, x) + 'px';
  menu.style.top  = Math.max(10, y) + 'px';

  _ctxMenu = menu;
  setTimeout(() => {
    document.addEventListener('click', _removeCtxMenu, { once: true });
    document.addEventListener('contextmenu', _removeCtxMenu, { once: true });
  }, 50);
}

/* ══════════════════════════════════════════════════════════════
   5. CHAT HEADER MORE MENU (⋮ button)
   ══════════════════════════════════════════════════════════════ */
function openChatMenu(btn) {
  _removeCtxMenu();
  if (!App.currentChat) return;
  const chat = App.currentChat;

  const menu = document.createElement('div');
  menu.id = '_msg-ctx-menu';
  menu.style.cssText = `
    position:fixed; z-index:9999;
    background:var(--surface-container,#1f2c34);
    border:1px solid var(--outline-variant,#2a3942);
    color:var(--on-surface,#e9edef);
    border-radius:16px; padding:6px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    min-width:190px; font-size:13px; font-weight:600;
  `;

  const actions = [
    { icon: '🔍', label: 'Search in chat',     fn: `openChatSearch()` },
    { icon: '📌', label: chat.pinned ? 'Unpin' : 'Pin',   fn: `togglePin('${chat.id}')` },
    { icon: '🔔', label: chat.muted ? 'Unmute' : 'Mute',  fn: `toggleChatMute('${chat.id}')` },
    { icon: '📦', label: 'Export Chat',          fn: typeof window.openChatExport === 'function' ? 'openChatExport()' : `exportChatAsZip('${chat.id}')` },
    { icon: '🖼️', label: 'Media & Attachments', fn: `openMediaGallery()` },
    { icon: '🗑️', label: 'Clear History',        fn: `confirmClearChat('${chat.id}')`, danger: true },
  ];
  if (chat.type === 'group') {
    actions.push({ icon: '🚪', label: 'Leave Group', fn: `confirmLeaveGroup()`, danger: true });
  }

  actions.forEach(({ icon, label, fn, danger }) => {
    const item = document.createElement('button');
    item.style.cssText = `
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:${danger ? 'var(--error, #ef4444)' : 'inherit'};
      transition:background 0.15s;
    `;
    item.innerHTML = `<span style="font-size:16px">${icon}</span> ${label}`;
    item.onmouseenter = () => item.style.background = danger ? 'rgba(186,26,26,0.1)' : 'var(--surface-container-highest)';
    item.onmouseleave = () => item.style.background = 'transparent';
    item.onclick = () => { _removeCtxMenu(); _execAction(fn); };
    menu.appendChild(item);
  });

  const rect = btn.getBoundingClientRect();
  const x = Math.min(rect.right - 190, window.innerWidth - 200);
  const y = rect.bottom + 6;
  menu.style.left = Math.max(8, x) + 'px';
  menu.style.top  = y + 'px';

  document.body.appendChild(menu);
  _ctxMenu = menu;
  setTimeout(() => {
    document.addEventListener('click', _removeCtxMenu, { once: true });
  }, 50);
}

/* ══════════════════════════════════════════════════════════════
   6. DELETE MESSAGE
   ══════════════════════════════════════════════════════════════ */
function openDeleteMenu(msgId) {
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const msg = msgs.find(m => m.id === msgId);
  if (!msg) return;

  const isMe = msg.from === 'me';
  const uid  = App.auth && App.auth.currentUser && App.auth.currentUser.uid;
  const isMyMsg = isMe || (uid && msg.senderId === uid);

  const menu = document.createElement('div');
  menu.id = '_msg-ctx-menu';
  menu.style.cssText = `
    position:fixed; z-index:9999; inset:0;
    background:rgba(0,0,0,0.5); backdrop-filter:blur(4px);
    display:flex; align-items:flex-end; justify-content:center;
    padding-bottom:40px;
  `;

  const sheet = document.createElement('div');
  sheet.style.cssText = `
    background:var(--surface-container-high);
    border-radius:24px 24px 0 0;
    padding:24px; width:100%; max-width:480px;
    display:flex; flex-direction:column; gap:8px;
    animation: slideUp 0.2s ease;
  `;

  sheet.innerHTML = `
    <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:var(--on-surface)">Delete message?</div>
    ${isMyMsg ? `
    <button onclick="deleteMessage('${msgId}','everyone')" style="
      padding:14px 16px; border-radius:12px; border:none;
      background:var(--error); color:white; font-size:14px;
      font-weight:700; cursor:pointer; text-align:left;
      transition:opacity 0.15s;
    ">🗑️ Delete for everyone</button>` : ''}
    <button onclick="deleteMessage('${msgId}','me')" style="
      padding:14px 16px; border-radius:12px; border:none;
      background:var(--surface-variant); color:var(--on-surface); font-size:14px;
      font-weight:700; cursor:pointer; text-align:left;
      transition:opacity 0.15s;
    ">🚫 Delete for me only</button>
    <button onclick="_removeCtxMenu()" style="
      padding:14px 16px; border-radius:12px; border:none;
      background:transparent; color:var(--on-surface-variant); font-size:14px;
      font-weight:600; cursor:pointer;
    ">Cancel</button>
  `;

  menu.appendChild(sheet);
  menu.onclick = e => { if (e.target === menu) _removeCtxMenu(); };
  document.body.appendChild(menu);
  _ctxMenu = menu;
}

async function deleteMessage(msgId, scope) {
  _removeCtxMenu();
  const chatId = App.currentChat && App.currentChat.id;
  if (!chatId) return;

  const msgs = App.messages[chatId] || [];
  const msgIdx = msgs.findIndex(m => m.id === msgId);
  if (msgIdx < 0) return;

  const msg = msgs[msgIdx];

  if (scope === 'me') {
    // Remove from local state
    msgs.splice(msgIdx, 1);
    renderMessages(chatId);
    renderChatList();

    if (App.db && App.auth && App.auth.currentUser) {
      const uid = App.auth.currentUser.uid;
      try {
        await App.db.collection('messages').doc(msgId).update({
          [`deletedFor.${uid}`]: true
        });
        // Persist to localStorage as backup defense
        try {
          const key = 'nsl_deleted_msgs';
          const o = JSON.parse(localStorage.getItem(key) || '{}');
          o[chatId] = o[chatId] || [];
          if (!o[chatId].includes(msgId)) o[chatId].push(msgId);
          localStorage.setItem(key, JSON.stringify(o));
        } catch(_) {}
        showToast('Message deleted', 'info');
        if (typeof broadcastToTabs === 'function') broadcastToTabs('message-deleted', { chatId, msgId });
      } catch (err) {
        console.warn('Delete for me failed:', err);
        showToast('Could not delete message. Check connection.', 'error');
        // Re-add message on failure
        msgs.splice(msgIdx, 0, msg);
        renderMessages(chatId);
      }
    } else {
      try { const key='nsl_deleted_msgs'; const o=JSON.parse(localStorage.getItem(key)||'{}'); o[chatId]=o[chatId]||[]; if(!o[chatId].includes(msgId)) o[chatId].push(msgId); localStorage.setItem(key,JSON.stringify(o)); } catch(_) {}
      showToast('Message deleted (offline)', 'info');
    }
  } else {
    // Delete for everyone
    msgs.splice(msgIdx, 1);
    renderMessages(chatId);
    renderChatList();

    if (App.db && App.auth && App.auth.currentUser) {
      try {
        await App.db.collection('messages').doc(msgId).update({
          deletedForEveryone: true,
          deletedForEveryoneBy: App.auth.currentUser.uid,
          text: '',
          attachment: null
        });
        try { const key='nsl_deleted_msgs'; const o=JSON.parse(localStorage.getItem(key)||'{}'); o[chatId]=o[chatId]||[]; if(!o[chatId].includes(msgId)) o[chatId].push(msgId); localStorage.setItem(key,JSON.stringify(o)); } catch(_) {}
        showToast('Message deleted for everyone', 'success');
        if (typeof broadcastToTabs === 'function') broadcastToTabs('message-deleted', { chatId, msgId });
      } catch (err) {
        console.warn('Delete for everyone failed, trying fallback:', err);
        try {
          await App.db.collection('messages').doc(msgId).delete();
          try { const key='nsl_deleted_msgs'; const o=JSON.parse(localStorage.getItem(key)||'{}'); o[chatId]=o[chatId]||[]; if(!o[chatId].includes(msgId)) o[chatId].push(msgId); localStorage.setItem(key,JSON.stringify(o)); } catch(_) {}
          showToast('Message deleted for everyone', 'success');
          if (typeof broadcastToTabs === 'function') broadcastToTabs('message-deleted', { chatId, msgId });
        } catch (err2) {
          console.error('Delete fallback also failed:', err2);
          showToast('Could not delete message for everyone', 'error');
          msgs.splice(msgIdx, 0, msg);
          renderMessages(chatId);
        }
      }
    } else {
      try { const key='nsl_deleted_msgs'; const o=JSON.parse(localStorage.getItem(key)||'{}'); o[chatId]=o[chatId]||[]; if(!o[chatId].includes(msgId)) o[chatId].push(msgId); localStorage.setItem(key,JSON.stringify(o)); } catch(_) {}
      showToast('Message deleted for everyone (offline)', 'success');
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   7. FORWARD MESSAGE
   ══════════════════════════════════════════════════════════════ */
let _forwardMsgId = null;
let _forwardOverlayCleanup = null;

function _closeForwardModal() {
  const overlay = document.getElementById('_forward-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    if (_forwardOverlayCleanup) {
      _forwardOverlayCleanup();
      _forwardOverlayCleanup = null;
    }
  }
}

function openForwardModal(msgId) {
  _forwardMsgId = msgId;
  let overlay = document.getElementById('_forward-overlay');
  if (!overlay) { _createForwardOverlay(); }
  overlay = document.getElementById('_forward-overlay');
  if (!overlay) return;
  
  const list = document.getElementById('_forward-chat-list');
  if (!list) return;
  
  // Build chat list with proper event references
  list.innerHTML = '';
  App.chats.forEach(c => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; cursor:pointer; transition:background 0.15s;';
    item.setAttribute('data-fwd-chat', c.id);
    item.setAttribute('data-chat-name', c.name || '');
    item.onmouseenter = () => item.style.background = 'var(--surface-container-highest)';
    item.onmouseleave = () => item.style.background = 'transparent';
    item.onclick = () => forwardToChat(c.id);
    item.innerHTML = `
      ${c.initials
        ? `<div style="width:40px; height:40px; border-radius:50%; background:var(--surface-container-highest); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; color:var(--on-surface-variant);">${escHtml(c.initials)}</div>`
        : `<div style="width:40px; height:40px; border-radius:50%; background:var(--surface-container-highest); display:flex; align-items:center; justify-content:center; color:var(--on-surface-variant);"><span class="material-symbols-outlined" style="font-size:18px;">person_off</span></div>`}
      <div>
        <div style="font-weight:700;font-size:14px;color:var(--on-surface)">${escHtml(c.name)}</div>
        <div style="font-size:11px;color:var(--on-surface-variant)">${c.type === 'group' ? 'Group' : 'Personal'}</div>
      </div>
    `;
    list.appendChild(item);
  });
  
  overlay.style.display = 'flex';
}

function _createForwardOverlay() {
  // Remove any existing overlay first
  const existing = document.getElementById('_forward-overlay');
  if (existing) existing.remove();
  if (_forwardOverlayCleanup) { _forwardOverlayCleanup(); _forwardOverlayCleanup = null; }
  
  const overlay = document.createElement('div');
  overlay.id = '_forward-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:9998; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); display:none; align-items:center; justify-content:center;';
  
  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--surface-container); border:1px solid var(--outline-variant); border-radius:24px; width:100%; max-width:440px; max-height:80vh; display:flex; flex-direction:column; margin:16px; overflow:hidden; box-shadow:0 24px 64px rgba(0,0,0,0.5);';
  
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid var(--outline-variant);';
  header.innerHTML = '<h3 style="font-size:18px;font-weight:700;color:var(--on-surface)">↪️ Forward Message</h3>';
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none; border:none; cursor:pointer; color:var(--on-surface-variant); font-size:20px; padding:4px 8px; border-radius:8px;';
  closeBtn.onmouseenter = () => closeBtn.style.background = 'var(--surface-variant)';
  closeBtn.onmouseleave = () => closeBtn.style.background = 'none';
  closeBtn.onclick = _closeForwardModal;
  header.appendChild(closeBtn);
  
  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'padding:8px 16px;border-bottom:1px solid var(--outline-variant);';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.inputMode = 'search';
  searchInput.placeholder = 'Search chats...';
  searchInput.style.cssText = 'width:100%;padding:8px 12px;border-radius:10px;border:1px solid var(--outline-variant);background:var(--surface-variant);color:var(--on-surface);font-size:13px;outline:none;';
  searchInput.oninput = () => {
    const q = searchInput.value.toLowerCase();
    list.querySelectorAll('div[data-fwd-chat]').forEach(el => {
      el.style.display = !q || el.dataset.chatName.toLowerCase().includes(q) ? '' : 'none';
    });
  };
  searchWrap.appendChild(searchInput);

  const list = document.createElement('div');
  list.id = '_forward-chat-list';
  list.style.cssText = 'overflow-y:auto; padding:8px; flex:1;';
  
  modal.appendChild(header);
  modal.appendChild(searchWrap);
  modal.appendChild(list);
  overlay.appendChild(modal);
  
  // Backdrop click to close
  const backdropHandler = e => { if (e.target === overlay) _closeForwardModal(); };
  overlay.addEventListener('click', backdropHandler);
  
  // ESC key to close
  const escHandler = e => { if (e.key === 'Escape') _closeForwardModal(); };
  document.addEventListener('keydown', escHandler);
  
  // Store cleanup
  _forwardOverlayCleanup = () => {
    overlay.removeEventListener('click', backdropHandler);
    document.removeEventListener('keydown', escHandler);
  };
  
  document.body.appendChild(overlay);
}

async function forwardToChat(targetChatId) {
  _closeForwardModal();
  const targetChat = App.chats.find(c => c.id === targetChatId);
  if (!targetChat) return;

  // Handle media forward (from viewer)
  if (_forwardMediaUrl && _forwardMediaType) {
    const fwdMsg = {
      id: 'msg_fwd_' + Date.now(),
      from: 'me',
      text: '',
      type: _forwardMediaType,
      url: _forwardMediaUrl,
      time: Date.now(),
      status: 'sent',
      forwarded: true,
    };
    if (!App.messages[targetChatId]) App.messages[targetChatId] = [];
    App.messages[targetChatId].push(fwdMsg);
    if (App.currentChat && App.currentChat.id === targetChatId) {
      renderMessages(targetChatId);
      scrollToBottom(true);
    }
    showToast(`Forwarded to ${targetChat.name}`, 'success');
    _forwardMediaUrl = null;
    _forwardMediaType = null;
    return;
  }

  if (!_forwardMsgId) return;
  const srcChatId = App.currentChat && App.currentChat.id;
  const msgs = (srcChatId && App.messages[srcChatId]) || [];
  const msg   = msgs.find(m => m.id === _forwardMsgId);
  if (!msg) { showToast('Message not found', 'error'); return; }

  const fwdMsg = {
    id:        'msg_fwd_' + Date.now(),
    from:      'me',
    text:      msg.text || '',
    type:      msg.type || 'text',
    url:       msg.url  || '',
    fileName:  msg.fileName  || '',
    fileSize:  msg.fileSize  || '',
    duration:  msg.duration  || '',
    time:      Date.now(),
    status:    'sent',
    forwarded: true,
  };

  if (!App.messages[targetChatId]) App.messages[targetChatId] = [];
  App.messages[targetChatId].push(fwdMsg);
  if (App.currentChat && App.currentChat.id === targetChatId) {
    renderMessages(targetChatId);
    scrollToBottom(true);
  }

  showToast(`Forwarded to ${targetChat.name}`, 'success');

  // Firebase write
  if (App.db && App.auth && App.auth.currentUser) {
    const uid = App.auth.currentUser.uid;
    const isGroup = targetChat.type === 'group';
    const data = {
      senderId: uid,
      senderName: App.currentUser.displayName || App.currentUser.email || 'Me',
      text: msg.text || '',
      forwarded: true,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'sent',
    };
    if (msg.type && msg.type !== 'text') {
      data.attachment = { type: msg.type, url: msg.url || '', filename: msg.fileName || '', size: msg.fileSize || '' };
    }
    if (isGroup) {
      data.groupId = targetChatId;
    } else {
      data.directId = targetChatId;
      data.participants = [uid, targetChat.uid || targetChatId];
    }
    App.db.collection('messages').add(data).catch(console.error);
  }
}

function openForwardModalForMedia(url, type) {
  _forwardMsgId = null;
  _forwardMediaUrl = url;
  _forwardMediaType = type;
  openForwardModal('_forward_media');
}

let _forwardMediaUrl = null;
let _forwardMediaType = null;

/* ══════════════════════════════════════════════════════════════
   8. EDIT MESSAGE
   ══════════════════════════════════════════════════════════════ */
let _editingMsgId = null;

function editMessage(msgId) {
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const msg = msgs.find(m => m.id === msgId);
  if (!msg || (msg.type !== 'text' && !msg.text)) {
    showToast('Only text messages can be edited', 'info');
    return;
  }
  if ((Date.now() - (msg.time || 0)) >= 15 * 60 * 1000) {
    showToast('Messages can only be edited within 15 minutes', 'info');
    return;
  }

  _editingMsgId = msgId;
  const input = document.getElementById('msg-input');
  if (input) {
    input.value = msg.text || '';
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    toggleSendMic();
    onInputChange();
  }

  // Show edit mode indicator
  let editBar = document.getElementById('_edit-bar');
  if (!editBar) {
    editBar = document.createElement('div');
    editBar.id = '_edit-bar';
    editBar.style.cssText = `
      background:var(--surface-container);
      border-top:1px solid var(--outline-variant);
      padding:8px 24px;
      display:flex; align-items:center; gap:12px;
      font-size:12px; font-weight:600; color:var(--primary);
    `;
    editBar.innerHTML = `
      <span style="font-size:16px">✏️</span>
      <span style="flex:1">Editing message</span>
      <button onclick="cancelEdit()" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant);">✕ Cancel</button>
    `;
    const inputBar = document.getElementById('input-bar');
    if (inputBar) inputBar.insertAdjacentElement('beforebegin', editBar);
  }
}

function cancelEdit() {
  _editingMsgId = null;
  const bar = document.getElementById('_edit-bar');
  if (bar) bar.remove();
  const input = document.getElementById('msg-input');
  if (input) { input.value = ''; onInputChange(); }
}

async function saveEdit(newText) {
  const msgId  = _editingMsgId;
  const chatId = App.currentChat && App.currentChat.id;
  const msgs   = (chatId && App.messages[chatId]) || [];
  const msg    = msgs.find(m => m.id === msgId);
  if (!msg) { cancelEdit(); return; }

  const oldText = msg.text;
  msg.text = newText;
  msg.edited = true;
  cancelEdit();
  renderMessages(chatId);
  showToast('Message edited', 'success');

  // Firebase
  if (App.db && App.auth && App.auth.currentUser) {
    const uid = App.auth.currentUser.uid;
    const isOffline = msgId.startsWith('msg_');
    const data = {
      text: newText,
      edited: true,
      editedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    const col = 'messages';
    const promise = isOffline
      ? App.db.collection(col).doc(msgId).set(Object.assign({
          senderId: uid,
          senderName: App.currentUser?.displayName || '',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          status: 'sent',
          chatId: chatId,
        }, data), { merge: true })
      : App.db.collection(col).doc(msgId).update(data);
    promise.catch(() => {
      msg.text = oldText; // rollback
      renderMessages(chatId);
      showToast('Could not save edit', 'error');
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   9. EMOJI REACTIONS
   ══════════════════════════════════════════════════════════════ */
function toggleReaction(msgId, emoji) {
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const msg = msgs.find(m => m.id === msgId);
  if (!msg) return;

  if (!msg.reactions) msg.reactions = [];
  const existing = msg.reactions.find(r => r.emoji === emoji);

  if (existing) {
    if (existing.mine) {
      existing.count = Math.max(0, (existing.count || 1) - 1);
      existing.mine = false;
      if (existing.count === 0) {
        msg.reactions = msg.reactions.filter(r => r.emoji !== emoji);
      }
    } else {
      existing.count = (existing.count || 0) + 1;
      existing.mine = true;
    }
  } else {
    msg.reactions.push({ emoji, count: 1, mine: true });
  }

  renderMessages(chatId);

  // Firebase update
  if (App.db && App.auth && App.auth.currentUser && msgId && !msgId.startsWith('msg_')) {
    const uid = App.auth.currentUser.uid;
    const reactionData = {};
    (msg.reactions || []).forEach(r => { reactionData[r.emoji] = r.count; });
    const col = 'messages';
    App.db.collection(col).doc(msgId).update({ reactions: reactionData }).catch(() => {});
  }
}

/* ══════════════════════════════════════════════════════════════
   9b. LONG-PRESS REACTION HANDLER
   ══════════════════════════════════════════════════════════════ */
let _longPressTimer = null;
let _longPressMsgId = null;
let _longPressTriggered = false;
const LONG_PRESS_DURATION = 500;

function handleBubblePointerDown(event, msgId) {
  if (event.button && event.button !== 0) return;
  _longPressTriggered = false;
  _longPressMsgId = msgId;
  _longPressTimer = setTimeout(() => {
    _longPressTriggered = true;
    if (navigator.vibrate) navigator.vibrate(30);
    const fakeEvent = { preventDefault(){}, currentTarget: event.currentTarget, target: event.target, clientX: event.clientX, clientY: event.clientY };
    showQuickReactions(fakeEvent, msgId);
  }, LONG_PRESS_DURATION);
}

function handleBubblePointerUp(event) {
  if (_longPressTimer) {
    clearTimeout(_longPressTimer);
    _longPressTimer = null;
  }
  if (_longPressTriggered) {
    _longPressTriggered = false;
    event.preventDefault();
    event.stopPropagation();
  }
}

/* ══════════════════════════════════════════════════════════════
   10. QUICK REACTION PICKER (long-press or hover)
   ══════════════════════════════════════════════════════════════ */
const QUICK_REACTIONS = ['❤️','😂','👍','😮','😢','🙏','🔥','🎉'];

function showQuickReactions(event, msgId) {
  event.preventDefault();
  _removeCtxMenu();

  const picker = document.createElement('div');
  picker.id = '_msg-ctx-menu';
  picker.style.cssText = `
    position:fixed; z-index:9999;
    background:var(--surface-container-high);
    border:1px solid var(--outline-variant);
    border-radius:999px; padding:8px 12px;
    display:flex; gap:6px; align-items:center;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
  `;

  QUICK_REACTIONS.forEach(em => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      background:none; border:none; font-size:22px; cursor:pointer;
      border-radius:50%; width:36px; height:36px; transition:transform 0.1s;
      display:flex; align-items:center; justify-content:center;
    `;
    btn.textContent = em;
    btn.onmouseenter = () => btn.style.transform = 'scale(1.3)';
    btn.onmouseleave = () => btn.style.transform = 'scale(1)';
    btn.onclick = () => { _removeCtxMenu(); toggleReaction(msgId, em); };
    picker.appendChild(btn);
  });

  // More options button
  const moreBtn = document.createElement('button');
  moreBtn.style.cssText = `
    background:var(--surface-variant); border:none; font-size:14px; cursor:pointer;
    border-radius:50%; width:32px; height:32px; color:var(--on-surface-variant);
    display:flex; align-items:center; justify-content:center; font-weight:700;
  `;
  moreBtn.textContent = '+';
  moreBtn.onclick = () => { _removeCtxMenu(); showMsgContextMenu(event, msgId); };
  picker.appendChild(moreBtn);

  const el = event.currentTarget || event.target;
  const rect = el ? el.getBoundingClientRect() : { left: 0, top: 0 };
  const pw = 340, ph = 56;
  let x = Math.min(rect.left, window.innerWidth - pw - 8);
  let y = rect.top - ph - 8;
  if (y < 8) y = rect.bottom + 8;
  if (x < 8) x = 8;
  if (x + pw > window.innerWidth - 8) x = window.innerWidth - pw - 8;
  picker.style.left = Math.max(8, x) + 'px';
  picker.style.top  = Math.max(8, y) + 'px';

  document.body.appendChild(picker);
  _ctxMenu = picker;
  /* M10: Add copy text option for tablets/long-press */
  if (typeof _addCopyOptionToLongPress === 'function') _addCopyOptionToLongPress(msgId);
  setTimeout(() => {
    document.addEventListener('click', _removeCtxMenu, { once: true });
  }, 50);
}

/* ══════════════════════════════════════════════════════════════
   11. COPY MESSAGE TEXT
   ══════════════════════════════════════════════════════════════ */
function copyMsgText(msgId) {
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const msg = msgs.find(m => m.id === msgId);
  if (!msg) return;
  const text = msg.text || (msg.fileName ? msg.fileName : '');
  if (!text) { showToast('Nothing to copy', 'info'); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success')).catch(() => _fallbackCopy(text));
  } else {
    _fallbackCopy(text);
  }
}

function _fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.setSelectionRange(0, ta.value.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch(_) {}
  ta.remove();
  if (ok) showToast('Copied to clipboard', 'success');
  else showToast('Copy failed — long-press to select', 'info');
}

/* ══════════════════════════════════════════════════════════════
   12. STAR MESSAGE
   ══════════════════════════════════════════════════════════════ */
function starMessage(msgId) {
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const msg = msgs.find(m => m.id === msgId);
  if (!msg) return;
  msg.starred = !msg.starred;
  renderMessages(chatId);
  showToast(msg.starred ? '⭐ Message starred' : 'Star removed', 'success');
  // Firestore persistence
  if (App.db && msgId && !msgId.startsWith('msg_')) {
    App.db.collection('messages').doc(msgId).update({ starred: msg.starred }).catch(() => {});
  }
}

function openStarredMessages() {
  let overlay = document.getElementById('_starred-overlay');
  if (overlay) overlay.remove();
  if (_starredCleanup) { _starredCleanup(); _starredCleanup = null; }

  overlay = document.createElement('div');
  overlay.id = '_starred-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--surface-container);border:1px solid var(--outline-variant);border-radius:24px;width:100%;max-width:480px;max-height:85vh;display:flex;flex-direction:column;margin:16px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.5);';

  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--outline-variant);">
      <h3 style="font-size:18px;font-weight:700;color:var(--on-surface)">⭐ Starred Messages</h3>
      <button id="_starred-close" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant);font-size:20px;padding:4px 8px;border-radius:8px;">✕</button>
    </div>
    <div id="_starred-list" style="overflow-y:auto;padding:8px 12px;flex:1;"></div>`;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeBtn = modal.querySelector('#_starred-close');
  const backdropHandler = e => { if (e.target === overlay) overlay.remove(); };
  const escHandler = e => { if (e.key === 'Escape') { overlay.remove(); _starredCleanup(); } };
  overlay.addEventListener('click', backdropHandler);
  document.addEventListener('keydown', escHandler);
  _starredCleanup = () => { overlay.removeEventListener('click', backdropHandler); document.removeEventListener('keydown', escHandler); };
  if (closeBtn) closeBtn.onclick = () => { overlay.remove(); _starredCleanup(); };

  _renderStarredMessages();
}

let _starredCleanup = null;

function _renderStarredMessages() {
  const list = document.getElementById('_starred-list');
  if (!list) return;
  const starred = [];
  for (const [chatId, msgs] of Object.entries(App.messages)) {
    const chat = App.chats.find(c => c.id === chatId);
    msgs.filter(m => m.starred).forEach(m => {
      starred.push({ msg: m, chatName: chat?.name || 'Unknown', chatId });
    });
  }
  starred.sort((a, b) => (b.msg.time || 0) - (a.msg.time || 0));

  if (!starred.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--on-surface-variant);font-size:14px;">No starred messages yet.<br>Long-press any message and tap ⭐ to star it.</div>';
    return;
  }

  list.innerHTML = starred.map(({ msg, chatName, chatId }) => {
    const text = escHtml(msg.text || (msg.type === 'image' ? '📸 Photo' : msg.type === 'video' ? '🎥 Video' : msg.type === 'voice' ? '🎙️ Voice' : msg.fileName || '📎 Attachment'));
    const time = new Date(msg.time || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date(msg.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div style="padding:12px;border-radius:12px;border-bottom:1px solid var(--outline-variant);cursor:pointer;transition:background 0.15s;" data-msg-id="${msg.id}" data-chat-id="${chatId}">
      <div style="font-size:11px;font-weight:700;color:var(--primary);margin-bottom:4px;">${escHtml(chatName)}</div>
      <div style="font-size:13px;color:var(--on-surface);word-break:break-word;">${text}</div>
      <div style="font-size:10px;color:var(--on-surface-variant);margin-top:4px;">${time}</div>
    </div>`;
  }).join('');

  list.querySelectorAll('div[data-msg-id]').forEach(el => {
    el.onclick = () => {
      const targetChatId = el.dataset.chatId;
      const targetMsgId = el.dataset.msgId;
      const chat = App.chats.find(c => c.id === targetChatId);
      if (chat) {
        openChat(targetChatId);
        setTimeout(() => {
          const msgEl = document.getElementById('msg-' + targetMsgId);
          if (msgEl) {
            msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            msgEl.classList.add('bg-primary/20');
            setTimeout(() => msgEl.classList.remove('bg-primary/20'), 2000);
          }
        }, 300);
      }
      const overlay = document.getElementById('_starred-overlay');
      if (overlay) { overlay.remove(); if (_starredCleanup) _starredCleanup(); }
    };
  });
}

/* ══════════════════════════════════════════════════════════════
   13. MESSAGE INFO PANEL
   ══════════════════════════════════════════════════════════════ */
function openMsgInfo(msgId) {
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const msg = msgs.find(m => m.id === msgId);
  if (!msg) return;

  const body = document.getElementById('msg-info-body');
  if (!body) return;

  const sender = msg.from === 'me' ? (App.currentUser?.displayName || 'You') :
    (App.contacts.find(c => c.uid === msg.from)?.name || 'Unknown');
  const time = new Date(msg.time || Date.now()).toLocaleString();

  body.innerHTML = `
    <div style="background:var(--surface-container-high);border-radius:12px;padding:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Message</div>
      <div style="font-size:14px;color:var(--on-surface);word-break:break-word">${escHtml(msg.text || (msg.fileName ? '📎 ' + msg.fileName : msg.type || ''))}</div>
    </div>
    <div style="space-y:8px">
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--outline-variant)">
        <span style="font-size:13px;color:var(--on-surface-variant);font-weight:600">From</span>
        <span style="font-size:13px;font-weight:700;color:var(--on-surface)">${escHtml(sender)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--outline-variant)">
        <span style="font-size:13px;color:var(--on-surface-variant);font-weight:600">Sent</span>
        <span style="font-size:13px;font-weight:700;color:var(--on-surface)">${time}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--outline-variant)">
        <span style="font-size:13px;color:var(--on-surface-variant);font-weight:600">Status</span>
        <span style="font-size:13px;font-weight:700;color:var(--primary)">${escHtml(msg.status || 'sent')}</span>
      </div>
      ${msg.edited ? `<div style="display:flex;justify-content:space-between;padding:12px 0">
        <span style="font-size:13px;color:var(--on-surface-variant);font-weight:600">Edited</span>
        <span style="font-size:13px;font-weight:700;color:var(--secondary)">Yes</span>
      </div>` : ''}
      ${msg.forwarded ? `<div style="display:flex;justify-content:space-between;padding:12px 0">
        <span style="font-size:13px;color:var(--on-surface-variant);font-weight:600">Forwarded</span>
        <span style="font-size:13px;font-weight:700;color:var(--secondary)">Yes</span>
      </div>` : ''}
    </div>
  `;
  show('msg-info-overlay');
}

/* ══════════════════════════════════════════════════════════════
   14. IN-CHAT SEARCH
   ══════════════════════════════════════════════════════════════ */
let _searchResults = [];
let _searchIdx = 0;
let _searchTerm = '';

function openChatSearch() {
  let bar = document.getElementById('_chat-search-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = '_chat-search-bar';
    bar.style.cssText = `
      position:absolute; top:64px; left:0; right:0; z-index:50;
      background:var(--background);
      border-bottom:1px solid var(--outline-variant);
      padding:10px 16px; display:flex; align-items:center; gap:10px;
    `;
    bar.innerHTML = `
      <span style="font-size:20px;color:var(--on-surface-variant)">🔍</span>
      <input id="_chat-search-input" type="text" placeholder="Search in this chat…" autocomplete="off"
        style="flex:1;background:none;border:none;outline:none;font-size:14px;color:var(--on-surface);"
        oninput="performChatSearch(this.value)" onkeydown="searchNavKey(event)">
      <span id="_search-count" style="font-size:12px;color:var(--on-surface-variant);min-width:50px;text-align:center"></span>
      <button onclick="searchNav(-1)" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant);font-size:20px;">↑</button>
      <button onclick="searchNav(1)"  style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant);font-size:20px;">↓</button>
      <button onclick="closeChatSearch()" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant);font-size:20px;">✕</button>
    `;
    const chatArea = document.getElementById('chat-area');
    if (chatArea) chatArea.appendChild(bar);
  }
  show('_chat-search-bar');
  setTimeout(() => document.getElementById('_chat-search-input')?.focus(), 100);
}

function closeChatSearch() {
  hide('_chat-search-bar');
  _searchResults = []; _searchTerm = '';
  // Remove highlights
  document.querySelectorAll('.msg-search-highlight').forEach(el => {
    el.outerHTML = el.textContent;
  });
  renderMessages(App.currentChat && App.currentChat.id);
}

function performChatSearch(q) {
  _searchTerm = (q || '').toLowerCase().trim();
  _searchResults = [];
  _searchIdx = 0;

  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];

  if (!_searchTerm) {
    document.getElementById('_search-count').textContent = '';
    return;
  }

  msgs.forEach((msg, i) => {
    if (msg.text && msg.text.toLowerCase().includes(_searchTerm)) {
      _searchResults.push(i);
    }
  });

  const countEl = document.getElementById('_search-count');
  if (countEl) {
    countEl.textContent = _searchResults.length ? `1 / ${_searchResults.length}` : 'No results';
  }

  if (_searchResults.length) {
    _scrollToSearchResult(0);
  }
}

function searchNav(dir) {
  if (!_searchResults.length) return;
  _searchIdx = (_searchIdx + dir + _searchResults.length) % _searchResults.length;
  document.getElementById('_search-count').textContent = `${_searchIdx + 1} / ${_searchResults.length}`;
  _scrollToSearchResult(_searchIdx);
}

function searchNavKey(e) {
  if (e.key === 'Enter') searchNav(e.shiftKey ? -1 : 1);
  if (e.key === 'Escape') closeChatSearch();
}

function _scrollToSearchResult(idx) {
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const msgIdx = _searchResults[idx];
  if (msgIdx === undefined) return;
  const msg = msgs[msgIdx];
  if (!msg) return;

  const el = document.getElementById('msg-' + msg.id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'background 0.3s';
    el.style.background = 'var(--primary-container)';
    setTimeout(() => el.style.background = '', 1500);
  }
}

/* ══════════════════════════════════════════════════════════════
   15. REAL FILE UPLOAD (Photo + Document)
   ══════════════════════════════════════════════════════════════ */
// Patch attachPhoto to use real file picker
function attachPhoto() {
  toggleAttachMenu();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.multiple = true;
  input.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    for (const file of files) {
      if (file.size > 16 * 1024 * 1024) { showToast(file.name + ': too large (max 16MB)', 'error'); continue; }
      if (file.type.startsWith('image/') && file.size > 200 * 1024) {
        const compressed = await _compressImage(file, 0.7, 1280);
        await _sendFileMessage(compressed || file);
      } else {
        await _sendFileMessage(file);
      }
    }
    input.remove();
  };
  document.body.appendChild(input);
  input.click();
}

function attachDocument() {
  toggleAttachMenu();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '*/*';
  input.multiple = true;
  input.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
  input.onchange = async () => {
    for (const file of Array.from(input.files || [])) {
      if (file.size > 50 * 1024 * 1024) { showToast(file.name + ': too large (max 50MB)', 'error'); continue; }
      await _sendFileMessage(file);
    }
    input.remove();
  };
  document.body.appendChild(input);
  input.click();
}

function attachCamera() {
  toggleAttachMenu();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Camera not supported on this device', 'error');
    return;
  }
  if (typeof PermissionsManager !== 'undefined') {
    PermissionsManager.ensureForFeature('Take Photo').then(function(ok) {
      if (ok) _openCameraUI();
    });
    return;
  }
  _openCameraUI();
}

let _cameraStream = null;
let _cameraFacing = 'environment';
let _cameraMode = 'photo'; // 'photo' or 'video'
let _cameraRecorder = null;
let _cameraChunks = [];

function _openCameraUI() {
  const overlay = document.createElement('div');
  overlay.id = 'camera-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column';
  overlay.innerHTML = `
    <div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">
      <video id="camera-preview" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
      <div id="camera-rec-indicator" class="hidden" style="position:absolute;top:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.6);padding:6px 14px;border-radius:20px">
        <span style="width:10px;height:10px;border-radius:50%;background:#f44336;animation:pulse 1s infinite"></span>
        <span style="color:#fff;font-size:13px;font-weight:600" id="camera-rec-timer">0:00</span>
      </div>
      <button id="camera-close" style="position:absolute;top:16px;left:16px;width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
      <button id="camera-flip" style="position:absolute;top:16px;right:16px;width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center">🔄</button>
    </div>
    <div style="background:#000;padding:20px 24px 32px;display:flex;flex-direction:column;align-items:center;gap:16px">
      <div style="display:flex;gap:20px">
        <button id="camera-mode-photo" style="padding:6px 16px;border-radius:20px;border:none;font-size:13px;font-weight:700;cursor:pointer;background:#fff;color:#000">Photo</button>
        <button id="camera-mode-video" style="padding:6px 16px;border-radius:20px;border:none;font-size:13px;font-weight:700;cursor:pointer;background:transparent;color:#888;border:1px solid #444">Video</button>
      </div>
      <div style="display:flex;align-items:center;gap:40px">
        <button id="camera-gallery" style="width:44px;height:44px;border-radius:12px;border:2px solid #555;background:transparent;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">🖼️</button>
        <button id="camera-shutter" style="width:72px;height:72px;border-radius:50%;border:4px solid #fff;background:transparent;cursor:pointer;position:relative;transition:all 0.15s">
          <div style="position:absolute;inset:4px;border-radius:50%;background:#fff;transition:all 0.15s"></div>
        </button>
        <div style="width:44px"></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('camera-close').onclick = () => _closeCamera();
  document.getElementById('camera-flip').onclick = () => _flipCamera();
  document.getElementById('camera-gallery').onclick = () => { _closeCamera(); attachPhoto(); };
  document.getElementById('camera-shutter').onclick = () => _capturePhoto();
  document.getElementById('camera-mode-photo').onclick = () => _setCameraMode('photo');
  document.getElementById('camera-mode-video').onclick = () => _setCameraMode('video');

  _cameraFacing = 'environment';
  _cameraMode = 'photo';
  _startCameraStream();
}

async function _startCameraStream() {
  try {
    if (_cameraStream) { _cameraStream.getTracks().forEach(t => t.stop()); }
    const videoConstraints = { width: { ideal: window.isTablet ? 1920 : 1280 }, height: { ideal: window.isTablet ? 1080 : 720 } };
    try { videoConstraints.facingMode = { ideal: _cameraFacing }; } catch(_) { videoConstraints.facingMode = _cameraFacing; }
    _cameraStream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: _cameraMode === 'video'
    });
    const video = document.getElementById('camera-preview');
    if (video) { video.srcObject = _cameraStream; video.play().catch(()=>{}); }
  } catch(e) {
    console.warn('Camera error:', e);
    let msg = 'Camera error';
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') msg = 'Camera permission denied';
    else if (e.name === 'NotFoundError') msg = 'No camera found';
    else if (e.name === 'NotReadableError') msg = 'Camera in use by another app';
    else if (e.name === 'OverconstrainedError') msg = 'Camera does not support required settings';
    else if (e.name === 'AbortError') msg = 'Camera start aborted';
    showToast(msg, 'error');
    _closeCamera();
  }
}

function _flipCamera() {
  _cameraFacing = _cameraFacing === 'environment' ? 'user' : 'environment';
  _startCameraStream();
}

function _setCameraMode(mode) {
  _cameraMode = mode;
  const photoBtn = document.getElementById('camera-mode-photo');
  const videoBtn = document.getElementById('camera-mode-video');
  const shutter = document.getElementById('camera-shutter');
  if (mode === 'photo') {
    photoBtn.style.background = '#fff'; photoBtn.style.color = '#000';
    videoBtn.style.background = 'transparent'; videoBtn.style.color = '#888'; videoBtn.style.border = '1px solid #444';
    if (shutter) shutter.querySelector('div').style.background = '#fff';
  } else {
    videoBtn.style.background = '#f44336'; videoBtn.style.color = '#fff'; videoBtn.style.border = 'none';
    photoBtn.style.background = 'transparent'; photoBtn.style.color = '#888'; photoBtn.style.border = '1px solid #444';
    if (shutter) shutter.querySelector('div').style.background = '#f44336';
  }
  _startCameraStream();
}

async function _capturePhoto() {
  if (_cameraMode === 'video') {
    if (_cameraRecorder && _cameraRecorder.state === 'recording') { _stopVideoCapture(); return; }
    _startVideoCapture();
    return;
  }
  const video = document.getElementById('camera-preview');
  if (!video || !video.srcObject) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(async blob => {
    if (!blob) return;
    const file = new File([blob], 'photo_' + Date.now() + '.jpg', { type: 'image/jpeg' });
    _closeCamera();
    if (file.size > 200 * 1024) {
      showToast('Compressing image…', 'info');
      const compressed = await _compressImage(file, 0.7, 1280);
      _showMediaPreview(compressed || file, 'image');
    } else {
      _showMediaPreview(file, 'image');
    }
  }, 'image/jpeg', 0.92);
}

let _cameraRecTimer = null;
let _cameraRecSec = 0;
let _cameraRecMimeType = '';
function _startVideoCapture() {
  if (!_cameraStream) return;
  if (typeof MediaRecorder === 'undefined') { showToast('Video recording not supported in this browser', 'error'); return; }
  _cameraChunks = [];
  _cameraRecSec = 0;
  const shutter = document.getElementById('camera-shutter');
  if (shutter) { shutter.style.borderColor = '#f44336'; shutter.querySelector('div').style.background = '#f44336'; }
  const indicator = document.getElementById('camera-rec-indicator');
  if (indicator) indicator.classList.remove('hidden');
  _cameraRecTimer = setInterval(() => {
    _cameraRecSec++;
    const el = document.getElementById('camera-rec-timer');
    if (el) el.textContent = Math.floor(_cameraRecSec/60) + ':' + String(_cameraRecSec%60).padStart(2,'0');
    if (_cameraRecSec >= 60) _stopVideoCapture();
  }, 1000);

  try {
    const mimeTypes = ['video/webm;codecs=vp9','video/webm','video/mp4;codecs=h264','video/mp4'];
    _cameraRecMimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
    _cameraRecorder = new MediaRecorder(_cameraStream, _cameraRecMimeType ? { mimeType: _cameraRecMimeType } : {});
    _cameraRecorder.ondataavailable = e => { if (e.data.size) _cameraChunks.push(e.data); };
    _cameraRecorder.onerror = () => { showToast('Video recording failed', 'error'); _stopVideoCapture(); };
    _cameraRecorder.start(100);
  } catch(e) {
    console.warn('MediaRecorder error:', e);
    showToast('Video recording not supported', 'error');
    _stopVideoCapture();
  }
}

function _stopVideoCapture() {
  clearInterval(_cameraRecTimer);
  if (_cameraRecorder && _cameraRecorder.state === 'recording') {
    _cameraRecorder.stop();
  }
  const indicator = document.getElementById('camera-rec-indicator');
  if (indicator) indicator.classList.add('hidden');
  const shutter = document.getElementById('camera-shutter');
  if (shutter) { shutter.style.borderColor = '#fff'; shutter.querySelector('div').style.background = _cameraMode === 'video' ? '#f44336' : '#fff'; }
  setTimeout(() => {
    if (!_cameraChunks.length) return;
    const actualMime = _cameraRecMimeType || _cameraRecorder?.mimeType || 'video/webm';
    const ext = actualMime.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(_cameraChunks, { type: actualMime });
    const file = new File([blob], 'video_' + Date.now() + '.' + ext, { type: actualMime });
    _closeCamera();
    _showMediaPreview(file, 'video');
  }, 200);
}

function _closeCamera() {
  if (_cameraRecorder && _cameraRecorder.state === 'recording') {
    try { _cameraRecorder.stop(); } catch(_) {}
  }
  _cameraRecorder = null;
  if (_cameraStream) { _cameraStream.getTracks().forEach(t => t.stop()); _cameraStream = null; }
  clearInterval(_cameraRecTimer);
  _cameraRecTimer = null;
  _cameraChunks = [];
  const overlay = document.getElementById('camera-overlay');
  if (overlay) overlay.remove();
}

function _showMediaPreview(file, type) {
  const blobUrl = URL.createObjectURL(file);
  const overlay = document.createElement('div');
  overlay.id = 'media-preview-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;animation:fadeIn 0.2s ease';
  if (type === 'image') {
    overlay.innerHTML = `
      <img src="${blobUrl}" style="max-width:90vw;max-height:65vh;border-radius:12px;object-fit:contain">
      <div style="display:flex;gap:12px;padding:16px">
        <button onclick="document.getElementById('media-preview-overlay')?.remove()" style="padding:12px 24px;border-radius:12px;border:none;background:var(--surface-variant);color:var(--on-surface);font-size:14px;font-weight:700;cursor:pointer">Retake</button>
        <button id="media-preview-send" style="padding:12px 24px;border-radius:12px;border:none;background:var(--primary);color:var(--on-primary);font-size:14px;font-weight:700;cursor:pointer">Send</button>
      </div>`;
  } else {
    overlay.innerHTML = `
      <video src="${blobUrl}" controls style="max-width:90vw;max-height:65vh;border-radius:12px"></video>
      <div style="display:flex;gap:12px;padding:16px">
        <button onclick="document.getElementById('media-preview-overlay')?.remove()" style="padding:12px 24px;border-radius:12px;border:none;background:var(--surface-variant);color:var(--on-surface);font-size:14px;font-weight:700;cursor:pointer">Retake</button>
        <button id="media-preview-send" style="padding:12px 24px;border-radius:12px;border:none;background:var(--primary);color:var(--on-primary);font-size:14px;font-weight:700;cursor:pointer">Send</button>
      </div>`;
  }
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); URL.revokeObjectURL(blobUrl); } });
  const escHandler = e => { if (e.key === 'Escape') { overlay.remove(); URL.revokeObjectURL(blobUrl); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
  document.getElementById('media-preview-send')?.addEventListener('click', () => {
    overlay.remove();
    URL.revokeObjectURL(blobUrl);
    _sendFileMessage(file);
  });
}

async function _compressImage(file, quality, maxDim) {
  return new Promise(resolve => {
    try {
      const img = new Image();
      const blobUrl = URL.createObjectURL(file);
      img.onload = () => {
        try {
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio); h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob(blob => {
            try { URL.revokeObjectURL(blobUrl); } catch(_) {}
            if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            else resolve(file);
          }, 'image/jpeg', quality);
        } catch(_) { try { URL.revokeObjectURL(blobUrl); } catch(_) {} resolve(file); }
      };
      img.onerror = () => { try { URL.revokeObjectURL(blobUrl); } catch(_) {} resolve(file); };
      img.src = blobUrl;
    } catch(_) { resolve(file); }
  });
}

async function _sendFileMessage(file, _unused, extraMeta) {
  if (!App.currentChat) return;
  const chatId = App.currentChat.id;
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isVoice = file.type.startsWith('audio/');

  // Create local blob URL for preview
  const blobUrl = URL.createObjectURL(file);
  const type = isVoice ? 'voice' : isImage ? 'image' : isVideo ? 'video' : 'doc';
  const fmtSize = _fmtBytes(file.size);

  const msg = {
    id:       'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    from:     'me',
    type:     type,
    url:      blobUrl,
    fileName: file.name,
    fileSize: fmtSize,
    time:     Date.now(),
    status:   'sending',
    ...(extraMeta || {}),
  };

  if (isVoice && extraMeta) {
    msg.duration = extraMeta.duration || '0:00';
    msg.durationSec = extraMeta.durationSec || 0;
  }

  if (!App.messages[chatId]) App.messages[chatId] = [];
  App.messages[chatId].push(msg);
  App.currentChat.lastMsg  = type === 'image' ? '📸 Photo' : type === 'video' ? '🎥 Video' : '📎 ' + file.name;
  App.currentChat.lastTime = msg.time;
  renderMessages(chatId);
  scrollToBottom(true);
  renderChatList();
  showToast('Uploading…', 'info');

  // Upload to Firebase Storage (free, no Cloudinary dependency)
  try {
    let uploadUrl = blobUrl;
    if (App.db && window.firebase && firebase.storage) {
      const user = App.auth && App.auth.currentUser;
      const uid = user ? user.uid : 'anonymous';
      const safe = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = 'chat_uploads/' + uid + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + safe;
      const storageRef = firebase.storage().ref(path);
      const snap = await storageRef.put(file);
      uploadUrl = await snap.ref.getDownloadURL();
    } else if (typeof window.uploadToFirebaseStorage === 'function') {
      uploadUrl = await window.uploadToFirebaseStorage(file, 'chat_uploads');
    }

    msg.url    = uploadUrl;
    msg.status = 'sent';
    renderMessages(chatId);
    if (uploadUrl !== blobUrl) {
      msg.localBlobUrl = blobUrl;
      try { URL.revokeObjectURL(blobUrl); } catch(_) {}
    }
    showToast('File sent', 'success');

    // Write to Firebase
    if (App.db && App.auth && App.auth.currentUser) {
      const uid = App.auth.currentUser.uid;
      const isGroup = App.currentChat.type === 'group';
      const data = {
        senderId: uid,
        senderName: App.currentUser.displayName || App.currentUser.email || 'Me',
        text: '',
        attachment: { type, url: uploadUrl, filename: file.name, size: fmtSize },
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
      };
      if (isVoice) {
        data.attachment.duration = msg.duration;
        data.attachment.durationSec = msg.durationSec;
      }
      if (isGroup) data.groupId = chatId;
      else { data.directId = chatId; data.participants = [uid, App.currentChat.uid || '']; }
      App.db.collection('messages').add(data).catch(console.error);
    }
  } catch (e) {
    msg.status = 'failed';
    renderMessages(chatId);
    showToast('Upload failed — using local preview', 'error');
    console.error('Upload error:', e);
  }
}

function _fmtBytes(b) {
  if (!b) return '';
  const u = ['B','KB','MB','GB'];
  let s = b, i = 0;
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++; }
  return s.toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
}

/* ══════════════════════════════════════════════════════════════
   16. VOICE MESSAGE — real MediaRecorder with pause/resume
   ══════════════════════════════════════════════════════════════ */
let _mediaRecorder = null;
let _audioChunks   = [];
let _recTimerInt   = null;
let _recSec        = 0;
let _recPaused     = false;
let _audioContext  = null;
let _analyser      = null;
let _waveformAnim  = null;
const REC_MAX_SECONDS = 300; // 5 minutes

function startRecording() {
  if (App.isRecording) { cancelRecording(); }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Microphone not supported on this device', 'error');
    return;
  }
  if (typeof MediaRecorder === 'undefined') {
    showToast('Audio recording not supported in this browser', 'error');
    return;
  }
  if (typeof PermissionsManager !== 'undefined') {
    PermissionsManager.ensureForFeature('Record Voice Message').then(ok => {
      if (!ok) return;
      _doStartRecording();
    });
    return;
  }
  _doStartRecording();
}

function _doStartRecording() {
  App.isRecording = true;
  App.recordingSeconds = 0;
  _recSec = 0;
  _recPaused = false;
  _audioChunks = [];

  show('recording-bar');
  hide('input-bar');
  setEl('rec-timer', '0:00');
  setEl('rec-limit', '');
  const pauseIcon = document.getElementById('rec-pause-icon');
  if (pauseIcon) pauseIcon.textContent = 'pause';
  const pauseBtn = document.getElementById('rec-pause-btn');
  const canPauseResume = typeof MediaRecorder.prototype.pause === 'function';
  if (pauseBtn && !canPauseResume) pauseBtn.style.display = 'none';
  const dot = document.getElementById('rec-dot');
  if (dot) { dot.classList.remove('bg-warning'); dot.classList.add('bg-error'); dot.style.animationPlayState = 'running'; }

  _recTimerInt = setInterval(() => {
    if (_recPaused) return;
    _recSec++;
    App.recordingSeconds = _recSec;
    setEl('rec-timer', _fmtDur(_recSec));
    if (_recSec >= REC_MAX_SECONDS - 30) {
      setEl('rec-limit', '(' + (REC_MAX_SECONDS - _recSec) + 's left)');
    }
    if (_recSec >= REC_MAX_SECONDS) { stopRecording(); sendVoiceMessage(); }
  }, 1000);

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    try { _audioContext = new (window.AudioContext || window.webkitAudioContext)(); } catch(_) { _audioContext = null; }
    if (_audioContext) {
      try {
        _analyser = _audioContext.createAnalyser();
        _analyser.fftSize = 64;
        const source = _audioContext.createMediaStreamSource(stream);
        source.connect(_analyser);
        _animateRealWaveform();
      } catch(_) { _analyser = null; }
    }

    try {
      const mimeType = getSupportedMimeType();
      _mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    } catch(e) {
      console.warn('MediaRecorder init failed:', e);
      showToast('Audio recording not supported', 'error');
      stream.getTracks().forEach(t => t.stop());
      cancelRecording();
      return;
    }
    _mediaRecorder.ondataavailable = e => { if (e.data.size) _audioChunks.push(e.data); };
    _mediaRecorder.start(100);
  }).catch(e => {
    console.warn('Mic error:', e);
    showToast('Microphone permission denied', 'error');
    cancelRecording();
  });
}

function togglePauseRecording() {
  if (!_mediaRecorder || _mediaRecorder.state === 'inactive') return;
  if (typeof _mediaRecorder.pause !== 'function') {
    showToast('Pause not supported — stop to finish', 'info');
    return;
  }
  if (_recPaused) {
    try { _mediaRecorder.resume(); } catch(_) {}
    _recPaused = false;
    const dot = document.getElementById('rec-dot');
    if (dot) { dot.style.animationPlayState = 'running'; dot.classList.remove('bg-warning'); dot.classList.add('bg-error'); }
    const icon = document.getElementById('rec-pause-icon');
    if (icon) icon.textContent = 'pause';
  } else {
    try { _mediaRecorder.pause(); } catch(_) { showToast('Pause not available', 'info'); return; }
    _recPaused = true;
    const dot = document.getElementById('rec-dot');
    if (dot) { dot.style.animationPlayState = 'paused'; dot.classList.remove('bg-error'); dot.classList.add('bg-warning'); }
    const icon = document.getElementById('rec-pause-icon');
    if (icon) icon.textContent = 'play_arrow';
  }
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4;codecs=aac','audio/mp4'];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

function stopRecording() {
  App.isRecording = false;
  clearInterval(_recTimerInt);
  if (_waveformAnim) { cancelAnimationFrame(_waveformAnim); _waveformAnim = null; }
  if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
    _mediaRecorder.stop();
    _mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
  if (_audioContext) { _audioContext.close().catch(()=>{}); _audioContext = null; _analyser = null; }
}

function cancelRecording() {
  stopRecording();
  _audioChunks = [];
  _recPaused = false;
  hide('recording-bar');
  show('input-bar');
}

function sendVoiceMessage() {
  stopRecording();
  hide('recording-bar');
  show('input-bar');

  if (!_audioChunks.length || !App.currentChat) {
    showToast('No audio recorded', 'error');
    return;
  }

  const blob = new Blob(_audioChunks, { type: getSupportedMimeType() || 'audio/webm' });
  const duration = _fmtDur(_recSec);
  const durSec = _recSec;
  const chatId = App.currentChat.id;

  App.currentChat.lastMsg  = '🎙️ Voice (' + duration + ')';
  App.currentChat.lastTime = Date.now();
  renderChatList();
  showToast('Voice message sent', 'success');

  _sendFileMessage(new File([blob], 'voice_' + Date.now() + '.' + (blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'), { type: blob.type }), null, { duration: duration, durationSec: durSec }).catch(() => {});
}

function _animateRealWaveform() {
  const wf = document.getElementById('recording-waveform');
  if (!wf || !_analyser) return;
  const data = new Uint8Array(_analyser.frequencyBinCount);
  const bars = Math.min(data.length, 30);
  wf.innerHTML = '';
  const barEls = [];
  for (let i = 0; i < bars; i++) {
    const div = document.createElement('div');
    div.style.cssText = 'width:3px;height:8%;border-radius:2px;transition:height 0.08s';
    wf.appendChild(div);
    barEls.push(div);
  }
  function draw() {
    if (!App.isRecording) return;
    _analyser.getByteFrequencyData(data);
    const color = _recPaused ? 'var(--warning)' : 'var(--primary)';
    for (let i = 0; i < bars; i++) {
      const h = Math.max(8, (data[i] / 255) * 100);
      barEls[i].style.height = h + '%';
      barEls[i].style.background = color;
    }
    _waveformAnim = requestAnimationFrame(draw);
  }
  draw();
}

function _fmtDur(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/* ══════════════════════════════════════════════════════════════
   17. DRAFT SAVING / RESTORING
   ══════════════════════════════════════════════════════════════ */
function saveDraft(chatId, text) {
  if (!chatId) return;
  const key = 'nsl_draft_' + chatId;
  if (text && text.trim()) {
    localStorage.setItem(key, text);
  } else {
    localStorage.removeItem(key);
  }
}

function restoreDraft(chatId) {
  if (!chatId) return '';
  return localStorage.getItem('nsl_draft_' + chatId) || '';
}

function clearDraft(chatId) {
  if (chatId) localStorage.removeItem('nsl_draft_' + chatId);
}

/* ══════════════════════════════════════════════════════════════
   18. PROFILE EDITING
   ══════════════════════════════════════════════════════════════ */
function editName() {
  const current = App.currentUser && (App.currentUser.displayName || App.currentUser.email || '');
  const newName = window.prompt('Enter your display name:', current);
  if (!newName || !newName.trim()) return;
  const trimmed = newName.trim();
  if (App.currentUser) App.currentUser.displayName = trimmed;
  updateProfileUI();
  showToast('Name updated', 'success');

  if (App.auth && App.auth.currentUser) {
    App.auth.currentUser.updateProfile({ displayName: trimmed }).catch(() => {});
    if (App.db) {
      App.db.collection('users').doc(App.auth.currentUser.uid)
        .set({ displayName: trimmed }, { merge: true }).catch(() => {});
    }
  }
}

function editStatus() {
  const current = App.currentUser && (App.currentUser.statusText || 'Available');
  const newStatus = window.prompt('Enter your status:', current);
  if (!newStatus || !newStatus.trim()) return;
  const trimmed = newStatus.trim();
  if (App.currentUser) App.currentUser.statusText = trimmed;
  setEl('settings-status', trimmed);
  showToast('Status updated', 'success');

  if (App.auth && App.auth.currentUser && App.db) {
    App.db.collection('users').doc(App.auth.currentUser.uid)
      .set({ statusText: trimmed }, { merge: true }).catch(() => {});
  }
}

function changeAvatar() {
  const input = document.getElementById('file-input-avatar');
  if (!input) return;
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please pick an image', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Image too large (max 5MB)', 'error'); return; }

    const blobUrl = URL.createObjectURL(file);
    // Optimistic UI update
    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) avatarEl.innerHTML = `<img src="${blobUrl}" class="w-full h-full object-cover rounded-full">`;
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    if (sidebarAvatar) sidebarAvatar.innerHTML = `<img src="${blobUrl}" class="w-full h-full object-cover rounded-full">`;
    showToast('Uploading avatar…', 'info');

    try {
      let uploadUrl = blobUrl;
      if (App.db && window.firebase && firebase.storage) {
        const uid = App.auth.currentUser.uid;
        const ref = firebase.storage().ref('avatars/' + uid + '/' + Date.now() + '_' + (file.name || 'avatar').replace(/[^a-zA-Z0-9._-]/g, '_'));
        await ref.put(file);
        uploadUrl = await ref.getDownloadURL();
      } else if (typeof window.uploadToFirebaseStorage === 'function') {
        uploadUrl = await window.uploadToFirebaseStorage(file, 'avatars');
      }

      if (App.auth && App.auth.currentUser) {
        await App.auth.currentUser.updateProfile({ photoURL: uploadUrl }).catch(() => {});
        if (App.db) {
          await App.db.collection('users').doc(App.auth.currentUser.uid)
            .set({ photoURL: uploadUrl, avatar: uploadUrl }, { merge: true }).catch(() => {});
        }
      }
      if (App.currentUser) App.currentUser.photoURL = uploadUrl;
      showToast('Avatar updated!', 'success');
    } catch (e) {
      showToast('Avatar upload failed', 'error');
      console.error(e);
    }
    input.value = '';
  };
  input.click();
}

/* ══════════════════════════════════════════════════════════════
   19. GROUP CREATION WIZARD
   ══════════════════════════════════════════════════════════════ */
let _newGroupMembers = [];

function openNewGroup() {
  closeModal('new-chat-overlay');
  _newGroupMembers = [];

  let overlay = document.getElementById('_group-create-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = '_group-create-overlay';
    overlay.className = 'hidden';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9998;
      background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);
      display:flex;align-items:center;justify-content:center;
    `;
    overlay.innerHTML = `
      <div style="
        background:var(--surface-container); border:1px solid var(--outline-variant);
        border-radius:24px; width:100%; max-width:480px; max-height:85vh;
        display:flex; flex-direction:column; margin:16px;
        box-shadow:0 24px 64px rgba(0,0,0,0.5); overflow:hidden;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--outline-variant);">
          <h3 style="font-size:18px;font-weight:700;color:var(--on-surface)">👥 New Group</h3>
          <button onclick="closeModal('_group-create-overlay')" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant);font-size:20px;">✕</button>
        </div>
        <div style="padding:20px 24px;border-bottom:1px solid var(--outline-variant);display:flex;flex-direction:column;gap:12px;">
          <input id="_grp-name" type="text" placeholder="Group name *" maxlength="60" style="
            width:100%;padding:12px 16px;border-radius:12px;border:1px solid var(--outline-variant);
            background:var(--surface-container-low);color:var(--on-surface);font-size:14px;box-sizing:border-box;
          ">
          <input id="_grp-desc" type="text" placeholder="Description (optional)" maxlength="200" style="
            width:100%;padding:12px 16px;border-radius:12px;border:1px solid var(--outline-variant);
            background:var(--surface-container-low);color:var(--on-surface);font-size:14px;box-sizing:border-box;
          ">
          <div id="_grp-selected-chips" style="display:flex;flex-wrap:wrap;gap:6px;min-height:28px;"></div>
        </div>
        <div style="padding:12px;flex:1;overflow-y:auto;" id="_grp-member-list"></div>
        <div style="padding:16px 24px;border-top:1px solid var(--outline-variant);">
          <button onclick="createGroupNow()" style="
            width:100%;padding:14px;border-radius:14px;border:none;
            background:var(--primary);color:var(--on-primary);
            font-size:14px;font-weight:700;cursor:pointer;
            transition:opacity 0.15s;
          ">Create Group</button>
        </div>
      </div>
    `;
    overlay.onclick = e => { if (e.target === overlay) closeModal('_group-create-overlay'); };
    document.body.appendChild(overlay);
  }

  // Populate member list
  const list = document.getElementById('_grp-member-list');
  if (list) {
    list.innerHTML = App.contacts.map(c => `
      <div id="_grp-member-${c.uid}" onclick="toggleGroupMember('${c.uid}')" style="
        display:flex;align-items:center;gap:12px;padding:10px 16px;border-radius:12px;cursor:pointer;
        transition:background 0.15s;
      " onmouseenter="this.style.background='var(--surface-container-highest)'"
         onmouseleave="this.style.background=_newGroupMembers.some(m=>m.uid==='${c.uid}')?'var(--primary-container)':'transparent'">
        <div style="width:16px;height:16px;border-radius:4px;border:2px solid var(--outline);
          background:transparent;display:flex;align-items:center;justify-content:center;
          transition:all 0.15s;" id="_chk-${c.uid}"></div>
        ${c.initials
          ? `<div style="width:36px;height:36px;border-radius:50%;background:var(--surface-container-highest);
            display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;
            color:var(--on-surface-variant);">${escHtml(c.initials)}</div>`
          : `<div style="width:36px;height:36px;border-radius:50%;background:var(--surface-container-highest);
            display:flex;align-items:center;justify-content:center;
            color:var(--on-surface-variant);"><span class="material-symbols-outlined" style="font-size:16px;">person_off</span></div>`}
        <div>
          <div style="font-weight:700;font-size:14px;color:var(--on-surface)">${escHtml(c.name)}</div>
          <div style="font-size:11px;color:var(--on-surface-variant)">${escHtml(c.about || c.status || '')}</div>
        </div>
      </div>
    `).join('');
  }

  show('_group-create-overlay');
}

function toggleGroupMember(uid) {
  const contact = App.contacts.find(c => c.uid === uid);
  if (!contact) return;

  const idx = _newGroupMembers.findIndex(m => m.uid === uid);
  if (idx >= 0) {
    _newGroupMembers.splice(idx, 1);
  } else {
    _newGroupMembers.push(contact);
  }

  // Update checkbox visual
  const chk = document.getElementById('_chk-' + uid);
  const row = document.getElementById('_grp-member-' + uid);
  if (chk) {
    const selected = _newGroupMembers.some(m => m.uid === uid);
    chk.style.background   = selected ? 'var(--primary)' : 'transparent';
    chk.style.border       = selected ? '2px solid var(--primary)' : '2px solid var(--outline)';
    chk.innerHTML          = selected ? `<span style="color:var(--on-primary);font-size:10px;font-weight:900">✓</span>` : '';
    if (row) row.style.background = selected ? 'var(--primary-container)' : 'transparent';
  }

  // Update chips
  const chips = document.getElementById('_grp-selected-chips');
  if (chips) {
    chips.innerHTML = _newGroupMembers.map(m => `
      <span style="display:inline-flex;align-items:center;gap:4px;background:var(--primary-container);
        color:var(--on-primary-container);padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;">
        ${escHtml(m.initials || m.name[0] || '')} ${escHtml(m.name)}
        <button onclick="toggleGroupMember('${m.uid}')" style="background:none;border:none;cursor:pointer;
          color:var(--on-primary-container);font-size:14px;padding:0 0 0 4px;line-height:1;">✕</button>
      </span>
    `).join('');
  }
}

async function createGroupNow() {
  const name = (document.getElementById('_grp-name')?.value || '').trim();
  const desc = (document.getElementById('_grp-desc')?.value || '').trim();

  if (!name) { showToast('Group name is required', 'error'); return; }

  closeModal('_group-create-overlay');
  showToast('Creating group…', 'info');

  const chatId = 'grp_' + Date.now();
  const uid    = App.auth && App.auth.currentUser && App.auth.currentUser.uid;
  const newGroup = {
    id: chatId, type: 'group',
    name, description: desc,
    avatar: 'bg-surface-container-highest text-on-surface-variant',
    initials: getInitials(name),
    photoURL: null,
    lastMsg: 'Group created',
    lastTime: Date.now(),
    unread: 0, pinned: false, muted: false,
    memberCount: _newGroupMembers.length + 1,
    members: _newGroupMembers.map(m => m.uid).concat(uid ? [uid] : []),
  };

  if (!App.groupChats) App.groupChats = [];
  App.groupChats.unshift(newGroup);
  App.messages[chatId] = [{
    id: 'sys_' + Date.now(), from: 'system',
    text: `${App.currentUser?.displayName || 'You'} created this group`,
    type: 'text', time: Date.now(), status: 'read',
  }];
  mergeAndRenderChats();
  openChat(chatId);
  showToast(`Group "${name}" created!`, 'success');

  // Firebase
  if (App.db && uid) {
    try {
      const memberIds = newGroup.members;
      const ref = await App.db.collection('groups').add({
        name, description: desc,
        createdBy: uid,
        ownerId: uid,
        memberIds,
        members: memberIds,
        adminIds: [uid],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        memberCount: memberIds.length,
      });
      newGroup.id = ref.id;
      mergeAndRenderChats();

      // Re-open chat with real Firestore ID so message subscription uses correct groupId
      if (App.messagesUnsubscribe) {
        App.messagesUnsubscribe();
        App.messagesUnsubscribe = null;
      }
      openChat(ref.id);

      // Send invites to members — write to members subcollection (single source
      // of truth; syncGroupMemberCreated trigger recomputes memberIds/adminIds).
      for (const m of _newGroupMembers) {
        const memberId = m.uid;
        if (!memberId || memberId === uid) continue;
        await App.db.collection('groups').doc(ref.id).collection('members').doc(memberId).set({
          uid: memberId,
          displayName: m.displayName || m.name || 'Member',
          photoURL: m.photoURL || '',
          role: 'member',
          addedBy: uid,
          addedAt: Date.now(),
        }).catch(() => {});
      }
      // Add creator as admin
      await App.db.collection('groups').doc(ref.id).collection('members').doc(uid).set({
        uid: uid,
        displayName: App.currentUser?.displayName || 'Admin',
        photoURL: App.currentUser?.photoURL || '',
        role: 'admin',
        addedBy: uid,
        addedAt: Date.now(),
      }).catch(() => {});
    } catch (e) {
      console.error('Group create error:', e);
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   20. MUTE CHAT (proper per-chat) — delegates to app.js toggleMuteChat
   ══════════════════════════════════════════════════════════════ */
function toggleChatMute(chatId) {
  const prevChat = App.currentChat;
  App.currentChat = App.chats.find(c => c.id === chatId) || App.currentChat;
  if (typeof toggleMuteChat === 'function') toggleMuteChat();
  App.currentChat = prevChat;
  renderChatList();
}

/* ══════════════════════════════════════════════════════════════
   20b. DISAPPEARING MESSAGES
   ══════════════════════════════════════════════════════════════ */
function setDisappearingMessages(chatId, ttlMs) {
  if (!App.db || !App.auth?.currentUser) return;
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) return;
  const isGroup = chat.type === 'group';
  const col = isGroup ? 'groups' : 'directChats';
  
  App.db.collection(col).doc(chatId).set({
    disappearingMessages: ttlMs
  }, { merge: true }).catch(() => {});
  
  chat.disappearingMessages = ttlMs;
  
  if (ttlMs > 0) {
    applyTTLToExistingMessages(chatId, ttlMs);
  }
  
  showToast(ttlMs > 0 ? `Messages will disappear after ${formatTTL(ttlMs)}` : 'Disappearing messages off', 'info');
}

function formatTTL(ms) {
  if (ms >= 86400000 * 90) return '90 days';
  if (ms >= 86400000 * 7) return '7 days';
  if (ms >= 86400000) return '24 hours';
  return 'shortly';
}

function applyTTLToExistingMessages(chatId, ttlMs) {
  const msgs = App.messages[chatId] || [];
  const now = Date.now();
  msgs.forEach(msg => {
    if (!msg.expiresAt && msg.time) {
      const expiresAt = msg.time + ttlMs;
      if (expiresAt > now && !msg.id.startsWith('msg_')) {
        App.db.collection('messages').doc(msg.id).update({
          expiresAt: expiresAt
        }).catch(() => {});
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   21. ARCHIVE CHAT — persisted to Firestore users/{uid}.archivedChats
   ══════════════════════════════════════════════════════════════ */
if (!App._archivedChatIds) App._archivedChatIds = new Set();

function loadArchivedChats() {
  if (!App.db || !App.auth?.currentUser) return;
  const uid = App.auth.currentUser.uid;
  App._archivedLoading = true;
  return App.db.collection('users').doc(uid).get().then(doc => {
    const data = doc.data();
    const ids = data?.archivedChats || [];
    App._archivedChatIds = new Set(ids);
    App._archivedLoading = false;
    renderChatList();
  }).catch(e => {
    console.warn('[Archive] load failed:', e);
    App._archivedLoading = false;
  });
}

function _persistArchivedChats() {
  if (!App.db || !App.auth?.currentUser) return;
  const uid = App.auth.currentUser.uid;
  App.db.collection('users').doc(uid).set({
    archivedChats: Array.from(App._archivedChatIds)
  }, { merge: true }).catch(e => console.warn('[Archive] persist failed:', e));
}

function archiveChat(chatId) {
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) return;
  showConfirm(`Archive "${chat.name}"? You can find it in the More > Archived Chats.`, () => {
    App._archivedChatIds.add(chatId);
    _persistArchivedChats();
    if (App.currentChat && App.currentChat.id === chatId) showWelcome();
    renderChatList();
    showToast(`"${chat.name}" archived`, 'success');
  });
}

function unarchiveChat(chatId) {
  const chat = App.chats.find(c => c.id === chatId);
  const name = chat?.name || 'Chat';
  App._archivedChatIds.delete(chatId);
  _persistArchivedChats();
  renderChatList();
  openArchivedChats();
  showToast(`"${name}" restored to chat list`, 'success');
}

function openArchivedChats() {
  const archived = App.chats.filter(c => App._archivedChatIds.has(c.id));
  const list = document.getElementById('chat-list');
  if (!list) return;

  if (!archived.length) {
    list.innerHTML = `
      <div class="flex flex-col items-center py-16 text-center px-6">
        <div class="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4 border border-outline-variant/20">
          <span class="material-symbols-outlined text-on-surface-variant text-3xl">archive</span>
        </div>
        <h4 class="font-bold text-on-surface mb-1">No archived chats</h4>
        <p class="text-on-surface-variant text-sm">Chats you archive will appear here.</p>
      </div>`;
    return;
  }

  let html = `
    <div class="px-4 py-3 flex items-center gap-2 border-b border-outline-variant/20 bg-surface-container-low/30">
      <button onclick="switchTab(App.activeTab)" class="p-2 -ml-2 rounded-full hover:bg-surface-variant/40 text-on-surface-variant">
        <span class="material-symbols-outlined text-xl">arrow_back</span>
      </button>
      <span class="material-symbols-outlined text-primary text-xl">archive</span>
      <span class="text-sm font-bold text-on-surface">Archived Chats</span>
      <span class="text-[10px] bg-surface-variant rounded-full px-2 py-0.5 font-semibold text-on-surface-variant">${archived.length}</span>
    </div>`;

  html += archived.map(chat => {
    const timeStr = formatChatTime(chat.lastTime);
    return `
    <div class="flex items-center gap-3 px-4 py-3 hover:bg-surface-container-high/50 cursor-pointer transition-colors" onclick="openChat('${chat.id}');switchTab('chats');">
      <div class="relative flex-shrink-0">
        <div class="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-sm text-on-surface-variant">${chat.initials || '?'}</div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-baseline">
          <span class="text-sm font-semibold text-on-surface truncate">${escHtml(chat.name)}</span>
          <span class="text-[10px] text-on-surface-variant ml-2 flex-shrink-0">${timeStr}</span>
        </div>
        <p class="text-xs text-on-surface-variant truncate mt-0.5">${escHtml(chat.lastMsg || '')}</p>
      </div>
      <button onclick="event.stopPropagation();unarchiveChat('${chat.id}')" class="p-2 rounded-full hover:bg-surface-variant/40 text-on-surface-variant flex-shrink-0" title="Unarchive">
        <span class="material-symbols-outlined text-lg">unarchive</span>
      </button>
    </div>`;
  }).join('');

  list.innerHTML = html;
  renderEmojiInElement(list);
}

/* ══════════════════════════════════════════════════════════════
   22. CLEAR ALL CHATS (profile danger zone)
   ══════════════════════════════════════════════════════════════ */
function confirmClearAllChats() {
  closeModal('profile-overlay');
  showConfirm('Clear ALL conversation histories? This cannot be undone.', () => {
    App.messages = {};
    App.chats.forEach(c => { c.lastMsg = ''; });
    renderChatList();
    if (App.currentChat) renderMessages(App.currentChat.id);
    showToast('All histories cleared', 'info');
  });
}

/* ══════════════════════════════════════════════════════════════
   23. MEDIA GALLERY VIEWER (in-chat media browser with tabs)
   ══════════════════════════════════════════════════════════════ */
let _galleryCleanup = null;

function _closeMediaGallery() {
  const overlay = document.getElementById('_media-gallery');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.classList.add('hidden');
  }
  if (_galleryCleanup) { _galleryCleanup(); _galleryCleanup = null; }
}

function _renderGalleryTab(tab) {
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const container = document.getElementById('_gallery-content');
  if (!container) return;
  
  let filtered = [];
  if (tab === 'photos') filtered = msgs.filter(m => m.type === 'image');
  else if (tab === 'videos') filtered = msgs.filter(m => m.type === 'video');
  else if (tab === 'docs') filtered = msgs.filter(m => m.type === 'doc');
  else if (tab === 'urls') filtered = msgs.filter(m => m.text && (m.text.includes('http://') || m.text.includes('https://') || m.text.includes('www.')));
  else filtered = msgs.filter(m => m.type === 'image' || m.type === 'video' || m.type === 'doc');
  
  // Update tab button styles
  document.querySelectorAll('._gallery-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.style.background = isActive ? 'var(--surface-container-highest,rgba(255,255,255,0.15))' : 'transparent';
    btn.style.color = isActive ? 'var(--on-surface)' : 'var(--on-surface-variant,rgba(255,255,255,0.6))';
    btn.style.fontWeight = isActive ? '700' : '500';
  });
  
  if (!filtered.length) {
    container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--on-surface-variant,rgba(255,255,255,0.4));gap:12px;"><span class="material-symbols-outlined" style="font-size:48px;">perm_media</span><p style="font-size:14px;">No ' + tab + ' shared yet</p></div>';
    return;
  }
  
  if (tab === 'urls') {
    // List view for URLs
    container.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;padding:16px;">' +
      filtered.map(m => {
        const urlMatch = m.text.match(/(https?:\/\/[^\s]+)/g);
        const url = urlMatch ? urlMatch[0] : m.text;
        let hostname = '';
        try { hostname = new URL(url).hostname || url; } catch(_) { hostname = url; }
        return `<div onclick="openMediaViewer('${m.id}','text')" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,0.05);border-radius:12px;cursor:pointer;transition:background 0.15s;" onmouseenter="this.style.background='rgba(255,255,255,0.1)'" onmouseleave="this.style.background='rgba(255,255,255,0.05)'">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-outlined" style="color:rgba(255,255,255,0.7);">link</span></div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(hostname)}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(url)}</div>
          </div>
        </div>`;
      }).join('') + '</div>';
  } else if (tab === 'docs') {
    // List view for documents
    container.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;padding:16px;">' +
      filtered.map(m => {
        const ext = (m.fileName || '').split('.').pop().toUpperCase() || 'FILE';
        return `<div onclick="openMediaViewer('${m.id}')" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,0.05);border-radius:12px;cursor:pointer;transition:background 0.15s;" onmouseenter="this.style.background='rgba(255,255,255,0.1)'" onmouseleave="this.style.background='rgba(255,255,255,0.05)'">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(66,133,244,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:10px;font-weight:800;color:#4285f4;">${escHtml(ext)}</span></div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(m.fileName || 'Document')}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.5);">${m.fileSize || ''}</div>
          </div>
        </div>`;
      }).join('') + '</div>';
  } else {
    // Grid view for photos and videos
    container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;padding:16px;">' +
      filtered.map(m => {
        const isVideo = m.type === 'video';
        return `<div onclick="openMediaViewer('${m.id}')" style="aspect-ratio:1;border-radius:12px;overflow:hidden;cursor:pointer;background:rgba(255,255,255,0.05);position:relative;transition:transform 0.15s;" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'">
          ${isVideo
            ? `<video src="${escHtml(m.url)}" preload="metadata" muted style="width:100%;height:100%;object-fit:cover"></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:white;font-size:28px;background:rgba(0,0,0,0.15);"><span class="material-symbols-outlined" style="font-size:36px;">play_circle</span></div>`
            : `<img src="${escHtml(m.url)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
          }
        </div>`;
      }).join('') + '</div>';
  }
}

window.openMediaGallery = function openMediaGallery(initialTab) {
  initialTab = initialTab || 'photos';
  let overlay = document.getElementById('_media-gallery');
  
  // Remove existing overlay to rebuild
  if (overlay) {
    overlay.remove();
    if (_galleryCleanup) { _galleryCleanup(); _galleryCleanup = null; }
  }
  
  overlay = document.createElement('div');
  overlay.id = '_media-gallery';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,0.9);backdrop-filter:blur(12px);display:flex;flex-direction:column;';
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:20px 24px;color:white;flex-shrink:0;';
  header.innerHTML = '<h3 style="font-size:18px;font-weight:700;">Media & Files</h3>';
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
    closeBtn.style.cssText = 'background:var(--surface-container-highest,rgba(255,255,255,0.1));border:none;border-radius:50%;width:44px;height:44px;color:var(--on-surface);cursor:pointer;display:flex;align-items:center;justify-content:center;';
  closeBtn.onclick = _closeMediaGallery;
  header.appendChild(closeBtn);
  overlay.appendChild(header);
  
  // Tabs
  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:4px;padding:0 24px 12px;flex-shrink:0;overflow-x:auto;';
  const tabDefs = [
    { id: 'photos', label: 'Photos', icon: 'photo_library' },
    { id: 'videos', label: 'Videos', icon: 'video_library' },
    { id: 'docs',   label: 'Documents', icon: 'description' },
    { id: 'urls',   label: 'Links', icon: 'link' }
  ];
  tabDefs.forEach(t => {
    const btn = document.createElement('button');
    btn.className = '_gallery-tab';
    btn.dataset.tab = t.id;
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">${t.icon}</span> ${t.label}`;
    btn.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:20px;border:none;cursor:pointer;font-size:13px;white-space:nowrap;transition:all 0.15s;';
    btn.onclick = () => _renderGalleryTab(t.id);
    tabs.appendChild(btn);
  });
  overlay.appendChild(tabs);
  
  // Content area
  const content = document.createElement('div');
  content.id = '_gallery-content';
  content.style.cssText = 'flex:1;overflow-y:auto;';
  overlay.appendChild(content);
  
  // Backdrop click
  const backdropHandler = e => { if (e.target === overlay) _closeMediaGallery(); };
  overlay.addEventListener('click', backdropHandler);
  
  // ESC key
  const escHandler = e => { if (e.key === 'Escape') _closeMediaGallery(); };
  document.addEventListener('keydown', escHandler);
  
  _galleryCleanup = () => {
    overlay.removeEventListener('click', backdropHandler);
    document.removeEventListener('keydown', escHandler);
  };
  
  document.body.appendChild(overlay);
  _renderGalleryTab(initialTab);
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';
}

/* ══════════════════════════════════════════════════════════════
   24. PATCH sendMessage TO HANDLE EDITS + DRAFTS
   ══════════════════════════════════════════════════════════════ */
// We'll hook into the existing sendMessage after it's defined
document.addEventListener('DOMContentLoaded', function() {
  // Patch: hook msg-input for drafts on every chat switch
  const origOpenChat = window.openChat;
  if (origOpenChat) {
    window.openChat = function(chatId) {
      // Save draft of current chat
      if (App.currentChat) {
        const inp = document.getElementById('msg-input');
        saveDraft(App.currentChat.id, inp ? inp.value : '');
      }
      origOpenChat(chatId);
      // Restore draft of new chat
      const inp = document.getElementById('msg-input');
      if (inp) {
        const draft = restoreDraft(chatId);
        inp.value = draft || '';
        if (typeof onInputChange === 'function') onInputChange();
      }
    };
  }

  // Patch: sendMessage to intercept edits + clear draft
  const origSendMessage = window.sendMessage;
  if (origSendMessage) {
    window.sendMessage = function() {
      // If editing, save edit instead
      if (_editingMsgId) {
        const input = document.getElementById('msg-input');
        const text  = input ? input.value.trim() : '';
        if (text) saveEdit(text);
        else cancelEdit();
        return;
      }
      origSendMessage();
      // Clear draft
      if (App.currentChat) clearDraft(App.currentChat.id);
    };
  }

  // Save draft on input
  const msgInput = document.getElementById('msg-input');
  if (msgInput) {
    msgInput.addEventListener('input', function() {
      if (App.currentChat && !_editingMsgId) {
        saveDraft(App.currentChat.id, msgInput.value);
      }
      if (typeof sendTypingIndicator === 'function') sendTypingIndicator();
    });
  }

/* ══════════════════════════════════════════════════════════════
   GIF SEARCH — curated popular GIFs + Tenor web search
   ══════════════════════════════════════════════════════════════ */

const _curatedGifs = [
  { url: 'https://media.tenor.com/WNCf9x0b3AMAAAAd/thumbs-up-thumbsup.gif', label: '👍' },
  { url: 'https://media.tenor.com/lADl_22UvBEAAAAd/fire.gif', label: '🔥' },
  { url: 'https://media.tenor.com/2roUQw7CU8oAAAAC/love-heart.gif', label: '❤️' },
  { url: 'https://media.tenor.com/hJfU44Uu9LkAAAAC/laughing-wiping-tears.gif', label: '😂' },
  { url: 'https://media.tenor.com/qRnpUw8CxH8AAAAC/clapping-applause.gif', label: '👏' },
  { url: 'https://media.tenor.com/2YgExBf1qNgAAAAC/celebration-celebrate.gif', label: '🎉' },
  { url: 'https://media.tenor.com/gJz4vBG0uqIAAAAC/sad-crying.gif', label: '😢' },
  { url: 'https://media.tenor.com/VIf4DvFfQd4AAAAC/emoji-thumbs-up.gif', label: '👍🏻' },
  { url: 'https://media.tenor.com/HjgT1aOKuYsAAAAC/ok-hand-ok.gif', label: '👌' },
  { url: 'https://media.tenor.com/bQIwP-1pQbgAAAAC/heart-eyes.gif', label: '😍' },
  { url: 'https://media.tenor.com/mE7XiWbm-3QAAAAC/cool-sunglasses.gif', label: '😎' },
  { url: 'https://media.tenor.com/DHbBIqA7bhYAAAAC/dancing-dance.gif', label: '💃' },
  { url: 'https://media.tenor.com/GwZz0Gxp1bYAAAAC/high-five.gif', label: '🤝' },
  { url: 'https://media.tenor.com/0D3CwA46HdYAAAAC/fire-flame.gif', label: '🔥' },
  { url: 'https://media.tenor.com/6JMBTwh26GgAAAAC/thinking-hmm.gif', label: '🤔' },
  { url: 'https://media.tenor.com/5Bn6uLlKbbkAAAAC/surprise-shock.gif', label: '😮' },
  { url: 'https://media.tenor.com/M3V2hBFq2NkAAAAC/angry-mad.gif', label: '😡' },
  { url: 'https://media.tenor.com/BiYVU41Cfp8AAAAC/love-you.gif', label: '🥰' },
  { url: 'https://media.tenor.com/WqFDABzCOX8AAAAC/peace-sign-victory.gif', label: '✌️' },
  { url: 'https://media.tenor.com/6xTz-1SjDpEAAAAC/pray-hands.gif', label: '🙏' },
  { url: 'https://media.tenor.com/pHgqI1rN5e8AAAAC/wave-hello.gif', label: '👋' },
  { url: 'https://media.tenor.com/f0wFpCf6vVYAAAAC/yes-nod.gif', label: '点头' },
  { url: 'https://media.tenor.com/rw6h4JfI3dYAAAAC/no-shake-head.gif', label: '🙅' },
  { url: 'https://media.tenor.com/NdtMiuMPqBcAAAAC/shrug-idk.gif', label: '🤷' },
];

let _gifSearchTimeout = null;
let _gifSearchQuery = '';

function openGifPicker() {
  let picker = document.getElementById('gif-picker');
  if (!picker) {
    picker = document.createElement('div');
    picker.id = 'gif-picker';
    picker.className = 'absolute bottom-20 left-1/2 -translate-x-1/2 w-[min(90vw,400px)] h-[420px] bg-surface-container-low border border-outline-variant/40 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm z-30 flex flex-col overflow-hidden';
    picker.style.display = 'none';

    picker.innerHTML = `
      <div class="flex items-center justify-between p-3 border-b border-outline-variant/20">
        <span class="text-sm font-semibold text-on-surface">GIFs</span>
        <div class="flex items-center gap-1">
          <button onclick="document.getElementById('gif-iframe-src')?.focus();document.getElementById('gif-iframe-src')?.select()" class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-variant/40 text-on-surface-variant" title="Search on Tenor">
            <span class="material-symbols-outlined text-[18px]">open_in_new</span>
          </button>
          <button onclick="document.getElementById('gif-picker').style.display='none'" class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-variant/40 text-on-surface-variant">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>
      <div class="p-2 border-b border-outline-variant/10">
        <div class="relative">
          <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">search</span>
          <input id="gif-iframe-src" type="text" placeholder="Search GIFs..."
            class="w-full bg-surface-variant/50 border border-outline-variant/30 rounded-xl pl-8 pr-8 py-1.5 text-sm focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/60"
            oninput="onGifSearchInput(this.value)"
            onkeydown="if(event.key==='Enter'){event.preventDefault();openTenorSearch(this.value)}">
          <button onclick="openTenorSearch(document.getElementById('gif-iframe-src')?.value || '')" class="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors" title="Search on Tenor">
            <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>
      <div id="gif-results" class="flex-1 overflow-y-auto p-2 grid grid-cols-3 gap-1 auto-rows-min"></div>
    `;
    const chatArea = document.getElementById('chat-area');
    if (chatArea) chatArea.appendChild(picker);
    else document.body.appendChild(picker);

    renderCuratedGifs();
  }

  if (picker.style.display === 'none' || picker.style.display === '') {
    picker.style.display = 'flex';
  } else {
    picker.style.display = 'none';
  }
}

function renderCuratedGifs() {
  const container = document.getElementById('gif-results');
  if (!container) return;
  container.innerHTML = '';
  _curatedGifs.forEach(gif => {
    const img = document.createElement('img');
    img.src = gif.url;
    img.className = 'w-full aspect-square object-cover rounded-lg cursor-pointer hover:ring-2 hover:ring-primary hover:scale-[1.03] transition-all bg-surface-variant/30';
    img.loading = 'lazy';
    img.title = gif.label;
    img.onerror = function() { this.style.display = 'none'; };
    img.onclick = () => sendGifMessage(gif.url);
    container.appendChild(img);
  });
}

function onGifSearchInput(query) {
  _gifSearchQuery = query;
  clearTimeout(_gifSearchTimeout);
  _gifSearchTimeout = setTimeout(() => {
    if (!query || query.length < 2) {
      renderCuratedGifs();
      return;
    }
  }, 300);
}

function openTenorSearch(query) {
  const q = (query || _gifSearchQuery || 'trending').trim();
  if (!q) return;
  window.open(`https://tenor.com/search/${encodeURIComponent(q)}-gifs`, '_blank');
  showToast('Search Tenor for GIFs, then paste the GIF URL in chat', 'info');
}

function sendGifMessage(gifUrl) {
  document.getElementById('gif-picker').style.display = 'none';
  
  if (!App.currentChat || !App.db || !App.auth?.currentUser) return;
  const uid = App.auth.currentUser.uid;
  const chatId = App.currentChat.id;
  const isGroup = App.currentChat.type === 'group';
  
  const messageData = {
    senderId: uid,
    senderName: App.currentUser.displayName || 'Me',
    text: '',
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'sent',
    read: true,
    attachment: { type: 'image', url: gifUrl }
  };
  
  if (isGroup) {
    messageData.groupId = chatId;
  } else {
    messageData.directId = chatId;
    messageData.participants = [uid, App.currentChat.uid];
  }
  
  App.db.collection('messages').add(messageData).catch(console.error);
  
  const coll = isGroup ? 'groups' : 'directChats';
  App.db.collection(coll).doc(chatId).set({
    lastMessage: '📎 GIF',
    lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
    lastMessageSenderId: uid
  }, { merge: true }).catch(() => {});
}

/* ══════════════════════════════════════════════════════════════
   BROADCAST LISTS — Send same message to multiple contacts
   ══════════════════════════════════════════════════════════════ */
function openBroadcastCreator() {
  let modal = document.getElementById('broadcast-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'broadcast-modal';
    modal.className = 'fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/50';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
    document.body.appendChild(modal);
  }
  
  const contacts = App.contacts.filter(c => c.uid !== App.auth?.currentUser?.uid);
  
  modal.innerHTML = `
    <div class="bg-surface-container rounded-t-2xl sm:rounded-2xl w-full sm:w-[min(90vw,420px)] max-h-[80vh] flex flex-col shadow-2xl">
      <div class="flex items-center justify-between p-4 border-b border-outline-variant/20">
        <h3 class="text-lg font-semibold">New Broadcast</h3>
        <button onclick="document.getElementById('broadcast-modal').classList.add('hidden')" class="p-1 rounded-full hover:bg-surface-variant">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="p-3 border-b border-outline-variant/20">
        <input id="broadcast-search" type="text" placeholder="Search contacts..." 
          class="w-full bg-surface-variant/50 border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary"
          oninput="filterBroadcastContacts(this.value)">
      </div>
      <div id="broadcast-contacts" class="flex-1 overflow-y-auto max-h-[40vh]">
        ${contacts.map(c => `
          <label class="flex items-center gap-3 px-4 py-3 hover:bg-surface-variant/50 cursor-pointer border-b border-outline-variant/10">
            <input type="checkbox" value="${c.uid}" class="broadcast-contact-cb w-4 h-4 accent-primary rounded">
            <div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">${escHtml(c.initials)}</div>
            <div>
              <div class="text-sm font-medium">${escHtml(c.name)}</div>
              <div class="text-xs text-on-surface-variant">${c.status === 'online' ? 'Online' : ''}</div>
            </div>
          </label>
        `).join('')}
      </div>
      <div class="p-4 border-t border-outline-variant/20">
        <div id="broadcast-count" class="text-xs text-on-surface-variant mb-2">0 contacts selected</div>
        <div class="flex gap-2">
          <input id="broadcast-msg-input" type="text" placeholder="Type broadcast message..." 
            class="flex-1 bg-surface-variant/50 border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary">
          <button onclick="sendBroadcast()" class="px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-medium hover:brightness-110">Send</button>
        </div>
      </div>
    </div>
  `;
  
  modal.classList.remove('hidden');
  
  modal.querySelectorAll('.broadcast-contact-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const count = modal.querySelectorAll('.broadcast-contact-cb:checked').length;
      document.getElementById('broadcast-count').textContent = `${count} contact${count !== 1 ? 's' : ''} selected`;
    });
  });
}

function filterBroadcastContacts(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('#broadcast-contacts label').forEach(label => {
    const name = label.querySelector('.text-sm')?.textContent?.toLowerCase() || '';
    label.style.display = name.includes(q) ? '' : 'none';
  });
}

async function sendBroadcast() {
  const modal = document.getElementById('broadcast-modal');
  if (!modal) return;
  
  const selectedUIDs = [...modal.querySelectorAll('.broadcast-contact-cb:checked')].map(cb => cb.value);
  const text = document.getElementById('broadcast-msg-input')?.value.trim();
  
  if (!selectedUIDs.length) { showToast('Select at least one contact', 'error'); return; }
  if (!text) { showToast('Type a message', 'error'); return; }
  if (!App.db || !App.auth?.currentUser) return;
  
  const uid = App.auth.currentUser.uid;
  
  showToast(`Broadcasting to ${selectedUIDs.length} contacts...`, 'info');
  
  for (const otherUid of selectedUIDs) {
    const chatId = [uid, otherUid].sort().join('_');
    
    const messageData = {
      senderId: uid,
      senderName: App.currentUser.displayName || 'Me',
      senderEmail: App.currentUser.email || '',
      text: text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'sent',
      read: false,
      directId: chatId,
      participants: [uid, otherUid],
      isBroadcast: true
    };
    
    App.db.collection('messages').add(messageData).catch(console.error);
    App.db.collection('directChats').doc(chatId).set({
      participants: [uid, otherUid],
      lastMessage: text,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessageSenderId: uid,
      status: 'active'
    }, { merge: true }).catch(console.error);
  }
  
  modal.classList.add('hidden');
  showToast(`Message broadcast to ${selectedUIDs.length} contacts`, 'success');
}

/* ══════════════════════════════════════════════════════════════
    POLL CREATION & VOTING
    ══════════════════════════════════════════════════════════════ */
let _pollCreatorState = { question: '', options: ['', ''], allowMultiple: false };

function openPollCreator() {
  if (!App.currentChat || App.currentChat.type !== 'group') {
    showToast('Polls are only available in group chats', 'info');
    return;
  }
  _pollCreatorState = { question: '', options: ['', ''], allowMultiple: false };

  let modal = document.getElementById('poll-creator-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'poll-creator-modal';
    modal.className = 'fixed inset-0 z-[9998] flex items-center justify-center bg-black/50';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
    document.body.appendChild(modal);
  }

  renderPollCreator();
  modal.classList.remove('hidden');
}

function renderPollCreator() {
  const modal = document.getElementById('poll-creator-modal');
  if (!modal) return;
  const s = _pollCreatorState;

  modal.innerHTML = `
    <div class="bg-surface-container rounded-2xl w-[min(90vw,420px)] max-h-[80vh] overflow-y-auto shadow-2xl">
      <div class="flex items-center justify-between p-4 border-b border-outline-variant/20">
        <h3 class="text-lg font-semibold">Create Poll</h3>
        <button onclick="document.getElementById('poll-creator-modal').classList.add('hidden')" class="p-1 rounded-full hover:bg-surface-variant">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="p-4 space-y-4">
        <input id="poll-question" type="text" placeholder="Ask a question..."
          class="w-full bg-surface-variant/50 border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
          value="${escHtml(s.question)}" oninput="_pollCreatorState.question=this.value" maxlength="200">

        <div id="poll-options-list" class="space-y-2">
          ${s.options.map((opt, i) => `
            <div class="flex items-center gap-2">
              <span class="text-on-surface-variant/60 text-sm w-5">${i + 1}.</span>
              <input type="text" placeholder="Option ${i + 1}"
                class="flex-1 bg-surface-variant/50 border border-outline-variant/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value="${escHtml(opt)}" oninput="_pollCreatorState.options[${i}]=this.value" maxlength="100">
              ${s.options.length > 2 ? `<button onclick="_pollCreatorState.options.splice(${i},1);renderPollCreator()" class="p-1 rounded-full hover:bg-surface-variant"><span class="material-symbols-outlined text-sm">close</span></button>` : ''}
            </div>
          `).join('')}
        </div>

        ${s.options.length < 6 ? `
          <button onclick="_pollCreatorState.options.push('');renderPollCreator()" class="flex items-center gap-2 text-primary text-sm font-medium">
            <span class="material-symbols-outlined text-lg">add</span> Add option
          </button>
        ` : ''}

        <label class="flex items-center gap-3 py-2 cursor-pointer">
          <input type="checkbox" ${s.allowMultiple ? 'checked' : ''} onchange="_pollCreatorState.allowMultiple=this.checked" class="w-4 h-4 accent-primary">
          <span class="text-sm">Allow multiple selections</span>
        </label>
      </div>
      <div class="flex justify-end gap-2 p-4 border-t border-outline-variant/20">
        <button onclick="document.getElementById('poll-creator-modal').classList.add('hidden')" class="px-4 py-2 text-sm rounded-xl hover:bg-surface-variant">Cancel</button>
        <button onclick="submitPoll()" class="px-4 py-2 text-sm font-medium bg-primary text-on-primary rounded-xl hover:brightness-110">Create Poll</button>
      </div>
    </div>
  `;
}

function submitPoll() {
  const s = _pollCreatorState;
  if (!s.question.trim()) { showToast('Please enter a question', 'error'); return; }
  const validOptions = s.options.filter(o => o.trim());
  if (validOptions.length < 2) { showToast('Add at least 2 options', 'error'); return; }
  if (!App.db || !App.auth?.currentUser || !App.currentChat) return;

  const uid = App.auth.currentUser.uid;
  const chatId = App.currentChat.id;

  const pollData = {
    senderId: uid,
    senderName: App.currentUser.displayName || 'Me',
    text: '',
    groupId: chatId,
    type: 'poll',
    poll: {
      question: s.question.trim(),
      options: validOptions.map(text => ({ text: text.trim(), voters: [] })),
      allowMultiple: s.allowMultiple,
      createdBy: uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    },
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'sent',
    read: true
  };

  App.db.collection('messages').add(pollData).catch(console.error);
  App.db.collection('groups').doc(chatId).update({
    lastMessage: '\ud83d\udcca Poll: ' + s.question.trim(),
    lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
    lastMessageSenderId: uid,
    lastMessageSenderName: App.currentUser.displayName || 'Me'
  }).catch(console.error);

  document.getElementById('poll-creator-modal')?.classList.add('hidden');
  showToast('Poll created', 'success');
}

function votePoll(msgId, optionIndex) {
  if (!App.db || !App.auth?.currentUser) return;
  const uid = App.auth.currentUser.uid;
  const chatId = App.currentChat?.id;
  if (!chatId) return;

  const msgs = App.messages[chatId] || [];
  const msg = msgs.find(m => m.id === msgId);
  if (!msg || !msg.poll) return;

  const poll = msg.poll;
  const alreadyVotedAt = poll.options.findIndex(o => o.voters?.includes(uid));

  if (!poll.allowMultiple && alreadyVotedAt >= 0 && alreadyVotedAt !== optionIndex) {
    poll.options[alreadyVotedAt].voters = (poll.options[alreadyVotedAt].voters || []).filter(v => v !== uid);
  }

  const opt = poll.options[optionIndex];
  if (!opt.voters) opt.voters = [];
  const voterIdx = opt.voters.indexOf(uid);
  if (voterIdx >= 0) {
    opt.voters.splice(voterIdx, 1);
  } else {
    opt.voters.push(uid);
  }

  renderMessages(chatId);

  if (!msgId.startsWith('msg_')) {
    App.db.collection('messages').doc(msgId).update({
      'poll.options': poll.options
    }).catch(() => {});
  }
}

  // Apply CSS animation for context menu
  if (!document.getElementById('_extras-style')) {
    const style = document.createElement('style');
    style.id = '_extras-style';
    style.textContent = `
      @keyframes ctxFadeIn {
        from { opacity:0; transform:scale(0.92) translateY(-4px); }
        to   { opacity:1; transform:scale(1) translateY(0); }
      }
      @keyframes slideUp {
        from { transform:translateY(60px); opacity:0; }
        to   { transform:translateY(0); opacity:1; }
      }
      .msg-search-highlight {
        background: var(--primary-container);
        border-radius: 3px;
        padding: 0 2px;
      }
    `;
    document.head.appendChild(style);
  }
});
