// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHANGELOG } from "@/lib/changelog";
import { setup } from "./app-setup";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe("Nyt i appen", () => {
  it("vises én gang efter en opdatering – ikke på en ny enhed", async () => {
    setup("/");
    await screen.findByText("Til rådighed resten af måneden");
    expect(screen.queryByRole("dialog", { name: "Nyt i appen" })).toBeNull();          // ny enhed
    cleanup();
    localStorage.setItem("bb-news-seen", "2000-01-01");
    setup("/");
    const dlg = await screen.findByRole("dialog", { name: "Nyt i appen" });
    expect(within(dlg).getByText(CHANGELOG[0]!.title)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Fedt!" }));
    cleanup(); setup("/");
    await screen.findByText("Til rådighed resten af måneden");
    expect(screen.queryByRole("dialog", { name: "Nyt i appen" })).toBeNull();
  });
});

describe("Hjælp og dine data", () => {
  it("Hjælp viser spørgsmål og nyheder", async () => {
    setup("/indstillinger/hjaelp");
    expect(await screen.findByText(/Hvordan regnes "Til rådighed" ud\?/)).toBeTruthy();
    expect(screen.getByText(CHANGELOG.at(-1)!.title)).toBeTruthy();
  });
  it("henter alle data som JSON og sletter kontoen kun efter SLET", async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => { created.push(b); return "blob:x"; }) as never;
    URL.revokeObjectURL = vi.fn();
    const { server, auth } = setup("/indstillinger/data");
    await screen.findByText("Dine data", {}, { timeout: 4000 });   // siden hentes dovent
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Hent alle mine data (JSON)" })); });
    const text = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(created[0]!); });
    const json = JSON.parse(text);
    expect(json.posteringer.length).toBeGreaterThan(0);
    expect(json.maal[0].name).toBe("Ferie");
    fireEvent.click(screen.getByRole("button", { name: "Slet min konto …" }));
    const go = screen.getByRole("button", { name: "Slet min konto" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Skriv SLET for at bekræfte"), { target: { value: "slet" } });
    await act(async () => { fireEvent.click(go); });
    expect(server.deleteAccount).toHaveBeenCalledWith("SLET");
    expect(auth.signOut).toHaveBeenCalled();
  });
});
