/**
 * FinanceRepository – det ENESTE sted, appen taler med Supabase om økonomidata.
 * Komponenter og state-laget kalder kun metoderne her; de ser aldrig databasens kolonnenavne eller rå Supabase-kald.
 *
 * Sikkerhed:
 * - Al adgang går gennem databasens Row Level Security (auth.uid() = user_id). Hent-forespørgsler filtrerer desuden
 *   på user_id (forsvar i dybden), så rækker fra andre aldrig blandes ind.
 * - Alt, der skrives, valideres med Zod først; alt, der læses, valideres og oversættes til domænetyper.
 * - Bankposteringer kan kun få ændret kategori, engangskøb og note (databasen tillader ikke mere).
 *   Beløb, dato og tekst kommer fra banken og kan hverken ændres eller slettes herfra.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import type { Category, CategoryRule, IsoDate, ManualEntry, Transaction, TxSplit } from "@/types/finance";
import { matchesRule } from "@/lib/finance-engine";
import {
  AccountRow, CategoryInput, CategoryRow, ManualEntryInput, ManualRow, RuleKeywordInput, RuleRow, SplitRow, TransactionPatchInput,
  TransactionRow, parseRows, validateSplits, type Account, type CategoryDraft, type TransactionPatch,
} from "./schemas";
import type { OfflineCache } from "./offline-cache";

// ---------- Fejl ----------
export type RepositoryErrorCode = "validation" | "permission" | "not_found" | "missing_migration" | "network" | "forbidden_operation" | "unknown";
export class RepositoryError extends Error {
  override name = "RepositoryError";
  constructor(message: string, public readonly code: RepositoryErrorCode, public override readonly cause?: unknown) { super(message); }
}
/** Oversætter Supabase-/Zod-/netværksfejl til en dansk besked med en kode, UI'et kan reagere på. */
export function toRepositoryError(e: unknown): RepositoryError {
  if (e instanceof RepositoryError) return e;
  if (e instanceof ZodError) return new RepositoryError(e.issues[0]?.message ?? "Ugyldige data", "validation", e);
  const err = e as { code?: string; message?: string } | null;
  const msg = err?.message ?? String(e);
  if (err?.code === "42501" || /permission denied|row-level security/i.test(msg)) return new RepositoryError("Du har ikke adgang til at gøre det.", "permission", e);
  if (err?.code === "42703" || err?.code === "PGRST204" || err?.code === "42P01" || /column .* does not exist|could not find the .* column|relation .* does not exist/i.test(msg))
    return new RepositoryError("Databasen mangler en opdatering – kør opdater.html.", "missing_migration", e);
  if (err?.code === "PGRST116") return new RepositoryError("Fandt ikke det, der skulle ændres.", "not_found", e);
  if (/failed to fetch|network|fetch failed/i.test(msg)) return new RepositoryError("Ingen forbindelse til serveren.", "network", e);
  return new RepositoryError(msg, "unknown", e);
}
type Result<T> = { data: T | null; error: unknown };
function must<T>(r: Result<T>): T { if (r.error) throw toRepositoryError(r.error); return r.data as T; }

// ---------- Typer ----------
export interface Period { from: IsoDate; to: IsoDate }
export interface UserData {
  categories: Category[];
  rules: CategoryRule[];
  transactions: Transaction[];
  splits: TxSplit[];
  manualEntries: ManualEntry[];
  accounts: Account[];
  /** Rækker, der ikke bestod valideringen (bør være 0). */
  rejected: number;
  fetchedAt: string;
}

const PAGE = 1000;   // Supabase returnerer højst 1000 rækker pr. kald
const isManualId = (id: string) => /^manual-\d+$/.test(id);

export function createFinanceRepository(sb: SupabaseClient, cache?: OfflineCache<UserData>) {
  /** Henter alle rækker i bidder á 1000. */
  async function fetchPaged(build: (from: number, to: number) => PromiseLike<Result<unknown[]>>): Promise<unknown[]> {
    const out: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const rows = must(await build(from, from + PAGE - 1)) ?? [];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }
  const run = async <T>(fn: () => Promise<T>): Promise<T> => { try { return await fn(); } catch (e) { throw toRepositoryError(e); } };

  return {
    /** Alle brugerens data for en periode. Posteringer på skjulte konti udelades. Gemmes i offline-cachen. */
    fetchAllUserData: (userId: string, period: Period): Promise<UserData> => run(async () => {
      const [cats, rules, txs, splits, manual, accounts] = await Promise.all([
        sb.from("categories").select("*").eq("user_id", userId).order("name"),
        fetchPaged((a, b) => sb.from("rules").select("id, pattern, category_id, priority").eq("user_id", userId).order("id").range(a, b)),
        fetchPaged((a, b) => sb.from("transactions").select("*").eq("user_id", userId).gte("booking_date", period.from).lte("booking_date", period.to)
          .order("booking_date", { ascending: false }).order("id").range(a, b)),
        sb.from("tx_splits").select("id, tx_id, category_id, amount").eq("user_id", userId),
        sb.from("manual_income").select("*").eq("user_id", userId).gte("pay_date", period.from).lte("pay_date", period.to),
        sb.from("accounts").select("*").eq("user_id", userId),
      ]);
      const C = parseRows(CategoryRow, must(cats as Result<unknown[]>)), R = parseRows(RuleRow, rules), T = parseRows(TransactionRow, txs);
      // Tabeller fra senere databaseopdateringer må gerne mangle (så er listen bare tom)
      const S = parseRows(SplitRow, (splits as Result<unknown[]>).error ? [] : (splits as Result<unknown[]>).data);
      const M = parseRows(ManualRow, (manual as Result<unknown[]>).error ? [] : (manual as Result<unknown[]>).data);
      const A = parseRows(AccountRow, must(accounts as Result<unknown[]>));
      const hidden = new Set(A.items.filter((a) => a.hidden).map((a) => a.id));
      const data: UserData = {
        categories: C.items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "da")),
        rules: R.items, transactions: T.items.filter((t) => !t.account_id || !hidden.has(t.account_id)),
        splits: S.items, manualEntries: M.items, accounts: A.items,
        rejected: C.rejected + R.rejected + T.rejected + S.rejected + M.rejected + A.rejected, fetchedAt: new Date().toISOString(),
      };
      await cache?.save(userId, data);
      return data;
    }),

    /** De sidst hentede data fra enheden (til øjeblikkelig visning ved start og uden net). */
    loadCached: async (userId: string) => (await cache?.load(userId))?.data ?? null,
    clearCache: async () => { await cache?.clearAll(); },

    /**
     * Gemmer det, man må ændre på en bankpostering: kategori, engangskøb og note.
     * Sættes en kategori, markeres den som dit eget valg (så automatikken ikke overskriver den).
     */
    saveTransaction: (patch: TransactionPatch): Promise<void> => run(async () => {
      const p = TransactionPatchInput.parse(patch);
      if (isManualId(p.id)) throw new RepositoryError("Indtastede beløb gemmes med saveManualEntry.", "forbidden_operation");
      const row: Record<string, unknown> = {};
      if (p.category_id !== undefined) { row.category_id = p.category_id == null ? null : Number(p.category_id); row.category_source = p.category_id == null ? null : "manual"; }
      if (p.one_off !== undefined) row.one_off = p.one_off;
      if (p.notes !== undefined) row.note = p.notes || null;
      if (!Object.keys(row).length) return;
      must(await sb.from("transactions").update(row).eq("id", p.id).select("id").single());
    }),

    /** Samme ændring på mange bankposteringer (Vælg flere) – i bidder á 100. Kun kategori og engangskøb. */
    saveTransactionsBulk: (ids: string[], patch: { category_id?: string | null; one_off?: boolean }): Promise<number> => run(async () => {
      const bank = ids.filter((x) => !isManualId(x));
      if (bank.length > 5000) throw new RepositoryError("For mange posteringer på én gang.", "validation");
      const p = TransactionPatchInput.parse({ id: "bulk", ...patch });
      const row: Record<string, unknown> = {};
      if (p.category_id !== undefined) { row.category_id = p.category_id == null ? null : Number(p.category_id); row.category_source = p.category_id == null ? null : "manual"; }
      if (p.one_off !== undefined) row.one_off = p.one_off;
      if (!Object.keys(row).length || !bank.length) return 0;
      for (let i = 0; i < bank.length; i += 100) must(await sb.from("transactions").update(row).in("id", bank.slice(i, i + 100)));
      return bank.length;
    }),

    /** Opretter et indtastet beløb (løn eller kontantkøb). */
    saveManualEntry: (input: unknown): Promise<ManualEntry> => run(async () => {
      const e = ManualEntryInput.parse(input);
      const row = { pay_date: e.pay_date, amount: e.amount, direction: e.direction, category_id: e.category_id ? Number(e.category_id) : null, note: e.note || null };
      return ManualRow.parse(must(await sb.from("manual_income").insert(row).select("*").single()));
    }),

    /** Sletter en postering – kun indtastede beløb. Bankposteringer kan ikke slettes (de kommer fra banken). */
    deleteTransaction: (id: string): Promise<void> => run(async () => {
      if (!isManualId(id)) throw new RepositoryError("Posteringer fra banken kan ikke slettes. Giv den kategorien Ignoreret i stedet, hvis den ikke skal tælle med.", "forbidden_operation");
      must(await sb.from("manual_income").delete().eq("id", Number(id.slice(7))).select("id").single());
    }),

    /**
     * Erstatter opdelingen af en postering. Beløbet hentes fra databasen (ikke fra appen), og delene valideres:
     * samme fortegn som posteringen, og tilsammen højst posteringens beløb. Tom liste = fjern opdelingen.
     */
    saveSplits: (txId: string, splits: { category_id: string; amount: number }[]): Promise<TxSplit[]> => run(async () => {
      const tx = must(await sb.from("transactions").select("id, amount").eq("id", txId).single()) as { amount: number | string };
      const parts = validateSplits(Number(tx.amount), splits);
      must(await sb.from("tx_splits").delete().eq("tx_id", txId));
      if (!parts.length) return [];
      const rows = must(await sb.from("tx_splits").insert(parts.map((p) => ({ tx_id: txId, category_id: Number(p.category_id), amount: p.amount }))).select("id, tx_id, category_id, amount"));
      return parseRows(SplitRow, rows as unknown[]).items;
    }),

    /** Opretter eller retter en kategori. */
    saveCategory: (draft: CategoryDraft): Promise<Category> => run(async () => {
      const c = CategoryInput.parse(draft);
      const row: Record<string, unknown> = { name: c.name, kind: c.kind };
      if (c.icon !== undefined) row.icon = c.icon || null;
      if (c.monthly_budget !== undefined) row.monthly_budget = c.monthly_budget || null;
      if (c.budget_week !== undefined) row.budget_week = c.budget_week;
      if (c.rollover_from !== undefined) row.rollover_from = c.rollover_from;
      const res = c.id ? await sb.from("categories").update(row).eq("id", Number(c.id)).select("*").single() : await sb.from("categories").insert(row).select("*").single();
      return CategoryRow.parse(must(res));
    }),

    /**
     * Opretter din egen regel (prioritet 200) og giver alle dine posteringer, der matcher, kategorien –
     * undtagen dem, du selv har valgt kategori til.
     */
    createRuleAndReclassify: (userId: string, keyword: string, categoryId: string): Promise<{ rule: CategoryRule; updated: number }> => run(async () => {
      const pattern = RuleKeywordInput.parse(keyword).toLowerCase();
      if (!/^\d{1,18}$/.test(categoryId)) throw new RepositoryError("Ugyldig kategori.", "validation");
      const rule = RuleRow.parse(must(await sb.from("rules").insert({ pattern, category_id: Number(categoryId), priority: 200 }).select("id, pattern, category_id, priority").single()));
      const rows = await fetchPaged((a, b) => sb.from("transactions").select("id, description, counterparty, category_source").eq("user_id", userId).order("id").range(a, b));
      const ids = (rows as { id: string; description: string; counterparty: string | null; category_source: string | null }[])
        .filter((r) => r.category_source !== "manual" && matchesRule({ text: r.description, counterparty: r.counterparty }, pattern)).map((r) => r.id);
      for (let i = 0; i < ids.length; i += 100) {
        must(await sb.from("transactions").update({ category_id: Number(categoryId), category_source: "rule" }).in("id", ids.slice(i, i + 100)));
      }
      return { rule, updated: ids.length };
    }),
  };
}
export type FinanceRepository = ReturnType<typeof createFinanceRepository>;
