// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setHideAmounts } from "@/lib/privacy";
import { setup } from "./app-setup";

afterEach(() => { cleanup(); setHideAmounts(false); localStorage.clear(); });

describe("Nye funktioner", () => {
  it("Skjul beløb: øjet erstatter alle beløb med ••• og viser dem igen", async () => {
    setup("/");
    expect(await screen.findByText("Til rådighed resten af måneden")).toBeTruthy();
    const before = document.body.textContent!;
    expect(before).toMatch(/\d\.\d{3} kr\./);
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Skjul beløb" })[0]!); });
    const hidden = document.body.textContent!;
    expect(hidden).not.toMatch(/\d\.\d{3} kr\./);
    expect(hidden).toContain("••• kr.");
    expect(localStorage.getItem("bb-hide-amounts")).toBe("1");
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Vis beløb" })[0]!); });
    expect(document.body.textContent).toMatch(/\d\.\d{3} kr\./);
  });
  it("Postering: viser kvittering og kan uploade en ny", async () => {
    const { receipts } = setup("/posteringer");
    fireEvent.change(await screen.findByLabelText("Søg i posteringer"), { target: { value: "netflix" } });
    fireEvent.click((await screen.findAllByText(/netflix/i, { selector: "p" }))[0]!);
    const dlg = screen.getByRole("dialog", { name: "Postering" });
    expect(await within(dlg).findByAltText("Kvittering")).toBeTruthy();
    const file = new File([new Uint8Array([1, 2, 3])], "k.jpg", { type: "image/jpeg" });
    await act(async () => { fireEvent.change(within(dlg).getByLabelText("Vælg billede af kvittering"), { target: { files: [file] } }); });
    expect(receipts.upload).toHaveBeenCalledWith("me", expect.any(String), expect.any(Blob));
  });
  it("Bankadgang: bjælke med Forny, når adgangen snart udløber", async () => {
    setup("/", { sessions: [{ id: "x", bank: "Nordea", valid_until: new Date(Date.now() + 5 * 864e5 - 3600e3).toISOString() }] });
    expect(await screen.findByText(/Adgangen til Nordea udløber om 5 dage/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forny" })).toBeTruthy();
    cleanup();
    setup("/", { sessions: [{ id: "y", bank: "Nordea", valid_until: new Date(Date.now() - 864e5).toISOString() }] });
    expect(await screen.findByText(/er udløbet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Luk for i dag" })).toBeNull();   // kan ikke lukkes, når den er udløbet
  });
  it("Notifikationer: siger det, når browseren ikke kan", async () => {
    setup("/indstillinger/notifikationer");
    expect(await screen.findByText(/understøtter ikke notifikationer/)).toBeTruthy();
  });
  it("Værktøjer: #tags, butikker, gebyrer, året og danskerne kan åbnes", async () => {
    setup("/vaerktoejer");
    for (const [tab, text] of [["#Projekter", /Skriv et/], ["Butikker", /uden faste regninger/], ["Gebyr-jæger", /Gebyr/], ["Mod danskerne", /Danmarks Statistik/], ["Året der gik", /Året der gik/]] as const) {
      fireEvent.click(await screen.findByRole("button", { name: tab }));
      expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole("button", { name: "Alle værktøjer" }));
    }
  });
  it("Planlæg: faner for formue, mål (med udfordringer) og gæld – og Mere i bundmenuen", async () => {
    setup("/planlaeg");
    expect(await screen.findByText("Nettoformue")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Formue", selected: true })).toBeTruthy();
    expect(screen.getByText("Lønkonto")).toBeTruthy();
    expect(screen.queryByText("Billån")).toBeNull();                 // gæld står kun under Gæld
    fireEvent.click(screen.getByRole("tab", { name: "Gæld" }));
    expect(screen.getByText("Billån")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Mål" }));
    expect(screen.queryByLabelText("Højst beløb")).toBeNull();       // formularen er lukket
    fireEvent.click(screen.getByRole("button", { name: "Ny udfordring" }));
    expect(screen.getByLabelText("Højst beløb")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("link", { name: "Mere" })[0]!);
    expect(await screen.findByRole("heading", { name: "Mere" })).toBeTruthy();
  });
});
