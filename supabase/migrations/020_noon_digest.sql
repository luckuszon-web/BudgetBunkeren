-- Forbrugsoversigt som notifikation kl. 12 dansk tid. Kan køres flere gange.
-- Genbruger den natlige hentnings opsætning (adresse og hemmelig nøgle) – du skal ikke indsætte noget selv.
-- pg_cron kører i UTC: jobbet starter kl. 10 og 11 UTC, og serveren sender kun den gang, klokken er 12 i Danmark.
do $$
declare cmd text;
begin
  if exists (select 1 from cron.job where jobname = 'noon-digest') then perform cron.unschedule('noon-digest'); end if;
  select command into cmd from cron.job where jobname = 'nightly-bank-sync';
  if cmd is null or position('''{}''::jsonb' in cmd) = 0 then
    raise notice 'Den natlige hentning (nightly-bank-sync) blev ikke fundet – forbrugsoversigten kl. 12 er ikke sat op.';
  else
    perform cron.schedule('noon-digest', '0 10,11 * * *', replace(cmd, '''{}''::jsonb', '''{"action":"digest"}''::jsonb'));
  end if;
exception when undefined_table or invalid_schema_name then
  raise notice 'pg_cron findes ikke – forbrugsoversigten kl. 12 er ikke sat op.';
end $$;
