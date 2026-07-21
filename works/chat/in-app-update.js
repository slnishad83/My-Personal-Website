/**
 * in-app-update.js — Play Store in-app update prompts
 */
(function() {
    'use strict';

    const InAppUpdate = {
        isNative: false,
        lastCheck: 0,
        CHECK_INTERVAL: 4 * 60 * 60 * 1000, // 4 hours

        init() {
            if (!window.Capacitor?.isNative?.()) return;
            this.isNative = true;
            this.maybeCheck();
        },

        async maybeCheck() {
            const lastCheck = parseInt(localStorage.getItem('nsl_update_check') || '0');
            if (Date.now() - lastCheck < this.CHECK_INTERVAL) return;
            localStorage.setItem('nsl_update_check', Date.now());
            await this.checkForUpdate();
        },

        async checkForUpdate() {
            if (!this.isNative) return null;
            try {
                const { InAppUpdate } = Capacitor.Plugins;
                const result = await InAppUpdate.checkForUpdate();
                if (result.updateAvailable) {
                    this.promptUpdate(result);
                }
                return result;
            } catch (e) {
                console.warn('Update check failed:', e);
                return null;
            }
        },

        promptUpdate(info) {
            if (window.AppToast) {
                window.AppToast.show('A new version is available', {
                    type: 'info',
                    duration: 8000,
                    action: {
                        label: 'Update',
                        handler: () => this.startUpdate(info.flexibleAllowed ? 'flexible' : 'immediate')
                    }
                });
            }
        },

        async startUpdate(type) {
            if (!this.isNative) return;
            try {
                const { InAppUpdate } = Capacitor.Plugins;
                if (type === 'flexible') {
                    await InAppUpdate.startFlexibleUpdate();
                } else {
                    await InAppUpdate.startImmediateUpdate();
                }
            } catch (e) {
                console.warn('Update start failed:', e);
            }
        },

        async completeUpdate() {
            if (!this.isNative) return;
            try {
                const { InAppUpdate } = Capacitor.Plugins;
                await InAppUpdate.completeUpdate();
            } catch (e) {
                console.warn('Update complete failed:', e);
            }
        }
    };

    window.AppInAppUpdate = InAppUpdate;
    document.addEventListener('DOMContentLoaded', () => InAppUpdate.init());
})();
