import type { ReactNode } from "react";

/** Sikker formatering af rådgiverens svar: **fed**, punktlister og afsnit – som React-elementer (ingen HTML fra serveren). */
export function Formatted({ text }: { text: string }) {
  const bold = (s: string): ReactNode[] => s.replace(/^#+\s*/, "").split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p));
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={`u${blocks.length}`} className="my-1 list-disc pl-5">{list.map((l, i) => <li key={i}>{bold(l)}</li>)}</ul>); list = []; } };
  for (const line of text.split("\n")) {
    const li = /^\s*(?:[-*•]|\d+[.)])\s+(.*)/.exec(line);
    if (li) { list.push(li[1]!); continue; }
    flush();
    if (line.trim()) blocks.push(<p key={`p${blocks.length}`} className="mb-2 last:mb-0">{bold(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
}
