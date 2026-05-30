import fs from 'fs';
const file = 'scraper_debug.log';
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  const tail = lines.slice(-150);
  console.log(`=== SCRAPER_DEBUG.LOG TAIL (Total lines: ${lines.length}) ===`);
  tail.forEach((line, idx) => {
    console.log(`${lines.length - tail.length + idx + 1}: ${line}`);
  });
} else {
  console.log('Log file does not exist');
}
