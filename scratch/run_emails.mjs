import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/Shadow/Desktop/Factory/backend/.env' });

async function run() {
  console.log("Starting email engine...");
  try {
    const { runProcessCampaign } = await import('../companies/Relay/server/process_campaign_node.mjs');
    const res = await runProcessCampaign();
    console.log("Result:", res);
  } catch(e) {
    console.error("Error:", e);
  }
}
run();
