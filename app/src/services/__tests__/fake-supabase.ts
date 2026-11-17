/**
 * Falsk Supabase i hukommelsen til tests. Efterligner det vigtigste fra databasen:
 * - Row Level Security: man ser og ændrer kun rækker med sit eget user_id.
 * - Kolonnerettigheder på transactions: kun category_id, category_source, one_off og note må ændres; ingen sletning/indsættelse.
 * - user_id sættes automatisk ved indsættelse (default auth.uid()), og id'er tildeles.
 */
type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;
const TX_UPDATABLE = new Set(["category_id", "category_source", "one_off", "note"]);

export function createFakeSupabase(tables: Record<string, Row[]>, userId: string) {
  let nextId = 1000;
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  const denied = (msg: string) => ({ data: null, error: { code: "42501", message: msg } });

  function builder(table: string) {
    const rows = (tables[table] ??= []);
    let op: "select" | "update" | "insert" | "delete" = "select";
    let conflict: string[] | null = null;   // upsert: kolonner, der afgør "samme række"
    let payload: Row | Row[] | null = null;
    const filters: Filter[] = [(r) => !("user_id" in r) || r.user_id === userId];   // RLS
    let range: [number, number] | null = null, single = false, orderCol: string | null = null, asc = true;

    const exec = () => {
      if (op === "insert") {
        if (table === "transactions") return denied("permission denied for table transactions");
        const list: Row[] = (Array.isArray(payload) ? payload : [payload!]).map((p) => ({ id: nextId++, user_id: userId, ...p }));
        if (conflict) for (const r of list) { const i = rows.findIndex((x) => conflict!.every((c) => String(x[c]) === String(r[c]))); if (i >= 0) rows.splice(i, 1); }
        rows.push(...list); calls.push({ table, op, payload });
        return finish(list);
      }
      let hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "update") {
        if (table === "transactions" && Object.keys(payload as Row).some((k) => !TX_UPDATABLE.has(k))) return denied("permission denied for column");
        hit.forEach((r) => Object.assign(r, payload)); calls.push({ table, op, payload });
        return finish(hit);
      }
      if (op === "delete") {
        if (table === "transactions") return denied("permission denied for table transactions");
        for (const r of hit) rows.splice(rows.indexOf(r), 1);
        calls.push({ table, op });
        return finish(hit);
      }
      if (orderCol) hit = [...hit].sort((a, b) => (String(a[orderCol!]) < String(b[orderCol!]) ? -1 : String(a[orderCol!]) > String(b[orderCol!]) ? 1 : 0) * (asc ? 1 : -1));
      if (range) hit = hit.slice(range[0], range[1] + 1);
      return finish(hit);
    };
    const finish = (list: Row[]) => {
      if (!single) return { data: list.map((r) => ({ ...r })), error: null };
      return list.length === 1 ? { data: { ...list[0] }, error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } };
    };
    const b: Record<string, unknown> = {
      select: () => b,
      insert: (p: Row | Row[]) => { op = "insert"; payload = p; return b; },
      upsert: (p: Row | Row[], o?: { onConflict?: string }) => { op = "insert"; payload = p; conflict = (o?.onConflict ?? "id").split(",").map((x) => x.trim()); return b; },
      update: (p: Row) => { op = "update"; payload = p; return b; },
      delete: () => { op = "delete"; return b; },
      eq: (c: string, v: unknown) => { filters.push((r) => String(r[c]) === String(v)); return b; },
      neq: (c: string, v: unknown) => { filters.push((r) => String(r[c]) !== String(v)); return b; },
      gte: (c: string, v: unknown) => { filters.push((r) => String(r[c]) >= String(v)); return b; },
      lte: (c: string, v: unknown) => { filters.push((r) => String(r[c]) <= String(v)); return b; },
      in: (c: string, vs: unknown[]) => { const s = new Set(vs.map(String)); filters.push((r) => s.has(String(r[c]))); return b; },
      order: (c: string, o?: { ascending?: boolean }) => { if (!orderCol) { orderCol = c; asc = o?.ascending ?? true; } return b; },
      range: (a: number, z: number) => { range = [a, z]; return b; },
      single: () => { single = true; return b; },
      maybeSingle: () => { single = true; return b; },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(exec()).then(res, rej),
    };
    return b;
  }
  return { client: { from: builder } as never, tables, calls };
}
