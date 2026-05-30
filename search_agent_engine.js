const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.bolt') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath, query);
    } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs') || file.endsWith('.ts'))) {
      const code = fs.readFileSync(fullPath, 'utf-8');
      if (code.includes(query)) {
        console.log(`Found "${query}" in: ${path.relative(__dirname, fullPath)}`);
      }
    }
  }
}

console.log('--- Searching for "api.deepseek.com" in backend ---');
searchDir(__dirname, 'api.deepseek.com');

console.log('--- Searching for "deepseek" in backend ---');
searchDir(__dirname, 'deepseek');
