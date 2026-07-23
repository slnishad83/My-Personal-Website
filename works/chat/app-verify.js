/**
 * NSL Chat — Vite Entry Point (verify.html)
 * Email verification page: Firebase auth action code + theme toggle.
 * CDN scripts (firebase-app, firebase-auth) load before this module.
 */

import './firebase-config.js';

/* ══════════════════════════════════════════════════════════════
   FIREBASE INIT (uses global firebase from CDN compat scripts)
   ══════════════════════════════════════════════════════════════ */

const firebaseConfig = window.FIREBASE_CONFIG;
firebase.initializeApp(firebaseConfig);

/* ══════════════════════════════════════════════════════════════
   DOM REFERENCES
   ══════════════════════════════════════════════════════════════ */

const params = new URLSearchParams(window.location.search);
const code = params.get("oobCode");
const mode = params.get("mode");
const title = document.getElementById("title");
const message = document.getElementById("message");
const statusMark = document.getElementById("statusMark");
const spinnerWrap = document.getElementById("spinnerWrap");
const actionBtn = document.getElementById("actionBtn");

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */

function showResult(type, text) {
  spinnerWrap.style.display = "none";
  statusMark.style.display = "flex";
  title.textContent =
    type === "success"
      ? "Email verified successfully"
      : "Verification link could not be used";
  message.textContent = text;
  statusMark.innerHTML = type === "success" ? "&#10003;" : "!";
  statusMark.classList.toggle("error", type === "error");
  actionBtn.style.display = "inline-flex";
  actionBtn.textContent = "";
  actionBtn.innerHTML =
    type === "success"
      ? 'Go to Login <span class="material-symbols-outlined">arrow_forward</span>'
      : 'Back to Login <span class="material-symbols-outlined">arrow_back</span>';
  actionBtn.href = "login.html";
  actionBtn.focus({ preventScroll: false });
}

/* ══════════════════════════════════════════════════════════════
   VERIFY EMAIL ACTION
   ══════════════════════════════════════════════════════════════ */

async function verifyEmail() {
  if (!code) {
    showResult("success", "You can now log in to use NSL Chat.");
    return;
  }

  if (mode && mode !== "verifyEmail") {
    showResult(
      "error",
      "This link is not an email verification link. Please use the latest verification email from NSL Chat.",
    );
    return;
  }

  try {
    await firebase.auth().applyActionCode(code);
    showResult("success", "You can now log in to use NSL Chat.");
  } catch {
    showResult(
      "error",
      "This verification link is invalid or already used. Try logging in, or request a new verification email.",
    );
  }
}

verifyEmail();

/* ══════════════════════════════════════════════════════════════
   DARK MODE TOGGLE
   ══════════════════════════════════════════════════════════════ */

(function () {
  var dmBtn = document.getElementById("dmToggle");
  dmBtn.addEventListener("click", function () {
    var cur = document.documentElement.dataset.theme || "light";
    var next = cur === "dark" ? "light" : "dark";
    document.documentElement.className = next;
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme =
      next === "dark" ? "dark" : "light";
    document.body.classList.toggle("dark", next === "dark");
    document.body.classList.toggle("light", next !== "dark");
    try {
      localStorage.setItem("themeMode", next);
    } catch (e) {}
  });
})();
