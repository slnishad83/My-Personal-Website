(function() {
  'use strict';

  var _uid = function() { return App && App.uid ? App.uid() : (window.currentUser ? window.currentUser.uid : null); };
  var _chatId = function() { return App && App.chatId ? App.chatId() : (window.currentChatId || null); };

  function _esc(str) {
    if (typeof window.escHtml === 'function') return window.escHtml(str);
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function _showToast(msg, type) { if (App && App.toast) App.toast(msg, type); else if (typeof showToast === 'function') showToast(msg, type); }

  var _currentReportUserId = null;
  var _currentReportUserName = null;

  var _categories = [
    { id: 'spam', label: 'Spam', desc: 'Sending repetitive or unsolicited messages' },
    { id: 'nudity', label: 'Nudity or sexual content', desc: 'Inappropriate sexual content' },
    { id: 'hate', label: 'Hate speech', desc: 'Content promoting hatred or discrimination' },
    { id: 'harassment', label: 'Harassment or bullying', desc: 'Targeted harmful behavior' },
    { id: 'false_info', label: 'False information', desc: 'Misleading or false claims' },
    { id: 'violence', label: 'Violence', desc: 'Threats or graphic violence' },
    { id: 'other', label: 'Other', desc: 'Something else not listed above' }
  ];

  function _injectStyles() {
    if (document.getElementById('report-user-styles')) return;
    var style = document.createElement('style');
    style.id = 'report-user-styles';
    style.textContent = '\n' +
      '.report-overlay{position:fixed;inset:0;z-index:100001;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);opacity:0;transition:opacity 0.25s ease;}\n' +
      '@media(min-width:640px){.report-overlay{align-items:center;}}\n' +
      '.report-overlay.open{display:flex;opacity:1;}\n' +
      '.report-sheet{background:var(--surface-container,#1f2c34);width:100%;max-width:480px;max-height:90vh;border-radius:20px 20px 0 0;overflow:hidden;display:flex;flex-direction:column;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);box-shadow:0 -4px 24px rgba(0,0,0,0.4);}\n' +
      '.report-overlay.open .report-sheet{transform:translateY(0);}\n' +
      '@media(min-width:640px){.report-sheet{border-radius:20px;max-width:420px;transform:scale(0.9);opacity:0;transition:transform 0.25s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease;}\n' +
      '.report-overlay.open .report-sheet{transform:scale(1);opacity:1;}}\n' +
      '.report-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--outline-variant,rgba(255,255,255,0.08));}\n' +
      '.report-header h3{font-weight:700;font-size:16px;color:var(--on-surface,#fff);margin:0;}\n' +
      '.report-close-btn{background:none;border:none;color:var(--on-surface-variant,#aaa);font-size:22px;cursor:pointer;padding:4px 8px;border-radius:50%;transition:background 0.15s;}\n' +
      '.report-close-btn:hover{background:var(--surface-variant,rgba(255,255,255,0.08));}\n' +
      '.report-user-info{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--outline-variant,rgba(255,255,255,0.08));}\n' +
      '.report-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;background:var(--surface-variant,#333);}\n' +
      '.report-username{font-weight:600;font-size:15px;color:var(--on-surface,#fff);}\n' +
      '.report-body{overflow-y:auto;padding:12px 20px 20px;flex:1;}\n' +
      '.report-categories{display:flex;flex-direction:column;gap:2px;}\n' +
      '.report-cat{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;cursor:pointer;transition:background 0.15s;}\n' +
      '.report-cat:hover{background:var(--surface-variant,rgba(255,255,255,0.06));}\n' +
      '.report-cat.selected{background:var(--primary-container,rgba(138,180,248,0.15));}\n' +
      '.report-cat input[type=radio]{accent-color:var(--primary,#8ab4f8);width:18px;height:18px;cursor:pointer;flex-shrink:0;}\n' +
      '.report-cat-text{display:flex;flex-direction:column;gap:1px;}\n' +
      '.report-cat-label{font-size:14px;font-weight:600;color:var(--on-surface,#fff);}\n' +
      '.report-cat-desc{font-size:12px;color:var(--on-surface-variant,#999);}\n' +
      '.report-details{margin-top:16px;position:relative;}\n' +
      '.report-details textarea{width:100%;min-height:80px;max-height:120px;padding:12px;border-radius:12px;border:1px solid var(--outline-variant,rgba(255,255,255,0.12));background:var(--surface-variant,rgba(255,255,255,0.06));color:var(--on-surface,#fff);font-size:14px;font-family:inherit;resize:vertical;outline:none;box-sizing:border-box;transition:border-color 0.15s;}\n' +
      '.report-details textarea::placeholder{color:var(--on-surface-variant,#777);}\n' +
      '.report-details textarea:focus{border-color:var(--primary,#8ab4f8);}\n' +
      '.report-char-count{position:absolute;bottom:8px;right:12px;font-size:11px;color:var(--on-surface-variant,#777);}\n' +
      '.report-actions{display:flex;gap:10px;padding:12px 20px 20px;border-top:1px solid var(--outline-variant,rgba(255,255,255,0.08));}\n' +
      '.report-cancel-btn{flex:1;padding:10px;border-radius:12px;border:1px solid var(--outline-variant,rgba(255,255,255,0.15));background:transparent;color:var(--on-surface-variant,#ccc);font-size:14px;font-weight:600;cursor:pointer;transition:background 0.15s;}\n' +
      '.report-cancel-btn:hover{background:var(--surface-variant,rgba(255,255,255,0.06));}\n' +
      '.report-submit-btn{flex:1;padding:10px;border-radius:12px;border:none;background:var(--primary,#8ab4f8);color:var(--on-primary,#000);font-size:14px;font-weight:700;cursor:pointer;transition:opacity 0.15s,filter 0.15s;}\n' +
      '.report-submit-btn:disabled{opacity:0.4;cursor:not-allowed;}\n' +
      '.report-submit-btn:not(:disabled):hover{filter:brightness(1.1);}\n' +
      '.report-confirmation{text-align:center;padding:40px 20px;}\n' +
      '.report-confirmation svg{margin:0 auto 16px;width:48px;height:48px;color:var(--primary,#8ab4f8);}\n' +
      '.report-confirmation p{font-size:14px;color:var(--on-surface-variant,#aaa);line-height:1.6;}\n' +
      '.report-duplicate-msg{text-align:center;padding:32px 20px;font-size:14px;color:var(--on-surface-variant,#aaa);}\n';
    document.head.appendChild(style);
  }

  function _buildOverlay() {
    if (document.getElementById('report-overlay')) return;
    var overlay = document.createElement('div');
    overlay.className = 'report-overlay';
    overlay.id = 'report-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'report-dialog-title');
    overlay.onclick = function(e) { if (e.target === overlay) closeReportDialog(); };
    overlay.innerHTML =
      '<div class="report-sheet">' +
        '<div class="report-header">' +
          '<h3 id="report-dialog-title">Report User</h3>' +
          '<button class="report-close-btn" onclick="closeReportDialog()" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="report-user-info">' +
          '<img class="report-avatar" id="report-avatar" src="" alt="">' +
          '<span class="report-username" id="report-username-display"></span>' +
        '</div>' +
        '<div class="report-body" id="report-body">' +
          '<div class="report-categories" id="report-categories"></div>' +
          '<div class="report-details">' +
            '<textarea id="report-details-input" placeholder="Add any additional details..." maxlength="500"></textarea>' +
            '<span class="report-char-count" id="report-char-count">0/500</span>' +
          '</div>' +
        '</div>' +
        '<div class="report-actions">' +
          '<button class="report-cancel-btn" onclick="closeReportDialog()">Cancel</button>' +
          '<button class="report-submit-btn" id="report-submit-btn" disabled onclick="window._reportSubmit()">Submit</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    _renderCategories();
    document.getElementById('report-details-input').addEventListener('input', function() {
      var len = this.value.length;
      document.getElementById('report-char-count').textContent = len + '/500';
    });
  }

  function _renderCategories() {
    var container = document.getElementById('report-categories');
    if (!container) return;
    var html = '';
    _categories.forEach(function(cat) {
      html += '<label class="report-cat" id="report-cat-' + cat.id + '">' +
        '<input type="radio" name="report-reason" value="' + cat.id + '">' +
        '<div class="report-cat-text">' +
          '<span class="report-cat-label">' + _esc(cat.label) + '</span>' +
          '<span class="report-cat-desc">' + _esc(cat.desc) + '</span>' +
        '</div>' +
      '</label>';
    });
    container.innerHTML = html;
    var radios = container.querySelectorAll('input[type=radio]');
    radios.forEach(function(radio) {
      radio.addEventListener('change', function() {
        container.querySelectorAll('.report-cat').forEach(function(el) { el.classList.remove('selected'); });
        if (this.checked) this.closest('.report-cat').classList.add('selected');
        document.getElementById('report-submit-btn').disabled = false;
      });
    });
  }

  async function _checkDuplicate(userId) {
    var reporterId = _uid();
    if (!reporterId || !userId) return false;
    try {
      var cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      var snap = await db.collection('userReports')
        .where('reporterUserId', '==', reporterId)
        .where('reportedUserId', '==', userId)
        .where('timestamp', '>=', cutoff)
        .limit(1)
        .get();
      return !snap.empty;
    } catch (e) {
      return false;
    }
  }

  function _showDuplicateMessage() {
    var body = document.getElementById('report-body');
    if (!body) return;
    body.innerHTML = '<div class="report-duplicate-msg">You\'ve already reported this user in the last 24 hours. Thank you for your patience while we review.</div>';
    var actions = document.querySelector('.report-actions');
    if (actions) actions.style.display = 'none';
  }

  function _showConfirmation() {
    var body = document.getElementById('report-body');
    var actions = document.querySelector('.report-actions');
    if (body) {
      body.innerHTML = '<div class="report-confirmation">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
        '<p>Thank you for your report. We\'ll review it within 24 hours.</p>' +
      '</div>';
    }
    if (actions) actions.style.display = 'none';
    setTimeout(function() { closeReportDialog(); }, 3000);
  }

  function _getSelectedCategory() {
    var checked = document.querySelector('input[name=report-reason]:checked');
    return checked ? checked.value : null;
  }

  async function openReportUser(userId, userName) {
    _currentReportUserId = userId;
    _currentReportUserName = userName || 'Unknown';
    _injectStyles();
    _buildOverlay();

    document.getElementById('report-dialog-title').textContent = 'Report ' + _currentReportUserName;
    document.getElementById('report-username-display').textContent = _currentReportUserName;

    var avatar = document.getElementById('report-avatar');
    var photoUrl = null;
    if (App && App.getUserPhoto) photoUrl = App.getUserPhoto(userId);
    avatar.src = photoUrl || '';
    avatar.alt = _currentReportUserName;
    avatar.onerror = function() { this.style.display = 'none'; };

    var isDuplicate = await _checkDuplicate(userId);
    if (isDuplicate) {
      _showDuplicateMessage();
    } else {
      _buildOverlay();
      _renderCategories();
      var input = document.getElementById('report-details-input');
      if (input) input.value = '';
      var counter = document.getElementById('report-char-count');
      if (counter) counter.textContent = '0/500';
      var submitBtn = document.getElementById('report-submit-btn');
      if (submitBtn) submitBtn.disabled = true;
      var actions = document.querySelector('.report-actions');
      if (actions) actions.style.display = '';
    }

    requestAnimationFrame(function() {
      document.getElementById('report-overlay').classList.add('open');
    });
  }

  function closeReportDialog() {
    var overlay = document.getElementById('report-overlay');
    if (overlay) {
      overlay.classList.remove('open');
      setTimeout(function() { overlay.remove(); }, 300);
    }
    _currentReportUserId = null;
    _currentReportUserName = null;
  }

  async function submitReport(reason, details) {
    if (!reason) reason = _getSelectedCategory();
    if (!reason) return;
    var reporterId = _uid();
    var reportedUserId = _currentReportUserId;
    if (!reporterId || !reportedUserId) {
      _showToast('Unable to submit report', 'error');
      return;
    }
    var detailsInput = document.getElementById('report-details-input');
    var reportDetails = details || (detailsInput ? detailsInput.value.trim() : '');
    if (reportDetails.length > 500) reportDetails = reportDetails.substring(0, 500);

    try {
      await db.collection('userReports').add({
        reporterUserId: reporterId,
        reportedUserId: reportedUserId,
        reason: reason,
        details: reportDetails,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        chatId: _chatId() || null
      });
      _showConfirmation();
      _showToast('Report submitted', 'success');
    } catch (e) {
      if (window.__DEBUG__) console.error('[Report] submit failed', e);
      _showToast('Failed to submit report', 'error');
    }
  }

  window._reportSubmit = function() {
    var reason = _getSelectedCategory();
    if (!reason) return;
    submitReport(reason);
  };

  window.openReportUser = openReportUser;
  window.submitReport = submitReport;
  window.closeReportDialog = closeReportDialog;
})();
