-- Konti kan omdøbes og skjules fra overblikket (skjulte konti hentes heller ikke længere).
-- Kør i Supabase → SQL Editor. Kan køres flere gange.
alter table public.accounts add column if not exists display_name text;
alter table public.accounts add column if not exists hidden boolean not null default false;

-- Browseren må kun ændre navn og synlighed på egne konti – intet andet.
do $$ begin
  create policy update_own_accounts on public.accounts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
revoke update on public.accounts from anon, authenticated;
grant update (display_name, hidden) on public.accounts to authenticated;
