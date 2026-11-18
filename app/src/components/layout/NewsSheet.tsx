import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CHANGELOG, LATEST_NEWS } from "@/lib/changelog";

const KEY = "bb-news-seen";

/** Efter en opdatering: vis én gang, hvad der er nyt. Nye enheder springer over (de ser velkomsten i stedet). */
export function NewsSheet() {
  const [items] = useState(() => {
    let seen: string | null = null;
    try { seen = localStorage.getItem(KEY); localStorage.setItem(KEY, LATEST_NEWS); } catch { return []; }
    return seen ? CHANGELOG.filter((c) => c.id > seen!).slice(0, 2) : [];
  });
  const [open, setOpen] = useState(items.length > 0);
  if (!open) return null;
  return (
    <Modal open title="Nyt i appen" onClose={() => setOpen(false)} footer={<Button variant="primary" onClick={() => setOpen(false)}>Fedt!</Button>}>
      <div className="grid gap-4">
        {items.map((c) => (
          <section key={c.id}>
            <h3 className="flex items-center gap-2 font-medium"><Sparkles size={16} className="text-primary" /> {c.title}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-sm text-muted-foreground">{c.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </section>
        ))}
        <p className="text-xs text-muted-foreground">Se alle nyheder under Indstillinger → Hjælp og spørgsmål.</p>
      </div>
    </Modal>
  );
}
