/**
 * NSL Chat — Vite Entry Point (index.html)
 *
 * CRITICAL PATH: Only essential foundation + bootstrap modules loaded synchronously.
 * FEATURE MODULES: Deferred to after first paint via requestIdleCallback.
 * ON-DEMAND: Lazy-loaded when user triggers specific features via LazyModules.load().
 */

/* ── CSS (Vite processes Tailwind + extracts to bundle) ──── */
import './src/styles/main.css';
import './src/styles/app.css';
import './chat.css';
import './accessibility.css';

/* ── Head-loaded scripts (loaded before body content) ───── */
import './notification-sounds.js';
import './twemoji/twemoji.min.js';
import './emoji-renderer.js';
import './tailwind-config.js';

/* ══════════════════════════════════════════════════════════════
   FOUNDATION — must load in this exact order
   ══════════════════════════════════════════════════════════════ */
import './firebase-config.js';
import './config.js';
import './global-cleanup.js';
import './app.js';
import './lazy-modules.js';

/* ══════════════════════════════════════════════════════════════
   CORE INFRASTRUCTURE (needed for first paint & event delegation)
   ══════════════════════════════════════════════════════════════ */
import './platform-detect.js';
import './error-boundary.js';
import './mutation-bus.js';
import './virtual-scroll.js';
import './accessibility.js';
import './src/core/bindEvents.js';
import './ui-glue.js';

/* ══════════════════════════════════════════════════════════════
   BOOTSTRAP & LATE-BINDING
   ══════════════════════════════════════════════════════════════ */
import './presence.js';
import './multi-device.js';
import './delegated-actions.js';
import './app-bootstrap.js';
import './app-init.js';
import './verified-peers.js';
import './chat-core.js';
import './tab-engine.js';
import './version.js';
import './broadcast-sync.js';

/* ══════════════════════════════════════════════════════════════
   DEFERRED MODULES — loaded after first paint via requestIdleCallback
   These were previously static imports bloating the main chunk.
   ══════════════════════════════════════════════════════════════ */
const _deferredModules = [
  // --- Infrastructure & utilities ---
  () => import('./smart-notifications.js'),
  () => import('./file-versioning.js'),
  () => import('./offline-queue.js'),
  () => import('./call-sync.js'),
  () => import('./security.js'),
  () => import('./e2e.js'),
  () => import('./keyboard-shortcuts.js'),
  () => import('./permissions-manager.js'),
  () => import('./chat-missing-features.js'),
  () => import('./pull-to-refresh.js'),
  () => import('./pinch-zoom.js'),
  () => import('./swipe-delete.js'),
  () => import('./back-button.js'),
  () => import('./ios-keyboard-fix.js'),

  // --- Chat & message features ---
  () => import('./chat-enhancements.js'),
  () => import('./message-effects.js'),
  () => import('./chat-fixes.js'),
  () => import('./smart-reply.js'),
  () => import('./streak.js'),
  () => import('./saved-messages.js'),
  () => import('./self-destruct.js'),
  () => import('./message-scheduler.js'),
  () => import('./translation.js'),
  () => import('./message-copy.js'),
  () => import('./screen-share.js'),
  () => import('./ghost-mode.js'),
  () => import('./screenshot-control.js'),
  () => import('./message-recall.js'),
  () => import('./message-edit.js'),
  () => import('./message-star.js'),
  () => import('./message-multi-select.js'),
  () => import('./sensitive-content.js'),
  () => import('./mood-status.js'),
  () => import('./threads.js'),
  () => import('./message-search.js'),

  // --- Notification & communication ---
  () => import('./notification-prefs.js'),
  () => import('./notification-digest.js'),
  () => import('./notification-reply.js'),
  () => import('./notification-orchestrator.js'),
  () => import('./notification-bell.js'),
  () => import('./notification-telemetry.js'),
  () => import('./notification-nav.js'),
  () => import('./chat-notifications.js'),
  () => import('./ios-callkit.js'),
  () => import('./desktop-notifications.js'),
  () => import('./pwa-install.js'),
  () => import('./push-notifications.js'),

  // --- Call & real-time features ---
  () => import('./call-controller.js'),
  () => import('./group-call.js'),
  () => import('./call-history.js'),
  () => import('./background-call-handler.js'),
  () => import('./call-link.js'),
  () => import('./in-call-reactions.js'),
  () => import('./call-recording.js'),

  // --- WhatsApp parity & messaging ---
  () => import('./ui-compliance.js'),
  () => import('./audit-interactions.js'),
  () => import('./whatsapp-enhancements.js'),
  () => import('./broadcast.js'),
  () => import('./features-addon.js'),
  () => import('./archive-chat.js'),
  () => import('./forward-modal.js'),
  () => import('./block-user.js'),
  () => import('./message-reactions.js'),
  () => import('./delete-group.js'),
  () => import('./profile-edit.js'),
  () => import('./video-notes.js'),
  () => import('./voice-messages.js'),
  () => import('./voice-changer.js'),
  () => import('./mention-autocomplete.js'),
  () => import('./font-size-settings.js'),
  () => import('./change-number.js'),
  () => import('./message-actions.js'),
  () => import('./proximity-sensor.js'),
  () => import('./status.js'),
  () => import('./status-viewer.js'),
  () => import('./unread-polish.js'),
  () => import('./home-camera.js'),
  () => import('./group-features.js'),
  () => import('./contact-popup.js'),
  () => import('./group-message-info.js'),

  // --- UI/UX enhancements ---
  () => import('./onboarding.js'),
  () => import('./empty-states.js'),
  () => import('./form-validation.js'),
  () => import('./toast-ux.js'),
  () => import('./a11y-enhancements.js'),
  () => import('./message-errors.js'),
  () => import('./report-user.js'),
  () => import('./gif-picker.js'),
  () => import('./sticker-packs.js'),
  () => import('./communities.js'),
  () => import('./backup.js'),
  () => import('./micro-interactions.js'),
  () => import('./profile-setup.js'),
  () => import('./lazy-images.js'),
  () => import('./screenshot-protection.js'),
  () => import('./in-app-update.js'),
  () => import('./app-shortcuts.js'),
  () => import('./haptic-feedback.js'),

  // --- V3.5+ features ---
  () => import('./scheduled-calendar.js'),
  () => import('./snooze-history.js'),
  () => import('./snooze-enhancements.js'),
  () => import('./ai-bot.js'),
  () => import('./fixes.js'),
  () => import('./feature-updates.js'),
  () => import('./sync-audit.js'),
  () => import('./url-preview.js'),
  () => import('./redesign-base.js'),
  () => import('./request-priority.js'),
  () => import('./sanitize.js'),
  () => import('./clipboard-paste.js'),
  () => import('./desktop-fullscreen.js'),
  () => import('./desktop-context-menu.js'),
  () => import('./window-title.js'),
  () => import('./whatsapp-share.js'),
  () => import('./swipe-nav.js'),
  () => import('./attachment-reliability.js'),
  () => import('./task-from-message.js'),
  () => import('./meeting-scheduler.js'),
  () => import('./chat-permissions.js'),
  () => import('./announcement-mode.js'),
  () => import('./channel-mode.js'),
  () => import('./two-factor-auth.js'),
  () => import('./account-deletion.js'),
  () => import('./view-once.js'),
  () => import('./live-location.js'),
  () => import('./data-saver.js'),
  () => import('./wallpaper-gallery.js'),
  () => import('./help-support.js'),
  () => import('./reply-private.js'),
  () => import('./group-meta.js'),

  // --- V4.1+ features ---
  () => import('./chat-mark-unread.js'),
  () => import('./chat-drafts.js'),
  () => import('./chat-scroll-unread.js'),
  () => import('./privacy-controls.js'),
  () => import('./voice-to-text.js'),
  () => import('./quick-replies.js'),
  () => import('./message-translation.js'),
  () => import('./chat-folders.js'),
  () => import('./search-contacts.js'),
  () => import('./message-reminders.js'),
  () => import('./chat-calculator.js'),
  () => import('./event-from-message.js'),
  () => import('./media-autoplay.js'),
  () => import('./pinned-header.js'),
  () => import('./payment-split.js'),
  () => import('./large-file-sharing.js'),

  // --- Signal Protocol & E2EE ---
  () => import('./signal-protocol.js'),
  () => import('./media-encryption.js'),
  () => import('./disappearing-messages.js'),
  () => import('./lock-chat.js'),
  () => import('./screen-lock.js'),
  () => import('./voice-waveform.js'),

  // --- V5.2 WhatsApp-parity features ---
  () => import('./video-thumbnail.js'),
  () => import('./call-reject-message.js'),
  () => import('./encrypted-backups.js'),
  () => import('./security-notifications.js'),
  () => import('./request-account-info.js'),
  () => import('./poll-creation.js'),
  () => import('./message-grouping.js'),
  () => import('./message-ux.js'),
  () => import('./swipe-reply.js'),
  () => import('./double-tap-react.js'),
  () => import('./typing-indicator.js'),
  () => import('./pinned-chats.js'),
  () => import('./media-compression.js'),
];

async function _loadDeferredModules() {
  for (const load of _deferredModules) {
    try { await load(); } catch (e) { /* continue loading next module */ }
  }
}

if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(_loadDeferredModules, { timeout: 10000 });
} else {
  window.addEventListener('load', () => setTimeout(_loadDeferredModules, 200));
}

/* ══════════════════════════════════════════════════════════════
   ON-DEMAND MODULES (loaded via LazyModules.load('name'))
   ══════════════════════════════════════════════════════════════ */
const _lazyModules = [
  () => import('./date-reminders.js'),
  () => import('./jump-to-date.js'),
  () => import('./chat-themes.js'),
  () => import('./ai-features.js'),
  () => import('./chat-export.js'),
  () => import('./music-player.js'),
  () => import('./music-library.js'),
  () => import('./playlist-core.js'),
  () => import('./playlist-ui.js'),
  () => import('./playlist-sync.js'),
  () => import('./calculator.js'),
  () => import('./jsQR.js'),
  () => import('./qr-scanner.js'),
  () => import('./cloud-drive.js'),
  () => import('./collaborative-whiteboard.js'),
  () => import('./image-annotation.js'),
  () => import('./contact-sync.js'),
  () => import('./qr-code-gen.js'),
];

async function _loadLazyModules() {
  for (const load of _lazyModules) {
    try { await load(); } catch (e) { if (window.__DEBUG__) console.warn('[App] Lazy module load failed:', e.message); }
  }
}

if (document.readyState === 'complete') {
  _loadLazyModules();
} else {
  window.addEventListener('load', () => setTimeout(_loadLazyModules, 100));
}
