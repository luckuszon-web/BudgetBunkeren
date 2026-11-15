-- Budget pr. kategori (kr. pr. måned). Kør i Supabase → SQL Editor.
-- Kan køres flere gange uden problemer.
alter table public.categories add column if not exists monthly_budget numeric(12, 2);
