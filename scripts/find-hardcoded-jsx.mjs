import fs from 'node:fs';
import path from 'node:path';

function scanDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(scanDir(filePath));
    } else if (file.endsWith('.jsx')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = scanDir('./src');
const hardcodedFindings = [];

// Simple heuristic: JSX text like >Some text here< that is not pure symbols/numbers
const jsxTextRegex = />\s*([A-Za-zÀ-ÿ][^<>{}\n\r]{2,}[A-Za-zÀ-ÿ0-9.!?])\s*</g;

for (const file of files) {
  if (file.includes('.test.') || file.includes('icons/')) continue;
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = jsxTextRegex.exec(content)) !== null) {
    const text = match[1].trim();
    // Ignore SVG path data or single codes or CSS units or numbers
    if (/^(M\d|px|rem|%|true|false|null|undefined|IDR|USD|EUR|GBP|JPY|SGD|MYR|AUD)$/i.test(text)) continue;
    if (/^[0-9\s.,:\-+/\\%()]+$/.test(text)) continue;
    hardcodedFindings.push({
      file: path.relative('.', file).replace(/\\/g, '/'),
      text
    });
  }
}

console.log(`Found ${hardcodedFindings.length} potentially hardcoded JSX text occurrences.`);
fs.writeFileSync('./scripts/hardcoded-jsx.json', JSON.stringify(hardcodedFindings, null, 2));
