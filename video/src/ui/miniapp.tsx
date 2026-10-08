import type { CSSProperties, ReactNode } from "react";
import { C, F } from "../brand";
import { EX, short } from "../data";
import { DEST_NAME, KEY_EVERY, T } from "../timeline";
import { prog, typed } from "./anim";
import { Check, LogoMark, pressed } from "./bits";

const STEPS = ["Account", "Wallet", "Destination", "Permission"];

/** Telegram's mini-app sheet chrome around Auctra's paper UI. */
export function MiniAppSheet({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.cloud }}>
      <div
        style={{
          height: 112,
          padding: "54px 18px 0",
          background: C.obsidian2,
          color: C.cloud,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 17
        }}
      >
        <span style={{ color: C.signal, fontWeight: 500 }}>Close</span>
        <span style={{ display: "grid", textAlign: "center", lineHeight: 1.15 }}>
          <span style={{ fontWeight: 600 }}>Auctra</span>
          <span style={{ fontSize: 13, opacity: 0.6 }}>mini app</span>
        </span>
        <span style={{ width: 30, height: 30, borderRadius: 99, border: `2px solid ${C.signal}`, display: "grid", placeItems: "center" }}>
          <span style={{ display: "flex", gap: 3 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 3.5, height: 3.5, borderRadius: 9, background: C.signal }} />
            ))}
          </span>
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 112,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, rgba(27,20,51,0.05) 31px 32px)"
        }}
      >
        {children}
      </div>
    </div>
  );
}

function AppHeader() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${C.line}`, background: C.cloud }}>
      <svg width="20" height="14" viewBox="0 0 20 14">
        <path d="M19 7H2M7 1 1 7l6 6" fill="none" stroke={C.obsidian} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <LogoMark size={36} />
      <span style={{ fontFamily: F.display, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: C.obsidian, fontVariationSettings: '"SOFT" 100, "opsz" 48' }}>
        Auctra
      </span>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "14px 20px 10px", background: C.cloud }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: "grid", gap: 8 }}>
          <span style={{ height: 4, borderRadius: 9, background: i <= step ? C.obsidian : C.line }} />
          <span style={{ fontSize: 12.5, color: i === step ? C.obsidian : C.slate, fontWeight: i === step ? 600 : 400 }}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function StepCard({ index, title, description, children, style }: { index: number; title: string; description: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ margin: "14px 16px", padding: 20, borderRadius: 18, background: C.surface, border: `1px solid ${C.line}`, ...style }}>
      <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: C.slate, fontWeight: 500 }}>
        Step {index + 1} of 4
      </p>
      <h1
        style={{
          margin: "4px 0 0",
          fontFamily: F.display,
          fontSize: 27,
          lineHeight: 1.1,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: C.obsidian,
          fontVariationSettings: '"SOFT" 100, "opsz" 72'
        }}
      >
        {title}
      </h1>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: C.slate }}>{description}</p>
      <div style={{ marginTop: 18, display: "grid", gap: 14 }}>{children}</div>
    </div>
  );
}

function Button({ children, frame, tapAt, loading, until = Infinity }: { children: ReactNode; frame: number; tapAt: number; loading?: string; until?: number }) {
  const busy = loading && frame >= tapAt && frame < until;
  return (
    <div
      style={{
        height: 50,
        borderRadius: 999,
        background: frame >= tapAt - 2 && frame <= tapAt + 4 ? C.signalStrong : C.signal,
        color: C.obsidian,
        fontWeight: 600,
        fontSize: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        transform: `scale(${pressed(frame, tapAt)})`
      }}
    >
      {busy && <Spinner frame={frame} />}
      {busy ? loading : children}
    </div>
  );
}

function Spinner({ frame }: { frame: number }) {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: 99,
        border: `2px solid rgba(27,20,51,0.25)`,
        borderTopColor: C.obsidian,
        transform: `rotate(${frame * 24}deg)`
      }}
    />
  );
}

function Field({ label, hint, children, mono }: { label: string; hint?: string; children: ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.obsidian }}>{label}</span>
      <div
        style={{
          minHeight: 46,
          borderRadius: 12,
          border: `1px solid ${C.line}`,
          background: C.surface,
          padding: "11px 14px",
          fontSize: mono ? 12.5 : 16,
          fontFamily: mono ? F.mono : F.sans,
          color: C.obsidian,
          wordBreak: "break-all",
          lineHeight: 1.4
        }}
      >
        {children}
      </div>
      {hint && <span style={{ fontSize: 12.5, color: C.slate }}>{hint}</span>}
    </div>
  );
}

const slideIn = (lf: number): CSSProperties => {
  const t = prog(lf, 0, 9);
  return { opacity: t, transform: `translateX(${(1 - t) * 28}px)` };
};

/** The four onboarding steps, one per bar. `f` is frames since the setup scene began. */
export function Onboarding({ f }: { f: number }) {
  const S = T.setup;
  const sub = Math.min(3, Math.floor(f / S.step));
  const lf = f - sub * S.step;
  const done = sub === 3 && lf >= S.done;
  return (
    <MiniAppSheet>
      <AppHeader />
      {!done && <Progress step={sub} />}
      {sub === 0 && (
        <StepCard index={0} title="Who is Auctra working for?" description="You can't change this later." style={slideIn(f)}>
          {[
            ["Personal", "Save and pay bills.", true],
            ["Business", "Pay vendors and staff.", false]
          ].map(([t, d, on]) => (
            <div
              key={t as string}
              style={{
                borderRadius: 18,
                border: `1px solid ${on ? C.obsidian : C.line}`,
                background: on ? "rgba(245,239,228,0.6)" : C.surface,
                padding: 16,
                display: "grid",
                gap: 4
              }}
            >
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600, fontSize: 16, color: C.obsidian }}>
                {t}
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 99,
                    border: `1px solid ${on ? C.obsidian : C.line}`,
                    background: on ? C.obsidian : "transparent",
                    display: "grid",
                    placeItems: "center"
                  }}
                >
                  {on && <Check size={13} color={C.cloud} />}
                </span>
              </span>
              <span style={{ fontSize: 14, color: C.slate }}>{d}</span>
            </div>
          ))}
          <Field label="Timezone" hint="Schedules run in this timezone.">
            {EX.timezone}
          </Field>
          <Button frame={lf} tapAt={S.tapContinue} loading="Creating your account…">
            Continue
          </Button>
        </StepCard>
      )}
      {sub === 1 && (
        <StepCard index={1} title="Connect your Auctra Wallet" description="You own it. Auctra never sees its keys." style={slideIn(lf)}>
          {lf < S.walletShown ? (
            <p style={{ margin: 0, fontSize: 14, color: C.ink2 }}>No wallet yet. Create one in seconds.</p>
          ) : (
            <div style={{ borderRadius: 18, border: `1px solid ${C.line}`, background: C.cloud, padding: 16, display: "grid", gap: 6, ...slideIn(lf - S.walletShown) }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15 }}>
                <Check /> Auctra Wallet
              </span>
              <span style={{ fontFamily: F.mono, fontSize: 13.5, color: C.ink2 }}>{short(EX.wallet)}</span>
            </div>
          )}
          {lf < S.walletShown && (
            <Button frame={lf} tapAt={S.tapCreate} loading="Creating your wallet…" until={S.walletShown}>
              Create wallet
            </Button>
          )}
        </StepCard>
      )}
      {sub === 2 && (
        <StepCard index={2} title="Save your first destination" description="Auctra only sends to wallets you save." style={slideIn(lf)}>
          <Field label="Name" hint="For example: Savings wallet, Acme Hosting">
            {typed(DEST_NAME, lf, S.nameFrom, KEY_EVERY) || " "}
          </Field>
          <Field label="Category">Savings</Field>
          <Field label="Wallet address" mono>
            {lf >= S.nameFrom + DEST_NAME.length * KEY_EVERY + 4 ? EX.savings : <span style={{ color: C.slate }}>0x…</span>}
          </Field>
          <Button frame={lf} tapAt={S.tapSave} loading="Checking…">
            Review destination
          </Button>
        </StepCard>
      )}
      {sub === 3 && !done && (
        <StepCard index={3} title="Allow Auctra to send scheduled transfers" description="Auctra can only do this:" style={slideIn(lf)}>
          {["Send USDC only", "Up to 100 USDC per transfer", "Up to 250 USDC per day"].map((item) => (
            <span key={item} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 15, color: C.obsidian }}>
              <Check /> {item}
            </span>
          ))}
          <span style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 15, color: C.obsidian }}>
            <Check />
            <span style={{ display: "grid", gap: 4 }}>
              Only to:
              <span style={{ fontWeight: 600, fontSize: 14 }}>{DEST_NAME}</span>
              <span style={{ fontFamily: F.mono, fontSize: 12, color: C.ink2, wordBreak: "break-all" }}>{EX.savings}</span>
            </span>
          </span>
          <div style={{ borderRadius: 18, border: `1px solid ${C.line}`, background: "rgba(245,239,228,0.6)", padding: 14, fontSize: 13.5, color: C.ink2 }}>
            Only you can change these. Revoke anytime in Profile.
          </div>
          <Button frame={lf} tapAt={S.tapApprove} loading="Waiting for your wallet…">
            Approve permission
          </Button>
        </StepCard>
      )}
      {done && (
        <div style={{ margin: "24px 16px", padding: 24, borderRadius: 18, background: C.surface, border: `1px solid ${C.line}`, ...slideIn(lf - S.done) }}>
          <span style={{ width: 52, height: 52, borderRadius: 99, background: C.signalSoft, display: "grid", placeItems: "center" }}>
            <Check size={26} />
          </span>
          <h1 style={{ margin: "16px 0 0", fontFamily: F.display, fontSize: 30, fontWeight: 500, color: C.obsidian, letterSpacing: "-0.02em" }}>You&apos;re set up</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: C.slate }}>Add USDC and a little MON for fees, then tell Auctra what to do.</p>
        </div>
      )}
    </MiniAppSheet>
  );
}

/** The History page (app/dashboard/activity) as it looks on a phone. */
export function HistoryScreen({ f }: { f: number }) {
  const row = prog(f, T.proof.row, 9);
  return (
    <MiniAppSheet>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: `1px solid ${C.line}`, background: "rgba(245,239,228,0.9)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={32} />
          <span style={{ fontFamily: F.display, fontSize: 22, fontWeight: 600, color: C.obsidian }}>Auctra</span>
        </span>
        <span style={{ height: 34, padding: "0 14px", borderRadius: 99, background: C.signal, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 14 }}>
          + Create
        </span>
      </div>
      <div style={{ padding: "20px 18px 0" }}>
        <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", color: C.obsidian }}>History</h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: C.slate }}>Every transfer, newest first.</p>
      </div>
      <div style={{ margin: "16px 16px", borderRadius: 18, background: C.surface, border: `1px solid ${C.line}`, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", display: "grid", gap: 6, opacity: row, transform: `translateY(${(1 - row) * 10}px)`, background: row < 1 ? C.signalSoft : C.surface }}>
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: C.obsidian }}>20 USDC</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 99, padding: "3px 10px", background: C.signalSoft, color: C.signalInk, fontSize: 13, fontWeight: 600 }}>
              <Check size={13} /> Completed
            </span>
          </span>
          <span style={{ fontSize: 14, color: C.ink2 }}>
            to <b style={{ color: C.obsidian, fontWeight: 600 }}>{DEST_NAME}</b>
          </span>
          <span style={{ fontSize: 12.5, color: C.slate }}>{EX.historyDate}</span>
          <span style={{ fontFamily: F.mono, fontSize: 13, color: C.ink2 }}>{short(EX.tx)} ↗</span>
        </div>
      </div>
      <BottomNav active="History" />
    </MiniAppSheet>
  );
}

function BottomNav({ active }: { active: string }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 84,
        background: C.obsidian,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        paddingTop: 10,
        color: C.cloud
      }}
    >
      {["Overview", "Automations", "History", "Profile"].map((l) => (
        <span key={l} style={{ display: "grid", justifyItems: "center", gap: 6, fontSize: 12.5, fontWeight: l === active ? 600 : 400, color: l === active ? C.signal : "rgba(245,239,228,0.7)" }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${l === active ? C.signal : "rgba(245,239,228,0.55)"}` }} />
          {l}
        </span>
      ))}
    </div>
  );
}
