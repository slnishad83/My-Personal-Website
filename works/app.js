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
  theme: (function() { try { return localStorage.getItem('tc_theme') || 'dark'; } catch(_) { return 'dark'; } })(),
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
  chatSelectionMode: false,
  selectedChatIds: [],
  callSelectionMode: false,
  selectedCallIds: [],
  _deletedChatIds: new Set(),
  
  // Showroom overrides
  showroomOverride: null, // { type: 'myself'|'personal'|'group', viewport: 'desktop'|'laptop'|'tablet'|'mobile' }
  showroomViewport: 'auto', // auto | mobile | tablet | laptop | desktop

  emojiCategories: {
    recent: ['😊','👍','❤️','😂','🙏','🔥','✨','😍','😭','🥺','🤣','💀','🫡','🤝'],
    smileys: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🫶','🫰','🫱','🫲','🫳','🫴','🫷','🫸'],
    people: ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','🫷','🫸','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦','💋','🩸','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷','👮','🕵️','💂','🥷','👷','🫅','🤴','👸','👳','👲','🧕','🤵','👰','🤰','🫃','🫄','🤱','👼','🎅','🤶','🦸','🦹','🧙','🧚','🧛','🧜','🧝','🧞','🧟','🧌','💆','💇','🚶','🧍','🧎','🏃','💃','🕺','👯','🧖','🧗','🏇','⛷️','🏂','🏋️','🤸','🤺','⛹️','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩','🪀','🪁','🪅','🪆','♠️','♥️','♦️','♣️','♟️','🃏','🀄','🎴','🎭','🖼️','🎨','🧵','🪡','🧶','🪢','👓','🕶️','🥽','🥼','🦺','👔','👕','👖','🧣','🧤','🧥','🧦','👗','👘','🥻','🩱','🩲','🩳','👙','👚','🪭','👛','👜','👝','🧳','👞','👟','🥾','🥿','👠','👡','🩰','👢','🪮','👒','🎓','🪖','⛑️','📿','💄','💍','💎'],
    nature: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🪸','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🦭','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🪿','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔','🐾','🐉','🐲','🌵','🎄','🌲','🌳','🌴','🪵','🪹','🪺','🍁','🍂','🍃','🪹','🪺','🍄','🪨','🪸','🌾','🌱','🌿','☘️','🍀','🌵','🎍','🎍','🎋','🎑','🌲','🌳','🌴','🪴','🏵️','🌹','🥀','🌷','🪻','🌸','💮','🏵️','🏵️','🌻','🌼','🌺','🌿','☘️','🍀','🍁','🍂','🍃','🪹','🪺','🍄','🪵','🪸','🪨','🌾','🌶️','🫑','🥒','🥬','🥦','🧄','🧅','🥜','🫘','🌰','🫚','🫛','🍞','🥐','🥖','🫓','🥨','🥯','🥞','🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🫔','🧆','🥙','🧈','🥚','🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫','🫙','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦦','🦥','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🪿','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔','🐾','🐉','🐲'],
    food: ['🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄','🧅','🍄','🥜','🫘','🌰','🫚','🫛','🍞','🥐','🥖','🫓','🥨','🥯','🥞','🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🫔','🧆','🥙','🧈','🥚','🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫','🫙','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🍶','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🫗','🥤','🧋','🧃','🧉','🧊','🥢','🍽️','🍴','🥄','🔪','🫙','🏺'],
    activities: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🪁','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','🎯','🪀','🪁','🎱','🔮','🪄','🧿','🎮','🕹️','🎰','🎲','🧩','🧸','🪅','🪆','♠️','♥️','♦️','♣️','♟️','🃏','🀄','🎴','🎭','🖼️','🎨','🧵','🪡','🧶','🪢','🎪','🤹','🎭','🩰','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩','🪀','🪁','🪅','🪆'],
    travel: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛺','🚍','🚘','🚖','🛞','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺','🛰️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','🪝','⛽','🚧','🚦','🚥','🚏','🗺️','🗿','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏜️','🌋','⛰️','🏔️','🗻','🏕️','🛖','🏠','🏡','🏘️','🏚️','🏗️','🏭','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌','🕍','🛕','🕋','⛩️','🛤️','🛣️','🗾','🎑','🏞️','🌅','🌄','🌠','🎇','🎆','🌇','🌆','🏙️','🌃','🌌','🌉','🌁','🎮','🕹️','🎰','🎲','🧩','🧸','🪅','🪆'],
    objects: ['⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','🪪','🧾','📊','📈','📉','🗂️','📋','📁','📂','🗂️','🗃️','🗄️','🗑️','🔒','🔓','🔏','🔐','🗝️','🔑','❤️','🩹','🩺','💊','💉','🩸','🧬','🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🧽','🪣','🧴','🛎️','🔑','🗝️','🚪','🪑','🛋️','🛏️','🛌','🧸','🪆','🪞','🪟','🧳','🛒','🎁','🎈','🎏','🎀','🪄','🪅','🎊','🎉','🎎','🏮','🎐','🧧','✉️','📩','📨','📧','💌','📥','📤','📦','🏷️','🪧','📪','📫','📬','📭','📮','📯','📜','📃','📄','📑','🧾','📊','📈','📉','🗒️','🗓️','📆','📅','🗑️','📇','🗃️','🗳️','🗄️','📋','📁','📂','🗂️','🗞️','📰','📓','📔','📒','📕','📖','📗','📘','📙','📚','📖','🔖','🧷','🔗','📎','🖇️','📐','📏','🧮','📌','📍','✂️','🖊️','🖋️','✒️','🖌️','🖍️','📝','✏️','🔍','🔎','🔏','🔐','🗝️','🔑'],
    symbols: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🔱','⚜️','🔰','♻️','✅','🈯','💹','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈹','🚰','🚹','🚺','🚻','🚼','🚽','🛁','🚿','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','💠','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','⛎','🔀','🔁','🔂','▶️','⏩','⏭️','⏯️','◀️','⏪','⏮️','🔼','⏫','🔽','⏬','⏸️','⏹️','⏺️','⏏️','🎦','🔅','🔆','📶','🛜','📳','📴','♀️','♂️','⚧️','✖️','➕','➖','➗','🟰','♾️','‼️','⁉️','❓','❔','❕','❗','〰️','💱','💲','⚕️','♻️','⚜️','🔱','📛','🔰','⭕','✅','☑️','✔️','❌','❎','➰','➿','〽️','✳️','✴️','❇️','©️','®️','™️','#️⃣','*️⃣','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔠','🔡','🔢','🔣','🔤','🅰️','🆎','🅱️','🆑','🆒','🆓','ℹ️','🆔','Ⓜ️','🆕','🆖','🅾️','🆗','🅿️','🆘','🆙','vs','🈁','🈂️','🈷️','🈶','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆑','🅾️','🆘','🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇦🇨','🇦🇩','🇦🇪','🇦🇫','🇦🇬','🇦🇮','🇦🇱','🇦🇲','🇦🇴','🇦🇶','🇦🇷','🇦🇸','🇦🇹','🇦🇺','🇦🇼','🇦🇽','🇦🇿','🇧🇦','🇧🇧','🇧🇩','🇧🇪','🇧🇫','🇧🇬','🇧🇭','🇧🇮','🇧🇯','🇧🇱','🇧🇲','🇧🇳','🇧🇴','🇧🇶','🇧🇷','🇧🇸','🇧🇹','🇧🇻','🇧🇼','🇧🇾','🇧🇿','🇨🇦','🇨🇨','🇨🇩','🇨🇫','🇨🇬','🇨🇭','🇨🇮','🇨🇰','🇨🇱','🇨🇲','🇨🇳','🇨🇴','🇨🇵','🇨🇷','🇨🇺','🇨🇻','🇨🇼','🇨🇽','🇨🇾','🇨🇿','🇩🇪','🇩🇬','🇩🇯','🇩🇰','🇩🇲','🇩🇴','🇩🇿','🇪🇦','🇪🇨','🇪🇪','🇪🇬','🇪🇭','🇪🇷','🇪🇸','🇪🇹','🇪🇺','🇫🇮','🇫🇯','🇫🇰','🇫🇲','🇫🇴','🇫🇷','🇬🇦','🇬🇧','🇬🇩','🇬🇪','🇬🇫','🇬🇬','🇬🇭','🇬🇮','🇬🇱','🇬🇲','🇬🇳','🇬🇵','🇬🇶','🇬🇷','🇬🇸','🇬🇹','🇬🇺','🇬🇼','🇬🇾','🇭🇰','🇭🇲','🇭🇳','🇭🇷','🇭🇹','🇭🇺','🇮🇨','🇮🇩','🇮🇪','🇮🇱','🇮🇲','🇮🇳','🇮🇴','🇮🇶','🇮🇷','🇮🇸','🇮🇹','🇯🇪','🇯🇲','🇯🇴','🇯🇵','🇰🇪','🇰🇬','🇰🇭','🇰🇮','🇰🇲','🇰🇳','🇰🇵','🇰🇷','🇰🇼','🇰🇾','🇰🇿','🇱🇦','🇱🇧','🇱🇨','🇱🇮','🇱🇰','🇱🇷','🇱🇸','🇱🇹','🇱🇺','🇱🇻','🇱🇾','🇲🇦','🇲🇨','🇲🇩','🇲🇪','🇲🇫','🇲🇬','🇲🇭','🇲🇰','🇲🇱','🇲🇲','🇲🇳','🇲🇴','🇲🇵','🇲🇶','🇲🇷','🇲🇸','🇲🇹','🇲🇺','🇲🇻','🇲🇼','🇲🇽','🇲🇾','🇲🇿','🇳🇦','🇳🇨','🇳🇪','🇳🇫','🇳🇬','🇳🇮','🇳🇱','🇳🇴','🇳🇵','🇳🇷','🇳🇺','🇳🇿','🇴🇲','🇵🇦','🇵🇪','🇵🇫','🇵🇬','🇵🇭','🇵🇰','🇵🇱','🇵🇲','🇵🇳','🇵🇷','🇵🇸','🇵🇹','🇵🇼','🇵🇾','🇶🇦','🇶🇪','🇶🇫','🇶🇬','🇶🇮','🇶🇱','🇶🇲','🇶🇳','🇶🇴','🇶🇵','🇶🇷','🇶🇸','🇶🇹','🇶🇺','🇶🇻','🇶🇼','🇶🇽','🇶🇾','🇶🇿','🇷🇦','🇷🇧','🇷🇨','🇷🇩','🇷🇪','🇷🇫','🇷🇬','🇷🇭','🇷🇮','🇷🇯','🇷🇰','🇷🇱','🇷🇲','🇷🇳','🇷🇴','🇷🇵','🇷🇶','🇷🇷','🇷🇸','🇷🇹','🇷🇺','🇷🇼','🇷🇽','🇷🇾','🇷🇿','🇸🇦','🇸🇧','🇸🇨','🇸🇩','🇸🇪','🇸🇬','🇸🇭','🇸🇮','🇸🇯','🇸🇰','🇸🇱','🇸🇲','🇸🇳','🇸🇴','🇸🇷','🇸🇸','🇸🇹','🇸🇻','🇸🇽','🇸🇾','🇸🇿','🇹🇦','🇹🇨','🇹🇩','🇹🇫','🇹🇬','🇹🇭','🇹🇯','🇹🇰','🇹🇱','🇹🇲','🇹🇳','🇹🇴','🇹🇷','🇹🇹','🇹🇻','🇹🇼','🇹🇿','🇺🇦','🇺🇬','🇺🇲','🇺🇳','🇺🇸','🇺🇾','🇺🇿','🇻🇦','🇻🇨','🇻🇪','🇻🇬','🇻🇮','🇻🇳','🇻🇺','🇼🇫','🇼🇸','🇽🇰','🇾🇪','🇾🇹','🇿🇦','🇿🇲','🇿🇼'],
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
    App.storage = firebase.storage ? firebase.storage()    : null;
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

  window.addEventListener('popstate', (e) => {
    if (App.callActive && document.getElementById('call-screen') && !document.getElementById('call-screen').classList.contains('hidden')) {
      minimizeCall();
      history.pushState({ callMinimized: true }, '');
    }
  });
  // Load recent emojis from localStorage
  try { const r = JSON.parse(localStorage.getItem('nsl_emoji_recent') || '[]'); if (r.length) App.emojiCategories.recent = r; } catch(_) {}
  App._currentEmojiCat = 'recent';
  loadEmojiGrid('recent');
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', e => { if (e.key==='Escape') closeTopModal(); });

  // Add micro-animation depth with mouse movement for glows
  let _glowRafPending = false;
  document.addEventListener('mousemove', (e) => {
    if (_glowRafPending) return;
    _glowRafPending = true;
    requestAnimationFrame(() => {
      const glow1 = document.getElementById('atmosphere-glow-1');
      const glow2 = document.getElementById('atmosphere-glow-2');
      if (glow1 && glow2) {
        const moveX = (e.clientX - window.innerWidth / 2) * 0.015;
        const moveY = (e.clientY - window.innerHeight / 2) * 0.015;
        glow1.style.transform = `translate(${moveX}px, ${moveY}px)`;
        glow2.style.transform = `translate(${-moveX}px, ${-moveY}px)`;
      }
      _glowRafPending = false;
    });
  });
});

App.usersUnsubscribe = null;
App.chatsUnsubscribe = null;
App.groupsUnsubscribe = null;
App.messagesUnsubscribe = null;
App.chatRequestsUnsubscribe = null;
App.callsUnsubscriber = null;
App.callsUnsubscriber2 = null;
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
        phone: data.phone || data.phoneNumber || '',
        lastSeen: data.lastSeen || null
      });
    });
    App.contacts = contacts;
    renderChatList();
    renderContactList();
    updateHeaderPresence();
    // Re-check for orphaned chats now that contacts are available
    detectAndMergeOrphanedChatsForUser();
  }, (error) => {
    console.warn("Users subscription failed, loading demo mode:", error);
    loadDemoData();
    bootApp();
  });
}

function updateHeaderPresence() {
  if (!App.currentChat || App.currentChat.type !== 'direct') return;
  const contact = App.contacts.find(c => c.uid === App.currentChat.uid);
  if (!contact) return;
  const headerStatus = document.getElementById('header-status');
  const statusDot = document.getElementById('header-status-dot');
  if (headerStatus) {
    headerStatus.textContent = contact.status === 'online' ? 'Active Now' : (contact.about || '');
    headerStatus.className = "text-[10px] uppercase tracking-widest font-label-caps" + (contact.status === 'online' ? ' text-green-500' : ' text-on-surface-variant');
  }
  if (statusDot) {
    if (contact.status === 'online') {
      statusDot.style.display = '';
      statusDot.className = 'absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background';
    } else {
      statusDot.style.display = 'none';
    }
  }
}

function subscribeToChats() {
  if (!App.db || !App.auth?.currentUser) return;
  const uid = App.auth.currentUser.uid;
  if (App.chatsUnsubscribe) App.chatsUnsubscribe();
  let _chatsGen = 0;
  
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
            myselfChat.lastTime = getMillis(data.lastMessageTime) || myselfChat.lastTime;
          }
          return;
        }
        
        if (App._deletedChatIds.has(chatId)) return;
        if (data.deletedFor && data.deletedFor[uid]) return;
        
        const otherUserId = data.participants.find(p => p !== uid);
        if (!otherUserId) return;
        
        // Dedup: if this UID is stale (contact re-registered), skip orphaned chat
        const otherEmail = data.participantEmails?.[otherUserId] || '';
        if (otherEmail) {
          const realContact = App.contacts.find(c => c.email && c.email.toLowerCase() === otherEmail.toLowerCase());
          if (realContact && realContact.uid !== otherUserId) return; // skip stale chat
        }
        
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
          about: otherUser.about,
          lastMsg: data.lastMessage || 'No messages yet',
          lastTime: getMillis(data.lastMessageTime),
          unread: data.unreadCount?.[uid] || 0,
          pinned: data.pinned?.[uid] || false,
          muted: data.muted?.[uid] || false,
          status: otherUser.status,
          disappearingMessages: data.disappearingMessages || 0
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
        const myGen = ++_chatsGen;
        Promise.all(decryptPromises).then(() => {
          if (_chatsGen !== myGen) return; // stale snapshot, discard
          // Sync _mutedChats Set from Firestore data
          if (!App._mutedChats) App._mutedChats = new Set();
          chatsList.forEach(c => { if (c.muted) App._mutedChats.add(c.id); else App._mutedChats.delete(c.id); });
          App.directChats = chatsList;
          mergeAndRenderChats();
          detectAndMergeOrphanedChatsForUser();
        });
      } else {
        App.directChats = chatsList;
        mergeAndRenderChats();
        detectAndMergeOrphanedChatsForUser();
      }
    }, (error) => {
      console.warn("Chats subscription failed:", error);
    });
}

function _buildGroupObj(doc, uid) {
  const data = doc.data();
  let members = data.members || [];
  let memberIds = data.memberIds || [];
  
  // Resolve stale/old member UIDs to current active UIDs
  const activeUids = new Set(App.contacts.map(c => c.uid));
  activeUids.add(uid);
  const otherContact = App.contacts.find(c => c.uid !== uid);
  
  if (otherContact) {
    memberIds = memberIds.map(id => {
      if (activeUids.has(id)) return id;
      return otherContact.uid;
    });
    members = members.map(id => {
      if (activeUids.has(id)) return id;
      return otherContact.uid;
    });
  }

  return {
    id: doc.id,
    type: 'group',
    name: data.name || 'Unnamed Group',
    avatar: data.avatar || 'gradient-3',
    initials: getInitials(data.name || 'Group'),
    photoURL: data.icon || null,
    lastMsg: data.lastMessage || 'No messages yet',
    lastTime: getMillis(data.lastMessageTime),
    unread: data.unreadCount?.[uid] || 0,
    pinned: data.pinned?.[uid] || false,
    muted: data.muted?.[uid] || false,
    memberCount: (memberIds || members || []).length || 0,
    memberIds: memberIds,
    members: members,
    disappearingMessages: data.disappearingMessages || 0
  };
}

function subscribeToGroups() {
  if (!App.db || !App.auth?.currentUser) {
    console.warn('[Groups] No db or no auth user — skipping subscription');
    return;
  }
  const uid = App.auth.currentUser.uid;
  if (App.groupsUnsubscribe) App.groupsUnsubscribe();
  if (App._groupsUnsubscribe2) { App._groupsUnsubscribe2(); App._groupsUnsubscribe2 = null; }

  // Track groups seen across both queries to avoid duplicates
  const _groupSnapshots = { byMemberIds: [], byMembers: [] };

  function _mergeGroupSnapshots() {
    const seen = new Set();
    const groupsList = [];
    [..._groupSnapshots.byMemberIds, ..._groupSnapshots.byMembers].forEach(doc => {
      if (seen.has(doc.id)) return;
      const data = doc.data();
      if (data.deletedFor && data.deletedFor[uid]) return;
      if (App._deletedChatIds.has(doc.id)) return;
      seen.add(doc.id);
      groupsList.push(_buildGroupObj(doc, uid));
    });
    App.groupChats = groupsList;
    mergeAndRenderChats();
  }

  // Primary query: uses memberIds — matches Firestore security rule
  App.groupsUnsubscribe = App.db.collection('groups')
    .where('memberIds', 'array-contains', uid)
    .onSnapshot((snapshot) => {
      _groupSnapshots.byMemberIds = snapshot.docs;
      _mergeGroupSnapshots();
    }, (error) => {
      console.error('[Groups] memberIds subscription error:', error);
    });

  // Fallback query: uses members — for groups created with older schema
  App._groupsUnsubscribe2 = App.db.collection('groups')
    .where('members', 'array-contains', uid)
    .onSnapshot((snapshot) => {
      _groupSnapshots.byMembers = snapshot.docs;
      _mergeGroupSnapshots();
    }, (error) => {
      // Silently ignore if this also fails — primary query is sufficient
      console.warn('[Groups] members fallback subscription error (non-critical):', error);
    });
}

function subscribeToCallLogs(uid) {
  if (!App.db || !uid) {
    console.warn('[CallLogs] No db or no uid — skipping subscription');
    return;
  }
  if (App.callLogsUnsubscribe) App.callLogsUnsubscribe();
  if (App.callsUnsubscriber) App.callsUnsubscriber();
  
  // Track deleted call log IDs to prevent re-appearance from calls collection
  if (!App._deletedCallLogIds) App._deletedCallLogIds = new Set();
  
  const allLogs = {};
  
  function mergeLogs() {
    const persistedDeleted = loadDeletedCallIds();
    const list = Object.values(allLogs).filter(l => !App._deletedCallLogIds.has(l.id) && !persistedDeleted.has(l.id));
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    App.callLogs = list;
    if (App.activeTab === 'calls') renderCallsTab();
  }
  
  // Listen to callLogs collection (from beginCall/endCall flow)
  App.callLogsUnsubscribe = App.db.collection('callLogs')
    .where('participants', 'array-contains', uid)
    .onSnapshot({ includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache) return;
      Object.keys(allLogs).forEach(k => delete allLogs[k]);
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!App._deletedCallLogIds.has(doc.id)) {
          allLogs[doc.id] = {
            id: doc.id,
            callerId: data.callerId,
            calleeId: data.calleeId,
            type: data.type || 'voice',
            duration: data.duration || 0,
            timestamp: getMillis(data.timestamp),
            status: data.status || 'missed',
            participants: data.participants || []
          };
        }
      });
      mergeLogs();
    }, e => console.error('[CallLogs] callLogs Subscription FAILED:', e));
  
  // Also listen to calls collection (WebRTC / legacy call flow)
  App.callsUnsubscriber = App.db.collection('calls')
    .where('fromUserId', '==', uid)
    .onSnapshot(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'deleted') {
          delete allLogs['calls_' + doc.id];
          return;
        }
        if (['ended','missed','cancelled','rejected','declined','failed','busy'].includes(data.status)) {
          const logId = doc.id;
          if (!App._deletedCallLogIds.has(logId)) {
            allLogs['calls_' + doc.id] = {
              id: logId,
              callerId: data.fromUserId || data.callerId || '',
              calleeId: data.toUserId || data.calleeId || '',
              type: data.type || 'voice',
              duration: data.duration || 0,
              timestamp: getMillis(data.timestamp) || Date.now(),
              status: data.status || 'ended',
              participants: [data.fromUserId, data.toUserId].filter(Boolean)
            };
          }
        }
      });
      mergeLogs();
    }, e => console.error('[CallLogs] calls Subscription FAILED:', e));
  
  // Also listen to calls collection where user is the callee
  App.callsUnsubscriber2 = App.db.collection('calls')
    .where('toUserId', '==', uid)
    .onSnapshot(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'deleted') {
          delete allLogs['calls_' + doc.id];
          return;
        }
        if (['ended','missed','cancelled','rejected','declined','failed','busy'].includes(data.status)) {
          const logId = doc.id;
          if (!App._deletedCallLogIds.has(logId)) {
            allLogs['calls_' + doc.id] = {
              id: logId,
              callerId: data.fromUserId || data.callerId || '',
              calleeId: data.toUserId || data.calleeId || '',
              type: data.type || 'voice',
              duration: data.duration || 0,
              timestamp: getMillis(data.timestamp) || Date.now(),
              status: data.status || 'ended',
              participants: [data.fromUserId, data.toUserId].filter(Boolean)
            };
          }
        }
      });
      mergeLogs();
    }, e => console.error('[CallLogs] calls Subscription FAILED:', e));
}

function mergeAndRenderChats() {
  let direct = [...(App.directChats || [])];
  const uid = App.auth?.currentUser?.uid;
  if (uid) {
    const existingUids = new Set(direct.map(c => c.uid));
    (App.contacts || []).forEach(contact => {
      if (contact.uid !== uid && !existingUids.has(contact.uid)) {
        direct.push({
          id: getDirectChatId(uid, contact.uid),
          type: 'personal',
          uid: contact.uid,
          name: contact.name,
          avatar: contact.avatar,
          initials: contact.initials,
          photoURL: contact.photoURL,
          about: contact.about,
          lastMsg: 'Tap to start messaging',
          lastTime: 0,
          unread: 0,
          pinned: false,
          muted: false,
          status: contact.status,
          email: contact.email
        });
      }
    });
  }
  const groups = App.groupChats || [];
  App.chats = [...direct, ...groups];
  renderChatList();
}

async function loadMessageHistory(email, uid) {
  if (!App.db || !uid) return;
  try {
    // Primary query: by participantEmails (works for re-registered users with same email)
    let snap = null;
    if (email) {
      snap = await App.db.collection('messages')
        .where('participantEmails', 'array-contains', email)
        .orderBy('timestamp', 'asc')
        .limit(200)
        .get();
    }
    // Fallback: by participants array-contains uid (for users whose UID didn't change)
    if (!snap || snap.empty) {
      snap = await App.db.collection('messages')
        .where('participants', 'array-contains', uid)
        .orderBy('timestamp', 'asc')
        .limit(200)
        .get();
    }
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
      const myEmailIdx = info.participantEmails.indexOf(email);
      const otherEmail = info.participantEmails[1 - myEmailIdx] || info.participantEmails.find(e => e !== email) || '';
      const otherUid = info.participants[1 - myEmailIdx] || info.participants.find(p => p !== uid) || '';
      const expectedId = getDirectChatId(uid, otherUid);

      // Re-registration merge: if chatId differs from expectedId, the messages use an old UID.
      // Migrate the old directChats doc to the new ID so the snapshot subscription picks it up.
      if (App.db && chatId !== expectedId && otherUid) {
        try {
          const oldDoc = await App.db.collection('directChats').doc(chatId).get();
          const oldData = oldDoc.exists ? oldDoc.data() : {};
          // Always create/update the new directChats doc and migrate messages
          await App.db.collection('directChats').doc(expectedId).set({
            participants: [uid, otherUid],
            participantNames: { ...(oldData.participantNames || {}), [uid]: App.currentUser.displayName || App.currentUser.email || 'Me' },
            participantEmails: { ...(oldData.participantEmails || {}), [uid]: email },
            participantEmailList: [email, otherEmail],
            status: 'active',
            lastMessage: oldData.lastMessage || null,
            lastMessageTime: oldData.lastMessageTime || null,
            lastMessageSenderId: oldData.lastMessageSenderId || null
          }, { merge: true }).catch(() => {});
          // Update old messages to reference users by email and new UID
          const msgSnap = await App.db.collection('messages')
            .where('directId', '==', chatId)
            .get();
          if (!msgSnap.empty) {
            const batch = App.db.batch();
            msgSnap.forEach(doc => {
              const ref = App.db.collection('messages').doc(doc.id);
              batch.update(ref, {
                participants: firebase.firestore.FieldValue.arrayUnion(uid),
                participantEmails: firebase.firestore.FieldValue.arrayUnion(email),
                directId: expectedId
      });
    });
}
          // Delete old directChats doc if it existed
          if (oldDoc.exists) {
            await App.db.collection('directChats').doc(chatId).delete().catch(() => {});
          }
        } catch(e) { console.warn('merge chat err:', e); }
        continue;
      }

      if (existingIds.has(chatId) || chatId === `saved_${uid}`) continue;
      if (App._deletedChatIds && App._deletedChatIds.has(chatId)) continue;
      try {
        const chatDoc = await App.db.collection('directChats').doc(chatId).get();
        if (chatDoc.exists && chatDoc.data().deletedFor && chatDoc.data().deletedFor[uid]) continue;
      } catch (e) { /* skip check on error */ }
      const contact = App.contacts.find(c => c.email === otherEmail || c.uid === otherUid) || { name: otherEmail.split('@')[0] || 'User', avatar: 'gradient-2', initials: '', photoURL: null, status: 'offline', about: otherEmail };
      const chatObj = {
        id: chatId, type: 'personal', uid: otherUid,
        name: contact.name, avatar: contact.avatar, initials: contact.initials || '',
        photoURL: contact.photoURL || null,
        about: contact.about || otherEmail,
        lastMsg: `${info.msgs} message${info.msgs > 1 ? 's' : ''}`, lastTime: info.lastTime || Date.now(),
        unread: 0, pinned: false, muted: false, status: 'offline', email: otherEmail
      };
      App.directChats.push(chatObj);
      if (App.db) {
        App.db.collection('directChats').doc(chatId).set({
          participants: [uid, otherUid],
          participantNames: { [uid]: App.currentUser.displayName || App.currentUser.email || 'Me', [otherUid]: contact.name },
          participantEmails: { [uid]: email, [otherUid]: otherEmail },
          participantEmailList: [email, otherEmail],
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
  if (App.chatRequestsOutgoingUnsubscribe) App.chatRequestsOutgoingUnsubscribe();
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
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('NSL Chat — New Chat Request', {
                  body: `${data.fromName || data.fromEmail || 'Someone'} wants to chat with you`,
                  icon: '/icon-192.png',
                  tag: 'chat-request-' + change.doc.id,
                });
              }
            } catch(_) {}
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
  let prevDeclinedIds = new Set();
  App.chatRequestsOutgoingUnsubscribe = App.db.collection('chatRequests')
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
        if (change.type === 'modified' && data.status === 'declined' && !prevDeclinedIds.has(change.doc.id)) {
          prevDeclinedIds.add(change.doc.id);
          if (typeof showToast === 'function') showToast(`Your chat request to ${data.toName || data.toEmail || 'user'} was declined`, 'info');
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
  cleanupTypingSubscription();
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) return;
  const queryField = chat.type === 'group' ? 'groupId' : 'directId';
  let _msgsGen = 0;
  App.messagesUnsubscribe = App.db.collection('messages')
    .where(queryField, '==', chatId)
    .onSnapshot(async (snapshot) => {
      const chatObj = App.chats.find(c => c.id === chatId);
      if (snapshot.empty && chatObj) {
        if (chatObj.type === 'personal' && chatObj.uid === 'c1') {
          const myUid = App.auth.currentUser.uid;
          const myName = App.currentUser?.displayName || App.currentUser?.email?.split('@')[0] || 'You';
          const now = Date.now();
          const mockMsgs = [
            { senderId: 'c1', senderName: 'Halid', text: 'Hey! How is the design system update looking?', time: now - 20*60000 },
            { senderId: myUid, senderName: myName, text: 'Sleek! Fully customized around the Midnight palette with Neon Pink highlights.', time: now - 18*60000 },
            { senderId: 'c1', senderName: 'Halid', text: 'Awesome! Is the right sidebar info panel working too?', time: now - 15*60000 },
            { senderId: myUid, senderName: myName, text: 'Yes, detail panels adapt for groups and personal chats dynamically.', time: now - 12*60000 },
            { senderId: 'c1', senderName: 'Halid', text: 'Perfect, let\'s review quarterly reports before our standup.', time: now - 8*60000 }
          ];
          const batch = App.db.batch();
          mockMsgs.forEach((m, idx) => {
            const docRef = App.db.collection('messages').doc(`mock_halid_${chatId}_${idx}`);
            batch.set(docRef, {
              directId: chatId,
              senderId: m.senderId,
              senderName: m.senderName,
              text: m.text,
              time: m.time,
              timestamp: new Date(m.time),
              status: 'read',
              read: true,
              type: 'text',
              participants: [myUid, 'c1']
            });
          });
          const chatRef = App.db.collection('directChats').doc(chatId);
          batch.set(chatRef, {
            lastMessage: 'Perfect, let\'s review quarterly reports before our standup.',
            lastMessageTime: new Date(now - 8*60000)
          }, { merge: true });
          batch.commit().catch(e => console.warn('Failed to seed Halid messages:', e));
          return;
        }
      }
      const myGen = ++_msgsGen;
      const msgs = [];
      const decryptPromises = [];
      
      const uid = App.auth?.currentUser?.uid;
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Skip deleted messages
        if (data.deletedForEveryone) return;
        if (uid && data.deletedFor && data.deletedFor[uid]) return;
        // localStorage persistence backup
        { const ls = loadDeletedMsgIds(chatId); if (ls.has(doc.id)) return; }
        
        // Skip expired disappearing messages
        if (data.expiresAt) {
          const expiresAt = typeof data.expiresAt === 'number' ? data.expiresAt : (data.expiresAt?.toMillis ? data.expiresAt.toMillis() : 0);
          if (expiresAt > 0 && Date.now() > expiresAt) return;
        }
        
        let type = 'text';
        let url = '';
        let duration = '';
        let fileName = '';
        let fileSize = '';

        if (data.type === 'poll') {
          type = 'poll';
        }

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
          } else if (att.type === 'location') {
            type = 'location';
            url = att.mapUrl || '';
          } else if (att.type === 'contact') {
            type = 'contact';
            url = '';
          } else {
            type = 'doc';
            fileName = att.name || 'Document';
            fileSize = att.size || '';
          }
        }
        
        const a = data.attachment || {};
        const msgObj = {
          id: doc.id,
          from: data.senderId === App.auth.currentUser.uid ? 'me' : data.senderId,
          text: data.text || '',
          time: data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.time || Date.now()),
          status: data.status || 'read',
          replyTo: data.replyTo ? { name: data.replyTo.senderName, text: data.replyTo.text } : null,
          reactions: Array.isArray(data.reactions)
            ? data.reactions
            : Object.entries(data.reactions || {}).map(([emoji, count]) => {
                const uid = App.auth?.currentUser?.uid;
                return { emoji, count: typeof count === 'number' ? count : (count?.count || 0), mine: Array.isArray(count?.users) ? count.users.includes(uid) : false };
              }).filter(r => r.count > 0),
          type: type,
          url: url,
          duration: duration,
          durationSec: a.durationSec || 0,
          fileName: fileName,
          fileSize: fileSize,
          lat: a.lat,
          lng: a.lng,
          mapUrl: a.mapUrl || url,
          contactName: a.contactName,
          contactEmail: a.contactEmail,
          starred: data.starred || false,
          edited: data.edited || false,
          forwarded: data.forwarded || false,
          liveLocation: data.liveLocation || null,
        };
        
        if (data.encrypted && data.iv) {
          const peerUid = chat.type === 'personal' ? chat.uid : null;
          if (peerUid) {
            decryptPromises.push(
              decryptMessageText(data.text, data.iv, peerUid).then(decryptedText => {
                if (decryptedText !== null) {
                  msgObj.text = decryptedText;
    } else if (msg.type === 'poll' && msg.poll) {
      const poll = msg.poll;
      const totalVotes = poll.options.reduce((sum, o) => sum + (o.voters?.length || 0), 0);
      const myUid = App.auth?.currentUser?.uid;
      contentHTML = `
        <div class="max-w-[340px] rounded-xl overflow-hidden ${isMe ? 'bg-primary/10 border border-primary/20' : 'bg-surface-container border border-outline-variant/20'}">
          <div class="px-4 py-3 border-b border-outline-variant/20">
            <div class="text-sm font-semibold mb-1">\ud83d\udcca ${escHtml(poll.question)}</div>
            <div class="text-[10px] text-on-surface-variant">${totalVotes} vote${totalVotes !== 1 ? 's' : ''} \u00b7 ${poll.allowMultiple ? 'Multiple choice' : 'Single choice'}</div>
          </div>
          <div class="p-3 space-y-2">
            ${poll.options.map((opt, i) => {
              const count = opt.voters?.length || 0;
              const pct = totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0;
              const isSelected = opt.voters?.includes(myUid);
              return `
                <div class="relative cursor-pointer rounded-lg overflow-hidden border ${isSelected ? 'border-primary/50' : 'border-outline-variant/30'} hover:border-primary/30 transition-all" onclick="votePoll('${msg.id}', ${i})">
                  <div class="absolute inset-0 bg-primary/15 transition-all" style="width:${pct}%"></div>
                  <div class="relative flex items-center justify-between px-3 py-2">
                    <div class="flex items-center gap-2">
                      ${isSelected ? '<span class="material-symbols-outlined text-primary text-sm">check_circle</span>' : '<span class="material-symbols-outlined text-on-surface-variant/40 text-sm">radio_button_unchecked</span>'}
                      <span class="text-sm">${escHtml(opt.text)}</span>
                    </div>
                    <span class="text-xs font-medium text-on-surface-variant">${count > 0 ? pct + '%' : ''}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
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
      
      if (_msgsGen !== myGen) return; // stale snapshot, discard
      msgs.sort((a, b) => a.time - b.time);

      const prevCount = (App.messages[chatId] || []).length;
      App.messages[chatId] = msgs;
      renderMessages(chatId);
      scrollToBottom(true);

      if (msgs.length > prevCount) {
        const newMsgs = msgs.slice(prevCount);
        const incomingNew = newMsgs.filter(m => m.from !== 'me');
        if (incomingNew.length > 0) {
          document.dispatchEvent(new CustomEvent('nsl:new-message', { detail: { chatId } }));
          playMsgReceivedSound(chatId);
        }
      }
    }, (error) => {
      console.warn("Messages subscription error:", error);
    });
}

/* ─── Persistent deleted state (survives refresh) ─── */
function loadDeletedCallIds() {
  try { return new Set(JSON.parse(localStorage.getItem('nsl_deleted_calls') || '[]')); } catch { return new Set(); }
}

// Disappearing messages cleanup — runs every 5 minutes
let _disappearCleanupInterval = null;
function startDisappearingMessagesCleanup() {
  if (_disappearCleanupInterval) return;
  _disappearCleanupInterval = setInterval(async () => {
    if (!App.db || !App.auth?.currentUser) return;
    try {
      const cutoff = Date.now();
      const snap = await App.db.collection('messages')
        .where('expiresAt', '>', 0)
        .where('expiresAt', '<', cutoff)
        .limit(50)
        .get();
      if (!snap.empty) {
        const batch = App.db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch(_) {}
  }, 5 * 60 * 1000);
}
function addDeletedCallId(logId) {
  const ids = loadDeletedCallIds(); ids.add(logId);
  try { localStorage.setItem('nsl_deleted_calls', JSON.stringify([...ids])); } catch(_) {}
}
function loadDeletedMsgIds(chatId) {
  try { const o = JSON.parse(localStorage.getItem('nsl_deleted_msgs') || '{}'); return new Set(o[chatId] || []); } catch { return new Set(); }
}
function addDeletedMsgId(chatId, msgId) {
  try { const o = JSON.parse(localStorage.getItem('nsl_deleted_msgs') || '{}'); o[chatId] = o[chatId] || []; if (!o[chatId].includes(msgId)) o[chatId].push(msgId); localStorage.setItem('nsl_deleted_msgs', JSON.stringify(o)); } catch {}
}

/* ─── Persistent deleted chat state ─── */
function loadDeletedChatIds() {
  try { return new Set(JSON.parse(localStorage.getItem('nsl_deleted_chats') || '[]')); } catch { return new Set(); }
}
function addDeletedChatId(chatId) {
  const ids = loadDeletedChatIds(); ids.add(chatId);
  try { localStorage.setItem('nsl_deleted_chats', JSON.stringify([...ids])); } catch(_) {}
}
async function syncDeletedChatsFromFirestore() {
  if (!App.db || !App.auth?.currentUser?.uid) return;
  const uid = App.auth.currentUser.uid;
  try {
    const [directSnap, groupSnap] = await Promise.all([
      App.db.collection('directChats').where('participants', 'array-contains', uid).get(),
      App.db.collection('groups').where('memberIds', 'array-contains', uid).get()
    ]);
    [...directSnap.docs, ...groupSnap.docs].forEach(doc => {
      const data = doc.data();
      if (data.deletedFor && data.deletedFor[uid]) {
        App._deletedChatIds.add(doc.id);
        addDeletedChatId(doc.id);
      }
    });
  } catch (e) { console.warn('syncDeletedChats err:', e); }
}

function checkSession() {
  setLoadingStatus('Checking session…');
  if (App.auth) {
    App.auth.onAuthStateChanged(user => {
      if (user) {
        App.currentUser = user;
        setLoadingStatus('Loading chats…');
        loadUserProfile(user).then(() => {
          App._deletedChatIds = loadDeletedChatIds();
          App._deletedCallLogIds = loadDeletedCallIds();
          syncDeletedChatsFromFirestore();
          subscribeToUsers();
          subscribeToChats();
          subscribeToMyReactions();
          subscribeToGroups();
          subscribeToCallLogs(App.currentUser.uid);
          startDisappearingMessagesCleanup();
          loadBlockedUsers();
          loadArchivedChats();
          listenForIncomingCalls();
          handleCallNotificationUrlParams();
          if (App.currentUser.email) {
            loadMessageHistory(App.currentUser.email, App.currentUser.uid);
            subscribeToChatRequests(App.currentUser.email, App.currentUser.uid);
          }
          updatePresence('online');
          setupPushNotifications();
          loadChatFolders();
          _loadMuteState();
          mergeOrphanedChats(App.currentUser.uid, App.currentUser.email);
          setLoadingStatus('Ready');
          setTimeout(bootApp, 400);
        });
      } else {
        // Run demo mode if not authenticated
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
  let savedTheme = 'dark';
  try { savedTheme = localStorage.getItem('nsl-theme') || 'dark'; } catch(_) {}
  applyTheme(savedTheme);
  
  const loading = document.getElementById('loading-screen');
  if (loading) loading.classList.add('hidden');
  const app = document.getElementById('app');
  if (app) app.classList.remove('hidden');
  
  // H21: Force-close any overlays that should not auto-show after boot
  const bootOverlays = ['language-overlay','keyboard-help-panel','nsl-utilities-overlay','profile-overlay','prePermissionModal','permissionsModal','reEnablePermissionModal','revokePermissionsGuideModal'];
  bootOverlays.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'keyboard-help-panel') {
      el.classList.add('hidden');
      el.style.display = 'none';
    } else {
      hide(id);
      el.style.display = 'none';
    }
  });

  // H21: Run overlay guard again after 1s to catch any async auto-shows
  setTimeout(() => {
    bootOverlays.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'keyboard-help-panel') {
        el.classList.add('hidden');
        el.style.display = 'none';
      } else if (el.style.display === 'flex' || (el.style.display !== 'none' && !el.classList.contains('hidden'))) {
        hide(id);
        el.style.display = 'none';
      }
    });
  }, 1000);

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
    if (u.photoURL) pa.innerHTML = `<img src="${escHtml(u.photoURL)}" alt="${name}" class="w-full h-full object-cover rounded-full" loading="lazy">`;
    else pa.textContent = initials;
  }
  
  setEl('profile-name', name);
  setEl('profile-name-sidebar', name);
  setEl('profile-email', u.email || '');
  setEl('settings-name', name);
  setEl('settings-status', u.statusText || 'Available');
  setEl('settings-phone', u.phone || 'Not provided');
  updateSidebarPresence();
}

function updateSidebarPresence() {
  const dot = document.getElementById('sidebar-presence-dot');
  if (!dot) return;
  const status = Presence?.getStatus?.() || 'offline';
  if (status === 'online') {
    dot.style.display = '';
    dot.className = 'absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-surface-container-high';
  } else {
    dot.style.display = 'none';
  }
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
  try { localStorage.setItem('tc_theme', mode); } catch(_) {}
  try { localStorage.setItem('nsl-theme', resolvedTheme); } catch(_) {}
  
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

  // Clear search filter when switching tabs
  const searchInput = document.getElementById('sidebar-search');
  if (searchInput && searchInput.value) {
    searchInput.value = '';
    if (typeof clearSidebarSearch === 'function') clearSidebarSearch();
  }

  // Sidebar navigation items active classes revamp
  qsa('.tab-item').forEach(el => {
    const active = el.dataset.tab === tab;
    if (active) {
      el.className = "tab-item w-full flex items-center gap-4 bg-primary/10 text-primary border-l-4 border-primary px-4 py-3 cursor-pointer active:scale-95 transition-all duration-200";
    } else {
      el.className = "tab-item w-full flex items-center gap-4 text-on-surface/60 hover:text-on-surface hover:bg-surface-container-highest transition-colors duration-200 px-4 py-3 cursor-pointer active:scale-95";
    }
    el.setAttribute('aria-current', active ? 'page' : 'false');
  });

  // Bottom nav tab items active classes revamp
  qsa('.bottom-nav-item').forEach(el => {
    const active = el.dataset.tab === tab;
    el.classList.toggle('text-primary', active);
    el.classList.toggle('text-on-surface/60', !active);
    el.setAttribute('aria-current', active ? 'page' : 'false');
  });

  // Clear active chat viewport if not matching active tab
  if (App.currentChat) {
    if (tab === 'groups' && App.currentChat.type !== 'group') {
      showWelcome();
    } else if (tab !== 'chats' && tab !== 'groups') {
      showWelcome();
    }
  }

  // Adapt lists
  // Toggle multi-select buttons for chat vs calls tab
  const isCallTab = tab === 'calls';
  ['btn-multi-select','btn-select-all','btn-delete-selected'].forEach(id => {
    document.getElementById(id)?.classList.toggle('hidden', isCallTab);
  });
  ['btn-call-multi-select','btn-call-select-all','btn-call-delete-selected'].forEach(id => {
    document.getElementById(id)?.classList.toggle('hidden', !isCallTab);
  });
  // Show call button in calls tab, edit_square in others
  document.getElementById('btn-new-call')?.classList.toggle('hidden', !isCallTab);
  document.querySelector('[onclick="openNewChat()"]')?.classList.toggle('hidden', isCallTab);
  // Exit selection modes on tab switch
  if (isCallTab) {
    App.chatSelectionMode = false;
    App.selectedChatIds = [];
  } else {
    App.callSelectionMode = false;
    App.selectedCallIds = [];
  }
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
  _hideChatListSkeleton();

  const tab = App.activeTab;
  
  // Show or hide WhatsApp Web filter chips based on current tab
  const chipsContainer = document.getElementById('wa-filter-chips');
  if (chipsContainer) {
    chipsContainer.classList.toggle('hidden', tab !== 'chats');
  }

  let items = App.chats.filter(c => {
    if (App._archivedChatIds && App._archivedChatIds.has(c.id)) return false;
    if (tab === 'chats')  return true; // Show all (personal, groups, saved_me)
    if (tab === 'groups') return c.type === 'group';
    return true;
  });
  
  // Filter out blocked users
  if (App._blockedUsers && App._blockedUsers.size) {
    items = items.filter(c => !c.uid || !App._blockedUsers.has(c.uid));
  }

  // Apply WhatsApp Web filter chips
  if (tab === 'chats') {
    const waFilter = App.activeWaFilter || 'all';
    if (waFilter === 'unread') {
      items = items.filter(c => c.unread > 0 || c.unreadReaction);
    } else if (waFilter === 'favourites') {
      items = items.filter(c => c.pinned);
    } else if (waFilter === 'groups') {
      items = items.filter(c => c.type === 'group');
    }
  }

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
  const isMyselfOverride = App.showroomOverride?.type === 'myself' || (App.currentChat && isMyselfChatId(App.currentChat.id));
  
  const sidebarTitle = document.getElementById('chats-sidebar-title');
  if (sidebarTitle) {
    if (tab === 'groups') sidebarTitle.textContent = 'Groups';
    else if (tab === 'calls') sidebarTitle.textContent = 'Calls';
    else if (tab === 'requests') sidebarTitle.textContent = 'Requests';
    else if (tab === 'more') sidebarTitle.textContent = 'Saved Items';
    else sidebarTitle.textContent = __('messages');
  }
  
  const sidebarSearchInput = document.getElementById('sidebar-search');
  if (sidebarSearchInput) {
    if (tab === 'chats' && App.activeWaFilter === 'unread') {
      sidebarSearchInput.placeholder = 'Search unread chats';
    } else if (tab === 'chats' && App.activeWaFilter === 'groups') {
      sidebarSearchInput.placeholder = 'Search group chats';
    } else {
      sidebarSearchInput.placeholder = __('search') || 'Search conversations...';
    }
  }

  // Sidebar navigation — always show normal nav (Myself Chat accessible via More tab)
  const sidebarNav = document.getElementById('sidebar-nav-container');
  const sidebarTitleEl = document.getElementById('sidebar-app-title');
  const sidebarSubtitleEl = document.getElementById('sidebar-app-subtitle');
  
  if (sidebarNav) {
    if (sidebarTitleEl) sidebarTitleEl.textContent = "NSL Chat";
    if (sidebarSubtitleEl) sidebarSubtitleEl.textContent = "Secure messaging";
    
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
        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' ${isRequestsActive ? 1 : 0};">mark_email_read</span>
        <span class="hidden xl:block font-body-md text-body-md ${isRequestsActive ? 'font-semibold' : ''}">Requests</span>
      </button>
      <button class="${isMoreActive ? activeClass : inactiveClass}" onclick="switchTab('more')">
        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' ${isMoreActive ? 1 : 0};">bookmark</span>
        <span class="hidden xl:block font-body-md text-body-md ${isMoreActive ? 'font-semibold' : ''}">Saved</span>
      </button>
    `;
  }

  if (tab === 'calls')    { renderCallsTab(filter); return; }
  if (tab === 'more')     { renderMoreTab(); return; }
  if (tab === 'requests') { renderRequestsTab(); return; }

  const hasArchived = tab === 'chats' && App._archivedChatIds && App._archivedChatIds.size > 0;
  
  if (tab === 'chats' && (App.activeWaFilter || 'all') === 'unread' && !items.length) {
    hide('chats-empty');
    list.innerHTML = `
      <div class="wa-unread-empty-container" style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; min-height: 100%; padding: 40px 16px 16px 16px; text-align: center; box-sizing: border-box;">
        <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div class="wa-unread-empty-icon" style="width: 80px; height: 80px; border-radius: 50%; background: var(--wa-empty-icon-bg); display: flex; align-items: center; justify-content: center; margin-bottom: 24px; color: var(--wa-empty-icon-color);">
            <span class="material-symbols-outlined" style="font-size: 40px; font-variation-settings: 'FILL' 1;">check_circle</span>
          </div>
          <h3 class="wa-unread-empty-title" style="font-size: 20px; font-weight: 600; color: var(--wa-empty-title-color); margin-bottom: 8px;">No unread chats</h3>
          <p class="wa-unread-empty-desc" style="font-size: 14px; color: var(--wa-empty-desc-color); margin-bottom: 20px;">You're all caught up.</p>
          <button class="wa-unread-empty-link" onclick="setWaFilter('all')" style="font-size: 14px; color: var(--wa-empty-link-color); font-weight: 500; cursor: pointer; background: transparent; border: none; padding: 0; text-decoration: none; transition: all 0.15s ease;">View all chats</button>
        </div>
        
        <!-- Promo Desktop Card (Clickable to download the Android APK) -->
        <a href="my-team-chat.apk" download="my-team-chat.apk" class="wa-promo-card" style="width: 100%; margin-top: 32px; border-top: 1px solid var(--wa-empty-border-color); padding-top: 24px; display: flex; align-items: center; justify-content: center; gap: 12px; text-decoration: none; cursor: pointer; transition: opacity 0.15s ease;" onmouseover="this.style.opacity=0.75" onmouseout="this.style.opacity=1.0">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: var(--wa-empty-promo-bg); display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
            <span class="material-symbols-outlined" style="font-size: 22px; font-variation-settings: 'FILL' 1;">download</span>
          </div>
          <div style="text-align: left;">
            <div style="font-size: 13px; font-weight: 600; color: var(--wa-empty-title-color);">Download NSL Chat (APK)</div>
            <div style="font-size: 11px; color: var(--wa-empty-desc-color); margin-top: 2px;">Tap to install native Android application.</div>
          </div>
        </a>
      </div>`;
    return;
  }

  if (!items.length) {
    if (hasArchived) {
      hide('chats-empty');
    } else {
      list.innerHTML = '';
      show('chats-empty');
      return;
    }
  } else {
    hide('chats-empty');
  }

  // Pinned items first
  items.sort((a,b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.lastTime - a.lastTime;
  });

  const pinned   = items.filter(c=>c.pinned);
  const unpinned = items.filter(c=>!c.pinned);

  let html = '';
  if (hasArchived) {
    const unreadArchivedCount = App.chats.filter(c => App._archivedChatIds.has(c.id) && (c.unread > 0 || c.unreadReaction)).length;
    const archivedBadge = unreadArchivedCount > 0
      ? `<span class="text-[11px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">${unreadArchivedCount}</span>`
      : '';
    html += `
    <div class="flex items-center justify-between px-5 py-3 hover:bg-surface-container-high/40 cursor-pointer transition-colors border-b border-outline-variant/10" onclick="openArchivedChats()">
      <div class="flex items-center gap-3 text-on-surface">
        <span class="material-symbols-outlined text-primary text-xl">archive</span>
        <span class="text-sm font-semibold">Archived</span>
      </div>
      ${archivedBadge}
    </div>`;
  }
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
  renderEmojiInElement(list);

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
    ? `<div class="bg-secondary text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-2 shadow">${chat.unread}</div>`
    : (chat.unreadReaction
       ? `<div class="bg-secondary text-[11px] w-5 h-5 rounded-full flex items-center justify-center font-bold ml-2 shadow" title="New reaction">${chat.unreadReactionEmoji}</div>`
       : '');
  const pinIcon   = chat.pinned ? `<span class="material-symbols-outlined text-[13px] text-primary" style="font-variation-settings: 'FILL' 1;">push_pin</span>` : '';

  let name = chat.name;
  let avatar = chat.avatar;
  let initials = chat.initials || '?';
  let photoURL = chat.photoURL;
  let status = chat.status;

  if (chat.type === 'personal' && chat.id !== `saved_me` && !chat.id.startsWith('saved_')) {
    const contact = App.contacts.find(c => c.uid === chat.uid);
    if (contact) {
      name = contact.name;
      avatar = contact.avatar;
      initials = contact.initials;
      photoURL = contact.photoURL;
      status = contact.status;
    } else {
      // Unregistered or deleted user — show as Unknown
      name = 'Unknown User';
      initials = '';
      avatar = 'bg-surface-container-highest text-on-surface-variant';
      photoURL = null;
      status = 'offline';
    }
  }

  // Exact mockup selection class overrides
  const activeClass = isActive 
    ? 'bg-surface-variant/40 border-l-4 border-primary text-primary' 
    : 'hover:bg-surface-variant/30 text-on-surface';

  const statusDot = (chat.type === 'personal' && chat.id !== `saved_me` && status === 'online')
    ? `<div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-surface-container-low"></div>` : '';

  let avatarIconHtml = '';
  if (isMyselfChatId(chat.id)) {
    avatarIconHtml = `<div class="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary"><span class="material-symbols-outlined text-2xl">person</span></div>`;
  } else if (photoURL) {
    avatarIconHtml = `<img src="${photoURL}" alt="${escHtml(name)}" class="w-12 h-12 rounded-xl object-cover" loading="lazy">`;
  } else if (initials) {
    avatarIconHtml = `<div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${avatar || 'bg-surface-container-highest text-on-surface-variant'}">${initials}</div>`;
  } else {
    avatarIconHtml = `<div class="w-12 h-12 rounded-xl flex items-center justify-center bg-surface-container-highest text-on-surface-variant"><span class="material-symbols-outlined text-2xl">person_off</span></div>`;
  }

  const isSelected = App.selectedChatIds.includes(chat.id);

  return `
  <div class="relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${activeClass} ${isSelected ? 'ring-2 ring-primary' : ''}"
       onclick="${App.chatSelectionMode ? `toggleChatSelection('${chat.id}')` : `openChat('${chat.id}')`}"
       oncontextmenu="chatContextMenu(event,'${chat.id}')"
       role="listitem"
       tabindex="0"
       onkeydown="if(event.key==='Enter')openChat('${chat.id}')">
    <div class="relative flex-shrink-0">
      ${App.chatSelectionMode ? `<div class="absolute -left-1 -top-1 z-10 w-5 h-5 rounded-full border-2 ${isSelected ? 'bg-primary border-primary text-white' : 'bg-surface-container border-outline-variant'} flex items-center justify-center" onclick="event.stopPropagation();toggleChatSelection('${chat.id}')"><span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1;">${isSelected ? 'check' : ''}</span></div>` : ''}
      ${avatarIconHtml}
      ${statusDot}
    </div>
    <div class="flex-1 overflow-hidden">
      <div class="flex justify-between items-center mb-1">
        <span class="font-bold text-on-surface truncate ${isActive?'text-primary':''}">${escHtml(name)}</span>${chat.imported ? '<span class="text-[9px] text-on-surface-variant ml-1">📥</span>' : ''}
        <span class="font-timestamp text-timestamp text-on-surface-variant">${timeStr}</span>
      </div>
      <div class="flex justify-between items-center">
        <p class="text-xs text-on-surface-variant truncate pr-2 ${chat.unreadReaction ? 'text-primary font-semibold' : ''}">
          ${chat.unreadReaction 
            ? `Reacted ${chat.unreadReactionEmoji} to: "${escHtml(chat.unreadReactionText || '')}"`
            : escHtml(chat.lastMsg || '')}
        </p>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          ${pinIcon}
          ${unreadBadge}
        </div>
      </div>
    </div>
  </div>`;
}

/* ─── Multi-select Chat ─── */
function toggleChatSelectionMode() {
  App.chatSelectionMode = !App.chatSelectionMode;
  if (!App.chatSelectionMode) {
    App.selectedChatIds = [];
  }
  document.getElementById('btn-multi-select')?.classList.toggle('text-primary', App.chatSelectionMode);
  document.getElementById('btn-select-all')?.classList.toggle('hidden', !App.chatSelectionMode);
  document.getElementById('btn-delete-selected')?.classList.add('hidden');
  renderChatList();
}

function toggleChatSelection(chatId) {
  const idx = App.selectedChatIds.indexOf(chatId);
  if (idx >= 0) {
    App.selectedChatIds.splice(idx, 1);
  } else {
    App.selectedChatIds.push(chatId);
  }
  document.getElementById('btn-delete-selected')?.classList.toggle('hidden', App.selectedChatIds.length === 0);
  renderChatList();
}

function toggleSelectAllChats() {
  const tab = App.activeTab;
  let items = App.chats.filter(c => {
    if (tab === 'chats') return c.type === 'personal' || c.type === 'group';
    if (tab === 'groups') return c.type === 'group';
    return true;
  });
  if (App.selectedChatIds.length === items.length) {
    App.selectedChatIds = [];
  } else {
    App.selectedChatIds = items.map(c => c.id);
  }
  document.getElementById('btn-delete-selected')?.classList.toggle('hidden', App.selectedChatIds.length === 0);
  renderChatList();
}

async function deleteSelectedChats() {
  const ids = [...App.selectedChatIds];
  if (!ids.length) return;
  showConfirm(`Delete ${ids.length} chat(s)? This cannot be undone.`, async () => {
    for (const chatId of ids) {
      App.chats = App.chats.filter(c => c.id !== chatId);
      App.directChats = App.directChats.filter(c => c.id !== chatId);
      App.groupChats = App.groupChats.filter(c => c.id !== chatId);
      delete App.messages[chatId];
      addDeletedChatId(chatId);
      App._deletedChatIds.add(chatId);
      if (App.db) {
        const uid = App.auth?.currentUser?.uid;
        // Mark as deleted for this user (cross-device sync)
        if (uid) {
          try { await App.db.collection('directChats').doc(chatId).update({ [`deletedFor.${uid}`]: true }); } catch (e) { /* doc may not exist */ }
          try { await App.db.collection('groups').doc(chatId).update({ [`deletedFor.${uid}`]: true }); } catch (e) { /* doc may not exist */ }
        }
        // Delete all associated messages (both directId and groupId), chunked by 500
        try {
          const dirMsgs = await App.db.collection('messages').where('directId', '==', chatId).get();
          const grpMsgs = await App.db.collection('messages').where('groupId', '==', chatId).get();
          const allRefs = [...dirMsgs.docs.map(d => d.ref), ...grpMsgs.docs.map(d => d.ref)];
          for (let i = 0; i < allRefs.length; i += 500) {
            const batch = App.db.batch();
            allRefs.slice(i, i + 500).forEach(ref => batch.delete(ref));
            await batch.commit();
          }
        } catch (e) { console.warn('Delete messages error:', e); }
      }
    }
    App.selectedChatIds = [];
    App.chatSelectionMode = false;
    document.getElementById('btn-multi-select')?.classList.remove('text-primary');
    document.getElementById('btn-select-all')?.classList.add('hidden');
    document.getElementById('btn-delete-selected')?.classList.add('hidden');
    if (App.currentChat && ids.includes(App.currentChat.id)) {
      App.currentChat = null;
      document.getElementById('chat-area')?.classList.add('hidden');
      document.getElementById('chat-header')?.style.setProperty('display', 'none');
    }
    renderChatList();
    showToast(`${ids.length} chat(s) deleted`, 'info');
  });
}

function renderCallsTab(filter = '') {
  const list = document.getElementById('chat-list');
  let logs = App.callLogs || [];
  const uid = App.auth?.currentUser?.uid;

  if (filter) {
    const q = filter.toLowerCase();
    logs = logs.filter(log => {
      const isIncoming = log.calleeId === uid;
      const otherId = isIncoming ? log.callerId : log.calleeId;
      const contact = App.contacts.find(c => c.uid === otherId) || App.chats.find(c => c.uid === otherId) || {};
      const name = contact.name || 'Unknown';
      return name.toLowerCase().includes(q) || (log.status || '').toLowerCase().includes(q) || (log.type || '').toLowerCase().includes(q);
    });
  }

  if (!logs.length) {
    list.innerHTML = `
      <div class="flex flex-col items-center py-12 text-center w-full">
        <div class="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4 border border-outline-variant/20 shadow-md">
          <span class="material-symbols-outlined text-secondary text-3xl">call</span>
        </div>
        <h4 class="font-bold mb-1">${filter ? 'No results found' : 'No call logs'}</h4>
        <p class="text-on-surface-variant text-xs max-w-xs">${filter ? 'Try searching for another participant or call type.' : 'Start high-definition calls directly with any of your workspace team members.'}</p>
      </div>`;
    return;
  }
  const isSelMode = App.callSelectionMode;
  let html = '';
  logs.forEach(log => {
    const isIncoming = log.calleeId === uid;
    const otherId = isIncoming ? log.callerId : log.calleeId;
    const contact = App.contacts.find(c => c.uid === otherId);
    const isSelected = App.selectedCallIds.includes(log.id);
    
    // If not in App.contacts, it's an unregistered/deleted user
    const name = contact ? contact.name : 'Unknown User';
    const initials = contact ? contact.initials : '';
    const avatarHtml = initials
      ? `<div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg bg-surface-container-highest text-on-surface-variant flex-shrink-0">${initials}</div>`
      : `<div class="w-12 h-12 rounded-xl flex items-center justify-center bg-surface-container-highest text-on-surface-variant flex-shrink-0"><span class="material-symbols-outlined">person_off</span></div>`;
    
    const icon = log.type === 'video' ? 'videocam' : 'call';
    const dirIcon = isIncoming ? 'call_received' : 'call_made';
    const statusClass = log.status === 'missed' ? 'text-red-500' : (log.status === 'ended' ? 'text-on-surface-variant' : 'text-green-500');
    const durationStr = log.duration ? `${Math.floor(log.duration/60)}:${(log.duration%60).toString().padStart(2,'0')} min` : '';
    const timeStr = log.timestamp ? formatChatTime(log.timestamp) : '';
    html += `
      <div class="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-surface-container/40 transition-all ${isSelected ? 'ring-2 ring-primary' : ''}"
           oncontextmenu="callLogContextMenu(event,'${log.id}')">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          ${isSelMode ? `<div class="flex-shrink-0 w-5 h-5 rounded-full border-2 ${isSelected ? 'bg-primary border-primary text-white' : 'bg-surface-container border-outline-variant'} flex items-center justify-center cursor-pointer" onclick="event.stopPropagation();toggleCallSelection('${log.id}')"><span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1;">${isSelected ? 'check' : ''}</span></div>` : ''}
          ${avatarHtml}
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
        </div>
        ${isSelMode ? '' : `
        <div class="flex items-center gap-1">
          <button class="p-2 hover:bg-green-500/10 hover:text-green-500 rounded-full flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer text-on-surface-variant/70" onclick="event.stopPropagation(); callFromLog('${otherId}','voice')" title="Voice call">
            <span class="material-symbols-outlined text-lg">call</span>
          </button>
          <button class="p-2 hover:bg-blue-500/10 hover:text-blue-500 rounded-full flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer text-on-surface-variant/70" onclick="event.stopPropagation(); callFromLog('${otherId}','video')" title="Video call">
            <span class="material-symbols-outlined text-lg">videocam</span>
          </button>
          <button class="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer text-on-surface-variant/70 hover:text-red-500" onclick="event.stopPropagation(); deleteCallLog('${log.id}')" title="Delete Call Log">
            <span class="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>`}
      </div>`;
  });
  list.innerHTML = html;
}

async function deleteCallLog(logId) {
  if (!App._deletedCallLogIds) App._deletedCallLogIds = new Set();
  App._deletedCallLogIds.add(logId);
  App.callLogs = (App.callLogs || []).filter(l => l.id !== logId);
  if (App.activeTab === 'calls') renderCallsTab();
  if (!App.db) {
    showToast('Call log deleted (Demo)', 'info');
    return;
  }
  try {
    await App.db.collection('callLogs').doc(logId).delete();
    // Also try to mark the corresponding calls collection doc as deleted
    try {
      await App.db.collection('calls').doc(logId).update({ status: 'deleted' });
    } catch (_) { /* calls doc may not exist */ }
    addDeletedCallId(logId);
    showToast('Call log deleted', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to delete call log', 'error');
    // Revert deletion tracking on failure
    App._deletedCallLogIds.delete(logId);
    App.callLogs = (App.callLogs || []).concat([{ id: logId }]);
    if (App.activeTab === 'calls') renderCallsTab();
  }
}

function confirmDeleteCallLog(logId) {
  showConfirm('Delete this call log?', () => deleteCallLog(logId));
}

/* ─── Calls Multi-select ─── */
function toggleCallSelectionMode() {
  App.callSelectionMode = !App.callSelectionMode;
  if (!App.callSelectionMode) App.selectedCallIds = [];
  document.getElementById('btn-call-multi-select')?.classList.toggle('text-primary', App.callSelectionMode);
  document.getElementById('btn-call-select-all')?.classList.toggle('hidden', !App.callSelectionMode);
  document.getElementById('btn-call-delete-selected')?.classList.add('hidden');
  if (App.activeTab === 'calls') renderCallsTab();
}

function toggleCallSelection(logId) {
  const idx = App.selectedCallIds.indexOf(logId);
  if (idx >= 0) App.selectedCallIds.splice(idx, 1);
  else App.selectedCallIds.push(logId);
  document.getElementById('btn-call-delete-selected')?.classList.toggle('hidden', App.selectedCallIds.length === 0);
  if (App.activeTab === 'calls') renderCallsTab();
}

function toggleSelectAllCalls() {
  const logs = App.callLogs || [];
  if (App.selectedCallIds.length === logs.length) {
    App.selectedCallIds = [];
  } else {
    App.selectedCallIds = logs.map(l => l.id);
  }
  document.getElementById('btn-call-delete-selected')?.classList.toggle('hidden', App.selectedCallIds.length === 0);
  if (App.activeTab === 'calls') renderCallsTab();
}

function deleteSelectedCalls() {
  const ids = [...App.selectedCallIds];
  if (!ids.length) return;
  showConfirm(`Delete ${ids.length} call log(s)?`, async () => {
    if (!App._deletedCallLogIds) App._deletedCallLogIds = new Set();
    ids.forEach(id => App._deletedCallLogIds.add(id));
    App.callLogs = (App.callLogs || []).filter(l => !ids.includes(l.id));
    App.selectedCallIds = [];
    App.callSelectionMode = false;
    document.getElementById('btn-call-multi-select')?.classList.remove('text-primary');
    document.getElementById('btn-call-select-all')?.classList.add('hidden');
    document.getElementById('btn-call-delete-selected')?.classList.add('hidden');
    if (App.activeTab === 'calls') renderCallsTab();
    if (App.db) {
      for (const id of ids) {
        try {
          await App.db.collection('callLogs').doc(id).delete();
          try { await App.db.collection('calls').doc(id).update({ status: 'deleted' }); } catch (_) {}
        } catch (e) { console.warn('Failed to delete call log:', id, e); }
        addDeletedCallId(id);
      }
    }
    showToast(`${ids.length} call log(s) deleted`, 'info');
  });
}

/* ─── Export / Import Chat ─── */
function exportChatAsZip(chatId) {
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) { showToast('Chat not found', 'error'); return; }
  const msgs = App.messages[chatId] || [];
  const safeName = chat.name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'chat';
  
  const messageRows = msgs.map(m => {
    const from = m.from === 'me' ? 'You' : 'Other';
    const time = new Date(m.time).toLocaleString();
    const text = escHtml(m.text || '');
    const att = m.type && m.type !== 'text' ? `<br><small>[${m.type}: ${escHtml(m.fileName||m.url||'')}]</small>` : '';
    const dur = m.duration ? ` · ${m.duration}` : '';
    return `<tr><td style="padding:6px 12px;border-bottom:1px solid #333;white-space:nowrap;color:#888">${time}</td><td style="padding:6px 12px;border-bottom:1px solid #333;font-weight:700;color:${from==='You'?'#4ade80':'#60a5fa'}">${from}</td><td style="padding:6px 12px;border-bottom:1px solid #333">${text}${att}${dur}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${escHtml(chat.name)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#111;color:#eee;padding:20px}
h1{color:#4ade80;margin-bottom:4px}
.sub{color:#888;font-size:13px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;padding:8px 12px;border-bottom:2px solid #4ade80;color:#4ade80}
</style></head>
<body><h1>${escHtml(chat.name)}</h1>
<div class="sub">${msgs.length} messages · ${chat.type || 'personal'} · Exported ${new Date().toLocaleString()}</div>
<table><thead><tr><th>Time</th><th>From</th><th>Message</th></tr></thead><tbody>${messageRows}</tbody></table></body></html>`;

  const data = {
    chatName: chat.name,
    chatType: chat.type,
    exportTime: Date.now(),
    messages: msgs.map(m => ({
      from: m.from,
      text: m.text,
      type: m.type || 'text',
      url: m.url || '',
      fileName: m.fileName || '',
      fileSize: m.fileSize || '',
      duration: m.duration || '',
      time: m.time,
      reactions: m.reactions || [],
    }))
  };

  if (typeof JSZip === 'undefined') {
    showToast('JSZip library not loaded', 'error');
    return;
  }
  const zip = new JSZip();
  zip.file(`${safeName}.html`, html);
  zip.file(`${safeName}.json`, JSON.stringify(data, null, 2));
  zip.generateAsync({ type: 'blob' }).then(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Chat exported', 'success');
  });
}

function importChatFromZip() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.zip';
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (typeof JSZip === 'undefined') { showToast('JSZip library not loaded', 'error'); return; }
    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = Object.values(zip.files).find(f => f.name.endsWith('.json'));
      if (!jsonFile) { showToast('Invalid chat export: no JSON found', 'error'); return; }
      const content = await jsonFile.async('string');
      const data = JSON.parse(content);
      if (!data.chatName || !data.messages) { showToast('Invalid chat export format', 'error'); return; }
      
      const importId = 'imported_' + Date.now();
      const importedMsgs = data.messages.map(m => ({ ...m, id: 'imp_' + Date.now() + '_' + Math.random().toString(36).slice(2,6) }));
      
      App.messages[importId] = importedMsgs;
      
      const existing = App.chats.find(c => c.name === data.chatName);
      if (existing) {
        App.messages[existing.id] = importedMsgs;
        if (App.currentChat?.id === existing.id) renderMessages(existing.id);
        showToast(`Imported ${importedMsgs.length} messages into ${data.chatName}`, 'success');
        return;
      }
      
      // Create imported chat entry
      const chatEntry = {
        id: importId,
        name: data.chatName,
        type: 'personal',
        lastMsg: importedMsgs[importedMsgs.length-1]?.text || 'Imported chat',
        lastTime: Date.now(),
        unread: 0,
        initials: data.chatName.charAt(0).toUpperCase(),
        imported: true,
        importedReadOnly: true,
      };
      App.chats.push(chatEntry);
      App.currentChat = chatEntry;
      renderMessages(importId);
      scrollToBottom(true);
      renderChatList();
      document.getElementById('chat-header')?.style.removeProperty('display');
      document.getElementById('chat-area')?.classList.remove('hidden');
      showToast('Chat imported — send a request to start messaging', 'info');
    } catch (e) {
      console.error(e);
      showToast('Failed to import chat', 'error');
    }
  };
  input.click();
}

/* ─── Orphaned Chat Merge on Re-registration ─── */
function mergeOrphanedChats(newUid, email) {
  if (!App.db || !email) return;
  const emailLower = email.toLowerCase();
  
  // Phase 1: Find orphaned chats by scanning Firestore directChats
  App.db.collection('directChats')
    .where('participantEmailList', 'array-contains', email)
    .get()
    .then(snap => {
      snap.forEach(doc => {
        const data = doc.data();
        if (!data.participants) return;
        // Identify the "other" participant (not the current user's old or new UID)
        const participantEmails = data.participantEmails || {};
        const myOldUid = Object.entries(participantEmails).find(([k, v]) => v === email)?.[0];
        const otherId = data.participants.find(p => myOldUid ? p !== myOldUid : p !== newUid) || data.participants[0];
        if (!otherId) return;
        if (Object.values(participantEmails).includes(email)) {
          // This chat has our email but with a different UID — migrate it
          const expectedId = getDirectChatId(newUid, otherId);
          if (doc.id !== expectedId) {
            console.log('[Merge] Migrating directChats doc:', doc.id, '->', expectedId);
            App.db.collection('directChats').doc(expectedId).set(data, { merge: true }).then(() => {
              return App.db.collection('directChats').doc(doc.id).delete();
            }).then(() => {
              // Update messages with old directId
              return App.db.collection('messages').where('directId', '==', doc.id).get();
            }).then(msgSnap => {
              const batch = App.db.batch();
              msgSnap.forEach(m => {
                batch.update(m.ref, { directId: expectedId, participants: firebase.firestore.FieldValue.arrayUnion(newUid) });
              });
              return batch.commit();
            }).then(() => {
              // Update senderId in messages where it matches the old UID (not the other user)
              if (myOldUid && myOldUid !== newUid) {
                return App.db.collection('messages')
                  .where('senderId', '==', myOldUid)
                  .where('directId', '==', expectedId)
                  .get().then(senderSnap => {
                    const batch = App.db.batch();
                    let fixed = 0;
                    senderSnap.forEach(m => { batch.update(m.ref, { senderId: newUid }); fixed++; });
                    if (fixed > 0) console.log('[Merge] Fixed', fixed, 'message senderIds');
                    return batch.commit();
                  });
              }
            }).then(() => {
              showToast('Previous chat history merged to your new account', 'info');
              // Reload chats subscription to pick up changes
              subscribeToChats();
            }).catch(e => console.warn('[Merge] Migration error:', e));
          }
        }
      });
    }).catch(() => {});
  
  // Phase 2: Update local state for chats already loaded
  App.chats.forEach(chat => {
    if (chat.type !== 'personal' || isMyselfChatId(chat.id) || !chat.uid || chat.uid === newUid) return;
    const contact = App.contacts.find(c => c.uid === chat.uid);
    if (contact) return;
    if (chat.email && chat.email.toLowerCase() === emailLower) {
      console.log('[Merge] Updating local chat uid:', chat.name, chat.uid, '->', newUid);
      chat.uid = newUid;
    }
  });
  
  // Phase 3: Fix senderId and directId in messages for all chats involving this email
  App.db.collection('messages')
    .where('participantEmails', 'array-contains', email)
    .get()
    .then(snap => {
      const batch = App.db.batch();
      let count = 0;
      snap.forEach(doc => {
        const data = doc.data();
        // Fix directId: messages may reference old chat ID with old UID
        if (data.directId && data.participants) {
          const otherParticipant = data.participants.find(p => p !== newUid);
          if (otherParticipant) {
            const correctId = getDirectChatId(newUid, otherParticipant);
            if (data.directId !== correctId) {
              batch.update(doc.ref, { directId: correctId });
              count++;
            }
          }
        }
        // Fix senderId: only fix messages where senderId is the old UID of THIS user
        if (data.senderId && data.senderId !== newUid && data.participantEmails) {
          const senderEmail = data.participantEmails[data.senderId];
          if (senderEmail && senderEmail.toLowerCase() === emailLower) {
            batch.update(doc.ref, { senderId: newUid });
            count++;
          }
        }
      });
      if (count > 0) {
        batch.commit().then(() => {
          console.log('[Merge] Fixed', count, 'message(s) with old UID');
          renderChatList();
        }).catch(e => console.warn('[Merge] Message fix error:', e));
      }
    }).catch(() => {});

  // Phase 4: Find groups where this user or any other re-registered user has a stale member UID, and update to current UIDs
  App.db.collection('groups').get().then(snap => {
    const activeUids = new Set(App.contacts.map(c => c.uid));
    activeUids.add(newUid);
    const otherContact = App.contacts.find(c => c.uid !== newUid);

    snap.forEach(doc => {
      const data = doc.data();
      const memberIds = data.memberIds || [];
      const members = data.members || [];
      const adminIds = data.adminIds || [];
      let updated = false;

      const newMemberIds = memberIds.map(id => {
        if (activeUids.has(id)) return id;
        updated = true;
        if (otherContact) return otherContact.uid;
        return id;
      });

      const newMembers = members.map(id => {
        if (activeUids.has(id)) return id;
        updated = true;
        if (otherContact) return otherContact.uid;
        return id;
      });

      const newAdminIds = adminIds.map(id => {
        if (activeUids.has(id)) return id;
        updated = true;
        if (otherContact) return otherContact.uid;
        return id;
      });

      if (updated) {
        console.log('[Merge-Group] Migrating group UIDs for group:', doc.id);
        App.db.collection('groups').doc(doc.id).update({
          memberIds: newMemberIds,
          members: newMembers,
          adminIds: newAdminIds
        }).then(() => {
          if (typeof subscribeToGroups === 'function') subscribeToGroups();
        }).catch(err => console.warn('[Merge-Group] failed:', err));
      }
    });
  }).catch(() => {});
}

/* ─── Detect & merge orphaned chats for ANY user (User A side) ───
   When a contact re-registers (new UID, same email), User A may have
   TWO directChats docs: old one with stale UID + new one. This detects
   that and merges the old into the new. Runs a Firestore query so it
   catches orphans even if they were filtered from the UI list. */
function detectAndMergeOrphanedChatsForUser() {
  if (!App.db || !App.auth?.currentUser) return;
  const myUid = App.auth.currentUser.uid;
  const myEmail = (App.currentUser?.email || '').toLowerCase();
  if (!myEmail) return;

  // Query Firestore for ALL directChats involving this user (not just App.directChats
  // which may have already filtered stale chats from the UI)
  App.db.collection('directChats')
    .where('participants', 'array-contains', myUid)
    .get()
    .then(snap => {
      snap.forEach(doc => {
        const data = doc.data();
        if (!data.participants) return;
        const otherUserId = data.participants.find(p => p !== myUid);
        if (!otherUserId) return;
        const chatEmail = (data.participantEmails?.[otherUserId] || '').toLowerCase();
        if (!chatEmail || chatEmail === myEmail) return;

        // Check if the other user's UID is stale (re-registered)
        const realContact = App.contacts.find(c => c.email && c.email.toLowerCase() === chatEmail);
        if (!realContact) return; // no known current UID for this email
        if (realContact.uid === otherUserId) return; // UID is current, no merge needed

        // This chat has a stale UID — merge it
        console.log('[Merge-A] Orphaned chat found:', doc.id, 'stale UID:', otherUserId, '-> current:', realContact.uid);
        _mergeOldChatForUserA(otherUserId, realContact.uid, chatEmail, myUid);
      });
    }).catch(() => {});
}

/* Merge an old directChats doc (stale UID) into the current one for User A */
function _mergeOldChatForUserA(oldUid, newUid, peerEmail, myUid) {
  const oldChatId = getDirectChatId(myUid, oldUid);
  const newChatId = getDirectChatId(myUid, newUid);

  // If the new chat doesn't exist yet, create it from the old one
  App.db.collection('directChats').doc(newChatId).get().then(newDoc => {
    const promises = [];

    if (!newDoc.exists) {
      // Copy old chat data to new chat ID
      promises.push(
        App.db.collection('directChats').doc(oldChatId).get().then(oldDoc => {
          if (!oldDoc.exists) return;
          const oldData = oldDoc.data();
          return App.db.collection('directChats').doc(newChatId).set({
            participants: [myUid, newUid],
            participantNames: { [myUid]: App.currentUser?.displayName || 'Me', [newUid]: oldData.participantNames?.[oldUid] || peerEmail.split('@')[0] },
            participantEmails: { [myUid]: App.currentUser?.email || '', [newUid]: peerEmail },
            participantEmailList: [App.currentUser?.email || '', peerEmail],
            status: 'active',
            lastMessage: oldData.lastMessage || null,
            lastMessageTime: oldData.lastMessageTime || null
          }, { merge: true });
        })
      );
    }

    // Migrate messages: update directId and participants
    promises.push(
      App.db.collection('messages').where('directId', '==', oldChatId).get().then(msgSnap => {
        if (msgSnap.empty) return;
        const batch = App.db.batch();
        msgSnap.forEach(m => {
          batch.update(m.ref, {
            directId: newChatId,
            participants: firebase.firestore.FieldValue.arrayUnion(newUid)
          });
        });
        return batch.commit();
      })
    );

    // Delete the old directChats doc
    promises.push(
      App.db.collection('directChats').doc(oldChatId).delete().catch(() => {})
    );

    return Promise.all(promises);
  }).then(() => {
    // Update local state: remove old chat from App.chats / App.directChats
    App.directChats = (App.directChats || []).filter(c => c.id !== oldChatId);
    App.chats = (App.chats || []).filter(c => c.id !== oldChatId);
    // If we don't have the new chat locally yet, add it
    if (!App.directChats.find(c => c.id === newChatId)) {
      const contact = App.contacts.find(c => c.uid === newUid) || {};
      App.directChats.push({
        id: newChatId, type: 'personal', uid: newUid,
        name: contact.name || peerEmail.split('@')[0],
        avatar: contact.avatar || 'gradient-2',
        initials: contact.initials || '',
        photoURL: contact.photoURL || null,
        about: contact.about || peerEmail,
        lastMsg: 'Chat merged', lastTime: Date.now(),
        unread: 0, pinned: false, muted: false, status: 'offline', email: peerEmail
      });
    }
    mergeAndRenderChats();
    showToast('Chat history merged', 'info');
  }).catch(e => console.warn('[Merge-A] Error:', e));
}

function openCallPicker() {
  const list = document.getElementById('call-picker-list');
  if (!list) return;
  const uid = App.auth?.currentUser?.uid;
  let items = App.chats.filter(c => (c.type === 'personal' || c.type === 'group') && !isMyselfChatId(c.id));
  list.innerHTML = items.map(c => {
    const initials = c.initials || '';
    const avatar = c.photoURL
      ? `<img src="${c.photoURL}" alt="${escHtml(c.name)}" class="w-10 h-10 rounded-full object-cover" loading="lazy">`
      : initials
        ? `<div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-surface-container-highest text-on-surface-variant">${initials}</div>`
        : `<div class="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant"><span class="material-symbols-outlined text-lg">person_off</span></div>`;
    return `<div class="flex items-center justify-between p-3 rounded-xl hover:bg-surface-variant/30 transition-all">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        ${avatar}
        <div class="min-w-0">
          <div class="font-bold text-sm text-on-surface truncate">${escHtml(c.name)}</div>
          <div class="text-[10px] text-on-surface-variant">${c.type === 'group' ? 'Group' : 'Personal'}</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class="w-9 h-9 rounded-full bg-green-500/10 text-green-500 hover:bg-green-500/20 flex items-center justify-center transition-all" onclick="closeModal('call-picker-overlay');callFromLog('${c.uid || c.id}','voice')" title="Voice call"><span class="material-symbols-outlined text-lg">call</span></button>
        <button class="w-9 h-9 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 flex items-center justify-center transition-all" onclick="closeModal('call-picker-overlay');callFromLog('${c.uid || c.id}','video')" title="Video call"><span class="material-symbols-outlined text-lg">videocam</span></button>
      </div>
    </div>`;
  }).join('');
  show('call-picker-overlay');
}

function callFromLog(otherUid, type) {
  const chat = App.chats.find(c => c.uid === otherUid) || App.chats.find(c => c.id === otherUid);
  if (!chat) {
    showToast('Chat not found for this user', 'error');
    return;
  }
  App.currentChat = chat;
  renderMessages(chat.id);
  scrollToBottom(true);
  renderChatList();
  document.getElementById('chat-header')?.style.removeProperty('display');
  document.getElementById('chat-area')?.classList.remove('hidden');
  beginCall(type);
}

function renderMoreTab() {
  const uid = App.currentUser?.uid;
  const savedChatId = uid ? `saved_${uid}` : 'saved_me';
  const archivedCount = App._archivedChatIds ? App._archivedChatIds.size : 0;
  const list = document.getElementById('chat-list');
  list.innerHTML = `
    <div class="p-4 space-y-1">
      <div class="text-[11px] font-bold text-on-surface-variant uppercase px-3 pb-2 pt-1 tracking-wider" style="opacity: 0.7;">Saved & Archive</div>
      ${moreRow('person','Myself Chat',`openChat('${savedChatId}')`)}
      ${moreRow('star','Starred Messages','openStarredMessages()')}
      ${moreRow('archive','Archived Chats' + (archivedCount > 0 ? ` <span class="ml-1 text-[10px] bg-surface-variant rounded-full px-1.5 py-0.5 font-bold">${archivedCount}</span>` : ''),'openArchivedChats()')}
      ${moreRow('folder','Folders','openFolderManager()')}
      
      <div class="text-[11px] font-bold text-on-surface-variant uppercase px-3 pb-2 pt-4 tracking-wider" style="opacity: 0.7;">NSL Utilities</div>
      ${moreRow('receipt_long','Expense Splitter',"window.location.href='expenses.html'")}
      ${moreRow('photo_library','Shared Album',"window.location.href='album.html'")}
      ${moreRow('queue_music','Music Library','openMusicLibrary()')}
      ${moreRow('download','Chat Export','openChatExport()')}
      ${moreRow('calendar_month','Team Calendar',"window.location.href='calendar.html'")}
      ${moreRow('monitoring','Chat Insights',"window.location.href='insights.html'")}

      <div class="text-[11px] font-bold text-on-surface-variant uppercase px-3 pb-2 pt-4 tracking-wider" style="opacity: 0.7;">🔒 Privacy & Safety</div>
      ${moreRow('lock','Chat Lock','openChatLockSettings()')}
      ${moreRow('ghost_program','Ghost Mode','openGhostModeSettings()')}

      <div class="text-[11px] font-bold text-on-surface-variant uppercase px-3 pb-2 pt-4 tracking-wider" style="opacity: 0.7;">🎮 Fun & Engagement</div>
      ${moreRow('sports_esports','Mini Games','openMiniGames()')}
      ${moreRow('mood','Mood / Status','openMoodPicker()')}
      ${moreRow('cake','Date Reminders','openDateReminders()')}
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
        <button onclick="cancelChatRequest('${r.id}')" style="padding:4px 10px;border-radius:8px;border:1px solid var(--outline-variant);background:transparent;color:var(--on-surface-variant);font-size:11px;font-weight:600;cursor:pointer;margin-left:8px">Cancel</button>
      </div>
    `).join('');
  }
  list.innerHTML = html;
}

/* ══════════════════════════════════════════════════
   9. OPEN CHAT & STATE SYNC
   ══════════════════════════════════════════════════ */
function isMyselfChatId(id) {
  if (!id) return false;
  if (id === 'saved_me') return true;
  if (id.startsWith('saved_')) return true;
  const uid = App.auth?.currentUser?.uid;
  return uid && id === `saved_${uid}`;
}

function openChat(chatId) {
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) return;

  if (App.currentChat && App.currentChat.id !== chatId) {
    if (typeof stopLiveLocation === 'function') stopLiveLocation();
  }

  App.currentChat = chat;
  chat.unread = 0;
  chat.unreadReaction = false;
  delete chat.unreadReactionEmoji;
  delete chat.unreadReactionText;
  delete chat.unreadReactionMsgId;

  // Update header mute icon to reflect current chat's mute state
  _updateChatMuteIcon(chatId);

  // Sync read status to Firestore
  if (App.db && App.auth?.currentUser && !isMyselfChatId(chatId)) {
    const uid = App.auth.currentUser.uid;
    const isGroup = chat.type === 'group';
    const collection = isGroup ? 'groups' : 'directChats';
    
    // Clear unread count in Firestore
    const unreadUpdate = {};
    unreadUpdate[`unreadCount.${uid}`] = 0;
    App.db.collection(collection).doc(chatId).set(unreadUpdate, { merge: true }).catch(() => {});
    
    // Mark received messages as read
    const msgs = App.messages[chatId] || [];
    const unreadMsgIds = msgs.filter(m => m.from !== 'me' && m.status !== 'read').map(m => m.id);
    if (unreadMsgIds.length > 0) {
      const batch = App.db.batch();
      unreadMsgIds.forEach(msgId => {
        if (msgId && !msgId.startsWith('msg_')) {
          const msgRef = App.db.collection('messages').doc(msgId);
          batch.update(msgRef, { read: true, status: 'read' });
        }
      });
      batch.commit().catch(() => {});
    }
  }

  subscribeToTyping(chatId);
  loadPinnedMessages(chatId);

  // Render header title & icons
  const headerName = document.getElementById('header-name');
  if (headerName) headerName.textContent = chat.name;
  
  const headerStatus = document.getElementById('header-status');
  const statusDot = document.getElementById('header-status-dot');

  // Adapt Header actions based on chat type
  const actionContainer = document.getElementById('header-actions-container');
  
  if (isMyselfChatId(chat.id)) {
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
      const muted = App._mutedChats?.has(chat.id);
      actionContainer.innerHTML = `
        <button class="text-on-surface-variant hover:text-primary transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="startGroupVoiceCall()"><span class="material-symbols-outlined">call</span></button>
        <button class="text-on-surface-variant hover:text-primary transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="startGroupVideoCall()"><span class="material-symbols-outlined">videocam</span></button>
        <button class="text-on-surface-variant hover:text-on-surface transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="openChatSearch()"><span class="material-symbols-outlined">search</span></button>
        <button class="text-on-surface-variant hover:text-on-surface transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="toggleMuteChat()" title="${muted ? 'Unmute' : 'Mute'}"><span class="material-symbols-outlined">${muted ? 'notifications_off' : 'notifications'}</span></button>
        <button class="text-on-surface-variant hover:text-on-surface transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="openChatMenu(this)"><span class="material-symbols-outlined">more_vert</span></button>
      `;
    }
    const msgInput = document.getElementById('msg-input');
    if (msgInput) msgInput.placeholder = "Message in Dev Team...";
  } else {
    // Personal Chat header
    const contact = App.contacts.find(c=>c.uid===chat.uid) || App.chats.find(c=>c.uid===chat.uid);
    let statusText;
    if (contact?.status === 'online') {
      statusText = 'Active Now';
    } else if (contact?.lastSeen) {
      statusText = 'last seen ' + formatLastSeenTime(contact.lastSeen);
    } else {
      statusText = contact?.about || '';
    }
    if (headerStatus) {
      headerStatus.textContent = statusText;
      headerStatus.className = "text-[10px] text-primary-fixed-dim uppercase tracking-widest font-label-caps" + (contact?.status === 'online' ? ' text-green-500' : ' text-on-surface-variant');
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
      const muted = App._mutedChats?.has(chat.id);
      actionContainer.innerHTML = `
        <button class="text-on-surface-variant hover:text-primary transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="startVoiceCall()"><span class="material-symbols-outlined">call</span></button>
        <button class="text-on-surface-variant hover:text-primary transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="startVideoCall()"><span class="material-symbols-outlined">videocam</span></button>
        <button class="text-on-surface-variant hover:text-on-surface transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="openChatSearch()"><span class="material-symbols-outlined">search</span></button>
        <button class="text-on-surface-variant hover:text-on-surface transition-all p-2 rounded-full hover:bg-surface-container/50" onclick="toggleMuteChat()" title="${muted ? 'Unmute' : 'Mute'}"><span class="material-symbols-outlined">${muted ? 'notifications_off' : 'notifications'}</span></button>
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
      ha.innerHTML = `<img src="${escHtml(chat.photoURL)}" alt="${escHtml(chat.name)}" class="w-10 h-10 rounded-full object-cover" loading="lazy">`;
    } else {
      ha.textContent = chat.initials;
      ha.className = `w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-surface-container-highest text-on-surface-variant`;
    }
  }

  // Resizing layouts for mobile view override
  if (window.innerWidth < 768 || App.showroomViewport === 'mobile') {
    const chatArea = document.getElementById('chat-area');
    if (chatArea) { chatArea.classList.remove('hidden-mobile'); chatArea.classList.add('visible-mobile'); }
    const listSidebar = document.getElementById('chat-list-sidebar');
    if (listSidebar) listSidebar.classList.add('hidden');
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('hidden');
  }

  // Display canvas
  hide('welcome-screen');
  show('chat-header');
  show('messages-wrap');
  const inputBar = document.getElementById('input-bar');
  
  // Handle imported/read-only chats
  if (chat.imported) {
    if (inputBar) {
      if (chat.requestSent) {
        inputBar.innerHTML = `<div class="p-4 text-center text-xs text-on-surface-variant bg-surface-container-high/50 rounded-xl mx-4 mb-2">⏳ Request sent — waiting for acceptance</div>`;
      } else {
        inputBar.innerHTML = `<div class="p-4 text-center"><button class="px-6 py-2 bg-primary text-on-primary rounded-full text-sm font-bold hover:scale-105 transition-all" onclick="sendChatRequest('${escHtml(chat.uid || '')}', '${escHtml(chat.email || '')}', '${escHtml(chat.name || '')}')">📨 Send Chat Request to Start Messaging</button><p class="text-[10px] text-on-surface-variant mt-2">The imported history is only visible to you</p></div>`;
      }
      show('input-bar');
    }
  } else {
    if (inputBar) show('input-bar');
  }

  // Retrieve messages
  if (App.db && App.auth?.currentUser) {
    subscribeToMessages(chat.id);
  } else {
    renderMessages(chat.id);
    scrollToBottom(true);
  }

  // Dispatch custom event for window title manager
  document.dispatchEvent(new CustomEvent('nsl:chat-opened', { detail: chat }));

  // Redraw chat lists for updates
  renderChatList();

  // Populate Right Info Panel if viewport permits
  const panel = document.getElementById('detail-panel');
  if (panel) {
    if (window.innerWidth >= 1024 && App.showroomViewport !== 'mobile' && App.showroomViewport !== 'tablet') {
      /* Desktop: side-by-side panel */
      panel.classList.remove('hidden');
      panel.classList.add('flex');
      panel.classList.remove('tablet-overlay-panel');
      openChatInfo();
    } else if (window.innerWidth >= 768 && window.innerWidth < 1024 && App.showroomViewport !== 'mobile') {
      /* Tablet portrait: overlay panel */
      panel.classList.remove('hidden');
      panel.classList.add('flex', 'tablet-overlay-panel');
      openChatInfo();
    } else {
      panel.classList.add('hidden');
      panel.classList.remove('flex', 'tablet-overlay-panel');
    }
  }
}

/* ══════════════════════════════════════════════════
   10. MESSAGE RENDERING
   ══════════════════════════════════════════════════ */
App._vsActive = false;
App._vsChatId = null;

function renderSingleMessageHTML(msg, msgs, i, lastDate) {
  const msgDate = new Date(msg.time);
  const dateKey = msgDate.toDateString();
  let sep = '';
  if (dateKey !== lastDate) {
    sep = `<div class="flex justify-center my-6"><span class="bg-surface-container-highest/50 px-4 py-1 rounded-full text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">${formatDateSep(msgDate)}</span></div>`;
  }

  const isMe = msg.from === 'me';
  const contact = isMe ? null : (App.contacts.find(c=>c.uid===msg.from) || App.chats.find(c=>c.uid===msg.from));
  const showAvatar = !isMe && (i === msgs.length-1 || msgs[i+1]?.from !== msg.from);
  const showSender = !isMe && App.currentChat?.type==='group';
  const senderName = contact?.name || 'Unknown';

  const avatarHTML = showAvatar
    ? (contact?.photoURL
      ? `<img src="${contact.photoURL}" alt="${escHtml(senderName)}" class="w-10 h-10 rounded-full object-cover border border-outline-variant/10" loading="lazy">`
      : contact?.initials
        ? `<div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-surface-container-highest text-on-surface-variant">${contact.initials}</div>`
        : `<div class="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant"><span class="material-symbols-outlined text-sm">person_off</span></div>`)
    : `<div class="w-10"></div>`;

  const reactions = (msg.reactions||[]).map(r =>
    `<div class="flex items-center gap-1 bg-surface-container border border-outline-variant/30 px-2 py-0.5 rounded-lg text-xs cursor-pointer hover:bg-surface-variant transition-all ${r.mine?'border-primary/50 text-primary':''}" onclick="toggleReaction('${msg.id}','${r.emoji}')">
      <span>${r.emoji}</span><span class="font-bold text-[10px]">${r.count}</span>
    </div>`
  ).join('');

  const tickIcon = isMe
    ? msg.status==='read'      ? '<span class="material-symbols-outlined text-[14px] text-primary" style="font-variation-settings: \'FILL\' 1;">done_all</span>'
    : msg.status==='delivered' ? '<span class="material-symbols-outlined text-[14px] text-on-surface-variant" style="font-variation-settings: \'FILL\' 1;">done_all</span>'
    : msg.status==='sending'   ? '<span class="material-symbols-outlined text-[14px] text-on-surface-variant sync-badge pending" style="animation: syncRotate 2s infinite linear; display: inline-block;">schedule</span>'
    :                            '<span class="material-symbols-outlined text-[14px] text-on-surface-variant">done</span>'
    : '';

  const replyHTML = msg.replyTo ? `
    <div class="border-l-2 border-primary/50 pl-3 mb-2 opacity-80 text-xs">
      <div class="font-bold text-primary">${escHtml(msg.replyTo.name)}</div>
      <div class="truncate text-on-surface-variant">${escHtml(msg.replyTo.text)}</div>
    </div>` : '';

  let contentHTML = '';
  if (msg.type === 'image') {
    contentHTML = `<div class="bubble-media cursor-pointer relative rounded-xl overflow-hidden max-w-full" onclick="openMediaViewer('${msg.id}')">
      <img src="${escHtml(msg.url)}" alt="Image" loading="lazy" class="w-full max-h-48 object-cover rounded-xl border border-outline-variant/20">
      <div class="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all rounded-xl flex items-center justify-center opacity-0 hover:opacity-100">
        <span class="material-symbols-outlined text-white text-2xl drop-shadow">fullscreen</span>
      </div>
    </div>`;
  } else if (msg.type === 'video') {
    contentHTML = `<div class="bubble-media relative rounded-xl overflow-hidden max-w-full">
      <video src="${escHtml(msg.url)}" class="max-h-48 rounded-xl border border-outline-variant/20 w-full" preload="metadata" controls playsinline style="cursor:pointer"></video>
      <button onclick="event.stopPropagation();openMediaViewer('${msg.id}')" class="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors" title="Full screen">
        <span class="material-symbols-outlined text-sm">fullscreen</span>
      </button>
    </div>`;
  } else if (msg.type === 'voice') {
    const dur = msg.duration || '0:00';
    const durSec = msg.durationSec || 0;
    contentHTML = `<div class="voice-player bg-surface-container-high/40 p-2.5 rounded-xl border border-outline-variant/20" data-msg-id="${msg.id}">
      <div class="flex items-center gap-2">
        <button class="voice-play w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0" data-msg-id="${msg.id}" onclick="playVoice('${msg.id}')" aria-label="Play voice message">▶</button>
        <div class="flex-1 flex items-center">
          <div class="audio-visualizer-wave cursor-pointer w-full flex items-center gap-[3px]" data-msg-id="${msg.id}" id="wave-${msg.id}" onclick="scrubVoiceFromWave('${msg.id}', event)">
            <span style="height:12px"></span><span style="height:8px"></span><span style="height:16px"></span>
            <span style="height:10px"></span><span style="height:14px"></span><span style="height:6px"></span>
            <span style="height:18px"></span><span style="height:10px"></span><span style="height:12px"></span>
            <span style="height:15px"></span><span style="height:7px"></span><span style="height:11px"></span>
            <span style="height:14px"></span><span style="height:9px"></span><span style="height:13px"></span>
            <span style="height:8px"></span><span style="height:16px"></span><span style="height:10px"></span>
          </div>
        </div>
        <button class="voice-speed text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-variant/60 hover:bg-surface-variant text-on-surface-variant cursor-pointer" data-msg-id="${msg.id}" data-speed="1" onclick="cycleVoiceSpeed(this)">1x</button>
        <span class="text-[10px] font-timestamp text-on-surface-variant voice-time" data-msg-id="${msg.id}">${dur}</span>
      </div>
    </div>`;
  } else if (msg.type === 'doc') {
    contentHTML = `<div class="flex items-center gap-4 bg-surface-container-high p-4 rounded-xl border border-outline-variant/20 cursor-pointer" onclick="openMediaViewer('${msg.id}')">
      <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary"><span class="material-symbols-outlined">description</span></div>
      <div class="flex-1"><p class="text-xs font-bold truncate">${escHtml(msg.fileName||'Document')}</p><p class="text-[10px] text-on-surface-variant">${msg.fileSize||''}</p></div>
      <span class="material-symbols-rounded" style="font-size:20px;opacity:.7">download</span>
    </div>`;
  } else if (msg.type === 'location') {
    const mapUrlVal = msg.mapUrl || `https://maps.google.com/?q=${msg.lat},${msg.lng}`;
    const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${msg.lat},${msg.lng}&zoom=15&size=280x140&markers=${msg.lat},${msg.lng},red-pushpin`;
    if (msg.liveLocation && msg.liveLocation.active) {
      const remaining = msg.liveLocation.expiresAt - Date.now();
      if (remaining > 0) {
        contentHTML = `<div class="rounded-xl overflow-hidden border border-outline-variant/20 max-w-[300px]">
          <div class="bg-secondary/10 px-3 py-2 flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
            <span class="text-xs font-medium text-secondary">Live Location · ${formatLiveDuration(remaining)} left</span>
          </div>
          <a href="${escHtml(mapUrlVal)}" target="_blank" rel="noopener" class="block relative">
            <img src="${escHtml(staticMapUrl)}" alt="Live location" class="w-full h-[150px] object-cover" loading="lazy" onerror="this.style.display='none'">
            <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-2">
              <span class="text-white text-xs">Tap to view on map</span>
            </div>
          </a>
        </div>`;
      } else {
        msg.liveLocation.active = false;
        contentHTML = `<div onclick="window.open('${escHtml(mapUrlVal)}','_blank')" class="location-preview border border-outline-variant/20 max-w-full">
          <img src="${escHtml(staticMapUrl)}" alt="Location" loading="lazy" onerror="this.style.display='none'">
          <div class="location-label"><span class="material-symbols-outlined text-primary text-sm">location_on</span><span>Shared location</span></div>
        </div>`;
      }
    } else {
      contentHTML = `<div onclick="window.open('${escHtml(mapUrlVal)}','_blank')" class="location-preview border border-outline-variant/20 max-w-full">
        <img src="${escHtml(staticMapUrl)}" alt="Location" loading="lazy" onerror="this.style.display='none'">
        <div class="location-label"><span class="material-symbols-outlined text-primary text-sm">location_on</span><span>Shared location</span></div>
      </div>`;
    }
  } else if (msg.type === 'poll') {
    const poll = msg.poll || {};
    const opts = (poll.options || []).map((o, oi) => {
      const total = poll.options.reduce((s, x) => s + (x.voters||[]).length, 0);
      const pct = total > 0 ? Math.round((o.voters||[]).length / total * 100) : 0;
      const mine = (o.voters||[]).includes(App.user?.uid);
      return `<div class="poll-option cursor-pointer rounded-lg border ${mine?'border-primary bg-primary/10':'border-outline-variant/30 bg-surface-container-high/40'} p-2 mb-1 relative overflow-hidden" onclick="votePoll('${msg.id}',${oi})">
        <div class="poll-bar absolute inset-y-0 left-0 bg-primary/20 transition-all" style="width:${pct}%"></div>
        <div class="relative flex items-center gap-2"><span class="text-xs font-bold flex-1">${escHtml(o.text)}</span><span class="text-[10px] text-on-surface-variant">${o.voters?.length||0}</span></div>
      </div>`;
    }).join('');
    contentHTML = `<div class="rounded-xl border border-outline-variant/20 overflow-hidden p-3">
      <p class="text-sm font-bold mb-2">📊 ${escHtml(poll.question||'Poll')}</p>${opts}
      <p class="text-[10px] text-on-surface-variant mt-1">${poll.options?.reduce((s,o)=>s+(o.voters||[]).length,0)||0} votes${poll.allowMultiple?' · Multi-choice':''}</p>
    </div>`;
  } else if (msg.type === 'contact') {
    const initial = (msg.contactName||'?').charAt(0).toUpperCase();
    const phone = msg.contactPhone || '';
    const avatar = msg.contactAvatar || '';
    const email = msg.contactEmail || '';
    const existingChat = email ? App.chats.find(c => c.email && c.email.toLowerCase() === email.toLowerCase()) : null;
    contentHTML = `<div class="contact-card">
      <div class="contact-header">
        ${avatar ? `<img src="${escHtml(avatar)}" class="contact-avatar object-cover" loading="lazy">` : `<div class="contact-avatar">${escHtml(initial)}</div>`}
        <div class="contact-info">
          <div class="contact-name">${escHtml(msg.contactName||'Unknown')}</div>
          <div class="contact-email">${escHtml(email)}</div>
          ${phone ? `<div class="contact-email">${escHtml(phone)}</div>` : ''}
        </div>
      </div>
      ${existingChat
        ? `<button onclick="event.stopPropagation();openChat('${existingChat.id}')" class="send-request-btn" style="background:var(--secondary)">Open Chat</button>`
        : `<button onclick="event.stopPropagation();sendRequestFromContact('${escHtml(email)}','${escHtml(msg.contactName||'')}')" class="send-request-btn">Send Request</button>`
      }
    </div>`;
  } else {
    contentHTML = `<div class="text-sm font-normal leading-relaxed text-on-surface break-words overflow-wrap-anywhere">${formatMsgText(msg.text||'')}</div>`;
  }

  const fwdBadge  = msg.forwarded ? `<span class="text-[9px] text-on-surface-variant italic opacity-70 mb-1">↪ Forwarded</span>` : '';
  const starBadge = msg.starred   ? `<span class="text-[10px]">⭐</span>` : '';
  const editBadge = msg.edited    ? `<span class="text-[9px] text-on-surface-variant italic opacity-60">(edited)</span>` : '';

  const bubbleClass = isMe
    ? 'bg-primary text-on-primary rounded-2xl rounded-tr-none shadow-md'
    : 'bg-surface-container-highest rounded-2xl rounded-tl-none border border-outline-variant/15';

  return sep + `
  <div class="flex items-end gap-3 ${isMe?'justify-end ml-auto':'justify-start'} w-full max-w-[85%] mb-4" id="msg-${msg.id}">
    ${!isMe ? avatarHTML : ''}
    <div class="flex flex-col ${isMe?'items-end':'items-start'} max-w-full">
      ${showSender&&!isMe ? `<div class="text-[10px] text-on-surface-variant font-bold mb-1 ml-2">${escHtml(senderName)}</div>` : ''}
      ${fwdBadge ? `<div class="${isMe?'text-right':'text-left'}">${fwdBadge}</div>` : ''}
      <div class="flex items-center gap-1 group relative max-w-full">
        ${isMe ? `
        <button class="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant transition-opacity cursor-pointer flex items-center justify-center flex-shrink-0" onclick="event.stopPropagation();openForwardModal('${msg.id}')" title="Forward"><span class="material-symbols-outlined text-lg">arrow_forward</span></button>
        <button class="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant transition-opacity cursor-pointer flex items-center justify-center flex-shrink-0" onclick="event.stopPropagation();window._openThreadForMsg('${msg.id}')" title="Thread"><span class="material-symbols-outlined text-lg">forum</span></button>
        <button class="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded-full text-on-surface-variant hover:text-red-500 transition-opacity cursor-pointer flex items-center justify-center flex-shrink-0" onclick="event.stopPropagation();openDeleteMenu('${msg.id}')" title="Delete"><span class="material-symbols-outlined text-lg">delete</span></button>
        <button class="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant transition-opacity cursor-pointer flex items-center justify-center flex-shrink-0" onclick="showMsgContextMenu(event,'${msg.id}')" title="More"><span class="material-symbols-outlined text-lg">more_vert</span></button>` : ''}
        <div class="p-bubble_padding_xy ${bubbleClass} relative overflow-hidden max-w-full"
             oncontextmenu="showMsgContextMenu(event,'${msg.id}')"
             ondblclick="showQuickReactions(event,'${msg.id}')"
             onpointerdown="handleBubblePointerDown(event,'${msg.id}')"
             onpointerup="handleBubblePointerUp(event)"
             onpointercancel="handleBubblePointerUp(event)"
             onpointerleave="handleBubblePointerUp(event)">
          ${replyHTML}
          ${contentHTML}
          <div class="flex items-center justify-end gap-1 mt-1.5 select-none opacity-80">
            ${editBadge}
            <span class="text-[9px] font-timestamp ${isMe?'text-white/80':'text-on-surface-variant'}">${formatMsgTime(msg.time)}</span>
            ${starBadge}
            ${tickIcon}
          </div>
        </div>
        ${!isMe ? `
        <button class="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded-full text-on-surface-variant hover:text-red-500 transition-opacity cursor-pointer flex items-center justify-center flex-shrink-0" onclick="event.stopPropagation();openDeleteMenu('${msg.id}')" title="Delete"><span class="material-symbols-outlined text-lg">delete</span></button>
        <button class="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant transition-opacity cursor-pointer flex items-center justify-center flex-shrink-0" onclick="event.stopPropagation();openForwardModal('${msg.id}')" title="Forward"><span class="material-symbols-outlined text-lg">arrow_forward</span></button>
        <button class="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant transition-opacity cursor-pointer flex items-center justify-center flex-shrink-0" onclick="event.stopPropagation();window._openThreadForMsg('${msg.id}')" title="Thread"><span class="material-symbols-outlined text-lg">forum</span></button>
        <button class="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant transition-opacity cursor-pointer flex items-center justify-center flex-shrink-0" onclick="showMsgContextMenu(event,'${msg.id}')" title="More"><span class="material-symbols-outlined text-lg">more_vert</span></button>` : ''}
      </div>
      ${reactions ? `<div class="flex flex-wrap gap-1 mt-1">${reactions}</div>` : ''}
      ${msg.threadCount > 0 ? `<div class="flex items-center gap-1 mt-1 cursor-pointer hover:opacity-80" onclick="event.stopPropagation();window._openThreadForMsg('${msg.id}')"><span class="material-symbols-outlined text-[12px] text-primary">forum</span><span class="text-[10px] font-bold text-primary">${msg.threadCount} ${msg.threadCount === 1 ? 'reply' : 'replies'}</span></div>` : ''}
    </div>
  </div>`;
}

function renderMessages(chatId) {
  const msgs = App.messages[chatId] || [];
  const wrap = document.getElementById('messages-wrap');
  if (!wrap) return;

  const isMyselfChat = App.currentChat && isMyselfChatId(App.currentChat.id);

  if (!msgs.length) {
    VirtualScroll.destroy();
    App._vsActive = false;
    App._vsChatId = null;
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

  const useVirtualScroll = !isMyselfChat && msgs.length > 150;

  if (useVirtualScroll) {
    if (!App._vsActive || App._vsChatId !== chatId) {
      VirtualScroll.destroy();
      wrap.innerHTML = '';
      VirtualScroll.init(wrap, (item) => item.html, { rowHeight: 80, bufferRows: 10, threshold: 150 });
      App._vsActive = true;
      App._vsChatId = chatId;
    }

    let lastDate = null;
    const vsItems = [];
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const html = renderSingleMessageHTML(msg, msgs, i, lastDate);
      const dateKey = new Date(msg.time).toDateString();
      if (dateKey !== lastDate) lastDate = dateKey;
      vsItems.push({ html });
    }
    VirtualScroll.setItems(vsItems);
    requestAnimationFrame(() => {
      if (App._vsActive && VirtualScroll._enabled) VirtualScroll._render();
    });
  } else {
    if (App._vsActive) {
      VirtualScroll.destroy();
      App._vsActive = false;
      App._vsChatId = null;
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
      html += renderSingleMessageHTML(msg, msgs, i, lastDate);
      lastDate = new Date(msg.time).toDateString();
    });

    wrap.innerHTML = html;
    renderEmojiInElement(wrap);
  }
}

function generateWaveform() {
  return Array.from({length:20}, (_,i) => {
    const h = [30,50,70,45,85,60,40,75,55,90,35,65,80,50,70,40,60,85,45,55][i] || 50;
    return `<div class="w-0.5 bg-outline-variant rounded-full" style="height:${h}%"></div>`;
  }).join('');
}

/** @param {string} text - User message text with markdown-like syntax @returns {string} Sanitized HTML string */
function formatMsgText(text) {
  const html = escHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    .replace(/`(.*?)`/g, '<code class="bg-surface-container px-1 py-0.5 rounded font-mono text-xs">$1</code>')
    .replace(/(https?:\/\/[^\s&]+)/g, (url) => {
      const display = url.replace(/&amp;/g, '&');
      return `<a href="${url}" target="_blank" rel="noopener" class="underline text-primary hover:text-secondary">${display}</a>`;
    })
    .replace(/\n/g, '<br>');
  return html;
}

function renderEmojiInElement(el) {
  if (typeof renderEmojis === 'function') renderEmojis(el);
}

function formatLastSeenTime(ts) {
  if (!ts) return '';
  const now = Date.now();
  const t = typeof ts === 'number' ? ts : (ts?.toMillis ? ts.toMillis() : 0);
  if (!t) return '';
  const diff = now - t;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' hr ago';
  const d = new Date(t);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Alias of formatMsgText exposed globally for cross-module rendering. */
window.renderMessageText = formatMsgText;

/** @param {Object} att - Attachment with {url?, name?, type?} @returns {string} HTML for image, video, or download link */
window.renderAttachment = function renderAttachment(att) {
  if (!att) return '';
  if (att.url) {
    const safeUrl = escHtml(att.url);
    const safeName = escHtml(att.name || 'attachment');
    if (att.type && att.type.startsWith('image/')) return `<img src="${safeUrl}" alt="${safeName}" style="max-width:200px;border-radius:8px;" loading="lazy">`;
    if (att.type && att.type.startsWith('video/')) return `<video src="${safeUrl}" controls style="max-width:200px;border-radius:8px;"></video>`;
    return `<a href="${safeUrl}" target="_blank" rel="noopener">${safeName}</a>`;
  }
  return `<span>${escHtml(att.name || 'Attachment')}</span>`;
};

/* ══════════════════════════════════════════════════
   11. SEND MESSAGES
   ══════════════════════════════════════════════════ */
function sendMessage() {
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if (!text || !App.currentChat) return;

  // Anti-Spam Rate Limiter (Max 5 msgs / 5 seconds)
  sendMessage._ts = sendMessage._ts || [];
  const now = Date.now();
  sendMessage._ts = sendMessage._ts.filter(t => now - t < 5000);
  if (sendMessage._ts.length >= 5) {
    showToast('Sending too fast. Please wait a moment.', 'error');
    return;
  }
  sendMessage._ts.push(now);

  // Handle message editing
  if (_editingMsgId) {
    saveEdit(text);
    input.value = '';
    input.style.height = 'auto';
    toggleSendMic();
    return;
  }

  if (App.currentChat.uid && isUserBlocked(App.currentChat.uid)) { showToast('Cannot send — user is blocked', 'error'); return; }

  const msg = {
    id:     'msg_' + Date.now(),
    from:   'me',
    text:   text,
    time:   Date.now(),
    status: 'sending',
    replyTo: App.replyTo ? { name: App.replyTo.name, text: App.replyTo.text, id: App.replyTo.id, image: App.replyTo.image || null } : null,
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
  playMsgSentSound();

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
      const chatTTL = App.chats.find(c => c.id === chatId)?.disappearingMessages || 0;
      const messageData = {
        senderId: uid,
        senderName: App.currentUser.displayName || App.currentUser.email || 'Me',
        senderEmail: App.currentUser.email || '',
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
        read: false,
        expiresAt: chatTTL > 0 ? Date.now() + chatTTL : null
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
        // Increment unread count for group members
        const members = chat.members || [];
        const unreadInc = {};
        members.forEach(m => { if (m !== uid) unreadInc[m] = firebase.firestore.FieldValue.increment(1); });
        if (Object.keys(unreadInc).length > 0) {
          App.db.collection('groups').doc(chatId).set({ unreadCount: unreadInc }, { merge: true }).catch(() => {});
        }
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
          participantEmailList: [App.currentUser.email || '', App.currentChat.about || App.currentChat.email || ''],
          lastMessage: encryptedText,
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          lastMessageSenderId: uid,
          lastMessageStatus: 'sent',
          lastMessageEncrypted: isEncrypted,
          lastMessageIv: ivStr,
          status: 'active'
        }, { merge: true }).catch(console.error);
        // Increment unread count for recipient
        if (otherUserId && otherUserId !== uid) {
          App.db.collection('directChats').doc(chatId).set({
            unreadCount: { [otherUserId]: firebase.firestore.FieldValue.increment(1) }
          }, { merge: true }).catch(() => {});
        }
      }
      if (typeof broadcastToTabs === 'function') broadcastToTabs('new-message', { chatId, chatType: isGroup ? 'group' : 'direct' });
    })();
  }
}

function simulateReply(userText) {
  if (!App.currentChat || App.currentChat.type !== 'personal' || isMyselfChatId(App.currentChat.id)) return;
  
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

function showTyping(typingUsers) {
  const el = document.getElementById('typing-indicator');
  if (el) {
    el.classList.remove('hidden');
    const nameEl = el.querySelector('.typing-user-name');
    if (nameEl && typingUsers && typingUsers.length) {
      const name = typingUsers.length === 1 ? typingUsers[0] : typingUsers.slice(0, 2).join(' & ');
      nameEl.textContent = typingUsers.length > 2 ? `${name} & others` : name;
    }
  }
  scrollToBottom(true);
}
function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.classList.add('hidden');
}

let _typingDebounce = null;
let _typingTimeout = null;
let _remoteTypingUnsub = null;

function sendTypingIndicator() {
  if (!App.db || !App.auth?.currentUser || !App.currentChat) return;
  const uid = App.auth.currentUser.uid;
  const chatId = App.currentChat.id;
  const isGroup = App.currentChat.type === 'group';
  const collection = isGroup ? 'groups' : 'directChats';

  clearTimeout(_typingDebounce);
  _typingDebounce = setTimeout(() => {
    App.db.collection(collection).doc(chatId).set({
      typing: { [uid]: Date.now() }
    }, { merge: true }).catch(() => {});
  }, 1000);

  clearTimeout(_typingTimeout);
  _typingTimeout = setTimeout(() => {
    stopTypingIndicator();
  }, 3000);
}

function stopTypingIndicator() {
  if (!App.db || !App.auth?.currentUser || !App.currentChat) return;
  const uid = App.auth.currentUser.uid;
  const chatId = App.currentChat.id;
  const isGroup = App.currentChat.type === 'group';
  const collection = isGroup ? 'groups' : 'directChats';

  const update = {};
  update[`typing.${uid}`] = firebase.firestore.FieldValue.delete();
  App.db.collection(collection).doc(chatId).set(update, { merge: true }).catch(() => {});
}

function subscribeToTyping(chatId) {
  if (_remoteTypingUnsub) { _remoteTypingUnsub(); _remoteTypingUnsub = null; }
  if (!App.db || !App.auth?.currentUser) return;

  const uid = App.auth.currentUser.uid;
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat || isMyselfChatId(chat.id)) return;

  const isGroup = chat.type === 'group';
  const collection = isGroup ? 'groups' : 'directChats';

  _remoteTypingUnsub = App.db.collection(collection).doc(chatId).onSnapshot((doc) => {
    const data = doc.data();
    if (!data || !data.typing) { hideTyping(); return; }

    const now = Date.now();
    const TYPING_TIMEOUT = 5000;
    let typingUsers = [];

    Object.entries(data.typing).forEach(([userId, timestamp]) => {
      if (userId !== uid) {
        const ts = typeof timestamp === 'number' ? timestamp : (timestamp?.toMillis ? timestamp.toMillis() : 0);
        if (now - ts < TYPING_TIMEOUT) {
          const contact = App.contacts.find(c => c.uid === userId);
          typingUsers.push(contact?.name || 'Someone');
        }
      }
    });

    if (typingUsers.length) showTyping(typingUsers); else hideTyping();
  }, () => hideTyping());
}

function cleanupTypingSubscription() {
  if (_remoteTypingUnsub) { _remoteTypingUnsub(); _remoteTypingUnsub = null; }
  clearTimeout(_typingDebounce);
  clearTimeout(_typingTimeout);
}

/* ─── GLOBAL MODULE CLEANUP (logout / beforeunload) ─────────── */
function _moduleCleanupAll() {
  const fns = [
    window._moodStatusCleanup,
    window._dateRemindersCleanup,
    window._ghostModeCleanup,
    window._streakCleanup,
    window._playlistSyncCleanup,
  ];
  fns.forEach(fn => { if (typeof fn === 'function') { try { fn(); } catch(_){} } });
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
  /* On touch devices with on-screen keyboard, Enter creates newline; only physical keyboard sends */
  const isTouchWithKeyboard = window.matchMedia('(pointer: coarse)').matches && window.visualViewport && window.visualViewport.height < window.innerHeight * 0.75;
  if (e.key === 'Enter' && !e.shiftKey && !isMobile && !isTouchWithKeyboard) {
    e.preventDefault();
    sendMessage();
  }
}

function setupAutoResize() {
  const input = document.getElementById('msg-input');
  if (!input) return;
  const resize = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  };
  input.addEventListener('input', resize);
  input.addEventListener('focus', resize);
}

/* ══════════════════════════════════════════════════
   13. REPLIES
   ══════════════════════════════════════════════════ */
function replyToMsg(msgId) {
  const msgs = App.messages[App.currentChat?.id] || [];
  const msg  = msgs.find(m => m.id === msgId);
  if (!msg) return;

  const senderId = msg.senderId || (msg.from !== 'me' ? msg.from : App.currentUser.uid);
  const senderName = msg.from === 'me' || msg.senderId === App.currentUser.uid 
    ? 'You' 
    : (msg.senderName || App.contacts.find(c => c.uid === senderId)?.name || App.chats.find(c => c.id === App.currentChat?.id)?.name || 'User');
    
  let replyText = msg.text || '';
  let replyImageUrl = '';

  if (msg.type === 'image') {
    replyText = replyText || '📷 Photo';
    replyImageUrl = msg.url || (msg.attachment && msg.attachment.url);
  } else if (msg.type === 'video') {
    replyText = replyText || '🎥 Video';
    replyImageUrl = msg.url || (msg.attachment && (msg.attachment.thumbnail || msg.attachment.url));
  } else if (msg.type === 'voice') {
    replyText = replyText || '🎤 Voice message';
  } else if (msg.type === 'doc' || msg.type === 'file') {
    replyText = replyText || '📄 Document';
  } else if (msg.type === 'location') {
    replyText = replyText || '📍 Location';
  } else if (msg.attachment) {
    // Fallback for older attachment structure
    replyImageUrl = msg.attachment.thumbnail || msg.attachment.url || '';
    replyText = replyText || '📎 Attachment';
  }

  App.replyTo = { id: msgId, name: senderName, text: replyText, image: replyImageUrl };

  setEl('reply-name', App.replyTo.name);
  setEl('reply-text', App.replyTo.text);
  
  const imgEl = document.getElementById('reply-image');
  if (imgEl) {
    if (replyImageUrl) {
      imgEl.src = replyImageUrl;
      imgEl.classList.remove('hidden');
    } else {
      imgEl.classList.add('hidden');
      imgEl.src = '';
    }
  }
  
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
   15. CALL SCREENS — Real WebRTC Engine
   ══════════════════════════════════════════════════ */
function startVoiceCall() { if(!App.currentChat)return; beginCall('voice'); }
function startVideoCall()  { if(!App.currentChat)return; beginCall('video'); }

async function beginCall(type) {
  const chat = App.currentChat;
  if (!chat || !App.db || !App.auth?.currentUser) return;
  const uid = App.auth.currentUser.uid;
  const otherUid = chat.uid;
  if (!otherUid) return;

  if (typeof PermissionsManager !== 'undefined') {
    const permFeature = type === 'video' ? 'Video Call' : 'Audio Call';
    const granted = await PermissionsManager.ensureForFeature(permFeature);
    if (!granted) return;
  }

  currentCallType = type;
  App.callActive = true;
  micMuted = false;
  cameraOff = (type === 'voice');
  callLogWritten = false;

  setEl('call-name', chat.name);
  setEl('call-status', 'Calling…');
  hide('call-timer');
  document.getElementById('call-screen')?.classList.remove('hidden');
  history.pushState({ callActive: true }, '');
  document.getElementById('call-quality-text').textContent = type === 'video' ? 'HD Video call' : 'HD Voice call';
  document.getElementById('btn-cam')?.classList.toggle('hidden', type === 'voice');
  document.getElementById('btn-screenshare')?.classList.toggle('hidden', type === 'voice');
  document.getElementById('remote-video')?.classList.add('hidden');
  document.getElementById('local-video-container')?.classList.add('hidden');
  document.getElementById('call-info-section')?.classList.remove('hidden');

  const av = document.getElementById('call-avatar');
  if (av) { av.className = 'w-32 h-32 rounded-full border-4 border-primary/30 flex items-center justify-center text-5xl bg-white/10 animate-pulse'; av.textContent = chat.initials; }

  try {
    const constraints = { audio: true, video: type === 'video' ? { facingMode: preferredCameraFacingMode, width: { ideal: window.isTablet ? 1920 : 1280 }, height: { ideal: window.isTablet ? 1080 : 720 } } : false };
    localCallStream = await navigator.mediaDevices.getUserMedia(constraints);
    const localVideo = document.getElementById('local-video');
    if (localVideo && type === 'video') { localVideo.srcObject = localCallStream; document.getElementById('local-video-container')?.classList.remove('hidden'); }

    const rtcConfig = await getRtcConfig();
    peerConnection = new RTCPeerConnection(rtcConfig);

    localCallStream.getTracks().forEach(track => peerConnection.addTrack(track, localCallStream));

    peerConnection.onicecandidate = async (e) => {
      if (e.candidate && App.db && App._activeCallId) {
        await App.db.collection('calls').doc(App._activeCallId).collection('candidates').add({
          candidate: e.candidate.toJSON(), sender: uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    };

    peerConnection.ontrack = (e) => {
      remoteCallStream = e.streams[0];
      const remoteVideo = document.getElementById('remote-video');
      if (remoteVideo) { remoteVideo.srcObject = remoteCallStream; remoteVideo.classList.toggle('hidden', currentCallType === 'voice'); }
      if (currentCallType === 'video') document.getElementById('call-info-section')?.classList.add('hidden');
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection?.connectionState;
      if (state === 'connected') {
        setEl('call-status', 'Active');
        show('call-timer');
        callStartedAt = Date.now();
        startCallTimer();
        startCallQualityAdaptation();
        document.getElementById('btn-screenshare')?.classList.toggle('hidden', currentCallType === 'voice');
        if (App.db && App._activeCallId) {
          App.db.collection('calls').doc(App._activeCallId).update({ status: 'active', startedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
        }
      } else if (state === 'failed' || state === 'disconnected') {
        setEl('call-status', 'Reconnecting…');
        try { peerConnection?.restartIce(); } catch(_) {}
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const callRef = await App.db.collection('calls').add({
      fromUserId: uid, fromUserName: App.currentUser?.displayName || 'User',
      toUserId: otherUid, type, status: 'ringing', groupCall: false,
      offer: { sdp: offer.sdp, type: offer.type },
      participants: [uid, otherUid],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    App._activeCallId = callRef.id;

    listenForCallAnswer(callRef.id);
    listenForCallCandidates(callRef.id);
    listenForCallStatus(callRef.id);
    requestWakeLock();
    startCallHeartbeat(callRef.id);

    callTimeoutTimer = setTimeout(() => {
      if (App._activeCallId && App.callActive) {
        setEl('call-status', 'No answer');
        endCall();
      }
    }, 45000);

  } catch (err) {
    console.error('beginCall error:', err);
    showToast('Could not start call: ' + (err.name === 'NotAllowedError' ? 'Camera/mic permission denied' : err.message), 'error');
    endCall();
  }
}

function listenForCallAnswer(callId) {
  if (!App.db) return;
  callAnswerUnsubscribe = App.db.collection('calls').doc(callId).onSnapshot(doc => {
    const data = doc.data();
    if (!data) return;
    if (data.status === 'active' && data.answer && peerConnection && peerConnection.signalingState === 'have-local-offer') {
      peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(() => {});
    }
    if (data.status === 'ended' || data.status === 'missed' || data.status === 'rejected' || data.status === 'cancelled') {
      endCall();
    }
  });
}

function listenForCallCandidates(callId) {
  if (!App.db) return;
  const uid = App.auth?.currentUser?.uid;
  callCandidatesUnsubscribe = App.db.collection('calls').doc(callId).collection('candidates')
    .orderBy('createdAt').onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const c = change.doc.data();
          if (c.sender !== uid && peerConnection) {
            peerConnection.addIceCandidate(new RTCIceCandidate(c.candidate)).catch(() => {});
          }
        }
      });
    });
}

function listenForCallStatus(callId) {
  if (!App.db) return;
  callDocUnsubscribe = App.db.collection('calls').doc(callId).onSnapshot(doc => {
    const data = doc.data();
    if (!data) return;
    if (data.status === 'ended' || data.status === 'missed' || data.status === 'rejected' || data.status === 'cancelled') endCall();
  });
}

function startCallTimer() {
  clearInterval(callDurationTimer);
  callDurationTimer = setInterval(() => {
    const s = Math.floor((Date.now() - callStartedAt) / 1000);
    const dur = formatDuration(s);
    setEl('call-timer', dur);
    setEl('bubble-call-timer', dur);
  }, 1000);
}

function endCall() {
  const wasActive = App.callActive;
  App.callActive = false;
  clearTimeout(callTimeoutTimer);
  clearInterval(callDurationTimer);
  clearInterval(callHeartbeatTimer);
  if (_callQualityInterval) { clearInterval(_callQualityInterval); _callQualityInterval = null; }
  stopRingtone();
  if (typeof stopLiveLocation === 'function') stopLiveLocation();

  if (_screenShareStream) { _screenShareStream.getTracks().forEach(t => t.stop()); _screenShareStream = null; _screenShareSender = null; }
  App._incomingCallData = null;
  activeCallMode = null;
  speakerOn = false;
  micMuted = false;
  cameraOff = false;

  const duration = callStartedAt ? Math.floor((Date.now() - callStartedAt) / 1000) : 0;

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localCallStream) {
    localCallStream.getTracks().forEach(t => t.stop());
    localCallStream = null;
  }
  remoteCallStream = null;
  const rv = document.getElementById('remote-video');
  if (rv) rv.srcObject = null;
  const lv = document.getElementById('local-video');
  if (lv) lv.srcObject = null;
  document.getElementById('call-screen')?.classList.add('hidden');
  const cb = document.getElementById('call-bubble');
  if (cb) cb.style.display = 'none';
  document.getElementById('remote-video')?.classList.add('hidden');
  document.getElementById('local-video-container')?.classList.add('hidden');
  document.getElementById('btn-screenshare')?.classList.add('hidden');
  document.getElementById('call-info-section')?.classList.remove('hidden');

  cleanupGroupCalls();

  if (callDocUnsubscribe) { callDocUnsubscribe(); callDocUnsubscribe = null; }
  if (callAnswerUnsubscribe) { callAnswerUnsubscribe(); callAnswerUnsubscribe = null; }
  if (callCandidatesUnsubscribe) { callCandidatesUnsubscribe(); callCandidatesUnsubscribe = null; }
  if (App._incomingCallTimeout) { clearTimeout(App._incomingCallTimeout); App._incomingCallTimeout = null; }
  if (typeof cleanupTypingSubscription === 'function') cleanupTypingSubscription();

  if (wasActive && App.db && App._activeCallId) {
    App.db.collection('calls').doc(App._activeCallId).update({ status: 'ended', duration, endedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    App._activeCallId = null;
  }
  if (callStartedAt && duration > 0) {
    playCallEndedSound();
    showToast('Call ended · ' + formatDuration(duration), 'info');
  }
  callStartedAt = null;
  releaseWakeLock();
}

function toggleMute() {
  micMuted = !micMuted;
  if (localCallStream) localCallStream.getAudioTracks().forEach(t => t.enabled = !micMuted);
  const btn = document.getElementById('btn-mute');
  const icon = document.getElementById('mute-icon');
  if (btn) btn.classList.toggle('bg-red-500', micMuted);
  if (icon) icon.textContent = micMuted ? 'mic_off' : 'mic';
}

function toggleCamera() {
  cameraOff = !cameraOff;
  if (localCallStream) localCallStream.getVideoTracks().forEach(t => t.enabled = !cameraOff);
  const icon = document.getElementById('cam-icon');
  if (icon) icon.textContent = cameraOff ? 'videocam_off' : 'videocam';
}

async function switchCamera() {
  preferredCameraFacingMode = preferredCameraFacingMode === 'user' ? 'environment' : 'user';
  if (!localCallStream || currentCallType !== 'video') return;
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: preferredCameraFacingMode, width: { ideal: window.isTablet ? 1920 : 1280 }, height: { ideal: window.isTablet ? 1080 : 720 } } });
    const newTrack = newStream.getVideoTracks()[0];
    const sender = peerConnection?.getSenders().find(s => s.track?.kind === 'video');
    if (sender) await sender.replaceTrack(newTrack);
    localCallStream.getVideoTracks()[0].stop();
    localCallStream.removeTrack(localCallStream.getVideoTracks()[0]);
    localCallStream.addTrack(newTrack);
    document.getElementById('local-video').srcObject = localCallStream;
  } catch(e) { console.warn('Camera switch error:', e); }
}

function toggleSpeaker() {
  speakerOn = !speakerOn;
  const icon = document.getElementById('speaker-icon');
  if (icon) icon.textContent = speakerOn ? 'volume_up' : 'volume_off';
  document.getElementById('btn-speaker')?.classList.toggle('bg-primary/30', speakerOn);
  if (remoteCallStream) {
    const audioEl = document.getElementById('remote-video');
    if (audioEl) {
      audioEl.volume = speakerOn ? 1.0 : 0.7;
      if (speakerOn && typeof audioEl.setSinkId === 'function') {
        navigator.mediaDevices?.enumerateDevices?.().then(devices => {
          const speaker = devices.find(d => d.kind === 'audiooutput' && d.label.toLowerCase().includes('speaker'));
          if (speaker) audioEl.setSinkId(speaker.deviceId).catch(() => {});
        }).catch(() => {});
      }
    }
  }
}

function minimizeCall() {
  document.getElementById('call-screen')?.classList.add('hidden');
  if (App.callActive) {
    const bubble = document.getElementById('call-bubble');
    if (bubble) {
      bubble.style.display = 'flex';
      setEl('bubble-call-name', document.getElementById('call-name')?.textContent || 'Call');
    }
    if (navigator.vibrate) navigator.vibrate(30);
  }
}

function maximizeCall() {
  if (!App.callActive) return;
  const bubble = document.getElementById('call-bubble');
  if (bubble) bubble.style.display = 'none';
  document.getElementById('call-screen')?.classList.remove('hidden');
}

let _screenShareStream = null;
let _screenShareSender = null;
let _callQualityInterval = null;
let _callBroadcast = null;
try { _callBroadcast = new BroadcastChannel('tc-calls'); } catch(_) {}

async function toggleScreenShare() {
  if (_screenShareStream) {
    _screenShareStream.getTracks().forEach(t => t.stop());
    _screenShareStream = null;
    if (_screenShareSender && peerConnection && localCallStream) {
      const camTrack = localCallStream.getVideoTracks()[0];
      if (camTrack) await _screenShareSender.replaceTrack(camTrack).catch(() => {});
    }
    _screenShareSender = null;
    const localVideo = document.getElementById('local-video');
    if (localVideo && localCallStream) localVideo.srcObject = localCallStream;
    document.getElementById('screenshare-icon').textContent = 'screen_share';
    showToast('Screen share stopped', 'info');
    return;
  }
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    _screenShareStream = screenStream;
    const screenTrack = screenStream.getVideoTracks()[0];
    _screenShareSender = peerConnection?.getSenders().find(s => s.track?.kind === 'video');
    if (_screenShareSender) await _screenShareSender.replaceTrack(screenTrack);
    const localVideo = document.getElementById('local-video');
    if (localVideo) localVideo.srcObject = screenStream;
    document.getElementById('screenshare-icon').textContent = 'stop_screen_share';
    screenTrack.onended = () => toggleScreenShare();
    showToast('Sharing your screen', 'info');
  } catch(e) { showToast('Screen share cancelled', 'info'); }
}

function startCallQualityAdaptation() {
  if (!peerConnection || currentCallType !== 'video') return;
  clearInterval(_callQualityInterval);
  const adapt = async () => {
    if (!peerConnection || !App.callActive) return;
    try {
      const stats = await peerConnection.getStats();
      let rtt = null, packetsLost = 0, packetsSent = 0;
      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime != null) rtt = report.currentRoundTripTime * 1000;
        if (report.type === 'outbound-rtp') { packetsLost += report.packetsLost || 0; packetsSent += report.packetsSent || 1; }
      });
      const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender && sender.getParameters) {
        const params = sender.getParameters();
        if (!params.encodings || !params.encodings.length) params.encodings = [{}];
        let maxBitrate = 2500000;
        if (rtt !== null && rtt > 300) maxBitrate = 500000;
        else if (rtt !== null && rtt > 150) maxBitrate = 1000000;
        params.encodings[0].maxBitrate = maxBitrate;
        sender.setParameters(params).catch(() => {});
      }
    } catch(_) {}
  };
  _callQualityInterval = setInterval(adapt, 5000);
}

function acceptCall() {
  stopRingtone();
  document.getElementById('incoming-call-overlay')?.classList.add('hidden');
  if (_callBroadcast) _callBroadcast.postMessage({ type: 'call-accepted', callId: App._incomingCallData?.callId });
  if (App._incomingCallData) {
    if (App._incomingCallData.groupCall) _handleAcceptedGroupCall(App._incomingCallData);
    else _handleAcceptedCall(App._incomingCallData);
  }
}

function declineCall() {
  stopRingtone();
  document.getElementById('incoming-call-overlay')?.classList.add('hidden');
  if (_callBroadcast) _callBroadcast.postMessage({ type: 'call-ended', callId: App._incomingCallData?.callId });
  if (App._incomingCallData && App.db) {
    App.db.collection('calls').doc(App._incomingCallData.callId).update({ status: 'rejected' }).catch(() => {});
  }
  App._incomingCallData = null;
}

async function _handleAcceptedCall(callData) {
  const { callId, type: callType, fromUserId, fromUserName } = callData;
  const uid = App.auth?.currentUser?.uid;
  if (!uid || !App.db) return;

  if (typeof PermissionsManager !== 'undefined') {
    const permFeature = callType === 'video' ? 'Video Call' : 'Audio Call';
    const granted = await PermissionsManager.ensureForFeature(permFeature);
    if (!granted) { endCall(); return; }
  }

  currentCallType = callType;
  App.callActive = true;
  micMuted = false;
  cameraOff = (callType === 'voice');
  App._activeCallId = callId;
  callStartedAt = null;

  setEl('call-name', fromUserName || 'Unknown');
  setEl('call-status', 'Connecting…');
  hide('call-timer');
  document.getElementById('call-screen')?.classList.remove('hidden');
  const _cb = document.getElementById('call-bubble');
  if (_cb) _cb.style.display = 'none';
  history.pushState({ callActive: true }, '');
  document.getElementById('call-quality-text').textContent = callType === 'video' ? 'HD Video call' : 'HD Voice call';
  document.getElementById('btn-cam')?.classList.toggle('hidden', callType === 'voice');
  document.getElementById('btn-screenshare')?.classList.toggle('hidden', true);
  document.getElementById('remote-video')?.classList.add('hidden');
  document.getElementById('local-video-container')?.classList.add('hidden');
  document.getElementById('call-info-section')?.classList.remove('hidden');

  const av = document.getElementById('call-avatar');
  if (av) { av.className = 'w-32 h-32 rounded-full border-4 border-primary/30 flex items-center justify-center text-5xl bg-white/10 animate-pulse'; av.textContent = (fromUserName || '?')[0].toUpperCase(); }

  try {
    const constraints = { audio: true, video: callType === 'video' ? { facingMode: preferredCameraFacingMode, width: { ideal: window.isTablet ? 1920 : 1280 }, height: { ideal: window.isTablet ? 1080 : 720 } } : false };
    localCallStream = await navigator.mediaDevices.getUserMedia(constraints);
    const localVideo = document.getElementById('local-video');
    if (localVideo && callType === 'video') { localVideo.srcObject = localCallStream; document.getElementById('local-video-container')?.classList.remove('hidden'); }

    const rtcConfig = await getRtcConfig();
    peerConnection = new RTCPeerConnection(rtcConfig);

    localCallStream.getTracks().forEach(track => peerConnection.addTrack(track, localCallStream));

    peerConnection.onicecandidate = async (e) => {
      if (e.candidate && App.db) {
        await App.db.collection('calls').doc(callId).collection('candidates').add({
          candidate: e.candidate.toJSON(), sender: uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    };

    peerConnection.ontrack = (e) => {
      remoteCallStream = e.streams[0];
      const remoteVideo = document.getElementById('remote-video');
      if (remoteVideo) { remoteVideo.srcObject = remoteCallStream; remoteVideo.classList.toggle('hidden', currentCallType === 'voice'); }
      if (currentCallType === 'video') document.getElementById('call-info-section')?.classList.add('hidden');
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection?.connectionState;
      if (state === 'connected') {
        setEl('call-status', 'Active');
        show('call-timer');
        callStartedAt = Date.now();
        startCallTimer();
        startCallQualityAdaptation();
        document.getElementById('btn-screenshare')?.classList.toggle('hidden', currentCallType === 'voice');
        App.db.collection('calls').doc(callId).update({ status: 'active', startedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
      } else if (state === 'failed') {
        setEl('call-status', 'Reconnecting…');
        try { peerConnection?.restartIce(); } catch(_) {}
      }
    };

    const callDoc = await App.db.collection('calls').doc(callId).get();
    const callDataSnap = callDoc.data();
    if (callDataSnap?.offer) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(callDataSnap.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await App.db.collection('calls').doc(callId).update({
        answer: { sdp: answer.sdp, type: answer.type }
      });
    }

    listenForCallCandidates(callId);
    listenForCallStatus(callId);
    requestWakeLock();
    startCallHeartbeat(callId);

  } catch (err) {
    console.error('Accept call error:', err);
    showToast('Could not connect call', 'error');
    endCall();
  }
}

function listenForIncomingCalls() {
  if (!App.db || !App.auth?.currentUser) return;
  const uid = App.auth.currentUser.uid;
  if (incomingCallsUnsubscribe) incomingCallsUnsubscribe();
  incomingCallsUnsubscribe = App.db.collection('calls')
    .where('toUserId', '==', uid)
    .where('status', '==', 'ringing')
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const call = change.doc.data();
          if (call.fromUserId === uid) return;
          App._incomingCallData = { callId: change.doc.id, type: call.type, fromUserId: call.fromUserId, fromUserName: call.fromUserName, groupCall: call.groupCall, groupId: call.groupId, groupName: call.groupName };
          const callerName = call.fromUserName || 'Unknown';
          setEl('incoming-call-name', callerName);
          const isGroup = call.groupCall === true;
          setEl('incoming-call-type', (isGroup ? '👥 ' : '') + (call.type === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Voice Call'));
          document.getElementById('incoming-call-avatar').textContent = callerName[0]?.toUpperCase() || '?';
          document.getElementById('incoming-call-overlay')?.classList.remove('hidden');
          playRingtone();
          if (_callBroadcast) _callBroadcast.postMessage({ type: 'incoming-call', callId: change.doc.id });
          if (navigator.vibrate) navigator.vibrate([700, 250, 700, 250, 700, 250, 700, 250, 700]);
          requestWakeLock();
          // Auto-dismiss after 45 seconds if not answered
          App._incomingCallTimeout = setTimeout(() => {
            if (App._incomingCallData && App._incomingCallData.callId === change.doc.id) {
              document.getElementById('incoming-call-overlay')?.classList.add('hidden');
              stopRingtone();
              App._incomingCallData = null;
            }
          }, 45000);
        }
        // Handle removed/modified — call was accepted/ended elsewhere, dismiss overlay
        if (change.type === 'removed' || change.type === 'modified') {
          const callData = change.doc.data();
          if (callData && (callData.status === 'active' || callData.status === 'ended' || callData.status === 'rejected' || callData.status === 'missed' || callData.status === 'cancelled')) {
            document.getElementById('incoming-call-overlay')?.classList.add('hidden');
            stopRingtone();
            if (App._incomingCallTimeout) { clearTimeout(App._incomingCallTimeout); App._incomingCallTimeout = null; }
            if (App._incomingCallData && App._incomingCallData.callId === change.doc.id) {
              App._incomingCallData = null;
            }
          }
        }
      });
    });

  // Listen for cross-tab call broadcasts
  if (_callBroadcast) {
    _callBroadcast.onmessage = (e) => {
      if (e.data?.type === 'call-accepted' || e.data?.type === 'call-ended') {
        document.getElementById('incoming-call-overlay')?.classList.add('hidden');
        stopRingtone();
        if (App._incomingCallTimeout) { clearTimeout(App._incomingCallTimeout); App._incomingCallTimeout = null; }
        App._incomingCallData = null;
      }
    };
  }
}

/* ─── Ringtone via Web Audio API ─── */
let _ringtoneInterval = null;
function playRingtone() {
  stopRingtone();
  try {
    ringtoneAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = () => {
      if (!ringtoneAudioContext) return;
      const osc = ringtoneAudioContext.createOscillator();
      const gain = ringtoneAudioContext.createGain();
      osc.connect(gain);
      gain.connect(ringtoneAudioContext.destination);
      osc.frequency.value = 440;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ringtoneAudioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ringtoneAudioContext.currentTime + 0.8);
      osc.start(ringtoneAudioContext.currentTime);
      osc.stop(ringtoneAudioContext.currentTime + 0.8);
    };
    playTone();
    _ringtoneInterval = setInterval(playTone, 1200);
  } catch(_) {}
}

function stopRingtone() {
  clearInterval(_ringtoneInterval);
  _ringtoneInterval = null;
  if (ringtoneAudioContext) { ringtoneAudioContext.close().catch(() => {}); ringtoneAudioContext = null; }
  if (navigator.vibrate) navigator.vibrate(0);
}

async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch(e) {
    if (e?.name !== 'AbortError') {
      console.warn('Wake lock failed:', e);
      showToast('Screen may turn off during calls', 'info');
    }
  }
}
function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

/* ══════════════════════════════════════════════════
   15c. NOTIFICATION SOUNDS — WhatsApp-style Web Audio
   ══════════════════════════════════════════════════ */
let _notifAudioCtx = null;
function _getNotifCtx() {
  if (!_notifAudioCtx || _notifAudioCtx.state === 'closed') {
    try { _notifAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(_) { return null; }
  }
  if (_notifAudioCtx.state === 'suspended') _notifAudioCtx.resume().catch(() => {});
  return _notifAudioCtx;
}

const _SOUND_DEFS = {
  default:    { notes: [880, 1100, 880], dur: [0.08, 0.08, 0.12], type: 'sine', vol: 0.25 },
  notification_1: { notes: [1047, 1319, 1568], dur: [0.1, 0.1, 0.15], type: 'sine', vol: 0.2 },
  notification_2: { notes: [880, 1100, 1320, 1100], dur: [0.07, 0.07, 0.07, 0.12], type: 'triangle', vol: 0.2 },
  notification_3: { notes: [1200, 900, 1200], dur: [0.1, 0.1, 0.15], type: 'sine', vol: 0.22 },
  chime:      { notes: [1047, 1319, 1568, 2093], dur: [0.08, 0.08, 0.08, 0.2], type: 'sine', vol: 0.18 },
  bell:       { notes: [1568, 1568, 1175, 1568], dur: [0.06, 0.04, 0.06, 0.2], type: 'square', vol: 0.12 },
  sent:       { notes: [1200, 1600], dur: [0.05, 0.08], type: 'sine', vol: 0.12 },
  call_ring:  { notes: [440, 480, 440, 480], dur: [0.3, 0.15, 0.3, 0.15], type: 'sine', vol: 0.3 },
  call_end:   { notes: [600, 400], dur: [0.15, 0.25], type: 'sine', vol: 0.15 },
  error:      { notes: [300, 250], dur: [0.15, 0.2], type: 'square', vol: 0.1 },
};

function playNotifSound(name) {
  const ctx = _getNotifCtx();
  if (!ctx) return;
  const def = _SOUND_DEFS[name] || _SOUND_DEFS.default;
  if (!def) return;
  let t = ctx.currentTime;
  def.notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = def.type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(def.vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + def.dur[i]);
    osc.start(t);
    osc.stop(t + def.dur[i]);
    t += def.dur[i];
  });
}

function _isDeviceSilent() {
  if (document.hasFocus && document.hasFocus()) return false;
  return false;
}

function _shouldPlaySound(chatId) {
  if (App.callActive) return false;
  if (App._isMutedGlobal) return false;
  if (chatId && App._mutedChats && App._mutedChats.has(chatId)) return false;
  if (chatId) {
    const customSound = getChatSound(chatId);
    if (customSound === 'silent') return false;
  }
  if (document.hasFocus && document.hasFocus()) return true;
  return true;
}

function playMsgReceivedSound(chatId) {
  if (!_shouldPlaySound(chatId)) return;
  const customSound = chatId ? getChatSound(chatId) : '';
  const soundName = customSound && _SOUND_DEFS[customSound] ? customSound : 'default';
  playNotifSound(soundName);
  if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
}

function playMsgSentSound() {
  playNotifSound('sent');
}

function playCallIncomingRing() {
  stopRingtone();
  playNotifSound('call_ring');
  _ringtoneInterval = setInterval(() => playNotifSound('call_ring'), 1200);
  if (navigator.vibrate) navigator.vibrate([700, 250, 700, 250, 700, 250, 700, 250, 700]);
}

function playCallEndedSound() {
  playNotifSound('call_end');
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

/* ══════════════════════════════════════════════════
   15b. GROUP CALLS — Multi-peer mesh (up to 4)
   ══════════════════════════════════════════════════ */
function startGroupVoiceCall() { startGroupCall('voice'); }
function startGroupVideoCall() { startGroupCall('video'); }

async function startGroupCall(type) {
  const chat = App.currentChat;
  if (!chat || !App.db || !App.auth?.currentUser) return;
  if (chat.type !== 'group') return startGroupCall._directFallback?.(type);
  const uid = App.auth.currentUser.uid;
  const memberIds = (chat.members || []).filter(m => m && m !== uid);
  if (!memberIds.length) { showToast('No other members to call', 'info'); return; }

  if (typeof PermissionsManager !== 'undefined') {
    const permFeature = type === 'video' ? 'Video Call' : 'Audio Call';
    const granted = await PermissionsManager.ensureForFeature(permFeature);
    if (!granted) return;
  }

  currentCallType = type;
  App.callActive = true;
  micMuted = false;
  cameraOff = (type === 'voice');
  activeCallMode = 'group';
  activeGroupCallParticipants = [];

  setEl('call-name', chat.name);
  setEl('call-status', 'Calling ' + memberIds.length + ' people…');
  hide('call-timer');
  document.getElementById('call-screen')?.classList.remove('hidden');
  document.getElementById('call-quality-text').textContent = type === 'video' ? 'HD Group Video' : 'HD Group Voice';
  document.getElementById('btn-cam')?.classList.toggle('hidden', type === 'voice');
  document.getElementById('remote-video')?.classList.add('hidden');
  document.getElementById('local-video-container')?.classList.add('hidden');
  document.getElementById('call-info-section')?.classList.remove('hidden');

  const av = document.getElementById('call-avatar');
  if (av) { av.className = 'w-32 h-32 rounded-full border-4 border-primary/30 flex items-center justify-center text-5xl bg-white/10 animate-pulse'; av.textContent = chat.initials || 'G'; }

  try {
    const constraints = { audio: true, video: type === 'video' ? { facingMode: preferredCameraFacingMode, width: { ideal: window.isTablet ? 1920 : 1280 }, height: { ideal: window.isTablet ? 1080 : 720 } } : false };
    localCallStream = await navigator.mediaDevices.getUserMedia(constraints);
    const localVideo = document.getElementById('local-video');
    if (localVideo && type === 'video') { localVideo.srcObject = localCallStream; document.getElementById('local-video-container')?.classList.remove('hidden'); }

    const allParticipants = [uid, ...memberIds];
    const callRef = await App.db.collection('calls').add({
      fromUserId: uid, fromUserName: App.currentUser?.displayName || 'User',
      type, status: 'ringing', groupCall: true, groupId: chat.id,
      groupName: chat.name, participantIds: allParticipants,
      offer: null, participants: allParticipants,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    App._activeCallId = callRef.id;

    listenForGroupCallParticipants(callRef.id, type);
    listenForCallStatus(callRef.id);

    callTimeoutTimer = setTimeout(() => {
      if (App._activeCallId && App.callActive && !activeGroupCallParticipants.length) {
        setEl('call-status', 'No answer');
        endCall();
      }
    }, 45000);

    requestWakeLock();

  } catch (err) {
    console.error('startGroupCall error:', err);
    showToast('Could not start group call: ' + err.message, 'error');
    endCall();
  }
}

function listenForGroupCallParticipants(callId, callType) {
  if (!App.db || !App.auth?.currentUser) return;
  const uid = App.auth.currentUser.uid;

  if (groupCallDocUnsubscribe) groupCallDocUnsubscribe();
  groupCallDocUnsubscribe = App.db.collection('calls').doc(callId).onSnapshot(async doc => {
    const data = doc.data();
    if (!data) return;

    if (data.status === 'ended' || data.status === 'cancelled') { endCall(); return; }

    const participants = data.participantIds || [];
    const existingPeers = new Set(groupCallPeerConnections.keys());

    for (const puid of participants) {
      if (puid === uid) continue;
      if (groupCallPeerConnections.has(puid)) continue;

      await _createGroupPeerConnection(callId, puid, callType, uid);
    }

    const participantNames = participants.map(p => p === uid ? 'You' : (data.participantNames?.[p] || p.substring(0, 6)));
    App._groupParticipantNames = {};
    participants.forEach((p, i) => { App._groupParticipantNames[p] = participantNames[i]; });
    setEl('call-status', activeGroupCallParticipants.length + 1 + ' connected');

    if (data.answers) {
      Object.entries(data.answers).forEach(([answerUid, answerData]) => {
        if (answerUid === uid) return;
        const pc = groupCallPeerConnections.get(answerUid);
        if (pc && pc.signalingState === 'have-local-offer' && answerData?.sdp) {
          pc.setRemoteDescription(new RTCSessionDescription(answerData)).catch(() => {});
        }
      });
    }

    if (data.offers) {
      Object.entries(data.offers).forEach(([offerUid, offerData]) => {
        if (offerUid === uid || !offerData?.sdp) return;
        if (groupCallPeerConnections.has(offerUid)) return;
        _answerGroupCallOffer(callId, offerUid, offerData, callType, uid);
      });
    }
  });
}

async function _answerGroupCallOffer(callId, remoteUid, offerData, callType, myUid) {
  if (!App.db) return;
  try {
    const rtcConfig = await getRtcConfig();
    const pc = new RTCPeerConnection(rtcConfig);
    groupCallPeerConnections.set(remoteUid, pc);
    localCallStream.getTracks().forEach(track => pc.addTrack(track, localCallStream));
    pc.onicecandidate = async (e) => {
      if (e.candidate && App.db) {
        await App.db.collection('calls').doc(callId).collection('candidates').add({
          candidate: e.candidate.toJSON(), sender: myUid, targetUid: remoteUid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      activeGroupCallParticipants = activeGroupCallParticipants.filter(p => p.uid !== remoteUid);
      const name = App._groupParticipantNames?.[remoteUid] || remoteUid.substring(0, 6);
      activeGroupCallParticipants.push({ uid: remoteUid, stream, pc, name });
      if (callType === 'video') _renderGroupVideoGrid();
      else {
        const existingAudio = document.getElementById('group-audio-' + remoteUid);
        if (existingAudio) { existingAudio.srcObject = stream; }
        else { const audio = document.createElement('audio'); audio.id = 'group-audio-' + remoteUid; audio.srcObject = stream; audio.autoplay = true; document.body.appendChild(audio); }
      }
      const count = activeGroupCallParticipants.length + 1;
      setEl('call-status', count + ' participant' + (count > 1 ? 's' : ''));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        activeGroupCallParticipants = activeGroupCallParticipants.filter(p => p.uid !== remoteUid);
        groupCallPeerConnections.delete(remoteUid);
        pc.close();
        if (App.db && App._activeCallId) {
          App.db.collection('calls').doc(App._activeCallId).update({
            participantIds: firebase.firestore.FieldValue.arrayRemove(remoteUid)
          }).catch(() => {});
        }
        _renderGroupVideoGrid();
      }
    };
    await pc.setRemoteDescription(new RTCSessionDescription(offerData));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await App.db.collection('calls').doc(callId).update({
      ['answers.' + myUid]: { sdp: answer.sdp, type: answer.type }
    });
    _listenGroupCandidates(callId, remoteUid, pc, myUid);
  } catch(e) { console.warn('Group answer error:', e); }
}

async function _createGroupPeerConnection(callId, remoteUid, callType, myUid) {
  if (!App.db) return;
  try {
    const rtcConfig = await getRtcConfig();
    const pc = new RTCPeerConnection(rtcConfig);
    groupCallPeerConnections.set(remoteUid, pc);

    localCallStream.getTracks().forEach(track => pc.addTrack(track, localCallStream));

    pc.onicecandidate = async (e) => {
      if (e.candidate && App.db) {
        await App.db.collection('calls').doc(callId).collection('candidates').add({
          candidate: e.candidate.toJSON(), sender: myUid, targetUid: remoteUid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      const name = App._groupParticipantNames?.[remoteUid] || remoteUid.substring(0, 6);
      activeGroupCallParticipants = activeGroupCallParticipants.filter(p => p.uid !== remoteUid);
      activeGroupCallParticipants.push({ uid: remoteUid, stream, pc, name });

      if (callType === 'video') _renderGroupVideoGrid();
      else {
        const existingAudio = document.getElementById('group-audio-' + remoteUid);
        if (existingAudio) { existingAudio.srcObject = stream; }
        else { const audio = document.createElement('audio'); audio.id = 'group-audio-' + remoteUid; audio.srcObject = stream; audio.autoplay = true; document.body.appendChild(audio); }
      }

      const count = activeGroupCallParticipants.length + 1;
      setEl('call-status', count + ' participant' + (count > 1 ? 's' : ''));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        activeGroupCallParticipants = activeGroupCallParticipants.filter(p => p.uid !== remoteUid);
        groupCallPeerConnections.delete(remoteUid);
        pc.close();
        if (App.db && App._activeCallId) {
          App.db.collection('calls').doc(App._activeCallId).update({
            participantIds: firebase.firestore.FieldValue.arrayRemove(remoteUid)
          }).catch(() => {});
        }
        _renderGroupVideoGrid();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await App.db.collection('calls').doc(callId).update({
      ['offers.' + remoteUid]: { sdp: offer.sdp, type: offer.type, from: myUid }
    });

    const callDoc = await App.db.collection('calls').doc(callId).get();
    const callData = callDoc.data();
    if (callData?.offers?.[myUid] && callData.offers[myUid].from !== myUid) {
      await pc.setRemoteDescription(new RTCSessionDescription(callData.offers[myUid]));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await App.db.collection('calls').doc(callId).update({
        ['answers.' + myUid]: { sdp: answer.sdp, type: answer.type }
      });
    }

    _listenGroupCandidates(callId, remoteUid, pc, myUid);

  } catch(e) { console.warn('Group peer connection error:', e); }
}

function _listenGroupCandidates(callId, remoteUid, pc, myUid) {
  if (!App.db) return;
  const unsub = App.db.collection('calls').doc(callId).collection('candidates')
    .where('targetUid', '==', myUid)
    .orderBy('createdAt').onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const c = change.doc.data();
          if (c.sender === remoteUid && pc.signalingState !== 'closed') {
            pc.addIceCandidate(new RTCIceCandidate(c.candidate)).catch(() => {});
          }
        }
      });
    });
  groupCallCandidateUnsubscribes.push(unsub);
}

function _renderGroupVideoGrid() {
  let grid = document.getElementById('group-video-grid');
  if (!grid) {
    grid = document.createElement('div');
    grid.id = 'group-video-grid';
    grid.className = 'absolute inset-0 z-0 p-2 grid gap-1';
    document.getElementById('call-screen')?.insertBefore(grid, document.getElementById('call-screen').firstChild);
  }
  const count = activeGroupCallParticipants.length;
  const cols = count <= 2 ? 2 : 2;
  const rows = count <= 2 ? 1 : 2;
  grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
  grid.style.gridTemplateRows = 'repeat(' + rows + ', 1fr)';
  grid.innerHTML = '';
  activeGroupCallParticipants.forEach(p => {
    const div = document.createElement('div');
    div.className = 'relative rounded-lg overflow-hidden bg-black/50';
    const video = document.createElement('video');
    video.srcObject = p.stream;
    video.autoplay = true;
    video.playsinline = true;
    video.className = 'w-full h-full object-cover';
    div.appendChild(video);
    const label = document.createElement('div');
    label.className = 'absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded';
    label.textContent = p.name || p.uid.substring(0, 6);
    div.appendChild(label);
    grid.appendChild(div);
  });
  document.getElementById('remote-video')?.classList.add('hidden');
  document.getElementById('call-info-section')?.classList.add('hidden');
}

async function _handleAcceptedGroupCall(callData) {
  const { callId, type: callType, groupId } = callData;
  const uid = App.auth?.currentUser?.uid;
  if (!uid || !App.db) return;

  currentCallType = callType;
  App.callActive = true;
  micMuted = false;
  cameraOff = (callType === 'voice');
  activeCallMode = 'group';
  App._activeCallId = callId;
  activeGroupCallParticipants = [];

  if (typeof PermissionsManager !== 'undefined') {
    const permFeature = callType === 'video' ? 'Video Call' : 'Audio Call';
    const granted = await PermissionsManager.ensureForFeature(permFeature);
    if (!granted) { endCall(); return; }
  }

  const callDoc = await App.db.collection('calls').doc(callId).get();
  const callSnap = callDoc.data();
  setEl('call-name', callSnap?.groupName || 'Group Call');
  setEl('call-status', 'Connecting…');
  hide('call-timer');
  document.getElementById('call-screen')?.classList.remove('hidden');
  document.getElementById('call-quality-text').textContent = callType === 'video' ? 'HD Group Video' : 'HD Group Voice';
  document.getElementById('btn-cam')?.classList.toggle('hidden', callType === 'voice');

  try {
    const constraints = { audio: true, video: callType === 'video' ? { facingMode: preferredCameraFacingMode, width: { ideal: window.isTablet ? 1920 : 1280 }, height: { ideal: window.isTablet ? 1080 : 720 } } : false };
    localCallStream = await navigator.mediaDevices.getUserMedia(constraints);
    const localVideo = document.getElementById('local-video');
    if (localVideo && callType === 'video') { localVideo.srcObject = localCallStream; document.getElementById('local-video-container')?.classList.remove('hidden'); }

    await App.db.collection('calls').doc(callId).update({ status: 'active' });
    listenForGroupCallParticipants(callId, callType);
    listenForCallStatus(callId);
    requestWakeLock();
    startCallHeartbeat(callId);

  } catch(err) { console.error('Accept group call error:', err); showToast('Could not join call', 'error'); endCall(); }
}

function cleanupGroupCalls() {
  groupCallPeerConnections.forEach((pc, uid) => { pc.close(); });
  groupCallPeerConnections.clear();
  groupCallCandidateUnsubscribes.forEach(unsub => { unsub(); });
  groupCallCandidateUnsubscribes = [];
  if (groupCallDocUnsubscribe) { groupCallDocUnsubscribe(); groupCallDocUnsubscribe = null; }
  activeGroupCallParticipants = [];
  document.getElementById('group-video-grid')?.remove();
  document.querySelectorAll('[id^="group-audio-"]').forEach(el => el.remove());
}

function startCallHeartbeat(callId) {
  clearInterval(callHeartbeatTimer);
  callHeartbeatTimer = setInterval(() => {
    if (!App.callActive || !App.db || !App._activeCallId) { clearInterval(callHeartbeatTimer); return; }
    App.db.collection('calls').doc(callId).update({
      heartbeat: firebase.firestore.FieldValue.serverTimestamp(),
      heartbeatUid: App.auth?.currentUser?.uid
    }).catch(() => {});
  }, 15000);
}

function handleCallNotificationUrlParams() {
  const params = new URLSearchParams(location.search);
  const callId = params.get('callId');
  const action = params.get('callAction');
  if (!callId) return;
  if (action === 'accept') {
    setTimeout(() => {
      App.db?.collection('calls').doc(callId).get().then(doc => {
        const data = doc.data();
        if (!data || data.status !== 'ringing') return;
        const uid = App.auth?.currentUser?.uid;
        if (!data.participants?.includes(uid)) return;
        App._incomingCallData = { callId, type: data.type, fromUserId: data.fromUserId, fromUserName: data.fromUserName, groupCall: data.groupCall };
        acceptCall();
      }).catch(() => {});
    }, 1500);
  } else if (action === 'decline') {
    setTimeout(() => {
      App.db?.collection('calls').doc(callId).update({ status: 'rejected' }).catch(() => {});
    }, 500);
  }
  window.history.replaceState({}, '', location.pathname);
}

/* ══════════════════════════════════════════════════
   16. SEARCH SYSTEM
   ══════════════════════════════════════════════════ */
// openChatSearch is fully implemented in app-extras.js
// This stub is kept as a no-op fallback
// openChatSearch is defined in app-extras.js with full in-chat search UI
function filterChats(q) { renderChatList(q); }

/* ─── Sidebar search: dual-mode ─── */
function handleSidebarSearch(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const val = event.target.value.trim();
    if (!val) return;
    if (val.includes('@') && val.indexOf('@') < val.length - 1 && val.includes('.')) {
      triggerSidebarSearch();
    }
  }
}

function triggerSidebarSearch() {
  const input = document.getElementById('sidebar-search');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  if (!(val.includes('@') && val.indexOf('@') < val.length - 1 && val.includes('.'))) return;
  searchUserFromSidebar(val);
}

function searchUserFromSidebar(email) {
  const list = document.getElementById('chat-list');
  if (!list) return;
  list.innerHTML = `<div class="p-4 text-center text-xs text-on-surface-variant">Searching for ${escHtml(email)}...</div>`;
  searchUserByEmail(email).then(user => {
    if (!user) {
      list.innerHTML = `
        <div class="flex flex-col items-center py-12 text-center w-full">
          <div class="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4 border border-outline-variant/20 shadow-md">
            <span class="material-symbols-outlined text-on-surface-variant text-3xl">person_search</span>
          </div>
          <h4 class="font-bold mb-1">User Not Found</h4>
          <p class="text-on-surface-variant text-xs max-w-xs">No registered user found with email <strong>${escHtml(email)}</strong></p>
          <button class="mt-4 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all" onclick="clearSidebarSearch()">Back to Chats</button>
        </div>`;
      return;
    }
    const existingChat = App.chats.find(c => c.uid === user.uid);
    list.innerHTML = `
      <div class="flex flex-col items-center py-12 text-center w-full">
        <div class="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-2xl ${user.avatar} mb-4 shadow-md">${escHtml(user.initials)}</div>
        <h4 class="font-bold text-lg mb-1">${escHtml(user.name)}</h4>
        <p class="text-on-surface-variant text-xs mb-6">${escHtml(user.email)}</p>
        ${existingChat
          ? `<p class="text-xs text-on-surface-variant mb-2">Already in your chats</p>
             <button class="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all" onclick="clearSidebarSearch();openChat('${existingChat.id}')">Open Chat</button>`
          : `<button class="send-req-btn px-6 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow" data-req-uid="${user.uid}" data-req-email="${escHtml(user.email)}" data-req-name="${escHtml(user.name)}" onclick="sendChatRequestBtn(this);clearSidebarSearch()">Send Chat Request</button>`
        }
        <button class="mt-3 px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-all" onclick="clearSidebarSearch()">Back to chats</button>
      </div>`;
  });
}

function clearSidebarSearch() {
  const input = document.getElementById('sidebar-search');
  if (input) { input.value = ''; }
  renderChatList();
}

/* ══════════════════════════════════════════════════
    17. SCROLLS
   ══════════════════════════════════════════════════ */
function scrollToBottom(instant=false) {
  const wrap = document.getElementById('messages-wrap');
  if (!wrap) return;
  if (App._vsActive) {
    const msgs = App.messages[App._vsChatId] || [];
    if (msgs.length > 0) {
      requestAnimationFrame(() => {
        VirtualScroll.scrollToIndex(msgs.length - 1);
        wrap.scrollTop = wrap.scrollHeight;
      });
    }
  } else {
    requestAnimationFrame(() => {
      wrap.scrollTo({ top: wrap.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
    });
  }
  hide('scroll-to-bottom');
  App.unreadScrollCount = 0;
}

document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('messages-wrap');
  if (!wrap) return;
  wrap.addEventListener('scroll', () => {
    let atBottom;
    if (App._vsActive) {
      atBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 200;
    } else {
      atBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 100;
    }
    const btn = document.getElementById('scroll-to-bottom');
    if (btn) btn.classList.toggle('hidden', atBottom);
  });

  /* ── Keyboard avoidance via visualViewport (mobile + tablet) ── */
  if (window.visualViewport) {
    let _lastVpHeight = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', () => {
      const vp = window.visualViewport;
      const inputBar = document.getElementById('input-bar');
      if (inputBar && inputBar.style.display !== 'none') {
        inputBar.style.transform = `translateY(${Math.max(0, window.innerHeight - vp.height - vp.offsetTop)}px)`;
      }
      /* Scroll to bottom when keyboard opens */
      if (vp.height < _lastVpHeight - 100 && App.currentChat) {
        setTimeout(() => scrollToBottom(true), 100);
      }
      _lastVpHeight = vp.height;
    });
    window.visualViewport.addEventListener('scroll', () => {
      const inputBar = document.getElementById('input-bar');
      if (inputBar) inputBar.style.transform = '';
    });
  }

  /* ── Orientation / resize: recalculate layout (mobile + tablet + desktop) ── */
  let _resizeTimer;
  let _lastOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      const prevW = App._viewportWidth || window.innerWidth;
      const prevH = App._viewportHeight || window.innerHeight;
      App._viewportWidth = window.innerWidth;
      App._viewportHeight = window.innerHeight;
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      const isDesktop = window.innerWidth >= 1024;
      const chatArea = document.getElementById('chat-area');
      const sidebar = document.getElementById('sidebar');
      const chatListSidebar = document.getElementById('chat-list-sidebar');
      const detailPanel = document.getElementById('detail-panel');
      const curOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      const orientationChanged = curOrientation !== _lastOrientation;
      _lastOrientation = curOrientation;

      if (isMobile) {
        if (chatArea) chatArea.classList.add('hidden-mobile');
        if (chatArea) chatArea.classList.remove('visible-mobile');
        if (chatListSidebar) chatListSidebar.classList.remove('hidden');
        if (sidebar) sidebar.classList.add('hidden');
      } else {
        if (chatArea) chatArea.classList.remove('hidden-mobile', 'visible-mobile');
        if (chatListSidebar) chatListSidebar.classList.remove('hidden');
        if (sidebar) sidebar.classList.remove('hidden');
      }

      /* C6: Handle split-screen — if width dropped below tablet while previously desktop, adjust */
      if (prevW >= 1024 && window.innerWidth < 1024 && window.innerWidth >= 768) {
        if (detailPanel) { detailPanel.classList.add('hidden'); detailPanel.classList.remove('flex'); }
      }
      if (prevW < 1024 && window.innerWidth >= 1024 && App.currentChat) {
        if (detailPanel) { detailPanel.classList.remove('hidden'); detailPanel.classList.add('flex'); if (typeof openChatInfo === 'function') openChatInfo(); }
      }

      /* C4: Re-run openChatInfo on orientation change so detail panel content updates */
      if (orientationChanged && App.currentChat && typeof openChatInfo === 'function') {
        openChatInfo();
      }

      if (App.currentChat) {
        renderMessages(App.currentChat.id);
        scrollToBottom(true);
      }
    }, 150);
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
  VirtualScroll.destroy();
  App._vsActive = false;
  App._vsChatId = null;
  const wrap = document.getElementById('messages-wrap');
  if (wrap) wrap.style.display = 'none';
  const inputBar = document.getElementById('input-bar');
  if (inputBar) inputBar.style.display = 'none';
  
  // On mobile/tablet-portrait, hide the chat-area so the chat list is visible again
  if (window.innerWidth < 1024 || App.showroomViewport === 'mobile') {
    const chatArea = document.getElementById('chat-area');
    if (chatArea) { chatArea.classList.remove('visible-mobile'); chatArea.classList.add('hidden-mobile'); }
    const detailPanel = document.getElementById('detail-panel');
    if (detailPanel) { detailPanel.classList.add('hidden'); detailPanel.classList.remove('flex', 'tablet-overlay-panel'); }
  }
  
  // L7: Tablet first-time onboarding tip
  if (window.isTablet && !localStorage.getItem('nsl-tablet-onboarded')) {
    setTimeout(() => {
      if (typeof showToast === 'function') {
        showToast('Tip: Tap the sidebar icon (☰) to expand the chat list', 'info');
      }
      localStorage.setItem('nsl-tablet-onboarded', '1');
    }, 1500);
  }
  
  App.currentChat = null;
  renderChatList();
}

/* ══════════════════════════════════════════════════
   19. INFO DETAIL PANELS
   ══════════════════════════════════════════════════ */
function openChatInfo() {
  if (!App.currentChat) return;
  /* H10: Show close button header on tablet overlay mode */
  const panel = document.getElementById('detail-panel');
  if (panel) {
    const hdr = panel.querySelector('.tablet-panel-header');
    if (hdr) {
      const isTabletOverlay = panel.classList.contains('tablet-overlay-panel');
      hdr.style.display = isTabletOverlay ? 'flex' : 'none';
    }
  }
  if (isMyselfChatId(App.currentChat.id)) {
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
      ${contact.initials
        ? `<div class="w-24 h-24 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-3xl border border-outline-variant/20">${contact.initials}</div>`
        : `<div class="w-24 h-24 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline-variant/20"><span class="material-symbols-outlined text-4xl" style="color:var(--on-surface-variant)">person_off</span></div>`}
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
      <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/40 transition-colors text-xs font-semibold text-on-surface" onclick="renderInlineGallery()">
        <span class="material-symbols-outlined text-primary text-base">perm_media</span>
        <span>Media & Files</span>
      </button>
      <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/40 transition-colors text-xs font-semibold text-on-surface" onclick="toggleChatMute(App.currentChat?.id)">
        <span class="material-symbols-outlined text-primary text-base">notifications_off</span>
        <span>Mute Notifications</span>
      </button>
      <div class="flex items-center justify-between p-3 rounded-xl hover:bg-surface-variant/40 transition-colors">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-base">timer</span>
          <div>
            <div class="text-xs font-semibold text-on-surface">Disappearing Messages</div>
            <div class="text-[10px] text-on-surface-variant">${(function(){const v=App.currentChat?.disappearingMessages||0;return v>=86400000*90?'90 days':v>=86400000*7?'7 days':v>=86400000?'24 hours':'Off';})()}</div>
          </div>
        </div>
        <select onchange="setDisappearingMessages(App.currentChat?.id, Number(this.value))" class="bg-surface-container border border-outline-variant/30 rounded-lg px-2 py-1 text-xs">
          <option value="0" ${(App.currentChat?.disappearingMessages||0)===0?'selected':''}>Off</option>
          <option value="${86400000}" ${(App.currentChat?.disappearingMessages||0)===86400000?'selected':''}>24 hours</option>
          <option value="${604800000}" ${(App.currentChat?.disappearingMessages||0)===604800000?'selected':''}>7 days</option>
          <option value="${7776000000}" ${(App.currentChat?.disappearingMessages||0)===7776000000?'selected':''}>90 days</option>
        </select>
      </div>
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
      <div class="space-y-2" id="group-members-list">
        <div class="text-xs text-on-surface-variant">Loading members...</div>
      </div>
    </div>

    <div class="px-6 py-4 border-t border-outline-variant/10 space-y-3">
      <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Channel Management</span>
      <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/40 transition-colors text-xs font-semibold text-on-surface" onclick="renderInlineGallery()">
        <span class="material-symbols-outlined text-primary text-base">perm_media</span>
        <span>Media & Files</span>
      </button>
      <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/40 transition-colors text-xs font-semibold text-on-surface" onclick="copyInviteLink()">
        <span class="material-symbols-outlined text-primary text-base">link</span>
        <span>Copy Invite Link</span>
      </button>
      <div class="flex items-center justify-between p-3 rounded-xl hover:bg-surface-variant/40 transition-colors">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-base">timer</span>
          <div>
            <div class="text-xs font-semibold text-on-surface">Disappearing Messages</div>
            <div class="text-[10px] text-on-surface-variant">${(function(){const v=App.currentChat?.disappearingMessages||0;return v>=86400000*90?'90 days':v>=86400000*7?'7 days':v>=86400000?'24 hours':'Off';})()}</div>
          </div>
        </div>
        <select onchange="setDisappearingMessages(App.currentChat?.id, Number(this.value))" class="bg-surface-container border border-outline-variant/30 rounded-lg px-2 py-1 text-xs">
          <option value="0" ${(App.currentChat?.disappearingMessages||0)===0?'selected':''}>Off</option>
          <option value="${86400000}" ${(App.currentChat?.disappearingMessages||0)===86400000?'selected':''}>24 hours</option>
          <option value="${604800000}" ${(App.currentChat?.disappearingMessages||0)===604800000?'selected':''}>7 days</option>
          <option value="${7776000000}" ${(App.currentChat?.disappearingMessages||0)===7776000000?'selected':''}>90 days</option>
        </select>
      </div>
      <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-colors text-xs font-semibold text-red-500" onclick="confirmLeaveGroup()">
        <span class="material-symbols-outlined text-base">exit_to_app</span>
        <span>Leave Channel</span>
      </button>
    </div>
  `;
  panel.classList.remove('hidden');
  panel.classList.add('flex');

  loadGroupMembersList(chat);
}

async function loadGroupMembersList(chat) {
  const listEl = document.getElementById('group-members-list');
  if (!listEl || !App.db) return;
  try {
    const memberIds = chat.memberIds || chat.members || [];
    if (!memberIds.length) { listEl.innerHTML = '<div class="text-xs text-on-surface-variant">No members found</div>'; return; }
    const ownerId = chat.ownerId || chat.createdBy || '';
    const adminIds = chat.adminIds || [];
    const userSnaps = await Promise.all(memberIds.map(id => App.db.collection('users').doc(id).get()));
    const rows = userSnaps.filter(d => d.exists).map(d => {
      const u = d.data();
      const uid = d.id;
      const name = escHtml(u.displayName || u.email || 'Member');
      const initials = (name || '?').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
      let role = 'Member';
      let roleClass = 'bg-surface-container-high text-on-surface-variant';
      if (uid === ownerId) { role = 'Owner'; roleClass = 'bg-secondary/25 text-secondary'; }
      else if (adminIds.includes(uid)) { role = 'Admin'; roleClass = 'bg-primary/25 text-primary'; }
      return `<div class="flex items-center justify-between p-2 hover:bg-surface-container rounded-lg">
        <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-xs">${initials}</div><span class="text-xs font-semibold">${name}</span></div>
        <span class="text-[9px] font-bold uppercase tracking-wider ${roleClass} px-2 py-0.5 rounded">${role}</span>
      </div>`;
    });
    listEl.innerHTML = rows.join('') || '<div class="text-xs text-on-surface-variant">No members found</div>';
  } catch (e) {
    listEl.innerHTML = '<div class="text-xs text-on-surface-variant">Failed to load members</div>';
  }
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
      <button class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/40 transition-colors text-xs font-semibold text-on-surface" onclick="confirmClearChat(App.currentChat?.id || 'saved_me')">
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
    panel.classList.remove('flex', 'tablet-overlay-panel');
    const hdr = panel.querySelector('.tablet-panel-header');
    if (hdr) hdr.style.display = 'none';
  }
}

/* ══════════════════════════════════════════════════
   20a. INLINE MEDIA GALLERY (in detail panel)
   ══════════════════════════════════════════════════ */
let _galleryPanelMode = null;

function renderInlineGallery() {
  const panel = document.getElementById('detail-panel');
  if (!panel) return;
  const chat = App.currentChat;
  if (!chat) return;
  _galleryPanelMode = chat.type === 'group' ? 'group' : 'contact';

  panel.innerHTML = `
    <div class="p-4 border-b border-outline-variant/10 flex items-center gap-3 bg-surface-container">
      <button onclick="restoreDetailPanel()" class="text-on-surface-variant hover:text-on-surface flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-variant/40 transition-all">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <h3 class="font-bold text-on-surface flex-1">Media & Files</h3>
      <button onclick="closeDetailPanel()" class="text-on-surface-variant hover:text-on-surface flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-variant/40 transition-all">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <div class="flex gap-2 p-4 border-b border-outline-variant/10 flex-wrap justify-center sm:justify-start" id="_inline-gallery-tabs">
      <button class="_g-tab px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer" data-tab="photos" onclick="renderInlineGalleryTab('photos')">Photos</button>
      <button class="_g-tab px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer" data-tab="videos" onclick="renderInlineGalleryTab('videos')">Videos</button>
      <button class="_g-tab px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer" data-tab="docs" onclick="renderInlineGalleryTab('docs')">Documents</button>
      <button class="_g-tab px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer" data-tab="urls" onclick="renderInlineGalleryTab('urls')">Links</button>
    </div>
    <div class="flex-1 overflow-y-auto" id="_inline-gallery-content" style="max-height:calc(100vh - 200px)"></div>
  `;
  renderInlineGalleryTab('photos');
}

function restoreDetailPanel() {
  if (_galleryPanelMode === 'group') openGroupInfoPanel();
  else openContactInfoPanel(App.currentChat?.uid);
}

function renderInlineGalleryTab(tab) {
  const chatId = App.currentChat && App.currentChat.id;
  const msgs = (chatId && App.messages[chatId]) || [];
  const container = document.getElementById('_inline-gallery-content');
  if (!container) return;

  let filtered = [];
  if (tab === 'photos') filtered = msgs.filter(m => m.type === 'image');
  else if (tab === 'videos') filtered = msgs.filter(m => m.type === 'video');
  else if (tab === 'docs') filtered = msgs.filter(m => m.type === 'doc');
  else if (tab === 'urls') filtered = msgs.filter(m => m.text && (m.text.includes('http://') || m.text.includes('https://') || m.text.includes('www.')));
  else filtered = [];

  // Update tab styles
  document.querySelectorAll('._g-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.style.background = isActive ? 'var(--primary)' : 'transparent';
    btn.style.color = isActive ? 'var(--on-primary)' : 'var(--on-surface-variant)';
    btn.style.borderColor = isActive ? 'var(--primary)' : 'var(--outline-variant)';
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="flex flex-col items-center justify-center h-48 gap-3" style="color:var(--on-surface-variant);opacity:0.5">
      <span class="material-symbols-outlined" style="font-size:40px;">perm_media</span>
      <p class="text-sm">No ${tab} shared yet</p>
    </div>`;
    return;
  }

  if (tab === 'urls') {
    container.innerHTML = `<div class="flex flex-col gap-2 p-4">${
      filtered.map(m => {
        const urlMatch = m.text.match(/(https?:\/\/[^\s]+)/g);
        const url = urlMatch ? urlMatch[0] : m.text;
        let hostname = '';
        try { hostname = new URL(url).hostname; } catch(e) { hostname = url; }
        return `<div onclick="openMediaViewer('${m.id}','text')" class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors" style="background:var(--surface-container);" onmouseenter="this.style.background='var(--surface-container-high)'" onmouseleave="this.style.background='var(--surface-container)'">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style="background:var(--surface-container-highest);color:var(--on-surface-variant)"><span class="material-symbols-outlined">link</span></div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold truncate" style="color:var(--on-surface)">${escHtml(hostname)}</div>
            <div class="text-[10px] truncate" style="color:var(--on-surface-variant)">${escHtml(url)}</div>
          </div>
        </div>`;
      }).join('')
    }</div>`;
  } else if (tab === 'docs') {
    container.innerHTML = `<div class="flex flex-col gap-2 p-4">${
      filtered.map(m => {
        const ext = (m.fileName || '').split('.').pop().toUpperCase() || 'FILE';
        return `<div onclick="openMediaViewer('${m.id}')" class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors" style="background:var(--surface-container);" onmouseenter="this.style.background='var(--surface-container-high)'" onmouseleave="this.style.background='var(--surface-container)'">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(66,133,244,0.15);"><span class="text-[10px] font-bold" style="color:#4285f4;">${escHtml(ext)}</span></div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold truncate" style="color:var(--on-surface)">${escHtml(m.fileName || 'Document')}</div>
            <div class="text-[10px]" style="color:var(--on-surface-variant)">${m.fileSize || ''}</div>
          </div>
        </div>`;
      }).join('')
    }</div>`;
  } else {
    container.innerHTML = `<div class="grid gap-2 p-4" style="grid-template-columns:repeat(auto-fill,minmax(100px,1fr));">${
      filtered.map(m => {
        const isVideo = m.type === 'video';
        return `<div onclick="openMediaViewer('${m.id}')" class="aspect-square rounded-xl overflow-hidden cursor-pointer relative transition-transform" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'" style="background:var(--surface-container);">
          ${isVideo
            ? `<video src="${escHtml(m.url)}" preload="metadata" muted class="w-full h-full object-cover"></video><div class="absolute inset-0 flex items-center justify-center" style="background:rgba(0,0,0,0.15);color:white;"><span class="material-symbols-outlined" style="font-size:32px;">play_circle</span></div>`
            : `<img src="${escHtml(m.url)}" loading="lazy" class="w-full h-full object-cover">`
          }
        </div>`;
      }).join('')
    }</div>`;
  }
}

/* ══════════════════════════════════════════════════
   21. DIRECT CHAT GENERATIONS
   ══════════════════════════════════════════════════ */
function openNewChat() {
  show('new-chat-overlay');
  renderContactList();
}

function filterNewChatList(query) {
  const list = document.getElementById('contact-list');
  if (!list) return;
  const q = (query || '').toLowerCase();
  const items = list.querySelectorAll('[onclick^="startChatWith"]');
  items.forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = text.includes(q) ? '' : 'none';
  });
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
        const initials = c.initials || '';
        const avatarHtml = initials
          ? `<div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm bg-surface-container-highest text-on-surface-variant">${initials}</div>`
          : `<div class="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-container-highest text-on-surface-variant"><span class="material-symbols-outlined text-lg">person_off</span></div>`;
        
        return `
        <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container transition-all cursor-pointer group" onclick="startChatWith('${c.uid}')">
          <div class="relative flex-shrink-0">
            ${avatarHtml}
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
      about: contact.email || '',
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
          [uid]: contact.email || ''
        },
        participantEmailList: [App.currentUser.email || '', contact.email || ''],
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
  if (!chat) return;
  chat.pinned = !chat.pinned;
  renderChatList();
  showToast(chat.pinned ? 'Conversation pinned' : 'Conversation unpinned', 'success');
  if (App.db && App.auth?.currentUser) {
    const uid = App.auth.currentUser.uid;
    const col = chat.type === 'group' ? 'groups' : 'directChats';
    App.db.collection(col).doc(chatId).set(
      { pinned: { [uid]: chat.pinned } },
      { merge: true }
    ).catch(() => {});
  }
}

async function pinMessage(msgId) {
  const chat = App.currentChat;
  if (!chat || !App.db || !App.auth?.currentUser) return;
  
  const msgs = App.messages[chat.id] || [];
  const msg = msgs.find(m => m.id === msgId);
  if (!msg) return;

  const senderName = msg.from === 'me' ? 'You' : (App.contacts.find(c => c.uid === msg.from)?.name || App.chats.find(c => c.uid === msg.from)?.name || 'User');

  const pin = {
    chatId: chat.id,
    messageId: msgId,
    text: msg.text || (msg.type !== 'text' ? '📎 Media attachment' : ''),
    senderName: senderName,
    timestamp: msg.time,
    pinnedAt: firebase.firestore.FieldValue.serverTimestamp(),
    pinnedBy: App.auth.currentUser.uid,
    isGroupPin: chat.type === 'group'
  };

  try {
    await App.db.collection('pinnedMessages').add(pin);
    showToast('Message pinned!', 'success');
    loadPinnedMessages(chat.id);
  } catch (err) {
    console.error(err);
    showToast('Failed to pin message', 'error');
  }
}

async function unpinMessageByMsgId(msgId) {
  const chat = App.currentChat;
  if (!chat || !App.db) return;

  try {
    const snap = await App.db.collection('pinnedMessages')
      .where('chatId', '==', chat.id)
      .where('messageId', '==', msgId)
      .get();
    
    const batch = App.db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    showToast('Message unpinned!', 'success');
    loadPinnedMessages(chat.id);
  } catch (err) {
    console.error(err);
    showToast('Failed to unpin message', 'error');
  }
}

async function unpinCurrentMessage() {
  const pins = App.currentChatPinnedMessages || [];
  if (!pins.length) return;
  await unpinMessageByMsgId(pins[0].messageId);
}

async function loadPinnedMessages(chatId) {
  if (!App.db || !chatId) {
    App.currentChatPinnedMessages = [];
    renderPinnedMessageBar();
    return;
  }
  
  try {
    const snap = await App.db.collection('pinnedMessages')
      .where('chatId', '==', chatId)
      .get();
    
    const pins = [];
    snap.forEach(doc => {
      pins.push(Object.assign({ id: doc.id }, doc.data()));
    });
    
    // Sort by pinnedAt descending (most recent first)
    pins.sort((a, b) => getMillis(b.pinnedAt) - getMillis(a.pinnedAt));
    
    App.currentChatPinnedMessages = pins;
    renderPinnedMessageBar();
  } catch (err) {
    console.warn('Failed to load pinned messages:', err);
  }
}

function renderPinnedMessageBar() {
  const bar = document.getElementById('pinned-message-bar');
  const senderEl = document.getElementById('pinned-msg-sender');
  const textEl = document.getElementById('pinned-msg-text');
  if (!bar || !senderEl || !textEl) return;

  const pins = App.currentChatPinnedMessages || [];
  if (!pins.length) {
    bar.classList.add('hidden');
    return;
  }

  const currentPin = pins[0]; // Display the most recently pinned message
  senderEl.textContent = currentPin.senderName || 'User';
  textEl.textContent = currentPin.text || '📎 Media attachment';
  bar.classList.remove('hidden');
}

function scrollToPinnedMessage() {
  const pins = App.currentChatPinnedMessages || [];
  if (!pins.length) return;
  
  const msgId = pins[0].messageId;
  const el = document.getElementById(`msg-${msgId}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('bg-primary/20');
    setTimeout(() => el.classList.remove('bg-primary/20'), 2000);
  } else {
    showToast('Scroll up to find the message', 'info');
  }
}

let _pinnedPanelCleanup = null;

function openPinnedMessagesPanel() {
  const pins = App.currentChatPinnedMessages || [];
  if (!pins.length) { showToast('No pinned messages in this chat', 'info'); return; }

  let overlay = document.getElementById('_pinned-panel-overlay');
  if (overlay) { overlay.remove(); if (_pinnedPanelCleanup) _pinnedPanelCleanup(); }

  overlay = document.createElement('div');
  overlay.id = '_pinned-panel-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--surface-container);border:1px solid var(--outline-variant);border-radius:24px;width:100%;max-width:480px;max-height:85vh;display:flex;flex-direction:column;margin:16px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.5);';

  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--outline-variant);">
      <h3 style="font-size:18px;font-weight:700;color:var(--on-surface)">📌 Pinned Messages</h3>
      <button id="_pinned-close" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant);font-size:20px;padding:4px 8px;border-radius:8px;">✕</button>
    </div>
    <div id="_pinned-panel-list" style="overflow-y:auto;padding:8px 12px;flex:1;"></div>`;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const backdropHandler = e => { if (e.target === overlay) { overlay.remove(); _pinnedPanelCleanup(); } };
  const escHandler = e => { if (e.key === 'Escape') { overlay.remove(); _pinnedPanelCleanup(); } };
  overlay.addEventListener('click', backdropHandler);
  document.addEventListener('keydown', escHandler);
  _pinnedPanelCleanup = () => { overlay.removeEventListener('click', backdropHandler); document.removeEventListener('keydown', escHandler); };
  modal.querySelector('#_pinned-close').onclick = () => { overlay.remove(); _pinnedPanelCleanup(); };

  const list = modal.querySelector('#_pinned-panel-list');
  list.innerHTML = pins.map(pin => {
    const text = escHtml(pin.text || '📎 Media attachment');
    const time = pin.timestamp ? new Date(pin.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date(pin.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return `<div style="padding:12px;border-radius:12px;border-bottom:1px solid var(--outline-variant);cursor:pointer;transition:background 0.15s;" data-pin-msg="${pin.messageId}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:11px;font-weight:700;color:var(--primary);">${escHtml(pin.senderName || 'User')}</span>
        <button class="_unpin-btn" data-msg-id="${pin.messageId}" style="background:none;border:none;cursor:pointer;color:var(--error);font-size:10px;padding:2px 6px;border-radius:6px;">Unpin</button>
      </div>
      <div style="font-size:13px;color:var(--on-surface);word-break:break-word;">${text}</div>
      <div style="font-size:10px;color:var(--on-surface-variant);margin-top:4px;">${time}</div>
    </div>`;
  }).join('');

  list.querySelectorAll('div[data-pin-msg]').forEach(el => {
    el.onclick = (e) => {
      if (e.target.closest('._unpin-btn')) return;
      const msgId = el.dataset.pinMsg;
      const msgEl = document.getElementById('msg-' + msgId);
      if (msgEl) {
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        msgEl.classList.add('bg-primary/20');
        setTimeout(() => msgEl.classList.remove('bg-primary/20'), 2000);
      }
      overlay.remove();
      if (_pinnedPanelCleanup) _pinnedPanelCleanup();
    };
  });

  list.querySelectorAll('._unpin-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      unpinMessageByMsgId(btn.dataset.msgId).then(() => {
        const pins2 = App.currentChatPinnedMessages || [];
        if (!pins2.length) { overlay.remove(); if (_pinnedPanelCleanup) _pinnedPanelCleanup(); }
        else openPinnedMessagesPanel();
      });
    };
  });
}
function confirmDeleteChat(chatId) {
  showConfirm('Delete this conversation? All messages will be lost.', async () => {
    App.chats = App.chats.filter(c => c.id !== chatId);
    App.directChats = App.directChats.filter(c => c.id !== chatId);
    App.groupChats = App.groupChats.filter(c => c.id !== chatId);
    delete App.messages[chatId];
    addDeletedChatId(chatId);
    App._deletedChatIds.add(chatId);
    renderChatList();
    if (App.currentChat?.id === chatId) showWelcome();
    
    if (!App.db) {
      showToast('Conversation deleted (Demo)', 'info');
      return;
    }
    try {
      const uid = App.auth?.currentUser?.uid;
      
      // Mark as deleted for this user in Firestore (cross-device sync)
      if (uid) {
        await App.db.collection('directChats').doc(chatId).update({ [`deletedFor.${uid}`]: true }).catch(() => {});
        await App.db.collection('groups').doc(chatId).update({ [`deletedFor.${uid}`]: true }).catch(() => {});
      }
      
      // Delete associated messages (chunked by 500)
      const msgsSnap = await App.db.collection('messages')
        .where('directId', '==', chatId)
        .get();
      const grpMsgsSnap = await App.db.collection('messages')
        .where('groupId', '==', chatId)
        .get();
      const allRefs = [...msgsSnap.docs.map(d => d.ref), ...grpMsgsSnap.docs.map(d => d.ref)];
      for (let i = 0; i < allRefs.length; i += 500) {
        const batch = App.db.batch();
        allRefs.slice(i, i + 500).forEach(ref => batch.delete(ref));
        await batch.commit();
      }
      
      showToast('Conversation deleted', 'success');
    } catch (err) {
      console.error(err);
    }
  });
}

async function confirmClearChat(chatId) {
  showConfirm('Clear conversation message history? This cannot be undone.', async () => {
    if (!chatId) return;
    const uid = App.auth && App.auth.currentUser && App.auth.currentUser.uid;
    if (!uid) { showToast('Not logged in', 'error'); return; }
    const msgs = App.messages[chatId] || [];
    App.messages[chatId] = [];
    if (App.currentChat?.id === chatId) renderMessages(chatId);
    renderChatList();
    if (App.db && uid && msgs.length) {
      try {
        const batch = App.db.batch();
        msgs.forEach(m => {
          if (m.id) {
            const ref = App.db.collection('messages').doc(m.id);
            batch.update(ref, { [`deletedFor.${uid}`]: true });
          }
        });
        await batch.commit();
      } catch (_) {}
      try {
        const key = 'nsl_deleted_msgs';
        const o = JSON.parse(localStorage.getItem(key) || '{}');
        o[chatId] = o[chatId] || [];
        msgs.forEach(m => { if (m.id && !o[chatId].includes(m.id)) o[chatId].push(m.id); });
        localStorage.setItem(key, JSON.stringify(o));
      } catch (_) {}
    }
    showToast('Chat history cleared', 'info');
  });
}
function confirmLeaveGroup() {
  const chat = App.currentChat;
  if (!chat) return;
  showConfirm('Leave this group channel room?', async () => {
    const uid = App.auth && App.auth.currentUser && App.auth.currentUser.uid;
    // Firestore: remove user from group members
    if (App.db && uid) {
      try {
        const groupRef = App.db.collection('groups').doc(chat.id);
        const groupDoc = await groupRef.get();
        if (groupDoc.exists) {
          const data = groupDoc.data();
          const members = (data.members || []).filter(m => m !== uid && m.uid !== uid);
          await groupRef.update({ members });
        }
        // Also try cloud function if available
        if (window.firebase && firebase.functions) {
          try {
            const fn = firebase.functions().httpsCallable('leaveGroup');
            await fn({ groupId: chat.id });
          } catch(_) {} // CF may not exist, fallback to direct update is fine
        }
      } catch(e) { console.warn('Leave group Firestore error:', e); }
    }
    App.chats = App.chats.filter(c => c.id !== chat.id);
    App.directChats = (App.directChats || []).filter(c => c.id !== chat.id);
    App.groupChats = (App.groupChats || []).filter(c => c.id !== chat.id);
    delete App.messages[chat.id];
    addDeletedChatId(chat.id);
    App._deletedChatIds.add(chat.id);
    renderChatList();
    showWelcome();
    showToast('Left the group', 'info');
  });
}

function renameGroup() {
  const chat = App.currentChat;
  if (!chat || chat.type !== 'group') return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'rename-group-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px;width:90%">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-on-surface">Rename Group</h3>
        <button class="text-on-surface-variant hover:text-on-surface" onclick="document.getElementById('rename-group-overlay').remove()"><span class="material-symbols-outlined">close</span></button>
      </div>
      <input id="rename-group-input" type="text" value="${escHtml(chat.name || '')}" maxlength="50" class="w-full p-3 rounded-xl bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary" placeholder="Group name">
      <div class="flex justify-end gap-2 mt-4">
        <button class="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high" onclick="document.getElementById('rename-group-overlay').remove()">Cancel</button>
        <button class="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold" onclick="_saveGroupName('${chat.id}')">Save</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById('rename-group-input');
  if (input) { input.focus(); input.select(); }
}

async function _saveGroupName(groupId) {
  const input = document.getElementById('rename-group-input');
  if (!input) return;
  const newName = input.value.trim();
  if (!newName) { showToast('Name cannot be empty', 'error'); return; }
  document.getElementById('rename-group-overlay')?.remove();
  App.chats = App.chats.map(c => c.id === groupId ? { ...c, name: newName } : c);
  App.groupChats = (App.groupChats || []).map(c => c.id === groupId ? { ...c, name: newName } : c);
  if (App.currentChat?.id === groupId) App.currentChat.name = newName;
  renderChatList();
  if (App.db) {
    try {
      await App.db.collection('groups').doc(groupId).update({ name: newName });
      showToast('Group renamed', 'success');
    } catch(e) { console.warn('Rename group error:', e); showToast('Rename failed', 'error'); }
  }
}

function changeGroupAvatar() {
  const chat = App.currentChat;
  if (!chat || chat.type !== 'group') return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image', 'error'); return; }
    showToast('Uploading avatar…', 'info');
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        if (App.db) {
          await App.db.collection('groups').doc(chat.id).update({ icon: dataUrl }).catch(() => {});
        }
        App.chats = App.chats.map(c => c.id === chat.id ? { ...c, photoURL: dataUrl } : c);
        App.groupChats = (App.groupChats || []).map(c => c.id === chat.id ? { ...c, photoURL: dataUrl } : c);
        if (App.currentChat?.id === chat.id) App.currentChat.photoURL = dataUrl;
        renderChatList();
        showToast('Group avatar updated', 'success');
      };
      reader.readAsDataURL(file);
    } catch(e) { showToast('Upload failed', 'error'); }
  };
  input.click();
}

App._blockedUsers = new Set();

function blockContact(uid) {
  if (!uid || uid === 'me') return;
  showConfirm('Block this user? They will not be able to message you.', async () => {
    App._blockedUsers.add(uid);
    // Filter from chat list
    App.chats = App.chats.filter(c => c.uid !== uid);
    renderChatList();
    if (App.currentChat && App.currentChat.uid === uid) showWelcome();
    showToast('User has been blocked', 'success');
    // Firestore
    if (App.db && App.auth && App.auth.currentUser) {
      const myUid = App.auth.currentUser.uid;
      try {
        const userRef = App.db.collection('users').doc(myUid);
        const userDoc = await userRef.get();
        const blocked = (userDoc.exists && userDoc.data().blockedUsers) || [];
        if (!blocked.includes(uid)) blocked.push(uid);
        await userRef.set({ blockedUsers: blocked }, { merge: true });
      } catch(e) { console.warn('Block user Firestore error:', e); }
    }
  });
}

function unblockContact(uid) {
  if (!uid) return;
  App._blockedUsers.delete(uid);
  showToast('User unblocked', 'success');
  // Reload chats to restore blocked user
  if (typeof subscribeToChats === 'function') subscribeToChats();
  // Firestore
  if (App.db && App.auth && App.auth.currentUser) {
    const myUid = App.auth.currentUser.uid;
    App.db.collection('users').doc(myUid).get().then(doc => {
      if (doc.exists) {
        const blocked = (doc.data().blockedUsers || []).filter(u => u !== uid);
        return App.db.collection('users').doc(myUid).set({ blockedUsers: blocked }, { merge: true });
      }
    }).catch(() => {});
  }
}

function isUserBlocked(uid) {
  return App._blockedUsers && App._blockedUsers.has(uid);
}

let _blockedUsersUnsub = null;
async function loadBlockedUsers() {
  if (!App.db || !App.auth || !App.auth.currentUser) return;
  if (_blockedUsersUnsub) { _blockedUsersUnsub(); _blockedUsersUnsub = null; }
  try {
    _blockedUsersUnsub = App.db.collection('users').doc(App.auth.currentUser.uid).onSnapshot((doc) => {
      if (doc.exists && doc.data().blockedUsers) {
        App._blockedUsers = new Set(doc.data().blockedUsers);
      } else {
        App._blockedUsers = new Set();
      }
    }, () => {});
  } catch(_) {}
}
function copyInviteLink() {
  const url = 'https://neonchat.app/join/' + Math.random().toString(36).slice(2);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => showToast('Channel link copied to clipboard', 'success')).catch(() => {
      const ta = document.createElement('textarea'); ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); showToast('Channel link copied', 'success'); } catch(_) { showToast('Copy failed', 'error'); }
      document.body.removeChild(ta);
    });
  } else {
    const ta = document.createElement('textarea'); ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); showToast('Channel link copied', 'success'); } catch(_) { showToast('Copy failed', 'error'); }
    document.body.removeChild(ta);
  }
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
  const el = document.getElementById('attach-menu');
  if (!el) return;
  App.attachMenuOpen = !App.attachMenuOpen;
  if (App.attachMenuOpen) {
    el.classList.remove('hidden');
    requestAnimationFrame(() => { el.style.transform = 'scale(1)'; el.style.opacity = '1'; });
  } else {
    el.style.transform = 'scale(0.95)'; el.style.opacity = '0';
    setTimeout(() => { if (!App.attachMenuOpen) el.classList.add('hidden'); }, 200);
  }
}
function toggleEmojiPicker() {
  const el = document.getElementById('emoji-picker');
  if (!el) return;
  App.emojiPickerOpen = !App.emojiPickerOpen;
  if (App.emojiPickerOpen) {
    el.classList.remove('hidden');
    requestAnimationFrame(() => { el.style.transform = 'scale(1)'; el.style.opacity = '1'; });
    setTimeout(() => { const g = document.getElementById('emoji-grid'); if (g && !g.children.length) loadEmojiGrid(App._currentEmojiCat || 'recent'); }, 50);
  } else {
    el.style.transform = 'scale(0.95)'; el.style.opacity = '0';
    setTimeout(() => { if (!App.emojiPickerOpen) el.classList.add('hidden'); }, 200);
  }
}

function handleDocumentClick(e) {
  if (!e.target.closest('#attach-btn') && !e.target.closest('#attach-menu')) {
    if (App.attachMenuOpen) { App.attachMenuOpen = false; const el = document.getElementById('attach-menu'); if (el) { el.style.transform = 'scale(0.95)'; el.style.opacity = '0'; setTimeout(() => { if (!App.attachMenuOpen) el.classList.add('hidden'); }, 200); } }
  }
  if (!e.target.closest('button[onclick="toggleEmojiPicker()"]') && !e.target.closest('#emoji-picker')) {
    if (App.emojiPickerOpen) { App.emojiPickerOpen = false; const el = document.getElementById('emoji-picker'); if (el) { el.style.transform = 'scale(0.95)'; el.style.opacity = '0'; setTimeout(() => { if (!App.emojiPickerOpen) el.classList.add('hidden'); }, 200); } }
  }
  if (!e.target.closest('button[onclick="openGifPicker()"]') && !e.target.closest('#gif-picker')) {
    const gifPicker = document.getElementById('gif-picker');
    if (gifPicker) gifPicker.style.display = 'none';
  }
  if (!e.target.closest('#contact-picker-overlay')) {
    document.getElementById('contact-picker-overlay')?.classList.add('hidden');
  }
}

function setEl(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }
function show(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  if (el.style.display === 'none') el.style.removeProperty('display');
}
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
  const iconSpan = document.createElement('span');
  iconSpan.textContent = '💬';
  const msgSpan = document.createElement('span');
  msgSpan.textContent = msg;
  t.appendChild(iconSpan);
  t.appendChild(msgSpan);
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function showConfirm(msg, onConfirm) {
  const overlay = document.getElementById('confirm-overlay');
  const text = document.getElementById('confirm-msg');
  const btn = document.getElementById('confirm-action-btn');
  if (!overlay || !text || !btn) return;
  
  text.textContent = msg;
  btn.onclick = async () => { await onConfirm(); closeModal('confirm-overlay'); };
  show('confirm-overlay');
}

function openProfile() { updateProfileUI(); show('profile-overlay'); }
function closeModal(id) { hide(id); }
function showOverlay(id) { show(id); }
function closeOverlay(id) { hide(id); }
function closeTopModal() {
  ['profile-overlay','new-chat-overlay','confirm-overlay','group-info-overlay','msg-info-overlay','media-viewer','keyboard-help-panel','language-overlay','nsl-utilities-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'keyboard-help-panel') {
      el.classList.add('hidden');
      el.style.display = 'none';
    } else {
      hide(id);
    }
  });
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
async function shareLocation() {
  toggleAttachMenu();
  if (!navigator.geolocation) { showToast('Location not available', 'error'); return; }
  if (typeof PermissionsManager !== 'undefined') {
    const granted = await PermissionsManager.ensureForFeature('Share Location');
    if (!granted) return;
  }
  
  let picker = document.getElementById('location-pick-modal');
  if (!picker) {
    picker = document.createElement('div');
    picker.id = 'location-pick-modal';
    picker.className = 'fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/50';
    picker.onclick = (e) => { if (e.target === picker) picker.classList.add('hidden'); };
    document.body.appendChild(picker);
  }
  
  picker.innerHTML = `
    <div class="bg-surface-container rounded-t-2xl sm:rounded-2xl w-full sm:w-[min(90vw,360px)] p-5 shadow-2xl">
      <h3 class="text-base font-semibold mb-4">Share Location</h3>
      <div class="space-y-2">
        <button onclick="sendStaticLocation()" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant transition-colors text-left">
          <span class="material-symbols-outlined text-primary">location_on</span>
          <div>
            <div class="text-sm font-medium">Send current location</div>
            <div class="text-xs text-on-surface-variant">One-time location share</div>
          </div>
        </button>
        <button onclick="startLiveLocation(900000)" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant transition-colors text-left">
          <span class="material-symbols-outlined text-secondary">my_location</span>
          <div>
            <div class="text-sm font-medium">Share live location</div>
            <div class="text-xs text-on-surface-variant">Visible for 15 minutes</div>
          </div>
        </button>
        <button onclick="startLiveLocation(3600000)" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant transition-colors text-left">
          <span class="material-symbols-outlined text-secondary">my_location</span>
          <div>
            <div class="text-sm font-medium">Share live location</div>
            <div class="text-xs text-on-surface-variant">Visible for 1 hour</div>
          </div>
        </button>
        <button onclick="startLiveLocation(28800000)" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant transition-colors text-left">
          <span class="material-symbols-outlined text-secondary">my_location</span>
          <div>
            <div class="text-sm font-medium">Share live location</div>
            <div class="text-xs text-on-surface-variant">Visible for 8 hours</div>
          </div>
        </button>
      </div>
      <button onclick="document.getElementById('location-pick-modal').classList.add('hidden')" class="w-full mt-3 py-2 text-sm text-on-surface-variant hover:bg-surface-variant rounded-xl">Cancel</button>
    </div>
  `;
  picker.classList.remove('hidden');
}

function sendStaticLocation() {
  document.getElementById('location-pick-modal')?.classList.add('hidden');
  if (!navigator.geolocation) { showToast('Location not available', 'error'); return; }
  showToast('Getting location…', 'info');
  navigator.geolocation.getCurrentPosition(
    pos => _sendLocationMessage(pos.coords.latitude, pos.coords.longitude),
    () => showToast('Location access denied', 'error'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function _sendLocationMessage(lat, lng) {
  if (!App.currentChat) return;
  const chatId = App.currentChat.id;
  const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;
  if (!App.messages[chatId]) App.messages[chatId] = [];
  const msg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    from: 'me',
    type: 'location',
    lat, lng,
    mapUrl,
    time: Date.now(),
    status: 'sending'
  };
  App.messages[chatId].push(msg);
  App.currentChat.lastMsg = '📍 Location';
  App.currentChat.lastTime = msg.time;
  renderMessages(chatId); scrollToBottom(true); renderChatList();
  msg.status = 'sent';
  renderMessages(chatId);

  // Write to Firebase
  if (App.db && App.auth?.currentUser) {
    const uid = App.auth.currentUser.uid;
    const isGroup = App.currentChat.type === 'group';
    const data = {
      senderId: uid,
      senderName: App.currentUser.displayName || App.currentUser.email || 'Me',
      text: '',
      attachment: { type: 'location', lat, lng, mapUrl },
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'sent',
    };
    if (isGroup) { data.groupId = chatId; } else {
      data.directId = chatId;
      data.participants = [uid, App.currentChat.uid || ''];
      data.participantEmails = [App.currentUser.email || '', App.currentChat.about || App.currentChat.email || ''];
    }
    App.db.collection('messages').add(data).catch(console.error);
  }
  showToast('Location shared', 'success');
}

/* ─── Contact Sharing ─── */
function shareContact() {
  toggleAttachMenu();
  showContactPicker();
}

function showContactPicker() {
  const overlay = document.getElementById('contact-picker-overlay');
  if (!overlay) return;
  // Set "Share My Profile" info
  const myAvatar = document.getElementById('contact-picker-my-avatar');
  const myEmail = document.getElementById('contact-picker-my-email');
  if (myAvatar) myAvatar.textContent = (App.currentUser?.displayName || 'Me').charAt(0).toUpperCase();
  if (myEmail) myEmail.textContent = App.currentUser?.email || 'Your email';
  // Clear search
  const search = document.getElementById('contact-search');
  if (search) search.value = '';
  _renderContactPickerList('');
  show('contact-picker-overlay');
}

function _renderContactPickerList(query) {
  const list = document.getElementById('contact-picker-list');
  if (!list) return;
  let contacts = App.contacts.filter(c => c.uid !== App.auth?.currentUser?.uid);
  if (query) {
    const q = query.toLowerCase();
    contacts = contacts.filter(c => (c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q) || (c.phone||'').includes(q));
  }
  list.innerHTML = contacts.map(c => {
    const existingChat = App.chats.find(ch => ch.uid === c.uid);
    const hasChat = !!existingChat;
    return `
    <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/40 transition-all cursor-pointer" onclick="selectContactToShare('${c.uid}')">
      ${c.photoURL
        ? `<img src="${escHtml(c.photoURL)}" class="w-10 h-10 rounded-full object-cover" loading="lazy">`
        : `<div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${c.avatar || 'bg-surface-container-highest text-on-surface-variant'}">${escHtml(c.initials || c.name.charAt(0).toUpperCase())}</div>`
      }
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold truncate">${escHtml(c.name)}</span>
          ${hasChat ? '<span class="text-[9px] px-1.5 py-0.5 bg-primary/15 text-primary rounded-full font-bold">In chats</span>' : ''}
        </div>
        <div class="text-[10px] text-on-surface-variant truncate">${escHtml(c.email || '')}${c.phone ? ' · ' + escHtml(c.phone) : ''}</div>
      </div>
      <span class="material-symbols-outlined text-on-surface-variant text-sm">chevron_right</span>
    </div>`;
  }).join('') || '<div class="text-center text-xs text-on-surface-variant py-4">No contacts found</div>';
}

function filterContactPicker(query) {
  _renderContactPickerList(query);
}

function shareMyProfile() {
  if (!App.currentChat) return;
  const name = App.currentUser?.displayName || App.currentUser?.email || 'Me';
  const email = App.currentUser?.email || '';
  const phone = App.currentUser?.phoneNumber || '';
  const avatar = App.currentUser?.photoURL || '';
  hide('contact-picker-overlay');
  _sendContactMessage(name, email, phone, avatar);
}

function selectContactToShare(uid) {
  const contact = App.contacts.find(c => c.uid === uid);
  if (!contact) return;
  hide('contact-picker-overlay');
  _sendContactMessage(contact.name, contact.email || '', contact.phone || '', contact.photoURL || '');
}

function _sendContactMessage(contactName, contactEmail, contactPhone, contactAvatar) {
  if (!App.currentChat || !contactName) return;
  const chatId = App.currentChat.id;
  if (!App.messages[chatId]) App.messages[chatId] = [];
  const msg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    from: 'me',
    type: 'contact',
    contactName,
    contactEmail: contactEmail || '',
    contactPhone: contactPhone || '',
    contactAvatar: contactAvatar || '',
    time: Date.now(),
    status: 'sent'
  };
  App.messages[chatId].push(msg);
  App.currentChat.lastMsg = '👤 Contact: ' + contactName;
  App.currentChat.lastTime = msg.time;
  renderMessages(chatId); scrollToBottom(true); renderChatList();

  if (App.db && App.auth?.currentUser) {
    const uid = App.auth.currentUser.uid;
    const isGroup = App.currentChat.type === 'group';
    const data = {
      senderId: uid,
      senderName: App.currentUser.displayName || App.currentUser.email || 'Me',
      text: '',
      attachment: { type: 'contact', contactName, contactEmail: contactEmail || '', contactPhone: contactPhone || '', contactAvatar: contactAvatar || '' },
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'sent',
    };
    if (isGroup) { data.groupId = chatId; } else {
      data.directId = chatId;
      data.participants = [uid, App.currentChat.uid || ''];
      data.participantEmails = [App.currentUser.email || '', App.currentChat.about || App.currentChat.email || ''];
    }
    App.db.collection('messages').add(data).catch(console.error);
  }
  showToast('Contact shared', 'success');
}

function sendRequestFromContact(email, name) {
  const contact = App.contacts.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
  if (contact) {
    sendChatRequest(contact.uid, contact.email, contact.name);
  } else {
    showToast('User not found — share your email to connect', 'info');
  }
}

/* ─── Live Location Sharing ─── */
let _liveLocationWatchId = null;
let _liveLocationDocId = null;
let _liveLocationExpiryTimer = null;

function startLiveLocation(durationMs) {
  document.getElementById('location-pick-modal')?.classList.add('hidden');
  if (!App.db || !App.auth?.currentUser || !App.currentChat) return;
  if (!navigator.geolocation) { showToast('Location not available', 'error'); return; }
  
  if (_liveLocationDocId) {
    showToast('Already sharing live location', 'info');
    return;
  }
  
  const uid = App.auth.currentUser.uid;
  const chatId = App.currentChat.id;
  const isGroup = App.currentChat.type === 'group';
  
  showToast('Starting live location sharing…', 'info');
  
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lng } = pos.coords;
    
    const messageData = {
      senderId: uid,
      senderName: App.currentUser.displayName || 'Me',
      text: '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'sent',
      read: true,
      attachment: { type: 'location', lat, lng, mapUrl: `https://maps.google.com/?q=${lat},${lng}` },
      liveLocation: {
        active: true,
        startedAt: Date.now(),
        expiresAt: Date.now() + durationMs,
        duration: durationMs
      }
    };
    
    if (isGroup) {
      messageData.groupId = chatId;
    } else {
      messageData.directId = chatId;
      messageData.participants = [uid, App.currentChat.uid];
    }
    
    const docRef = await App.db.collection('messages').add(messageData).catch(() => null);
    if (!docRef) return;
    
    _liveLocationDocId = docRef.id;
    
    _liveLocationWatchId = navigator.geolocation.watchPosition(
      async (update) => {
        if (!_liveLocationDocId) return;
        const { latitude, longitude } = update.coords;
        await App.db.collection('messages').doc(_liveLocationDocId).update({
          'attachment.lat': latitude,
          'attachment.lng': longitude,
          'attachment.mapUrl': `https://maps.google.com/?q=${latitude},${longitude}`
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
    
    _liveLocationExpiryTimer = setTimeout(() => stopLiveLocation(), durationMs);
    
    showToast(`Live location active for ${formatLiveDuration(durationMs)}`, 'success');
    
    const coll = isGroup ? 'groups' : 'directChats';
    App.db.collection(coll).doc(chatId).set({
      lastMessage: '📍 Live Location',
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessageSenderId: uid
    }, { merge: true }).catch(() => {});
    
  }, () => showToast('Location access denied', 'error'), { enableHighAccuracy: true, timeout: 10000 });
}

function stopLiveLocation() {
  if (_liveLocationWatchId !== null) {
    navigator.geolocation.clearWatch(_liveLocationWatchId);
    _liveLocationWatchId = null;
  }
  if (_liveLocationExpiryTimer) {
    clearTimeout(_liveLocationExpiryTimer);
    _liveLocationExpiryTimer = null;
  }
  if (_liveLocationDocId && App.db) {
    App.db.collection('messages').doc(_liveLocationDocId).update({
      'liveLocation.active': false
    }).catch(() => {});
    _liveLocationDocId = null;
  }
}

function formatLiveDuration(ms) {
  if (ms >= 3600000) return Math.round(ms / 3600000) + ' hour' + (ms > 3600000 ? 's' : '');
  return Math.round(ms / 60000) + ' minutes';
}

/* ══════════════════════════════════════════════════
   24. EMOJI LOADINGS
   ══════════════════════════════════════════════════ */
const EMOJI_NAMES = {
  '😀':'grinning face','😃':'grinning face with big eyes','😄':'grinning face with smiling eyes','😁':'beaming face','😆':'grinning squinting face','😅':'grinning face with sweat','🤣':'rolling on the floor laughing','😂':'face with tears of joy','🙂':'slightly smiling face','🙃':'upside-down face','😉':'winking face','😊':'smiling face with smiling eyes','😇':'smiling face with halo','🥰':'smiling face with hearts','😍':'heart eyes','🤩':'star struck','😘':'face blowing a kiss','😗':'kissing face','😚':'kissing closed eyes','😙':'kissing smiling eyes','🥲':'smiling face with tear','😋':'face savoring food','😛':'face with tongue','😜':'winking face with tongue','🤪':'zany face','😝':'squinting face with tongue','🤑':'money mouth face','🤗':'hugging face','🤭':'face with hand over mouth','🤫':'shushing face','🤔':'thinking face','🫡':'saluting face','🤐':'zipper mouth face','🤨':'face with raised eyebrow','😐':'neutral face','😑':'expressionless face','😶':'face without mouth','🫥':'dotted line face','😏':'smirking face','😒':'unamused face','🙄':'face with rolling eyes','😬':'grimacing face','🤥':'lying face','😌':'relieved face','😔':'pensive face','😪':'sleepy face','🤤':'drooling face','😴':'sleeping face','😷':'face with medical mask','🤒':'face with thermometer','🤕':'face with head bandage','🤢':'nauseated face','🤮':'face vomiting','🥵':'hot face','🥶':'cold face','🥴':'woozy face','😵':'face with crossed-out eyes','🤯':'exploding head','🤠':'cowboy hat face','🥳':'partying face','🥸':'disguised face','😎':'smiling face with sunglasses','🤓':'nerd face','🧐':'face with monocle','😕':'confused face','🫤':'face with diagonal mouth','😟':'worried face','🙁':'slightly frowning face','😮':'face with open mouth','😯':'hushed face','😲':'astonished face','😳':'flushed face','🥺':'pleading face','🥹':'face holding back tears','😦':'frowning face with open mouth','😧':'anguished face','😨':'fearful face','😰':'anxious face with sweat','😥':'sad but relieved face','😢':'crying face','😭':'loudly crying face','😱':'face screaming in fear','😖':'confounded face','😣':'persevering face','😞':'disappointed face','😓':'downcast face with sweat','😩':'weary face','😫':'tired face','🥱':'yawning face','😤':'face with steam from nose','😡':'enraged face','😠':'angry face','🤬':'face with symbols on mouth','😈':'smiling face with horns','👿':'angry face with horns','💀':'skull','☠️':'skull and crossbones','💩':'pile of poo','🤡':'clown face','👹':'ogre','👺':'goblin','👻':'ghost','👽':'alien','👾':'alien monster','🤖':'robot','😺':'grinning cat','😸':'grinning cat with smiling eyes','😹':'cat with tears of joy','😻':'smiling cat with heart eyes','😼':'cat with wry smile','😽':'kissing cat','🙀':'weary cat','😿':'crying cat','😾':'pouting cat',
  '👋':'waving hand','🤚':'raised back of hand','🖐️':'hand with fingers splayed','✋':'raised hand','🖖':'vulcan salute','👌':'ok hand','🤌':'pinched fingers','🤏':'pinching hand','✌️':'victory hand','🤞':'crossed fingers','🤟':'love you gesture','🤘':'sign of the horns','🤙':'call me hand','👈':'backhand index pointing left','👉':'backhand index pointing right','👆':'backhand index pointing up','🖕':'middle finger','👇':'backhand index pointing down','☝️':'index pointing up','👍':'thumbs up','👎':'thumbs down','✊':'raised fist','👊':'oncoming fist','🤛':'left facing fist','🤜':'right facing fist','👏':'clapping hands','🙌':'raising hands','👐':'open hands','🤲':'palms up together','🤝':'handshake','🙏':'folded hands','✍️':'writing hand','💅':'nail polish','🤳':'selfie','💪':'flexed biceps',
  '🐶':'dog face','🐱':'cat face','🐭':'mouse face','🐹':'hamster','🐰':'rabbit face','🦊':'fox','🐻':'bear','🐼':'panda','🐨':'koala','🐯':'tiger face','🦁':'lion','🐮':'cow face','🐷':'pig face','🐸':'frog','🐵':'monkey face','🙈':'see no evil monkey','🙉':'hear no evil monkey','🙊':'speak no evil monkey','🐒':'monkey','🐔':'chicken','🐧':'penguin','🐦':'bird','🐤':'baby chick','🐣':'hatching chick','🐥':'front facing baby chick','🦆':'duck','🦅':'eagle','owl':'owl','🦇':'bat','🐺':'wolf','🐗':'boar','🐴':'horse face','🦄':'unicorn','🐝':'honeybee','🐛':'bug','🦋':'butterfly','🐌':'snail','🐞':'lady beetle','🐜':'ant','🐢':'turtle','🐍':'snake','🦎':'lizard','🐙':'octopus','🦑':'squid','🦐':'shrimp','🦞':'lobster','🦀':'crab','🐡':'blowfish','🐠':'tropical fish','🐟':'fish','🐬':'dolphin','🐳':'whale face','🐋':'whale','🦈':'shark','🐊':'crocodile','🐅':'tiger','🐆':'leopard','🦓':'zebra','🦍':'gorilla','🐘':'elephant','🦛':'hippopotamus','🐪':'camel','🐫':'two hump camel','🦒':'giraffe','🐃':'water buffalo','cow':'cow','horse':'horse','pig':'pig','sheep':'sheep','goat':'goat','dog':'dog','cat':'cat','mouse':'mouse','rabbit':'rabbit','hamster':'hamster',
  '🍇':'grapes','🍈':'melon','🍉':'watermelon','🍊':'tangerine','lemon':'lemon','🍌':'banana','🍍':'pineapple','🥭':'mango','🍎':'red apple','🍏':'green apple','🍐':'pear','🍑':'peach','🍒':'cherries','🍓':'strawberry','🫐':'blueberries','🥝':'kiwi fruit','🍅':'tomato','🥑':'avocado','🍆':'eggplant','🥔':'potato','🥕':'carrot','🌽':'ear of corn','🌶️':'hot pepper','🥒':'cucumber','🥬':'leafy green','🥦':'broccoli','🧄':'garlic','🧅':'onion','🍄':'mushroom','🥜':'peanuts','🌰':'chestnut','🍞':'bread','🥐':'croissant','🥖':'baguette bread','🥨':'pretzel','🥯':'bagel','🥞':'pancakes','🧇':'waffle','🧀':'cheese wedge','🍖':'meat on bone','🍗':'poultry leg','🥩':'cut of meat','🥓':'bacon','🍔':'hamburger','🍟':'french fries','🍕':'pizza','🌭':'hot dog','🥪':'sandwich','🌮':'taco','🌯':'burrito','🧆':'falafel','🥚':'egg','🍳':'cooking','🥘':'shallow pan of food','🍲':'pot of food','🥣':'bowl with spoon','🥗':'green salad','🍿':'popcorn','🧈':'butter','🧂':'salt','🥫':'canned food','🍱':'bento box','🍘':'rice cracker','🍙':'rice ball','🍚':'cooked rice','🍛':'curry rice','🍜':'steaming bowl','🍝':'spaghetti','🍠':'roasted sweet potato','🍢':'oden','🍣':'sushi','🍤':'fried shrimp','🍥':'fish cake with swirl','🥮':'moon cake','🍡':'dango','🥟':'dumpling','🥠':'fortune cookie','🥡':'takeout box','🦀':'crab','🦞':'lobster','🦐':'shrimp','🦑':'squid','🍦':'soft ice cream','🍧':'shaved ice','🍨':'ice cream','🍩':'doughnut','🍪':'cookie','🎂':'birthday cake','🍰':'shortcake','🧁':'cupcake','🥧':'pie','🍫':'chocolate bar','🍬':'candy','🍭':'lollipop','🍮':'custard','🍯':'honey pot','🍼':'baby bottle','🥛':'glass of milk','☕':'hot beverage','🍵':'teacup without handle','🍶':'sake','🍾':'bottle with popping cork','wine':'wine glass','🍸':'cocktail glass','🍹':'tropical drink','🍺':'beer mug','🍻':'clinking beer mugs','🥂':'clinking glasses','🥃':'tumbler glass','🥤':'cup with straw',
  '⚽':'soccer ball','🏀':'basketball','🏈':'american football','⚾':'baseball','🎾':'tennis','🏐':'volleyball','🏉':'rugby football','🎱':'pool 8 ball','🏒':'ice hockey','🏑':'field hockey','🏏':'cricket game','🥅':'goal net','⛳':'flag in hole','🏹':'bow and arrow','🎣':'fishing pole','🤿':'diving mask','🥊':'boxing glove','🥋':'martial arts uniform','🛹':'skateboard','🛼':'roller skate','🛷':'sled','⛸️':'ice skate','🎿':'skis','🎯':'bullseye','🪀':'yo yo','🪁':'kite','🎱':'pool 8 ball','🔮':'crystal ball','🎮':'video game','🕹️':'joystick','🎰':'slot machine','🎲':'game die','🧩':'puzzle piece','🧸':'teddy bear','🎪':'circus tent','🎭':'performing arts','🎬':'clapper board','🎤':'microphone','🎧':'headphone','🎼':'musical score','🎹':'musical keyboard','🥁':'drum','🎷':'saxophone','🎺':'trumpet','🎸':'guitar','🎻':'violin',
  '🚗':'automobile','🚕':'taxi','🚙':'sport utility vehicle','🚌':'bus','🏎️':'racing car','🚓':'police car','🚑':'ambulance','🚒':'fire engine','🚐':'minibus','🚚':'delivery truck','🚛':'articulated lorry','🚜':'tractor','🏍️':'motorcycle','🛵':'motor scooter','🚲':'bicycle','🛴':'kick scooter','🛺':'auto rickshaw','✈️':'airplane','🛫':'airplane departure','🛬':'airplane arrival','🛩️':'small airplane','💺':'seat','🛰️':'satellite','🚀':'rocket','🛸':'flying saucer','🚁':'helicopter','🛶':'canoe','⛵':'sailboat','🚤':'speedboat','🛥️':'motor boat','🛳️':'passenger ship','⛴️':'ferry','🚢':'ship','⚓':'anchor','⛽':'fuel pump','🚧':'construction','🚦':'vertical traffic light','🚥':'horizontal traffic light','🗺️':'world map','🗿':'moai','🗽':'statue of liberty','🗼':'tokyo tower','🏰':'castle','🏯':'japanese castle','🏟️':'stadium','🎡':'ferris wheel','🎢':'roller coaster','🎠':'carousel horse','⛲':'fountain','⛱️':'umbrella on ground','🏖️':'beach with umbrella','🏝️':'desert island','🏜️':'desert','🌋':'volcano','⛰️':'mountain','🏔️':'snow capped mountain','🗻':'mount fuji','🏕️':'camping','⛺':'tent','🛖':'hut','🏠':'house','🏡':'house with garden','🏘️':'houses','🏚️':'derelict house','🏗️':'building construction','🏭':'factory','🏢':'office building','🏬':'department store','🏣':'japanese post office','🏤':'post office','🏥':'hospital','🏦':'bank','🏨':'hotel','🏪':'convenience store','🏫':'school','💒':'wedding','🏛️':'classical building','⛪':'church','🕌':'mosque','🕍':'synagogue','⛩️':'shinto shrine',
  '⌚':'watch','📱':'mobile phone','📲':'mobile phone with arrow','💻':'laptop','⌨️':'keyboard','🖥️':'desktop computer','🖨️':'printer','🖱️':'computer mouse','💡':'light bulb','🔦':'flashlight','🕯️':'candle','🧯':'fire extinguisher','💰':'money bag','💳':'credit card','📊':'bar chart','📈':'chart increasing','📉':'chart decreasing','📋':'clipboard','📁':'file folder','📂':'open file folder','🗑️':'wastebasket','🔒':'locked','🔓':'unlocked','🔑':'key','🗝️':'old key','✉️':'envelope','📩':'envelope with arrow','📨':'incoming envelope','📧':'e-mail','💌':'love letter','📦':'package','🏷️':'label','📜':'scroll','📄':'page facing up','📑':'bookmark tabs','📊':'bar chart','📅':'calendar','📆':'tear off calendar','📇':'card index','🗃️':'card file box','🗄️':'file cabinet','📝':'memo','✏️':'pencil','🖊️':'pen','🖋️':'fountain pen','✒️':'black nib','🖌️':'paintbrush','🖍️':'crayon','🔍':'magnifying glass tilted left','🔎':'magnifying glass tilted right',
  '❤️':'red heart','🧡':'orange heart','💛':'yellow heart','💚':'green heart','💙':'blue heart','💜':'purple heart','🖤':'black heart','🤍':'white heart','🤎':'brown heart','💔':'broken heart','❤️‍🔥':'heart on fire','❣️':'heart exclamation','💕':'two hearts','💞':'revolving hearts','💓':'beating heart','💗':'growing heart','💖':'sparkling heart','💘':'heart with arrow','💝':'heart with ribbon','💟':'heart decoration','☮️':'peace symbol','✝️':'latin cross','☪️':'star and crescent','🕉️':'om','☸️':'wheel of dharma','✡️':'star of david','🔯':'six pointed star','☯️':'yin yang','✝️':'latin cross','🛐':'worship symbol','⛎':'ophiuchus','♈':'aries','♉':'taurus','♊':'gemini','♋':'cancer','♌':'leo','♍':'virgo','♎':'libra','♏':'scorpio','♐':'sagittarius','♑':'capricorn','♒':'aquarius','♓':'pisces','🆔':'id button','⚛️':'atom symbol','🉑':'acceptable','☢️':'radioactive','☣️':'biohazard','📴':'mobile phone off','📳':'vibration mode','🈶':'Japanese "not free of charge" button','🈚':'Japanese "free of charge" button','🈸':'Japanese "application" button','🈺':'Japanese "reserved" button','🈷️':'Japanese "monthly amount" button','✴️':'eight pointed star','🆚':'VS button','💮':'white flower','🉐':'Japanese "bargain" button','㊙️':'Japanese "secret" button','㊗️':'Japanese "congratulations" button','🈴':'Japanese "passing grade" button','🈵':'Japanese "no vacancy" button','🈹':'Japanese "discount" button','🈲':'Japanese "prohibited" button','🅰️':'A button (blood type)','🅱️':'B button (blood type)','🆎':'AB button (blood type)','🆑':'CL button','🅾️':'O button (blood type)','🆘':'SOS button','❌':'cross mark','⭕':'hollow red circle','🛑':'stop sign','⛔':'no entry','📛':'name badge','🚫':'prohibited','💯':'hundred points','💢':'anger symbol','🚷':'no pedestrians','🚯':'no littering','🚳':'no bicycles','🚱':'non-potable water','🔞':'no one under eighteen','📵':'no mobile phones','🚭':'no smoking','❗':'red exclamation mark','❕':'white exclamation mark','❓':'red question mark','❔':'white question mark','‼️':'double exclamation mark','⁉️':'exclamation question mark','🔅':'dim button','🔆':'bright button','〽️':'part alternation mark','⚠️':'warning','🔱':'trident emblem','⚜️':'fleur de lis','🔰':'Japanese symbol for beginner','♻️':'recycling symbol','✅':'check mark button','🈯':'Japanese "reserved" button','💹':'chart increasing with yen','❎':'cross mark button','🌐':'globe with meridians','💠':'diamond with a dot','Ⓜ️':'circled M','🌀':'cyclone','💤':'zzz','🏧':'ATM sign','🚾':'water closet','♿':'wheelchair symbol','🅿️':'P button','🛗':'elevator','🔺':'red triangle pointed up','🔻':'red triangle pointed down','🔶':'large orange diamond','🔷':'large blue diamond','🔳':'white square button','🔲':'black square button','▪️':'black small square','▫️':'white small square','◾':'black medium small square','◽':'white medium small square','◼️':'black medium square','◻️':'white medium square','🟥':'red square','🟧':'orange square','🟨':'yellow square','🟩':'green square','🟦':'blue square','🟪':'purple square','⬛':'black large square','⬜':'white large square','🟫':'brown square','🔴':'red circle','🟠':'orange circle','🟡':'yellow circle','🟢':'green circle','🔵':'blue circle','🟣':'purple circle','⚫':'black circle','⚪':'white circle','🟤':'brown circle',
  '🏁':'chequered flag','🚩':'triangular flag','🎌':'crossed flags','🏴':'black flag','🏳️':'white flag','🏳️‍🌈':'rainbow flag','🏳️‍⚧️':'transgender flag','🏴‍☠️':'pirate flag',
};
function loadEmojiGrid(cat) {
  const grid = document.getElementById('emoji-grid');
  if (!grid) return;
  const list = App.emojiCategories[cat] || [];
  grid.textContent = '';
  const frag = document.createDocumentFragment();
    list.forEach(em => {
      const span = document.createElement('span');
      span.className = 'cursor-pointer transition-transform p-0.5 rounded';
      span.dataset.emoji = em;
      span.dataset.name = escHtml(EMOJI_NAMES[em] || '');
      span.textContent = em;
    span.addEventListener('click', () => insertEmoji(em));
    span.addEventListener('mouseenter', () => previewEmoji(em, EMOJI_NAMES[em] || ''));
    span.addEventListener('mouseleave', clearEmojiPreview);
    span.addEventListener('touchstart', () => previewEmoji(em, EMOJI_NAMES[em] || ''));
    span.addEventListener('touchend', clearEmojiPreview);
    frag.appendChild(span);
  });
  grid.appendChild(frag);
  grid.parentElement.scrollTop = 0;
}
function setEmojiCat(btn, cat) {
  qsa('.emoji-cat-btn').forEach(b=>b.classList.remove('active','bg-primary/10'));
  btn.classList.add('active','bg-primary/10');
  const search = document.getElementById('emoji-search');
  if (search) search.value = '';
  loadEmojiGrid(cat);
  App._currentEmojiCat = cat;
}
let _emojiSearchTimer = null;
function searchEmoji(query) {
  const grid = document.getElementById('emoji-grid');
  if (!grid) return;
  if (!query.trim()) { loadEmojiGrid(App._currentEmojiCat || 'recent'); return; }
  clearTimeout(_emojiSearchTimer);
  _emojiSearchTimer = setTimeout(() => {
    const q = query.toLowerCase();
    const results = [];
    for (const [cat, emojis] of Object.entries(App.emojiCategories)) {
      if (cat === 'recent') continue;
      for (const em of emojis) {
        const name = (EMOJI_NAMES[em] || '').toLowerCase();
        if (name.includes(q) || em === q) results.push({ em, name });
      }
    }
    grid.textContent = '';
    if (results.length) {
      const frag = document.createDocumentFragment();
      results.forEach(r => {
        const span = document.createElement('span');
        span.className = 'cursor-pointer transition-transform p-0.5 rounded';
        span.dataset.emoji = r.em;
        span.dataset.name = escHtml(r.name);
        span.textContent = r.em;
        span.addEventListener('click', () => insertEmoji(r.em));
        span.addEventListener('mouseenter', () => previewEmoji(r.em, r.name));
        span.addEventListener('mouseleave', clearEmojiPreview);
        span.addEventListener('touchstart', () => previewEmoji(r.em, r.name));
        span.addEventListener('touchend', clearEmojiPreview);
        frag.appendChild(span);
      });
      grid.appendChild(frag);
    } else {
      const div = document.createElement('div');
      div.className = 'col-span-8 text-center text-xs text-on-surface-variant py-4';
      div.textContent = 'No emojis found';
      grid.appendChild(div);
    }
  }, 150);
}
function previewEmoji(em, name) {
  const icon = document.getElementById('emoji-preview-icon');
  const label = document.getElementById('emoji-preview-name');
  if (icon) icon.textContent = em;
  if (label) label.textContent = name || '';
}
function clearEmojiPreview() {
  const icon = document.getElementById('emoji-preview-icon');
  const label = document.getElementById('emoji-preview-name');
  if (icon) icon.textContent = '';
  if (label) label.textContent = '';
}
function insertEmoji(em) {
  const input = document.getElementById('msg-input');
  if (input) { input.value += em; input.focus(); toggleSendMic(); }
  // Track recent
  try {
    const key = 'nsl_emoji_recent';
    let recent = JSON.parse(localStorage.getItem(key) || '[]');
    recent = recent.filter(e => e !== em);
    recent.unshift(em);
    if (recent.length > 30) recent = recent.slice(0, 30);
    localStorage.setItem(key, JSON.stringify(recent));
    App.emojiCategories.recent = recent;
  } catch(_) {}
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
  if (typeof Presence !== 'undefined' && Presence.setOnline && Presence.setOffline) {
    if (status === 'online') Presence.setOnline(); else Presence.setOffline();
    updateSidebarPresence();
    return;
  }
  App.db.collection('users').doc(App.auth.currentUser.uid).set({ onlineStatus: status }, { merge: true }).catch(() => {});
}

function setupOnlineStatus() {
  window.addEventListener('online',  () => hide('offline-banner'));
  window.addEventListener('offline', () => show('offline-banner'));
  if (!navigator.onLine) show('offline-banner');
  window.addEventListener('beforeunload', () => {
    if (typeof stopLiveLocation === 'function') stopLiveLocation();
    if (typeof _moduleCleanupAll === 'function') _moduleCleanupAll();
    updatePresence('offline');
  });
  document.addEventListener('visibilitychange', () => {
    clearTimeout(App._presenceDebounce);
    App._presenceDebounce = setTimeout(() => {
      if (App.callActive) return;
      if (!document.hidden) updatePresence('online');
    }, 300);
  });
}

/* ─── PUSH NOTIFICATIONS (FCM) ───────────────────────────────── */
function setupPushNotifications() {
  if (!App.db || !App.auth?.currentUser || !window.firebase?.messaging) return;
  const uid = App.auth.currentUser.uid;
  const registerFcmToken = async () => {
    try {
      const messaging = firebase.messaging();
      if (!('serviceWorker' in navigator)) return;
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
    const isDesktop = window.innerWidth >= 768;
    banner.style.cssText = isDesktop
      ? 'position:fixed;bottom:24px;right:24px;width:360px;background:var(--surface-container);color:var(--on-surface);border-radius:12px;padding:16px;z-index:99990;box-shadow:0 6px 24px rgba(0,0,0,0.4);display:flex;flex-direction:column;gap:12px;font-family:inherit;'
      : 'position:fixed;bottom:calc(70px + env(safe-area-inset-bottom, 0px));left:50%;transform:translateX(-50%);width:min(90vw,360px);background:var(--surface-container);color:var(--on-surface);border-radius:12px;padding:14px 16px;z-index:99990;box-shadow:0 6px 24px rgba(0,0,0,0.4);display:flex;flex-direction:column;gap:10px;font-family:inherit;';
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

function requestNativeNotificationPermission() {
  const Push = window.Capacitor?.Plugins?.PushNotifications;
  if (!Push) return;
  Push.requestPermissions().then(result => {
    if (result.display === 'granted' || result.display === 'prompt') {
      Push.register().catch(() => {});
    }
  }).catch(() => {});
}

function getMillis(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string') return Date.parse(val) || 0;
  if (val.seconds) return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
  return 0;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0,2).toUpperCase();
  if (parts.length === 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  // 3+ parts: take first letter of first, middle(s), and last
  return (parts[0][0] + parts.slice(1, -1).map(p => p[0]).join('') + parts[parts.length-1][0]).toUpperCase();
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

/** @param {string} toUid - Recipient user ID @param {string} toEmail - Recipient email @param {string} toName - Recipient display name */
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
      status: 'pending',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`Chat request sent to ${toName}`, 'success');
  } catch(e) { showToast('Failed to send request', 'error'); console.warn(e); }
}

/** @param {string} requestId - Firestore chat request document ID @param {object} [reqData] - Optional pre-fetched request data */
async function acceptChatRequest(requestId, reqData) {
  if (!App.db || !App.auth?.currentUser) return;
  let req = reqData || (App.chatRequests.incoming || []).find(r => r.id === requestId);
  if (!req || !req.fromUid) {
    try {
      const doc = await App.db.collection('chatRequests').doc(requestId).get();
      if (!doc.exists) { showToast('Request not found', 'error'); return; }
      const d = doc.data();
      req = { id: doc.id, fromUid: d.fromUserId || d.from, fromEmail: d.fromEmail, fromName: d.fromUserName || d.fromName };
    } catch(e) { showToast('Failed to load request', 'error'); return; }
  }
  if (!req || !req.fromUid) { showToast('Request not found', 'error'); return; }
  const uid = App.auth.currentUser.uid;
  const myEmail = App.currentUser.email || '';
  const chatId = getDirectChatId(uid, req.fromUid);
  try {
    await App.db.collection('directChats').doc(chatId).set({
      participants: [uid, req.fromUid],
      participantNames: { [uid]: App.currentUser.displayName || myEmail, [req.fromUid]: req.fromName },
      participantEmails: { [uid]: myEmail, [req.fromUid]: req.fromEmail },
      participantEmailList: [myEmail, req.fromEmail],
      name: req.fromName,
      status: 'active'
    }, { merge: true });
    await App.db.collection('chatRequests').doc(requestId).update({
      status: 'accepted',
      toUserName: App.currentUser.displayName || myEmail,
      acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`Chat request from ${req.fromName} accepted`, 'success');
    if (App.chatsUnsubscribe) { App.chatsUnsubscribe(); App.chatsUnsubscribe = null; }
    subscribeToChats();
    openChat(chatId, 'direct');
  } catch(e) { showToast('Failed to accept request', 'error'); console.warn(e); }
}

/** @param {string} requestId - Firestore chat request document ID */
async function declineChatRequest(requestId) {
  if (!App.db) return;
  try {
    await App.db.collection('chatRequests').doc(requestId).update({ status: 'declined' });
    showToast('Chat request declined', 'info');
  } catch(e) { console.warn(e); }
}

/** @param {string} requestId - Firestore chat request document ID */
async function cancelChatRequest(requestId) {
  if (!App.db || !App.auth?.currentUser) return;
  try {
    await App.db.collection('chatRequests').doc(requestId).update({ status: 'cancelled' });
    showToast('Chat request cancelled', 'info');
  } catch(e) { console.warn(e); }
}

/** @param {string} userId - UID of the user to block @description Blocks the user and declines all their pending chat requests */
async function blockRequestSender(userId) {
  if (!App.db || !App.auth?.currentUser) return;
  const uid = App.auth.currentUser.uid;
  try {
    const userRef = App.db.collection('users').doc(uid);
    await userRef.update({ blockedUsers: firebase.firestore.FieldValue.arrayUnion(userId) });
    const q = await App.db.collection('chatRequests')
      .where('fromUserId', '==', userId).where('toUserId', '==', uid).where('status', '==', 'pending').get();
    const batch = App.db.batch();
    q.forEach(doc => batch.update(doc.ref, { status: 'blocked' }));
    await batch.commit();
    showToast('User blocked', 'info');
  } catch(e) { console.warn(e); }
}

/** @param {string} inviteId - Firestore group invite document ID @description Adds current user to the group and marks invite accepted */
async function acceptGroupInvite(inviteId) {
  if (!App.db || !App.auth?.currentUser) return;
  const uid = App.auth.currentUser.uid;
  try {
    const doc = await App.db.collection('groupInvites').doc(inviteId).get();
    if (!doc.exists) { showToast('Invite not found', 'error'); return; }
    const data = doc.data();
    const chatId = data.groupId || data.chatId;
    if (!chatId) { showToast('Invalid invite', 'error'); return; }
    await App.db.collection('groups').doc(chatId).update({
      members: firebase.firestore.FieldValue.arrayUnion(uid)
    });
    await App.db.collection('groupInvites').doc(inviteId).update({ status: 'accepted' });
    showToast('Joined the group', 'success');
    if (App.chatsUnsubscribe) { App.chatsUnsubscribe(); App.chatsUnsubscribe = null; }
    subscribeToChats();
  } catch(e) { showToast('Failed to accept invite', 'error'); console.warn(e); }
}

/** @param {string} inviteId - Firestore group invite document ID */
async function declineGroupInvite(inviteId) {
  if (!App.db) return;
  try {
    await App.db.collection('groupInvites').doc(inviteId).update({ status: 'declined' });
    showToast('Group invite declined', 'info');
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
  showToast(select.value === 'silent' ? 'Notifications silenced for this chat' : select.value ? 'Notification sound set' : 'Default sound restored', 'success');
}

/* ─── Global + per-chat mute ─── */
function toggleGlobalMute() {
  App._isMutedGlobal = !App._isMutedGlobal;
  try { localStorage.setItem('nsl_muted_global', App._isMutedGlobal ? '1' : '0'); } catch(_) {}
  _updateGlobalMuteUI();
}
function _updateGlobalMuteUI() {
  const icon = document.getElementById('global-mute-icon');
  const label = document.getElementById('global-mute-label');
  const toggle = document.getElementById('global-mute-toggle');
  const knob = document.getElementById('global-mute-knob');
  if (icon) icon.textContent = App._isMutedGlobal ? 'notifications_off' : 'notifications_active';
  if (label) label.textContent = App._isMutedGlobal ? 'All sounds muted' : 'All sounds on';
  if (toggle) toggle.style.background = App._isMutedGlobal ? 'var(--outline-variant)' : 'var(--primary)';
  if (knob) knob.style.transform = App._isMutedGlobal ? 'translateX(0px)' : 'translateX(20px)';
}
function toggleMuteChat() {
  const chatId = App.currentChat?.id;
  if (!chatId) return;
  if (!App._mutedChats) App._mutedChats = new Set();
  const wasMuted = App._mutedChats.has(chatId);
  if (wasMuted) {
    App._mutedChats.delete(chatId);
    showToast('Chat unmuted', 'success');
  } else {
    App._mutedChats.add(chatId);
    showToast('Chat muted — no notification sounds', 'info');
  }
  _saveMuteState();
  _renderMuteBadge(chatId);
  // Also write to Firestore for cross-device sync
  if (App.db && App.auth?.currentUser) {
    const uid = App.auth.currentUser.uid;
    const chat = App.chats.find(c => c.id === chatId);
    const col = chat?.type === 'group' ? 'groups' : 'directChats';
    App.db.collection(col).doc(chatId).set({ [`muted.${uid}`]: !wasMuted }, { merge: true }).catch(() => {});
  }
}

function showMuteChatOptions(chatId) {
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) return;
  const isMuted = App._mutedChats?.has(chatId);

  // Remove any existing mute picker
  const existing = document.getElementById('mute-duration-picker');
  if (existing) existing.remove();

  const picker = document.createElement('div');
  picker.id = 'mute-duration-picker';
  picker.style.cssText = `
    position:fixed; z-index:10000;
    background:var(--surface-container-high, #1e1e2e);
    border:1px solid var(--outline-variant, rgba(255,255,255,0.12));
    border-radius:16px; padding:8px;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
    min-width:200px; font-size:13px; font-weight:600;
  `;

  if (isMuted) {
    // Already muted — show unmute option
    const btn = document.createElement('button');
    btn.style.cssText = `
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 14px; border-radius:10px; border:none;
      background:transparent; cursor:pointer; text-align:left;
      color:var(--on-surface, #fff); transition:background 0.15s;
    `;
    btn.innerHTML = '<span style="font-size:16px">🔔</span> Unmute';
    btn.onmouseenter = () => btn.style.background = 'var(--surface-container-highest, #2a2a3e)';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = () => { picker.remove(); toggleChatMute(chatId); };
    picker.appendChild(btn);
  } else {
    // Show duration options
    const durations = [
      { label: '1 hour', ms: 3600000 },
      { label: '8 hours', ms: 28800000 },
      { label: '1 week', ms: 604800000 },
      { label: 'Until I turn it back on', ms: -1 }
    ];

    durations.forEach(({ label, ms }) => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        display:flex; align-items:center; gap:10px; width:100%;
        padding:10px 14px; border-radius:10px; border:none;
        background:transparent; cursor:pointer; text-align:left;
        color:var(--on-surface, #fff); transition:background 0.15s;
      `;
      btn.innerHTML = `<span style="font-size:14px">🔕</span> ${label}`;
      btn.onmouseenter = () => btn.style.background = 'var(--surface-container-highest, #2a2a3e)';
      btn.onmouseleave = () => btn.style.background = 'transparent';
      btn.onclick = () => {
        picker.remove();
        _muteChatWithDuration(chatId, ms);
      };
      picker.appendChild(btn);
    });
  }

  document.body.appendChild(picker);

  // Position near center of viewport
  const rect = picker.getBoundingClientRect();
  picker.style.left = Math.max(10, (window.innerWidth - rect.width) / 2) + 'px';
  picker.style.top = Math.max(10, (window.innerHeight - rect.height) / 2) + 'px';

  // Dismiss on click outside
  setTimeout(() => {
    const dismiss = (e) => {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', dismiss);
      }
    };
    document.addEventListener('click', dismiss);
  }, 50);
}

function _muteChatWithDuration(chatId, durationMs) {
  if (!App._mutedChats) App._mutedChats = new Set();
  if (!App._mutedUntil) App._mutedUntil = {};

  App._mutedChats.add(chatId);

  // Store mute expiry (-1 = forever)
  if (durationMs === -1) {
    App._mutedUntil[chatId] = -1;
  } else {
    App._mutedUntil[chatId] = Date.now() + durationMs;
  }

  _saveMuteState();

  const label = durationMs === -1 ? 'until manually unmuted' :
    durationMs >= 604800000 ? 'for 1 week' :
    durationMs >= 28800000 ? 'for 8 hours' : 'for 1 hour';
  showToast(`Chat muted ${label}`, 'info');

  _renderMuteBadge(chatId);

  // Persist to Firestore
  if (App.db && App.auth?.currentUser) {
    const uid = App.auth.currentUser.uid;
    const chat = App.chats.find(c => c.id === chatId);
    const col = chat?.type === 'group' ? 'groups' : 'directChats';
    App.db.collection(col).doc(chatId).set({
      [`muted.${uid}`]: true,
      [`mutedUntil.${uid}`]: durationMs === -1 ? null : new Date(Date.now() + durationMs).toISOString()
    }, { merge: true }).catch(() => {});
  }
}

function toggleChatMute(chatId) {
  if (!App._mutedChats) App._mutedChats = new Set();
  const wasMuted = App._mutedChats.has(chatId);
  if (wasMuted) {
    App._mutedChats.delete(chatId);
    if (App._mutedUntil) delete App._mutedUntil[chatId];
    showToast('Chat unmuted', 'success');
  } else {
    App._mutedChats.add(chatId);
    showToast('Chat muted — no notification sounds', 'info');
  }
  _saveMuteState();
  _renderMuteBadge(chatId);
  if (App.db && App.auth?.currentUser) {
    const uid = App.auth.currentUser.uid;
    const chat = App.chats.find(c => c.id === chatId);
    const col = chat?.type === 'group' ? 'groups' : 'directChats';
    App.db.collection(col).doc(chatId).set({ [`muted.${uid}`]: !wasMuted }, { merge: true }).catch(() => {});
  }
}

function _renderMuteBadge(chatId) {
  const chatEl = document.querySelector(`[data-chat-id="${chatId}"]`) ||
    document.querySelector(`.chat-list-item[onclick*="${chatId}"]`);
  if (!chatEl) return;
  const isMuted = App._mutedChats?.has(chatId);
  chatEl.classList.toggle('muted', isMuted);
  let badge = chatEl.querySelector('.mute-badge');
  if (isMuted && !badge) {
    badge = document.createElement('span');
    badge.className = 'mute-badge';
    badge.textContent = '🔕';
    badge.style.cssText = 'font-size:12px;margin-left:4px;';
    const nameEl = chatEl.querySelector('.chat-name, .chat-item-name');
    if (nameEl) nameEl.appendChild(badge);
  } else if (!isMuted && badge) {
    badge.remove();
  }
  _updateChatMuteIcon(chatId);
}

function _updateChatMuteIcon(chatId) {
  if (App.currentChat?.id !== chatId) return;
  const icon = document.getElementById('chat-mute-icon');
  if (!icon) return;
  const isMuted = App._mutedChats?.has(chatId);
  icon.textContent = isMuted ? 'notifications_off' : 'notifications';
}

function _saveMuteState() {
  try {
    localStorage.setItem('nsl_muted_chats', JSON.stringify([...App._mutedChats || []]));
    localStorage.setItem('nsl_muted_until', JSON.stringify(App._mutedUntil || {}));
  } catch(_) {}
}

function _loadMuteState() {
  try {
    App._isMutedGlobal = localStorage.getItem('nsl_muted_global') === '1';
    const arr = JSON.parse(localStorage.getItem('nsl_muted_chats') || '[]');
    App._mutedChats = new Set(arr);
    App._mutedUntil = JSON.parse(localStorage.getItem('nsl_muted_until') || '{}');

    // Check for expired mutes
    const now = Date.now();
    for (const [chatId, until] of Object.entries(App._mutedUntil)) {
      if (until > 0 && until <= now) {
        App._mutedChats.delete(chatId);
        delete App._mutedUntil[chatId];
      }
    }
    _saveMuteState();
  } catch(_) {
    App._isMutedGlobal = false;
    App._mutedChats = new Set();
    App._mutedUntil = {};
  }
  _updateGlobalMuteUI();
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

  if (!navigator.mediaDevices?.getUserMedia) {
    if (status) status.textContent = 'Camera access is not supported by this browser.';
    return;
  }

  let useJsQRFallback = !('BarcodeDetector' in window);

  if (useJsQRFallback && !window.jsQR) {
    if (status) status.textContent = 'Loading scanner library...';
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'jsQR.js?v=3';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load local JSQR'));
        document.head.appendChild(script);
      });
    } catch (e) {
      if (status) status.textContent = 'Failed to load QR scanner library.';
      console.error(e);
      return;
    }
  }

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }, audio: false
    });
    video.srcObject = scannerStream;
    await video.play();
    if (status) status.textContent = 'Point camera at a QR code.';

    let detector = null;
    let canvas = null;
    let ctx = null;

    if (!useJsQRFallback) {
      const formats = await window.BarcodeDetector.getSupportedFormats().catch(() => ['qr_code']);
      detector = new window.BarcodeDetector({ formats });
    } else {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
    }

    const detectFrame = async () => {
      if (!scannerStream || overlay.classList.contains('hidden')) return;
      try {
        let scannedValue = '';
        if (!useJsQRFallback && detector) {
          const codes = video.readyState >= 2 ? await detector.detect(video) : [];
          if (codes.length > 0 && codes[0].rawValue) {
            scannedValue = codes[0].rawValue;
          }
        } else if (useJsQRFallback && canvas && ctx && video.readyState >= 2) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code && code.data) {
            scannedValue = code.data;
          }
        }

        if (scannedValue) {
          scannerValue = scannedValue;
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
  let lang = 'en';
  try { lang = localStorage.getItem('tc_language') || 'en'; } catch(_) {}
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}

function setLanguage(lang) {
  try { localStorage.setItem('tc_language', lang || 'en'); } catch(_) {}
  document.documentElement.lang = lang || 'en';
  // Update static sidebar labels
  const sidebarNav = document.getElementById('sidebar-nav-container');
  if (sidebarNav && !App.showroomOverride?.type) {
    const btns = sidebarNav.querySelectorAll('.tab-item');
    const labels = btns ? [
      { el: btns[0]?.querySelector('span:last-child'), key: 'chats' },
      { el: btns[1]?.querySelector('span:last-child'), key: 'groups' },
      { el: btns[2]?.querySelector('span:last-child'), key: 'calls' },
      { el: btns[3]?.querySelector('span:last-child'), key: 'saved_items' },
    ] : [];
    labels.forEach(({ el, key }) => { if (el) el.textContent = __(key); });
  }
  // Update bottom nav labels
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    const navBtns = bottomNav.querySelectorAll('.bottom-nav-item');
    const navLabels = [
      { el: navBtns[0]?.querySelector('span:last-child'), key: 'chats' },
      { el: navBtns[1]?.querySelector('span:last-child'), key: 'groups' },
      { el: navBtns[2]?.querySelector('span:last-child'), key: 'calls' },
      { el: navBtns[3]?.querySelector('span:last-child'), key: 'requests' },
      { el: navBtns[4]?.querySelector('span:last-child'), key: 'saved_items' },
    ];
    navLabels.forEach(({ el, key }) => { if (el) el.textContent = __(key); });
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
  if (typeof _moduleCleanupAll === 'function') _moduleCleanupAll();
  if (typeof window.resetAppState === 'function') window.resetAppState();
  if (App.usersUnsubscribe)        App.usersUnsubscribe();
  if (App.chatsUnsubscribe)        App.chatsUnsubscribe();
  if (App.groupsUnsubscribe)       App.groupsUnsubscribe();
  if (App.messagesUnsubscribe)     App.messagesUnsubscribe();
  if (App.chatRequestsUnsubscribe) App.chatRequestsUnsubscribe();
  if (App.chatRequestsOutgoingUnsubscribe) App.chatRequestsOutgoingUnsubscribe();
  if (App.callLogsUnsubscribe)     App.callLogsUnsubscribe();
  if (App.callsUnsubscriber)       App.callsUnsubscriber();
  if (App.callsUnsubscriber2)      App.callsUnsubscriber2();
  // Clear E2E key cache to prevent stale keys for next user
  Object.keys(_e2eSharedKeys).forEach(k => delete _e2eSharedKeys[k]);
  if (App.auth) App.auth.signOut().then(() => location.reload());
  else location.reload();
}

function confirmDeleteAccount() {
  closeModal('profile-overlay');
  // Show a multi-step confirmation
  const email = App.currentUser?.email || '';
  showConfirm(
    'Delete your account permanently?\n\nThis will:\n• Delete all your messages\n• Remove you from all groups\n• Delete your call history\n• Log you out\n\nThis cannot be undone!',
    () => {
      // Second confirmation with email prompt
      const confirmEmail = prompt('Type your email to confirm:\n' + email);
      if (confirmEmail && confirmEmail.toLowerCase() === email.toLowerCase()) {
        deleteAccount();
      } else {
        showToast('Email does not match. Account not deleted.', 'error');
      }
    }
  );
}

async function deleteAccount() {
  showToast('Deleting account...', 'info');
  const uid = App.auth?.currentUser?.uid;
  if (!uid) { showToast('Not logged in', 'error'); return; }
  
  try {
    // 1. Clean up user data
    if (App.db) {
      // Delete user document
      await App.db.collection('users').doc(uid).delete();
      // Delete all directChats where user is participant
      const chatsSnap = await App.db.collection('directChats')
        .where('participants', 'array-contains', uid).get();
      for (const doc of chatsSnap.docs) { try { await doc.ref.delete(); } catch(_) {} }
      // Delete call logs
      const callLogsSnap = await App.db.collection('callLogs')
        .where('participants', 'array-contains', uid).get();
      for (const doc of callLogsSnap.docs) { try { await doc.ref.delete(); } catch(_) {} }
      // Delete chat requests (both from and to)
      const reqSnap = await App.db.collection('chatRequests')
        .where('fromUserId', '==', uid).get();
      for (const doc of reqSnap.docs) { try { await doc.ref.delete(); } catch(_) {} }
      const reqToSnap = await App.db.collection('chatRequests')
        .where('toUserId', '==', uid).get();
      for (const doc of reqToSnap.docs) { try { await doc.ref.delete(); } catch(_) {} }
      // Delete user's messages (chunked by 500)
      const msgsSnap = await App.db.collection('messages')
        .where('senderId', '==', uid).get();
      const msgRefs = msgsSnap.docs.map(d => d.ref);
      for (let i = 0; i < msgRefs.length; i += 500) {
        const batch = App.db.batch();
        msgRefs.slice(i, i + 500).forEach(ref => batch.delete(ref));
        await batch.commit();
      }
    }
    
    // 2. Delete Firebase Auth account
    if (App.auth?.currentUser) {
      await App.auth.currentUser.delete();
    }
    
    // 3. Show success, then sign out
    showToast('Account deleted successfully. Signing out...', 'success');
    setTimeout(() => signOut(), 1500);
  } catch (err) {
    console.error('Delete account error:', err);
    // Try Firebase Auth delete even if Firestore cleanup fails
    if (App.auth?.currentUser) {
      try {
        await App.auth.currentUser.delete();
        showToast('Account deleted. Signing out...', 'success');
        setTimeout(() => signOut(), 1500);
      } catch (authErr) {
        // If token is too old, need re-auth
        if (authErr.code === 'auth/requires-recent-login') {
          showToast('Please log out and log in again before deleting your account', 'error');
        } else {
          showToast('Failed to delete account: ' + authErr.message, 'error');
        }
      }
    }
  }
}

/* ══════════════════════════════════════════════════
   TABLET UTILITY FUNCTIONS
   ══════════════════════════════════════════════════ */

/* H2: Toggle sidebar expand on tablet */
function toggleSidebarExpand() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const isExpanded = sidebar.classList.contains('sidebar-expanded');
  if (isExpanded) {
    sidebar.classList.remove('sidebar-expanded');
    sidebar.style.width = '';
    sidebar.querySelectorAll('.xl\\:block').forEach(el => el.style.display = '');
    const icon = document.getElementById('sidebar-toggle-icon');
    if (icon) icon.textContent = 'menu_open';
  } else {
    sidebar.classList.add('sidebar-expanded');
    sidebar.style.width = '256px';
    sidebar.querySelectorAll('.xl\\:block').forEach(el => el.style.display = '');
    const icon = document.getElementById('sidebar-toggle-icon');
    if (icon) icon.textContent = 'menu';
  }
}

/* H9: Hide skeleton when chat list renders — called from renderChatList */
function _hideChatListSkeleton() {
  const sk = document.getElementById('chat-list-skeleton');
  if (sk) sk.style.display = 'none';
}

/* H7: Stylus hover preview on message bubbles */
(function _initStylusHover() {
  let _hoverTimeout = null;
  let _hoverBubble = null;
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'pen') return;
    clearTimeout(_hoverTimeout);
    _hoverTimeout = setTimeout(() => {
      const bubble = e.target.closest('.msg-sent, .msg-received, .message-bubble');
      if (bubble && bubble !== _hoverBubble) {
        if (_hoverBubble) _hoverBubble.style.outline = '';
        _hoverBubble = bubble;
        bubble.style.outline = '2px solid var(--primary)';
        bubble.style.outlineOffset = '2px';
      }
    }, 150);
  });
  document.addEventListener('pointerleave', () => {
    clearTimeout(_hoverTimeout);
    if (_hoverBubble) { _hoverBubble.style.outline = ''; _hoverBubble = null; }
  }, true);
})();

/* M10: Long-press to copy text from messages (alongside reactions) */
function _addCopyOptionToLongPress(msgId) {
  const picker = document.querySelector('[id^="_quick-react-"]');
  if (!picker) return;
  const msg = (App.messages[App.currentChat?.id] || []).find(m => m.id === msgId);
  if (!msg || !msg.text) return;
  const copyBtn = document.createElement('button');
  copyBtn.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;padding:8px 14px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left;color:var(--on-surface);font-size:13px;transition:background 0.15s;';
  copyBtn.innerHTML = '<span style="font-size:16px">📋</span> Copy text';
  copyBtn.onmouseenter = () => copyBtn.style.background = 'var(--surface-container-highest)';
  copyBtn.onmouseleave = () => copyBtn.style.background = 'transparent';
  copyBtn.onclick = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(msg.text);
    else { const ta = document.createElement('textarea'); ta.value = msg.text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    showToast('Copied to clipboard', 'success');
    const qp = document.querySelector('[id^="_quick-react-"]');
    if (qp) qp.remove();
  };
  picker.appendChild(copyBtn);
}

/* L5: Pressure-sensitive drawing on iPad with Apple Pencil */
function _applyPressureToCanvas(canvas, ctx) {
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'pen') return;
    ctx.lineWidth = Math.max(1, (e.pressure || 0.5) * 12);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'pen') return;
    ctx.lineWidth = Math.max(1, (e.pressure || 0.5) * 12);
  });
}

/* WhatsApp Filter Chip Functions */
window.setWaFilter = function(filterName) {
  App.activeWaFilter = filterName;
  document.querySelectorAll('#wa-filter-chips .wa-chip').forEach(btn => {
    const isMatching = btn.getAttribute('data-filter') === filterName;
    btn.classList.toggle('active', isMatching);
  });

  // Keep the filter list button highlight state in sync
  const filterBtn = document.getElementById('btn-filter-unread');
  if (filterBtn) {
    if (filterName === 'unread') {
      filterBtn.classList.add('bg-primary/20', 'text-primary');
      filterBtn.classList.remove('text-on-surface-variant');
    } else {
      filterBtn.classList.remove('bg-primary/20', 'text-primary');
      filterBtn.classList.add('text-on-surface-variant');
    }
  }

  renderChatList();
};

window.toggleUnreadFilter = function() {
  const isUnread = App.activeWaFilter === 'unread';
  setWaFilter(isUnread ? 'all' : 'unread');
};

window.addNewFilterChip = function() {
  showOverlay('nsl-utilities-overlay');
};

/* WhatsApp Reaction Notification Listeners */
window.subscribeToMyReactions = function() {
  if (!App.db || !App.auth?.currentUser) return;
  const myUid = App.auth.currentUser.uid;
  if (App.reactionsUnsubscribe) {
    App.reactionsUnsubscribe();
    App.reactionsUnsubscribe = null;
  }

  const knownReactions = new Map();

  App.reactionsUnsubscribe = App.db.collection('messages')
    .where('senderId', '==', myUid)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(change => {
        const msgId = change.doc.id;
        const msgData = change.doc.data();
        const reactions = msgData.reactions || [];
        const chatId = msgData.directId || msgData.groupId;
        if (!chatId) return;

        const currentKeys = reactions.map(r => r.userId + ':' + r.emoji);

        if (change.type === 'added') {
          knownReactions.set(msgId, currentKeys);
          return;
        }

        if (change.type === 'modified') {
          const prevKeys = knownReactions.get(msgId) || [];
          knownReactions.set(msgId, currentKeys);

          reactions.forEach(r => {
            if (r.userId !== myUid) {
              const key = r.userId + ':' + r.emoji;
              if (!prevKeys.includes(key)) {
                triggerReactionNotification(chatId, msgId, msgData, r);
              }
            }
          });
        }
      });
    }, (err) => {
      console.warn('[Reactions] Subscription error:', err);
    });
};

window.triggerReactionNotification = function(chatId, msgId, msgData, reaction) {
  const chat = App.chats.find(c => c.id === chatId);
  if (!chat) return;

  chat.unreadReaction = true;
  chat.unreadReactionEmoji = reaction.emoji;
  chat.unreadReactionText = msgData.text || (msgData.attachment?.type || 'attachment');
  chat.unreadReactionMsgId = msgId;

  // Move chat to top of list
  chat.lastTime = Date.now();

  let reactorName = 'Someone';
  const contact = App.contacts.find(c => c.uid === reaction.userId);
  if (contact) {
    reactorName = contact.name;
  }

  // Display system notification
  if (window.DesktopNotifications && DesktopNotifications.isSupported()) {
    DesktopNotifications.show({
      title: `New Reaction on ${chat.name}`,
      body: `${reactorName} reacted ${reaction.emoji} to: "${msgData.text || 'message'}"`,
      onClick: () => {
        window.focus();
        openChat(chatId);
        setTimeout(() => {
          const bubble = document.getElementById(`msg-${msgId}`);
          if (bubble) {
            bubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
            bubble.classList.add('animate-pulse');
            setTimeout(() => bubble.classList.remove('animate-pulse'), 2000);
          }
        }, 300);
      }
    });
  }

  // Fallback in-app toast
  showToast(`${reactorName} reacted ${reaction.emoji} to your message`, 'info');

  // Notification Sound
  if (typeof App !== 'undefined' && !App._isMutedGlobal && !App._mutedChats?.has(chatId)) {
    const audio = new Audio('sounds/notification.mp3');
    audio.play().catch(() => {});
  }

  renderChatList();
};
