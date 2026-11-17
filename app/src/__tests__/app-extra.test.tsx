// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { savePin } from "@/lib/pin";
import { setup } from "./app-setup";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("Ny app – det, der før kun var i den klassiske", () => {
  it("Rådgiver: sender spørgsmål med sammendrag og viser svaret formateret", async () => {
    const { server } = setup("/raadgiver?q=Hvordan%20gik%20oktober%3F");
    const box = await screen.findByLabelText("Dit spørgsmål") as HTMLTextAreaElement;
    expect(box.value).toBe("Hvordan gik oktober?");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send" })); });
    await waitFor(() => expect(server.advisor).toHaveBeenCalled());
    const [msgs, ctx] = server.advisor.mock.calls[0] as unknown as [{ content: string }[], { måneder: unknown[] }];
    expect(msgs.at(-1)!.content).toBe("Hvordan gik oktober?");
    expect(ctx.måneder.length).toBeGreaterThan(0);
    expect((await screen.findByText("mere")).tagName).toBe("B");
    expect(screen.getByText("Spar på Wolt").tagName).toBe("LI");
  });

  it("Værktøjer: kalender med grønne/røde dage og sammenlign", async () => {
    setup("/vaerktoejer");
    expect(await screen.findByText(/dage? med overskud/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Sammenlign" }));
    expect(await screen.findByText("Sammenlign to måneder")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Hvad nu hvis" }));
    expect(await screen.findByText(/Til overs pr. måned bagefter/)).toBeTruthy();
  });

  it("Budget: abonnementer kan markeres til opsigelse", async () => {
    const { settings } = setup("/budget");
    fireEvent.click(await screen.findByRole("button", { name: "Opsig" }));
    await waitFor(() => expect(settings.markSub).toHaveBeenCalledWith("me", expect.stringMatching(/netflix/), "cancel"));
    expect(await screen.findByText("skal opsiges")).toBeTruthy();
  });

  it("Lås med kode: appen er låst ved start og låses op med koden", async () => {
    await savePin("1234");
    setup("/");
    expect(await screen.findByRole("dialog", { name: "Skriv din kode" })).toBeTruthy();
    for (const d of ["1", "1", "1", "1"]) fireEvent.click(screen.getByRole("button", { name: d }));
    expect(await screen.findByText("Forkert kode – prøv igen.")).toBeTruthy();
    for (const d of ["1", "2", "3", "4"]) fireEvent.click(screen.getByRole("button", { name: d }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Skriv din kode" })).toBeNull());
  });

  it("Indstillinger: sundhedstjek og tema", async () => {
    setup("/indstillinger/tjek");
    expect(await screen.findByText("Natlig hentning")).toBeTruthy();
    cleanup();
    setup("/indstillinger");
    fireEvent.click(await screen.findByRole("radio", { name: "Mørkt" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
