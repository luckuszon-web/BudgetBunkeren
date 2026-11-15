-- Eget ikon (emoji) pr. kategori. Kør i Supabase → SQL Editor. Kan køres flere gange.
-- Uden denne vælger siden selv et ikon ud fra kategoriens navn.
alter table public.categories add column if not exists icon text;
