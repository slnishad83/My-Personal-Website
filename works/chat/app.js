// ========================================
// COMPLETE CHAT APP - All Features
// Emoji Picker, Stickers, Status, Profile Modal, Online Status
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
let currentFile = null;
let contextMessageId = null;
let allUsers = [];
let mobileMenuOpen = false;
let soundEnabled = true;
let typingTimeout = null;
let unreadCounts = {};
let inactivityTimer = null;
let currentOnlineStatus = 'online';
let currentUserStatusText = '';

// ========================================
// EMOJI DATA - Complete Set
// ========================================
const EMOJIS = {
  smileys: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
  people: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦿','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁️','👅','👄','💋','🩸','👶','🧒','👦','👧','🧑','👩','🧔','👨','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷','👨‍⚕️','👩‍⚕️','👨‍🎓','👩‍🎓','👨‍🏫','👩‍🏫','👨‍⚖️','👩‍⚖️','👨‍🌾','👩‍🌾','👨‍🍳','👩‍🍳','👨‍🔧','👩‍🔧','👨‍🏭','👩‍🏭','👨‍💼','👩‍💼','👨‍🔬','👩‍🔬','👨‍💻','👩‍💻','👨‍🎤','👩‍🎤','👨‍🎨','👩‍🎨','👨‍✈️','👩‍✈️','👨‍🚀','👩‍🚀','👨‍🚒','👩‍🚒','👮','💂','🥷','👷','🤴','👸','👳','👲','🧕','🤵','👰','🤰','🤱','👼','🎅','🤶','🧑‍🎄','🦸','🦹','🧙','🧚','🧛','🧜','🧝','🧞','🧟','💆','💇','🚶','🧑‍🦯','🧑‍🦼','🧑‍🦽','🏃','💃','🕺','🕴️','👯','🧖','🧗','🤺','🏌️','🏇','⛷️','🏂','🏄','🚣','🏊','🤽','🚴','🚵','🏋️','🤸','🤼','🤽','🤾','🤹','🧘','🛀','🛌','👨‍👩‍👧','👨‍👩‍👧‍👦','👨‍👨‍👧','👩‍👩‍👧','👨‍👦','👩‍👧','🗣️','👤','👥','🫂','👣'],
  animals: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🕸️','🦂','🦞','🐟','🐠','🐡','🦈','🐙','🦑','🐬','🐳','🐋','🐊','🐉','🦕','🦖','🐅','🐆','🐘','🦏','🦛','🦒','🐫','🐪','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🐈','🐓','🦃','🦚','🦜','🦢','🦩','🐇','🦔','🦡','🐁','🐀','🐿️','🦫','🦔','🐉','🐲','🌵','🎄','🌲','🌳','🌴','🌱','🌿','🍀','🎍','🎋','🍃','🍂','🍁','🍄','🐚','🌾','💐','🌸','🌷','🌹','🥀','🌺','🌻','🌼','🌽','🌶️','🍅','🍆','🍑','🍒','🍓','🥝','🍇','🥥','🥑','🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍈','🍒','🥭','🍍','🥬','🥦','🧄','🧅','🍠','🥕','🌽','🍆','🍅','🥒','🥗','🍲','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🥢','🍽️','🍴','🥄','🔪','🏺'],
  activities: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','🤺','⛹️','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🏊','🧗','🚵','🚴','🏍️','🛵','🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🛼','🚂','🚆','🚇','🚉','✈️','🛩️','🛫','🛬','🚁','🚤','🛥️','⛴️','🚢','⚓','🚀','🛸','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚊','🚉','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','✈️','🛩️','🛫','🛬','🪂','💺','🚀','🛸','🪐','🌠','🌌','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🌌','🎠','🎡','🎢','💈','🎪','🚂','🚃','🚄','🚅','🚇','🚉','🚊','🚈','🚞','🚋','🚟','🚠','🚡','🛸'],
  travel: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🛼','🚂','🚆','🚇','🚉','✈️','🛩️','🛫','🛬','🚁','🚤','🛥️','⛴️','🚢','⚓','🚀','🛸','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚊','🚉','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','✈️','🛩️','🛫','🛬','🪂','💺','🚀','🛸','🪐','🌠','🌌','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🌌','🎠','🎡','🎢','💈','🎪','🚂','🚃','🚄','🚅','🚇','🚉','🚊','🚈','🚞','🚋','🚟','🚠','🚡','🛸'],
  objects: ['💡','🔦','🏮','🪔','📔','📕','📖','📗','📘','📙','📚','📓','📒','📃','📜','📄','📰','🗞️','📑','🔖','🏷️','💰','💴','💵','💶','💷','💸','💳','🧾','💎','⚖️','🔧','🔨','⚒️','🛠️','⛏️','🔩','⚙️','🗜️','🧰','🔗','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','⚱️','🏺','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','💊','💉','🩸','🩹','🩺','🌡️','🧫','🧪','🌂','🧥','🥼','🦺','👚','👕','👖','🧣','🧤','🧥','🧦','👗','👘','🥻','🩱','🩲','🩳','👙','👔','👑','👒','🎩','🎓','🧢','⛑️','📿','💄','💍','💎','🔇','🔈','🔉','🔊','📢','📣','📯','🔔','🔕','🎵','🎶','🎙️','🎚️','🎛️','🎤','🎧','📻','🎷','🎸','🎹','🎺','🎻','🪕','🥁','📱','📲','☎️','📞','📟','📠','📺','📽️','🎬','📀','💿','📷','📸','📹','🎥','📽️','🎞️','📡','🔍','🔎','🕯️','💡','🔦','🏮','🪔','📔'],
  symbols: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💯','🔠','🔡','🔢','🔣','🔤','🅰️','🆎','🅱️','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼','🚻','🚮','🎦','📶','🈁','🔣','🔤','ℹ️','🔤','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔠','🔡','🔢','🔣','🔤'],
  flags: ['🏁','🚩','🎌','🏴','🏳️','🏴‍☠️','🇺🇳','🇦🇫','🇦🇽','🇦🇱','🇩🇿','🇦🇸','🇦🇩','🇦🇴','🇦🇮','🇦🇶','🇦🇬','🇦🇷','🇦🇲','🇦🇼','🇦🇺','🇦🇹','🇦🇿','🇧🇸','🇧🇭','🇧🇩','🇧🇧','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇲','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇮🇴','🇻🇬','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇰🇭','🇨🇲','🇨🇦','🇮🇨','🇨🇻','🇧🇶','🇰🇾','🇨🇫','🇹🇩','🇨🇱','🇨🇳','🇨🇽','🇨🇨','🇨🇴','🇰🇲','🇨🇬','🇨🇩','🇨🇰','🇨🇷','🇨🇮','🇭🇷','🇨🇺','🇨🇼','🇨🇾','🇨🇿','🇩🇰','🇩🇯','🇩🇲','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇪🇹','🇪🇺','🇫🇰','🇫🇴','🇫🇯','🇫🇮','🇫🇷','🇬🇫','🇵🇫','🇹🇫','🇬🇦','🇬🇲','🇬🇪','🇩🇪','🇬🇭','🇬🇮','🇬🇷','🇬🇱','🇬🇩','🇬🇵','🇬🇺','🇬🇹','🇬🇬','🇬🇳','🇬🇼','🇬🇾','🇭🇹','🇭🇲','🇭🇳','🇭🇰','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇲','🇮🇱','🇮🇹','🇯🇲','🇯🇵','🎌','🇯🇪','🇯🇴','🇰🇿','🇰🇪','🇰🇮','🇽🇰','🇰🇼','🇰🇬','🇱🇦','🇱🇻','🇱🇧','🇱🇸','🇱🇷','🇱🇾','🇱🇮','🇱🇹','🇱🇺','🇲🇴','🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱','🇲🇹','🇲🇭','🇲🇶','🇲🇷','🇲🇺','🇾🇹','🇲🇽','🇫🇲','🇲🇩','🇲🇨','🇲🇳','🇲🇪','🇲🇸','🇲🇦','🇲🇿','🇲🇲','🇳🇦','🇳🇷','🇳🇵','🇳🇱','🇳🇨','🇳🇿','🇳🇮','🇳🇪','🇳🇬','🇳🇺','🇳🇫','🇰🇵','🇲🇰','🇲🇵','🇳🇴','🇴🇲','🇵🇰','🇵🇼','🇵🇸','🇵🇦','🇵🇬','🇵🇾','🇵🇪','🇵🇭','🇵🇳','🇵🇱','🇵🇹','🇵🇷','🇶🇦','🇷🇪','🇷🇴','🇷🇺','🇷🇼','🇼🇸','🇸🇲','🇸🇹','🇸🇦','🇸🇳','🇷🇸','🇸🇨','🇸🇱','🇸🇬','🇸🇽','🇸🇰','🇸🇮','🇬🇸','🇸🇧','🇸🇴','🇿🇦','🇬🇸','🇰🇷','🇸🇸','🇪🇸','🇱🇰','🇧🇱','🇸🇭','🇰🇳','🇱🇨','🇵🇲','🇻🇨','🇸🇩','🇸🇷','🇸🇪','🇨🇭','🇸🇾','🇹🇼','🇹🇯','🇹🇿','🇹🇭','🇹🇱','🇹🇬','🇹🇰','🇹🇴','🇹🇹','🇹🇳','🇹🇷','🇹🇲','🇹🇨','🇹🇻','🇺🇬','🇺🇦','🇦🇪','🇬🇧','🇺🇸','🇻🇮','🇺🇾','🇺🇿','🇻🇺','🇻🇦','🇻🇪','🇻🇳','🇼🇫','🇪🇭','🇾🇪','🇿🇲','🇿🇼']
};

// ========================================
// STICKER PACKS
// ========================================
const STICKER_PACKS = {
  smiley: ['😊','😍','🥰','😘','😎','🤩','🥳','😇','🙂','😁','😂','🤣','😅','😆','😉','😋','😜','😝','🤪','🧐','🤓'],
  celebration: ['🎉','🎊','🎈','🎁','✨','🌟','⭐','💫','🎆','🎇','🪅','🎀','🏆','🥇','🥈','🥉','🏅','🎖️','💐','🥳'],
  love: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💖','💗','💓','💕','💞','💘','💝','💟','❣️','💌','💋'],
  sad: ['😢','😭','😥','😓','😪','😩','😫','🥺','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢'],
  angry: ['😠','😡','🤬','👿','💢','🗯️','😤','😒','🙄','🤨','🤔','🤬','💥','🔥','💣','👊','🤛','🤜','👎'],
  funny: ['😂','🤣','😆','😅','😹','🤪','😜','😝','🫠','🥴','🤡','🃏','🎭','🤣','😆','😅','😂','🥲','😭','🤣']
};

// ========================================
// Helper Functions
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

// ========================================
// Online Status Functions
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
  }, 5 * 60 * 1000); // 5 minutes
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
// Status Text (Bio) Functions
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
  
  // Show green ring for 24 hours
  const ring = document.getElementById('statusRing');
  if (ring) {
    ring.style.display = 'block';
    setTimeout(() => { ring.style.display = 'none'; }, 24 * 60 * 60 * 1000);
  }
}

// ========================================
// Avatar Functions
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
// Emoji Picker Functions
// ========================================
function renderEmojis(category = 'smileys', searchTerm = '') {
  const container = document.getElementById('emojiList');
  let emojis = EMOJIS[category] || EMOJIS.smileys;
  if (searchTerm) {
    emojis = emojis.filter(e => e === searchTerm || e.includes(searchTerm));
  }
  container.innerHTML = emojis.map(emoji => `<div class="emoji-item" data-emoji="${emoji}">${emoji}</div>`).join('');
  document.querySelectorAll('.emoji-item').forEach(el => {
    el.addEventListener('click', () => {
      const input = document.getElementById('messageInput');
      input.value += el.dataset.emoji;
      document.getElementById('emojiPickerModal').style.display = 'none';
    });
  });
}

function initEmojiPicker() {
  document.querySelectorAll('.emoji-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emoji-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderEmojis(btn.dataset.cat);
    });
  });
  document.getElementById('emojiSearch')?.addEventListener('input', (e) => {
    const activeCat = document.querySelector('.emoji-cat-btn.active').dataset.cat;
    renderEmojis(activeCat, e.target.value);
  });
  renderEmojis('smileys');
}

// ========================================
// Sticker Functions
// ========================================
function renderStickers(pack = 'smiley') {
  const container = document.getElementById('stickerList');
  const stickers = STICKER_PACKS[pack];
  container.innerHTML = stickers.map(sticker => `<div class="sticker-item" data-sticker="${sticker}">${sticker}</div>`).join('');
  document.querySelectorAll('.sticker-item').forEach(el => {
    el.addEventListener('click', async () => {
      await sendMessage('', { type: 'sticker', url: el.dataset.sticker, filename: 'sticker' });
      document.getElementById('stickerPickerModal').style.display = 'none';
    });
  });
}

function initStickerPicker() {
  document.querySelectorAll('.sticker-pack-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sticker-pack-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderStickers(btn.dataset.pack);
    });
  });
  renderStickers('smiley');
}

// ========================================
// Profile Modal Functions
// ========================================
async function showProfileModal(userId = null, viewOnly = true) {
  if (!userId && !currentUser) return;
  const targetUserId = userId || currentUser.uid;
  const isSelf = targetUserId === currentUser.uid;
  
  const userDoc = await db.collection('users').doc(targetUserId).get();
  if (!userDoc.exists) return;
  const userData = userDoc.data();
  
  if (isSelf) {
    document.getElementById('profileName').textContent = userData.displayName || currentUser.displayName;
    document.getElementById('profileEmail').textContent = userData.email || currentUser.email;
    document.getElementById('profileStatusText').textContent = userData.statusText || 'No status';
    document.getElementById('profileStatusText').style.cursor = 'pointer';
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
// Message Functions
// ========================================
async function sendMessage(text, attachment = null) {
  if (!currentChat || (!text?.trim() && !attachment)) return;
  resetInactivityTimer();
  try {
    const messageData = {
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email.split('@')[0],
      text: text?.trim() || '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      chatType: currentChatType,
      read: false
    };
    if (currentChatType === 'group') {
      messageData.groupId = currentChat.id;
    } else {
      messageData.directId = currentChat.id;
      messageData.participants = [currentUser.uid, currentChat.otherUserId];
    }
    if (attachment) messageData.attachment = attachment;
    await db.collection('messages').add(messageData);
    
    if (currentChatType === 'group') {
      await db.collection('groups').doc(currentChat.id).update({
        lastMessage: text?.trim() || (attachment?.type === 'sticker' ? '📌 Sticker' : '📎 File attached'),
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const chatId = getDirectChatId(currentUser.uid, currentChat.otherUserId);
      await db.collection('directChats').doc(chatId).set({
        participants: [currentUser.uid, currentChat.otherUserId],
        lastMessage: text?.trim() || (attachment?.type === 'sticker' ? '📌 Sticker' : '📎 File attached'),
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageSender: currentUser.uid
      }, { merge: true });
    }
    if (soundEnabled) playNotificationSound();
  } catch (error) {
    console.error('Send message error:', error);
  }
}

function playNotificationSound() {
  try {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,U3RlYWx0aCBzb3VuZA==';
    audio.play().catch(() => {});
  } catch(e) {}
}

async function deleteMessage(messageId) {
  if (!messageId) return;
  try {
    await db.collection('messages').doc(messageId).delete();
  } catch (error) {
    console.error('Delete message error:', error);
  }
}

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
// Typing Indicator
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
// Load Messages
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
        let content = '';
        if (message.attachment?.type === 'sticker') {
          content = `<div class="message-sticker">${message.attachment.url}</div>`;
        } else {
          let attachmentHtml = '';
          if (message.attachment) {
            if (message.attachment.type === 'image') {
              attachmentHtml = `<div class="message-attachment"><img src="${message.attachment.url}" class="message-image" onclick="window.open('${message.attachment.url}','_blank')"></div>`;
            } else {
              attachmentHtml = `<div class="message-attachment"><a href="${message.attachment.url}" target="_blank">📎 ${escapeHtml(message.attachment.filename)}</a></div>`;
            }
          }
          content = `
            <div class="message-text">${escapeHtml(message.text || '')}</div>
            ${attachmentHtml}
          `;
        }
        const readReceiptHtml = isMyMessage ? `<span class="read-receipt ${message.read ? 'read' : 'delivered'}">${message.read ? '✓✓' : '✓'}</span>` : '';
        messageDiv.innerHTML = `
          <div class="message-bubble" data-message-id="${doc.id}">
            ${!isMyMessage ? `<div class="message-sender">${escapeHtml(message.senderName)}</div>` : ''}
            ${content}
            <div class="message-footer">
              <span class="message-time">${message.timestamp ? formatTime(message.timestamp) : ''}</span>
              ${readReceiptHtml}
            </div>
          </div>
        `;
        if (isMyMessage) {
          const bubble = messageDiv.querySelector('.message-bubble');
          bubble.addEventListener('contextmenu', e => { e.preventDefault(); contextMessageId = doc.id; showContextMenu(e.clientX, e.clientY); });
          let pressTimer;
          bubble.addEventListener('touchstart', e => { pressTimer = setTimeout(() => { contextMessageId = doc.id; showContextMenu(e.touches[0].clientX, e.touches[0].clientY); }, 500); });
          bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
          bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));
        }
        messagesArea.appendChild(messageDiv);
      });
      messagesArea.scrollTop = messagesArea.scrollHeight;
      markMessagesAsRead(currentChat.id, false);
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
        const isMyMessage = message.senderId === currentUser.uid;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-wrapper ${isMyMessage ? 'my-message' : ''}`;
        let content = '';
        if (message.attachment?.type === 'sticker') {
          content = `<div class="message-sticker">${message.attachment.url}</div>`;
        } else {
          let attachmentHtml = '';
          if (message.attachment) {
            if (message.attachment.type === 'image') {
              attachmentHtml = `<div class="message-attachment"><img src="${message.attachment.url}" class="message-image" onclick="window.open('${message.attachment.url}','_blank')"></div>`;
            } else {
              attachmentHtml = `<div class="message-attachment"><a href="${message.attachment.url}" target="_blank">📎 ${escapeHtml(message.attachment.filename)}</a></div>`;
            }
          }
          content = `
            <div class="message-text">${escapeHtml(message.text || '')}</div>
            ${attachmentHtml}
          `;
        }
        messageDiv.innerHTML = `
          <div class="message-bubble" data-message-id="${doc.id}">
            ${!isMyMessage ? `<div class="message-sender">${escapeHtml(message.senderName)}</div>` : ''}
            ${content}
            <div class="message-footer">
              <span class="message-time">${message.timestamp ? formatTime(message.timestamp) : ''}</span>
            </div>
          </div>
        `;
        if (isMyMessage) {
          const bubble = messageDiv.querySelector('.message-bubble');
          bubble.addEventListener('contextmenu', e => { e.preventDefault(); contextMessageId = doc.id; showContextMenu(e.clientX, e.clientY); });
          let pressTimer;
          bubble.addEventListener('touchstart', e => { pressTimer = setTimeout(() => { contextMessageId = doc.id; showContextMenu(e.touches[0].clientX, e.touches[0].clientY); }, 500); });
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
// Context Menu
// ========================================
function showContextMenu(x, y) {
  const menu = document.getElementById('messageMenu');
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

// ========================================
// Load Users and Groups
// ========================================
async function loadAllUsers() {
  if (!currentUser) return;
  const usersList = document.getElementById('usersList');
  usersList.innerHTML = '<div class="loading">Loading users...</div>';
  try {
    const snapshot = await db.collection('users').get();
    allUsers = [];
    snapshot.forEach(doc => {
      if (doc.id !== currentUser.uid) {
        allUsers.push({ id: doc.id, ...doc.data() });
      }
    });
    if (allUsers.length === 0) {
      usersList.innerHTML = '<div class="empty-users"><div class="empty-icon">👥</div><p>No other users yet</p><small>Share this link with your team members!</small></div>';
      return;
    }
    renderUsersList(allUsers);
  } catch (error) {
    usersList.innerHTML = '<div class="empty-users"><div class="empty-icon">⚠️</div><p>Unable to load users</p></div>';
  }
}

function renderUsersList(users) {
  const usersList = document.getElementById('usersList');
  const searchTerm = document.getElementById('searchUsers')?.value.toLowerCase() || '';
  const filtered = users.filter(user => (user.displayName || user.email || '').toLowerCase().includes(searchTerm));
  if (filtered.length === 0) {
    usersList.innerHTML = '<div class="loading">No matching users found</div>';
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
      </div>
      ${unreadCounts[user.id] ? `<div class="item-badge">${unreadCounts[user.id]}</div>` : ''}
    `;
    userDiv.onclick = () => startDirectChat(user);
    usersList.appendChild(userDiv);
  });
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
  document.getElementById('chatType').textContent = 'Direct Message';
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
      groupsList.innerHTML = '<div class="loading">No groups yet. Create or join one!</div>';
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
        ${unreadCounts[group.id] ? `<div class="item-badge">${unreadCounts[group.id]}</div>` : ''}
      `;
      groupDiv.onclick = () => selectGroup(group);
      groupsList.appendChild(groupDiv);
    });
  } catch (error) {
    groupsList.innerHTML = '<div class="loading">Error loading groups</div>';
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
// Account Management
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
      statusText: ''
    });
  }
  updateAvatarDisplay();
  return true;
}

// ========================================
// UI Functions
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
    loadAllUsers();
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
// Search Functions
// ========================================
async function globalSearch(searchTerm) {
  if (!searchTerm.trim()) return;
  const results = [];
  const groupsSnapshot = await db.collection('groups').get();
  for (const group of groupsSnapshot.docs) {
    const messagesSnapshot = await db.collection('messages')
      .where('groupId', '==', group.id)
      .where('text', '>=', searchTerm)
      .where('text', '<=', searchTerm + '\uf8ff')
      .get();
    messagesSnapshot.forEach(doc => results.push({ ...doc.data(), id: doc.id, groupName: group.data().name }));
  }
  const directSnapshot = await db.collection('messages')
    .where('directId', '>=', '')
    .where('text', '>=', searchTerm)
    .where('text', '<=', searchTerm + '\uf8ff')
    .get();
  directSnapshot.forEach(doc => results.push({ ...doc.data(), id: doc.id }));
  showError(`Found ${results.length} results`, false);
  return results;
}

// ========================================
// Event Listeners & Initialization
// ========================================
document.getElementById('deleteMessageBtn')?.addEventListener('click', async () => {
  if (contextMessageId) {
    await deleteMessage(contextMessageId);
    hideContextMenu();
    contextMessageId = null;
  }
});

// ========================================
// Chat Page Initialization
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
    
    // Setup listeners for user status changes
    db.collection('users').where('uid', '!=', user.uid).onSnapshot(() => loadAllUsers());
    
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
    document.getElementById('searchUsers')?.addEventListener('input', () => renderUsersList(allUsers));
  });
  
  document.querySelector('.chat-main')?.addEventListener('click', closeMobileMenuOnChat);
  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
  
  // Send message
  document.getElementById('sendBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('messageInput');
    const message = input.value;
    if (currentFile) {
      try {
        const url = await uploadAvatar(currentFile);
        await sendMessage(message, { type: 'file', url: url, filename: currentFile.name });
        currentFile = null;
        document.getElementById('filePreview').style.display = 'none';
        document.getElementById('fileName').textContent = '';
      } catch (error) { showError('Upload failed'); }
    } else if (message.trim()) {
      await sendMessage(message);
    }
    input.value = '';
  });
  
  document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('sendBtn').click();
    else sendTypingIndicator();
  });
  
  document.getElementById('attachFileBtn')?.addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('fileInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) { currentFile = file; document.getElementById('fileName').textContent = file.name; document.getElementById('filePreview').style.display = 'flex'; }
  });
  document.getElementById('removeFileBtn')?.addEventListener('click', () => {
    currentFile = null; document.getElementById('filePreview').style.display = 'none'; document.getElementById('fileInput').value = '';
  });
  
  // Emoji picker
  document.getElementById('emojiBtn')?.addEventListener('click', () => {
    initEmojiPicker();
    document.getElementById('emojiPickerModal').style.display = 'flex';
  });
  document.querySelector('.emoji-close')?.addEventListener('click', () => document.getElementById('emojiPickerModal').style.display = 'none');
  
  // Sticker picker
  document.getElementById('stickerBtn')?.addEventListener('click', () => {
    initStickerPicker();
    document.getElementById('stickerPickerModal').style.display = 'flex';
  });
  document.querySelector('.sticker-close')?.addEventListener('click', () => document.getElementById('stickerPickerModal').style.display = 'none');
  
  // Create group
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
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  
  // Avatar handlers
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
  
  // Status text edit
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
  
  // Profile avatar upload
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
  
  // Sound toggle
  document.getElementById('soundToggleMenuItem')?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    showError(`Sound ${soundEnabled ? 'ON' : 'OFF'}`, false);
    hideSettingsMenu();
  });
  
  // Global search
  document.getElementById('globalSearch')?.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') await globalSearch(e.target.value);
  });
  
  // In-chat search
  document.getElementById('searchInChatBtn')?.addEventListener('click', () => {
    document.getElementById('inChatSearchBar').style.display = 'flex';
  });
  document.getElementById('closeSearchBtn')?.addEventListener('click', () => {
    document.getElementById('inChatSearchBar').style.display = 'none';
    document.getElementById('inChatSearch').value = '';
  });
  document.getElementById('inChatSearch')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && currentChat) {
      const term = e.target.value;
      document.querySelectorAll('.message-bubble').forEach(bubble => {
        if (bubble.innerText.toLowerCase().includes(term.toLowerCase())) {
          bubble.classList.add('highlighted');
          setTimeout(() => bubble.classList.remove('highlighted'), 2000);
          bubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  });
  
  // Password/Email handlers
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
  
  // Close modals
  document.querySelectorAll('.close-modal, .avatar-close, .password-close, .email-close, .profile-close, .user-profile-close').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('createGroupModal').style.display = 'none';
      document.getElementById('changePasswordModal').style.display = 'none';
      document.getElementById('changeEmailModal').style.display = 'none';
      document.getElementById('avatarModal').style.display = 'none';
      document.getElementById('profileModal').style.display = 'none';
      document.getElementById('userProfileModal').style.display = 'none';
      document.getElementById('emojiPickerModal').style.display = 'none';
      document.getElementById('stickerPickerModal').style.display = 'none';
    });
  });
  
  document.getElementById('profileCloseBtn')?.addEventListener('click', () => document.getElementById('profileModal').style.display = 'none');
  document.getElementById('userProfileCloseBtn')?.addEventListener('click', () => document.getElementById('userProfileModal').style.display = 'none');
  document.getElementById('profileSendMsgBtn')?.addEventListener('click', () => {
    document.getElementById('profileModal').style.display = 'none';
  });
  document.getElementById('userProfileSendMsgBtn')?.addEventListener('click', () => {
    const userId = document.getElementById('userProfileModal').dataset.userId;
    const userName = document.getElementById('userProfileModal').dataset.userName;
    const user = allUsers.find(u => u.id === userId);
    if (user) startDirectChat(user);
    document.getElementById('userProfileModal').style.display = 'none';
  });
  
  document.querySelectorAll('.chat-tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
  initTheme();
}

// ========================================
// Login Page Initialization
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
// Start the App
// ========================================
if (document.querySelector('.chat-page')) {
  initChatPage();
} else if (document.querySelector('.auth-page')) {
  initLoginPage();
}