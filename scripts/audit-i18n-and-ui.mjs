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
  // Match t('key') or t('key', 'fallback') or t("key", ...)
  const tKeyRegex = /\bt\(\s*['"]([^'"`$\r\n]+)['"](?:\s*,\s*['"]([^'"`\r\n]*)['"])?/g;
  const usedKeys = new Map(); // key -> { fallback, files: Set }

  for (const file of files) {
    if (file.includes('locales') || file.includes('i18n.js') || file.includes('.test.')) continue;
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = tKeyRegex.exec(content)) !== null) {
      const key = match[1].trim();
      const fallback = match[2];
      if (!usedKeys.has(key)) {
        usedKeys.set(key, { fallback, files: new Set() });
      }
      usedKeys.get(key).files.add(file);
      if (fallback && !usedKeys.get(key).fallback) {
        usedKeys.get(key).fallback = fallback;
      }
    }
  }

  const missingFromId = [];
  const missingFromEn = [];

  for (const [key, data] of usedKeys.entries()) {
    if (!(key in id)) {
      missingFromId.push({ key, fallback: data.fallback, files: Array.from(data.files) });
    }
    if (!(key in en)) {
      missingFromEn.push({ key, fallback: data.fallback, files: Array.from(data.files) });
    }
  }

  const idKeys = Object.keys(id);
  const enKeys = Object.keys(en);
  const inIdNotInEn = idKeys.filter(k => !(k in en));
  const inEnNotInId = enKeys.filter(k => !(k in id));

  const report = {
    totalIdKeys: idKeys.length,
    totalEnKeys: enKeys.length,
    inIdNotInEn,
    inEnNotInId,
    totalUsedInCode: usedKeys.size,
    missingFromIdCount: missingFromId.length,
    missingFromId,
    missingFromEnCount: missingFromEn.length,
    missingFromEn,
  };

  fs.writeFileSync('./scripts/audit-report.json', JSON.stringify(report, null, 2));
  console.log(`Audited ${usedKeys.size} t() keys.`);
  console.log(`Keys in id.js but not in en.js: ${inIdNotInEn.length}`);
  console.log(`Keys in en.js but not in id.js: ${inEnNotInId.length}`);
  console.log(`Keys used in code missing from id.js: ${missingFromId.length}`);
  console.log(`Keys used in code missing from en.js: ${missingFromEn.length}`);
  console.log('Report saved to scripts/audit-report.json');
}

main();
