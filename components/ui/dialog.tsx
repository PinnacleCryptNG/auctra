"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconX } from "./icons";

/**
 * Modal built on the native <dialog> (focus trap, Esc and focus return come
 * from the browser). Below 640px it renders as a bottom sheet so actions stay
 * within thumb reach; on larger screens it is a centred dialog.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md"
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const width = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl" }[size];

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={
        "m-0 mt-auto w-full max-w-none border-0 bg-transparent p-0 text-ink backdrop:bg-obsidian/45 " +
        `sm:m-auto ${width} open:animate-sheet`
      }
    >
      <div className="flex max-h-[92dvh] flex-col rounded-t-[var(--radius-surface)] bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[85dvh] sm:rounded-[var(--radius-surface)]">
        <header className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="grid min-w-0 flex-1 gap-0.5">
            <h2 id={titleId} className="text-h2">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-secondary">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] text-lg text-slate hover:bg-slate-soft hover:text-ink"
          >
            <IconX />
            <span className="sr-only">Close</span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:pb-4">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}

/** A small confirm dialog for destructive or high-value actions (replaces window.confirm). */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  tone = "danger",
  busy,
  onConfirm,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[var(--radius-control)] border border-line px-4 text-sm font-medium hover:bg-cloud"
          >
            Keep it
          </button>
          <button
            type="button"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={onConfirm}
            className={`min-h-11 rounded-[var(--radius-control)] px-4 text-sm font-medium disabled:opacity-50 ${
              tone === "danger" ? "bg-danger-ink text-surface hover:bg-[#9b2626]" : "bg-signal text-obsidian hover:bg-[#2cc172]"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="grid gap-3 text-sm text-ink-2">
        {description && <p>{description}</p>}
        {children}
      </div>
    </Dialog>
  );
}
