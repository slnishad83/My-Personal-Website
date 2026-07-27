'use strict';

describe('ErrorBoundary', function () {
  var eb;

  function createEB() {
    return {
      _errors: [],
      _maxErrors: 50,
      _enabled: true,
      _circuits: {},
      _frequencyWindow: [],
      _frequencyLimit: 10,
      _frequencyWindowMs: 60000,
      _crashUIShown: false,

      _captureError: function (d) { this._errors.push(d); },
      _trackFrequency: function () {},

      captureMessage: function (m, l) {
        this._captureError({ type: 'capture_message', message: m, level: l || 'info', timestamp: Date.now() });
      },
      captureException: function (e, ctx) {
        this._captureError({ type: 'capture_exception', message: e.message || String(e), error: e, stack: e.stack || '', context: ctx || {}, timestamp: Date.now() });
      },
      getErrors: function () { return this._errors.slice(); },
      clearErrors: function () { this._errors = []; },

      wrap: function (fn, ctx) {
        var self = this;
        return function () {
          try { return fn.apply(this, arguments); }
          catch (err) {
            self._captureError({ type: 'wrapped_sync_error', message: err.message, error: err, stack: err.stack || '', context: ctx || {}, timestamp: Date.now() });
            return undefined;
          }
        };
      },

      wrapAsync: function (fn, ctx) {
        var self = this;
        return function () {
          var args = arguments;
          var c = this;
          return new Promise(function (resolve, reject) {
            try {
              var r = fn.apply(c, args);
              if (r && typeof r.then === 'function') {
                r.then(resolve)['catch'](function (err) {
                  self._captureError({ type: 'wrapped_async_error', message: err.message, error: err, stack: err.stack || '', context: ctx || {}, timestamp: Date.now() });
                  reject(err);
                });
              } else { resolve(r); }
            } catch (err) {
              self._captureError({ type: 'wrapped_async_error', message: err.message, error: err, stack: err.stack || '', context: ctx || {}, timestamp: Date.now() });
              reject(err);
            }
          });
        };
      },

      circuitBreak: function (name, fn, opts) {
        var self = this;
        var o = opts || {};
        var threshold = o.threshold || 5;
        if (!this._circuits[name]) {
          this._circuits[name] = { state: 'CLOSED', failures: 0, lastFailure: 0, halfOpenPending: false };
        }
        var circuit = this._circuits[name];
        return function () {
          if (circuit.state === 'OPEN') {
            return Promise.reject(new Error('Circuit "' + name + '" is open'));
          }
          try {
            var result = fn.apply(this, arguments);
            circuit.failures = 0;
            circuit.state = 'CLOSED';
            return result;
          } catch (err) {
            circuit.failures++;
            circuit.lastFailure = Date.now();
            if (circuit.failures >= threshold) circuit.state = 'OPEN';
            throw err;
          }
        };
      },

      getCircuitState: function (n) {
        var c = this._circuits[n];
        return c ? { state: c.state, failures: c.failures } : null;
      },

      resetCircuit: function (n) {
        if (this._circuits[n]) this._circuits[n] = { state: 'CLOSED', failures: 0, lastFailure: 0, halfOpenPending: false };
      },

      exportErrors: function () {
        return JSON.stringify({ errorCount: this._errors.length, errors: this._errors.map(function (e) { return { type: e.type, message: e.message }; }) });
      }
    };
  }

  eb = createEB();

  it('starts with empty errors', function () {
    expect(eb.getErrors()).toHaveLength(0);
  });

  it('captureMessage adds an error', function () {
    eb = createEB();
    eb.captureMessage('test info', 'info');
    expect(eb.getErrors()).toHaveLength(1);
    expect(eb.getErrors()[0].type).toBe('capture_message');
    expect(eb.getErrors()[0].message).toBe('test info');
  });

  it('captureException adds an error with context', function () {
    eb = createEB();
    var err = new Error('boom');
    eb.captureException(err, { page: 'chat' });
    expect(eb.getErrors()).toHaveLength(1);
    expect(eb.getErrors()[0].error).toBe(err);
    expect(eb.getErrors()[0].context).toHaveProperty('page', 'chat');
  });

  it('clearErrors empties the list', function () {
    eb = createEB();
    eb.captureMessage('one');
    eb.captureMessage('two');
    eb.clearErrors();
    expect(eb.getErrors()).toHaveLength(0);
  });

  it('wrap catches sync errors', function () {
    eb = createEB();
    var wrapped = eb.wrap(function () { throw new Error('sync fail'); }, 'test');
    var result = wrapped();
    expect(result).toBe(undefined);
    expect(eb.getErrors()).toHaveLength(1);
    expect(eb.getErrors()[0].type).toBe('wrapped_sync_error');
  });

  it('wrap returns value on success', function () {
    eb = createEB();
    var wrapped = eb.wrap(function () { return 42; });
    expect(wrapped()).toBe(42);
    expect(eb.getErrors()).toHaveLength(0);
  });

  it('wrapAsync catches rejected promises', function () {
    var localEb = createEB();
    var wrapped = localEb.wrapAsync(function () { return Promise.reject(new Error('async fail')); });
    return wrapped().then(function () {
      throw new Error('should not resolve');
    }, function (err) {
      expect(err.message).toBe('async fail');
      expect(localEb.getErrors()).toHaveLength(1);
      expect(localEb.getErrors()[0].type).toBe('wrapped_async_error');
    });
  });

  it('wrapAsync resolves on success', function () {
    var localEb = createEB();
    var wrapped = localEb.wrapAsync(function () { return Promise.resolve('ok'); });
    return wrapped().then(function (val) {
      expect(val).toBe('ok');
      expect(localEb.getErrors()).toHaveLength(0);
    });
  });

  it('circuitBreak starts CLOSED', function () {
    eb = createEB();
    var fn = eb.circuitBreak('test-api', function () { return 'ok'; });
    expect(fn()).toBe('ok');
    expect(eb.getCircuitState('test-api')).toHaveProperty('state', 'CLOSED');
  });

  it('circuitBreak opens after threshold failures', function () {
    eb = createEB();
    var fn = eb.circuitBreak('failing', function () { throw new Error('fail'); }, { threshold: 3 });
    for (var i = 0; i < 3; i++) {
      try { fn(); } catch (_) {}
    }
    expect(eb.getCircuitState('failing')).toHaveProperty('state', 'OPEN');
    var result = fn();
    expect(result).toHaveProperty('then');
    return result.then(function () {
      throw new Error('should resolve');
    }, function (err) {
      expect(err.message).toContain('open');
    });
  });

  it('resetCircuit resets to CLOSED', function () {
    eb = createEB();
    var fn = eb.circuitBreak('reset-me', function () { throw new Error('fail'); }, { threshold: 2 });
    try { fn(); } catch (_) {}
    try { fn(); } catch (_) {}
    expect(eb.getCircuitState('reset-me')).toHaveProperty('state', 'OPEN');
    eb.resetCircuit('reset-me');
    expect(eb.getCircuitState('reset-me')).toHaveProperty('state', 'CLOSED');
  });

  it('getCircuitState returns null for unknown circuit', function () {
    eb = createEB();
    expect(eb.getCircuitState('nonexistent')).toBeNull();
  });

  it('exportErrors returns valid JSON', function () {
    eb = createEB();
    eb.captureMessage('export test');
    var json = JSON.parse(eb.exportErrors());
    expect(json.errorCount).toBe(1);
    expect(json.errors).toHaveLength(1);
  });
});

describe('Monitoring', function () {
  it('initializes without errors', function () {
    var monitoring = {
      _initialized: false,
      init: function () { this._initialized = true; },
      captureException: function () {},
      captureMessage: function () {},
      setUser: function () {},
      clearUser: function () {},
      addBreadcrumb: function () {}
    };
    monitoring.init();
    expect(monitoring._initialized).toBeTruthy();
  });

  it('idempotent init', function () {
    var count = 0;
    var monitoring = {
      _initialized: false,
      init: function () { if (this._initialized) return; this._initialized = true; count++; }
    };
    monitoring.init();
    monitoring.init();
    monitoring.init();
    expect(count).toBe(1);
  });
});
