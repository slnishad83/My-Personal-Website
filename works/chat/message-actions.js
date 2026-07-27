/* message-actions.js — Universal message actions: download, delete, forward, share for ALL message types */
(function () {
  'use strict';

  var _db = function () { return window.App && window.App.db ? window.App.db : null; };
  var _uid = function () { return window.App && window.App.auth && window.App.auth.currentUser ? window.App.auth.currentUser.uid : null; };
  var _esc = function (s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') : ''; };
  var _toast = function (msg, t) { if (typeof window.showToast === 'function') window.showToast(msg, t); };

  function _getMsgType(msg) {
    if (!msg) return 'unknown';
    if (msg.type) return msg.type;
    if (msg.attachment && msg.attachment.type) return msg.attachment.type;
    return 'text';
  }

  function _getMediaUrl(msg) {
    if (!msg) return '';
    if (msg.audioURL) return msg.audioURL;
    if (msg.imageURL) return msg.imageURL;
    if (msg.videoURL) return msg.videoURL;
    if (msg.fileURL) return msg.fileURL;
    if (msg.stickerURL) return msg.stickerURL;
    if (msg.url) return msg.url;
    if (msg.attachment && msg.attachment.url) return msg.attachment.url;
    if (msg.attachment && msg.attachment.downloadURL) return msg.attachment.downloadURL;
    return '';
  }

  function _getFileName(msg) {
    if (!msg) return 'download';
    if (msg.fileName) return msg.fileName;
    if (msg.attachment && msg.attachment.fileName) return msg.attachment.fileName;
    var type = _getMsgType(msg);
    var ext = 'dat';
    if (type === 'image') ext = 'jpg';
    else if (type === 'video') ext = 'mp4';
    else if (type === 'audio' || type === 'voice') ext = 'ogg';
    else if (type === 'sticker') ext = 'webp';
    else if (type === 'videoNote') ext = 'webm';
    return (type || 'file') + '-' + Date.now() + '.' + ext;
  }

  async function downloadMedia(msg) {
    var url = _getMediaUrl(msg);
    if (!url) { _toast('No media to download', 'error'); return; }
    var fileName = _getFileName(msg);
    _toast('Downloading…', 'info');
    try {
      var response = await fetch(url);
      var blob = await response.blob();
      var blobUrl = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(blobUrl);
        a.remove();
      }, 100);
      _toast('Downloaded', 'success');
    } catch (err) {
      console.error('Download error:', err);
      window.open(url, '_blank');
      _toast('Opening in new tab', 'info');
    }
  }

  async function downloadMediaNative(msg) {
    var url = _getMediaUrl(msg);
    if (!url) { _toast('No media to download', 'error'); return; }
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
      try {
        var response = await fetch(url);
        var blob = await response.blob();
        var reader = new FileReader();
        reader.onload = async function () {
          var base64 = reader.result.split(',')[1];
          var fileName = _getFileName(msg);
          var _result = await window.Capacitor.Plugins.Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: window.Capacitor.Plugins.Filesystem.Directory.Downloads
          });
          _toast('Saved to Downloads', 'success');
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        _toast('Download failed', 'error');
      }
    } else {
      downloadMedia(msg);
    }
  }

  function _deleteMessage(msgId, scope) {
    var db = _db();
    var chat = window.App && window.App.currentChat ? window.App.currentChat : null;
    if (!db || !chat || !msgId) { _toast('Cannot delete message', 'error'); return; }
    var msgRef = db.collection('messages').doc(chat.id).collection('items').doc(msgId);
    if (scope === 'everyone') {
      msgRef.get().then(function(doc) {
        var msgData = doc.exists ? doc.data() : {};
        var mediaUrls = [msgData.imageURL, msgData.videoURL, msgData.audioURL, msgData.fileURL, msgData.stickerURL].filter(function(u) { return u && typeof u === 'string' && u.startsWith('http'); });
        msgRef.update({
          text: 'This message was deleted',
          type: 'deleted',
          deletedBy: 'everyone',
          deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
          imageURL: firebase.firestore.FieldValue.delete(),
          videoURL: firebase.firestore.FieldValue.delete(),
          audioURL: firebase.firestore.FieldValue.delete(),
          fileURL: firebase.firestore.FieldValue.delete(),
          stickerURL: firebase.firestore.FieldValue.delete(),
          attachment: firebase.firestore.FieldValue.delete()
        }).then(function () {
          mediaUrls.forEach(function(url) {
            try { firebase.storage().refFromURL(url).delete(); } catch(_e) {}
          });
          _toast('Message deleted', 'success');
        }).catch(function (err) {
          _toast('Delete failed: ' + err.message, 'error');
        });
      }).catch(function() {
        msgRef.update({
          text: 'This message was deleted',
          type: 'deleted',
          deletedBy: 'everyone',
          deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
          imageURL: firebase.firestore.FieldValue.delete(),
          videoURL: firebase.firestore.FieldValue.delete(),
          audioURL: firebase.firestore.FieldValue.delete(),
          fileURL: firebase.firestore.FieldValue.delete(),
          stickerURL: firebase.firestore.FieldValue.delete(),
          attachment: firebase.firestore.FieldValue.delete()
        }).then(function () {
          _toast('Message deleted', 'success');
        }).catch(function (err) {
          _toast('Delete failed: ' + err.message, 'error');
        });
      });
    } else {
      msgRef.delete().then(function () {
        _toast('Message deleted', 'success');
      }).catch(function (err) {
        _toast('Delete failed: ' + err.message, 'error');
      });
    }
  }

  function _canRecall(msg) {
    if (!msg) return false;
    var myUid = _uid();
    if (msg.from !== myUid && msg.senderId !== myUid) return false;
    var msgTime = 0;
    if (msg.timestamp && msg.timestamp.toMillis) msgTime = msg.timestamp.toMillis();
    else if (msg.time) msgTime = msg.time;
    else if (msg.createdAt) msgTime = msg.createdAt;
    if (!msgTime) return false;
    var sevenDays = 7 * 24 * 60 * 60 * 1000;
    return (Date.now() - msgTime) < sevenDays;
  }

  function _getReplyPreview(msg) {
    if (!msg) return '';
    var type = _getMsgType(msg);
    var _name = msg.fromName || msg.senderName || msg.senderEmail || '';
    var preview;
    switch (type) {
      case 'text': preview = msg.text || ''; break;
      case 'image': preview = '📷 Image'; if (msg.text) preview += ' · ' + msg.text; break;
      case 'video': preview = '🎬 Video'; if (msg.text) preview += ' · ' + msg.text; break;
      case 'voice': preview = '🎤 Voice message (' + (msg.audioDuration || '?') + 's)'; break;
      case 'audio': preview = '🎵 Audio'; break;
      case 'doc': preview = '📄 ' + (msg.fileName || 'Document'); break;
      case 'sticker': preview = '🖼️ Sticker'; break;
      case 'videoNote': preview = '🎥 Video note'; break;
      case 'location':
        var loc = msg.location || msg;
        preview = '📍 Location' + (loc.latitude ? ' (' + loc.latitude.toFixed(4) + ', ' + loc.longitude.toFixed(4) + ')' : '');
        break;
      case 'contact': preview = '👤 ' + (msg.contactName || msg.contact?.name || 'Contact'); break;
      case 'poll': preview = '📊 ' + (msg.pollQuestion || msg.question || 'Poll'); break;
      default: preview = msg.text || 'Message'; break;
    }
    if (preview.length > 80) preview = preview.substring(0, 77) + '…';
    return preview;
  }

  function _getDeleteMenuHtml(msgId, msg, _isOwn) {
    var canRecall = _canRecall(msg);
    var html = '<div id="msg-delete-menu" class="fixed inset-0 z-50 flex items-end justify-center">' +
      '<div class="absolute inset-0 bg-black/40" onclick="document.getElementById(\'msg-delete-menu\').remove()"></div>' +
      '<div class="relative bg-surface rounded-t-2xl w-full max-w-md p-4 pb-8 z-10 animate-slide-up">' +
      '<h3 class="text-on-surface font-bold text-base mb-4">Delete message?</h3>' +
      '<button class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.deleteForMe(\'' + _esc(msgId) + '\');document.getElementById(\'msg-delete-menu\').remove()">' +
      '<span class="material-symbols-outlined">delete</span><span class="font-medium text-sm">Delete for me</span>' +
      '</button>';
    if (canRecall) {
      html += '<button class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant/50 transition-colors text-red-500" onclick="window._MsgActions.deleteForEveryone(\'' + _esc(msgId) + '\');document.getElementById(\'msg-delete-menu\').remove()">' +
        '<span class="material-symbols-outlined">delete_sweep</span><span class="font-medium text-sm">Delete for everyone</span>' +
        '</button>';
    }
    html += '<button class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface-variant" onclick="document.getElementById(\'msg-delete-menu\').remove()">' +
      '<span class="material-symbols-outlined">close</span><span class="font-medium text-sm">Cancel</span>' +
      '</button></div></div>';
    return html;
  }

  function _showDownloadMenu(msgId, msg) {
    var existing = document.getElementById('msg-download-menu');
    if (existing) existing.remove();
    var type = _getMsgType(msg);
    var html = '<div id="msg-download-menu" class="fixed inset-0 z-50 flex items-end justify-center">' +
      '<div class="absolute inset-0 bg-black/40" onclick="document.getElementById(\'msg-download-menu\').remove()"></div>' +
      '<div class="relative bg-surface rounded-t-2xl w-full max-w-md p-4 pb-8 z-10 animate-slide-up">' +
      '<h3 class="text-on-surface font-bold text-base mb-4">Save ' + type.charAt(0).toUpperCase() + type.slice(1) + '</h3>' +
      '<button class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.download(\'' + _esc(msgId) + '\');document.getElementById(\'msg-download-menu\').remove()">' +
      '<span class="material-symbols-outlined">download</span><span class="font-medium text-sm">Download</span>' +
      '</button>' +
      '<button class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="document.getElementById(\'msg-download-menu\').remove()">' +
      '<span class="material-symbols-outlined">close</span><span class="font-medium text-sm">Cancel</span>' +
      '</button></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function _showShareLocation(msg) {
    var lat = msg.latitude || (msg.location && msg.location.latitude);
    var lng = msg.longitude || (msg.location && msg.location.longitude);
    if (!lat || !lng) { _toast('No location data', 'error'); return; }
    var url = 'https://www.google.com/maps?q=' + lat + ',' + lng;
    if (navigator.share) {
      navigator.share({ title: 'Location', url: url }).catch(function () {});
    } else {
      window.open(url, '_blank');
    }
  }

  function _addContact(msg) {
    var name = msg.contactName || (msg.contact && msg.contact.name) || '';
    var phone = msg.contactPhone || (msg.contact && msg.contact.phone) || '';
    var email = msg.contactEmail || (msg.contact && msg.contact.email) || '';
    if (navigator.share) {
      var vcard = 'BEGIN:VCARD\nVERSION:3.0\nFN:' + name + '\nTEL:' + phone + '\nEMAIL:' + email + '\nEND:VCARD';
      var blob = new Blob([vcard], { type: 'text/vcard' });
      var file = new File([blob], name + '.vcf', { type: 'text/vcard' });
      navigator.share({ files: [file], title: name }).catch(function () {});
    } else {
      var tel = phone ? 'tel:' + phone : '';
      if (tel) window.location.href = tel;
      else _toast('No phone number', 'info');
    }
  }

  function patchReplyToMsg() {
    if (window._originalReplyToMsg) return;
    var orig = window.replyToMsg;
    if (typeof orig !== 'function') return;
    window._originalReplyToMsg = orig;
    window.replyToMsg = function (msgId) {
      var db = _db();
      var chat = window.App && window.App.currentChat ? window.App.currentChat : null;
      if (!db || !chat || !msgId) return orig(msgId);
      db.collection('messages').doc(chat.id).collection('items').doc(msgId).get().then(function (doc) {
        if (!doc.exists) return orig(msgId);
        var msg = doc.data();
        msg.id = doc.id;
        var preview = _getReplyPreview(msg);
        var name = msg.fromName || msg.senderName || '';
        var bar = document.getElementById('reply-preview');
        if (bar) {
          bar.classList.remove('hidden');
          var rpName = document.getElementById('reply-name');
          var rpText = document.getElementById('reply-text');
          if (rpName) rpName.textContent = name || 'Reply';
          if (rpText) rpText.textContent = preview;
          bar.dataset.replyTo = msgId;
        }
      }).catch(function () { orig(msgId); });
    };
  }

  function patchDeleteMenu() {
    if (window._origOpenDeleteMenu) return;
    var orig = window.openDeleteMenu;
    if (typeof orig === 'function') window._origOpenDeleteMenu = orig;
    window.openDeleteMenu = function (msgId) {
      var db = _db();
      var chat = window.App && window.App.currentChat ? window.App.currentChat : null;
      if (!db || !chat || !msgId) { if (orig) orig(msgId); return; }
      db.collection('messages').doc(chat.id).collection('items').doc(msgId).get().then(function (doc) {
        if (!doc.exists) { if (orig) orig(msgId); return; }
        var msg = doc.data();
        msg.id = doc.id;
        var myUid = _uid();
        var isOwn = msg.from === myUid || msg.senderId === myUid;
        var html = _getDeleteMenuHtml(msgId, msg, isOwn);
        document.body.insertAdjacentHTML('beforeend', html);
      }).catch(function () { if (orig) orig(msgId); });
    };
  }

  function patchDesktopContextMenu() {
    if (window._ctxMenuPatched) return;
    document.addEventListener('contextmenu', function (e) {
      var msgEl = e.target.closest('[data-message-id]');
      if (!msgEl) return;
      var msgId = msgEl.getAttribute('data-message-id');
      if (!msgId) return;
      var existing = document.getElementById('msg-ctx-menu');
      if (existing) existing.remove();
      var chat = window.App && window.App.currentChat ? window.App.currentChat : null;
      if (!chat) return;
      var db = _db();
      if (!db) return;
      db.collection('messages').doc(chat.id).collection('items').doc(msgId).get().then(function (doc) {
        if (!doc.exists) return;
        var msg = doc.data();
        msg.id = doc.id;
        var type = _getMsgType(msg);
        var myUid = _uid();
        var _isOwn = msg.from === myUid || msg.senderId === myUid;
        var hasMedia = !!_getMediaUrl(msg);
        var __canRecall = _canRecall(msg);
        var html = '<div id="msg-ctx-menu" class="fixed inset-0 z-50 flex items-center justify-center">' +
          '<div class="absolute inset-0 bg-black/40" onclick="document.getElementById(\'msg-ctx-menu\').remove()"></div>' +
          '<div class="relative bg-surface rounded-2xl w-full max-w-xs p-2 shadow-2xl z-10">';
        html += '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.reply(\'' + _esc(msgId) + '\');document.getElementById(\'msg-ctx-menu\').remove()"><span class="material-symbols-outlined text-lg">reply</span><span class="text-sm">Reply</span></button>';
        var _chat = window.App && window.App.currentChat ? window.App.currentChat : null;
        var _isGroup = _chat && (_chat.type === 'group' || _chat.isGroup);
        var _senderName = msg.fromName || msg.senderName || 'Someone';
        var _senderId = msg.from || msg.senderId;
        var _myUid = _uid();
        if (_isGroup && _senderId && _senderId !== _myUid) {
          html += '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.replyPrivately(\'' + _esc(msgId) + '\');document.getElementById(\'msg-ctx-menu\').remove()"><span class="material-symbols-outlined text-lg">forward</span><span class="text-sm">Reply Privately</span></button>';
          html += '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.messagePerson(\'' + _esc(msgId) + '\');document.getElementById(\'msg-ctx-menu\').remove()"><span class="material-symbols-outlined text-lg">chat</span><span class="text-sm">Message ' + _esc(_senderName) + '</span></button>';
        }
        if (hasMedia) {
          html += '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.forward(\'' + _esc(msgId) + '\');document.getElementById(\'msg-ctx-menu\').remove()"><span class="material-symbols-outlined text-lg">forward</span><span class="text-sm">Forward</span></button>';
        } else {
          html += '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.forward(\'' + _esc(msgId) + '\');document.getElementById(\'msg-ctx-menu\').remove()"><span class="material-symbols-outlined text-lg">forward</span><span class="text-sm">Forward</span></button>';
        }
        html += '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.copy(\'' + _esc(msgId) + '\');document.getElementById(\'msg-ctx-menu\').remove()"><span class="material-symbols-outlined text-lg">content_copy</span><span class="text-sm">Copy</span></button>';
        if (hasMedia) {
          html += '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.download(\'' + _esc(msgId) + '\');document.getElementById(\'msg-ctx-menu\').remove()"><span class="material-symbols-outlined text-lg">download</span><span class="text-sm">Download</span></button>';
        }
        html += '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.star(\'' + _esc(msgId) + '\');document.getElementById(\'msg-ctx-menu\').remove()"><span class="material-symbols-outlined text-lg">star</span><span class="text-sm">Star</span></button>';
        html += '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.info(\'' + _esc(msgId) + '\');document.getElementById(\'msg-ctx-menu\').remove()"><span class="material-symbols-outlined text-lg">info</span><span class="text-sm">Info</span></button>';
        if (type === 'location') {
          html += '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.shareLocation(\'' + _esc(msgId) + '\');document.getElementById(\'msg-ctx-menu\').remove()"><span class="material-symbols-outlined text-lg">share</span><span class="text-sm">Share location</span></button>';
        }
        if (type === 'contact') {
          html += '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-on-surface" onclick="window._MsgActions.addContact(\'' + _esc(msgId) + '\');document.getElementById(\'msg-ctx-menu\').remove()"><span class="material-symbols-outlined text-lg">person_add</span><span class="text-sm">Add contact</span></button>';
        }
        html += '<button class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-variant/50 transition-colors text-red-500" onclick="window._MsgActions.delete(\'' + _esc(msgId) + '\');document.getElementById(\'msg-ctx-menu\').remove()"><span class="material-symbols-outlined text-lg">delete</span><span class="text-sm">Delete</span></button>';
        html += '</div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
      });
    }, true);
    window._ctxMenuPatched = true;
  }

  function patchMessageRendering() {
    if (window._msgRenderPatched) return;
    var orig = window.renderSingleMessageHTML;
    if (typeof orig !== 'function') return;
    window._originalRenderSingleMessageHTML = orig;
    window.renderSingleMessageHTML = function (msg) {
      var html = orig(msg);
      if (!html) return html;
      var type = _getMsgType(msg);
      if (type === 'audio' && !html.includes('vm-player')) {
        var url = _getMediaUrl(msg);
        if (url) {
          var audioHtml = '<div class="mt-1" data-voice-msg="' + _esc(msg.id || '') + '">' +
            '<audio preload="metadata" src="' + _esc(url) + '"></audio>' +
            '<div class="vm-player" data-vm-id="vm-' + _esc(msg.id || '') + '" data-vm-url="' + _esc(url) + '" data-vm-dur="' + (msg.audioDuration || 0) + '">' +
            '<button class="vm-play-btn" data-vm-play="' + _esc(msg.id || '') + '"><span class="material-symbols-outlined" style="font-size:22px">play_arrow</span></button>' +
            '<div class="vm-waveform-container"><div class="vm-info-row"><span class="vm-time">' + _formatDur(msg.audioDuration || 0) + '</span>' +
            '<button class="vm-speed-btn" data-vm-speed="' + _esc(msg.id || '') + '">1x</button>' +
            '</div></div></div></div>';
          html = html.replace(/<\/div>\s*$/, audioHtml + '</div>');
        }
      }
      if (type === 'sticker') {
        var stickerUrl = _getMediaUrl(msg) || msg.text;
        if (stickerUrl && (stickerUrl.startsWith('http') || stickerUrl.startsWith('data:'))) {
          html = html.replace(/<p[^>]*>[^<]*<\/p>/, '<img src="' + _esc(stickerUrl) + '" class="max-w-[160px] max-h-[160px] object-contain" alt="Sticker" loading="lazy">');
        }
      }
      return html;
    };
    window._msgRenderPatched = true;
  }

  function _formatDur(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function patchVoiceDownload() {
    if (window._voiceDlPatched) return;
    document.addEventListener('click', function (e) {
      var dlBtn = e.target.closest('[data-action="downloadVoice"], [data-action="download-voice"]');
      if (!dlBtn) return;
      e.preventDefault();
      e.stopPropagation();
      var container = dlBtn.closest('[data-vm-id], [data-voice-msg]');
      if (!container) return;
      var url = container.getAttribute('data-vm-url');
      if (!url) {
        var audio = container.querySelector('audio');
        if (audio) url = audio.src;
      }
      if (!url) return;
      var a = document.createElement('a');
      a.href = url;
      a.download = 'voice-' + Date.now() + '.ogg';
      a.click();
      _toast('Downloading voice message', 'success');
    }, true);
    window._voiceDlPatched = true;
  }

  function patchVideoNoteDownload() {
    if (window._vnDlPatched) return;
    document.addEventListener('click', function (e) {
      var vnEl = e.target.closest('.vn-circle-wrap, [data-vn-msg-id]');
      if (!vnEl) return;
      if (e.target.closest('.vn-play-overlay, .vn-progress-ring')) return;
      var msgId = vnEl.getAttribute('data-vn-msg-id');
      if (!msgId) return;
      var video = vnEl.querySelector('video');
      if (!video || !video.src) return;
      var a = document.createElement('a');
      a.href = video.src;
      a.download = 'video-note-' + Date.now() + '.webm';
      a.click();
      _toast('Downloading video note', 'success');
    }, true);
    window._vnDlPatched = true;
  }

  window._MsgActions = {
    download: function (msgId) {
      var chat = window.App && window.App.currentChat ? window.App.currentChat : null;
      if (!chat || !_db()) return;
      _db().collection('messages').doc(chat.id).collection('items').doc(msgId).get().then(function (doc) {
        if (!doc.exists) return;
        var msg = doc.data();
        msg.id = doc.id;
        downloadMediaNative(msg);
      });
    },
    delete: function (msgId) {
      var chat = window.App && window.App.currentChat ? window.App.currentChat : null;
      if (!chat || !_db()) return;
      _db().collection('messages').doc(chat.id).collection('items').doc(msgId).get().then(function (doc) {
        if (!doc.exists) return;
        var msg = doc.data();
        msg.id = doc.id;
        var myUid = _uid();
        var isOwn = msg.from === myUid || msg.senderId === myUid;
        var html = _getDeleteMenuHtml(msgId, msg, isOwn);
        document.body.insertAdjacentHTML('beforeend', html);
      });
    },
    deleteForMe: function (msgId) { _deleteMessage(msgId, 'me'); },
    deleteForEveryone: function (msgId) { _deleteMessage(msgId, 'everyone'); },
    forward: function (msgId) {
      if (typeof window.openForwardModal === 'function') window.openForwardModal(msgId);
    },
    reply: function (msgId) {
      if (typeof window.replyToMsg === 'function') window.replyToMsg(msgId);
    },
    replyPrivately: function (msgId) {
      var chat = window.App && window.App.currentChat ? window.App.currentChat : null;
      if (!chat || !_db()) return;
      _db().collection('messages').doc(chat.id).collection('items').doc(msgId).get().then(function (doc) {
        if (!doc.exists) return;
        var msg = doc.data();
        msg.id = doc.id;
        if (typeof window.ReplyPrivate !== 'undefined') {
          window.ReplyPrivate.replyPrivately(msg, chat.id);
        }
      });
    },
    messagePerson: function (msgId) {
      var chat = window.App && window.App.currentChat ? window.App.currentChat : null;
      if (!chat || !_db()) return;
      _db().collection('messages').doc(chat.id).collection('items').doc(msgId).get().then(function (doc) {
        if (!doc.exists) return;
        var msg = doc.data();
        msg.id = doc.id;
        if (typeof window.ReplyPrivate !== 'undefined') {
          window.ReplyPrivate.messagePerson(msg, chat.id);
        }
      });
    },
    copy: function (msgId) {
      if (window.MessageCopy && typeof window.MessageCopy.copy === 'function') {
        window.MessageCopy.copy(msgId);
      } else if (typeof window.copyMsgText === 'function') {
        window.copyMsgText(msgId);
      }
    },
    star: function (msgId) {
      if (typeof window.starMessage === 'function') window.starMessage(msgId);
    },
    pin: function (msgId) {
      var chat = window.App && window.App.currentChat ? window.App.currentChat : null;
      if (!chat || !_db()) return;
      _db().collection('messages').doc(chat.id).collection('items').doc(msgId).get().then(function (doc) {
        if (!doc.exists) return;
        var msg = doc.data();
        var isPinned = msg.isPinned;
        _db().collection('messages').doc(chat.id).collection('items').doc(msgId).update({ isPinned: !isPinned }).then(function () {
          _toast(isPinned ? 'Message unpinned' : 'Message pinned', 'success');
          if (!isPinned && typeof window.PinnedHeader === 'object' && typeof window.PinnedHeader.show === 'function') {
            window.PinnedHeader.show(chat.id);
          }
        });
      });
    },
    info: function (msgId) {
      if (typeof window.openMsgInfo === 'function') window.openMsgInfo(msgId);
      else if (typeof window.showMessageInfo === 'function') window.showMessageInfo(msgId);
      else {
        var chat = window.App && window.App.currentChat ? window.App.currentChat : null;
        if (!chat || !_db()) return;
        _db().collection('messages').doc(chat.id).collection('items').doc(msgId).get().then(function (doc) {
          if (!doc.exists) return;
          var msg = doc.data();
          var html = '<div id="msg-info-panel" class="fixed inset-0 z-50 flex items-end justify-center">' +
            '<div class="absolute inset-0 bg-black/40" onclick="document.getElementById(\'msg-info-panel\').remove()"></div>' +
            '<div class="relative bg-surface rounded-t-2xl w-full max-w-md p-4 pb-8 z-10 animate-slide-up">' +
            '<h3 class="text-on-surface font-bold text-base mb-4">Message Info</h3>' +
            '<div class="space-y-3 text-sm">' +
            '<div class="flex justify-between"><span class="text-on-surface-variant">From</span><span class="text-on-surface">' + _esc(msg.fromName || msg.senderName || 'Unknown') + '</span></div>' +
            '<div class="flex justify-between"><span class="text-on-surface-variant">Sent</span><span class="text-on-surface">' + (msg.timestamp ? new Date(msg.timestamp.toMillis ? msg.timestamp.toMillis() : msg.timestamp).toLocaleString() : 'Unknown') + '</span></div>' +
            (msg.readBy ? '<div class="flex justify-between"><span class="text-on-surface-variant">Read by</span><span class="text-on-surface">' + Object.keys(msg.readBy).length + '</span></div>' : '') +
            '</div>' +
            '<button class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl mt-4 bg-surface-variant text-on-surface" onclick="document.getElementById(\'msg-info-panel\').remove()">' +
            '<span class="material-symbols-outlined">close</span><span class="font-medium text-sm">Close</span></button>' +
            '</div></div>';
          document.body.insertAdjacentHTML('beforeend', html);
        });
      }
    },
    shareLocation: function (msgId) {
      var chat = window.App && window.App.currentChat ? window.App.currentChat : null;
      if (!chat || !_db()) return;
      _db().collection('messages').doc(chat.id).collection('items').doc(msgId).get().then(function (doc) {
        if (!doc.exists) return;
        _showShareLocation(doc.data());
      });
    },
    addContact: function (msgId) {
      var chat = window.App && window.App.currentChat ? window.App.currentChat : null;
      if (!chat || !_db()) return;
      _db().collection('messages').doc(chat.id).collection('items').doc(msgId).get().then(function (doc) {
        if (!doc.exists) return;
        _addContact(doc.data());
      });
    }
  };

  function init() {
    patchReplyToMsg();
    patchDeleteMenu();
    patchDesktopContextMenu();
    patchMessageRendering();
    patchVoiceDownload();
    patchVideoNoteDownload();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 0); });
  }

  window.downloadMedia = downloadMedia;
  window.downloadMediaNative = downloadMediaNative;

})();
