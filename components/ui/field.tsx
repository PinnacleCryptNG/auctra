"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

const control =
  "w-full min-w-0 rounded-[var(--radius-input)] border border-line bg-surface px-3 text-[0.9375rem] text-ink placeholder:text-slate/80 " +
  "transition-[border-color,box-shadow] duration-150 focus:border-obsidian focus:outline-none focus:ring-2 focus:ring-obsidian/10 " +
  "disabled:bg-cloud disabled:text-slate aria-[invalid=true]:border-danger";

type FieldRenderProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean };

/** Label + control + hint + error, wired with ids for assistive tech. */
export function Field({
  label,
  hint,
  error,
  children
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (props: FieldRenderProps) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs leading-5 text-slate">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs leading-5 font-medium text-danger-ink">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${control} min-h-11 ${className}`} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${control} min-h-24 resize-y py-2.5 leading-6 ${className}`} />;
}

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={`${control} min-h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9 ${className}`} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23667078' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  );
}
