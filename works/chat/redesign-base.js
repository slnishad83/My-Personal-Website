/* 2026 Universal Design - Global Enhancements */
(function() {
  /* Ripple effect on all clickable elements with ripple class or btn classes */
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

  /* Dark mode: persist toggle with localStorage */
  var darkToggle = document.getElementById("darkToggleBtn");
  if (darkToggle) {
    darkToggle.addEventListener("click", function() {
      var isDark = document.body.classList.toggle("dark");
      localStorage.setItem("darkMode", isDark);
    });
    if (localStorage.getItem("darkMode") === "true") {
      document.body.classList.add("dark");
    }
  }
})();
