import React from 'react';
import {Frame} from '../Frame';
import type {Resolved} from '../types';

// A contact sheet: many frames of one video in a single still, each with a time label.
export type SheetProps = {d: Resolved; frames: number[]; labels?: string[]; cols: number; scale?: number};

const LABEL_H = 64;
const PAD = 24;

const size = (p: SheetProps) => {
  const s = p.scale ?? 0.34;
  const cw = Math.round(p.d.width * s);
  const ch = Math.round(p.d.height * s) + LABEL_H;
  const cols = Math.min(p.cols, p.frames.length);
  const rows = Math.ceil(p.frames.length / cols);
  const w = cols * cw + (cols + 1) * PAD;
  const h = rows * ch + (rows + 1) * PAD;
  return {width: w + (w % 2), height: h + (h % 2), durationInFrames: 1, fps: p.d.fps};
};

export const Sheet: React.FC<SheetProps> & {size: typeof size} = (p) => {
  const s = p.scale ?? 0.34;
  return (
    <div style={{background: '#1c1c1e', width: '100%', height: '100%', padding: PAD, boxSizing: 'border-box', display: 'flex', flexWrap: 'wrap', gap: PAD, alignContent: 'flex-start'}}>
      {p.frames.map((f, i) => (
        <div key={i} style={{width: Math.round(p.d.width * s)}}>
          <div style={{height: LABEL_H, color: '#fff', fontFamily: 'SF Mono, Menlo, monospace', fontSize: 22, lineHeight: '28px', overflow: 'hidden'}}>
            <b>{(f / p.d.fps).toFixed(2)}s</b> <span style={{color: '#8e8e93'}}>f{f}</span>
            <div style={{color: '#ffd60a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontSize: 19}}>{p.labels?.[i] ?? ''}</div>
          </div>
          <div style={{zoom: s, outline: '1px solid #444'}}>
            <Frame d={p.d} frame={f} />
          </div>
        </div>
      ))}
    </div>
  );
};
Sheet.size = size;
