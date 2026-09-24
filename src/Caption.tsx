import React from 'react';
import {continueRender, delayRender} from 'remotion';
import type {Resolved} from './types';
import fontUrl from './fonts/TikTokSans-latin.woff2';

// TikTok's own caption font (TikTok Sans, variable 300-900), bundled so renders work offline.
const handle = delayRender('TikTok Sans');
new FontFace('TikTok Sans', `url(${fontUrl}) format('woff2')`, {weight: '300 900'})
  .load()
  .then((f) => {
    document.fonts.add(f);
    continueRender(handle);
  })
  .catch((e) => {
    console.error('TikTok Sans failed to load', e);
    continueRender(handle);
  });

// A thick, round outline: black shadows on a circle around each glyph (text-stroke has sharp miters).
function ring(r: number) {
  const out: string[] = [];
  for (const k of [1, 0.55]) {
    const n = k === 1 ? 32 : 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push(`${(Math.cos(a) * r * k).toFixed(2)}px ${(Math.sin(a) * r * k).toFixed(2)}px 0 #000`);
    }
  }
  return out.join(', ');
}

const FAMILY = '"TikTok Sans", "Apple Color Emoji", sans-serif';

// A static caption floating over the video, in TikTok's in-app text styles:
//  outline — white text with a black stroke (the classic viral look)
//  box     — black text on white rounded boxes, one per line
//  plain   — white text with a soft shadow
export const Caption: React.FC<{c: NonNullable<Resolved['caption']>; frame: number; width: number; height: number}> = ({
  c,
  frame,
  width,
  height,
}) => {
  if (frame < c.from || (c.to != null && frame >= c.to)) return null;
  const size = c.size;
  const base: React.CSSProperties = {
    fontFamily: FAMILY,
    fontSize: size,
    fontWeight: c.style === 'box' ? 600 : 700,
    lineHeight: 1.22,
    letterSpacing: -0.2,
    textAlign: 'center',
  };
  let body: React.ReactNode;
  if (c.style === 'box') {
    body = (
      <span
        style={{
          ...base,
          color: '#000',
          background: '#fff',
          padding: `${size * 0.1}px ${size * 0.26}px`,
          borderRadius: size * 0.2,
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
          lineHeight: 1.42,
        }}
      >
        {c.text}
      </span>
    );
  } else if (c.style === 'outline') {
    body = (
      <span
        style={{
          ...base,
          color: '#fff',
          textShadow: ring(size * 0.075),
        }}
      >
        {c.text}
      </span>
    );
  } else {
    body = <span style={{...base, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.55)'}}>{c.text}</span>;
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: (width * (1 - c.maxWidth)) / 2,
        width: width * c.maxWidth,
        top: height * c.y,
        transform: 'translateY(-50%)',
        textAlign: 'center',
        zIndex: 100,
      }}
    >
      {body}
    </div>
  );
};
