-- Indtægter, du selv indtaster (fx løn, der ikke kommer ind på en forbundet konto).
-- Tæller med som almindelige indtægter i overblik, prognose og rådgiver. Kan køres flere gange.
create table if not exists public.manual_income (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pay_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  category_id bigint references public.categories on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists manual_income_user_date on public.manual_income (user_id, pay_date);
alter table public.manual_income enable row level security;
do $$ begin
  create policy own_manual_income on public.manual_income for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
