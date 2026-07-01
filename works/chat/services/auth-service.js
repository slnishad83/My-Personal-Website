// ============================================================
// AUTHENTICATION SERVICE - TEAM CHAT 2026
// Handles user authentication with Firebase Auth
// ============================================================

class AuthService {
  constructor() {
    this.user = null;
    this.authStateCallback = null;
    this.init();
  }

  /**
   * Initialize authentication service
   */
  async init() {
    // Wait for Firebase to be ready
    await new Promise(resolve => {
      if (window.isFirebaseReady && window.isFirebaseReady()) {
        resolve();
      } else {
        window.addEventListener('firebaseReady', resolve);
      }
    });

    const firebase = window.getFirebase();
    
    // Listen for auth state changes
    firebase.auth.onAuthStateChanged((user) => {
      this.user = user;
      this.onAuthStateChanged(user);
    });

    console.log('✅ Authentication Service initialized');
  }

  /**
   * Handle auth state change
   */
  onAuthStateChanged(user) {
    if (user) {
      console.log('✅ User logged in:', user.email);
      if (this.authStateCallback) {
        this.authStateCallback(user);
      }
      // Emit custom event
      window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: user }));
    } else {
      console.log('❌ User logged out');
      if (this.authStateCallback) {
        this.authStateCallback(null);
      }
      // Emit custom event
      window.dispatchEvent(new CustomEvent('userLoggedOut'));
    }
  }

  /**
   * Register with email and password
   */
  async register(email, password, displayName) {
    try {
      const firebase = window.getFirebase();
      
      // Create user account
      const result = await firebase.auth.createUserWithEmailAndPassword(email, password);
      const user = result.user;

      // Update display name
      await user.updateProfile({
        displayName: displayName
      });

      // Create user document in Firestore
      await firebase.db.collection('users').doc(user.uid).set({
        uid: user.uid,
        email: email,
        displayName: displayName,
        createdAt: new Date(),
        status: 'online',
        photoURL: null,
        theme: 'auto'
      });

      console.log('✅ User registered:', email);
      return user;

    } catch (error) {
      console.error('❌ Registration failed:', error.message);
      throw error;
    }
  }

  /**
   * Login with email and password
   */
  async login(email, password) {
    try {
      const firebase = window.getFirebase();
      const result = await firebase.auth.signInWithEmailAndPassword(email, password);
      console.log('✅ User logged in:', email);
      return result.user;
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      throw error;
    }
  }

  /**
   * Login with Google
   */
  async loginWithGoogle() {
    try {
      const firebase = window.getFirebase();
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await firebase.auth.signInWithPopup(provider);
      console.log('✅ Google login successful:', result.user.email);
      return result.user;
    } catch (error) {
      console.error('❌ Google login failed:', error.message);
      throw error;
    }
  }

  /**
   * Logout
   */
  async logout() {
    try {
      const firebase = window.getFirebase();
      await firebase.auth.signOut();
      console.log('✅ User logged out');
    } catch (error) {
      console.error('❌ Logout failed:', error.message);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email) {
    try {
      const firebase = window.getFirebase();
      await firebase.auth.sendPasswordResetEmail(email);
      console.log('✅ Password reset email sent:', email);
    } catch (error) {
      console.error('❌ Password reset failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.user !== null;
  }

  /**
   * Update user profile
   */
  async updateProfile(updates) {
    try {
      const firebase = window.getFirebase();
      const user = firebase.auth.currentUser;

      if (updates.displayName || updates.photoURL) {
        await user.updateProfile({
          displayName: updates.displayName || user.displayName,
          photoURL: updates.photoURL || user.photoURL
        });
      }

      // Update Firestore
      await firebase.db.collection('users').doc(user.uid).update(updates);

      console.log('✅ Profile updated');
    } catch (error) {
      console.error('❌ Profile update failed:', error.message);
      throw error;
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback) {
    this.authStateCallback = callback;
  }
}

// Create singleton instance
const authService = new AuthService();

// Export globally
window.authService = authService;

console.log('✅ Auth Service Module Loaded');