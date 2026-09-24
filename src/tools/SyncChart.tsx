import React from 'react';
import type {Resolved} from '../types';

// A timing chart for agents: audio waveform, transcript words, onsets, marks and every chat event
// on one shared time axis (video time, in seconds).
export type SyncChartProps = {
  d: Resolved;
  analysis: null | {
    peaks: number[];
    peaksPerSecond: number;
    words: {word: string; start: number; end: number}[];
    onsets: {t: number; strength: number}[];
  }; // already shifted to video time
  from: number;
  to: number;
};

const W = 2400;
const L = 150; // left gutter for lane names
const KIND_COLOR: Record<string, string> = {
  me: '#0A7CFF',
  worth: '#8E8E93',
  typing: '#C7C7CC',
  tapback: '#FF9F0A',
  stamp: '#AF52DE',
  mark: '#FF375F',
};

export const SyncChart: React.FC<SyncChartProps> = ({d, analysis, from, to}) => {
  const x = (t: number) => L + ((t - from) / (to - from)) * (W - L - 30);
  const inRange = (t: number) => t >= from - 1e-6 && t <= to + 1e-6;
  const ticks: number[] = [];
  const step = to - from > 20 ? 1 : 0.5;
  for (let t = Math.ceil(from / step) * step; t <= to + 1e-6; t += step) ticks.push(+t.toFixed(3));

  const lane = (y: number, h: number, name: string, children: React.ReactNode) => (
    <div style={{position: 'absolute', left: 0, top: y, width: W, height: h, borderTop: '1px solid #2c2c2e'}}>
      <div style={{position: 'absolute', left: 12, top: 8, color: '#8e8e93', fontSize: 20}}>{name}</div>
      {children}
    </div>
  );

  const wave: React.ReactNode[] = [];
  if (analysis) {
    const n = analysis.peaks.length;
    const cols = W - L - 30;
    for (let c = 0; c < cols; c += 2) {
      const t = from + (c / cols) * (to - from);
      const i = Math.floor(t * analysis.peaksPerSecond);
      if (i < 0 || i >= n) continue;
      const v = analysis.peaks[i];
      wave.push(<div key={c} style={{position: 'absolute', left: L + c, top: 110 - v * 100, width: 1.5, height: Math.max(1, v * 200), background: '#64d2ff'}} />);
    }
  }

  // Split events into two label rows so neighbours do not overlap.
  const events = d.timeline.filter((e) => inRange(e.seconds));
  const typing = d.items.filter((it) => it.kind === 'typing') as Extract<Resolved['items'][number], {kind: 'typing'}>[];

  return (
    <div style={{width: W, height: 900, background: '#000', color: '#fff', fontFamily: 'SF Mono, Menlo, monospace', position: 'relative', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 12, top: 10, fontSize: 26, fontWeight: 700}}>
        {d.slug} — video time {from.toFixed(2)}s → {to.toFixed(2)}s {d.audio ? `(audio offset ${d.audio.startFrom}s)` : '(no audio)'}
      </div>
      {/* grid */}
      {ticks.map((t) => (
        <div key={t} style={{position: 'absolute', left: x(t), top: 50, width: 1, height: 850, background: Number.isInteger(t) ? '#3a3a3c' : '#1c1c1e'}}>
          <div style={{position: 'absolute', top: 0, left: 4, fontSize: 18, color: '#8e8e93'}}>{Number.isInteger(t) ? `${t}s` : ''}</div>
        </div>
      ))}
      {lane(80, 230, 'audio', <div style={{position: 'absolute', inset: 0}}>{wave}{!analysis && <div style={{position: 'absolute', left: L, top: 90, color: '#636366', fontSize: 22}}>no analysis.json — run: npm run rig -- analyze {d.slug}</div>}</div>)}
      {lane(310, 90, 'words', analysis?.words.filter((w) => inRange(w.start)).map((w, i) => (
        <div key={i} style={{position: 'absolute', left: x(w.start), top: 14 + (i % 2) * 36, width: Math.max(4, x(w.end) - x(w.start)), height: 30, background: 'rgba(100,210,255,0.22)', borderLeft: '2px solid #64d2ff', fontSize: 19, lineHeight: '30px', paddingLeft: 3, whiteSpace: 'nowrap'}}>
          {w.word}
        </div>
      )))}
      {lane(400, 60, 'onsets', analysis?.onsets.map((o, i) => inRange(o.t) ? (
        <div key={i} style={{position: 'absolute', left: x(o.t), top: 8, width: 2, height: 44 * Math.min(1, 0.35 + o.strength), background: '#ffd60a'}}>
          <div style={{position: 'absolute', top: -2, left: 4, fontSize: 13, color: '#ffd60a'}}>{i + 1}</div>
        </div>
      ) : null))}
      {lane(460, 440, 'chat', (
        <>
          {typing.map((t) => (
            <div key={t.id} style={{position: 'absolute', left: x(t.start / d.fps), width: Math.max(2, x(t.end / d.fps) - x(t.start / d.fps)), top: 18, height: 16, background: '#48484a', borderRadius: 8}} />
          ))}
          {events.map((e, i) => (
            <div key={i} style={{position: 'absolute', left: x(e.seconds), top: 0, width: 3, height: 440, background: KIND_COLOR[e.kind] ?? '#fff', opacity: 0.9}}>
              <div style={{position: 'absolute', left: 6, top: 44 + (i % 6) * 64, fontSize: 18, lineHeight: '22px', color: KIND_COLOR[e.kind] ?? '#fff', whiteSpace: 'nowrap', background: 'rgba(0,0,0,0.75)', padding: '2px 4px'}}>
                {e.seconds.toFixed(2)} {e.kind}
                <br />
                <span style={{color: '#fff'}}>{e.label.slice(0, 34)}</span>
              </div>
            </div>
          ))}
          {Object.entries(d.marks).filter(([, t]) => inRange(t)).map(([k, t]) => (
            <div key={k} style={{position: 'absolute', left: x(t), top: -380, width: 0, height: 820, borderLeft: '2px dashed #FF375F'}}>
              <div style={{position: 'absolute', left: 4, top: 386, fontSize: 18, color: '#FF375F'}}>◆{k}</div>
            </div>
          ))}
        </>
      ))}
    </div>
  );
};
