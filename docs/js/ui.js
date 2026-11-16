// Fælles byggeklodser til fanerne: formular-dialog, linjediagram og fremskridtsring.

const style = document.createElement("style");
style.textContent = `
  .f-dialog form { display: grid; gap: 10px; }
  .f-dialog .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .f-dialog label span { display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px; }
  .f-dialog select { width: 100%; }
  .f-dialog .hint { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .lc svg { width: 100%; display: block; overflow: visible; }
  .lc text { fill: var(--muted); font-size: 11px; font-family: inherit; }
  .lc .legend { margin-bottom: 6px; }
  .list-row { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; padding: 10px 0; border-top: 1px solid var(--line); align-items: center; }
  .list-row:first-child { border-top: 0; }
  .list-row .sub { font-size: 12.5px; color: var(--muted); }
  .list-row .act { display: flex; gap: 6px; }
  .list-row .act button { padding: 5px 10px; font-size: 13px; }
  .pill { display: inline-block; font-size: 11.5px; padding: 1px 8px; border-radius: 99px; border: 1px solid var(--line); color: var(--muted); }
  .pill.good { color: var(--green); border-color: var(--good-soft); } .pill.warn { color: var(--warn); border-color: var(--warn-soft); } .pill.bad { color: var(--red); border-color: var(--bad-soft); }
  .big { font-size: 30px; font-weight: 750; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
  .pbar { height: 8px; background: var(--track); border-radius: 4px; overflow: hidden; position: relative; }
  .pbar > div { height: 100%; border-radius: 4px; background: var(--accent); }
  .pbar .mark { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text); opacity: .7; border-radius: 1px; }
  .empty { color: var(--muted); font-size: 14px; padding: 6px 0; }
  .grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(230px, 100%), 1fr)); gap: 10px; }
  .sub-card { min-width: 0; grid-template-columns: minmax(0, 1fr); }
  .sub-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: grid; gap: 8px; }
  .kv { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; font-size: 14px; }
  .kv > :nth-child(even) { text-align: right; font-variant-numeric: tabular-nums; }
  .note { font-size: 12.5px; color: var(--muted); }
`;
document.head.appendChild(style);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Viser en formular i en dialog og returnerer værdierne (eller null ved annuller).
 * fields: [{ name, label, type: text|number|date|select|checkbox, value, options: [[value, label]], hint, half, required, step, min }]
 */
export function formDialog({ title, intro = "", fields, submitLabel = "Gem", danger = null }) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "f-dialog";
    const field = (f) => {
      const id = "f_" + f.name;
      let input;
      if (f.type === "select") input = `<select id="${id}" name="${f.name}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(f.value ?? "") ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
      else if (f.type === "checkbox") return `<label class="row small" style="gap:8px"><input type="checkbox" id="${id}" name="${f.name}" style="width:auto" ${f.value ? "checked" : ""}> ${esc(f.label)}</label>`;
      else input = `<input id="${id}" name="${f.name}" type="${f.type ?? "text"}" value="${esc(f.value ?? "")}" ${f.required ? "required" : ""}
        ${f.type === "number" ? `inputmode="decimal" step="${f.step ?? "any"}" ${f.min !== undefined ? `min="${f.min}"` : ""}` : ""} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""}>`;
      return `<label><span>${esc(f.label)}</span>${input}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ""}</label>`;
    };
    // To halve felter efter hinanden lægges side om side
    let html = "";
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].half && fields[i + 1]?.half) { html += `<div class="grid2">${field(fields[i])}${field(fields[i + 1])}</div>`; i++; }
      else html += field(fields[i]);
    }
    dlg.innerHTML = `<form method="dialog">
      <p style="margin:0"><b>${esc(title)}</b></p>
      ${intro ? `<p class="small muted" style="margin:0">${intro}</p>` : ""}
      ${html}
      <div class="actions">
        ${danger ? `<button value="danger" class="danger" formnovalidate style="margin-right:auto">${esc(danger)}</button>` : ""}
        <button value="cancel" formnovalidate>Annuller</button>
        <button value="ok" class="primary">${esc(submitLabel)}</button>
      </div></form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener("close", () => {
      const rv = dlg.returnValue;
      const out = {};
      for (const f of fields) {
        const el = dlg.querySelector("#f_" + f.name);
        if (f.type === "checkbox") out[f.name] = el.checked;
        else if (f.type === "number") out[f.name] = el.value === "" ? null : Number(el.value.replace(",", "."));
        else out[f.name] = el.value.trim() === "" ? null : el.value.trim();
      }
      dlg.remove();
      resolve(rv === "ok" ? out : rv === "danger" ? { __danger: true } : null);
    });
    dlg.showModal();
    dlg.querySelector("input, select")?.focus();
  });
}

/**
 * Linjediagram i SVG med tooltip.
 * series: [{ name, color, values: number[], dashed?, until? }]  labels: string[] (x-akse)  fmt: værdi -> tekst
 */
export function lineChart(el, { labels, series, fmt, height = 180, showTip, hideTip, zeroBased = true, refLines = [] }) {
  const W = Math.max(280, el.clientWidth || 600), H = height, padL = 6, padR = 52, padT = 10, padB = 22;
  const all = series.flatMap((s) => s.values.filter((v) => v != null)).concat(refLines.map((r) => r.value));
  let min = zeroBased ? Math.min(0, ...all) : Math.min(...all), max = Math.max(...all, 1);
  if (min === max) { max += 1; }
  const span = max - min; max += span * 0.06; if (!zeroBased || min < 0) min -= span * 0.06;
  const L = labels.length;
  const x = (i) => padL + (L === 1 ? (W - padL - padR) / 2 : (i / (L - 1)) * (W - padL - padR));
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const short = (v) => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace(".", ",") + " mio." : Math.abs(v) >= 1000 ? Math.round(v / 1000) + "k" : Math.round(v);
  const ticks = [0, 0.33, 0.66, 1].map((f) => min + (max - min) * f);
  const grid = ticks.map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/>
    <text x="${W - padR + 6}" y="${y(v) + 4}">${short(v)}</text>`).join("");
  const every = Math.ceil(L / 7);
  const xl = labels.map((l, i) => ((i % every === 0 && L - 1 - i >= every) || i === L - 1) ? `<text x="${x(i)}" y="${H - 5}" text-anchor="middle">${esc(l)}</text>` : "").join("");
  const path = (vals) => vals.map((v, i) => v == null ? null : [i, v]).filter(Boolean).map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const lines = series.map((s) => {
    const pts = s.values.map((v, i) => [i, v]).filter(([, v]) => v != null);
    const last = pts[pts.length - 1];
    return `<path d="${path(s.values)}" fill="none" stroke="${s.color}" stroke-width="${s.dashed ? 2 : 2.5}" ${s.dashed ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round" stroke-linecap="round"/>
      ${last && !s.dashed ? `<circle cx="${x(last[0])}" cy="${y(last[1])}" r="4.5" fill="${s.color}" style="stroke:var(--card)" stroke-width="2"/>` : ""}`;
  }).join("");
  const refs = refLines.map((r) => `<line x1="${padL}" x2="${W - padR}" y1="${y(r.value)}" y2="${y(r.value)}" stroke="${r.color}" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="${padL + 2}" y="${y(r.value) - 5}" style="fill:${r.color}">${esc(r.label)}</text>`).join("");
  const legend = series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>` : "";
  el.classList.add("lc");
  el.innerHTML = `${legend}<svg viewBox="0 0 ${W} ${H}" style="height:${H}px" role="img">${grid}${xl}${refs}${lines}
    <line class="cross" x1="0" x2="0" y1="${padT}" y2="${H - padB}" style="stroke:var(--muted)" visibility="hidden"/>
    <rect class="hit" x="0" y="0" width="${W}" height="${H}" fill="transparent"/></svg>`;
  const svg = el.querySelector("svg"), cross = el.querySelector(".cross"), hit = el.querySelector(".hit");
  const move = (cx) => {
    const r = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(L - 1, Math.round(((cx - r.left) * (W / r.width) - padL) / (W - padL - padR) * (L - 1))));
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
    showTip?.(`<div style="margin-bottom:3px">${esc(labels[i])}</div>` + series.filter((s) => s.values[i] != null)
      .map((s) => `<div><i style="background:${s.color}"></i>${esc(s.name)} <b>${fmt(s.values[i])}</b></div>`).join(""), r.left + x(i) * (r.width / W), r.top + 10);
  };
  const leave = () => { cross.setAttribute("visibility", "hidden"); hideTip?.(); };
  hit.onmousemove = (e) => move(e.clientX); hit.onmouseleave = leave;
  hit.ontouchstart = (e) => move(e.touches[0].clientX); hit.ontouchmove = (e) => move(e.touches[0].clientX);
  hit.ontouchend = () => setTimeout(leave, 1500);
}

/** Fremskridtsring (0-1) som SVG-tekst. */
export function ring(frac, color, label, size = 64) {
  const r = 26, C = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="32" cy="32" r="${r}" fill="none" style="stroke:var(--track)" stroke-width="7"/>
    <circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C * f} ${C}" transform="rotate(-90 32 32)"/>
    <text x="32" y="36" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--text)">${esc(label)}</text></svg>`;
}

/** Månedlig ydelse på et annuitetslån. */
export function annuity(principal, ratePct, months) {
  const r = ratePct / 100 / 12;
  if (!months) return 0;
  return r ? principal * r / (1 - Math.pow(1 + r, -months)) : principal / months;
}

/** Antal måneder til gælden er betalt (Infinity hvis ydelsen ikke dækker renten). */
export function monthsToPayoff(balance, ratePct, payment) {
  const r = (ratePct || 0) / 100 / 12;
  if (balance <= 0) return 0;
  if (!payment || payment <= balance * r) return Infinity;
  return r ? Math.ceil(-Math.log(1 - r * balance / payment) / Math.log(1 + r)) : Math.ceil(balance / payment);
}
