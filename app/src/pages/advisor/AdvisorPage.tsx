import { useEffect, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { buildAdvisorContext } from "@/features/advisor-context";
import { useFinance } from "@/features/finance-store";
import { useResource, useServices } from "@/features/services-context";
import { todayIso } from "@/lib/today";
import { Formatted } from "./Formatted";
import { privateKey } from "@/lib/demo-mode";

interface Msg { role: "user" | "assistant"; content: string; error?: boolean }
const KEY = "advisorChat";
const SUGGESTIONS = ["Hvorfor har jeg brugt mere denne måned?", "Hvor kan jeg spare 1.000 kr. om måneden?", "Hvordan når jeg mine opsparingsmål hurtigere?",
  "Hvilke abonnementer og faste udgifter bør jeg se på?", "Er min økonomi sund? Giv mig de tre vigtigste råd."];
const load = (): Msg[] => { try { return JSON.parse(localStorage.getItem(privateKey(KEY)) || "[]") as Msg[]; } catch { return []; } };

/** Spørg om din økonomi. Rådgiveren (AI på serveren) ser et sammendrag af tallene – ikke de enkelte posteringer. */
export function AdvisorPage() {
  const { state, derived, user } = useFinance();
  const { server } = useServices();
  const plan = useResource((s) => s.plan.fetchPlan(user?.id ?? "").catch(() => null), [user?.id]);
  const search = useSearch({ from: "/raadgiver" });
  const [msgs, setMsgs] = useState<Msg[]>(load), [input, setInput] = useState(search.q ?? ""), [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { try { localStorage.setItem(privateKey(KEY), JSON.stringify(msgs.slice(-20))); } catch { /* ok */ } end.current?.scrollIntoView?.({ behavior: "smooth", block: "end" }); }, [msgs]);

  async function ask(q: string) {
    q = q.trim();
    if (!q || busy || !derived || !state.data) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const answer = await server.advisor(next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
        buildAdvisorContext(derived, state.data.categories, plan.data ?? null, todayIso()));
      setMsgs([...next, { role: "assistant", content: answer || "(Intet svar.)" }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMsgs([...next, { role: "assistant", error: true, content: /fetch|404|not found/i.test(msg) ? "Rådgiveren er ikke sat op endnu (serverfunktionen eller ANTHROPIC_API_KEY mangler i Supabase)." : msg }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Rådgiver" subtitle="Spørg om din økonomi" action={msgs.length ? <Button onClick={() => setMsgs([])}>Ny samtale</Button> : undefined} />
      <Card>
        <p className="mb-3 text-xs text-muted-foreground">Rådgiveren ser et sammendrag af dine tal (pr. måned og kategori, faste udgifter, budgetter, mål og formue) – ikke de enkelte posteringer. Svarene er vejledende og kan indeholde fejl.</p>
        <div className="grid gap-2.5" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "justify-self-end rounded-br-md bg-accent" : `justify-self-start rounded-bl-md border ${m.error ? "border-destructive/40 text-destructive" : "border-border bg-background"}`}`}>
              {m.role === "user" ? m.content : <Formatted text={m.content} />}
            </div>
          ))}
          {busy && <div className="justify-self-start rounded-2xl border border-border px-3.5 py-2.5 text-sm text-muted-foreground">Tænker over dine tal …</div>}
          {!msgs.length && !busy && <p className="text-sm text-muted-foreground">Stil et spørgsmål, eller vælg et af forslagene herunder.</p>}
          <div ref={end} />
        </div>
        {msgs.length <= 1 && !busy && (
          <div className="mt-3 flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-border px-3 py-1 text-left text-sm hover:bg-accent">{s}</button>)}</div>
        )}
        <form className="mt-3 grid grid-cols-[1fr_auto] items-end gap-2" onSubmit={(e) => { e.preventDefault(); void ask(input); }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} maxLength={2000} placeholder="Skriv et spørgsmål …" aria-label="Dit spørgsmål"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(input); } }}
            className="w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" />
          <Button type="submit" variant="primary" disabled={busy || !input.trim()} icon={<Send size={16} />}>Send</Button>
        </form>
      </Card>
    </>
  );
}
