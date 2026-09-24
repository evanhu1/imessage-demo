// The rig CLI. Run `npm run rig -- help`.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import YAML from 'yaml';
import {analyzeAudio} from './audio';
import {effectiveAudio, listSlugs, OUT, readAnalysis, readRaw, resolveScript, ROOT, ScriptError, videoDir, VIDEOS} from './script';
import type {Resolved} from '../src/types';

if (fs.existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

const HELP = `
iMessage video rig — every command takes a video slug (a folder in videos/).

  new <slug>                    Scaffold videos/<slug>/ from the template.
  check <slug>                  Validate the script and print the resolved timeline.
  analyze <slug> [--no-words]   Analyze the audio: waveform, onsets, word timestamps (OpenAI).
                                Writes videos/<slug>/analysis.json and prints a summary.
  chart <slug> [--from s --to s]  Render the sync chart (audio + words + onsets + events) to out/<slug>/chart.png.
  still <slug> <t> [<t> ...]    Render full-size frames. t = seconds (3.2) or frame (f192).
  sheet <slug> [--at t,t,...] [--every s] [--from s --to s] [--cols n]
                                Render a contact sheet to out/<slug>/sheet.png.
                                Default: each event, 0.4s after it lands.
  render <slug>                 Render out/<slug>/<slug>.mp4 (silent, for upload) and
                                out/<slug>/<slug>.preview.mp4 (with audio, to check sync).
  spectro <slug> [--from s --to s]  Render a spectrogram of the sound (video time) to out/<slug>/spectro.png.
                                Voices show as stacked horizontal lines; use it to find where a word really
                                starts. Whisper word times can be off by 0.1-0.5s.
  gen-images <slug> [--force]   Generate missing photos that have a 'prompt' (OpenAI gpt-image).
  studio                        Open Remotion Studio to scrub all videos live.
`;

// ---------- helpers ----------
function arg(name: string, args: string[]): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function toFrame(t: string, fps: number): number {
  if (/^f\d+$/.test(t)) return parseInt(t.slice(1), 10);
  const s = parseFloat(t);
  if (Number.isNaN(s)) throw new ScriptError(`bad time "${t}" (use seconds like 3.2 or a frame like f192)`);
  return Math.round(s * fps);
}

function outDir(slug: string) {
  const d = path.join(OUT, slug);
  fs.mkdirSync(d, {recursive: true});
  return d;
}

// Root.tsx imports this file for Remotion Studio. Keep it in sync before each bundle.
function writeIndex(extra?: Resolved) {
  const list: Resolved[] = [];
  for (const slug of listSlugs()) {
    try {
      list.push(extra && extra.slug === slug ? extra : resolveScript(slug));
    } catch (e) {
      console.warn(`skip ${slug} in studio index: ${(e as Error).message}`);
    }
  }
  if (!list.length && extra) list.push(extra);
  fs.mkdirSync(path.join(ROOT, 'src/generated'), {recursive: true});
  fs.writeFileSync(path.join(ROOT, 'src/generated/videos.json'), JSON.stringify(list));
}

let serveUrl: string | null = null;
async function getBundle(d: Resolved) {
  writeIndex(d);
  if (serveUrl) return serveUrl;
  process.stdout.write('bundling… ');
  serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'src/index.ts'),
    publicDir: VIDEOS,
    onProgress: () => undefined,
  });
  console.log('done');
  return serveUrl;
}

async function still(d: Resolved, compId: string, inputProps: Record<string, unknown>, output: string, frame = 0) {
  const url = await getBundle(d);
  const composition = await selectComposition({serveUrl: url, id: compId, inputProps});
  await renderStill({composition, serveUrl: url, output, inputProps, frame, imageFormat: 'png', chromiumOptions: {gl: 'angle'}});
  return output;
}

function printTimeline(d: Resolved) {
  console.log(`\n${d.slug}: ${(d.durationInFrames / d.fps).toFixed(2)}s, ${d.durationInFrames} frames @ ${d.fps}fps`);
  if (d.audio) console.log(`audio: ${d.audio.src} from ${d.audio.startFrom}s`);
  if (Object.keys(d.marks).length) console.log('marks: ' + Object.entries(d.marks).map(([k, v]) => `${k}=${v.toFixed(2)}s`).join('  '));
  console.log('\n  time    frame  kind      label');
  for (const e of d.timeline) {
    console.log(`  ${e.seconds.toFixed(2).padStart(6)}  ${String(e.frame).padStart(5)}  ${e.kind.padEnd(8)}  ${e.label}${e.id ? `  [${e.id}]` : ''}`);
  }
  console.log('');
}

function shiftedAnalysis(slug: string, d: Resolved) {
  const a = readAnalysis(slug);
  if (!a) return null;
  const off = d.audio?.startFrom ?? 0;
  const skip = Math.round(off * a.peaksPerSecond);
  return {
    peaks: a.peaks.slice(skip),
    peaksPerSecond: a.peaksPerSecond,
    words: a.words.map((w) => ({...w, start: w.start - off, end: w.end - off})),
    onsets: a.onsets.map((o) => ({...o, t: o.t - off})),
  };
}

// ---------- commands ----------
async function cmdNew(slug: string) {
  const dir = videoDir(slug);
  if (fs.existsSync(dir)) throw new ScriptError(`${dir} already exists`);
  fs.cpSync(path.join(VIDEOS, '_template'), dir, {recursive: true});
  console.log(`created videos/${slug}/ — edit script.yaml, add photos/ and audio`);
}

async function cmdAnalyze(slug: string, args: string[]) {
  const raw = readRaw(slug);
  if (!raw.audio?.file) throw new ScriptError(`script has no audio.file`);
  const rel = effectiveAudio(slug, raw)!;
  const a = await analyzeAudio(path.join(videoDir(slug), rel), {words: !args.includes('--no-words')});
  a.audioFile = rel;
  fs.writeFileSync(path.join(videoDir(slug), 'analysis.json'), JSON.stringify(a));
  console.log(`\naudio ${rel}: ${a.duration.toFixed(2)}s (audio-file time; video time = audio time - ${raw.audio.start ?? 0})`);
  if (a.words.length) {
    console.log('\nwords:');
    console.log(a.words.map((w) => `  ${w.start.toFixed(2)}-${w.end.toFixed(2)}  ${w.word}`).join('\n'));
  } else console.log('\nwords: none (no OPENAI_API_KEY, --no-words, or no speech)');
  const top = [...a.onsets].sort((x, y) => y.strength - x.strength).slice(0, 12).sort((x, y) => x.t - y.t);
  console.log(`\nonsets: ${a.onsets.length} found. Strongest:`);
  console.log(top.map((o) => `  onset:${a.onsets.indexOf(o) + 1}  ${o.t.toFixed(3)}s  strength ${o.strength.toFixed(2)}`).join('\n'));
  console.log(`\nwrote videos/${slug}/analysis.json. Next: npm run rig -- chart ${slug}`);
}

async function cmdChart(slug: string, args: string[]) {
  const d = resolveScript(slug);
  const from = parseFloat(arg('from', args) ?? '0');
  const to = parseFloat(arg('to', args) ?? String(d.durationInFrames / d.fps));
  const out = path.join(outDir(slug), 'chart.png');
  await still(d, 'SyncChart', {d, analysis: shiftedAnalysis(slug, d), from, to}, out);
  console.log(`chart: ${out}`);
}

async function cmdSpectro(slug: string, args: string[]) {
  const d = resolveScript(slug);
  if (!d.audio) throw new ScriptError('script has no audio');
  const from = parseFloat(arg('from', args) ?? '0');
  const to = parseFloat(arg('to', args) ?? String(d.durationInFrames / d.fps));
  const out = path.join(outDir(slug), 'spectro.png');
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(d.audio.startFrom + from), '-t', String(to - from), '-i', path.join(VIDEOS, d.audio.src),
    '-lavfi', 'showspectrumpic=s=1920x500:legend=1:stop=4000:scale=log:color=intensity', out]);
  if (r.status !== 0) throw new ScriptError(`ffmpeg failed: ${r.stderr}`);
  console.log(`spectrogram ${from}s-${to}s (the axis starts at 0 = ${from}s video time): ${out}`);
}

async function cmdStill(slug: string, args: string[]) {
  const d = resolveScript(slug);
  const times = args.filter((a) => !a.startsWith('--'));
  if (!times.length) throw new ScriptError('give at least one time, e.g. still my-video 3.2 f400');
  for (const t of times) {
    const frame = Math.min(d.durationInFrames - 1, toFrame(t, d.fps));
    const out = path.join(outDir(slug), `still-${String(frame).padStart(5, '0')}.png`);
    await still(d, 'Chat', {d, withAudio: false}, out, frame);
    console.log(`still ${(frame / d.fps).toFixed(2)}s (f${frame}): ${out}`);
  }
}

async function cmdSheet(slug: string, args: string[]) {
  const d = resolveScript(slug);
  let frames: number[];
  let labels: string[];
  const at = arg('at', args);
  const every = arg('every', args);
  const from = parseFloat(arg('from', args) ?? '0');
  const to = parseFloat(arg('to', args) ?? String((d.durationInFrames - 1) / d.fps));
  if (at) {
    frames = at.split(',').map((t) => toFrame(t.trim(), d.fps));
    labels = frames.map(() => '');
  } else if (every) {
    frames = [];
    for (let t = from; t <= to + 1e-6; t += parseFloat(every)) frames.push(Math.round(t * d.fps));
    labels = frames.map(() => '');
  } else {
    const ev = d.timeline.filter((e) => e.seconds >= from && e.seconds <= to);
    frames = ev.map((e) => Math.min(d.durationInFrames - 1, e.frame + Math.round(0.4 * d.fps)));
    labels = ev.map((e) => `+0.4 after ${e.kind}: ${e.label}`);
    frames.unshift(Math.round(from * d.fps));
    labels.unshift('start');
  }
  frames = frames.map((f) => Math.max(0, Math.min(d.durationInFrames - 1, f)));
  const cols = parseInt(arg('cols', args) ?? String(Math.min(6, frames.length)), 10);
  const out = path.join(outDir(slug), 'sheet.png');
  await still(d, 'Sheet', {d, frames, labels, cols}, out);
  console.log(`sheet (${frames.length} frames): ${out}`);
}

// Keep true peaks about 1 dB under full scale after AAC encoding, so platform re-encodes don't clip.
const LIMIT = 'alimiter=limit=0.8:level=false:attack=2:release=50';

async function cmdRender(slug: string) {
  const d = resolveScript(slug);
  printTimeline(d);
  const url = await getBundle(d);
  const inputProps = {d, withAudio: false};
  const composition = await selectComposition({serveUrl: url, id: 'Chat', inputProps});
  const silent = path.join(outDir(slug), `${slug}.mp4`);
  let last = -1;
  await renderMedia({
    composition,
    serveUrl: url,
    codec: 'h264',
    outputLocation: silent,
    inputProps,
    crf: 14,
    imageFormat: 'jpeg',
    jpegQuality: 95,
    pixelFormat: 'yuv420p',
    muted: true,
    chromiumOptions: {gl: 'angle'},
    onProgress: ({progress}) => {
      const p = Math.floor(progress * 20);
      if (p !== last) {
        last = p;
        process.stdout.write(`\rrendering ${Math.round(progress * 100)}%   `);
      }
    },
  });
  console.log(`\nvideo (silent, upload this): ${silent}`);
  if (d.audio) {
    const preview = path.join(outDir(slug), `${slug}.preview.mp4`);
    const audioFile = path.join(VIDEOS, d.audio.src);
    const dur = (d.durationInFrames / d.fps).toFixed(3);
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-ss', String(d.audio.startFrom), '-i', audioFile, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', LIMIT, '-c:a', 'aac', '-b:a', '192k', '-t', dur, preview], {stdio: 'inherit'});
    if (r.status === 0) console.log(`preview (with audio, check sync): ${preview}`);
    // The exact sound the video was timed to (trimmed, and time-stretched if audio.speed is set).
    const track = path.join(outDir(slug), `${slug}.audio.m4a`);
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(d.audio.startFrom), '-i', audioFile, '-t', dur, '-af', LIMIT, '-c:a', 'aac', '-b:a', '192k', track], {stdio: 'inherit'});
    console.log(`sound track (matches the video from 0:00): ${track}`);
    if (readRaw(slug).audio?.speed && readRaw(slug).audio.speed !== 1)
      console.log(`\nThe sound is time-stretched, so the app's library version will NOT line up. Upload the preview (it has the sound), or add ${slug}.audio.m4a as the sound.`);
    else console.log(`\nIn the app: use the sound starting at ${d.audio.startFrom.toFixed(2)}s of the clip, aligned to 0:00 of the video.`);
  }
}

async function cmdGenImages(slug: string, args: string[]) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ScriptError('OPENAI_API_KEY is not set. Add it to .env in the project root.');
  const raw = readRaw(slug);
  const photos: {file: string; prompt: string; raw?: boolean}[] = [];
  const visit = (v: any) => {
    if (v && typeof v === 'object') {
      if (v.photo && typeof v.photo === 'object' && v.photo.prompt) photos.push(v.photo);
      Object.values(v).forEach(visit);
    }
  };
  visit(raw.history);
  visit(raw.events);
  const force = args.includes('--force');
  const model = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
  for (const p of photos) {
    const abs = path.join(videoDir(slug), p.file);
    if (fs.existsSync(abs) && !force) {
      console.log(`exists, skip: ${p.file}`);
      continue;
    }
    const prompt = p.raw
      ? p.prompt
      : `${p.prompt}. Casual, unedited photo taken on an iPhone by a regular person at home: natural indoor lighting, slight grain, realistic everyday background, not staged, no text overlays, no watermark.`;
    console.log(`generating ${p.file} with ${model}…`);
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({model, prompt, size: '1024x1536', quality: 'high', n: 1}),
    });
    const body: any = await res.json();
    if (!res.ok) throw new ScriptError(`OpenAI error for ${p.file}: ${body?.error?.message ?? res.status}`);
    fs.mkdirSync(path.dirname(abs), {recursive: true});
    fs.writeFileSync(abs, Buffer.from(body.data[0].b64_json, 'base64'));
    console.log(`wrote ${abs}`);
  }
}

async function cmdStudio() {
  writeIndex();
  let t: NodeJS.Timeout | undefined;
  fs.watch(VIDEOS, {recursive: true}, (_e, file) => {
    if (!file || !/script\.yaml$|analysis\.json$/.test(String(file))) return;
    clearTimeout(t);
    t = setTimeout(() => {
      writeIndex();
      console.log(`[rig] reloaded ${file}`);
    }, 150);
  });
  spawn('npx', ['remotion', 'studio', 'src/index.ts'], {cwd: ROOT, stdio: 'inherit'});
}

async function main() {
  const [cmd, slug, ...rest] = process.argv.slice(2);
  const needSlug = (s?: string) => {
    if (!s) throw new ScriptError(`usage: npm run rig -- ${cmd} <slug>. Videos: ${listSlugs().join(', ') || '(none)'}`);
    return s;
  };
  switch (cmd) {
    case 'new':
      return cmdNew(needSlug(slug));
    case 'check':
      return printTimeline(resolveScript(needSlug(slug)));
    case 'analyze':
      return cmdAnalyze(needSlug(slug), rest);
    case 'chart':
      return cmdChart(needSlug(slug), rest);
    case 'spectro':
      return cmdSpectro(needSlug(slug), rest);
    case 'still':
      return cmdStill(needSlug(slug), rest);
    case 'sheet':
      return cmdSheet(needSlug(slug), rest);
    case 'render':
      return cmdRender(needSlug(slug));
    case 'gen-images':
      return cmdGenImages(needSlug(slug), rest);
    case 'studio':
      return cmdStudio();
    case 'yaml': // debug: print the parsed script
      return console.log(YAML.stringify(readRaw(needSlug(slug))));
    default:
      console.log(HELP);
  }
}

main().catch((e) => {
  if (e instanceof ScriptError) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }
  throw e;
});
