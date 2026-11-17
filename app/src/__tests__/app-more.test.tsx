// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setup } from "./app-setup";

afterEach(cleanup);

describe("Ny app – resten", () => {
  it("Planlæg: nettoformue, mål og indbetaling", async () => {
    const { plan } = setup("/planlaeg");
    expect(await screen.findByText("15.000 kr.")).toBeTruthy();                 // 20.000 − 5.000
    expect(screen.getByText(/nås om 8 måneder/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Indbetal" }));
    fireEvent.change(screen.getByLabelText("Indbetal til Ferie"), { target: { value: "500" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Indbetal" })); });
    expect(plan.saveGoal).toHaveBeenCalledWith(expect.objectContaining({ id: "g1", saved_amount: 2500 }));
    expect(screen.getByText(/gældfri .* \(6 mdr\.\)/)).toBeTruthy();
  });

  it("Fælles post: opret og se balancen", async () => {
    const { server } = setup("/faelles");
    fireEvent.change(await screen.findByLabelText(/Partnerens e-mail/), { target: { value: "p@example.com" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Opret" })); });
    expect(server.potCreate).toHaveBeenCalledWith("p@example.com", 50, "Fælles husholdning");
    expect(await screen.findByText("Du skylder Partner")).toBeTruthy();
    expect(screen.getByText("500 kr.")).toBeTruthy();
  });

  it("Posteringer: vælg flere og kontant udgift", async () => {
    const { repo } = setup("/posteringer");
    fireEvent.click(await screen.findByRole("button", { name: "Vælg" }));
    const bar = screen.getByRole("region", { name: "Valgte posteringer" });
    fireEvent.click(within(bar).getByRole("button", { name: /Vælg alle/ }));
    await act(async () => { fireEvent.change(within(bar).getByLabelText("Giv de valgte kategori"), { target: { value: "2" } }); });
    expect(repo.saveTransactionsBulk).toHaveBeenCalledWith(expect.any(Array), { category_id: "2" });

    fireEvent.click(screen.getByRole("button", { name: "Kontant" }));
    const dlg = screen.getByRole("dialog", { name: "Kontant udgift" });
    fireEvent.change(within(dlg).getByLabelText("Beløb (kr.)"), { target: { value: "250" } });
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Gem" })); });
    expect(repo.saveManualEntry).toHaveBeenCalledWith(expect.objectContaining({ amount: 250, direction: "out" }));
  });

  it("Postering: note og regel fra detaljerne", async () => {
    const { repo } = setup("/posteringer");
    fireEvent.change(await screen.findByLabelText("Søg i posteringer"), { target: { value: "netflix" } });
    fireEvent.click((await screen.findAllByText(/netflix/i, { selector: "p" }))[0]!);
    const dlg = screen.getByRole("dialog", { name: "Postering" });
    fireEvent.change(within(dlg).getByLabelText("Note"), { target: { value: "Familiekonto" } });
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Færdig" })); });
    expect(repo.saveTransaction).toHaveBeenCalledWith(expect.objectContaining({ notes: "Familiekonto" }));
  });

  it("Indstillinger: kategorier kan slettes med flyt", async () => {
    const { settings } = setup("/indstillinger/kategorier");
    fireEvent.click(await screen.findByRole("button", { name: /^Restaurant/ }));
    const dlg = screen.getByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Slet" }));
    fireEvent.change(within(dlg).getByLabelText("Flyt til"), { target: { value: "1" } });
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Slet kategorien" })); });
    expect(settings.deleteCategory).toHaveBeenCalledWith("me", "2", "1");
  });

  it("Indstillinger: data kan kategoriseres igen", async () => {
    const { server } = setup("/indstillinger/data");
    const btn = await screen.findByRole("button", { name: "Kategorisér igen" });
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => expect(server.recategorize).toHaveBeenCalled());
    expect(await screen.findByText(/3 ændret/)).toBeTruthy();
  });

  it("Menuen har alle sider", async () => {
    setup("/");
    await screen.findByRole("heading", { name: "Overblik" });
    for (const n of ["Planlæg", "Fælles post", "Værktøjer", "Indstillinger"]) expect(screen.getAllByRole("link", { name: n }).length).toBeGreaterThan(0);
  });
});

describe("Posteringer: sortering", () => {
  it("største beløb først – og tilbage til nyeste først", async () => {
    setup("/posteringer");
    await screen.findByLabelText("Sortér posteringer");
    const amounts = () => screen.getAllByRole("listitem").map((li) => li.querySelector(".num")?.textContent ?? "").filter(Boolean);
    fireEvent.change(screen.getByLabelText("Sortér posteringer"), { target: { value: "amount-desc" } });
    expect(amounts()[0]).toBe("−11.250 kr.");
    fireEvent.change(screen.getByLabelText("Sortér posteringer"), { target: { value: "amount-asc" } });
    expect(amounts()[0]).toBe("−272 kr.");
    fireEvent.change(screen.getByLabelText("Sortér posteringer"), { target: { value: "date-desc" } });
    expect(amounts()[0]).toBe("+300 kr.");   // 8. nov. er nyest
  });
});

describe("Gæld", () => {
  it("kan tilføjes direkte fra kortet Gæld – afbetaling", async () => {
    const { plan } = setup("/planlaeg");
    fireEvent.click(await screen.findByRole("button", { name: "Tilføj gæld" }));
    const dlg = screen.getByRole("dialog", { name: "Ny gæld" });
    fireEvent.change(within(dlg).getByLabelText("Navn"), { target: { value: "Billån" } });
    fireEvent.change(within(dlg).getByLabelText("Restgæld (kr.)"), { target: { value: "180.000" } });
    fireEvent.change(within(dlg).getByLabelText("Rente (% pr. år)"), { target: { value: "4,9" } });
    fireEvent.change(within(dlg).getByLabelText("Ydelse pr. måned (kr.)"), { target: { value: "3.200" } });
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Gem" })); });
    expect(plan.saveAsset).toHaveBeenCalledWith(expect.objectContaining({ name: "Billån", kind: "loan", value: 180000, rate: 4.9, monthly_payment: 3200 }), undefined);
  });
});
