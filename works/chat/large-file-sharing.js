'use strict';
/**
 * LARGE FILE SHARING — Support for files up to 100MB
 * Chunked upload for large files using Firebase Storage.
 */
(function () {
  const LargeFileSharing = {
    MAX_SIZE: 100 * 1024 * 1024, // 100MB
    CHUNK_SIZE: 5 * 1024 * 1024, // 5MB chunks

    canShare() {
      const input = document.createElement('input');
      return typeof input.webkitdirectory === 'undefined' || true;
    },

    validateFile(file) {
      if (!file) return { valid: false, error: 'No file selected' };
      if (file.size > this.MAX_SIZE) {
        return { valid: false, error: `File too large (${this._formatSize(file.size)}). Maximum is 100MB.` };
      }
      const blockedTypes = ['application/x-executable', 'application/x-msdownload', 'application/x-ms-dos-executable'];
      if (blockedTypes.includes(file.type)) {
        return { valid: false, error: 'Executable files are not allowed for security.' };
      }
      return { valid: true };
    },

    async uploadLargeFile(file, onProgress) {
      if (typeof window.uploadToFirebaseStorage === 'function') {
        return await window.uploadToFirebaseStorage(file, 'chat_uploads');
      }

      const storage = window.firebase?.storage?.();
      if (!storage) throw new Error('Storage not available');

      const uid = window.App?.uid?.() || window.currentUser?.uid;
      if (!uid) throw new Error('Not authenticated');

      const path = `chat_uploads/${uid}/${Date.now()}_${file.name}`;
      const ref = storage.ref(path);

      if (file.size <= this.CHUNK_SIZE) {
        const task = ref.put(file);
        task.on('state_changed',
          (snap) => {
            if (onProgress) onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          }
        );
        const snapshot = await task;
        return snapshot.ref.getDownloadURL();
      }

      // Resumable upload for large files
      const metadata = { contentType: file.type, customMetadata: { originalName: file.name } };
      const uploadTask = ref.put(file, metadata);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) onProgress(progress);
        },
        (error) => { throw error; }
      );

      const snapshot = await uploadTask;
      return snapshot.ref.getDownloadURL();
    },

    _formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    },

    showUploadProgress(fileName, progress) {
      let bar = document.getElementById('large-upload-progress');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'large-upload-progress';
        bar.style.cssText = 'position:fixed;bottom:140px;left:50%;transform:translateX(-50%);z-index:95;padding:10px 20px;border-radius:12px;background:rgba(30,30,46,0.95);backdrop-filter:blur(12px);color:var(--on-surface,#fff);font-size:13px;display:flex;align-items:center;gap:10px;min-width:250px;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
        document.body.appendChild(bar);
      }
      bar.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary,#00a884);">upload</span>
        <div style="flex:1;">
          <div style="font-weight:600;margin-bottom:4px;">${this._esc(fileName.slice(0, 30))}</div>
          <div style="height:4px;background:var(--surface-variant,#333);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${progress}%;background:var(--primary,#00a884);border-radius:2px;transition:width 0.3s;"></div>
          </div>
        </div>
        <span style="font-size:12px;font-weight:600;color:var(--primary,#00a884);">${progress}%</span>
      `;
      bar.style.display = 'flex';

      if (progress >= 100) {
        setTimeout(() => bar.remove(), 2000);
      }
    },

    _esc(s) {
      return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    }
  };

  window.LargeFileSharing = LargeFileSharing;
})();
