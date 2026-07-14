// ========================================
// APPLICATION INITIALIZATION
// ========================================

// Run framework initializes
init().catch((error) => {
  console.error("Application startup failed:", error);
  showStartupRecovery("Team Chat could not start. Please retry.");
});
