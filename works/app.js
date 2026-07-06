/* ============================================================
   TEAM CHAT — 2026 REDESIGN
   app.js — Complete Application Logic
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
  theme: localStorage.getItem('tc_theme') || 'system',
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
  emojiCategories: {
    recent: ['😊','👍','❤️','😂','🙏','🔥','✨','😍'],
    smileys: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐'],
    people: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄','💋','🩸'],
    nature: ['🌱','🌿','🍀','🍁','🍂','🍃','🌸','🌺','🌻','🌹','🥀','🌷','🌼','💐','🌾','🍄','🐚','🪸','🪨','🌵','🎋','🎍','🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥'],
    food: ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🧇','🥞','🧈','🍞','🥐','🥖','🫓','🥨','🥯','🧀','🥗','🥙','🥪','🌮','🌯','🫔','🧆','🥜','🫘','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯'],
    travel: ['✈️','🚀','🛸','🚁','🛺','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🚋','🚌','🚍','🚎','🚐','🚑','🚒','🚓','🚔','🚕','🚖','🚗','🚘','🚙','🛻','🚚','🚛','🚜','🏎','🏍','🛵','🛺','🚲','🛴','🛹','🛼','🚏','🛣','🛤','⛽','🚧','⚓','🪝','⛵','🛶','🚤','🛥','🛳','⛴','🚢','🗺','🧭','🏔','⛰','🌋','🗻','🏕','🏖','🏜','🏝','🏞','🏟','🏛','🏗','🏘','🏚','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽'],
    objects: ['💡','🔦','🕯','🪔','🧱','🔮','🪄','💎','🔑','🗝','🔐','🔏','🔒','🔓','🔨','🪓','⛏','⚒','🛠','🗡','⚔','🛡','🔧','🔩','⚙️','🗜','⚖','🦯','🔗','⛓','🪝','🧲','🔭','🔬','🩺','💊','🩹','🩼','🩻','🩺','🧬','🦠','🧫','🧪','🌡','🧹','🪣','🧺','🧻','🪠','🧼','🫧','🪥','🧽','🧯','🛒','🚪','🪞','🪟','🛏','🛋','🪑','🚽','🪠','🚿','🛁','🪤','🪒','🧴','🧷','🧹'],
    symbols: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🔱','⚜️','🔰','♻️','✅','🈯','💹','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈹','🚰','🚹','🚺','🚻','🚼','🚽','🛁','🚿']
  }
};

/* ══════════════════════════════════════════════════
   2. FIREBASE INIT
══════════════════════════════════════════════════ */
function initFirebase() {
  // Firebase is loaded globally (script tags in HTML from original app)
  // We hook into the existing firebase instance
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
  // Close menus on outside click
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', e => { if (e.key==='Escape') closeTopModal(); });
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

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
}

function getDirectChatId(userId1, userId2) {
  return [userId1, userId2].sort().join("_");
}

function subscribeToUsers() {
  if (!App.db || !App.auth?.currentUser) return;
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
    console.warn("Users subscription failed:", error);
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
        name: 'Myself',
        avatar: 'gradient-1',
        initials: getInitials(App.currentUser.displayName || App.currentUser.email || 'Me'),
        photoURL: App.currentUser.photoURL || null,
        lastMsg: 'Your personal notes, files & reminders',
        lastTime: Date.now() + 100000000000,
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
  
  if (App.currentChat) {
    const updatedChat = App.chats.find(c => c.id === App.currentChat.id);
    if (updatedChat) {
      App.currentChat = updatedChat;
      setEl('header-name', updatedChat.name);
      
      const statusDot = document.getElementById('header-status-dot');
      if (updatedChat.type === 'group') {
        setEl('header-status', `${updatedChat.memberCount || 3} members`);
        if (statusDot) statusDot.style.display = 'none';
        
        const ha = document.getElementById('header-avatar');
        if (ha) {
          if (updatedChat.photoURL) {
            ha.innerHTML = `<img src="${updatedChat.photoURL}" alt="${escHtml(updatedChat.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
          } else {
            ha.className = `avatar-img sz-40 ${updatedChat.avatar || 'gradient-3'}`;
            ha.textContent = updatedChat.initials;
            ha.style.borderRadius = '50%';
            ha.style.fontSize = '14px';
          }
        }
      } else {
        const contact = App.contacts.find(c=>c.uid===updatedChat.uid);
        const statusText = contact?.status === 'online' ? 'Online' : contact?.about || 'Tap to view profile';
        const el2 = document.getElementById('header-status');
        if (el2) {
          el2.textContent = statusText;
          el2.className = 'chat-header-status' + (contact?.status==='online' ? ' online' : '');
        }
        if (statusDot) {
          statusDot.style.display = '';
          statusDot.className = `avatar-status ${contact?.status||'offline'}`;
        }
        
        const ha = document.getElementById('header-avatar');
        if (ha) {
          if (updatedChat.photoURL) {
            ha.innerHTML = `<img src="${updatedChat.photoURL}" alt="${escHtml(updatedChat.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
          } else {
            ha.className = `avatar-img sz-40 ${updatedChat.avatar}`;
            ha.textContent = updatedChat.initials;
            ha.style.borderRadius = '50%';
            ha.style.fontSize = '14px';
          }
        }
      }
    }
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
        App.currentUser = { uid:'demo', displayName:'You', email:'you@teamchat.app', photoURL:null };
        setLoadingStatus('Loading demo…');
        setTimeout(() => { loadDemoData(); bootApp(); }, 800);
      }
    });
  } else {
    App.currentUser = { uid:'demo', displayName:'You', email:'you@teamchat.app', photoURL:null };
    setTimeout(() => { loadDemoData(); bootApp(); }, 900);
  }
}

function bootApp() {
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  updateProfileUI();
  renderChatList();
  showWelcome();
}

function setLoadingStatus(msg) {
  document.getElementById('loading-status').textContent = msg;
}

/* ══════════════════════════════════════════════════
   4. DEMO / MOCK DATA
══════════════════════════════════════════════════ */
function loadDemoData() {
  App.contacts = [
    { uid:'c1', name:'Aisha Rahman',   avatar:'gradient-2', initials:'AR', status:'online',  about:'Let\'s build something great 🚀' },
    { uid:'c2', name:'Dev Kumar',      avatar:'gradient-3', initials:'DK', status:'away',    about:'Always coding ☕' },
    { uid:'c3', name:'Priya Nair',     avatar:'gradient-4', initials:'PN', status:'online',  about:'Design is thinking made visual' },
    { uid:'c4', name:'Rohan Mehta',    avatar:'gradient-5', initials:'RM', status:'offline', about:'Weekend warrior 🏋️' },
    { uid:'c5', name:'Sara Thomas',    avatar:'gradient-6', initials:'ST', status:'busy',    about:'In a meeting 🎯' },
    { uid:'c6', name:'Arjun Pillai',   avatar:'gradient-1', initials:'AP', status:'online',  about:'Ship it! 🛸' },
  ];

  const now = Date.now();
  App.chats = [
    { id:'ch1', type:'personal', uid:'c1', name:'Aisha Rahman',    avatar:'gradient-2', initials:'AR', lastMsg:'Sounds good! Let me check that.', lastTime: now - 3*60000,  unread:2,  pinned:true,  muted:false },
    { id:'ch2', type:'group',    name:'Design Team 🎨',             avatar:'gradient-3', initials:'DT', lastMsg:'Priya: Updated the Figma file ✅', lastTime: now - 15*60000, unread:5,  pinned:false, muted:false },
    { id:'ch3', type:'personal', uid:'c2', name:'Dev Kumar',        avatar:'gradient-3', initials:'DK', lastMsg:'The build is passing now 🎉',       lastTime: now - 1*3600000, unread:0,  pinned:false, muted:false },
    { id:'ch4', type:'group',    name:'Project Alpha 🚀',            avatar:'gradient-5', initials:'PA', lastMsg:'Meeting at 4pm today',              lastTime: now - 2*3600000, unread:0,  pinned:false, muted:true  },
    { id:'ch5', type:'personal', uid:'c3', name:'Priya Nair',       avatar:'gradient-4', initials:'PN', lastMsg:'Loved the new design direction!',   lastTime: now - 1*86400000,unread:0,  pinned:false, muted:false },
    { id:'ch6', type:'personal', uid:'c4', name:'Rohan Mehta',      avatar:'gradient-5', initials:'RM', lastMsg:'See you tomorrow 👋',               lastTime: now - 2*86400000,unread:0,  pinned:false, muted:false },
    { id:'ch7', type:'group',    name:'Team Standup 📋',             avatar:'gradient-6', initials:'TS', lastMsg:'Done for today!',                   lastTime: now - 3*86400000,unread:0,  pinned:false, muted:false },
  ];

  App.messages['ch1'] = [
    { id:'m1', from:'c1', text:'Hey! How is the redesign going?', time: now - 20*60000, status:'read' },
    { id:'m2', from:'me', text:'Really well! Just finished the design system.', time: now - 18*60000, status:'read' },
    { id:'m3', from:'c1', text:'That was fast 🔥 Can I see a preview?', time: now - 15*60000, status:'read' },
    { id:'m4', from:'me', text:'Sure! Here is the link to the Figma file.', time: now - 12*60000, status:'read' },
    { id:'m5', from:'c1', text:'Looks amazing! Love the indigo accent color.', time: now - 8*60000, status:'read', reactions:[{emoji:'❤️',count:1,mine:true}] },
    { id:'m6', from:'me', text:'Thanks! I was going for a premium, 2026-era feel — clean but with character.', time: now - 6*60000, status:'read' },
    { id:'m7', from:'c1', text:'You nailed it. When will it be live?', time: now - 4*60000, status:'read' },
    { id:'m8', from:'c1', text:'Sounds good! Let me check that.', time: now - 3*60000, status:'delivered' },
  ];
}

/* ══════════════════════════════════════════════════
   5. PROFILE & USER
══════════════════════════════════════════════════ */
async function loadUserProfile(user) {
  try {
    if (App.db) {
      const doc = await App.db.collection('users').doc(user.uid).get();
      if (doc.exists) Object.assign(App.currentUser, doc.data());
    }
  } catch(e) { /* offline */ }
}

function updateProfileUI() {
  const u = App.currentUser;
  const name = u.displayName || 'User';
  const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

  // Sidebar avatar
  const sa = document.getElementById('sidebar-avatar');
  if (sa) { sa.textContent = initials; }

  // Profile modal
  const pa = document.getElementById('profile-avatar');
  if (pa) {
    if (u.photoURL) { pa.innerHTML = `<img src="${u.photoURL}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`; }
    else pa.textContent = initials;
  }
  setEl('profile-name', name);
  setEl('profile-email', u.email || '');
  setEl('settings-name', name);
  setEl('settings-username', u.username ? '@'+u.username : '@not set');
  setEl('settings-phone', u.phone || 'Not set');
  setEl('settings-status', u.statusText || 'Available');
}

/* ══════════════════════════════════════════════════
   6. THEME
══════════════════════════════════════════════════ */
function applyTheme(mode) {
  App.theme = mode;
  const html = document.documentElement;
  if (mode === 'dark') {
    html.setAttribute('data-theme','dark');
  } else if (mode === 'light') {
    html.setAttribute('data-theme','light');
  } else {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
  localStorage.setItem('tc_theme', mode);
  updateThemeUI();
}

function cycleTheme() {
  const modes = ['system','light','dark'];
  const next = modes[(modes.indexOf(App.theme)+1) % modes.length];
  applyTheme(next);
}

function updateThemeUI() {
  const labels = { system:'System', light:'Light', dark:'Dark' };
  const icons  = { system:'brightness_auto', light:'light_mode', dark:'dark_mode' };
  setEl('theme-label', labels[App.theme] || 'System');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = icons[App.theme] || 'brightness_auto';
}

/* ══════════════════════════════════════════════════
   7. TAB SYSTEM
══════════════════════════════════════════════════ */
function switchTab(tab) {
  App.activeTab = tab;

  // Sidebar tabs
  qsa('.tab-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
    el.setAttribute('aria-selected', el.dataset.tab === tab);
  });

  // Bottom nav
  qsa('.bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
    el.setAttribute('aria-current', el.dataset.tab === tab ? 'page' : 'false');
  });

  renderChatList();
}

/* ══════════════════════════════════════════════════
   8. CHAT LIST RENDERING
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
  if (tab === 'status') { renderStatusTab(); return; }

  if (filter) {
    const q = filter.toLowerCase();
    items = items.filter(c => c.name.toLowerCase().includes(q) || (c.lastMsg||'').toLowerCase().includes(q));
  }

  if (!items.length) {
    list.innerHTML = '';
    show('chats-empty');
    return;
  }
  hide('chats-empty');

  // Sort: pinned first, then by time
  items.sort((a,b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.lastTime - a.lastTime;
  });

  // Group by pinned
  const pinned   = items.filter(c=>c.pinned);
  const unpinned = items.filter(c=>!c.pinned);

  let html = '';
  if (pinned.length) {
    html += `<div class="chat-list-section-title">Pinned</div>`;
    html += pinned.map(chatItemHTML).join('');
  }
  if (unpinned.length) {
    if (pinned.length) html += `<div class="chat-list-section-title">All Chats</div>`;
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
    ? `<div class="unread-badge${chat.muted?' muted':''}">${chat.unread > 99 ? '99+' : chat.unread}</div>` : '';
  const muteIcon  = chat.muted  ? `<span class="chat-mute-icon material-symbols-rounded" style="font-size:13px">notifications_off</span>` : '';
  const pinIcon   = chat.pinned ? `<span class="chat-pin-icon material-symbols-rounded" style="font-size:13px">push_pin</span>` : '';

  // Resolve display properties dynamically from App.contacts
  let name = chat.name;
  let avatar = chat.avatar;
  let initials = chat.initials;
  let photoURL = chat.photoURL;
  let status = chat.status;

  if (chat.type === 'personal' && chat.id !== `saved_${App.currentUser?.uid}`) {
    const contact = App.contacts.find(c => c.uid === chat.uid);
    if (contact) {
      name = contact.name;
      avatar = contact.avatar;
      initials = contact.initials;
      photoURL = contact.photoURL;
      status = contact.status;
    }
  }

  const statusDot = chat.type === 'personal' && status
    ? `<div class="avatar-status ${status || 'offline'}"></div>` : '';

  const avatarHtml = photoURL
    ? `<div class="avatar-img sz-44" style="border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--surface-3)"><img src="${photoURL}" alt="${escHtml(name)}" style="width:100%;height:100%;object-fit:cover"></div>`
    : `<div class="avatar-img sz-44 ${avatar || 'gradient-1'}" style="border-radius:50%;font-size:16px">${initials}</div>`;

  return `
  <div class="chat-item${isActive?' active':''}${chat.unread?' unread':''}"
       onclick="openChat('${chat.id}')"
       oncontextmenu="chatContextMenu(event,'${chat.id}')"
       role="listitem"
       tabindex="0"
       aria-label="${name}, ${chat.unread?chat.unread+' unread messages,':''} last message: ${chat.lastMsg||''}"
       onkeydown="if(event.key==='Enter')openChat('${chat.id}')">
    <div class="avatar">
      ${avatarHtml}
      ${statusDot}
    </div>
    <div class="chat-body">
      <div class="chat-name-row">
        <span class="chat-name">${escHtml(name)}</span>
        <span class="chat-time">${timeStr}</span>
      </div>
      <div class="chat-preview-row">
        <span class="chat-preview">${escHtml(chat.lastMsg||'')}</span>
        <div class="chat-meta-icons">
          ${pinIcon}${muteIcon}${unreadBadge}
        </div>
      </div>
    </div>
  </div>`;
}

function renderCallsTab() {
  const list = document.getElementById('chat-list');
  list.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📞</div>
      <div class="empty-title">No recent calls</div>
      <p class="empty-sub">Start a voice or video call from any chat.</p>
    </div>`;
}

function renderMoreTab() {
  const list = document.getElementById('chat-list');
  list.innerHTML = `
    <div style="padding:var(--sp-3) var(--sp-2)">
      ${moreRow('star','Starred Messages','openStarred()')}
      ${moreRow('bookmark','Bookmarks','openBookmarks()')}
      ${moreRow('schedule','Scheduled Messages','openScheduled()')}
      ${moreRow('quick_reply','Quick Replies','openQuickReplies()')}
      ${moreRow('folder','Chat Folders','openChatFolders()')}
      ${moreRow('campaign','Broadcasts','openBroadcasts()')}
      ${moreRow('hub','Communities','openCommunities()')}
      ${moreRow('notifications','Keyword Alerts','openKeywordAlerts()')}
      ${moreRow('insights','Chat Insights','goToInsights()')}
      ${moreRow('receipt_long','Expenses','goToExpenses()')}
      ${moreRow('photo_library','Media Album','goToAlbum()')}
      ${moreRow('calendar_month','Calendar','goToCalendar()')}
    </div>`;
}

function renderStatusTab() {
  const list = document.getElementById('chat-list');
  list.innerHTML = `
    <div style="padding:var(--sp-4)">
      <div class="settings-row" style="border-radius:var(--r-lg);background:var(--surface-2);margin-bottom:var(--sp-3)" onclick="openAddStatus()">
        <div class="avatar" style="position:relative">
          <div class="avatar-img sz-44 gradient-1" style="border-radius:50%;font-size:16px">U</div>
          <div class="status-add-btn" style="bottom:-2px;right:-2px">+</div>
        </div>
        <div class="settings-row-text">
          <div class="settings-row-label">Add Status</div>
          <div class="settings-row-sub">Share what's on your mind</div>
        </div>
      </div>
      <div class="empty-state" style="padding:var(--sp-8) var(--sp-4)">
        <div class="empty-icon" style="font-size:28px;width:64px;height:64px">🔵</div>
        <div class="empty-sub">Recent status updates from your contacts will appear here.</div>
      </div>
    </div>`;
}

function moreRow(icon, label, action) {
  return `<div class="settings-row" style="border-radius:var(--r-md)" onclick="${action}">
    <span class="material-symbols-rounded" style="color:var(--accent)">${icon}</span>
    <div class="settings-row-text"><div class="settings-row-label">${label}</div></div>
    <span class="material-symbols-rounded" style="color:var(--text-tertiary);font-size:18px">chevron_right</span>
  </div>`;
}

/* ══════════════════════════════════════════════════
   9. OPEN CHAT
══════════════════════════════════════════════════ */
function openChat(chatId) {
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) return;

  App.currentChat = chat;
  chat.unread = 0;

  // Update chat list selection
  qsa('.chat-item').forEach(el => el.classList.remove('active'));
  const el = document.querySelector(`.chat-item[onclick="openChat('${chatId}')"]`);
  if (el) el.classList.add('active');

  // Update header
  setEl('header-name', chat.name);
  const statusDot = document.getElementById('header-status-dot');
  if (chat.type==='group') {
    setEl('header-status', `${chat.memberCount||3} members`);
    if (statusDot) statusDot.style.display = 'none';
  } else {
    const contact = App.contacts.find(c=>c.uid===chat.uid);
    const statusText = contact?.status === 'online' ? 'Online' : contact?.about || 'Tap to view profile';
    const el2 = document.getElementById('header-status');
    if (el2) {
      el2.textContent = statusText;
      el2.className = 'chat-header-status' + (contact?.status==='online' ? ' online' : '');
    }
    if (statusDot) {
      statusDot.style.display = '';
      statusDot.className = `avatar-status ${contact?.status||'offline'}`;
    }
  }

  // Header avatar
  const ha = document.getElementById('header-avatar');
  if (ha) {
    if (chat.photoURL) {
      ha.innerHTML = `<img src="${chat.photoURL}" alt="${escHtml(chat.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      ha.innerHTML = chat.initials;
      ha.className = `avatar-img sz-40 ${chat.avatar || 'gradient-1'}`;
      ha.style.borderRadius='50%';
      ha.style.fontSize='14px';
    }
  }

  // On mobile: show chat area, hide sidebar
  if (window.innerWidth < 768) {
    document.getElementById('chat-area').classList.add('active');
    document.getElementById('sidebar').classList.add('hidden');
  }

  // Hide welcome, show messages
  hide('welcome-screen');
  const wrap = document.getElementById('messages-wrap');
  wrap.style.display = '';

  // Render messages
  if (App.db && App.auth?.currentUser) {
    subscribeToMessages(chatId);
  } else {
    renderMessages(chatId);
    scrollToBottom(true);
  }

  // Update chat list
  renderChatList();
}

/* ══════════════════════════════════════════════════
   10. MESSAGE RENDERING
══════════════════════════════════════════════════ */
function renderMessages(chatId) {
  const msgs = App.messages[chatId] || [];
  const wrap = document.getElementById('messages-wrap');

  if (!msgs.length) {
    wrap.innerHTML = `
      <div class="empty-state" style="flex:1;justify-content:flex-end;padding-bottom:var(--sp-8)">
        <div class="empty-icon" style="font-size:28px;width:64px;height:64px">👋</div>
        <div class="empty-title" style="font-size:var(--ts-base)">Start the conversation</div>
        <p class="empty-sub">Say hello!</p>
      </div>`;
    return;
  }

  let html = '';
  let lastDate = null;

  msgs.forEach((msg, i) => {
    const msgDate = new Date(msg.time);
    const dateKey = msgDate.toDateString();
    if (dateKey !== lastDate) {
      html += `<div class="date-sep"><span>${formatDateSep(msgDate)}</span></div>`;
      lastDate = dateKey;
    }

    const isMe = msg.from === 'me';
    const contact = isMe ? null : App.contacts.find(c=>c.uid===msg.from);
    const showAvatar = !isMe && (i === msgs.length-1 || msgs[i+1]?.from !== msg.from);
    const showSender = !isMe && App.currentChat?.type==='group';
    const senderName = contact?.name || 'Unknown';

    const avatarHTML = showAvatar
      ? (contact?.photoURL
        ? `<div class="avatar-img sz-40 msg-avatar" style="border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--surface-3)"><img src="${contact.photoURL}" alt="${escHtml(senderName)}" style="width:100%;height:100%;object-fit:cover"></div>`
        : `<div class="avatar-img sz-40 ${contact?.avatar||'gradient-1'} msg-avatar" style="border-radius:50%;font-size:13px;flex-shrink:0">${contact?.initials||'?'}</div>`)
      : `<div style="width:40px;flex-shrink:0"></div>`;

    const reactions = (msg.reactions||[]).map(r =>
      `<div class="reaction-pill${r.mine?' mine':''}" onclick="toggleReaction('${msg.id}','${r.emoji}')">
        <span>${r.emoji}</span><span class="reaction-count">${r.count}</span>
      </div>`
    ).join('');

    const tickIcon = isMe
      ? msg.status==='read'      ? '<span class="bubble-tick read material-symbols-rounded" style="font-size:14px;display:inline-block">done_all</span>'
      : msg.status==='delivered' ? '<span class="bubble-tick material-symbols-rounded" style="font-size:14px;display:inline-block">done_all</span>'
      :                            '<span class="bubble-tick material-symbols-rounded" style="font-size:14px;display:inline-block">done</span>'
      : '';

    const replyHTML = msg.replyTo ? `
      <div class="bubble-reply">
        <div class="bubble-reply-name">${escHtml(msg.replyTo.name)}</div>
        <div class="bubble-reply-text">${escHtml(msg.replyTo.text)}</div>
      </div>` : '';

    let contentHTML = '';
    if (msg.type === 'image') {
      contentHTML = `<div class="bubble-media" onclick="openMediaViewer('${msg.id}')">
        <img src="${msg.url}" alt="Image" loading="lazy">
        <div class="bubble-media-overlay"><div class="play-btn">🔍</div></div>
      </div>`;
    } else if (msg.type === 'voice') {
      contentHTML = `<div class="bubble-voice">
        <button class="voice-play" onclick="playVoice('${msg.id}')" aria-label="Play voice message">▶</button>
        <div class="voice-waveform">${generateWaveform()}</div>
        <span class="voice-duration">${msg.duration||'0:00'}</span>
      </div>`;
    } else if (msg.type === 'doc') {
      contentHTML = `<div class="bubble-doc" onclick="if('${msg.url}') window.open('${msg.url}', '_blank')" style="cursor:pointer">
        <div class="doc-icon">📄</div>
        <div class="doc-info"><div class="doc-name">${escHtml(msg.fileName||'Document')}</div><div class="doc-meta">${msg.fileSize||''}</div></div>
        <span class="material-symbols-rounded" style="font-size:20px;opacity:.7">download</span>
      </div>`;
    } else {
      contentHTML = `<div class="bubble-text">${formatMsgText(msg.text||'')}</div>`;
    }

    html += `
    <div class="msg-row ${isMe?'out':'in'}" id="msg-${msg.id}">
      ${!isMe ? avatarHTML : ''}
      <div style="max-width:min(70%,480px);display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'}">
        ${showSender&&!isMe ? `<div style="font-size:11px;color:var(--text-tertiary);font-weight:600;margin:0 var(--sp-1) 2px">${escHtml(senderName)}</div>` : ''}
        <div class="bubble" oncontextmenu="msgContextMenu(event,'${msg.id}')">
          ${replyHTML}
          <div class="bubble-actions">
            <span class="bubble-action-btn" onclick="openReactionPicker(event,'${msg.id}')" title="React">😊</span>
            <span class="bubble-action-btn" onclick="replyToMsg('${msg.id}')" title="Reply"><span class="material-symbols-rounded" style="font-size:16px">reply</span></span>
            <span class="bubble-action-btn" onclick="forwardMsg('${msg.id}')" title="Forward"><span class="material-symbols-rounded" style="font-size:16px">forward</span></span>
            <span class="bubble-action-btn" onclick="openMsgInfo('${msg.id}')" title="Info"><span class="material-symbols-rounded" style="font-size:16px">info</span></span>
            <span class="bubble-action-btn" onclick="msgContextMenu(event,'${msg.id}')" title="More"><span class="material-symbols-rounded" style="font-size:16px">more_horiz</span></span>
          </div>
          ${contentHTML}
          <div class="bubble-meta">
            <span class="bubble-time">${formatMsgTime(msg.time)}</span>
            ${tickIcon}
          </div>
        </div>
        ${reactions ? `<div class="bubble-reactions">${reactions}</div>` : ''}
      </div>
      ${isMe ? `<div style="width:4px;flex-shrink:0"></div>` : ''}
    </div>`;
  });

  wrap.innerHTML = html;
}

function generateWaveform() {
  return Array.from({length:20}, (_,i) => {
    const h = [30,50,70,45,85,60,40,75,55,90,35,65,80,50,70,40,60,85,45,55][i] || 50;
    return `<div class="voice-bar" style="height:${h}%"></div>`;
  }).join('');
}

function formatMsgText(text) {
  return escHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,.1);padding:1px 4px;border-radius:3px;font-family:monospace">$1</code>')
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;opacity:.8">$1</a>')
    .replace(/\n/g, '<br>');
}

/* ══════════════════════════════════════════════════
   11. SEND MESSAGE
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
    // Simulate delivered status
    setTimeout(() => { msg.status = 'delivered'; renderMessages(App.currentChat.id); }, 800);
    // Simulate read
    setTimeout(() => {
      msg.status = 'read';
      renderMessages(App.currentChat.id);
      simulateReply(msg.text);
    }, 2000);
  } else {
    // Save to Firebase (Real Database Schema)
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
      
      // Update direct chat or group metadata
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
  if (!App.currentChat || App.currentChat.type !== 'personal') return;
  const contact = App.contacts.find(c => c.uid === App.currentChat.uid);
  if (!contact) return;

  showTyping();
  setTimeout(() => {
    hideTyping();
    const replies = [
      'Got it! Thanks for the update 👍',
      'Interesting! Let me think about that.',
      'Sure, I will get back to you shortly.',
      'Sounds great! 🎉',
      'Makes sense. Moving forward then.',
      'Perfect, thank you! ✅',
    ];
    const reply = {
      id:   'msg_' + Date.now(),
      from: contact.uid,
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
  const av = document.getElementById('typing-avatar');
  if (!App.currentChat) return;
  const contact = App.contacts.find(c => c.uid === App.currentChat.uid);
  if (av && contact) { av.className=`avatar-img sz-40 ${contact.avatar}`; av.textContent=contact.initials; av.style.borderRadius='50%'; av.style.fontSize='13px'; }
  if (el) el.classList.remove('hidden');
  scrollToBottom(true);
}
function hideTyping() {
  hide('typing-indicator');
}

/* ══════════════════════════════════════════════════
   12. INPUT HANDLING
══════════════════════════════════════════════════ */
function onInputChange() {
  const input = document.getElementById('msg-input');
  // Auto-resize
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
  const isMobile = window.innerWidth < 768;
  const enterToSend = localStorage.getItem('tc_enterSend') !== 'false';
  if (e.key === 'Enter' && !e.shiftKey && !isMobile && enterToSend) {
    e.preventDefault();
    sendMessage();
  }
  if (e.key === 'ArrowUp' && document.getElementById('msg-input').value === '') {
    editLastMessage();
  }
}

function setupAutoResize() {
  // Already handled in onInputChange
}

/* ══════════════════════════════════════════════════
   13. REPLY
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
  closeContextMenu();
}

function cancelReply() {
  App.replyTo = null;
  hide('reply-preview');
}

/* ══════════════════════════════════════════════════
   14. RECORDING
══════════════════════════════════════════════════ */
function toggleRecording() {
  if (App.isRecording) stopRecording(); else startRecording();
}
function startRecording() {
  App.isRecording = true;
  App.recordingSeconds = 0;
  show('recording-bar');
  hide('input-bar');
  const btn = document.getElementById('mic-btn');
  if (btn) btn.classList.add('recording');
  App.recordingTimer = setInterval(() => {
    App.recordingSeconds++;
    setEl('rec-timer', formatDuration(App.recordingSeconds));
  }, 1000);
}
function stopRecording() {
  App.isRecording = false;
  clearInterval(App.recordingTimer);
  const btn = document.getElementById('mic-btn');
  if (btn) btn.classList.remove('recording');
}
function cancelRecording() {
  stopRecording();
  hide('recording-bar');
  show('input-bar');
}
function sendVoiceMessage() {
  stopRecording();
  hide('recording-bar');
  show('input-bar');
  if (!App.currentChat) return;
  const msg = {
    id:       'msg_' + Date.now(),
    from:     'me',
    type:     'voice',
    duration: formatDuration(App.recordingSeconds),
    time:     Date.now(),
    status:   'sending',
  };
  if (!App.messages[App.currentChat.id]) App.messages[App.currentChat.id] = [];
  App.messages[App.currentChat.id].push(msg);
  App.currentChat.lastMsg  = '🎤 Voice message';
  App.currentChat.lastTime = msg.time;
  renderMessages(App.currentChat.id);
  renderChatList();
  scrollToBottom(true);
  setTimeout(() => { msg.status='delivered'; renderMessages(App.currentChat.id); }, 800);
}

/* ══════════════════════════════════════════════════
   15. ATTACH / FILE
══════════════════════════════════════════════════ */
function toggleAttachMenu() {
  App.attachMenuOpen = !App.attachMenuOpen;
  const menu = document.getElementById('attach-menu');
  const btn  = document.getElementById('attach-btn');
  if (menu) menu.classList.toggle('hidden', !App.attachMenuOpen);
  if (btn)  btn.classList.toggle('open', App.attachMenuOpen);
  btn?.setAttribute('aria-expanded', App.attachMenuOpen);
}
function closeAttachMenu() {
  App.attachMenuOpen = false;
  hide('attach-menu');
  document.getElementById('attach-btn')?.classList.remove('open');
}
function attachPhoto()    { closeAttachMenu(); document.getElementById('file-input-photo')?.click(); }
function attachDocument() { closeAttachMenu(); document.getElementById('file-input-doc')?.click(); }
function attachCamera()   { closeAttachMenu(); showToast('Camera access requested.','info'); }
function attachContact()  { closeAttachMenu(); showToast('Contact sharing coming soon.','info'); }
function shareLocation()  { closeAttachMenu(); openLocationShare(); }

function handleFileInput(input, type) {
  if (!input.files.length || !App.currentChat) return;
  Array.from(input.files).forEach(file => {
    const isImg = file.type.startsWith('image/');
    const msg   = {
      id:       'msg_' + Date.now(),
      from:     'me',
      type:     isImg ? 'image' : 'doc',
      fileName: file.name,
      fileSize: formatBytes(file.size),
      time:     Date.now(),
      status:   'sending',
    };
    if (isImg) {
      const reader = new FileReader();
      reader.onload = e => {
        msg.url = e.target.result;
        App.messages[App.currentChat.id].push(msg);
        App.currentChat.lastMsg  = isImg ? '📷 Photo' : `📄 ${file.name}`;
        App.currentChat.lastTime = msg.time;
        renderMessages(App.currentChat.id);
        renderChatList();
        scrollToBottom(true);
      };
      reader.readAsDataURL(file);
    } else {
      App.messages[App.currentChat.id].push(msg);
      App.currentChat.lastMsg  = `📄 ${file.name}`;
      App.currentChat.lastTime = msg.time;
      renderMessages(App.currentChat.id);
      renderChatList();
      scrollToBottom(true);
    }
  });
  input.value = '';
}

function handleAvatarInput(input) {
  if (!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    const avEl = document.getElementById('profile-avatar');
    if (avEl) avEl.innerHTML = `<img src="${url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    showToast('Avatar updated!','success');
    if (App.currentUser) App.currentUser.photoURL = url;
  };
  reader.readAsDataURL(input.files[0]);
  input.value = '';
}

/* ══════════════════════════════════════════════════
   16. EMOJI PICKER
══════════════════════════════════════════════════ */
function toggleEmojiPicker() {
  App.emojiPickerOpen = !App.emojiPickerOpen;
  const picker = document.getElementById('emoji-picker');
  if (picker) picker.classList.toggle('hidden', !App.emojiPickerOpen);
}
function closeEmojiPicker() {
  App.emojiPickerOpen = false;
  hide('emoji-picker');
}
function setEmojiCat(btn, cat) {
  qsa('.emoji-cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadEmojiGrid(cat);
}
function loadEmojiGrid(cat) {
  const grid = document.getElementById('emoji-grid');
  if (!grid) return;
  const emojis = App.emojiCategories[cat] || App.emojiCategories.smileys;
  grid.innerHTML = emojis.map(e =>
    `<div class="emoji-item" onclick="insertEmoji('${e}')" role="button" aria-label="${e}" tabindex="0">${e}</div>`
  ).join('');
}
function insertEmoji(emoji) {
  const input = document.getElementById('msg-input');
  if (!input) return;
  const pos   = input.selectionStart;
  const val   = input.value;
  input.value = val.slice(0,pos) + emoji + val.slice(pos);
  input.selectionStart = input.selectionEnd = pos + emoji.length;
  input.focus();
  toggleSendMic();
  closeEmojiPicker();
}

/* ══════════════════════════════════════════════════
   17. REACTIONS
══════════════════════════════════════════════════ */
function openReactionPicker(event, msgId) {
  event.stopPropagation();
  closeContextMenu();
  const emojis = ['❤️','👍','😂','😮','😢','🙏','🔥','✨'];
  const rect   = event.target.getBoundingClientRect();

  // Remove existing
  document.querySelectorAll('.reaction-picker').forEach(el=>el.remove());

  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  picker.id = 'reaction-picker';
  picker.innerHTML = emojis.map(e =>
    `<div class="reaction-pick-btn" onclick="toggleReaction('${msgId}','${e}')" title="${e}" role="button" tabindex="0">${e}</div>`
  ).join('');
  picker.style.position = 'fixed';
  picker.style.top  = (rect.top - 60) + 'px';
  picker.style.left = Math.max(8, rect.left - 80) + 'px';
  document.body.appendChild(picker);
}

function toggleReaction(msgId, emoji) {
  const msgs = App.messages[App.currentChat?.id] || [];
  const msg  = msgs.find(m=>m.id===msgId);
  if (!msg) return;
  if (!msg.reactions) msg.reactions = [];
  const existing = msg.reactions.find(r=>r.emoji===emoji);
  if (existing) {
    if (existing.mine) {
      existing.count--;
      existing.mine = false;
      if (existing.count <= 0) msg.reactions = msg.reactions.filter(r=>r.emoji!==emoji);
    } else { existing.count++; existing.mine=true; }
  } else {
    msg.reactions.push({emoji, count:1, mine:true});
  }
  renderMessages(App.currentChat.id);
  document.querySelectorAll('.reaction-picker').forEach(el=>el.remove());
}

/* ══════════════════════════════════════════════════
   18. CONTEXT MENUS
══════════════════════════════════════════════════ */
function chatContextMenu(event, chatId) {
  event.preventDefault();
  const chat = App.chats.find(c=>c.id===chatId);
  if (!chat) return;
  showContextMenu(event, [
    { label:'Open chat',    icon:'open_in_new',   action:()=>openChat(chatId) },
    { label: chat.pinned?'Unpin':'Pin', icon:'push_pin', action:()=>togglePin(chatId) },
    { label: chat.muted?'Unmute':'Mute',icon:'notifications_off', action:()=>toggleMute(chatId) },
    { label:'Archive',      icon:'archive',       action:()=>archiveChat(chatId) },
    { label:'Mark as read', icon:'mark_chat_read',action:()=>markRead(chatId) },
    { sep: true },
    { label:'Clear chat',   icon:'delete_sweep',  action:()=>confirmClearChat(chatId), danger:true },
    { label:'Delete chat',  icon:'delete',        action:()=>confirmDeleteChat(chatId), danger:true },
  ]);
}

function msgContextMenu(event, msgId) {
  event.preventDefault();
  showContextMenu(event, [
    { label:'Reply',        icon:'reply',         action:()=>replyToMsg(msgId) },
    { label:'React',        icon:'emoji_emotions',action:()=>openReactionPicker(event,msgId) },
    { label:'Forward',      icon:'forward',       action:()=>forwardMsg(msgId) },
    { label:'Copy text',    icon:'content_copy',  action:()=>copyMsgText(msgId) },
    { label:'Star message', icon:'star',          action:()=>starMsg(msgId) },
    { label:'Message info', icon:'info',          action:()=>openMsgInfo(msgId) },
    { sep: true },
    { label:'Delete',       icon:'delete',        action:()=>deleteMsg(msgId), danger:true },
  ]);
}

function showContextMenu(event, items) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'ctx-menu';

  items.forEach(item => {
    if (item.sep) {
      menu.innerHTML += `<div class="ctx-sep"></div>`;
      return;
    }
    const el = document.createElement('div');
    el.className = `ctx-item${item.danger?' danger':''}`;
    el.innerHTML = `<span class="material-symbols-rounded" style="font-size:18px">${item.icon}</span>${escHtml(item.label)}`;
    el.addEventListener('click', () => { closeContextMenu(); item.action && item.action(); });
    menu.appendChild(el);
  });

  // Position
  let x = event.clientX, y = event.clientY;
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  if (x + rect.width  > window.innerWidth)  x = window.innerWidth  - rect.width  - 8;
  if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
}

function closeContextMenu() {
  document.getElementById('ctx-menu')?.remove();
  document.querySelectorAll('.reaction-picker').forEach(el=>el.remove());
}

function openChatMenu(btn) {
  const rect = btn.getBoundingClientRect();
  showContextMenu({ clientX: rect.left, clientY: rect.bottom }, [
    { label:'Chat info',        icon:'info',          action:openChatInfo },
    { label:'Search in chat',   icon:'search',        action:openChatSearch },
    { label:'Media, links, docs',icon:'photo_library',action:openSharedMedia },
    { label:'Mute notifications',icon:'notifications_off',action:()=>toggleMute(App.currentChat?.id) },
    { label:'Wallpaper',        icon:'wallpaper',     action:openWallpaper },
    { label:'Export chat',      icon:'file_download', action:exportCurrentChat },
    { label:'Add shortcut',     icon:'bookmark_add',  action:addShortcut },
    { sep: true },
    { label:'Clear messages',   icon:'delete_sweep',  action:()=>confirmClearChat(App.currentChat?.id), danger:true },
    { label:'Delete chat',      icon:'delete',        action:()=>confirmDeleteChat(App.currentChat?.id), danger:true },
  ]);
}

/* ══════════════════════════════════════════════════
   19. MESSAGE ACTIONS
══════════════════════════════════════════════════ */
function copyMsgText(msgId) {
  const msgs = App.messages[App.currentChat?.id] || [];
  const msg  = msgs.find(m=>m.id===msgId);
  if (!msg?.text) return;
  navigator.clipboard.writeText(msg.text).then(() => showToast('Copied to clipboard','success'));
}
function starMsg(msgId)   { showToast('Message starred ⭐','success'); }
function forwardMsg(msgId){ showToast('Forward: select a chat','info'); }
function deleteMsg(msgId) {
  if (!App.currentChat) return;
  App.messages[App.currentChat.id] = (App.messages[App.currentChat.id]||[]).filter(m=>m.id!==msgId);
  renderMessages(App.currentChat.id);
  showToast('Message deleted','info');
}
function editLastMessage() {
  const msgs = App.messages[App.currentChat?.id]||[];
  const last = [...msgs].reverse().find(m=>m.from==='me');
  if (!last) return;
  const input = document.getElementById('msg-input');
  if (input) { input.value=last.text||''; input.focus(); toggleSendMic(); }
}
function openMsgInfo(msgId) {
  show('msg-info-overlay');
  const msgs = App.messages[App.currentChat?.id]||[];
  const msg  = msgs.find(m=>m.id===msgId);
  const body = document.getElementById('msg-info-body');
  if (!body || !msg) return;
  body.innerHTML = `
    <div style="background:var(--surface-3);border-radius:var(--r-md);padding:var(--sp-4);margin-bottom:var(--sp-4)">
      <div class="bubble-text" style="color:var(--text-primary)">${formatMsgText(msg.text||'')}</div>
    </div>
    <div class="info-row">
      <span class="material-symbols-rounded info-row-icon">schedule</span>
      <div class="info-row-content">
        <div class="info-row-label">Sent</div>
        <div class="info-row-value">${new Date(msg.time).toLocaleString()}</div>
      </div>
    </div>
    <div class="info-row">
      <span class="material-symbols-rounded info-row-icon">done_all</span>
      <div class="info-row-content">
        <div class="info-row-label">Status</div>
        <div class="info-row-value">${msg.status||'sent'}</div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════
   20. FORMAT BAR
══════════════════════════════════════════════════ */
function toggleFormatBar() {
  App.formatBarOpen = !App.formatBarOpen;
  document.getElementById('format-bar')?.classList.toggle('hidden', !App.formatBarOpen);
}
function hideFormatBar() { App.formatBarOpen=false; hide('format-bar'); }
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

/* ══════════════════════════════════════════════════
   21. CALLS
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
  if (av) { av.className=`avatar-img sz-112 ${chat.avatar}`; av.textContent=chat.initials; av.style.borderRadius='50%'; av.style.fontSize='44px'; }

  const camIcon = document.getElementById('cam-icon');
  if (camIcon) camIcon.textContent = type==='video' ? 'videocam' : 'videocam_off';

  show('call-screen');
  showToast(`${type==='video'?'Video':'Voice'} calling ${chat.name}…`,'info');

  // Simulate connection
  setTimeout(() => {
    setEl('call-status','');
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
  showToast('Call ended','info');
}

function toggleMute() {
  App.callMuted = !App.callMuted;
  const btn  = document.getElementById('btn-mute');
  const icon = document.getElementById('mute-icon');
  if (btn)  btn.className  = `call-btn ${App.callMuted?'muted':'unmuted'}`;
  if (icon) icon.textContent = App.callMuted ? 'mic_off' : 'mic';
  btn?.setAttribute('aria-pressed', App.callMuted);
}
function toggleCamera() {
  App.cameraOff = !App.cameraOff;
  const icon = document.getElementById('cam-icon');
  if (icon) icon.textContent = App.cameraOff ? 'videocam_off' : 'videocam';
}
function toggleSpeaker() { showToast('Speaker toggled','info'); }
function minimizeCall()  { hide('call-screen'); showToast('Call active — tap to return','info'); }
function showCallParticipants() { showToast('No other participants yet','info'); }
function acceptCall()  { closeModal('incoming-call-overlay'); beginCall('voice'); }
function declineCall() { closeModal('incoming-call-overlay'); showToast('Call declined','info'); }

/* ══════════════════════════════════════════════════
   22. SEARCH
══════════════════════════════════════════════════ */
function openSearch()  { show('search-overlay'); document.getElementById('global-search-input')?.focus(); }
function closeSearchOverlay() { hide('search-overlay'); }
function setSearchFilter(btn, filter) {
  App.searchFilter = filter;
  qsa('.search-filter-chip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  performSearch(document.getElementById('global-search-input')?.value||'');
}
function performSearch(query) {
  const results = document.getElementById('search-results');
  if (!results) return;
  if (!query.trim()) {
    results.innerHTML = `<div class="empty-state"><div class="empty-icon" style="font-size:28px;width:64px;height:64px">🔍</div><div class="empty-sub">Type to search</div></div>`;
    return;
  }
  const q = query.toLowerCase();
  let found = [];
  App.chats.forEach(chat => {
    const msgs = App.messages[chat.id]||[];
    msgs.forEach(msg => {
      if ((msg.text||'').toLowerCase().includes(q)) {
        found.push({chat, msg});
      }
    });
  });
  if (!found.length) {
    results.innerHTML = `<div class="empty-state"><div class="empty-icon" style="font-size:28px;width:64px;height:64px">😔</div><div class="empty-sub">No results for "<strong>${escHtml(query)}</strong>"</div></div>`;
    return;
  }
  results.innerHTML = found.map(({chat,msg}) => `
    <div class="search-result-item" onclick="openChat('${chat.id}');closeSearchOverlay()">
      <div class="avatar-img sz-40 ${chat.avatar}" style="border-radius:50%;font-size:13px;flex-shrink:0">${chat.initials}</div>
      <div class="search-result-text">
        <div class="search-result-name">${escHtml(chat.name)}</div>
        <div class="search-result-preview">${highlightMatch(msg.text||'',q)}</div>
      </div>
      <div class="search-result-meta">${formatChatTime(msg.time)}</div>
    </div>`).join('');
}
function highlightMatch(text, q) {
  const escaped = escHtml(text);
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return escaped.replace(re,'<mark>$1</mark>');
}
function filterChats(q) { renderChatList(q); }
function openChatSearch() { showToast('Search within chat — coming soon','info'); }

/* ══════════════════════════════════════════════════
   23. SCROLL
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
    if (atBottom) { App.unreadScrollCount=0; hide('scroll-badge'); }
  });
});

/* ══════════════════════════════════════════════════
   24. NAVIGATION
══════════════════════════════════════════════════ */
function backToList() {
  document.getElementById('chat-area').classList.remove('active');
  document.getElementById('sidebar').classList.remove('hidden');
  App.currentChat = null;
}
function showWelcome() {
  show('welcome-screen');
  const wrap = document.getElementById('messages-wrap');
  if (wrap) wrap.style.display = 'none';
}

function openChatInfo() {
  if (!App.currentChat) return;
  if (App.currentChat.type==='group') {
    openGroupInfo();
  } else {
    openContactInfo(App.currentChat.uid);
  }
}

function openContactInfo(uid) {
  const contact = App.contacts.find(c=>c.uid===uid) || {};
  const panel = document.getElementById('detail-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="panel-header">
      <button class="panel-back" onclick="closeDetailPanel()" aria-label="Close"><span class="material-symbols-rounded">close</span></button>
      <span class="panel-title">Contact Info</span>
      <button class="icon-btn" onclick="editContact('${uid}')" aria-label="Edit"><span class="material-symbols-rounded">edit</span></button>
    </div>
    <div style="overflow-y:auto;flex:1">
      <div class="profile-header">
        <div class="avatar-img sz-96 ${contact.avatar||'gradient-1'}" style="border-radius:50%;font-size:36px">${contact.initials||'?'}</div>
        <div class="profile-name">${escHtml(contact.name||'Unknown')}</div>
        <div class="profile-sub">${escHtml(contact.about||'')}</div>
        <div class="profile-status-badge">
          <span style="width:8px;height:8px;background:var(--${contact.status==='online'?'online':'offline'});border-radius:50%"></span>
          ${contact.status==='online'?'Online':'Offline'}
        </div>
      </div>
      <div class="profile-actions">
        <div class="profile-action" onclick="startVoiceCall()"><div class="profile-action-icon"><span class="material-symbols-rounded">call</span></div><span class="profile-action-label">Call</span></div>
        <div class="profile-action" onclick="startVideoCall()"><div class="profile-action-icon"><span class="material-symbols-rounded">videocam</span></div><span class="profile-action-label">Video</span></div>
        <div class="profile-action" onclick="openSharedMedia()"><div class="profile-action-icon"><span class="material-symbols-rounded">photo_library</span></div><span class="profile-action-label">Media</span></div>
        <div class="profile-action" onclick="searchInChat()"><div class="profile-action-icon"><span class="material-symbols-rounded">search</span></div><span class="profile-action-label">Search</span></div>
      </div>
      <div class="info-section">
        <div class="info-section-title">Chat Settings</div>
        <div class="settings-row" onclick="toggleMute(App.currentChat?.id)">
          <span class="material-symbols-rounded" style="color:var(--text-tertiary)">notifications_off</span>
          <div class="settings-row-text"><div class="settings-row-label">Mute Notifications</div></div>
          <div class="settings-row-right"><span class="material-symbols-rounded">chevron_right</span></div>
        </div>
        <div class="settings-row" onclick="openWallpaper()">
          <span class="material-symbols-rounded" style="color:var(--text-tertiary)">wallpaper</span>
          <div class="settings-row-text"><div class="settings-row-label">Chat Wallpaper</div></div>
          <div class="settings-row-right"><span class="material-symbols-rounded">chevron_right</span></div>
        </div>
      </div>
      <div class="info-section">
        <div class="info-section-title">Privacy</div>
        <div class="settings-row danger" onclick="blockContact('${uid}')">
          <span class="material-symbols-rounded" style="color:var(--error)">block</span>
          <div class="settings-row-text"><div class="settings-row-label" style="color:var(--error)">Block Contact</div></div>
        </div>
        <div class="settings-row danger" onclick="reportContact('${uid}')">
          <span class="material-symbols-rounded" style="color:var(--error)">flag</span>
          <div class="settings-row-text"><div class="settings-row-label" style="color:var(--error)">Report</div></div>
        </div>
      </div>
    </div>`;
  panel.classList.add('open');
}

function openGroupInfo() {
  const chat = App.currentChat;
  if (!chat) return;
  show('group-info-overlay');
  setEl('group-info-title', chat.name);
  const body = document.getElementById('group-info-body');
  if (!body) return;
  body.innerHTML = `
    <div class="profile-header">
      <div style="position:relative">
        <div class="avatar-img sz-96 ${chat.avatar}" style="border-radius:var(--r-xl);font-size:36px">${chat.initials}</div>
        <div style="position:absolute;bottom:4px;right:4px;background:var(--accent);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer">
          <span class="material-symbols-rounded" style="font-size:14px;color:white">photo_camera</span>
        </div>
      </div>
      <div class="profile-name">${escHtml(chat.name)}</div>
      <div class="profile-sub">Group · ${chat.memberCount||3} members</div>
    </div>
    <div class="info-section">
      <div class="info-section-title">Invite</div>
      <div class="settings-row" onclick="copyInviteLink()">
        <span class="material-symbols-rounded" style="color:var(--accent)">link</span>
        <div class="settings-row-text"><div class="settings-row-label">Copy Invite Link</div></div>
        <div class="settings-row-right"><span class="material-symbols-rounded">content_copy</span></div>
      </div>
    </div>
    <div class="info-section">
      <div class="info-section-title">Members</div>
      ${App.contacts.slice(0,3).map(c=>`
        <div class="member-row">
          <div class="avatar-img sz-44 ${c.avatar}" style="border-radius:50%;font-size:15px;flex-shrink:0">${c.initials}</div>
          <div class="member-info"><div class="member-name">${escHtml(c.name)}</div><div class="member-role">${c.status}</div></div>
          <span class="role-badge admin">Admin</span>
        </div>`).join('')}
      <div class="member-row" onclick="addGroupMember()">
        <div style="width:44px;height:44px;border-radius:50%;background:var(--accent-glow);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span class="material-symbols-rounded" style="color:var(--accent)">person_add</span>
        </div>
        <div class="member-info"><div class="member-name" style="color:var(--accent)">Add Member</div></div>
      </div>
    </div>
    <div class="info-section">
      <div class="info-section-title">Group Settings</div>
      ${groupSettingRow('notifications_off','Mute Notifications','toggleMute(App.currentChat?.id)')}
      ${groupSettingRow('wallpaper','Wallpaper','openWallpaper()')}
      ${groupSettingRow('admin_panel_settings','Group Permissions','openGroupPermissions()')}
      ${groupSettingRow('schedule','Disappearing Messages','openDisappearing()')}
    </div>
    <div class="info-section">
      <div class="settings-row danger" onclick="confirmLeaveGroup()">
        <span class="material-symbols-rounded" style="color:var(--error)">exit_to_app</span>
        <div class="settings-row-text"><div class="settings-row-label" style="color:var(--error)">Leave Group</div></div>
      </div>
      <div class="settings-row danger" onclick="confirmDeleteGroup()">
        <span class="material-symbols-rounded" style="color:var(--error)">delete</span>
        <div class="settings-row-text"><div class="settings-row-label" style="color:var(--error)">Delete Group</div></div>
      </div>
    </div>
    <div style="height:var(--sp-8)"></div>`;
}

function groupSettingRow(icon, label, action) {
  return `<div class="settings-row" onclick="${action}">
    <span class="material-symbols-rounded" style="color:var(--text-tertiary)">${icon}</span>
    <div class="settings-row-text"><div class="settings-row-label">${label}</div></div>
    <div class="settings-row-right"><span class="material-symbols-rounded">chevron_right</span></div>
  </div>`;
}

function closeDetailPanel() {
  const panel = document.getElementById('detail-panel');
  if (panel) panel.classList.remove('open');
}

/* ══════════════════════════════════════════════════
   25. NEW CHAT / GROUP
══════════════════════════════════════════════════ */
function openNewChat() {
  show('new-chat-overlay');
  renderContactList();
  setTimeout(()=>document.getElementById('contact-search')?.focus(),100);
}
function renderContactList() {
  const list = document.getElementById('contact-list');
  if (!list) return;
  if (!App.contacts.length) return;
  list.innerHTML = `<div class="contact-section-header">Contacts</div>` +
    App.contacts.map(c=>`
      <div class="contact-item" onclick="startChatWith('${c.uid}')">
        <div class="avatar">
          <div class="avatar-img sz-44 ${c.avatar}" style="border-radius:50%;font-size:15px">${c.initials}</div>
          <div class="avatar-status ${c.status}"></div>
        </div>
        <div>
          <div class="contact-name">${escHtml(c.name)}</div>
          <div class="contact-sub">${escHtml(c.about||c.status)}</div>
        </div>
      </div>`).join('');
}
function startChatWith(uid) {
  const contact = App.contacts.find(c=>c.uid===uid) || (uid === App.currentUser?.uid ? { name: 'Myself', avatar: 'gradient-1', initials: getInitials(App.currentUser.displayName || App.currentUser.email || 'Me'), photoURL: App.currentUser.photoURL || null } : null);
  if (!contact) return;
  closeModal('new-chat-overlay');
  
  const isOnline = App.db && App.auth?.currentUser;
  const chatId = isOnline 
    ? (uid === App.auth.currentUser.uid ? `saved_${uid}` : getDirectChatId(App.auth.currentUser.uid, uid)) 
    : `ch_${uid}`;
    
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
function openNewGroup() {
  closeModal('new-chat-overlay');
  showToast('Group creation — select members','info');
  // Full group creation flow would be implemented here
}
function joinGroup() {
  closeModal('new-chat-overlay');
  showToast('Enter an invite link to join a group','info');
}

/* ══════════════════════════════════════════════════
   26. CHAT ACTIONS
══════════════════════════════════════════════════ */
function togglePin(chatId) {
  const chat = App.chats.find(c=>c.id===chatId);
  if (chat) { chat.pinned=!chat.pinned; renderChatList(); showToast(chat.pinned?'Chat pinned':'Chat unpinned','info'); }
}
function archiveChat(chatId) {
  App.chats = App.chats.filter(c=>c.id!==chatId);
  renderChatList();
  showToast('Chat archived','info');
}
function markRead(chatId) {
  const chat = App.chats.find(c=>c.id===chatId);
  if (chat) { chat.unread=0; renderChatList(); }
}
function confirmClearChat(chatId) {
  showConfirm('Clear all messages in this chat? This cannot be undone.', () => {
    if (chatId) App.messages[chatId]=[];
    if (App.currentChat?.id===chatId) renderMessages(chatId);
    showToast('Chat cleared','info');
  });
}
function confirmDeleteChat(chatId) {
  showConfirm('Delete this chat? This cannot be undone.', () => {
    App.chats = App.chats.filter(c=>c.id!==chatId);
    if (App.currentChat?.id===chatId) { App.currentChat=null; showWelcome(); }
    renderChatList();
    showToast('Chat deleted','info');
  });
}
function confirmLeaveGroup()  { showConfirm('Leave this group?', ()=>{ App.chats=App.chats.filter(c=>c.id!==App.currentChat?.id); renderChatList(); showWelcome(); closeModal('group-info-overlay'); }); }
function confirmDeleteGroup() { showConfirm('Delete this group for everyone?', ()=>{ confirmDeleteChat(App.currentChat?.id); closeModal('group-info-overlay'); }); }
function blockContact(uid)    { showConfirm('Block this contact? They won\'t be able to message you.', ()=>showToast('Contact blocked','info')); }
function reportContact(uid)   { showConfirm('Report this contact?', ()=>showToast('Contact reported. Thank you.','info')); }
function copyInviteLink()     { navigator.clipboard.writeText('https://teamchat.app/join/'+Math.random().toString(36).slice(2)); showToast('Invite link copied!','success'); }
function addGroupMember()     { showToast('Select contacts to add','info'); }
function openGroupPermissions(){ showToast('Group permissions settings','info'); }
function openDisappearing()    { showToast('Disappearing messages settings','info'); }
function openSharedMedia()     { showToast('Shared media coming soon','info'); }
function openWallpaper()       { showToast('Wallpaper settings coming soon','info'); }
function exportCurrentChat()   { showToast('Preparing chat export…','info'); }
function addShortcut()         { showToast('Shortcut added to home screen','success'); }
function searchInChat()        { openChatSearch(); }
function openBookmarks()       { showToast('Bookmarked messages','info'); }
function openScheduled()       { showToast('Scheduled messages','info'); }
function openQuickReplies()    { showToast('Quick replies','info'); }
function openChatFolders()     { showToast('Chat folders','info'); }
function openBroadcasts()      { showToast('Broadcasts','info'); }
function openCommunities()     { showToast('Communities','info'); }
function openKeywordAlerts()   { showToast('Keyword alerts','info'); }
function openStarred()         { showToast('Starred messages','info'); }
function openLocationShare()   { showToast('Location sharing','info'); }
function openPollCreator()     { showToast('Create a poll','info'); }
function openEventCreator()    { showToast('Create an event','info'); }
function createList()          { showToast('Create a list','info'); }
function openQRScanner()       { showToast('QR/Barcode scanner','info'); }
function openStorageManager()  { showToast('Storage manager','info'); }
function openAISmartReplies()  { showToast('AI Smart Replies settings','info'); }
function openAutoDownload()    { showToast('Auto-download settings','info'); }
function openDataUsage()       { showToast('Data usage stats','info'); }
function exportBackup()        { showToast('Preparing full backup export…','info'); }
function importBackup()        { showToast('Select a JSON backup file to import','info'); }
function openPrivacySettings() { showToast('Privacy settings','info'); }
function openAppLock()         { showToast('App Lock (PIN)','info'); }
function openTwoStep()         { showToast('Two-step verification','info'); }
function openActiveSessions()  { showToast('Active sessions','info'); }
function openBlockedUsers()    { showToast('Blocked users','info'); }
function openNotificationSettings(){ showToast('Notification settings','info'); }
function openFontSettings()    { showToast('Font & text settings','info'); }
function openLanguageSettings(){ showToast('Language settings','info'); }
function openAddStatus()       { showToast('Add a status update','info'); }
function changeAvatar()        { document.getElementById('file-input-avatar')?.click(); }
function editName()            { showToast('Edit name','info'); }
function editUsername()        { showToast('Edit username','info'); }
function editPhone()           { showToast('Edit phone number','info'); }
function editStatus()          { showToast('Set your status','info'); }
function openSettings()        { /* already in profile modal */ }
function confirmClearAllChats(){ showConfirm('Clear ALL chats? This cannot be undone.', ()=>{ App.messages={}; renderChatList(); showToast('All chats cleared','info'); }); }
function confirmDeactivate()   { showConfirm('Deactivate your account? You can reactivate by logging in again.', ()=>signOut()); }
function signOut()             { if (App.usersUnsubscribe) App.usersUnsubscribe(); if (App.chatsUnsubscribe) App.chatsUnsubscribe(); if (App.groupsUnsubscribe) App.groupsUnsubscribe(); if (App.messagesUnsubscribe) App.messagesUnsubscribe(); if(App.auth) App.auth.signOut().then(()=>location.reload()); else location.reload(); }
function editContact()         { showToast('Edit contact','info'); }
function playVoice(id) {
  const msgs = App.messages[App.currentChat?.id] || [];
  const msg = msgs.find(m => m.id === id);
  if (msg && msg.url) {
    if (App.activeAudio && App.activeAudioId === id) {
      if (App.activeAudio.paused) {
        App.activeAudio.play();
        showToast('Playing voice message…', 'info');
      } else {
        App.activeAudio.pause();
        showToast('Paused voice message', 'info');
      }
      return;
    }
    
    if (App.activeAudio) {
      App.activeAudio.pause();
    }
    
    const audio = new Audio(msg.url);
    App.activeAudio = audio;
    App.activeAudioId = id;
    audio.play();
    showToast('Playing voice message…', 'info');
    
    audio.onended = () => {
      App.activeAudio = null;
      App.activeAudioId = null;
    };
  } else {
    showToast('Playing voice message…', 'info');
  }
}
function openMediaViewer(id) {
  const msgs = App.messages[App.currentChat?.id] || [];
  const msg = msgs.find(m => m.id === id);
  if (msg && msg.url) {
    const content = document.getElementById('media-viewer-content');
    if (content) {
      content.innerHTML = `<img src="${msg.url}" style="max-width:100%;max-height:80dvh;object-fit:contain">`;
      show('media-viewer');
    }
  } else {
    showToast('Opening media…', 'info');
  }
}
function closeMediaViewer()    { hide('media-viewer'); }
function nextMedia()           {}
function prevMedia()           {}
function downloadMedia()       { showToast('Download started','info'); }
function shareMedia()          { showToast('Share media','info'); }
function replyToMedia()        {}
function forwardMedia()        {}
function starMedia()           { showToast('Media starred ⭐','success'); }
function deleteMedia()         { showToast('Media deleted','info'); }
function addGroupMemberToCall(){ showToast('Add to call','info'); }
function goToInsights()        { window.location.href='insights.html'; }
function goToExpenses()        { window.location.href='expenses.html'; }
function goToAlbum()           { window.location.href='album.html'; }
function goToCalendar()        { window.location.href='calendar.html'; }

/* ══════════════════════════════════════════════════
   27. PROFILE MODAL
══════════════════════════════════════════════════ */
function openProfile() { show('profile-overlay'); }

/* ══════════════════════════════════════════════════
   28. MODAL UTILITIES
══════════════════════════════════════════════════ */
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
function closeModal(id) { hide(id); }
function closeOnBackdrop(event, id) { if(event.target.id===id) closeModal(id); }
function closeTopModal() {
  const open = document.querySelector('.overlay:not(.hidden), .call-screen:not(.hidden), .search-overlay:not(.hidden), .media-viewer:not(.hidden)');
  if (open) {
    if (open.id==='call-screen') return;
    open.classList.add('hidden');
  }
  closeContextMenu();
  closeAttachMenu();
  closeEmojiPicker();
}

function showConfirm(msg, action, danger=true) {
  setEl('confirm-msg', msg);
  const btn = document.getElementById('confirm-action-btn');
  if (btn) {
    btn.textContent = danger ? 'Delete' : 'Confirm';
    btn.className   = `btn ${danger?'btn-danger':'btn-primary'}`;
    btn.onclick     = () => { closeModal('confirm-overlay'); action && action(); };
  }
  show('confirm-overlay');
}

/* ══════════════════════════════════════════════════
   29. TOAST NOTIFICATIONS
══════════════════════════════════════════════════ */
function showToast(msg, type='info', duration=3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role','alert');
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]||'ℹ️'}</span>
    <span class="toast-text">${escHtml(msg)}</span>
    <button class="toast-close" onclick="removeToast(this.parentElement)" aria-label="Dismiss">
      <span class="material-symbols-rounded" style="font-size:16px">close</span>
    </button>`;
  container.appendChild(toast);
  setTimeout(() => removeToast(toast), duration);
}
function removeToast(el) {
  if (!el || !el.parentElement) return;
  el.classList.add('removing');
  setTimeout(() => el.remove(), 300);
}

/* ══════════════════════════════════════════════════
   30. KEYBOARD SHORTCUTS
══════════════════════════════════════════════════ */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const isInput = ['INPUT','TEXTAREA'].includes(document.activeElement.tagName);
    const ctrl    = e.ctrlKey || e.metaKey;

    if (ctrl && e.key==='k') { e.preventDefault(); openSearch(); }
    if (ctrl && e.key==='n') { e.preventDefault(); openNewChat(); }
    if (ctrl && e.key==='Enter' && isInput) { sendMessage(); }
    if (e.key==='?' && !isInput) { showKeyboardHelp(); }
    if (ctrl && e.shiftKey && e.key==='M') { e.preventDefault(); toggleMute(App.currentChat?.id); }
  });
}
function showKeyboardHelp() {
  const shortcuts = [
    ['Ctrl/⌘ + K','Search'],
    ['Ctrl/⌘ + N','New chat'],
    ['Ctrl/⌘ + Enter','Send message'],
    ['Ctrl/⌘ + Shift + M','Mute/unmute'],
    ['↑ (in empty input)','Edit last message'],
    ['Escape','Close modal'],
    ['?','Show shortcuts'],
  ];
  showToast('Shortcuts: Ctrl+K=Search, Ctrl+N=New chat, Ctrl+Enter=Send','info',4000);
}

/* ══════════════════════════════════════════════════
   31. ONLINE STATUS
══════════════════════════════════════════════════ */
function setupOnlineStatus() {
  const update = () => {
    const offline = !navigator.onLine;
    document.getElementById('offline-banner')?.classList.toggle('hidden', !offline);
  };
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}

/* ══════════════════════════════════════════════════
   32. DOCUMENT CLICK (close menus)
══════════════════════════════════════════════════ */
function handleDocumentClick(e) {
  // Close attach menu
  if (App.attachMenuOpen) {
    const menu = document.getElementById('attach-menu');
    const btn  = document.getElementById('attach-btn');
    if (menu && !menu.contains(e.target) && !btn?.contains(e.target)) closeAttachMenu();
  }
  // Close emoji picker
  if (App.emojiPickerOpen) {
    const picker = document.getElementById('emoji-picker');
    if (picker && !picker.contains(e.target) && !e.target.closest('.emoji-btn')) closeEmojiPicker();
  }
  // Close context menu
  if (!e.target.closest('.context-menu') && !e.target.closest('.reaction-picker')) closeContextMenu();
}

/* ══════════════════════════════════════════════════
   33. HELPERS
══════════════════════════════════════════════════ */
function qs(sel)    { return document.querySelector(sel); }
function qsa(sel)   { return document.querySelectorAll(sel); }
function setEl(id,v){ const el=document.getElementById(id); if(el)el.textContent=v; }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function updateBadge(id,n) {
  const el=document.getElementById(id);
  if(!el)return;
  if(n>0){ el.textContent=n>99?'99+':n; el.classList.remove('hidden'); }
  else el.classList.add('hidden');
}

function formatChatTime(ts) {
  if (!ts) return '';
  const d   = new Date(ts), now = new Date();
  const diff = now - d;
  if (diff < 60000)             return 'Just now';
  if (diff < 3600000)           return Math.floor(diff/60000) + 'm';
  if (d.toDateString()===now.toDateString()) return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate()-1);
  if (d.toDateString()===yesterday.toDateString()) return 'Yesterday';
  if (diff < 7*86400000)        return d.toLocaleDateString([],{weekday:'short'});
  return d.toLocaleDateString([],{day:'numeric',month:'short'});
}
function formatMsgTime(ts) {
  return new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}
function formatDateSep(d) {
  const now = new Date();
  if (d.toDateString()===now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(y.getDate()-1);
  if (d.toDateString()===y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([],{weekday:'long', day:'numeric', month:'long'});
}
function formatDuration(s) {
  const m = Math.floor(s/60);
  return m + ':' + String(s%60).padStart(2,'0');
}
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
