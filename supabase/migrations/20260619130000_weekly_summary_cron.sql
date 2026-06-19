-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the weekly summary email every Sunday at 8:00 AM EST (1:00 PM UTC)
-- IMPORTANT: Before applying this migration you must run the following two commands:
--
--   1. Set the secret in Supabase Edge Functions (terminal):
--      supabase secrets set CRON_SECRET=<your-random-secret>
--
--   2. Store the same value as a database setting (Supabase SQL editor):
--      ALTER DATABASE postgres SET app.settings.cron_secret = '<your-random-secret>';
--
--   Generate a secret with: openssl rand -hex 32
--
-- Adjust the cron expression for your preferred timezone:
--   '0 13 * * 0'  = Sunday 1:00 PM UTC  = 8:00 AM EST / 9:00 AM EDT
--   '0 12 * * 0'  = Sunday 12:00 PM UTC = 7:00 AM EST / 8:00 AM EDT

SELECT cron.schedule(
  'send-weekly-summary',
  '0 13 * * 0',
  $$
  SELECT net.http_post(
    url    := 'https://apbjgnfkygosgyngxewi.supabase.co/functions/v1/send-weekly-summary',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
    ),
    body   := '{}'::jsonb
  ) AS request_id;
  $$
);
