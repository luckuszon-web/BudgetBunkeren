-- Invitationskoder: nye brugere kan oprette sig selv fra login-siden med en kode fra ejeren.
-- Kun serveren kan læse/skrive tabellen (ingen policies). Kør i Supabase → SQL Editor. Kan køres flere gange.
create table if not exists public.signup_codes (
  code text primary key,
  created_by uuid references auth.users on delete cascade,
  used_by_email text,
  used_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
alter table public.signup_codes enable row level security;
revoke all on public.signup_codes from anon, authenticated;
