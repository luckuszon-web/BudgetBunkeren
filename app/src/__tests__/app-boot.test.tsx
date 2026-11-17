// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setup } from "./app-setup";

afterEach(cleanup);
const none = { authType: null, authError: null, bank: null, invite: null };

describe("Forsiden: links fra mails og bank-login", () => {
  it("tilbage fra bank-login: forbindelsen afsluttes, og data hentes igen", async () => {
    const { server, repo } = setup("/", { boot: { ...none, bank: { code: "c", state: "s" } } });
    expect(await screen.findByText("Forbundet: 2 konti.")).toBeTruthy();
    expect(server.finishBank).toHaveBeenCalledWith("c", "s");
    await waitFor(() => expect(repo.fetchAllUserData).toHaveBeenCalledTimes(2));
  });

  it("invitation: vælg adgangskode, derefter Overblik", async () => {
    const { auth } = setup("/", { boot: { ...none, authType: "invite" } });
    fireEvent.change(await screen.findByLabelText(/^Adgangskode/), { target: { value: "en-lang-kode-123" } });
    fireEvent.change(screen.getByLabelText("Gentag"), { target: { value: "en-lang-kode-123" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gem og fortsæt" })); });
    expect(auth.changePassword).toHaveBeenCalledWith("en-lang-kode-123");
    expect(await screen.findByRole("heading", { name: "Overblik" })).toBeTruthy();
  });

  it("?invite=KODE åbner Opret bruger med koden udfyldt", async () => {
    const { server } = setup("/", { signedIn: false, boot: { ...none, invite: "ABCDE-FGHJK" } });
    expect((await screen.findByLabelText("Invitationskode") as HTMLInputElement).value).toBe("ABCDE-FGHJK");
    fireEvent.change(screen.getByLabelText("Din e-mail"), { target: { value: "ny@example.com" } });
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Opret bruger" }).at(-1)!); });
    expect(server.register).toHaveBeenCalledWith("ny@example.com", "ABCDE-FGHJK");
    expect(await screen.findByText(/Tjek din mail/)).toBeTruthy();
  });

  it("udløbet link vises på login, og glemt adgangskode sender mail", async () => {
    const { auth } = setup("/", { signedIn: false, boot: { ...none, authError: "Linket er udløbet eller allerede brugt." } });
    expect(await screen.findByText(/Linket er udløbet/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "me@example.com" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Glemt adgangskode?" })); });
    expect(auth.resetPassword).toHaveBeenCalledWith("me@example.com", expect.any(String));
    expect(screen.getByText(/sendt en mail/)).toBeTruthy();
  });
});
