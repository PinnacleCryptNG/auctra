import type { CSSProperties, ReactNode } from "react";
import { C, F } from "../brand";
import { prog } from "./anim";

/** The Auctra mark: same drawing as components/auctra/logo.tsx. */
export function LogoMark({ size = 32, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} style={style} aria-hidden>
      <rect width="32" height="32" rx="9" fill={C.obsidian} />
      <path d="M8.5 24.5 16 7.5l7.5 17" fill="none" stroke={C.signal} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="19.4" r="2.9" fill={C.cloud} />
    </svg>
  );
}

export function Wordmark({ size = 32, color = C.obsidian }: { size?: number; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.32, color }}>
      <LogoMark size={size} style={{ borderRadius: size * 0.28, boxShadow: color === C.obsidian ? undefined : "0 0 0 1.5px rgba(245,239,228,0.22)" }} />
      <span
        style={{
          fontFamily: F.display,
          fontSize: size * 0.7,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          fontVariationSettings: '"SOFT" 100, "opsz" 48'
        }}
      >
        Auctra
      </span>
    </span>
  );
}

/** A finger tap: a dark dot that presses in, then a chartreuse ring that spreads. */
export function Tap({ frame, at, x, y, centered }: { frame: number; at: number; x: number; y: number; centered?: boolean }) {
  if (frame < at - 6 || frame > at + 16) return null;
  if (centered) return <div style={{ position: "absolute", left: "50%", top: "50%" }}><Tap frame={frame} at={at} x={0} y={0} /></div>;
  const pre = prog(frame, at - 6, 6);
  const ring = prog(frame, at, 14);
  const fade = 1 - prog(frame, at + 6, 10);
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none", zIndex: 50 }}>
      <div
        style={{
          position: "absolute",
          width: 44,
          height: 44,
          left: -22,
          top: -22,
          borderRadius: 99,
          background: "rgba(27,20,51,0.28)",
          border: "2px solid rgba(255,255,255,0.85)",
          opacity: pre * fade,
          transform: `scale(${1.15 - 0.25 * pre + 0.1 * ring})`
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 44,
          height: 44,
          left: -22,
          top: -22,
          borderRadius: 99,
          border: `3px solid ${C.signal}`,
          opacity: (1 - ring) * (frame >= at ? 1 : 0),
          transform: `scale(${1 + ring * 1.4})`
        }}
      />
    </div>
  );
}

/** Pressed state for a button tapped at `at`. */
export const pressed = (frame: number, at: number) => (frame >= at - 2 && frame <= at + 4 ? 0.96 : 1);

export function Check({ size = 16, color = C.signalInk }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden style={{ flexShrink: 0 }}>
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Pill({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        padding: "8px 16px",
        fontFamily: F.sans,
        fontWeight: 600,
        ...style
      }}
    >
      {children}
    </span>
  );
}

export function ChainChip({ scale = 1 }: { scale?: number }) {
  return (
    <Pill
      style={{
        fontSize: 15 * scale,
        padding: `${6 * scale}px ${12 * scale}px`,
        background: C.surface,
        border: `1px solid ${C.line}`,
        color: C.obsidian
      }}
    >
      <span style={{ width: 8 * scale, height: 8 * scale, borderRadius: 9, background: C.signalStrong }} />
      Monad Testnet
    </Pill>
  );
}
