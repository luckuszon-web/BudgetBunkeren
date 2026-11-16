// Fanen "Rådgiver": stil spørgsmål om din økonomi. Svarene kommer fra Claude via serverfunktionen "advisor".

const SUGGESTIONS = [
  "Hvorfor har jeg brugt mere denne måned?",
  "Hvor kan jeg spare 1.000 kr. om måneden?",
  "Hvordan når jeg mine opsparingsmål hurtigere?",
  "Hvilke abonnementer og faste udgifter bør jeg se på?",
  "Er min økonomi sund? Giv mig de tre vigtigste råd.",
];

export function init(ctx, root) {
  const { state, esc, kr, todayIso, addMonths, monthTx, totals, toast } = ctx;
  let messages = [];
  try { messages = JSON.parse(localStorage.getItem("advisorChat") || "[]"); } catch {}
  const save = () => { try { localStorage.setItem("advisorChat", JSON.stringify(messages.slice(-20))); } catch {} };

  root.innerHTML = `
    <div class="card">
      <div class="head"><h2>Spørg om din økonomi</h2><button class="ghost small" id="advClear">Ny samtale</button></div>
      <p class="note" style="margin-top:0">Rådgiveren ser et sammendrag af dine tal (pr. måned og kategori, faste udgifter, budgetter, mål og formue) – ikke de enkelte posteringer.
        Svarene er vejledende og kan indeholde fejl.</p>
      <div id="advLog" class="adv-log"></div>
      <div id="advSugg" class="adv-sugg"></div>
      <form id="advForm" class="adv-form">
        <textarea id="advInput" rows="2" placeholder="Skriv et spørgsmål…" maxlength="2000"></textarea>
        <button class="primary" id="advSend">Send</button>
      </form>
    </div>`;
  const $ = (id) => root.querySelector("#" + id);

  const style = document.createElement("style");
  style.textContent = `
    .adv-log { display: grid; gap: 10px; margin: 8px 0 12px; }
    .msg { padding: 10px 12px; border-radius: 12px; font-size: 14.5px; line-height: 1.5; max-width: 92%; white-space: normal; }
    .msg.user { background: var(--accent-soft); justify-self: end; border-bottom-right-radius: 4px; }
    .msg.assistant { background: var(--surface); border: 1px solid var(--line); justify-self: start; border-bottom-left-radius: 4px; }
    .msg.error { border-color: var(--bad-soft); color: var(--red); }
    .msg ul { margin: 6px 0; padding-left: 18px; } .msg p { margin: 0 0 8px; } .msg p:last-child { margin: 0; }
    .adv-sugg { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .adv-sugg button { font-size: 13px; padding: 6px 10px; border-radius: 99px; }
    .adv-form { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end; }
    .adv-form textarea { font: inherit; color: var(--text); background: var(--field); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; resize: vertical; width: 100%; }
    .typing { color: var(--muted); font-size: 13px; }
  `;
  document.head.appendChild(style);

  // Simpel og sikker formatering: **fed**, punktlister og afsnit (alt andet escapes)
  function format(text) {
    const lines = esc(text).split("\n");
    let html = "", list = false;
    for (const l of lines) {
      const li = l.match(/^\s*[-*•]\s+(.*)/) || l.match(/^\s*\d+[.)]\s+(.*)/);
      if (li) { if (!list) { html += "<ul>"; list = true; } html += `<li>${li[1]}</li>`; continue; }
      if (list) { html += "</ul>"; list = false; }
      if (l.trim()) html += `<p>${l}</p>`;
    }
    if (list) html += "</ul>";
    return html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^#+\s*/gm, "");
  }

  // Sammendrag af økonomien, som rådgiveren får med
  function buildContext() {
    const now = todayIso().slice(0, 7);
    const months = Array.from({ length: 7 }, (_, i) => addMonths(now, -6 + i)).filter((m) => monthTx(m).length);
    const catName = (id) => id == null ? "Uden kategori" : ctx.catById(id)?.name ?? "?";
    const perMonth = months.map((m) => {
      const rows = monthTx(m), t = totals(rows);
      const byCat = {};
      for (const x of rows) if (ctx.counts(x)) { const k = catName(ctx.effCat(x)) + (ctx.isInc(x) ? " (indtægt)" : ""); byCat[k] = Math.round((byCat[k] ?? 0) + x.amount); }
      return { måned: m, indtægter: Math.round(t.inc), udgifter: Math.round(t.out), sat_til_side: Math.round(t.saved), store_engangskøb_holdt_udenfor: Math.round(t.oneoff), pr_kategori: byCat,
        ...(m === now ? { bemærk: `igangværende måned, dag ${+todayIso().slice(8)} af ${ctx.daysInMonth(m)}` } : {}) };
    });
    const biggest = monthTx(now).filter((t) => t.amount < 0 && ctx.counts(t)).sort((a, b) => a.amount - b.amount).slice(0, 10)
      .map((t) => ({ dato: t.booking_date, tekst: t.counterparty || t.description, beløb: t.amount, kategori: catName(ctx.effCat(t)) }));
    return {
      i_dag: todayIso(),
      måneder: perMonth,
      største_udgifter_denne_måned: biggest,
      faste_udgifter: ctx.detectFixed(now).map((f) => ({ navn: f.name, kategori: catName(f.cat), pr_måned: Math.round(f.amount), trækdag: f.day })),
      budgetter: state.cats.filter((c) => Number(c.monthly_budget) > 0).map((c) => ({ kategori: c.name, budget: Number(c.monthly_budget), budget_inkl_overført: Math.round(ctx.monthBudget(c, now)) })),
      opsparingsmål: state.goals.map((g) => ({ navn: g.name, mål: g.target_amount, sparet: Math.round(ctx.goalSaved(g)), pr_måned: g.monthly_amount, dato: g.target_date })),
      aktiver: state.assets.filter((a) => !["loan", "mortgage", "credit"].includes(a.kind)).map((a) => ({ navn: a.name, type: a.kind, værdi: a.value, afkast_pct: a.rate, indskudt: a.invested })),
      gæld: state.assets.filter((a) => ["loan", "mortgage", "credit"].includes(a.kind)).map((a) => ({ navn: a.name, type: a.kind, restgæld: a.value, rente_pct: a.rate, ydelse: a.monthly_payment })),
      spareudfordringer: state.challenges.filter((c) => c.month === now).map((c) => ({ titel: c.title, loft: c.limit_amount })),
      opsparing_i_alt: Math.round(ctx.totalSaved()),
      bemærk: "Indbetalinger med en udgiftskategori (fx fremleje under Bolig) er modregnet i kategorien og tæller ikke som indtægt.",
      prognose_næste_måned: (() => { const f = ctx.forecastNextMonth(); return f && {
        måned: f.next, forventet_til_overs: Math.round(f.exp), svag_måned: Math.round(f.low), god_måned: Math.round(f.high),
        løn_skøn: Math.round(f.salExp), løn_laveste: Math.round(f.salStats.min || 0), løn_højeste: Math.round(f.salStats.max || 0), eget_lønskøn: f.own,
        faste_udgifter: Math.round(f.fixedSum), variabelt_forbrug_snit: Math.round(f.varAvg) }; })(),
    };
  }

  function renderLog(pending = false) {
    $("advLog").innerHTML = messages.map((m) => `<div class="msg ${m.role} ${m.error ? "error" : ""}">${m.role === "user" ? esc(m.content) : format(m.content)}</div>`).join("") +
      (pending ? `<div class="msg assistant typing">Tænker over dine tal…</div>` : "") +
      (!messages.length && !pending ? `<p class="empty">Stil et spørgsmål, eller vælg et af forslagene herunder.</p>` : "");
    $("advSugg").innerHTML = messages.length > 1 ? "" : SUGGESTIONS.map((s) => `<button type="button">${esc(s)}</button>`).join("");
    root.querySelectorAll("#advSugg button").forEach((b) => b.onclick = () => ask(b.textContent));
  }

  let busy = false;
  async function ask(q) {
    q = q.trim();
    if (!q || busy) return;
    if (!state.txs.length) return toast("Der er ingen posteringer endnu – rådgiveren har intet at regne på.");
    busy = true; $("advSend").disabled = true;
    messages.push({ role: "user", content: q }); $("advInput").value = "";
    renderLog(true);
    try {
      const r = await ctx.callFn("advisor", { messages: messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content })), context: buildContext() });
      messages.push({ role: "assistant", content: r.answer + (r.truncated ? "\n\n(Svaret blev afkortet.)" : "") });
    } catch (e) {
      const msg = /Failed to fetch|NetworkError|404|not found/i.test(e.message)
        ? "Rådgiveren er ikke sat op endnu. Den kræver, at serverfunktionerne er lagt op (README trin 5) og en ANTHROPIC_API_KEY i Supabase."
        : e.message;
      messages.push({ role: "assistant", content: msg, error: true });
    }
    busy = false; $("advSend").disabled = false;
    save(); renderLog();
    const last = root.querySelector(".msg:last-child"); last?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("advForm").onsubmit = (e) => { e.preventDefault(); ask($("advInput").value); };
  $("advInput").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask($("advInput").value); } };
  $("advClear").onclick = () => { messages = []; save(); renderLog(); };

  return { render: () => renderLog(), buildContext };
}
