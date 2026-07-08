/* ============================================================
   TEAM CHAT — 2026 REDESIGN & REVAMP
   app.js — Complete Application Logic with 24 Design Variants
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════════════
   1. APP STATE
   ══════════════════════════════════════════════════ */
const App = {
  currentUser: null,
  currentChat: null,
  chats: [],
  messages: {},
  contacts: [],
  activeTab: 'chats',
  theme: localStorage.getItem('tc_theme') || 'dark', // NSL Chat default
  isRecording: false,
  recordingTimer: null,
  recordingSeconds: 0,
  replyTo: null,
  emojiPickerOpen: false,
  attachMenuOpen: false,
  formatBarOpen: false,
  unreadScrollCount: 0,
  db: null,
  auth: null,
  unsubscribers: [],
  callActive: false,
  callMuted: false,
  cameraOff: false,
  callStartTime: null,
  callTimerInterval: null,
  mediaViewerIndex: 0,
  mediaViewerItems: [],
  searchFilter: 'all',
  chatRequests: { incoming: [], outgoing: [] },
  chatRequestsUnsubscribe: null,
  pendingRequestsCount: 0,
  callLogs: [],
  callLogsUnsubscribe: null,
  chatFolders: [],
  activeFolderIndex: -1,
  notifSoundEnabled: {},
  
  // Showroom overrides
  showroomOverride: null, // { type: 'myself'|'personal'|'group', viewport: 'desktop'|'laptop'|'tablet'|'mobile' }
  showroomViewport: 'auto', // auto | mobile | tablet | laptop | desktop

  emojiCategories: {
    recent: ['😊','👍','❤️','😂','🙏','🔥','✨','😍'],
    smileys: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐'],
    people: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄','💋','🩸'],
    nature: ['🌱','🌿','🍀','🍁','🍂','🍃','🌸','🌺','🌻','🌹','🥀','🌷','🌼','💐','🌾','🍄','🐚','🪸','🪨','🌵','🎋','🎍','🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥'],
    food: ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🧇','🥞','🧗','🍞','🥐','🥖','🫓','🥨','🥯','🧀','🥗','🥙','🥪','🌮','🌯','🫔','🧆','🥜','🫘','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯'],
    symbols: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','%','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🔱','⚜️','🔰','♻️','✅','🈯','💹','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈹','🚰','🚹','🚺','🚻','🚼','🚽','🛁','🚿']
  }
};

/* ══════════════════════════════════════════════════
   2. FIREBASE INIT
   ══════════════════════════════════════════════════ */
function initFirebase() {
  try {
    App.db   = firebase.firestore ? firebase.firestore()   : null;
    App.auth = firebase.auth      ? firebase.auth()        : null;
    App.rtdb = firebase.database  ? firebase.database()    : null;
  } catch(e) {
    console.warn('Firebase not available, running in demo mode');
  }
}

/* ══════════════════════════════════════════════════
   3. BOOT SEQUENCE
   ══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(App.theme);
  initFirebase();
  checkSession();
  setupKeyboardShortcuts();
  setupOnlineStatus();
  setupAutoResize();
  loadEmojiGrid('recent');
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', e => { if (e.key==='Escape') closeTopModal(); });

  // Add micro-animation depth with mouse movement for glows
  document.addEventListener('mousemove', (e) => {
    const glow1 = document.getElementById('atmosphere-glow-1');
    const glow2 = document.getElementById('atmosphere-glow-2');
    if (!glow1 || !glow2) return;
    
    const moveX = (e.clientX - window.innerWidth / 2) * 0.015;
    const moveY = (e.clientY - window.innerHeight / 2) * 0.015;
    
    glow1.style.transform = `translate(${moveX}px, ${moveY}px)`;
    glow2.style.transform = `translate(${-moveX}px, ${-moveY}px)`;
  });
});

App.usersUnsubscribe = null;
App.chatsUnsubscribe = null;
App.groupsUnsubscribe = null;
App.messagesUnsubscribe = null;
App.chatRequestsUnsubscribe = null;
App.directChats = [];
App.groupChats = [];

const _e2eSalt = new Uint8Array([87, 65, 45, 69, 50, 69, 45, 83, 65, 76, 84]);
const _e2eSharedKeys = {};

function _base64ToBuf(b64) {
  const binary = atob(b64);
  const u8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
  return u8;
}

function _bufToBase64(buf) {
  let binary = "";
  const len = buf.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary);
}

async function _loadE2EPrivateKey() {
  if (!App.auth?.currentUser) return null;
  try {
    const keyStr = localStorage.getItem("wa_e2e_" + App.auth.currentUser.uid);
    if (!keyStr) return null;
    return await crypto.subtle.importKey(
      "jwk", JSON.parse(keyStr),
      { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]
    );
  } catch (e) { return null; }
}

async function _fetchPeerPublicKey(peerUid) {
  if (!App.db) return null;
  try {
    const doc = await App.db.collection("userPublicKeys").doc(peerUid).get();
    if (!doc.exists) return null;
    const jwk = doc.data().publicKey;
    if (!jwk) return null;
    return await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
  } catch (e) { return null; }
}

async function deriveSharedAESKey(peerUid) {
  if (_e2eSharedKeys[peerUid]) return _e2eSharedKeys[peerUid];
  const privKey = await _loadE2EPrivateKey();
  if (!privKey) return null;
  const pubKey = await _fetchPeerPublicKey(peerUid);
  if (!pubKey) return null;
  try {
    const sharedBits = await crypto.subtle.deriveBits(
      { name: "ECDH", namedCurve: "P-256", public: pubKey },
      privKey, 256
    );
    const hkdfKey = await crypto.subtle.importKey("raw", sharedBits, { name: "HKDF" }, false, ["deriveKey"]);
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: _e2eSalt,
        info: new TextEncoder().encode("wa-e2e-v1"),
      },
      hkdfKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    _e2eSharedKeys[peerUid] = aesKey;
    return aesKey;
  } catch (e) { console.warn("E2E derive failed:", e); return null; }
}

async function decryptMessageText(ciphertext, iv, peerUid) {
  if (!ciphertext || !iv || !peerUid) return null;
  try {
    const key = await deriveSharedAESKey(peerUid);
    if (!key) return null;
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: _base64ToBuf(iv) },
      key,
      _base64ToBuf(ciphertext)
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) { return null; }
}

async function encryptMessageText(text, peerUid) {
  if (!text || !peerUid) return null;
  try {
    const key = await deriveSharedAESKey(peerUid);
    if (!key) return null;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, key, new TextEncoder().encode(text)
    );
    return { ciphertext: _bufToBase64(new Uint8Array(encrypted)), iv: _bufToBase64(iv) };
  } catch (e) { return null; }
}

function subscribeToUsers() {
  if (!App.db || !App.auth?.currentUser) {
    loadDemoData();
    bootApp();
    return;
  }
  if (App.usersUnsubscribe) App.usersUnsubscribe();
  
  App.usersUnsubscribe = App.db.collection('users').onSnapshot((snapshot) => {
    const contacts = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      contacts.push({
        uid: doc.id,
        name: data.displayName || data.email || 'User',
        avatar: data.avatar || 'gradient-2',
        initials: getInitials(data.displayName || data.email || 'User'),
        photoURL: data.photoURL || data.avatar || null,
        status: data.onlineStatus || 'offline',
        about: data.about || data.statusText || 'Available',
        email: data.email || '',
        phone: data.phone || data.phoneNumber || ''
      });
    });
    App.contacts = contacts;
    renderChatList();
    renderContactList();
  }, (error) => {
    console.warn("Users subscription failed, loading demo mode:", error);
    loadDemoData();
    bootApp();
  });
}

function subscribeToChats() {
  if (!App.db || !App.auth?.currentUser) return;
  const uid = App.auth.currentUser.uid;
  if (App.chatsUnsubscribe) App.chatsUnsubscribe();
  
  App.chatsUnsubscribe = App.db.collection('directChats')
    .where('participants', 'array-contains', uid)
    .onSnapshot((snapshot) => {
      const chatsList = [];
      const myselfChatId = `saved_${uid}`;
      const myselfChat = {
        id: myselfChatId,
        type: 'personal',
        uid: uid,
        name: 'Myself Chat',
        avatar: 'gradient-1',
        initials: getInitials(App.currentUser?.displayName || App.currentUser?.email || 'Me'),
        photoURL: App.currentUser?.photoURL || null,
        lastMsg: 'Your personal notes, files & reminders',
        lastTime: Date.now(),
        unread: 0,
        pinned: true,
        muted: false,
        status: 'online'
      };
      chatsList.push(myselfChat);
      
      const decryptPromises = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const chatId = doc.id;
        
        if (chatId === myselfChatId) {
          if (data.lastMessage) {
            myselfChat.lastMsg = data.lastMessage;
            myselfChat.lastTime = data.lastMessageTime?.toMillis ? data.lastMessageTime.toMillis() : (data.lastMessageTime || myselfChat.lastTime);
          }
          return;
        }
        
        const otherUserId = data.participants.find(p => p !== uid);
        if (!otherUserId) return;
        
        const otherUser = App.contacts.find(c => c.uid === otherUserId) || {
          uid: otherUserId,
          name: data.participantNames?.[otherUserId] || data.participantEmails?.[otherUserId]?.split('@')[0] || 'User',
          avatar: 'gradient-2',
          initials: getInitials(data.participantNames?.[otherUserId] || 'User'),
          photoURL: null,
          status: 'offline',
          about: data.participantEmails?.[otherUserId] || ''
        };
        
        const chatObj = {
          id: chatId,
          type: 'personal',
          uid: otherUserId,
          name: otherUser.name,
          avatar: otherUser.avatar,
          initials: otherUser.initials,
          photoURL: otherUser.photoURL,
          lastMsg: data.lastMessage || 'No messages yet',
          lastTime: data.lastMessageTime?.toMillis ? data.lastMessageTime.toMillis() : (data.lastMessageTime || 0),
          unread: data.unreadCount?.[uid] || 0,
          pinned: data.pinned?.[uid] || false,
          muted: data.muted?.[uid] || false,
          status: otherUser.status
        };
        
        if (data.lastMessage && data.lastMessageEncrypted && data.lastMessageIv) {
          decryptPromises.push(
            decryptMessageText(data.lastMessage, data.lastMessageIv, otherUserId).then(decryptedText => {
              if (decryptedText !== null) {
                chatObj.lastMsg = decryptedText;
              } else {
                chatObj.lastMsg = "🔒 Encrypted message";
              }
            })
          );
        }
        
        chatsList.push(chatObj);
      });
      
      if (decryptPromises.length > 0) {
        Promise.all(decryptPromises).then(() => {
          App.directChats = chatsList;
          mergeAndRenderChats();
        });
      } else {
        App.directChats = chatsList;
        mergeAndRenderChats();
      }
    }, (error) => {
      console.warn("Chats subscription failed:", error);
    });
}

function subscribeToGroups() {
  if (!App.db || !App.auth?.currentUser) return;
  const uid = App.auth.currentUser.uid;
  if (App.groupsUnsubscribe) App.groupsUnsubscribe();
  
  App.groupsUnsubscribe = App.db.collection('groups')
    .where('members', 'array-contains', uid)
    .onSnapshot((snapshot) => {
      const groupsList = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        groupsList.push({
          id: doc.id,
          type: 'group',
          name: data.name || 'Unnamed Group',
          avatar: data.avatar || 'gradient-3',
          initials: getInitials(data.name || 'Group'),
          photoURL: data.icon || null,
          lastMsg: data.lastMessage || 'No messages yet',
          lastTime: data.lastMessageTime?.toMillis ? data.lastMessageTime.toMillis() : (data.lastMessageTime || 0),
          unread: data.unreadCount?.[uid] || 0,
          pinned: data.pinned?.[uid] || false,
          muted: data.muted?.[uid] || false,
          memberCount: data.members?.length || 0
        });
      });
      App.groupChats = groupsList;
      mergeAndRenderChats();
    }, (error) => {
      console.warn("Groups subscription failed:", error);
    });
}

function subscribeToCallLogs(uid) {
  if (!App.db || !uid) return;
  if (App.callLogsUnsubscribe) App.callLogsUnsubscribe();
  App.callLogsUnsubscribe = App.db.collection('callLogs')
    .where('participants', 'array-contains', uid)
    .onSnapshot(snapshot => {
      const logs = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          callerId: data.callerId,
          calleeId: data.calleeId,
          type: data.type || 'voice',
          duration: data.duration || 0,
          timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp || 0),
          status: data.status || 'missed',
          participants: data.participants || []
        });
      });
      // In-memory sorting to avoid composite index requirement
      logs.sort((a, b) => b.timestamp - a.timestamp);
      App.callLogs = logs;
      if (App.activeTab === 'calls') renderCallsTab();
    }, e => console.warn('callLogs err:', e));
}

function mergeAndRenderChats() {
  const direct = App.directChats || [];
  const groups = App.groupChats || [];
  App.chats = [...direct, ...groups];
  renderChatList();
}

async function loadMessageHistory(email, uid) {
  if (!App.db || !email) return;
  try {
    const snap = await App.db.collection('messages')
      .where('participantEmails', 'array-contains', email)
      .orderBy('timestamp', 'asc')
      .limit(200)
      .get();
    const chatMap = {};
    const groupMap = {};
    snap.forEach(doc => {
      const data = doc.data();
      if (data.directId) {
        if (!chatMap[data.directId]) chatMap[data.directId] = { msgs: 0, lastTime: 0, participants: data.participants || [], participantEmails: data.participantEmails || [] };
        chatMap[data.directId].msgs++;
        if (data.timestamp?.toMillis) chatMap[data.directId].lastTime = Math.max(chatMap[data.directId].lastTime, data.timestamp.toMillis());
      }
      if (data.groupId) {
        if (!groupMap[data.groupId]) groupMap[data.groupId] = { msgs: 0, lastTime: 0, name: data.groupName || 'Group' };
        groupMap[data.groupId].msgs++;
        if (data.timestamp?.toMillis) groupMap[data.groupId].lastTime = Math.max(groupMap[data.groupId].lastTime, data.timestamp.toMillis());
      }
    });
    const existingIds = new Set(App.directChats.map(c => c.id));
    for (const [chatId, info] of Object.entries(chatMap)) {
      const otherEmail = info.participantEmails.find(e => e !== email) || '';
      const otherUid = info.participants.find(p => p !== uid) || '';
      const expectedId = getDirectChatId(uid, otherUid);

      // Re-registration merge: if chatId differs from expectedId, the messages use an old UID.
      // Migrate the old directChats doc to the new ID so the snapshot subscription picks it up.
      if (App.db && chatId !== expectedId && otherUid) {
        try {
          const oldDoc = await App.db.collection('directChats').doc(chatId).get();
          if (oldDoc.exists) {
            const oldData = oldDoc.data();
            await App.db.collection('directChats').doc(expectedId).set({
              participants: [uid, otherUid],
              participantNames: { ...(oldData.participantNames || {}), [uid]: App.currentUser.displayName || App.currentUser.email || 'Me' },
              participantEmails: { ...(oldData.participantEmails || {}), [uid]: email },
              status: 'active',
              lastMessage: oldData.lastMessage || null,
              lastMessageTime: oldData.lastMessageTime || null,
              lastMessageSenderId: oldData.lastMessageSenderId || null
            }, { merge: true }).catch(() => {});
            // Update old messages to reference users by email and new UID
            const msgSnap = await App.db.collection('messages')
              .where('directId', '==', chatId)
              .get();
            const batch = App.db.batch();
            msgSnap.forEach(doc => {
              const ref = App.db.collection('messages').doc(doc.id);
              batch.update(ref, {
                participants: firebase.firestore.FieldValue.arrayUnion(uid),
                participantEmails: firebase.firestore.FieldValue.arrayUnion(email),
                directId: expectedId
              });
            });
            await batch.commit().catch(() => {});
            // Delete old directChats doc
            await App.db.collection('directChats').doc(chatId).delete().catch(() => {});
          }
        } catch(e) { console.warn('merge chat err:', e); }
        continue;
      }

      if (existingIds.has(chatId) || chatId === `saved_${uid}`) continue;
      const contact = App.contacts.find(c => c.email === otherEmail || c.uid === otherUid) || { name: otherEmail.split('@')[0] || 'User', avatar: 'gradient-2', initials: '?', photoURL: null, status: 'offline', about: otherEmail };
      const chatObj = {
        id: chatId, type: 'personal', uid: otherUid,
        name: contact.name, avatar: contact.avatar, initials: contact.initials || '?',
        photoURL: contact.photoURL || null,
        lastMsg: `${info.msgs} message${info.msgs > 1 ? 's' : ''}`, lastTime: info.lastTime || Date.now(),
        unread: 0, pinned: false, muted: false, status: 'offline', email: otherEmail
      };
      App.directChats.push(chatObj);
      if (App.db) {
        App.db.collection('directChats').doc(chatId).set({
          participants: [uid, otherUid],
          participantNames: { [uid]: App.currentUser.displayName || App.currentUser.email || 'Me', [otherUid]: contact.name },
          participantEmails: { [uid]: email, [otherUid]: otherEmail },
          status: 'active'
        }, { merge: true }).catch(() => {});
      }
    }
    const existingGroupIds = new Set(App.groupChats.map(c => c.id));
    for (const [groupId, info] of Object.entries(groupMap)) {
      if (existingGroupIds.has(groupId)) continue;
      const groupObj = {
        id: groupId, type: 'group',
        name: info.name,
        avatar: 'gradient-3',
        initials: getInitials(info.name || 'Group'),
        photoURL: null,
        lastMsg: `${info.msgs} message${info.msgs > 1 ? 's' : ''}`,
        lastTime: info.lastTime || Date.now(),
        unread: 0, pinned: false, muted: false,
        memberCount: 0
      };
      App.groupChats.push(groupObj);
    }
    if (Object.keys(chatMap).length || Object.keys(groupMap).length) mergeAndRenderChats();
  } catch(e) { console.warn('loadMessageHistory:', e); }
}

function subscribeToChatRequests(email, uid) {
  if (!App.db || !email) return;
  if (App.chatRequestsUnsubscribe) App.chatRequestsUnsubscribe();
  let incomingFirstLoad = true;
  App.chatRequestsUnsubscribe = App.db.collection('chatRequests')
    .where('toEmail', '==', email)
    .onSnapshot(snapshot => {
      const incoming = [];
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        if (data.status === 'pending') {
          incoming.push({ id: change.doc.id, fromUid: data.from, fromEmail: data.fromEmail, fromName: data.fromName, timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : 0 });
          if (!incomingFirstLoad && change.type === 'added') {
            showToast(`New chat request from ${data.fromName || data.fromEmail}`, 'info');
          }
        }
      });
      App.chatRequests.incoming = incoming;
      App.pendingRequestsCount = incoming.length;
      updateRequestBadge();
      incomingFirstLoad = false;
      if (App.activeTab === 'requests') renderRequestsTab();
    }, e => console.warn('chatRequests incoming err:', e));
  let prevAcceptedIds = new Set();
  App.db.collection('chatRequests')
    .where('fromEmail', '==', email)
    .onSnapshot(snapshot => {
      const outgoing = [];
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        if (data.status === 'pending') {
          outgoing.push({ id: change.doc.id, toUid: data.to, toEmail: data.toEmail, toName: data.toName, timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : 0 });
        } else if (data.status === 'accepted' && change.type === 'modified' && !prevAcceptedIds.has(change.doc.id)) {
          showToast('Your chat request was accepted!', 'success');
          prevAcceptedIds.add(change.doc.id);
        }
      });
      App.chatRequests.outgoing = outgoing;
      if (App.activeTab === 'requests') renderRequestsTab();
    }, e => console.warn('chatRequests outgoing err:', e));
}

function updateRequestBadge() {
  const badge = document.getElementById('requests-badge');
  if (!badge) return;
  if (App.pendingRequestsCount > 0) {
    badge.textContent = App.pendingRequestsCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function subscribeToMessages(chatId) {
  if (!App.db || !App.auth?.currentUser) return;
  if (App.messagesUnsubscribe) {
    App.messagesUnsubscribe();
    App.messagesUnsubscribe = null;
  }
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) return;
  const queryField = chat.type === 'group' ? 'groupId' : 'directId';
  App.messagesUnsubscribe = App.db.collection('messages')
    .where(queryField, '==', chatId)
    .onSnapshot(async (snapshot) => {
      const msgs = [];
      const decryptPromises = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        let type = 'text';
        let url = '';
        let duration = '';
        let fileName = '';
        let fileSize = '';
        
        if (data.attachment) {
          const att = data.attachment;
          if (att.type === 'image') {
            type = 'image';
            url = att.url || '';
          } else if (att.type === 'video') {
            type = 'video';
            url = att.url || '';
          } else if (att.type === 'voice' || att.type === 'audio') {
            type = 'voice';
            url = att.url || '';
            duration = att.duration || '0:00';
          } else {
            type = 'doc';
            fileName = att.name || 'Document';
            fileSize = att.size || '';
          }
        }
        
        const msgObj = {
          id: doc.id,
          from: data.senderId === App.auth.currentUser.uid ? 'me' : data.senderId,
          text: data.text || '',
          time: data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.time || Date.now()),
          status: data.status || 'read',
          replyTo: data.replyTo ? { name: data.replyTo.senderName, text: data.replyTo.text } : null,
          reactions: data.reactions || [],
          type: type,
          url: url,
          duration: duration,
          fileName: fileName,
          fileSize: fileSize
        };
        
        if (data.encrypted && data.iv) {
          const peerUid = chat.type === 'personal' ? chat.uid : null;
          if (peerUid) {
            decryptPromises.push(
              decryptMessageText(data.text, data.iv, peerUid).then(decryptedText => {
                if (decryptedText !== null) {
                  msgObj.text = decryptedText;
                } else {
                  msgObj.text = "🔒 Encrypted message";
                }
              })
            );
          }
        }
        
        msgs.push(msgObj);
      });
      
      if (decryptPromises.length > 0) {
        await Promise.all(decryptPromises);
      }
      
      msgs.sort((a, b) => a.time - b.time);
      App.messages[chatId] = msgs;
      renderMessages(chatId);
      scrollToBottom(true);
    }, (error) => {
      console.warn("Messages subscription error:", error);
    });
}

function checkSession() {
  setLoadingStatus('Checking session…');
  if (App.auth) {
    App.auth.onAuthStateChanged(user => {
      if (user) {
        App.currentUser = user;
        setLoadingStatus('Loading chats…');
        loadUserProfile(user).then(() => {
          subscribeToUsers();
          subscribeToChats();
          subscribeToGroups();
          subscribeToCallLogs(App.currentUser.uid);
          if (App.currentUser.email) {
            loadMessageHistory(App.currentUser.email, App.currentUser.uid);
            subscribeToChatRequests(App.currentUser.email, App.currentUser.uid);
          }
          updatePresence('online');
          setupPushNotifications();
          loadChatFolders();
          setLoadingStatus('Ready');
          setTimeout(bootApp, 400);
        });
      } else {
        // Run demo mode if not authenticated
        console.log('No auth user, initializing demo mode');
        loadDemoData();
        bootApp();
      }
    });
  } else {
    loadDemoData();
    bootApp();
  }
}

function bootApp() {
  const savedTheme = localStorage.getItem('nsl-theme') || 'dark';
  applyTheme(savedTheme);
  
  const loading = document.getElementById('loading-screen');
  if (loading) loading.classList.add('hidden');
  const app = document.getElementById('app');
  if (app) app.classList.remove('hidden');
  
  updateProfileUI();
  renderChatList();
  showWelcome();
}

function setLoadingStatus(msg) {
  const el = document.getElementById('loading-status');
  if (el) el.textContent = msg;
}

/* ══════════════════════════════════════════════════
   4. DEMO / MOCK DATA
   ══════════════════════════════════════════════════ */
function loadDemoData() {
  App.currentUser = { uid: 'me', displayName: 'Nishad SL', email: 'nishad@example.com', initials: 'NS' };
  
  App.contacts = [
    { uid:'c1', name:'Halid',          avatar:'bg-primary-container text-primary', initials:'H', status:'online',  about:'Dev Lead 🚀' },
    { uid:'c2', name:'Aisha Rahman',   avatar:'gradient-2', initials:'AR', status:'away',    about:'Always coding ☕' },
    { uid:'c3', name:'Priya Nair',     avatar:'gradient-4', initials:'PN', status:'online',  about:'Product Designer ✨' },
    { uid:'c4', name:'Rohan Mehta',    avatar:'gradient-5', initials:'RM', status:'offline', about:'Available' },
  ];

  const now = Date.now();
  App.chats = [
    { id:'saved_me', type:'personal', uid:'me', name:'Myself Chat', avatar:'bg-primary/20 text-primary', initials:'M', lastMsg:'Draft: New project ideas for next sprint...', lastTime: now, unread:0, pinned:true, muted:false, status:'online' },
    { id:'ch1', type:'personal', uid:'c1', name:'Halid', avatar:'bg-primary-container text-primary', initials:'H', lastMsg:'Remember to check the quarterly reports.', lastTime: now - 3*60000,  unread:2,  pinned:true,  muted:false },
    { id:'ch2', type:'group',    name:'Dev Team 🚀', avatar:'bg-primary/20 text-primary', initials:'DT', lastMsg:'Priya: Updated Figma file links ✅', lastTime: now - 15*60000, unread:5,  pinned:false, muted:false, memberCount:4 },
    { id:'ch3', type:'personal', uid:'c2', name:'Aisha Rahman', avatar:'gradient-2', initials:'AR', lastMsg:'The deployment is passing now 🎉', lastTime: now - 1*3600000, unread:0,  pinned:false, muted:false },
    { id:'ch4', type:'personal', uid:'c3', name:'Priya Nair', avatar:'gradient-4', initials:'PN', lastMsg:'Awesome! Love the indigo layout.', lastTime: now - 2*3600000, unread:0,  pinned:false, muted:true  },
  ];

  App.messages['saved_me'] = [
    { id:'m0_1', from:'me', text:'Welcome to your private workspace notepad.', time: now - 30*60000, status:'read' },
    { id:'m0_2', from:'me', text:'**Drafting new project ideas for next sprint...** Need to prioritize the mobile responsiveness update.', time: now - 12*60000, status:'read' }
  ];

  App.messages['ch1'] = [
    { id:'m1', from:'c1', text:'Hey! How is the design system update looking?', time: now - 20*60000, status:'read' },
    { id:'m2', from:'me', text:'Sleek! Fully customized around the Midnight palette with Neon Pink highlights.', time: now - 18*60000, status:'read' },
    { id:'m3', from:'c1', text:'Awesome! Is the right sidebar info panel working too?', time: now - 15*60000, status:'read' },
    { id:'m4', from:'me', text:'Yes, detail panels adapt for groups and personal chats dynamically.', time: now - 12*60000, status:'read' },
    { id:'m5', from:'c1', text:'Perfect, let\'s review quarterly reports before our standup.', time: now - 8*60000, status:'read' }
  ];

  App.messages['ch2'] = [
    { id:'mg1', from:'c3', text:'Hey team! Shared links to the Figma workspace project brief.', time: now - 60*60000, status:'read' },
    { id:'mg2', from:'c1', text:'Thanks Priya! Let\'s discuss during the standup.', time: now - 45*60000, status:'read' },
    { id:'mg3', from:'me', text:'Standup is scheduled for 4pm today.', time: now - 30*60000, status:'read' },
    { id:'mg4', from:'c3', text:'Priya: Updated Figma file links ✅', time: now - 15*60000, status:'read' }
  ];
}

async function loadUserProfile(user) {
  try {
    if (App.db) {
      const doc = await App.db.collection('users').doc(user.uid).get();
      if (doc.exists) Object.assign(App.currentUser, doc.data());
    }
  } catch(e) { /* offline fallback */ }
}

function updateProfileUI() {
  const u = App.currentUser;
  if (!u) return;
  const name = u.displayName || u.email || 'User';
  const initials = getInitials(name);

  const sa = document.getElementById('sidebar-avatar');
  if (sa) sa.textContent = initials;

  const pa = document.getElementById('profile-avatar');
  if (pa) {
    if (u.photoURL) pa.innerHTML = `<img src="${u.photoURL}" alt="${name}" class="w-full h-full object-cover rounded-full">`;
    else pa.textContent = initials;
  }
  
  setEl('profile-name', name);
  setEl('profile-name-sidebar', name);
  setEl('profile-email', u.email || '');
  setEl('settings-name', name);
  setEl('settings-status', u.statusText || 'Available');
  setEl('settings-phone', u.phone || 'Not provided');
}

function validatePhone(phone) {
  const normalized = phone.trim().replace(/[\s().-]/g, "");
  return /^\+?[1-9]\d{6,14}$/.test(normalized);
}

function editPhone() {
  const currentPhone = App.currentUser?.phone || '';
  const newPhone = prompt("Enter your phone number:", currentPhone);
  if (newPhone === null) return;
  
  const cleanPhone = newPhone.trim();
  if (cleanPhone && !validatePhone(cleanPhone)) {
    showToast("Please enter a valid phone number.", "error");
    return;
  }
  
  if (App.db && App.auth?.currentUser) {
    App.db.collection('users').doc(App.auth.currentUser.uid).update({
      phone: cleanPhone
    }).then(() => {
      showToast("Phone number updated!", "success");
      App.currentUser.phone = cleanPhone;
      updateProfileUI();
    }).catch(err => {
      console.error(err);
      showToast("Failed to update phone number.", "error");
    });
  } else {
    // Demo mode fallback
    showToast("Phone number updated (Demo Mode)!", "success");
    App.currentUser.phone = cleanPhone;
    updateProfileUI();
  }
}

/* ══════════════════════════════════════════════════
   5. THEME SWITCHING
   ══════════════════════════════════════════════════ */
function applyTheme(mode) {
  App.theme = mode;
  const html = document.documentElement;
  let resolvedTheme = mode;
  if (mode === 'dark') {
    html.classList.add('dark');
    html.classList.remove('light');
    html.setAttribute('data-theme', 'dark');
  } else if (mode === 'light') {
    html.classList.add('light');
    html.classList.remove('dark');
    html.setAttribute('data-theme', 'light');
  } else {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    resolvedTheme = dark ? 'dark' : 'light';
    html.classList.toggle('dark', dark);
    html.classList.toggle('light', !dark);
    html.setAttribute('data-theme', resolvedTheme);
  }
  localStorage.setItem('tc_theme', mode);
  localStorage.setItem('nsl-theme', resolvedTheme);
  
  // Update header meta theme color
  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', resolvedTheme === 'dark' ? '#11131c' : '#fdfbff');

  _syncThemeIcons(resolvedTheme);
}

function _syncThemeIcons(resolvedTheme) {
  const icon = resolvedTheme === 'dark' ? 'dark_mode' : 'light_mode';
  ['theme-icon', 'theme-icon-sidebar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = icon;
  });
  const label = document.getElementById('theme-label');
  if (label) label.textContent = resolvedTheme === 'dark' ? 'Dark' : 'Light';
  
  const showThemeBtn = document.getElementById('showroom-theme-btn');
  if (showThemeBtn) showThemeBtn.textContent = resolvedTheme === 'dark' ? 'Dark' : 'Light';
}

function cycleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

/* ══════════════════════════════════════════════════
   6. TAB NAVIGATION
   ══════════════════════════════════════════════════ */
function switchTab(tab) {
  App.activeTab = tab;

  // Sidebar navigation items active classes revamp
  qsa('.tab-item').forEach(el => {
    const active = el.dataset.tab === tab;
    if (active) {
      el.className = "tab-item w-full flex items-center gap-4 bg-primary/10 text-primary border-l-4 border-primary px-4 py-3 cursor-pointer active:scale-95 transition-all duration-200";
    } else {
      el.className = "tab-item w-full flex items-center gap-4 text-on-surface/60 hover:text-on-surface hover:bg-surface-container-highest transition-colors duration-200 px-4 py-3 cursor-pointer active:scale-95";
    }
  });

  // Bottom nav tab items active classes revamp
  qsa('.bottom-nav-item').forEach(el => {
    const active = el.dataset.tab === tab;
    el.classList.toggle('text-primary', active);
    el.classList.toggle('text-on-surface/60', !active);
  });

  // Adapt lists
  renderChatList();
}

/* ══════════════════════════════════════════════════
   7. DESIGN SHOWROOM & PREVIEWS
   ══════════════════════════════════════════════════ */
function triggerShowroomVariant(type, viewport) {
  App.showroomOverride = { type, viewport };
  App.showroomViewport = viewport;
  
  // Set simulated viewport sizes on parent frame
  const appNode = document.getElementById('app');
  if (appNode) {
    appNode.classList.remove('viewport-mobile', 'viewport-tablet', 'viewport-laptop');
    if (viewport === 'mobile') appNode.classList.add('viewport-mobile');
    else if (viewport === 'tablet') appNode.classList.add('viewport-tablet');
    else if (viewport === 'laptop') appNode.classList.add('viewport-laptop');
  }

  // Update showroom indicators in lobby
  const viewportBtn = document.getElementById('showroom-viewport-btn');
  if (viewportBtn) viewportBtn.textContent = viewport.toUpperCase();

  // Force navigate/open chat corresponding to type
  if (type === 'myself') {
    openChat('saved_me');
  } else if (type === 'personal') {
    openChat('ch1');
  } else if (type === 'group') {
    openChat('ch2');
  }
  
  showToast(`Showroom: Forced ${type.toUpperCase()} layout (${viewport.toUpperCase()} viewport)`, 'success');
}

function resetShowroomViewport() {
  const views = ['auto', 'desktop', 'laptop', 'tablet', 'mobile'];
  let currentIdx = views.indexOf(App.showroomViewport);
  let nextIdx = (currentIdx + 1) % views.length;
  App.showroomViewport = views[nextIdx];
  
  const appNode = document.getElementById('app');
  if (appNode) {
    appNode.classList.remove('viewport-mobile', 'viewport-tablet', 'viewport-laptop');
    if (App.showroomViewport === 'mobile') appNode.classList.add('viewport-mobile');
    else if (App.showroomViewport === 'tablet') appNode.classList.add('viewport-tablet');
    else if (App.showroomViewport === 'laptop') appNode.classList.add('viewport-laptop');
  }
  
  const viewportBtn = document.getElementById('showroom-viewport-btn');
  if (viewportBtn) viewportBtn.textContent = App.showroomViewport.toUpperCase();
}

function resetShowroomVariant() {
  App.showroomOverride = null;
  App.showroomViewport = 'auto';
  
  const appNode = document.getElementById('app');
  if (appNode) {
    appNode.classList.remove('viewport-mobile', 'viewport-tablet', 'viewport-laptop');
  }
  
  const viewportBtn = document.getElementById('showroom-viewport-btn');
  if (viewportBtn) viewportBtn.textContent = 'AUTO';
  
  showWelcome();
  showToast('Showroom viewport override reset', 'info');
}

/* ══════════════════════════════════════════════════
   8. CHAT RENDER & LISTINGS
   ══════════════════════════════════════════════════ */
function renderChatList(filter = '') {
  const list = document.getElementById('chat-list');
  if (!list) return;

  const tab = App.activeTab;
  let items = App.chats.filter(c => {
    if (tab === 'chats')  return c.type === 'personal';
    if (tab === 'groups') return c.type === 'group';
    return true;
  });

  if (tab === 'calls')    { renderCallsTab(); return; }
  if (tab === 'more')     { renderMoreTab(); return; }
  if (tab === 'requests') { renderRequestsTab(); return; }

  if (filter) {
    const q = filter.toLowerCase();
    items = items.filter(c => c.name.toLowerCase().includes(q) || (c.lastMsg||'').toLowerCase().includes(q) || (c.about||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q));
  }

  // Filter by active folder
  if (App.activeFolderIndex >= 0 && App.chatFolders[App.activeFolderIndex]) {
    const folderChatIds = App.chatFolders[App.activeFolderIndex].chatIds || [];
    items = items.filter(c => folderChatIds.includes(c.id));
  }

  // Determine if Myself Workspace styling should override sidebar headers
  const isMyselfOverride = App.showroomOverride?.type === 'myself' || (App.currentChat && App.currentChat.id === 'saved_me');
  
  const sidebarTitle = document.getElementById('chats-sidebar-title');
  if (sidebarTitle) {
    if (isMyselfOverride) {
      sidebarTitle.textContent = __('savedItems');
    } else {
      if (tab === 'groups') sidebarTitle.textContent = 'Groups';
      else if (tab === 'calls') sidebarTitle.textContent = 'Calls';
      else if (tab === 'requests') sidebarTitle.textContent = 'Requests';
      else if (tab === 'more') sidebarTitle.textContent = 'Saved Items';
      else sidebarTitle.textContent = __('messages');
    }
  }
  
  const sidebarSearchInput = document.getElementById('sidebar-search');
  if (sidebarSearchInput) {
    sidebarSearchInput.placeholder = isMyselfOverride ? 'Search notes...' : __('search');
  }

  // Revamp navigation items in sidebar depending on Myself mode
  const sidebarNav = document.getElementById('sidebar-nav-container');
  const sidebarTitleEl = document.getElementById('sidebar-app-title');
  const sidebarSubtitleEl = document.getElementById('sidebar-app-subtitle');
  
  if (sidebarNav) {
    if (isMyselfOverride) {
      if (sidebarTitleEl) sidebarTitleEl.textContent = "My Space";
      if (sidebarSubtitleEl) sidebarSubtitleEl.textContent = "Private Notepad";
      
      sidebarNav.innerHTML = `
        <button class="tab-item w-full flex items-center gap-4 bg-primary/10 text-primary border-l-4 border-primary px-4 py-3 cursor-pointer active:scale-95" onclick="switchTab('chats')">
          <span class="material-symbols-outlined">description</span>
          <span class="hidden xl:block font-body-md text-body-md font-semibold">Notes</span>
        </button>
        <button class="tab-item w-full flex items-center gap-4 text-on-surface/60 hover:text-on-surface hover:bg-surface-container-highest px-4 py-3 cursor-pointer active:scale-95" onclick="showToast('Cloud Files Storage','info')">
          <span class="material-symbols-outlined">folder</span>
          <span class="hidden xl:block font-body-md text-body-md">Files</span>
        </button>
        <button class="tab-item w-full flex items-center gap-4 text-on-surface/60 hover:text-on-surface hover:bg-surface-container-highest px-4 py-3 cursor-pointer active:scale-95" onclick="showToast('Reminders & Alerts','info')">
          <span class="material-symbols-outlined">notifications</span>
          <span class="hidden xl:block font-body-md text-body-md">Reminders</span>
        </button>
        <button class="tab-item w-full flex items-center gap-4 text-on-surface/60 hover:text-on-surface hover:bg-surface-container-highest px-4 py-3 cursor-pointer active:scale-95" onclick="openProfile()">
          <span class="material-symbols-outlined">settings</span>
          <span class="hidden xl:block font-body-md text-body-md">Settings</span>
        </button>
      `;
    } else {
      if (sidebarTitleEl) sidebarTitleEl.textContent = "NSL Chat";
      if (sidebarSubtitleEl) sidebarSubtitleEl.textContent = "NSL Chat";
      
      const isChatsActive = tab === 'chats';
      const isGroupsActive = tab === 'groups';
      const isCallsActive = tab === 'calls';
      const isRequestsActive = tab === 'requests';
      const isMoreActive = tab === 'more';
      
      const activeClass = "tab-item w-full flex items-center gap-4 bg-primary/10 text-primary border-l-4 border-primary px-4 py-3 cursor-pointer active:scale-95 transition-all duration-200";
      const inactiveClass = "tab-item w-full flex items-center gap-4 text-on-surface/60 hover:text-on-surface hover:bg-surface-container-highest px-4 py-3 cursor-pointer active:scale-95 transition-all duration-200";

      sidebarNav.innerHTML = `
        <button class="${isChatsActive ? activeClass : inactiveClass}" onclick="switchTab('chats')">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' ${isChatsActive ? 1 : 0};">chat</span>
          <span class="hidden xl:block font-body-md text-body-md ${isChatsActive ? 'font-semibold' : ''}">Chats</span>
        </button>
        <button class="${isGroupsActive ? activeClass : inactiveClass}" onclick="switchTab('groups')">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' ${isGroupsActive ? 1 : 0};">group</span>
          <span class="hidden xl:block font-body-md text-body-md ${isGroupsActive ? 'font-semibold' : ''}">Groups</span>
        </button>
        <button class="${isCallsActive ? activeClass : inactiveClass}" onclick="switchTab('calls')">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' ${isCallsActive ? 1 : 0};">call</span>
          <span class="hidden xl:block font-body-md text-body-md ${isCallsActive ? 'font-semibold' : ''}">Calls</span>
        </button>
        <button class="${isRequestsActive ? activeClass : inactiveClass}" onclick="switchTab('requests')">
          <div class="relative">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' ${isRequestsActive ? 1 : 0};">handshake</span>
            <div class="absolute -top-1.5 -right-2 bg-secondary text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold hidden" id="requests-badge">0</div>
          </div>
          <span class="hidden xl:block font-body-md text-body-md ${isRequestsActive ? 'font-semibold' : ''}">Requests</span>
        </button>
        <button class="${isMoreActive ? activeClass : inactiveClass}" onclick="switchTab('more')">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' ${isMoreActive ? 1 : 0};">bookmark</span>
          <span class="hidden xl:block font-body-md text-body-md ${isMoreActive ? 'font-semibold' : ''}">Saved Items</span>
        </button>
      `;
    }
  }

  if (!items.length) {
    list.innerHTML = '';
    show('chats-empty');
    return;
  }
  hide('chats-empty');

  // Pinned items first
  items.sort((a,b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.lastTime - a.lastTime;
  });

  const pinned   = items.filter(c=>c.pinned);
  const unpinned = items.filter(c=>!c.pinned);

  let html = '';
  if (pinned.length) {
    html += `<div class="px-4 py-2 flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest bg-surface-container-low/20">
      <span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1;">push_pin</span> Pinned
    </div>`;
    html += pinned.map(chatItemHTML).join('');
  }
  if (unpinned.length) {
    html += `<div class="px-4 py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest bg-surface-container-low/20 mt-2">Recent</div>`;
    html += unpinned.map(chatItemHTML).join('');
  }

  list.innerHTML = html;

  // Update badges
  const totalUnread = App.chats.filter(c=>c.type==='personal').reduce((a,c)=>a+c.unread,0);
  const groupUnread = App.chats.filter(c=>c.type==='group').reduce((a,c)=>a+c.unread,0);
  updateBadge('chats-badge', totalUnread);
  updateBadge('groups-badge', groupUnread);
}

function chatItemHTML(chat) {
  const isActive  = App.currentChat && App.currentChat.id === chat.id;
  const timeStr   = formatChatTime(chat.lastTime);
  const unreadBadge = chat.unread > 0
    ? `<div class="bg-secondary text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-2 shadow">${chat.unread}</div>` : '';
  const pinIcon   = chat.pinned ? `<span class="material-symbols-outlined text-[13px] text-primary" style="font-variation-settings: 'FILL' 1;">push_pin</span>` : '';

  let name = chat.name;
  let avatar = chat.avatar;
  let initials = chat.initials || '?';
  let photoURL = chat.photoURL;
  let status = chat.status;

  if (chat.type === 'personal' && chat.id !== `saved_me`) {
    const contact = App.contacts.find(c => c.uid === chat.uid);
    if (contact) {
      name = contact.name;
      avatar = contact.avatar;
      initials = contact.initials;
      photoURL = contact.photoURL;
      status = contact.status;
    } else {
      name = chat.name || 'User';
      initials = chat.initials || '?';
      avatar = chat.avatar || 'bg-surface-container-highest text-on-surface-variant';
      photoURL = chat.photoURL || null;
      status = chat.status || 'offline';
    }
  }

  // Exact mockup selection class overrides
  const activeClass = isActive 
    ? 'bg-surface-variant/40 border-l-4 border-primary text-primary' 
    : 'hover:bg-surface-variant/30 text-on-surface';

  const statusDot = (chat.type === 'personal' && chat.id !== `saved_me` && status === 'online')
    ? `<div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-surface-container-low"></div>` : '';

  let avatarIconHtml = '';
  if (chat.id === 'saved_me') {
    // Notepad icon for Myself Chat
    avatarIconHtml = `<div class="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary"><span class="material-symbols-outlined text-2xl">person</span></div>`;
  } else if (photoURL) {
    avatarIconHtml = `<img src="${photoURL}" alt="${escHtml(name)}" class="w-12 h-12 rounded-xl object-cover">`;
  } else {
    avatarIconHtml = `<div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${avatar || 'bg-surface-container-highest text-on-surface-variant'}">${initials}</div>`;
  }

  return `
  <div class="relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${activeClass}"
       onclick="openChat('${chat.id}')"
       oncontextmenu="chatContextMenu(event,'${chat.id}')"
       role="listitem"
       tabindex="0"
       onkeydown="if(event.key==='Enter')openChat('${chat.id}')">
    <div class="relative flex-shrink-0">
      ${avatarIconHtml}
      ${statusDot}
    </div>
    <div class="flex-1 overflow-hidden">
      <div class="flex justify-between items-center mb-1">
        <span class="font-bold text-on-surface truncate ${isActive?'text-primary':''}">${escHtml(name)}</span>
        <span class="font-timestamp text-timestamp text-on-surface-variant">${timeStr}</span>
      </div>
      <div class="flex justify-between items-center">
        <p class="text-xs text-on-surface-variant truncate pr-2">${escHtml(chat.lastMsg || '')}</p>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          ${pinIcon}
          ${unreadBadge}
        </div>
      </div>
    </div>
  </div>`;
}

function renderCallsTab() {
  const list = document.getElementById('chat-list');
  const logs = App.callLogs || [];
  if (!logs.length) {
    list.innerHTML = `
      <div class="flex flex-col items-center py-12 text-center w-full">
        <div class="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4 border border-outline-variant/20 shadow-md">
          <span class="material-symbols-outlined text-secondary text-3xl">call</span>
        </div>
        <h4 class="font-bold mb-1">No call logs</h4>
        <p class="text-on-surface-variant text-xs max-w-xs">Start high-definition calls directly with any of your workspace team members.</p>
      </div>`;
    return;
  }
  const uid = App.auth?.currentUser?.uid;
  let html = '';
  logs.forEach(log => {
    const isIncoming = log.calleeId === uid;
    const otherId = isIncoming ? log.callerId : log.calleeId;
    const contact = App.contacts.find(c => c.uid === otherId) || App.chats.find(c => c.uid === otherId) || {};
    const name = contact.name || 'Unknown';
    const initials = contact.initials || '?';
    const icon = log.type === 'video' ? 'videocam' : 'call';
    const dirIcon = isIncoming ? 'call_received' : 'call_made';
    const statusClass = log.status === 'missed' ? 'text-red-500' : (log.status === 'ended' ? 'text-on-surface-variant' : 'text-green-500');
    const durationStr = log.duration ? `${Math.floor(log.duration/60)}:${(log.duration%60).toString().padStart(2,'0')} min` : '';
    const timeStr = log.timestamp ? formatChatTime(log.timestamp) : '';
    html += `
      <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container/40 cursor-pointer transition-all">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg bg-surface-container-highest text-on-surface-variant">${initials}</div>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-center">
            <span class="font-bold text-on-surface truncate">${escHtml(name)}</span>
            <span class="font-timestamp text-timestamp text-on-surface-variant">${timeStr}</span>
          </div>
          <div class="flex items-center gap-1 text-xs">
            <span class="material-symbols-outlined text-[14px] ${statusClass}">${dirIcon}</span>
            <span class="material-symbols-outlined text-[14px] ${statusClass}">${icon}</span>
            <span class="text-on-surface-variant">${log.status === 'missed' ? 'Missed' : (log.status === 'ended' ? durationStr : log.status)}</span>
          </div>
        </div>
      </div>`;
  });
  list.innerHTML = html;
}

function renderMoreTab() {
  const list = document.getElementById('chat-list');
  list.innerHTML = `
    <div class="p-4 space-y-1">
      ${moreRow('star','Starred Messages','showToast("Starred Messages","info")')}
      ${moreRow('bookmark','Bookmarks','showToast("Bookmarks","info")')}
      ${moreRow('schedule','Scheduled Messages','showToast("Scheduled Messages","info")')}
      ${moreRow('quick_reply','Quick Replies','showToast("Quick Replies","info")')}
      ${moreRow('folder','Folders','openFolderManager()')}
      ${moreRow('insights','Chat Insights','showToast("Insights","info")')}
      ${moreRow('photo_library','Media Album','showToast("Media Album","info")')}
    </div>`;
}

function moreRow(icon, label, action) {
  return `
  <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container transition-all cursor-pointer" onclick="${action}">
    <span class="material-symbols-rounded text-primary">${icon}</span>
    <span class="text-sm font-semibold text-on-surface flex-1">${label}</span>
    <span class="material-symbols-rounded text-on-surface-variant text-base">chevron_right</span>
  </div>`;
}

function renderRequestsTab() {
  const list = document.getElementById('chat-list');
  if (!list) return;
  const incoming = App.chatRequests.incoming || [];
  const outgoing = App.chatRequests.outgoing || [];
  if (!incoming.length && !outgoing.length) {
    list.innerHTML = `
      <div class="flex flex-col items-center py-12 text-center w-full">
        <div class="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4 border border-outline-variant/20 shadow-md">
          <span class="material-symbols-outlined text-secondary text-3xl">handshake</span>
        </div>
        <h4 class="font-bold mb-1">No pending requests</h4>
        <p class="text-on-surface-variant text-xs max-w-xs">Search by full email to find and connect with other registered users.</p>
      </div>`;
    return;
  }
  let html = '';
  if (incoming.length) {
    html += `<div class="px-4 py-2 text-[10px] font-bold text-secondary uppercase tracking-widest bg-surface-container-low/20 flex items-center gap-2">
      <span class="material-symbols-outlined text-[12px]">arrow_back</span> Incoming Requests
    </div>`;
    html += incoming.map(r => `
      <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container transition-all mx-2">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm bg-primary-container/20 text-primary">${escHtml((r.fromName||'?')[0].toUpperCase())}</div>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm text-on-surface truncate">${escHtml(r.fromName)}</div>
          <div class="text-xs text-on-surface-variant truncate">${escHtml(r.fromEmail)}</div>
        </div>
        <button class="accept-req-btn px-3 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all" data-req-id="${r.id}" onclick="acceptChatRequest(this.dataset.reqId)">Accept</button>
        <button class="px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all" onclick="declineChatRequest('${r.id}')">Decline</button>
      </div>
    `).join('');
  }
  if (outgoing.length) {
    html += `<div class="px-4 py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest bg-surface-container-low/20 mt-2 flex items-center gap-2">
      <span class="material-symbols-outlined text-[12px]">arrow_forward</span> Sent Requests
    </div>`;
    html += outgoing.map(r => `
      <div class="flex items-center gap-3 p-3 rounded-xl opacity-60 mx-2">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm bg-surface-container-highest text-on-surface-variant">${escHtml((r.toName||'?')[0].toUpperCase())}</div>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm text-on-surface truncate">${escHtml(r.toName)}</div>
          <div class="text-xs text-on-surface-variant truncate">${escHtml(r.toEmail)} — Awaiting response</div>
        </div>
        <span class="text-xs text-on-surface-variant italic">Pending</span>
      </div>
    `).join('');
  }
  list.innerHTML = html;
}

/* ══════════════════════════════════════════════════
   9. OPEN CHAT & STATE SYNC
   ══════════════════════════════════════════════════ */
function openChat(chatId) {
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) return;

  App.currentChat = chat;
  chat.unread = 0;

  // Render header title & icons
  const headerName = document.getElementById('header-name');
  if (headerName) headerName.textContent = chat.name;
  
  const headerStatus = document.getElementById('header-status');
  const statusDot = document.getElementById('header-status-dot');

  // Adapt Header actions based on chat type
  const actionContainer = document.getElementById('header-actions-container');
  
  if (chat.id === 'saved_me') {
    // Notepad Workspace specific header
    if (headerName) headerName.textContent = "Myself Chat";
    if (headerStatus) {
      headerStatus.textContent = "Personal Workspace";
      headerStatus.className = "text-[10px] text-secondary uppercase tracking-widest font-label-caps";
    }
    if (statusDot) {
      statusDot.style.display = '';
      statusDot.className = "absolute bottom-0 right-0 w-3 h-3 bg-secondary rounded-full border-2 border-background"; // pink online dot
    }
    // Notepad doesn't need call options in mockup
    if (actionContainer) {
      actionContainer.innerHTML = `
        <span class="material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-surface-variant/30 p-2 rounded-full transition-all" onclick="showToast('Pin note','info')">push_pin</span>
        <span class="material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-surface-variant/30 p-2 rounded-full transition-all" onclick="openChatSearch()">search</span>
        <span class="material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-surface-variant/30 p-2 rounded-full transition-all" onclick="openChatMenu(this)">more_vert</span>
      `;
    }
    // Update input area placeholder
    const msgInput = document.getElementById('msg-input');
    if (msgInput) msgInput.placeholder = "Type a note to yourself...";
  } else if (chat.type === 'group') {
    // Group Channel header
    if (headerStatus) {
      headerStatus.textContent = `${chat.memberCount || 3} members`;
      headerStatus.className = "text-[10px] text-on-surface-variant uppercase tracking-widest font-label-caps";
    }
    if (statusDot) statusDot.style.display = 'none';
    if (actionContainer) {
      actionContainer.innerHTML = `
        <button class="text-on-surface-variant hover:text-primary transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="startVoiceCall()"><span class="material-symbols-outlined">call</span></button>
        <button class="text-on-surface-variant hover:text-primary transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="startVideoCall()"><span class="material-symbols-outlined">videocam</span></button>
        <button class="text-on-surface-variant hover:text-on-surface transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="openChatSearch()"><span class="material-symbols-outlined">search</span></button>
        <button class="text-on-surface-variant hover:text-on-surface transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="openChatMenu(this)"><span class="material-symbols-outlined">more_vert</span></button>
      `;
    }
    const msgInput = document.getElementById('msg-input');
    if (msgInput) msgInput.placeholder = "Message in Dev Team...";
  } else {
    // Personal Chat header
    const contact = App.contacts.find(c=>c.uid===chat.uid) || App.chats.find(c=>c.uid===chat.uid);
    const statusText = contact?.status === 'online' ? 'Active Now' : contact?.about || 'Offline';
    if (headerStatus) {
      headerStatus.textContent = statusText;
      headerStatus.className = "text-[10px] text-primary-fixed-dim uppercase tracking-widest font-label-caps" + (contact?.status === 'online' ? ' text-secondary' : '');
    }
    if (statusDot) {
      if (contact?.status === 'online') {
        statusDot.style.display = '';
        statusDot.className = 'absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background';
      } else {
        statusDot.style.display = 'none';
      }
    }
    if (actionContainer) {
      actionContainer.innerHTML = `
        <button class="text-on-surface-variant hover:text-primary transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="startVoiceCall()"><span class="material-symbols-outlined">call</span></button>
        <button class="text-on-surface-variant hover:text-primary transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="startVideoCall()"><span class="material-symbols-outlined">videocam</span></button>
        <button class="text-on-surface-variant hover:text-on-surface transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="openChatSearch()"><span class="material-symbols-outlined">search</span></button>
        <button class="text-on-surface-variant hover:text-on-surface transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="openChatMenu(this)"><span class="material-symbols-outlined">more_vert</span></button>
      `;
    }
    const msgInput = document.getElementById('msg-input');
    if (msgInput) msgInput.placeholder = "Type your message...";
  }

  // Header avatar updates
  const ha = document.getElementById('header-avatar');
  if (ha) {
    if (chat.photoURL) {
      ha.innerHTML = `<img src="${chat.photoURL}" alt="${escHtml(chat.name)}" class="w-10 h-10 rounded-full object-cover">`;
    } else {
      ha.textContent = chat.initials;
      ha.className = `w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-surface-container-highest text-on-surface-variant`;
    }
  }

  // Resizing layouts for mobile view override
  if (window.innerWidth < 768 || App.showroomViewport === 'mobile') {
    const listSidebar = document.getElementById('chat-list-sidebar');
    if (listSidebar) listSidebar.classList.add('hidden');
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('hidden');
  }

  // Display canvas
  hide('welcome-screen');
  show('chat-header');
  const wrap = document.getElementById('messages-wrap');
  if (wrap) wrap.style.display = '';
  const inputBar = document.getElementById('input-bar');
  if (inputBar) inputBar.style.display = '';

  // Retrieve messages
  if (App.db && App.auth?.currentUser) {
    subscribeToMessages(chat.id);
  } else {
    renderMessages(chat.id);
    scrollToBottom(true);
  }

  // Redraw chat lists for updates
  renderChatList();

  // Populate Right Info Panel if viewport permits (>=1024px)
  const panel = document.getElementById('detail-panel');
  if (panel) {
    if (window.innerWidth >= 1024 && App.showroomViewport !== 'mobile' && App.showroomViewport !== 'tablet') {
      panel.classList.remove('hidden');
      panel.classList.add('flex');
      openChatInfo();
    } else {
      panel.classList.add('hidden');
      panel.classList.remove('flex');
    }
  }
}

/* ══════════════════════════════════════════════════
   10. MESSAGE RENDERING
   ══════════════════════════════════════════════════ */
function renderMessages(chatId) {
  const msgs = App.messages[chatId] || [];
  const wrap = document.getElementById('messages-wrap');
  if (!wrap) return;

  const isMyselfChat = App.currentChat && App.currentChat.id === 'saved_me';

  if (!msgs.length) {
    if (isMyselfChat) {
      wrap.innerHTML = `
        <div class="flex flex-col items-center py-12 text-center w-full">
          <div class="w-20 h-20 rounded-3xl bg-surface-container-high flex items-center justify-center mb-4 border border-outline-variant/20 shadow-2xl neon-border">
            <span class="material-symbols-outlined text-primary text-4xl" style="font-variation-settings: 'FILL' 1;">lock</span>
          </div>
          <h4 class="font-headline-md text-headline-md font-bold mb-2">This is your personal workspace.</h4>
          <p class="text-on-surface-variant text-sm max-w-sm">Messages sent here are private and encrypted. Perfect for drafting ideas, saving links, or keeping files handy.</p>
          <div class="mt-4 flex gap-2">
            <span class="px-3 py-1 bg-surface-variant rounded-full text-xs font-semibold text-on-surface-variant">Private</span>
            <span class="px-3 py-1 bg-surface-variant rounded-full text-xs font-semibold text-on-surface-variant">Cloud Sync</span>
          </div>
        </div>`;
    } else {
      wrap.innerHTML = `
        <div class="flex flex-col items-center py-12 text-center w-full">
          <div class="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4 border border-outline-variant/20">
            <span class="material-symbols-outlined text-primary text-3xl">chat</span>
          </div>
          <h4 class="font-bold mb-1">Start the conversation</h4>
          <p class="text-on-surface-variant text-sm">Say hello to get things started!</p>
        </div>`;
    }
    return;
  }

  let html = '';
  if (isMyselfChat) {
    html += `
      <div class="flex flex-col items-center py-8 text-center w-full">
        <div class="w-20 h-20 rounded-3xl bg-surface-container-high flex items-center justify-center mb-4 border border-outline-variant/20 shadow-2xl neon-border">
          <span class="material-symbols-outlined text-primary text-4xl" style="font-variation-settings: 'FILL' 1;">lock</span>
        </div>
        <h4 class="font-headline-md text-headline-md font-bold mb-2">Personal Workspace</h4>
        <p class="text-on-surface-variant text-xs max-w-xs">End-to-end encrypted notepad</p>
      </div>`;
  }

  let lastDate = null;

  msgs.forEach((msg, i) => {
    const msgDate = new Date(msg.time);
    const dateKey = msgDate.toDateString();
    if (dateKey !== lastDate) {
      html += `
        <div class="flex justify-center my-6">
          <span class="bg-surface-container-highest/50 px-4 py-1 rounded-full text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
            ${formatDateSep(msgDate)}
          </span>
        </div>`;
      lastDate = dateKey;
    }

    const isMe = msg.from === 'me';
    const contact = isMe ? null : (App.contacts.find(c=>c.uid===msg.from) || App.chats.find(c=>c.uid===msg.from));
    const showAvatar = !isMe && (i === msgs.length-1 || msgs[i+1]?.from !== msg.from);
    const showSender = !isMe && App.currentChat?.type==='group';
    const senderName = contact?.name || 'Unknown';

    const avatarHTML = showAvatar
      ? (contact?.photoURL
        ? `<img src="${contact.photoURL}" alt="${escHtml(senderName)}" class="w-10 h-10 rounded-full object-cover border border-outline-variant/10">`
        : `<div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-surface-container-highest text-on-surface-variant">${contact?.initials||'?'}</div>`)
      : `<div class="w-10"></div>`;

    const reactions = (msg.reactions||[]).map(r =>
      `<div class="flex items-center gap-1 bg-surface-container border border-outline-variant/30 px-2 py-0.5 rounded-lg text-xs cursor-pointer hover:bg-surface-variant transition-all ${r.mine?'border-primary/50 text-primary':''}" onclick="toggleReaction('${msg.id}','${r.emoji}')">
        <span>${r.emoji}</span><span class="font-bold text-[10px]">${r.count}</span>
      </div>`
    ).join('');

    const tickIcon = isMe
      ? msg.status==='read'      ? '<span class="material-symbols-outlined text-[14px] text-primary" style="font-variation-settings: \'FILL\' 1;">done_all</span>'
      : msg.status==='delivered' ? '<span class="material-symbols-outlined text-[14px] text-on-surface-variant" style="font-variation-settings: \'FILL\' 1;">done_all</span>'
      :                            '<span class="material-symbols-outlined text-[14px] text-on-surface-variant">done</span>'
      : '';

    const replyHTML = msg.replyTo ? `
      <div class="border-l-2 border-primary/50 pl-3 mb-2 opacity-80 text-xs">
        <div class="font-bold text-primary">${escHtml(msg.replyTo.name)}</div>
        <div class="truncate text-on-surface-variant">${escHtml(msg.replyTo.text)}</div>
      </div>` : '';

    let contentHTML = '';
    if (msg.type === 'image') {
      contentHTML = `<div class="bubble-media cursor-pointer relative rounded-xl overflow-hidden" onclick="openMediaViewer('${msg.id}')">
        <img src="${escHtml(msg.url)}" alt="Image" loading="lazy" class="max-w-xs max-h-48 object-cover rounded-xl border border-outline-variant/20">
        <div class="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all rounded-xl flex items-center justify-center opacity-0 hover:opacity-100">
          <span class="material-symbols-outlined text-white text-2xl drop-shadow">fullscreen</span>
        </div>
      </div>`;
    } else if (msg.type === 'video') {
      contentHTML = `<div class="bubble-media cursor-pointer relative rounded-xl overflow-hidden" onclick="openMediaViewer('${msg.id}')">
        <video src="${escHtml(msg.url)}" class="max-w-xs max-h-48 rounded-xl border border-outline-variant/20" preload="metadata" muted></video>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center text-white text-xl">▶</div>
        </div>
      </div>`;
    } else if (msg.type === 'voice') {
      contentHTML = `<div class="flex items-center gap-3 bg-surface-container-high/40 p-2.5 rounded-xl border border-outline-variant/20">
        <button class="voice-play w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center" data-msg-id="${msg.id}" onclick="playVoice('${msg.id}')" aria-label="Play voice message">▶</button>
        <div class="flex-1 flex items-end gap-0.5 h-6 overflow-hidden">${generateWaveform()}</div>
        <span class="text-[10px] font-timestamp text-on-surface-variant">${msg.duration||'0:00'}</span>
      </div>`;
    } else if (msg.type === 'doc') {
      contentHTML = `<div class="flex items-center gap-4 bg-surface-container-high p-4 rounded-xl border border-outline-variant/20 cursor-pointer" onclick="openMediaViewer('${msg.id}')">
        <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary"><span class="material-symbols-outlined">description</span></div>
        <div class="flex-1"><p class="text-xs font-bold truncate">${escHtml(msg.fileName||'Document')}</p><p class="text-[10px] text-on-surface-variant">${msg.fileSize||''}</p></div>
        <span class="material-symbols-rounded" style="font-size:20px;opacity:.7">download</span>
      </div>`;
    } else {
      contentHTML = `<div class="text-sm font-normal leading-relaxed text-on-surface">${formatMsgText(msg.text||'')}</div>`;
    }

    // Status badges: forwarded, starred, edited
    const fwdBadge  = msg.forwarded ? `<span class="text-[9px] text-on-surface-variant italic opacity-70 mb-1">↪ Forwarded</span>` : '';
    const starBadge = msg.starred   ? `<span class="text-[10px]">⭐</span>` : '';
    const editBadge = msg.edited    ? `<span class="text-[9px] text-on-surface-variant italic opacity-60">(edited)</span>` : '';

    // Alignment and bubbled classes mapping mockups
    const bubbleClass = isMe
      ? 'bg-primary text-on-primary rounded-2xl rounded-tr-none shadow-md'
      : 'bg-surface-container-highest rounded-2xl rounded-tl-none border border-outline-variant/15';

    html += `
    <div class="flex items-end gap-3 ${isMe?'justify-end ml-auto':'justify-start'} w-full max-w-[85%] mb-4" id="msg-${msg.id}">
      ${!isMe ? avatarHTML : ''}
      <div class="flex flex-col ${isMe?'items-end':'items-start'} max-w-full">
        ${showSender&&!isMe ? `<div class="text-[10px] text-on-surface-variant font-bold mb-1 ml-2">${escHtml(senderName)}</div>` : ''}
        ${fwdBadge ? `<div class="${isMe?'text-right':'text-left'}">${fwdBadge}</div>` : ''}
        <div class="flex items-center gap-2 group relative max-w-full">
          ${isMe ? `<button class="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant transition-opacity cursor-pointer flex items-center justify-center flex-shrink-0" onclick="showMsgContextMenu(event,'${msg.id}')" title="Options"><span class="material-symbols-outlined text-lg">more_vert</span></button>` : ''}
          <div class="p-bubble_padding_xy ${bubbleClass} relative"
               oncontextmenu="showMsgContextMenu(event,'${msg.id}')"
               ondblclick="showQuickReactions(event,'${msg.id}')">
            ${replyHTML}
            ${contentHTML}
            <div class="flex items-center justify-end gap-1 mt-1.5 select-none opacity-80">
              ${editBadge}
              <span class="text-[9px] font-timestamp ${isMe?'text-white/80':'text-on-surface-variant'}">${formatMsgTime(msg.time)}</span>
              ${starBadge}
              ${tickIcon}
            </div>
          </div>
          ${!isMe ? `<button class="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant transition-opacity cursor-pointer flex items-center justify-center flex-shrink-0" onclick="showMsgContextMenu(event,'${msg.id}')" title="Options"><span class="material-symbols-outlined text-lg">more_vert</span></button>` : ''}
        </div>
        ${reactions ? `<div class="flex flex-wrap gap-1 mt-1">${reactions}</div>` : ''}
      </div>
    </div>`;
  });

  wrap.innerHTML = html;
}

function generateWaveform() {
  return Array.from({length:20}, (_,i) => {
    const h = [30,50,70,45,85,60,40,75,55,90,35,65,80,50,70,40,60,85,45,55][i] || 50;
    return `<div class="w-0.5 bg-outline-variant rounded-full" style="height:${h}%"></div>`;
  }).join('');
}

function formatMsgText(text) {
  return escHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    .replace(/`(.*?)`/g, '<code class="bg-surface-container px-1 py-0.5 rounded font-mono text-xs">$1</code>')
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" class="underline text-primary hover:text-secondary">$1</a>')
    .replace(/\n/g, '<br>');
}

/* ══════════════════════════════════════════════════
   11. SEND MESSAGES
   ══════════════════════════════════════════════════ */
function sendMessage() {
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if (!text || !App.currentChat) return;

  const msg = {
    id:     'msg_' + Date.now(),
    from:   'me',
    text:   text,
    time:   Date.now(),
    status: 'sending',
    replyTo: App.replyTo ? { name: App.replyTo.name, text: App.replyTo.text } : null,
  };

  if (!App.messages[App.currentChat.id]) App.messages[App.currentChat.id] = [];
  App.messages[App.currentChat.id].push(msg);

  App.currentChat.lastMsg  = text;
  App.currentChat.lastTime = msg.time;

  input.value = '';
  input.style.height = 'auto';
  toggleSendMic();
  cancelReply();

  renderMessages(App.currentChat.id);
  scrollToBottom(true);
  renderChatList();

  if (!App.db || !App.auth?.currentUser) {
    setTimeout(() => { msg.status = 'delivered'; renderMessages(App.currentChat.id); }, 800);
    setTimeout(() => {
      msg.status = 'read';
      renderMessages(App.currentChat.id);
      simulateReply(msg.text);
    }, 2000);
  } else {
    const uid = App.auth.currentUser.uid;
    const chatId = App.currentChat.id;
    const otherUserId = App.currentChat.uid;
    const isGroup = App.currentChat.type === 'group';
    
    (async () => {
      const messageData = {
        senderId: uid,
        senderName: App.currentUser.displayName || App.currentUser.email || 'Me',
        senderEmail: App.currentUser.email || '',
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
        read: false
      };
      
      let isEncrypted = false;
      let ivStr = '';
      let encryptedText = text;
      
      if (!isGroup && otherUserId && otherUserId !== uid) {
        const encrypted = await encryptMessageText(text, otherUserId);
        if (encrypted) {
          encryptedText = encrypted.ciphertext;
          ivStr = encrypted.iv;
          isEncrypted = true;
        }
      }
      
      if (isEncrypted) {
        messageData.text = encryptedText;
        messageData.encrypted = true;
        messageData.iv = ivStr;
      }
      
      if (isGroup) {
        messageData.groupId = chatId;
      } else {
        messageData.directId = chatId;
        messageData.participants = [uid, otherUserId];
        messageData.participantEmails = [
          App.currentUser.email || '',
          App.currentChat.about || App.currentChat.email || ''
        ];
      }
      
      App.db.collection('messages').add(messageData).catch(console.error);
      
      if (isGroup) {
        App.db.collection('groups').doc(chatId).update({
          lastMessage: text,
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          lastMessageSenderId: uid,
          lastMessageSenderName: App.currentUser.displayName || App.currentUser.email || 'Me'
        }).catch(console.error);
      } else {
        App.db.collection('directChats').doc(chatId).set({
          participants: [uid, otherUserId],
          participantNames: {
            [uid]: App.currentUser.displayName || App.currentUser.email || 'Me',
            [otherUserId]: App.currentChat.name || 'User'
          },
          participantEmails: {
            [uid]: App.currentUser.email || '',
            [otherUserId]: App.currentChat.about || ''
          },
          lastMessage: encryptedText,
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          lastMessageSenderId: uid,
          lastMessageStatus: 'sent',
          lastMessageEncrypted: isEncrypted,
          lastMessageIv: ivStr,
          status: 'active'
        }, { merge: true }).catch(console.error);
      }
    })();
  }
}

function simulateReply(userText) {
  if (!App.currentChat || App.currentChat.type !== 'personal' || App.currentChat.id === 'saved_me') return;
  
  showTyping();
  setTimeout(() => {
    hideTyping();
    const replies = [
      'Got it! Thanks for the update 👍',
      'Interesting! Let me check the specifications.',
      'Sure, I will look into that quarterly brief.',
      'Sounds great! 🎉 We are launching the redesign this week.',
      'Perfect, thank you! ✅ Let me know if you need anything else.'
    ];
    const reply = {
      id:   'msg_' + Date.now(),
      from: App.currentChat.uid,
      text: replies[Math.floor(Math.random() * replies.length)],
      time: Date.now(),
      status: 'delivered',
    };
    App.messages[App.currentChat.id].push(reply);
    App.currentChat.lastMsg  = reply.text;
    App.currentChat.lastTime = reply.time;
    renderMessages(App.currentChat.id);
    renderChatList();
    scrollToBottom(true);
  }, 1500 + Math.random()*1000);
}

function showTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.classList.remove('hidden');
  scrollToBottom(true);
}
function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.classList.add('hidden');
}

/* ══════════════════════════════════════════════════
   12. INPUT ACTIONS
   ══════════════════════════════════════════════════ */
function onInputChange() {
  const input = document.getElementById('msg-input');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  toggleSendMic();
}

function toggleSendMic() {
  const input  = document.getElementById('msg-input');
  const hasText = input && input.value.trim().length > 0;
  const sendBtn = document.getElementById('send-btn');
  const micBtn  = document.getElementById('mic-btn');
  if (sendBtn) sendBtn.classList.toggle('hidden', !hasText);
  if (micBtn)  micBtn.classList.toggle('hidden', hasText);
}

function onInputKeyDown(e) {
  const isMobile = window.innerWidth < 768 || App.showroomViewport === 'mobile';
  if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
    e.preventDefault();
    sendMessage();
  }
}

function setupAutoResize() {}

/* ══════════════════════════════════════════════════
   13. REPLIES
   ══════════════════════════════════════════════════ */
function replyToMsg(msgId) {
  const msgs = App.messages[App.currentChat?.id] || [];
  const msg  = msgs.find(m => m.id === msgId);
  if (!msg) return;

  const contact = App.contacts.find(c => c.uid === msg.from);
  App.replyTo = { id: msgId, name: msg.from==='me' ? 'You' : (contact?.name||'Unknown'), text: msg.text || '' };

  setEl('reply-name', App.replyTo.name);
  setEl('reply-text', App.replyTo.text);
  show('reply-preview');
  document.getElementById('msg-input')?.focus();
}

function cancelReply() {
  App.replyTo = null;
  hide('reply-preview');
}

/* ══════════════════════════════════════════════════
   14. AUDIO RECORDER
   ══════════════════════════════════════════════════ */
function toggleRecording() {
  if (App.isRecording) stopRecording(); else startRecording();
}
// startRecording, stopRecording, cancelRecording, sendVoiceMessage
// are defined in app-extras.js with full MediaRecorder support

/* ══════════════════════════════════════════════════
   15. CALL SCREENS
   ══════════════════════════════════════════════════ */
function startVoiceCall() { if(!App.currentChat)return; beginCall('voice'); }
function startVideoCall()  { if(!App.currentChat)return; beginCall('video'); }

function beginCall(type) {
  App.callActive=true; App.callMuted=false; App.cameraOff=(type==='voice');
  const chat = App.currentChat;
  setEl('call-name', chat.name);
  setEl('call-status', 'Calling…');
  hide('call-timer');

  const av = document.getElementById('call-avatar');
  if (av) {
    av.className=`w-32 h-32 rounded-full border-4 border-primary/30 flex items-center justify-center text-5xl bg-white/10 animate-pulse`;
    av.textContent=chat.initials;
  }

  const camIcon = document.getElementById('cam-icon');
  if (camIcon) camIcon.textContent = type==='video' ? 'videocam' : 'videocam_off';

  show('call-screen');

  setTimeout(() => {
    setEl('call-status','Active Connection');
    show('call-timer');
    App.callStartTime = Date.now();
    App.callTimerInterval = setInterval(() => {
      const s = Math.floor((Date.now()-App.callStartTime)/1000);
      setEl('call-timer', formatDuration(s));
    }, 1000);
  }, 2500);
}

function endCall() {
  App.callActive=false;
  clearInterval(App.callTimerInterval);
  hide('call-screen');
  showToast('Call session ended','info');
  if (App.db && App.auth?.currentUser && App.currentChat) {
    const duration = App.callStartTime ? Math.floor((Date.now()-App.callStartTime)/1000) : 0;
    const uid = App.auth.currentUser.uid;
    const otherUid = App.currentChat.uid;
    App.db.collection('callLogs').add({
      callerId: uid,
      calleeId: otherUid || uid,
      type: App.cameraOff ? 'voice' : 'video',
      duration,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'ended',
      participants: otherUid && otherUid !== uid ? [uid, otherUid] : [uid]
    }).catch(e => console.warn('callLog add err:', e));
  }
}

function toggleMute() {
  // This is the CALL mute — toggleChatMute() handles per-chat muting
  App.callMuted = !App.callMuted;
  const btn  = document.getElementById('btn-mute');
  const icon = document.getElementById('mute-icon');
  if (btn) btn.classList.toggle('bg-red-500', App.callMuted);
  if (icon) icon.textContent = App.callMuted ? 'mic_off' : 'mic';
}
function toggleCamera() {
  App.cameraOff = !App.cameraOff;
  const icon = document.getElementById('cam-icon');
  if (icon) icon.textContent = App.cameraOff ? 'videocam_off' : 'videocam';
}
function minimizeCall() { hide('call-screen'); showToast('Call active — click status to return','info'); }
function acceptCall()  { closeModal('incoming-call-overlay'); beginCall('voice'); }
function declineCall() { closeModal('incoming-call-overlay'); showToast('Call request declined','info'); }

/* ══════════════════════════════════════════════════
   16. SEARCH SYSTEM
   ══════════════════════════════════════════════════ */
// openChatSearch is fully implemented in app-extras.js
// This stub is kept as a no-op fallback
// openChatSearch is defined in app-extras.js with full in-chat search UI
function filterChats(q) { renderChatList(q); }

/* ══════════════════════════════════════════════════
   17. SCROLLS
   ══════════════════════════════════════════════════ */
function scrollToBottom(instant=false) {
  const wrap = document.getElementById('messages-wrap');
  if (!wrap) return;
  requestAnimationFrame(() => {
    wrap.scrollTo({ top: wrap.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
  });
  hide('scroll-to-bottom');
  App.unreadScrollCount = 0;
}

document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('messages-wrap');
  if (!wrap) return;
  wrap.addEventListener('scroll', () => {
    const atBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 100;
    const btn = document.getElementById('scroll-to-bottom');
    if (btn) btn.classList.toggle('hidden', atBottom);
  });
});

/* ══════════════════════════════════════════════════
   18. BACK TO CHAT LIST
   ══════════════════════════════════════════════════ */
function backToList() {
  const listSidebar = document.getElementById('chat-list-sidebar');
  if (listSidebar) listSidebar.classList.remove('hidden');
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('hidden');
  
  showWelcome();
}
function showWelcome() {
  show('welcome-screen');
  hide('chat-header');
  closeDetailPanel();
  const wrap = document.getElementById('messages-wrap');
  if (wrap) wrap.style.display = 'none';
  const inputBar = document.getElementById('input-bar');
  if (inputBar) inputBar.style.display = 'none';
  
  App.currentChat = null;
  renderChatList();
}

/* ══════════════════════════════════════════════════
   19. INFO DETAIL PANELS
   ══════════════════════════════════════════════════ */
function openChatInfo() {
  if (!App.currentChat) return;
  if (App.currentChat.id === 'saved_me') {
    openMyselfInfo();
  } else if (App.currentChat.type==='group') {
    openGroupInfoPanel();
  } else {
    openContactInfoPanel(App.currentChat.uid);
  }
}

function openContactInfoPanel(uid) {
  const contact = App.contacts.find(c=>c.uid===uid) || App.chats.find(c=>c.uid===uid) || {};
  const panel = document.getElementById('detail-panel');
  if (!panel) return;
  
  // Design details matched exactly with Column 4 personal mockup
  panel.innerHTML = `
    <div class="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container">
      <h3 class="font-bold text-on-surface">User Details</h3>
      <button onclick="closeDetailPanel()" class="text-on-surface-variant hover:text-on-surface"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="p-6 flex flex-col items-center text-center space-y-4">
      <div class="w-24 h-24 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-3xl border border-outline-variant/20">${contact.initials || '?'}</div>
      <div>
        <h4 class="font-bold text-lg text-on-surface">${escHtml(contact.name || 'Unknown')}</h4>
        <p class="text-xs text-on-surface-variant">${escHtml(contact.about || 'Available')}</p>
      </div>
      <span class="px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-full text-xs font-semibold text-secondary flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse"></span>
        ${contact.status === 'online' ? 'Online' : 'Offline'}
      </span>
    </div>
    
    <div class="px-6 py-4 border-t border-outline-variant/10 space-y-4">
      <div class="space-y-1">
        <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Mobile Number</span>
        <p class="text-sm font-semibold text-on-surface">${escHtml(contact.phone || 'Not provided')}</p>
      </div>
      <div class="space-y-1">
        <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Email Address</span>
        <p class="text-sm font-semibold text-on-surface">${escHtml(contact.email || 'Not provided')}</p>
      </div>
    </div>

    <div class="px-6 py-4 border-t border-outline-variant/10 space-y-3">
      <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Privacy & Actions</span>
      <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/40 transition-colors text-xs font-semibold text-on-surface" onclick="toggleMute(App.currentChat?.id)">
        <span class="material-symbols-outlined text-primary text-base">notifications_off</span>
        <span>Mute Notifications</span>
      </button>
      <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-colors text-xs font-semibold text-red-500" onclick="blockContact('${uid}')">
        <span class="material-symbols-outlined text-base">block</span>
        <span>Block User</span>
      </button>
    </div>
  `;
  panel.classList.remove('hidden');
  panel.classList.add('flex');
}

function openGroupInfoPanel() {
  const chat = App.currentChat;
  if (!chat) return;
  const panel = document.getElementById('detail-panel');
  if (!panel) return;

  // Design details matched exactly with Column 4 group chat mockup
  panel.innerHTML = `
    <div class="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container">
      <h3 class="font-bold text-on-surface">Channel Details</h3>
      <button onclick="closeDetailPanel()" class="text-on-surface-variant hover:text-on-surface"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="p-6 flex flex-col items-center text-center space-y-4">
      <div class="w-20 h-20 rounded-2xl bg-primary-container/20 flex items-center justify-center font-bold text-2xl text-primary border border-outline-variant/20 shadow">${chat.initials}</div>
      <div>
        <h4 class="font-bold text-lg text-on-surface">${escHtml(chat.name)}</h4>
        <p class="text-xs text-on-surface-variant">Group channel room</p>
      </div>
      <span class="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-semibold text-primary">
        ${chat.memberCount || 3} Members
      </span>
    </div>

    <div class="px-6 py-4 border-t border-outline-variant/10 space-y-3">
      <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Participants</span>
      <div class="space-y-2">
        <div class="flex items-center justify-between p-2 hover:bg-surface-container rounded-lg">
          <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-xs">H</div><span class="text-xs font-semibold">Halid</span></div>
          <span class="text-[9px] font-bold uppercase tracking-wider bg-secondary/25 text-secondary px-2 py-0.5 rounded">Owner</span>
        </div>
        <div class="flex items-center justify-between p-2 hover:bg-surface-container rounded-lg">
          <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-xs">AR</div><span class="text-xs font-semibold">Aisha Rahman</span></div>
          <span class="text-[9px] font-bold uppercase tracking-wider bg-primary/25 text-primary px-2 py-0.5 rounded">Admin</span>
        </div>
        <div class="flex items-center justify-between p-2 hover:bg-surface-container rounded-lg">
          <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-xs">PN</div><span class="text-xs font-semibold">Priya Nair</span></div>
          <span class="text-[9px] font-bold uppercase tracking-wider bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded">Member</span>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t border-outline-variant/10 space-y-3">
      <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Channel Management</span>
      <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/40 transition-colors text-xs font-semibold text-on-surface" onclick="copyInviteLink()">
        <span class="material-symbols-outlined text-primary text-base">link</span>
        <span>Copy Invite Link</span>
      </button>
      <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-colors text-xs font-semibold text-red-500" onclick="confirmLeaveGroup()">
        <span class="material-symbols-outlined text-base">exit_to_app</span>
        <span>Leave Channel</span>
      </button>
    </div>
  `;
  panel.classList.remove('hidden');
  panel.classList.add('flex');
}

function openMyselfInfo() {
  const panel = document.getElementById('detail-panel');
  if (!panel) return;
  
  panel.innerHTML = `
    <div class="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container">
      <h3 class="font-bold text-on-surface">Notepad Settings</h3>
      <button onclick="closeDetailPanel()" class="text-on-surface-variant hover:text-on-surface"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="p-6 flex flex-col items-center text-center space-y-4">
      <div class="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center font-bold text-2xl text-primary border border-outline-variant/20 shadow"><span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' 1;">lock</span></div>
      <div>
        <h4 class="font-bold text-lg text-on-surface">Cloud Notepad</h4>
        <p class="text-xs text-on-surface-variant">Private end-to-end encrypted notes</p>
      </div>
    </div>

    <div class="px-6 py-4 border-t border-outline-variant/10 space-y-4">
      <div class="space-y-1">
        <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Features Available</span>
        <div class="space-y-2 pt-1">
          <div class="flex items-center gap-2 text-xs font-semibold text-on-surface-variant"><span class="text-primary">✔</span> Personal Quick Notes</div>
          <div class="flex items-center gap-2 text-xs font-semibold text-on-surface-variant"><span class="text-primary">✔</span> Attachment Cloud Storage</div>
          <div class="flex items-center gap-2 text-xs font-semibold text-on-surface-variant"><span class="text-primary">✔</span> Starred & Bookmarked Notes</div>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t border-outline-variant/10 space-y-3">
      <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/40 transition-colors text-xs font-semibold text-on-surface" onclick="confirmClearChat('saved_me')">
        <span class="material-symbols-outlined text-primary text-base">delete_sweep</span>
        <span>Clear Notepad History</span>
      </button>
    </div>
  `;
  panel.classList.remove('hidden');
  panel.classList.add('flex');
}

function closeDetailPanel() {
  const panel = document.getElementById('detail-panel');
  if (panel) {
    panel.classList.add('hidden');
    panel.classList.remove('flex');
  }
}

/* ══════════════════════════════════════════════════
   20. DIRECT CHAT GENERATIONS
   ══════════════════════════════════════════════════ */
function openNewChat() {
  show('new-chat-overlay');
  renderContactList();
}

function renderContactList() {
  const list = document.getElementById('contact-list');
  if (!list) return;
  
  list.innerHTML = `
    <div class="px-4 py-2 text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
      <span class="material-symbols-outlined text-[12px]">person_search</span> Find by Email
    </div>
    <div class="px-4 pb-3">
      <div class="relative">
        <input class="w-full bg-surface-container border-none rounded-xl py-2.5 pl-10 pr-3 text-on-surface text-sm focus:ring-1 focus:ring-primary" placeholder="Type complete email to search…" id="email-search-input" type="email" onkeydown="if(event.key==='Enter')searchUserByEmailInput()"/>
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
      </div>
      <div id="email-search-result" class="mt-2"></div>
    </div>
    <div class="px-4 py-2 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Workspace Directory</div>
    <div class="space-y-1">
      ${App.contacts.map(c => {
        const initials = c.initials || '?';
        
        return `
        <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container transition-all cursor-pointer group" onclick="startChatWith('${c.uid}')">
          <div class="relative flex-shrink-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm bg-surface-container-highest text-on-surface-variant">${initials}</div>
            ${c.status === 'online' ? '<div class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-surface-container-lowest"></div>' : ''}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm text-on-surface truncate group-hover:text-primary transition-colors">${escHtml(c.name)}</div>
            <div class="text-xs text-on-surface-variant truncate">${escHtml(c.about || c.status)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function searchUserByEmailInput() {
  const input = document.getElementById('email-search-input');
  const resultDiv = document.getElementById('email-search-result');
  if (!input || !resultDiv) return;
  const email = input.value.trim().toLowerCase();
  if (!email || !email.includes('@') || !email.includes('.')) {
    resultDiv.innerHTML = `<p class="text-xs text-on-surface-variant mt-1">Enter a complete email address</p>`;
    return;
  }
  resultDiv.innerHTML = `<p class="text-xs text-on-surface-variant mt-1">Searching...</p>`;
  searchUserByEmail(email).then(user => {
    if (!user) {
      resultDiv.innerHTML = `<p class="text-xs text-error mt-1">No registered user found with this email</p>`;
      return;
    }
    const existingChat = App.chats.find(c => c.uid === user.uid);
    resultDiv.innerHTML = `
      <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-container-high mt-1">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${user.avatar}">${escHtml(user.initials)}</div>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm text-on-surface truncate">${escHtml(user.name)}</div>
          <div class="text-xs text-on-surface-variant truncate">${escHtml(user.email)}</div>
        </div>
        ${existingChat
          ? `<span class="text-xs text-on-surface-variant">In chats</span>`
          : `<button class="send-req-btn px-3 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all" data-req-uid="${user.uid}" data-req-email="${escHtml(user.email)}" data-req-name="${escHtml(user.name)}" onclick="sendChatRequestBtn(this)">Send Request</button>`
        }
      </div>`;
  });
}

function startChatWith(uid) {
  const contact = App.contacts.find(c=>c.uid===uid) || (uid === App.currentUser?.uid ? { name: 'Myself Chat', avatar: 'bg-primary/20 text-primary', initials: 'M', photoURL: null } : null);
  if (!contact) return;
  closeModal('new-chat-overlay');
  
  const isOnline = App.db && App.auth?.currentUser;
  const chatId = isOnline 
    ? (uid === App.auth.currentUser.uid ? `saved_${uid}` : getDirectChatId(App.auth.currentUser.uid, uid)) 
    : (uid === 'me' ? 'saved_me' : `ch_${uid}`);
    
  let chat = App.chats.find(c=>c.id===chatId);
  if (!chat) {
    chat = {
      id: chatId, type:'personal', uid,
      name:contact.name, avatar:contact.avatar, initials:contact.initials,
      photoURL:contact.photoURL || null,
      lastMsg:'', lastTime:Date.now(), unread:0, pinned:false, muted:false,
    };
    App.chats.unshift(chat);
    App.messages[chat.id] = [];
    
    if (isOnline) {
      const myUid = App.auth.currentUser.uid;
      App.db.collection('directChats').doc(chatId).set({
        participants: uid === myUid ? [myUid] : [myUid, uid],
        participantNames: {
          [myUid]: App.currentUser.displayName || App.currentUser.email || 'Me',
          [uid]: contact.name || 'User'
        },
        participantEmails: {
          [myUid]: App.currentUser.email || '',
          [uid]: contact.about || ''
        },
        status: 'active'
      }, { merge: true }).catch(console.error);
    }
  }
  openChat(chat.id);
}

// openNewGroup is defined in app-extras.js with full group creation UI

/* ══════════════════════════════════════════════════
   21. CHAT LIST CONTEXT MENUS & PIN/MUTE
   ══════════════════════════════════════════════════ */
function togglePin(chatId) {
  const chat = App.chats.find(c=>c.id===chatId);
  if (chat) {
    chat.pinned = !chat.pinned;
    renderChatList();
    showToast(chat.pinned ? 'Conversation pinned' : 'Conversation unpinned', 'success');
  }
}
function confirmClearChat(chatId) {
  showConfirm('Clear conversation message history? This cannot be undone.', () => {
    if (chatId) App.messages[chatId] = [];
    if (App.currentChat?.id === chatId) renderMessages(chatId);
    showToast('Chat history cleared', 'info');
  });
}
function confirmLeaveGroup() {
  showConfirm('Leave this group channel room?', () => {
    App.chats = App.chats.filter(c => c.id !== App.currentChat?.id);
    showWelcome();
    showToast('Left the channel', 'info');
  });
}
function blockContact(uid) {
  showConfirm('Block this user? They will not be able to direct message you.', () => {
    showToast('User has been blocked', 'success');
  });
}
function copyInviteLink() {
  navigator.clipboard.writeText('https://neonchat.app/join/' + Math.random().toString(36).slice(2));
  showToast('Channel link copied to clipboard', 'success');
}

/* ══════════════════════════════════════════════════
   22. INTERFACE UTILITIES
   ══════════════════════════════════════════════════ */
function formatText(type) {
  const input = document.getElementById('msg-input');
  if (!input) return;
  const start = input.selectionStart, end = input.selectionEnd;
  const sel   = input.value.slice(start,end);
  const map   = { bold:`**${sel}**`, italic:`*${sel}*`, strike:`~~${sel}~~`, code:`\`${sel}\`` };
  const wrap  = map[type] || sel;
  input.value = input.value.slice(0,start) + wrap + input.value.slice(end);
  input.focus();
  toggleSendMic();
}

function toggleFormatBar() {
  App.formatBarOpen = !App.formatBarOpen;
  document.getElementById('format-bar')?.classList.toggle('hidden', !App.formatBarOpen);
}
function hideFormatBar() { App.formatBarOpen=false; hide('format-bar'); }

function toggleAttachMenu() {
  App.attachMenuOpen = !App.attachMenuOpen;
  document.getElementById('attach-menu')?.classList.toggle('hidden', !App.attachMenuOpen);
}
function toggleEmojiPicker() {
  App.emojiPickerOpen = !App.emojiPickerOpen;
  document.getElementById('emoji-picker')?.classList.toggle('hidden', !App.emojiPickerOpen);
}

function handleDocumentClick(e) {
  if (!e.target.closest('#attach-btn') && !e.target.closest('#attach-menu')) {
    App.attachMenuOpen = false;
    document.getElementById('attach-menu')?.classList.add('hidden');
  }
  if (!e.target.closest('button[onclick="toggleEmojiPicker()"]') && !e.target.closest('#emoji-picker')) {
    App.emojiPickerOpen = false;
    document.getElementById('emoji-picker')?.classList.add('hidden');
  }
}

function setEl(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
function qsa(sel) { return document.querySelectorAll(sel); }

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function showToast(msg, type='info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  const typeClasses = type === 'success' ? 'bg-secondary text-white' : 'bg-surface-container-highest text-on-surface';
  t.className = `px-5 py-3 rounded-2xl text-xs font-bold shadow-xl border border-outline-variant/30 flex items-center gap-2 animate-bounce ${typeClasses}`;
  t.innerHTML = `<span>💬</span> <span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function showConfirm(msg, onConfirm) {
  const overlay = document.getElementById('confirm-overlay');
  const text = document.getElementById('confirm-msg');
  const btn = document.getElementById('confirm-action-btn');
  if (!overlay || !text || !btn) return;
  
  text.textContent = msg;
  btn.onclick = () => { onConfirm(); closeModal('confirm-overlay'); };
  show('confirm-overlay');
}

function openProfile() { updateProfileUI(); show('profile-overlay'); }
function closeModal(id) { hide(id); }
function showOverlay(id) { show(id); }
function closeOverlay(id) { hide(id); }
function closeTopModal() {
  ['profile-overlay','new-chat-overlay','confirm-overlay','group-info-overlay','msg-info-overlay','media-viewer'].forEach(hide);
}
function closeOnBackdrop(e, id) { if (e.target.id === id) hide(id); }

function formatChatTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const diff = Date.now() - ms;
  if (diff < 24*3600000) return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  if (diff < 7*24*3600000) return d.toLocaleDateString([], {weekday:'short'});
  return d.toLocaleDateString([], {month:'short', day:'numeric'});
}
function formatMsgTime(ms) {
  return new Date(ms).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}
function formatDateSep(date) {
  return date.toLocaleDateString([], {weekday:'long', month:'short', day:'numeric'});
}
function formatDuration(sec) {
  const m = Math.floor(sec/60);
  const s = sec%60;
  return `${m}:${s<10?'0':''}${s}`;
}

function updateBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = count;
  el.classList.toggle('hidden', count === 0);
}

/* ══════════════════════════════════════════════════
   23. ATTACHMENT MOCKS
   ══════════════════════════════════════════════════ */
// attachPhoto, attachDocument, attachCamera are overridden in app-extras.js
// These are fallback stubs in case app-extras.js is not loaded
if (typeof attachPhoto === 'undefined') {
  var attachPhoto = function() {
    const msg = { id:'msg_'+Date.now(), from:'me', type:'image', url:'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop', time:Date.now(), status:'sent' };
    App.messages[App.currentChat.id].push(msg);
    App.currentChat.lastMsg = '🖼️ Photo attached'; App.currentChat.lastTime = msg.time;
    renderMessages(App.currentChat.id); scrollToBottom(true); renderChatList(); toggleAttachMenu();
  };
}
if (typeof attachDocument === 'undefined') {
  var attachDocument = function() {
    const msg = { id:'msg_'+Date.now(), from:'me', type:'doc', fileName:'design_tokens_brief.pdf', fileSize:'1.4 MB', time:Date.now(), status:'sent' };
    App.messages[App.currentChat.id].push(msg);
    App.currentChat.lastMsg = '📄 design_tokens_brief.pdf'; App.currentChat.lastTime = msg.time;
    renderMessages(App.currentChat.id); scrollToBottom(true); renderChatList(); toggleAttachMenu();
  };
}
if (typeof attachCamera === 'undefined') {
  var attachCamera = function() { showToast('Accessing device camera...','info'); toggleAttachMenu(); };
}
function shareLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
        if (!App.messages[App.currentChat.id]) App.messages[App.currentChat.id] = [];
        const msg = { id:'msg_'+Date.now(), from:'me', type:'text', text:'📍 My Location: ' + url, time:Date.now(), status:'sent' };
        App.messages[App.currentChat.id].push(msg);
        App.currentChat.lastMsg = '📍 Location shared'; App.currentChat.lastTime = msg.time;
        renderMessages(App.currentChat.id); scrollToBottom(true); renderChatList();
        showToast('Location shared', 'success');
      },
      () => showToast('Location access denied', 'error')
    );
  } else {
    showToast('Location not available', 'error');
  }
  toggleAttachMenu();
}

/* ══════════════════════════════════════════════════
   24. EMOJI LOADINGS
   ══════════════════════════════════════════════════ */
function loadEmojiGrid(cat) {
  const grid = document.getElementById('emoji-grid');
  if (!grid) return;
  const list = App.emojiCategories[cat] || [];
  grid.innerHTML = list.map(em => `<span class="cursor-pointer hover:scale-125 transition-transform" onclick="insertEmoji('${em}')">${em}</span>`).join('');
}
function setEmojiCat(btn, cat) {
  qsa('.emoji-cat-btn').forEach(b=>b.classList.remove('active','bg-primary/10'));
  btn.classList.add('active','bg-primary/10');
  loadEmojiGrid(cat);
}
function insertEmoji(em) {
  const input = document.getElementById('msg-input');
  if (input) { input.value += em; input.focus(); toggleSendMic(); }
}

/* ══════════════════════════════════════════════════
   25. KEYBOARD & WEB EVENTS
   ══════════════════════════════════════════════════ */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Ctrl+K = focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (App.currentChat) openChatSearch();
      else document.getElementById('sidebar-search')?.focus();
    }
    // Ctrl+/ = format bar
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      toggleFormatBar();
    }
  });
}

function updatePresence(status) {
  if (!App.db || !App.auth?.currentUser) return;
  App.db.collection('users').doc(App.auth.currentUser.uid).set({ onlineStatus: status }, { merge: true }).catch(() => {});
}

function setupOnlineStatus() {
  window.addEventListener('online',  () => hide('offline-banner'));
  window.addEventListener('offline', () => show('offline-banner'));
  if (!navigator.onLine) show('offline-banner');
  window.addEventListener('beforeunload', () => updatePresence('offline'));
  document.addEventListener('visibilitychange', () => updatePresence(document.hidden ? 'offline' : 'online'));
}

/* ─── PUSH NOTIFICATIONS (FCM) ───────────────────────────────── */
function setupPushNotifications() {
  if (!App.db || !App.auth?.currentUser || !window.firebase?.messaging) return;
  const uid = App.auth.currentUser.uid;
  const registerFcmToken = async () => {
    try {
      const messaging = firebase.messaging();
      const reg = await navigator.serviceWorker.ready;
      const token = await messaging.getToken({
        vapidKey: typeof FCM_VAPID_KEY !== 'undefined' ? FCM_VAPID_KEY : undefined,
        serviceWorkerRegistration: reg
      });
      if (!token) return;
      const key = token.replace(/[^a-zA-Z0-9]/g, '').slice(-120);
      await App.db.collection('users').doc(uid).set({
        fcmTokens: { [key]: { token, platform: navigator.userAgent || 'web', updatedAt: firebase.firestore.FieldValue.serverTimestamp(), permission: Notification.permission, purpose: 'all' } },
        notificationsEnabled: true,
        lastFcmTokenUpdateAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) { console.warn('[Push] Token registration failed:', e); }
  };
  if (Notification.permission === 'granted') {
    registerFcmToken();
  } else if (Notification.permission !== 'denied') {
    const banner = document.createElement('div');
    banner.id = 'pushPromptBanner';
    banner.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);width:min(90vw,360px);background:var(--surface-container);color:var(--on-surface);border-radius:12px;padding:14px 16px;z-index:99990;box-shadow:0 6px 24px rgba(0,0,0,0.4);display:flex;flex-direction:column;gap:10px;font-family:inherit;';
    banner.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:12px;"><div style="font-size:22px;flex-shrink:0;">🔔</div><div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:14px;margin-bottom:3px;">Stay notified</div><div style="font-size:12.5px;color:var(--on-surface-variant);line-height:1.45;">Get alerts for new messages and calls even when the app is closed.</div></div><button id="pushPromptClose" style="background:none;border:none;color:var(--on-surface-variant);font-size:18px;cursor:pointer;padding:0 2px;">✕</button></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;"><button id="pushPromptNo" style="background:none;border:none;color:var(--on-surface-variant);font-size:13px;cursor:pointer;padding:6px 10px;border-radius:6px;">Not now</button><button id="pushPromptYes" style="background:var(--primary);border:none;color:var(--on-primary);font-size:13px;font-weight:600;cursor:pointer;padding:7px 16px;border-radius:8px;">Enable notifications</button></div>';
    document.body.appendChild(banner);
    const dismiss = () => { banner.remove(); };
    document.getElementById('pushPromptClose').onclick = dismiss;
    document.getElementById('pushPromptNo').onclick = dismiss;
    document.getElementById('pushPromptYes').onclick = async () => {
      dismiss();
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') registerFcmToken();
      } catch (e) { console.warn('[Push] Permission request failed:', e); }
    };
    setTimeout(dismiss, 15000);
  }
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
  return name.slice(0,2).toUpperCase();
}

function getDirectChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

/* ══════════════════════════════════════════════════
    CHAT REQUESTS — SEND / ACCEPT / DECLINE
   ══════════════════════════════════════════════════ */
function searchUserByEmail(email) {
  if (!App.db || !email || !email.includes('@')) return Promise.resolve(null);
  return App.db.collection('users').where('email', '==', email).limit(1).get()
    .then(snap => {
      if (snap.empty) return null;
      const doc = snap.docs[0];
      const data = doc.data();
      return { uid: doc.id, name: data.displayName || data.email || 'User', email: data.email, avatar: data.avatar || 'gradient-2', initials: getInitials(data.displayName || data.email || 'User') };
    })
    .catch(() => null);
}

function sendChatRequestBtn(btn) {
  const uid = btn.dataset.reqUid;
  const email = btn.dataset.reqEmail;
  const name = btn.dataset.reqName;
  sendChatRequest(uid, email, name);
}

async function sendChatRequest(toUid, toEmail, toName) {
  if (!App.db || !App.auth?.currentUser) { showToast('Please sign in first', 'error'); return; }
  const uid = App.auth.currentUser.uid;
  const myEmail = App.currentUser.email || '';
  const myName = App.currentUser.displayName || myEmail;
  const existingChat = App.chats.find(c => c.uid === toUid);
  if (existingChat) { showToast('You already have a chat with this user', 'info'); return; }
  try {
    const q = await App.db.collection('chatRequests')
      .where('fromEmail', '==', myEmail)
      .where('toEmail', '==', toEmail)
      .where('status', '==', 'pending')
      .get();
    if (!q.empty) { showToast('Request already sent', 'info'); return; }
    await App.db.collection('chatRequests').add({
      from: uid, fromEmail: myEmail, fromName: myName,
      to: toUid, toEmail: toEmail, toName: toName,
      fromUserId: uid, toUserId: toUid,
      fromUserName: myName, toUserName: toName,
      status: 'pending', timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`Chat request sent to ${toName}`, 'success');
  } catch(e) { showToast('Failed to send request', 'error'); console.warn(e); }
}

async function acceptChatRequest(requestId) {
  if (!App.db || !App.auth?.currentUser) return;
  const req = (App.chatRequests.incoming || []).find(r => r.id === requestId);
  if (!req) { showToast('Request not found', 'error'); return; }
  const uid = App.auth.currentUser.uid;
  const myEmail = App.currentUser.email || '';
  const chatId = getDirectChatId(uid, req.fromUid);
  try {
    await App.db.collection('directChats').doc(chatId).set({
      participants: [uid, req.fromUid],
      participantNames: { [uid]: App.currentUser.displayName || myEmail, [req.fromUid]: req.fromName },
      participantEmails: { [uid]: myEmail, [fromUid]: req.fromEmail },
      status: 'active'
    }, { merge: true });
    await App.db.collection('chatRequests').doc(requestId).update({
      status: 'accepted',
      toUserName: App.currentUser.displayName || myEmail
    });
    showToast(`Chat request from ${req.fromName} accepted`, 'success');
    if (App.chatsUnsubscribe) { App.chatsUnsubscribe(); App.chatsUnsubscribe = null; }
    subscribeToChats();
  } catch(e) { showToast('Failed to accept request', 'error'); console.warn(e); }
}

async function declineChatRequest(requestId) {
  if (!App.db) return;
  try {
    await App.db.collection('chatRequests').doc(requestId).update({ status: 'declined' });
    showToast('Chat request declined', 'info');
  } catch(e) { console.warn(e); }
}

/* ══════════════════════════════════════════════════
     FEATURE: CHAT FOLDERS
    ══════════════════════════════════════════════════ */
async function loadChatFolders() {
  if (!App.db || !App.auth?.currentUser) return;
  try {
    const doc = await App.db.collection('users').doc(App.auth.currentUser.uid).get();
    App.chatFolders = doc.data()?.chatFolders || [];
  } catch (e) { App.chatFolders = []; }
  renderFolderTabs();
}
async function saveChatFolders() {
  if (!App.db || !App.auth?.currentUser) return;
  await App.db.collection('users').doc(App.auth.currentUser.uid).update({ chatFolders: App.chatFolders })
    .catch(() => App.db.collection('users').doc(App.auth.currentUser.uid).set({ chatFolders: App.chatFolders }, { merge: true }));
  renderFolderTabs();
}
function createFolder(name) {
  if (!name || !name.trim()) return;
  App.chatFolders.push({ name: name.trim(), icon: '📁', chatIds: [] });
  saveChatFolders();
}
function deleteFolder(index) {
  App.chatFolders.splice(index, 1);
  if (App.activeFolderIndex >= App.chatFolders.length) App.activeFolderIndex = -1;
  saveChatFolders();
  renderChatList();
}
function addChatToFolder(folderIdx, chatId) {
  const f = App.chatFolders[folderIdx];
  if (!f) return;
  if (!f.chatIds.includes(chatId)) f.chatIds.push(chatId);
  saveChatFolders();
}
function removeChatFromFolder(folderIdx, chatId) {
  const f = App.chatFolders[folderIdx];
  if (!f) return;
  f.chatIds = f.chatIds.filter(id => id !== chatId);
  saveChatFolders();
}
function selectFolder(index) {
  App.activeFolderIndex = index;
  renderFolderTabs();
  renderChatList();
}
function renderFolderTabs() {
  const container = document.getElementById('folder-tabs');
  if (!container) return;
  if (!App.chatFolders.length) { container.innerHTML = ''; container.classList.add('hidden'); return; }
  container.classList.remove('hidden');
  let html = '';
  App.chatFolders.forEach((f, i) => {
    const active = i === App.activeFolderIndex ? 'bg-primary/15 text-primary' : 'bg-surface-container-hover text-on-surface-variant hover:bg-surface-container-high';
    html += `<button class="folder-tab px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${active}" data-folder-idx="${i}" onclick="selectFolder(${i})">${escHtml(f.icon || '📁')} ${escHtml(f.name)}</button>`;
  });
  if (App.activeFolderIndex >= 0) {
    html += `<button class="folder-tab px-3 py-1.5 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-high whitespace-nowrap transition-all" onclick="selectFolder(-1)">✕ All</button>`;
  }
  container.innerHTML = html;
}
function openFolderManager() {
  const overlay = document.getElementById('folder-manager-overlay');
  if (!overlay) return;
  const list = document.getElementById('folder-manager-list');
  if (!list) return;
  if (!App.chatFolders.length) {
    list.innerHTML = '<div class="text-center py-8 text-on-surface-variant text-sm">No folders yet. Create one to organize your chats.</div>';
  } else {
    list.innerHTML = App.chatFolders.map((f, i) =>
      `<div class="flex items-center gap-3 p-3 border-b border-outline-variant/10">
        <span style="font-size:20px">${f.icon || '📁'}</span>
        <div class="flex-1 min-w-0"><div class="font-bold text-sm text-on-surface">${escHtml(f.name)}</div><div class="text-xs text-on-surface-variant">${(f.chatIds || []).length} chat(s)</div></div>
        <button class="px-2 py-1 text-xs font-bold text-error hover:bg-error/10 rounded-lg transition-all" onclick="if(confirm('Delete folder \\'${escHtml(f.name)}\\'?')){deleteFolder(${i})}">Delete</button>
      </div>`
    ).join('');
  }
  document.getElementById('folder-new-name').value = '';
  showOverlay('folder-manager-overlay');
}
function saveFolderFromInput() {
  const input = document.getElementById('folder-new-name');
  if (!input) return;
  createFolder(input.value);
  input.value = '';
  openFolderManager();
}

/* ══════════════════════════════════════════════════
     FEATURE: CUSTOM NOTIFICATION SOUNDS PER CHAT
    ══════════════════════════════════════════════════ */
function getChatSound(chatId) {
  try { return localStorage.getItem('tc_chat_sound_' + chatId) || ''; } catch (e) { return ''; }
}
function setChatSound(chatId, sound) {
  try { localStorage.setItem('tc_chat_sound_' + chatId, sound || ''); } catch (e) {}
  if (App.db && App.auth?.currentUser) {
    App.db.collection('chatNotifSettings').doc(chatId).set({
      userId: App.auth.currentUser.uid,
      sound: sound || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});
  }
}
function openChatSoundPicker() {
  const overlay = document.getElementById('sound-picker-overlay');
  if (!overlay) return;
  const chatId = App.currentChat?.id;
  if (!chatId) return;
  const select = document.getElementById('chat-sound-select');
  if (select) select.value = getChatSound(chatId);
  showOverlay('sound-picker-overlay');
}
function saveChatSound() {
  const select = document.getElementById('chat-sound-select');
  const chatId = App.currentChat?.id;
  if (!select || !chatId) return;
  setChatSound(chatId, select.value);
  closeOverlay('sound-picker-overlay');
  showToast(select.value ? 'Notification sound set' : 'Default sound restored', 'success');
}

/* ══════════════════════════════════════════════════
     FEATURE: QR / BARCODE SCANNER
    ══════════════════════════════════════════════════ */
let scannerStream = null;
let scannerFrameId = 0;
let scannerValue = '';

function closeScanner() {
  if (scannerFrameId) cancelAnimationFrame(scannerFrameId);
  scannerFrameId = 0;
  if (scannerStream) { scannerStream.getTracks().forEach(t => t.stop()); scannerStream = null; }
  closeOverlay('scanner-overlay');
}

async function openScanner() {
  const overlay = document.getElementById('scanner-overlay');
  const video = document.getElementById('scanner-video');
  const status = document.getElementById('scanner-status');
  const result = document.getElementById('scanner-result');
  if (!overlay || !video) return;
  scannerValue = '';
  if (result) result.classList.add('hidden');
  if (status) status.textContent = 'Initializing camera…';
  showOverlay('scanner-overlay');

  if (!navigator.mediaDevices?.getUserMedia || !('BarcodeDetector' in window)) {
    if (status) status.textContent = 'QR scanning is not supported by this browser.';
    return;
  }
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }, audio: false
    });
    video.srcObject = scannerStream;
    await video.play();
    if (status) status.textContent = 'Point camera at a QR code or barcode.';
    const formats = await window.BarcodeDetector.getSupportedFormats().catch(() => ['qr_code']);
    const detector = new window.BarcodeDetector({ formats });
    const detectFrame = async () => {
      if (!scannerStream || overlay.classList.contains('hidden')) return;
      try {
        const codes = video.readyState >= 2 ? await detector.detect(video) : [];
        if (codes.length > 0 && codes[0].rawValue) {
          scannerValue = codes[0].rawValue;
          if (status) status.textContent = 'Scanned!';
          if (result) { result.textContent = scannerValue; result.classList.remove('hidden'); }
          closeScanner();
          try {
            const url = new URL(scannerValue);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
              window.open(scannerValue, '_blank', 'noopener,noreferrer');
            }
          } catch (_) { showToast('Scanned: ' + scannerValue, 'info'); }
          return;
        }
      } catch (e) { /* detection frame error */ }
      scannerFrameId = requestAnimationFrame(detectFrame);
    };
    scannerFrameId = requestAnimationFrame(detectFrame);
  } catch (e) {
    if (status) status.textContent = 'Camera access denied or not available.';
    console.warn('[Scanner]', e);
  }
}

/* ══════════════════════════════════════════════════
     FEATURE: MULTI-LANGUAGE / i18n
    ══════════════════════════════════════════════════ */
const TRANSLATIONS = {
  en: {
    chats: 'Chats', groups: 'Groups', calls: 'Calls', requests: 'Requests',
    settings: 'Settings', profile: 'Profile', savedItems: 'Saved Items',
    search: 'Search conversations...', messages: 'Messages',
    noChats: 'No conversations yet', typeMessage: 'Type your message...',
    online: 'Online', offline: 'Offline', typing: 'typing...',
    accept: 'Accept', decline: 'Decline', pending: 'Pending',
    notifications: 'Notifications', theme: 'Theme', folders: 'Folders',
    language: 'Language', signOut: 'Sign Out', cancel: 'Cancel', save: 'Save',
    create: 'Create', delete: 'Delete', edit: 'Edit', close: 'Close',
    enableNotif: 'Enable notifications', notNow: 'Not now',
  },
  hi: {
    chats: 'चैट', groups: 'समूह', calls: 'कॉल', requests: 'अनुरोध',
    settings: 'सेटिंग्स', profile: 'प्रोफ़ाइल', savedItems: 'सहेजी गई चीज़ें',
    search: 'बातचीत खोजें...', messages: 'संदेश',
    noChats: 'अभी तक कोई बातचीत नहीं', typeMessage: 'अपना संदेश लिखें...',
    online: 'ऑनलाइन', offline: 'ऑफ़लाइन', typing: 'टाइप कर रहे हैं...',
    accept: 'स्वीकार करें', decline: 'अस्वीकार करें', pending: 'लंबित',
    notifications: 'सूचनाएं', theme: 'थीम', folders: 'फ़ोल्डर',
    language: 'भाषा', signOut: 'साइन आउट', cancel: 'रद्द करें', save: 'सहेजें',
    create: 'बनाएं', delete: 'हटाएं', edit: 'संपादित करें', close: 'बंद करें',
    enableNotif: 'सूचनाएं चालू करें', notNow: 'अभी नहीं',
  },
  gu: {
    chats: 'ચેટ', groups: 'જૂથો', calls: 'કૉલ', requests: 'વિનંતીઓ',
    settings: 'સેટિંગ્સ', profile: 'પ્રોફાઇલ', savedItems: 'સાચવેલ વસ્તુઓ',
    search: 'વાતચીત શોધો...', messages: 'સંદેશાઓ',
    noChats: 'હજી સુધી કોઈ વાતચીત નથી', typeMessage: 'તમારો સંદેશ લખો...',
    online: 'ઑનલાઇન', offline: 'ઑફલાઇન', typing: 'ટાઇપ કરી રહ્યા છે...',
    accept: 'સ્વીકારો', decline: 'નકારો', pending: 'બાકી',
    notifications: 'સૂચનાઓ', theme: 'થીમ', folders: 'ફોલ્ડર',
    language: 'ભાષા', signOut: 'સાઇન આઉટ', cancel: 'રદ કરો', save: 'સાચવો',
    create: 'બનાવો', delete: 'કાઢો', edit: 'સંપાદિત કરો', close: 'બંધ કરો',
    enableNotif: 'સૂચનાઓ સક્ષમ કરો', notNow: 'હમણાં નહીં',
  },
};

function __(key) {
  const lang = localStorage.getItem('tc_language') || 'en';
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}

function setLanguage(lang) {
  localStorage.setItem('tc_language', lang || 'en');
  document.documentElement.lang = lang || 'en';
  // Update static sidebar labels
  const sidebarNav = document.getElementById('sidebar-nav-container');
  if (sidebarNav && !App.showroomOverride?.type) {
    const btns = sidebarNav.querySelectorAll('.tab-item');
    const labels = btns ? [
      { el: btns[0]?.querySelector('span:last-child'), key: 'chats' },
      { el: btns[1]?.querySelector('span:last-child'), key: 'groups' },
      { el: btns[2]?.querySelector('span:last-child'), key: 'calls' },
    ] : [];
    labels.forEach(({ el, key }) => { if (el) el.textContent = __(key); });
  }
  // Re-render current view
  if (App.activeTab) switchTab(App.activeTab);
  renderFolderTabs();
}

function openLanguagePicker() {
  const overlay = document.getElementById('language-overlay');
  if (!overlay) return;
  const select = document.getElementById('language-select');
  if (select) select.value = localStorage.getItem('tc_language') || 'en';
  showOverlay('language-overlay');
}

function saveLanguage() {
  const select = document.getElementById('language-select');
  if (!select) return;
  setLanguage(select.value);
  closeOverlay('language-overlay');
  showToast('Language updated', 'success');
}

function signOut() {
  if (App.usersUnsubscribe)       App.usersUnsubscribe();
  if (App.chatsUnsubscribe)       App.chatsUnsubscribe();
  if (App.groupsUnsubscribe)      App.groupsUnsubscribe();
  if (App.messagesUnsubscribe)    App.messagesUnsubscribe();
  if (App.chatRequestsUnsubscribe) App.chatRequestsUnsubscribe();
  if (App.auth) App.auth.signOut().then(() => location.reload());
  else location.reload();
}
