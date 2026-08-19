(function() {
  'use strict';
  /* DND (Do Not Disturb) / Quiet Hours � global scheduling */
  
  let _enabled = false;
  let _startHour = 22; // 10 PM
  let _endHour = 7;    // 7 AM
  let _timer = null;
  
  function isQuietNow() {
    if (!_enabled) {
      try {
        const dnd = JSON.parse(localStorage.getItem('nsl_dnd_settings') || '{}');
        if (dnd.enabled && dnd.from && dnd.to) {
          const now = new Date();
          const tzOffset = dnd.tzOffset || -now.getTimezoneOffset();
          const serverUtcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
          const userLocalMinutes = (serverUtcMinutes - tzOffset + 1440) % 1440;
          const [fromH, fromM] = dnd.from.split(':').map(Number);
          const [toH, toM] = dnd.to.split(':').map(Number);
          const fromMinutes = fromH * 60 + fromM;
          const toMinutes = toH * 60 + toM;
          if (fromMinutes <= toMinutes) {
            return userLocalMinutes >= fromMinutes && userLocalMinutes <= toMinutes;
          } else {
            return userLocalMinutes >= fromMinutes || userLocalMinutes <= toMinutes;
          }
        }
      } catch(_) {}
      return false;
    }
    const now = new Date();
    const h = now.getHours();
    if (_startHour < _endHour) {
      return h >= _startHour && h < _endHour;
    } else {
      return h >= _startHour || h < _endHour;
    }
  }
  
  function shouldSuppressNotification() {
    return isQuietNow();
  }
  
  function save() {
    try {
      localStorage.setItem('nsl-dnd', JSON.stringify({ enabled: _enabled, start: _startHour, end: _endHour }));
    } catch(_) {}
  }
  
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem('nsl-dnd'));
      if (d) {
        _enabled = !!d.enabled;
        _startHour = typeof d.start === 'number' ? d.start : 22;
        _endHour = typeof d.end === 'number' ? d.end : 7;
      }
    } catch(_) {}
  }
  
  function setSchedule(startHour, endHour, enabled) {
    _startHour = startHour;
    _endHour = endHour;
    _enabled = enabled;
    save();
    if (typeof showToast === 'function') {
      showToast(enabled ? `Quiet hours: ${fmt(_startHour)} � ${fmt(_endHour)}` : 'Quiet hours disabled', 'info');
    }
  }
  
  function fmt(h) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;
    return hh + ':00 ' + ampm;
  }
  
  function getSettings() {
    return { enabled: _enabled, startHour: _startHour, endHour: _endHour, isQuietNow: isQuietNow() };
  }
  
  function toggle() {
    setSchedule(_startHour, _endHour, !_enabled);
  }
  
  load();
  
  window.DndQuietHours = { isQuietNow, shouldSuppressNotification, setSchedule, getSettings, toggle, fmt };
})();
