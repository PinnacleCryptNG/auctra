"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./feedback";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost" | "dark" | "on-dark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold tracking-[-0.005em] whitespace-nowrap select-none " +
  "transition-[background-color,border-color,color,transform,box-shadow] duration-150 active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const variants: Record<Variant, string> = {
  primary: "bg-signal text-obsidian ring-1 ring-obsidian/10 ring-inset hover:bg-signal-strong",
  secondary: "border border-obsidian/15 bg-surface text-ink hover:border-obsidian/40 hover:bg-cloud",
  ghost: "text-ink-2 hover:bg-slate-soft hover:text-ink",
  danger: "border border-danger/40 bg-surface text-danger-ink hover:bg-danger-soft",
  "danger-ghost": "text-danger-ink hover:bg-danger-soft",
  dark: "bg-obsidian text-cloud hover:bg-obsidian-2",
  /** Outline button for obsidian surfaces (landing hero). */
  "on-dark": "border border-cloud/25 text-cloud hover:border-cloud/60 hover:bg-obsidian-2"
};

// Minimum 40px (sm) / 44px (md, lg) tall for comfortable touch targets.
const sizes: Record<Size, string> = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-13 px-6 text-[0.9375rem]"
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Shown instead of the label while loading, e.g. "Creating automation…". */
  loadingLabel?: string;
  icon?: ReactNode;
};

export function Button({ variant, size, loading, loadingLabel, icon, className = "", children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
    >
      {loading ? <Spinner /> : icon}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  icon,
  className = "",
  children,
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: Variant; size?: Size; icon?: ReactNode }) {
  const classes = buttonClass(variant, size, className);
  if (href.startsWith("http")) {
    return (
      <a href={href} {...props} className={classes}>
        {icon}
        <span>{children}</span>
      </a>
    );
  }
  return (
    <Link href={href} {...props} className={classes}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
