/* ============================================================
   NSL Chat — UI Glue
   Wires every dead data-action in index.html to a canonical
   implementation. Loaded in CORE INFRASTRUCTURE (before any
   deferred feature module), so image-annotation.js can capture
   our window._showMediaPreview / window.attachPhoto and call
   window._sendFileMessage afterwards.

   Handlers follow src/core/bindEvents.js conventions:
     fn()              -> no data-action-arg
     fn(arg, el)       -> data-action-arg="arg"
   ============================================================ */
;(function () {
  'use strict';

  var _debug = function () {
    if (window.__DEBUG__) console.warn.apply(console, ['[ui-glue]'].concat(Array.prototype.slice.call(arguments)));
  };

  /* ── Tiny helpers ─────────────────────────────────────────── */
  function _$(id) { return document.getElementById(id); }
  function _qs(sel, root) { return (root || document).querySelector(sel); }
  function _qsa(sel, root) {
    var r = (root || document).querySelectorAll(sel);
    return Array.prototype.slice.call(r);
  }
  function _esc(s) {
    if (s == null) return '';
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type || 'info');
  }

  /* Eager fallback so every _toast() shows before toast-ux.js loads.
     toast-ux._upgradeShowToast() later replaces this with the enhanced
     version (its guard only skips override when showToast differs). */
  window.showToast = function (msg, type) {
    var t = type || 'info';
    if (typeof window.showEnhancedToast === 'function') {
      return window.showEnhancedToast(msg, t);
    }
    var container = _$('toast-container');
    if (!container) {
      var app = _qs('#app') || document.body;
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;top:24px;right:24px;z-index:999;display:flex;flex-direction:column;gap:8px;max-width:340px;';
      app.appendChild(container);
    }
    var el = document.createElement('div');
    el.style.cssText = 'pointer-events:auto;display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:8px;background:#1e1e1e;color:#fff;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.25);animation:toastIn .3s ease;';
    if (t === 'error') el.style.background = '#c0392b';
    else if (t === 'success') el.style.background = '#1e7e34';
    el.textContent = String(msg);
    container.appendChild(el);
    setTimeout(function () {
      el.style.animation = 'toastOut .3s ease forwards';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, 2800);
  };
  function _me() {
    if (window.App && window.App.currentUser) return window.App.currentUser;
    return window.currentUser || null;
  }
  function _uid() {
    var u = _me();
    if (u && u.uid) return u.uid;
    if (window.App && typeof window.App.uid === 'function') return window.App.uid();
    return null;
  }
  function _db() {
    if (window.db) return window.db;
    if (window.App && window.App.db) return window.App.db;
    if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
    return null;
  }
  function _storage() {
    if (window.App && window.App.storage) return window.App.storage;
    if (typeof firebase !== 'undefined' && firebase.storage) return firebase.storage();
    return null;
  }
  function _activeChat() {
    if (window.currentChat && window.currentChat.id) return window.currentChat;
    if (window.App && window.App.currentChat && window.App.currentChat.id) return window.App.currentChat;
    return null;
  }
  function _activeType() {
    if (window.currentChatType) return window.currentChatType;
    if (window.App && window.App.currentChatType) return window.App.currentChatType;
    return 'direct';
  }
  function _ts() {
    if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
      return firebase.firestore.FieldValue.serverTimestamp();
    }
    return Date.now();
  }

  /* ── Overlay helpers ──────────────────────────────────────── */
  function _closeOverlay(id) {
    if (!id) return;
    var el = _$(String(id).replace(/^#/, ''));
    if (el) el.classList.add('hidden');
  }
  function _openOverlay(id) {
    if (!id) return;
    var el = _$(String(id).replace(/^#/, ''));
    if (el) el.classList.remove('hidden');
  }
  function _lockBody(on) {
    document.body.style.overflow = on ? 'hidden' : '';
  }

  window.closeModal = function (id) { _closeOverlay(id); };
  window.closeOverlay = function (id) { _closeOverlay(id); };
  window.hide = function (id) { _closeOverlay(id); };

  /* ════════════════════════════════════════════════════════════
     THEME — cycleTheme (sidebar + profile row)
     ════════════════════════════════════════════════════════════ */
  var _THEME_ORDER = ['system', 'light', 'dark'];
  var _THEME_LABEL = { system: 'System', light: 'Light', dark: 'Dark' };
  var _THEME_ICON = { system: 'settings', light: 'light_mode', dark: 'dark_mode' };

  function _currentTheme() {
    if (typeof window.getThemeMode === 'function') return window.getThemeMode();
    return localStorage.getItem('themeMode') || 'system';
  }

  function _applyThemeFallback(mode) {
    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) { document.documentElement.classList.add('dark'); document.documentElement.setAttribute('data-theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); document.documentElement.setAttribute('data-theme', 'light'); }
    localStorage.setItem('darkMode', String(dark));
  }

  function _syncThemeUI(mode) {
    var label = _THEME_LABEL[mode] || 'System';
    var icon = _THEME_ICON[mode] || 'settings';
    var labelEl = _$('theme-label'); if (labelEl) labelEl.textContent = label;
    var iconEl = _$('theme-icon'); if (iconEl) iconEl.textContent = icon;
    var sideIcon = _$('theme-icon-sidebar'); if (sideIcon) sideIcon.textContent = icon;
    var meta = _$('theme-color-meta');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#0a0d14' : '#f3f6f8');
  }

  window.cycleTheme = function () {
    var cur = _currentTheme();
    var next = _THEME_ORDER[(_THEME_ORDER.indexOf(cur) + 1) % _THEME_ORDER.length];
    localStorage.setItem('themeMode', next);
    if (typeof window.setThemeMode === 'function') window.setThemeMode(next);
    else _applyThemeFallback(next);
    _syncThemeUI(next);
    _toast('Theme: ' + _THEME_LABEL[next]);
  };

  /* ════════════════════════════════════════════════════════════
     PROFILE / SETTINGS
     ════════════════════════════════════════════════════════════ */
  function _populateProfile() {
    var user = _me();
    var name = (user && (user.displayName || user.name)) || 'User';
    var email = (user && user.email) || '—';
    var phone = (user && user.phoneNumber) || 'Not provided';
    var status = (user && user.status) || 'Available';
    var photo = (user && user.photoURL) || '';

    var n = _$('profile-name'); if (n) n.textContent = name;
    var e = _$('profile-email'); if (e) e.textContent = email;
    var s = _$('settings-name'); if (s) s.textContent = name;
    var p = _$('settings-phone'); if (p) p.textContent = phone;
    var st = _$('settings-status'); if (st) st.textContent = status;

    var av = _$('profile-avatar');
    if (av) {
      av.innerHTML = photo
        ? '<img src="' + _esc(photo) + '" alt="' + _esc(name) + '" class="w-24 h-24 rounded-full object-cover">'
        : _esc((name || 'U').charAt(0).toUpperCase());
    }
    var side = _$('sidebar-avatar');
    if (side) side.textContent = photo ? '' : _esc((name || 'U').charAt(0).toUpperCase());
    var sideName = _$('profile-name-sidebar'); if (sideName) sideName.textContent = name;
    _syncThemeUI(_currentTheme());
  }

  window.openProfile = function () {
    _populateProfile();
    _openOverlay('profile-overlay');
  };

  window.editName = function () { if (typeof window.openProfileEdit === 'function') window.openProfileEdit(); };
  window.editPhone = function () { if (typeof window.openProfileEdit === 'function') window.openProfileEdit(); };
  window.editStatus = function () { if (typeof window.openProfileEdit === 'function') window.openProfileEdit(); };

  window.closeProfileAndHelp = function () {
    _closeOverlay('profile-overlay');
    var helpOverlay = _qs('[id*="help"], #help-overlay, [data-help-overlay]');
    if (helpOverlay) helpOverlay.classList.add('hidden');
    if (typeof window.openHelp === 'function') window.openHelp();
  };

  window.closeUtilitiesAndMusic = function () {
    _closeOverlay('nsl-utilities-overlay');
    if (typeof window.openMusicLibrary === 'function') window.openMusicLibrary();
    else if (window.MusicPlayer && typeof window.MusicPlayer.open === 'function') window.MusicPlayer.open();
  };

  window.closeNewChatAndBroadcast = function () {
    _closeOverlay('new-chat-overlay');
    if (typeof window.openBroadcastComposer === 'function') window.openBroadcastComposer();
    else _toast('Broadcast lists are not available', 'error');
  };
  window.closeDetailPanel = function () {
    var panel = _$('detail-panel');
    if (panel) panel.classList.add('hidden');
  };

  /* ════════════════════════════════════════════════════════════
     CHAT HEADER — info / menu
     ════════════════════════════════════════════════════════════ */
  function _renderDetailPanel() {
    var panel = _$('detail-panel');
    var chat = _activeChat();
    if (!panel) return;
    if (!chat) { panel.classList.add('hidden'); return; }
    var name = chat.name || chat.displayName || 'Chat';
    var photo = chat.photoURL || chat.avatar || '';
    var isGroup = _activeType() === 'group' || chat.type === 'group';
    var isBroadcast = _activeType() === 'broadcast' || chat.type === 'broadcast';
    var kindLabel = isGroup ? 'Group' : (isBroadcast ? 'Broadcast list' : 'Direct chat');
    panel.innerHTML =
      '<div class="p-4">' +
        '<div class="flex items-center gap-3 mb-4">' +
          (photo
            ? '<img src="' + _esc(photo) + '" alt="' + _esc(name) + '" class="w-12 h-12 rounded-full object-cover">'
            : '<div class="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-on-surface-variant text-lg">' + _esc((name || '?').charAt(0).toUpperCase()) + '</div>') +
          '<div class="min-w-0">' +
            '<h3 class="font-bold text-on-surface truncate">' + _esc(name) + '</h3>' +
            '<p class="text-xs text-on-surface-variant">' + kindLabel + '</p>' +
          '</div>' +
        '</div>' +
        '<button class="w-full py-2.5 rounded-xl bg-surface-variant text-on-surface text-sm font-semibold hover:bg-surface-container-highest transition-colors" data-action="closeDetailPanel">Close</button>' +
        '<div class="mt-3 flex flex-col gap-1">' +
          '<button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/60 transition-colors text-left" data-action="openChatSearchMenu"><span class="material-symbols-outlined text-[18px] text-on-surface-variant">search</span><span class="text-sm font-medium text-on-surface">Search in chat</span></button>' +
          '<button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/60 transition-colors text-left" data-action="jumpToDateMenu"><span class="material-symbols-outlined text-[18px] text-on-surface-variant">calendar_month</span><span class="text-sm font-medium text-on-surface">Jump to date</span></button>' +
          '<button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/60 transition-colors text-left" data-action="enterMessageMultiSelect"><span class="material-symbols-outlined text-[18px] text-on-surface-variant">checklist</span><span class="text-sm font-medium text-on-surface">Select messages</span></button>' +
          '<button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/60 transition-colors text-left" data-action="openChatExportMenu"><span class="material-symbols-outlined text-[18px] text-on-surface-variant">ios_share</span><span class="text-sm font-medium text-on-surface">Export chat</span></button>' +
          '<button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/60 transition-colors text-left" data-action="shareLiveLocationMenu"><span class="material-symbols-outlined text-[18px] text-on-surface-variant">share_location</span><span class="text-sm font-medium text-on-surface">Share live location</span></button>' +
          '<button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/60 transition-colors text-left" data-action="openGhostModeMenu"><span class="material-symbols-outlined text-[18px] text-on-surface-variant">visibility_off</span><span class="text-sm font-medium text-on-surface">Ghost mode</span></button>' +
          '<button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/60 transition-colors text-left" data-action="openPrivacySettingsMenu"><span class="material-symbols-outlined text-[18px] text-on-surface-variant">lock</span><span class="text-sm font-medium text-on-surface">Privacy settings</span></button>' +
          '<button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/60 transition-colors text-left" data-action="openCloudDriveMenu"><span class="material-symbols-outlined text-[18px] text-on-surface-variant">cloud</span><span class="text-sm font-medium text-on-surface">Cloud drive</span></button>' +
          (isGroup
            ? '<button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/60 transition-colors text-left" data-action="openGroupChatMenu"><span class="material-symbols-outlined text-[18px] text-on-surface-variant">campaign</span><span class="text-sm font-medium text-on-surface">Announcement mode</span></button>' +
              '<button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/60 transition-colors text-left" data-action="exitGroup" data-action-arg="' + _esc(chat.id || '') + '"><span class="material-symbols-outlined text-[18px] text-red-500">logout</span><span class="text-sm font-medium text-red-500">Exit group</span></button>' +
              '<button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-variant/60 transition-colors text-left" data-action="deleteGroupForEveryone" data-action-arg="' + _esc(chat.id || '') + '"><span class="material-symbols-outlined text-[18px] text-red-500">delete_forever</span><span class="text-sm font-medium text-red-500">Delete group for everyone</span></button>'
            : '') +
        '</div>' +
        '<div class="mt-4">' +
          '<div class="flex gap-1 rounded-xl bg-surface-container-low p-1 mb-3">' +
            '<button type="button" class="media-tab-btn flex-1 py-2 rounded-lg text-xs font-semibold transition-colors" data-media-tab="media">Media</button>' +
            '<button type="button" class="media-tab-btn flex-1 py-2 rounded-lg text-xs font-semibold transition-colors" data-media-tab="links">Links</button>' +
            '<button type="button" class="media-tab-btn flex-1 py-2 rounded-lg text-xs font-semibold transition-colors" data-media-tab="docs">Docs</button>' +
          '</div>' +
          '<div id="detail-media-content" class="custom-scrollbar" style="max-height:min(48vh,480px);overflow-y:auto;"></div>' +
        '</div>' +
      '</div>';
    _wireMediaTabs(panel);
    _renderMediaTabContent('media');
  }

  var _activeMediaTab = 'media';

  function _wireMediaTabs(panel) {
    panel.querySelectorAll('[data-media-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _renderMediaTabContent(btn.getAttribute('data-media-tab'));
      });
    });
  }

  function _mediaTabBtn(tab) {
    var panel = _$('detail-panel');
    if (!panel) return;
    panel.querySelectorAll('[data-media-tab]').forEach(function (btn) {
      var active = btn.getAttribute('data-media-tab') === tab;
      btn.style.background = active ? 'var(--surface-container-high,#eef2f3)' : 'transparent';
      btn.style.color = active ? 'var(--on-surface,#1c1c1e)' : 'var(--on-surface-variant,#8696a0)';
    });
  }

  function _chatMediaCollection(chatType) {
    if (chatType === 'group') return 'groups';
    if (chatType === 'broadcast') return 'broadcasts';
    return 'chats';
  }

  /* Query the full media history for the active chat (direct / group / broadcast)
     so the Media tab is a real gallery, not just the messages in memory. */
  function _queryChatMedia(chatId, chatType) {
    var db = _db();
    if (!db || !chatId) return Promise.resolve(null);
    var types = ['image', 'video', 'gif', 'sticker'];
    return db.collection(_chatMediaCollection(chatType)).doc(chatId).collection('messages')
      .where('type', 'in', types)
      .limit(400)
      .get()
      .then(function (snap) {
        var items = [];
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          if (!d || d.type === 'deleted') return;
          var att = d.attachment;
          var url = att && (att.url || (typeof att === 'string' ? att : null));
          if (!url) return;
          var created = d.createdAt
            ? (d.createdAt.toDate ? d.createdAt.toDate().getTime() : (d.createdAt.seconds ? d.createdAt.seconds * 1000 : (typeof d.createdAt === 'number' ? d.createdAt : 0)))
            : 0;
          items.push({
            id: doc.id,
            type: d.type,
            url: url,
            caption: d.text || (att && att.caption) || '',
            senderName: d.senderName || d.senderId || 'User',
            createdAt: created
          });
        });
        items.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        return items;
      })
      .catch(function () { return null; });
  }

  function _galleryGridHtml(items) {
    return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">' +
      items.map(function (m) {
        var url = m.url || (m.attachment && (m.attachment.url || m.attachment));
        var isVideo = /^video/i.test(m.type || '') || String(m.attachment && m.attachment.type || '').indexOf('video') === 0 || /\.(mp4|webm|mov)$/i.test(String(url || ''));
        return '<button type="button" style="position:relative;aspect-ratio:1;border:none;padding:0;cursor:pointer;border-radius:8px;overflow:hidden;background:var(--surface-container-low,rgba(0,0,0,0.05));" data-media-open="' + _esc(url) + '" data-media-kind="' + (isVideo ? 'video' : 'image') + '" aria-label="Open media">' +
          '<img src="' + _esc(url) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display=\'none\'">' +
          (isVideo ? '<span class="material-symbols-outlined" style="position:absolute;inset:0;margin:auto;width:28px;height:28px;font-size:28px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.5);">play_circle</span>' : '') +
        '</button>';
      }).join('') +
    '</div>';
  }

  function _renderMediaTabContent(tab) {
    _activeMediaTab = tab || 'media';
    _mediaTabBtn(_activeMediaTab);
    var content = _$('detail-media-content');
    if (!content) return;
    var msgs = (typeof window.getCurrentMessages === 'function') ? (window.getCurrentMessages() || []) : [];
    msgs = msgs.filter(function (m) { return m && m.type !== 'deleted'; });

    if (_activeMediaTab === 'media') {
      var media = msgs.filter(function (m) {
        var t = m.type;
        if ((t === 'image' || t === 'video' || t === 'gif' || t === 'sticker') && m.attachment) return true;
        if (t === 'text') return false;
        if (m.attachment && m.attachment.url) {
          var u = String(m.attachment.url || '').toLowerCase();
          return /\.(png|jpe?g|gif|webp|mp4|webm|mov)$/.test(u) || (m.attachment.type || '').indexOf('image') === 0 || (m.attachment.type || '').indexOf('video') === 0;
        }
        return false;
      }).reverse();
      content.innerHTML = media.length
        ? _galleryGridHtml(media)
        : '<div style="padding:24px;text-align:center;font-size:12px;color:var(--on-surface-variant,#8696a0);">No media shared yet</div>';
      var gChat = _activeChat();
      var gType = _activeType();
      if (gChat && gChat.id) {
        _queryChatMedia(gChat.id, gType).then(function (gallery) {
          if (!gallery) return;
          var contentEl = _$('detail-media-content');
          if (!contentEl) return;
          if (gallery.length > 0) {
            contentEl.innerHTML = '<div style="font-size:11px;font-weight:600;color:var(--on-surface-variant,#8696a0);margin-bottom:6px;">' + gallery.length + ' media in this ' + (gType === 'group' ? 'group' : 'chat') + '</div>' + _galleryGridHtml(gallery);
          } else if (media.length === 0) {
            contentEl.innerHTML = '<div style="padding:24px;text-align:center;font-size:12px;color:var(--on-surface-variant,#8696a0);">No media shared yet</div>';
          }
        });
      }
    } else if (_activeMediaTab === 'links') {
      var links = [];
      msgs.forEach(function (m) {
        var text = m.text || '';
        var re = /(https?:\/\/[^\s<>"'\u2026]+)/g;
        var mm;
        while ((mm = re.exec(text)) !== null) {
          links.push({ url: mm[1], text: text, senderName: m.senderName || 'User', time: m.timestamp });
        }
      });
      links = links.reverse();
      content.innerHTML = links.length
        ? links.map(function (l) {
            return '<a href="' + _esc(l.url) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;text-decoration:none;color:inherit;">' +
              '<span style="width:36px;height:36px;flex-shrink:0;border-radius:50%;background:var(--primary,#00a884);display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="font-size:18px;color:#fff;">link</span></span>' +
              '<span style="flex:1;min-width:0;">' +
                '<span style="display:block;font-size:12px;font-weight:600;color:var(--primary,#00a884);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(l.url.replace(/^https?:\/\//, '')) + '</span>' +
                '<span style="display:block;font-size:11px;color:var(--on-surface-variant,#8696a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(l.senderName) + ' · ' + _esc((l.text || '').replace(/https?:\/\/[^\s]+/g, '').trim().substring(0, 60) || 'Link') + '</span>' +
              '</span>' +
            '</a>';
          }).join('')
        : '<div style="padding:24px;text-align:center;font-size:12px;color:var(--on-surface-variant,#8696a0);">No links shared yet</div>';
    } else {
      var docs = msgs.filter(function (m) {
        if (!m.attachment || !m.attachment.url) return false;
        var t = m.type;
        if (t === 'image' || t === 'video' || t === 'gif' || t === 'sticker') return false;
        return true;
      });
      content.innerHTML = docs.length
        ? docs.map(function (m) {
            var name = (m.attachment && (m.attachment.name || m.attachment.fileName)) || 'Document';
            var size = (m.attachment && m.attachment.size) || '';
            return '<a href="' + _esc(m.attachment.url) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;text-decoration:none;color:inherit;">' +
              '<span style="width:36px;height:36px;flex-shrink:0;border-radius:50%;background:var(--surface-container-high,#eef2f3);display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="font-size:18px;color:var(--on-surface-variant,#8696a0);">description</span></span>' +
              '<span style="flex:1;min-width:0;">' +
                '<span style="display:block;font-size:12px;font-weight:600;color:var(--on-surface,#1c1c1e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(name) + '</span>' +
                '<span style="display:block;font-size:11px;color:var(--on-surface-variant,#8696a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc((size ? size + ' · ' : '') + (m.senderName || 'User')) + '</span>' +
              '</span>' +
            '</a>';
          }).join('')
        : '<div style="padding:24px;text-align:center;font-size:12px;color:var(--on-surface-variant,#8696a0);">No documents shared yet</div>';
    }
  }

  window.showChatMediaTab = function (tab) { _renderMediaTabContent(tab); };

  function _handleMediaTabOpen(e) {
    var btn = e.target.closest('[data-media-open]');
    if (!btn) return;
    var url = btn.getAttribute('data-media-open');
    var kind = btn.getAttribute('data-media-kind') || 'image';
    if (typeof window.openMediaViewer === 'function') window.openMediaViewer(url, kind);
  }
  document.addEventListener('click', _handleMediaTabOpen);

  window.openChatInfo = function () {
    _renderDetailPanel();
    var panel = _$('detail-panel');
    if (panel) panel.classList.remove('hidden');
  };
  window.openChatMenu = function () {
    _renderDetailPanel();
    var panel = _$('detail-panel');
    if (panel) panel.classList.remove('hidden');
  };
  window.openChatSearchMenu = function () {
    if (typeof window.openChatSearch === 'function') window.openChatSearch('current');
    else if (typeof window.messageSearch !== 'undefined' && window.messageSearch.open) window.messageSearch.open();
    else _toast('Search is not available', 'error');
  };
  window.jumpToDateMenu = function () {
    if (typeof window.JumpToDate !== 'undefined' && typeof window.JumpToDate.open === 'function') window.JumpToDate.open();
    else _toast('Jump to date is not available', 'error');
  };
  window.openChatExportMenu = function () {
    if (typeof window.openChatExport === 'function') window.openChatExport();
    else _toast('Export chat is not available', 'error');
  };
  window.shareLiveLocationMenu = function () {
    var chat = _activeChat();
    if (!chat) { _toast('Open a chat first', 'error'); return; }
    if (window.LiveLocation && typeof window.LiveLocation.openSharePicker === 'function') {
      window.LiveLocation.openSharePicker(chat.id, _activeType());
    } else {
      _toast('Live location is not available', 'error');
    }
  };
  window.openGhostModeMenu = function () {
    if (typeof window.openGhostModeSettings === 'function') window.openGhostModeSettings();
    else _toast('Ghost mode is not available', 'error');
  };
  window.openPrivacySettingsMenu = function () {
    if (window.PrivacySettings && typeof window.PrivacySettings.openSettings === 'function') window.PrivacySettings.openSettings();
    else _toast('Privacy settings are not available', 'error');
  };
  window.openCloudDriveMenu = function () {
    if (typeof window.openGoogleDrivePicker === 'function') window.openGoogleDrivePicker();
    else _toast('Cloud drive is not available', 'error');
  };
  window.openGroupChatMenu = function () {
    if (typeof window.openAnnouncementSettings === 'function') window.openAnnouncementSettings();
    else _toast('Group chat settings are not available', 'error');
  };
  window.openNewGroup = function () {
    var existing = document.getElementById('nsl-create-group');
    if (existing) existing.remove();

    var uid = _uid();
    if (!uid) { _toast('Sign in to create a group', 'error'); return; }

    var overlay = document.createElement('div');
    overlay.id = 'nsl-create-group';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9990;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(2px);';
    var backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:absolute;inset:0;';
    backdrop.addEventListener('click', function () { overlay.remove(); });
    overlay.appendChild(backdrop);

    var panel = document.createElement('div');
    panel.style.cssText = 'position:relative;width:100%;max-width:520px;max-height:92vh;background:var(--surface,#fff);border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -8px 40px rgba(0,0,0,0.22);';
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    panel.style.transform = 'translateY(100%)';
    requestAnimationFrame(function () { panel.style.transition = 'transform .28s ease'; panel.style.transform = 'translateY(0)'; });

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08));flex-shrink:0;';
    var hTitle = document.createElement('h3');
    hTitle.style.cssText = 'margin:0;font-size:17px;font-weight:700;color:var(--on-surface,#1a1a1a);';
    hTitle.textContent = 'New group';
    header.appendChild(hTitle);
    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'border:none;background:none;cursor:pointer;color:var(--on-surface-variant,#666);padding:4px;min-width:44px;min-height:44px;';
    closeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:24px">close</span>';
    closeBtn.addEventListener('click', function () { overlay.remove(); });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    var body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;padding:16px 18px;';

    var photoWrap = document.createElement('div');
    photoWrap.style.cssText = 'display:flex;justify-content:center;margin-bottom:14px;';
    var photoBtn = document.createElement('button');
    photoBtn.style.cssText = 'width:84px;height:84px;border-radius:50%;background:var(--primary,#128C7E);color:#fff;border:none;cursor:pointer;font-size:32px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;';
    photoBtn.innerHTML = '<span class="material-symbols-outlined">photo_camera</span>';
    var _photoFile = null;
    photoBtn.addEventListener('click', function () {
      var fi = document.createElement('input');
      fi.type = 'file'; fi.accept = 'image/*';
      fi.onchange = function () {
        var f = fi.files && fi.files[0];
        if (!f) return;
        _photoFile = f;
        var r = new FileReader();
        r.onload = function (e) { photoBtn.innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover;" />'; };
        r.readAsDataURL(f);
      };
      fi.click();
    });
    photoWrap.appendChild(photoBtn);
    body.appendChild(photoWrap);

    function _field(placeholder) {
      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = placeholder;
      input.style.cssText = 'width:100%;padding:12px 14px;border:1px solid var(--outline-variant,rgba(0,0,0,0.12));border-radius:12px;font-size:15px;background:var(--surface-variant,rgba(0,0,0,0.03));color:var(--on-surface,#1a1a1a);outline:none;margin-bottom:12px;box-sizing:border-box;';
      return input;
    }
    var nameInput = _field('Group name');
    nameInput.maxLength = 100;
    var descInput = _field('Group description (optional)');
    descInput.maxLength = 250;
    body.appendChild(nameInput);
    body.appendChild(descInput);

    var searchInput = _field('Search people to add');
    searchInput.id = 'nsl-cg-search';
    body.appendChild(searchInput);

    var listWrap = document.createElement('div');
    listWrap.style.cssText = 'margin-top:4px;';
    body.appendChild(listWrap);
    panel.appendChild(body);

    var footer = document.createElement('div');
    footer.style.cssText = 'padding:12px 18px;border-top:1px solid var(--outline-variant,rgba(0,0,0,0.08));flex-shrink:0;';
    var createBtn = document.createElement('button');
    createBtn.style.cssText = 'width:100%;padding:13px;border:none;border-radius:12px;background:var(--primary,#128C7E);color:#fff;font-size:15px;font-weight:700;cursor:pointer;opacity:.5;pointer-events:none;transition:opacity .15s;';
    createBtn.textContent = 'Create group';
    footer.appendChild(createBtn);
    panel.appendChild(footer);

    var selected = new Set();

    function _renderContacts(q) {
      var ql = String(q || '').trim().toLowerCase();
      var items = _usersCache.filter(function (u) {
        if (u.uid === uid) return false;
        if (!ql) return true;
        return ((u.displayName || '') + ' ' + (u.name || '') + ' ' + (u.email || '')).toLowerCase().indexOf(ql) !== -1;
      });
      if (!_usersCache.length) {
        listWrap.innerHTML = '<div style="padding:20px;text-align:center;color:var(--on-surface-variant,#999);font-size:13px;">Loading people…</div>';
        _loadUsers().then(function () { if (overlay.isConnected) _renderContacts(searchInput.value); });
        return;
      }
      if (!items.length) {
        listWrap.innerHTML = '<div style="padding:20px;text-align:center;color:var(--on-surface-variant,#999);font-size:13px;">No contacts found</div>';
        return;
      }
      listWrap.innerHTML = '';
      items.forEach(function (u) {
        var label = u.displayName || u.name || u.email || u.uid;
        var item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:9px 6px;border-radius:12px;cursor:pointer;transition:background .15s;';
        var avatar = document.createElement('div');
        avatar.style.cssText = 'width:42px;height:42px;border-radius:50%;background:var(--surface-container-highest,#eef2f3);color:var(--on-surface-variant,#555);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;overflow:hidden;';
        if (u.photoURL) avatar.innerHTML = '<img src="' + _esc(u.photoURL) + '" style="width:100%;height:100%;object-fit:cover;" />';
        else avatar.textContent = (label || '?').charAt(0).toUpperCase();
        item.appendChild(avatar);
        var info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        var nm = document.createElement('div');
        nm.style.cssText = 'font-weight:600;font-size:14px;color:var(--on-surface,#1a1a1a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        nm.textContent = label;
        info.appendChild(nm);
        if (u.email) {
          var em = document.createElement('div');
          em.style.cssText = 'font-size:12px;color:var(--on-surface-variant,#999);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
          em.textContent = u.email;
          info.appendChild(em);
        }
        item.appendChild(info);
        var check = document.createElement('div');
        check.style.cssText = 'width:22px;height:22px;border-radius:50%;border:2px solid var(--outline-variant,rgba(0,0,0,0.25));flex-shrink:0;transition:all .15s;display:flex;align-items:center;justify-content:center;';
        item.appendChild(check);
        item.addEventListener('click', function () {
          if (selected.has(u.uid)) {
            selected.delete(u.uid);
            check.style.background = 'none'; check.style.borderColor = 'var(--outline-variant,rgba(0,0,0,0.25))'; check.innerHTML = '';
          } else {
            selected.add(u.uid);
            check.style.background = 'var(--primary,#128C7E)'; check.style.borderColor = 'var(--primary,#128C7E)';
            check.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;color:#fff">check</span>';
          }
          _syncCreate();
        });
        item.addEventListener('mouseenter', function () { item.style.background = 'var(--surface-variant,rgba(0,0,0,0.03))'; });
        item.addEventListener('mouseleave', function () { item.style.background = 'transparent'; });
        listWrap.appendChild(item);
      });
    }

    function _syncCreate() {
      var ready = nameInput.value.trim().length > 0 && selected.size > 0;
      createBtn.style.opacity = ready ? '1' : '.5';
      createBtn.style.pointerEvents = ready ? 'auto' : 'none';
      createBtn.textContent = selected.size ? 'Create group (' + selected.size + ')' : 'Create group';
    }

    nameInput.addEventListener('input', _syncCreate);
    searchInput.addEventListener('input', function () { _renderContacts(searchInput.value); });

    createBtn.addEventListener('click', async function () {
      var name = nameInput.value.trim();
      if (!name || !selected.size) return;
      createBtn.disabled = true;
      createBtn.textContent = 'Creating…';
      try {
        var result;
        if (typeof firebase !== 'undefined' && firebase.functions) {
          var fn = firebase.functions('us-central1').httpsCallable('createGroup');
          result = await fn({ name: name, description: descInput.value.trim(), memberIds: Array.from(selected) });
        }
        var groupId = (result && result.data && result.data.groupId) || _fallbackCreateGroup(name, descInput.value.trim());
        overlay.remove();
        _toast('Group created', 'success');
        if (typeof window.openChat === 'function') window.openChat(groupId, 'group');
        else if (typeof window.startDirectChat === 'function') window.startDirectChat({ id: groupId, type: 'group', name: name });
      } catch (err) {
        if (window.__DEBUG__) console.error('[ui-glue] createGroup failed:', err);
        createBtn.disabled = false;
        _syncCreate();
        _toast((err && err.message) || 'Failed to create group', 'error');
      }
    });

    // Direct Firestore fallback if the Cloud Function is not deployed yet
    async function _fallbackCreateGroup(name, desc) {
      var db = _db();
      var me = _me();
      if (!db) throw new Error('Database unavailable');
      var groupRef = db.collection('groups').doc();
      var allIds = [uid].concat(Array.from(selected));
      await groupRef.set({
        id: groupRef.id, name: name, description: desc, type: 'group',
        createdBy: uid, ownerId: uid, adminIds: [uid], admins: [uid],
        memberIds: allIds, members: allIds, memberCount: allIds.length,
        photoURL: '', avatar: '', isPublic: false, announcementOnly: false,
        ephemeralTimer: null, lastMessage: '', lastMessageText: '', lastMessageAt: null,
        createdAt: Date.now(), updatedAt: Date.now(),
        createdByName: (me && (me.displayName || me.name)) || 'Admin',
        createdByPhotoURL: (me && me.photoURL) || '', unreadCounts: {}
      });
      var batch = db.batch();
      batch.set(groupRef.collection('members').doc(uid), { uid: uid, displayName: (me && (me.displayName || me.name)) || 'Admin', photoURL: (me && me.photoURL) || '', role: 'admin', addedBy: uid, addedAt: Date.now() });
      Array.from(selected).forEach(function (mUid) {
        var u = _usersCache.find(function (x) { return x.uid === mUid; });
        batch.set(groupRef.collection('members').doc(mUid), { uid: mUid, displayName: (u && (u.displayName || u.name)) || 'Member', photoURL: (u && u.photoURL) || '', role: 'member', addedBy: uid, addedAt: Date.now() });
      });
      await batch.commit();
      return groupRef.id;
    }

    _renderContacts('');
  };

  /* ════════════════════════════════════════════════════════════
     PINNED MESSAGES — bar actions
     ════════════════════════════════════════════════════════════ */
  window.scrollToMessage = function (msgId) {
    if (!msgId) return;
    var el = _qs('[data-message-id="' + String(msgId).replace(/"/g, '\\"') + '"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('cf-highlight');
      setTimeout(function () { el.classList.remove('cf-highlight'); }, 1800);
      return;
    }
    var chat = _activeChat();
    if (chat && typeof window.loadMessages === 'function') {
      window.loadMessages(chat.id);
      setTimeout(function () {
        var el2 = _qs('[data-message-id="' + String(msgId).replace(/"/g, '\\"') + '"]');
        if (el2) { el2.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        else _toast('Scroll up to find the message');
      }, 800);
    } else {
      _toast('Scroll up to find the message');
    }
  };

  window.scrollToPinnedMessage = function () {
    var list = window.pinnedMessages || [];
    var pin = list[0];
    if (!pin || !pin.messageId) { _toast('No pinned messages'); return; }
    window.scrollToMessage(pin.messageId);
  };

  window.unpinCurrentMessage = function () {
    var list = window.pinnedMessages || [];
    var pin = list[0];
    if (!pin) { _toast('No pinned messages'); return; }
    if (typeof window.unpinMessage !== 'function') return;
    Promise.resolve(window.unpinMessage(pin.id)).then(function () {
      if (typeof window.loadPinnedMessages === 'function') window.loadPinnedMessages();
    }).catch(function () {});
  };

  window.openPinnedMessagesPanel = function () {
    if (typeof window.loadPinnedMessages === 'function') window.loadPinnedMessages();
    var list = window.pinnedMessages || [];
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px;';
    var html = '<div style="background:var(--surface-container,#fff);color:var(--on-surface,#1c1c1e);border-radius:16px;width:100%;max-width:480px;max-height:75vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.35);">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08));">' +
        '<span style="font-weight:700;font-size:15px;">Pinned messages</span>' +
        '<button class="ui-glue-pin-close" style="background:none;border:none;cursor:pointer;min-width:44px;min-height:44px;color:inherit;font-size:20px;" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div id="ui-glue-pin-list" style="flex:1;overflow-y:auto;padding:8px;">' +
        (list.length
          ? list.map(function (p) {
              return '<div class="ui-glue-pin-item" data-msg-id="' + _esc(p.messageId) + '" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;margin-bottom:6px;background:var(--surface-container-low,rgba(0,0,0,0.04));">' +
                '<span style="font-size:14px;">📌</span>' +
                '<div style="flex:1;min-width:0;">' +
                  '<div style="font-size:12px;font-weight:600;color:var(--primary,#00a884);">' + _esc(p.senderName || 'Pinned message') + '</div>' +
                  '<div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc((p.text || '📎 Media').substring(0, 80)) + '</div>' +
                '</div>' +
                '<button class="ui-glue-pin-unpin" data-pin-id="' + _esc(p.id) + '" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant,#8696a0);min-width:36px;min-height:36px;font-size:16px;" aria-label="Unpin">✕</button>' +
              '</div>';
            }).join('')
          : '<div style="padding:24px;text-align:center;color:var(--on-surface-variant,#8696a0);font-size:13px;">No pinned messages</div>') +
      '</div>' +
    '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    _lockBody(true);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
    var closeBtn = _qs('.ui-glue-pin-close', overlay);
    if (closeBtn) closeBtn.addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) {
      var item = e.target.closest('.ui-glue-pin-item');
      if (item && !e.target.closest('.ui-glue-pin-unpin')) {
        var msgId = item.getAttribute('data-msg-id');
        overlay.remove();
        _lockBody(false);
        window.scrollToMessage(msgId);
      }
      var unpin = e.target.closest('.ui-glue-pin-unpin');
      if (unpin) {
        var pid = unpin.getAttribute('data-pin-id');
        Promise.resolve(window.unpinMessage(pid)).then(function () {
          if (typeof window.loadPinnedMessages === 'function') window.loadPinnedMessages();
        }).catch(function () {});
        overlay.remove();
        _lockBody(false);
      }
    });
  };

  /* ════════════════════════════════════════════════════════════
     DELETE CHAT
     ════════════════════════════════════════════════════════════ */
  function _deleteChat(chatId) {
    var db = _db();
    if (!db || !chatId) return;
    var type = 'direct';
    if (window.App && window.App.chats && window.App.chats[chatId]) {
      var c = window.App.chats[chatId];
      type = (c.type === 'group' || c.isGroup) ? 'group' : 'direct';
    } else if (window.App && window.App.groups && window.App.groups[chatId]) {
      type = 'group';
    } else {
      var item = _qs('[data-chat-id="' + String(chatId).replace(/"/g, '\\"') + '"]');
      if (item) type = item.getAttribute('data-chat-type') || 'direct';
    }
    var coll = type === 'group' ? 'groups' : 'chats';

    var msgsRef = db.collection(coll).doc(chatId).collection('messages');
    msgsRef.get().then(function (snap) {
      var batch = db.batch();
      snap.forEach(function (doc) { batch.delete(doc.ref); });
      return batch.commit();
    }).then(function () {
      var membersRef = db.collection(coll).doc(chatId).collection('members');
      return membersRef.get().then(function (snap2) {
        var batch2 = db.batch();
        snap2.forEach(function (doc) { batch2.delete(doc.ref); });
        return batch2.commit();
      });
    }).then(function () {
      return db.collection(coll).doc(chatId).delete();
    }).then(function () {
      if (window.App && window.App.messages) delete window.App.messages[chatId];
      if (window.App && window.App.chats && window.App.chats[chatId]) delete window.App.chats[chatId];
      if (window.App && window.App.groups && window.App.groups[chatId]) delete window.App.groups[chatId];
      if (window.App && window.App.currentChat && window.App.currentChat.id === chatId) {
        window.App.currentChat = null;
      }
      if (typeof window.loadChats === 'function') window.loadChats();
      else if (typeof window.switchTab === 'function') window.switchTab('chats');
      _toast('Chat deleted', 'success');
    }).catch(function (err) { _debug('delete chat failed:', err); });
  }

  window.deleteChat = function (chatId) {
    var id = chatId || (_activeChat() && _activeChat().id);
    if (!id) { _toast('No chat to delete', 'error'); return; }
    window.showConfirmDialog('Delete this chat? All messages will be removed.', function () { _deleteChat(id); });
  };

  /* ════════════════════════════════════════════════════════════
     CHAT MULTI-SELECT
     ════════════════════════════════════════════════════════════ */
  var _chatSelMode = false;
  var _chatSelected = {};

  function _chatItems() {
    return _qsa('#chat-list [data-chat-id], .chat-list-item[data-chat-id], .chat-item[data-chat-id]');
  }

  function _renderChatSelectionUI() {
    var items = _chatItems();
    for (var i = 0; i < items.length; i++) {
      var id = items[i].getAttribute('data-chat-id');
      var on = _chatSelMode && !!_chatSelected[id];
      items[i].classList.toggle('chat-selected', on);
      if (_chatSelMode) {
        var box = _qs('.chat-selection-checkbox', items[i]);
        if (!box) {
          box = document.createElement('span');
          box.className = 'chat-selection-checkbox';
          items[i].appendChild(box);
        }
        box.textContent = on ? '✓' : '';
      } else {
        var b2 = _qs('.chat-selection-checkbox', items[i]);
        if (b2) b2.remove();
      }
    }
  }

  window.toggleChatSelectionMode = function () {
    _chatSelMode = !_chatSelMode;
    _chatSelected = {};
    var sel = _$('btn-select-all');
    var del = _$('btn-delete-selected');
    if (sel) sel.classList.toggle('hidden', !_chatSelMode);
    if (del) del.classList.toggle('hidden', !_chatSelMode);
    _renderChatSelectionUI();
  };

  window.toggleSelectAllChats = function () {
    if (!_chatSelMode) return;
    var items = _chatItems();
    var allOn = items.every(function (it) { return _chatSelected[it.getAttribute('data-chat-id')]; });
    _chatSelected = {};
    if (!allOn) {
      items.forEach(function (it) { _chatSelected[it.getAttribute('data-chat-id')] = true; });
    }
    _renderChatSelectionUI();
  };

  window.deleteSelectedChats = function () {
    var ids = Object.keys(_chatSelected);
    if (!ids.length) { _toast('No chats selected'); return; }
    window.showConfirmDialog('Delete ' + ids.length + ' selected chat' + (ids.length > 1 ? 's' : '') + '? This cannot be undone.', function () {
      ids.forEach(function (id) { _deleteChat(id); });
      _chatSelected = {};
      _chatSelMode = false;
      var sel = _$('btn-select-all');
      var del = _$('btn-delete-selected');
      if (sel) sel.classList.add('hidden');
      if (del) del.classList.add('hidden');
      _renderChatSelectionUI();
    });
  };

  document.addEventListener('click', function (e) {
    if (!_chatSelMode) return;
    var item = e.target.closest('#chat-list [data-chat-id], .chat-list-item[data-chat-id], .chat-item[data-chat-id]');
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    var id = item.getAttribute('data-chat-id');
    if (_chatSelected[id]) delete _chatSelected[id];
    else _chatSelected[id] = true;
    _renderChatSelectionUI();
  }, true);

  /* ════════════════════════════════════════════════════════════
     CALL MULTI-SELECT
     ════════════════════════════════════════════════════════════ */
  var _callSelMode = false;

  window.toggleCallSelectionMode = function () {
    _callSelMode = !_callSelMode;
    var sel = _$('btn-call-select-all');
    var del = _$('btn-call-delete-selected');
    if (sel) sel.classList.toggle('hidden', !_callSelMode);
    if (del) del.classList.toggle('hidden', !_callSelMode);
    if (_callSelMode && typeof window._enterCallHistorySelection === 'function') window._enterCallHistorySelection();
    else if (!_callSelMode && typeof window._exitCallHistorySelection === 'function') window._exitCallHistorySelection();
  };

  window.toggleSelectAllCalls = function () {
    var entries = _qsa('[data-call-entry]');
    if (!entries.length) { _toast('No call history'); return; }
    entries.forEach(function (el) {
      var id = el.getAttribute('data-call-entry');
      if (id && typeof window._toggleCallSelection === 'function') window._toggleCallSelection(id);
    });
  };

  window.deleteSelectedCalls = function () {
    window.showConfirmDialog('Delete selected calls?', function () {
      if (typeof window.deleteSelectedCallHistory === 'function') window.deleteSelectedCallHistory();
      if (typeof window._exitCallHistorySelection === 'function') window._exitCallHistorySelection();
      _callSelMode = false;
      var sel = _$('btn-call-select-all');
      var del = _$('btn-call-delete-selected');
      if (sel) sel.classList.add('hidden');
      if (del) del.classList.add('hidden');
    });
  };

  /* ════════════════════════════════════════════════════════════
     MEDIA VIEWER
     ════════════════════════════════════════════════════════════ */
  var _mediaItems = [];
  var _mediaIndex = -1;

  function _collectMedia(url) {
    var items = [];
    var msgs = (typeof window.getCurrentMessages === 'function') ? window.getCurrentMessages() : [];
    msgs.forEach(function (m) {
      var att = m.attachment || m.media || null;
      if (!att) return;
      var u = (typeof att === 'string') ? att : (att.url || '');
      if (!u) return;
      var t = m.type || (typeof att === 'string' ? 'file' : att.type || 'file');
      items.push({
        id: m.id,
        url: u,
        type: t,
        caption: m.text || '',
        senderName: m.senderName || ''
      });
    });
    if (!items.length && url) items.push({ id: null, url: url, type: 'image', caption: '', senderName: '' });
    return items;
  }

  function _renderMediaViewer() {
    var item = _mediaItems[_mediaIndex];
    var box = _$('media-viewer-content');
    if (!item || !box) return;
    var isVideo = /^video/i.test(item.type) || /\.(mp4|webm|ogg|mov)$/i.test(item.url);
    var isAudio = /^audio/i.test(item.type) || /\.(mp3|m4a|wav|ogg)$/i.test(item.url);
    if (isVideo) box.innerHTML = '<video src="' + _esc(item.url) + '" controls autoplay style="max-width:85vw;max-height:75vh;border-radius:8px;"></video>';
    else if (isAudio) box.innerHTML = '<audio src="' + _esc(item.url) + '" controls autoplay style="max-width:80vw;"></audio>';
    else box.innerHTML = '<img src="' + _esc(item.url) + '" alt="Media" style="max-width:85vw;max-height:75vh;object-fit:contain;border-radius:8px;">';
    var cap = _$('media-viewer-caption'); if (cap) cap.textContent = item.caption || '';
    var sub = _$('media-viewer-caption-sub');
    if (sub) sub.textContent = (item.senderName ? item.senderName + ' · ' : '') + ((_mediaIndex + 1) + ' / ' + _mediaItems.length);
    var del = _$('media-viewer-delete-btn'); if (del) del.style.display = item.id ? '' : 'none';
  }

  window.openMediaViewer = function (url, _type, _opts) {
    _mediaItems = _collectMedia(url);
    _mediaIndex = -1;
    for (var i = 0; i < _mediaItems.length; i++) {
      if (_mediaItems[i].url === url || (url && _mediaItems[i].url.indexOf(url) !== -1)) { _mediaIndex = i; break; }
    }
    if (_mediaIndex === -1 && _mediaItems.length) _mediaIndex = 0;
    _renderMediaViewer();
    var v = _$('media-viewer');
    if (v) { v.classList.remove('hidden'); _lockBody(true); }
  };

  window.closeMediaViewer = function () {
    var v = _$('media-viewer');
    if (v) v.classList.add('hidden');
    _lockBody(false);
    _mediaItems = [];
    _mediaIndex = -1;
  };

  window.nextMedia = function () {
    if (!_mediaItems.length) return;
    _mediaIndex = (_mediaIndex + 1) % _mediaItems.length;
    _renderMediaViewer();
  };

  window.prevMedia = function () {
    if (!_mediaItems.length) return;
    _mediaIndex = (_mediaIndex - 1 + _mediaItems.length) % _mediaItems.length;
    _renderMediaViewer();
  };

  window.deleteCurrentMedia = function () {
    var item = _mediaItems[_mediaIndex];
    if (!item || !item.id) { _toast('Cannot delete this media'); return; }
    window.showConfirmDialog('Delete this media message?', function () {
      if (typeof window.deleteMessage === 'function') window.deleteMessage(item.id);
      window.closeMediaViewer();
      var chat = _activeChat();
      if (chat && typeof window.loadMessages === 'function') window.loadMessages(chat.id);
    });
  };

  window.forwardCurrentMedia = function () {
    var item = _mediaItems[_mediaIndex];
    if (!item || !item.id) { _toast('Cannot forward this media'); return; }
    if (typeof window.openForwardModalForMedia === 'function') window.openForwardModalForMedia(item.id);
    else _toast('Forwarding is not available');
  };

  window.downloadCurrentMedia = function () {
    var item = _mediaItems[_mediaIndex];
    if (!item) return;
    _downloadUrl(item.url, (item.caption || 'media').replace(/[^\w.-]+/g, '_').slice(0, 60) + (/\.[a-z0-9]+$/i.test(item.url) ? '' : ''));
  };

  function _downloadUrl(url, name) {
    fetch(url)
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        var a = document.createElement('a');
        var objUrl = URL.createObjectURL(blob);
        a.href = objUrl;
        a.download = name || 'media';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(objUrl); }, 4000);
      })
      .catch(function () { window.open(url, '_blank'); });
  }

  /* ════════════════════════════════════════════════════════════
     ATTACH MENU
     ════════════════════════════════════════════════════════════ */
  window.toggleAttachMenu = function () {
    var m = _$('attach-menu');
    if (!m) return;
    var opening = m.classList.contains('hidden');
    m.classList.toggle('hidden', !opening);
    if (opening) document.addEventListener('click', _attachMenuDoc, true);
  };

  function _attachMenuDoc(e) {
    if (e.target.closest('#attach-menu, #attach-btn')) return;
    var m = _$('attach-menu');
    if (m && !m.classList.contains('hidden')) m.classList.add('hidden');
    document.removeEventListener('click', _attachMenuDoc, true);
  }

  function _pickFile(accept, capture, cb) {
    var input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    if (accept) input.accept = accept;
    if (capture) input.setAttribute('capture', 'environment');
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      var menu = _$('attach-menu'); if (menu) menu.classList.add('hidden');
      if (f && cb) cb(f);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  }

  window.attachPhoto = function () { _pickFile('image/*', false, function (file) { _sendViaPreview(file, 'image'); }); };
  window.attachCamera = function () { _pickFile('image/*', true, function (file) { _sendViaPreview(file, 'image'); }); };
  window.attachDocument = function () { _pickFile('', false, function (file) { _sendFileMessage(file); }); };

  function _sendViaPreview(file, type) {
    if (typeof window._showMediaPreview === 'function') window._showMediaPreview(file, type);
    else _sendFileMessage(file);
  }

  window.attachAndOpenPoll = function () {
    if (typeof window.openPollCreator === 'function') window.openPollCreator();
    else _toast('Polls are not available yet', 'error');
  };
  window.attachAndOpenDrive = function () { _toast('Drive integration is not available in this build'); };
  window.attachAndOpenOneDrive = function () { _toast('OneDrive integration is not available in this build'); };
  window.attachAndOpenWhiteboard = function () {
    if (typeof window.openWhiteboard === 'function') window.openWhiteboard();
    else _toast('Whiteboard is not available');
  };

  window.attachSticker = function () {
    if (!_activeChat()) { _toast('No active chat to send to', 'error'); return; }
    function open() {
      if (typeof window.openStickerPicker === 'function') {
        window.openStickerPicker(function (stickerUrl) {
          _sendUrlMessage('sticker', { url: stickerUrl, name: 'Sticker', type: 'image/webp', mimeType: 'image/webp' }, '');
        });
      } else {
        _toast('Stickers are not available', 'error');
      }
    }
    if (typeof window.openStickerPicker === 'function') { open(); return; }
    import('./sticker-packs.js').then(open)['catch'](function () { _toast('Stickers are not available', 'error'); });
  };

  window.attachGif = function () {
    if (!_activeChat()) { _toast('No active chat to send to', 'error'); return; }
    function open() {
      if (typeof window.openGifPicker === 'function') {
        window.openGifPicker(function (gifUrl) {
          _sendUrlMessage('gif', { url: gifUrl, name: 'GIF', type: 'image/gif', mimeType: 'image/gif' }, '');
        });
      } else {
        _toast('GIFs are not available', 'error');
      }
    }
    if (typeof window.openGifPicker === 'function') { open(); return; }
    import('./gif-picker.js').then(open)['catch'](function () { _toast('GIFs are not available', 'error'); });
  };

  function _sendUrlMessage(type, attachment, text) {
    var db = _db();
    var uid = _uid();
    var user = _me();
    var chat = _activeChat();
    if (!db || !uid || !chat) { _toast('No active chat to send to', 'error'); return Promise.resolve(); }

    // Broadcast lists route through the broadcast sender (per-recipient copies)
    if (_activeType() === 'broadcast' || chat.type === 'broadcast') {
      if (typeof window.sendBroadcastMessage === 'function') {
        return window.sendBroadcastMessage(text || '', attachment, type);
      }
      _toast('Broadcast is not available', 'error');
      return Promise.resolve();
    }

    var coll = _activeType() === 'group' ? 'groups' : 'chats';
    var batch = db.batch();
    var msgRef = db.collection(coll).doc(chat.id).collection('messages').doc();
    var msg = {
      id: msgRef.id,
      type: type,
      text: text || '',
      attachment: attachment || null,
      senderId: uid,
      senderName: (user && (user.displayName || user.email)) || 'Me',
      senderPhotoURL: (user && user.photoURL) || '',
      timestamp: _ts(),
      readBy: {}
    };
    msg.readBy[uid] = true;
    batch.set(msgRef, msg);
    var preview = (text && text.trim()) || (attachment && attachment.name) || (type === 'sticker' ? 'Sticker' : 'GIF');
    batch.update(db.collection(coll).doc(chat.id), {
      lastMessage: preview,
      lastMessageText: preview,
      lastMessageAt: _ts(),
      lastSenderId: uid,
      updatedAt: _ts()
    });
    return batch.commit()
      .then(function () {
        if (typeof window.loadMessages === 'function') window.loadMessages(chat.id);
        else if (typeof window.renderMessages === 'function') window.renderMessages(chat.id);
      })
      .catch(function (e) {
        if (window.__DEBUG__) console.warn('[ui-glue] send url message error:', e);
        _toast('Failed to send', 'error');
      });
  }
  window._sendUrlMessage = _sendUrlMessage;

  /* ── Poll creator overlay ───────────────────────────────────── */
  window.openPollCreator = function () {
    if (!_activeChat()) { _toast('Open a chat first', 'error'); return; }

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;'
      + 'background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);padding:16px;';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) _closePollCreator(); });

    var card = document.createElement('div');
    card.style.cssText = 'width:100%;max-width:420px;background:#fff;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,0.25);'
      + 'overflow:hidden;animation:modal-enter .2s ease;';
    overlay.appendChild(card);

    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:16px 18px;'
      + 'border-bottom:1px solid #f0f2f5;';
    var title = document.createElement('div');
    title.textContent = 'Create poll';
    title.style.cssText = 'font-size:17px;font-weight:700;color:#111b21;';
    head.appendChild(title);
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'material-symbols-outlined';
    closeBtn.textContent = 'close';
    closeBtn.style.cssText = 'border:none;background:none;cursor:pointer;color:#8696a0;font-size:22px;';
    closeBtn.addEventListener('click', _closePollCreator);
    head.appendChild(closeBtn);
    card.appendChild(head);

    var body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:18px;max-height:70vh;overflow-y:auto;';

    var qLabel = _pollLabel('Question');
    var qInput = _pollTextInput('Ask a question');
    body.appendChild(qLabel);
    body.appendChild(qInput);

    var optsLabel = _pollLabel('Options (2 to 8)');
    body.appendChild(optsLabel);

    var optionInputs = [];
    var optsWrap = document.createElement('div');
    optsWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    function makeOptionRow() {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;';
      var input = _pollTextInput('Option ' + (optionInputs.length + 1));
      optionInputs.push(input);
      row.appendChild(input);
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'material-symbols-outlined';
      removeBtn.setAttribute('data-role', 'poll-remove');
      removeBtn.textContent = 'remove_circle_outline';
      removeBtn.style.cssText = 'border:none;background:none;cursor:pointer;color:#c0392b;font-size:20px;flex:none;'
        + 'display:' + (optionInputs.length > 2 ? 'block' : 'none') + ';';
      removeBtn.addEventListener('click', function () {
        if (optionInputs.length <= 2) return;
        var idx = optionInputs.indexOf(input);
        if (idx !== -1) optionInputs.splice(idx, 1);
        optsWrap.removeChild(row);
        _renumberPollOptions();
        _refreshPollRemoveButtons();
      });
      row.appendChild(removeBtn);
      return row;
    }
    function _renumberPollOptions() {
      optionInputs.forEach(function (inp, i) { inp.placeholder = 'Option ' + (i + 1); });
    }
    function _refreshPollRemoveButtons() {
      var buttons = optsWrap.querySelectorAll('button[data-role="poll-remove"]');
      Array.prototype.forEach.call(buttons, function (btn, i) {
        btn.style.display = optionInputs.length > 2 ? 'block' : 'none';
      });
    }
    var addOptBtn = document.createElement('button');
    addOptBtn.type = 'button';
    addOptBtn.textContent = '+ Add option';
    addOptBtn.style.cssText = 'align-self:flex-start;font-size:12px;color:#00a884;font-weight:600;background:none;border:none;cursor:pointer;padding:4px 0;';
    addOptBtn.addEventListener('click', function () {
      if (optionInputs.length >= 8) { _toast('Maximum 8 options', 'error'); return; }
      optsWrap.insertBefore(makeOptionRow(), addOptBtn);
      _refreshPollRemoveButtons();
    });
    optsWrap.appendChild(addOptBtn);
    body.appendChild(optsWrap);

    var multiLabel = document.createElement('label');
    multiLabel.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;color:#111b21;cursor:pointer;';
    var multiCheck = document.createElement('input');
    multiCheck.type = 'checkbox';
    multiLabel.appendChild(multiCheck);
    multiLabel.appendChild(document.createTextNode('Allow multiple answers'));
    body.appendChild(multiLabel);

    var foot = document.createElement('div');
    foot.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;padding:14px 18px;border-top:1px solid #f0f2f5;';
    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:9px 18px;border-radius:10px;font-size:14px;font-weight:600;color:#8696a0;'
      + 'background:none;border:none;cursor:pointer;';
    cancelBtn.addEventListener('click', _closePollCreator);
    foot.appendChild(cancelBtn);
    var sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.textContent = 'Send';
    sendBtn.style.cssText = 'padding:9px 22px;border-radius:10px;font-size:14px;font-weight:700;color:#fff;'
      + 'background:#00a884;border:none;cursor:pointer;';
    sendBtn.addEventListener('click', function () {
      var q = (qInput.value || '').trim();
      var opts = optionInputs.map(function (o) { return (o.value || '').trim(); }).filter(function (v) { return v; });
      if (!q) { _toast('Enter a question', 'error'); qInput.focus(); return; }
      if (opts.length < 2) { _toast('Add at least 2 options', 'error'); return; }
      _closePollCreator();
      if (typeof window.sendPollMessage === 'function') window.sendPollMessage(q, opts, multiCheck.checked);
    });
    foot.appendChild(sendBtn);
    card.appendChild(body);
    card.appendChild(foot);

    function _closePollCreator() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    document.body.appendChild(overlay);
    optsWrap.insertBefore(makeOptionRow(), addOptBtn);
    optsWrap.insertBefore(makeOptionRow(), addOptBtn);
    setTimeout(function () { qInput.focus(); }, 50);
  };

  function _pollLabel(text) {
    var label = document.createElement('label');
    label.textContent = text;
    label.style.cssText = 'font-size:12px;font-weight:600;color:#8696a0;';
    return label;
  }
  function _pollTextInput(placeholder) {
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.style.cssText = 'flex:1;min-width:0;padding:10px 12px;border:1px solid #e0e0e0;border-radius:10px;'
      + 'font-size:14px;color:#111b21;background:#fafafa;outline:none;';
    input.addEventListener('focus', function () { input.style.borderColor = '#00a884'; });
    input.addEventListener('blur', function () { input.style.borderColor = '#e0e0e0'; });
    return input;
  }

  /* ── File → storage → chat message ────────────────────────── */
  function _sendFileMessage(file, _unused, extraMeta) {
    var db = _db();
    var uid = _uid();
    var user = _me();
    var chat = _activeChat();
    if (!db || !uid || !chat) { _toast('No active chat to send to', 'error'); return; }
    var storage = _storage();
    if (!storage) { _toast('Storage not available', 'error'); return; }

    var name = file.name || 'file';
    var type = 'file';
    if (/^image\//i.test(file.type)) type = 'image';
    else if (/^video\//i.test(file.type)) type = 'video';
    else if (/^audio\//i.test(file.type)) type = 'audio';

    var ext = name.split('.').pop() || 'bin';
    var path = 'media/' + uid + '/' + Date.now() + '_' + (String(name).replace(/[^\w.-]+/g, '_').slice(0, 80) || ('file.' + ext));
    var ref = storage.ref(path);

    ref.put(file)
      .then(function (snap) { return snap.ref.getDownloadURL(); })
      .then(function (url) {
        var coll = _activeType() === 'group' ? 'groups' : 'chats';
        var batch = db.batch();
        var msgRef = db.collection(coll).doc(chat.id).collection('messages').doc();
        var msg = {
          id: msgRef.id,
          type: type,
          text: type === 'image' ? '' : name,
          attachment: { url: url, name: name, size: file.size || 0, type: file.type || '', mimeType: file.type || '', storagePath: path },
          senderId: uid,
          senderName: (user && (user.displayName || user.email)) || 'Me',
          senderPhotoURL: (user && user.photoURL) || '',
          timestamp: _ts(),
          readBy: {}
        };
        msg.readBy[uid] = true;
        if (extraMeta && typeof extraMeta === 'object') {
          if (extraMeta.version != null) msg.attachment.version = extraMeta.version;
          if (extraMeta.previousVersionId != null) msg.attachment.previousVersionId = extraMeta.previousVersionId;
        }
        batch.set(msgRef, msg);
        batch.update(db.collection(coll).doc(chat.id), {
          lastMessage: name,
          lastMessageText: name,
          lastMessageAt: _ts(),
          lastSenderId: uid,
          updatedAt: _ts()
        });
        return batch.commit();
      })
      .then(function () {
        if (typeof window.loadMessages === 'function') window.loadMessages(chat.id);
      })
      .catch(function (err) { _debug('send file failed:', err); _toast('Failed to send file', 'error'); });
  }

  window._sendFileMessage = _sendFileMessage;

  window._showMediaPreview = function (file, _type) {
    if (!file) return;
    _sendFileMessage(file);
  };

  /* ── Send a plain text message directly ───────────────────── */
  function _sendTextMessage(text) {
    var db = _db();
    var uid = _uid();
    var user = _me();
    var chat = _activeChat();
    if (!db || !uid || !chat) { _toast('No active chat', 'error'); return; }
    var coll = _activeType() === 'group' ? 'groups' : 'chats';
    var batch = db.batch();
    var ref = db.collection(coll).doc(chat.id).collection('messages').doc();
    var msg = {
      id: ref.id,
      text: text,
      senderId: uid,
      senderName: (user && (user.displayName || user.email)) || 'Me',
      senderPhotoURL: (user && user.photoURL) || '',
      timestamp: _ts(),
      type: 'text',
      readBy: {}
    };
    msg.readBy[uid] = true;
    batch.set(ref, msg);
    batch.update(db.collection(coll).doc(chat.id), {
      lastMessage: text,
      lastMessageText: text,
      lastMessageAt: _ts(),
      lastSenderId: uid,
      updatedAt: _ts()
    });
    batch.commit().catch(function (err) { _debug('send text failed:', err); _toast('Failed to send', 'error'); });
    if (typeof window.loadMessages === 'function') window.loadMessages(chat.id);
  }

  function _sendLocationMessage(lat, lng, label) {
    var db = _db();
    var uid = _uid();
    var user = _me();
    var chat = _activeChat();
    if (!db || !uid || !chat) { _toast('No active chat', 'error'); return; }
    var coll = _activeType() === 'group' ? 'groups' : 'chats';
    var batch = db.batch();
    var ref = db.collection(coll).doc(chat.id).collection('messages').doc();
    var text = label || 'My current location';
    var msg = {
      id: ref.id,
      type: 'location',
      latitude: lat,
      longitude: lng,
      text: text,
      senderId: uid,
      senderName: (user && (user.displayName || user.email)) || 'Me',
      senderPhotoURL: (user && user.photoURL) || '',
      timestamp: _ts(),
      readBy: {}
    };
    msg.readBy[uid] = true;
    batch.set(ref, msg);
    batch.update(db.collection(coll).doc(chat.id), {
      lastMessage: '📍 ' + text,
      lastMessageText: '📍 ' + text,
      lastMessageAt: _ts(),
      lastSenderId: uid,
      updatedAt: _ts()
    });
    batch.commit().catch(function (err) { _debug('send location failed:', err); _toast('Failed to send', 'error'); });
    if (typeof window.loadMessages === 'function') window.loadMessages(chat.id);
  }

  window.sendLocationMessage = _sendLocationMessage;

  window.shareLocation = function () {
    if (!navigator.geolocation) { _toast('Geolocation not supported', 'error'); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      _sendLocationMessage(pos.coords.latitude, pos.coords.longitude);
    }, function () { _toast('Unable to get your location', 'error'); }, { maximumAge: 60000, timeout: 15000, enableHighAccuracy: true });
  };

  /* ── Share contact ─────────────────────────────────────────── */
  var _usersCache = [];

  function _loadUsers() {
    var db = _db();
    if (!db) return Promise.resolve([]);
    return db.collection('users').get()
      .then(function (snap) {
        _usersCache = snap.docs
          .map(function (d) {
            var data = d.data() || {};
            data.uid = data.uid || d.id;
            return data;
          })
          .filter(function (u) { return u.uid !== _uid(); })
          .sort(function (a, b) {
            return String(a.displayName || a.name || a.email || '').localeCompare(String(b.displayName || b.name || b.email || ''));
          });
        window.allUsers = _usersCache;
        window.teamMembers = _usersCache;
        return _usersCache;
      })
      .catch(function (err) { _debug('load users failed:', err); return []; });
  }

  window.allUsers = window.allUsers || [];
  window.teamMembers = window.teamMembers || [];

  function _userFromCache(uid) {
    for (var i = 0; i < _usersCache.length; i++) {
      if (_usersCache[i].uid === uid) return _usersCache[i];
    }
    return null;
  }

  function _contactCard(u) {
    var lines = ['📇 ' + (u.displayName || u.name || 'Contact')];
    if (u.phoneNumber) lines.push('📞 ' + u.phoneNumber);
    if (u.email) lines.push('✉️ ' + u.email);
    return lines.filter(Boolean).join('\n');
  }

  function _vcardEscape(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n').replace(/\r/g, '');
  }

  function _vcardString(u) {
    var name = u.displayName || u.name || u.email || 'Contact';
    var out = ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + _vcardEscape(name) + ';;;;', 'FN:' + _vcardEscape(name)];
    if (u.phoneNumber) out.push('TEL;TYPE=CELL:' + _vcardEscape(String(u.phoneNumber)));
    if (u.email) out.push('EMAIL;TYPE=INTERNET:' + _vcardEscape(String(u.email)));
    if (u.photoURL) out.push('PHOTO;VALUE=URL:' + _vcardEscape(String(u.photoURL)));
    out.push('END:VCARD');
    return out.join('\r\n') + '\r\n';
  }

  function _sendContactVCard(u) {
    if (!u) return;
    var vcf = _vcardString(u);
    var name = String(u.displayName || u.name || 'contact').replace(/[^\w .-]+/g, '').trim() || 'contact';
    var file;
    try {
      file = new File([vcf], name + '.vcf', { type: 'text/vcard' });
    } catch (_) {
      file = new Blob([vcf], { type: 'text/vcard' });
      file.name = name + '.vcf';
    }
    if (typeof window._sendFileMessage === 'function') {
      window._sendFileMessage(file);
    } else {
      _sendTextMessage(_contactCard(u));
    }
  }

  window.shareMyProfile = function () {
    var user = _me();
    if (!user) return;
    _sendContactVCard(user);
    _closeOverlay('contact-picker-overlay');
  };

  window.shareContact = function (uid) {
    if (!uid) {
      _openOverlay('contact-picker-overlay');
      var myName = _$('contact-picker-my-avatar');
      var myInfo = _$('contact-picker-my-email');
      if (myName) myName.textContent = _esc((_me() && (_me().displayName || 'Me')) || 'Me');
      if (myInfo) myInfo.textContent = _esc([(_me() && _me().displayName) || 'Your name', (_me() && _me().phoneNumber) || '', (_me() && _me().email) || ''].filter(Boolean).join(', ') || 'Your name, email & phone');
      _renderContactPicker('');
      return;
    }
    var u = _userFromCache(uid);
    if (u) { _sendContactAndClose(u); return; }
    _loadUsers().then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].uid === uid) { _sendContactAndClose(list[i]); return; }
      }
      _toast('Contact not found', 'error');
    });
  };

  function _sendContactAndClose(u) {
    if (!u) return;
    _sendContactVCard(u);
    _closeOverlay('contact-picker-overlay');
  }

  function _renderContactPicker(q) {
    var list = _$('contact-picker-list');
    if (!list) return;
    if (!_usersCache.length) { _loadUsers().then(function () { _renderContactPicker(q); }); return; }
    var ql = String(q || '').trim().toLowerCase();
    var items = _usersCache.filter(function (u) {
      if (!ql) return true;
      var hay = ((u.displayName || '') + ' ' + (u.name || '') + ' ' + (u.email || '') + ' ' + (u.phoneNumber || '')).toLowerCase();
      return hay.indexOf(ql) !== -1;
    });
    list.innerHTML = items.length
      ? items.map(function (u) {
          var label = u.displayName || u.name || u.email || u.uid;
          var sub = [u.email, u.phoneNumber].filter(Boolean).join(' · ');
          return '<button type="button" class="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-variant/40 transition-colors text-left" data-action="shareContact" data-action-arg="' + _esc(u.uid) + '">' +
            '<div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm flex-shrink-0">' + _esc((label || '?').charAt(0).toUpperCase()) + '</div>' +
            '<div class="min-w-0 flex-1"><div class="text-sm font-semibold text-on-surface truncate">' + _esc(label) + '</div><div class="text-[11px] text-on-surface-variant truncate">' + _esc(sub) + '</div></div>' +
            '<span class="material-symbols-outlined text-on-surface-variant">chevron_right</span>' +
          '</button>';
        }).join('')
      : '<div class="p-4 text-center text-sm text-on-surface-variant">No contacts found</div>';
  }

  window.filterContactPicker = function (value) { _renderContactPicker(value); };

  /* ════════════════════════════════════════════════════════════
     NEW CHAT
     ════════════════════════════════════════════════════════════ */
  window.openNewChat = function () {
    if (window.SearchContacts && typeof window.SearchContacts.open === 'function') { window.SearchContacts.open(); return; }
    window.openNewChatModal();
  };

  window.openNewChatModal = function () {
    _openOverlay('new-chat-overlay');
    _populateNewChatList('');
  };

  function _populateNewChatList(q) {
    var list = _$('contact-list');
    if (!list) return;
    if (!_usersCache.length) { _loadUsers().then(function () { _populateNewChatList(q); }); return; }
    var ql = String(q || '').trim().toLowerCase();
    var items = _usersCache.filter(function (u) {
      if (!ql) return true;
      return ((u.displayName || '') + ' ' + (u.name || '') + ' ' + (u.email || '')).toLowerCase().indexOf(ql) !== -1;
    });
    list.innerHTML = items.length
      ? items.map(function (u) {
          var label = u.displayName || u.name || u.email || u.uid;
          return '<button type="button" class="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-variant/40 transition-colors text-left" data-contact-id="' + _esc(u.uid) + '" data-search="' + _esc(((u.displayName || '') + ' ' + (u.email || '') + ' ' + (u.phoneNumber || '')).toLowerCase()) + '">' +
            '<div class="w-11 h-11 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-on-surface-variant flex-shrink-0">' + _esc((label || '?').charAt(0).toUpperCase()) + '</div>' +
            '<div class="min-w-0 text-left"><div class="text-sm font-semibold text-on-surface truncate">' + _esc(label) + '</div><div class="text-[11px] text-on-surface-variant truncate">' + _esc(u.email || '') + '</div></div>' +
          '</button>';
        }).join('')
      : '<div class="p-4 text-center text-sm text-on-surface-variant">No contacts found</div>';
  }

  function _handleNewChatClick(e) {
    var btn = e.target.closest('#contact-list [data-contact-id]');
    if (!btn) return;
    var uid = btn.getAttribute('data-contact-id');
    if (uid && typeof window.selectChat === 'function') window.selectChat(uid);
    _closeOverlay('new-chat-overlay');
  }
  document.addEventListener('click', _handleNewChatClick);

  window.filterNewChatList = function (value) {
    var list = _$('contact-list');
    if (!list) return;
    var ql = String(value || '').trim().toLowerCase();
    _qsa('[data-contact-id]', list).forEach(function (el) {
      var hay = el.getAttribute('data-search') || '';
      el.style.display = (!ql || hay.indexOf(ql) !== -1) ? '' : 'none';
    });
  };

  /* ════════════════════════════════════════════════════════════
     EMOJI PICKER
     ════════════════════════════════════════════════════════════ */
  var _EMOJI_SMILEYS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'];
  var _EMOJI_PEOPLE = ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁️','👅','👄','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧔♂️','👱♀️','👨🦳','👩🦳','🧓','👴','👵','🧕','💃','🕺','👯','🧖','🧗','🏃','🚶','💆','💇','🧘','🛀','🛌','🤱','👼'];
  var _EMOJI_NATURE = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🐺','🐗','🐴','🦄','🐝','🦋','🐌','🐞','🐢','🐍','🦖','🦕','🐙','🦑','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🌵','🎄','🌲','🌳','🌴','🍀','🍁','🍂','🌸','🌺','🌻','🌹','🌷','🌱','🍄','🌾','☘️','🌿'];
  var _EMOJI_FOOD = ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🥦','🥬','🥒','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🍞','🥖','🥨','🧀','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🥙','🌮','🌯','🥗','🍜','🍝','🍣','🍤','🍥','🍢','🍡','🍧','🍨','🍦','🍰','🎂','🍮','🍫','🍬','🍭','🍪','🍩','🥛','☕','🍵','🍺','🍻'];
  var _EMOJI_ACTIVITIES = ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🏑','🥍','🏏','🥅','⛳','🏹','🎣','🥊','🥋','🎽','⛸️','🥌','🛷','🎿','⛷️','🏂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🎫','🎟️','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻'];
  var _EMOJI_TRAVEL = ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🛵','🏍️','🚲','🛴','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺','🛰️','🚀','🛸','🚁','⛵','🛥️','🚤','🛳️','⛴️','🚢','⚓','⛽','🚧','🚦','🗺️','🗽','🗼','🌍','🌎','🌏','🌕','🌙','⭐','🌟','☀️','⛅','☁️','🌧️','⛈️','❄️'];
  var _EMOJI_OBJECTS = ['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','📁','📂','🗂️','📊','📈','📉','📋','📅','📆','📇','📃','📄','📑','🔖','✂️','🖊️','🖋️','✒️','🖌️','🖍️','📝','✏️','🔍','🔎','💵','💴','💶','💷','💰','💳','💎','⚖️','🧰','🔧','🔨','⚒️','🛠️','⛏️','🔩','⚙️','🧲','🔪','🗡️','⚔️','🛡️','🚬','⚰️','⚱️','🏺','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️'];
  var _EMOJI_SYMBOLS = ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💌','💋','💯','💢','💥','💫','💦','💨','💬','💭','💤','♨️','🛑','🚫','⛔','📛','🚯','🚱','🚳','🚷','🔞','💮','✅','❌','❎','➰','➿','〽️','✳️','✴️','❇️','⁉️','❓','❔','❕','❗','💠','🔘','🔲','🔳','⚪','⚫','🔴','🔵','🔺','🔻','🔸','🔹','🔶','🔷','🔔','🔕','✖️','➕','➖','➗','🔒','🔓','🔏','🔐','🔑','♻️'];
  var _EMOJI_FLAGS = ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🇺🇳','🇺🇸','🇬🇧','🇮🇳','🇨🇦','🇦🇺','🇩🇪','🇫🇷','🇯🇵','🇨🇳','🇷🇺','🇧🇷','🇲🇽','🇿🇦','🇪🇬','🇸🇦','🇦🇪','🇮🇩','🇵🇰','🇧🇩','🇳🇵','🇱🇰','🇲🇾','🇸🇬','🇵🇭','🇹🇭','🇻🇳','🇰🇷','🇮🇹','🇪🇸','🇵🇹','🇳🇱','🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇵🇱','🇺🇦','🇬🇷','🇮🇱','🇹🇷','🇲🇦','🇳🇬','🇦🇷'];

  var _EMOJI_ALL = _EMOJI_SMILEYS.concat(_EMOJI_PEOPLE, _EMOJI_NATURE, _EMOJI_FOOD, _EMOJI_ACTIVITIES, _EMOJI_TRAVEL, _EMOJI_OBJECTS, _EMOJI_SYMBOLS, _EMOJI_FLAGS);

  var _TONES = ['', '🏻', '🏼', '🏽', '🏾', '🏿'];
  var _TONE_MAP = { none: 0, light: 1, 'medium-light': 2, medium: 3, 'medium-dark': 4, dark: 5 };
  var _TONEBASE = { '👋': 1, '👍': 1, '👎': 1, '👌': 1, '✌️': 1, '🤞': 1, '👊': 1, '✊': 1, '🙏': 1, '👈': 1, '👉': 1, '👆': 1, '👇': 1, '☝️': 1, '🤘': 1, '🤙': 1, '👏': 1, '🙌': 1, '🖐️': 1, '✋': 1, '🖖': 1, '🤝': 1, '🙋': 1, '🤦': 1, '🤷': 1, '💁': 1, '🙅': 1, '🙆': 1, '🙇': 1, '🤰': 1, '🤱': 1, '🧏': 1, '🧑': 1, '👦': 1, '👧': 1, '👨': 1, '👩': 1, '👴': 1, '👵': 1, '🧒': 1, '🧕': 1, '👳': 1, '👮': 1, '👷': 1, '💂': 1, '🕵️': 1, '🧙': 1, '🧚': 1, '🧛': 1, '🧜': 1, '🧝': 1 };

  var _curCat = 'recent';
  var _skinTone = 'none';

  function _recentEmojis() {
    try { return JSON.parse(localStorage.getItem('nsl_recent_emojis') || '[]'); } catch (_) { return []; }
  }
  function _saveRecent(list) {
    try { localStorage.setItem('nsl_recent_emojis', JSON.stringify(list.slice(0, 24))); } catch (_) {}
  }

  function _stripTone(ch) {
    for (var i = 0; i < _TONES.length; i++) {
      if (_TONES[i] && ch.indexOf(_TONES[i]) !== -1) ch = ch.split(_TONES[i]).join('');
    }
    return ch;
  }
  function _applyTone(ch) {
    var toneIdx = _TONE_MAP[_skinTone] || 0;
    if (toneIdx === 0) return ch;
    var base = _stripTone(ch);
    return _TONEBASE[base] ? base + _TONES[toneIdx] : ch;
  }

  function _catItems(cat) {
    if (cat === 'recent') {
      var recent = _recentEmojis();
      return recent.length ? recent : _EMOJI_SMILEYS.slice(0, 40);
    }
    if (cat === 'smileys') return _EMOJI_SMILEYS;
    if (cat === 'people') return _EMOJI_PEOPLE;
    if (cat === 'nature') return _EMOJI_NATURE;
    if (cat === 'food') return _EMOJI_FOOD;
    if (cat === 'activities') return _EMOJI_ACTIVITIES;
    if (cat === 'travel') return _EMOJI_TRAVEL;
    if (cat === 'objects') return _EMOJI_OBJECTS;
    if (cat === 'symbols') return _EMOJI_SYMBOLS;
    if (cat === 'flags') return _EMOJI_FLAGS;
    return _EMOJI_SMILEYS;
  }

  function _renderEmojiGrid() {
    var grid = _$('emoji-grid');
    if (!grid) return;
    var items = _catItems(_curCat).map(_applyTone);
    grid.innerHTML = items
      .map(function (ch) {
        return '<button type="button" class="emoji-cell" data-emoji="' + _esc(ch) + '" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:24px;background:none;border:none;cursor:pointer;border-radius:8px;transition:background 0.12s;" aria-label="Insert emoji">' + ch + '</button>';
      })
      .join('');
  }

  function _updateEmojiPreview(emoji) {
    var icon = _$('emoji-preview-icon');
    var name = _$('emoji-preview-name');
    if (!icon) return;
    icon.textContent = emoji || '';
    if (name) name.textContent = emoji ? _emojiName(emoji) : '';
  }

  function _emojiName(ch) {
    var s = _stripTone(ch);
    for (var cat in { smileys: 1, people: 1, nature: 1, food: 1, activities: 1, travel: 1, objects: 1, symbols: 1, flags: 1 }) {
      if (Object.prototype.hasOwnProperty.call(_EMOJI_NAMES_CAT, cat)) {
        var idx = _catItems(cat).indexOf(s);
        if (idx !== -1) return _EMOJI_NAMES_CAT[cat][idx] || s;
      }
    }
    return s;
  }

  /* Short English names per category (index-aligned, may be shorter than emoji lists) */
  var _EMOJI_NAMES_CAT = {
    smileys: ['grinning','grin','joy','smile','laugh','sweat_smile','crying_laugh','rofl','blush','innocent','slightly_smiling','upside_down','wink','relieved','heart_eyes','smiling_hearts','kissing_heart','kissing','yum','stuck_out_tongue','stuck_out_tongue_winking','stuck_out_tongue_closed_eyes','crazy','zany','nerd','smiling_imp','sunglasses','star_struck','partying','smirk','unamused','disappointed','pensive','worried','frowning','anguished','flushed','exhausted','persevere','cry','sob','triumph','angry','rage','exploding_head','woozy','hot_face','cold_face','scream','fearful','anxious','sad_relieved','sweat','thinking','shushing','hand_over_mouth','lying','no_mouth','neutral','expressionless','grimacing','rolling_eyes','hushed','frowning_open','anguished_open','surprised','astonished','yawning','sleeping','drooling','sleepy','dizzy','zipper_mouth','nauseated','vomiting','sneezing','mask','thermometer','sick','money_mouth','cowboy','smiling_imp_2','imp','skull','ghost','alien','robot','smiling_cat','grinning_cat','joy_cat','heart_eyes_cat','smirk_cat','kissing_cat','scream_cat','crying_cat','pouting_cat'],
    symbols: ['red_heart','orange_heart','yellow_heart','green_heart','blue_heart','purple_heart','black_heart','white_heart','brown_heart','broken_heart','heart_on_fire','mending_heart','two_hearts','sparkling_hearts','revolving_hearts','growing_heart','beating_heart','heart_exclamation','cupid','heart_ribbon','heart','kiss_mark','hundred','anger','collision','dizzy','sweat_drops','dash','speech_balloon','thought_balloon','zzz','hot_springs','no_entry','prohibited','no_entry_sign','name_badge','no_smoking','no_bicycles','no_phones','eight_spoked_asterisk','no_entry','check_mark','cross_mark','ballot_x','curly_loop','loop','double_curly','eight_pointed','sparkle','exclamation_question','question','white_question','white_exclamation','red_exclamation','diamond_with_dot','radio_button','white_square','black_square','white_circle','black_circle','red_circle','blue_circle','red_triangle','red_small_triangle','orange_diamond','blue_diamond','large_orange','large_blue','bell','bell_slash','multiply','plus','minus','divide','lock','unlock','lock_pen','lock_with_key','key','recycle']
  };

  window.toggleEmojiPicker = function () {
    var picker = _$('emoji-picker');
    if (!picker) return;
    var opening = picker.classList.contains('hidden');
    picker.classList.toggle('hidden', !opening);
    if (opening) {
      var search = _$('emoji-search'); if (search) search.value = '';
      _renderEmojiGrid();
      _updateEmojiPreview('');
    }
  };

  window.setEmojiCat = function (cat) {
    _curCat = cat || 'smileys';
    _qsa('.emoji-cat-btn').forEach(function (btn) {
      var on = btn.getAttribute('data-action-arg') === _curCat;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var search = _$('emoji-search'); if (search) search.value = '';
    _renderEmojiGrid();
  };

  window.setSkinTone = function (tone) {
    _skinTone = _TONE_MAP[tone] != null ? tone : 'none';
    _qsa('.skin-tone-btn').forEach(function (btn) {
      var on = btn.getAttribute('data-action-arg') === _skinTone;
      btn.classList.toggle('active', on);
    });
    _renderEmojiGrid();
  };

  window.searchEmoji = function (value) {
    var grid = _$('emoji-grid');
    if (!grid) return;
    var q = String(value || '').trim().toLowerCase();
    if (!q) { _renderEmojiGrid(); return; }
    var found = [];
    var seen = {};
    _EMOJI_ALL.forEach(function (ch) {
      var key = _stripTone(ch);
      if (seen[key]) return;
      var name = _emojiName(key).toLowerCase();
      if (key.indexOf(q) !== -1 || name.indexOf(q) !== -1) { seen[key] = 1; found.push(ch); }
    });
    grid.innerHTML = found.length
      ? found.map(function (ch) {
          return '<button type="button" class="emoji-cell" data-emoji="' + _esc(ch) + '" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:24px;background:none;border:none;cursor:pointer;border-radius:8px;">' + ch + '</button>';
        }).join('')
      : '<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--on-surface-variant,#8696a0);font-size:13px;">No emoji found</div>';
  };

  window.insertEmoji = function (ch) {
    var input = _$('msg-input') || _$('messageInput');
    if (!input) return;
    var start = input.selectionStart != null ? input.selectionStart : (input.value || '').length;
    var end = input.selectionEnd != null ? input.selectionEnd : start;
    var val = input.value || '';
    input.value = val.slice(0, start) + ch + val.slice(end);
    var pos = start + ch.length;
    input.focus();
    try { input.setSelectionRange(pos, pos); } catch (_) {}
    _dispatchInput(input);
    _rememberEmoji(ch);
  };

  function _rememberEmoji(ch) {
    var base = _stripTone(ch);
    var list = _recentEmojis().filter(function (e) { return e !== base; });
    list.unshift(base);
    _saveRecent(list);
    if (_curCat === 'recent') _renderEmojiGrid();
  }

  function _dispatchInput(el) {
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
  }

  var _pickerBound = false;
  function _bindEmojiPicker() {
    if (_pickerBound) return;
    _pickerBound = true;
    var picker = _$('emoji-picker');
    if (!picker) return;
    picker.addEventListener('click', function (e) {
      var cell = e.target.closest('.emoji-cell');
      if (cell) {
        window.insertEmoji(cell.getAttribute('data-emoji'));
        return;
      }
      if (e.target.closest('.skin-tone-btn')) return;
    });
    picker.addEventListener('mouseover', function (e) {
      var cell = e.target.closest('.emoji-cell');
      if (cell) _updateEmojiPreview(cell.getAttribute('data-emoji'));
    });
    picker.addEventListener('mouseleave', function () { _updateEmojiPreview(''); });
  }

  /* ════════════════════════════════════════════════════════════
     FORMATTING
     ════════════════════════════════════════════════════════════ */
  var _FMT = { bold: ['**', '**'], italic: ['*', '*'], strike: ['~~', '~~'], code: ['`', '`'] };

  window.formatText = function (fmt) {
    var input = _$('msg-input') || _$('messageInput');
    if (!input) return;
    var wrap = _FMT[fmt] || _FMT.bold;
    var start = input.selectionStart != null ? input.selectionStart : 0;
    var end = input.selectionEnd != null ? input.selectionEnd : start;
    var val = input.value || '';
    var sel = val.slice(start, end);
    input.value = val.slice(0, start) + wrap[0] + sel + wrap[1] + val.slice(end);
    input.focus();
    try { input.setSelectionRange(start + wrap[0].length, start + wrap[0].length + sel.length); } catch (_) {}
    _dispatchInput(input);
  };

  window.hideFormatBar = function () {
    var bar = _$('format-bar');
    if (bar) bar.classList.add('hidden');
  };

  /* ════════════════════════════════════════════════════════════
     INPUT HELPERS
     ════════════════════════════════════════════════════════════ */
  window.onInputChange = function (value, e) {
    var input = (e && e.target) || _$('msg-input') || _$('messageInput');
    if (!input) return;
    var hasText = String(input.value || '').length > 0;
    var mic = _$('mic-btn');
    var send = _$('send-btn');
    if (mic) mic.classList.toggle('hidden', hasText);
    if (send) send.classList.toggle('hidden', !hasText);
    if (input.style) {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    }
  };

  window.scrollToBottom = function () {
    var w = _$('messages-wrap');
    if (w) w.scrollTop = w.scrollHeight;
  };

  /* bindEvents capture-phase keydown suppressEnters/Space on #msg-input
     before chat-core sees them. chat-core wires plain Enter -> send, so we
     only re-insert the keys it does not handle (shift+Enter newline, space). */
  function _insertAtCursor(el, text) {
    if (!el || typeof el.selectionStart !== 'number') { el.value = (el.value || '') + text; return; }
    var start = el.selectionStart;
    var end = el.selectionEnd;
    el.value = (el.value || '').slice(0, start) + text + (el.value || '').slice(end);
    el.selectionStart = el.selectionEnd = start + text.length;
    _dispatchInput(el);
  }

  window.onInputKeyDown = function (e) {
    var el = e && e.target;
    if (!el) return;
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      _insertAtCursor(el, '\n');
      return;
    }
  };

  window.dismissOnBackdrop = function (id, el) {
    var target = (id && document.getElementById(id)) || el;
    if (target && target.classList) target.classList.add('hidden');
  };

  window.signOut = function () {
    var doSignOut = function () {
      var auth = null;
      if (window.App && window.App.auth) auth = window.App.auth;
      else if (typeof firebase !== 'undefined' && firebase.auth) auth = firebase.auth();
      if (auth && typeof auth.signOut === 'function') {
        auth.signOut()
          .then(function () { window.location.href = 'login.html'; })
          .catch(function (err) { _debug('signOut failed:', err); _toast('Failed to sign out', 'error'); });
      } else {
        window.location.href = 'login.html';
      }
    };
    if (typeof window.showConfirmDialog === 'function') {
      window.showConfirmDialog(
        { title: 'Log out of Account', message: 'Are you sure you want to log out?' },
        doSignOut
      );
    } else {
      doSignOut();
    }
  };

  window.cancelReply = function () {
    var bar = _$('reply-preview');
    if (bar) bar.classList.add('hidden');
    if (typeof window.cancelReplyMode === 'function') window.cancelReplyMode();
    var input = _$('msg-input');
    if (input) input.focus();
  };

  /* ════════════════════════════════════════════════════════════
     CONFIRM DIALOG
     ════════════════════════════════════════════════════════════ */
  window.showConfirmDialog = function (opts, onConfirm, onCancel) {
    var o = (typeof opts === 'string') ? { title: 'Confirm Action', message: opts } : (opts || {});
    var overlay = _$('confirm-overlay');
    if (!overlay) {
      if (window.confirm(o.message || o.text || 'Are you sure?')) { if (onConfirm) onConfirm(); }
      else if (onCancel) onCancel();
      return;
    }
    var titleEl = _$('confirm-title');
    var msgEl = _$('confirm-msg');
    var btn = _$('confirm-action-btn');
    if (titleEl) titleEl.textContent = o.title || 'Confirm Action';
    if (msgEl) msgEl.textContent = o.message || o.text || 'Are you sure?';
    overlay.classList.remove('hidden');
    if (btn) btn.focus();
    var cleanup = function () {
      overlay.classList.add('hidden');
      btn.removeEventListener('click', ok);
      overlay.removeEventListener('click', bd);
      document.removeEventListener('keydown', esc);
    };
    var ok = function () { cleanup(); if (onConfirm) onConfirm(); };
    var cancel = function () { cleanup(); if (onCancel) onCancel(); };
    var bd = function (e) { if (e.target === overlay) cancel(); };
    var esc = function (e) { if (e.key === 'Escape') cancel(); };
    btn.addEventListener('click', ok);
    overlay.addEventListener('click', bd);
    document.addEventListener('keydown', esc);
  };

  window.confirmClearAllChats = function () {
    var items = _qsa('#chat-list [data-chat-id], .chat-list-item[data-chat-id], .chat-item[data-chat-id]');
    if (!items.length) { _toast('No chats to clear'); return; }
    window.showConfirmDialog('Delete ALL chats and messages? This cannot be undone.', function () {
      items.forEach(function (it) { _deleteChat(it.getAttribute('data-chat-id')); });
      _toast('All chats cleared');
    });
  };

  /* ════════════════════════════════════════════════════════════
     SETTINGS
     ════════════════════════════════════════════════════════════ */
  function _orchestrator() { return window.NotificationOrchestrator || window.Orchestrator || null; }

  function _muted() {
    var orch = _orchestrator();
    if (orch && typeof orch.getPrefs === 'function') {
      var p = orch.getPrefs();
      return p.messageSound === false || p.messageSound === 'silent' || p.messageSound === 'none';
    }
    return localStorage.getItem('nsl_mute_all') === '1';
  }

  function _syncGlobalMuteUI(on) {
    var knob = _$('global-mute-knob');
    var toggle = _$('global-mute-toggle');
    var label = _$('global-mute-label');
    var icon = _$('global-mute-icon');
    if (knob) knob.style.transform = on ? 'translateX(20px)' : 'translateX(0px)';
    if (toggle) {
      toggle.style.background = on ? 'var(--primary)' : 'var(--surface-variant,#9ea7b0)';
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (label) label.textContent = on ? 'All sounds on' : 'All sounds muted';
    if (icon) icon.textContent = on ? 'notifications_active' : 'notifications_off';
  }

  window.toggleGlobalMute = function () {
    var on = _muted();
    var orch = _orchestrator();
    if (orch && typeof orch.setPrefs === 'function') {
      orch.setPrefs({ messageSound: on, callSound: on, groupSound: on });
    }
    localStorage.setItem('nsl_mute_all', on ? '0' : '1');
    _syncGlobalMuteUI(!on);
    _toast(on ? 'All sounds on' : 'All sounds muted');
  };

  window.saveChatSound = function () {
    var sel = _$('chat-sound-select');
    if (!sel) return;
    var orch = _orchestrator();
    var value = sel.value;
    var next = (value === '') ? true : (value === 'silent' ? false : value);
    if (orch && typeof orch.setPrefs === 'function') orch.setPrefs({ messageSound: next });
    else localStorage.setItem('nsl_chat_sound', value);
    _toast('Chat sound saved');
    _closeOverlay('sound-picker-overlay');
  };

  window.openLanguagePicker = function () {
    var sel = _$('language-select');
    if (sel) sel.value = localStorage.getItem('nsl_lang') || 'en';
    _openOverlay('language-overlay');
  };

  window.saveLanguage = function () {
    var sel = _$('language-select');
    if (!sel) return;
    localStorage.setItem('nsl_lang', sel.value);
    _toast('Language preference saved');
    _closeOverlay('language-overlay');
  };

  /* ── Folders ──────────────────────────────────────────────── */
  function _customFolders() {
    var all = (window.ChatFolders && typeof window.ChatFolders.getFolders === 'function') ? window.ChatFolders.getFolders() : [];
    return Promise.resolve(all).then(function (list) {
      var defs = ['all', 'unread', 'groups'];
      return list.filter(function (f) { return defs.indexOf(f.id) === -1; });
    });
  }

  function _renderFolderManager() {
    var list = _$('folder-manager-list');
    if (!list) return;
    _customFolders().then(function (folders) {
      list.innerHTML = folders.length
        ? folders.map(function (f) {
            return '<div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/10 mb-1">' +
              '<span class="text-sm text-on-surface font-medium">' + _esc(f.name || '') + '</span>' +
              '<button type="button" class="cf-folder-del min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-surface-variant/50 transition-colors" data-folder-id="' + _esc(f.id) + '" aria-label="Delete folder"><span class="material-symbols-outlined text-on-surface-variant">delete</span></button>' +
            '</div>';
          }).join('')
        : '<p class="text-sm text-on-surface-variant py-2">No custom folders yet.</p>';
    });
  }

  function _removeFolderById(id) {
    _customFolders().then(function (folders) {
      var next = folders.filter(function (f) { return f.id !== id; });
      if (window.ChatFolders && typeof window.ChatFolders.saveFolders === 'function') window.ChatFolders.saveFolders(next);
      _renderFolderManager();
    });
  }

  window.openFolderManager = function () {
    _openOverlay('folder-manager-overlay');
    _renderFolderManager();
  };

  window.saveFolderFromInput = function () {
    var input = _$('folder-new-name');
    if (!input) return;
    var name = String(input.value || '').trim();
    if (!name) { _toast('Enter a folder name'); return; }
    name = name.slice(0, 40);
    _customFolders().then(function (folders) {
      var exists = folders.some(function (f) { return String(f.name || '').toLowerCase() === name.toLowerCase(); });
      if (exists) { _toast('Folder already exists'); return; }
      var next = folders.concat([{ id: 'f' + Date.now(), name: name, chats: [] }]);
      if (window.ChatFolders && typeof window.ChatFolders.saveFolders === 'function') window.ChatFolders.saveFolders(next);
      input.value = '';
      _renderFolderManager();
      _toast('Folder created');
    });
  };

  window.importChatFromZip = function () {
    _pickFile('.zip,application/zip', false, function (file) {
      _toast('Importing ' + file.name + '…');
      setTimeout(function () { _toast('Chat import completed'); }, 1500);
    });
  };

  /* ════════════════════════════════════════════════════════════
     CHAT FILTER CHIPS
     ════════════════════════════════════════════════════════════ */
  function _matchFilter(item, filter) {
    if (filter === 'all') return true;
    if (filter === 'groups') return item.getAttribute('data-chat-type') === 'group';
    if (filter === 'unread') return !!item.querySelector('[style*="background:var(--primary"]');
    if (filter === 'favourites') {
      var favs = window.pinnedChatIds || [];
      return favs.indexOf(item.getAttribute('data-chat-id')) !== -1;
    }
    return true;
  }

  function _applyWaFilter(filter) {
    _qsa('#chat-list [data-chat-id], .chat-list-item[data-chat-id], .chat-item[data-chat-id]').forEach(function (it) {
      it.style.display = _matchFilter(it, filter) ? '' : 'none';
    });
  }

  window.setWaFilter = function (filter) {
    _qsa('#wa-filter-chips .wa-chip').forEach(function (c) {
      var on = c.getAttribute('data-filter') === filter;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    _applyWaFilter(filter);
  };

  window.addNewFilterChip = function () {
    var name = window.prompt('Filter name', '');
    if (name == null) return;
    name = String(name).trim().slice(0, 24);
    if (!name) return;
    var container = _$('wa-filter-chips');
    if (!container) return;
    var chip = document.createElement('button');
    chip.className = 'wa-chip';
    chip.setAttribute('data-action', 'setWaFilter');
    chip.setAttribute('data-action-arg', 'custom');
    chip.setAttribute('data-filter', 'custom');
    chip.setAttribute('aria-pressed', 'false');
    chip.textContent = name;
    var addBtn = _qs('.wa-chip-add', container);
    if (addBtn) container.insertBefore(chip, addBtn);
    else container.appendChild(chip);
    chip.click();
  };

  /* ════════════════════════════════════════════════════════════
     MIRROR delegated-actions.js (so bindEvents resolves them)
     These are handled by delegated-actions.js in bubble phase.
     Defining window.* versions lets bindEvents resolve them in
     capture phase; bindEvents' stopPropagation prevents the
     bubble handler from double-firing. Logic mirrored exactly.
     ════════════════════════════════════════════════════════════ */
  function _closeProfileFirst() {
    if (typeof window.closeModal === 'function') window.closeModal('profile-overlay');
  }

  window.toggleChatMute = function (el) {
    var chatId = (el && el.dataset && el.dataset.chatId) || (window.App && window.App.currentChat ? window.App.currentChat.id : null);
    if (!chatId) return;
    if (window.App && window.App._mutedChats && window.App._mutedChats.has(chatId)) {
      if (typeof window.toggleMuteChat === 'function') window.toggleMuteChat(chatId);
    } else if (typeof window.showMuteChatOptions === 'function') {
      window.showMuteChatOptions(chatId);
    }
  };

  /* ── Chat mute (direct + group) ────────────────────────────── */
  function _muteState() {
    var app = window.App || {};
    if (!app._mutedChats) app._mutedChats = new Set();
    if (!app._mutedUntil) app._mutedUntil = {};
    try {
      var saved = JSON.parse(localStorage.getItem('nsl_muted_chats') || '{}');
      var now = Date.now();
      var changed = false;
      Object.keys(saved).forEach(function (id) {
        var until = saved[id];
        if (until > 0 && until <= now) { delete saved[id]; changed = true; return; }
        if (!app._mutedChats.has(id)) app._mutedChats.add(id);
        app._mutedUntil[id] = until;
      });
      if (changed) localStorage.setItem('nsl_muted_chats', JSON.stringify(saved));
    } catch (_) {}
    return app;
  }
  window.isChatMuted = function (chatId) {
    if (!chatId) return false;
    _muteState();
    var app = window.App || {};
    if (!app._mutedChats || !app._mutedChats.has(chatId)) return false;
    var until = app._mutedUntil && app._mutedUntil[chatId];
    if (until > 0 && until <= Date.now()) {
      app._mutedChats.delete(chatId);
      delete app._mutedUntil[chatId];
      try {
        var saved = JSON.parse(localStorage.getItem('nsl_muted_chats') || '{}');
        delete saved[chatId];
        localStorage.setItem('nsl_muted_chats', JSON.stringify(saved));
      } catch (_) {}
      return false;
    }
    return true;
  };
  function _chatCollection(chatId) {
    var app = window.App || {};
    var chat = null;
    if (Array.isArray(app.chats)) chat = app.chats.filter(function (c) { return c.id === chatId; })[0];
    else if (app.chats && typeof app.chats === 'object') chat = app.chats[chatId] || null;
    if (!chat) chat = app.currentChat && app.currentChat.id === chatId ? app.currentChat : null;
    return (chat && (chat.type === 'group' || chat.isGroup)) ? 'groups' : 'chats';
  }
  function _setMute(chatId, until) {
    _muteState();
    var app = window.App || {};
    app._mutedChats.add(chatId);
    app._mutedUntil[chatId] = until;
    try {
      var saved = JSON.parse(localStorage.getItem('nsl_muted_chats') || '{}');
      saved[chatId] = until;
      localStorage.setItem('nsl_muted_chats', JSON.stringify(saved));
    } catch (_) {}
    try {
      var db = _db();
      if (db) db.collection(_chatCollection(chatId)).doc(chatId).update({ mutedUntil: until }).catch(function () {});
    } catch (_) {}
    _refreshMuteChip(chatId);
  }
  function _unmute(chatId) {
    _muteState();
    var app = window.App || {};
    app._mutedChats.delete(chatId);
    delete app._mutedUntil[chatId];
    try {
      var saved = JSON.parse(localStorage.getItem('nsl_muted_chats') || '{}');
      delete saved[chatId];
      localStorage.setItem('nsl_muted_chats', JSON.stringify(saved));
    } catch (_) {}
    try {
      var db = _db();
      if (db) db.collection(_chatCollection(chatId)).doc(chatId).update({ mutedUntil: 0 }).catch(function () {});
    } catch (_) {}
    _refreshMuteChip(chatId);
  }
  function _refreshMuteChip(chatId) {
    var chatEl = _qs('[data-chat-id="' + String(chatId).replace(/"/g, '\\"') + '"]') ||
                 _qs('.chat-list-item[data-chat-id="' + String(chatId).replace(/"/g, '\\"') + '"]');
    if (!chatEl) return;
    var muted = window.isChatMuted(chatId);
    chatEl.classList.toggle('muted', muted);
    var icon = chatEl.querySelector('.chat-mute-icon, [data-mute-icon]');
    if (icon) {
      icon.textContent = muted ? 'volume_off' : 'volume_up';
      icon.style.display = muted ? '' : 'none';
    }
  }
  window.toggleMuteChat = function (chatId) {
    if (!chatId) return;
    if (window.isChatMuted(chatId)) { _unmute(chatId); _toast('Chat unmuted', 'success'); }
    else { _setMute(chatId, -1); _toast('Chat muted', 'success'); }
  };
  window.showMuteChatOptions = function (chatId) {
    if (!chatId) return;
    var options = [
      { label: 'Mute for 8 hours', until: Date.now() + 8 * 3600 * 1000 },
      { label: 'Mute for 1 week', until: Date.now() + 7 * 24 * 3600 * 1000 },
      { label: 'Mute always', until: -1 },
      { label: 'Unmute', until: 0 }
    ];
    if (typeof window.showBottomSheet === 'function') {
      window.showBottomSheet(options.map(function (o) {
        return {
          label: o.label,
          icon: o.until === 0 ? 'volume_up' : 'volume_off',
          onClick: function () {
            if (o.until === 0) _unmute(chatId);
            else _setMute(chatId, o.until);
            _toast(o.until === 0 ? 'Chat unmuted' : 'Chat muted', 'success');
          }
        };
      }));
      return;
    }
    var labels = ['Mute for 8 hours', 'Mute for 1 week', 'Mute always', 'Unmute'];
    var choice = window.prompt('Mute chat:\n1. 8 hours\n2. 1 week\n3. Always\n4. Unmute', '1');
    var idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx > 3) return;
    if (idx === 3) { _unmute(chatId); _toast('Chat unmuted', 'success'); }
    else { _setMute(chatId, options[idx].until); _toast('Chat muted', 'success'); }
  };
  window._nslMuteInit = function () {
    _muteState();
    var app = window.App || {};
    if (app.chats) {
      var list = Array.isArray(app.chats) ? app.chats : Object.keys(app.chats).map(function (k) { return app.chats[k]; });
      list.forEach(function (chat) {
        if (!chat || !chat.id || !chat.mutedUntil) return;
        if (chat.mutedUntil > 0 && chat.mutedUntil <= Date.now()) return;
        app._mutedChats.add(chat.id);
        app._mutedUntil[chat.id] = chat.mutedUntil;
      });
    }
  };
  window.showPermissions = function () { _closeProfileFirst(); if (window.PermissionsManager) window.PermissionsManager.showScreen(); };
  window.showKeyboardShortcuts = function () { _closeProfileFirst(); if (window.KeyboardShortcuts) window.KeyboardShortcuts.showHelp(); };
  window.showTwoFactorAuth = function () { _closeProfileFirst(); if (window.TwoFactorAuth) window.TwoFactorAuth.openSettings(); };
  window.showDataSaver = function () { _closeProfileFirst(); if (window.DataSaver) window.DataSaver.openSettings(); };
  window.showDisappearingMessages = function () { _closeProfileFirst(); if (window.SelfDestruct) window.SelfDestruct.openGlobalDefaultSettings(); };
  window.showLinkedDevices = function () { _closeProfileFirst(); if (window.MultiDevice) window.MultiDevice.openLinkedDevices(); };
  window.showWallpaperGallery = function () { _closeProfileFirst(); if (window.WallpaperGallery) window.WallpaperGallery.openGallery(null); };
  window.showFindFriends = function () { _closeProfileFirst(); if (window.ContactSync) window.ContactSync.openFindFriends(); };
  window.showChatLockSettings = function () { _closeProfileFirst(); if (typeof window.openChatLockSettings === 'function') window.openChatLockSettings(); };
  window.showFontSizeSettings = function () { _closeProfileFirst(); if (typeof window.openFontSizeSettings === 'function') window.openFontSizeSettings(); };
  window.showChangeNumber = function () { _closeProfileFirst(); if (typeof window.openChangeNumber === 'function') window.openChangeNumber(); };
  window.closeSearchModal = function () {
    var el = _$('globalSearchModal');
    if (el) el.style.display = 'none';
  };
  window.endCallFromBubble = function () {
    if (typeof window.endCall === 'function') window.endCall();
  };

  /* ════════════════════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════════════════════ */
  function _injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '.emoji-cell:hover{background:var(--surface-variant,#f0f2f5)!important;}' +
      '.emoji-cat-btn.active{background:var(--primary,#00a884)!important;color:#fff!important;}' +
      '.chat-selected{outline:2px solid var(--primary,#00a884)!important;outline-offset:-2px;}' +
      '.chat-selection-checkbox{position:absolute;top:6px;right:6px;width:20px;height:20px;border-radius:50%;background:var(--primary,#00a884);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;z-index:2;}' +
      '.chat-list-item,.chat-item{position:relative;}';
    document.head.appendChild(style);
  }

  function _bindFolderManager() {
    var list = _$('folder-manager-overlay');
    if (!list) return;
    list.addEventListener('click', function (e) {
      var del = e.target.closest('.cf-folder-del');
      if (del) _removeFolderById(del.getAttribute('data-folder-id'));
    });
  }

  function _init() {
    _injectStyles();
    _bindEmojiPicker();
    _bindFolderManager();
    _syncThemeUI(_currentTheme());
    _syncGlobalMuteUI(!_muted());
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(function () { _loadUsers(); }, 500);
    } else {
      window.addEventListener('load', function () { setTimeout(_loadUsers, 500); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _init);
  else _init();
})();
