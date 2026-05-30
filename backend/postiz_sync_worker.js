const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const POSTIZ_API_URL = process.env.POSTIZ_API_URL || 'https://api.postiz.com';
const POSTIZ_API_KEY = process.env.POSTIZ_API_KEY;

// 6 minutes = 360,000 ms -> Rate limit is 30 requests/hr. We need 3 requests per post, so 10 posts/hr maximum.
const SYNC_INTERVAL_MS = 6 * 60 * 1000; 

async function syncNextPostToPostiz() {
    console.log(`[SYNC WORKER] Checking for queued posts in scheduler_calendar...`);

    try {
        // Find the oldest queued post
        const { data: calendarEntries, error: fetchError } = await supabase
            .from('scheduler_calendar')
            .select('*')
            .eq('status', 'queued_locally')
            .order('scheduled_time', { ascending: true })
            .limit(1);

        if (fetchError) {
            console.error(`[SYNC WORKER] Error fetching from Supabase:`, fetchError.message);
            return;
        }

        if (!calendarEntries || calendarEntries.length === 0) {
            console.log(`[SYNC WORKER] No posts currently queued. Waiting for next interval.`);
            return;
        }

        const entry = calendarEntries[0];
        console.log(`[SYNC WORKER] Found post ${entry.id} scheduled for ${entry.scheduled_time}. Sending to Postiz...`);

        // Example Postiz payload structure based on typical API (Adjust based on actual Postiz API)
        const payload = {
            content: entry.caption || "Mani Rae Promotion",
            media_urls: entry.media_urls || [],
            scheduled_at: entry.scheduled_time,
            platforms: ["tiktok"],
            profile_ids: [entry.tiktok_account_id]
        };

        // Call Postiz API
        const response = await axios.post(`${POSTIZ_API_URL}/posts/schedule`, payload, {
            headers: {
                'Authorization': `Bearer ${POSTIZ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200 || response.status === 201) {
            console.log(`[SYNC WORKER] Successfully queued post to Postiz API. Updating local status...`);
            
            // Mark as synced locally
            await supabase
                .from('scheduler_calendar')
                .update({ 
                    status: 'synced_to_postiz', 
                    postiz_id: response.data.id || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', entry.id);
        } else {
            console.error(`[SYNC WORKER] Postiz API responded with unexpected status:`, response.status);
        }

    } catch (err) {
        console.error(`[SYNC WORKER] Exception during sync:`, err.message);
        if (err.response) {
            console.error(`[SYNC WORKER] Postiz Error Details:`, err.response.data);
        }
    }
}

async function startWorker() {
    console.log(`[SYNC WORKER] Starting Background Postiz Sync Worker.`);
    console.log(`[SYNC WORKER] Interval set to ${SYNC_INTERVAL_MS / 1000 / 60} minutes to bypass rate limits (10 posts/hour max).`);
    
    // Run immediately on startup
    await syncNextPostToPostiz();

    // Loop continuously
    setInterval(async () => {
        await syncNextPostToPostiz();
    }, SYNC_INTERVAL_MS);
}

startWorker();
