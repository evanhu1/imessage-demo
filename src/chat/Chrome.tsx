import React from 'react';
import type {Resolved} from '../types';
import {C, FONT, M, PT_WIDTH} from './theme';

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.74)',
  backdropFilter: 'blur(14px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(14px) saturate(1.8)',
  boxShadow:
    '0 6px 18px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05), inset 0 0.5px 0 rgba(255,255,255,0.95), inset 0 0 0 0.5px rgba(0,0,0,0.05)',
};

// ---------- status bar ----------
const Signal: React.FC<{bars: number}> = ({bars}) => (
  <svg width={20} height={12.6} viewBox="0 0 19 12">
    {[0, 1, 2, 3].map((i) => {
      const h = 4.2 + i * 2.6;
      return (
        <rect
          key={i}
          x={i * 5}
          y={12 - h}
          width={3.2}
          height={h}
          rx={1}
          fill={i < bars ? '#000' : 'rgba(0,0,0,0.22)'}
        />
      );
    })}
  </svg>
);

const Wifi: React.FC = () => (
  <svg width={18} height={12.7} viewBox="0 0 17 12">
    <path d="M8.5 2.3c2.5 0 4.8.95 6.5 2.55l1.2-1.25A11 11 0 0 0 8.5.55 11 11 0 0 0 .8 3.6L2 4.85A9.2 9.2 0 0 1 8.5 2.3Z" />
    <path d="M8.5 5.75c1.55 0 2.95.58 4.03 1.55l1.2-1.25A7.6 7.6 0 0 0 8.5 4 7.6 7.6 0 0 0 3.27 6.05l1.2 1.25A5.9 5.9 0 0 1 8.5 5.75Z" />
    <path d="M8.5 9.2c.62 0 1.18.23 1.6.6L8.5 11.45 6.9 9.8c.42-.37.98-.6 1.6-.6Z" />
  </svg>
);

const Battery: React.FC<{level: number; charging: boolean}> = ({level, charging}) => {
  const w = 25;
  const h = 13.5;
  const fill = charging ? '#34C759' : level <= 20 ? '#FF3B30' : '#000';
  return (
    <div style={{position: 'relative', width: w + 2.5, height: h, display: 'flex', alignItems: 'center'}}>
      <div style={{position: 'relative', width: w, height: h, borderRadius: 4.3, background: 'rgba(0,0,0,0.28)', overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `max(${level}%, ${level > 0 ? 2.5 : 0}px)`, background: fill}} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Low battery: red number on the gray body. Otherwise white knocked out of the black fill.
            color: level <= 20 && !charging ? '#FF3B30' : level > 45 ? '#fff' : '#000',
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: -0.2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {level}
        </div>
      </div>
      <div style={{width: 1.8, height: 4.6, marginLeft: 0.8, borderRadius: '0 1.2px 1.2px 0', background: 'rgba(0,0,0,0.28)'}} />
    </div>
  );
};

export const StatusBar: React.FC<{s: Resolved['status']}> = ({s}) => (
  <div style={{position: 'absolute', top: 0, left: 0, width: PT_WIDTH, height: 54, fontFamily: FONT, zIndex: 30}}>
    <div
      style={{
        position: 'absolute',
        left: 0,
        width: 140,
        top: 23,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: -0.3,
        lineHeight: '22px',
      }}
    >
      {s.time}
    </div>
    <div style={{position: 'absolute', right: 38, top: 27, height: 14, display: 'flex', alignItems: 'center', gap: 6}}>
      <Signal bars={s.signal} />
      {s.network === 'wifi' ? (
        <Wifi />
      ) : (
        <span style={{fontSize: 15, fontWeight: 600, letterSpacing: -0.2, lineHeight: '14px'}}>{s.network}</span>
      )}
      <Battery level={s.battery} charging={s.charging} />
    </div>
  </div>
);

// ---------- nav ----------
const Chevron: React.FC = () => (
  <svg width={12} height={20} viewBox="0 0 12 20">
    <path d="M10 2 2.5 10 10 18" fill="none" stroke="#000" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const VideoIcon: React.FC = () => (
  <svg width={28} height={19} viewBox="0 0 28 19">
    <rect x={1.1} y={1.3} width={17.4} height={16.4} rx={4.2} fill="none" stroke="#000" strokeWidth={2} />
    <path d="M20.6 7.1 25.3 3.9c.7-.46 1.5.04 1.5.86v9.5c0 .82-.8 1.32-1.5.86l-4.7-3.2Z" fill="none" stroke="#000" strokeWidth={2} strokeLinejoin="round" />
  </svg>
);

// With colors, an emoji on a gradient circle. Without, the emoji itself fills the photo.
export const Avatar: React.FC<{emoji: string; colors: [string, string] | null; size: number}> = ({emoji, colors, size}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      background: colors ? `linear-gradient(180deg, ${colors[0]}, ${colors[1]})` : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: colors ? size * 0.56 : size * 0.98,
      lineHeight: 1,
      fontFamily: FONT,
    }}
  >
    <span style={{transform: 'translateY(1px)'}}>{emoji}</span>
  </div>
);

export const Header: React.FC<{d: Resolved}> = ({d}) => (
  <>
    {/* iOS 26 scroll edge effect: content blurs and fades under the header */}
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: PT_WIDTH,
        height: M.headerHeight + 20,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        maskImage: 'linear-gradient(180deg, #000 40%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(180deg, #000 40%, transparent 100%)',
        zIndex: 20,
      }}
    />
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: PT_WIDTH,
        height: M.headerHeight + 20,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.55) 40%, rgba(255,255,255,0) 100%)',
        zIndex: 21,
      }}
    />
    <div style={{position: 'absolute', top: 0, left: 0, width: PT_WIDTH, height: M.headerHeight, zIndex: 25, fontFamily: FONT}}>
      {/* back */}
      <div
        style={{
          ...glass,
          position: 'absolute',
          left: 14,
          top: 64,
          height: 44,
          minWidth: 44,
          borderRadius: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: d.unread ? '0 7px 0 15px' : 0,
          gap: 10,
        }}
      >
        <Chevron />
        {d.unread ? (
          <span
            style={{
              background: '#000',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              minWidth: 20,
              height: 20,
              lineHeight: '20px',
              textAlign: 'center',
              padding: '0 6px',
              letterSpacing: -0.2,
            }}
          >
            {d.unread}
          </span>
        ) : null}
      </div>
      {/* avatar + name */}
      <div style={{position: 'absolute', left: 0, width: PT_WIDTH, top: 64, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        {/* The photo sits above the name capsule where they overlap. */}
        <div style={{position: 'relative', zIndex: 2}}>
          <Avatar emoji={d.contact.emoji} colors={d.contact.colors} size={60} />
        </div>
        <div
          style={{
            ...glass,
            marginTop: -4,
            height: 32,
            borderRadius: 16,
            padding: '0 12px 0 13px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: -0.4,
          }}
        >
          <span>{d.contact.name}</span>
          <svg width={8} height={13} viewBox="0 0 7 11" style={{marginTop: 1}}>
            <path d="M1.3 1.2 5.5 5.5 1.3 9.8" fill="none" stroke="rgba(60,60,67,0.45)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {/* facetime */}
      <div
        style={{
          ...glass,
          position: 'absolute',
          right: 14,
          top: 64,
          width: 44,
          height: 44,
          borderRadius: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <VideoIcon />
      </div>
    </div>
  </>
);

// ---------- input bar ----------
const Waveform: React.FC = () => (
  <svg width={20} height={18} viewBox="0 0 20 18">
    {[
      [2, 5],
      [6, 10],
      [10, 16],
      [14, 10],
      [18, 5],
    ].map(([x, h]) => (
      <rect key={x} x={x - 1.1} y={9 - h / 2} width={2.2} height={h} rx={1.1} fill="rgba(60,60,67,0.6)" />
    ))}
  </svg>
);

// The screenshot reference shows no home indicator in Messages, so none is drawn.
export const InputBar: React.FC<{height: number}> = ({height}) => {
  const top = height - M.inputBottom - M.inputHeight;
  const plusLeft = 25.5;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: PT_WIDTH,
          top: height - 90,
          height: 90,
          background: 'linear-gradient(0deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.75) 45%, rgba(255,255,255,0) 100%)',
          zIndex: 20,
        }}
      />
      <div
        style={{
          ...glass,
          position: 'absolute',
          left: plusLeft,
          top,
          width: M.inputHeight,
          height: M.inputHeight,
          borderRadius: M.inputHeight / 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 25,
        }}
      >
        <svg width={18} height={18} viewBox="0 0 18 18">
          <path d="M9 1.5v15M1.5 9h15" stroke="#000" strokeWidth={1.8} strokeLinecap="round" />
        </svg>
      </div>
      <div
        style={{
          ...glass,
          position: 'absolute',
          left: plusLeft + M.inputHeight + 13.5,
          right: plusLeft,
          top,
          height: M.inputHeight,
          borderRadius: M.inputHeight / 2,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px 0 16px',
          fontFamily: FONT,
          fontSize: 17,
          letterSpacing: -0.4,
          color: 'rgba(60,60,67,0.3)',
          zIndex: 25,
        }}
      >
        <span style={{flex: 1}}>iMessage</span>
        <Waveform />
      </div>
    </>
  );
};
