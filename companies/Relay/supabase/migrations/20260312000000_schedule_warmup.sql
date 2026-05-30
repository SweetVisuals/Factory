-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the warmup-scheduler edge function to run every 10 minutes
-- This spreads out the warmup emails throughout the day
SELECT cron.schedule(
  'warmup-task',
  '*/10 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://wmoyigdovtpuayjxezzc.supabase.co/functions/v1/warmup-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Note: Make sure to set the service_role_key in your database settings:
-- ALTER DATABASE postgres SET "app.settings.service_role_key" = 'your-service-role-key';
