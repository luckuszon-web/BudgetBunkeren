import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "soft";
const styles: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  soft: "bg-accent text-accent-foreground hover:opacity-90",
  ghost: "border border-border bg-card text-foreground hover:bg-accent",
  danger: "border border-border bg-card text-destructive hover:bg-accent",
};

export function Button({ variant = "ghost", icon, children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
