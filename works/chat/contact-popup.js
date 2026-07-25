/**
 * NSL Chat — Group Contact Popup
 * WhatsApp-style profile card when clicking a sender's name/avatar in group chats.
 * Shows: profile pic, name, email, phone, message/audio/video call buttons.
 */
;(function () {
  'use strict';

  var _popupEl = null;
  var _dismissHandler = null;

  /* ── Build popup HTML ── */
  function buildPopupHTML(uid, senderName, contact) {
    var photoURL = (contact && contact.photoURL) || '';
    var email = (contact && contact.email) || '';
    var phone = (contact && contact.phone) || '';
    var initials = senderName ? senderName.charAt(0).toUpperCase() : '?';
    var about = (contact && contact.about) || '';

    var avatarHTML = photoURL
      ? '<img src="' + escH(photoURL) + '" alt="' + escH(senderName) + '" class="w-16 h-16 rounded-full object-cover border-2 border-primary/30 shadow-lg">'
      : '<div class="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold bg-primary/10 text-primary border-2 border-primary/30 shadow-lg">' + escH(initials) + '</div>';

    var infoRows = '';
    if (email) {
      infoRows += '<div class="flex items-center gap-3 py-2">' +
        '<span class="material-symbols-outlined text-sm text-on-surface-variant">email</span>' +
        '<span class="text-sm text-on-surface truncate">' + escH(email) + '</span>' +
        '</div>';
    }
    if (phone) {
      infoRows += '<div class="flex items-center gap-3 py-2">' +
        '<span class="material-symbols-outlined text-sm text-on-surface-variant">phone</span>' +
        '<span class="text-sm text-on-surface">' + escH(phone) + '</span>' +
        '</div>';
    }
    if (about) {
      infoRows += '<div class="flex items-center gap-3 py-2">' +
        '<span class="material-symbols-outlined text-sm text-on-surface-variant">info</span>' +
        '<span class="text-sm text-on-surface-variant italic truncate">' + escH(about) + '</span>' +
        '</div>';
    }

    return '' +
      '<div class="cp-overlay" id="contact-popup-overlay">' +
        '<div class="cp-card" role="dialog" aria-label="Contact profile">' +
          '<div class="cp-header">' +
            '<button class="cp-close" id="contact-popup-close" aria-label="Close">' +
              '<span class="material-symbols-outlined">close</span>' +
            '</button>' +
          '</div>' +
          '<div class="cp-body">' +
            '<div class="flex flex-col items-center gap-3 mb-4">' +
              avatarHTML +
              '<div class="text-center">' +
                '<h3 class="text-lg font-bold text-on-surface">' + escH(senderName) + '</h3>' +
                '<p class="text-xs text-on-surface-variant">' + escH(email || 'No email') + '</p>' +
              '</div>' +
            '</div>' +
            (infoRows ? '<div class="cp-info-section">' + infoRows + '</div>' : '') +
            '<div class="cp-actions">' +
              '<button class="cp-action-btn cp-action-primary" data-action-cp="message" data-uid="' + escH(uid) + '">' +
                '<span class="material-symbols-outlined">chat</span>' +
                '<span class="text-xs font-semibold">Message</span>' +
              '</button>' +
              '<button class="cp-action-btn cp-action-voice" data-action-cp="voice" data-uid="' + escH(uid) + '" data-name="' + escH(senderName) + '">' +
                '<span class="material-symbols-outlined">call</span>' +
                '<span class="text-xs font-semibold">Audio</span>' +
              '</button>' +
              '<button class="cp-action-btn cp-action-video" data-action-cp="video" data-uid="' + escH(uid) + '" data-name="' + escH(senderName) + '">' +
                '<span class="material-symbols-outlined">videocam</span>' +
                '<span class="text-xs font-semibold">Video</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ── Minimal HTML escaper ── */
  function escH(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── Resolve user info from App caches ── */
  function resolveContact(uid) {
    if (!uid) return null;

    /* Check App.contacts */
    if (typeof App !== 'undefined' && App.contacts) {
      for (var i = 0; i < App.contacts.length; i++) {
        var c = App.contacts[i];
        if (c.uid === uid || c.id === uid) return c;
      }
    }

    /* Check App.chats */
    if (typeof App !== 'undefined' && App.chats) {
      for (var j = 0; j < App.chats.length; j++) {
        var ch = App.chats[j];
        if (ch.uid === uid || ch.id === uid) return ch;
      }
    }

    /* Check global member arrays */
    var globals = [window.teamMembers, window._members, window.groupMembers, window._groupMembers, window.allUsers];
    for (var g = 0; g < globals.length; g++) {
      if (!Array.isArray(globals[g])) continue;
      for (var k = 0; k < globals[g].length; k++) {
        var m = globals[g][k];
        if (m.id === uid || m.uid === uid) return m;
      }
    }

    /* Check current chat members */
    if (typeof App !== 'undefined' && App.currentChat && App.currentChat.members) {
      var members = App.currentChat.members;
      for (var n = 0; n < members.length; n++) {
        var mem = members[n];
        if ((mem.id || mem.uid) === uid) return mem;
      }
    }

    return null;
  }

  /* ── Show the popup ── */
  function showContactPopup(uid, senderName, anchorEl) {
    closeContactPopup();

    var contact = resolveContact(uid);
    var name = senderName || (contact && (contact.name || contact.displayName)) || 'Unknown';

    _popupEl = document.createElement('div');
    _popupEl.innerHTML = buildPopupHTML(uid, name, contact);
    document.body.appendChild(_popupEl.firstElementChild);

    /* Position near anchor but keep on screen */
    var card = document.getElementById('contact-popup-overlay');
    if (!card) return;

    /* Attach action handlers */
    card.addEventListener('click', function (e) {
      var actionBtn = e.target.closest('[data-action-cp]');
      if (!actionBtn) {
        if (e.target === card || e.target.classList.contains('cp-overlay')) {
          closeContactPopup();
        }
        return;
      }

      var action = actionBtn.getAttribute('data-action-cp');
      var actionUid = actionBtn.getAttribute('data-uid');
      var actionName = actionBtn.getAttribute('data-name');

      e.preventDefault();
      e.stopPropagation();

      if (action === 'message') {
        closeContactPopup();
        if (typeof window.openChat === 'function') {
          window.openChat(actionUid);
        } else if (typeof window.openPrivateChat === 'function') {
          window.openPrivateChat(actionUid);
        }
      } else if (action === 'voice') {
        closeContactPopup();
        if (typeof window.callContact === 'function') {
          window.callContact(actionUid, 'voice');
        } else if (typeof window.startCall === 'function') {
          window.startCall(actionUid, 'voice');
        }
      } else if (action === 'video') {
        closeContactPopup();
        if (typeof window.callContact === 'function') {
          window.callContact(actionUid, 'video');
        } else if (typeof window.startCall === 'function') {
          window.startCall(actionUid, 'video');
        }
      }
    });

    /* Close button */
    var closeBtn = document.getElementById('contact-popup-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeContactPopup();
      });
    }

    /* Dismiss on outside click (delayed to avoid catching the opening click) */
    setTimeout(function () {
      _dismissHandler = function (e) {
        var cpCard = document.querySelector('.cp-card');
        if (cpCard && !cpCard.contains(e.target)) {
          closeContactPopup();
        }
      };
      document.addEventListener('pointerdown', _dismissHandler, true);
    }, 100);

    /* Dismiss on Escape */
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        closeContactPopup();
        document.removeEventListener('keydown', escHandler, true);
      }
    }, true);
  }

  function closeContactPopup() {
    if (_dismissHandler) {
      document.removeEventListener('pointerdown', _dismissHandler, true);
      _dismissHandler = null;
    }
    if (_popupEl) {
      _popupEl.remove();
      _popupEl = null;
    }
  }

  /* ── Expose globally ── */
  window.showContactPopup = showContactPopup;
  window.closeContactPopup = closeContactPopup;

  /* ── Wrap renderSingleMessageHTML to make sender names clickable ── */
  function patchRender() {
    if (typeof window.renderSingleMessageHTML !== 'function') return;
    var orig = window.renderSingleMessageHTML;
    window.renderSingleMessageHTML = function (msg, msgs, i, lastDate) {
      try {
        var html = orig(msg, msgs, i, lastDate);
        if (!App.currentChat || App.currentChat.type !== 'group') return html;
        if (msg.from === 'me') return html;
        if (msg.type === 'call') return html;

      /* Find the sender name div and add click handler + cursor style */
      var senderPattern = /(<div class="text-\[10px\][^"]*font-bold mb-1 ml-2">)([^<]+)(<\/div>)/;
      var match = html.match(senderPattern);
      if (!match) return html;

      var senderUid = msg.from || '';
      var senderName = match[2];
      var clickable = '<div class="text-[10px] text-primary font-bold mb-1 ml-2 cursor-pointer hover:underline select-none cp-sender-name" data-cp-uid="' + escH(senderUid) + '" data-cp-name="' + escH(senderName) + '">' + senderName + '</div>';
      html = html.replace(match[0], clickable);

      return html;
      } catch (e) {
        try { return orig(msg, msgs, i, lastDate); } catch (_) { return ''; }
      }
    };
  }

  /* ── Event delegation for sender name clicks ── */
  function bindSenderClicks() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('.cp-sender-name');
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      var uid = el.getAttribute('data-cp-uid');
      var name = el.getAttribute('data-cp-name');
      if (uid) showContactPopup(uid, name, el);
    }, true);
  }

  /* ── Init ── */
  function init() {
    patchRender();
    bindSenderClicks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
