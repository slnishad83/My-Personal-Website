'use strict';

module.exports = function () {
  var mockStore = {};
  var nextId = 1;

  function createMockRequest(result) {
    var req = { result: result };
    Promise.resolve().then(function () {
      if (req.onsuccess) req.onsuccess();
    });
    return req;
  }

  function createMockObjectStore() {
    return {
      add: function (record) {
        var id = nextId++;
        mockStore[id] = record;
        record.id = id;
        return createMockRequest(id);
      },
      get: function (id) {
        return createMockRequest(mockStore[id]);
      },
      count: function () {
        return createMockRequest(Object.keys(mockStore).length);
      },
      put: function (record) {
        if (record && record.id) mockStore[record.id] = record;
        return createMockRequest(record ? record.id : undefined);
      },
      index: function () {
        return {
          getAll: function (query) {
            var results = Object.values(mockStore).filter(function (r) {
              return r.status === query;
            });
            return createMockRequest(results);
          }
        };
      },
      openCursor: function () {
        var values = Object.values(mockStore);
        var idx = 0;
        var req = {};
        function fireSuccess() {
          if (idx < values.length) {
            var v = values[idx];
            req.result = {
              value: v,
              delete: function () { delete mockStore[v.id]; },
              continue: function () { idx++; Promise.resolve().then(fireSuccess); }
            };
          } else {
            req.result = null;
          }
          if (req.onsuccess) req.onsuccess({ target: req });
        }
        Promise.resolve().then(fireSuccess);
        return req;
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
      return {
        objectStore: function () { return store; }
      };
    }
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
    showToast: function () {},
    _onNetworkChange: undefined
  };
  global.document = {
    addEventListener: function () {},
    dispatchEvent: function () {},
    getElementById: function () { return null; },
    createElement: function () {
      return { style: {}, setAttribute: function () {}, appendChild: function () {} };
    },
    body: { appendChild: function () {} }
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

  delete require.cache[require.resolve('../offline-queue.js')];
  require('../offline-queue.js');

  var Q = window.OfflineQueue;
  var ready = Q.init();

  describe('OfflineQueue.enqueue()', function () {
    it('initializes and enqueues with correct fields', async function () {
      await ready;
      var record = await Q.enqueue({ chatId: 'chat1', text: 'hello' });
      expect(record).toBeDefined();
      expect(record.chatId).toBe('chat1');
      expect(record.text).toBe('hello');
      expect(record.status).toBe('pending');
      expect(record.retries).toBe(0);
    });
  });

  describe('OfflineQueue.getCount()', function () {
    it('returns correct count after enqueue', async function () {
      await ready;
      var count = await Q.getCount();
      expect(count).toBe(1);
    });
  });

  describe('OfflineQueue.processQueue()', function () {
    it('skips when offline', async function () {
      await ready;
      navigator.onLine = false;
      var record = await Q.enqueue({ chatId: 'c2', text: 'msg' });
      await Q.processQueue();
      await new Promise(function (r) { setTimeout(r, 10); });
      expect(mockStore[record.id].status).toBe('pending');
      navigator.onLine = true;
    });

    it('skips when already processing', async function () {
      await ready;
      Q._processing = true;
      await Q.processQueue();
      expect(Q._processing).toBe(true);
      Q._processing = false;
    });
  });

  describe('OfflineQueue._getByStatus()', function () {
    it('returns only pending messages', async function () {
      await ready;
      var record = await Q.enqueue({ chatId: 'c3', text: 'a' });
      mockStore[record.id].status = 'sent';
      var pending = await Q._getByStatus('pending');
      var sent = await Q._getByStatus('sent');
      var pendingTexts = pending.map(function (m) { return m.text; });
      expect(pendingTexts.indexOf('msg') !== -1).toBe(true);
      expect(sent.length > 0).toBe(true);
      expect(sent[0].text).toBe('a');
    });
  });

  describe('OfflineQueue.updateStatus()', function () {
    it('changes status correctly', async function () {
      await ready;
      var record = await Q.enqueue({ chatId: 'c4', text: 'b' });
      await Q.updateStatus(record.id, 'failed');
      await new Promise(function (r) { setTimeout(r, 10); });
      expect(mockStore[record.id].status).toBe('failed');
    });
  });

  describe('OfflineQueue maxRetries', function () {
    it('marks message as failed when retries >= maxRetries', async function () {
      await ready;
      Q._retryDelay = 0;
      var record = await Q.enqueue({ chatId: 'c5', text: 'retry' });
      mockStore[record.id].retries = 6;
      navigator.onLine = true;
      Q._processing = false;
      await Q.processQueue();
      await new Promise(function (r) { setTimeout(r, 10); });
      expect(mockStore[record.id].status).toBe('failed');
    });
  });
};
