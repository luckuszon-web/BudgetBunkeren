// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@/components/layout/ErrorScreen";
import { onboardingSteps } from "@/features/onboarding";
import { setup } from "./app-setup";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe("Velkomstguide", () => {
  it("krydser trin af ud fra egne data – notifikationer kun hvor enheden kan", () => {
    const s = onboardingSteps({ connected: true, txCount: 100, uncategorized: 30, hasBudget: false, hasAssets: true, hasGoal: false, push: null });
    expect(s.map((x) => [x.id, x.done])).toEqual([["bank", true], ["kategorier", false], ["budget", false], ["formue", true], ["maal", false]]);
    expect(onboardingSteps({ connected: false, txCount: 0, uncategorized: 0, hasBudget: false, hasAssets: null, hasGoal: null, push: false }).at(-1)!.id).toBe("push");
  });
  it("vises på Overblik med fremskridt og kan skjules", async () => {
    setup("/");
    const card = await screen.findByRole("region", { name: "Kom godt i gang" });
    expect(within(card).getByText(/af \d+ trin klaret/)).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Skjul guiden" }));
    expect(screen.queryByRole("region", { name: "Kom godt i gang" })).toBeNull();
    cleanup(); setup("/");
    await screen.findByText("Til rådighed resten af måneden");
    expect(screen.queryByRole("region", { name: "Kom godt i gang" })).toBeNull();
  });
});

describe("Fejlskærm", () => {
  it("viser 'Noget gik galt' i stedet for en hvid side – og 'Prøv igen' virker", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let boom = true;
    function Bomb() { if (boom) throw new Error("Testfejl"); return <p>Alt i orden</p>; }
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByRole("heading", { name: "Noget gik galt" })).toBeTruthy();
    expect(screen.getByText("Testfejl")).toBeTruthy();
    boom = false;
    fireEvent.click(screen.getByRole("button", { name: "Prøv igen" }));
    expect(screen.getByText("Alt i orden")).toBeTruthy();
  });
});
