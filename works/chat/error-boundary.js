/* ============================================================
   ERROR BOUNDARY & CRASH REPORTING
   Lightweight global error handler + optional Sentry integration
   ============================================================ */
'use strict';

const ErrorBoundary = {
  _errors: [],
  _maxErrors: 50,
  _sentryDsn: null,
  _enabled: true,

  _initialized: false,
  _crashUIShown: false,
  _frequencyWindow: [],
  _frequencyLimit: 10,
  _frequencyWindowMs: 60000,
  _circuits: {},

  init(sentryDsn) {
    if (this._initialized) return;
    this._initialized = true;
    this._sentryDsn = sentryDsn || null;
    this._installHandlers();
    if (window.__DEBUG__) console.log('[ErrorBoundary] Initialized');
  },

  _installHandlers() {
    var self = this;

    window.onerror = function (message, source, lineno, colno, error) {
      self._captureError({
        type: 'uncaught_error',
        message: message || 'Unknown error',
        filename: source || '',
        lineno: lineno || 0,
        colno: colno || 0,
        error: error || null,
        stack: error && error.stack || '',
        timestamp: Date.now()
      });
      if (typeof window.showToast === 'function') {
        window.showToast('An unexpected error occurred. Please try again.', 'error');
      }
      return false;
    };

    window.onunhandledrejection = function (event) {
      var reason = event.reason || {};
      self._captureError({
        type: 'unhandled_rejection',
        message: typeof reason === 'string' ? reason : (reason.message || 'Unhandled promise rejection'),
        error: reason,
        stack: reason && reason.stack || '',
        timestamp: Date.now()
      });
      if (typeof window.showToast === 'function') {
        window.showToast('A background task failed. Some features may not work correctly.', 'error');
      }
    };

    window.addEventListener('error', function (event) {
      if (event.target && event.target.tagName) {
        self._captureError({
          type: 'resource_error',
          message: 'Failed to load: ' + (event.target.src || event.target.href || 'unknown'),
          timestamp: Date.now()
        });
        return;
      }
      self._captureError({
        type: 'uncaught_error',
        message: event.message || 'Unknown error',
        filename: event.filename || '',
        lineno: event.lineno || 0,
        colno: event.colno || 0,
        error: event.error || null,
        stack: event.error && event.error.stack || '',
        timestamp: Date.now()
      });
    }, true);

    window.addEventListener('unhandledrejection', function (event) {
      var reason = event.reason || {};
      self._captureError({
        type: 'unhandled_rejection',
        message: typeof reason === 'string' ? reason : (reason.message || 'Unhandled promise rejection'),
        error: reason,
        stack: reason && reason.stack || '',
        timestamp: Date.now()
      });
    });

    window.addEventListener('offline', function () {
      self._captureError({
        type: 'connection_lost',
        message: 'Network connection lost',
        timestamp: Date.now()
      });
    });
  },

  _captureError(errorData) {
    if (!this._enabled) return;

    this._errors.push(errorData);
    if (this._errors.length > this._maxErrors) {
      this._errors.shift();
    }

    this._trackFrequency(errorData);

    if (window.__DEBUG__) console.error(`[ErrorBoundary] ${errorData.type}:`, errorData.message, errorData.stack || '');

    if (this._sentryDsn && window.Sentry) {
      try {
        const exc = errorData.error instanceof Error ? errorData.error : new Error(errorData.message);
        Sentry.withScope((scope) => {
          scope.setTag('error_type', errorData.type);
          if (errorData.filename) scope.setTag('filename', errorData.filename);
          if (errorData.lineno) scope.setTag('lineno', String(errorData.lineno));
          Sentry.captureException(exc);
        });
      } catch (_) {}
    }

    if (errorData.type === 'uncaught_error' && errorData.message.includes('Loading chunk')) {
      this._showRecoveryToast();
    }
  },

  _trackFrequency(errorData) {
    var now = Date.now();
    this._frequencyWindow.push({ timestamp: now, data: errorData });
    while (this._frequencyWindow.length > 0 &&
           this._frequencyWindow[0].timestamp < now - this._frequencyWindowMs) {
      this._frequencyWindow.shift();
    }
    if (errorData.type === 'uncaught_error' && this._frequencyWindow.length > this._frequencyLimit && !this._crashUIShown) {
      this.showCrashUI(errorData.error || new Error(errorData.message));
    }
  },

  _showRecoveryToast() {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;' +
      'background:var(--error);color:var(--on-error);padding:12px 24px;border-radius:12px;' +
      'font-size:14px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,0.3);cursor:pointer;max-width:90vw;text-align:center;';
    toast.textContent = 'Something went wrong. Tap to reload.';
    toast.setAttribute('role', 'button');
    toast.setAttribute('tabindex', '0');
    toast.onclick = () => location.reload();
    toast.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toast.click(); }
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 8000);
  },

  captureMessage(message, level) {
    this._captureError({
      type: 'capture_message',
      message: message,
      level: level || 'info',
      timestamp: Date.now()
    });
  },

  captureException(error, context) {
    this._captureError({
      type: 'capture_exception',
      message: error?.message || String(error),
      error: error,
      stack: error?.stack || '',
      context: context || {},
      timestamp: Date.now()
    });
  },

  getErrors() {
    return [...this._errors];
  },

  clearErrors() {
    this._errors = [];
  },

  /* --------------------------------------------------------
     WRAP / WRAPASYNC
     Wrap functions in try-catch with automatic error reporting
     -------------------------------------------------------- */
  wrap(fn, context) {
    var self = this;
    return function () {
      try {
        return fn.apply(this, arguments);
      } catch (err) {
        self._captureError({
          type: 'wrapped_sync_error',
          message: err.message || String(err),
          error: err,
          stack: err.stack || '',
          context: context || {},
          timestamp: Date.now()
        });
        return undefined;
      }
    };
  },

  wrapAsync(fn, context) {
    var self = this;
    return function () {
      var args = arguments;
      var ctx = this;
      return new Promise(function (resolve, reject) {
        try {
          var result = fn.apply(ctx, args);
          if (result && typeof result.then === 'function') {
            result.then(resolve)['catch'](function (err) {
              self._captureError({
                type: 'wrapped_async_error',
                message: err.message || String(err),
                error: err,
                stack: err.stack || '',
                context: context || {},
                timestamp: Date.now()
              });
              reject(err);
            });
          } else {
            resolve(result);
          }
        } catch (err) {
          self._captureError({
            type: 'wrapped_async_error',
            message: err.message || String(err),
            error: err,
            stack: err.stack || '',
            context: context || {},
            timestamp: Date.now()
          });
          reject(err);
        }
      });
    };
  },

  /* --------------------------------------------------------
     COMPONENT-LEVEL ERROR RECOVERY
     Retry with exponential backoff on failure
     -------------------------------------------------------- */
  retryWithBackoff(fn, context, opts) {
    var self = this;
    var maxRetries = (opts && opts.maxRetries) || 3;
    var baseDelay = (opts && opts.baseDelay) || 1000;

    function attempt(retryCount) {
      try {
        var result = fn();
        if (result && typeof result.then === 'function') {
          return result['catch'](function (err) {
            if (retryCount >= maxRetries) {
              self._captureError({
                type: 'recovery_failed',
                message: 'All ' + maxRetries + ' retries failed: ' + (err.message || String(err)),
                error: err,
                stack: err.stack || '',
                context: context || {},
                timestamp: Date.now()
              });
              self._showRecoveryToast();
              throw err;
            }
            self._showRetryToast(retryCount + 1, maxRetries);
            return new Promise(function (resolve) {
              setTimeout(resolve, baseDelay * Math.pow(2, retryCount));
            }).then(function () { return attempt(retryCount + 1); });
          });
        }
        return result;
      } catch (err) {
        if (retryCount >= maxRetries) {
          self._captureError({
            type: 'recovery_failed',
            message: 'All ' + maxRetries + ' retries failed: ' + (err.message || String(err)),
            error: err,
            stack: err.stack || '',
            context: context || {},
            timestamp: Date.now()
          });
          self._showRecoveryToast();
          throw err;
        }
        self._showRetryToast(retryCount + 1, maxRetries);
        return new Promise(function (resolve) {
          setTimeout(resolve, baseDelay * Math.pow(2, retryCount));
        }).then(function () { return attempt(retryCount + 1); });
      }
    }

    return attempt(0);
  },

  _showRetryToast(attempt, max) {
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;' +
      'background:#555;color:#fff;padding:10px 20px;border-radius:10px;' +
      'font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,0.25);max-width:90vw;text-align:center;';
    toast.textContent = 'Retrying... (attempt ' + attempt + ' of ' + max + ')';
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 2500);
  },

  /* --------------------------------------------------------
     CRASH UI
     Full-screen recovery overlay with Reload and Report Bug
     -------------------------------------------------------- */
  showCrashUI(error) {
    if (this._crashUIShown) return;
    this._crashUIShown = true;

    var overlay = document.createElement('div');
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#1a1a2e;color:#e0e0e0;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'font-family:system-ui,-apple-system,sans-serif;padding:24px;';

    var heading = document.createElement('h1');
    heading.style.cssText = 'font-size:24px;margin:0 0 8px;color:#ff6b6b;';
    heading.textContent = 'Something went wrong';
    overlay.appendChild(heading);

    var desc = document.createElement('p');
    desc.style.cssText = 'font-size:14px;margin:0 0 24px;color:#aaa;max-width:420px;text-align:center;';
    desc.textContent = 'The app encountered an unexpected error. You can try reloading or report the issue.';
    overlay.appendChild(desc);

    if (error) {
      var errBox = document.createElement('pre');
      errBox.style.cssText = 'background:#0d1117;color:#f85149;padding:12px 16px;border-radius:8px;' +
        'font-size:12px;max-width:420px;width:100%;overflow:auto;max-height:120px;margin:0 0 24px;' +
        'word-break:break-word;white-space:pre-wrap;';
      errBox.textContent = (error.stack || error.message || String(error)).substring(0, 500);
      overlay.appendChild(errBox);
    }

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;';

    var reloadBtn = document.createElement('button');
    reloadBtn.textContent = 'Reload App';
    reloadBtn.style.cssText = 'padding:12px 28px;border:none;border-radius:10px;background:#4361ee;' +
      'color:#fff;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(67,97,238,0.4);';
    reloadBtn.onclick = function () { location.reload(); };
    btnRow.appendChild(reloadBtn);

    var reportBtn = document.createElement('button');
    reportBtn.textContent = 'Report Bug';
    reportBtn.style.cssText = 'padding:12px 28px;border:2px solid #555;border-radius:10px;background:transparent;' +
      'color:#ccc;font-size:15px;font-weight:600;cursor:pointer;';
    reportBtn.onclick = function () {
      var exported = ErrorBoundary.exportErrors();
      var blob = new Blob([exported], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'error-report-' + Date.now() + '.json';
      a.click();
      URL.revokeObjectURL(url);
    };
    btnRow.appendChild(reportBtn);

    overlay.appendChild(btnRow);
    document.body.appendChild(overlay);
  },

  /* --------------------------------------------------------
     ERROR FREQUENCY / RECENT ERRORS
     -------------------------------------------------------- */
  getRecentErrors(count) {
    var n = count || 10;
    return this._errors.slice(-n).map(function (e) {
      return {
        type: e.type,
        message: e.message,
        timestamp: e.timestamp,
        context: e.context || null,
        stack: e.stack || ''
      };
    });
  },

  /* --------------------------------------------------------
     EXPORT ERRORS
     Returns JSON string of all errors for support hand-off
     -------------------------------------------------------- */
  exportErrors() {
    var payload = {
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: location.href,
      errorCount: this._errors.length,
      errors: this._errors.map(function (e) {
        return {
          type: e.type,
          message: e.message,
          filename: e.filename || '',
          lineno: e.lineno || 0,
          colno: e.colno || 0,
          context: e.context || null,
          stack: e.stack || '',
          timestamp: e.timestamp,
          timestampISO: new Date(e.timestamp).toISOString()
        };
      })
    };
    return JSON.stringify(payload, null, 2);
  },

  /* --------------------------------------------------------
     CIRCUIT BREAKER
     Prevents cascading failures by opening the circuit
     after repeated failures.

     States: CLOSED (normal) | OPEN (blocking) | HALF_OPEN (testing)

     Options:
       threshold    - failures before opening (default: 5)
       resetTimeout - ms before OPEN -> HALF_OPEN (default: 30000)
       timeout      - ms per call before considered failed (default: 10000)
     -------------------------------------------------------- */
  circuitBreak(name, fn, opts) {
    var self = this;
    var options = opts || {};
    var threshold = options.threshold || 5;
    var resetTimeout = options.resetTimeout || 30000;
    var timeout = options.timeout || 10000;

    if (!this._circuits[name]) {
      this._circuits[name] = {
        state: 'CLOSED',
        failures: 0,
        lastFailure: 0,
        halfOpenPending: false
      };
    }

    var circuit = this._circuits[name];

    return function () {
      if (circuit.state === 'OPEN') {
        if (Date.now() - circuit.lastFailure >= resetTimeout) {
          circuit.state = 'HALF_OPEN';
          circuit.halfOpenPending = false;
        } else {
          self._captureError({
            type: 'circuit_open',
            message: 'Circuit "' + name + '" is OPEN, call rejected',
            context: { circuit: name },
            timestamp: Date.now()
          });
          return Promise.reject(new Error('Circuit "' + name + '" is open'));
        }
      }

      if (circuit.state === 'HALF_OPEN' && circuit.halfOpenPending) {
        return Promise.reject(new Error('Circuit "' + name + '" half-open test in progress'));
      }

      if (circuit.state === 'HALF_OPEN') {
        circuit.halfOpenPending = true;
      }

      var timedOut = false;
      var timer = setTimeout(function () {
        timedOut = true;
      }, timeout);

      try {
        var result = fn.apply(this, arguments);

        if (result && typeof result.then === 'function') {
          return new Promise(function (resolve, reject) {
            result.then(function (val) {
              if (timedOut) return;
              clearTimeout(timer);
              circuit.failures = 0;
              circuit.state = 'CLOSED';
              circuit.halfOpenPending = false;
              resolve(val);
            })['catch'](function (err) {
              if (timedOut) {
                reject(new Error('Circuit "' + name + '" call timed out'));
                return;
              }
              clearTimeout(timer);
              circuit.failures++;
              circuit.lastFailure = Date.now();
              if (circuit.failures >= threshold) {
                circuit.state = 'OPEN';
              }
              circuit.halfOpenPending = false;
              reject(err);
            });

            setTimeout(function () {
              if (timedOut) {
                circuit.failures++;
                circuit.lastFailure = Date.now();
                if (circuit.failures >= threshold) {
                  circuit.state = 'OPEN';
                }
                circuit.halfOpenPending = false;
                reject(new Error('Circuit "' + name + '" call timed out'));
              }
            }, timeout + 50);
          });
        }

        clearTimeout(timer);
        circuit.failures = 0;
        circuit.state = 'CLOSED';
        circuit.halfOpenPending = false;
        return result;
      } catch (err) {
        clearTimeout(timer);
        circuit.failures++;
        circuit.lastFailure = Date.now();
        if (circuit.failures >= threshold) {
          circuit.state = 'OPEN';
        }
        circuit.halfOpenPending = false;
        throw err;
      }
    };
  },

  getCircuitState(name) {
    var c = this._circuits[name];
    return c ? { state: c.state, failures: c.failures } : null;
  },

  resetCircuit(name) {
    if (this._circuits[name]) {
      this._circuits[name] = { state: 'CLOSED', failures: 0, lastFailure: 0, halfOpenPending: false };
    }
  },

  /* --------------------------------------------------------
     FIREBASE ERROR RECOVERY
     Retry Firestore reads on network errors, graceful offline
     -------------------------------------------------------- */
  _isNetworkError(err) {
    if (!err) return false;
    var code = err.code || '';
    return code === 'unavailable' || code === 'deadline-exceeded' ||
           code === 'resource-exhausted' || code === 'internal' ||
           (err.message && (err.message.includes('network') || err.message.includes('offline') ||
            err.message.includes('failed') || err.message.includes('unavailable')));
  },

  _isOfflineError(err) {
    if (!err) return false;
    var code = err.code || '';
    return code === 'unavailable' ||
           (err.message && err.message.includes('offline'));
  },

  firebaseReadWithRetry(ref, context, opts) {
    var self = this;
    var maxRetries = (opts && opts.maxRetries) || 3;
    var baseDelay = (opts && opts.baseDelay) || 1000;

    function attempt(retryCount) {
      return ref.get().then(function (snap) {
        return snap;
      })['catch'](function (err) {
        if (self._isOfflineError(err) && !navigator.onLine) {
          self._captureError({
            type: 'firebase_offline',
            message: 'Firestore read skipped — offline',
            context: { collection: context || 'unknown' },
            timestamp: Date.now()
          });
          return { docs: [], exists: false, empty: true, size: 0, data: function () { return null; } };
        }
        if (retryCount >= maxRetries || !self._isNetworkError(err)) {
          self._captureError({
            type: 'firebase_read_error',
            message: 'Firestore read failed after ' + (retryCount + 1) + ' attempts: ' + (err.message || String(err)),
            error: err,
            stack: err.stack || '',
            context: { collection: context || 'unknown' },
            timestamp: Date.now()
          });
          throw err;
        }
        if (typeof window.showToast === 'function') {
          window.showToast('Connection issue. Retrying...', 'info');
        }
        return new Promise(function (resolve) {
          setTimeout(resolve, baseDelay * Math.pow(2, retryCount));
        }).then(function () { return attempt(retryCount + 1); });
      });
    }

    return attempt(0);
  },

  firebaseWriteWithRetry(writeFn, context) {
    var self = this;
    return writeFn()['catch'](function (err) {
      if (self._isOfflineError(err) && !navigator.onLine) {
        self._captureError({
          type: 'firebase_write_offline',
          message: 'Firestore write queued — offline',
          context: { collection: context || 'unknown' },
          timestamp: Date.now()
        });
        if (!self._pendingWrites) self._pendingWrites = [];
        self._pendingWrites.push({ writeFn: writeFn, context: context, timestamp: Date.now() });
        document.dispatchEvent(new CustomEvent('offline-queue-change', { detail: { count: self._pendingWrites.length } }));
        if (typeof window.showToast === 'function') window.showToast('Write queued — will retry when online', 'info');
        var onOnline = function onlineHandler() {
          window.removeEventListener('online', onOnline);
          if (!self._pendingWrites || self._pendingWrites.length === 0) return;
          var pending = self._pendingWrites.slice();
          self._pendingWrites = [];
          pending.forEach(function(entry) {
            entry.writeFn()['catch'](function(retryErr) {
              if (window.__DEBUG__) console.warn('[ErrorBoundary] Retry write failed:', retryErr);
            });
          });
        };
        window.addEventListener('online', onOnline);
        return;
      }
      self._captureError({
        type: 'firebase_write_error',
        message: 'Firestore write failed: ' + (err.message || String(err)),
        error: err,
        stack: err.stack || '',
        context: { collection: context || 'unknown' },
        timestamp: Date.now()
      });
      throw err;
    });
  },

  safeOnSnapshot(ref, onNext, context, opts) {
    var self = this;
    var maxRetries = (opts && opts.maxRetries) || 5;
    var baseDelay = (opts && opts.baseDelay) || 2000;
    var currentUnsub = null;
    var cancelled = false;
    var retryToken = 0;

    function subscribe(retryCount) {
      if (cancelled) return function () {};
      var unsub = ref.onSnapshot(
        function (snap) {
          if (cancelled) return;
          onNext(snap);
        },
        function (err) {
          if (cancelled) return;
          if (self._isOfflineError(err) && !navigator.onLine) {
            if (typeof window.showToast === 'function') {
              window.showToast('You are offline. Waiting for connection...', 'info');
            }
            self._captureError({
              type: 'onsnapshot_offline',
              message: 'onSnapshot paused — offline',
              context: { collection: context || 'unknown' },
              timestamp: Date.now()
            });
            var token = ++retryToken;
            var reconnectHandler = function () {
              window.removeEventListener('online', reconnectHandler);
              if (cancelled || token !== retryToken) return;
              if (currentUnsub) { currentUnsub(); currentUnsub = null; }
              setTimeout(function () {
                if (cancelled || token !== retryToken) return;
                subscribe(0);
              }, 1500);
            };
            window.addEventListener('online', reconnectHandler);
            return;
          }
          self._captureError({
            type: 'onsnapshot_error',
            message: 'onSnapshot error: ' + (err.message || String(err)),
            error: err,
            stack: err.stack || '',
            context: { collection: context || 'unknown', attempt: retryCount + 1 },
            timestamp: Date.now()
          });
          if (retryCount < maxRetries) {
            var delay = baseDelay * Math.pow(2, retryCount);
            if (typeof window.showToast === 'function') {
              window.showToast('Reconnecting to updates...', 'info');
            }
            token = ++retryToken;
            if (currentUnsub) { currentUnsub(); currentUnsub = null; }
            setTimeout(function () {
              if (cancelled || token !== retryToken) return;
              subscribe(retryCount + 1);
            }, delay);
          } else {
            if (typeof window.showToast === 'function') {
              window.showToast('Lost connection to updates. Please refresh.', 'error');
            }
          }
        }
      );
      currentUnsub = unsub;
      return unsub;
    }

    var initialUnsub = subscribe(0);
    return function () {
      cancelled = true;
      retryToken++;
      if (currentUnsub) { currentUnsub(); currentUnsub = null; }
      initialUnsub();
    };
  }
};

window.ErrorBoundary = ErrorBoundary;
