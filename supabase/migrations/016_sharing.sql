-- Fællesøkonomi: del udvalgte konti med en anden bruger (fx din partner). Den anden kan kun SE kontoen,
-- dens posteringer og dine kategorinavne – aldrig ændre noget. Delinger oprettes af serveren (bank-connect),
-- fordi den skal finde partnerens bruger ud fra e-mail. Kan køres flere gange.
create table if not exists public.account_shares (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  account_key text not null,
  shared_with uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, account_key, shared_with)
);
alter table public.account_shares enable row level security;
do $$ begin
  create policy read_shares on public.account_shares for select using (owner_id = auth.uid() or shared_with = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy delete_own_shares on public.account_shares for delete using (owner_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Læseadgang for den, der har fået delt
do $$ begin
  create policy shared_accounts_read on public.accounts for select using (exists (
    select 1 from public.account_shares s where s.owner_id = accounts.user_id and s.account_key = accounts.account_key and s.shared_with = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy shared_transactions_read on public.transactions for select using (exists (
    select 1 from public.accounts a join public.account_shares s on s.owner_id = a.user_id and s.account_key = a.account_key
    where a.uid = transactions.account_uid and s.shared_with = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy shared_categories_read on public.categories for select using (exists (
    select 1 from public.account_shares s where s.owner_id = categories.user_id and s.shared_with = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy shared_splits_read on public.tx_splits for select using (exists (
    select 1 from public.transactions t where t.id = tx_splits.tx_id));
exception when duplicate_object then null; end $$;
