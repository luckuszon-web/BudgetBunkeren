// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setup } from "./app-setup";

const realUA = navigator.userAgent;
const setUA = (ua: string) => Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
afterEach(() => { cleanup(); localStorage.clear(); setUA(realUA); vi.unstubAllGlobals(); });

describe("Velkomst første gang", () => {
  it("iPhone i Safari: viser hvordan appen lægges på hjemmeskærmen – og kun én gang", async () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1");
    setup("/");
    const dlg = await screen.findByRole("dialog", { name: "Velkommen til BudgetBunkeren" });
    fireEvent.click(within(dlg).getByRole("button", { name: "Føj til hjemmeskærm" }));
    expect(within(dlg).getByText("Føj til hjemmeskærm", { selector: "b" })).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Færdig" }));
    expect(screen.queryByRole("dialog", { name: "Velkommen til BudgetBunkeren" })).toBeNull();
    cleanup(); setup("/");
    await screen.findByText("Til rådighed resten af måneden");
    expect(screen.queryByRole("dialog", { name: "Velkommen til BudgetBunkeren" })).toBeNull();
  });
  it("kan slå notifikationer til med ét tryk", async () => {
    const sub = { endpoint: "https://push.example/x", getKey: () => new Uint8Array(16).buffer, unsubscribe: vi.fn() };
    const reg = { pushManager: { getSubscription: vi.fn(async () => null), subscribe: vi.fn(async () => sub) } };
    vi.stubGlobal("PushManager", function PushManager() {});
    vi.stubGlobal("Notification", Object.assign(function Notification() {}, { permission: "default", requestPermission: vi.fn(async () => "granted") }));
    Object.defineProperty(navigator, "serviceWorker", { value: { getRegistration: vi.fn(async () => reg) }, configurable: true });
    const { settings } = setup("/");
    const dlg = await screen.findByRole("dialog", { name: "Velkommen til BudgetBunkeren" });
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Slå notifikationer til" })); });
    expect(settings.savePushSubscription).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "https://push.example/x" }));
    expect(within(dlg).getByText("Notifikationer er slået til.")).toBeTruthy();
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  });
});
