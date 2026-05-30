-- Enable the pg_cron extension
create extension if not exists pg_cron with schema extensions;

-- Schedule the campaign processor to run every minute
select
  cron.schedule(
    'process-campaign-every-minute',
    '*/5 * * * *', -- Every 5 minutes
    $$
    select
      net.http_post(
          url:='https://fzcrjogrnujrfxafxbkh.supabase.co/functions/v1/process-campaign',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Y3Jqb2dybnVqcmZ4YWZ4YmtoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0NTg0OCwiZXhwIjoyMDk0MDIxODQ4fQ.s-ucJhIu80K2JPWBmWw7ZBkIS4P0rYd1I7KuhQXfm4U"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
  );

-- To unschedule:
-- select cron.unschedule('process-campaign-every-minute');
