// Loads videos/<slug>/script.yaml and resolves it into frame-exact data for the renderer.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {imageSize} from 'image-size';
import {spawnSync} from 'node:child_process';
import {
  HISTORY_FRAME,
  type Item,
  type Resolved,
  type Seg,
  type Side,
  type Tapback,
  type TextFx,
  TEXT_FX,
  type TimelineEntry,
} from '../src/types';

export const ROOT = path.resolve(__dirname, '..');
export const VIDEOS = path.join(ROOT, 'videos');
export const OUT = path.join(ROOT, 'out');

export const WIDTH = 1080;
// Output height by `format`. Apps fill their video area edge to edge, so a video whose ratio differs from
// that area gets zoomed and cropped. TikTok's area on current phones (screen minus its tab bar) is ~1:1.96;
// a 9:16 video there loses ~5% off each side.
export const FORMATS: Record<string, number> = {
  tiktok: 2120, // 1:1.96 — default; fits TikTok/Reels on modern phones
  '9:16': 1920, // classic; gets side-cropped on tall phones
  iphone: 2348, // the full iPhone 16/17 Pro screen ratio
};

export type Analysis = {
  audioFile: string;
  duration: number;
  words: {word: string; start: number; end: number}[];
  onsets: {t: number; strength: number}[];
  peaks: number[]; // normalized 0-1 waveform peaks over the full audio file
  peaksPerSecond: number;
};

export class ScriptError extends Error {}

function formatHeight(f: unknown): number {
  const key = f == null ? 'tiktok' : String(f);
  if (!(key in FORMATS)) throw new ScriptError(`format must be one of ${Object.keys(FORMATS).join(', ')}, got "${key}"`);
  return FORMATS[key];
}

export function videoDir(slug: string) {
  return path.join(VIDEOS, slug);
}

export function listSlugs(): string[] {
  if (!fs.existsSync(VIDEOS)) return [];
  return fs
    .readdirSync(VIDEOS)
    .filter((d) => !d.startsWith('_') && fs.existsSync(path.join(VIDEOS, d, 'script.yaml')))
    .sort();
}

export function readRaw(slug: string): any {
  const file = path.join(videoDir(slug), 'script.yaml');
  if (!fs.existsSync(file)) throw new ScriptError(`No script at ${file}`);
  // YAML reads `at: +0.5` as the number 0.5. Quote relative times so they stay relative.
  const text = fs.readFileSync(file, 'utf8').replace(/^(\s*(?:-\s+)?(?:at|end):\s*)(\+\s*[\d.]+)\s*(#.*)?$/gm, '$1"$2" $3');
  return YAML.parse(text) ?? {};
}

// The sound as the video uses it. With `audio.speed` (e.g. 0.75 = 25% slower, pitch kept),
// a time-stretched copy is cached in videos/<slug>/_cache/. Returns a path relative to the video dir.
export function effectiveAudio(slug: string, raw = readRaw(slug)): string | null {
  const a = raw.audio;
  if (!a?.file) return null;
  const src = path.join(videoDir(slug), a.file);
  if (!fs.existsSync(src)) throw new ScriptError(`audio file not found: ${a.file}`);
  const speed: number = a.speed ?? 1;
  if (speed === 1) return a.file;
  if (!(speed >= 0.5 && speed <= 2)) throw new ScriptError(`audio.speed must be 0.5-2, got ${speed}`);
  const rel = path.join('_cache', `${path.parse(a.file).name}@${speed}.m4a`);
  const out = path.join(videoDir(slug), rel);
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs) {
    fs.mkdirSync(path.dirname(out), {recursive: true});
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-filter:a', `atempo=${speed}`, '-c:a', 'aac', '-b:a', '192k', out]);
    if (r.status !== 0) throw new ScriptError(`ffmpeg could not change the audio speed: ${r.stderr}`);
  }
  return rel;
}

export function readAnalysis(slug: string, raw = readRaw(slug)): Analysis | null {
  const file = path.join(videoDir(slug), 'analysis.json');
  if (!fs.existsSync(file)) return null;
  const a: Analysis = JSON.parse(fs.readFileSync(file, 'utf8'));
  const want = effectiveAudio(slug, raw);
  if (want && a.audioFile !== want) {
    console.warn(`warning: analysis.json is for ${a.audioFile}, but the video uses ${want}. Run: npm run rig -- analyze ${slug}`);
    return null;
  }
  return a;
}

// ---------- text markup ----------
// **bold**  *italic*  __underline__  ~~strike~~  [shake]text[/shake]
export function parseMarkup(input: string, wholeFx?: TextFx): Seg[] {
  const segs: Seg[] = [];
  const state = {bold: false, italic: false, underline: false, strike: false, fx: wholeFx as TextFx | undefined};
  let buf = '';
  const flush = () => {
    if (!buf) return;
    const s: Seg = {text: buf};
    if (state.bold) s.bold = true;
    if (state.italic) s.italic = true;
    if (state.underline) s.underline = true;
    if (state.strike) s.strike = true;
    if (state.fx) s.fx = state.fx;
    segs.push(s);
    buf = '';
  };
  let i = 0;
  while (i < input.length) {
    const rest = input.slice(i);
    const fxOpen = rest.match(/^\[(\w+)\]/);
    const fxClose = rest.match(/^\[\/(\w+)\]/);
    if (fxOpen && (TEXT_FX as string[]).includes(fxOpen[1])) {
      flush();
      state.fx = fxOpen[1] as TextFx;
      i += fxOpen[0].length;
    } else if (fxClose && (TEXT_FX as string[]).includes(fxClose[1])) {
      flush();
      state.fx = wholeFx;
      i += fxClose[0].length;
    } else if (rest.startsWith('**')) {
      flush();
      state.bold = !state.bold;
      i += 2;
    } else if (rest.startsWith('__')) {
      flush();
      state.underline = !state.underline;
      i += 2;
    } else if (rest.startsWith('~~')) {
      flush();
      state.strike = !state.strike;
      i += 2;
    } else if (rest.startsWith('*')) {
      flush();
      state.italic = !state.italic;
      i += 1;
    } else if (rest.startsWith('\\') && rest.length > 1) {
      buf += rest[1];
      i += 2;
    } else {
      buf += input[i];
      i += 1;
    }
  }
  flush();
  return segs;
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️|‍\p{Extended_Pictographic}️?)*\s*){1,3}$/u;
export function isBigEmoji(s: string) {
  return EMOJI_ONLY.test(s.trim());
}

// ---------- time expressions ----------
// 3.2 | "3.2" | "+0.5" (after previous event) | "hit" | "hit+0.2" | "word:gambling" | "word:go#2-0.1" | "onset:4"
function makeTimeParser(marks: Record<string, number>, analysis: Analysis | null, audioStart: number) {
  return (expr: unknown, prev: number, where: string): number => {
    if (typeof expr === 'number') return expr;
    if (typeof expr !== 'string') throw new ScriptError(`${where}: 'at' must be a number or string, got ${JSON.stringify(expr)}`);
    const s = expr.trim();
    const rel = s.match(/^\+\s*([\d.]+)$/);
    if (rel) return prev + parseFloat(rel[1]);
    if (/^-?[\d.]+$/.test(s)) return parseFloat(s);
    const m = s.match(/^([A-Za-z_][\w:#'-]*?)\s*(?:([+-])\s*([\d.]+))?$/);
    if (!m) throw new ScriptError(`${where}: cannot parse time "${s}"`);
    const [, ref, sign, amt] = m;
    const base = resolveRef(ref, where);
    const off = amt ? parseFloat(amt) * (sign === '-' ? -1 : 1) : 0;
    return base + off;
  };

  function resolveRef(ref: string, where: string): number {
    if (ref in marks) return marks[ref];
    if (ref.startsWith('snap:')) {
      // snap:word:aw#1 -> the onset nearest that word's start (Whisper word times are ~0.1s loose)
      const t = resolveRef(ref.slice(5), where);
      if (!analysis?.onsets.length) throw new ScriptError(`${where}: "${ref}" needs analysis.json with onsets`);
      const near = analysis.onsets.map((o) => o.t - audioStart).reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b));
      if (Math.abs(near - t) > 0.3) console.warn(`warning: ${where}: nearest onset to ${ref.slice(5)} is ${(near - t).toFixed(2)}s away`);
      return near;
    }
    if (ref.startsWith('word:') || ref.startsWith('wordend:')) {
      if (!analysis) throw new ScriptError(`${where}: "${ref}" needs analysis.json. Run: npm run rig -- analyze <slug>`);
      const useEnd = ref.startsWith('wordend:');
      const [w, nth] = ref.slice(ref.indexOf(':') + 1).split('#');
      const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
      const hits = analysis.words.filter((x) => norm(x.word) === norm(w));
      const hit = hits[(nth ? parseInt(nth, 10) : 1) - 1];
      if (!hit) throw new ScriptError(`${where}: word "${w}"${nth ? ' #' + nth : ''} not in transcript`);
      return (useEnd ? hit.end : hit.start) - audioStart;
    }
    if (ref.startsWith('onset:')) {
      if (!analysis) throw new ScriptError(`${where}: "${ref}" needs analysis.json. Run: npm run rig -- analyze <slug>`);
      const n = parseInt(ref.slice(6), 10);
      const on = analysis.onsets[n - 1];
      if (!on) throw new ScriptError(`${where}: no onset #${n} (have ${analysis.onsets.length})`);
      return on.t - audioStart;
    }
    throw new ScriptError(`${where}: unknown mark "${ref}". Known marks: ${Object.keys(marks).join(', ') || '(none)'}`);
  }
}

// ---------- resolve ----------
const DEFAULTS = {
  fps: 60,
  tail: 2.0, // seconds of hold after the last event when `end` is not set
};

export function autoTyping(text: string) {
  return Math.min(2.6, 0.8 + text.length * 0.035);
}

// caption: "text"  or  {text, style: outline|box|plain, y: 0.3, size: 58, maxWidth: 0.84, from, to}
function resolveCaption(c: any, parseTime: (e: unknown, prev: number, where: string) => number, F: (s: number) => number): Resolved['caption'] {
  if (c == null || c === false) return null;
  const spec = typeof c === 'string' ? {text: c} : c;
  if (!spec.text) throw new ScriptError('caption needs text');
  const style = spec.style ?? 'outline';
  if (!['outline', 'box', 'plain'].includes(style)) throw new ScriptError(`caption.style must be outline, box or plain, got "${style}"`);
  return {
    text: String(spec.text),
    style,
    y: spec.y ?? 0.265, // just below the header, clear of TikTok's top tabs
    size: spec.size ?? 64,
    maxWidth: spec.maxWidth ?? 0.84,
    from: spec.from != null ? F(parseTime(spec.from, 0, 'caption.from')) : 0,
    to: spec.to != null ? F(parseTime(spec.to, 0, 'caption.to')) : null,
  };
}

export function resolveScript(slug: string): Resolved {
  const raw = readRaw(slug);
  const analysis = readAnalysis(slug, raw);
  const fps: number = raw.fps ?? DEFAULTS.fps;
  const F = (sec: number) => Math.round(sec * fps);

  const audioStart: number = raw.audio?.start ?? 0;
  const marks: Record<string, number> = {...(raw.marks ?? {})};
  const parseTime = makeTimeParser(marks, analysis, audioStart);
  // Marks may be expressions too (e.g. "word:dang#1-0.1"); resolve them in order.
  for (const [k, v] of Object.entries(marks)) marks[k] = parseTime(v, 0, `marks.${k}`);

  const status = {
    time: String(raw.status?.time ?? '11:27'),
    battery: raw.status?.battery ?? 63,
    network: String(raw.status?.network ?? '5G'),
    signal: raw.status?.signal ?? 3,
    charging: !!raw.status?.charging,
  };

  const contact = {
    name: raw.contact?.name ?? 'Worth',
    emoji: raw.contact?.emoji ?? '🫰',
    colors: (raw.contact?.colors === 'none' ? null : raw.contact?.colors ?? ['#E6E6E9', '#CDCDD2']) as [string, string] | null,
  };

  const items: Item[] = [];
  const tapbacks: Tapback[] = [];
  const timeline: TimelineEntry[] = [];
  const dir = videoDir(slug);
  let autoId = 0;
  const ids = new Set<string>();

  const newId = (want: string | undefined, where: string) => {
    const id = want ?? `m${++autoId}`;
    if (ids.has(id)) throw new ScriptError(`${where}: duplicate id "${id}"`);
    ids.add(id);
    return id;
  };

  const photoItem = (spec: any, from: Side, at: number, id: string, where: string): Item => {
    const file = typeof spec === 'string' ? spec : spec?.file;
    if (!file) throw new ScriptError(`${where}: photo needs a file path`);
    const abs = path.join(dir, file);
    if (!fs.existsSync(abs)) {
      const hint = typeof spec === 'object' && spec.prompt ? ` Run: npm run rig -- gen-images ${slug}` : '';
      throw new ScriptError(`${where}: photo not found: ${file}.${hint}`);
    }
    const dim = imageSize(fs.readFileSync(abs));
    let w = dim.width ?? 1000;
    let h = dim.height ?? 1000;
    if (dim.orientation && dim.orientation >= 5) [w, h] = [h, w];
    // crop: "4:3" shows the photo in that frame (center crop). Shorter photos keep reactions on screen.
    const crop = typeof spec === 'object' ? spec.crop : undefined;
    if (crop) {
      const m = String(crop).match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
      if (!m) throw new ScriptError(`${where}: photo crop must look like "4:3", got "${crop}"`);
      [w, h] = [parseFloat(m[1]) * 1000, parseFloat(m[2]) * 1000];
    }
    return {kind: 'photo', id, from, src: `${slug}/${file}`, w, h, at};
  };

  // Turns a `me:` / `worth:` value into one or more items. Returns the ids created.
  const messageItems = (value: any, from: Side, at: number, where: string): Item[] => {
    const out: Item[] = [];
    const spec = typeof value === 'string' ? {text: value} : value ?? {};
    // With a photo and text, `id` names the photo and `textId` names the text bubble.
    if (spec.photo) out.push(photoItem(spec.photo, from, at, newId(spec.id, where), where));
    if (spec.text != null) {
      const text = String(spec.text);
      const id = newId(spec.photo ? spec.textId : spec.id, where);
      if (spec.fx && !(TEXT_FX as string[]).includes(spec.fx)) {
        throw new ScriptError(`${where}: unknown fx "${spec.fx}". Use one of: ${TEXT_FX.join(', ')}`);
      }
      if (isBigEmoji(text) && !spec.fx) out.push({kind: 'emoji', id, from, text: text.trim(), at});
      else out.push({kind: 'text', id, from, segs: parseMarkup(text, spec.fx), at});
    }
    if (!out.length) throw new ScriptError(`${where}: message needs text or photo`);
    return out;
  };

  const stampItem = (label: string, at: number): Item => {
    // "Today 11:26 AM" -> bold "Today", rest "11:26 AM". iOS bolds the day part.
    const m = String(label).match(/^(\S+(?:\s+\d{1,2}\b(?!:))?)\s+(.*)$/);
    const bold = m && !/^\d/.test(label) ? m[1] : '';
    const rest = m && !/^\d/.test(label) ? m[2] : String(label);
    return {kind: 'stamp', id: newId(undefined, 'stamp'), bold, rest, at};
  };

  // ----- history -----
  for (const [i, h] of (raw.history ?? []).entries()) {
    const where = `history[${i}]`;
    if (h.stamp) items.push(stampItem(h.stamp, HISTORY_FRAME));
    else if (h.me != null) items.push(...messageItems(h.me, 'me', HISTORY_FRAME, where));
    else if (h.worth != null) items.push(...messageItems(h.worth, 'worth', HISTORY_FRAME, where));
    else if (h.tapback) tapbacks.push(tapbackFrom(h.tapback, HISTORY_FRAME, where));
    else throw new ScriptError(`${where}: unknown history entry ${JSON.stringify(h)}`);
  }

  function lastMessage(pred: (it: Item) => boolean) {
    return [...items].reverse().find((x) => x.kind !== 'stamp' && x.kind !== 'typing' && pred(x));
  }

  function tapbackFrom(tb: any, at: number, where: string): Tapback {
    const spec = typeof tb === 'string' ? {kind: tb} : tb;
    const by: Side = spec.by ?? 'worth';
    let target: string | undefined = spec.on;
    if (!target || target === 'last') {
      const t = lastMessage((x) => 'from' in x && x.from !== by);
      if (!t) throw new ScriptError(`${where}: no message to tapback`);
      target = t.id;
    } else if (!ids.has(target)) throw new ScriptError(`${where}: tapback target "${target}" not found (it must come earlier)`);
    return {target, by, kind: String(spec.kind ?? 'heart'), at};
  }

  // ----- events -----
  let prev = 0;
  let pendingStamp: string | null = null;
  let endSec: number | null = raw.end != null ? parseTime(raw.end, 0, 'end') : null;
  const events: any[] = raw.events ?? [];

  for (const [i, ev] of events.entries()) {
    const where = `events[${i}]`;
    if (ev.stamp && ev.at == null) {
      pendingStamp = String(ev.stamp);
      continue;
    }
    if (ev.at == null) throw new ScriptError(`${where}: missing 'at'`);
    const t = parseTime(ev.at, prev, where);
    const before = prev;
    if (t < prev - 1e-6) console.warn(`warning: ${where} at ${t.toFixed(2)}s is earlier than the previous event (${prev.toFixed(2)}s)`);
    prev = t;
    if (ev.mark) marks[ev.mark] = t;
    const f = F(t);
    const log = (kind: string, label: string, id?: string) =>
      timeline.push({frame: f, seconds: +(f / fps).toFixed(3), kind, label, id});

    if (ev.me != null || ev.worth != null) {
      const from: Side = ev.me != null ? 'me' : 'worth';
      if (pendingStamp) {
        items.push(stampItem(pendingStamp, f));
        pendingStamp = null;
      }
      if (from === 'worth') {
        const text = typeof ev.worth === 'string' ? ev.worth : ev.worth?.text ?? '';
        // Auto typing never starts before the previous event; explicit `typing:` is used as given.
        let typingSec: number = ev.typing ?? Math.min(ev.worth?.photo && !text ? 1.6 : autoTyping(text), t - before - 0.15);
        if (ev.typing == null && typingSec < 0.3) typingSec = 0;
        if (typingSec > 0) {
          const start = F(t - typingSec);
          items.push({kind: 'typing', id: newId(undefined, where), from, start, end: f});
          timeline.push({frame: start, seconds: +(start / fps).toFixed(3), kind: 'typing', label: `typing ${typingSec.toFixed(2)}s`});
        }
      }
      const made = messageItems(from === 'me' ? ev.me : ev.worth, from, f, where);
      items.push(...made);
      for (const it of made) {
        const label =
          it.kind === 'photo' ? `[photo ${path.basename(it.src)}]` : it.kind === 'emoji' ? it.text : it.kind === 'text' ? it.segs.map((s) => s.text).join('') : '';
        log(from, label, it.id);
      }
    } else if (ev.tapback) {
      const tb = tapbackFrom(ev.tapback, f, where);
      tapbacks.push(tb);
      log('tapback', `${tb.by} ${tb.kind} on ${tb.target}`, tb.target);
    } else if (ev.typing != null) {
      // Standalone typing that stops without a message (Worth "thinks" then stops).
      const dur = typeof ev.typing === 'number' ? ev.typing : ev.typing.for ?? 1.5;
      items.push({kind: 'typing', id: newId(undefined, where), from: 'worth', start: f, end: f + F(dur)});
      log('typing', `typing ${dur}s (no message)`);
    } else if (ev.stamp) {
      items.push(stampItem(ev.stamp, f));
      log('stamp', String(ev.stamp));
    } else if (ev.end != null || ev.mark) {
      // a bare mark or an explicit end marker
      if (ev.end != null) endSec = t;
      else log('mark', ev.mark);
    } else throw new ScriptError(`${where}: unknown event ${JSON.stringify(ev)}`);
  }

  const lastFrame = Math.max(0, ...timeline.map((e) => e.frame));
  const durationInFrames = endSec != null ? F(endSec) : lastFrame + F(DEFAULTS.tail);

  timeline.sort((a, b) => a.frame - b.frame);

  let audio: Resolved['audio'] = null;
  if (raw.audio?.file) {
    audio = {src: `${slug}/${effectiveAudio(slug, raw)}`, startFrom: audioStart, volume: raw.audio.volume ?? 1};
  }

  return {
    slug,
    fps,
    width: WIDTH,
    height: formatHeight(raw.format),
    durationInFrames: Math.max(1, durationInFrames),
    status,
    contact,
    unread: raw.unread ?? 0,
    layout: {top: raw.layout?.top ?? null, bottom: raw.layout?.bottom ?? 0.72},
    caption: resolveCaption(raw.caption, parseTime, F),
    items,
    tapbacks,
    audio,
    timeline,
    marks,
  };
}
