/* ============================================================
   CALL SYNC - Cross-device call history and status persistence
   Keeps incoming, outgoing, missed, recently dialled, and status
   events synced through Firestore with an IndexedDB retry queue.
   ============================================================ */
'use strict';

(function () {
  const CallSync = {
    _db: null,
    _idb: null,
    _dbName: 'tcCallSyncQueue',
    _storeName: 'pendingCallEvents',
    _unsubscribe: null,
    _processing: false,
    _maxRetries: 6,

    async init() {
      try {
        this._db = window.db || null;
        this._idb = await this._openDB();
        this._setupListeners();
        this._startForCurrentUser();
        setTimeout(() => this.processQueue(), 1500);
      } catch (e) {
        console.warn('[CallSync] Init failed:', e);
      }
    },

    _openDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(this._dbName, 1);
        req.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(this._storeName)) {
            const store = db.createObjectStore(this._storeName, { keyPath: 'queueId', autoIncrement: true });
            store.createIndex('queueStatus', 'queueStatus', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
            store.createIndex('callId', 'callId', { unique: false });
          }
        };
        req.onsuccess = (event) => resolve(event.target.result);
        req.onerror = (event) => reject(event.target.error);
      });
    },

    _setupListeners() {
      window.addEventListener('online', () => this.processQueue());
      window.addEventListener('focus', () => {
        this._startForCurrentUser();
        this.processQueue();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this._startForCurrentUser();
          this.processQueue();
        }
      });
      document.addEventListener('tc:call-sync', (event) => {
        this.record(event.detail || {});
      });
    },

    _startForCurrentUser() {
      const user = window.currentUser;
      const db = window.db || this._db;
      if (!user || !db || this._unsubscribe) return;
      this._db = db;
      this._listenToCallEvents();
    },

    _listenToCallEvents() {
      const user = window.currentUser;
      if (!user || !this._db) return;
      try {
        this._unsubscribe = this._db.collection('users').doc(user.uid)
          .collection('callEvents')
          .orderBy('updatedAt', 'desc')
          .limit(150)
          .onSnapshot((snap) => {
            const calls = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            this._cacheCallHistory(calls);
            document.dispatchEvent(new CustomEvent('tc:call-history:sync', { detail: { calls } }));
          }, (err) => {
            console.warn('[CallSync] Listener failed:', err);
            this._unsubscribe = null;
          });
      } catch (e) {
        console.warn('[CallSync] Could not start listener:', e);
      }
    },

    _cacheCallHistory(calls) {
      try {
        localStorage.setItem('tcCallHistory', JSON.stringify({
          syncedAt: Date.now(),
          calls: calls.slice(0, 150)
        }));
      } catch (_) {}
    },

    getCachedCallHistory() {
      try {
        const cached = JSON.parse(localStorage.getItem('tcCallHistory') || '{}');
        return Array.isArray(cached.calls) ? cached.calls : [];
      } catch (_) {
        return [];
      }
    },

    async record(input) {
      const event = this._normalizeEvent(input);
      if (!event) return null;
      try {
        await this._writeEvent(event);
        return event;
      } catch (e) {
        await this.enqueue(event, e);
        return event;
      }
    },

    _normalizeEvent(input) {
      if (!input || typeof input !== 'object') return null;
      const user = window.currentUser || {};
      const now = Date.now();
      const direction = this._clean(input.direction || input.type || 'status');
      const callId = this._clean(input.callId || input.id || `call_${now}_${Math.random().toString(36).slice(2, 8)}`);
      const status = this._clean(input.status || direction);
      const participantIds = Array.isArray(input.participantIds) ? input.participantIds.filter(Boolean) : [];
      if (input.fromUserId && !participantIds.includes(input.fromUserId)) participantIds.push(input.fromUserId);
      if (input.toUserId && !participantIds.includes(input.toUserId)) participantIds.push(input.toUserId);
      if (user.uid && !participantIds.includes(user.uid)) participantIds.push(user.uid);

      return {
        callId,
        direction,
        status,
        callType: this._clean(input.callType || input.mediaType || 'voice'),
        participantIds,
        fromUserId: this._clean(input.fromUserId || input.callerId || ''),
        fromUserName: this._clean(input.fromUserName || input.callerName || ''),
        toUserId: this._clean(input.toUserId || input.receiverId || ''),
        toUserName: this._clean(input.toUserName || input.receiverName || ''),
        deviceId: this._clean(input.deviceId || window.MultiDevice?.getCurrentSessionId?.() || ''),
        platform: this._clean(input.platform || window.Platform?.os || 'web'),
        browser: this._clean(input.browser || window.Platform?.browser || ''),
        startedAt: Number(input.startedAt || input.time || now),
        endedAt: input.endedAt ? Number(input.endedAt) : null,
        durationMs: input.durationMs == null ? null : Number(input.durationMs),
        readBy: input.readBy && typeof input.readBy === 'object' ? input.readBy : {},
        metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
        createdAt: now,
        updatedAt: now
      };
    },

    _clean(value) {
      return String(value == null ? '' : value).slice(0, 200);
    },

    async _writeEvent(event) {
      const user = window.currentUser;
      const db = window.db || this._db;
      if (!user || !db) throw new Error('No authenticated Firestore session');
      const payload = {
        ...event,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('users').doc(user.uid)
        .collection('callEvents').doc(event.callId).set(payload, { merge: true });
    },

    async enqueue(event, error) {
      if (!this._idb) return null;
      const record = {
        ...event,
        queueStatus: 'pending',
        retries: 0,
        createdAt: Date.now(),
        lastRetryAt: null,
        error: error?.message || String(error || '')
      };
      return new Promise((resolve) => {
        const tx = this._idb.transaction(this._storeName, 'readwrite');
        const req = tx.objectStore(this._storeName).add(record);
        req.onsuccess = () => {
          record.queueId = req.result;
          this._emitQueueChange();
          resolve(record);
        };
        req.onerror = () => resolve(null);
      });
    },

    async processQueue() {
      if (this._processing || !this._idb || !navigator.onLine) return;
      this._processing = true;
      try {
        const pending = await this._getPending();
        for (const item of pending) {
          if (item.retries >= this._maxRetries) {
            await this._updateQueuedItem({ ...item, queueStatus: 'failed' });
            continue;
          }
          try {
            await this._writeEvent(item);
            await this._deleteQueuedItem(item.queueId);
          } catch (e) {
            await this._updateQueuedItem({
              ...item,
              retries: (item.retries || 0) + 1,
              lastRetryAt: Date.now(),
              error: e.message || String(e)
            });
          }
        }
      } finally {
        this._processing = false;
        this._emitQueueChange();
      }
    },

    _getPending() {
      return new Promise((resolve) => {
        const tx = this._idb.transaction(this._storeName, 'readonly');
        const req = tx.objectStore(this._storeName).index('queueStatus').getAll('pending');
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    },

    _updateQueuedItem(item) {
      return new Promise((resolve) => {
        const tx = this._idb.transaction(this._storeName, 'readwrite');
        const req = tx.objectStore(this._storeName).put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    },

    _deleteQueuedItem(queueId) {
      return new Promise((resolve) => {
        const tx = this._idb.transaction(this._storeName, 'readwrite');
        const req = tx.objectStore(this._storeName).delete(queueId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    },

    _emitQueueChange() {
      document.dispatchEvent(new CustomEvent('tc:call-sync-queue-change'));
    },

    destroy() {
      if (this._unsubscribe) {
        try { this._unsubscribe(); } catch (_) {}
        this._unsubscribe = null;
      }
      if (this._idb) {
        this._idb.close();
        this._idb = null;
      }
    }
  };

  window.CallSync = CallSync;
  window.recordCallSyncEvent = (event) => CallSync.record(event);

  if (document.readyState === 'complete') {
    setTimeout(() => CallSync.init(), 0);
  } else {
    window.addEventListener('load', () => setTimeout(() => CallSync.init(), 0));
  }
})();
