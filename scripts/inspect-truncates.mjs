import fs from 'node:fs';

const clippingData = JSON.parse(fs.readFileSync('./scripts/clipping-audit.json', 'utf8'));
const truncateList = clippingData.truncate || [];

console.log(`Total truncate occurrences: ${truncateList.length}`);

// Group by file
const byFile = {};
truncateList.forEach(item => {
  if (!byFile[item.file]) byFile[item.file] = [];
  byFile[item.file].push(item);
});

for (const [file, items] of Object.entries(byFile)) {
  console.log(`\n--- ${file} (${items.length}) ---`);
  items.forEach(i => console.log(`  Line ${i.line}: ${i.text.slice(0, 100)}`));
}
