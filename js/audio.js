// Motor de áudio: carrega, inverte, grava (PCM puro, funciona em iOS/Android/desktop) e toca.

let ctx = null;
let current = null; // fonte tocando agora
const cache = new Map();

export function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Libera o áudio no iOS: precisa ser chamado dentro de um toque do usuário.
export function unlock() {
  const c = audioCtx();
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource();
  s.buffer = b; s.connect(c.destination); s.start(0);
}

function decode(arr) {
  const c = audioCtx();
  return new Promise((res, rej) => {
    const p = c.decodeAudioData(arr, res, rej);
    if (p && p.then) p.then(res, rej);
  });
}

export async function load(url) {
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url).then(r => { if (!r.ok) throw new Error('áudio ' + r.status); return r.arrayBuffer(); })
    .then(decode).then(b => clean(b));
  cache.set(url, p);
  p.catch(() => cache.delete(url));
  return p;
}

export function reverse(buf) {
  const c = audioCtx();
  const out = c.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch), dst = out.getChannelData(ch);
    for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i];
  }
  return out;
}

// Pedaço inicial do áudio (dica "ouvir o começo"), com fade no corte.
export function head(buf, frac) {
  const c = audioCtx();
  const len = Math.max(1, Math.floor(buf.length * frac));
  const out = c.createBuffer(1, len, buf.sampleRate);
  const s = buf.getChannelData(0), o = out.getChannelData(0);
  const f = Math.min(len, Math.floor(buf.sampleRate * 0.08));
  for (let i = 0; i < len; i++) o[i] = s[i] * (i > len - f ? (len - i) / f : 1);
  return out;
}

// Corta só o silêncio de verdade do começo/fim (sem comer consoantes fracas como "s", "f", "n"),
// normaliza o volume e aplica fades curtos (evita estalos).
// O limite é calculado a partir do ruído de fundo, não do pico da voz.
export function clean(buf, { padSec = 0.12 } = {}) {
  const c = audioCtx();
  const data = buf.getChannelData(0);
  const n = data.length, sr = buf.sampleRate;
  let peak = 0;
  for (let i = 0; i < n; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; }
  if (peak < 0.003) return buf;
  const win = Math.floor(sr * 0.01);
  const rmsArr = [];
  for (let s = 0; s + win <= n; s += win) { let a = 0; for (let i = s; i < s + win; i++) a += data[i] * data[i]; rmsArr.push(Math.sqrt(a / win)); }
  const sorted = rmsArr.slice().sort((a, b) => a - b);
  const noise = sorted[Math.floor(sorted.length * 0.1)] || 0;
  const thr = Math.max(noise * 2.5, peak * 0.012);
  let first = 0, last = rmsArr.length - 1;
  while (first < rmsArr.length && rmsArr[first] <= thr) first++;
  while (last > first && rmsArr[last] <= thr) last--;
  const pad = Math.floor(sr * padSec);
  let start = Math.max(0, first * win - pad), end = Math.min(n, (last + 1) * win + pad);
  if (first >= rmsArr.length || end - start < sr * 0.15) { start = 0; end = n; }
  const len = end - start;
  const out = c.createBuffer(1, len, sr);
  const o = out.getChannelData(0);
  const gain = Math.min(0.92 / peak, 8);
  const fade = Math.min(Math.floor(sr * 0.015), len >> 2);
  for (let i = 0; i < len; i++) {
    let g = gain;
    if (i < fade) g *= i / fade; else if (i > len - fade) g *= (len - i) / fade;
    o[i] = data[start + i] * g;
  }
  return out;
}

export function stop() {
  if (current) {
    try { current.src.onended = null; current.src.stop(); } catch {}
    const cb = current.onEnd; current = null; cb && cb(true);
  }
}

// Toca um buffer. onProgress(0..1) a cada frame; retorna Promise resolvida no fim.
export function play(buf, { rate = 1, onProgress, onEnd } = {}) {
  stop();
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  src.connect(c.destination);
  const dur = buf.duration / rate;
  const t0 = c.currentTime + 0.02;
  src.start(t0);
  return new Promise(resolve => {
    const me = { src, onEnd: (stopped) => { onProgress && onProgress(stopped ? 0 : 1); onEnd && onEnd(); resolve(); } };
    current = me;
    src.onended = () => { if (current === me) { current = null; me.onEnd(false); } };
    const tick = () => {
      if (current !== me) return;
      onProgress && onProgress(Math.min(1, Math.max(0, (c.currentTime - t0) / dur)));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// ---------------- gravação ----------------
export class Recorder {
  constructor() { this.active = false; }

  async start({ onLevel, maxSec = 7, onAutoStop } = {}) {
    stop();
    const c = audioCtx();
    if (c.state !== 'running') { try { await Promise.race([c.resume(), new Promise(r => setTimeout(r, 400))]); } catch {} }
    try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch {}
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }
    });
    this.chunks = [];
    this.src = c.createMediaStreamSource(this.stream);
    this.proc = c.createScriptProcessor(2048, 1, 1);
    this.mute = c.createGain(); this.mute.gain.value = 0;
    this.proc.onaudioprocess = (e) => {
      if (!this.active) return;
      const d = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(d));
      if (onLevel) { let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * d[i]; onLevel(Math.sqrt(s / (d.length / 4))); }
    };
    this.src.connect(this.proc); this.proc.connect(this.mute); this.mute.connect(c.destination);
    this.active = true;
    this.t0 = performance.now();
    this.timer = setTimeout(() => { if (this.active && onAutoStop) onAutoStop(); }, maxSec * 1000);
  }

  stop() {
    clearTimeout(this.timer);
    this.active = false;
    try { this.src.disconnect(); this.proc.disconnect(); this.mute.disconnect(); } catch {}
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    const c = audioCtx();
    const total = (this.chunks || []).reduce((a, b) => a + b.length, 0);
    if (total < c.sampleRate * 0.2) return null;
    const buf = c.createBuffer(1, total, c.sampleRate);
    const d = buf.getChannelData(0);
    let o = 0; for (const ch of this.chunks) { d.set(ch, o); o += ch.length; }
    this.chunks = [];
    return clean(buf, { padSec: 0.15 });
  }

  elapsed() { return (performance.now() - this.t0) / 1000; }
}

// ---------------- visual da onda ----------------
export function peaks(buf, bars) {
  const d = buf.getChannelData(0), step = Math.floor(d.length / bars) || 1, out = [];
  let max = 0;
  for (let b = 0; b < bars; b++) {
    let s = 0; for (let i = b * step; i < (b + 1) * step && i < d.length; i += 8) s = Math.max(s, Math.abs(d[i]));
    out.push(s); if (s > max) max = s;
  }
  return out.map(v => Math.max(0.06, v / (max || 1)));
}

function fit(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}

export function barCount(canvas) { return Math.max(16, Math.floor(canvas.clientWidth / 6)); }

// progress 0..1: barras já tocadas ficam coloridas
export function drawWave(canvas, pk, progress = 0, colors = ['#a78bfa', '#ec4899', '#f59e0b']) {
  const { g, w, h } = fit(canvas);
  if (!pk || !pk.length) {
    // linha pontilhada "vazia"
    g.fillStyle = 'rgba(255,255,255,.18)';
    const n = barCount(canvas), bw = w / n;
    for (let i = 0; i < n; i++) g.fillRect(i * bw + bw * 0.25, h / 2 - 1.5, bw * 0.5, 3);
    return;
  }
  const n = pk.length, bw = w / n;
  const grad = g.createLinearGradient(0, 0, w, 0);
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
  for (let i = 0; i < n; i++) {
    const bh = Math.max(3, pk[i] * (h - 6));
    const played = i / n < progress;
    g.fillStyle = played ? grad : 'rgba(255,255,255,.25)';
    const x = i * bw + bw * 0.2, y = (h - bh) / 2, r = Math.min(bw * 0.3, 3);
    roundRect(g, x, y, bw * 0.6, bh, r);
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill();
}

// ---------------- efeitos sonoros sintetizados ----------------
let sfxOn = true;
export function setSfx(v) { sfxOn = v; }

function tone(freq, t, dur, type = 'sine', vol = 0.18, slide) {
  const c = audioCtx();
  const o = c.createOscillator(), gn = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + t + dur);
  gn.gain.setValueAtTime(0.0001, c.currentTime + t);
  gn.gain.exponentialRampToValueAtTime(vol, c.currentTime + t + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + dur);
  o.connect(gn); gn.connect(c.destination);
  o.start(c.currentTime + t); o.stop(c.currentTime + t + dur + 0.02);
}

export const sfx = {
  tap() { if (sfxOn) tone(660, 0, 0.06, 'triangle', 0.08); },
  correct() { if (!sfxOn) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.22, 'triangle', 0.16)); },
  wrong() { if (!sfxOn) return; tone(220, 0, 0.18, 'sawtooth', 0.08, 140); tone(160, 0.12, 0.25, 'sawtooth', 0.08, 90); },
  warm() { if (sfxOn) tone(440, 0, 0.12, 'triangle', 0.1, 520); },
  reveal() { if (!sfxOn) return; tone(300, 0, 0.35, 'sine', 0.1, 900); },
  recOn() { if (sfxOn) tone(880, 0, 0.08, 'sine', 0.12); },
  recOff() { if (sfxOn) tone(520, 0, 0.08, 'sine', 0.12); },
  win() { if (!sfxOn) return; [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.28, 'triangle', 0.15)); },
};
