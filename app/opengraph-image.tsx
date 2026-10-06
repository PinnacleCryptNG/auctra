import { ImageResponse } from "next/og";

export const alt = "Auctra: tell it what you want your money to do. It handles the rest.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: 72, background: "#0B0D0F", color: "#F5F6F4" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 24 24">
            <rect width="24" height="24" rx="6" fill="#35D07F" />
            <path d="M7 16.5L12 7l5 9.5M9.2 13h5.6" stroke="#0B0D0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 600 }}>Auctra</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.02em" }}>Tell Auctra what you want your money to do.</div>
          <div style={{ fontSize: 34, color: "#9AA3A9" }}>Recurring and conditional USDC transfers, within limits you set.</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#35D07F" }}>Monad Testnet</div>
      </div>
    ),
    size
  );
}
