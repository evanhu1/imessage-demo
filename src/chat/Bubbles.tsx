import React from 'react';
import {Img, staticFile} from 'remotion';
import type {Item, Side, Tapback} from '../types';
import {ios, useTime} from './anim';
import {FxText} from './FxText';
import {C, FONT, M, PT_WIDTH} from './theme';

const maxW = PT_WIDTH * M.maxBubble;

// The classic iMessage tail: a colored curve plus a white cut-out, like the CSS original.
const Tail: React.FC<{side: Side; color: string}> = ({side, color}) => {
  const me = side === 'me';
  return (
    <>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          [me ? 'right' : 'left']: -7,
          width: 20,
          height: 20,
          background: color,
          [me ? 'borderBottomLeftRadius' : 'borderBottomRightRadius']: '16px 14px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          [me ? 'right' : 'left']: -26,
          width: 26,
          height: 20,
          background: C.bg,
          [me ? 'borderBottomLeftRadius' : 'borderBottomRightRadius']: 10,
        }}
      />
    </>
  );
};

export const TextBubble: React.FC<{item: Extract<Item, {kind: 'text'}>; tail: boolean}> = ({item, tail}) => {
  const me = item.from === 'me';
  const bg = me ? C.blue : C.gray;
  const fg = me ? '#fff' : C.label;
  return (
    <div
      style={{
        position: 'relative',
        maxWidth: maxW,
        background: bg,
        color: fg,
        borderRadius: M.radius,
        padding: `${M.padV}px ${M.padH}px`,
        fontFamily: FONT,
        fontSize: M.fontSize,
        lineHeight: `${M.lineHeight}px`,
        letterSpacing: -0.43,
        wordWrap: 'break-word',
        whiteSpace: 'pre-wrap',
      }}
    >
      {tail ? <Tail side={item.from} color={bg} /> : null}
      <span style={{position: 'relative'}}>
        <FxText segs={item.segs} at={item.at} color={fg} />
      </span>
    </div>
  );
};

export const EmojiMsg: React.FC<{item: Extract<Item, {kind: 'emoji'}>}> = ({item}) => {
  const n = Array.from(new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(item.text)).filter(
    (s) => s.segment.trim(),
  ).length;
  const size = n === 1 ? 50 : n === 2 ? 44 : 38;
  return (
    <div style={{fontFamily: FONT, fontSize: size, lineHeight: 1.15, padding: '2px 2px', letterSpacing: 1}}>{item.text}</div>
  );
};

export function photoBox(w: number, h: number) {
  const maxWp = 256;
  const maxHp = 342;
  const s = Math.min(maxWp / w, maxHp / h);
  let bw = w * s;
  let bh = h * s;
  // very wide or tall images are cropped to a minimum size, like iOS
  if (bw < 140) bw = 140;
  if (bh < 110) bh = 110;
  return {bw, bh};
}

export const PhotoMsg: React.FC<{item: Extract<Item, {kind: 'photo'}>}> = ({item}) => {
  const {bw, bh} = photoBox(item.w, item.h);
  return (
    <div style={{width: bw, height: bh, borderRadius: M.radius, overflow: 'hidden', position: 'relative', background: '#ddd'}}>
      <Img src={staticFile(item.src)} style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />
      <div style={{position: 'absolute', inset: 0, borderRadius: M.radius, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.12)'}} />
    </div>
  );
};

export const TYPING_H = M.lineHeight + 2 * M.padV; // one-line bubble height

export const Typing: React.FC<{start: number}> = ({start}) => {
  const {frame, fps} = useTime();
  const t = (frame - start) / fps;
  const period = 1.35;
  return (
    <div style={{position: 'relative', width: 62, height: TYPING_H}}>
      <div style={{position: 'absolute', left: -3.5, bottom: -3, width: 14, height: 14, borderRadius: 7, background: C.gray}} />
      <div style={{position: 'absolute', left: -8.5, bottom: -8.5, width: 6.5, height: 6.5, borderRadius: 3.25, background: C.gray}} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: C.gray,
          borderRadius: TYPING_H / 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4.5,
        }}
      >
        {[0, 1, 2].map((i) => {
          const ph = ((t / period - i * 0.2) % 1 + 1) % 1;
          const k = Math.max(0, Math.sin(Math.PI * Math.min(1, ph / 0.5)));
          const v = Math.round(178 - 58 * k);
          return (
            <div
              key={i}
              style={{
                width: 9,
                height: 9,
                borderRadius: 4.5,
                background: `rgb(${v},${v},${v + 4})`,
                transform: `scale(${1 + 0.1 * k})`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

// ---------- tapbacks ----------
// iOS 26: others' reactions sit in a gray badge with colored glyphs (red "!!", pink heart).
const Bang: React.FC<{x: number}> = ({x}) => (
  <path
    transform={`translate(${x} 0) skewX(-8)`}
    d="M3.1 0.6c1.35 0 2.3 1 2.2 2.3L4.6 12.1c-.06.8-.66 1.35-1.5 1.35S1.66 12.9 1.6 12.1L.9 2.9C.8 1.6 1.75.6 3.1.6ZM3.1 15c1.05 0 1.9.8 1.9 1.85s-.85 1.85-1.9 1.85-1.9-.8-1.9-1.85S2.05 15 3.1 15Z"
  />
);

const TB_ICONS: Record<string, (color: string, mine: boolean) => React.ReactNode> = {
  heart: (c, mine) => (
    <svg width={20} height={18} viewBox="0 0 16 14">
      <defs>
        <linearGradient id="tbHeart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF9FD0" />
          <stop offset="1" stopColor="#FF4D9E" />
        </linearGradient>
      </defs>
      <path d="M8 13.4S.8 9.1.8 4.3A3.6 3.6 0 0 1 4.4.7c1.5 0 2.8.9 3.6 2.1C8.8 1.6 10.1.7 11.6.7a3.6 3.6 0 0 1 3.6 3.6c0 4.8-7.2 9.1-7.2 9.1Z" fill={mine ? c : 'url(#tbHeart)'} />
      {mine ? null : <ellipse cx={4.6} cy={3.9} rx={1.9} ry={1.2} fill="rgba(255,255,255,0.55)" transform="rotate(-30 4.6 3.9)" />}
    </svg>
  ),
  emphasize: (c, mine) => (
    <svg width={17} height={20} viewBox="0 0 13 19.5">
      <defs>
        <linearGradient id="tbBang" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF6A5F" />
          <stop offset="1" stopColor="#E3162E" />
        </linearGradient>
      </defs>
      <g fill={mine ? c : 'url(#tbBang)'}>
        <Bang x={1.4} />
        <Bang x={7.2} />
      </g>
    </svg>
  ),
  like: (c) => (
    <svg width={18} height={18} viewBox="0 0 16 16">
      <path d="M1 7h3v8H1zM5.5 14.6V7.4L8.7 1.3c.2-.4.7-.6 1.1-.4.9.4 1.3 1.4 1 2.3L10.2 6h3.4c1 0 1.7.9 1.5 1.9l-1.2 5.6c-.2.9-1 1.5-1.9 1.5H6c-.3 0-.5-.2-.5-.4Z" fill={c} />
    </svg>
  ),
  dislike: (c) => (
    <svg width={18} height={18} viewBox="0 0 16 16" style={{transform: 'rotate(180deg)'}}>
      <path d="M1 7h3v8H1zM5.5 14.6V7.4L8.7 1.3c.2-.4.7-.6 1.1-.4.9.4 1.3 1.4 1 2.3L10.2 6h3.4c1 0 1.7.9 1.5 1.9l-1.2 5.6c-.2.9-1 1.5-1.9 1.5H6c-.3 0-.5-.2-.5-.4Z" fill={c} />
    </svg>
  ),
  haha: (c) => (
    <div style={{color: c, fontFamily: FONT, fontWeight: 800, fontSize: 9.5, lineHeight: '9px', textAlign: 'center', letterSpacing: -0.2, transform: 'rotate(-12deg)'}}>
      HA
      <br />
      HA
    </div>
  ),
  question: (c) => <div style={{color: c, fontFamily: FONT, fontWeight: 800, fontSize: 19, lineHeight: 1}}>?</div>,
};
const TB_ALIAS: Record<string, string> = {love: 'heart', thumbsup: 'like', thumbsdown: 'dislike', laugh: 'haha', '!!': 'emphasize', exclaim: 'emphasize', '?': 'question'};

export const TB = {size: 34, rise: 27, space: 22};

export const TapbackBadge: React.FC<{tb: Tapback; onSide: Side; index: number}> = ({tb, onSide, index}) => {
  const {frame, fps} = useTime();
  const p = ios(frame - tb.at, fps, {damping: 13, stiffness: 300});
  const mine = tb.by === 'me';
  const bg = mine ? C.blue : C.gray;
  const kind = TB_ALIAS[tb.kind] ?? tb.kind;
  const icon = TB_ICONS[kind];
  const iconColor = mine ? '#fff' : C.secondary;
  // The badge centers on the bubble's top corner away from the tail: top-left on my bubbles,
  // top-right on theirs. Its tail dots point outward. More badges stack toward the middle.
  const left = onSide === 'me';
  const {size} = TB;
  const off = -15 + index * 27.5;
  const dot = (d: number, dx: number, dy: number, ring: number) => (
    <div
      style={{
        position: 'absolute',
        [left ? 'left' : 'right']: size / 2 + dx - d / 2,
        top: size / 2 + dy - d / 2,
        width: d,
        height: d,
        borderRadius: d / 2,
        background: bg,
        boxShadow: `0 0 0 ${ring}px ${C.bg}`,
      }}
    />
  );
  return (
    <div
      style={{
        position: 'absolute',
        top: -TB.rise,
        [left ? 'left' : 'right']: off,
        width: size,
        height: size,
        transform: `scale(${p})`,
        transformOrigin: left ? '20% 90%' : '80% 90%',
        zIndex: 5 - index,
      }}
    >
      {dot(8, -11, 17, 1.5)}
      {dot(3.6, -17.5, 24, 1)}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: size / 2,
          background: bg,
          boxShadow: `0 0 0 2px ${C.bg}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT,
          fontSize: 20,
          lineHeight: 1,
        }}
      >
        {icon ? icon(iconColor, mine) : <span style={{transform: 'translateY(0.5px)'}}>{tb.kind}</span>}
      </div>
    </div>
  );
};
