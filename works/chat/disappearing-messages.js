'use strict';

window.DisappearingMessages = (function () {

    const TIMERS = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
    };

    const VALID_TIMER_MS = Object.values(TIMERS);
    let _cleanupInterval = null;

    function _log(...args) {
        if (window.__DEBUG__) {
            console.log('[DisappearingMessages]', ...args);
        }
    }

    function _error(...args) {
        if (window.__DEBUG__) {
            console.error('[DisappearingMessages]', ...args);
        }
    }

    function _getFirestore() {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            return firebase.firestore();
        }
        if (window.db) {
            return window.db;
        }
        throw new Error('Firestore not available');
    }

    function _getStorage() {
        if (typeof firebase !== 'undefined' && firebase.storage) {
            return firebase.storage();
        }
        if (window.storage) {
            return window.storage;
        }
        return null;
    }

    function _getCurrentUid() {
        if (window.currentUser && window.currentUser.uid) {
            return window.currentUser.uid;
        }
        if (typeof firebase !== 'undefined' && firebase.auth) {
            const user = firebase.auth().currentUser;
            if (user) return user.uid;
        }
        return null;
    }

    function _validateTimerMs(timerMs) {
        if (timerMs === null || timerMs === undefined) return true;
        return VALID_TIMER_MS.includes(timerMs);
    }

    function _getTimerLabel(timerMs) {
        if (!timerMs) return 'Off';
        for (const [label, ms] of Object.entries(TIMERS)) {
            if (ms === timerMs) return label;
        }
        return 'Off';
    }

    async function setChatTimer(chatId, chatType, timerMs) {
        _log('setChatTimer', chatId, chatType, timerMs);

        if (!_validateTimerMs(timerMs)) {
            _error('Invalid timer value:', timerMs);
            throw new Error('Invalid timer value. Allowed: ' + VALID_TIMER_MS.join(', '));
        }

        const db = _getFirestore();
        const uid = _getCurrentUid();
        if (!uid) throw new Error('User not authenticated');

        const setting = {
            enabled: timerMs !== null && timerMs !== 0,
            timerMs: timerMs || null,
            setBy: uid,
            setAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const chatRef = db.collection('chats').doc(chatId);
            await chatRef.set({ disappearingMessages: setting }, { merge: true });
            _log('Chat timer updated', setting);

            if (chatType === 'group') {
                const groupRef = db.collection('groups').doc(chatId);
                await groupRef.set({ disappearingMessages: setting }, { merge: true });
                _log('Group timer updated', setting);
            }

            return setting;
        } catch (err) {
            _error('Failed to set chat timer:', err);
            throw err;
        }
    }

    async function getChatTimer(chatId) {
        _log('getChatTimer', chatId);
        try {
            const db = _getFirestore();
            const chatDoc = await db.collection('chats').doc(chatId).get();
            if (chatDoc.exists) {
                const data = chatDoc.data();
                if (data.disappearingMessages) {
                    return data.disappearingMessages;
                }
            }
            return { enabled: false, timerMs: null };
        } catch (err) {
            _error('Failed to get chat timer:', err);
            return { enabled: false, timerMs: null };
        }
    }

    async function getChatTimerInfo(chatId) {
        const setting = await getChatTimer(chatId);
        return {
            enabled: setting.enabled,
            timerMs: setting.timerMs,
            label: _getTimerLabel(setting.timerMs),
            setBy: setting.setBy || null,
            setAt: setting.setAt || null
        };
    }

    function addExpiresAt(messageData, timerMs) {
        if (!timerMs || !_validateTimerMs(timerMs)) {
            return messageData;
        }
        return {
            ...messageData,
            expiresAt: Date.now() + timerMs
        };
    }

    async function cleanupExpiredMessages(chatId, chatType) {
        _log('cleanupExpiredMessages', chatId, chatType);
        const db = _getFirestore();
        const now = Date.now();
        let totalDeleted = 0;

        try {
            let hasMore = true;
            let lastDoc = null;

            while (hasMore) {
                let query = db
                    .collection('chats')
                    .doc(chatId)
                    .collection('messages')
                    .where('expiresAt', '<', now)
                    .orderBy('expiresAt', 'asc')
                    .limit(500);

                if (lastDoc) {
                    query = query.startAfter(lastDoc);
                }

                const snapshot = await query.get();

                if (snapshot.empty || snapshot.docs.length === 0) {
                    hasMore = false;
                    break;
                }

                const batch = db.batch();

                for (const doc of snapshot.docs) {
                    const msgData = doc.data();

                    if (msgData.attachments && msgData.attachments.length > 0) {
                        await _deleteAttachments(msgData.attachments);
                    }

                    batch.delete(doc.ref);
                    totalDeleted++;
                }

                await batch.commit();
                lastDoc = snapshot.docs[snapshot.docs.length - 1];

                _log('Deleted batch of ' + snapshot.docs.length + ' expired messages from ' + chatId);

                if (snapshot.docs.length < 500) {
                    hasMore = false;
                }
            }

            _log('Total expired messages deleted from ' + chatId + ': ' + totalDeleted);
            return totalDeleted;
        } catch (err) {
            _error('Failed to cleanup expired messages:', err);
            return totalDeleted;
        }
    }

    async function _deleteAttachments(attachments) {
        const storage = _getStorage();
        if (!storage) {
            _log('Firebase Storage not available, skipping attachment deletion');
            return;
        }

        for (const attachment of attachments) {
            try {
                const url = attachment.url || attachment.downloadUrl;
                if (!url) continue;

                const storageRef = storage.refFromURL(url);
                await storageRef.delete();
                _log('Deleted attachment:', url);
            } catch (err) {
                _error('Failed to delete attachment:', err);
            }
        }
    }

    function isMessageExpired(messageData) {
        if (!messageData.expiresAt) return false;
        return Date.now() > messageData.expiresAt;
    }

    function shouldShowNotification(messageData) {
        if (isMessageExpired(messageData)) {
            _log('Skipping notification for expired message:', messageData.id);
            return false;
        }
        return true;
    }

    function startAutoCleanup(allChatIds) {
        _log('Starting auto-cleanup interval');
        if (_cleanupInterval) {
            clearInterval(_cleanupInterval);
        }

        _cleanupInterval = setInterval(async function () {
            _log('Running auto-cleanup cycle');
            var chatList = [];

            if (typeof allChatIds === 'function') {
                chatList = await allChatIds();
            } else if (Array.isArray(allChatIds)) {
                chatList = allChatIds;
            }

            for (var i = 0; i < chatList.length; i++) {
                var chatId = chatList[i];
                var chatType = 'individual';

                if (typeof chatId === 'object') {
                    chatType = chatId.type || 'individual';
                    chatId = chatId.id;
                }

                try {
                    await cleanupExpiredMessages(chatId, chatType);
                } catch (err) {
                    _error('Auto-cleanup failed for chat:', chatId, err);
                }
            }
        }, 5 * 60 * 1000);
    }

    function stopAutoCleanup() {
        if (_cleanupInterval) {
            clearInterval(_cleanupInterval);
            _cleanupInterval = null;
            _log('Auto-cleanup stopped');
        }
    }

    function getTimerIcon() {
        return '<span class="dm-timer-icon" style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;vertical-align:middle;margin-left:3px;color:#8696a0;" title="Disappearing message">' +
            '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">' +
            '<path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 12.5A5.5 5.5 0 1 1 8 2.5a5.5 5.5 0 0 1 0 11zM8 4a.75.75 0 0 0-.75.75V8c0 .28.16.54.41.66l2.5 1.5a.75.75 0 1 0 .76-1.3L8.75 7.63V4.75A.75.75 0 0 0 8 4z"/>' +
            '</svg></span>';
    }

    function _injectStyles() {
        if (document.getElementById('dm-dialog-styles')) return;

        var style = document.createElement('style');
        style.id = 'dm-dialog-styles';
        style.textContent = [
            '.dm-overlay {',
            '  position: fixed;',
            '  inset: 0;',
            '  background: rgba(0, 0, 0, 0.4);',
            '  z-index: 9998;',
            '  display: flex;',
            '  align-items: flex-end;',
            '  justify-content: center;',
            '  opacity: 0;',
            '  transition: opacity 0.2s ease;',
            '}',
            '.dm-overlay.dm-visible {',
            '  opacity: 1;',
            '}',
            '.dm-dialog {',
            '  background: #ffffff;',
            '  width: 100%;',
            '  max-width: 440px;',
            '  border-radius: 16px 16px 0 0;',
            '  padding: 0;',
            '  transform: translateY(100%);',
            '  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);',
            '  box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.15);',
            '}',
            '.dm-overlay.dm-visible .dm-dialog {',
            '  transform: translateY(0);',
            '}',
            '.dm-dialog-header {',
            '  padding: 24px 24px 4px 24px;',
            '}',
            '.dm-dialog-title {',
            '  font-size: 20px;',
            '  font-weight: 500;',
            '  color: #1b1b1b;',
            '  margin: 0 0 8px 0;',
            '}',
            '.dm-dialog-subtitle {',
            '  font-size: 14px;',
            '  color: #667781;',
            '  margin: 0;',
            '  line-height: 1.4;',
            '}',
            '.dm-options-list {',
            '  padding: 16px 0;',
            '}',
            '.dm-option {',
            '  display: flex;',
            '  align-items: center;',
            '  padding: 14px 24px;',
            '  cursor: pointer;',
            '  transition: background 0.15s;',
            '  user-select: none;',
            '}',
            '.dm-option:hover {',
            '  background: #f5f6f6;',
            '}',
            '.dm-radio {',
            '  width: 20px;',
            '  height: 20px;',
            '  border-radius: 50%;',
            '  border: 2px solid #b0b8bf;',
            '  margin-right: 16px;',
            '  position: relative;',
            '  flex-shrink: 0;',
            '  transition: border-color 0.15s;',
            '}',
            '.dm-option.dm-selected .dm-radio {',
            '  border-color: var(--primary);',
            '}',
            '.dm-option.dm-selected .dm-radio::after {',
            '  content: "";',
            '  position: absolute;',
            '  top: 3px;',
            '  left: 3px;',
            '  width: 10px;',
            '  height: 10px;',
            '  border-radius: 50%;',
            '  background: var(--primary);',
            '}',
            '.dm-option-label {',
            '  font-size: 16px;',
            '  color: #1b1b1b;',
            '}',
            '.dm-option.dm-selected .dm-option-label {',
            '  color: var(--primary);',
            '  font-weight: 500;',
            '}',
            '@media (prefers-color-scheme: dark) {',
            '  .dm-overlay { background: rgba(0, 0, 0, 0.6); }',
            '  .dm-dialog { background: #1f2c34; }',
            '  .dm-dialog-title { color: #e9edef; }',
            '  .dm-dialog-subtitle { color: #8696a0; }',
            '  .dm-option:hover { background: #2a3942; }',
            '  .dm-radio { border-color: #5e6f78; }',
            '  .dm-option.dm-selected .dm-radio { border-color: var(--primary); }',
            '  .dm-option-label { color: #e9edef; }',
            '}'
        ].join('\n');

        document.head.appendChild(style);
    }

    function showTimerDialog(chatId, chatType, currentSetting) {
        _log('showTimerDialog', chatId, chatType, currentSetting);

        return new Promise(function (resolve) {
            _injectStyles();

            var currentTimerMs = null;
            if (currentSetting && currentSetting.enabled && currentSetting.timerMs) {
                currentTimerMs = currentSetting.timerMs;
            }

            var options = [
                { label: 'Off', value: null },
                { label: '24 hours', value: TIMERS['24h'] },
                { label: '7 days', value: TIMERS['7d'] },
                { label: '90 days', value: TIMERS['90d'] }
            ];

            var overlay = document.createElement('div');
            overlay.className = 'dm-overlay';

            var dialog = document.createElement('div');
            dialog.className = 'dm-dialog';

            var header = document.createElement('div');
            header.className = 'dm-dialog-header';

            var title = document.createElement('h2');
            title.className = 'dm-dialog-title';
            title.textContent = 'Message timer';

            var subtitle = document.createElement('p');
            subtitle.className = 'dm-dialog-subtitle';
            subtitle.textContent = 'Choose how long new messages persist after they\'ve been read';

            header.appendChild(title);
            header.appendChild(subtitle);
            dialog.appendChild(header);

            var optionsList = document.createElement('div');
            optionsList.className = 'dm-options-list';

            function renderOptions() {
                optionsList.innerHTML = '';
                options.forEach(function (opt) {
                    var optEl = document.createElement('div');
                    optEl.className = 'dm-option';
                    if (opt.value === currentTimerMs) {
                        optEl.classList.add('dm-selected');
                    }

                    var radio = document.createElement('div');
                    radio.className = 'dm-radio';

                    var label = document.createElement('span');
                    label.className = 'dm-option-label';
                    label.textContent = opt.label;

                    optEl.appendChild(radio);
                    optEl.appendChild(label);

                    optEl.addEventListener('click', async function () {
                        currentTimerMs = opt.value;
                        renderOptions();

                        try {
                            await setChatTimer(chatId, chatType, opt.value);

                            var chosenLabel = opt.value ? _getTimerLabel(opt.value) : 'Off';
                            if (window.showToast) {
                                window.showToast('Message timer set to ' + chosenLabel);
                            }

                            setTimeout(function () {
                                closeDialog();
                                resolve(opt.value);
                            }, 200);
                        } catch (err) {
                            _error('Failed to set timer from dialog:', err);
                            if (window.showToast) {
                                window.showToast('Failed to update timer');
                            }
                        }
                    });

                    optionsList.appendChild(optEl);
                });
            }

            renderOptions();
            dialog.appendChild(optionsList);
            overlay.appendChild(dialog);

            function closeDialog() {
                overlay.classList.remove('dm-visible');
                setTimeout(function () {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 300);
            }

            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) {
                    closeDialog();
                    resolve(currentTimerMs);
                }
            });

            function handleEsc(e) {
                if (e.key === 'Escape') {
                    closeDialog();
                    resolve(currentTimerMs);
                    document.removeEventListener('keydown', handleEsc);
                }
            }
            document.addEventListener('keydown', handleEsc);

            document.body.appendChild(overlay);

            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    overlay.classList.add('dm-visible');
                });
            });
        });
    }

    function getActiveChatIds() {
        if (window.getActiveChats && typeof window.getActiveChats === 'function') {
            return window.getActiveChats();
        }
        return [];
    }

    async function cleanupAllActiveChats() {
        _log('cleanupAllActiveChats');
        var chatIds = getActiveChatIds();
        for (var i = 0; i < chatIds.length; i++) {
            var chat = chatIds[i];
            var id = typeof chat === 'object' ? chat.id : chat;
            var type = typeof chat === 'object' ? (chat.type || 'individual') : 'individual';
            try {
                await cleanupExpiredMessages(id, type);
            } catch (err) {
                _error('Failed cleanup for:', id, err);
            }
        }
    }

    return {
        TIMERS: TIMERS,

        setChatTimer: setChatTimer,
        getChatTimer: getChatTimer,
        getChatTimerInfo: getChatTimerInfo,
        addExpiresAt: addExpiresAt,
        cleanupExpiredMessages: cleanupExpiredMessages,
        cleanupAllActiveChats: cleanupAllActiveChats,
        isMessageExpired: isMessageExpired,
        shouldShowNotification: shouldShowNotification,
        getTimerIcon: getTimerIcon,
        showTimerDialog: showTimerDialog,
        startAutoCleanup: startAutoCleanup,
        stopAutoCleanup: stopAutoCleanup
    };

})();