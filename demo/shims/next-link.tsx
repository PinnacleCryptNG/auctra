import type { AnchorHTMLAttributes, ReactNode } from "react";
import { navigate } from "./router";

/** next/link stand-in: in-app paths route in memory; others behave as links. */
export default function Link({ href, onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) {
  const internal = href.startsWith("/");
  return (
    <a
      href={internal ? `#${href.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home"}` : href}
      {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (internal && !event.defaultPrevented) {
          event.preventDefault();
          navigate(href);
        }
      }}
    >
      {children}
    </a>
  );
}
