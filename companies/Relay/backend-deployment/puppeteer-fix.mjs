import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.join(__dirname, 'puppeteer-fix.log');

function log(msg) {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logPath, entry);
    console.log(msg);
}

log("=== STARTING PUPPETEER FIX (Explicit Install) ===");

// Check if puppeteer folder exists
const pPath = path.join(__dirname, 'node_modules', 'puppeteer');

if (fs.existsSync(pPath)) {
    log(`Puppeteer folder exists at ${pPath}, listing files:`);
    try {
        const files = fs.readdirSync(pPath);
        log(`Files: ${files.slice(0, 10).join(', ')}...`);
    } catch (e) {
        log(`Error reading directory: ${e.message}`);
    }
} else {
    log("Puppeteer does NOT exist in node_modules currently.");
}

// Force install just puppeteer
// We ignore scripts first to ensure package installs, THEN we try postinstall
// Or just try full install. Puppeteer postinstall is critical for binary.
// But if binary fails, the JS package should still be importable? No, postinstall failure aborts.
// Strategy: Try --ignore-scripts to get JS working, then handle binary later.
// BUT scraper needs binary.
// Let's try standard install first.

const command = 'npm install puppeteer --save --no-audit --verbose';
log(`Executing: ${command}`);

exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
        log(`INSTALLATION FAILED: ${error.message}`);
    } else {
        log('INSTALLATION SUCCESS!');
    }

    if (stdout) log(`STDOUT:\n${stdout}`);
    if (stderr) log(`STDERR:\n${stderr}`);

    log("=== FIX FINISHED ===");
});

// Listener
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Puppeteer Fix Running... Check puppeteer-fix.log\n');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    log(`Fixer listening on port ${PORT}`);
});
