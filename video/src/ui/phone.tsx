import type { ReactNode } from "react";
import { C, F } from "../brand";

export const SCREEN_W = 390;
export const SCREEN_H = 844;
const BEZEL = 14;

/** A plain modern phone: rounded aubergine body, screen, island, status bar. */
export function Phone({ children, time, dark }: { children: ReactNode; time: string; dark: boolean }) {
  return (
    <div
      style={{
        width: SCREEN_W + BEZEL * 2,
        height: SCREEN_H + BEZEL * 2,
        borderRadius: 64,
        padding: BEZEL,
        background: "#0E0A1C",
        boxShadow: `0 0 0 2px ${C.obsidianLine}, 0 50px 90px -30px rgba(27,20,51,0.55), 0 18px 40px -20px rgba(27,20,51,0.4)`,
        position: "relative"
      }}
    >
      <div
        style={{
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: 50,
          overflow: "hidden",
          position: "relative",
          background: dark ? C.obsidian : C.cloud,
          fontFamily: F.sans
        }}
      >
        {children}
        <StatusBar time={time} dark={dark} />
        <div
          style={{
            position: "absolute",
            top: 11,
            left: "50%",
            width: 120,
            height: 34,
            marginLeft: -60,
            borderRadius: 20,
            background: "#000",
            zIndex: 60
          }}
        />
      </div>
    </div>
  );
}

function StatusBar({ time, dark }: { time: string; dark: boolean }) {
  const color = dark ? "#fff" : C.obsidian;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 34px 0 44px",
        color,
        fontSize: 17,
        fontWeight: 600,
        zIndex: 55
      }}
    >
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{time}</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <svg width="18" height="12" viewBox="0 0 18 12">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 5} y={9 - i * 3} width="3" height={3 + i * 3} rx="1" fill={color} />
          ))}
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12">
          <path d="M8 11 1 4a10 10 0 0 1 14 0Z" fill={color} />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke={color} opacity="0.5" />
          <rect x="2" y="2" width="17" height="8" rx="2" fill={color} />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill={color} opacity="0.5" />
        </svg>
      </span>
    </div>
  );
}
