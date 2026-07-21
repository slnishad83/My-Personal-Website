'use strict';
(function () {
  var STORAGE_KEY = 'nsl_profile_setup_complete';
  var CLOUDINARY_CLOUD = 'du2dsimyz';
  var CLOUDINARY_PRESET = 'chat_app_uploads';

  var _overlay = null;
  var _currentStep = 1;
  var _totalSteps = 3;
  var _uploadedPhotoURL = '';
  var _displayName = '';
  var _bio = '';
  var _status = 'Available';
  var _customStatus = '';

  var _esc = function (s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; };

  function _uid() {
    if (window.App && window.App.uid) return window.App.uid();
    if (window.currentUser) return window.currentUser.uid;
    return null;
  }

  function _db() {
    if (window.App && window.App.db) return window.App.db;
    if (typeof firebase !== 'undefined') return firebase.firestore();
    return null;
  }

  function _auth() {
    if (window.App && window.App.auth) return window.App.auth;
    if (typeof auth !== 'undefined') return auth;
    return null;
  }

  function isProfileSetupComplete() {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch (e) { return false; }
  }

  function _ensureStyles() {
    if (document.getElementById('nsl-profile-setup-style')) return;
    var s = document.createElement('style');
    s.id = 'nsl-profile-setup-style';
    s.textContent = `
      .nsl-ps-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.25s ease;pointer-events:auto}
      .nsl-ps-overlay.show{opacity:1}
      .nsl-ps-modal{background:var(--surface-container,#fff);color:var(--on-surface,#111b21);border:1px solid var(--outline-variant,#d8dee2);border-radius:24px;width:min(440px,100vw);max-height:100vh;height:100vh;overflow:hidden;display:flex;flex-direction:column;transform:translateY(20px);transition:transform 0.3s ease;position:relative}
      .nsl-ps-overlay.show .nsl-ps-modal{transform:translateY(0)}
      @media(min-width:481px){.nsl-ps-modal{height:auto;max-height:min(85vh,700px);box-shadow:0 24px 64px rgba(0,0,0,0.28)}}
      html.dark .nsl-ps-modal{background:color-mix(in srgb,var(--surface-container,#111b21) 80%,transparent);border-color:color-mix(in srgb,var(--on-surface,#e9edef) 8%,transparent);box-shadow:0 24px 64px rgba(0,0,0,0.4)}
      .nsl-ps-progress{display:flex;gap:4px;padding:0 24px;padding-top:max(16px,env(safe-area-inset-top,16px))}
      .nsl-ps-progress-seg{flex:1;height:4px;border-radius:2px;background:var(--outline-variant,#d8dee2);transition:background 0.3s ease}
      .nsl-ps-progress-seg.filled{background:var(--primary,#00a884)}
      html.dark .nsl-ps-progress-seg{background:color-mix(in srgb,var(--on-surface,#e9edef) 12%,transparent)}
      html.dark .nsl-ps-progress-seg.filled{background:#00ffc3}
      .nsl-ps-step-indicator{font-size:12px;color:var(--on-surface-variant,#667781);text-align:center;padding:12px 24px 0;font-weight:500;letter-spacing:0.02em}
      html.dark .nsl-ps-step-indicator{color:var(--on-surface-variant,#aebac1)}
      .nsl-ps-body{flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;align-items:center;gap:8px;position:relative}
      .nsl-ps-step{animation:nslPsSlideIn 0.3s ease}
      @keyframes nslPsSlideIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
      .nsl-ps-step.exit-left{animation:nslPsSlideOut 0.2s ease forwards}
      @keyframes nslPsSlideOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(-24px)}}
      .nsl-ps-avatar-area{position:relative;margin-bottom:16px}
      .nsl-ps-avatar{width:120px;height:120px;border-radius:50%;background:var(--primary-container,#e8def8);color:var(--on-primary-container,#1d192b);display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:600;border:3px dashed var(--primary,#00a884);cursor:pointer;transition:border-color 0.2s,transform 0.15s;overflow:hidden}
      html.dark .nsl-ps-avatar{background:color-mix(in srgb,#00ffc3 15%,transparent);border-color:#00ffc3}
      .nsl-ps-avatar:hover{border-style:solid;transform:scale(1.02)}
      .nsl-ps-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
      .nsl-ps-avatar-cam{position:absolute;bottom:4px;right:4px;width:36px;height:36px;border-radius:50%;background:var(--primary,#00a884);color:var(--on-primary,#fff);display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid var(--surface-container,#fff);box-shadow:0 2px 8px rgba(0,0,0,0.2);pointer-events:none}
      html.dark .nsl-ps-avatar-cam{border-color:var(--surface-container,#111b21)}
      .nsl-ps-title{font-family:'Manrope',sans-serif;font-size:20px;font-weight:700;color:var(--on-surface,#111b21);text-align:center;margin:0}
      html.dark .nsl-ps-title{color:var(--on-surface,#e9edef)}
      .nsl-ps-desc{font-size:14px;color:var(--on-surface-variant,#667781);text-align:center;margin:4px 0 16px;max-width:300px;line-height:1.5}
      html.dark .nsl-ps-desc{color:var(--on-surface-variant,#aebac1)}
      .nsl-ps-upload-actions{display:flex;flex-direction:column;gap:8px;width:100%;max-width:280px}
      .nsl-ps-upload-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px;border-radius:14px;border:1px solid var(--outline-variant,#d8dee2);background:transparent;color:var(--on-surface,#111b21);font-size:14px;font-weight:600;cursor:pointer;transition:all 0.15s ease;min-height:48px}
      html.dark .nsl-ps-upload-btn{border-color:color-mix(in srgb,var(--on-surface,#e9edef) 15%,transparent);color:var(--on-surface,#e9edef)}
      .nsl-ps-upload-btn:hover{background:var(--surface-variant,#f0f2f5)}
      html.dark .nsl-ps-upload-btn:hover{background:color-mix(in srgb,var(--on-surface,#e9edef) 8%,transparent)}
      .nsl-ps-upload-btn .material-symbols-outlined{font-size:18px}
      .nsl-ps-skip-link{background:none;border:none;color:var(--on-surface-variant,#667781);font-size:13px;cursor:pointer;padding:8px;margin-top:4px;transition:color 0.15s}
      html.dark .nsl-ps-skip-link{color:var(--on-surface-variant,#aebac1)}
      .nsl-ps-skip-link:hover{color:var(--on-surface,#111b21)}
      html.dark .nsl-ps-skip-link:hover{color:var(--on-surface,#e9edef)}
      .nsl-ps-field{width:100%;max-width:320px;margin-bottom:12px}
      .nsl-ps-field label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--on-surface-variant,#667781);margin-bottom:6px}
      html.dark .nsl-ps-field label{color:var(--on-surface-variant,#aebac1)}
      .nsl-ps-field input,.nsl-ps-field textarea{width:100%;padding:12px 14px;border:1.5px solid var(--outline-variant,#d8dee2);border-radius:12px;font-size:15px;font-family:'Inter',sans-serif;background:var(--surface-muted,#f0f2f5);color:var(--on-surface,#111b21);outline:none;transition:border-color 0.15s,box-shadow 0.15s}
      html.dark .nsl-ps-field input,html.dark .nsl-ps-field textarea{border-color:color-mix(in srgb,var(--on-surface,#e9edef) 12%,transparent);background:color-mix(in srgb,var(--on-surface,#e9edef) 5%,transparent);color:var(--on-surface,#e9edef)}
      .nsl-ps-field input:focus,.nsl-ps-field textarea:focus{border-color:var(--primary,#00a884);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary,#00a884) 15%,transparent)}
      .nsl-ps-field textarea{resize:none;min-height:80px;max-height:120px;line-height:1.4}
      .nsl-ps-char-count{font-size:11px;color:var(--on-surface-variant,#667781);text-align:right;margin-top:4px}
      html.dark .nsl-ps-char-count{color:var(--on-surface-variant,#aebac1)}
      .nsl-ps-char-count.warn{color:var(--error,#ba1a1a)}
      .nsl-ps-status-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;width:100%;max-width:320px;margin-bottom:12px}
      .nsl-ps-status-option{display:flex;align-items:center;gap:8px;padding:12px;border-radius:12px;border:1.5px solid var(--outline-variant,#d8dee2);background:transparent;color:var(--on-surface,#111b21);font-size:14px;font-weight:500;cursor:pointer;transition:all 0.15s ease;min-height:48px}
      html.dark .nsl-ps-status-option{border-color:color-mix(in srgb,var(--on-surface,#e9edef) 12%,transparent);color:var(--on-surface,#e9edef)}
      .nsl-ps-status-option:hover{background:var(--surface-variant,#f0f2f5)}
      html.dark .nsl-ps-status-option:hover{background:color-mix(in srgb,var(--on-surface,#e9edef) 8%,transparent)}
      .nsl-ps-status-option.selected{border-color:var(--primary,#00a884);background:color-mix(in srgb,var(--primary,#00a884) 8%,transparent)}
      html.dark .nsl-ps-status-option.selected{border-color:#00ffc3;background:color-mix(in srgb,#00ffc3 8%,transparent)}
      .nsl-ps-status-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
      .nsl-ps-status-dot.available{background:#22c55e}
      .nsl-ps-status-dot.busy{background:#ef4444}
      .nsl-ps-status-dot.meeting{background:#f59e0b}
      .nsl-ps-status-dot.school{background:#3b82f6}
      .nsl-ps-status-dot.sleeping{background:#8b5cf6}
      .nsl-ps-status-dot.custom{background:var(--on-surface-variant,#667781)}
      .nsl-ps-custom-input{width:100%;max-width:320px;margin-bottom:12px}
      .nsl-ps-custom-input input{width:100%;padding:12px 14px;border:1.5px solid var(--outline-variant,#d8dee2);border-radius:12px;font-size:14px;font-family:'Inter',sans-serif;background:var(--surface-muted,#f0f2f5);color:var(--on-surface,#111b21);outline:none;transition:border-color 0.15s,box-shadow 0.15s}
      html.dark .nsl-ps-custom-input input{border-color:color-mix(in srgb,var(--on-surface,#e9edef) 12%,transparent);background:color-mix(in srgb,var(--on-surface,#e9edef) 5%,transparent);color:var(--on-surface,#e9edef)}
      .nsl-ps-custom-input input:focus{border-color:var(--primary,#00a884);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary,#00a884) 15%,transparent)}
      .nsl-ps-footer{padding:16px 24px max(16px,env(safe-area-inset-bottom,16px));display:flex;gap:8px}
      .nsl-ps-btn{flex:1;padding:14px;border-radius:14px;border:none;font-size:15px;font-weight:700;cursor:pointer;transition:all 0.15s ease;min-height:48px;font-family:'Manrope',sans-serif}
      .nsl-ps-btn-primary{background:var(--primary,#00a884);color:var(--on-primary,#fff);box-shadow:0 4px 12px color-mix(in srgb,var(--primary,#00a884) 25%,transparent)}
      html.dark .nsl-ps-btn-primary{background:#00ffc3;color:#06130f}
      .nsl-ps-btn-primary:hover{opacity:0.9;transform:translateY(-1px)}
      .nsl-ps-btn-primary:active{transform:scale(0.98)}
      .nsl-ps-btn-primary:disabled{opacity:0.5;cursor:not-allowed;transform:none}
      .nsl-ps-complete{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px;text-align:center}
      .nsl-ps-complete-check{width:72px;height:72px;border-radius:50%;background:var(--primary,#00a884);color:#fff;display:flex;align-items:center;justify-content:center;font-size:36px;animation:nslPsBounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1)}
      html.dark .nsl-ps-complete-check{background:#00ffc3;color:#06130f}
      @keyframes nslPsBounceIn{0%{transform:scale(0);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
      .nsl-ps-complete h2{font-family:'Manrope',sans-serif;font-size:22px;font-weight:700;color:var(--on-surface,#111b21);margin:0}
      html.dark .nsl-ps-complete h2{color:var(--on-surface,#e9edef)}
      .nsl-ps-complete p{font-size:14px;color:var(--on-surface-variant,#667781);margin:0}
      html.dark .nsl-ps-complete p{color:var(--on-surface-variant,#aebac1)}
      .nsl-ps-spinner{display:inline-block;width:20px;height:20px;border:2.5px solid color-mix(in srgb,var(--on-primary,#fff) 30%,transparent);border-top-color:var(--on-primary,#fff);border-radius:50%;animation:nslPsSpin 0.7s linear infinite}
      @keyframes nslPsSpin{to{transform:rotate(360deg)}}
      .nsl-ps-close{position:absolute;top:max(12px,env(safe-area-inset-top,12px));right:12px;width:36px;height:36px;border-radius:50%;border:none;background:transparent;color:var(--on-surface-variant,#667781);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s;z-index:2}
      html.dark .nsl-ps-close{color:var(--on-surface-variant,#aebac1)}
      .nsl-ps-close:hover{background:color-mix(in srgb,var(--on-surface,#111b21) 8%,transparent)}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important}}
    `;
    document.head.appendChild(s);
  }

  function _createOverlay() {
    var el = document.createElement('div');
    el.className = 'nsl-ps-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Profile setup');
    el.innerHTML =
      '<div class="nsl-ps-modal">' +
        '<button class="nsl-ps-close" id="nsl-ps-close" aria-label="Close profile setup">&times;</button>' +
        '<div class="nsl-ps-progress" id="nsl-ps-progress"></div>' +
        '<div class="nsl-ps-step-indicator" id="nsl-ps-step-indicator"></div>' +
        '<div class="nsl-ps-body" id="nsl-ps-body"></div>' +
        '<div class="nsl-ps-footer" id="nsl-ps-footer"></div>' +
      '</div>';
    return el;
  }

  function _renderProgress() {
    var container = document.getElementById('nsl-ps-progress');
    if (!container) return;
    var html = '';
    for (var i = 1; i <= _totalSteps; i++) {
      html += '<div class="nsl-ps-progress-seg' + (i <= _currentStep ? ' filled' : '') + '"></div>';
    }
    container.innerHTML = html;

    var indicator = document.getElementById('nsl-ps-step-indicator');
    if (indicator) indicator.textContent = 'Step ' + _currentStep + ' of ' + _totalSteps;
  }

  function _renderStep1() {
    var body = document.getElementById('nsl-ps-body');
    if (!body) return;
    var user = window.currentUser || {};
    var initial = (_displayName || user.displayName || '?').charAt(0).toUpperCase();

    var avatarHtml = _uploadedPhotoURL
      ? '<img src="' + _esc(_uploadedPhotoURL) + '" alt="Avatar preview">'
      : '<span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1">person</span>';

    body.innerHTML =
      '<div class="nsl-ps-step" id="nsl-ps-step-content">' +
        '<div class="nsl-ps-avatar-area">' +
          '<div class="nsl-ps-avatar" id="nsl-ps-avatar" role="button" tabindex="0" aria-label="Upload profile photo">' +
            avatarHtml +
          '</div>' +
          '<div class="nsl-ps-avatar-cam"><span class="material-symbols-outlined" style="font-size:18px">photo_camera</span></div>' +
        '</div>' +
        '<h2 class="nsl-ps-title">Add your photo</h2>' +
        '<p class="nsl-ps-desc">Choose a profile photo so people can recognize you.</p>' +
        '<div class="nsl-ps-upload-actions">' +
          '<button class="nsl-ps-upload-btn" id="nsl-ps-take-photo"><span class="material-symbols-outlined">photo_camera</span>Take Photo</button>' +
          '<button class="nsl-ps-upload-btn" id="nsl-ps-choose-photo"><span class="material-symbols-outlined">photo_library</span>Choose from Gallery</button>' +
        '</div>' +
        '<button class="nsl-ps-skip-link" id="nsl-ps-skip">Skip for now</button>' +
      '</div>';

    var footer = document.getElementById('nsl-ps-footer');
    if (footer) footer.innerHTML = '';

    document.getElementById('nsl-ps-avatar').addEventListener('click', _triggerPhotoUpload);
    document.getElementById('nsl-ps-avatar').addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _triggerPhotoUpload(); } });
    document.getElementById('nsl-ps-take-photo').addEventListener('click', function() { _triggerPhotoUpload('camera'); });
    document.getElementById('nsl-ps-choose-photo').addEventListener('click', function() { _triggerPhotoUpload('gallery'); });
    document.getElementById('nsl-ps-skip').addEventListener('click', function() { _goToStep(2); });
  }

  function _triggerPhotoUpload(source) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';
    input.onchange = async function(e) {
      var file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { if (typeof showToast === 'function') showToast('Image must be under 5MB', 'error'); return; }
      if (!file.type.startsWith('image/')) { if (typeof showToast === 'function') showToast('Please select an image', 'error'); return; }

      var avatar = document.getElementById('nsl-ps-avatar');
      if (avatar) {
        var url = URL.createObjectURL(file);
        avatar.innerHTML = '<img src="' + url + '" alt="Avatar preview">';
      }

      try {
        if (typeof showToast === 'function') showToast('Uploading photo...', 'info');
        var formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_PRESET);
        var resp = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', { method: 'POST', body: formData });
        if (!resp.ok) throw new Error('Upload failed');
        var data = await resp.json();
        _uploadedPhotoURL = data.secure_url;
        if (typeof showToast === 'function') showToast('Photo uploaded', 'success');
      } catch (err) {
        console.error('Profile photo upload error:', err);
        if (typeof showToast === 'function') showToast('Failed to upload photo', 'error');
      }
    };
    input.click();
  }

  function _renderStep2() {
    var body = document.getElementById('nsl-ps-body');
    if (!body) return;
    var user = window.currentUser || {};
    var name = _displayName || user.displayName || '';
    var bioText = _bio || '';

    body.innerHTML =
      '<div class="nsl-ps-step" id="nsl-ps-step-content">' +
        '<h2 class="nsl-ps-title">Tell us your name</h2>' +
        '<p class="nsl-ps-desc">Add your display name and a short bio.</p>' +
        '<div class="nsl-ps-field">' +
          '<label for="nsl-ps-name-input">Display Name</label>' +
          '<input type="text" id="nsl-ps-name-input" placeholder="Your name" value="' + _esc(name) + '" maxlength="50" autocomplete="name">' +
        '</div>' +
        '<div class="nsl-ps-field">' +
          '<label for="nsl-ps-bio-input">Bio (optional)</label>' +
          '<textarea id="nsl-ps-bio-input" placeholder="Tell us something about yourself..." maxlength="100">' + _esc(bioText) + '</textarea>' +
          '<div class="nsl-ps-char-count" id="nsl-ps-bio-count">' + bioText.length + '/100</div>' +
        '</div>' +
      '</div>';

    var footer = document.getElementById('nsl-ps-footer');
    if (footer) {
      footer.innerHTML = '<button class="nsl-ps-btn nsl-ps-btn-primary" id="nsl-ps-next">Continue</button>';
    }

    var nameInput = document.getElementById('nsl-ps-name-input');
    var bioInput = document.getElementById('nsl-ps-bio-input');
    var bioCount = document.getElementById('nsl-ps-bio-count');

    nameInput.focus();
    nameInput.value = name;
    bioInput.value = bioText;

    bioInput.addEventListener('input', function() {
      var len = bioInput.value.length;
      bioCount.textContent = len + '/100';
      bioCount.classList.toggle('warn', len > 90);
    });

    document.getElementById('nsl-ps-next').addEventListener('click', function() {
      var val = nameInput.value.trim();
      if (val.length < 2) { if (typeof showToast === 'function') showToast('Name must be at least 2 characters', 'error'); nameInput.focus(); return; }
      _displayName = val;
      _bio = bioInput.value.trim();
      _goToStep(3);
    });

    nameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('nsl-ps-next').click(); });
  }

  function _renderStep3() {
    var body = document.getElementById('nsl-ps-body');
    if (!body) return;

    var statuses = [
      { label: 'Available', dot: 'available' },
      { label: 'Busy', dot: 'busy' },
      { label: 'In a meeting', dot: 'meeting' },
      { label: 'At school', dot: 'school' },
      { label: 'Sleeping', dot: 'sleeping' },
      { label: 'Custom...', dot: 'custom' }
    ];

    var gridHtml = '';
    for (var i = 0; i < statuses.length; i++) {
      var s = statuses[i];
      var selected = (_status === s.label || (s.label === 'Custom...' && _status === 'custom')) ? ' selected' : '';
      gridHtml += '<button class="nsl-ps-status-option' + selected + '" data-status="' + _esc(s.label) + '">' +
        '<span class="nsl-ps-status-dot ' + s.dot + '"></span>' + _esc(s.label) + '</button>';
    }

    var customDisplay = (_status !== 'Available' && statuses.filter(function(s) { return s.label === _status; }).length === 0) ? '' : 'none';

    body.innerHTML =
      '<div class="nsl-ps-step" id="nsl-ps-step-content">' +
        '<h2 class="nsl-ps-title">Set your status</h2>' +
        '<p class="nsl-ps-desc">Let others know what you are up to.</p>' +
        '<div class="nsl-ps-status-grid" id="nsl-ps-status-grid">' + gridHtml + '</div>' +
        '<div class="nsl-ps-custom-input" id="nsl-ps-custom-wrap" style="display:' + customDisplay + '">' +
          '<input type="text" id="nsl-ps-custom-input" placeholder="Type your status..." value="' + _esc(_customStatus) + '" maxlength="40">' +
        '</div>' +
      '</div>';

    var footer = document.getElementById('nsl-ps-footer');
    if (footer) {
      footer.innerHTML = '<button class="nsl-ps-btn nsl-ps-btn-primary" id="nsl-ps-finish">Finish</button>';
    }

    document.querySelectorAll('#nsl-ps-status-grid .nsl-ps-status-option').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('#nsl-ps-status-grid .nsl-ps-status-option').forEach(function(b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        var val = btn.dataset.status;
        if (val === 'Custom...') {
          _status = 'custom';
          document.getElementById('nsl-ps-custom-wrap').style.display = '';
          document.getElementById('nsl-ps-custom-input').focus();
        } else {
          _status = val;
          _customStatus = '';
          document.getElementById('nsl-ps-custom-wrap').style.display = 'none';
        }
      });
    });

    document.getElementById('nsl-ps-finish').addEventListener('click', function() {
      if (_status === 'custom') {
        var customVal = document.getElementById('nsl-ps-custom-input').value.trim();
        if (!customVal) { if (typeof showToast === 'function') showToast('Please enter a status', 'error'); document.getElementById('nsl-ps-custom-input').focus(); return; }
        _customStatus = customVal;
      }
      _showComplete();
    });
  }

  async function _showComplete() {
    var body = document.getElementById('nsl-ps-body');
    var footer = document.getElementById('nsl-ps-footer');
    if (footer) footer.innerHTML = '';
    if (body) {
      body.innerHTML =
        '<div class="nsl-ps-step nsl-ps-complete" id="nsl-ps-step-content">' +
          '<div class="nsl-ps-complete-check"><span class="material-symbols-outlined" style="font-size:36px" style="font-variation-settings:\'FILL\' 1">check</span></div>' +
          '<h2>Profile setup complete!</h2>' +
          '<p>Your profile is ready to go.</p>' +
        '</div>';
    }

    var closeBtn = document.getElementById('nsl-ps-close');
    if (closeBtn) closeBtn.style.display = 'none';

    await _saveToFirestore();

    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch (e) {}

    setTimeout(function() { closeProfileSetup(); }, 2000);
  }

  async function _saveToFirestore() {
    var d = _db();
    var uid = _uid();
    if (!d || !uid) return;

    var finalStatus = _status === 'custom' ? _customStatus : _status;
    var updates = {};

    if (_uploadedPhotoURL) updates.photoURL = _uploadedPhotoURL;
    if (_displayName) updates.displayName = _displayName;
    if (_bio) updates.bio = _bio;
    if (finalStatus) updates.status = finalStatus;

    try {
      await d.collection('users').doc(uid).set(updates, { merge: true });
    } catch (err) {
      console.error('Profile setup save error:', err);
      if (typeof showToast === 'function') showToast('Failed to save profile data', 'error');
    }

    var a = _auth();
    if (a && a.currentUser && _displayName) {
      try { await a.currentUser.updateProfile({ displayName: _displayName, photoURL: _uploadedPhotoURL || undefined }); } catch (e) {}
    }
    if (window.currentUser) {
      if (_displayName) window.currentUser.displayName = _displayName;
      if (_uploadedPhotoURL) window.currentUser.photoURL = _uploadedPhotoURL;
    }
  }

  function _goToStep(step) {
    _currentStep = step;
    _renderProgress();
    if (step === 1) _renderStep1();
    else if (step === 2) _renderStep2();
    else if (step === 3) _renderStep3();
  }

  function openProfileSetup() {
    if (isProfileSetupComplete()) return;

    _ensureStyles();
    _currentStep = 1;
    _uploadedPhotoURL = (window.currentUser && window.currentUser.photoURL) || '';
    _displayName = (window.currentUser && window.currentUser.displayName) || '';
    _bio = '';
    _status = 'Available';
    _customStatus = '';

    if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
    _overlay = _createOverlay();
    document.body.appendChild(_overlay);

    var closeBtn = document.getElementById('nsl-ps-close');
    if (closeBtn) closeBtn.style.display = '';

    requestAnimationFrame(function() {
      _overlay.classList.add('show');
      _renderProgress();
      _renderStep1();
    });

    closeBtn.addEventListener('click', function() { skipProfileSetup(); });

    _overlay.addEventListener('click', function(e) { if (e.target === _overlay) skipProfileSetup(); });

    _overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { skipProfileSetup(); return; }
      if (e.key === 'Enter') {
        var primaryBtn = _overlay.querySelector('.nsl-ps-btn-primary');
        if (primaryBtn) primaryBtn.click();
      }
    });
  }

  function closeProfileSetup() {
    if (_overlay) {
      _overlay.classList.remove('show');
      var modal = _overlay.querySelector('.nsl-ps-modal');
      if (modal) modal.style.transform = 'translateY(20px)';
      setTimeout(function() {
        if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
        _overlay = null;
      }, 250);
    }
  }

  function skipProfileSetup() {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch (e) {}
    closeProfileSetup();
  }

  async function saveProfileSetup() {
    await _saveToFirestore();
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch (e) {}
    closeProfileSetup();
  }

  window.openProfileSetup = openProfileSetup;
  window.closeProfileSetup = closeProfileSetup;
  window.saveProfileSetup = saveProfileSetup;
  window.skipProfileSetup = skipProfileSetup;
  window.isProfileSetupComplete = isProfileSetupComplete;
})();
