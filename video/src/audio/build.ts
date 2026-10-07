// Writes public/soundtrack.wav: an original score plus interface sounds, all
// synthesised here (nothing to license). Timing comes from ../timeline, the same
// file that drives the picture, so every tap you hear is on the frame you see it.
import { writeFileSync } from "node:fs";
import { BAR, BEAT, FPS, SCENES, SFX, TOTAL, scene, type SfxKind } from "../timeline";

const SR = 48000;
const seconds = TOTAL / FPS + 1.5; // let the last chord ring
const N = Math.ceil(seconds * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

const secPerFrame = 1 / FPS;
const beatSec = BEAT * secPerFrame; // 0.5 s
const barSec = BAR * secPerFrame; // 2 s
const at = (frame: number) => Math.round(frame * secPerFrame * SR);
const barOf = (id: Parameters<typeof scene>[0]) => scene(id).from / BAR;

// deterministic noise so renders are identical
let seed = 1337;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function add(start: number, buf: Float32Array, gain: number, pan = 0) {
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < buf.length; i++) {
    const j = start + i;
    if (j < 0 || j >= N) continue;
    L[j] += buf[i] * gl;
    R[j] += buf[i] * gr;
  }
}

/** Simple voices. Each returns a mono buffer. */
function tone(freq: number, dur: number, opts: { attack?: number; decay?: number; shape?: "sine" | "tri" | "saw"; detune?: number; bright?: number } = {}) {
  const { attack = 0.005, decay = dur, shape = "sine", detune = 0, bright = 0 } = opts;
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  let p1 = 0;
  let p2 = 0;
  let lp = 0;
  const f2 = freq * Math.pow(2, detune / 1200);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / attack) * Math.exp(-t / Math.max(0.0001, decay));
    p1 += freq / SR;
    p2 += f2 / SR;
    const osc = (ph: number) =>
      shape === "sine" ? Math.sin(2 * Math.PI * ph) : shape === "tri" ? 1 - 4 * Math.abs((ph % 1) - 0.5) : 2 * (ph % 1) - 1;
    let v = (osc(p1) + (detune ? osc(p2) : 0)) / (detune ? 2 : 1);
    // gentle low-pass that opens with `bright`
    const a = 0.08 + bright * 0.6;
    lp += a * (v - lp);
    v = shape === "sine" ? v : lp;
    out[i] = v * env;
  }
  // tiny fade-out to avoid clicks
  for (let i = 0; i < Math.min(240, n); i++) out[n - 1 - i] *= i / 240;
  return out;
}

function noise(dur: number, decay: number, hp = 0.6) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const x = rnd();
    const h = x - prev * hp; // crude high-pass
    prev = x;
    out[i] = h * Math.exp(-t / decay);
  }
  return out;
}

function sweep(dur: number, f0: number, f1: number, gain = 1) {
  // band-limited noise whoosh: noise through a moving resonant filter
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  let lo = 0;
  let band = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = f0 * Math.pow(f1 / f0, t);
    const k = 2 * Math.sin((Math.PI * f) / SR);
    const x = rnd();
    lo += k * band;
    const hi = x - lo - 0.5 * band;
    band += k * hi;
    const env = Math.sin(Math.PI * t) ** 2;
    out[i] = band * env * gain;
  }
  return out;
}

// ---------------- Score ----------------

// F major colour: Fmaj7 · Am7 · Dm9 · B♭maj7, one chord per bar.
const CHORDS = [
  [53, 57, 60, 64], // F A C E
  [57, 60, 64, 67], // A C E G
  [50, 57, 60, 64], // D A C E (Dm9-ish)
  [46, 53, 57, 62] // Bb F A D
];
const ROOTS = [41, 45, 38, 46];

const totalBars = Math.round(TOTAL / BAR);
const groove = { from: barOf("start"), to: barOf("outro") };
const drop = barOf("runs");

for (let bar = 0; bar < totalBars + 1; bar++) {
  const t0 = bar * barSec;
  const s0 = Math.round(t0 * SR);
  const chord = CHORDS[bar % 4];
  const inGroove = bar >= groove.from && bar < groove.to;
  const isOutro = bar >= groove.to;
  if (bar > totalBars - 1 && !isOutro) continue;

  // pad: always, softer in the groove
  if (bar < totalBars) {
    for (const [i, n] of chord.entries()) {
      add(s0, tone(midi(n + 12), barSec + 0.6, { attack: 0.25, decay: 2.2, shape: "saw", detune: 9, bright: 0.12 }), inGroove ? 0.032 : 0.05, (i - 1.5) * 0.35);
    }
  }

  // plucked arpeggio in 8ths (16ths in the drop)
  const steps = bar >= drop && inGroove ? 16 : 8;
  if (bar < totalBars && !isOutro) {
    for (let s = 0; s < steps; s++) {
      const n = chord[(s * 2 + (s >> 2)) % 4] + 24;
      const st = s0 + Math.round((s * barSec * SR) / steps);
      add(st, tone(midi(n), 0.28, { attack: 0.002, decay: 0.11, shape: "tri", bright: 0.5 }), bar < groove.from ? 0.05 : 0.07, s % 2 ? 0.35 : -0.35);
    }
  }

  if (inGroove) {
    // kick on every beat, softer on 2 and 4
    for (let b = 0; b < 4; b++) {
      const st = s0 + Math.round(b * beatSec * SR);
      const n = Math.floor(0.35 * SR);
      const k = new Float32Array(n);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        ph += (48 + 110 * Math.exp(-t / 0.03)) / SR;
        k[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.12);
      }
      add(st, k, b % 2 ? 0.32 : 0.42);
      // clap on 2 and 4
      if (b % 2) add(st, noise(0.18, 0.045, 0.9), 0.07, 0.1);
      // hats on the off-beats
      add(st + Math.round((beatSec / 2) * SR), noise(0.05, 0.012, 0.98), 0.05, -0.2);
      if (bar >= drop) add(st + Math.round((beatSec / 4) * SR), noise(0.03, 0.008, 0.98), 0.025, 0.3);
    }
    // bass: root on 1, octave pop on the "and" of 2, root on 3
    const root = ROOTS[bar % 4];
    for (const [beat, n, len] of [
      [0, root, 0.45],
      [1.5, root + 12, 0.2],
      [2, root, 0.45],
      [3.5, root + 7, 0.2]
    ] as Array<[number, number, number]>) {
      add(s0 + Math.round(beat * beatSec * SR), tone(midi(n), len, { attack: 0.004, decay: len * 0.7, shape: "saw", bright: 0.05 }), 0.16);
    }
  }
}

// lift into the drop and a riser into the end card
add(at(scene("runs").from) - Math.round(1.0 * SR), sweep(1.0, 300, 6000, 0.6), 0.25);
add(at(scene("outro").from) - Math.round(1.0 * SR), sweep(1.0, 400, 7000, 0.6), 0.25);
// final chord hit on the end card, then ring out
{
  const s0 = at(scene("outro").from);
  for (const [i, n] of [53, 60, 64, 69, 72].entries()) add(s0, tone(midi(n), 4, { attack: 0.01, decay: 1.6, shape: "tri", bright: 0.4 }), 0.07, (i - 2) * 0.3);
  const k = new Float32Array(Math.floor(0.6 * SR));
  let ph = 0;
  for (let i = 0; i < k.length; i++) {
    const t = i / SR;
    ph += (40 + 90 * Math.exp(-t / 0.05)) / SR;
    k[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.3);
  }
  add(s0, k, 0.45);
}

// ---------------- Interface sounds ----------------

function sfx(kind: SfxKind): [Float32Array, number] {
  switch (kind) {
    case "key": {
      const f = 1800 + rnd() * 500;
      const a = tone(f, 0.03, { decay: 0.008 });
      const b = noise(0.02, 0.004, 0.95);
      for (let i = 0; i < b.length; i++) a[i] += b[i] * 0.6;
      return [a, 0.1];
    }
    case "tap": {
      const n = Math.floor(0.09 * SR);
      const out = new Float32Array(n);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        ph += (300 + 500 * Math.exp(-t / 0.012)) / SR;
        out[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.025);
      }
      const b = noise(0.01, 0.002, 0.9);
      for (let i = 0; i < b.length; i++) out[i] += b[i] * 0.5;
      return [out, 0.32];
    }
    case "send": {
      const w = sweep(0.22, 400, 5000, 0.8);
      const n = Math.floor(0.16 * SR);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        ph += (520 + 900 * (t / 0.16)) / SR;
        w[i] += Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.05) * 0.6;
      }
      return [w, 0.22];
    }
    case "incoming": {
      const a = tone(midi(81), 0.25, { decay: 0.07 });
      const b = tone(midi(88), 0.3, { decay: 0.09 });
      const out = new Float32Array(Math.floor(0.36 * SR));
      out.set(a.subarray(0, Math.min(a.length, out.length)));
      const off = Math.floor(0.06 * SR);
      for (let i = 0; i < b.length && off + i < out.length; i++) out[off + i] += b[i];
      return [out, 0.16];
    }
    case "notify": {
      const out = new Float32Array(Math.floor(1.2 * SR));
      [77, 81, 84, 89].forEach((n, k) => {
        const v = tone(midi(n), 1.0, { decay: 0.35 });
        const h = tone(midi(n) * 2.76, 0.4, { decay: 0.08 }); // bell partial
        const off = Math.floor(k * 0.07 * SR);
        for (let i = 0; i < v.length && off + i < out.length; i++) out[off + i] += v[i] + h[i < h.length ? i : 0] * (i < h.length ? 0.3 : 0);
      });
      return [out, 0.14];
    }
    case "success": {
      const out = new Float32Array(Math.floor(0.6 * SR));
      [72, 76, 79].forEach((n, k) => {
        const v = tone(midi(n), 0.4, { decay: 0.12, shape: "tri", bright: 0.7 });
        const off = Math.floor(k * 0.05 * SR);
        for (let i = 0; i < v.length && off + i < out.length; i++) out[off + i] += v[i];
      });
      return [out, 0.13];
    }
    case "whoosh":
      return [sweep(0.32, 2500, 300, 0.7), 0.12];
  }
}

for (const e of SFX) {
  const [buf, gain] = sfx(e.kind);
  // whooshes lead into the cut; everything else lands on its frame
  add(at(e.frame), buf, gain, e.kind === "key" ? rnd() * 0.3 : 0);
}

// ---------------- Master: soft clip, normalise, write ----------------

let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * 1.2);
  R[i] = Math.tanh(R[i] * 1.2);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;
// fade the tail
const fadeFrom = N - Math.round(1.2 * SR);

const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const f = i > fadeFrom ? 1 - (i - fadeFrom) / (N - fadeFrom) : 1;
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm * f)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm * f)) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);
writeFileSync(new URL("../../public/soundtrack.wav", import.meta.url), Buffer.concat([header, data]));
console.log(`soundtrack.wav: ${seconds.toFixed(1)} s, ${SFX.length} interface sounds, ${SCENES.length} scenes`);
