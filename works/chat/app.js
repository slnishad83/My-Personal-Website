// ========================================
// COMPLETE CHAT APP - ALL FEATURES 1-10
// WhatsApp-style pinning (max 3 pins, shows at top of chat)
// Voice Messages, Reply, Mention, Forward, Message Info, Last Seen, Wallpaper
// ========================================

// CLOUDINARY CONFIGURATION
const CLOUDINARY_CLOUD_NAME = 'du2dsimyz';
const CLOUDINARY_UPLOAD_PRESET = 'chat_app_uploads';

// FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyCdbut_FdscAjl-OVSlAUhb7TOTiRNkh34",
  authDomain: "my-team-chat-2255.firebaseapp.com",
  projectId: "my-team-chat-2255",
  storageBucket: "my-team-chat-2255.firebasestorage.app",
  messagingSenderId: "805016891521",
  appId: "1:805016891521:web:ac9bc7a252bcf33686dd80"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Global variables
let currentUser = null;
let currentChat = null;
let currentChatType = null;
let currentGroup = null;
let activeUnsubscribe = null;
let contextMessageId = null;
let contextMessageIsRead = false;
let contextMessageText = '';
let contextMessageSender = '';
let contextMessageAttachment = null;
let contextMessageTimestamp = null;
let contextMessageEdited = false;
let contextChatId = null;
let contextChatType = null;
let contextGroupId = null;
let allUsers = [];
let mobileMenuOpen = false;
let soundEnabled = true;
let typingTimeout = null;
let unreadCounts = {};
let inactivityTimer = null;
let currentOnlineStatus = 'online';
let currentUserStatusText = '';
let pendingRequestListener = null;
let selectedUserForRequest = null;
let mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
let currentGroupMembers = [];
let currentWallpaper = localStorage.getItem('chatWallpaper') || 'default';

// Voice recording variables
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let recordingTimerInterval = null;
let pressTimer = null;

// Reply to message variable
let replyToMessage = null;

// Search variables
let currentSearchResults = [];
let currentSearchIndex = -1;

// File upload variables
let currentFile = null;
let currentFileUploading = false;
let currentUploadXHR = null;

// Mention variables
let mentionTriggerIndex = -1;
let mentionSearchTerm = '';

// Forward variables
let forwardMessageData = null;

// Pin variables
let pinMessageData = null;

// Wallpaper
const wallpapers = {
  default: '',
  dark: '#1a1a2e',
  forest: '#2d5a27',
  ocean: '#1a4a6e',
  sunset: '#8b4513',
  mountains: '#4a5568'
};

// Country codes
const countryCodes = [
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+1", country: "USA", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+968", country: "Oman", flag: "🇴🇲" },
  { code: "+974", country: "Qatar", flag: "🇶🇦" },
  { code: "+965", country: "Kuwait", flag: "🇰🇼" },
  { code: "+973", country: "Bahrain", flag: "🇧🇭" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+86", country: "China", flag: "🇨🇳" }
];

// ========================================
// HELPER FUNCTIONS
// ========================================
function showError(message, isError = true) {
  const errorDiv = document.getElementById('authError');
  const successDiv = document.getElementById('authSuccess');
  if (errorDiv && isError) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 4000);
  } else if (successDiv && !isError) {
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => successDiv.style.display = 'none', 4000);
  } else {
    alert(message);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toLocaleString();
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function generateGroupCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function getDirectChatId(userId1, userId2) {
  return [userId1, userId2].sort().join('_');
}

function isChatMuted(chatId) {
  if (!mutedChats[chatId]) return false;
  if (mutedChats[chatId].expiry && mutedChats[chatId].expiry < Date.now()) {
    delete mutedChats[chatId];
    localStorage.setItem('mutedChats', JSON.stringify(mutedChats));
    return false;
  }
  return true;
}

function muteChat(chatId, duration) {
  let expiry = null;
  if (duration === '8h') expiry = Date.now() + 8 * 60 * 60 * 1000;
  else if (duration === '7d') expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  else if (duration === 'always') expiry = null;
  
  mutedChats[chatId] = { expiry: expiry };
  localStorage.setItem('mutedChats', JSON.stringify(mutedChats));
  showError('Chat muted', false);
}

function unmuteChat(chatId) {
  delete mutedChats[chatId];
  localStorage.setItem('mutedChats', JSON.stringify(mutedChats));
  showError('Chat unmuted', false);
}

// ========================================
// WALLPAPER FUNCTIONS
// ========================================
function applyWallpaper(wallpaperName) {
  const messagesArea = document.getElementById('messagesArea');
  if (!messagesArea) return;
  
  currentWallpaper = wallpaperName;
  localStorage.setItem('chatWallpaper', wallpaperName);
  
  if (wallpaperName === 'default') {
    messagesArea.style.backgroundImage = '';
    messagesArea.style.backgroundColor = '';
  } else {
    messagesArea.style.backgroundImage = '';
    messagesArea.style.backgroundColor = wallpapers[wallpaperName];
  }
}

function showWallpaperSelector(x, y) {
  const selector = document.getElementById('wallpaperSelector');
  if (selector) {
    selector.style.display = 'block';
    selector.style.left = x + 'px';
    selector.style.top = y + 'px';
    setTimeout(() => {
      document.addEventListener('click', () => selector.style.display = 'none');
    }, 100);
  }
}

// ========================================
// LAST SEEN FUNCTIONS
// ========================================
function formatLastSeen(timestamp) {
  if (!timestamp) return 'Offline';
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Online now';
  if (diffMins < 60) return `Last seen ${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `Last seen ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return `Last seen ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

async function updateLastSeen() {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser.uid).update({
    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ========================================
// PIN MESSAGE FUNCTIONS (WhatsApp-style - max 3 per chat)
// ========================================
async function pinMessage(messageId, messageData) {
  if (!currentChat) return;
  
  const existingPins = await db.collection('pinnedMessages')
    .where('chatId', '==', currentChat.id)
    .get();
  
  if (existingPins.size >= 3) {
    showError('Cannot pin more than 3 messages in a chat. Unpin one first.');
    return;
  }
  
  const alreadyPinned = await db.collection('pinnedMessages')
    .where('chatId', '==', currentChat.id)
    .where('messageId', '==', messageId)
    .get();
  
  if (!alreadyPinned.empty) {
    showError('Message already pinned');
    return;
  }
  
  const pinRef = db.collection('pinnedMessages').doc();
  await pinRef.set({
    chatId: currentChat.id,
    chatType: currentChatType,
    messageId: messageId,
    messageText: messageData.text || '',
    messageSender: messageData.senderName,
    messageAttachment: messageData.attachment || null,
    messageTime: messageData.timestamp || firebase.firestore.FieldValue.serverTimestamp(),
    pinnedBy: currentUser.uid,
    pinnedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  showError('Message pinned!', false);
  loadPinnedMessages();
  markPinnedMessagesInChat();
}

async function unpinMessage(pinId) {
  await db.collection('pinnedMessages').doc(pinId).delete();
  showError('Message unpinned', false);
  loadPinnedMessages();
  markPinnedMessagesInChat();
}

async function loadPinnedMessages() {
  const pinnedSection = document.getElementById('pinnedMessagesSection');
  const pinnedList = document.getElementById('pinnedMessagesList');
  const pinnedCountSpan = document.getElementById('pinnedCount');
  
  if (!pinnedList || !currentChat) {
    if (pinnedSection) pinnedSection.style.display = 'none';
    return;
  }
  
  const snapshot = await db.collection('pinnedMessages')
    .where('chatId', '==', currentChat.id)
    .orderBy('pinnedAt', 'desc')
    .get();
  
  if (snapshot.empty) {
    pinnedSection.style.display = 'none';
    return;
  }
  
  pinnedSection.style.display = 'block';
  if (pinnedCountSpan) pinnedCountSpan.textContent = `${snapshot.size}/3`;
  
  pinnedList.innerHTML = '';
  for (const doc of snapshot.docs) {
    const pin = doc.data();
    const pinDiv = document.createElement('div');
    pinDiv.className = 'pinned-message-item';
    pinDiv.dataset.pinId = doc.id;
    pinDiv.dataset.messageId = pin.messageId;
    pinDiv.innerHTML = `
      <div class="pinned-message-icon">📌</div>
      <div class="pinned-message-content">
        <div class="pinned-message-sender">${escapeHtml(pin.messageSender)}</div>
        <div class="pinned-message-text">${escapeHtml(pin.messageText?.substring(0, 60) || (pin.messageAttachment ? (pin.messageAttachment.type === 'image' ? '📷 Photo' : '📎 File') : 'No text'))}</div>
      </div>
      <div class="pinned-message-time">${pin.messageTime ? formatTime(pin.messageTime) : ''}</div>
      <button class="pinned-unpin-btn" data-pin-id="${doc.id}" title="Unpin">✖</button>
    `;
    
    pinDiv.addEventListener('click', (e) => {
      if (e.target.classList.contains('pinned-unpin-btn')) return;
      const messageElement = document.querySelector(`.message-bubble[data-message-id="${pin.messageId}"]`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageElement.classList.add('highlighted');
        setTimeout(() => messageElement.classList.remove('highlighted'), 2000);
      }
    });
    
    pinnedList.appendChild(pinDiv);
  }
  
  document.querySelectorAll('.pinned-unpin-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pinId = btn.dataset.pinId;
      await unpinMessage(pinId);
    });
  });
}

async function markPinnedMessagesInChat() {
  if (!currentChat) return;
  
  const snapshot = await db.collection('pinnedMessages')
    .where('chatId', '==', currentChat.id)
    .get();
  
  const pinnedMessageIds = new Set();
  snapshot.forEach(doc => pinnedMessageIds.add(doc.data().messageId));
  
  document.querySelectorAll('.message-bubble').forEach(bubble => {
    const messageId = bubble.dataset.messageId;
    if (pinnedMessageIds.has(messageId)) {
      bubble.classList.add('pinned-message');
      if (!bubble.querySelector('.pinned-indicator')) {
        const messageText = bubble.querySelector('.message-text');
        if (messageText && !messageText.querySelector('.pinned-indicator')) {
          const pinSpan = document.createElement('span');
          pinSpan.className = 'pinned-indicator';
          pinSpan.textContent = ' 📌';
          pinSpan.style.fontSize = '10px';
          pinSpan.style.opacity = '0.6';
          messageText.appendChild(pinSpan);
        }
      }
    } else {
      bubble.classList.remove('pinned-message');
      const indicator = bubble.querySelector('.pinned-indicator');
      if (indicator) indicator.remove();
    }
  });
}

// ========================================
// MESSAGE INFO FUNCTIONS
// ========================================
async function showMessageInfo(messageId) {
  const messageDoc = await db.collection('messages').doc(messageId).get();
  if (!messageDoc.exists) return;
  
  const message = messageDoc.data();
  document.getElementById('infoSentTime').textContent = message.timestamp ? formatDateTime(message.timestamp) : 'Unknown';
  document.getElementById('infoDeliveredTime').textContent = message.readAt ? formatDateTime(message.readAt) : 'Not delivered yet';
  document.getElementById('infoReadTime').textContent = message.readAt ? formatDateTime(message.readAt) : 'Not read yet';
  document.getElementById('infoEditedTime').textContent = message.editedAt ? formatDateTime(message.editedAt) : 'No';
  
  document.getElementById('messageInfoModal').style.display = 'flex';
}

// ========================================
// SEARCH VALIDATION
// ========================================
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhoneNumber(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  return /^[1-9][0-9]{9}$/.test(cleanPhone);
}

function validateSearchTerm(term) {
  term = term.trim();
  if (!term) return { valid: false, error: null };
  
  if (term.includes('@')) {
    if (isValidEmail(term)) {
      return { valid: true, type: 'email', value: term.toLowerCase() };
    }
    return { valid: false, error: 'Please enter a valid email address' };
  }
  
  if (/\d/.test(term)) {
    if (term.includes('+')) {
      return { valid: false, error: 'Search phone number without country code' };
    }
    const cleanPhone = term.replace(/\D/g, '');
    if (cleanPhone.length === 10 && isValidPhoneNumber(cleanPhone)) {
      return { valid: true, type: 'phone', value: cleanPhone };
    }
    return { valid: false, error: 'Please enter a valid 10-digit phone number' };
  }
  
  return { valid: true, type: 'name', value: term.toLowerCase() };
}

// ========================================
// VOICE MESSAGE FUNCTIONS
// ========================================
async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const timestamp = Date.now();
      const fileName = `voice_${currentUser.uid}_${timestamp}.webm`;
      
      const storageRef = storage.ref().child(`voice_messages/${fileName}`);
      await storageRef.put(audioBlob);
      const downloadUrl = await storageRef.getDownloadURL();
      
      await sendMessage('', {
        type: 'voice',
        url: downloadUrl,
        duration: Math.round((Date.now() - recordingStartTime) / 1000),
        filename: fileName
      });
      
      stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.start();
    isRecording = true;
    recordingStartTime = Date.now();
    
    document.getElementById('voiceRecordingIndicator').style.display = 'flex';
    startRecordingTimer();
    
  } catch (error) {
    console.error('Microphone error:', error);
    showError('Could not access microphone. Please check permissions.');
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(recordingTimerInterval);
    document.getElementById('voiceRecordingIndicator').style.display = 'none';
  }
}

function cancelVoiceRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(recordingTimerInterval);
    document.getElementById('voiceRecordingIndicator').style.display = 'none';
  }
}

function startRecordingTimer() {
  recordingTimerInterval = setInterval(() => {
    if (recordingStartTime) {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      document.getElementById('recordingTimer').textContent = formatDuration(elapsed);
    }
  }, 1000);
}

function displayVoiceMessage(url, duration) {
  return `
    <div class="voice-message">
      <button class="voice-play-btn" data-url="${url}">▶️</button>
      <div class="voice-waveform"></div>
      <span class="voice-duration">${formatDuration(duration)}</span>
    </div>
  `;
}

// ========================================
// REPLY TO MESSAGE FUNCTIONS
// ========================================
function setReplyTo(messageId, senderName, messageText, attachment = null) {
  replyToMessage = {
    id: messageId,
    sender: senderName,
    text: messageText,
    attachment: attachment
  };
  
  const replyBar = document.getElementById('replyPreviewBar');
  const replySender = document.getElementById('replyPreviewSender');
  const replyMessage = document.getElementById('replyPreviewMessage');
  
  if (replyBar && replySender && replyMessage) {
    replySender.textContent = senderName;
    let displayText = messageText;
    if (attachment) {
      if (attachment.type === 'image') displayText = '📷 Photo';
      else if (attachment.type === 'voice') displayText = '🎤 Voice message';
      else displayText = `📎 ${attachment.filename}`;
    }
    replyMessage.textContent = displayText.length > 50 ? displayText.substring(0, 50) + '...' : displayText;
    replyBar.style.display = 'block';
  }
}

function clearReplyTo() {
  replyToMessage = null;
  const replyBar = document.getElementById('replyPreviewBar');
  if (replyBar) replyBar.style.display = 'none';
}

// ========================================
// MENTION FUNCTIONS
// ========================================
function setupMentionDetection() {
  const input = document.getElementById('messageInput');
  if (!input) return;
  
  input.addEventListener('input', (e) => {
    const cursorPos = input.selectionStart;
    const text = input.value;
    const lastAtIndex = text.lastIndexOf('@', cursorPos - 1);
    
    if (lastAtIndex !== -1 && (lastAtIndex === 0 || text[lastAtIndex - 1] === ' ')) {
      mentionTriggerIndex = lastAtIndex;
      mentionSearchTerm = text.substring(lastAtIndex + 1, cursorPos);
      showMentionDropdown(mentionSearchTerm);
    } else {
      hideMentionDropdown();
    }
  });
}

async function showMentionDropdown(searchTerm) {
  if (currentChatType !== 'group' || !currentGroup) {
    hideMentionDropdown();
    return;
  }
  
  const membersSnapshot = await db.collection('groupMembers')
    .where('groupId', '==', currentGroup.id)
    .get();
  
  const members = [];
  for (const doc of membersSnapshot.docs) {
    const userDoc = await db.collection('users').doc(doc.data().userId).get();
    if (userDoc.exists && userDoc.id !== currentUser.uid) {
      members.push({
        id: userDoc.id,
        name: userDoc.data().displayName || userDoc.data().email,
        avatar: userDoc.data().avatar
      });
    }
  }
  
  const filtered = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const dropdown = document.getElementById('mentionDropdown');
  const list = document.getElementById('mentionList');
  
  if (filtered.length === 0) {
    dropdown.style.display = 'none';
    return;
  }
  
  list.innerHTML = filtered.map(m => `
    <div class="mention-item" data-user-id="${m.id}" data-user-name="${escapeHtml(m.name)}">
      <div class="mention-avatar">${m.avatar ? `<img src="${m.avatar}">` : m.name.charAt(0).toUpperCase()}</div>
      <span class="mention-name">${escapeHtml(m.name)}</span>
    </div>
  `).join('');
  
  dropdown.style.display = 'block';
  
  document.querySelectorAll('.mention-item').forEach(item => {
    item.addEventListener('click', () => {
      const userName = item.dataset.userName;
      const input = document.getElementById('messageInput');
      const text = input.value;
      const beforeMention = text.substring(0, mentionTriggerIndex);
      const afterMention = text.substring(mentionTriggerIndex + mentionSearchTerm.length + 1);
      input.value = `${beforeMention}@${userName} ${afterMention}`;
      hideMentionDropdown();
      input.focus();
    });
  });
}

function hideMentionDropdown() {
  const dropdown = document.getElementById('mentionDropdown');
  if (dropdown) dropdown.style.display = 'none';
  mentionTriggerIndex = -1;
}

// ========================================
// FORWARD MESSAGE FUNCTIONS
// ========================================
async function showForwardModal(messageData) {
  forwardMessageData = messageData;
  const modal = document.getElementById('forwardModal');
  const searchInput = document.getElementById('forwardSearch');
  const list = document.getElementById('forwardList');
  
  modal.style.display = 'flex';
  
  await loadForwardContacts(list);
  
  searchInput.addEventListener('input', () => {
    filterForwardContacts(searchInput.value, list);
  });
}

async function loadForwardContacts(container) {
  const contacts = [];
  
  const directChats = await db.collection('directChats')
    .where('participants', 'array-contains', currentUser.uid)
    .where('status', '==', 'active')
    .get();
  
  for (const doc of directChats.docs) {
    const otherUserId = doc.data().participants.find(id => id !== currentUser.uid);
    const userDoc = await db.collection('users').doc(otherUserId).get();
    if (userDoc.exists) {
      contacts.push({
        id: doc.id,
        type: 'personal',
        name: userDoc.data().displayName || userDoc.data().email,
        avatar: userDoc.data().avatar
      });
    }
  }
  
  const groupMemberships = await db.collection('groupMembers')
    .where('userId', '==', currentUser.uid)
    .get();
  
  for (const doc of groupMemberships.docs) {
    const groupDoc = await db.collection('groups').doc(doc.data().groupId).get();
    if (groupDoc.exists) {
      contacts.push({
        id: groupDoc.id,
        type: 'group',
        name: groupDoc.data().name,
        avatar: null
      });
    }
  }
  
  displayForwardContacts(container, contacts);
}

function displayForwardContacts(container, contacts) {
  container.innerHTML = contacts.map(contact => `
    <div class="forward-item" data-chat-id="${contact.id}" data-chat-type="${contact.type}" data-chat-name="${escapeHtml(contact.name)}">
      <div class="forward-avatar">${contact.type === 'group' ? '👥' : (contact.avatar ? `<img src="${contact.avatar}">` : '👤')}</div>
      <div class="forward-name">${escapeHtml(contact.name)}</div>
      <div class="forward-type">${contact.type === 'group' ? 'Group' : 'Contact'}</div>
    </div>
  `).join('');
  
  document.querySelectorAll('.forward-item').forEach(item => {
    item.addEventListener('click', async () => {
      const chatId = item.dataset.chatId;
      const chatType = item.dataset.chatType;
      const chatName = item.dataset.chatName;
      
      await forwardMessage(chatId, chatType);
      document.getElementById('forwardModal').style.display = 'none';
      showError(`Forwarded to ${chatName}`, false);
    });
  });
}

function filterForwardContacts(searchTerm, container) {
  const items = document.querySelectorAll('.forward-item');
  const term = searchTerm.toLowerCase();
  items.forEach(item => {
    const name = item.dataset.chatName.toLowerCase();
    if (name.includes(term)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

async function forwardMessage(targetChatId, targetChatType) {
  if (!forwardMessageData) return;
  
  const messageData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email.split('@')[0],
    text: forwardMessageData.text || '',
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    chatType: targetChatType,
    read: false,
    isForwarded: true,
    forwardedFrom: forwardMessageData.senderName
  };
  
  if (targetChatType === 'group') {
    messageData.groupId = targetChatId;
  } else {
    messageData.directId = targetChatId;
    messageData.participants = [currentUser.uid, targetChatId.split('_').find(id => id !== currentUser.uid)];
  }
  
  if (forwardMessageData.attachment) {
    messageData.attachment = forwardMessageData.attachment;
  }
  
  await db.collection('messages').add(messageData);
  forwardMessageData = null;
}

// ========================================
// DEACTIVATE ACCOUNT FUNCTION
// ========================================
async function deactivateAccount() {
  if (!confirm('⚠️ WARNING: Deactivating your account will:\n\n• Hide your profile from other users\n• Prevent you from sending/receiving messages\n• Your chat history will be preserved\n\nYou can reactivate by contacting support.\n\nAre you sure you want to deactivate your account?')) {
    return;
  }
  
  try {
    await db.collection('users').doc(currentUser.uid).update({
      isActive: false,
      deactivatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      onlineStatus: 'offline'
    });
    
    await auth.signOut();
    showError('Account deactivated successfully', false);
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Deactivation error:', error);
    showError('Failed to deactivate account');
  }
}

// ========================================
// CHAT REQUEST FUNCTIONS
// ========================================
async function sendChatRequest(receiverId, receiverName) {
  if (!currentUser) return;
  
  const blockCheck = await db.collection('blockedUsers')
    .where('userId', '==', receiverId)
    .where('blockedUserId', '==', currentUser.uid)
    .get();
  if (!blockCheck.empty) {
    showError('You cannot send request to this user');
    return;
  }
  
  const chatId = getDirectChatId(currentUser.uid, receiverId);
  const chatDoc = await db.collection('directChats').doc(chatId).get();
  if (chatDoc.exists && chatDoc.data().status === 'active') {
    showError('You already have an active chat with this user');
    return;
  }
  
  const existingRequest = await db.collection('chatRequests')
    .where('senderId', '==', currentUser.uid)
    .where('receiverId', '==', receiverId)
    .where('status', '==', 'pending')
    .get();
  if (!existingRequest.empty) {
    showError('Request already sent');
    return;
  }
  
  await db.collection('chatRequests').add({
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email,
    receiverId: receiverId,
    receiverName: receiverName,
    status: 'pending',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  showError('Chat request sent!', false);
}

async function acceptChatRequest(requestId, senderId) {
  await db.collection('chatRequests').doc(requestId).update({ status: 'accepted' });
  
  const chatId = getDirectChatId(currentUser.uid, senderId);
  await db.collection('directChats').doc(chatId).set({
    participants: [currentUser.uid, senderId],
    status: 'active',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastMessage: '',
    lastMessageTime: null
  });
  
  showError('Request accepted! You can now chat.', false);
  loadChatRequests();
  loadChatsList();
}

async function rejectChatRequest(requestId) {
  await db.collection('chatRequests').doc(requestId).update({ status: 'rejected' });
  showError('Request rejected', false);
  loadChatRequests();
}

async function blockUserFromRequest(requestId, senderId) {
  await db.collection('chatRequests').doc(requestId).update({ status: 'blocked' });
  await db.collection('blockedUsers').add({
    userId: currentUser.uid,
    blockedUserId: senderId,
    blockedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showError('User blocked', false);
  loadChatRequests();
}

async function blockUser(userId) {
  const existingBlock = await db.collection('blockedUsers')
    .where('userId', '==', currentUser.uid)
    .where('blockedUserId', '==', userId)
    .get();
  if (existingBlock.empty) {
    await db.collection('blockedUsers').add({
      userId: currentUser.uid,
      blockedUserId: userId,
      blockedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showError('User blocked', false);
  }
}

async function isUserBlocked(userId) {
  const blockCheck = await db.collection('blockedUsers')
    .where('userId', '==', userId)
    .where('blockedUserId', '==', currentUser.uid)
    .get();
  return !blockCheck.empty;
}

// ========================================
// DELETE ENTIRE CHAT
// ========================================
async function deleteEntireChat(chatId, isGroup = false) {
  if (!confirm('Are you sure you want to delete this entire chat? This cannot be undone.')) return;
  
  try {
    if (isGroup) {
      const messages = await db.collection('messages')
        .where('groupId', '==', chatId)
        .get();
      for (const doc of messages.docs) {
        let deleteFor = doc.data().deleteFor || [];
        if (!deleteFor.includes(currentUser.uid)) {
          deleteFor.push(currentUser.uid);
          await doc.ref.update({ deleteFor: deleteFor });
        }
      }
      await db.collection('userGroupStatus').doc(`${currentUser.uid}_${chatId}`).set({
        deleted: true,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } else {
      const messages = await db.collection('messages')
        .where('directId', '==', chatId)
        .get();
      for (const doc of messages.docs) {
        let deleteFor = doc.data().deleteFor || [];
        if (!deleteFor.includes(currentUser.uid)) {
          deleteFor.push(currentUser.uid);
          await doc.ref.update({ deleteFor: deleteFor });
        }
      }
      await db.collection('directChats').doc(chatId).update({
        status: 'deleted_for_' + currentUser.uid,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    showError('Chat deleted', false);
    loadChatsList();
  } catch (error) {
    console.error('Delete chat error:', error);
    showError('Failed to delete chat');
  }
}

// ========================================
// ARCHIVE FUNCTIONS
// ========================================
async function archiveChat(chatId, chatType, chatName) {
  const archiveRef = db.collection('archivedChats').doc(`${currentUser.uid}_${chatId}`);
  await archiveRef.set({
    userId: currentUser.uid,
    chatId: chatId,
    chatType: chatType,
    chatName: chatName,
    archivedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showError('Chat archived', false);
  loadChatsList();
  loadArchivedChats();
}

async function unarchiveChat(archiveId, chatId, chatType) {
  await db.collection('archivedChats').doc(archiveId).delete();
  showError('Chat unarchived', false);
  loadChatsList();
  loadArchivedChats();
}

async function loadArchivedChats() {
  const archiveList = document.getElementById('archiveList');
  if (!archiveList) return;
  
  const snapshot = await db.collection('archivedChats')
    .where('userId', '==', currentUser.uid)
    .orderBy('archivedAt', 'desc')
    .get();
  
  if (snapshot.empty) {
    archiveList.innerHTML = '<div class="empty-users"><div class="empty-icon">📦</div><p>No archived chats</p></div>';
    return;
  }
  
  archiveList.innerHTML = '';
  for (const doc of snapshot.docs) {
    const archive = doc.data();
    const archiveDiv = document.createElement('div');
    archiveDiv.className = 'archive-item';
    archiveDiv.dataset.archiveId = doc.id;
    archiveDiv.dataset.chatId = archive.chatId;
    archiveDiv.dataset.chatType = archive.chatType;
    archiveDiv.innerHTML = `
      <div class="chat-item">
        <div class="chat-item-info">
          <div class="chat-item-avatar">${archive.chatType === 'group' ? '👥' : '👤'}</div>
          <div class="chat-item-details">
            <div class="chat-item-name">${escapeHtml(archive.chatName)}</div>
            <div class="chat-item-preview">Archived on ${archive.archivedAt ? new Date(archive.archivedAt.toDate()).toLocaleDateString() : 'recently'}</div>
          </div>
        </div>
        <button class="chat-item-menu" data-archive-id="${doc.id}" data-chat-id="${archive.chatId}" data-chat-type="${archive.chatType}" data-chat-name="${escapeHtml(archive.chatName)}">⋮</button>
      </div>
    `;
    archiveList.appendChild(archiveDiv);
  }
  
  document.querySelectorAll('.archive-item .chat-item-menu').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      contextChatId = btn.dataset.chatId;
      contextChatType = btn.dataset.chatType;
      const archiveId = btn.dataset.archiveId;
      showArchiveContextMenu(e.clientX, e.clientY, archiveId);
    });
  });
  
  document.querySelectorAll('.archive-item .chat-item-info').forEach(el => {
    el.addEventListener('click', async () => {
      const parent = el.closest('.archive-item');
      const chatId = parent.dataset.chatId;
      const chatType = parent.dataset.chatType;
      if (chatType === 'group') {
        await loadGroupChat(chatId);
      } else {
        const otherUserId = chatId.split('_').find(id => id !== currentUser.uid);
        const userDoc = await db.collection('users').doc(otherUserId).get();
        if (userDoc.exists) {
          startDirectChat({ id: otherUserId, ...userDoc.data() });
        }
      }
    });
  });
}

// ========================================
// GROUP MANAGEMENT FUNCTIONS
// ========================================
async function createGroup(groupName, memberEmails = '') {
  if (!groupName.trim()) return;
  
  const groupCode = generateGroupCode();
  const members = [currentUser.uid];
  
  if (memberEmails.trim()) {
    const emails = memberEmails.split(',').map(e => e.trim().toLowerCase());
    for (const email of emails) {
      const userQuery = await db.collection('users').where('email', '==', email).get();
      if (!userQuery.empty) {
        members.push(userQuery.docs[0].id);
      }
    }
  }
  
  try {
    const groupRef = await db.collection('groups').add({
      name: groupName.trim(),
      code: groupCode,
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      memberCount: members.length
    });
    
    for (const memberId of members) {
      await db.collection('groupMembers').add({
        groupId: groupRef.id,
        userId: memberId,
        role: memberId === currentUser.uid ? 'admin' : 'member',
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    showError('Group created successfully!', false);
    loadGroupsList();
    return groupRef.id;
  } catch (error) {
    console.error('Create group error:', error);
    showError('Failed to create group');
    return null;
  }
}

async function loadGroupsList() {
  if (!currentUser) return;
  
  const groupsList = document.getElementById('groupsList');
  if (!groupsList) return;
  
  groupsList.innerHTML = '<div class="loading">Loading groups...</div>';
  
  try {
    const memberSnapshot = await db.collection('groupMembers')
      .where('userId', '==', currentUser.uid)
      .get();
    
    const groups = [];
    for (const memberDoc of memberSnapshot.docs) {
      const groupDoc = await db.collection('groups').doc(memberDoc.data().groupId).get();
      if (groupDoc.exists) {
        groups.push({ id: groupDoc.id, ...groupDoc.data(), role: memberDoc.data().role });
      }
    }
    
    if (groups.length === 0) {
      groupsList.innerHTML = '<div class="empty-users"><div class="empty-icon">👥</div><p>No groups yet. Create or join one!</p></div>';
      return;
    }
    
    groupsList.innerHTML = '';
    for (const group of groups) {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'chat-item';
      groupDiv.dataset.groupId = group.id;
      groupDiv.dataset.role = group.role;
      groupDiv.innerHTML = `
        <div class="chat-item-info">
          <div class="chat-item-avatar">👥</div>
          <div class="chat-item-details">
            <div class="chat-item-name">${escapeHtml(group.name)}</div>
            <div class="chat-item-preview">${group.memberCount || 0} members • ${group.role === 'admin' ? 'Admin' : 'Member'}</div>
          </div>
        </div>
        <button class="chat-item-menu" data-group-id="${group.id}" data-group-name="${escapeHtml(group.name)}" data-group-role="${group.role}">⋮</button>
      `;
      groupDiv.querySelector('.chat-item-info').addEventListener('click', () => loadGroupChat(group.id, group.name));
      groupsList.appendChild(groupDiv);
    }
    
    document.querySelectorAll('.chat-item-menu[data-group-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        contextGroupId = btn.dataset.groupId;
        const groupName = btn.dataset.groupName;
        const role = btn.dataset.groupRole;
        showGroupContextMenu(e.clientX, e.clientY, groupName, role);
      });
    });
  } catch (error) {
    console.error('Load groups error:', error);
    groupsList.innerHTML = '<div class="empty-users"><div class="empty-icon">⚠️</div><p>Error loading groups</p></div>';
  }
}

async function loadGroupChat(groupId, groupName) {
  currentChat = { id: groupId, name: groupName, type: 'group' };
  currentChatType = 'group';
  currentGroup = { id: groupId, name: groupName };
  
  document.getElementById('currentChatName').textContent = groupName;
  document.getElementById('chatType').textContent = 'Group Chat';
  document.getElementById('chatStatusBadge').innerHTML = '';
  document.getElementById('messageInputArea').style.display = 'block';
  document.getElementById('groupInfoBtn').style.display = 'flex';
  clearReplyTo();
  
  loadGroupMessages();
  setupTypingListener();
  loadPinnedMessages();
}

async function addGroupMember(groupId, email) {
  const userQuery = await db.collection('users').where('email', '==', email.toLowerCase()).get();
  if (userQuery.empty) {
    showError('User not found');
    return;
  }
  
  const newMemberId = userQuery.docs[0].id;
  const existingMember = await db.collection('groupMembers')
    .where('groupId', '==', groupId)
    .where('userId', '==', newMemberId)
    .get();
  
  if (!existingMember.empty) {
    showError('User already in group');
    return;
  }
  
  await db.collection('groupMembers').add({
    groupId: groupId,
    userId: newMemberId,
    role: 'member',
    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  await db.collection('groups').doc(groupId).update({
    memberCount: firebase.firestore.FieldValue.increment(1)
  });
  
  showError('Member added', false);
  loadGroupInfo(groupId);
}

async function removeGroupMember(groupId, memberId, memberName) {
  if (!confirm(`Remove ${memberName} from group?`)) return;
  
  await db.collection('groupMembers')
    .where('groupId', '==', groupId)
    .where('userId', '==', memberId)
    .get()
    .then(snapshot => snapshot.forEach(doc => doc.ref.delete()));
  
  await db.collection('groups').doc(groupId).update({
    memberCount: firebase.firestore.FieldValue.increment(-1)
  });
  
  showError('Member removed', false);
  loadGroupInfo(groupId);
}

async function makeGroupAdmin(groupId, memberId, memberName) {
  if (!confirm(`Make ${memberName} an admin?`)) return;
  
  const memberDoc = await db.collection('groupMembers')
    .where('groupId', '==', groupId)
    .where('userId', '==', memberId)
    .get();
  
  memberDoc.forEach(doc => doc.ref.update({ role: 'admin' }));
  showError(`${memberName} is now an admin`, false);
  loadGroupInfo(groupId);
}

async function leaveGroup(groupId, groupName) {
  if (!confirm(`Are you sure you want to leave "${groupName}"?`)) return;
  
  await db.collection('groupMembers')
    .where('groupId', '==', groupId)
    .where('userId', '==', currentUser.uid)
    .get()
    .then(snapshot => snapshot.forEach(doc => doc.ref.delete()));
  
  await db.collection('groups').doc(groupId).update({
    memberCount: firebase.firestore.FieldValue.increment(-1)
  });
  
  showError('You left the group', false);
  if (currentChat?.id === groupId) {
    currentChat = null;
    document.getElementById('messagesArea').innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>Select a chat to start messaging</p></div>';
    document.getElementById('messageInputArea').style.display = 'none';
  }
  loadGroupsList();
  loadChatsList();
}

async function deleteGroup(groupId, groupName) {
  if (!confirm(`WARNING: Delete "${groupName}" permanently for EVERYONE? This cannot be undone.`)) return;
  
  const messages = await db.collection('messages').where('groupId', '==', groupId).get();
  for (const doc of messages.docs) {
    await doc.ref.delete();
  }
  
  const members = await db.collection('groupMembers').where('groupId', '==', groupId).get();
  for (const doc of members.docs) {
    await doc.ref.delete();
  }
  
  await db.collection('groups').doc(groupId).delete();
  
  showError('Group deleted', false);
  if (currentChat?.id === groupId) {
    currentChat = null;
    document.getElementById('messagesArea').innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>Select a chat to start messaging</p></div>';
    document.getElementById('messageInputArea').style.display = 'none';
  }
  loadGroupsList();
  loadChatsList();
}

async function updateGroupName(groupId, newName) {
  if (!newName.trim()) return;
  await db.collection('groups').doc(groupId).update({ name: newName.trim() });
  showError('Group name updated', false);
  loadGroupsList();
  if (currentChat?.id === groupId) {
    document.getElementById('currentChatName').textContent = newName;
  }
}

async function loadGroupInfo(groupId) {
  const groupDoc = await db.collection('groups').doc(groupId).get();
  if (!groupDoc.exists) return;
  const group = groupDoc.data();
  
  const membersSnapshot = await db.collection('groupMembers')
    .where('groupId', '==', groupId)
    .get();
  
  const members = [];
  for (const memberDoc of membersSnapshot.docs) {
    const userDoc = await db.collection('users').doc(memberDoc.data().userId).get();
    if (userDoc.exists) {
      members.push({
        id: memberDoc.data().userId,
        name: userDoc.data().displayName || userDoc.data().email,
        role: memberDoc.data().role
      });
    }
  }
  currentGroupMembers = members;
  
  document.getElementById('editGroupNameInput').value = group.name;
  document.getElementById('groupCodeDisplay').value = group.code;
  
  const membersList = document.getElementById('membersList');
  membersList.innerHTML = '';
  members.forEach(member => {
    const isAdmin = member.role === 'admin';
    const isCurrentUser = member.id === currentUser.uid;
    const currentUserRole = members.find(m => m.id === currentUser.uid)?.role;
    const canModify = currentUserRole === 'admin' && !isCurrentUser;
    
    const memberDiv = document.createElement('div');
    memberDiv.className = 'member-item';
    memberDiv.dataset.memberId = member.id;
    memberDiv.dataset.memberName = member.name;
    memberDiv.innerHTML = `
      <div class="member-info">
        <div class="member-avatar">${member.name.charAt(0).toUpperCase()}</div>
        <div>
          <span class="member-name">${escapeHtml(member.name)}</span>
          ${isAdmin ? '<span class="member-role">Admin</span>' : ''}
          ${isCurrentUser ? '<span class="member-role">You</span>' : ''}
        </div>
      </div>
      ${canModify ? `
        <div class="member-actions">
          ${!isAdmin ? `<button class="member-action-btn make-admin-btn" data-id="${member.id}" data-name="${escapeHtml(member.name)}">👑 Make Admin</button>` : ''}
          <button class="member-action-btn remove-member-btn" data-id="${member.id}" data-name="${escapeHtml(member.name)}">❌ Remove</button>
        </div>
      ` : ''}
    `;
    membersList.appendChild(memberDiv);
  });
  
  document.querySelectorAll('.make-admin-btn').forEach(btn => {
    btn.addEventListener('click', () => makeGroupAdmin(groupId, btn.dataset.id, btn.dataset.name));
  });
  document.querySelectorAll('.remove-member-btn').forEach(btn => {
    btn.addEventListener('click', () => removeGroupMember(groupId, btn.dataset.id, btn.dataset.name));
  });
  
  document.getElementById('groupInfoModal').style.display = 'flex';
}

// ========================================
// CHAT LIST FUNCTIONS
// ========================================
async function loadChatsList() {
  if (!currentUser) return;
  
  const activeChats = [];
  
  const directChats = await db.collection('directChats')
    .where('participants', 'array-contains', currentUser.uid)
    .where('status', '==', 'active')
    .get();
  
  for (const doc of directChats.docs) {
    const chat = doc.data();
    const otherUserId = chat.participants.find(id => id !== currentUser.uid);
    if (otherUserId) {
      const userDoc = await db.collection('users').doc(otherUserId).get();
      if (userDoc.exists && userDoc.data().isActive !== false) {
        activeChats.push({
          id: doc.id,
          type: 'personal',
          name: userDoc.data().displayName || userDoc.data().email,
          avatar: userDoc.data().avatar,
          lastMessage: chat.lastMessage,
          lastMessageTime: chat.lastMessageTime,
          status: chat.status
        });
      }
    }
  }
  
  const groupMemberships = await db.collection('groupMembers')
    .where('userId', '==', currentUser.uid)
    .get();
  
  for (const memberDoc of groupMemberships.docs) {
    const groupDoc = await db.collection('groups').doc(memberDoc.data().groupId).get();
    if (groupDoc.exists && !groupDoc.data().deletedFor?.includes(currentUser.uid)) {
      activeChats.push({
        id: groupDoc.id,
        type: 'group',
        name: groupDoc.data().name,
        avatar: null,
        lastMessage: null,
        lastMessageTime: null
      });
    }
  }
  
  activeChats.sort((a, b) => (b.lastMessageTime?.toMillis() || 0) - (a.lastMessageTime?.toMillis() || 0));
  
  const chatsList = document.getElementById('usersList');
  if (chatsList) {
    if (activeChats.length === 0) {
      chatsList.innerHTML = '<div class="empty-users"><div class="empty-icon">💬</div><p>No active chats yet. Search to start a conversation!</p></div>';
      return;
    }
    
    chatsList.innerHTML = '';
    for (const chat of activeChats) {
      const chatDiv = document.createElement('div');
      chatDiv.className = 'chat-item';
      chatDiv.dataset.chatId = chat.id;
      chatDiv.dataset.chatType = chat.type;
      const isMuted = isChatMuted(chat.id);
      chatDiv.innerHTML = `
        <div class="chat-item-info">
          <div class="chat-item-avatar">${chat.type === 'group' ? '👥' : (chat.avatar ? `<img src="${chat.avatar}">` : '👤')}</div>
          <div class="chat-item-details">
            <div class="chat-item-name">${escapeHtml(chat.name)}${isMuted ? ' <span class="muted-badge">Muted</span>' : ''}</div>
            <div class="chat-item-preview">${chat.lastMessage ? escapeHtml(chat.lastMessage.substring(0, 50)) : 'No messages yet'}</div>
          </div>
        </div>
        <button class="chat-item-menu" data-chat-id="${chat.id}" data-chat-type="${chat.type}" data-chat-name="${escapeHtml(chat.name)}">⋮</button>
      `;
      chatDiv.querySelector('.chat-item-info').addEventListener('click', () => {
        if (chat.type === 'group') {
          loadGroupChat(chat.id, chat.name);
        } else {
          const otherUserId = chat.id.split('_').find(id => id !== currentUser.uid);
          db.collection('users').doc(otherUserId).get().then(doc => {
            if (doc.exists) startDirectChat({ id: otherUserId, ...doc.data() });
          });
        }
      });
      chatsList.appendChild(chatDiv);
    }
    
    document.querySelectorAll('.chat-item-menu').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        contextChatId = btn.dataset.chatId;
        contextChatType = btn.dataset.chatType;
        const chatName = btn.dataset.chatName;
        showChatContextMenu(e.clientX, e.clientY, chatName);
      });
    });
  }
}

// ========================================
// CONTEXT MENUS
// ========================================
function showChatContextMenu(x, y, chatName) {
  const menu = document.getElementById('chatContextMenu');
  if (!menu) return;
  
  const isMuted = isChatMuted(contextChatId);
  const muteItem = document.getElementById('muteChatMenuItem');
  if (muteItem) {
    muteItem.textContent = isMuted ? '🔊 Unmute' : '🔇 Mute';
  }
  
  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  
  const hideMenu = () => menu.style.display = 'none';
  setTimeout(() => {
    document.addEventListener('click', hideMenu);
    document.addEventListener('touchstart', hideMenu);
  }, 10);
}

function showGroupContextMenu(x, y, groupName, role) {
  const menu = document.getElementById('groupContextMenu');
  if (!menu) return;
  
  const adminOptions = ['editGroupNameMenuItem', 'addMemberMenuItem', 'deleteGroupMenuItem'];
  adminOptions.forEach(opt => {
    const el = document.getElementById(opt);
    if (el) el.style.display = role === 'admin' ? 'flex' : 'none';
  });
  
  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  
  const hideMenu = () => menu.style.display = 'none';
  setTimeout(() => {
    document.addEventListener('click', hideMenu);
    document.addEventListener('touchstart', hideMenu);
  }, 10);
}

function showArchiveContextMenu(x, y, archiveId) {
  const menu = document.getElementById('archiveContextMenu');
  if (!menu) return;
  
  menu.dataset.archiveId = archiveId;
  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  
  const hideMenu = () => menu.style.display = 'none';
  setTimeout(() => {
    document.addEventListener('click', hideMenu);
    document.addEventListener('touchstart', hideMenu);
  }, 10);
}

// Context menu action handlers
document.getElementById('deleteChatMenuItem')?.addEventListener('click', () => {
  deleteEntireChat(contextChatId, contextChatType === 'group');
  document.getElementById('chatContextMenu').style.display = 'none';
});

document.getElementById('archiveChatMenuItem')?.addEventListener('click', async () => {
  let chatName = '';
  if (contextChatType === 'group') {
    const groupDoc = await db.collection('groups').doc(contextChatId).get();
    chatName = groupDoc.data()?.name || 'Group';
  } else {
    const otherUserId = contextChatId.split('_').find(id => id !== currentUser.uid);
    const userDoc = await db.collection('users').doc(otherUserId).get();
    chatName = userDoc.data()?.displayName || userDoc.data()?.email || 'User';
  }
  archiveChat(contextChatId, contextChatType, chatName);
  document.getElementById('chatContextMenu').style.display = 'none';
});

document.getElementById('muteChatMenuItem')?.addEventListener('click', () => {
  if (isChatMuted(contextChatId)) {
    unmuteChat(contextChatId);
  } else {
    const duration = prompt('Mute for: 8h, 7d, always? (Enter 8h, 7d, or always)', '8h');
    if (duration && ['8h', '7d', 'always'].includes(duration)) {
      muteChat(contextChatId, duration);
    }
  }
  document.getElementById('chatContextMenu').style.display = 'none';
});

document.getElementById('blockUserMenuItem')?.addEventListener('click', async () => {
  const otherUserId = contextChatId.split('_').find(id => id !== currentUser.uid);
  if (otherUserId) {
    await blockUser(otherUserId);
    await deleteEntireChat(contextChatId, false);
  }
  document.getElementById('chatContextMenu').style.display = 'none';
});

document.getElementById('unarchiveMenuItem')?.addEventListener('click', () => {
  const archiveId = document.getElementById('archiveContextMenu').dataset.archiveId;
  unarchiveChat(archiveId, contextChatId, contextChatType);
  document.getElementById('archiveContextMenu').style.display = 'none';
});

document.getElementById('editGroupNameMenuItem')?.addEventListener('click', () => {
  const newName = prompt('Enter new group name:', '');
  if (newName) updateGroupName(contextGroupId, newName);
  document.getElementById('groupContextMenu').style.display = 'none';
});

document.getElementById('addMemberMenuItem')?.addEventListener('click', () => {
  const email = prompt('Enter email address of person to add:');
  if (email) addGroupMember(contextGroupId, email);
  document.getElementById('groupContextMenu').style.display = 'none';
});

document.getElementById('leaveGroupMenuItem')?.addEventListener('click', () => {
  leaveGroup(contextGroupId, 'Group');
  document.getElementById('groupContextMenu').style.display = 'none';
});

document.getElementById('deleteGroupMenuItem')?.addEventListener('click', () => {
  deleteGroup(contextGroupId, 'Group');
  document.getElementById('groupContextMenu').style.display = 'none';
});

document.getElementById('groupInfoMenuItem')?.addEventListener('click', () => {
  loadGroupInfo(contextGroupId);
  document.getElementById('groupContextMenu').style.display = 'none';
});

// ========================================
// LOAD CHAT REQUESTS
// ========================================
async function loadChatRequests() {
  const requestsList = document.getElementById('requestsList');
  if (!requestsList) return;
  
  const snapshot = await db.collection('chatRequests')
    .where('receiverId', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .orderBy('timestamp', 'desc')
    .get();
  
  if (snapshot.empty) {
    requestsList.innerHTML = '<div class="empty-users"><div class="empty-icon">🔔</div><p>No pending requests</p></div>';
    return;
  }
  
  requestsList.innerHTML = '';
  for (const doc of snapshot.docs) {
    const request = doc.data();
    const requestDiv = document.createElement('div');
    requestDiv.className = 'chat-item';
    requestDiv.innerHTML = `
      <div class="chat-item-info">
        <div class="chat-item-avatar">👤</div>
        <div class="chat-item-details">
          <div class="chat-item-name">${escapeHtml(request.senderName)}</div>
          <div class="chat-item-preview">Wants to chat with you</div>
        </div>
      </div>
      <div class="request-actions" style="display:flex; gap:8px;">
        <button class="request-accept" data-id="${doc.id}" data-sender="${request.senderId}">Accept</button>
        <button class="request-reject" data-id="${doc.id}">Reject</button>
        <button class="request-block" data-id="${doc.id}" data-sender="${request.senderId}">Block</button>
      </div>
    `;
    requestsList.appendChild(requestDiv);
  }
  
  document.querySelectorAll('.request-accept').forEach(btn => {
    btn.addEventListener('click', () => acceptChatRequest(btn.dataset.id, btn.dataset.sender));
  });
  document.querySelectorAll('.request-reject').forEach(btn => {
    btn.addEventListener('click', () => rejectChatRequest(btn.dataset.id));
  });
  document.querySelectorAll('.request-block').forEach(btn => {
    btn.addEventListener('click', () => blockUserFromRequest(btn.dataset.id, btn.dataset.sender));
  });
}

// ========================================
// PHONE NUMBER FUNCTIONS
// ========================================
async function updateUserPhoneNumber(countryCode, phoneNumber) {
  if (!currentUser) return false;
  
  if (!isValidPhoneNumber(phoneNumber)) {
    showError('Please enter a valid 10-digit phone number');
    return false;
  }
  
  const fullPhoneNumber = countryCode + phoneNumber;
  try {
    await db.collection('users').doc(currentUser.uid).update({
      phoneNumber: fullPhoneNumber,
      phoneCountryCode: countryCode,
      phoneNumberRaw: phoneNumber
    });
    showError('Phone number saved successfully!', false);
    return true;
  } catch (error) {
    console.error('Save phone error:', error);
    showError('Failed to save phone number');
    return false;
  }
}

// ========================================
// SEARCH USERS WITH "NO OTHER USERS" MESSAGE
// ========================================
function searchUsers(searchTerm) {
  const usersList = document.getElementById('usersList');
  const errorDiv = document.getElementById('searchError');
  
  if (errorDiv) errorDiv.style.display = 'none';
  
  if (!searchTerm || searchTerm.trim() === '') {
    if (allUsers.length === 0) {
      usersList.innerHTML = '<div class="empty-users"><div class="empty-icon">👤</div><p>No other users registered yet.</p><small>Share this link with your team members to invite them!</small></div>';
    } else {
      usersList.innerHTML = '<div class="empty-users"><div class="empty-icon">🔍</div><p>Search by name, email, or phone to find users</p></div>';
    }
    return;
  }
  
  const validation = validateSearchTerm(searchTerm);
  
  if (!validation.valid) {
    if (errorDiv) {
      errorDiv.textContent = validation.error;
      errorDiv.style.display = 'flex';
    }
    usersList.innerHTML = '<div class="empty-users"><div class="empty-icon">⚠️</div><p>Please correct the search term</p></div>';
    return;
  }
  
  if (errorDiv) errorDiv.style.display = 'none';
  
  let filtered = [];
  const term = validation.value;
  
  if (validation.type === 'email') {
    filtered = allUsers.filter(user => (user.email || '').toLowerCase() === term);
  } else if (validation.type === 'phone') {
    filtered = allUsers.filter(user => (user.phoneNumberRaw || '') === term);
  } else {
    filtered = allUsers.filter(user => (user.displayName || '').toLowerCase().includes(term));
  }
  
  filtered = filtered.filter(user => user.isActive !== false);
  
  if (filtered.length === 0) {
    usersList.innerHTML = '<div class="empty-users"><div class="empty-icon">👤</div><p>No users found</p><small>Try a different search term</small></div>';
    return;
  }
  
  usersList.innerHTML = '';
  filtered.forEach(user => {
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-item';
    userDiv.innerHTML = `
      <div class="chat-item-info">
        <div class="chat-item-avatar">${user.avatar ? `<img src="${user.avatar}">` : (user.displayName ? user.displayName[0].toUpperCase() : '👤')}</div>
        <div class="chat-item-details">
          <div class="chat-item-name">${escapeHtml(user.displayName || 'User')}</div>
          <div class="chat-item-preview">${escapeHtml(user.email || '')}${user.phoneNumberRaw ? ` • 📱${user.phoneNumberRaw}` : ''}</div>
        </div>
      </div>
    `;
    userDiv.addEventListener('click', () => showUserProfileForRequest(user));
    usersList.appendChild(userDiv);
  });
}

async function showUserProfileForRequest(user) {
  selectedUserForRequest = user;
  
  const messagesArea = document.getElementById('messagesArea');
  const existingChat = await checkExistingChat(user.id);
  
  if (existingChat) {
    startDirectChat(user);
    return;
  }
  
  messagesArea.innerHTML = `
    <div class="profile-view-container">
      <div class="profile-view-card">
        <div class="profile-view-avatar">${user.avatar ? `<img src="${user.avatar}">` : (user.displayName ? user.displayName[0].toUpperCase() : '👤')}</div>
        <h3>${escapeHtml(user.displayName || 'User')}</h3>
        <p>${escapeHtml(user.email || '')}</p>
        ${user.phoneNumberRaw ? `<p>📱 ${escapeHtml(user.phoneNumberRaw)}</p>` : ''}
        <div class="profile-view-status">${user.onlineStatus === 'online' ? '🟢 Online' : (user.onlineStatus === 'busy' ? '🟠 Busy' : '🔴 Away')}</div>
        <div class="profile-view-actions">
          <button id="sendChatRequestBtn" class="btn btn-primary">Send Chat Request</button>
          <button id="cancelRequestBtn" class="btn btn-outline">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('sendChatRequestBtn')?.addEventListener('click', async () => {
    await sendChatRequest(user.id, user.displayName || user.email);
    messagesArea.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>Chat request sent!</p></div>';
    setTimeout(() => {
      if (currentChat?.id !== getDirectChatId(currentUser.uid, user.id)) {
        messagesArea.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>Select a chat to start messaging</p></div>';
      }
    }, 2000);
  });
  
  document.getElementById('cancelRequestBtn')?.addEventListener('click', () => {
    messagesArea.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>Select a chat to start messaging</p></div>';
    selectedUserForRequest = null;
  });
}

async function checkExistingChat(userId) {
  const chatId = getDirectChatId(currentUser.uid, userId);
  const chatDoc = await db.collection('directChats').doc(chatId).get();
  return chatDoc.exists && chatDoc.data().status === 'active';
}

// ========================================
// START DIRECT CHAT
// ========================================
async function startDirectChat(user) {
  if (await isUserBlocked(user.id)) {
    showError('You cannot chat with this user');
    return;
  }
  
  if (user.isActive === false) {
    showError('This account has been deactivated');
    return;
  }
  
  const chatId = getDirectChatId(currentUser.uid, user.id);
  const chatDoc = await db.collection('directChats').doc(chatId).get();
  
  if (chatDoc.exists && chatDoc.data().status === 'active') {
    currentChat = { id: chatId, otherUserId: user.id, otherUserName: user.displayName || user.email, type: 'direct' };
    currentChatType = 'direct';
    document.getElementById('currentChatName').textContent = user.displayName || user.email;
    document.getElementById('chatType').textContent = 'Personal Chat';
    document.getElementById('groupInfoBtn').style.display = 'none';
    const statusBadge = document.getElementById('chatStatusBadge');
    if (user.onlineStatus === 'online') statusBadge.innerHTML = '🟢 Online';
    else if (user.onlineStatus === 'busy') statusBadge.innerHTML = '🟠 Busy';
    else statusBadge.innerHTML = '🔴 Away';
    statusBadge.className = `chat-status-badge ${user.onlineStatus || 'online'}`;
    
    const lastSeenBadge = document.getElementById('lastSeenBadge');
    if (user.onlineStatus === 'online') {
      lastSeenBadge.style.display = 'none';
    } else {
      lastSeenBadge.style.display = 'inline-block';
      lastSeenBadge.textContent = formatLastSeen(user.lastSeen);
    }
    
    document.getElementById('messageInputArea').style.display = 'block';
    closeMobileMenuOnChat();
    clearReplyTo();
    await markMessagesAsRead(chatId, false);
    loadDirectMessages();
    setupTypingListener();
    loadChatsList();
    loadPinnedMessages();
  } else {
    showUserProfileForRequest(user);
  }
}

function setupTypingListener() {
  if (!currentChat) return;
  const typingRef = db.collection('typingIndicators').where('chatId', '==', currentChat.id);
  typingRef.onSnapshot(snapshot => {
    const typingUsers = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId !== currentUser.uid) typingUsers.push(data.userName);
    });
    const indicator = document.getElementById('typingIndicator');
    if (typingUsers.length > 0) {
      indicator.textContent = `${typingUsers.join(', ')} ${typingUsers.length === 1 ? 'is' : 'are'} typing...`;
      indicator.style.display = 'block';
    } else {
      indicator.style.display = 'none';
    }
  });
}

// ========================================
// FILE TYPE DETECTION & VALIDATION
// ========================================
function getFileTypeInfo(filename, mimeType) {
  const ext = filename.split('.').pop().toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext) || mimeType?.startsWith('image/')) {
    return { type: 'image', icon: '🖼️', badge: 'Image', maxSize: 10 };
  }
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return { type: 'pdf', icon: '📕', badge: 'PDF', maxSize: 10 };
  }
  if (['doc', 'docx'].includes(ext) || mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return { type: 'word', icon: '📘', badge: 'Word', maxSize: 10 };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType === 'application/vnd.ms-excel' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return { type: 'excel', icon: '📗', badge: 'Excel', maxSize: 10 };
  }
  if (['ppt', 'pptx'].includes(ext) || mimeType === 'application/vnd.ms-powerpoint' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return { type: 'ppt', icon: '📙', badge: 'PowerPoint', maxSize: 10 };
  }
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext) || mimeType?.startsWith('video/')) {
    return { type: 'video', icon: '🎥', badge: 'Video', maxSize: 100 };
  }
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext) || mimeType?.startsWith('audio/')) {
    return { type: 'audio', icon: '🎵', badge: 'Audio', maxSize: 10 };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { type: 'archive', icon: '🗜️', badge: 'Archive', maxSize: 10 };
  }
  return { type: 'file', icon: '📄', badge: 'File', maxSize: 10 };
}

function validateFileSize(file) {
  const fileInfo = getFileTypeInfo(file.name, file.type);
  const maxSizeMB = fileInfo.maxSize;
  const fileSizeMB = file.size / (1024 * 1024);
  
  if (fileSizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `File too large. Maximum allowed for ${fileInfo.badge} files is ${maxSizeMB} MB. Your file: ${fileSizeMB.toFixed(1)} MB`
    };
  }
  return { valid: true, fileInfo: fileInfo };
}

// ========================================
// FILE UPLOAD WITH PROGRESS
// ========================================
async function uploadToCloudinaryWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    const xhr = new XMLHttpRequest();
    currentUploadXHR = xhr;
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`);
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };
    
    xhr.onload = () => {
      currentUploadXHR = null;
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.secure_url) {
            const fileInfo = getFileTypeInfo(file.name, file.type);
            resolve({
              url: data.secure_url,
              type: fileInfo.type,
              filename: file.name,
              size: file.size,
              icon: fileInfo.icon,
              badge: fileInfo.badge
            });
          } else {
            reject(new Error('Upload failed'));
          }
        } catch (e) {
          reject(new Error('Invalid response'));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    
    xhr.onerror = () => {
      currentUploadXHR = null;
      reject(new Error('Network error'));
    };
    xhr.send(formData);
  });
}

function cancelCurrentUpload() {
  if (currentUploadXHR) {
    currentUploadXHR.abort();
    currentUploadXHR = null;
  }
  currentFileUploading = false;
  currentFile = null;
}

// ========================================
// ATTACHMENT DISPLAY
// ========================================
function displayAttachment(attachment) {
  if (!attachment) return '';
  
  const url = attachment.url;
  const filename = attachment.filename || 'file';
  const fileType = attachment.type || 'file';
  const fileSize = attachment.size ? formatFileSize(attachment.size) : '';
  const icon = attachment.icon || '📄';
  
  if (fileType === 'image') {
    return `
      <div class="message-attachment image-attachment">
        <img src="${url}" class="message-image" onclick="window.open('${url}','_blank')" alt="${escapeHtml(filename)}" loading="lazy">
        <div class="attachment-filename">${escapeHtml(filename)} ${fileSize ? `(${fileSize})` : ''}</div>
      </div>
    `;
  }
  
  if (fileType === 'voice') {
    return `
      <div class="message-attachment voice-attachment">
        <div class="voice-message">
          <button class="voice-play-btn" data-url="${url}">▶️</button>
          <div class="voice-waveform"></div>
          <span class="voice-duration">${formatDuration(attachment.duration || 5)}</span>
        </div>
        <div class="attachment-filename">🎤 Voice message</div>
      </div>
    `;
  }
  
  if (fileType === 'video') {
    return `
      <div class="message-attachment video-attachment">
        <video src="${url}" controls preload="metadata" style="max-width:280px; max-height:200px; border-radius:12px;"></video>
        <div class="attachment-filename">${icon} ${escapeHtml(filename)} ${fileSize ? `(${fileSize})` : ''}</div>
      </div>
    `;
  }
  
  if (fileType === 'audio') {
    return `
      <div class="message-attachment audio-attachment">
        <audio src="${url}" controls style="width:250px;"></audio>
        <div class="attachment-filename">${icon} ${escapeHtml(filename)} ${fileSize ? `(${fileSize})` : ''}</div>
      </div>
    `;
  }
  
  let badgeText = '';
  if (fileType === 'pdf') badgeText = 'PDF';
  else if (fileType === 'word') badgeText = 'Word';
  else if (fileType === 'excel') badgeText = 'Excel';
  else if (fileType === 'ppt') badgeText = 'PowerPoint';
  else if (fileType === 'archive') badgeText = 'Archive';
  else badgeText = 'File';
  
  return `
    <div class="message-attachment document-attachment ${fileType}-attachment">
      <div class="document-icon">${icon}</div>
      <div class="document-info">
        <div class="document-name">${escapeHtml(filename)}</div>
        <div class="document-badge">${badgeText} ${fileSize ? `• ${fileSize}` : ''}</div>
      </div>
      <button class="download-btn" onclick="window.open('${url}','_blank')">📥 Download</button>
    </div>
  `;
}

// ========================================
// SEND MESSAGE (with reply support)
// ========================================
async function sendMessage(text, attachment = null) {
  if (!currentChat) return;
  
  if (isChatMuted(currentChat.id)) {
    showError('This chat is muted. Unmute to send messages.');
    return;
  }
  
  try {
    const messageData = {
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email.split('@')[0],
      text: text?.trim() || '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      chatType: currentChatType,
      read: false,
      edited: false,
      deleteFor: []
    };
    
    if (currentChatType === 'group') {
      messageData.groupId = currentChat.id;
    } else {
      messageData.directId = currentChat.id;
      messageData.participants = [currentUser.uid, currentChat.otherUserId];
    }
    
    if (attachment) {
      messageData.attachment = attachment;
    }
    
    if (replyToMessage) {
      messageData.replyToId = replyToMessage.id;
      messageData.replyToText = replyToMessage.text;
      messageData.replyToSender = replyToMessage.sender;
      if (replyToMessage.attachment) {
        messageData.replyToAttachment = replyToMessage.attachment;
      }
      clearReplyTo();
    }
    
    await db.collection('messages').add(messageData);
    
    let lastMessageText = text?.trim() || '';
    if (attachment) {
      if (attachment.type === 'image') lastMessageText = `📷 Photo`;
      else if (attachment.type === 'video') lastMessageText = `🎥 Video`;
      else if (attachment.type === 'audio') lastMessageText = `🎵 Audio`;
      else if (attachment.type === 'voice') lastMessageText = `🎤 Voice message`;
      else lastMessageText = `📎 ${attachment.filename}`;
    }
    
    if (replyToMessage) {
      lastMessageText = `↩️ Replied to ${replyToMessage.sender}: ${lastMessageText}`;
    }
    
    if (currentChatType === 'group') {
      await db.collection('groups').doc(currentChat.id).update({
        lastMessage: lastMessageText,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const chatId = getDirectChatId(currentUser.uid, currentChat.otherUserId);
      await db.collection('directChats').doc(chatId).set({
        participants: [currentUser.uid, currentChat.otherUserId],
        lastMessage: lastMessageText,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageSender: currentUser.uid,
        status: 'active'
      }, { merge: true });
    }
    
    if (soundEnabled && !isChatMuted(currentChat.id)) playNotificationSound();
    loadChatsList();
  } catch (error) {
    console.error('Send message error:', error);
    showError('Failed to send message: ' + error.message);
  }
}

function playNotificationSound() {
  if (!soundEnabled) return;
  try {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,U3RlYWx0aCBzb3VuZA==';
    audio.play().catch(() => {});
  } catch(e) {}
}

// ========================================
// EDIT MESSAGE
// ========================================
async function editMessage(messageId, newText) {
  if (!messageId || !newText.trim()) return;
  
  try {
    const messageRef = db.collection('messages').doc(messageId);
    const messageDoc = await messageRef.get();
    
    if (!messageDoc.exists) return;
    const message = messageDoc.data();
    
    if (message.read === true) {
      showError('Cannot edit message after it has been read');
      return;
    }
    if (message.senderId !== currentUser.uid) {
      showError('You can only edit your own messages');
      return;
    }
    
    await messageRef.update({
      text: newText.trim(),
      edited: true,
      editedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showError('Message edited', false);
  } catch (error) {
    console.error('Edit message error:', error);
    showError('Failed to edit message');
  }
}

// ========================================
// DELETE MESSAGE
// ========================================
async function deleteMessage(messageId) {
  if (!messageId) return;
  try {
    await db.collection('messages').doc(messageId).delete();
  } catch (error) {
    console.error('Delete message error:', error);
  }
}

// ========================================
// MARK MESSAGES AS READ
// ========================================
async function markMessagesAsRead(chatId, isGroup) {
  if (!currentUser) return;
  const messagesQuery = db.collection('messages')
    .where(isGroup ? 'groupId' : 'directId', '==', chatId)
    .where('read', '==', false)
    .where('senderId', '!=', currentUser.uid);
  const snapshot = await messagesQuery.get();
  snapshot.forEach(async (doc) => {
    await doc.ref.update({ read: true, readAt: firebase.firestore.FieldValue.serverTimestamp() });
  });
}

// ========================================
// TYPING INDICATOR
// ========================================
async function sendTypingIndicator() {
  if (!currentChat) return;
  const typingRef = db.collection('typingIndicators').doc(`${currentChat.id}_${currentUser.uid}`);
  await typingRef.set({
    userId: currentUser.uid,
    userName: currentUser.displayName,
    chatId: currentChat.id,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(async () => {
    await typingRef.delete();
  }, 2000);
}

// ========================================
// LOAD MESSAGES (with reply display, pin, message info)
// ========================================
function loadDirectMessages() {
  if (!currentChat || currentChatType !== 'direct') return;
  const messagesArea = document.getElementById('messagesArea');
  if (activeUnsubscribe) activeUnsubscribe();
  activeUnsubscribe = db.collection('messages')
    .where('directId', '==', currentChat.id)
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      messagesArea.innerHTML = '';
      if (snapshot.empty) {
        messagesArea.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>No messages yet. Say hello!</p></div>';
        return;
      }
      snapshot.forEach(doc => {
        const message = doc.data();
        if (message.deleteFor?.includes(currentUser.uid)) return;
        
        const isMyMessage = message.senderId === currentUser.uid;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-wrapper ${isMyMessage ? 'my-message' : ''}`;
        
        let replyHtml = '';
        if (message.replyToId) {
          replyHtml = `
            <div class="reply-preview">
              <div class="reply-sender">${escapeHtml(message.replyToSender)}</div>
              <div class="reply-text">${escapeHtml(message.replyToText || (message.replyToAttachment ? (message.replyToAttachment.type === 'image' ? '📷 Photo' : '📎 File') : ''))}</div>
            </div>
          `;
        }
        
        let attachmentHtml = '';
        if (message.attachment) {
          attachmentHtml = displayAttachment(message.attachment);
        }
        
        let forwardHtml = '';
        if (message.isForwarded) {
          forwardHtml = `<div class="forward-label">Forwarded from ${escapeHtml(message.forwardedFrom)}</div>`;
        }
        
        const editedHtml = message.edited ? '<span class="message-edited">(edited)</span>' : '';
        const readReceiptHtml = isMyMessage ? `<span class="read-receipt ${message.read ? 'read' : 'delivered'}">${message.read ? '✓✓' : '✓'}</span>` : '';
        
        messageDiv.innerHTML = `
          <div class="message-bubble" data-message-id="${doc.id}" data-message-read="${message.read}" data-message-text="${escapeHtml(message.text || '')}" data-message-sender="${escapeHtml(message.senderName)}" data-message-attachment="${message.attachment ? JSON.stringify(message.attachment).replace(/"/g, '&quot;') : ''}" data-message-timestamp="${message.timestamp?.toMillis() || 0}" data-message-edited="${message.edited || false}">
            ${!isMyMessage ? `<div class="message-sender">${escapeHtml(message.senderName)}</div>` : ''}
            ${forwardHtml}
            ${replyHtml}
            <div class="message-text">${escapeHtml(message.text || '')}${editedHtml}</div>
            ${attachmentHtml}
            <div class="message-footer">
              <span class="message-time">${message.timestamp ? formatTime(message.timestamp) : ''}</span>
              ${readReceiptHtml}
            </div>
          </div>
        `;
        
        if (isMyMessage) {
          const bubble = messageDiv.querySelector('.message-bubble');
          bubble.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            contextMessageId = doc.id;
            contextMessageIsRead = message.read || false;
            contextMessageText = message.text || '';
            contextMessageSender = message.senderName;
            contextMessageAttachment = message.attachment || null;
            contextMessageTimestamp = message.timestamp;
            contextMessageEdited = message.edited || false;
            
            const checkPinned = await db.collection('pinnedMessages')
              .where('chatId', '==', currentChat.id)
              .where('messageId', '==', contextMessageId)
              .get();
            
            const pinOption = document.getElementById('pinMessageMenuItem');
            if (pinOption) {
              pinOption.textContent = !checkPinned.empty ? '📌 Unpin Message' : '📌 Pin Message';
            }
            
            showMessageContextMenu(e.clientX, e.clientY);
          });
        } else {
          let touchStartX = 0;
          messageDiv.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
          });
          messageDiv.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            if (touchStartX - endX > 50) {
              setReplyTo(doc.id, message.senderName, message.text || (message.attachment ? (message.attachment.type === 'image' ? '📷 Photo' : '📎 File') : ''), message.attachment);
            }
          });
        }
        messagesArea.appendChild(messageDiv);
      });
      messagesArea.scrollTop = messagesArea.scrollHeight;
      markMessagesAsRead(currentChat.id, false);
      loadPinnedMessages();
      markPinnedMessagesInChat();
    });
}

function loadGroupMessages() {
  if (!currentChat || currentChatType !== 'group') return;
  const messagesArea = document.getElementById('messagesArea');
  if (activeUnsubscribe) activeUnsubscribe();
  activeUnsubscribe = db.collection('messages')
    .where('groupId', '==', currentChat.id)
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      messagesArea.innerHTML = '';
      if (snapshot.empty) {
        messagesArea.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>No messages yet. Say hello!</p></div>';
        return;
      }
      snapshot.forEach(doc => {
        const message = doc.data();
        if (message.deleteFor?.includes(currentUser.uid)) return;
        
        const isMyMessage = message.senderId === currentUser.uid;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-wrapper ${isMyMessage ? 'my-message' : ''}`;
        
        let replyHtml = '';
        if (message.replyToId) {
          replyHtml = `
            <div class="reply-preview">
              <div class="reply-sender">${escapeHtml(message.replyToSender)}</div>
              <div class="reply-text">${escapeHtml(message.replyToText || (message.replyToAttachment ? (message.replyToAttachment.type === 'image' ? '📷 Photo' : '📎 File') : ''))}</div>
            </div>
          `;
        }
        
        let attachmentHtml = '';
        if (message.attachment) {
          attachmentHtml = displayAttachment(message.attachment);
        }
        
        let forwardHtml = '';
        if (message.isForwarded) {
          forwardHtml = `<div class="forward-label">Forwarded from ${escapeHtml(message.forwardedFrom)}</div>`;
        }
        
        const editedHtml = message.edited ? '<span class="message-edited">(edited)</span>' : '';
        
        let displayText = message.text || '';
        if (currentGroupMembers && !isMyMessage) {
          currentGroupMembers.forEach(member => {
            const mentionPattern = new RegExp(`@${member.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            displayText = displayText.replace(mentionPattern, `<span class="mention-highlight">@${escapeHtml(member.name)}</span>`);
          });
        }
        
        messageDiv.innerHTML = `
          <div class="message-bubble" data-message-id="${doc.id}" data-message-read="${message.read}" data-message-text="${escapeHtml(message.text || '')}" data-message-sender="${escapeHtml(message.senderName)}" data-message-attachment="${message.attachment ? JSON.stringify(message.attachment).replace(/"/g, '&quot;') : ''}" data-message-timestamp="${message.timestamp?.toMillis() || 0}" data-message-edited="${message.edited || false}">
            ${!isMyMessage ? `<div class="message-sender">${escapeHtml(message.senderName)}</div>` : ''}
            ${forwardHtml}
            ${replyHtml}
            <div class="message-text">${escapeHtml(displayText)}${editedHtml}</div>
            ${attachmentHtml}
            <div class="message-footer">
              <span class="message-time">${message.timestamp ? formatTime(message.timestamp) : ''}</span>
            </div>
          </div>
        `;
        
        if (isMyMessage) {
          const bubble = messageDiv.querySelector('.message-bubble');
          bubble.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            contextMessageId = doc.id;
            contextMessageIsRead = message.read || false;
            contextMessageText = message.text || '';
            contextMessageSender = message.senderName;
            contextMessageAttachment = message.attachment || null;
            contextMessageTimestamp = message.timestamp;
            contextMessageEdited = message.edited || false;
            
            const checkPinned = await db.collection('pinnedMessages')
              .where('chatId', '==', currentChat.id)
              .where('messageId', '==', contextMessageId)
              .get();
            
            const pinOption = document.getElementById('pinMessageMenuItem');
            if (pinOption) {
              pinOption.textContent = !checkPinned.empty ? '📌 Unpin Message' : '📌 Pin Message';
            }
            
            showMessageContextMenu(e.clientX, e.clientY);
          });
        } else {
          let touchStartX = 0;
          messageDiv.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
          });
          messageDiv.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            if (touchStartX - endX > 50) {
              setReplyTo(doc.id, message.senderName, message.text || (message.attachment ? (message.attachment.type === 'image' ? '📷 Photo' : '📎 File') : ''), message.attachment);
            }
          });
        }
        messagesArea.appendChild(messageDiv);
      });
      messagesArea.scrollTop = messagesArea.scrollHeight;
      markMessagesAsRead(currentChat.id, true);
      loadPinnedMessages();
      markPinnedMessagesInChat();
    });
}

function showMessageContextMenu(x, y) {
  const menu = document.getElementById('messageMenu');
  const editOption = document.getElementById('editMessageBtn');
  if (editOption) {
    editOption.style.display = contextMessageIsRead ? 'none' : 'flex';
  }
  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  setTimeout(() => {
    document.addEventListener('click', () => menu.style.display = 'none');
    document.addEventListener('touchstart', () => menu.style.display = 'none');
  }, 10);
}

// Message context menu handlers
document.getElementById('messageInfoMenuItem')?.addEventListener('click', () => {
  showMessageInfo(contextMessageId);
  document.getElementById('messageMenu').style.display = 'none';
});

document.getElementById('replyMessageBtn')?.addEventListener('click', () => {
  setReplyTo(contextMessageId, contextMessageSender, contextMessageText, contextMessageAttachment);
  document.getElementById('messageMenu').style.display = 'none';
});

document.getElementById('forwardMessageBtn')?.addEventListener('click', () => {
  showForwardModal({
    text: contextMessageText,
    senderName: contextMessageSender,
    attachment: contextMessageAttachment
  });
  document.getElementById('messageMenu').style.display = 'none';
});

document.getElementById('pinMessageMenuItem')?.addEventListener('click', async () => {
  const checkPinned = await db.collection('pinnedMessages')
    .where('chatId', '==', currentChat.id)
    .where('messageId', '==', contextMessageId)
    .get();
  
  if (!checkPinned.empty) {
    await unpinMessage(checkPinned.docs[0].id);
  } else {
    pinMessageData = {
      id: contextMessageId,
      text: contextMessageText,
      senderName: contextMessageSender,
      attachment: contextMessageAttachment,
      timestamp: contextMessageTimestamp
    };
    
    document.getElementById('pinMessagePreview').innerHTML = `
      <div class="pin-preview">
        <div class="pin-sender">${escapeHtml(contextMessageSender)}</div>
        <div class="pin-text">${escapeHtml(contextMessageText || (contextMessageAttachment ? (contextMessageAttachment.type === 'image' ? '📷 Photo' : '📎 File') : 'No text'))}</div>
      </div>
    `;
    document.getElementById('pinMessageModal').style.display = 'flex';
  }
  document.getElementById('messageMenu').style.display = 'none';
});

document.getElementById('confirmPinBtn')?.addEventListener('click', async () => {
  if (pinMessageData) {
    await pinMessage(pinMessageData.id, pinMessageData);
    document.getElementById('pinMessageModal').style.display = 'none';
    pinMessageData = null;
  }
});

document.getElementById('cancelPinBtn')?.addEventListener('click', () => {
  document.getElementById('pinMessageModal').style.display = 'none';
  pinMessageData = null;
});

document.getElementById('editMessageBtn')?.addEventListener('click', async () => {
  if (contextMessageId) {
    document.getElementById('editMessageInput').value = contextMessageText;
    document.getElementById('editMessageModal').style.display = 'flex';
    document.getElementById('messageMenu').style.display = 'none';
  }
});

document.getElementById('saveEditBtn')?.addEventListener('click', async () => {
  const newText = document.getElementById('editMessageInput').value;
  if (newText.trim() && contextMessageId) {
    await editMessage(contextMessageId, newText);
    document.getElementById('editMessageModal').style.display = 'none';
    document.getElementById('editMessageInput').value = '';
    contextMessageId = null;
  }
});

document.getElementById('deleteMessageBtn')?.addEventListener('click', async () => {
  if (contextMessageId) {
    await deleteMessage(contextMessageId);
    contextMessageId = null;
    document.getElementById('messageMenu').style.display = 'none';
  }
});

document.getElementById('cancelReplyBtn')?.addEventListener('click', clearReplyTo);

// Voice recording handlers
const voiceBtn = document.getElementById('voiceMsgBtn');
if (voiceBtn) {
  let pressTimer;
  
  voiceBtn.addEventListener('mousedown', () => {
    pressTimer = setTimeout(() => {
      startVoiceRecording();
    }, 200);
  });
  
  voiceBtn.addEventListener('mouseup', () => {
    clearTimeout(pressTimer);
    if (isRecording) {
      stopVoiceRecording();
    }
  });
  
  voiceBtn.addEventListener('mouseleave', () => {
    clearTimeout(pressTimer);
    if (isRecording) {
      cancelVoiceRecording();
    }
  });
  
  voiceBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    pressTimer = setTimeout(() => {
      startVoiceRecording();
    }, 200);
  });
  
  voiceBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    clearTimeout(pressTimer);
    if (isRecording) {
      stopVoiceRecording();
    }
  });
  
  voiceBtn.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    clearTimeout(pressTimer);
    if (isRecording) {
      cancelVoiceRecording();
    }
  });
}

document.getElementById('cancelRecordingBtn')?.addEventListener('click', cancelVoiceRecording);

// Wallpaper handlers
document.getElementById('wallpaperMenuItem')?.addEventListener('click', () => {
  const rect = document.getElementById('wallpaperMenuItem').getBoundingClientRect();
  showWallpaperSelector(rect.left, rect.bottom + 5);
});

document.getElementById('wallpaperBtn')?.addEventListener('click', () => {
  const rect = document.getElementById('wallpaperBtn').getBoundingClientRect();
  showWallpaperSelector(rect.left, rect.bottom + 5);
});

document.querySelectorAll('.wallpaper-option').forEach(option => {
  option.addEventListener('click', () => {
    const wallpaperName = option.dataset.wallpaper;
    applyWallpaper(wallpaperName);
    document.getElementById('wallpaperSelector').style.display = 'none';
  });
});

document.getElementById('closeWallpaperBtn')?.addEventListener('click', () => {
  document.getElementById('wallpaperSelector').style.display = 'none';
});

// ========================================
// ONLINE STATUS FUNCTIONS
// ========================================
function updateOnlineStatus(status) {
  if (!currentUser) return;
  currentOnlineStatus = status;
  db.collection('users').doc(currentUser.uid).update({
    onlineStatus: status,
    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
  });
  updateStatusUI();
}

function startInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (currentOnlineStatus === 'online') updateOnlineStatus('away');
  }, 5 * 60 * 1000);
}

function resetInactivityTimer() {
  if (currentOnlineStatus === 'away') updateOnlineStatus('online');
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (currentOnlineStatus === 'online') updateOnlineStatus('away');
  }, 5 * 60 * 1000);
}

function updateStatusUI() {
  const dot = document.getElementById('onlineDot');
  const label = document.getElementById('onlineStatusLabel');
  if (dot) {
    dot.className = 'online-dot';
    if (currentOnlineStatus === 'busy') dot.classList.add('busy');
    else if (currentOnlineStatus === 'away') dot.classList.add('away');
  }
  if (label) {
    if (currentOnlineStatus === 'online') label.textContent = 'Online';
    else if (currentOnlineStatus === 'busy') label.textContent = 'Busy';
    else label.textContent = 'Away';
    label.style.color = currentOnlineStatus === 'online' ? '#10b981' : (currentOnlineStatus === 'busy' ? '#f59e0b' : '#ef4444');
  }
}

// ========================================
// STATUS TEXT (BIO)
// ========================================
async function updateStatusText(newStatus) {
  if (!currentUser) return;
  currentUserStatusText = newStatus;
  await db.collection('users').doc(currentUser.uid).update({
    statusText: newStatus,
    statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('userStatusText').textContent = newStatus || '';
  document.getElementById('profileStatusText').textContent = newStatus || 'No status';
  
  const ring = document.getElementById('statusRing');
  if (ring && newStatus) {
    ring.style.display = 'block';
    setTimeout(() => ring.style.display = 'none', 24 * 60 * 60 * 1000);
  }
}

// ========================================
// AVATAR FUNCTIONS
// ========================================
async function uploadAvatar(file) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (data.secure_url) resolve(data.secure_url);
      else reject('Upload failed');
    })
    .catch(reject);
  });
}

async function updateUserAvatar(avatarUrl) {
  await db.collection('users').doc(currentUser.uid).update({ avatar: avatarUrl });
  updateAvatarDisplay();
}

async function removeUserAvatar() {
  await db.collection('users').doc(currentUser.uid).update({ avatar: firebase.firestore.FieldValue.delete() });
  updateAvatarDisplay();
}

function updateAvatarDisplay() {
  const userDoc = db.collection('users').doc(currentUser.uid);
  userDoc.get().then(doc => {
    const avatar = doc.data()?.avatar;
    const avatarElement = document.getElementById('userAvatar');
    const profileAvatar = document.getElementById('profileAvatar');
    if (avatar) {
      avatarElement.innerHTML = `<img src="${avatar}" alt="Avatar">`;
      if (profileAvatar) profileAvatar.innerHTML = `<img src="${avatar}" alt="Avatar">`;
    } else {
      const initial = (currentUser.displayName || currentUser.email)[0].toUpperCase();
      avatarElement.innerHTML = initial;
      avatarElement.style.background = '#667eea';
      avatarElement.style.color = 'white';
      if (profileAvatar) {
        profileAvatar.innerHTML = initial;
        profileAvatar.style.background = '#667eea';
        profileAvatar.style.color = 'white';
      }
    }
  });
}

// ========================================
// LOAD ALL USERS
// ========================================
async function loadAllUsers() {
  if (!currentUser) return;
  try {
    const snapshot = await db.collection('users').get();
    allUsers = [];
    snapshot.forEach(doc => {
      if (doc.id !== currentUser.uid) {
        const userData = doc.data();
        if (userData.isActive !== false) {
          allUsers.push({ id: doc.id, ...userData });
        }
      }
    });
    
    const searchInput = document.getElementById('searchUsers');
    if (searchInput && !searchInput.value.trim()) {
      const usersList = document.getElementById('usersList');
      if (allUsers.length === 0) {
        usersList.innerHTML = '<div class="empty-users"><div class="empty-icon">👤</div><p>No other users registered yet.</p><small>Share this link with your team members to invite them!</small></div>';
      }
    }
  } catch (error) {
    console.error('Load users error:', error);
  }
}

// ========================================
// ACCOUNT MANAGEMENT
// ========================================
async function changePassword(currentPassword, newPassword) {
  try {
    const user = auth.currentUser;
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
    showError('Password changed successfully!', false);
    return true;
  } catch (error) {
    showError(error.message);
    return false;
  }
}

async function changeEmail(password, newEmail) {
  try {
    const user = auth.currentUser;
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
    await user.reauthenticateWithCredential(credential);
    await user.updateEmail(newEmail);
    await db.collection('users').doc(user.uid).update({ email: newEmail });
    await user.sendEmailVerification();
    showError('Email changed! Verification email sent.', false);
    return true;
  } catch (error) {
    showError(error.message);
    return false;
  }
}

async function ensureUserDocument(user) {
  const userRef = db.collection('users').doc(user.uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    await userRef.set({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      emailVerified: user.emailVerified,
      onlineStatus: 'online',
      statusText: '',
      phoneNumber: '',
      phoneCountryCode: '',
      phoneNumberRaw: '',
      isActive: true
    });
  }
  updateAvatarDisplay();
  return true;
}

// ========================================
// UI FUNCTIONS
// ========================================
function toggleTheme() {
  if (document.body.classList.contains('dark')) {
    document.body.classList.remove('dark');
    localStorage.setItem('chatTheme', 'light');
    document.getElementById('themeToggleBtn').textContent = '🌙';
  } else {
    document.body.classList.add('dark');
    localStorage.setItem('chatTheme', 'dark');
    document.getElementById('themeToggleBtn').textContent = '☀️';
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('chatTheme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('themeToggleBtn').textContent = '☀️';
  } else {
    document.body.classList.remove('dark');
    document.getElementById('themeToggleBtn').textContent = '🌙';
  }
}

function toggleMobileMenu() {
  const sidebar = document.querySelector('.chat-sidebar');
  const overlay = document.getElementById('mobileMenuOverlay');
  if (sidebar) {
    mobileMenuOpen = !mobileMenuOpen;
    if (mobileMenuOpen) {
      sidebar.classList.add('open');
      if (overlay) {
        overlay.classList.add('show');
        overlay.style.display = 'block';
      }
    } else {
      sidebar.classList.remove('open');
      if (overlay) {
        overlay.classList.remove('show');
        overlay.style.display = 'none';
      }
    }
  }
}

function closeMobileMenuOnChat() {
  if (window.innerWidth <= 768 && mobileMenuOpen) {
    toggleMobileMenu();
  }
}

function showSettingsMenu(x, y) {
  const menu = document.getElementById('settingsMenu');
  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  setTimeout(() => {
    document.addEventListener('click', () => menu.style.display = 'none');
    document.addEventListener('touchstart', () => menu.style.display = 'none');
  }, 10);
}

function showStatusSelector(x, y) {
  const menu = document.getElementById('statusSelectorMenu');
  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  setTimeout(() => {
    document.addEventListener('click', () => menu.style.display = 'none');
    document.addEventListener('touchstart', () => menu.style.display = 'none');
  }, 10);
}

function switchMainTab(tab) {
  document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.main-tab[data-tab="${tab}"]`).classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  
  if (tab === 'chats') {
    document.getElementById('chatsTab').classList.add('active');
    loadChatsList();
  } else if (tab === 'groups') {
    document.getElementById('groupsTab').classList.add('active');
    loadGroupsList();
  } else if (tab === 'archive') {
    document.getElementById('archiveTab').classList.add('active');
    loadArchivedChats();
  } else if (tab === 'requests') {
    document.getElementById('requestsTab').classList.add('active');
    loadChatRequests();
  }
  closeMobileMenuOnChat();
}

async function logout() {
  if (activeUnsubscribe) activeUnsubscribe();
  await updateOnlineStatus('away');
  await auth.signOut();
  window.location.href = 'login.html';
}

// ========================================
// SHOW PROFILE MODAL
// ========================================
async function showProfileModal(userId = null) {
  if (!userId && !currentUser) return;
  const targetUserId = userId || currentUser.uid;
  const isSelf = targetUserId === currentUser.uid;
  
  const userDoc = await db.collection('users').doc(targetUserId).get();
  if (!userDoc.exists) return;
  const userData = userDoc.data();
  
  if (isSelf) {
    document.getElementById('profileName').textContent = userData.displayName || currentUser.displayName;
    document.getElementById('profileEmail').textContent = userData.email || currentUser.email;
    document.getElementById('profilePhone').textContent = userData.phoneNumber || 'Not set';
    document.getElementById('profileStatusText').textContent = userData.statusText || 'No status';
    document.getElementById('profileAvatar').innerHTML = userData.avatar ? `<img src="${userData.avatar}">` : (userData.displayName ? userData.displayName[0].toUpperCase() : '👤');
    const statusDot = document.getElementById('profileStatusDot');
    statusDot.className = 'profile-status-dot ' + (userData.onlineStatus || 'online');
    const onlineDisplay = document.getElementById('profileOnlineStatus');
    if (userData.onlineStatus === 'online') onlineDisplay.innerHTML = '🟢 Online';
    else if (userData.onlineStatus === 'busy') onlineDisplay.innerHTML = '🟠 Busy';
    else onlineDisplay.innerHTML = '🔴 Away';
    document.getElementById('profileModal').style.display = 'flex';
  } else {
    document.getElementById('userProfileName').textContent = userData.displayName || 'User';
    document.getElementById('userProfileEmail').textContent = userData.email || '';
    document.getElementById('userProfilePhone').textContent = userData.phoneNumber || 'Not set';
    document.getElementById('userProfileStatusText').textContent = userData.statusText || 'No status';
    document.getElementById('userProfileAvatar').innerHTML = userData.avatar ? `<img src="${userData.avatar}">` : (userData.displayName ? userData.displayName[0].toUpperCase() : '👤');
    const statusDot = document.getElementById('userProfileStatusDot');
    statusDot.className = 'profile-status-dot ' + (userData.onlineStatus || 'online');
    const onlineDisplay = document.getElementById('userProfileOnlineStatus');
    if (userData.onlineStatus === 'online') onlineDisplay.innerHTML = '🟢 Online';
    else if (userData.onlineStatus === 'busy') onlineDisplay.innerHTML = '🟠 Busy';
    else onlineDisplay.innerHTML = '🔴 Away';
    
    const lastSeenText = document.getElementById('userProfileLastSeen');
    if (lastSeenText) {
      lastSeenText.textContent = formatLastSeen(userData.lastSeen);
    }
    
    document.getElementById('userProfileModal').dataset.userId = targetUserId;
    document.getElementById('userProfileModal').dataset.userName = userData.displayName;
    document.getElementById('userProfileModal').style.display = 'flex';
  }
}

// ========================================
// FILE ATTACHMENT HANDLER
// ========================================
function setupAttachmentHandlers() {
  const attachBtn = document.getElementById('attachFileBtn');
  const fileInput = document.getElementById('fileInput');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const sendBtn = document.getElementById('sendBtn');
  const messageInput = document.getElementById('messageInput');
  const filePreview = document.getElementById('filePreview');
  const fileNameSpan = document.getElementById('fileName');
  
  if (attachBtn) {
    attachBtn.addEventListener('click', () => {
      if (currentUploadXHR) currentUploadXHR.abort();
      currentFileUploading = false;
      currentFile = null;
      if (sendBtn) sendBtn.disabled = false;
      fileInput.click();
    });
  }
  
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const validation = validateFileSize(file);
      if (!validation.valid) {
        if (fileNameSpan) {
          fileNameSpan.innerHTML = `❌ ${escapeHtml(file.name)} (${formatFileSize(file.size)})`;
          fileNameSpan.style.color = '#dc2626';
        }
        const errorDiv = document.createElement('div');
        errorDiv.className = 'upload-error';
        errorDiv.textContent = validation.error;
        errorDiv.style.cssText = 'color:#dc2626;font-size:11px;margin-top:8px;padding:8px;background:#fee2e2;border-radius:8px;';
        const oldError = filePreview?.querySelector('.upload-error');
        if (oldError) oldError.remove();
        filePreview?.appendChild(errorDiv);
        if (filePreview) filePreview.style.display = 'block';
        if (sendBtn) sendBtn.disabled = true;
        currentFile = null;
        return;
      }
      
      currentFile = file;
      if (fileNameSpan) {
        fileNameSpan.innerHTML = `📎 ${escapeHtml(file.name)} (${formatFileSize(file.size)})<br><span class="upload-progress">⏳ Uploading... 0%</span>`;
        fileNameSpan.style.color = 'inherit';
      }
      const oldError = filePreview?.querySelector('.upload-error');
      if (oldError) oldError.remove();
      if (filePreview) filePreview.style.display = 'block';
      if (sendBtn) sendBtn.disabled = true;
      
      try {
        currentFileUploading = true;
        const uploadResult = await uploadToCloudinaryWithProgress(file, (percent) => {
          if (fileNameSpan) {
            fileNameSpan.innerHTML = `📎 ${escapeHtml(file.name)} (${formatFileSize(file.size)})<br><span class="upload-progress">⏳ Uploading... ${percent}%</span>`;
          }
        });
        currentUploadXHR = null;
        currentFileUploading = false;
        currentFile = {
          file: file,
          uploadResult: uploadResult,
          name: file.name,
          size: file.size,
          type: uploadResult.type,
          url: uploadResult.url,
          icon: uploadResult.icon,
          badge: uploadResult.badge
        };
        if (fileNameSpan) {
          fileNameSpan.innerHTML = `📎 ${escapeHtml(file.name)} (${formatFileSize(file.size)})`;
          fileNameSpan.style.color = 'inherit';
        }
        if (sendBtn) sendBtn.disabled = false;
      } catch (error) {
        console.error('Upload error:', error);
        currentFileUploading = false;
        currentFile = null;
        if (fileNameSpan) {
          fileNameSpan.innerHTML = `❌ Upload failed: ${error.message}`;
          fileNameSpan.style.color = '#dc2626';
        }
        if (sendBtn) sendBtn.disabled = true;
      }
    });
  }
  
  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', () => {
      if (currentUploadXHR) currentUploadXHR.abort();
      currentFileUploading = false;
      currentFile = null;
      if (fileInput) fileInput.value = '';
      if (filePreview) filePreview.style.display = 'none';
      if (sendBtn) sendBtn.disabled = false;
    });
  }
  
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const message = messageInput?.value || '';
      if (currentFile && currentFile.uploadResult) {
        await sendMessage(message, currentFile.uploadResult);
        if (currentUploadXHR) currentUploadXHR.abort();
        currentFileUploading = false;
        currentFile = null;
        if (fileInput) fileInput.value = '';
        if (filePreview) filePreview.style.display = 'none';
        if (messageInput) messageInput.value = '';
        if (sendBtn) sendBtn.disabled = false;
      } else if (message.trim()) {
        await sendMessage(message);
        if (messageInput) messageInput.value = '';
      }
    });
  }
  
  if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
      }
      sendTypingIndicator();
    });
  }
}

// ========================================
// FIRST LOGIN PHONE PROMPT
// ========================================
async function checkAndShowPhonePrompt() {
  if (!currentUser) return;
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const userData = userDoc.data();
  if (userData?.phoneNumber && userData.phoneNumber !== '') return;
  const promptDismissed = localStorage.getItem(`phone_prompt_dismissed_${currentUser.uid}`);
  if (promptDismissed === 'true') return;
  document.getElementById('phonePromptModal').style.display = 'flex';
}

function dismissPhonePrompt() {
  document.getElementById('phonePromptModal').style.display = 'none';
  localStorage.setItem(`phone_prompt_dismissed_${currentUser.uid}`, 'true');
}

// ========================================
// GLOBAL SEARCH
// ========================================
async function performGlobalSearch(searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') {
    document.getElementById('globalSearchResults').style.display = 'none';
    return;
  }
  
  const results = [];
  const term = searchTerm.toLowerCase().trim();
  
  const directMessages = await db.collection('messages')
    .where('directId', '>=', '')
    .where('text', '>=', term)
    .where('text', '<=', term + '\uf8ff')
    .get();
  
  for (const doc of directMessages.docs) {
    const message = doc.data();
    if (message.deleteFor?.includes(currentUser.uid)) continue;
    if (message.senderId !== currentUser.uid && message.directId) {
      const otherUserId = message.participants?.find(id => id !== currentUser.uid);
      if (otherUserId) {
        const userDoc = await db.collection('users').doc(otherUserId).get();
        results.push({
          id: doc.id,
          text: message.text,
          sender: message.senderName,
          chatName: userDoc.data()?.displayName || 'User',
          chatId: message.directId,
          type: 'direct',
          timestamp: message.timestamp
        });
      }
    }
  }
  
  const groupMessages = await db.collection('messages')
    .where('groupId', '>=', '')
    .where('text', '>=', term)
    .where('text', '<=', term + '\uf8ff')
    .get();
  
  for (const doc of groupMessages.docs) {
    const message = doc.data();
    if (message.deleteFor?.includes(currentUser.uid)) continue;
    if (message.groupId) {
      const groupDoc = await db.collection('groups').doc(message.groupId).get();
      results.push({
        id: doc.id,
        text: message.text,
        sender: message.senderName,
        chatName: groupDoc.data()?.name || 'Group',
        chatId: message.groupId,
        type: 'group',
        timestamp: message.timestamp
      });
    }
  }
  
  results.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
  displayGlobalSearchResults(results, term);
}

function displayGlobalSearchResults(results, searchTerm) {
  const container = document.getElementById('globalSearchResults');
  if (results.length === 0) {
    container.innerHTML = '<div class="empty-search-state"><div class="empty-icon">🔍</div><p>No messages found</p></div>';
    container.style.display = 'block';
    return;
  }
  container.innerHTML = results.map(result => `
    <div class="search-result-item" data-chat-id="${result.chatId}" data-chat-type="${result.type}" data-message-id="${result.id}">
      <strong>${escapeHtml(result.chatName)}</strong>
      <div class="search-result-preview">${escapeHtml(result.text?.substring(0, 100) || '')}${result.text?.length > 100 ? '...' : ''}</div>
      <div class="search-result-chat">${result.type === 'group' ? '👥 Group' : '👤 Personal'} • ${result.sender}</div>
    </div>
  `).join('');
  container.style.display = 'block';
  
  document.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', async () => {
      const chatId = el.dataset.chatId;
      const chatType = el.dataset.chatType;
      const messageId = el.dataset.messageId;
      if (chatType === 'group') {
        const groupDoc = await db.collection('groups').doc(chatId).get();
        if (groupDoc.exists) loadGroupChat(chatId, groupDoc.data().name);
      } else {
        const otherUserId = chatId.split('_').find(id => id !== currentUser.uid);
        const userDoc = await db.collection('users').doc(otherUserId).get();
        if (userDoc.exists) startDirectChat({ id: otherUserId, ...userDoc.data() });
      }
      setTimeout(() => {
        const messageElement = document.querySelector(`.message-bubble[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.classList.add('highlighted');
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => messageElement.classList.remove('highlighted'), 2000);
        }
      }, 500);
      document.getElementById('globalSearchResults').style.display = 'none';
      document.getElementById('globalSearch').value = '';
    });
  });
}

// ========================================
// IN-CHAT SEARCH
// ========================================
function performInChatSearch(searchTerm) {
  if (!currentChat || !searchTerm || searchTerm.trim() === '') {
    clearInChatSearch();
    return;
  }
  const term = searchTerm.toLowerCase().trim();
  const messages = document.querySelectorAll('.message-bubble');
  const results = [];
  messages.forEach((bubble, index) => {
    const textElement = bubble.querySelector('.message-text');
    if (textElement && textElement.innerText.toLowerCase().includes(term)) {
      results.push({ element: bubble, index: index });
      bubble.classList.add('highlighted');
    } else {
      bubble.classList.remove('highlighted');
    }
  });
  currentSearchResults = results;
  currentSearchIndex = results.length > 0 ? 0 : -1;
  const resultCount = document.getElementById('searchResultCount');
  const navButtons = document.querySelector('.in-chat-search-nav');
  if (results.length > 0) {
    resultCount.textContent = `${results.length} result${results.length > 1 ? 's' : ''}`;
    navButtons.style.display = 'flex';
    highlightCurrentSearchResult();
  } else {
    resultCount.textContent = 'No results';
    navButtons.style.display = 'flex';
  }
}

function clearInChatSearch() {
  document.querySelectorAll('.message-bubble').forEach(bubble => bubble.classList.remove('highlighted', 'active'));
  currentSearchResults = [];
  currentSearchIndex = -1;
  document.getElementById('searchResultCount').textContent = '0 results';
  const navButtons = document.querySelector('.in-chat-search-nav');
  if (navButtons) navButtons.style.display = 'none';
}

function highlightCurrentSearchResult() {
  document.querySelectorAll('.message-bubble').forEach(bubble => bubble.classList.remove('active'));
  if (currentSearchResults[currentSearchIndex]) {
    const result = currentSearchResults[currentSearchIndex];
    result.element.classList.add('active');
    result.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function nextSearchResult() {
  if (currentSearchResults.length === 0) return;
  currentSearchIndex = (currentSearchIndex + 1) % currentSearchResults.length;
  highlightCurrentSearchResult();
}

function prevSearchResult() {
  if (currentSearchResults.length === 0) return;
  currentSearchIndex = (currentSearchIndex - 1 + currentSearchResults.length) % currentSearchResults.length;
  highlightCurrentSearchResult();
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('voice-play-btn')) {
    const url = e.target.dataset.url;
    const audio = document.getElementById('audioPlayer');
    if (audio.src === url && !audio.paused) {
      audio.pause();
      e.target.textContent = '▶️';
    } else {
      audio.src = url;
      audio.play();
      e.target.textContent = '⏸️';
      audio.onended = () => {
        e.target.textContent = '▶️';
      };
    }
  }
});

document.querySelector('.info-close')?.addEventListener('click', () => {
  document.getElementById('messageInfoModal').style.display = 'none';
});

document.querySelector('.pin-close')?.addEventListener('click', () => {
  document.getElementById('pinMessageModal').style.display = 'none';
});

// ========================================
// INITIALIZE CHAT PAGE
// ========================================
async function initChatPage() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = 'login.html'; return; }
    if (!user.emailVerified) {
      showError('Please verify your email first!');
      await auth.signOut();
      window.location.href = 'login.html';
      return;
    }
    currentUser = user;
    await ensureUserDocument(user);
    await updateOnlineStatus('online');
    
    const userDoc = await db.collection('users').doc(user.uid).get();
    currentUserStatusText = userDoc.data()?.statusText || '';
    document.getElementById('userName').textContent = user.displayName || user.email.split('@')[0];
    document.getElementById('userStatusText').textContent = currentUserStatusText;
    updateAvatarDisplay();
    updateStatusUI();
    
    document.addEventListener('mousemove', resetInactivityTimer);
    document.addEventListener('keydown', resetInactivityTimer);
    document.addEventListener('click', resetInactivityTimer);
    startInactivityTimer();
    
    await loadAllUsers();
    
    db.collection('users').where('uid', '!=', user.uid).onSnapshot(() => {
      loadAllUsers();
      const searchInput = document.getElementById('searchUsers');
      if (searchInput && searchInput.value.trim()) searchUsers(searchInput.value);
    });
    
    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = settingsBtn.getBoundingClientRect();
      showSettingsMenu(rect.right - 180, rect.bottom + 5);
    });
    
    const statusMenuBtn = document.getElementById('statusMenuBtn');
    statusMenuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = statusMenuBtn.getBoundingClientRect();
      showStatusSelector(rect.right - 120, rect.bottom + 5);
    });
    
    document.querySelectorAll('[data-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        updateOnlineStatus(btn.dataset.status);
        document.getElementById('statusSelectorMenu').style.display = 'none';
      });
    });
    
    const userInfoBtn = document.getElementById('userInfoBtn');
    userInfoBtn?.addEventListener('click', () => showProfileModal());
    
    if (window.innerWidth <= 768) {
      const sidebarHeader = document.querySelector('.sidebar-header');
      const menuToggle = document.getElementById('menuToggleBtn');
      if (menuToggle) {
        menuToggle.style.display = 'block';
        menuToggle.addEventListener('click', toggleMobileMenu);
      }
      const overlay = document.getElementById('mobileMenuOverlay');
      if (overlay) {
        overlay.addEventListener('click', toggleMobileMenu);
      }
    }
    
    await loadGroupsList();
    await loadChatsList();
    await loadChatRequests();
    setTimeout(() => checkAndShowPhonePrompt(), 1000);
    
    const searchInput = document.getElementById('searchUsers');
    if (searchInput) searchInput.addEventListener('input', (e) => searchUsers(e.target.value));
    const clearSearchBtn = document.getElementById('clearUserSearchBtn');
    if (clearSearchBtn) clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchUsers('');
    });
    
    const globalSearchInput = document.getElementById('globalSearch');
    const clearGlobalSearch = document.getElementById('clearGlobalSearchBtn');
    const inChatSearchInput = document.getElementById('inChatSearch');
    const clearInChatSearch = document.getElementById('clearInChatSearchBtn');
    
    if (globalSearchInput) {
      globalSearchInput.addEventListener('input', (e) => {
        clearGlobalSearch.style.display = e.target.value ? 'flex' : 'none';
        performGlobalSearch(e.target.value);
      });
    }
    if (clearGlobalSearch) clearGlobalSearch.addEventListener('click', () => {
      globalSearchInput.value = '';
      clearGlobalSearch.style.display = 'none';
      document.getElementById('globalSearchResults').style.display = 'none';
    });
    if (inChatSearchInput) {
      inChatSearchInput.addEventListener('input', (e) => {
        clearInChatSearch.style.display = e.target.value ? 'flex' : 'none';
        performInChatSearch(e.target.value);
      });
    }
    if (clearInChatSearch) clearInChatSearch.addEventListener('click', () => {
      inChatSearchInput.value = '';
      clearInChatSearch.style.display = 'none';
      clearInChatSearch();
    });
    
    document.getElementById('nextResultBtn')?.addEventListener('click', nextSearchResult);
    document.getElementById('prevResultBtn')?.addEventListener('click', prevSearchResult);
    
    setupMentionDetection();
    applyWallpaper(currentWallpaper);
  });
  
  document.querySelector('.chat-main')?.addEventListener('click', closeMobileMenuOnChat);
  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  
  setupAttachmentHandlers();
  
  document.getElementById('createGroupBtn')?.addEventListener('click', () => document.getElementById('createGroupModal').style.display = 'flex');
  document.getElementById('confirmCreateGroup')?.addEventListener('click', async () => {
    const groupName = document.getElementById('newGroupName').value;
    const members = document.getElementById('newGroupMembers').value;
    if (groupName.trim()) {
      await createGroup(groupName, members);
      document.getElementById('createGroupModal').style.display = 'none';
      document.getElementById('newGroupName').value = '';
      document.getElementById('newGroupMembers').value = '';
    }
  });
  document.getElementById('joinGroupBtn')?.addEventListener('click', async () => {
    const groupCode = document.getElementById('joinGroupCode').value;
    if (groupCode.trim()) await joinGroup(groupCode);
    document.getElementById('joinGroupCode').value = '';
  });
  
  document.getElementById('changeAvatarMenuItem')?.addEventListener('click', () => {
    document.getElementById('avatarModal').style.display = 'flex';
  });
  document.getElementById('avatarUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = await uploadAvatar(file);
      await updateUserAvatar(url);
      document.getElementById('avatarModal').style.display = 'none';
    }
  });
  document.getElementById('removeAvatarBtn')?.addEventListener('click', async () => {
    await removeUserAvatar();
    document.getElementById('avatarModal').style.display = 'none';
  });
  
  document.getElementById('changeStatusMenuItem')?.addEventListener('click', () => {
    document.getElementById('profileModal').style.display = 'flex';
  });
  document.getElementById('editStatusBtn')?.addEventListener('click', () => {
    document.getElementById('profileStatusText').style.display = 'none';
    document.getElementById('statusEditInput').style.display = 'block';
    document.getElementById('statusEditField').value = currentUserStatusText;
  });
  document.getElementById('saveStatusBtn')?.addEventListener('click', async () => {
    const newStatus = document.getElementById('statusEditField').value;
    await updateStatusText(newStatus);
    document.getElementById('statusEditInput').style.display = 'none';
    document.getElementById('profileStatusText').style.display = 'block';
  });
  document.getElementById('cancelStatusBtn')?.addEventListener('click', () => {
    document.getElementById('statusEditInput').style.display = 'none';
    document.getElementById('profileStatusText').style.display = 'block';
  });
  document.getElementById('changeProfileAvatarBtn')?.addEventListener('click', () => {
    document.getElementById('profileAvatarUpload').click();
  });
  document.getElementById('profileAvatarUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = await uploadAvatar(file);
      await updateUserAvatar(url);
      document.getElementById('profileModal').style.display = 'none';
    }
  });
  
  document.getElementById('changePhoneMenuItem')?.addEventListener('click', () => {
    document.getElementById('changePhoneModal').style.display = 'flex';
  });
  document.getElementById('changePhoneCountryCode').value = '+91';
  document.getElementById('savePhoneChangeBtn')?.addEventListener('click', async () => {
    const countryCode = document.getElementById('changePhoneCountryCode').value;
    const phoneNumber = document.getElementById('changePhoneNumber').value.trim();
    if (phoneNumber) {
      await updateUserPhoneNumber(countryCode, phoneNumber);
      document.getElementById('changePhoneModal').style.display = 'none';
      document.getElementById('changePhoneNumber').value = '';
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      document.getElementById('profilePhone').textContent = userDoc.data()?.phoneNumber || 'Not set';
    } else showError('Please enter a valid 10-digit phone number');
  });
  
  document.getElementById('savePhonePromptBtn')?.addEventListener('click', async () => {
    const countryCode = document.getElementById('phoneCountryCode').value;
    const phoneNumber = document.getElementById('promptPhoneNumber').value.trim();
    if (phoneNumber) {
      const success = await updateUserPhoneNumber(countryCode, phoneNumber);
      if (success) dismissPhonePrompt();
    } else dismissPhonePrompt();
  });
  document.getElementById('skipPhonePromptBtn')?.addEventListener('click', dismissPhonePrompt);
  document.getElementById('closePhonePromptBtn')?.addEventListener('click', dismissPhonePrompt);
  
  document.getElementById('soundToggleMenuItem')?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    showError(`Sound ${soundEnabled ? 'ON' : 'OFF'}`, false);
  });
  document.getElementById('changePasswordMenuItem')?.addEventListener('click', () => document.getElementById('changePasswordModal').style.display = 'flex');
  document.getElementById('changeEmailMenuItem')?.addEventListener('click', () => document.getElementById('changeEmailModal').style.display = 'flex');
  document.getElementById('deactivateAccountMenuItem')?.addEventListener('click', deactivateAccount);
  
  document.getElementById('confirmChangePasswordBtn')?.addEventListener('click', async () => {
    const currentPwd = document.getElementById('currentPassword').value;
    const newPwd = document.getElementById('newPassword').value;
    const confirmPwd = document.getElementById('confirmNewPassword').value;
    if (newPwd !== confirmPwd) { showError('Passwords do not match'); return; }
    if (newPwd.length < 6) { showError('Password must be 6+ characters'); return; }
    if (await changePassword(currentPwd, newPwd)) document.getElementById('changePasswordModal').style.display = 'none';
  });
  document.getElementById('confirmChangeEmailBtn')?.addEventListener('click', async () => {
    const password = document.getElementById('emailCurrentPassword').value;
    const newEmail = document.getElementById('newEmail').value;
    if (!newEmail.includes('@')) { showError('Valid email required'); return; }
    if (await changeEmail(password, newEmail)) document.getElementById('changeEmailModal').style.display = 'none';
  });
  
  document.querySelectorAll('.close-modal, .avatar-close, .password-close, .email-close, .profile-close, .user-profile-close, .edit-close, .phone-close, .group-info-close, .forward-close, .info-close, .pin-close').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('createGroupModal').style.display = 'none';
      document.getElementById('changePasswordModal').style.display = 'none';
      document.getElementById('changeEmailModal').style.display = 'none';
      document.getElementById('avatarModal').style.display = 'none';
      document.getElementById('profileModal').style.display = 'none';
      document.getElementById('userProfileModal').style.display = 'none';
      document.getElementById('editMessageModal').style.display = 'none';
      document.getElementById('changePhoneModal').style.display = 'none';
      document.getElementById('phonePromptModal').style.display = 'none';
      document.getElementById('groupInfoModal').style.display = 'none';
      document.getElementById('forwardModal').style.display = 'none';
      document.getElementById('messageInfoModal').style.display = 'none';
      document.getElementById('pinMessageModal').style.display = 'none';
    });
  });
  
  document.getElementById('profileCloseBtn')?.addEventListener('click', () => document.getElementById('profileModal').style.display = 'none');
  document.getElementById('userProfileCloseBtn')?.addEventListener('click', () => document.getElementById('userProfileModal').style.display = 'none');
  document.getElementById('blockFromProfileBtn')?.addEventListener('click', async () => {
    const userId = document.getElementById('userProfileModal').dataset.userId;
    if (userId) await blockUser(userId);
    document.getElementById('userProfileModal').style.display = 'none';
  });
  document.getElementById('profileSendMsgBtn')?.addEventListener('click', () => document.getElementById('profileModal').style.display = 'none');
  document.getElementById('userProfileSendMsgBtn')?.addEventListener('click', () => {
    const userId = document.getElementById('userProfileModal').dataset.userId;
    const user = allUsers.find(u => u.id === userId);
    if (user) startDirectChat(user);
    document.getElementById('userProfileModal').style.display = 'none';
  });
  document.getElementById('closeGroupInfoBtn')?.addEventListener('click', () => document.getElementById('groupInfoModal').style.display = 'none');
  document.getElementById('groupInfoBtn')?.addEventListener('click', () => {
    if (currentGroup) loadGroupInfo(currentGroup.id);
  });
  
  document.getElementById('searchInChatBtn')?.addEventListener('click', () => {
    document.getElementById('inChatSearchBar').style.display = 'block';
    document.getElementById('inChatSearch').focus();
  });
  document.getElementById('closeSearchBtn')?.addEventListener('click', () => {
    document.getElementById('inChatSearchBar').style.display = 'none';
    document.getElementById('inChatSearch').value = '';
    clearInChatSearch();
  });
  
  document.querySelectorAll('.main-tab').forEach(tab => tab.addEventListener('click', () => switchMainTab(tab.dataset.tab)));
  initTheme();
}

// ========================================
// INITIALIZE LOGIN PAGE
// ========================================
function initLoginPage() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
      document.getElementById(`${tabName}Form`).classList.add('active');
    });
  });
  
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      if (!userCredential.user.emailVerified) {
        showError('Please verify your email first!');
        await auth.signOut();
        return;
      }
      window.location.href = 'index.html';
    } catch (error) { showError(error.message); }
  });
  
  document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    if (password.length < 6) { showError('Password must be 6+ characters'); return; }
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: name });
      await userCredential.user.sendEmailVerification();
      await ensureUserDocument(userCredential.user);
      showError('Verification email sent! Check your inbox.', false);
      document.getElementById('registerName').value = '';
      document.getElementById('registerEmail').value = '';
      document.getElementById('registerPassword').value = '';
      document.querySelector('.auth-tab[data-tab="login"]').click();
    } catch (error) { showError(error.message); }
  });
  
  document.getElementById('forgotPasswordBtn')?.addEventListener('click', () => document.getElementById('resetModal').style.display = 'flex');
  document.getElementById('sendResetBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('resetEmail').value;
    if (!email) { showError('Enter email'); return; }
    try {
      await auth.sendPasswordResetEmail(email);
      showError('Reset email sent!', false);
      document.getElementById('resetModal').style.display = 'none';
    } catch (error) { showError(error.message); }
  });
  document.querySelectorAll('.reset-close').forEach(el => {
    el.addEventListener('click', () => document.getElementById('resetModal').style.display = 'none');
  });
}

// ========================================
// START THE APP
// ========================================
if (document.querySelector('.chat-page')) {
  initChatPage();
} else if (document.querySelector('.auth-page')) {
  initLoginPage();
}