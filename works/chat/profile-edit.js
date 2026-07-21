'use strict';
(function () {
  var _activeOverlay = null;
  var CLOUDINARY_CLOUD = 'du2dsimyz';
  var CLOUDINARY_PRESET = 'chat_app_uploads';

  function _esc(s) {
    return window.escHtml ? window.escHtml(String(s ?? '')) : String(s ?? '');
  }

  function _db() {
    return (window.App && window.App.db) ? window.App.db : (typeof db !== 'undefined' ? db : null);
  }

  function _auth() {
    return (window.App && window.App.auth) ? window.App.auth : (typeof auth !== 'undefined' ? auth : null);
  }

  function _uid() {
    var a = _auth();
    if (a && a.currentUser) return a.currentUser.uid;
    if (window.currentUser && window.currentUser.uid) return window.currentUser.uid;
    return null;
  }

  function _removeOverlay() {
    if (_activeOverlay) { _activeOverlay.remove(); _activeOverlay = null; }
  }

  function _ensureStyles() {
    if (document.getElementById('nsl-profile-edit-style')) return;
    var s = document.createElement('style');
    s.id = 'nsl-profile-edit-style';
    s.textContent =
      '.nsl-pe-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;animation:nslPeFadeIn .15s ease}' +
      '@keyframes nslPeFadeIn{from{opacity:0}to{opacity:1}}' +
      '@keyframes nslPeSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}' +
      '.nsl-pe-modal{background:var(--surface-container,#fff);border-radius:20px;width:min(420px,94vw);max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.3);animation:nslPeSlideUp .2s ease}' +
      '.nsl-pe-header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 0}' +
      '.nsl-pe-header h2{margin:0;font-size:18px;color:var(--on-surface,#000)}' +
      '.nsl-pe-close{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px;color:var(--on-surface-variant,#666)}' +
      '.nsl-pe-close:hover{background:var(--surface-variant,#eee)}' +
      '.nsl-pe-avatar-section{display:flex;flex-direction:column;align-items:center;padding:20px}' +
      '.nsl-pe-avatar-wrap{position:relative;cursor:pointer}' +
      '.nsl-pe-avatar{width:96px;height:96px;border-radius:50%;object-fit:cover;background:var(--primary,#6750A4);color:var(--on-primary,#fff);display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:600}' +
      '.nsl-pe-avatar-cam{position:absolute;bottom:2px;right:2px;width:30px;height:30px;border-radius:50%;background:var(--primary,#6750A4);color:var(--on-primary,#fff);display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid var(--surface-container,#fff);box-shadow:0 2px 6px rgba(0,0,0,0.2)}' +
      '.nsl-pe-avatar-hint{font-size:11px;color:var(--on-surface-variant,#666);margin-top:6px}' +
      '.nsl-pe-section{padding:0 20px 16px}' +
      '.nsl-pe-field{margin-bottom:14px}' +
      '.nsl-pe-field label{display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--on-surface-variant,#666);margin-bottom:4px}' +
      '.nsl-pe-field-row{display:flex;gap:8px;align-items:center}' +
      '.nsl-pe-field input{flex:1;padding:10px 12px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;background:var(--surface,#fff);color:var(--on-surface,#000);outline:none;transition:border-color .12s}' +
      '.nsl-pe-field input:focus{border-color:var(--primary,#6750A4)}' +
      '.nsl-pe-field input:disabled{background:var(--surface-variant,#f5f5f5);opacity:0.7}' +
      '.nsl-pe-field .nsl-pe-verified{font-size:11px;color:var(--success,#2e7d32);font-weight:600}' +
      '.nsl-pe-field .nsl-pe-unverified{font-size:11px;color:var(--error,#B3261E);font-weight:600}' +
      '.nsl-pe-field .nsl-pe-edit-btn{padding:6px 12px;border:1px solid var(--primary,#6750A4);background:transparent;color:var(--primary,#6750A4);border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}' +
      '.nsl-pe-field .nsl-pe-edit-btn:hover{background:var(--primary,#6750A4);color:var(--on-primary,#fff)}' +
      '.nsl-pe-save-btn{width:100%;padding:12px;border:none;border-radius:12px;background:var(--primary,#6750A4);color:var(--on-primary,#fff);font-size:14px;font-weight:600;cursor:pointer;transition:all .12s;margin-top:8px}' +
      '.nsl-pe-save-btn:hover{opacity:0.9}' +
      '.nsl-pe-save-btn:disabled{opacity:0.5;cursor:not-allowed}' +
      '.nsl-pe-spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:nslPeSpin .6s linear infinite;margin-right:6px;vertical-align:middle}' +
      '@keyframes nslPeSpin{to{transform:rotate(360deg)}}' +
      '.nsl-pe-code-input{display:flex;gap:6px;margin-top:8px}' +
      '.nsl-pe-code-input input{width:40px;text-align:center;font-size:18px;padding:8px 4px;border:1px solid var(--outline-variant,#ccc);border-radius:8px;background:var(--surface,#fff);color:var(--on-surface,#000);outline:none}' +
      '.nsl-pe-code-input input:focus{border-color:var(--primary,#6750A4)}';
    document.head.appendChild(s);
  }

  function _validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function _validatePhone(phone) {
    return /^\+?[0-9\s\-()]{7,15}$/.test(phone);
  }

  function _validateName(name) {
    return name && name.trim().length >= 2;
  }

  function _showAvatarUpload() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async function (e) {
      var file = e.target.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        if (typeof showToast === 'function') showToast('Image must be under 5MB', 'error');
        return;
      }

      if (!file.type.startsWith('image/')) {
        if (typeof showToast === 'function') showToast('Please select an image', 'error');
        return;
      }

      try {
        var preview = document.querySelector('.nsl-pe-avatar');
        if (preview) {
          var url = URL.createObjectURL(file);
          if (preview.tagName === 'IMG') {
            preview.src = url;
          } else {
            var img = document.createElement('img');
            img.src = url;
            img.className = 'nsl-pe-avatar';
            img.style.cssText = 'width:96px;height:96px;border-radius:50%;object-fit:cover';
            preview.replaceWith(img);
          }
        }

        if (typeof showToast === 'function') showToast('Uploading avatar...', 'info');

        var formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_PRESET);

        var resp = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', {
          method: 'POST',
          body: formData
        });

        if (!resp.ok) throw new Error('Upload failed');
        var data = await resp.json();
        var newUrl = data.secure_url;

        var d = _db();
        var uid = _uid();
        if (d && uid) {
          await d.collection('users').doc(uid).update({ photoURL: newUrl });
        }

        if (window.currentUser) window.currentUser.photoURL = newUrl;
        if (window.App && window.App.auth && window.App.auth.currentUser) {
          try { await window.App.auth.currentUser.updateProfile({ photoURL: newUrl }); } catch (_) {}
        }

        if (typeof showToast === 'function') showToast('Avatar updated', 'success');
      } catch (err) {
        console.error('Avatar upload error:', err);
        if (typeof showToast === 'function') showToast('Failed to upload avatar', 'error');
      }
    };
    input.click();
  }

  async function _sendVerificationEmail(newEmail) {
    var a = _auth();
    if (!a || !a.currentUser) return false;
    try {
      await a.currentUser.verifyBeforeUpdateEmail(newEmail);
      return true;
    } catch (err) {
      console.error('Email verification error:', err);
      if (typeof showToast === 'function') showToast(err.message || 'Failed to send verification', 'error');
      return false;
    }
  }

  async function changeEmail(newEmail) {
    if (!_validateEmail(newEmail)) {
      if (typeof showToast === 'function') showToast('Invalid email format', 'error');
      return false;
    }
    var sent = await _sendVerificationEmail(newEmail);
    if (sent) {
      if (typeof showToast === 'function') showToast('Verification link sent to ' + newEmail, 'info');
    }
    return sent;
  }

  async function changePhone(newPhone) {
    if (!_validatePhone(newPhone)) {
      if (typeof showToast === 'function') showToast('Invalid phone format', 'error');
      return false;
    }

    var a = _auth();
    if (!a || !a.currentUser) return false;

    try {
      var verifier = new firebase.auth.RecaptchaVerifier('nsl-pe-recaptcha', { size: 'invisible' });
      var confirmation = await a.currentUser.updatePhoneNumber(
        firebase.auth.PhoneAuthProvider.credential(await a.currentUser.verifyPhoneNumber(newPhone, verifier), '')
      );

      var d = _db();
      var uid = _uid();
      if (d && uid) {
        await d.collection('users').doc(uid).update({ phoneNumber: newPhone });
      }

      if (window.currentUser) window.currentUser.phoneNumber = newPhone;
      if (typeof showToast === 'function') showToast('Phone number updated', 'success');
      return true;
    } catch (err) {
      console.error('Phone update error:', err);
      if (typeof showToast === 'function') showToast(err.message || 'Failed to update phone', 'error');
      return false;
    }
  }

  async function saveProfile() {
    var d = _db();
    var uid = _uid();
    if (!d || !uid) {
      if (typeof showToast === 'function') showToast('Not authenticated', 'error');
      return;
    }

    var nameInput = document.getElementById('nsl-pe-name');
    var emailInput = document.getElementById('nsl-pe-email');
    var phoneInput = document.getElementById('nsl-pe-phone');
    var saveBtn = document.getElementById('nsl-pe-save');

    var newName = nameInput ? nameInput.value.trim() : '';
    var newEmail = emailInput ? emailInput.value.trim() : '';
    var newPhone = phoneInput ? phoneInput.value.trim() : '';

    if (!_validateName(newName)) {
      if (typeof showToast === 'function') showToast('Name must be at least 2 characters', 'error');
      if (nameInput) nameInput.focus();
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="nsl-pe-spinner"></span>Saving...';
    }

    try {
      var updates = {};

      if (newName && newName !== (window.currentUser && window.currentUser.displayName)) {
        updates.displayName = newName;
        var a = _auth();
        if (a && a.currentUser) {
          try { await a.currentUser.updateProfile({ displayName: newName }); } catch (_) {}
        }
        if (window.currentUser) window.currentUser.displayName = newName;
      }

      if (newEmail && newEmail !== (window.currentUser && window.currentUser.email)) {
        var sent = await changeEmail(newEmail);
        if (!sent && saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
          return;
        }
      }

      if (newPhone && newPhone !== (window.currentUser && window.currentUser.phoneNumber)) {
        await changePhone(newPhone);
      }

      if (Object.keys(updates).length > 0) {
        await d.collection('users').doc(uid).update(updates);
      }

      if (typeof showToast === 'function') showToast('Profile updated', 'success');
      _removeOverlay();
    } catch (err) {
      console.error('Save profile error:', err);
      if (typeof showToast === 'function') showToast('Failed to save profile', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    }
  }

  function openProfileEdit() {
    _removeOverlay();
    _ensureStyles();

    var user = window.currentUser || {};
    var photoURL = user.photoURL || '';
    var displayName = user.displayName || '';
    var email = user.email || '';
    var phone = user.phoneNumber || '';

    var overlay = document.createElement('div');
    overlay.className = 'nsl-pe-overlay';

    var avatarContent = photoURL
      ? '<img class="nsl-pe-avatar" src="' + _esc(photoURL) + '" alt="Avatar" style="width:96px;height:96px;border-radius:50%;object-fit:cover">'
      : '<div class="nsl-pe-avatar">' + _esc((displayName || '?').charAt(0).toUpperCase()) + '</div>';

    var modal = document.createElement('div');
    modal.className = 'nsl-pe-modal';
    modal.innerHTML =
      '<div class="nsl-pe-header">' +
        '<h2>Edit Profile</h2>' +
        '<button class="nsl-pe-close" id="nsl-pe-close">✕</button>' +
      '</div>' +
      '<div class="nsl-pe-avatar-section">' +
        '<div class="nsl-pe-avatar-wrap" id="nsl-pe-avatar-wrap">' +
          avatarContent +
          '<div class="nsl-pe-avatar-cam">📷</div>' +
        '</div>' +
        '<div class="nsl-pe-avatar-hint">Tap to change photo</div>' +
      '</div>' +
      '<div class="nsl-pe-section">' +
        '<div class="nsl-pe-field">' +
          '<label>Display Name</label>' +
          '<input type="text" id="nsl-pe-name" value="' + _esc(displayName) + '" placeholder="Your name">' +
        '</div>' +
        '<div class="nsl-pe-field">' +
          '<label>Email</label>' +
          '<div class="nsl-pe-field-row">' +
            '<input type="email" id="nsl-pe-email" value="' + _esc(email) + '" placeholder="your@email.com">' +
          '</div>' +
        '</div>' +
        '<div class="nsl-pe-field">' +
          '<label>Phone</label>' +
          '<div class="nsl-pe-field-row">' +
            '<input type="tel" id="nsl-pe-phone" value="' + _esc(phone) + '" placeholder="+1234567890">' +
          '</div>' +
        '</div>' +
        '<div id="nsl-pe-recaptcha"></div>' +
        '<button class="nsl-pe-save-btn" id="nsl-pe-save">Save Changes</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    _activeOverlay = overlay;

    overlay.addEventListener('click', function (e) { if (e.target === overlay) _removeOverlay(); });
    modal.querySelector('#nsl-pe-close').addEventListener('click', _removeOverlay);
    modal.querySelector('#nsl-pe-avatar-wrap').addEventListener('click', _showAvatarUpload);
    modal.querySelector('#nsl-pe-save').addEventListener('click', saveProfile);

    modal.querySelector('#nsl-pe-name').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') saveProfile();
    });
  }

  window.openProfileEdit = openProfileEdit;
  window.saveProfile = saveProfile;
  window.changeEmail = changeEmail;
  window.changePhone = changePhone;
  window.changeAvatar = _showAvatarUpload;
})();
