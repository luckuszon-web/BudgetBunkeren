// Fanen "Planlæg": nettoformue, investeringer, gæld, opsparingsmål og spareudfordringer.
import { formDialog, lineChart, ring, monthsToPayoff } from "./ui.js";

const KINDS = {
  cash: "Konto", investment: "Investering", pension: "Pension", property: "Bolig", vehicle: "Køretøj", other: "Andet aktiv",
  loan: "Lån", mortgage: "Boliglån", credit: "Kreditkort",
};
const DEBT = new Set(["loan", "mortgage", "credit"]);
// Faste farver pr. formuetype (samme farvesæt som resten af siden)
const KIND_COLOR = { cash: "#3987e5", investment: "#199e70", pension: "#9085e9", property: "#c98500", vehicle: "#d55181", other: "#8b93a1" };

export function init(ctx, root) {
  const { sb, state, kr, esc, fmt, todayIso, addMonths, toast } = ctx;

  root.innerHTML = `
    <div id="planMissing" class="card banner hidden">
      <b>Næsten klar</b>
      <p class="small" style="margin:6px 0 0">Mål, formue, gæld og spareudfordringer kræver databaseopdateringen øverst på siden.</p>
    </div>

    <div class="card" id="nwCard">
      <div class="head"><h2>Nettoformue</h2><button class="small" id="addAsset">+ Tilføj</button></div>
      <div class="big" id="nwTotal"></div>
      <div class="small muted" id="nwChange"></div>
      <div id="nwBar" class="seg-bar" style="margin-top:12px"></div>
      <div id="nwLegend" class="seg-legend"></div>
      <div id="nwChart" style="margin-top:14px"></div>
    </div>

    <div class="duo">
      <div class="card"><div class="head"><h2>Aktiver</h2><span class="num small" id="assetSum"></span></div><div id="assetList"></div></div>
      <div class="card"><div class="head"><h2>Gæld</h2><span class="num small" id="debtSum"></span></div><div id="debtList"></div></div>
    </div>

    <div class="card" id="invCard">
      <div class="head"><h2>Investeringer og pension</h2><span class="num small" id="invSum"></span></div>
      <div id="invList"></div>
    </div>

    <div class="card">
      <div class="head"><h2>Opsparingsmål</h2><button class="small" id="addGoal">+ Nyt mål</button></div>
      <div id="goalList" class="grid-cards"></div>
    </div>

    <div class="card">
      <div class="head"><h2>Spareudfordringer</h2><button class="small" id="addChallenge">+ Ny udfordring</button></div>
      <div id="chList"></div>
      <div id="chSuggest" style="margin-top:12px"></div>
      <div id="chHistory" style="margin-top:12px"></div>
    </div>`;

  const $ = (id) => root.querySelector("#" + id);
  const assets = () => state.assets.filter((a) => !DEBT.has(a.kind));
  const debts = () => state.assets.filter((a) => DEBT.has(a.kind));
  const sum = (arr) => arr.reduce((s, a) => s + a.value, 0);
  const pct = (v) => (v > 0 ? "+" : "") + v.toFixed(1).replace(".", ",") + "%";

  // ---------- Nettoformue ----------
  // Værdi af et aktiv ved udgangen af en måned = seneste registrering til og med den dato
  function valueAt(asset, monthEnd) {
    let v = null;
    for (const h of state.history) if (String(h.asset_id) === String(asset.id) && h.recorded_on <= monthEnd) v = h.value;
    return v;
  }
  function netWorthSeries() {
    const now = todayIso().slice(0, 7);
    const first = state.history.reduce((m, h) => h.recorded_on < m ? h.recorded_on : m, todayIso()).slice(0, 7);
    const months = [];
    for (let m = addMonths(now, -11) > first ? addMonths(now, -11) : first; m <= now; m = addMonths(m, 1)) months.push(m);
    return months.map((m) => {
      const end = m === now ? todayIso() : addMonths(m, 1) + "-00";
      let a = 0, d = 0, any = false;
      for (const x of state.assets) {
        const v = m === now ? x.value : valueAt(x, end);
        if (v == null) continue;
        any = true;
        if (DEBT.has(x.kind)) d += v; else a += v;
      }
      return { m, a: any ? a : null, d: any ? d : null, n: any ? a - d : null };
    });
  }

  function renderNetWorth() {
    const A = sum(assets()), Dt = sum(debts()), N = A - Dt;
    $("nwTotal").textContent = kr(N);
    $("nwTotal").style.color = N < 0 ? "var(--red)" : "";
    const series = netWorthSeries();
    const prev = series.length > 1 ? series.find((s) => s.n != null) : null;
    $("nwChange").innerHTML = state.assets.length
      ? `Aktiver ${kr(A)} − gæld ${kr(Dt)}` + (prev && prev.m !== series[series.length - 1].m
        ? ` · <span class="${N - prev.n >= 0 ? "down" : "up"}">${N - prev.n >= 0 ? "+" : "−"}${kr(Math.abs(N - prev.n))}</span> siden ${fmt(prev.m + "-01", { month: "long" })}` : "")
      : "Tilføj dine konti, investeringer, bolig, bil og lån for at se din samlede formue.";

    // Fordeling af aktiver
    const byKind = new Map();
    for (const a of assets()) byKind.set(a.kind, (byKind.get(a.kind) ?? 0) + a.value);
    const parts = [...byKind.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    $("nwBar").innerHTML = A > 0 ? parts.map(([k, v]) => `<div style="flex:${v};background:${KIND_COLOR[k]}" title="${KINDS[k]}: ${kr(v)}"></div>`).join("") : "";
    $("nwLegend").innerHTML = A > 0 ? parts.map(([k, v]) => `<span><i style="background:${KIND_COLOR[k]}"></i>${KINDS[k]} <b>${Math.round(v / A * 100)}%</b></span>`).join("") : "";

    const pts = series.filter((s) => s.n != null);
    if (pts.length >= 2) {
      lineChart($("nwChart"), {
        labels: pts.map((s) => fmt(s.m + "-01", { month: "short", year: "2-digit" }).replace(".", "")),
        series: [{ name: "Nettoformue", color: "#3987e5", values: pts.map((s) => s.n) }],
        fmt: kr, showTip: ctx.showTip, hideTip: ctx.hideTip, zeroBased: false, height: 160,
      });
    } else $("nwChart").innerHTML = state.assets.length ? `<p class="note">Udviklingen vises, når du har opdateret værdierne over et par måneder.</p>` : "";

    const row = (a) => `<div class="list-row" data-id="${a.id}">
      <div><div>${esc(a.name)}</div><div class="sub">${KINDS[a.kind]}${a.rate != null ? ` · ${String(a.rate).replace(".", ",")}%` : ""}${a.monthly_payment ? ` · ydelse ${kr(a.monthly_payment)}/md.` : ""}</div></div>
      <div style="text-align:right"><div class="num">${kr(a.value)}</div><button class="ghost small edit" style="padding:2px 6px">Opdater</button></div></div>`;
    $("assetSum").textContent = kr(A);
    $("debtSum").textContent = kr(Dt);
    $("assetList").innerHTML = assets().map(row).join("") || `<p class="empty">Ingen aktiver endnu.</p>`;
    $("debtList").innerHTML = debts().map(row).join("") || `<p class="empty">Ingen gæld registreret.</p>`;
    root.querySelectorAll("#assetList .edit, #debtList .edit").forEach((b) => b.onclick = () => editAsset(state.assets.find((a) => String(a.id) === b.closest(".list-row").dataset.id)));

    // Gæld: hvornår er den betalt, og hvad koster renterne?
    if (debts().length) {
      const lines = debts().map((d) => {
        const n = monthsToPayoff(d.value, d.rate, d.monthly_payment);
        if (!d.monthly_payment) return "";
        if (n === Infinity) return `<div class="note"><span class="up">${esc(d.name)}: ydelsen dækker ikke renterne</span> – gælden vokser.</div>`;
        const interest = n * d.monthly_payment - d.value;
        const done = addMonths(todayIso().slice(0, 7), n);
        return `<div class="note">${esc(d.name)}: betalt ${fmt(done + "-01", { month: "long", year: "numeric" })} (${n} mdr.) · renter i alt ca. ${kr(interest)}</div>`;
      }).join("");
      const top = [...debts()].filter((d) => d.rate).sort((a, b) => b.rate - a.rate)[0];
      $("debtList").insertAdjacentHTML("beforeend", `<div style="margin-top:8px;display:grid;gap:4px">${lines}
        ${debts().length > 1 && top ? `<div class="note">Tip: Betal ekstra af på <b>${esc(top.name)}</b> først – den har den højeste rente (${String(top.rate).replace(".", ",")}%).</div>` : ""}</div>`);
    }

    // Investeringer: afkast og fremskrivning
    const inv = assets().filter((a) => a.kind === "investment" || a.kind === "pension");
    $("invCard").classList.toggle("hidden", !inv.length);
    $("invSum").textContent = inv.length ? kr(sum(inv)) : "";
    $("invList").innerHTML = inv.map((a) => {
      const ret = a.invested ? a.value - a.invested : null;
      const first = state.history.find((h) => String(h.asset_id) === String(a.id));
      const since = first && first.value && first.recorded_on < todayIso() ? (a.value - first.value) / first.value * 100 : null;
      const in10 = a.rate ? a.value * Math.pow(1 + a.rate / 100, 10) : null;
      return `<div class="list-row"><div><div>${esc(a.name)}</div><div class="sub">
          ${ret != null ? `Afkast <span class="${ret >= 0 ? "down" : "up"}">${ret >= 0 ? "+" : "−"}${kr(Math.abs(ret))} (${pct(ret / a.invested * 100)})</span> af ${kr(a.invested)} indskudt` : "Angiv indskudt beløb for at se afkast"}
          ${since != null ? ` · ${pct(since)} siden ${fmt(first.recorded_on, { month: "short", year: "numeric" })}` : ""}
          ${in10 ? `<br>Om 10 år ved ${String(a.rate).replace(".", ",")}% om året: ca. ${kr(in10)} (uden nye indskud)` : ""}</div></div>
        <div class="num">${kr(a.value)}</div></div>`;
    }).join("");
  }

  async function editAsset(a) {
    const isNew = !a;
    const v = await formDialog({
      title: isNew ? "Tilføj aktiv eller gæld" : `Opdater ${a.name}`,
      intro: isNew ? "Fx lønkonto, aktiedepot, pension, bolig, bil – eller billån og kreditkort." : "Opdatér værdien jævnligt (fx hver måned), så udviklingen kan vises.",
      fields: [
        { name: "name", label: "Navn", value: a?.name, required: true },
        { name: "kind", label: "Type", type: "select", value: a?.kind ?? "cash", options: Object.entries(KINDS).map(([k, l]) => [k, (DEBT.has(k) ? "Gæld: " : "") + l]) },
        { name: "value", label: "Værdi / restgæld (kr.)", type: "number", value: a?.value, required: true, half: true, min: 0 },
        { name: "rate", label: "Rente eller forventet afkast (% pr. år)", type: "number", value: a?.rate, half: true, step: "0.01" },
        { name: "monthly_payment", label: "Ydelse pr. måned (kun gæld)", type: "number", value: a?.monthly_payment, half: true, min: 0 },
        { name: "invested", label: "Indskudt i alt (kun investering)", type: "number", value: a?.invested, half: true, min: 0 },
      ],
      submitLabel: isNew ? "Tilføj" : "Gem", danger: isNew ? null : "Slet",
    });
    if (!v) return;
    if (v.__danger) {
      if (!confirm(`Slet "${a.name}" og dens historik?`)) return;
      const { error } = await sb.from("assets").delete().eq("id", a.id);
      if (error) return toast("Fejl: " + error.message);
    } else {
      const row = { ...v, updated_at: new Date().toISOString() };
      const { data, error } = isNew ? await sb.from("assets").insert(row).select().single() : await sb.from("assets").update(row).eq("id", a.id).select().single();
      if (error) return toast("Fejl: " + error.message);
      await sb.from("asset_history").upsert({ asset_id: data.id, value: v.value, recorded_on: todayIso() }, { onConflict: "asset_id,recorded_on" });
    }
    await ctx.loadPlan(); render();
  }

  // ---------- Opsparingsmål ----------
  function renderGoals() {
    const today = todayIso();
    $("goalList").innerHTML = state.goals.map((g) => {
      const left = Math.max(0, g.target_amount - g.saved_amount);
      const frac = g.saved_amount / g.target_amount;
      const done = left <= 0;
      let status = "", pill = "";
      if (done) { status = "Målet er nået!"; pill = `<span class="pill good">Nået</span>`; }
      else {
        const eta = g.monthly_amount > 0 ? Math.ceil(left / g.monthly_amount) : null;
        const etaMonth = eta ? addMonths(today.slice(0, 7), eta) : null;
        if (g.target_date) {
          const monthsLeft = Math.max(1, (new Date(g.target_date) - new Date(today)) / (30.44 * 864e5));
          const need = left / monthsLeft;
          const onTrack = g.monthly_amount && g.monthly_amount >= need * 0.98;
          pill = onTrack ? `<span class="pill good">På sporet</span>` : `<span class="pill warn">Bagud</span>`;
          status = `Kræver ${kr(need)}/md. for at nå det ${fmt(g.target_date, { month: "short", year: "numeric" })}` +
            (g.monthly_amount ? ` · du sparer ${kr(g.monthly_amount)}/md.` : "");
        } else if (etaMonth) status = `Nås ca. ${fmt(etaMonth + "-01", { month: "long", year: "numeric" })} med ${kr(g.monthly_amount)}/md.`;
        else status = "Angiv et månedligt beløb for at se, hvornår målet nås.";
      }
      return `<div class="sub-card" data-id="${g.id}">
        <div class="row" style="gap:12px">${ring(frac, done ? "#5fd39a" : "#3987e5", Math.min(100, Math.round(frac * 100)) + "%")}
          <div style="min-width:0;flex:1"><div class="row between" style="gap:6px"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.icon ? esc(g.icon) + " " : ""}${esc(g.name)}</b>${pill}</div>
            <div class="num">${kr(g.saved_amount)} <span class="muted small">af ${kr(g.target_amount)}</span></div>
            ${!done ? `<div class="small muted">Mangler ${kr(left)}</div>` : ""}</div></div>
        <div class="note">${status}</div>
        <div class="row" style="gap:6px"><button class="small primary dep">+ Indbetal</button><button class="small ghost edit">Rediger</button></div>
      </div>`;
    }).join("") || `<p class="empty">Ingen mål endnu. Opret fx "Buffer", "Ferie" eller "Ny bil".</p>`;
    root.querySelectorAll("#goalList .sub-card").forEach((c) => {
      const g = state.goals.find((x) => String(x.id) === c.dataset.id);
      c.querySelector(".dep").onclick = () => deposit(g);
      c.querySelector(".edit").onclick = () => editGoal(g);
    });
  }

  async function deposit(g) {
    const v = await formDialog({ title: `Indbetal til ${g.name}`, fields: [
      { name: "amount", label: "Beløb (kr.) – brug minus for at hæve", type: "number", required: true, value: g.monthly_amount ?? "" }], submitLabel: "Indbetal" });
    if (!v?.amount) return;
    const saved = Math.max(0, g.saved_amount + v.amount);
    const { error } = await sb.from("goals").update({ saved_amount: saved }).eq("id", g.id);
    if (error) return toast("Fejl: " + error.message);
    const before = g.saved_amount; g.saved_amount = saved;
    if (before < g.target_amount && saved >= g.target_amount) toast(`Tillykke – du har nået målet "${g.name}"!`, 5000);
    else toast(`${kr(v.amount)} indbetalt.`);
    render();
  }

  async function editGoal(g) {
    const isNew = !g;
    const v = await formDialog({
      title: isNew ? "Nyt opsparingsmål" : `Rediger ${g.name}`,
      fields: [
        { name: "name", label: "Navn", value: g?.name, required: true, placeholder: "Fx Ferie i Japan" },
        { name: "icon", label: "Ikon (valgfrit, en emoji)", value: g?.icon, half: true },
        { name: "target_date", label: "Dato for målet (valgfrit)", type: "date", value: g?.target_date, half: true },
        { name: "target_amount", label: "Mål (kr.)", type: "number", value: g?.target_amount, required: true, half: true, min: 1 },
        { name: "saved_amount", label: "Sparet indtil nu (kr.)", type: "number", value: g?.saved_amount ?? 0, half: true, min: 0 },
        { name: "monthly_amount", label: "Jeg sparer op pr. måned (kr.)", type: "number", value: g?.monthly_amount, min: 0, hint: "Bruges til at beregne, hvornår målet nås." },
      ],
      submitLabel: isNew ? "Opret" : "Gem", danger: isNew ? null : "Slet",
    });
    if (!v) return;
    let error;
    if (v.__danger) { if (!confirm(`Slet målet "${g.name}"?`)) return; ({ error } = await sb.from("goals").delete().eq("id", g.id)); }
    else ({ error } = isNew ? await sb.from("goals").insert({ ...v, saved_amount: v.saved_amount ?? 0 }) : await sb.from("goals").update({ ...v, saved_amount: v.saved_amount ?? 0 }).eq("id", g.id));
    if (error) return toast("Fejl: " + error.message);
    await ctx.loadPlan(); render();
  }

  // ---------- Spareudfordringer ----------
  const spentIn = (catId, m) => ctx.sumOut(ctx.monthTx(m).filter((t) => String(t.category_id) === String(catId)));
  function renderChallenges() {
    const now = todayIso().slice(0, 7);
    const current = state.challenges.filter((c) => c.month === now);
    const past = state.challenges.filter((c) => c.month < now).slice(0, 6);
    const f = ctx.elapsed(now);
    $("chList").innerHTML = current.map((c) => {
      const spent = spentIn(c.category_id, c.month);
      const left = c.limit_amount - spent;
      const cls = spent > c.limit_amount ? "bad" : spent > c.limit_amount * f * 1.05 ? "warn" : "good";
      const lbl = { bad: "Overskredet", warn: "Hold igen", good: "På sporet" }[cls];
      const daysLeft = ctx.daysInMonth(now) - +todayIso().slice(8);
      return `<div class="list-row" data-id="${c.id}" style="grid-template-columns:1fr">
        <div class="row between"><span>${esc(c.title)}</span><span class="pill ${cls}">${lbl}</span></div>
        <div class="pbar"><div style="width:${Math.min(100, spent / Math.max(1, c.limit_amount) * 100)}%;background:${cls === "bad" ? "var(--red)" : cls === "warn" ? "var(--warn)" : "var(--green)"}"></div>
          <span class="mark" style="left:${f * 100}%" title="Så langt er måneden"></span></div>
        <div class="row between small muted"><span>${kr(spent)} brugt af ${kr(c.limit_amount)}</span>
          <span>${left >= 0 ? `${kr(left)} tilbage · ${daysLeft} dage` : `${kr(-left)} over`} <button class="ghost small del" style="padding:0 6px" title="Fjern">✕</button></span></div>
      </div>`;
    }).join("") || `<p class="empty">Ingen udfordringer i denne måned.</p>`;
    root.querySelectorAll("#chList .del").forEach((b) => b.onclick = async () => {
      const id = b.closest(".list-row").dataset.id;
      const { error } = await sb.from("challenges").delete().eq("id", id);
      if (error) return toast("Fejl: " + error.message);
      state.challenges = state.challenges.filter((c) => String(c.id) !== id); render();
    });

    // Forslag: de største variable kategorier, brug 15 % mindre end normalt
    const prevM = ctx.prevMonthsWithData(now);
    const fixedCat = /bolig|forsikring|abonnement|forsyning|løn|indkomst/i;
    const sugg = state.cats.filter((c) => c.kind === "expense" && !fixedCat.test(c.name) && !current.some((x) => String(x.category_id) === String(c.id)))
      .map((c) => ({ c, avg: ctx.avgOf(prevM.map((m) => spentIn(c.id, m))) }))
      .filter((x) => x.avg >= 300).sort((a, b) => b.avg - a.avg).slice(0, 3);
    $("chSuggest").innerHTML = sugg.length ? `<div class="small muted" style="margin-bottom:6px">Forslag til denne måned</div>` + sugg.map(({ c, avg }) => {
      const limit = Math.max(50, Math.round(avg * 0.85 / 50) * 50);
      return `<div class="list-row"><div><div>Brug højst ${kr(limit)} på ${esc(c.name)}</div><div class="sub">Du bruger normalt ${kr(avg)} – det sparer ca. ${kr(avg - limit)}</div></div>
        <button class="small start" data-cat="${c.id}" data-limit="${limit}">Start</button></div>`;
    }).join("") : "";
    root.querySelectorAll("#chSuggest .start").forEach((b) => b.onclick = () => createChallenge(+b.dataset.cat, +b.dataset.limit));

    $("chHistory").innerHTML = past.length ? `<div class="small muted" style="margin-bottom:6px">Tidligere udfordringer</div>` + past.map((c) => {
      const spent = spentIn(c.category_id, c.month), ok = spent <= c.limit_amount;
      return `<div class="list-row"><div><div>${esc(c.title)}</div><div class="sub">${fmt(c.month + "-01", { month: "long", year: "numeric" })} · brugte ${kr(spent)}</div></div>
        <span class="pill ${ok ? "good" : "bad"}">${ok ? "Klaret" : "Ikke klaret"}</span></div>`;
    }).join("") : "";
  }

  async function createChallenge(catId, limit) {
    const cat = ctx.catById(catId);
    const { error } = await sb.from("challenges").insert({ title: `Brug højst ${kr(limit)} på ${cat.name.toLowerCase()}`, category_id: catId, limit_amount: limit, month: todayIso().slice(0, 7) });
    if (error) return toast("Fejl: " + error.message);
    await ctx.loadPlan(); render(); toast("Udfordringen er startet – held og lykke!");
  }

  $("addAsset").onclick = () => editAsset(null);
  $("addGoal").onclick = () => editGoal(null);
  $("addChallenge").onclick = async () => {
    const cats = state.cats.filter((c) => c.kind === "expense");
    const v = await formDialog({ title: "Ny spareudfordring", intro: "Sæt et loft over, hvor meget du vil bruge på en kategori i denne måned.", fields: [
      { name: "cat", label: "Kategori", type: "select", options: cats.map((c) => [c.id, c.name]) },
      { name: "limit", label: "Brug højst (kr.)", type: "number", required: true, min: 0 }], submitLabel: "Start" });
    if (v?.cat && v.limit != null) createChallenge(+v.cat, v.limit);
  };

  function render() {
    $("planMissing").classList.toggle("hidden", state.planReady);
    root.querySelectorAll("button").forEach((b) => { if (!state.planReady && b.closest(".card") !== $("planMissing")) b.disabled = true; else b.disabled = false; });
    renderNetWorth();
    renderGoals();
    renderChallenges();
  }
  return { render };
}
