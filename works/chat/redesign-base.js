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
    document.body.classList.toggle("dark", theme === "dark");
  }

  window.setThemeMode = function(mode) {
    localStorage.setItem("themeMode", mode);
    var theme = resolveTheme(mode);
    applyTheme(theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: { mode: mode, theme: theme } }));
  };

  window.getThemeMode = function() { return getStoredMode(); };
  window.getCurrentTheme = function() { return document.documentElement.dataset.theme || "light"; };

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
    var currentPath = location.pathname.split("/").pop() || "index.html";
    bottomNav.querySelectorAll(".nav-item").forEach(function(item) {
      var href = item.getAttribute("href");
      if (href === currentPath) item.classList.add("active");
      else item.classList.remove("active");
    });
  }
})();
