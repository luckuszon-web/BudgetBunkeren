-- Notifikationer på telefonen (Web Push) og kvitteringer på posteringer. Kan køres flere gange.

-- Én række pr. enhed, der har slået notifikationer til
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 10 and 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
do $$ begin
  create policy own_push_subscriptions on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Valg (hvilke beskeder) og hvad der allerede er sendt
create table if not exists public.push_state (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  prefs jsonb not null default '{"salary": true, "budget": true, "unknown": true}',
  last_run timestamptz,
  budget_sent jsonb not null default '{}'
);
alter table public.push_state enable row level security;
do $$ begin
  create policy own_push_state on public.push_state for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Kvitteringer: privat lager, mappe pr. bruger (<bruger-id>/<postering>/<fil>.jpg), højst 5 MB pr. billede
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
do $$ begin
  create policy receipts_select on storage.objects for select using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy receipts_insert on storage.objects for insert with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy receipts_delete on storage.objects for delete using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
