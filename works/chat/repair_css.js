const fs = require('fs');

try {
  const filePath = 'c:\\Users\\Nishad\\Desktop\\My\\works\\chat\\chat-enhancements.css';
  let css = fs.readFileSync(filePath, 'utf8');

  // Let's locate the corrupted section
  const targetPattern = /\/\* ── Recording bar adaptation ── \*\/\r?\n\s+font-size: 22px;\r?\n\s+}\r?\n\s+\.wa-send-mic-btn {[\s\S]*?\.wa-input-footer:not\(\.hidden\) {\r?\n\s+display: flex;\r?\n}/;

  const replacement = `/* ── Recording bar adaptation ── */
#recording-bar {
  background: var(--wa-footer-bg, #202c33) !important;
  border-top-color: rgba(134, 150, 160, 0.15) !important;
}

/* ── Light mode overrides ── */
html:not(.dark) .wa-input-footer {
  --wa-footer-bg: #f0f2f5;
  --wa-input-bg: #ffffff;
  --wa-icon-color: #54656f;
  --wa-icon-hover: #3b4a54;
  --wa-text-color: #111b21;
  --wa-placeholder: #667781;
  --wa-green: #00a884;
  --wa-green-hover: #06cf9c;
  --wa-send-icon-color: #ffffff;
}

/* ── Mobile responsiveness ── */
@media (max-width: 767px) {
  .wa-input-footer {
    padding: 5px 6px;
    gap: 6px;
  }
  .wa-input-box {
    padding: 4px 4px;
    gap: 0;
  }
  .wa-input-icon {
    width: 32px;
    height: 32px;
  }
  .wa-input-icon .material-symbols-outlined {
    font-size: 22px;
  }
  .wa-send-mic-btn {
    width: 40px;
    height: 40px;
  }
  .wa-send-mic-btn .material-symbols-outlined {
    font-size: 20px;
  }
  .wa-textarea {
    font-size: 14px;
    padding: 5px 4px;
    min-height: 56px;
  }
}

.wa-input-footer:not(.hidden) {
  display: flex;
}`;

  if (targetPattern.test(css)) {
    css = css.replace(targetPattern, replacement);
    console.log('Successfully repaired corrupted block.');
  } else {
    // If exact regex fails, do a simpler string replacement
    const simpleTarget = '/* ── Recording bar adaptation ── */';
    const index = css.indexOf(simpleTarget);
    if (index !== -1) {
      // Find end of the corrupted block (the next main section is .wa-input-box)
      const endMarker = '.wa-input-box {';
      const endIndex = css.indexOf(endMarker, index);
      if (endIndex !== -1) {
        css = css.substring(0, index) + replacement + '\n\n/* ── Rounded input box (left part) ── */\n' + css.substring(endIndex);
        console.log('Successfully repaired block using simple index matching.');
      } else {
        throw new Error('Could not locate end marker');
      }
    } else {
      throw new Error('Could not find starting corrupted block pattern');
    }
  }

  // Also append global @keyframes if they are not already present
  if (!css.includes('@keyframes fadeIn {')) {
    css += `\n\n@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}`;
    console.log('Appended fadeIn/slideUp keyframes.');
  }

  fs.writeFileSync(filePath, css, 'utf8');
  console.log('CSS file successfully written.');
} catch (err) {
  console.error('Repair failed:', err);
}
