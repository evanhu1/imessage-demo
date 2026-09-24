import React from 'react';
import type {Seg, TextFx} from '../types';
import {clamp01, rand, useTime} from './anim';

// iOS 18+ animated text effects. They play once, when the message arrives (iOS replays them; we don't).
type T = {tx: number; ty: number; rot: number; scale: number; opacity: number; glow: number};
const ID: T = {tx: 0, ty: 0, rot: 0, scale: 1, opacity: 1, glow: 0};

function fxAt(fx: TextFx, tau: number, i: number, n: number, frame: number): T {
  const t = {...ID};
  switch (fx) {
    case 'big': {
      const p = clamp01((tau - i * 0.035) / 0.55);
      t.scale = 1 + 0.85 * Math.sin(Math.PI * p);
      t.ty = -2 * Math.sin(Math.PI * p);
      break;
    }
    case 'small': {
      const p = clamp01((tau - i * 0.035) / 0.55);
      t.scale = 1 - 0.45 * Math.sin(Math.PI * p);
      break;
    }
    case 'shake': {
      if (tau < 0.8) {
        const a = 2.6 * (1 - tau / 0.8);
        t.tx = a * Math.sin(tau * Math.PI * 2 * 11);
        t.rot = a * 0.8 * Math.sin(tau * Math.PI * 2 * 11 + 1);
      }
      break;
    }
    case 'nod': {
      if (tau < 1.1) {
        const a = 1 - tau / 1.1;
        t.ty = 3.2 * a * Math.sin(tau * Math.PI * 2 * 1.8);
        t.rot = 3.5 * a * Math.sin(tau * Math.PI * 2 * 1.8 - 0.6);
      }
      break;
    }
    case 'explode': {
      const p = clamp01(tau / 1.1);
      const k = Math.sin(Math.PI * p) ** 0.7;
      const ang = rand(i, 7) * Math.PI * 2;
      const dist = 14 + rand(i, 3) * 26;
      t.tx = Math.cos(ang) * dist * k;
      t.ty = Math.sin(ang) * dist * k - 6 * k;
      t.rot = (rand(i, 11) - 0.5) * 160 * k;
      t.scale = 1 + 0.3 * k;
      t.opacity = 1 - 0.35 * k;
      break;
    }
    case 'ripple': {
      const head = tau * 22 - 2; // wave position in letters
      const g = Math.exp(-((head - i) ** 2) / 5);
      t.ty = -5 * g;
      t.scale = 1 + 0.28 * g;
      break;
    }
    case 'bloom': {
      const p = clamp01((tau - (i / Math.max(1, n)) * 0.3) / 0.9);
      const k = Math.sin(Math.PI * p);
      t.scale = 1 + 0.3 * k;
      t.glow = k;
      break;
    }
    case 'jitter': {
      const step = Math.floor(frame / 2);
      t.tx = (rand(i, step, 1) - 0.5) * 1.8;
      t.ty = (rand(i, step, 2) - 0.5) * 1.8;
      t.rot = (rand(i, step, 3) - 0.5) * 6;
      break;
    }
  }
  return t;
}

const seg = new Intl.Segmenter(undefined, {granularity: 'grapheme'});
const graphemes = (s: string) => Array.from(seg.segment(s), (x) => x.segment);

export const FxText: React.FC<{segs: Seg[]; at: number; color: string}> = ({segs, at, color}) => {
  const {frame, fps} = useTime();
  const tau = Math.max(0, (frame - at) / fps); // seconds since the message landed
  let idx = 0;

  return (
    <>
      {segs.map((s, si) => {
        const style: React.CSSProperties = {
          fontWeight: s.bold ? 700 : undefined,
          fontStyle: s.italic ? 'italic' : undefined,
          textDecoration: [s.underline && 'underline', s.strike && 'line-through'].filter(Boolean).join(' ') || undefined,
        };
        if (!s.fx) {
          return (
            <span key={si} style={style}>
              {s.text}
            </span>
          );
        }
        const fx = s.fx;
        const chars = graphemes(s.text);
        const n = chars.length;
        const start = idx;
        idx += n;
        // Group letters into words so line wrapping still breaks at spaces.
        const words: {c: string; i: number}[][] = [[]];
        chars.forEach((c, k) => {
          if (c === ' ') words.push([{c, i: start + k}], []);
          else words[words.length - 1].push({c, i: start + k});
        });
        return (
          <span key={si} style={style}>
            {words.map((w, wi) =>
              w.length === 1 && w[0].c === ' ' ? (
                ' '
              ) : (
                <span key={wi} style={{display: 'inline-block', whiteSpace: 'nowrap'}}>
                  {w.map(({c, i}) => {
                    const t = fxAt(fx, tau, i - start, n, frame);
                    return (
                      <span
                        key={i}
                        style={{
                          display: 'inline-block',
                          transform: `translate(${t.tx}px, ${t.ty}px) rotate(${t.rot}deg) scale(${t.scale})`,
                          transformOrigin: '50% 70%',
                          opacity: t.opacity,
                          textShadow: t.glow ? `0 0 ${6 * t.glow}px ${color}` : undefined,
                          whiteSpace: 'pre',
                        }}
                      >
                        {c}
                      </span>
                    );
                  })}
                </span>
              ),
            )}
          </span>
        );
      })}
    </>
  );
};
