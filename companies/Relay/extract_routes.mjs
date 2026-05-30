import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverFile = path.resolve(__dirname, './server/index.mjs');

const code = fs.readFileSync(serverFile, 'utf-8');
const lines = code.split('\n');

console.log("Server routes:");
lines.forEach((line, index) => {
  if (line.trim().startsWith('app.post(') || line.trim().startsWith('app.get(') || line.trim().startsWith('app.put(') || line.trim().startsWith('app.delete(')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
