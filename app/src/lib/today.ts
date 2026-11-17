/** Dagens dato/måned i lokal tid (UI-hjælpere; beregningsmotoren får datoen udefra). */
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const currentMonth = () => todayIso().slice(0, 7);
export const monthName = (ym: string, withYear = true) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("da-DK", { month: "long", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
