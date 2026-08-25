import fs from 'node:fs';

const items = JSON.parse(fs.readFileSync('./scripts/hardcoded-jsx.json', 'utf8'));
const byFile = {};

items.forEach(i => {
  if (!byFile[i.file]) byFile[i.file] = [];
  byFile[i.file].push(i.text);
});

for (const [file, texts] of Object.entries(byFile)) {
  console.log(`\n=== ${file} (${texts.length}) ===`);
  texts.forEach(t => console.log(`  - "${t}"`));
}
