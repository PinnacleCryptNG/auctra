"use client";

import { useState } from "react";
import { IconCheck, IconCopy, IconExternal } from "./icons";

export function shorten(value: string, head = 6, tail = 4) {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * A wallet address or hash, shortened (0x71C9…992A) with the full value
 * available to copy, in a tooltip, and to screen readers.
 */
export function Address({
  value,
  label = "address",
  full = false,
  href,
  hrefLabel = "View on explorer",
  className = ""
}: {
  value: string;
  label?: string;
  full?: boolean;
  href?: string | null;
  hrefLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className={`inline-flex max-w-full min-w-0 items-center gap-1 align-middle ${className}`}>
      <span className={`text-data min-w-0 text-ink-2 ${full ? "break-all" : "truncate"}`} title={value}>
        <span aria-hidden="true">{full ? value : shorten(value)}</span>
        <span className="sr-only">{`${label} ${value}`}</span>
      </span>
      <button
        type="button"
        onClick={copy}
        className="grid size-8 shrink-0 place-items-center rounded-[6px] text-slate hover:bg-slate-soft hover:text-ink"
      >
        {copied ? <IconCheck className="text-signal-ink" /> : <IconCopy />}
        <span className="sr-only">{copied ? "Copied" : `Copy ${label}`}</span>
      </button>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="grid size-8 shrink-0 place-items-center rounded-[6px] text-slate hover:bg-slate-soft hover:text-ink"
        >
          <IconExternal />
          <span className="sr-only">{hrefLabel} (opens in a new tab)</span>
        </a>
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </span>
  );
}
