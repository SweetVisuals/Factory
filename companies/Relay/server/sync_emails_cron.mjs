export let isSyncRunning = false;

export function startSyncEmailsCron() {
    console.log('[SYSTEM] Starting Async Email Sync Cron (runs every 5 minutes)');
    setInterval(async () => {
        if (isSyncRunning) return;
        isSyncRunning = true;
        try {
            const port = process.env.PORT || 3000;
            const token = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
            console.log(`[Email Sync] Triggering background sync via /api/emails...`);
            const res = await fetch(`http://localhost:${port}/api/emails?syncNew=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                console.error(`[Email Sync] API returned ${res.status}`);
            } else {
                console.log(`[Email Sync] Sync completed successfully.`);
            }
        } catch (e) {
            console.error('[Email Sync] Error:', e.message);
        } finally {
            isSyncRunning = false;
        }
    }, 5 * 60 * 1000); // 5 mins
    
    // Initial run
    setTimeout(() => {
        if (!isSyncRunning) {
            isSyncRunning = true;
            const port = process.env.PORT || 3000;
            const token = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
            console.log(`[Email Sync] Triggering initial startup background sync...`);
            fetch(`http://localhost:${port}/api/emails?syncNew=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
              .then(res => console.log(`[Email Sync] Initial sync status: ${res.status}`))
              .catch(e => console.error('[Email Sync] Startup sync error:', e.message))
              .finally(() => { isSyncRunning = false; });
        }
    }, 10000);
}
