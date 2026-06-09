// ========================================
// NISHADSL.COM — 2026 Interactive Features
// ========================================

// Instant theme apply (prevents flash)
(function() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.body.classList.add('dark');
})();

// Theme Toggle
function toggleTheme() {
  const body = document.body;
  const btn = document.querySelector('.theme-toggle');
  const isDark = body.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

// Load saved theme
function loadTheme() {
  const saved = localStorage.getItem('theme');
  const btn = document.querySelector('.theme-toggle');
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = saved === 'dark' || (saved === null && prefersDark);
  document.body.classList.toggle('dark', dark);
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
}

// Mobile Menu Toggle
function toggleMenu() {
  const nav = document.getElementById('navMenu');
  if (nav) nav.classList.toggle('active');
}

// Close mobile menu on link click
document.querySelectorAll('.nav-menu a').forEach(link => {
  link.addEventListener('click', () => {
    const nav = document.getElementById('navMenu');
    if (nav) nav.classList.remove('active');
  });
});

// Navbar scroll shadow
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

// Copy Contact Info
function copyContact() {
  const text = "Nishad S L\nSenior Digital Marketing Specialist\n\nPhone: +91 9846310043\nEmail: sl.nishad@gmail.com\nLocation: Thrissur, Kerala, India\nLinkedIn: https://www.linkedin.com/in/nishadsl/";
  navigator.clipboard.writeText(text).then(() => {
    showToast('✓ Contact info copied!');
  }).catch(() => {
    alert('Please manually copy the contact details.');
  });
}

// Toast notification
function showToast(msg, duration = 2500) {
  let toast = document.getElementById('copyToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'copyToast';
    toast.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(10px);
      background:#0f172a;color:#fff;padding:10px 22px;border-radius:40px;
      font-size:14px;font-weight:500;z-index:99998;opacity:0;
      transition:all 0.3s ease;pointer-events:none;white-space:nowrap;
      box-shadow:0 6px 20px rgba(0,0,0,0.25);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
  }, duration);
}

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href !== '#' && href !== '') {
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
});

// Back to Top Button
const backToTopBtn = document.getElementById('modernBackToTop');

function handleBackToTopVisibility() {
  if (!backToTopBtn) return;
  backToTopBtn.classList.toggle('show', window.scrollY > 300);
}

window.addEventListener('scroll', handleBackToTopVisibility, { passive: true });

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Animate stats on scroll
function animateStats() {
  const stats = document.querySelectorAll('.stat-number');
  if (!stats.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.textContent);
        const suffix = el.textContent.replace(/[\d]/g, '');
        if (isNaN(target)) return;
        let start = 0;
        const duration = 1200;
        const step = timestamp => {
          if (!start) start = timestamp;
          const progress = Math.min((timestamp - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.floor(eased * target) + suffix;
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  stats.forEach(el => observer.observe(el));
}

// Fade-in on scroll
function setupScrollFade() {
  const elements = document.querySelectorAll('.service-card, .stat-card, .company-card');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  elements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}

// Reading progress bar
function updateReadingProgress() {
  const bar = document.getElementById('readingProgress');
  if (!bar) return;
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.width = docHeight > 0 ? ((scrollTop / docHeight) * 100) + '%' : '0%';
}
window.addEventListener('scroll', updateReadingProgress, { passive: true });

// Typewriter cycling badge
function setupTypewriterBadge() {
  const badge = document.querySelector('.hero-badge');
  if (!badge) return;
  const roles = [
    '\u2736 Senior Digital Marketing Specialist',
    '\u2736 SEO & Performance Marketing Expert',
    '\u2736 Social Media Strategist',
    '\u2736 Growth Marketing Leader',
  ];
  let roleIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  badge.textContent = '';

  function tick() {
    const current = roles[roleIndex];
    if (isDeleting) {
      charIndex--;
      badge.textContent = current.substring(0, charIndex);
      if (charIndex <= 0) {
        isDeleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
        charIndex = 0;
        setTimeout(tick, 380);
        return;
      }
      setTimeout(tick, 32);
    } else {
      charIndex++;
      badge.textContent = current.substring(0, charIndex);
      if (charIndex >= current.length) {
        isDeleting = true;
        setTimeout(tick, 2200);
        return;
      }
      setTimeout(tick, 62);
    }
  }
  setTimeout(tick, 600);
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  animateStats();
  setupScrollFade();
  handleBackToTopVisibility();
  setupTypewriterBadge();
  updateReadingProgress();
});
