/**
 * NSL Chat — Component Abstraction Layer (ES Module)
 * 
 * Provides reusable UI component factories that eliminate
 * duplicate modal, toast, dialog, and form patterns across modules.
 * 
 * All components use the M3 design token system.
 */
'use strict';

import { escHtml, createElement, on, emit } from '../core/utils.js';

/* ══════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ══════════════════════════════════════════════════════════════ */

const TOAST_ICONS = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

/**
 * Show a toast notification. Auto-dismisses after duration.
 * @param {string} message - Message to display
 * @param {'success'|'error'|'warning'|'info'} type - Toast type
 * @param {number} duration - Auto-dismiss duration in ms (default 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = createElement('div', {
    className: `flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-xl max-w-sm animate-slide-in-right`,
    style: {
      background: type === 'error' ? 'rgba(179, 38, 30, 0.15)' :
                  type === 'success' ? 'rgba(0, 168, 132, 0.15)' :
                  type === 'warning' ? 'rgba(255, 152, 0, 0.15)' :
                  'rgba(103, 80, 164, 0.15)',
      borderColor: type === 'error' ? 'rgba(179, 38, 30, 0.3)' :
                    type === 'success' ? 'rgba(0, 168, 132, 0.3)' :
                    type === 'warning' ? 'rgba(255, 152, 0, 0.3)' :
                    'rgba(103, 80, 164, 0.3)',
    }
  }, [
    createElement('span', {
      className: `material-symbols-outlined text-lg`,
      style: { color: type === 'error' ? '#B3261E' : type === 'success' ? '#00A884' : type === 'warning' ? '#FF9800' : '#6750A4' }
    }, [TOAST_ICONS[type] || 'info']),
    createElement('span', {
      className: 'text-sm font-medium text-on-surface'
    }, [escHtml(message)]),
  ]);

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slide-out-right 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ══════════════════════════════════════════════════════════════
   MODAL DIALOG
   ══════════════════════════════════════════════════════════════ */

/**
 * Create and show a modal dialog.
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {string} options.body - HTML body content
 * @param {string} [options.confirmText] - Confirm button text
 * @param {string} [options.cancelText] - Cancel button text
 * @param {Function} [options.onConfirm] - Confirm callback
 * @param {Function} [options.onCancel] - Cancel callback
 * @param {boolean} [options.danger] - Show danger-styled confirm button
 */
export function showModal({ title, body, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, danger = false }) {
  const overlay = createElement('div', {
    className: 'fixed inset-0 z-[10000] flex items-center justify-center p-4',
    style: { background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }
  });

  const dialog = createElement('div', {
    className: 'w-full max-w-md bg-surface-container-low rounded-3xl shadow-2xl border border-outline-variant/20 overflow-hidden',
    style: { animation: 'modal-enter 0.2s ease' }
  });

  const header = createElement('div', { className: 'px-6 pt-6 pb-2' }, [
    createElement('h3', { className: 'font-headline-md text-headline-md font-bold text-on-surface' }, [title])
  ]);

  const content = createElement('div', { className: 'px-6 py-4' });
  if (typeof body === 'string') content.innerHTML = body;
  else if (body instanceof HTMLElement) content.appendChild(body);

  const actions = createElement('div', { className: 'px-6 pb-6 pt-2 flex justify-end gap-3' }, [
    createElement('button', {
      className: 'px-5 py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-variant/50 transition-colors',
      onClick: () => { overlay.remove(); onCancel?.(); }
    }, [cancelText]),
    createElement('button', {
      className: `px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
        danger
          ? 'bg-error text-on-error hover:brightness-110'
          : 'bg-primary text-on-primary hover:brightness-110'
      }`,
      onClick: () => { overlay.remove(); onConfirm?.(); }
    }, [confirmText]),
  ]);

  dialog.append(header, content, actions);
  overlay.appendChild(dialog);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { overlay.remove(); onCancel?.(); }
  });

  document.body.appendChild(overlay);
  return { close: () => overlay.remove() };
}

/* ══════════════════════════════════════════════════════════════
   CONFIRM DIALOG (Promise-based)
   ══════════════════════════════════════════════════════════════ */

export function confirm(message, title = 'Confirm') {
  return new Promise(resolve => {
    showModal({
      title,
      body: `<p class="text-sm text-on-surface-variant">${escHtml(message)}</p>`,
      confirmText: 'Yes',
      cancelText: 'No',
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   BOTTOM SHEET
   ══════════════════════════════════════════════════════════════ */

/**
 * Show a bottom sheet with a list of options.
 * @param {Array<{label: string, icon?: string, onClick: Function, danger?: boolean}>} options
 */
export function showBottomSheet(options) {
  const overlay = createElement('div', {
    className: 'fixed inset-0 z-[10000]',
    style: { background: 'rgba(0,0,0,0.4)' }
  });

  const sheet = createElement('div', {
    className: 'absolute bottom-0 left-0 right-0 bg-surface-container-low rounded-t-3xl border-t border-outline-variant/20 shadow-2xl',
    style: { animation: 'sheet-enter 0.25s ease', maxHeight: '70vh', overflowY: 'auto' }
  });

  const handle = createElement('div', { className: 'flex justify-center py-3' }, [
    createElement('div', { className: 'w-10 h-1 rounded-full bg-on-surface-variant/30' })
  ]);

  const items = createElement('div', { className: 'pb-6' });
  options.forEach(opt => {
    const row = createElement('button', {
      className: 'w-full flex items-center gap-4 px-6 py-4 hover:bg-surface-variant/30 transition-colors text-left',
      onClick: () => { overlay.remove(); opt.onClick?.(); }
    }, [
      opt.icon ? createElement('span', {
        className: 'material-symbols-outlined text-xl',
        style: { color: opt.danger ? 'var(--error)' : 'var(--on-surface-variant)' }
      }, [opt.icon]) : null,
      createElement('span', {
        className: `text-sm font-medium ${opt.danger ? 'text-error' : 'text-on-surface'}`,
      }, [opt.label])
    ]);
    items.appendChild(row);
  });

  sheet.append(handle, items);
  overlay.appendChild(sheet);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.body.appendChild(overlay);
  return { close: () => overlay.remove() };
}

/* ══════════════════════════════════════════════════════════════
   LOADING SPINNER
   ══════════════════════════════════════════════════════════════ */

export function showLoading(message = 'Loading...') {
  const overlay = createElement('div', {
    className: 'fixed inset-0 z-[10001] flex items-center justify-center',
    style: { background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }
  }, [
    createElement('div', { className: 'flex flex-col items-center gap-4 bg-surface-container-low rounded-3xl p-8 shadow-2xl' }, [
      createElement('div', { className: 'w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin', style: { borderWidth: '3px' } }),
      createElement('p', { className: 'text-sm text-on-surface-variant font-medium' }, [message])
    ])
  ]);
  document.body.appendChild(overlay);
  return { close: () => overlay.remove() };
}

/* ══════════════════════════════════════════════════════════════
   BACKWARD COMPATIBILITY
   ══════════════════════════════════════════════════════════════ */

window.showToast = showToast;
window.showModal = showModal;
window.confirm = confirm;
window.showBottomSheet = showBottomSheet;
window.showLoading = showLoading;
