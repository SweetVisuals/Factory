const { spawn, fork } = require('child_process');
const http = require('http');

console.log("[SYSTEM] Starting Scheduler Platform Services...");

const path = require('path');

const PORT = process.env.PORT || 3000;

console.log(`[SYSTEM] Starting Relay Express Server on port ${PORT}...`);
const expressServer = fork('index.mjs', [], { 
    cwd: path.join(__dirname, '../companies/Relay/server'),
    env: { ...process.env, PORT: PORT }
});
expressServer.on('close', (code) => {
    console.error(`[SYSTEM] Relay Express Server exited unexpectedly with code ${code}`);
});
// // Start the Sync Worker (Runs continuously inside its own loop)
// const syncWorker = spawn('node', ['postiz_sync_worker.js'], { stdio: 'inherit' });
// syncWorker.on('close', (code) => {
//     console.error(`[SYSTEM] postiz_sync_worker.js exited unexpectedly with code ${code}`);
// });

// Start the Relay Backend (Runs continuously)
const relayEngine = spawn('node', ['agent_engine.js'], { stdio: 'inherit' });
relayEngine.on('close', (code) => {
    console.error(`[SYSTEM] agent_engine.js exited unexpectedly with code ${code}`);
});

// Run the Scheduler Engine periodically (e.g. every hour)
const ENGINE_INTERVAL = 60 * 60 * 1000; // 1 hour

function runEngine() {
    console.log("[SYSTEM] Launching scheduler_engine.js loop");
    const engine = spawn('node', ['scheduler_engine.js'], { stdio: 'inherit' });
    
    engine.on('close', (code) => {
        console.log(`[SYSTEM] scheduler_engine.js cycle finished. Waiting ${ENGINE_INTERVAL / 1000 / 60} minutes for next run...`);
    });
}

// Initial engine run
// runEngine();
// Schedule recurring engine runs
// setInterval(runEngine, ENGINE_INTERVAL);
