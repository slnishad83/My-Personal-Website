// ============================================================
// FIREBASE CONFIGURATION - TEAM CHAT 2026
// Centralized Firebase setup for all services
// Auto-detects environment and loads appropriate config
// ============================================================

// Firebase configuration for Team Chat project
const firebaseConfig = {
  apiKey: "AIzaSyCdbut_FdscAjl-OVSlAUhb7TOTiRNkh34",
  authDomain: "my-team-chat-2255.firebaseapp.com",
  projectId: "my-team-chat-2255",
  storageBucket: "my-team-chat-2255.firebasestorage.app",
  messagingSenderId: "805016891521",
  appId: "1:805016891521:web:ac9bc7a252bcf33686dd80",
  measurementId: "G-XXXXXXXXXX" // Add if using Analytics
};

// ============================================================
// FIREBASE INITIALIZATION
// ============================================================

class FirebaseManager {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.storage = null;
    this.functions = null;
    this.messaging = null;
    this.analytics = null;
    this.realtimeDb = null;
    this.initialized = false;
  }

  /**
   * Initialize Firebase and all services
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      console.log("✅ Firebase already initialized");
      return;
    }

    try {
      // Initialize Firebase App
      this.app = firebase.initializeApp(firebaseConfig);
      console.log("✅ Firebase App initialized");

      // Initialize Authentication
      this.auth = firebase.auth(this.app);
      this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      console.log("✅ Firebase Auth initialized");

      // Initialize Firestore
      this.db = firebase.firestore(this.app);
      this.db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
        experimentalForceLongPolling: false
      });
      console.log("✅ Firestore initialized");

      // Initialize Storage
      this.storage = firebase.storage(this.app);
      console.log("✅ Firebase Storage initialized");

      // Initialize Cloud Functions
      this.functions = firebase.functions(this.app);
      
      // Use emulator in development if available
      if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        // Uncomment to use emulator
        // this.functions.useEmulator("localhost", 5001);
      }
      console.log("✅ Cloud Functions initialized");

      // Initialize Cloud Messaging
      try {
        this.messaging = firebase.messaging(this.app);
        console.log("✅ Cloud Messaging initialized");
      } catch (e) {
        console.warn("⚠️ Cloud Messaging not available:", e.message);
      }

      // Initialize Realtime Database
      try {
        this.realtimeDb = firebase.database(this.app);
        console.log("✅ Realtime Database initialized");
      } catch (e) {
        console.warn("⚠️ Realtime Database not available:", e.message);
      }

      // Initialize Analytics (optional)
      try {
        this.analytics = firebase.analytics(this.app);
        console.log("✅ Firebase Analytics initialized");
      } catch (e) {
        console.warn("⚠️ Analytics not available:", e.message);
      }

      this.initialized = true;
      console.log("🎉 Firebase fully initialized and ready!");

      // Emit custom event for app to listen to
      window.dispatchEvent(new CustomEvent('firebaseReady'));

    } catch (error) {
      console.error("❌ Firebase initialization failed:", error);
      throw error;
    }
  }

  /**
   * Get Firebase services object
   * @returns {Object} All Firebase services
   */
  getServices() {
    if (!this.initialized) {
      throw new Error("Firebase not initialized. Call init() first.");
    }

    return {
      app: this.app,
      auth: this.auth,
      db: this.db,
      storage: this.storage,
      functions: this.functions,
      messaging: this.messaging,
      realtimeDb: this.realtimeDb,
      analytics: this.analytics
    };
  }

  /**
   * Check if Firebase is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get current Firebase user
   * @returns {Promise<User|null>}
   */
  getCurrentUser() {
    return new Promise((resolve) => {
      this.auth.onAuthStateChanged((user) => {
        resolve(user);
      });
    });
  }

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async signOut() {
    try {
      await this.auth.signOut();
      console.log("✅ User signed out");
    } catch (error) {
      console.error("❌ Sign out failed:", error);
      throw error;
    }
  }

  /**
   * Delete user account
   * @returns {Promise<void>}
   */
  async deleteAccount() {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        throw new Error("No user logged in");
      }
      await user.delete();
      console.log("✅ User account deleted");
    } catch (error) {
      console.error("❌ Account deletion failed:", error);
      throw error;
    }
  }

  /**
   * Send password reset email
   * @param {string} email
   * @returns {Promise<void>}
   */
  async sendPasswordResetEmail(email) {
    try {
      await this.auth.sendPasswordResetEmail(email);
      console.log("✅ Password reset email sent");
    } catch (error) {
      console.error("❌ Password reset failed:", error);
      throw error;
    }
  }

  /**
   * Create callable Cloud Function wrapper
   * @param {string} functionName
   * @returns {Function}
   */
  getCallableFunction(functionName) {
    return this.functions.httpsCallable(functionName);
  }

  /**
   * Subscribe to Cloud Messaging
   * @returns {Promise<string>} FCM Token
   */
  async subscribeToMessaging() {
    if (!this.messaging) {
      throw new Error("Cloud Messaging not available");
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("⚠️ Notification permission denied");
        return null;
      }

      const token = await this.messaging.getToken({
        vapidKey: "BOu6eYU6fLRQO_4CqUGgvE3tXZoQh4Z5cKaXO6nI_Pn1E8nkgVZ2oqKpWqR5rP0l8G5mK7v8fL1M2v3W4x5Y6z"
      });

      console.log("✅ FCM Token obtained:", token);
      return token;

    } catch (error) {
      console.error("❌ Cloud Messaging subscription failed:", error);
      return null;
    }
  }

  /**
   * Setup message listener
   * @param {Function} callback
   */
  onMessage(callback) {
    if (!this.messaging) {
      console.warn("⚠️ Cloud Messaging not available");
      return;
    }

    this.messaging.onMessage((payload) => {
      console.log("📬 Message received:", payload);
      callback(payload);
    });
  }

  /**
   * Setup background message listener (Service Worker)
   * @param {Function} callback
   */
  onBackgroundMessage(callback) {
    if (!this.messaging) {
      console.warn("⚠️ Cloud Messaging not available");
      return;
    }

    this.messaging.onBackgroundMessage((payload) => {
      console.log("📬 Background message received:", payload);
      callback(payload);
    });
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  /**
   * Get user's auth token
   * @returns {Promise<string>}
   */
  async getAuthToken() {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }
    return user.getIdToken();
  }

  /**
   * Get user's auth token with refresh
   * @returns {Promise<string>}
   */
  async getAuthTokenRefreshed() {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }
    return user.getIdToken(true);
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

// Create singleton instance
const firebaseManager = new FirebaseManager();

// Auto-initialize when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    firebaseManager.init().catch(error => {
      console.error("Failed to initialize Firebase:", error);
    });
  });
} else {
  firebaseManager.init().catch(error => {
    console.error("Failed to initialize Firebase:", error);
  });
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = firebaseManager;
}

// Make available globally
window.firebaseManager = firebaseManager;

// ============================================================
// HELPER EXPORTS
// ============================================================

/**
 * Get Firebase services (shorthand)
 * @returns {Object}
 */
function getFirebase() {
  return firebaseManager.getServices();
}

/**
 * Get current Firebase user (shorthand)
 * @returns {Promise<User|null>}
 */
function getCurrentFirebaseUser() {
  return firebaseManager.getCurrentUser();
}

/**
 * Check if Firebase is ready
 * @returns {boolean}
 */
function isFirebaseReady() {
  return firebaseManager.isInitialized();
}

// Make helpers globally available
window.getFirebase = getFirebase;
window.getCurrentFirebaseUser = getCurrentFirebaseUser;
window.isFirebaseReady = isFirebaseReady;

console.log("✅ Firebase Config Module Loaded");
