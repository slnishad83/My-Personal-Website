// Cloud Drive Integration — Google Drive & OneDrive file picker
(function() {
  'use strict';

  const GOOGLE_CLIENT_ID = '';
  const GOOGLE_API_KEY = '';
  const ONEDRIVE_CLIENT_ID = '';

  window.openGoogleDrivePicker = function() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
      showToast('Google Drive integration requires API credentials. Add them to cloud-drive.js', 'info');
      _showManualDriveUpload('Google Drive');
      return;
    }

    const token = localStorage.getItem('gdrive_access_token');
    if (token) {
      _showGoogleDrivePicker(token);
    } else {
      _initGoogleDriveAuth();
    }
  };

  window.openOneDrivePicker = function() {
    if (!ONEDRIVE_CLIENT_ID) {
      showToast('OneDrive integration requires a Client ID. Add it to cloud-drive.js', 'info');
      _showManualDriveUpload('OneDrive');
      return;
    }

    const redirectUri = window.location.origin + window.location.pathname;
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${ONEDRIVE_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=files.read.all&state=onedrive`;
    const popup = window.open(url, 'onedrive-auth', 'width=600,height=600');

    const handler = (e) => {
      if (e.data && e.data.type === 'onedrive_token') {
        window.removeEventListener('message', handler);
        if (popup) popup.close();
        _showOneDrivePicker(e.data.token);
      }
    };
    window.addEventListener('message', handler);

    const poll = setInterval(() => {
      try {
        if (popup && popup.closed) {
          clearInterval(poll);
          window.removeEventListener('message', handler);
        }
      } catch(_) {}
    }, 1000);
  };

  function _initGoogleDriveAuth() {
    const redirectUri = window.location.origin + window.location.pathname;
    const scope = 'https://www.googleapis.com/auth/drive.readonly';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=select_account`;
    window.open(url, 'gdrive-auth', 'width=600,height=600');
    showToast('Sign in to Google Drive in the popup', 'info');
  }

  function _showGoogleDrivePicker(token) {
    const overlay = _createPickerOverlay('Google Drive');
    const content = overlay.querySelector('.picker-content');

    content.innerHTML = '<div style="text-align:center;padding:20px"><div class="material-symbols-outlined text-4xl animate-spin" style="color:var(--primary)">hourglass_empty</div><p style="margin-top:8px;color:var(--on-surface-variant)">Loading files...</p></div>';

    fetch('https://www.googleapis.com/drive/v3/files?pageSize=30&fields=files(id,name,mimeType,size,modifiedTime,thumbnailLink)&q=mimeType!=\'application/vnd.google-apps.folder\'&orderBy=modifiedTime desc', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(r => r.json())
    .then(data => {
      if (data.error) throw new Error(data.error.message);
      _renderDriveFiles(content, data.files || [], 'gdrive', token);
    })
    .catch(e => {
      content.innerHTML = `<div style="text-align:center;padding:20px"><p style="color:var(--error)">Failed to load files: ${e.message}</p><button onclick="openGoogleDrivePicker()" style="margin-top:8px;padding:8px 16px;background:var(--primary);color:var(--on-primary);border:none;border-radius:8px;cursor:pointer">Retry</button></div>`;
    });

    document.body.appendChild(overlay);
  }

  function _showOneDrivePicker(token) {
    const overlay = _createPickerOverlay('OneDrive');
    const content = overlay.querySelector('.picker-content');

    content.innerHTML = '<div style="text-align:center;padding:20px"><div class="material-symbols-outlined text-4xl animate-spin" style="color:var(--primary)">hourglass_empty</div><p style="margin-top:8px;color:var(--on-surface-variant)">Loading files...</p></div>';

    fetch('https://graph.microsoft.com/v1.0/me/drive/root/children?top=30&select=id,name,size,file,folder,webUrl,thumbnails', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(r => r.json())
    .then(data => {
      if (data.error) throw new Error(data.error.message);
      const files = (data.value || []).filter(f => f.file);
      _renderDriveFiles(content, files, 'onedrive', token);
    })
    .catch(e => {
      content.innerHTML = `<div style="text-align:center;padding:20px"><p style="color:var(--error)">Failed to load files: ${e.message}</p><button onclick="openOneDrivePicker()" style="margin-top:8px;padding:8px 16px;background:var(--primary);color:var(--on-primary);border:none;border-radius:8px;cursor:pointer">Retry</button></div>`;
    });

    document.body.appendChild(overlay);
  }

  function _renderDriveFiles(content, files, source, token) {
    if (!files.length) {
      content.innerHTML = '<div style="text-align:center;padding:20px;color:var(--on-surface-variant)">No files found</div>';
      return;
    }

    let html = '<div style="display:flex;flex-direction:column;gap:4px;max-height:60vh;overflow-y:auto">';
    files.forEach(file => {
      const name = file.name || 'Unnamed';
      const size = file.size ? _fmtSize(file.size) : '';
      const icon = _getFileIcon(name);
      const thumb = file.thumbnailLink || file.thumbnails?.[0]?.medium?.url || '';

      html += `<div class="drive-file-item" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='var(--surface-container,rgba(0,0,0,0.06))'" onmouseout="this.style.background='transparent'" onclick="_downloadDriveFile('${source}','${file.id}','${_escapeStr(name)}',this)">`;
      if (thumb) {
        html += `<img src="${thumb}" style="width:40px;height:40px;border-radius:6px;object-fit:cover">`;
      } else {
        html += `<div style="width:40px;height:40px;border-radius:6px;background:var(--surface-container,rgba(0,0,0,0.06));display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:20px;color:var(--primary)">${icon}</span></div>`;
      }
      html += '<div style="flex:1;min-width:0">';
      html += `<div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_escapeHtml(name)}</div>`;
      html += `<div style="font-size:11px;color:var(--on-surface-variant)">${size}</div>`;
      html += '</div>';
      html += '<span class="material-symbols-outlined" style="font-size:18px;color:var(--on-surface-variant)">download</span>';
      html += '</div>';
    });
    html += '</div>';

    content.innerHTML = html;
  }

  window._downloadDriveFile = async function(source, fileId, fileName, el) {
    if (el) {
      el.innerHTML = '<div style="display:flex;align-items:center;gap:12px;padding:10px 12px"><div class="material-symbols-outlined animate-spin" style="font-size:18px;color:var(--primary)">hourglass_empty</div><span style="font-size:13px">Downloading...</span></div>';
    }

    try {
      let blob;
      if (source === 'gdrive') {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('gdrive_access_token') }
        });
        blob = await res.blob();
      } else {
        const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('onedrive_token') }
        });
        blob = await res.blob();
      }

      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      document.getElementById('drive-picker-overlay')?.remove();

      if (typeof _sendFileMessage === 'function') {
        _sendFileMessage(file);
      }
      showToast('File downloaded and sending...', 'success');
    } catch (e) {
      showToast('Failed to download file: ' + e.message, 'error');
      if (el) el.remove();
    }
  };

  function _createPickerOverlay(title) {
    const overlay = document.createElement('div');
    overlay.id = 'drive-picker-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:16px;padding:20px;max-width:480px;width:92vw;max-height:85vh;display:flex;flex-direction:column;gap:12px';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--on-surface)">Attach from ${title}</h3>
        <button onclick="document.getElementById('drive-picker-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px">&times;</button>
      </div>
      <div class="picker-content" style="flex:1;overflow-y:auto"></div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    return overlay;
  }

  function _showManualDriveUpload(driveName) {
    const overlay = document.createElement('div');
    overlay.id = 'drive-picker-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:16px;padding:24px;max-width:400px;width:90vw;text-align:center;color:var(--on-surface)';

    panel.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:48px;color:var(--primary);margin-bottom:12px">cloud_upload</span>
      <h3 style="margin:0 0 8px;font-size:18px;font-weight:700">Upload from ${driveName}</h3>
      <p style="font-size:13px;color:var(--on-surface-variant);margin:0 0 16px">Download the file from ${driveName} first, then attach it here.</p>
      <div style="display:flex;gap:8px;justify-content:center">
        <button onclick="document.getElementById('drive-picker-overlay')?.remove()" style="padding:10px 20px;border-radius:10px;border:none;background:var(--surface-variant);color:var(--on-surface);font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
        <button onclick="document.getElementById('drive-picker-overlay')?.remove();attachDocument()" style="padding:10px 20px;border-radius:10px;border:none;background:var(--primary);color:var(--on-primary);font-size:13px;font-weight:600;cursor:pointer">Choose File</button>
      </div>`;

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function _getFileIcon(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const map = {
      pdf: 'picture_as_pdf', doc: 'description', docx: 'description',
      xls: 'table_chart', xlsx: 'table_chart', csv: 'table_chart',
      ppt: 'slideshow', pptx: 'slideshow',
      zip: 'folder_zip', rar: 'folder_zip', '7z': 'folder_zip',
      mp4: 'videocam', avi: 'videocam', mov: 'videocam',
      mp3: 'audiotrack', wav: 'audiotrack',
      jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
      txt: 'article', md: 'article'
    };
    return map[ext] || 'description';
  }

  function _fmtSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0, s = bytes;
    while (s >= 1024 && i < units.length - 1) { s /= 1024; i++; }
    return s.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }

  function _escapeStr(s) { return s.replace(/'/g, "\\'").replace(/"/g, '\\"'); }
  function _escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
})();
