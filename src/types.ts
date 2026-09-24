// Shared types. The CLI resolves a script.yaml into a `Resolved` object.
// The Remotion bundle only renders a `Resolved` object; it never reads YAML.

export type Side = 'me' | 'worth';

export type TextFx =
  | 'big'
  | 'small'
  | 'shake'
  | 'nod'
  | 'explode'
  | 'ripple'
  | 'bloom'
  | 'jitter';

export const TEXT_FX: TextFx[] = ['big', 'small', 'shake', 'nod', 'explode', 'ripple', 'bloom', 'jitter'];

export type Seg = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fx?: TextFx;
};

// All times are frame numbers on the video timeline. History items use HISTORY_FRAME.
export const HISTORY_FRAME = -100000;

export type Item =
  | {kind: 'stamp'; id: string; bold: string; rest: string; at: number}
  | {kind: 'text'; id: string; from: Side; segs: Seg[]; at: number}
  | {kind: 'emoji'; id: string; from: Side; text: string; at: number}
  | {kind: 'photo'; id: string; from: Side; src: string; w: number; h: number; at: number}
  | {kind: 'typing'; id: string; from: Side; start: number; end: number};

export type Tapback = {
  target: string;
  by: Side;
  // Classic kinds, or any emoji string.
  kind: string;
  at: number;
};

export type TimelineEntry = {
  frame: number;
  seconds: number;
  kind: string;
  label: string;
  id?: string;
};

export type Resolved = {
  slug: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  status: {
    time: string; // "11:27"
    battery: number; // 0-100
    network: string; // "5G", "LTE", "wifi"
    signal: number; // 0-4 bars
    charging: boolean;
  };
  contact: {name: string; emoji: string; colors: [string, string] | null}; // null = the emoji alone is the photo
  // Fractions of screen height: where a short thread starts (top) and where the newest message sits (bottom).
  layout: {top: number | null; bottom: number};
  caption: null | {
    text: string;
    style: 'outline' | 'box' | 'plain';
    y: number; // vertical center, fraction of height
    size: number; // px on the 1080x1920 frame
    maxWidth: number; // fraction of width
    from: number; // frames
    to: number | null;
  }; // where the newest message sits, as a fraction of screen height
  unread: number; // badge count on the back button, 0 hides it
  items: Item[];
  tapbacks: Tapback[];
  audio: null | {src: string; startFrom: number; volume: number};
  timeline: TimelineEntry[];
  marks: Record<string, number>; // seconds
};
