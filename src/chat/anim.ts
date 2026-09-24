import {createContext, useContext} from 'react';
import {spring} from 'remotion';

// The screen renders from an explicit frame (not useCurrentFrame) so a contact
// sheet can draw many frames of the same video in one still.
export const TimeCtx = createContext({frame: 0, fps: 60});
export const useTime = () => useContext(TimeCtx);

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// iOS-like spring. `f` is frames since the animation start. Returns 0 before start.
export function ios(f: number, fps: number, cfg: {damping?: number; stiffness?: number; mass?: number} = {}) {
  if (f < 0) return 0;
  return spring({frame: f, fps, config: {damping: 22, stiffness: 260, mass: 1, ...cfg}});
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Deterministic pseudo-random in [0,1) from integers.
export function rand(...n: number[]) {
  let h = 2166136261;
  for (const x of n) {
    h ^= Math.floor(x * 1000) | 0;
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
