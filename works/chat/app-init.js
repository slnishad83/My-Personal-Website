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
init().catch((error) => {
  console.error("Application startup failed:", error);
  showStartupRecovery("Team Chat could not start. Please retry.");
});
