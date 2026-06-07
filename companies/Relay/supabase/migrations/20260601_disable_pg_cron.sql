-- Migration: Disable the pg_cron that fires the edge function every 5 minutes.
-- The Node.js emailer_cron.mjs handles campaign processing now.
-- Running both causes race conditions and potential double-sends.

SELECT cron.unschedule('process-campaign-every-minute');
