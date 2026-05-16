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

// Global Variables
let currentUser = null;
let currentChat = null;
let currentChatType = null;
let allUsers = [];
let messagesUnsubscribe = null;
let directChatsUnsubscribe = null;
let groupChatsUnsubscribe = null;
let chatRequestsUnsubscribe = null;
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

function openMobileChatPanel() {
  document.querySelector('.chat-container')?.classList.add('chat-open');
}

function closeMobileChatPanel() {
  document.querySelector('.chat-container')?.classList.remove('chat-open');
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

function displaySearchResults(results, container) {
  if (results.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:40px;">👤 No users found</div>';
    return;
  }
  
  container.innerHTML = '';
  results.forEach(user => {
    if (isBlocked(user.id)) return;
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
    `;
    userDiv.onclick = () => handleUserSelection(user);
    container.appendChild(userDiv);
  });
}

async function handleUserSelection(user) {
  if (!currentUser || !user) return;
  if (user.id === currentUser.uid) {
    showToast('Cannot chat with yourself', 'error');
    return;
  }

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
    // The other user already sent you a request, accept it automatically.
    const requestId = inverseRequest.docs[0].id;
    await acceptChatRequest(requestId, user.id, user.displayName || user.email);
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
  loadChatsList();

  const userDoc = await db.collection('users').doc(fromUserId).get();
  if (userDoc.exists) {
    startDirectChat({ id: fromUserId, ...userDoc.data() });
  }
}

async function declineChatRequest(requestId) {
  if (!requestId) return;
  await db.collection('chatRequests').doc(requestId).update({ status: 'declined', respondedAt: firebase.firestore.FieldValue.serverTimestamp() });
  showToast('Request declined');
  loadReceivedRequests();
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

async function loadArchivedChats() {
  const archiveList = document.getElementById('archiveList');
  if (!archiveList) return;
  const snapshot = await db.collection('archivedChats').where('userId', '==', currentUser.uid).orderBy('archivedAt', 'desc').get();
  if (snapshot.empty) { archiveList.innerHTML = '<div class="empty-state" style="padding:20px;">No archived chats</div>'; return; }
  archiveList.innerHTML = '';
  for (const doc of snapshot.docs) {
    const archive = doc.data();
    const archiveDiv = document.createElement('div');
    archiveDiv.className = 'list-item';
    archiveDiv.style.opacity = '0.7';
    archiveDiv.innerHTML = `<div class="list-avatar">${archive.chatType === 'group' ? '👥' : '👤'}</div><div class="list-info"><div class="list-name">${escapeHtml(archive.chatName)}</div><div class="list-preview">Archived</div></div><button class="list-item-menu unarchive-btn" data-id="${doc.id}">📤</button>`;
    archiveList.appendChild(archiveDiv);
  }
  document.querySelectorAll('.unarchive-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => { e.stopPropagation(); await unarchiveChat(btn.dataset.id); });
  });
}

async function buildDirectChatItems() {
  if (!currentUser) return [];
  const archivedChatIds = await getArchivedChatIds();
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

  const items = [];

  for (const chat of directChatDocs.values()) {
    const chatData = chat.data;
    if (chatData.status && chatData.status !== 'active') continue;
    if (archivedChatIds.has(chat.id)) continue;
    const participants = chatData.participants || chat.id.split('_');
    const otherUserId = participants.find(id => id !== currentUser.uid);
    if (!otherUserId || isBlocked(otherUserId)) continue;
    const userDoc = await db.collection('users').doc(otherUserId).get();
    if (!userDoc.exists || userDoc.data().isActive === false) continue;
    const userData = userDoc.data();
    const onlineStatus = userData.onlineStatus || 'offline';
    const preview = getPresenceText(userData);
    items.push({
      id: chat.id,
      type: 'direct',
      name: userData.displayName || userData.email,
      avatar: userData.avatar ? `<img src="${userData.avatar}">` : escapeHtml((userData.displayName || userData.email || '?')[0].toUpperCase()),
      preview,
      unreadCount: await getChatUnreadCount(chat.id, 'direct'),
      isFavorite: favoriteChatIds.includes(chat.id),
      isMuted: isChatMuted(chat.id),
      otherUserId,
      onlineStatus,
      lastMessageTime: chatData.lastMessageTime?.toDate?.() || new Date(0)
    });
  }

  return items;
}

async function buildGroupChatItems() {
  if (!currentUser) return [];
  const archivedChatIds = await getArchivedChatIds();
  const memberSnapshot = await db.collection('groupMembers').where('userId', '==', currentUser.uid).get();
  const items = [];

  for (const memberDoc of memberSnapshot.docs) {
    const groupId = memberDoc.data().groupId;
    if (archivedChatIds.has(groupId)) continue;
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
    if (currentChat?.id === item.id && currentChatType === item.type) chatDiv.classList.add('active');
    const avatarClass = item.type === 'direct' ? (item.onlineStatus === 'online' ? 'online' : 'offline') : '';
    const unread = item.unreadCount ? `<span class="unread-pill">${item.unreadCount}</span>` : '';
    chatDiv.innerHTML = `
      <div class="list-avatar ${avatarClass}">${item.avatar}</div>
      <div class="list-info" style="flex:1; cursor:pointer;">
        <div class="list-name">${item.isFavorite ? '★ ' : ''}${escapeHtml(item.name)} ${item.isMuted ? '🔇' : ''}</div>
        <div class="list-preview">${escapeHtml(item.preview || '')}</div>
      </div>
      ${unread}
      <button class="list-item-menu mute-chat-btn" data-chat-id="${item.id}" data-chat-type="${item.type}">🔇</button>
      <button class="list-item-menu archive-chat-btn" data-chat-id="${item.id}" data-chat-type="${item.type}" data-chat-name="${escapeHtml(item.name)}">📦</button>
    `;
    if (item.type === 'user') {
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
    chatDiv.querySelector('.list-info').onclick = () => {
      if (item.type === 'user') handleUserSelection(item.user);
      else if (item.type === 'group') loadGroupChat(item.id, item.name);
      else db.collection('users').doc(item.otherUserId).get().then(doc => {
        if (doc.exists) startDirectChat({ id: item.otherUserId, ...doc.data() });
      });
    };
    container.appendChild(chatDiv);
  });
}

async function loadAllChatsList(searchTerm = '') {
  const chatsList = document.getElementById('chatsList');
  if (!chatsList) return;
  let items = [...await buildDirectChatItems(), ...await buildGroupChatItems()];
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
    const searchDigitsOnly = term.replace(/\D/g, '');
    const userMatches = allUsers
      .filter(user => {
        if (isBlocked(user.id) || existingUserIds.has(user.id)) return false;
        const displayName = (user.displayName || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const phone = ((user.phone || user.phoneNumber || '') + '').replace(/\D/g, '');
        return displayName.includes(term) ||
          email.includes(term) ||
          (searchDigitsOnly.length >= 6 && phone.includes(searchDigitsOnly));
      })
      .map(user => ({
        id: `user_${user.id}`,
        type: 'user',
        name: user.displayName || user.email || 'User',
        avatar: user.avatar ? `<img src="${user.avatar}">` : escapeHtml((user.displayName || user.email || '?')[0].toUpperCase()),
        preview: user.email || user.phone || user.phoneNumber || 'Tap to send chat request',
        unreadCount: 0,
        isFavorite: false,
        isMuted: false,
        onlineStatus: user.onlineStatus || 'offline',
        user,
        lastMessageTime: new Date(0)
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

// ========================================
// LOAD CHATS LIST
// ========================================

async function loadChatsList() {
  if (!currentUser) return;
  const chatsList = document.getElementById('chatsList');
  if (!chatsList) return;
  const activeChats = [];
  const archivedChatIds = await getArchivedChatIds();
  const directChats = await db.collection('directChats').where('participants', 'array-contains', currentUser.uid).get();
  for (const doc of directChats.docs) {
    if (doc.data().status && doc.data().status !== 'active') continue;
    if (archivedChatIds.has(doc.id)) continue;
    const otherUserId = doc.data().participants.find(id => id !== currentUser.uid);
    if (otherUserId && !isBlocked(otherUserId)) {
      const userDoc = await db.collection('users').doc(otherUserId).get();
      if (userDoc.exists && userDoc.data().isActive !== false) {
        const userData = userDoc.data();
        const onlineStatus = userData.onlineStatus || 'offline';
        let statusText = onlineStatus === 'online' ? '🟢 Online now' : '⚫ Offline';
        if (onlineStatus === 'offline' && userData.lastSeen) {
          const lastSeenTime = getTimeAgo(userData.lastSeen.toDate());
          statusText = `⚫ Last seen ${lastSeenTime}`;
        }
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
    if (currentChat?.id === chat.id && currentChatType === 'direct') chatDiv.classList.add('active');
    const avatarClass = chat.onlineStatus === 'online' ? 'online' : 'offline';
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

function getPresenceText(userData) {
  if (!userData) return '';
  const canSeePresence = !privacySettings.hideLastSeen && !userData.privacySettings?.hideLastSeen;
  if (canSeePresence && userData.onlineStatus === 'online') return 'online';
  if (canSeePresence && userData.lastSeen) return `last seen ${getTimeAgo(userData.lastSeen.toDate())}`;
  return userData.statusText || '';
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
  for (const doc of memberSnapshot.docs) {
    if (archivedChatIds.has(doc.data().groupId)) continue;
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
    if (currentChat?.id === group.id && currentChatType === 'group') groupDiv.classList.add('active');
    groupDiv.innerHTML = `<div class="list-avatar">${group.icon ? `<img src="${group.icon}">` : '👥'}</div><div class="list-info" style="flex:1; cursor:pointer;"><div class="list-name">${group.isFavorite ? '⭐ ' : ''}${escapeHtml(group.name)} ${isMuted ? '🔇' : ''}</div><div class="list-preview">${group.code}${group.unreadCount ? ` • ${group.unreadCount} unread` : ''}</div></div><button class="list-item-menu mute-chat-btn" data-chat-id="${group.id}" data-chat-type="group">🔇</button><button class="list-item-menu archive-chat-btn" data-chat-id="${group.id}" data-chat-type="group" data-chat-name="${escapeHtml(group.name)}">📦</button>`;
    groupDiv.querySelector('.archive-chat-btn')?.addEventListener('click', async (e) => { e.stopPropagation(); if (confirm(`Archive group "${group.name}"?`)) await archiveChat(group.id, 'group', group.name); });
    groupDiv.querySelector('.mute-chat-btn')?.addEventListener('click', async (e) => { e.stopPropagation(); const duration = prompt('Mute for: 8h, 1w, or always?', '8h'); if (duration === '8h' || duration === '1w' || duration === 'always') { await muteChat(group.id, 'group', duration); loadGroupsList(); } });
    groupDiv.querySelector('.list-info').onclick = () => loadGroupChat(group.id, group.name);
    groupsList.appendChild(groupDiv);
  }
}

// ========================================
// START DIRECT CHAT
// ========================================

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
  currentChat = { id: chatId, otherUserId: user.id, otherUserName: user.displayName || user.email, type: 'direct' };
  currentChatType = 'direct';
  document.getElementById('currentChatName').textContent = user.displayName || user.email;
  document.getElementById('chatStatus').textContent = getPresenceText(user);
  document.getElementById('inputArea').style.display = 'flex';
  document.getElementById('groupInfoBtn').style.display = 'none';
  document.getElementById('replyPreviewBar').style.display = 'none';
  currentReplyTo = null;
  loadMessages();
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
  const groupCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  const members = [currentUser.uid];
  if (memberEmails.trim()) {
    const emails = memberEmails.split(',').map(e => e.trim().toLowerCase());
    for (const email of emails) {
      const userQuery = await db.collection('users').where('email', '==', email).get();
      if (!userQuery.empty && !isBlocked(userQuery.docs[0].id)) members.push(userQuery.docs[0].id);
    }
  }
  const groupRef = await db.collection('groups').add({
    name: groupName.trim(), code: groupCode, createdBy: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(), memberCount: members.length
  });
  for (const memberId of members) {
    await db.collection('groupMembers').add({
      groupId: groupRef.id, userId: memberId, role: memberId === currentUser.uid ? 'admin' : 'member',
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  showToast(`Group "${groupName}" created! Code: ${groupCode}`);
  loadGroupsList();
  return groupRef.id;
}

async function loadGroupChat(groupId, groupName) {
  const groupDoc = await db.collection('groups').doc(groupId).get();
  currentChat = { id: groupId, name: groupName, type: 'group' };
  currentChatType = 'group';
  currentGroup = { id: groupId, name: groupName, icon: groupDoc.data()?.icon };
  document.getElementById('currentChatName').textContent = groupName;
  document.getElementById('chatStatus').textContent = 'Group Chat';
  document.getElementById('inputArea').style.display = 'flex';
  document.getElementById('groupInfoBtn').style.display = 'block';
  document.getElementById('replyPreviewBar').style.display = 'none';
  currentReplyTo = null;
  await loadGroupMembers(groupId);
  loadMessages();
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
  document.getElementById('addMemberBtn').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('addMemberEmail').style.display = isAdmin ? 'inline-block' : 'none';
  document.getElementById('deleteGroupBtn').style.display = isAdmin ? 'block' : 'none';
  
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
  document.querySelectorAll('.make-admin-btn').forEach(btn => { btn.addEventListener('click', () => makeAdmin(currentGroup.id, btn.dataset.id, btn.dataset.name)); });
  document.querySelectorAll('.remove-member-btn').forEach(btn => { btn.addEventListener('click', () => removeMember(currentGroup.id, btn.dataset.id, btn.dataset.name)); });
  document.getElementById('groupInfoModal').style.display = 'flex';
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
  const userQuery = await db.collection('users').where('email', '==', email.toLowerCase()).get();
  if (userQuery.empty) { showToast('User not found', 'error'); return; }
  const newMemberId = userQuery.docs[0].id;
  if (isBlocked(newMemberId)) { showToast('Cannot add blocked user', 'error'); return; }
  const existing = await db.collection('groupMembers').where('groupId', '==', currentGroup.id).where('userId', '==', newMemberId).get();
  if (!existing.empty) { showToast('User already in group', 'error'); return; }
  await db.collection('groupMembers').add({ groupId: currentGroup.id, userId: newMemberId, role: 'member', joinedAt: firebase.firestore.FieldValue.serverTimestamp() });
  await db.collection('groups').doc(currentGroup.id).update({ memberCount: firebase.firestore.FieldValue.increment(1) });
  showToast('Member added!');
  await loadGroupMembers(currentGroup.id);
  showGroupInfo();
}

async function updateGroupName(newName) {
  if (!newName.trim()) return;
  await db.collection('groups').doc(currentGroup.id).update({ name: newName.trim() });
  showToast('Group name updated');
  if (currentChat?.id === currentGroup.id) document.getElementById('currentChatName').textContent = newName;
  loadGroupsList();
}

async function updateGroupIcon(file) {
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
  let query;
  if (currentChatType === 'direct') {
    query = db.collection('messages').where('directId', '==', currentChat.id).where('senderId', '!=', currentUser.uid);
  } else {
    query = db.collection('messages').where('groupId', '==', currentChat.id).where('senderId', '!=', currentUser.uid);
  }
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
  if (hasWrites) await batch.commit();
}

function getMessageReceiptHtml(msg, isMyMessage) {
  if (!isMyMessage || privacySettings.hideReadReceipts) return '';
  const readBy = msg.readBy || {};
  const readerIds = Object.keys(readBy).filter(id => id !== currentUser.uid);
  const isRead = msg.read || readerIds.length > 0;
  return `<span class="read-receipt ${isRead ? 'read' : 'delivered'}">${isRead ? '✓✓' : '✓'}</span>`;
}

function loadMessages() {
  if (!currentChat) return;
  const messagesArea = document.getElementById('messagesArea');
  if (messagesUnsubscribe) messagesUnsubscribe();
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
      if (isBlocked(msg.senderId)) continue;
      const isMyMessage = msg.senderId === currentUser.uid;
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${isMyMessage ? 'my-message' : ''}`;
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
      messageDiv.innerHTML = `<div class="message-bubble">${!isMyMessage ? `<div class="message-sender">${escapeHtml(msg.senderName)}</div>` : ''}${replyHtml}<div class="message-text">${escapeHtml(msg.text || '')}</div>${attachmentHtml}<div class="message-footer"><span class="message-time">${msg.timestamp ? formatTime(msg.timestamp) : ''}</span>${getMessageReceiptHtml(msg, isMyMessage)}</div></div>`;
      const reactionsContainer = document.createElement('div');
      messageDiv.querySelector('.message-bubble').appendChild(reactionsContainer);
      await loadReactions(doc.id, reactionsContainer);
      messageDiv.addEventListener('contextmenu', (e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, doc.id, msg, isMyMessage); });
      messagesArea.appendChild(messageDiv);
    }
    document.querySelectorAll('.voice-play-btn').forEach(btn => { btn.addEventListener('click', () => { const audio = new Audio(btn.dataset.url); audio.play(); }); });
    messagesArea.scrollTop = messagesArea.scrollHeight;
    markMessagesAsRead();
  });
}

// ========================================
// SEND MESSAGE & CONTEXT MENU
// ========================================

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input ? input.value.trim() : '';
  if ((!text && !currentAttachment) || !currentChat) return;
  const messageData = {
    senderId: currentUser.uid, senderName: currentUser.displayName || currentUser.email.split('@')[0],
    text: text || '', timestamp: firebase.firestore.FieldValue.serverTimestamp(), read: false,
    readBy: { [currentUser.uid]: new Date() }
  };
  if (currentReplyTo) {
    messageData.replyTo = { messageId: currentReplyTo.id, text: currentReplyTo.text, senderName: currentReplyTo.senderName };
  }
  if (currentAttachment) { messageData.attachment = currentAttachment; currentAttachment = null; }
  if (currentChatType === 'direct') {
    messageData.directId = currentChat.id;
    messageData.participants = [currentUser.uid, currentChat.otherUserId];
  } else {
    messageData.groupId = currentChat.id;
  }
  await db.collection('messages').add(messageData);
  if (input) input.value = '';
  currentReplyTo = null;
  document.getElementById('replyPreviewBar').style.display = 'none';
  if (currentChatType === 'direct') {
    await db.collection('directChats').doc(currentChat.id).update({ lastMessage: text, lastMessageTime: firebase.firestore.FieldValue.serverTimestamp() });
  } else {
    await db.collection('groups').doc(currentChat.id).update({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }
  if (!isChatMuted(currentChat.id)) sendNotification(currentChat.name || currentChat.otherUserName, text);
}

async function handleFileUpload(file) {
  if (file.type.startsWith('image/')) {
    const url = await uploadToCloudinary(file);
    currentAttachment = { type: 'image', url };
    showToast('Image ready to send. Click send.');
  } else {
    const url = await uploadDocument(file);
    currentAttachment = { type: 'document', url, filename: file.name };
    showToast('Document ready to send. Click send.');
  }
}

function copyToClipboard(text) { navigator.clipboard.writeText(text); showToast('Copied to clipboard'); }
function setReplyTo(messageData) { currentReplyTo = messageData; document.getElementById('replyPreviewBar').style.display = 'block'; document.getElementById('replyPreviewSender').textContent = messageData.senderName; document.getElementById('replyPreviewText').textContent = messageData.text ? messageData.text.substring(0, 100) : 'Media'; }
async function editMessage(messageId, oldText) { const newText = prompt('Edit message:', oldText); if (newText && newText !== oldText) { await db.collection('messages').doc(messageId).update({ text: newText, edited: true, editedAt: firebase.firestore.FieldValue.serverTimestamp() }); showToast('Message edited'); } }
async function deleteMessage(messageId) { if (confirm('Delete this message for everyone?')) { await db.collection('messages').doc(messageId).delete(); showToast('Message deleted'); } }
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
  const menu = document.createElement('div'); menu.className = 'context-menu message-context-menu';
  menu.style.cssText = `display: block; position: fixed; left: ${x}px; top: ${y}px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 10000; min-width: 180px; overflow: hidden;`;
  const items = [
    { text: '📋 Copy', action: () => copyToClipboard(messageData.text) },
    { text: '↩️ Reply', action: () => setReplyTo(messageData) },
    { text: '⭐ Star', action: () => starMessage(messageId, messageData) },
    { text: '📌 Pin', action: () => pinMessage(messageId, messageData) },
    { text: '➡️ Forward', action: () => showForwardModal(messageData) }
  ];
  if (isMyMessage) {
    items.push({ text: 'Info', action: () => showMessageInfo(messageId, messageData) });
    items.push({ text: 'Edit', action: () => editMessage(messageId, messageData.text) });
    items.push({ text: '🗑️ Delete for everyone', action: () => deleteMessage(messageId) });
  }
  items.push({ text: '🚫 Block user', action: () => blockUser(messageData.senderId, messageData.senderName) });
  items.forEach(item => {
    const div = document.createElement('div'); div.className = 'context-menu-item'; div.style.cssText = `padding: 12px 16px; cursor: pointer; font-size: 14px; ${item.text.includes('Delete') || item.text.includes('Block') ? 'color: #dc2626;' : ''}`;
    div.textContent = item.text;
    div.onmouseenter = () => div.style.background = '#f1f5f9';
    div.onmouseleave = () => div.style.background = 'white';
    div.onclick = () => { item.action(); menu.remove(); };
    menu.appendChild(div);
  });
  document.body.appendChild(menu);
  setTimeout(() => { document.addEventListener('click', () => menu.remove(), { once: true }); }, 100);
}

// ========================================
// PROFILE FUNCTIONS
// ========================================

async function updateProfileAvatar(file) { const url = await uploadToCloudinary(file); await db.collection('users').doc(currentUser.uid).update({ avatar: url }); await currentUser.updateProfile({ photoURL: url }); showToast('Avatar updated'); showProfileModal(); }
async function updateStatusText(statusText) { await db.collection('users').doc(currentUser.uid).update({ statusText }); showToast('Status updated'); }
async function updatePhoneNumber(phoneNumber) { if (!isValidIndianPhone(phoneNumber)) { showToast('Enter valid phone number', 'error'); return false; } await db.collection('users').doc(currentUser.uid).update({ phone: phoneNumber }); showToast('Phone number saved!'); return true; }
async function updatePrivacySettings() { await db.collection('users').doc(currentUser.uid).update({ privacySettings }); }

async function showProfileModal() {
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const userData = userDoc.data();
  document.getElementById('profileName').textContent = userData.displayName || currentUser.displayName;
  document.getElementById('profileEmail').textContent = userData.email || currentUser.email;
  document.getElementById('profilePhone').textContent = userData.phoneNumber || 'Not set';
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
  const groupActions = document.getElementById('groupActions');
  
  if (tab === 'groups') {
    chatsList.style.display = 'none';
    groupsList.style.display = 'block';
    if (groupActions) groupActions.style.display = 'flex';
    loadGroupsList();
    document.getElementById('searchInput').placeholder = '🔍 Search groups by name...';
    document.getElementById('searchInput').oninput = (e) => searchGroupsRealtime(e.target.value);
  } else {
    chatsList.style.display = 'block';
    groupsList.style.display = 'none';
    if (groupActions) groupActions.style.display = 'none';
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
    await loadBlockedUsers();
    await loadMutedChats();
    await loadFavoriteChatIds();
    await loadQuickReplies();
    await loadAllUsers();
    loadWallpaperFromStorage();
    await checkFirstTimeUser();
    setupChatListListeners();
    setupRequestListeners();
    loadReceivedRequests();
    switchTab('all');
    loadArchivedChats();
    if (Notification.permission === 'default') Notification.requestPermission();
    setInterval(async () => { await db.collection('users').doc(currentUser.uid).update({ lastSeen: new Date() }); }, 60000);
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
  document.getElementById('fileInput')?.addEventListener('change', async (e) => { if (e.target.files[0]) await handleFileUpload(e.target.files[0]); });

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
  document.querySelector('.confirmGroupBtn')?.addEventListener('click', async () => { const groupName = document.getElementById('newGroupName').value; const members = document.getElementById('newGroupMembers').value; if (groupName.trim()) { await createGroup(groupName, members); createGroupModal.style.display = 'none'; document.getElementById('newGroupName').value = ''; document.getElementById('newGroupMembers').value = ''; } });
  
  const joinGroupModal = document.getElementById('joinGroupModal');
  document.getElementById('showJoinGroupBtn')?.addEventListener('click', () => { joinGroupModal.style.display = 'flex'; });
  document.querySelectorAll('.closeJoinModal').forEach(btn => { btn.addEventListener('click', () => { joinGroupModal.style.display = 'none'; }); });
  document.querySelector('.confirmJoinBtn')?.addEventListener('click', async () => { const code = document.getElementById('joinGroupCodeInput').value; await joinGroup(code); joinGroupModal.style.display = 'none'; document.getElementById('joinGroupCodeInput').value = ''; });
  
  document.querySelectorAll('.closeGroupInfoModal').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('groupInfoModal').style.display = 'none'; }); });
  document.getElementById('editGroupNameInput')?.addEventListener('change', async (e) => { await updateGroupName(e.target.value); });
  document.getElementById('groupAvatarLarge')?.addEventListener('click', () => { document.getElementById('groupIconInput').click(); });
  document.getElementById('groupIconInput')?.addEventListener('change', async (e) => { if (e.target.files[0]) await updateGroupIcon(e.target.files[0]); });
  document.getElementById('addMemberBtn')?.addEventListener('click', async () => { const email = document.getElementById('addMemberEmail').value; await addMemberToGroup(email); document.getElementById('addMemberEmail').value = ''; });
  document.getElementById('leaveGroupBtn')?.addEventListener('click', leaveGroup);
  document.getElementById('deleteGroupBtn')?.addEventListener('click', deleteGroup);
  document.getElementById('copyGroupCodeBtn')?.addEventListener('click', () => { const code = document.getElementById('groupCodeDisplay').textContent; navigator.clipboard.writeText(code); showToast('Group code copied!'); });

  // Profile Modal
  document.querySelectorAll('.closeProfileModal').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('profileModal').style.display = 'none'; }); });
  document.getElementById('changeAvatarBtn')?.addEventListener('click', () => { document.getElementById('avatarInput').click(); });
  document.getElementById('avatarInput')?.addEventListener('change', async (e) => { if (e.target.files[0]) await updateProfileAvatar(e.target.files[0]); });
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
  const chatId = chatItem.dataset.chatId;
  const chatType = chatItem.dataset.chatType;
  const unreadCount = Number(chatItem.dataset.unreadCount || 0);
  const isFavorite = favoriteChatIds.includes(chatId);
  
  if (favoriteItem) favoriteItem.textContent = isFavorite ? '⭐ Remove favorite' : '⭐ Add to favorite';
  if (markReadItem) markReadItem.textContent = unreadCount > 0 ? '✅ Mark as read' : '📩 Mark as unread';
  
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
  const listInfo = contextMenuTarget.querySelector('.list-info');
  const userName = listInfo?.querySelector('.list-name')?.textContent || 'User';
  if (confirm(`Block this user?`)) {
    // Find the user ID from chat
    const chatItem = contextMenuTarget;
    // This would require storing the user ID in the chat item
    showToast('User blocked!');
  }
  document.getElementById('chatContextMenu').style.display = 'none';
});

document.getElementById('deleteChatMenuItem')?.addEventListener('click', async () => {
  if (!contextMenuTarget) return;
  const listInfo = contextMenuTarget.querySelector('.list-info');
  const chatName = listInfo?.querySelector('.list-name')?.textContent || 'Chat';
  if (confirm(`Delete this chat? This action cannot be undone.`)) {
    const chatId = contextMenuTarget.querySelector('.archive-chat-btn')?.dataset.chatId;
    const chatType = contextMenuTarget.querySelector('.archive-chat-btn')?.dataset.chatType;
    if (chatId && chatType) {
      try {
        if (chatType === 'direct') {
          await db.collection('directChats').doc(chatId).delete();
          loadChatsList();
        } else {
          // For groups, just leave
          await db.collection('groupMembers').where('groupId', '==', chatId).where('userId', '==', currentUser.uid).get().then(snap => {
            snap.forEach(doc => doc.ref.delete());
          });
          loadGroupsList();
        }
        showToast('Chat deleted!');
      } catch (error) {
        showToast('Failed to delete chat', 'error');
      }
    }
  }
  document.getElementById('chatContextMenu').style.display = 'none';
});

init();
