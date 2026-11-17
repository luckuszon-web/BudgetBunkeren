import { render } from "@testing-library/react";
import { createMemoryHistory } from "@tanstack/react-router";
import { vi } from "vitest";
import { App } from "@/App";
import type { BootParams } from "@/lib/boot-params";
import { RepositoryError } from "@/services";
import { sampleData } from "@/features/__tests__/fixtures";

window.scrollTo = (() => {}) as typeof window.scrollTo;
window.confirm = () => true;

/** Hele appen med falske services (ingen Supabase) og en hukommelses-historik. */
export function setup(path = "/", { signedIn = true, mfa = false, boot }: { signedIn?: boolean; mfa?: boolean; boot?: BootParams } = {}) {
  let user = signedIn ? { id: "me", email: "me@example.com" } : null;
  const auth = {
    currentUser: vi.fn(async () => user),
    signIn: vi.fn(async (e: string, p: string) => { if (p !== "rigtig") throw new RepositoryError("Forkert e-mail eller adgangskode.", "permission"); user = { id: "me", email: e }; return user; }),
    signOut: vi.fn(async () => { user = null; }),
    needsMfa: vi.fn(async () => mfa),
    verifyMfa: vi.fn(async (c: string) => { if (c !== "123456") throw new RepositoryError("Forkert kode – prøv igen.", "permission"); mfa = false; }),
    onChange: vi.fn(() => () => {}),
  };
  const repo = {
    fetchAllUserData: vi.fn(async () => sampleData()),
    loadCached: vi.fn(async () => null),
    saveTransaction: vi.fn(async () => {}),
    saveSplits: vi.fn(async (id: string, parts: { category_id: string; amount: number }[]) => parts.map((p, i) => ({ id: `s${i}`, transaction_id: id, ...p }))),
    saveCategory: vi.fn(async (d: { id?: string; name: string; kind: "expense"; monthly_budget?: number }) => ({ id: d.id ?? "77", name: d.name, kind: d.kind, monthly_budget: d.monthly_budget ?? 0 })),
    createRuleAndReclassify: vi.fn(async (_u: string, kw: string, cat: string) => ({ rule: { id: "r9", pattern: kw, category_id: cat, priority: 200 }, updated: 1 })),
    saveTransactionsBulk: vi.fn(async (ids: string[]) => ids.length),
    saveManualEntry: vi.fn(async (e: { pay_date: string; amount: number; direction: "in" | "out" }) => ({ id: "m1", category_id: null, note: null, ...e })),
    deleteTransaction: vi.fn(async () => {}),
  };
  const plan = {
    fetchPlan: vi.fn(async () => ({
      goals: [{ id: "g1", name: "Ferie", target_amount: 10000, saved_amount: 2000, monthly_amount: 1000 }],
      assets: [{ id: "a1", name: "Lønkonto", kind: "cash", value: 20000 }, { id: "a2", name: "Billån", kind: "loan", value: 5000, rate: 5, monthly_payment: 1000 }],
      history: [], challenges: [],
    })),
    saveGoal: vi.fn(async (g: object) => g), deleteGoal: vi.fn(), saveAsset: vi.fn(async (a: object) => a), deleteAsset: vi.fn(),
    saveChallenge: vi.fn(async (c: object) => ({ id: "c1", ...c })), deleteChallenge: vi.fn(),
  };
  let pot: unknown = null;
  const pots = { fetchPot: vi.fn(async () => pot), addItem: vi.fn(async () => {}), deleteItem: vi.fn(async () => {}) };
  const server = {
    potCreate: vi.fn(async () => { pot = { pot: { id: "1", name: "Hjemme", created_by: "me", owner_pct: 50 }, members: [{ user_id: "me", name: "Mig" }, { user_id: "p", name: "Partner" }],
      items: [{ id: "i1", user_id: "p", kind: "expense", item_date: "2026-11-10", amount: 1000, description: "Netto", category: "Dagligvarer" }] }; return {}; }),
    potDelete: vi.fn(), banks: vi.fn(async () => ["Nordea"]), startBank: vi.fn(), disconnect: vi.fn(), deleteAccounts: vi.fn(async () => 1),
    credentialsStatus: vi.fn(async () => ({ available: true, owner: true, own: false, app_id: null, since: null })), saveCredentials: vi.fn(),
    removeCredentials: vi.fn(), listInvites: vi.fn(async () => ({ owner: true, invites: [] })), createInvite: vi.fn(async () => "ABCDE-FGHJK"),
    advisor: vi.fn(async () => "Du har brugt **mere** på restaurant.\n- Spar på Wolt"), syncNow: vi.fn(async () => ({})), finishBank: vi.fn(async () => 2), register: vi.fn(async () => ({})), recategorize: vi.fn(async () => ({ result: { updated: 3 } })), advisorPing: vi.fn(),
  };
  const settings = { subMarks: vi.fn(async () => ({})), markSub: vi.fn(async () => {}), sessions: vi.fn(async () => []), renameAccount: vi.fn(), setAccountHidden: vi.fn(), deleteCategory: vi.fn(async () => 2), deleteRule: vi.fn() };
  const history = createMemoryHistory({ initialEntries: [path] });
  const authAll = Object.assign(auth, { userInfo: vi.fn(async () => ({ email: "me@example.com", lastSignIn: null })), mfaEnabled: vi.fn(async () => false),
    mfaEnroll: vi.fn(), mfaConfirm: vi.fn(), mfaDisable: vi.fn(), changePassword: vi.fn(async () => {}), resetPassword: vi.fn(async () => {}) });
  render(<App services={{ auth, repo, plan, pots, server, settings } as never} history={history} today={() => "2026-11-16"} boot={boot} />);
  return { auth: authAll, repo, plan, pots, server, settings };
}

