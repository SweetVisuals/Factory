import fs from 'fs';
import path from 'path';

const query = process.argv[2] || '';
const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.md'];

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === '.next' || file === 'dist' || file === 'build') continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.toLowerCase().includes(query.toLowerCase())) {
            console.log(`Found in: ${fullPath}`);
            const lines = content.split('\n');
            lines.forEach((line, i) => {
              if (line.toLowerCase().includes(query.toLowerCase())) {
                console.log(`  Line ${i + 1}: ${line.trim().slice(0, 100)}`);
              }
            });
          }
        } catch (e) {}
      }
    }
  }
}

console.log(`Searching for "${query}" in files...`);
searchDir('.');
