const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Replace any rounded-* with rounded-none (except rounded-none itself)
  content = content.replace(/rounded-(?:md|lg|xl|2xl|3xl|full|sm|\[[a-zA-Z0-9px]+\])/g, 'rounded-none');
  
  // Catch generic rounded class if it appears as a standalone tailwind class
  content = content.replace(/(?<=[\s"'\`])rounded(?=[\s"'\`])/g, 'rounded-none');

  // Strip borders to enforce "no front end borders"
  // Replaces border, border-t, border-[color], etc. EXCEPT border-none and border-transparent
  content = content.replace(/(?<=[\s"'\`])border-(?!none|transparent|b|t|l|r|x|y)[a-zA-Z0-9-\[\]]+(?=[\s"'\`])/g, '');
  content = content.replace(/(?<=[\s"'\`])border(?=[\s"'\`])/g, 'border-none');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir(path.join(__dirname, 'src'));
console.log('Global aesthetic rules applied successfully.');
