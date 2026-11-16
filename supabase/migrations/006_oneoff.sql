-- Engangskøb: en ny kategoritype ("oneoff"), der holdes uden for gennemsnit, prognoser, disponibelt beløb og score.
-- Fx bilkøb, større investeringer, depositum. Kør i Supabase → SQL Editor. Kan køres flere gange.
alter table public.categories drop constraint if exists categories_kind_check;
alter table public.categories add constraint categories_kind_check
  check (kind in ('expense', 'income', 'transfer', 'oneoff'));

-- En færdig kategori til formålet (oprettes kun, hvis den mangler)
insert into public.categories (user_id, name, kind, icon)
select u.user_id, 'Store køb & investeringer', 'oneoff', '💎'
from (select distinct user_id from public.categories) u
where not exists (select 1 from public.categories c where c.user_id = u.user_id and c.name = 'Store køb & investeringer');
