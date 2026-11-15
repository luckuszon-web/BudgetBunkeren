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

    -- Faste poster
    insert into public.transactions (id, user_id, account_uid, booking_date, amount, currency, description, counterparty)
    select 'demo-' || md5(m::text || d.descr), uid, 'demo-konto', m + d.dag, d.belob, 'DKK', d.descr, d.modpart
    from (values
      (24,  28500.00, 'LØN Arbejdsgiver A/S',            'Arbejdsgiver A/S'),
      (0,   -8950.00, 'Husleje Boligforeningen',         'Boligforeningen'),
      (1,   -2000.00, 'Overført til Opsparingskonto',     null),
      (2,    -129.00, 'NETFLIX.COM',                     'Netflix'),
      (4,    -119.00, 'Spotify P2A3B4C5',                'Spotify'),
      (5,    -199.00, 'Telia Danmark abonnement',        'Telia'),
      (6,    -412.00, 'Tryg Forsikring A/S',             'Tryg'),
      (8,    -650.00, 'Norlys a/c el',                   'Norlys'),
      (9,    -299.00, 'Fitness World medlemskab',        'Fitness World')
    ) as d(dag, belob, descr, modpart)
    where m + d.dag <= current_date;

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
    for i in 1..9 loop
      insert into public.transactions (id, user_id, account_uid, booking_date, amount, currency, description, counterparty)
      select 'demo-' || md5(m::text || 'div' || i), uid, 'demo-konto', m + (i * 3.1)::int,
             -round((x.lo + random() * x.span)::numeric, 2), 'DKK', x.descr, null
      from (select * from (values
        (1, 'Wolt Copenhagen',              90, 220),
        (2, 'JOE & THE JUICE',              55,  60),
        (3, 'DSB Rejsekort',                24,  60),
        (4, 'Sunset Boulevard',             80,  70),
        (5, 'MobilePay Mads Jensen',       100, 300),
        (6, 'ZALANDO SE',                  250, 700),
        (7, 'SumUp *Café Paradis',          45,  80),
        (8, 'Circle K Roskildevej',        300, 250),
        (9, 'IKEA Gentofte',               150, 900)
      ) as v(nr, descr, lo, span) where v.nr = i) as x
      where m + (i * 3.1)::int <= current_date;
    end loop;
  end loop;

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

  -- Husleje, opsparing og MobilePay får lov at stå uden kategori, så du kan prøve at rette dem
  raise notice 'Demodata indsat: % posteringer', (select count(*) from public.transactions where account_uid = 'demo-konto');
end $$;
