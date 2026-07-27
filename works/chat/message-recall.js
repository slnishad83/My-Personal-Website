// Message Recall Window — allow delete for everyone up to 7 days
(function() {
  'use strict';

  const RECALL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  function _escRecall(s) { return window.escHtml ? window.escHtml(String(s ?? '')) : String(s ?? ''); }

  function _getMsgTime(msg) {
    if (!msg) return 0;
    if (msg.timestamp && typeof msg.timestamp.toMillis === 'function') return msg.timestamp.toMillis();
    if (msg.createdAt && typeof msg.createdAt.toMillis === 'function') return msg.createdAt.toMillis();
    if (typeof msg.timestamp === 'number') return msg.timestamp;
    if (typeof msg.createdAt === 'number') return msg.createdAt;
    if (typeof msg.time === 'number') return msg.time;
    return 0;
  }

  window.canRecallMessage = function(msg) {
    if (!msg) return false;
    const msgTime = _getMsgTime(msg);
    if (!msgTime) return false;
    return (Date.now() - msgTime) < RECALL_WINDOW_MS;
  };

  window.getRecallTimeRemaining = function(msg) {
    if (!msg) return null;
    const msgTime = _getMsgTime(msg);
    if (!msgTime) return null;
    const remaining = RECALL_WINDOW_MS - (Date.now() - msgTime);
    if (remaining <= 0) return null;
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m`;
  };

  let _origOpenDeleteMenu = null;
  function _initRecallPatch() {
    if (_origOpenDeleteMenu) return;
    if (typeof window.openDeleteMenu === 'function') {
      _origOpenDeleteMenu = window.openDeleteMenu;
      window.openDeleteMenu = function(e, msgId) {
        if (typeof e === 'string' && !msgId) { msgId = e; e = null; }
        const chatId = window.App?.currentChat?.id;
        if (!chatId) return _origOpenDeleteMenu(e, msgId);

      const msgs = (window.App?.messages || {})[chatId] || [];
      const msg = msgs.find(m => m.id === msgId);
      if (!msg) return _origOpenDeleteMenu(e, msgId);

      const isMyMsg = msg.from === (window.App?.uid?.() || window.currentUser?.uid);
      const canRecall = isMyMsg && canRecallMessage(msg);

        if (!canRecall && isMyMsg) {
          _showRecallExpiredMenu(msgId, msg);
          return;
        }

        _origOpenDeleteMenu(e, msgId);
      };
    }
  }
  _initRecallPatch();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initRecallPatch);
  }
  const _recallObserver = new MutationObserver(() => {
    if (!_origOpenDeleteMenu && typeof window.openDeleteMenu === 'function') _initRecallPatch();
  });
  if (document.body) {
    _recallObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      _recallObserver.observe(document.body, { childList: true, subtree: true });
    });
  }
  setTimeout(() => { _recallObserver.disconnect(); }, 10000);

  function _showRecallExpiredMenu(msgId, msg) {
    if (typeof window._removeCtxMenu === 'function') window._removeCtxMenu();
    const menu = document.createElement('div');
    menu.id = 'recall-expired-menu';
    menu.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;padding-bottom:20px;animation:fadeIn 0.15s ease';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--surface-container-high);border-radius:24px 24px 0 0;padding:24px;width:100%;max-width:480px;display:flex;flex-direction:column;gap:8px;animation:slideUp 0.2s ease';

    const _timeRemaining = getRecallTimeRemaining(msg);

    sheet.innerHTML = `
      <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:var(--on-surface)">Delete Message</div>
      <div style="padding:16px;border-radius:12px;background:var(--surface-container-low,rgba(0,0,0,0.04));margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span class="material-symbols-outlined" style="font-size:24px;color:var(--on-surface-variant)">schedule</span>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--on-surface)">Recall window expired</div>
            <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px">Messages can only be deleted for everyone within 7 days of sending.</div>
          </div>
        </div>
      </div>
      <button data-action="delete-me" data-msg-id="${_escRecall(msgId)}" style="padding:14px 16px;border-radius:12px;border:none;background:var(--surface-variant);color:var(--on-surface);font-size:14px;font-weight:700;cursor:pointer;text-align:left">🚫 Delete for me only</button>
      <button data-action="cancel" style="padding:14px 16px;border-radius:12px;border:none;background:transparent;color:var(--on-surface-variant);font-size:14px;font-weight:600;cursor:pointer">Cancel</button>`;

    menu.appendChild(sheet);
    menu.onclick = e => {
      if (e.target === menu) { if (typeof window._removeCtxMenu === 'function') window._removeCtxMenu(); return; }
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;
      if (action === 'delete-me') {
        const mid = actionBtn.dataset.msgId;
        if (typeof window._removeCtxMenu === 'function') window._removeCtxMenu();
        if (typeof deleteMessage === 'function') deleteMessage(mid, 'me');
      } else if (action === 'cancel') {
        if (typeof window._removeCtxMenu === 'function') window._removeCtxMenu();
      }
    };
    document.body.appendChild(menu);
    window._ctxMenu = menu;
  }

  window._addRecallInfoToMenu = function(menu, msgId) {
    const chatId = window.App?.currentChat?.id;
    if (!chatId) return;

    const msgs = (window.App?.messages || {})[chatId] || [];
    const msg = msgs.find(m => m.id === msgId);
    if (!msg || msg.from !== (window.App?.uid?.() || window.currentUser?.uid || '')) return;

    const remaining = getRecallTimeRemaining(msg);
    const info = document.createElement('div');
    info.style.cssText = 'padding:8px 16px;font-size:11px;color:var(--on-surface-variant)';

    if (remaining) {
      info.innerHTML = `<span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle">schedule</span> Recall available for ${remaining}`;
    } else {
      info.innerHTML = `<span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle">info</span> Recall window expired (7-day limit)`;
    }

    const deleteBtn = menu.querySelector('[onclick*="deleteMessage"]');
    if (deleteBtn) deleteBtn.parentElement?.insertBefore(info, deleteBtn.nextSibling);
  };

  function _patchDeleteMessage() {
    if (window._recallDeletePatched) return;
    if (typeof window.deleteMessage !== 'function') return;
    window._recallDeletePatched = true;
    const _origDeleteMessage = window.deleteMessage;
    window.deleteMessage = async function(msgId, scope) {
      if (scope === 'everyone') {
        const chatId = window.App?.currentChat?.id;
        if (chatId) {
          const msgs = (window.App?.messages || {})[chatId] || [];
          const msg = msgs.find(m => m.id === msgId);
          if (msg && !canRecallMessage(msg)) {
            window.showToast?.('Recall window expired — can only delete for yourself', 'error');
            return;
          }
        }
      }
      return _origDeleteMessage(msgId, scope);
    };
  }
  _patchDeleteMessage();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _patchDeleteMessage);
  }
  const _recallDeleteInterval = setInterval(() => {
    if (!window._recallDeletePatched) _patchDeleteMessage();
  }, 500);
  setTimeout(() => { clearInterval(_recallDeleteInterval); }, 10000);
})();
