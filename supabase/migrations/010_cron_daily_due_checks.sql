-- Täglicher Cron für Impf- und Hufschmied-Fälligkeits-Mails
-- Voraussetzung: pg_cron und pg_net aktiviert (Supabase Pro/Team) oder externer Cron

-- Option A: pg_cron (Supabase Dashboard → Database → Extensions → pg_cron, pg_net)
-- Nach dem Ersten Deployment: Projekt-URL und CRON_SECRET eintragen.
-- Die URL findest du in Supabase Dashboard → Settings → API → Project URL.
-- CRON_SECRET muss mit supabase secrets set CRON_SECRET=... übereinstimmen.

/*
-- Beispiel (ersetze PROJECT_REF und DEIN_CRON_SECRET):
SELECT cron.schedule(
  'daily-due-checks',
  '0 8 * * *',  -- täglich 8:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/run-daily-due-checks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'DEIN_CRON_SECRET'
    ),
    body := '{}',
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);
*/

-- Option B: Externer Cron (z.B. cron-job.org, GitHub Actions)
-- POST https://PROJECT_REF.supabase.co/functions/v1/run-daily-due-checks
-- Header: x-cron-secret: DEIN_CRON_SECRET
-- Body: {}
