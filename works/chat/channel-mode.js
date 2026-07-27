/**
 * Channel Mode â€” Persistent one-to-many broadcast channels.
 * Admins create channels within groups; channels have their own chat space.
 * Channels stored in `channels` collection; messages use existing `messages` subcollection.
 * Admin-only posting by default (toggled per channel).
 */
(function () {
  'use strict';

  var _channelUnsub = null;
  var _channelMsgGen = 0;
  var _origSendMessage = null;

  function _channelKey(channelId) {
    return '_channel_' + channelId;
  }

  var _esc = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  function init() {
    injectChannelButton();
    wrapSendMessage();
    listenForChatSwitch();
  }

  function wrapSendMessage() {
    if (_origSendMessage) return;
    var pending = setInterval(function () {
      if (typeof window.sendMessage === 'function') {
        clearInterval(pending);
        _origSendMessage = window.sendMessage;
        window.sendMessage = function () {
          if (window._activeChannelId && window.App && window.App.currentChat) {
            return _sendChannelMessage();
          }
          return _origSendMessage.apply(this, arguments);
        };
      }
    }, 100);
  }

  function listenForChatSwitch() {
    document.addEventListener('nsl:chat-opened', function () {
      if (window._activeChannelId) {
        _closeChannel();
      }
    });
  }

  function _closeChannel() {
    if (_channelUnsub) {
      _channelUnsub();
      _channelUnsub = null;
    }

    var prevId = window._activeChannelId;
    window._activeChannelId = null;
    window._activeChannelName = null;

    var banner = document.getElementById('channel-active-banner');
    if (banner) banner.remove();

    var inputBox = document.getElementById('msg-input');
    if (inputBox) {
      inputBox.disabled = false;
      inputBox.placeholder = 'Type a message';
    }

    if (prevId && window.App && window.App.currentChat) {
      var key = _channelKey(prevId);
      delete window.App.messages[key];
      if (typeof renderMessages === 'function') {
        renderMessages(window.App.currentChat.id);
      }
      if (typeof scrollToBottom === 'function') {
        scrollToBottom(true);
      }
    }
  }

  function _subscribeToChannelMessages(channelId) {
    if (!window.App || !window.App.db || !window.App.auth || !window.App.auth.currentUser) return;

    if (_channelUnsub) {
      _channelUnsub();
      _channelUnsub = null;
    }

    var myGen = ++_channelMsgGen;
    var key = _channelKey(channelId);

    _channelUnsub = window.App.db.collection('messages')
      .where('channelId', '==', channelId)
      .onSnapshot(function (snapshot) {
        if (_channelMsgGen !== myGen) return;

        var uid = window.App.auth.currentUser.uid;
        var msgs = [];

        snapshot.forEach(function (doc) {
          var data = doc.data();

          if (data.deletedForEveryone) return;
          if (uid && data.deletedFor && data.deletedFor[uid]) return;

          if (data.expiresAt) {
            var expiresAt = typeof data.expiresAt === 'number' ? data.expiresAt : (data.expiresAt && data.expiresAt.toMillis ? data.expiresAt.toMillis() : 0);
            if (expiresAt > 0 && Date.now() > expiresAt) return;
          }

          var type = 'text';
          var url = '';
          var duration = '';
          var fileName = '';
          var fileSize = '';

          if (data.type === 'poll') {
            type = 'poll';
          }

          if (data.attachment) {
            var att = data.attachment;
            if (att.type === 'image') { type = 'image'; url = att.url || ''; }
            else if (att.type === 'video') { type = 'video'; url = att.url || ''; }
            else if (att.type === 'voice' || att.type === 'audio') { type = 'voice'; url = att.url || ''; duration = att.duration || '0:00'; }
            else if (att.type === 'location') { type = 'location'; url = att.mapUrl || ''; }
            else { type = 'doc'; fileName = att.name || 'Document'; fileSize = att.size || ''; }
          }

          var reactionsRaw = data.reactions;
          var reactions;
          if (Array.isArray(reactionsRaw)) {
            reactions = reactionsRaw;
          } else {
            reactions = Object.entries(reactionsRaw || {}).map(function (entry) {
              var emoji = entry[0];
              var count = entry[1];
              return {
                emoji: emoji,
                count: typeof count === 'number' ? count : (count && count.count || 0),
                mine: Array.isArray(count && count.users) ? count.users.indexOf(uid) !== -1 : false
              };
            }).filter(function (r) { return r.count > 0; });
          }

          msgs.push({
            id: doc.id,
            from: data.senderId === uid ? 'me' : data.senderId,
            text: data.text || '',
            time: data.timestamp && data.timestamp.toMillis ? data.timestamp.toMillis() : (data.time || Date.now()),
            status: data.status || 'read',
            replyTo: data.replyTo ? { name: data.replyTo.senderName, text: data.replyTo.text } : null,
            reactions: reactions,
            type: type,
            url: url,
            duration: duration,
            durationSec: (data.attachment && data.attachment.durationSec) || 0,
            fileName: fileName,
            fileSize: fileSize,
            lat: data.attachment && data.attachment.lat,
            lng: data.attachment && data.attachment.lng,
            mapUrl: (data.attachment && data.attachment.mapUrl) || url,
            contactName: data.attachment && data.attachment.contactName,
            contactEmail: data.attachment && data.attachment.contactEmail,
            starred: data.starred || false,
            edited: data.edited || false,
            forwarded: data.forwarded || false,
            senderName: data.senderName || ''
          });
        });

        if (_channelMsgGen !== myGen) return;
        msgs.sort(function (a, b) { return a.time - b.time; });

        window.App.messages[key] = msgs;
        _renderChannelMessages(key, channelId);
      }, function (error) {
        if (window.__DEBUG__) console.warn('Channel messages subscription error:', error);
      });
  }

  function _renderChannelMessages(key, channelId) {
    var msgs = window.App.messages[key] || [];
    var wrap = document.getElementById('messages-wrap');
    if (!wrap) return;

    if (typeof VirtualScroll !== 'undefined' && App._vsActive) {
      VirtualScroll.destroy();
      App._vsActive = false;
      App._vsChatId = null;
    }

    if (!msgs.length) {
      var ch = _findChannel(channelId);
      var chName = ch ? ch.name : '';
      wrap.innerHTML =
        '<div class="flex flex-col items-center py-12 text-center w-full">' +
          '<div class="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20">' +
            '<span class="material-symbols-outlined text-emerald-400 text-3xl">tag</span>' +
          '</div>' +
          '<h4 class="font-bold mb-1">Welcome to #' + _esc(chName) + '</h4>' +
          '<p class="text-on-surface-variant text-sm">Be the first to post a message here</p>' +
        '</div>';
      return;
    }

    var chat = window.App.currentChat;
    var useVirtualScroll = msgs.length > 150;

    if (useVirtualScroll) {
      if (!App._vsActive || App._vsChatId !== key) {
        VirtualScroll.destroy();
        wrap.innerHTML = '';
        VirtualScroll.init(wrap, function (item) { return item.html; }, { rowHeight: 80, bufferRows: 10, threshold: 150 });
        App._vsActive = true;
        App._vsChatId = key;
      }
      var lastDate = null;
      var vsItems = [];
      for (var i = 0; i < msgs.length; i++) {
        var html = _renderChannelMsgHTML(msgs[i], msgs, i, lastDate, chat);
        var dateKey = new Date(msgs[i].time).toDateString();
        if (dateKey !== lastDate) lastDate = dateKey;
        vsItems.push({ html: html });
      }
      VirtualScroll.setItems(vsItems);
      requestAnimationFrame(function () {
        if (App._vsActive && VirtualScroll._enabled) VirtualScroll._render();
      });
    } else {
      var htmlStr = '';
      var lastDate2 = null;
      msgs.forEach(function (msg, i) {
        htmlStr += _renderChannelMsgHTML(msg, msgs, i, lastDate2, chat);
        lastDate2 = new Date(msg.time).toDateString();
      });
      wrap.innerHTML = htmlStr;
      if (typeof renderEmojiInElement === 'function') renderEmojiInElement(wrap);
    }

    if (typeof scrollToBottom === 'function') scrollToBottom(true);
  }

  function _findChannel(channelId) {
    if (!window.App || !window.App.currentChat) return null;
    var channels = window.App.currentChat.channels || [];
    for (var i = 0; i < channels.length; i++) {
      if (channels[i].id === channelId) return channels[i];
    }
    return null;
  }

  function _formatMsgTime(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function _formatDateSep(date) {
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function _formatMsgText(text) {
    var html = _esc(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/`(.*?)`/g, '<code class="bg-surface-container px-1 py-0.5 rounded font-mono text-xs">$1</code>')
      .replace(/(https?:\/\/[^\s&]+)/g, function (url) {
        var display = url.replace(/&amp;/g, '&');
        return '<a href="' + url + '" target="_blank" rel="noopener" class="underline text-primary hover:text-secondary">' + display + '</a>';
      })
      .replace(/\n/g, '<br>');
    return html;
  }

  function _renderChannelMsgHTML(msg, msgs, i, lastDate, _chat) {
    var msgDate = new Date(msg.time);
    var dateKey = msgDate.toDateString();
    var sep = '';
    if (dateKey !== lastDate) {
      sep = '<div class="flex justify-center my-6"><span class="bg-surface-container-highest/50 px-4 py-1 rounded-full text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">' + _formatDateSep(msgDate) + '</span></div>';
    }

    var isMe = msg.from === 'me';
    var showAvatar = !isMe && (i === msgs.length - 1 || (msgs[i + 1] && msgs[i + 1].from !== msg.from));
    var senderName = msg.senderName || 'Unknown';

    var avatarHTML;
    if (showAvatar) {
      avatarHTML = '<div class="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-400 font-bold text-sm">' + _esc(senderName.charAt(0).toUpperCase()) + '</div>';
    } else {
      avatarHTML = '<div class="w-10"></div>';
    }

    var reactions = (msg.reactions || []).map(function (r) {
      return '<div class="flex items-center gap-1 bg-surface-container border border-outline-variant/30 px-2 py-0.5 rounded-lg text-xs">' +
        '<span>' + r.emoji + '</span><span class="font-bold text-[10px]">' + r.count + '</span></div>';
    }).join('');

    var tickIcon = '';
    if (isMe) {
      if (msg.status === 'read') {
        tickIcon = '<span class="material-symbols-outlined text-[14px] text-primary mat-icon--filled">done_all</span>';
      } else if (msg.status === 'delivered') {
        tickIcon = '<span class="material-symbols-outlined text-[14px] text-on-surface-variant mat-icon--filled">done_all</span>';
      } else if (msg.status === 'sending') {
        tickIcon = '<span class="material-symbols-outlined text-[14px] text-on-surface-variant sync-badge pending" style="animation: syncRotate 2s infinite linear; display: inline-block;">schedule</span>';
      } else {
        tickIcon = '<span class="material-symbols-outlined text-[14px] text-on-surface-variant">done</span>';
      }
    }

    var replyHTML = '';
    if (msg.replyTo) {
      replyHTML = '<div class="border-l-2 border-primary/50 pl-3 mb-2 opacity-80 text-xs">' +
        '<div class="font-bold text-primary">' + _esc(msg.replyTo.name) + '</div>' +
        '<div class="truncate text-on-surface-variant">' + _esc(msg.replyTo.text) + '</div></div>';
    }

    var contentHTML;
    if (msg.type === 'image') {
      contentHTML = '<div class="rounded-xl overflow-hidden max-w-full border border-outline-variant/20">' +
        '<img src="' + _esc(msg.url) + '" alt="Image" loading="lazy" class="w-full max-h-48 object-cover rounded-xl"></div>';
    } else if (msg.type === 'video') {
      contentHTML = '<div class="rounded-xl overflow-hidden max-w-full border border-outline-variant/20">' +
        '<video src="' + _esc(msg.url) + '" class="max-h-48 rounded-xl w-full" preload="metadata" controls playsinline></video></div>';
    } else if (msg.type === 'voice') {
      contentHTML = '<div class="bg-surface-container-high/40 p-2.5 rounded-xl border border-outline-variant/20">' +
        '<div class="flex items-center gap-2">' +
          '<span class="text-on-surface-variant text-[12px]">' + (msg.duration || '0:00') + '</span>' +
          '<div class="flex-1 h-0.5 bg-surface-variant rounded-full"></div>' +
        '</div></div>';
    } else if (msg.type === 'doc') {
      contentHTML = '<div class="flex items-center gap-3 bg-surface-container-high p-3 rounded-xl border border-outline-variant/20">' +
        '<div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary"><span class="material-symbols-outlined text-sm">description</span></div>' +
        '<div class="flex-1"><p class="text-xs font-bold truncate">' + _esc(msg.fileName || 'Document') + '</p><p class="text-[10px] text-on-surface-variant">' + (msg.fileSize || '') + '</p></div>' +
      '</div>';
    } else if (msg.type === 'poll' && msg.poll) {
      contentHTML = '<div class="rounded-xl border border-outline-variant/20 overflow-hidden p-3">' +
        '<p class="text-sm font-bold mb-2">' + _esc(msg.poll.question || 'Poll') + '</p></div>';
    } else {
      contentHTML = '<div class="text-sm font-normal leading-relaxed text-on-surface break-words overflow-wrap-anywhere">' + _formatMsgText(msg.text || '') + '</div>';
    }

    var fwdBadge = msg.forwarded ? '<span class="text-[9px] text-on-surface-variant italic opacity-70 mb-1">&#8618; Forwarded</span>' : '';
    var starBadge = msg.starred ? '<span class="text-[10px]">&#11088;</span>' : '';
    var editBadge = msg.edited ? '<span class="text-[9px] text-on-surface-variant italic opacity-60">(edited)</span>' : '';

    var bubbleClass = isMe
      ? 'bg-primary text-on-primary rounded-2xl rounded-tr-none shadow-md'
      : 'bg-surface-container-highest rounded-2xl rounded-tl-none border border-outline-variant/15';

    return sep +
      '<div class="flex items-end gap-3 ' + (isMe ? 'justify-end ml-auto' : 'justify-start') + ' w-full max-w-[85%] mb-4" id="msg-' + msg.id + '">' +
        (!isMe ? avatarHTML : '') +
        '<div class="flex flex-col ' + (isMe ? 'items-end' : 'items-start') + ' max-w-full">' +
          (!isMe ? '<div class="text-[10px] text-on-surface-variant font-bold mb-1 ml-2">' + _esc(senderName) + '</div>' : '') +
          (fwdBadge ? '<div class="' + (isMe ? 'text-right' : 'text-left') + '">' + fwdBadge + '</div>' : '') +
          '<div class="p-bubble_padding_xy ' + bubbleClass + ' relative overflow-hidden max-w-full">' +
            replyHTML +
            contentHTML +
            '<div class="flex items-center justify-end gap-1 mt-1.5 select-none opacity-80">' +
              editBadge +
              '<span class="text-[9px] font-timestamp ' + (isMe ? 'text-white/80' : 'text-on-surface-variant') + '">' + _formatMsgTime(msg.time) + '</span>' +
              starBadge +
              tickIcon +
            '</div>' +
          '</div>' +
          (reactions ? '<div class="flex flex-wrap gap-1 mt-1">' + reactions + '</div>' : '') +
        '</div>' +
      '</div>';
  }

  function _sendChannelMessage() {
    var input = document.getElementById('msg-input');
    var text = input ? input.value.trim() : '';
    if (!text || !window._activeChannelId || !window.App || !window.App.currentChat) return;

    var channelId = window._activeChannelId;
    var key = _channelKey(channelId);
    var chat = window.App.currentChat;

    var msg = {
      id: 'msg_' + Date.now(),
      from: 'me',
      text: text,
      time: Date.now(),
      status: 'sending',
      replyTo: window.App.replyTo ? { name: window.App.replyTo.name, text: window.App.replyTo.text, id: window.App.replyTo.id, image: window.App.replyTo.image || null } : null,
      senderName: window.App.currentUser ? (window.App.currentUser.displayName || window.App.currentUser.email || 'Me') : 'Me'
    };

    if (!window.App.messages[key]) window.App.messages[key] = [];
    window.App.messages[key].push(msg);

    input.value = '';
    input.style.height = 'auto';
    if (typeof toggleSendMic === 'function') toggleSendMic();
    if (typeof cancelReply === 'function') cancelReply();

    _renderChannelMessages(key, channelId);
    if (typeof scrollToBottom === 'function') scrollToBottom(true);
    if (typeof renderChatList === 'function') renderChatList();
    if (typeof playMsgSentSound === 'function') playMsgSentSound();

    if (window.App.db && window.App.auth && window.App.auth.currentUser) {
      var uid = window.App.auth.currentUser.uid;
      var messageData = {
        senderId: uid,
        senderName: window.App.currentUser ? (window.App.currentUser.displayName || window.App.currentUser.email || 'Me') : 'Me',
        senderEmail: window.App.currentUser ? (window.App.currentUser.email || '') : '',
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
        read: false,
        channelId: channelId,
        groupId: chat.id
      };

      window.App.db.collection('messages').add(messageData).then(function () {
        msg.status = 'delivered';
        _renderChannelMessages(key, channelId);
      }).catch(function (e) { if (window.__DEBUG__) console.error('Channel send error:', e); });

      window.App.db.collection('groups').doc(chat.id).update({
        lastMessage: '#' + (window._activeChannelName || 'channel') + ': ' + text,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageSenderId: uid,
        lastMessageSenderName: window.App.currentUser ? (window.App.currentUser.displayName || 'Me') : 'Me'
      }).catch(function () {});
    } else {
      setTimeout(function () {
        msg.status = 'delivered';
        _renderChannelMessages(key, channelId);
      }, 800);
    }
  }

  function injectChannelButton() {
    var run = function () {
      var sidebar = document.getElementById('sidebar') || document.getElementById('sidebar-panel');
      if (!sidebar || sidebar.querySelector('.channel-nav-btn')) return;

      var channelBtn = document.createElement('button');
      channelBtn.className = 'channel-nav-btn w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/30 transition-all cursor-pointer';
      channelBtn.onclick = function () { window.openChannelPanel(); };
      channelBtn.innerHTML =
        '<span class="material-symbols-outlined text-[20px] text-emerald-400">tag</span>' +
        '<span class="text-sm font-bold text-on-surface">Channels</span>';
      sidebar.appendChild(channelBtn);
    };

    if (window.MutationBus) {
      window.MutationBus.onBodyChildList('channel-btn-scan', run);
    }
    setTimeout(run, 2000);
  }

  window.openChannelPanel = function () {
    if (!window.App || !window.App.currentChat) return;
    var chat = window.App.currentChat;
    if (chat.type !== 'group') {
      if (window.showToast) window.showToast('Channels are only available in group chats', 'info');
      return;
    }

    var uid = window.App.auth && window.App.auth.currentUser ? window.App.auth.currentUser.uid : null;
    var chatId = chat.id;
    var channels = chat.channels || [];

    var canCreate = window.ChatPermissions ? window.ChatPermissions.hasPermission(chatId, uid, 'create-channel') :
      (chat.roles && chat.roles[uid] === 'admin');

    var channelItemsHtml = channels.length ? channels.map(function (ch) {
      return '<div class="channel-item flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant/30 transition-all cursor-pointer border border-outline-variant/20 mb-2" onclick="window._openChannel(\'' + ch.id + '\')">' +
        '<span class="material-symbols-outlined text-[20px] text-emerald-400">tag</span>' +
        '<div class="flex-1 min-w-0">' +
          '<p class="text-sm font-bold text-on-surface truncate">' + _esc(ch.name) + '</p>' +
          '<p class="text-xs text-on-surface-variant truncate">' + (ch.announcementOnly ? 'Announcement only' : 'All members can post') + '</p>' +
        '</div>' +
        '<span class="material-symbols-outlined text-[16px] text-on-surface-variant">chevron_right</span>' +
      '</div>';
    }).join('') : '<div class="text-center py-8 text-on-surface-variant">' +
        '<span class="material-symbols-outlined text-[40px] text-on-surface-variant/50 mb-2 block">tag</span>' +
        '<p class="text-sm font-bold">No channels yet</p>' +
        '<p class="text-xs mt-1">Create a channel for organized discussions</p>' +
      '</div>';

    var modalHtml =
      '<div id="channel-panel-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;">' +
        '<div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 m-4 relative animate-scale-up max-h-[85vh] overflow-y-auto">' +
          '<button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById(\'channel-panel-modal\').remove()">' +
            '<span class="material-symbols-outlined text-[20px]">close</span>' +
          '</button>' +
          '<div class="flex items-center justify-between mb-5">' +
            '<div class="flex items-center gap-3">' +
              '<div class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">' +
                '<span class="material-symbols-outlined text-[20px]">tag</span>' +
              '</div>' +
              '<div>' +
                '<h3 class="font-bold text-lg text-on-surface">Channels</h3>' +
                '<p class="text-xs text-on-surface-variant">Organized topic discussions</p>' +
              '</div>' +
            '</div>' +
            (canCreate ? '<button class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-md hover:brightness-110 transition-all" onclick="window._createChannel()">' +
              '<span class="material-symbols-outlined text-[20px]">add</span>' +
            '</button>' : '') +
          '</div>' +
          '<div class="space-y-1" id="channel-list-container">' + channelItemsHtml + '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  window._createChannel = function () {
    document.getElementById('channel-panel-modal') && document.getElementById('channel-panel-modal').remove();

    var modalHtml =
      '<div id="create-channel-modal" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="display:flex;">' +
        '<div class="bg-surface-container border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 m-4 relative animate-scale-up">' +
          '<button class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1" onclick="document.getElementById(\'create-channel-modal\').remove()">' +
            '<span class="material-symbols-outlined text-[20px]">close</span>' +
          '</button>' +
          '<div class="flex flex-col items-center mb-5">' +
            '<div class="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">' +
              '<span class="material-symbols-outlined text-[24px]">add_circle</span>' +
            '</div>' +
            '<h3 class="font-bold text-lg text-on-surface">Create Channel</h3>' +
            '<p class="text-xs text-on-surface-variant text-center mt-1">Create a new topic channel</p>' +
          '</div>' +
          '<div class="space-y-3">' +
            '<div>' +
              '<label class="block text-xs font-bold text-on-surface-variant mb-1">Channel Name</label>' +
              '<div class="flex items-center gap-2 bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-3">' +
                '<span class="material-symbols-outlined text-[18px] text-on-surface-variant">#</span>' +
                '<input type="text" id="channel-name-input" class="flex-1 bg-transparent text-on-surface text-sm focus:outline-none" placeholder="e.g. general, engineering, design">' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<label class="block text-xs font-bold text-on-surface-variant mb-1">Description (optional)</label>' +
              '<input type="text" id="channel-desc-input" class="w-full bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="What is this channel about?">' +
            '</div>' +
            '<div class="flex items-center justify-between bg-surface-variant/30 p-3 rounded-xl">' +
              '<div>' +
                '<p class="text-sm font-bold text-on-surface">Announcement Only</p>' +
                '<p class="text-xs text-on-surface-variant">Only admins can post</p>' +
              '</div>' +
              '<button class="relative w-12 h-6 rounded-full bg-surface-variant transition-all" onclick="this.classList.toggle(\'bg-primary\');this.classList.toggle(\'bg-surface-variant\');" id="channel-announce-toggle">' +
                '<div class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all" id="channel-announce-dot"></div>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<button class="w-full mt-5 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md hover:brightness-110 transition-all" onclick="window._submitChannel()">' +
            'Create Channel' +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  window._submitChannel = async function () {
    if (!window.App || !window.App.db || !window.App.auth.currentUser) return;
    var uid = window.App.auth.currentUser.uid;
    var chat = window.App.currentChat;

    var nameInput = document.getElementById('channel-name-input');
    var descInput = document.getElementById('channel-desc-input');
    var announceToggle = document.getElementById('channel-announce-toggle');

    var name = nameInput ? nameInput.value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : '';
    if (!name) {
      if (window.showToast) window.showToast('Please enter a channel name', 'error');
      return;
    }

    var description = descInput ? descInput.value.trim() : '';
    var announcementOnly = announceToggle ? announceToggle.classList.contains('bg-primary') : false;

    try {
      var docRef = await window.App.db.collection('channels').add({
        name: name,
        description: description,
        announcementOnly: announcementOnly,
        chatId: chat.id,
        chatName: chat.name || '',
        members: chat.memberIds || chat.members || [],
        createdBy: uid,
        createdByName: window.App.currentUser ? (window.App.currentUser.name || 'User') : 'User',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (!chat.channels) chat.channels = [];
      chat.channels.push({
        id: docRef.id,
        name: name,
        description: description,
        announcementOnly: announcementOnly
      });

      var modal = document.getElementById('create-channel-modal');
      if (modal) modal.remove();

      if (window.showToast) window.showToast('#' + name + ' channel created!', 'success');
      if (window.openChannelPanel) window.openChannelPanel();
    } catch (e) {
      if (window.__DEBUG__) console.error('Create channel error:', e);
      if (window.showToast) window.showToast('Failed to create channel', 'error');
    }
  };

  window._openChannel = function (channelId) {
    var panel = document.getElementById('channel-panel-modal');
    if (panel) panel.remove();

    if (!window.App || !window.App.currentChat) return;
    var chat = window.App.currentChat;
    var channel = null;
    var channels = chat.channels || [];
    for (var i = 0; i < channels.length; i++) {
      if (channels[i].id === channelId) { channel = channels[i]; break; }
    }
    if (!channel) return;

    _closeChannel();

    var uid = window.App.auth && window.App.auth.currentUser ? window.App.auth.currentUser.uid : null;
    var canPost = channel.announcementOnly ?
      (window.ChatPermissions ? window.ChatPermissions.hasPermission(chat.id, uid, 'send') : (chat.roles && chat.roles[uid] === 'admin')) : true;

    window._activeChannelId = channelId;
    window._activeChannelName = channel.name;

    var header = document.getElementById('chat-header') || document.querySelector('.chat-header, [class*="header"]');
    if (header) {
      var existingBanner = document.getElementById('channel-active-banner');
      if (existingBanner) existingBanner.remove();

      var banner = document.createElement('div');
      banner.id = 'channel-active-banner';
      banner.style.cssText =
        'background: var(--primary, #6366f1); color: white; padding: 6px 16px; text-align: center; ' +
        'font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; ' +
        'gap: 6px; cursor: pointer; border-radius: 12px; margin: 0 8px;';
      banner.onclick = function () { window.openChannelPanel(); };
      banner.innerHTML = '<span class="material-symbols-outlined text-[14px]">tag</span> #' +
        _esc(channel.name) + (channel.announcementOnly ? ' &bull; Announcement Only' : '') +
        ' <span class="material-symbols-outlined text-[14px]">chevron_right</span>';
      header.parentElement && header.parentElement.insertBefore(banner, header.nextSibling);
    }

    var wrap = document.getElementById('messages-wrap');
    if (wrap) {
      wrap.innerHTML = '<div class="flex flex-col items-center py-8 text-center w-full">' +
        '<div class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">' +
          '<span class="material-symbols-outlined text-[20px]">hourglass_empty</span>' +
        '</div>' +
        '<p class="text-sm text-on-surface-variant font-medium">Loading #' + _esc(channel.name) + ' messages...</p>' +
      '</div>';
    }

    if (window.showToast) window.showToast('Viewing #' + channel.name, 'info');

    var inputBox = document.getElementById('msg-input');
    if (canPost) {
      if (inputBox) {
        inputBox.disabled = false;
        inputBox.placeholder = 'Message #' + channel.name + '...';
      }
    } else {
      if (inputBox) {
        inputBox.disabled = true;
        inputBox.placeholder = 'Only admins can post in this channel';
      }
    }

    _subscribeToChannelMessages(channelId);
  };

  window._closeChannel = function () {
    _closeChannel();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
