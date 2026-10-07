import { Easing, interpolate } from "remotion";

const ease = Easing.bezier(0.2, 0.7, 0.2, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 over `dur` frames starting at `from`, with the app's enter easing. */
export const prog = (frame: number, from: number, dur = 8, easing = ease) =>
  interpolate(frame, [from, from + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

export const progInOut = (frame: number, from: number, dur: number) => prog(frame, from, dur, inOut);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Keyframed value: [[frame, value], ...] with in-out easing between keys. */
export function keys(frame: number, k: Array<[number, number]>) {
  if (frame <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (frame <= k[i][0]) {
      const t = progInOut(frame, k[i - 1][0], k[i][0] - k[i - 1][0]);
      return lerp(k[i - 1][1], k[i][1], t);
    }
  }
  return k[k.length - 1][1];
}

/** Characters of `text` typed so far, one every `every` frames from `from`. */
export const typed = (text: string, frame: number, from: number, every: number) =>
  text.slice(0, Math.max(0, Math.min(text.length, Math.floor((frame - from) / every) + 1)));

/** Entrance style for UI that appears at `from` (fade + 4px rise, like animate-enter). */
export const enter = (frame: number, from: number, rise = 10, dur = 8) => {
  const t = prog(frame, from, dur);
  return { opacity: t, transform: `translateY(${(1 - t) * rise}px) scale(${0.97 + 0.03 * t})` };
};
