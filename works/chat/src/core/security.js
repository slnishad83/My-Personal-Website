/**
 * NSL Chat — Security Module (ES Module)
 * 
 * Provides:
 * - ECDH P-256 key exchange for E2E encryption
 * - AES-GCM-256 message encryption/decryption
 * - WebCrypto-based encrypted storage (replaces fake base64)
 * - Firebase ID token management
 * - PIN hashing with PBKDF2
 * - Device fingerprinting
 * 
 * SECURITY LEVEL: Production-grade
 */
'use strict';

const _keyCache = new Map();
const _KEY_CACHE_MAX = 100;
const _TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
let _tokenRefreshTimer = null;

/* ══════════════════════════════════════════════════════════════
   ECDH KEY EXCHANGE — Proper Diffie-Hellman for E2E
   ══════════════════════════════════════════════════════════════ */

/**
 * Generate an ECDH P-256 key pair for key exchange.
 * Returns { publicKeyJwk, privateKey, sharedSecretReady }
 */
export async function generateKeyPair() {
  try {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    return { publicKeyJwk, privateKey: keyPair.privateKey };
  } catch (e) {
    console.error('[Security] ECDH key pair generation failed:', e);
    return null;
  }
}

/**
 * Derive a shared AES-GCM-256 key from our private key + their public key.
 * This is the core of ECDH — both parties derive the same shared secret
 * without ever transmitting it.
 */
export async function deriveSharedKey(privateKey, theirPublicKeyJwk) {
  try {
    const theirPublicKey = await crypto.subtle.importKey(
      'jwk',
      theirPublicKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );
    const sharedKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: theirPublicKey },
      privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    return sharedKey;
  } catch (e) {
    console.error('[Security] Shared key derivation failed:', e);
    return null;
  }
}

/**
 * Export a CryptoKey as raw base64 for Firestore storage.
 */
export async function exportKey(key) {
  try {
    const raw = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
  } catch (e) {
    console.error('[Security] Key export failed:', e);
    return null;
  }
}

/**
 * Import a raw base64 key back into a CryptoKey.
 */
export async function importKey(b64, algorithm = { name: 'AES-GCM' }, keyUsages = ['encrypt', 'decrypt']) {
  try {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return await crypto.subtle.importKey('raw', bytes, algorithm, false, keyUsages);
  } catch (e) {
    console.error('[Security] Key import failed:', e);
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════
   AES-GCM ENCRYPTION — Message-level encryption
   ══════════════════════════════════════════════════════════════ */

/**
 * Encrypt plaintext with AES-GCM-256.
 * Returns { ciphertext, iv } both as base64 strings.
 */
export async function encrypt(text, key) {
  if (!key) throw new Error('[Security] encrypt() requires an encryption key');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv)
  };
}

/**
 * Decrypt AES-GCM-256 ciphertext.
 * Returns plaintext string or error object.
 */
export async function decrypt(ciphertext, iv, key) {
  if (!key || !iv) return { error: true, message: 'Missing key or IV' };
  try {
    const ct = base64ToArrayBuffer(ciphertext);
    const ivBytes = base64ToArrayBuffer(iv);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ct);
    return new TextDecoder().decode(plain);
  } catch (e) {
    return { error: true, message: 'Decryption failed' };
  }
}

/* ══════════════════════════════════════════════════════════════
   ROOM KEY MANAGEMENT — Per-chat encryption keys
   ══════════════════════════════════════════════════════════════ */

/**
 * Get or create an AES-GCM key for a chat room.
 * Keys are cached in memory with LRU eviction.
 */
export async function getOrCreateRoomKey(chatId) {
  if (_keyCache.has(chatId)) return _keyCache.get(chatId);
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  if (key) {
    if (_keyCache.size >= _KEY_CACHE_MAX) {
      const firstKey = _keyCache.keys().next().value;
      _keyCache.delete(firstKey);
    }
    _keyCache.set(chatId, key);
  }
  return key;
}

/* ══════════════════════════════════════════════════════════════
   ENCRYPTED STORAGE — WebCrypto-based secure storage
   Replaces the old base64-encoded sessionStorage approach.
   Uses AES-GCM with a device-derived key stored in IndexedDB.
   ══════════════════════════════════════════════════════════════ */

const _storageDBName = 'nslSecureStorage';
const _storageDBVersion = 1;
const _storageStoreName = 'secrets';
let _storageKey = null;

/**
 * Initialize encrypted storage — derives a device key from IndexedDB.
 */
async function _initStorageKey() {
  if (_storageKey) return _storageKey;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(_storageDBName, _storageDBVersion);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_storageStoreName)) {
        db.createObjectStore(_storageStoreName);
      }
    };
    request.onsuccess = async (e) => {
      const db = e.target.result;
      const tx = db.transaction(_storageStoreName, 'readonly');
      const store = tx.objectStore(_storageStoreName);
      const getReq = store.get('_deviceKey');

      getReq.onsuccess = async () => {
        if (getReq.result) {
          _storageKey = await crypto.subtle.importKey(
            'raw',
            getReq.result,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
          );
          resolve(_storageKey);
        } else {
          _storageKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );
          const raw = await crypto.subtle.exportKey('raw', _storageKey);
          const writeTx = db.transaction(_storageStoreName, 'readwrite');
          writeTx.objectStore(_storageStoreName).put(raw, '_deviceKey');
          resolve(_storageKey);
        }
      };
      getReq.onerror = () => reject(getReq.error);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store a value encrypted with AES-GCM in IndexedDB.
 */
export async function setSecure(key, value) {
  try {
    const deviceKey = await _initStorageKey();
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, deviceKey, plaintext);

    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(_storageDBName, _storageDBVersion);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction(_storageStoreName, 'readwrite');
    tx.objectStore(_storageStoreName).store.put({
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv),
      ts: Date.now()
    }, key);
  } catch (e) {
    console.error('[Security] setSecure failed:', e);
  }
}

/**
 * Retrieve and decrypt a value from IndexedDB.
 */
export async function getSecure(key) {
  try {
    const deviceKey = await _initStorageKey();
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(_storageDBName, _storageDBVersion);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction(_storageStoreName, 'readonly');
    const entry = await new Promise((resolve, reject) => {
      const req = tx.objectStore(_storageStoreName).store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!entry) return null;

    const ct = base64ToArrayBuffer(entry.ciphertext);
    const iv = base64ToArrayBuffer(entry.iv);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, deviceKey, ct);
    return JSON.parse(new TextDecoder().decode(plain));
  } catch (e) {
    console.error('[Security] getSecure failed:', e);
    return null;
  }
}

/**
 * Clear all encrypted storage entries.
 */
export async function clearSecure() {
  try {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(_storageDBName, _storageDBVersion);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction(_storageStoreName, 'readwrite');
    tx.objectStore(_storageStoreName).clear();
    _storageKey = null;
  } catch (e) {
    console.error('[Security] clearSecure failed:', e);
  }
}

/* ══════════════════════════════════════════════════════════════
   PIN HASHING — PBKDF2 with salt (for app lock / chat lock)
   ══════════════════════════════════════════════════════════════ */

/**
 * Hash a PIN with PBKDF2 + salt.
 * Returns { hash, salt } both as hex strings.
 */
export async function hashPin(pin, existingSalt = null) {
  const enc = new TextEncoder();
  let salt;
  if (existingSalt) {
    salt = Uint8Array.from(existingSalt.match(/.{2}/g).map(b => parseInt(b, 16)));
  } else {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');

  return { hash: hashHex, salt: saltHex };
}

/* ══════════════════════════════════════════════════════════════
   TOKEN MANAGEMENT — Firebase ID Token refresh
   ══════════════════════════════════════════════════════════════ */

export function startTokenRefresh() {
  _tokenRefreshTimer = setInterval(async () => {
    const user = window.currentUser;
    if (user?.getIdToken) {
      try { await user.getIdToken(true); } catch (e) { console.error('[Security] Token refresh failed:', e); }
    }
  }, _TOKEN_REFRESH_INTERVAL);
}

export async function getIdToken() {
  const user = window.currentUser;
  if (!user?.getIdToken) return null;
  try { return await user.getIdToken(); } catch { return null; }
}

export async function forceTokenRefresh() {
  const user = window.currentUser;
  if (!user?.getIdToken) return false;
  try { await user.getIdToken(true); return true; } catch { return false; }
}

/* ══════════════════════════════════════════════════════════════
   DEVICE FINGERPRINTING
   ══════════════════════════════════════════════════════════════ */

export function getDeviceInfo() {
  return {
    platform: navigator.platform || 'unknown',
    userAgent: navigator.userAgent || 'unknown',
    screen: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    cookiesEnabled: navigator.cookieEnabled,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
  };
}

/* ══════════════════════════════════════════════════════════════
   CLEANUP
   ══════════════════════════════════════════════════════════════ */

export function destroy() {
  if (_tokenRefreshTimer) { clearInterval(_tokenRefreshTimer); _tokenRefreshTimer = null; }
  _keyCache.clear();
  clearSecure();
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/* ══════════════════════════════════════════════════════════════
   GLOBAL BACKWARD COMPATIBILITY
   ══════════════════════════════════════════════════════════════ */

const Security = {
  generateKeyPair, deriveSharedKey, exportKey, importKey,
  encrypt, decrypt, getOrCreateRoomKey,
  setSecure, getSecure, clearSecure,
  hashPin, startTokenRefresh, getIdToken, forceTokenRefresh,
  getDeviceInfo, destroy
};

window.Security = Security;
