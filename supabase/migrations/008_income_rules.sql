-- Flere regler for indtægter (løn, dagpenge, SU, pension, skat tilbage …).
-- Kør i Supabase → SQL Editor. Kan køres flere gange (tilføjer kun regler, der mangler).
-- Reglerne bruges kun på indbetalinger – en udbetaling med samme tekst får dem ikke.
insert into public.rules (user_id, pattern, category_id, priority)
select c.user_id, r.pattern, c.id, 100
from (values
  ('lønudbetaling', 'Løn'), ('løn fra', 'Løn'), ('lønoverførsel', 'Løn'), ('løn ', 'Løn'), (' løn', 'Løn'),
  ('salary', 'Løn'), ('payroll', 'Løn'), ('provision', 'Løn'), ('bonus', 'Løn'), ('feriepenge', 'Løn'), ('feriekonto', 'Løn'),
  ('dagpenge', 'Anden indkomst'), ('sygedagpenge', 'Anden indkomst'), ('a-kasse udbetaling', 'Anden indkomst'),
  ('su ', 'Anden indkomst'), ('uddannelsesstøtte', 'Anden indkomst'), ('kontanthjælp', 'Anden indkomst'),
  ('folkepension', 'Anden indkomst'), ('pensionsudbetaling', 'Anden indkomst'), ('udbetaling danmark', 'Anden indkomst'),
  ('overskydende skat', 'Anden indkomst'), ('skattestyrelsen', 'Anden indkomst'), ('restskat', 'Anden indkomst'),
  ('børne- og ungeydelse', 'Anden indkomst'), ('boligstøtte', 'Anden indkomst'), ('renteindtægt', 'Anden indkomst'),
  ('udbytte', 'Anden indkomst'), ('refusion', 'Anden indkomst'), ('tilbagebetaling', 'Anden indkomst')
) as r(pattern, cat)
join public.categories c on c.name = r.cat
where not exists (select 1 from public.rules x where x.user_id = c.user_id and lower(x.pattern) = lower(r.pattern));
