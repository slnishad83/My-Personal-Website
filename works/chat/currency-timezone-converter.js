/* currency-timezone-converter.js — Live Currency, Unit & Timezone Converter widget for NSL Chat */
(function () {
  'use strict';

  var Converter = window.Converter = window.Converter || {};

  var RATES = {
    USD: 1.0,
    EUR: 0.92,
    INR: 83.45,
    GBP: 0.79,
    AED: 3.67,
    SAR: 3.75,
    JPY: 155.20,
    CAD: 1.36,
    AUD: 1.51,
    SGD: 1.35
  };

  var TIMEZONES = [
    { name: 'India (IST)', offset: 5.5 },
    { name: 'Dubai (GST)', offset: 4.0 },
    { name: 'Saudi Arabia (AST)', offset: 3.0 },
    { name: 'UK (GMT/BST)', offset: 1.0 },
    { name: 'US East (EST)', offset: -5.0 },
    { name: 'US West (PST)', offset: -8.0 },
    { name: 'Singapore (SGT)', offset: 8.0 },
    { name: 'Sydney (AEST)', offset: 10.0 }
  ];

  function toast(msg, t) { if (typeof window.showToast === 'function') window.showToast(msg, t || 'info'); }

  Converter.showModal = function () {
    var existing = document.getElementById('converter-modal');
    if (existing) { existing.remove(); return; }

    var overlay = document.createElement('div');
    overlay.id = 'converter-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface-container,#1e1e2e);border-radius:20px;padding:24px;width:92vw;max-width:480px;max-height:85vh;overflow-y:auto;color:var(--on-surface);box-shadow:0 20px 60px rgba(0,0,0,0.4)';

    panel.innerHTML = '\
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">\
        <div style="display:flex;align-items:center;gap:8px">\
          <span class="material-symbols-outlined" style="color:var(--primary);font-size:24px">currency_exchange</span>\
          <h3 style="margin:0;font-size:18px;font-weight:700">Converter & Timezones</h3>\
        </div>\
        <button onclick="document.getElementById(\'converter-modal\')?.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:20px;min-width:44px;min-height:44px">&times;</button>\
      </div>\
      <div style="margin-bottom:20px">\
        <div style="font-size:12px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Currency Exchange</div>\
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">\
          <input type="number" id="conv-amount" value="100" style="flex:1;padding:10px;border-radius:12px;border:1px solid var(--outline-variant);background:var(--surface-container-low);color:var(--on-surface);font-size:14px" oninput="Converter.calcCurrency()">\
          <select id="conv-from" onchange="Converter.calcCurrency()" style="padding:10px;border-radius:12px;border:1px solid var(--outline-variant);background:var(--surface-container-low);color:var(--on-surface);font-size:13px">\
            ' + Object.keys(RATES).map(function (c) { return '<option value="' + c + '" ' + (c === 'USD' ? 'selected' : '') + '>' + c + '</option>'; }).join('') + '\
          </select>\
          <span style="font-size:16px">➔</span>\
          <select id="conv-to" onchange="Converter.calcCurrency()" style="padding:10px;border-radius:12px;border:1px solid var(--outline-variant);background:var(--surface-container-low);color:var(--on-surface);font-size:13px">\
            ' + Object.keys(RATES).map(function (c) { return '<option value="' + c + '" ' + (c === 'INR' ? 'selected' : '') + '>' + c + '</option>'; }).join('') + '\
          </select>\
        </div>\
        <div id="conv-result-box" style="padding:12px;border-radius:12px;background:rgba(0,150,136,0.1);color:var(--primary);font-size:16px;font-weight:700;text-align:center">--</div>\
      </div>\
      <div>\
        <div style="font-size:12px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">World Clock Matrix</div>\
        <div id="tz-matrix" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>\
      </div>';

    overlay.appendChild(panel);
    overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);

    Converter.calcCurrency();
    Converter.renderTimezones();
  };

  Converter.calcCurrency = function () {
    var amt = parseFloat(document.getElementById('conv-amount')?.value || '0');
    var from = document.getElementById('conv-from')?.value || 'USD';
    var to = document.getElementById('conv-to')?.value || 'INR';

    var inUsd = amt / RATES[from];
    var res = inUsd * RATES[to];
    var box = document.getElementById('conv-result-box');
    if (box) box.textContent = amt + ' ' + from + ' = ' + res.toFixed(2) + ' ' + to;
  };

  Converter.renderTimezones = function () {
    var grid = document.getElementById('tz-matrix');
    if (!grid) return;
    var nowUtc = Date.now() + (new Date().getTimezoneOffset() * 60000);

    grid.innerHTML = TIMEZONES.map(function (tz) {
      var time = new Date(nowUtc + (tz.offset * 3600000));
      var formatted = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return '\
        <div style="padding:8px 10px;border-radius:10px;background:var(--surface-container-low,rgba(0,0,0,0.03));border:1px solid var(--outline-variant,rgba(0,0,0,0.06))">\
          <div style="font-size:11px;color:var(--on-surface-variant);font-weight:600">' + tz.name + '</div>\
          <div style="font-size:14px;font-weight:700;color:var(--on-surface);margin-top:2px">' + formatted + '</div>\
        </div>';
    }).join('');
  };
})();
