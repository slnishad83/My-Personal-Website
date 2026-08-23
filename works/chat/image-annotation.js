// Image Annotation � draw/annotate on images before sending
(function() {
  'use strict';

  let _annCanvas, _annCtx, _annImage = null;
  let _annTool = 'pen', _annColor = '#FF4081', _annSize = 3;
  let _annHistory = [], _annRedoStack = [];
  let _annDrawing = false, _annStartX, _annStartY, _annSnapshot;
  let _annOrigFile = null;
  let _annCropActive = false, _annCropRect = null, _annCropDrag = false, _annCropHandle = null;
  let _annCropStartX = 0, _annCropStartY = 0, _annCropStartRect = null;

  const _origAttachPhoto = window.attachPhoto;
  const _origShowMediaPreview = window._showMediaPreview;

  window._showMediaPreview = function(file, type) {
    if (type === 'image' && file.type.startsWith('image/')) {
      _annOrigFile = file;
      _showAnnotationPreview(file);
      return;
    }
    return _origShowMediaPreview(file, type);
  };

  function _showAnnotationPreview(file) {
    const blobUrl = URL.createObjectURL(file);
    const overlay = document.createElement('div');
    overlay.id = 'ann-preview-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;gap:12px;animation:fadeIn 0.2s ease';

    overlay.innerHTML = `
      <div style="width:100%;max-width:600px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="color:white;font-weight:700;font-size:14px">Preview</span>
        <button onclick="document.getElementById('ann-preview-overlay')?.remove();URL.revokeObjectURL('${blobUrl}')" style="background:none;border:none;color:white;cursor:pointer;font-size:20px">&times;</button>
      </div>
      <img src="${blobUrl}" style="max-width:90vw;max-height:55vh;border-radius:12px;object-fit:contain">
      <div style="display:flex;gap:12px;padding:12px">
        <button onclick="document.getElementById('ann-preview-overlay')?.remove();URL.revokeObjectURL('${blobUrl}')" style="padding:12px 24px;border-radius:12px;border:none;background:rgba(255,255,255,0.1);color:white;font-size:14px;font-weight:700;cursor:pointer">Retake</button>
        <button data-action="openImageAnnotation" data-action-arg="${blobUrl}" style="padding:12px 24px;border-radius:12px;border:none;background:rgba(255,255,255,0.15);color:white;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px"><span class="material-symbols-outlined" style="font-size:18px">edit</span>Annotate</button>
        <button id="ann-preview-send" style="padding:12px 24px;border-radius:12px;border:none;background:var(--primary,#7C4DFF);color:white;font-size:14px;font-weight:700;cursor:pointer">Send</button>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); URL.revokeObjectURL(blobUrl); } });

    const escHandler = e => { if (e.key === 'Escape') { overlay.remove(); URL.revokeObjectURL(blobUrl); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    document.getElementById('ann-preview-send')?.addEventListener('click', () => {
      overlay.remove();
      URL.revokeObjectURL(blobUrl);
      if (typeof _sendFileMessage === 'function') _sendFileMessage(file);
    });
  }

  window.openImageAnnotation = function(blobUrl) {
    document.getElementById('ann-preview-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'image-annotation-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;animation:fadeIn 0.2s ease';

    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(0,0,0,0.5)">
        <button data-action="closeImageAnnotation" style="background:none;border:none;color:white;cursor:pointer"><span class="material-symbols-outlined">close</span></button>
        <span style="color:white;font-weight:700;font-size:14px">Annotate Image</span>
        <button onclick="sendAnnotatedImage()" style="background:var(--primary,#7C4DFF);border:none;color:white;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px"><span class="material-symbols-outlined" style="font-size:16px">send</span>Send</button>
      </div>
      <div style="flex:1;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#0a0a0a">
        <canvas id="ann-canvas" style="max-width:100%;max-height:100%;touch-action:none;cursor:crosshair"></canvas>
        <div id="ann-crop-overlay" style="display:none;position:absolute;inset:0;pointer-events:none">
          <div id="ann-crop-box" style="position:absolute;border:2px dashed rgba(255,255,255,0.9);box-shadow:0 0 0 9999px rgba(0,0,0,0.55);cursor:move;pointer-events:all">
            <div class="ann-crop-handle ann-crop-tl" style="position:absolute;top:-6px;left:-6px;width:14px;height:14px;background:#fff;border-radius:50%;cursor:nw-resize;pointer-events:all"></div>
            <div class="ann-crop-handle ann-crop-tr" style="position:absolute;top:-6px;right:-6px;width:14px;height:14px;background:#fff;border-radius:50%;cursor:ne-resize;pointer-events:all"></div>
            <div class="ann-crop-handle ann-crop-bl" style="position:absolute;bottom:-6px;left:-6px;width:14px;height:14px;background:#fff;border-radius:50%;cursor:sw-resize;pointer-events:all"></div>
            <div class="ann-crop-handle ann-crop-br" style="position:absolute;bottom:-6px;right:-6px;width:14px;height:14px;background:#fff;border-radius:50%;cursor:se-resize;pointer-events:all"></div>
          </div>
        </div>
      </div>
      <div id="ann-crop-actions" style="display:none;align-items:center;justify-content:center;gap:12px;padding:10px 16px;background:rgba(0,0,0,0.6)">
        <button onclick="annCropApply()" style="padding:10px 20px;border-radius:8px;border:none;background:var(--primary,#7C4DFF);color:white;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px"><span class="material-symbols-outlined" style="font-size:16px">check</span>Apply Crop</button>
        <button onclick="annCropCancel()" style="padding:10px 20px;border-radius:8px;border:none;background:rgba(255,255,255,0.1);color:white;font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;background:rgba(0,0,0,0.5);flex-wrap:wrap">
        <div style="display:flex;gap:4px">
          <button onclick="annSetTool('pen')" class="ann-tool-btn active" data-tool="pen" style="width:44px;height:44px;border-radius:8px;border:2px solid var(--primary);background:rgba(124,77,255,0.2);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:16px">edit</span></button>
          <button onclick="annSetTool('highlighter')" class="ann-tool-btn" data-tool="highlighter" style="width:44px;height:44px;border-radius:8px;border:2px solid transparent;background:rgba(255,255,255,0.06);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:16px">ink_highlighter</span></button>
          <button onclick="annSetTool('arrow')" class="ann-tool-btn" data-tool="arrow" style="width:44px;height:44px;border-radius:8px;border:2px solid transparent;background:rgba(255,255,255,0.06);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:16px">north_east</span></button>
          <button onclick="annSetTool('rect')" class="ann-tool-btn" data-tool="rect" style="width:44px;height:44px;border-radius:8px;border:2px solid transparent;background:rgba(255,255,255,0.06);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:16px">rectangle</span></button>
          <button onclick="annSetTool('circle')" class="ann-tool-btn" data-tool="circle" style="width:44px;height:44px;border-radius:8px;border:2px solid transparent;background:rgba(255,255,255,0.06);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:16px">circle</span></button>
          <button onclick="annSetTool('text')" class="ann-tool-btn" data-tool="text" style="width:44px;height:44px;border-radius:8px;border:2px solid transparent;background:rgba(255,255,255,0.06);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:16px">text_fields</span></button>
          <button onclick="annSetTool('eraser')" class="ann-tool-btn" data-tool="eraser" style="width:44px;height:44px;border-radius:8px;border:2px solid transparent;background:rgba(255,255,255,0.06);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:16px">ink_eraser</span></button>
          <button onclick="annSetTool('crop')" class="ann-tool-btn" data-tool="crop" style="width:44px;height:44px;border-radius:8px;border:2px solid transparent;background:rgba(255,255,255,0.06);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:16px">crop</span></button>
        </div>
        <div style="width:1px;height:22px;background:rgba(255,255,255,0.15)"></div>
        <div style="display:flex;gap:3px">
          ${['#FF4081','#FFEA00','#00E676','#7C4DFF','#00BCD4','#FF6D00','#FFFFFF','#000000'].map(c =>
            `<button onclick="annSetColor('${c}')" class="ann-color-btn" style="width:36px;height:36px;border-radius:50%;border:2px solid ${c === _annColor ? 'white' : 'transparent'};background:${c};cursor:pointer" data-color="${c}"></button>`
          ).join('')}
        </div>
        <div style="width:1px;height:22px;background:rgba(255,255,255,0.15)"></div>
        <div style="display:flex;align-items:center;gap:4px">
          <input type="range" min="1" max="15" value="${_annSize}" onchange="annSetSize(this.value)" style="width:70px;accent-color:var(--primary)">
        </div>
        <div style="width:1px;height:22px;background:rgba(255,255,255,0.15)"></div>
        <div style="display:flex;gap:4px">
          <button onclick="annUndo()" title="Undo" style="background:rgba(255,255,255,0.1);border:none;color:white;width:44px;height:44px;border-radius:8px;cursor:pointer"><span class="material-symbols-outlined" style="font-size:16px">undo</span></button>
          <button onclick="annRedo()" title="Redo" style="background:rgba(255,255,255,0.1);border:none;color:white;width:44px;height:44px;border-radius:8px;cursor:pointer"><span class="material-symbols-outlined" style="font-size:16px">redo</span></button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    _annCanvas = document.getElementById('ann-canvas');
    _annCtx = _annCanvas.getContext('2d');
    _annHistory = [];
    _annRedoStack = [];

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxW = window.innerWidth * 0.95;
      const maxH = window.innerHeight * 0.65;
      let w = img.width, h = img.height;
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      _annCanvas.width = w;
      _annCanvas.height = h;
      _annCtx.drawImage(img, 0, 0, w, h);
      _annImage = img;
      _annSaveState();
    };
    img.src = blobUrl;

    _annCanvas.addEventListener('pointerdown', _annPointerDown);
    _annCanvas.addEventListener('pointermove', _annPointerMove);
    _annCanvas.addEventListener('pointerup', _annPointerUp);
    _annCanvas.addEventListener('pointerleave', _annPointerUp);
  };

  function _annPointerDown(e) {
    if (_annTool === 'crop') return;
    _annDrawing = true;
    const rect = _annCanvas.getBoundingClientRect();
    _annStartX = e.clientX - rect.left;
    _annStartY = e.clientY - rect.top;

    if (['arrow', 'rect', 'circle'].includes(_annTool)) {
      _annSnapshot = _annCtx.getImageData(0, 0, _annCanvas.width, _annCanvas.height);
    }

    if (_annTool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        _annCtx.fillStyle = _annColor;
        _annCtx.font = `bold ${_annSize * 5 + 10}px sans-serif`;
        _annCtx.fillText(text, _annStartX, _annStartY);
        _annSaveState();
      }
      _annDrawing = false;
      return;
    }

    if (_annTool === 'pen' || _annTool === 'highlighter') {
      _annCtx.beginPath();
      _annCtx.moveTo(_annStartX, _annStartY);
    }
  }

  function _annPointerMove(e) {
    if (!_annDrawing) return;
    const rect = _annCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (_annTool === 'pen') {
      _annCtx.strokeStyle = _annColor;
      _annCtx.lineWidth = _annSize;
      _annCtx.lineCap = 'round';
      _annCtx.lineJoin = 'round';
      _annCtx.globalAlpha = 1;
      _annCtx.lineTo(x, y);
      _annCtx.stroke();
    } else if (_annTool === 'highlighter') {
      _annCtx.strokeStyle = _annColor;
      _annCtx.lineWidth = _annSize * 4;
      _annCtx.lineCap = 'round';
      _annCtx.lineJoin = 'round';
      _annCtx.globalAlpha = 0.3;
      _annCtx.lineTo(x, y);
      _annCtx.stroke();
      _annCtx.globalAlpha = 1;
    } else if (_annTool === 'eraser') {
      _annCtx.globalCompositeOperation = 'destination-out';
      _annCtx.beginPath();
      _annCtx.arc(x, y, _annSize * 3, 0, Math.PI * 2);
      _annCtx.fill();
      _annCtx.globalCompositeOperation = 'source-over';
    } else if (['arrow', 'rect', 'circle'].includes(_annTool)) {
      _annCtx.putImageData(_annSnapshot, 0, 0);
      _annCtx.strokeStyle = _annColor;
      _annCtx.lineWidth = _annSize;
      _annCtx.lineCap = 'round';

      if (_annTool === 'rect') {
        _annCtx.strokeRect(_annStartX, _annStartY, x - _annStartX, y - _annStartY);
      } else if (_annTool === 'circle') {
        const rx = Math.abs(x - _annStartX) / 2;
        const ry = Math.abs(y - _annStartY) / 2;
        const cx = _annStartX + (x - _annStartX) / 2;
        const cy = _annStartY + (y - _annStartY) / 2;
        _annCtx.beginPath();
        _annCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        _annCtx.stroke();
      } else if (_annTool === 'arrow') {
        _annCtx.beginPath();
        _annCtx.moveTo(_annStartX, _annStartY);
        _annCtx.lineTo(x, y);
        _annCtx.stroke();
        const angle = Math.atan2(y - _annStartY, x - _annStartX);
        const headLen = 15;
        _annCtx.beginPath();
        _annCtx.moveTo(x, y);
        _annCtx.lineTo(x - headLen * Math.cos(angle - Math.PI / 6), y - headLen * Math.sin(angle - Math.PI / 6));
        _annCtx.moveTo(x, y);
        _annCtx.lineTo(x - headLen * Math.cos(angle + Math.PI / 6), y - headLen * Math.sin(angle + Math.PI / 6));
        _annCtx.stroke();
      }
    }
  }

  function _annPointerUp() {
    if (!_annDrawing) return;
    _annDrawing = false;
    _annSaveState();
  }

  function _annSaveState() {
    if (!_annCanvas) return;
    _annHistory.push(_annCanvas.toDataURL());
    _annRedoStack = [];
    if (_annHistory.length > 30) _annHistory.shift();
  }

  window.annUndo = function() {
    if (_annHistory.length < 2) return;
    _annRedoStack.push(_annHistory.pop());
    const img = new Image();
    img.onload = () => { _annCtx.clearRect(0, 0, _annCanvas.width, _annCanvas.height); _annCtx.drawImage(img, 0, 0); };
    img.src = _annHistory[_annHistory.length - 1];
  };

  window.annRedo = function() {
    if (!_annRedoStack.length) return;
    const state = _annRedoStack.pop();
    _annHistory.push(state);
    const img = new Image();
    img.onload = () => { _annCtx.clearRect(0, 0, _annCanvas.width, _annCanvas.height); _annCtx.drawImage(img, 0, 0); };
    img.src = state;
  };

  window.annSetTool = function(tool) {
    _annTool = tool;
    document.querySelectorAll('.ann-tool-btn').forEach(b => {
      b.style.borderColor = b.dataset.tool === tool ? 'var(--primary)' : 'transparent';
      b.style.background = b.dataset.tool === tool ? 'rgba(124,77,255,0.2)' : 'rgba(255,255,255,0.06)';
    });
    _annCanvas.style.cursor = tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : tool === 'crop' ? 'default' : 'crosshair';
    if (tool === 'crop') {
      _annInitCrop();
    } else {
      _annHideCrop();
    }
  };

  function _annInitCrop() {
    const overlay = document.getElementById('ann-crop-overlay');
    const actions = document.getElementById('ann-crop-actions');
    const box = document.getElementById('ann-crop-box');
    if (!overlay || !box || !_annCanvas) return;
    overlay.style.display = 'block';
    actions.style.display = 'flex';
    _annCropActive = true;
    const cw = _annCanvas.width, ch = _annCanvas.height;
    const margin = 0.1;
    _annCropRect = {
      x: Math.round(cw * margin),
      y: Math.round(ch * margin),
      w: Math.round(cw * (1 - 2 * margin)),
      h: Math.round(ch * (1 - 2 * margin))
    };
    _annUpdateCropBox();
    box.addEventListener('pointerdown', _annCropPointerDown);
    document.addEventListener('pointermove', _annCropPointerMove);
    document.addEventListener('pointerup', _annCropPointerUp);
  }

  function _annHideCrop() {
    const overlay = document.getElementById('ann-crop-overlay');
    const actions = document.getElementById('ann-crop-actions');
    const box = document.getElementById('ann-crop-box');
    if (overlay) overlay.style.display = 'none';
    if (actions) actions.style.display = 'none';
    _annCropActive = false;
    _annCropDrag = false;
    _annCropHandle = null;
    if (box) {
      box.removeEventListener('pointerdown', _annCropPointerDown);
    }
    document.removeEventListener('pointermove', _annCropPointerMove);
    document.removeEventListener('pointerup', _annCropPointerUp);
  }

  function _annUpdateCropBox() {
    if (!_annCropRect || !_annCanvas) return;
    const box = document.getElementById('ann-crop-box');
    if (!box) return;
    const canvasRect = _annCanvas.getBoundingClientRect();
    const scaleX = canvasRect.width / _annCanvas.width;
    const scaleY = canvasRect.height / _annCanvas.height;
    box.style.left = (_annCropRect.x * scaleX) + 'px';
    box.style.top = (_annCropRect.y * scaleY) + 'px';
    box.style.width = (_annCropRect.w * scaleX) + 'px';
    box.style.height = (_annCropRect.h * scaleY) + 'px';
  }

  function _annCanvasCoords(e) {
    if (!_annCanvas) return { x: 0, y: 0 };
    const rect = _annCanvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(_annCanvas.width, (e.clientX - rect.left) * (_annCanvas.width / rect.width))),
      y: Math.max(0, Math.min(_annCanvas.height, (e.clientY - rect.top) * (_annCanvas.height / rect.height)))
    };
  }

  function _annCropPointerDown(e) {
    if (!_annCropActive) return;
    e.preventDefault();
    e.stopPropagation();
    const cls = e.target.className || '';
    if (cls.includes('ann-crop-')) {
      _annCropHandle = cls.includes('tl') ? 'tl' : cls.includes('tr') ? 'tr' : cls.includes('bl') ? 'bl' : 'br';
    } else {
      _annCropHandle = 'move';
    }
    _annCropDrag = true;
    _annCropStartX = e.clientX;
    _annCropStartY = e.clientY;
    _annCropStartRect = Object.assign({}, _annCropRect);
  }

  function _annCropPointerMove(e) {
    if (!_annCropDrag || !_annCropActive) return;
    e.preventDefault();
    const dx = e.clientX - _annCropStartX;
    const dy = e.clientY - _annCropStartY;
    const canvasRect = _annCanvas.getBoundingClientRect();
    const scaleX = _annCanvas.width / canvasRect.width;
    const scaleY = _annCanvas.height / canvasRect.height;
    const r = _annCropStartRect;
    const minSize = 30;
    if (_annCropHandle === 'move') {
      _annCropRect.x = Math.max(0, Math.min(_annCanvas.width - r.w, r.x + dx * scaleX));
      _annCropRect.y = Math.max(0, Math.min(_annCanvas.height - r.h, r.y + dy * scaleY));
    } else if (_annCropHandle === 'tl') {
      const newX = Math.max(0, r.x + dx * scaleX);
      const newY = Math.max(0, r.y + dy * scaleY);
      _annCropRect.w = Math.max(minSize, r.w - (newX - r.x));
      _annCropRect.h = Math.max(minSize, r.h - (newY - r.y));
      _annCropRect.x = r.x + r.w - _annCropRect.w;
      _annCropRect.y = r.y + r.h - _annCropRect.h;
    } else if (_annCropHandle === 'tr') {
      _annCropRect.w = Math.max(minSize, Math.min(_annCanvas.width - r.x, r.w + dx * scaleX));
      const newY = Math.max(0, r.y + dy * scaleY);
      _annCropRect.h = Math.max(minSize, r.h - (newY - r.y));
      _annCropRect.y = r.y + r.h - _annCropRect.h;
    } else if (_annCropHandle === 'bl') {
      const newX = Math.max(0, r.x + dx * scaleX);
      _annCropRect.w = Math.max(minSize, r.w - (newX - r.x));
      _annCropRect.x = r.x + r.w - _annCropRect.w;
      _annCropRect.h = Math.max(minSize, Math.min(_annCanvas.height - r.y, r.h + dy * scaleY));
    } else if (_annCropHandle === 'br') {
      _annCropRect.w = Math.max(minSize, Math.min(_annCanvas.width - r.x, r.w + dx * scaleX));
      _annCropRect.h = Math.max(minSize, Math.min(_annCanvas.height - r.y, r.h + dy * scaleY));
    }
    _annUpdateCropBox();
  }

  function _annCropPointerUp() {
    _annCropDrag = false;
    _annCropHandle = null;
  }

  window.annCropApply = function() {
    if (!_annCropRect || !_annCanvas || !_annCtx) return;
    const r = _annCropRect;
    const imageData = _annCtx.getImageData(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h));
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = Math.round(r.w);
    tmpCanvas.height = Math.round(r.h);
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.putImageData(imageData, 0, 0);
    _annCanvas.width = tmpCanvas.width;
    _annCanvas.height = tmpCanvas.height;
    _annCtx.drawImage(tmpCanvas, 0, 0);
    _annHideCrop();
    _annSaveState();
    showToast('Image cropped', 'success');
  };

  window.annCropCancel = function() {
    _annHideCrop();
  };

  window.annSetColor = function(color) {
    _annColor = color;
    document.querySelectorAll('.ann-color-btn').forEach(b => {
      b.style.borderColor = b.dataset.color === color ? 'white' : 'transparent';
    });
  };

  window.annSetSize = function(size) { _annSize = parseInt(size) || 3; };

  window.sendAnnotatedImage = function() {
    if (!_annCanvas) return;
    _annCanvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], 'annotated-' + Date.now() + '.png', { type: 'image/png' });
      closeImageAnnotation();
      if (typeof _sendFileMessage === 'function') _sendFileMessage(file);
      showToast('Annotated image sent', 'success');
    }, 'image/png');
  };

  window.closeImageAnnotation = function() {
    document.getElementById('image-annotation-overlay')?.remove();
    _annCanvas = null;
    _annCtx = null;
    _annImage = null;
  };
})();
