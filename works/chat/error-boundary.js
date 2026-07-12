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

  init(sentryDsn) {
    if (this._initialized) return;
    this._initialized = true;
    this._sentryDsn = sentryDsn || null;
    this._installHandlers();
    console.log('[ErrorBoundary] Initialized');
  },

  _installHandlers() {
    var self = this;
    window.addEventListener('error', function (event) {
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
    });

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

    window.addEventListener('error', function (event) {
      if (event.target && event.target.tagName) {
        self._captureError({
          type: 'resource_error',
          message: 'Failed to load: ' + (event.target.src || event.target.href || 'unknown'),
          timestamp: Date.now()
        });
      }
    }, true);
  },

  _captureError(errorData) {
    if (!this._enabled) return;

    this._errors.push(errorData);
    if (this._errors.length > this._maxErrors) {
      this._errors.shift();
    }

    console.error(`[ErrorBoundary] ${errorData.type}:`, errorData.message, errorData.stack || '');

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
  }
};

window.ErrorBoundary = ErrorBoundary;
