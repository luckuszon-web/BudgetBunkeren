// Testmiljø (standard: den klassiske app, klassisk.html): kører docs/ lokalt i Chromium mod en falsk Supabase med opdigtede demodata (tests/fixtures/demo.json).
// Datoen låses til 16. nov. 2026, så resultaterne er de samme hver gang.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DOCS = path.join(__dirname, '..', 'docs');
const SB = 'https://xqxgnfwwkdlgcatyajhx.supabase.co';
const SITE = 'https://luckuszon-web.github.io/BudgetBunkeren/';

function b64(o){return Buffer.from(JSON.stringify(o)).toString('base64url');}
const uid = '00000000-0000-0000-0000-000000000001';
const token = `${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:uid,aal:'aal1',amr:[{method:'password',timestamp:1}],exp:9999999999,role:'authenticated'})}.sig`;
const session = { access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 9e8, expires_at: 9999999999,
  user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'demo@example.com', app_metadata:{}, user_metadata:{}, factors: [] } };

function makeDb(){
  const d = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','demo.json')));
  for (const t of Object.values(d)) for (const r of t) if ('user_id' in r) r.user_id = uid;
  return d;
}
function applyFilters(rows, params){
  for (const [k,v] of params){
    if (['select','order','limit','offset','on_conflict','columns'].includes(k)) continue;
    const [op,...rest]=v.split('.'); const val=rest.join('.');
    rows = rows.filter(r=>{ const x=r[k]; switch(op){
      case 'eq': return String(x)===val; case 'neq': return String(x)!==val; case 'gte': return String(x)>=val; case 'lte': return String(x)<=val;
      case 'lt': return String(x)<val; case 'is': return val==='null'? x==null : true;
      case 'in': return val.replace(/[()"]/g,'').split(',').includes(String(x)); default: return true; }});
  }
  return rows;
}
async function setup(page, db, log){
  await page.route(SB + '/**', async (route) => {
    const req = route.request(); const u = new URL(req.url()); const m = req.method();
    const json = (body, status=200, headers={}) => route.fulfill({ status, contentType:'application/json', headers:{'access-control-allow-origin':'*', ...headers}, body: JSON.stringify(body) });
    if (m==='OPTIONS') return route.fulfill({status:200, headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    log.push(`${m} ${u.pathname}${u.search}`);
    if (u.pathname.startsWith('/rest/v1/rpc/')) return json(null);
    if (u.pathname.startsWith('/functions/v1/advisor')) { const b = JSON.parse(req.postData()); log.push('ADVISOR '+JSON.stringify(b).length); global.lastAdvisor = b; if (b.ping) return json({ ok: true, hasKey: true }); return json({ answer: 'Du har brugt **28% mere** på restaurant.\n- Spar på Wolt\n- Lav madpakker' }); }
    if (u.pathname.startsWith('/functions/v1/bank-connect')) { const b = JSON.parse(req.postData()||'{}'); log.push('BANK '+b.action); if (b.action==='register') { log.push('REGISTER '+b.email+' '+b.code+' auth='+(req.headers()['authorization']||'').slice(0,12)); return b.code==='GOOD1-CODE2' ? json({ ok:true }) : json({ error:'Invitationskoden er ugyldig, brugt eller udløbet. Bed om en ny.' }, 400); }
      if (b.action==='create-invite') { global.invites=(global.invites||[]); global.invites.unshift({ code:'ABCDE-FGHJK', used_at:null, expires_at:new Date(Date.now()+864e5*14).toISOString() }); return json({ code:'ABCDE-FGHJK' }); }
      if (b.action==='list-invites') return json({ owner: global.isOwner !== false, invites: global.invites||[] });
      if (b.action==='credentials-status') return json({ available: global.credsAvail !== false, owner: global.isOwner !== false, own: !!global.ownApp, app_id: global.ownApp?.app_id ?? null, since: global.ownApp ? new Date().toISOString() : null });
      if (b.action==='save-credentials') { if (!/BEGIN PRIVATE KEY/.test(b.private_key)) return json({ error: 'Filen ligner ikke en .pem-nøgle' }, 400); global.ownApp = { app_id: b.app_id }; return json({ ok: true }); }
      if (b.action==='remove-credentials') { global.ownApp = null; return json({ ok: true }); }
      if (b.action==='pot-create') { const pot = { id: 77, name: b.name || 'Fælles husholdning', created_by: uid, owner_pct: b.my_pct ?? 50 }; db.shared_pots = [pot]; db.pot_members = [{ pot_id: 77, user_id: uid, name: 'Demo' }, { pot_id: 77, user_id: 'p-2', name: 'Partner' }]; return json({ ok: true, pot_id: 77 }); }
      if (b.action==='pot-delete') { db.shared_pots = []; db.pot_members = []; db.pot_items = []; return json({ ok: true }); }
      if (b.action==='finish') { log.push('FINISH '+b.code); return json({ accounts: 2 }); }
      if (b.action==='banks') return json({ banks:['Danske Bank','Jyske Bank','Lunar','Nordea'] }); if (b.action==='delete-accounts') { const keys = b.account_keys||[]; const del = db.accounts.filter(a => b.all || keys.includes(a.account_key ?? a.uid)).map(a => a.uid); db.accounts = db.accounts.filter(a => !del.includes(a.uid)); db.transactions = db.transactions.filter(t => !del.includes(t.account_uid)); if (b.all) db.bank_sessions = []; log.push('DELETE '+del.join(',')); return json({ ok:true, deleted: del.length }); }
      if (b.action==='disconnect') { db.bank_sessions = []; for (const a of db.accounts) if (a.session_id===b.session_id) a.session_id=null; return json({ ok:true }); } return json({ url: 'https://example.com/auth' }); }
    if (u.pathname.startsWith('/functions/v1/')) return json({ ok:true, report:[] });
    if (u.pathname.startsWith('/auth/v1/recover')) { log.push('RECOVER '+req.postData()+' '+u.search); return json({}); }
    if (u.pathname.startsWith('/auth/v1/user') && m==='PUT') { log.push('SETPW'); return json({ id: uid, email: 'demo@example.com' }); }
    if (u.pathname.startsWith('/auth/v1/user')) return json({ id: uid, email: 'demo@example.com', last_sign_in_at: new Date().toISOString(), factors: [] });
    if (u.pathname.startsWith('/auth/v1/')) return json({});
    const table = u.pathname.split('/').pop(); const rows = db[table] ??= [];
    if (m==='GET'){
      let out = applyFilters(rows, u.searchParams);
      const order = u.searchParams.get('order');
      if (order){ const [col,dir]=order.split('.'); out=[...out].sort((a,b)=> (a[col]>b[col]?1:a[col]<b[col]?-1:0)*(dir==='desc'?-1:1)); }
      const range = req.headers()['range']; let start=0, end=out.length-1;
      if (range){ [start,end]=range.split('-').map(Number); }
      const lim = u.searchParams.get('limit'); const off = +(u.searchParams.get('offset')??0);
      if (lim){ start=off; end=Math.min(end, off+ +lim-1); }
      end = Math.min(end, start+999); // Supabase: max 1000 rækker pr. svar
      const total = out.length; out = out.slice(start, end+1);
      const single = (req.headers()['accept']||'').includes('vnd.pgrst.object');
      return json(single ? out[0] ?? null : out, 200, {'content-range': `${start}-${start+out.length-1}/${total}`});
    }
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    if (m==='POST'){ const arr=[].concat(body).map(r=>({ id: Math.floor(Math.random()*1e9), user_id: uid, ...r })); rows.push(...arr);
      const single=(req.headers()['accept']||'').includes('vnd.pgrst.object'); return json(single?arr[0]:arr, 201); }
    if (m==='PATCH'){ const hit=applyFilters(rows,u.searchParams); hit.forEach(r=>Object.assign(r,body)); return json(hit, 200); }
    if (m==='DELETE'){ const hit=applyFilters(rows,u.searchParams); db[table]=rows.filter(r=>!hit.includes(r)); return json(hit, 200); }
    return json({}, 404);
  });
  await page.route(SITE + '**', (route) => {
    let p = new URL(route.request().url()).pathname.replace('/BudgetBunkeren/','') || 'index.html';
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(DOCS, p);
    if (!fs.existsSync(f)) return route.fulfill({status:404, body:'nf'});
    route.fulfill({ status:200, contentType: p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':p.endsWith('.webmanifest')?'application/manifest+json':'text/html', body: fs.readFileSync(f) });
  });
  await page.addInitScript(([k,s])=>localStorage.setItem(k, s), ['sb-xqxgnfwwkdlgcatyajhx-auth-token', JSON.stringify(session)]);
}
async function open(opts={}){
  const browser = await chromium.launch();
  const ctx = await browser.newContext(opts.mobile ? { viewport:{width:390,height:844}, deviceScaleFactor: opts.dpr ?? 1, isMobile:true, hasTouch:true } : { viewport:{width:1100,height:900} });
  const page = await ctx.newPage(); const log=[]; const errors=[]; const db = makeDb();
  page.on('pageerror', e=>errors.push('pageerror: '+e.message)); page.on('console', m=>m.type()==='error'&&errors.push('console: '+m.text()));
  page.on('dialog', d => (opts.onDialog ? opts.onDialog(d) : d.dismiss()));
  await page.clock.install({ time: new Date(opts.now ?? '2026-11-16T12:00:00Z') });
  await setup(page, db, log);
  if (opts.noSession) await page.addInitScript(() => localStorage.clear());
  await page.goto(opts.url ?? SITE + 'klassisk.html'); await page.waitForTimeout(2500);
  return { browser, page, log, errors, db };
}
module.exports = { open, SITE, uid };
