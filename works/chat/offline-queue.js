/* ============================================================
   OFFLINE QUEUE â€” IndexedDB-backed message retry queue
   Stores failed messages, retries on reconnect, shows status
   v1.1: Added attachment blob upload before retry, pending
          message count indicator in UI
   ============================================================ */
'use strict';

const OfflineQueue = {
  _db: null,
  _dbName: 'tcOfflineQueue',
  _storeName: 'pendingMessages',
  _maxRetries: 5,
  _retryDelay: 2000,
  _processing: false,
  _pendingProcess: false,
  _processTimeout: null,
  _lockTimeout: 30000,

  /** Initialize the IndexedDB-backed queue and begin processing on reconnect. */
  async init() {
    try {
      this._db = await this._openDB();
      if (window.__DEBUG__) console.log('[OfflineQueue] Initialized, pending:', await this.getCount());
      this._setupListeners();
      this._emitStatus();
      setTimeout(() => this.processQueue(), 5000);
    } catch (e) {
      if (window.__DEBUG__) console.warn('[OfflineQueue] Init failed:', e);
    }
  },

  _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this._dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this._storeName)) {
          const store = db.createObjectStore(this._storeName, { keyPath: 'id', autoIncrement: true });
          store.createIndex('chatId', 'chatId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  _setupListeners() {
    window.addEventListener('online', () => this.processQueue());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.processQueue();
    });
    if (typeof window._onNetworkChange === 'undefined') {
      window._onNetworkChange = () => this.processQueue();
    }
  },

  /**
   * Add a failed message to the retry queue.
   * @param {Object} message - The message to enqueue
   * @param {string} message.chatId - Target chat identifier
   * @param {string} message.chatType - 'direct' or 'group'
   * @param {string} message.text - Message body text
   * @param {Array}  [message.attachments] - Attachment objects with url/blobUrl/name/type
   * @param {string|null} [message.replyTo] - ID of message being replied to
   * @param {string} [message.tempId] - Client-generated temporary ID
   * @returns {Promise<Object|null>} The stored record, or null on failure
   */
  async enqueue(message) {
    if (!this._db) return null;
    const record = {
      chatId: message.chatId || '',
      chatType: message.chatType || 'direct',
      text: message.text || '',
      attachments: message.attachments || [],
      replyTo: message.replyTo || null,
      tempId: message.tempId || 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      status: 'pending',
      retries: 0,
      createdAt: Date.now(),
      lastRetryAt: null,
      error: null
    };
    try {
      const tx = this._db.transaction(this._storeName, 'readwrite');
      const id = await new Promise((resolve, reject) => {
        const req = tx.objectStore(this._storeName).add(record);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      record.id = id;
      if (window.__DEBUG__) console.log('[OfflineQueue] Enqueued message:', record.tempId);
      this._emitStatus();
      return record;
    } catch (e) {
      if (window.__DEBUG__) console.warn('[OfflineQueue] Enqueue failed:', e);
      return null;
    }
  },

  /** Retry all pending messages that are within the retry limit. */
  async processQueue() {
    if (this._processing) {
      this._pendingProcess = true;
      return;
    }
    if (!this._db || !navigator.onLine) return;
    this._processing = true;
    this._pendingProcess = false;
    clearTimeout(this._processTimeout);
    this._processTimeout = setTimeout(() => {
      if (this._processing) {
        if (window.__DEBUG__) console.warn('[OfflineQueue] Lock timeout - force releasing');
        this._processing = false;
        if (this._pendingProcess) this.processQueue();
      }
    }, this._lockTimeout);
    try {
      const pending = await this._getByStatus('pending');
      for (const msg of pending) {
        if (!navigator.onLine) break;
        if (msg.retries >= this._maxRetries) {
          await this.updateStatus(msg.id, 'failed');
          this._showFailedToast(msg);
          continue;
        }
        try {
          await this._retrySend(msg);
          await this.updateStatus(msg.id, 'sent');
          if (typeof window.showToast === 'function') {
            window.showToast('Message sent', 'success');
          }
        } catch (e) {
          msg.retries++;
          msg.lastRetryAt = Date.now();
          msg.error = e.message || String(e);
          await this._updateRecord(msg);
          if (window.__DEBUG__) console.warn(`[OfflineQueue] Retry ${msg.retries}/${this._maxRetries} failed:`, e.message);
          if (msg.retries < this._maxRetries) {
            await new Promise(r => setTimeout(r, this._retryDelay * msg.retries));
          }
        }
      }
    } catch (e) {
      if (window.__DEBUG__) console.warn('[OfflineQueue] Process queue error:', e);
    } finally {
      clearTimeout(this._processTimeout);
      this._processTimeout = null;
      this._processing = false;
      this._emitStatus();
      if (this._pendingProcess) {
        this._pendingProcess = false;
        setTimeout(() => this.processQueue(), 500);
      }
    }
  },

  async _retrySend(msg) {
    const processedAttachments = [];
    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        if (att.blobUrl) {
          try {
            const response = await fetch(att.blobUrl);
            const blob = await response.blob();
            const file = new File([blob], att.name || 'upload', { type: att.type || blob.type });
            const uploadedUrl = await this._uploadToCloudinary(file);
            processedAttachments.push({ url: uploadedUrl, name: att.name, type: att.type, size: att.size });
          } catch (e) {
            if (window.__DEBUG__) console.warn('[OfflineQueue] Attachment upload failed:', e);
            throw new Error(`Failed to upload attachment: ${att.name}`);
          }
        } else if (att.url) {
          processedAttachments.push(att);
        }
      }
    }

    if (typeof window._sendMessageToChat === 'function') {
      await window._sendMessageToChat({
        chatId: msg.chatId,
        chatType: msg.chatType,
        text: msg.text,
        attachments: processedAttachments.length > 0 ? processedAttachments : msg.attachments,
        replyTo: msg.replyTo,
        tempId: msg.tempId
      });
      return;
    }
    const db = window.db || App?.db;
    const user = window.currentUser || App?.currentUser;
    if (db && user) {
      await db.collection('messages').add({
        chatId: msg.chatId,
        chatType: msg.chatType,
        text: msg.text,
        attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
        senderId: user.uid,
        senderName: user.displayName || '',
        time: Date.now(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        replyTo: msg.replyTo,
        status: 'sent'
      });
      return;
    }
    throw new Error('No send mechanism available');
  },

  async _uploadToCloudinary(file) {
    if (typeof window.uploadToFirebaseStorage === 'function') {
      return await window.uploadToFirebaseStorage(file, 'chat_uploads');
    }
    throw new Error('No upload provider available. Message attachments cannot be uploaded offline.');
  },

  async updateStatus(id, status) {
    if (!this._db) return;
    try {
      const tx = this._db.transaction(this._storeName, 'readwrite');
      const store = tx.objectStore(this._storeName);
      const req = store.get(id);
      req.onsuccess = () => {
        const rec = req.result;
        if (rec) { rec.status = status; store.put(rec); }
      };
    } catch (_) {}
  },

  async _updateRecord(record) {
    if (!this._db) return;
    const tx = this._db.transaction(this._storeName, 'readwrite');
    tx.objectStore(this._storeName).put(record);
  },

  async _getByStatus(status) {
    if (!this._db) return [];
    return new Promise((resolve) => {
      const tx = this._db.transaction(this._storeName, 'readonly');
      const idx = tx.objectStore(this._storeName).index('status');
      const req = idx.getAll(status);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  },

  /** @returns {Promise<number>} Total number of messages currently in the queue */
  async getCount() {
    if (!this._db) return 0;
    return new Promise((resolve) => {
      const tx = this._db.transaction(this._storeName, 'readonly');
      const req = tx.objectStore(this._storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  },

  /** Remove all sent and failed messages from the queue. */
  async clearSent() {
    if (!this._db) return;
    const tx = this._db.transaction(this._storeName, 'readwrite');
    const store = tx.objectStore(this._storeName);
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value.status === 'sent' || cursor.value.status === 'failed') {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  },

  _showFailedToast(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast('Message failed to send. Tap to retry.', 'error');
    }
    if (window.ErrorBoundary) {
      window.ErrorBoundary.captureMessage(`OfflineQueue: message ${msg.tempId} failed after ${this._maxRetries} retries`, 'warning');
    }
  },

  _emitStatus() {
    this.getCount().then(count => {
      document.dispatchEvent(new CustomEvent('offline-queue-change', { detail: { count } }));
      this._updatePendingIndicator(count);
    });
  },

  _updatePendingIndicator(count) {
    let indicator = document.getElementById('offline-pending-indicator');
    if (count > 0) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'offline-pending-indicator';
        indicator.setAttribute('role', 'status');
        indicator.setAttribute('aria-live', 'polite');
        indicator.className = 'glass-panel';
        indicator.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:95;display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:20px;background:rgba(30,30,46,0.9);backdrop-filter:blur(12px);color:var(--on-surface);font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.3);pointer-events:none';
        document.body.appendChild(indicator);
      }
      indicator.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;">schedule</span> ${count} message${count > 1 ? 's' : ''} pending`;
      indicator.style.display = 'flex';
    } else if (indicator) {
      indicator.style.display = 'none';
    }
  },

  destroy() {
    if (this._db) { this._db.close(); this._db = null; }
  }
};

window.OfflineQueue = OfflineQueue;
