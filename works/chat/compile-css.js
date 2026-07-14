import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CSS_FILES = [
  'chat-theme.css',
  'redesign-base.css',
  'chat-enhancements.css',
  'chat.css',
  'chat-missing-features.css',
  'accessibility.css',
  'message-actions.css',
  'scheduled-calendar.css',
  'notification-prefs.css',
  'url-preview.css',
  'translation-ui.css',
  'sync-audit.css',
  'snooze-history.css',
  'snooze-enhancements.css',
  'chat-consolidated.css'
];

let bundle = '/* NSL Chat Production Consolidated CSS Bundle */\n';
for (const file of CSS_FILES) {
  try {
    const content = readFileSync(file, 'utf8');
    bundle += `\n/* ═══ ${file} ═══ */\n${content}\n`;
  } catch (e) {
    console.warn('Skipped ' + file + ': ' + e.message);
  }
}

writeFileSync(join('dist', 'chat-bundle.css'), bundle, 'utf8');
console.log('Successfully wrote dist/chat-bundle.css');
