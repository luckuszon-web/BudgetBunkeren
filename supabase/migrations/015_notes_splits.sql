-- Noter på posteringer og opdeling af én postering i flere kategorier. Kan køres flere gange.
alter table public.transactions add column if not exists note text;
-- Browseren må kun ændre kategori, engangskøb og note – ikke beløb, dato osv.
alter table public.transactions add column if not exists one_off boolean not null default false;
grant update (category_id, category_source, one_off, note) on public.transactions to authenticated;

-- Dele af en postering: hver del har sin kategori og sit beløb (samme fortegn som posteringen).
-- Det, der ikke er fordelt, bliver på posteringens egen kategori.
create table if not exists public.tx_splits (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tx_id text not null references public.transactions on delete cascade,
  category_id bigint references public.categories on delete set null,
  amount numeric(14, 2) not null,
  created_at timestamptz not null default now()
);
create index if not exists tx_splits_tx on public.tx_splits (tx_id);
alter table public.tx_splits enable row level security;
do $$ begin
  create policy own_tx_splits on public.tx_splits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
