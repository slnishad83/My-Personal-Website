/* ============================================================
   BACKUP & RESTORE — export/import chat settings.
   - File backup: downloads a JSON file of non-sensitive
     localStorage entries + manifest.
   - File restore: imports a previously exported file.
   - Cloud backup: stores the latest snapshot under
     users/{uid}/backups/latest (Firestore, owner-only).
   ============================================================ */
(function () {
  'use strict';

  var APP_TAG = 'nsl-chat';
  var BACKUP_VERSION = 1;
  var SENSITIVE_PATTERNS = /(token|session|idtoken|jwt|refresh|credential|password|pin|e2e|keypair|secret|private)/i;
  var _modal = null;

  function _db() {
    return (window.App && window.App.db) || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  }
  function _uid() {
    return (window.currentUser && window.currentUser.uid) ||
      (window.App && window.App.auth && window.App.auth.currentUser && window.App.auth.currentUser.uid) ||
      null;
  }
  function _toast(m, t) { if (typeof window.showToast === 'function') window.showToast(m, t); }
  function _esc(s) {
    return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
  }

  function _styles() {
    if (document.getElementById('backup-style')) return;
    var css = [
      '.backup-sheet{position:fixed;left:0;right:0;bottom:0;z-index:70;background:var(--surface-container-low,#fff);' +
        'border-radius:20px 20px 0 0;max-height:86vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,0.22);animation:backupUp 0.25s ease;}',
      '@keyframes backupUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '.backup-sheet .bk-head{position:sticky;top:0;background:inherit;padding:16px 18px 12px;display:flex;align-items:center;gap:10px;' +
        'border-bottom:1px solid var(--outline-variant,rgba(0,0,0,0.08));}',
      '.backup-sheet .bk-body{padding:16px 18px 26px;}',
      '.bk-row{display:flex;align-items:center;gap:12px;padding:13px;border-radius:14px;background:var(--surface-container,#f0f2f5);' +
        'cursor:pointer;margin-bottom:10px;transition:transform 0.1s ease;}',
      '.bk-row:active{transform:scale(0.98);}',
      '.bk-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:22px;' +
        'border:none;cursor:pointer;font-size:13px;font-weight:600;transition:filter 0.12s ease;}',
      '.bk-btn:active{filter:brightness(0.92);}',
      '.bk-btn-primary{background:var(--primary,#00a884);color:#fff;width:100%;}',
      '.bk-btn-ghost{background:var(--surface-container,#f0f2f5);color:var(--on-surface,#1c1c1e);}',
      '.bk-meta{font-size:11px;color:var(--on-surface-variant,#8696a0);}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'backup-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function _closeModal() {
    if (_modal) { _modal.remove(); _modal = null; }
    var ov = document.getElementById('backup-overlay');
    if (ov) ov.remove();
  }

  function openSettings() {
    _styles();
    if (document.getElementById('backup-overlay')) return;
    var ov = document.createElement('div');
    ov.id = 'backup-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:69;background:rgba(0,0,0,0.4);animation:fadeIn 0.2s ease;';
    ov.addEventListener('click', _closeModal);
    document.body.appendChild(ov);

    _modal = document.createElement('div');
    _modal.className = 'backup-sheet';
    _modal.innerHTML =
      '<div class="bk-head"><span class="material-symbols-outlined" style="font-size:22px;color:var(--primary,#00a884)">backup</span>' +
      '<h2 style="flex:1;font-size:17px;font-weight:700;margin:0;color:var(--on-surface,#1c1c1e);">Backup & Restore</h2>' +
      '<span class="material-symbols-outlined" style="font-size:22px;color:var(--on-surface-variant,#8696a0);cursor:pointer" onclick="window.BackupManager && BackupManager.close()">close</span></div>' +
      '<div class="bk-body">' +
      '<div class="bk-row" onclick="window.BackupManager && BackupManager.exportFile()">' +
      '<span class="material-symbols-outlined" style="color:var(--primary,#00a884)">download</span>' +
      '<div style="flex:1"><div style="font-weight:600;font-size:14px;color:var(--on-surface,#1c1c1e);">Back up to file</div>' +
      '<div class="bk-meta">Download settings as a JSON file</div></div></div>' +
      '<div class="bk-row" onclick="document.getElementById(\'bk-file-input\') && document.getElementById(\'bk-file-input\').click()">' +
      '<span class="material-symbols-outlined" style="color:var(--primary,#00a884)">upload</span>' +
      '<div style="flex:1"><div style="font-weight:600;font-size:14px;color:var(--on-surface,#1c1c1e);">Restore from file</div>' +
      '<div class="bk-meta">Import a previously exported file</div></div></div>' +
      '<input type="file" id="bk-file-input" accept=".json,application/json" style="display:none" />' +
      '<button class="bk-btn bk-btn-ghost" style="width:100%;margin-top:4px" onclick="window.BackupManager && BackupManager.cloudBackup()">' +
      '<span class="material-symbols-outlined" style="font-size:16px">cloud_upload</span>Back up to cloud</button>' +
      '<div id="bk-cloud-list"><div class="bk-meta" style="text-align:center;padding:8px;">Loading cloud backups…</div></div>' +
      '</div>';
    document.body.appendChild(_modal);

    var input = _modal.querySelector('#bk-file-input');
    if (input) input.addEventListener('change', function (e) { BackupManager.restoreFile(e.target); });

    _renderCloudList();
  }

  function _collectStorage() {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || SENSITIVE_PATTERNS.test(key)) continue;
      try { data[key] = localStorage.getItem(key); } catch (_) {}
    }
    return data;
  }

  function _buildSnapshot() {
    var uid = _uid();
    return {
      app: APP_TAG,
      backupVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      user: uid || null,
      storage: _collectStorage()
    };
  }

  function exportFile() {
    try {
      var data = JSON.stringify(_buildSnapshot(), null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'nsl-chat-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      _toast('Backup downloaded', 'success');
    } catch (e) {
      if (window.__DEBUG__) console.warn('[Backup] export failed:', e);
      _toast('Export failed', 'error');
    }
  }

  function restoreFile(input) {
    var file = input && input.files && input.files[0];
    input.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || data.app !== APP_TAG || !data.storage) {
          _toast('Not a valid NSL Chat backup file', 'error');
          return;
        }
        var count = 0;
        Object.keys(data.storage).forEach(function (k) {
          if (SENSITIVE_PATTERNS.test(k)) return;
          try { localStorage.setItem(k, data.storage[k]); count++; } catch (_) {}
        });
        _toast('Restored ' + count + ' settings', 'success');
        setTimeout(function () { try { location.reload(); } catch (_) {} }, 900);
      } catch (e) {
        _toast('Could not read backup file', 'error');
      }
    };
    reader.readAsText(file);
  }

  async function cloudBackup() {
    var db = _db();
    var uid = _uid();
    if (!db || !uid) { _toast('Sign in to back up to the cloud', 'error'); return; }
    try {
      var snapshot = _buildSnapshot();
      await db.collection('users').doc(uid).collection('backups').doc('latest').set({
        data: snapshot,
        size: JSON.stringify(snapshot).length,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      _toast('Cloud backup saved', 'success');
      _renderCloudList();
    } catch (e) {
      if (window.__DEBUG__) console.warn('[Backup] cloudBackup failed:', e);
      _toast('Cloud backup failed', 'error');
    }
  }

  async function _renderCloudList() {
    var db = _db();
    var uid = _uid();
    var container = _modal && _modal.querySelector('#bk-cloud-list');
    if (!container) return;
    if (!db || !uid) {
      container.innerHTML = '<div class="bk-meta" style="text-align:center;padding:8px;">Sign in to use cloud backup</div>';
      return;
    }
    container.innerHTML = '<div class="bk-meta" style="text-align:center;padding:8px;">Loading cloud backups…</div>';
    try {
      var snap = await db.collection('users').doc(uid).collection('backups').orderBy('createdAt', 'desc').limit(3).get();
      if (snap.empty) {
        container.innerHTML = '<div class="bk-meta" style="text-align:center;padding:8px;">No cloud backups yet</div>';
        return;
      }
      container.innerHTML = '<h3 style="font-size:12px;font-weight:700;color:var(--on-surface-variant,#8696a0);margin:12px 0 8px;">CLOUD BACKUPS</h3>' +
        snap.docs.map(function (d) {
          var b = d.data() || {};
          var ts = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
          var label = ts ? new Date(ts).toLocaleString() : d.id;
          return '<div class="bk-row" data-id="' + d.id + '">' +
            '<span class="material-symbols-outlined" style="color:var(--primary,#00a884);font-size:20px">cloud_done</span>' +
            '<div style="flex:1"><div style="font-weight:600;font-size:14px;color:var(--on-surface,#1c1c1e);">' + _esc(label) + '</div>' +
            '<div class="bk-meta">' + (b.size || 0) + ' bytes</div></div>' +
            '<span class="material-symbols-outlined" style="color:var(--on-surface-variant,#8696a0);font-size:18px">restore</span></div>';
        }).join('');
      container.querySelectorAll('.bk-row[data-id]').forEach(function (el) {
        el.addEventListener('click', function () { BackupManager.restoreCloud(el.dataset.id); });
      });
    } catch (e) {
      container.innerHTML = '<div class="bk-meta" style="text-align:center;padding:8px;">Could not load cloud backups</div>';
    }
  }

  async function restoreCloud(backupId) {
    var db = _db();
    var uid = _uid();
    if (!db || !uid) return;
    try {
      var snap = await db.collection('users').doc(uid).collection('backups').doc(backupId).get();
      if (!snap.exists) { _toast('Backup not found', 'error'); return; }
      var data = (snap.data() && snap.data().data) || null;
      if (!data || !data.storage) { _toast('Backup is corrupted', 'error'); return; }
      var count = 0;
      Object.keys(data.storage).forEach(function (k) {
        if (SENSITIVE_PATTERNS.test(k)) return;
        try { localStorage.setItem(k, data.storage[k]); count++; } catch (_) {}
      });
      _toast('Restored ' + count + ' settings from cloud', 'success');
      setTimeout(function () { try { location.reload(); } catch (_) {} }, 900);
    } catch (e) {
      if (window.__DEBUG__) console.warn('[Backup] restoreCloud failed:', e);
      _toast('Restore failed', 'error');
    }
  }

  window.BackupManager = {
    openSettings: openSettings,
    close: _closeModal,
    exportFile: exportFile,
    restoreFile: restoreFile,
    cloudBackup: cloudBackup,
    restoreCloud: restoreCloud
  };
})();
