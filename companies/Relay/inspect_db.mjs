import fs from 'fs';
import path from 'path';

function searchFiles(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        searchFiles(fullPath, query);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(query)) {
        console.log(`Found in: ${fullPath}`);
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (line.includes(query)) {
            console.log(`  ${i + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchFiles('C:/Users/Shadow/Desktop/Openclaw Factory/frontend/src', 'shadowColor');
