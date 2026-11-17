import { describe, expect, it, vi } from "vitest";
import { readBootParams } from "./boot-params";

const loc = (search: string, hash = "") => ({ search, hash, pathname: "/BudgetBunkeren/ny/" });

describe("readBootParams", () => {
  it("bank-login: code og state, og søge-delen ryddes", () => {
    const replace = vi.fn();
    const b = readBootParams(loc("?code=abc&state=11111111-2222-4333-8444-555555555555"), replace);
    expect(b.bank).toEqual({ code: "abc", state: "11111111-2222-4333-8444-555555555555" });
    expect(replace).toHaveBeenCalledWith("/BudgetBunkeren/ny/");
  });
  it("bank-login afbrudt", () => {
    expect(readBootParams(loc("?error=access_denied&error_description=Cancelled+by+user"), vi.fn()).bank).toEqual({ error: "Cancelled by user" });
  });
  it("link fra mail: typen læses, men tokenet bliver i hashen til Supabase", () => {
    const replace = vi.fn();
    const b = readBootParams(loc("", "#access_token=x&refresh_token=y&type=invite"), replace);
    expect(b.authType).toBe("invite");
    expect(replace).not.toHaveBeenCalled();
  });
  it("udløbet link giver en forståelig besked og ryddes", () => {
    const replace = vi.fn();
    const b = readBootParams(loc("", "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"), replace);
    expect(b.authError).toMatch(/udløbet/);
    expect(replace).toHaveBeenCalledWith("/BudgetBunkeren/ny/");
  });
  it("invitationskode og almindelige sider", () => {
    expect(readBootParams(loc("?invite=abcde-fghjk"), vi.fn()).invite).toBe("ABCDE-FGHJK");
    const replace = vi.fn();
    expect(readBootParams(loc("", "#/budget"), replace)).toEqual({ authType: null, authError: null, bank: null, invite: null });
    expect(replace).not.toHaveBeenCalled();
  });
});
