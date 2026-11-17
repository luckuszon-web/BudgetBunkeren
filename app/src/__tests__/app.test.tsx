// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { RepositoryError } from "@/services";
import { sampleData } from "@/features/__tests__/fixtures";

afterEach(cleanup);
window.scrollTo = (() => {}) as typeof window.scrollTo;

function setup(path = "/", { signedIn = true, mfa = false } = {}) {
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
    createRuleAndReclassify: vi.fn(),
  };
  const history = createMemoryHistory({ initialEntries: [path] });
  render(<App services={{ auth, repo } as never} history={history} today={() => "2026-11-16"} />);
  return { auth, repo };
}

describe("Ny app", () => {
  it("log ind: forkert adgangskode giver besked, rigtig viser Overblik", async () => {
    const { auth } = setup("/", { signedIn: false });
    fireEvent.change(await screen.findByLabelText("E-mail"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Adgangskode"), { target: { value: "forkert" } });
    fireEvent.click(screen.getByRole("button", { name: "Log ind" }));
    expect((await screen.findByRole("alert")).textContent).toMatch("Forkert e-mail");
    fireEvent.change(screen.getByLabelText("Adgangskode"), { target: { value: "rigtig" } });
    fireEvent.click(screen.getByRole("button", { name: "Log ind" }));
    expect(await screen.findByRole("heading", { name: "Overblik" })).toBeTruthy();
    expect(auth.signIn).toHaveBeenCalledTimes(2);
  });

  it("totrinsbekræftelse kræver koden", async () => {
    const { auth } = setup("/", { mfa: true });
    fireEvent.change(await screen.findByLabelText("6-cifret kode"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Bekræft" }));
    expect(await screen.findByRole("heading", { name: "Overblik" })).toBeTruthy();
    expect(auth.verifyMfa).toHaveBeenCalledWith("123456");
  });

  it("Overblik viser disponibelt, score, advarsler og prognose", async () => {
    setup("/");
    expect(await screen.findByText("Til rådighed resten af måneden")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Økonomisk score \d+ af 100/ })).toBeTruthy();
    expect(screen.getByText(/Restaurant er .* over budget/)).toBeTruthy();
    expect(screen.getByText("Prognose for december")).toBeTruthy();
  });

  it("Budget: viser bjælker og gemmer et nyt budget", async () => {
    const { repo } = setup("/budget");
    const bar = await screen.findByRole("progressbar", { name: /Restaurant: \d+ % brugt/ });
    expect(Number(bar.getAttribute("aria-valuenow"))).toBeGreaterThan(100);
    fireEvent.click(screen.getByRole("button", { name: "Ret budget for Restaurant" }));
    fireEvent.change(screen.getByLabelText("Budget pr. måned (kr.)"), { target: { value: "1.000" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem" })); });
    expect(repo.saveCategory).toHaveBeenCalledWith(expect.objectContaining({ id: "2", monthly_budget: 1000, budget_week: false }));
  });

  it("Posteringer: søg, giv kategori og del en postering op", async () => {
    const { repo } = setup("/posteringer");
    fireEvent.change(await screen.findByLabelText("Søg i posteringer"), { target: { value: "wolt" } });
    const select = (await screen.findAllByLabelText(/Kategori for Wolt/))[0]!;
    await act(async () => { fireEvent.change(select, { target: { value: "2" } }); });
    expect(repo.saveTransaction).toHaveBeenCalledWith({ id: expect.any(String), category_id: "2" });

    fireEvent.change(screen.getByLabelText("Søg i posteringer"), { target: { value: "netto" } });
    fireEvent.click((await screen.findAllByRole("button", { name: /^Del .*Netto/i }))[0]!);
    const dlg = screen.getByRole("dialog", { name: "Del postering op" });
    fireEvent.change(within(dlg).getByLabelText("Kategori for del 1"), { target: { value: "2" } });
    fireEvent.change(within(dlg).getByLabelText("Beløb for del 1"), { target: { value: "500" } });
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Gem" })); });
    expect(repo.saveSplits).toHaveBeenCalledWith(expect.any(String), [{ category_id: "2", amount: -500 }]);
  });

  it("Værktøjer: skat og annuitet regner med det samme", async () => {
    setup("/vaerktoejer");
    expect(await screen.findByText("Udbetalt pr. måned (ca.)")).toBeTruthy();
    expect(screen.getByText("1.061 kr.")).toBeTruthy();   // 100.000 kr., 5 %, 10 år
    fireEvent.change(screen.getByLabelText(/^Ekstra afdrag pr\. måned/), { target: { value: "500" } });
    expect(screen.getByText(/Gældfri \d+ mdr\. før/)).toBeTruthy();
  });
});
