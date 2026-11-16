// Røgtest: åbner alle faner og undersider på tre skærmstørrelser i både mørkt og lyst tema og tjekker,
// at der ikke kommer fejl i konsollen, og at intet stikker ud til siden. Afslutter med fejlkode, hvis noget fejler.
// Kør:  cd tests && npm install && npx playwright install chromium && node smoke.js
const h = require('./harness');

const SIZES = [['iPhone 16 Plus', 430, 932, true], ['iPhone SE', 320, 568, true], ['computer', 1280, 900, false]];
const VIEWS = [['app'], ['txs'], ['budget'], ['plan'], ['tools', 'cal'], ['tools', 'whatif'], ['tools', 'year'], ['tools', 'quarter'], ['tools', 'tax'], ['advisor'],
  ['settings', 'home'], ['settings', 'bank'], ['settings', 'quick'], ['settings', 'cats'], ['settings', 'income'], ['settings', 'rules'], ['settings', 'acct'], ['settings', 'data']];

let failures = 0;
const fail = (msg) => { failures++; console.log('  FEJL: ' + msg); };

async function checkPage(page, label) {
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    // Elementer i vandret scrollende bånd (fx filter-chips og brede tabeller) må gerne være bredere
    const inScroller = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
    const over = [...document.querySelectorAll('main *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > vw + 1 && e.offsetParent !== null && !inScroller(e); })
      .slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`);
    return { sw: document.documentElement.scrollWidth, vw, over };
  });
  if (r.sw > r.vw + 1 || r.over.length) fail(`${label}: for bred (${r.sw} > ${r.vw}) ${r.over.join(', ')}`);
}

async function functional(page, db) {
  const ev = (f, a) => page.evaluate(f, a);
  // Overblik viser det disponible beløb og fire nøgletal
  const hero = await ev(() => document.querySelector('#heroAmt')?.textContent ?? '');
  if (!/kr\./.test(hero)) fail('Overblik: intet disponibelt beløb');
  if (await ev(() => document.querySelectorAll('#kpis .kpi').length) !== 4) fail('Overblik: forventede 4 nøgletal');
  // Posteringer: filter "Ukategoriseret" viser kun posteringer uden kategori
  await ev(() => document.querySelector('#tabs button[data-tab="txs"]').click());
  await ev(() => document.querySelector('#txFilter button[data-f="none"]').click());
  const unset = await ev(() => [...document.querySelectorAll('#txList .tx select')].every((s) => s.value === ''));
  if (!unset) fail('Posteringer: filteret Ukategoriseret viser posteringer med kategori');
  await ev(() => document.querySelector('#txFilter button[data-f="all"]').click());
  // Budget-fanen viser kategorier
  await ev(() => document.querySelector('#tabs button[data-tab="budget"]').click());
  if (!(await ev(() => document.querySelectorAll('#budList .nob, #budList .bud-row').length))) fail('Budget: ingen kategorier');
  await ev(() => document.querySelector('#tabs button[data-tab="app"]').click());
}

(async () => {
  for (const theme of ['dark', 'light']) {
    for (const [name, w, hh, mob] of SIZES) {
      console.log(`${name} · ${theme === 'dark' ? 'mørkt' : 'lyst'} tema`);
      const { browser, page, errors, db } = await h.open({ mobile: mob, dpr: 1, onDialog: (d) => d.dismiss() });
      await page.setViewportSize({ width: w, height: hh });
      await page.evaluate((t) => localStorage.setItem('theme', t), theme);
      await page.reload(); await page.waitForTimeout(2500);
      for (const [tab, sub] of VIEWS) {
        await page.evaluate((t) => document.querySelector(`#tabs button[data-tab="${t}"]`).click(), tab); await page.waitForTimeout(250);
        if (tab === 'tools') { await page.evaluate((s) => document.querySelector(`#toolSel button[data-t="${s}"]`).click(), sub); await page.waitForTimeout(250); }
        if (tab === 'settings' && sub !== 'home') { await page.evaluate((s) => document.querySelector(`.set-row[data-page="${s}"]`).click(), sub); await page.waitForTimeout(400); }
        await checkPage(page, `${tab}${sub ? '/' + sub : ''}`);
      }
      if (name === 'computer' && theme === 'dark') await functional(page, db);
      for (const e of errors) fail(`konsolfejl: ${e}`);
      await browser.close();
    }
  }
  console.log(failures ? `\n${failures} fejl` : '\nAlt OK');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
