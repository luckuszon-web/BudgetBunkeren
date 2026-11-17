import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const base = "w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft";

export function Label({ text, children, className = "" }: { text: string; children: ReactNode; className?: string }) {
  return <label className={`grid gap-1 text-xs text-muted ${className}`}><span>{text}</span>{children}</label>;
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${base} ${props.className ?? ""}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${base} ${props.className ?? ""}`} />;
}
