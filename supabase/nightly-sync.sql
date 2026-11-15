-- Kør denne i Supabase → SQL Editor EFTER du har lagt funktionerne op.
-- Erstat de to værdier i <...>. Kører kl. 04:00 dansk vintertid (03:00 UTC) hver nat.
select cron.schedule(
  'nightly-bank-sync',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://<DIT-PROJEKT-REF>.supabase.co/functions/v1/sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', '<DIN-SYNC-SECRET>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Fortryd igen:  select cron.unschedule('nightly-bank-sync');
