import fs from 'fs';
import path from 'path';
import https from 'https';

const outputPath = 'C:\\Users\\Shadow\\.gemini\\antigravity\\brain\\25023841-8897-47fe-8049-5f7bb04900ce\\.system_generated\\steps\\773\\output.txt';
const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

const dir = path.join('c:\\Users\\Shadow\\Desktop\\Factory\\companies\\Relay\\src\\stitch_html');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

for (const screen of data.screens) {
  if (screen.htmlCode && screen.htmlCode.downloadUrl) {
    const title = screen.title ? screen.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'untitled';
    const id = screen.name.split('/').pop();
    const filePath = path.join(dir, `${title}_${id}.html`);
    console.log(`Downloading ${title} (${id}) from ${screen.htmlCode.downloadUrl}...`);
    const url = screen.htmlCode.downloadUrl;
    
    await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          fs.writeFileSync(filePath, body, 'utf8');
          console.log(`Saved to ${filePath}`);
          resolve();
        });
      }).on('error', reject);
    });
  }
}
console.log('All screens downloaded successfully!');
