/**
 * Zod-skemaer til Planlæg (mål, formue, udfordringer), fælles post og indstillinger.
 * Samme princip som schemas.ts: rækker valideres og oversættes ind, input valideres før det skrives.
 */
import { z } from "zod";
import type { Asset, PotItem, SavingsGoal } from "@/types/finance";
import type { AssetPoint, BankSession, Challenge } from "@/types/plan";
import { dbId, id, isoDate, money, optId, safeText, yearMonth } from "./schemas";

const ASSET_KINDS = ["cash", "investment", "pension", "property", "vehicle", "other", "loan", "mortgage", "credit"] as const;
const amount = (max = 100_000_000) => z.number().finite().min(0, "Beløbet kan ikke være negativt").max(max, "Beløbet er urealistisk stort");
const optMoney = money.nullish().transform((v) => v ?? null);

// ---------- Rækker ----------
export const GoalRow = z.object({
  id, name: z.string(), icon: z.string().nullish(), target_amount: money, saved_amount: money.nullish(), monthly_amount: optMoney,
  target_date: isoDate.nullish(), linked_category_id: optId, linked_since: isoDate.nullish(),
}).transform((r): SavingsGoal => ({ id: r.id, name: r.name, icon: r.icon ?? null, target_amount: r.target_amount, saved_amount: r.saved_amount ?? 0,
  monthly_amount: r.monthly_amount, target_date: r.target_date ?? null, linked_category_id: r.linked_category_id, linked_since: r.linked_since ?? null }));

export const AssetRow = z.object({ id, name: z.string(), kind: z.enum(ASSET_KINDS), value: money, rate: optMoney, monthly_payment: optMoney, invested: optMoney })
  .transform((r): Asset => r);

export const AssetHistoryRow = z.object({ asset_id: id, value: money, recorded_on: isoDate })
  .transform((r): AssetPoint => ({ asset_id: r.asset_id, value: r.value, date: r.recorded_on }));

export const ChallengeRow = z.object({ id, title: z.string(), category_id: optId, limit_amount: money, month: yearMonth })
  .transform((r): Challenge => r);

export const SessionRow = z.object({ id: z.string(), aspsp_name: z.string(), valid_until: z.string() })
  .transform((r): BankSession => ({ id: r.id, bank: r.aspsp_name, valid_until: r.valid_until }));

export const PotRow = z.object({ id, name: z.string(), created_by: z.string(), owner_pct: money });
export const PotMemberRow = z.object({ pot_id: id, user_id: z.string(), name: z.string() });
export const PotItemRow = z.object({
  id, user_id: z.string(), kind: z.enum(["expense", "settle"]), item_date: isoDate, amount: money, description: z.string(),
  category: z.string().nullish(), tx_id: z.string().nullish(), note: z.string().nullish(),
}).transform((r): PotItem & { tx_id: string | null; note: string | null } => ({ ...r, category: r.category ?? null, tx_id: r.tx_id ?? null, note: r.note ?? null }));

// ---------- Input ----------
export const GoalInput = z.object({
  id: dbId.optional(),
  name: safeText(60).pipe(z.string().min(1, "Målet skal have et navn")),
  icon: safeText(8).nullable().optional(),
  target_amount: amount().refine((v) => v > 0, "Målet skal være større end 0 kr."),
  saved_amount: amount().optional(),
  monthly_amount: amount(10_000_000).nullable().optional(),
  target_date: isoDate.nullable().optional(),
  linked_category_id: dbId.nullable().optional(),
  linked_since: isoDate.nullable().optional(),
}).strict();
export type GoalDraft = z.input<typeof GoalInput>;

export const AssetInput = z.object({
  id: dbId.optional(),
  name: safeText(60).pipe(z.string().min(1, "Skriv et navn")),
  kind: z.enum(ASSET_KINDS),
  value: amount(),
  rate: z.number().finite().min(-100).max(100).nullable().optional(),
  monthly_payment: amount(10_000_000).nullable().optional(),
  invested: amount().nullable().optional(),
}).strict();
export type AssetDraft = z.input<typeof AssetInput>;

export const ChallengeInput = z.object({
  title: safeText(80).pipe(z.string().min(1, "Skriv en titel")),
  category_id: dbId.nullable(),
  limit_amount: amount(10_000_000),
  month: yearMonth,
}).strict();
export type ChallengeDraft = z.input<typeof ChallengeInput>;

export const PotItemInput = z.object({
  pot_id: dbId,
  kind: z.enum(["expense", "settle"]),
  item_date: isoDate,
  amount: amount(10_000_000).refine((v) => v > 0, "Beløbet skal være større end 0"),
  description: safeText(120).pipe(z.string().min(1, "Skriv en tekst")),
  category: safeText(60).nullable().optional(),
  tx_id: z.string().max(200).nullable().optional(),
}).strict();
export type PotItemDraft = z.input<typeof PotItemInput>;

export const AccountNameInput = safeText(60);
export const EmailInput = z.string().trim().toLowerCase().email("Skriv en gyldig e-mail");
export const PemInput = z.string().max(20_000, "Filen er for stor til at være en .pem-nøgle").refine((s) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s), "Filen ligner ikke en .pem-nøgle");
export const AppIdInput = z.string().trim().regex(/^[0-9a-f-]{8,64}$/i, "Application ID ser forkert ud");
