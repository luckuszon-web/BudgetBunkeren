// Tilgængelighedstjek (axe-core, WCAG 2.1 AA) af alle sider i mørkt og lyst tema på mobil.
//   node a11y.js          (byg først appen: sh scripts/build-ny.sh)
const fs = require('fs');
const h = require('./harness');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ROUTES = ['', 'posteringer', 'budget', 'planlaeg', 'mere', 'vaerktoejer', 'faelles', 'raadgiver', 'indstillinger', 'indstillinger/data', 'indstillinger/notifikationer', 'indstillinger/hjaelp'];

(async () => {
  const all = new Map();
  for (const theme of ['dark', 'light']) {
    const { browser, page } = await h.open({ mobile: true, dpr: 1, url: h.SITE + 'ny/' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate((t) => { localStorage.setItem('bb-theme', t); localStorage.setItem('bb-welcome-install', 'x'); localStorage.setItem('bb-welcome-push', 'x'); }, theme);
    for (const r of ROUTES) {
      await page.goto(h.SITE + 'ny/#/' + r); await page.waitForTimeout(900);
      await page.addScriptTag({ content: AXE });
      const res = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations
        .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' ' + (n.failureSummary || '').split('\n').slice(1, 2).join('')) })));
      for (const v of res) { const k = `${v.id}`; const e = all.get(k) ?? { ...v, where: new Set() }; e.where.add(`${theme}:/${r}`); all.set(k, e); }
    }
    await browser.close();
  }
  if (!all.size) { console.log('Ingen fund 🎉'); return; }
  for (const v of all.values()) console.log(`\n[${v.impact}] ${v.id}: ${v.help}\n  sider: ${[...v.where].slice(0, 6).join(', ')}${v.where.size > 6 ? ' …' : ''}\n  ${v.nodes.join('\n  ')}`);
  process.exitCode = 1;
})();
