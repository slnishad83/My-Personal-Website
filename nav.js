// ========================================
// NISHADSL.COM - Shared Navigation & Utilities
// Single source of truth: edit once, applies everywhere
// ========================================
(function () {

  function isActive(matches) {
    var path = window.location.pathname;
    return matches.some(function (m) { return path === m || path.endsWith(m); });
  }

  function navLink(href, label, matches) {
    var cls = isActive(matches) ? ' class="active"' : '';
    return '<li><a href="' + href + '"' + cls + '>' + label + '</a></li>';
  }

  var navHTML = '<nav class="navbar">' +
    '<div class="nav-container">' +
      '<a href="index.html" class="logo">Nishad<span>SL</span></a>' +
      '<ul class="nav-menu" id="navMenu">' +
        navLink('index.html', 'Home', ['/', '/index.html']) +
        navLink('resume.html', 'Resume', ['/resume.html']) +
        '<li class="nav-item-dropdown">' +
          '<button class="nav-works-btn" aria-haspopup="true" aria-expanded="false">' +
            'Works <span class="nav-works-arrow">&#9660;</span>' +
          '</button>' +
          '<ul class="dropdown-menu" role="menu">' +
            '<li role="none"><a href="/works/invoice.html" target="_blank" role="menuitem">&#128196; Invoice Generator</a></li>' +
            '<li role="none"><a href="/works/chat/login.html" target="_blank" role="menuitem">&#128172; Team Chat</a></li>' +
          '</ul>' +
        '</li>' +
        navLink('contact.html', 'Contact', ['/contact.html']) +
      '</ul>' +
      '<div class="right-buttons">' +
        '<button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle dark mode"><span aria-hidden="true">&#127769;</span></button>' +
        '<button class="mobile-menu-btn" onclick="toggleMenu()">&#9776;</button>' +
      '</div>' +
    '</div>' +
  '</nav>';

  var wrapper = document.querySelector('.wrapper');
  if (wrapper) wrapper.insertAdjacentHTML('afterbegin', navHTML);

  window.toggleTheme = function () {
    var body = document.body;
    var toggle = document.querySelector('.theme-toggle');
    if (body.classList.contains('dark')) {
      body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      if (toggle) toggle.innerHTML = '<span aria-hidden="true">&#127769;</span>';
    } else {
      body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      if (toggle) toggle.innerHTML = '<span aria-hidden="true">&#9728;&#65039;</span>';
    }
  };

  window.toggleMenu = function () {
    var m = document.getElementById('navMenu');
    if (m) m.classList.toggle('active');
  };

  window.copyContact = function () {
    var text = 'Nishad S L\nSenior Digital Marketing Specialist\n\nPhone: +91 9846310043\nEmail: sl.nishad@gmail.com\nLocation: Thrissur, Kerala, India\nLinkedIn: https://www.linkedin.com/in/nishadsl/';
    navigator.clipboard.writeText(text)
      .then(function () { alert('\u2713 Contact information copied to clipboard!'); })
      .catch(function () { alert('Please manually copy the contact details.'); });
  };

  function loadTheme() {
    var saved = localStorage.getItem('theme');
    var toggle = document.querySelector('.theme-toggle');
    if (saved === 'dark') {
      document.body.classList.add('dark');
      if (toggle) toggle.innerHTML = '<span aria-hidden="true">&#9728;&#65039;</span>';
    } else {
      if (toggle) toggle.innerHTML = '<span aria-hidden="true">&#127769;</span>';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadTheme();

    var worksBtn = document.querySelector('.nav-works-btn');
    var worksDropdown = document.querySelector('.nav-item-dropdown');
    if (worksBtn && worksDropdown) {
      worksBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = worksDropdown.classList.toggle('open');
        worksBtn.setAttribute('aria-expanded', String(isOpen));
      });
      document.addEventListener('click', function (e) {
        if (!worksDropdown.contains(e.target)) {
          worksDropdown.classList.remove('open');
          worksBtn.setAttribute('aria-expanded', 'false');
        }
      });
      worksDropdown.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          worksDropdown.classList.remove('open');
          worksBtn.setAttribute('aria-expanded', 'false');
          worksBtn.focus();
        }
      });
      document.querySelectorAll('.nav-menu a').forEach(function (link) {
        link.addEventListener('click', function () {
          var navMenu = document.getElementById('navMenu');
          if (navMenu && window.innerWidth <= 768) {
            navMenu.classList.remove('active');
            worksDropdown.classList.remove('open');
            worksBtn.setAttribute('aria-expanded', 'false');
          }
        });
      });
    }

    var btn = document.getElementById('modernBackToTop');
    if (btn) {
      window.addEventListener('scroll', function () {
        window.scrollY > 300 ? btn.classList.add('show') : btn.classList.remove('show');
      });
      btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    var yearEl = document.getElementById('currentYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var href = this.getAttribute('href');
        if (href !== '#' && href !== '') {
          var target = document.querySelector(href);
          if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
        }
      });
    });
  });

})();
