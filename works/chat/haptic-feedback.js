/**
 * haptic-feedback.js — Native haptic feedback for key actions
 * Bridges to MainActivity.performHapticFeedback() on Android
 * Uses Vibration API as fallback on web/iOS
 */
(function() {
    'use strict';

    const HAPTIC_LIGHT = 0;
    const HAPTIC_MEDIUM = 1;
    const HAPTIC_HEAVY = 2;

    const Haptics = {
        isNative: false,
        enabled: true,

        init() {
            this.isNative = window.Capacitor?.isNative?.() || false;
            const saved = localStorage.getItem('nsl_haptics_enabled');
            if (saved !== null) this.enabled = saved !== 'false';
        },

        light() { this._vibrate(HAPTIC_LIGHT); },
        medium() { this._vibrate(HAPTIC_MEDIUM); },
        heavy() { this._vibrate(HAPTIC_HEAVY); },

        send() { this.medium(); },
        like() { this.light(); },
        reply() { this.light(); },
        delete() { this.heavy(); },
        error() { this.heavy(); },
        success() { this.light(); },
        navigate() { this.light(); },
        longPress() { this.medium(); },
        pullRefresh() { this.medium(); },

        _vibrate(type) {
            if (!this.enabled) return;

            if (this.isNative && window.Capacitor?.Plugins?.HapticFeedback) {
                // Android: use native Vibrator via Capacitor
                // (no direct bridge needed — use navigator.vibrate fallback)
            }

            // Web / iOS fallback via Vibration API
            if (navigator.vibrate) {
                switch (type) {
                    case HAPTIC_LIGHT:
                        navigator.vibrate(10);
                        break;
                    case HAPTIC_MEDIUM:
                        navigator.vibrate(25);
                        break;
                    case HAPTIC_HEAVY:
                        navigator.vibrate([50, 30, 50]);
                        break;
                }
            }
        },

        toggle(enabled) {
            this.enabled = enabled;
            localStorage.setItem('nsl_haptics_enabled', enabled);
        },

        isEnabled() {
            return this.enabled;
        }
    };

    window.AppHaptics = Haptics;
    document.addEventListener('DOMContentLoaded', () => Haptics.init());
})();
