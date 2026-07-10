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
    content.innerHTML = `<div class="relative flex items-center justify-center w-full h-full" id="media-zoom-container">
      <img src="${escHtml(item.url)}" alt="Media" id="media-zoom-img"
           class="max-w-full max-h-full rounded-xl object-contain transition-transform duration-200 cursor-zoom-in"
           style="max-height:85vh"
           ondragstart="return false"
           onclick="toggleMediaZoom()">
    </div>`;
  }

  App._mediaViewerCurrentUrl = item.url;
  App._mediaViewerCurrentType = item.type;
  App._mediaViewerZoomed = false;
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

  const scrub = document.querySelector(`.voice-scrub[data-msg-id="${msgId}"]`);
  const timeLabel = document.querySelector(`.voice-time[data-msg-id="${msgId}"]`);
  const maxDur = scrub ? parseInt(scrub.max) || 0 : 0;

  audio.addEventListener('timeupdate', () => {
    if (scrub && !scrub._dragging) scrub.value = audio.currentTime;
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
    if (scrub) scrub.value = 0;
    if (timeLabel && maxDur) timeLabel.textContent = _fmtDur(maxDur);
    _currentAudio = null;
    App._currentVoiceMsgId = null;
  });
  audio.addEventListener('error', () => {
    showToast('Could not play voice message', 'error');
    _updatePlayBtn(msgId, false);
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
}

/* ══════════════════════════════════════════════════════════════
   3. MESSAGE RIGHT-CLICK CONTEXT MENU
   ══════════════════════════════════════════════════════════════ */
let _ctxMenu = null;

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
    background:var(--surface-container-high);
    border:1px solid var(--outline-variant);
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
  const actions = [
    { icon: '↩️', label: 'Reply',   fn: `replyToMsg('${msgId}')` },
    { icon: '✏️', label: 'Edit',    fn: `editMessage('${msgId}')`,  show: isMyMsg },
    { icon: '↪️', label: 'Forward', fn: `openForwardModal('${msgId}')` },
    { icon: '📋', label: 'Copy',    fn: `copyMsgText('${msgId}')` },
    { icon: '📌', label: isPinned ? 'Unpin message' : 'Pin message', fn: isPinned ? `unpinMessageByMsgId('${msgId}')` : `pinMessage('${msgId}')` },
    { icon: '⭐', label: 'Star',    fn: `starMessage('${msgId}')` },
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
      color:${danger ? 'var(--error)' : 'var(--on-surface)'};
      transition:background 0.15s;
    `;
    btn.innerHTML = `<span style="font-size:16px">${icon}</span> ${label}`;
    btn.onmouseenter = () => btn.style.background = danger ? 'rgba(186,26,26,0.1)' : 'var(--surface-container-highest)';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = () => { _removeCtxMenu(); eval(fn); };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);

  // Intelligently fit menu inside viewport to prevent offscreen cut-offs
  const rect = menu.getBoundingClientRect();
  const x = Math.min(event.clientX, window.innerWidth - rect.width - 20);
  const y = Math.min(event.clientY, window.innerHeight - rect.height - 20);
  menu.style.left = Math.max(10, x) + 'px';
  menu.style.top  = Math.max(10, y) + 'px';

  _ctxMenu = menu;

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', _removeCtxMenu, { once: true });
    document.addEventListener('contextmenu', _removeCtxMenu, { once: true });
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
    background:var(--surface-container-high);
    border:1px solid var(--outline-variant);
    border-radius:16px; padding:6px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    min-width:160px; font-size:13px; font-weight:600;
  `;

  const actions = [
    { icon: '📌', label: chat.pinned ? 'Unpin Chat' : 'Pin Chat', fn: `togglePin('${chatId}')` },
    { icon: '🔔', label: chat.muted ? 'Unmute Chat' : 'Mute Chat', fn: `toggleChatMute('${chatId}')` },
    { icon: '📂', label: 'Archive Chat', fn: `archiveChat('${chatId}')` },
    { icon: '📦', label: 'Export Chat', fn: `exportChatAsZip('${chatId}')` },
    { icon: '🗑️', label: 'Delete Chat', fn: `confirmDeleteChat('${chatId}')`, danger: true },
  ];

  actions.forEach(({ icon, label, fn, danger }) => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:${danger ? 'var(--error)' : 'var(--on-surface)'};
      transition:background 0.15s;
    `;
    btn.innerHTML = `<span style="font-size:16px">${icon}</span> ${label}`;
    btn.onmouseenter = () => btn.style.background = danger ? 'rgba(186,26,26,0.1)' : 'var(--surface-container-highest)';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = () => { _removeCtxMenu(); eval(fn); };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  
  // Measure rect boundaries to prevent offscreen/cut-off menu display
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

/* ─── Call Log Context Menu ─── */
function callLogContextMenu(event, logId) {
  event.preventDefault();
  event.stopPropagation();
  _removeCtxMenu();

  const menu = document.createElement('div');
  menu.id = '_msg-ctx-menu';
  menu.style.cssText = `
    position:fixed; z-index:9999;
    background:var(--surface-container-high);
    border:1px solid var(--outline-variant);
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
      color:${danger ? 'var(--error)' : 'var(--on-surface)'};
      transition:background 0.15s;
    `;
    btn.innerHTML = `<span style="font-size:16px">${icon}</span> ${label}`;
    btn.onmouseenter = () => btn.style.background = danger ? 'rgba(186,26,26,0.1)' : 'var(--surface-container-highest)';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = () => { _removeCtxMenu(); eval(fn); };
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
    background:var(--surface-container-high);
    border:1px solid var(--outline-variant);
    border-radius:16px; padding:6px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    min-width:190px; font-size:13px; font-weight:600;
  `;

  const actions = [
    { icon: '🔍', label: 'Search in chat',     fn: `openChatSearch()` },
    { icon: '📌', label: chat.pinned ? 'Unpin' : 'Pin',   fn: `togglePin('${chat.id}')` },
    { icon: '🔔', label: chat.muted ? 'Unmute' : 'Mute',  fn: `toggleChatMute('${chat.id}')` },
    { icon: '📦', label: 'Export Chat',          fn: `exportChatAsZip('${chat.id}')` },
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
      color:${danger ? 'var(--error)' : 'var(--on-surface)'};
      transition:background 0.15s;
    `;
    item.innerHTML = `<span style="font-size:16px">${icon}</span> ${label}`;
    item.onmouseenter = () => item.style.background = danger ? 'rgba(186,26,26,0.1)' : 'var(--surface-container-highest)';
    item.onmouseleave = () => item.style.background = 'transparent';
    item.onclick = () => { _removeCtxMenu(); eval(fn); };
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
      } catch (err) {
        console.warn('Delete for everyone failed, trying fallback:', err);
        try {
          await App.db.collection('messages').doc(msgId).delete();
          try { const key='nsl_deleted_msgs'; const o=JSON.parse(localStorage.getItem(key)||'{}'); o[chatId]=o[chatId]||[]; if(!o[chatId].includes(msgId)) o[chatId].push(msgId); localStorage.setItem(key,JSON.stringify(o)); } catch(_) {}
          showToast('Message deleted for everyone', 'success');
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
    overlay.classList.add('hidden');
    // Remove event listeners
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
  
  overlay.classList.remove('hidden');
}

function _createForwardOverlay() {
  // Remove any existing overlay first
  const existing = document.getElementById('_forward-overlay');
  if (existing) existing.remove();
  if (_forwardOverlayCleanup) { _forwardOverlayCleanup(); _forwardOverlayCleanup = null; }
  
  const overlay = document.createElement('div');
  overlay.id = '_forward-overlay';
  overlay.className = 'hidden';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:9998; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center;';
  
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
  
  const list = document.createElement('div');
  list.id = '_forward-chat-list';
  list.style.cssText = 'overflow-y:auto; padding:8px; flex:1;';
  
  modal.appendChild(header);
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
  if (!_forwardMsgId) return;

  const srcChatId = App.currentChat && App.currentChat.id;
  const msgs = (srcChatId && App.messages[srcChatId]) || [];
  const msg   = msgs.find(m => m.id === _forwardMsgId);
  if (!msg) { showToast('Message not found', 'error'); return; }

  const targetChat = App.chats.find(c => c.id === targetChatId);
  if (!targetChat) return;

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

/* ══════════════════════════════════════════════════════════════
   8. EDIT MESSAGE
   ══════════════════════════════════════════════════════════════ */
let _editingMsgId = null;

function editMessage(msgId) {
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const msg = msgs.find(m => m.id === msgId);
  if (!msg || msg.type !== 'text' && !msg.text) {
    showToast('Only text messages can be edited', 'info');
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
    const col = 'messages';
    App.db.collection(col).doc(msgId).update({
      text: newText,
      edited: true,
      editedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {
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
  const rect = el.getBoundingClientRect();
  const x = Math.min(rect.left, window.innerWidth - 340);
  const y = rect.top - 60;
  picker.style.left = Math.max(8, x) + 'px';
  picker.style.top  = Math.max(8, y) + 'px';

  document.body.appendChild(picker);
  _ctxMenu = picker;
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
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      showToast('Copied', 'success');
    });
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
        <span style="font-size:13px;font-weight:700;color:var(--primary)">${msg.status || 'sent'}</span>
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
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    for (const file of files) {
      if (file.size > 16 * 1024 * 1024) { showToast(file.name + ': too large (max 16MB)', 'error'); continue; }
      if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) {
        const compressed = await _compressImage(file, 0.8, 2048);
        await _sendFileMessage(compressed || file);
      } else {
        await _sendFileMessage(file);
      }
    }
  };
  input.click();
}

function attachDocument() {
  toggleAttachMenu();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '*/*';
  input.multiple = true;
  input.onchange = async () => {
    for (const file of Array.from(input.files || [])) {
      if (file.size > 50 * 1024 * 1024) { showToast(file.name + ': too large (max 50MB)', 'error'); continue; }
      await _sendFileMessage(file);
    }
  };
  input.click();
}

function attachCamera() {
  toggleAttachMenu();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.capture = 'environment';
  input.multiple = false;
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { showToast('File too large (max 16MB)', 'error'); return; }
    if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) {
      showToast('Compressing image…', 'info');
      const compressed = await _compressImage(file, 0.8, 2048);
      if (compressed) { _showMediaPreview(compressed, 'image'); return; }
    }
    _showMediaPreview(file, file.type.startsWith('video/') ? 'video' : 'image');
  };
  input.click();
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
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('media-preview-send')?.addEventListener('click', () => {
    overlay.remove();
    _sendFileMessage(file);
  });
}

async function _compressImage(file, quality, maxDim) {
  return new Promise(resolve => {
    try {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio); h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          else resolve(file);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    } catch(_) { resolve(file); }
  });
}

async function _sendFileMessage(file) {
  if (!App.currentChat) return;
  const chatId = App.currentChat.id;
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  // Create local blob URL for preview
  const blobUrl = URL.createObjectURL(file);
  const type = isImage ? 'image' : isVideo ? 'video' : 'doc';
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
  };

  if (!App.messages[chatId]) App.messages[chatId] = [];
  App.messages[chatId].push(msg);
  App.currentChat.lastMsg  = type === 'image' ? '📸 Photo' : type === 'video' ? '🎥 Video' : '📎 ' + file.name;
  App.currentChat.lastTime = msg.time;
  renderMessages(chatId);
  scrollToBottom(true);
  renderChatList();
  showToast('Uploading…', 'info');

  // Upload to Cloudinary if available, otherwise Firebase Storage
  try {
    let uploadUrl = blobUrl;
    if (typeof CLOUDINARY_CLOUD_NAME !== 'undefined' && CLOUDINARY_UPLOAD_PRESET) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        uploadUrl = data.secure_url || blobUrl;
      }
    } else if (App.db && window.firebase && firebase.storage) {
      const storageRef = firebase.storage().ref(`chat_uploads/${Date.now()}_${file.name}`);
      const snap = await storageRef.put(file);
      uploadUrl = await snap.ref.getDownloadURL();
    }

    msg.url    = uploadUrl;
    msg.status = 'sent';
    renderMessages(chatId);
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
    _audioContext = new (window.AudioContext || window.webkitAudioContext)();
    _analyser = _audioContext.createAnalyser();
    _analyser.fftSize = 64;
    const source = _audioContext.createMediaStreamSource(stream);
    source.connect(_analyser);
    _animateRealWaveform();

    _mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
    _mediaRecorder.ondataavailable = e => { if (e.data.size) _audioChunks.push(e.data); };
    _mediaRecorder.start(100);
  }).catch(() => {
    showToast('Microphone permission denied', 'error');
    cancelRecording();
  });
}

function togglePauseRecording() {
  if (!_mediaRecorder || _mediaRecorder.state === 'inactive') return;
  if (_recPaused) {
    _mediaRecorder.resume();
    _recPaused = false;
    const dot = document.getElementById('rec-dot');
    if (dot) { dot.style.animationPlayState = 'running'; dot.classList.remove('bg-warning'); dot.classList.add('bg-error'); }
    const icon = document.getElementById('rec-pause-icon');
    if (icon) icon.textContent = 'pause';
  } else {
    _mediaRecorder.pause();
    _recPaused = true;
    const dot = document.getElementById('rec-dot');
    if (dot) { dot.style.animationPlayState = 'paused'; dot.classList.remove('bg-error'); dot.classList.add('bg-warning'); }
    const icon = document.getElementById('rec-pause-icon');
    if (icon) icon.textContent = 'play_arrow';
  }
}

function getSupportedMimeType() {
  const types = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'];
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
  const blobUrl = URL.createObjectURL(blob);
  const duration = _fmtDur(_recSec);
  const chatId = App.currentChat.id;

  const msg = {
    id: 'msg_' + Date.now(),
    from: 'me',
    type: 'voice',
    url: blobUrl,
    duration,
    durationSec: _recSec,
    time: Date.now(),
    status: 'sending',
  };

  if (!App.messages[chatId]) App.messages[chatId] = [];
  App.messages[chatId].push(msg);
  App.currentChat.lastMsg  = '🎙️ Voice (' + duration + ')';
  App.currentChat.lastTime = msg.time;
  renderMessages(chatId);
  scrollToBottom(true);
  renderChatList();
  showToast('Voice message sent', 'success');

  _sendFileMessage(new File([blob], 'voice_' + Date.now() + '.webm', { type: blob.type })).then(() => {}).catch(() => {});
}

function _animateRealWaveform() {
  const wf = document.getElementById('recording-waveform');
  if (!wf || !_analyser) return;
  const data = new Uint8Array(_analyser.frequencyBinCount);
  function draw() {
    if (!App.isRecording) return;
    _analyser.getByteFrequencyData(data);
    const bars = Math.min(data.length, 30);
    let html = '';
    for (let i = 0; i < bars; i++) {
      const h = Math.max(8, (data[i] / 255) * 100);
      html += `<div style="width:3px;height:${h}%;background:${_recPaused ? 'var(--warning)' : 'var(--primary)'};border-radius:2px;transition:height 0.08s"></div>`;
    }
    wf.innerHTML = html;
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
      if (typeof CLOUDINARY_CLOUD_NAME !== 'undefined') {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
        if (res.ok) { const d = await res.json(); uploadUrl = d.secure_url || blobUrl; }
      } else if (App.db && window.firebase && firebase.storage) {
        const uid = App.auth.currentUser.uid;
        const ref = firebase.storage().ref(`avatars/${uid}`);
        await ref.put(file);
        uploadUrl = await ref.getDownloadURL();
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

      // Send invites to members
      for (const memberId of _newGroupMembers.map(m => m.uid)) {
        await App.db.collection('groupMembers').add({
          groupId: ref.id, userId: memberId,
          role: 'member',
          joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {});
      }
      // Add creator as admin
      await App.db.collection('groupMembers').add({
        groupId: ref.id, userId: uid,
        role: 'admin',
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    } catch (e) {
      console.error('Group create error:', e);
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   20. MUTE CHAT (proper per-chat)
   ══════════════════════════════════════════════════════════════ */
function toggleChatMute(chatId) {
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) return;
  chat.muted = !chat.muted;
  renderChatList();
  showToast(chat.muted ? '🔕 Chat muted' : '🔔 Chat unmuted', 'success');

  if (App.db && App.auth && App.auth.currentUser) {
    const uid = App.auth.currentUser.uid;
    const col = chat.type === 'group' ? 'groups' : 'directChats';
    App.db.collection(col).doc(chatId).update({
      [`muted.${uid}`]: chat.muted
    }).catch(() => {});
  }
}

/* ══════════════════════════════════════════════════════════════
   21. ARCHIVE CHAT
   ══════════════════════════════════════════════════════════════ */
function archiveChat(chatId) {
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) return;
  showConfirm(`Archive "${chat.name}"? You can find it in archived chats.`, () => {
    App.chats = App.chats.filter(c => c.id !== chatId);
    if (App.currentChat && App.currentChat.id === chatId) showWelcome();
    renderChatList();
    showToast(`"${chat.name}" archived`, 'success');
  });
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
    btn.style.background = isActive ? 'rgba(255,255,255,0.15)' : 'transparent';
    btn.style.color = isActive ? 'white' : 'rgba(255,255,255,0.6)';
    btn.style.fontWeight = isActive ? '700' : '500';
  });
  
  if (!filtered.length) {
    container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.4);gap:12px;"><span class="material-symbols-outlined" style="font-size:48px;">perm_media</span><p style="font-size:14px;">No ' + tab + ' shared yet</p></div>';
    return;
  }
  
  if (tab === 'urls') {
    // List view for URLs
    container.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;padding:16px;">' +
      filtered.map(m => {
        const urlMatch = m.text.match(/(https?:\/\/[^\s]+)/g);
        const url = urlMatch ? urlMatch[0] : m.text;
        return `<div onclick="openMediaViewer('${m.id}','text')" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,0.05);border-radius:12px;cursor:pointer;transition:background 0.15s;" onmouseenter="this.style.background='rgba(255,255,255,0.1)'" onmouseleave="this.style.background='rgba(255,255,255,0.05)'">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-symbols-outlined" style="color:rgba(255,255,255,0.7);">link</span></div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(new URL(url).hostname || url)}</div>
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

function openMediaGallery(initialTab) {
  initialTab = initialTab || 'photos';
  let overlay = document.getElementById('_media-gallery');
  
  // Remove existing overlay to rebuild
  if (overlay) {
    overlay.remove();
    if (_galleryCleanup) { _galleryCleanup(); _galleryCleanup = null; }
  }
  
  overlay = document.createElement('div');
  overlay.id = '_media-gallery';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9997;background:rgba(0,0,0,0.9);backdrop-filter:blur(12px);display:flex;flex-direction:column;';
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:20px 24px;color:white;flex-shrink:0;';
  header.innerHTML = '<h3 style="font-size:18px;font-weight:700;">Media & Files</h3>';
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
  closeBtn.style.cssText = 'background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:36px;height:36px;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;';
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
    });
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
