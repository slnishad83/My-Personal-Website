import { readFileSync, writeFileSync, renameSync, readdirSync, existsSync } from 'fs';
import { join, extname, basename as pathBasename, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));

function findRepeatedSuffix(base) {
  for (let len = Math.floor(base.length / 2); len >= 9; len--) {
    const suffix = base.slice(-len);
    const before = base.slice(0, -len);
    if (before.endsWith(suffix)) {
      let clean = before;
      while (clean.endsWith(suffix)) clean = clean.slice(0, -len);
      return clean + suffix;
    }
  }
  return null;
}

function collectFiles(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...collectFiles(full));
    else result.push(full);
  }
  return result;
}

const allFiles = collectFiles(DIST);
const renameMap = new Map();

for (const filePath of allFiles) {
  const base = pathBasename(filePath);
  const ext = extname(base);
  const nameNoExt = pathBasename(base, ext);
  const cleaned = findRepeatedSuffix(nameNoExt);
  if (cleaned && cleaned !== nameNoExt) {
    const newName = cleaned + ext;
    console.log(`  ${base}\n    -> ${newName}`);
    renameMap.set(base, newName);
  }
}

if (renameMap.size === 0) {
  console.log('No corrupted filenames found.');
  process.exit(0);
}

console.log(`\nRenaming ${renameMap.size} files...`);
for (const filePath of allFiles) {
  const base = pathBasename(filePath);
  if (renameMap.has(base)) {
    renameSync(join(dirname(filePath), base), join(dirname(filePath), renameMap.get(base)));
  }
}

console.log('Updating references...');
const textExts = new Set(['.html', '.js', '.css', '.json', '.svg']);
let updated = 0;
for (const filePath of allFiles) {
  const ext = extname(filePath).toLowerCase();
  if (!textExts.has(ext)) continue;
  const dir = dirname(filePath);
  const base = pathBasename(filePath);
  const actualPath = renameMap.has(base) ? join(dir, renameMap.get(base)) : filePath;
  if (!existsSync(actualPath)) continue;
  let content = readFileSync(actualPath, 'utf-8');
  let changed = false;
  for (const [oldName, newName] of renameMap) {
    if (content.includes(oldName)) {
      content = content.split(oldName).join(newName);
      changed = true;
    }
  }
  if (changed) { writeFileSync(actualPath, content, 'utf-8'); updated++; }
}
console.log(`Updated ${updated} files.`);
console.log('Done.');
