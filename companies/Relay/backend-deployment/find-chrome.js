const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const http = require('http');

const logPath = path.join(process.cwd(), 'chrome-path.log');

function log(msg) {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logPath, entry);
    console.log(msg);
}

log("=== SEARCHING FOR CHROME BINARY ===");
log(`Current Directory: ${process.cwd()}`);
log(`Home Directory: ${os.homedir()}`);

const potentialPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/brave-browser',
    path.join(os.homedir(), '.cache/puppeteer'),
    path.join(os.homedir(), '.local/puppeteer'),
    path.join(process.cwd(), 'node_modules/puppeteer/.local-chromium')
];

let foundExecutables = [];

potentialPaths.forEach(p => {
    if (fs.existsSync(p)) {
        if (fs.lstatSync(p).isDirectory()) {
            log(`Scanning directory: ${p}`);
            try {
                // Find 'chrome' file in subdirectories
                const out = execSync(`find "${p}" -name chrome -type f -executable 2>/dev/null`, { timeout: 5000 });
                const files = out.toString().trim().split('\n').filter(Boolean);
                if (files.length > 0) {
                    log(`FOUND BINARIES:\n${files.join('\n')}`);
                    foundExecutables.push(...files);
                } else {
                    log('No executables found directly (via find).');
                }
            } catch (e) {
                log(`Error scanning ${p}: ${e.message}`);
            }
        } else {
            // It's a file
            log(`FOUND FILE: ${p}`);
            foundExecutables.push(p);
        }
    } else {
        log(`MISSING: ${p}`);
    }
});

log("=== SUMMARY ===");
if (foundExecutables.length > 0) {
    log(`USABLE PATHS:\n${foundExecutables.join('\n')}`);
} else {
    log("NO USABLE CHROME FOUND. You might need to install 'chromium' via SSH or rely on remote browser.");
}

// Keep server alive to view logs
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Search Complete. Check chrome-path.log\n');
});
server.listen(process.env.PORT || 3001, () => {
    log(`Listening on port ${process.env.PORT || 3001}`);
});
