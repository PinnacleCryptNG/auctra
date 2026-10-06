import { ImageResponse } from "next/og";

export const alt = "Auctra: money that moves itself. Describe a USDC transfer once and it runs on schedule, within limits you set.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: 72, background: "#1B1433", color: "#F5EFE4", position: "relative" }}>
        <div style={{ position: "absolute", right: -160, top: -160, width: 520, height: 520, borderRadius: 999, background: "#C5F04A", opacity: 0.18 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="9" fill="#261E42" />
            <path d="M8.5 24.5 16 7.5l7.5 17" fill="none" stroke="#C5F04A" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="16" cy="19.4" r="2.9" fill="#F5EFE4" />
          </svg>
          <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-0.02em" }}>Auctra</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 96, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
            <span>Money that&nbsp;</span>
            <span style={{ fontStyle: "italic", backgroundImage: "linear-gradient(to top, #C5F04A 0 30%, transparent 30%)" }}>moves itself.</span>
          </div>
          <div style={{ fontSize: 34, color: "rgba(245,239,228,0.72)" }}>Say it once. Auctra runs it.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", background: "#C5F04A", color: "#1B1433", fontSize: 26, fontWeight: 700, padding: "10px 22px", borderRadius: 999 }}>Telegram + web</div>
        </div>
      </div>
    ),
    size
  );
}
