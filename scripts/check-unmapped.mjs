import fs from 'node:fs';
import { explicitTranslations as keyMap } from './merge-all-translations.mjs';

const allMissing = fs.existsSync('./scripts/all-missing-keys.json')
  ? JSON.parse(fs.readFileSync('./scripts/all-missing-keys.json', 'utf8'))
  : [];

// Check all items in allMissing and map any unmapped ones
const unmapped = [];
allMissing.forEach(item => {
  if (!keyMap[item.key]) {
    unmapped.push(item);
  }
});

console.log(`Unmapped keys: ${unmapped.length}`);
if (unmapped.length > 0) {
  console.log(JSON.stringify(unmapped, null, 2));
}
