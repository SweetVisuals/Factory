import express from 'express';
import cors from 'cors';
import {
  scrapeGoogleMaps,
  scrapeBingMaps,
  scrapeYell,
  scrapeIndeed,
  scrapeEmployerWebsites,
  scrapeCompaniesHouse
} from './scraper.mjs';
import { scrapeLeadsNoPuppeteer } from './scraper_http.mjs';

const app = express();
app.use(express.json());
app.use(cors());

// A simple health check for Render
app.get('/', (req, res) => res.send({ status: 'Worker is running', version: '1.0' }));

// The stateless scraping endpoint
app.post('/api/scrape-task', async (req, res) => {
  const { query, location, limit, platform, notesContext, deepResearch } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  const targetLimit = limit || 20;
  let leads = [];

  console.log(`[Worker] Received task: ${platform || 'general'} search for "${query}" in "${location}" (Limit: ${targetLimit})`);

  try {
    const fullQuery = location ? `${query} in ${location}` : query;

    // Route the task to the correct scraper based on the requested platform
    switch (platform) {
      case 'google':
        leads = await scrapeGoogleMaps(fullQuery, targetLimit, console.log, null, notesContext, deepResearch, null);
        break;
      case 'bing':
        leads = await scrapeBingMaps(fullQuery, targetLimit, console.log, null, null);
        break;
      case 'yell':
        leads = await scrapeYell(query, location || '', targetLimit, console.log, null, null);
        break;
      case 'indeed':
        leads = await scrapeIndeed(query, location || '', targetLimit, console.log, null, null);
        break;
      case 'employer_websites':
        leads = await scrapeEmployerWebsites(query, location || '', targetLimit, console.log, null, null);
        break;
      case 'companieshouse':
        leads = await scrapeCompaniesHouse(fullQuery, targetLimit, console.log, null, null);
        break;
      case 'general':
      default:
        leads = await scrapeLeadsNoPuppeteer(fullQuery, targetLimit, console.log, null);
        break;
    }

    console.log(`[Worker] Task finished successfully. Found ${leads.length} leads.`);
    res.json({ success: true, count: leads.length, leads });

  } catch (error) {
    console.error(`[Worker] Task failed: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Worker] Scraper API listening on port ${PORT}`);
  console.log(`[Worker] Proxy configuration: ${process.env.HTTP_PROXY ? 'ENABLED' : 'DISABLED'}`);
});
