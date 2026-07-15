// ========================================
// NISHADSL.COM - Contact Form Submission
// ========================================

// REPLACE THIS with your Turnstile Site Key from https://dash.cloudflare.com/turnstile
// Go to Turnstile → Add Widget → copy the "Site Key"
var TURNSTILE_SITE_KEY = 'REPLACE_WITH_YOUR_TURNSTILE_SITE_KEY';

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('contactForm');
  var successMsg = document.getElementById('successMessage');
  var submitBtn = document.getElementById('submitBtn');
  if (!form) return;

  // ── Initialize Turnstile ──────────────────────────────────
  var turnstileToken = null;

  function initTurnstile() {
    if (typeof turnstile === 'undefined' || !document.getElementById('cf-turnstile')) {
      setTimeout(initTurnstile, 300);
      return;
    }
    turnstile.render('#cf-turnstile', {
      sitekey: TURNSTILE_SITE_KEY,
      callback: function (token) { turnstileToken = token; },
      'error-callback': function () { turnstileToken = null; },
      'expired-callback': function () { turnstileToken = null; },
      theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      appearance: 'interaction-only',
      execution: 'execute'
    });
  }
  initTurnstile();

  // ── Form Submission ───────────────────────────────────────
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    // Validate Turnstile token
    if (!turnstileToken) {
      // Try to execute the challenge if widget exists
      try { turnstile.execute('#cf-turnstile'); } catch (_) {}
      alert('Please wait for the security check to complete, then try again.');
      return;
    }

    var btn = submitBtn;
    var orig = btn.innerHTML;
    btn.innerHTML = '&#9203; Sending...';
    btn.disabled = true;

    var fd = new FormData();
    fd.append('name', document.getElementById('name').value);
    fd.append('email', document.getElementById('email').value);
    fd.append('_replyto', document.getElementById('email').value);
    fd.append('_subject', 'Message from ' + document.getElementById('name').value + ': ' + (document.getElementById('subject').value || 'No Subject'));
    fd.append('subject', document.getElementById('subject').value);
    fd.append('message', document.getElementById('message').value);
    fd.append('cf-turnstile-response', turnstileToken);

    try {
      var res = await fetch('https://formspree.io/f/xeenzngd', {
        method: 'POST', body: fd, headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        form.style.display = 'none';
        successMsg.style.display = 'block';
        successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert('Something went wrong. Please try again or email me directly at sl.nishad@gmail.com');
        btn.innerHTML = orig; btn.disabled = false;
        turnstileToken = null;
        try { turnstile.reset('#cf-turnstile'); } catch (_) {}
      }
    } catch (_) {
      alert('Network error. Please check your connection and try again.');
      btn.innerHTML = orig; btn.disabled = false;
      turnstileToken = null;
      try { turnstile.reset('#cf-turnstile'); } catch (_) {}
    }
  });
});
