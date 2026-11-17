-- Regninger, der betales kvartalsvis, halvårligt eller årligt: markeres på en postering og fordeles
-- så over månederne i budgettet. Nøglen er modtagerens navn (samme som faste udgifter). Kan køres flere gange.
create table if not exists public.bill_cadence (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null check (char_length(key) between 1 and 200),
  cadence text not null check (cadence in ('quarterly', 'halfyear', 'annual')),
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.bill_cadence enable row level security;
do $$ begin
  create policy own_bill_cadence on public.bill_cadence for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
