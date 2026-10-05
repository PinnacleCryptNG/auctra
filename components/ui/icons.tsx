import type { SVGProps } from "react";

// Small stroke icon set (24px grid, 1.75 stroke). Decorative by default.
type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Icon({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...props}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const IconCheck = (p: IconProps) => <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;
export const IconClock = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>;
export const IconPause = (p: IconProps) => <Icon {...p}><path d="M9 6.5v11M15 6.5v11" /></Icon>;
export const IconPlay = (p: IconProps) => <Icon {...p}><path d="M8 6.5v11l9-5.5z" /></Icon>;
export const IconX = (p: IconProps) => <Icon {...p}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></Icon>;
export const IconAlert = (p: IconProps) => <Icon {...p}><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.25v.25" /></Icon>;
export const IconSkip = (p: IconProps) => <Icon {...p}><path d="M5 7l6 5-6 5zM13 7l6 5-6 5z" /></Icon>;
export const IconDot = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></Icon>;
export const IconCopy = (p: IconProps) => <Icon {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></Icon>;
export const IconExternal = (p: IconProps) => <Icon {...p}><path d="M13.5 4.5h6v6M19.5 4.5L11 13M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" /></Icon>;
export const IconPlus = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const IconHome = (p: IconProps) => <Icon {...p}><path d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" /></Icon>;
export const IconRepeat = (p: IconProps) => <Icon {...p}><path d="M4.5 11V9.5a3 3 0 0 1 3-3h11l-3-3M19.5 13v1.5a3 3 0 0 1-3 3h-11l3 3" /></Icon>;
export const IconActivity = (p: IconProps) => <Icon {...p}><path d="M3.5 12h4l2.5-6.5 4 13 2.5-6.5h4" /></Icon>;
export const IconSettings = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6" /></Icon>;
export const IconWallet = (p: IconProps) => <Icon {...p}><rect x="3.5" y="6" width="17" height="13" rx="2" /><path d="M3.5 9.5h17M16 14h1.5" /></Icon>;
export const IconShield = (p: IconProps) => <Icon {...p}><path d="M12 3.5l7.5 3v5.5c0 4.2-3.1 7.6-7.5 8.5-4.4-.9-7.5-4.3-7.5-8.5V6.5z" /><path d="M9 12l2 2 4-4" /></Icon>;
export const IconArrowRight = (p: IconProps) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const IconArrowLeft = (p: IconProps) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>;
export const IconSend = (p: IconProps) => <Icon {...p}><path d="M4 12l16-7.5-6 16-2.5-6.5z" /><path d="M11.5 14L20 4.5" /></Icon>;
export const IconDownload = (p: IconProps) => <Icon {...p}><path d="M12 4.5v10M7.5 10.5L12 15l4.5-4.5M5 19.5h14" /></Icon>;
export const IconLogout = (p: IconProps) => <Icon {...p}><path d="M14.5 4.5H18a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3.5M10 16l-4-4 4-4M6 12h9" /></Icon>;
export const IconTrash = (p: IconProps) => <Icon {...p}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></Icon>;
