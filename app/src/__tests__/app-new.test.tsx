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
  it("Notifikationer: siger det, når browseren ikke kan", async () => {
    setup("/indstillinger/notifikationer");
    expect(await screen.findByText(/understøtter ikke notifikationer/)).toBeTruthy();
  });
  it("Værktøjer: #tags, butikker, gebyrer, året og danskerne kan åbnes", async () => {
    setup("/vaerktoejer");
    for (const [tab, text] of [["#Rejser og projekter", /Skriv et/], ["Butikker", /uden faste regninger/], ["Gebyr-jæger", /Gebyr-jæger/], ["Mod danskerne", /Danmarks Statistik/], ["Året der gik", /Året der gik/]] as const) {
      fireEvent.click(await screen.findByRole("tab", { name: tab }));
      expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
    }
  });
});
