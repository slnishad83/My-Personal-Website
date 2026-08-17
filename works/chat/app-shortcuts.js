/**
 * app-shortcuts.js — Dynamic app shortcuts (Android 7.1+)
 */
(function() {
    'use strict';

    const AppShortcuts = {
        isNative: false,

        init() {
            if (window.Capacitor?.isNativePlatform?.() !== true) return;
            this.isNative = true;
        },

        async setDefaultShortcuts() {
            if (!this.isNative) return;
            try {
                const { AppShortcuts } = Capacitor.Plugins;
                await AppShortcuts.setShortcuts();
            } catch (e) {
                if (window.__DEBUG__) console.warn('Set shortcuts failed:', e);
            }
        },

        async addShortcut(id, shortLabel, url, longLabel) {
            if (!this.isNative) return;
            try {
                const { AppShortcuts } = Capacitor.Plugins;
                await AppShortcuts.addDynamicShortcut({
                    id,
                    shortLabel,
                    longLabel: longLabel || shortLabel,
                    url
                });
            } catch (e) {
                if (window.__DEBUG__) console.warn('Add shortcut failed:', e);
            }
        },

        async removeAll() {
            if (!this.isNative) return;
            try {
                const { AppShortcuts } = Capacitor.Plugins;
                await AppShortcuts.removeAllDynamicShortcuts();
            } catch (e) {
                if (window.__DEBUG__) console.warn('Remove shortcuts failed:', e);
            }
        },

        async getCount() {
            if (!this.isNative) return null;
            try {
                const { AppShortcuts } = Capacitor.Plugins;
                return await AppShortcuts.getShortcutCount();
            } catch {
                return null;
            }
        }
    };

    window.AppShortcutsManager = AppShortcuts;
    document.addEventListener('DOMContentLoaded', () => {
        AppShortcuts.init();
        if (AppShortcuts.isNative) {
            AppShortcuts.setDefaultShortcuts();
        }
    });
})();
