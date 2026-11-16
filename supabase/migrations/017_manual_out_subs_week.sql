-- Manuelle udgifter (fx kontantkøb), markering af abonnementer og ugebudgetter. Kan køres flere gange.

-- Indtastede beløb kan nu også være udgifter
alter table public.manual_income add column if not exists direction text not null default 'in';
do $$ begin
  alter table public.manual_income add constraint manual_income_direction_check check (direction in ('in', 'out'));
exception when duplicate_object then null; end $$;

-- Abonnementer: markér et abonnement som "skal opsiges" (eller "behold") – nøglen er modtagerens navn
create table if not exists public.subscription_marks (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  status text not null check (status in ('cancel', 'keep')),
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.subscription_marks enable row level security;
do $$ begin
  create policy own_subscription_marks on public.subscription_marks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Ugebudget: budgettet på kategorien gælder pr. uge (nulstilles mandag) i stedet for pr. måned
alter table public.categories add column if not exists budget_week boolean not null default false;
