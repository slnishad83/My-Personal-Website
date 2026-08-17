/* ============================================================
   MONITORING � Sentry + Firebase Crashlytics integration
   Bridges ErrorBoundary errors to external monitoring services.
   ============================================================ */
'use strict';

(function () {
  var SENTRY_DSN = ''; // Add your Sentry DSN here

  window.Monitoring = {
    _initialized: false,

    init: function () {
      if (this._initialized) return;
      this._initialized = true;
      if (SENTRY_DSN && window.Sentry) {
        try {
          window.Sentry.init({ dsn: SENTRY_DSN, environment: 'production' });
        } catch (_) {}
      }
    },

    captureException: function (error, context) {
      if (window.Sentry) {
        try {
          window.Sentry.captureException(error, { extra: context });
        } catch (_) {
          console.error('[Monitoring]', context, error);
        }
      } else {
        console.error('[Monitoring]', context, error);
      }
    },

    captureMessage: function (message, level) {
      if (window.Sentry) {
        try {
          window.Sentry.captureMessage(message, level || 'info');
        } catch (_) {}
      }
    },

    setUser: function (user) {
      if (window.Sentry && user) {
        try {
          window.Sentry.setUser({ id: user.uid, email: user.email || undefined });
        } catch (_) {}
      }
    },

    clearUser: function () {
      if (window.Sentry) {
        try {
          window.Sentry.setUser(null);
        } catch (_) {}
      }
    },

    addBreadcrumb: function (category, message) {
      if (window.Sentry) {
        try {
          window.Sentry.addBreadcrumb({ category: category, message: message, level: 'info' });
        } catch (_) {}
      }
    }
  };

  // Wire into ErrorBoundary so all captured errors also go to Sentry
  if (window.ErrorBoundary) {
    var origCapture = ErrorBoundary.captureException;
    if (origCapture) {
      ErrorBoundary.captureException = function (error, context) {
        origCapture.call(ErrorBoundary, error, context);
        window.Monitoring.captureException(error, context);
      };
    }
  }
})();
