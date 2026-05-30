import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_OPENCLAW_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_OPENCLAW_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function trigger() {
    console.log("Triggering process-campaign edge function...");
    const { data: triggerData, error: triggerErr } = await supabase.functions.invoke('process-campaign');
    
    if (triggerErr) {
        console.error("Edge function failed:", triggerErr);
    } else {
        console.log("Edge function finished successfully. Output:");
        console.log(triggerData);
    }
}
trigger();
