(function() {
  'use strict';

  var _callback = null;
  var _debounceTimer = null;
  var _page = 0;
  var _query = '';
  var _loading = false;
  var _allGifs = [];

  var _curatedGifs = [
    'https://media.tenor.com/lBQ8y4Mv9B4AAAAM/dance.gif',
    'https://media.tenor.com/M8Wl_5w2nEIAAAAM/laughing-laugh.gif',
    'https://media.tenor.com/1N9sD2bZ5LsAAAAM/sad-crying.gif',
    'https://media.tenor.com/4f6C9uJk1sUAAAAM/thumbs-up.gif',
    'https://media.tenor.com/OLjAb2cUaMEAAAAM/fire-fire-fire.gif',
    'https://media.tenor.com/SU9E0e5k0iIAAAAM/love-you.gif',
    'https://media.tenor.com/xT0xezQGU5xCDJuCPe.gif',
    'https://media.tenor.com/kHxY2lPvUcUAAAAM/wink.gif',
    'https://media.tenor.com/dRByv5jLzUwAAAAM/okay-ok.gif',
    'https://media.tenor.com/BpJkQ0vUyR8AAAAM/popcorn.gif',
    'https://media.tenor.com/0qLM5L4y2cYAAAAM/applause-clap.gif',
    'https://media.tenor.com/7Z1M8f0fP0YAAAAM/sleeping-sleep.gif',
    'https://media.tenor.com/g38pD3n2vQcAAAAM/angry-mad.gif',
    'https://media.tenor.com/q1S4o1W60dAAAAAM/surprised-shock.gif',
    'https://media.tenor.com/dWfJHCqQGn0AAAAM/celebration-party.gif',
    'https://media.tenor.com/pqWS8bJfT6cAAAAM/hello-wave.gif',
    'https://media.tenor.com/5gKjxKkIzJEAAAAM/pray-praying.gif',
    'https://media.tenor.com/0SxJp3dRI2gAAAAM/sunglasses-cool.gif',
    'https://media.tenor.com/XkRsP9FtNfMAAAAM/hug.gif',
    'https://media.tenor.com/dw5RJ1E8oXoAAAAM/shrug.gif',
    'https://media.tenor.com/Gd4d5rE0o_kAAAAM/facepalm.gif',
    'https://media.tenor.com/CWu2cSZuomsAAAAM/dancing.gif',
    'https://media.tenor.com/Tfz7S7Fb0c4AAAAM/eat-eating.gif',
    'https://media.tenor.com/hjOoA2N0U0MAAAAM/yes-yeah.gif',
    'https://media.tenor.com/B533XKb6qN4AAAAM/no-nope.gif',
    'https://media.tenor.com/dV3U0vWq7b4AAAAM/sarcastic-sarcasm.gif',
    'https://media.tenor.com/uUgG7bYz7YwAAAAM/mind-blown.gif',
    'https://media.tenor.com/90pBxl3R0moAAAAM/party.gif',
    'https://media.tenor.com/Z1jJMH0pMmsAAAAM/friends.gif',
    'https://media.tenor.com/jpcK0c4z0XwAAAAM/cool-sunglasses.gif',
    'https://media.tenor.com/P76wNL5PdH8AAAAM/crying.gif',
    'https://media.tenor.com/XIqEjyJ0eDkAAAAM/confused.gif',
    'https://media.tenor.com/9hI7jBh0UQYAAAAM/scared.gif',
    'https://media.tenor.com/jV0PcMOv9GgAAAAM/money.gif',
    'https://media.tenor.com/DxLqQ5pBhGcAAAAM/good-morning.gif',
    'https://media.tenor.com/KI2bXfLqg2EAAAAM/good-night.gif',
    'https://media.tenor.com/XxjXl6Gq1aEAAAAM/wave-hello.gif',
    'https://media.tenor.com/jrBfGJ4dQxQAAAAM/bye.gif',
    'https://media.tenor.com/1n2bE5L70eQAAAAM/peace.gif',
    'https://media.tenor.com/qgKU2yU6t4sAAAAM/cat-cute.gif',
    'https://media.tenor.com/b5kD4fJ1s9MAAAAM/dog-puppy.gif',
    'https://media.tenor.com/cOkE7xRf0mAAAAAAM/heart-love.gif',
    'https://media.tenor.com/5Ss3q7dOeWcAAAAM/sad.gif',
    'https://media.tenor.com/mFqI9Uu2sNcAAAAM/funny.gif',
    'https://media.tenor.com/MFqI9Uu2sNcAAAAM/funny.gif',
    'https://media.tenor.com/nJGd3I1vrjEAAAAM/sleep.gif',
    'https://media.tenor.com/knU7e2b1hEoAAAAM/love.gif',
    'https://media.tenor.com/pbP2JH0nK7kAAAAM/laugh.gif',
    'https://media.tenor.com/tAjb1vQJd2YAAAAM/cool.gif',
    'https://media.tenor.com/w5W3F7dK2h8AAAAM/happy.gif'
  ];

  var _categories = [
    { label: 'Fun', query: 'fun funny' },
    { label: 'Reactions', query: 'reaction' },
    { label: 'Animals', query: 'animals cute' },
    { label: 'Food', query: 'food yummy' },
    { label: 'Sports', query: 'sports' },
    { label: 'Nature', query: 'nature landscape' }
  ];

  function _showToast(msg, type) { if (App && App.toast) App.toast(msg, type); else if (typeof showToast === 'function') showToast(msg, type); }

  function _getRecent() {
    try { return JSON.parse(localStorage.getItem('gif_recent') || '[]'); } catch (e) { return []; }
  }

  function _saveRecent(url) {
    var recent = _getRecent().filter(function(u) { return u !== url; });
    recent.unshift(url);
    if (recent.length > 20) recent = recent.slice(0, 20);
    try { localStorage.setItem('gif_recent', JSON.stringify(recent)); } catch (e) {}
  }

  function _injectStyles() {
    if (document.getElementById('gif-picker-styles')) return;
    var style = document.createElement('style');
    style.id = 'gif-picker-styles';
    style.textContent = '\n' +
      '.gif-overlay{position:fixed;inset:0;z-index:100002;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);opacity:0;transition:opacity 0.25s ease;}\n' +
      '@media(min-width:640px){.gif-overlay{align-items:center;}}\n' +
      '.gif-overlay.open{display:flex;opacity:1;}\n' +
      '.gif-sheet{background:var(--surface-container,#1f2c34);width:100%;max-width:500px;height:60vh;max-height:60vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);box-shadow:0 -4px 24px rgba(0,0,0,0.4);}\n' +
      '.gif-overlay.open .gif-sheet{transform:translateY(0);}\n' +
      '@media(min-width:640px){.gif-sheet{border-radius:20px;max-width:400px;height:auto;max-height:70vh;transform:scale(0.9);opacity:0;transition:transform 0.25s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease;}\n' +
      '.gif-overlay.open .gif-sheet{transform:scale(1);opacity:1;}}\n' +
      '.gif-search-bar{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--outline-variant,rgba(255,255,255,0.08));}\n' +
      '.gif-search-icon{color:var(--on-surface-variant,#999);flex-shrink:0;}\n' +
      '.gif-search-bar input{flex:1;background:var(--surface-variant,rgba(255,255,255,0.06));border:1px solid var(--outline-variant,rgba(255,255,255,0.12));border-radius:12px;padding:10px 14px;color:var(--on-surface,#fff);font-size:14px;outline:none;}\n' +
      '.gif-search-bar input::placeholder{color:var(--on-surface-variant,#777);}\n' +
      '.gif-search-bar input:focus{border-color:var(--primary,#8ab4f8);}\n' +
      '.gif-categories{display:flex;gap:6px;padding:10px 16px;overflow-x:auto;flex-shrink:0;}\n' +
      '.gif-categories::-webkit-scrollbar{display:none;}\n' +
      '.gif-cat-btn{padding:6px 14px;border-radius:20px;border:1px solid var(--outline-variant,rgba(255,255,255,0.12));background:transparent;color:var(--on-surface-variant,#ccc);font-size:12px;font-weight:600;white-space:nowrap;cursor:pointer;transition:all 0.15s;}\n' +
      '.gif-cat-btn:hover,.gif-cat-btn.active{background:var(--primary,#8ab4f8);color:var(--on-primary,#000);border-color:var(--primary,#8ab4f8);}\n' +
      '.gif-section-header{padding:8px 16px 4px;font-size:12px;font-weight:700;color:var(--on-surface-variant,#999);text-transform:uppercase;letter-spacing:0.5px;}\n' +
      '.gif-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:8px 12px;overflow-y:auto;flex:1;}\n' +
      '@media(min-width:640px){.gif-grid{grid-template-columns:repeat(4,1fr);}}\n' +
      '.gif-item{position:relative;border-radius:8px;overflow:hidden;cursor:pointer;aspect-ratio:1;background:var(--surface-variant,rgba(255,255,255,0.06));}\n' +
      '.gif-item img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.15s;}\n' +
      '.gif-item:hover img{transform:scale(1.05);}\n' +
      '.gif-item .gif-check{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);opacity:0;transition:opacity 0.15s;}\n' +
      '.gif-item.selected .gif-check{opacity:1;}\n' +
      '.gif-item .gif-check svg{width:28px;height:28px;color:#fff;}\n' +
      '.gif-shimmer{border-radius:8px;background:linear-gradient(90deg,var(--surface-variant,rgba(255,255,255,0.04)) 25%,var(--surface-variant,rgba(255,255,255,0.08)) 50%,var(--surface-variant,rgba(255,255,255,0.04)) 75%);background-size:200% 100%;animation:gif-shimmer 1.5s infinite;aspect-ratio:1;}\n' +
      '@keyframes gif-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}\n' +
      '.gif-empty{text-align:center;padding:40px 16px;color:var(--on-surface-variant,#999);font-size:14px;}\n' +
      '.gif-loading{display:flex;justify-content:center;padding:16px;}\n' +
      '.gif-loading-spinner{width:24px;height:24px;border:2px solid var(--outline-variant,rgba(255,255,255,0.12));border-top-color:var(--primary,#8ab4f8);border-radius:50%;animation:gif-spin 0.6s linear infinite;}\n' +
      '@keyframes gif-spin{to{transform:rotate(360deg)}}\n' +
      '.gif-preview-overlay{position:fixed;inset:0;z-index:100003;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);}\n' +
      '.gif-preview-overlay.open{display:flex;}\n' +
      '.gif-preview-overlay img{max-width:90%;max-height:70vh;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);}\n';
    document.head.appendChild(style);
  }

  function _buildOverlay() {
    if (document.getElementById('gif-overlay')) return;
    var overlay = document.createElement('div');
    overlay.className = 'gif-overlay';
    overlay.id = 'gif-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'GIF Picker');
    overlay.onclick = function(e) { if (e.target === overlay) closeGifPicker(); };
    overlay.innerHTML =
      '<div class="gif-sheet">' +
        '<div class="gif-search-bar">' +
          '<svg class="gif-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
          '<input type="text" id="gif-search-input" placeholder="Search GIFs..." autocomplete="off">' +
        '</div>' +
        '<div class="gif-categories" id="gif-categories"></div>' +
        '<div id="gif-content" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var input = document.getElementById('gif-search-input');
    input.addEventListener('input', function() {
      clearTimeout(_debounceTimer);
      var val = this.value.trim();
      _debounceTimer = setTimeout(function() {
        _query = val;
        _page = 0;
        _allGifs = [];
        if (_query) {
          searchGifs(_query);
        } else {
          loadTrendingGifs();
        }
      }, 300);
    });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeGifPicker();
    });

    _renderCategories();
  }

  function _renderCategories() {
    var container = document.getElementById('gif-categories');
    if (!container) return;
    var html = '<button class="gif-cat-btn active" data-query="">Trending</button>';
    _categories.forEach(function(cat) {
      html += '<button class="gif-cat-btn" data-query="' + cat.query + '">' + cat.label + '</button>';
    });
    container.innerHTML = html;
    container.querySelectorAll('.gif-cat-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        container.querySelectorAll('.gif-cat-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        _query = this.getAttribute('data-query');
        var input = document.getElementById('gif-search-input');
        if (input) input.value = _query;
        _page = 0;
        _allGifs = [];
        if (_query) {
          searchGifs(_query);
        } else {
          loadTrendingGifs();
        }
      });
    });
  }

  function _renderGrid(gifs, container, append) {
    if (!append) container.innerHTML = '';
    if (!gifs || gifs.length === 0) {
      if (!append) {
        container.innerHTML = '<div class="gif-empty">No GIFs found' + (_query ? ' for "' + _query + '"' : '') + '</div>';
      }
      return;
    }
    gifs.forEach(function(url, i) {
      var item = document.createElement('div');
      item.className = 'gif-item';
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', 'Select GIF');
      item.innerHTML = '<img src="' + url + '" loading="lazy" alt="GIF"><div class="gif-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>';
      item.addEventListener('click', function() {
        _selectGif(url, item);
      });
      item.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') _selectGif(url, item);
      });
      item.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        _showPreview(url);
      });
      item.style.animationDelay = (i * 30) + 'ms';
      container.appendChild(item);
    });
  }

  function _selectGif(url, item) {
    if (item) {
      item.classList.add('selected');
      setTimeout(function() { item.classList.remove('selected'); }, 300);
    }
    _saveRecent(url);
    if (_callback) _callback(url);
    setTimeout(function() { closeGifPicker(); }, 200);
  }

  function _showPreview(url) {
    var overlay = document.createElement('div');
    overlay.className = 'gif-preview-overlay';
    overlay.id = 'gif-preview-overlay';
    overlay.innerHTML = '<img src="' + url + '" alt="GIF Preview">';
    overlay.onclick = function() { overlay.remove(); };
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('open'); });
  }

  function _showLoading(container) {
    var div = document.createElement('div');
    div.className = 'gif-grid';
    div.id = 'gif-loading-grid';
    for (var i = 0; i < 12; i++) {
      var shimmer = document.createElement('div');
      shimmer.className = 'gif-shimmer';
      div.appendChild(shimmer);
    }
    container.appendChild(div);
  }

  function _hideLoading() {
    var el = document.getElementById('gif-loading-grid');
    if (el) el.remove();
  }

  async function _fetchTenor(q, limit, pos) {
    try {
      var url = 'https://tenor.googleapis.com/v2/search?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&q=' + encodeURIComponent(q) + '&limit=' + (limit || 20) + '&media_filter=gif';
      if (pos) url += '&pos=' + pos;
      var resp = await fetch(url);
      if (!resp.ok) throw new Error('Tenor API error');
      var data = await resp.json();
      if (data.results && data.results.length > 0) {
        var urls = data.results.map(function(r) {
          return r.media_formats && r.media_formats.gif ? r.media_formats.gif.url : (r.url || '');
        }).filter(function(u) { return u; });
        return { urls: urls, next: data.next || null };
      }
      return { urls: [], next: null };
    } catch (e) {
      return { urls: [], next: null };
    }
  }

  async function searchGifs(query) {
    if (!query) { loadTrendingGifs(); return; }
    var content = document.getElementById('gif-content');
    if (!content) return;
    content.innerHTML = '';
    _showLoading(content);
    _loading = true;

    var result = await _fetchTenor(query, 20, _page > 0 ? (_page * 20) : null);
    _hideLoading();
    _loading = false;

    if (result.urls.length > 0) {
      _allGifs = _allGifs.concat(result.urls);
      var grid = document.createElement('div');
      grid.className = 'gif-grid';
      grid.id = 'gif-results-grid';
      content.appendChild(grid);
      _renderGrid(result.urls, grid, true);
      if (result.next) {
        _page++;
        content.onscroll = function() {
          if (content.scrollTop + content.clientHeight >= content.scrollHeight - 100 && !_loading) {
            _loadMore(query, result.next, grid, content);
          }
        };
      }
    } else {
      _renderGrid(_curatedGifs.filter(function(u) { return u.toLowerCase().indexOf(query.toLowerCase()) !== -1; }).slice(0, 20), content, false);
      if (content.children.length === 0) {
        content.innerHTML = '<div class="gif-empty">No GIFs found for "' + _esc(query) + '"</div>';
      }
    }
  }

  async function _loadMore(query, pos, grid, container) {
    _loading = true;
    var spinner = document.createElement('div');
    spinner.className = 'gif-loading';
    spinner.innerHTML = '<div class="gif-loading-spinner"></div>';
    container.appendChild(spinner);
    var result = await _fetchTenor(query, 20, pos);
    spinner.remove();
    _loading = false;
    if (result.urls.length > 0) {
      _allGifs = _allGifs.concat(result.urls);
      _renderGrid(result.urls, grid, true);
    }
  }

  async function loadTrendingGifs() {
    var content = document.getElementById('gif-content');
    if (!content) return;
    content.innerHTML = '';
    _showLoading(content);
    _loading = true;

    var result = await _fetchTenor('trending', 20);
    _hideLoading();
    _loading = false;

    var gifs = result.urls.length > 0 ? result.urls : _curatedGifs.slice(0, 20);

    var recentUrls = _getRecent();
    if (recentUrls.length > 0) {
      var header = document.createElement('div');
      header.className = 'gif-section-header';
      header.textContent = 'Recently used';
      content.appendChild(header);
      var recentGrid = document.createElement('div');
      recentGrid.className = 'gif-grid';
      content.appendChild(recentGrid);
      _renderGrid(recentUrls.slice(0, 12), recentGrid, false);
    }

    var trendingHeader = document.createElement('div');
    trendingHeader.className = 'gif-section-header';
    trendingHeader.textContent = 'Trending';
    content.appendChild(trendingHeader);
    var grid = document.createElement('div');
    grid.className = 'gif-grid';
    grid.id = 'gif-results-grid';
    content.appendChild(grid);
    _renderGrid(gifs, grid, false);
  }

  function _esc(str) {
    if (typeof window.escHtml === 'function') return window.escHtml(str);
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function openGifPicker(callback) {
    _callback = callback || null;
    _page = 0;
    _query = '';
    _allGifs = [];
    _injectStyles();
    _buildOverlay();
    var input = document.getElementById('gif-search-input');
    if (input) input.value = '';
    loadTrendingGifs();
    requestAnimationFrame(function() {
      document.getElementById('gif-overlay').classList.add('open');
      if (input) input.focus();
    });
  }

  function closeGifPicker() {
    var overlay = document.getElementById('gif-overlay');
    if (overlay) {
      overlay.classList.remove('open');
      setTimeout(function() { overlay.remove(); }, 300);
    }
    var preview = document.getElementById('gif-preview-overlay');
    if (preview) preview.remove();
    _callback = null;
  }

  function renderGifGrid(gifs, container) {
    if (container) _renderGrid(gifs, container, false);
  }

  window.openGifPicker = openGifPicker;
  window.closeGifPicker = closeGifPicker;
  window.searchGifs = searchGifs;
  window.loadTrendingGifs = loadTrendingGifs;
  window.renderGifGrid = renderGifGrid;
})();
