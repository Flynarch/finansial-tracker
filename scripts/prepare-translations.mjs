import fs from 'node:fs';

const missing = JSON.parse(fs.readFileSync('./scripts/all-missing-keys.json', 'utf8'));

console.log(`Total missing: ${missing.length}`);
missing.forEach(m => {
  console.log(`KEY: ${m.key}`);
  console.log(`  Fallbacks: ${JSON.stringify(m.fallbacks)}`);
  console.log(`  Files: ${m.files.join(', ')}`);
});
