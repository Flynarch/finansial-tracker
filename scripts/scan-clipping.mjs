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
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = scanDir('./src');
const patterns = [
  { name: 'truncate', regex: /\btruncate\b/g },
  { name: 'line-clamp', regex: /\bline-clamp-\d\b/g },
  { name: 'overflow-hidden', regex: /\boverflow-hidden\b/g },
  { name: 'whitespace-nowrap', regex: /\bwhitespace-nowrap\b/g },
  { name: 'text-ellipsis', regex: /\btext-ellipsis\b/g },
  { name: 'max-w-fixed', regex: /\bmax-w-\[\d+px\]\b/g },
  { name: 'w-fixed', regex: /\bw-\[\d+px\]\b/g }
];

const results = {};

for (const file of files) {
  if (file.includes('locales') || file.includes('i18n.js') || file.includes('.test.')) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    patterns.forEach(p => {
      if (p.regex.test(line)) {
        if (!results[p.name]) results[p.name] = [];
        results[p.name].push({
          file: path.relative('.', file).replace(/\\/g, '/'),
          line: idx + 1,
          text: line.trim()
        });
      }
    });
  });
}

console.log('=== CLIPPING / TRUNCATION PATTERNS AUDIT ===');
for (const [name, matches] of Object.entries(results)) {
  console.log(`${name}: ${matches.length} occurrences`);
}

fs.writeFileSync('./scripts/clipping-audit.json', JSON.stringify(results, null, 2));
