/**
 * screenshot-protection.js — Prevent screenshots on sensitive screens
 */
(function() {
    'use strict';

    const ScreenshotProtection = {
        isNative: false,

        init() {
            if (!window.Capacitor?.isNativePlatform?.()) return;
            this.isNative = true;
        },

        async enable() {
            if (!this.isNative) return;
            try {
                const { ScreenshotProtection } = Capacitor.Plugins;
                await ScreenshotProtection.enable();
            } catch (e) {
                console.warn('Screenshot protection enable failed:', e);
            }
        },

        async disable() {
            if (!this.isNative) return;
            try {
                const { ScreenshotProtection } = Capacitor.Plugins;
                await ScreenshotProtection.disable();
            } catch (e) {
                console.warn('Screenshot protection disable failed:', e);
            }
        },

        async isEnabled() {
            if (!this.isNative) return false;
            try {
                const { ScreenshotProtection } = Capacitor.Plugins;
                const result = await ScreenshotProtection.isEnabled();
                return result.enabled;
            } catch {
                return false;
            }
        }
    };

    window.AppScreenshotProtection = ScreenshotProtection;
    document.addEventListener('DOMContentLoaded', () => ScreenshotProtection.init());
})();
