// ========================================
// COMPLETE CHAT APP - FINAL VERSION
// All WhatsApp features + extras
// Works on all devices, all browsers
// ========================================

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCdbut_FdscAjl-OVSlAUhb7TOTiRNkh34",
  authDomain: "my-team-chat-2255.firebaseapp.com",
  projectId: "my-team-chat-2255",
  storageBucket: "my-team-chat-2255.firebasestorage.app",
  messagingSenderId: "805016891521",
  appId: "1:805016891521:web:ac9bc7a252bcf33686dd80"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = 'du2dsimyz';
const CLOUDINARY_UPLOAD_PRESET = 'chat_app_uploads';
const TURN_CREDENTIALS_ENDPOINT = 'https://us-central1-my-team-chat-2255.cloudfunctions.net/getTurnCredentials';

// Global Variables
let currentUser = null;
let currentChat = null;
let currentChatType = null;
let allUsers = [];
let messagesUnsubscribe = null;
let typingUnsubscribe = null;
let directChatsUnsubscribe = null;
let groupChatsUnsubscribe = null;
let chatRequestsUnsubscribe = null;
let groupInvitesUnsubscribe = null;
let currentGroup = null;
let currentGroupMembers = [];
let currentReplyTo = null;
let currentAttachment = null;
let typingTimeout = null;
let blockedUsers = [];
let mutedChats = [];
let quickReplies = [];
let pinnedMessages = [];
let currentSearchResults = [];
let currentSearchIndex = 0;
let favoriteChatIds = [];
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let recordingTimer = null;
let wallpaperModalMode = 'global';
let chatListRefreshTimer = null;
let statusImageAttachment = null;
let activeCall = null;
let peerConnection = null;
let localCallStream = null;
let remoteCallStream = null;
let incomingCallsUnsubscribe = null;
let callDocUnsubscribe = null;
let callCandidatesUnsubscribe = null;
let currentCallType = 'voice';
let micMuted = false;
let cameraOff = false;
let pendingRemoteIceCandidates = [];
let activeCallMode = null;
let callTimeoutTimer = null;
let callStartedAt = null;
let callDurationTimer = null;
let ringtoneAudioContext = null;
let ringtoneTimer = null;
let vibrationTimer = null;
let wakeLock = null;
let cameraSender = null;
let callLogWritten = false;
let lastHandledRenegotiationSdp = '';

const defaultRtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

async function getBackendTurnServers() {
  if (!currentUser) return [];

  const token = await currentUser.getIdToken();
  const response = await fetch(TURN_CREDENTIALS_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`TURN backend returned ${response.status}`);
  }

  const iceServers = await response.json();
  if (!Array.isArray(iceServers) || !iceServers.length) {
    throw new Error('TURN backend returned no servers');
  }

  return iceServers;
}

async function getRtcConfig() {
  try {
    const backendTurnServers = await getBackendTurnServers();
    if (backendTurnServers.length) return { iceServers: backendTurnServers };
  } catch (error) {
    console.warn('Could not load secure TURN config:', error);
  }

  try {
    const configuredServers = JSON.parse(localStorage.getItem('teamChatTurnServers') || '[]');
    if (Array.isArray(configuredServers) && configuredServers.length) {
      return { iceServers: [...defaultRtcConfig.iceServers, ...configuredServers] };
    }
  } catch (error) {
    console.warn('Invalid TURN server config:', error);
  }
  return defaultRtcConfig;
}

function updateTurnServerSettings() {
  window.location.href = 'turn.html';
}

// Privacy Settings
let privacySettings = {
  hideReadReceipts: false,
  hideTypingIndicator: false,
  hideLastSeen: false
};

// Wallpaper Settings (per chat)
let chatWallpapers = {};

// ========================================
// HELPER FUNCTIONS
// ========================================

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getFileNameFromUrl(url) {
  if (!url) return '';
  try {
    const path = new URL(url).pathname;
    const lastPart = decodeURIComponent(path.split('/').pop() || '');
    return lastPart || '';
  } catch (error) {
    const cleanUrl = String(url).split('?')[0];
    return decodeURIComponent(cleanUrl.split('/').pop() || '');
  }
}

function getFileExtension(filename = '', url = '') {
  const source = filename || getFileNameFromUrl(url);
  const match = source.match(/\.([a-z0-9]{1,8})$/i);
  return match ? match[1].toUpperCase() : 'FILE';
}

function getAttachmentLabel(attachment = {}) {
  if (attachment.type === 'image') return 'Image';
  if (attachment.type === 'voice') return 'Voice message';
  const ext = getFileExtension(attachment.filename, attachment.url);
  if (ext === 'PDF') return 'PDF document';
  if (['DOC', 'DOCX'].includes(ext)) return 'Word document';
  if (['XLS', 'XLSX', 'CSV'].includes(ext)) return `${ext} spreadsheet`;
  if (['PPT', 'PPTX'].includes(ext)) return 'Presentation';
  if (['ZIP', 'RAR', '7Z'].includes(ext)) return 'Archive';
  return `${ext} file`;
}

function renderAttachment(attachment = {}) {
  if (!attachment.url) return '';
  const url = escapeHtml(attachment.url);
  const filename = escapeHtml(attachment.filename || getFileNameFromUrl(attachment.url) || 'Attachment');

  if (attachment.type === 'image') {
    return `<div class="message-attachment"><a class="image-attachment-link" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${filename}"></a></div>`;
  }

  if (attachment.type === 'voice') {
    const duration = Number(attachment.duration) || 0;
    return `<div class="voice-message"><button class="voice-play-btn" data-url="${url}" type="button">Play</button><div class="voice-waveform"></div><span class="voice-duration">${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}</span></div>`;
  }

  const ext = getFileExtension(attachment.filename, attachment.url);
  const detail = [getAttachmentLabel(attachment), formatBytes(attachment.size)].filter(Boolean).join(' · ');
  return `
    <a class="file-attachment-card" href="${url}" target="_blank" rel="noopener">
      <span class="file-attachment-icon">${escapeHtml(ext)}</span>
      <span class="file-attachment-info">
        <span class="file-attachment-name">${filename}</span>
        <span class="file-attachment-meta">${escapeHtml(detail || 'File')}</span>
      </span>
      <span class="file-attachment-action">Download</span>
    </a>
  `;
}

function getCallIcon(type = 'voice', status = 'ended') {
  if (status === 'missed' || status === 'failed') return '↯';
  if (status === 'rejected') return '✕';
  return type === 'video' ? '🎥' : '📞';
}

function renderCallMessage(msg = {}) {
  const text = escapeHtml(msg.text || getCallHistoryText(msg.callStatus || 'ended', msg.callType || 'voice', msg.callDurationMs || 0));
  const icon = getCallIcon(msg.callType, msg.callStatus);
  return `<div class="message-bubble"><span>${icon}</span><span>${text}</span></div>`;
}

function getSavedMessagesChatId() {
  return currentUser ? `saved_${currentUser.uid}` : '';
}

function getSavedMessagesItem() {
  const displayName = currentUser?.displayName || currentUser?.email || 'Me';
  return {
    id: getSavedMessagesChatId(),
    type: 'saved',
    name: 'Saved Messages',
    avatar: '&#9733;',
    preview: `Private notes and files for ${displayName}`,
    unreadCount: 0,
    isFavorite: false,
    isMuted: false,
    lastMessageTime: new Date(8640000000000000)
  };
}

function renderMessageText(text = '', mentions = []) {
  let html = escapeHtml(text);
  mentions.forEach(mention => {
    const label = escapeHtml(mention.label || mention.name || '');
    if (!label) return;
    const escapedPattern = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`@${escapedPattern}`, 'g'), `<span class="mention-highlight">@${label}</span>`);
  });
  return html;
}

function getMessageMentions(text = '') {
  if (currentChatType !== 'group' || !text.includes('@')) return [];
  const lowerText = text.toLowerCase();
  return currentGroupMembers
    .filter(member => member.id !== currentUser.uid && member.name && lowerText.includes(`@${member.name.toLowerCase()}`))
    .map(member => ({ id: member.id, name: member.name, label: member.name }));
}

function renderPollMessage(messageId, msg = {}) {
  const poll = msg.poll || {};
  const options = Array.isArray(poll.options) ? poll.options : [];
  const votes = poll.votes || {};
  const voteValues = Object.values(votes);
  const totalVotes = voteValues.length;
  const myVote = votes[currentUser?.uid];
  const optionsHtml = options.map((option, index) => {
    const count = voteValues.filter(value => Number(value) === index).length;
    const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
    const selected = Number(myVote) === index ? ' selected' : '';
    return `
      <button class="poll-option${selected}" data-message-id="${escapeHtml(messageId)}" data-option-index="${index}" type="button">
        <span class="poll-option-top"><span>${escapeHtml(option)}</span><span>${percent}%</span></span>
        <span class="poll-option-bar"><span class="poll-option-fill" style="width:${percent}%"></span></span>
      </button>
    `;
  }).join('');
  return `
    <div class="poll-card">
      <div class="poll-question">${escapeHtml(poll.question || 'Poll')}</div>
      ${optionsHtml}
      <div class="poll-meta">${totalVotes} vote${totalVotes === 1 ? '' : 's'}</div>
    </div>
  `;
}

async function votePoll(messageId, optionIndex) {
  if (!currentUser || !messageId || Number.isNaN(optionIndex)) return;
  const updates = {};
  updates[`poll.votes.${currentUser.uid}`] = Number(optionIndex);
  await db.collection('messages').doc(messageId).update(updates);
}

function bindRenderedMessageActions() {
  document.querySelectorAll('.voice-play-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const audio = new Audio(btn.dataset.url);
      audio.play();
    });
  });
  document.querySelectorAll('.poll-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      await votePoll(btn.dataset.messageId, Number(btn.dataset.optionIndex));
    });
  });
}

function openMobileChatPanel() {
  document.querySelector('.chat-container')?.classList.add('chat-open');
}

function closeMobileChatPanel() {
  document.querySelector('.chat-container')?.classList.remove('chat-open');
}

function resetChatPanel() {
  currentChat = null;
  currentChatType = null;
  currentGroup = null;
  currentGroupMembers = [];
  currentReplyTo = null;
  if (messagesUnsubscribe) {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }
  if (typingUnsubscribe) {
    typingUnsubscribe();
    typingUnsubscribe = null;
  }
  document.getElementById('currentChatName').textContent = 'Select a chat';
  document.getElementById('chatStatus').textContent = '';
  document.getElementById('currentChatAvatar').innerHTML = '?';
  document.getElementById('voiceCallBtn').style.display = 'none';
  document.getElementById('videoCallBtn').style.display = 'none';
  document.getElementById('messagesArea').innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>Select a chat to start messaging</p></div>';
  document.getElementById('inputArea').style.display = 'none';
  document.getElementById('groupInfoBtn').style.display = 'none';
  closeMobileChatPanel();
}

function setChatHeaderAvatar(content) {
  const avatar = document.getElementById('currentChatAvatar');
  if (avatar) avatar.innerHTML = content || '?';
}

function setBadgeText(elementId, count) {
  const badge = document.getElementById(elementId);
  if (!badge) return;
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

function updateUnreadBadges(items = []) {
  const totalUnread = items.reduce((total, item) => total + (Number(item.unreadCount) || 0), 0);
  setBadgeText('allUnreadBadge', totalUnread);
  setBadgeText('unreadTabBadge', totalUnread);
  document.title = totalUnread > 0 ? `(${totalUnread}) Team Chat` : 'Team Chat - Complete';
}

function scheduleChatListRefresh(delay = 600) {
  clearTimeout(chatListRefreshTimer);
  chatListRefreshTimer = setTimeout(() => {
    if (!currentUser) return;
    loadCurrentChatList();
  }, delay);
}

function setAttachmentPreview() {
  const preview = document.getElementById('attachmentPreview');
  if (!preview) return;
  if (!currentAttachment) {
    preview.style.display = 'none';
    preview.innerHTML = '';
    return;
  }
  const isImage = currentAttachment.type === 'image';
  const attachmentType = isImage ? 'Image attachment' : getAttachmentLabel(currentAttachment);
  preview.style.display = 'flex';
  preview.innerHTML = `
    ${isImage ? `<img src="${currentAttachment.url}" alt="Attachment preview">` : '<span style="font-size:24px">📎</span>'}
    <div style="min-width:0">
      <strong>${escapeHtml(currentAttachment.filename || (isImage ? 'Image ready' : 'Document ready'))}</strong>
      <div class="list-preview">${escapeHtml(attachmentType)}${currentAttachment.size ? ` · ${formatBytes(currentAttachment.size)}` : ''}</div>
    </div>
    <button type="button" id="clearAttachmentBtn">Remove</button>
  `;
  if (!isImage) {
    const icon = preview.querySelector('span[style]');
    if (icon) {
      icon.removeAttribute('style');
      icon.className = 'attachment-file-icon';
      icon.textContent = getFileExtension(currentAttachment.filename, currentAttachment.url);
    }
  }
  document.getElementById('clearAttachmentBtn')?.addEventListener('click', () => {
    currentAttachment = null;
    setAttachmentPreview();
  });
}

function setConnectionBanner() {
  const banner = document.getElementById('connectionBanner');
  if (!banner) return;
  banner.style.display = navigator.onLine ? 'none' : 'block';
}

function setSendingState(isSending) {
  const sendBtn = document.getElementById('sendBtn');
  const input = document.getElementById('messageInput');
  if (sendBtn) {
    sendBtn.disabled = isSending;
    sendBtn.textContent = isSending ? '…' : '➤';
  }
  if (input) input.disabled = isSending;
}

function getCallPermissionMessage(error, type = 'voice') {
  const device = type === 'video' ? 'camera and microphone' : 'microphone';
  if (!error) return `Please allow ${device} access to continue.`;
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
    return `${device[0].toUpperCase()}${device.slice(1)} access was blocked. Allow permission in the browser and try again.`;
  }
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return `No ${type === 'video' ? 'camera/microphone' : 'microphone'} was found on this device.`;
  }
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return `The ${device} is already in use by another app.`;
  }
  return `Unable to access ${device}. Check device permission and try again.`;
}

function setCallStatus(status) {
  const statusEl = document.getElementById('callStatusText');
  if (statusEl) statusEl.textContent = status;
}

function formatCallDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function startCallDuration() {
  callStartedAt = Date.now();
  const durationEl = document.getElementById('callDuration');
  if (durationEl) {
    durationEl.style.display = 'block';
    durationEl.textContent = '0:00';
  }
  clearInterval(callDurationTimer);
  callDurationTimer = setInterval(() => {
    if (durationEl && callStartedAt) {
      durationEl.textContent = formatCallDuration(Date.now() - callStartedAt);
    }
  }, 1000);
}

function stopCallDuration() {
  clearInterval(callDurationTimer);
  callDurationTimer = null;
  callStartedAt = null;
  const durationEl = document.getElementById('callDuration');
  if (durationEl) {
    durationEl.style.display = 'none';
    durationEl.textContent = '0:00';
  }
}

function startIncomingRingtone() {
  stopIncomingRingtone();
  if (navigator.vibrate) {
    navigator.vibrate([260, 180, 260]);
    vibrationTimer = setInterval(() => navigator.vibrate?.([260, 180, 260]), 1400);
  }
  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    ringtoneAudioContext = new AudioContextCtor();
    const playTone = () => {
      if (!ringtoneAudioContext) return;
      const oscillator = ringtoneAudioContext.createOscillator();
      const gain = ringtoneAudioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ringtoneAudioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ringtoneAudioContext.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ringtoneAudioContext.currentTime + 0.42);
      oscillator.connect(gain);
      gain.connect(ringtoneAudioContext.destination);
      oscillator.start();
      oscillator.stop(ringtoneAudioContext.currentTime + 0.45);
    };
    playTone();
    ringtoneTimer = setInterval(playTone, 1500);
  } catch (error) {
    console.warn('Incoming call tone could not start:', error);
  }
}

function notifyIncomingCall(call) {
  if (!document.hidden || Notification.permission !== 'granted') return;
  try {
    new Notification(call.type === 'video' ? 'Incoming video call' : 'Incoming voice call', {
      body: call.fromUserName || 'Team Chat',
      tag: `call-${call.id}`,
      requireInteraction: true
    });
  } catch (error) {
    console.warn('Incoming call notification could not be shown:', error);
  }
}

async function requestCallWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener?.('release', () => {
      wakeLock = null;
    });
  } catch (error) {
    console.warn('Screen wake lock unavailable:', error);
  }
}

async function releaseCallWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch (error) {
    console.warn('Screen wake lock release failed:', error);
  } finally {
    wakeLock = null;
  }
}

function stopIncomingRingtone() {
  clearInterval(ringtoneTimer);
  clearInterval(vibrationTimer);
  ringtoneTimer = null;
  vibrationTimer = null;
  navigator.vibrate?.(0);
  if (ringtoneAudioContext) {
    ringtoneAudioContext.close().catch(() => {});
    ringtoneAudioContext = null;
  }
}

function clearCallTimeout() {
  clearTimeout(callTimeoutTimer);
  callTimeoutTimer = null;
}

function getCallHistoryText(status, type, durationMs = 0) {
  const label = type === 'video' ? 'Video call' : 'Voice call';
  if (status === 'missed') return `Missed ${label.toLowerCase()}`;
  if (status === 'rejected') return `${label} declined`;
  if (status === 'failed') return `${label} failed`;
  if (status === 'ended' && durationMs > 0) return `${label} ended · ${formatCallDuration(durationMs)}`;
  return `${label} ended`;
}

async function writeCallHistory(status) {
  if (!activeCall?.id || callLogWritten || !currentUser) return;
  callLogWritten = true;
  const durationMs = callStartedAt ? Date.now() - callStartedAt : 0;
  const type = activeCall.type || currentCallType || 'voice';
  const directId = getDirectChatId(activeCall.fromUserId, activeCall.toUserId);
  const text = getCallHistoryText(status, type, durationMs);
  await db.collection('messages').doc(`call_${activeCall.id}`).set({
    type: 'call',
    callId: activeCall.id,
    callType: type,
    callStatus: status,
    callDurationMs: durationMs,
    directId,
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    readBy: { [currentUser.uid]: firebase.firestore.FieldValue.serverTimestamp() }
  }, { merge: true }).catch(error => {
    console.warn('Could not write call history:', error);
  });
  await db.collection('directChats').doc(directId).set({
    participants: [activeCall.fromUserId, activeCall.toUserId],
    status: 'active',
    lastMessage: text,
    lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});
}

function scheduleCallTimeout(callRef, ownerRole) {
  clearCallTimeout();
  callTimeoutTimer = setTimeout(async () => {
    let shouldCleanup = false;
    try {
      const snapshot = await callRef.get();
      const data = snapshot.data();
      if (!data || data.status !== 'ringing') return;
      await callRef.update({
        status: 'missed',
        missedBy: data.toUserId,
        endedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      shouldCleanup = true;
      if (ownerRole === 'caller' && activeCall) await writeCallHistory('missed');
      if (ownerRole === 'caller') showToast('Call not answered', 'error');
    } catch (error) {
      console.warn('Could not mark missed call:', error);
    } finally {
      if (shouldCleanup) cleanupCallUi();
    }
  }, 45000);
}

function setCallUi({ mode = 'outgoing', type = 'voice', title = 'Calling...', status = 'Connecting' } = {}) {
  const modal = document.getElementById('callModal');
  const shell = modal?.querySelector('.call-shell');
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const audioAvatar = document.getElementById('callAudioAvatar');
  if (!modal) return;
  activeCallMode = mode;
  modal.style.display = 'flex';
  shell?.classList.toggle('incoming', mode === 'incoming');
  document.getElementById('callTypeLabel').textContent = type === 'video' ? 'Video call' : 'Voice call';
  document.getElementById('callTitle').textContent = title;
  document.getElementById('callStatusText').textContent = status;
  document.getElementById('acceptCallBtn').style.display = mode === 'incoming' ? 'inline-flex' : 'none';
  document.getElementById('rejectCallBtn').style.display = mode === 'incoming' ? 'inline-flex' : 'none';
  document.getElementById('endCallBtn').style.display = mode === 'incoming' ? 'none' : 'inline-flex';
  document.getElementById('muteMicBtn').style.display = mode === 'incoming' ? 'none' : 'inline-flex';
  document.getElementById('toggleCameraBtn').style.display = mode === 'incoming' ? 'none' : 'inline-flex';
  if (localVideo) localVideo.style.display = type === 'video' ? 'block' : 'none';
  if (remoteVideo) remoteVideo.style.display = type === 'video' ? 'block' : 'none';
  if (audioAvatar) {
    audioAvatar.style.display = type === 'voice' ? 'flex' : 'none';
    audioAvatar.classList.toggle('ringing', mode === 'incoming' || mode === 'outgoing');
    audioAvatar.textContent = (currentChat?.otherUserName || activeCall?.fromUserName || activeCall?.toUserName || '?')[0]?.toUpperCase() || '?';
  }
}

function stopLocalCallStream() {
  if (localCallStream) {
    localCallStream.getTracks().forEach(track => track.stop());
    localCallStream = null;
  }
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const remoteAudio = document.getElementById('remoteAudio');
  if (localVideo) localVideo.srcObject = null;
  if (remoteVideo) remoteVideo.srcObject = null;
  if (remoteAudio) remoteAudio.srcObject = null;
}

function cleanupCallUi() {
  clearCallTimeout();
  stopIncomingRingtone();
  stopCallDuration();
  releaseCallWakeLock();
  const modal = document.getElementById('callModal');
  modal.style.display = 'none';
  modal.querySelector('.call-shell')?.classList.remove('incoming');
  document.getElementById('callAudioAvatar')?.classList.remove('ringing');
  stopLocalCallStream();
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (callDocUnsubscribe) callDocUnsubscribe();
  if (callCandidatesUnsubscribe) callCandidatesUnsubscribe();
  callDocUnsubscribe = null;
  callCandidatesUnsubscribe = null;
  activeCall = null;
  activeCallMode = null;
  cameraSender = null;
  callLogWritten = false;
  lastHandledRenegotiationSdp = '';
  micMuted = false;
  cameraOff = false;
  pendingRemoteIceCandidates = [];
  document.getElementById('muteMicBtn')?.classList.remove('active');
  document.getElementById('toggleCameraBtn')?.classList.remove('active');
}

async function preparePeerConnection(callId, role) {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  pendingRemoteIceCandidates = [];
  peerConnection = new RTCPeerConnection(await getRtcConfig());
  remoteCallStream = new MediaStream();
  const remoteVideo = document.getElementById('remoteVideo');
  const remoteAudio = document.getElementById('remoteAudio');
  if (remoteVideo) remoteVideo.srcObject = remoteCallStream;
  if (remoteAudio) remoteAudio.srcObject = remoteCallStream;
  localCallStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: currentCallType === 'video'
  });
  document.getElementById('localVideo').srcObject = localCallStream;
  localCallStream.getTracks().forEach(track => {
    const sender = peerConnection.addTrack(track, localCallStream);
    if (track.kind === 'video') cameraSender = sender;
  });
  peerConnection.ontrack = event => {
    event.streams[0].getTracks().forEach(track => remoteCallStream.addTrack(track));
    remoteAudio?.play?.().catch(() => {});
    remoteVideo?.play?.().catch(() => {});
  };
  peerConnection.onconnectionstatechange = async () => {
    if (!peerConnection) return;
    const state = peerConnection.connectionState;
    if (state === 'connected') {
      clearCallTimeout();
      stopIncomingRingtone();
      document.getElementById('callAudioAvatar')?.classList.remove('ringing');
      setCallStatus('Connected');
      if (!callStartedAt) startCallDuration();
      requestCallWakeLock();
      if (activeCall?.id) {
        await db.collection('calls').doc(activeCall.id).set({
          status: 'connected',
          connectedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
    } else if (state === 'connecting') {
      setCallStatus('Connecting...');
    } else if (state === 'disconnected') {
      setCallStatus('Reconnecting...');
    } else if (state === 'failed') {
      setCallStatus('Call failed');
      if (activeCall?.id) await endActiveCall('failed');
    } else if (state === 'closed') {
      cleanupCallUi();
    }
  };
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      db.collection('calls').doc(callId).collection(role === 'caller' ? 'callerCandidates' : 'calleeCandidates').add(event.candidate.toJSON());
    }
  };
}

async function upgradeVoiceCallToVideo() {
  if (!activeCall?.id || !peerConnection || !localCallStream) return;
  const existingVideo = localCallStream.getVideoTracks()[0];
  if (existingVideo) {
    cameraOff = !cameraOff;
    existingVideo.enabled = !cameraOff;
    document.getElementById('toggleCameraBtn').classList.toggle('active', cameraOff);
    return;
  }
  try {
    setCallStatus('Starting camera...');
    const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoTrack = videoStream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('No camera track available');
    localCallStream.addTrack(videoTrack);
    cameraSender = peerConnection.addTrack(videoTrack, localCallStream);
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    if (localVideo) {
      localVideo.srcObject = localCallStream;
      localVideo.style.display = 'block';
      localVideo.play?.().catch(() => {});
    }
    if (remoteVideo) remoteVideo.style.display = 'block';
    currentCallType = 'video';
    if (activeCall) activeCall.type = 'video';
    document.getElementById('callTypeLabel').textContent = 'Video call';
    await renegotiateActiveCall();
  } catch (error) {
    showToast(getCallPermissionMessage(error, 'video'), 'error');
    setCallStatus(callStartedAt ? 'Connected' : 'Connecting...');
  }
}

async function renegotiateActiveCall() {
  if (!activeCall?.id || !peerConnection) return;
  const callRef = db.collection('calls').doc(activeCall.id);
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await callRef.set({
    offer,
    renegotiatedBy: currentUser.uid,
    type: currentCallType,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  setCallStatus('Updating call...');
}

async function handleRemoteRenegotiation(data) {
  if (!data?.offer || !data.renegotiatedBy || data.renegotiatedBy === currentUser.uid || !peerConnection) return;
  if (data.offer.sdp && data.offer.sdp === lastHandledRenegotiationSdp) return;
  lastHandledRenegotiationSdp = data.offer.sdp || '';
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  await db.collection('calls').doc(activeCall.id).set({
    answer,
    type: data.type || 'video',
    answeredRenegotiationBy: currentUser.uid,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  currentCallType = data.type || 'video';
  if (activeCall) activeCall.type = currentCallType;
  document.getElementById('callTypeLabel').textContent = currentCallType === 'video' ? 'Video call' : 'Voice call';
  document.getElementById('remoteVideo').style.display = currentCallType === 'video' ? 'block' : 'none';
}

async function setPeerRemoteDescription(description) {
  if (!peerConnection || !description) return;
  const type = description.type || description.sdp?.type;
  if (peerConnection.currentRemoteDescription && !(type === 'answer' && peerConnection.signalingState === 'have-local-offer')) return;
  await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
  const candidates = [...pendingRemoteIceCandidates];
  pendingRemoteIceCandidates = [];
  for (const candidate of candidates) {
    await addRemoteIceCandidate(candidate);
  }
}

async function addRemoteIceCandidate(candidateData) {
  if (!peerConnection || !candidateData) return;
  try {
    const candidate = new RTCIceCandidate(candidateData);
    if (!peerConnection.currentRemoteDescription) {
      pendingRemoteIceCandidates.push(candidateData);
      return;
    }
    await peerConnection.addIceCandidate(candidate);
  } catch (error) {
    console.warn('Could not add ICE candidate:', error);
  }
}

async function startCall(type = 'voice') {
  if (!currentUser || !currentChat || currentChatType !== 'direct') {
    showToast('Calls are available for personal chats only', 'error');
    return;
  }
  if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
    showToast('Calls are not supported in this browser', 'error');
    return;
  }
  currentCallType = type;
  const callRef = db.collection('calls').doc();
  activeCall = {
    id: callRef.id,
    type,
    fromUserId: currentUser.uid,
    fromUserName: currentUser.displayName || currentUser.email,
    toUserId: currentChat.otherUserId,
    toUserName: currentChat.otherUserName || currentChat.name || 'Contact'
  };
  setCallUi({ mode: 'outgoing', type, title: activeCall.toUserName, status: 'Calling...' });
  try {
    await preparePeerConnection(callRef.id, 'caller');
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await callRef.set({
      ...activeCall,
      status: 'ringing',
      offer,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    setCallStatus('Ringing...');
    scheduleCallTimeout(callRef, 'caller');
    callDocUnsubscribe = callRef.onSnapshot(snapshot => {
      const data = snapshot.data();
      if (!data) return;
      if (data.answer && !peerConnection.currentRemoteDescription) {
        setPeerRemoteDescription(data.answer);
        setCallStatus('Connecting...');
      }
      if (data.answer && data.answeredRenegotiationBy && data.answeredRenegotiationBy !== currentUser.uid && peerConnection?.signalingState === 'have-local-offer') {
        setPeerRemoteDescription(data.answer);
      }
      handleRemoteRenegotiation(data);
      if (data.status === 'connected') {
        setCallStatus('Connected');
        if (!callStartedAt) startCallDuration();
      }
      if (data.status === 'rejected') {
        showToast('Call rejected', 'error');
      }
      if (data.status === 'missed') {
        showToast('Call missed', 'error');
      }
      if (['ended', 'rejected', 'missed', 'failed'].includes(data.status)) cleanupCallUi();
    });
    callCandidatesUnsubscribe = callRef.collection('calleeCandidates').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') addRemoteIceCandidate(change.doc.data());
      });
    });
  } catch (error) {
    showToast(getCallPermissionMessage(error, type), 'error');
    await callRef.set({ ...activeCall, status: 'failed', error: error.message, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    cleanupCallUi();
  }
}

async function acceptIncomingCall() {
  if (!activeCall?.id) return;
  currentCallType = activeCall.type || 'voice';
  const callRef = db.collection('calls').doc(activeCall.id);
  setCallUi({ mode: 'active', type: currentCallType, title: activeCall.fromUserName || 'Caller', status: 'Connecting...' });
  stopIncomingRingtone();
  clearCallTimeout();
  try {
    await preparePeerConnection(activeCall.id, 'callee');
    await setPeerRemoteDescription(activeCall.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await callRef.update({ answer, status: 'accepted', acceptedAt: firebase.firestore.FieldValue.serverTimestamp() });
    setCallStatus('Connecting...');
    callCandidatesUnsubscribe = callRef.collection('callerCandidates').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') addRemoteIceCandidate(change.doc.data());
      });
    });
    callDocUnsubscribe = callRef.onSnapshot(snapshot => {
      handleRemoteRenegotiation(snapshot.data());
      const status = snapshot.data()?.status;
      if (status === 'connected') {
        setCallStatus('Connected');
        if (!callStartedAt) startCallDuration();
      }
      if (['ended', 'rejected', 'missed', 'failed'].includes(snapshot.data()?.status)) cleanupCallUi();
    });
  } catch (error) {
    showToast(getCallPermissionMessage(error, currentCallType), 'error');
    await callRef.update({ status: 'failed', error: error.message });
    cleanupCallUi();
  }
}

async function endActiveCall(status = 'ended') {
  if (activeCall?.id) {
    await writeCallHistory(status);
    await db.collection('calls').doc(activeCall.id).update({
      status,
      endedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
  }
  cleanupCallUi();
}

function listenForIncomingCalls() {
  if (!currentUser) return;
  if (incomingCallsUnsubscribe) incomingCallsUnsubscribe();
  incomingCallsUnsubscribe = db.collection('calls')
    .where('toUserId', '==', currentUser.uid)
    .where('status', '==', 'ringing')
    .onSnapshot(snapshot => {
      const call = snapshot.docs[0];
      if (!call && activeCallMode === 'incoming') {
        cleanupCallUi();
        return;
      }
      if (!call || activeCall) return;
      activeCall = { id: call.id, ...call.data() };
      currentCallType = activeCall.type || 'voice';
      setCallUi({ mode: 'incoming', type: currentCallType, title: activeCall.fromUserName || 'Incoming call', status: currentCallType === 'video' ? 'Incoming video call' : 'Incoming voice call' });
      notifyIncomingCall(activeCall);
      startIncomingRingtone();
      scheduleCallTimeout(db.collection('calls').doc(activeCall.id), 'receiver');
    });
}

function handleCallCloseAction() {
  if (activeCallMode === 'incoming') {
    endActiveCall('rejected');
    return;
  }
  endActiveCall('ended');
}

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem('offlineMessageQueue') || '[]');
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue) {
  localStorage.setItem('offlineMessageQueue', JSON.stringify(queue));
}

function queueOfflineMessage(messageData, chatSnapshot) {
  const queue = getOfflineQueue();
  queue.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    messageData: {
      ...messageData,
      timestamp: new Date().toISOString(),
      readBy: { [currentUser.uid]: new Date().toISOString() }
    },
    chatSnapshot,
    queuedAt: new Date().toISOString()
  });
  saveOfflineQueue(queue);
}

async function flushOfflineQueue() {
  if (!navigator.onLine || !currentUser) return;
  const queue = getOfflineQueue();
  if (!queue.length) return;
  const remaining = [];
  for (const item of queue) {
    try {
      const messageData = {
        ...item.messageData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        readBy: { [currentUser.uid]: new Date(item.messageData.readBy?.[currentUser.uid] || Date.now()) }
      };
      await db.collection('messages').add(messageData);
      if (item.chatSnapshot?.type === 'direct') {
        await db.collection('directChats').doc(item.chatSnapshot.id).update({
          lastMessage: messageData.text || (messageData.attachment ? 'Attachment' : ''),
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else if (item.chatSnapshot?.type === 'group') {
        await db.collection('groups').doc(item.chatSnapshot.id).update({
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      remaining.push(item);
    }
  }
  saveOfflineQueue(remaining);
  if (queue.length !== remaining.length) {
    showToast('Queued messages sent');
    loadMessages();
    loadCurrentChatList();
  }
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString();
}

function getDirectChatId(userId1, userId2) {
  return [userId1, userId2].sort().join('_');
}

function getContactMergeKey(item) {
  const email = (item.email || item.user?.email || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = ((item.phone || item.user?.phone || item.user?.phoneNumber || '') + '').replace(/\D/g, '');
  if (phone.length >= 6) return `phone:${phone}`;
  return `name:${(item.name || '').trim().toLowerCase()}`;
}

function findProfileByFallbackName(name) {
  const cleanName = (name || '').trim().toLowerCase();
  if (!cleanName || cleanName === 'unknown contact') return null;
  return allUsers.find(user =>
    (user.displayName || '').trim().toLowerCase() === cleanName ||
    (user.email || '').trim().toLowerCase() === cleanName
  ) || null;
}

function mergeDirectContactItems(items) {
  const merged = [];
  const groups = new Map();

  for (const item of items) {
    if (item.type !== 'direct') {
      merged.push(item);
      continue;
    }

    const key = getContactMergeKey(item);
    if (!key || key === 'name:') {
      merged.push(item);
      continue;
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  for (const groupItems of groups.values()) {
    if (groupItems.length === 1) {
      merged.push(groupItems[0]);
      continue;
    }

    const sorted = [...groupItems].sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    const profileBacked = sorted.find(item => item.hasUserProfile);
    const primary = { ...(profileBacked || sorted[0]) };
    const latest = sorted[0];
    primary.id = profileBacked?.id || latest.id;
    primary.preview = latest.preview;
    primary.lastMessageTime = latest.lastMessageTime;
    primary.unreadCount = groupItems.reduce((total, item) => total + (item.unreadCount || 0), 0);
    primary.isFavorite = groupItems.some(item => item.isFavorite);
    primary.isMuted = groupItems.some(item => item.isMuted);
    primary.aliasDirectIds = [...new Set(groupItems.flatMap(item => item.aliasDirectIds || [item.id]))];
    primary.mergedContactCount = groupItems.length;
    merged.push(primary);
  }

  return merged;
}

window.chatDebug = async function chatDebug() {
  const user = auth.currentUser;
  if (!user) {
    console.log('CHAT_DEBUG: not logged in');
    return null;
  }

  const report = {
    uid: user.uid,
    email: user.email,
    directChats: [],
    acceptedRequestsSent: [],
    acceptedRequestsReceived: [],
    messagesWithParticipants: [],
    sentDirectMessages: [],
    allUsers: [],
    builtAllItems: []
  };

  const directChats = await db.collection('directChats')
    .where('participants', 'array-contains', user.uid)
    .get();
  report.directChats = directChats.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const sentAccepted = await db.collection('chatRequests')
    .where('fromUserId', '==', user.uid)
    .where('status', '==', 'accepted')
    .get();
  report.acceptedRequestsSent = sentAccepted.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const receivedAccepted = await db.collection('chatRequests')
    .where('toUserId', '==', user.uid)
    .where('status', '==', 'accepted')
    .get();
  report.acceptedRequestsReceived = receivedAccepted.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  try {
    const messagesWithParticipants = await db.collection('messages')
      .where('participants', 'array-contains', user.uid)
      .limit(20)
      .get();
    report.messagesWithParticipants = messagesWithParticipants.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    report.messagesWithParticipantsError = error.message;
  }

  const sentDirectMessages = await db.collection('messages')
    .where('senderId', '==', user.uid)
    .limit(20)
    .get();
  report.sentDirectMessages = sentDirectMessages.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const users = await db.collection('users').limit(20).get();
  report.allUsers = users.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  try {
    report.builtAllItems = await buildDirectChatItems();
  } catch (error) {
    report.builtAllItemsError = error.message;
  }

  console.log('CHAT_DEBUG_REPORT', report);
  return report;
};

async function renderChatDebugPanel() {
  if (!new URLSearchParams(window.location.search).has('debugChats')) return;
  const panel = document.createElement('pre');
  panel.id = 'chatDebugPanel';
  panel.style.cssText = 'position:fixed;inset:12px;z-index:99999;overflow:auto;background:#111b21;color:#e9edef;padding:16px;border-radius:8px;font:12px/1.4 monospace;white-space:pre-wrap;';
  panel.textContent = 'Loading chat debug report...';
  document.body.appendChild(panel);
  try {
    const report = await window.chatDebug();
    panel.textContent = JSON.stringify(report, null, 2);
  } catch (error) {
    panel.textContent = `Debug failed: ${error.message || error}`;
  }
}

async function loadFavoriteChatIds() {
  if (!currentUser) return;
  const snapshot = await db.collection('favoriteChats').where('userId', '==', currentUser.uid).get();
  favoriteChatIds = snapshot.docs.map(doc => doc.data().chatId);
}

async function toggleFavoriteChat(chatId, chatType) {
  if (!currentUser || !chatId || !chatType) return;
  const existing = await db.collection('favoriteChats')
    .where('userId', '==', currentUser.uid)
    .where('chatId', '==', chatId)
    .where('chatType', '==', chatType)
    .get();
  if (!existing.empty) {
    await existing.docs[0].ref.delete();
    showToast('Removed from favorites');
  } else {
    await db.collection('favoriteChats').add({
      userId: currentUser.uid,
      chatId,
      chatType,
      addedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Added to favorites');
  }
  await loadFavoriteChatIds();
  loadChatsList();
  loadGroupsList();
}

async function getChatUnreadCount(chatId, chatType) {
  if (!currentUser || !chatId || !chatType) return 0;
  try {
    const query = db.collection('messages')
      .where(chatType === 'direct' ? 'directId' : 'groupId', '==', chatId)
      .where('senderId', '!=', currentUser.uid);
    const snapshot = await query.get();
    return snapshot.docs.filter(doc => !doc.data().readBy?.[currentUser.uid]).length;
  } catch (error) {
    return 0;
  }
}

async function markChatReadState(chatId, chatType, readState) {
  if (!currentUser || !chatId || !chatType) return;
  const query = db.collection('messages')
    .where(chatType === 'direct' ? 'directId' : 'groupId', '==', chatId)
    .where('senderId', '!=', currentUser.uid);
  const snapshot = await query.get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.update(doc.ref, {
    read: readState,
    [`readBy.${currentUser.uid}`]: readState ? firebase.firestore.FieldValue.serverTimestamp() : firebase.firestore.FieldValue.delete()
  }));
  if (snapshot.docs.length > 0) await batch.commit();
  showToast(readState ? 'Marked as read' : 'Marked as unread');
}

function updateFilterButtons() {
  // keep visual compatibility for legacy filter buttons if present
  document.getElementById('favoriteFilterBtn')?.classList.toggle('active', currentViewTab === 'favorites');
  document.getElementById('unreadFilterBtn')?.classList.toggle('active', currentViewTab === 'unread');
}

// Indian Phone Validation (starts with 6/7/8/9, exactly 10 digits)
function isValidIndianPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}

// Email validation for search (must have @ and .)
function isCompleteEmail(email) {
  return email.includes('@') && email.includes('.');
}

// ========================================
// UPLOAD FUNCTIONS
// ========================================

async function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      if (data.secure_url) resolve(data.secure_url);
      else reject('Upload failed');
    })
    .catch(reject);
  });
}

async function uploadDocument(file) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('resource_type', 'auto');
    fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      if (data.secure_url) resolve(data.secure_url);
      else reject('Upload failed');
    })
    .catch(reject);
  });
}

// ========================================
// SEARCH FUNCTIONALITY (Real-time with validation)
// ========================================

function searchUsersRealtime(searchTerm) {
  if (currentViewTab !== 'groups') {
    loadAllChatsList(searchTerm);
    return;
  }
  const chatsList = document.getElementById('chatsList');
  if (!chatsList) return;
  
  if (!searchTerm || searchTerm.trim() === '') {
    loadChatsList();
    return;
  }
  
  const term = searchTerm.trim().toLowerCase();
  const results = [];
  const searchDigitsOnly = term.replace(/\D/g, '');
  
  allUsers.forEach(user => {
    if (isBlocked(user.id)) return;
    const displayName = (user.displayName || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const phone = ((user.phone || user.phoneNumber || '') + '').replace(/\D/g, '');
    
    if (displayName.includes(term) || email.includes(term)) {
      results.push(user);
      return;
    }
    
    if (searchDigitsOnly.length >= 6 && phone.includes(searchDigitsOnly)) {
      results.push(user);
      return;
    }
  });
  
  displaySearchResults(results, chatsList);
}

async function displaySearchResults(results, container) {
  if (results.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:40px;">👤 No users found</div>';
    return;
  }
  
  container.innerHTML = '';
  for (const user of results) {
    if (isBlocked(user.id)) continue;
    const requestState = await getContactRequestState(user.id);
    const userDiv = document.createElement('div');
    userDiv.className = 'list-item';
    const phoneValue = user.phone || user.phoneNumber || '';
    const phoneDisplay = phoneValue ? `📞 ${phoneValue}` : '';
    userDiv.innerHTML = `
      <div class="list-avatar">${user.displayName ? user.displayName[0].toUpperCase() : '👤'}</div>
      <div class="list-info">
        <div class="list-name">${escapeHtml(user.displayName || 'User')}</div>
        <div class="list-preview">${escapeHtml(user.email || '')} ${phoneDisplay}</div>
      </div>
      <span class="status-chip ${requestState.status}">${requestState.label}</span>
    `;
    userDiv.onclick = () => handleUserSelection(user);
    container.appendChild(userDiv);
  }
}

async function handleUserSelection(user) {
  if (!currentUser || !user) return;
  if (user.id === currentUser.uid) {
    showToast('Cannot chat with yourself', 'error');
    return;
  }

  try {
    const chatId = getDirectChatId(currentUser.uid, user.id);
    const chatDoc = await db.collection('directChats').doc(chatId).get();
    if (chatDoc.exists) {
      startDirectChat(user);
    } else if (await hasAcceptedChatRelationship(user.id)) {
      await ensureDirectChatExists(user.id);
      startDirectChat(user);
    } else {
      await sendChatRequest(user);
    }
  } catch (error) {
    console.error('Could not open user or send request:', error);
    showToast(error?.message || 'Could not send request. Please try again.', 'error');
  }
}

async function hasAcceptedChatRelationship(otherUserId) {
  if (!currentUser || !otherUserId) return false;
  const sent = await db.collection('chatRequests')
    .where('fromUserId', '==', currentUser.uid)
    .where('toUserId', '==', otherUserId)
    .where('status', '==', 'accepted')
    .limit(1)
    .get();
  if (!sent.empty) return true;

  const received = await db.collection('chatRequests')
    .where('fromUserId', '==', otherUserId)
    .where('toUserId', '==', currentUser.uid)
    .where('status', '==', 'accepted')
    .limit(1)
    .get();
  return !received.empty;
}

async function ensureDirectChatExists(otherUserId) {
  const chatId = getDirectChatId(currentUser.uid, otherUserId);
  const chatDoc = await db.collection('directChats').doc(chatId).get();
  if (!chatDoc.exists) {
    await db.collection('directChats').doc(chatId).set({
      participants: [currentUser.uid, otherUserId],
      status: 'active',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  return chatId;
}

async function sendChatRequest(user) {
  if (!currentUser || !user) return;
  if (await isBlockedByUser(user.id)) {
    showToast('Request cannot be sent to this user', 'error');
    return;
  }
  const existingRequest = await db.collection('chatRequests')
    .where('fromUserId', '==', currentUser.uid)
    .where('toUserId', '==', user.id)
    .where('status', '==', 'pending')
    .get();

  if (!existingRequest.empty) {
    showToast('Request already sent to this user');
    return;
  }

  const inverseRequest = await db.collection('chatRequests')
    .where('fromUserId', '==', user.id)
    .where('toUserId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .get();

  if (!inverseRequest.empty) {
    showToast(`${user.displayName || user.email} already sent you a request. Accept it from Requests.`);
    return;
  }

  await db.collection('chatRequests').add({
    fromUserId: currentUser.uid,
    fromUserName: currentUser.displayName || currentUser.email.split('@')[0],
    toUserId: user.id,
    toUserName: user.displayName || user.email,
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast('Request sent');
}

async function isBlockedByUser(userId) {
  if (!currentUser || !userId) return false;
  try {
    const snapshot = await db.collection('blockedUsers')
      .where('userId', '==', userId)
      .where('blockedUserId', '==', currentUser.uid)
      .limit(1)
      .get();
    return !snapshot.empty;
  } catch (error) {
    return false;
  }
}

async function loadReceivedRequests() {
  if (!currentUser) return;
  const requestList = document.getElementById('requestList');
  if (!requestList) return;
  const snapshot = await db.collection('chatRequests')
    .where('toUserId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .get();

  const badge = document.getElementById('requestBadge');
  if (snapshot.empty) {
    requestList.innerHTML = '<div class="empty-state" style="padding:20px;">No requests</div>';
    if (badge) badge.style.display = 'none';
    return;
  }

  if (badge) {
    badge.textContent = snapshot.size;
    badge.style.display = 'inline-block';
  }

  const requests = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  requestList.innerHTML = '';
  for (const req of requests) {
    const reqDiv = document.createElement('div');
    reqDiv.className = 'list-item';
    reqDiv.innerHTML = `
      <div class="list-avatar">👤</div>
      <div class="list-info">
        <div class="list-name">${escapeHtml(req.fromUserName || 'User')}</div>
        <div class="list-preview">Chat request</div>
      </div>
      <div class="request-actions">
        <button class="btn btn-success accept-request-btn" data-id="${req.id}" data-from="${escapeHtml(req.fromUserId)}">Accept</button>
        <button class="btn btn-outline decline-request-btn" data-id="${req.id}">Decline</button>
      </div>
    `;
    requestList.appendChild(reqDiv);
  }
  requestList.querySelectorAll('.accept-request-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await acceptChatRequest(btn.dataset.id, btn.dataset.from);
    });
  });
  requestList.querySelectorAll('.decline-request-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await declineChatRequest(btn.dataset.id);
    });
  });
}

function setupRequestListeners() {
  if (!currentUser) return;
  if (chatRequestsUnsubscribe) chatRequestsUnsubscribe();
  chatRequestsUnsubscribe = db.collection('chatRequests')
    .where('toUserId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .onSnapshot(() => {
      loadReceivedRequests();
    });
}

async function acceptChatRequest(requestId, fromUserId) {
  if (!currentUser || !requestId || !fromUserId) return;
  try {
    const chatId = getDirectChatId(currentUser.uid, fromUserId);
    const chatDoc = await db.collection('directChats').doc(chatId).get();
    if (!chatDoc.exists) {
      await db.collection('directChats').doc(chatId).set({
        participants: [currentUser.uid, fromUserId],
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    await db.collection('chatRequests').doc(requestId).update({ status: 'accepted', respondedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Request accepted');
    loadReceivedRequests();
    loadCurrentChatList();

    const userDoc = await db.collection('users').doc(fromUserId).get();
    if (userDoc.exists) {
      startDirectChat({ id: fromUserId, ...userDoc.data() });
    }
  } catch (error) {
    console.error('Could not accept chat request:', error);
    showToast(error?.message || 'Could not accept request. Please try again.', 'error');
  }
}

async function declineChatRequest(requestId) {
  if (!requestId) return;
  await db.collection('chatRequests').doc(requestId).update({ status: 'declined', respondedAt: firebase.firestore.FieldValue.serverTimestamp() });
  showToast('Request declined');
  loadReceivedRequests();
}

async function loadReceivedRequests() {
  if (!currentUser) return;
  const requestList = document.getElementById('requestList');
  if (!requestList) return;
  const requestSection = document.querySelector('.request-section');
  const requestToggle = document.getElementById('requestToggle');

  const chatSnapshot = await db.collection('chatRequests')
    .where('toUserId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .get();
  const groupSnapshot = await db.collection('groupInvites')
    .where('toUserId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .get();

  const requests = [
    ...chatSnapshot.docs.map(doc => ({ id: doc.id, requestType: 'chat', ...doc.data() })),
    ...groupSnapshot.docs.map(doc => ({ id: doc.id, requestType: 'group', ...doc.data() }))
  ].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  const badge = document.getElementById('requestBadge');
  if (requests.length === 0) {
    requestList.innerHTML = '<div class="empty-state" style="padding:20px;">No requests</div>';
    if (badge) badge.style.display = 'none';
    if (requestToggle) requestToggle.textContent = '▼';
    requestSection?.classList.remove('expanded');
    return;
  }

  if (badge) {
    badge.textContent = requests.length;
    badge.style.display = 'inline-block';
  }
  if (requestToggle) requestToggle.textContent = requestSection?.classList.contains('expanded') ? '▲' : '▼';

  requestList.innerHTML = '';
  for (const req of requests) {
    const isGroupInvite = req.requestType === 'group';
    const reqDiv = document.createElement('div');
    reqDiv.className = 'list-item';
    reqDiv.innerHTML = `
      <div class="list-avatar">${isGroupInvite ? 'G' : 'C'}</div>
      <div class="list-info">
        <div class="list-name">${escapeHtml(isGroupInvite ? (req.groupName || 'Group invite') : (req.fromUserName || 'User'))}</div>
        <div class="list-preview">${isGroupInvite ? `Group invite from ${escapeHtml(req.fromUserName || 'User')}` : 'Chat request'}</div>
      </div>
      <div class="request-actions">
        <button class="btn btn-success accept-request-btn" data-type="${req.requestType}" data-id="${req.id}" data-from="${escapeHtml(req.fromUserId || '')}">Accept</button>
        <button class="btn btn-outline delete-request-btn" data-type="${req.requestType}" data-id="${req.id}">Delete</button>
        <button class="btn btn-outline block-request-btn" data-type="${req.requestType}" data-id="${req.id}" data-from="${escapeHtml(req.fromUserId || '')}" data-name="${escapeHtml(req.fromUserName || 'User')}">Block</button>
      </div>
    `;
    requestList.appendChild(reqDiv);
  }

  requestList.querySelectorAll('.accept-request-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      btn.disabled = true;
      try {
        if (btn.dataset.type === 'group') await acceptGroupInvite(btn.dataset.id);
        else await acceptChatRequest(btn.dataset.id, btn.dataset.from);
      } finally {
        btn.disabled = false;
      }
    });
  });
  requestList.querySelectorAll('.delete-request-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (btn.dataset.type === 'group') await deleteGroupInvite(btn.dataset.id);
      else await deleteChatRequest(btn.dataset.id);
    });
  });
  requestList.querySelectorAll('.block-request-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await blockRequestSender(btn.dataset.type, btn.dataset.id, btn.dataset.from, btn.dataset.name);
    });
  });
}

function setupRequestListeners() {
  if (!currentUser) return;
  if (chatRequestsUnsubscribe) chatRequestsUnsubscribe();
  if (groupInvitesUnsubscribe) groupInvitesUnsubscribe();
  chatRequestsUnsubscribe = db.collection('chatRequests')
    .where('toUserId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .onSnapshot(() => loadReceivedRequests());
  groupInvitesUnsubscribe = db.collection('groupInvites')
    .where('toUserId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .onSnapshot(() => loadReceivedRequests());
}

async function acceptGroupInvite(inviteId) {
  if (!currentUser || !inviteId) return;
  const inviteRef = db.collection('groupInvites').doc(inviteId);
  const inviteDoc = await inviteRef.get();
  if (!inviteDoc.exists) return;
  const invite = inviteDoc.data();

  const existing = await db.collection('groupMembers')
    .where('groupId', '==', invite.groupId)
    .where('userId', '==', currentUser.uid)
    .get();
  if (existing.empty) {
    await db.collection('groupMembers').add({
      groupId: invite.groupId,
      userId: currentUser.uid,
      role: 'member',
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('groups').doc(invite.groupId).update({
      memberCount: firebase.firestore.FieldValue.increment(1)
    });
  }

  await inviteRef.update({
    status: 'accepted',
    respondedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast(`Joined ${invite.groupName || 'group'}`);
  loadReceivedRequests();
  loadGroupsList();
}

async function declineGroupInvite(inviteId) {
  if (!inviteId) return;
  await db.collection('groupInvites').doc(inviteId).update({
    status: 'declined',
    respondedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast('Group invite declined');
  loadReceivedRequests();
}

async function deleteChatRequest(requestId) {
  if (!requestId) return;
  await db.collection('chatRequests').doc(requestId).update({
    status: 'deleted',
    respondedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast('Request deleted');
  loadReceivedRequests();
}

async function deleteGroupInvite(inviteId) {
  if (!inviteId) return;
  await db.collection('groupInvites').doc(inviteId).update({
    status: 'deleted',
    respondedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast('Invite deleted');
  loadReceivedRequests();
}

async function blockRequestSender(type, requestId, fromUserId, fromUserName) {
  if (!fromUserId) return;
  if (!confirm(`Block ${fromUserName || 'this user'} from sending requests?`)) return;
  await blockUser(fromUserId, fromUserName || 'User');
  await loadBlockedUsers();
  if (type === 'group') await deleteGroupInvite(requestId);
  else await deleteChatRequest(requestId);
  showToast(`${fromUserName || 'User'} blocked`);
}

// Group search (real-time, partial match)
function searchGroupsRealtime(searchTerm) {
  const groupsList = document.getElementById('groupsList');
  if (!groupsList) return;
  
  if (!searchTerm || searchTerm.trim() === '') {
    loadGroupsList();
    return;
  }
  
  const term = searchTerm.toLowerCase().trim();
  const allGroups = [];
  
  // We need to load groups first, then filter
  db.collection('groupMembers').where('userId', '==', currentUser.uid).get().then(async snapshot => {
    for (const doc of snapshot.docs) {
      const groupDoc = await db.collection('groups').doc(doc.data().groupId).get();
      if (groupDoc.exists && groupDoc.data().name.toLowerCase().includes(term)) {
        allGroups.push({ id: groupDoc.id, name: groupDoc.data().name, code: groupDoc.data().code, icon: groupDoc.data().icon });
      }
    }
    
    if (allGroups.length === 0) {
      groupsList.innerHTML = '<div class="empty-state" style="padding:40px;">👥 No matching groups</div>';
      return;
    }
    
    groupsList.innerHTML = '';
    allGroups.forEach(group => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'list-item';
      groupDiv.innerHTML = `
        <div class="list-avatar">${group.icon ? `<img src="${group.icon}">` : '👥'}</div>
        <div class="list-info">
          <div class="list-name">${escapeHtml(group.name)}</div>
          <div class="list-preview">${group.code}</div>
        </div>
      `;
      groupDiv.onclick = () => loadGroupChat(group.id, group.name);
      groupsList.appendChild(groupDiv);
    });
  });
}

// ========================================
// BLOCKED USERS
// ========================================

async function loadBlockedUsers() {
  if (!currentUser) return;
  const snapshot = await db.collection('blockedUsers').where('userId', '==', currentUser.uid).get();
  blockedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function blockUser(userId, userName) {
  if (!userId || isBlocked(userId)) return;
  await db.collection('blockedUsers').add({
    userId: currentUser.uid,
    blockedUserId: userId,
    blockedUserName: userName,
    blockedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await loadBlockedUsers();
  showToast(`Blocked ${userName}`);
}

async function unblockUser(blockId) {
  await db.collection('blockedUsers').doc(blockId).delete();
  await loadBlockedUsers();
  showToast('User unblocked');
}

function isBlocked(userId) {
  return blockedUsers.some(b => b.blockedUserId === userId);
}

async function getCurrentDirectMessages() {
  if (!currentChat || currentChatType !== 'direct') return [];
  const directIds = currentChat.aliasDirectIds?.length ? currentChat.aliasDirectIds : [currentChat.id];
  const messages = [];
  for (const directId of directIds) {
    const snapshot = await db.collection('messages')
      .where('directId', '==', directId)
      .limit(80)
      .get();
    snapshot.docs.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
  }
  return messages.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
}

function extractLinks(text = '') {
  return text.match(/https?:\/\/[^\s]+/g) || [];
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

// ========================================
// MUTED CHATS
// ========================================

async function loadMutedChats() {
  if (!currentUser) return;
  const snapshot = await db.collection('mutedChats').where('userId', '==', currentUser.uid).get();
  mutedChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function muteChat(chatId, chatType, duration) {
  let muteUntil = null;
  if (duration === '8h') muteUntil = new Date(Date.now() + 8 * 60 * 60 * 1000);
  else if (duration === '1w') muteUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  await db.collection('mutedChats').add({
    userId: currentUser.uid, chatId, chatType, muteUntil,
    mutedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await loadMutedChats();
  showToast('Chat muted');
}

async function unmuteChat(muteId) {
  await db.collection('mutedChats').doc(muteId).delete();
  await loadMutedChats();
  showToast('Chat unmuted');
}

function isChatMuted(chatId) {
  const mute = mutedChats.find(m => m.chatId === chatId);
  if (!mute) return false;
  if (mute.muteUntil && mute.muteUntil.toDate() < new Date()) {
    unmuteChat(mute.id);
    return false;
  }
  return true;
}

// ========================================
// QUICK REPLIES
// ========================================

async function loadQuickReplies() {
  if (!currentUser) return;
  const snapshot = await db.collection('quickReplies').where('userId', '==', currentUser.uid).get();
  quickReplies = snapshot.docs.map(doc => ({ id: doc.id, text: doc.data().text }));
}

async function addQuickReply(text) {
  await db.collection('quickReplies').add({
    userId: currentUser.uid, text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await loadQuickReplies();
  showQuickRepliesModal();
}

async function deleteQuickReply(replyId) {
  await db.collection('quickReplies').doc(replyId).delete();
  await loadQuickReplies();
  showQuickRepliesModal();
}

// ========================================
// PINNED MESSAGES
// ========================================

async function pinMessage(messageId, messageData) {
  const existing = await db.collection('pinnedMessages')
    .where('chatId', '==', currentChat.id).where('userId', '==', currentUser.uid).get();
  
  if (existing.size >= 5) {
    showToast('You can only pin up to 5 messages', 'error');
    return;
  }
  
  await db.collection('pinnedMessages').add({
    chatId: currentChat.id, messageId, userId: currentUser.uid,
    text: messageData.text, senderName: messageData.senderName,
    timestamp: messageData.timestamp, pinnedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast('Message pinned');
  loadPinnedMessages();
}

async function unpinMessage(pinId) {
  await db.collection('pinnedMessages').doc(pinId).delete();
  loadPinnedMessages();
}

async function loadPinnedMessages() {
  if (!currentChat) return;
  
  let snapshot;
  try {
    // Try with ordering first
    snapshot = await db.collection('pinnedMessages')
      .where('chatId', '==', currentChat.id)
      .where('userId', '==', currentUser.uid)
      .orderBy('pinnedAt', 'desc')
      .get();
  } catch (error) {
    console.warn('Index not ready, using fallback query:', error);
    // Fallback: query without ordering
    snapshot = await db.collection('pinnedMessages')
      .where('chatId', '==', currentChat.id)
      .where('userId', '==', currentUser.uid)
      .get();
    // Sort manually
    const docs = snapshot.docs;
    docs.sort((a, b) => {
      const timeA = a.data().pinnedAt?.toDate() || new Date(0);
      const timeB = b.data().pinnedAt?.toDate() || new Date(0);
      return timeB - timeA;
    });
    snapshot.docs = docs;
  }
  
  pinnedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const pinnedSection = document.getElementById('pinnedSection');
  const pinnedList = document.getElementById('pinnedMessagesList');
  const pinnedCount = document.getElementById('pinnedCount');
  if (!pinnedSection) return;
  
  if (pinnedMessages.length === 0) {
    pinnedSection.style.display = 'none';
    return;
  }
  
  pinnedSection.style.display = 'block';
  if (pinnedCount) pinnedCount.textContent = pinnedMessages.length;
  if (pinnedList) {
    pinnedList.innerHTML = '';
    pinnedMessages.forEach(pin => {
      const div = document.createElement('div');
      div.className = 'pinned-message-item';
      div.innerHTML = `<span>📌</span><div style="flex:1;"><div style="font-weight:600; font-size:12px;">${escapeHtml(pin.senderName)}</div><div style="font-size:11px; color:#888;">${escapeHtml(pin.text ? pin.text.substring(0, 50) : 'Media')}</div></div><button class="unpin-btn" data-id="${pin.id}" style="background:none; border:none; cursor:pointer;">✖</button>`;
      div.querySelector('.unpin-btn')?.addEventListener('click', async (e) => { e.stopPropagation(); await unpinMessage(pin.id); });
      pinnedList.appendChild(div);
    });
  }
}

// ========================================
// MESSAGE REACTIONS
// ========================================

async function addReaction(messageId, reaction) {
  const reactionRef = db.collection('messageReactions').doc(`${messageId}_${currentUser.uid}`);
  const existing = await reactionRef.get();
  
  if (existing.exists && existing.data().reaction === reaction) {
    await reactionRef.delete();
  } else {
    await reactionRef.set({
      messageId, userId: currentUser.uid, reaction,
      userName: currentUser.displayName || currentUser.email.split('@')[0],
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function loadReactions(messageId, container) {
  const snapshot = await db.collection('messageReactions').where('messageId', '==', messageId).get();
  const reactions = {};
  snapshot.forEach(doc => { reactions[doc.data().reaction] = (reactions[doc.data().reaction] || 0) + 1; });
  
  if (Object.keys(reactions).length === 0) return;
  
  const reactionDiv = document.createElement('div');
  reactionDiv.className = 'reactions-container';
  for (const [reaction, count] of Object.entries(reactions)) {
    const badge = document.createElement('span');
    badge.className = 'reaction-badge';
    badge.textContent = `${reaction} ${count}`;
    badge.onclick = (e) => { e.stopPropagation(); addReaction(messageId, reaction); };
    reactionDiv.appendChild(badge);
  }
  container.appendChild(reactionDiv);
}

// ========================================
// VOICE RECORDING (iOS/Android compatible)
// ========================================

async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 } });
    if (!window.MediaRecorder) { showToast('Voice recording not supported', 'error'); return; }
    
    const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
    mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunks = [];
    
    mediaRecorder.ondataavailable = event => { if (event.data.size > 0) audioChunks.push(event.data); };
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: mimeType === 'audio/mp4' ? 'audio/mp4' : 'audio/webm' });
      const formData = new FormData();
      formData.append('file', audioBlob);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('resource_type', 'video');
      try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.secure_url) {
          const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
          await sendVoiceMessage(data.secure_url, duration);
        }
      } catch (error) { showToast('Failed to send voice message', 'error'); }
      stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.start(100);
    isRecording = true;
    recordingStartTime = Date.now();
    document.getElementById('voiceRecordingIndicator')?.classList.add('show');
    
    recordingTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      const timerEl = document.getElementById('recordingTimer');
      if (timerEl) timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      if (elapsed >= 60) stopVoiceRecording();
    }, 1000);
  } catch (error) {
    showToast('Microphone access denied', 'error');
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && isRecording && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(recordingTimer);
    document.getElementById('voiceRecordingIndicator')?.classList.remove('show');
  }
}

function cancelVoiceRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.onstop = () => {};
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(recordingTimer);
    document.getElementById('voiceRecordingIndicator')?.classList.remove('show');
  }
}

async function sendVoiceMessage(audioUrl, duration) {
  if (!currentChat) return;
  const messageData = {
    senderId: currentUser.uid, senderName: currentUser.displayName || currentUser.email.split('@')[0],
    timestamp: firebase.firestore.FieldValue.serverTimestamp(), read: false,
    readBy: { [currentUser.uid]: new Date() },
    attachment: { type: 'voice', url: audioUrl, duration }
  };
  if (currentChatType === 'direct') messageData.directId = currentChat.id;
  else messageData.groupId = currentChat.id;
  await db.collection('messages').add(messageData);
}

// ========================================
// TYPING INDICATOR
// ========================================

async function sendTypingIndicator() {
  if (!currentChat || privacySettings.hideTypingIndicator) return;
  const typingRef = db.collection('typingIndicators').doc(`${currentChat.id}_${currentUser.uid}`);
  await typingRef.set({
    chatId: currentChat.id, userId: currentUser.uid,
    userName: currentUser.displayName || currentUser.email.split('@')[0],
    isTyping: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(async () => { await typingRef.delete(); }, 2000);
}

function listenForTypingIndicator() {
  if (!currentChat || !currentUser) return;
  if (typingUnsubscribe) {
    typingUnsubscribe();
    typingUnsubscribe = null;
  }
  const chatStatus = document.getElementById('chatStatus');
  const baseStatus = chatStatus?.textContent || '';
  typingUnsubscribe = db.collection('typingIndicators')
    .where('chatId', '==', currentChat.id)
    .onSnapshot(snapshot => {
      const someoneTyping = snapshot.docs.some(doc => doc.data().userId !== currentUser.uid);
      if (chatStatus) chatStatus.textContent = someoneTyping ? 'typing...' : baseStatus;
    });
}

// ========================================
// NOTIFICATIONS
// ========================================

async function sendNotification(chatName, message) {
  if (Notification.permission === 'granted' && document.hidden) {
    new Notification(chatName, { body: message });
  }
}

// ========================================
// FIRST TIME PHONE MODAL
// ========================================

async function checkFirstTimeUser() {
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const userData = userDoc.data();
  if (!userData.phoneNumber && userData.isFirstTime === true) {
    showFirstTimePhoneModal();
  }
}

function showFirstTimePhoneModal() {
  const modal = document.getElementById('firstTimePhoneModal');
  if (!modal) return;
  modal.style.display = 'flex';
  
  document.getElementById('skipPhoneBtn').onclick = async () => {
    await db.collection('users').doc(currentUser.uid).update({ isFirstTime: false });
    modal.style.display = 'none';
  };
  
  document.getElementById('savePhoneFirstBtn').onclick = async () => {
    const phone = document.getElementById('firstTimePhone').value;
    if (isValidIndianPhone(phone)) {
      await db.collection('users').doc(currentUser.uid).update({ phoneNumber: phone, isFirstTime: false });
      showToast('Phone number saved!');
      modal.style.display = 'none';
    } else {
      showToast('Enter valid 10-digit Indian phone number (starts with 6/7/8/9)', 'error');
    }
  };
}

// ========================================
// ACCOUNT DEACTIVATION & EMAIL CHANGE
// ========================================

async function deactivateAccount() {
  if (!confirm('⚠️ Deactivate your account? Your profile will be hidden. You can reactivate by logging in again.')) return;
  await db.collection('users').doc(currentUser.uid).update({
    isActive: false, deactivatedAt: firebase.firestore.FieldValue.serverTimestamp(), onlineStatus: 'offline'
  });
  await auth.signOut();
  window.location.href = 'login.html';
}

async function changeEmail() {
  const newEmail = prompt('Enter your new email address:');
  if (!newEmail) return;
  try {
    await currentUser.updateEmail(newEmail);
    await currentUser.sendEmailVerification();
    await db.collection('users').doc(currentUser.uid).update({ email: newEmail });
    showToast('Email changed! Please verify your new email address.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ========================================
// WALLPAPER (Per chat + Global)
// ========================================

function loadWallpaperFromStorage() {
  const saved = localStorage.getItem('chatWallpapers');
  if (saved) {
    try {
      chatWallpapers = JSON.parse(saved) || {};
      if (typeof chatWallpapers !== 'object' || chatWallpapers === null) {
        chatWallpapers = {};
      }
      console.log('Loaded wallpapers from storage:', chatWallpapers);
    } catch (error) {
      chatWallpapers = {};
      console.warn('Failed to parse chatWallpapers from storage, resetting.', error);
    }
  } else {
    chatWallpapers = {};
    console.log('No saved wallpapers found');
  }
  applyCurrentChatWallpaper();
}

function saveWallpaperToStorage() {
  localStorage.setItem('chatWallpapers', JSON.stringify(chatWallpapers));
}

function normalizeWallpaperType(wallpaperType) {
  if (!wallpaperType) return 'default';
  const trimmed = wallpaperType.toString().trim();
  const lower = trimmed.toLowerCase();
  const presets = ['default', 'dark', 'forest', 'ocean', 'sunset', 'purple'];
  return presets.includes(lower) ? lower : trimmed;
}

function setWallpaperForChat(chatId, wallpaperType) {
  if (!chatId) {
    showToast('No chat selected', 'error');
    return;
  }

  wallpaperType = normalizeWallpaperType(wallpaperType);
  if (wallpaperType === 'default') {
    delete chatWallpapers[chatId];
    showToast('Wallpaper removed for this chat');
  } else {
    chatWallpapers[chatId] = wallpaperType;
    showToast('Wallpaper set for this chat');
  }
  saveWallpaperToStorage();
  
  // Apply immediately if this is the current chat
  if (currentChat && currentChat.id === chatId) {
    applyCurrentChatWallpaper();
  }
}

function setGlobalWallpaper(wallpaperType) {
  wallpaperType = normalizeWallpaperType(wallpaperType);
  chatWallpapers['global'] = wallpaperType;
  saveWallpaperToStorage();
  applyCurrentChatWallpaper();
  showToast('Global wallpaper updated for all chats');
}

function openWallpaperModal(mode) {
  if (mode === 'current' && !currentChat) {
    showToast('Select a chat before changing wallpaper', 'error');
    return;
  }
  wallpaperModalMode = mode === 'current' ? 'current' : 'global';
  const title = document.getElementById('wallpaperModalTitle');
  if (title) {
    title.textContent = wallpaperModalMode === 'current' ? 'Chat Wallpaper (Current Chat)' : 'Chat Wallpaper (All Chats)';
  }
  document.getElementById('wallpaperModal').style.display = 'flex';
}

// Test function to check wallpaper storage
function testWallpaperStorage() {
  console.log('Current chatWallpapers object:', chatWallpapers);
  const saved = localStorage.getItem('chatWallpapers');
  console.log('Saved in localStorage:', saved);
  if (currentChat) {
    console.log('Wallpaper for current chat:', chatWallpapers[currentChat.id]);
  }
}

function applyCurrentChatWallpaper() {
  const messagesArea = document.getElementById('messagesArea');
  if (!messagesArea) {
    console.log('No messages area found');
    return;
  }
  
  if (!currentChat) {
    console.log('No current chat selected');
    return;
  }
  
  console.log('=== WALLPAPER DEBUG ===');
  console.log('Current chat ID:', currentChat.id);
  console.log('Current chat type:', currentChatType);
  console.log('All wallpapers in storage:', chatWallpapers);
  
  // Reset all styles first - FORCE remove all inline styles
  messagesArea.style.cssText = '';
  messagesArea.style.backgroundImage = '';
  messagesArea.style.backgroundColor = '';
  messagesArea.style.backgroundSize = '';
  messagesArea.style.backgroundPosition = '';
  messagesArea.style.backgroundRepeat = '';
  
  let wallpaper = null;
  
  // Check for per-chat wallpaper first
  if (chatWallpapers[currentChat.id]) {
    wallpaper = chatWallpapers[currentChat.id];
    console.log('Found per-chat wallpaper:', wallpaper);
  } 
  // Then check for global wallpaper
  else if (chatWallpapers['global']) {
    wallpaper = chatWallpapers['global'];
    console.log('Found global wallpaper:', wallpaper);
  }
  
  if (!wallpaper || wallpaper === 'default') {
    // Default background
    messagesArea.style.backgroundColor = '#f8fafc';
    if (document.body.classList.contains('dark')) {
      messagesArea.style.backgroundColor = '#1a1a2e';
    }
    console.log('Using default background');
  } else if (wallpaper === 'dark') {
    messagesArea.style.backgroundColor = '#1a1a2e';
    messagesArea.style.backgroundImage = '';
    console.log('Applied dark wallpaper');
  } else if (wallpaper === 'forest') {
    messagesArea.style.backgroundImage = 'linear-gradient(135deg, #2d5a27 0%, #1a3a15 100%)';
    messagesArea.style.backgroundColor = '';
    console.log('Applied forest wallpaper');
  } else if (wallpaper === 'ocean') {
    messagesArea.style.backgroundImage = 'linear-gradient(135deg, #1e3a5f 0%, #0f1a2e 100%)';
    messagesArea.style.backgroundColor = '';
    console.log('Applied ocean wallpaper');
  } else if (wallpaper === 'sunset') {
    messagesArea.style.backgroundImage = 'linear-gradient(135deg, #7c2d12 0%, #431407 100%)';
    messagesArea.style.backgroundColor = '';
    console.log('Applied sunset wallpaper');
  } else if (wallpaper === 'purple') {
    messagesArea.style.backgroundImage = 'linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)';
    messagesArea.style.backgroundColor = '';
    console.log('Applied purple wallpaper');
  } else if (wallpaper && wallpaper.startsWith('http')) {
    messagesArea.style.backgroundImage = `url(${wallpaper})`;
    messagesArea.style.backgroundSize = 'cover';
    messagesArea.style.backgroundPosition = 'center';
    messagesArea.style.backgroundColor = '';
    console.log('Applied custom image wallpaper:', wallpaper);
  }
  
  // Force the messages area to update
  messagesArea.style.display = 'none';
  messagesArea.offsetHeight; // Force reflow
  messagesArea.style.display = 'flex';
  messagesArea.style.flexDirection = 'column';
  
  console.log('Final background style:', messagesArea.style.backgroundImage);
  console.log('Final background color:', messagesArea.style.backgroundColor);
}

// ========================================
// LOAD ALL USERS
// ========================================

async function loadAllUsers() {
  if (!currentUser) return;
  const snapshot = await db.collection('users').get();
  allUsers = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (doc.id !== currentUser.uid && !isBlocked(doc.id) && data.isActive !== false) {
      allUsers.push({ id: doc.id, ...data, phone: data.phone || data.phoneNumber || '' });
    }
  });
  populateGroupMemberSuggestions();
}

function populateGroupMemberSuggestions() {
  updateGroupMemberSuggestions();
}

function findUserByMemberInput(input) {
  const term = (input || '').trim().toLowerCase();
  if (!term) return null;
  const digits = term.replace(/\D/g, '');
  return allUsers.find(user => {
    const name = (user.displayName || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const phone = ((user.phone || user.phoneNumber || '') + '').replace(/\D/g, '');
    return email === term ||
      name === term ||
      (digits.length >= 6 && phone === digits) ||
      email.includes(term) ||
      name.includes(term) ||
      (digits.length >= 6 && phone.includes(digits));
  }) || null;
}

function searchUsersByIdentity(input) {
  const term = (input || '').trim().toLowerCase();
  if (!term) return [];
  const digits = term.replace(/\D/g, '');
  return allUsers.filter(user => {
    if (isBlocked(user.id)) return false;
    const name = (user.displayName || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const phone = ((user.phone || user.phoneNumber || '') + '').replace(/\D/g, '');
    return name.includes(term) ||
      email.includes(term) ||
      (digits.length > 0 && phone.includes(digits));
  });
}

async function getContactRequestState(userId) {
  if (!currentUser || !userId) return { status: 'none', label: '' };

  const sentPending = await db.collection('chatRequests')
    .where('fromUserId', '==', currentUser.uid)
    .where('toUserId', '==', userId)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (!sentPending.empty) return { status: 'sent', label: 'Request sent' };

  const receivedPending = await db.collection('chatRequests')
    .where('fromUserId', '==', userId)
    .where('toUserId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (!receivedPending.empty) return { status: 'received', label: 'Accept request' };

  if (await hasAcceptedChatRelationship(userId)) return { status: 'accepted', label: 'Connected' };
  return { status: 'none', label: 'Send chat request' };
}

async function getGroupInviteState(groupId, userId) {
  if (!groupId || !userId) return { status: 'none', label: '' };
  const member = await db.collection('groupMembers')
    .where('groupId', '==', groupId)
    .where('userId', '==', userId)
    .limit(1)
    .get();
  if (!member.empty) return { status: 'member', label: 'Member' };

  const pending = await db.collection('groupInvites')
    .where('groupId', '==', groupId)
    .where('toUserId', '==', userId)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (!pending.empty) return { status: 'pending', label: 'Invite pending' };
  return { status: 'none', label: 'Send invite' };
}

function updateGroupMemberSuggestions(searchTerm = '') {
  const datalist = document.getElementById('groupMemberSuggestions');
  if (!datalist) return;
  const users = searchTerm.trim() ? searchUsersByIdentity(searchTerm) : allUsers;
  datalist.innerHTML = '';
  users.slice(0, 20).forEach(user => {
    const label = user.displayName || user.email || user.phone || 'User';
    const values = [user.displayName, user.email, user.phone, user.phoneNumber].filter(Boolean);
    [...new Set(values)].forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.label = label === value ? value : `${label} (${value})`;
      datalist.appendChild(option);
    });
  });
}

function setupChatListListeners() {
  if (!currentUser) return;
  if (directChatsUnsubscribe) directChatsUnsubscribe();
  if (groupChatsUnsubscribe) groupChatsUnsubscribe();

  directChatsUnsubscribe = db.collection('directChats')
    .where('participants', 'array-contains', currentUser.uid)
    .onSnapshot(() => {
      loadCurrentChatList();
    });

  groupChatsUnsubscribe = db.collection('groupMembers')
    .where('userId', '==', currentUser.uid)
    .onSnapshot(() => {
      loadCurrentChatList();
    });
}

// ========================================
// ARCHIVE FUNCTIONS
// ========================================

async function archiveChat(chatId, chatType, chatName) {
  await db.collection('archivedChats').doc(`${currentUser.uid}_${chatId}`).set({
    userId: currentUser.uid, chatId, chatType, chatName,
    archivedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  if (currentChat?.id === chatId) {
    currentChat = null;
    currentChatType = null;
    if (messagesUnsubscribe) {
      messagesUnsubscribe();
      messagesUnsubscribe = null;
    }
    document.getElementById('currentChatName').textContent = 'Select a chat';
    document.getElementById('chatStatus').textContent = '';
    document.getElementById('messagesArea').innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>Select a chat to start messaging</p></div>';
    document.getElementById('inputArea').style.display = 'none';
    closeMobileChatPanel();
  }
  loadChatsList(); loadGroupsList(); loadArchivedChats();
}

async function unarchiveChat(archiveId) {
  await db.collection('archivedChats').doc(archiveId).delete();
  loadChatsList(); loadGroupsList(); loadArchivedChats();
}

async function getArchivedChatIds() {
  if (!currentUser) return new Set();
  const snapshot = await db.collection('archivedChats')
    .where('userId', '==', currentUser.uid)
    .get();
  return new Set(snapshot.docs.map(doc => doc.data().chatId));
}

async function getDeletedChatIds() {
  if (!currentUser) return new Set();
  const snapshot = await db.collection('deletedChats')
    .where('userId', '==', currentUser.uid)
    .get();
  return new Set(snapshot.docs.map(doc => doc.data().chatId));
}

async function deleteChatForMe(chatId, chatType, chatName = 'Chat') {
  if (!currentUser || !chatId || !chatType) return;
  await db.collection('deletedChats').doc(`${currentUser.uid}_${chatId}`).set({
    userId: currentUser.uid,
    chatId,
    chatType,
    chatName,
    deletedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  if (currentChat?.id === chatId && currentChatType === chatType) {
    resetChatPanel();
  }
  showToast('Chat deleted for you');
  loadCurrentChatList();
}

async function loadArchivedChats() {
  const archiveList = document.getElementById('archiveList');
  if (!archiveList) return;
  const snapshot = await db.collection('archivedChats').where('userId', '==', currentUser.uid).get();
  if (snapshot.empty) { archiveList.innerHTML = '<div class="empty-state" style="padding:20px;">No archived chats</div>'; return; }
  archiveList.innerHTML = '';
  const archivedChats = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.archivedAt?.toMillis?.() || 0) - (a.archivedAt?.toMillis?.() || 0));
  for (const archive of archivedChats) {
    const archiveDiv = document.createElement('div');
    archiveDiv.className = 'list-item';
    archiveDiv.style.opacity = '0.7';
    archiveDiv.innerHTML = `<div class="list-avatar">${archive.chatType === 'group' ? '👥' : '👤'}</div><div class="list-info"><div class="list-name">${escapeHtml(archive.chatName)}</div><div class="list-preview">Archived</div></div><button class="list-item-menu unarchive-btn" data-id="${archive.id}">📤</button>`;
    archiveList.appendChild(archiveDiv);
  }
  document.querySelectorAll('.unarchive-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => { e.stopPropagation(); await unarchiveChat(btn.dataset.id); });
  });
}

async function buildDirectChatItems() {
  if (!currentUser) return [];
  const archivedChatIds = await getArchivedChatIds();
  const deletedChatIds = await getDeletedChatIds();
  const directChats = await db.collection('directChats')
    .where('participants', 'array-contains', currentUser.uid)
    .get();
  const directChatDocs = new Map();
  directChats.docs.forEach(doc => directChatDocs.set(doc.id, { id: doc.id, data: doc.data() }));

  try {
    const legacyMessages = await db.collection('messages')
      .where('participants', 'array-contains', currentUser.uid)
      .get();
    legacyMessages.docs.forEach(messageDoc => {
      const message = messageDoc.data();
      if (!message.directId || directChatDocs.has(message.directId)) return;
      directChatDocs.set(message.directId, {
        id: message.directId,
        data: {
          participants: message.participants || message.directId.split('_'),
          lastMessageTime: message.timestamp,
          status: 'active'
        }
      });
    });
  } catch (error) {
    console.warn('Could not load legacy message-backed chats:', error);
  }

  try {
    const sentLegacyMessages = await db.collection('messages')
      .where('senderId', '==', currentUser.uid)
      .get();
    sentLegacyMessages.docs.forEach(messageDoc => {
      const message = messageDoc.data();
      if (!message.directId || directChatDocs.has(message.directId)) return;
      directChatDocs.set(message.directId, {
        id: message.directId,
        data: {
          participants: message.participants || message.directId.split('_'),
          lastMessageTime: message.timestamp,
          status: 'active'
        }
      });
    });
  } catch (error) {
    console.warn('Could not load sent legacy chats:', error);
  }

  try {
    const sentAccepted = await db.collection('chatRequests')
      .where('fromUserId', '==', currentUser.uid)
      .where('status', '==', 'accepted')
      .get();
    sentAccepted.docs.forEach(requestDoc => {
      const request = requestDoc.data();
      if (!request.toUserId) return;
      const chatId = getDirectChatId(currentUser.uid, request.toUserId);
      if (directChatDocs.has(chatId)) return;
      directChatDocs.set(chatId, {
        id: chatId,
        data: {
          participants: [currentUser.uid, request.toUserId],
          lastMessageTime: request.respondedAt || request.createdAt,
          status: 'active'
        }
      });
    });

    const receivedAccepted = await db.collection('chatRequests')
      .where('toUserId', '==', currentUser.uid)
      .where('status', '==', 'accepted')
      .get();
    receivedAccepted.docs.forEach(requestDoc => {
      const request = requestDoc.data();
      if (!request.fromUserId) return;
      const chatId = getDirectChatId(currentUser.uid, request.fromUserId);
      if (directChatDocs.has(chatId)) return;
      directChatDocs.set(chatId, {
        id: chatId,
        data: {
          participants: [currentUser.uid, request.fromUserId],
          lastMessageTime: request.respondedAt || request.createdAt,
          status: 'active'
        }
      });
    });
  } catch (error) {
    console.warn('Could not load accepted request chats:', error);
  }

  const items = [getSavedMessagesItem()];

  for (const chat of directChatDocs.values()) {
    const chatData = chat.data;
    if (chatData.status && chatData.status !== 'active') continue;
    if (archivedChatIds.has(chat.id)) continue;
    if (deletedChatIds.has(chat.id)) continue;
    const participants = chatData.participants || chat.id.split('_');
    const otherUserId = participants.find(id => id !== currentUser.uid);
    if (!otherUserId || isBlocked(otherUserId)) continue;
    const fallbackName = chatData.participantNames?.[otherUserId] || 'Unknown contact';
    const userDoc = await db.collection('users').doc(otherUserId).get();
    const profileMatch = userDoc.exists ? null : findProfileByFallbackName(fallbackName);
    const resolvedUserId = userDoc.exists ? otherUserId : (profileMatch?.id || otherUserId);
    const userData = userDoc.exists ? userDoc.data() : (profileMatch || {});
    if ((userDoc.exists || profileMatch) && userData.isActive === false) continue;
    const displayName = userData.displayName || userData.email || fallbackName;
    const onlineStatus = userData.onlineStatus || 'offline';
    const presenceText = getPresenceText(userData);
    const preview = chatData.lastMessage || 'Tap to open chat';
    items.push({
      id: chat.id,
      type: 'direct',
      name: displayName,
      avatar: userData.avatar ? `<img src="${userData.avatar}">` : escapeHtml((displayName || '?')[0].toUpperCase()),
      preview,
      unreadCount: await getChatUnreadCount(chat.id, 'direct'),
      isFavorite: favoriteChatIds.includes(chat.id),
      isMuted: isChatMuted(chat.id),
      otherUserId: resolvedUserId,
      legacyOtherUserId: resolvedUserId !== otherUserId ? otherUserId : '',
      user: { id: resolvedUserId, ...userData, displayName },
      email: userData.email || '',
      phone: userData.phone || userData.phoneNumber || '',
      hasUserProfile: userDoc.exists || !!profileMatch,
      aliasDirectIds: [chat.id],
      onlineStatus,
      presenceText,
      lastMessageTime: chatData.lastMessageTime?.toDate?.() || new Date(0)
    });
  }

  return [getSavedMessagesItem(), ...mergeDirectContactItems(items.filter(item => item.type !== 'saved'))];
}

async function buildGroupChatItems() {
  if (!currentUser) return [];
  const archivedChatIds = await getArchivedChatIds();
  const deletedChatIds = await getDeletedChatIds();
  const memberSnapshot = await db.collection('groupMembers').where('userId', '==', currentUser.uid).get();
  const items = [];

  for (const memberDoc of memberSnapshot.docs) {
    const groupId = memberDoc.data().groupId;
    if (archivedChatIds.has(groupId)) continue;
    if (deletedChatIds.has(groupId)) continue;
    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) continue;
    const group = groupDoc.data();
    items.push({
      id: groupDoc.id,
      type: 'group',
      name: group.name,
      avatar: group.icon ? `<img src="${group.icon}">` : '👥',
      preview: group.memberCount ? `${group.memberCount} members` : `Invite code ${group.code || ''}`.trim(),
      unreadCount: await getChatUnreadCount(groupDoc.id, 'group'),
      isFavorite: favoriteChatIds.includes(groupDoc.id),
      isMuted: isChatMuted(groupDoc.id),
      code: group.code || '',
      lastMessageTime: group.updatedAt?.toDate?.() || group.createdAt?.toDate?.() || new Date(0)
    });
  }

  return items;
}

function renderChatListItems(items, container) {
  container.innerHTML = '';
  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:40px;">No chats yet. Search for people or create a group.</div>';
    return;
  }

  items.forEach(item => {
    const chatDiv = document.createElement('div');
    chatDiv.className = 'list-item';
    chatDiv.dataset.chatId = item.id;
    chatDiv.dataset.chatType = item.type;
    chatDiv.dataset.unreadCount = item.unreadCount || 0;
    if (item.otherUserId || item.user?.id) chatDiv.dataset.otherUserId = item.otherUserId || item.user.id;
    chatDiv.dataset.chatName = item.name || '';
    if (currentChat?.id === item.id && (currentChatType === item.type || (item.type === 'saved' && currentChat?.isSaved))) chatDiv.classList.add('active');
    const avatarClass = '';
    const unread = item.unreadCount ? `<span class="unread-pill">${item.unreadCount}</span>` : '';
    const statusChip = item.requestState ? `<span class="status-chip ${item.requestState.status}">${escapeHtml(item.requestState.label)}</span>` : '';
    chatDiv.innerHTML = `
      <div class="list-avatar ${avatarClass}">${item.avatar}</div>
      <div class="list-info" style="flex:1; cursor:pointer;">
        <div class="list-name">${item.isFavorite ? '★ ' : ''}${escapeHtml(item.name)} ${item.isMuted ? '🔇' : ''}</div>
        <div class="list-preview">${escapeHtml(item.preview || '')}</div>
      </div>
      ${statusChip}
      ${unread}
      <button class="list-item-menu mute-chat-btn" data-chat-id="${item.id}" data-chat-type="${item.type}">🔇</button>
      <button class="list-item-menu archive-chat-btn" data-chat-id="${item.id}" data-chat-type="${item.type}" data-chat-name="${escapeHtml(item.name)}">📦</button>
    `;
    if (item.type === 'user' || item.type === 'saved') {
      chatDiv.querySelectorAll('.mute-chat-btn, .archive-chat-btn').forEach(btn => btn.remove());
    }
    chatDiv.querySelector('.archive-chat-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Archive "${item.name}"?`)) await archiveChat(item.id, item.type, item.name);
    });
    chatDiv.querySelector('.mute-chat-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const duration = prompt('Mute for: 8h, 1w, or always?', '8h');
      if (duration === '8h' || duration === '1w' || duration === 'always') {
        await muteChat(item.id, item.type, duration);
        loadCurrentChatList();
      }
    });
    chatDiv.addEventListener('click', () => {
      if (item.type === 'user') handleUserSelection(item.user);
      else if (item.type === 'saved') startSavedMessages();
      else if (item.type === 'group') loadGroupChat(item.id, item.name);
      else if (item.user) startDirectChat({ ...item.user, aliasDirectIds: item.aliasDirectIds });
      else db.collection('users').doc(item.otherUserId).get().then(doc => {
        startDirectChat(doc.exists ? { id: item.otherUserId, ...doc.data(), aliasDirectIds: item.aliasDirectIds } : { id: item.otherUserId, displayName: item.name, aliasDirectIds: item.aliasDirectIds });
      });
    });
    container.appendChild(chatDiv);
  });
}

async function loadAllChatsList(searchTerm = '') {
  const chatsList = document.getElementById('chatsList');
  if (!chatsList) return;
  const allItems = [...await buildDirectChatItems(), ...await buildGroupChatItems()];
  updateUnreadBadges(allItems);
  let items = [...allItems];
  if (currentViewTab === 'favorites') items = items.filter(item => item.isFavorite);
  if (currentViewTab === 'unread') items = items.filter(item => item.unreadCount > 0);
  const term = searchTerm.trim().toLowerCase();
  if (term) {
    const chatMatches = items.filter(item =>
      item.name.toLowerCase().includes(term) ||
      (item.preview || '').toLowerCase().includes(term) ||
      (item.code || '').toLowerCase().includes(term)
    );
    const existingUserIds = new Set(items.map(item => item.otherUserId).filter(Boolean));
    const existingContactKeys = new Set(items.map(item => getContactMergeKey(item)).filter(Boolean));
    const existingContactNames = new Set(items
      .filter(item => item.type === 'direct')
      .map(item => (item.name || '').trim().toLowerCase())
      .filter(Boolean));
    const userMatches = await Promise.all(searchUsersByIdentity(term)
      .filter(user => {
        const userKey = getContactMergeKey({
          type: 'direct',
          name: user.displayName || user.email,
          email: user.email,
          phone: user.phone || user.phoneNumber,
          user
        });
        const userName = (user.displayName || '').trim().toLowerCase();
        return !existingUserIds.has(user.id) &&
          !existingContactKeys.has(userKey) &&
          !existingContactNames.has(userName);
      })
      .map(async user => {
        const requestState = await getContactRequestState(user.id);
        return {
          id: `user_${user.id}`,
          type: 'user',
          name: user.displayName || user.email || 'User',
          avatar: user.avatar ? `<img src="${user.avatar}">` : escapeHtml((user.displayName || user.email || '?')[0].toUpperCase()),
          preview: user.email || user.phone || user.phoneNumber || 'Tap to send chat request',
          requestState,
          unreadCount: 0,
          isFavorite: false,
          isMuted: false,
          onlineStatus: user.onlineStatus || 'offline',
          user,
          lastMessageTime: new Date(0)
        };
      }));
    items = [...chatMatches, ...userMatches];
  }
  items.sort((a, b) => b.lastMessageTime - a.lastMessageTime || a.name.localeCompare(b.name));
  renderChatListItems(items, chatsList);
}

function loadCurrentChatList() {
  if (currentViewTab === 'groups') loadGroupsList();
  else loadAllChatsList(document.getElementById('searchInput')?.value || '');
}

async function refreshUnreadSummary() {
  if (!currentUser) return;
  const items = [...await buildDirectChatItems(), ...await buildGroupChatItems()];
  updateUnreadBadges(items);
}

// ========================================
// LOAD CHATS LIST
// ========================================

async function loadChatsList() {
  if (!currentUser) return;
  const chatsList = document.getElementById('chatsList');
  if (!chatsList) return;
  const activeChats = [];
  const archivedChatIds = await getArchivedChatIds();
  const deletedChatIds = await getDeletedChatIds();
  const directChats = await db.collection('directChats').where('participants', 'array-contains', currentUser.uid).get();
  for (const doc of directChats.docs) {
    if (doc.data().status && doc.data().status !== 'active') continue;
    if (archivedChatIds.has(doc.id)) continue;
    if (deletedChatIds.has(doc.id)) continue;
    const otherUserId = doc.data().participants.find(id => id !== currentUser.uid);
    if (otherUserId && !isBlocked(otherUserId)) {
      const userDoc = await db.collection('users').doc(otherUserId).get();
      if (userDoc.exists && userDoc.data().isActive !== false) {
        const userData = userDoc.data();
        const onlineStatus = userData.onlineStatus || 'offline';
        const statusText = getPresenceText(userData);
        const unreadCount = await getChatUnreadCount(doc.id, 'direct');
        const isFavorite = favoriteChatIds.includes(doc.id);
        activeChats.push({ 
          id: doc.id, 
          type: 'direct', 
          name: userData.displayName || userData.email, 
          avatar: userData.displayName?.[0] || '👤', 
          otherUserId, 
          onlineStatus,
          statusText,
          unreadCount,
          isFavorite
        });
      }
    }
  }
  if (activeChats.length === 0) { chatsList.innerHTML = '<div class="empty-state" style="padding:40px;">💬 No chats yet. Search for users!</div>'; return; }
  const filteredChats = activeChats.filter(chat => {
    if (currentViewTab === 'favorites' && !chat.isFavorite) return false;
    if (currentViewTab === 'unread' && chat.unreadCount === 0) return false;
    return true;
  });
  if (filteredChats.length === 0) {
    const message = currentViewTab === 'favorites' ? 'No favorite chats found.' : currentViewTab === 'unread' ? 'No unread chats found.' : 'No chats yet.';
    chatsList.innerHTML = `<div class="empty-state" style="padding:40px;">${message}</div>`;
    return;
  }
  chatsList.innerHTML = '';
  for (const chat of filteredChats) {
    const isMuted = isChatMuted(chat.id);
    const chatDiv = document.createElement('div');
    chatDiv.className = 'list-item';
    chatDiv.dataset.chatId = chat.id;
    chatDiv.dataset.chatType = 'direct';
    chatDiv.dataset.unreadCount = chat.unreadCount;
    chatDiv.dataset.otherUserId = chat.otherUserId;
    chatDiv.dataset.chatName = chat.name || '';
    if (currentChat?.id === chat.id && currentChatType === 'direct') chatDiv.classList.add('active');
    const avatarClass = '';
    chatDiv.innerHTML = `
      <div class="list-avatar ${avatarClass}">${chat.avatar}</div>
      <div class="list-info" style="flex:1; cursor:pointer;">
        <div class="list-name">${chat.isFavorite ? '⭐ ' : ''}${escapeHtml(chat.name)} ${isMuted ? '🔇' : ''}</div>
        <div class="list-preview">${chat.statusText}${chat.unreadCount ? ` • ${chat.unreadCount} unread` : ''}</div>
      </div>
      <button class="list-item-menu mute-chat-btn" data-chat-id="${chat.id}" data-chat-type="direct">🔇</button>
      <button class="list-item-menu archive-chat-btn" data-chat-id="${chat.id}" data-chat-type="direct" data-chat-name="${escapeHtml(chat.name)}">📦</button>
    `;
    chatDiv.querySelector('.archive-chat-btn')?.addEventListener('click', async (e) => { 
      e.stopPropagation(); 
      if (confirm(`Archive "${chat.name}"?`)) await archiveChat(chat.id, 'direct', chat.name); 
    });
    chatDiv.querySelector('.mute-chat-btn')?.addEventListener('click', async (e) => { 
      e.stopPropagation(); 
      const duration = prompt('Mute for: 8h, 1w, or always?', '8h'); 
      if (duration === '8h' || duration === '1w' || duration === 'always') { 
        await muteChat(chat.id, 'direct', duration); 
        loadChatsList(); 
      } 
    });
    chatDiv.querySelector('.list-info').onclick = () => { 
      db.collection('users').doc(chat.otherUserId).get().then(doc => { 
        if (doc.exists) startDirectChat({ id: chat.otherUserId, ...doc.data() }); 
      }); 
    };
    chatsList.appendChild(chatDiv);
  }
}

// Helper function to format time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

function formatLastSeen(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (date.toDateString() === now.toDateString()) return `last seen today at ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;
  return `last seen ${date.toLocaleDateString()} at ${time}`;
}

function getPresenceText(userData) {
  if (!userData) return '';
  const canSeePresence = !privacySettings.hideLastSeen && !userData.privacySettings?.hideLastSeen;
  if (!canSeePresence) return 'last seen hidden';
  if (userData.onlineStatus === 'online') return 'online';
  if (userData.lastSeen) return formatLastSeen(userData.lastSeen);
  return '';
}

// ========================================
// LOAD GROUPS LIST
// ========================================

async function loadGroupsList() {
  if (!currentUser) return;
  const groupsList = document.getElementById('groupsList');
  if (!groupsList) return;
  const memberSnapshot = await db.collection('groupMembers').where('userId', '==', currentUser.uid).get();
  const groups = [];
  const archivedChatIds = await getArchivedChatIds();
  const deletedChatIds = await getDeletedChatIds();
  for (const doc of memberSnapshot.docs) {
    if (archivedChatIds.has(doc.data().groupId)) continue;
    if (deletedChatIds.has(doc.data().groupId)) continue;
    const groupDoc = await db.collection('groups').doc(doc.data().groupId).get();
    if (groupDoc.exists) groups.push({ id: groupDoc.id, name: groupDoc.data().name, code: groupDoc.data().code, icon: groupDoc.data().icon });
  }
  if (groups.length === 0) { groupsList.innerHTML = '<div class="empty-state" style="padding:40px;">👥 No groups yet. Create one!</div>'; return; }
  const enhancedGroups = [];
  for (const group of groups) {
    const unreadCount = await getChatUnreadCount(group.id, 'group');
    const isFavorite = favoriteChatIds.includes(group.id);
    enhancedGroups.push({ ...group, unreadCount, isFavorite });
  }
  refreshUnreadSummary();
  const filteredGroups = enhancedGroups.filter(group => {
    if (currentViewTab === 'favorites' && !group.isFavorite) return false;
    if (currentViewTab === 'unread' && group.unreadCount === 0) return false;
    return true;
  });
  if (filteredGroups.length === 0) {
    const message = currentViewTab === 'favorites' ? 'No favorite groups found.' : currentViewTab === 'unread' ? 'No unread groups found.' : 'No groups yet.';
    groupsList.innerHTML = `<div class="empty-state" style="padding:40px;">${message}</div>`;
    return;
  }
  groupsList.innerHTML = '';
  for (const group of filteredGroups) {
    const isMuted = isChatMuted(group.id);
    const groupDiv = document.createElement('div');
    groupDiv.className = 'list-item';
    groupDiv.dataset.chatId = group.id;
    groupDiv.dataset.chatType = 'group';
    groupDiv.dataset.unreadCount = group.unreadCount;
    groupDiv.dataset.chatName = group.name || '';
    if (currentChat?.id === group.id && currentChatType === 'group') groupDiv.classList.add('active');
    groupDiv.innerHTML = `<div class="list-avatar">${group.icon ? `<img src="${group.icon}">` : '👥'}</div><div class="list-info" style="flex:1; cursor:pointer;"><div class="list-name">${group.isFavorite ? '⭐ ' : ''}${escapeHtml(group.name)} ${isMuted ? '🔇' : ''}</div><div class="list-preview">${group.code}${group.unreadCount ? ` • ${group.unreadCount} unread` : ''}</div></div><button class="list-item-menu mute-chat-btn" data-chat-id="${group.id}" data-chat-type="group">🔇</button><button class="list-item-menu archive-chat-btn" data-chat-id="${group.id}" data-chat-type="group" data-chat-name="${escapeHtml(group.name)}">📦</button>`;
    if (group.unreadCount) {
      groupDiv.insertAdjacentHTML('beforeend', `<span class="unread-pill">${group.unreadCount}</span>`);
    }
    groupDiv.querySelector('.archive-chat-btn')?.addEventListener('click', async (e) => { e.stopPropagation(); if (confirm(`Archive group "${group.name}"?`)) await archiveChat(group.id, 'group', group.name); });
    groupDiv.querySelector('.mute-chat-btn')?.addEventListener('click', async (e) => { e.stopPropagation(); const duration = prompt('Mute for: 8h, 1w, or always?', '8h'); if (duration === '8h' || duration === '1w' || duration === 'always') { await muteChat(group.id, 'group', duration); loadGroupsList(); } });
    groupDiv.querySelector('.list-info').onclick = () => loadGroupChat(group.id, group.name);
    groupsList.appendChild(groupDiv);
  }
}

// ========================================
// START DIRECT CHAT
// ========================================

async function startSavedMessages() {
  const chatId = getSavedMessagesChatId();
  if (!chatId) return;
  const chatRef = db.collection('directChats').doc(chatId);
  const chatDoc = await chatRef.get();
  if (!chatDoc.exists) {
    await chatRef.set({
      participants: [currentUser.uid],
      status: 'active',
      saved: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  currentChat = {
    id: chatId,
    otherUserId: currentUser.uid,
    otherUserName: 'Saved Messages',
    type: 'direct',
    isSaved: true,
    aliasDirectIds: [chatId]
  };
  currentChatType = 'direct';
  document.getElementById('currentChatName').textContent = 'Saved Messages';
  document.getElementById('chatStatus').textContent = 'Private notes, files, and reminders';
  setChatHeaderAvatar('&#9733;');
  document.getElementById('inputArea').style.display = 'flex';
  document.getElementById('groupInfoBtn').style.display = 'none';
  document.getElementById('voiceCallBtn').style.display = 'none';
  document.getElementById('videoCallBtn').style.display = 'none';
  document.getElementById('replyPreviewBar').style.display = 'none';
  currentReplyTo = null;
  loadMessages();
  loadPinnedMessages();
  applyCurrentChatWallpaper();
  openMobileChatPanel();
  loadCurrentChatList();
}

async function startDirectChat(user) {
  if (isBlocked(user.id)) { showToast('You have blocked this user.', 'error'); return; }
  const chatId = getDirectChatId(currentUser.uid, user.id);
  let chatDoc = await db.collection('directChats').doc(chatId).get();
  if (!chatDoc.exists) {
    await db.collection('directChats').doc(chatId).set({
      participants: [currentUser.uid, user.id], status: 'active',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  currentChat = {
    id: chatId,
    otherUserId: user.id,
    otherUserName: user.displayName || user.email,
    type: 'direct',
    aliasDirectIds: [...new Set([chatId, ...(user.aliasDirectIds || [])])]
  };
  currentChatType = 'direct';
  document.getElementById('currentChatName').textContent = user.displayName || user.email;
  document.getElementById('chatStatus').textContent = getPresenceText(user);
  setChatHeaderAvatar(user.avatar ? `<img src="${user.avatar}">` : escapeHtml((user.displayName || user.email || '?')[0].toUpperCase()));
  document.getElementById('inputArea').style.display = 'flex';
  document.getElementById('groupInfoBtn').style.display = 'none';
  document.getElementById('voiceCallBtn').style.display = 'inline-flex';
  document.getElementById('videoCallBtn').style.display = 'inline-flex';
  document.getElementById('replyPreviewBar').style.display = 'none';
  currentReplyTo = null;
  loadMessages();
  listenForTypingIndicator();
  loadPinnedMessages();
  applyCurrentChatWallpaper();
  openMobileChatPanel();
  loadCurrentChatList();
}

// ========================================
// GROUP FUNCTIONS
// ========================================

async function createGroup(groupName, memberEmails = '') {
  if (!groupName.trim()) return;
  const adminsOnlySend = !!document.getElementById('newGroupAdminsOnlySend')?.checked;
  const groupCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  const invitedUsers = [];
  if (memberEmails.trim()) {
    const entries = memberEmails.split(',').map(entry => entry.trim()).filter(Boolean);
    for (const entry of entries) {
      const matchedUser = findUserByMemberInput(entry);
      if (matchedUser && !invitedUsers.some(user => user.id === matchedUser.id) && !isBlocked(matchedUser.id)) {
        invitedUsers.push(matchedUser);
      }
    }
  }
  const groupRef = await db.collection('groups').add({
    name: groupName.trim(), code: groupCode, createdBy: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(), memberCount: 1,
    onlyAdminsCanSend: adminsOnlySend,
    onlyAdminsCanEdit: true
  });
  await db.collection('groupMembers').add({
    groupId: groupRef.id, userId: currentUser.uid, role: 'admin',
    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  for (const user of invitedUsers) {
    await sendGroupInvite(groupRef.id, groupName.trim(), user);
  }
  showToast(invitedUsers.length ? `Group created. ${invitedUsers.length} invite sent.` : `Group "${groupName}" created! Code: ${groupCode}`);
  loadGroupsList();
  return groupRef.id;
}

async function sendGroupInvite(groupId, groupName, user) {
  if (!currentUser || !groupId || !user?.id) return;
  const memberExists = await db.collection('groupMembers')
    .where('groupId', '==', groupId)
    .where('userId', '==', user.id)
    .limit(1)
    .get();
  if (!memberExists.empty) {
    showToast(`${user.displayName || user.email} is already in the group`);
    return;
  }

  const existingInvite = await db.collection('groupInvites')
    .where('groupId', '==', groupId)
    .where('toUserId', '==', user.id)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (!existingInvite.empty) {
    showToast(`Invite already sent to ${user.displayName || user.email}`);
    return;
  }

  await db.collection('groupInvites').add({
    groupId,
    groupName,
    fromUserId: currentUser.uid,
    fromUserName: currentUser.displayName || currentUser.email.split('@')[0],
    toUserId: user.id,
    toUserName: user.displayName || user.email,
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast(`Invite sent to ${user.displayName || user.email}`);
}

async function loadGroupChat(groupId, groupName) {
  const groupDoc = await db.collection('groups').doc(groupId).get();
  currentChat = { id: groupId, name: groupName, type: 'group' };
  currentChatType = 'group';
  const groupData = groupDoc.data() || {};
  currentGroup = { id: groupId, name: groupName, icon: groupData.icon, ...groupData };
  document.getElementById('currentChatName').textContent = groupName;
  document.getElementById('chatStatus').textContent = 'Group Chat';
  setChatHeaderAvatar(groupData.icon ? `<img src="${groupData.icon}">` : '👥');
  document.getElementById('inputArea').style.display = 'flex';
  document.getElementById('groupInfoBtn').style.display = 'block';
  document.getElementById('voiceCallBtn').style.display = 'none';
  document.getElementById('videoCallBtn').style.display = 'none';
  document.getElementById('replyPreviewBar').style.display = 'none';
  currentReplyTo = null;
  await loadGroupMembers(groupId);
  const inputArea = document.getElementById('inputArea');
  const canSend = !currentGroup.onlyAdminsCanSend || isCurrentUserGroupAdmin();
  if (inputArea) inputArea.style.display = canSend ? 'flex' : 'none';
  if (!canSend) showToast('Only admins can send messages in this group');
  loadMessages();
  listenForTypingIndicator();
  loadPinnedMessages();
  applyCurrentChatWallpaper();
  openMobileChatPanel();
  loadCurrentChatList();
}

async function loadGroupMembers(groupId) {
  const membersSnapshot = await db.collection('groupMembers').where('groupId', '==', groupId).get();
  currentGroupMembers = [];
  for (const doc of membersSnapshot.docs) {
    const userDoc = await db.collection('users').doc(doc.data().userId).get();
    if (userDoc.exists && !isBlocked(userDoc.id) && userDoc.data().isActive !== false) {
      currentGroupMembers.push({
        id: userDoc.id, name: userDoc.data().displayName || userDoc.data().email,
        role: doc.data().role, avatar: userDoc.data().avatar
      });
    }
  }
  return currentGroupMembers;
}

function isCurrentUserGroupAdmin() {
  return currentGroupMembers.some(member => member.id === currentUser?.uid && member.role === 'admin');
}

async function showGroupInfo() {
  if (!currentGroup) return;
  const groupDoc = await db.collection('groups').doc(currentGroup.id).get();
  const group = groupDoc.data();
  document.getElementById('groupInfoTitle').textContent = group.name;
  document.getElementById('groupAvatarLarge').innerHTML = group.icon ? `<img src="${group.icon}">` : '👥';
  document.getElementById('editGroupNameInput').value = group.name;
  document.getElementById('groupCodeDisplay').textContent = group.code;
  
  const currentUserRole = currentGroupMembers.find(m => m.id === currentUser.uid)?.role;
  const isAdmin = currentUserRole === 'admin';
  const canEditInfo = isAdmin && group.onlyAdminsCanEdit !== false;
  document.getElementById('addMemberBtn').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('addMemberEmail').style.display = isAdmin ? 'inline-block' : 'none';
  document.getElementById('deleteGroupBtn').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('editGroupNameInput').disabled = !canEditInfo;
  document.getElementById('groupAvatarLarge').style.pointerEvents = canEditInfo ? 'auto' : 'none';
  document.getElementById('groupSendPermissionRow').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('groupEditPermissionRow').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('groupAdminsOnlySend').checked = !!group.onlyAdminsCanSend;
  document.getElementById('groupAdminsOnlyEdit').checked = group.onlyAdminsCanEdit !== false;
  
  const membersList = document.getElementById('groupMembersList');
  membersList.innerHTML = '';
  for (const member of currentGroupMembers) {
    const isMemberAdmin = member.role === 'admin';
    const isCurrentUser = member.id === currentUser.uid;
    const canModify = isAdmin && !isCurrentUser;
    const memberDiv = document.createElement('div');
    memberDiv.className = 'member-item';
    memberDiv.innerHTML = `<div class="member-info"><div class="member-avatar">${member.avatar ? `<img src="${member.avatar}" style="width:36px;height:36px;border-radius:50%;">` : (member.name?.[0]?.toUpperCase() || '👤')}</div><div><span>${escapeHtml(member.name)}</span>${isMemberAdmin ? '<span style="font-size:10px; color:#667eea; margin-left:8px;">Admin</span>' : ''}${isCurrentUser ? '<span style="font-size:10px; color:#888; margin-left:8px;">You</span>' : ''}</div></div>${canModify ? `<div class="member-actions">${!isMemberAdmin ? `<button class="make-admin-btn" data-id="${member.id}" data-name="${escapeHtml(member.name)}">👑</button>` : ''}<button class="remove-member-btn" data-id="${member.id}" data-name="${escapeHtml(member.name)}">❌</button></div>` : ''}`;
    membersList.appendChild(memberDiv);
  }
  await renderPendingGroupInvites(currentGroup.id, membersList, isAdmin);
  document.querySelectorAll('.make-admin-btn').forEach(btn => { btn.addEventListener('click', () => makeAdmin(currentGroup.id, btn.dataset.id, btn.dataset.name)); });
  document.querySelectorAll('.remove-member-btn').forEach(btn => { btn.addEventListener('click', () => removeMember(currentGroup.id, btn.dataset.id, btn.dataset.name)); });
  document.getElementById('groupInfoModal').style.display = 'flex';
}

async function showChatInfo() {
  if (!currentChat) return;
  if (currentChatType === 'group') {
    await showGroupInfo();
    return;
  }

  const modal = document.getElementById('chatInfoModal');
  if (!modal) return;
  const userDoc = currentChat.otherUserId ? await db.collection('users').doc(currentChat.otherUserId).get() : null;
  const user = userDoc?.exists ? userDoc.data() : {};
  const displayName = user.displayName || currentChat.otherUserName || 'Contact';
  const avatar = user.avatar ? `<img src="${user.avatar}">` : escapeHtml((displayName || '?')[0].toUpperCase());

  document.getElementById('chatInfoAvatar').innerHTML = avatar;
  document.getElementById('chatInfoName').textContent = displayName;
  document.getElementById('chatInfoPresence').textContent = getPresenceText(user) || 'No status';
  document.getElementById('chatInfoDetails').innerHTML = `
    <div class="chat-info-detail-row"><span>Email</span><strong>${escapeHtml(user.email || 'Not available')}</strong></div>
    <div class="chat-info-detail-row"><span>Phone</span><strong>${escapeHtml(user.phone || user.phoneNumber || 'Not set')}</strong></div>
    <div class="chat-info-detail-row"><span>About</span><strong>${escapeHtml(user.statusText || 'Hey there! I am using Team Chat')}</strong></div>
  `;

  document.getElementById('chatInfoMuteBtn').onclick = async () => {
    await muteChat(currentChat.id, 'direct', '8h');
    showToast('Muted for 8 hours');
  };
  document.getElementById('chatInfoWallpaperBtn').onclick = () => openWallpaperModal('current');
  document.getElementById('chatInfoBlockBtn').onclick = async () => {
    if (!confirm(`Block ${displayName}?`)) return;
    await blockUser(currentChat.otherUserId, displayName);
    await loadBlockedUsers();
    modal.style.display = 'none';
    loadCurrentChatList();
    showToast(`${displayName} blocked`);
  };

  modal.style.display = 'flex';
  await renderSharedContent('media');
}

async function renderSharedContent(type) {
  const container = document.getElementById('sharedContent');
  if (!container || !currentChat) return;
  document.querySelectorAll('.shared-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.sharedTab === type);
  });
  container.innerHTML = '<div class="empty-state" style="padding:18px;">Loading...</div>';
  let messages = [];
  try {
    messages = currentChatType === 'direct'
      ? await getCurrentDirectMessages()
      : (await db.collection('messages').where('groupId', '==', currentChat.id).limit(80).get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    container.innerHTML = '<div class="empty-state" style="padding:18px;">Unable to load shared items</div>';
    console.warn('Unable to load shared items:', error);
    return;
  }
  messages.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));

  if (type === 'media') {
    const media = messages.filter(message => message.attachment?.type === 'image');
    if (!media.length) {
      container.innerHTML = '<div class="empty-state" style="padding:18px;">No media shared yet</div>';
      return;
    }
    container.innerHTML = `<div class="shared-grid">${media.map(message => `<a class="shared-media-item" href="${message.attachment.url}" target="_blank"><img src="${message.attachment.url}" alt="${escapeHtml(message.attachment.filename || 'Shared image')}"></a>`).join('')}</div>`;
    return;
  }

  if (type === 'docs') {
    const docs = messages.filter(message => message.attachment && message.attachment.type !== 'image' && message.attachment.type !== 'voice');
    if (!docs.length) {
      container.innerHTML = '<div class="empty-state" style="padding:18px;">No documents shared yet</div>';
      return;
    }
    container.innerHTML = docs.map(message => `<a class="shared-list-item" href="${message.attachment.url}" target="_blank"><strong>${escapeHtml(message.attachment.filename || 'Document')}</strong><br><span>${formatBytes(message.attachment.size)}</span></a>`).join('');
    return;
  }

  const links = messages.flatMap(message => extractLinks(message.text).map(url => ({ url, senderName: message.senderName })));
  if (!links.length) {
    container.innerHTML = '<div class="empty-state" style="padding:18px;">No links shared yet</div>';
    return;
  }
  container.innerHTML = links.map(link => `<a class="shared-list-item" href="${link.url}" target="_blank"><strong>${escapeHtml(link.url)}</strong><br><span>${escapeHtml(link.senderName || '')}</span></a>`).join('');
}

async function loadStatusList() {
  const statusList = document.getElementById('statusList');
  if (!statusList || !currentUser) return;
  statusList.innerHTML = '<div class="empty-state" style="padding:24px;">Loading status...</div>';
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let statuses = [];
  const withTimeout = (promise, ms = 5000) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Status load timeout')), ms))
  ]);
  try {
    const snapshot = await withTimeout(db.collection('statuses').where('expiresAt', '>', new Date()).get());
    statuses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    try {
      const snapshot = await withTimeout(db.collection('statuses').get());
      statuses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(status => (status.createdAt?.toMillis?.() || 0) >= cutoff);
    } catch (fallbackError) {
      statusList.innerHTML = '<div class="empty-state" style="padding:24px;">Unable to load status updates. Publish Firebase rules and try again.</div>';
      return;
    }
  }
  statuses.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  if (!statuses.length) {
    statusList.innerHTML = '<div class="empty-state" style="padding:24px;">No status updates</div>';
    return;
  }
  const byUser = new Map();
  statuses.forEach(status => {
    if (!byUser.has(status.userId)) byUser.set(status.userId, []);
    byUser.get(status.userId).push(status);
  });
  statusList.innerHTML = '';
  for (const userStatuses of byUser.values()) {
    const latest = userStatuses[0];
    const item = document.createElement('div');
    item.className = 'list-item';
    item.dataset.statusId = latest.id;
    const viewedAll = userStatuses.every(status => status.viewedBy?.[currentUser.uid] || status.userId === currentUser.uid);
    item.innerHTML = `
      <div class="list-avatar ${viewedAll ? 'offline' : 'online'}">${latest.userAvatar ? `<img src="${latest.userAvatar}">` : escapeHtml((latest.userName || '?')[0].toUpperCase())}</div>
      <div class="list-info">
        <div class="list-name">${latest.userId === currentUser.uid ? 'My status' : escapeHtml(latest.userName || 'Status')}</div>
        <div class="list-preview">${formatTime(latest.createdAt)}${userStatuses.length > 1 ? ` · ${userStatuses.length} updates` : ''}</div>
      </div>
    `;
    item.addEventListener('click', () => showStatusViewer(userStatuses, 0));
    statusList.appendChild(item);
  }
}

async function publishStatus() {
  const text = document.getElementById('statusTextInput')?.value.trim() || '';
  if (!text && !statusImageAttachment) {
    showToast('Add text or an image', 'error');
    return;
  }
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const user = userDoc.exists ? userDoc.data() : {};
  await db.collection('statuses').add({
    userId: currentUser.uid,
    userName: user.displayName || currentUser.displayName || currentUser.email,
    userAvatar: user.avatar || currentUser.photoURL || '',
    text,
    image: statusImageAttachment,
    viewedBy: { [currentUser.uid]: new Date() },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });
  statusImageAttachment = null;
  document.getElementById('statusTextInput').value = '';
  document.getElementById('statusImagePreview').style.display = 'none';
  document.getElementById('createStatusModal').style.display = 'none';
  showToast('Status published');
  loadStatusList();
}

async function showStatusViewer(statuses, index = 0) {
  const status = statuses[index];
  if (!status) return;
  const modal = document.getElementById('statusViewerModal');
  document.getElementById('statusViewerAvatar').innerHTML = status.userAvatar ? `<img src="${status.userAvatar}">` : escapeHtml((status.userName || '?')[0].toUpperCase());
  document.getElementById('statusViewerName').textContent = status.userId === currentUser.uid ? 'My status' : (status.userName || 'Status');
  document.getElementById('statusViewerTime').textContent = formatLastSeen(status.createdAt).replace('last seen ', '');
  document.getElementById('statusViewerBody').innerHTML = status.image
    ? `<img src="${status.image.url}" alt="Status image">`
    : `<div class="status-viewer-text">${escapeHtml(status.text || '')}</div>`;
  if (status.image && status.text) {
    document.getElementById('statusViewerBody').insertAdjacentHTML('beforeend', `<div class="status-viewer-text" style="position:absolute;bottom:58px;left:18px;right:18px;font-size:22px;">${escapeHtml(status.text)}</div>`);
  }
  const seenCount = Object.keys(status.viewedBy || {}).filter(id => id !== status.userId).length;
  document.getElementById('statusViewerSeen').textContent = status.userId === currentUser.uid ? `${seenCount} viewed` : 'Tap status list to view updates';
  modal.style.display = 'flex';
  if (status.userId !== currentUser.uid && !status.viewedBy?.[currentUser.uid]) {
    await db.collection('statuses').doc(status.id).update({
      [`viewedBy.${currentUser.uid}`]: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function renderPendingGroupInvites(groupId, membersList, isAdmin) {
  const pendingSnapshot = await db.collection('groupInvites')
    .where('groupId', '==', groupId)
    .where('status', '==', 'pending')
    .get();
  if (pendingSnapshot.empty) return;

  const header = document.createElement('div');
  header.className = 'member-section-label';
  header.textContent = 'Pending invites';
  membersList.appendChild(header);

  pendingSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.toUserName || '').localeCompare(b.toUserName || ''))
    .forEach(invite => {
      const inviteDiv = document.createElement('div');
      inviteDiv.className = 'member-item pending';
      inviteDiv.innerHTML = `
        <div class="member-info">
          <div class="member-avatar">${escapeHtml((invite.toUserName || '?')[0].toUpperCase())}</div>
          <div>
            <span>${escapeHtml(invite.toUserName || 'Invited user')}</span>
            <span class="status-chip pending">Invite pending</span>
          </div>
        </div>
        ${isAdmin ? `<button class="cancel-invite-btn" data-id="${invite.id}">Cancel</button>` : ''}
      `;
      membersList.appendChild(inviteDiv);
    });

  membersList.querySelectorAll('.cancel-invite-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await cancelGroupInvite(btn.dataset.id);
    });
  });
}

async function cancelGroupInvite(inviteId) {
  if (!inviteId) return;
  await db.collection('groupInvites').doc(inviteId).update({
    status: 'cancelled',
    respondedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast('Invite cancelled');
  showGroupInfo();
}

async function makeAdmin(groupId, memberId, memberName) {
  if (!confirm(`Make ${memberName} an admin?`)) return;
  const memberDoc = await db.collection('groupMembers').where('groupId', '==', groupId).where('userId', '==', memberId).get();
  memberDoc.forEach(doc => doc.ref.update({ role: 'admin' }));
  showToast(`${memberName} is now an admin`);
  await loadGroupMembers(groupId);
  showGroupInfo();
}

async function removeMember(groupId, memberId, memberName) {
  if (!confirm(`Remove ${memberName} from the group?`)) return;
  await db.collection('groupMembers').where('groupId', '==', groupId).where('userId', '==', memberId).get().then(snapshot => snapshot.forEach(doc => doc.ref.delete()));
  await db.collection('groups').doc(groupId).update({ memberCount: firebase.firestore.FieldValue.increment(-1) });
  showToast(`${memberName} removed from group`);
  await loadGroupMembers(groupId);
  showGroupInfo();
  if (memberId === currentUser.uid) {
    currentChat = null;
    document.getElementById('messagesArea').innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>Select a chat to start messaging</p></div>';
    document.getElementById('inputArea').style.display = 'none';
  }
  loadGroupsList();
}

async function addMemberToGroup(email) {
  if (!email.trim()) return;
  if (!isCurrentUserGroupAdmin()) { showToast('Only admins can invite members', 'error'); return; }
  const matchedUser = findUserByMemberInput(email);
  if (!matchedUser) { showToast('User not found', 'error'); return; }
  const newMemberId = matchedUser.id;
  if (isBlocked(newMemberId)) { showToast('Cannot add blocked user', 'error'); return; }
  const existing = await db.collection('groupMembers').where('groupId', '==', currentGroup.id).where('userId', '==', newMemberId).get();
  if (!existing.empty) { showToast('User already in group', 'error'); return; }
  await sendGroupInvite(currentGroup.id, currentGroup.name, matchedUser);
  await loadGroupMembers(currentGroup.id);
  showGroupInfo();
}

async function updateGroupName(newName) {
  if (!newName.trim()) return;
  if (!isCurrentUserGroupAdmin() || currentGroup?.onlyAdminsCanEdit === false) { showToast('Only admins can edit group info', 'error'); return; }
  await db.collection('groups').doc(currentGroup.id).update({ name: newName.trim() });
  showToast('Group name updated');
  if (currentChat?.id === currentGroup.id) document.getElementById('currentChatName').textContent = newName;
  loadGroupsList();
}

async function updateGroupIcon(file) {
  if (!isCurrentUserGroupAdmin() || currentGroup?.onlyAdminsCanEdit === false) { showToast('Only admins can edit group info', 'error'); return; }
  const url = await uploadToCloudinary(file);
  await db.collection('groups').doc(currentGroup.id).update({ icon: url });
  showToast('Group icon updated');
  if (currentChat?.id === currentGroup.id && currentGroup) currentGroup.icon = url;
  loadGroupsList();
  showGroupInfo();
}

async function leaveGroup() {
  if (!confirm(`Are you sure you want to leave "${currentGroup.name}"?`)) return;
  await db.collection('groupMembers').where('groupId', '==', currentGroup.id).where('userId', '==', currentUser.uid).get().then(snapshot => snapshot.forEach(doc => doc.ref.delete()));
  await db.collection('groups').doc(currentGroup.id).update({ memberCount: firebase.firestore.FieldValue.increment(-1) });
  showToast('You left the group');
  if (currentChat?.id === currentGroup.id) {
    currentChat = null;
    document.getElementById('messagesArea').innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>Select a chat to start messaging</p></div>';
    document.getElementById('inputArea').style.display = 'none';
  }
  loadGroupsList();
  loadChatsList();
}

async function deleteGroup() {
  if (!confirm(`WARNING: Delete "${currentGroup.name}" permanently for EVERYONE? This cannot be undone.`)) return;
  const messages = await db.collection('messages').where('groupId', '==', currentGroup.id).get();
  for (const doc of messages.docs) await doc.ref.delete();
  const members = await db.collection('groupMembers').where('groupId', '==', currentGroup.id).get();
  for (const doc of members.docs) await doc.ref.delete();
  await db.collection('groups').doc(currentGroup.id).delete();
  showToast('Group deleted');
  if (currentChat?.id === currentGroup.id) {
    currentChat = null;
    document.getElementById('messagesArea').innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>Select a chat to start messaging</p></div>';
    document.getElementById('inputArea').style.display = 'none';
  }
  loadGroupsList();
  loadChatsList();
}

async function joinGroup(groupCode) {
  if (!groupCode.trim()) return;
  const groupsQuery = await db.collection('groups').where('code', '==', groupCode.trim().toUpperCase()).limit(1).get();
  if (groupsQuery.empty) { showToast('Group not found', 'error'); return; }
  const group = groupsQuery.docs[0];
  const existing = await db.collection('groupMembers').where('groupId', '==', group.id).where('userId', '==', currentUser.uid).get();
  if (!existing.empty) { showToast('Already a member', 'error'); return; }
  await db.collection('groupMembers').add({ groupId: group.id, userId: currentUser.uid, role: 'member', joinedAt: firebase.firestore.FieldValue.serverTimestamp() });
  await db.collection('groups').doc(group.id).update({ memberCount: firebase.firestore.FieldValue.increment(1) });
  showToast(`Joined "${group.data().name}"!`);
  loadGroupsList();
}

// ========================================
// LOAD MESSAGES
// ========================================

async function markMessagesAsRead() {
  if (!currentChat || privacySettings.hideReadReceipts) return;
  if (currentChatType === 'direct') {
    const directIds = currentChat.aliasDirectIds?.length ? currentChat.aliasDirectIds : [currentChat.id];
    for (const directId of directIds) {
      const snapshot = await db.collection('messages')
        .where('directId', '==', directId)
        .where('senderId', '!=', currentUser.uid)
        .get();
      const batch = db.batch();
      let hasWrites = false;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.readBy?.[currentUser.uid]) return;
        batch.update(doc.ref, {
          read: true,
          [`readBy.${currentUser.uid}`]: firebase.firestore.FieldValue.serverTimestamp()
        });
        hasWrites = true;
      });
      if (hasWrites) {
        await batch.commit();
        scheduleChatListRefresh();
      }
    }
    return;
  }

  const query = db.collection('messages').where('groupId', '==', currentChat.id).where('senderId', '!=', currentUser.uid);
  const snapshot = await query.get();
  const batch = db.batch();
  let hasWrites = false;
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.readBy?.[currentUser.uid]) return;
    batch.update(doc.ref, {
      read: true,
      [`readBy.${currentUser.uid}`]: firebase.firestore.FieldValue.serverTimestamp()
    });
    hasWrites = true;
  });
  if (hasWrites) {
    await batch.commit();
    scheduleChatListRefresh();
  }
}

function getMessageReceiptHtml(msg, isMyMessage) {
  if (!isMyMessage || privacySettings.hideReadReceipts) return '';
  if (currentChat?.isSaved) return '';
  if (msg.failed) return '<span class="message-status failed">failed</span>';
  if (msg.pending) return '<span class="message-status">sending</span>';
  const readBy = msg.readBy || {};
  const readerIds = Object.keys(readBy).filter(id => id !== currentUser.uid);
  const otherParticipants = currentChatType === 'group'
    ? currentGroupMembers.filter(member => member.id !== currentUser.uid).map(member => member.id)
    : [currentChat?.otherUserId].filter(Boolean);
  const allSeen = otherParticipants.length > 0 && otherParticipants.every(userId => readBy[userId]);
  const isSeen = msg.read || allSeen || (currentChatType === 'direct' && readerIds.length > 0);
  const isDelivered = !!msg.timestamp || readerIds.length > 0;
  if (isSeen) return '<span class="read-receipt seen" title="Seen">✓✓</span>';
  if (isDelivered) return '<span class="read-receipt delivered" title="Delivered">✓✓</span>';
  return '<span class="read-receipt sent" title="Sent">✓</span>';
}

function loadMessages() {
  if (!currentChat) return;
  const messagesArea = document.getElementById('messagesArea');
  if (messagesUnsubscribe) messagesUnsubscribe();

  if (currentChatType === 'direct' && currentChat.aliasDirectIds?.length > 1) {
    const directIds = currentChat.aliasDirectIds;
    const messageDocs = new Map();
    const unsubscribers = directIds.map(directId => db.collection('messages')
      .where('directId', '==', directId)
      .orderBy('timestamp', 'asc')
      .onSnapshot(async snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'removed') messageDocs.delete(change.doc.id);
          else messageDocs.set(change.doc.id, change.doc);
        });
        await renderMessageSnapshotDocs([...messageDocs.values()], messagesArea);
      }));
    messagesUnsubscribe = () => unsubscribers.forEach(unsubscribe => unsubscribe());
    return;
  }

  let query;
  if (currentChatType === 'direct') {
    query = db.collection('messages').where('directId', '==', currentChat.id).orderBy('timestamp', 'asc');
  } else {
    query = db.collection('messages').where('groupId', '==', currentChat.id).orderBy('timestamp', 'asc');
  }
  messagesUnsubscribe = query.onSnapshot(async snapshot => {
    if (!messagesArea) return;
    messagesArea.innerHTML = '';
    if (snapshot.empty) { messagesArea.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>No messages yet. Say hello!</p></div>'; return; }
    for (const doc of snapshot.docs) {
      const msg = doc.data();
      if (msg.deletedFor?.[currentUser.uid]) continue;
      if (isBlocked(msg.senderId)) continue;
      const isMyMessage = msg.senderId === currentUser.uid;
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${isMyMessage ? 'my-message' : ''}`;
      if (msg.type === 'call') {
        messageDiv.className = 'message call-message';
        messageDiv.dataset.messageId = doc.id;
        messageDiv.innerHTML = renderCallMessage(msg);
        messagesArea.appendChild(messageDiv);
        continue;
      }
      if (msg.deletedForEveryone) messageDiv.classList.add('deleted');
      if (msg.failed) messageDiv.classList.add('failed');
      messageDiv.dataset.messageId = doc.id;
      let attachmentHtml = '';
      if (msg.attachment) {
        if (msg.attachment.type === 'image') {
          attachmentHtml = `<div class="message-attachment"><img src="${msg.attachment.url}" style="max-width:200px; max-height:200px; border-radius:12px; cursor:pointer;" onclick="window.open('${msg.attachment.url}','_blank')"></div>`;
        } else if (msg.attachment.type === 'voice') {
          attachmentHtml = `<div class="voice-message"><button class="voice-play-btn" data-url="${msg.attachment.url}">▶️</button><div class="voice-waveform"></div><span class="voice-duration">${Math.floor(msg.attachment.duration / 60)}:${(msg.attachment.duration % 60).toString().padStart(2, '0')}</span></div>`;
        } else {
          attachmentHtml = `<div class="message-attachment"><a href="${msg.attachment.url}" target="_blank">📎 Download</a></div>`;
        }
      }
      let replyHtml = '';
      if (msg.replyTo) {
        replyHtml = `<div class="reply-preview"><div class="reply-sender">↩️ Replying to ${escapeHtml(msg.replyTo.senderName)}</div><div class="reply-text">${escapeHtml(msg.replyTo.text ? msg.replyTo.text.substring(0, 50) : 'Media')}</div></div>`;
      }
      attachmentHtml = msg.attachment ? renderAttachment(msg.attachment) : '';
      const messageText = msg.deletedForEveryone ? 'This message was deleted' : (msg.text || '');
      const messageTextHtml = msg.deletedForEveryone ? escapeHtml(messageText) : renderMessageText(messageText, msg.mentions || []);
      const pollHtml = !msg.deletedForEveryone && msg.type === 'poll' ? renderPollMessage(doc.id, msg) : '';
      if (msg.deletedForEveryone) attachmentHtml = '';
      messageDiv.innerHTML = `<div class="message-bubble">${!isMyMessage ? `<div class="message-sender">${escapeHtml(msg.senderName)}</div>` : ''}${replyHtml}${messageText ? `<div class="message-text">${messageTextHtml}</div>` : ''}${pollHtml}${attachmentHtml}<div class="message-footer"><span class="message-time">${msg.timestamp ? formatTime(msg.timestamp) : ''}</span>${getMessageReceiptHtml(msg, isMyMessage)}</div></div>`;
      const reactionsContainer = document.createElement('div');
      messageDiv.querySelector('.message-bubble').appendChild(reactionsContainer);
      await loadReactions(doc.id, reactionsContainer);
      messageDiv.addEventListener('contextmenu', (e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, doc.id, msg, isMyMessage); });
      messagesArea.appendChild(messageDiv);
    }
    bindRenderedMessageActions();
    messagesArea.scrollTop = messagesArea.scrollHeight;
    markMessagesAsRead();
  });
}

async function renderMessageSnapshotDocs(docs, messagesArea) {
  if (!messagesArea) return;
  messagesArea.innerHTML = '';
  const sortedDocs = [...docs].sort((a, b) => {
    const aTime = a.data().timestamp?.toMillis?.() || 0;
    const bTime = b.data().timestamp?.toMillis?.() || 0;
    return aTime - bTime;
  });
  if (sortedDocs.length === 0) {
    messagesArea.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>No messages yet. Say hello!</p></div>';
    return;
  }
  for (const doc of sortedDocs) {
    const msg = doc.data();
    if (msg.deletedFor?.[currentUser.uid]) continue;
    if (isBlocked(msg.senderId)) continue;
    const isMyMessage = msg.senderId === currentUser.uid;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMyMessage ? 'my-message' : ''}`;
    if (msg.type === 'call') {
      messageDiv.className = 'message call-message';
      messageDiv.dataset.messageId = doc.id;
      messageDiv.innerHTML = renderCallMessage(msg);
      messagesArea.appendChild(messageDiv);
      continue;
    }
    if (msg.deletedForEveryone) messageDiv.classList.add('deleted');
    if (msg.failed) messageDiv.classList.add('failed');
    messageDiv.dataset.messageId = doc.id;
    let attachmentHtml = msg.attachment ? renderAttachment(msg.attachment) : '';
    let replyHtml = '';
    if (msg.replyTo) {
      replyHtml = `<div class="reply-preview"><div class="reply-sender">↩️ Replying to ${escapeHtml(msg.replyTo.senderName)}</div><div class="reply-text">${escapeHtml(msg.replyTo.text ? msg.replyTo.text.substring(0, 50) : 'Media')}</div></div>`;
    }
    const messageText = msg.deletedForEveryone ? 'This message was deleted' : (msg.text || '');
    const messageTextHtml = msg.deletedForEveryone ? escapeHtml(messageText) : renderMessageText(messageText, msg.mentions || []);
    const pollHtml = !msg.deletedForEveryone && msg.type === 'poll' ? renderPollMessage(doc.id, msg) : '';
    if (msg.deletedForEveryone) attachmentHtml = '';
    messageDiv.innerHTML = `<div class="message-bubble">${!isMyMessage ? `<div class="message-sender">${escapeHtml(msg.senderName)}</div>` : ''}${replyHtml}${messageText ? `<div class="message-text">${messageTextHtml}</div>` : ''}${pollHtml}${attachmentHtml}<div class="message-footer"><span class="message-time">${msg.timestamp ? formatTime(msg.timestamp) : ''}</span>${getMessageReceiptHtml(msg, isMyMessage)}</div></div>`;
    const reactionsContainer = document.createElement('div');
    messageDiv.querySelector('.message-bubble').appendChild(reactionsContainer);
    await loadReactions(doc.id, reactionsContainer);
    messageDiv.addEventListener('contextmenu', (e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, doc.id, msg, isMyMessage); });
    messagesArea.appendChild(messageDiv);
  }
  bindRenderedMessageActions();
  messagesArea.scrollTop = messagesArea.scrollHeight;
  markMessagesAsRead();
}

// ========================================
// SEND MESSAGE & CONTEXT MENU
// ========================================

function parsePollDraft(text = '') {
  const parts = text.replace(/^\/poll\s+/i, '').split('|').map(part => part.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  return {
    question: parts[0],
    options: parts.slice(1, 11),
    votes: {}
  };
}

function createPollFromPrompt() {
  if (!currentChat) {
    showToast('Open a chat first', 'error');
    return;
  }
  const question = prompt('Poll question:');
  if (!question || !question.trim()) return;
  const optionsText = prompt('Poll options, separated by commas:', 'Yes, No');
  if (!optionsText) return;
  const options = optionsText.split(',').map(option => option.trim()).filter(Boolean);
  if (options.length < 2) {
    showToast('Add at least two poll options', 'error');
    return;
  }
  const input = document.getElementById('messageInput');
  if (input) {
    input.value = `/poll ${question.trim()} | ${options.slice(0, 10).join(' | ')}`;
    input.focus();
  }
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input ? input.value.trim() : '';
  if ((!text && !currentAttachment) || !currentChat) return;
  const pollDraft = text.startsWith('/poll ') ? parsePollDraft(text) : null;
  if (text.startsWith('/poll ') && !pollDraft) {
    showToast('Use: /poll Question | Option 1 | Option 2', 'error');
    return;
  }
  setSendingState(true);
  const messageData = {
    senderId: currentUser.uid, senderName: currentUser.displayName || currentUser.email.split('@')[0],
    text: pollDraft ? '' : (text || ''), timestamp: firebase.firestore.FieldValue.serverTimestamp(), read: false,
    readBy: { [currentUser.uid]: new Date() }
  };
  if (pollDraft) {
    messageData.type = 'poll';
    messageData.poll = pollDraft;
  }
  const mentions = getMessageMentions(text);
  if (mentions.length) messageData.mentions = mentions;
  if (currentReplyTo) {
    messageData.replyTo = { messageId: currentReplyTo.id, text: currentReplyTo.text, senderName: currentReplyTo.senderName };
  }
  if (currentAttachment) messageData.attachment = currentAttachment;
  if (currentChatType === 'group' && currentGroup?.onlyAdminsCanSend && !isCurrentUserGroupAdmin()) {
    showToast('Only admins can send messages in this group', 'error');
    setSendingState(false);
    return;
  }
  try {
    if (currentChatType === 'direct') {
      messageData.directId = currentChat.id;
      messageData.participants = currentChat.isSaved ? [currentUser.uid] : [currentUser.uid, currentChat.otherUserId];
    } else {
      messageData.groupId = currentChat.id;
    }
    if (!navigator.onLine) {
      queueOfflineMessage(messageData, { id: currentChat.id, type: currentChatType });
      currentAttachment = null;
      setAttachmentPreview();
      if (input) input.value = '';
      currentReplyTo = null;
      document.getElementById('replyPreviewBar').style.display = 'none';
      setConnectionBanner();
      showToast('Message queued. It will send when you are back online.');
      return;
    }
    await db.collection('messages').add(messageData);
    currentAttachment = null;
    setAttachmentPreview();
    if (input) input.value = '';
    currentReplyTo = null;
    document.getElementById('replyPreviewBar').style.display = 'none';
    if (currentChatType === 'direct') {
      await db.collection('directChats').doc(currentChat.id).update({ lastMessage: pollDraft ? 'Poll' : (text || (messageData.attachment ? 'Attachment' : '')), lastMessageTime: firebase.firestore.FieldValue.serverTimestamp() });
    } else {
      await db.collection('groups').doc(currentChat.id).update({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    scheduleChatListRefresh();
    if (!isChatMuted(currentChat.id)) sendNotification(currentChat.name || currentChat.otherUserName, text || 'Attachment');
  } catch (error) {
    showToast('Message failed to send. Please try again.', 'error');
  } finally {
    setSendingState(false);
  }
}

async function handleFileUpload(file) {
  if (!file) return;
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('File must be 10 MB or smaller', 'error');
    return;
  }
  const attachBtn = document.getElementById('attachBtn');
  if (attachBtn) {
    attachBtn.disabled = true;
    attachBtn.textContent = '…';
  }
  try {
    if (file.type.startsWith('image/')) {
      const url = await uploadToCloudinary(file);
      currentAttachment = { type: 'image', url, filename: file.name, size: file.size };
      showToast('Image ready to send');
    } else {
      const url = await uploadDocument(file);
      currentAttachment = { type: 'document', url, filename: file.name, size: file.size };
      showToast('Document ready to send');
    }
    setAttachmentPreview();
  } catch (error) {
    showToast('Upload failed. Please try again.', 'error');
  } finally {
    if (attachBtn) {
      attachBtn.disabled = false;
      attachBtn.textContent = '📎';
    }
  }
}

function copyToClipboard(text) { navigator.clipboard.writeText(text); showToast('Copied to clipboard'); }
function setReplyTo(messageData) { currentReplyTo = messageData; document.getElementById('replyPreviewBar').style.display = 'block'; document.getElementById('replyPreviewSender').textContent = messageData.senderName; document.getElementById('replyPreviewText').textContent = messageData.text ? messageData.text.substring(0, 100) : 'Media'; }
async function editMessage(messageId, oldText) { const newText = prompt('Edit message:', oldText); if (newText && newText !== oldText) { await db.collection('messages').doc(messageId).update({ text: newText, edited: true, editedAt: firebase.firestore.FieldValue.serverTimestamp() }); showToast('Message edited'); } }
async function deleteMessageForMe(messageId) {
  if (!messageId || !currentUser) return;
  const updates = {};
  updates[`deletedFor.${currentUser.uid}`] = true;
  await db.collection('messages').doc(messageId).update(updates);
  showToast('Message deleted for you');
}
async function deleteMessage(messageId) {
  if (!confirm('Delete this message for everyone?')) return;
  await db.collection('messages').doc(messageId).update({
    text: '',
    attachment: firebase.firestore.FieldValue.delete(),
    deletedForEveryone: true,
    deletedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast('Message deleted for everyone');
}
async function starMessage(messageId, messageData) { const existing = await db.collection('starredMessages').where('messageId', '==', messageId).where('userId', '==', currentUser.uid).get(); if (!existing.empty) { await existing.docs[0].ref.delete(); showToast('Message unstarred'); } else { await db.collection('starredMessages').add({ messageId, userId: currentUser.uid, chatId: currentChat.id, text: messageData.text, senderName: messageData.senderName, timestamp: messageData.timestamp, starredAt: firebase.firestore.FieldValue.serverTimestamp() }); showToast('Message starred'); } }

async function showForwardModal(messageData) {
  const modal = document.getElementById('forwardModal'); const list = document.getElementById('forwardChatsList');
  if (!modal || !list) return;
  modal.style.display = 'flex'; list.innerHTML = '<div class="loading" style="padding:20px; text-align:center;">Loading...</div>';
  const chats = [];
  const directChats = await db.collection('directChats').where('participants', 'array-contains', currentUser.uid).get();
  for (const doc of directChats.docs) {
    const otherId = doc.data().participants.find(id => id !== currentUser.uid);
    const userDoc = await db.collection('users').doc(otherId).get();
    if (userDoc.exists && !isBlocked(otherId)) chats.push({ id: doc.id, type: 'direct', name: userDoc.data().displayName || userDoc.data().email });
  }
  const groupsSnapshot = await db.collection('groupMembers').where('userId', '==', currentUser.uid).get();
  for (const doc of groupsSnapshot.docs) {
    const groupDoc = await db.collection('groups').doc(doc.data().groupId).get();
    if (groupDoc.exists) chats.push({ id: groupDoc.id, type: 'group', name: groupDoc.data().name });
  }
  list.innerHTML = '';
  chats.forEach(chat => {
    const div = document.createElement('div'); div.className = 'forward-item'; div.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px; cursor: pointer; border-radius: 12px;';
    div.innerHTML = `<div style="width:44px;height:44px;background:#e2e8f0;border-radius:50%;display:flex;align-items:center;justify-content:center;">${chat.type === 'group' ? '👥' : '👤'}</div><div style="flex:1; font-weight:500;">${escapeHtml(chat.name)}</div><div style="font-size:11px;color:#888;">${chat.type}</div>`;
    div.onclick = async () => { await forwardMessage(messageData, chat.id, chat.type); modal.style.display = 'none'; };
    list.appendChild(div);
  });
}

async function forwardMessage(messageData, targetChatId, targetChatType) {
  const newMessage = {
    senderId: currentUser.uid, senderName: currentUser.displayName || currentUser.email.split('@')[0],
    text: messageData.text, timestamp: firebase.firestore.FieldValue.serverTimestamp(), read: false,
    readBy: { [currentUser.uid]: new Date() },
    isForwarded: true, originalSender: messageData.senderName
  };
  if (targetChatType === 'direct') newMessage.directId = targetChatId;
  else newMessage.groupId = targetChatId;
  if (messageData.attachment) newMessage.attachment = messageData.attachment;
  if (messageData.type === 'poll' && messageData.poll) {
    newMessage.type = 'poll';
    newMessage.poll = {
      question: messageData.poll.question,
      options: messageData.poll.options || [],
      votes: {}
    };
  }
  await db.collection('messages').add(newMessage);
  showToast('Message forwarded');
}

function formatReadAt(value) {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

async function showMessageInfo(messageId, messageData) {
  let participantIds = [];
  if (currentChatType === 'direct') {
    participantIds = [currentUser.uid, currentChat.otherUserId].filter(Boolean);
  } else {
    const members = await db.collection('groupMembers').where('groupId', '==', currentChat.id).get();
    participantIds = members.docs.map(doc => doc.data().userId);
  }

  const readBy = messageData.readBy || {};
  const rows = [];
  for (const userId of participantIds) {
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.exists ? userDoc.data() : {};
    rows.push({
      name: userId === currentUser.uid ? 'You' : (user.displayName || user.email || 'Unknown user'),
      seenAt: readBy[userId],
      isSender: userId === messageData.senderId
    });
  }

  let modal = document.getElementById('messageInfoModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'messageInfoModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Message info</h3>
          <span class="close-modal messageInfoClose">&times;</span>
        </div>
        <div class="modal-body" id="messageInfoBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.messageInfoClose').addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  const seenRows = rows.filter(row => row.seenAt && !row.isSender);
  const pendingRows = rows.filter(row => !row.seenAt && !row.isSender);
  document.getElementById('messageInfoBody').innerHTML = `
    <div class="message-info-preview">${escapeHtml(messageData.text || (messageData.attachment ? 'Media message' : ''))}</div>
    <h4>Seen by</h4>
    ${seenRows.length ? seenRows.map(row => `<div class="info-row"><span>${escapeHtml(row.name)}</span><span>${formatReadAt(row.seenAt)}</span></div>`).join('') : '<div class="empty-state" style="padding:16px;">Not seen yet</div>'}
    <h4 style="margin-top:16px;">Delivered to</h4>
    ${pendingRows.length ? pendingRows.map(row => `<div class="info-row"><span>${escapeHtml(row.name)}</span><span>Not seen</span></div>`).join('') : '<div class="empty-state" style="padding:16px;">Everyone has seen it</div>'}
  `;
  modal.style.display = 'flex';
}

function showContextMenu(x, y, messageId, messageData, isMyMessage) {
  const existingMenu = document.querySelector('.message-context-menu');
  if (existingMenu) existingMenu.remove();
  const menu = document.createElement('div');
  menu.className = 'context-menu message-context-menu';
  menu.style.display = 'block';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  const copyText = messageData.type === 'poll' ? (messageData.poll?.question || 'Poll') : (messageData.text || '');
  const items = [
    { text: '📋 Copy', action: () => copyToClipboard(copyText) },
    { text: '↩️ Reply', action: () => setReplyTo(messageData) },
    { text: '⭐ Star', action: () => starMessage(messageId, messageData) },
    { text: '📌 Pin', action: () => pinMessage(messageId, messageData) },
    { text: '➡️ Forward', action: () => showForwardModal(messageData) }
  ];
  if (isMyMessage) {
    items.push({ text: 'Info', action: () => showMessageInfo(messageId, messageData) });
    if (!messageData.deletedForEveryone && messageData.type !== 'poll') {
      items.push({ text: 'Edit', action: () => editMessage(messageId, messageData.text) });
      items.push({ text: '🗑️ Delete for everyone', action: () => deleteMessage(messageId) });
    } else if (!messageData.deletedForEveryone) {
      items.push({ text: 'Delete for everyone', action: () => deleteMessage(messageId) });
    }
  }
  items.push({ text: 'Delete for me', action: () => deleteMessageForMe(messageId) });
  if (!isMyMessage) items.push({ text: '🚫 Block user', action: () => blockUser(messageData.senderId, messageData.senderName) });
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'context-menu-item';
    if (item.text.includes('Delete') || item.text.includes('Block')) div.classList.add('danger');
    div.textContent = item.text;
    div.onclick = () => { item.action(); menu.remove(); };
    menu.appendChild(div);
  });
  document.body.appendChild(menu);
  const margin = 8;
  const rect = menu.getBoundingClientRect();
  const maxLeft = window.innerWidth - rect.width - margin;
  const maxTop = window.innerHeight - rect.height - margin;
  menu.style.left = `${Math.max(margin, Math.min(x, maxLeft))}px`;
  menu.style.top = `${Math.max(margin, Math.min(y, maxTop))}px`;
  setTimeout(() => { document.addEventListener('click', () => menu.remove(), { once: true }); }, 100);
}

// ========================================
// PROFILE FUNCTIONS
// ========================================

async function updateProfileAvatar(file) { const url = await uploadToCloudinary(file); await db.collection('users').doc(currentUser.uid).update({ avatar: url }); await currentUser.updateProfile({ photoURL: url }); showToast('Avatar updated'); showProfileModal(); }
async function updateDisplayName(displayName) {
  const cleanName = (displayName || '').trim();
  if (cleanName.length < 2) {
    showToast('Name must be at least 2 characters', 'error');
    return false;
  }
  await db.collection('users').doc(currentUser.uid).update({ displayName: cleanName });
  await currentUser.updateProfile({ displayName: cleanName });
  showToast('Name updated');
  showProfileModal();
  loadCurrentChatList();
  return true;
}
async function updateStatusText(statusText) { await db.collection('users').doc(currentUser.uid).update({ statusText }); showToast('Status updated'); }
async function updatePhoneNumber(phoneNumber) { if (!isValidIndianPhone(phoneNumber)) { showToast('Enter valid phone number', 'error'); return false; } await db.collection('users').doc(currentUser.uid).update({ phone: phoneNumber }); showToast('Phone number saved!'); return true; }
async function updatePrivacySettings() { await db.collection('users').doc(currentUser.uid).update({ privacySettings }); }

async function showProfileModal() {
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const userData = userDoc.data();
  document.getElementById('profileName').textContent = userData.displayName || currentUser.displayName;
  document.getElementById('profileEmail').textContent = userData.email || currentUser.email;
  document.getElementById('profilePhone').textContent = userData.phone || userData.phoneNumber || 'Not set';
  document.getElementById('profileStatusText').value = userData.statusText || 'Hey there! I am using Team Chat';
  document.getElementById('profileAvatar').innerHTML = userData.avatar ? `<img src="${userData.avatar}">` : (userData.displayName ? userData.displayName[0].toUpperCase() : '👤');
  document.getElementById('hideReadReceipts').checked = privacySettings.hideReadReceipts;
  document.getElementById('hideTypingIndicator').checked = privacySettings.hideTypingIndicator;
  document.getElementById('hideLastSeen').checked = privacySettings.hideLastSeen;
  document.getElementById('profileModal').style.display = 'flex';
}

async function showBlockedUsersModal() {
  const modal = document.getElementById('blockedModal'); const list = document.getElementById('blockedUsersList');
  modal.style.display = 'flex'; list.innerHTML = '';
  await loadBlockedUsers();
  if (!blockedUsers.length) {
    list.innerHTML = '<div class="empty-state" style="padding:24px;">No blocked users</div>';
    return;
  }
  for (const block of blockedUsers) {
    let detail = '';
    let avatar = '👤';
    try {
      const userDoc = await db.collection('users').doc(block.blockedUserId).get();
      if (userDoc.exists) {
        const user = userDoc.data();
        detail = [user.email, user.phone || user.phoneNumber].filter(Boolean).join(' · ');
        avatar = user.avatar ? `<img src="${user.avatar}">` : escapeHtml((user.displayName || block.blockedUserName || '?')[0].toUpperCase());
      }
    } catch (error) {
      detail = '';
    }
    const div = document.createElement('div');
    div.className = 'blocked-user-card';
    div.innerHTML = `<div class="list-avatar">${avatar}</div><div class="list-info"><div class="list-name">${escapeHtml(block.blockedUserName || 'Blocked user')}</div><div class="list-preview">${escapeHtml(detail || 'Blocked contact')}</div></div><button class="unblock-btn" data-id="${block.id}">Unblock</button>`;
    list.appendChild(div);
  }
  document.querySelectorAll('.unblock-btn').forEach(btn => { btn.addEventListener('click', async () => { await unblockUser(btn.dataset.id); showBlockedUsersModal(); loadCurrentChatList(); }); });
  return;
  for (const block of blockedUsers) {
    const div = document.createElement('div'); div.className = 'list-item';
    div.innerHTML = `<div class="list-avatar">👤</div><div class="list-info"><div class="list-name">${escapeHtml(block.blockedUserName)}</div></div><button class="unblock-btn" data-id="${block.id}" style="background:#ef4444; color:white; border:none; padding:4px 12px; border-radius:20px;">Unblock</button>`;
    list.appendChild(div);
  }
  document.querySelectorAll('.unblock-btn').forEach(btn => { btn.addEventListener('click', async () => { await unblockUser(btn.dataset.id); showBlockedUsersModal(); loadChatsList(); }); });
}

function showQuickRepliesModal() {
  const modal = document.getElementById('quickRepliesModal'); const list = document.getElementById('quickRepliesList');
  modal.style.display = 'flex'; list.innerHTML = '';
  quickReplies.forEach(reply => {
    const div = document.createElement('div'); div.className = 'list-item';
    div.innerHTML = `<div class="list-info" style="cursor:pointer;"><div class="list-name">${escapeHtml(reply.text)}</div></div><button class="delete-reply-btn" data-id="${reply.id}" style="background:none; border:none; font-size:18px;">❌</button>`;
    div.querySelector('.list-info').onclick = () => { document.getElementById('messageInput').value = reply.text; modal.style.display = 'none'; };
    div.querySelector('.delete-reply-btn').onclick = async (e) => { e.stopPropagation(); await deleteQuickReply(reply.id); };
    list.appendChild(div);
  });
}

async function exportCurrentChat() {
  if (!currentChat) return;
  let messages = []; let query;
  if (currentChatType === 'direct') query = await db.collection('messages').where('directId', '==', currentChat.id).orderBy('timestamp', 'asc').get();
  else query = await db.collection('messages').where('groupId', '==', currentChat.id).orderBy('timestamp', 'asc').get();
  for (const doc of query.docs) {
    const msg = doc.data();
    messages.push({ sender: msg.senderName, text: msg.text, time: msg.timestamp ? msg.timestamp.toDate().toISOString() : null, attachment: msg.attachment });
  }
  const exportData = { chatName: document.getElementById('currentChatName').textContent, chatType: currentChatType, exportedAt: new Date().toISOString(), messages };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `chat_export_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
  showToast('Chat exported!');
}

async function clearAllChats() {
  if (!confirm('Clear ALL your chat history? This cannot be undone.')) return;
  const messages = await db.collection('messages').where('senderId', '==', currentUser.uid).get();
  for (const doc of messages.docs) await doc.ref.delete();
  showToast('All chats cleared');
}

// ========================================
// TAB SWITCHING, DARK MODE, INIT
// ========================================

function switchTab(tab) {
  if (tab === 'chats') tab = 'all';
  currentViewTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.add('active');
  const chatsList = document.getElementById('chatsList');
  const groupsList = document.getElementById('groupsList');
  const statusList = document.getElementById('statusList');
  const groupActions = document.getElementById('groupActions');
  const statusActions = document.getElementById('statusActions');
  
  if (tab === 'groups') {
    chatsList.style.display = 'none';
    groupsList.style.display = 'block';
    if (statusList) statusList.style.display = 'none';
    if (groupActions) groupActions.style.display = 'flex';
    if (statusActions) statusActions.style.display = 'none';
    loadGroupsList();
    document.getElementById('searchInput').placeholder = '🔍 Search groups by name...';
    document.getElementById('searchInput').oninput = (e) => searchGroupsRealtime(e.target.value);
  } else if (tab === 'status') {
    chatsList.style.display = 'none';
    groupsList.style.display = 'none';
    if (statusList) statusList.style.display = 'block';
    if (groupActions) groupActions.style.display = 'none';
    if (statusActions) statusActions.style.display = 'flex';
    loadStatusList();
    document.getElementById('searchInput').placeholder = 'Search status updates';
    document.getElementById('searchInput').oninput = () => {};
  } else {
    chatsList.style.display = 'block';
    groupsList.style.display = 'none';
    if (statusList) statusList.style.display = 'none';
    if (groupActions) groupActions.style.display = 'none';
    if (statusActions) statusActions.style.display = 'none';
    loadAllChatsList();
    document.getElementById('searchInput').placeholder = 'Search or start a new chat';
    document.getElementById('searchInput').oninput = (e) => searchUsersRealtime(e.target.value);
  }
}

function toggleDarkMode() {
  document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', document.body.classList.contains('dark'));
}

function showInChatSearch() { document.getElementById('inChatSearchBar').style.display = 'block'; document.getElementById('inChatSearchInput').focus(); }
async function searchInChat(searchTerm) {
  if (!searchTerm || !currentChat) return;
  const term = searchTerm.toLowerCase();
  let query;
  if (currentChatType === 'direct') query = await db.collection('messages').where('directId', '==', currentChat.id).orderBy('timestamp', 'asc').get();
  else query = await db.collection('messages').where('groupId', '==', currentChat.id).orderBy('timestamp', 'asc').get();
  currentSearchResults = [];
  query.forEach(doc => { const msg = doc.data(); if (msg.text && msg.text.toLowerCase().includes(term)) currentSearchResults.push({ id: doc.id, ...msg }); });
  currentSearchIndex = 0;
  const countSpan = document.getElementById('searchResultCount');
  if (currentSearchResults.length === 0) countSpan.textContent = 'No results';
  else countSpan.textContent = `${currentSearchIndex + 1} of ${currentSearchResults.length}`;
  if (currentSearchResults.length > 0) {
    document.querySelectorAll('.message').forEach(msg => msg.classList.remove('highlighted'));
    const result = currentSearchResults[currentSearchIndex];
    const messageDivs = document.querySelectorAll('.message');
    for (let i = 0; i < messageDivs.length; i++) {
      if (messageDivs[i].querySelector('.message-text')?.innerText.includes(result.text)) {
        messageDivs[i].classList.add('highlighted');
        messageDivs[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  }
}

// ========================================
// INITIALIZE
// ========================================

async function init() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) { 
      window.location.href = 'login.html'; 
      return; 
    }
    if (!user.emailVerified) { 
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = '📧 Please verify your email first! Check your inbox.';
        toast.className = 'toast error';
        toast.style.opacity = '1';
      }
      await auth.signOut(); 
      setTimeout(() => { window.location.href = 'login.html'; }, 2000);
      return; 
    }
    currentUser = user;
    document.getElementById('userName').textContent = user.displayName || user.email.split('@')[0];
    document.getElementById('userAvatar').innerHTML = (user.displayName || user.email)[0].toUpperCase();
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      await userRef.set({ uid: user.uid, email: user.email, displayName: user.displayName || user.email.split('@')[0], createdAt: new Date(), isActive: true, isFirstTime: true, onlineStatus: 'online', privacySettings: { hideReadReceipts: false, hideTypingIndicator: false, hideLastSeen: false } });
    } else {
      await userRef.update({ onlineStatus: 'online', lastSeen: new Date() });
      if (userDoc.data().privacySettings) privacySettings = userDoc.data().privacySettings;
    }
    window.addEventListener('beforeunload', async () => { await userRef.update({ onlineStatus: 'offline', lastSeen: new Date() }); });
    document.addEventListener('visibilitychange', async () => {
      if (!currentUser) return;
      await userRef.update({
        onlineStatus: document.hidden ? 'away' : 'online',
        lastSeen: new Date()
      });
    });
    await loadBlockedUsers();
    await loadMutedChats();
    await loadFavoriteChatIds();
    await loadQuickReplies();
    await loadAllUsers();
    loadWallpaperFromStorage();
    await checkFirstTimeUser();
    setupChatListListeners();
    setupRequestListeners();
    listenForIncomingCalls();
    loadReceivedRequests();
    switchTab('all');
    loadArchivedChats();
    renderChatDebugPanel();
    if (Notification.permission === 'default') Notification.requestPermission();
    setInterval(async () => {
      await db.collection('users').doc(currentUser.uid).update({
        onlineStatus: document.hidden ? 'away' : 'online',
        lastSeen: new Date()
      });
    }, 60000);
  });

  // Event Listeners
  document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
  document.getElementById('messageInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
  document.getElementById('messageInput')?.addEventListener('input', sendTypingIndicator);
  document.querySelectorAll('.tab').forEach(tab => { tab.addEventListener('click', () => switchTab(tab.dataset.tab)); });
  // Ensure initial tab behavior maps 'all' to the chats view
  if (!document.querySelector('.tab.active')) document.querySelector('.tab[data-tab="all"]')?.classList.add('active');
  // If 'all' is active, load both lists but show chats by default
  if (document.querySelector('.tab.active')?.dataset.tab === 'all') {
    currentViewTab = 'all';
    loadAllChatsList();
  }
  
  // Mobile chat navigation
  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    if (window.innerWidth <= 900) closeMobileChatPanel();
    else document.getElementById('sidebar').classList.toggle('open');
  });
  
  document.getElementById('profileBtn')?.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('open');
    }
    showProfileModal();
  });
  document.getElementById('logoutBtn')?.addEventListener('click', async () => { 
    await auth.signOut(); 
    window.location.href = 'login.html'; 
  });
  
  // Close sidebar when clicking on a chat/group item
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 900 && e.target.closest('.list-item:not(.list-item-menu)')) {
      document.getElementById('sidebar').classList.remove('open');
    }
  });
  
  document.getElementById('groupInfoBtn')?.addEventListener('click', showGroupInfo);
  document.getElementById('chatHeaderInfo')?.addEventListener('click', showChatInfo);
  document.getElementById('voiceCallBtn')?.addEventListener('click', () => startCall('voice'));
  document.getElementById('videoCallBtn')?.addEventListener('click', () => startCall('video'));
  document.getElementById('acceptCallBtn')?.addEventListener('click', acceptIncomingCall);
  document.getElementById('rejectCallBtn')?.addEventListener('click', () => endActiveCall('rejected'));
  document.getElementById('endCallBtn')?.addEventListener('click', () => endActiveCall('ended'));
  document.getElementById('closeCallBtn')?.addEventListener('click', handleCallCloseAction);
  document.getElementById('muteMicBtn')?.addEventListener('click', () => {
    micMuted = !micMuted;
    localCallStream?.getAudioTracks().forEach(track => { track.enabled = !micMuted; });
    document.getElementById('muteMicBtn').classList.toggle('active', micMuted);
  });
  document.getElementById('toggleCameraBtn')?.addEventListener('click', () => {
    upgradeVoiceCallToVideo();
  });
  document.getElementById('requestHeader')?.addEventListener('click', () => {
    const section = document.querySelector('.request-section');
    const toggle = document.getElementById('requestToggle');
    section?.classList.toggle('expanded');
    if (toggle && section) toggle.textContent = section.classList.contains('expanded') ? '▲' : '▼';
  });
  document.getElementById('darkModeBtn')?.addEventListener('click', toggleDarkMode);
  document.getElementById('searchChatBtn')?.addEventListener('click', showInChatSearch);
  document.getElementById('closeSearchBtn')?.addEventListener('click', () => { document.getElementById('inChatSearchBar').style.display = 'none'; document.querySelectorAll('.message').forEach(msg => msg.classList.remove('highlighted')); });
  document.getElementById('inChatSearchInput')?.addEventListener('input', (e) => searchInChat(e.target.value));
  document.getElementById('prevSearchBtn')?.addEventListener('click', () => { if (currentSearchResults.length > 0) { currentSearchIndex = (currentSearchIndex - 1 + currentSearchResults.length) % currentSearchResults.length; updateSearchResults(); } });
  document.getElementById('nextSearchBtn')?.addEventListener('click', () => { if (currentSearchResults.length > 0) { currentSearchIndex = (currentSearchIndex + 1) % currentSearchResults.length; updateSearchResults(); } });
  function updateSearchResults() { const countSpan = document.getElementById('searchResultCount'); if (currentSearchResults.length === 0) { countSpan.textContent = 'No results'; return; } countSpan.textContent = `${currentSearchIndex + 1} of ${currentSearchResults.length}`; document.querySelectorAll('.message').forEach(msg => msg.classList.remove('highlighted')); const result = currentSearchResults[currentSearchIndex]; const messageDivs = document.querySelectorAll('.message'); for (let i = 0; i < messageDivs.length; i++) { if (messageDivs[i].querySelector('.message-text')?.innerText.includes(result.text)) { messageDivs[i].classList.add('highlighted'); messageDivs[i].scrollIntoView({ behavior: 'smooth', block: 'center' }); break; } } }

  // Voice Recording
  const voiceBtn = document.getElementById('voiceMsgBtn');
  if (voiceBtn) {
    voiceBtn.addEventListener('mousedown', startVoiceRecording);
    voiceBtn.addEventListener('mouseup', stopVoiceRecording);
    voiceBtn.addEventListener('mouseleave', cancelVoiceRecording);
    voiceBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startVoiceRecording(); });
    voiceBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopVoiceRecording(); });
  }
  document.getElementById('cancelRecordingBtn')?.addEventListener('click', cancelVoiceRecording);
  document.getElementById('attachBtn')?.addEventListener('click', () => { document.getElementById('fileInput').click(); });
  document.getElementById('pollBtn')?.addEventListener('click', createPollFromPrompt);
  document.getElementById('fileInput')?.addEventListener('change', async (e) => { if (e.target.files[0]) await handleFileUpload(e.target.files[0]); });
  window.addEventListener('online', setConnectionBanner);
  window.addEventListener('offline', setConnectionBanner);
  window.addEventListener('online', flushOfflineQueue);
  setConnectionBanner();
  flushOfflineQueue();

  // Emoji Picker
// Emoji Picker
const emojiPicker = document.getElementById('emojiPicker');
const emojiBtn = document.getElementById('emojiBtn');
const emojis = ['😀', '😂', '😍', '😢', '😡', '👍', '❤️', '🙏', '🎉', '🔥', '💯', '✅', '⭐', '🍕', '💪', '👋', '🙌', '😎', '🤔', '😭', '🥳', '😱', '💀', '👀'];
emojis.forEach(emoji => { const span = document.createElement('span'); span.textContent = emoji; span.onclick = () => { document.getElementById('messageInput').value += emoji; emojiPicker.classList.remove('show'); document.getElementById('messageInput').focus(); }; emojiPicker.appendChild(span); });

if (emojiBtn) {
  emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('show');
  });
}

document.addEventListener('click', (e) => { 
  if (!e.target.closest('#emojiPicker') && !e.target.closest('#emojiBtn')) {
    emojiPicker.classList.remove('show');
  }
});
  document.getElementById('cancelReplyBtn')?.addEventListener('click', () => { currentReplyTo = null; document.getElementById('replyPreviewBar').style.display = 'none'; });

  // Group Modals
  const createGroupModal = document.getElementById('createGroupModal');
  document.getElementById('createGroupBtn')?.addEventListener('click', () => { createGroupModal.style.display = 'flex'; });
  document.querySelectorAll('.closeCreateModal, .cancelGroupBtn').forEach(btn => { btn.addEventListener('click', () => { createGroupModal.style.display = 'none'; }); });
  document.querySelector('.confirmGroupBtn')?.addEventListener('click', async () => { const groupName = document.getElementById('newGroupName').value; const members = document.getElementById('newGroupMembers').value; if (groupName.trim()) { await createGroup(groupName, members); createGroupModal.style.display = 'none'; document.getElementById('newGroupName').value = ''; document.getElementById('newGroupMembers').value = ''; document.getElementById('newGroupAdminsOnlySend').checked = false; } });
  
  const joinGroupModal = document.getElementById('joinGroupModal');
  document.getElementById('showJoinGroupBtn')?.addEventListener('click', () => { joinGroupModal.style.display = 'flex'; });
  document.querySelectorAll('.closeJoinModal').forEach(btn => { btn.addEventListener('click', () => { joinGroupModal.style.display = 'none'; }); });
  document.querySelector('.confirmJoinBtn')?.addEventListener('click', async () => { const code = document.getElementById('joinGroupCodeInput').value; await joinGroup(code); joinGroupModal.style.display = 'none'; document.getElementById('joinGroupCodeInput').value = ''; });
  
  document.querySelectorAll('.closeGroupInfoModal').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('groupInfoModal').style.display = 'none'; }); });
  document.querySelectorAll('.closeChatInfoModal').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('chatInfoModal').style.display = 'none'; }); });
  document.querySelectorAll('.shared-tab').forEach(btn => { btn.addEventListener('click', () => renderSharedContent(btn.dataset.sharedTab)); });
  document.getElementById('editGroupNameInput')?.addEventListener('change', async (e) => { await updateGroupName(e.target.value); });
  document.getElementById('groupAdminsOnlySend')?.addEventListener('change', async (e) => {
    if (!isCurrentUserGroupAdmin()) return;
    await db.collection('groups').doc(currentGroup.id).update({ onlyAdminsCanSend: e.target.checked });
    currentGroup.onlyAdminsCanSend = e.target.checked;
    showToast('Group permission updated');
  });
  document.getElementById('groupAdminsOnlyEdit')?.addEventListener('change', async (e) => {
    if (!isCurrentUserGroupAdmin()) return;
    await db.collection('groups').doc(currentGroup.id).update({ onlyAdminsCanEdit: e.target.checked });
    currentGroup.onlyAdminsCanEdit = e.target.checked;
    showToast('Group permission updated');
    showGroupInfo();
  });
  document.getElementById('groupAvatarLarge')?.addEventListener('click', () => { document.getElementById('groupIconInput').click(); });
  document.getElementById('groupIconInput')?.addEventListener('change', async (e) => { if (e.target.files[0]) await updateGroupIcon(e.target.files[0]); });
  document.getElementById('addMemberBtn')?.addEventListener('click', async () => { const email = document.getElementById('addMemberEmail').value; await addMemberToGroup(email); document.getElementById('addMemberEmail').value = ''; });
  document.getElementById('newGroupMembers')?.addEventListener('input', (e) => {
    const currentEntry = e.target.value.split(',').pop();
    updateGroupMemberSuggestions(currentEntry);
  });
  document.getElementById('addMemberEmail')?.addEventListener('input', (e) => {
    updateGroupMemberSuggestions(e.target.value);
  });
  document.getElementById('leaveGroupBtn')?.addEventListener('click', leaveGroup);
  document.getElementById('deleteGroupBtn')?.addEventListener('click', deleteGroup);
  document.getElementById('copyGroupCodeBtn')?.addEventListener('click', () => { const code = document.getElementById('groupCodeDisplay').textContent; navigator.clipboard.writeText(code); showToast('Group code copied!'); });

  document.getElementById('createStatusBtn')?.addEventListener('click', () => { document.getElementById('createStatusModal').style.display = 'flex'; });
  document.querySelectorAll('.closeStatusModal').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('createStatusModal').style.display = 'none'; }); });
  document.querySelectorAll('.closeStatusViewer').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('statusViewerModal').style.display = 'none'; loadStatusList(); }); });
  document.getElementById('statusImageBtn')?.addEventListener('click', () => { document.getElementById('statusImageInput').click(); });
  document.getElementById('statusImageInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadToCloudinary(file);
    statusImageAttachment = { type: 'image', url, filename: file.name, size: file.size };
    const preview = document.getElementById('statusImagePreview');
    preview.style.display = 'block';
    preview.innerHTML = `<img src="${url}" alt="Status image preview">`;
  });
  document.getElementById('publishStatusBtn')?.addEventListener('click', publishStatus);

  // Profile Modal
  document.querySelectorAll('.closeProfileModal').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('profileModal').style.display = 'none'; }); });
  document.getElementById('changeAvatarBtn')?.addEventListener('click', () => { document.getElementById('avatarInput').click(); });
  document.getElementById('avatarInput')?.addEventListener('change', async (e) => { if (e.target.files[0]) await updateProfileAvatar(e.target.files[0]); });
  document.getElementById('changeNameBtn')?.addEventListener('click', async () => { const name = prompt('Enter your display name:', document.getElementById('profileName')?.textContent || currentUser.displayName || ''); if (name !== null) await updateDisplayName(name); });
  document.getElementById('changePhoneBtn')?.addEventListener('click', async () => { const phone = prompt('Enter 10-digit Indian phone number:'); if (phone && isValidIndianPhone(phone)) await updatePhoneNumber(phone); else if (phone) showToast('Invalid phone number', 'error'); });
  document.getElementById('changeEmailBtn')?.addEventListener('click', changeEmail);
  document.getElementById('profileStatusText')?.addEventListener('change', async (e) => { await updateStatusText(e.target.value); });
  document.getElementById('hideReadReceipts')?.addEventListener('change', async (e) => { privacySettings.hideReadReceipts = e.target.checked; await updatePrivacySettings(); });
  document.getElementById('hideTypingIndicator')?.addEventListener('change', async (e) => { privacySettings.hideTypingIndicator = e.target.checked; await updatePrivacySettings(); });
  document.getElementById('hideLastSeen')?.addEventListener('change', async (e) => { privacySettings.hideLastSeen = e.target.checked; await updatePrivacySettings(); });
  document.getElementById('blockedUsersBtn')?.addEventListener('click', showBlockedUsersModal);
  document.querySelectorAll('.closeBlockedModal').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('blockedModal').style.display = 'none'; }); });
  document.getElementById('quickRepliesSettingsBtn')?.addEventListener('click', showQuickRepliesModal);
  document.querySelectorAll('.closeQuickRepliesModal').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('quickRepliesModal').style.display = 'none'; }); });
  document.getElementById('addQuickReplyBtn')?.addEventListener('click', async () => { const text = document.getElementById('newQuickReplyText').value; if (text) { await addQuickReply(text); document.getElementById('newQuickReplyText').value = ''; } });
  document.getElementById('wallpaperSettingsBtn')?.addEventListener('click', () => { openWallpaperModal('global'); });
  document.getElementById('wallpaperBtn')?.addEventListener('click', () => { openWallpaperModal('current'); });
  document.getElementById('currentChatWallpaperBtn')?.addEventListener('click', () => { openWallpaperModal('current'); });
  document.getElementById('callNetworkSettingsBtn')?.addEventListener('click', updateTurnServerSettings);
  document.querySelectorAll('.closeWallpaperModal').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('wallpaperModal').style.display = 'none'; }); });
  document.querySelectorAll('.wallpaper-option').forEach(opt => { opt.addEventListener('click', () => {
    const wallpaper = normalizeWallpaperType(opt.dataset.wallpaper);
    if (wallpaperModalMode === 'current') {
      if (currentChat) {
        setWallpaperForChat(currentChat.id, wallpaper);
      } else {
        showToast('No chat selected', 'error');
      }
    } else {
      setGlobalWallpaper(wallpaper);
    }
    document.getElementById('wallpaperModal').style.display = 'none';
  }); });
  document.getElementById('uploadWallpaperBtn')?.addEventListener('click', () => { document.getElementById('wallpaperUploadInput').click(); });
  document.getElementById('wallpaperUploadInput')?.addEventListener('change', async (e) => { if (e.target.files[0]) { const url = await uploadToCloudinary(e.target.files[0]); if (wallpaperModalMode === 'current') {
        if (currentChat) setWallpaperForChat(currentChat.id, url);
        else showToast('No chat selected', 'error');
      } else {
        setGlobalWallpaper(url);
      }
      document.getElementById('wallpaperModal').style.display = 'none'; } });
  document.getElementById('exportChatsBtn')?.addEventListener('click', exportCurrentChat);
  document.getElementById('clearAllChatsBtn')?.addEventListener('click', clearAllChats);
  document.getElementById('deactivateAccountBtn')?.addEventListener('click', deactivateAccount);
  document.querySelectorAll('.closeForwardModal').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('forwardModal').style.display = 'none'; }); });
  document.getElementById('archiveHeader')?.addEventListener('click', () => { const archiveList = document.getElementById('archiveList'); const toggle = document.getElementById('archiveToggle'); if (archiveList.classList.contains('show')) { archiveList.classList.remove('show'); toggle.textContent = '▼'; } else { archiveList.classList.add('show'); toggle.textContent = '▲'; loadArchivedChats(); } });
  document.getElementById('messagesArea')?.addEventListener('scroll', () => { markMessagesAsRead(); });
  if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark');
  switchTab('all');
}

function updateSearchResults() {
  const countSpan = document.getElementById('searchResultCount');
  if (!countSpan) return;
  if (currentSearchResults.length === 0) { countSpan.textContent = 'No results'; return; }
  countSpan.textContent = `${currentSearchIndex + 1} of ${currentSearchResults.length}`;
  document.querySelectorAll('.message').forEach(msg => msg.classList.remove('highlighted'));
  const result = currentSearchResults[currentSearchIndex];
  const messageDivs = document.querySelectorAll('.message');
  for (let i = 0; i < messageDivs.length; i++) {
    if (messageDivs[i].querySelector('.message-text')?.innerText.includes(result.text)) {
      messageDivs[i].classList.add('highlighted');
      messageDivs[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
      break;
    }
  }
}

// ========================================
// CONTEXT MENU FOR CHATS
// ========================================

let contextMenuTarget = null;
let currentViewTab = 'all';

document.addEventListener('contextmenu', (e) => {
  const chatItem = e.target.closest('.list-item');
  if (!chatItem) return;
  
  e.preventDefault();
  contextMenuTarget = chatItem;
  
  const favoriteItem = document.getElementById('favoriteChatMenuItem');
  const markReadItem = document.getElementById('markReadMenuItem');
  const blockItem = document.getElementById('blockUserMenuItem');
  const chatId = chatItem.dataset.chatId;
  const chatType = chatItem.dataset.chatType;
  if (!chatId || !chatType) return;
  const unreadCount = Number(chatItem.dataset.unreadCount || 0);
  const isFavorite = favoriteChatIds.includes(chatId);
  
  if (favoriteItem) favoriteItem.textContent = isFavorite ? '⭐ Remove favorite' : '⭐ Add to favorite';
  if (markReadItem) markReadItem.textContent = unreadCount > 0 ? '✅ Mark as read' : '📩 Mark as unread';
  
  if (blockItem) blockItem.style.display = chatType === 'direct' && chatItem.dataset.otherUserId ? 'block' : 'none';

  const menu = document.getElementById('chatContextMenu');
  menu.style.display = 'block';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  
  setTimeout(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
    }
  }, 0);
});

document.addEventListener('click', () => {
  const menu = document.getElementById('chatContextMenu');
  menu.style.display = 'none';
  contextMenuTarget = null;
});

document.getElementById('pinChatMenuItem')?.addEventListener('click', async () => {
  if (!contextMenuTarget) return;
  showToast('Chat pinned!');
  contextMenuTarget.style.order = '-1';
  document.getElementById('chatContextMenu').style.display = 'none';
});

document.getElementById('chatInfoMenuItem')?.addEventListener('click', async () => {
  if (!contextMenuTarget) return;
  const chatId = contextMenuTarget.dataset.chatId;
  const chatType = contextMenuTarget.dataset.chatType;
  document.getElementById('chatContextMenu').style.display = 'none';
  if (!chatId || !chatType) return;
  if (chatType === 'group') {
    const chatName = contextMenuTarget.dataset.chatName || contextMenuTarget.querySelector('.list-name')?.textContent || 'Group';
    await loadGroupChat(chatId, chatName);
    await showGroupInfo();
    return;
  }
  const otherUserId = contextMenuTarget.dataset.otherUserId;
  if (!otherUserId) return;
  const userDoc = await db.collection('users').doc(otherUserId).get();
  const user = userDoc.exists ? { id: otherUserId, ...userDoc.data() } : {
    id: otherUserId,
    displayName: contextMenuTarget.dataset.chatName || contextMenuTarget.querySelector('.list-name')?.textContent || 'Contact'
  };
  await startDirectChat(user);
  await showChatInfo();
});

document.getElementById('muteChatMenuItem')?.addEventListener('click', async () => {
  if (!contextMenuTarget) return;
  const duration = prompt('Mute for: 8h, 1w, or always?', '8h');
  if (duration === '8h' || duration === '1w' || duration === 'always') {
    const chatId = contextMenuTarget.querySelector('.mute-chat-btn')?.dataset.chatId;
    const chatType = contextMenuTarget.querySelector('.mute-chat-btn')?.dataset.chatType;
    if (chatId && chatType) {
      await muteChat(chatId, chatType, duration);
      showToast('Chat muted!');
      if (chatType === 'direct') loadChatsList();
      else loadGroupsList();
    }
  }
  document.getElementById('chatContextMenu').style.display = 'none';
});

document.getElementById('archiveChatMenuItem')?.addEventListener('click', async () => {
  if (!contextMenuTarget) return;
  const chatId = contextMenuTarget.querySelector('.archive-chat-btn')?.dataset.chatId;
  const chatType = contextMenuTarget.querySelector('.archive-chat-btn')?.dataset.chatType;
  const chatName = contextMenuTarget.querySelector('.archive-chat-btn')?.dataset.chatName;
  if (chatId && chatType) {
    if (confirm(`Archive this chat?`)) {
      await archiveChat(chatId, chatType, chatName);
      showToast('Chat archived!');
      if (chatType === 'direct') loadChatsList();
      else loadGroupsList();
    }
  }
  document.getElementById('chatContextMenu').style.display = 'none';
});

document.getElementById('favoriteChatMenuItem')?.addEventListener('click', async () => {
  if (!contextMenuTarget) return;
  const chatId = contextMenuTarget.dataset.chatId;
  const chatType = contextMenuTarget.dataset.chatType;
  if (chatId && chatType) {
    await toggleFavoriteChat(chatId, chatType);
  }
  document.getElementById('chatContextMenu').style.display = 'none';
});

document.getElementById('markReadMenuItem')?.addEventListener('click', async () => {
  if (!contextMenuTarget) return;
  const chatId = contextMenuTarget.dataset.chatId;
  const chatType = contextMenuTarget.dataset.chatType;
  const unreadCount = Number(contextMenuTarget.dataset.unreadCount || 0);
  if (chatId && chatType) {
    await markChatReadState(chatId, chatType, unreadCount === 0);
    if (chatType === 'direct') loadChatsList(); else loadGroupsList();
  }
  document.getElementById('chatContextMenu').style.display = 'none';
});

document.getElementById('blockUserMenuItem')?.addEventListener('click', async () => {
  if (!contextMenuTarget) return;
  const userId = contextMenuTarget.dataset.otherUserId;
  const userName = contextMenuTarget.dataset.chatName || contextMenuTarget.querySelector('.list-name')?.textContent || 'User';
  if (!userId) {
    showToast('Only personal chats can be blocked here', 'error');
  } else if (confirm(`Block ${userName}?`)) {
    await blockUser(userId, userName);
    await loadBlockedUsers();
    if (currentChatType === 'direct' && currentChat?.otherUserId === userId) resetChatPanel();
    loadCurrentChatList();
    showToast(`${userName} blocked`);
  }
  document.getElementById('chatContextMenu').style.display = 'none';
});

document.getElementById('deleteChatMenuItem')?.addEventListener('click', async () => {
  if (!contextMenuTarget) return;
  const chatId = contextMenuTarget.dataset.chatId;
  const chatType = contextMenuTarget.dataset.chatType;
  const chatName = contextMenuTarget.dataset.chatName || contextMenuTarget.querySelector('.list-name')?.textContent || 'Chat';
  if (chatId && chatType && confirm(`Delete "${chatName}" from your chat list? Messages are not deleted for other people.`)) {
    try {
      await deleteChatForMe(chatId, chatType, chatName);
    } catch (error) {
      showToast('Failed to delete chat', 'error');
    }
  }
  document.getElementById('chatContextMenu').style.display = 'none';
});

init();
