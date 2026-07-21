// ========================================
// PERMISSIONS MANAGEMENT SYSTEM v2.0
// WhatsApp-style permission handling
// Cross-platform: Android (Capacitor), iOS, Web
// ========================================

// ---- Permission Definitions ----
const PERMISSION_ENTRIES = [
  {
    id: "camera",
    name: "Camera",
    description: "Take photos, record videos, and make video calls.",
    icon: "📷",
    features: ["Take Photo", "Record Video", "Video Call"],
    nativeAlias: "camera",
    webPermissionName: "camera",
    platformType: "media",
    mediaConstraint: { video: true },
  },
  {
    id: "microphone",
    name: "Microphone",
    description: "Record voice messages, make audio and video calls.",
    icon: "🎤",
    features: ["Record Voice Message", "Audio Call", "Video Call"],
    nativeAlias: "microphone",
    webPermissionName: "microphone",
    platformType: "media",
    mediaConstraint: { audio: true },
  },
  {
    id: "notifications",
    name: "Notifications",
    description: "Receive message alerts, call notifications, and updates.",
    icon: "🔔",
    features: ["Push Alerts", "Call Notifications", "Message Notifications"],
    nativeAlias: "notifications",
    webPermissionName: "notifications",
    platformType: "notification",
    mediaConstraint: null,
  },
  {
    id: "location",
    name: "Location",
    description: "Share your location in chats and find nearby places.",
    icon: "📍",
    features: ["Share Location", "Find Nearby Places"],
    nativeAlias: "location",
    webPermissionName: "geolocation",
    platformType: "geolocation",
    mediaConstraint: null,
  },
  {
    id: "media",
    name: "Photos & Media",
    description: "Access photos, videos, and files to share in chats.",
    icon: "🖼️",
    features: ["Send Images", "Send Videos", "Send Documents"],
    nativeAlias: "media",
    webPermissionName: null,
    platformType: "file",
    mediaConstraint: null,
  },
  {
    id: "contacts",
    name: "Contacts",
    description: "Find friends and share contacts from your address book.",
    icon: "👤",
    features: ["Find Friends", "Share Contact"],
    nativeAlias: "contacts",
    webPermissionName: null,
    platformType: "contacts",
    mediaConstraint: null,
  },
  {
    id: "storage",
    name: "Storage",
    description: "Download and save files, images, and videos to your device.",
    icon: "💾",
    features: ["Download Files", "Save Media"],
    nativeAlias: "storage",
    webPermissionName: "persistent-storage",
    platformType: "storage",
    mediaConstraint: null,
  },
];

// ---- Permission States ----
const PERMISSION_STATES = {
  ALLOWED: "Allowed",
  DENIED: "Denied",
  REVOKED: "Revoked",
  LIMITED: "Limited",
  NOT_AVAILABLE: "Not Available",
  RESTRICTED: "Restricted",
  PROMPT: "Ask First Time",
  UNKNOWN: "Unknown",
};

// ---- Feature-to-Permission Mapping ----
const FEATURE_PERMISSIONS = {
  "Take Photo": ["camera"],
  "Record Video": ["camera", "microphone"],
  "Record Voice Message": ["microphone"],
  "Audio Call": ["microphone"],
  "Video Call": ["camera", "microphone"],
  "Send Images": ["media"],
  "Send Videos": ["media"],
  "Send Documents": ["media", "storage"],
  "Download Files": ["storage"],
  "Share Location": ["location"],
  "Find Nearby Places": ["location"],
  "Find Friends": ["contacts"],
  "Share Contact": ["contacts"],
  "Push Alerts": ["notifications"],
  "Call Notifications": ["notifications", "microphone"],
  "Save Media": ["storage"],
};

// ---- Runtime State ----
const _statusCache = {};
const _revokedPermissions = new Set();
const _mediaStreams = new Set();
const _REVOKED_STORAGE_KEY = 'nsl_revoked_permissions';

// Load persisted revoked permissions from localStorage
(function _loadRevokedPermissions() {
  try {
    const stored = JSON.parse(localStorage.getItem(_REVOKED_STORAGE_KEY) || '[]');
    if (Array.isArray(stored)) stored.forEach(function(id) { _revokedPermissions.add(id); });
  } catch (_) {}
})();

// ---- Internal Helpers ----
function _getPermInfo(id) {
  return PERMISSION_ENTRIES.find((p) => p.id === id) || null;
}

function _isNative() {
  return (
    window.Capacitor?.isNativePlatform?.() === true &&
    window.Capacitor?.getPlatform?.() === "android"
  );
}

function _getNativePlugin() {
  return window.Capacitor?.Plugins?.AppPermissions || null;
}

function _showToast(msg, type) { if (App && App.toast) App.toast(msg, type); else if (typeof showToast === "function") showToast(msg, type || "info"); }

function _stopMediaTracks(stream) {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    _mediaStreams.delete(stream);
  }
}

function _stopAllMediaTracks() {
  _mediaStreams.forEach((s) => {
    try { s.getTracks().forEach((t) => t.stop()); } catch (_) {}
  });
  _mediaStreams.clear();
}

function _getBrowserPermissionName(id) {
  const info = _getPermInfo(id);
  return info?.webPermissionName || null;
}

function _getStateLabel(state) {
  if (!state) return PERMISSION_STATES.UNKNOWN;
  const s = String(state).toLowerCase().trim();
  if (s === "granted" || s === "allowed") return PERMISSION_STATES.ALLOWED;
  if (s === "denied" || s === "blocked") return PERMISSION_STATES.DENIED;
  if (s === "revoked") return PERMISSION_STATES.REVOKED;
  if (s === "limited") return PERMISSION_STATES.LIMITED;
  if (s === "prompt" || s === "ask first time") return PERMISSION_STATES.PROMPT;
  if (s === "restricted") return PERMISSION_STATES.RESTRICTED;
  if (s === "not_available" || s === "not available" || s === "unsupported")
    return PERMISSION_STATES.NOT_AVAILABLE;
  return PERMISSION_STATES.UNKNOWN;
}

function _isAllowed(state) {
  const label = _getStateLabel(state);
  return label === PERMISSION_STATES.ALLOWED || label === PERMISSION_STATES.LIMITED;
}

// ---- Platform Permission Checks ----
async function _checkNative(id) {
  if (!_isNative()) return null;
  const info = _getPermInfo(id);
  if (!info?.nativeAlias) return null;
  const plugin = _getNativePlugin();
  if (!plugin) return null;
  try {
    const result = await plugin.checkPermission({ alias: info.nativeAlias });
    return _getStateLabel(String(result.status || ""));
  } catch (err) {
    console.error("Native permission check failed:", id, err);
    return null;
  }
}

async function _requestNative(id) {
  if (!_isNative()) return null;
  const info = _getPermInfo(id);
  if (!info?.nativeAlias) return null;
  const plugin = _getNativePlugin();
  if (!plugin) return null;
  try {
    const result = await plugin.requestPermission({ alias: info.nativeAlias });
    return _getStateLabel(String(result.status || ""));
  } catch (err) {
    console.error("Native permission request failed:", id, err);
    return PERMISSION_STATES.DENIED;
  }
}

async function _checkWeb(id) {
  const info = _getPermInfo(id);
  if (!info) return PERMISSION_STATES.NOT_AVAILABLE;

  if (id === "notifications") {
    if (typeof Notification === "undefined")
      return PERMISSION_STATES.NOT_AVAILABLE;
    return _getStateLabel(Notification.permission);
  }

  if (id === "contacts") {
    if (!navigator.contacts?.select) return PERMISSION_STATES.NOT_AVAILABLE;
    return PERMISSION_STATES.PROMPT;
  }

  if (id === "media") {
    return PERMISSION_STATES.ALLOWED;
  }

  if (id === "storage") {
    if (navigator.storage?.persist) {
      try {
        const persisted = await navigator.storage.persisted();
        return persisted ? PERMISSION_STATES.ALLOWED : PERMISSION_STATES.PROMPT;
      } catch (_) {}
    }
    return PERMISSION_STATES.PROMPT;
  }

  const permName = _getBrowserPermissionName(id);
  if (!permName) return PERMISSION_STATES.UNKNOWN;

  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({ name: permName });
      return _getStateLabel(result.state);
    }
  } catch (_) {}
  return PERMISSION_STATES.UNKNOWN;
}

async function _requestWeb(id) {
  const info = _getPermInfo(id);
  if (!info) return PERMISSION_STATES.NOT_AVAILABLE;

  try {
    if (id === "camera") {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      _mediaStreams.add(stream);
      _stopMediaTracks(stream);
      return PERMISSION_STATES.ALLOWED;
    }
    if (id === "microphone") {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      _mediaStreams.add(stream);
      _stopMediaTracks(stream);
      return PERMISSION_STATES.ALLOWED;
    }
    if (id === "notifications") {
      if (typeof Notification === "undefined")
        return PERMISSION_STATES.NOT_AVAILABLE;
      const result = await Notification.requestPermission();
      setTimeout(() => {
        try { if (typeof ensureCallNotificationPermission === "function") ensureCallNotificationPermission({ force: true }); } catch (_) {}
        try { if (typeof requestNativeNotificationPermission === "function") requestNativeNotificationPermission(); } catch (_) {}
      }, 100);
      return _getStateLabel(result);
    }
    if (id === "location") {
      if (!navigator.geolocation) return PERMISSION_STATES.NOT_AVAILABLE;
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
        });
      });
      return PERMISSION_STATES.ALLOWED;
    }
    if (id === "media") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,video/*,audio/*,.pdf,.doc,.docx";
      input.style.display = "none";
      const cleanup = () => { setTimeout(() => { if (input.parentNode) input.remove(); }, 100); };
      input.addEventListener("change", cleanup, { once: true });
      document.body.appendChild(input);
      input.click();
      window.addEventListener('focus', cleanup, { once: true, timeout: 3000 });
      return PERMISSION_STATES.ALLOWED;
    }
    if (id === "contacts") {
      if (!navigator.contacts?.select) return PERMISSION_STATES.NOT_AVAILABLE;
      await navigator.contacts.select(["name", "email", "tel"], {
        multiple: false,
      });
      return PERMISSION_STATES.ALLOWED;
    }
    if (id === "storage") {
      if (navigator.storage?.persist) {
        await navigator.storage.persist();
      }
      return PERMISSION_STATES.ALLOWED;
    }
  } catch (err) {
    if (
      err.name === "NotAllowedError" ||
      err.name === "SecurityError" ||
      err.name === "PermissionDeniedError"
    ) {
      return PERMISSION_STATES.DENIED;
    }
    if (
      err.name === "NotFoundError" ||
      err.name === "DevicesNotFoundError"
    ) {
      return PERMISSION_STATES.NOT_AVAILABLE;
    }
    console.error("Web permission request failed:", id, err);
    return PERMISSION_STATES.DENIED;
  }
  return PERMISSION_STATES.UNKNOWN;
}

// ---- PermissionsManager API ----
window.PermissionsManager = {
  async check(id) {
    if (_revokedPermissions.has(id)) return PERMISSION_STATES.REVOKED;
    const info = _getPermInfo(id);
    if (!info) return PERMISSION_STATES.NOT_AVAILABLE;

    let state;
    if (_isNative()) {
      state = await _checkNative(id);
    }
    if (!state) {
      state = await _checkWeb(id);
    }
    if (!state) {
      state = PERMISSION_STATES.UNKNOWN;
    }
    _statusCache[id] = state;
    return state;
  },

  async request(id, { showExplanation = false } = {}) {
    if (showExplanation) {
      const granted = await this.showPreExplanation(id);
      if (!granted) return PERMISSION_STATES.DENIED;
    }

    const info = _getPermInfo(id);
    if (!info) return PERMISSION_STATES.NOT_AVAILABLE;

    let state;
    if (_isNative()) {
      state = await _requestNative(id);
    }
    if (!state) {
      state = await _requestWeb(id);
    }
    if (!state) {
      state = PERMISSION_STATES.DENIED;
    }

    _statusCache[id] = state;
    _revokedPermissions.delete(id);
    try { localStorage.setItem(_REVOKED_STORAGE_KEY, JSON.stringify(Array.from(_revokedPermissions))); } catch (_) {}

    if (_isAllowed(state)) {
      _showToast(
        `${info.name} permission granted`,
        "success"
      );
    } else if (state === PERMISSION_STATES.DENIED) {
      _showToast(
        `${info.name} permission was denied. You can enable it in device settings.`,
        "error"
      );
    }

    this.refreshUI();
    return state;
  },

  revoke(id) {
    const info = _getPermInfo(id);
    if (!info) return;

    _revokedPermissions.add(id);
    try { localStorage.setItem(_REVOKED_STORAGE_KEY, JSON.stringify(Array.from(_revokedPermissions))); } catch (_) {}

    if (id === "camera" || id === "microphone") {
      _stopAllMediaTracks();
    }

    _statusCache[id] = PERMISSION_STATES.REVOKED;
    this.refreshUI();
    _showToast(`${info.name} permission has been revoked. Re-enable from Settings > Permissions.`, "info");
  },

  async ensure(id) {
    const info = _getPermInfo(id);
    if (!info) return false;

    if (_revokedPermissions.has(id)) {
      const reGranted = await this.showReEnablePrompt(id);
      if (!reGranted) return false;
    }

    let state = await this.check(id);

    if (_isAllowed(state)) return true;

    state = await this.request(id, { showExplanation: true });
    return _isAllowed(state);
  },

  async ensureForFeature(featureName) {
    const permIds = FEATURE_PERMISSIONS[featureName];
    if (!permIds || permIds.length === 0) return true;

    for (const id of permIds) {
      const ok = await this.ensure(id);
      if (!ok) {
        _showToast(
          `${featureName} requires ${_getPermInfo(id)?.name || id} access`,
          "error"
        );
        return false;
      }
    }
    return true;
  },

  async openSettings() {
    if (_isNative()) {
      const plugin = _getNativePlugin();
      if (plugin) {
        try {
          await plugin.openSettings();
          return;
        } catch (err) {
          console.error("Error opening native settings:", err);
        }
      }
    }
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      _showToast("Go to Settings > Safari > Camera to enable camera access", "info");
    } else if (/Android/i.test(navigator.userAgent)) {
      _showToast("Go to Settings > Apps > NSL Chat > Permissions > Camera", "info");
    } else {
      _showToast("Please open device settings to manage permissions", "info");
    }
  },

  getInfo(id) {
    return _getPermInfo(id);
  },

  getStatusLabel(state) {
    return _getStateLabel(state);
  },

  getIcon(id) {
    const info = _getPermInfo(id);
    return info?.icon || "🔒";
  },

  getLastStatus(id) {
    return _statusCache[id] || null;
  },

  async refreshUI() {
    const container = document.getElementById("permissionsModalBody");
    if (!container) return;

    for (const perm of PERMISSION_ENTRIES) {
      const state = await this.check(perm.id);
      this._updateCardUI(perm.id, state);
    }
  },

  _updateCardUI(id, state) {
    const card = document.querySelector(`[data-permission-id="${id}"]`);
    if (!card) return;

    const statusEl = card.querySelector(".perm-status-value");
    const btn = card.querySelector(".perm-action-btn");
    const extraBtn = card.querySelector(".perm-extra-btn");

    if (statusEl) {
      statusEl.textContent = state || PERMISSION_STATES.UNKNOWN;
      statusEl.className = "perm-status-value " + (state || "").toLowerCase().replace(/\s+/g, "-");
    }

    if (btn) {
      if (state === PERMISSION_STATES.ALLOWED || state === PERMISSION_STATES.LIMITED) {
        btn.textContent = "Revoke";
        btn.className = "btn btn-sm btn-outline-danger perm-action-btn";
        btn.dataset.action = "revoke";
      } else if (
        state === PERMISSION_STATES.DENIED ||
        state === PERMISSION_STATES.RESTRICTED
      ) {
        btn.textContent = "Open Settings";
        btn.className = "btn btn-sm btn-outline perm-action-btn";
        btn.dataset.action = "open-settings";
      } else if (state === PERMISSION_STATES.REVOKED) {
        btn.textContent = "Grant Again";
        btn.className = "btn btn-sm btn-primary perm-action-btn";
        btn.dataset.action = "request";
      } else if (state === PERMISSION_STATES.NOT_AVAILABLE) {
        btn.textContent = "Unavailable";
        btn.className = "btn btn-sm btn-outline perm-action-btn";
        btn.disabled = true;
      } else {
        btn.textContent = "Grant";
        btn.className = "btn btn-sm btn-primary perm-action-btn";
        btn.dataset.action = "request";
      }
      btn.disabled = state === PERMISSION_STATES.NOT_AVAILABLE;
    }

    if (extraBtn) {
      if (
        state === PERMISSION_STATES.DENIED ||
        state === PERMISSION_STATES.RESTRICTED ||
        state === PERMISSION_STATES.REVOKED
      ) {
        extraBtn.style.display = "block";
      } else {
        extraBtn.style.display = "none";
      }
    }
  },

  async showScreen() {
    const modal = document.getElementById("permissionsModal");
    if (!modal) return;
    modal.style.display = "flex";
    await this.refreshUI();
  },

  async showPreExplanation(id) {
    return new Promise((resolve) => {
      const modal = document.getElementById("prePermissionModal");
      const info = _getPermInfo(id);
      if (!modal || !info) {
        resolve(true);
        return;
      }

      document.getElementById("prePermissionIcon").textContent = info.icon;
      document.getElementById("prePermissionTitle").textContent =
        `${info.name} Access Required`;
      document.getElementById("prePermissionDescription").textContent =
        info.description;

      const featuresContainer = document.getElementById(
        "prePermissionFeatures"
      );
      if (featuresContainer) {
        featuresContainer.innerHTML = info.features
          .map((f) => `<span class="perm-feature-tag">${f}</span>`)
          .join("");
      }

      modal._permissionResolve = resolve;
      modal.style.display = "flex";
    });
  },

  async showReEnablePrompt(id) {
    return new Promise((resolve) => {
      const modal = document.getElementById("reEnablePermissionModal");
      const info = _getPermInfo(id);
      if (!modal || !info) {
        resolve(false);
        return;
      }

      document.getElementById("reEnableTitle").textContent =
        `${info.name} Access Required`;
      document.getElementById("reEnableDescription").textContent =
        `This feature requires ${info.name.toLowerCase()} access. Please grant permission to continue.`;
      document.getElementById("reEnableIcon").textContent = info.icon;
      document.getElementById("reEnableFeatures").innerHTML = info.features
        .map((f) => `<span class="perm-feature-tag">${f}</span>`)
        .join("");

      modal._permissionKind = id;
      modal._permissionResolve = resolve;
      modal.style.display = "flex";
    });
  },

  hideModals() {
    ["prePermissionModal", "reEnablePermissionModal", "permissionsModal"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
      }
    );
  },

  async _ensureNativeBackward(id) {
    if (!_isNative()) return true;
    const state = await this.check(id);
    if (_isAllowed(state)) return true;

    const newState = await this.request(id, { showExplanation: false });
    if (_isAllowed(newState)) return true;

    _showToast(
      `Please allow ${id} permission in your device settings.`,
      "error"
    );
    const revokeModal = document.getElementById("revokePermissionsGuideModal");
    if (revokeModal) {
      const title = revokeModal.querySelector(".modal-header h3");
      if (title) title.textContent = `Enable ${id} permission`;
      revokeModal.style.display = "flex";
    }
    return false;
  },
}; // end PermissionsManager

// ---- UI Rendering ----
function _renderPermissionsScreen() {
  const container = document.getElementById("permissionsModalBody");
  if (!container) return;

  container.innerHTML =
    '<p class="perm-info-text">Manage permissions for app features. Revoked permissions can be re-enabled anytime.</p>' +
    PERMISSION_ENTRIES.map((perm) => {
      const state = _statusCache[perm.id] || PERMISSION_STATES.UNKNOWN;
      const stateClass = String(state).toLowerCase().replace(/\s+/g, "-");
      return `
    <div class="permission-card" data-permission-id="${perm.id}">
      <div class="perm-icon">${perm.icon}</div>
      <div class="perm-body">
        <div class="perm-header">
          <strong class="perm-name">${perm.name}</strong>
          <span class="perm-status-badge ${stateClass}">${state}</span>
        </div>
        <p class="perm-desc">${perm.description}</p>
        <div class="perm-features">
          ${perm.features.map((f) => `<span class="perm-feature-tag">${f}</span>`).join("")}
        </div>
        <div class="perm-actions">
          <button class="btn btn-sm btn-primary perm-action-btn" data-perm-id="${perm.id}" data-action="request">Grant</button>
          <button class="btn btn-sm btn-outline perm-extra-btn" data-perm-id="${perm.id}" data-action="open-settings" style="display:none">Open Settings</button>
        </div>
      </div>
    </div>`;
    }).join("") +
    '<hr class="perm-divider">' +
    '<button id="permRevokeGuideBtn" class="setting-item danger" style="margin:0;border-radius:8px;">📖 How to Manage Permissions</button>';

  PermissionsManager.refreshUI();
}

function _setupPermissionEventHandlers() {
  // Permissions modal events
  document.getElementById("permissionsModal")?.addEventListener("click", (e) => {
    const card = e.target.closest(".permission-card");
    if (!card) {
      if (e.target === e.currentTarget) {
        PermissionsManager.hideModals();
      }
      return;
    }

    const btn = e.target.closest(".perm-action-btn, .perm-extra-btn");
    if (!btn) return;

    const permId = btn.dataset.permId;
    const action = btn.dataset.action;

    if (action === "request") {
      PermissionsManager.request(permId, { showExplanation: true });
    } else if (action === "revoke") {
      PermissionsManager.revoke(permId);
    } else if (action === "open-settings") {
      PermissionsManager.openSettings();
    }
  });

  // Close buttons
  document.querySelectorAll(".closePermissionsModal").forEach((btn) =>
    btn.addEventListener("click", () => PermissionsManager.hideModals())
  );

  // Pre-permission modal
  document.getElementById("prePermissionAllow")?.addEventListener("click", () => {
    const modal = document.getElementById("prePermissionModal");
    const resolve = modal._permissionResolve;
    modal.style.display = "none";
    if (resolve) resolve(true);
  });

  document.getElementById("prePermissionNotNow")?.addEventListener("click", () => {
    const modal = document.getElementById("prePermissionModal");
    const resolve = modal._permissionResolve;
    modal.style.display = "none";
    if (resolve) resolve(false);
  });

  // Re-enable modal
  document.getElementById("reEnableGrant")?.addEventListener("click", async () => {
    const modal = document.getElementById("reEnablePermissionModal");
    const kind = modal._permissionKind;
    const resolve = modal._permissionResolve;
    modal.style.display = "none";
    if (resolve) {
      const state = await PermissionsManager.request(kind, { showExplanation: true });
      resolve(PermissionsManager.getStatusLabel(state) === PERMISSION_STATES.ALLOWED);
    }
  });

  document.getElementById("reEnableSettings")?.addEventListener("click", () => {
    PermissionsManager.openSettings();
    const modal = document.getElementById("reEnablePermissionModal");
    const resolve = modal._permissionResolve;
    modal.style.display = "none";
    if (resolve) resolve(false);
  });

  document.getElementById("reEnableCancel")?.addEventListener("click", () => {
    const modal = document.getElementById("reEnablePermissionModal");
    const resolve = modal._permissionResolve;
    modal.style.display = "none";
    if (resolve) resolve(false);
  });

  document.querySelectorAll(".reEnableClose").forEach((btn) =>
    btn.addEventListener("click", () => {
      const modal = document.getElementById("reEnablePermissionModal");
      const resolve = modal._permissionResolve;
      modal.style.display = "none";
      if (resolve) resolve(false);
    })
  );

  // Revoke guide modal
  document.getElementById("permRevokeGuideBtn")?.addEventListener("click", () => {
    const modal = document.getElementById("revokePermissionsGuideModal");
    if (modal) modal.style.display = "flex";
  });

  document.querySelectorAll(".closeRevokePermissionsModal").forEach((btn) =>
    btn.addEventListener("click", () => {
      document.getElementById("revokePermissionsGuideModal").style.display = "none";
    })
  );

  document.getElementById("nativeSettingsBtn")?.addEventListener("click", () => {
    PermissionsManager.openSettings();
    document.getElementById("revokePermissionsGuideModal").style.display = "none";
  });

  // App Permissions button in profile
  document.getElementById("appPermissionsBtn")?.addEventListener("click", () => {
    PermissionsManager.showScreen().catch(() =>
      _showToast("Could not open permissions", "error")
    );
  });

  // Close modals on backdrop click
  ["prePermissionModal", "reEnablePermissionModal", "revokePermissionsGuideModal"].forEach(
    (modalId) => {
      document.getElementById(modalId)?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) {
          const modal = document.getElementById(modalId);
          const resolve = modal._permissionResolve;
          modal.style.display = "none";
          if (resolve) resolve(false);
        }
      });
    }
  );
}

// ---- Initialize ----
function initPermissionsManager() {
  _renderPermissionsScreen();
  _setupPermissionEventHandlers();
}

// Run when DOM is ready (scripts are at bottom of body, so DOM is ready)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPermissionsManager);
} else {
  initPermissionsManager();
}

// ---- Backward-Compatible Wrappers ----
// These maintain compatibility with existing code that references old function names.

async function ensureNativePermission(kind) {
  return PermissionsManager._ensureNativeBackward(kind);
}

async function requestNativePermissionState(alias) {
  if (!_isNative()) return null;
  const state = await PermissionsManager.request(alias, { showExplanation: false });
  return String(state).toLowerCase();
}

async function queryNativePermissionState(alias) {
  if (!_isNative()) return null;
  return PermissionsManager.check(alias);
}

async function refreshPermissionsModal() {
  return PermissionsManager.refreshUI();
}

async function requestAppPermission(kind) {
  return PermissionsManager.request(kind, { showExplanation: true });
}

async function showPermissionsModal() {
  return PermissionsManager.showScreen();
}

function showPermissionRevokeGuide(kind) {
  if (kind) {
    PermissionsManager.showReEnablePrompt(kind);
  } else {
    const modal = document.getElementById("revokePermissionsGuideModal");
    if (modal) {
      const title = modal.querySelector(".modal-header h3");
      if (title) title.textContent = "How to Manage Permissions";
      modal.style.display = "flex";
      const btn = document.getElementById("nativeSettingsBtn");
      if (btn) {
        btn.style.display = _isNative() ? "block" : "none";
      }
    }
  }
}

async function openNativeAppSettings() {
  return PermissionsManager.openSettings();
}

function normalizePermissionState(state) {
  return _getStateLabel(state);
}

function isPermissionAllowedStatus(status) {
  return _isAllowed(status);
}

function getPermissionButtonLabel(kind, status) {
  const state = _getStateLabel(status);
  if (state === PERMISSION_STATES.ALLOWED || state === PERMISSION_STATES.LIMITED) {
    return "Revoke / Change";
  }
  return "Grant Permission";
}

function stopPermissionProbe(stream) {
  _stopMediaTracks(stream);
}

function openMediaPermissionPicker() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt";
  input.style.display = "none";
  input.addEventListener("change", () => input.remove(), { once: true });
  document.body.appendChild(input);
  input.click();
}

async function queryPermissionState(name) {
  const mapping = {
    camera: "camera",
    microphone: "microphone",
    notifications: "notifications",
    geolocation: "location",
  };
  const id = mapping[name] || name;
  const state = await PermissionsManager.check(id);
  return state || "Ask when needed";
}
