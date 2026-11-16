-- Engangskøb på den enkelte postering (fx et stort IKEA-køb, der beholder kategorien Shopping,
-- men holdes uden for snit, prognoser og score). Kan køres flere gange.
alter table public.transactions add column if not exists one_off boolean not null default false;
grant update (category_id, category_source, one_off) on public.transactions to authenticated;
