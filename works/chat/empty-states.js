(function() { 'use strict';

var observers = {};
var activeStates = {};

var configs = {
  'no-chats': { icon: 'chat', title: 'No conversations yet', desc: 'Start a new conversation to begin messaging', cta: 'New Chat', ctaAction: 'openNewChat', ctaIcon: 'add' },
  'no-search': { icon: 'search_off', title: 'No results found', desc: 'Try a different search term' },
  'no-groups': { icon: 'group', title: 'No groups yet', desc: 'Create a group to chat with multiple people', cta: 'Create Group', ctaAction: 'openNewGroup', ctaIcon: 'group_add' },
  'no-calls': { icon: 'call_missed', title: 'No call history', desc: 'Your call history will appear here', cta: 'Make a Call', ctaAction: 'startCall', ctaIcon: 'call' },
  'no-contacts': { icon: 'person_search', title: 'No contacts found', desc: 'No contacts match your search' },
  'no-pinned': { icon: 'push_pin', title: 'No pinned messages', desc: 'Long-press a message to pin it' },
  'no-media': { icon: 'perm_media', title: 'No media shared', desc: 'Photos and videos shared in this chat will appear here' },
  'no-filtered': { icon: 'filter_list_off', title: 'No chats match this filter', desc: 'Try a different filter' },
  'no-status': { icon: 'auto_stories', title: 'No status updates', desc: "Your contacts' status updates will appear here" },
  'no-starred': { icon: 'star', title: 'No starred messages', desc: 'Star important messages to find them easily' },
  'no-saved': { icon: 'bookmark', title: 'No saved messages', desc: 'Save messages to revisit them later' }
};

function buildHTML(config) {
  var ctaHtml = '';
  if (config.cta) {
    ctaHtml = '<button class="empty-state-cta" data-action="' + config.ctaAction + '" style="margin-top:20px;padding:12px 24px;border:none;border-radius:var(--radius-xl,20px);background:var(--primary,#6750a4);color:var(--on-primary,#fff);font-size:14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:opacity 0.2s;">' +
      '<span class="material-symbols-outlined" style="font-size:20px;">' + (config.ctaIcon || 'arrow_forward') + '</span>' +
      config.cta +
    '</button>';
  }
  return '<div class="empty-state-inner" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px;min-height:200px;opacity:0;transform:scale(0.95);transition:all 0.3s ease;">' +
    '<div style="width:72px;height:72px;border-radius:50%;background:var(--surface-container,#313033);display:flex;align-items:center;justify-content:center;margin-bottom:16px;">' +
      '<span class="material-symbols-outlined" style="font-size:36px;color:var(--on-surface-variant,#cac4d0);">' + config.icon + '</span>' +
    '</div>' +
    '<h3 style="font-family:var(--font-headline,system-ui);font-size:17px;font-weight:600;color:var(--on-surface,#e6e1e5);margin:0 0 8px;">' + config.title + '</h3>' +
    '<p style="font-size:13px;color:var(--on-surface-variant,#cac4d0);margin:0;max-width:260px;line-height:1.4;">' + config.desc + '</p>' +
    ctaHtml +
  '</div>';
}

function animateIn(el) {
  requestAnimationFrame(function() { el.style.opacity = '1'; el.style.transform = 'scale(1)'; });
}

function animateOut(el, cb) {
  el.style.opacity = '0';
  el.style.transform = 'scale(0.95)';
  setTimeout(cb, 300);
}

function createEmptyElement(id, type) {
  var config = configs[type];
  if (!config) return null;
  var el = document.createElement('div');
  el.className = 'empty-state';
  el.setAttribute('data-empty-type', type);
  el.id = id + '-empty-state';
  el.style.cssText = 'width:100%;display:none;';
  el.innerHTML = buildHTML(config);
  var ctaBtn = el.querySelector('.empty-state-cta');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', function() {
      var action = this.getAttribute('data-action');
      if (action && typeof window[action] === 'function') window[action]();
    });
    ctaBtn.addEventListener('mouseenter', function() { this.style.opacity = '0.9'; });
    ctaBtn.addEventListener('mouseleave', function() { this.style.opacity = '1'; });
  }
  return el;
}

function hasChildren(container) {
  for (var i = 0; i < container.children.length; i++) {
    if (!container.children[i].classList.contains('empty-state')) return true;
  }
  return false;
}

function renderEmptyState(containerId, type) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var existing = document.getElementById(containerId + '-empty-state');
  if (existing) existing.parentNode.removeChild(existing);
  var emptyEl = createEmptyElement(containerId, type);
  if (!emptyEl) return;
  container.style.position = 'relative';
  container.appendChild(emptyEl);
  if (!hasChildren(container)) {
    showEmptyState(containerId, type);
  } else {
    hideEmptyState(containerId);
  }
  setupObserver(containerId, type);
}

function showEmptyState(containerId, type) {
  var el = document.getElementById(containerId + '-empty-state');
  if (!el) {
    var container = document.getElementById(containerId);
    if (!container) return;
    el = createEmptyElement(containerId, type);
    if (!el) return;
    container.appendChild(el);
  }
  el.style.display = 'flex';
  var inner = el.querySelector('.empty-state-inner');
  if (inner) animateIn(inner);
  activeStates[containerId] = type;
}

function hideEmptyState(containerId) {
  var el = document.getElementById(containerId + '-empty-state');
  if (!el) return;
  var inner = el.querySelector('.empty-state-inner');
  if (inner) {
    animateOut(inner, function() { el.style.display = 'none'; });
  } else {
    el.style.display = 'none';
  }
  delete activeStates[containerId];
}

function setupObserver(containerId, type) {
  if (observers[containerId]) observers[containerId].disconnect();
  var container = document.getElementById(containerId);
  if (!container) return;
  var mo = new MutationObserver(function() {
    if (hasChildren(container)) { hideEmptyState(containerId); } else { showEmptyState(containerId, type); }
  });
  mo.observe(container, { childList: true });
  observers[containerId] = mo;
}

function getEmptyStateConfig(type) {
  return configs[type] || null;
}

window.renderEmptyState = renderEmptyState;
window.showEmptyState = showEmptyState;
window.hideEmptyState = hideEmptyState;
window.getEmptyStateConfig = getEmptyStateConfig;

})();
