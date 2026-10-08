import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section
      {...props}
      className={`reveal min-w-0 rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </section>
  );
}

/** Card header: title (h2) with optional description and actions that wrap below on narrow screens. */
export function CardHeader({ title, description, actions, id }: { title: string; description?: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-4 pt-4 sm:px-5 sm:pt-5">
      <div className="grid min-w-0 gap-0.5">
        <h2 id={id} className="text-h2">
          {title}
        </h2>
        {description && <p className="text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`px-4 py-4 sm:px-5 sm:py-5 ${className}`}>{children}</div>;
}
