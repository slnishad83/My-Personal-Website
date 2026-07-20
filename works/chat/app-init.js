// ========================================
// APPLICATION INITIALIZATION
// ========================================

// M2: Sidebar expand/collapse toggle (tablet view)
window.toggleSidebarExpand = function() {
  var sidebar = document.getElementById('sidebar');
  var icon = document.getElementById('sidebar-toggle-icon');
  if (!sidebar) return;
  if (sidebar.classList.contains('w-20')) {
    sidebar.classList.remove('w-20');
    sidebar.classList.add('w-64');
    if (icon) icon.textContent = 'menu';
  } else {
    sidebar.classList.remove('w-64');
    sidebar.classList.add('w-20');
    if (icon) icon.textContent = 'menu_open';
  }
};

// Run framework initializes
if (typeof init === 'function') {
  init().catch((error) => {
    console.error("Application startup failed:", error);
    if (typeof window.showStartupRecovery === 'function') {
      window.showStartupRecovery("Team Chat could not start. Please retry.");
    } else {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#111b21;color:#e9edef;text-align:center;padding:20px"><div><h2 style="margin-bottom:12px">Something went wrong</h2><p style="color:#8696a0;margin-bottom:20px">Team Chat could not start. Please retry.</p><button onclick="location.reload()" style="padding:10px 24px;background:#00a884;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer">Retry</button></div></div>';
    }
  });
}
