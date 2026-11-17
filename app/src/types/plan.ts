/** Domænetyper til Planlæg, indstillinger og fælles post (supplerer types/finance.ts). */
import type { Asset, Dkk, IsoDate, PotItem, PotMember, SavingsGoal, SharedPot, YearMonth } from "./finance";

export interface AssetPoint { asset_id: string; value: Dkk; date: IsoDate }
export interface Challenge { id: string; title: string; category_id: string | null; limit_amount: Dkk; month: YearMonth }
export interface PlanData { goals: SavingsGoal[]; assets: Asset[]; history: AssetPoint[]; challenges: Challenge[] }

export interface BankSession { id: string; bank: string; valid_until: string }
export interface PotData { pot: SharedPot; members: PotMember[]; items: (PotItem & { tx_id?: string | null; note?: string | null })[] }
export interface Invite { code: string; used_at: string | null; used_by_email?: string | null; expires_at: string }
export interface CredentialsStatus { available: boolean; owner: boolean; own: boolean; app_id: string | null; since: string | null }
