// ========================================
// COMPLETE CHAT APP - WITH PHONE & EMAIL VALIDATION
// Phone: 10 digits only, no country code
// Email: proper format validation
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

// Global variables
let currentUser = null;
let currentChat = null;
let currentChatType = null;
let activeUnsubscribe = null;
let contextMessageId = null;
let contextMessageIsRead = false;
let contextMessageText = '';
let editingMessageId = null;
let allUsers = [];
let mobileMenuOpen = false;
let soundEnabled = true;
let typingTimeout = null;
let unreadCounts = {};
let inactivityTimer = null;
let currentOnlineStatus = 'online';
let currentUserStatusText = '';
let isFirstLogin = false;

// File upload variables
let currentFile = null;
let currentFileUploading = false;
let currentUploadXHR = null;

// Search variables
let currentSearchResults = [];
let currentSearchIndex = -1;

// Country codes list
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

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function generateGroupCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getDirectChatId(userId1, userId2) {
  return [userId1, userId2].sort().join('_');
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ========================================
// SEARCH VALIDATION FUNCTIONS
// ========================================
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhoneNumber(phone) {
  // Remove any non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  // Check if exactly 10 digits and doesn't start with 0
  return /^[1-9][0-9]{9}$/.test(cleanPhone);
}

function validateSearchTerm(term) {
  term = term.trim();
  if (!term) return { valid: false, error: null };
  
  // Check if it looks like an email (contains @)
  if (term.includes('@')) {
    if (isValidEmail(term)) {
      return { valid: true, type: 'email', value: term.toLowerCase() };
    } else {
      return { valid: false, error: 'Please enter a valid email address (e.g., name@example.com)' };
    }
  }
  
  // Check if it looks like a phone number (contains digits)
  if (/\d/.test(term)) {
    // Check for country code pattern (+91, +1, etc.)
    if (term.includes('+')) {
      return { valid: false, error: 'Search phone number without country code' };
    }
    
    const cleanPhone = term.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      if (isValidPhoneNumber(cleanPhone)) {
        return { valid: true, type: 'phone', value: cleanPhone };
      } else {
        return { valid: false, error: 'Please enter a valid 10-digit phone number (not starting with 0)' };
      }
    } else {
      return { valid: false, error: 'Please enter a valid 10-digit phone number' };
    }
  }
  
  // Default - treat as name search (partial match)
  return { valid: true, type: 'name', value: term.toLowerCase() };
}

// ========================================
// PHONE NUMBER FUNCTIONS
// ========================================
async function updateUserPhoneNumber(countryCode, phoneNumber) {
  if (!currentUser) return false;
  
  // Validate phone number (10 digits)
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

async function getUserPhoneNumber() {
  if (!currentUser) return null;
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  return userDoc.data()?.phoneNumber || null;
}

// ========================================
// FIRST LOGIN PHONE PROMPT
// ========================================
async function checkAndShowPhonePrompt() {
  if (!currentUser) return;
  
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const userData = userDoc.data();
  
  if (userData?.phoneNumber && userData.phoneNumber !== '') {
    return;
  }
  
  const promptDismissed = localStorage.getItem(`phone_prompt_dismissed_${currentUser.uid}`);
  if (promptDismissed === 'true') {
    return;
  }
  
  const modal = document.getElementById('phonePromptModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function dismissPhonePrompt() {
  const modal = document.getElementById('phonePromptModal');
  if (modal) {
    modal.style.display = 'none';
  }
  localStorage.setItem(`phone_prompt_dismissed_${currentUser.uid}`, 'true');
}

// ========================================
// SEARCH USERS WITH VALIDATION
// ========================================
function searchUsers(searchTerm) {
  const usersList = document.getElementById('usersList');
  const clearBtn = document.getElementById('clearUserSearchBtn');
  const errorDiv = document.getElementById('searchError');
  
  // Clear previous error
  if (errorDiv) errorDiv.style.display = 'none';
  
  if (!searchTerm || searchTerm.trim() === '') {
    usersList.innerHTML = '<div class="empty-users"><div class="empty-icon">🔍</div><p>Search by name, email, or phone to find users</p></div>';
    if (clearBtn) clearBtn.style.display = 'none';
    return;
  }
  
  const validation = validateSearchTerm(searchTerm);
  
  if (!validation.valid) {
    // Show error message
    if (errorDiv) {
      errorDiv.textContent = validation.error;
      errorDiv.style.display = 'flex';
    }
    usersList.innerHTML = '<div class="empty-users"><div class="empty-icon">⚠️</div><p>Please correct the search term</p></div>';
    if (clearBtn) clearBtn.style.display = 'flex';
    return;
  }
  
  // Hide error if validation passed
  if (errorDiv) errorDiv.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'flex';
  
  let filtered = [];
  const term = validation.value;
  
  if (validation.type === 'email') {
    // Exact email match
    filtered = allUsers.filter(user => 
      (user.email || '').toLowerCase() === term
    );
  } else if (validation.type === 'phone') {
    // Exact phone number match (raw digits)
    filtered = allUsers.filter(user => 
      (user.phoneNumberRaw || '') === term
    );
  } else {
    // Name search: partial match (contains)
    filtered = allUsers.filter(user => 
      (user.displayName || '').toLowerCase().includes(term)
    );
  }
  
  if (filtered.length === 0) {
    usersList.innerHTML = '<div class="empty-users"><div class="empty-icon">👤</div><p>No users found</p><small>Try a different search term</small></div>';
    return;
  }
  
  usersList.innerHTML = '';
  filtered.forEach(user => {
    const userDiv = document.createElement('div');
    userDiv.className = 'item';
    const statusDotClass = user.onlineStatus === 'busy' ? 'busy' : (user.onlineStatus === 'away' ? 'away' : 'online');
    userDiv.innerHTML = `
      <div class="item-avatar">
        ${user.avatar ? `<img src="${user.avatar}">` : (user.displayName ? user.displayName[0].toUpperCase() : '👤')}
        <div class="online-dot-small ${statusDotClass}"></div>
      </div>
      <div class="item-content">
        <div class="item-name">${escapeHtml(user.displayName || 'User')}</div>
        <div class="item-status-text">${escapeHtml(user.statusText || '')}</div>
        <div class="item-sub">${escapeHtml(user.email || '')}</div>
        ${user.phoneNumberRaw ? `<div class="item-sub">📱 ${escapeHtml(user.phoneNumberRaw)}</div>` : ''}
      </div>
    `;
    userDiv.onclick = () => startDirectChat(user);
    usersList.appendChild(userDiv);
  });
}

function clearUserSearch() {
  const searchInput = document.getElementById('searchUsers');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clearUserSearchBtn');
  if (clearBtn) clearBtn.style.display = 'none';
  const errorDiv = document.getElementById('searchError');
  if (errorDiv) errorDiv.style.display = 'none';
  document.getElementById('usersList').innerHTML = '<div class="empty-users"><div class="empty-icon">🔍</div><p>Search by name, email, or phone to find users</p></div>';
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
// ATTACHMENT DISPLAY IN MESSAGE
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
// SEND MESSAGE
// ========================================
async function sendMessage(text, attachment = null) {
  if (!currentChat) return;
  
  try {
    const messageData = {
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email.split('@')[0],
      text: text?.trim() || '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      chatType: currentChatType,
      read: false,
      edited: false
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
    
    await db.collection('messages').add(messageData);
    
    let lastMessageText = text?.trim() || '';
    if (attachment) {
      if (attachment.type === 'image') lastMessageText = `📷 Photo`;
      else if (attachment.type === 'video') lastMessageText = `🎥 Video`;
      else if (attachment.type === 'audio') lastMessageText = `🎵 Audio`;
      else lastMessageText = `📎 ${attachment.filename}`;
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
        lastMessageSender: currentUser.uid
      }, { merge: true });
    }
    
    if (soundEnabled) playNotificationSound();
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
// LOAD DIRECT MESSAGES
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
        const isMyMessage = message.senderId === currentUser.uid;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-wrapper ${isMyMessage ? 'my-message' : ''}`;
        
        let attachmentHtml = '';
        if (message.attachment) {
          attachmentHtml = displayAttachment(message.attachment);
        }
        
        const editedHtml = message.edited ? '<span class="message-edited">(edited)</span>' : '';
        const readReceiptHtml = isMyMessage ? `<span class="read-receipt ${message.read ? 'read' : 'delivered'}">${message.read ? '✓✓' : '✓'}</span>` : '';
        
        messageDiv.innerHTML = `
          <div class="message-bubble" data-message-id="${doc.id}" data-message-read="${message.read}" data-message-text="${escapeHtml(message.text || '')}">
            ${!isMyMessage ? `<div class="message-sender">${escapeHtml(message.senderName)}</div>` : ''}
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
          bubble.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            contextMessageId = doc.id;
            contextMessageIsRead = message.read || false;
            contextMessageText = message.text || '';
            showContextMenu(e.clientX, e.clientY);
          });
          let pressTimer;
          bubble.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
              contextMessageId = doc.id;
              contextMessageIsRead = message.read || false;
              contextMessageText = message.text || '';
              showContextMenu(e.touches[0].clientX, e.touches[0].clientY);
            }, 500);
          });
          bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
          bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));
        }
        messagesArea.appendChild(messageDiv);
      });
      messagesArea.scrollTop = messagesArea.scrollHeight;
      markMessagesAsRead(currentChat.id, false);
    });
}

// ========================================
// LOAD GROUP MESSAGES
// ========================================
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
        const isMyMessage = message.senderId === currentUser.uid;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-wrapper ${isMyMessage ? 'my-message' : ''}`;
        
        let attachmentHtml = '';
        if (message.attachment) {
          attachmentHtml = displayAttachment(message.attachment);
        }
        
        const editedHtml = message.edited ? '<span class="message-edited">(edited)</span>' : '';
        
        messageDiv.innerHTML = `
          <div class="message-bubble" data-message-id="${doc.id}">
            ${!isMyMessage ? `<div class="message-sender">${escapeHtml(message.senderName)}</div>` : ''}
            <div class="message-text">${escapeHtml(message.text || '')}${editedHtml}</div>
            ${attachmentHtml}
            <div class="message-footer">
              <span class="message-time">${message.timestamp ? formatTime(message.timestamp) : ''}</span>
            </div>
          </div>
        `;
        
        if (isMyMessage) {
          const bubble = messageDiv.querySelector('.message-bubble');
          bubble.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            contextMessageId = doc.id;
            contextMessageIsRead = message.read || false;
            contextMessageText = message.text || '';
            showContextMenu(e.clientX, e.clientY);
          });
          let pressTimer;
          bubble.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
              contextMessageId = doc.id;
              contextMessageIsRead = message.read || false;
              contextMessageText = message.text || '';
              showContextMenu(e.touches[0].clientX, e.touches[0].clientY);
            }, 500);
          });
          bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
          bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));
        }
        messagesArea.appendChild(messageDiv);
      });
      messagesArea.scrollTop = messagesArea.scrollHeight;
      markMessagesAsRead(currentChat.id, true);
    });
}

// ========================================
// CONTEXT MENU
// ========================================
function showContextMenu(x, y) {
  const menu = document.getElementById('messageMenu');
  const editOption = document.getElementById('editMessageBtn');
  if (editOption) {
    editOption.style.display = contextMessageIsRead ? 'none' : 'flex';
  }
  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('touchstart', hideContextMenu);
  }, 10);
}

function hideContextMenu() {
  const menu = document.getElementById('messageMenu');
  if (menu) menu.style.display = 'none';
  document.removeEventListener('click', hideContextMenu);
  document.removeEventListener('touchstart', hideContextMenu);
}

document.getElementById('editMessageBtn')?.addEventListener('click', async () => {
  if (contextMessageId) {
    document.getElementById('editMessageInput').value = contextMessageText;
    document.getElementById('editMessageModal').style.display = 'flex';
    hideContextMenu();
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
    hideContextMenu();
    contextMessageId = null;
  }
});

// ========================================
// GLOBAL SEARCH FUNCTIONS
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
        if (groupDoc.exists) {
          selectGroup({ id: chatId, name: groupDoc.data().name });
        }
      } else {
        const otherUserId = chatId.split('_').find(id => id !== currentUser.uid);
        const userDoc = await db.collection('users').doc(otherUserId).get();
        if (userDoc.exists) {
          startDirectChat({ id: otherUserId, ...userDoc.data() });
        }
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
// IN-CHAT SEARCH FUNCTIONS
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
  document.querySelectorAll('.message-bubble').forEach(bubble => {
    bubble.classList.remove('highlighted', 'active');
  });
  currentSearchResults = [];
  currentSearchIndex = -1;
  document.getElementById('searchResultCount').textContent = '0 results';
  const navButtons = document.querySelector('.in-chat-search-nav');
  if (navButtons) navButtons.style.display = 'none';
}

function highlightCurrentSearchResult() {
  document.querySelectorAll('.message-bubble').forEach(bubble => {
    bubble.classList.remove('active');
  });
  
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
    if (currentOnlineStatus === 'online') {
      updateOnlineStatus('away');
    }
  }, 5 * 60 * 1000);
}

function resetInactivityTimer() {
  if (currentOnlineStatus === 'away') {
    updateOnlineStatus('online');
  }
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (currentOnlineStatus === 'online') {
      updateOnlineStatus('away');
    }
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
    setTimeout(() => { ring.style.display = 'none'; }, 24 * 60 * 60 * 1000);
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
// LOAD ALL USERS FOR SEARCH
// ========================================
async function loadAllUsers() {
  if (!currentUser) return;
  try {
    const snapshot = await db.collection('users').get();
    allUsers = [];
    snapshot.forEach(doc => {
      if (doc.id !== currentUser.uid) {
        allUsers.push({ id: doc.id, ...doc.data() });
      }
    });
  } catch (error) {
    console.error('Load users error:', error);
  }
}

async function startDirectChat(user) {
  const chatId = getDirectChatId(currentUser.uid, user.id);
  const chatRef = db.collection('directChats').doc(chatId);
  const chatDoc = await chatRef.get();
  if (!chatDoc.exists) {
    await chatRef.set({
      participants: [currentUser.uid, user.id],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      participantNames: {
        [currentUser.uid]: currentUser.displayName || currentUser.email,
        [user.id]: user.displayName || user.email
      }
    });
  }
  currentChat = { id: chatId, otherUserId: user.id, otherUserName: user.displayName || user.email, type: 'direct' };
  currentChatType = 'direct';
  document.getElementById('currentChatName').textContent = user.displayName || user.email;
  document.getElementById('chatType').textContent = 'Personal Chat';
  const statusBadge = document.getElementById('chatStatusBadge');
  if (user.onlineStatus === 'online') statusBadge.innerHTML = '🟢 Online';
  else if (user.onlineStatus === 'busy') statusBadge.innerHTML = '🟠 Busy';
  else statusBadge.innerHTML = '🔴 Away';
  statusBadge.className = `chat-status-badge ${user.onlineStatus || 'online'}`;
  document.getElementById('messageInputArea').style.display = 'block';
  closeMobileMenuOnChat();
  await markMessagesAsRead(chatId, false);
  loadDirectMessages();
  setupTypingListener();
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

async function loadGroups() {
  if (!currentUser) return;
  const groupsList = document.getElementById('groupsList');
  groupsList.innerHTML = '<div class="loading">Loading groups...</div>';
  try {
    const snapshot = await db.collection('groupMembers').where('userId', '==', currentUser.uid).get();
    const groupIds = [];
    snapshot.forEach(doc => groupIds.push(doc.data().groupId));
    if (groupIds.length === 0) {
      groupsList.innerHTML = '<div class="empty-users"><div class="empty-icon">👥</div><p>No groups yet. Create or join one!</p></div>';
      return;
    }
    const groups = [];
    for (const groupId of groupIds) {
      const groupDoc = await db.collection('groups').doc(groupId).get();
      if (groupDoc.exists) groups.push({ id: groupDoc.id, ...groupDoc.data() });
    }
    groupsList.innerHTML = '';
    groups.forEach(group => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'item' + (currentChat?.id === group.id && currentChatType === 'group' ? ' active' : '');
      groupDiv.innerHTML = `
        <div class="item-avatar">👥</div>
        <div class="item-content">
          <div class="item-name">${escapeHtml(group.name)}</div>
          <div class="item-sub">Code: ${group.code}</div>
        </div>
      `;
      groupDiv.onclick = () => selectGroup(group);
      groupsList.appendChild(groupDiv);
    });
  } catch (error) {
    groupsList.innerHTML = '<div class="empty-users"><div class="empty-icon">⚠️</div><p>Error loading groups</p></div>';
  }
}

function selectGroup(group) {
  currentChat = group;
  currentChatType = 'group';
  document.getElementById('currentChatName').textContent = group.name;
  document.getElementById('chatType').textContent = 'Group Chat';
  document.getElementById('chatStatusBadge').innerHTML = '';
  document.getElementById('messageInputArea').style.display = 'block';
  closeMobileMenuOnChat();
  loadGroupMessages();
  setupTypingListener();
}

async function createGroup(groupName) {
  if (!groupName.trim() || !currentUser) return;
  const groupCode = generateGroupCode();
  try {
    const groupRef = await db.collection('groups').add({
      name: groupName.trim(), code: groupCode, createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('groupMembers').add({ groupId: groupRef.id, userId: currentUser.uid });
    await loadGroups();
    showError('Group created successfully!', false);
    return groupRef.id;
  } catch (error) {
    showError('Failed to create group');
    return null;
  }
}

async function joinGroup(groupCode) {
  if (!groupCode.trim() || !currentUser) return;
  try {
    const groupsQuery = await db.collection('groups').where('code', '==', groupCode.trim().toUpperCase()).limit(1).get();
    if (groupsQuery.empty) { showError('Group not found.'); return false; }
    const group = groupsQuery.docs[0];
    const memberCheck = await db.collection('groupMembers').where('groupId', '==', group.id).where('userId', '==', currentUser.uid).get();
    if (!memberCheck.empty) { showError('Already a member'); return false; }
    await db.collection('groupMembers').add({ groupId: group.id, userId: currentUser.uid });
    await loadGroups();
    showError('Joined group!', false);
    return true;
  } catch (error) {
    showError('Failed to join group');
    return false;
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
      phoneNumberRaw: ''
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
  if (sidebar) {
    mobileMenuOpen = !mobileMenuOpen;
    sidebar.classList.toggle('open');
  }
}

function closeMobileMenuOnChat() {
  if (window.innerWidth <= 768 && mobileMenuOpen) toggleMobileMenu();
}

function showSettingsMenu(x, y) {
  const menu = document.getElementById('settingsMenu');
  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  setTimeout(() => {
    document.addEventListener('click', hideSettingsMenu);
    document.addEventListener('touchstart', hideSettingsMenu);
  }, 10);
}

function hideSettingsMenu() {
  const menu = document.getElementById('settingsMenu');
  if (menu) menu.style.display = 'none';
  document.removeEventListener('click', hideSettingsMenu);
  document.removeEventListener('touchstart', hideSettingsMenu);
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

function switchTab(tab) {
  document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.chat-tab[data-tab="${tab}"]`).classList.add('active');
  document.querySelectorAll('.chat-panel').forEach(p => p.classList.remove('active'));
  if (tab === 'groups') {
    document.getElementById('groupsPanel').classList.add('active');
    loadGroups();
  } else {
    document.getElementById('directPanel').classList.add('active');
    document.getElementById('usersList').innerHTML = '<div class="empty-users"><div class="empty-icon">🔍</div><p>Search by name, email, or phone to find users</p></div>';
    document.getElementById('searchUsers').value = '';
    document.getElementById('clearUserSearchBtn').style.display = 'none';
    document.getElementById('searchError').style.display = 'none';
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
      if (currentUploadXHR) {
        currentUploadXHR.abort();
        currentUploadXHR = null;
      }
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
      if (currentUploadXHR) {
        currentUploadXHR.abort();
        currentUploadXHR = null;
      }
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
        if (currentUploadXHR) {
          currentUploadXHR.abort();
          currentUploadXHR = null;
        }
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
      if (searchInput && searchInput.value.trim()) {
        searchUsers(searchInput.value);
      }
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
      const menuToggle = document.createElement('button');
      menuToggle.className = 'mobile-menu-toggle';
      menuToggle.innerHTML = '☰';
      menuToggle.onclick = toggleMobileMenu;
      menuToggle.style.cssText = 'background:none;border:none;font-size:24px;color:white;cursor:pointer;margin-right:10px;';
      sidebarHeader?.insertBefore(menuToggle, sidebarHeader.firstChild);
    }
    
    await loadGroups();
    
    // Show phone prompt after loading (but not immediately on every login)
    setTimeout(() => {
      checkAndShowPhonePrompt();
    }, 1000);
    
    // Setup search input listener
    const searchInput = document.getElementById('searchUsers');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchUsers(e.target.value);
      });
    }
    
    const clearSearchBtn = document.getElementById('clearUserSearchBtn');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', clearUserSearch);
    }
    
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
    
    if (clearGlobalSearch) {
      clearGlobalSearch.addEventListener('click', () => {
        globalSearchInput.value = '';
        clearGlobalSearch.style.display = 'none';
        document.getElementById('globalSearchResults').style.display = 'none';
      });
    }
    
    if (inChatSearchInput) {
      inChatSearchInput.addEventListener('input', (e) => {
        clearInChatSearch.style.display = e.target.value ? 'flex' : 'none';
        performInChatSearch(e.target.value);
      });
    }
    
    if (clearInChatSearch) {
      clearInChatSearch.addEventListener('click', () => {
        inChatSearchInput.value = '';
        clearInChatSearch.style.display = 'none';
        clearInChatSearch();
      });
    }
    
    document.getElementById('nextResultBtn')?.addEventListener('click', nextSearchResult);
    document.getElementById('prevResultBtn')?.addEventListener('click', prevSearchResult);
  });
  
  document.querySelector('.chat-main')?.addEventListener('click', closeMobileMenuOnChat);
  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  
  setupAttachmentHandlers();
  
  document.getElementById('createGroupBtn')?.addEventListener('click', () => document.getElementById('createGroupModal').style.display = 'flex');
  document.getElementById('confirmCreateGroup')?.addEventListener('click', async () => {
    const groupName = document.getElementById('newGroupName').value;
    if (groupName.trim()) { await createGroup(groupName); document.getElementById('createGroupModal').style.display = 'none'; document.getElementById('newGroupName').value = ''; }
  });
  document.getElementById('joinGroupBtn')?.addEventListener('click', async () => {
    const groupCode = document.getElementById('joinGroupCode').value;
    await joinGroup(groupCode);
    document.getElementById('joinGroupCode').value = '';
  });
  
  document.getElementById('changeAvatarMenuItem')?.addEventListener('click', () => {
    hideSettingsMenu();
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
    hideSettingsMenu();
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
    hideSettingsMenu();
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
      // Refresh profile display
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      document.getElementById('profilePhone').textContent = userDoc.data()?.phoneNumber || 'Not set';
    } else {
      showError('Please enter a valid 10-digit phone number');
    }
  });
  
  document.getElementById('savePhonePromptBtn')?.addEventListener('click', async () => {
    const countryCode = document.getElementById('phoneCountryCode').value;
    const phoneNumber = document.getElementById('promptPhoneNumber').value.trim();
    if (phoneNumber) {
      const success = await updateUserPhoneNumber(countryCode, phoneNumber);
      if (success) {
        dismissPhonePrompt();
        document.getElementById('promptPhoneNumber').value = '';
      }
    } else {
      dismissPhonePrompt();
    }
  });
  
  document.getElementById('skipPhonePromptBtn')?.addEventListener('click', dismissPhonePrompt);
  document.getElementById('closePhonePromptBtn')?.addEventListener('click', dismissPhonePrompt);
  
  document.getElementById('soundToggleMenuItem')?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    showError(`Sound ${soundEnabled ? 'ON' : 'OFF'}`, false);
    hideSettingsMenu();
  });
  
  document.getElementById('changePasswordMenuItem')?.addEventListener('click', () => { hideSettingsMenu(); document.getElementById('changePasswordModal').style.display = 'flex'; });
  document.getElementById('changeEmailMenuItem')?.addEventListener('click', () => { hideSettingsMenu(); document.getElementById('changeEmailModal').style.display = 'flex'; });
  
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
  
  document.querySelectorAll('.close-modal, .avatar-close, .password-close, .email-close, .profile-close, .user-profile-close, .edit-close, .phone-close').forEach(el => {
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
    });
  });
  
  document.getElementById('profileCloseBtn')?.addEventListener('click', () => document.getElementById('profileModal').style.display = 'none');
  document.getElementById('userProfileCloseBtn')?.addEventListener('click', () => document.getElementById('userProfileModal').style.display = 'none');
  document.getElementById('profileSendMsgBtn')?.addEventListener('click', () => document.getElementById('profileModal').style.display = 'none');
  document.getElementById('userProfileSendMsgBtn')?.addEventListener('click', () => {
    const userId = document.getElementById('userProfileModal').dataset.userId;
    const user = allUsers.find(u => u.id === userId);
    if (user) startDirectChat(user);
    document.getElementById('userProfileModal').style.display = 'none';
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
  
  document.querySelectorAll('.chat-tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
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