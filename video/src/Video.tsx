import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { accentItalic, C, displayAxes, F } from "./brand";
import { EX } from "./data";
import { BAR, BEAT, KEY_EVERY, REQUEST_TEXT, scene, SCENES, START_TEXT, T, type SceneId } from "./timeline";
import { enter, keys, prog, progInOut, typed } from "./ui/anim";
import { ChainChip, Pill, Tap, Wordmark } from "./ui/bits";
import { HistoryScreen, Onboarding } from "./ui/miniapp";
import { Phone, SCREEN_H, SCREEN_W } from "./ui/phone";
import { TelegramChat, type ChatMessage } from "./ui/telegram";

const at = (id: SceneId, local: number) => scene(id).from + local;

// ---- The conversation, in absolute frames ----

const MESSAGES: ChatMessage[] = [
  { from: "me", at: at("start", T.start.send), lines: [START_TEXT], time: "9:41" },
  {
    from: "bot",
    at: at("start", T.start.botReply),
    lines: [
      "Welcome to Auctra. Tell it what your money should do, and it handles the rest.",
      "",
      "First, set up your wallet. Auctra never asks for a seed phrase. This button works for 30 minutes."
    ],
    buttons: ["Set up Auctra"],
    tapAt: at("start", T.start.tapSetup),
    time: "9:41"
  },
  { from: "me", at: at("ask", T.ask.send), lines: [REQUEST_TEXT], time: "9:44" },
  {
    from: "bot",
    at: at("confirm", T.confirm.reply),
    lines: [
      "Please confirm this automation:",
      "• Send: 20 USDC",
      `• To: Savings (savings) → ${EX.savings}`,
      `• When: every Friday at 18:00 (${EX.timezone})`,
      `• First run: ${EX.firstRun}`,
      `• From: Personal account wallet ${EX.wallet}`,
      "Runs on Monad Testnet with test funds only."
    ],
    buttons: ["Confirm", "Cancel"],
    tapAt: at("confirm", T.confirm.tapConfirm),
    time: "9:44"
  },
  { from: "bot", at: at("confirm", T.confirm.active), lines: [`Automation active. First run: ${EX.firstRun}.`], time: "9:44" },
  {
    from: "bot",
    at: at("runs", T.runs.message),
    lines: ["Sent 20 USDC to Savings.", `Transaction: ${EX.tx}`, `https://testnet.monadexplorer.com/tx/${EX.tx}`, "Scheduled run · Monad Testnet"],
    time: "18:00"
  }
];

// ---- Captions ----

type Caption = { n: string; label: string; plain: string; accent: string; sub: string };
const CAPTIONS: Partial<Record<SceneId, Caption>> = {
  start: { n: "01", label: "Start", plain: "Open ", accent: "the bot.", sub: "Send /start in Telegram. Nothing to install." },
  setup: { n: "02", label: "Set up", plain: "Your keys ", accent: "stay yours.", sub: "A wallet you own, with limits only you can change." },
  ask: { n: "03", label: "Ask", plain: "Type it ", accent: "like a text.", sub: "Plain words. Auctra reads the amount, who and when." },
  confirm: { n: "04", label: "Confirm", plain: "Check it. ", accent: "Tap confirm.", sub: "Nothing runs until you say yes." },
  runs: { n: "05", label: "Runs", plain: "Auctra ", accent: "handles it.", sub: "On time, with a receipt every run." },
  proof: { n: "06", label: "Proof", plain: "A receipt ", accent: "every run.", sub: "Sent, skipped or blocked. Always on the record." }
};

// ---- Camera: where the lens sits on the phone in each scene (scale, focus x/y in screen px) ----

type Cam = { s: number; x: number; y: number };
const CAMERA: Record<SceneId, Array<[number, Cam]>> = {
  cover: [[0, { s: 1, x: 195, y: 422 }]],
  start: [
    [0, { s: 1, x: 195, y: 422 }],
    [24, { s: 1.32, x: 195, y: 640 }],
    [100, { s: 1.32, x: 170, y: 560 }],
    [120, { s: 1.08, x: 195, y: 470 }]
  ],
  setup: [
    [0, { s: 1.08, x: 195, y: 470 }],
    [20, { s: 1.22, x: 195, y: 420 }],
    [60, { s: 1.22, x: 195, y: 470 }],
    [120, { s: 1.26, x: 195, y: 480 }],
    [180, { s: 1.22, x: 195, y: 520 }],
    [230, { s: 1.12, x: 195, y: 440 }],
    [240, { s: 1.08, x: 195, y: 440 }]
  ],
  ask: [
    [0, { s: 1.08, x: 195, y: 440 }],
    [22, { s: 1.6, x: 230, y: 790 }],
    [T.ask.send - 6, { s: 1.6, x: 230, y: 790 }],
    [T.ask.send + 16, { s: 1.2, x: 230, y: 640 }],
    [180, { s: 1.12, x: 195, y: 560 }]
  ],
  confirm: [
    [0, { s: 1.12, x: 195, y: 560 }],
    [26, { s: 1.38, x: 170, y: 430 }],
    [92, { s: 1.45, x: 140, y: 620 }],
    [T.confirm.active + 10, { s: 1.4, x: 160, y: 690 }],
    [180, { s: 1.06, x: 195, y: 440 }]
  ],
  runs: [
    [0, { s: 1.06, x: 195, y: 440 }],
    [18, { s: 1.38, x: 195, y: 120 }],
    [46, { s: 1.38, x: 195, y: 140 }],
    [70, { s: 1.3, x: 170, y: 600 }],
    [120, { s: 1.08, x: 195, y: 440 }]
  ],
  proof: [
    [0, { s: 1.08, x: 195, y: 440 }],
    [24, { s: 1.4, x: 195, y: 330 }],
    [100, { s: 1.4, x: 195, y: 330 }],
    [120, { s: 1, x: 195, y: 422 }]
  ],
  outro: [[0, { s: 1, x: 195, y: 422 }]]
};

function camera(id: SceneId, local: number): Cam {
  const k = CAMERA[id];
  return {
    s: keys(local, k.map(([f, c]) => [f, c.s])),
    x: keys(local, k.map(([f, c]) => [f, c.x])),
    y: keys(local, k.map(([f, c]) => [f, c.y]))
  };
}

// ---- Composition ----

export function AuctraDemo() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const current = SCENES.find((s) => frame >= s.from && frame < s.from + s.duration) ?? SCENES[SCENES.length - 1];
  const local = frame - current.from;

  const dark = current.id === "cover" || current.id === "outro";
  const beatPulse = 1 - prog(frame % BEAT, 0, BEAT * 0.8);

  return (
    <AbsoluteFill style={{ background: C.cloud, fontFamily: F.sans, overflow: "hidden" }}>
      <Audio src={staticFile("soundtrack.wav")} />
      <Backdrop frame={frame} beatPulse={beatPulse} portrait={portrait} />
      {current.id !== "cover" && current.id !== "outro" && (
        <PhoneStage frame={frame} sceneId={current.id} local={local} portrait={portrait} width={width} height={height} />
      )}
      {CAPTIONS[current.id] && <CaptionBlock c={CAPTIONS[current.id]!} local={local} duration={current.duration} portrait={portrait} />}
      {current.id === "cover" && <Cover frame={frame} local={local} portrait={portrait} width={width} height={height} />}
      {current.id === "outro" && <Outro local={local} portrait={portrait} width={width} height={height} />}
      {dark && null}
    </AbsoluteFill>
  );
}

function Backdrop({ frame, beatPulse, portrait }: { frame: number; beatPulse: number; portrait: boolean }) {
  return (
    <>
      <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 47px, rgba(27,20,51,0.06) 47px 48px)" }} />
      <div
        style={{
          position: "absolute",
          width: portrait ? 1100 : 1000,
          height: portrait ? 1100 : 1000,
          left: portrait ? -10 : 790,
          top: portrait ? 700 : 40,
          borderRadius: 9999,
          background: `radial-gradient(circle, ${C.signal}55 0%, ${C.signal}00 62%)`,
          transform: `scale(${1 + beatPulse * 0.025 + Math.sin(frame / 40) * 0.02})`
        }}
      />
    </>
  );
}

function stageGeometry(portrait: boolean, width: number, height: number) {
  // Where the phone's centre sits, and its resting scale.
  return portrait ? { cx: width / 2, cy: 1310, base: 1.27 } : { cx: 1340, cy: height / 2, base: 1.05 };
}

function PhoneStage({ frame, sceneId, local, portrait, width, height }: { frame: number; sceneId: SceneId; local: number; portrait: boolean; width: number; height: number }) {
  const { cx, cy, base } = stageGeometry(portrait, width, height);
  const cam = camera(sceneId, local);
  const scale = base * cam.s;
  // Phone-space point (screen px, plus bezel) that the camera pushes toward.
  const fx = cam.x + 14;
  const fy = cam.y + 14;
  const pw = SCREEN_W + 28;
  const ph = SCREEN_H + 28;
  // Keep the focus point near the stage centre as we push in, but never slide the phone under the caption.
  const pull = Math.min(1, (cam.s - 1) * 1.6);
  const tx = (pw / 2 - fx) * base * pull * 0.85;
  const ty = (ph / 2 - fy) * base * pull * 0.85;
  const enterRise = sceneId === "start" ? (1 - progInOut(local, 0, 18)) * 260 : 0;
  const exitDrop = sceneId === "proof" ? progInOut(local, 104, 16) * 120 : 0;
  const tilt = Math.sin(frame / 55) * 0.6;

  return (
    <div
      style={{
        position: "absolute",
        left: cx - pw / 2,
        top: cy - ph / 2,
        width: pw,
        height: ph,
        transformOrigin: `${fx}px ${fy}px`,
        transform: `translate(${tx}px, ${ty + enterRise + exitDrop}px) scale(${scale}) rotate(${tilt}deg)`
      }}
    >
      <Phone time={sceneId === "runs" && local >= 6 ? EX.clockFriday : sceneId === "proof" ? EX.clockFriday : EX.clockMorning} dark>
        <Screen frame={frame} sceneId={sceneId} local={local} />
      </Phone>
    </div>
  );
}

/** Everything on the phone's screen for this frame. */
function Screen({ frame, sceneId, local }: { frame: number; sceneId: SceneId; local: number }) {
  // What's in the message box right now.
  let input = "";
  if (sceneId === "start" && local < T.start.send) input = typed(START_TEXT, local, T.start.typeFrom, T.start.keyEvery) && local >= T.start.typeFrom ? typed(START_TEXT, local, T.start.typeFrom, T.start.keyEvery) : "";
  if (sceneId === "ask" && local >= T.ask.typeFrom && local < T.ask.send) input = typed(REQUEST_TEXT, local, T.ask.typeFrom, KEY_EVERY);
  const caretOn = Math.floor(frame / 8) % 2 === 0 || input.length > 0;

  const sheetUp = sceneId === "setup" ? 1 - progInOut(local, 0, 14) : sceneId === "ask" ? progInOut(local, 0, 14) : 1;
  const historyUp = sceneId === "proof" ? 1 - progInOut(local, 0, 14) : 1;

  return (
    <>
      <TelegramChat frame={frame} messages={MESSAGES} input={input} caretOn={caretOn} />
      {(sceneId === "setup" || (sceneId === "ask" && local < 16)) && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, transform: `translateY(${sheetUp * SCREEN_H}px)` }}>
          <Onboarding f={sceneId === "setup" ? local : 4 * T.setup.step - 1} />
        </div>
      )}
      {sceneId === "proof" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, transform: `translateY(${historyUp * SCREEN_H}px)` }}>
          <HistoryScreen f={local} />
        </div>
      )}
      {sceneId === "runs" && <Banner local={local} />}
      <Taps frame={frame} sceneId={sceneId} local={local} />
    </>
  );
}

function Banner({ local }: { local: number }) {
  const t = progInOut(local, T.runs.banner, 10) * (1 - progInOut(local, T.runs.message + 10, 12));
  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        left: 10,
        right: 10,
        zIndex: 70,
        transform: `translateY(${(t - 1) * 140}px)`,
        opacity: t,
        borderRadius: 22,
        background: "rgba(255,252,247,0.96)",
        boxShadow: "0 18px 40px -16px rgba(27,20,51,0.5)",
        padding: "12px 14px",
        display: "flex",
        gap: 12,
        alignItems: "center"
      }}
    >
      <svg viewBox="0 0 32 32" width="40" height="40" style={{ borderRadius: 10, flexShrink: 0 }}>
        <rect width="32" height="32" rx="9" fill={C.obsidian} />
        <path d="M8.5 24.5 16 7.5l7.5 17" fill="none" stroke={C.signal} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16" cy="19.4" r="2.9" fill={C.cloud} />
      </svg>
      <div style={{ display: "grid", minWidth: 0, flex: 1, lineHeight: 1.3 }}>
        <span style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5 }}>
          <b style={{ color: C.obsidian }}>Auctra</b>
          <span style={{ color: C.slate, fontSize: 13 }}>now</span>
        </span>
        <span style={{ fontSize: 14.5, color: C.ink2 }}>Sent 20 USDC to Savings.</span>
      </div>
    </div>
  );
}

/** Finger taps, positioned over the thing being tapped (screen px). */
function Taps({ frame, sceneId, local }: { frame: number; sceneId: SceneId; local: number }) {
  const list: Array<{ at: number; x: number; y: number }> = [];
  if (sceneId === "start") {
    list.push({ at: T.start.send, x: 362, y: 776 });
  }
  if (sceneId === "setup") {
    const S = T.setup;
    list.push(
      { at: S.tapContinue, x: 195, y: 708 },
      { at: S.step + S.tapCreate, x: 195, y: 400 },
      { at: 2 * S.step + S.tapSave, x: 195, y: 742 },
      { at: 3 * S.step + S.tapApprove, x: 195, y: 762 }
    );
  }
  if (sceneId === "ask") list.push({ at: T.ask.send, x: 362, y: 776 });
  return (
    <>
      {list.map((t, i) => (
        <Tap key={i} frame={local} at={t.at} x={t.x} y={t.y} />
      ))}
      {frame < 0 && null}
    </>
  );
}


// ---- Captions ----

function CaptionBlock({ c, local, duration, portrait }: { c: Caption; local: number; duration: number; portrait: boolean }) {
  const out = progInOut(local, duration - 10, 10);
  const a = enter(local, 2, 24, 10);
  const b = enter(local, 6, 24, 10);
  const d = enter(local, 10, 24, 10);
  const box: CSSProperties = portrait
    ? { left: 72, right: 72, top: 120, textAlign: "left" }
    : { left: 130, width: 760, top: "50%", transform: "translateY(-50%)" };
  const H = portrait ? 104 : 104;
  return (
    <>
    {portrait && (
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 680,
          zIndex: 15,
          background: `linear-gradient(to bottom, ${C.cloud} 0, ${C.cloud} 600px, rgba(245,239,228,0) 680px)`
        }}
      />
    )}
    <div style={{ position: "absolute", ...box, opacity: 1 - out, zIndex: 20 }}>
      <div style={{ ...a, display: "flex", alignItems: "center", gap: 18, fontSize: portrait ? 34 : 30, fontWeight: 600, color: C.obsidian }}>
        <span
          style={{
            fontFamily: F.display,
            fontSize: portrait ? 34 : 30,
            background: C.obsidian,
            color: C.signal,
            borderRadius: 999,
            padding: "6px 18px",
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {c.n}
        </span>
        <span style={{ letterSpacing: "0.08em", textTransform: "uppercase", color: C.slate }}>{c.label}</span>
      </div>
      <h2
        style={{
          ...b,
          margin: "26px 0 0",
          fontFamily: F.display,
          fontWeight: 500,
          fontSize: H,
          lineHeight: 1.02,
          letterSpacing: "-0.03em",
          color: C.obsidian,
          ...displayAxes
        }}
      >
        {c.plain}
        <span style={accentItalic}>{c.accent}</span>
      </h2>
      <p style={{ ...d, margin: "26px 0 0", fontSize: portrait ? 42 : 38, lineHeight: 1.3, color: C.ink2, maxWidth: portrait ? 900 : 700 }}>{c.sub}</p>
    </div>
    </>
  );
}

// ---- Bookends ----

function DarkBand({ children, opacity = 1 }: { children: ReactNode; opacity?: number }) {
  return (
    <AbsoluteFill style={{ background: C.obsidian, opacity }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "5px 5px" }} />
      {children}
    </AbsoluteFill>
  );
}

/** Frame 0 is a finished cover (the thumbnail). It only moves when it leaves. */
function Cover({ frame, local, portrait, width, height }: { frame: number; local: number; portrait: boolean; width: number; height: number }) {
  const leave = progInOut(local, BAR * 2 - 16, 16);
  const { cx, cy, base } = stageGeometry(portrait, width, height);
  const pw = SCREEN_W + 28;
  const ph = SCREEN_H + 28;
  const float = Math.sin(frame / 30) * 6;
  return (
    <DarkBand>
      <div
        style={{
          position: "absolute",
          left: cx - pw / 2,
          top: cy - ph / 2 + float + leave * 40,
          width: pw,
          height: ph,
          transform: `scale(${base * (portrait ? 0.98 : 1)}) rotate(${-2 + leave * 2}deg)`,
          opacity: 1 - leave
        }}
      >
        <div style={{ position: "absolute", inset: 0, borderRadius: 64, boxShadow: `14px 14px 0 0 ${C.signal}` }} />
        <Phone time={EX.clockMorning} dark>
          <TelegramChat frame={at("confirm", T.confirm.active + 20)} messages={MESSAGES.slice(0, 5)} input="" caretOn={false} />
        </Phone>
      </div>
      <div
        style={{
          position: "absolute",
          ...(portrait ? { left: 80, right: 80, top: 110 } : { left: 130, width: 860, top: "50%", transform: "translateY(-50%)" }),
          color: C.cloud,
          opacity: 1 - leave,
          translate: `0 ${-leave * 30}px`
        }}
      >
        <Wordmark size={portrait ? 64 : 60} color={C.cloud} />
        <h1
          style={{
            margin: portrait ? "44px 0 0" : "48px 0 0",
            fontFamily: F.display,
            fontWeight: 500,
            fontSize: portrait ? 136 : 132,
            lineHeight: 0.98,
            letterSpacing: "-0.03em",
            ...displayAxes
          }}
        >
          Money that <span style={{ ...accentItalic, color: C.cloud, backgroundImage: `linear-gradient(to top, ${C.signal}99 0 30%, transparent 30%)` }}>moves itself.</span>
        </h1>
        <p style={{ margin: "34px 0 0", fontSize: portrait ? 42 : 38, lineHeight: 1.3, color: "rgba(245,239,228,0.78)", maxWidth: 820 }}>
          Say it once. Auctra pays, saves and sweeps for you, on time, every time.
        </p>
        <div style={{ marginTop: 34, display: "flex", gap: 14 }}>
          <Pill style={{ fontSize: portrait ? 26 : 24, padding: "10px 22px", background: C.obsidian2, color: C.cloud, border: `1px solid ${C.obsidianLine}` }}>
            <span style={{ width: 12, height: 12, borderRadius: 9, background: C.signal }} /> Monad Testnet
          </Pill>
        </div>
      </div>
    </DarkBand>
  );
}

function Outro({ local, portrait, width, height }: { local: number; portrait: boolean; width: number; height: number }) {
  const bg = prog(local, 0, 10);
  const words = ["Pays.", "Saves.", "Sweeps."];
  return (
    <DarkBand opacity={bg}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: C.cloud, textAlign: "center" }}>
        <div style={{ ...enter(local, 4, 30, 12) }}>
          <Wordmark size={portrait ? 120 : 110} color={C.cloud} />
        </div>
        <div
          style={{
            marginTop: portrait ? 70 : 54,
            display: "flex",
            flexDirection: portrait ? "column" : "row",
            gap: portrait ? 6 : 34,
            fontFamily: F.display,
            fontWeight: 500,
            fontSize: portrait ? 132 : 112,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            ...displayAxes
          }}
        >
          {words.map((w, i) => (
            <span key={w} style={{ ...enter(local, 12 + i * BEAT * 0.5, 30, 10), ...(i === 2 ? accentItalic : {}) }}>
              {w}
            </span>
          ))}
        </div>
        <div style={{ marginTop: portrait ? 80 : 60, display: "grid", justifyItems: "center", gap: 22, ...enter(local, 40, 24, 12) }}>
          <Pill style={{ fontSize: portrait ? 46 : 40, padding: portrait ? "26px 56px" : "22px 48px", background: C.signal, color: C.obsidian }}>
            Start in Telegram →
          </Pill>
          <span style={{ fontFamily: F.mono, fontSize: portrait ? 40 : 34, color: "rgba(245,239,228,0.85)" }}>t.me/AuctraBot</span>
        </div>
        <div style={{ position: "absolute", bottom: portrait ? 110 : 70, ...enter(local, 50, 10, 10) }}>
          <ChainChip scale={portrait ? 1.9 : 1.6} />
        </div>
      </AbsoluteFill>
      {width + height < 0 && null}
    </DarkBand>
  );
}
