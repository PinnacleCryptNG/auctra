import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-[12px] border border-white/10 bg-surface p-5">
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-signal text-obsidian hover:bg-signal/90",
    secondary: "border border-white/15 text-cloud hover:bg-white/5",
    danger: "border border-danger/50 text-danger hover:bg-danger/10"
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-[8px] px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-[8px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-cloud placeholder:text-slate focus:border-signal focus:outline-none ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded-[8px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-cloud focus:border-signal focus:outline-none ${props.className ?? ""}`} />;
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-slate">{children}</span>;
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="break-all font-mono text-xs">{children}</span>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode }) {
  const styles = {
    info: "border-white/15 text-cloud",
    warn: "border-amber/50 text-amber",
    error: "border-danger/50 text-danger",
    success: "border-signal/50 text-signal"
  }[tone];
  return <div className={`rounded-[8px] border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}

export function TestnetBadge() {
  return <span className="rounded-full border border-amber/40 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-amber">Monad Testnet</span>;
}

export const CATEGORIES = ["SAVINGS", "PERSONAL", "VENDOR", "CONTRACTOR", "EMPLOYEE", "TREASURY", "OTHER"] as const;
