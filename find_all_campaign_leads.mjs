import fs from 'fs';
import path from 'path';

console.log('=== SEARCHING FOR ALL LEAD SOURCES AND CAMPAIGN DATA ===');

function checkFile(filepath) {
  try {
    const stat = fs.statSync(filepath);
    if (stat.size === 0) return;

    if (filepath.endsWith('.json')) {
      const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      if (Array.isArray(content)) {
        console.log(`JSON File [${filepath}]: Array of ${content.length} items (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
        if (content.length > 0) {
          console.log(`  Sample item keys:`, Object.keys(content[0]));
        }
      } else if (typeof content === 'object' && content !== null) {
        console.log(`JSON File [${filepath}]: Object with keys [${Object.keys(content).join(', ')}] (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
      }
    } else if (filepath.endsWith('.sql')) {
      const text = fs.readFileSync(filepath, 'utf8');
      const insertLeads = (text.match(/INSERT INTO (public\.)?leads/gi) || []).length;
      const insertCampLeads = (text.match(/INSERT INTO (public\.)?campaign_leads/gi) || []).length;
      console.log(`SQL File [${filepath}]: ${(stat.size / 1024 / 1024).toFixed(2)} MB | INSERT leads: ${insertLeads}, INSERT campaign_leads: ${insertCampLeads}`);
    }
  } catch (e) {
    console.error(`Error reading ${filepath}:`, e.message);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.git' || f === 'dist' || f === 'brain') continue;
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else {
      if (f.endsWith('.json') || f.endsWith('.sql') || f.endsWith('.csv') || f.endsWith('.txt') || f.endsWith('.log')) {
        checkFile(fullPath);
      }
    }
  }
}

walkDir('c:/Users/Shadow/Desktop/Factory');
