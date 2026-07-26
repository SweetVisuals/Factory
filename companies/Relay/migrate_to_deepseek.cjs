// Migrate all server files from Gemini back to DeepSeek V4 Flash
// This script replaces:
// 1. GEMINI_API_KEY -> DEEPSEEK_API_KEY (env var names)
// 2. generativelanguage.googleapis.com/v1beta/openai -> api.deepseek.com
// 3. gemini-1.5-flash -> deepseek-v4-flash (model name)
// 4. Removes hardcoded fallback API keys (replaces with empty string to force .env usage)
// 5. Renames log labels from "Gemini" to "DeepSeek"

const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, 'server');

const fileExts = ['.mjs', '.js', '.ts'];

// Hardcoded API keys that should NEVER appear in source code
const HARDCODED_KEYS = [
  'sk-0a7858e4ab064eb18241a7005f04df41',
  'sk-d703ac9c0fe74d05b1693c50a81ea9bc',
  'sk-6733c8ac2b83402b8626e5e253824488',
  'sk-b0c1833f01144c4aa6be72f5d6c72a56',
];

let totalChanges = 0;

function processFile(fullPath) {
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  const relPath = path.relative(__dirname, fullPath);

  // 1. Replace env var name GEMINI_API_KEY -> DEEPSEEK_API_KEY
  if (content.includes('GEMINI_API_KEY')) {
    content = content.replace(/GEMINI_API_KEY/g, 'DEEPSEEK_API_KEY');
    modified = true;
  }

  // 2. Replace base URL
  if (content.includes('generativelanguage.googleapis.com/v1beta/openai')) {
    content = content.replace(/https:\/\/generativelanguage\.googleapis\.com\/v1beta\/openai/g, 'https://api.deepseek.com');
    modified = true;
  }

  // 3. Replace model name
  if (content.includes('gemini-1.5-flash')) {
    content = content.replace(/gemini-1\.5-flash/g, 'deepseek-v4-flash');
    modified = true;
  }

  // 4. Replace GEMINI_BASE_URL -> DEEPSEEK_BASE_URL
  if (content.includes('GEMINI_BASE_URL')) {
    content = content.replace(/GEMINI_BASE_URL/g, 'DEEPSEEK_BASE_URL');
    modified = true;
  }

  // 5. Replace log labels
  content = content.replace(/\[AI-Client\] Gemini/g, '[AI-Client] DeepSeek');
  content = content.replace(/\[AI-Client\] .*Gemini API/g, '[AI-Client] DeepSeek API');
  if (content.includes('Gemini')) {
    // Only replace "Gemini" in log messages and comments, not in URLs
    content = content.replace(/Gemini cooldown/g, 'DeepSeek cooldown');
    content = content.replace(/Gemini 429/g, 'DeepSeek 429');
    content = content.replace(/Gemini 402/g, 'DeepSeek 402');
    content = content.replace(/Gemini server error/g, 'DeepSeek server error');
    content = content.replace(/Gemini exception/g, 'DeepSeek exception');
    content = content.replace(/Gemini failed/g, 'DeepSeek failed');
    content = content.replace(/Gemini success/g, 'DeepSeek success');
    content = content.replace(/Gemini API failed/g, 'DeepSeek API failed');
    content = content.replace(/Testing Gemini/g, 'Testing DeepSeek');
    content = content.replace(/Attempting Gemini/g, 'Attempting DeepSeek');
    modified = true;
  }

  // 6. Remove ALL hardcoded API key fallbacks
  for (const key of HARDCODED_KEYS) {
    if (content.includes(key)) {
      // Replace patterns like: || 'sk-xxx' or || "sk-xxx"
      content = content.replace(new RegExp(`\\s*\\|\\|\\s*['"]${key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}['"]`, 'g'), '');
      modified = true;
      console.log(`  ⚠️  Removed hardcoded key fallback: ${key.substring(0, 10)}... from ${relPath}`);
    }
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Updated: ${relPath}`);
    totalChanges++;
  }
}

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && file !== 'node_modules' && file !== '.git' && file !== 'dist') {
      processDir(fullPath);
    } else if (stat.isFile() && fileExts.some(ext => fullPath.endsWith(ext))) {
      processFile(fullPath);
    }
  }
}

console.log('=== Migrating from Gemini to DeepSeek V4 Flash ===\n');

// Process server directory
processDir(serverDir);

// Also process root-level scripts
const rootFiles = fs.readdirSync(__dirname).filter(f => fileExts.some(ext => f.endsWith(ext)));
for (const f of rootFiles) {
  processFile(path.join(__dirname, f));
}

// Process supabase functions
processDir(path.join(__dirname, 'supabase'));

// Update .env: rename GEMINI_API_KEY to DEEPSEEK_API_KEY if needed
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('GEMINI_API_KEY')) {
    envContent = envContent.replace(/GEMINI_API_KEY=/g, '# GEMINI_API_KEY removed - now using DEEPSEEK_API_KEY\n# GEMINI_API_KEY=');
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ Updated .env');
  }
}

console.log(`\n=== Migration complete. ${totalChanges} files updated. ===`);
