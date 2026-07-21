(function () {
  'use strict';

  var _errorClass = 'fv-field-error';
  var _successClass = 'fv-field-success';
  var _debounceTimers = {};
  var _validationState = {};

  function _getStyles() {
    var isDark = document.documentElement.classList.contains('dark') ||
                 document.body.classList.contains('dark') ||
                 document.body.classList.contains('dark-mode');
    return {
      errorColor: isDark ? '#ff6b6b' : '#ef4444',
      successColor: isDark ? '#4ade80' : '#22c55e',
      textColor: isDark ? '#e9edef' : '#111b21',
      mutedColor: isDark ? '#8696a0' : '#667781',
      inputBg: isDark ? '#1f2c34' : '#ffffff',
      borderColor: isDark ? '#2a3942' : '#e2e8f0'
    };
  }

  function _injectStyles() {
    if (document.getElementById('fv-styles')) return;
    var style = document.createElement('style');
    style.id = 'fv-styles';
    style.textContent =
      '@keyframes fvFadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}' +
      '.fv-msg{font-size:12px;margin-top:4px;animation:fvFadeIn .2s ease;position:relative;padding-left:18px;line-height:1.4}' +
      '.fv-msg-error{color:#ef4444}' +
      '.fv-msg-success{color:#22c55e}' +
      'html.dark .fv-msg-error, body.dark .fv-msg-error{color:#ff6b6b}' +
      'html.dark .fv-msg-success, body.dark .fv-msg-success{color:#4ade80}' +
      '.fv-msg-icon{position:absolute;left:0;top:0;font-size:12px;line-height:1.4}' +
      '.fv-strength{display:flex;gap:3px;margin-top:6px;height:4px}' +
      '.fv-strength-seg{flex:1;border-radius:2px;background:#e2e8f0;transition:background .3s}' +
      'html.dark .fv-strength-seg{background:#2a3942}' +
      '.fv-counter{font-size:11px;margin-top:3px;text-align:right;color:#667781}' +
      'html.dark .fv-counter{color:#8696a0}' +
      '.fv-counter-warn{color:#ef4444}' +
      'html.dark .fv-counter-warn{color:#ff6b6b}' +
      'input.fv-valid, textarea.fv-valid, select.fv-valid{border:2px solid #22c55e !important}' +
      'input.fv-invalid, textarea.fv-invalid, select.fv-invalid{border:2px solid #ef4444 !important}' +
      'html.dark input.fv-valid, html.dark textarea.fv-valid, html.dark select.fv-valid{border-color:#4ade80 !important}' +
      'html.dark input.fv-invalid, html.dark textarea.fv-invalid, html.dark select.fv-invalid{border-color:#ff6b6b !important}' +
      'body.dark input.fv-valid, body.dark textarea.fv-valid, body.dark select.fv-valid{border-color:#4ade80 !important}' +
      'body.dark input.fv-invalid, body.dark textarea.fv-invalid, body.dark select.fv-invalid{border-color:#ff6b6b !important}';
    document.head.appendChild(style);
  }

  function _ensureContainer(input) {
    var id = input.id || input.name || ('fv_' + Math.random().toString(36).slice(2, 8));
    if (!input.id) input.id = id;
    var existing = document.getElementById(id + '_fv-msg');
    if (existing) return existing;
    var msg = document.createElement('div');
    msg.id = id + '_fv-msg';
    msg.className = 'fv-msg';
    msg.setAttribute('role', 'alert');
    msg.setAttribute('aria-live', 'polite');
    msg.style.display = 'none';
    var parent = input.parentNode;
    if (parent) {
      parent.insertBefore(msg, input.nextSibling);
    }
    return msg;
  }

  function _validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function _validatePhone(value) {
    return /^\+?\d{10,}$/.test(value.replace(/[\s\-\(\)]/g, ''));
  }

  function _validatePassword(value) {
    if (value.length < 8) return false;
    var hasLower = /[a-z]/.test(value);
    var hasUpper = /[A-Z]/.test(value);
    var hasDigit = /\d/.test(value);
    var hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);
    return (hasLower || hasUpper) && (hasDigit || hasSpecial);
  }

  function _getPasswordStrength(value) {
    var score = 0;
    if (value.length >= 6) score++;
    if (value.length >= 8) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) score++;
    if (score <= 1) return 0;
    if (score <= 2) return 1;
    if (score <= 3) return 2;
    return 3;
  }

  function _findField(formId, fieldId) {
    var form = document.getElementById(formId);
    if (!form) return null;
    return form.querySelector('[id="' + fieldId + '"], [name="' + fieldId + '"]');
  }

  function _getRules(input) {
    return input._fvRules || null;
  }

  function validateField(input) {
    var rules = _getRules(input);
    if (!rules) return { valid: true, message: '' };
    var value = input.value || '';
    var trimmed = value.trim();

    if (rules.required && !trimmed) {
      return { valid: false, message: rules.requiredMessage || 'This field is required' };
    }
    if (!trimmed && !rules.required) {
      return { valid: true, message: '' };
    }
    if (rules.minLength && trimmed.length < rules.minLength) {
      return { valid: false, message: rules.minLengthMessage || ('Minimum ' + rules.minLength + ' characters') };
    }
    if (rules.maxLength && trimmed.length > rules.maxLength) {
      return { valid: false, message: rules.maxLengthMessage || ('Maximum ' + rules.maxLength + ' characters') };
    }
    if (rules.email && !_validateEmail(trimmed)) {
      return { valid: false, message: rules.emailMessage || 'Enter a valid email address' };
    }
    if (rules.phone && !_validatePhone(trimmed)) {
      return { valid: false, message: rules.phoneMessage || 'Enter a valid phone number (10+ digits)' };
    }
    if (rules.password && !_validatePassword(trimmed)) {
      return { valid: false, message: rules.passwordMessage || 'Must be 8+ chars with mixed case and a number or special character' };
    }
    if (rules.match) {
      var matchField = _findField(input.closest('form')?.id, rules.match);
      if (matchField && matchField.value !== trimmed) {
        return { valid: false, message: rules.matchMessage || 'Fields do not match' };
      }
    }
    if (rules.pattern && !rules.pattern.test(trimmed)) {
      return { valid: false, message: rules.patternMessage || 'Invalid format' };
    }
    if (rules.custom && typeof rules.custom === 'function') {
      var customResult = rules.custom(trimmed, input);
      if (customResult === false) {
        return { valid: false, message: rules.customMessage || 'Invalid value' };
      }
      if (typeof customResult === 'string') {
        return { valid: false, message: customResult };
      }
    }
    return { valid: true, message: '' };
  }

  function showFieldError(input, message) {
    _injectStyles();
    var msgEl = _ensureContainer(input);
    input.classList.remove('fv-valid');
    input.classList.add('fv-invalid');
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', msgEl.id);
    msgEl.className = 'fv-msg fv-msg-error';
    msgEl.innerHTML = '<span class="fv-msg-icon">\u274C</span> ' + _escHtml(message);
    msgEl.style.display = '';
  }

  function clearFieldError(input) {
    var id = input.id || input.name;
    var msgEl = document.getElementById(id + '_fv-msg');
    if (msgEl) msgEl.style.display = 'none';
    input.classList.remove('fv-invalid');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }

  function showFieldSuccess(input) {
    _injectStyles();
    clearFieldError(input);
    input.classList.remove('fv-invalid');
    input.classList.add('fv-valid');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }

  function addFieldValidation(input, rules) {
    if (!input) return;
    input._fvRules = rules;
    _injectStyles();
    var formId = input.closest('form')?.id || '_global';
    if (!_validationState[formId]) _validationState[formId] = {};
    var fieldKey = input.id || input.name || ('f_' + Math.random().toString(36).slice(2, 8));
    if (!input.id && !input.name) input.id = fieldKey;
    _validationState[formId][fieldKey] = { touched: false, valid: null };

    var debouncedInput = function () {
      clearTimeout(_debounceTimers[fieldKey]);
      _debounceTimers[fieldKey] = setTimeout(function () {
        if (!_validationState[formId][fieldKey].touched) return;
        var result = validateField(input);
        if (!result.valid) {
          showFieldError(input, result.message);
        } else {
          showFieldSuccess(input);
        }
        _validationState[formId][fieldKey].valid = result.valid;
      }, 300);
    };

    input.addEventListener('blur', function () {
      _validationState[formId][fieldKey].touched = true;
      var result = validateField(input);
      if (!result.valid) {
        showFieldError(input, result.message);
      } else if (input.value.trim()) {
        showFieldSuccess(input);
      } else {
        clearFieldError(input);
        input.classList.remove('fv-valid');
      }
      _validationState[formId][fieldKey].valid = result.valid;
    });

    input.addEventListener('input', debouncedInput);

    input.addEventListener('focus', function () {
      input.classList.remove('fv-invalid');
      var id = input.id || input.name;
      var msgEl = document.getElementById(id + '_fv-msg');
      if (msgEl && input.getAttribute('aria-invalid') === 'true') {
        msgEl.style.display = '';
      }
    });
  }

  function validateForm(formId) {
    var form = document.getElementById(formId);
    if (!form) return false;
    var allValid = true;
    var firstInvalid = null;
    var fields = form.querySelectorAll('input, textarea, select');
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (!field._fvRules) continue;
      var result = validateField(field);
      if (!result.valid) {
        allValid = false;
        showFieldError(field, result.message);
        if (!firstInvalid) firstInvalid = field;
      } else {
        if (field.value.trim()) {
          showFieldSuccess(field);
        }
      }
    }
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalid.focus();
    }
    return allValid;
  }

  function initFormValidation(formId, rules) {
    var form = document.getElementById(formId);
    if (!form) return;
    _injectStyles();
    var fields = form.querySelectorAll('input, textarea, select');
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      var fieldId = field.id || field.name;
      if (fieldId && rules[fieldId]) {
        addFieldValidation(field, rules[fieldId]);
      }
    }
    form.setAttribute('novalidate', 'novalidate');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (validateForm(formId)) {
        var submitEvent = new CustomEvent('fv:valid', { detail: { formId: formId } });
        form.dispatchEvent(submitEvent);
      }
    });
  }

  function addPasswordStrengthMeter(input, container) {
    if (!input || !container) return;
    _injectStyles();
    var meter = document.createElement('div');
    meter.className = 'fv-strength';
    meter.setAttribute('aria-hidden', 'true');
    var labels = ['Weak', 'Fair', 'Good', 'Strong'];
    var colors = ['#ef4444', '#f97316', '#f59e0b', '#22c55e'];
    var segments = [];
    for (var i = 0; i < 4; i++) {
      var seg = document.createElement('div');
      seg.className = 'fv-strength-seg';
      meter.appendChild(seg);
      segments.push(seg);
    }
    container.appendChild(meter);
    var label = document.createElement('div');
    label.className = 'fv-counter';
    label.style.textAlign = 'left';
    label.style.marginTop = '2px';
    container.appendChild(label);

    var isDark = function () {
      return document.documentElement.classList.contains('dark') ||
             document.body.classList.contains('dark') ||
             document.body.classList.contains('dark-mode');
    };

    function update() {
      var val = input.value || '';
      if (!val) {
        for (var j = 0; j < segments.length; j++) {
          segments[j].style.background = isDark() ? '#2a3942' : '#e2e8f0';
        }
        label.textContent = '';
        label.style.color = '';
        input.classList.remove('fv-valid', 'fv-invalid');
        return;
      }
      var strength = _getPasswordStrength(val);
      for (var k = 0; k < segments.length; k++) {
        if (k <= strength) {
          segments[k].style.background = colors[strength];
        } else {
          segments[k].style.background = isDark() ? '#2a3942' : '#e2e8f0';
        }
      }
      label.textContent = labels[strength];
      label.style.color = colors[strength];
    }

    input.addEventListener('input', update);
    input.addEventListener('blur', update);
    update();
  }

  function addCharacterCounter(input, max) {
    if (!input) return;
    _injectStyles();
    var counter = document.createElement('div');
    counter.className = 'fv-counter';
    var parent = input.parentNode;
    if (parent) parent.insertBefore(counter, input.nextSibling);

    function update() {
      var len = (input.value || '').length;
      counter.textContent = len + ' / ' + max;
      if (len > max * 0.9) {
        counter.classList.add('fv-counter-warn');
      } else {
        counter.classList.remove('fv-counter-warn');
      }
    }

    input.addEventListener('input', update);
    update();
  }

  function _escHtml(str) {
    if (window.App && window.App.escHtml) return window.App.escHtml(str);
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  window.validateField = validateField;
  window.validateForm = validateForm;
  window.showFieldError = showFieldError;
  window.clearFieldError = clearFieldError;
  window.showFieldSuccess = showFieldSuccess;
  window.addFieldValidation = addFieldValidation;
  window.initFormValidation = initFormValidation;
  window.addPasswordStrengthMeter = addPasswordStrengthMeter;
  window.addCharacterCounter = addCharacterCounter;

})();
