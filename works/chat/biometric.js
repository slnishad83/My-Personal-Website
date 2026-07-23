/**
 * biometric.js — Biometric authentication bridge
 * Fingerprint / Face Unlock for app lock
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'nsl_biometric_enabled';
    const LAST_BG_KEY = 'nsl_last_background';
    const LOCK_DELAY_MS = 5000; // 5 seconds before requiring auth

    const Biometric = {
        enabled: false,
        isNative: false,

        async init() {
            if (!window.Capacitor?.isNative?.()) return;
            this.isNative = true;
            this.enabled = await Security.getSecure(STORAGE_KEY) === true;
            this.setupListeners();
        },

        setupListeners() {
            const { App } = Capacitor.Plugins;
            if (!App) return;

            App.addListener('appStateChange', async ({ isActive }) => {
                if (!this.enabled) return;
                if (!isActive) {
                    localStorage.setItem(LAST_BG_KEY, Date.now());
                } else {
                    const lastBg = parseInt(localStorage.getItem(LAST_BG_KEY) || '0');
                    if (Date.now() - lastBg > LOCK_DELAY_MS) {
                        await this.authenticate();
                    }
                }
            });
        },

        async isAvailable() {
            if (!this.isNative) return false;
            try {
                const { Biometric } = Capacitor.Plugins;
                const result = await Biometric.isAvailable();
                return result.available;
            } catch {
                return false;
            }
        },

        async authenticate(title, subtitle) {
            if (!this.isNative) return true;
            try {
                const { Biometric } = Capacitor.Plugins;
                await Biometric.authenticate({
                    title: title || 'NSL Chat',
                    subtitle: subtitle || 'Verify your identity to continue',
                    description: '',
                    cancelText: 'Use Password'
                });
                return true;
            } catch (e) {
                if (e?.message === 'cancelled') return false;
                return false;
            }
        },

        async toggle(enabled) {
            this.enabled = enabled;
            await Security.setSecure(STORAGE_KEY, enabled);
        },

        isEnabled() {
            return this.enabled;
        }
    };

    window.AppBiometric = Biometric;
    document.addEventListener('DOMContentLoaded', () => Biometric.init());
})();
