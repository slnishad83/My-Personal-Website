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
  theme: localStorage.getItem('tc_theme') || 'dark', // Vibrant Midnight default
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
        about: data.about || data.statusText || 'Available'
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

function mergeAndRenderChats() {
  const direct = App.directChats || [];
  const groups = App.groupChats || [];
  App.chats = [...direct, ...groups];
  renderChatList();
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
          if (att.type === 'image' || att.type === 'video') {
            type = 'image';
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
    { uid:'c1', name:'Halid',          avatar:'bg-primary-container text-primary', initials:'H', status:'online',  about:'Dev Lead @ NeonChat 🚀' },
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

  if (tab === 'calls')  { renderCallsTab(); return; }
  if (tab === 'more')   { renderMoreTab();  return; }

  if (filter) {
    const q = filter.toLowerCase();
    items = items.filter(c => c.name.toLowerCase().includes(q) || (c.lastMsg||'').toLowerCase().includes(q));
  }

  // Determine if Myself Workspace styling should override sidebar headers
  const isMyselfOverride = App.showroomOverride?.type === 'myself' || (App.currentChat && App.currentChat.id === 'saved_me');
  
  const sidebarTitle = document.getElementById('chats-sidebar-title');
  if (sidebarTitle) {
    sidebarTitle.textContent = isMyselfOverride ? 'Notebooks' : 'Messages';
  }
  
  const sidebarSearchInput = document.getElementById('sidebar-search');
  if (sidebarSearchInput) {
    sidebarSearchInput.placeholder = isMyselfOverride ? 'Search notes...' : 'Search conversations...';
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
      if (sidebarTitleEl) sidebarTitleEl.textContent = "NeonChat";
      if (sidebarSubtitleEl) sidebarSubtitleEl.textContent = "Vibrant Midnight";
      
      sidebarNav.innerHTML = `
        <button class="tab-item w-full flex items-center gap-4 bg-primary/10 text-primary border-l-4 border-primary px-4 py-3 cursor-pointer active:scale-95" onclick="switchTab('chats')">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">chat</span>
          <span class="hidden xl:block font-body-md text-body-md font-semibold">Chats</span>
        </button>
        <button class="tab-item w-full flex items-center gap-4 text-on-surface/60 hover:text-on-surface hover:bg-surface-container-highest px-4 py-3 cursor-pointer active:scale-95" onclick="switchTab('groups')">
          <span class="material-symbols-outlined">group</span>
          <span class="hidden xl:block font-body-md text-body-md">Groups</span>
        </button>
        <button class="tab-item w-full flex items-center gap-4 text-on-surface/60 hover:text-on-surface hover:bg-surface-container-highest px-4 py-3 cursor-pointer active:scale-95" onclick="switchTab('calls')">
          <span class="material-symbols-outlined">call</span>
          <span class="hidden xl:block font-body-md text-body-md">Calls</span>
        </button>
        <button class="tab-item w-full flex items-center gap-4 text-on-surface/60 hover:text-on-surface hover:bg-surface-container-highest px-4 py-3 cursor-pointer active:scale-95" onclick="switchTab('more')">
          <span class="material-symbols-outlined">bookmark</span>
          <span class="hidden xl:block font-body-md text-body-md">Saved Items</span>
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
    }
  }

  // Exact mockup selection class overrides
  const activeClass = isActive 
    ? 'bg-surface-variant/40 border-l-4 border-primary text-primary' 
    : 'hover:bg-surface-variant/30 text-on-surface';

  const statusColor = status === 'online' ? 'bg-secondary' : 'bg-outline'; // pink for online
  const statusDot = (chat.type === 'personal' && chat.id !== `saved_me`)
    ? `<div class="absolute bottom-0 right-0 w-3 h-3 ${statusColor} rounded-full border-2 border-surface-container-low"></div>` : '';

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
  list.innerHTML = `
    <div class="flex flex-col items-center py-12 text-center w-full">
      <div class="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4 border border-outline-variant/20 shadow-md">
        <span class="material-symbols-outlined text-secondary text-3xl">call</span>
      </div>
      <h4 class="font-bold mb-1">No call logs</h4>
      <p class="text-on-surface-variant text-xs max-w-xs">Start high-definition calls directly with any of your workspace team members.</p>
    </div>`;
}

function renderMoreTab() {
  const list = document.getElementById('chat-list');
  list.innerHTML = `
    <div class="p-4 space-y-1">
      ${moreRow('star','Starred Messages','showToast("Starred Messages","info")')}
      ${moreRow('bookmark','Bookmarks','showToast("Bookmarks","info")')}
      ${moreRow('schedule','Scheduled Messages','showToast("Scheduled Messages","info")')}
      ${moreRow('quick_reply','Quick Replies','showToast("Quick Replies","info")')}
      ${moreRow('folder','Folders','showToast("Folders","info")')}
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

  // Adapt Header actions based on chat type (Vibrant Midnight spec)
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
    const contact = App.contacts.find(c=>c.uid===chat.uid);
    const statusText = contact?.status === 'online' ? 'Active Now' : contact?.about || 'Offline';
    if (headerStatus) {
      headerStatus.textContent = statusText;
      headerStatus.className = "text-[10px] text-primary-fixed-dim uppercase tracking-widest font-label-caps" + (contact?.status === 'online' ? ' text-secondary' : '');
    }
    if (statusDot) {
      statusDot.style.display = '';
      statusDot.className = `absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${contact?.status === 'online' ? 'bg-secondary' : 'bg-outline'}`;
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
    const contact = isMe ? null : App.contacts.find(c=>c.uid===msg.from);
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
      contentHTML = `<div class="flex items-center gap-4 bg-surface-container-high p-4 rounded-xl border border-outline-variant/20 cursor-pointer" onclick="window.open('${escHtml(msg.url||'')}', '_blank')">
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
        <div class="p-bubble_padding_xy ${bubbleClass} relative group"
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
   19. INFO DETAIL PANELS (Vibrant Midnight styling)
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
  const contact = App.contacts.find(c=>c.uid===uid) || {};
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
        <p class="text-sm font-semibold text-on-surface">+1 (555) 987-6543</p>
      </div>
      <div class="space-y-1">
        <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Email Address</span>
        <p class="text-sm font-semibold text-on-surface">${contact.name?.toLowerCase() || 'user'}@neonchat.app</p>
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
    <div class="px-4 py-2 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Workspace Directory</div>
    <div class="space-y-1">
      ${App.contacts.map(c => {
        const initials = c.initials || '?';
        const statusColor = c.status === 'online' ? 'bg-secondary' : 'bg-outline'; // pink online dot
        
        return `
        <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container transition-all cursor-pointer group" onclick="startChatWith('${c.uid}')">
          <div class="relative flex-shrink-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm bg-surface-container-highest text-on-surface-variant">${initials}</div>
            <div class="absolute bottom-0 right-0 w-2.5 h-2.5 ${statusColor} rounded-full border border-surface-container-lowest"></div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm text-on-surface truncate group-hover:text-primary transition-colors">${escHtml(c.name)}</div>
            <div class="text-xs text-on-surface-variant truncate">${escHtml(c.about || c.status)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
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

function openProfile() { show('profile-overlay'); }
function closeModal(id) { hide(id); }
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

function setupOnlineStatus() {
  window.addEventListener('online',  () => hide('offline-banner'));
  window.addEventListener('offline', () => show('offline-banner'));
  if (!navigator.onLine) show('offline-banner');
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

function signOut() {
  if (App.usersUnsubscribe)    App.usersUnsubscribe();
  if (App.chatsUnsubscribe)    App.chatsUnsubscribe();
  if (App.groupsUnsubscribe)   App.groupsUnsubscribe();
  if (App.messagesUnsubscribe) App.messagesUnsubscribe();
  if (App.auth) App.auth.signOut().then(() => location.reload());
  else location.reload();
}
