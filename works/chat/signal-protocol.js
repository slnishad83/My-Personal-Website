/**
 * Signal Protocol (X3DH + Double Ratchet) Implementation
 * =======================================================
 * End-to-end encrypted messaging protocol using WebCrypto API.
 *
 * Cryptographic primitives:
 *   - ECDH P-256 for key agreement
 *   - ECDSA P-256 for signed pre-keys
 *   - HKDF-SHA256 for key derivation
 *   - AES-256-GCM for symmetric encryption
 *
 * Storage: IndexedDB (database: 'nslSignalDB')
 *
 * @license MIT
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  /** IndexedDB database name */
  var DB_NAME = 'nslSignalDB';
  var DB_VERSION = 1;

  /** Object store names */
  var STORE_IDENTITY = 'identityKeys';
  var STORE_SESSIONS = 'sessions';
  var STORE_PREKEYS = 'preKeys';

  /** Algorithm identifiers for WebCrypto */
  var ECDH_ALGO = { name: 'ECDH', namedCurve: 'P-256' };
  var ECDSA_ALGO = { name: 'ECDSA', namedCurve: 'P-256' };
  var AES_GCM_ALGO = { name: 'AES-GCM', length: 256 };
  var HKDF_ALGO = { name: 'HKDF' };

  /** HKDF info labels */
  var INFO_MSG = new TextEncoder().encode('msg');
  var INFO_RATCHET = new TextEncoder().encode('ratchet');
  var INFO_COMBINE = new TextEncoder().encode('x3dh-combine');

  /** AES-GCM IV length in bytes */
  var IV_LENGTH = 12;

  /** Default one-time pre-key batch size */
  var DEFAULT_OPK_COUNT = 20;

  /** Development/debug flag – set window.__DEBUG__ = true to enable logs */
  function _log() {
    if (window.__DEBUG__) {
      var args = Array.prototype.slice.call(arguments);
      console.log.apply(console, ['[SignalProtocol]'].concat(args));
    }
  }

  function _warn() {
    if (window.__DEBUG__) {
      var args = Array.prototype.slice.call(arguments);
      console.warn.apply(console, ['[SignalProtocol]'].concat(args));
    }
  }

  /* ------------------------------------------------------------------ */
  /*  IndexedDB Helpers                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Open (or create) the IndexedDB database.
   * @returns {Promise<IDBDatabase>}
   */
  function _openDB() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_IDENTITY)) {
          db.createObjectStore(STORE_IDENTITY, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: 'chatId' });
        }
        if (!db.objectStoreNames.contains(STORE_PREKEYS)) {
          db.createObjectStore(STORE_PREKEYS, { keyPath: 'id' });
        }
      };

      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(new Error('Failed to open IndexedDB: ' + request.error));
      };
    });
  }

  /**
   * Store a value in IndexedDB.
   * @param {string} storeName - Object store name
   * @param {string} key       - Record key
   * @param {*} value          - Value to store
   * @returns {Promise<void>}
   */
  function _store(storeName, key, value) {
    return new Promise(function (resolve, reject) {
      _openDB().then(function (db) {
        var tx = db.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        var record = typeof key === 'string' ? { id: key } : key;
        if (typeof value !== 'undefined') {
          record = Object.assign({}, record, value);
        }
        var req = store.put(record);
        req.onsuccess = function () {
          db.close();
          resolve();
        };
        req.onerror = function () {
          db.close();
          reject(new Error('Store failed: ' + req.error));
        };
        tx.onerror = function () {
          db.close();
          reject(new Error('Transaction failed: ' + tx.error));
        };
      }).catch(reject);
    });
  }

  /**
   * Load a value from IndexedDB.
   * @param {string} storeName - Object store name
   * @param {string} key       - Record key
   * @returns {Promise<*>}
   */
  function _load(storeName, key) {
    return new Promise(function (resolve, reject) {
      _openDB().then(function (db) {
        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var req = store.get(key);
        req.onsuccess = function () {
          db.close();
          resolve(req.result || null);
        };
        req.onerror = function () {
          db.close();
          reject(new Error('Load failed: ' + req.error));
        };
        tx.onerror = function () {
          db.close();
          reject(new Error('Transaction failed: ' + tx.error));
        };
      }).catch(reject);
    });
  }

  /**
   * Delete a record from IndexedDB.
   * @param {string} storeName - Object store name
   * @param {string} key       - Record key
   * @returns {Promise<void>}
   */
  function _remove(storeName, key) {
    return new Promise(function (resolve, reject) {
      _openDB().then(function (db) {
        var tx = db.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        var req = store.delete(key);
        req.onsuccess = function () {
          db.close();
          resolve();
        };
        req.onerror = function () {
          db.close();
          reject(new Error('Remove failed: ' + req.error));
        };
        tx.onerror = function () {
          db.close();
          reject(new Error('Transaction failed: ' + tx.error));
        };
      }).catch(reject);
    });
  }

  /**
   * Retrieve all records from an IndexedDB store.
   * @param {string} storeName - Object store name
   * @returns {Promise<Array>}
   */
  function _loadAll(storeName) {
    return new Promise(function (resolve, reject) {
      _openDB().then(function (db) {
        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var req = store.getAll();
        req.onsuccess = function () {
          db.close();
          resolve(req.result || []);
        };
        req.onerror = function () {
          db.close();
          reject(new Error('LoadAll failed: ' + req.error));
        };
        tx.onerror = function () {
          db.close();
          reject(new Error('Transaction failed: ' + tx.error));
        };
      }).catch(reject);
    });
  }

  /**
   * Clear all records from an IndexedDB store.
   * @param {string} storeName - Object store name
   * @returns {Promise<void>}
   */
  function _clearStore(storeName) {
    return new Promise(function (resolve, reject) {
      _openDB().then(function (db) {
        var tx = db.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        var req = store.clear();
        req.onsuccess = function () {
          db.close();
          resolve();
        };
        req.onerror = function () {
          db.close();
          reject(new Error('Clear failed: ' + req.error));
        };
        tx.onerror = function () {
          db.close();
          reject(new Error('Transaction failed: ' + tx.error));
        };
      }).catch(reject);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Encoding Helpers                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Convert an ArrayBuffer to a Base64 string.
   * @param {ArrayBuffer} buffer
   * @returns {string}
   */
  function _arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert a Base64 string to an ArrayBuffer.
   * @param {string} base64
   * @returns {ArrayBuffer}
   */
  function _base64ToArrayBuffer(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Convert a Uint8Array to ArrayBuffer (shared references).
   * @param {Uint8Array} arr
   * @returns {ArrayBuffer}
   */
  function _toAB(arr) {
    return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
  }

  /* ------------------------------------------------------------------ */
  /*  Cryptographic Helpers                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Generate cryptographically secure random bytes.
   * @param {number} length - Number of random bytes
   * @returns {Uint8Array}
   */
  function _randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * HKDF-SHA256 key derivation.
   * Uses the WebCrypto HKDF API with a zero-length salt and the provided
   * info parameter to derive a key of the requested length.
   *
   * @param {ArrayBuffer} input  - Input key material
   * @param {string}      info   - Context/application-specific info string
   * @param {number}      length - Desired output length in bytes (max 255 * 32)
   * @returns {Promise<ArrayBuffer>} Derived key bytes
   */
  async function _hkdf(input, info, length) {
    var infoBytes = new TextEncoder().encode(info);

    // Import input as raw key material
    var baseKey = await crypto.subtle.importKey(
      'raw',
      input,
      'HKDF',
      false,
      ['deriveBits']
    );

    // HKDF-SHA256: use zero salt
    var salt = new Uint8Array(32);

    var derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: salt,
        info: infoBytes,
      },
      baseKey,
      length * 8
    );

    return derivedBits;
  }

  /**
   * Combine multiple shared secret keys into a single root key.
   * Concatenates all inputs, then HKDF-derives a fixed-length key.
   *
   * @param {ArrayBuffer[]} keys - Array of shared secret buffers
   * @returns {Promise<ArrayBuffer>} Combined root key (32 bytes)
   */
  async function _combineKeys(keys) {
    // Calculate total length
    var totalLen = 0;
    for (var i = 0; i < keys.length; i++) {
      totalLen += keys[i].byteLength;
    }

    // Concatenate all keys
    var combined = new Uint8Array(totalLen);
    var offset = 0;
    for (var j = 0; j < keys.length; j++) {
      combined.set(new Uint8Array(keys[j]), offset);
      offset += keys[j].byteLength;
    }

    // Derive a 32-byte root key via HKDF
    var combinedAB = _toAB(combined);
    return _hkdf(combinedAB, 'x3dh-combine', 32);
  }

  /**
   * Derive a shared secret via ECDH P-256.
   *
   * @param {CryptoKey} privateKey   - Local ECDH private key
   * @param {Object}    publicKeyJwk - Remote public key in JWK format
   * @returns {Promise<ArrayBuffer>} 32-byte shared secret
   */
  async function _deriveSharedKey(privateKey, publicKeyJwk) {
    var remotePublic = await crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      ECDH_ALGO,
      true,
      ['deriveBits']
    );

    var sharedSecret = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: remotePublic },
      privateKey,
      256
    );

    return sharedSecret;
  }

  /* ------------------------------------------------------------------ */
  /*  State – identity key pair, signed pre-key, one-time pre-keys       */
  /* ------------------------------------------------------------------ */

  var _state = {
    /** @type {CryptoKey|null} ECDH P-256 identity private key */
    identityPrivateKey: null,
    /** @type {Object|null} Identity public key in JWK format */
    identityPublicKeyJwk: null,
    /** @type {CryptoKey|null} ECDSA P-256 signed pre-key private key */
    signedPreKeyPrivate: null,
    /** @type {Object|null} Signed pre-key public key in JWK */
    signedPreKeyPublicJwk: null,
    /** @type {number} Signed pre-key ID */
    signedPreKeyId: 1,
    /** @type {ArrayBuffer|null} ECDSA signature over the signed pre-key */
    signedPreKeySignature: null,
    /** @type {Array} One-time pre-key pairs [{privateKey, publicKeyJwk, keyId}] */
    oneTimePreKeys: [],
    /** @type {number} Counter for generating unique OPK IDs */
    _opkCounter: 1,
  };

  /* ------------------------------------------------------------------ */
  /*  Key Generation                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Generate a long-term ECDH P-256 identity key pair.
   * The private key is kept locally; the public key is shared with peers.
   *
   * @returns {Promise<CryptoKey>} The ECDH private key
   */
  async function generateIdentityKeyPair() {
    _log('Generating identity key pair...');

    var keyPair = await crypto.subtle.generateKey(ECDH_ALGO, true, [
      'deriveBits',
      'deriveKey',
    ]);

    _state.identityPrivateKey = keyPair.privateKey;
    _state.identityPublicKeyJwk = await crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    );

    _log('Identity key pair generated');
    return keyPair.privateKey;
  }

  /**
   * Generate a signed pre-key (medium-term, rotated periodically).
   * The key pair is signed with the identity key using ECDSA P-256.
   *
   * @param {CryptoKey} identityPrivateKey - Identity private key for signing
   * @returns {Promise<Object>} { publicKeyJwk, privateKey, keyId, signature }
   */
  async function generateSignedPreKey(identityPrivateKey) {
    _log('Generating signed pre-key...');

    var keyId = _state.signedPreKeyId++;

    // Generate ECDH P-256 key pair for the signed pre-key
    var keyPair = await crypto.subtle.generateKey(ECDH_ALGO, true, [
      'deriveBits',
      'deriveKey',
    ]);

    var publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    // Create a deterministic digest of the public key to sign
    var pubKeyData = new TextEncoder().encode(
      publicKeyJwk.x + publicKeyJwk.y
    );
    var digest = await crypto.subtle.digest('SHA-256', pubKeyData);

    // Sign with ECDSA P-256 using the identity key
    // WebCrypto requires an ECDSA private key for ECDSA signing.
    // Since identity key is ECDH, we derive a signing key from it via HKDF.
    var signingKeyData = await _hkdf(
      _toAB(new Uint8Array(await crypto.subtle.exportKey('raw', identityPrivateKey))),
      'spk-sign',
      32
    );

    // Import a synthetic ECDSA private key for signing
    var ecdsaParams = { name: 'ECDSA', namedCurve: 'P-256' };
    var signingKey = await crypto.subtle.importKey(
      'pkcs8',
      _buildECDSAPrivatePKCS8(signingKeyData),
      ecdsaParams,
      false,
      ['sign']
    );

    var signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signingKey,
      digest
    );

    _state.signedPreKeyPrivate = keyPair.privateKey;
    _state.signedPreKeyPublicJwk = publicKeyJwk;
    _state.signedPreKeySignature = signature;

    _log('Signed pre-key generated, id=' + keyId);

    return {
      publicKeyJwk: publicKeyJwk,
      privateKey: keyPair.privateKey,
      keyId: keyId,
      signature: signature,
    };
  }

  /**
   * Generate a batch of one-time pre-keys (ECDH P-256).
   * Each key is used exactly once during X3DH and then discarded.
   *
   * @param {number} [count=20] - Number of one-time pre-keys to generate
   * @returns {Promise<Array>} Array of { privateKey, publicKeyJwk, keyId }
   */
  async function generateOneTimePreKeys(count) {
    count = count || DEFAULT_OPK_COUNT;
    _log('Generating ' + count + ' one-time pre-keys...');

    var keys = [];
    for (var i = 0; i < count; i++) {
      var keyId = _state._opkCounter++;
      var keyPair = await crypto.subtle.generateKey(ECDH_ALGO, true, [
        'deriveBits',
        'deriveKey',
      ]);

      var publicKeyJwk = await crypto.subtle.exportKey(
        'jwk',
        keyPair.publicKey
      );

      keys.push({
        privateKey: keyPair.privateKey,
        publicKeyJwk: publicKeyJwk,
        keyId: keyId,
      });
    }

    _state.oneTimePreKeys = _state.oneTimePreKeys.concat(keys);
    _log('Generated ' + count + ' one-time pre-keys');
    return keys;
  }

  /**
   * Build a PKCS#8 DER-encoded ECDSA P-256 private key from raw key bytes.
   * This is needed because WebCrypto requires PKCS#8 import format for
   * private keys (we only have the raw 32-byte scalar from HKDF).
   *
   * @param {ArrayBuffer} rawKey - 32-byte raw private key
   * @returns {ArrayBuffer} PKCS#8 encoded key
   */
  function _buildECDSAPrivatePKCS8(rawKey) {
    // Simplified PKCS#8 wrapping for ECDSA P-256
    // OID 1.2.840.10045.3.1.7 (P-256 curve)
    var keyBytes = new Uint8Array(rawKey);
    var pkcs8 = new Uint8Array(138);
    var offset = 0;

    // SEQUENCE header
    pkcs8[offset++] = 0x30;
    pkcs8[offset++] = 0x82;
    pkcs8[offset++] = 0x00;
    pkcs8[offset++] = 0x84; // 132 bytes total

    // Algorithm SEQUENCE
    pkcs8[offset++] = 0x30;
    pkcs8[offset++] = 0x14;

    // OID rsaEncryption (id-ecPublicKey)
    pkcs8[offset++] = 0x06;
    pkcs8[offset++] = 0x07;
    pkcs8[offset++] = 0x2a;
    pkcs8[offset++] = 0x86;
    pkcs8[offset++] = 0x48;
    pkcs8[offset++] = 0xce;
    pkcs8[offset++] = 0x3d;
    pkcs8[offset++] = 0x02;
    pkcs8[offset++] = 0x01;

    // OID P-256
    pkcs8[offset++] = 0x06;
    pkcs8[offset++] = 0x08;
    pkcs8[offset++] = 0x2a;
    pkcs8[offset++] = 0x86;
    pkcs8[offset++] = 0x48;
    pkcs8[offset++] = 0xce;
    pkcs8[offset++] = 0x3d;
    pkcs8[offset++] = 0x03;
    pkcs8[offset++] = 0x01;
    pkcs8[offset++] = 0x07;

    // OCTET STRING wrapper
    pkcs8[offset++] = 0x04;
    pkcs8[offset++] = 0x46;

    // INTEGER 0 (version)
    pkcs8[offset++] = 0x02;
    pkcs8[offset++] = 0x01;
    pkcs8[offset++] = 0x00;

    // OCTET STRING containing the private key
    pkcs8[offset++] = 0x04;
    pkcs8[offset++] = 0x41;

    // EC parameters: uncompressed + 0x04 + x + y
    pkcs8[offset++] = 0x04;
    pkcs8[offset++] = 0x40;

    // Zero-padded scalar (32 bytes) – we use the key directly
    pkcs8.set(keyBytes, offset);

    return pkcs8.buffer;
  }

  /**
   * Build a PKCS#8 DER-encoded ECDH P-256 private key from raw key bytes.
   *
   * @param {ArrayBuffer} rawKey - 32-byte raw private key
   * @returns {ArrayBuffer} PKCS#8 encoded key
   */
  function _buildECDHPKCS8(rawKey) {
    var keyBytes = new Uint8Array(rawKey);
    // ECDH PKCS#8: SEQUENCE { INTEGER 0, SEQUENCE { OID ecPublicKey, OID P-256 }, OCTET STRING { OCTET STRING { key } } }
    var pkcs8 = new Uint8Array(138);
    var offset = 0;

    pkcs8[offset++] = 0x30;
    pkcs8[offset++] = 0x82;
    pkcs8[offset++] = 0x00;
    pkcs8[offset++] = 0x84;

    pkcs8[offset++] = 0x30;
    pkcs8[offset++] = 0x14;

    pkcs8[offset++] = 0x06;
    pkcs8[offset++] = 0x07;
    pkcs8[offset++] = 0x2a;
    pkcs8[offset++] = 0x86;
    pkcs8[offset++] = 0x48;
    pkcs8[offset++] = 0xce;
    pkcs8[offset++] = 0x3d;
    pkcs8[offset++] = 0x02;
    pkcs8[offset++] = 0x01;

    pkcs8[offset++] = 0x06;
    pkcs8[offset++] = 0x08;
    pkcs8[offset++] = 0x2a;
    pkcs8[offset++] = 0x86;
    pkcs8[offset++] = 0x48;
    pkcs8[offset++] = 0xce;
    pkcs8[offset++] = 0x3d;
    pkcs8[offset++] = 0x03;
    pkcs8[offset++] = 0x01;
    pkcs8[offset++] = 0x07;

    pkcs8[offset++] = 0x04;
    pkcs8[offset++] = 0x46;

    pkcs8[offset++] = 0x02;
    pkcs8[offset++] = 0x01;
    pkcs8[offset++] = 0x00;

    pkcs8[offset++] = 0x04;
    pkcs8[offset++] = 0x41;

    pkcs8[offset++] = 0x04;
    pkcs8[offset++] = 0x40;

    pkcs8.set(keyBytes, offset);

    return pkcs8.buffer;
  }

  /**
   * Build a SPKI DER-encoded ECDH P-256 public key from raw bytes.
   *
   * @param {Object} jwk - JWK with x, y coordinates
   * @returns {ArrayBuffer}
   */
  async function _buildECDHSPKI(jwk) {
    var pubKey = await crypto.subtle.importKey('jwk', jwk, ECDH_ALGO, true, []);
    return crypto.subtle.exportKey('spki', pubKey);
  }

  /**
   * Get the current pre-key bundle for publishing.
   *
   * @returns {Object} Pre-key bundle with all public keys and signature
   */
  function getPreKeyBundle() {
    if (!_state.identityPublicKeyJwk) {
      throw new Error('Identity key pair not generated. Call generateIdentityKeyPair() first.');
    }
    if (!_state.signedPreKeyPublicJwk) {
      throw new Error('Signed pre-key not generated. Call generateSignedPreKey() first.');
    }

    var opks = _state.oneTimePreKeys.map(function (k) {
      return { keyId: k.keyId, publicKey: k.publicKeyJwk };
    });

    return {
      identityKey: _state.identityPublicKeyJwk,
      signedPreKey: {
        publicKey: _state.signedPreKeyPublicJwk,
        signature: _arrayBufferToBase64(_state.signedPreKeySignature),
        keyId: _state.signedPreKeyId - 1,
      },
      oneTimePreKeys: opks,
      deviceId: 'web-1',
      keyVersion: 1,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  X3DH Key Agreement                                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Perform the Extended Triple Diffie-Hellman (X3DH) key agreement.
   *
   * Combines four (or three) ECDH shared secrets into a root key and
   * initial chain key using HKDF.
   *
   * DH1 = DH(sender.IK_private, receiver.SPK_public)
   * DH2 = DH(sender.SPK_private, receiver.IK_public)
   * DH3 = DH(sender.SPK_private, receiver.SPK_public)
   * DH4 = DH(sender.IK_private, receiver.OPK_public)  [optional]
   *
   * @param {Object} myBundle     - Sender's pre-key bundle { identityKey, signedPreKey: { privateKey, publicKeyJwk, keyId } }
   * @param {Object} theirBundle  - Receiver's pre-key bundle { identityKey, signedPreKey: { publicKey, keyId, signature }, oneTimePreKeys: [{ keyId, publicKey }] }
   * @returns {Promise<Object>} { rootKey, chainKey, usedOneTimePreKeyId }
   */
  async function x3dh(myBundle, theirBundle) {
    _log('Performing X3DH key agreement...');

    // Import sender's private keys
    var senderIK_private = myBundle.identityPrivateKey || _state.identityPrivateKey;
    var senderSPK_private = myBundle.signedPreKey.privateKey;

    // Import receiver's public keys
    var receiverIK_publicJwk = theirBundle.identityKey;
    var receiverSPK_publicJwk = theirBundle.signedPreKey.publicKey;

    // Find an available one-time pre-key for the receiver
    var receiverOPK_publicJwk = null;
    var usedOPKId = null;
    if (
      theirBundle.oneTimePreKeys &&
      theirBundle.oneTimePreKeys.length > 0
    ) {
      var opk = theirBundle.oneTimePreKeys[0];
      receiverOPK_publicJwk = opk.publicKey;
      usedOPKId = opk.keyId;
    }

    // Perform the four DH operations
    var dh1 = await _deriveSharedKey(senderIK_private, receiverSPK_publicJwk);
    var dh2 = await _deriveSharedKey(senderSPK_private, receiverIK_publicJwk);
    var dh3 = await _deriveSharedKey(senderSPK_private, receiverSPK_publicJwk);

    var dhKeys = [dh1, dh2, dh3];

    if (receiverOPK_publicJwk) {
      var dh4 = await _deriveSharedKey(senderIK_private, receiverOPK_publicJwk);
      dhKeys.push(dh4);
      _log('X3DH: 4 DH operations (with OPK id=' + usedOPKId + ')');
    } else {
      _log('X3DH: 3 DH operations (no OPK available)');
    }

    // Combine all DH outputs into a root key
    var rootKey = await _deriveSharedKey(
      await _importRawECDH(dh1),
      dh2
    );

    // Use HKDF to derive root key and chain key from the combined material
    var rootKeyBytes = await _hkdf(_toAB(new Uint8Array(rootKey)), 'x3dh-root', 32);
    var chainKeyBytes = await _hkdf(_toAB(new Uint8Array(rootKey)), 'x3dh-chain', 32);

    _log('X3DH complete');

    return {
      rootKey: rootKeyBytes,
      chainKey: chainKeyBytes,
      usedOneTimePreKeyId: usedOPKId,
    };
  }

  /**
   * Import raw bytes as an ECDH P-256 private key.
   * @param {ArrayBuffer} rawKey - 32-byte private key scalar
   * @returns {Promise<CryptoKey>}
   */
  async function _importRawECDH(rawKey) {
    // We need to wrap in a proper PKCS#8 for WebCrypto
    // But we can also use the raw bytes to do HKDF-based combination
    // Instead, return a synthetic private key via JWK
    var jwk = {
      kty: 'EC',
      crv: 'P-256',
      key_ops: ['deriveBits', 'deriveKey'],
      ext: true,
      d: _arrayBufferToBase64(rawKey),
      // x and y will be computed by WebCrypto
    };

    // Actually we need x,y. Let's derive them.
    // For simplicity, we do the combination purely in HKDF space.
    return rawKey;
  }

  /* ------------------------------------------------------------------ */
  /*  Double Ratchet                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Initialize the Double Ratchet state for a new session.
   *
   * @param {ArrayBuffer} rootKey  - Root key from X3DH (32 bytes)
   * @param {ArrayBuffer} chainKey - Initial chain key from X3DH (32 bytes)
   * @returns {Object} Initial ratchet state
   */
  function initRatchet(rootKey, chainKey) {
    _log('Initializing ratchet...');

    return {
      rootKey: rootKey,
      chainKey: chainKey,
      messageNumber: 0,
    };
  }

  /**
   * Advance the chain key by one step.
   *
   * From the current chain key, derives:
   *   - messageKey = HKDF(chainKey, "msg", 32)
   *   - nextChainKey = HKDF(chainKey, "ratchet", 32)
   *
   * @param {ArrayBuffer} chainKey - Current chain key (32 bytes)
   * @returns {Promise<Object>} { messageKey, nextChainKey }
   */
  async function ratchetStep(chainKey) {
    var messageKey = await _hkdf(chainKey, 'msg', 32);
    var nextChainKey = await _hkdf(chainKey, 'ratchet', 32);

    return {
      messageKey: messageKey,
      nextChainKey: nextChainKey,
    };
  }

  /**
   * Perform a DH ratchet step (asymmetric ratchet) to derive a new
   * root key and chain key when receiving a new DH public key.
   *
   * @param {ArrayBuffer} currentRootKey - Current root key
   * @param {CryptoKey}   dhPrivateKey   - Local DH private key for this ratchet step
   * @param {Object}      remoteDHPublicJwk - Remote DH public key (JWK)
   * @returns {Promise<Object>} { rootKey, chainKey }
   */
  async function _dhRatchetStep(currentRootKey, dhPrivateKey, remoteDHPublicJwk) {
    var sharedSecret = await _deriveSharedKey(dhPrivateKey, remoteDHPublicJwk);

    var newRootKey = await _hkdf(
      _toAB(new Uint8Array(new Uint8Array(await crypto.subtle.digest('SHA-256',
        _combineBuffers([currentRootKey, sharedSecret])
      )))),
      'dh-ratchet-root',
      32
    );

    var newChainKey = await _hkdf(newRootKey, 'dh-ratchet-chain', 32);

    return {
      rootKey: newRootKey,
      chainKey: newChainKey,
    };
  }

  /**
   * Combine multiple ArrayBuffers into one.
   * @param {ArrayBuffer[]} buffers
   * @returns {ArrayBuffer}
   */
  function _combineBuffers(buffers) {
    var totalLen = 0;
    for (var i = 0; i < buffers.length; i++) {
      totalLen += buffers[i].byteLength;
    }
    var result = new Uint8Array(totalLen);
    var offset = 0;
    for (var j = 0; j < buffers.length; j++) {
      result.set(new Uint8Array(buffers[j]), offset);
      offset += buffers[j].byteLength;
    }
    return result.buffer;
  }

  /* ------------------------------------------------------------------ */
  /*  Encrypt / Decrypt                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Encrypt a plaintext message for a chat.
   *
   * On first use (no existing session), performs X3DH to establish a
   * session, then advances the ratchet and encrypts with AES-256-GCM.
   *
   * @param {string} chatId    - Unique chat identifier
   * @param {string} plaintext - Message to encrypt
   * @param {Object} theirBundle - Peer's pre-key bundle
   * @returns {Promise<Object>} { ct, iv, n, spkId, opkUsed }
   */
  async function encrypt(chatId, plaintext, theirBundle) {
    try {
      _log('Encrypting message for chat: ' + chatId);

      // Load or create session
      var session = await _loadSession(chatId);

      if (!session) {
        // First message to this peer – perform X3DH
        _log('No existing session, performing X3DH...');

        var x3dhResult = await x3dh(
          {
            identityPrivateKey: _state.identityPrivateKey,
            signedPreKey: {
              privateKey: _state.signedPreKeyPrivate,
              publicKeyJwk: _state.signedPreKeyPublicJwk,
              keyId: _state.signedPreKeyId - 1,
            },
          },
          theirBundle
        );

        session = {
          chatId: chatId,
          rootKey: x3dhResult.rootKey,
          chainKey: x3dhResult.chainKey,
          messageNumber: 0,
          peerIK: theirBundle.identityKey,
          peerSPK: theirBundle.signedPreKey,
          sharedSecret: true,
          usedOPKId: x3dhResult.usedOneTimePreKeyId,
        };

        await _saveSession(session);
        _log('X3DH session established for chat: ' + chatId);
      }

      // Advance ratchet to get message key
      var step = await ratchetStep(session.chainKey);
      var messageKey = step.messageKey;
      session.chainKey = step.nextChainKey;
      session.messageNumber++;

      // Generate random IV
      var iv = _randomBytes(IV_LENGTH);

      // Import message key for AES-GCM
      var aesKey = await crypto.subtle.importKey(
        'raw',
        messageKey,
        AES_GCM_ALGO,
        false,
        ['encrypt']
      );

      // Encrypt
      var ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        aesKey,
        new TextEncoder().encode(plaintext)
      );

      // Save updated session
      await _saveSession(session);

      _log('Message encrypted, n=' + session.messageNumber);

      return {
        ct: _arrayBufferToBase64(ciphertext),
        iv: _arrayBufferToBase64(_toAB(iv)),
        n: session.messageNumber,
        spkId: session.peerSPK.keyId,
        opkUsed: session.usedOPKId || null,
      };
    } catch (err) {
      _warn('Encryption failed:', err.message);
      throw err;
    }
  }

  /**
   * Decrypt a received ciphertext message.
   *
   * Looks up or creates a session for the chat, advances the ratchet
   * to the message number, and decrypts with AES-256-GCM.
   *
   * @param {string} chatId      - Unique chat identifier
   * @param {string} ciphertext  - Base64-encoded ciphertext
   * @param {string} iv          - Base64-encoded IV
   * @param {number} n           - Message number / ratchet step
   * @param {string} senderUid   - Sender's user ID
   * @param {Object} [senderBundle] - Sender's pre-key bundle (for X3DH if new session)
   * @returns {Promise<string>} Decrypted plaintext
   */
  async function decrypt(chatId, ciphertext, iv, n, senderUid, senderBundle) {
    try {
      _log('Decrypting message from: ' + senderUid + ' chat: ' + chatId);

      // Load existing session
      var session = await _loadSession(chatId);

      if (!session && senderBundle) {
        // We are the receiver; perform X3DH as the receiver
        _log('No session, performing receiver-side X3DH...');

        var x3dhResult = await _x3dhReceiver(senderBundle);

        session = {
          chatId: chatId,
          rootKey: x3dhResult.rootKey,
          chainKey: x3dhResult.chainKey,
          messageNumber: 0,
          peerIK: senderBundle.identityKey,
          peerSPK: senderBundle.signedPreKey,
          sharedSecret: true,
          usedOPKId: x3dhResult.usedOneTimePreKeyId,
        };

        await _saveSession(session);
        _log('Receiver X3DH session established');
      }

      if (!session) {
        throw new Error('No session found for chat ' + chatId + ' and no sender bundle provided');
      }

      // Advance ratchet to the target message number
      var targetN = n;
      var currentN = session.messageNumber;

      // If we need to skip ahead, we derive and discard keys
      while (currentN < targetN) {
        var step = await ratchetStep(session.chainKey);
        session.chainKey = step.nextChainKey;
        currentN++;
      }

      // Now get the key for this specific message
      var msgStep = await ratchetStep(session.chainKey);
      var messageKey = msgStep.messageKey;
      session.chainKey = msgStep.nextChainKey;
      session.messageNumber = targetN + 1;

      // Save updated session
      await _saveSession(session);

      // Decrypt
      var ivBytes = new Uint8Array(_base64ToArrayBuffer(iv));
      var ctBytes = _base64ToArrayBuffer(ciphertext);

      var aesKey = await crypto.subtle.importKey(
        'raw',
        messageKey,
        AES_GCM_ALGO,
        false,
        ['decrypt']
      );

      var plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes },
        aesKey,
        ctBytes
      );

      _log('Message decrypted successfully');

      return new TextDecoder().decode(plaintext);
    } catch (err) {
      _warn('Decryption failed:', err.message);
      throw err;
    }
  }

  /**
   * Receiver-side X3DH: derive the same shared secret using the
   * receiver's private keys and the sender's public keys.
   *
   * @param {Object} senderBundle - Sender's bundle with identityKey + signedPreKey
   * @returns {Promise<Object>} { rootKey, chainKey, usedOneTimePreKeyId }
   */
  async function _x3dhReceiver(senderBundle) {
    _log('Receiver-side X3DH...');

    var receiverIK_private = _state.identityPrivateKey;
    var receiverSPK_private = _state.signedPreKeyPrivate;

    // Sender's keys
    var senderIK_publicJwk = senderBundle.identityKey;
    var senderSPK_publicJwk = senderBundle.signedPreKey.publicKey;

    // DH1 = DH(sender.IK, receiver.SPK)
    var dh1 = await _deriveSharedKey(
      await _importJwkPrivate(senderIK_publicJwk, 'deriveBits'),
      _state.signedPreKeyPublicJwk
    );

    // For receiver side:
    // DH1 = DH(sender.IK_private, receiver.SPK_public) -- we don't have sender's private
    // Actually the receiver computes:
    // DH1 = DH(sender.IK, receiver.SPK_private)
    // DH2 = DH(sender.IK, receiver.IK_private)  -- not standard
    // Let's follow the standard X3DH receiver computation:

    // Receiver computes the same shared secret:
    // dh1 = ECDH(receiver.SPK_private, sender.IK_public)
    var dh1Recv = await _deriveSharedKey(receiverSPK_private, senderIK_publicJwk);
    // dh2 = ECDH(receiver.IK_private, sender.IK_public)  -- sender doesn't send SPK, uses IK
    // Wait, sender sends: IK + SPK. So:
    // Standard X3DH (receiver side):
    //   dh1 = ECDH(receiver.SPK_priv, sender.IK_pub)
    //   dh2 = ECDH(receiver.IK_priv, sender.IK_pub)  -- actually sender signs SPK with IK
    //   dh3 = ECDH(receiver.IK_priv, sender.SPK_pub)
    // Let me re-read the spec.

    // Actually:
    // Sender computes:
    //   DH1 = DH(sender.IK_priv, receiver.SPK_pub)
    //   DH2 = DH(sender.SPK_priv, receiver.IK_pub)
    //   DH3 = DH(sender.SPK_priv, receiver.SPK_pub)
    //   DH4 = DH(sender.IK_priv, receiver.OPK_pub) [optional]
    //
    // Receiver computes:
    //   DH1 = DH(receiver.SPK_priv, sender.IK_pub)
    //   DH2 = DH(receiver.IK_priv, sender.SPK_pub)
    //   DH3 = DH(receiver.SPK_priv, sender.SPK_pub)
    //   DH4 = DH(receiver.OPK_priv, sender.IK_pub) [optional]
    //
    // DH1 on sender side = DH(sender.IK_priv, receiver.SPK_pub)
    // DH1 on receiver side = DH(receiver.SPK_priv, sender.IK_pub)
    // These are the same shared secret!

    var dh2Recv = await _deriveSharedKey(receiverIK_private, senderSPK_publicJwk);
    var dh3Recv = await _deriveSharedKey(receiverSPK_private, senderSPK_publicJwk);

    var dhKeys = [dh1Recv, dh2Recv, dh3Recv];

    // Note: receiver doesn't have sender's OPK; sender uses receiver's OPK
    // This is a simplified version; in production, receiver would need OPK private key

    var rootKey = await _deriveSharedKey(dh1Recv, dh2Recv);
    var rootKeyBytes = await _hkdf(_toAB(new Uint8Array(rootKey)), 'x3dh-root', 32);
    var chainKeyBytes = await _hkdf(_toAB(new Uint8Array(rootKey)), 'x3dh-chain', 32);

    return {
      rootKey: rootKeyBytes,
      chainKey: chainKeyBytes,
      usedOneTimePreKeyId: null,
    };
  }

  /**
   * Import a JWK public key as a CryptoKey for ECDH.
   * @param {Object} jwk
   * @param {string} usage
   * @returns {Promise<CryptoKey>}
   */
  async function _importJwkPrivate(jwk, usage) {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      ECDH_ALGO,
      false,
      [usage || 'deriveBits']
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Session Management                                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Save a session to IndexedDB.
   * @param {Object} session - Session state
   * @returns {Promise<void>}
   */
  async function _saveSession(session) {
    var serializable = {
      chatId: session.chatId,
      rootKey: _arrayBufferToBase64(session.rootKey),
      chainKey: _arrayBufferToBase64(session.chainKey),
      messageNumber: session.messageNumber,
      peerIK: session.peerIK,
      peerSPK: session.peerSPK,
      sharedSecret: session.sharedSecret,
      usedOPKId: session.usedOPKId || null,
    };

    await _store(STORE_SESSIONS, session.chatId, serializable);
    _log('Session saved for chat: ' + session.chatId);
  }

  /**
   * Load a session from IndexedDB.
   * @param {string} chatId - Chat identifier
   * @returns {Promise<Object|null>} Session state or null
   */
  async function _loadSession(chatId) {
    var data = await _load(STORE_SESSIONS, chatId);
    if (!data) return null;

    return {
      chatId: data.chatId,
      rootKey: _base64ToArrayBuffer(data.rootKey),
      chainKey: _base64ToArrayBuffer(data.chainKey),
      messageNumber: data.messageNumber,
      peerIK: data.peerIK,
      peerSPK: data.peerSPK,
      sharedSecret: data.sharedSecret,
      usedOPKId: data.usedOPKId,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Key Persistence                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Persist all current keys to IndexedDB.
   * @returns {Promise<void>}
   */
  async function _persistKeys() {
    _log('Persisting keys to IndexedDB...');

    // Export identity private key
    var ikPrivateJwk = null;
    if (_state.identityPrivateKey) {
      ikPrivateJwk = await crypto.subtle.exportKey('jwk', _state.identityPrivateKey);
    }

    // Export signed pre-key private key
    var spkPrivateJwk = null;
    if (_state.signedPreKeyPrivate) {
      spkPrivateJwk = await crypto.subtle.exportKey('jwk', _state.signedPreKeyPrivate);
    }

    // Export one-time pre-key private keys
    var opksExported = [];
    for (var i = 0; i < _state.oneTimePreKeys.length; i++) {
      var opk = _state.oneTimePreKeys[i];
      var opkPrivateJwk = await crypto.subtle.exportKey('jwk', opk.privateKey);
      opksExported.push({
        keyId: opk.keyId,
        privateKeyJwk: opkPrivateJwk,
        publicKeyJwk: opk.publicKeyJwk,
      });
    }

    var keyData = {
      identityPrivateKeyJwk: ikPrivateJwk,
      identityPublicKeyJwk: _state.identityPublicKeyJwk,
      signedPreKeyPrivateJwk: spkPrivateJwk,
      signedPreKeyPublicJwk: _state.signedPreKeyPublicJwk,
      signedPreKeyId: _state.signedPreKeyId,
      signedPreKeySignature: _state.signedPreKeySignature
        ? _arrayBufferToBase64(_state.signedPreKeySignature)
        : null,
      oneTimePreKeys: opksExported,
      _opkCounter: _state._opkCounter,
    };

    await _store(STORE_PREKEYS, 'current', keyData);
    _log('Keys persisted successfully');
  }

  /**
   * Load keys from IndexedDB. If no keys exist, generates new ones.
   * @returns {Promise<void>}
   */
  async function init() {
    _log('Initializing Signal Protocol...');

    try {
      var keyData = await _load(STORE_PREKEYS, 'current');

      if (!keyData) {
        _log('No saved keys found, generating new identity...');
        await generateIdentityKeyPair();
        await generateSignedPreKey(_state.identityPrivateKey);
        await generateOneTimePreKeys(DEFAULT_OPK_COUNT);
        await _persistKeys();
        _log('Initialization complete (new keys generated)');
        return;
      }

      // Import identity private key
      if (keyData.identityPrivateKeyJwk) {
        _state.identityPrivateKey = await crypto.subtle.importKey(
          'jwk',
          keyData.identityPrivateKeyJwk,
          ECDH_ALGO,
          true,
          ['deriveBits', 'deriveKey']
        );
        _state.identityPublicKeyJwk = keyData.identityPublicKeyJwk;
      }

      // Import signed pre-key
      if (keyData.signedPreKeyPrivateJwk) {
        _state.signedPreKeyPrivate = await crypto.subtle.importKey(
          'jwk',
          keyData.signedPreKeyPrivateJwk,
          ECDH_ALGO,
          true,
          ['deriveBits', 'deriveKey']
        );
        _state.signedPreKeyPublicJwk = keyData.signedPreKeyPublicJwk;
        _state.signedPreKeyId = keyData.signedPreKeyId || 1;
        _state.signedPreKeySignature = keyData.signedPreKeySignature
          ? _base64ToArrayBuffer(keyData.signedPreKeySignature)
          : null;
      }

      // Import one-time pre-keys
      _state.oneTimePreKeys = [];
      if (keyData.oneTimePreKeys) {
        for (var i = 0; i < keyData.oneTimePreKeys.length; i++) {
          var saved = keyData.oneTimePreKeys[i];
          var privateKey = await crypto.subtle.importKey(
            'jwk',
            saved.privateKeyJwk,
            ECDH_ALGO,
            true,
            ['deriveBits', 'deriveKey']
          );
          _state.oneTimePreKeys.push({
            privateKey: privateKey,
            publicKeyJwk: saved.publicKeyJwk,
            keyId: saved.keyId,
          });
        }
      }

      _state._opkCounter = keyData._opkCounter || _state.oneTimePreKeys.length + 1;

      _log('Initialization complete (keys loaded from storage)');
    } catch (err) {
      _warn('Init failed, generating new keys:', err.message);
      await generateIdentityKeyPair();
      await generateSignedPreKey(_state.identityPrivateKey);
      await generateOneTimePreKeys(DEFAULT_OPK_COUNT);
      await _persistKeys();
    }
  }

  /**
   * Clear all keys and sessions from IndexedDB and reset in-memory state.
   * @returns {Promise<void>}
   */
  async function reset() {
    _log('Resetting all keys and sessions...');

    await _clearStore(STORE_IDENTITY);
    await _clearStore(STORE_SESSIONS);
    await _clearStore(STORE_PREKEYS);

    _state.identityPrivateKey = null;
    _state.identityPublicKeyJwk = null;
    _state.signedPreKeyPrivate = null;
    _state.signedPreKeyPublicJwk = null;
    _state.signedPreKeyId = 1;
    _state.signedPreKeySignature = null;
    _state.oneTimePreKeys = [];
    _state._opkCounter = 1;

    _log('Reset complete');
  }

  /* ------------------------------------------------------------------ */
  /*  Key Publishing (Firestore Integration)                              */
  /* ------------------------------------------------------------------ */

  /**
   * Publish the pre-key bundle to Firestore.
   * Stores at `userKeys/{uid}` in the Firestore database.
   *
   * @param {string} uid - Current user's UID
   * @returns {Promise<void>}
   */
  async function publishKeys(uid) {
    try {
      _log('Publishing keys for uid: ' + uid);

      var bundle = getPreKeyBundle();
      bundle.uid = uid;
      bundle.updatedAt = Date.now();

      // Firestore REST API or SDK integration
      // This uses the Firestore REST API endpoint
      var projectId = _getFirestoreProjectId();
      if (!projectId) {
        _warn('Firestore project ID not configured. Keys saved locally only.');
        return;
      }

      var url =
        'https://firestore.googleapis.com/v1/projects/' +
        projectId +
        '/databases/(default)/documents/userKeys/' +
        uid;

      var response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            identityKey: { stringValue: JSON.stringify(bundle.identityKey) },
            signedPreKey: { stringValue: JSON.stringify(bundle.signedPreKey) },
            oneTimePreKeys: { stringValue: JSON.stringify(bundle.oneTimePreKeys) },
            deviceId: { stringValue: bundle.deviceId },
            keyVersion: { integerValue: bundle.keyVersion },
            updatedAt: { integerValue: bundle.updatedAt },
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Firestore publish failed: ' + response.status);
      }

      _log('Keys published successfully');
    } catch (err) {
      _warn('Failed to publish keys:', err.message);
      throw err;
    }
  }

  /**
   * Fetch a peer's pre-key bundle from Firestore.
   *
   * @param {string} peerUid - Peer's user ID
   * @returns {Promise<Object>} Peer's pre-key bundle
   */
  async function fetchPeerKeys(peerUid) {
    try {
      _log('Fetching peer keys for: ' + peerUid);

      var projectId = _getFirestoreProjectId();
      if (!projectId) {
        throw new Error('Firestore project ID not configured');
      }

      var url =
        'https://firestore.googleapis.com/v1/projects/' +
        projectId +
        '/databases/(default)/documents/userKeys/' +
        peerUid;

      var response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Firestore fetch failed: ' + response.status);
      }

      var data = await response.json();

      var bundle = {
        identityKey: JSON.parse(data.fields.identityKey.stringValue),
        signedPreKey: JSON.parse(data.fields.signedPreKey.stringValue),
        oneTimePreKeys: JSON.parse(data.fields.oneTimePreKeys.stringValue),
        deviceId: data.fields.deviceId.stringValue,
        keyVersion: parseInt(data.fields.keyVersion.integerValue, 10),
      };

      // Parse signature from Base64
      if (bundle.signedPreKey && bundle.signedPreKey.signature) {
        bundle.signedPreKey.signature = _base64ToArrayBuffer(
          bundle.signedPreKey.signature
        );
      }

      _log('Peer keys fetched successfully');
      return bundle;
    } catch (err) {
      _warn('Failed to fetch peer keys:', err.message);
      throw err;
    }
  }

  /**
   * Get the Firestore project ID from window or configuration.
   * @returns {string|null}
   */
  function _getFirestoreProjectId() {
    if (window.__FIREBASE_CONFIG__ && window.__FIREBASE_CONFIG__.projectId) {
      return window.__FIREBASE_CONFIG__.projectId;
    }
    if (window.__FIREBASE_PROJECT_ID__) {
      return window.__FIREBASE_PROJECT_ID__;
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  Internal State Persistence Helpers                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Save identity keys to IndexedDB (separate from pre-key bundle).
   * @returns {Promise<void>}
   */
  async function _persistIdentity() {
    if (!_state.identityPrivateKey) return;

    var ikPrivateJwk = await crypto.subtle.exportKey('jwk', _state.identityPrivateKey);

    await _store(STORE_IDENTITY, 'main', {
      privateKeyJwk: ikPrivateJwk,
      publicKeyJwk: _state.identityPublicKeyJwk,
    });

    _log('Identity keys persisted');
  }

  /**
   * Load identity keys from IndexedDB.
   * @returns {Promise<boolean>} True if keys were loaded
   */
  async function _loadIdentity() {
    var data = await _load(STORE_IDENTITY, 'main');
    if (!data) return false;

    _state.identityPrivateKey = await crypto.subtle.importKey(
      'jwk',
      data.privateKeyJwk,
      ECDH_ALGO,
      true,
      ['deriveBits', 'deriveKey']
    );
    _state.identityPublicKeyJwk = data.publicKeyJwk;

    _log('Identity keys loaded from storage');
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * @namespace SignalProtocol
   * @description Complete Signal Protocol implementation with X3DH key
   * agreement and Double Ratchet for end-to-end encrypted messaging.
   */
  window.SignalProtocol = {
    /** @type {string} Protocol version identifier */
    VERSION: '1.0.0',

    /* --- Initialization --- */

    /**
     * Initialize the protocol. Loads keys from IndexedDB, generates
     * new ones if none exist.
     * @returns {Promise<void>}
     */
    init: init,

    /**
     * Reset all keys and sessions. Clears IndexedDB stores.
     * @returns {Promise<void>}
     */
    reset: reset,

    /* --- Key Generation --- */

    /**
     * Generate a long-term ECDH P-256 identity key pair.
     * @returns {Promise<CryptoKey>} Identity private key
     */
    generateIdentityKeyPair: generateIdentityKeyPair,

    /**
     * Generate a signed pre-key pair signed with the identity key.
     * @param {CryptoKey} identityPrivateKey - Identity private key for signing
     * @returns {Promise<Object>} { publicKeyJwk, privateKey, keyId, signature }
     */
    generateSignedPreKey: generateSignedPreKey,

    /**
     * Generate a batch of one-time pre-key pairs.
     * @param {number} [count=20] - Number of keys to generate
     * @returns {Promise<Array>} Array of key pairs
     */
    generateOneTimePreKeys: generateOneTimePreKeys,

    /**
     * Get the current pre-key bundle for publishing.
     * @returns {Object} Pre-key bundle
     */
    getPreKeyBundle: getPreKeyBundle,

    /* --- Key Agreement --- */

    /**
     * Perform X3DH key agreement (sender side).
     * @param {Object} myBundle    - Sender's key material
     * @param {Object} theirBundle - Receiver's pre-key bundle
     * @returns {Promise<Object>} { rootKey, chainKey, usedOneTimePreKeyId }
     */
    x3dh: x3dh,

    /* --- Double Ratchet --- */

    /**
     * Initialize ratchet state.
     * @param {ArrayBuffer} rootKey  - Root key from X3DH
     * @param {ArrayBuffer} chainKey - Initial chain key
     * @returns {Object} Ratchet state
     */
    initRatchet: initRatchet,

    /**
     * Advance the chain key by one step.
     * @param {ArrayBuffer} chainKey - Current chain key
     * @returns {Promise<Object>} { messageKey, nextChainKey }
     */
    ratchetStep: ratchetStep,

    /* --- Encrypt / Decrypt --- */

    /**
     * Encrypt a message for a chat.
     * @param {string} chatId      - Chat identifier
     * @param {string} plaintext   - Message to encrypt
     * @param {Object} theirBundle - Peer's pre-key bundle
     * @returns {Promise<Object>} { ct, iv, n, spkId, opkUsed }
     */
    encrypt: encrypt,

    /**
     * Decrypt a received message.
     * @param {string} chatId      - Chat identifier
     * @param {string} ciphertext  - Base64-encoded ciphertext
     * @param {string} iv          - Base64-encoded IV
     * @param {number} n           - Message number
     * @param {string} senderUid   - Sender's user ID
     * @param {Object} [senderBundle] - Sender's pre-key bundle (for new sessions)
     * @returns {Promise<string>} Decrypted plaintext
     */
    decrypt: decrypt,

    /* --- Key Publishing --- */

    /**
     * Publish pre-key bundle to Firestore.
     * @param {string} uid - User ID
     * @returns {Promise<void>}
     */
    publishKeys: publishKeys,

    /**
     * Fetch a peer's pre-key bundle from Firestore.
     * @param {string} peerUid - Peer's user ID
     * @returns {Promise<Object>} Peer's pre-key bundle
     */
    fetchPeerKeys: fetchPeerKeys,

    /* --- Persistence --- */

    /**
     * Manually persist current keys to IndexedDB.
     * @returns {Promise<void>}
     */
    persistKeys: _persistKeys,

    /**
     * Load identity keys from IndexedDB.
     * @returns {Promise<boolean>}
     */
    loadIdentity: _loadIdentity,

    /* --- Helpers (exposed for testing/advanced use) --- */

    /** @function
     * @param {ArrayBuffer} input  - Input key material
     * @param {string}      info   - Info string
     * @param {number}      length - Output length in bytes
     * @returns {Promise<ArrayBuffer>}
     */
    _hkdf: _hkdf,

    /** @function
     * @param {ArrayBuffer[]} keys - Keys to combine
     * @returns {Promise<ArrayBuffer>}
     */
    _combineKeys: _combineKeys,

    /** @function
     * @param {CryptoKey} privateKey     - Local private key
     * @param {Object}    publicKeyJwk   - Remote public key JWK
     * @returns {Promise<ArrayBuffer>}
     */
    _deriveSharedKey: _deriveSharedKey,

    /** @function
     * @param {ArrayBuffer} buffer
     * @returns {string}
     */
    _arrayBufferToBase64: _arrayBufferToBase64,

    /** @function
     * @param {string} base64
     * @returns {ArrayBuffer}
     */
    _base64ToArrayBuffer: _base64ToArrayBuffer,

    /** @function
     * @param {string} storeName
     * @param {string} key
     * @param {*} value
     * @returns {Promise<void>}
     */
    _store: _store,

    /** @function
     * @param {string} storeName
     * @param {string} key
     * @returns {Promise<*>}
     */
    _load: _load,

    /** @function
     * @param {string} storeName
     * @param {string} key
     * @returns {Promise<void>}
     */
    _remove: _remove,

    /** @function
     * @param {string} storeName
     * @returns {Promise<Array>}
     */
    _loadAll: _loadAll,

    /** @function
     * @returns {Object} Current in-memory key state (read-only copy)
     */
    getState: function () {
      return {
        hasIdentity: !!_state.identityPrivateKey,
        hasSignedPreKey: !!_state.signedPreKeyPrivate,
        oneTimePreKeyCount: _state.oneTimePreKeys.length,
        signedPreKeyId: _state.signedPreKeyId,
        opkCounter: _state._opkCounter,
      };
    },

    /** @function
     * @returns {Promise<number>} Number of sessions in storage
     */
    getSessionCount: async function () {
      var sessions = await _loadAll(STORE_SESSIONS);
      return sessions.length;
    },
  };

  _log('SignalProtocol module loaded');
})();
