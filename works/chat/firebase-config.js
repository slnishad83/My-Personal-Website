'use strict';
/* Shared Firebase config — single source of truth for all pages and SW.
   Loaded via <script src="firebase-config.js"> before any Firebase SDK. */

if (typeof window.FIREBASE_CONFIG === 'undefined') {
  window.FIREBASE_CONFIG = Object.freeze({
    apiKey: "AIzaSyCdbut_FdscAjl-OVSlAUhb7TOTiRNkh34",
    authDomain: "my-team-chat-2255.firebaseapp.com",
    projectId: "my-team-chat-2255",
    storageBucket: "my-team-chat-2255.firebasestorage.app",
    messagingSenderId: "805016891521",
    appId: "1:805016891521:web:ac9bc7a252bcf33686dd80",
  });
}
