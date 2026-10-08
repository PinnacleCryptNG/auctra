import { C, F } from "../brand";
import { enter } from "./anim";
import { LogoMark, pressed, Tap } from "./bits";

export type ChatMessage = {
  from: "me" | "bot";
  /** Absolute frame the message lands. */
  at: number;
  lines: string[];
  buttons?: string[];
  /** Absolute frame a button on this message is tapped (shows pressed state). */
  tapAt?: number;
  /** Small timestamp under the bubble. */
  time: string;
};

/** Telegram's chat view, themed in Auctra's aubergine. */
export function TelegramChat({ frame, messages, input, caretOn }: { frame: number; messages: ChatMessage[]; input: string; caretOn: boolean }) {
  const shown = messages.filter((m) => frame >= m.at);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.obsidian }}>
      {/* faint grain, like the site's dark bands */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "6px 6px"
        }}
      />
      <Header />
      <div
        style={{
          position: "absolute",
          top: 112,
          bottom: 92,
          left: 0,
          right: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 10,
          padding: "0 12px 10px"
        }}
      >
        {shown.map((m, i) => (
          <Bubble key={i} m={m} frame={frame} />
        ))}
      </div>
      <InputBar text={input} caretOn={caretOn} />
    </div>
  );
}

function Header() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 112,
        paddingTop: 54,
        background: C.obsidian2,
        borderBottom: `1px solid ${C.obsidianLine}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "54px 16px 0",
        color: C.cloud,
        zIndex: 5
      }}
    >
      <svg width="12" height="20" viewBox="0 0 12 20">
        <path d="M10 2 2 10l8 8" fill="none" stroke={C.cloud} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <LogoMark size={40} style={{ borderRadius: 99, boxShadow: `0 0 0 1px ${C.obsidianLine}` }} />
      <div style={{ display: "grid", lineHeight: 1.15 }}>
        <span style={{ fontWeight: 600, fontSize: 18 }}>Auctra</span>
        <span style={{ fontSize: 14, color: "rgba(245,239,228,0.6)" }}>bot</span>
      </div>
      <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 5, height: 5, borderRadius: 9, background: C.cloud }} />
        ))}
      </span>
    </div>
  );
}

function Bubble({ m, frame }: { m: ChatMessage; frame: number }) {
  const me = m.from === "me";
  const style = enter(frame, m.at, 14, 9);
  return (
    <div
      style={{
        alignSelf: me ? "flex-end" : "flex-start",
        maxWidth: me ? 300 : 318,
        transformOrigin: me ? "100% 100%" : "0% 100%",
        ...style
      }}
    >
      <div
        style={{
          background: me ? C.signal : C.obsidian2,
          color: me ? C.obsidian : C.cloud,
          border: me ? "none" : `1px solid ${C.obsidianLine}`,
          borderRadius: 18,
          borderBottomRightRadius: me ? 6 : 18,
          borderBottomLeftRadius: me ? 18 : 6,
          padding: "9px 13px 7px",
          fontSize: 15.5,
          lineHeight: 1.36
        }}
      >
        {m.lines.map((line, i) =>
          line === "" ? (
            <div key={i} style={{ height: 9 }} />
          ) : (
            <div key={i} style={{ wordBreak: /0x[0-9a-f]{8}|https?:/i.test(line) ? "break-all" : "normal" }}>
              {line}
            </div>
          )
        )}
        <div style={{ textAlign: "right", fontSize: 11.5, opacity: 0.6, marginTop: 2 }}>{m.time}</div>
      </div>
      {m.buttons && (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {m.buttons.map((b, i) => (
            <div
              key={b}
              style={{
                position: "relative",
                flex: 1,
                textAlign: "center",
                padding: "10px 0",
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 15,
                background: i === 0 && m.tapAt && frame >= m.tapAt ? C.signal : "rgba(38,30,66,0.92)",
                color: i === 0 && m.tapAt && frame >= m.tapAt ? C.obsidian : C.cloud,
                border: `1px solid ${C.obsidianLine}`,
                transform: `scale(${i === 0 && m.tapAt ? pressed(frame, m.tapAt) : 1})`
              }}
            >
              {b}
              {i === 0 && m.tapAt !== undefined && <Tap frame={frame} at={m.tapAt} x={0} y={0} centered />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InputBar({ text, caretOn }: { text: string; caretOn: boolean }) {
  const has = text.length > 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 92,
        background: C.obsidian2,
        borderTop: `1px solid ${C.obsidianLine}`,
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "12px 10px 0",
        zIndex: 5
      }}
    >
      <div
        style={{
          height: 40,
          padding: "0 14px",
          borderRadius: 20,
          background: C.signal,
          color: C.obsidian,
          fontWeight: 600,
          fontSize: 15,
          display: "flex",
          alignItems: "center"
        }}
      >
        Open
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 40,
          borderRadius: 20,
          background: C.obsidian,
          border: `1px solid ${C.obsidianLine}`,
          color: has ? C.cloud : "rgba(245,239,228,0.45)",
          fontSize: 15.5,
          padding: "9px 14px",
          lineHeight: 1.3,
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-end",
          maxHeight: 64
        }}
      >
        <span style={{ display: "block", whiteSpace: "nowrap", direction: "rtl", overflow: "hidden", textOverflow: "clip", width: "100%", textAlign: "left" }}>
          <bdi>
            {has ? text : "Message"}
            <span style={{ display: "inline-block", width: 2, height: 18, marginLeft: 1, verticalAlign: -3, background: C.signal, opacity: caretOn ? 1 : 0 }} />
          </bdi>
        </span>
      </div>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 99,
          background: has ? C.signal : "transparent",
          display: "grid",
          placeItems: "center"
        }}
      >
        {has ? (
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path d="M9 15V3M3.5 8.5 9 3l5.5 5.5" fill="none" stroke={C.obsidian} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="18" height="22" viewBox="0 0 18 22">
            <rect x="5" y="1" width="8" height="13" rx="4" fill="none" stroke={C.cloud} strokeWidth="2" />
            <path d="M2 10a7 7 0 0 0 14 0M9 17v4" fill="none" stroke={C.cloud} strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </div>
    </div>
  );
}

export const CHAT_FONT = F.sans;
