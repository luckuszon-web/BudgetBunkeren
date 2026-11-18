// Røgtest af appen (docs/ny – bygget fra app/): åbner alle sider og tjekker overskrift, konsolfejl og at intet er bredere end skærmen.
//   node smoke.js            fuld: 3 skærmstørrelser × mørkt/lyst tema + forsiden/bank-login  (kører også på GitHub ved hver push)
//   node smoke.js --hurtig   hurtig: kun iPhone SE (den smalleste) i mørkt tema – til små ændringer, under et minut
// Kør:  cd tests && npm install && node smoke.js   (byg først appen: sh scripts/build-ny.sh)
const h = require('./harness');

const QUICK = process.argv.includes('--hurtig');
const SIZES = QUICK ? [['iPhone SE', 320, 568, true]] : [['iPhone 16 Plus', 430, 932, true], ['iPhone SE', 320, 568, true], ['computer', 1280, 900, false]];
const THEMES = QUICK ? ['dark'] : ['dark', 'light'];
const ROUTES = [['', 'Overblik'], ['budget', 'Budget'], ['posteringer', 'Posteringer'], ['vaerktoejer', 'Værktøjer'], ['planlaeg', 'Planlæg'],
  ['faelles', 'Fælles post'], ['mere', 'Mere'], ['raadgiver', 'Rådgiver'], ['indstillinger', 'Indstillinger'], ['indstillinger/bank', 'Bank og konti'],
  ['indstillinger/sortering', 'Hurtig sortering'], ['indstillinger/kategorier', 'Kategorier'], ['indstillinger/regler', 'Regler'],
  ['indstillinger/indtastet', 'Indtastede beløb'], ['indstillinger/sikkerhed', 'Login og sikkerhed'], ['indstillinger/data', 'Data'], ['indstillinger/tjek', 'Sundhedstjek']];

let failures = 0;
const fail = (msg) => { failures++; console.log('  FEJL: ' + msg); };

(async () => {
  for (const [name, w, hh, mob] of SIZES) for (const theme of THEMES) {
    console.log(`${name} · ${theme === 'dark' ? 'mørkt' : 'lyst'} tema`);
    const { browser, page, errors, log } = await h.open({ mobile: mob, dpr: 1, url: h.SITE + 'ny/' });
    await page.setViewportSize({ width: w, height: hh });
    await page.evaluate((t) => localStorage.setItem('bb-theme', t), theme);
    await page.reload(); await page.waitForTimeout(800);
    if ((await page.evaluate(() => document.documentElement.classList.contains('dark'))) !== (theme === 'dark')) fail(`temaet ${theme} blev ikke sat`);
    for (const [route, title] of ROUTES) {
      await page.goto(h.SITE + 'ny/#/' + route); await page.waitForTimeout(QUICK ? 400 : 700);
      // Mål mod skærmens bredde – bliver siden for bred, zoomer mobilbrowseren ud, og så vokser innerWidth med
      const r = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent, over: document.documentElement.scrollWidth - Math.min(innerWidth, screen.width) }));
      if (r.h1 !== title) fail(`/${route}: forventede overskriften "${title}", fik "${r.h1}"`);
      if (r.over > 0) fail(`/${route}: ${r.over}px for bred på ${name}`);
    }
    if (!QUICK && name === 'computer' && theme === 'dark') {
      // Forsiden sender videre til appen og tager ?… med (bank-login, invitation)
      await page.goto(h.SITE + '?code=abc&state=11111111-2222-4333-8444-555555555555'); await page.waitForTimeout(1500);
      if (!/\/ny\/$|\/ny\/#\/?$/.test(page.url())) fail(`forsiden sendte ikke videre korrekt: ${page.url()}`);
      if (!(await page.getByText('Forbundet: 2 konti.').count())) fail('bank-login blev ikke afsluttet');
      if (!log.some((l) => l === 'FINISH abc')) fail('finish blev ikke kaldt');
    }
    for (const e of errors) fail(`konsolfejl: ${e}`);
    await browser.close();
  }
  console.log(failures ? `\n${failures} fejl` : '\nAlt OK');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
