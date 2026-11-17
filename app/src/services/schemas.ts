/**
 * Zod-skemaer: grænsen mellem databasen og domænet.
 *
 * - `*Row`-skemaer validerer rækker FRA Supabase og oversætter databasens kolonner til domænetyperne
 *   (booking_date → date, description → text, account_uid → account_id, note → notes, tx_id → transaction_id,
 *   bigint-id → streng, Postgres-numeric (der kommer som tekst) → tal).
 * - `*Input`-skemaer validerer det, appen vil SKRIVE, før det sendes. Ugyldige eller skadelige data
 *   (forkerte typer, kontroltegn, absurde beløb, for lange tekster) afvises med en dansk fejl.
 *
 * Databasens Row Level Security er den egentlige sikkerhed; skemaerne er et ekstra lag og sikrer gyldige data.
 */
import { z } from "zod";
import type { Category, CategoryRule, ManualEntry, Transaction, TxSplit } from "@/types/finance";

// ---------- Byggesten ----------
export const id = z.union([z.string(), z.number()]).transform((v) => String(v)).pipe(z.string().min(1).max(200));
export const optId = z.union([z.string(), z.number()]).nullish().transform((v) => (v == null ? null : String(v)));
/** Postgres numeric kommer som tekst – omdan til et endeligt tal. */
export const money = z.union([z.number(), z.string()]).transform((v) => Number(v)).pipe(z.number().finite());
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Ugyldig dato").transform((s) => s.slice(0, 10));
export const yearMonth = z.string().regex(/^\d{4}-\d{2}$/, "Ugyldig måned");
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
/** Tekst fra brugeren: trimmet, uden kontroltegn og med en maksimal længde. */
export const safeText = (max: number) => z.string().trim().max(max, `Højst ${max} tegn`).refine((s) => !CONTROL.test(s), "Teksten indeholder ugyldige tegn");
const CATEGORY_KINDS = ["expense", "income", "transfer", "oneoff", "ignore"] as const;

// ---------- Rækker fra databasen → domæne ----------
export const CategoryRow = z.object({
  id, user_id: z.string().optional(), name: z.string(), kind: z.enum(CATEGORY_KINDS),
  icon: z.string().nullish(), monthly_budget: money.nullish(), budget_week: z.boolean().nullish(), rollover_from: yearMonth.nullish(),
}).transform((r): Category => ({
  id: r.id, ...(r.user_id ? { user_id: r.user_id } : {}), name: r.name, kind: r.kind, ...(r.icon ? { icon: r.icon } : {}),
  monthly_budget: r.monthly_budget ?? 0, budget_week: !!r.budget_week, rollover_from: r.rollover_from ?? null,
}));

export const RuleRow = z.object({ id, pattern: z.string(), category_id: id, priority: z.number().int() })
  .transform((r): CategoryRule => r);

export const TransactionRow = z.object({
  id, user_id: z.string().optional(), account_uid: z.string().nullish(), booking_date: isoDate, amount: money,
  description: z.string(), counterparty: z.string().nullish(), category_id: optId,
  category_source: z.enum(["rule", "ai", "manual"]).nullish(), one_off: z.boolean().nullish(), note: z.string().nullish(),
}).transform((r): Transaction => ({
  id: r.id, ...(r.user_id ? { user_id: r.user_id } : {}), account_id: r.account_uid ?? null, date: r.booking_date, text: r.description,
  amount: r.amount, category_id: r.category_id, notes: r.note ?? null, counterparty: r.counterparty ?? null,
  category_source: r.category_source ?? null, one_off: !!r.one_off,
}));

export const SplitRow = z.object({ id, tx_id: id, category_id: optId, amount: money })
  .transform((r): TxSplit => ({ id: r.id, transaction_id: r.tx_id, category_id: r.category_id ?? "", amount: r.amount }));

export const ManualRow = z.object({
  id, pay_date: isoDate, amount: money, category_id: optId, note: z.string().nullish(), direction: z.enum(["in", "out"]).nullish(),
}).transform((r): ManualEntry => ({ id: r.id, pay_date: r.pay_date, amount: r.amount, direction: r.direction ?? "in", category_id: r.category_id, note: r.note ?? null }));

export const AccountRow = z.object({
  uid: z.string(), account_key: z.string().nullish(), name: z.string().nullish(), display_name: z.string().nullish(),
  hidden: z.boolean().nullish(), iban_last4: z.string().nullish(), last_synced_at: z.string().nullish(), session_id: z.string().nullish(),
}).transform((r) => ({ id: r.uid, key: r.account_key ?? r.uid, name: r.display_name || r.name || "Konto", hidden: !!r.hidden,
  last4: r.iban_last4 ?? null, lastSyncedAt: r.last_synced_at ?? null, connected: !!r.session_id }));
export type Account = z.output<typeof AccountRow>;

export const CadenceRow = z.object({ key: z.string().min(1).max(200), cadence: z.enum(["quarterly", "halfyear", "annual"]) });
/** Validerer en liste rækker; ugyldige rækker springes over (og tælles), så én dårlig række ikke vælter appen. */
export function parseRows<S extends z.ZodTypeAny>(schema: S, rows: unknown[] | null | undefined): { items: z.output<S>[]; rejected: number } {
  const items: z.output<S>[] = [];
  let rejected = 0;
  for (const r of rows ?? []) {
    const p = schema.safeParse(r);
    if (p.success) items.push(p.data); else rejected++;
  }
  return { items, rejected };
}

// ---------- Input (det appen skriver) ----------
/** Database-id for en kategori (bigint) – kommer som streng i domænet. */
export const dbId = z.string().regex(/^\d{1,18}$/, "Ugyldigt id");

/** Det, browseren MÅ ændre på en bankpostering (resten kommer fra banken og er låst af databasen). */
export const TransactionPatchInput = z.object({
  id: z.string().min(1).max(200),
  category_id: dbId.nullable().optional(),
  one_off: z.boolean().optional(),
  notes: safeText(500).nullable().optional(),
}).strict();
export type TransactionPatch = z.input<typeof TransactionPatchInput>;

/** Et beløb, du selv taster ind (løn eller kontantkøb). */
export const ManualEntryInput = z.object({
  pay_date: isoDate,
  amount: z.number().finite().positive("Beløbet skal være større end 0").max(10_000_000, "Beløbet er urealistisk stort"),
  direction: z.enum(["in", "out"]),
  category_id: dbId.nullable().optional(),
  note: safeText(120).nullable().optional(),
}).strict();

export const SplitInput = z.object({ category_id: dbId, amount: z.number().finite().refine((v) => v !== 0, "En del kan ikke være 0 kr.") }).strict();
/** Delene skal have samme fortegn som posteringen og tilsammen højst være posteringens beløb. */
export function validateSplits(txAmount: number, splits: unknown[]): { category_id: string; amount: number }[] {
  const parts = z.array(SplitInput).max(20, "Højst 20 dele").parse(splits);
  for (const p of parts) if (Math.sign(p.amount) !== Math.sign(txAmount)) throw new z.ZodError([{ code: "custom", path: ["amount"], message: "Delene skal have samme fortegn som posteringen" }]);
  const total = parts.reduce((s, p) => s + Math.abs(p.amount), 0);
  if (total - Math.abs(txAmount) > 0.005) throw new z.ZodError([{ code: "custom", path: ["amount"], message: "Delene er tilsammen større end posteringen" }]);
  return parts;
}

export const CategoryInput = z.object({
  id: dbId.optional(),
  name: safeText(60).pipe(z.string().min(1, "Kategorien skal have et navn")),
  kind: z.enum(CATEGORY_KINDS),
  icon: safeText(8).nullable().optional(),
  monthly_budget: z.number().finite().min(0, "Budget kan ikke være negativt").max(10_000_000).optional(),
  budget_week: z.boolean().optional(),
  rollover_from: yearMonth.nullable().optional(),
}).strict();
export type CategoryDraft = z.input<typeof CategoryInput>;

/** Søgeord til en regel: mindst 2 tegn efter trim (korte ord rammer for bredt). */
export const RuleKeywordInput = safeText(60).pipe(z.string().min(2, "Søgeordet skal være mindst 2 tegn"));

/** Markering af en regnings hyppighed (null = fjern). */
export const CadenceInput = z.object({
  key: z.string().trim().min(1, "Ukendt modtager").max(200),
  cadence: z.enum(["quarterly", "halfyear", "annual"]).nullable(),
}).strict();
