-- DEMODATA: opdigtede posteringer, så du kan prøve siden, før banken er forbundet.
-- Kør hele filen i Supabase → SQL Editor. Kræver, at du har oprettet din bruger (README trin 1.4).
-- Kan køres igen: gamle demodata slettes først.
--
-- FJERN DEMODATA IGEN (kør kun denne linje):
--   delete from public.accounts where uid = 'demo-konto';

do $$
declare
  uid uuid := (select id from auth.users order by created_at limit 1);
  m date;
  i int;
begin
  if uid is null then
    raise exception 'Ingen bruger fundet – opret din bruger først (README trin 1.4).';
  end if;

  -- Standardkategorier og -regler (samme som når du logger ind første gang)
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform public.ensure_defaults();

  -- Fjern tidligere demodata (posteringerne slettes med kontoen)
  delete from public.accounts where accounts.uid = 'demo-konto';

  -- En demokonto UDEN bankforbindelse, så den natlige hentning ignorerer den
  insert into public.accounts (uid, user_id, account_key, session_id, name, iban_last4, currency)
  values ('demo-konto', uid, 'demo', null, 'Demokonto', '0000', 'DKK');

  perform setseed(0.42);

  -- De seneste 6 måneder
  for k in 0..5 loop
    m := (date_trunc('month', current_date) - make_interval(months => k))::date;

    -- INDTÆGTER
    -- Løn: udbetales sidste dag i måneden og svinger mellem 30.000 og 50.000 kr. (overtid, tillæg, bonus)
    insert into public.transactions (id, user_id, account_uid, booking_date, amount, currency, description, counterparty)
    select 'demo-' || md5(m::text || 'løn'), uid, 'demo-konto', (m + interval '1 month - 1 day')::date,
           round((30000 + random() * 20000)::numeric, 2), 'DKK', 'LØN Arbejdsgiver A/S', 'Arbejdsgiver A/S'
    where (m + interval '1 month - 1 day')::date <= current_date;

    -- Lejeindtægt: lejeren betaler 7.464 kr. den 1. i måneden
    insert into public.transactions (id, user_id, account_uid, booking_date, amount, currency, description, counterparty)
    select 'demo-' || md5(m::text || 'leje'), uid, 'demo-konto', m, 7464.00, 'DKK', 'Husleje fra lejer', 'Sofie Hansen'
    where m <= current_date;

    -- Små indbetalinger: venner betaler tilbage via MobilePay
    for i in 1..2 loop
      insert into public.transactions (id, user_id, account_uid, booking_date, amount, currency, description, counterparty)
      select 'demo-' || md5(m::text || 'mpind' || i), uid, 'demo-konto', m + (i * 11),
             round((75 + random() * 325)::numeric, 0), 'DKK',
             'MobilePay fra ' || (array['Anders Holm', 'Julie Madsen', 'Mikkel Berg'])[1 + floor(random() * 3)::int], null
      where m + (i * 11) <= current_date;
    end loop;

    -- FASTE UDGIFTER
    insert into public.transactions (id, user_id, account_uid, booking_date, amount, currency, description, counterparty)
    select 'demo-' || md5(m::text || d.descr), uid, 'demo-konto', m + d.dag, d.belob, 'DKK', d.descr, d.modpart
    from (values
      (0,  -11250.00, 'Husleje Boligforeningen',         'Boligforeningen'),
      (0,   -3000.00, 'Overført til Opsparingskonto',     null),
      (1,   -2350.00, 'Billån Santander Consumer',       'Santander'),
      (2,    -129.00, 'NETFLIX.COM',                     'Netflix'),
      (2,    -546.00, 'A-kasse kontingent',              'Akademikernes A-kasse'),
      (3,    -429.00, 'Fagforening kontingent',          'Djøf'),
      (4,    -119.00, 'Spotify P2A3B4C5',                'Spotify'),
      (5,    -249.00, 'Telia Danmark abonnement',        'Telia'),
      (6,    -712.00, 'Tryg Forsikring A/S',             'Tryg'),
      (7,    -299.00, 'Fitness World medlemskab',        'Fitness World'),
      (8,    -149.00, 'YouSee bredbånd',                 'YouSee'),
      (14,  -5000.00, 'Overført til Investeringskonto',   null)
    ) as d(dag, belob, descr, modpart)
    where m + d.dag <= current_date;

    -- El svinger med årstiden (mere om vinteren)
    insert into public.transactions (id, user_id, account_uid, booking_date, amount, currency, description, counterparty)
    select 'demo-' || md5(m::text || 'el'), uid, 'demo-konto', m + 9,
           -round((case when extract(month from m) between 5 and 8 then 450 else 750 end + random() * 250)::numeric, 2),
           'DKK', 'Norlys a/c el', 'Norlys'
    where m + 9 <= current_date;

    -- Dagligvarer (ca. 11 pr. måned)
    for i in 1..11 loop
      insert into public.transactions (id, user_id, account_uid, booking_date, amount, currency, description, counterparty)
      select 'demo-' || md5(m::text || 'dag' || i), uid, 'demo-konto', m + (i * 2.6)::int,
             -round((70 + random() * 520)::numeric, 2), 'DKK',
             (array['NETTO 1234 KBH', 'REMA 1000 VALBY', 'FØTEX FREDERIKSBERG', 'LIDL DANMARK', 'MENY ØSTERBRO', 'Coop 365discount'])[1 + floor(random() * 6)::int],
             null
      where m + (i * 2.6)::int <= current_date;
    end loop;

    -- Restaurant, transport, shopping, MobilePay og et par ukendte
    for i in 1..16 loop
      insert into public.transactions (id, user_id, account_uid, booking_date, amount, currency, description, counterparty)
      select 'demo-' || md5(m::text || 'div' || i), uid, 'demo-konto', m + (i * 1.8)::int,
             -round((x.lo + random() * x.span)::numeric, 2), 'DKK', x.descr, null
      from (select * from (values
        (1,  'Wolt Copenhagen',              90, 220),
        (2,  'JOE & THE JUICE',              55,  60),
        (3,  'DSB Rejsekort',                24,  60),
        (4,  'Sunset Boulevard',             80,  70),
        (5,  'MobilePay Mads Jensen',       100, 300),
        (6,  'ZALANDO SE',                  250, 700),
        (7,  'SumUp *Café Paradis',          45,  80),
        (8,  'Circle K Roskildevej',        350, 300),
        (9,  'Matas Frederiksberg',          80, 250),
        (10, 'Wolt Copenhagen',             110, 180),
        (11, 'Nordisk Film Biografer',      120, 140),
        (12, 'REMA 1000 VALBY',             150, 400),
        (13, 'Apotek Valby',                 60, 200),
        (14, 'Lagkagehuset',                 45,  90),
        (15, 'Q8 Service Køge',             300, 300),
        (16, 'Elgiganten',                   99, 600)
      ) as v(nr, descr, lo, span) where v.nr = i) as x
      where m + (i * 1.8)::int <= current_date
        and (i not in (6, 16) or random() < 0.5);   -- tøj og elektronik ikke hver måned
    end loop;
  end loop;

  -- Engangsposter: sommerferie i juli, tandlæge og en gave
  insert into public.transactions (id, user_id, account_uid, booking_date, amount, currency, description, counterparty)
  select 'demo-' || md5(d.dato::text || d.descr), uid, 'demo-konto', d.dato, d.belob, 'DKK', d.descr, d.modpart
  from (values
    (make_date(extract(year from current_date)::int, 6, 12), -3480.00, 'RYANAIR FR1234',            'Ryanair'),
    (make_date(extract(year from current_date)::int, 6, 20), -6250.00, 'AIRBNB * HMXY2K',           'Airbnb'),
    (make_date(extract(year from current_date)::int, 7, 8),  -1845.50, 'Restaurante Mar Azul',      null),
    (make_date(extract(year from current_date)::int, 7, 10),  -912.30, 'Supermercado Continente',   null),
    (make_date(extract(year from current_date)::int, 9, 3),  -1450.00, 'Tandlæge Valby Tandklinik', null),
    (make_date(extract(year from current_date)::int, 10, 18), -699.00, 'Bog & Ide Gavekort',        null)
  ) as d(dato, belob, descr, modpart)
  where d.dato <= current_date and d.dato >= (date_trunc('month', current_date) - interval '5 months')::date;

  -- Kategorisér med reglerne, præcis som serveren gør (dine regler vinder over standardreglerne)
  update public.transactions t
     set category_id = (
           select rr.category_id from public.rules rr
            where rr.user_id = t.user_id
              and lower(t.description || ' ' || coalesce(t.counterparty, '')) like '%' || lower(rr.pattern) || '%'
            order by rr.priority desc, length(rr.pattern) desc
            limit 1),
         category_source = 'rule'
   where t.account_uid = 'demo-konto';
  update public.transactions set category_source = null
   where account_uid = 'demo-konto' and category_id is null;

  -- Lad som om AI'en har gættet på et par stykker, så filteret "Sat af AI" kan prøves
  update public.transactions t
     set category_id = c.id, category_source = 'ai'
    from public.categories c
   where t.account_uid = 'demo-konto' and t.category_id is null and c.user_id = t.user_id
     and ((t.description like 'Fitness World%' and c.name = 'Fritid & oplevelser')
       or (t.description like 'SumUp%'         and c.name = 'Restaurant & takeaway'));

  -- Lad som om du allerede selv har rettet nogle (de står som "manual")
  update public.transactions t
     set category_id = c.id, category_source = 'manual'
    from public.categories c
   where t.account_uid = 'demo-konto' and t.category_id is null and c.user_id = t.user_id
     and ((t.description = 'Husleje fra lejer'                 and c.name = 'Anden indkomst')
       or (t.description like 'Billån%'                         and c.name = 'Bil & opladning')
       or (t.description = 'Overført til Investeringskonto'    and c.name = 'Opsparing & investering')
       or (t.description like 'Tandlæge%'                       and c.name = 'Personlig pleje & apotek')
       or (t.description in ('Restaurante Mar Azul', 'Supermercado Continente') and c.name = 'Rejser'));

  -- Husleje, opsparingskontoen, A-kasse, fagforening og MobilePay står uden kategori, så du kan prøve at rette dem
  raise notice 'Demodata indsat: % posteringer', (select count(*) from public.transactions where account_uid = 'demo-konto');
end $$;
