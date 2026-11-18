/** Bankadgang (PSD2-samtykke) udløber typisk efter 180 dage. Find den bank, der snart skal fornyes. */
import type { BankSession } from "@/types/plan";

export interface Renewal { bank: string; validUntil: string; daysLeft: number; expired: boolean }
export const RENEW_WARN_DAYS = 14;

/** Seneste forbindelse pr. bank, der er udløbet eller udløber inden for 14 dage (mest presserende først). */
export function renewalsDue(sessions: readonly BankSession[], now = Date.now()): Renewal[] {
  const latest = new Map<string, BankSession>();
  for (const s of sessions) { const cur = latest.get(s.bank); if (!cur || s.valid_until > cur.valid_until) latest.set(s.bank, s); }
  return [...latest.values()].map((s) => {
    const ms = Date.parse(s.valid_until) - now;
    return { bank: s.bank, validUntil: s.valid_until, daysLeft: Math.max(0, Math.ceil(ms / 864e5)), expired: ms <= 0 };
  }).filter((r) => r.expired || r.daysLeft <= RENEW_WARN_DAYS).sort((a, b) => a.validUntil.localeCompare(b.validUntil));
}
