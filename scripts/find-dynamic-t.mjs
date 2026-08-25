import fs from 'node:fs';
import path from 'node:path';

async function main() {
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
  // Check for dynamic t(`...`) calls
  const dynamicTRegex = /\bt\(\s*`([^`]+)`/g;
  const dynamicKeys = [];

  for (const file of files) {
    if (file.includes('locales') || file.includes('i18n.js') || file.includes('.test.')) continue;
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = dynamicTRegex.exec(content)) !== null) {
      dynamicKeys.push({
        template: match[1],
        file: path.relative('.', file).replace(/\\/g, '/')
      });
    }
  }

  console.log('Dynamic t() calls count:', dynamicKeys.length);
  console.log(JSON.stringify(dynamicKeys, null, 2));
}

main();
