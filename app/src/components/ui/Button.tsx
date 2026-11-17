import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "soft";
const styles: Record<Variant, string> = {
  primary: "bg-accent text-white hover:opacity-90",
  soft: "bg-accent-soft text-accent hover:opacity-90",
  ghost: "border border-line bg-card text-ink hover:bg-bg",
  danger: "border border-line bg-card text-bad hover:bg-bg",
};

export function Button({ variant = "ghost", icon, children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
