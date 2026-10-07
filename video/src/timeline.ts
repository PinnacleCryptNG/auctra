// The one clock for the whole film. Visuals and audio both read from here, so a
// tap you see and the tap you hear can never drift apart.

export const FPS = 30;
export const BPM = 120;
/** Frames per beat and per 4/4 bar at this tempo. */
export const BEAT = (60 / BPM) * FPS; // 15
export const BAR = BEAT * 4; // 60 = 2 s

export type SceneId = "cover" | "start" | "setup" | "ask" | "confirm" | "runs" | "proof" | "outro";

const SCENE_BARS: Array<[SceneId, number]> = [
  ["cover", 2],
  ["start", 2],
  ["setup", 4],
  ["ask", 3],
  ["confirm", 3],
  ["runs", 2],
  ["proof", 2],
  ["outro", 2]
];

export type Scene = { id: SceneId; from: number; duration: number };

export const SCENES: Scene[] = (() => {
  let at = 0;
  return SCENE_BARS.map(([id, bars]) => {
    const scene = { id, from: at, duration: bars * BAR };
    at += scene.duration;
    return scene;
  });
})();

export const TOTAL = SCENES.reduce((sum, s) => sum + s.duration, 0);
export const scene = (id: SceneId) => SCENES.find((s) => s.id === id)!;

// ---- Copy shown on screen (from the real app and bot) ----

export const START_TEXT = "/start";
export const REQUEST_TEXT = "Save 20 USDC to my savings wallet every Friday at 6 PM";
export const DEST_NAME = "Savings";

/** Frames between keystrokes while "typing". */
export const KEY_EVERY = 2;

// ---- Beats inside each scene, in scene-local frames ----

export const T = {
  start: { typeFrom: 8, keyEvery: 3, send: 30, botReply: 48, tapSetup: 96 },
  setup: {
    sheetIn: 0,
    // four sub-screens, one per beat-pair (each 60 frames = one bar)
    step: 60,
    tapContinue: 34,
    tapCreate: 16,
    walletShown: 30,
    tapNext: 46,
    nameFrom: 8,
    tapSave: 40,
    tapApprove: 30,
    done: 42
  },
  ask: { sheetOut: 0, typeFrom: 20, send: 0 /* set below */ },
  confirm: { reply: 10, tapConfirm: 112, active: 128 },
  runs: { clock: 0, banner: 18, message: 54 },
  proof: { enter: 0, row: 14 },
  outro: {}
};
T.ask.send = T.ask.typeFrom + REQUEST_TEXT.length * KEY_EVERY + 10;

// ---- Sound events, in absolute frames ----

export type SfxKind = "tap" | "key" | "send" | "incoming" | "notify" | "whoosh" | "success";
export type Sfx = { frame: number; kind: SfxKind };

export const SFX: Sfx[] = (() => {
  const s = (id: SceneId) => scene(id).from;
  const out: Sfx[] = [];
  const add = (frame: number, kind: SfxKind) => out.push({ frame, kind });

  // scene transitions land on the bar with a soft whoosh just before
  for (const sc of SCENES.slice(1)) add(sc.from - 6, "whoosh");

  // 1 start
  for (let i = 0; i < START_TEXT.length; i++) add(s("start") + T.start.typeFrom + i * T.start.keyEvery, "key");
  add(s("start") + T.start.send, "send");
  add(s("start") + T.start.botReply, "incoming");
  add(s("start") + T.start.tapSetup, "tap");

  // 2 setup: one tap per sub-screen
  const st = s("setup");
  add(st + T.setup.tapContinue, "tap");
  add(st + T.setup.step + T.setup.tapCreate, "tap");
  add(st + T.setup.step + T.setup.walletShown, "success");
  for (let i = 0; i < DEST_NAME.length; i++) add(st + 2 * T.setup.step + T.setup.nameFrom + i * KEY_EVERY, "key");
  add(st + 2 * T.setup.step + T.setup.tapSave, "tap");
  add(st + 3 * T.setup.step + T.setup.tapApprove, "tap");
  add(st + 3 * T.setup.step + T.setup.done, "success");

  // 3 ask
  for (let i = 0; i < REQUEST_TEXT.length; i++) {
    if (REQUEST_TEXT[i] !== " " || i % 3 === 0) add(s("ask") + T.ask.typeFrom + i * KEY_EVERY, "key");
  }
  add(s("ask") + T.ask.send, "send");

  // 4 confirm
  add(s("confirm") + T.confirm.reply, "incoming");
  add(s("confirm") + T.confirm.tapConfirm, "tap");
  add(s("confirm") + T.confirm.active, "incoming");

  // 5 runs
  add(s("runs") + T.runs.banner, "notify");
  add(s("runs") + T.runs.message, "incoming");

  // 6 proof
  add(s("proof") + T.proof.row, "success");

  return out.sort((a, b) => a.frame - b.frame);
})();
