// Audio analysis: waveform peaks, onsets (spectral flux), and word timestamps (OpenAI).
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import type {Analysis} from './script';

const SR = 22050;
const PEAKS_PER_SECOND = 100;

function decode(file: string): Float32Array {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], {
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${file}: ${r.stderr}`);
  const buf = r.stdout as Buffer;
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

function fftMag(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  const mag = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) mag[i] = Math.log1p(10 * Math.hypot(re[i], im[i]));
  return mag;
}

function onsets(x: Float32Array) {
  const N = 1024;
  const hop = 256;
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const flux: number[] = [];
  let prev: Float64Array | null = null;
  for (let s = 0; s + N <= x.length; s += hop) {
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * win[i];
    const mag = fftMag(re, im);
    let f = 0;
    if (prev) for (let i = 0; i < mag.length; i++) f += Math.max(0, mag[i] - prev[i]);
    flux.push(f);
    prev = mag;
  }
  const max = Math.max(1e-9, ...flux);
  const nf = flux.map((v) => v / max);
  const dt = hop / SR;
  const w = Math.round(0.05 / dt); // local max window ±50ms
  const aw = Math.round(0.5 / dt); // adaptive threshold window ±0.5s
  const out: {t: number; strength: number}[] = [];
  let lastT = -1;
  for (let i = 1; i < nf.length - 1; i++) {
    let isMax = true;
    for (let k = Math.max(0, i - w); k <= Math.min(nf.length - 1, i + w); k++) if (nf[k] > nf[i]) isMax = false;
    if (!isMax) continue;
    let sum = 0;
    let cnt = 0;
    for (let k = Math.max(0, i - aw); k <= Math.min(nf.length - 1, i + aw); k++) {
      sum += nf[k];
      cnt++;
    }
    const thr = (sum / cnt) * 1.5 + 0.06;
    const t = i * dt;
    if (nf[i] > thr && t - lastT > 0.09) {
      out.push({t: +t.toFixed(3), strength: +nf[i].toFixed(3)});
      lastT = t;
    }
  }
  return out;
}

function peaks(x: Float32Array) {
  const per = Math.round(SR / PEAKS_PER_SECOND);
  const p: number[] = [];
  for (let s = 0; s < x.length; s += per) {
    let m = 0;
    for (let i = s; i < Math.min(x.length, s + per); i++) m = Math.max(m, Math.abs(x[i]));
    p.push(m);
  }
  const max = Math.max(1e-9, ...p);
  return p.map((v) => +(v / max).toFixed(3));
}

async function words(file: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return [];
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {Authorization: `Bearer ${key}`},
    body: form,
  });
  const body: any = await res.json();
  if (!res.ok) {
    console.warn(`transcription failed: ${body?.error?.message ?? res.status}`);
    return [];
  }
  return (body.words ?? []).map((w: any) => ({word: w.word, start: +w.start.toFixed(3), end: +w.end.toFixed(3)}));
}

export async function analyzeAudio(file: string, opts: {words: boolean}): Promise<Analysis> {
  const x = decode(file);
  return {
    audioFile: path.basename(file),
    duration: +(x.length / SR).toFixed(3),
    peaks: peaks(x),
    peaksPerSecond: PEAKS_PER_SECOND,
    onsets: onsets(x),
    words: opts.words ? await words(file) : [],
  };
}
