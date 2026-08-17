/* ============================================================
   SMART NOTIFICATIONS (SN-1)
   AI decides which notifications are important vs low priority.
   - Intercepts incoming message notifications
   - Calls classifyNotification Cloud Function (Gemini)
   - Suppresses sound/vibration/browser notification for "low"
   - Still shows in-app notification dot for all priorities
   - Caches decisions to avoid repeated AI calls
   ============================================================ */
(function () {
  'use strict';

  const CACHE_KEY = 'nsl_smart_notif_cache';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  const STATS_KEY = 'nsl_smart_notif_stats';

  let _enabled = true;
  let _stats = { high: 0, medium: 0, low: 0, suppressed: 0 };

  /* ─── Load preferences & stats ─────────────────────────────── */
  function loadPrefs() {
    try {
      const prefs = JSON.parse(localStorage.getItem('nsl_smart_notif_prefs') || '{}');
      _enabled = prefs.enabled !== false;
    } catch (_) { _enabled = true; }
    try {
      _stats = { ..._stats, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') };
    } catch (_) {}
  }

  function savePrefs() {
    try {
      localStorage.setItem('nsl_smart_notif_prefs', JSON.stringify({ enabled: _enabled }));
      localStorage.setItem(STATS_KEY, JSON.stringify(_stats));
    } catch (_) {}
  }

  /* ─── Cache for classification results ─────────────────────── */
  function getCached(text, chatId) {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const key = `${chatId}:${(text || '').slice(0, 100)}`;
      const entry = cache[key];
      if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.result;
    } catch (_) {}
    return null;
  }

  function setCached(text, chatId, result) {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const key = `${chatId}:${(text || '').slice(0, 100)}`;
      // Prune old entries
      const now = Date.now();
      for (const k of Object.keys(cache)) {
        if (now - cache[k].ts > CACHE_TTL) delete cache[k];
      }
      cache[key] = { result, ts: now };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (_) {}
  }

  /* ─── Classify notification via Cloud Function ──────────────── */
  async function classify(payload) {
    if (!_enabled) return { priority: 'high', reason: 'Smart notifications disabled' };

    const text = payload.text || payload.body || '';
    const chatId = payload.chatId || payload.groupId || '';

    // Check cache first
    const cached = getCached(text, chatId);
    if (cached) return cached;

    try {
      const functions = firebase.functions();
      const classifyNotif = functions.httpsCallable('classifyNotification', { timeout: 10000 });
      const result = await classifyNotif({
        senderName: payload.senderName || payload.title || '',
        text: text.slice(0, 300),
        chatType: payload.chatType || 'direct',
        chatName: payload.chatName || payload.groupName || '',
        isGroup: !!(payload.groupId),
        isMentioned: !!(payload.mentioned || payload.mention),
        isReply: !!(payload.replyTo || payload.isReply),
        hasAttachment: !!(payload.attachment || payload.hasAttachment)
      });

      if (result.data && result.data.priority) {
        setCached(text, chatId, result.data);
        return result.data;
      }
    } catch (err) {
      if (window.__DEBUG__) console.warn('[SmartNotif] Classification failed:', err.message);
    }

    // Fallback rules (no AI needed)
    if (payload.mentioned || payload.mention) return { priority: 'high', reason: 'Mentioned' };
    if (payload.groupId) return { priority: 'medium', reason: 'Group message' };
    return { priority: 'high', reason: 'Direct message' };
  }

  /* ─── Should suppress notification? ────────────────────────── */
  function shouldSuppress(priority) {
    if (priority === 'low') {
      _stats.suppressed++;
      _stats.low++;
      savePrefs();
      return true;
    }
    if (priority === 'medium') _stats.medium++;
    if (priority === 'high') _stats.high++;
    savePrefs();
    return false;
  }

  /* ─── Hook into NotificationOrchestrator ───────────────────── */
  function hookOrchestrator() {
    // Wait for Orchestrator to be ready
    function tryHook() {
      const orch = window.NotificationOrchestrator || window.Orchestrator;
      if (!orch || !orch.notifyMessage) {
        setTimeout(tryHook, 500);
        return;
      }

      const origNotify = orch.notifyMessage.bind(orch);
      orch.notifyMessage = async function (payload) {
        const result = await classify(payload);

        // Tag the payload with AI priority
        payload.aiPriority = result.priority;
        payload.aiReason = result.reason;

        // If low priority, suppress sound/vibration/browser notif
        if (shouldSuppress(result.priority)) {
          // Still update badge and record in history (in-app visibility)
          if (typeof payload.unreadCount !== 'undefined') {
            orch._setBadge(payload.unreadCount);
          }

          // Show a subtle in-app toast instead of full notification
          if (typeof showToast === 'function' && document.visibilityState === 'visible') {
            const sender = payload.senderName || payload.title || 'Someone';
            const preview = (payload.text || payload.body || '').slice(0, 60);
            showToast(`${sender}: ${preview || 'New message'} (Low priority)`, 'info', 3000);
          }

          return false; // Don't show full notification
        }

        // Normal/high priority — pass through to original handler
        return origNotify(payload);
      };

      if (window.__DEBUG__) console.log('[SmartNotif] Hooked into NotificationOrchestrator');
    }

    tryHook();
  }

  /* ─── Hook into push notifications (FCM) ───────────────────── */
  function hookPushNotifications() {
    // Intercept service worker push events for background notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((_reg) => {
        // Listen for messages from SW to classify before showing
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'classify-notif') {
            var source = event.source || (event.target && event.target.constructor && event.target);
            classify(event.data.payload).then(result => {
              if (source && typeof source.postMessage === 'function') {
                source.postMessage({
                  type: 'notif-classified',
                  priority: result.priority,
                  suppress: result.priority === 'low'
                });
              }
            });
          }
        });
      }).catch(() => {});
    }
  }

  /* ─── Settings UI ──────────────────────────────────────────── */
  function renderSmartNotifSettings(container) {
    if (!container) return;
    const section = document.createElement('div');
    section.className = 'space-y-3';
    section.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-on-surface">Smart Notifications</p>
          <p class="text-xs text-on-surface-variant">AI filters low-priority notifications</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="smart-notif-toggle" class="sr-only peer" ${_enabled ? 'checked' : ''}>
          <div class="w-11 h-6 bg-surface-variant rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
        </label>
      </div>
      <div class="flex gap-3 text-xs" id="smart-notif-stats">
        <span class="px-2 py-1 rounded-lg bg-green-500/10 text-green-500">High: ${_stats.high}</span>
        <span class="px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-500">Medium: ${_stats.medium}</span>
        <span class="px-2 py-1 rounded-lg bg-red-500/10 text-red-500">Low: ${_stats.low}</span>
        <span class="px-2 py-1 rounded-lg bg-gray-500/10 text-gray-500">Suppressed: ${_stats.suppressed}</span>
      </div>
    `;

    container.appendChild(section);

    // Toggle handler
    const toggle = section.querySelector('#smart-notif-toggle');
    if (toggle) {
      toggle.addEventListener('change', () => {
        _enabled = toggle.checked;
        savePrefs();
        if (typeof showToast === 'function') {
          showToast(_enabled ? 'Smart Notifications enabled' : 'Smart Notifications disabled', 'info');
        }
      });
    }
  }

  /* ─── Expose stats for notification settings page ──────────── */
  function getStats() {
    return { ..._stats, enabled: _enabled };
  }

  function resetStats() {
    _stats = { high: 0, medium: 0, low: 0, suppressed: 0 };
    savePrefs();
  }

  /* ─── Init ─────────────────────────────────────────────────── */
  function init() {
    loadPrefs();
    hookOrchestrator();
    hookPushNotifications();
  }

  // Expose API
  window.SmartNotifications = {
    classify,
    getStats,
    resetStats,
    renderSettings: renderSmartNotifSettings,
    isEnabled: () => _enabled,
    setEnabled: (v) => { _enabled = !!v; savePrefs(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
