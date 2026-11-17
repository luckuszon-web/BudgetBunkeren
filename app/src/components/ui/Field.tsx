import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const base = "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30";

export function Label({ text, children, className = "" }: { text: string; children: ReactNode; className?: string }) {
  return <label className={`grid gap-1 text-xs text-muted-foreground ${className}`}><span>{text}</span>{children}</label>;
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${base} ${props.className ?? ""}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${base} ${props.className ?? ""}`} />;
}
