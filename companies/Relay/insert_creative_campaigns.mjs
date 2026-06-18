import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const creativeCampaigns = [
        // Healthcare & Wellness
        { niche: "Dental clinics using manual spreadsheets for patient recall and follow-ups", location: "USA" },
        { niche: "Independent pharmacies manually tracking expiring stock and compounding inventory", location: "USA" },
        { niche: "Medspa clinics manually texting appointment reminders and chasing no-shows", location: "USA" },
        
        // Trades & Field Services
        { niche: "HVAC contractors manually dispatching drivers via whiteboards and group texts", location: "USA" },
        { niche: "Commercial landscaping companies doing manual route optimization and invoicing", location: "USA" },
        { niche: "Custom home builders tracking subcontractor lien waivers and payments in Excel", location: "USA" },
        
        // Professional Services
        { niche: "Boutique law firms spending hours doing manual billable hours tracking and data entry", location: "USA" },
        { niche: "Accounting firms manually extracting data from client receipts and bank statements", location: "USA" },
        { niche: "Property management companies manually cross-referencing tenant maintenance requests with vendor schedules", location: "USA" },
        
        // Food & Hospitality
        { niche: "Food truck franchises lacking automated stock sync across multiple mobile locations", location: "USA" },
        { niche: "Catering companies manually calculating ingredient yields based on fluctuating guest counts", location: "USA" },
        
        // Logistics & Retail
        { niche: "E-commerce brands processing returns and RMAs entirely by hand via email threads", location: "USA" },
        { niche: "Last-mile delivery couriers manually sorting dispatch routes on Google Maps", location: "USA" },
        { niche: "Auto repair shops manually quoting parts by calling 5 different local suppliers", location: "USA" }
    ];

    console.log("Injecting creative pain-point campaigns into the database...");

    for (const c of creativeCampaigns) {
        const payload = {
            name: c.niche + " - USA",
            status: 'in_progress' // Active so Hermès picks it up
        };
        
        const { error } = await supabase.from('campaigns').insert(payload);
        if (error) {
            console.error(`❌ Error inserting "${c.niche}":`, error.message);
        } else {
            console.log(`✅ Inserted: ${c.niche}`);
        }
    }
    
    console.log("Done seeding market-researched campaigns!");
}

main().catch(console.error);
