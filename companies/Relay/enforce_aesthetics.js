const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Replace any rounded-* with rounded-none (except rounded-none itself)
  // This matches rounded-md, rounded-lg, rounded-xl, rounded-2xl, rounded-3xl, rounded-[40px], rounded-full, etc.
  content = content.replace(/rounded-(?:md|lg|xl|2xl|3xl|full|sm|\[[a-zA-Z0-9]+\])/g, 'rounded-none');
  
  // Also catch generic rounded class if it appears as a standalone tailwind class
  content = content.replace(/(?<=[\s"'\`])rounded(?=[\s"'\`])/g, 'rounded-none');

  // Strip borders to enforce "no front end borders"
  // Find classes like border, border-t, border-r, border-b, border-l, border-[color], border-[size]
  // We want to replace them with border-none, OR just remove them and ensure border-none is present.
  // Actually, replacing 'border ' or 'border-t ' with nothing is safer to avoid duplicates.
  content = content.replace(/(?<=[\s"'\`])border-(?!none|transparent)[a-zA-Z0-9-\[\]]+(?=[\s"'\`])/g, '');
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
