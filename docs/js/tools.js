// Fanen "Værktøjer": økonomisk kalender, hvad-nu-hvis-beregner (inkl. bil), årsprognose, kvartalsrapport og løn efter skat.
// Samme version som siden (?v=…), så telefonen ikke bruger en gammel kopi
const { lineChart, annuity } = await import("./ui.js" + new URL(import.meta.url).search);

export function init(ctx, root) {
  const { state, kr, esc, fmt, todayIso, addMonths, addDays, daysInMonth, monthTx, totals, sumOut, avgOf } = ctx;

  root.innerHTML = `
    <div class="seg" id="toolSel" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));margin-bottom:12px">
      <button data-t="cal" class="on">Kalender</button>
      <button data-t="whatif">Hvad nu hvis</button>
      <button data-t="year">Årsprognose</button>
      <button data-t="quarter">Kvartal</button>
      <button data-t="tax">Løn og skat</button>
    </div>
    <div id="tool"></div>`;
  const $ = (id) => root.querySelector("#" + id);
  let tool = "cal";
  try { tool = localStorage.getItem("tool") || "cal"; } catch {}
  root.querySelectorAll("#toolSel button").forEach((b) => b.onclick = () => { tool = b.dataset.t; try { localStorage.setItem("tool", tool); } catch {} render(); });

  const thisMonth = () => todayIso().slice(0, 7);
  // Hele måneder før denne, som har data (til snit)
  const fullMonths = (n = 3) => ctx.prevMonthsWithData(thisMonth(), n);
  const avgMonth = () => {
    const ms = fullMonths();
    const t = ms.map((m) => totals(monthTx(m)));
    return { inc: avgOf(t.map((x) => x.inc)), out: avgOf(t.map((x) => x.out)), saved: avgOf(t.map((x) => x.saved)), n: ms.length };
  };

  // Tilbagevendende indtægter (fx løn, lejeindtægt): samme afsender i mindst 3 af 4 måneder
  function recurringIncome(base) {
    const months = [1, 2, 3, 4].map((i) => addMonths(base, -i));
    const groups = new Map();
    for (const t of state.txs) {
      const m = t.booking_date.slice(0, 7);
      if (t.amount <= 0 || !ctx.counts(t) || !months.includes(m)) continue;
      const k = ctx.fixedKey(t);
      if (!groups.has(k)) groups.set(k, { key: k, name: t.counterparty || t.description, byMonth: new Map(), days: [], lastDay: [] });
      const g = groups.get(k);
      g.byMonth.set(m, (g.byMonth.get(m) ?? 0) + t.amount);
      // Løn sidst i måneden: brug "dage før månedsskiftet", så februar ikke forskyder datoen
      g.days.push(+t.booking_date.slice(8)); g.lastDay.push(daysInMonth(m) - +t.booking_date.slice(8));
    }
    const out = [];
    for (const g of groups.values()) {
      if (g.byMonth.size < 3) continue;
      const vals = [...g.byMonth.values()].sort((a, b) => a - b);
      const median = vals[Math.floor(vals.length / 2)];
      if (vals.some((v) => Math.abs(v - median) > median * 0.45)) continue;
      const fromEnd = g.lastDay.sort((a, b) => a - b)[Math.floor(g.lastDay.length / 2)];
      const day = g.days.sort((a, b) => a - b)[Math.floor(g.days.length / 2)];
      out.push({ key: g.key, name: g.name, amount: median, day, fromEnd, endOfMonth: fromEnd <= 3 && day >= 25 });
    }
    return out;
  }

  // ---------- Kalender ----------
  let calMonth = thisMonth();
  function renderCalendar() {
    const m = calMonth, today = todayIso(), isNow = m === thisMonth(), isFuture = m > thisMonth();
    const dim = daysInMonth(m);
    const rows = monthTx(m);
    const byDay = new Map();
    for (const t of rows) if (ctx.counts(t)) {
      const d = +t.booking_date.slice(8);
      const e = byDay.get(d) ?? { out: 0, inc: 0, n: 0 };
      if (t.amount < 0) e.out -= t.amount; else e.inc += t.amount; e.n++;
      byDay.set(d, e);
    }
    // Forventede begivenheder (kun i dag og frem)
    const events = new Map();
    const addEv = (d, ev) => { if (!events.has(d)) events.set(d, []); events.get(d).push(ev); };
    if (isNow || isFuture) {
      const fixed = ctx.detectFixed(isFuture ? thisMonth() : m);
      const seen = new Set(rows.map(ctx.fixedKey));
      const todayD = isNow ? +today.slice(8) : 0;
      for (const f of fixed) if (!seen.has(f.key)) addEv(Math.max(todayD, Math.min(dim, f.day)), { name: f.name, amount: -f.amount });
      for (const r of recurringIncome(isFuture ? thisMonth() : m)) if (!seen.has(r.key)) addEv(Math.max(todayD, r.endOfMonth ? dim - r.fromEnd : Math.min(dim, r.day)), { name: r.name, amount: r.amount });
    }
    const c = (v) => { v = Math.round(v); return Math.abs(v) >= 10000 ? (v / 1000).toFixed(0) + "k" : v.toLocaleString("da-DK"); };
    const first = (new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1, 1)).getUTCDay() + 6) % 7;
    const maxOut = Math.max(1, ...[...byDay.values()].map((e) => e.out));
    let cells = ["man", "tir", "ons", "tor", "fre", "lør", "søn"].map((d) => `<div class="cal-h">${d}</div>`).join("");
    for (let i = 0; i < first; i++) cells += `<div></div>`;
    for (let d = 1; d <= dim; d++) {
      const e = byDay.get(d), ev = events.get(d) ?? [];
      const ds = `${m}-${String(d).padStart(2, "0")}`;
      const heat = e?.out ? 0.12 + 0.5 * Math.min(1, e.out / maxOut) : 0;
      const evIn = ev.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0), evOut = -ev.filter((x) => x.amount < 0).reduce((s, x) => s + x.amount, 0);
      cells += `<div class="cal-d ${ds === today ? "today" : ""} ${ds > today ? "fut" : ""}" data-d="${d}" style="${heat ? `background:rgba(57,135,229,${heat})` : ""}">
        <span class="n">${d}</span>
        ${e?.out ? `<span class="a">−${c(e.out)}</span>` : ""}
        ${e?.inc ? `<span class="a pos">+${c(e.inc)}</span>` : ""}
        ${evIn ? `<span class="ev in" title="Forventet indtægt">+${c(evIn)}</span>` : ""}
        ${evOut ? `<span class="ev out" title="Forventet regning">−${c(evOut)}</span>` : ""}
      </div>`;
    }

    // Prognose for saldo: start fra en konto, hvis der er registreret en (Planlæg → Aktiver), ellers fra 0
    const account = state.assets.find((a) => a.kind === "cash" && /løn|budget|forbrug/i.test(a.name)) ?? state.assets.find((a) => a.kind === "cash");
    let forecast = "";
    if (isNow) {
      const td = +today.slice(8);
      const fixedKeys = new Set(ctx.detectFixed(m).map((f) => f.key));
      // Gennemsnitligt variabelt forbrug pr. dag i de forrige måneder
      const prev = fullMonths();
      const varPerDay = avgOf(prev.map((q) => { const r = monthTx(q); return (sumOut(r) - sumOut(r.filter((t) => fixedKeys.has(ctx.fixedKey(t))))) / daysInMonth(q); }));
      const labels = [], actual = [], proj = [];
      let bal = account ? account.value : 0;
      // Bagud: saldo = nuværende saldo minus bevægelser efter dagen
      const net = (d) => rows.filter((t) => ctx.counts(t) && +t.booking_date.slice(8) === d).reduce((s, t) => s + t.amount, 0);
      const back = [];
      let b = bal;
      for (let d = td; d >= 1; d--) { back[d] = b; b -= net(d); }
      for (let d = 1; d <= dim; d++) {
        labels.push(`${d}. ${fmt(m + "-01", { month: "short" }).replace(".", "")}`);
        if (d <= td) { actual.push(back[d]); proj.push(d === td ? back[d] : null); }
        else {
          bal += (events.get(d) ?? []).reduce((s, x) => s + x.amount, 0) - varPerDay;
          actual.push(null); proj.push(bal);
        }
      }
      const endBal = proj[proj.length - 1];
      const low = Math.min(...proj.filter((v) => v != null));
      forecast = `<div class="card"><div class="head"><h2>${account ? `Forventet saldo på ${esc(account.name)}` : "Forventet udvikling resten af måneden"}</h2></div>
        <div class="kv" style="margin-bottom:8px"><span>Ved månedens udgang</span><b class="${endBal < 0 ? "neg" : ""}">${kr(endBal)}</b>
          <span>Laveste punkt</span><span class="${low < 0 ? "neg" : ""}">${kr(low)}</span>
          <span class="muted">Variabelt forbrug (snit)</span><span class="muted">${kr(varPerDay)}/dag</span></div>
        <div id="calChart"></div>
        <p class="note">${account ? `Starter fra den værdi, du har registreret for ${esc(account.name)} under Planlæg (${kr(account.value)}). Opdatér den for et mere præcist billede.` :
          `Tip: Tilføj din lønkonto under Planlæg → Nettoformue, så prognosen viser din rigtige saldo. Indtil da vises udviklingen fra 0.`}</p></div>`;
      setTimeout(() => { const el = root.querySelector("#calChart"); if (el) lineChart(el, { labels, series: [
        { name: "Faktisk", color: "#3987e5", values: actual }, { name: "Prognose", color: "#8b93a1", values: proj, dashed: true }],
        fmt: kr, showTip: ctx.showTip, hideTip: ctx.hideTip, zeroBased: false, refLines: low < 0 ? [{ value: 0, color: "#ff7b7b", label: "0 kr." }] : [] }); });
    }

    const upcoming = [...events.entries()].sort((a, b) => a[0] - b[0]).flatMap(([d, evs]) => evs.map((e) => ({ d, ...e })));
    $("tool").innerHTML = `
      <div class="card">
        <div class="period" style="margin-bottom:12px">
          <button id="calPrev" aria-label="Forrige måned">‹</button>
          <div style="text-align:center;font-weight:650;font-size:17px">${fmt(m + "-01", { month: "long", year: "numeric" })}</div>
          <button id="calNext" aria-label="Næste måned" ${m >= addMonths(thisMonth(), 1) ? "disabled" : ""}>›</button>
        </div>
        <div class="cal">${cells}</div>
        <div class="legend" style="margin-top:8px"><span><i style="background:rgba(57,135,229,.55)"></i>Forbrug (mørkere = mere)</span>
          <span><i style="background:transparent;border:1.5px dashed var(--green)"></i>Forventet indtægt</span><span><i style="background:transparent;border:1.5px dashed var(--warn)"></i>Forventet regning</span></div>
      </div>
      ${forecast}
      ${upcoming.length ? `<div class="card"><div class="head"><h2>På vej</h2></div>${upcoming.map((u) => `<div class="list-row">
          <div><div>${esc(u.name)}</div><div class="sub">ca. ${u.d}. ${fmt(m + "-01", { month: "long" })}</div></div>
          <span class="num ${u.amount > 0 ? "pos" : ""}">${u.amount > 0 ? "+" : ""}${kr(u.amount)}</span></div>`).join("")}</div>` : ""}`;
    $("calPrev").onclick = () => { calMonth = addMonths(calMonth, -1); renderCalendar(); };
    $("calNext").onclick = () => { calMonth = addMonths(calMonth, 1); renderCalendar(); };
    root.querySelectorAll(".cal-d").forEach((c) => c.onclick = () => {
      const d = +c.dataset.d, list = rows.filter((t) => +t.booking_date.slice(8) === d), ev = events.get(d) ?? [];
      if (!list.length && !ev.length) return ctx.hideTip();
      const r = c.getBoundingClientRect();
      ctx.showTip(`<div style="margin-bottom:3px"><b>${d}. ${fmt(m + "-01", { month: "long" })}</b></div>` +
        list.slice(0, 8).map((t) => `<div>${esc(t.counterparty || t.description)} <b>${kr(t.amount)}</b></div>`).join("") +
        (list.length > 8 ? `<div class="muted">+${list.length - 8} til</div>` : "") +
        ev.map((e) => `<div class="muted">Forventet: ${esc(e.name)} <b>${kr(e.amount)}</b></div>`).join(""), r.left + r.width / 2, r.top);
    });
  }

  // ---------- Hvad nu hvis ----------
  const PRESETS = {
    car: { label: "Køb af bil", upfront: 30000, loan: 120000, rate: 6.9, months: 60, extra: 2500, income: 0, value: 150000, dep: 15,
      note: "Driftsudgifter er fx forsikring (~700), brændstof/strøm (~1.200), grøn ejerafgift (~150) og service (~450) pr. måned." },
    home: { label: "Dyrere bolig", upfront: 15000, loan: 0, rate: 0, months: 0, extra: 3000, income: 0, value: 0, dep: 0, note: "Fx 3.000 kr. mere i husleje om måneden og 15.000 kr. i depositum/flytning." },
    raise: { label: "Lønforhøjelse", upfront: 0, loan: 0, rate: 0, months: 0, extra: 0, income: 2500, value: 0, dep: 0, note: "Beløbet er efter skat (det, der kommer ind på kontoen)." },
    trip: { label: "Stor rejse", upfront: 25000, loan: 0, rate: 0, months: 0, extra: 0, income: 0, value: 0, dep: 0, note: "En engangsudgift betalt af opsparingen." },
  };
  let wi = { ...PRESETS.car, preset: "car" };
  function renderWhatIf() {
    const base = avgMonth();
    const surplus = base.inc - base.out;   // snit pr. måned (opsparing tæller ikke som forbrug)
    const cash = state.assets.filter((a) => a.kind === "cash").reduce((s, a) => s + a.value, 0);
    const pay = wi.loan > 0 && wi.months > 0 ? annuity(wi.loan, wi.rate, wi.months) : 0;
    const newSurplus = surplus - pay - wi.extra + wi.income;
    const horizon = 36;
    const labels = [], without = [], withS = [], netW = [];
    let a = cash, b = cash - wi.upfront, debt = wi.loan, val = wi.value;
    const r = wi.rate / 100 / 12;
    for (let i = 0; i <= horizon; i++) {
      labels.push(i === 0 ? "Nu" : `${i} mdr.`);
      without.push(a); withS.push(b);
      netW.push(b + val - debt - (a));   // forskel i formue mod "uden"
      a += surplus;
      b += surplus + wi.income - wi.extra - (i < wi.months ? pay : 0);
      if (i < wi.months && debt > 0) debt = Math.max(0, debt * (1 + r) - pay);
      val *= Math.pow(1 - wi.dep / 100, 1 / 12);
    }
    const at = (m) => ({ cash: withS[m] - without[m], net: netW[m] });
    const interestTotal = pay * wi.months - wi.loan;
    const monthlyAll = pay + wi.extra + (wi.value * wi.dep / 100) / 12;
    const field = (k, label, step = 100, hint = "") => `<label><span>${label}</span><input type="number" inputmode="decimal" data-k="${k}" value="${wi[k]}" step="${step}">${hint ? `<div class="hint note">${hint}</div>` : ""}</label>`;
    $("tool").innerHTML = `
      <div class="card">
        <div class="head"><h2>Hvad sker der, hvis …</h2></div>
        <div class="seg" style="display:flex;flex-wrap:wrap;margin-bottom:12px">${Object.entries(PRESETS).map(([k, p]) => `<button data-p="${k}" class="${wi.preset === k ? "on" : ""}" style="flex:1">${p.label}</button>`).join("")}</div>
        <p class="note" style="margin-top:0">${esc(PRESETS[wi.preset]?.note ?? "")}</p>
        <div class="wi-grid">
          ${field("upfront", "Engangsbeløb fra opsparingen (kr.)")}
          ${field("loan", "Lån (kr.)")}
          ${field("rate", "Rente (% pr. år)", 0.1)}
          ${field("months", "Løbetid (måneder)", 12)}
          ${field("extra", "Ekstra faste udgifter pr. md. (kr.)")}
          ${field("income", "Ændring i indkomst pr. md. (kr.)")}
          ${field("value", "Værdi af det købte (kr.)", 1000)}
          ${field("dep", "Værditab (% pr. år)", 1)}
        </div>
      </div>
      <div class="card">
        <div class="head"><h2>Resultat</h2></div>
        <div class="kv">
          <span>Til overs pr. måned i dag (snit af ${base.n} mdr.)</span><b>${kr(surplus)}</b>
          ${pay ? `<span>Ydelse på lånet</span><span>−${kr(pay)}</span>` : ""}
          ${wi.extra ? `<span>Ekstra faste udgifter</span><span>−${kr(wi.extra)}</span>` : ""}
          ${wi.income ? `<span>Ændring i indkomst</span><span>${wi.income > 0 ? "+" : "−"}${kr(Math.abs(wi.income))}</span>` : ""}
          <span><b>Til overs pr. måned bagefter</b></span><b class="${newSurplus < 0 ? "neg" : "pos"}">${kr(newSurplus)}</b>
          ${pay ? `<span class="muted">Renter i alt over lånets løbetid</span><span class="muted">${kr(interestTotal)}</span>` : ""}
          ${wi.value && wi.dep ? `<span class="muted">Samlet pris pr. måned inkl. værditab</span><span class="muted">${kr(monthlyAll)}</span>` : ""}
        </div>
        <table class="wi-table"><thead><tr><th></th><th>12 mdr.</th><th>24 mdr.</th><th>36 mdr.</th></tr></thead><tbody>
          <tr><td>Forskel i opsparing</td>${[12, 24, 36].map((m) => `<td class="${at(m).cash < 0 ? "neg" : "pos"}">${at(m).cash >= 0 ? "+" : "−"}${kr(Math.abs(at(m).cash))}</td>`).join("")}</tr>
          <tr><td>Forskel i formue</td>${[12, 24, 36].map((m) => `<td class="${at(m).net < 0 ? "neg" : "pos"}">${at(m).net >= 0 ? "+" : "−"}${kr(Math.abs(at(m).net))}</td>`).join("")}</tr>
        </tbody></table>
        <p class="note">Sammenlignet med, hvis du lader være. "Formue" medregner værdien af det købte (efter værditab) og trækker restgælden fra.</p>
        <div id="wiChart" style="margin-top:8px"></div>
        ${newSurplus < 0 ? `<p class="small neg">Du vil bruge mere, end du tjener, hver måned. Det går ud over opsparingen.</p>` : ""}
        <p class="note">${cash ? `Starter fra dine konti under Planlæg (${kr(cash)}).` : "Tip: Tilføj dine konti under Planlæg, så kurverne starter fra din rigtige opsparing."}</p>
      </div>`;
    root.querySelectorAll(".wi-grid input").forEach((inp) => inp.onchange = () => { wi[inp.dataset.k] = Number(inp.value) || 0; wi.preset = "custom"; renderWhatIf(); });
    root.querySelectorAll("[data-p]").forEach((b) => b.onclick = () => { wi = { ...PRESETS[b.dataset.p], preset: b.dataset.p }; renderWhatIf(); });
    lineChart($("wiChart"), { labels, series: [{ name: "Uden", color: "#8b93a1", values: without, dashed: true }, { name: "Med", color: "#3987e5", values: withS }],
      fmt: kr, showTip: ctx.showTip, hideTip: ctx.hideTip, zeroBased: false });
  }

  // ---------- Årsprognose ----------
  function renderYear() {
    const y = todayIso().slice(0, 4), now = thisMonth();
    const base = avgMonth();
    const months = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
    const fixedThis = ctx.detectFixed(now);
    const data = months.map((m) => {
      if (m < now) return { m, ...totals(monthTx(m)), proj: false };
      if (m > now) return { m, inc: base.inc, out: base.out, saved: base.saved, proj: true };
      // Denne måned: faktisk + resten fremskrevet
      const t = totals(monthTx(m)), f = ctx.elapsed(m);
      const fixedOut = sumOut(monthTx(m).filter((x) => fixedThis.some((fx) => fx.key === ctx.fixedKey(x))));
      return { m, inc: Math.max(t.inc, base.inc), out: fixedOut + (t.out - fixedOut) / Math.max(f, 0.2) + fixedThis.filter((fx) => !monthTx(m).some((x) => ctx.fixedKey(x) === fx.key)).reduce((s, fx) => s + fx.amount, 0), saved: Math.max(t.saved, base.saved), proj: true };
    });
    const hasData = data.filter((d) => !d.proj && (d.inc || d.out));
    const sumK = (k, arr = data) => arr.reduce((s, d) => s + d[k], 0);
    const inc = sumK("inc"), out = sumK("out"), res = inc - out;
    const ytd = data.filter((d) => d.m < now);
    const max = Math.max(1, ...data.map((d) => Math.max(d.inc, d.out)));
    const nw = state.assets.reduce((s, a) => s + (["loan", "mortgage", "credit"].includes(a.kind) ? -a.value : a.value), 0);
    const monthsLeft = 12 - (+now.slice(5)) + 1;
    $("tool").innerHTML = `
      <div class="card">
        <div class="head"><h2>Prognose for ${y}</h2><span class="small muted">${hasData.length} mdr. faktisk + ${12 - ytd.length} mdr. prognose</span></div>
        <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin:0 0 12px">
          <div class="kpi"><div class="k-top">Indtægter</div><div class="k-v pos">${kr(inc)}</div><div class="k-s">${kr(sumK("inc", ytd))} indtil nu</div></div>
          <div class="kpi"><div class="k-top">Udgifter</div><div class="k-v">${kr(out)}</div><div class="k-s">${kr(sumK("out", ytd))} indtil nu</div></div>
          <div class="kpi"><div class="k-top">Til overs</div><div class="k-v ${res < 0 ? "neg" : "pos"}">${kr(res)}</div><div class="k-s">${inc ? Math.round(res / inc * 100) : 0}% af indtægterne</div></div>
        </div>
        <div class="chart" style="height:150px">${data.map((d) => `<div class="m ${d.m === now ? "cur" : ""}" title="${fmt(d.m + "-01", { month: "long" })}${d.proj ? " (prognose)" : ""}: udgifter ${kr(d.out)}, indtægter ${kr(d.inc)}">
          <span class="lbl num">${d.out ? Math.round(d.out / 1000) + "k" : ""}</span>
          <div class="cols" style="${d.proj ? "opacity:.45" : ""}"><div class="col out" style="height:${d.out / max * 100}%;background:#3987e5"></div><div class="col in" style="height:${d.inc / max * 100}%;background:#5fd39a"></div></div>
          <span class="lbl">${fmt(d.m + "-01", { month: "short" }).replace(".", "")}</span></div>`).join("")}</div>
        <div class="legend" style="margin-top:6px"><span><i style="background:#3987e5"></i>Udgifter</span><span><i style="background:#5fd39a"></i>Indtægter</span><span><i style="background:#3987e5;opacity:.45"></i>Lysere = prognose</span></div>
        <p class="note">Prognosen bruger snittet af de ${base.n} seneste hele måneder (indtægter ${kr(base.inc)}, udgifter ${kr(base.out)} pr. måned). Måneder uden data tæller som 0.</p>
      </div>
      ${state.assets.length ? `<div class="card"><div class="head"><h2>Formue ved årets udgang</h2></div>
        <div class="kv"><span>Nettoformue i dag</span><span>${kr(nw)}</span><span>+ forventet overskud resten af året</span><span>${kr(sumK("inc", data.filter((d) => d.m >= now)) - sumK("out", data.filter((d) => d.m >= now)))}</span>
        <span><b>Forventet nettoformue 31. december</b></span><b>${kr(nw + sumK("inc", data.filter((d) => d.m >= now)) - sumK("out", data.filter((d) => d.m >= now)))}</b></div>
        <p class="note">Uden afkast på investeringer og værditab. ${monthsLeft} måneder tilbage.</p></div>` : ""}`;
  }

  // ---------- Kvartalsrapport ----------
  let quarter = null;
  function renderQuarter() {
    const qOf = (m) => `${m.slice(0, 4)}-K${Math.ceil(+m.slice(5, 7) / 3)}`;
    const qs = [...new Set(state.txs.map((t) => qOf(t.booking_date.slice(0, 7))))].sort().reverse();
    if (!qs.length) { $("tool").innerHTML = `<div class="card"><p class="empty">Ingen data endnu.</p></div>`; return; }
    if (!quarter || !qs.includes(quarter)) quarter = qs.find((q) => q < qOf(thisMonth())) ?? qs[0];
    const monthsOf = (q) => { const y = q.slice(0, 4), k = +q.slice(6); return [1, 2, 3].map((i) => `${y}-${String((k - 1) * 3 + i).padStart(2, "0")}`); };
    const prevQ = (q) => { const y = +q.slice(0, 4), k = +q.slice(6); return k === 1 ? `${y - 1}-K4` : `${y}-K${k - 1}`; };
    const rows = (q) => state.txs.filter((t) => monthsOf(q).includes(t.booking_date.slice(0, 7)));
    const cur = rows(quarter), prv = rows(prevQ(quarter));
    const T = totals(cur), P = totals(prv);
    const chg = (a, b) => b ? Math.round((a - b) / b * 100) : null;
    const chip = (v, goodUp) => v == null ? "" : `<span class="${(v >= 0) === goodUp ? "down" : "up"}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v)}%</span>`;
    const perMonth = monthsOf(quarter).map((m) => ({ m, ...totals(monthTx(m)) })).filter((x) => x.inc || x.out);
    const best = [...perMonth].sort((a, b) => (b.inc - b.out) - (a.inc - a.out))[0], worst = [...perMonth].sort((a, b) => (a.inc - a.out) - (b.inc - b.out))[0];
    const byCat = (r) => { const mm = new Map(); for (const t of r) if (ctx.isExp(t)) { const k = String(ctx.effCat(t) ?? "none"); mm.set(k, (mm.get(k) ?? 0) - t.amount); } return mm; };
    const cc = byCat(cur), pc = byCat(prv);
    const top = [...cc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const name = (k) => k === "none" ? "Uden kategori" : ctx.catById(k)?.name ?? "?";
    const qLabel = (q) => `${q.slice(6)}. kvartal ${q.slice(0, 4)}`;
    const partial = monthsOf(quarter).some((m) => m >= thisMonth());
    $("tool").innerHTML = `<div class="card">
      <div class="head"><h2>Kvartalsrapport</h2>
        <select id="qSel">${qs.map((q) => `<option value="${q}" ${q === quarter ? "selected" : ""}>${qLabel(q)}</option>`).join("")}</select></div>
      ${partial ? `<p class="note" style="margin-top:0">Kvartalet er ikke slut endnu – tallene er indtil nu.</p>` : ""}
      <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin:0 0 12px">
        <div class="kpi"><div class="k-top">Indtægter</div><div class="k-v pos">${kr(T.inc)}</div><div class="k-s">${chip(chg(T.inc, P.inc), true)} mod forrige</div></div>
        <div class="kpi"><div class="k-top">Udgifter</div><div class="k-v">${kr(T.out)}</div><div class="k-s">${chip(chg(T.out, P.out), false)} mod forrige</div></div>
        <div class="kpi"><div class="k-top">Til overs</div><div class="k-v ${T.inc - T.out < 0 ? "neg" : "pos"}">${kr(T.inc - T.out)}</div><div class="k-s">${T.inc ? Math.round((T.inc - T.out) / T.inc * 100) : 0}% af indtægterne</div></div>
      </div>
      <div class="kv">
        <span>Sat til side (opsparing/egne konti)</span><span>${kr(T.saved)}</span>
        ${T.oneoff > 0 ? `<span>Store køb (holdt udenfor)</span><span>${kr(T.oneoff)}</span>` : ""}
        ${best ? `<span>Bedste måned</span><span>${fmt(best.m + "-01", { month: "long" })} (${kr(best.inc - best.out)})</span>` : ""}
        ${worst && worst !== best ? `<span>Svageste måned</span><span>${fmt(worst.m + "-01", { month: "long" })} (${kr(worst.inc - worst.out)})</span>` : ""}
        <span>Antal posteringer</span><span>${cur.length}</span>
      </div>
      <div class="small muted" style="margin:14px 0 4px">Største udgiftsområder</div>
      ${top.map(([k, v]) => { const c = chg(v, pc.get(k)); return `<div class="list-row"><div>${esc(name(k))}</div>
        <div class="num">${kr(v)} <span class="small">${chip(c, false)}</span></div></div>`; }).join("")}
      <p class="note">Sammenlignet med ${qLabel(prevQ(quarter))}${prv.length ? "" : " (ingen data)"}.</p>
    </div>`;
    $("qSel").onchange = (e) => { quarter = e.target.value; renderQuarter(); };
  }

  // ---------- Løn efter skat ----------
  // Omtrentlige 2026-satser. Kan rettes under "Satser". Tjek altid skat.dk for præcise tal.
  const RATES = { am: 8, bund: 12.01, kommune: 25.0, kirke: 0.66, personfradrag: 54100, besk: 12.75, beskMax: 63300,
    mellem: 7.5, mellemGr: 641200, top: 7.5, topGr: 777900, atp: 99 };
  let tax = { gross: 45000, pension: 5, church: true, rates: { ...RATES } };
  try { Object.assign(tax, JSON.parse(localStorage.getItem("tax") || "{}")); tax.rates = { ...RATES, ...(tax.rates || {}) }; } catch {}
  function calcTax(t) {
    const R = t.rates, yGross = t.gross * 12;
    const pens = yGross * t.pension / 100, atp = R.atp * 12;
    const amBase = yGross - pens - atp;
    const am = amBase * R.am / 100;
    const pi = amBase - am;                                  // personlig indkomst
    const besk = Math.min(amBase * R.besk / 100, R.beskMax);
    const bund = Math.max(0, pi - R.personfradrag) * R.bund / 100;
    const kom = Math.max(0, pi - besk - R.personfradrag) * (R.kommune + (t.church ? R.kirke : 0)) / 100;
    const mellem = Math.max(0, pi + pens - R.mellemGr) * R.mellem / 100;
    const top = Math.max(0, pi + pens - R.topGr) * R.top / 100;
    const totalTax = am + bund + kom + mellem + top;
    const net = yGross - pens - atp - totalTax;
    // Marginalskat: skat af de næste 100 kr.
    const marg = t.__m ? 0 : (calcTax({ ...t, gross: t.gross + 100 / 12, __m: true }).totalTax - totalTax) / 100;
    return { yGross, pens, atp, am, besk, bund, kom, mellem, top, totalTax, net, marg };
  }
  function renderTax() {
    const r = calcTax(tax);
    const sal = ctx.salaryCat();
    const ms = fullMonths(6);
    const actual = sal ? avgOf(ms.map((m) => monthTx(m).filter((t) => String(t.category_id) === String(sal.id) && t.amount > 0).reduce((s, t) => s + t.amount, 0)).filter((v) => v > 0)) : 0;
    const row = (l, v, cls = "") => `<span class="${cls}">${l}</span><span class="${cls}">${kr(v / 12)}<span class="muted small"> · ${kr(v)}/år</span></span>`;
    $("tool").innerHTML = `<div class="card">
      <div class="head"><h2>Løn efter skat</h2></div>
      <div class="wi-grid">
        <label><span>Bruttoløn pr. måned (kr.)</span><input type="number" inputmode="decimal" id="txGross" value="${tax.gross}" step="500"></label>
        <label><span>Din egen pensionsandel (%)</span><input type="number" inputmode="decimal" id="txPens" value="${tax.pension}" step="0.5"></label>
      </div>
      <label class="row small" style="gap:8px;margin-top:8px"><input type="checkbox" id="txChurch" style="width:auto" ${tax.church ? "checked" : ""}> Medlem af folkekirken</label>
      <div class="hero" style="border:1px solid #2c3854;border-radius:12px;padding:12px;margin-top:12px">
        <div class="hero-lbl">Udbetalt pr. måned (ca.)</div>
        <div class="hero-amt num" style="font-size:32px">${kr(r.net / 12)}</div>
        <div class="hero-sub">Skat i alt ${kr(r.totalTax / 12)}/md. · ${Math.round(r.totalTax / r.yGross * 100)}% af bruttolønnen · marginalskat ca. ${Math.round(r.marg * 100)}%</div>
      </div>
      <div class="kv" style="margin-top:12px">
        ${row("Bruttoløn", r.yGross)}
        ${row("− Pension (din andel)", r.pens, "muted")}
        ${row("− ATP", r.atp, "muted")}
        ${row("− AM-bidrag (8 %)", r.am, "muted")}
        ${row("− Bundskat", r.bund, "muted")}
        ${row("− Kommune" + (tax.church ? " og kirkeskat" : "skat"), r.kom, "muted")}
        ${r.mellem ? row("− Mellemskat", r.mellem, "muted") : ""}
        ${r.top ? row("− Topskat", r.top, "muted") : ""}
        ${row("<b>Udbetalt</b>", r.net)}
      </div>
      ${actual ? `<p class="small" style="margin-top:12px">Din løn på kontoen har i snit været <b>${kr(actual)}</b> pr. måned de seneste ${ms.length} måneder${Math.abs(actual - r.net / 12) > 1500 ? " – juster bruttolønnen eller pensionen, hvis beregningen skal passe" : ""}.</p>` : ""}
      <details style="margin-top:10px"><summary class="small muted">Satser (ca. 2026 – ret dem, hvis de ikke passer)</summary>
        <div class="wi-grid" style="margin-top:8px">${Object.entries({ kommune: "Kommuneskat %", kirke: "Kirkeskat %", bund: "Bundskat %", personfradrag: "Personfradrag kr./år",
          besk: "Beskæftigelsesfradrag %", beskMax: "Beskæftigelsesfradrag maks. kr.", mellem: "Mellemskat %", mellemGr: "Mellemskat-grænse kr.", top: "Topskat %", topGr: "Topskat-grænse kr.", atp: "ATP kr./md." })
          .map(([k, l]) => `<label><span>${l}</span><input type="number" inputmode="decimal" data-r="${k}" value="${tax.rates[k]}" step="any"></label>`).join("")}</div>
        <button class="small ghost" id="txReset" style="margin-top:8px">Nulstil satser</button>
      </details>
      <p class="note">Et skøn: medregner ikke fx jobfradrag, rentefradrag, befordringsfradrag eller frikort. Find dine præcise tal i din forskudsopgørelse på skat.dk.</p>
    </div>`;
    const save = () => { try { localStorage.setItem("tax", JSON.stringify(tax)); } catch {} renderTax(); };
    root.querySelector("#txGross").onchange = (e) => { tax.gross = Number(e.target.value) || 0; save(); };
    root.querySelector("#txPens").onchange = (e) => { tax.pension = Number(e.target.value) || 0; save(); };
    root.querySelector("#txChurch").onchange = (e) => { tax.church = e.target.checked; save(); };
    root.querySelectorAll("[data-r]").forEach((i) => i.onchange = () => { tax.rates[i.dataset.r] = Number(i.value) || 0; save(); root.querySelector("details").open = true; });
    root.querySelector("#txReset").onclick = () => { tax.rates = { ...RATES }; save(); };
  }

  const style = document.createElement("style");
  style.textContent = `
    .cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
    .cal-h { font-size: 11px; color: var(--muted); text-align: center; padding-bottom: 2px; }
    .cal-d { min-height: 58px; border-radius: 8px; background: #1d212a; padding: 4px; display: flex; flex-direction: column; gap: 1px; cursor: pointer; overflow: hidden; }
    .cal-d .n { font-size: 12px; font-weight: 600; }
    .cal-d .a { font-size: 10.5px; font-variant-numeric: tabular-nums; }
    .cal-d .ev { font-size: 10.5px; border: 1.5px dashed; border-radius: 4px; padding: 0 2px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; }
    .cal-d .ev.in { border-color: var(--green); color: var(--green); } .cal-d .ev.out { border-color: var(--warn); color: var(--warn); }
    .cal-d.today { outline: 2px solid var(--accent); }
    .cal-d.fut { background: #171a21; }
    .wi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .wi-grid label span { display: block; font-size: 12.5px; color: var(--muted); margin-bottom: 3px; }
    .wi-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
    .wi-table th { font-size: 12px; color: var(--muted); font-weight: 500; text-align: right; padding: 4px; }
    .wi-table td { padding: 6px 4px; border-top: 1px solid var(--line); text-align: right; font-variant-numeric: tabular-nums; }
    .wi-table td:first-child, .wi-table th:first-child { text-align: left; }
    #toolSel button { white-space: nowrap; }
    @media (max-width: 520px) { .cal-d { min-height: 50px; } .cal-d .a, .cal-d .ev { font-size: 9.5px; } }
  `;
  document.head.appendChild(style);

  function render() {
    root.querySelectorAll("#toolSel button").forEach((b) => b.classList.toggle("on", b.dataset.t === tool));
    ({ cal: renderCalendar, whatif: renderWhatIf, year: renderYear, quarter: renderQuarter, tax: renderTax })[tool]?.();
  }
  return { render };
}
