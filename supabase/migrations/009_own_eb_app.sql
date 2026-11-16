-- Hver bruger kan bruge sin EGEN Enable Banking-app (fx en partner med egne konti – krævet af Enable Bankings gratis vilkår).
-- Nøglen gemmes her og kan KUN læses af serverfunktionerne: ingen sikkerhedsregler (policies) = ingen adgang fra browseren.
-- Kør i Supabase → SQL Editor. Kan køres flere gange.
create table if not exists public.eb_credentials (
  user_id uuid primary key references auth.users on delete cascade,
  app_id text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);
alter table public.eb_credentials enable row level security;
revoke all on public.eb_credentials from anon, authenticated;
