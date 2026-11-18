// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setup } from "./app-setup";

afterEach(() => { cleanup(); localStorage.clear(); });

describe("Demotilstand", () => {
  it("viser fiktive tal, rører ikke de rigtige data og kan slås fra igen", async () => {
    const s = setup("/indstillinger");
    const sw = await screen.findByRole("switch", { name: "Demotilstand" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    const realCalls = s.repo.fetchAllUserData.mock.calls.length;
    fireEvent.click(sw);
    expect(await screen.findByText("Demotilstand – fiktive tal")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Demotilstand" }).getAttribute("aria-checked")).toBe("true");
    // Ingen nye kald til de rigtige data, og ingen forsøg på at gemme noget
    expect(s.repo.fetchAllUserData.mock.calls.length).toBe(realCalls);
    expect(s.repo.saveTransaction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Slå fra" }));
    expect(screen.queryByText("Demotilstand – fiktive tal")).toBeNull();
  });
  it("demodata vises på Planlæg", async () => {
    localStorage.setItem("bb-demo", "1");
    const s = setup("/planlaeg");
    fireEvent.click(await screen.findByRole("tab", { name: "Mål" }));
    expect(await screen.findByText(/Udbetaling til bolig/)).toBeTruthy();
    expect(s.plan.fetchPlan).not.toHaveBeenCalled();
  });
});
