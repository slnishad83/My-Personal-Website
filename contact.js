// ========================================
// NISHADSL.COM - Contact Form Submission
// ========================================
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('contactForm');
  var successMsg = document.getElementById('successMessage');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = document.getElementById('submitBtn');
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
      }
    } catch (_) {
      alert('Network error. Please check your connection and try again.');
      btn.innerHTML = orig; btn.disabled = false;
    }
  });
});
