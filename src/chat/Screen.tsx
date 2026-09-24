import React from 'react';
import type {Item, Resolved, Side, Tapback} from '../types';
import {clamp01, ios, lerp, TimeCtx} from './anim';
import {EmojiMsg, PhotoMsg, TapbackBadge, TB, TextBubble, Typing, TYPING_H} from './Bubbles';
import {Header, InputBar, StatusBar} from './Chrome';
import {C, FONT, M, PT_WIDTH, SCALE} from './theme';


type Msg = Exclude<Item, {kind: 'stamp'} | {kind: 'typing'}>;

type Row =
  | {type: 'stamp'; item: Extract<Item, {kind: 'stamp'}>; grow: number}
  | {type: 'msg'; item: Msg; grow: number; tapbacks: Tapback[]}
  | {type: 'typing'; item: Extract<Item, {kind: 'typing'}>; grow: number};

// Height growth uses a grid track of `grow`fr, which interpolates auto height without measuring.
const Grow: React.FC<{p: number; children: React.ReactNode}> = ({p, children}) => (
  <div style={{display: 'grid', gridTemplateRows: `${Math.max(0, p)}fr`}}>
    <div style={{minHeight: 0}}>{children}</div>
  </div>
);

// Layout heights use a critically damped spring: no overshoot, so the thread never bobs.
// Typing dots collapse on the same curve the next message grows on, so the swap is smooth.
// (Bubble pop/rise animations are transforms and keep their bounce.)
const settle = (df: number, fps: number) => ios(df, fps, {damping: 33, stiffness: 270});

function buildRows(d: Resolved, f: number): Row[] {
  const fps = d.fps;
  const rows: Row[] = [];
  for (const it of d.items) {
    if (it.kind === 'stamp') {
      if (it.at <= f) rows.push({type: 'stamp', item: it, grow: settle(f - it.at, fps)});
    } else if (it.kind === 'typing') {
      // Kept until fully collapsed; dropping it early snaps the thread by its last pixel.
      if (it.start <= f && f < it.end + fps * 2) {
        const grow = Math.min(settle(f - it.start, fps), 1 - settle(f - it.end, fps));
        if (grow > 0.0005) rows.push({type: 'typing', item: it, grow});
      }
    } else if (it.at <= f) {
      rows.push({type: 'msg', item: it, grow: settle(f - it.at, fps), tapbacks: d.tapbacks.filter((t) => t.target === it.id && t.at <= f)});
    }
  }
  return rows;
}

const side = (r: Row): Side | null => (r.type === 'msg' ? r.item.from : r.type === 'typing' ? r.item.from : null);

const MsgRow: React.FC<{row: Extract<Row, {type: 'msg'}>; tail: boolean; gapTop: number; f: number; fps: number}> = ({
  row,
  tail,
  gapTop,
  f,
  fps,
}) => {
  const it = row.item;
  const me = it.from === 'me';
  const age = f - it.at;
  // Sent: rises from the input field. Received: pops in from the bottom-left corner.
  const p = me ? ios(age, fps, {damping: 24, stiffness: 240}) : ios(age, fps, {damping: 15, stiffness: 280});
  const transform = me
    ? `translateY(${lerp(34, 0, p)}px) scale(${lerp(0.94, 1, p)})`
    : `scale(${lerp(0.55, 1, p)})`;
  const tbGrow = row.tapbacks.length ? settle(f - row.tapbacks[0].at, fps) : 0;
  let body: React.ReactNode;
  if (it.kind === 'text') body = <TextBubble item={it} tail={tail} />;
  else if (it.kind === 'emoji') body = <EmojiMsg item={it} />;
  else body = <PhotoMsg item={it} />;
  return (
    <div style={{display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', padding: `0 ${M.sideMargin}px`}}>
      <div
        style={{
          marginTop: gapTop + TB.space * tbGrow,
          position: 'relative',
          transform,
          transformOrigin: me ? '100% 100%' : '0% 100%',
          opacity: clamp01(age / (fps * (me ? 0.08 : 0.03))),
        }}
      >
        {body}
        {row.tapbacks.map((tb, i) => (
          <TapbackBadge key={i} tb={tb} onSide={it.from} index={i} />
        ))}
      </div>
    </div>
  );
};

export const ChatScreen: React.FC<{d: Resolved; frame: number}> = ({d, frame}) => {
  const fps = d.fps;
  const height = d.height / SCALE;
  const rows = buildRows(d, frame);
  const inputTop = height - M.inputBottom - M.inputHeight;
  // A short thread starts under the header, or lower (layout.top) to leave the caption room.
  const listTop = Math.max(M.headerHeight - 6, d.layout.top != null ? height * d.layout.top : 0);
  // Newest messages land near the vertical focus of short-form video, not at the input bar.
  const listBottom = Math.min(inputTop - 10, height * d.layout.bottom);

  const out: React.ReactNode[] = [];
  let prevSide: Side | null = null;
  let prevType: Row['type'] | null = null;
  // Spacing ignores typing rows. Otherwise the gap above a new message would jump
  // (group gap -> sender gap) at the moment the typing row is removed.
  rows.forEach((r, i) => {
    if (r.type === 'stamp') {
      out.push(
        <Grow key={r.item.id} p={r.grow}>
          <div
            style={{
              textAlign: 'center',
              fontFamily: FONT,
              fontSize: 12,
              lineHeight: '16px',
              color: C.secondary,
              padding: `${prevType === null ? 0 : 14}px 0 6px`,
              letterSpacing: -0.05,
            }}
          >
            {r.item.bold ? <span style={{fontWeight: 600}}>{r.item.bold} </span> : null}
            {r.item.rest}
          </div>
        </Grow>,
      );
      prevSide = null;
    } else {
      const s = side(r)!;
      const gap = prevType === null ? 0 : prevType === 'stamp' ? 2 : prevSide === s ? M.groupGap : M.senderGap;
      if (r.type === 'typing') {
        out.push(
          <Grow key={r.item.id} p={r.grow}>
            {/* Same height as a one-line bubble, so swapping dots for a short reply does not move the thread.
                The tail circles hang below the row. */}
            <div style={{padding: `${gap}px ${M.sideMargin + 4}px 0`, height: gap + TYPING_H, boxSizing: 'border-box'}}>
              <div style={{transform: `scale(${r.grow})`, transformOrigin: '0% 100%'}}>
                <Typing start={r.item.start} />
              </div>
            </div>
          </Grow>,
        );
      } else {
        // Tail only on the last bubble of a run from the same sender.
        const next = rows[i + 1];
        // Big emoji and photos have no tail, so they do not take it from the bubble above.
        const tail = !next || next.type !== 'msg' || next.item.kind !== 'text' || side(next) !== s;
        out.push(
          <Grow key={r.item.id} p={r.grow}>
            <MsgRow row={r} tail={tail} gapTop={gap} f={frame} fps={fps} />
          </Grow>,
        );
        prevSide = s;
      }
    }
    if (r.type !== 'typing') prevType = r.type;
  });

  return (
    <TimeCtx.Provider value={{frame, fps}}>
      <div style={{position: 'relative', width: PT_WIDTH, height, background: C.bg, overflow: 'hidden', fontFamily: FONT, color: C.label}}>
        {/* message list: top-aligned while short, bottom-anchored once it overflows (like iOS) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: PT_WIDTH,
            top: listTop,
            height: listBottom - listTop,
            display: 'flex',
            // column-reverse stacks from the bottom and overflows upward. The spacer (visually
            // below the messages) takes the free space while the thread is short.
            flexDirection: 'column-reverse',
            justifyContent: 'flex-start',
          }}
        >
          <div style={{flex: '1 1 0', minHeight: 0}} />
          <div style={{flexShrink: 0}}>{out}</div>
        </div>
        <Header d={d} />
        <StatusBar s={d.status} />
        <InputBar height={height} />
      </div>
    </TimeCtx.Provider>
  );
};

// Full-frame wrapper: zooms the point-based screen up to 1080px wide.
export const Phone: React.FC<{d: Resolved; frame: number}> = ({d, frame}) => (
  <div style={{width: d.width, height: d.height, overflow: 'hidden', background: C.bg}}>
    <div style={{zoom: SCALE}}>
      <ChatScreen d={d} frame={frame} />
    </div>
  </div>
);
