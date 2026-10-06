import type { SVGProps } from "react";

// Auctra's own icon set: 24px grid, 1.75 stroke, rounded ends, and one solid
// dot per glyph that echoes the dot in the logo's "A". The dot takes
// --icon-dot when set (e.g. chartreuse on dark), otherwise the text colour.
// Decorative by default.
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

/** The signature dot. */
const Dot = ({ cx, cy, r = 1.6 }: { cx: number; cy: number; r?: number }) => (
  <circle cx={cx} cy={cy} r={r} fill="var(--icon-dot, currentColor)" stroke="none" />
);

// Status
export const IconCheck = (p: IconProps) => <Icon {...p}><path d="M5 12.5l4.25 4.25L19 7" /></Icon>;
export const IconX = (p: IconProps) => <Icon {...p}><path d="M7 7l10 10M17 7L7 17" /></Icon>;
export const IconClock = (p: IconProps) => <Icon {...p}><path d="M20 12a8 8 0 1 1-8-8" /><path d="M12 8v4l2.75 2.75" /><Dot cx={18.25} cy={5.75} /></Icon>;
export const IconAlert = (p: IconProps) => <Icon {...p}><path d="M10.3 4.6a2 2 0 0 1 3.4 0l7 12A2 2 0 0 1 19 19.5H5a2 2 0 0 1-1.7-2.9z" /><path d="M12 9.5v3.5" /><Dot cx={12} cy={16.25} r={1.25} /></Icon>;
/** Skipped: the run hops over this slot. */
export const IconSkip = (p: IconProps) => <Icon {...p}><path d="M4 15.5c1.8-6.2 14.2-6.2 16 0" /><path d="M16.5 15.75l3.5-.25.25-3.5" /><Dot cx={12} cy={17.5} /></Icon>;
export const IconDot = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></Icon>;
export const IconPause = (p: IconProps) => <Icon {...p}><rect x="7" y="6" width="3.25" height="12" rx="1.6" /><rect x="13.75" y="6" width="3.25" height="12" rx="1.6" /></Icon>;
export const IconPlay = (p: IconProps) => <Icon {...p}><path d="M8 7.2v9.6a1.2 1.2 0 0 0 1.8 1l7.7-4.8a1.2 1.2 0 0 0 0-2L9.8 6.2A1.2 1.2 0 0 0 8 7.2z" /></Icon>;

// Actions
export const IconPlus = (p: IconProps) => <Icon {...p}><path d="M12 5.5v13M5.5 12h13" /></Icon>;
/** Money leaves the dot. */
export const IconArrowRight = (p: IconProps) => <Icon {...p}><path d="M8 12h11M14.5 7.5L19 12l-4.5 4.5" /><Dot cx={4.75} cy={12} /></Icon>;
export const IconArrowLeft = (p: IconProps) => <Icon {...p}><path d="M16 12H5M9.5 7.5L5 12l4.5 4.5" /><Dot cx={19.25} cy={12} /></Icon>;
export const IconSend = (p: IconProps) => <Icon {...p}><path d="M8 16L18.5 5.5M10.5 5.5h8v8" /><Dot cx={5.5} cy={18.5} r={1.75} /></Icon>;
export const IconExternal = (p: IconProps) => <Icon {...p}><path d="M11 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /><path d="M12.5 11.5L19 5M14.5 5H19v4.5" /></Icon>;
export const IconCopy = (p: IconProps) => <Icon {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 5.5a1.5 1.5 0 0 0-1.5-1h-7.5a2 2 0 0 0-2 2V14a1.5 1.5 0 0 0 1 1.5" /><Dot cx={14} cy={14} r={1.4} /></Icon>;
export const IconDownload = (p: IconProps) => <Icon {...p}><path d="M12 4.5v9.5M8 10l4 4 4-4" /><path d="M5 17.5v.5A1.5 1.5 0 0 0 6.5 19.5h11A1.5 1.5 0 0 0 19 18v-.5" /></Icon>;
/** A doorway; the dot steps out. */
export const IconLogout = (p: IconProps) => <Icon {...p}><path d="M13 4.5H7.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H13" /><path d="M12.5 12H20M16.75 8.5L20.25 12l-3.5 3.5" /><Dot cx={9.25} cy={12} /></Icon>;
export const IconTrash = (p: IconProps) => <Icon {...p}><path d="M4.5 7h15M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M6.5 7l.8 11.1a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" /></Icon>;

// Places
/** An arched doorway with the dot inside: home base. */
export const IconHome = (p: IconProps) => <Icon {...p}><path d="M5.5 19.5V11a6.5 6.5 0 0 1 13 0v8.5M3.5 19.5h17" /><Dot cx={12} cy={13} r={1.75} /></Icon>;
/** A loop around the dot: it runs again. */
export const IconRepeat = (p: IconProps) => <Icon {...p}><path d="M19 12a7 7 0 1 1-2.05-4.95" /><path d="M17.25 3.75v3.5h-3.5" /><Dot cx={12} cy={12} r={1.9} /></Icon>;
/** A torn receipt: every run leaves one. */
export const IconActivity = (p: IconProps) => <Icon {...p}><path d="M6 4.5h12v15l-2-1.25-2 1.25-2-1.25-2 1.25-2-1.25-2 1.25z" /><path d="M9 8.5h6M9 12h4" /><Dot cx={14.75} cy={15.25} r={1.3} /></Icon>;
/** Two sliders: your limits and settings. */
export const IconSettings = (p: IconProps) => <Icon {...p}><path d="M4 8h9.5M18.5 8H20M4 16h1.5M10.5 16H20" /><circle cx="16" cy="8" r="2.5" /><circle cx="8" cy="16" r="2.5" fill="var(--icon-dot, currentColor)" /></Icon>;
export const IconWallet = (p: IconProps) => <Icon {...p}><path d="M17 8V6a1.5 1.5 0 0 0-1.5-1.5H6.5A2.5 2.5 0 0 0 4 7v10a2.5 2.5 0 0 0 2.5 2.5h12A1.5 1.5 0 0 0 20 18v-8.5A1.5 1.5 0 0 0 18.5 8H6.5A2.5 2.5 0 0 1 4 5.5" /><Dot cx={16} cy={14} r={1.6} /></Icon>;
/** A shield with a keyhole: custody stays with you. */
export const IconShield = (p: IconProps) => <Icon {...p}><path d="M12 3.5l7 2.75V12c0 4.1-2.9 7.2-7 8.5-4.1-1.3-7-4.4-7-8.5V6.25z" /><path d="M12 12.5v3" /><Dot cx={12} cy={10.75} r={1.9} /></Icon>;
export const IconKey = (p: IconProps) => <Icon {...p}><circle cx="8.5" cy="12" r="4.5" /><path d="M13 12h7.5M17.5 12v3M20.5 12v2" /><Dot cx={8.5} cy={12} r={1.5} /></Icon>;
/** A saved contact card. */
export const IconContacts = (p: IconProps) => <Icon {...p}><rect x="4" y="5" width="16" height="14" rx="2.5" /><path d="M13.5 10h3.5M13.5 13.5h3.5M7 15.5c.5-1.6 1.6-2.4 2.75-2.4s2.25.8 2.75 2.4" /><Dot cx={9.75} cy={10} r={1.6} /></Icon>;
/** A dial held below its limit. */
export const IconGauge = (p: IconProps) => <Icon {...p}><path d="M4.5 17a7.5 7.5 0 1 1 15 0" /><path d="M12 17l-3.5-4.5" /><Dot cx={12} cy={17} r={1.75} /></Icon>;
