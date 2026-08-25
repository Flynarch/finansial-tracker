import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const idModule = await import('../src/locales/id.js');
  const enModule = await import('../src/locales/en.js');
  const id = idModule.default;
  const en = enModule.default;

  function scanDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(scanDir(filePath));
      } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(filePath);
      }
    });
    return results;
  }

  const files = scanDir('./src');
  const tKeyRegex = /\bt\(\s*['"]([^'"`$\r\n]+)['"](?:\s*,\s*['"]([^'"`\r\n]*)['"])?/g;
  const allUsedKeys = new Map();

  for (const file of files) {
    if (file.includes('locales') || file.includes('i18n.js') || file.includes('.test.')) continue;
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = tKeyRegex.exec(content)) !== null) {
      const key = match[1].trim();
      const fallback = match[2];
      if (!allUsedKeys.has(key)) {
        allUsedKeys.set(key, { fallbacks: new Set(), files: new Set() });
      }
      if (fallback) allUsedKeys.get(key).fallbacks.add(fallback);
      allUsedKeys.get(key).files.add(path.relative('.', file).replace(/\\/g, '/'));
    }
  }

  const missingList = [];
  for (const [key, data] of allUsedKeys.entries()) {
    const inId = key in id;
    const inEn = key in en;
    if (!inId || !inEn) {
      missingList.push({
        key,
        inId,
        inEn,
        idVal: id[key],
        enVal: en[key],
        fallbacks: Array.from(data.fallbacks),
        files: Array.from(data.files),
      });
    }
  }

  fs.writeFileSync('./scripts/all-missing-keys.json', JSON.stringify(missingList, null, 2));
  console.log(`Total missing keys to fix: ${missingList.length}`);
}

main();
