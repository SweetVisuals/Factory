import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend directory before importing the processor
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Force the campaign runner to bypass interval throttle limits
process.env.FORCE_RUN = "true";

console.log("Starting campaign processor runner...");

// Dynamically import after env vars are loaded
const { runProcessCampaign } = await import('../../companies/Relay/server/process_campaign_node.mjs');

runProcessCampaign()
  .then(res => {
    console.log("Campaign process execution successful.");
    console.log("Result:", res);
    process.exit(0);
  })
  .catch(err => {
    console.error("Campaign process execution failed:", err);
    process.exit(1);
  });
