// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setup } from "./app-setup";

afterEach(cleanup);

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
    expect(screen.getAllByText(/Restaurant er .* over budget/).length).toBe(2);   // advarsel øverst + indsigt
    expect(screen.getByRole("region", { name: "Advarsler" })).toBeTruthy();
    expect(screen.getByText("Prognose for december")).toBeTruthy();
    // Nøgletal + score med gæld/formue fra Planlæg (falske data: konto 20.000, billån 5.000 til 5 % = ikke dyr gæld)
    expect(await screen.findByText("Ingen dyr gæld")).toBeTruthy();
    expect(screen.getByText("Nøgletal")).toBeTruthy();
    expect(screen.getByTestId("kpi-networth").textContent).toMatch(/15\.000/);
    fireEvent.click(screen.getByTestId("kpi-buffer"));
    expect(screen.getByRole("region", { name: "Om Buffer" }).textContent).toMatch(/uforudsete udgifter/);
    fireEvent.click(screen.getByRole("button", { name: "Luk forklaring" }));
    expect(screen.queryByRole("region", { name: "Om Buffer" })).toBeNull();
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
    // Uden redigering kan kategorien ikke ændres
    expect(screen.queryAllByLabelText(/Kategori for Wolt/)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Rediger" }));
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
    fireEvent.click(await screen.findByRole("tab", { name: "Løn og skat" }));
    expect(await screen.findByText("Udbetalt pr. måned (ca.)")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Afdrag" }));
    expect(screen.getByText("1.061 kr.")).toBeTruthy();   // 100.000 kr., 5 %, 10 år
    fireEvent.change(screen.getByLabelText(/^Ekstra afdrag pr\. måned/), { target: { value: "500" } });
    expect(screen.getByText(/Gældfri \d+ mdr\. før/)).toBeTruthy();
  });
});
