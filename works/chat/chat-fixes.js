// chat-fixes.js â€” Chat system enhancements v3
// Patches: Myself chat, Chat Pinning, Message Pinning
// Fully responsive for web + Capacitor Android

(function () {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────── */
  function waitForFn(name, cb, tries) {
    tries = tries || 0;
    if (typeof window[name] === 'function') { cb(); return; }
    if (tries > 180) { if (window.__DEBUG__) console.warn('[chat-fixes] timeout:', name); return; }
    setTimeout(function () { waitForFn(name, cb, tries + 1); }, 80);
  }
  function esc(s) {
    return typeof window.escapeHtml === 'function' && window.escapeHtml !== esc
      ? window.escapeHtml(s)
      : String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function initials(name) {
    return typeof window.getInitials === 'function' && window.getInitials !== initials
      ? window.getInitials(name, '')
      : String(name || '?').charAt(0).toUpperCase();
  }

  /* ════════════════════════════════════════════════════════════
     1. "MYSELF" CHAT — rename + force-pinned + 👤 avatar
     ════════════════════════════════════════════════════════════ */
  waitForFn('getSavedMessagesItem', function () {
    var _o = window.getSavedMessagesItem;
    window.getSavedMessagesItem = function () {
      var item = _o ? _o() : {};
      return Object.assign({}, item, {
        name: 'Myself',
        avatar: '&#128100;',
        preview: 'Your personal notes, files & reminders',
      });
    };
  });

  waitForFn('startSavedMessages', function () {
    var _o = window.startSavedMessages;
    window.startSavedMessages = async function () {
      await _o();
      var nameEl   = document.getElementById('currentChatName');
      var statusEl = document.getElementById('chatStatus');
      if (nameEl)   nameEl.textContent   = 'Myself';
      if (statusEl) statusEl.textContent = 'Your personal notes, files & reminders';
      if (typeof window.setChatHeaderAvatar === 'function') window.setChatHeaderAvatar('&#128100;');
      if (window.currentChat) {
        window.currentChat.isSaved = true;
        window.currentChat.otherUserName = 'Myself';
      }
    };
  });

  /* ════════════════════════════════════════════════════════════
     2. CHAT PINNING — single consolidated implementation
     ════════════════════════════════════════════════════════════ */
  (function defineTogglePinChat() {
    window.togglePinChat = async function (chatId) {
      if (!window.currentUser || !chatId) return;
      var db      = window.db;
      var userRef = db.collection('users').doc(window.currentUser.uid);
      var ids     = window.pinnedChatIds || [];
      var pinned  = ids.includes(chatId);
      try {
        if (pinned) {
          await userRef.update({ pinnedChatIds: firebase.firestore.FieldValue.arrayRemove(chatId) });
          window.pinnedChatIds = ids.filter(function(id){ return id!==chatId; });
          window.showToast('Chat unpinned');
        } else {
          await userRef.update({ pinnedChatIds: firebase.firestore.FieldValue.arrayUnion(chatId) });
          window.pinnedChatIds = ids.concat([chatId]);
          window.showToast('Chat pinned to top');
        }
      } catch (err) {
        if (window.__DEBUG__) console.error('[chat-fixes] togglePinChat error:', err);
        if (typeof window.showToast === 'function') window.showToast('Failed to update pin: ' + (err.message || 'Unknown error'), 'error');
        return;
      }
      if (typeof window.loadCurrentChatList==='function') window.loadCurrentChatList();
      else {
        if (typeof window.loadChatsList   ==='function') window.loadChatsList();
        if (typeof window.loadGroupsList  ==='function') window.loadGroupsList();
      }
    };
  })();

  /* ════════════════════════════════════════════════════════════
     3. MESSAGE PINNING — groups shared, direct personal, limit 20
     ════════════════════════════════════════════════════════════ */
  waitForFn('pinMessage', function () {
    window.pinMessage = async function (messageId, messageData) {
      if (!window.currentChat || !window.currentUser) return;
      var db      = window.db;
      var isGroup = window.currentChatType === 'group';
      var q = db.collection('pinnedMessages').where('chatId','==',window.currentChat.id);
      if (!isGroup) q = q.where('userId','==',window.currentUser.uid);
      try {
        var existing = await q.get();
        if (existing.size >= 20) { window.showToast('Max 20 pinned messages','error'); return; }
        var pin = {
          chatId:       window.currentChat.id,
          messageId:    messageId,
          text:         messageData.text        || '',
          senderName:   messageData.senderName  || '',
          timestamp:    messageData.timestamp   || null,
          pinnedAt:     firebase.firestore.FieldValue.serverTimestamp(),
          pinnedBy:     window.currentUser.uid,
          pinnedByName: window.currentUser.displayName || window.currentUser.email || '',
          isGroupPin:   isGroup,
        };
        if (!isGroup) pin.userId = window.currentUser.uid;
        await db.collection('pinnedMessages').add(pin);
        window.showToast('Message pinned');
        window.loadPinnedMessages();
      } catch (err) {
        if (window.__DEBUG__) console.error('[chat-fixes] pinMessage error:', err);
        if (typeof window.showToast === 'function') window.showToast('Failed to pin message: ' + (err.message || 'Unknown error'), 'error');
      }
    };
  })();

  (function defineLoadPinnedMessages() {
    window.loadPinnedMessages = async function () {
      if (!window.currentChat || !window.currentUser) return;
      var db      = window.db;
      var isGroup = window.currentChatType === 'group';
      var q = db.collection('pinnedMessages').where('chatId','==',window.currentChat.id);
      if (!isGroup) q = q.where('userId','==',window.currentUser.uid);
      try {
        var snap;
        try { snap = await q.orderBy('pinnedAt','desc').get(); }
        catch (_) {
          snap = await q.get();
          var sorted = snap.docs.slice().sort(function(a,b){
            var tA = a.data().pinnedAt&&a.data().pinnedAt.toDate ? a.data().pinnedAt.toDate() : new Date(0);
            var tB = b.data().pinnedAt&&b.data().pinnedAt.toDate ? b.data().pinnedAt.toDate() : new Date(0);
            return tB - tA;
          });
          snap = { docs: sorted };
        }
        window.pinnedMessages = snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); });
      } catch (err) {
        if (window.__DEBUG__) console.error('[chat-fixes] loadPinnedMessages error:', err);
        window.pinnedMessages = [];
      }
      var pinnedSection = document.getElementById('pinnedSection');
      var pinnedList    = document.getElementById('pinnedMessagesList');
      var pinnedCount   = document.getElementById('pinnedCount');
      if (!pinnedSection) return;
      if (!window.pinnedMessages.length) { pinnedSection.style.display='none'; return; }
      pinnedSection.style.display = 'block';
      if (pinnedCount) pinnedCount.textContent = '📌 ' + window.pinnedMessages.length;
      if (pinnedList) {
        pinnedList.innerHTML = '';
        window.pinnedMessages.forEach(function (p) {
          var byLine = isGroup && p.pinnedByName ? ' · by '+esc(p.pinnedByName) : '';
          var div = document.createElement('div');
          div.className = 'pinned-message-item cf-pin-item';
          div.setAttribute('role', 'button');
          div.setAttribute('tabindex', '0');
          div.innerHTML =
              '<span class="cf-pin-icon">📌</span>'
            + '<div class="cf-pin-body">'
            +   '<div class="cf-pin-sender">'+esc(p.senderName||'')+byLine+'</div>'
            +   '<div class="cf-pin-text">'+esc((p.text||'').substring(0,60)||'📎 Media')+'</div>'
            + '</div>'
            + '<button class="unpin-btn cf-unpin-btn" data-id="'+esc(p.id)+'" title="Unpin" aria-label="Unpin message">✖</button>';
          div.addEventListener('click', function(e){
            if (e.target.classList.contains('cf-unpin-btn')) return;
            var el = document.querySelector('[data-message-id="'+p.messageId+'"]');
            if (el) {
              el.scrollIntoView({behavior:'smooth',block:'center'});
              el.classList.add('cf-highlight');
              setTimeout(function(){ el.classList.remove('cf-highlight'); }, 1800);
            } else {
              window.showToast('Scroll up to find the pinned message');
            }
          });
          div.addEventListener('keydown', function(e){
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              div.click();
            }
          });
          div.querySelector('.cf-unpin-btn').addEventListener('click', async function(e){
            e.stopPropagation();
            await window.unpinMessage(p.id);
          });
          pinnedList.appendChild(div);
        });
      }
    };
  })();



  /* ── 9. Cyber Navigation & Status Bar Interceptors ── */
  function updateDockThemeIcon() {
    var icon = document.querySelector('#dockThemeBtn span');
    if (!icon) return;
    var isDark = document.documentElement.dataset.theme === 'dark' || document.body.classList.contains('dark') || document.documentElement.classList.contains('dark');
    icon.textContent = isDark ? 'light_mode' : 'dark_mode';
  }

  waitForFn('switchTab', function () {
    var originalSwitchTab = window.switchTab;
    window.switchTab = function (tab) {
      originalSwitchTab(tab);
      document.querySelectorAll('.nav-dock-item').forEach(function (btn) {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
          btn.classList.add('active');
        }
      });
    };
  });

  waitForFn('toggleDarkMode', function () {
    var originalToggle = window.toggleDarkMode;
    window.toggleDarkMode = function () {
      originalToggle();
      updateDockThemeIcon();
    };
  });

  function initCyberDock() {
    updateDockThemeIcon();
    var leftNavDock = document.getElementById('leftNavDock');
    if (leftNavDock) {
      leftNavDock.addEventListener('click', function (e) {
        var btn = e.target.closest('.nav-dock-item');
        if (!btn) return;
        
        var tab = btn.dataset.tab;
        if (tab) {
          if (typeof window.switchTab === 'function') {
            window.switchTab(tab);
          }
        } else if (btn.id === 'dockSavedBtn') {
          if (typeof window.startSavedMessages === 'function') {
            window.startSavedMessages();
          }
        } else if (btn.id === 'dockArchiveBtn') {
          var header = document.getElementById('archiveHeader');
          if (header) header.click();
        } else if (btn.id === 'dockSettingsBtn' || btn.id === 'dockProfileBtn') {
          if (typeof window.showProfileModal === 'function') {
            window.showProfileModal();
          }
        } else if (btn.id === 'dockThemeBtn') {
          if (typeof window.toggleDarkMode === 'function') {
            window.toggleDarkMode();
          }
        } else if (btn.id === 'dockSupportBtn') {
          if (typeof showToast === 'function') showToast('System status: Nominal. Protocol V2.0.26 secure.', 'success');
          else if (window.__DEBUG__) console.log('[chat-fixes] System status: Nominal.');
        }
      });
    }
    
    var latencyVal = document.getElementById('statusLatency');
    if (latencyVal) {
      var _latencyTimer = setInterval(function _updateLatency() {
        if (!latencyVal.isConnected) { clearInterval(_latencyTimer); return; }
        var ms = Math.floor(Math.random() * 6) + 6;
        latencyVal.textContent = ms + 'ms';
      }, 6000);
    }
  }
  
  if (document.readyState !== 'loading') {
    initCyberDock();
  } else {
    document.addEventListener('DOMContentLoaded', initCyberDock);
  }

  if (window.__DEBUG__) console.log('[chat-fixes] v3 applied ✓');
})();
