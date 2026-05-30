import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.join(__dirname, 'sparticuz-install.log');

const log = (msg) => {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logPath, entry);
    console.log(msg);
};

// Clear old log
fs.writeFileSync(logPath, `[${new Date().toISOString()}] Starting New Install Attempt...\n`);

log('Checking for npm...');
const npmCheck = spawn('npm', ['-v']);
npmCheck.on('error', (err) => log('CRITICAL ERROR: npm not found in this environment: ' + err.message));
npmCheck.stdout.on('data', (data) => log('npm version found: ' + data));

log('Running: npm install @sparticuz/chromium --save --no-audit');

const npm = spawn('npm', ['install', '@sparticuz/chromium', '--save', '--no-audit']);

npm.stdout.on('data', (data) => {
    log(`[NPM OUT]: ${data}`);
});

npm.stderr.on('data', (data) => {
    log(`[NPM ERR]: ${data}`);
});

npm.on('close', (code) => {
    if (code === 0) {
        log('✅ INSTALL SUCCESS!');
    } else {
        log(`❌ INSTALL FAILED with code ${code}`);
    }
});

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Check sparticuz-install.log for real-time progress.');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    log('Installer listening... keep this running until DONE.');
});
