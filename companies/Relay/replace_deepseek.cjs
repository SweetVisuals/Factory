const fs = require('fs');
const path = require('path');

const targetDirs = [
    path.join(__dirname, 'server'),
    __dirname
];

const fileExts = ['.mjs', '.js', '.ts', '.cjs', '.md'];

function processDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && file !== 'node_modules' && file !== '.git' && file !== 'dist') {
            processDir(fullPath);
        } else if (stat.isFile() && fileExts.some(ext => fullPath.endsWith(ext))) {
            // Ignore this script itself
            if (fullPath.includes('replace_gemini.js')) continue;

            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Replace GEMINI_API_KEY -> GEMINI_API_KEY
            if (content.includes('GEMINI_API_KEY')) {
                content = content.replace(/GEMINI_API_KEY/g, 'GEMINI_API_KEY');
                modified = true;
            }

            // Replace GEMINI_BASE_URL -> GEMINI_BASE_URL
            if (content.includes('GEMINI_BASE_URL')) {
                content = content.replace(/GEMINI_BASE_URL/g, 'GEMINI_BASE_URL');
                modified = true;
            }

            // Replace generativelanguage.googleapis.com/v1beta/openai -> generativelanguage.googleapis.com/v1beta/openai
            if (content.includes('generativelanguage.googleapis.com/v1beta/openai')) {
                content = content.replace(/api\.gemini\.com/g, 'generativelanguage.googleapis.com/v1beta/openai');
                modified = true;
            }

            // Replace gemini-1.5-flash -> gemini-1.5-flash
            if (content.includes('gemini-1.5-flash')) {
                content = content.replace(/gemini-1.5-flash/g, 'gemini-1.5-flash');
                modified = true;
            }

            // Replace Disable gemini -> Disable gemini
            if (content.includes('disable_gemini')) {
                content = content.replace(/disable_gemini/g, 'disable_gemini');
                modified = true;
            }

            if (content.includes('Gemini')) {
                content = content.replace(/Gemini/g, 'Gemini');
                modified = true;
            }
            
            if (content.includes('gemini')) {
                content = content.replace(/gemini/g, 'gemini');
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated: ${fullPath}`);
            }
        }
    }
}

for (const dir of targetDirs) {
    processDir(dir);
}

// Update .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (!envContent.includes('GEMINI_API_KEY')) {
        envContent += '\nGEMINI_API_KEY=\n';
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log('Updated .env with GEMINI_API_KEY');
    }
}

console.log('Replacement complete.');
