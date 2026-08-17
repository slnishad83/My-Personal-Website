(function() {
  'use strict';

  var _callback = null;
  var _activePack = 0;
  var _recentStickers = [];

  var _defaultPacks = [
    {
      name: 'Smileys',
      icon: '😀',
      stickers: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐']
    },
    {
      name: 'Gestures',
      icon: '👍',
      stickers: ['👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','👋','🤝','🙏','💪']
    },
    {
      name: 'Hearts',
      icon: '❤️',
      stickers: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝']
    },
    {
      name: 'Animals',
      icon: '🐶',
      stickers: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗']
    },
    {
      name: 'Food',
      icon: '🍕',
      stickers: ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🥞','🧇','🥩','🍗','🍖','🥪','🌮','🌯','🥗']
    }
  ];

  function _showToast(msg, type) { if (App && App.toast) App.toast(msg, type); else if (typeof showToast === 'function') showToast(msg, type); }

  function _getRecent() {
    try { return JSON.parse(localStorage.getItem('sticker_recent') || '[]'); } catch (e) { return []; }
  }

  function _saveRecent(url) {
    var recent = _getRecent().filter(function(u) { return u !== url; });
    recent.unshift(url);
    if (recent.length > 50) recent = recent.slice(0, 50);
    try { localStorage.setItem('sticker_recent', JSON.stringify(recent)); } catch (e) {}
    _recentStickers = recent;
  }

  function _haptic() {
    if (navigator.vibrate) navigator.vibrate(10);
  }

  function _injectStyles() {
    if (document.getElementById('sticker-picker-styles')) return;
    var style = document.createElement('style');
    style.id = 'sticker-picker-styles';
    style.textContent = '\n' +
      '.sticker-overlay{position:fixed;inset:0;z-index:100004;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);opacity:0;transition:opacity 0.25s ease;}\n' +
      '@media(min-width:640px){.sticker-overlay{align-items:center;}}\n' +
      '.sticker-overlay.open{display:flex;opacity:1;}\n' +
      '.sticker-sheet{background:var(--surface-container,#1f2c34);width:100%;max-width:500px;height:55vh;max-height:55vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);box-shadow:0 -4px 24px rgba(0,0,0,0.4);}\n' +
      '.sticker-overlay.open .sticker-sheet{transform:translateY(0);}\n' +
      '@media(min-width:640px){.sticker-sheet{border-radius:20px;max-width:360px;height:auto;max-height:70vh;transform:scale(0.9);opacity:0;transition:transform 0.25s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease;}\n' +
      '.sticker-overlay.open .sticker-sheet{transform:scale(1);opacity:1;}}\n' +
      '.sticker-pack-tabs{display:flex;gap:4px;padding:10px 12px;overflow-x:auto;flex-shrink:0;border-bottom:1px solid var(--outline-variant,rgba(255,255,255,0.08));position:relative;}\n' +
      '.sticker-pack-tabs::-webkit-scrollbar{display:none;}\n' +
      '.sticker-pack-tab{flex-shrink:0;width:42px;height:42px;border-radius:12px;border:2px solid transparent;background:transparent;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;position:relative;}\n' +
      '.sticker-pack-tab:hover{background:var(--surface-variant,rgba(255,255,255,0.08));}\n' +
      '.sticker-pack-tab.active{border-color:var(--primary,#8ab4f8);background:var(--primary-container,rgba(138,180,248,0.12));}\n' +
      '.sticker-pack-tab-indicator{position:absolute;bottom:0;height:2px;background:var(--primary,#8ab4f8);border-radius:1px;transition:left 0.25s cubic-bezier(0.4,0,0.2,1),width 0.25s cubic-bezier(0.4,0,0.2,1);}\n' +
      '.sticker-content{flex:1;overflow-y:auto;padding:8px 12px;}\n' +
      '.sticker-pack-header{padding:6px 4px 10px;font-size:13px;font-weight:700;color:var(--on-surface-variant,#999);text-align:center;}\n' +
      '.sticker-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;}\n' +
      '@media(min-width:640px){.sticker-grid{grid-template-columns:repeat(5,1fr);}}\n' +
      '.sticker-item{width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:36px;cursor:pointer;border-radius:12px;transition:transform 0.15s,background 0.15s;background:transparent;border:none;padding:0;}\n' +
      '.sticker-item:hover{background:var(--surface-variant,rgba(255,255,255,0.08));}\n' +
      '.sticker-item:active{transform:scale(1.2);}\n' +
      '.sticker-item.send-anim{animation:sticker-pop 0.3s ease;}\n' +
      '@keyframes sticker-pop{0%{transform:scale(1)}50%{transform:scale(1.3)}100%{transform:scale(1)}}\n' +
      '.sticker-empty{text-align:center;padding:32px 16px;color:var(--on-surface-variant,#999);font-size:14px;}\n';
    document.head.appendChild(style);
  }

  function _buildOverlay() {
    if (document.getElementById('sticker-overlay')) return;
    _recentStickers = _getRecent();
    var overlay = document.createElement('div');
    overlay.className = 'sticker-overlay';
    overlay.id = 'sticker-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Sticker Picker');
    overlay.onclick = function(e) { if (e.target === overlay) closeStickerPicker(); };
    overlay.innerHTML =
      '<div class="sticker-sheet">' +
        '<div class="sticker-pack-tabs" id="sticker-pack-tabs"></div>' +
        '<div class="sticker-content" id="sticker-content"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    _renderPackTabs();
    _renderPackContent();
  }

  function _renderPackTabs() {
    var container = document.getElementById('sticker-pack-tabs');
    if (!container) return;
    var allPacks = _loadAllPacks();
    var html = '<button class="sticker-pack-tab active" data-pack="recent" title="Recent">🕐</button>';
    allPacks.forEach(function(pack, i) {
      html += '<button class="sticker-pack-tab" data-pack="' + i + '" title="' + pack.name + '">' + pack.icon + '</button>';
    });
    html += '<button class="sticker-pack-tab" data-pack="upload" title="Add sticker" style="font-size:18px;color:var(--primary,#00a884)">+</button>';
    html += '<div class="sticker-pack-tab-indicator" id="sticker-tab-indicator"></div>';
    container.innerHTML = html;
    container.querySelectorAll('.sticker-pack-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        container.querySelectorAll('.sticker-pack-tab').forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');
        var packIdx = this.getAttribute('data-pack');
        if (packIdx === 'upload') {
          _showUploadSticker();
          return;
        }
        if (packIdx === 'recent') {
          _activePack = -1;
        } else {
          _activePack = parseInt(packIdx);
        }
        _updateIndicator(this);
        _renderPackContent();
      });
    });
    setTimeout(function() {
      var active = container.querySelector('.sticker-pack-tab.active');
      if (active) _updateIndicator(active);
    }, 50);
  }

  function _updateIndicator(tab) {
    var indicator = document.getElementById('sticker-tab-indicator');
    if (!indicator || !tab) return;
    var tabsContainer = document.getElementById('sticker-pack-tabs');
    var containerRect = tabsContainer.getBoundingClientRect();
    var tabRect = tab.getBoundingClientRect();
    var left = tabRect.left - containerRect.left + tabsContainer.scrollLeft;
    indicator.style.left = left + 'px';
    indicator.style.width = tabRect.width + 'px';
  }

  function _renderPackContent() {
    var content = document.getElementById('sticker-content');
    if (!content) return;
    content.innerHTML = '';
    if (_activePack === -1) {
      var recentUrls = _getRecent();
      if (recentUrls.length === 0) {
        content.innerHTML = '<div class="sticker-empty">No recent stickers yet</div>';
        return;
      }
      var header = document.createElement('div');
      header.className = 'sticker-pack-header';
      header.textContent = 'Recent';
      content.appendChild(header);
      var grid = document.createElement('div');
      grid.className = 'sticker-grid';
      content.appendChild(grid);
      recentUrls.forEach(function(url) {
        var item = _createStickerItem(url, true);
        grid.appendChild(item);
      });
    } else {
      var allPacks = _loadAllPacks();
      var pack = allPacks[_activePack];
      if (!pack) return;
      var packHeader = document.createElement('div');
      packHeader.className = 'sticker-pack-header';
      packHeader.textContent = pack.name;
      content.appendChild(packHeader);
      var packGrid = document.createElement('div');
      packGrid.className = 'sticker-grid';
      content.appendChild(packGrid);
      pack.stickers.forEach(function(emoji) {
        var item = _createStickerItem(emoji, false);
        packGrid.appendChild(item);
      });
    }
  }

  function _createStickerItem(content, isImage) {
    var item = document.createElement('button');
    item.className = 'sticker-item';
    item.setAttribute('aria-label', 'Select sticker');
    if (isImage) {
      var safeSrc = content.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      item.innerHTML = '<img src="' + safeSrc + '" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" alt="Sticker">';
    } else {
      item.textContent = content;
    }
    item.addEventListener('click', function() {
      var btn = this;
      btn.classList.add('send-anim');
      _haptic();
      setTimeout(function() { btn.classList.remove('send-anim'); }, 300);
      var stickerUrl = isImage ? content : 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/' + _emojiToCodepoint(content) + '.png';
      _saveRecent(stickerUrl);
      if (_callback) _callback(stickerUrl);
      sendSticker(stickerUrl, _activePack >= 0 ? _defaultPacks[_activePack].name : 'Recent');
    });
    return item;
  }

  function _emojiToCodepoint(emoji) {
    var codepoints = [];
    for (var i = 0; i < emoji.length; i++) {
      var code = emoji.codePointAt(i);
      if (code > 0xFFFF) i++;
      if (code === 0x200D) continue;
      if (code === 0xFE0F) continue;
      codepoints.push(code.toString(16));
    }
    return codepoints.join('-');
  }

  function openStickerPicker(callback) {
    _callback = callback || null;
    _injectStyles();
    _buildOverlay();
    requestAnimationFrame(function() {
      document.getElementById('sticker-overlay').classList.add('open');
    });
  }

  function closeStickerPicker() {
    var overlay = document.getElementById('sticker-overlay');
    if (overlay) {
      overlay.classList.remove('open');
      setTimeout(function() { overlay.remove(); }, 300);
    }
    _callback = null;
  }

  function _showUploadSticker() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    input.addEventListener('change', function() {
      var files = Array.from(input.files || []);
      if (!files.length) return;
      var customPacks = _getCustomPacks();
      var maxPerPack = 20;
      files.forEach(function(file) {
        if (file.size > 2 * 1024 * 1024) { _showToast('Sticker too large (max 2MB)', 'error'); return; }
        var reader = new FileReader();
        reader.onload = function(e) {
          var dataUrl = e.target.result;
          if (customPacks.length === 0) {
            customPacks.push({ name: 'My Stickers', icon: '⭐', stickers: [] });
          }
          if (customPacks[0].stickers.length >= maxPerPack) {
            _showToast('Sticker pack full (max 20)', 'error');
            return;
          }
          customPacks[0].stickers.push(dataUrl);
          _saveCustomPacks(customPacks);
          _renderPackContent();
          _showToast('Sticker added!', 'success');
        };
        reader.readAsDataURL(file);
      });
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  }

  function _getCustomPacks() {
    try { return JSON.parse(localStorage.getItem('sticker_custom_packs') || '[]'); } catch (_) { return []; }
  }

  function _saveCustomPacks(packs) {
    try { localStorage.setItem('sticker_custom_packs', JSON.stringify(packs)); } catch (_) {}
  }

  function _loadAllPacks() {
    var custom = _getCustomPacks();
    return custom.concat(_defaultPacks);
  }

  function loadStickerPacks() {
    return _loadAllPacks();
  }

  function getStickerPacks() {
    return _loadAllPacks();
  }

  function sendSticker(stickerUrl, packName) {
    if (App && App.sendStickerMessage) {
      App.sendStickerMessage(stickerUrl, packName);
    } else if (App && App.sendMessage) {
      App.sendMessage(stickerUrl, 'sticker');
    }
  }

  window.openStickerPicker = openStickerPicker;
  window.closeStickerPicker = closeStickerPicker;
  window.loadStickerPacks = loadStickerPacks;
  window.sendSticker = sendSticker;
  window.getStickerPacks = getStickerPacks;
})();
