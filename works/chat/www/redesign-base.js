/* 2026 Universal Design - Global Enhancements & Theme Controller */
(function() {
  /* ── Unified Theme Controller ── */
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function getSystemTheme() {
    return mq && mq.matches ? "dark" : "light";
  }

  function getStoredMode() {
    return localStorage.getItem("themeMode") || "system";
  }

  function resolveTheme(mode) {
    if (mode === "dark") return "dark";
    if (mode === "light") return "light";
    return getSystemTheme();
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    var isDark = theme === "dark";
    document.body.classList.toggle("dark", isDark);

    // Sync theme-color meta tag for PWA and mobile address bar
    var tm = document.querySelector('meta[name="theme-color"]');
    if (!tm) {
      tm = document.createElement('meta');
      tm.name = 'theme-color';
      document.head.appendChild(tm);
    }
    tm.content = isDark ? '#0b141a' : '#008069';

    // Sync apple status bar style
    var apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!apple) {
      apple = document.createElement('meta');
      apple.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(apple);
    }
    apple.content = isDark ? 'black-translucent' : 'default';
  }

  window.setThemeMode = function(mode) {
    localStorage.setItem("themeMode", mode);
    // Keep legacy darkMode item in sync for compatibility with any un-refactored scripts
    localStorage.setItem("darkMode", String(resolveTheme(mode) === "dark"));
    var theme = resolveTheme(mode);
    applyTheme(theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: { mode: mode, theme: theme } }));
  };

  window.getThemeMode = function() { return getStoredMode(); };
  window.getCurrentTheme = function() { return document.documentElement.dataset.theme || "light"; };
  
  window.toggleDark = function() {
    var currentMode = window.getThemeMode();
    var currentTheme = currentMode === "system" ? getSystemTheme() : currentMode;
    var nextMode = currentTheme === "dark" ? "light" : "dark";
    window.setThemeMode(nextMode);
  };

  /* Apply initial theme */
  applyTheme(resolveTheme(getStoredMode()));

  /* Listen for OS theme changes in real-time */
  if (mq) {
    mq.addEventListener("change", function() {
      if (getStoredMode() === "system") {
        applyTheme(getSystemTheme());
        window.dispatchEvent(new CustomEvent("themechange", { detail: { mode: "system", theme: getSystemTheme() } }));
      }
    });
  }

  /* Ripple effect on all clickable elements */
  document.addEventListener("click", function(e) {
    var btn = e.target.closest(".btn, .header-action, .back-btn, .nav-item, .filter-btn, .icon-btn, .card, .btn-action, .btn-cancel, .btn-save, .btn-danger, .btn-primary");
    if (!btn || btn.dataset.noRipple) return;
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 1.2;
    var x = e.clientX - rect.left - size / 2;
    var y = e.clientY - rect.top - size / 2;
    var ripple = document.createElement("span");
    ripple.style.cssText = "position:absolute;width:" + size + "px;height:" + size + "px;left:" + x + "px;top:" + y + "px;border-radius:50%;background:currentColor;opacity:0.2;transform:scale(0);animation:rippleAnim 0.6s ease-out;pointer-events:none;";
    btn.style.position = "relative";
    btn.style.overflow = "hidden";
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", function() { ripple.remove(); });
  });

  /* Auto-highlight active nav item in bottom nav */
  var bottomNav = document.getElementById("bottomNav");
  if (bottomNav) {
    var path = location.pathname;
    bottomNav.querySelectorAll(".nav-item").forEach(function(item) {
      var href = item.getAttribute("href");
      // Normalize comparison to match paths accurately
      var cleanHref = href.replace(/^\/?/, '').replace(/\/+$/, '');
      var cleanPath = path.replace(/^\/?/, '').replace(/\/+$/, '');

      // Special case: works/chat maps to works/chat/index.html or root
      var isActive = false;
      if (cleanHref === "works/chat" || cleanHref === "works/chat/index.html" || cleanHref === "index.html") {
        isActive = (cleanPath === "works/chat" || cleanPath.endsWith("index.html") || cleanPath === "");
      } else {
        isActive = cleanPath.endsWith(cleanHref);
      }

      if (isActive) item.classList.add("active");
      else item.classList.remove("active");
    });
  }
})();
