// Collaborative Whiteboard — shared drawing canvas inside a chat
(function() {
  'use strict';

  let _wbCanvas, _wbCtx, _wbDrawing = false;
  let _wbTool = 'pen', _wbColor = '#7C4DFF', _wbSize = 3;
  let _wbHistory = [], _wbRedoStack = [];
  let _wbUnsubscribe = null;
  let _wbSessionId = null;

  window.openWhiteboard = function() {
    if (!App.currentChat) { showToast('Open a chat first', 'info'); return; }

    const existing = document.getElementById('whiteboard-overlay');
    if (existing) { existing.remove(); return; }

    _wbSessionId = 'wb_' + App.currentChat.id;
    _wbHistory = [];
    _wbRedoStack = [];

    const overlay = document.createElement('div');
    overlay.id = 'whiteboard-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;animation:fadeIn 0.2s ease';

    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(0,0,0,0.5)">
        <div style="display:flex;align-items:center;gap:8px">
          <button onclick="closeWhiteboard()" style="background:none;border:none;color:white;cursor:pointer"><span class="material-symbols-outlined">close</span></button>
          <span style="color:white;font-weight:700;font-size:15px">Whiteboard</span>
          <span id="wb-remote-cursor-label" style="font-size:11px;color:rgba(255,255,255,0.5);margin-left:8px"></span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button onclick="wbUndo()" title="Undo" style="background:rgba(255,255,255,0.1);border:none;color:white;width:34px;height:34px;border-radius:8px;cursor:pointer"><span class="material-symbols-outlined" style="font-size:18px">undo</span></button>
          <button onclick="wbRedo()" title="Redo" style="background:rgba(255,255,255,0.1);border:none;color:white;width:34px;height:34px;border-radius:8px;cursor:pointer"><span class="material-symbols-outlined" style="font-size:18px">redo</span></button>
          <button onclick="wbClear()" title="Clear" style="background:rgba(255,255,255,0.1);border:none;color:white;width:34px;height:34px;border-radius:8px;cursor:pointer"><span class="material-symbols-outlined" style="font-size:18px">delete</span></button>
          <button onclick="wbSendAsImage()" title="Send as Image" style="background:var(--primary,#7C4DFF);border:none;color:white;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px"><span class="material-symbols-outlined" style="font-size:16px">send</span>Send</button>
        </div>
      </div>
      <div style="flex:1;position:relative;overflow:hidden;display:flex">
        <canvas id="wb-canvas" style="width:100%;height:100%;cursor:crosshair;background:#1a1a2e;touch-action:none"></canvas>
        <canvas id="wb-remote-canvas" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></canvas>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;background:rgba(0,0,0,0.5);flex-wrap:wrap">
        <div style="display:flex;gap:4px">
          <button onclick="wbSetTool('pen')" class="wb-tool-btn active" data-tool="pen" style="width:36px;height:36px;border-radius:8px;border:2px solid var(--primary);background:rgba(124,77,255,0.2);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px">edit</span></button>
          <button onclick="wbSetTool('highlighter')" class="wb-tool-btn" data-tool="highlighter" style="width:36px;height:36px;border-radius:8px;border:2px solid transparent;background:rgba(255,255,255,0.06);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px">ink_highlighter</span></button>
          <button onclick="wbSetTool('eraser')" class="wb-tool-btn" data-tool="eraser" style="width:36px;height:36px;border-radius:8px;border:2px solid transparent;background:rgba(255,255,255,0.06);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px">ink_eraser</span></button>
          <button onclick="wbSetTool('line')" class="wb-tool-btn" data-tool="line" style="width:36px;height:36px;border-radius:8px;border:2px solid transparent;background:rgba(255,255,255,0.06);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px">horizontal_rule</span></button>
          <button onclick="wbSetTool('rect')" class="wb-tool-btn" data-tool="rect" style="width:36px;height:36px;border-radius:8px;border:2px solid transparent;background:rgba(255,255,255,0.06);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px">rectangle</span></button>
          <button onclick="wbSetTool('circle')" class="wb-tool-btn" data-tool="circle" style="width:36px;height:36px;border-radius:8px;border:2px solid transparent;background:rgba(255,255,255,0.06);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:18px">circle</span></button>
        </div>
        <div style="width:1px;height:24px;background:rgba(255,255,255,0.15)"></div>
        <div style="display:flex;gap:4px">
          ${['#7C4DFF','#FF4081','#00E676','#FFEA00','#FF6D00','#00BCD4','#FFFFFF','#9E9E9E'].map(c =>
            `<button onclick="wbSetColor('${c}')" class="wb-color-btn" style="width:24px;height:24px;border-radius:50%;border:2px solid ${c === _wbColor ? 'white' : 'transparent'};background:${c};cursor:pointer;transition:border-color 0.15s" data-color="${c}"></button>`
          ).join('')}
        </div>
        <div style="width:1px;height:24px;background:rgba(255,255,255,0.15)"></div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:rgba(255,255,255,0.5)">Size</span>
          <input type="range" min="1" max="20" value="${_wbSize}" onchange="wbSetSize(this.value)" style="width:80px;accent-color:var(--primary)">
        </div>
      </div>`;

    document.body.appendChild(overlay);

    _wbCanvas = document.getElementById('wb-canvas');
    _wbCtx = _wbCanvas.getContext('2d');
    _resizeWbCanvas();
    window.addEventListener('resize', _resizeWbCanvas);

    _wbCanvas.addEventListener('pointerdown', _wbPointerDown);
    _wbCanvas.addEventListener('pointermove', _wbPointerMove);
    _wbCanvas.addEventListener('pointerup', _wbPointerUp);
    _wbCanvas.addEventListener('pointerleave', _wbPointerUp);

    _wbStartFirebaseSync();
  };

  function _resizeWbCanvas() {
    if (!_wbCanvas) return;
    const rect = _wbCanvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    _wbCanvas.width = rect.width * dpr;
    _wbCanvas.height = rect.height * dpr;
    _wbCtx.scale(dpr, dpr);
    _wbRedraw();
  }

  let _wbStartX, _wbStartY, _wbSnapshot;

  function _wbPointerDown(e) {
    _wbDrawing = true;
    const rect = _wbCanvas.getBoundingClientRect();
    _wbStartX = e.clientX - rect.left;
    _wbStartY = e.clientY - rect.top;

    if (['line', 'rect', 'circle'].includes(_wbTool)) {
      _wbSnapshot = _wbCtx.getImageData(0, 0, _wbCanvas.width, _wbCanvas.height);
    }

    if (_wbTool === 'pen' || _wbTool === 'highlighter') {
      _wbCtx.beginPath();
      _wbCtx.moveTo(_wbStartX, _wbStartY);
    }
  }

  function _wbPointerMove(e) {
    if (!_wbDrawing) return;
    const rect = _wbCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (_wbTool === 'pen') {
      _wbCtx.strokeStyle = _wbColor;
      _wbCtx.lineWidth = _wbSize;
      _wbCtx.lineCap = 'round';
      _wbCtx.lineJoin = 'round';
      _wbCtx.globalAlpha = 1;
      _wbCtx.lineTo(x, y);
      _wbCtx.stroke();
    } else if (_wbTool === 'highlighter') {
      _wbCtx.strokeStyle = _wbColor;
      _wbCtx.lineWidth = _wbSize * 4;
      _wbCtx.lineCap = 'round';
      _wbCtx.lineJoin = 'round';
      _wbCtx.globalAlpha = 0.3;
      _wbCtx.lineTo(x, y);
      _wbCtx.stroke();
      _wbCtx.globalAlpha = 1;
    } else if (_wbTool === 'eraser') {
      _wbCtx.globalCompositeOperation = 'destination-out';
      _wbCtx.beginPath();
      _wbCtx.arc(x, y, _wbSize * 3, 0, Math.PI * 2);
      _wbCtx.fill();
      _wbCtx.globalCompositeOperation = 'source-over';
    } else if (['line', 'rect', 'circle'].includes(_wbTool)) {
      _wbCtx.putImageData(_wbSnapshot, 0, 0);
      _wbCtx.strokeStyle = _wbColor;
      _wbCtx.lineWidth = _wbSize;
      _wbCtx.lineCap = 'round';

      if (_wbTool === 'line') {
        _wbCtx.beginPath();
        _wbCtx.moveTo(_wbStartX, _wbStartY);
        _wbCtx.lineTo(x, y);
        _wbCtx.stroke();
      } else if (_wbTool === 'rect') {
        _wbCtx.strokeRect(_wbStartX, _wbStartY, x - _wbStartX, y - _wbStartY);
      } else if (_wbTool === 'circle') {
        const rx = Math.abs(x - _wbStartX) / 2;
        const ry = Math.abs(y - _wbStartY) / 2;
        const cx = _wbStartX + (x - _wbStartX) / 2;
        const cy = _wbStartY + (y - _wbStartY) / 2;
        _wbCtx.beginPath();
        _wbCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        _wbCtx.stroke();
      }
    }

    _wbBroadcastStroke(e.clientX - rect.left, e.clientY - rect.top);
  }

  function _wbPointerUp() {
    if (!_wbDrawing) return;
    _wbDrawing = false;
    _wbSaveState();
    _wbBroadcastStrokeEnd();
  }

  function _wbSaveState() {
    if (!_wbCanvas) return;
    _wbHistory.push(_wbCanvas.toDataURL());
    _wbRedoStack = [];
    if (_wbHistory.length > 50) _wbHistory.shift();
  }

  window.wbUndo = function() {
    if (_wbHistory.length < 2) return;
    _wbRedoStack.push(_wbHistory.pop());
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      _wbCtx.clearRect(0, 0, _wbCanvas.width / dpr, _wbCanvas.height / dpr);
      _wbCtx.drawImage(img, 0, 0, _wbCanvas.width / dpr, _wbCanvas.height / dpr);
    };
    img.src = _wbHistory[_wbHistory.length - 1];
  };

  window.wbRedo = function() {
    if (!_wbRedoStack.length) return;
    const state = _wbRedoStack.pop();
    _wbHistory.push(state);
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      _wbCtx.clearRect(0, 0, _wbCanvas.width / dpr, _wbCanvas.height / dpr);
      _wbCtx.drawImage(img, 0, 0, _wbCanvas.width / dpr, _wbCanvas.height / dpr);
    };
    img.src = state;
  };

  window.wbClear = function() {
    if (!_wbCanvas || !_wbCtx) return;
    const dpr = window.devicePixelRatio || 1;
    _wbCtx.clearRect(0, 0, _wbCanvas.width / dpr, _wbCanvas.height / dpr);
    _wbSaveState();
  };

  window.wbSetTool = function(tool) {
    _wbTool = tool;
    document.querySelectorAll('.wb-tool-btn').forEach(b => {
      b.style.borderColor = b.dataset.tool === tool ? 'var(--primary)' : 'transparent';
      b.style.background = b.dataset.tool === tool ? 'rgba(124,77,255,0.2)' : 'rgba(255,255,255,0.06)';
    });
    _wbCanvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
  };

  window.wbSetColor = function(color) {
    _wbColor = color;
    document.querySelectorAll('.wb-color-btn').forEach(b => {
      b.style.borderColor = b.dataset.color === color ? 'white' : 'transparent';
    });
  };

  window.wbSetSize = function(size) {
    _wbSize = parseInt(size) || 3;
  };

  window.wbSendAsImage = function() {
    if (!_wbCanvas) return;
    _wbCanvas.toBlob(blob => {
      if (!blob) { showToast('Nothing to send', 'info'); return; }
      const file = new File([blob], 'whiteboard-' + Date.now() + '.png', { type: 'image/png' });
      closeWhiteboard();
      if (typeof _sendFileMessage === 'function') {
        _sendFileMessage(file);
      }
      showToast('Whiteboard sent', 'success');
    }, 'image/png');
  };

  window.closeWhiteboard = function() {
    const overlay = document.getElementById('whiteboard-overlay');
    if (overlay) overlay.remove();
    window.removeEventListener('resize', _resizeWbCanvas);
    _wbStopFirebaseSync();
    _wbCanvas = null;
    _wbCtx = null;
  };

  function _wbRedraw() {
    if (_wbHistory.length && _wbCanvas) {
      const img = new Image();
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1;
        _wbCtx.drawImage(img, 0, 0, _wbCanvas.width / dpr, _wbCanvas.height / dpr);
      };
      img.src = _wbHistory[_wbHistory.length - 1];
    }
  }

  function _wbStartFirebaseSync() {
    if (!App.db || !_wbSessionId) return;
    try {
      const strokesRef = App.db.collection('whiteboards').doc(_wbSessionId).collection('strokes');
      _wbUnsubscribe = strokesRef.orderBy('timestamp').onSnapshot(snap => {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.type === 'stroke') _drawRemoteStroke(data);
            if (data.type === 'clear') {
              const dpr = window.devicePixelRatio || 1;
              _wbCtx?.clearRect(0, 0, _wbCanvas?.width / dpr || 0, _wbCanvas?.height / dpr || 0);
            }
          }
        });
      });
    } catch (e) {
      console.warn('Whiteboard sync init failed:', e);
    }
  }

  function _wbStopFirebaseSync() {
    if (_wbUnsubscribe) { _wbUnsubscribe(); _wbUnsubscribe = null; }
    _wbSessionId = null;
  }

  let _wbBroadcastBuffer = [];

  function _wbBroadcastStroke(x, y) {
    _wbBroadcastBuffer.push({ x, y });
    if (_wbBroadcastBuffer.length < 5 || !App.db || !_wbSessionId) return;
    _flushBroadcastBuffer();
  }

  function _wbBroadcastStrokeEnd() {
    if (!App.db || !_wbSessionId || !_wbBroadcastBuffer.length) return;
    _flushBroadcastBuffer(true);
  }

  function _flushBroadcastBuffer(final = false) {
    if (!_wbBroadcastBuffer.length || !App.db || !_wbSessionId) return;
    const points = [..._wbBroadcastBuffer];
    _wbBroadcastBuffer = [];

    try {
      App.db.collection('whiteboards').doc(_wbSessionId).collection('strokes').add({
        type: 'stroke',
        tool: _wbTool,
        color: _wbTool === 'eraser' ? 'eraser' : _wbColor,
        size: _wbSize,
        points: points,
        final: final,
        senderId: App.auth?.currentUser?.uid || '',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    } catch(_) {}
  }

  function _drawRemoteStroke(data) {
    if (!_wbCtx || !_wbCanvas || !data.points?.length) return;
    const dpr = window.devicePixelRatio || 1;
    _wbCtx.save();

    if (data.tool === 'eraser' || data.color === 'eraser') {
      _wbCtx.globalCompositeOperation = 'destination-out';
      data.points.forEach(p => {
        _wbCtx.beginPath();
        _wbCtx.arc(p.x / dpr, p.y / dpr, (data.size || 3) * 3, 0, Math.PI * 2);
        _wbCtx.fill();
      });
    } else {
      _wbCtx.globalCompositeOperation = 'source-over';
      _wbCtx.strokeStyle = data.color || '#7C4DFF';
      _wbCtx.lineWidth = (data.size || 3) * (data.tool === 'highlighter' ? 4 : 1);
      _wbCtx.lineCap = 'round';
      _wbCtx.lineJoin = 'round';
      _wbCtx.globalAlpha = data.tool === 'highlighter' ? 0.3 : 1;

      _wbCtx.beginPath();
      _wbCtx.moveTo(data.points[0].x / dpr, data.points[0].y / dpr);
      for (let i = 1; i < data.points.length; i++) {
        _wbCtx.lineTo(data.points[i].x / dpr, data.points[i].y / dpr);
      }
      _wbCtx.stroke();
    }

    _wbCtx.restore();
  }
})();
