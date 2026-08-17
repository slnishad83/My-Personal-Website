'use strict';
/* Shared Firebase config � single source of truth for all pages and SW.
   At build time, __FIREBASE_CONFIG__ is replaced by Vite's define option
   with the contents of firebase-env.json.
   In dev mode, falls back to reading from firebase-env.json inline. */

if (typeof window.FIREBASE_CONFIG === 'undefined') {
  if (typeof __FIREBASE_CONFIG__ !== 'undefined') {
    window.FIREBASE_CONFIG = Object.freeze(__FIREBASE_CONFIG__);
  } else {
    /* Dev fallback � inline the config so HMR works without build */
    window.FIREBASE_CONFIG = Object.freeze({
      apiKey: "AIzaSyCdbut_FdscAjl-OVSlAUhb7TOTiRNkh34",
      authDomain: "my-team-chat-2255.firebaseapp.com",
      projectId: "my-team-chat-2255",
      storageBucket: "my-team-chat-2255.firebasestorage.app",
      messagingSenderId: "805016891521",
      appId: "1:805016891521:web:ac9bc7a252bcf33686dd80",
    });
  }
}
