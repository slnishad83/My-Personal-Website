/**
 * NSL Chat â€” Vite Entry Point (login.html)
 * Login page: Firebase auth + PWA install + redesign-base.
 * CDN scripts (firebase-app, firebase-auth, firebase-firestore) load before this module.
 */

import './firebase-config.js';
import './pwa-install.js';
import './redesign-base.js';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   FIREBASE INIT (uses global firebase from CDN compat scripts)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const firebaseConfig = window.FIREBASE_CONFIG;
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let lastUnverifiedEmail = "";

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   AUTH PERSISTENCE
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function isLikelyPrivateSession() {
  try {
    const testKey = "teamChatStorageProbe";
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return false;
  } catch (error) {
    return true;
  }
}

function getAuthPersistence() {
  return isLikelyPrivateSession()
    ? firebase.auth.Auth.Persistence.SESSION
    : firebase.auth.Auth.Persistence.LOCAL;
}

const authPersistenceReady = Promise.race([
  auth.setPersistence(getAuthPersistence()),
  new Promise((resolve) => setTimeout(resolve, 1000)),
]).catch(function (error) {
  if (window.__DEBUG__) console.error("Persistence error:", error);
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HELPERS
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function cleanEmail(email) {
  return email.trim().toLowerCase();
}

function setButtonLoading(btn, isLoading, label, loadingLabel) {
  if (isLoading) {
    if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-lg mr-2">sync</span> ${loadingLabel}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalHtml || label;
    delete btn.dataset.originalHtml;
  }
}

function getEmailVerificationSettings() {
  return {
    url: new URL("verify.html", window.location.href).href,
    handleCodeInApp: false,
  };
}

async function sendVerificationEmail(user) {
  await user.sendEmailVerification(getEmailVerificationSettings());
}

async function prepareFreshAppLaunch() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        try {
          const swUrl = new URL(reg.scope);
          if (swUrl.pathname.includes('/works/chat/') || swUrl.pathname.includes('/dist/')) {
            await reg.unregister();
          }
        } catch (_) { await reg.unregister().catch(() => {}); }
      }
    }
  } catch (_) {}
}

function getFriendlyAuthError(error, fallback) {
  const code = error && error.code;
  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  ) {
    return "Incorrect email or password. Please check and try again.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Please wait a few minutes, then try again.";
  }
  if (code === "auth/network-request-failed") {
    return "Network problem. Check your internet connection and try again.";
  }
  if (code === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }
  if (code === "auth/email-already-in-use") {
    return "This email is already registered. Login or use a different email.";
  }
  if (code === "auth/weak-password") {
    return "Password is too weak. Use at least 6 characters.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "Sign-in cancelled.";
  }
  if (code === "auth/popup-blocked") {
    return "Popup was blocked. Please allow popups for this site.";
  }
  if (code === "auth/operation-not-allowed") {
    return "This sign-in method is not enabled. Contact support.";
  }
  if (
    code === "auth/unauthorized-continue-uri" ||
    code === "auth/invalid-continue-uri"
  ) {
    return "Verification link setup needs Firebase authorized domain access. A standard verification email can still be sent.";
  }
  return fallback || "Something went wrong. Please try again.";
}

function validateEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

function validatePhone(phone) {
  const normalized = phone.trim().replace(/[\s().-]/g, "");
  return /^\+?[1-9]\d{6,14}$/.test(normalized);
}

function validatePassword(password) {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) return false;
  return true;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   AUTH STATE LISTENER
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

auth.onAuthStateChanged(async (user) => {
  await authPersistenceReady.catch(() => {});
  if (!user) return;
  await Promise.race([
    user.reload(),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]).catch(() => {});
  if (user.emailVerified) {
    await db.collection("users").doc(user.uid).update({
      emailVerified: true,
      pendingVerification: false,
      onlineStatus: "online",
      lastSeen: new Date(),
    }).catch(async (err) => {
      if (err.code === 'not-found') {
        await db.collection("users").doc(user.uid).set({
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || user.email || "User",
          avatar: user.photoURL || "",
          emailVerified: true,
          pendingVerification: false,
          isActive: true,
          onlineStatus: "online",
          lastSeen: new Date(),
        });
      }
    });
    try { sessionStorage.setItem('nslLoginTransition', '1'); } catch (_) {}
    await prepareFreshAppLaunch();
    const nextUrl = new URL("index.html", window.location.href);
    nextUrl.searchParams.set("fresh", Date.now().toString(36));
    window.location.replace(nextUrl.href);
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   FORM VALIDATION
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function clearValidationErrors() {
  document.querySelectorAll('.field-error').forEach(el => {
    el.classList.remove('show');
    el.textContent = '';
  });
  document.querySelectorAll('.form-group input').forEach(el => {
    el.classList.remove('error');
  });
}

function showValidationError(fieldId, message) {
  const errorDiv = document.getElementById(fieldId);
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    const input = errorDiv.closest('.form-group')?.querySelector('input');
    if (input) input.classList.add('error');
  }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TAB SWITCHING
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((t) => {
      t.classList.remove("active");
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add("active");
    tab.setAttribute('aria-selected', 'true');
    document.querySelectorAll(".auth-form").forEach((form) => form.classList.remove("active"));
    document.getElementById("authError").style.display = "none";
    document.getElementById("authSuccess").style.display = "none";
    document.getElementById(`${tab.dataset.tab}Form`).classList.add("active");
  });
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PASSWORD TOGGLE
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

document.querySelectorAll("[data-password-toggle]").forEach((toggleBtn) => {
  toggleBtn.addEventListener("click", () => {
    const input = document.getElementById(toggleBtn.dataset.passwordToggle);
    if (!input) return;

    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    toggleBtn.innerHTML = isHidden
      ? '<span class="material-symbols-outlined text-lg">visibility_off</span>'
      : '<span class="material-symbols-outlined text-lg">visibility</span>';
    toggleBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    toggleBtn.title = isHidden ? "Hide password" : "Show password";
  });
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TRUST WORKSTATION â€” Wire checkbox to auth persistence
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

document.getElementById("persist").addEventListener("change", async (e) => {
  if (e.target.checked) {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
  } else {
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   GOOGLE AUTH â€” Platform-aware (native vs web)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function signInWithGoogle() {
  const errorDiv = document.getElementById("authError");
  const btn = document.getElementById("googleAuthBtn");
  errorDiv.style.display = "none";

  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    setButtonLoading(btn, true, "Continue with Google", "Opening Google...");
    try {
      const result = await Capacitor.Plugins.GoogleAuth.signIn();
      const credential = firebase.auth.GoogleAuthProvider.credential(result.authentication.idToken);
      await authPersistenceReady;
      await auth.signInWithCredential(credential);
    } catch (err) {
      errorDiv.textContent = getFriendlyAuthError(err, "Google sign-in failed. Please try again.");
      errorDiv.style.display = "block";
      setButtonLoading(btn, false, "Continue with Google", "Opening Google...");
    }
  } else {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    provider.setCustomParameters({ prompt: "select_account" });
    setButtonLoading(btn, true, "Continue with Google", "Opening Google...");
    try {
      await authPersistenceReady;
      await auth.signInWithPopup(provider);
    } catch (err) {
      if (err.code === "auth/account-exists-with-different-credential") {
        const _pendingCred = err.credential;
        const email = err.email;
        try {
          const methods = await auth.fetchSignInMethodsForEmail(email);
          if (methods.includes("password")) {
            errorDiv.textContent = "An account exists with this email using email/password. Sign in with email/password, then link Google from Settings.";
          } else {
            errorDiv.textContent = getFriendlyAuthError(err, "Google sign-in failed. Please try again.");
          }
        } catch (_) {
          errorDiv.textContent = getFriendlyAuthError(err, "Google sign-in failed. Please try again.");
        }
        errorDiv.style.display = "block";
        setButtonLoading(btn, false, "Continue with Google", "Opening Google...");
      } else if (err.code === "auth/popup-blocked") {
        if (typeof showToast === "function") showToast("Popup blocked. Redirecting to Google...", "info");
        setTimeout(() => { setButtonLoading(btn, false, "Continue with Google", "Opening Google..."); }, 3000);
        return auth.signInWithRedirect(provider);
      } else {
        errorDiv.textContent = getFriendlyAuthError(err, "Google sign-in failed. Please try again.");
        errorDiv.style.display = "block";
        setButtonLoading(btn, false, "Continue with Google", "Opening Google...");
      }
    }
  }
}

document.getElementById("googleAuthBtn").addEventListener("click", () => signInWithGoogle());

auth.getRedirectResult().catch(() => {
  var googleBtn = document.getElementById("googleAuthBtn");
  if (googleBtn) setButtonLoading(googleBtn, false, "Continue with Google", "Opening Google...");
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   LOGIN FORM
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = cleanEmail(document.getElementById("loginEmail").value);
  const password = document.getElementById("loginPassword").value;
  const errorDiv = document.getElementById("authError");
  const successDiv = document.getElementById("authSuccess");
  const resendBtn = document.getElementById("resendVerificationBtn");
  const btn = e.target.querySelector("button[type='submit']");

  errorDiv.style.display = "none";
  successDiv.style.display = "none";
  resendBtn.style.display = "none";
  setButtonLoading(btn, true, "Initialize Access", "Logging in...");

  try {
    await authPersistenceReady;
    const userCred = await auth.signInWithEmailAndPassword(email, password);
    await Promise.race([
      userCred.user.reload(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("reload timed out")), 5000),
      ),
    ]).catch(function (err) {
      if (window.__DEBUG__) console.warn("user.reload failed during login:", err);
    });
    if (!userCred.user.emailVerified) {
      lastUnverifiedEmail = email;
      await auth.signOut();
      errorDiv.textContent = "Please verify your email first. Check your inbox, then login again.";
      errorDiv.style.display = "block";
      resendBtn.style.display = "block";
      setButtonLoading(btn, false, "Initialize Access", "Logging in...");
      return;
    }

    // Check for Two-Step Verification
    try {
      const userDoc = await db.collection("users").doc(userCred.user.uid).get();
      const userData = userDoc.data() || {};
      if (userData.twofaEnabled && userData.twofaPinHash && userData.twofaPinSalt) {
        const twofaVerified = await new Promise((resolve) => {
          const twofaOverlay = document.createElement('div');
          twofaOverlay.id = 'twofa-login-overlay';
          twofaOverlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

          const panel = document.createElement('div');
          panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:24px;padding:32px;max-width:340px;width:90vw;text-align:center;color:var(--on-surface)';

          panel.innerHTML = `
            <div style="width:64px;height:64px;border-radius:50%;background:rgba(0,191,165,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
              <span class="material-symbols-outlined" style="font-size:32px;color:var(--primary)">security</span>
            </div>
            <h3 style="margin:0 0 4px;font-size:18px;font-weight:700">Two-Step Verification</h3>
            <p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 20px">Enter your 2FA PIN to continue</p>
            <input type="password" inputmode="numeric" id="twofa-login-pin" placeholder="Enter PIN" maxlength="8"
              style="width:100%;padding:14px;border-radius:12px;border:2px solid var(--outline-variant,rgba(0,0,0,0.1));background:var(--surface-container-low,rgba(0,0,0,0.05));color:var(--on-surface);font-size:24px;text-align:center;letter-spacing:8px;margin-bottom:8px;outline:none;box-sizing:border-box">
            <p id="twofa-login-error" style="color:var(--error);font-size:12px;margin:0 0 16px;display:none">Incorrect PIN</p>
            <div style="display:flex;flex-direction:column;gap:8px">
              <button id="twofa-login-verify" style="padding:14px;border-radius:14px;border:none;background:var(--primary);color:var(--on-primary);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
                <span class="material-symbols-outlined" style="font-size:20px">verified_user</span> Verify
              </button>
              <button id="twofa-login-cancel" style="padding:10px;border-radius:10px;border:none;background:transparent;color:var(--on-surface-variant);font-size:13px;cursor:pointer">Cancel</button>
            </div>`;

          twofaOverlay.appendChild(panel);
          document.body.appendChild(twofaOverlay);

          const pinInput = document.getElementById('twofa-login-pin');
          const verifyBtn = document.getElementById('twofa-login-verify');
          const errorEl = document.getElementById('twofa-login-error');
          pinInput?.focus();

          const handleVerify = async () => {
            const val = pinInput?.value?.trim();
            if (!val) return;
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:20px">progress_activity</span> Verifying...';
            try {
              const fn = firebase.functions().httpsCallable('verifyTwoFactorPin');
              await fn({ pin: val });
              twofaOverlay.remove();
              resolve(true);
            } catch (e) {
              errorEl.style.display = 'block';
              errorEl.textContent = 'Incorrect PIN';
              pinInput.value = '';
              pinInput.style.borderColor = 'var(--error)';
              setTimeout(() => { pinInput.style.borderColor = 'var(--outline-variant,rgba(0,0,0,0.1))'; }, 1000);
              verifyBtn.disabled = false;
              verifyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">verified_user</span> Verify';
            }
          };

          verifyBtn?.addEventListener('click', handleVerify);
          pinInput?.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') handleVerify();
          });
          document.getElementById('twofa-login-cancel')?.addEventListener('click', () => {
            twofaOverlay.remove();
            auth.signOut();
            resolve(false);
          });
          twofaOverlay.addEventListener('click', (ev) => {
            if (ev.target === twofaOverlay) { twofaOverlay.remove(); auth.signOut(); resolve(false); }
          });
        });

        if (!twofaVerified) {
          setButtonLoading(btn, false, "Initialize Access", "Logging in...");
          return;
        }
      }
    } catch (twofaErr) {
      if (window.__DEBUG__) console.error("2FA verification failed:", twofaErr);
      try { await auth.signOut(); } catch (_) {}
      setButtonLoading(btn, false, "Initialize Access", "Logging in...");
      if (typeof showToast === 'function') showToast("Two-factor verification failed. Please check your connection and try again.", 'error');
      return;
    }

    try {
      const userRef = db.collection("users").doc(userCred.user.uid);
      const userDoc = await userRef.get();
      if (userDoc.exists && userDoc.data().isActive === false) {
        await userRef.update({ isActive: true, deactivatedAt: null });
      }
      await userRef.update({
        onlineStatus: "online",
        lastSeen: new Date(),
        emailVerified: true,
        pendingVerification: false,
      }).catch(async (updateErr) => {
        if (updateErr.code === 'not-found') {
          await userRef.set({
            uid: userCred.user.uid,
            email: email,
            displayName: userCred.user.displayName || email || "User",
            onlineStatus: "online",
            lastSeen: new Date(),
            emailVerified: true,
            pendingVerification: false,
            isActive: true,
          });
        }
      });
    } catch (firestoreError) {
      if (window.__DEBUG__) console.warn("Profile update skipped:", firestoreError);
    }

    window.location.href = new URL("index.html", window.location.href).href;
  } catch (error) {
    errorDiv.textContent = getFriendlyAuthError(error, "Login failed. Please try again.");
    errorDiv.style.display = "block";
    setButtonLoading(btn, false, "Initialize Access", "Logging in...");
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RESEND VERIFICATION
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

document.getElementById("resendVerificationBtn").addEventListener("click", async () => {
  const errorDiv = document.getElementById("authError");
  const successDiv = document.getElementById("authSuccess");
  const btn = document.getElementById("resendVerificationBtn");
  const email = lastUnverifiedEmail || cleanEmail(document.getElementById("loginEmail").value);
  const password = document.getElementById("loginPassword").value;

  errorDiv.style.display = "none";
  successDiv.style.display = "none";

  if (!email || !password) {
    errorDiv.textContent = "Enter your email and password first, then resend verification.";
    errorDiv.style.display = "block";
    return;
  }

  setButtonLoading(btn, true, "Resend verification email", "Sending...");
  try {
    await authPersistenceReady;
    const userCred = await auth.signInWithEmailAndPassword(email, password);
    await sendVerificationEmail(userCred.user);
    await auth.signOut();
    successDiv.textContent = "Verification email sent. Please check your inbox.";
    successDiv.style.display = "block";
  } catch (error) {
    errorDiv.textContent = getFriendlyAuthError(error, "Could not send verification email. Please try again.");
    errorDiv.style.display = "block";
  } finally {
    setButtonLoading(btn, false, "Resend verification email", "Sending...");
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   REGISTER FORM
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearValidationErrors();

  const name = document.getElementById("registerName").value.trim();
  const email = cleanEmail(document.getElementById("registerEmail").value);
  const phone = document.getElementById("registerPhone").value.trim();
  const password = document.getElementById("registerPassword").value;
  const errorDiv = document.getElementById("authError");
  const successDiv = document.getElementById("authSuccess");
  const btn = e.target.querySelector("button[type='submit']");

  errorDiv.style.display = "none";
  successDiv.style.display = "none";

  let hasError = false;

  if (!name || name.length < 2) {
    errorDiv.textContent = "Please enter your full display name.";
    errorDiv.style.display = "block";
    hasError = true;
  }

  if (!validateEmail(email)) {
    showValidationError("emailError", "Please provide a valid email address (e.g. name@domain.com).");
    hasError = true;
  }

  if (phone && !validatePhone(phone)) {
    showValidationError("phoneError", "Enter a valid phone number, including country code when needed.");
    hasError = true;
  }

  if (!validatePassword(password)) {
    showValidationError("passwordError", "Password must be at least 8 characters with one uppercase, one lowercase, and one number or special character.");
    hasError = true;
  }

  if (hasError) return;

  if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-lg mr-2">sync</span> Creating account...`;

  let createdUser = null;
  try {
    await authPersistenceReady;
    const userCred = await auth.createUserWithEmailAndPassword(email, password);
    createdUser = userCred.user;
    await userCred.user.updateProfile({ displayName: name });
    await sendVerificationEmail(userCred.user);

    await db.collection("users").doc(userCred.user.uid).set({
      uid: userCred.user.uid,
      email: email,
      displayName: name,
      phone,
      createdAt: new Date(),
      isActive: true,
      isFirstTime: true,
      emailVerified: false,
      pendingVerification: true,
      onlineStatus: "offline",
      privacySettings: {
        hideReadReceipts: false,
        hideTypingIndicator: false,
        hideLastSeen: false,
      },
    });

    await auth.signOut();
    successDiv.textContent = "Account created! Check your inbox for the verification email. Please verify before logging in.";
    successDiv.style.display = "block";
    document.getElementById("registerForm").reset();
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalHtml || "Create Account";
    delete btn.dataset.originalHtml;
  } catch (error) {
    if (createdUser) {
      await createdUser.delete().catch(() => {});
      await auth.signOut().catch(() => {});
    }
    errorDiv.textContent = getFriendlyAuthError(error, "Registration failed. Please try again.");
    errorDiv.style.display = "block";
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalHtml || "Create Account";
    delete btn.dataset.originalHtml;
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PASSWORD RESET MODAL
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

let _resetLastSent = 0;

const resetModal = document.getElementById("resetModal");
document.getElementById("forgotPasswordBtn").addEventListener("click", () => {
  const loginEmail = document.getElementById('loginEmail')?.value || '';
  resetModal.classList.add("show");
  const resetInput = resetModal.querySelector('input');
  if (resetInput) {
    resetInput.value = loginEmail;
    resetInput.focus();
  }
});
document.querySelectorAll(".resetClose").forEach((btn) => {
  btn.addEventListener("click", () => resetModal.classList.remove("show"));
});
resetModal.addEventListener("click", (e) => {
  if (e.target === resetModal) resetModal.classList.remove("show");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && resetModal.classList.contains("show")) {
    resetModal.classList.remove("show");
  }
});
document.getElementById("sendResetBtn").addEventListener("click", async () => {
  const email = document.getElementById("resetEmail").value.trim();
  const btn = document.getElementById("sendResetBtn");
  const resetModalEl = document.getElementById("resetModal");

  const now = Date.now();
  if (now - _resetLastSent < 60000) {
    const remaining = Math.ceil((60000 - (now - _resetLastSent)) / 1000);
    var existing = document.getElementById('resetInlineError');
    if (existing) { existing.textContent = 'Please wait ' + remaining + ' seconds before trying again.'; }
    else { btn.insertAdjacentHTML('afterend', '<div id="resetInlineError" class="mt-xs p-xs text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded text-center">Please wait ' + remaining + ' seconds before trying again.</div>'); }
    setTimeout(() => { var el = document.getElementById('resetInlineError'); if (el) el.remove(); }, 3000);
    return;
  }

  if (!email) {
    existing = document.getElementById('resetInlineError');
    if (existing) { existing.textContent = 'Please enter your email'; }
    else { btn.insertAdjacentHTML('afterend', '<div id="resetInlineError" class="mt-xs p-xs text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded text-center">Please enter your email</div>'); }
    setTimeout(() => { var el = document.getElementById('resetInlineError'); if (el) el.remove(); }, 3000);
    return;
  }

  if (!validateEmail(email)) {
    existing = document.getElementById('resetInlineError');
    if (existing) { existing.textContent = 'Please enter a valid email address'; }
    else { btn.insertAdjacentHTML('afterend', '<div id="resetInlineError" class="mt-xs p-xs text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded text-center">Please enter a valid email address</div>'); }
    setTimeout(() => { var el = document.getElementById('resetInlineError'); if (el) el.remove(); }, 3000);
    return;
  }

  btn.disabled = true;
  btn.textContent = "Sending...";

  const resetActionCodeSettings = {
    url: new URL("reset.html", window.location.href).href,
    handleCodeInApp: true,
  };

  try {
    await auth.sendPasswordResetEmail(email, resetActionCodeSettings);
    _resetLastSent = Date.now();
    resetModalEl.classList.remove("show");
    const successDiv = document.getElementById("authSuccess");
    successDiv.textContent = "Password reset email sent! Check your inbox.";
    successDiv.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Send Reset Link";
  } catch (error) {
    var escapedMsg = getFriendlyAuthError(error, error.message || 'Failed to send reset email').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    existing = document.getElementById('resetInlineError');
    if (existing) { existing.textContent = getFriendlyAuthError(error, error.message || 'Failed to send reset email'); }
    else { btn.insertAdjacentHTML('afterend', '<div id="resetInlineError" class="mt-xs p-xs text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded text-center">' + escapedMsg + '</div>'); }
    setTimeout(() => { var el = document.getElementById('resetInlineError'); if (el) el.remove(); }, 5000);
    btn.disabled = false;
    btn.textContent = "Send Reset Link";
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PARALLAX AMBIENT LIGHT
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

let _lastParallaxFrame = 0;
document.addEventListener('mousemove', (e) => {
  const now = performance.now();
  if (now - _lastParallaxFrame < 32) return;
  _lastParallaxFrame = now;
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;
  const spot1 = document.getElementById('ambient-spot-1');
  const spot2 = document.getElementById('ambient-spot-2');
  if (spot1) spot1.style.transform = `translate(${(x - 0.5) * 40}px, ${(y - 0.5) * 40}px)`;
  if (spot2) spot2.style.transform = `translate(${(x - 0.5) * 20}px, ${(y - 0.5) * 20}px)`;
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   DARK MODE TOGGLE
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

(function () {
  var themes = ["system", "dark", "light"];
  var btn = document.getElementById('dmToggle');
  if (!btn) return;
  function updateBtn() {
    var mode = localStorage.getItem("themeMode") || "system";
    var theme = document.documentElement.dataset.theme;
    btn.innerHTML = theme === "dark"
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    btn.title = "Theme: " + mode;
  }
  updateBtn();
  btn.addEventListener("click", function () {
    var cur = localStorage.getItem("themeMode") || "system";
    var next = themes[(themes.indexOf(cur) + 1) % themes.length];
    if (window.setThemeMode) {
      window.setThemeMode(next);
    } else {
      localStorage.setItem("themeMode", next);
      if (next === "system") {
        var m = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
        document.documentElement.dataset.theme = m && m.matches ? "dark" : "light";
      } else {
        document.documentElement.dataset.theme = next;
      }
      document.body.classList.toggle("dark", document.documentElement.dataset.theme === "dark");
    }
    var isDark = document.documentElement.dataset.theme === "dark";
    document.documentElement.className = isDark ? "dark" : "light";
    updateBtn();
  });
  window.addEventListener("themechange", updateBtn);
})();

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   VERSION FETCHER
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

fetch('dist/version.json').then(r => r.json()).then(v => {
  var el = document.getElementById('app-version');
  if (el) el.textContent = v.version || 'v4.0.0';
}).catch(() => {});
