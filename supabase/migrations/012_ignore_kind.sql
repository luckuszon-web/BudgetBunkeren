-- Kategoritype "ignore": posteringen vises i listen, men er helt ude af tal, grafer, prognoser og rådgiver.
-- Fx en refusion, der går lige op, eller en postering, der ikke vedrører din økonomi. Kan køres flere gange.
alter table public.categories drop constraint if exists categories_kind_check;
alter table public.categories add constraint categories_kind_check
  check (kind in ('expense', 'income', 'transfer', 'oneoff', 'ignore'));

insert into public.categories (user_id, name, kind, icon)
select u.user_id, 'Ignoreret', 'ignore', '🚫'
from (select distinct user_id from public.categories) u
where not exists (select 1 from public.categories c where c.user_id = u.user_id and c.kind = 'ignore');
