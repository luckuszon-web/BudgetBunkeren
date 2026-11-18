// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { savePin } from "@/lib/pin";
import { setup } from "./app-setup";

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const realUA = navigator.userAgent;
function fakeBio(approve: boolean) {
  Object.defineProperty(navigator, "userAgent", { value: iphone, configurable: true });
  vi.stubGlobal("PublicKeyCredential", { isUserVerifyingPlatformAuthenticatorAvailable: async () => true });
  const credentials = { create: vi.fn(async () => ({ rawId: new Uint8Array([1, 2, 3]).buffer })), get: vi.fn(async () => (approve ? {} : Promise.reject(new Error("NotAllowed")))) };
  Object.defineProperty(navigator, "credentials", { value: credentials, configurable: true });
  return credentials;
}
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); Object.defineProperty(navigator, "userAgent", { value: realUA, configurable: true }); });

describe("Face ID", () => {
  it("slås til i Indstillinger, når koden er sat", async () => {
    const cred = fakeBio(true);
    await savePin("1234");
    setup("/indstillinger/sikkerhed");
    // Kodelåsen åbner med Face ID med det samme ved start? Kun når Face ID er slået til – her er den ikke
    fireEvent.click(await screen.findByRole("button", { name: "1" }));
    for (const d of ["2", "3", "4"]) fireEvent.click(screen.getByRole("button", { name: d }));
    await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
    const sw = await screen.findByRole("switch", { name: "Lås op med Face ID" });
    await act(async () => { fireEvent.click(sw); });
    expect(cred.create).toHaveBeenCalled();
    expect(localStorage.getItem("bb-bio")).toBeTruthy();
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });
  it("låser op med Face ID ved start – og koden er reserve, hvis den afvises", async () => {
    fakeBio(true);
    await savePin("1234"); localStorage.setItem("bb-bio", "AQID");
    setup("/");
    expect(await screen.findByText("Til rådighed resten af måneden")).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.queryByRole("dialog", { name: "Skriv din kode" })).toBeNull();
    cleanup();
    fakeBio(false);
    setup("/");
    expect(await screen.findByRole("dialog", { name: "Skriv din kode" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Lås op med Face ID/ })).toBeTruthy();
  });
});
