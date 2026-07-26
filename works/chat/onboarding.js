(function() { 'use strict';

var STORAGE_KEY = 'nsl_onboarding_complete';
var TOOLTIP_KEY = 'nsl_onboarding_tooltips';
var currentStep = 0;
var totalSteps = 3;
var overlay = null;

var steps = [
  {
    icon: 'chat',
    title: 'Welcome to NSL Chat',
    desc: 'Modern team messaging',
    gradient: 'from-primary to-tertiary'
  },
  {
    icon: 'call',
    title: 'Stay Connected',
    desc: 'Voice & video calls, status updates, and more',
    gradient: 'from-blue to-primary'
  },
  {
    icon: 'lock',
    title: 'Secure & Private',
    desc: 'End-to-end encryption, app lock, two-factor auth',
    gradient: 'from-tertiary to-primary'
  }
];

var gestureTooltips = [
  { id: 'swipe_reply', text: 'Swipe left to reply', icon: 'arrow_back', target: '.chat-item' },
  { id: 'long_press', text: 'Long press for options', icon: 'touch_app', target: '.message-bubble' },
  { id: 'drag_share', text: 'Drag files to share', icon: 'upload_file', target: '#chat-area' }
];

var permissions = [
  { key: 'camera', title: 'Camera Access', desc: 'We need camera access for video calls and photo sharing', icon: 'videocam' },
  { key: 'microphone', title: 'Microphone Access', desc: 'Microphone access enables voice messages and calls', icon: 'mic' },
  { key: 'contacts', title: 'Contacts Access', desc: 'Contact access helps you find friends', icon: 'contacts_book' }
];

function shouldShowOnboarding() {
  try { return localStorage.getItem(STORAGE_KEY) !== 'true'; } catch(e) { return false; }
}

function createOverlay() {
  var el = document.createElement('div');
  el.id = 'onboarding-overlay';
  el.className = 'fixed inset-0 z-[99998] flex items-center justify-center';
  el.style.cssText = 'background:var(--scrim,#00000080);backdrop-filter:blur(8px);opacity:0;transition:opacity 0.3s ease;pointer-events:auto;';
  el.innerHTML = '<div id="onboarding-card" style="width:100%;max-width:420px;max-height:90vh;overflow-y:auto;background:var(--surface);border-radius:var(--radius-xl,24px);box-shadow:0 24px 48px #00000040;padding:32px 24px 24px;display:flex;flex-direction:column;align-items:center;gap:8px;transform:scale(0.95);transition:transform 0.3s ease;position:relative;"></div>';
  return el;
}

function renderStep() {
  var card = document.getElementById('onboarding-card');
  if (!card) return;
  var s = steps[currentStep];
  var progress = '';
  for (var i = 0; i < totalSteps; i++) {
    progress += '<span style="width:8px;height:8px;border-radius:50%;background:' + (i === currentStep ? 'var(--primary)' : 'var(--border)') + ';transition:all 0.3s ease;"></span>';
  }
  card.innerHTML =
    '<div style="width:80px;height:80px;border-radius:var(--radius-xl,20px);background:linear-gradient(135deg,var(--primary),var(--tertiary,#6750a4));display:flex;align-items:center;justify-content:center;margin-bottom:8px;box-shadow:0 8px 24px var(--primary,#6750a4)40;">' +
      '<span class="material-symbols-outlined" style="font-size:40px;color:var(--on-primary,#fff);font-variation-settings:\'FILL\' 1;">' + s.icon + '</span>' +
    '</div>' +
    '<h2 style="font-family:var(--font-headline,system-ui);font-size:22px;font-weight:700;color:var(--on-surface,#e6e1e5);text-align:center;margin:0;">' + s.title + '</h2>' +
    '<p style="font-size:14px;color:var(--on-surface-variant,#cac4d0);text-align:center;margin:0 0 16px;max-width:280px;">' + s.desc + '</p>' +
    '<div style="display:flex;gap:8px;margin-bottom:8px;">' + progress + '</div>' +
    '<button id="onboarding-next" style="width:100%;padding:14px;border:none;border-radius:var(--radius-xl,20px);background:var(--primary,#6750a4);color:var(--on-primary,#fff);font-size:15px;font-weight:600;cursor:pointer;transition:opacity 0.2s;">' + (currentStep === totalSteps - 1 ? 'Get Started' : 'Next') + '</button>' +
    '<button id="onboarding-skip" style="background:none;border:none;color:var(--on-surface-variant,#cac4d0);font-size:13px;cursor:pointer;padding:8px;margin-top:4px;">' + (currentStep === totalSteps - 1 ? '' : 'Skip') + '</button>';
  if (currentStep === totalSteps - 1) {
    var skipBtn = card.querySelector('#onboarding-skip');
    if (skipBtn) skipBtn.style.display = 'none';
  }
  document.getElementById('onboarding-next').addEventListener('click', function() {
    if (currentStep === totalSteps - 1) { completeOnboarding(); } else { nextOnboardingStep(); }
  });
  var skipB = document.getElementById('onboarding-skip');
  if (skipB) skipB.addEventListener('click', function() { skipOnboarding(); });
}

function showOnboarding() {
  if (!shouldShowOnboarding()) return;
  currentStep = 0;
  overlay = createOverlay();
  document.body.appendChild(overlay);
  renderStep();
  requestAnimationFrame(function() {
    overlay.style.opacity = '1';
    var card = document.getElementById('onboarding-card');
    if (card) card.style.transform = 'scale(1)';
  });
}

function nextOnboardingStep() {
  if (currentStep < totalSteps - 1) { currentStep++; renderStep(); }
}

function prevOnboardingStep() {
  if (currentStep > 0) { currentStep--; renderStep(); }
}

function skipOnboarding() { dismissOnboarding(); }

function completeOnboarding() {
  showPermissionFlow(0, function() {
    showProfilePrompt(function() { dismissOnboarding(); });
  });
}

function dismissOnboarding() {
  if (overlay) {
    overlay.style.opacity = '0';
    var card = document.getElementById('onboarding-card');
    if (card) card.style.transform = 'scale(0.95)';
    setTimeout(function() { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); overlay = null; }, 300);
  }
  try { localStorage.setItem(STORAGE_KEY, 'true'); } catch(e) {}
  showGestureDiscovery();
  setTimeout(function() {
    if (typeof window.isProfileSetupComplete === 'function' && !window.isProfileSetupComplete() && typeof window.openProfileSetup === 'function') {
      window.openProfileSetup();
    }
  }, 600);
}

function showPermissionFlow(index, callback) {
  if (index >= permissions.length) { callback(); return; }
  var p = permissions[index];
  var card = document.getElementById('onboarding-card');
  if (!card) { callback(); return; }
  card.innerHTML =
    '<div style="width:64px;height:64px;border-radius:50%;background:var(--primary-container,#e8def8);display:flex;align-items:center;justify-content:center;margin-bottom:16px;">' +
      '<span class="material-symbols-outlined" style="font-size:32px;color:var(--on-primary-container,#1d192b);">' + p.icon + '</span>' +
    '</div>' +
    '<h2 style="font-family:var(--font-headline,system-ui);font-size:20px;font-weight:700;color:var(--on-surface);text-align:center;margin:0;">' + p.title + '</h2>' +
    '<p style="font-size:14px;color:var(--on-surface-variant);text-align:center;margin:12px 0 24px;max-width:300px;">' + p.desc + '</p>' +
    '<div style="display:flex;gap:12px;width:100%;">' +
      '<button id="perm-notnow" style="flex:1;padding:12px;border:1px solid var(--border);border-radius:var(--radius-xl,20px);background:transparent;color:var(--on-surface);font-size:14px;font-weight:500;cursor:pointer;">Not Now</button>' +
      '<button id="perm-allow" style="flex:1;padding:12px;border:none;border-radius:var(--radius-xl,20px);background:var(--primary);color:var(--on-primary);font-size:14px;font-weight:600;cursor:pointer;">Allow</button>' +
    '</div>';
  document.getElementById('perm-allow').addEventListener('click', function() {
    requestPermission(p.key); showPermissionFlow(index + 1, callback);
  });
  document.getElementById('perm-notnow').addEventListener('click', function() {
    showPermissionFlow(index + 1, callback);
  });
}

function requestPermission(key) {
  if (key === 'camera' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true }).then(function(s) { s.getTracks().forEach(function(t) { t.stop(); }); }).catch(function() {});
  } else if (key === 'microphone' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(s) { s.getTracks().forEach(function(t) { t.stop(); }); }).catch(function() {});
  }
}

function showProfilePrompt(callback) {
  var card = document.getElementById('onboarding-card');
  if (!card) { callback(); return; }
  card.innerHTML =
    '<div style="width:80px;height:80px;border-radius:50%;background:var(--primary-container);display:flex;align-items:center;justify-content:center;margin-bottom:16px;border:3px dashed var(--primary);">' +
      '<span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);">person_add</span>' +
    '</div>' +
    '<h2 style="font-family:var(--font-headline,system-ui);font-size:20px;font-weight:700;color:var(--on-surface);text-align:center;margin:0;">Add Your Profile</h2>' +
    '<p style="font-size:14px;color:var(--on-surface-variant);text-align:center;margin:12px 0 24px;max-width:280px;">Add your name and photo to get started</p>' +
    '<button id="profile-setup-btn" style="width:100%;padding:14px;border:none;border-radius:var(--radius-xl,20px);background:var(--primary);color:var(--on-primary);font-size:15px;font-weight:600;cursor:pointer;">Set Up Profile</button>' +
    '<button id="profile-skip-btn" style="background:none;border:none;color:var(--on-surface-variant);font-size:13px;cursor:pointer;padding:8px;margin-top:4px;">Skip for now</button>';
  document.getElementById('profile-setup-btn').addEventListener('click', function() {
    if (typeof window.openProfileEdit === 'function') window.openProfileEdit();
    callback();
  });
  document.getElementById('profile-skip-btn').addEventListener('click', function() { callback(); });
}

function showGestureDiscovery() {
  try {
    var seen = JSON.parse(localStorage.getItem(TOOLTIP_KEY) || '[]');
  } catch(e) { seen = []; }
  gestureTooltips.forEach(function(gt) {
    if (seen.indexOf(gt.id) !== -1) return;
    var el = document.querySelector(gt.target);
    if (!el) return;
    showGestureTooltip(el, gt.text, gt.icon);
    seen.push(gt.id);
  });
  try { localStorage.setItem(TOOLTIP_KEY, JSON.stringify(seen)); } catch(e) {}
}


function showGestureTooltip(target, text, icon) {
  var tip = document.createElement('div');
  tip.className = 'gesture-tooltip';
  tip.style.cssText = 'position:fixed;z-index:99997;background:var(--surface);color:var(--on-surface);padding:10px 16px;border-radius:var(--radius-lg,16px);box-shadow:0 8px 24px #00000030;font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px;opacity:0;transform:translateY(8px);transition:all 0.3s ease;pointer-events:none;max-width:220px;';
  var iconHtml = icon ? '<span class="material-symbols-outlined" style="font-size:18px;color:var(--primary);">' + icon + '</span>' : '';
  tip.innerHTML = iconHtml + '<span>' + text + '</span>';
  document.body.appendChild(tip);
  var rect = target.getBoundingClientRect();
  tip.style.left = rect.left + rect.width / 2 - tip.offsetWidth / 2 + 'px';
  tip.style.top = rect.top - tip.offsetHeight - 8 + 'px';
  if (parseInt(tip.style.top) < 8) tip.style.top = rect.bottom + 8 + 'px';
  requestAnimationFrame(function() { tip.style.opacity = '1'; tip.style.transform = 'translateY(0)'; });
  setTimeout(function() {
    tip.style.opacity = '0';
    tip.style.transform = 'translateY(8px)';
    setTimeout(function() { if (tip.parentNode) tip.parentNode.removeChild(tip); }, 300);
  }, 3000);
}

window.showOnboarding = showOnboarding;
window.nextOnboardingStep = nextOnboardingStep;
window.prevOnboardingStep = prevOnboardingStep;
window.skipOnboarding = skipOnboarding;
window.completeOnboarding = completeOnboarding;
window.shouldShowOnboarding = shouldShowOnboarding;
window.showGestureTooltip = showGestureTooltip;

})();
