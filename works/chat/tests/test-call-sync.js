'use strict';

module.exports = function () {
  var mockStore = {};
  var nextId = 1;
  var writes = [];

  function createMockRequest(result) {
    var req = { result: result };
    Promise.resolve().then(function () {
      if (req.onsuccess) req.onsuccess({ target: req });
    });
    return req;
  }

  function createMockObjectStore() {
    return {
      add: function (record) {
        var id = nextId++;
        mockStore[id] = record;
        record.queueId = id;
        return createMockRequest(id);
      },
      put: function (record) {
        mockStore[record.queueId] = record;
        return createMockRequest(record.queueId);
      },
      delete: function (id) {
        delete mockStore[id];
        return createMockRequest(undefined);
      },
      index: function () {
        return {
          getAll: function (query) {
            return createMockRequest(Object.values(mockStore).filter(function (item) {
              return item.queueStatus === query;
            }));
          }
        };
      }
    };
  }

  var mockDB = {
    objectStoreNames: { contains: function () { return false; } },
    createObjectStore: function () {
      return { createIndex: function () {} };
    },
    transaction: function () {
      var store = createMockObjectStore();
      return { objectStore: function () { return store; } };
    },
    close: function () {}
  };

  global.indexedDB = {
    open: function () {
      var req = { result: mockDB };
      Promise.resolve().then(function () {
        if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: mockDB } });
        if (req.onsuccess) req.onsuccess({ target: { result: mockDB } });
      });
      return req;
    }
  };

  global.window = {
    addEventListener: function () {},
    currentUser: { uid: 'user-1', displayName: 'Tester' },
    Platform: { os: 'web', browser: 'test' },
    MultiDevice: { getCurrentSessionId: function () { return 'session-1'; } },
    db: {
      collection: function () {
        return {
          doc: function () {
            return {
              collection: function () {
                return {
                  orderBy: function () { return this; },
                  limit: function () { return this; },
                  onSnapshot: function () { return function () {}; },
                  doc: function () {
                    return {
                      set: function (payload) {
                        writes.push(payload);
                        return Promise.resolve();
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }
    }
  };
  global.document = {
    readyState: 'loading',
    addEventListener: function () {},
    dispatchEvent: function () {},
    visibilityState: 'visible'
  };
  Object.defineProperty(global, 'navigator', {
    value: { onLine: true },
    writable: true,
    configurable: true
  });
  global.CustomEvent = function (type, opts) {
    this.type = type;
    this.detail = opts && opts.detail;
  };
  global.localStorage = {
    _data: {},
    getItem: function (key) { return this._data[key] || null; },
    setItem: function (key, value) { this._data[key] = String(value); }
  };
  global.firebase = {
    firestore: {
      FieldValue: {
        serverTimestamp: function () { return 'server-time'; }
      }
    }
  };

  delete require.cache[require.resolve('../call-sync.js')];
  require('../call-sync.js');
  var CallSync = window.CallSync;
  var ready = CallSync.init();

  describe('CallSync', function () {
    it('writes, queues, and replays call events', async function () {
      await ready;
      var event = await CallSync.record({
        callId: 'call-1',
        direction: 'outgoing',
        status: 'dialled',
        toUserId: 'user-2',
        callType: 'video'
      });

      expect(event.callId).toBe('call-1');
      expect(event.direction).toBe('outgoing');
      expect(event.status).toBe('dialled');
      expect(event.deviceId).toBe('session-1');
      expect(event.participantIds).toContain('user-1');
      expect(event.participantIds).toContain('user-2');
      expect(writes.length).toBe(1);
      expect(writes[0].updatedAt).toBe('server-time');

      var originalDb = window.db;
      window.db = null;
      CallSync._db = null;
      var event = await CallSync.record({
        callId: 'call-2',
        direction: 'incoming',
        status: 'missed',
        fromUserId: 'user-3'
      });

      expect(event.status).toBe('missed');
      expect(Object.values(mockStore).length).toBe(1);
      expect(Object.values(mockStore)[0].status).toBe('missed');
      expect(Object.values(mockStore)[0].queueStatus).toBe('pending');
      window.db = originalDb;
      CallSync._db = originalDb;

      await CallSync.enqueue({
        callId: 'call-queued',
        direction: 'outgoing',
        status: 'dialled',
        callType: 'voice',
        participantIds: ['user-1', 'user-4'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      await CallSync.processQueue();
      await new Promise(function (r) { setTimeout(r, 10); });
      expect(writes.some(function (item) { return item.callId === 'call-queued'; })).toBe(true);
      expect(writes.some(function (item) { return item.callId === 'call-2' && item.status === 'missed'; })).toBe(true);
    });
  });
};
